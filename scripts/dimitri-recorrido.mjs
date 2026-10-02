// Herramienta de desarrollo (no entra en `npm run check`): el recorrido de Dimitri con el Estudio EN EL NAVEGADOR, de punta a punta,
// sin gastar: una oficina en una carpeta temporal, su Claude es un servidor simulado (API compatible) y genera el motor gratis «Prueba».
//   node scripts/dimitri-recorrido.mjs [creativos|lote]   → ✓/✗ por paso; sin argumento, los dos
// creativos (capturas en data/capturas/dimitri-recorrido/): abrir el Estudio · S abre a Dimitri al lado · 📎 adjunta una foto (sube a
//   «Referencias de Dimitri») · escribir y ENVIAR · llegan las tarjetas del plan de creativos con su costo · nada se generó aún · GENERAR ·
//   llegan las miniaturas al chat.
// lote (banco de presets F3, «las fotos de la bodega → web»; capturas en data/capturas/presets/dimitri/): 12 fotos en «Bodega» · «convierte
//   las fotos de la bodega en catálogo» · Dimitri pregunta para dónde, con opciones · «Web con margen» · la tarjeta del lote con su costo
//   (nada creado) · PROBAR CON 3 · «Listas las 3 de prueba» con SEGUIR · SEGUIR · la tarjeta se mueve sola · «Lote listo». A 390, 1024 y
//   1512 px, en claro y en oscuro. La receta del simulado es local (luz y blancos): corre sin keys y gratis.
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
const MODO = process.argv[2] || 'todo';
const OUT_LOTE = path.join(ROOT, 'data', 'capturas', 'presets', 'dimitri');
const seen = [];
let responder = null; // the lote walk-through answers by what the owner just said; the creatives one always with PLAN
const PLAN = { mode: 'estudio', reply: 'Te propongo dos piezas para el lanzamiento, con tu foto de referencia y la voz de la marca.', image_text: '',
  creatives: [
    { title: 'Reel vertical del producto', kind: 'image', model: 'prueba', why: 'Prueba: gratis para ver el recorrido.', prompt: 'Product hero shot on volcanic black rock, orange rim light #FF5100, clean space at the bottom for "LANZAMIENTO"', prompt_es: 'Producto sobre roca volcánica negra, luz naranja de contorno, espacio abajo para «LANZAMIENTO»', n: 2, settings: { aspectRatio: '9:16' }, media: { reference: ['__REF__'] }, folder: 'Lanzamiento octubre', purpose: 'Lanzamiento de octubre' },
    { title: 'Post cuadrado', kind: 'image', model: 'prueba', why: 'Para el feed.', prompt: 'Flat lay of the product with the brand colours', prompt_es: 'El producto visto desde arriba con los colores de la marca', n: 1, settings: { aspectRatio: '1:1' }, media: {}, folder: 'Lanzamiento octubre', purpose: 'Lanzamiento de octubre' }],
  actions: [{ type: 'carpeta_crear', name: 'Lanzamiento octubre' }] };
let refId = '';
const claude = http.createServer((rq, rs) => { let b = ''; rq.on('data', d => { b += d; }); rq.on('end', () => {
  const body = JSON.parse(b || '{}'); seen.push(body);
  const text = responder ? JSON.stringify(responder(body)) : JSON.stringify(PLAN).replace('__REF__', refId);
  rs.writeHead(200, { 'content-type': 'application/json' });
  rs.end(JSON.stringify({ id: 'msg', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } }));
}); });
const cport = await listen(claude);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-recorrido-')), brain = path.join(dir, 'brain');
fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana y directa.\n');
const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), ANTHROPIC_API_KEY: 'no-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '', HF_API_KEY: '' };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
const imgFile = path.join(dir, 'producto.png'); fs.writeFileSync(imgFile, Buffer.from(PNG, 'base64'));

