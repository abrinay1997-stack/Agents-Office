// Fase 5 — Contenido, publicación en Meta y Analíticas, en el Worker. Contesta /api/contenido/* con las mismas rutas y las mismas formas de respuesta que la oficina local
// (el controlador es el mismo: contenido/rutas-nucleo.mjs) menos la Bandeja (/api/contenido/bandeja*, que es de otra fase y se deja pasar al módulo siguiente).
// Guía: docs/cloudflare.md → «Fase 5». Lo que cambia respecto a la oficina local, en corto:
//  · las piezas, la cola y las fotos de Analíticas viven en D1 (migración 0020); los archivos del Estudio, en R2 (`MEDIA`, clave = el id de la galería); los textos guardados y las
//    plantillas, en el Cerebro (`notas`).
//  · el reloj de cada minuto (`cadaMinuto`) hace lo que hacían setInterval(tick) y el pulso de Meta de serve.mjs, bajo un candado (una vuelta a la vez).
//  · SOLO UN ADMINISTRADOR aprueba, entrega, reintenta, quita, escribe en el Cerebro (textos guardados, plantillas), pide una propuesta al agente (cuesta dinero) o toca Meta.
//    Un editor crea y corrige piezas (y una pieza aprobada que se corrige pierde su OK); lectura solo mira.
//  · el token de Meta (META_ACCESS_TOKEN) y el de Metricool son secretos del Worker: nunca están en D1, ni en una respuesta, ni en un registro.
import { json, error, prohibido, noEncontrado } from '../lib/respuesta.js';
import { conZona } from '../lib/zona.js';
import { crearServicio } from '../lib/contenido/servicio.js';
import { leerConfig, validarCambio, guardarConfig, MODOS } from '../lib/contenido/config.js';
import { candadoVigente, tomarCandado, soltarCandado } from '../lib/contenido/cola.js';
import { crearIndicadores } from '../lib/contenido/aprender.js';
import { hayQueAdoptar, adoptar } from '../lib/contenido/migracion.js';
import { describirZona } from '../lib/zona.js';
import { crearPresupuesto, contarD1, contarR2 } from '../lib/contenido/presupuesto.js';
import { avisosDeFormato } from '../../../media/formatos-imagen.mjs';
import { LIMITE_VISION } from '../../../contenido/rutas-nucleo.mjs';

export const nombre = 'contenido';
export const grupos = ['contenido'];

const MAX_CUERPO = 1_000_000;
// Lo que SOLO hace un administrador (el dueño): decidir qué sale, tocar Meta, gastar en el agente, escribir en el Cerebro.
const SOLO_ADMIN = [
  /^\/api\/contenido\/piezas\/[a-z0-9-]+\/(aprobar|devolver|reintentar|entregar|quitar|repetir|publicar-ya)$/,
  /^\/api\/contenido\/(cola\/tick|conductor\/comprobar|llenar|mejorar|guardados|plantillas|config|meta\/sincronizar|analiticas\/actualizar|analiticas\/indicadores)(\/.*)?$/,
];
const soloAdmin = (metodo, ruta) => metodo !== 'GET' && SOLO_ADMIN.some(r => r.test(ruta));

/** Todo lo de una petición/vuelta pasa por aquí: el reloj de la oficina como `Date`, el servicio armado, y al final lo pendiente escrito. */
export async function conServicio(env, fn, opciones = {}) {
  // El presupuesto de la invocación: cada sentencia de D1 y cada operación de R2 se cuenta (y cada llamada a Meta, en el servicio) para cortar la vuelta antes de pasarse del tope.
  const pres = crearPresupuesto(env), db = contarD1(env.DB, pres.interna);
  env = { ...env, DB: db, MEDIA: contarR2(env.MEDIA, pres.interna) };
  // lo que subió la herramienta de migración (scripts/migrar/contenido.mjs) pasa a las tablas de Contenido, por tandas, sin pisar lo que la nube ya tenga
  let adoptando = false;
  try { if (await hayQueAdoptar(db)) { const r = await adoptar(db); adoptando = r.quedan > 0; } } catch (e) { console.error('[contenido] migración:', e?.message ?? e); adoptando = true; } // si no se pudo, nada corre hasta que termine
  const config = await leerConfig(db);
  return conZona(config.zona, async () => {
    // AO_FETCH y AO_AHORA son SOLO para pruebas: un secreto de Cloudflare es siempre un texto, así que en producción nunca son funciones y no se usan.
    const semilla = { fetchFn: typeof env['AO_FETCH'] === 'function' ? env['AO_FETCH'] : undefined, ahora: typeof env['AO_AHORA'] === 'function' ? env['AO_AHORA'] : undefined };
    const svc = await crearServicio({ env, db, config, presupuesto: pres, ...semilla, ...opciones });
    svc.adoptando = adoptando;
    try { return await fn(svc, config); }
    finally { await svc.vaciar().catch(e => console.error('[contenido] al terminar:', e?.message ?? e)); }
  });
}

