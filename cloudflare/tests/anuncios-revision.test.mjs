// Fase 7, tras la revisión: lo que tiene que MORDER si alguien quita una de las defensas del dinero o del estado.
//  · el token de un solo uso y el candado, con una D1 de latencia aleatoria (sin ella, node:sqlite es síncrono y la carrera nunca ocurre);
//  · la regla «todo nace en PAUSA»; el diario escrito ANTES de llamar a Meta y la auditoría DESPUÉS de cada paso;
//  · un fallo de infraestructura no archiva ni deja «fallo»; un solo reloj y una sola creación; medios grandes;
//  · el espejo: peso en bytes, tokens tapados, borrado condicional; y el webhook público de conversiones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import { cadaMinuto, TTL_RELOJ_MS, MAX_WEBHOOK_BYTES, MAX_WEBHOOK_POR_MINUTO } from '../worker/modulos/anuncios.js';
import { guardarDoc, leerDoc } from '../worker/lib/almacen.js';
import { tokensD1, candados, tasaPorMinuto } from '../worker/lib/tokens.js';
import { abrirEspejo, bytesDeFila, MAX_ARCHIVO } from '../worker/lib/espejo.js';
import { aplicarMigracion } from '../worker/lib/anuncios-nube.js';
import { crearMeta } from '../../contenido/meta.mjs';
import { crearMetaAds } from '../../anuncios/meta-ads.mjs';
import { crearMetaStand, TOKEN_STAND, CUENTA_STAND } from '../../tests/meta-stand.mjs';
import { etiqueta } from '../../anuncios/modelo.mjs';
import { crearD1, conLatencia, SALTAR } from './d1-memoria.mjs';
import { nube, r2, JPEG } from './ayuda-meta.mjs';
import fs from 'node:fs';

const leida = async (o) => { assert.equal((await o.api('admin', 'POST', '/api/anuncios/sincronizar', {})).status, 202); };
const nuevoBorrador = async (o, nombre = 'Combo', media = '2026-10/uno.jpg') => {
  const nb = await o.api('admin', 'POST', '/api/anuncios/borradores', { nombre, presupuesto: { usd: 10 }, creativos: [{ id: 'k1', media, formato: '1:1', texto: 'Escríbenos por WhatsApp', titular: nombre }] });
  assert.equal(nb.status, 200, JSON.stringify(nb.j)); return nb.j.borrador.id;
};
const crear = async (o, id) => { const v = await o.api('admin', 'POST', `/api/anuncios/borradores/${id}/validar`, {}); assert.equal(v.j.borrador?.validacion?.ok, true, JSON.stringify(v)); assert.equal((await o.api('admin', 'POST', `/api/anuncios/borradores/${id}/crear`, {})).status, 202); };
const estadoDe = async (o, id) => (await o.api('admin', 'GET', `/api/anuncios/borradores/${id}`)).j.borrador;

// ---------------------------------------------------------------- 1. el token y el candado, con carrera de verdad
test('un token de gasto lo consume UNA sola petición aunque lleguen a la vez (D1 con latencia aleatoria); quitar la comprobación de `changes` lo rompe', { skip: SALTAR }, async () => {
  const d1 = conLatencia(crearD1(), { max: 5 }), T = tokensD1(d1);
  // el mutante: lo mismo que tokensD1.tomar pero SIN mirar `changes` (lo que pasaría si alguien «simplifica» el código)
  const tomarSinChanges = async (tipo, token) => { const f = await d1.prepare('select json from anuncios_tokens where token = ? and tipo = ?').bind(token, tipo).first(); if (!f) return null; await d1.prepare('delete from anuncios_tokens where token = ? and tipo = ?').bind(token, tipo).run(); return JSON.parse(f.json); };
  let dobles = 0, dobleReal = 0;
  for (let i = 0; i < 30; i++) {
    const k1 = `tok-real-${i}-aaaa`, k2 = `tok-mut-${i}-bbbb`;
    await T.poner('conf', k1, { tipo: 'activar' }, Date.now() + 120000); await T.poner('conf', k2, { tipo: 'activar' }, Date.now() + 120000);
    const real = await Promise.all([T.tomar('conf', k1), T.tomar('conf', k1)]);
    if (real.filter(Boolean).length !== 1) dobleReal++;
    const mut = await Promise.all([tomarSinChanges('conf', k2), tomarSinChanges('conf', k2)]);
    if (mut.filter(Boolean).length === 2) dobles++;
  }
  assert.equal(dobleReal, 0, 'el código real: nunca dos ni cero');
  assert.ok(dobles > 0, 'el banco de pruebas SÍ provoca la carrera: sin la comprobación de `changes`, el mismo token se gastaría dos veces');
});

