// Agents Office (6 oct 2026, plan T6) — el CRONÓMETRO de las personas: cuánto tiempo le dedicaron a una tarea (los agentes ya miden el
// suyo solos). Uno activo por persona: empezar otro para el anterior. Puro, con test.
//   t.cronometro = [{ quien, inicio, fin? }]
export const activo = (tareas, quien) => { for (const t of tareas) { const x = (t.cronometro || []).find(c => c.quien === quien && !c.fin); if (x) return { tarea: t, desde: x.inicio }; } return null; };

// → { paradas: [ids] } — modifica las tareas que recibe (las de la lista que luego se guarda)
export function iniciar(tareas, id, quien, ahora = Date.now()) {
  const t = tareas.find(x => x.id === id); if (!t) return { error: 'esa tarea ya no existe' };
  if (t.state === 'done') return { error: 'ya está hecha' };
  const paradas = [];
  for (const x of tareas) for (const c of x.cronometro || []) if (c.quien === quien && !c.fin) { c.fin = ahora; paradas.push(x.id); }
  (t.cronometro ||= []).push({ quien, inicio: ahora });
  if (t.cronometro.length > 200) t.cronometro.splice(0, t.cronometro.length - 200);
  return { paradas: paradas.filter(x => x !== id) };
}
export function parar(t, quien, ahora = Date.now()) { let n = 0; for (const c of t?.cronometro || []) if (c.quien === quien && !c.fin) { c.fin = ahora; n++; } return n; }
export const total = (t, ahora = Date.now(), quien = null) => (t?.cronometro || []).filter(c => !quien || c.quien === quien).reduce((s, c) => s + Math.max(0, (c.fin || ahora) - c.inicio), 0);
export const textoDuracion = ms => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };
