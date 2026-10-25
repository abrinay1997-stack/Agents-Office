// Fase 5 · revisión: una entrega que se queda «entregando» (M1), las reglas de cada red y lo cambiado tras el OK (M5), los topes de la invocación (M2/M3) y ctx.waitUntil (M4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { montar, subirImagen, enPanama } from './contenido-ayudas.mjs';
import { cadaMinuto } from '../worker/modulos/contenido.js';
import { manejar } from '../worker/lib/rutas.js';

const MIN = 60e3, H = 3600e3;
const cola = (t, id) => { const f = t.d1._db.prepare('select json from contenido_cola where pieza = ?').get(id); return f ? JSON.parse(f.json) : null; };
const doc = (t, clave) => { const f = t.d1._db.prepare('select json from docs where clave = ?').get(clave); return f ? JSON.parse(f.json) : null; };
const posts = (t, ruta) => t.stand.llamadas.filter(l => l.metodo === 'POST' && l.ruta === ruta);
const vuelta = (t, ms = 0) => { t.avanzar(ms); return cadaMinuto(t.env); };

async function real(opciones = {}) {
  const t = await montar(opciones); await subirImagen(t.r2, '2026-10/foto.jpg');
  assert.equal((await t.api('/api/contenido/config', { metodo: 'PUT', cuerpo: { modo: 'real', conductor: 'meta' } })).status, 200);
  await t.api('/api/contenido/conductor/comprobar', { metodo: 'POST', cuerpo: {} });
  return t;
}
async function aprobada(t, { redes = ['facebook'], horas = 20 } = {}) {
  const p = (await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'Examen', ...enPanama(t.reloj + horas * H), texto: 'Agenda tu examen visual esta semana.', redes, medios: ['2026-10/foto.jpg'] } })).datos.pieza;
  const ap = await t.api(`/api/contenido/piezas/${p.id}/aprobar`, { metodo: 'POST', cuerpo: {} }); assert.equal(ap.status, 200, JSON.stringify(ap.datos));
  return ap.datos.pieza;
}

test('M1 · una entrega «entregando» de más de 10 min pasa a «fallo» (no se sabe si el conductor la recibió), con aviso, y nunca se reintenta sola ni a mano', { skip: SALTAR }, async () => {
  const t = await real();
  const p = await aprobada(t);
  await vuelta(t); await vuelta(t, 2 * MIN);
  const e0 = cola(t, p.id); assert.equal(e0.estado, 'en_red');
  const fotos = posts(t, '/P1/photos').length;
  const e = { ...e0, estado: 'entregando', historial: [...e0.historial, { at: t.reloj - 11 * MIN, estado: 'entregando' }] };
  t.d1._db.prepare('update contenido_cola set json = ? where pieza = ?').run(JSON.stringify(e), p.id);
  await vuelta(t, MIN);
  const f = cola(t, p.id); assert.equal(f.estado, 'fallo'); assert.equal(f.incierto, true); assert.match(f.error, /No se sabe si el conductor/);
  assert.ok(doc(t, 'notices').some(n => /se quedó entregándose/.test(n.text)), 'avisa al dueño');
  for (let i = 0; i < 3; i++) await vuelta(t, 11 * MIN);
  assert.equal(cola(t, p.id).estado, 'fallo', 'no se reintenta sola'); assert.equal(posts(t, '/P1/photos').length, fotos, 'ni una llamada más a Meta por esta pieza');
  const r = await t.api(`/api/contenido/piezas/${p.id}/reintentar`, { metodo: 'POST', cuerpo: {} }); assert.equal(r.status, 409); assert.match(r.datos.error, /no se sabe si el conductor/);
  // un «entregando» reciente (menos de 10 min) NO se toca: la entrega puede estar en marcha
  const q = await aprobada(t, { horas: 22 }); await vuelta(t);
  const eq = cola(t, q.id); t.d1._db.prepare('update contenido_cola set json = ? where pieza = ?').run(JSON.stringify({ ...eq, estado: 'entregando', historial: [...eq.historial, { at: t.reloj - 2 * MIN, estado: 'entregando' }] }), q.id);
  await vuelta(t, MIN); assert.equal(cola(t, q.id).estado, 'entregando');
});