test('un candado lo toma UNO solo aunque lleguen a la vez; el que lo tiene lo renueva y nadie más lo suelta', { skip: SALTAR }, async () => {
  const d1 = conLatencia(crearD1(), { max: 5, semilla: 99 }), C = candados(d1);
  for (let i = 0; i < 25; i++) {
    const r = await Promise.all(['a', 'b', 'c'].map((q) => C.tomar(`k${i}`, 60000, q)));
    assert.equal(r.filter(Boolean).length, 1, `candado k${i}: ${r}`);
  }
  const dueno = (await Promise.all(['a', 'b'].map((q) => C.tomar('x', 60000, q)))).indexOf(true) === 0 ? 'a' : 'b', otro = dueno === 'a' ? 'b' : 'a';
  assert.equal(await C.renovar('x', 120000, otro), false, 'solo el dueño del candado lo renueva');
  assert.equal(await C.renovar('x', 120000, dueno), true);
  await C.soltar('x', otro); assert.equal(await C.quien('x'), dueno, 'quien no lo tiene no lo suelta');
});

test('dos clics a la vez con el mismo token (D1 con latencia): Meta se escribe UNA vez', { skip: SALTAR }, async () => {
  const o = await nube(); await leida(o);
  const lenta = conLatencia(o.d1, { max: 4, semilla: 7 }); o.env.DB = lenta;
  const r = await o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'activar', id: o.ids.combo });
  const token = r.j.confirmar.token; const n0 = o.g.st.cambios.filter((c) => c.id === o.ids.combo).length;
  const dos = await Promise.all([1, 2].map(() => o.api('admin', 'POST', '/api/anuncios/accion', { tipo: 'activar', id: o.ids.combo, confirmacion: token })));
  assert.deepEqual(dos.map((x) => x.status).sort(), [200, 409]);
  assert.equal(o.g.st.cambios.filter((c) => c.id === o.ids.combo).length - n0, 1);
});

// ---------------------------------------------------------------- 2. todo nace en PAUSA
test('crearEn se niega a crear algo que no sea PAUSED, y no llega a llamar a Meta', async () => {
  const g = crearMetaStand({ permisos: [] });
  const meta = crearMeta({ env: { META_ACCESS_TOKEN: TOKEN_STAND, META_GRAPH_HOST: 'https://graph.test' }, fetchFn: g.fetchFn, dir: fs.mkdtempSync('/tmp/ao-pausa-') }); // secrets-ok: de mentira
  const ads = crearMetaAds({ meta });
  for (const status of ['ACTIVE', 'active', undefined, '']) {
    const n = g.llamadas.length;
    await assert.rejects(ads.crearEn(CUENTA_STAND, 'campana', { name: 'x · AO:b1', objective: 'OUTCOME_ENGAGEMENT', special_ad_categories: [], ...(status === undefined ? {} : { status }) }), /EN PAUSA/);
    assert.equal(g.llamadas.length, n, `con status «${status}» ni siquiera se llamó a Meta`);
  }
  for (const nivel of ['conjunto', 'anuncio']) await assert.rejects(ads.crearEn(CUENTA_STAND, nivel, { name: 'x', status: 'ACTIVE' }), /EN PAUSA/);
});

