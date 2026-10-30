// Fase A6 de Anuncios (10 oct 2026): LA API DE CONVERSIONES (anuncios/conversiones.mjs). Lo puro (armar el evento, cifrar, el event_id
// que sale igual, los 7 días), la cola contra el Meta de mentira (idempotente, reintentos, descartar lo viejo, apagada), el ROAS con las
// ventas registradas, y el serve.mjs REAL: solo el dueño manda, un agente 403, el webhook pide AO_HOOK_TOKEN, nunca sale un correo o un
// teléfono en claro (ni en una respuesta, ni en data/, ni en el registro) y Estado dice «Conversiones» cuando está encendida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crearMetaStand, TOKEN_STAND } from './meta-stand.mjs';
import { crearMeta } from '../contenido/meta.mjs';
import { armarEvento, normEmail, normTelefono, sha256, idEvento, resumen, deDisparador, deConversacion, crearConversiones, DIAS_MAX } from '../anuncios/conversiones.mjs';
import { roasPosible, valores, IDS } from '../anuncios/indicadores.mjs';
import { validate as validarDisparadores } from '../triggers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const H = s => crypto.createHash('sha256').update(s).digest('hex');
const AHORA = Date.parse('2026-10-10T15:00:00Z');

test('normalizar y cifrar como pide Meta: correo en minúsculas, teléfono con código de país (Panamá por defecto)', () => {
  assert.equal(normEmail('  Ana.Perez@Gmail.COM '), 'ana.perez@gmail.com');
  assert.equal(normEmail('no es un correo'), '');
  assert.equal(normTelefono('(507) 6123-4567'), '50761234567');
  assert.equal(normTelefono('6123-4567'), '50761234567', '8 dígitos sin código: Panamá');
  assert.equal(normTelefono('+1 (650) 555-1212'), '16505551212');
  assert.equal(normTelefono('00 1 650 555 1212'), '16505551212', 'sin ceros delante');
  assert.equal(normTelefono('12'), '');
  assert.equal(sha256('john_smith@gmail.com'), H('john_smith@gmail.com'));
  assert.equal(idEvento({ origen: 'stripe', ref: 'pi_1', nombre: 'Purchase' }), idEvento({ origen: 'stripe', ref: 'pi_1', nombre: 'Purchase' }), 'el mismo hecho, el mismo id');
  assert.notEqual(idEvento({ origen: 'stripe', ref: 'pi_1', nombre: 'Purchase' }), idEvento({ origen: 'stripe', ref: 'pi_2', nombre: 'Purchase' }));
});

