// Ajustes → «Restablecer oficina» y «Revisar lo que leí» en un navegador de verdad (Chromium), contra el serve.mjs real (carpeta temporal, Claude de mentira), a 1280 y a 390 px, en claro y oscuro.
// Mira lo que solo un navegador ve: que las pestañas aparecen, que no se sale nada a lo ancho, que los botones miden 24 px o más, que la confirmación pide escribir RESTABLECER, que los conflictos se pintan
// en ámbar con «en tu Cerebro dice X / en tu web dice Y», y que lo que el servidor dice se pinta como TEXTO. Capturas en data/capturas/ajustes-extra/ (se ignoran en git).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let chromium = null;
for (const base of [import.meta.url, 'file:///opt/node22/lib/node_modules/']) { for (const m of ['playwright', 'playwright-core']) { try { ({ chromium } = createRequire(base)(m)); break; } catch { /* siguiente */ } } if (chromium) break; }
const SALTAR = chromium ? false : 'Playwright no está instalado';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'data', 'capturas', 'ajustes-extra');
const escuchar = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const escribir = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
const MODELO = { perfil: 'PanaClaw hace webs y eBots para negocios.\nNuestra web básica cuesta US$ 390.\nLlámanos al +507 6000-1234.', oferta: '| Web básica | US$ 390 |\n| eBot | US$ 120 |', cifras: [{ name: 'Web básica', value: '390', unit: 'US$' }], briefs: { marketing: 'Habla de tú <b>siempre</b>.' } };

