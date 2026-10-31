// Ajustes → «Funciones nuevas» (GET/POST /api/funciones): roles, catálogo de funciones-core, booleano estricto, lo «no construido», auditoría y que no pisa lo demás.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';
import { manejar } from '../worker/lib/rutas.js';
import { guardarDoc, leerDoc } from '../worker/lib/almacen.js';
import { FUNCIONES, LISTAS } from '../../funciones-core.mjs';
import { ENLACES, cambiar } from '../worker/lib/funciones.js';

async function mundo() {
  const d1 = crearD1(), env = envDePrueba(d1);
  const cuentas = { admin: await sembrar(d1), editor: await sembrar(d1, { email: 'ed@panaclaw.test', rol: 'editor' }), lectura: await sembrar(d1, { email: 'le@panaclaw.test', rol: 'lectura' }) };
  const cookies = {};
  for (const [q, c] of Object.entries(cuentas)) {
    const r = await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: c.email, contrasena: c.clave } });
    cookies[q] = r.headers.get('set-cookie').split(';')[0];
  }
  const como = (q) => async (metodo, ruta, cuerpo) => { const r = await pedir(manejar, env, ruta, { metodo, cuerpo, cookie: cookies[q] }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, j }; };
  return { d1, db: d1._db, admin: como('admin'), editor: como('editor'), lectura: como('lectura'), anon: como(null) };
}
const filaDe = (j, id) => j.funciones.find((f) => f.id === id);
const DOCS = { chat: ['chat.config', 'activo'], 'carpetas-arbol': ['estudio.config', 'carpetasArbol'], 'lotes-nube': ['estudio.config', 'lotesNube'] };
const CFG = { 'sesion-deslizante': ['sesion', 'deslizante'], 'acceso-retroceso': ['acceso', 'retroceso'], 'series-nube': ['dimitri', 'seriesNube'] };

test('el panel no ofrece gasto de pago ni nada con pinta de secreto', () => {
  assert.doesNotMatch(JSON.stringify(ENLACES), /seriesNubePago|serieGenerar|serieVision/i);
  for (const f of LISTAS) assert.ok(!/pago|token|secret|clave|key/i.test(f.id), f.id);
});

test('roles: anónimo 401; editor y lectura 403 antes de mirar nada (GET y POST); el admin lee y todo empieza apagado', { skip: SALTAR }, async () => {
  const m = await mundo();
  assert.equal((await m.anon('GET', '/api/funciones')).status, 401);
  const antes = m.db.prepare('select total_changes() c').get().c;
  for (const q of ['editor', 'lectura']) {
    assert.equal((await m[q]('GET', '/api/funciones')).status, 403);
    assert.equal((await m[q]('POST', '/api/funciones', { id: 'chat', activo: true })).status, 403);
    assert.equal((await m[q]('POST', '/api/funciones', 'basura')).status, 403);
  }
  assert.equal(m.db.prepare('select total_changes() c').get().c, antes, 'nada se escribió');
  const g = await m.admin('GET', '/api/funciones');
  assert.equal(g.status, 200);
  assert.deepEqual(g.j.funciones.map((f) => f.id), FUNCIONES.map((f) => f.id));
  for (const f of g.j.funciones) assert.equal(f.activa, false, `${f.id} empieza como hoy`);
  assert.deepEqual(g.j.enlaces.map((e) => e.id), ENLACES.map((e) => e.id));
});

test('lista cerrada y booleano estricto: lo demás es 422 y no escribe', { skip: SALTAR }, async () => {
  const m = await mundo();
  const antes = m.db.prepare('select total_changes() c').get().c;
  for (const cuerpo of [{ id: 'dimitri.seriesNubePago', activo: true }, { id: 'hooks-token', activo: true }, { id: '__proto__', activo: true }, {}, { id: 'chat' },
    { id: 'chat', activo: 'true' }, { id: 'chat', activo: 1 }, { id: 'chat', activo: null }, { id: ['chat'], activo: true }, { id: 'dominios-conector', activo: true }]) {
    assert.equal((await m.admin('POST', '/api/funciones', cuerpo)).status, 422, JSON.stringify(cuerpo));
  }
  assert.equal(m.db.prepare('select total_changes() c').get().c, antes);
});

test('lo «no construido» no se enciende (409 con el porqué) pero apagar siempre se puede', { skip: SALTAR }, async () => {
  const m = await mundo();
  for (const id of ['retoques-nube', 'series-nube-pago']) {
    const r = await m.admin('POST', '/api/funciones', { id, activo: true });
    assert.equal(r.status, 409, id); assert.ok(r.j.error.length > 30);
    const f = filaDe((await m.admin('GET', '/api/funciones')).j, id);
    assert.equal(f.lista, false); assert.ok(f.porque);
    assert.equal((await m.admin('POST', '/api/funciones', { id, activo: false })).status, 200);
  }
  await guardarDoc(m.d1, 'estudio.config', { retoquesNube: true, dailyLimit: 5 });
  assert.equal(filaDe((await m.admin('GET', '/api/funciones')).j, 'retoques-nube').activa, true);
  assert.equal((await m.admin('POST', '/api/funciones', { id: 'retoques-nube', activo: false })).j.cambio, true);
  assert.deepEqual((await leerDoc(m.d1, 'estudio.config', {})).valor, { retoquesNube: false, dailyLimit: 5 });
});