test('M5 · aprobar aplica las reglas de cada red (un reel de Instagram sin video: 409 con el motivo) y lo cambiado tras el OK deja de ser vigente y no se entrega', { skip: SALTAR }, async () => {
  const t = await real();
  const reel = (await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'Reel sin video', ...enPanama(t.reloj + 20 * H), texto: 'Un reel.', redes: ['instagram'], formato: 'reel', medios: ['2026-10/foto.jpg'] } })).datos.pieza;
  const r = await t.api(`/api/contenido/piezas/${reel.id}/aprobar`, { metodo: 'POST', cuerpo: {} });
  assert.equal(r.status, 409, JSON.stringify(r.datos)); assert.match(r.datos.error, /video/i);
  assert.notEqual((await t.api('/api/contenido/piezas/' + reel.id)).datos.pieza.estado, 'aprobada');
  // lo aprobado se altera por fuera (la huella ya no cuadra): no es vigente, no entra a la cola y se ve como «cambiada»
  const p = await aprobada(t);
  const fila = JSON.parse(t.d1._db.prepare('select json from contenido_piezas where id = ?').get(p.id).json); fila.texto = 'Otro texto distinto, sin OK.';
  t.d1._db.prepare('update contenido_piezas set json = ? where id = ?').run(JSON.stringify(fila), p.id);
  assert.equal((await t.api('/api/contenido/piezas/' + p.id)).datos.pieza.cambiadaTrasAprobar, true);
  await vuelta(t); await vuelta(t, 2 * MIN);
  assert.equal(cola(t, p.id), null, 'una pieza cambiada tras el OK no entra a la cola'); assert.equal(posts(t, '/P1/photos').length, 0, 'ni una llamada a Meta');
  // y cambiar lo que sale de una aprobada por la API le quita el OK
  const q = await aprobada(t, { horas: 22 });
  const g = await t.api('/api/contenido/piezas/' + q.id, { metodo: 'PATCH', cuerpo: { texto: 'Cambiado después del OK.' } }); assert.equal(g.status, 200);
  assert.notEqual(g.datos.pieza.estado, 'aprobada'); assert.equal(g.datos.pieza.aprobada ?? null, null);
});

test('M2 · una vuelta se corta por el tope de acciones y vuelve a seguir en la próxima: nada se pierde ni se hace dos veces', { skip: SALTAR }, async () => {
  const t = await real({ env: { CONTENIDO_MAX_ACCIONES: '2' } });
  const ps = []; for (let i = 0; i < 5; i++) ps.push(await aprobada(t, { horas: 20 + i }));
  await vuelta(t);                       // encola (las acciones cuentan una a una: solo 2 por vuelta)
  const encoladas = () => ps.filter(p => cola(t, p.id)).length;
  assert.equal(encoladas(), 2, 'solo 2 acciones en esta vuelta');
  for (let i = 0; i < 8; i++) await vuelta(t, 2 * MIN);
  assert.equal(ps.filter(p => cola(t, p.id)?.estado === 'en_red').length, 5, 'las 5 llegaron, vuelta a vuelta');
  assert.equal(posts(t, '/P1/photos').length, 5, 'cada una se programó UNA vez');
});

test('M2 · con el tope de sentencias de D1 muy bajo, la vuelta no se pasa: corta y lo que falta sigue después', { skip: SALTAR }, async () => {
  const t = await real({ env: { CONTENIDO_MAX_CONSULTAS: '14' } });
  const ps = []; for (let i = 0; i < 4; i++) ps.push(await aprobada(t, { horas: 20 + i }));
  let conteo = 0; const base = t.env.DB; // cuenta lo que llega a D1 en UNA vuelta
  t.env.DB = { ...base, prepare: sql => { const s = base.prepare(sql); const mk = (x) => ({ ...x, bind: (...a) => mk(x.bind(...a)), first: (...a) => { conteo++; return x.first(...a); }, all: (...a) => { conteo++; return x.all(...a); }, run: (...a) => { conteo++; return x.run(...a); } }); return mk(s); }, batch: l => { conteo += l.length; return base.batch(l); } };
  await vuelta(t); assert.ok(conteo <= 26, `una vuelta con tope 14 no se desboca (${conteo})`);
  const antes = conteo; await vuelta(t, MIN); assert.ok(conteo > antes);
  t.env.DB = base;
  for (let i = 0; i < 12; i++) await vuelta(t, 2 * MIN);
  assert.equal(ps.filter(p => cola(t, p.id)?.estado === 'en_red').length, 4, 'con el tiempo todo entra');
});

