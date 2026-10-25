// Avisar a las personas conectadas de que algo cambió (fase 10). UNA sola puerta, a propósito: lib/rutas.js llama a `avisarCambio`
// tras cualquier escritura que salió bien, así un módulo nuevo no puede «olvidarse» de avisar (el fallo que no se ve mirando la pantalla:
// el dato está en D1, la respuesta fue 200 y la otra persona sigue viendo lo de antes).
// Perder el aviso nunca cuesta la escritura: no se espera y los errores se ignoran. El sondeo de la página es la red de seguridad.

/** Grupo de /api → área de la oficina (lo que la página sabe refrescar). */
const AREAS = { tasks: 'tareas', tareas: 'tareas', routines: 'tareas', team: 'tareas', calendar: 'tareas', contenido: 'contenido', anuncios: 'anuncios', media: 'estudio', brain: 'cerebro', note: 'cerebro', agentes: 'agentes', ejecuciones: 'agentes', conectores: 'conectores', equipo: 'equipo', yo: 'equipo' };
const IGNORAR = new Set(['acceso', 'salir', 'live', 'health', 'migrar']);

export function areaDe(ruta) {
  const g = /^\/api\/([a-z0-9-]+)/.exec(ruta)?.[1];
  if (!g || IGNORAR.has(g)) return null;
  return AREAS[g] ?? g;
}

const hub = (env) => (env?.HUB ? env.HUB.get(env.HUB.idFromName('oficina')) : null);
const llamar = (env, camino, cuerpo) => hub(env)?.fetch(new Request('https://hub' + camino, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) })).catch(() => {});

/** Difunde un evento. Sin el binding HUB (pruebas, `wrangler dev` mal configurado) no hace nada. */
export function difundir(env, evento) { try { return llamar(env, '/difundir', evento); } catch { return null; } }

/** Tras una escritura correcta: `cambio` con el área, quién y la PESTAÑA (para que ella no se aplique su propio eco). */
export function avisarCambio(env, { ruta, metodo, estado, usuario, req }) {
  if (!env?.HUB || metodo === 'GET' || metodo === 'HEAD' || estado >= 300) return null;
  const area = areaDe(ruta);
  if (!area) return null;
  return difundir(env, { tipo: 'cambio', area, por: { id: usuario?.id ?? null, nombre: usuario?.nombre ?? '', tab: req?.headers?.get('X-Pestana') ?? null }, at: Date.now() });
}

/** Cierra los sockets de una persona (quitada del equipo, cambió la contraseña…). */
export function cerrarDe(env, userId, motivo = 'sesión cerrada') { try { return llamar(env, '/cerrar', { userId, motivo }); } catch { return null; } }

/** Para los tests y el diagnóstico: a quién ve el objeto ahora. */
export async function estadoDelHub(env) { const h = hub(env); return h ? (await h.fetch(new Request('https://hub/estado'))).json() : null; }
