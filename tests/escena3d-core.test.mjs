// El escenario 3D del Estudio (src/escena3d-core.js, docs/propuesta-banco-presets.md §16). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {
  normalizar, inclinacion, anguloRelativo, ocupacionEstimada, orbitar, aplicarToma, aplicarDistancia, conTipo, describirEscena,
  fraseAngulo, fraseInclinacion, fraseLente, fraseFondo, formatoDistancia, formaDe, horizonte, sensor, componerGuia, rasterizarGuia,
  guiaPNG, medidasCuadro, rotuloGuia, TONOS, TOMAS, DISTANCIAS, TIPOS, ESCENA_DEFECTO, envolver, distanciaLente,
} from '../src/escena3d-core.js';

const escena = (p = {}, c = {}, extra = {}) => normalizar({ producto: { tipo: 'producto', ancho: 100, alto: 100, fondo: 100, ...p }, camara: { distancia: 550, altura: 50, azimut: 0, lente: 50, ...c }, cuadro: { proporcion: '3:2' }, ...extra });
const cerca = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);

/* ---------- el modelo ---------- */
test('normalizar: el piso es el cero, los ángulos dan la vuelta y lo que no se entiende toma su valor de siempre', () => {
  const e = normalizar({ camara: { altura: -40, azimut: 270, distancia: 'x' }, producto: { giro: -190, elevacion: -5 }, cuadro: { proporcion: 'cuadrado' }, fondo: { tipo: 'color', valor: 'fff' } });
  assert.equal(e.camara.altura, 0);
  assert.equal(e.camara.azimut, -90);
  assert.equal(e.producto.giro, 170);
  assert.equal(e.producto.elevacion, 0);
  assert.equal(e.camara.distancia, ESCENA_DEFECTO.camara.distancia);
  assert.equal(e.cuadro.proporcion, '4:5');
  assert.equal(e.fondo.valor, '#FFFFFF');
  assert.equal(envolver(180), 180); assert.equal(envolver(-180), 180); assert.equal(envolver(540), 180);
  assert.deepEqual(normalizar(normalizar(e)), e, 'normalizar dos veces no cambia nada');
});

test('el sensor de 36×24 se recorta a la proporción del cuadro, con su lado largo sobre el lado largo', () => {
  assert.deepEqual(sensor('3:2'), { w: 36, h: 24 });
  assert.deepEqual(sensor('1:1'), { w: 24, h: 24 });
  assert.deepEqual(sensor('4:5'), { w: 24, h: 30 });
  assert.deepEqual(sensor('2:3'), { w: 24, h: 36 });
  cerca(sensor('16:9').h, 20.25); cerca(sensor('9:16').w, 20.25);
});

