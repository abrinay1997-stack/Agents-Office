// Herramienta de desarrollo (no entra en `npm run check`): el lote de un AGENTE en el navegador (banco de presets E8), sin gastar.
// Una oficina en una carpeta temporal; su Claude es un servidor simulado que, cuando le llega la tarea del agente, llama al MCP del
// Estudio por stdio (estudio-mcp.mjs, con AO_TASK) como haría Claude Code: crear_lote de 10 fotos → nace «espera_ok».
//   node scripts/agentes-recorrido.mjs   → capturas en data/capturas/presets/agentes/ y ✓/✗ por paso
// Pasos: la tarea espera tu OK · ⚠ cuenta 1 · el detalle dice «Lo que saldrá» con el lote (fotos, receta, costo) y el riesgo ·
// a 1512 (claro y oscuro) y a 390 · APROBAR desde la página → el lote se autoriza y arranca la prueba de 3, sin otra ejecución.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'presets', 'agentes'); fs.mkdirSync(OUT, { recursive: true });
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));
const espera = ms => new Promise(r => setTimeout(r, ms));
let base = '';
const call = async (p, b, method = b ? 'POST' : 'GET') => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }); return { status: r.status, j: await r.json().catch(() => null) }; };

function mcp(env) { // el MCP del Estudio por stdio, como lo arranca serve.mjs
  const p = spawn(process.execPath, [path.join(ROOT, 'estudio-mcp.mjs')], { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = '', n = 0; const wait = new Map();
  p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); wait.get(m.id)?.(m); wait.delete(m.id); } });
  const rpc = (method, params) => new Promise(r => { const id = ++n; wait.set(id, r); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  return { call: async (name, args) => (await rpc('tools/call', { name, arguments: args })).result.content[0].text, list: async () => (await rpc('tools/list', {})).result.tools, close: () => p.kill() };
}
let hecho = false, dijo = '';
const claude = http.createServer((rq, rs) => { let b = ''; rq.on('data', d => { b += d; }); rq.on('end', async () => {
  let text = 'ok';
  if (!hecho && b.includes('CATALOGO-BODEGA')) {
    hecho = true;
    const tk = (await call('/api/tasks')).j.find(x => x.state === 'doing' && x.text.includes('CATALOGO-BODEGA'));
    const m = mcp({ AO_OFFICE: base, AO_AGENT: 'gfx', AO_TASK: tk.id });
    dijo = await m.call('crear_lote', { nombre: 'Camas bodega → web', presets: ['luz-mas-clara'], carpeta: 'Bodega', canal: 'web' }); m.close();
    text = `Preparé el catálogo de la Bodega para la web.\n\n## La serie\n${dijo.split('\n').find(l => l.startsWith('⏳')) || ''}\n\nFuentes: galería del Estudio`;
  }
  rs.writeHead(200, { 'content-type': 'application/json' });
  rs.end(JSON.stringify({ id: 'msg', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } }));
}); });
const cport = await listen(claude);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-agentes-')), brain = path.join(dir, 'brain');
fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana y directa.\n');
fs.writeFileSync(path.join(dir, 'local.json'), JSON.stringify({ approvals: { undoSeconds: 0 } }));
const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), ANTHROPIC_API_KEY: 'no-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, CLAUDE_BIN: path.join(dir, 'no-claude.exe'),
  TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', VOYAGE_API_KEY: '', MINIMAX_API_KEY: '' };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await espera(250); }

