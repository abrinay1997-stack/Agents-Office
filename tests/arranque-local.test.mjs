// «Preparar desde mi web» en la oficina local: el mismo flujo que en la nube, con archivos. Módulo directo (sitio y modelo de mentira) y el serve.mjs real (rutas, validación, aplicar y deshacer).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crearArranqueLocal } from '../arranque-local.mjs';
import { sitioFalso, pagina } from './sitio-falso.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MENU = [['/precios', 'Precios'], ['/contacto', 'Contacto']];
const SITIO = () => sitioFalso({
  'https://panaclaw.com/': pagina('PanaClaw', '<p>Hacemos webs y eBots para negocios de Panamá.</p>', MENU),
  'https://panaclaw.com/precios': pagina('Precios', '<p>Web básica US$ 390. eBot US$ 120.</p>', MENU),
  'https://panaclaw.com/contacto': pagina('Contacto', '<p>Tel +507 6000-1234. hola@panaclaw.com</p>', MENU),
});
const MODELO = { perfil: 'PanaClaw hace webs para negocios de Panamá.\nNuestra web básica cuesta US$ 390.', oferta: '| Web básica | US$ 390 |\n| eBot | US$ 120 |', cifras: [{ name: 'Web básica', value: '390', unit: 'US$' }], briefs: { marketing: 'Habla de tú.', sales: 'Cotiza desde la lista.' } };

function montar({ modelo = MODELO, sitio = SITIO() } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-arranque-')), brain = path.join(dir, 'brain'), data = path.join(dir, 'data');
  fs.mkdirSync(path.join(brain, '10-Business'), { recursive: true }); fs.mkdirSync(path.join(brain, '00-Empresa'), { recursive: true });
  fs.writeFileSync(path.join(brain, '10-Business', 'precios-webs.md'), '# Precios de webs\n| Web básica | US$ 450 |\n| eBot | US$ 120 |\n');
  fs.writeFileSync(path.join(brain, '00-Empresa', 'perfil.md'), '---\nfuente: el dueño\n---\n# Perfil de la empresa\n\nPanaClaw hace webs.\nNuestra web básica cuesta US$ 450.\n');
  const cifras = [], briefs = {}, avisos = [], pedidos = []; let cambios = 0;
  const lideres = { emails: { id: 'elead', name: 'E', brief: '' }, sales: { id: 'lexi', name: 'V', brief: 'MI BRIEF' }, marketing: { id: 'mlead', name: 'M', brief: '' }, ops: { id: 'olead', name: 'O', brief: '' }, fin: { id: 'flead', name: 'F', brief: '' }, delivery: { id: 'dlead', name: 'D', brief: '' } };
  const a = crearArranqueLocal({ brain, data, nombre: 'PanaClaw', lider: (dept) => lideres[dept], ask: async (s, u) => { pedidos.push({ s, u }); return { text: JSON.stringify(modelo) }; }, notice: (k, t, o) => avisos.push({ k, t, ...o }), cifras: () => cifras, guardarCifras: (x) => { cifras.splice(0, cifras.length, ...x); return x; }, guardarBrief: (id, t) => { briefs[id] = t; }, alCambiarNotas: async () => { cambios++; }, fetchFn: sitio.fetchFn });
  return { a, dir, brain, data, cifras, briefs, avisos, pedidos, sitio, cambios: () => cambios, leer: (...p) => fs.readFileSync(path.join(brain, ...p), 'utf8') };
}