test('el producto SUBIDO da contrapicado (la inclinación es negativa) y la frase lo dice', () => {
  const e = escena({ elevacion: 150 }, { altura: 60, distancia: 300 });
  assert.ok(inclinacion(e) < -20, `inclinación ${inclinacion(e)}`);
  assert.match(describirEscena(e).en, /worm's-eye view/);
  const suave = escena({ elevacion: 40 }, { altura: 50, distancia: 300 });
  assert.ok(inclinacion(suave) < -5 && inclinacion(suave) > -20);
  assert.match(describirEscena(suave).en, /slightly low angle, heroic/);
  assert.match(describirEscena(suave).en, /raised about 40 cm above the floor/);
});

test('la altura 0 nunca baja del piso: ni normalizando, ni arrastrando la órbita, ni con los atajos', () => {
  let e = escena({}, { altura: 0 });
  assert.equal(e.camara.altura, 0);
  for (let k = 0; k < 20; k++) { e = orbitar(e, 7, -15); assert.ok(e.camara.altura >= 0, `altura ${e.camara.altura}`); }
  assert.equal(e.camara.altura, 0, 'bajando sin parar, la cámara se queda en el piso');
  for (const t of TOMAS) assert.ok(aplicarToma(escena(), t.id).camara.altura >= 0, t.id);
  // subiendo sin parar llega al cenital (90°) y no lo pasa
  let u = escena();
  for (let k = 0; k < 20; k++) u = orbitar(u, 0, 15);
  cerca(inclinacion(u), 90, 1e-6);
  assert.equal(u.camara.distancia, 0);
  cerca(distanciaLente(u), distanciaLente(escena()), 0.05); // la órbita conserva el radio
});

test('el ángulo relativo es azimut − giro: lo que de verdad ve la cámara con el producto girado', () => {
  assert.equal(anguloRelativo(escena({ giro: 30 }, { azimut: 0 })), -30);
  assert.equal(anguloRelativo(escena({ giro: -170 }, { azimut: 170 })), -20);
  assert.equal(anguloRelativo(escena({ giro: 90 }, { azimut: 90 })), 0);
  assert.match(describirEscena(escena({ giro: 30 })).en, /three-quarter view from the left/);
  assert.match(describirEscena(escena({ giro: -30 })).en, /three-quarter view from the right/);
  assert.match(describirEscena(escena({ giro: 90 }, { azimut: 90 })).en, /straight-on front view/);
  assert.match(describirEscena(escena({ giro: 180 })).en, /rear view/);
});

test('la ocupación estimada coincide con la medida a mano (lente 50 mm, sensor 36×24)', () => {
  // cubo de 1 m de frente, la cámara a su altura y a 5,5 m del centro: su cara delantera está a 5 m → 50·100/500 = 10 mm
  const o = ocupacionEstimada(escena());
  cerca(o.ancho, 10 / 36); cerca(o.alto, 10 / 24); assert.equal(o.lado, 'alto'); assert.equal(o.recortado, false);
  cerca((o.bbox.x0 + o.bbox.x1) / 2, 0.5); cerca((o.bbox.y0 + o.bbox.y1) / 2, 0.5);
  // girado 90°: la cámara ve el lado de 50 cm de una caja de 200×50×50, cuya cara más cercana está a 525 − 100 = 425 cm
  const lado = ocupacionEstimada(escena({ ancho: 200, fondo: 50, alto: 50, giro: 90 }, { distancia: 525, altura: 25 }));
  cerca(lado.ancho, (50 * 50 / 425) / 36);
  // cenital: cubo de 1 m, la cámara 5,5 m sobre su centro, cuadro 1:1 (24×24): la tapa a 5 m → 10 mm de 24
  const top = ocupacionEstimada(normalizar({ producto: { tipo: 'producto', ancho: 100, alto: 100, fondo: 100 }, camara: { distancia: 0, altura: 600, lente: 50 }, cuadro: { proporcion: '1:1' } }));
  cerca(top.ancho, 10 / 24); cerca(top.alto, 10 / 24);
  // más lente (85 mm) a la misma distancia ocupa más; demasiado cerca se recorta
  assert.ok(ocupacionEstimada(escena({}, { lente: 85 })).max > o.max);
  assert.equal(ocupacionEstimada(escena({}, { distancia: 120 })).recortado, true);
  assert.equal(ocupacionEstimada(escena({}, { distancia: 30 })).recortado, true, 'la cámara dentro de la caja');
});

/* ---------- la tabla de §16.2: una fila, un test ---------- */
test('tabla · ángulo relativo menos de 15°: straight-on front view', () => { assert.equal(fraseAngulo(14.9).en, 'straight-on front view'); assert.equal(fraseAngulo(-10).en, 'straight-on front view'); });
test('tabla · ángulo relativo 15 a 60°: three-quarter view, el signo decide el lado', () => { assert.equal(fraseAngulo(15).en, 'three-quarter view from the right'); assert.equal(fraseAngulo(-59).en, 'three-quarter view from the left'); });
test('tabla · ángulo relativo 60 a 120°: side profile view', () => { assert.equal(fraseAngulo(60).en, 'side profile view'); assert.equal(fraseAngulo(-120).en, 'side profile view'); });
test('tabla · ángulo relativo 120 a 165°: three-quarter rear view', () => { assert.equal(fraseAngulo(121).en, 'three-quarter rear view'); assert.equal(fraseAngulo(-165).en, 'three-quarter rear view'); });
test('tabla · ángulo relativo más de 165°: rear view', () => { assert.equal(fraseAngulo(166).en, 'rear view'); assert.equal(fraseAngulo(180).en, 'rear view'); });
test('tabla · inclinación menos de −20°: worm\'s-eye', () => assert.equal(fraseInclinacion(-21).en, "dramatic low-angle shot looking up at it (worm's-eye view)"));
test('tabla · inclinación −20 a −5°: heroic', () => { assert.equal(fraseInclinacion(-20).en, 'slightly low angle, heroic'); assert.equal(fraseInclinacion(-5.1).en, 'slightly low angle, heroic'); });
test('tabla · inclinación −5 a 10°: eye-level', () => { assert.equal(fraseInclinacion(-5).en, 'eye-level'); assert.equal(fraseInclinacion(9.9).en, 'eye-level'); });
test('tabla · inclinación 10 a 35°: slightly elevated', () => { assert.equal(fraseInclinacion(10).en, 'slightly elevated high-angle shot'); assert.equal(fraseInclinacion(34.9).en, 'slightly elevated high-angle shot'); });
test('tabla · inclinación 35 a 70°: high-angle', () => { assert.equal(fraseInclinacion(35).en, 'high-angle shot looking down'); assert.equal(fraseInclinacion(70).en, 'high-angle shot looking down'); });
test('tabla · inclinación más de 70°: top-down flat-lay', () => { assert.equal(fraseInclinacion(70.1).en, 'top-down overhead flat-lay'); assert.match(describirEscena(aplicarToma(escena(), 'cenital')).en, /top-down overhead flat-lay/); });
test('tabla · lente 14/24 · 35 · 50 · 85/135', () => {
  assert.match(fraseLente(14).en, /wide-angle 14mm lens with visible perspective/); assert.match(fraseLente(24).en, /wide-angle/);
  assert.equal(fraseLente(35).en, '35mm lens');
  assert.equal(fraseLente(50).en, '50mm lens, natural perspective');
  assert.equal(fraseLente(85).en, '85mm telephoto lens, compressed perspective'); assert.match(fraseLente(135).en, /135mm telephoto/);
  assert.match(fraseLente(28).en, /wide-angle/, 'un lente fuera de la lista va al grupo más cercano');
});
test('tabla · distancia y ocupación: «camera d m away; fills about N% of the frame width/height, with even empty space»', () => {
  const d = describirEscena(escena());
  assert.match(d.en, /Camera 5\.5 m away; the product fills about 42% of the frame height, centered, with even empty space around it\./);
  assert.match(d.es, /Cámara a 5,5 m; el producto ocupa cerca del 42 % del alto del cuadro/);
  assert.match(describirEscena(escena({ ancho: 300 }, { distancia: 900 })).en, /of the frame width/);
  assert.match(describirEscena(escena({}, { distancia: 100 })).en, /fills the frame edge to edge/);
});
test('tabla · fondo: siempre el mismo y sin reencuadrar (color, set o locación)', () => {
  assert.equal(fraseFondo({ tipo: 'color', valor: '#FFFFFF' }).en, 'the same plain pure white (#FFFFFF) background, unchanged, filling the whole frame');
  assert.match(fraseFondo({ tipo: 'color', valor: '#C0FFEE' }).en, /the same plain #C0FFEE colour background, unchanged, filling the whole frame/);
  assert.match(fraseFondo({ tipo: 'set', valor: 'estudio gris' }).en, /studio set background \("estudio gris"\), unchanged, filling the whole frame/);
  assert.match(fraseFondo({ tipo: 'locacion', valor: 'sala moderna' }).en, /location as background \("sala moderna"\), unchanged/);
});
test('medidas y escala: «a {tipo} about ancho×fondo×alto cm»; la persona, su estatura y si entra entera', () => {
  const cama = conTipo(escena(), 'cama-queen');
  assert.match(describirEscena(cama).en, /a queen-size bed about 160×200×50 cm/);
  assert.match(describirEscena(cama).es, /una cama queen de unos 160×200×50 cm/);
  const lejos = aplicarDistancia(conTipo(escena(), 'persona'), 'margen'), cerca2 = normalizar({ ...lejos, camara: { ...lejos.camara, distancia: 150 } });
  assert.match(describirEscena(lejos).en, /a person about 170 cm tall, full body in frame/);
  assert.match(describirEscena(cerca2).en, /framed from the knees up/);
  assert.match(describirEscena(conTipo(escena(), 'cafetera')).en, /^.*Subject: a coffee maker about 20×20×30 cm/);
});
test('el horizonte: en el centro a nivel de los ojos, arriba en picado, fuera en el cenital', () => {
  cerca(horizonte(escena()), 0.5);
  assert.ok(horizonte(escena({}, { altura: 150 })) < 0.5);
  assert.equal(horizonte(aplicarToma(escena(), 'cenital')), null);
});

/* ---------- las familias de modelo (§5.8) ---------- */
test('por familia: párrafo para Gemini y GPT, frase corta para Flux y Seedream (≤ 600), video con su movimiento', () => {
  const e = conTipo(escena(), 'cama-king');
  assert.equal(formaDe('conversacional'), 'parrafo'); assert.equal(formaDe('instrucciones'), 'parrafo');
  assert.equal(formaDe('edicion-corta'), 'corta'); assert.equal(formaDe('kling'), 'video'); assert.equal(formaDe('???'), 'parrafo');
  const p = describirEscena(e, 'conversacional'), c = describirEscena(e, 'edicion-corta'), v = describirEscena(e, 'kling'), m = describirEscena(e, 'veo', { movimiento: 'slow push in' });
  assert.match(p.en, /^Camera and framing: /);
  assert.ok(c.en.length < p.en.length && c.en.length <= 600, `corta: ${c.en.length}`);
  assert.doesNotMatch(c.en, /\. [A-Z]/, 'la corta es una sola frase');
  assert.match(v.en, /^Shot: /); assert.match(v.en, /Static camera\./);
  assert.match(m.en, /Camera movement: slow push in\./);
  for (const d of [p, c, v, m]) { assert.ok(d.es.length > 40); assert.match(d.en, /the same plain pure white/); }
});
test('la línea en vivo: «Frontal · a nivel de los ojos · a 5,5 m con 50 mm · ocupa ~42 % del alto»', () => {
  assert.equal(describirEscena(escena()).resumen, 'Frontal · a nivel de los ojos · a 5,5 m con 50 mm · ocupa ~42 % del alto');
  assert.equal(formatoDistancia(45), '45 cm'); assert.equal(formatoDistancia(320), '3,2 m'); assert.equal(formatoDistancia(320, 'en'), '3.2 m'); assert.equal(formatoDistancia(300), '3 m');
});

/* ---------- los atajos ---------- */
test('atajos de toma: cada uno da la fila que promete y no cambia la distancia al producto', () => {
  const base = conTipo(escena({ giro: 20 }, { distancia: 500, altura: 120 }), 'cama-queen'), r0 = distanciaLente(base);
  const espera = { frontal: ['frontal', 'ojos'], 'tres-cuartos': ['tres-cuartos', 'elevado'], lateral: ['lateral', 'ojos'], 'picado-45': [null, 'picado'], cenital: [null, 'cenital'], contrapicado: [null, 'heroico'] };
  for (const [id, [ang, inc]] of Object.entries(espera)) {
    const e = aplicarToma(base, id), d = describirEscena(e);
    if (ang) assert.equal(d.partes.find(p => p.id === 'angulo').fila, ang, id);
    assert.equal(d.partes.find(p => p.id === 'inclinacion').fila, inc, id);
    if (id !== 'contrapicado') cerca(distanciaLente(e), r0, 0.05);
  }
  assert.equal(anguloRelativo(aplicarToma(base, 'frontal')), 0, 'frontal mira el FRENTE aunque el producto esté girado');
  assert.equal(anguloRelativo(aplicarToma(base, 'tres-cuartos')), 35);
  const ras = aplicarToma(base, 'ras-piso'); assert.equal(ras.camara.altura, 3);
  // la cama es baja: el contrapicado heroico solo sale subiéndola («una foto desde sus pies»)
  const heroico = aplicarToma(base, 'contrapicado');
  assert.ok(heroico.producto.elevacion > 0, 'el producto se sube');
  cerca(inclinacion(heroico), -12, 0.6);
});
test('atajos de distancia: Ajustado · Catálogo · Con margen · Mucho aire dan ~85 · 75 · 60 · 45 % sin cambiar el ángulo', () => {
  for (const tipo of ['cama-queen', 'cafetera', 'persona', 'televisor-55']) {
    for (const lente of [24, 50, 85]) {
      const base = conTipo(escena({}, { lente, altura: 140, azimut: 25 }), tipo), inc = inclinacion(base);
      for (const d of DISTANCIAS) {
        const e = aplicarDistancia(base, d.id), o = ocupacionEstimada(e);
        assert.equal(o.recortado, false, `${tipo} ${lente} ${d.id}`);
        // llega al número; o, si con el producto al centro se saldría (gran angular, cerca), se queda tocando el borde sin recortar
        const borde = Math.min(o.bbox.x0, o.bbox.y0, 1 - o.bbox.x1, 1 - o.bbox.y1);
        assert.ok(Math.abs(o.max - d.ocupacion) <= 0.015 || (o.max < d.ocupacion && borde < 0.01), `${tipo} ${lente} ${d.id}: ${o.max}`);
        cerca(inclinacion(e), inc, 0.5); assert.equal(e.camara.azimut, base.camara.azimut);
      }
    }
  }
  assert.equal(TIPOS.find(t => t.id === 'cama-king').ancho, 193);
});

/* ---------- la imagen guía (§16.3) ---------- */
function leerPNG(url) {
  const b = Buffer.from(url.replace(/^data:image\/png;base64,/, ''), 'base64');
  assert.deepEqual([...b.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  let o = 8, W = 0, H = 0; const idat = [];
  while (o < b.length) { const n = b.readUInt32BE(o), t = b.toString('latin1', o + 4, o + 8); if (t === 'IHDR') { W = b.readUInt32BE(o + 8); H = b.readUInt32BE(o + 12); } if (t === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + n)); o += 12 + n; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) { assert.equal(raw[y * (W + 1)], 0); px.set(raw.subarray(y * (W + 1) + 1, (y + 1) * (W + 1)), y * W); }
  return { W, H, px };
}
const CAJA = new Set([TONOS.frente, TONOS.arriba, TONOS.lado1, TONOS.lado2, TONOS.atras, TONOS.borde, TONOS.marca]);

test('la guía es un PNG válido con la proporción del cuadro, y su raster es el mismo que se dibuja', () => {
  const e = conTipo(escena(), 'cama-queen'), url = guiaPNG(e, { lado: 400 }), { W, H, px } = leerPNG(url);
  assert.deepEqual({ W, H }, medidasCuadro('3:2', 400)); assert.equal(W, 400); assert.equal(H, 267);
  assert.deepEqual(px, rasterizarGuia(componerGuia(e, W, H)));
  assert.ok(url.length < 60000, `pesa ${url.length} caracteres`);
  assert.match(rotuloGuia(2), /^Image 2 is a LAYOUT GUIDE ONLY: match the camera angle, the horizon height, and the size and position of the box, which stands for the product\. Do not draw the box\.$/);
});

test('la guía cambia con la escena: ángulo, distancia, lente, proporción y producto subido', () => {
  const b = escena(), u = guiaPNG(b, { lado: 300 });
  for (const otra of [escena({ giro: 40 }), escena({}, { distancia: 800 }), escena({}, { lente: 24 }), normalizar({ ...b, cuadro: { proporcion: '9:16' } }), escena({ elevacion: 60 }), escena({}, { altura: 300 })]) assert.notEqual(guiaPNG(otra, { lado: 300 }), u);
  assert.equal(guiaPNG(escena(), { lado: 300 }), u, 'la misma escena da la misma guía');
});

test('la guía marca el FRENTE: se ve de frente y no desde atrás; el tamaño de la caja coincide con la ocupación estimada', () => {
  const de = s => { const g = componerGuia(s, 300, 200); return { g, px: rasterizarGuia(g) }; };
  const frente = de(escena()), atras = de(escena({ giro: 180 }));
  assert.ok(frente.g.caras.some(c => c.frente) && frente.g.flecha, 'de frente se ve la cara FRENTE con su flecha');
  assert.equal(frente.px[100 * 300 + 150 - 20], TONOS.frente, 'el centro del cuadro es la cara del frente');
  assert.ok(!atras.g.caras.some(c => c.frente) && !atras.g.flecha, 'desde atrás el frente no se ve');
  // la caja dibujada mide lo que dice ocupacionEstimada (±2 px)
  for (const s of [escena(), escena({ giro: 35 }, { altura: 200 }), aplicarToma(escena(), 'cenital')]) {
    const W = 300, H = 200, px = rasterizarGuia(componerGuia(s, W, H)); let x0 = W, x1 = -1, y0 = H, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (CAJA.has(px[y * W + x])) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const o = ocupacionEstimada(s);
    assert.ok(Math.abs((x1 - x0 + 1) - o.ancho * W) <= 3, `ancho ${x1 - x0 + 1} vs ${o.ancho * W}`);
    assert.ok(Math.abs((y1 - y0 + 1) - o.alto * H) <= 3, `alto ${y1 - y0 + 1} vs ${o.alto * H}`);
  }
});

test('la guía dibuja el piso bajo el horizonte y el hueco del producto subido (la sombra en el piso, separada)', () => {
  const W = 300, H = 200, g = componerGuia(escena(), W, H), px = rasterizarGuia(g);
  cerca(g.horizonte, H / 2, 0.5);
  assert.equal(px[5 * W + 5], TONOS.cielo); assert.ok([TONOS.piso, TONOS.rejilla].includes(px[(H - 5) * W + 5]));
  const sub = componerGuia(escena({ elevacion: 80 }, { altura: 200, distancia: 500 }), W, H), spx = rasterizarGuia(sub);
  const ys = sub.sombra.map(p => p[1]), caja = sub.caras.flatMap(c => c.pts.map(p => p[1]));
  assert.ok(Math.min(...ys) > Math.max(...caja), 'la huella queda debajo de la caja, con aire entre las dos');
  const midY = Math.round((Math.min(...ys) + Math.max(...caja)) / 2);
  assert.ok(!CAJA.has(spx[midY * W + 150]), 'entre la caja y su sombra se ve el piso');
});