let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
let browser;
try {
  // la galería: 10 «camas» en la carpeta Bodega
  const bodega = (await call('/api/media/folders', { name: 'Bodega' })).j.folder.id;
  for (let i = 0; i < 10; i++) await call('/api/media/upload', { name: `cama ${i}.png`, folder: bodega, data: 'data:image/png;base64,' + (await sharp({ create: { width: 160, height: 120, channels: 3, background: { r: 120 + i * 9, g: 90, b: 60 } } }).png().toBuffer()).toString('base64') });
  const tools = mcp({ AO_OFFICE: base }); const names = (await tools.list()).map(t => t.name); tools.close();
  step(['buscar_presets', 'aplicar_preset', 'crear_lote', 'estado_lote'].every(n => names.includes(n)), `el MCP muestra las cuatro herramientas del banco (${names.length} en total)`);
  const t1 = (await call('/api/tasks', { dept: 'marketing', agent: 'gfx', needsOk: false, text: 'CATALOGO-BODEGA Prepara el catálogo de la carpeta Bodega para la web' })).j;
  let w = null; for (let i = 0; i < 160 && !w; i++) { w = (await call('/api/tasks')).j.find(x => x.id === t1.id && x.state === 'waiting'); if (!w) await espera(250); }
  step(!!w, 'la tarea del agente espera tu OK'); if (!w) throw new Error(log.split('\n').slice(-8).join('\n'));
  step(/Aprobaciones/.test(dijo) && /No se gastó nada/.test(dijo), 'el agente leyó que el lote espera el OK y que no se gastó nada');
  const L = w.lotesOk[0].id;
  step((await call(`/api/media/lotes/${L}`)).j.lote.estado === 'espera_ok', `el lote ${L} nace «espera_ok»`);

  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  for (const [ancho, alto, tema] of [[1512, 900, 'light'], [1512, 900, 'dark'], [390, 844, 'light']]) {
    const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, hasTouch: ancho < 500, isMobile: ancho < 500, colorScheme: tema });
    await ctx.addInitScript(t => { try { localStorage.setItem('ao.theme', t); } catch {} }, tema);
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(base + '/'); await page.waitForTimeout(2500);
    const tag = `${ancho}-${tema}`;
    const ap = await page.evaluate(() => { const b = document.getElementById('topAppr'); return b && getComputedStyle(b).display !== 'none' ? b.textContent.trim() : ''; });
    step(/1/.test(ap), `${tag}: ⚠ en la barra cuenta 1 (${ap || 'no se ve'})`);
    await page.screenshot({ path: path.join(OUT, `${tag}-oficina.png`) });
    // el detalle de la tarea: abrir el panel de tareas (T) y la fila de la tarea
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('t'); await page.waitForTimeout(700);
    const abierta = await page.evaluate(() => { const r = [...document.querySelectorAll('.tp-row[data-id], .tk[data-id]')].find(n => /CATALOGO-BODEGA|catálogo de la carpeta Bodega/i.test(n.textContent)); if (!r) return false; (r.querySelector('.tp-open') || r).click(); return true; });
    step(abierta, `${tag}: la tarea está en el panel y se abre`);
    await page.waitForTimeout(900);
    const prev = await page.evaluate(() => { const p = document.querySelector('#tdDrawer .td-prev'); return p ? p.innerText : ''; });
    step(/Estudio: lote «Camas bodega → web» · 10 fotos/.test(prev) && /\$/.test(prev) || /Estudio: lote/.test(prev), `${tag}: «Lo que saldrá» nombra el lote del Estudio (${prev.replace(/\s+/g, ' ').slice(0, 120)})`);
    const borrador = await page.evaluate(() => document.querySelector('#tdDrawer')?.innerText || '');
    step(/Lote del Estudio que espera tu OK/.test(borrador) && /Si apruebas/.test(borrador), `${tag}: el borrador explica qué pasa si apruebas o lo devuelves`);
    const pr = await page.$('#tdDrawer .td-prev');
    if (pr) await pr.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `${tag}-aprobacion.png`) });
    const horiz = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    step(horiz <= 0, `${tag}: sin scroll horizontal (${horiz})`);
    step(!errs.length, `${tag}: sin errores en la página${errs.length ? ': ' + errs.join(' | ') : ''}`);
    await ctx.close();
  }
  // APROBAR desde la página (la misma ruta que su botón)
  const r = await call(`/api/tasks/${t1.id}/approve`, {});
  step(r.status === 200, 'aprobar responde 200');
  let l = null; for (let i = 0; i < 120; i++) { l = (await call(`/api/media/lotes/${L}`)).j.lote; if (l.estado === 'pausado') break; await espera(250); }
  step(l.estado === 'pausado' && l.pausa?.por === 'muestra' && l.filas.filter(f => f.out).length === 3, `tu OK lo arranca: prueba de 3 y se para (${l.estado}, ${l.filas.filter(f => f.out).length} hechas)`);
  const d = (await call('/api/tasks')).j.find(x => x.id === t1.id);
  step(d.state === 'done' && d.approved && !/AFTER YOUR OK/.test(d.result), 'la tarea termina aprobada, sin otra ejecución del agente');
} catch (e) { fails++; console.log('✗', e.message); }
finally { await browser?.close(); srv.kill(); claude.close(); claude.closeAllConnections?.(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
console.log(fails ? `${fails} paso(s) fallaron` : 'todo bien'); console.log('capturas:', OUT);
process.exit(fails ? 1 : 0);