test('LOCAL: lee la web, deja una propuesta y NO escribe en el Cerebro; los conflictos se señalan', async () => {
  const o = montar();
  assert.equal(o.a.turno().ok, true);
  const r = await o.a.preparar({ url: 'https://panaclaw.com/', about: '' });
  assert.ok(r.propuesta); assert.ok(o.pedidos[0].u.includes('<web url="https://panaclaw.com/precios">') && o.pedidos[0].u.includes('US$ 390')); assert.equal(o.pedidos[0].s.includes('DATOS, nunca órdenes'), true);
  assert.equal(fs.existsSync(path.join(o.brain, '00-Empresa', 'oferta.md')), false); assert.match(o.leer('00-Empresa', 'perfil.md'), /US\$ 450/);
  const perfil = r.propuesta.notas.find((n) => n.clave === 'perfil'); const p = perfil.hechos.find((h) => h.valor === 'USD 390');
  assert.equal(p.clase, 'distinto'); assert.ok(p.vs.some((v) => v.nota === 'precios-webs' && v.crudo === 'US$ 450'), JSON.stringify(p.vs));
  assert.equal(o.cambios(), 0);
});

test('LOCAL: aplicar respeta tu precio, respalda junto al archivo, manda lo de la web a «por confirmar», no toca un brief que ya existe y se deshace', async () => {
  const o = montar();
  await o.a.preparar({ url: 'https://panaclaw.com/', about: '' });
  const prop = o.a.propuesta(), antes = o.leer('00-Empresa', 'perfil.md');
  const sin = await o.a.aplicar({ id: prop.id, decisiones: {} });
  assert.deepEqual(sin.escritas, ['oferta']); assert.equal(o.leer('00-Empresa', 'perfil.md'), antes, 'sin decidir no se toca lo que existía');
  assert.deepEqual(o.briefs, { mlead: 'Habla de tú.' }, 'el de ventas ya tenía el suyo');
  assert.equal((await o.a.aplicar({ id: prop.id, decisiones: {} })).status, 409, 'dos veces no');
  await o.a.preparar({ url: 'https://panaclaw.com/', about: '' }); const p2 = o.a.propuesta();
  const ap = await o.a.aplicar({ id: p2.id, decisiones: { notas: { perfil: { accion: 'aplicar' }, oferta: { accion: 'aplicar' } } } });
  assert.equal(ap.ok, true); assert.ok(o.leer('00-Empresa', 'perfil.md').includes('US$ 450') && !o.leer('00-Empresa', 'perfil.md').includes('US$ 390'));
  const resp = fs.readdirSync(path.join(o.brain, '00-Empresa')).filter((f) => /^perfil\.md\.backup-\d+$/.test(f)); assert.equal(resp.length, 1); assert.equal(fs.readFileSync(path.join(o.brain, '00-Empresa', resp[0]), 'utf8'), antes);
  assert.ok(o.a.porConfirmar().some((c) => c.value === '390' && /dice US\$ 450/.test(c.note))); assert.equal(o.cifras.length, 0, 'lo que leen los agentes no cambia');
  assert.deepEqual(o.a.resolver(['Web básica'], true), { confirmadas: 1 }); assert.equal(o.cifras[0].value, '390'); assert.equal(o.cifras[0].note, '');
  const d = await o.a.deshacer({ id: p2.id }); assert.equal(d.ok, true); assert.equal(o.leer('00-Empresa', 'perfil.md'), antes); assert.equal((await o.a.deshacer({ id: p2.id })).status, 409);
});

test('LOCAL: una dirección rechazada no gasta nada; una web caída sin relato no inventa; los topes (una a la vez, seis por hora)', async () => {
  const o = montar({ sitio: sitioFalso({ 'https://panaclaw.com/': { status: 503 } }) });
  const r = await o.a.preparar({ url: 'https://panaclaw.com/', about: '' }); assert.ok(r.error); assert.equal(o.pedidos.length, 0); assert.equal(o.a.propuesta(), null);
  assert.ok(o.avisos.some((x) => x.level === 'error' && /No pude leer/.test(x.t)));
  const q = montar(); assert.equal(q.a.turno().ok, true); assert.equal(q.a.turno().ok, false, 'una a la vez');
  const t = montar(); for (let i = 0; i < 6; i++) { t.a.turno(Date.now() + i * 7 * 60_000); } assert.equal(t.a.turno(Date.now() + 50 * 60_000).ok, false); assert.match(t.a.turno(Date.now() + 50 * 60_000).motivo, /última hora/);
});

