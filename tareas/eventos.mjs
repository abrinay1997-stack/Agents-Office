// Agents Office (6 oct 2026, plan T0 · §5.D) — el BUS de eventos de las tareas. El almacén (almacen.mjs) emite cada cambio después de
// guardarlo; cada efecto (desbloquear dependencias, avisar de una fecha límite, un webhook, Telegram…) es un despachador aparte que
// escucha aquí, con sus errores aislados: uno que falla no tumba a los demás ni al guardado.
//   tarea.creada  { tarea, por }
//   tarea.estado  { tarea, de, a, por }            (de/a = el estado guardado; a 'done:error' cuando falló)
//   tarea.cambio  { tarea, antes, cambios, por }   (cambios = las líneas de la bitácora de ese guardado)
//   tarea.borrada { tarea, por }
// `por` dice quién: 'dueno', 'persona:<nombre>', 'agente:<id>', 'dimitri', 'rutina', 'disparador', 'telegram', 'oficina'.

export function crearBus({ registrar = (tipo, e) => console.warn(`eventos: ${tipo}:`, e.message) } = {}) {
  const oyentes = new Map();
  const on = (tipo, fn) => { if (!oyentes.has(tipo)) oyentes.set(tipo, []); oyentes.get(tipo).push(fn); return () => { const l = oyentes.get(tipo); const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }; };
  function emit(tipo, datos) {
    for (const fn of [...(oyentes.get(tipo) || []), ...(oyentes.get('*') || [])]) {
      try { const r = fn(datos, tipo); if (r && typeof r.catch === 'function') r.catch(e => registrar(tipo, e)); } catch (e) { registrar(tipo, e); }
    }
  }
  return { on, emit, cuantos: tipo => (oyentes.get(tipo) || []).length };
}