// ---------------------------------------------------------------- 3. el diario va ANTES, la auditoría DESPUÉS
test('antes de cada llamada que crea en Meta el diario ya está en D1; y tras cada paso exitoso, su auditoría', { skip: SALTAR }, async () => {
  const visto = [];
  let o = null;
  const torcer = async (ll) => {
    if (ll.metodo !== 'POST' || /validate_only|execution_options/.test(JSON.stringify(ll.campos || {}) + ll.url.search)) return null;
    const nivel = /\/campaigns$/.test(ll.ruta) ? 'campana' : /\/adsets$/.test(ll.ruta) ? 'conjunto' : /\/ads$/.test(ll.ruta) ? 'anuncio' : null;
    if (!nivel || !o) return null;
    const fila = await o.d1.prepare("select json from docs where clave = 'fs:data/anuncios/creaciones.json'").first(); // secrets-ok: de mentira
    const diario = fila ? JSON.parse(JSON.parse(fila.json).t) : {};
    const id = Object.keys(diario)[0];
    const aud = (await o.d1.prepare("select detalle from auditoria where tipo = 'anuncios'").all()).results.map((r) => JSON.parse(r.detalle));
    visto.push({ nivel, enCurso: diario[id]?.enCurso?.nivel ?? null, creados: (diario[id]?.creados || []).map((c) => c.nivel), auditados: aud.filter((a) => a.que === 'crear en pausa').map((a) => a.paso) });
    return null;
  };
  o = await nube({ stand: { torcer } }); await leida(o);
  const id = await nuevoBorrador(o); await crear(o, id); await cadaMinuto(o.env);
  assert.equal((await estadoDe(o, id)).estado, 'creado');
  const por = (n) => visto.find((v) => v.nivel === n);
  assert.equal(por('campana').enCurso, 'campana', 'ANTES de crear la campaña, D1 ya sabía que se iba a crear');
  assert.equal(por('conjunto').enCurso, 'conjunto'); assert.ok(por('conjunto').creados.includes('campana'), 'y la campaña ya creada también estaba apuntada');
  assert.ok(por('conjunto').auditados.includes('campana'), 'DESPUÉS del paso de la campaña, su auditoría ya estaba en D1 (no esperó al final)');
  assert.ok(por('anuncio').auditados.includes('conjunto'));
});

// ---------------------------------------------------------------- 4. un fallo de infraestructura no es un fallo de la creación
test('si se corta por infraestructura («Too many subrequests», D1), el borrador SIGUE «creando»: nada archivado, y el reloj lo retoma sin duplicar', { skip: SALTAR }, async () => {
  let cortar = 0;
  const torcer = async (ll) => { if (cortar > 0 && ll.metodo === 'POST' && /\/adsets$/.test(ll.ruta) && !/validate_only/.test(JSON.stringify(ll.campos || {}))) { cortar--; throw new Error('Too many subrequests.'); } return null; };
  const o = await nube({ stand: { torcer } }); await leida(o);
  const id = await nuevoBorrador(o); await crear(o, id); cortar = 1; // el corte llega durante la creación, no durante el decorado
  await cadaMinuto(o.env);
  const a = await estadoDe(o, id);
  assert.equal(a.estado, 'creando', `no es «fallo»: ${a.error}`); assert.ok(!a.error);
  const camp = Object.values(o.g.st.campanas).filter((x) => etiqueta(x.name).borrador === id);
  assert.equal(camp.length, 1); assert.equal(camp[0].status, 'PAUSED', 'la campaña a medias NO se archivó');
  const diario = JSON.parse(JSON.parse((await o.d1.prepare("select json from docs where clave = 'fs:data/anuncios/creaciones.json'").first()).json).t)[id]; // secrets-ok: de mentira
  assert.equal(diario.reintentosInfra, 1); assert.ok(!diario.fallo);
  await cadaMinuto(o.env); // el siguiente minuto: sigue donde iba
  assert.equal((await estadoDe(o, id)).estado, 'creado');
  assert.equal(Object.values(o.g.st.campanas).filter((x) => etiqueta(x.name).borrador === id).length, 1, 'una sola campaña');
});

test('un fallo de Meta que SÍ es de la creación (no pasajero) archiva lo creado y deja «fallo», como en la oficina', { skip: SALTAR }, async () => {
  let malo = 0;
  const torcer = async (ll) => { if (malo > 0 && ll.metodo === 'POST' && /\/ads$/.test(ll.ruta) && !/validate_only/.test(JSON.stringify(ll.campos || {}))) { malo--; return new Response(JSON.stringify({ error: { message: '(#100) Invalid parameter', code: 100, type: 'OAuthException' } }), { status: 400, headers: { 'content-type': 'application/json' } }); } return null; };
  const o = await nube({ stand: { torcer } }); await leida(o);
  const id = await nuevoBorrador(o); await crear(o, id); malo = 1; await cadaMinuto(o.env);
  const b = await estadoDe(o, id); assert.equal(b.estado, 'fallo'); assert.match(b.error, /ARCHIVADO/);
  assert.ok(Object.values(o.g.st.campanas).filter((x) => etiqueta(x.name).borrador === id).every((x) => x.status === 'ARCHIVED'));
});

