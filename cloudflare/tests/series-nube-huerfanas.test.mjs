// Series en la nube, N6: las líneas HUÉRFANAS del libro (una línea reservada o en duda que ninguna serie lleva) y cómo las decide un administrador con un segundo clic que trae la cifra.
// Sin dependencia de la hora del día: el reloj del generador es un número que el test mueve; las pruebas por HTTP usan líneas con la edad escrita a mano.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';
import { crearR2 } from './r2-memoria.mjs';
import { manejar } from '../worker/lib/rutas.js';
import { guardarDoc } from '../worker/lib/almacen.js';
import { instalarZona } from '../worker/lib/zona.js';
import { serializarBiblia } from '../../biblia-core.mjs';
import { crearAlmacenD1 } from '../worker/lib/series/almacen.js';
import { proponer } from '../worker/lib/series/propuesta.js';
import { crearGenerador, depsReales, idDeTrabajo, GRACIA_MS } from '../worker/lib/series/generar.js';
import * as L from '../worker/lib/series/libro.js';
import { claveIdempotencia, usd2u } from '../../serie-core.mjs';

const BIB = { tono: 'cálido y sencillo', luz: 'luz natural', composicion: 'producto centrado', nunca: ['neón'], paleta: [{ rol: 'primario', hex: '#336699' }] };
const plano = (i) => ({ descripcion: `plano ${i}`, prompt: `un sofá gris en una sala luminosa, vista ${i}`, modelo: 'prueba' });
const BRIEF = { titulo: 'Sala de verano', objetivo: 'mostrar el sofá', formato: 'carrusel' };
const T0 = 1_900_000_000_000, DIA = '2026-10-30';

/** Una D1 que se «corta» en la escritura número k (el Worker muere justo después de la sentencia k). */
function conCorte(base) {
  const est = { n: 0, k: null };
  const envolver = (sent) => ({ bind: (...a) => envolver(sent.bind(...a)), first: (...a) => sent.first(...a), all: (...a) => sent.all(...a), run: async (...a) => { if (est.k != null && ++est.n > est.k) { est.k = null; throw new Error('corte simulado'); } return sent.run(...a); } });
  return { prepare: (sql) => envolver(base.prepare(sql)), batch: base.batch, _db: base._db, armar(k) { est.n = 0; est.k = k; }, desarmar() { est.k = null; } };
}

async function montar({ cfg = { dimitri: { seriesNube: true } } } = {}) {
  instalarZona('America/Panama');
  const base = crearD1(), admin = await sembrar(base), admin2 = await sembrar(base, { email: 'otro@panaclaw.test', rol: 'admin' }), editor = await sembrar(base, { email: 'ed@panaclaw.test', rol: 'editor' }), lectura = await sembrar(base, { email: 'le@panaclaw.test', rol: 'lectura' });
  const nada = async () => new Response('{"error":"sin red en las pruebas"}', { status: 500 });
  const d1 = conCorte(base), env = { ...envDePrueba(d1, { __pruebas: { fetchIA: nada, fetch: nada } }), MEDIA: crearR2() };
  if (cfg) await guardarDoc(d1, 'config-local', cfg);
  base._db.prepare('insert or replace into notas (nombre, grupo, oficina, texto, bytes, actualizado) values (?,?,?,?,?,?)').run('biblia-visual', 'Marca', 0, serializarBiblia(BIB, { version: 1, estado: 'aprobada', aprobada_por: 'dueño' }), 100, 1);
  const uid = (email) => base._db.prepare('select id from users where email = ?').get(email).id;
  const u = Object.fromEntries([['admin', admin], ['admin2', admin2], ['editor', editor], ['lectura', lectura]].map(([k, x]) => [k, { id: uid(x.email), email: x.email, rol: x.email.startsWith('ed@') ? 'editor' : x.email.startsWith('le@') ? 'lectura' : 'admin' }]));
  const reloj = { t: T0 }, almacen = crearAlmacenD1(d1);
  const gen = (extra = {}) => crearGenerador(env, d1, { ...depsReales(env, d1), ahora: () => reloj.t, dia: () => DIA, ...extra });
  const nuevaSerie = async (n = 3) => { const r = await proponer(env, d1, { brief: BRIEF, planos: Array.from({ length: n }, (_, i) => plano(i + 1)), guardar: true }, { almacen }); assert.equal(r.estado, 200); return r.cuerpo.guardada.id; };
  const q = (sql, ...a) => base._db.prepare(sql).all(...a);
  const linea = (clave) => q('select * from series_libro where clave = ?', clave)[0];
  const reservar = (id, n, intento, { maxMicro = 500_000, ahora = reloj.t } = {}) => L.reservar(d1, { clave: claveIdempotencia(id, n, intento), serieId: id, n, intento, maxMicro, topeSerieMicro: 10_000_000, mes: '2026-10', dia: DIA, carrusel: true, topeMesMicro: 45_000_000, peso: 1, cupoDiaPeso: 0, ahora });
  const autorizar = async (g, id, quien = u.admin) => { const p = await g.presupuesto({ id, modo: 'muestra', usuario: quien }); assert.equal(p.estado, 200); const c = p.cuerpo.confirmar; const r = await g.generar({ id, confirmacion: c.token, costoMostradoUsd: c.costoMostradoUsd, modo: 'muestra', usuario: quien, idem: `idem-${Math.random().toString(36).slice(2, 10)}x` }); assert.equal(r.estado, 200); };
  /** los dos clics: pedir (texto + token) y confirmar */
  const decidir = async (g, clave, cobro, realUsd, quien = u.admin) => {
    const a = await g.resolverHuerfana({ clave, cobro, realUsd, usuario: quien }); if (a.estado !== 200) return { a };
    return { a, b: await g.resolverHuerfana({ clave, cobro, realUsd, confirmacion: a.cuerpo.confirmar.token, usuario: quien }) };
  };
  return { d1, base, env, u, reloj, gen, almacen, nuevaSerie, q, linea, reservar, autorizar, decidir };
}

