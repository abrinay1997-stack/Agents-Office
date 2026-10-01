// ============================================================
// El escenario 3D del Estudio (puro): cámara, producto y distancia (docs/propuesta-banco-presets.md §16)
//
// El dueño (1 oct 2026): «el margen no es un porcentaje: es un escenario 3D». El producto es una caja con sus medidas reales
// (una cama, una cafetera, un televisor, una persona) que gira sobre su eje y se puede subir; la cámara orbita a su alrededor
// a una distancia en cm o m, siempre apuntando a su centro, sin bajar nunca del piso (el piso es el cero) y hasta 90° arriba.
// De ahí sale, sin magia:
//   · la inclinación (`inclinacion`): positiva mirando hacia abajo (picado), 90° en el cenital, NEGATIVA cuando el producto está
//     más alto que la cámara (contrapicado, «una foto desde sus pies»);
//   · el ángulo relativo (`anguloRelativo` = azimut − giro): lo que de verdad ve la cámara;
//   · la ocupación estimada (`ocupacionEstimada`): la caja proyectada con el lente (sensor de 36×24 recortado a la proporción);
//   · la frase para el motor (`describirEscena`, la tabla de §16.2, por familia de modelo);
//   · la IMAGEN GUÍA de composición (`componerGuia` + `guiaPNG`): la caja en blanco y gris con su FRENTE marcado, el piso y el
//     horizonte, con esa cámara, ese lente y esa proporción → PNG (data URL). Es lo que de verdad fija el encuadre.
// Lo importan el editor (src/escena3d.js), el banco de presets y el servidor. Sin DOM, sin three.js: corre en node:test.
// Cubierto por tests/escena3d-core.test.mjs.
//
// Ejes (cm): Y hacia arriba, el piso en y = 0, el producto centrado en x = z = 0. Con giro 0 su FRENTE mira a +Z, que es donde
// está la cámara con azimut 0. Un azimut positivo lleva la cámara hacia +X: a la DERECHA de quien mira el frente del producto.
// ============================================================

export const LENTES = Object.freeze([14, 24, 35, 50, 85, 135]);
export const PROPORCIONES = Object.freeze(['1:1', '4:5', '3:4', '2:3', '9:16', '16:9', '3:2', '4:3', '1.91:1']);
export const LIMITES = Object.freeze({
  distancia: [0, 10000], altura: [0, 10000], elevacion: [0, 500], medida: [1, 3000], lente: [10, 300],
});
const DEG = Math.PI / 180;

/** Medidas reales por tipo (cm). `tipo` es la palabra del producto; `en` su nombre para el motor. */
export const TIPOS = Object.freeze([
  { id: 'cama-queen', tipo: 'cama', g: 'f', es: 'Cama queen', en: 'queen-size bed', ancho: 160, alto: 50, fondo: 200 },
  { id: 'cama-king', tipo: 'cama', g: 'f', es: 'Cama king', en: 'king-size bed', ancho: 193, alto: 50, fondo: 203 },
  { id: 'sofa', tipo: 'sofa', g: 'm', es: 'Sofá de 3 puestos', en: 'three-seat sofa', ancho: 210, alto: 85, fondo: 90 },
  { id: 'cafetera', tipo: 'cafetera', g: 'f', es: 'Cafetera', en: 'coffee maker', ancho: 20, alto: 30, fondo: 20 },
  // 55 pulgadas de diagonal en 16:9 = 121,8 × 68,5 cm de pantalla; con el marco, 123 × 71
  { id: 'televisor-55', tipo: 'televisor', g: 'm', es: 'Televisor 55″', en: '55-inch flat-screen television', ancho: 123, alto: 71, fondo: 6 },
  { id: 'persona', tipo: 'persona', g: 'f', es: 'Persona (170 cm)', en: 'person', ancho: 45, alto: 170, fondo: 25 },
  { id: 'producto', tipo: 'producto', g: 'm', es: 'Producto (caja)', en: 'product', ancho: 40, alto: 40, fondo: 40 },
]);
const NOMBRE = {
  cama: ['cama', 'bed', 'f'], sofa: ['sofá', 'sofa', 'm'], cafetera: ['cafetera', 'coffee maker', 'f'], televisor: ['televisor', 'television', 'm'],
  persona: ['persona', 'person', 'f'], producto: ['producto', 'product', 'm'], mesa: ['mesa', 'table', 'f'], silla: ['silla', 'chair', 'f'],
  colchon: ['colchón', 'mattress', 'm'], lampara: ['lámpara', 'lamp', 'f'], botella: ['botella', 'bottle', 'f'], caja: ['caja', 'box', 'f'],
};

export const ESCENA_DEFECTO = Object.freeze({
  producto: Object.freeze({ tipo: 'cama-queen', ancho: 160, alto: 50, fondo: 200, giro: 0, elevacion: 0 }),
  camara: Object.freeze({ distancia: 640, azimut: 0, altura: 160, lente: 50 }), // ≈ «con margen» (60 %) en 4:5
  cuadro: Object.freeze({ proporcion: '4:5' }),
  fondo: Object.freeze({ tipo: 'color', valor: '#FFFFFF' }),
});

