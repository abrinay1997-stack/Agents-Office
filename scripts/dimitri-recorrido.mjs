// Herramienta de desarrollo (no entra en `npm run check`): el recorrido de Dimitri con el Estudio EN EL NAVEGADOR, de punta a punta,
// sin gastar: una oficina en una carpeta temporal, su Claude es un servidor simulado (API compatible) y genera el motor gratis «Prueba».
//   node scripts/dimitri-recorrido.mjs   → capturas en data/capturas/dimitri-recorrido/ y ✓/✗ por paso
// Pasos: abrir el Estudio · S abre a Dimitri al lado · 📎 adjunta una foto (sube a «Referencias de Dimitri») · escribir y ENVIAR ·
// llegan las tarjetas del plan de creativos con su costo · nada se generó aún · GENERAR · llegan las miniaturas al chat.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'dimitri-recorrido'); fs.mkdirSync(OUT, { recursive: true });
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DwHwyBNAMDA4wBAH+qD/HT3d4PAAAAAElFTkSuQmCC';
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));
const seen = [];
const PLAN = { mode: 'estudio', reply: 'Te propongo dos piezas para el lanzamiento, con tu foto de referencia y la voz de la marca.', image_text: '',
  creatives: [
    { title: 'Reel vertical del producto', kind: 'image', model: 'prueba', why: 'Prueba: gratis para ver el recorrido.', prompt: 'Product hero shot on volcanic black rock, orange rim light #FF5100, clean space at the bottom for "LANZAMIENTO"', prompt_es: 'Producto sobre roca volcánica negra, luz naranja de contorno, espacio abajo para «LANZAMIENTO»', n: 2, settings: { aspectRatio: '9:16' }, media: { reference: ['__REF__'] }, folder: 'Lanzamiento octubre', purpose: 'Lanzamiento de octubre' },
    { title: 'Post cuadrado', kind: 'image', model: 'prueba', why: 'Para el feed.', prompt: 'Flat lay of the product with the brand colours', prompt_es: 'El producto visto desde arriba con los colores de la marca', n: 1, settings: { aspectRatio: '1:1' }, media: {}, folder: 'Lanzamiento octubre', purpose: 'Lanzamiento de octubre' }],
  actions: [{ type: 'carpeta_crear', name: 'Lanzamiento octubre' }] };
let refId = '';
const claude = http.createServer((rq, rs) => { let b = ''; rq.on('data', d => { b += d; }); rq.on('end', () => {
  const body = JSON.parse(b || '{}'); seen.push(body);
  const text = JSON.stringify(PLAN).replace('__REF__', refId);
  rs.writeHead(200, { 'content-type': 'application/json' });
  rs.end(JSON.stringify({ id: 'msg', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } }));
}); });
const cport = await listen(claude);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-recorrido-')), brain = path.join(dir, 'brain');
fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana y directa.\n');
const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), ANTHROPIC_API_KEY: 'no-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '' };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
const imgFile = path.join(dir, 'producto.png'); fs.writeFileSync(imgFile, Buffer.from(PNG, 'base64'));

