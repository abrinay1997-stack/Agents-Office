// Banco de presets E3 — imagen-local.mjs con imágenes sintéticas (docs/propuesta-banco-presets.md §5.5 y §12). Run: npm test
// Sin sharp, cada test se salta limpio (y uno comprueba que entonces nada cae a la IA).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../imagen-local.mjs';

let sharp = null; try { sharp = (await import('sharp')).default; } catch { /* sin sharp: se saltan */ }
const t = (nombre, fn) => test(nombre, { skip: !sharp && 'sharp no está en esta máquina' }, fn);

// ── dibujo ──
function lienzo(W, H, [r, g, b], ruido = 0, semilla = 7) {
  const im = L.nuevoRaw(W, H, [r, g, b, 255]); let s = semilla;
  if (ruido) for (let p = 0; p < im.data.length; p += 4) for (let c = 0; c < 3; c++) { s = (s * 1103515245 + 12345) >>> 0; im.data[p + c] = Math.max(0, Math.min(255, im.data[p + c] + ((s >> 16) % (2 * ruido + 1)) - ruido)); }
  return im;
}
function rect(im, x, y, w, h, color) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const p = (yy * im.width + xx) * 4; im.data[p] = color[0]; im.data[p + 1] = color[1]; im.data[p + 2] = color[2]; } }
function oscurecer(im, x, y, w, h, fn) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const k = fn(xx, yy); if (k <= 0) continue; const p = (yy * im.width + xx) * 4; for (let c = 0; c < 3; c++) im.data[p + c] = Math.round(im.data[p + c] * (1 - k)); } }
const px = (im, x, y) => { const p = (y * im.width + x) * 4; return [im.data[p], im.data[p + 1], im.data[p + 2]]; };
function iou(m, x, y, w, h, W) { let i = 0, u = 0; for (let k = 0; k < m.length; k++) { const xx = k % W, yy = (k / W) | 0, real = xx >= x && xx < x + w && yy >= y && yy < y + h; if (real && m[k]) i++; if (real || m[k]) u++; } return i / u; }
const aJpg = im => sharp(im.data, { raw: { width: im.width, height: im.height, channels: 4 } }).jpeg({ quality: 95 }).toBuffer();
const aPng = im => sharp(im.data, { raw: { width: im.width, height: im.height, channels: 4 } }).png().toBuffer();
/** La cama de la bodega: madera sobre blanco roto, con una sombra larga a la derecha sobre el suelo. */
function camaConSombra() {
  const im = lienzo(1000, 800, [244, 243, 240], 1);
  oscurecer(im, 600, 470, 380, 60, (x, y) => 0.35 * (1 - (x - 600) / 380) * (1 - Math.abs(y - 500) / 30));
  oscurecer(im, 300, 500, 300, 22, (x, y) => 0.4 * (1 - (y - 500) / 22));
  rect(im, 300, 300, 300, 200, [139, 90, 52]);
  return im;
}

t('sharp carga y disponible() lo dice', async () => {
  const d = await L.disponible(); assert.equal(d.ok, true); assert.ok(d.version);
});

t('fondo blanco: una sábana blanca sobre blanco roto conserva su borde (IoU ≥ 0,97) y el fondo queda a 255', async () => {
  const im = lienzo(600, 480, [236, 234, 228], 1);
  rect(im, 150, 120, 300, 240, [252, 252, 251]);
  for (let y = 160; y < 330; y += 40) rect(im, 170, y, 260, 3, [246, 246, 245]); // pliegues de la sábana
  const m = L.mascara(im);
  assert.ok(iou(m.producto, 150, 120, 300, 240, 600) >= 0.97, 'IoU ' + iou(m.producto, 150, 120, 300, 240, 600));
  const { raw } = L.fondoBlanco(im, { mascara: m });
  assert.deepEqual(px(raw, 5, 5), [255, 255, 255]);
  assert.deepEqual(px(raw, 590, 470), [255, 255, 255]);
  assert.deepEqual(px(raw, 300, 140), [252, 252, 251], 'la sábana no se pinta de blanco');
  assert.deepEqual(px(raw, 300, 161), [246, 246, 245], 'sus pliegues siguen');
  assert.ok(L.fondoBordeBlanco(raw, m) >= 0.999);
});

