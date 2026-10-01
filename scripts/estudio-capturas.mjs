// Herramienta de desarrollo (no entra en `npm run check`): abre el visor del Estudio con imágenes grandes (4K horizontal,
// 9:16 vertical y 21:9 panorámica) en varios anchos, claro y oscuro, guarda una captura de cada uno y MIDE si la imagen
// cabe entera en la pantalla (el visor no debe cortarla nunca).
//   node scripts/estudio-capturas.mjs antes     → data/capturas/estudio-antes/  (+ informe.json)
//   node scripts/estudio-capturas.mjs despues   → data/capturas/estudio-despues/
// Levanta su propia oficina en una carpeta temporal (como `npm run check`): nunca toca las tareas ni la galería del dueño.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [nombre = 'antes'] = process.argv.slice(2);
const OUT = path.join(ROOT, 'data', 'capturas', 'estudio-' + nombre);
const ANCHOS = [[1512, 900], [1366, 768], [1024, 768], [390, 844]];
const FOTOS = [['4k', 3840, 2160], ['vertical', 2160, 3840], ['panoramica', 5040, 2160]];

/** Un PNG de w×h con un degradado y un marco de 40 px: si el visor corta un borde, el marco lo delata en la captura. */
function png(w, h) {
  const row = w * 3 + 1, raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) { raw[y * row] = 0; for (let x = 0; x < w; x++) { const o = y * row + 1 + x * 3, edge = x < 40 || y < 40 || x >= w - 40 || y >= h - 40; raw[o] = edge ? 230 : (x * 255 / w) | 0; raw[o + 1] = edge ? 40 : (y * 255 / h) | 0; raw[o + 2] = edge ? 40 : 160; } }
  const T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  const crc = b => { let r = -1; for (const x of b) r = T[(r ^ x) & 255] ^ (r >>> 8); return (r ^ -1) >>> 0; };
  const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 1 })), chunk('IEND', Buffer.alloc(0))]);
}

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-capturas-'));
const brain = path.join(sandbox, 'brain'), media = path.join(brain, 'Agents Office', 'media', '2026-09');
fs.mkdirSync(media, { recursive: true });
fs.writeFileSync(path.join(brain, 'index.md'), '# Prueba\n');
FOTOS.forEach(([id, w, h], i) => {
  const file = `2026-09/2026-09-30 ${id} 10000${i}.png`;
  fs.writeFileSync(path.join(brain, 'Agents Office', 'media', file), png(w, h));
  fs.writeFileSync(path.join(brain, 'Agents Office', 'media', file.replace(/\.png$/, '.json')), JSON.stringify({ id: file, file, kind: 'image', ext: 'png', at: Date.now() - i * 1000, w, h, prompt: `Imagen ${id} ${w}×${h}`, provider: 'prueba', model: 'prueba', modelName: 'Prueba', by: 'you' }));
});

