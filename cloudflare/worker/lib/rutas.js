// Rutas de la API. Viven aparte de index.js porque un Worker solo puede exportar handlers desde su módulo de entrada
// (workerd rechaza una constante exportada: «Incorrect type for map entry»).
import { json, error, noAutenticado, prohibido, cuerpo } from './respuesta.js';
const TOPE_PUBLICO = 16_000; // bytes de un cuerpo SIN sesión (acceso)
import { usuarioDeLaPeticion, iniciarSesion, cerrarSesion, cookieSesion, cookieBorrada, conCookieRenovada, sesionesDe, cerrarSesionPorId, cerrarTodas, conciliarFlagSesion } from './sesion.js';
import { agentes, ejecutar } from './agentes.js';
import { uuid, ahora } from './ids.js';
import * as cerebro from './cerebro.js';
import { manejarNotas } from './notas.js';
import * as almacen from './almacen.js';
import { servirPagina } from './paginas.js';
import { MODULOS } from '../modulos/index.js';
import { instalarZona } from './zona.js';
import { saludPublica, saludRica, checksDeModulos, completarEstado, marcarAvisosLeidos } from './salud.js';
import { avisarCambio } from './vivo.js';
import * as equipo from '../modulos/equipo.js';
import { retrocesoActivo, fallosDe, anotarFallo, esperaMs, dormir } from './retroceso.js';
import { tasa, tasaVer, ipDe, relojDe, cupoDeModelo } from './equipo.js';
import { cerrarDe } from './vivo.js';
import { podar, tocaPodar } from './mantenimiento.js';
import { registrarSecretos } from './secretos.js';
import { uidDe, PREFIJO_SALA, PREFIJO_DOC_ARCHIVO } from './dimitri/chat.js';

export const VERSION = '0.1.0';
/** Colecciones de /api/migrar/filas que son estado vivo de la nube (ver arriba): una migración repetida solo agrega las que faltan. */
const FILAS_VIVAS = new Set(['tareas', 'subgerente', 'rutinas']);
/** Un documento «vacío»: {} o [], o solo con claves cuyo valor está vacío (listas, objetos, textos o null). */
const docVacio = (v) => v == null || v === '' || (Array.isArray(v) ? v.length === 0 : typeof v === 'object' ? Object.values(v).every(docVacio) : false);
/** Lo único que se contesta sin sesión además de /api/health y /api/acceso: webhooks de otros sistemas, cada uno con su propio secreto (ver `publica` en los módulos). */
export const RUTAS_PUBLICAS = ['/api/hook/', '/api/telegram/', '/api/kpi/'];

/** Una escritura solo vale si viene de esta misma página (defensa extra sobre SameSite=Lax). */
function origenValido(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const o = req.headers.get('Origin');
  return !o || o === new URL(req.url).origin;
}

/** El reloj de cada minuto (lo que en serve.mjs eran setInterval). La zona de la oficina se instala aquí, UNA vez, igual que en `manejar`: los módulos no la tocan. */
/** Lo lento va al final del reloj: una vuelta de agentes espera al modelo (minutos) y, delante, retrasaba lo que es cosa de segundos (los avisos de Telegram, los disparadores, la limpieza del equipo).
 *  El orden de MODULOS sigue siendo el de las rutas (Bandeja antes que Contenido); solo el del reloj cambia. `tareas` va antes: crea las tareas que `agentes` toma en esa misma vuelta. */
