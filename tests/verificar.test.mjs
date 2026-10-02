// Banco de presets E3 — la QA determinista (verificar.mjs; docs/propuesta-banco-presets.md §5.7, §12 y §16.5). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../imagen-local.mjs';
import * as V from '../verificar.mjs';

let sharp = null; try { sharp = (await import('sharp')).default; } catch { /* sin sharp: se saltan */ }
const t = (nombre, fn) => test(nombre, { skip: !sharp && 'sharp no está en esta máquina' }, fn);

const lienzo = (W, H, c) => L.nuevoRaw(W, H, [...c, 255]);
function rect(im, x, y, w, h, c) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const p = (yy * im.width + xx) * 4; im.data[p] = c[0]; im.data[p + 1] = c[1]; im.data[p + 2] = c[2]; } }
function elipse(im, cx, cy, rx, ry, c) { for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) { const p = (y * im.width + x) * 4; im.data[p] = c[0]; im.data[p + 1] = c[1]; im.data[p + 2] = c[2]; } }
const png = im => sharp(im.data, { raw: { width: im.width, height: im.height, channels: 4 } }).png().toBuffer();

test('ΔE2000 da los valores de referencia de Sharma, Wu y Dalal (2005)', () => {
  const casos = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0000],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
  ];
  for (const [a, b, esperado] of casos) assert.ok(Math.abs(V.deltaE2000(a, b) - esperado) < 1e-4, `${a} / ${b}: ${V.deltaE2000(a, b)} ≠ ${esperado}`);
  assert.equal(V.deltaE2000([50, 10, 10], [50, 10, 10]), 0);
});

t('IoU de silueta: la misma forma a otra escala y en otro sitio da 1; otra forma, menos de 0,85', () => {
  const a = lienzo(400, 300, [255, 255, 255]); rect(a, 50, 50, 200, 100, [90, 60, 40]);
  const b = lienzo(800, 800, [255, 255, 255]); rect(b, 300, 200, 400, 200, [90, 60, 40]);
  const c = lienzo(400, 300, [255, 255, 255]); elipse(c, 150, 100, 100, 50, [90, 60, 40]);
  const d = lienzo(400, 300, [255, 255, 255]); rect(d, 50, 50, 200, 160, [90, 60, 40]); // otra proporción
  const ma = L.mascara(a);
  assert.ok(V.iouSilueta(ma, L.mascara(b)) > 0.97);
  assert.ok(V.iouSilueta(ma, L.mascara(c)) < 0.85);
  assert.ok(V.iouSilueta(ma, L.mascara(d)) < 0.85, 'una proporción distinta no es la misma forma');
  assert.equal(V.iouSilueta(ma, { bbox: null }), 0);
});

t('ΔE dentro de la máscara: el mismo producto da ~0, un color cambiado da más de 6, y por cuartos se ve un cambio parcial', () => {
  const a = lienzo(300, 300, [255, 255, 255]); rect(a, 50, 50, 200, 200, [150, 90, 50]);
  const b = lienzo(300, 300, [250, 250, 250]); rect(b, 50, 50, 200, 200, [150, 90, 50]);
  const c = lienzo(300, 300, [255, 255, 255]); rect(c, 50, 50, 200, 200, [60, 90, 160]);
  const d = lienzo(300, 300, [255, 255, 255]); rect(d, 50, 50, 200, 200, [150, 90, 50]); rect(d, 150, 150, 100, 100, [40, 140, 60]);
  const m = x => L.mascara(x);
  assert.ok(V.deltaEMascara(a, m(a), b, m(b)).deltaE < 0.5, 'el fondo no cuenta');
  assert.ok(V.deltaEMascara(a, m(a), c, m(c)).deltaE > 6);
  const parcial = V.deltaEMascara(a, m(a), d, m(d)); assert.ok(parcial.max > parcial.deltaE && parcial.zonas.length === 4);
});

test('ocupación medida frente a la estimada por el escenario 3D: ±12 puntos ok, más «revisar»', () => {
  const med = { ocupacion: 0.42, ancho: 0.42, alto: 0.3 };
  assert.equal(V.compararOcupacion(med, 0.38).ok, true);
  const mal = V.compararOcupacion(med, 0.6); assert.equal(mal.ok, false); assert.match(mal.motivo, /más pequeño.*18 puntos/);
  assert.equal(V.compararOcupacion(med, { ancho: 0.38 }).ok, true);
  assert.equal(V.compararOcupacion(med, { ancho: 0.4, alto: 0.5 }).ok, false);
  assert.equal(V.compararOcupacion({ ocupacion: null }, 0.4).ok, null, 'sin producto: no medido, no inventado');
  assert.equal(V.compararOcupacion(med, null).ok, null);
  assert.equal(V.ocupacionMedida({ bbox: { x: 0, y: 0, w: 50, h: 20 }, width: 100, height: 100 }).ocupacion, 0.5);
});