/** Atajos de toma (§16.4). Mantienen la distancia al centro del producto (el radio de la órbita). */
export const TOMAS = Object.freeze([
  { id: 'frontal', es: 'Frontal', rel: 0, phi: 0 },
  { id: 'tres-cuartos', es: '3/4', rel: 35, phi: 12 },
  { id: 'lateral', es: 'Lateral', rel: 90, phi: 0 },
  { id: 'picado-45', es: 'Picado 45°', phi: 45 },
  { id: 'cenital', es: 'Cenital', phi: 90 },
  { id: 'contrapicado', es: 'Contrapicado heroico', phi: -12 },
  { id: 'ras-piso', es: 'A ras de piso', altura: 3 },
]);
/** Atajos de distancia: mueven la cámara (sin cambiar el ángulo) para que el producto ocupe esa fracción del cuadro. */
export const DISTANCIAS = Object.freeze([
  { id: 'ajustado', es: 'Ajustado', ocupacion: 0.85 },
  { id: 'catalogo', es: 'Catálogo', ocupacion: 0.75 },
  { id: 'margen', es: 'Con margen', ocupacion: 0.60 },
  { id: 'aire', es: 'Mucho aire', ocupacion: 0.45 },
]);

/* ---------- normalizar ---------- */
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : d));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const r2 = v => Math.round(v * 100) / 100;
/** Un ángulo en (−180, 180]. */
export function envolver(a) { let x = ((num(a, 0) + 180) % 360 + 360) % 360 - 180; if (x === -180) x = 180; return r2(x) || 0; }

/** «4:5», «1.91:1» → ancho / alto. Una proporción que no se entiende vale 4:5. */
export function razon(p) {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*[:x×/]\s*(\d+(?:[.,]\d+)?)\s*$/.exec(String(p || ''));
  const w = m ? +m[1].replace(',', '.') : 0, h = m ? +m[2].replace(',', '.') : 0;
  return w > 0 && h > 0 ? w / h : 0.8;
}

/** Una escena completa y dentro de sus límites, sea lo que sea lo que llegue (la del dueño, la de Dimitri, la de una nota). */
export function normalizar(e = {}) {
  const D = ESCENA_DEFECTO, p = e.producto || {}, c = e.camara || {}, q = e.cuadro || {}, f = e.fondo || {};
  const tipo = typeof p.tipo === 'string' && p.tipo.trim() ? p.tipo.trim().slice(0, 40) : D.producto.tipo;
  const base = TIPOS.find(t => t.id === tipo) || D.producto;
  const [m0, m1] = LIMITES.medida;
  const prop = typeof q.proporcion === 'string' && razon(q.proporcion) && /\d/.test(q.proporcion) ? q.proporcion.trim() : D.cuadro.proporcion;
  const ft = ['color', 'set', 'locacion'].includes(f.tipo) ? f.tipo : D.fondo.tipo;
  let fv = typeof f.valor === 'string' && f.valor.trim() ? f.valor.trim().slice(0, 80) : (ft === 'color' ? D.fondo.valor : '');
  if (ft === 'color' && /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(fv)) { fv = fv.replace('#', ''); if (fv.length === 3) fv = fv.split('').map(x => x + x).join(''); fv = '#' + fv.toUpperCase(); }
  return {
    producto: {
      tipo,
      ancho: r2(clamp(num(p.ancho, base.ancho), m0, m1)), alto: r2(clamp(num(p.alto, base.alto), m0, m1)), fondo: r2(clamp(num(p.fondo, base.fondo), m0, m1)),
      giro: envolver(num(p.giro, 0)), elevacion: r2(clamp(num(p.elevacion, 0), ...LIMITES.elevacion)),
    },
    camara: {
      distancia: r2(clamp(num(c.distancia, D.camara.distancia), ...LIMITES.distancia)),
      azimut: envolver(num(c.azimut, 0)),
      altura: r2(clamp(num(c.altura, D.camara.altura), ...LIMITES.altura)), // el piso es el cero: nunca bajo él
      lente: Math.round(clamp(num(c.lente, D.camara.lente), ...LIMITES.lente)),
    },
    cuadro: { proporcion: prop },
    fondo: { tipo: ft, valor: fv || (ft === 'set' ? 'estudio gris' : 'sala moderna') },
  };
}

/** El tipo del producto con nombre en español y en inglés (para la frase y la interfaz). */
export function nombreProducto(e) {
  const t = String(e?.producto?.tipo || 'producto');
  const fijo = TIPOS.find(x => x.id === t);
  if (fijo) return { es: fijo.es.replace(/\s*\(.*\)$/, '').toLowerCase(), en: fijo.en, base: fijo.tipo, g: fijo.g };
  const k = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const n = NOMBRE[k] || NOMBRE[k.replace(/s$/, '')];
  return n ? { es: n[0], en: n[1], base: k, g: n[2] } : { es: t, en: t, base: k, g: 'm' };
}

