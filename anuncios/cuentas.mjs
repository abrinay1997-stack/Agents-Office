// ============================================================
// Agents Office — Anuncios: SOBRE QUÉ CUENTA corre cada campaña, conjunto y anuncio (2 nov 2026).
//
// Pedido del dueño: el portafolio de Meta tiene UNA cuenta publicitaria compartida por varias páginas de Facebook e Instagram (cuentas de
// marca) y no se sabía de qué cuenta es un anuncio, su gasto ni sus resultados. PURO (sin red ni disco) y de SOLO LECTURA: no cambia
// ningún tope, token ni acción que gasta.
//
// De dónde sale la cuenta de un anuncio, sin llamadas nuevas (todo viene en las lecturas de la A1):
//   · el creativo: `object_story_spec.page_id` + `instagram_user_id` (o el antiguo `instagram_actor_id`), o el prefijo de
//     `effective_object_story_id` («<página>_<post>»);
//   · si el creativo no lo dice, el conjunto: `promoted_object.page_id`.
// Nunca se adivina: un anuncio sin ninguna de esas pistas es «cuenta no identificada». Una página sin Instagram en el creativo NO se
// completa con el Instagram que tenga unido (el anuncio podría salir con la identidad de la página): se dice solo lo que Meta dijo.
// El nombre y el @usuario salen de meta.estado().cuentas (lo que ya sabe la oficina de Meta); un id que esa lista no conoce se enseña
// como «página 123», no se inventa un nombre.
//
// La «cuenta» que se agrupa es la MARCA: la página de Facebook y su Instagram van juntas (un anuncio de Instagram sin página se
// agrupa por la página de ese Instagram si la oficina la conoce). Filtrar por `facebook:<id>` o `instagram:<id>` (los ids de
// GET /api/contenido/cuentas) trae los anuncios de esa marca.
// ============================================================
import { buscarCuenta, nombreCuenta } from '../src/contenido-cifras.js';
import { injectionIn } from '../safety.mjs';

export const SIN_CUENTA = 'cuenta no identificada';
// un id de Meta es un número (el Meta de mentira de los tests usa P1 / IG1: hasta 3 letras delante); cualquier otra cosa no es una pista
const idDe = v => { const t = String(v ?? '').trim(); return /^[A-Za-z]{0,3}\d{1,25}$/.test(t) ? t : ''; };

/** Las pistas de cuenta de un creativo (y, si no dice página, las del conjunto). → { paginaId, instagramId } (cadenas; '' = no se sabe) */
export function refsDeAnuncio(creativo, conjunto) {
  const c = creativo || {}, spec = c.object_story_spec || {};
  const historia = String(c.effective_object_story_id || '').split('_')[0];
  const paginaId = idDe(spec.page_id) || idDe(historia) || idDe(conjunto?.promoted_object?.page_id);
  const instagramId = idDe(spec.instagram_user_id) || idDe(spec.instagram_actor_id) || idDe(c.instagram_user_id) || idDe(c.instagram_actor_id);
  return { paginaId, instagramId };
}

/**
 * Un nombre de página o un @usuario es de un TERCERO y entra a los textos de Dimitri, los agentes y el asistente: sin saltos de línea ni controles,
 * como mucho 80 letras, y si trae órdenes escondidas (safety.injectionIn) no se pasa: se reemplaza por un aviso.
 */