t('máscara: la sombra va aparte y no cuenta en la caja del producto', async () => {
  const im = camaConSombra(), m = L.mascara(im);
  assert.ok(m.bbox, 'hay producto');
  assert.ok(Math.abs(m.bbox.x - 300) <= 2 && Math.abs(m.bbox.w - 300) <= 3, JSON.stringify(m.bbox));
  assert.ok(Math.abs(m.bbox.y - 300) <= 2 && Math.abs(m.bbox.h - 200) <= 3, JSON.stringify(m.bbox));
  assert.ok(m.bboxSombra && m.bboxSombra.x + m.bboxSombra.w > 800, 'la sombra larga se detecta: ' + JSON.stringify(m.bboxSombra));
});

t('fondo blanco con la sombra como capa: conservar la deja, quitar la borra, regenerar pone una de contacto', async () => {
  const im = camaConSombra(), m = L.mascara(im);
  const con = L.fondoBlanco(im, { mascara: m, sombra: 'conservar' }).raw, sin = L.fondoBlanco(im, { mascara: m, sombra: 'quitar' }).raw;
  const reg = L.fondoBlanco(im, { mascara: m, sombra: 'regenerar' }).raw;
  assert.ok(px(con, 650, 500)[0] < 235, 'la sombra se conserva sobre el blanco nuevo: ' + px(con, 650, 500));
  assert.deepEqual(px(sin, 650, 500), [255, 255, 255]);
  assert.ok(px(reg, 450, 502)[0] < 250, 'una sombra de contacto bajo la base');
  assert.deepEqual(px(con, 10, 10), [255, 255, 255]);
});

t('encuadrar(0,60) mide entre 0,59 y 0,61 sin contar una sombra larga, con la base donde se pide', async () => {
  const im = camaConSombra();
  const o = await L.encuadrar(L.fondoBlanco(im).raw, { ancho: 2048, alto: 2048, ocupacion: 0.6, fondo: '#FFFFFF' });
  assert.ok(o.medido.ocupacion >= 0.59 && o.medido.ocupacion <= 0.61, 'calculada ' + o.medido.ocupacion);
  const med = await L.medir(o.raw);
  assert.ok(med.ocupacion >= 0.59 && med.ocupacion <= 0.61, 'medida ' + med.ocupacion);
  assert.ok(Math.abs(med.bbox.x + med.bbox.w / 2 - 1024) <= 3, 'centrado');
  const b = await L.encuadrar(L.fondoBlanco(im).raw, { ancho: 2048, alto: 2048, ocupacion: 0.7, alinear: 'base', base: 0.85, fondo: '#FFFFFF' });
  const mb = await L.medir(b.raw);
  assert.ok(Math.abs((mb.bbox.y + mb.bbox.h) / 2048 - 0.85) <= 0.01, 'base al 85 %: ' + (mb.bbox.y + mb.bbox.h) / 2048);
});

t('una cama 2:1 en un lienzo apaisado respeta el aire vertical mínimo', async () => {
  const im = lienzo(1200, 800, [255, 255, 255]); rect(im, 200, 300, 800, 400, [120, 80, 50]);
  const o = await L.encuadrar(im, { ancho: 1600, alto: 900, ocupacion: 0.95, aireMinPx: 120, fondo: '#FFFFFF' });
  assert.ok(o.medido.aire.arriba >= 119 && o.medido.aire.abajo >= 119, JSON.stringify(o.medido.aire));
  assert.ok(o.medido.aire.izq >= 119 && o.medido.aire.der >= 119);
  assert.equal(o.medido.recortado, false);
});

