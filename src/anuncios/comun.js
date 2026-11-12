// Lo común de la vista ANUNCIOS (Fase A1): escapar, los formatos (dinero SIEMPRE con la moneda de la cuenta, %, cifras, fechas, «hace X»),
// el tono de cada estado y del aprendizaje, y los iconos. Puro: lo usan la vista y tests/anuncios-vista.test.mjs.
// Una cifra que no se sabe (null) se escribe «—», nunca 0.
import { textoCuentas } from '../../anuncios/cuentas.mjs';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nulo = v => v == null || v === '' || (typeof v === 'number' && !Number.isFinite(v)) || (typeof v === 'string' && !Number.isFinite(Number(v)));
const nro = v => (nulo(v) ? null : Number(v));
export const SIN = '—';

/** 12.4, 'USD' → «12,40 US$». null → «—». La moneda va siempre: la de la cuenta. */
export function dinero(v, moneda = 'USD', { decimales } = {}) {
  const n = nro(v); if (n == null) return SIN;
  const cur = String(moneda || 'USD').toUpperCase(), d = decimales ?? (Math.abs(n) >= 1000 ? 0 : 2);
  try { return new Intl.NumberFormat('es', { style: 'currency', currency: cur, minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return `${n.toLocaleString('es', { minimumFractionDigits: d, maximumFractionDigits: d })} ${cur}`; }
}
/** 1.234 (ya en %, como lo da Meta) → «1,23 %» */
export function pct(v, dec = 2) { const n = nro(v); return n == null ? SIN : `${n.toLocaleString('es', { minimumFractionDigits: dec, maximumFractionDigits: dec })} %`; }
export function num(v) { const n = nro(v); return n == null ? SIN : n.toLocaleString('es', { maximumFractionDigits: 0 }); }
export function frec(v) { const n = nro(v); return n == null ? SIN : n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
/** Gasto contra un tope: → { pct (0..), texto, tono } o null sin tope */
export function contraTope(gastado, tope) {
  const g = nro(gastado), t = nro(tope);
  if (t == null || t <= 0) return null;
  if (g == null) return { pct: null, tono: 'gris' };
  const p = g / t * 100; return { pct: p, tono: p >= 100 ? 'rojo' : p >= 90 ? 'ambar' : 'verde' };
}
/** La tendencia en % contra el periodo anterior (12 = sube un 12 %). null → «sin con qué comparar». */
export function tendencia(v, mejorSube = true, motivo = null) {
  const n = nro(v);
  if (n == null) return { texto: motivo || 'sin con qué comparar', tono: 'gris', flecha: '' };
  if (Math.abs(n) < 0.05) return { texto: 'igual que antes', tono: 'gris', flecha: '=' };
  const sube = n > 0, bien = sube === mejorSube;
  return { texto: `${sube ? 'sube' : 'baja'} ${Math.abs(n).toLocaleString('es', { maximumFractionDigits: 1 })} %`, tono: bien ? 'verde' : 'rojo', flecha: sube ? '▲' : '▼' };
}
export function tendenciaHTML(v, mejorSube = true, motivo = null) {
  const t = tendencia(v, mejorSube, motivo);
  return `<span class="anu-tend t-${t.tono}">${t.flecha ? `<span aria-hidden="true">${t.flecha}</span> ` : ''}${esc(t.texto)}</span>`;
}
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** '2026-10-20' o ISO → «20 oct» (o «20 oct 2027» si no es de este año). null → `vacio`. */
export function fechaCorta(v, vacio = SIN, ahora = Date.now()) {
  if (!v) return vacio;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v)); const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v);
  if (Number.isNaN(d.getTime())) return vacio;
  return `${d.getDate()} ${MES[d.getMonth()]}${d.getFullYear() !== new Date(ahora).getFullYear() ? ' ' + d.getFullYear() : ''}`;
}
/**
 * Qué días cubre el rango que se está mirando, en palabras (auditoría 1 nov 2026: «7 días» no se podía reconciliar con Meta).
 * Hoy = el día de hoy; 7 días = hoy y los 6 anteriores; 30 días = hoy y los 29 anteriores; Este mes = del día 1 a hoy. Los días van
 * completos en la hora de la cuenta publicitaria (no en la tuya) y el de hoy a medias. `d` es GET /api/anuncios (desde, hasta, cuenta.zona).
 * → «Del 25 oct al 1 nov (7 días, hoy incluido a medias) · hora de America/Panama» o '' si no se sabe.
 */
