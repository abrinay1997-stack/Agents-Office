// Fase 7 del puerto: Anuncios de Meta en el Worker, contra el Meta de mentira de la oficina (tests/meta-stand.mjs, nunca Meta de verdad) y una D1 de
// memoria con las migraciones reales. Mismo escenario y mismas respuestas que tests/anuncios-control.test.mjs (la oficina local), más lo que solo
// existe en la nube: el rol de quien pide, los tokens del dinero en D1 (de un solo uso, también con dos peticiones a la vez), la creación en pausa
// que sigue el cron y no la petición, y que ningún token de Meta llegue a D1 ni a una respuesta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import { cadaMinuto, webhookConversiones, permitido } from '../worker/modulos/anuncios.js';
import { guardarDoc, leerDoc } from '../worker/lib/almacen.js';
import { TOKEN_STAND, CUENTA_STAND } from '../../tests/meta-stand.mjs';
import { etiqueta } from '../../anuncios/modelo.mjs';
import { SALTAR } from './d1-memoria.mjs';
import { nube } from './ayuda-meta.mjs';
import { pedir } from './d1-memoria.mjs';

const leida = async (o) => { assert.equal((await o.api('admin', 'POST', '/api/anuncios/sincronizar', {})).status, 202); const x = (await o.api('admin', 'GET', '/api/anuncios')).j; assert.ok(x.sincronizadaAt && x.cifrasAt, JSON.stringify(x).slice(0, 300)); return x; };

test('el rol decide quién cambia algo en Meta (puro)', () => {
  assert.equal(permitido('lectura', 'GET', '/api/anuncios'), true);
  assert.equal(permitido('lectura', 'POST', '/api/anuncios/borradores'), false);
  assert.equal(permitido('editor', 'POST', '/api/anuncios/borradores'), true);
  assert.equal(permitido('editor', 'PATCH', '/api/anuncios/borradores/abc'), true);
  assert.equal(permitido('editor', 'POST', '/api/anuncios/borradores/abc/validar'), true);
  for (const r of ['/api/anuncios/borradores/abc/crear', '/api/anuncios/accion', '/api/anuncios/deshacer', '/api/anuncios/sincronizar', '/api/anuncios/impulsar', '/api/anuncios/conversiones', '/api/anuncios/sugerencias/x/aplicar']) assert.equal(permitido('editor', 'POST', r), false, r);
  assert.equal(permitido('editor', 'DELETE', '/api/anuncios/borradores/abc'), false);
  assert.equal(permitido('admin', 'POST', '/api/anuncios/accion'), true);
});

test('leer de Meta: la sincronización llena el panel con la forma de la oficina local; la respuesta nunca lleva el token', { skip: SALTAR }, async () => {
  const o = await nube();
  assert.equal((await pedir(manejar, o.env, '/api/anuncios')).status, 401, 'sin sesión no se ve nada');
  const x = await leida(o);
  assert.equal(x.configurado, true); assert.equal(x.campanas.length, 4); assert.equal(x.cuenta.id, CUENTA_STAND);
  for (const k of ['configurado', 'motivo', 'ejemplo', 'cuenta', 'topes', 'gasto', 'avisos', 'resumen', 'campanas', 'rango', 'desde', 'hasta', 'sincronizadaAt', 'cifrasAt', 'sondeoAt', 'sincronizando', 'error', 'uso', 'sondeo']) assert.ok(k in x, `falta «${k}» en la vista`);
  assert.deepEqual(x.topes, { diario: 30, mensual: 300, campana: 150 });
  assert.equal(x.sincronizando, false);
  const { results } = await o.d1.prepare("select clave, json from docs where clave like 'fs:data/anuncios/%'").all();
  assert.ok(results.length >= 4, 'cuenta, alcance, estado y las cifras de cada día'); assert.ok(results.some((r) => /cifras\/\d{4}-\d{2}-\d{2}\.json$/.test(r.clave)));
  const todo = JSON.stringify((await o.d1.prepare('select * from docs').all()).results) + JSON.stringify((await o.d1.prepare('select * from auditoria').all()).results);
  assert.ok(!todo.includes(TOKEN_STAND), 'el token de Meta no llega a D1 en ningún sitio');
  assert.equal(JSON.stringify(x).includes(TOKEN_STAND), false);
  const escribieron = o.g.llamadas.slice(o.inicio).filter((l) => l.metodo !== 'GET' && !(l.ruta === '/' && l.campos?.batch));
  assert.deepEqual(escribieron, [], 'leer solo pregunta (el lote de lectura es un POST a la raíz con `batch`)');
});

