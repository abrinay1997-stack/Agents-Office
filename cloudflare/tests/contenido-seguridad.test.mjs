// Fase 5 · revisión: los candados contra publicar DOS VECES y contra quedarse a medias, con fallos de D1 provocados a propósito (contra el Meta de mentira de la raíz).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { montar, subirImagen, enPanama } from './contenido-ayudas.mjs';
import { cadaMinuto } from '../worker/modulos/contenido.js';

const MIN = 60e3, H = 3600e3;
const cola = (t, id) => { const f = t.d1._db.prepare('select json from contenido_cola where pieza = ?').get(id); return f ? JSON.parse(f.json) : null; };
const doc = (t, clave) => { const f = t.d1._db.prepare('select json from docs where clave = ?').get(clave); return f ? JSON.parse(f.json) : null; };
const posts = (t, ruta) => t.stand.llamadas.filter(l => l.metodo === 'POST' && l.ruta === ruta);
const vuelta = (t, ms = 0) => { t.avanzar(ms); return cadaMinuto(t.env); };

async function real(conductor = 'meta', opciones = {}) {
  const t = await montar(opciones); await subirImagen(t.r2, '2026-10/foto.jpg');
  assert.equal((await t.api('/api/contenido/config', { metodo: 'PUT', cuerpo: { modo: 'real', conductor } })).status, 200);
  return t;
}
async function aprobada(t, { redes = ['facebook'], horas = 20, extra = {} } = {}) {
  const p = (await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'Examen', ...enPanama(t.reloj + horas * H), texto: 'Agenda tu examen visual esta semana.', redes, medios: ['2026-10/foto.jpg'], ...extra } })).datos.pieza;
  const ap = await t.api(`/api/contenido/piezas/${p.id}/aprobar`, { metodo: 'POST', cuerpo: {} }); assert.equal(ap.status, 200, JSON.stringify(ap.datos));
  return ap.datos.pieza;
}
/** Hace fallar toda escritura de D1 que cumpla `cuando(sql, args)` mientras `estado.activo`. */
function romperD1(t, cuando) {
  const real = t.env.DB, estado = { activo: false, fallos: 0 };
  const envolver = (sent, sql) => ({ ...sent, bind: (...a) => envolver(sent.bind(...a), sql, a), run: async () => { throw new Error('D1 no contestó'); }, _a: [] });
  t.env.DB = { ...real, prepare: sql => { const s = real.prepare(sql); const mk = (x, args) => ({ ...x, bind: (...a) => mk(x.bind(...a), a), run: async () => { if (estado.activo && cuando(sql, args)) { estado.fallos++; throw new Error('D1 no contestó'); } return x.run(); } }); return mk(s, []); } };
  return estado;
}

test('A1 · Facebook: si la escritura de la agenda falla justo DESPUÉS del POST, no se vuelve a mandar (1 solo POST tras varias vueltas)', { skip: SALTAR }, async () => {
  const t = await real('meta'); await t.api('/api/contenido/conductor/comprobar', { metodo: 'POST', cuerpo: {} });
  const p = await aprobada(t, { redes: ['facebook'] });
  const rotura = romperD1(t, (sql, args) => args.includes('contenido.meta.agenda') && String(args.find(x => typeof x === 'string' && x.startsWith('{')) || '').includes('"remoto":{'));
  await vuelta(t); // la cola gracia
  rotura.activo = true;
  await vuelta(t, 2 * MIN).catch(() => {}); // entrega y programa en Facebook: el POST sale y las escrituras con su respuesta fallan
  assert.equal(posts(t, '/P1/photos').length, 1, 'el POST salió una vez');
  assert.ok(rotura.fallos >= 1, 'se provocó el fallo');
  rotura.activo = false;
  for (let i = 0; i < 3; i++) await vuelta(t, 2 * MIN);
  assert.equal(posts(t, '/P1/photos').length, 1, 'NUNCA otro POST: el intento quedó apuntado antes de mandar');
  const j = Object.values(doc(t, 'contenido.meta.agenda').trabajos)[0];
  assert.equal(j.estado, 'fallo'); assert.match(j.error, /mira|página/i);
  assert.ok(cola(t, p.id), 'la cola la conoce');
});

test('A1 · Metricool: si la escritura de la cola falla tras el POST, NO se repite sola (1 solo post tras varias vueltas)', { skip: SALTAR }, async () => {
  const { levantarMetricool } = await import('../../tests/metricool-stand.mjs');
  const mc = await levantarMetricool();
  try {
    const t = await montar({ env: { ...mc.env } });
    const mundo = (u, init) => (String(u).startsWith(mc.base) ? fetch(u, init) : t.env.AO_FETCH0(u, init));
    t.env.AO_FETCH0 = t.env.AO_FETCH; t.env.AO_FETCH = mundo; await subirImagen(t.r2, '2026-10/foto.jpg');
    assert.equal((await t.api('/api/contenido/config', { metodo: 'PUT', cuerpo: { modo: 'real', conductor: 'metricool' } })).status, 200);
    const p = await aprobada(t, { redes: ['facebook'], horas: 12 });
    const rotura = romperD1(t, (sql, args) => /contenido_cola/.test(sql) && args.some(x => typeof x === 'string' && x.includes('"remoto":{"')));
    await vuelta(t); rotura.activo = true;
    await vuelta(t, 2 * MIN).catch(() => {});
    assert.equal(mc.posts.size, 1, 'el POST salió una vez'); assert.ok(rotura.fallos >= 1, 'se provocó el fallo');
    rotura.activo = false;
    for (let i = 0; i < 4; i++) await vuelta(t, 11 * MIN);
    assert.equal(mc.posts.size, 1, 'no hubo un segundo POST a Metricool');
    const e = cola(t, p.id); assert.equal(e.estado, 'fallo', JSON.stringify(e)); assert.match(e.error, /No se sabe/);
    const r = await t.api(`/api/contenido/piezas/${p.id}/reintentar`, { metodo: 'POST', cuerpo: {} }); assert.equal(r.status >= 400, true, 'reintentar a mano tampoco la repite');
  } finally { await mc.cerrar(); }
});
