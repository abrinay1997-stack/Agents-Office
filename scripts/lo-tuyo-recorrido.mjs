// Herramienta de desarrollo (no entra en `npm run check`): LO TUYO fuera de Tareas (8 oct 2026, revisión del plan D) en el navegador.
// Oficina temporal (cerebro copiado, datos aparte, sin keys, Claude que no responde). Recorre:
//   · el calendario (P): «PARA MÍ» en la ventanita del día (sin modelo ni esfuerzo, «todo el día» en el mes, la hora tocada en la semana,
//     REPETIR como tus tareas) y la capa TUYAS, que ve al instante lo que se apunta;
//   · el panel de la oficina (T): «PARA MÍ» en el menú de departamento y la línea «Lo tuyo hoy · N», que abre Tareas → Mías → Hoy;
//   · Ajustes → Estado (O): sin botón propio en el dock, la luz en el engranaje (solo en ámbar o rojo) y el engranaje que abre ahí.
//   node scripts/lo-tuyo-recorrido.mjs   → ✓/✗ por paso y capturas en data/capturas/lo-tuyo/, a 1512 (claro y oscuro) y 390
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'lo-tuyo'); fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const css = (page, sel, prop = 'display') => page.$eval(sel, (e, p) => getComputedStyle(e)[p], prop);

