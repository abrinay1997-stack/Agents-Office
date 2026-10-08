// Herramienta de desarrollo (no entra en `npm run check`): las TARJETAS del calendario de Contenido (C2, 8 oct 2026) en el navegador, con la
// oficina de verdad (temporal, sin keys). Siembra piezas de esta semana con fotos, varios archivos, texto, hashtags y un formato distinto por
// red, y mira: la tarjeta enseña el texto bajo el título, «+N» sobre la miniatura y el formato de la red que sale distinto; al pasar el ratón
// (y al llegar con el teclado) sale la vista previa con la imagen, el texto y el estado; Esc la cierra sin cerrar Contenido; un clic en ella
// abre la pieza; en el teléfono no sale. Mide letra (10,5 px) y desborde. Capturas en data/capturas/tarjetas-contenido/.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'tarjetas-contenido'); fs.mkdirSync(OUT, { recursive: true });
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-tarjetas-')), data = path.join(dir, 'data'), brain = path.join(dir, 'brain');
fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
const mes = new Date().toISOString().slice(0, 7), mdir = path.join(brain, 'Agents Office', 'media', mes); fs.mkdirSync(mdir, { recursive: true });
const fotos = [];
for (const [n, bg, w, h] of [['a', '#e66a2f', 1080, 1350], ['b', '#2f7be6', 1080, 1080], ['c', '#2fa36b', 1080, 1350], ['d', '#8a4fd6', 1080, 1920]]) {
  fs.writeFileSync(path.join(mdir, `${n}.jpg`), await sharp({ create: { width: w, height: h, channels: 3, background: bg } }).jpeg().toBuffer());
  fs.writeFileSync(path.join(mdir, `${n}.json`), JSON.stringify({ file: `${mes}/${n}.jpg`, kind: 'image', model: 'upload', prompt: n, w, h, at: Date.now() }));
  fotos.push(`${mes}/${n}.jpg`);
}
const local = path.join(dir, 'local.json'); fs.writeFileSync(local, JSON.stringify({ contenido: { modo: 'simulacro', redes: ['instagram', 'facebook'] } }));
const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: local, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_API_KEY: '', ANTHROPIC_BASE_URL: '', TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', METRICOOL_USER_ID: '' };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
const api = async (m, p, b) => (await fetch(base + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json();
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dia = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
await api('POST', '/api/contenido/piezas', { titulo: 'Examen gratis de octubre', fecha: dia(1), hora: '09:00', formato: 'carrusel', redes: ['instagram', 'facebook'], medios: fotos.slice(0, 3), texto: 'Agenda tu examen visual gratis y sal con tus lentes en 40 minutos. Solo en octubre, en la tienda del centro.', hashtags: '#optica #panama', estado: 'revision' });
await api('POST', '/api/contenido/piezas', { fecha: dia(2), hora: '18:00', formato: 'reel', formatos: { facebook: 'post' }, redes: ['instagram', 'facebook'], medios: [fotos[3]], texto: 'Así se prueba un lente: tres pasos y listo.\nVen a probarlo tú.' });
await api('POST', '/api/contenido/piezas', { titulo: 'Kit de limpieza', fecha: dia(3), hora: '12:30', formato: 'post', redes: ['instagram'], medios: [fotos[1]], texto: 'Por la compra de tus lentes, elige tu regalo: kit de limpieza o estuche.' });

let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
let browser;
try {
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  for (const [w, h] of [[1512, 900], [1024, 768], [390, 844]]) for (const tema of ['light', 'dark']) {
    const tag = `${w}-${tema}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: tema, reducedMotion: 'reduce', hasTouch: w < 500, isMobile: w < 500 }); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(t => { try { localStorage.setItem('ao.theme', t); localStorage.setItem('ao.onboarded', '1'); } catch {} }, tema === 'dark' ? 'dark' : 'light');
    await page.goto(base + '/'); await page.waitForTimeout(1500);
    await page.keyboard.press('Escape'); await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('k'); await page.waitForSelector('#ctOv .ct-mode', { state: 'visible' }); await page.waitForTimeout(400);
    for (const v of ['week', 'agenda', 'month']) {
      const b = await page.$(`#ctOv .ct-views [data-v="${v}"]`), sel = await page.$('#ctOv .ct-vsel');
      if (b && await b.isVisible()) await b.click(); else if (sel && await sel.isVisible()) await page.selectOption('#ctOv .ct-vsel', v); else continue; // a 1024 no hay botón de Agenda: es la vista del teléfono
      await page.waitForTimeout(500);
      const r = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('#ctGrid .cv-ev.pz')];
        const tiny = [...document.querySelectorAll('#ctGrid .cv-ev.pz *')].filter(e => e.offsetParent && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) > 0 && parseFloat(getComputedStyle(e).fontSize) < 10.5).length; // 0 = la insignia hecha punto en un mes estrecho: no se lee, a propósito
        return { n: cards.length, mas: !!document.querySelector('#ctGrid .pz-mas'), snip: [...document.querySelectorAll('#ctGrid .pz-snip')].filter(x => x.offsetParent).map(x => x.textContent.slice(0, 30)), nf: !!document.querySelector('#ctGrid .pz-nf'), aria: cards.map(c => c.getAttribute('aria-label')).join(' | '), tiny, hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      step(r.n >= 3, `${tag} ${v}: las tres piezas en el calendario (${r.n})`);
      step(r.mas, `${tag} ${v}: «+2» sobre la miniatura del carrusel`);
      step(r.nf && /Facebook \(post\)/.test(r.aria), `${tag} ${v}: Facebook sale como post y la tarjeta lo dice (icono y lector de pantalla)`);
      if (v === 'agenda' || (v === 'week' && w >= 1500)) step(r.snip.some(t => /Agenda tu examen/.test(t)), `${tag} ${v}: el texto que sale, bajo el título (${r.snip.length})`);
      step(r.tiny === 0, `${tag} ${v}: ninguna letra bajo 10,5 px (${r.tiny})`);
      step(!r.hscroll, `${tag} ${v}: nada se sale a lo ancho`);
      await page.screenshot({ path: path.join(OUT, `${tag}-${v}.png`) });
    }
    // la vista previa al pasar
    const b = await page.$('#ctOv .ct-views [data-v="week"]'); if (b && await b.isVisible()) await b.click(); else await page.selectOption('#ctOv .ct-vsel', 'week').catch(() => {});
    await page.waitForTimeout(500);
    const card = page.locator('#ctGrid .cv-ev.pz', { hasText: 'Examen gratis' }).first();
    if (w >= 1024) {
      await card.hover(); await page.waitForTimeout(700);
      const hv = await page.evaluate(() => { const h = document.querySelector('.ct-hov'); const r = h.getBoundingClientRect(); return { on: !h.hidden, txt: h.textContent, img: !!h.querySelector('img'), fuera: r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 }; });
      step(hv.on && /Agenda tu examen visual gratis/.test(hv.txt) && /#optica/.test(hv.txt) && hv.img, `${tag}: al pasar el ratón sale la vista previa con la imagen, el texto y los hashtags`);
      step(!hv.fuera, `${tag}: la vista previa cabe en la pantalla`);
      await page.screenshot({ path: path.join(OUT, `${tag}-vistazo.png`) });
      await page.keyboard.press('Escape'); await page.waitForTimeout(250);
      step(await page.evaluate(() => document.querySelector('.ct-hov').hidden && document.body.classList.contains('ctOpen')), `${tag}: Esc cierra la vista previa y deja Contenido abierto`);
      await card.hover({ position: { x: 4, y: 4 } }); await page.waitForTimeout(700);
      await page.click('.ct-hov'); await page.waitForTimeout(500);
      step(await page.evaluate(() => !document.querySelector('.ct-panel').hidden && document.querySelector('.ct-hov').hidden), `${tag}: un clic en la vista previa abre la pieza`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(500);
      await card.focus(); await page.waitForTimeout(900);
      step(await page.evaluate(() => !document.querySelector('.ct-hov').hidden), `${tag}: llegar con el teclado también la enseña`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    } else {
      await card.tap().catch(() => card.click()); await page.waitForTimeout(600);
      step(await page.evaluate(() => document.querySelector('.ct-hov').hidden && !document.querySelector('.ct-panel').hidden), `${tag}: en el teléfono no hay vista previa: tocar abre la pieza`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    }
    step(!errs.length, `${tag}: sin errores de la página${errs.length ? ': ' + errs[0] : ''}`);
    await ctx.close();
  }
} catch (e) { fails++; console.log('✗ ' + e.message.split('\n')[0]); }
finally { await browser?.close(); srv.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
console.log(fails ? `✗ ${fails} paso(s) fallaron · capturas en ${path.relative(ROOT, OUT)}` : `✓ todo bien · capturas en ${path.relative(ROOT, OUT)}`);
if (fails && process.env.AO_LOG) console.log(log.slice(-3000));
process.exit(fails ? 1 : 0);