async function leerCuerpo(req, tope = MAX_CUERPO) {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  const largo = Number(req.headers.get('content-length') || 0);
  if (largo > tope) throw Object.assign(new Error('el cuerpo es demasiado grande'), { status: 413 });
  try { return await req.json(); } catch { return {}; }
}

export async function manejar(ctx) {
  const { req, env, usuario, url, ruta } = ctx, metodo = req.method;
  if (ruta !== '/api/contenido' && !ruta.startsWith('/api/contenido/')) return null;
  if (ruta === '/api/contenido/bandeja' || ruta.startsWith('/api/contenido/bandeja/')) return null; // la Bandeja es de otra fase: pasa al módulo que la conteste
  if (metodo !== 'GET' && usuario.rol === 'lectura') return prohibido('Con acceso de lectura no se cambia nada en Contenido.');
  if (soloAdmin(metodo, ruta) && usuario.rol !== 'admin') return prohibido('Solo un administrador decide esto en Contenido (aprobar, entregar, tocar Meta o escribir en el Cerebro).');
  let cuerpo; try { cuerpo = await leerCuerpo(req, ruta === '/api/contenido/mejorar' ? LIMITE_VISION : MAX_CUERPO); } catch (e) { return error(e.message, e.status || 400); } // «Mejorar» lleva las fotos de la pieza (hasta 4 imágenes reducidas)
  const crudo = cuerpo; // (un arreglo o un texto no es un cuerpo válido para las rutas; los ajustes lo dicen en palabras)
  if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) cuerpo = {};
  // Quién aprueba lo pone el servidor (la sesión), no lo que diga el cuerpo.
  if (/\/(aprobar|publicar-ya)$/.test(ruta)) cuerpo = { ...cuerpo, quien: usuario.email };
  if (/\/publicar-ya$/.test(ruta)) cuerpo = { ...cuerpo, por: cuerpo.por ?? 'dueno' }; // la sesión de un administrador ES el canal del dueño; quien declare otra cosa (un agente) sigue recibiendo 403

  return conServicio(env, async (svc, config) => {
    if (svc.adoptando && metodo !== 'GET' && ruta !== '/api/contenido/config') return error('Se está mudando Contenido a la nube y todavía no terminó (por tandas, cada minuto): espera un momento y vuelve a intentarlo.', 409);
    // ---- cloud only: los ajustes de Contenido (en la oficina local son Ajustes → Contenido) ----
    if (ruta === '/api/contenido/config' && metodo === 'GET') return json({ config, modos: MODOS, zona: describirZona(config.zona) });
    if (ruta === '/api/contenido/config' && metodo === 'PUT') {
      const v = validarCambio(crudo, config); if (!v.ok) return error(v.error, 422);
      await guardarConfig(env.DB, v.valor);
      await env.DB.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'contenido-config', usuario.email, JSON.stringify({ cambia: Object.keys(cuerpo), modo: v.valor.modo, conductor: v.valor.conductor })).run();
      return json({ ok: true, config: v.valor });
    }
    // ---- Analíticas y la conexión con Meta (contenido/rutas-analiticas.mjs) ----
    if (ruta === '/api/contenido/analiticas' && metodo === 'GET') {
      const dias = Math.min(180, Math.max(7, parseInt(url.searchParams.get('dias') || '90', 10) || 90)), m = svc.conductores.meta.estado();
      const { serie, publicaciones, ultimaFoto } = await svc.analit.leer({ dias });
      return json({ meta: m, serie, publicaciones, ultimaFoto, hoy: svc.analit.fechaDeFoto(), pendientes: m.configurado ? (await svc.analit.pendientes(m.cuentas)).length : 0, actualizando: await candadoVigente(env.DB, 'analiticas'), indicadores: await svc.indicadoresEstado() });
    }
    if (ruta === '/api/contenido/analiticas/actualizar' && metodo === 'POST') {
      if (!svc.conductores.meta.configurado()) return error('Falta el secreto META_ACCESS_TOKEN en Cloudflare: sin él no hay de dónde leer.', 400);
      if (!svc.conductores.meta.estado().cuentas.length) return error('Todavía no se sabe qué cuentas hay: pulsa «Comprobar conexión» primero.', 409);
      const trabajo = fotografiar(svc, env, { todas: url.searchParams.get('todas') === '1' });
      if (ctx.waitUntil(trabajo.then(() => svc.vaciar()))) return json({ ok: true, actualizando: true }, 202); // M4: responde ya; la foto sigue detrás y al terminar vacía lo pendiente
      return json({ ok: true, actualizando: false, ...(await trabajo) }, 202); // sin ctx.waitUntil (pruebas): se espera
    }
    if (ruta === '/api/contenido/meta/sincronizar' && metodo === 'POST') { const e = await svc.conductores.meta.sincronizar(); return json({ ok: !e.error, meta: e }); }
    if (ruta === '/api/contenido/analiticas/indicadores' && metodo === 'POST') return json({ ok: true, ...(await crearIndicadores(env.DB)) });
    const mini = /^\/api\/contenido\/miniatura\/([a-f0-9]{20})$/.exec(ruta);
    if (mini && metodo === 'GET') {
      const f = await svc.analit.miniatura(mini[1]); if (!f) return noEncontrado('Miniatura');
      return new Response(f.cuerpo, { status: 200, headers: { 'content-type': f.tipo, 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'" } });
    }
    // ---- todo lo demás: el controlador de la oficina local ----
    const r = await svc.controlador.responder({ metodo, p: ruta, query: url.searchParams, cuerpo: async () => cuerpo });
    return json(r.datos, r.status);
  }, { waitUntil: ctx.waitUntil });
}

/** CON-01/13: el aviso (uno por archivo) de aprobar una pieza para Instagram con imágenes que no son JPEG. Lo calcula `media/formatos-imagen.mjs` y lo añade el controlador al aprobar. null si no hay nada que decir. */
export function avisoDeFormato(pz, hayBinding) {
  const a = avisosDeFormato(pz?.medios || [], { redes: pz?.redes || [], puedeConvertir: !!hayBinding });
  return a.length ? a.join(' ') : null;
}

/** La foto de las cuentas que faltan (o de todas) mientras queden llamadas; con el candado «analiticas» (una a la vez). Después, los indicadores del dueño y aprender. */
export async function fotografiar(svc, env, { todas = false, max = Infinity } = {}) {
  const dueno = 'foto:' + crypto.randomUUID();
  if (!(await tomarCandado(env.DB, 'analiticas', dueno, 5 * 60e3))) return { hechas: 0, fallidas: [], total: 0, ocupada: true };
  try {
    const r = await svc.analit.actualizar({ todas, max });
    if (r.hechas) { try { await svc.despuesDeFoto(); } catch (e) { console.warn('[contenido] después de la foto:', e?.message ?? e); } }
    if (r.fallidas.length) await env.DB.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'contenido', 'sistema', JSON.stringify({ que: 'analiticas-fallo', cuentas: r.fallidas.map(f => f.cuenta), motivo: r.fallidas[0].motivo })).run().catch(() => {});
    return r;
  } finally { await soltarCandado(env.DB, 'analiticas', dueno).catch(() => {}); }
}