test('N6 puro: esHuerfana — sin serie sí; plano en el aire con ese intento no; paso sin terminar no; paso final con línea viva sí; líneas ya decididas nunca', () => {
  const l = { clave: 's:1:1', n: 1, intento: 1, estado: 'reservado' };
  assert.equal(L.esHuerfana(null, l), true);
  assert.equal(L.esHuerfana({ escaleta: [{ n: 1, estado: 'corriendo', intento_actual: 1 }], pasos: {} }, l), false, 'su plano la lleva');
  assert.equal(L.esHuerfana({ escaleta: [{ n: 1, estado: 'corriendo', intento_actual: 2 }], pasos: {} }, l), true, 'el plano ya va por otro intento');
  assert.equal(L.esHuerfana({ escaleta: [{ n: 1, estado: 'previsto' }], pasos: { 's:1:1': { estado: 'marcado' } } }, l), false, 'el paso de la serie aún no terminó');
  assert.equal(L.esHuerfana({ escaleta: [{ n: 1, estado: 'previsto' }], pasos: { 's:1:1': { estado: 'liberado' } } }, l), true, 'el paso terminó pero la línea quedó viva');
  assert.equal(L.esHuerfana({ escaleta: [{ n: 1, estado: 'previsto' }], pasos: {} }, l), true);
  for (const estado of ['liquidado', 'liberado']) assert.equal(L.esHuerfana(null, { ...l, estado }), false);
  assert.equal(L.esHuerfana({ escaleta: 'x' }, l), true);
});

test('N6: una huérfana CREADA POR UN CORTE entre reservar y soltar (la serie se borra) se decide con dos clics — «no cobró» libera, y los topes vuelven', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(3), g = o.gen();
  await o.autorizar(g, id);
  o.d1.armar(3); // el candado, marcar y reservar entran; la confirmación posterior «se corta»
  await assert.rejects(g.tick(), /corte simulado/); o.d1.desarmar();
  const clave = claveIdempotencia(id, 1, 1), l0 = o.linea(clave);
  assert.equal(l0.estado, 'reservado', 'la reserva quedó viva');
  assert.equal((await L.resumenDeSerie(o.d1, id)).reservado, l0.max_micro);
  // mientras la serie existe y su plano la lleva, NO es huérfana
  assert.deepEqual(await (await o.gen().huerfanas({ usuario: o.u.admin })).cuerpo.huerfanas, []);
  // el restablecimiento (la carrera de la guardia) se lleva la serie
  o.base._db.prepare('delete from series').run();
  const listada = (await g.huerfanas({ usuario: o.u.admin })).cuerpo.huerfanas; assert.equal(listada.length, 1); assert.equal(listada[0].serieExiste, false); assert.equal(listada[0].madura, false, 'recién reservada: aún no se puede decidir');
  const pronto = await g.resolverHuerfana({ clave, cobro: false, usuario: o.u.admin }); assert.equal(pronto.estado, 409); assert.equal(pronto.cuerpo.codigo, 'reciente');
  o.reloj.t += GRACIA_MS + 1000;
  const { a, b } = await o.decidir(g, clave, false);
  assert.equal(a.estado, 200); assert.equal(a.cuerpo.gasta, false); assert.match(a.cuerpo.confirmar.texto, /motor gratis.*US\$0.*No se puede deshacer/);
  assert.equal(b.estado, 200, JSON.stringify(b.cuerpo)); assert.equal(o.linea(clave).estado, 'liberado');
  assert.equal((await L.resumenDeSerie(o.d1, id)).reservado, 0, 'ya no cuenta contra ningún tope');
  const ev = o.q("select detalle from auditoria where tipo = 'serie'").map((f) => JSON.parse(f.detalle)).find((x) => x.accion === 'resolver_huerfana');
  assert.ok(ev && ev.clave === clave && ev.cobro === false && ev.antes === 'reservado', 'auditada');
  assert.equal((await g.resolverHuerfana({ clave, cobro: false, usuario: o.u.admin })).estado, 409, 'ya decidida: no se vuelve a decidir');
});

