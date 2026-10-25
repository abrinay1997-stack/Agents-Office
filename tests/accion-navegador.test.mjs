// 25 oct 2026 — Ajustes → Conectores → «Búsqueda web» → Guardar, en Chromium real a 1280 y 390 px: red lenta, red caída, movimiento reducido.
// Se salta sin Chromium. Con AO_AXE=<axe.min.js> pasa axe sobre Ajustes.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let chromium = null;
for (const base of [import.meta.url, 'file:///opt/node22/lib/node_modules/']) { for (const m of ['playwright', 'playwright-core']) { try { ({ chromium } = createRequire(base)(m)); break; } catch { /* siguiente */ } } if (chromium) break; }
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SALTAR = chromium ? false : 'sin Playwright';
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
let nav = null, srv = null, base = '', dir = '';
before(async () => {
  if (SALTAR) return; nav = await chromium.launch().catch(() => null); if (!nav) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-accion-')); fs.mkdirSync(path.join(dir, 'data')); fs.cpSync(path.join(ROOT, 'brain'), path.join(dir, 'brain'), { recursive: true });
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: path.join(dir, 'brain'), AO_LOCAL_CONFIG: path.join(dir, 'local.json'), CLAUDE_BIN: path.join(dir, 'no-claude'), ANTHROPIC_API_KEY: 'test-key-not-real', TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', FAL_KEY: '' }; // secrets-ok
  srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: 'ignore' }); base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 160; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* aún */ } await new Promise(r => setTimeout(r, 250)); }
});
after(async () => { await nav?.close(); srv?.kill(); if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

async function conectores(ancho, opts = {}) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: ancho > 600 ? 800 : 844 }, reducedMotion: opts.reducido ? 'reduce' : 'no-preference' }), p = await ctx.newPage(); p.setDefaultTimeout(120000); // la página trae 3D: en una máquina cargada todo tarda
  await p.goto(base + '/'); await p.waitForSelector('#topbar'); await p.waitForTimeout(500); await p.keyboard.press(','); await p.waitForSelector('#setOv.on'); // la tecla «,»: a 390 px el engranaje está en el «⋯»
  await p.click('[data-tab="conectores"]'); await p.waitForSelector('#sgp [data-p="tools.web"]');
  return { p, ctx };
}
const estadoBoton = p => p.$eval('#setOv [data-a="save"]', b => ({ busy: b.getAttribute('aria-busy'), txt: b.textContent.trim(), cls: b.className }));