test('quién puede qué: lectura solo mira; el editor prepara borradores y nada más; un agente nunca cambia nada', { skip: SALTAR }, async () => {
  const o = await nube(); await leida(o);
  for (const q of ['lectura', 'editor']) {
    assert.equal((await o.api(q, 'GET', '/api/anuncios')).status, 200);
    assert.equal((await o.api(q, 'POST', '/api/anuncios/accion', { tipo: 'pausar', id: o.ids.activa })).status, 403, `${q}: pausar`);
    assert.equal((await o.api(q, 'POST', '/api/anuncios/sincronizar', {})).status, 403, `${q}: leer de Meta`);
    assert.equal((await o.api(q, 'POST', '/api/anuncios/conversiones', { tipo: 'venta', valor: 5 })).status, 403, `${q}: conversiones`);
  }
  assert.equal(o.g.st.campanas[o.ids.activa].status, 'ACTIVE', 'nada cambió en Meta');
  assert.equal((await o.api('lectura', 'POST', '/api/anuncios/borradores', { nombre: 'x' })).status, 403);
  const b = await o.api('editor', 'POST', '/api/anuncios/borradores', { nombre: 'Combo del editor', presupuesto: { usd: 5 } });
  assert.equal(b.status, 200, JSON.stringify(b.j)); assert.equal(b.j.borrador.de, 'dueno');
  assert.equal((await o.api('editor', 'POST', `/api/anuncios/borradores/${b.j.borrador.id}/crear`, {})).status, 403, 'crear en Meta es del dueño');
  assert.equal((await o.api('editor', 'DELETE', `/api/anuncios/borradores/${b.j.borrador.id}`)).status, 403);
  // un agente (aunque lo diga un administrador en su cuerpo) es un agente: 403 en todo cambio
  assert.equal((await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'pausar', id: o.ids.activa, por: 'agente' })).status, 403);
  assert.equal((await o.api('admin', 'POST', '/api/anuncios/accion?por=agente', { tipo: 'pausar', id: o.ids.activa })).status, 403);
  assert.equal((await o.api('admin', 'POST', '/api/anuncios/borradores/' + b.j.borrador.id + '/crear', { por: 'agente' })).status, 403);
  assert.equal(o.g.st.campanas[o.ids.activa].status, 'ACTIVE');
});

