// Conectores MCP remotos: añadir, ver, probar y quitar DESDE LA PÁGINA (Ajustes → Conectores), con el token guardado cifrado o como secreto del Worker.
//   GET    /api/conectores               la lista (cualquier rol): nunca un token ni una dirección con pinta de secreto
//   GET    /api/conectores/plantillas    Zapier, n8n, Make, Gmail… con su icono y su guía (cualquier rol)
//   POST   /api/conectores               crear o cambiar (admin). `token` opcional: se cifra y NO vuelve nunca
//   PATCH  /api/conectores/<nombre>      { activo } (admin)
//   PUT    /api/conectores/<nombre>/token  { token }  ·  DELETE …/token  (admin)
//   DELETE /api/conectores/<nombre>      (admin)
//   POST   /api/conectores/probar        (admin) pide tools/list y dice qué herramientas lee o envía cada una, con el error en palabras si falla
// El candado de envío NO cambia: una herramienta de envío solo corre en una ejecución aprobada por un administrador, bajo el guardián (lib/agentes/guardian.js).
import { json, error, prohibido } from '../lib/respuesta.js';
import { validarConector, publico, urlPermitida, urlVisible, TOKEN_VALIDO } from '../lib/conectores.js';
import { PLANTILLAS, iconoUri } from '../lib/iconos-conectores.js';
import { conectoresListados, conAcceso } from '../lib/conectores-acceso.js';
import { cifrar, hayClave, SIN_CLAVE } from '../lib/cifrado.js';
import { crearClienteMcp } from '../lib/agentes/mcp-cliente.js';
import { kindOf } from '../../../safety.mjs';
import { limpiarSecretos } from '../lib/secretos.js';

export const nombre = 'conectores';
export const grupos = ['conectores'];
const MAX_CONECTORES = 40;
const TOPE_PRUEBAS_HORA = 30;

const NOMBRE = /^[a-z][a-z0-9-]{1,39}$/;
const hostDe = (u) => { try { return new URL(u).host; } catch { return ''; } };
const auditar = (db, ctx, tipo, detalle) => db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ctx.ahora(), tipo, ctx.usuario.email, JSON.stringify(detalle)).run();
const unoPorNombre = async (db, n) => (await conectoresListados(db)).find((c) => c.nombre === n) || null;

/** Una herramienta es de lectura solo si safety.kindOf lo dice; en la duda, envía. */
export const tipoDe = (servidor, herramienta) => (kindOf(`mcp__${servidor}__${herramienta}`) === 'read' ? 'lectura' : 'envio');

/** El mensaje de un fallo de conexión, en palabras y con qué hacer. */
export function explicar(msg) {
  const m = String(msg || '');
  if (/rechaz[oó] el acceso/i.test(m)) return 'El servidor rechazó el acceso (401/403): revisa el token y que la autenticación sea la que pide (Bearer o cabecera).';
  if (/tard[oó] demasiado/i.test(m)) return 'El servidor tardó demasiado en contestar (más de 25 s). Revisa que esté encendido y que la dirección sea la correcta.';
  if (/redirige/i.test(m)) return 'La dirección redirige a otra: la oficina no sigue redirecciones (el token no sale de la dirección registrada). Usa la dirección final.';
  if (/no contest[oó] con un mensaje MCP/i.test(m)) return 'La dirección contestó, pero no habla MCP (¿es la página web y no el servidor MCP?). Busca la dirección del servidor MCP en la documentación del servicio.';
  if (/contest[oó] 404/i.test(m)) return 'La dirección no existe (404). Revisa que esté completa, con su ruta.';
  if (/contest[oó] 4\d\d|contest[oó] 5\d\d/i.test(m)) return `El servidor contestó con un error (${(m.match(/contest[oó] (\d{3})/i) || [])[1]}). Mira su documentación o vuelve a intentarlo más tarde.`;
  if (/no se pudo hablar/i.test(m)) return 'No se pudo conectar con esa dirección. Revisa que esté bien escrita y que el servidor esté en internet.';
  if (/falta el token/i.test(m)) return 'Falta el token. Pégalo en el formulario y vuelve a probar.';
  if (/direcci[oó]n no permitida/i.test(m)) return 'La dirección no está permitida (debe ser https, un dominio público; nunca una dirección local ni una IP).';
  return limpiarSecretos(m).slice(0, 220) || 'No se pudo conectar.';
}

