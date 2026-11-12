// La frecuencia de una rutina que se crea o se cambia por MCP: una rutina dispara a un agente (y gasta modelo), así que por este conector corre como mucho UNA vez por hora y un horario nuevo
// nunca puede correr más a menudo que el que ya había. Puro: sin imports.
const FORMA = /^\d{1,2}:\d{2}$/;
const hora = (h) => (FORMA.test(String(h || '')) ? parseInt(String(h).split(':')[0], 10) : null);

/** Cuántas veces corre a la semana (aproximado, solo para COMPARAR). Lo que no se entiende cuenta como «muchas». */
export function porSemana(w = {}) {
  switch (w.kind) {
    case 'daily': return 7;
    case 'weekdays': return 5;
    case 'weekly': return Array.isArray(w.days) ? new Set(w.days).size : 0;
    case 'monthly': return 1;
    case 'hourly': { const a = hora(w.from), b = hora(w.to), horas = a !== null && b !== null ? Math.max(1, b - a + 1) : 24; return Math.ceil(horas / Math.max(1, +w.every || 1)) * (w.weekdaysOnly ? 5 : 7); }
    case 'minutes': return 10080 / Math.max(1, +w.every || 1);
    default: return Infinity;
  }
}

/** Lo que este conector admite como horario → null si vale, o el motivo. `cambio`: true cuando es el horario de una rutina que ya existe (sin start/end/count). */
export function revisarCuando(c, { cambio = false } = {}) {
  if (!c || typeof c !== 'object') return 'falta el horario (`cuando`).';
  if (c.kind === 'minutes') return 'por este conector una rutina corre como mucho una vez por hora: «minutes» no se admite.';
  if (c.kind === 'hourly') {
    if (!(Number.isInteger(c.every) && c.every >= 1)) return '«hourly» pide `every` (cada cuántas horas, 1 o más).';
    if (hora(c.from) === null || hora(c.to) === null) return '«hourly» pide `from` y `to` (HH:MM): la ventana del día en que corre.';
  }
  if (cambio && (c.start !== undefined || c.end !== undefined || c.count !== undefined)) return 'al cambiar el horario de una rutina que existe no se tocan start, end ni count: se conservan los que tenía.';
  return null;
}

/** El horario nuevo de una rutina existente: conserva su `end` y su `count`. → { when } o { error }. */
export function horarioNuevo(viejo, nuevo) {
  const e = revisarCuando(nuevo, { cambio: true }); if (e) return { error: e };
  const when = { ...nuevo, ...(viejo?.end ? { end: viejo.end } : {}), ...(viejo?.count ? { count: viejo.count } : {}) };
  if (porSemana(when) > porSemana(viejo || {})) return { error: 'ese horario correría más a menudo que el actual: por este conector un horario nunca aumenta la frecuencia (eso lo decide el dueño en la oficina).' };
  return { when };
}
