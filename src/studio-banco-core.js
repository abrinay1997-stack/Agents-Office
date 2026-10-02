// ============================================================
// El banco de presets del Estudio: la LÓGICA (pura: sin DOM, sin red, sin archivos). La hoja y el paso del compositor
// (src/studio-banco.js) solo dibujan lo que esto calcula. Cubierto por tests/studio-banco.test.mjs.
//
// docs/propuesta-banco-presets.md §7 y, por encima, §15 y §16 (decisiones del dueño):
//   · las tres puertas son ATAJOS: cambiar de una a otra nunca borra la foto, las referencias, la pila, el canal ni la escena;
//     el modo se deduce de lo que pusiste (modoDe);
//   · un eje exclusivo (fondo, sombra, encuadre…) lo gana el último preset elegido, también contra lo que trae una receta,
//     y se avisa con DESHACER; como mucho una receta por pila (la última gana, igual que en el compilador);
//   · la referencia se separa por ejes (0 apagado · 1 suave · 2 normal · 3 fuerte); Producto nunca viene encendido;
//   · la portada: Favoritos, De PanaClaw, Recientes y de 6 a 8 «Para empezar» SEGÚN LA PUERTA (si no hay tantas estrella,
//     se rellena con las recetas y después los ajustes que encajan: «Desde cero» ya no queda con una sola).
// Injerto (1 oct 2026): lo mejor de la hoja de la rama lane/presets-banco2 (commit 1f2b5b4) sobre el estado del compositor
// integrado { puerta, foto: id|null, refs: [{ id, ejes }], pila: [{ id, params }], canal, escena, modelo, idea, n }.
// ============================================================
import * as core from './presets-core.js';

const arr = v => (Array.isArray(v) ? v : v == null ? [] : [v]);
const nombreDe = p => p?.nombre || p?.id || '¿?';
const Mayus = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* ---------- las puertas y los rótulos ---------- */
export const PUERTAS = [
  { id: 'cero', es: 'Desde cero', ayuda: 'Solo tu idea y los presets' },
  { id: 'foto', es: 'Mejorar mi foto', ayuda: 'Tu foto se conserva; cambia lo que elijas' },
  { id: 'ref', es: 'Copiar de una referencia', ayuda: 'Se imita su estilo, color o composición; nunca su producto' },
];
export const MODO_ES = { cero: 'Desde cero', foto: 'Sobre tu foto', ref: 'Con una referencia', 'foto+ref': 'Tu foto + una referencia' };
export const INTENSIDADES = [['suave', 'Suave'], ['normal', 'Normal'], ['fuerte', 'Fuerte']];
/** Los cuatro atajos de la referencia (§7.4). «Hazlo como este anuncio» va primero: es el que más se usa. Producto: siempre 0. */
export const ATAJOS_REF = [
  { id: 'anuncio', es: 'Hazlo como este anuncio', ejes: { ...core.EJES_REF_ANUNCIO } },
  { id: 'look', es: 'Todo el look', ejes: { estilo: 2, color: 2, composicion: 0, luz: 2, fondo: 2, pose: 0, producto: 0 } },
  { id: 'color', es: 'Solo color (LUT)', ejes: { estilo: 0, color: 2, composicion: 0, luz: 0, fondo: 0, pose: 0, producto: 0 } },
  { id: 'comp', es: 'Solo composición', ejes: { estilo: 0, color: 0, composicion: 2, luz: 0, fondo: 0, pose: 0, producto: 0 } },
];
/** Qué hace cada eje de la referencia y dónde: el color es local y exacto; lo demás lo rehace la IA (D8). */
export const EJE_INFO = {
  estilo: { es: core.EJES_REF_ES.estilo, local: false, ayuda: 'El acabado: textura, ambiente, tipo de foto' },
  color: { es: core.EJES_REF_ES.color, local: true, ayuda: 'Los colores, como un LUT: aquí, sin IA' },
  composicion: { es: core.EJES_REF_ES.composicion, local: false, ayuda: 'El ángulo, el encuadre y dónde va cada cosa' },
  luz: { es: core.EJES_REF_ES.luz, local: false, ayuda: 'De dónde viene la luz, si es suave o dura' },
  fondo: { es: core.EJES_REF_ES.fondo, local: false, ayuda: 'Un fondo parecido, sin copiar sus objetos' },
  pose: { es: core.EJES_REF_ES.pose, local: false, ayuda: 'Solo si en las fotos hay una persona' },
  producto: { es: 'Mi producto en esa foto', local: false, ayuda: 'Pone tu producto en lugar del suyo; necesita tu foto' },
};
/** ¿Qué atajo coincide con estos ejes? (el botón queda pulsado). */
export const atajoDe = ejes => ATAJOS_REF.find(a => core.EJES_REF.every(k => (a.ejes[k] || 0) === (ejes?.[k] || 0)))?.id || null;