test('pausar y deshacer; los dos clics del dinero con token de un solo uso en D1; topes; Meta que rechaza; relanzar en pausa', { skip: SALTAR }, async () => {
  const o = await nube(); await leida(o); const { g, ids } = o;
  const estado = (id) => g.st.campanas[id].status;
  // 1) pausar es un clic y se deshace (el token vive en D1)
  let r = await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'pausar', id: ids.activa });
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(estado(ids.activa), 'PAUSED'); assert.ok(r.j.deshacer?.token && Date.parse(r.j.deshacer.hasta));
  assert.equal((await o.d1.prepare("select count(*) n from anuncios_tokens where tipo = 'desh'").first()).n, 1);
  assert.equal((await o.api('admin', 'POST', '/api/anuncios/deshacer', { token: r.j.deshacer.token, por: 'agente' })).status, 403);
  const d = await o.api('admin', 'POST', '/api/anuncios/deshacer', { token: r.j.deshacer.token });
  assert.equal(d.status, 200, JSON.stringify(d.j)); assert.equal(estado(ids.activa), 'ACTIVE');
  assert.equal((await o.api('admin', 'POST', '/api/anuncios/deshacer', { token: r.j.deshacer.token })).status, 409, 'deshacer dos veces: ya no hay nada');
  // 2) bajar un presupuesto, y Meta rechaza uno demasiado bajo (validate_only)
  r = await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'bajar_presupuesto', id: ids.activa, valor: 8 });
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(g.st.campanas[ids.activa].daily_budget, '800');
  r = await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'bajar_presupuesto', id: ids.activa, valor: 0.5 });
  assert.equal(r.status, 422); assert.equal(r.j.error, 'meta'); assert.match(r.j.motivo, /demasiado bajo/); assert.equal(g.st.campanas[ids.activa].daily_budget, '800');
  // 3) activar: sin confirmación nada cambia y se dice la cifra; con ella, una vez; el token ya no sirve
  const n = g.st.cambios.length;
  r = await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'activar', id: ids.combo });
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.match(r.j.confirmar.texto, /^Activar «Combo» — gasta hasta US\$15 al día, US\$\d+ esta semana$/);
  assert.equal(r.j.confirmar.cifras.dia, 15); assert.equal(g.st.cambios.length, n, 'nada cambió en Meta'); assert.equal(estado(ids.combo), 'PAUSED');
  assert.equal((await o.d1.prepare("select count(*) n from anuncios_tokens where tipo = 'conf'").first()).n, 1, 'el token espera en D1');
  // la confirmación es de ESTA acción: otro objeto no la usa (y la gasta: de un solo uso)
  assert.equal((await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'activar', id: ids.grande, confirmacion: r.j.confirmar.token })).j.error, 'confirmacion');
  r = await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'activar', id: ids.combo }); const token2 = r.j.confirmar.token;
  assert.equal((await o.api('editor', 'POST', '/api/anuncios/accion', { tipo: 'activar', id: ids.combo, confirmacion: token2 })).status, 403, 'el editor no confirma un gasto');
  assert.equal((await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'activar', id: ids.combo, por: 'agente', confirmacion: token2 })).status, 403, 'un agente tampoco');
  const ok = await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'activar', id: ids.combo, confirmacion: token2 });
  assert.equal(ok.status, 200, JSON.stringify(ok.j)); assert.equal(estado(ids.combo), 'ACTIVE');
  const otra = await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'activar', id: ids.combo, confirmacion: token2 });
  assert.equal(otra.status, 409); assert.equal(otra.j.error, 'confirmacion');
  // 4) por encima del tope diario (8 + 15 ya activos + 25 = 48 > 30): 409 con la cifra y nada cambia
  r = await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'activar', id: ids.grande });
  assert.equal(r.status, 409); assert.equal(r.j.error, 'tope'); assert.equal(r.j.tope, 30); assert.equal(r.j.quedaria, 48); assert.equal(estado(ids.grande), 'PAUSED');
  // 5) relanzar una terminada: una copia EN PAUSA
  r = await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'relanzar', id: ids.vieja });
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.match(r.j.confirmar.texto, /como copia EN PAUSA/);
  r = await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'relanzar', id: ids.vieja, confirmacion: r.j.confirmar.token });
  assert.equal(r.status, 200, JSON.stringify(r.j)); const copia = r.j.hecho.despues.copia;
  assert.equal(estado(copia), 'PAUSED'); assert.match(g.st.campanas[copia].name, / · AO:r/);
  // 6) el historial y la auditoría quedan en D1
  const h = (await o.api('admin', 'GET', '/api/anuncios/historial')).j.items;
  for (const que of ['pausar', 'deshacer:pausar', 'bajar_presupuesto', 'activar', 'relanzar']) assert.ok(h.some((x) => x.que === que), que);
  const aud = (await o.d1.prepare("select detalle from auditoria where tipo = 'anuncios'").all()).results.map((x) => JSON.parse(x.detalle));
  assert.ok(aud.filter((x) => x.ok).length >= 5); assert.ok(aud.some((x) => x.ok === false && x.que === 'activar'), 'el intento por encima del tope también');
});