// ---------------------------------------------------------------- 5. un reloj, una creación
test('el reloj hace UNA creación por invocación; el candado es corto y se renueva con el latido', { skip: SALTAR }, async () => {
  let o = null; const hastas = [];
  const torcer = async (ll) => {
    if (o && ll.metodo === 'POST' && /\/campaigns$/.test(ll.ruta) && !/validate_only/.test(JSON.stringify(ll.campos || {}))) {
      await o.d1.prepare("update anuncios_candados set hasta = ? where clave = 'anuncios:cron'").bind(Date.now() + 1000).run(); // «casi vencido»: solo el latido lo puede alargar // secrets-ok: de mentira
      hastas.push('puesto');
    }
    if (o && ll.metodo === 'POST' && /\/adsets$/.test(ll.ruta) && !/validate_only/.test(JSON.stringify(ll.campos || {}))) hastas.push((await o.d1.prepare("select hasta from anuncios_candados where clave = 'anuncios:cron'").first()).hasta - Date.now()); // secrets-ok: de mentira
    return null;
  };
  o = await nube({ stand: { torcer } }); await leida(o);
  const a = await nuevoBorrador(o, 'Uno'), b = await nuevoBorrador(o, 'Dos'); await crear(o, a); await crear(o, b);
  await cadaMinuto(o.env);
  const estados = [(await estadoDe(o, a)).estado, (await estadoDe(o, b)).estado].sort();
  assert.deepEqual(estados, ['creado', 'creando'], 'una sola creación por invocación');
  assert.ok(TTL_RELOJ_MS >= 3 * 60e3 && TTL_RELOJ_MS <= 5 * 60e3, 'el candado del reloj dura 3–5 minutos');
  assert.ok(hastas.length >= 2 && hastas[1] > 3 * 60e3, `el latido lo renovó tras el paso (quedaban ${Math.round(hastas[1] / 1000)} s)`);
  assert.equal(await candados(o.d1).quien('anuncios:cron'), null, 'y al terminar se suelta');
  await cadaMinuto(o.env);
  assert.deepEqual([(await estadoDe(o, a)).estado, (await estadoDe(o, b)).estado], ['creado', 'creado']);
});

// ---------------------------------------------------------------- 6. medios grandes
test('un medio de más de 25 MB se rechaza en español al validar, y no se llega a crear nada', { skip: SALTAR }, async () => {
  const grande = JPEG(1); grande.size = 30 * 1048576; // R2 dice que pesa 30 MB (el contenido de la prueba es pequeño)
  const o = await nube({ extraEnv: { MEDIA: r2({ '2026-10/grande.jpg': grande, '2026-10/uno.jpg': JPEG(1) }) } }); await leida(o);
  const id = await nuevoBorrador(o, 'Pesado', '2026-10/grande.jpg');
  const v = await o.api('admin', 'POST', `/api/anuncios/borradores/${id}/validar`, {});
  assert.equal(v.status, 422); assert.match(v.j.motivo, /pesa 30,0 MB.*25 MB/); assert.equal(v.j.error, 'medio');
  const c = await o.api('admin', 'POST', `/api/anuncios/borradores/${id}/crear`, {});
  assert.equal(c.status, 422); assert.equal((await estadoDe(o, id)).estado, 'borrador');
  const n = Object.keys(o.g.st.campanas).length; await cadaMinuto(o.env); assert.equal(Object.keys(o.g.st.campanas).length, n);
});