async function oficina(t) {
  const claude = http.createServer((rq, rs) => { let b = ''; rq.on('data', (d) => { b += d; }); rq.on('end', () => { rs.writeHead(200, { 'content-type': 'application/json' }); rs.end(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(MODELO) }], usage: { input_tokens: 10, output_tokens: 10 } })); }); });
  const cport = await escuchar(claude), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-ui-')), brain = path.join(dir, 'brain'), data = path.join(dir, 'data');
  escribir(path.join(brain, '10-Business', 'precios-webs.md'), '# Precios de webs\n| Web básica | US$ 450 |\n| eBot | US$ 120 |\nWhatsApp: +507 6999-0000 [[perfil]]\n'); escribir(path.join(brain, '00-Empresa', 'perfil.md'), '---\nfuente: el dueño\n---\n# Perfil de la empresa\n\nPanaClaw hace webs.\nNuestra web básica cuesta US$ 450. [[precios-webs]]\n');
  escribir(path.join(data, 'tasks.json'), JSON.stringify([{ id: 'abc12345', text: 'vieja', title: 'vieja', dept: 'ops', agent: 'olead', state: 'done', doneAt: Date.now(), addedAt: Date.now(), result: 'hecho' }]));
  const probe = http.createServer(), port = await escuchar(probe); await new Promise((r) => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'office.config.local.json'), ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
  t.after(() => { srv.kill(); claude.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ya */ } });
  const base = `http://127.0.0.1:${port}`; for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* aún no */ } await new Promise((r) => setTimeout(r, 250)); }
  return { base, dir, brain, data, api: async (p, b) => (await fetch(base + p, { method: b ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json(), log: () => log };
}

/** Lo que se mide en cada pantalla: nada se sale a lo ancho, los botones miden 24 px o más, la letra no baja de 10,5 px. */
const medir = (pagina) => pagina.evaluate(() => {
  const pane = document.querySelector('#setOv .sg-pane'), box = document.querySelector('#setOv .sg-box');
  const chicos = [...pane.querySelectorAll('button, input[type=checkbox], input[type=radio], input[type=text]')].filter((e) => e.offsetParent).map((e) => { const r = (e.closest('label') || e).getBoundingClientRect(); return { t: e.id || e.textContent.trim().slice(0, 30) || e.type, h: Math.round(r.height), w: Math.round(r.width) }; }).filter((x) => x.h < 24 || x.w < 24);
  const letra = [...pane.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim() && e.offsetParent).map((e) => [e.tagName + '.' + e.className, parseFloat(getComputedStyle(e).fontSize)]).filter((x) => x[1] < 10.5);
  return { desborda: pane.scrollWidth > pane.clientWidth + 1 || box.scrollWidth > box.clientWidth + 1, chicos, letra, pagina: document.documentElement.scrollWidth > innerWidth + 1 };
});
const axe = async (p, que) => {
  if (!process.env.AO_AXE) return;
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: process.env.AO_AXE });
  const r = await p.evaluate(async () => (await window.axe.run('#setOv .sg-pane', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 2).map((n) => n.html.slice(0, 90)).join(' | ')}`));
  assert.deepEqual(r, [], `axe en ${que}`);
};
const abrirAjustes = async (p, tab) => { await p.waitForSelector('#topSettings', { state: 'attached' }); await p.waitForTimeout(800); await p.keyboard.press(','); await p.waitForSelector('#setOv:not([hidden])'); await p.waitForSelector(`#setOv [data-tab="${tab}"]`, { timeout: 15000 }); await p.click(`#setOv [data-tab="${tab}"]`); };

for (const [ancho, alto, tema] of [[1280, 800, 'light'], [390, 844, 'dark']]) {
  test(`UI ${ancho}px (${tema}): Restablecer oficina — modos, casillas por defecto, confirmación escribiendo RESTABLECER, respaldo y restaurar`, { skip: SALTAR, timeout: 420000 }, async (t) => {
    const o = await oficina(t), nav = await chromium.launch().catch(() => null); if (!nav) return t.skip('sin Chromium'); t.after(() => nav.close());
    fs.mkdirSync(OUT, { recursive: true });
    const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, colorScheme: tema }), p = await ctx.newPage(); p.setDefaultTimeout(60000); const errores = []; p.on('pageerror', (e) => errores.push(e.message));
    await p.addInitScript((tm) => { try { localStorage.setItem('ao.theme', tm); } catch { /* sin almacenamiento */ } }, tema);
    await p.goto(o.base); await abrirAjustes(p, 'restablecer');
    const tabs = await p.$$eval('#setOv .sg-tabs [role=tab]', (l) => l.map((x) => x.textContent.trim())); assert.ok(tabs.includes('Restablecer oficina') && tabs.includes('Revisar lo que leí'), tabs.join());
    await p.waitForSelector('.ax-modo');
    assert.equal(await p.locator('#setOv [data-a="save"]').isHidden(), true, 'estas pestañas no tienen Guardar');
    // sin elegir modo no hay casillas ni botón
    assert.equal(await p.locator('#axRevisar').count(), 0);
    await p.click('label.ax-modo:has(input[value=vacia])');
    assert.deepEqual(await p.$$eval('.ax-ck input:checked', (l) => l.length), 10, 'en «Vacía» todo viene marcado');
    await p.click('label.ax-modo:has(input[value=panaclaw])');
    assert.deepEqual(await p.$$eval('.ax-ck input:checked', (l) => l.map((x) => x.value)), ['cerebro', 'habilidades'], 'en «PanaClaw por defecto» solo Cerebro y Habilidades');
    assert.match(await p.textContent('.ax-conserva'), /Nunca se toca:.*llaves y secretos.*conectores.*auditoría/);
    await p.screenshot({ path: path.join(OUT, `restablecer-modos-${ancho}-${tema}.png`) });
    await axe(p, 'local · modos'); const m1 = await medir(p); assert.deepEqual([m1.desborda, m1.pagina, m1.letra, m1.chicos], [false, false, [], []], JSON.stringify(m1));
    // paso 1: revisar lo que va a pasar (no cambia nada)
    await p.click('label.ax-modo:has(input[value=vacia])'); await p.click('#axRevisar'); await p.waitForSelector('#axPalabra');
    assert.equal((await o.api('/api/brain')).notes, 2, 'pedir no cambia nada');
    assert.equal(await p.locator('#axConfirmar').isDisabled(), true); await p.fill('#axPalabra', 'restablecer'); assert.equal(await p.locator('#axConfirmar').isDisabled(), true, 'en minúsculas no vale');
    await p.fill('#axPalabra', 'RESTABLECER'); assert.equal(await p.locator('#axConfirmar').isDisabled(), false);
    await p.screenshot({ path: path.join(OUT, `restablecer-confirmar-${ancho}-${tema}.png`) });
    await axe(p, 'local · confirmar'); const m2 = await medir(p); assert.deepEqual([m2.desborda, m2.pagina, m2.letra, m2.chicos], [false, false, [], []], JSON.stringify(m2));
    // cambiar una casilla cierra la confirmación (hay que volver a revisar)
    await p.click('label.ax-ck:has(input[value=kpis])'); assert.equal(await p.locator('#axPalabra').count(), 0, 'cambiar lo marcado pide volver a revisar');
    await p.click('#axRevisar'); await p.fill('#axPalabra', 'RESTABLECER'); await p.click('#axConfirmar');
    await p.waitForSelector('[data-restaurar]', { timeout: 20000 });
    assert.equal((await o.api('/api/brain')).notes, 0, 'el Cerebro quedó vacío'); assert.match(await p.textContent('#setOv .sg-msg'), /Respaldo guardado hasta el/);
    await axe(p, 'local · hecho'); await p.screenshot({ path: path.join(OUT, `restablecer-hecho-${ancho}-${tema}.png`) });
    // restaurar: dos pulsaciones
    await p.evaluate(() => { const b = document.querySelector('[data-restaurar]'); b.click(); window.__t1 = b.textContent; b.click(); }); assert.match(await p.evaluate(() => window.__t1), /otra vez/);
     await p.waitForFunction(() => /Restaurado|No se pudo|no |Error/i.test(document.querySelector('#setOv .sg-msg').textContent) && !/Restableciendo/.test(document.querySelector('#setOv .sg-msg').textContent) && !/^Listo/.test(document.querySelector('#setOv .sg-msg').textContent), null, { timeout: 150000 });
    assert.match(await p.textContent('#setOv .sg-msg'), /Restaurado/, 'mensaje de restauración');
    assert.equal((await o.api('/api/brain')).notes, 2, 'el respaldo devolvió el Cerebro');
    assert.deepEqual(errores, []);
    await ctx.close();
  });

  test(`UI ${ancho}px (${tema}): Preparar desde mi web → Revisar lo que leí — conflictos en ámbar, elegir por nota y por dato, aplicar sin pisar, deshacer; el HTML del servidor es texto`, { skip: SALTAR, timeout: 420000 }, async (t) => {
    const o = await oficina(t), nav = await chromium.launch().catch(() => null); if (!nav) return t.skip('sin Chromium'); t.after(() => nav.close());
    fs.mkdirSync(OUT, { recursive: true });
    const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, colorScheme: tema }), p = await ctx.newPage(); p.setDefaultTimeout(60000); const errores = []; p.on('pageerror', (e) => errores.push(e.message));
    await p.addInitScript((tm) => { try { localStorage.setItem('ao.theme', tm); } catch { /* sin almacenamiento */ } }, tema);
    await p.goto(o.base); await abrirAjustes(p, 'empresa');
    await p.fill('#sgAbout', 'Hacemos webs. La web básica cuesta US$ 390. Tel +507 6000-1234.');
    await p.click('#setOv [data-a="bootstrap"]');
    await p.waitForSelector('.ax-nota', { timeout: 30000 });
    assert.equal(await p.locator('#setOv [role=tab][aria-selected=true]').textContent(), 'Revisar lo que leí', 'el botón lleva a revisar, no escribe directo');
    assert.ok(!fs.existsSync(path.join(o.brain, '00-Empresa', 'oferta.md')), 'todavía no se escribió nada');
    await axe(p, 'local · revisar');
    // los conflictos, en ámbar y con las dos versiones
    const conf = await p.$$eval('.ax-conf', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ')));
    assert.ok(conf.some((c) => /Precio distinto/.test(c) && /En tu Cerebro dice.*US\$ 450.*precios-webs/.test(c) && /En tu web dice.*US\$ 390/.test(c)), conf.join(' | '));
    assert.equal(await p.$$eval('.ax-nota.conf', (l) => l.length) >= 1, true);
    const color = await p.$eval('.ax-conf', (e) => getComputedStyle(e).borderTopColor); assert.notEqual(color, 'rgba(0, 0, 0, 0)');
    // por defecto: lo nuevo se crea y lo que ya existía se queda como estaba; el modelo escribió HTML en una instrucción y se ve como texto
    assert.equal(await p.inputValue('input[name=ax-perfil]:checked'), 'mio'); assert.equal(await p.inputValue('input[name=ax-oferta]:checked'), 'aplicar');
    assert.equal(await p.$$eval('#setOv .ax b', (l) => l.filter((x) => x.textContent === 'siempre').length), 0, 'el <b> del servidor no se interpreta');
    await p.screenshot({ path: path.join(OUT, `revisar-${ancho}-${tema}.png`), fullPage: false });
    const m = await medir(p); assert.deepEqual([m.desborda, m.pagina, m.letra, m.chicos], [false, false, [], []], JSON.stringify(m));
    // aplicar lo elegido
    const perfilAntes = fs.readFileSync(path.join(o.brain, '00-Empresa', 'perfil.md'), 'utf8');
    await p.click('#axAplicar'); await p.waitForFunction(() => /Ya apliqué/.test(document.querySelector('#setOv .sg-pane').textContent), null, { timeout: 20000 });
    assert.equal(fs.readFileSync(path.join(o.brain, '00-Empresa', 'perfil.md'), 'utf8'), perfilAntes, 'tu perfil no se tocó (la elección era «quedarme con lo mío»)');
    assert.ok(fs.existsSync(path.join(o.brain, '00-Empresa', 'oferta.md')));
    assert.match(fs.readFileSync(path.join(o.brain, '00-Empresa', 'oferta.md'), 'utf8'), /^---\nfuente: el dueño /, 'sin web, la fuente es lo que contó el dueño');
    await p.screenshot({ path: path.join(OUT, `revisar-aplicada-${ancho}-${tema}.png`) });
    await p.click('#axDeshacer'); await p.waitForFunction(() => /Deshecho/.test(document.querySelector('#setOv .sg-msg').textContent), null, { timeout: 20000 });
    assert.ok(!fs.existsSync(path.join(o.brain, '00-Empresa', 'oferta.md')), 'deshacer quita lo que se creó');
    assert.deepEqual(errores, []);
    await ctx.close();
  });
}
