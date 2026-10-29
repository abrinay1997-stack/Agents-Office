// Fase 2 (CON-04, B01-B05) en la nube: «Publicar ahora» con el Meta de mentira. Solo un administrador; apagado por defecto; sale en este minuto sin gracia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { montar, subirImagen, enPanama } from './contenido-ayudas.mjs';
import { cadaMinuto } from '../worker/modulos/contenido.js';

const H = 3600e3;
const posts = (t, ruta) => t.stand.llamadas.filter(l => l.metodo === 'POST' && l.ruta === ruta);
async function listo(opciones = {}, cfg = { modo: 'real', conductor: 'meta', publicarYa: true }) {
  const t = await montar(opciones); await subirImagen(t.r2, '2026-10/foto.jpg');
  if ((opciones.rol || 'admin') === 'admin') assert.equal((await t.api('/api/contenido/config', { metodo: 'PUT', cuerpo: cfg })).status, 200);
  await t.api('/api/contenido/conductor/comprobar', { metodo: 'POST', cuerpo: {} });
  return t;
}
const nueva = async t => (await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'Examen', ...enPanama(t.reloj + 20 * H), texto: 'Agenda tu examen visual esta semana.', redes: ['facebook'], medios: ['2026-10/foto.jpg'], estado: 'revision' } })).datos.pieza;
const ya = (t, id, cuerpo = { confirmado: true }) => t.api(`/api/contenido/piezas/${id}/publicar-ya`, { metodo: 'POST', cuerpo });

test('la config trae publicarYa apagado y solo acepta un booleano', { skip: SALTAR }, async () => {
  const t = await montar();
  assert.equal((await t.api('/api/contenido/config')).datos.config.publicarYa, false);
  assert.equal((await t.api('/api/contenido/config', { metodo: 'PUT', cuerpo: { publicarYa: 'si' } })).status, 422);
  assert.equal((await t.api('/api/contenido/config', { metodo: 'PUT', cuerpo: { publicarYa: true } })).datos.config.publicarYa, true);
});

test('apagado por defecto: 409 y la pieza no se toca', { skip: SALTAR }, async () => {
  const t = await listo({}, { modo: 'real', conductor: 'meta' });
  const p = await nueva(t); const r = await ya(t, p.id);
  assert.equal(r.status, 409); assert.match(r.datos.error, /apagado/);
  assert.equal((await t.api(`/api/contenido/piezas/${p.id}`)).datos.pieza.estado, 'revision');
});

for (const rol of ['editor', 'lectura']) {
  test(`un ${rol} no puede publicar ahora (403)`, { skip: SALTAR }, async () => {
    const t = await montar({ rol }); const r = await ya(t, 'p-20261029-abcd');
    assert.equal(r.status, 403);
  });
}

test('un administrador: 202, sale en este minuto sin esperar la gracia y una sola vez', { skip: SALTAR }, async () => {
  const t = await listo(); const p = await nueva(t);
  assert.equal((await ya(t, p.id, {})).status, 409, 'sin confirmar no se publica');
  const r = await ya(t, p.id);
  assert.equal(r.status, 202, JSON.stringify(r.datos)); assert.equal(r.datos.publicando, true);
  assert.equal(r.datos.pieza.aprobada.ya, true);
  for (let i = 0; i < 3; i++) { await cadaMinuto(t.env); t.avanzar(30e3); }
  const fotos = posts(t, '/P1/photos');
  assert.equal(fotos.length, 1, 'salió hacia Facebook exactamente una vez');
  assert.ok(!('scheduled_publish_time' in (fotos[0].campos || {})), 'sin programar: se publica en este minuto');
  assert.notEqual(String(fotos[0].campos?.published), 'false', 'published=true: sale ya');
});
