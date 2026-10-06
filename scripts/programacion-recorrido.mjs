// Herramienta de desarrollo (no entra en `npm run check`): Contenido → PROGRAMACIÓN en el navegador con la cola de verdad (plan M1,
// 6 oct 2026). Oficina temporal (cerebro copiado, datos aparte, sin keys), modo simulacro: dos piezas aprobadas — una dentro de las
// próximas horas (se entrega al simulacro tras el minuto de gracia) y otra a tres días (EN COLA). Después, modo real sin key de
// Metricool: el aviso dice qué falta. Nunca toca Metricool ni Meta.
//   node scripts/programacion-recorrido.mjs   → capturas en data/capturas/programacion/ y ✓/✗ por paso, a 390, 1024 y 1512 en claro y oscuro
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'programacion'); fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-programacion-')), data = path.join(dir, 'data'), brain = path.join(dir, 'brain');
fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
const local = path.join(dir, 'local.json'); fs.writeFileSync(local, JSON.stringify({ contenido: { modo: 'simulacro' } }));
const probe = http.createServer(); const port = await new Promise(r => probe.listen(0, '127.0.0.1', () => r(probe.address().port))); await new Promise(r => probe.close(r));
const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: local, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_BASE_URL: '', ANTHROPIC_API_KEY: '', TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', METRICOOL_USER_ID: '', METRICOOL_BLOG_ID: '' };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
const api = async (ruta, metodo = 'GET', b) => (await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json();

let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const dia = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hora = ms => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
async function pieza(titulo, ms) {
  const c = await api('/api/contenido/piezas', 'POST', { titulo, fecha: dia(ms), hora: hora(ms), formato: 'post', redes: ['facebook'], texto: `${titulo}: llega esta semana a la tienda.` });
  if (!c.pieza) throw new Error('crear: ' + JSON.stringify(c));
  const a = await api(`/api/contenido/piezas/${c.pieza.id}/aprobar`, 'POST', {});
  step(a.ok, `«${titulo}» se aprueba${a.ok ? '' : ': ' + JSON.stringify(a.errores || a.error)}`); return c.pieza.id;
}

let browser;
try {
  const pronto = Date.now() + 2 * 3600e3, lejos = Date.now() + 3 * 86400e3;
  await pieza('Combo de lentes', pronto); await pieza('Kit de limpieza', lejos);
  console.log('… un minuto de gracia antes de entregar'); await new Promise(r => setTimeout(r, 62e3));
  await api('/api/contenido/cola/tick', 'POST', {});
  const cola = await api('/api/contenido/cola');
  step(cola.modo === 'simulacro' && cola.conductor?.id === 'simulacro', `la cola está en simulacro (${cola.modo} · ${cola.conductor?.nombre})`);
  const est = Object.values(cola.entradas || {}).map(e => e.estado).sort().join(',');
  step(est === 'en_red,espera', `una entregada al simulacro y otra en cola (${est})`);
  const st = await api('/api/status'), fila = st.checks.find(c => c.id === 'publicacion');
  step(fila && fila.state === 'info' && /Simulacro/.test(fila.text || fila.detail || ''), `Salud tiene la fila «Publicación» (${fila?.state}: ${fila?.text || fila?.detail})`);

  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  const mirar = async (tag, w, h, tema, esperado) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500, colorScheme: tema });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(base + '/'); await page.waitForTimeout(1500);
    await page.evaluate(t => { document.body.classList.toggle('dark', t === 'dark'); }, tema);
    await page.keyboard.press('k'); await page.waitForSelector('#ctOv .ct-mode [data-m="prog"]', { state: 'visible' });
    await page.click('#ctOv .ct-mode [data-m="prog"]'); await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const ban = document.querySelector('.ct-banner')?.textContent || '';
      const chips = [...document.querySelectorAll('.ct-row .ct-salbox, .ct-row')].map(x => x.textContent).join(' | ');
      const small = [...document.querySelectorAll('#ctOv .ct-prog button, #ctOv .ct-prog a')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(b => b.height < 24 || b.width < 24).length;
      const tiny = [...document.querySelectorAll('#ctOv .ct-prog *')].filter(e => e.offsetParent && e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 10.5).length;
      return { ban, chips, small, tiny, hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    step(esperado.test(r.ban), `${tag}: el aviso dice «${r.ban.trim().slice(0, 90)}»`);
    if (tag.startsWith('sim')) step(/EN SIMULACRO/.test(r.chips) && /EN COLA/.test(r.chips), `${tag}: las filas dicen EN SIMULACRO y EN COLA`);
    step(r.small === 0, `${tag}: los botones miden 24 px o más (${r.small} no)`);
    step(r.tiny === 0, `${tag}: ningún texto baja de 10,5 px (${r.tiny})`);
    step(!r.hscroll, `${tag}: la página no se desplaza a lo ancho`);
    step(!errs.length, `${tag}: sin errores de la página${errs.length ? ': ' + errs[0] : ''}`);
    await page.screenshot({ path: path.join(OUT, `${tag}.png`) });
    if (tag.startsWith('sim') && w === 1512) {
      await page.locator('.ct-row', { hasText: 'Combo de lentes' }).first().locator('button').first().click(); await page.waitForTimeout(700);
      const pie = await page.evaluate(() => document.querySelector('.ct-panel:not([hidden]) .pz-foot')?.textContent || '');
      step(/simulacro/i.test(pie) && /retirarla/i.test(pie), `${tag}: el pie de la pieza dice cómo va y ofrece retirarla («${pie.trim().slice(0, 80)}»)`);
      await page.screenshot({ path: path.join(OUT, `${tag}-pieza.png`) });
    }
    await ctx.close();
  };
  for (const [w, h] of [[1512, 900], [1024, 768], [390, 844]]) for (const tema of ['light', 'dark']) await mirar(`sim-${w}-${tema}`, w, h, tema, /Simulacro/i);

  await api('/api/settings', 'POST', { changes: { 'contenido.modo': 'real', 'contenido.conductor': 'metricool' } });
  const st2 = await api('/api/status'), f2 = st2.checks.find(c => c.id === 'publicacion');
  step(f2?.state === 'bad', `modo real sin key: Salud en rojo (${f2?.state})`);
  for (const [w, h] of [[1512, 900], [390, 844]]) await mirar(`real-${w}-light`, w, h, 'light', /METRICOOL_USER_TOKEN|Metricool/);
} catch (e) { fails++; console.log('✗ ' + e.message); console.log(log.split('\n').slice(-15).join('\n')); }
finally { await browser?.close(); srv.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
console.log(fails ? `\n✗ ${fails} paso(s) fallaron · capturas en ${path.relative(ROOT, OUT)}` : `\n✓ todo bien · capturas en ${path.relative(ROOT, OUT)}`);
process.exit(fails ? 1 : 0);
