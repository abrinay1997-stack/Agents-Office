// Fase 2 (CON-02/03/13) en la nube: un GIF subido se convierte con IMAGES (sobre blanco), HEIC se rechaza con motivo y aprobar avisa archivo por archivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { montar, subirImagen, enPanama } from './contenido-ayudas.mjs';

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const GIF = Uint8Array.from([...Buffer.from('GIF89a'), 1, 0, 1, 0, 0, 0, 0, 0x3b]);
const url = (mime, b) => `data:${mime};base64,${Buffer.from(b).toString('base64')}`;
/** El R2 de pruebas no honra onlyIf: devuelve un objeto como el real cuando la clave estaba libre. */
const conPutReal = t => { const put = t.r2.put.bind(t.r2); t.r2.put = async (...a) => { await put(...a); return {}; }; return t; };
function imagenes(visto) { return { input: () => ({ transform: t => { visto.push(t); return { output: async o => { visto.push(o); return { response: () => new Response(JPEG) }; } }; } }) }; }

test('subir un GIF: IMAGES lo pasa a JPEG con fondo blanco y la galería guarda un .jpg', { skip: SALTAR }, async () => {
  const visto = []; const t = conPutReal(await montar({ env: { IMAGES: imagenes(visto) } }));
  const r = await t.api('/api/media/upload', { metodo: 'POST', cuerpo: { name: 'logo.gif', data: url('image/gif', GIF) } });
  assert.equal(r.status, 200, JSON.stringify(r.datos)); assert.match(r.datos.item.file, /\.jpg$/);
  assert.equal(visto[0].background, '#ffffff'); assert.equal(visto[1].format, 'image/jpeg');
});

test('subir HEIC o un GIF falso: 400 con la causa; sin IMAGES, un GIF dice que no hay con qué convertirlo', { skip: SALTAR }, async () => {
  const t = await montar({ env: { IMAGES: imagenes([]) } });
  const heic = await t.api('/api/media/upload', { metodo: 'POST', cuerpo: { name: 'a.heic', data: url('image/heic', GIF) } });
  assert.equal(heic.status, 400); assert.match(heic.datos.error, /HEIC/);
  const falso = await t.api('/api/media/upload', { metodo: 'POST', cuerpo: { name: 'a.gif', data: url('image/gif', JPEG) } });
  assert.equal(falso.status, 400); assert.match(falso.datos.error, /no es lo que dice ser/);
  const s = await montar(); const sin = await s.api('/api/media/upload', { metodo: 'POST', cuerpo: { name: 'a.gif', data: url('image/gif', GIF) } });
  assert.equal(sin.status, 400); assert.match(sin.datos.error, /no hay con qué convertirlo/);
});

test('aprobar en modo real avisa de cada imagen que no es JPEG, con y sin IMAGES', { skip: SALTAR }, async () => {
  for (const [env, re] of [[{ IMAGES: imagenes([]) }, /se convertirá a JPEG/], [{}, /binding IMAGES/]]) {
    const t = await montar({ env }); await subirImagen(t.r2, '2026-10/foto.png');
    await t.api('/api/contenido/config', { metodo: 'PUT', cuerpo: { modo: 'real', conductor: 'meta' } });
    const p = (await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'x', ...enPanama(t.reloj + 20 * 3600e3), texto: 'Agenda tu examen visual esta semana.', redes: ['instagram'], medios: ['2026-10/foto.png'] } })).datos.pieza;
    const ap = await t.api(`/api/contenido/piezas/${p.id}/aprobar`, { metodo: 'POST', cuerpo: {} });
    assert.match((ap.datos.avisos || []).join(' | '), re, JSON.stringify(ap.datos));
  }
});