export async function manejar(ctx) {
  const { req, env, db, ruta, usuario } = ctx;
  if (!ruta.startsWith('/api/conectores')) return null;
  const metodo = req.method;
  let m;

  if (ruta === '/api/conectores' && metodo === 'GET') return json({ conectores: (await conectoresListados(db)).map((c) => publico(c, env)), cifrado: hayClave(env) });
  if (ruta === '/api/conectores/plantillas' && metodo === 'GET') return json({ plantillas: PLANTILLAS.map((p) => ({ id: p.id, nombre: p.nombre, auth: p.auth, pista: p.pista, oauth: !!p.oauth, destacada: !!p.destacada, pasos: p.pasos, iconUri: iconoUri({ plantilla: p.id, nombre: p.nombre }) })), cifrado: hayClave(env) });

  if (usuario.rol !== 'admin') return prohibido('Solo un administrador cambia o prueba los conectores.');

  if (ruta === '/api/conectores' && metodo === 'POST') {
    const b = (await ctx.cuerpo(req)) || {};
    const antes = NOMBRE.test(String(b.nombre || '')) ? await unoPorNombre(db, String(b.nombre)) : null;
    if (antes && (b.url === undefined || b.url === null || b.url === '')) b.url = antes.url; // cambiar un conector sin volver a escribir su dirección (la página no la ve entera si lleva un secreto)
    const v = validarConector(b);
    if (!v.ok) return json({ error: v.errores.join(' '), errores: v.errores }, 422);
    const c = v.valor, previo = await unoPorNombre(db, c.nombre);
    if (!previo && (await conectoresListados(db)).length >= MAX_CONECTORES) return error(`Ya hay ${MAX_CONECTORES} conectores: quita alguno antes de añadir otro.`, 409);
    let cifrado = previo?.token_cifrado || null;
    if (v.token !== undefined) {
      if (!hayClave(env)) return error(SIN_CLAVE, 409);
      cifrado = await cifrar(env, v.token, c.nombre);
    } else if (previo && hostDe(previo.url) !== hostDe(c.url)) cifrado = null; // cambió de servidor: el token guardado NO se va con él (se vuelve a poner)
    if (c.auth_tipo === 'ninguna' || c.secreto) cifrado = null; // un secreto del Worker o «sin autenticación»: no queda un token guardado de antes
    await db.prepare(
      `insert into conectores (id, nombre, url, secreto, departamentos, herramientas_lectura, herramientas_envio, activo, created_at)
       values (?,?,?,?,?,?,?,1,?)
       on conflict (nombre) do update set url=excluded.url, secreto=excluded.secreto, departamentos=excluded.departamentos,
         herramientas_lectura=excluded.herramientas_lectura, herramientas_envio=excluded.herramientas_envio`)
      .bind(ctx.uuid(), c.nombre, c.url, c.secreto, JSON.stringify(c.departamentos), JSON.stringify(c.herramientas_lectura), JSON.stringify(c.herramientas_envio), ctx.ahora()).run();
    const dominios = c.dominios_permitidos === undefined ? (previo?.dominios_permitidos || null) : (c.dominios_permitidos.length ? JSON.stringify(c.dominios_permitidos) : null); // SEG-02: sin el campo, se conserva la lista; con él, se reemplaza (vacío = quitarla)
    await db.prepare(`insert into conectores_extra (nombre, auth_tipo, cabecera, token_cifrado, plantilla, etiqueta, dominios_permitidos, updated_at) values (?,?,?,?,?,?,?,?)
       on conflict (nombre) do update set auth_tipo=excluded.auth_tipo, cabecera=excluded.cabecera, token_cifrado=excluded.token_cifrado, plantilla=excluded.plantilla, etiqueta=excluded.etiqueta, dominios_permitidos=excluded.dominios_permitidos, updated_at=excluded.updated_at`)
      .bind(c.nombre, c.auth_tipo, c.cabecera, cifrado, c.plantilla, c.etiqueta || null, dominios, ctx.ahora()).run();
    await auditar(db, ctx, 'conector', { nombre: c.nombre, accion: previo ? 'cambiado' : 'creado', auth: c.auth_tipo, token: cifrado ? 'guardado' : c.secreto ? 'secreto del Worker' : 'ninguno', ...(dominios !== (previo?.dominios_permitidos || null) ? { dominios: dominios ? JSON.parse(dominios) : [] } : {}) });
    return json({ conector: publico(await unoPorNombre(db, c.nombre), env) }, previo ? 200 : 201);
  }

  if (ruta === '/api/conectores/probar' && metodo === 'POST') return probar(ctx);

  if ((m = ruta.match(/^\/api\/conectores\/([a-z][a-z0-9-]{1,39})$/))) {
    const n = m[1], previo = await unoPorNombre(db, n);
    if (metodo === 'DELETE') {
      await db.prepare('delete from conectores where nombre = ?').bind(n).run();
      await db.prepare('delete from conectores_extra where nombre = ?').bind(n).run();
      await auditar(db, ctx, 'conector', { nombre: n, accion: 'quitado' });
      return json({ ok: true });
    }
    if (metodo === 'PATCH') {
      if (!previo) return error('Ese conector no existe.', 404);
      const b = (await ctx.cuerpo(req)) || {};
      if (typeof b.activo !== 'boolean') return error('Manda { activo: true|false }.', 422);
      await db.prepare('update conectores set activo = ? where nombre = ?').bind(b.activo ? 1 : 0, n).run();
      await auditar(db, ctx, 'conector', { nombre: n, accion: b.activo ? 'encendido' : 'apagado' });
      return json({ conector: publico(await unoPorNombre(db, n), env) });
    }
    return null;
  }
  if ((m = ruta.match(/^\/api\/conectores\/([a-z][a-z0-9-]{1,39})\/token$/))) {
    const n = m[1], previo = await unoPorNombre(db, n);
    if (!previo) return error('Ese conector no existe.', 404);
    if (metodo === 'PUT') {
      const b = (await ctx.cuerpo(req)) || {};
      const t = String(b.token ?? '');
      if (!TOKEN_VALIDO.test(t) || /^bearer\s/i.test(t)) return error('El token no es válido: de 8 a 2.000 caracteres, sin espacios, sin la palabra «Bearer».', 422);
      if (!hayClave(env)) return error(SIN_CLAVE, 409);
      if (previo.secreto) return error('Este conector usa un secreto del Worker: cámbialo en GitHub, o quita el secreto del conector para guardar el token aquí.', 409);
      if (previo.auth_tipo === 'ninguna') return error('Este conector es «sin autenticación»: cámbiale la autenticación primero.', 409);
      await db.prepare(`insert into conectores_extra (nombre, auth_tipo, token_cifrado, updated_at) values (?, 'bearer', ?, ?) on conflict (nombre) do update set token_cifrado = excluded.token_cifrado, updated_at = excluded.updated_at`).bind(n, await cifrar(env, t, n), ctx.ahora()).run();
      await auditar(db, ctx, 'conector-token', { nombre: n, accion: 'guardado' });
      return json({ conector: publico(await unoPorNombre(db, n), env) });
    }
    if (metodo === 'DELETE') {
      await db.prepare('update conectores_extra set token_cifrado = null, updated_at = ? where nombre = ?').bind(ctx.ahora(), n).run();
      await auditar(db, ctx, 'conector-token', { nombre: n, accion: 'quitado' });
      return json({ conector: publico(await unoPorNombre(db, n), env) });
    }
    return null;
  }
  return null;
}