test('N6: una huérfana «incierta» (la barrió el barrido diario) se decide «sí cobró» con la cifra real, y la cifra del texto es la que se anota', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(3), g = o.gen();
  await o.reservar(id, 1, 1);
  o.base._db.prepare('delete from series').run();
  assert.deepEqual(await L.barrerHuerfanas(o.d1), { liberadas: 0, inciertas: 1, pendientes: 0 });
  const clave = claveIdempotencia(id, 1, 1); assert.equal(o.linea(clave).estado, 'incierto');
  assert.equal((await L.resumenDeSerie(o.d1, id)).incierto, 500_000, 'sigue contando contra los topes');
  const { a, b } = await o.decidir(g, clave, true, 0.45);
  assert.match(a.cuerpo.confirmar.texto, /SÍ se cobró/); assert.match(a.cuerpo.confirmar.texto, /US\$0\.45/); assert.equal(a.cuerpo.confirmar.cifraUsd, 0.45);
  assert.equal(b.estado, 200); const l = o.linea(clave); assert.equal(l.estado, 'liquidado'); assert.equal(l.real_micro, 450_000); assert.equal(l.excedio, 0);
  assert.equal((await L.resumenDeSerie(o.d1, id)).gastado, 450_000);
  // sin cifra: se anota todo lo reservado y el texto lo dice
  await o.reservar(id, 2, 1); await L.marcarIncierto(o.d1, claveIdempotencia(id, 2, 1));
  const c2 = claveIdempotencia(id, 2, 1), r2 = await o.decidir(g, c2, true); assert.match(r2.a.cuerpo.confirmar.texto, /todo lo que estaba reservado/); assert.equal(r2.b.estado, 200); assert.equal(o.linea(c2).real_micro, 500_000);
});

test('N6: serie que existe pero cuyo plano ya no apunta a la línea (paso liberado, línea viva) también es huérfana; la que lleva su serie NO se decide por aquí', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(3), g = o.gen();
  await o.reservar(id, 1, 1); const clave = claveIdempotencia(id, 1, 1);
  await o.almacen.actualizar(id, (y) => { y.intentos[1] = 1; y.pasos[clave] = { n: 1, intento: 1, estado: 'marcado' }; return y; });
  const no = await g.resolverHuerfana({ clave, cobro: false, usuario: o.u.admin }); assert.equal(no.estado, 409); assert.equal(no.cuerpo.codigo, 'no_huerfana', 'su serie todavía la lleva');
  assert.equal((await g.huerfanas({ usuario: o.u.admin })).cuerpo.huerfanas.length, 0);
  await o.almacen.actualizar(id, (y) => { y.pasos[clave].estado = 'liberado'; return y; });
  o.reloj.t += GRACIA_MS + 1;
  const h = (await g.huerfanas({ usuario: o.u.admin })).cuerpo.huerfanas; assert.equal(h.length, 1); assert.equal(h[0].serieExiste, true); assert.equal(h[0].titulo, 'Sala de verano');
  assert.equal((await o.decidir(g, clave, false)).b.estado, 200);
});

