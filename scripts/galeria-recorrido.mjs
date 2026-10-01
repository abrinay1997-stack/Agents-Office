// Herramienta de desarrollo (no entra en `npm run check`): la galería del Estudio con 5.000 fichas EN EL NAVEGADOR (INF-03).
// Una oficina en una carpeta temporal con 5.000 archivos sintéticos (la foto del índice, data/media-index.json, y un PNG por ficha).
//   node scripts/galeria-recorrido.mjs   → capturas en data/capturas/galeria/, tiempos y ✓/✗ por paso
// Mide /api/media (la respuesta de siempre y una página) y el primer pintado del Estudio; comprueba «120 de 5.000», «Cargar más»
// (botón y desplazamiento), la búsqueda en el servidor (la ficha más vieja), Ctrl+K y el selector de Contenido, a 390/1024/1512, claro y oscuro.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'galeria'); fs.mkdirSync(OUT, { recursive: true });
const N = +(process.env.N || 5000);
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-galeria-')), brain = path.join(dir, 'brain'), data = path.join(dir, 'data'), mroot = path.join(brain, 'Agents Office', 'media');
fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana.\n');
// a 2×2 PNG in a few colours, one per file (the thumbnails are real pictures, not broken links)
const PNGS = ['iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DwHwyBNAMDA4wBAH+qD/HT3d4PAAAAAElFTkSuQmCC', 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAADklEQVR4nGNgYGD4z4ADAAMFAAHiJVjLAAAAAElFTkSuQmCC'].map(b => Buffer.from(b, 'base64'));
const months = {}, t0 = Date.now(), PROMPTS = ['taza de café humeante', 'zapatillas rojas en la playa', 'logo de PanaClaw en neón', 'máquina de garra con premios', 'retrato de producto sobre roca volcánica', 'flat lay con los colores de la marca'];
for (let i = 0; i < N; i++) {
  const d = new Date(t0 - (N - i) * 3600e3), sub = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, file = `${sub}/g${i}.png`;
  (months[sub] ||= { items: [] }).items.push({ id: file, file, kind: 'image', ext: 'png', at: d.getTime(), w: 1024, h: i % 3 ? 1024 : 1280, prompt: `${PROMPTS[i % PROMPTS.length]} n.º ${i}${i === 0 ? ' — la primera de todas, Cafetería Ñandú' : ''}`, model: 'prueba', modelName: 'Prueba (gratis)', provider: 'prueba', ...(i % 7 === 0 ? { fav: true } : {}), ...(i % 5 === 0 ? { by: 'agent', agent: 'mia' } : { by: 'you' }) });
}
let t = Date.now();
for (const [sub, m] of Object.entries(months)) { fs.mkdirSync(path.join(mroot, sub), { recursive: true }); for (const [k, it] of m.items.entries()) fs.writeFileSync(path.join(mroot, it.file), PNGS[k % 2]); }
for (const sub of Object.keys(months)) months[sub].mtime = fs.statSync(path.join(mroot, sub)).mtimeMs; // after the files: the snapshot is trusted while this stays
fs.mkdirSync(data, { recursive: true }); fs.writeFileSync(path.join(data, 'media-index.json'), JSON.stringify({ v: 1, root: mroot, months }));
console.log(`· ${N} fichas sintéticas en ${((Date.now() - t) / 1000).toFixed(1)} s`);

const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), ANTHROPIC_API_KEY: '', CLAUDE_BIN: path.join(dir, 'no-claude.exe'),
  TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '' };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }

