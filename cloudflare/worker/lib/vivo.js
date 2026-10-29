// Avisar a las personas conectadas de que algo cambió (fase 10). UNA sola puerta, a propósito: lib/rutas.js llama a `avisarCambio`
// tras cualquier escritura que salió bien, así un módulo nuevo no puede «olvidarse» de avisar (el fallo que no se ve mirando la pantalla:
// el dato está en D1, la respuesta fue 200 y la otra persona sigue viendo lo de antes).
// Perder el aviso nunca cuesta la escritura: no se espera y los errores se ignoran. El sondeo de la página es la red de seguridad.

/**
 * LISTA BLANCA de lo que se difunde: grupo de /api → { área, nombre legible, soloAdmin }. Un grupo que no está aquí NO se difunde (nunca sale al toast
 * un nombre interno como «settings»). `nombre` vacío = se refresca en silencio, sin aviso. Lo `soloAdmin` solo lo reciben los administradores: un editor
 * o una lectura no se entera de que se tocaron los ajustes, los conectores o a Dimitri.
 */
export const AREAS = Object.freeze({
  tasks: { area: 'tareas', nombre: 'Tareas' }, tareas: { area: 'tareas', nombre: 'Tareas' }, routines: { area: 'tareas', nombre: 'Tareas' },
  team: { area: 'tareas', nombre: 'Tareas' }, calendar: { area: 'tareas', nombre: 'Tareas' },
  contenido: { area: 'contenido', nombre: 'Contenido' }, anuncios: { area: 'anuncios', nombre: 'Anuncios' },
  media: { area: 'estudio', nombre: 'el Estudio' }, brain: { area: 'cerebro', nombre: 'el Cerebro' }, note: { area: 'cerebro', nombre: 'el Cerebro' },
  agentes: { area: 'agentes', nombre: 'los agentes' }, ejecuciones: { area: 'agentes', nombre: 'los agentes' },
  equipo: { area: 'equipo', nombre: '' }, yo: { area: 'equipo', nombre: '' }, // la lista del equipo y los avatares se refrescan sin avisar
  conectores: { area: 'conectores', nombre: 'los conectores', soloAdmin: true }, settings: { area: 'ajustes', nombre: 'los ajustes', soloAdmin: true },
  sub: { area: 'dimitri', nombre: 'Dimitri', soloAdmin: true }, kpi: { area: 'negocio', nombre: 'el negocio', soloAdmin: true },
  negocio: { area: 'negocio', nombre: 'el negocio', soloAdmin: true }, telegram: { area: 'telegram', nombre: 'Telegram', soloAdmin: true },
});

/** → la entrada de la lista blanca para esa ruta, o null (no se difunde). */
export function areaInfo(ruta) {
  const g = /^\/api\/([a-z0-9-]+)/.exec(ruta)?.[1];
  return g && Object.hasOwn(AREAS, g) ? AREAS[g] : null;
}
export const areaDe = (ruta) => areaInfo(ruta)?.area ?? null;
/** El id de pestaña solo vale si tiene la forma esperada; si no, se ignora (no se difunde basura que un cliente cuele en la cabecera). */
export const pestanaValida = (t) => (typeof t === 'string' && /^[A-Za-z0-9-]{1,40}$/.test(t) ? t : null);

const hub = (env) => (env?.HUB ? env.HUB.get(env.HUB.idFromName('oficina')) : null);
const llamar = (env, camino, cuerpo) => hub(env)?.fetch(new Request('https://hub' + camino, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) })).catch(() => {});

/** Difunde un evento. Sin el binding HUB (pruebas, `wrangler dev` mal configurado) no hace nada. */
export function difundir(env, evento) { try { return llamar(env, '/difundir', evento); } catch { return null; } }

/** Tras una escritura correcta: `cambio` con el área, su nombre legible, quién y la PESTAÑA (para que ella no se aplique su propio eco). */
export function avisarCambio(env, { ruta, metodo, estado, usuario, req }) {
  if (!env?.HUB || metodo === 'GET' || metodo === 'HEAD' || estado >= 300) return null;
  const info = areaInfo(ruta);
  if (!info) return null;
  return difundir(env, { tipo: 'cambio', area: info.area, nombre: info.nombre, ...(info.soloAdmin ? { soloAdmin: true } : {}), por: { id: usuario?.id ?? null, nombre: usuario?.nombre ?? '', tab: pestanaValida(req?.headers?.get('X-Pestana')) }, at: Date.now() });
}

/** CON-12: el reloj (cron) cambió algo de `area` sin que nadie escribiera por HTTP: se avisa a todos con UNA señal, solo el área, ningún texto ni id de pieza (la página relee con su API). */
export function avisarDelReloj(env, area) {
  const info = Object.values(AREAS).find((a) => a.area === area);
  if (!info || info.soloAdmin) return null; // un área solo de administradores no se avisa por aquí
  return difundir(env, { tipo: 'cambio', area, nombre: '', por: { id: null, nombre: '', tab: null }, at: Date.now() });
}

/** Cierra los sockets de una persona (quitada del equipo, cambió la contraseña…). */
export function cerrarDe(env, userId, motivo = 'sesión cerrada') { try { return llamar(env, '/cerrar', { userId, motivo }); } catch { return null; } }

/** Para los tests y el diagnóstico: a quién ve el objeto ahora. */
export async function estadoDelHub(env) { const h = hub(env); return h ? (await h.fetch(new Request('https://hub/estado'))).json() : null; }