const port = 4900 + Math.floor(Math.random() * 90);
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), AO_DATA: path.join(sandbox, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(sandbox, 'local.json'), TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://localhost:${port}`;
let up = false; for (let i = 0; i < 60 && !up; i++) { try { up = (await fetch(base + '/api/health')).ok; } catch {} if (!up) await new Promise(r => setTimeout(r, 250)); }
if (!up) { srv.kill(); throw new Error('la oficina de prueba no arrancó: ' + log.slice(-400)); }

fs.mkdirSync(OUT, { recursive: true });
const informe = [];
const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
let browser; // el Chromium de Playwright, o el Chrome de la máquina (como `npm run check`)
try { browser = await chromium.launch({ executablePath: process.env.AO_CHROME || undefined, args: ARGS }); }
catch { browser = await chromium.launch({ channel: 'chrome', args: ARGS }); }
try {
  for (const tema of ['light', 'dark']) for (const [w, h] of ANCHOS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500, reducedMotion: 'reduce' });
    await ctx.addInitScript(t => { try { localStorage.setItem('ao.theme', JSON.stringify(t)); localStorage.setItem('ao.theme.raw', t); } catch {} }, tema);
    const page = await ctx.newPage();
    await page.goto(base + '/'); await page.waitForTimeout(1500);
    await page.evaluate(t => { document.body.classList.toggle('dark', t === 'dark'); document.documentElement.dataset.theme = t; }, tema);
    await page.keyboard.press('e'); await page.waitForTimeout(600);
    if (w < 700) { await page.click('#studioOv [data-pt="gal"]').catch(() => {}); await page.waitForTimeout(300); }
    await page.waitForSelector('#studioOv .st-thumb', { timeout: 10000 });
    for (const [id] of FOTOS) {
      await page.evaluate(i => { const b = [...document.querySelectorAll('#studioOv .st-card')].find(c => c.dataset.f.includes(' ' + i + ' ')); b.querySelector('.st-thumb').click(); }, id);
      await page.waitForSelector('#studioOv .st-light:not([hidden]) .st-lmedia img');
      await page.waitForFunction(() => { const im = document.querySelector('#studioOv .st-light .st-lmedia img'); return im && im.complete && im.naturalWidth > 0; });
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => {
        const im = document.querySelector('#studioOv .st-light .st-lmedia img'), r = im.getBoundingClientRect(), box = im.closest('.st-lmedia').getBoundingClientRect();
        // lo que se ve de verdad de la imagen: el rectángulo dibujado por object-fit dentro de la caja del <img>
        const s = Math.min(r.width / im.naturalWidth, r.height / im.naturalHeight), dw = im.naturalWidth * s, dh = im.naturalHeight * s;
        const x0 = r.left + (r.width - dw) / 2, y0 = r.top + (r.height - dh) / 2;
        const vis = { l: Math.max(x0, box.left, 0), t: Math.max(y0, box.top, 0), r: Math.min(x0 + dw, box.right, innerWidth), b: Math.min(y0 + dh, box.bottom, innerHeight) };
        const shown = Math.max(0, vis.r - vis.l) * Math.max(0, vis.b - vis.t) / (dw * dh);
        return { img: [Math.round(r.width), Math.round(r.height)], drawn: [Math.round(dw), Math.round(dh)], box: [Math.round(box.width), Math.round(box.height)], visible: Math.round(shown * 1000) / 10 };
      });
      const fits = m.visible >= 99.5;
      informe.push({ tema, ancho: w, foto: id, ...m, cabe: fits });
      console.log(`${fits ? '✓' : '✗'} ${tema.padEnd(5)} ${String(w).padStart(4)} px · ${id.padEnd(10)} · se ve ${m.visible} % (dibujada ${m.drawn.join('×')}, caja ${m.box.join('×')})`);
      await page.screenshot({ path: path.join(OUT, `visor-${tema}-${w}-${id}.png`) });
      if (id === 'vertical' && await page.$('#studioOv .st-light [data-z="real"]')) { // V4.9: el zoom al 100 %, las teclas y el panel Editar
        await page.click('#studioOv .st-light [data-z="real"]'); await page.waitForTimeout(200);
        const z = await page.evaluate(() => { const L = document.querySelector('#studioOv .st-light'), im = L.querySelector('.st-lstage img'), st = im.parentElement.getBoundingClientRect(), r = im.getBoundingClientRect();
          return { pct: L.querySelector('.st-zpct').textContent.trim(), zoomed: L.classList.contains('st-zoomed'), cubre: r.left <= st.left + 1 && r.right >= st.right - 1 && r.top <= st.top + 1 && r.bottom >= st.bottom - 1 }; });
        console.log(`  ${z.pct === '100 %' && z.zoomed ? '✓' : '✗'} 100 %: marca «${z.pct}», ${z.cubre ? 'la imagen llena el escenario' : 'la imagen NO llena el escenario'}`);
        informe.push({ tema, ancho: w, foto: id, prueba: 'zoom-100', ...z, cabe: z.pct === '100 %' && z.zoomed });
        await page.screenshot({ path: path.join(OUT, `zoom100-${tema}-${w}-${id}.png`) });
        await page.keyboard.press('0'); await page.waitForTimeout(100);
        const back = await page.evaluate(() => document.querySelector('#studioOv .st-light .st-zpct').textContent.trim());
        await page.keyboard.press('+'); await page.waitForTimeout(100);
        const mas = await page.evaluate(() => document.querySelector('#studioOv .st-light').classList.contains('st-zoomed'));
        await page.keyboard.press('0'); await page.waitForTimeout(100);
        console.log(`  ${mas ? '✓' : '✗'} teclas: 0 vuelve a «${back}», + acerca`); informe.push({ tema, ancho: w, foto: id, prueba: 'teclas', cabe: mas });
        await page.click('#studioOv .st-light [data-l="edit"]'); await page.waitForSelector('#studioOv .st-light .st-lpanel'); await page.waitForTimeout(200);
        const ed = await page.evaluate(() => { const P = document.querySelector('#studioOv .st-light .st-lpanel'); return { focus: P.contains(document.activeElement), off: !!P.querySelector('.st-edoff'), go: !!P.querySelector('.st-edgo') }; });
        console.log(`  ${ed.go && ed.focus ? '✓' : '✗'} panel Editar abierto${ed.off ? ' (sin motor de edición: dice cuál activar)' : ''}, foco dentro: ${ed.focus}`);
        informe.push({ tema, ancho: w, foto: id, prueba: 'editar', ...ed, cabe: ed.go && ed.focus });
        await page.screenshot({ path: path.join(OUT, `editar-${tema}-${w}-${id}.png`) });
        await page.keyboard.press('Escape'); await page.waitForTimeout(100); // cierra el panel; el siguiente Escape, el visor
      }
      await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    }
    await ctx.close();
  }
} finally {
  await browser.close(); srv.kill(); fs.rmSync(sandbox, { recursive: true, force: true });
}
fs.writeFileSync(path.join(OUT, 'informe.json'), JSON.stringify(informe, null, 1));
const malas = informe.filter(x => !x.cabe), fotos = informe.filter(x => !x.prueba);
console.log(`\n${fotos.filter(x => x.cabe).length} de ${fotos.length} caben enteras · ${malas.length ? malas.length + ' pruebas fallaron' : 'zoom, teclas y Editar bien'} · capturas en ${path.relative(ROOT, OUT)}`);
process.exitCode = malas.length ? 1 : 0;