// ---------------------------------------------------------------- 7. el espejo
test('el peso de un archivo se mide en BYTES de la fila (UTF-8 y escapes), no en caracteres', { skip: SALTAR }, async () => {
  assert.equal(bytesDeFila('abc'), JSON.stringify({ t: 'abc' }).length);
  assert.ok(bytesDeFila('ñ'.repeat(10)) > 'ñ'.repeat(10).length * 2, 'cada ñ son 2 bytes');
  const d1 = crearD1();
  for (const [nombre, texto] of [['ñ', 'ñ'.repeat(1_000_000)], ['saltos', '\n'.repeat(1_000_000)], ['emoji', '😀'.repeat(500_000)]]) {
    assert.ok(texto.length <= MAX_ARCHIVO, `${nombre}: por caracteres cabría`);
    assert.ok(bytesDeFila(texto) > MAX_ARCHIVO, `${nombre}: por bytes NO cabe`);
    const esp = await abrirEspejo(d1, { prefijos: ['data/anuncios/'] });
    fs.mkdirSync(esp.ruta('data/anuncios'), { recursive: true }); fs.writeFileSync(esp.ruta('data/anuncios/grande.json'), texto);
    await assert.rejects(esp.flush(), /pesa .* MB y no cabe en una fila de D1/);
    esp.cerrar();
  }
  const esp = await abrirEspejo(d1, { prefijos: ['data/anuncios/'] }); fs.mkdirSync(esp.ruta('data/anuncios'), { recursive: true });
  fs.writeFileSync(esp.ruta('data/anuncios/justo.json'), 'a'.repeat(1_800_000)); await esp.flush(); esp.cerrar(); // lo que cabe, cabe
  assert.ok((await d1.prepare("select length(json) n from docs where clave = 'fs:data/anuncios/justo.json'").first()).n < 2_000_000); // secrets-ok: de mentira
});

test('la migración también mide en bytes', { skip: SALTAR }, async () => {
  const d1 = crearD1();
  await guardarDoc(d1, 'anuncios.migracion.borradores', { ruta: 'data/anuncios/borradores.json', texto: JSON.stringify({ x: 'ñ'.repeat(1_000_000) }) });
  const hechas = await aplicarMigracion(d1);
  assert.deepEqual(hechas, [], 'por caracteres cabría; por bytes no: se descarta'); assert.equal((await d1.prepare("select count(*) n from docs where clave = 'fs:data/anuncios/borradores.json'").first()).n, 0); // secrets-ok: de mentira
});

test('un token de Meta nunca queda en un archivo del espejo (se tapa al volcar)', { skip: SALTAR }, async () => {
  const d1 = crearD1(), esp = await abrirEspejo(d1, { prefijos: ['data/anuncios/'] });
  const feo = 'EAA' + 'Gm0PX4ZCps'.repeat(5); // secrets-ok: de mentira
  fs.mkdirSync(esp.ruta('data/anuncios'), { recursive: true }); fs.writeFileSync(esp.ruta('data/anuncios/avisados.json'), JSON.stringify({ error: `Meta dijo: token ${feo} inválido` }));
  await esp.flush();
  const f = await d1.prepare("select json from docs where clave = 'fs:data/anuncios/avisados.json'").first(); // secrets-ok: de mentira
  assert.ok(!f.json.includes(feo)); assert.match(f.json, /Meta dijo: token … inválido/);
  assert.ok(!fs.readFileSync(esp.ruta('data/anuncios/avisados.json'), 'utf8').includes(feo), 'ni en la carpeta de la petición');
  esp.cerrar();
});

test('borrar un archivo del espejo borra SOLO la versión que se trajo: si otra petición lo cambió, sigue', { skip: SALTAR }, async () => {
  const d1 = crearD1(); const v1 = await guardarDoc(d1, 'fs:data/anuncios/x.json', { t: '{"a":1}' });
  const esp = await abrirEspejo(d1, { prefijos: ['data/anuncios/'] });
  await guardarDoc(d1, 'fs:data/anuncios/x.json', { t: '{"a":2}' }, { espera: v1 }); // otra petición
  fs.rmSync(esp.ruta('data/anuncios/x.json')); await esp.flush(); esp.cerrar();
  assert.equal(JSON.parse((await leerDoc(d1, 'fs:data/anuncios/x.json')).valor.t).a, 2, 'lo del otro no se perdió');
  const esp2 = await abrirEspejo(d1, { prefijos: ['data/anuncios/'] }); fs.rmSync(esp2.ruta('data/anuncios/x.json')); await esp2.flush(); esp2.cerrar();
  assert.equal((await leerDoc(d1, 'fs:data/anuncios/x.json')).valor, null, 'sin carrera, sí se borra');
});