t('verificar: un resultado bueno pasa fondo-255, ocupación, sin recorte, lado, proporción, peso e identidad', async () => {
  const canal = { ancho: 1000, alto: 1000, proporcion: '1:1', ocupacion: 0.6, pesoMaxKB: 400 };
  const orig = lienzo(800, 600, [240, 238, 232]); rect(orig, 200, 200, 400, 200, [139, 90, 52]);
  const bueno = lienzo(1000, 1000, [255, 255, 255]); rect(bueno, 200, 350, 600, 300, [139, 90, 52]);
  const r = await V.verificar(await png(bueno), { qa: ['fondo-255', 'ocupacion', 'sin-recorte', 'lado-min', 'proporcion', 'peso', 'identidad'], canal, original: await png(orig) });
  assert.equal(r.estado, 'ok', JSON.stringify(r.checks));
  assert.ok(r.checks.every(c => c.ok === true), JSON.stringify(r.checks));
  assert.equal(r.medido.ocupacion, 0.6); assert.ok(r.medido.iou > 0.97); assert.ok(r.medido.deltaE < 2); assert.ok(r.medido.fondoBorde >= 0.99);
});

t('verificar: fondo no blanco, producto que no ocupa lo pedido, cortado o cambiado → «revisar» con el motivo en palabras', async () => {
  const canal = { ancho: 1000, alto: 1000, ocupacion: 0.6 };
  const orig = lienzo(800, 600, [255, 255, 255]); rect(orig, 200, 200, 400, 200, [139, 90, 52]);
  const gris = lienzo(1000, 1000, [250, 250, 250]); rect(gris, 300, 400, 400, 200, [139, 90, 52]);
  const r1 = await V.verificar(await png(gris), { qa: ['fondo-255', 'ocupacion'], canal });
  assert.equal(r1.estado, 'revisar'); assert.equal(r1.checks[0].ok, false); assert.match(r1.checks[0].motivo, /blanco 255/);
  assert.equal(r1.checks[1].ok, false); assert.match(r1.checks[1].motivo, /ocupa el 40/);
  const cortado = lienzo(1000, 1000, [255, 255, 255]); rect(cortado, 0, 400, 700, 300, [139, 90, 52]);
  const r2 = await V.verificar(await png(cortado), { qa: ['sin-recorte'], canal }); assert.equal(r2.checks[0].ok, false);
  const otro = lienzo(1000, 1000, [255, 255, 255]); elipse(otro, 500, 500, 300, 150, [40, 70, 160]);
  const r3 = await V.verificar(await png(otro), { qa: ['identidad'], original: await png(orig) });
  assert.equal(r3.estado, 'revisar'); assert.match(r3.motivo, /forma del producto cambió/);
});

t('verificar: lo que no se puede medir sale «no medido», nunca un número inventado', async () => {
  const im = lienzo(600, 600, [255, 255, 255]); rect(im, 100, 100, 300, 300, [10, 120, 80]);
  const r = await V.verificar(await png(im), { qa: ['identidad', 'sin-texto', 'ocupacion', 'linea-suelo'], esEscena: true });
  assert.equal(r.estado, 'ok');
  for (const c of r.checks) { assert.equal(c.ok, null, c.id); assert.match(c.motivo, /No medido/); }
});

t('verificar: escena 3D (§16.5) y alfa, línea del suelo y ΔE contra la patrón', async () => {
  const im = lienzo(1000, 800, [255, 255, 255]); rect(im, 300, 300, 400, 300, [139, 90, 52]);
  const ok = await V.verificar(await png(im), { qa: ['escena'], escena: { ocupacionEstimada: { ancho: 0.38 } } });
  assert.equal(ok.checks[0].ok, true);
  const lejos = await V.verificar(await png(im), { qa: ['escena'], escena: { ocupacionEstimada: 0.7 } });
  assert.equal(lejos.estado, 'revisar'); assert.match(lejos.motivo, /más pequeño que lo previsto/);
  const transp = await sharp({ create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  assert.equal((await V.verificar(transp, { qa: ['alfa'] })).checks[0].ok, true);
  assert.equal((await V.verificar(await png(im), { qa: ['alfa'] })).checks[0].ok, false);
  const suelo = await V.verificar(await png(im), { qa: ['linea-suelo'], patron: { lineaSuelo: 0.75 } }); assert.equal(suelo.checks[0].ok, true);
  const otro = lienzo(1000, 800, [255, 255, 255]); rect(otro, 300, 300, 400, 300, [142, 91, 52]);
  const de = await V.verificar(await png(otro), { qa: ['delta-e'], patronImagen: await png(im) }); assert.equal(de.checks[0].ok, true, de.checks[0].motivo);
  const lejos2 = await V.verificar(await png(otro), { qa: ["delta-e"], patronImagen: await png(im), deltaEMax: 0.5 }); assert.equal(lejos2.checks[0].ok, false);
});
