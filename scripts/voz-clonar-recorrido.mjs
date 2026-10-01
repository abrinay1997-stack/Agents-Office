// Herramienta de desarrollo (no entra en `npm run check`): clonar una voz EN EL NAVEGADOR, sin gastar. Una oficina en una carpeta temporal
// habla con un MiniMax SIMULADO (tests/minimax-stand.mjs, key falsa) y Chrome usa un micrófono simulado (un pitido).
//   node scripts/voz-clonar-recorrido.mjs   → ✓/✗ por paso y capturas en data/capturas/voz-clonar/
// Pasos: Voces → Clonar · Grabar 12 s con el micrófono → la grabación queda en la galería (WAV, «Grabaciones de voz») y elegida ·
// Clonar → MiniMax recibe el WAV y la voz queda en «tus voces» · subir un fragmento de 7 min → queda en 5:00 · uno de 5 s → se rechaza.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { standIn, KEY } from '../tests/minimax-stand.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'voz-clonar'); fs.mkdirSync(OUT, { recursive: true });
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
try {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 900 } }); await ctx.grantPermissions(['microphone'], { origin: base });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(base + '/'); await page.waitForTimeout(1500);
  await page.keyboard.press('e'); await page.waitForSelector('#studioOv .st-vocbtn'); await page.click('#studioOv .st-vocbtn');
  await page.waitForSelector('#studioOv .st-vocov:not([hidden]) [data-vo="rec"]', { state: 'attached', timeout: 10000 });
  await page.evaluate(() => { const d = [...document.querySelectorAll('#studioOv .st-vocov details')].find(x => /Clonar/.test(x.textContent)); d.open = true; });
  // 1 · grabar 12 s
  await page.click('#studioOv [data-vo="rec"]');
  await page.waitForFunction(() => /0:0[3-9]|0:1/.test(document.querySelector('#studioOv .st-vrect')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  const live = await page.evaluate(() => ({ t: document.querySelector('#studioOv .st-vrect').textContent, lv: document.querySelector('#studioOv .st-vlvl i').style.width, b: document.querySelector('#studioOv [data-vo="rec"]').textContent }));
  step(/de 5:00/.test(live.t) && /Parar/.test(live.b), `grabando: «${live.t}», botón «${live.b}», nivel ${live.lv}`);
  await page.screenshot({ path: path.join(OUT, 'grabando.png') });
  await page.waitForTimeout(9500); await page.click('#studioOv [data-vo="rec"]');
  await page.waitForFunction(() => /Grabación guardada/.test(document.querySelector('#studioOv .st-vlen')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
  const after = await page.evaluate(() => ({ len: document.querySelector('#studioOv .st-vlen').textContent, sel: document.querySelector('#studioOv .st-vca').value, prev: !document.querySelector('#studioOv .st-vprev').hidden }));
  let m = await media(); const rec = m.items.find(i => i.file === after.sel); const fRec = m.folders.find(f => f.name === 'Grabaciones de voz');
  const recBuf = rec ? fs.readFileSync(path.join(brain, 'Agents Office', 'media', rec.file)) : null;
  step(!!rec && /\.wav$/.test(rec.file) && rec.folder === fRec?.id, `la grabación quedó en la galería: ${rec ? rec.file : '—'} en «Grabaciones de voz»`);
  step(recBuf && recBuf.readUInt32LE(24) === 24000 && Math.abs(wavSeconds(recBuf) - 12) < 2, `es un WAV de 24 kHz de ~12 s (${recBuf ? wavSeconds(recBuf).toFixed(1) : '?'} s) y está elegida con su reproductor (${after.prev})`);
  step(/Dura 0:1/.test(after.len), `lo que dice: «${after.len}»`);
  await page.screenshot({ path: path.join(OUT, 'grabada.png') });
  // 2 · clonar
  await page.fill('#studioOv .st-vcn', 'Mi voz de prueba');
  await page.click('#studioOv [data-vo="clone"]');
  await page.waitForFunction(() => /Clonada/.test(document.querySelector('#studioOv .st-vcres')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
  const up = mm.seen.find(x => x.path === '/v1/files/upload'), cl = mm.seen.find(x => x.path === '/v1/voice_clone');
  step(!!up && /\.wav/.test(up.raw) && !!cl, `MiniMax recibió el WAV (${up ? 'subida' : 'sin subida'}) y la clonación (${cl ? cl.body.voice_id : '—'})`);
  const voces = await (await fetch(base + '/api/voces')).json();
  step(voces.voices.some(v => v.name === 'Mi voz de prueba' && v.kind === 'clone'), 'la voz está en «tus voces»');
  await page.screenshot({ path: path.join(OUT, 'clonada.png') });
  // 3 · subir un fragmento de 7 min → 5:00
  await page.setInputFiles('#studioOv .st-vcf', long);
  await page.waitForFunction(() => /primeros 5:00/.test(document.querySelector('#studioOv .st-vlen')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
  const big = await page.evaluate(() => ({ len: document.querySelector('#studioOv .st-vlen').textContent, sel: document.querySelector('#studioOv .st-vca').value }));
  m = await media(); const bigIt = m.items.find(i => i.file === big.sel); const bigBuf = bigIt ? fs.readFileSync(path.join(brain, 'Agents Office', 'media', bigIt.file)) : null;
  step(bigBuf && Math.abs(wavSeconds(bigBuf) - 300) < 0.5 && bigBuf.length < 20 * 1024 * 1024, `7 min subidos → ${bigBuf ? wavSeconds(bigBuf).toFixed(1) + ' s, ' + (bigBuf.length / 1048576).toFixed(1) + ' MB' : '—'}: «${big.len}»`);
  // 4 · uno de 5 s se rechaza sin subir nada
  const before = (await media()).items.length;
  await page.setInputFiles('#studioOv .st-vcf', tiny);
  await page.waitForFunction(() => document.querySelector('#studioOv .st-vlen')?.classList.contains('bad'), null, { timeout: 10000 }).catch(() => {});
  const small = await page.evaluate(() => document.querySelector('#studioOv .st-vlen').textContent);
  step(/al menos 10 segundos/.test(small) && (await media()).items.length === before, `5 s → «${small}» (nada subido)`);
  await page.screenshot({ path: path.join(OUT, 'corto.png') });
  // 5 · cerrar el panel a mitad de una grabación no deja nada
  await page.click('#studioOv [data-vo="rec"]'); await page.waitForTimeout(2500); await page.keyboard.press('Escape'); await page.waitForTimeout(800);
  step((await media()).items.length === before, 'cerrar el panel mientras graba no guarda nada');
  step(!errs.length, `sin errores en la página${errs.length ? ': ' + errs[0] : ''}`);
  step(!mm.seen.some(x => /api\.minimax\.io/.test(x.raw)) && !log.includes(KEY), 'la key nunca sale en el registro de la oficina');
} finally { await browser.close(); srv.kill(); await mm.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
console.log(`\n${fails ? fails + ' paso(s) fallaron' : 'todo bien'} · capturas en ${path.relative(ROOT, OUT)}`);
if (fails) { console.log(log.split('\n').slice(-10).join('\n')); process.exitCode = 1; }