test('N6 segundo clic: sin token, token de otra decisión, de otra cuenta, vencido, reusado, o con la serie cambiada → 409 y la línea no se toca', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(3), g = o.gen(), clave = claveIdempotencia(id, 1, 1);
  await o.reservar(id, 1, 1); await L.marcarIncierto(o.d1, clave); o.base._db.prepare('delete from series').run();
  const quieta = () => assert.equal(o.linea(clave).estado, 'incierto');
  const pide = async (cobro, real, quien = o.u.admin) => (await g.resolverHuerfana({ clave, cobro, realUsd: real, usuario: quien })).cuerpo.confirmar.token;
  assert.equal((await g.resolverHuerfana({ clave, cobro: false, confirmacion: 'inventado1234', usuario: o.u.admin })).estado, 409); quieta();
  const t1 = await pide(false);
  assert.equal((await g.resolverHuerfana({ clave, cobro: true, realUsd: 0, confirmacion: t1, usuario: o.u.admin })).estado, 409, 'el token era de «no cobró»'); quieta();
  const t2 = await pide(true, 0.3);
  assert.equal((await g.resolverHuerfana({ clave, cobro: true, realUsd: 0.4, confirmacion: t2, usuario: o.u.admin })).estado, 409, 'otra cifra'); quieta();
  const t3 = await pide(false);
  assert.equal((await g.resolverHuerfana({ clave, cobro: false, confirmacion: t3, usuario: o.u.admin2 })).estado, 409, 'otra cuenta'); quieta();
  const t4 = await pide(false); o.reloj.t += 130_000;
  const v = await g.resolverHuerfana({ clave, cobro: false, confirmacion: t4, usuario: o.u.admin }); assert.equal(v.estado, 409); assert.match(v.cuerpo.error, /venció|ya no vale/); quieta();
  const t5 = await pide(false);
  const [x, y] = await Promise.all([g.resolverHuerfana({ clave, cobro: false, confirmacion: t5, usuario: o.u.admin }), g.resolverHuerfana({ clave, cobro: false, confirmacion: t5, usuario: o.u.admin })]);
  assert.deepEqual([x.estado, y.estado].sort(), [200, 409], 'dos clics a la vez con el mismo token: solo uno decide');
  assert.equal(o.linea(clave).estado, 'liberado');
  // la serie reaparece con otra versión entre los dos clics → no vale
  const o2 = await montar(), id2 = await o2.nuevaSerie(3), g2 = o2.gen(), c2 = claveIdempotencia(id2, 1, 1);
  await o2.reservar(id2, 1, 1); await L.marcarIncierto(o2.d1, c2);
  await o2.almacen.actualizar(id2, (z) => { z.intentos[1] = 1; z.pasos[c2] = { n: 1, intento: 1, estado: 'liberado' }; return z; });
  const tok = (await g2.resolverHuerfana({ clave: c2, cobro: false, usuario: o2.u.admin })).cuerpo.confirmar.token;
  await o2.almacen.actualizar(id2, (z) => ({ ...z, pausa_motivo: 'cambió' }));
  assert.equal((await g2.resolverHuerfana({ clave: c2, cobro: false, confirmacion: tok, usuario: o2.u.admin })).estado, 409); assert.equal(o2.linea(c2).estado, 'incierto');
});

test('N6 CAS de dinero: la sentencia sola — un trabajo en el aire, una línea reciente, una serie cambiada o un estado distinto al leído no se deciden', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(3), clave = claveIdempotencia(id, 1, 1);
  await o.reservar(id, 1, 1); o.base._db.prepare('delete from series').run();
  const l = o.linea(clave), ok = { antesDeMs: o.reloj.t + 1, trabajoId: idDeTrabajo(clave) };
  // línea reciente (reservada después del corte de edad)
  assert.equal((await L.resolverHuerfana(o.d1, l, false, 0, { ...ok, antesDeMs: o.reloj.t - 1 })).ok, false, 'reciente');
  // un trabajo en el aire con su id
  o.base._db.prepare("insert into estudio_trabajos (id, json, estado, at) values (?, '{}', 'running', 1)").run(idDeTrabajo(clave));
  assert.equal((await L.resolverHuerfana(o.d1, l, false, 0, ok)).ok, false, 'su trabajo va en el aire'); assert.equal(o.linea(clave).estado, 'reservado');
  o.base._db.prepare("update estudio_trabajos set estado = 'done' where id = ?").run(idDeTrabajo(clave));
  // el estado que se leyó ya no es el real
  assert.equal((await L.resolverHuerfana(o.d1, { ...l, estado: 'incierto' }, false, 0, ok)).ok, false, 'estado distinto al leído');
  // una serie que reapareció (con versión) cuando se miró sin ella
  o.base._db.prepare("insert into series (id, estado, version, json, creada, actualizada) values (?, 'previsto', 1, '{}', 1, 1)").run(id);
  assert.equal((await L.resolverHuerfana(o.d1, l, false, 0, ok)).ok, false, 'la serie apareció: ya no es huérfana');
  o.base._db.prepare('delete from series').run();
  assert.equal((await L.resolverHuerfana(o.d1, l, false, 0, ok)).ok, true, 'con el trabajo terminado y sin serie, sí');
  assert.equal(o.linea(clave).estado, 'liberado');
  // datos raros nunca llegan a la sentencia
  for (const mal of [[l, 'si', 0], [l, true, -1], [l, true, 1.5], [l, true, NaN]]) assert.equal((await L.resolverHuerfana(o.d1, ...mal.slice(0, 1), mal[1], mal[2], ok)).ok, false);
});