/* ---------- la geometría ---------- */
export const centroProducto = e => e.producto.elevacion + e.producto.alto / 2;
/** Grados: + mirando hacia abajo (picado), 90 en el cenital, − cuando el producto está más alto que la cámara (contrapicado). */
export function inclinacion(e) { return Math.atan2(e.camara.altura - centroProducto(e), e.camara.distancia) / DEG; }
/** Lo que ve la cámara del producto: 0 = su frente, ±90 = un lado (+ a la derecha de quien mira el frente), 180 = su espalda. */
export const anguloRelativo = e => envolver(e.camara.azimut - e.producto.giro);
/** Del centro del producto al lente, en línea recta (cm). */
export const distanciaLente = e => Math.hypot(e.camara.distancia, e.camara.altura - centroProducto(e));

/** El sensor de 36×24 recortado a la proporción del cuadro (lado largo del sensor sobre el lado largo del cuadro), en mm. */
export function sensor(proporcion) {
  const a = razon(proporcion);
  if (a >= 1) return a >= 1.5 ? { w: 36, h: 36 / a } : { w: 24 * a, h: 24 };
  return a <= 2 / 3 ? { w: 36 * a, h: 36 } : { w: 24, h: 24 / a };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** La cámara como base ortonormal: posición, adelante (al centro del producto), derecha y arriba del cuadro. La derecha no
 *  depende de la inclinación, así que el cenital (90°) no se vuelve indefinido. */
export function camaraBase(e) {
  const a = e.camara.azimut * DEG, d = e.camara.distancia;
  const pos = [d * Math.sin(a), e.camara.altura, d * Math.cos(a)], obj = [0, centroProducto(e), 0];
  let fwd = sub(obj, pos); if (Math.hypot(...fwd) < 1e-6) fwd = [-Math.sin(a), 0, -Math.cos(a)];
  fwd = unit(fwd);
  const right = [Math.cos(a), 0, -Math.sin(a)], up = cross(right, fwd);
  return { pos, obj, fwd, right, up };
}

const CERCA = 1; // cm: el plano cercano

/** Proyecta puntos del mundo (cm) al cuadro: x, y en 0..1 desde arriba a la izquierda; z la profundidad (cm). */
export function proyector(e) {
  const b = camaraBase(e), s = sensor(e.cuadro.proporcion), f = e.camara.lente;
  const enCamara = P => { const v = sub(P, b.pos); return [dot(v, b.right), dot(v, b.up), dot(v, b.fwd)]; };
  const aCuadro = ([x, y, z]) => [0.5 + (f * x / z) / s.w, 0.5 - (f * y / z) / s.h, z];
  return { base: b, sensor: s, enCamara, aCuadro, proyectar: P => { const c = enCamara(P); return c[2] > CERCA ? aCuadro(c) : null; } };
}

/** Las 8 esquinas de la caja del producto, giradas y subidas (cm). Las cuatro primeras son las de su FRENTE (+Z local). */
export function esquinas(e) {
  const { ancho, alto, fondo, giro, elevacion } = e.producto, g = giro * DEG, cs = Math.cos(g), sn = Math.sin(g);
  const out = [];
  for (const z of [fondo / 2, -fondo / 2]) for (const [x, y] of [[-ancho / 2, 0], [ancho / 2, 0], [ancho / 2, alto], [-ancho / 2, alto]]) {
    out.push([x * cs + z * sn, elevacion + y, -x * sn + z * cs]); // rotación alrededor de Y (como three.js): +Z gira hacia +X
  }
  return out;
}

/** Qué fracción del cuadro ocupa la caja del producto: ancho y alto (0..1), el mayor de los dos y en qué lado, su caja en el
 *  cuadro y si se sale (recortado) o la cámara queda dentro o pegada a él. */
export function ocupacionEstimada(e) {
  const P = proyector(e), pts = esquinas(e).map(P.enCamara);
  if (pts.some(p => p[2] <= CERCA)) return { ancho: 1, alto: 1, max: 1, lado: 'ancho', recortado: true, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } };
  const q = pts.map(P.aCuadro);
  const x0 = Math.min(...q.map(p => p[0])), x1 = Math.max(...q.map(p => p[0])), y0 = Math.min(...q.map(p => p[1])), y1 = Math.max(...q.map(p => p[1]));
  const recortado = x0 < 0 || y0 < 0 || x1 > 1 || y1 > 1;
  const ancho = Math.min(1, x1 - x0), alto = Math.min(1, y1 - y0);
  return { ancho, alto, max: Math.max(ancho, alto), lado: alto > ancho ? 'alto' : 'ancho', recortado, bbox: { x0, y0, x1, y1 } };
}

