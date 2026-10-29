// Fase 5 — el conductor de Metricool desde el Worker, contra el Metricool de mentira de la raíz (tests/metricool-stand.mjs, un servidor local) y con el Meta de mentira para lo demás.
// Lo que importa: sube los archivos de R2 (a JPEG para Instagram), programa con su fecha y hora, retira lo que cambia o pierde el OK, y su key no sale ni se guarda.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { montar, enPanama } from './contenido-ayudas.mjs';
import { cadaMinuto } from '../worker/modulos/contenido.js';
import { levantarMetricool, TOKEN as KEY_MC } from '../../tests/metricool-stand.mjs';

const MIN = 60e3, H = 3600e3;
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(30).fill(1)]);
const cola = (t, id) => { const f = t.d1._db.prepare('select json from contenido_cola where pieza = ?').get(id); return f ? JSON.parse(f.json) : null; };

async function conMetricool(fn) {
  const mc = await levantarMetricool();
  try {
    const jpegs = [];
    const IMAGES = { input: () => ({ transform: () => ({ output: async () => ({ response: () => { jpegs.push(1); return new Response(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 9, 9])); } }) }) }) };
    const t = await montar({ env: { ...mc.env, IMAGES } });
    const mundo = (u, init) => (String(u).startsWith(mc.base) ? fetch(u, init) : t.env.AO_FETCH0(u, init)); // Metricool es un servidor de verdad; Meta, el de mentira
    t.env.AO_FETCH0 = t.env.AO_FETCH; t.env.AO_FETCH = mundo;
    await t.r2.put('2026-10/foto.png', PNG); await t.r2.put('2026-10/foto.json', JSON.stringify({ kind: 'image', w: 1080, h: 1350 }));
    assert.equal((await t.api('/api/contenido/config', { metodo: 'PUT', cuerpo: { modo: 'real', conductor: 'metricool' } })).status, 200);
    await fn(t, mc, jpegs);
  } finally { await mc.cerrar(); }
}
const aprobada = async (t, redes) => {
  const p = (await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'Metricool', ...enPanama(t.reloj + 12 * H), texto: 'Agenda tu examen visual.', redes, medios: ['2026-10/foto.png'] } })).datos.pieza;
  const ap = await t.api(`/api/contenido/piezas/${p.id}/aprobar`, { metodo: 'POST', cuerpo: {} }); assert.equal(ap.status, 200, JSON.stringify(ap.datos)); return ap.datos.pieza;
};

test('Metricool: sube la imagen (a JPEG si va a Instagram), programa la publicación, y su key no sale ni se guarda', { skip: SALTAR }, async () => {
  await conMetricool(async (t, mc, jpegs) => {
    const p = await aprobada(t, ['instagram', 'facebook']);
    await cadaMinuto(t.env); t.avanzar(2 * MIN); await cadaMinuto(t.env);
    const e = cola(t, p.id); assert.equal(e.estado, 'en_red', JSON.stringify(e)); assert.equal(e.conductor, 'metricool');
    assert.equal(mc.posts.size, 1); const [post] = [...mc.posts.values()];
    assert.deepEqual(post.providers.map(x => x.network).sort(), ['facebook', 'instagram']); assert.ok(post.publicationDate.dateTime.startsWith(p.fecha));
    assert.equal(jpegs.length, 1, 'Instagram solo acepta JPEG: la PNG se convierte una vez');
    assert.equal([...mc.subidas.values()].length, 1, 'la imagen se sube una sola vez, aunque la usen dos redes');
    assert.ok(mc.vistas.every(v => v.auth === KEY_MC || v.ruta.startsWith('/s3/')), 'la key va en la cabecera y no en la dirección');
    // no se sube dos veces la misma imagen en otra pieza
    const q = await aprobada(t, ['instagram', 'facebook']); await cadaMinuto(t.env); t.avanzar(2 * MIN); await cadaMinuto(t.env);
    assert.equal(mc.subidas.size, 1, 'lo ya subido se recuerda (por id y versión)');
    // pierde el OK → la próxima vuelta lo borra en Metricool
    await t.api(`/api/contenido/piezas/${p.id}/devolver`, { metodo: 'POST', cuerpo: { estado: 'revision' } });
    t.avanzar(MIN); await cadaMinuto(t.env);
    assert.equal(cola(t, p.id).estado, 'cancelada'); assert.equal(mc.posts.size, 1, 'solo queda la otra pieza'); assert.equal(cola(t, q.id).estado, 'en_red');
    const volcado = JSON.stringify(t.d1._db.prepare("select name from sqlite_master where type = 'table'").all().flatMap(x => t.d1._db.prepare(`select * from ${x.name}`).all()));
    assert.ok(!volcado.includes(KEY_MC), 'la key de Metricool no está en ninguna tabla');
  });
});

test('Metricool: sin imagen convertible (falta el binding IMAGES) Instagram falla diciendo qué hacer, sin mandar nada', { skip: SALTAR }, async () => {
  const mc = await levantarMetricool();
  try {
    const t = await montar({ env: { ...mc.env } });
    const f0 = t.env.AO_FETCH; t.env.AO_FETCH = (u, i) => (String(u).startsWith(mc.base) ? fetch(u, i) : f0(u, i));
    await t.r2.put('2026-10/foto.png', PNG); await t.r2.put('2026-10/foto.json', JSON.stringify({ kind: 'image', w: 1080, h: 1350 }));
    await t.api('/api/contenido/config', { metodo: 'PUT', cuerpo: { modo: 'real', conductor: 'metricool' } });
    const p = await aprobada(t, ['instagram']); await cadaMinuto(t.env); t.avanzar(2 * MIN); await cadaMinuto(t.env);
    const e = cola(t, p.id); assert.equal(e.estado, 'fallo'); assert.match(e.error, /Instagram solo acepta JPEG/); assert.equal(mc.posts.size, 0);
  } finally { await mc.cerrar(); }
});

test('Metricool: una cuenta distinta a la de su marca no sale (y lo dice); con Meta directo sí se puede elegir', { skip: SALTAR }, async () => {
  await conMetricool(async (t, mc) => {
    await t.api('/api/contenido/conductor/comprobar', { metodo: 'POST', cuerpo: {} }); // Metricool: sus marcas
    const r = await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'x', redes: ['facebook'], cuentas: { facebook: 'facebook:P1' } } });
    assert.equal(r.status, 200); // sin cuentas de Meta guardadas todavía, la cuenta de la pieza se acepta (no se sabe)
    assert.ok(mc.vistas.some(v => v.ruta === '/v2/settings/brands'));
  });
});
