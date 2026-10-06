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
// Fase 1 de la auditoría (6 oct 2026): lo que ya no debe pasar. Cada ✗ cuenta y el proceso sale con 1.
let malos = 0; const ok = (paso, cond, detalle) => { if (!cond) malos++; console.log(`${cond ? '✓' : '✗'} ${paso}${detalle ? ' — ' + detalle : ''}`); report.fase1 = [...(report.fase1 || []), { paso, ok: !!cond, detalle: detalle || '' }]; };

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
  // ===== Fase 5 =====
  const bas = await p.evaluate(() => { const v = e => !!e && !!e.offsetParent, q = s => document.querySelector('#studioOv ' + s), sc = q('.st-scroll');
    const ctl = [...q('.st-gen').querySelectorAll('button, a[href], input, select, textarea, summary')].filter(e => v(e) && !e.closest('[hidden]'));
    return { controles: ctl.length, lista: ctl.map(e => (e.getAttribute('aria-label') || e.textContent || e.className).trim().slice(0, 18)), cabe: sc.scrollHeight <= sc.clientHeight + 2, ideaArriba: q('.st-prompt').getBoundingClientRect().top < q('.st-mpick').getBoundingClientRect().top, modelo: q('.st-mpick .st-mp-name')?.textContent, qsel: [...q('.st-qsel').options].map(o => o.value).join(','), imagen: v(q('.st-addimg')), formato: v(q('.st-arsel')), numeros: [...document.querySelectorAll('#studioOv .st-step > .st-h > b')].some(v) }; });
  ok('IMG-32 · Básico: 14 controles o menos y cabe sin desplazarse', bas.controles <= 14 && bas.cabe, JSON.stringify({ n: bas.controles, cabe: bas.cabe, lista: bas.lista }));
  ok('IMG-34 · la idea va primero y los pasos sin números', bas.ideaArriba && !bas.numeros, JSON.stringify(bas));
  ok('IMG-36 · el modelo es «Automático» y dice cuál usa', /^Automático · /.test(bas.modelo || ''), bas.modelo);
  ok('IMG-37 · la cantidad es 1 · 2 · 4', bas.qsel.startsWith('1,2,4'), bas.qsel);
  ok('IMG-38 · «Imagen» junto a la idea; el formato es un selector', bas.imagen && bas.formato);
  await p.fill(`${S} .st-prompt`, 'Un logo que diga «PANA»'); await p.waitForTimeout(300);
  const autoTexto = await p.textContent(`${S} .st-mpick .st-mp-name`); await p.fill(`${S} .st-prompt`, ''); await p.waitForTimeout(200);
  ok('IMG-36 · con texto que se lee, Automático cambia a un modelo que lo escribe', /Automático · Nano Banana Pro/.test(autoTexto), autoTexto);
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
  const mas = await p.evaluate(() => { const d = document.querySelector('#studioOv details.st-more'), sel = d && d.querySelector('select'); return { display: d ? getComputedStyle(d).display : '', ancho: sel ? parseFloat(getComputedStyle(sel).minWidth) || 0 : 96 }; });
  ok('IMG-19 · «Más ajustes» es un bloque y su selector no se aplasta', mas.display === 'block' && mas.ancho >= 96, JSON.stringify(mas));
  // GENERAR vacío
  await p.click(`${S} .st-go`); await p.waitForTimeout(600); await shot(p, '05-error-prompt-vacio');
  report.errorVacio = await p.evaluate(() => ({ ferr: document.querySelector('#studioOv .st-ferr')?.textContent, msg: document.querySelector('#studioOv .st-msg')?.textContent, ariaInvalid: document.querySelector('#studioOv .st-prompt').getAttribute('aria-invalid'), describedby: document.querySelector('#studioOv .st-prompt').getAttribute('aria-describedby') }));
  // ===== Fase 4 =====
  ok('IMG-25 · el error de la idea va unido al campo', report.errorVacio.ariaInvalid === 'true' && report.errorVacio.describedby === 'stFerr', JSON.stringify(report.errorVacio));
  await p.evaluate(() => localStorage.setItem('ao.keys1', 'false')); await p.click(`${S} .st-name`); await p.keyboard.press('v'); await p.waitForTimeout(200);
  const k1 = await p.getAttribute(`${S} [data-kind="image"]`, 'aria-pressed');
  await p.evaluate(() => localStorage.removeItem('ao.keys1'));
  ok('IMG-26 · con los atajos de una tecla apagados, «V» no cambia a Video', k1 === 'true', k1);
  ok('IMG-29 · ningún objetivo del compositor mide menos de 24 px', report['medidas:basico-1440'].nMenores24 === 0, JSON.stringify(report['medidas:basico-1440'].menoresDe24));
  ok('IMG-30 · ningún texto del Estudio baja de 11,5 px', Math.min(...Object.keys(report['medidas:basico-1440'].tamaños).map(Number)) >= 11.5, Object.keys(report['medidas:basico-1440'].tamaños).join(' · '));
  // generar 2
  await p.fill(`${S} .st-prompt`, 'Taza de café humeante sobre una mesa de madera, luz de mañana');
  await p.selectOption(`${S} .st-qsel`, '2'); await p.waitForTimeout(200);
  ok('IMG-05 · el costo va dentro de GENERAR', /US\$\d|gratis/i.test(await p.textContent(`${S} .st-go`)), await p.textContent(`${S} .st-go`));
  report.estimacion = await p.textContent(`${S} .st-est`); report.resumenPie = await p.textContent(`${S} .st-sum`); report.botonGo = await p.textContent(`${S} .st-go`);
  await p.click(`${S} .st-go`); await p.waitForTimeout(2600); await shot(p, '06-generando');
  report.msgGenerando = await p.textContent(`${S} .st-msg`);
  await p.waitForFunction(() => /^Listo|no se pud/.test(document.querySelector('#studioOv .st-msg')?.textContent || ''), null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(500); await shot(p, '07-resultado');
  report.msgListo = await p.textContent(`${S} .st-msg`);
  ok('IMG-03 · «Listo» con su plural, sin «archivo(s)»', /^Listo: 2 archivos nuevos/.test(report.msgListo) && !/\(s\)/.test(report.msgListo), report.msgListo);
  await medir(p, 'galeria-1440'); await axe(p, 'galeria-1440');
  // ===== Fase 2 =====
  const res = await p.evaluate(() => {
    const cards = [...document.querySelectorAll('#studioOv .st-grid .st-card[data-f]')].filter(c => c.offsetParent);
    const tops = [...document.querySelectorAll('#studioOv .st-grid .st-card')].filter(c => c.offsetParent).map(c => c.getBoundingClientRect().top);
    return { nuevo: !!document.querySelector('#studioOv .st-card.st-nueva > .st-nuevo'), cards: cards.length, primarias: cards.every(c => c.querySelector('.st-ov [data-a="edit"]') && c.querySelector('.st-ov [data-a="vary"]') && c.querySelector('.st-ov a[download]')), top: Math.round(Math.min(...tops)), voces: !!document.querySelector('#studioOv .st-vocbtn'), mostrar: !!document.querySelector('#studioOv .st-fsel'), sub: !!document.querySelector('#studioOv .st-group .st-card.st-sub') };
  });
  ok('IMG-07 · lo recién hecho sale marcado «Nuevo»', res.nuevo, JSON.stringify(res));
  ok('IMG-08 · la ficha de un pedido trae cada imagen con Editar, Variar y Descargar', res.sub && res.cards >= 2 && res.primarias, JSON.stringify(res));
  ok('IMG-23 · a 1440×900 la galería empieza a 220 px o menos', res.top <= 220, res.top + ' px');
  ok('IMG-49 · la galería ya no tiene «Voces» y los filtros son un «Mostrar ▾»', !res.voces && res.mostrar);
  // ===== Fase 3 =====
  const ui = report['medidas:galeria-1440'], radios = Object.keys(ui.radiosBotones).filter(r => r !== '0px' && r !== '50%');
  ok('IMG-15 · seis tamaños de letra o menos en el Estudio', Object.keys(ui.tamaños).length <= 6, Object.keys(ui.tamaños).sort((a, b) => a - b).join(' · '));
  ok('IMG-15 · sin Arial', !ui.familias.some(f => /Arial/i.test(f)), ui.familias.join(' · '));
  ok('IMG-16 · tres radios en los botones (sin contar 0 y los círculos)', radios.length <= 3, radios.join(' · '));
  const dia = await p.evaluate(() => document.querySelector('#studioOv .st-day')?.textContent.replace(/\s+/g, ' ').trim());
  ok('IMG-13 · el día cuenta archivos, con su palabra', /^Hoy 2 archivos$/.test(dia), dia);
  report.grupoHTML = await p.evaluate(() => document.querySelector('#studioOv .st-grid .st-card:not(.st-job)')?.innerText);
  await p.locator(`${S} button:has-text("Ver por separado"):visible`).first().click().catch(e => console.log('sep?', e.message)); await p.waitForTimeout(800);
  await shot(p, '07b-por-separado');
  // hover tarjeta + menú
  const card = `${S} .st-grid .st-card:not(.st-job):visible`; await p.hover(card).catch(() => {}); await p.waitForTimeout(300); await shot(p, '08-tarjeta-hover', { clip: await p.locator(card).first().boundingBox().then(b => ({ x: b.x - 10, y: b.y - 10, width: Math.min(700, b.width + 20), height: b.height + 20 })) });
  report.tarjetaHTML = await p.locator(card).first().evaluate(e => e.innerText);
  await p.locator(`${card} [data-a="menu"], ${card} .st-more`).first().click().catch(() => {}); await p.waitForTimeout(300); await shot(p, '09-menu-tarjeta');
  const menu = await p.evaluate(() => { const m = document.querySelector('#studioOv .st-menu:not([hidden])'); return m ? { grupos: [...m.querySelectorAll('.st-mh')].map(x => x.textContent), enviar: [...(m.querySelector('[role=group]:last-of-type') || m).querySelectorAll('[data-a]')].map(x => x.dataset.a), ultimo: [...m.querySelectorAll('[role=menuitem]')].pop()?.dataset.a } : null; });
  ok('IMG-09 · el «⋯» va por grupos y la papelera al final', menu && menu.grupos.join('|') === 'Crear a partir de esta|Organizar|Enviar a…' && menu.ultimo === 'del', JSON.stringify(menu));
  ok('IMG-48 · calendario, Dimitri y departamento van juntos en «Enviar a…»', menu && ['cal', 'dimitri', 'dept'].every(a => menu.enviar.includes(a)), JSON.stringify(menu && menu.enviar));
  await p.keyboard.press('Escape');
  // visor
  await p.locator(`${S} .st-grid .st-thumb:visible, ${S} .st-grid .st-gt:visible`).first().click(); await p.waitForTimeout(800); await shot(p, '10-visor');
  report.visorAcciones = await p.evaluate(() => [...document.querySelectorAll('#studioOv .st-light button, #studioOv .st-light a')].filter(e => e.offsetParent).map(e => (e.getAttribute('aria-label') || e.textContent).trim().replace(/\s+/g, ' ')));
  await axe(p, 'visor', '#studioOv .st-light');
  const vg = await p.evaluate(() => [...document.querySelectorAll('#studioOv .st-light .st-lgt')].map(x => x.textContent));
  const tips = await p.evaluate(() => [...document.querySelectorAll('#studioOv .st-grid .st-ov a.st-oi, #studioOv .st-grid .st-ov .st-more, #studioOv .st-gmas > summary')].filter(e => e.offsetParent || e.closest('details')).every(e => e.dataset.tip && e.getAttribute('aria-label')));
  ok('IMG-27 · los botones que solo son un icono dicen su nombre (aria-label y data-tip)', tips);
  ok('IMG-48 · el visor usa los mismos grupos', vg.join('|') === 'Crear a partir de esta|Organizar|Enviar a…', vg.join('|'));
  await p.click(`${S} .st-light [data-l="edit"]`).catch(() => {}); await p.waitForTimeout(500); await shot(p, '11-visor-editar');
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // Variar: ¿qué pasa con lo que había en el compositor?
  await p.fill(`${S} .st-prompt`, 'TEXTO A MEDIO ESCRIBIR');
  const antesVariar = await p.evaluate(() => ({ n: document.querySelector('#studioOv .st-n').textContent, refs: document.querySelectorAll('#studioOv .st-matstep .st-chip').length, jobs: document.querySelectorAll('#studioOv .st-job').length }));
  await p.locator(`${card} .st-ov [data-a="vary"]`).first().click().catch(e => console.log('vary?', e.message)); await p.waitForTimeout(1500);
  report.trasVariar = { prompt: await p.inputValue(`${S} .st-prompt`), msg: await p.textContent(`${S} .st-msg`), trabajos: await p.locator(`${S} .st-job`).count() };
  const trasVariar = await p.evaluate(() => ({ n: document.querySelector('#studioOv .st-n').textContent, refs: document.querySelectorAll('#studioOv .st-matstep .st-chip').length }));
  ok('IMG-01 · Variar no toca la idea, la cantidad ni las referencias, y genera', report.trasVariar.prompt === 'TEXTO A MEDIO ESCRIBIR' && trasVariar.n === antesVariar.n && trasVariar.refs === antesVariar.refs && report.trasVariar.trabajos > antesVariar.jobs, JSON.stringify({ antesVariar, trasVariar, ...report.trasVariar }));
  await p.waitForTimeout(9000); // que termine la variación antes del fallo
  await shot(p, '12-tras-variar');
  // IMG-11: desde US$0,50, el primer clic arma y no hay diálogo del navegador
  let dialogos = 0; p.on('dialog', d => { dialogos++; d.dismiss(); });
  await p.click(`${S} .st-mpick`); await p.waitForTimeout(300); await p.locator(`${S} .st-mo:has-text("Nano Banana Pro")`).first().click(); await p.waitForTimeout(300);
  await p.selectOption(`${S} .st-qsel`, '4');
  const antesConf = await p.locator(`${S} .st-job`).count();
  await p.click(`${S} .st-go`); await p.waitForTimeout(400);
  const conf = { go: await p.textContent(`${S} .st-go`), dialogos, trabajos: await p.locator(`${S} .st-job`).count() - antesConf };
  ok('IMG-11 · un gasto desde US$0,50 se confirma con un segundo clic en el botón, sin diálogo', /^Confirmar · US\$/.test(conf.go) && !conf.dialogos && conf.trabajos === 0, JSON.stringify(conf));
  await p.waitForTimeout(6500);
  ok('IMG-11 · sin el segundo clic, el botón vuelve a ser GENERAR', /^GENERAR/.test(await p.textContent(`${S} .st-go`)), await p.textContent(`${S} .st-go`));
  await p.selectOption(`${S} .st-qsel`, '1');
  const dis = await p.evaluate(() => getComputedStyle(document.querySelector('#studioOv .st-qty [data-d="-1"]')).borderStyle);
  ok('IMG-17 · un botón deshabilitado no lleva borde de trazos', dis === 'solid', dis);
  // fallo
  await p.fill(`${S} .st-prompt`, 'FALLA esta a propósito'); await p.click(`${S} .st-go`); await p.waitForSelector(`${S} .st-job.failed`, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(3000);
  await shot(p, '13-fallo'); report.fallo = await p.evaluate(() => ({ tile: document.querySelector('#studioOv .st-job.failed')?.innerText, msg: document.querySelector('#studioOv .st-msg')?.textContent, raw: !!document.querySelector('#studioOv .st-job.failed .st-jraw'), otro: !!document.querySelector('#studioOv .st-job.failed [data-j="other"]') }));
  ok('IMG-04 · el fallo se lee en español, con el original aparte y «Otro modelo…»', /no aceptó el pedido/.test(report.fallo.tile || '') && !/Request contains/.test((report.fallo.tile || '').split('Detalles técnicos')[0]) && report.fallo.raw && report.fallo.otro, report.fallo.tile);
  ok('IMG-03 · con una ficha fallida a la vista, el pie no dice solo «Listo»', !/^Listo: \d+ archivos? nuevos? en la galería\.$/.test(report.fallo.msg || ''), report.fallo.msg);
  // una referencia en el paso 4, para ver qué hace Avanzado con ella (IMG-39); «Usar de referencia» ofrece DESHACER (IMG-02)
  await p.locator(`${card} .st-ov [data-a="menu"]`).first().click(); await p.waitForTimeout(200); await p.locator(`${S} .st-menu:not([hidden]) [data-a="ref"]`).first().click(); await p.waitForTimeout(500);
  report.toastRef = await p.evaluate(() => { const t = document.querySelector('#studioOv .st-toast'); return t && !t.hidden ? t.innerText : ''; });
  ok('IMG-02 · cargar el compositor ofrece DESHACER', /se guardó/.test(report.toastRef) && /DESHACER/.test(report.toastRef), report.toastRef);
  // Historial
  await p.click(`${S} .st-gmas > summary`); await p.waitForTimeout(200); await shot(p, '13b-galeria-mas');
  await p.click(`${S} .st-histbtn`); await p.waitForTimeout(800); await shot(p, '14-historial'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click(`${S} .st-gmas > summary`); await p.click(`${S} .st-engbtn`); await p.waitForTimeout(500); await shot(p, '14b-motores');
  const eng = await p.evaluate(() => ({ abierto: !document.querySelector('#studioOv .st-engov').hidden, motores: document.querySelectorAll('#studioOv .st-engov .st-eng').length, enCompositor: !!document.querySelector('#studioOv .st-gen .st-keys') }));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('IMG-50 · los motores tienen su panel y ya no están en el compositor', eng.abierto && eng.motores > 0 && !eng.enCompositor && await p.evaluate(() => document.querySelector('#studioOv .st-engov').hidden), JSON.stringify(eng));
  await p.fill(`${S} .st-prompt`, 'idea que no quiero perder'); await p.click(`${S} .st-new`); await p.waitForTimeout(300);
  const vac = await p.evaluate(() => ({ prompt: document.querySelector('#studioOv .st-prompt').value, toast: document.querySelector('#studioOv .st-toast:not([hidden])')?.innerText || '' }));
  await p.locator(`${S} .st-toast button`).click(); await p.waitForTimeout(300);
  ok('IMG-10 · «Vaciar» vacía y DESHACER lo devuelve', vac.prompt === '' && /DESHACER/.test(vac.toast) && await p.inputValue(`${S} .st-prompt`) === 'idea que no quiero perder', JSON.stringify(vac));
  // ===== Avanzado =====
  await p.click(`${S} [data-nivel="avanzado"]`); await p.waitForSelector(`${S} .bk-doors`, { timeout: 20000 }); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector('#studioOv .st-scroll').scrollTop = 0);
  await shot(p, '15-avanzado');
  await p.waitForFunction(() => document.querySelectorAll('#studioOv .bk-slotr img').length >= 1, null, { timeout: 8000 }).catch(() => {});
  const mat = await p.evaluate(() => ({ refsBanco: document.querySelectorAll('#studioOv .bk-slotr img').length, paso4: !!document.querySelector('#studioOv .st-matstep')?.offsetParent }));
  ok('IMG-39 · al entrar en Avanzado, tu referencia pasa a «Tu foto · Referencias»: un solo Material', mat.refsBanco >= 1 && !mat.paso4, JSON.stringify(mat));
  await p.evaluate(() => document.querySelector('#studioOv .st-ars')?.scrollIntoView({ block: 'center' }));
  const ars = await p.evaluate(() => { const g = document.querySelector('#studioOv .st-ars'); return { rol: g?.getAttribute('role'), paradas: [...g.querySelectorAll('[data-ar]')].filter(b => b.tabIndex === 0).length, marcado: g.querySelector('[aria-checked="true"]')?.dataset.ar }; });
  await p.focus(`${S} .st-ars [aria-checked="true"]`); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
  const ars2 = await p.evaluate(() => ({ marcado: document.querySelector('#studioOv .st-ars [aria-checked="true"]')?.dataset.ar, foco: document.activeElement?.dataset?.ar }));
  ok('IMG-28 · los formatos son un grupo de opciones: una parada de Tab y las flechas eligen', ars.rol === 'radiogroup' && ars.paradas === 1 && ars2.marcado !== ars.marcado && ars2.foco === ars2.marcado, JSON.stringify({ ars, ars2 }));
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(150);
  const fm = await p.evaluate(() => ({ vistos: [...document.querySelectorAll('#studioOv .st-ars [data-ar]')].filter(b => b.offsetParent).length, mas: document.querySelector('#studioOv .st-armas')?.textContent }));
  ok('IMG-33 · cuatro formatos a la vista y el resto en «Más formatos»', fm.vistos <= 5 && /Más formatos \(\d+\)/.test(fm.mas || ''), JSON.stringify(fm));
  const entrada = await p.evaluate(() => ({ rojo: !!document.querySelector('#studioOv .bk-falta')?.offsetParent, modo: document.querySelector('#studioOv .bk-modo')?.textContent, puerta: document.querySelector('#studioOv [data-puerta][aria-pressed="true"]')?.textContent }));
  ok('IMG-40 · al entrar en Avanzado no hay error rojo y la línea nombra la puerta pulsada', !entrada.rojo && entrada.modo.includes(entrada.puerta), JSON.stringify(entrada));
  report.avanzado = await p.evaluate(() => { const v = s => { const e = document.querySelector(s); return !!e && !!e.offsetParent; }; return { pasos: [...document.querySelectorAll('#studioOv .st-gen .st-h')].filter(e => e.offsetParent).map(h => h.textContent.trim().replace(/\s+/g, ' ')), matstepVisible: v('#studioOv .st-matstep'), bancoRefs: v('#studioOv .bk'), modo: document.querySelector('#studioOv .bk-modo')?.textContent, puertaPulsada: document.querySelector('#studioOv [data-puerta][aria-pressed="true"]')?.textContent }; });
  await p.setViewportSize({ width: 1440, height: 2000 }); await p.waitForTimeout(300); await shot(p, '16-avanzado-entero'); await p.setViewportSize({ width: 1440, height: 900 });
  await medir(p, 'avanzado-1440'); await axe(p, 'avanzado-1440');
  await p.click(`${S} .st-prompt`); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  report.escEnPromptCierra = await p.evaluate(() => !document.querySelector('#studioOv').classList.contains('on') || document.querySelector('#studioOv').hidden);
  ok('IMG-06 · Esc en la idea no cierra el Estudio', !report.escEnPromptCierra);
  if (report.escEnPromptCierra) { await p.keyboard.press('e'); await p.waitForTimeout(1000); }
  await p.click(`${S} [data-puerta="foto"]`); await p.waitForTimeout(500); // la puerta que promete tu foto: su portada trae presets que la necesitan
  const pista = await p.evaluate(() => ({ gris: !!document.querySelector('#studioOv .bk-pista')?.offsetParent, rojo: !!document.querySelector('#studioOv .bk-falta')?.offsetParent, modo: document.querySelector('#studioOv .bk-modo')?.textContent }));
  ok('IMG-40 · elegir «Mejorar mi foto» sin foto da una pista gris, no un error', pista.gris && !pista.rojo && /Mejorar mi foto/.test(pista.modo), JSON.stringify(pista));
  await p.locator(`${S} button:has-text("Banco"):visible`).first().click(); await p.waitForTimeout(1200); await shot(p, '17-banco');
  report.banco = await p.evaluate(() => ({ grupos: [...document.querySelectorAll('#studioOv .st-bank [data-grupo], #studioOv .st-bank .bk-g')].length, tarjetas: [...document.querySelectorAll('#studioOv .st-bank [role=option], #studioOv .st-bank .bk-card')].length, texto: document.querySelector('#studioOv .st-bank')?.innerText.slice(0, 1500) }));
  await axe(p, 'banco', '#studioOv .st-bank');
  const first = p.locator(`${S} .st-bank .bk-card, ${S} .st-bank [role=option]`).first(); await first.click().catch(() => {}); await p.waitForTimeout(800);
  await shot(p, '18-banco-preset-elegido');
  const conPreset = await p.evaluate(() => ({ aviso: document.querySelector('#studioOv .st-refwarn')?.hidden === false ? document.querySelector('#studioOv .st-refwarn').innerText : '', go: document.querySelector('#studioOv .st-go').textContent, aria: document.querySelector('#studioOv .st-go').getAttribute('aria-describedby'), n5: document.querySelector('#studioOv .st-n5').textContent }));
  ok('IMG-39 · con un preset, nada queda escondido: no hay referencias sin usar que avisar', !conPreset.aviso, JSON.stringify(conPreset));
  ok('IMG-41 · GENERAR dice lo que falta', conPreset.go === 'Falta tu foto' && conPreset.aria === 'stEst', conPreset.go);
  ok('IMG-39 · los pasos siguen sin hueco con presets', conPreset.n5 === '4', conPreset.n5);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await shot(p, '18b-antes-de-generar');
  await p.click(`${S} .st-go`); await p.waitForTimeout(900);
  const trasGo = await p.evaluate(() => ({ rojo: !!document.querySelector('#studioOv .bk-falta')?.offsetParent, foco: document.activeElement?.dataset?.f || '' }));
  ok('IMG-41 · su clic lleva a lo que falta y la pista pasa a rojo', trasGo.rojo && trasGo.foco === 'sub-foto', JSON.stringify(trasGo));
  const pasadas = await p.evaluate(() => ({ aviso: !document.querySelector('#studioOv .st-refwarn').hidden, refsBanco: document.querySelectorAll('#studioOv .bk-slotr img').length }));
  ok('IMG-39 · las referencias siguen en el banco con un preset elegido', !pasadas.aviso && pasadas.refsBanco >= 1, JSON.stringify(pasadas));
  // ===== Fase 6 =====
  await p.locator(`${S} button:has-text("Banco"):visible`).first().click(); await p.waitForTimeout(800);
  const hoja = await p.evaluate(() => { const ov = document.querySelector('#studioOv'), bk = ov.querySelector('.st-gal > .st-bank:not([hidden])'), g = ov.querySelector('.st-grid'); if (!bk || !g) return { bk: !!bk };
    const a = bk.getBoundingClientRect(), b = g.getBoundingClientRect(); return { clase: ov.classList.contains('st-hoja'), banco: Math.round(a.left), galeria: Math.round(b.right), visible: b.width > 200 }; });
  await shot(p, '18c-banco-al-lado');
  ok('IMG-42 · a 1440 el banco va al lado: la galería se sigue viendo', hoja.clase && hoja.visible && hoja.galeria <= hoja.banco + 1, JSON.stringify(hoja));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const tarjeta = await p.evaluate(() => ({ marca: document.querySelectorAll('#studioOv .st-bank .bk-marca, #studioOv .bk-card .bk-tag').length }));
  report.tarjetasPreset = tarjeta;
  // IMG-47: B desde Básico pasa a Avanzado y lo dice, con VOLVER A BÁSICO
  await p.click(`${S} [data-nivel="basico"]`); await p.waitForTimeout(300); const focoNivel = await p.evaluate(() => document.activeElement?.dataset?.nivel || document.activeElement?.tagName); await p.keyboard.press('b'); await p.waitForTimeout(900);
  const bt = await p.evaluate(() => ({ nivel: document.querySelector('#studioOv [data-nivel="avanzado"]').getAttribute('aria-pressed'), toast: document.querySelector('#studioOv .st-toast:not([hidden])')?.innerText || '', cls: document.querySelector('#studioOv').className, act: document.activeElement?.className, k1: localStorage.getItem('ao.keys1'), abiertos: [...document.querySelectorAll('#studioOv .st-hist, #studioOv .st-light, #studioOv .st-menu')].filter(x => !x.hidden).map(x => x.className) }));
  ok('IMG-28 · tras pulsar «Básico» el foco pasa a «Avanzado» (el botón pulsado se oculta)', focoNivel === 'avanzado', focoNivel);
  ok('IMG-47 · B desde Básico pasa a Avanzado y lo dice, con VOLVER A BÁSICO', bt.nivel === 'true' && /Pasaste a Avanzado/.test(bt.toast) && /VOLVER A BÁSICO/.test(bt.toast), JSON.stringify(bt));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // IMG-46: una plantilla con cualquier configuración
  await p.fill(`${S} .st-prompt`, 'fondo blanco, luz suave'); await p.evaluate(() => document.querySelector('#studioOv .st-plant').scrollIntoView({ block: 'center' }));
  await p.click(`${S} .st-plsave`); await p.fill(`${S} .st-plname`, 'Catálogo 4:5'); await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  const pl = await p.evaluate(() => ({ opciones: [...document.querySelectorAll('#studioOv .st-plsel option')].map(o => o.textContent), elegida: document.querySelector('#studioOv .st-plsel').value }));
  await shot(p, '18d-plantilla');
  await p.fill(`${S} .st-prompt`, 'otra cosa'); await p.selectOption(`${S} .st-plsel`, ''); await p.selectOption(`${S} .st-plsel`, pl.elegida); await p.waitForTimeout(400);
  const pl2 = { prompt: await p.inputValue(`${S} .st-prompt`), toast: await p.evaluate(() => document.querySelector('#studioOv .st-toast:not([hidden])')?.innerText || '') };
  const nota = fs.existsSync(path.join(brain, 'Estudio', 'Plantillas')) ? fs.readdirSync(path.join(brain, 'Estudio', 'Plantillas')).filter(f => f.endsWith('.md')) : [];
  ok('IMG-46 · «Guardar como plantilla» guarda cualquier configuración como nota del Cerebro y se carga con DESHACER', pl.opciones.includes('Catálogo 4:5') && nota.length === 1 && pl2.prompt === 'fondo blanco, luz suave' && /DESHACER/.test(pl2.toast), JSON.stringify({ pl, nota, pl2 }));
  // IMG-14: Comparar 2 de la galería
  await p.click(`${S} .st-selbtn`); await p.waitForTimeout(300);
  const cks = p.locator(`${S} .st-grid .st-card:not(.st-gcard) .st-ck input:visible`); await cks.nth(0).check().catch(() => {}); await cks.nth(1).check().catch(() => {}); await p.waitForTimeout(300);
  const cmpOn = await p.evaluate(() => ({ n: document.querySelector('#studioOv .st-seln')?.textContent, dis: document.querySelector('#studioOv .st-selbar [data-b="cmp"]')?.disabled }));
  await p.click(`${S} .st-selbar [data-b="cmp"]`).catch(() => {}); await p.waitForTimeout(600); await shot(p, '18e-comparar');
  const cm = await p.evaluate(() => { const d = document.querySelector('#studioOv .st-cmpov'), b = d?.querySelector('.st-cmpbar'); return { abierto: d && !d.hidden, imgs: d ? d.querySelectorAll('img').length : 0, foco: document.activeElement === b, v: b?.getAttribute('aria-valuenow') }; });
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); const v2 = await p.evaluate(() => document.querySelector('#studioOv .st-cmpbar')?.getAttribute('aria-valuenow'));
  await axe(p, 'comparar', '#studioOv .st-cmpov');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); const cerrado = await p.evaluate(() => document.querySelector('#studioOv .st-cmpov').hidden && document.querySelector('#studioOv').classList.contains('on'));
  ok('IMG-14 · con 2 seleccionadas, «Comparar» abre la cortina; ← la mueve y Esc la cierra sin cerrar el Estudio', !cmpOn.dis && cm.abierto && cm.imgs === 2 && cm.foco && v2 === '40' && cerrado, JSON.stringify({ cmpOn, cm, v2, cerrado }));
  await p.click(`${S} .st-selbar [data-b="none"]`).catch(() => {}); await p.click(`${S} [data-pt="gen"]`).catch(() => {}); await p.waitForTimeout(300);
  await p.locator(`${S} button:has-text("Banco"):visible`).first().click(); await p.waitForTimeout(600);
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
  const mc = await p.evaluate(() => { const t = document.querySelector('#studioOv .st-prompt').getBoundingClientRect(), f = document.querySelector('#studioOv .st-foot').getBoundingClientRect(); return { idea: Math.round(t.top), pie: Math.round(f.top) }; });
  ok('IMG-52 · en el teléfono la idea se ve sin desplazarse', mc.idea + 40 <= mc.pie, JSON.stringify(mc));
  await p.evaluate(() => document.querySelector('#studioOv .st-scroll').scrollTop = 600); await p.waitForTimeout(300); await shot(p, '25-movil-crear-abajo');
  await medir(p, 'movil-crear');
  await p.click(`${S} [data-pt="gal"]`).catch(() => {}); await p.waitForTimeout(600); await shot(p, '26-movil-galeria'); await medir(p, 'movil-galeria');
  const mg = await p.evaluate(() => Math.round(Math.min(...[...document.querySelectorAll('#studioOv .st-grid .st-card')].filter(c => c.offsetParent).map(c => c.getBoundingClientRect().top))));
  ok('IMG-52 · en el teléfono la primera imagen empieza a 260 px o menos', mg <= 260, mg + ' px');
  ok('IMG-52 · nada se sale del ancho en el teléfono', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  await p.locator(`${S} .st-grid .st-thumb:visible, ${S} .st-grid .st-gt:visible`).first().tap().catch(() => {}); await p.waitForTimeout(800); await shot(p, '27-movil-visor');
  await p.keyboard.press('Escape'); await p.click(`${S} [data-pt="gen"]`).catch(() => {}); await p.click(`${S} [data-nivel="avanzado"]`).catch(() => {}); await p.waitForTimeout(2500); await shot(p, '28-movil-avanzado');
  await c.close();
} catch (e) { console.error('ERROR', e); report.error = String(e.stack || e); }
finally { await browser.close(); srv.kill(); g.close(); fs.writeFileSync(path.join(OUT, 'informe.json'), JSON.stringify(report, null, 1)); fs.writeFileSync(path.join(OUT, 'servidor.log'), log); fs.rmSync(dir, { recursive: true, force: true }); }
if (report.error) console.log('✗ el recorrido se cortó: ' + report.error.split('\n')[0]);
console.log(`${malos || report.error ? (malos + (report.error ? 1 : 0)) + ' mal' : 'todo bien'} · ${OUT}${AXE ? '' : ' (sin axe: AO_AXE no apunta a axe.min.js)'}`);
process.exitCode = malos || report.error ? 1 : 0;
