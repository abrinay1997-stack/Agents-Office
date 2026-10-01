// Herramienta de desarrollo (no entra en `npm run check`): la barra y el panel de conectores EN EL NAVEGADOR con la lista real
// de la máquina del dueño (tests/fixtures/mcp: 129 servidores, la mayoría plugins), sin Claude Code: la oficina arranca con esa
// lista como caché. Auditoría MCP (1 oct 2026, MCP-10/11/15).
//   node scripts/conectores-recorrido.mjs   → capturas en data/capturas/mcp/ y ✓/✗ por paso, a 390, 1024 y 1512 en claro y oscuro
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'mcp'); fs.mkdirSync(OUT, { recursive: true });
const FIX = path.join(ROOT, 'tests', 'fixtures', 'mcp');
const mcp = await import('../mcp.mjs');
const init = JSON.parse(fs.readFileSync(path.join(FIX, 'init.json'), 'utf8'));
const list = mcp.parseList(fs.readFileSync(path.join(FIX, 'mcp-list.txt'), 'utf8')).map(s => ({ raw: s.raw, name: s.name, target: s.target, status: s.status, detail: s.detail,
  tools: init.tools.filter(t => t.startsWith(`mcp__${s.id}__`)).map(t => t.slice(s.id.length + 7)) }));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-conectores-')), data = path.join(dir, 'data');
fs.mkdirSync(data, { recursive: true });
fs.writeFileSync(path.join(data, 'mcp-cache-anthropic.json'), JSON.stringify({ at: Date.now(), servers: list, long: [] }));
const probe = http.createServer(); const port = await new Promise(r => probe.listen(0, '127.0.0.1', () => r(probe.address().port))); await new Promise(r => probe.close(r));
const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_BASE_URL: '', ANTHROPIC_API_KEY: '', TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '' };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }

let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const api = await (await fetch(base + '/api/mcp')).json();
step(!JSON.stringify(api).includes('C:/Users'), 'la API no enseña rutas locales');
step(api.discovering === true || api.discovering === false, 'la API dice si está comprobando');
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
try {
  for (const [w, h] of [[1512, 900], [1024, 768], [390, 844]]) for (const tema of ['light', 'dark']) {
    const tag = `${w}-${tema}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500, colorScheme: tema });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(base + '/'); await page.waitForSelector('#topconn .tc-lab', { timeout: 20000, state: 'attached' }); await page.waitForTimeout(1200);
    await page.evaluate(t => { document.body.classList.toggle('dark', t === 'dark'); }, tema);
    const bar = await page.evaluate(() => ({ imgs: document.querySelectorAll('#topconn img').length, more: document.querySelector('#topconn .tc-more')?.textContent || '', alts: [...document.querySelectorAll('#topconn img')].map(i => i.alt) }));
    step(bar.imgs > 0 && bar.imgs < 40, `${tag}: la barra pinta ${bar.imgs} iconos (antes 131)`);
    step(/^\+\d+$/.test(bar.more), `${tag}: el resto va en «${bar.more}»`);
    step(!bar.alts.some(a => /^plugin:|Small-business/i.test(a)), `${tag}: los iconos se llaman por su nombre (${bar.alts.slice(0, 4).join(', ')}…)`);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    if (await page.$eval('#topconn .tc-lab', el => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0)) await page.click('#topconn .tc-lab');
    else await page.evaluate(() => document.querySelector('#topconn .tc-lab').click()); // en el teléfono la barra de conectores no se ve (diseño de V4): se abre igual para medir el panel
    await page.waitForSelector('#connPanel');
    const p = await page.evaluate(() => {
      const el = document.querySelector('#connPanel'), r = el.getBoundingClientRect();
      const names = [...el.querySelectorAll('.cp-n')].map(n => n.textContent);
      const small = [...el.querySelectorAll('button, summary, a')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(b => b.height < 24 || b.width < 24).length;
      return { role: el.getAttribute('role'), inside: r.left >= 0 && r.right <= innerWidth + 0.5, hscroll: document.documentElement.scrollWidth > innerWidth + 1, names, small, re: !!el.querySelector('.cp-re') };
    });
    step(p.role !== 'dialog', `${tag}: el panel es un desplegable (role=${p.role}), no un diálogo sin modal`);
    step(p.inside && !p.hscroll, `${tag}: el panel cabe y la página no se desplaza a lo ancho`);
    step(!p.names.some(n => /Small-business|Bio-research/.test(n)) && p.names.includes('Gmail') && p.names.includes('Shopify'), `${tag}: cada conector con su nombre (Gmail, Shopify…)`);
    step(p.small === 0, `${tag}: todos los botones miden 24 px o más (${p.small} no)`);
    step(p.re, `${tag}: hay «Volver a comprobar»`);
    await page.screenshot({ path: path.join(OUT, `${tag}-panel.png`) });
    // Gmail: its tools, marked lee / envía
    const gmail = page.locator('#connPanel .cp-c', { hasText: 'Gmail' }).first(); await gmail.click();
    const d = await page.evaluate(() => { const det = document.querySelector('#connPanel .cp-item.open .cp-det'); return det ? { text: det.textContent, sends: det.querySelectorAll('.k-write').length, reads: det.querySelectorAll('.k-read').length } : null; });
    step(d && /Departamentos/.test(d.text) && d.sends > 0 && d.reads > 0, `${tag}: Gmail dice sus departamentos en palabras y qué herramientas envían (${d?.sends}) o leen (${d?.reads})`);
    await page.locator('#connPanel .cp-item.open .cp-det').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `${tag}-gmail.png`) });
    await gmail.click();
    // a failed one: its reason and how to fix it
    const gh = page.locator('#connPanel .cp-c', { hasText: 'Github' }).first(); await gh.scrollIntoViewIfNeeded(); await gh.click();
    const why = await page.evaluate(() => document.querySelector('#connPanel .cp-item.open .cp-det')?.textContent || '');
    step(/HTTP 400/.test(why) && /\/mcp/.test(why), `${tag}: uno que falla dice por qué (HTTP 400) y cómo arreglarlo (/mcp)`);
    await page.screenshot({ path: path.join(OUT, `${tag}-falla.png`) });
    await page.keyboard.press('Escape');
    step(!(await page.$('#connPanel')), `${tag}: Esc cierra el panel`);
    step(!errs.length, `${tag}: sin errores en la página${errs.length ? ': ' + errs[0] : ''}`);
    await ctx.close();
  }
} finally { await browser.close(); srv.kill(); }
console.log(fails ? `\n${fails} pasos fallaron` : '\nTodo bien. Capturas en ' + OUT);
if (fails) { console.log(log.slice(-1500)); process.exitCode = 1; }
