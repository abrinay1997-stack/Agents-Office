// «Publicar ahora» (CON-04, fase 2 PR 2) en Chromium con la oficina de verdad (temporal, sin keys): apagado por defecto (el menú sigue con lo de siempre), y encendido
// (contenido.publicarYa + modo real + Meta directo) pide un segundo clic con el aviso de que NO se puede deshacer, y solo entonces el servidor aprueba «ya».
// Se salta sin Playwright o sin Chromium.
import test from 'node:test';
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
const SALTAR = !chromium ? 'sin Playwright' : false;
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));

async function levantar(contenido) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-ya-nav-')), data = path.join(dir, 'data'), brain = path.join(dir, 'brain');
  fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
  const local = path.join(dir, 'local.json'); fs.writeFileSync(local, JSON.stringify({ contenido }));
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: local, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_API_KEY: 'no-real', TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', METRICOOL_USER_ID: '', METRICOOL_BLOG_ID: '', GEMINI_API_KEY: '', HF_KEY: '', FAL_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* aún no */ } await new Promise(r => setTimeout(r, 250)); }
  const api = async (m, p, b) => (await fetch(base + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json();
  return { base, api, cerrar: () => { srv.kill(); fs.rmSync(dir, { recursive: true, force: true }); } };
}
async function abrirPieza(nav, o, titulo) {
  const pz = (await o.api('POST', '/api/contenido/piezas', { titulo, texto: 'Examen visual gratis esta semana en Panamá.', redes: ['facebook'], estado: 'revision' })).pieza;
  const page = await nav.newPage({ viewport: { width: 1512, height: 900 } }); page.setDefaultTimeout(20000);
  await page.addInitScript(() => { try { localStorage.setItem('ao.onboarded', '1'); } catch { /* sin storage */ } });
  await page.goto(o.base + '/'); await page.waitForTimeout(1500);
  await page.keyboard.press('Escape'); await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('k'); await page.waitForSelector('#ctOv .ct-mode', { state: 'visible' }); await page.waitForTimeout(600);
  await page.click(`#ctOv [data-id="${pz.id}"], #ctOv :text("${titulo}")`); await page.waitForSelector('.ct-panel:not([hidden]) .pz-comp');
  await page.waitForTimeout(1200); // los ajustes de Contenido llegan detrás
  await page.click('.ct-panel:not([hidden]) [data-a="menu"]'); await page.waitForSelector('.ct-panel:not([hidden]) .pz-menu:not([hidden])');
  return { page, pz };
}

test('«Publicar ahora» apagado: el menú es el de siempre y no hay botón nuevo', { skip: SALTAR }, async t => {
  const nav = await chromium.launch(); t.after(() => nav.close());
  const o = await levantar({ modo: 'simulacro', redes: ['instagram', 'facebook'] }); t.after(o.cerrar);
  const { page } = await abrirPieza(nav, o, 'Apagado');
  assert.equal(await page.locator('.ct-panel [data-a="ahora"]').count(), 0);
  assert.equal(await page.locator('.ct-panel [data-a="ya"]').count(), 1, 'sigue el «Publicar ya» antiguo');
});

test('«Publicar ahora» encendido: el segundo clic con el aviso de que no se deshace, y solo entonces el servidor aprueba «ya»', { skip: SALTAR }, async t => {
  const nav = await chromium.launch(); t.after(() => nav.close());
  const o = await levantar({ modo: 'real', conductor: 'meta', publicarYa: true, redes: ['instagram', 'facebook'] }); t.after(o.cerrar);
  const { page, pz } = await abrirPieza(nav, o, 'Encendido');
  const P = '.ct-panel:not([hidden]) ', boton = P + '[data-a="ahora"]';
  assert.equal(await page.locator(P + '[data-a="ya"]').count(), 0, 'reemplaza al antiguo');
  assert.match(await page.textContent(boton), /Publicar ahora/);
  assert.equal((await o.api('GET', `/api/contenido/piezas/${pz.id}`)).pieza.estado, 'revision');
  await page.click(boton); await page.waitForTimeout(200);
  assert.match(await page.textContent(boton), /Pulsa otra vez/);
  assert.match(await page.textContent(P + '.pz-ya-av'), /No se puede deshacer/);
  assert.equal((await o.api('GET', `/api/contenido/piezas/${pz.id}`)).pieza.estado, 'revision', 'un clic no aprueba nada');
  await page.click(boton); await page.waitForTimeout(100); // un segundo clic demasiado rápido (doble clic, Enter mantenido) no confirma
  assert.equal((await o.api('GET', `/api/contenido/piezas/${pz.id}`)).pieza.estado, 'revision', 'sin haber leído el aviso no se publica');
  await page.waitForTimeout(800);
  assert.match(await page.textContent(P + '.pz-ya-av'), /No se puede deshacer/);
  assert.equal(await page.locator(P + '.pz-menu .pz-ya-av').count(), 0, 'el aviso va fuera del menú');
  await page.click(boton); await page.waitForTimeout(1500);
  const { pieza } = await o.api('GET', `/api/contenido/piezas/${pz.id}`);
  assert.equal(pieza.estado, 'aprobada'); assert.equal(pieza.aprobada.ya, true);
  assert.match(await page.textContent(P + '.pz-state'), /Publicando|Publicada|No se pudo/);
});

test('CON-07: en escritorio el paso marcado sigue lo que se mira (arriba el 1, al final el 4) y al hacer clic sigue siendo el que se pulsó', { skip: SALTAR }, async t => {
  const nav = await chromium.launch(); t.after(() => nav.close());
  const o = await levantar({ modo: 'simulacro', redes: ['instagram', 'facebook'] }); t.after(o.cerrar);
  const { page } = await abrirPieza(nav, o, 'Pasos');
  await page.keyboard.press('Escape'); // cierra el menú
  const actual = () => page.evaluate(() => document.querySelector('.ct-panel .pz-steps [aria-current="step"]')?.dataset.paso);
  assert.equal(await actual(), '1');
  await page.evaluate(() => { const b = document.querySelector('.ct-panel .pz-scroll'); b.style.maxHeight = '300px'; b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(500);
  assert.equal(await actual(), '4', 'al final del cuerpo, el paso 4');
  await page.evaluate(() => { document.querySelector('.ct-panel .pz-scroll').scrollTop = 0; }); await page.waitForTimeout(500);
  assert.equal(await actual(), '1', 'arriba, el 1');
  await page.click('.ct-panel .pz-steps [data-paso="2"]'); await page.waitForTimeout(700);
  assert.equal(await actual(), "2", "el clic marca el pulsado");
});
