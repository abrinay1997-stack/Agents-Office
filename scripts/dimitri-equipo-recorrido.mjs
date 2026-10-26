// Herramienta de desarrollo (no entra en `npm run check`): el recorrido, EN EL NAVEGADOR, de «Dimitri deja una lista de tareas hecha para una persona del equipo»
// (26 oct 2026). Una oficina en una carpeta temporal con dos personas en Ajustes → Equipo (Avalon y Ana), su Claude es un servidor simulado que contesta con un plan
// con piezas para personas (pasos, prioridad, fecha límite, proyecto, «espera a…»). Comprueba, y falla si algo no se cumple:
//   · escritorio (1512 px): el plan trae el destino «Personas del equipo» con Avalon elegida, sus pasos a la vista, se cambia una pieza a Ana en la tarjeta, ENVIAR las
//     deja en la lista de cada una (con sus pasos, su prioridad, su proyecto) y la sigues en Delegadas; Claude recibió <equipo>;
//   · teléfono (390 px): la hoja de revisar una pieza ofrece lo mismo, el destino se cambia con el selector nativo y «Enviar a los jefes» lo manda;
//   · 0 errores de página y ningún desborde horizontal.
//   node scripts/dimitri-equipo-recorrido.mjs [--capturas]     (recuerda `node build.mjs` antes: el servidor sirve lo construido)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'docs', 'capturas-movil', 'despues');
const CAPTURAS = process.argv.includes('--capturas');
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));
const espera = ms => new Promise(r => setTimeout(r, ms));
const hoy = new Date(), ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const en = n => ymd(new Date(hoy.getTime() + n * 864e5));

const PLAN = () => ({ mode: 'plan', reply: 'Le dejo la lista del cierre a Avalon, con sus pasos; la firma es tuya.', proyecto: { nombre: 'Cierre de octubre', objetivo: 'Facturas al día', limite: en(6) }, tasks: [
  { dept: 'persona', persona: 'Avalon', title: 'Listar las facturas vencidas', instruction: 'Saca el listado de facturas vencidas.', why: 'es administrativa', prioridad: 'alta', limite: en(2), pasos: ['Abrir el listado', 'Marcar las de más de 30 días'] },
  { dept: 'persona', persona: 'Avalon', title: 'Llamar a cada cliente', instruction: 'Llama a cada cliente del listado.', why: 'sigue al listado', limite: en(4), espera: [0], pasos: ['Llamar', 'Anotar lo prometido', 'Avisarle al dueño'] },
  { dept: 'dueno', title: 'Firmar el cierre', instruction: 'Firma el cierre.', why: 'solo tú', limite: en(6), espera: [1] }] });

const seen = [];
const claude = http.createServer((rq, rs) => { let b = ''; rq.on('data', d => { b += d; }); rq.on('end', () => {
  const body = JSON.parse(b || '{}'); const sys = typeof body.system === 'string' ? body.system : (Array.isArray(body.system) ? body.system.map(x => x.text || '').join('\n') : '');
  const dim = /mano derecha del due/.test(sys); seen.push({ dim, sys, body });
  const text = dim ? JSON.stringify(PLAN()) : JSON.stringify({ agent: '', title: 'Tarea', plan: [], eta: 10, why: '', needsOk: true });
  rs.writeHead(200, { 'content-type': 'application/json' });
  rs.end(JSON.stringify({ id: 'msg', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } }));
}); });
const cport = await listen(claude);