async function oficina() {
  const claude = http.createServer((rq, rs) => { rq.resume(); rq.on('end', () => { rs.writeHead(500); rs.end('{}'); }); });
  const cport = await listen(claude);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-lotuyo-')), data = path.join(dir, 'data'), brain = path.join(dir, 'brain');
  fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, ANTHROPIC_API_KEY: 'test-key-not-real', // secrets-ok
    TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', METRICOOL_USER_ID: '', GEMINI_API_KEY: '', HF_KEY: '', FAL_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await espera(250); }
  const api = async (ruta, m = 'GET', b) => (await fetch(base + ruta, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json();
  return { base, api, cerrar: () => { srv.kill(); claude.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

async function calendario(page, o, tag, movil) {
  await page.keyboard.press('p'); await page.waitForSelector('#calOv.on'); await page.waitForTimeout(700);
  if (movil) { await page.click('#calOv [data-v="month"]'); await page.waitForTimeout(400); }
  const off = movil ? 6 : 0, dia = n => ymd(new Date(Date.now() + (n + off) * 864e5));
  const abrir = async d => { await page.click(`#calOv .cv-day[data-day="${d}"]`, { position: { x: 8, y: 30 } }); await page.waitForSelector('#cvPop:not([hidden]) .cv-dept'); };
  await abrir(dia(3));
  step((await page.$$eval('#cvPop .cv-dept option', l => l.map(x => x.value)))[0] === 'yo', `${tag}: calendario — «PARA MÍ» es la primera opción del día`);
  await page.selectOption('#cvPop .cv-dept', 'yo'); await page.waitForTimeout(150);
  step(await css(page, '#cvPop .cv-model') === 'none' && await css(page, '#cvPop .cv-moreopt') === 'none' && await page.$eval('#cvPop .cv-time', s => s.value) === '', `${tag}: calendario — sin modelo ni esfuerzo, y «todo el día» en el mes`);
  await page.fill('#cvPop .cv-text', 'Llamar al banco'); await page.click('#cvPop .cv-go'); await page.waitForTimeout(1500);
  const t = (await o.api(`/api/tareas/mias?desde=${dia(3)}&hasta=${dia(3)}`)).tareas.find(x => x.title === 'Llamar al banco');
  step(t && t.limite === dia(3) && !t.agent && t.person === 'Tú', `${tag}: calendario — nace tarea tuya para ese día, sin agente (${t?.limite})`);
  step((await page.$$eval('#calOv .cv-ev.mia', l => l.map(x => x.textContent))).some(x => /Llamar al banco/.test(x)), `${tag}: calendario — la capa TUYAS la enseña al instante`);
  await page.screenshot({ path: path.join(OUT, `${tag}-calendario.png`) });
  await abrir(dia(4));
  step(await page.$eval('#cvPop .cv-dept', s => s.value) === 'yo', `${tag}: calendario — la ventanita recuerda «Para mí»`);
  await page.click('#cvPop .cv-rep'); await page.waitForTimeout(100);
  step(await css(page, '#cvPop .cv-cadm') !== 'none' && await css(page, '#cvPop .cv-cad:not(.cv-cadm)') === 'none' && await css(page, '#cvPop .cv-ok') === 'none', `${tag}: calendario — REPETIR ofrece cada día, semana o mes (como tus tareas), sin «visto bueno»`);
  await page.fill('#cvPop .cv-text', 'Revisar la caja'); await page.click('#cvPop .cv-go'); await page.waitForTimeout(1500);
  const r = (await o.api(`/api/tareas/mias?desde=${dia(4)}&hasta=${dia(4)}`)).tareas.find(x => x.title === 'Revisar la caja');
  step(r && (await o.api(`/api/tareas/${r.id}`)).tarea.repetir?.cada === 'semana', `${tag}: calendario — se repite cada semana`);
  await abrir(dia(5)); await page.selectOption('#cvPop .cv-dept', 'sales'); await page.waitForTimeout(150);
  step(await css(page, '#cvPop .cv-model') !== 'none' && !(await page.$('#cvPop .cv-time option[value=""]')), `${tag}: calendario — con un departamento, lo de siempre`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  if (!movil) {
    await page.click('#calOv [data-v="week"]'); await page.waitForTimeout(500);
    await page.click(`#calOv .cv-day[data-day="${dia(3)}"][data-hour="15"]`, { position: { x: 5, y: 5 } }); await page.waitForSelector('#cvPop:not([hidden]) .cv-dept'); await page.selectOption('#cvPop .cv-dept', 'yo');
    await page.fill('#cvPop .cv-text', 'Reunión con el proveedor'); await page.click('#cvPop .cv-go'); await page.waitForTimeout(1500);
    const h = (await o.api(`/api/tareas/mias?desde=${dia(3)}&hasta=${dia(3)}`)).tareas.find(x => x.title === 'Reunión con el proveedor');
    step(h?.limite === `${dia(3)}T15:00`, `${tag}: calendario — en la semana, la hora que tocaste (${h?.limite})`);
    await page.click('#calOv [data-v="month"]');
  }
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  if (await page.$('#calOv.on')) { await page.click('#calOv .cv-x, #calOv [data-act="close"]').catch(() => {}); await page.waitForTimeout(300); }
}

async function panel(page, o, tag) {
  if (await page.$eval('body', b => b.classList.contains('tpMin'))) { await page.click('#tpTab'); await page.waitForTimeout(300); }
  await page.click('#tpanel .tp-dd'); await page.waitForTimeout(150);
  step((await page.$$eval('#tpMenu [data-k]', l => l.map(b => b.dataset.k)))[0] === 'yo', `${tag}: panel — «PARA MÍ» es lo primero del menú`);
  await page.click('#tpMenu [data-k="yo"]'); await page.waitForTimeout(150);
  step(await page.$eval('#tpanel .tp-ddn', x => x.textContent) === 'PARA MÍ' && await css(page, '#tpanel .tp-model') === 'none' && await css(page, '#tpanel .tp-rep') === 'none' && await css(page, '#tpanel .tp-team') === 'none', `${tag}: panel — dice PARA MÍ, sin modelo, REPETIR ni EQUIPO`);
  const titulo = `Firmar el contrato ${tag}`;
  await page.fill('#tpanel .tp-in', `${titulo} para hoy !alta`); await page.waitForTimeout(150);
  step(/Tuya.*prioridad alta.*Mías/.test(await page.$eval('#tpanel .tp-hint', x => x.textContent)), `${tag}: panel — la pista dice lo que entendió`);
  await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
  const t = (await o.api('/api/tareas/mias')).listas.hoy.pendientes.find(x => x.title === titulo);
  step(t && !t.agent && t.prioridad === 'alta' && t.limite === ymd(new Date()), `${tag}: panel — nace tuya, sin agente, para hoy y alta`);
  await page.waitForFunction(() => !document.querySelector('#tpanel .tp-mias').hidden, null, { timeout: 12000 }).catch(() => {});
  step(/Lo tuyo hoy · \d/.test(await page.$eval('#tpanel .tp-mias', b => b.hidden ? '' : b.textContent)), `${tag}: panel — aparece «Lo tuyo hoy · N»`);
  await page.screenshot({ path: path.join(OUT, `${tag}-panel.png`) });
  await page.click('#tpanel .tp-mias'); await page.waitForSelector('#tvOv.on [data-mlista="hoy"][aria-current="true"]', { timeout: 10000 }).then(() => step(true, `${tag}: panel — un clic abre Tareas → Mías → Hoy`), () => step(false, `${tag}: panel — un clic abre Tareas → Mías → Hoy`));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.click('#tpanel .tp-dd'); await page.click('#tpMenu [data-k="sales"]'); await page.waitForTimeout(150);
  step(await css(page, '#tpanel .tp-rep') !== 'none', `${tag}: panel — con un departamento vuelve lo de siempre`);
}

async function estado(page, o, tag, movil) {
  const st = await o.api('/api/status');
  step(!(await page.$('#topHealth')), `${tag}: Estado — ya no tiene botón propio en el dock`);
  const luz = await page.$eval('#topSettings', b => b.dataset.state);
  step(luz === st.overall, `${tag}: Estado — el engranaje lleva la luz (${luz})`);
  await page.evaluate(() => document.activeElement?.blur()); // los atajos de una letra no cuentan mientras escribes
  await page.keyboard.press('o'); await page.waitForSelector('#setOv.on'); await page.waitForTimeout(900);
  step(await page.$eval('#setOv [role=tab][aria-selected="true"]', x => x.textContent) === 'Estado' && (await page.$$('#setOv .hl-row')).length >= 8 && await page.$eval('#setOv [data-a="save"]', b => b.hidden), `${tag}: Estado — O abre Ajustes en «Estado», sin Guardar`);
  await page.screenshot({ path: path.join(OUT, `${tag}-estado.png`) });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  if (movil) return;
  await page.route('**/api/status', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...st, overall: 'bad', checks: [{ id: 'x', label: 'Claude', state: 'bad', detail: 'Sin sesión' }, ...st.checks.slice(1)] }) }));
  await page.click('#topSettings'); await page.click('#setOv [data-tab="estado"]'); await page.click('#setOv [data-a="probe"]'); await page.waitForTimeout(1500);
  await page.click('#setOv [data-tab="apariencia"]'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  step(await page.$eval('#topSettings .hl-badge', e => getComputedStyle(e).backgroundColor) === 'rgb(179, 38, 30)', `${tag}: Estado — con algo en rojo, punto rojo en el engranaje`);
  await page.click('#topSettings'); await page.waitForTimeout(300);
  step(await page.$eval('#setOv [role=tab][aria-selected="true"]', x => x.textContent) === 'Estado', `${tag}: Estado — y el engranaje abre en «Estado»`);
  await page.keyboard.press('Escape'); await page.unroute('**/api/status');
}

let browser;
try {
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  for (const [w, h, tema] of [[1512, 900, 'light'], [1512, 900, 'dark'], [390, 844, 'light']]) {
    const tag = `${w}-${tema}`, movil = w < 500, o = await oficina();
    try {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: movil, isMobile: movil }); const page = await ctx.newPage();
      const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.goto(o.base + '/'); await page.waitForTimeout(2500);
      if (tema === 'dark') await page.evaluate(() => document.body.classList.add('dark'));
      await calendario(page, o, tag, movil); await panel(page, o, tag); await estado(page, o, tag, movil);
      step(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `${tag}: nada se sale a lo ancho`);
      step(!errs.length, `${tag}: sin errores en la página${errs.length ? ': ' + errs[0] : ''}`);
      await ctx.close();
    } finally { o.cerrar(); }
  }
} catch (e) { fails++; console.log('✗ ' + e.message); }
finally { await browser?.close(); }
console.log(fails ? `\n✗ ${fails} paso(s) fallaron · capturas en ${path.relative(ROOT, OUT)}` : `\n✓ todo bien · capturas en ${path.relative(ROOT, OUT)}`);
process.exit(fails ? 1 : 0);