/* ---------- la marca de cada tarjeta (§7.4): en texto, nunca solo con color u opacidad ---------- */
export function marca(p, { sharp = true, sirve = null } = {}) {
  if (p.ejecutor === 'local') return sharp ? 'gratis · en tu máquina' : 'no disponible en esta máquina';
  if (sirve && sirve.on === false) return 'sin motor: actívalo';
  if (p.honestidad) return String(p.honestidad);
  const soloFoto = arr(p.modos).length && arr(p.modos).every(m => m === 'foto' || m === 'foto+ref');
  if (p.ejecutor === 'local+ia') return soloFoto ? 'necesita tu foto · la IA y aquí se garantiza' : 'la IA, y aquí se garantiza';
  return soloFoto ? 'necesita tu foto · la IA rehace la imagen' : 'la IA rehace la imagen';
}
/** El tipo de la marca, para su color (el texto ya lo dice): gratis · ia · falta. */
export function tipoMarca(p, { sharp = true, sirve = null } = {}) {
  if (p.ejecutor === 'local') return sharp ? 'gratis' : 'falta';
  if (sirve && sirve.on === false) return 'falta';
  return 'ia';
}

/* ---------- la portada (D13) ---------- */
/** El modo con que la portada filtra en cada puerta: lo que la puerta promete (con la foto que ya haya). */
export const modoDePuerta = (puerta, { foto = null } = {}) => (puerta === 'ref' ? (foto ? 'foto+ref' : 'ref') : puerta === 'foto' ? 'foto' : 'cero');
/**
 * Lo que se ve al abrir el banco sin buscar → [{ titulo, ids }] (solo las secciones con algo):
 * Favoritos, De PanaClaw, Recientes y «Para empezar»: de `min` a `max` — las estrella que encajan con la puerta y, si no
 * llegan a `min`, las recetas que encajan y después los ajustes; nunca una que ya salga arriba.
 */
export function portada(presets, { fav = [], rec = [], puerta = 'foto', foto = null, min = 6, max = 8 } = {}) {
  const by = new Map(presets.map(p => [p.id, p])), modo = modoDePuerta(puerta, { foto });
  const ok = p => p && core.modoAdmite(p, modo);
  const sec = (titulo, ids) => ({ titulo, ids: ids.filter(id => by.has(id)).slice(0, max) });
  const s = [sec('Favoritos', fav), sec('De PanaClaw', presets.filter(p => p.categoria === 'mios').map(p => p.id)), sec('Recientes', rec)];
  const ya = new Set(s.flatMap(x => x.ids));
  const cand = presets.filter(p => ok(p) && !ya.has(p.id) && p.categoria !== 'mios');
  const fase = p => (typeof p.fase === 'number' ? p.fase : 9), receta = p => (p.capa === 'receta' ? 0 : 1);
  let top = cand.filter(p => p.estrella).sort((a, b) => fase(a) - fase(b) || receta(a) - receta(b)).slice(0, max);
  if (top.length < min) top = [...top, ...cand.filter(p => !p.estrella).sort((a, b) => receta(a) - receta(b) || fase(a) - fase(b)).slice(0, min - top.length)];
  return [...s, { titulo: 'Para empezar', ids: top.map(p => p.id) }].filter(x => x.ids.length);
}

/* ---------- el estado del compositor ---------- */
/** El estado del compositor → el pedido del compilador (el mismo que manda la página al servidor). */
export function pedidoDe(st) {
  return {
    pila: st.pila.map(x => ({ id: x.id, ...(x.params && Object.keys(x.params).length ? { params: x.params } : {}) })),
    params: st.canal ? { canal: st.canal } : {},
    entradas: { foto: st.foto ? [st.foto] : [], referencias: st.refs.map(r => ({ id: r.id, ejes: { ...r.ejes } })) },
    idea: st.idea || '', ...(st.escena ? { escena: st.escena } : {}), ...(st.modelo ? { model: st.modelo } : {}), ...(st.proporcion ? { proporcion: st.proporcion } : {}), n: st.n || 1,
  };
}
/** El modo que sale de lo que pusiste (las puertas solo son atajos). */
export const modoDeEstado = st => core.modoDe({ foto: st.foto ? [st.foto] : [], referencias: st.refs }, 'image');
/** Qué le falta a la puerta para cumplir lo que promete, en una frase (o ''). Nunca bloquea: solo lo dice. */
export function faltaEnPuerta(st) {
  if (st.puerta === 'foto' && !st.foto) return 'Falta tu foto: el producto que se va a conservar.';
  if (st.puerta === 'ref' && !st.refs.length) return 'Falta la referencia: la imagen de la que se copia.';
  return '';
}
/** ¿Algún preset de la pila ya exporta para un canal? Si no, elegir un canal añade «Exportar para un canal». */
export function exportaYa(pila, byId) {
  return pila.some(x => { const p = byId.get(x.id); return p && (arr(p.parametros).some(q => q.tipo === 'canal') || arr(p.post).includes('exportar') || arr(p.local).some(o => o.op === 'exportar')); });
}

