// Herramienta de desarrollo (no entra en `npm run check`): clonar una voz EN EL NAVEGADOR, sin gastar. Una oficina en una carpeta temporal
// habla con un MiniMax SIMULADO (tests/minimax-stand.mjs, key falsa) y Chrome usa un micrófono simulado (un pitido).
//   node scripts/voz-clonar-recorrido.mjs   → ✓/✗ por paso y capturas en data/capturas/voz-clonar/ (1512, 1024 y 390 px, claro y oscuro)
// El flujo guiado del 1 oct 2026 (auditoría EST): Voces → «Clonar mi voz» → 1 Grabar (guion, medidor, un clic fuera o Esc no pierden
// nada) → 2 Escúchalo (aún no está en la galería) → 3 Nombre, permiso y precio → Clonar (la cabecera suma US$1.50, el id lo pone la
// oficina, la grabación queda en «Grabaciones de voz») → Probar esta voz · subir 7 min → 5:00 · 5 s → se rechaza · cerrar y volver.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { standIn, KEY } from '../tests/minimax-stand.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', process.env.AO_CAPTURAS || 'voz-clonar'); fs.mkdirSync(OUT, { recursive: true });
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));
function wav(seconds, rate = 8000) { // a tone, mono 16-bit
  const n = Math.round(seconds * rate), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / rate * 2 * Math.PI * 220) * 8000), 44 + i * 2);
  return b;
}
const wavSeconds = buf => buf.readUInt32LE(40) / (buf.readUInt32LE(28)); // data bytes / bytes per second

const mm = await standIn();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-clonar-')), brain = path.join(dir, 'brain'); fs.mkdirSync(brain, { recursive: true }); fs.writeFileSync(path.join(brain, 'index.md'), '# Prueba\n');
const long = path.join(dir, 'entrevista-larga.wav'), tiny = path.join(dir, 'corto.wav'); fs.writeFileSync(long, wav(420)); fs.writeFileSync(tiny, wav(5));
const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), MINIMAX_API_KEY: KEY, MINIMAX_API_BASE: mm.base, MINIMAX_GROUP_ID: '', TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '' };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
const media = async () => (await fetch(base + '/api/media')).json();