t('misma escala en la serie: con medidas en cm, la king sale más grande que la queen', () => {
  const opts = { ancho: 2048, alto: 2048, ocupacion: 0.6 };
  const [q, k] = L.escalaSerie([{ bbox: { w: 400, h: 500 }, cm: { ancho: 160, alto: 200 } }, { bbox: { w: 386, h: 406 }, cm: { ancho: 193, alto: 203 } }], opts);
  assert.ok(400 * q < 386 * k, 'la queen dibujada más pequeña que la king');
  assert.ok(Math.abs(Math.max(386 * k, 406 * k) / 2048 - 0.6) < 0.001, 'la mayor manda la ocupación');
  const [a, b] = L.escalaSerie([{ bbox: { w: 100, h: 100 } }, { bbox: { w: 300, h: 150 } }], opts);
  assert.equal(a, b);
});

t('LUT: la identidad no cambia nada y un .cube conocido da el píxel esperado', async () => {
  const im = lienzo(32, 32, [0, 0, 0]); for (let i = 0; i < 32 * 32; i++) { im.data[i * 4] = (i * 7) & 255; im.data[i * 4 + 1] = (i * 13) & 255; im.data[i * 4 + 2] = (i * 29) & 255; }
  const id = L.aplicarLut(im, L.exportarCube(L.lutIdentidad(17)));
  assert.ok(id.data.equals(im.data), 'la identidad cambió píxeles');
  const invertir = 'TITLE "invertir"\nLUT_3D_SIZE 2\n1 1 1\n0 1 1\n1 0 1\n0 0 1\n1 1 0\n0 1 0\n1 0 0\n0 0 0\n';
  const lut = L.leerCube(invertir); assert.equal(lut.tamano, 2); assert.equal(lut.titulo, 'invertir');
  const p = lienzo(2, 1, [255, 0, 0]); rect(p, 1, 0, 1, 1, [128, 64, 200]);
  const out = L.aplicarLut(p, lut);
  assert.deepEqual(px(out, 0, 0), [0, 255, 255]);
  assert.deepEqual(px(out, 1, 0), [127, 191, 55]);
  assert.deepEqual(px(L.aplicarLut(p, lut, 0.5), 0, 0), [128, 128, 128]);
  assert.throws(() => L.leerCube('LUT_3D_SIZE 3\n0 0 0\n'), /trae 1 colores/);
});

t('tonos: exposición +1 dobla la luz lineal, sombras no toca los extremos, contraste en S, saturación protege la piel', () => {
  const g = lienzo(3, 1, [0, 0, 0]); rect(g, 1, 0, 1, 1, [100, 100, 100]); rect(g, 2, 0, 1, 1, [255, 255, 255]);
  const e = L.exposicion(g, 1); assert.ok(Math.abs(L.lineal(px(e, 1, 0)[0]) - 2 * L.lineal(100)) < 0.01);
  const s = L.sombras(g, 0.4); assert.deepEqual(px(s, 0, 0), [0, 0, 0]); assert.deepEqual(px(s, 2, 0), [255, 255, 255]); assert.ok(px(s, 1, 0)[0] > 100);
  const a = L.altas(g, -0.4); assert.ok(px(a, 1, 0)[0] < 100); assert.deepEqual(px(a, 2, 0), [255, 255, 255]);
  const cc = lienzo(2, 1, [64, 64, 64]); rect(cc, 1, 0, 1, 1, [192, 192, 192]); const c = L.contraste(cc, 0.3); assert.ok(px(c, 0, 0)[0] < 64 && px(c, 1, 0)[0] > 192);
  const sk = lienzo(2, 1, [210, 160, 130]); rect(sk, 1, 0, 1, 1, [60, 120, 200]);
  const sat = L.saturacion(sk, 0.5), dPiel = Math.abs(px(sat, 0, 0)[0] - 210), dAzul = Math.abs(px(sat, 1, 0)[2] - 200);
  assert.ok(dPiel < dAzul / 2, `la piel cambia ${dPiel}, el azul ${dAzul}`);
});