for (const ancho of [1280, 390]) {
  test(`Guardar con red lenta a ${ancho} px: ocupado en ≤100 ms, «Guardando…», luego «Guardado» y se anuncia`, { skip: SALTAR }, async (t) => {
    if (!nav) return t.skip('sin Chromium'); const { p, ctx } = await conectores(ancho);
    let posts = 0;
    await p.route('**/api/settings', async (r) => { if (r.request().method() === 'POST') { posts++; await new Promise(x => setTimeout(x, 1500)); } r.continue(); });
    await p.evaluate(() => { const c = document.querySelector('#sgp [data-p="tools.web"]'); c.click(); });
    assert.match(await p.$eval('#setOv .sg-st', e => e.textContent), /Sin guardar/); // la casilla cambió y la pantalla lo dice
    // la página real tiene 3D y cualquier clic de Playwright puede tardar: el tiempo se mide DENTRO de la página (clic → primer cambio visible)
    await p.evaluate(() => { const b = document.querySelector('#setOv [data-a="save"]'); window.__t = { st: [] }; new MutationObserver(() => window.__t.st.push(document.querySelector('#setOv .sg-st').textContent)).observe(document.querySelector('#setOv .sg-st'), { childList: true, characterData: true, subtree: true }); document.addEventListener('click', e => { if (e.target.closest('[data-a="save"]')) window.__t.clic ??= performance.now(); }, true);
      new MutationObserver(() => { if (b.classList.contains('ac-ok')) window.__t.ok ??= b.textContent; if (b.getAttribute('aria-busy') === 'true') { window.__t.busy ??= performance.now(); window.__t.txt ??= b.textContent; } }).observe(b, { attributes: true }); });
    await p.click('#setOv [data-a="save"]');
    await p.waitForFunction(() => window.__t.busy);
    const ms = await p.evaluate(() => window.__t.busy - window.__t.clic);
    console.log(`  primer cambio visible a ${ancho}px: ${ms.toFixed(1)} ms desde el clic`); assert.ok(ms < 100, `tardó ${ms} ms`);
    assert.match(await p.evaluate(() => window.__t.txt), /Guardando…/);
    await p.evaluate(() => { const b = document.querySelector('#setOv [data-a="save"]'); b.click(); b.click(); }); // doble clic: no manda otra petición
    const altoMin = await p.$eval('#setOv [data-a="save"]', b => b.getBoundingClientRect().height); if (ancho < 600) assert.ok(altoMin >= 44, `alto ${altoMin}`);
    await p.waitForFunction(() => window.__t.ok, null, { timeout: 20000 });
    assert.match(await p.evaluate(() => window.__t.ok), /✓\s*Guardado/);
    assert.equal(posts, 1);
    await p.waitForFunction(() => /Guardado/.test(document.getElementById('acLive')?.textContent || ''));
    const hist = await p.evaluate(() => window.__t.st); assert.ok(hist.includes('Guardando…') && hist.includes('Guardado ✓'), hist.join(' | ')); // «Sin guardar» → «Guardando…» → «Guardado ✓»
    await p.waitForFunction(() => document.querySelector('#setOv [data-a="save"]').textContent.trim() === 'Guardar', null, { timeout: 4000 });
    if (process.env.AO_AXE) { await p.addScriptTag({ path: process.env.AO_AXE }); const v = await p.evaluate(async () => (await axe.run('#setOv')).violations.map(x => x.id)); assert.deepEqual(v.filter(x => !['color-contrast'].includes(x)), []); }
    await ctx.close();
  });
}
test('red caída: error con el motivo (role=alert), «Reintentar», el botón se rehabilita y al volver la red guarda', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium'); const { p, ctx } = await conectores(390); let caida = true;
  await p.route('**/api/settings', async (r) => { if (r.request().method() === 'POST' && caida) return r.abort('connectionfailed'); r.continue(); });
  await p.click('#sgp [data-p="tools.web"]'); await p.click('#setOv [data-a="save"]');
  await p.waitForSelector('#setOv .ac-err[role="alert"]'); assert.match(await p.$eval('#setOv .ac-err', e => e.textContent), /Sin conexión/);
  const b = await estadoBoton(p); assert.match(b.txt, /Reintentar/); assert.equal(b.busy, null); assert.match(await p.$eval('#setOv .sg-st', e => e.textContent), /Sin guardar/);
  caida = false; await p.click('#setOv [data-a="save"]'); await p.waitForSelector('#setOv [data-a="save"].ac-ok'); assert.equal(await p.$('#setOv .ac-err'), null);
  await ctx.close();
});
test('cerrar Ajustes con cambios pendientes pregunta; «Seguir editando» los conserva', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium'); const { p, ctx } = await conectores(1280);
  await p.click('#sgp [data-p="tools.web"]'); await p.keyboard.press('Escape');
  await p.waitForSelector('#setOv .sg-warn'); assert.equal(await p.$eval('#setOv', e => e.hidden), false);
  await p.click('[data-a="warn-stay"]'); assert.equal(await p.$('#setOv .sg-warn'), null);
  await p.click('#setOv [data-a="save"]'); await p.waitForSelector('#setOv [data-a="save"].ac-ok'); await p.keyboard.press('Escape'); await p.waitForFunction(() => document.getElementById('setOv').hidden);
  await ctx.close();
});
test('movimiento reducido: el indicador no gira', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium'); const { p, ctx } = await conectores(1280, { reducido: true });
  await p.route('**/api/settings', async (r) => { if (r.request().method() === 'POST') await new Promise(x => setTimeout(x, 800)); r.continue(); });
  await p.click('#sgp [data-p="tools.web"]'); await p.click('#setOv [data-a="save"]'); await p.waitForSelector('#setOv .ac-sp');
  assert.equal(await p.$eval('#setOv .ac-sp', e => getComputedStyle(e).animationName), 'none'); await ctx.close();
});
test('un botón de los de antes (se apaga y dice «Enviando…») recibe aria-busy solo, y lo pierde al reactivarse', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium'); const { p, ctx } = await conectores(1280);
  const r = await p.evaluate(async () => { const b = document.createElement('button'); b.className = 'sg-btn'; b.textContent = 'Crear'; document.body.appendChild(b);
    b.disabled = true; b.textContent = 'Enviando…'; await new Promise(x => setTimeout(x, 20)); const a = b.getAttribute('aria-busy');
    b.disabled = false; b.textContent = 'Crear'; await new Promise(x => setTimeout(x, 20)); return [a, b.getAttribute('aria-busy')]; });
  assert.deepEqual(r, ['true', null]); await ctx.close();
});