test('una segunda lectura de Meta a la vez dice «ya se está leyendo» (409) en vez de gastar la cuota dos veces', { skip: SALTAR }, async () => {
  const o = await nube();
  await o.d1.prepare('insert into anuncios_candados (clave, hasta, quien) values (?,?,?)').bind('anuncios:sync', Date.now() + 60000, 'otra').run();
  const x = await o.api('admin', 'POST', '/api/anuncios/sincronizar', {});
  assert.equal(x.status, 409); assert.match(x.j.motivo, /Ya se está leyendo/);
});

// ---------------------------------------------------------------- 8. el webhook público de conversiones
const URL_HOOK = 'https://oficina.test/api/anuncios/conversiones/webhook';
const hook = (o, cuerpo, cab = { 'x-office-token': 'hook-de-prueba-123' }, { crudo = null, metodo = 'POST' } = {}) => manejar(new Request(URL_HOOK, { method: metodo, headers: { 'content-type': 'application/json', ...cab }, body: metodo === 'GET' ? undefined : (crudo ?? JSON.stringify(cuerpo)) }), o.env); // secrets-ok: de mentira
const conConversiones = async (o) => guardarDoc(o.d1, 'config-local', { anuncios: { cuenta: CUENTA_STAND, topeDiario: 30, topeMensual: 300, topeCampana: 150, conversiones: true, pixel: '123456789' }, contenido: { modo: 'simulacro' } });

test('webhook: el token se comprueba ANTES de abrir nada, solo por cabecera, con el mismo 401 si falta la variable', { skip: SALTAR }, async () => {
  const o = await nube(); let consultas = 0; const prepare = o.d1.prepare; o.d1.prepare = (sql) => { consultas++; return prepare(sql); };
  const mal = await hook(o, { evento: 'Lead' }, { 'x-office-token': 'otro' });
  assert.equal(mal.status, 401); assert.equal(consultas, 0, 'con un token malo no se tocó D1: ni espejo, ni sesión, ni tasa');
  const sin = await hook(o, { evento: 'Lead' }, {}); assert.equal(sin.status, 401);
  assert.equal((await manejar(new Request(URL_HOOK + '?token=hook-de-prueba-123', { method: 'POST', body: '{"evento":"Lead"}' }), o.env)).status, 401, 'el token en la dirección no vale (queda en los registros)');
  assert.equal((await hook(o, { evento: 'Lead' }, { authorization: 'Bearer otro' })).status, 401);
  // sin la variable en el Worker: el MISMO 401 y el mismo cuerpo (no se dice «esta oficina no acepta webhooks»)
  const envSin = { ...o.env }; delete envSin.AO_HOOK_TOKEN;
  const a = await manejar(new Request(URL_HOOK, { method: 'POST', headers: { 'x-office-token': 'lo-que-sea' }, body: '{}' }), envSin);
  assert.equal(a.status, 401); assert.deepEqual(await a.json(), await mal.clone().json());
  const vacio = await manejar(new Request(URL_HOOK, { method: 'POST', headers: { 'x-office-token': '' }, body: '{}' }), envSin); assert.equal(vacio.status, 401, 'un token vacío tampoco entra cuando no hay variable');
  consultas = 0; await hook(o, { evento: 'Lead' }, { 'x-office-token': 'otro' });
  assert.equal((await manejar(new Request(URL_HOOK, { method: 'GET', headers: { 'x-office-token': 'hook-de-prueba-123' } }), o.env)).status, 401, 'un GET no es el webhook: sigue pidiendo sesión'); // secrets-ok: de mentira
});