test('armarEvento: web, sistema y mensajes; nada personal en claro; las reglas de Meta', () => {
  const web = armarEvento({ nombre: 'Purchase', via: 'web', url: 'https://panaclaw.com/gracias', valor: 40, moneda: 'usd', email: 'Ana@X.com', telefono: '6123-4567', at: AHORA - 60e3 }, { ahora: AHORA });
  assert.deepEqual(web.errores, []);
  const e = web.evento;
  assert.equal(e.action_source, 'website'); assert.equal(e.event_source_url, 'https://panaclaw.com/gracias');
  assert.equal(e.event_time, Math.floor((AHORA - 60e3) / 1000), 'en segundos');
  assert.deepEqual(e.user_data.em, [H('ana@x.com')]); assert.deepEqual(e.user_data.ph, [H('50761234567')]);
  assert.deepEqual(e.custom_data, { value: 40, currency: 'USD' });
  assert.ok(!JSON.stringify(e).includes('ana@x.com') && !JSON.stringify(e).includes('6123'), 'nada en claro');
  assert.match(e.event_id, /^ao_[0-9a-f]{32}$/);
  assert.match(armarEvento({ nombre: 'Lead', via: 'web', email: 'a@b.co' }, { ahora: AHORA }).errores.join(), /event_source_url/);
  assert.match(armarEvento({ nombre: 'Purchase', via: 'sistema', email: 'a@b.co' }, { ahora: AHORA }).errores.join(), /importe/);
  assert.match(armarEvento({ nombre: 'Lead', via: 'sistema' }, { ahora: AHORA }).errores.join(), /reconocer a la persona/);
  assert.match(armarEvento({ nombre: 'Lead', via: 'sistema', email: 'a@b.co', at: AHORA - (DIAS_MAX + 1) * 864e5 }, { ahora: AHORA }).errores.join(), /7 días/);
  assert.match(armarEvento({ nombre: 'Lead', via: 'sistema', email: 'a@b.co', at: AHORA + 3600e3 }, { ahora: AHORA }).errores.join(), /futuro/);
  assert.match(armarEvento({ nombre: 'AddToCart', via: 'sistema', email: 'a@b.co' }, { ahora: AHORA }).errores.join(), /no es uno de los/);
  const pid = armarEvento({ nombre: 'Lead', via: 'sistema', email: 'a@b.co', eventId: 'pedido-77' }, { ahora: AHORA }).evento;
  assert.equal(pid.event_id, 'pedido-77', 'el eventID de tu píxel se respeta (deduplicar)');
  // mensajes
  const msn = armarEvento({ nombre: 'Lead', via: 'mensajes', canal: 'messenger', paginaId: 'P1', usuarioId: '998877' }, { ahora: AHORA }).evento;
  assert.equal(msn.event_name, 'LeadSubmitted'); assert.equal(msn.action_source, 'business_messaging'); assert.equal(msn.messaging_channel, 'messenger');
  assert.deepEqual(msn.user_data, { page_id: 'P1', page_scoped_user_id: '998877' }, 'page_id y PSID no se cifran');
  // decisión del dueño (10 oct 2026): «Registrar contacto calificado» manda QualifiedLead, y solo desde mensajes
  assert.equal(deConversacion({ id: 'meta:conv:1', tipo: 'conversaciones', fuente: 'meta', red: 'facebook', paginaId: 'P1', autorId: '998877' }, { tipo: 'contacto', ahora: AHORA }).nombre, 'QualifiedLead');
  assert.equal(armarEvento({ nombre: 'QualifiedLead', via: 'mensajes', canal: 'messenger', paginaId: 'P1', usuarioId: '998877' }, { ahora: AHORA }).evento.event_name, 'QualifiedLead');
  assert.match(armarEvento({ nombre: 'QualifiedLead', via: 'sistema', email: 'a@b.co' }, { ahora: AHORA }).errores.join(), /solo se manda desde una conversación/);
  const ig = armarEvento({ nombre: 'Purchase', via: 'mensajes', canal: 'instagram', igCuentaId: '178', usuarioId: '555', valor: 12 }, { ahora: AHORA }).evento;
  assert.deepEqual(ig.user_data, { instagram_business_account_id: '178', ig_sid: '555' });
  assert.match(armarEvento({ nombre: 'Purchase', via: 'mensajes', canal: 'whatsapp', wabaId: '1', valor: 5 }, { ahora: AHORA }).errores.join(), /ctwa_clid/);
  // el resumen nunca lleva datos ni hashes
  const r = resumen({ evento: e, estado: 'enviado' });
  assert.deepEqual(r.datos, ['em', 'ph']); assert.ok(!JSON.stringify(r).includes(H('ana@x.com')));
});