/* ---------- la pila ---------- */
const ejesExcl = p => arr(p?.ejes).filter(e => core.EJES_EXCLUSIVOS.includes(e));
/**
 * Añadir a la pila con las reglas del banco → { pila, aviso: { texto, antes } | null, avisos: [{ eje, gana, pierde, texto, dentro? }] }
 *   · una sola vez cada uno;
 *   · una receta sustituye a la receta que hubiera (el compilador solo hace caso a la última);
 *   · un ajuste en un eje EXCLUSIVO sustituye al que ya tuviera ese eje en la pila;
 *   · lo que el nuevo le quita a lo que TRAE una receta (fondo gris contra el fondo blanco del catálogo) también se avisa
 *     (`dentro: true`): la receta se queda, sin ese paso;
 *   · `aviso.antes` es la pila de antes: DESHACER la devuelve tal cual.
 */
export function anadir(pila, p, byId) {
  if (!p || pila.some(x => x.id === p.id)) return { pila, aviso: null, avisos: [] };
  const by = byId instanceof Map ? byId : core.indexar(byId), avisos = [];
  let out = pila;
  if (p.capa === 'receta') {
    const otra = out.find(x => by.get(x.id)?.capa === 'receta');
    if (otra) { out = out.filter(x => x !== otra); avisos.push({ eje: 'receta', gana: p.id, pierde: otra.id, texto: `Receta: «${nombreDe(p)}» sustituyó a «${nombreDe(by.get(otra.id))}»` }); }
  } else {
    for (const e of ejesExcl(p)) {
      const prev = out.find(x => { const q = by.get(x.id); return q && q.capa !== 'receta' && ejesExcl(q).includes(e); });
      if (prev) { out = out.filter(x => x !== prev); avisos.push({ eje: e, gana: p.id, pierde: prev.id, texto: `${Mayus(e)}: «${nombreDe(p)}» sustituyó a «${nombreDe(by.get(prev.id))}»` }); }
    }
  }
  out = [...out, { id: p.id, params: {} }];
  for (const a of core.expandir(out, by, { kind: 'image' }).avisos) {
    if (a.tipo === 'sustituye' && a.gana === p.id && !avisos.some(b => b.pierde === a.pierde)) {
      const de = out.find(x => by.get(x.id)?.capa === 'receta');
      avisos.push({ eje: a.eje, gana: a.gana, pierde: a.pierde, dentro: true, texto: `${a.texto}${de ? ` (dentro de «${nombreDe(by.get(de.id))}»)` : ''}` });
    }
  }
  return { pila: out, aviso: avisos.length ? { texto: avisos.map(a => a.texto).join(' · '), antes: pila } : null, avisos };
}
/**
 * Lo que dibuja cada chip de la pila → [{ id, i, preset, nombre, tecnico, receta, pasos: [{ id, nombre }], intensidad, fuera, aviso }]
 *   · `pasos`: lo que trae una receta (el «N pasos ▾» que se despliega), sin lo que otro preset le ganó;
 *   · `intensidad`: Suave · Normal · Fuerte solo si el preset la tiene (si no, el compilador no la usaría: no se ofrece);
 *   · `fuera`: otro preset le ganó su eje (se dice en texto, nunca con opacidad).
 */
