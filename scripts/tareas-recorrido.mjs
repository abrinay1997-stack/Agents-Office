// Herramienta de desarrollo (no entra en `npm run check`): la vista TAREAS en el navegador (plan T2, 6 oct 2026). Oficina temporal
// (cerebro copiado, datos aparte, sin keys) y Claude de mentira (un doble local de la API de Mensajes): las tareas se enrutan y se
// hacen solas. Recorre Inicio, añadir rápido, Lista con filtros en la dirección, el detalle que se guarda solo, Tablero (arrastrar
// con DESHACER), Proyectos (con el mapa) y Medidas; mide objetivos de 24 px y que nada se salga a lo ancho; con Dimitri abierto.
//   node scripts/tareas-recorrido.mjs   → capturas en data/capturas/tareas/ y ✓/✗ por paso, a 1512 (claro y oscuro), 1024 y 390
//   AO_AXE=<ruta a axe.min.js> además pasa axe en cada pestaña
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'tareas'); fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));

async function oficina() {
  const claude = http.createServer((rq, rs) => { let b = ''; rq.on('data', d => { b += d; }); rq.on('end', async () => {
    const body = JSON.parse(b || '{}'); const sys = typeof body.system === 'string' ? body.system : JSON.stringify(body.system || '');
    const router = /You are the router for/.test(sys); if (!router) await espera(150000); // los agentes tardan: así hay algo en curso, bloqueado y en cola
    const text = router ? JSON.stringify({ agent: '', title: '', plan: ['Leer lo que hay', 'Hacer el borrador', 'Revisarlo'], eta_minutes: 20, why: 'prueba', needs_ok: false }) : 'ENTREGA LISTA\nFuentes: —';
    rs.writeHead(200, { 'content-type': 'application/json' }); rs.end(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 5, output_tokens: 5 } }));
  }); });
  const cport = await listen(claude);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-tareas-ui-')), data = path.join(dir, 'data'), brain = path.join(dir, 'brain');
  fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, ANTHROPIC_API_KEY: 'test-key-not-real', // secrets-ok
    TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', METRICOOL_USER_ID: '', GEMINI_API_KEY: '', HF_KEY: '', FAL_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await espera(250); }
  const api = async (ruta, m = 'GET', b) => (await fetch(base + ruta, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json();
  // una semana de trabajo: un proyecto, etiquetas, una bloqueada, una idea, una para hoy
  const pr = (await api('/api/tareas/proyectos', 'POST', { nombre: 'Lanzamiento lentes', limite: new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10), color: 'azul' })).proyecto;
  const et = (await api('/api/tareas/etiquetas', 'POST', { nombre: 'lanzamiento' })).etiqueta;
  const hoy = new Date(); const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const a = await api('/api/tasks', 'POST', { dept: 'marketing', text: 'Fotos de producto de los lentes', prioridad: 'alta', limite: ymd(hoy), proyecto: pr.id, etiquetas: [et.id] });
  await api('/api/tasks', 'POST', { dept: 'marketing', text: 'Post de lanzamiento', proyecto: pr.id, bloqueadaPor: [a.id] });
  await api('/api/tasks', 'POST', { dept: 'sales', text: 'Llamar a las ópticas del año pasado', idea: true });
  await api('/api/tasks', 'POST', { dept: 'fin', text: 'Revisar las facturas de septiembre', limite: ymd(new Date(Date.now() + 2 * 864e5)) });
  return { base, api, cerrar: () => { srv.kill(); claude.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

const medir = page => page.evaluate(() => {
  const ov = document.getElementById('tvOv');
  const peq = [...ov.querySelectorAll('button, select, input:not([type=hidden]), summary, [role=tab]')].filter(b => b.offsetParent && b.getClientRects().length).map(b => [b, (b.type === 'checkbox' && b.closest('label')) ? b.closest('label').getBoundingClientRect() : b.getBoundingClientRect()]).filter(([, r]) => r.height < 24 - 0.5 || r.width < 24 - 0.5).map(([b, r]) => `${b.className || b.tagName}:${Math.round(r.width)}x${Math.round(r.height)}`);
  const hs = document.documentElement.scrollWidth > innerWidth + 1;
  const letra = [...ov.querySelectorAll('*')].filter(n => n.childNodes.length && [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()) && n.offsetParent).map(n => parseFloat(getComputedStyle(n).fontSize)).filter(f => f < 10.5).length;
  return { peq: peq.slice(0, 5), npeq: peq.length, hs, letra };
});

let browser;
try {
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  const axe = process.env.AO_AXE && fs.existsSync(process.env.AO_AXE) ? fs.readFileSync(process.env.AO_AXE, 'utf8') : null;
  for (const [w, h, tema] of [[1512, 900, 'light'], [1512, 900, 'dark'], [1024, 768, 'light'], [390, 844, 'light']]) {
    const tag = `${w}-${tema}`, o = await oficina(), movil = w < 500;
    try {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: movil, isMobile: movil, colorScheme: tema });
      const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.goto(o.base + '/'); await page.waitForTimeout(1500);
      await page.evaluate(t => { if (t === 'dark') document.body.classList.add('dark'); }, tema);
      await page.keyboard.press('h'); await page.waitForSelector('#tvOv .tv-sec', { timeout: 15000 });
      await page.waitForTimeout(500);
      const secs = await page.$$eval('#tvOv .tv-sec', l => l.map(s => s.dataset.sec));
      step(secs.includes('hoy') && secs.includes('bloqueadas') && secs.includes('ideas'), `${tag}: Inicio tiene Hoy, Bloqueadas e Ideas (${secs.join(', ')})`);
      step(/tareas=inicio/.test(await page.evaluate(() => location.hash)), `${tag}: la dirección dice dónde estás`);
      let m = await medir(page); step(!m.npeq && !m.hs && !m.letra, `${tag}: Inicio — objetivos de 24 px, sin desplazamiento a lo ancho, letra ≥ 10,5 (${m.npeq ? m.peq.join(' ') : ''}${m.hs ? ' · se sale' : ''}${m.letra ? ` · ${m.letra} textos pequeños` : ''})`);
      await page.screenshot({ path: path.join(OUT, `${tag}-inicio.png`) });
      // añadir rápido
      await page.selectOption('#tvOv [data-rdept]', 'ops');
      await page.fill('#tvOv [data-rin]', 'urgente: inventario de monturas para el viernes #inventario');
      await page.waitForTimeout(200);
      step(/prioridad alta · fecha límite \d{4}-\d{2}-\d{2} · #inventario/.test(await page.textContent('#tvOv .tv-rhint')), `${tag}: añadir rápido entiende prioridad, fecha límite y etiqueta`);
      await page.press('#tvOv [data-rin]', 'Enter'); await page.waitForTimeout(2500);
      const nueva = (await o.api('/api/tasks')).find(t => /inventario de monturas/i.test(t.text));
      step(nueva?.prioridad === 'alta' && nueva?.limite && nueva?.etiquetas?.length === 1, `${tag}: la tarea nace con prioridad, fecha límite y una etiqueta creada al vuelo`);
      // Lista con filtro en la dirección
      await page.click('#tvOv [data-tab="lista"]'); await page.waitForTimeout(400);
      await page.selectOption('#tvOv [data-f="prio"]', 'alta'); await page.waitForTimeout(400);
      const filas = await page.$$eval('#tvOv .tv-lista .tv-fila', l => l.length);
      step(filas >= 1 && /prio=alta/.test(await page.evaluate(() => location.hash)) && await page.$('#tvOv .tv-fchip[data-quitar="prio"]'), `${tag}: el filtro es un chip y vive en la dirección (${filas} filas)`);
      m = await medir(page); step(!m.npeq && !m.hs, `${tag}: Lista — 24 px y sin desplazamiento a lo ancho (${m.peq.join(' ')})`);
      await page.screenshot({ path: path.join(OUT, `${tag}-lista.png`) });
      await page.click('#tvOv .tv-fchip[data-quitar="prio"]'); await page.waitForTimeout(300);
      // varias a la vez, con DESHACER
      for (const i of [0, 1]) await page.locator('#tvOv .tv-lista .tv-ck').nth(i).check(); await page.waitForTimeout(200);
      step(/2 elegidas/.test(await page.textContent('#tvOv .tv-selbar')), `${tag}: la barra dice «2 elegidas»`);
      const ids2 = await page.$$eval('#tvOv .tv-lista .tv-ck:checked', l => l.map(x => x.dataset.sel));
      await page.selectOption('#tvOv .tv-selbar [data-lote="prioridad"]', 'baja'); await page.waitForTimeout(1500);
      const bajas = (await o.api('/api/tasks')).filter(t => ids2.includes(t.id) && t.prioridad === 'baja').length;
      await page.click('#tvOv .tv-toast [data-deshacer]'); await page.waitForTimeout(1500);
      const vuelven = (await o.api('/api/tasks')).filter(t => ids2.includes(t.id) && t.prioridad === 'baja').length;
      step(bajas === 2 && vuelven < 2, `${tag}: prioridad a varias a la vez y DESHACER las devuelve`);
      await page.click('#tvOv .tv-selbar [data-lotebtn="ninguna"]'); await page.waitForTimeout(200);
      // el detalle: se guarda solo
      await page.click(`#tvOv [data-abrir="${nueva.id}"]`); await page.waitForSelector('#tvOv .tv-dh', { timeout: 8000 });
      await page.click('#tvOv .tv-seg [data-prio="baja"]'); await page.waitForTimeout(1200);
      await page.fill('#tvOv [data-addpaso]', 'Contar las monturas de la vitrina'); await page.press('#tvOv [data-addpaso]', 'Enter'); await page.waitForTimeout(1500);
      const tras = (await o.api('/api/tasks')).find(t => t.id === nueva.id);
      step(tras.prioridad === 'baja' && tras.pasos?.some(p => /vitrina/.test(p.texto)), `${tag}: el detalle se guarda solo (prioridad y un paso nuevo, sin botón Guardar)`);
      step(/[?&#]t=/.test(await page.evaluate(() => location.hash)), `${tag}: la tarea abierta va en la dirección`);
      await page.screenshot({ path: path.join(OUT, `${tag}-detalle.png`) });
      m = await medir(page); step(!m.npeq && !m.hs, `${tag}: detalle — 24 px y sin desplazamiento a lo ancho (${m.peq.join(' ')})`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      step(await page.$eval('#tvOv .tv-det', d => d.hidden) && await page.$eval('#tvOv', o => o.classList.contains('on')), `${tag}: Esc cierra el detalle y deja Tareas abierta`);
      // Tablero
      await page.click('#tvOv [data-tab="tablero"]'); await page.waitForTimeout(500);
      const idea = (await o.api('/api/tasks')).find(t => t.state === 'idea');
      if (!movil) {
        try { await page.dragAndDrop(`#tvOv .tv-fila[data-t="${idea.id}"]`, '#tvOv .tv-drop[data-col="cola"]', { timeout: 6000 }); }
        catch { await page.evaluate(id => { const f = document.querySelector(`#tvOv .tv-fila[data-t="${id}"]`), z = document.querySelector('#tvOv .tv-drop[data-col="cola"]'), dt = new DataTransfer(), r = z.getBoundingClientRect(), o = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 10, clientY: r.top + 10 };
          f.dispatchEvent(new DragEvent('dragstart', o)); z.dispatchEvent(new DragEvent('dragover', o)); z.dispatchEvent(new DragEvent('drop', o)); f.dispatchEvent(new DragEvent('dragend', o)); }, idea.id); } // el ratón simulado no siempre acierta con el tablero desplazable: los mismos eventos, a mano
        await page.waitForTimeout(1500);
        step((await o.api('/api/tasks')).find(t => t.id === idea.id)?.state !== 'idea', `${tag}: arrastrar una idea a «En cola» la pide`);
        await page.click('#tvOv .tv-toast [data-deshacer]'); await page.waitForTimeout(1500);
        const tras2 = (await o.api('/api/tasks')).find(t => t.id === idea.id), msg = await page.textContent('#tvOv .tv-toast span');
        step(tras2?.state === 'idea' || (tras2?.state === 'doing' && /Ya la empezó el agente/.test(msg)), `${tag}: DESHACER la devuelve a ideas (o, si el agente ya la empezó, lo dice claro: «${msg}»)`);
      } else {
        step(await page.$eval('#tvOv .tv-coltabs', e => getComputedStyle(e).display !== 'none'), `${tag}: en el teléfono, una columna a la vez con pestañas`);
      }
      m = await medir(page); step(!m.hs, `${tag}: Tablero sin desplazamiento de la página a lo ancho`);
      await page.screenshot({ path: path.join(OUT, `${tag}-tablero.png`) });
      // Proyectos y su mapa
      await page.click('#tvOv [data-tab="proyectos"]'); await page.waitForTimeout(500);
      await page.click('#tvOv [data-abrirp]'); await page.waitForTimeout(400);
      await page.click('#tvOv [data-pmodo="mapa"]'); await page.waitForTimeout(400);
      const nodos = await page.$$eval('#tvOv .tv-nodo', l => l.length);
      step(nodos >= 2 && await page.$('#tvOv .tv-mapai path'), `${tag}: el mapa del proyecto dibuja ${nodos} tareas y quién espera a quién`);
      await page.screenshot({ path: path.join(OUT, `${tag}-mapa.png`) });
      // Medidas
      await page.click('#tvOv [data-tab="medidas"]'); await page.waitForSelector('#tvOv .tv-kpi', { timeout: 8000 });
      const kb = await page.$('#tvOv .tv-kpi:not([disabled])');
      if (kb) { await kb.click(); await page.waitForTimeout(300); }
      step(!!kb && await page.$$eval('#tvOv .tv-kpid .tv-fila', l => l.length) >= 1, `${tag}: Medidas — una cifra abre sus tareas`);
      await page.screenshot({ path: path.join(OUT, `${tag}-medidas.png`) });
      if (axe) { await page.addScriptTag({ content: axe }); for (const tab of ['inicio', 'lista', 'tablero', 'medidas']) { await page.click(`#tvOv [data-tab="${tab}"]`); await page.waitForTimeout(400); const r = await page.evaluate(async () => (await window.axe.run('#tvOv', { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(v => `${v.id}(${v.nodes.length})`)); step(!r.length, `${tag}: axe en ${tab}${r.length ? ': ' + r.join(' ') : ''}`); } }
      // con Dimitri al lado (no en el teléfono)
      if (w === 1024) { await page.click('#tvOv [data-tab="inicio"]'); await page.keyboard.press('s'); await page.waitForTimeout(900); m = await medir(page); step(!m.hs && !m.npeq, `${tag}: con Dimitri al lado cabe (${m.peq.join(' ')})`); await page.screenshot({ path: path.join(OUT, `${tag}-dimitri.png`) }); await page.keyboard.press('s'); await page.waitForTimeout(400); }
      await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      if (await page.$eval('#tvOv', o => o.classList.contains('on'))) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); } // la cifra abierta va primero
      step(!(await page.$eval('#tvOv', o => o.classList.contains('on'))), `${tag}: Esc cierra Tareas`);
      step(!errs.length, `${tag}: sin errores de la página${errs.length ? ': ' + errs[0] : ''}`);
      await ctx.close();
    } finally { o.cerrar(); }
  }
  // la demo (file://): sin oficina, con datos de ejemplo rotulados
  { const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + path.join(ROOT, 'dist', 'command-centre-v2.html') + '#tareas=inicio'); await page.waitForSelector('#tvOv .tv-sec', { timeout: 15000 });
    step(await page.$eval('#tvOv .tv-demo', e => !e.hidden), 'demo: Tareas abre con datos de ejemplo, rotulados');
    await page.click('#tvOv [data-tab="proyectos"]'); await page.waitForTimeout(300); step(await page.$$eval('#tvOv .tv-pcard', l => l.length) === 2, 'demo: dos proyectos de ejemplo');
    step(!errs.length, `demo: sin errores${errs.length ? ': ' + errs[0] : ''}`); await page.screenshot({ path: path.join(OUT, 'demo.png') }); await ctx.close(); }
} catch (e) { fails++; console.log('✗ ' + e.message); }
finally { await browser?.close(); }
console.log(fails ? `\n✗ ${fails} paso(s) fallaron · capturas en ${path.relative(ROOT, OUT)}` : `\n✓ todo bien · capturas en ${path.relative(ROOT, OUT)}`);
process.exit(fails ? 1 : 0);