let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const timeIt = async (p, k = 5) => { const ms = []; let size = 0; for (let i = 0; i < k; i++) { const a = performance.now(); const r = await fetch(base + p, { headers: { 'accept-encoding': 'gzip' } }); const b = await r.arrayBuffer(); ms.push(performance.now() - a); size = b.byteLength; } ms.sort((x, y) => x - y); return { med: ms[Math.floor(ms.length / 2)], max: ms.at(-1), kb: size / 1024 }; };
const fmt = x => `mediana ${x.med.toFixed(0)} ms · máx ${x.max.toFixed(0)} ms · ${x.kb.toFixed(0)} KB`;
const first = await timeIt('/api/media?n=1', 1); console.log(`· primer /api/media (índice desde la foto): ${first.med.toFixed(0)} ms`);
const old = await timeIt('/api/media'), page = await timeIt('/api/media?n=120&catalog=1&filter=all&folder=all'), light = await timeIt('/api/media?n=120&filter=all&folder=all'), search = await timeIt('/api/media?n=120&q=' + encodeURIComponent('ñandú')), deep = await timeIt('/api/media?n=120&offset=' + (N - 120));
console.log(`· /api/media sin páginas (600 + catálogo): ${fmt(old)}\n· una página de 120 con catálogo (lo que pide el Estudio): ${fmt(page)}\n· una página de 120 sin catálogo: ${fmt(light)}\n· búsqueda en ${N}: ${fmt(search)}\n· la última página: ${fmt(deep)}`);
const j = await (await fetch(base + '/api/media?n=0')).json(); step(j.counts.all === N && j.total === N, `el servidor cuenta las ${N} (${j.counts.all})`);