let ultimaLimpieza = 0;
/** Cada minuto: la cola y el pulso de Meta; si no hubo nada que hacer, la foto de Analíticas (una cuenta por vuelta) desde las 6:00 de la oficina. */
export async function cadaMinuto(env) {
  return conServicio(env, async (svc, config) => {
    if (svc.adoptando) return { ocupada: false, adoptando: true, cambios: 0 }; // ni cola ni Meta ni Analíticas hasta que lo mudado esté entero (una cola sin su pieza se soltaría)
    const v = await svc.vuelta();
    const huboTrabajo = v.ocupada || (v.tick?.acciones || 0) > 0 || (v.cambios || 0) > 0;
    if (!huboTrabajo) await tickAnaliticas(svc, env);
    const t = Date.now();
    if (t - ultimaLimpieza > 3600e3) { ultimaLimpieza = t; await svc.almacen.purgarPapelera().catch(() => {}); } // lo que lleva 30 días en la papelera se va
    return v;
  });
}

async function tickAnaliticas(svc, env) { // M3: UNA cuenta por vuelta del cron (la foto de una cuenta son ~30 llamadas a Meta)
  try {
    const meta = svc.conductores.meta;
    if (!meta.configurado() || (await candadoVigente(env.DB, 'analiticas'))) return;
    if (new Date(svc.ahora()).getHours() < svc.analit.horaDeLaFoto) return; // las 6:00 de la oficina (el reloj de Panamá)
    const e = meta.estado(), viejo = !e.sincronizadaAt || svc.ahora() - Date.parse(e.sincronizadaAt) > (e.cuentas.length ? 24 : 6) * 3600e3;
    if (viejo) { const n = await meta.sincronizar(); if (n.error && !n.cuentas.length) return; }
    if ((await svc.analit.pendientes(meta.estado().cuentas)).length) await fotografiar(svc, env, { max: 1 });
  } catch (err) { console.warn('[contenido] analíticas:', err?.message ?? err); }
}