export function textoSeguro(v, max = 80) {
  const t = String(v ?? '').replace(/[\u0000-\u001f\u007f\u2028\u2029\u200b-\u200f\u202a-\u202e\u2066-\u2069]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return t && injectionIn(t) ? '(nombre omitido)' : t;
}
/** La foto de una cuenta: solo https de los hosts de Meta (la nube los reescribe a /api/imagen-meta; la CSP no abre ninguno más). */
export function fotoMeta(u) {
  try { const x = new URL(String(u || '')); return x.protocol === 'https:' && x.href.length <= 600 && ['fbcdn.net', 'cdninstagram.com', 'fbsbx.com'].some(d => x.hostname === d || x.hostname.endsWith('.' + d)) ? x.href : ''; } catch { return ''; }
}
const limpia = c => ({ id: c.id, red: c.red, nombre: textoSeguro(c.nombre), usuario: textoSeguro(c.usuario, 40).replace(/^@/, ''), foto: fotoMeta(c.foto), paginaId: String(c.paginaId || ''), conocida: true });
/** Una cuenta que la oficina no conoce (el token ya no la ve): solo su id, rotulado. */
const desconocida = (red, id) => ({ id: `${red}:${id}`, red, nombre: '', usuario: '', foto: '', paginaId: red === 'facebook' ? id : '', conocida: false });

/** «@usuario» o el nombre; sin eso, «página 123» / «Instagram 456». */
export function etiquetaCuenta(c) {
  if (!c) return '';
  const n = nombreCuenta({ usuario: c.usuario, nombre: c.nombre, id: '' });
  if (n) return n;
  return c.red === 'facebook' ? `página ${c.id.split(':')[1]}` : `Instagram ${c.id.split(':')[1]}`;
}
const REDES = { facebook: 'Facebook', instagram: 'Instagram' };
/** Lo que se lee en una fila: «Facebook «Baby Caleb» + Instagram @babycaleb», o «cuenta no identificada». */
export function textoCuentas(cuentas) {
  const l = Array.isArray(cuentas) ? cuentas : [];
  if (!l.length) return SIN_CUENTA;
  return l.map(c => (c.red === 'instagram' && !c.nombre && !c.usuario ? etiquetaCuenta(c) : `${REDES[c.red] || c.red} ${c.red === 'facebook' && (c.nombre || c.usuario) ? `«${c.nombre || c.usuario}»` : etiquetaCuenta(c)}`)).join(' + ');
}

/**
 * Atribuye un anuncio. `lista` = meta.estado().cuentas. → { cuentas: [{ id, red, nombre, usuario, foto, paginaId, conocida }], clave, texto }
 * `clave` es el id de la marca (el de la página, o `instagram:<id>` si solo se supo el Instagram); null si no se pudo identificar.
 */
export function atribuir(refs, lista = []) {
  const todas = Array.isArray(lista) ? lista : [];
  let { paginaId = '', instagramId = '' } = refs || {};
  const ig = instagramId ? todas.find(c => c.red === 'instagram' && (c.externoId === instagramId || c.id === `instagram:${instagramId}`)) : null;
  if (!paginaId && ig?.paginaId) paginaId = idDe(ig.paginaId);
  const fb = paginaId ? todas.find(c => c.red === 'facebook' && (c.paginaId === paginaId || c.externoId === paginaId || c.id === `facebook:${paginaId}`)) : null;
  const cuentas = [];
  if (paginaId) cuentas.push(fb ? limpia(fb) : desconocida('facebook', paginaId));
  if (instagramId) cuentas.push(ig ? limpia(ig) : desconocida('instagram', instagramId));
  return { cuentas, clave: paginaId || (instagramId ? `instagram:${instagramId}` : null), texto: textoCuentas(cuentas) };
}

/** Une las cuentas de varios objetos (los anuncios de un conjunto…), sin repetir. */
export function unirCuentas(listas) {
  const vistos = new Map();
  for (const l of listas) for (const c of l || []) if (!vistos.has(c.id)) vistos.set(c.id, c);
  return [...vistos.values()]; // en el orden en que salieron: cada marca con su página y su Instagram juntos
}

/** ¿Este objeto de la vista (con `cuentas` y `cuentaClave`) es de la cuenta pedida? `f` = 'todas' · 'sin' · un id 'facebook:<id>'/'instagram:<id>'. */
export function deLaCuenta(o, f) {
  if (!f || f === 'todas') return true;
  if (f === 'sin') return !(o.cuentas || []).length;
  return (o.cuentas || []).some(c => c.id === f);
}

/** Resuelve lo que escribe un agente (id, @usuario o nombre; 'sin' = no identificadas) contra las cuentas de una vista. → { filtro } | { error } */
export function resolverFiltro(vista, q) {
  const t = String(q ?? '').trim();
  if (!t || t.toLowerCase() === 'todas') return { filtro: 'todas' };
  if (/^(sin|sin identificar|no identificada)$/i.test(t)) return { filtro: 'sin' };
  const lista = (vista?.porCuenta || []).flatMap(g => g.cuentas || []);
  const c = buscarCuenta(lista, t) || buscarCuenta(lista, t.replace(/^(facebook|instagram)\s+/i, ''));
  // una cuenta es la MARCA (su página y su Instagram juntos): se filtra por la página, así entran también los anuncios que solo nombran la página
  if (c) return { filtro: c.paginaId ? `facebook:${c.paginaId}` : c.id };
  const nombres = [...new Set(lista.map(x => etiquetaCuenta(x)))].slice(0, 12);
  return { error: `No encuentro la cuenta «${t.slice(0, 60)}» entre las que tienen anuncios${nombres.length ? ` (${nombres.join(', ')})` : ''}.` };
}

/**
 * Deja en la vista solo lo de una cuenta: sus anuncios, y los conjuntos y campañas que los llevan. Las cifras de una campaña o un
 * conjunto que se queda NO se recalculan (son de la campaña entera): si perdió algún anuncio, queda `parcial: true` para decirlo.
 * `porCuenta` (el reparto de la cuenta publicitaria) y el gasto de la cuenta se conservan enteros. `cuentaFiltro` dice qué se pidió.
 */
export function filtrarVista(vista, f) {
  if (!vista || !f || f === 'todas') return vista;
  const campanas = [];
  for (const c of vista.campanas || []) {
    const conjuntos = [];
    for (const s of c.conjuntos || []) {
      const anuncios = (s.anuncios || []).filter(a => deLaCuenta(a, f));
      if (!anuncios.length) continue;
      conjuntos.push({ ...s, anuncios, ...(anuncios.length < (s.anuncios || []).length ? { parcial: true } : {}) });
    }
    if (!conjuntos.length) continue;
    campanas.push({ ...c, conjuntos, ...(conjuntos.some(s => s.parcial) || conjuntos.length < (c.conjuntos || []).length ? { parcial: true } : {}) });
  }
  return { ...vista, campanas, cuentaFiltro: f };
}

/** El reparto del gasto y los resultados por cuenta, en una línea cada uno, para los textos de Dimitri, los agentes y el asistente. */
export function textoPorCuenta(vista, usd) {
  const g = vista?.porCuenta || [];
  if (!g.length) return '';
  const m = vista?.cuenta?.moneda || 'USD';
  const out = [`Anuncios por cuenta (la cuenta publicitaria es una sola; cada anuncio sale en una página/Instagram; un anuncio que sale en página e Instagram cuenta una vez, en su marca):`];
  for (const x of g) {
    const c = x.cifras;
    out.push(`- ${x.texto}${x.clave ? '' : ' (no se pudo saber de qué página es: no se adivina)'} · ${x.anuncios} anuncio${x.anuncios === 1 ? '' : 's'} · ${x.gasto === null ? 'sin cifras' : `gastó ${usd(x.gasto, m)}`}${c && c.resultados !== null ? ` · ${Math.round(c.resultados)} ${c.resultadoTexto}${c.costoPorResultado !== null ? ` a ${usd(c.costoPorResultado, m)}` : ''}${x.otrosObjetivos ? ' (solo del objetivo con más gasto; tiene más objetivos)' : ''}` : ''}`);
  }
  return out.join('\n');
}
