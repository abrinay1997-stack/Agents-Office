// La frecuencia de una rutina que se crea o se cambia por MCP: una rutina dispara a un agente (y gasta modelo), así que por este conector corre como mucho UNA vez por hora y un horario nuevo
// nunca puede correr más a menudo que el que ya había. Puro: sin imports.
const hhmm = (h) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || '')); return m && +m[1] <= 23 && +m[2] <= 59 ? +m[1] * 60 + +m[2] : null; };
const hora = (h) => { const v = hhmm(h); return v === null ? null : Math.floor(v / 60); };

/** Cuántas veces corre a la semana (aproximado, solo para COMPARAR). Lo que no se entiende cuenta como «muchas». */
export function porSemana(w = {}) {
  switch (w.kind) {
    case 'daily': return 7;
    case 'weekdays': return 5;
    case 'weekly': return Array.isArray(w.days) ? new Set(w.days).size : 0;
    case 'monthly': return 0.25;
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
    if (!(Number.isInteger(c.every) && c.every >= 1 && c.every <= 24)) return '«hourly» pide `every` (cada cuántas horas, de 1 a 24).';
    const a = hhmm(c.from), b = hhmm(c.to);
    if (a === null || b === null) return '«hourly» pide `from` y `to` (HH:MM, 00:00 a 23:59): la ventana del día en que corre.';
    if (a > b) return '«hourly»: `from` va antes que `to` (la ventana no cruza la medianoche).';
  } else {
    if (hhmm(c.at) === null) return 'el horario pide `at` como HH:MM (00:00 a 23:59).';
    if (c.kind === 'weekly' && !(Array.isArray(c.days) && c.days.length && c.days.length <= 7 && c.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6))) return '«weekly» pide `days`: una lista de 1 a 7 días, cada uno de 0 (domingo) a 6.';
    if (c.kind === 'monthly') {
      const dia = Number.isInteger(c.day) && ((c.day >= 1 && c.day <= 31) || c.day === -1), nth = Number.isInteger(c.nth) && c.nth >= -1 && c.nth !== 0 && c.nth <= 5 && Number.isInteger(c.weekday) && c.weekday >= 0 && c.weekday <= 6;
      if (!dia && !nth) return '«monthly» pide `day` (1 a 31, o -1 el último) o `nth` y `weekday`.';
    }
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
