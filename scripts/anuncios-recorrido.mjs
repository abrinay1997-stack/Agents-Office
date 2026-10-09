// Herramienta de desarrollo (no entra en `npm run check`): la vista ANUNCIOS en el navegador (Fase A1, 9 oct 2026). Abre la demo
// (file://, datos de ejemplo rotulados) a 1512 en claro y oscuro, a 1024 con Dimitri al lado y a 390; recorre Resumen, Campañas (rango,
// filtros, desplegar, el detalle de un anuncio rechazado, Esc) e Historial; mide objetivos de 24 px, letra ≥ 10,5 px y que nada se salga
// a lo ancho; y comprueba que el dock cabe a 390, 360 y 320 px con el aviso «⚠ N» encendido (Anuncios va en el «⋯»).
// Si además hay una oficina que ya sirve /api/anuncios y /anuncios-vista.js (serve.mjs con la Fase A1), abre una temporal sin Meta:
// la tarjeta de conexión y «Ver con datos de ejemplo». Si no, lo dice y sigue con la demo.
//   node scripts/anuncios-recorrido.mjs   → capturas en data/capturas/anuncios/ y ✓/✗ por paso
//   AO_AXE=<ruta a axe.min.js> además pasa axe en cada pestaña
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'anuncios'); fs.mkdirSync(OUT, { recursive: true });
const PAGINA = 'file://' + path.join(ROOT, 'dist', 'command-centre-v2.html').replace(/\\/g, '/');
let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
if (!fs.existsSync(path.join(ROOT, 'dist', 'anuncios-vista.js'))) { console.log('✗ falta dist/anuncios-vista.js: node build.mjs'); process.exit(1); }

const medir = page => page.evaluate(() => {
  const ov = document.getElementById('anuOv');
  const vis = b => b.offsetParent && b.getClientRects().length;
  const peq = [...ov.querySelectorAll('button, select, input:not([type=hidden]), [role=tab]')].filter(vis).map(b => [b, b.getBoundingClientRect()]).filter(([, r]) => r.height < 23.5 || r.width < 23.5).map(([b, r]) => `${b.className || b.tagName}:${Math.round(r.width)}x${Math.round(r.height)}`);
  const hs = document.documentElement.scrollWidth > innerWidth + 1;
  const letra = [...ov.querySelectorAll('*')].filter(n => n.offsetParent && [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())).filter(n => parseFloat(getComputedStyle(n).fontSize) < 10.5).map(n => n.className || n.tagName);
  return { peq: peq.slice(0, 5), npeq: peq.length, hs, letra: letra.slice(0, 5), nletra: letra.length };
});
const ok24 = (m, tag, que) => step(!m.npeq && !m.hs && !m.nletra, `${tag}: ${que} — objetivos de 24 px, sin desplazamiento a lo ancho, letra ≥ 10,5${m.npeq ? ' · pequeños: ' + m.peq.join(' ') : ''}${m.hs ? ' · se sale' : ''}${m.nletra ? ' · letra: ' + m.letra.join(' ') : ''}`);

async function abrir(page) {
  const movil = await page.evaluate(() => innerWidth <= 440);
  if (movil) { await page.click('#topMore'); await page.click('#topMoreMenu [data-for="topAnuncios"]'); }
  else await page.click('#topAnuncios');
  await page.waitForSelector('#anuOv .anu-kpis, #anuOv .anu-conectar', { timeout: 15000 });
  await page.waitForTimeout(300);
}

