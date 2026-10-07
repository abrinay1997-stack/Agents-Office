// Herramienta de desarrollo (no entra en `npm run check`): la pestaña MÍAS de Tareas en el navegador (plan D, 7 oct 2026 — las tareas
// del dueño). Oficina temporal (cerebro copiado, datos aparte, sin keys) y Claude de mentira (los agentes tardan: lo delegado queda en
// curso). Recorre: el rail de listas, añadir en línea con la fecha de la lista, la casilla redonda con DESHACER, el detalle de una
// tarea tuya (empezar, delegar a un agente), Delegadas, «Lo hago yo» sobre la tarea de un agente, el tablero personal (arrastrar a
// «Haciendo»), Inicio con «Lo tuyo hoy»; mide objetivos de 24 px, letra ≥ 10,5 y que nada se salga a lo ancho; con Dimitri al lado.
//   node scripts/mias-recorrido.mjs   → capturas en data/capturas/mias/ y ✓/✗ por paso, a 1512 (claro y oscuro), 1024 y 390
//   AO_AXE=<ruta a axe.min.js> además pasa axe en Mías (lista y tablero) y en el detalle · AO_SOLO=1024-light: un solo ancho
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'mias'); fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function oficina() {
  const claude = http.createServer((rq, rs) => { let b = ''; rq.on('data', d => { b += d; }); rq.on('end', async () => {
    const body = JSON.parse(b || '{}'); const sys = typeof body.system === 'string' ? body.system : JSON.stringify(body.system || '');
    const router = /You are the router for/.test(sys); if (!router) await espera(150000);
    const text = router ? JSON.stringify({ agent: '', title: '', plan: ['Leer lo que hay', 'Hacer el borrador', 'Revisarlo'], eta_minutes: 20, why: 'prueba', needs_ok: true }) : 'ENTREGA LISTA\nFuentes: —';
    rs.writeHead(200, { 'content-type': 'application/json' }); rs.end(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 5, output_tokens: 5 } }));
  }); });
  const cport = await listen(claude);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-mias-ui-')), data = path.join(dir, 'data'), brain = path.join(dir, 'brain');
  fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, ANTHROPIC_API_KEY: 'test-key-not-real', // secrets-ok
    TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', METRICOOL_USER_ID: '', GEMINI_API_KEY: '', HF_KEY: '', FAL_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await espera(250); }
  const api = async (ruta, m = 'GET', b) => (await fetch(base + ruta, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json();
  // lo del dueño: una para hoy (empezada), una vencida, una en un proyecto, dos en la bandeja; y trabajo de agentes para tomar
  const hoy = new Date(), ayer = new Date(Date.now() - 864e5), pasado = new Date(Date.now() + 2 * 864e5);
  const pr = (await api('/api/tareas/proyectos', 'POST', { nombre: 'Lanzamiento lentes', limite: ymd(new Date(Date.now() + 9 * 864e5)), color: 'azul' })).proyecto;
  await api('/api/tareas/mias', 'POST', { title: 'Llamar al banco por la línea de crédito', limite: ymd(hoy) + 'T10:30', prioridad: 'alta', empezar: true });
  await api('/api/tareas/mias', 'POST', { title: 'Firmar el contrato del local', limite: ymd(ayer), dept: 'ops' });
  await api('/api/tareas/mias', 'POST', { title: 'Visitar la feria de ópticas', limite: ymd(pasado), proyecto: pr.id });
  await api('/api/tareas/mias', 'POST', { title: 'Leer el informe de ventas de septiembre' });
  await api('/api/tareas/mias', 'POST', { title: 'Pensar el precio de los polarizados', pasos: ['Mirar la competencia', 'Mirar el costo'] });
  const ag = await api('/api/tasks', 'POST', { dept: 'sales', text: 'Llamar a las ópticas del año pasado', idea: true });
  return { base, api, ag, cerrar: () => { srv.kill(); claude.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

const medir = page => page.evaluate(() => {
  const ov = document.getElementById('tvOv');
  const peq = [...ov.querySelectorAll('button, select, input:not([type=hidden]), summary, [role=tab]')].filter(b => b.offsetParent && b.getClientRects().length).map(b => [b, (b.type === 'checkbox' || b.type === 'radio') && b.closest('label') ? b.closest('label').getBoundingClientRect() : b.getBoundingClientRect()]).filter(([, r]) => r.height < 24 - 0.5 || r.width < 24 - 0.5).map(([b, r]) => `${b.className || b.tagName}:${Math.round(r.width)}x${Math.round(r.height)}`);
  const hs = document.documentElement.scrollWidth > innerWidth + 1;
  const letra = [...ov.querySelectorAll('*')].filter(n => n.childNodes.length && [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()) && n.offsetParent).map(n => parseFloat(getComputedStyle(n).fontSize)).filter(f => f < 10.5).length;
  return { peq: peq.slice(0, 5), npeq: peq.length, hs, letra };
});
const okMedida = (m, tag, que) => step(!m.npeq && !m.hs && !m.letra, `${tag}: ${que} — objetivos de 24 px, sin desplazamiento a lo ancho, letra ≥ 10,5 (${m.npeq ? m.peq.join(' ') : ''}${m.hs ? ' · se sale' : ''}${m.letra ? ` · ${m.letra} textos pequeños` : ''})`);

let browser;
try {
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  const axe = process.env.AO_AXE && fs.existsSync(process.env.AO_AXE) ? fs.readFileSync(process.env.AO_AXE, 'utf8') : null;
  for (const [w, h, tema] of [[1512, 900, 'light'], [1512, 900, 'dark'], [1024, 768, 'light'], [390, 844, 'light']]) {
    if (process.env.AO_SOLO && process.env.AO_SOLO !== `${w}-${tema}`) continue;
    const tag = `${w}-${tema}`, o = await oficina(), movil = w < 500; let pagina = null; const errs = [];
    try {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: movil, isMobile: movil, colorScheme: tema });
      const page = await ctx.newPage(); pagina = page; page.on('pageerror', e => errs.push(e.message));
      await page.goto(o.base + '/#tareas=mias&l=hoy'); await page.waitForTimeout(1500);
      await page.evaluate(t => { if (t === 'dark') document.body.classList.add('dark'); }, tema);
      await page.waitForSelector('#tvOv .tv-mias', { timeout: 15000 }); await page.waitForTimeout(600);
      const rail = await page.$$eval('#tvOv .tv-mli', l => l.map(b => b.textContent.trim()));
      step(rail.some(x => /^Hoy\s*2$/.test(x)) && rail.some(x => /^Bandeja\s*2$/.test(x)) && rail.some(x => /Lanzamiento lentes/.test(x)), `${tag}: el rail dice cuántas hay en cada lista (${rail.join(' · ')})`);
      step(await page.$eval('#tvOv [data-tab="mias"] .tv-n', n => !n.hidden && n.textContent === '2'), `${tag}: la pestaña Mías dice cuántas tienes hoy`);
      step(/tareas=mias/.test(await page.evaluate(() => location.hash)) && /l=hoy/.test(await page.evaluate(() => location.hash)), `${tag}: la dirección dice qué lista tienes abierta`);
      step(await page.$eval('#tvOv [data-rdept]', s => s.value) === 'yo', `${tag}: en Mías, el campo de arriba añade «Para mí»`);
      okMedida(await medir(page), tag, 'Mías · Hoy');
      await page.screenshot({ path: path.join(OUT, `${tag}-hoy.png`) });
      // añadir en línea: trae la fecha de la lista
      await page.fill('#tvOv [data-madd]', 'Pasar por la imprenta #recados'); await page.press('#tvOv [data-madd]', 'Enter'); await page.waitForTimeout(1500);
      const imp = (await o.api('/api/tasks')).find(t => /imprenta/.test(t.title));
      step(imp?.person === 'Tú' && !imp.agent && imp.limite === ymd(new Date()) && imp.etiquetas?.length === 1, `${tag}: «+ Añadir tarea» en Hoy crea una tarea tuya, para hoy, con su etiqueta`);
      // la casilla redonda: hecha, y DESHACER la reabre
      await page.check(`#tvOv [data-hecha="${imp.id}"]`); await page.waitForTimeout(1500);
      const hecha = (await o.api('/api/tasks')).find(t => t.id === imp.id);
      step(hecha.state === 'done' && /COMPLETADAS · 1/.test(await page.textContent('#tvOv .tv-mlist')), `${tag}: la casilla la marca hecha y baja a COMPLETADAS`);
      await page.click('#tvOv .tv-toast [data-deshacer]'); await page.waitForTimeout(1500);
      step((await o.api('/api/tasks')).find(t => t.id === imp.id).state === 'next', `${tag}: DESHACER la reabre`);
      // Bandeja y Próximos
      await page.click('#tvOv [data-mlista="bandeja"]'); await page.waitForTimeout(400);
      step(/Leer el informe/.test(await page.textContent('#tvOv .tv-mmain')), `${tag}: la Bandeja tiene lo que no tiene fecha ni proyecto`);
      await page.click('#tvOv [data-mlista="todas"]'); await page.waitForTimeout(400);
      const grupos = await page.$$eval('#tvOv .tv-mlist .tv-gh', l => l.map(x => x.textContent.replace(/\d+$/, '').trim()));
      step(grupos[0] === 'Vencidas' && grupos.includes('Hoy') && grupos.includes('Sin fecha'), `${tag}: «Todas» va agrupada por fecha (${grupos.join(' · ')})`);
      okMedida(await medir(page), tag, 'Mías · Todas');
      await page.screenshot({ path: path.join(OUT, `${tag}-todas.png`) });
      // el detalle de una tarea tuya: empezar y delegar
      const precio = (await o.api('/api/tasks')).find(t => /precio de los polarizados/.test(t.title));
      await page.click(`#tvOv [data-abrir="${precio.id}"]`); await page.waitForSelector('#tvOv .tv-dh', { timeout: 8000 }); await page.waitForTimeout(300);
      step(!!await page.$('#tvOv [data-acc="hecha-mia"]') && !!await page.$('#tvOv [data-acc="delegar"]') && !(await page.$('#tvOv [data-acc="ejecutar"]')), `${tag}: el detalle de una tarea tuya ofrece Hecha, Empezar y Delegar (no «Ejecutar»)`);
      await page.click('#tvOv [data-acc="empezar"]'); await page.waitForTimeout(1500);
      step(!!(await o.api('/api/tasks')).find(t => t.id === precio.id).empezada, `${tag}: «Empezar» la pone en «Haciendo», con su cronómetro`);
      await page.click('#tvOv [data-acc="delegar"]'); await page.waitForTimeout(300);
      await page.selectOption('#tvOv [data-dg="dept"]', 'fin'); await page.waitForTimeout(200);
      const opciones = await page.$$eval('#tvOv [data-dg="agente"] option', l => l.length);
      await page.fill('#tvOv [data-dg="nota"]', 'Con el costo del proveedor y un margen del 40 %');
      okMedida(await medir(page), tag, 'el detalle con «Delegar…» abierto');
      await page.screenshot({ path: path.join(OUT, `${tag}-delegar.png`) });
      await page.click('#tvOv [data-acc="delegar-ok"]'); await page.waitForTimeout(2500);
      const del = (await o.api('/api/tasks')).find(t => t.id === precio.id);
      step(opciones > 2 && del.dept === 'fin' && !!del.agent && !del.person && /margen del 40/.test(del.text) && del.delegada?.a?.startsWith('agente:'), `${tag}: «Delegar» la pasa a Finanzas (la toma ${del.agent}), con tu nota, y deja de ser tuya`);
      if (!movil) await page.keyboard.press('Escape'); else await page.click('#tvOv [data-cerrar]'); await page.waitForTimeout(300);
      await page.click('#tvOv [data-mlista="delegadas"]'); await page.waitForTimeout(500);
      step(new RegExp('precio de los polarizados').test(await page.textContent('#tvOv .tv-mmain')), `${tag}: la sigues en «Delegadas»`);
      await page.screenshot({ path: path.join(OUT, `${tag}-delegadas.png`) });
      // «Lo hago yo» sobre la idea de un agente (desde Lista)
      await page.click('#tvOv [data-tab="lista"]'); await page.waitForTimeout(400);
      await page.click(`#tvOv [data-abrir="${o.ag.id}"]`); await page.waitForSelector('#tvOv [data-acc="tomar"]', { timeout: 8000 });
      await page.click('#tvOv [data-acc="tomar"]'); await page.waitForTimeout(1500);
      const tomada = (await o.api('/api/tasks')).find(t => t.id === o.ag.id);
      step(tomada.person === 'Tú' && !tomada.agent && !!tomada.deAgente && tomada.state === 'next', `${tag}: «Lo hago yo» se la quita al agente y te la deja (de ${tomada.deAgente})`);
      step(!!await page.$('#tvOv [data-acc="devolver-agente"]'), `${tag}: y ofrece devolvérsela`);
      if (!movil) await page.keyboard.press('Escape'); else await page.click('#tvOv [data-cerrar]'); await page.waitForTimeout(300);
      await page.selectOption('#tvOv [data-f="quien"]', 'yo'); await page.waitForTimeout(400);
      const soloMias = await page.$$eval('#tvOv .tv-lista .tv-fila', l => l.length);
      step(soloMias >= 5 && /quien=yo/.test(await page.evaluate(() => location.hash)), `${tag}: Lista → Quién: Tuyas (${soloMias})`);
      await page.click('#tvOv .tv-fchip[data-quitar="quien"]'); await page.waitForTimeout(300);
      // el tablero personal: arrastrar a «Haciendo»
      await page.click('#tvOv [data-tab="mias"]'); await page.waitForTimeout(300);
      await page.click('#tvOv [data-mlista="todas"]'); await page.waitForTimeout(300);
      await page.click('#tvOv [data-mmodo="tablero"]'); await page.waitForTimeout(500);
      const firma = (await o.api('/api/tasks')).find(t => /Firmar el contrato/.test(t.title));
      step(!!await page.$(`#tvOv [data-mcol="porhacer"] [data-t="${firma.id}"]`) && !!await page.$('#tvOv [data-mcol="haciendo"] .tv-fila'), `${tag}: el tablero personal: Por hacer · Haciendo · Hecha`);
      if (!movil) {
        await page.evaluate(id => { const f = document.querySelector(`#tvOv .tv-fila[data-t="${id}"]`), z = document.querySelector('#tvOv .tv-drop[data-mcol="haciendo"]'), dt = new DataTransfer(), r = z.getBoundingClientRect(), op = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 10, clientY: r.top + 10 };
          f.dispatchEvent(new DragEvent('dragstart', op)); z.dispatchEvent(new DragEvent('dragover', op)); z.dispatchEvent(new DragEvent('drop', op)); f.dispatchEvent(new DragEvent('dragend', op)); }, firma.id);
        await page.waitForTimeout(1500);
        step(!!(await o.api('/api/tasks')).find(t => t.id === firma.id).empezada, `${tag}: arrastrarla a «Haciendo» la empieza`);
      }
      okMedida(await medir(page), tag, 'Mías · Tablero');
      await page.screenshot({ path: path.join(OUT, `${tag}-tablero.png`) });
      if (axe) {
        await page.addScriptTag({ content: axe });
        const run = async que => { const r = await page.evaluate(async () => (await window.axe.run('#tvOv', { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(v => `${v.id}(${v.nodes.length}) ${v.nodes[0]?.target?.join(' ') || ''}`)); step(!r.length, `${tag}: axe en ${que}${r.length ? ': ' + r.join(' ') : ''}`); };
        await run('Mías · tablero'); await page.click('#tvOv [data-mmodo="lista"]'); await page.waitForTimeout(400); await run('Mías · lista');
        await page.click(`#tvOv [data-abrir="${firma.id}"]`); await page.waitForSelector('#tvOv .tv-dh'); await page.click('#tvOv [data-acc="delegar"]'); await page.waitForTimeout(300); await run('el detalle con Delegar abierto');
        if (!movil) await page.keyboard.press('Escape'); else await page.click('#tvOv [data-cerrar]'); await page.waitForTimeout(300);
      }
      await page.click('#tvOv [data-mmodo="lista"]').catch(() => {}); await page.waitForTimeout(200);
      // Inicio: «Lo tuyo hoy» arriba
      await page.click('#tvOv [data-tab="inicio"]'); await page.waitForTimeout(500);
      const secs = await page.$$eval('#tvOv .tv-sec', l => l.map(s => s.dataset.sec));
      step(secs.includes('mias') && secs.indexOf('mias') < secs.indexOf('hoy'), `${tag}: Inicio tiene «Lo tuyo hoy» antes que la oficina (${secs.join(', ')})`);
      okMedida(await medir(page), tag, 'Inicio con lo tuyo');
      await page.screenshot({ path: path.join(OUT, `${tag}-inicio.png`) });
      // el calendario (P): la capa «TUYAS» — tus tareas en el día que vencen; un clic te lleva a Mías
      await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      if (await page.$eval('#tvOv', o => o.classList.contains('on'))) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
      await page.keyboard.press('p'); await page.waitForSelector('#calOv.on', { timeout: 8000 }); await page.waitForTimeout(1200);
      const mcal = await page.$$eval('#calOv .cv-ev.mia', l => l.map(x => x.textContent));
      step(mcal.some(x => /Llamar al banco/.test(x)) && !!await page.$('#calOv [data-tog="mias"][aria-pressed="true"]'), `${tag}: el calendario enseña tus tareas (capa TUYAS: ${mcal.length})`);
      await page.screenshot({ path: path.join(OUT, `${tag}-calendario.png`) });
      await page.locator('#calOv .cv-ev.mia').filter({ hasText: 'Llamar al banco' }).first().click(); await page.waitForSelector('#tvOv.on .tv-dh', { timeout: 10000 }).catch(() => {});
      step(/Llamar al banco/.test(await page.$eval('#tvOv .tv-det .tv-titin', i => i.value).catch(() => '')) && await page.$eval('#tvOv [data-tab="mias"]', b => b.getAttribute('aria-selected') === 'true'), `${tag}: un clic la abre en Tareas → Mías`);
      if (!movil) await page.keyboard.press('Escape'); else await page.click('#tvOv [data-cerrar]'); await page.waitForTimeout(300);
      if (w === 1024) { await page.click('#tvOv [data-tab="mias"]'); await page.keyboard.press('s'); await page.waitForTimeout(900); const m = await medir(page); step(!m.hs && !m.npeq, `${tag}: con Dimitri al lado cabe (${m.peq.join(' ')})`); await page.screenshot({ path: path.join(OUT, `${tag}-dimitri.png`) }); await page.keyboard.press('s'); await page.waitForTimeout(300); }
      step(!errs.length, `${tag}: sin errores de la página${errs.length ? ': ' + errs[0] : ''}`);
      await ctx.close();
    } catch (e) {
      fails++; console.log(`✗ ${tag}: ${e.message.split('\n')[0]}${errs.length ? ' · página: ' + errs[0] : ''}`);
      await pagina?.screenshot({ path: path.join(OUT, `${tag}-fallo.png`) }).catch(() => {});
    } finally { o.cerrar(); }
  }
  // la demo (file://): Mías con datos de ejemplo
  { const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + path.join(ROOT, 'dist', 'command-centre-v2.html') + '#tareas=mias&l=hoy'); await page.waitForSelector('#tvOv .tv-mias', { timeout: 15000 }); await page.waitForTimeout(400);
    step(await page.$$eval('#tvOv .tv-mlist .tv-fila', l => l.length) >= 2, 'demo: Mías abre con tareas de ejemplo para hoy');
    await page.click('#tvOv [data-mlista="bandeja"]'); await page.waitForTimeout(300); step(/Sugerida por/.test(await page.textContent('#tvOv .tv-mmain')), 'demo: la Bandeja trae una sugerencia de un agente');
    step(!errs.length, `demo: sin errores${errs.length ? ': ' + errs[0] : ''}`); await page.screenshot({ path: path.join(OUT, 'demo.png') }); await ctx.close(); }
} catch (e) { fails++; console.log('✗ ' + e.message); }
finally { await browser?.close(); }
console.log(fails ? `\n✗ ${fails} paso(s) fallaron · capturas en ${path.relative(ROOT, OUT)}` : `\n✓ todo bien · capturas en ${path.relative(ROOT, OUT)}`);
process.exit(fails ? 1 : 0);