t('balance (mundo gris) y quitar un tono llevan lo neutro a neutro; temperatura calienta', () => {
  const im = lienzo(40, 40, [150, 140, 110]); rect(im, 0, 0, 20, 40, [120, 112, 90]);
  const b = L.balance(im); const [r, g, bl] = px(b, 30, 5); assert.ok(Math.max(r, g, bl) - Math.min(r, g, bl) <= 2, 'gris: ' + [r, g, bl]);
  const d = L.dominante(im, { fuerza: 1 }); const q = px(d, 30, 5); assert.ok(Math.max(...q) - Math.min(...q) <= 3, 'sin tono: ' + q);
  const t2 = L.temperatura(lienzo(1, 1, [128, 128, 128]), 1000); const w = px(t2, 0, 0); assert.ok(w[0] > 128 && w[2] < 128);
  const bn = L.blancoYNegro(lienzo(1, 1, [200, 30, 30]), { contraste: 0 }); const k = px(bn, 0, 0); assert.ok(k[0] === k[1] && k[1] === k[2]);
  const dos = lienzo(10, 10, [60, 60, 60]); rect(dos, 0, 0, 5, 10, [180, 180, 180]);
  const n = L.autoNiveles(dos);
  assert.deepEqual(px(n, 9, 9), [0, 0, 0]); assert.deepEqual(px(n, 0, 0), [255, 255, 255]);
  assert.ok(L.grano(lienzo(8, 8, [128, 128, 128]), 0.05).data.equals(L.grano(lienzo(8, 8, [128, 128, 128]), 0.05).data), 'el grano es determinista');
});

t('copiar color (Reinhard en Lab): la foto toma la media y la desviación de la referencia; como LUT da lo mismo', async () => {
  const src = lienzo(64, 64, [90, 120, 160], 0); for (let y = 0; y < 64; y++) rect(src, 0, y, 64, 1, [80 + y, 110 + y, 150 + y / 2]);
  const ref = lienzo(64, 64, [0, 0, 0]); for (let y = 0; y < 64; y++) rect(ref, 0, y, 64, 1, [200 - y, 150 - y / 2, 90]);
  const o = L.transferirColor(src, ref, { fuerza: 1 });
  const e = L.estadisticasLab(o.raw), er = L.estadisticasLab(ref);
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(e.media[c] - er.media[c]) < 1.5, `media ${c}: ${e.media[c]} vs ${er.media[c]}`);
  const { cube } = L.guardarColorComoLut(src, ref, { fuerza: 1 });
  assert.match(cube, /LUT_3D_SIZE 33/);
  const viaLut = L.aplicarLut(src, cube); let dif = 0;
  for (let p = 0; p < viaLut.data.length; p += 4) for (let c = 0; c < 3; c++) dif = Math.max(dif, Math.abs(viaLut.data[p + c] - o.raw.data[p + c]));
  assert.ok(dif <= 4, 'la LUT exportada reproduce la transferencia (máx. ' + dif + ')');
  const media = L.transferirColor(src, ref, { fuerza: 0.4 }).raw; assert.ok(px(media, 10, 10)[0] < px(o.raw, 10, 10)[0], 'la fuerza mezcla');
});

t('copiar color solo en el producto deja el fondo como estaba', () => {
  const im = lienzo(200, 160, [255, 255, 255]); rect(im, 60, 40, 80, 80, [60, 90, 160]);
  const ref = lienzo(50, 50, [200, 120, 60]);
  const o = L.transferirColor(im, ref, { zona: 'producto' });
  assert.deepEqual(px(o.raw, 5, 5), [255, 255, 255]);
  assert.ok(px(o.raw, 100, 80)[0] > 150, 'el producto tomó el color: ' + px(o.raw, 100, 80));
});