test('N6: cobro real inválido o mayor a lo reservado, línea inexistente, y solo un administrador (agente, editor, lectura, nadie)', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(3), g = o.gen(), clave = claveIdempotencia(id, 1, 1);
  await o.reservar(id, 1, 1); await L.marcarIncierto(o.d1, clave); o.base._db.prepare('delete from series').run();
  for (const real of [0.6, -1, Infinity, '0.2']) assert.ok([422].includes((await g.resolverHuerfana({ clave, cobro: true, realUsd: real, usuario: o.u.admin })).estado), String(real));
  assert.equal((await g.resolverHuerfana({ clave: 'no:existe:1', cobro: false, usuario: o.u.admin })).estado, 404);
  assert.equal((await g.resolverHuerfana({ clave, cobro: 'no', usuario: o.u.admin })).estado, 422);
  for (const quien of [o.u.editor, o.u.lectura, { ...o.u.admin, agente: 'ada' }, null]) {
    assert.equal((await g.resolverHuerfana({ clave, cobro: false, usuario: quien })).estado, 403); assert.equal((await g.huerfanas({ usuario: quien })).estado, 403);
  }
  assert.equal(o.linea(clave).estado, 'incierto');
});

// ---- las rutas de verdad ----
async function conRutas({ encendido = true } = {}) {
  const o = await montar({ cfg: encendido ? { dimitri: { seriesNube: true } } : null });
  const entrar = async (email) => (await pedir(manejar, o.env, '/api/acceso', { metodo: 'POST', cuerpo: { email, contrasena: 'una-clave-larga-123' } })).headers.get('set-cookie').split(';')[0]; // secrets-ok
  const cookies = { admin: await entrar('dueno@panaclaw.test'), editor: await entrar('ed@panaclaw.test'), lectura: await entrar('le@panaclaw.test'), anon: null };
  const como = (qn) => async (metodo, ruta, cuerpo) => {
    const r = await manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { 'content-type': 'application/json', ...(cookies[qn] ? { cookie: cookies[qn] } : {}) }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }), o.env, { waitUntil() {} });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, j };
  };
  return { ...o, admin: como('admin'), editor: como('editor'), lectura: como('lectura'), anon: como('anon') };
}

