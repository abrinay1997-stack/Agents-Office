// Herramienta de desarrollo (no entra en `npm run check`): DIM-10 y DIM-14 EN EL NAVEGADOR, sin gastar. Una oficina en una carpeta
// temporal con unas tareas de ejemplo; su Claude es un servidor simulado (API compatible) que escribe EN TROZOS LENTOS (SSE).
//   node scripts/dimitri-streaming.mjs   → capturas en data/capturas/dimitri/ y ✓/✗ por paso
// Pasos, a 390, 1024 y 1512 px, en claro y oscuro: el chip «¿Cómo vamos?» pinta el resumen al instante (sin Claude) · «Analizar con
// Dimitri» → la respuesta aparece mientras se escribe · «Detener» (o Esc) la para: «Detenido por ti», sin plan.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'dimitri'); fs.mkdirSync(OUT, { recursive: true });
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));
const wait = ms => new Promise(r => setTimeout(r, ms));
const seen = [];
const ANALISIS = { mode: 'analisis', reply: 'Lo que veo: **una entrega espera tu OK** desde esta mañana y el informe de ventas falló porque Gmail no respondió.\n\n1. Aprueba o devuelve el correo a Acme: es lo único que frena a Ventas.\n2. Vuelve a lanzar el informe cuando Gmail responda.\n3. La semana de Contenido tiene huecos: si quieres, propongo borradores.\n\nLo demás puede esperar a mañana.' };
const PLAN = { mode: 'plan', reply: 'Así lo haría: Ventas llama a los clientes de septiembre uno por uno y Marketing prepara el correo de seguimiento con la oferta de la semana, para que salga el jueves temprano.', tasks: [{ dept: 'sales', title: 'Llamar a los clientes de septiembre', instruction: 'Llama a todos.', why: 'ventas' }] };
let nextAnswer = ANALISIS;
const claude = http.createServer((rq, rs) => { let b = ''; rq.on('data', d => { b += d; }); rq.on('end', async () => {
  const body = JSON.parse(b || '{}'); seen.push({ at: Date.now(), stream: !!body.stream });
  const text = JSON.stringify(nextAnswer);
  if (!body.stream) { rs.writeHead(200, { 'content-type': 'application/json' }); return rs.end(JSON.stringify({ id: 'msg', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } })); }
  rs.writeHead(200, { 'content-type': 'text/event-stream' }); let closed = false; rs.on('close', () => { closed = true; });
  const ev = (type, data) => rs.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  ev('message_start', { message: { id: 'msg', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } });
  ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
  await wait(700); // «está pensando» first
  for (let i = 0; i < text.length && !closed; i += 9) { ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: text.slice(i, i + 9) } }); await wait(90); }
  if (closed) return;
  ev('content_block_stop', { index: 0 }); ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 20 } }); ev('message_stop', {}); rs.end();
}); });
const cport = await listen(claude);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-dim-stream-')), brain = path.join(dir, 'brain'), data = path.join(dir, 'data');
fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana y directa.\n');
const roster = JSON.parse(fs.readFileSync(path.join(ROOT, 'office.agents.json'), 'utf8')).agents, seat = d => roster.find(a => a.department === d && !a.lead) || roster.find(a => a.department === d);
const now = Date.now(), t0 = new Date(); t0.setHours(0, 0, 0, 0);
fs.mkdirSync(data, { recursive: true });
fs.writeFileSync(path.join(data, 'tasks.json'), JSON.stringify([
  { id: 'w1', dept: 'sales', agent: seat('sales').id, title: 'Correo de seguimiento a Acme', text: 'x', state: 'waiting', draft: 'Hola…', result: 'Hola…', addedAt: now - 3e6, waitingAt: now - 3e6, needsOk: true },
  { id: 'f1', dept: 'fin', agent: seat('fin').id, title: 'Informe de ventas de septiembre', text: 'x', state: 'done', error: true, result: 'Could not complete this task: Gmail no respondió', addedAt: Math.max(t0.getTime(), now - 2e6), doneAt: Math.max(t0.getTime() + 1000, now - 1e6) },
  { id: 's1', dept: 'marketing', agent: seat('marketing').id, title: 'Revisar el calendario de la semana', text: 'x', state: 'scheduled', addedAt: now, dueAt: now + 6 * 864e5 },
]));
const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), ANTHROPIC_API_KEY: 'no-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '' };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await wait(250); }

