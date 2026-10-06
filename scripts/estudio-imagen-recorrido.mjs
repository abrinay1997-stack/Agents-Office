// Herramienta de desarrollo (no entra en `npm run check`): el recorrido de la auditoría del Estudio de imagen
// (docs/auditoria-estudio-imagen-2026-10-06.md). Levanta una oficina temporal con un Google simulado (imágenes de verdad por el
// motor, sin key real ni gasto) y recorre Básico, el resultado, la ficha, el visor, Editar, Variar, un fallo, el Historial,
// Avanzado, el banco, el escenario 3D y Lotes a 1440 (claro y oscuro) y 390 px. Mide controles visibles, tamaños de letra,
// radios, objetivos de menos de 24 px, el orden del foco y, si hay axe-core, sus violaciones.
//   node scripts/estudio-imagen-recorrido.mjs          → data/capturas/estudio-imagen/ (+ informe.json)
//   AO_AXE=/ruta/a/axe.min.js node scripts/...         → con axe-core (npm i axe-core en una carpeta aparte)
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'estudio-imagen'); fs.mkdirSync(OUT, { recursive: true });
const AXE = process.env.AO_AXE && fs.existsSync(process.env.AO_AXE) ? fs.readFileSync(process.env.AO_AXE, 'utf8') : null;
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));
const wait = ms => new Promise(r => setTimeout(r, ms));
const report = {};

// --- Google simulado: tarda 7 s, falla si el prompt dice FALLA
let n = 0;
const pngOf = async () => { n++; const h = (n * 67) % 360; return sharp({ create: { width: 1024, height: 1024, channels: 3, background: `hsl(${h},60%,55%)` } }).png().toBuffer(); };
const g = http.createServer((req, res) => { let b = ''; req.on('data', d => { b += d; }); req.on('end', async () => {
  const body = b ? JSON.parse(b) : {}; const txt = JSON.stringify(body);
  await wait(7000);
  if (/FALLA/.test(txt)) { res.writeHead(400, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { code: 400, message: 'Request contains an invalid argument.', status: 'INVALID_ARGUMENT' } })); }
  if (/:generateContent$/.test(req.url)) { const p = await pngOf(); res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: p.toString('base64') } }] } }] })); }
  res.writeHead(404); res.end('{}');
}); });
const gport = await listen(g);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-aud-')), brain = path.join(dir, 'brain'), data = path.join(dir, 'data');
fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana.\n');
const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), ANTHROPIC_API_KEY: '', CLAUDE_BIN: path.join(dir, 'no-claude'),
  TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: 'falsa', AO_GEMINI_BASE: `http://127.0.0.1:${gport}`, HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '' };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 160; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await wait(250); }

