// Agents Office (6 oct 2026, plan M5 · U7) — REPETIR una pieza: «cada lunes», «cada mes»… Crea copias como BORRADORES en los días que
// tocan (nunca aprobadas: cada una se revisa y se aprueba, porque un texto que vale hoy puede no valer en un mes). Puro, con test.
//   fechasRepetidas('2026-10-05', 'semana', 4) → ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']
//   Un «cada mes» el 31 cae el último día de los meses cortos (31 ene → 28 feb → 31 mar), sin rodar al mes siguiente.
export const CADA = { dia: 'Cada día', semana: 'Cada semana', '2semanas': 'Cada 2 semanas', mes: 'Cada mes' };
export const MAX_VECES = 12;
const pad = n => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

export function fechasRepetidas(fecha, cada, veces) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '') || !CADA[cada]) return [];
  const n = Math.max(0, Math.min(MAX_VECES, Math.floor(Number(veces) || 0)));
  const [y, m, d] = fecha.split('-').map(Number), out = [];
  for (let i = 1; i <= n; i++) {
    if (cada === 'mes') { const t = new Date(y, m - 1 + i, 1), ult = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); out.push(ymd(t.getFullYear(), t.getMonth() + 1, Math.min(d, ult))); continue; }
    const paso = cada === 'dia' ? 1 : cada === 'semana' ? 7 : 14, t = new Date(y, m - 1, d + paso * i);
    out.push(ymd(t.getFullYear(), t.getMonth() + 1, t.getDate()));
  }
  return out;
}

/** Lo que se copia de una pieza a sus repeticiones (lo que se publica; no su estado, su OK ni lo entregado). */
export const COPIABLES = ['titulo', 'hora', 'formato', 'redes', 'medios', 'historiaTambien', 'historias', 'texto', 'comentario', 'hashtags', 'hashtagsEnComentario', 'textoFacebook', 'notas', 'textos', 'pinterest', 'youtube', 'tiktok'];
export function copiaDe(p) { const c = {}; for (const k of COPIABLES) if (p[k] !== undefined && p[k] !== null) c[k] = JSON.parse(JSON.stringify(p[k])); return c; }