test('webhook: Authorization Bearer vale; cuerpo de hasta 16 KB (413); un Origin de otra página no entra', { skip: SALTAR }, async () => {
  const o = await nube(); await conConversiones(o);
  const ok = await hook(o, { evento: 'Lead', url: 'https://tienda.test/f', id: 'a1', email: 'a@example.com' }, { authorization: 'Bearer hook-de-prueba-123' }); assert.equal(ok.status, 200, JSON.stringify(await ok.clone().json()));
  const grande = JSON.stringify({ evento: 'Lead', nota: 'x'.repeat(MAX_WEBHOOK_BYTES) });
  assert.equal((await hook(o, null, { 'x-office-token': 'hook-de-prueba-123', 'content-length': String(grande.length) }, { crudo: grande })).status, 413, 'declarado'); // secrets-ok: de mentira
  assert.equal((await manejar(new Request(URL_HOOK, { method: 'POST', headers: { 'x-office-token': 'hook-de-prueba-123' }, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(grande)); c.close(); } }), duplex: 'half' }), o.env)).status, 413, 'sin Content-Length: se corta al leer'); // secrets-ok: de mentira
  const justo = JSON.stringify({ evento: 'Lead', url: 'https://tienda.test/f', id: 'a2', email: 'b@example.com', nota: 'y'.repeat(MAX_WEBHOOK_BYTES - 200) });
  assert.ok(justo.length < MAX_WEBHOOK_BYTES); const rj = await hook(o, null, undefined, { crudo: justo }); assert.equal(rj.status, 200, JSON.stringify(await rj.clone().json()));
  assert.equal((await hook(o, { evento: 'Lead' }, { 'x-office-token': 'hook-de-prueba-123', origin: 'https://otra.test' })).status, 403); // secrets-ok: de mentira
  assert.equal((await hook(o, null, undefined, { crudo: 'esto no es json' })).status, 400);
  assert.equal((await hook(o, { evento: 'Baile' })).status, 400);
});

test('webhook: 60 por minuto en D1 (el 61 es 429); y sin event_id, el hash del cuerpo: el mismo cuerpo dos veces cuenta una', { skip: SALTAR }, async () => {
  const o = await nube(); await conConversiones(o);
  const cuerpo = { evento: 'Purchase', valor: 20, email: 'ana@example.com', url: 'https://tienda.test/p', pedido: 'p-1' }; // secrets-ok: de mentira
  const a = await (await hook(o, cuerpo)).json(), b = await (await hook(o, cuerpo)).json();
  assert.ok(!a.ya); assert.equal(b.ya, true, 'el mismo cuerpo, el mismo evento'); assert.equal(a.resumen.id, b.resumen.id);
  assert.match(a.resumen.id, /^wh_[0-9a-f]{40}$/, 'sin event_id, el id sale del hash del cuerpo');
  const c = await (await hook(o, { ...cuerpo, event_id: 'mi-evento-1' })).json(); assert.equal(c.resumen.id, 'mi-evento-1', 'si lo trae, se respeta');
  const ev = JSON.parse(JSON.parse((await o.d1.prepare("select json from docs where clave = 'fs:data/anuncios/conversiones.json'").first()).json).t).eventos; // secrets-ok: de mentira
  assert.equal(ev.length, 2); assert.ok(!JSON.stringify(ev).includes('ana@example.com'), 'el correo va cifrado');
  assert.equal(o.g.st.eventos.length, 0, 'el webhook APUNTA: no habla con Meta; lo manda el reloj');
  await cadaMinuto(o.env); assert.equal(o.g.st.eventos.length, 2);
  // el tope: ya van 3 en este minuto; hasta 60 pasan (eventos inválidos: no tocan el espejo y son baratos) y el 61 no
  const estados = []; for (let i = 0; i < MAX_WEBHOOK_POR_MINUTO; i++) estados.push((await hook(o, { evento: 'Baile' })).status);
  assert.ok(estados.slice(0, MAX_WEBHOOK_POR_MINUTO - 3).every((s) => s === 400)); assert.ok(estados.slice(-3).every((s) => s === 429), 'pasado el tope, 429');
  const t = await tasaPorMinuto(o.d1, 'webhook-conversiones', 60, { ahora: () => Date.now() + 120e3 }); assert.equal(t.ok, true, 'otro minuto, otra cuenta');
});

test('webhook: apagado → 409 en palabras; nunca devuelve datos personales; no necesita sesión', { skip: SALTAR }, async () => {
  const o = await nube();
  const r = await hook(o, { evento: 'Lead', url: 'https://tienda.test/f', email: 'luis@example.com', id: 'x' }); // secrets-ok: de mentira
  assert.equal(r.status, 409); const j = await r.json(); assert.match(j.motivo, /apagada/); assert.ok(!JSON.stringify(j).includes('luis@example.com'));
  assert.equal((await manejar(new Request('https://oficina.test/api/anuncios'), o.env)).status, 401, 'lo demás de /api/anuncios sigue pidiendo sesión');
});