test('cada interruptor se escribe donde el catálogo dice, se refleja en GET, lo lee su función y se apaga', { skip: SALTAR }, async () => {
  const m = await mundo();
  for (const [id, [doc, clave]] of Object.entries(DOCS)) {
    const r = await m.admin('POST', '/api/funciones', { id, activo: true });
    assert.equal(r.status, 200, id); assert.equal(r.j.cambio, true);
    assert.equal((await leerDoc(m.d1, doc, {})).valor[clave], true, id);
    assert.equal(filaDe(r.j, id).activa, true);
  }
  for (const [id, [a, b]] of Object.entries(CFG)) {
    assert.equal((await m.admin('POST', '/api/funciones', { id, activo: true })).status, 200, id);
    for (const doc of ['config-local', 'ajustes']) assert.equal((await leerDoc(m.d1, doc, {})).valor[a][b], true, `${id} en ${doc}`);
  }
  assert.equal((await m.admin('GET', '/api/chat/config')).j.activo, true);
  assert.equal((await m.admin('GET', '/api/media/limites')).j.limites.lotesNube, true);
  assert.equal(m.db.prepare("select count(*) n from chat_miembros where canal_id = 'general'").get().n, 3, 'las cuentas quedan en #general');
  for (const f of LISTAS) assert.equal((await m.admin('POST', '/api/funciones', { id: f.id, activo: false })).status, 200, f.id);
  for (const f of (await m.admin('GET', '/api/funciones')).j.funciones) assert.equal(f.activa, false, f.id);
});

test('no pisa lo demás: otras claves de config-local, ajustes y estudio.config se conservan', { skip: SALTAR }, async () => {
  const m = await mundo();
  await guardarDoc(m.d1, 'config-local', { costs: { monthlyBudget: 77 }, sesion: { otra: 'x' }, dimitri: { seriesNubePago: false, name: 'D' } });
  await guardarDoc(m.d1, 'ajustes', { approvals: { undoSeconds: 11 } });
  await guardarDoc(m.d1, 'estudio.config', { dailyLimit: 12, models: { x: 1 } });
  for (const id of ['sesion-deslizante', 'series-nube', 'lotes-nube']) await m.admin('POST', '/api/funciones', { id, activo: true });
  const cl = (await leerDoc(m.d1, 'config-local', {})).valor;
  assert.equal(cl.costs.monthlyBudget, 77); assert.equal(cl.sesion.otra, 'x'); assert.equal(cl.sesion.deslizante, true);
  assert.equal(cl.dimitri.seriesNubePago, false); assert.equal(cl.dimitri.name, 'D'); assert.equal(cl.dimitri.seriesNube, true);
  assert.equal((await leerDoc(m.d1, 'ajustes', {})).valor.approvals.undoSeconds, 11);
  const e = (await leerDoc(m.d1, 'estudio.config', {})).valor; assert.equal(e.dailyLimit, 12); assert.deepEqual(e.models, { x: 1 }); assert.equal(e.lotesNube, true);
});

test('auditoría: quién, cuál, de qué a qué; un cambio sin efecto no deja fila', { skip: SALTAR }, async () => {
  const m = await mundo();
  await m.admin('POST', '/api/funciones', { id: 'carpetas-arbol', activo: true });
  assert.equal((await m.admin('POST', '/api/funciones', { id: 'carpetas-arbol', activo: true })).j.cambio, false);
  await m.admin('POST', '/api/funciones', { id: 'carpetas-arbol', activo: false });
  const filas = m.db.prepare("select quien, detalle from auditoria where tipo = 'funciones' order by rowid").all();
  assert.equal(filas.length, 2); assert.equal(filas[0].quien, 'dueno@panaclaw.test');
  assert.deepEqual(JSON.parse(filas[0].detalle), { id: 'carpetas-arbol', de: 'apagada', a: 'encendida' });
  assert.deepEqual(JSON.parse(filas[1].detalle), { id: 'carpetas-arbol', de: 'encendida', a: 'apagada' });
});

test('dos cambios a la vez sobre el mismo documento no se pisan (compare-and-set)', { skip: SALTAR }, async () => {
  const m = await mundo();
  await Promise.all([m.admin('POST', '/api/funciones', { id: 'carpetas-arbol', activo: true }), m.admin('POST', '/api/funciones', { id: 'lotes-nube', activo: true })]);
  const e = (await leerDoc(m.d1, 'estudio.config', {})).valor; assert.equal(e.carpetasArbol, true); assert.equal(e.lotesNube, true);
});