/** «Probar conexión»: llama a tools/list. Con `nombre` de un conector que ya existe y sin token nuevo, usa el suyo (guardado o secreto del Worker). El token nuevo NO se guarda por probar. */
async function probar(ctx) {
  const { req, env, db } = ctx;
  const b = (await ctx.cuerpo(req)) || {};
  const n = String(b.nombre || '').toLowerCase();
  const previo0 = NOMBRE.test(n) ? await unoPorNombre(db, n) : null;
  if (!b.url && previo0) b.url = previo0.url; // probar un conector que ya existe, sin volver a escribir su dirección
  const motivo = urlPermitida(b.url);
  if (motivo) return json({ ok: false, error: `La dirección ${motivo}.` }, 422);
  const hechas = (await db.prepare("select count(*) n from auditoria where tipo = 'conector-prueba' and at >= ?").bind(new Date(Date.now() - 36e5).toISOString()).first())?.n ?? 0;
  if (hechas >= TOPE_PRUEBAS_HORA) return error('Ya probaste muchas conexiones en esta hora. Espera un poco.', 429);
  await auditar(db, ctx, 'conector-prueba', { nombre: NOMBRE.test(n) ? n : '(nuevo)', host: hostDe(b.url) });
  const auth = ['ninguna', 'bearer', 'cabecera'].includes(b.auth_tipo) ? b.auth_tipo : 'bearer';
  const previo = NOMBRE.test(n) ? await unoPorNombre(db, n) : null;
  let conector = { nombre: NOMBRE.test(n) ? n : 'prueba', url: new URL(b.url).toString(), secreto: null, auth_tipo: auth, cabecera: auth === 'cabecera' ? String(b.cabecera || '') : null };
  if (auth !== 'ninguna') {
    if (b.token) { if (!TOKEN_VALIDO.test(String(b.token))) return json({ ok: false, error: 'El token no es válido: sin espacios ni saltos de línea, y sin la palabra «Bearer».' }, 422); Object.defineProperty(conector, '_token', { value: String(b.token), enumerable: false }); }
    else if (previo && hostDe(previo.url) === hostDe(conector.url)) conector = Object.assign(await conAcceso({ ...previo, url: conector.url, auth_tipo: auth, cabecera: conector.cabecera }, env), {}); // el mismo servidor: se usa su token ya guardado
  }
  const fetchFn = env.__pruebas?.fetch;
  try {
    const cli = crearClienteMcp({ conector, env, ...(fetchFn ? { fetchFn } : {}), tiempoMs: 15_000 });
    const lista = await cli.listar();
    const herramientas = lista.map((t) => ({ name: t.name, descripcion: String(t.description || '').slice(0, 200), tipo: tipoDe(conector.nombre, t.name) }));
    return json({ ok: true, herramientas, lectura: herramientas.filter((t) => t.tipo === 'lectura').length, envio: herramientas.filter((t) => t.tipo === 'envio').length, excluidas: (lista.excluidas || []).map((x) => ({ name: x.name, motivo: x.motivo })), aviso: herramientas.length ? '' : 'El servidor contestó, pero no ofrece ninguna herramienta.' });
  } catch (e) { return json({ ok: false, error: explicar(e?.message) }); }
}