export const ordenDelReloj = (modulos) => [...modulos].sort((a, b) => (a.nombre === 'agentes') - (b.nombre === 'agentes'));
export async function correrReloj(env, ahoraMs = Date.now()) {
  registrarSecretos(env); // `ahoraMs`: solo las pruebas lo cambian
  instalarZona(env.ZONA_HORARIA);
  await env.DB.prepare('delete from sessions where expires_at < ?').bind(ahora()).run();
  await conciliarFlagSesion(env.DB).catch(() => {}); // SEG-05: apunta si el flag se apagó
  await env.DB.prepare('delete from sesiones_uso where token_hash not in (select token_hash from sessions)').run().catch(() => {}); // SEG-05: sin migración aplicada no hace nada
  if (tocaPodar(ahoraMs)) { try { await podar(env.DB, ahoraMs); } catch (e) { console.error('[cron] poda:', e?.message ?? e); } } // lo que solo crece (auditoría, ejecuciones, invitaciones vencidas)
  // Un módulo que falle no tumba a los demás.
  for (const mod of ordenDelReloj(MODULOS)) if (mod.cadaMinuto) { try { await mod.cadaMinuto(env); } catch (e) { console.error(`[cron] ${mod.nombre || 'módulo'}:`, e?.message ?? e); } }
}