/* ---------- mover la cámara en su órbita ---------- */
/** El radio de la órbita (cm, al centro del producto) y su ángulo sobre el horizonte (= la inclinación). */
export const orbita = e => ({ radio: distanciaLente(e), phi: inclinacion(e) });
/** Pone la cámara en la órbita con ese radio y ese ángulo; nunca bajo el piso (si no cabe, se queda en él). */
export function enOrbita(e, radio, phi) {
  const n = normalizar(e), c = centroProducto(n), p = clamp(phi, -89.9, 90) * DEG, r = Math.max(0, radio);
  n.camara.distancia = r2(clamp(r * Math.cos(p), ...LIMITES.distancia));
  if (Math.abs(n.camara.distancia) < 0.01) n.camara.distancia = 0;
  n.camara.altura = r2(clamp(c + r * Math.sin(p), ...LIMITES.altura));
  return n;
}
/** Arrastrar la cámara: alrededor (azimut, grados) y arriba o abajo (grados de órbita), de 0 cm del piso a 90°. */
export function orbitar(e, dAzimut = 0, dPhi = 0) {
  const n = normalizar(e), { radio, phi } = orbita(n);
  const m = enOrbita(n, radio, Math.min(90, phi + dPhi));
  m.camara.azimut = envolver(n.camara.azimut + dAzimut);
  return m;
}

/** Aplica un atajo de toma (TOMAS). El contrapicado baja la cámara y, si no basta, SUBE el producto («una foto desde sus pies»). */
export function aplicarToma(e, id) {
  const t = TOMAS.find(x => x.id === id); let n = normalizar(e);
  if (!t) return n;
  const { radio, phi } = orbita(n);
  if (t.rel != null) n.camara.azimut = envolver(n.producto.giro + t.rel);
  if (t.altura != null) { n.camara.altura = t.altura; return n; }
  if (t.id === 'contrapicado') {
    const objetivo = t.phi * DEG, d = Math.max(radio * Math.cos(objetivo), 1);
    const alturaQueda = centroProducto(n) + radio * Math.sin(objetivo);
    if (alturaQueda >= 15) return enOrbita(n, radio, t.phi);
    n.camara.altura = 15; n.camara.distancia = r2(d); // la cámara casi en el piso; el producto sube lo que falte
    n.producto.elevacion = r2(clamp(15 + d * Math.tan(-objetivo) - n.producto.alto / 2, ...LIMITES.elevacion));
    return n;
  }
  return enOrbita(n, radio, t.phi ?? phi);
}

/** Mueve la cámara, sin cambiar su ángulo, para que el producto ocupe `objetivo` (0..1, o el id de DISTANCIAS) del cuadro. */
export function aplicarDistancia(e, objetivo) {
  const n = normalizar(e), d = DISTANCIAS.find(x => x.id === objetivo);
  const meta = clamp(d ? d.ocupacion : num(objetivo, 0.6), 0.02, 0.98);
  // nunca recorta: si con el producto en el centro la caja se saldría del cuadro (gran angular, de cerca), se queda donde toca el borde
  const { phi } = orbita(n), occ = r => { const o = ocupacionEstimada(enOrbita(n, r, phi)); return o.recortado ? Infinity : o.max; };
  let lo = Math.hypot(n.producto.ancho, n.producto.alto, n.producto.fondo) / 2 + CERCA + 1, hi = 20000;
  if (occ(lo) <= meta) return enOrbita(n, lo, phi);
  for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (occ(mid) > meta) lo = mid; else hi = mid; }
  return enOrbita(n, Math.round(hi), phi);
}

/** Cambia las medidas por las de un tipo (TIPOS), sin tocar la cámara. */
export function conTipo(e, id) {
  const n = normalizar(e), t = TIPOS.find(x => x.id === id);
  if (!t) return n;
  Object.assign(n.producto, { tipo: t.id, ancho: t.ancho, alto: t.alto, fondo: t.fondo });
  return normalizar(n);
}

/* ---------- la frase para el motor (§16.2) ---------- */
/** cm → «3,2 m» / «45 cm» (es) o «3.2 m» / «45 cm» (en). */
export function formatoDistancia(cm, idioma = 'es') {
  const v = Math.max(0, num(cm, 0));
  if (v < 100) return `${Math.round(v)} cm`;
  const m = Math.round(v / 10) / 10, t = m % 1 === 0 ? String(m) : m.toFixed(1);
  return `${idioma === 'es' ? t.replace('.', ',') : t} m`;
}