let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
const box = sel => `(() => { const r = document.querySelector('${sel}')?.getBoundingClientRect(); return r ? { w: r.width, h: r.height } : null; })()`;
try {
  for (const w of [1512, 1024, 390]) for (const tema of ['light', 'dark']) {
    const h = w < 500 ? 844 : 900, tag = `${w}-${tema}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500 });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(base + '/'); await page.waitForTimeout(1200);
    await page.evaluate(t => { document.body.classList.toggle('dark', t === 'dark'); }, tema);
    await page.evaluate(() => fetch('/api/sub/clear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('s'); await page.waitForSelector('#subOv:not([hidden])'); await page.waitForTimeout(400);
    // DIM-10: the chip, at once and without Claude
    const before = seen.length, c0 = Date.now();
    await page.click('#subOv .sb-chips button:has-text("¿Cómo vamos?")');
    await page.waitForSelector('#subOv .sb-quick', { timeout: 5000 }).catch(() => {});
    const ms = Date.now() - c0, q = await page.evaluate(() => document.querySelector('#subOv .sb-msgs')?.innerText || '');
    step(/Esperan tu OK:\s*1/.test(q) && /Falló hoy:\s*1/.test(q) && /Contenido, próximos 7 días/.test(q) && /Gasto de hoy/.test(q), `${tag}: «¿Cómo vamos?» pinta el resumen (${ms} ms)`);
    step(ms < 1500 && seen.length === before, `${tag}: al instante y sin preguntarle a Claude (${seen.length - before} llamadas)`);
    const an = await page.evaluate(box('#subOv .sb-analyze')); step(!!an && an.h >= 24, `${tag}: botón «Analizar con Dimitri» (${an ? Math.round(an.h) : 0} px)`);
    await page.screenshot({ path: path.join(OUT, `como-vamos-${tag}.png`) });
    // DIM-14: «Analizar» streams
    nextAnswer = ANALISIS;
    await page.click('#subOv .sb-analyze');
    await page.waitForSelector('#subOv .sb-stop', { timeout: 5000 }).catch(() => {});
    const st = await page.evaluate(box('#subOv .sb-stop')); step(!!st && st.h >= 24 && st.w >= 24, `${tag}: «Detener» a la vista mientras piensa (${st ? Math.round(st.w) + '×' + Math.round(st.h) : '—'})`);
    await page.waitForFunction(() => (document.querySelector('#subOv .sb-livem .md')?.textContent || '').length > 20, null, { timeout: 8000 }).catch(() => {});
    const l1 = await page.evaluate(() => document.querySelector('#subOv .sb-livem .md')?.textContent || ''); await page.waitForTimeout(500);
    const l2 = await page.evaluate(() => document.querySelector('#subOv .sb-livem .md')?.textContent || '');
    step(l1.length > 0 && l2.length > l1.length && !/[{}"]/.test(l2), `${tag}: el texto aparece y crece mientras se escribe (${l1.length} → ${l2.length} caracteres, sin JSON)`);
    await page.screenshot({ path: path.join(OUT, `escribiendo-${tag}.png`) });
    await page.waitForFunction(() => !document.querySelector('#subOv .sb-busy'), null, { timeout: 20000 }).catch(() => {});
    const fin = await page.evaluate(() => ({ txt: document.querySelector('#subOv .sb-msgs').innerText, mode: [...document.querySelectorAll('#subOv .sb-mode')].map(x => x.textContent) }));
    step(/Lo demás puede esperar a mañana/.test(fin.txt) && fin.mode.includes('Análisis'), `${tag}: al terminar queda la respuesta validada (Análisis)`);
    // Detener (by the button at one theme, by Esc at the other)
    nextAnswer = PLAN;
    await page.fill('#subOv textarea', 'Que Ventas llame a los clientes de septiembre');
    await page.click('#subOv .sb-send');
    await page.waitForFunction(() => (document.querySelector('#subOv .sb-livem .md')?.textContent || '').length > 15, null, { timeout: 8000 }).catch(() => {});
    if (tema === 'light') await page.click('#subOv .sb-stop'); else { await page.focus('#subOv textarea'); await page.keyboard.press('Escape'); }
    await page.waitForFunction(() => /Detenido por ti/i.test(document.querySelector('#subOv .sb-msgs').innerText) && !document.querySelector('#subOv .sb-busy'), null, { timeout: 5000 }).catch(() => {});
    const stopped = await page.evaluate(() => ({ txt: document.querySelector('#subOv .sb-msgs').innerText, plan: !!document.querySelector('#subOv .sb-go'), open: document.body.classList.contains('subOpen') }));
    step(/Detenido por ti/i.test(stopped.txt) && !stopped.plan, `${tag}: ${tema === 'light' ? '«Detener»' : 'Esc'} la para — «Detenido por ti», sin plan que enviar`);
    if (tema === 'dark') step(stopped.open, `${tag}: Esc detuvo la respuesta sin cerrar el chat`);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); step(over <= 0, `${tag}: sin desplazamiento horizontal (${over})`);
    await page.screenshot({ path: path.join(OUT, `detenido-${tag}.png`) });
    step(!errs.length, `${tag}: sin errores en la página${errs.length ? ': ' + errs[0] : ''}`);
    await ctx.close();
  }
} finally { await browser.close(); srv.kill(); claude.close(); claude.closeAllConnections?.(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
console.log(`\n${fails ? fails + ' paso(s) fallaron' : 'todo bien'} · capturas en ${path.relative(ROOT, OUT)}`);
if (fails) { console.log(log.split('\n').slice(-12).join('\n')); process.exitCode = 1; }
