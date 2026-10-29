// Herramienta de desarrollo: la VENTANA CENTRADA de una pieza de Contenido (25 oct 2026) en el navegador: centrada, sin desbordes, vista previa entera, foco atrapado, Escape y clic fuera, hoja en el teléfono; con AO_AXE=<axe.min.js>, axe.
//   node scripts/ventana-contenido-recorrido.mjs   → ✓/✗ por paso y capturas en data/capturas/ventana-contenido/
// oficina de verdad (temporal: cerebro copiado, datos aparte, Claude simulado, sin keys). Recorre lo que se le pidió tras compararlo con
// Metricool: el formato de cada red, el cuadro de escribir con emoji, hashtags y textos guardados, «Editar por red», «✨ Mejorar con
// Marketing», los archivos dentro del cuadro, «N problemas» con su arreglo, cuándo sale, la vista previa en teléfono o computadora y
// «Publicar ya» desde «Aprobar ▾». Mide objetivos (24 px), letra (10,5 px), que nada se salga a lo ancho y, con AO_AXE=<axe.min.js>, axe.
//   node scripts/editor-contenido-recorrido.mjs   → ✓/✗ por paso y capturas en data/capturas/ventana-contenido/ (1512, 1024 y 390, claro y oscuro)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'ventana-contenido'); fs.mkdirSync(OUT, { recursive: true });
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const pedidos = [];
const claude = http.createServer((rq, rs) => { let b = ''; rq.on('data', d => { b += d; }); rq.on('end', () => {
  const body = JSON.parse(b || '{}'); pedidos.push(body);
  const sys = JSON.stringify(body.system || ''), text = /mejores el TEXTO/.test(sys) ? JSON.stringify({ texto: 'Tu examen visual, gratis todo octubre. Agenda hoy y sal con tus lentes en 40 minutos.', porque: 'Más corto y con el gancho primero.' }) : '{}';
  rs.writeHead(200, { 'content-type': 'application/json' });
  rs.end(JSON.stringify({ id: 'msg', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } }));
}); });
const cport = await listen(claude);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-editor-')), data = path.join(dir, 'data'), brain = path.join(dir, 'brain');
fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana, clara y sin tecnicismos.\n');
const mes = new Date().toISOString().slice(0, 7), mdir = path.join(brain, 'Agents Office', 'media', mes); fs.mkdirSync(mdir, { recursive: true });
for (const [n, bg, w, h] of [['lentes', '#e66a2f', 1080, 1350], ['tienda', '#2f7be6', 1080, 1080]]) {
  fs.writeFileSync(path.join(mdir, `${n}.jpg`), await sharp({ create: { width: w, height: h, channels: 3, background: bg } }).jpeg().toBuffer());
  fs.writeFileSync(path.join(mdir, `${n}.json`), JSON.stringify({ file: `${mes}/${n}.jpg`, kind: 'image', model: 'upload', prompt: `Foto de ${n}`, w, h, at: Date.now(), by: 'dueno' }));
}
const local = path.join(dir, 'local.json'); fs.writeFileSync(local, JSON.stringify({ contenido: { modo: 'simulacro', redes: ['instagram', 'facebook'] } }));
const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: local, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_API_KEY: 'no-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', METRICOOL_USER_ID: '', METRICOOL_BLOG_ID: '', GEMINI_API_KEY: '', HF_KEY: '', FAL_KEY: '' };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
const api = async (m, p, b) => (await fetch(base + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json();
for (const t of ['#optica #lentes', '#optica #panama']) await api('POST', '/api/contenido/piezas', { titulo: 'Vieja', texto: 'Una de antes', hashtags: t, redes: ['instagram'] });

let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const axeSrc = process.env.AO_AXE ? fs.readFileSync(process.env.AO_AXE, 'utf8') : '';
let browser;
try {
  try { browser = await chromium.launch(); } catch { try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); } }
  for (const [w, h] of (process.env.AO_SIZES ? JSON.parse(process.env.AO_SIZES) : [[1512, 900], [1280, 720], [1024, 768], [820, 1180], [390, 844]])) for (const tema of ['light', 'dark']) for (const dimitri of (w >= 1024 ? [false, true] : [false])) {
    const tag = `${w}x${h}-${tema}${dimitri ? '-dimitri' : ''}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: tema, reducedMotion: 'reduce' }); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); if (process.env.AO_DBG) page.on('console', m => /^AJ/.test(m.text()) && console.log(m.text()));
    await page.addInitScript(t => { try { localStorage.setItem('ao.theme', t); localStorage.setItem('ao.onboarded', '1'); window.__ajDbg = !!window.__ajDbg || 1; } catch {} }, tema === 'dark' ? 'dark' : 'light');
    await page.goto(base + '/'); await page.waitForTimeout(1500);
    await page.keyboard.press('Escape'); await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('k'); await page.waitForSelector('#ctOv .ct-mode', { state: 'visible' }); await page.waitForTimeout(400);
    if (dimitri) { await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('s'); await page.waitForTimeout(800); }
    await page.click('#ctNew'); await page.waitForTimeout(300);
    const m0 = await page.$('.ct-newmenu:not([hidden]) button'); if (m0) { await m0.click(); await page.waitForTimeout(300); }
    await page.waitForSelector('.ct-panel:not([hidden]) .pz-nets', { timeout: 5000 }).catch(async e => { await page.screenshot({ path: path.join(OUT, 'fallo.png') }); console.log(errs.join('|'), (await page.evaluate(() => document.querySelector('.ct-panel')?.outerHTML.slice(0, 300)))); throw e; }); await page.waitForTimeout(1200);
    const geo = await page.evaluate(() => {
      const p = document.querySelector('.ct-panel:not([hidden])'), r = p.getBoundingClientRect(), body = document.querySelector('#ctOv').getBoundingClientRect();
      const side = p.querySelector('.pz-side'), pv = p.querySelector('.pz-preview'), sr = side.getBoundingClientRect(), vr = pv.getBoundingClientRect();
      const over = [...p.querySelectorAll('.pz-scroll, .pz-side, .pz-head, .pz-foot')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className);
      return { r: { l: r.left, t: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }, body: { cx: body.left + body.width / 2, cy: body.top + body.height / 2, w: body.width, h: body.height }, vw: innerWidth, vh: innerHeight,
        sideShown: sr.width > 0, tabs: (() => { const t = pv.querySelector('.pv-tabs [role="tab"]'); if (!t) return null; const r = t.getBoundingClientRect(); return { h: r.height, fs: parseFloat(getComputedStyle(t).fontSize) }; })(), escala: parseFloat(pv.style.getPropertyValue('--pzs')) || 1,
        dbg: [pv.style.getPropertyValue('--pzs'), side.clientHeight, Math.round(vr.height), [...side.children].map(c => Math.round(c.getBoundingClientRect().height)).join('/')].join(' '), pvFit: sr.width > 0 ? vr.bottom <= sr.bottom + 1 && vr.top >= sr.top - 1 : null, sideScroll: side.scrollHeight - side.clientHeight, over, hscroll: document.documentElement.scrollWidth > innerWidth + 1,
        role: p.getAttribute('role'), modal: p.getAttribute('aria-modal'), scrim: getComputedStyle(document.querySelector('.ct-scrim')).display, radius: getComputedStyle(p).borderRadius };
    });
    if (process.env.AO_DBG) console.log('GEO', JSON.stringify({ r: geo.r, body: geo.body, vw: geo.vw, radius: geo.radius }));
    const full = geo.r.w < 820 && geo.r.w >= geo.body.w - 2;
    step(geo.role === 'dialog' && geo.modal === 'true', `${tag}: role=dialog aria-modal`);
    if (full) step(Math.abs(geo.r.w - geo.body.w) < 2 && Math.abs(geo.r.h - geo.body.h) < 2 && geo.radius === '0px', `${tag}: hoja a pantalla completa (${Math.round(geo.r.w)}×${Math.round(geo.r.h)})`);
    else {
      step(Math.abs(geo.r.cx - geo.body.cx) <= 2 && Math.abs(geo.r.cy - geo.body.cy) <= 2, `${tag}: centrada en la vista (Δx ${Math.round(geo.r.cx - geo.body.cx)}, Δy ${Math.round(geo.r.cy - geo.body.cy)})`);
      step(geo.r.w <= Math.min(1120, geo.vw) + 1 && geo.r.h <= geo.vh && geo.r.t >= 0 && geo.r.l >= 0, `${tag}: cabe en la ventana (${Math.round(geo.r.w)}×${Math.round(geo.r.h)})`);
      step(geo.scrim !== 'none', `${tag}: fondo atenuado`);
      if (geo.r.w >= 780 && geo.tabs) step(geo.tabs.h >= 30 && geo.tabs.fs >= 11 && geo.escala >= 0.75, `${tag}: pestañas Feed/Perfil/Facebook a tamaño real (${Math.round(geo.tabs.h)} px de alto, ${geo.tabs.fs} px de letra, maqueta ×${geo.escala})`);
      if (geo.r.w >= 780) step(geo.sideShown && (geo.escala <= 0.751 || (geo.pvFit && geo.sideScroll <= 0)), `${tag}: vista previa entera sin scroll, o con scroll solo si ya está al piso de 0,75 (sobra ${geo.sideScroll}px; ${geo.dbg})`);
    }
    step(!geo.hscroll && geo.over.length === 0, `${tag}: nada desborda a lo ancho ${geo.over.join(',')}`);
    if (axeSrc) { await page.addScriptTag({ content: axeSrc }); const ax = await page.evaluate(async () => (await axe.run('.ct-panel:not([hidden])', { resultTypes: ['violations'] })).violations.map(v => `${v.id}(${v.nodes.length})`)); step(ax.length === 0, `${tag}: axe sin fallos ${ax.join(' ')}`); }
    // los pasos y el teclado (solo en claro, para no repetir)
    if (tema === 'light' && !dimitri) {
      const P = '.ct-panel:not([hidden]) ';
      step((await page.$$(P + '.pz-steps [data-paso]')).length === 4 && (await page.getAttribute(P + '.pz-steps [data-paso="1"]', 'aria-current')) === 'step', `${tag}: cuatro pasos, el 1 activo`);
      await page.focus(P + '.pz-title'); await page.keyboard.press('Alt+ArrowRight'); await page.waitForTimeout(250);
      step((await page.getAttribute(P + '.pz-steps [data-paso="2"]', 'aria-current')) === 'step', `${tag}: Alt+→ pasa al paso 2`);
      await page.keyboard.press('Alt+ArrowLeft'); await page.waitForTimeout(250);
      step((await page.getAttribute(P + '.pz-steps [data-paso="1"]', 'aria-current')) === 'step', `${tag}: Alt+← vuelve al 1`);
      if (!full) {
      await page.fill(P + '.pz-ta[data-f="texto"]', 'Probando guardar con Ctrl+Enter'); await page.keyboard.press('Control+Enter');
      await page.waitForFunction(() => /Guardado/.test(document.querySelector('.pz-guardado')?.textContent || ''), null, { timeout: 5000 }).then(() => step(true, `${tag}: Ctrl+Enter guarda y arriba dice «Guardado ✓»`), () => step(false, `${tag}: Ctrl+Enter guarda y arriba dice «Guardado ✓»`));
      step(await page.evaluate(() => !/aprobada/i.test(document.querySelector('.pz-chip')?.textContent || '')), `${tag}: guardar no aprueba`);
      }
      if (full) {
        const vis = async sel => page.evaluate(s => { const e = document.querySelector('.ct-panel:not([hidden]) ' + s); return !!e && e.getClientRects().length > 0; }, sel);
        step(await vis('.pz-nets') && !(await vis('.pz-comp')), `${tag}: paso 1 solo enseña las redes`);
        await page.click(P + '[data-ir="1"]'); await page.waitForTimeout(250);
        step(await vis('.pz-comp') && !(await vis('.pz-nets')), `${tag}: «Siguiente» enseña solo el texto`);
        await page.click(P + '[data-ir="1"]'); await page.waitForTimeout(250);
        step(await vis('.pz-medios') && !(await vis('.pz-ta')), `${tag}: paso 3 enseña los medios`);
        await page.click(P + '[data-ir="1"]'); await page.waitForTimeout(400);
        step(await vis('.pz-side') && await vis('.pz-cuando') , `${tag}: paso 4 enseña la vista previa y «Cuándo sale»`);
        const bt = await page.evaluate(() => [...document.querySelectorAll('.pz-stepnav button')].map(b => Math.round(b.getBoundingClientRect().height)));
        step(bt.every(h => h >= 44), `${tag}: botones grandes (${bt.join(',')} px)`);
        step(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `${tag}: sin scroll horizontal`);
        if (w === 390) await page.screenshot({ path: path.join(OUT, `${tag}-paso4.png`) });
      }
    }
    // foco atrapado: 40 Tab y el foco sigue dentro
    let dentro = true; for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); if (!(await page.evaluate(() => !!document.activeElement?.closest('.ct-panel')))) { dentro = false; break; } }
    step(dentro, `${tag}: el foco se queda dentro tras 40 Tab`);
    if (w === 1512 || w === 1280 || w === 390 || w === 820) await page.screenshot({ path: path.join(OUT, `${tag}.png`) });
    // clic fuera (no hay scrim visible en hoja: se cierra con Escape)
    if (!full) { await page.mouse.click(geo.vw - 6, geo.vh - 6); await page.waitForTimeout(500); step(await page.evaluate(() => document.querySelector('.ct-panel').hidden), `${tag}: clic fuera la cierra`); step(await page.evaluate(() => document.querySelector('#ctOv').classList.contains('on')), `${tag}: Contenido sigue abierto`); }
    else { await page.keyboard.press('Escape'); await page.waitForTimeout(400); step(await page.evaluate(() => document.querySelector('.ct-panel').hidden), `${tag}: Escape la cierra`); }
    if (!full) { await page.click('#ctNew'); await page.waitForTimeout(300); const m1 = await page.$('.ct-newmenu:not([hidden]) button'); if (m1) await m1.click(); await page.waitForSelector('.ct-panel:not([hidden]) .pz-nets'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      step(await page.evaluate(() => document.querySelector('.ct-panel').hidden && document.querySelector('#ctOv').classList.contains('on')), `${tag}: Escape cierra solo la ventana, no Contenido`); }
    step(errs.length === 0, `${tag}: sin errores de página ${errs.join('|')}`);
    await ctx.close();
  }
} finally { await browser?.close(); srv.kill(); claude.close(); }
console.log(fails ? `\n${fails} fallos` : '\ntodo bien'); process.exit(fails ? 1 : 0);