let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
const miles = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
try {
  for (const [w, h, tema] of [[1512, 900, 'light'], [1512, 900, 'dark'], [1024, 768, 'light'], [1024, 768, 'dark'], [390, 844, 'light'], [390, 844, 'dark']]) {
    const tag = `${w}-${tema}`, phone = w < 500;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: phone, isMobile: phone, colorScheme: tema });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(t => { try { localStorage.setItem('ao.theme', t); } catch {} }, tema);
    await pg.goto(base + '/'); await pg.waitForTimeout(1200);
    await pg.evaluate(t => { document.body.classList.toggle('dark', t === 'dark'); document.documentElement.dataset.theme = t; }, tema);
    // the first paint: from the key press to the first card in the gallery
    const a = Date.now(); await pg.keyboard.press('e');
    if (phone) { await pg.waitForTimeout(300); await pg.evaluate(() => document.querySelector('#studioOv [data-pt="gal"]')?.click()); }
    await pg.waitForSelector('#studioOv .st-card[data-f]', { timeout: 30000 }).catch(() => {});
    const paint = Date.now() - a;
    const cards = await pg.$$eval('#studioOv .st-card[data-f]', l => l.length);
    const count = await pg.$eval('#studioOv .st-count', e => e.textContent);
    step(cards > 0 && cards <= 120, `${tag}: primer pintado ${paint} ms con ${cards} tarjetas`);
    step(count.includes(`120 de ${miles(N)}`), `${tag}: el recuento dice «${count}»`);
    const tab = await pg.$eval('#studioOv .st-tabs [data-f="all"] b', e => e.textContent).catch(() => '');
    step(tab === miles(N), `${tag}: la pestaña Todo cuenta ${tab}`);
    await pg.screenshot({ path: path.join(OUT, `estudio-${tag}.png`) });
    // «Cargar más»: a real button at the end
    await pg.$eval('#studioOv .st-grid', g => { g.scrollTop = g.scrollHeight; });
    await pg.waitForFunction(() => document.querySelectorAll('#studioOv .st-card[data-f]').length > 120, null, { timeout: 15000 }).catch(() => {});
    const more = await pg.$$eval('#studioOv .st-card[data-f]', l => l.length);
    step(more > 120, `${tag}: al bajar llega la página siguiente (${more} tarjetas)`);
    const btn = await pg.$('#studioOv .st-morebtn');
    if (btn) {
      const box = await btn.boundingBox(); step(box && box.height >= 24, `${tag}: «Cargar más» mide ${box && box.height.toFixed(0)} px de alto`);
      await pg.$eval('#studioOv .st-grid', g => { g.scrollTop = g.scrollHeight; }); await pg.waitForTimeout(400);
      await pg.screenshot({ path: path.join(OUT, `cargar-mas-${tag}.png`) });
      await btn.focus().catch(() => {}); const before = await pg.$$eval('#studioOv .st-card[data-f]', l => l.length);
      await pg.keyboard.press('Enter'); await pg.waitForFunction(n => document.querySelectorAll('#studioOv .st-card[data-f]').length > n, before, { timeout: 15000 }).catch(() => {});
      step((await pg.$$eval('#studioOv .st-card[data-f]', l => l.length)) > before, `${tag}: «Cargar más» con el teclado`);
    } else step(false, `${tag}: no encuentro «Cargar más»`);
    // the search goes to the server: the oldest file of all
    await pg.fill('#studioOv .st-q', 'cafeteria nandu');
    await pg.waitForFunction(() => document.querySelectorAll('#studioOv .st-card[data-f]').length === 1, null, { timeout: 15000 }).catch(() => {});
    const found = await pg.$$eval('#studioOv .st-card[data-f]', l => l.map(x => x.dataset.f));
    step(found.length === 1 && /\/g0\.png$/.test(found[0]), `${tag}: buscar encuentra la ficha más vieja (${found.join(', ')})`);
    await pg.screenshot({ path: path.join(OUT, `busqueda-${tag}.png`) });
    await pg.fill('#studioOv .st-q', ''); await pg.waitForTimeout(600);
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
    // Ctrl+K
    await pg.evaluate(() => document.activeElement && document.activeElement.blur());
    await pg.keyboard.press('Control+k'); await pg.waitForSelector('#findOv:not([hidden])');
    await pg.fill('#fdQ', 'Cafetería Ñandú'); await pg.waitForFunction(() => [...document.querySelectorAll('#fdList li')].some(li => /primera de todas/.test(li.textContent)), null, { timeout: 15000 }).catch(() => {});
    const hit = await pg.$$eval('#fdList li', l => l.map(x => x.textContent).find(t => /primera de todas/.test(t)) || '');
    step(!!hit, `${tag}: Ctrl+K encuentra la ficha más vieja`);
    await pg.screenshot({ path: path.join(OUT, `ctrlk-${tag}.png`) });
    if (hit) { await pg.click('#fdList li:has-text("primera de todas")'); await pg.waitForSelector('#studioOv .st-light:not([hidden])', { timeout: 15000 }).catch(() => {}); step(await pg.$eval('#studioOv .st-light', e => !e.hidden).catch(() => false), `${tag}: y la abre en el visor`); await pg.screenshot({ path: path.join(OUT, `visor-vieja-${tag}.png`) }); }
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
    // Contenido: the picker searches the whole gallery and pages
    await pg.evaluate(() => document.activeElement && document.activeElement.blur());
    await pg.keyboard.press('k'); await pg.waitForTimeout(700);
    await pg.click('#ctNew').catch(() => {}); await pg.click('[data-newf="post"]').catch(() => {}); await pg.waitForTimeout(600);
    await pg.click('.pz-btn[data-a="pick"]').catch(() => {});
    await pg.waitForSelector('.ct-pick .ct-pk', { timeout: 15000 }).catch(() => {});
    const pk = await pg.$$eval('.ct-pick .ct-pk', l => l.length).catch(() => 0), pn = await pg.$eval('.ct-pickn', e => e.textContent).catch(() => '');
    step(pk === 60 && pn.includes(`60 de ${miles(N)}`), `${tag}: el selector de Contenido da 60 de ${miles(N)} («${pn}»)`);
    await pg.screenshot({ path: path.join(OUT, `selector-${tag}.png`) });
    await pg.fill('.ct-pickin', 'ñandú'); await pg.waitForFunction(() => document.querySelectorAll('.ct-pick .ct-pk').length === 1, null, { timeout: 15000 }).catch(() => {});
    step((await pg.$$eval('.ct-pick .ct-pk', l => l.map(x => x.dataset.f))).some(f => /\/g0\.png$/.test(f)), `${tag}: el selector encuentra la más vieja`);
    await pg.fill('.ct-pickin', ''); await pg.waitForFunction(() => document.querySelectorAll('.ct-pick .ct-pk').length === 60, null, { timeout: 15000 }).catch(() => {});
    await pg.click('.ct-pmorebtn').catch(() => {}); await pg.waitForFunction(() => document.querySelectorAll('.ct-pick .ct-pk').length > 60, null, { timeout: 15000 }).catch(() => {});
    step((await pg.$$eval('.ct-pick .ct-pk', l => l.length)) === 120, `${tag}: «Cargar más» en el selector`);
    const sw = await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth); step(sw, `${tag}: sin desplazamiento horizontal`);
    step(!errs.length, `${tag}: sin errores en la página${errs.length ? ': ' + errs.join(' | ') : ''}`);
    await ctx.close();
  }
} finally { await browser.close(); srv.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
console.log(fails ? `\n${fails} paso(s) fallaron` : '\nTodo bien.'); if (fails) { console.log(log.slice(-1500)); process.exitCode = 1; }