/** La fila de la tabla para el ángulo relativo. */
export function fraseAngulo(rel) {
  const a = Math.abs(envolver(rel)), lado = rel > 0 ? ['right', 'derecha'] : ['left', 'izquierda'];
  if (a < 15) return { id: 'frontal', en: 'straight-on front view', es: 'vista frontal, de frente', corto: 'Frontal' };
  if (a < 60) return { id: 'tres-cuartos', en: `three-quarter view from the ${lado[0]}`, es: `vista de 3/4 desde la ${lado[1]}`, corto: `3/4 ${lado[1]}` };
  if (a <= 120) return { id: 'lateral', en: 'side profile view', es: `vista de perfil (lado ${lado[1]})`, corto: 'Lateral' };
  if (a <= 165) return { id: 'tres-cuartos-atras', en: 'three-quarter rear view', es: 'vista de 3/4 desde atrás', corto: '3/4 trasera' };
  return { id: 'trasera', en: 'rear view', es: 'vista trasera, desde atrás', corto: 'Trasera' };
}
/** La fila de la tabla para la inclinación. */
export function fraseInclinacion(i) {
  if (i < -20) return { id: 'gusano', en: "dramatic low-angle shot looking up at it (worm's-eye view)", es: 'contrapicado extremo, mirándolo desde abajo', corto: 'contrapicado extremo' };
  if (i < -5) return { id: 'heroico', en: 'slightly low angle, heroic', es: 'contrapicado suave, heroico', corto: 'contrapicado' };
  if (i < 10) return { id: 'ojos', en: 'eye-level', es: 'a la altura de los ojos', corto: 'a nivel de los ojos' };
  if (i < 35) return { id: 'elevado', en: 'slightly elevated high-angle shot', es: 'algo elevada, picado suave', corto: 'algo elevada' };
  if (i <= 70) return { id: 'picado', en: 'high-angle shot looking down', es: 'picado, mirando hacia abajo', corto: 'picado' };
  return { id: 'cenital', en: 'top-down overhead flat-lay', es: 'cenital, desde arriba', corto: 'cenital' };
}
/** La fila de la tabla para el lente (un lente fuera de la lista va al grupo más cercano). */
export function fraseLente(mm) {
  const l = Math.round(num(mm, 50));
  if (l <= 28) return { id: 'angular', en: `wide-angle ${l}mm lens with visible perspective`, es: `gran angular de ${l} mm, con perspectiva marcada` };
  if (l <= 42) return { id: '35', en: `${l}mm lens`, es: `lente de ${l} mm` };
  if (l <= 70) return { id: '50', en: `${l}mm lens, natural perspective`, es: `lente de ${l} mm, perspectiva natural` };
  return { id: 'tele', en: `${l}mm telephoto lens, compressed perspective`, es: `teleobjetivo de ${l} mm, perspectiva comprimida` };
}
const NOMBRE_COLOR = { '#FFFFFF': ['pure white', 'blanco puro'], '#000000': ['black', 'negro'], '#F5F5F5': ['off-white', 'blanco roto'], '#808080': ['mid grey', 'gris medio'] };
/** La fila del fondo: siempre «el mismo», sin reencuadrar. */
export function fraseFondo(f) {
  if (f.tipo === 'color') {
    const n = NOMBRE_COLOR[f.valor];
    return { en: `the same plain ${n ? `${n[0]} (${f.valor})` : `${f.valor} colour`} background, unchanged, filling the whole frame`, es: `el mismo fondo liso ${n ? `${n[1]} (${f.valor})` : f.valor}, sin cambiar y llenando todo el cuadro` };
  }
  if (f.tipo === 'set') return { en: `the same studio set background ("${f.valor}"), unchanged, filling the whole frame`, es: `el mismo set de estudio («${f.valor}»), sin cambiar y llenando todo el cuadro` };
  return { en: `the same location as background ("${f.valor}"), unchanged, filling the whole frame`, es: `la misma locación de fondo («${f.valor}»), sin cambiar y llenando todo el cuadro` };
}

/** Dónde cae el horizonte (0 arriba, 1 abajo) o null si no se ve (cenital, o fuera del cuadro). */
export function horizonte(e) {
  const i = inclinacion(e); if (i >= 89) return null;
  const s = sensor(e.cuadro.proporcion), y = 0.5 - (e.camara.lente * Math.tan(i * DEG)) / s.h;
  return y > 0.02 && y < 0.98 ? y : null;
}

const FORMA = {
  conversacional: 'parrafo', instrucciones: 'parrafo', 'edicion-corta': 'corta', descriptiva: 'corta',
  veo: 'video', kling: 'video', seedance: 'video', 'minimax-video': 'video', 'video-generico': 'video',
};
/** Qué forma de frase usa una familia de modelo (§5.8): párrafo (Gemini, GPT), corta (Flux, Seedream) o video. */
export const formaDe = familia => FORMA[familia] || 'parrafo';

/** La escena en palabras para el motor (en inglés, `en`) y su traducción para el dueño (`es`), por familia de modelo.
 *  opts.movimiento: el movimiento de cámara del preset de video (en inglés; se añade a la forma video).
 *  Devuelve también `resumen` (la línea en vivo del editor) y `partes` (cada fila de la tabla, por si el compilador las quiere). */