test('los enlaces muestran el estado real de los ajustes que ya existen', { skip: SALTAR }, async () => {
  const m = await mundo();
  let g = (await m.admin('GET', '/api/funciones')).j; const e = (id) => g.enlaces.find((x) => x.id === id);
  assert.equal(e('hooks-token').activa, true); assert.equal(e('publicar-ya').activa, false); assert.equal(e('significado').activa, null);
  await guardarDoc(m.d1, 'config-local', { hooks: { tokenEnQuery: false }, contenido: { publicarYa: true } });
  g = (await m.admin('GET', '/api/funciones')).j;
  assert.equal(e('hooks-token').activa, false); assert.equal(e('publicar-ya').activa, true);
});

// Un proxy sobre la D1: justo después de la primera escritura de un documento, otra persona guarda `config-local` (la carrera que dejaba el flag a medias).
const conCarrera = (d1, despuesDe, meter) => { let hecho = false; return new Proxy(d1, { get(t, k) { if (k !== 'prepare') return t[k]; return (sql) => { const st = t.prepare(sql); if (!/update docs set json/.test(sql) || hecho) return st; const bind = st.bind.bind(st); st.bind = (...a) => { const r = bind(...a); if (a[2] === despuesDe) { const run = r.run.bind(r); r.run = async () => { const x = await run(); if (!hecho) { hecho = true; await meter(); } return x; }; } return r; }; return st; }; } }); };

test('CARRERA: una función de dos documentos queda en AMBOS aunque config-local cambie entre las dos escrituras', { skip: SALTAR }, async () => {
  for (const [id, [a, b]] of Object.entries(CFG)) for (const activo of [true, false]) {
    const d1 = crearD1();
    await guardarDoc(d1, 'config-local', { costs: 1, [a]: { [b]: !activo } }); await guardarDoc(d1, 'ajustes', { x: 1, [a]: { [b]: !activo } });
    const db = conCarrera(d1, 'ajustes', async () => { await guardarDoc(d1, 'config-local', { ...(await leerDoc(d1, 'config-local', {})).valor, otra: 'cambio ajeno' }); });
    const r = await cambiar(db, { id, activo }, { email: 'x@x' });
    assert.equal(r.ok, true, `${id} ${activo}: ${JSON.stringify(r)}`);
    for (const doc of ['ajustes', 'config-local']) assert.equal((await leerDoc(d1, doc, {})).valor[a][b], activo, `${id} ${activo} en ${doc}`);
    assert.equal((await leerDoc(d1, 'config-local', {})).valor.otra, 'cambio ajeno', 'lo que otro guardó se conserva');
    assert.equal(d1._db.prepare("select count(*) n from auditoria where tipo = 'funciones'").get().n, 1);
  }
});

test('si un documento no se puede dejar completo, el error lo dice (nunca «encendida» a medias)', { skip: SALTAR }, async () => {
  const d1 = crearD1();
  let n = 0; const db = new Proxy(d1, { get(t, k) { if (k !== 'prepare') return t[k]; return (sql) => { const st = t.prepare(sql); if (/update docs set json/.test(sql)) { const bind = st.bind.bind(st); st.bind = (...a) => { const r = bind(...a); const run = r.run.bind(r); r.run = async () => { if (a[2] === 'config-local') return { meta: { changes: 0 } }; return run(); }; return r; }; } if (/insert or ignore into docs/.test(sql) || /on conflict/.test(sql)) n++; return st; }; } });
  await guardarDoc(d1, 'config-local', { a: 1 }); await guardarDoc(d1, 'ajustes', { a: 1 });
  const r = await cambiar(db, { id: 'sesion-deslizante', activo: true }, { email: 'x@x' });
  assert.equal(r.status, 409); assert.match(r.error, /Alguien cambió|vuelve a intentarlo/);
  assert.equal(d1._db.prepare("select count(*) n from auditoria where tipo = 'funciones'").get().n, 0);
});

test('un fallo al auditar no tumba un cambio ya hecho', { skip: SALTAR }, async () => {
  const d1 = crearD1();
  const db = new Proxy(d1, { get(t, k) { if (k !== 'prepare') return t[k]; return (sql) => { if (/insert into auditoria/.test(sql)) throw new Error('auditoría caída'); return t.prepare(sql); }; } });
  const r = await cambiar(db, { id: 'carpetas-arbol', activo: true }, { email: 'x@x' });
  assert.equal(r.ok, true); assert.equal((await leerDoc(d1, 'estudio.config', {})).valor.carpetasArbol, true);
});

test('el id es exacto: con espacios o en mayúsculas no está en la lista', { skip: SALTAR }, async () => {
  const m = await mundo();
  for (const id of [' chat', 'chat ', 'CHAT', 'chat\n']) assert.equal((await m.admin('POST', '/api/funciones', { id, activo: true })).status, 422, JSON.stringify(id));
  assert.equal(m.db.prepare("select count(*) n from docs where clave = 'chat.config'").get().n, 0);
});