test('de un disparador (stripe → compra, form → contacto) y de una conversación de la Bandeja', () => {
  const stripe = { id: 'pagos', source: 'stripe' }, form = { id: 'web', source: 'form' };
  const c = deDisparador(stripe, { fields: { type: 'payment_intent.succeeded', amount: '40.00', currency: 'USD', email: 'a@b.co' }, eventId: 'evt_1' });
  assert.equal(c.nombre, 'Purchase'); assert.equal(c.valor, 40); assert.equal(c.ref, 'evt_1');
  assert.equal(deDisparador(stripe, { fields: { type: 'checkout.session.created', amount: '1' } }), null, 'un «created» no es una venta');
  assert.equal(deDisparador({ ...stripe, conversion: false }, { fields: { type: 'charge.succeeded', amount: '1' } }), null, 'conversion: false lo deja fuera');
  const l = deDisparador(form, { fields: { name: 'Ana', correo: 'a@b.co', url: 'https://panaclaw.com/contacto' }, eventId: 's1' });
  assert.equal(l.nombre, 'Lead'); assert.equal(l.via, 'web'); assert.equal(l.email, 'a@b.co');
  assert.equal(deDisparador({ id: 'x', source: 'email' }, { fields: { from: 'a' } }), null);
  // triggers.validate conserva `conversion`
  const v = validarDisparadores([{ id: 'pagos', dept: 'fin', source: 'stripe', text: 'x', conversion: false }], []);
  assert.equal(v.triggers[0].conversion, false);
  // la Bandeja
  const item = { id: 'meta:conv:9', tipo: 'conversaciones', fuente: 'meta', red: 'instagram', cuentaId: 'instagram:178', paginaId: 'P1', autorId: '555' };
  const venta = deConversacion(item, { tipo: 'venta', valor: 30, ahora: AHORA });
  assert.equal(venta.canal, 'instagram'); assert.equal(venta.igCuentaId, '178'); assert.equal(venta.nombre, 'Purchase');
  assert.equal(deConversacion(item, { tipo: 'venta', valor: 30, ahora: AHORA + 1000 }).ref, venta.ref, 'el doble clic del mismo minuto es la misma venta');
  assert.equal(deConversacion({ ...item, red: 'facebook' }, { tipo: 'contacto' }).canal, 'messenger');
  assert.throws(() => deConversacion({ ...item, tipo: 'comentarios' }, { tipo: 'venta' }), /conversación privada/);
});

function cola({ ajustes = {}, stand = crearMetaStand(), reloj = { t: Date.now() } } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-conv-'));
  const meta = crearMeta({ env: { META_ACCESS_TOKEN: TOKEN_STAND, META_GRAPH_HOST: 'https://graph.test' }, fetchFn: stand.fetchFn, dir });
  const auditoria = [], avisos = [];
  const c = crearConversiones({ meta, archivo: path.join(dir, 'conversiones.json'), ajustes: () => ({ conversiones: true, pixel: '123456789', ...ajustes }), ahora: () => reloj.t, auditar: a => auditoria.push(a), avisar: t => avisos.push(t) });
  return { c, stand, dir, auditoria, avisos, reloj };
}

test('la cola: idempotente por event_id, manda por el cliente de Meta, reintenta lo pasajero, descarta lo de más de 7 días', async () => {
  const { c, stand, dir, auditoria, reloj } = cola();
  const entrada = { nombre: 'Purchase', via: 'sistema', valor: 25, email: 'ana@x.com', origen: 'stripe', ref: 'pi_1' };
  const r1 = c.registrar(entrada), r2 = c.registrar(entrada);
  assert.equal(r2.ya, true, 'el mismo hecho no entra dos veces'); assert.equal(r1.resumen.id, r2.resumen.id);
  assert.deepEqual(await c.tick(), { enviados: 1, fallos: 0 });
  assert.equal(stand.st.eventos.length, 1); assert.deepEqual(stand.st.eventos[0].user_data.em, [H('ana@x.com')]); assert.equal(stand.st.eventos[0].prueba, null, 'un evento de verdad no lleva test_event_code');
  assert.equal(stand.de('POST', '/123456789/events')[0].h.authorization, `Bearer ${TOKEN_STAND}`, 'por el cliente: el token en la cabecera');
  assert.ok(!stand.de('POST', '/123456789/events')[0].url.search.includes('access_token'), 'nunca en la dirección');
  assert.deepEqual(c.ventas(0), { compras: 1, vendido: 25 });
  // pasajero: se reintenta
  stand.st.fallar.conversiones = 1;
  c.registrar({ nombre: 'Lead', via: 'sistema', telefono: '61234567', ref: 'f1' });
  assert.deepEqual(await c.tick(), { enviados: 0, fallos: 1 });
  let e = c.estado(); assert.equal(e.pendientes, 1); assert.ok(e.ultimoError);
  assert.deepEqual(await c.tick(), { enviados: 0, fallos: 0 }, 'espera su hora');
  reloj.t += 61e3; assert.deepEqual(await c.tick(), { enviados: 1, fallos: 0 });
  // lo que esperó más de 7 días se descarta sin llamar a Meta
  stand.st.fallar.conversiones = 1;
  c.registrar({ nombre: 'Lead', via: 'sistema', email: 'b@x.com', ref: 'f2' });
  await c.tick(); const n = stand.llamadas.length;
  reloj.t += 8 * 864e5; await c.tick();
  assert.equal(stand.llamadas.length, n); e = c.estado(); assert.equal(e.ultimos.find(x => x.estado === 'descartado')?.evento, 'Lead');
  // nada personal en el archivo ni en la auditoría
  const disco = fs.readFileSync(path.join(dir, 'conversiones.json'), 'utf8') + JSON.stringify(auditoria) + JSON.stringify(c.estado());
  for (const pii of ['ana@x.com', 'b@x.com', '61234567']) assert.ok(!disco.includes(pii), `${pii} no aparece`);
  assert.ok(!JSON.stringify(auditoria).includes(H('ana@x.com')), 'el registro ni siquiera lleva el hash');
});