let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const ARGS = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
let browser; try { browser = await chromium.launch({ args: ARGS }); } catch { browser = await chromium.launch({ channel: 'chrome', args: ARGS }); }
const V = s => '#studioOv .st-vocov ' + s;
const txt = (page, s) => page.evaluate(q => document.querySelector(q)?.textContent || '', s);
try {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 900 } }); await ctx.grantPermissions(['microphone'], { origin: base });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(base + '/'); await page.waitForTimeout(1500);
  await page.keyboard.press('e'); await page.waitForSelector('#studioOv .st-vocbtn'); await page.click('#studioOv .st-vocbtn');
  await page.waitForSelector(V('[data-vo="go-clone"]'));
  const home = await page.evaluate(() => [...document.querySelectorAll('#studioOv .st-vcard b')].map(b => b.textContent));
  step(home.join('|') === 'Clonar mi voz|Diseñar una voz con palabras', `inicio con dos caminos: ${home.join(' · ')}`);
  await page.screenshot({ path: path.join(OUT, 'inicio.png') });
  await page.click(V('[data-vo="go-clone"]'));
  step(/1\. Graba o sube/.test(await txt(page, V('.st-vstepbody'))) && /1 a 2 minutos/.test(await txt(page, V('.st-vtip'))), 'paso 1 con el consejo corto');
  // 1 · grabar: el guion, el medidor; un clic fuera y Esc no pierden nada
  await page.click(V('[data-vo="rec"]'));
  await page.waitForFunction(() => /0:0[3-9]|0:1/.test(document.querySelector('#studioOv .st-vrect')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  const live = await page.evaluate(() => ({ t: document.querySelector('#studioOv .st-vrect').textContent, guion: (document.querySelector('#studioOv .st-vscript')?.textContent || '').length, zona: document.querySelector('#studioOv .st-vzone').textContent, b: document.querySelector('#studioOv [data-vo="rec-stop"]')?.textContent }));
  step(/de 5:00/.test(live.t) && live.guion > 600 && /Parar/.test(live.b || ''), `grabando: «${live.t}», guion de ${live.guion} caracteres, medidor «${live.zona}»`);
  await page.screenshot({ path: path.join(OUT, 'grabando.png') });
  const recUi = await page.evaluate(() => ({ back: !!document.querySelector('#studioOv .st-vback'), role: document.querySelector('#studioOv .st-vscript')?.getAttribute('role') }));
  step(!recUi.back && recUi.role === 'region', `mientras graba no hay «‹ Voces» que no responda; el guion es una región con nombre (${recUi.role})`);
  await page.mouse.click(5, 895); await page.waitForTimeout(300);
  step(await page.evaluate(() => !document.querySelector('#studioOv .st-vocov').hidden && !!document.querySelector('#studioOv [data-vo="rec-stop"]')), 'un clic fuera mientras graba no cierra ni borra nada');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const ask = await page.evaluate(() => ({ t: document.querySelector('#studioOv .st-vask')?.textContent || '', foco: document.activeElement?.dataset?.vo }));
  step(/Parar y guardar/.test(ask.t) && ask.foco === 'ask-keep', `Esc pregunta «${ask.t.slice(0, 50)}…» con «Guardar» enfocado`);
  await page.screenshot({ path: path.join(OUT, 'pregunta.png') });
  await page.click(V('[data-vo="ask-no"]'));
  await page.waitForTimeout(7500); await page.click(V('[data-vo="rec-stop"]'));
  await page.waitForSelector(V('[data-vo="next"]'), { timeout: 15000 }).catch(() => {});
  const s2 = await page.evaluate(() => ({ h: document.querySelector('#studioOv .st-vstepbody')?.textContent, checks: document.querySelector('#studioOv .st-vchecks')?.textContent || '', prev: !!document.querySelector('#studioOv .st-vprev')?.src }));
  let m = await media();
  step(/2\. Escúchalo/.test(s2.h || '') && /Dura 0:1/.test(s2.checks) && s2.prev, `paso 2: «${s2.checks.slice(0, 70)}…» con reproductor`);
  step(!m.items.some(i => i.kind === 'audio'), 'la toma aún no está en la galería (solo se guarda la que se clona)');
  await page.screenshot({ path: path.join(OUT, 'escuchalo.png') });
  // 3 · nombre, permiso, precio
  await page.click(V('[data-vo="next"]'));
  const s3 = await page.evaluate(() => ({ name: document.querySelector('#studioOv .st-vcn').value, id: document.querySelector('#studioOv .st-vci').value, miss: document.querySelector('#studioOv .st-vmiss').textContent, price: document.querySelector('#studioOv .st-vprice').textContent, go: document.querySelector('#studioOv [data-vo="clone"]').textContent }));
  step(s3.name === 'Mi voz' && /^Voz_MiVoz_/.test(s3.id) && /permiso/.test(s3.miss) && /US\$1\.50/.test(s3.price) && /US\$1\.50/.test(s3.go), `paso 3: nombre «${s3.name}», id «${s3.id}», «${s3.miss}», botón «${s3.go}»`);
  await page.click(V('[data-vo="clone"]'), { force: true }); await page.waitForTimeout(300); // aria-disabled: Playwright lo cree apagado, pero se pulsa y dice qué falta
  step(!mm.seen.some(x => x.path === '/v1/voice_clone') && await page.evaluate(() => document.activeElement?.classList.contains('st-vok')), 'sin el permiso no se clona: el foco va a la casilla');
  await page.screenshot({ path: path.join(OUT, 'nombre.png') });
  const headBefore = await txt(page, '#studioOv .st-budget');
  await page.check(V('.st-vok')); await page.click(V('[data-vo="clone"]'));
  await page.waitForSelector(V('.st-vdone'), { timeout: 20000 }).catch(() => {});
  const up = mm.seen.find(x => x.path === '/v1/files/upload'), cl = mm.seen.find(x => x.path === '/v1/voice_clone');
  step(!!up && /\.wav/.test(up.raw) && /^Voz_MiVoz_/.test(cl?.body?.voice_id || ''), `MiniMax recibió el WAV y la clonación (${cl ? cl.body.voice_id : '—'})`);
  const voces = await (await fetch(base + '/api/voces')).json();
  step(voces.voices.some(v => v.name === 'Mi voz' && v.kind === 'clone'), 'la voz está en «tus voces»');
  m = await media(); const rec = m.items.find(i => i.kind === 'audio'); const fRec = m.folders.find(f => f.name === 'Grabaciones de voz');
  const recBuf = rec ? fs.readFileSync(path.join(brain, 'Agents Office', 'media', rec.file)) : null;
  step(!!rec && rec.folder === fRec?.id && recBuf && recBuf.readUInt32LE(24) === 24000 && Math.abs(wavSeconds(recBuf) - 12) < 2.5, `la toma clonada quedó en «Grabaciones de voz»: WAV de 24 kHz, ${recBuf ? wavSeconds(recBuf).toFixed(1) : '?'} s`);
  await page.waitForTimeout(800);
  const headAfter = await txt(page, '#studioOv .st-budget'), done = await page.evaluate(() => ({ foco: document.activeElement?.classList.contains('st-vdone'), h: document.querySelector('#studioOv .st-vdone')?.textContent, players: document.querySelectorAll('#studioOv .st-vcompare audio').length }));
  step(/1\.50/.test(headAfter) && !/1\.50/.test(headBefore), `la cabecera suma el gasto al momento: «${headBefore}» → «${headAfter}»`);
  step(done.foco && /Lista: «Mi voz»/.test(done.h || '') && done.players === 2, `resultado «${done.h}» con el foco, original y clon para comparar`);
  await page.screenshot({ path: path.join(OUT, 'lista.png') });
  const t2a = () => mm.seen.filter(x => x.path === '/v1/t2a_v2').length, t2a0 = t2a();
  await page.evaluate(() => { const b = document.querySelector('#studioOv [data-vo="try"]'); b.click(); b.click(); b.click(); }); // tres clics impacientes
  const tryBusy = await page.evaluate(() => document.querySelector('#studioOv [data-vo="try"]').disabled);
  await page.waitForSelector(V('.st-vtryres audio'), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  step(await page.evaluate(() => !!document.querySelector('#studioOv .st-vtryres audio')) && mm.seen.some(x => x.path === '/v1/t2a_v2' && /voz clonada/.test(x.raw)), '«Probar esta voz» genera un audio corto con ella y lo reproduce');
  step(tryBusy && t2a() - t2a0 === 1 && await page.evaluate(() => !document.querySelector('#studioOv [data-vo="try"]').disabled), `tres clics en «Probar esta voz» = ${t2a() - t2a0} audio pagado; el botón descansa mientras genera y vuelve al terminar`);
  // 4 · subir 7 min → 5:00, en una sola frase
  await page.click(V('[data-vo="again"]'));
  await page.setInputFiles(V('.st-vcf'), long);
  await page.waitForSelector(V('.st-vchecks'), { timeout: 30000 }).catch(() => {});
  const big = await txt(page, V('.st-vchecks'));
  step(/Lo recorté a los primeros 5:00/.test(big) && (big.match(/5:00/g) || []).length === 1, `7 min subidos: «${big.slice(0, 80)}»`);
  // 5 · cerrar y volver: el audio sigue
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.click('#studioOv .st-vocbtn'); await page.waitForTimeout(400);
  step(/2\. Escúchalo/.test(await txt(page, V('.st-vstepbody'))), 'al cerrar y volver, el audio sigue en el paso 2');
  // 5b · «‹ Voces» en el paso 2, cerrar y volver: el inicio dice que hay un audio sin clonar y «Clonar mi voz» sigue ahí
  await page.click(V('.st-vback')); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.click('#studioOv .st-vocbtn'); await page.waitForTimeout(400);
  const pend = await txt(page, V('.st-vpend'));
  step(/audio sin clonar \(5:00\): continúa en el paso 2/.test(pend), `desde «‹ Voces» y cerrando, el inicio avisa: «${pend}»`);
  await page.screenshot({ path: path.join(OUT, 'pendiente.png') });
  await page.click(V('[data-vo="go-clone"]')); await page.waitForTimeout(200);
  step(/2\. Escúchalo/.test(await txt(page, V('.st-vstepbody'))), '«Clonar mi voz» sigue en el paso 2 con el mismo audio');
  // 6 · uno de 5 s se rechaza sin subir nada
  const before = (await media()).items.length;
  await page.click(V('[data-vo="redo"]'));
  await page.setInputFiles(V('.st-vcf'), tiny);
  await page.waitForFunction(() => !document.querySelector('#studioOv .st-verr')?.hidden, null, { timeout: 10000 }).catch(() => {});
  const small = await txt(page, V('.st-verr'));
  step(/al menos 10 segundos/.test(small) && (await media()).items.length === before, `5 s → «${small}» (nada subido)`);
  await page.screenshot({ path: path.join(OUT, 'corto.png') });
  // 7 · grabar y descartar a propósito
  await page.click(V('[data-vo="rec"]')); await page.waitForTimeout(2500); await page.keyboard.press('Escape'); await page.click(V('[data-vo="ask-drop"]')); await page.waitForTimeout(800);
  step((await media()).items.length === before && !!(await page.$(V('[data-vo="rec"]'))), 'descartar lo grabado no deja nada y vuelve a «Grabar»');
  // las capturas en los tres anchos, claro y oscuro (pasos 1 grabando y 3)
  for (const [w, h] of [[1024, 768], [390, 844]]) for (const dark of [false, true]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(d => document.body.classList.toggle('dark', d), dark); await page.waitForTimeout(200);
    await page.click(V('[data-vo="home"]')).catch(() => {}); await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, `inicio-${w}-${dark ? 'oscuro' : 'claro'}.png`) });
    const over = await page.evaluate(() => { const b = document.querySelector('#studioOv .st-vbox'); return b.scrollWidth > b.clientWidth + 1; });
    step(!over, `${w} ${dark ? 'oscuro' : 'claro'}: nada se sale de lado en el panel`);
  }
  // 8 · un id escrito a mano que la lista no conoce: la lista dice «Otra: <id>», nunca en blanco
  await page.setViewportSize({ width: 1512, height: 900 });
  await page.click(V('.st-vlist [data-vo="use"]')); await page.waitForTimeout(300);
  const sel = await page.evaluate(() => {
    const d = document.querySelector('#studioOv .st-vadv2'); if (d) d.open = true;
    const i = document.querySelector('#studioOv .st-vid'); i.value = 'raro_id_99'; i.dispatchEvent(new Event('change', { bubbles: true }));
    const s = document.querySelector('#studioOv .st-vsel'); return { v: s.value, i: s.selectedIndex, t: s.selectedOptions[0]?.textContent };
  });
  step(sel.v === 'raro_id_99' && sel.i >= 0 && sel.t === 'Otra: raro_id_99', `un id a mano: la lista muestra «${sel.t}»`);
  step(!errs.length, `sin errores en la página${errs.length ? ': ' + errs[0] : ''}`);
  step(!mm.seen.some(x => /api\.minimax\.io/.test(x.raw)) && !log.includes(KEY), 'la key nunca sale en el registro de la oficina');
} finally { await browser.close(); srv.kill(); await mm.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
console.log(`\n${fails ? fails + ' paso(s) fallaron' : 'todo bien'} · capturas en ${path.relative(ROOT, OUT)}`);
if (fails) { console.log(log.split('\n').slice(-10).join('\n')); process.exitCode = 1; }