export function chipsDe(pila, byId) {
  const by = byId instanceof Map ? byId : core.indexar(byId);
  const exp = core.expandir(pila, by, { kind: 'image' }), vivos = new Set(exp.lista.map(it => it.id));
  return pila.map((x, i) => {
    const p = by.get(x.id);
    const pasos = p?.capa === 'receta' ? exp.lista.filter(it => it.origen === x.id).map(it => ({ id: it.id, nombre: nombreDe(it.preset) })) : [];
    const ip = arr(p?.parametros).find(q => q.tipo === 'intensidad' || q.id === 'intensidad');
    const gano = exp.avisos.find(a => a.tipo === 'sustituye' && a.pierde === x.id);
    return {
      id: x.id, i, preset: p || null, nombre: nombreDe(p || { id: x.id }), tecnico: p?.tecnico || '', receta: p?.capa === 'receta', pasos,
      intensidad: ip ? (x.params?.intensidad || ip.def || 'normal') : null,
      fuera: !!p && !vivos.has(x.id), aviso: gano ? gano.texto : '',
    };
  });
}
/** La intensidad de un chip: «normal» no se guarda (es lo de siempre), así el pedido no cambia por nada. */
export function ponerIntensidad(pila, i, v) {
  return pila.map((x, k) => { if (k !== i) return x; const params = { ...(x.params || {}) }; if (v === 'normal' || !v) delete params.intensidad; else params.intensidad = v; return { ...x, params }; });
}
/** Elegir un atajo de la referencia i (los demás quedan como están). */
export const conAtajo = (refs, i, atajo) => { const a = ATAJOS_REF.find(x => x.id === atajo); return a && refs[i] ? refs.map((r, k) => (k === i ? { ...r, ejes: { ...a.ejes } } : r)) : refs; };

/* ---------- DESHACER ---------- */
const copiar = {
  pila: v => (v || []).map(x => ({ ...x, params: { ...(x.params || {}) } })),
  refs: v => (v || []).map(r => ({ ...r, ejes: { ...(r.ejes || {}) } })),
  escena: v => (v == null ? v : JSON.parse(JSON.stringify(v))),
};
/** Lo que DESHACER devolverá: solo los campos que cambia la acción que avisa ('pila', 'foto', 'refs', 'canal', 'escena'),
 *  copiados. Así deshacer una sustitución no se lleva la foto o el atajo que elegiste después. */
export function instantanea(st, campos) {
  const v = {};
  for (const k of campos) v[k] = (copiar[k] || (x => x))(st[k]);
  return { campos: [...campos], v };
}
/** Devuelve a `st` lo de la instantánea (y nada más). */
export function restaurar(st, snap) {
  for (const k of snap?.campos || []) st[k] = (copiar[k] || (x => x))(snap.v[k]);
  return st;
}
/** ¿Una acción sin aviso que cambia `campos` pisa lo que guarda el DESHACER pendiente? Entonces se anula: ya no sabría a qué volver. */
export const tocaDeshacer = (snap, campos) => !!snap && campos.some(k => snap.campos.includes(k));

/* ---------- el teclado ---------- */
/**
 * Roving tabindex en la lista de tarjetas: el índice al que va el foco, o 'buscar' (↑ en la primera vuelve al buscador),
 * o -1 si la tecla no es de moverse. ↑ ↓ Inicio Fin.
 */
export function moverEnLista(tecla, i, n) {
  if (!n) return -1;
  if (tecla === 'ArrowDown') return Math.min(n - 1, i + 1);
  if (tecla === 'ArrowUp') return i <= 0 ? 'buscar' : i - 1;
  if (tecla === 'Home') return 0;
  if (tecla === 'End') return n - 1;
  return -1;
}
/** Esc por capas: lo más de dentro primero → 'chip' (el detalle abierto de un chip) · 'guardar' (el formulario) ·
 *  'busqueda' (vaciar lo escrito) · 'hoja' (cerrarla y volver al botón) · null (que lo maneje el Estudio). */
export function capaEsc({ chip = false, guardar = false, enBuscador = false, q = '', hoja = false } = {}) {
  if (chip) return 'chip';
  if (guardar) return 'guardar';
  if (enBuscador && q) return 'busqueda';
  if (hoja) return 'hoja';
  return null;
}
/** A partir de qué ancho la hoja deja de tener columnas y pasa a pestañas (Elegir · Mi receta). */
export const ESTRECHO = 700;
export const PESTANAS = [['elegir', 'Elegir'], ['receta', 'Mi receta']];
/** El número de resultados, para aria-live: «Ninguno» también se dice. */
export const cuantos = n => (n ? `${n} ${n === 1 ? 'resultado' : 'resultados'}` : 'Ningún resultado');

/* ---------- la QA y el dinero ---------- */
/** El resumen de la QA de un archivo para su tarjeta: { estado, texto } o null. Vive en src/studio-qa.js (la galería lo usa sin el banco). */
export { qaResumen } from './studio-qa.js';
export const usd = n => (n ? 'US$' + (+n).toFixed(2).replace('.', ',') : 'gratis');