t('exportar: sRGB con ICC, sin EXIF ni GPS, tamaño exacto, JPG 4:4:4 en un marketplace y peso por canal', async () => {
  const im = camaConSombra();
  const conGps = await sharp(im.data, { raw: { width: im.width, height: im.height, channels: 4 } })
    .withExif({ IFD0: { Make: 'Bodega', Model: 'Telefono' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '8/1 59/1 0/1' } }).jpeg().toBuffer();
  assert.ok((await sharp(conGps).metadata()).exif, 'la de prueba trae EXIF');
  const raw = await L.leer(conGps);
  const o = await L.exportar(raw, { canal: { id: 'amazon', grupo: 'otras', ancho: 2000, alto: 2000, formato: 'jpg', fondo: '#FFFFFF' }, ajuste: 'rellenar', sku: 'CAMA-Q 160', n: 1 });
  const md = await sharp(o.buffer).metadata();
  assert.equal(md.width, 2000); assert.equal(md.height, 2000); assert.equal(md.format, 'jpeg');
  assert.equal(md.exif, undefined, 'sin EXIF'); assert.ok(md.icc, 'con ICC'); assert.equal(md.space, 'srgb');
  assert.equal(md.chromaSubsampling, '4:4:4'); assert.equal(o.nombre, 'CAMA-Q-160_01.jpg');
  const w = await L.exportar(raw, { canal: { id: 'shopify', ancho: 2048, alto: 2048, formato: 'webp', pesoMaxKB: 20 } });
  assert.ok(w.buffer.length <= 20 * 1024 || w.avisos.length, 'cabe en el peso o lo avisa');
  const ad = await L.exportar(raw, { canal: { id: 'fb-anuncio', ancho: 1200, alto: 628, formato: 'jpg' } });
  const ma = await sharp(ad.buffer).metadata(); assert.equal(ma.width, 1200); assert.equal(ma.height, 628);
});

t('pipeline «Catálogo para la web»: 2048² webp, fondo 255, producto al 60 % (±1 %), sin EXIF y con nombre por SKU', async () => {
  const canal = { id: 'web', proporcion: '1:1', ancho: 2048, alto: 2048, fondo: '#FFFFFF', ocupacion: 0.6, aireMinPx: 328, formato: 'webp', pesoMaxKB: 400 };
  const r = await L.pipeline(await aJpg(camaConSombra()), ['fondo-blanco', 'encuadrar', 'exportar'], { canal, sku: 'CAMA-QUEEN', n: 1 });
  assert.equal(r.formato, 'webp'); assert.equal(r.ancho, 2048); assert.equal(r.alto, 2048); assert.equal(r.nombre, 'CAMA-QUEEN_01.webp');
  assert.ok(r.medido.ocupacion >= 0.59 && r.medido.ocupacion <= 0.61, 'ocupación ' + r.medido.ocupacion);
  assert.ok(r.medido.ocupacionMedida >= 0.59 && r.medido.ocupacionMedida <= 0.61, 'ocupación medida ' + r.medido.ocupacionMedida);
  assert.ok(r.medido.fondoBorde >= 0.98, 'fondo ' + r.medido.fondoBorde);
  assert.ok(r.buffer.length <= 400 * 1024);
  assert.ok(r.pasos.every(p => p.hecho), JSON.stringify(r.pasos));
  const md = await sharp(r.buffer).metadata(); assert.equal(md.exif, undefined); assert.ok(md.icc);
});