test('la identidad que escribe el cliente en el cuerpo no cambia lo que puede quien llega: un administrador con por:"dimitri" (o piloto, asistente) sigue siendo el dueño, y con "agente" pierde permisos', { skip: SALTAR }, async () => {
  const o = await nube(); await leida(o); const { g, ids } = o;
  // si el servidor dejara pasar `por`, 'dimitri' solo pide la cifra y 'piloto' y 'asistente' no gastan nunca: el segundo clic del dueño fallaría
  for (const por of ['dimitri', 'piloto', 'asistente', 'otra-cosa']) {
    const antes = g.st.campanas[ids.combo].status;
    if (antes === 'ACTIVE') await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'pausar', id: ids.combo });
    const pide = await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'activar', id: ids.combo, por });
    assert.equal(pide.status, 200, `${por}: ${JSON.stringify(pide.j)}`); assert.ok(pide.j.confirmar?.token, `${por}: pide la cifra`);
    const hace = await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'activar', id: ids.combo, por, confirmacion: pide.j.confirmar.token });
    assert.equal(hace.status, 200, `${por}: el administrador confirma su gasto: ${JSON.stringify(hace.j)}`);
    assert.equal(g.st.campanas[ids.combo].status, 'ACTIVE');
  }
});

test('dos clics seguidos con el MISMO token (dos pestañas a la vez): Meta cambia una sola vez', { skip: SALTAR }, async () => {
  const o = await nube(); await leida(o); const { g, ids } = o;
  const r = await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'activar', id: ids.combo });
  const cuerpo = { tipo: 'activar', id: ids.combo, confirmacion: r.j.confirmar.token };
  const n = g.st.cambios.length;
  const [a, b] = await Promise.all([o.api('admin', 'POST', '/api/anuncios/accion', cuerpo), o.api('admin', 'POST', '/api/anuncios/accion', cuerpo)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409], JSON.stringify([a.j, b.j]));
  assert.equal(g.st.cambios.length - n, 1, 'una sola escritura en Meta'); assert.equal(g.st.campanas[ids.combo].status, 'ACTIVE');
});

test('un token de confirmación vencido no se usa: pasados los 2 minutos hay que volver a pedir la cifra', { skip: SALTAR }, async () => {
  const o = await nube(); await leida(o);
  const r = await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'activar', id: o.ids.combo });
  await o.d1.prepare("update anuncios_tokens set json = json_set(json, '$.vence', ?)").bind(Date.now() - 1000).run();
  const x = await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'activar', id: o.ids.combo, confirmacion: r.j.confirmar.token });
  assert.equal(x.status, 409); assert.match(x.j.motivo, /venció/); assert.equal(o.g.st.campanas[o.ids.combo].status, 'PAUSED');
});