test('M3 · Analíticas: una cuenta por vuelta del cron; «Actualizar» a mano hace las que caben, sin empezar una que no cabe entera', { skip: SALTAR }, async () => {
  const t = await real();
  await t.api('/api/contenido/meta/sincronizar', { metodo: 'POST', cuerpo: {} });
  const hora = t.reloj; t.ir(new Date(`${enPanama(hora).fecha}T09:00:00-05:00`).getTime() + 86400e3); // pasadas las 6:00 de la oficina
  const dias = () => t.d1._db.prepare('select count(*) n from contenido_dias').get().n;
  await cadaMinuto(t.env); assert.equal(dias(), 1, 'una cuenta en esta vuelta');
  await cadaMinuto(t.env); assert.equal(dias(), 2, 'la otra, en la siguiente');
  // con el tope de llamadas muy bajo, «Actualizar» no empieza una cuenta que no cabe entera
  const t2 = await real({ env: { CONTENIDO_MAX_LLAMADAS: '25' } }); await t2.api('/api/contenido/meta/sincronizar', { metodo: 'POST', cuerpo: {} });
  const a = await t2.api('/api/contenido/analiticas/actualizar', { metodo: 'POST', cuerpo: {} }); assert.equal(a.status, 202);
  assert.equal(a.datos.hechas, 0, JSON.stringify(a.datos));
});

test('B1 · el reloj de la oficina: una fecha inválida sigue siendo «Invalid Date» (NaN), nunca una excepción ni una hora inventada', async () => {
  const { conZona } = await import('../worker/lib/zona.js');
  await conZona('America/Panama', async () => {
    for (const d of [new Date(NaN), new Date('no es una fecha'), new Date(NaN, 1, 1), new Date(2026, NaN, 1), new Date(2026, 9, undefined, NaN)]) {
      assert.ok(Number.isNaN(d.getTime()), String(d));
      for (const f of ['getFullYear', 'getMonth', 'getDate', 'getDay', 'getHours', 'getMinutes', 'getTimezoneOffset']) assert.ok(Number.isNaN(d[f]()), f);
      assert.ok(Number.isNaN(d.setHours(5)), 'poner la hora a una fecha inválida sigue inválida'); assert.equal(String(d), 'Invalid Date');
    }
    const ok = new Date('2026-10-30T09:00'); assert.equal(ok.getHours(), 9); assert.equal(ok.toISOString(), '2026-10-30T14:00:00.000Z');
  });
});

test('B4 · aprobar un PNG para Instagram sin el binding IMAGES avisa en ese momento (no a la hora de salir)', { skip: SALTAR }, async () => {
  const t = await real();
  await t.r2.put('2026-10/grafico.png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(30).fill(1)])); await t.r2.put('2026-10/grafico.json', JSON.stringify({ kind: 'image', w: 1080, h: 1350 }));
  const p = (await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'PNG', ...enPanama(t.reloj + 20 * H), texto: 'Un gráfico.', redes: ['instagram'], medios: ['2026-10/grafico.png'] } })).datos.pieza;
  const ap = await t.api(`/api/contenido/piezas/${p.id}/aprobar`, { metodo: 'POST', cuerpo: {} }); assert.equal(ap.status, 200, JSON.stringify(ap.datos));
  assert.ok(ap.datos.avisos.some(a => /JPEG.*IMAGES|IMAGES/.test(a)), JSON.stringify(ap.datos.avisos));
  const q = await aprobada(t); assert.ok(!(q.avisos || []).length);
});

test('M4 · con ctx.waitUntil, «Entregar ya» contesta sin esperar la vuelta: el trabajo sigue detrás y al terminar vacía lo pendiente', { skip: SALTAR }, async () => {
  const t = await real();
  const p = await aprobada(t, { horas: 2 }); await vuelta(t); await vuelta(t, 2 * MIN);
  const enSegundoPlano = []; const exec = { waitUntil: x => enSegundoPlano.push(x) };
  const res = await manejar(new Request(`https://oficina.test/api/contenido/piezas/${p.id}/quitar`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: t.cookie }, body: '{}' }), t.env, exec);
  assert.equal(res.status, 200, await res.clone().text());
  assert.ok(enSegundoPlano.length >= 1, 'la vuelta quedó detrás de la respuesta (ctx.waitUntil)');
  await Promise.all(enSegundoPlano);
  assert.ok(cola(t, p.id) == null || cola(t, p.id).estado === 'cancelada', 'y el trabajo terminó');
});
