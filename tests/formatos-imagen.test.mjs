// Fase 2 (CON-02/03/13): una sola lista de formatos, avisos por archivo, respaldo del servidor al subir y el aplanado de la transparencia.
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { avisosDeFormato, prepararSubida, motivoSubida, MAGIC_CONV, SUBIDA_CONVERTIBLE } from '../media/formatos-imagen.mjs';
import { necesitaJpeg, nombreJpeg, noSePudo } from '../src/imagen-jpeg.js';

const aJpeg = async b => new Uint8Array(await sharp(b).rotate().flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer());
const url = (mime, buf) => `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
const px = { create: { width: 8, height: 8, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0 } } };

test('avisos por archivo: solo Instagram, JPEG y video callan, el resto dice qué pasará', () => {
  assert.deepEqual(avisosDeFormato(['2026-10/a.jpg', '2026-10/b.mp4', '2026-10/c.MOV'], { redes: ['instagram'] }), []);
  assert.deepEqual(avisosDeFormato(['2026-10/a.png'], { redes: ['facebook'] }), []);
  const a = avisosDeFormato(['2026-10/a.png', '2026-10/b.svg', '2026-10/c.gif', '2026-10/d.webm'], { redes: ['instagram'], puedeConvertir: true });
  assert.equal(a.length, 4); assert.match(a[0], /«a\.png» se convertirá/); assert.match(a[1], /SVG/); assert.match(a[2], /«c\.gif» \(GIF\)/); assert.match(a[3], /WebM/);
  assert.match(avisosDeFormato(['2026-10/a.png'], { redes: ['instagram'], puedeConvertir: false })[0], /IMAGES/);
});

test('el respaldo del servidor convierte un GIF a JPEG sobre blanco y conserva el nombre', async () => {
  const gif = await sharp(px).gif().toBuffer();
  assert.ok(MAGIC_CONV.gif(new Uint8Array(gif)));
  const r = await prepararSubida({ name: 'logo.gif', data: url('image/gif', gif) }, aJpeg);
  assert.equal(r.name, 'logo.jpg'); assert.match(r.data, /^data:image\/jpeg;base64,/); assert.equal(r.convertida, 'logo.gif');
  const buf = Buffer.from(r.data.split(',')[1], 'base64'); assert.equal(buf[0], 0xFF);
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > 240 && data[1] > 240 && data[2] > 240, `lo transparente queda blanco (${[...data.slice(0, 3)]})`);
  assert.equal(info.channels, 3);
});

test('PNG con transparencia a JPEG (la conversión al entregar) queda blanco, no negro', async () => {
  const png = await sharp(px).png().toBuffer(); const j = await aJpeg(png);
  const { data } = await sharp(Buffer.from(j)).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > 240 && data[1] > 240 && data[2] > 240);
});

test('lo que no es lo que dice, HEIC y lo que no se puede convertir se rechazan con motivo; lo demás pasa tal cual', async () => {
  const png = await sharp(px).png().toBuffer();
  await assert.rejects(prepararSubida({ name: 'x.gif', data: url('image/gif', png) }, aJpeg), /no es lo que dice ser/);
  await assert.rejects(prepararSubida({ name: 'x.heic', data: url('image/heic', [0, 0, 0, 0]) }, aJpeg), /HEIC.*Safari/);
  const gif = await sharp(px).gif().toBuffer();
  await assert.rejects(prepararSubida({ name: 'x.gif', data: url('image/gif', gif) }, null), /no hay con qué convertirlo/);
  await assert.rejects(prepararSubida({ name: 'x.gif', data: url('image/gif', gif) }, async () => { throw new Error('boom'); }), /no pude convertir el GIF/);
  const b = { name: 'a.png', data: url('image/png', png) }; assert.equal(await prepararSubida(b, aJpeg), b);
  assert.match(motivoSubida('image/heif'), /HEIF/); assert.equal(motivoSubida('image/png'), '');
  assert.deepEqual(Object.values(SUBIDA_CONVERTIBLE).sort(), ['avif', 'bmp', 'bmp', 'gif', 'tiff']);
});

test('navegador: qué archivos se pasan a JPEG y cómo se llaman', () => {
  for (const f of [{ name: 'a.gif', type: 'image/gif' }, { name: 'IMG_1.HEIC', type: '' }, { name: 'a', type: 'image/avif' }, { name: 'a.tif', type: '' }]) assert.equal(necesitaJpeg(f), true, f.name);
  for (const f of [{ name: 'a.png', type: 'image/png' }, { name: 'a.jpg', type: 'image/jpeg' }, { name: 'v.mp4', type: 'video/mp4' }]) assert.equal(necesitaJpeg(f), false, f.name);
  assert.equal(nombreJpeg('mi foto.heic'), 'mi foto.jpg'); assert.equal(nombreJpeg(''), 'foto.jpg');
  assert.match(noSePudo({ name: 'x.heic' }, true), /«x\.heic» es HEIC/); assert.match(noSePudo({ name: 'x.gif' }, false), /dañado/);
});
