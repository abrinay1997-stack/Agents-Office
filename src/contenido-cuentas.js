// Agents Office (9 oct 2026) — LA CUENTA de una pieza: en qué página de Facebook y en qué Instagram sale. Pedido del dueño: «cuando voy a
// programar no sé a qué cuenta se programará de todas las que puedo ver». Su token de Meta ve varias páginas y varios Instagram; hasta hoy
// todo salía por la de Ajustes (contenido.metaPagina) y no se veía cuál.
//
// Una pieza lleva `cuentas: { facebook?: 'facebook:<id de página>', instagram?: 'instagram:<id de Instagram>' }` (los ids de
// meta.estado().cuentas). Vacío = lo de siempre: la página de Ajustes y su Instagram. Puro (sin red ni disco), con tests.
//   limpiarCuentas(v)                         → { cuentas } | { error }          (lo que llega de la pantalla o de un agente)
//   cuentasLimpias(v)                         → las válidas, sin quejarse          (lo que se lee de una nota)
//   porDefecto(cuentas, metaPagina)           → { facebook, instagram }          (la de Ajustes, o la primera página con Instagram)
//   motivoNoPublica(cuenta, { conductor, defecto }) → '' | por qué no se puede publicar en ella
//   listaCuentas({ cuentas, metaPagina, conductor }) → lo que da GET /api/contenido/cuentas
export const REDES_CUENTA = ['facebook', 'instagram'];
export const CUENTA_RE = /^(facebook|instagram):[A-Za-z0-9_]{1,40}$/;
export const MOTIVO_METRICOOL = 'Con Metricool se publica en las cuentas de la marca de Metricool; para elegir cuenta usa Meta directo (Ajustes → Contenido).';

/** Lo que llega: { red: id }. Un id vacío quita la elección de esa red (vuelve a la de Ajustes). */
export function limpiarCuentas(v) {
  if (v === null || v === undefined) return { cuentas: {} };
  if (typeof v !== 'object' || Array.isArray(v)) return { error: 'las cuentas van como { "instagram": "instagram:<id>", "facebook": "facebook:<id>" }' };
  const out = {};
  for (const [red, id] of Object.entries(v)) {
    if (!REDES_CUENTA.includes(red)) return { error: `«${red}»: solo se elige cuenta para Instagram y Facebook` };
    if (id === null || id === undefined || id === '') continue;
    const s = String(id).trim();
    if (!CUENTA_RE.test(s) || !s.startsWith(red + ':')) return { error: `«${s}» no es una cuenta de ${red === 'facebook' ? 'Facebook' : 'Instagram'} (va como ${red}:<id>, la que da GET /api/contenido/cuentas)` };
    out[red] = s;
  }
  return { cuentas: out };
}
export const cuentasLimpias = v => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([r, id]) => REDES_CUENTA.includes(r) && CUENTA_RE.test(String(id)) && String(id).startsWith(r + ':'))) : {});
/** Las cuentas de una pieza que cuentan: solo las de sus redes. */
export const cuentasDeRedes = p => Object.fromEntries(Object.entries(cuentasLimpias(p?.cuentas)).filter(([r]) => (p?.redes || []).includes(r)));

/** La página de Ajustes (o la primera con Instagram, o la primera) y su Instagram: lo de siempre, para quien no elige. */
export function porDefectoCuentas(cuentas = [], metaPagina = '') {
  const c = Array.isArray(cuentas) ? cuentas : [], quiero = String(metaPagina || '').trim();
  const fb = c.find(x => x.red === 'facebook' && quiero && (x.paginaId === quiero || x.externoId === quiero)) || c.find(x => x.red === 'facebook' && c.some(y => y.red === 'instagram' && y.paginaId === x.paginaId)) || c.find(x => x.red === 'facebook') || null;
  const ig = fb ? c.find(x => x.red === 'instagram' && x.paginaId === fb.paginaId) || null : null;
  return { fb, ig };
}
export function porDefecto(cuentas = [], metaPagina = '') { const { fb, ig } = porDefectoCuentas(cuentas, metaPagina); return { facebook: fb?.id || '', instagram: ig?.id || '' }; }

const quien = c => (c.usuario ? '@' + c.usuario : c.nombre || c.id);
/** Por qué no se puede publicar en esa cuenta ('' = sí se puede). */
export function motivoNoPublica(c, { conductor = '', defecto = {} } = {}) {
  if (!c) return 'esa cuenta ya no la ve el token de Meta: pulsa «Comprobar conexión» en Analíticas';
  if (c.red === 'instagram' && !c.paginaId) return `${quien(c)} no tiene página de Facebook vinculada: vincúlala para publicar en ella`;
  if (conductor === 'metricool' && defecto[c.red] && c.id !== defecto[c.red]) return MOTIVO_METRICOOL;
  return '';
}

/** GET /api/contenido/cuentas: ligera (lo que ya se sabe de Meta, sin llamarla). */
export function listaCuentas({ cuentas = [], metaPagina = '', conductor = '' } = {}) {
  const defecto = porDefecto(cuentas, metaPagina);
  const lista = (Array.isArray(cuentas) ? cuentas : []).filter(c => REDES_CUENTA.includes(c?.red) && CUENTA_RE.test(String(c.id || ''))).map(c => {
    const motivo = motivoNoPublica(c, { conductor, defecto });
    return { id: c.id, red: c.red, nombre: String(c.nombre || ''), usuario: String(c.usuario || ''), foto: /^https:\/\//.test(c.foto || '') ? c.foto : '', paginaId: String(c.paginaId || ''), puedePublicar: !motivo, ...(motivo ? { motivo } : {}) };
  });
  return { cuentas: lista, porDefecto: defecto, conectada: lista.length > 0, conductor };
}

/** El id con que sale una red de la pieza: la elegida, o la de Ajustes. */
export const cuentaEfectiva = (p, red, defecto = {}) => cuentasLimpias(p?.cuentas)[red] || defecto[red] || '';
/** Cómo se nombra corta una cuenta: @usuario, o el nombre de la página. */
export const nombreCorto = c => (c ? (c.usuario ? '@' + c.usuario : c.nombre || '') : '');
/** La cuenta (de la lista de GET /api/contenido/cuentas) con que sale esa red de la pieza, o null. */
export const cuentaDe = (p, red, info) => { const id = cuentaEfectiva(p, red, info?.porDefecto); return (info?.cuentas || []).find(c => c.id === id) || (id ? { id, red, nombre: id.split(':')[1], usuario: '', foto: '', puedePublicar: false, motivo: 'esa cuenta ya no la ve el token de Meta' } : null); };
/** Corto, para una tarjeta: la de Instagram si sale allí; si no, la de Facebook ('' sin Meta). */
export const cuentaCorta = (p, info) => { if (!info?.cuentas?.length) return ''; for (const r of REDES_CUENTA.slice().reverse()) if ((p?.redes || []).includes(r)) { const c = cuentaDe(p, r, info); if (c) return nombreCorto(c); } return ''; };
/** ¿Sale esa pieza en esa cuenta? (el filtro del calendario) */
export const saleEn = (p, id, info) => { const r = String(id).split(':')[0]; return (p?.redes || []).includes(r) && cuentaEfectiva(p, r, info?.porDefecto) === id; };