let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
try {
  if (MODO !== 'lote') for (const [w, h, tema] of [[1512, 900, 'light'], [1512, 900, 'dark'], [390, 844, 'light']]) {
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
  if (MODO !== 'creativos') await recorridoLote();
} finally { await browser.close(); srv.kill(); claude.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }

/* ---------- banco de presets F3: el lote de la bodega, en el navegador ---------- */
async function recorridoLote() {
  fs.mkdirSync(OUT_LOTE, { recursive: true });
  let sharp; try { sharp = (await import('sharp')).default; } catch { step(false, 'lote: sin sharp no hay fotos ni receta local'); return; }
  const api = async (p, b) => { const r = await fetch(base + p, { method: b ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }); return r.json(); };
  const carpeta = (await api('/api/media/folders', { name: 'Bodega' })).folder.id;
  for (let i = 0; i < 12; i++) { // 12 «camas» marrones sobre la pared gris de la bodega, cada una un poco distinta
    const cama = await sharp({ create: { width: 160 + i * 4, height: 70, channels: 3, background: { r: 120 + i * 6, g: 84, b: 52 } } }).png().toBuffer();
    const img = await sharp({ create: { width: 360, height: 270, channels: 3, background: { r: 205, g: 200, b: 190 } } }).composite([{ input: cama, left: 70, top: 130 }]).png().toBuffer();
    await api('/api/media/upload', { name: `cama bodega ${i + 1}`, data: 'data:image/png;base64,' + img.toString('base64'), folder: carpeta });
  }
  const RECETA = { pila: [{ id: 'luz-arreglar' }, { id: 'color-blancos' }], canal: 'web' };
  responder = body => {
    const last = JSON.stringify(body.messages?.at(-1) || '').split('Dueño: ').pop();
    if (/Para d[oó]nde|Canal|Web/i.test(last)) return { mode: 'estudio', reply: 'Este es el lote: arreglo la luz y los blancos en tu máquina (gratis) y las dejo listas para la web. Pruebo primero con 3.', lote: { nombre: 'Camas de la bodega → web', fotos: { carpeta: 'Bodega' }, receta: RECETA, muestra: 3, carpeta_destino: 'Catálogo web', por_que: 'Las 12 con la misma luz, para que la web se vea pareja.' } };
    return { mode: 'estudio', reply: 'Lo preparo como un lote.', lote: { nombre: 'Camas de la bodega → web', fotos: { carpeta: 'bodega' }, receta: { pila: RECETA.pila } } }; // sin canal: la oficina pregunta
  };
  for (const [w, h, tema] of [[390, 844, 'light'], [390, 844, 'dark'], [1024, 768, 'light'], [1024, 768, 'dark'], [1512, 900, 'light'], [1512, 900, 'dark']]) {
    const tag = `${w}-${tema}`, ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500 });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    const antes = new Set((await api('/api/media/lotes')).lotes.map(l => l.id));
    await page.goto(base + '/'); await page.waitForTimeout(1500);
    await page.evaluate(t => { document.body.classList.toggle('dark', t === 'dark'); }, tema);
    await page.evaluate(() => fetch('/api/sub/clear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
    if (w > 900) { await page.keyboard.press('e'); await page.waitForTimeout(500); }
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('s'); await page.waitForSelector('#subOv:not([hidden])'); await page.waitForTimeout(400);
    await page.fill('#subOv textarea', 'Dimitri, convierte las fotos de la bodega en catálogo');
    await page.click('#subOv .sb-send');
    await page.waitForSelector('#subOv .sb-opt', { timeout: 20000 }).catch(() => {});
    const preg = await page.evaluate(() => document.querySelector('#subOv').textContent);
    step(/¿Para dónde son las fotos\?/.test(preg) && /Web con margen 60 %/.test(preg), `${tag}: sin canal, Dimitri pregunta con opciones`);
    step(!/PROBAR CON/.test(preg), `${tag}: y todavía no hay lote`);
    await page.screenshot({ path: path.join(OUT_LOTE, `1-pregunta-${tag}.png`) });
    await page.click('#subOv .sb-opt'); await page.waitForTimeout(150);
    const qgo = await page.$('#subOv .sb-qgo:not([disabled])'); if (qgo) await qgo.click();
    await page.waitForFunction(() => /PROBAR CON 3/.test(document.querySelector('#subOv').textContent), null, { timeout: 25000 }).catch(() => {});
    const plan = await page.evaluate(() => ({ t: document.querySelector('#subOv .sl-card')?.textContent || '', btns: [...document.querySelectorAll('#subOv .sl-card .sc-go')].map(b => b.textContent.trim()) }));
    step(/12 fotos de «Bodega»/.test(plan.t) && plan.btns.some(b => /^PROBAR CON 3/.test(b)) && plan.btns.some(b => /^GENERAR LAS 12/.test(b)), `${tag}: la tarjeta del lote: ${plan.btns.join(' | ')}`);
    step((await api('/api/media/lotes')).lotes.every(l => antes.has(l.id)), `${tag}: proponer no crea ningún lote`);
    await page.$eval('#subOv .sl-card', el => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: path.join(OUT_LOTE, `2-plan-${tag}.png`) });
    const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: innerWidth, card: Math.round(document.querySelector('#subOv .sl-card').getBoundingClientRect().right), panel: Math.round(document.querySelector('#subOv').getBoundingClientRect().right) }));
    step(ancho.doc <= ancho.vw + 1 && ancho.card <= ancho.panel + 1, `${tag}: nada se sale a lo ancho (${ancho.doc}/${ancho.vw}, tarjeta ${ancho.card}/${ancho.panel})`);
    const chicos = await page.evaluate(() => [...document.querySelectorAll('#subOv .sl-card button, #subOv .sl-card select, #subOv .sl-card summary')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(r => r.height < 24 || r.width < 24).length);
    step(!chicos, `${tag}: todos los controles de la tarjeta miden 24 px o más (${chicos} chicos)`);
    await page.click('#subOv .sl-card .sc-go[data-lote="probar"]');
    await page.waitForFunction(() => /Listas las 3 de prueba/.test(document.querySelector('#subOv').textContent), null, { timeout: 60000 }).catch(() => {});
    const muestra = await page.evaluate(() => ({ t: document.querySelector('#subOv').textContent, seguir: !!document.querySelector('#subOv .sl-ref .sc-go[data-lote="seguir"]'), bar: document.querySelector('#subOv .sl-bar')?.getAttribute('aria-valuenow') }));
    step(/Listas las 3 de prueba/.test(muestra.t) && muestra.seguir, `${tag}: PROBAR CON 3 → «Listas las 3 de prueba» con SEGUIR`);
    step(muestra.bar === '3', `${tag}: la tarjeta del lote se movió sola (barra ${muestra.bar}/12)`);
    await page.screenshot({ path: path.join(OUT_LOTE, `3-muestra-${tag}.png`) });
    await page.click('#subOv .sl-ref .sc-go[data-lote="seguir"]');
    await page.waitForFunction(() => /Lote listo/.test(document.querySelector('#subOv').textContent), null, { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(3500); // el siguiente refresco de la tarjeta
    const fin = await page.evaluate(() => ({ t: document.querySelector('#subOv').textContent, bar: document.querySelector('#subOv .sl-bar')?.getAttribute('aria-valuenow'), pares: document.querySelectorAll('#subOv .sl-par').length, zip: !!document.querySelector('#subOv .sl-ref a[download]') }));
    step(/Lote listo «Camas de la bodega → web»/.test(fin.t) && fin.bar === '12', `${tag}: SEGUIR → «Lote listo» y la tarjeta en 12/12`);
    step(fin.pares > 0 && fin.zip, `${tag}: antes → después a la vista (${fin.pares}) y el ZIP`);
    await page.$eval('#subOv .sl-card', el => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: path.join(OUT_LOTE, `4-listo-${tag}.png`) });
    step(!errs.length, `${tag}: sin errores en la página${errs.length ? ': ' + errs[0] : ''}`);
    await ctx.close();
  }
  responder = null;
}
console.log(`\n${fails ? fails + ' paso(s) fallaron' : 'todo bien'} · capturas en ${path.relative(ROOT, OUT)}`);
if (fails) { console.log(log.split('\n').slice(-12).join('\n')); process.exitCode = 1; }