t('pipeline con intensidades: «Que se vea más clara» normal y fuerte, sin llamar a nada', async () => {
  const im = await aPng(lienzo(20, 20, [80, 80, 80]));
  const paso = { op: 'exposicion', ev: { suave: 0.2, normal: 0.4, fuerte: 0.7 } };
  const n = await L.pipeline(im, [paso], {}), f = await L.pipeline(im, [paso], { intensidad: 'fuerte' });
  const v = async b => px(await L.leer(b), 5, 5)[0];
  assert.ok(await v(f.buffer) > await v(n.buffer) && await v(n.buffer) > 80);
  assert.equal(n.formato, 'png');
  const desconocido = await L.pipeline(im, ['magia'], {}); assert.equal(desconocido.pasos[0].hecho, false); assert.match(desconocido.avisos[0], /no es una operación local/);
});

t('lo que necesita la IA no se hace a escondidas: extender una escena y enderezar más de 5° lo dicen', async () => {
  const esc = lienzo(200, 150, [0, 0, 0]); for (let y = 0; y < 150; y++) for (let x = 0; x < 200; x++) { const p = (y * 200 + x) * 4; esc.data[p] = x; esc.data[p + 1] = y; esc.data[p + 2] = (x * y) & 255; }
  const e = L.extender(esc, { factor: 1.3 }); assert.equal(e.necesitaIA, true);
  const liso = lienzo(100, 100, [255, 255, 255]); rect(liso, 30, 30, 40, 40, [10, 10, 10]);
  const ok = L.extender(liso, { px: 20 }); assert.equal(ok.raw.width, 140);
  const r = await L.rotarHorizonte(liso, { angulo: 8 }); assert.equal(r.necesitaIA, true); assert.match(r.aviso, /IA/);
  const p = await L.pipeline(await aPng(esc), [{ op: 'extender', factor: 1.3 }], {});
  assert.equal(p.pasos[0].hecho, false); assert.equal(p.pasos[0].necesitaIA, true);
});

t('enderezar: detecta un horizonte torcido 3° y lo deja casi recto', async () => {
  const W = 400, H = 300, im = lienzo(W, H, [200, 210, 230]), a = 3 * Math.PI / 180;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (y > H / 2 + (x - W / 2) * Math.tan(a)) { const p = (y * W + x) * 4; im.data[p] = 90; im.data[p + 1] = 110; im.data[p + 2] = 70; }
  const ang = L.anguloHorizonte(im);
  assert.ok(Math.abs(Math.abs(ang) - 3) <= 0.6, 'ángulo ' + ang);
  const r = await L.rotarHorizonte(im);
  assert.ok(Math.abs(L.anguloHorizonte(r.raw)) <= 0.6, 'después ' + L.anguloHorizonte(r.raw));
  assert.equal(r.raw.width, W); assert.equal(r.raw.height, H);
});

t('igualar la serie lleva la exposición y el tono al patrón', () => {
  const pat = lienzo(200, 200, [255, 255, 255]); rect(pat, 50, 50, 100, 100, [150, 110, 80]);
  const osc = lienzo(200, 200, [255, 255, 255]); rect(osc, 50, 50, 100, 100, [105, 80, 70]);
  const mp = L.medirSerie(pat), o = L.igualarSerie(osc, mp), mo = L.medirSerie(o.raw);
  assert.ok(Math.abs(mo.exposicion - mp.exposicion) < 3, `${mo.exposicion} vs ${mp.exposicion}`);
  assert.ok(Math.abs(mo.b - mp.b) < 3);
  assert.equal(mp.lineaSuelo, 0.75);
});

test('sin sharp: «no disponible en esta máquina», y nada cae a la IA', async () => {
  L.usarSharp(null);
  try {
    const d = await L.disponible(); assert.equal(d.ok, false); assert.match(d.motivo, /no disponible en esta máquina/);
    await assert.rejects(L.pipeline(Buffer.from('x'), ['exposicion'], {}), e => e instanceof L.NoDisponible && e.code === 'no-disponible' && /No se usa la IA/.test(e.message));
    await assert.rejects(L.leer(Buffer.from('x')), L.NoDisponible);
  } finally { L.usarSharp(); }
  if (sharp) assert.equal((await L.disponible()).ok, true);
});