test('crear en Meta: el clic del dueño deja el borrador «creando» y NO crea nada en la petición; lo crea el cron, todo en pausa y una sola vez', { skip: SALTAR }, async () => {
  const o = await nube(); await leida(o); const { g } = o;
  const creativos = [{ id: 'k1', media: '2026-10/uno.jpg', formato: '1:1', texto: 'Escríbenos por WhatsApp', titular: 'Combo 2x1' }, { id: 'k2', media: '2026-10/dos.jpg', formato: '4:5', texto: 'Tu combo, hoy' }];
  const nb = await o.api('admin', 'POST', '/api/anuncios/borradores', { nombre: 'Combo', presupuesto: { usd: 10 }, creativos });
  assert.equal(nb.status, 200, JSON.stringify(nb.j)); const id = nb.j.borrador.id;
  const v = await o.api('admin', 'POST', `/api/anuncios/borradores/${id}/validar`, {});
  assert.equal(v.status, 200, JSON.stringify(v.j)); assert.equal(v.j.borrador.validacion.ok, true, JSON.stringify(v.j.borrador.validacion.problemas));
  const antes = Object.keys(g.st.campanas).length;
  const c = await o.api('admin', 'POST', `/api/anuncios/borradores/${id}/crear`, {});
  assert.equal(c.status, 202, JSON.stringify(c.j));
  assert.equal(Object.keys(g.st.campanas).length, antes, 'la petición no crea nada en Meta: queda para el cron');
  assert.equal((await o.api('admin', 'GET', '/api/anuncios/borradores')).j.items.find((b) => b.id === id).estado, 'creando');
  assert.equal((await o.api('admin', 'POST', `/api/anuncios/borradores/${id}/crear`, {})).status, 409, 'dos clics: ya se está creando');
  await cadaMinuto(o.env);
  const fin = (await o.api('admin', 'GET', `/api/anuncios/borradores/${id}`)).j.borrador;
  assert.equal(fin.estado, 'creado', fin.error);
  const nuevas = Object.values(g.st.campanas).filter((x) => etiqueta(x.name).borrador === id);
  assert.equal(nuevas.length, 1); const conjs = Object.values(g.st.conjuntos).filter((x) => etiqueta(x.name).borrador === id);
  assert.equal(conjs.length, 1);
  const ads = Object.values(g.st.anuncios).filter((x) => etiqueta(x.name).borrador === id);
  assert.equal(ads.length, 2);
  assert.ok([nuevas[0], ...conjs, ...ads].every((x) => x.status === 'PAUSED'), 'TODO nace en pausa');
  assert.equal(Object.keys(g.st.imagenes).length, 2, 'las imágenes salieron de R2 y se subieron una vez');
  await cadaMinuto(o.env); await cadaMinuto(o.env);
  assert.equal(Object.values(g.st.campanas).filter((x) => etiqueta(x.name).borrador === id).length, 1, 'nunca dos veces');
  assert.equal((await o.d1.prepare("select count(*) n from docs where clave like 'fs:media/%'").first()).n, 0, 'las imágenes bajadas de R2 no se guardan en D1');
});

test('si la oficina «se cae» a mitad de crear, el cron retoma sin duplicar (lo hecho se reconoce por su etiqueta AO:)', { skip: SALTAR }, async () => {
  const o = await nube(); await leida(o); const { g } = o;
  const nb = await o.api('admin', 'POST', '/api/anuncios/borradores', { nombre: 'Combo', presupuesto: { usd: 10 }, creativos: [{ id: 'k1', media: '2026-10/uno.jpg', formato: '1:1', texto: 'Escríbenos', titular: 'Combo' }] });
  const id = nb.j.borrador.id;
  assert.equal((await o.api('admin', 'POST', `/api/anuncios/borradores/${id}/crear`, {})).status, 202);
  const pre = await (await g.fetchFn('https://graph.test/v26.0/' + CUENTA_STAND + '/campaigns', { method: 'POST', headers: { authorization: `Bearer ${TOKEN_STAND}` }, body: new URLSearchParams({ name: `Combo · AO:${id}`, objective: 'OUTCOME_ENGAGEMENT', special_ad_categories: '[]', status: 'PAUSED', daily_budget: '1000' }) })).json();
  assert.ok(pre.id);
  await cadaMinuto(o.env);
  assert.equal((await o.api('admin', 'GET', `/api/anuncios/borradores/${id}`)).j.borrador.estado, 'creado');
  assert.equal(Object.values(g.st.campanas).filter((x) => etiqueta(x.name).borrador === id).length, 1, 'la que ya existía, no una segunda');
});

test('una creación que otro reloj ya está haciendo (candado) no se repite', { skip: SALTAR }, async () => {
  const o = await nube(); await leida(o); const { g } = o;
  const nb = await o.api('admin', 'POST', '/api/anuncios/borradores', { nombre: 'Combo', presupuesto: { usd: 10 }, creativos: [{ id: 'k1', media: '2026-10/uno.jpg', formato: '1:1', texto: 'Escríbenos', titular: 'Combo' }] });
  const id = nb.j.borrador.id; await o.api('admin', 'POST', `/api/anuncios/borradores/${id}/crear`, {});
  await o.d1.prepare('insert into anuncios_candados (clave, hasta, quien) values (?,?,?)').bind(`anuncios:crear:${id}`, Date.now() + 600000, 'otro-reloj').run();
  const n = Object.keys(g.st.campanas).length;
  await cadaMinuto(o.env);
  assert.equal(Object.keys(g.st.campanas).length, n, 'el candado de otro reloj se respeta');
  assert.equal((await o.api('admin', 'GET', `/api/anuncios/borradores/${id}`)).j.borrador.estado, 'creando');
  await o.d1.prepare('delete from anuncios_candados').run(); await cadaMinuto(o.env);
  assert.equal((await o.api('admin', 'GET', `/api/anuncios/borradores/${id}`)).j.borrador.estado, 'creado');
});