test('apagada no registra; un tipo que no se manda, tampoco; un error de Meta que no es pasajero falla y avisa; probar usa el código', async () => {
  const off = cola({ ajustes: { conversiones: false } });
  assert.throws(() => off.c.registrar({ nombre: 'Lead', via: 'sistema', email: 'a@b.co' }), e => e.status === 409 && /apagada/.test(e.message));
  const solo = cola({ ajustes: { conversionesEventos: ['compra'] } });
  assert.throws(() => solo.c.registrar({ nombre: 'Lead', via: 'sistema', email: 'a@b.co' }), e => e.status === 409);
  assert.throws(() => solo.c.registrar({ nombre: 'Purchase', via: 'sistema', email: 'a@b.co' }), e => e.status === 422, 'una venta sin importe');
  const x = cola({ stand: crearMetaStand({ torcer: l => (l.ruta.endsWith('/events') ? new Response(JSON.stringify({ error: { message: 'Invalid parameter', code: 100 } }), { status: 400 }) : null) }) });
  x.c.registrar({ nombre: 'Lead', via: 'sistema', email: 'a@b.co', ref: 'z' });
  assert.deepEqual(await x.c.tick(), { enviados: 0, fallos: 1 });
  assert.equal(x.c.estado().fallos, 1); assert.equal(x.avisos.length, 1);
  const p = cola({ ajustes: { conversionesPrueba: 'TEST4321' } });
  const r = await p.c.probar(); assert.equal(r.ok, true);
  assert.equal(p.stand.st.eventos[0].prueba, 'TEST4321'); assert.equal(p.c.estado().hoy.enviados, 0, 'la prueba no cuenta como evento de hoy');
  await assert.rejects(() => cola().c.probar(), e => e.status === 409, 'sin código no se prueba');
});

test('el ROAS con las ventas registradas cuando el píxel no lo da (y dice de dónde sale)', () => {
  const filas = [{ spend: '20' }, { spend: '30' }];
  assert.equal(roasPosible({ pixel: true, filas30: filas }).puede, false);
  const rp = roasPosible({ pixel: true, filas30: filas, registradas: { compras: 2, vendido: 150 } });
  assert.equal(rp.puede, true); assert.equal(rp.fuente, 'oficina'); assert.match(rp.motivo, /registraste/);
  const v = valores({ filas30: filas, pixel: true, registradas: { compras: 2, vendido: 150 } });
  assert.equal(v[IDS.roas], 3); assert.equal(v.roasFuente, 'oficina');
  assert.equal(valores({ filas30: filas, pixel: true }).roasFuente, null);
});