export function rangoTexto(d, rango = d?.rango) {
  if (!d?.desde || !d?.hasta) return '';
  const a = fechaCorta(d.desde, '', Date.parse(`${d.hasta}T12:00:00`)), b = fechaCorta(d.hasta, '', Date.parse(`${d.hasta}T12:00:00`));
  const fechas = d.desde === d.hasta ? `Hoy, ${b}` : `Del ${a} al ${b}`;
  const que = { hoy: 'solo hoy', '7d': '7 días: hoy y los 6 anteriores', '30d': '30 días: hoy y los 29 anteriores', mes: 'del día 1 del mes a hoy' }[rango] || '';
  return `${fechas}${que ? ` (${que}; hoy va a medias)` : ''} · hora de ${d?.cuenta?.zona || 'la cuenta publicitaria'}`;
}
export const leyendaRango = d => { const t = rangoTexto(d); return t ? `<p class="anu-ayuda anu-rango" data-rango-texto>${esc(t)}</p>` : ''; };
/** → «hace un momento», «hace 5 min», «hace 2 h», «hace 3 días» */
export function haceCuanto(at, ahora = Date.now()) {
  const t = typeof at === 'number' ? at : Date.parse(at); if (!at || Number.isNaN(t)) return null;
  const s = Math.max(0, (ahora - t) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400); return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

/* ---------- estados (los efectivos de Meta) en palabras y con su tono ---------- */
const ESTADO = {
  ACTIVE: ['Activa', 'verde'], PAUSED: ['En pausa', 'gris'], CAMPAIGN_PAUSED: ['En pausa (su campaña)', 'gris'], ADSET_PAUSED: ['En pausa (su conjunto)', 'gris'],
  DISAPPROVED: ['Rechazado', 'rojo'], WITH_ISSUES: ['Con problemas', 'rojo'], PENDING_REVIEW: ['En revisión', 'ambar'], IN_PROCESS: ['Procesando', 'ambar'],
  PENDING_BILLING_INFO: ['Falta el pago', 'rojo'], PREAPPROVED: ['Aprobado, sin empezar', 'ambar'], ARCHIVED: ['Archivada', 'gris'], DELETED: ['Borrada', 'gris'], COMPLETED: ['Terminada', 'gris'],
};
export function estadoDe(nodo = {}) {
  const k = String(nodo.estado || '').toUpperCase(), [def, tono] = ESTADO[k] || [k ? k.toLowerCase().replace(/_/g, ' ') : 'sin estado', 'gris'];
  return { texto: nodo.estadoTexto || def, tono, clave: k };
}
export const esActiva = n => String(n?.estado || '').toUpperCase() === 'ACTIVE';
export const esPausada = n => /PAUSED/.test(String(n?.estado || '').toUpperCase());
const MAL = /^(DISAPPROVED|WITH_ISSUES|PENDING_BILLING_INFO)$/;
/** ¿Este nodo (o algo debajo) pide atención? Un rechazo, problemas, revisión con motivo. */
export function tieneProblemas(n) {
  if (!n) return false;
  if (MAL.test(String(n.estado || '').toUpperCase()) || (n.problemas || []).length || (n.revision || []).length || n.aprendizaje?.estado === 'FAIL') return true;
  return (n.conjuntos || []).some(tieneProblemas) || (n.anuncios || []).some(tieneProblemas);
}
const APRENDE = { LEARNING: ['Aprendiendo', 'ambar'], SUCCESS: ['Fuera del aprendizaje', 'verde'], FAIL: ['Aprendizaje limitado', 'rojo'] };
export function aprendizajeDe(a) {
  if (!a || !a.estado) return { texto: a?.texto || SIN, tono: 'gris' };
  const [def, tono] = APRENDE[a.estado] || [a.estado, 'gris'];
  const extra = a.estado === 'LEARNING' && a.conversiones != null && !a.texto ? ` (${a.conversiones} de 50)` : '';
  return { texto: (a.texto || def) + extra, tono };
}
export const chip = (texto, tono = 'gris') => `<span class="anu-chip t-${tono}">${esc(texto)}</span>`;
/**
 * 2 nov 2026: LA CUENTA de un objeto (página de Facebook + su Instagram) como chip legible: «Facebook «X» + Instagram @y». Sin pista,
 * «cuenta no identificada» (nunca se adivina). Las fotos de las cuentas no se pintan aquí: la fila ya es densa y lleva el nombre.
 */
export function cuentaChip(n) {
  const l = n?.cuentas || [];
  if (!l.length && !n?.cuentaTexto) return '';
  return `<span class="anu-chip anu-cta t-${l.length ? 'azul' : 'gris'}" data-cuenta-chip title="La cuenta (página e Instagram) sobre la que corre">${esc(n.cuentaTexto || textoCuentas(l))}</span>`;
}
/** Las opciones del filtro «Cuenta»: Todas, cada marca con anuncios (con cuántos) y «cuenta no identificada» si la hay. */
export function opcionesCuenta(d) {
  const g = d?.porCuenta || [], out = [['todas', 'Todas las cuentas']];
  for (const x of g) { const c = (x.cuentas || [])[0]; out.push([x.clave ? (c?.id || 'facebook:' + x.clave) : 'sin', `${x.texto} (${x.anuncios})`]); }
  return out;
}
export function selectorCuentaHTML(d, actual = 'todas') {
  const o = opcionesCuenta(d); if (o.length < 3) return ''; // con una sola cuenta no hay nada que filtrar
  return `<label class="anu-sel"><span>Cuenta</span><select data-cuenta>${o.map(([k, n]) => `<option value="${esc(k)}"${k === actual ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
}
/** El reparto del gasto y los resultados por cuenta (la cuenta publicitaria es una sola: aquí se ve de cuál página es cada anuncio). */
export function porCuentaHTML(d, { cuenta = 'todas' } = {}) {
  const g = d?.porCuenta || [], m = d?.cuenta?.moneda || 'USD';
  if (!g.length || (g.length === 1 && g[0].clave && !(g[0].cuentas || []).length)) return '';
  return `<section class="anu-sec" aria-labelledby="anuPcT" data-por-cuenta><h2 id="anuPcT">Por cuenta</h2>
    <p class="anu-ayuda">La cuenta publicitaria es una sola; cada anuncio sale en una página y su Instagram. Un anuncio cuenta una vez, en su marca.</p>
    <ul class="anu-tarjs">${g.map(x => { const c = x.cifras || {}, id = x.clave ? (x.cuentas?.[0]?.id || 'facebook:' + x.clave) : 'sin';
      return `<li class="anu-tarj" data-pc="${esc(id)}"><h3><button type="button" class="anu-abrir" data-vercuenta="${esc(id)}"${cuenta === id ? ' aria-current="true"' : ''}>${esc(x.texto)}</button></h3>
      <p class="anu-tobj">${x.anuncios} anuncio${x.anuncios === 1 ? '' : 's'} · ${x.campanas} campaña${x.campanas === 1 ? '' : 's'}${x.clave ? '' : ' · no se pudo saber de qué página son'}</p>
      <dl class="anu-tcif"><div><dt>Gasto</dt><dd>${esc(dinero(x.gasto, m))}</dd></div><div><dt>Resultados</dt><dd>${esc(resultados(c))}${x.otrosObjetivos ? ' *' : ''}</dd></div><div><dt>Costo por resultado</dt><dd>${esc(dinero(c.costoPorResultado, m))}</dd></div></dl>
      ${x.otrosObjetivos ? '<p class="anu-ayuda">* Solo del objetivo con más gasto: esta cuenta tiene campañas de más de un tipo.</p>' : ''}</li>`; }).join('')}</ul></section>`;
}
/** «12 conversaciones» con el nombre del resultado; sin datos, «—». */
export function resultados(c = {}) { const n = nro(c.resultados); if (n == null) return SIN; return c.resultadoTexto ? `${num(n)} ${c.resultadoTexto}` : num(n); }
export function presupuesto(p, moneda) {
  if (!p || p.usd == null || !p.tipo) return SIN;
  return `${dinero(p.usd, moneda)} ${p.tipo === 'diario' ? 'al día' : 'en total'}`;
}

const P = {
  resumen: '<path d="M3 13h4v7H3zM10 8h4v12h-4zM17 4h4v16h-4z"/>', campanas: '<path d="M4 6h16M4 12h16M4 18h10"/>', historial: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  borradores: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  metodo: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>', competencia: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6"/><path d="M8 12v-1.5M10.5 12V8.5M13 12v-2.5"/>',
  sugerencias: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>', creativos: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', recargar: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>', mas: '<path d="m9 6 6 6-6 6"/>', menos: '<path d="m6 9 6 6 6-6"/>',
};
export const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${P[k] || ''}</svg>`;