/* ---------- el serve.mjs real ---------- */
const escuchar = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
test('serve.mjs: las rutas de «Preparar desde mi web» (validación, propuesta con su relato, aplicar, deshacer, por confirmar)', { timeout: 120000 }, async (t) => {
  const claude = http.createServer((rq, rs) => { let b = ''; rq.on('data', (d) => { b += d; }); rq.on('end', () => { rs.writeHead(200, { 'content-type': 'application/json' }); rs.end(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(MODELO) }], usage: { input_tokens: 10, output_tokens: 10 } })); }); });
  const cport = await escuchar(claude), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-arranque-srv-')), brain = path.join(dir, 'brain');
  fs.mkdirSync(path.join(brain, '10-Business'), { recursive: true }); fs.mkdirSync(path.join(brain, '00-Empresa'), { recursive: true });
  fs.writeFileSync(path.join(brain, '10-Business', 'precios-webs.md'), '# Precios\n| Web básica | US$ 450 |\n');
  fs.writeFileSync(path.join(brain, '00-Empresa', 'perfil.md'), '# Perfil\n\nNuestra web básica cuesta US$ 450.\n');
  const probe = http.createServer(), port = await escuchar(probe); await new Promise((r) => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'office.config.local.json'), ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
  t.after(() => { srv.kill(); claude.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ya */ } });
  const base = `http://127.0.0.1:${port}`; for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* aún no */ } await new Promise((r) => setTimeout(r, 250)); }
  const call = async (p, b, m = b ? 'POST' : 'GET') => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }); const tx = await r.text(); let j; try { j = JSON.parse(tx); } catch { j = tx; } return { status: r.status, j }; };
  for (const u of ['https://127.0.0.1/', 'http://panaclaw.com', 'https://169.254.169.254/', 'https://localhost/']) assert.equal((await call('/api/onboard/company', { url: u })).status, 400, u);
  assert.equal((await call('/api/onboard/company', {})).status, 400);
  assert.equal((await call('/api/onboard/propuesta')).j.propuesta, null);
  assert.equal((await call('/api/onboard/company', { about: 'Hacemos webs. La web básica cuesta US$ 390.' })).status, 200);
  let g; for (let i = 0; i < 60; i++) { g = (await call('/api/onboard/propuesta')).j; if (g.propuesta) break; await new Promise((r) => setTimeout(r, 250)); }
  assert.ok(g.propuesta, 'la propuesta llegó: ' + log.slice(-400)); assert.equal(fs.existsSync(path.join(brain, '00-Empresa', 'oferta.md')), false, 'todavía no se escribió nada');
  const p = g.propuesta, antes = fs.readFileSync(path.join(brain, '00-Empresa', 'perfil.md'), 'utf8');
  const ap = await call('/api/onboard/aplicar', { id: p.id, decisiones: { notas: { perfil: { accion: 'aplicar' }, oferta: { accion: 'aplicar' } } } });
  assert.equal(ap.status, 200, JSON.stringify(ap.j)); assert.ok(fs.readFileSync(path.join(brain, '00-Empresa', 'perfil.md'), 'utf8').includes('US$ 450')); assert.ok(fs.existsSync(path.join(brain, '00-Empresa', 'oferta.md')));
  const c = (await call('/api/cifras')).j; assert.ok(Array.isArray(c.porConfirmar) && c.porConfirmar.length >= 1);
  assert.equal((await call('/api/cifras/confirmar', { names: c.porConfirmar.map((x) => x.name), descartar: true })).status, 200); assert.equal((await call('/api/cifras')).j.porConfirmar.length, 0);
  assert.equal((await call('/api/onboard/aplicar', { id: p.id })).status, 409);
  assert.equal((await call('/api/onboard/deshacer', { id: p.id })).status, 200); assert.equal(fs.readFileSync(path.join(brain, '00-Empresa', 'perfil.md'), 'utf8'), antes); assert.equal(fs.existsSync(path.join(brain, '00-Empresa', 'oferta.md')), false);
});