/** SEG-05: si la sesión se renovó en esta petición, la respuesta lleva la cookie nueva. */
export async function manejar(req, env, exec = null) { return conCookieRenovada(req, await manejarInterno(req, env, exec)); }
async function manejarInterno(req, env, exec = null) {
  registrarSecretos(env);
  instalarZona(env.ZONA_HORARIA); // la hora «local» de las reglas de la oficina es la de su zona (lib/zona.js), no la UTC del Worker
  const url = new URL(req.url);
  const ruta = url.pathname;
  const db = env.DB;
  if (!ruta.startsWith('/api/')) {
    const u = await usuarioDeLaPeticion(db, req);
    // /media/<archivo> (el Estudio: lo que la página pide para ver cada imagen) lo sirve el módulo que lo posee, solo con sesión
    if (u && ruta.startsWith('/media/')) { const m = { req, env, db, usuario: u, url, ruta, json, error, prohibido, cuerpo, uuid, ahora }; for (const mod of MODULOS) { const r = await mod.manejar(m); if (r) return r; } }
    return servirPagina(req, env, u);
  }
  // Los webhooks de otros sistemas (Telegram, los disparadores, los indicadores): SIN sesión (y sin mirar el Origin: un formulario de otra web los llama), cada uno con SU secreto, que el módulo comprueba ANTES de abrir nada (D1, el cuerpo…).
  // Solo estos prefijos llegan a `publica`; cualquier otra ruta sin sesión es 401.
  if (RUTAS_PUBLICAS.some(p => ruta.startsWith(p))) {
    for (const mod of MODULOS) { if (typeof mod.publica !== 'function') continue; const r = await mod.publica({ req, env, db, url, ruta, exec, json, error, uuid, ahora }); if (r) return r; }
    return error('Ruta no encontrada', 404);
  }

  if (!origenValido(req)) return error('Origen no permitido', 403);

  // El único endpoint público además de /api/health y /api/acceso: el webhook de conversiones (Zapier, tu tienda, n8n). SIN sesión, con su propio token
  // (AO_HOOK_TOKEN) que el módulo comprueba antes de leer nada. Va antes de la sesión y después de origenValido.
  if (ruta === '/api/anuncios/conversiones/webhook' && req.method === 'POST') {
    const mod = MODULOS.find((x) => x.webhookConversiones);
    if (mod) return mod.webhookConversiones(req, env, exec);
  }

  // /api/health: sin sesión, lo mínimo; con sesión, lo que la página necesita para dibujarse con los datos de ESTA oficina (el nombre de la empresa, Dimitri, el roster…).
  if (ruta === '/api/health' && req.method === 'GET') {
    const u = await usuarioDeLaPeticion(db, req); // sin cookie no toca D1
    if (!u || u.rol === 'lectura') return json(saludPublica(env, VERSION));
    return json(await saludRica({ req, env, db, usuario: u, url, ruta }, MODULOS));
  }

  // Invitaciones (fase 10): ver y aceptar un enlace, SIN sesión y con tope de intentos por IP (modulos/equipo.js → publica).
  if (ruta.startsWith('/api/invitacion/')) { const r = await equipo.publicaInvitacion(req, env); if (r) return r; }

  if (ruta === '/api/acceso' && req.method === 'POST') {
    const b = await cuerpo(req, TOPE_PUBLICO); // sin sesión: el cuerpo de un acceso son dos textos cortos
    // Tope de intentos (fase 10): por IP (todo intento) y por correo+IP (solo los FALLOS). Contar los intentos por correo a secas dejaba a cualquiera
    // bloquear a su víctima; con la IP en la clave, quien se equivoca desde otra IP no cierra la puerta a quien entra bien desde la suya.
    const huella = String(b?.email ?? '').trim().toLowerCase().slice(0, 120), ip = ipDe(req), claveFallos = `acc:fallo:${ip}:${huella}`;
    const ms = relojDe(env);
    if (!(await tasa(db, 'acc:ip:' + ip, 20, ms)).ok || (await tasaVer(db, claveFallos, ms)) >= 8) return error('Demasiados intentos. Espera un minuto e inténtalo otra vez.', 429);
    const retro = await retrocesoActivo(db); // SEG-06: con el flag, cada intento de un correo con muchos fallos (de cualquier IP) espera antes de contestar, bueno o malo; nunca se rechaza por esto
    if (retro) await dormir(env, esperaMs(await fallosDe(db, huella, ms)));
    const s = await iniciarSesion(db, b?.email, b?.contrasena, req.headers.get('User-Agent') ?? '');
    if (!s) { await tasa(db, claveFallos, 8, ms); if (retro) await anotarFallo(db, huella, ms); return error('Usuario o contraseña incorrectos.', 401); }
    return json({ usuario: s.usuario }, 200, { 'Set-Cookie': cookieSesion(s.testigo, s.segundos) });
  }

  const usuario = await usuarioDeLaPeticion(db, req);
  if (!usuario) return noAutenticado();

  if (ruta === '/api/salir' && req.method === 'POST') { await cerrarSesion(db, req); await cerrarDe(env, usuario.id, 'sesión cerrada'); return json({ ok: true }, 200, { 'Set-Cookie': cookieBorrada() }); }
  // SEG-05: dónde tengo la sesión abierta, cerrar una y cerrar todas (de cada quien, cualquier rol)
  if (ruta === '/api/yo/sesiones' && req.method === 'GET') return json({ sesiones: await sesionesDe(db, usuario.id, req) });
  if (ruta === '/api/yo/sesiones/cerrar' && req.method === 'POST') {
    const b = await cuerpo(req);
    if (!(await cerrarSesionPorId(db, usuario.id, b?.id, req))) return error('Esa sesión no existe o es la que estás usando (para esa, usa «Salir»).', 404);
    await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'sesion', usuario.email, JSON.stringify({ cerro: 'una' })).run();
    await cerrarDe(env, usuario.id, 'sesión cerrada desde otro dispositivo'); // el Hub cierra TODOS los sockets de la cuenta (no distingue dispositivo): la sesión cerrada no reconecta, las demás reconectan solas
    return json({ ok: true, sesiones: await sesionesDe(db, usuario.id, req) });
  }
  if (ruta === '/api/yo/sesiones/cerrar-todas' && req.method === 'POST') {
    const n = await cerrarTodas(db, usuario.id);
    await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'sesion', usuario.email, JSON.stringify({ cerro: 'todas', n })).run();
    await cerrarDe(env, usuario.id, 'sesión cerrada en todos los sitios');
    return json({ ok: true, cerradas: n }, 200, { 'Set-Cookie': cookieBorrada() });
  }
  if (ruta === '/api/yo' && req.method === 'GET') return json({ usuario });
  if (ruta === '/api/agentes' && req.method === 'GET') return json({ agentes: agentes() });

  // ---- El Cerebro (fase 2): las mismas rutas y la misma forma que la oficina local ----
  if (ruta === '/api/brain' && req.method === 'GET') return json(await cerebro.leerGrafo(db));
  if (ruta === '/api/brain/search' && req.method === 'GET') return json(await cerebro.buscar(db, url.searchParams.get('q')));
  if (ruta === '/api/note' && req.method === 'GET') {
    const n = await cerebro.leerNota(db, url.searchParams.get('id') || '', { peek: url.searchParams.get('peek') === '1', puedeEscribir: usuario?.rol === 'admin' || usuario?.rol === 'editor' });
    return n ? json(n) : error('esa nota no existe', 404);
  }
  { const r = await manejarNotas({ req, db, usuario, ruta, cuerpo }); if (r) return r; } // 27 oct 2026: escribir, añadir, papelera
  if (ruta === '/api/migrar/notas' && req.method === 'POST') { // la herramienta de migración de la computadora del dueño
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador sube el Cerebro.');
    const b = await cuerpo(req);
    const v = b?.notas === undefined && b?.grafo ? { ok: true, notas: [] } : cerebro.validarNotas(b?.notas);
    if (!v.ok) return error(v.error, 422);
    const subidas = v.notas.length ? await cerebro.guardarNotas(db, v.notas, { siMasNueva: b?.forzar !== true }) : 0;
    const grafo = b?.grafo ? await cerebro.guardarGrafo(db, b.grafo) : false;
    await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'migracion', usuario.email, JSON.stringify({ notas: subidas, grafo })).run();
    return json({ subidas, grafo, ...(await cerebro.contar(db)) });
  }
  // Importación genérica para los datos de cada módulo (tareas, rutinas, piezas…): los exporta scripts/migrar/<módulo>.mjs desde la computadora del dueño.
  if (ruta === '/api/migrar/filas' && req.method === 'POST') {
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador sube datos.');
    const b = await cuerpo(req);
    if (!/^[a-z][a-z0-9_-]{1,40}$/.test(String(b?.coleccion ?? ''))) return error('Colección no válida.', 422);
    const filas = Array.isArray(b?.filas) ? b.filas : [];
    if (!filas.length || filas.length > 200 || filas.some((f) => !f || typeof f.id !== 'string' || !f.id || f.id.length > 200 || typeof f.valor !== 'object' || f.valor === null)) return error('Filas no válidas (1 a 200, cada una con id y valor).', 422);
    // Las tareas, la conversación con Dimitri y las rutinas son estado VIVO: una migración repetida no las vuelve a como estaban en la computadora (una tarea ya aprobada en la
    // nube volvería a esperar su OK y podría enviarse dos veces; una rutina pausada aquí volvería a dispararse). Solo entran las que la nube no tiene; forzar: true las reemplaza.
    const soloNuevas = b.forzar !== true && FILAS_VIVAS.has(b.coleccion);
    // la conversación con Dimitri de la computadora entra en la sala de quien migra (cada cuenta tiene la suya: lib/dimitri/chat.js)
    const destino = b.coleccion === 'subgerente' ? PREFIJO_SALA + await uidDe(db, usuario) : b.coleccion;
    const n = await almacen.guardarFilas(db, destino, filas, { soloNuevas });
    await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'migracion', usuario.email, JSON.stringify({ coleccion: b.coleccion, filas: n })).run();
    return json({ subidas: n, ...(soloNuevas && n < filas.length ? { omitidas: filas.length - n } : {}), coleccion: b.coleccion, total: await almacen.contarFilas(db, destino) });
  }
  if (ruta === '/api/migrar/docs' && req.method === 'POST') {
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador sube datos.');
    const b = await cuerpo(req);
    if (!/^[a-z][a-z0-9_.-]{1,60}$/.test(String(b?.clave ?? '')) || typeof b?.valor !== 'object' || b.valor === null) return error('Documento no válido.', 422);
    // Lo que ya existe en la nube NO se pisa con una migración repetida: después de la primera, la nube es la copia de trabajo (un aprobador revocado volvería, los indicadores
    // y las cifras perderían lo que se anotó aquí, un agente recuperaría su brief de antes…). Los ajustes, siempre; el resto, mientras tenga algo dentro (una
    // vacía —{} o listas vacías, como las que la propia nube crea al abrirse— se llena). Para reemplazarlo adrede: forzar: true (migrar-a-nube.mjs --forzar).
    const claveDoc = b.clave === 'subgerente.archivo' ? PREFIJO_DOC_ARCHIVO + await uidDe(db, usuario) : b.clave; // el historial de Dimitri de la computadora es de quien migra
    if (b.forzar !== true) {
      const actual = (await almacen.leerDoc(db, claveDoc, null)).valor;
      if (actual && (b.clave === 'ajustes' || b.clave === 'config-local' || !docVacio(actual))) return error(`Ya hay «${b.clave}» en la nube y la migración lo pisaría (se perderían los cambios hechos aquí, y un aprobador revocado volvería). Si de verdad quieres reemplazarlo, manda forzar: true.`, 409);
    }
    const version = await almacen.guardarDoc(db, claveDoc, b.valor);
    await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'migracion', usuario.email, JSON.stringify({ doc: b.clave })).run();
    return json({ clave: b.clave, version });
  }
  if (ruta === '/api/migrar/estado' && req.method === 'GET') return json(await cerebro.contar(db));

  let m;
  if ((m = ruta.match(/^\/api\/agentes\/([a-z0-9-]{2,30})\/ejecutar$/)) && req.method === 'POST') {
    if (usuario.rol === 'lectura') return prohibido();
    const sinCupo = await cupoDeModelo(db, env, 'ejecutar', usuario.id, { porMinuto: 6, porDia: 100 }); // SEG-01
    if (sinCupo) return error(sinCupo, 429);
    const b = await cuerpo(req);
    const r = await ejecutar({ env, db, usuario, agenteId: m[1], texto: b?.texto, aprobada: b?.aprobada === true });
    return r.error ? error(r.error, r.estado) : json(r.ejecucion);
  }

  if (ruta === '/api/ejecuciones' && req.method === 'GET') {
    const { results } = await db.prepare('select id, agente, modo, estado, texto, resultado, error, modelo, created_at from ejecuciones order by created_at desc limit 50').all();
    return json({ ejecuciones: results });
  }

  // ---- Los módulos de cada fase del puerto (worker/modulos/): el primero que reconoce la ruta la contesta ----
  const waitUntil = p => { try { exec?.waitUntil?.(Promise.resolve(p).catch(() => {})); } catch { /* sin ctx (pruebas): el módulo espera él mismo */ } return !!exec?.waitUntil; }; // devuelve si se pudo dejar en segundo plano
  const ctx = { req, env, db, usuario, url, ruta, json, error, prohibido, cuerpo, uuid, ahora, waitUntil };
  for (const mod of MODULOS) {
    const r = await mod.manejar(ctx);
    if (!r) continue;
    // El semáforo y los avisos juntan lo de todos los módulos (cada uno aporta sus `checks` en `salud(ctx)`; los avisos de Contenido y Anuncios viven en otro sitio).
    if (ruta === '/api/status' && req.method === 'GET' && r.ok) return completarEstado(r, await checksDeModulos(ctx, MODULOS), db);
    if (ruta === '/api/notices/read' && req.method === 'POST' && r.ok) await marcarAvisosLeidos(db);
    waitUntil(avisarCambio(env, { ruta, metodo: req.method, estado: r.status, usuario, req })); // fase 10: las personas conectadas se enteran (lib/vivo.js)
    return r;
  }

  // Lo que la oficina local hace y la nube todavía no: un aviso claro en español, nunca un error mudo (docs/plan-cloudflare-completo.md).
  return json({ error: 'Esto todavía no está en la nube: sigue en la oficina de tu computadora.', pendiente: true }, 501);
}