test('el freno por uso de Meta cruza las peticiones: si Meta pidió esperar, la siguiente petición ni llama', { skip: SALTAR }, async () => {
  const o = await nube(); await leida(o);
  o.g.st.uso = { app: 100, negocio: 100, cuenta: 100, recuperarMin: 20 };
  await o.api('admin', 'POST', '/api/anuncios/sincronizar', {}); // Meta contesta con el uso al 100 %
  const f = (await leerDoc(o.d1, 'meta.freno')).valor; assert.ok(f.hasta > Date.now(), JSON.stringify(f));
  const n = o.g.llamadas.length;
  const x = await o.api('admin', 'POST', '/api/anuncios/sincronizar', {});
  assert.equal(o.g.llamadas.length, n, 'frenada: no se gastó cuota');
  assert.ok([202, 409].includes(x.status));
  assert.ok((await o.api('admin', 'GET', '/api/anuncios')).j.uso.frenadoHasta, 'la página lo ve');
});

test('el informe del mes se guarda como nota del Cerebro (en D1) y no como archivo', { skip: SALTAR }, async () => {
  const o = await nube(); await leida(o);
  const mes = new Date().toISOString().slice(0, 7);
  const g = await o.api('admin', 'GET', `/api/anuncios/informe?mes=${mes}`); assert.equal(g.status, 200); assert.ok(g.j.titulo && g.j.texto && g.j.cifras);
  assert.equal((await o.api('admin', 'POST', `/api/anuncios/informe?mes=${mes}`, { por: 'agente' })).status, 403);
  const p = await o.api('admin', 'POST', `/api/anuncios/informe?mes=${mes}`, {});
  assert.equal(p.status, 200, JSON.stringify(p.j)); assert.match(p.j.nota, /informes\/\d{4}-\d{2} anuncios\.md$/);
  const nota = await o.d1.prepare('select grupo, texto from notas where nombre = ?').bind(`${mes} anuncios`).first();
  assert.ok(nota && /tipo: informe/.test(nota.texto), 'la nota está en el Cerebro');
  assert.equal((await o.d1.prepare("select count(*) n from docs where clave like 'fs:brain/%'").first()).n, 0, 'y no como archivo espejado');
});

test('conversiones: apagadas por defecto; solo el dueño las manda; el webhook pide su token y nunca devuelve datos personales', { skip: SALTAR }, async () => {
  const o = await nube(); await leida(o);
  let r = await o.api('admin', 'POST', '/api/anuncios/conversiones', { tipo: 'venta', valor: 20, email: 'ana@example.com' });
  assert.equal(r.status, 409, 'apagada'); assert.match(r.j.motivo, /apagada/);
  await guardarDoc(o.d1, 'config-local', { anuncios: { cuenta: CUENTA_STAND, topeDiario: 30, topeMensual: 300, topeCampana: 150, conversiones: true, pixel: '123456789' }, contenido: { modo: 'simulacro' } });
  r = await o.api('admin', 'POST', '/api/anuncios/conversiones', { tipo: 'venta', valor: 20, email: 'ana@example.com', url: 'https://tienda.test/p' });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.equal(o.g.st.eventos.length, 1); const ev = JSON.stringify(o.g.st.eventos);
  assert.ok(!ev.includes('ana@example.com'), 'el correo sale cifrado'); assert.ok(!JSON.stringify(r.j).includes('ana@example.com'), 'y no vuelve en la respuesta');
  assert.equal((await o.api('editor', 'POST', '/api/anuncios/conversiones', { tipo: 'venta', valor: 5 })).status, 403);
  assert.equal((await o.api('admin', 'POST', '/api/anuncios/conversiones', { tipo: 'venta', valor: 5, por: 'agente' })).status, 403);
  assert.equal((await o.api('admin', 'POST', '/api/anuncios/conversiones/webhook', { evento: 'Lead' })).status, 401, 'el webhook sin su token (aunque haya sesión: es una ruta pública con su propio token)');
  const hook = (cab, cuerpo) => manejar(new Request('https://oficina.test/api/anuncios/conversiones/webhook', { method: 'POST', headers: { 'content-type': 'application/json', ...cab }, body: JSON.stringify(cuerpo) }), o.env);
  const w = await hook({ 'x-office-token': 'hook-de-prueba-123' }, { evento: 'Lead', email: 'luis@example.com', url: 'https://tienda.test/f', id: 'f1' }); // secrets-ok: de mentira
  assert.equal(w.status, 200); assert.ok(!JSON.stringify(await w.json()).includes('luis@example.com'));
  assert.equal(o.g.st.eventos.length, 1, 'el webhook solo APUNTA el evento: no espera a Meta');
  await cadaMinuto(o.env);
  assert.equal(o.g.st.eventos.length, 2, 'el reloj del minuto lo manda');
  assert.equal((await hook({ 'x-office-token': 'otro' }, { evento: 'Lead' })).status, 401);
});