test('la interfaz: «Medir» dice apagada o encendida en palabras; la conversación ofrece registrar solo con la API encendida', async () => {
  const { conversionesHTML: medir } = await import('../src/anuncios/informe.js');
  const conv = await import('../src/contenido-conversacion.js');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  assert.equal(medir(null), '');
  const off = medir({ encendida: false });
  assert.match(off, /apagada/); assert.match(off, /web/); assert.match(off, /mensajes/); assert.match(off, /data-a="ajustes"/);
  const on = medir({ encendida: true, listo: true, prueba: true, hoy: { enviados: 3, compras: 1, contactos: 2 }, ultimoError: 'Meta no aceptó', ultimoErrorAt: '2026-10-10T10:00:00Z', ultimoEnvioAt: '2026-10-10T09:00:00Z', fallos: 1 });
  assert.match(on, /Hoy: 3 evento/); assert.match(on, /Último error/); assert.match(on, /data-a="conv-probar"/);
  assert.doesNotMatch(medir({ encendida: true, listo: true, prueba: false, hoy: {} }), /conv-probar/, 'sin código de prueba no se ofrece probar');
  const m = { id: 'meta:conv:1', fuente: 'meta', tipo: 'conversaciones', red: 'facebook', autor: 'Ana', estado: 'nuevo', mensajes: [], ventana: null };
  conv.ponerEstadoConversiones(null);
  assert.equal(conv.conversionesHTML(m, { esc, id: 'x' }), '', 'sin la API encendida, nada');
  conv.ponerEstadoConversiones({ encendida: true, listo: true, eventos: ['compra', 'contacto'] });
  const h = conv.conversionesHTML(m, { esc, id: 'x' });
  assert.match(h, /data-bjconv="venta"/); assert.match(h, /data-bjconv="contacto"/); assert.match(h, /<label class="bj-conv-imp" for="x-imp">/, 'el importe con su etiqueta');
  conv.ponerEstadoConversiones({ encendida: true, listo: true, eventos: ['contacto'] });
  assert.doesNotMatch(conv.conversionesHTML(m, { esc, id: 'x' }), /data-bjconv="venta"/, 'solo lo que el dueño eligió');
});

/* ---------- el serve.mjs real ---------- */
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const esperar = async (fn, { max = 30000, cada = 200, que = 'algo' } = {}) => { const t0 = Date.now(); for (;;) { const r = await fn(); if (r) return r; if (Date.now() - t0 > max) throw new Error(`no llegó a tiempo: ${que}`); await new Promise(x => setTimeout(x, cada)); } };

// «hoy» de la cola es el día LOCAL de la máquina (mismoDia): si el test cruza la medianoche entre el primer envío y la lectura de Estado, «enviados hoy» baja a 1.
// Antes de empezar se espera (como mucho ~20 s) a que falten al menos 20 s para la medianoche local; no cambia lo que se afirma.
async function sinCruzarMedianoche(margenS = 20) {
  const resto = () => { const n = new Date(), f = new Date(n); f.setHours(24, 0, 0, 0); return (f - n) / 1000; };
  for (let i = 0; i < 2 * margenS + 4 && resto() < margenS; i++) await new Promise(r => setTimeout(r, 500));
}

