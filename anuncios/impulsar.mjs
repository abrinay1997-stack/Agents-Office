// ============================================================
// Agents Office — Anuncios de Meta, Fase A4 (9 oct 2026): IMPULSAR lo que ya salió en Contenido. docs/plan-meta-anuncios-y-bandeja-2026-10-09.md
// §5 (A4), §7 regla 9. Crea un BORRADOR de campaña cuyo creativo es la publicación misma (anuncios/modelo.mjs → `origen`); nada toca Meta
// hasta que el dueño pulse «Crear en Meta (en pausa)», y activarla es la acción de gasto de la A2 (dos clics, topes).
//
//   POST /api/anuncios/impulsar { pieza?: <id de la pieza de Contenido>, red?: 'instagram'|'facebook', id?: <id de Meta, o el de Analíticas> }
//     → 200 { borrador, ya?: true }   (ya: había un borrador sin crear de esa misma publicación: se devuelve ese, no se hace otro)
//     · 400 (falta qué impulsar, otra red) · 404 (esa pieza o publicación no está) · 409 (la pieza no salió, o salió y aún no se sabe su id)
//     · 403 (quién) · 429 (un agente con demasiados borradores)
//   Quién: el dueño, Dimitri y el asistente (nace borrador; el dueño y Dimitri lo ven ya revisado con Meta si está conectada) y un agente
//   (`por: 'agente'`, con su `agente`): también solo borrador, de: 'agente:<id>'.
//
// DE DÓNDE SALEN LOS IDS (lo que llega de la página nunca se cree: solo se usan sus ids para buscar):
//   1. de la pieza: lo que Analíticas leyó de Meta emparejado con ella (src/contenido-publicadas.js → emparejar: por el enlace o por la red,
//      la hora y el texto), con su texto, su miniatura y su enlace;
//   2. si Analíticas todavía no la leyó: el id que la cola apuntó al publicar (programador.salidaDe → redes[red].id; contenido/meta-publicar.mjs);
//   3. sin pieza: la publicación de Analíticas por su id (el de la oficina `cuenta|externo`, o el de Meta), o —con la red— el id de Meta tal cual.
// ============================================================
import { REDES_IMPULSAR, ErrorBorrador } from './modelo.mjs';
import { quienDe } from './acciones.mjs';

const DIA = 864e5;
export const DIAS_IMPULSO = 7, USD_IMPULSO = 5; // plan §5 A4: presupuesto pequeño, 7 días
const R = (status, cuerpo) => ({ status, cuerpo });
const no = (status, motivo) => R(status, { error: motivo, motivo });
const redBase = r => String(r || '').split('·')[0];
const externoDe = pub => String(pub?.externoId || String(pub?.id || '').split('|').pop() || '');
const textoEn = (p, red) => String(p?.textos?.[red] || (red === 'facebook' && p?.textoFacebook) || p?.texto || '');

/** Una publicación de Analíticas → el `origen` del borrador. */
export function origenDePublicacion(pub, { pieza = null } = {}) {
  return { tipo: 'publicacion', red: pub.red, id: externoDe(pub), ref: pub.id || null, enlace: pub.enlace || '', texto: pub.texto || '', miniatura: pub.miniatura || '', publicadaAt: pub.publicadaAt || null, ...(pieza ? { pieza } : {}) };
}

/**
 * Qué publicación se impulsa. Puro.
 * @param {object} pedido { pieza, red, id }
 * @param {object} o { leerPieza(id) → pieza|null, salidaDe(id) → salida|null, publicaciones: [] (Analíticas), emparejar }
 * → { origen } | { status, motivo }
 */
export function resolverOrigen({ pieza: piezaId = null, red = null, id = null } = {}, { leerPieza = () => null, salidaDe = () => null, publicaciones = [], emparejar = null } = {}) {
  const r = red ? String(red).toLowerCase() : null;
  if (r && !REDES_IMPULSAR.includes(r)) return { status: 400, motivo: 'Solo se impulsan publicaciones de Instagram o de Facebook.' };
  const pubs = (publicaciones || []).filter(p => REDES_IMPULSAR.includes(p?.red) && (!r || p.red === r));
  if (piezaId) {
    const p = leerPieza(String(piezaId)); if (!p) return { status: 404, motivo: 'Esa pieza de Contenido no existe (¿se borró?).' };
    const salida = salidaDe(p.id);
    const res = emparejar && pubs.length ? (emparejar([{ ...p, salida }], pubs).porPieza[p.id] || []) : [];
    const halladas = res.map(x => pubs.find(q => q.id === x.id)).filter(Boolean).sort((a, b) => (REDES_IMPULSAR.indexOf(a.red) - REDES_IMPULSAR.indexOf(b.red)) || (+b.interacciones || 0) - (+a.interacciones || 0));
    if (halladas.length) return { origen: origenDePublicacion(halladas[0], { pieza: p.id }) };
    // Analíticas todavía no la leyó: el id que la cola apuntó al publicar
    const redes = Object.entries(salida?.redes || {}).filter(([k, x]) => !k.includes('·') && REDES_IMPULSAR.includes(redBase(k)) && (!r || redBase(k) === r) && x?.estado === 'publicada');
    redes.sort(([a], [b]) => REDES_IMPULSAR.indexOf(a) - REDES_IMPULSAR.indexOf(b));
    const conId = redes.find(([, x]) => /^[A-Za-z0-9]{1,30}(_[A-Za-z0-9]{1,30})?$/.test(String(x.id || '')));
    if (conId) {
      const [k, x] = conId, m = (p.medios || [])[0];
      return { origen: { tipo: 'publicacion', red: k, id: String(x.id), enlace: x.url || '', texto: textoEn(p, k), miniatura: m && !/\.(mp4|mov|webm)$/i.test(m) ? '/media/' + String(m).split('/').map(encodeURIComponent).join('/') : '', publicadaAt: salida?.entregadaAt ? new Date(salida.entregadaAt).toISOString() : null, pieza: p.id } };
    }
    if (redes.length || ['publicada', 'parcial'].includes(salida?.estado)) return { status: 409, motivo: 'Esa pieza ya salió, pero todavía no sé su id en Meta: espera a la próxima lectura de Analíticas (o pulsa «Actualizar» en Analíticas) y vuelve a intentarlo.' };
    return { status: 409, motivo: `Esa pieza todavía no salió${r ? ` en ${r === 'instagram' ? 'Instagram' : 'Facebook'}` : ' en Instagram ni en Facebook'}: solo se impulsa lo ya publicado.` };
  }
  const q = String(id || '').trim();
  if (!q) return { status: 400, motivo: 'Di qué publicación impulsar: la pieza de Contenido (pieza) o la publicación (id).' };
  const pub = pubs.find(p => p.id === q || externoDe(p) === q);
  if (pub) return { origen: origenDePublicacion(pub) };
  if (r && /^[A-Za-z0-9]{1,30}(_[A-Za-z0-9]{1,30})?$/.test(q)) return { origen: { tipo: 'publicacion', red: r, id: q, enlace: '', texto: '', miniatura: '', publicadaAt: null } };
  return { status: 404, motivo: 'No encuentro esa publicación en lo que Analíticas leyó de Meta (con la red y el id de Meta, se impulsa igual).' };
}