let browser;
try {
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  const axe = process.env.AO_AXE && fs.existsSync(process.env.AO_AXE) ? fs.readFileSync(process.env.AO_AXE, 'utf8') : null;
  if (process.env.AO_AXE && !axe) console.log(`· AO_AXE=${process.env.AO_AXE} no existe: sin axe`);
  for (const [w, h, tema] of [[1512, 900, 'light'], [1512, 900, 'dark'], [1024, 768, 'light'], [390, 844, 'light']]) {
    if (process.env.AO_SOLO && process.env.AO_SOLO !== `${w}-${tema}`) continue;
    const tag = `${w}-${tema}`, movil = w < 500; let pagina = null; const errs = [];
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: movil, isMobile: movil, colorScheme: tema });
    try {
      const page = await ctx.newPage(); pagina = page; page.on('pageerror', e => errs.push(e.message));
      await page.addInitScript(() => { try { localStorage.removeItem('ao.anu.tab'); localStorage.removeItem('ao.anu.filtro'); } catch {} });
      await page.goto(PAGINA + '?s=check', { timeout: 90000 }); await page.waitForTimeout(2500);
      if (tema === 'dark') await page.evaluate(() => document.body.classList.add('dark'));
      await abrir(page);
      step(await page.$eval('#anuOv', o => o.classList.contains('on')) && await page.evaluate(() => document.body.classList.contains('anuOpen')), `${tag}: Anuncios se abre como vista`);
      step(await page.$eval('#anuOv .anu-ejemplo', e => !e.hidden && /EJEMPLO/.test(e.textContent)), `${tag}: la demo va rotulada «EJEMPLO»`);
      step(await page.$eval(`#topAnuncios`, b => b.getAttribute('aria-pressed')) === 'true' || movil, `${tag}: el botón del dock queda pulsado`);
      const kpis = await page.$$eval('#anuOv .anu-kpi', l => l.length), avisos = await page.$$eval('#anuOv .anu-avisos li', l => l.length), tarj = await page.$$eval('#anuOv .anu-tarj', l => l.length);
      step(kpis === 4 && avisos >= 2 && tarj === 2, `${tag}: Resumen — 4 cifras, ${avisos} avisos y ${tarj} campañas activas`);
      step(/US\$/.test(await page.textContent('#anuOv .anu-kpis')), `${tag}: el dinero lleva su moneda`);
      ok24(await medir(page), tag, 'Resumen');
      await page.screenshot({ path: path.join(OUT, `${tag}-resumen.png`) });
      if (axe) { await page.addScriptTag({ content: axe }); }
      const pasaAxe = async que => { if (!axe) return; const r = await page.evaluate(async () => (await window.axe.run('#anuOv', { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(v => `${v.id}(${v.nodes.length}) ${v.nodes[0]?.target?.join(' ') || ''}`)); step(!r.length, `${tag}: axe en ${que}${r.length ? ': ' + r.join(' ') : ''}`); };
      await pasaAxe('Resumen');
      // Campañas: una tarjeta del Resumen abre su campaña
      await page.click('#anuOv [data-abrircamp="ej-c-1"]'); await page.waitForSelector('#anuOv .anu-det:not([hidden]) .anu-dh', { timeout: 5000 });
      step(await page.$eval('#anuTab-campanas', b => b.getAttribute('aria-selected')) === 'true', `${tag}: el nombre de una tarjeta lleva a Campañas con su detalle`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      step(await page.$eval('#anuOv .anu-det', d => d.hidden) && await page.$eval('#anuOv', o => o.classList.contains('on')), `${tag}: Esc cierra el detalle y deja Anuncios abierta`);
      // desplegar campaña → conjunto → anuncio
      if (!await page.$('#anuOv [data-fila="ej-as-1"]')) await page.click('#anuOv [data-tog="ej-c-1"]');
      await page.click('#anuOv [data-tog="ej-as-1"]'); await page.waitForTimeout(200);
      const filas = await page.$$eval('#anuOv .anu-fila', l => l.map(f => f.dataset.fila));
      step(filas.includes('ej-as-1') && filas.includes('ej-ad-12'), `${tag}: la tabla se despliega campaña → conjunto → anuncio (${filas.length} filas)`);
      await page.click('#anuOv [data-abrir="ej-ad-12"]'); await page.waitForSelector('#anuOv .anu-det:not([hidden]) .anu-crea', { timeout: 5000 });
      const det = await page.textContent('#anuOv .anu-det');
      step(/Rechazado/.test(det) && /condición personal/.test(det) && await page.$('#anuOv .anu-det img'), `${tag}: el detalle del anuncio rechazado: miniatura, texto y lo que dijo la revisión`);
      ok24(await medir(page), tag, 'Campañas con el detalle');
      await page.screenshot({ path: path.join(OUT, `${tag}-detalle.png`) });
      await pasaAxe('el detalle');
      await page.click('#anuOv [data-cerrardet]'); await page.waitForTimeout(200);
      step(await page.evaluate(() => document.activeElement?.dataset?.abrir) === 'ej-ad-12', `${tag}: al cerrar el detalle, el foco vuelve al nombre que lo abrió`);
      // rango y filtros
      const gasto7 = await page.$eval('#anuOv [data-fila="ej-c-1"] td[data-l="Gasto"]', t => t.textContent);
      await page.click('#anuOv [data-rango="30d"]'); await page.waitForTimeout(400);
      const gasto30 = await page.$eval('#anuOv [data-fila="ej-c-1"] td[data-l="Gasto"]', t => t.textContent);
      step(gasto7 !== gasto30 && /US\$/.test(gasto30), `${tag}: el rango cambia las cifras (${gasto7.trim()} → ${gasto30.trim()})`);
      await page.click('#anuOv [data-filtro="pausa"]'); await page.waitForTimeout(200);
      const enPausa = await page.$$eval('#anuOv .anu-fila.n-campana', l => l.map(f => f.dataset.fila));
      step(enPausa.length === 1 && enPausa[0] === 'ej-c-3' && /En pausa/.test(await page.textContent('#anuOv [data-fila="ej-c-3"]')) && /creado fuera/.test(await page.textContent('#anuOv [data-fila="ej-c-3"]')), `${tag}: «En pausa» deja la campaña en pausa, escrito y con «creado fuera»`);
      await page.click('#anuOv [data-filtro="problemas"]'); await page.waitForTimeout(200);
      step((await page.$$eval('#anuOv .anu-fila.n-campana', l => l.length)) === 2, `${tag}: «Con problemas» deja las dos con un anuncio rechazado o con problemas`);
      await page.click('#anuOv [data-filtro="todas"]'); await page.click('#anuOv [data-rango="7d"]'); await page.waitForTimeout(300);
      ok24(await medir(page), tag, 'Campañas');
      if (movil) step(await page.$eval('#anuOv .anu-tabla thead', t => getComputedStyle(t).display === 'none'), `${tag}: en el teléfono la tabla se lee como tarjetas`);
      await page.screenshot({ path: path.join(OUT, `${tag}-campanas.png`) });
      await pasaAxe('Campañas');
      // Historial
      await page.click('#anuOv [data-tab="historial"]'); await page.waitForTimeout(300);
      step(/Todavía no hay cambios/.test(await page.textContent('#anuOv .anu-main')), `${tag}: el Historial vacío dice qué aparecerá`);
      await page.screenshot({ path: path.join(OUT, `${tag}-historial.png`) });
      await pasaAxe('Historial');
      // las pestañas con las flechas
      await page.focus('#anuTab-historial'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
      step(await page.evaluate(() => document.activeElement?.id) === 'anuTab-resumen', `${tag}: ← → recorren las pestañas`);
      // con Dimitri al lado
      if (w === 1024) {
        await page.click('#topDimitri'); await page.waitForTimeout(900);
        const l = await page.evaluate(() => { const r = document.getElementById('anuOv').getBoundingClientRect(); return { left: r.left, w: r.width }; });
        step(l.left > 300, `${tag}: con Dimitri abierto, la vista se corre (empieza en ${Math.round(l.left)} px, mide ${Math.round(l.w)})`);
        await page.click('#anuOv [data-tab="campanas"]'); await page.waitForTimeout(300);
        if (!await page.$('#anuOv [data-abrir="ej-ad-12"]')) { if (!await page.$('#anuOv [data-fila="ej-as-1"]')) await page.click('#anuOv [data-tog="ej-c-1"]'); await page.click('#anuOv [data-tog="ej-as-1"]'); }
        await page.click('#anuOv [data-abrir="ej-ad-12"]'); await page.waitForTimeout(300); await page.click('#topDimitri'); await page.waitForTimeout(400); await page.click('#topDimitri'); await page.waitForTimeout(900); // Dimitri lee «Viendo» al abrirse
        const viendo = await page.$eval('.sb-ctxl b', b => b.textContent).catch(() => '');
        step(/Anuncio «Combo lentes · antes y después»/.test(viendo), `${tag}: el chip «Viendo» de Dimitri dice lo abierto («${viendo}»)`);
        ok24(await medir(page), tag, 'Campañas con Dimitri al lado');
        await page.screenshot({ path: path.join(OUT, `${tag}-dimitri.png`) });
        await page.click('#topDimitri'); await page.waitForTimeout(400);
      }
      // la tecla J abre y cierra
      await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('j'); await page.waitForTimeout(400);
      step(!(await page.$eval('#anuOv', o => o.classList.contains('on'))), `${tag}: J cierra Anuncios`);
      await page.keyboard.press('j'); await page.waitForTimeout(500);
      step(await page.$eval('#anuOv', o => o.classList.contains('on')), `${tag}: J la vuelve a abrir`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      step(!(await page.$eval('#anuOv', o => o.classList.contains('on'))), `${tag}: Esc cierra Anuncios`);
      if (movil) { // el dock cabe con el aviso «⚠ N» encendido
        await page.evaluate(() => { const a = document.getElementById('topAppr'); a.style.display = ''; a.querySelector('span').textContent = '12'; });
        for (const ww of [390, 360, 320]) {
          await page.setViewportSize({ width: ww, height: 800 }); await page.waitForTimeout(250);
          const m = await page.evaluate(() => ({ over: [...document.querySelectorAll('#topdock button')].filter(b => b.getBoundingClientRect().width > 0).some(b => b.getBoundingClientRect().right > innerWidth - 4), visible: document.getElementById('topAnuncios').getBoundingClientRect().width > 0 }));
          step(!m.over && !m.visible, `${ww} px con «⚠ 12»: el dock cabe y Anuncios va en el «⋯»`);
        }
      }
      step(!errs.length, `${tag}: sin errores de la página${errs.length ? ': ' + errs[0] : ''}`);
    } catch (e) {
      fails++; console.log(`✗ ${tag}: ${e.message.split('\n')[0]}${errs.length ? ' · página: ' + errs[0] : ''}`);
      await pagina?.screenshot({ path: path.join(OUT, `${tag}-fallo.png`) }).catch(() => {});
    } finally { await ctx.close(); }
  }

  // servida, sin Meta: la tarjeta de conexión y «Ver con datos de ejemplo» (solo si serve.mjs ya sirve la Fase A1)
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-anuncios-ui-')), data = path.join(dir, 'data'), brain = path.join(dir, 'brain');
    fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
    const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
    const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_API_KEY: '', TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', FAL_KEY: '' };
    const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'ignore'] }), base = `http://127.0.0.1:${port}`;
    try {
      let arriba = false; for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) { arriba = true; break; } } catch {} await espera(250); }
      const a = arriba ? await fetch(base + '/api/anuncios?rango=7d').catch(() => null) : null, v = arriba ? await fetch(base + '/anuncios-vista.js').catch(() => null) : null;
      if (!a?.ok || !v?.ok) console.log(`· la oficina todavía no sirve la Fase A1 (/api/anuncios ${a?.status ?? '—'} · /anuncios-vista.js ${v?.status ?? '—'}): solo la demo`);
      else {
        const j = await a.json();
        const ctx = await browser.newContext({ viewport: { width: 1512, height: 900 } }), page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.goto(base + '/'); await page.waitForTimeout(2500); await abrir(page);
        if (!j.configurado) {
          step(!!await page.$('#anuOv .anu-conectar') && (!j.motivo || (await page.textContent('#anuOv .anu-conectar')).includes(j.motivo)), `servida sin Meta: la tarjeta de conexión dice el motivo («${j.motivo || '—'}»)`);
          await page.screenshot({ path: path.join(OUT, 'servida-conectar.png') });
          await page.click('#anuOv [data-a="ejemplo"]'); await page.waitForSelector('#anuOv .anu-kpis', { timeout: 5000 });
          step(await page.$eval('#anuOv .anu-ejemplo', e => !e.hidden) && !!await page.$('#anuOv [data-a="salir"]'), 'servida: «Ver con datos de ejemplo» rotula el ejemplo y deja salir');
          await page.click('#anuOv [data-a="salir"]'); await page.waitForSelector('#anuOv .anu-conectar', { timeout: 5000 });
          step(true, 'servida: «Salir del ejemplo» vuelve a la tarjeta de conexión');
        } else step(!!await page.$('#anuOv .anu-kpis'), 'servida: con Meta configurada se ve el Resumen');
        step(!errs.length, `servida: sin errores${errs.length ? ': ' + errs[0] : ''}`);
        await ctx.close();
      }
    } finally { srv.kill(); await espera(300); fs.rmSync(dir, { recursive: true, force: true }); }
  }
} catch (e) { fails++; console.log('✗ ' + e.message); }
finally { await browser?.close(); }
console.log(fails ? `\n✗ ${fails} paso(s) fallaron · capturas en ${path.relative(ROOT, OUT)}` : `\n✓ todo bien · capturas en ${path.relative(ROOT, OUT)}`);
process.exit(fails ? 1 : 0);
