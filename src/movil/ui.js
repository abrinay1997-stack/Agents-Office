// Versión móvil (25 oct 2026) — piezas pequeñas de interfaz que comparten todas las pantallas: escapar, iconos, estados vacíos,
// esqueletos de carga y utilidades de fecha. Nada de hover: todo se hace con el dedo.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// iconos de trazo (rejilla de 24, 1,8 de grosor): heredan el color del texto
const P = {
  inicio: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10.5V19h4.5v-5h3v5H18v-8.5"/>',
  tareas: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8.5 12.3 2.5 2.5 4.6-5.3"/>',
  calendario: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  dimitri: '<path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V16A2.5 2.5 0 0 1 5 13.5z"/><path d="M9 9.5h6M9 12.5h3.5"/>',
  mas: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
  atras: '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>', cerrar: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>', der: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>', izq: '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
  mas1: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5.5 12.5 4.2 4.2 8.8-9.4"/>', alerta: '<path d="M12 4.5 3.8 19h16.4z"/><path d="M12 10v4M12 16.8v.2"/>',
  enviar: '<path d="M5 12 19 5l-4 14-3.5-5.5z"/>', reloj: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>', historial: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4.5 5v4h4M12 8v4.2l2.8 1.6"/>',
  buscar: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>', cerebro: '<path d="M9 5a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.3A3.2 3.2 0 0 0 8 18.5a2.5 2.5 0 0 0 4-.7V6.5A2.3 2.3 0 0 0 9 5z"/><path d="M15 5a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.3 3.2 3.2 0 0 1-3.5 5.2 2.5 2.5 0 0 1-4-.7"/>',
  estudio: '<rect x="3.5" y="9" width="17" height="10.5" rx="2"/><path d="m3.8 9 15.4-4.2M8 7.8l2 3M13 6.4l2 3"/>', contenido: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 9.5h16M4 14.5h16M9.5 4v16M14.5 4v16"/>',
  analiticas: '<path d="M5 19.5V11M10 19.5V5.5M15 19.5v-6M20 19.5V9"/>', anuncios: '<path d="M4.5 10.5v3l11 4.5V6z"/><path d="M7 14l1.2 4.5h2.3L9.8 15.5M18.5 9.5v5"/>', negocio: '<rect x="3.5" y="8" width="17" height="11.5" rx="2.5"/><path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M3.5 13h17"/>',
  costos: '<circle cx="12" cy="12" r="8"/><path d="M14.5 9.2c-.4-.8-1.4-1.2-2.5-1.2-1.4 0-2.5.8-2.5 1.9 0 2.6 5 1.2 5 3.8 0 1.2-1.2 2-2.5 2-1.2 0-2.2-.5-2.6-1.4M12 6.5V8m0 8v1.5"/>',
  conectores: '<path d="M8.5 7V4M15.5 7V4M6 7h12v4a6 6 0 0 1-12 0zM12 17v3.5"/>', ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 3.8v2.4M12 17.8v2.4M3.8 12h2.4M17.8 12h2.4M6.2 6.2l1.7 1.7M16.1 16.1l1.7 1.7M17.8 6.2l-1.7 1.7M7.9 16.1l-1.7 1.7"/>',
  estado: '<path d="M3.5 12h4l2.5-6 4 12 2.5-6h4"/>', tema: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>', escritorio: '<rect x="3.5" y="5" width="17" height="11" rx="2"/><path d="M9 20h6M12 16v4"/>',
  salir: '<path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10M14 8l4 4-4 4M18 12H9"/>',
  flecha: '<path d="M12 5v14M6 13l6 6 6-6"/>', pos: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>', mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/>',
  nube: '<path d="M7 18.5a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.3A3.5 3.5 0 0 1 17 18.5z"/>', refrescar: '<path d="M19 12a7 7 0 1 1-2-5M19 4.5v4h-4"/>', borrar: '<path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12h8.4L17 7"/>', persona: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
};
export const svg = (n, cls = '') => `<svg class="mv-i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[n] || ''}</svg>`;
export const ICONOS = Object.keys(P);

/** Estado vacío: un título, una explicación y, si hay, el botón que lo resuelve. */
export const vacio = (titulo, texto, { icono = 'check', boton = '', accion = '' } = {}) =>
  `<div class="mv-vacio" role="status">${svg(icono, 'mv-vacio-i')}<h3>${esc(titulo)}</h3><p>${esc(texto)}</p>${boton ? `<button type="button" class="mv-btn" ${accion}>${esc(boton)}</button>` : ''}</div>`;
/** Esqueleto de carga: n filas grises que respiran (sin animación con «reducir movimiento»). */
export const esqueleto = (n = 4) => `<div class="mv-esq" aria-hidden="true">${'<i></i>'.repeat(n)}</div><span class="mv-sr" role="status">Cargando…</span>`;
/** Un mensaje de error con su «Reintentar». */
export const falla = (msg, accion = 'data-reintentar') => `<div class="mv-vacio" role="alert">${svg('alerta', 'mv-vacio-i')}<h3>No se pudo cargar</h3><p>${esc(msg)}</p><button type="button" class="mv-btn" ${accion}>Reintentar</button></div>`;

export function html(s) { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; }
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const corto = (ms) => { const d = new Date(ms); return `${DIAS[d.getDay()]} ${d.getDate()} ${MES[d.getMonth()]}`; };
export const hora = ms => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
/** «hace 5 min» / «hace 3 h» / «hace 2 días» */
export function hace(ms, ahora = Date.now()) { const d = ahora - ms; return d < 90e3 ? 'hace un momento' : d < 3600e3 ? `hace ${Math.round(d / 60e3)} min` : d < 864e5 ? `hace ${Math.round(d / 3600e3)} h` : `hace ${Math.round(d / 864e5)} días`; }
/** Mide un texto de fecha límite de tarea ('2026-10-27' o con hora) → «mañana», «vie 30 oct», «vencida · lun 26 oct» */
export function limiteTexto(lim, ahora = Date.now()) {
  if (!lim) return ''; const s = String(lim), ms = new Date(s.length > 10 ? s : s + 'T23:59').getTime(); if (!Number.isFinite(ms)) return '';
  const hoy = ymd(new Date(ahora)), d = s.slice(0, 10), conHora = s.length > 10;
  const base = d === hoy ? 'hoy' : d === ymd(new Date(ahora + 864e5)) ? 'mañana' : corto(ms);
  return (ms < ahora ? 'vencida · ' : '') + base + (conHora ? ' ' + hora(ms) : '');
}