export function describirEscena(escena, familia = 'conversacional', opts = {}) {
  const e = normalizar(escena), forma = formaDe(familia), n = nombreProducto(e);
  const rel = anguloRelativo(e), inc = inclinacion(e), occ = ocupacionEstimada(e), h = horizonte(e);
  const A = fraseAngulo(rel), I = fraseInclinacion(inc), L = fraseLente(e.camara.lente), F = fraseFondo(e.fondo);
  const dEn = formatoDistancia(distanciaLente(e), 'en'), dEs = formatoDistancia(distanciaLente(e), 'es');
  const pct = Math.round(occ.max * 100), ladoEn = occ.lado === 'alto' ? 'height' : 'width', ladoEs = occ.lado === 'alto' ? 'alto' : 'ancho';
  const { ancho, alto, fondo, elevacion } = e.producto;
  const persona = n.base === 'persona';
  const medidas = persona
    ? { en: `a person about ${Math.round(alto)} cm tall, ${occ.alto > 0.95 || occ.recortado ? 'framed from the knees up' : 'full body in frame, head to feet'}`, es: `una persona de unos ${Math.round(alto)} cm, ${occ.alto > 0.95 || occ.recortado ? 'encuadrada de las rodillas hacia arriba' : 'de cuerpo entero, de la cabeza a los pies'}` }
    : { en: `${/^[aeiou]/i.test(n.en) ? 'an' : 'a'} ${n.en} about ${Math.round(ancho)}×${Math.round(fondo)}×${Math.round(alto)} cm (width × depth × height)`, es: `${n.g === 'f' ? 'una' : 'un'} ${n.es} de unos ${Math.round(ancho)}×${Math.round(fondo)}×${Math.round(alto)} cm (ancho × fondo × alto)` };
  const cx = (occ.bbox.x0 + occ.bbox.x1) / 2, cy = (occ.bbox.y0 + occ.bbox.y1) / 2;
  const pos = Math.abs(cx - 0.5) < 0.06 && Math.abs(cy - 0.5) < 0.06 ? ['centered', 'centrado']
    : [`in the ${[cy < 0.44 ? 'upper' : cy > 0.56 ? 'lower' : '', cx < 0.44 ? 'left' : cx > 0.56 ? 'right' : ''].filter(Boolean).join(' ') || 'middle'} part of the frame`,
      `en la parte ${[cy < 0.44 ? 'de arriba' : cy > 0.56 ? 'de abajo' : '', cx < 0.44 ? 'izquierda' : cx > 0.56 ? 'derecha' : ''].filter(Boolean).join(' ') || 'central'} del cuadro`];
  const sujeto = persona ? 'person' : n.en, sujetoEs = `${n.g === 'f' ? 'la' : 'el'} ${persona ? 'persona' : n.es}`;
  const llena = occ.recortado || pct >= 97
    ? { en: `camera ${dEn} away; the ${sujeto} fills the frame edge to edge`, es: `cámara a ${dEs}; ${sujetoEs} llena el cuadro de borde a borde` }
    : { en: `camera ${dEn} away; the ${sujeto} fills about ${pct}% of the frame ${ladoEn}, ${pos[0]}, with even empty space around it`, es: `cámara a ${dEs}; ${sujetoEs} ocupa cerca del ${pct} % del ${ladoEs} del cuadro, ${pos[1]}, con el mismo aire alrededor` };
  const partes = [
    { ...A, fila: A.id, id: 'angulo' }, { ...I, fila: I.id, id: 'inclinacion' }, { ...L, fila: L.id, id: 'lente' }, { ...llena, id: 'distancia' }, { ...medidas, id: 'medidas' },
  ];
  if (elevacion >= 2) partes.push({ id: 'elevacion', en: `the ${sujeto} is raised about ${Math.round(elevacion)} cm above the floor on a plinth`, es: `${sujetoEs} está ${n.g === 'f' ? 'subida' : 'subido'} unos ${Math.round(elevacion)} cm sobre el piso, en una base` });
  if (h != null) partes.push({ id: 'horizonte', en: `horizon line about ${Math.round(h * 100)}% down from the top of the frame`, es: `la línea del horizonte a un ${Math.round(h * 100)} % desde arriba` });
  partes.push({ ...F, id: 'fondo' });
  if (forma === 'video') {
    const mov = typeof opts.movimiento === 'string' && opts.movimiento.trim() ? opts.movimiento.trim() : '';
    partes.push(mov ? { id: 'movimiento', en: `camera movement: ${mov}`, es: `movimiento de cámara: ${mov}` }
      : { id: 'movimiento', en: 'static camera', es: 'cámara fija' });
  }
  const P = Object.fromEntries(partes.map(p => [p.id, p]));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const extra = (k, f) => (P[k] ? f(P[k]) : '');
  let en, es;
  if (forma === 'corta') {
    en = [A.en, I.en, `${e.camara.lente}mm`, P.medidas.en, llena.en.replace(/^camera /, 'camera '), extra('elevacion', p => p.en), F.en].filter(Boolean).join(', ');
    es = [A.es, I.es, `${e.camara.lente} mm`, P.medidas.es, llena.es, extra('elevacion', p => p.es), F.es].filter(Boolean).join(', ');
  } else {
    const ini = forma === 'video' ? 'Shot' : 'Camera and framing', iniEs = forma === 'video' ? 'Plano' : 'Cámara y encuadre';
    en = `${ini}: ${A.en}, ${I.en}, ${L.en}. Subject: ${P.medidas.en}. ${cap(llena.en)}.${extra('elevacion', p => ` ${cap(p.en)}.`)}${extra('horizonte', p => ` ${cap(p.en)}.`)} Background: ${F.en}.${extra('movimiento', p => ` ${cap(p.en)}.`)}`;
    es = `${iniEs}: ${A.es}, ${I.es}, ${L.es}. Sujeto: ${P.medidas.es}. ${cap(llena.es)}.${extra('elevacion', p => ` ${cap(p.es)}.`)}${extra('horizonte', p => ` ${cap(p.es)}.`)} Fondo: ${F.es}.${extra('movimiento', p => ` ${cap(p.es)}.`)}`;
  }
  const resumen = `${A.corto} · ${I.corto} · a ${dEs} con ${e.camara.lente} mm · ${occ.recortado || pct >= 97 ? 'llena el cuadro' : `ocupa ~${pct} % del ${ladoEs}`}`;
  return { familia, forma, en, es, resumen, partes, ocupacion: occ, inclinacion: inc, anguloRelativo: rel };
}