test('serve.mjs: solo el dueño manda (un agente 403), el webhook pide su clave, nada personal sale, y Estado dice «Conversiones»', { timeout: 120000 }, async t => {
  await sinCruzarMedianoche();
  const g = crearMetaStand(), graph = await g.escuchar();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-conv-srv-')), brain = path.join(dir, 'brain'), local = path.join(dir, 'office.config.local.json');
  fs.mkdirSync(brain, { recursive: true });
  fs.writeFileSync(local, JSON.stringify({ anuncios: { conversiones: true, pixel: '123456789', conversionesPrueba: 'TEST777' } }));
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const HOOK = 'una-clave-de-prueba-larga-0123456789'; // secrets-ok: de mentira
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: local, AO_HOOK_TOKEN: HOOK,
    ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', CLAUDE_BIN: path.join(dir, 'no-claude.exe'),
    META_ACCESS_TOKEN: TOKEN_STAND, META_APP_SECRET: '', META_GRAPH_HOST: graph.url, META_GRAPH_VERSION: '',
    TELEGRAM_BOT_TOKEN: '', METRICOOL_USER_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '', VOYAGE_API_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  t.after(async () => { srv.kill(); await graph.cerrar(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  const base = `http://127.0.0.1:${port}`;
  await esperar(async () => { try { return (await fetch(base + '/api/health')).ok; } catch { return false; } }, { que: 'la oficina arranca: ' + log.slice(-300) });
  const crudo = [];
  const call = async (p, b, headers = {}) => { const r = await fetch(base + p, { method: b ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...headers }, ...(b ? { body: JSON.stringify(b) } : {}) }); const tx = await r.text(); crudo.push(tx); let j = {}; try { j = JSON.parse(tx); } catch {} return { status: r.status, j }; };

  // un agente nunca manda; Dimitri y el asistente tampoco
  for (const por of ['agente', 'dimitri', 'asistente']) assert.equal((await call('/api/anuncios/conversiones', { por, tipo: 'venta', valor: 10, email: 'ana@x.com' })).status, 403, por);
  assert.equal((await call('/api/anuncios/conversiones/probar', { por: 'agente' })).status, 403);
  assert.equal(g.st.eventos.length, 0);
  // el dueño: una venta con correo → sale en el acto, cifrada
  const v = await call('/api/anuncios/conversiones', { tipo: 'venta', valor: 45, email: 'Ana@X.com', telefono: '6123-4567' });
  assert.equal(v.status, 200, JSON.stringify(v.j)); assert.equal(v.j.resumen.estado, 'enviado'); assert.equal(v.j.resumen.evento, 'Purchase');
  assert.deepEqual(g.st.eventos[0].user_data.em, [H('ana@x.com')]);
  assert.equal((await call('/api/anuncios/conversiones', { tipo: 'venta', email: 'a@b.co' })).status, 422, 'una venta sin importe');
  // probar
  const p = await call('/api/anuncios/conversiones/probar', {}); assert.equal(p.status, 200, JSON.stringify(p.j)); assert.equal(g.st.eventos.at(-1).prueba, 'TEST777');
  // el webhook: sin clave 401; con clave, un Lead de la web
  assert.equal((await call('/api/anuncios/conversiones/webhook', { evento: 'Lead', email: 'w@x.com', url: 'https://panaclaw.com' })).status, 401);
  const w = await call('/api/anuncios/conversiones/webhook', { evento: 'Lead', email: 'w@x.com', url: 'https://panaclaw.com/contacto', event_id: 'pedido-1' }, { 'x-office-token': HOOK });
  assert.equal(w.status, 200, JSON.stringify(w.j));
  await esperar(() => g.st.eventos.some(e => e.event_id === 'pedido-1' && e.action_source === 'website'), { que: 'el Lead del webhook llega a Meta' });
  // el estado (también en GET /api/anuncios) y Estado
  const e = (await call('/api/anuncios/conversiones?por=agente')).j;
  assert.equal(e.encendida, true); assert.equal(e.hoy.enviados, 2); assert.equal(e.hoy.compras, 1);
  assert.equal((await call('/api/anuncios')).j.conversiones?.encendida, true);
  const st = (await call('/api/status')).j, linea = (st.checks || []).find(c => c.id === 'conversiones');
  assert.ok(linea, 'Estado tiene «Conversiones»'); assert.equal(linea.state, 'ok', linea.detail);
  // nada personal en claro: ni en las respuestas, ni en data/, ni en el registro
  const enDisco = []; const leer = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const x = path.join(d, f.name); if (f.isDirectory()) leer(x); else enDisco.push(fs.readFileSync(x, 'utf8')); } };
  leer(path.join(dir, 'data'));
  const todo = crudo.join('\n') + enDisco.join('\n');
  for (const pii of ['ana@x.com', 'Ana@X.com', 'w@x.com', '6123-4567', '61234567']) assert.ok(!todo.includes(pii), `${pii} no sale en claro`);
  const audit = enDisco.filter(x => x.includes('"kind":"conversiones"')).join('\n');
  assert.ok(audit.includes('"que":"enviar"'), 'cada envío queda en data/audit/'); assert.ok(!audit.includes(H('ana@x.com')), 'el registro no lleva hashes');
});