test('N6 rutas: matriz de roles (anon 401; editor y lectura 403, con el interruptor apagado o encendido; apagado, el administrador 501) y el ciclo completo por HTTP', { skip: SALTAR }, async () => {
  for (const encendido of [false, true]) {
    const o = await conRutas({ encendido });
    for (const [m, r] of [['GET', '/api/series/libro/huerfanas'], ['POST', '/api/series/libro/resolver']]) {
      assert.equal((await o.anon(m, r, m === 'GET' ? undefined : {})).status, 401, `anon ${r}`);
      assert.equal((await o.editor(m, r, m === 'GET' ? undefined : {})).status, 403, `editor ${r}`); assert.equal((await o.lectura(m, r, m === 'GET' ? undefined : {})).status, 403, `lectura ${r}`);
      if (!encendido) { const x = await o.admin(m, r, m === 'GET' ? undefined : {}); assert.equal(x.status, 501); assert.match(x.j.error, /apagadas/); }
    }
  }
  const o = await conRutas(), id = await o.nuevaSerie(3), clave = claveIdempotencia(id, 1, 1);
  await o.reservar(id, 1, 1, { ahora: Date.now() - 10 * 60e3 }); await L.marcarIncierto(o.d1, clave); o.base._db.prepare('delete from series').run();
  const lista = await o.admin('GET', '/api/series/libro/huerfanas'); assert.equal(lista.status, 200); assert.equal(lista.j.huerfanas[0].clave, clave); assert.equal(lista.j.huerfanas[0].estado, 'incierto');
  assert.doesNotMatch(JSON.stringify(lista.j), /token|secret/i);
  const p = await o.admin('POST', '/api/series/libro/resolver', { clave, cobro: true, realUsd: 0.25 }); assert.equal(p.status, 200); assert.equal(p.j.gasta, false); assert.equal(o.linea(clave).estado, 'incierto', 'el primer clic no cambia nada');
  assert.equal((await o.admin('POST', '/api/series/libro/resolver', { clave, cobro: true, realUsd: 0.25, confirmacion: p.j.confirmar.token })).status, 200);
  assert.equal(o.linea(clave).estado, 'liquidado'); assert.equal(o.linea(clave).real_micro, 250_000);
  assert.equal((await o.admin('GET', '/api/series/libro/huerfanas')).j.huerfanas.length, 0);
  // una serie con id parecido sigue usando sus rutas de siempre
  assert.equal((await o.admin('POST', `/api/series/${id}/resolver`, { clave, cobro: false })).status, 404);
  assert.equal((await o.admin('GET', '/api/series/libro/otra')).status, 404);
});

test('N6 estático: lo único nuevo que decide una línea huérfana es el generador, y nadie más lo nombra (ni Dimitri, ni agentes, ni MCP, ni Telegram)', async () => {
  const { readFileSync, readdirSync } = await import('node:fs'), { join } = await import('node:path'), { fileURLToPath } = await import('node:url');
  const raiz = join(fileURLToPath(import.meta.url), '../../..');
  const permitidos = new Set(['cloudflare/worker/lib/series/generar.js', 'cloudflare/worker/lib/series/libro.js', 'cloudflare/worker/modulos/series.js']);
  const visitar = (dir, fuera = []) => { for (const e of readdirSync(join(raiz, dir), { withFileTypes: true })) { const r = `${dir}/${e.name}`; if (e.isDirectory()) { if (!['node_modules', 'dist', 'tests', 'public', '.git', 'docs', 'data'].includes(e.name)) visitar(r, fuera); } else if (/\.(m?js)$/.test(e.name)) { if (/resolverHuerfana|series\/libro\/resolver/.test(readFileSync(join(raiz, r), 'utf8')) && !permitidos.has(r)) fuera.push(r); } } return fuera; };
  assert.deepEqual([...visitar('cloudflare/worker'), ...visitar('src').filter((f) => !/movil\/vistas\/series|movil\/series/.test(f))].filter((f) => !/^cloudflare\/worker\/(lib\/series|modulos\/series)/.test(f)), []);
});

test('N6 segundo clic: el token se gasta aunque la decisión no entre — repetirlo cuando el obstáculo desaparece vuelve a pedir otra confirmación', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(3), g = o.gen(), clave = claveIdempotencia(id, 1, 1);
  await o.reservar(id, 1, 1); await L.marcarIncierto(o.d1, clave); o.base._db.prepare('delete from series').run();
  o.base._db.prepare("insert into estudio_trabajos (id, json, estado, at) values (?, '{}', 'running', 1)").run(idDeTrabajo(clave));
  const tok = (await g.resolverHuerfana({ clave, cobro: false, usuario: o.u.admin })).cuerpo.confirmar.token;
  const a = await g.resolverHuerfana({ clave, cobro: false, confirmacion: tok, usuario: o.u.admin }); assert.equal(a.estado, 409); assert.equal(a.cuerpo.codigo, 'cambio', 'su trabajo va en el aire');
  o.base._db.prepare("update estudio_trabajos set estado = 'done' where id = ?").run(idDeTrabajo(clave));
  const b = await g.resolverHuerfana({ clave, cobro: false, confirmacion: tok, usuario: o.u.admin }); assert.equal(b.estado, 409); assert.equal(b.cuerpo.codigo, 'token', 'el token ya se usó'); assert.equal(o.linea(clave).estado, 'incierto');
  assert.equal((await o.decidir(g, clave, false)).b.estado, 200, 'con una confirmación nueva, sí');
});
