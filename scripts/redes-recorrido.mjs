// Herramienta de desarrollo (no entra en `npm run check`): las NUEVE REDES en el panel de una pieza (plan M2, 6 oct 2026), en el
// navegador y con la oficina de verdad (temporal: cerebro copiado, datos aparte, sin keys). Abre una pieza, pide «Más redes», marca
// X, LinkedIn, Pinterest y YouTube, escribe un texto largo y mira: el contador se mide con X, la revisión pide un texto para X y un
// tablero, los arreglos abren su campo, la vista previa tiene una pestaña por red y lo guardado vuelve igual.
//   node scripts/redes-recorrido.mjs   → capturas en data/capturas/redes/ y ✓/✗ por paso, a 390, 1024 y 1512 en claro y oscuro
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'redes'); fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-redes-')), data = path.join(dir, 'data'), brain = path.join(dir, 'brain');
fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
const local = path.join(dir, 'local.json'); fs.writeFileSync(local, JSON.stringify({ contenido: { modo: 'simulacro', redes: ['instagram', 'linkedin'] } }));
const probe = http.createServer(); const port = await new Promise(r => probe.listen(0, '127.0.0.1', () => r(probe.address().port))); await new Promise(r => probe.close(r));
const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: local, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_BASE_URL: '', ANTHROPIC_API_KEY: '', TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', METRICOOL_USER_ID: '', METRICOOL_BLOG_ID: '' };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }

let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const LARGO = 'Esta semana llegan los lentes de sol polarizados a la tienda del centro. ' .repeat(5).trim();
let browser;
try {
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  for (const [w, h] of [[1512, 900], [1024, 768], [390, 844]]) for (const tema of ['light', 'dark']) {
    const tag = `${w}-${tema}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500, colorScheme: tema });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(base + '/'); await page.waitForTimeout(1500);
    await page.evaluate(t => { document.body.classList.toggle('dark', t === 'dark'); }, tema);
    await page.keyboard.press('k'); await page.waitForSelector('#ctOv .ct-mode', { state: 'visible' }); await page.waitForTimeout(500);
    // las redes del negocio (Instagram y LinkedIn) son las de los filtros
    const chips = await page.evaluate(() => [...document.querySelectorAll('#ctChips [data-r]')].map(b => b.dataset.r).join(','));
    step(tag === '1512-light' ? chips === 'instagram,linkedin' : chips.startsWith('instagram,linkedin'), `${tag}: los filtros son las redes que usas y las de tus piezas (${chips})`);
    await page.click('#ctNew'); await page.waitForTimeout(300);
    const menu = await page.$('.ct-newmenu:not([hidden]) button'); if (menu) { await menu.click(); await page.waitForTimeout(300); }
    await page.waitForSelector('.ct-panel:not([hidden]) .pz-nets', { timeout: 5000 });
    const antes = await page.evaluate(() => [...document.querySelectorAll('.pz-nets [data-red]')].map(b => b.dataset.red + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(','));
    step(antes === 'instagram*,linkedin*', `${tag}: una pieza nueva sale con las redes que usas (${antes})`);
    await page.click('[data-a="mas-redes"]'); await page.waitForTimeout(200);
    const todas = await page.evaluate(() => document.querySelectorAll('.pz-nets [data-red]').length);
    step(todas === 9, `${tag}: «Más redes» enseña las nueve (${todas})`);
    for (const r of ['x', 'pinterest', 'youtube']) { await page.click(`.pz-nets [data-red="${r}"]`); await page.waitForTimeout(150); }
    await page.fill('.pz-ta[data-f="texto"]', LARGO); await page.waitForTimeout(400);
    const cx = await page.evaluate(() => { const x = document.querySelector('.pz-cc[data-cc="x"]'); return x ? { t: x.textContent, over: x.classList.contains('over') } : null; });
    step(cx && /\/ 280/.test(cx.t) && cx.over, `${tag}: un contador por red, y el de X avisa que no cabe («${cx?.t}»)`);
    await page.click('[data-a="avisos"]'); await page.waitForTimeout(200); // C1: «N problemas» se despliega
    const rv = await page.evaluate(() => document.querySelector('.pz-rv').textContent);
    step(/El texto de X tiene/.test(rv) && /tablero/.test(rv) && /YouTube necesita un video/.test(rv), `${tag}: la revisión pide texto para X, el tablero y el video`);
    await page.click('.pz-fix[data-fix="texto-red:x"]'); await page.waitForTimeout(500);
    const foco = await page.evaluate(() => document.activeElement?.dataset?.tx || '');
    step(foco === 'x', `${tag}: «Escribir uno para X» abre su campo y pone el foco (${foco || 'nada'})`);
    await page.keyboard.type('Lentes polarizados, ya en tienda.'); await page.waitForTimeout(300);
    await page.click('.pz-fix[data-fix="opciones:pinterest"]'); await page.waitForTimeout(500);
    step(await page.evaluate(() => document.activeElement?.dataset?.op === 'pinterest.tablero'), `${tag}: «Elegir el tablero» pone el foco en el tablero`);
    await page.keyboard.type('123456'); await page.waitForTimeout(300);
    const rv2 = await page.evaluate(() => document.querySelector('.pz-rv').textContent);
    step(!/El texto de X/.test(rv2) && !/tablero/.test(rv2), `${tag}: con su texto y su tablero, X y Pinterest ya no fallan`);
    const tabs = await page.evaluate(() => [...document.querySelectorAll('.pv-tabs [data-pv-tab]')].map(b => b.dataset.pvTab).join(','));
    step(['li-feed', 'x-feed', 'pi-pin', 'yt-video'].every(t => tabs.includes(t)), `${tag}: una pestaña de vista previa por red (${tabs})`);
    const r = await page.evaluate(() => {
      const panel = document.querySelector('.ct-panel:not([hidden])');
      const small = [...panel.querySelectorAll('button, summary, select, input')].filter(b => b.offsetParent && b.type !== 'checkbox').map(b => b.getBoundingClientRect()).filter(b => b.height < 24 || b.width < 24).length;
      const tiny = [...panel.querySelectorAll('*')].filter(e => e.offsetParent && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 10.5).length;
      return { small, tiny, hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    step(r.small === 0, `${tag}: los controles del panel miden 24 px o más (${r.small} no)`);
    step(r.tiny === 0, `${tag}: ningún texto del panel baja de 10,5 px (${r.tiny})`);
    step(!r.hscroll, `${tag}: la página no se desplaza a lo ancho`);
    await page.screenshot({ path: path.join(OUT, `${tag}-panel.png`) });
    if (w >= 1024) { await page.click('[data-pv-tab="x-feed"]'); await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, `${tag}-x.png`) }); await page.click('[data-pv-tab="pi-pin"]'); await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, `${tag}-pin.png`) }); }
    await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
    step(!errs.length, `${tag}: sin errores de la página${errs.length ? ': ' + errs[0] : ''}`);
    await ctx.close();
  }
  const { piezas } = await (await fetch(base + '/api/contenido?sin_fecha=1')).json();
  const p = piezas.find(x => x.redes.includes('pinterest'));
  step(p && p.textos?.x === 'Lentes polarizados, ya en tienda.' && p.pinterest?.tablero === '123456', `lo guardado vuelve igual (X: «${p?.textos?.x}», tablero ${p?.pinterest?.tablero})`);
} catch (e) { fails++; console.log('✗ ' + e.message); console.log(log.split('\n').slice(-15).join('\n')); }
finally { await browser?.close(); srv.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
console.log(fails ? `\n✗ ${fails} paso(s) fallaron · capturas en ${path.relative(ROOT, OUT)}` : `\n✓ todo bien · capturas en ${path.relative(ROOT, OUT)}`);
process.exit(fails ? 1 : 0);
