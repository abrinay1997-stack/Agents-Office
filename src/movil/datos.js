// Versión móvil (25 oct 2026) — la puerta a la oficina y lo que se comparte entre pantallas: `api()` (fetch con la sesión, errores en
// palabras, 401 → recargar para volver a entrar, estado de la conexión) y el `store` (tareas, rutinas y estado de la oficina, que se
// relee solo cada 20 s mientras la pantalla se ve y al volver a ella). Las pantallas lo leen de aquí: así el número de aprobaciones de
// la cabecera y el de Inicio nunca discrepan.
import { visible } from '../../tareas/estados.mjs';

export function crearApi({ alConexion = () => {} } = {}) {
  return async function api(ruta, { method = 'GET', body, signal } = {}) {
    let r;
    try { r = await fetch(ruta, { method, signal, credentials: 'same-origin', headers: body !== undefined ? { 'content-type': 'application/json' } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined }); }
    catch (e) { if (e && e.name === 'AbortError') throw e; alConexion(false); throw new Error('Sin conexión con la oficina. Revisa tu internet y vuelve a intentar.'); }
    alConexion(true);
    if (r.status === 401) { setTimeout(() => location.reload(), 50); throw new Error('Tu sesión terminó: vuelve a entrar.'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || `la oficina respondió ${r.status}`); e.status = r.status; e.datos = j; throw e; }
    return j;
  };
}

/** Lo que espera el visto bueno del dueño: tareas en espera de OK, no archivadas, sin las piezas de un equipo. */
export const esperanOk = tareas => tareas.filter(t => t && !t.archived && !t.piece && visible(t) === 'espera_ok' && !t.approving);

export function crearStore(api, { cada = 20000 } = {}) {
  const st = { tareas: [], rutinas: [], status: null, cargado: false, error: null };
  const subs = new Set(); let pidiendo = null, timer = null, ag = null, mc = null, mcAt = 0;
  const emitir = () => { for (const f of subs) { try { f(st); } catch (e) { console.error(e); } } };
  async function refrescar() {
    if (pidiendo) return pidiendo;
    pidiendo = (async () => {
      const [t, r, s] = await Promise.allSettled([api('/api/tasks?light=1'), api('/api/routines'), api('/api/status')]);
      if (t.status === 'fulfilled') { st.tareas = Array.isArray(t.value) ? t.value : t.value.tasks || []; st.cargado = true; st.error = null; } else st.error = t.reason?.message || 'No se pudo leer la oficina';
      if (r.status === 'fulfilled') st.rutinas = r.value.routines || [];
      if (s.status === 'fulfilled') st.status = s.value;
      emitir();
    })().finally(() => { pidiendo = null; });
    return pidiendo;
  }
  const vivo = () => document.visibilityState !== 'hidden';
  function iniciar() {
    detener(); refrescar();
    timer = setInterval(() => { if (vivo()) refrescar(); }, cada);
    document.addEventListener('visibilitychange', alVolver); addEventListener('online', refrescar);
  }
  const alVolver = () => { if (vivo()) refrescar(); };
  function detener() { clearInterval(timer); timer = null; document.removeEventListener('visibilitychange', alVolver); removeEventListener('online', refrescar); }
  return {
    st, refrescar, iniciar, detener,
    alCambiar(f) { subs.add(f); return () => subs.delete(f); },
    get aprobaciones() { return esperanOk(st.tareas); },
    /** Los conectores (/api/mcp: en la nube, los MCP remotos de la oficina). Se guarda un minuto. */
    async conectores(fresco = false) { if (!fresco && mc && Date.now() - mcAt < 60e3) return mc; mc = await api('/api/mcp'); mcAt = Date.now(); return mc; },
    /** El plantel (id, name, dept, lead): una sola vez; sirve para decir «Ana · Ventas» en vez de un id. */
    agentes() { return (ag ||= api('/api/agents').then(j => j.agents || []).catch(() => { ag = null; return []; })); },
  };
}