/** El rótulo de la imagen guía cuando va como referencia número n (§16.3). */
export const rotuloGuia = n => `Image ${n} is a LAYOUT GUIDE ONLY: match the camera angle, the horizon height, and the size and position of the box, which stands for the product. Do not draw the box.`;

/* ---------- la imagen guía (§16.3): primitivas 2D, y un PNG sin canvas ---------- */
export const TONOS = Object.freeze({ cielo: 255, piso: 238, rejilla: 222, horizonte: 150, sombra: 200, arriba: 210, lado1: 178, lado2: 158, atras: 140, frente: 112, borde: 40, marca: 250 });

/** Recorta un polígono (en coordenadas de cámara) al plano cercano (Sutherland–Hodgman con z > CERCA). */
function recortarCerca(poly) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ina = a[2] > CERCA, inb = b[2] > CERCA;
    if (ina) out.push(a);
    if (ina !== inb) { const t = (CERCA - a[2]) / (b[2] - a[2]); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), CERCA + 1e-6]); }
  }
  return out;
}

/** Lo que ve la cámara, en primitivas de W×H píxeles: el piso, su rejilla de 1 m, el horizonte, la sombra de contacto y las caras
 *  visibles de la caja (la del FRENTE marcada con una flecha). Lo pintan el editor (canvas) y `guiaPNG` (sin canvas), igual. */
export function componerGuia(escena, W = 640, H = 800) {
  const e = normalizar(escena), P = proyector(e);
  const px = c => { const q = P.aCuadro(c); return [q[0] * W, q[1] * H]; };
  const poli = mundo => { const c = recortarCerca(mundo.map(P.enCamara)); return c.length >= 3 ? c.map(px) : null; };
  const seg = (a, b) => { const c = recortarCerca([P.enCamara(a), P.enCamara(b)]); return c.length >= 2 ? [...px(c[0]), ...px(c[1])] : null; };
  const G = 5000, out = { W, H, piso: poli([[-G, 0, -G], [G, 0, -G], [G, 0, G], [-G, 0, G]]), rejilla: [], horizonte: null, sombra: null, caras: [], flecha: null, ocupacion: ocupacionEstimada(e) };
  for (let k = -30; k <= 30; k++) { const v = k * 100; for (const s of [seg([v, 0, -3000], [v, 0, 3000]), seg([-3000, 0, v], [3000, 0, v])]) if (s) out.rejilla.push(s); }
  const h = horizonte(e); if (h != null) out.horizonte = h * H;
  const C = esquinas(e), piso = C.map(([x, , z]) => [x, 0, z]);
  out.sombra = poli([piso[0], piso[1], piso[5], piso[4]]); // la huella en el piso: con el producto subido, se ve el hueco
  // las caras: [índices, tono, es el frente]
  const caras = [
    [[0, 1, 2, 3], 'frente', true], [[5, 4, 7, 6], 'atras'], [[1, 5, 6, 2], 'lado1'], [[4, 0, 3, 7], 'lado2'], [[3, 2, 6, 7], 'arriba'], [[4, 5, 1, 0], 'abajo'],
  ];
  const centro = [0, centroProducto(e), 0];
  for (const [idx, tono, frente] of caras) {
    const pts = idx.map(i => C[i]), cc = pts.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]);
    const normal = sub(cc, centro); if (dot(normal, sub(P.base.pos, cc)) <= 1e-6) continue; // de espaldas a la cámara
    const p = poli(pts); if (!p) continue;
    out.caras.push({ pts: p, tono: TONOS[tono === 'abajo' ? 'atras' : tono], frente: !!frente });
    if (frente) { // una flecha en el frente, apuntando al piso: «este lado es el frente»
      const m = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      const izq = m(C[0], C[3], 0.62), der = m(C[1], C[2], 0.62), base = m(m(C[0], C[1], 0.5), m(C[3], C[2], 0.5), 0.22);
      out.flecha = poli([m(izq, der, 0.3), m(izq, der, 0.7), base]);
    }
  }
  return out;
}