let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
try {
  for (const [w, h, tema] of [[1512, 900, 'light'], [1512, 900, 'dark'], [390, 844, 'light']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500 });
    const page = await ctx.newPage(); const errs = []; const known = new Set((await (await fetch(base + '/api/media/jobs')).json()).jobs.map(j => j.id)); page.on('pageerror', e => errs.push(e.message));
    await page.goto(base + '/'); await page.waitForTimeout(1500);
    await page.evaluate(t => { document.body.classList.toggle('dark', t === 'dark'); }, tema);
    await page.evaluate(() => fetch('/api/sub/clear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
    if (w > 900) { await page.keyboard.press('e'); await page.waitForTimeout(500); }
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('s'); await page.waitForSelector('#subOv:not([hidden])'); await page.waitForTimeout(400);
    const tag = `${w}-${tema}`;
    if (w > 900) { const r = await page.evaluate(() => ({ sub: document.querySelector('#subOv').getBoundingClientRect().right, view: document.querySelector('#studioOv').getBoundingClientRect().left })); step(Math.abs(r.sub - r.view) < 2, `${tag}: con el Estudio abierto, la vista empieza donde termina Dimitri (${Math.round(r.sub)} / ${Math.round(r.view)})`); }
    // 📎 adjuntar
    const input = await page.$('#subOv input[type="file"]'); step(!!input, `${tag}: hay botón para adjuntar`);
    if (input) await input.setInputFiles(imgFile);
    await page.waitForFunction(() => document.querySelectorAll('#subOv img').length > 0, null, { timeout: 15000 }).catch(() => {});
    let media = null, ref = null; // the preview shows at once; the upload lands a moment later
    for (let i = 0; i < 40 && !ref; i++) { media = await (await fetch(base + '/api/media')).json(); ref = media.items.find(x => /producto/.test(x.file)); if (!ref) await new Promise(r => setTimeout(r, 250)); }
    refId = ref ? ref.file : ''; const fRef = media.folders.find(f => f.name === 'Referencias de Dimitri');
    step(!!ref && !!fRef && ref.folder === fRef.id, `${tag}: la foto se subió a «Referencias de Dimitri»`);
    await page.fill('#subOv textarea', 'Hazme creativos para el lanzamiento de octubre con esta foto, formato reel.');
    await page.click('#subOv .sb-send');
    await page.waitForFunction(() => /GENERAR/.test(document.querySelector('#subOv').textContent), null, { timeout: 20000 }).catch(() => {});
    const last = seen[seen.length - 1] || {}; const blocks = JSON.stringify(last.messages || []);
    step(/"type":"image"/.test(blocks), `${tag}: Claude recibió la imagen (bloque image)`);
    const cards = await page.evaluate(() => ({ txt: document.querySelector('#subOv').textContent, go: [...document.querySelectorAll('#subOv button')].find(b => /GENERAR/.test(b.textContent))?.textContent }));
    step(/Reel vertical del producto/.test(cards.txt) && /Post cuadrado/.test(cards.txt), `${tag}: llegan las tarjetas del plan`);
    step(!!cards.go, `${tag}: botón «${(cards.go || '').trim()}»`);
    const jobsBefore = (await (await fetch(base + '/api/media/jobs')).json()).jobs.filter(j => !known.has(j.id)).length; // only this pass's jobs
    step(jobsBefore === 0, `${tag}: nada se generó antes de GENERAR (${jobsBefore} trabajos)`);
    await page.screenshot({ path: path.join(OUT, `plan-${tag}.png`) });
    await page.evaluate(() => [...document.querySelectorAll('#subOv button')].find(b => /GENERAR/.test(b.textContent)).click());
    await page.waitForFunction(() => /Listos/.test(document.querySelector('#subOv').textContent), null, { timeout: 30000 }).catch(() => {});
    const done = await page.evaluate(() => ({ listos: /Listos/.test(document.querySelector('#subOv').textContent), thumbs: document.querySelectorAll('#subOv img').length }));
    const after = await (await fetch(base + '/api/media')).json(); const made = after.items.filter(i => i.by === 'dimitri');
    const fL = after.folders.find(f => f.name === 'Lanzamiento octubre');
    step(done.listos && made.length >= 3, `${tag}: GENERAR → «Listos» en el chat y ${made.length} archivos de Dimitri (${done.thumbs} miniaturas)`);
    step(!!fL && made.every(i => i.folder === fL.id), `${tag}: todo quedó en la carpeta «Lanzamiento octubre»`);
    if (w > 900) { const n = await page.waitForFunction(() => { const m = /(\d+) archivos?/.exec(document.querySelector('#studioOv .st-count')?.textContent || ''); return m && +m[1] >= 4 ? +m[1] : false; }, null, { timeout: 6000 }).then(h => h.jsonValue()).catch(() => 0); step(n >= 4, `${tag}: el Estudio de al lado ya muestra lo de Dimitri sin esperar su refresco (${n} archivos)`); }
    await page.waitForTimeout(500); await page.screenshot({ path: path.join(OUT, `listos-${tag}.png`) });
    step(!errs.length, `${tag}: sin errores en la página${errs.length ? ': ' + errs[0] : ''}`);
    // la próxima pasada empieza limpia: lo generado a la papelera
    for (const it of after.items) await fetch(base + '/api/media/item/' + encodeURIComponent(it.file), { method: 'DELETE' });
    await ctx.close();
  }
} finally { await browser.close(); srv.kill(); claude.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
console.log(`\n${fails ? fails + ' paso(s) fallaron' : 'todo bien'} · capturas en ${path.relative(ROOT, OUT)}`);
if (fails) { console.log(log.split('\n').slice(-12).join('\n')); process.exitCode = 1; }