/** Los valores del borrador de un impulso (plan §5 A4 y §12): «que me escriban», Advantage+, US$5 al día, 7 días, en pausa. */
export function borradorDeImpulso(origen, { ajustes = {}, ahora = Date.now() } = {}) {
  const linea = String(origen.texto || '').split('\n').map(x => x.trim()).find(Boolean) || `publicación de ${origen.red === 'instagram' ? 'Instagram' : 'Facebook'}`;
  const destino = String(ajustes.whatsapp || '').trim() ? 'whatsapp' : origen.red === 'facebook' ? 'messenger' : 'instagram';
  const fin = new Date(ahora + DIAS_IMPULSO * DIA); fin.setHours(23, 59, 0, 0);
  return { nombre: `Impulsar: ${linea.slice(0, 50)}`, objetivo: 'mensajes', destino, publico: { modo: 'advantage' }, presupuesto: { tipo: 'diario', usd: USD_IMPULSO }, inicio: null, fin: fin.toISOString(), origen };
}

/**
 * @param {object} o
 * @param {object}   o.borradores anuncios/borradores.mjs
 * @param {object}   o.creador    anuncios/crear.mjs (validar: lo local y, con Meta, si deja impulsarla)
 * @param {Function} o.fuentes    () → { leerPieza, salidaDe, publicaciones, emparejar }
 * @param {Function} o.ajustes    () → cfg.anuncios
 * @param {number}   o.maxAgente  borradores abiertos por agente
 */
export function crearImpulsor({ borradores, creador = null, fuentes = () => ({}), ajustes = () => ({}), ahora = () => Date.now(), maxAgente = 20 }) {
  async function impulsar(b = {}) {
    const quien = quienDe(b.por), agente = String(b.agente || '').trim();
    if (quien === 'otro' || quien === 'piloto') return no(403, 'Impulsar una publicación lo pide el dueño (o Dimitri, el asistente o un agente, que dejan el borrador).');
    if (quien === 'agente') {
      if (!/^[A-Za-z0-9_-]{1,30}$/.test(agente)) return no(403, 'Un agente deja borradores con su id (agente).');
      if (borradores.lista().filter(x => x.de === `agente:${agente}` && x.estado === 'borrador').length >= maxAgente) return no(429, `Ya tienes ${maxAgente} borradores sin crear: mejora uno de los tuyos en vez de hacer otro.`);
    }
    let r; try { r = resolverOrigen({ pieza: b.pieza || null, red: b.red || null, id: b.id || null }, fuentes() || {}); } catch (e) { return no(500, `No pude buscar la publicación: ${e.message}`); }
    if (!r.origen) return no(r.status, r.motivo);
    const ya = borradores.lista().find(x => x.origen && x.origen.red === r.origen.red && x.origen.id === r.origen.id && (x.estado === 'borrador' || x.estado === 'fallo'));
    if (ya) return R(200, { borrador: ya, ya: true });
    let nuevo;
    try { nuevo = borradores.crear(borradorDeImpulso(r.origen, { ajustes: ajustes() || {}, ahora: ahora() }), { de: quien === 'agente' ? `agente:${agente}` : quien }); }
    catch (e) { return no(e instanceof ErrorBorrador ? e.status : 500, e.message); }
    // el dueño y Dimitri lo reciben ya revisado (lo local y, con Meta conectada, si Meta deja impulsarla): validar no crea nada
    if (creador && (quien === 'dueno' || quien === 'dimitri')) {
      try { const v = await creador.validar(nuevo.id); if (v.status === 200 && v.cuerpo?.borrador) nuevo = v.cuerpo.borrador; } catch { /* se revisa en el paso 5 */ }
    }
    return R(200, { borrador: nuevo });
  }
  return { impulsar };
}