let fails = 0; const paso = (ok, que) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${que}`); };

async function oficina() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-dim-equipo-')), brain = path.join(dir, 'brain');
  fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
  fs.writeFileSync(path.join(dir, 'local.json'), JSON.stringify({ team: { people: [{ name: 'Avalon', depts: ['fin'], telegram: '777000' }, { name: 'Ana', depts: [] }] } }));
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), ANTHROPIC_API_KEY: 'no-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, CLAUDE_BIN: path.join(dir, 'no-claude.exe'),
    TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', METRICOOL_USER_ID: '', GEMINI_API_KEY: '', HF_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 160; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* arrancando */ } await espera(250); }
  const api = async (ruta, m = 'GET', b) => (await fetch(base + ruta, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json();
  return { base, api, cerrar: () => { srv.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ya no está */ } } };
}

async function verificarTareas(o, quien, tag) {
  const tareas = await o.api('/api/tasks'), por = t => tareas.find(x => x.title === t);
  const a = por('Listar las facturas vencidas'), b = por('Llamar a cada cliente'), c = por('Firmar el cierre');
  paso(a?.person === 'Avalon' && !a.agent, `${tag}: «Listar las facturas» quedó en la lista de Avalon, sin escritorio`);
  paso(a?.prioridad === 'alta' && a?.limite === en(2) && (a?.pasos || []).length === 2, `${tag}: con su prioridad, su fecha límite y sus 2 pasos`);
  paso(b?.person === quien && (b?.pasos || []).length === 3 && (b?.bloqueadaPor || [])[0] === a?.id, `${tag}: «Llamar a cada cliente» es de ${quien}, con 3 pasos, y espera al listado`);
  paso(c?.person === 'Tú', `${tag}: «Firmar el cierre» es del dueño`);
  paso(!!a?.proyecto && a.proyecto === b?.proyecto && b.proyecto === c?.proyecto, `${tag}: las tres son del proyecto «Cierre de octubre»`);
  paso(a?.delegada?.a === 'persona:Avalon' && a?.delegada?.por === 'Tú', `${tag}: el dueño la sigue en Delegadas`);
}

const sinErrores = (page, errs, tag) => paso(errs.length === 0, `${tag}: sin errores de página${errs.length ? ' — ' + errs.join(' | ').slice(0, 200) : ''}`);
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
try {
  /* ---------- escritorio ---------- */
  { const o = await oficina(); seen.length = 0;
    const ctx = await browser.newContext({ viewport: { width: 1512, height: 900 } }), page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(o.base + '/'); await espera(1500);
    await page.keyboard.press('s'); await page.waitForSelector('#subOv:not([hidden])'); await espera(500);
    await page.fill('#subOv textarea', 'Hazle a mi pareja una lista de tareas para el cierre de octubre'); await page.click('#subOv .sb-send');
    await page.waitForSelector('#subOv .sb-item .sb-dept', { timeout: 20000 });
    const eq = seen.find(s => s.dim)?.sys || '';
    paso(/<equipo>\nTe escribe ahora: el dueño\./.test(eq) && /- Avalon · del equipo · FINANZAS/.test(eq) && /- Ana · del equipo/.test(eq), 'escritorio: Claude recibió <equipo> con quién escribe y las dos personas');
    const sel = await page.$$eval('#subOv .sb-item .sb-dept', ss => ss.map(s => ({ valor: s.value, grupo: [...s.querySelectorAll('optgroup')].map(g => g.label), personas: [...s.querySelectorAll('optgroup option')].map(x => x.textContent) })));
    paso(sel.length === 3 && sel[0].valor === 'p:Avalon' && sel[1].valor === 'p:Avalon' && sel[2].valor === 'dueno', `escritorio: el destino de cada pieza viene elegido (${sel.map(s => s.valor).join(' · ')})`);
    paso(sel[0].grupo[0] === 'Personas del equipo' && sel[0].personas.includes('Avalon') && sel[0].personas.includes('Ana'), 'escritorio: el selector ofrece «Personas del equipo» con Avalon y Ana');
    paso(await page.locator('#subOv .sb-pasos').count() === 2 && (await page.locator('#subOv .sb-pasos li').count()) === 5, 'escritorio: los pasos de cada pieza se ven en la tarjeta (2 + 3)');
    paso(await page.locator('#subOv .sb-item').nth(0).locator('.sb-teamc').count() === 0, 'escritorio: una pieza para una persona no ofrece «todo el equipo»');
    paso(/Notas para Avalon/.test(await page.locator('#subOv .sb-item').nth(0).locator('summary').innerText()), 'escritorio: las instrucciones se rotulan «Notas para Avalon»');
    if (CAPTURAS) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, 'dimitri-equipo-escritorio.jpg'), type: 'jpeg', quality: 80 }); }
    await page.locator('#subOv .sb-item').nth(1).locator('.sb-dept').selectOption('p:Ana'); await espera(300);
    paso((await page.locator('#subOv .sb-item').nth(1).locator('.sb-dept').inputValue()) === 'p:Ana', 'escritorio: la segunda pieza se cambia a Ana en la tarjeta');
    await page.click('#subOv .sb-go'); await page.waitForFunction(() => /Listo: envié 3/.test(document.querySelector('#subOv').textContent), null, { timeout: 20000 }).catch(() => {});
    await verificarTareas(o, 'Ana', 'escritorio');
    paso(/la lista de Avalon, la lista de Ana|la lista de Ana, la lista de Avalon/.test(await page.locator('#subOv').innerText()), 'escritorio: Dimitri dice a qué listas las envió');
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    paso(!desborde, 'escritorio: sin desborde horizontal'); sinErrores(page, errs, 'escritorio');
    await ctx.close(); o.cerrar(); }

  /* ---------- teléfono ---------- */
  { const o = await oficina(); seen.length = 0;
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }), page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(o.base + '/'); await page.waitForSelector('.mv-tab[data-tab="dimitri"]', { timeout: 20000 }); await espera(800);
    await page.locator('.mv-tab[data-tab="dimitri"]').tap(); await page.waitForSelector('#mvDim'); await espera(500);
    await page.fill('#mvDim', 'Hazle a mi pareja una lista de tareas para el cierre de octubre'); await page.locator('.mv-compone .mv-enviar').tap();
    await page.waitForSelector('.mv-plan .mv-pieza', { timeout: 20000 }); await espera(600);
    const filas = await page.$$eval('.mv-plan .mv-pieza small', ss => ss.map(s => s.textContent));
    paso(filas.length === 3 && /Avalon/.test(filas[0]) && /2 pasos/.test(filas[0]) && /3 pasos/.test(filas[1]) && /Tú \(tu lista\)/.test(filas[2]), `teléfono: cada pieza dice a quién va y cuántos pasos trae (${filas.map(s => s.split(' · ')[0]).join(' · ')})`);
    if (CAPTURAS) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, 'dimitri-equipo-plan.jpg'), type: 'jpeg', quality: 80 }); }
    await page.locator('.mv-plan .mv-pieza').nth(1).locator('[data-pz-ed]').tap(); await page.waitForSelector('.mv-hoja #mvPd'); await espera(400);
    const op = await page.$$eval('.mv-hoja #mvPd optgroup option', os => os.map(x => x.textContent)), val = await page.inputValue('.mv-hoja #mvPd');
    paso(val === 'p:Avalon' && op.includes('Avalon') && op.includes('Ana'), `teléfono: la hoja de revisar ofrece «Personas del equipo» y trae a Avalon elegida (${op.join(', ')})`);
    paso(await page.locator('.mv-hoja .mv-sw, .mv-hoja [role="switch"]').count() === 0, 'teléfono: no ofrece «todo el equipo» para una persona');
    paso(/Notas para Avalon/.test(await page.locator('.mv-hoja label[for="mvPi"]').innerText()), 'teléfono: el campo se rotula «Notas para Avalon»');
    const alto = await page.evaluate(() => { const s = document.querySelector('.mv-hoja #mvPd'); const r = s.getBoundingClientRect(); return { h: r.height, f: parseFloat(getComputedStyle(s).fontSize) }; });
    paso(alto.h >= 44 && alto.f >= 16, `teléfono: el selector mide ${Math.round(alto.h)} px y su letra ${alto.f} px (≥ 44 y ≥ 16)`);
    await page.selectOption('.mv-hoja #mvPd', 'p:Ana'); await espera(300);
    paso((await page.inputValue('.mv-hoja #mvPd')) === 'p:Ana' && /Notas para Ana/.test(await page.locator('.mv-hoja label[for="mvPi"]').innerText()), 'teléfono: se cambia a Ana y el rótulo la nombra');
    await page.locator('.mv-hoja .mv-btn.primario, .mv-hoja button:has-text("Listo")').first().tap(); await espera(600);
    await page.locator('.mv-plan [data-pl-si]').tap(); await page.waitForFunction(() => /envi/i.test(document.querySelector('.mv-hilo')?.textContent || '') && !document.querySelector('.mv-plan [data-pl-si]'), null, { timeout: 20000 }).catch(() => {});
    await espera(800); await verificarTareas(o, 'Ana', 'teléfono');
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    paso(!desborde, 'teléfono: sin desborde horizontal'); sinErrores(page, errs, 'teléfono');
    await ctx.close(); o.cerrar(); }
} finally { await browser.close(); claude.close(); }
console.log(fails ? `\n✗ ${fails} fallo(s)` : '\n✓ todo bien');
process.exit(fails ? 1 : 0);
