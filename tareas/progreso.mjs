// Agents Office (6 oct 2026, plan T4) — el progreso de un proyecto, de sus tareas. Puro: lo usan el servidor y la vista Tareas.
import { limiteMs } from './modelo.mjs';
import { visible } from './estados.mjs';

export function progresoProyecto(p, tareas, ahora = Date.now()) {
  const mias = tareas.filter(t => t.proyecto === p.id && !t.archived);
  const porId = new Map(tareas.map(t => [t.id, t]));
  const cuenta = { total: mias.length, hechas: 0, fallidas: 0, enCurso: 0, esperanOk: 0, bloqueadas: 0, vencidas: 0, costo: 0, pasos: 0, pasosHechos: 0 };
  for (const t of mias) {
    const v = visible(t, porId);
    if (v === 'hecha') cuenta.hechas++; else if (v === 'fallida') cuenta.fallidas++; else if (v === 'en_curso') cuenta.enCurso++; else if (v === 'espera_ok') cuenta.esperanOk++; else if (v === 'bloqueada') cuenta.bloqueadas++;
    if (v !== 'hecha' && t.limite && limiteMs(t.limite) < ahora) cuenta.vencidas++;
    cuenta.costo += t.cost || 0;
    for (const s of t.pasos || []) { cuenta.pasos++; if (s.hecho) cuenta.pasosHechos++; }
  }
  cuenta.costo = Math.round(cuenta.costo * 100) / 100;
  cuenta.pct = cuenta.total ? Math.round(100 * cuenta.hechas / cuenta.total) : 0;
  const lim = limiteMs(p.limite);
  const dia0 = ms => { const d = new Date(ms); d.setHours(12, 0, 0, 0); return d.getTime(); }; // días de calendario, no de 24 h
  cuenta.diasRestantes = lim ? Math.round((dia0(lim) - dia0(ahora)) / 864e5) : null;
  cuenta.atrasado = !!(lim && lim < ahora && cuenta.hechas < cuenta.total) || cuenta.vencidas > 0;
  return cuenta;
}
