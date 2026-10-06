// Herramienta de desarrollo (no entra en `npm run check`): M5 de las redes en el navegador (6 oct 2026) — la cuadrícula del perfil
// (arrastrar y ‹ ›, con DESHACER), «Repetir…» en el panel, la selección múltiple de Programación y el informe del mes en Analíticas.
// Oficina temporal (cerebro copiado, datos aparte, sin keys), imágenes subidas al Estudio como haría el dueño.
//   node scripts/m5-recorrido.mjs   → capturas en data/capturas/m5/ y ✓/✗ por paso, a 1512 y 1024 (claro y oscuro) y 390
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'm5'); fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const pad = n => String(n).padStart(2, '0'), dia = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

async function oficina() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-m5-')), data = path.join(dir, 'data'), brain = path.join(dir, 'brain');
  fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
  const local = path.join(dir, 'local.json'); fs.writeFileSync(local, JSON.stringify({ contenido: { modo: 'simulacro' } }));
  const probe = http.createServer(); const port = await new Promise(r => probe.listen(0, '127.0.0.1', () => r(probe.address().port))); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: local, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_BASE_URL: '', ANTHROPIC_API_KEY: '', TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', METRICOOL_USER_ID: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
  const api = async (ruta, m = 'GET', b) => (await fetch(base + ruta, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json();
  const ids = [];
  for (const [i, color] of ['#C0392B', '#2E86C1', '#28B463', '#B7950B', '#7D3C98'].entries()) {
    const png = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: color } }).jpeg().toBuffer();
    const r = await api('/api/media/upload', 'POST', { name: `foto-${i}.jpg`, data: 'data:image/jpeg;base64,' + png.toString('base64') });
    ids.push(r.item.file);
  }
  const piezas = [];
  for (let i = 0; i < 5; i++) {
    const r = await api('/api/contenido/piezas', 'POST', { titulo: `Pieza ${i + 1}`, fecha: dia(Date.now() + (i + 1) * 86400e3), hora: '18:00', formato: 'post', redes: ['instagram'], medios: [ids[i]], texto: `Texto de la pieza ${i + 1}.`, estado: 'revision' });
    piezas.push(r.pieza.id);
  }
  return { base, api, piezas, cerrar: () => { srv.kill(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

let browser;
try {
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  for (const [w, h, tema] of [[1512, 900, 'light'], [1512, 900, 'dark'], [1024, 768, 'light'], [390, 844, 'light']]) {
    const tag = `${w}-${tema}`, o = await oficina();
    try {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500, colorScheme: tema });
      const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.goto(o.base + '/'); await page.waitForTimeout(1500);
      await page.evaluate(t => document.body.classList.toggle('dark', t === 'dark'), tema);
      await page.keyboard.press('k'); await page.waitForSelector('#ctOv .ct-mode', { state: 'visible' }); await page.waitForTimeout(600);
      // U2 · la cuadrícula del perfil
      if (w < 500) await page.selectOption('#ctOv .ct-vsel', 'perfil'); else await page.click('#ctOv .ct-views [data-v="perfil"]');
      await page.waitForTimeout(900);
      const orden = () => page.evaluate(() => [...document.querySelectorAll('#ctOv .pf-t')].map(t => t.dataset.pf));
      const o0 = await orden();
      step(o0.length === 5 && o0[0] === o.piezas[4], `${tag}: la cuadrícula tiene las 5, la más nueva arriba`);
      await page.screenshot({ path: path.join(OUT, `${tag}-perfil.png`) });
      if (w >= 1024) { await page.dragAndDrop(`#ctOv .pf-t[data-pf="${o0[0]}"]`, `#ctOv .pf-t[data-pf="${o0[2]}"]`); }
      else { await page.click(`#ctOv [data-pfm="${o0[0]}:${o0[1]}"]`); }
      await page.waitForTimeout(1200);
      const o1 = await orden();
      step(w >= 1024 ? o1[0] === o0[2] && o1[2] === o0[0] : o1[0] === o0[1] && o1[1] === o0[0], `${tag}: ${w >= 1024 ? 'arrastrar una sobre otra' : '‹ ›'} las cambia de sitio`);
      await page.click('#ctOv .cv-toast button'); await page.waitForTimeout(1200);
      step(JSON.stringify(await orden()) === JSON.stringify(o0), `${tag}: DESHACER las devuelve a su sitio`);
      // U7 · repetir
      await page.click(`#ctOv .pf-open[data-pfo="${o.piezas[0]}"]`); await page.waitForTimeout(800);
      await page.click('.ct-panel:not([hidden]) [data-a="rep"]'); await page.waitForTimeout(200);
      await page.selectOption('.ct-panel:not([hidden]) [data-rep="veces"]', '3');
      await page.click('.ct-panel:not([hidden]) [data-a="rep-ok"]'); await page.waitForTimeout(1200);
      const est = await page.evaluate(() => document.querySelector('.ct-panel:not([hidden]) .pz-state')?.textContent || '');
      step(/3 borradores creados \(cada semana\)/.test(est), `${tag}: «Repetir…» crea 3 borradores («${est}»)`);
      await page.screenshot({ path: path.join(OUT, `${tag}-repetir.png`) });
      await page.keyboard.press('Escape'); await page.waitForTimeout(800);
      // U7 · selección múltiple en Programación
      await page.click('#ctOv .ct-mode [data-m="prog"]'); await page.waitForTimeout(900);
      for (const id of o.piezas.slice(0, 2)) await page.check(`#ctOv [data-selp="${id}"]`);
      await page.waitForTimeout(300);
      step(await page.evaluate(() => /2 seleccionadas/.test(document.querySelector('.ct-selbar')?.textContent || '')), `${tag}: la barra dice «2 seleccionadas»`);
      await page.screenshot({ path: path.join(OUT, `${tag}-seleccion.png`) });
      await page.click('#ctOv [data-selacc="aprobar"]'); await page.waitForTimeout(1500);
      const ap = await o.api('/api/contenido?sin_fecha=1');
      step(o.piezas.slice(0, 2).every(id => ap.piezas.find(p => p.id === id)?.estado === 'aprobada'), `${tag}: «Aprobar las que pueden salir» aprueba las dos`);
      const m = await page.evaluate(() => ({ small: [...document.querySelectorAll('#ctOv .ct-selbar button, #ctOv .ct-ck, #ctOv .pf-mv button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(b => b.height < 24 || b.width < 24).length, hscroll: document.documentElement.scrollWidth > innerWidth + 1 }));
      step(!m.small && !m.hscroll, `${tag}: objetivos de 24 px y sin desplazamiento a lo ancho`);
      // U10 · el informe del mes en Analíticas
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      await page.evaluate(() => document.querySelector('#ctOv #ctClose')?.click()); await page.waitForTimeout(400);
      await page.keyboard.press('r'); await page.waitForSelector('#anOv #anInforme', { state: 'attached' }); await page.waitForTimeout(600);
      await page.evaluate(() => document.querySelector('#anOv #anInforme').click()); await page.waitForTimeout(1500);
      const inf = await page.evaluate(() => document.querySelector('#anOv .an-inf-t')?.textContent || '');
      step(/Informe de redes/.test(inf) && /Lo que salió/.test(inf), `${tag}: Analíticas enseña el informe del mes`);
      await page.click('#anOv [data-a="inf-guardar"]'); await page.waitForTimeout(1000);
      step(await page.evaluate(() => /informes\/\d{4}-\d{2} redes\.md/.test(document.querySelector('#anOv .an-inf')?.textContent || '')), `${tag}: «Guardar en el Cerebro» deja la nota`);
      await page.screenshot({ path: path.join(OUT, `${tag}-informe.png`) });
      step(!errs.length, `${tag}: sin errores de la página${errs.length ? ': ' + errs[0] : ''}`);
      await ctx.close();
    } finally { o.cerrar(); }
  }
} catch (e) { fails++; console.log('✗ ' + e.message); }
finally { await browser?.close(); }
console.log(fails ? `\n✗ ${fails} paso(s) fallaron · capturas en ${path.relative(ROOT, OUT)}` : `\n✓ todo bien · capturas en ${path.relative(ROOT, OUT)}`);
process.exit(fails ? 1 : 0);