/** Rasteriza las primitivas en grises (Uint8Array W×H), sin canvas: corre igual en node y en el navegador. */
export function rasterizarGuia(g) {
  const { W, H } = g, px = new Uint8Array(W * H).fill(TONOS.cielo);
  const llenar = (pts, v) => {
    if (!pts || pts.length < 3) return;
    const ys = pts.map(p => p[1]), y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= yc) !== (b[1] <= yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) { const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5)); if (xb >= xa) px.fill(v, y * W + xa, y * W + xb + 1); }
    }
  };
  const linea = (x0, y0, x1, y1, ancho, v) => { const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy); if (l < 1e-6) return; const nx = -dy / l * ancho / 2, ny = dx / l * ancho / 2; llenar([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], v); };
  const lw = Math.max(1, Math.round(Math.min(W, H) / 320));
  llenar(g.piso, TONOS.piso);
  for (const s of g.rejilla) linea(...s, lw, TONOS.rejilla);
  if (g.horizonte != null) linea(0, g.horizonte, W, g.horizonte, lw, TONOS.horizonte);
  llenar(g.sombra, TONOS.sombra);
  for (const c of g.caras) {
    llenar(c.pts, c.tono);
    for (let i = 0; i < c.pts.length; i++) { const a = c.pts[i], b = c.pts[(i + 1) % c.pts.length]; linea(a[0], a[1], b[0], b[1], c.frente ? lw * 3 : lw * 2, TONOS.borde); }
  }
  llenar(g.flecha, TONOS.marca);
  return px;
}

/* PNG en gris de 8 bits, comprimido con deflate de Huffman fijo y repeticiones a distancia 1 (la guía es casi toda planos) */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (bytes) => { let c = -1; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
function deflateFijo(data) {
  const out = []; let acc = 0, nb = 0;
  const bits = (v, n) => { for (let i = 0; i < n; i++) { acc |= ((v >>> i) & 1) << nb; if (++nb === 8) { out.push(acc); acc = 0; nb = 0; } } };
  const huff = (code, n) => { for (let i = n - 1; i >= 0; i--) bits((code >>> i) & 1, 1); };
  const sym = s => { if (s < 144) huff(0x30 + s, 8); else if (s < 256) huff(0x190 + s - 144, 9); else if (s < 280) huff(s - 256, 7); else huff(0xc0 + s - 280, 8); };
  bits(1, 1); bits(1, 2); // último bloque, Huffman fijo
  let i = 0;
  while (i < data.length) {
    if (i > 0) {
      let r = 0; while (r < 258 && i + r < data.length && data[i + r] === data[i - 1]) r++;
      if (r >= 3) {
        let k = LBASE.length - 1; while (LBASE[k] > r) k--;
        sym(257 + k); bits(r - LBASE[k], LEXTRA[k]); huff(0, 5); // distancia 1: código 0, sin bits extra
        i += r; continue;
      }
    }
    sym(data[i]); i++;
  }
  sym(256); if (nb) out.push(acc);
  let a = 1, b = 0; for (let j = 0; j < data.length; j++) { a = (a + data[j]) % 65521; b = (b + a) % 65521; }
  return concat([Uint8Array.from([0x78, 0x01]), Uint8Array.from(out), Uint8Array.from([(b >>> 8) & 255, b & 255, (a >>> 8) & 255, a & 255])]);
}
function concat(parts) { const n = parts.reduce((s, p) => s + p.length, 0), o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; }
/** Un PNG en gris (Uint8Array) de una imagen W×H de un byte por píxel. */
export function pngGris(px, W, H) {
  const raw = new Uint8Array((W + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W + 1)] = 0; raw.set(px.subarray(y * W, (y + 1) * W), y * (W + 1) + 1); }
  const u32 = v => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  const chunk = (tipo, d) => { const td = concat([Uint8Array.from(tipo, ch => ch.charCodeAt(0)), d]); return concat([Uint8Array.from(u32(d.length)), td, Uint8Array.from(u32(crc32(td)))]); };
  const ihdr = Uint8Array.from([...u32(W), ...u32(H), 8, 0, 0, 0, 0]);
  return concat([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateFijo(raw)), chunk('IEND', new Uint8Array(0))]);
}
const base64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };

/** Medidas en píxeles del cuadro con su lado largo = `lado`. */
export function medidasCuadro(proporcion, lado = 768) {
  const a = razon(proporcion);
  return a >= 1 ? { W: lado, H: Math.max(1, Math.round(lado / a)) } : { W: Math.max(1, Math.round(lado * a)), H: lado };
}
/** La imagen guía de composición como PNG (data URL), con el lado largo de `lado` píxeles (por defecto 768). */
export function guiaPNG(escena, { lado = 768 } = {}) {
  const e = normalizar(escena), { W, H } = medidasCuadro(e.cuadro.proporcion, clamp(Math.round(num(lado, 768)), 64, 2048));
  return 'data:image/png;base64,' + base64(pngGris(rasterizarGuia(componerGuia(e, W, H)), W, H));
}