const S = '#studioOv';
const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
let browser; try { browser = await chromium.launch({ executablePath: process.env.AO_CHROME || undefined, args: ARGS }); } catch { browser = await chromium.launch({ channel: 'chrome', args: ARGS }); }
const shot = async (p, name, o = {}) => { await p.screenshot({ path: path.join(OUT, name + '.png'), ...o }); console.log('📷', name); };
async function axe(p, name, include = S) {
  if (!AXE) return;
  await p.evaluate(AXE); const r = await p.evaluate(async inc => { const x = await window.axe.run(inc, { resultTypes: ['violations'] }); return x.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, ej: v.nodes.slice(0, 4).map(nd => nd.target.join(' ') + ' :: ' + (nd.failureSummary || '').split('\n').slice(1, 2).join(' ')) })); }, include);
  report['axe:' + name] = r; console.log('axe', name, r.map(v => `${v.id}(${v.impact})×${v.n}`).join(', ') || 'limpio');
}
async function medir(p, name) {
  report['medidas:' + name] = await p.evaluate(s => {
    const root = document.querySelector(s); const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden]'); };
    const ctl = [...root.querySelectorAll('button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')].filter(vis);
    const peq = ctl.filter(e => { const r = e.getBoundingClientRect(); return (r.width < 24 || r.height < 24) && !e.matches('input[type=checkbox],input[type=radio]'); }).map(e => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} "${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 30)}" ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`);
    const txt = [...root.querySelectorAll('*')].filter(e => vis(e) && [...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())).map(e => parseFloat(getComputedStyle(e).fontSize));
    const fonts = {}; txt.forEach(f => { fonts[f] = (fonts[f] || 0) + 1; });
    const gen = root.querySelector('.st-gen'); const genCtl = gen ? ctl.filter(e => gen.contains(e)).length : 0;
    const families = new Set([...root.querySelectorAll('*')].filter(vis).map(e => getComputedStyle(e).fontFamily.split(',')[0]));
    const radios = {}; [...root.querySelectorAll('button')].filter(vis).forEach(b => { const r = getComputedStyle(b).borderRadius; radios[r] = (radios[r] || 0) + 1; });
    return { controles: ctl.length, controlesCompositor: genCtl, menoresDe24: peq.slice(0, 40), nMenores24: peq.length, tamaños: fonts, familias: [...families], radiosBotones: radios, scrollX: document.documentElement.scrollWidth > innerWidth + 1 };
  }, S);
}

try {
  // ===== Escritorio 1440 claro =====
  let c = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); let p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/'); await p.waitForTimeout(2500);
  await p.keyboard.press('e'); await p.waitForSelector(`${S}.on`); await p.waitForTimeout(1500);
  await p.click(`${S} [data-kind="image"]`).catch(() => {}); await p.waitForTimeout(500);
  await shot(p, '01-basico-1440');
  await medir(p, 'basico-1440'); await axe(p, 'basico-1440');
  // compositor entero
  report.compositorAlto = await p.evaluate(() => document.querySelector('#studioOv .st-scroll').scrollHeight);
  await p.setViewportSize({ width: 1440, height: Math.min(2200, report.compositorAlto + 260) }); await p.waitForTimeout(400);
  await shot(p, '02-basico-compositor-entero'); await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(300);
  // orden de tabulación
  await p.click(`${S} .st-name`); const tabs = [];
  for (let i = 0; i < 45; i++) { await p.keyboard.press('Tab'); tabs.push(await p.evaluate(() => { const e = document.activeElement; return `${e.tagName.toLowerCase()}${e.className ? '.' + String(e.className).split(' ')[0] : ''} «${(e.getAttribute('aria-label') || e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 40)}»`; })); }
  report.tabOrden = tabs;
  // lista de modelos
  await p.click(`${S} .st-mpick`); await p.waitForTimeout(500); await shot(p, '03-lista-modelos');
  report.modelosImagen = await p.evaluate(() => [...document.querySelectorAll('#studioOv .st-mo')].map(b => ({ name: b.querySelector('b')?.textContent, on: !b.disabled })));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  if (await p.isVisible(`${S} .st-mlist`)) { await p.click(`${S} .st-mlist .st-mo:not([disabled])`); await p.waitForTimeout(300); }
  // Más ajustes
  await p.evaluate(() => { const d = document.querySelector('#studioOv .st-more'); if (d) d.open = true; document.querySelector('#studioOv .st-ratios')?.scrollIntoView(); }); await p.waitForTimeout(300);
  await shot(p, '04-formato-y-ajustes');
  // GENERAR vacío
  await p.click(`${S} .st-go`); await p.waitForTimeout(600); await shot(p, '05-error-prompt-vacio');
  report.errorVacio = await p.evaluate(() => ({ ferr: document.querySelector('#studioOv .st-ferr')?.textContent, msg: document.querySelector('#studioOv .st-msg')?.textContent, ariaInvalid: document.querySelector('#studioOv .st-prompt').getAttribute('aria-invalid'), describedby: document.querySelector('#studioOv .st-prompt').getAttribute('aria-describedby') }));
  // generar 2
  await p.fill(`${S} .st-prompt`, 'Taza de café humeante sobre una mesa de madera, luz de mañana');
  await p.click(`${S} .st-qty [data-d="1"]`); await p.waitForTimeout(200);
  report.estimacion = await p.textContent(`${S} .st-est`); report.resumenPie = await p.textContent(`${S} .st-sum`); report.botonGo = await p.textContent(`${S} .st-go`);
  await p.click(`${S} .st-go`); await p.waitForTimeout(2600); await shot(p, '06-generando');
  report.msgGenerando = await p.textContent(`${S} .st-msg`);
  await p.waitForTimeout(17000); await shot(p, '07-resultado');
  report.msgListo = await p.textContent(`${S} .st-msg`);
  await medir(p, 'galeria-1440'); await axe(p, 'galeria-1440');
  report.grupoHTML = await p.evaluate(() => document.querySelector('#studioOv .st-grid .st-card:not(.st-job)')?.innerText);
  await p.locator(`${S} button:has-text("Ver por separado"):visible`).first().click().catch(e => console.log('sep?', e.message)); await p.waitForTimeout(800);
  await shot(p, '07b-por-separado');
  // hover tarjeta + menú
  const card = `${S} .st-grid .st-card:not(.st-job):visible`; await p.hover(card).catch(() => {}); await p.waitForTimeout(300); await shot(p, '08-tarjeta-hover', { clip: await p.locator(card).first().boundingBox().then(b => ({ x: b.x - 10, y: b.y - 10, width: Math.min(700, b.width + 20), height: b.height + 20 })) });
  report.tarjetaHTML = await p.locator(card).first().evaluate(e => e.innerText);
  await p.locator(`${card} [data-a="menu"], ${card} .st-more`).first().click().catch(() => {}); await p.waitForTimeout(300); await shot(p, '09-menu-tarjeta');
  await p.keyboard.press('Escape');
  // visor
  await p.locator(`${S} .st-grid .st-thumb:visible, ${S} .st-grid .st-gt:visible`).first().click(); await p.waitForTimeout(800); await shot(p, '10-visor');
  report.visorAcciones = await p.evaluate(() => [...document.querySelectorAll('#studioOv .st-light button, #studioOv .st-light a')].filter(e => e.offsetParent).map(e => (e.getAttribute('aria-label') || e.textContent).trim().replace(/\s+/g, ' ')));
  await axe(p, 'visor', '#studioOv .st-light');
  await p.click(`${S} .st-light [data-l="edit"]`).catch(() => {}); await p.waitForTimeout(500); await shot(p, '11-visor-editar');
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // Variar: ¿qué pasa con lo que había en el compositor?
  await p.fill(`${S} .st-prompt`, 'TEXTO A MEDIO ESCRIBIR');
  await p.locator(card).first().hover(); await p.locator(`${card} .st-more`).first().click(); await p.waitForTimeout(200);
  await p.locator(`${S} .st-menu:not([hidden]) [data-a="vary"]`).first().click().catch(e => console.log('vary?', e.message)); await p.waitForTimeout(1500);
  report.trasVariar = { prompt: await p.inputValue(`${S} .st-prompt`), msg: await p.textContent(`${S} .st-msg`), trabajos: await p.locator(`${S} .st-job`).count() };
  await shot(p, '12-tras-variar');
  // fallo
  await p.fill(`${S} .st-prompt`, 'FALLA esta a propósito'); await p.click(`${S} .st-go`); await p.waitForTimeout(12000);
  await shot(p, '13-fallo'); report.fallo = await p.evaluate(() => ({ tile: document.querySelector('#studioOv .st-job.failed')?.innerText, msg: document.querySelector('#studioOv .st-msg')?.textContent }));
  // Historial
  await p.click(`${S} .st-histbtn`); await p.waitForTimeout(800); await shot(p, '14-historial'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // ===== Avanzado =====
  await p.click(`${S} [data-nivel="avanzado"]`); await p.waitForSelector(`${S} .bk-doors`, { timeout: 20000 }); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector('#studioOv .st-scroll').scrollTop = 0);
  await shot(p, '15-avanzado');
  report.avanzado = await p.evaluate(() => { const v = s => { const e = document.querySelector(s); return !!e && !!e.offsetParent; }; return { pasos: [...document.querySelectorAll('#studioOv .st-gen .st-h')].filter(e => e.offsetParent).map(h => h.textContent.trim().replace(/\s+/g, ' ')), matstepVisible: v('#studioOv .st-matstep'), bancoRefs: v('#studioOv .bk'), modo: document.querySelector('#studioOv .bk-modo')?.textContent, puertaPulsada: document.querySelector('#studioOv [data-puerta][aria-pressed="true"]')?.textContent }; });
  await p.setViewportSize({ width: 1440, height: 2000 }); await p.waitForTimeout(300); await shot(p, '16-avanzado-entero'); await p.setViewportSize({ width: 1440, height: 900 });
  await medir(p, 'avanzado-1440'); await axe(p, 'avanzado-1440');
  await p.click(`${S} .st-prompt`); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  report.escEnPromptCierra = await p.evaluate(() => !document.querySelector('#studioOv').classList.contains('on') || document.querySelector('#studioOv').hidden);
  if (report.escEnPromptCierra) { await p.keyboard.press('e'); await p.waitForTimeout(1000); }
  await p.locator(`${S} button:has-text("Banco"):visible`).first().click(); await p.waitForTimeout(1200); await shot(p, '17-banco');
  report.banco = await p.evaluate(() => ({ grupos: [...document.querySelectorAll('#studioOv .st-bank [data-grupo], #studioOv .st-bank .bk-g')].length, tarjetas: [...document.querySelectorAll('#studioOv .st-bank [role=option], #studioOv .st-bank .bk-card')].length, texto: document.querySelector('#studioOv .st-bank')?.innerText.slice(0, 1500) }));
  await axe(p, 'banco', '#studioOv .st-bank');
  const first = p.locator(`${S} .st-bank .bk-card, ${S} .st-bank [role=option]`).first(); await first.click().catch(() => {}); await p.waitForTimeout(800);
  await shot(p, '18-banco-preset-elegido');
  report.trasPreset = await p.evaluate(() => ({ est: document.querySelector('#studioOv .st-est')?.textContent, go: document.querySelector('#studioOv .st-go')?.textContent, p3: document.querySelector('#studioOv .st-p3t')?.textContent, modo: document.querySelector('#studioOv .bk-modo')?.textContent }));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const e3 = p.locator(`${S} button:has-text("escenario 3D")`).first(); if (await e3.count()) { await e3.click(); await p.waitForTimeout(2500); await shot(p, '19-escenario-3d'); report.escena = await p.evaluate(() => document.querySelector('#studioOv .st-bank')?.innerText.slice(0, 1500)); await axe(p, 'escena3d', '#studioOv .st-bank'); }
  // Lotes
  await p.keyboard.press('Escape'); await p.click(`${S} [data-pt="lotes"]`).catch(() => {}); await p.waitForTimeout(1200); await shot(p, '20-lotes');
  report.erroresPagina = errs.slice();
  await c.close();

  // ===== oscuro 1440 =====
  c = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', colorScheme: 'dark' }); p = await c.newPage();
  await p.goto(base + '/'); await p.waitForTimeout(2000); await p.evaluate(() => { document.body.classList.add('dark'); document.documentElement.dataset.theme = 'dark'; try { localStorage.setItem('ao.theme', '"dark"'); } catch {} });
  await p.keyboard.press('e'); await p.waitForSelector(`${S}.on`); await p.waitForTimeout(1200); await p.click(`${S} [data-nivel="basico"]`).catch(() => {}); await p.waitForTimeout(500);
  await shot(p, '21-basico-oscuro'); await axe(p, 'basico-oscuro');
  await p.locator(`${S} .st-grid .st-thumb:visible, ${S} .st-grid .st-gt:visible`).first().click().catch(() => {}); await p.waitForTimeout(800); await shot(p, '22-visor-oscuro');
  await c.close();

  // ===== teléfono 390 =====
  c = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' }); p = await c.newPage();
  await p.goto(base + '/'); await p.waitForTimeout(2000);
  await p.keyboard.press('e'); await p.waitForSelector(`${S}.on`); await p.waitForTimeout(1200);
  await shot(p, '23-movil-entrada');
  await p.click(`${S} [data-pt="gen"]`).catch(() => {}); await p.waitForTimeout(400); await shot(p, '24-movil-crear');
  await p.evaluate(() => document.querySelector('#studioOv .st-scroll').scrollTop = 600); await p.waitForTimeout(300); await shot(p, '25-movil-crear-abajo');
  await medir(p, 'movil-crear');
  await p.click(`${S} [data-pt="gal"]`).catch(() => {}); await p.waitForTimeout(600); await shot(p, '26-movil-galeria'); await medir(p, 'movil-galeria');
  await p.locator(`${S} .st-grid .st-thumb:visible, ${S} .st-grid .st-gt:visible`).first().tap().catch(() => {}); await p.waitForTimeout(800); await shot(p, '27-movil-visor');
  await p.keyboard.press('Escape'); await p.click(`${S} [data-pt="gen"]`).catch(() => {}); await p.click(`${S} [data-nivel="avanzado"]`).catch(() => {}); await p.waitForTimeout(2500); await shot(p, '28-movil-avanzado');
  await c.close();
} catch (e) { console.error('ERROR', e); report.error = String(e.stack || e); }
finally { await browser.close(); srv.kill(); g.close(); fs.writeFileSync(path.join(OUT, 'informe.json'), JSON.stringify(report, null, 1)); fs.writeFileSync(path.join(OUT, 'servidor.log'), log); fs.rmSync(dir, { recursive: true, force: true }); }
console.log(`hecho · ${OUT}${AXE ? '' : ' (sin axe: AO_AXE no apunta a axe.min.js)'}`);