test('las sugerencias salen del diagnóstico tras leer; pedir variaciones deja UNA tarea para el puesto de anuncios en la lista de tareas de la nube (solo el dueño)', { skip: SALTAR }, async () => {
  const o = await nube(); const x = await leida(o);
  const s = await o.api('admin', 'GET', '/api/anuncios/sugerencias');
  assert.equal(s.status, 200); for (const k of ['items', 'cpaObjetivo', 'sinObjetivo', 'notas', 'at', 'umbrales']) assert.ok(k in s.j, `falta «${k}»`);
  assert.ok(Object.keys(s.j.umbrales).length >= 20, 'los umbrales de la Biblioteca viajan con el Worker');
  const anuncio = x.campanas[0].conjuntos[0].anuncios[0].id;
  assert.equal((await o.api('editor', 'POST', `/api/anuncios/creativos/${anuncio}/variaciones`, {})).status, 403);
  assert.equal((await o.api('admin', 'POST', `/api/anuncios/creativos/${anuncio}/variaciones`, { por: 'agente' })).status, 403);
  const v = await o.api('admin', 'POST', `/api/anuncios/creativos/${anuncio}/variaciones`, { pide: 'más cercano' });
  assert.equal(v.status, 200, JSON.stringify(v.j)); assert.ok(v.j.tarea?.id);
  const fila = await o.d1.prepare("select json from filas where coleccion = 'tareas' and id = ?").bind(v.j.tarea.id).first();
  assert.ok(fila, 'la tarea está en la colección `tareas` de la nube'); const t = JSON.parse(fila.json);
  assert.equal(t.agent, 'ada'); assert.equal(t.needsOk, false); assert.match(t.text, /variaciones/);
});

test('un borrador que no pasa lo local no se crea; y el reloj no inventa nada: solo toca lo que está «creando»', { skip: SALTAR }, async () => {
  const o = await nube(); await leida(o);
  const nb = await o.api('admin', 'POST', '/api/anuncios/borradores', { nombre: 'Sin nada', presupuesto: { usd: 10 }, estado: 'ACTIVE', status: 'ACTIVE' });
  const id = nb.j.borrador.id;
  const c = await o.api('admin', 'POST', `/api/anuncios/borradores/${id}/crear`, {});
  assert.equal(c.status, 422, JSON.stringify(c.j)); assert.equal(c.j.error, 'validacion');
  assert.equal((await o.api('admin', 'GET', `/api/anuncios/borradores/${id}`)).j.borrador.estado, 'borrador', 'sigue siendo un borrador: no se creó nada');
  const n = Object.keys(o.g.st.campanas).length;
  await cadaMinuto(o.env);
  assert.equal(Object.keys(o.g.st.campanas).length, n);
});
