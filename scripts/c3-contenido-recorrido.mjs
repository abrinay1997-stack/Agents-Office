// Herramienta de desarrollo (no entra en `npm run check`): lo que faltaba de C2 y el C3 de Contenido (8 oct 2026) en el navegador, con la
// oficina de verdad (temporal, sin keys). Siembra dos piezas que ya salieron (una de hace 10 semanas, que puede VOLVER) con sus cifras de
// Analíticas, publicaciones hechas a mano, un borrador para mañana y una plantilla, y mira:
//   · el calendario: lo publicado fuera de las piezas (tarjeta de solo lectura), los resultados en la tarjeta de la pieza, la vista previa
//     al pasar, el filtro «Publicado fuera», la zona horaria y las mejores horas de UNA red;
//   · «Llenar la semana»: los huecos con su hora, lo que vuelve, crear (una copia en revisión y una tarea a Marketing) y «Ver en Programación»
//     con «Borradores de la semana» y su «Aprobar los N que pueden salir»;
//   · «Desde una plantilla» y «Guardar como plantilla» en el pie de una pieza; el selector de red de las mejores horas del editor.
// A 1512 (claro y oscuro), 1024 y 390 px. Mide letra (10,5 px) y desborde. Capturas en data/capturas/c3-contenido/.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { crearAlmacen } from '../contenido/piezas.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'c3-contenido'); fs.mkdirSync(OUT, { recursive: true });
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-c3-')), data = path.join(dir, 'data'), brain = path.join(dir, 'brain');
fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
const pad = n => String(n).padStart(2, '0'), ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dia = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const local = (f, h) => new Date(`${f}T${h}:00`).toISOString();
// las fotos del Estudio
const mes = new Date().toISOString().slice(0, 7), mdir = path.join(brain, 'Agents Office', 'media', mes); fs.mkdirSync(mdir, { recursive: true });
const fotos = [];
for (const [n, bg] of [['a', '#e66a2f'], ['b', '#2f7be6'], ['c', '#2fa36b']]) {
  fs.writeFileSync(path.join(mdir, `${n}.jpg`), await sharp({ create: { width: 1080, height: 1350, channels: 3, background: bg } }).jpeg().toBuffer());
  fs.writeFileSync(path.join(mdir, `${n}.json`), JSON.stringify({ file: `${mes}/${n}.jpg`, kind: 'image', model: 'upload', prompt: n, w: 1080, h: 1350, at: Date.now() }));
  fotos.push(`${mes}/${n}.jpg`);
}
// dos piezas que ya salieron: se aprueban «en su día» (el almacén con el reloj de entonces)
const contenidoDir = path.join(brain, 'Agents Office', 'contenido');
let T = 0; const alm = crearAlmacen({ dir: contenidoDir, medioExiste: () => true, ahora: () => T });
const pasada = (n, hora, o) => { T = new Date(`${dia(n)}T${hora}:00`).getTime() - 3 * 3600e3; const p = alm.crear({ fecha: dia(n), hora, estado: 'revision', ...o }).pieza; const r = alm.aprobar(p.id); if (r.error) throw new Error(r.error); return p; };
const vieja = pasada(-70, '19:00', { titulo: 'Antes y después de un examen visual', redes: ['instagram', 'facebook'], medios: [fotos[0]], texto: 'Así cambia tu día cuando ves bien: antes y después de un examen visual.' });
const reciente = pasada(-2, '12:00', { titulo: 'Kit de limpieza de regalo', redes: ['instagram'], medios: [fotos[1]], texto: 'Por la compra de tus lentes, un kit de limpieza de regalo.' });
// lo que Analíticas ya leyó de Meta: las dos piezas, una publicación hecha a mano ayer y unas cuantas más (para la mejor hora y la mediana)
const pubs = {}, pub = (id, red, f, h, texto, alcance, interacciones) => { pubs[`ig:x|${id}`] = { id: `ig:x|${id}`, cuentaId: 'ig:x', red, externoId: id, tipo: 'imagen', enlace: `https://www.instagram.com/p/${id}/`, texto, miniatura: '', publicadaAt: local(f, h), meGusta: Math.round(interacciones * 0.8), comentarios: 3, guardados: 2, compartidos: 1, alcance, vistas: alcance * 2, interacciones, actualizadaAt: new Date().toJSON() }; };
pub('V1', 'instagram', vieja.fecha, '19:02', vieja.texto, 3200, 260);
pub('R1', 'instagram', reciente.fecha, '12:01', reciente.texto, 1500, 120);
pub('M1', 'instagram', dia(-1), '19:10', 'Hecho a mano: el equipo en la tienda esta mañana.', 800, 40);
for (let i = 0; i < 9; i++) pub('H' + i, 'instagram', dia(-12 - i * 3), i % 2 ? '19:15' : '13:05', `Publicación de archivo ${i + 1}`, 300 + i * 10, 12 + i);
fs.mkdirSync(path.join(data, 'contenido', 'metricas'), { recursive: true }); fs.writeFileSync(path.join(data, 'contenido', 'metricas', 'publicaciones.json'), JSON.stringify(pubs));
const loc = path.join(dir, 'local.json'); fs.writeFileSync(loc, JSON.stringify({ contenido: { modo: 'simulacro', redes: ['instagram', 'facebook'] } }));
const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: loc, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_API_KEY: '', ANTHROPIC_BASE_URL: '', TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', METRICOOL_USER_ID: '' };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
const api = async (m, p, b) => (await fetch(base + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json();
const borr = (await api('POST', '/api/contenido/piezas', { titulo: 'Recordatorio del sábado', fecha: dia(1), hora: '18:00', formato: 'post', redes: ['facebook'], texto: 'El sábado abrimos de 9:00 a 14:00. Te esperamos.', estado: 'borrador' })).pieza;
await api('POST', '/api/contenido/plantillas', { nombre: 'Promo del mes', pieza: { formato: 'carrusel', redes: ['instagram', 'facebook'], texto: 'Este mes en PanaClaw: la promo. Válida hasta fin de mes.', hashtags: '#optica #panama' } });

let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const medir = sel => `(() => { const root = document.querySelector('${sel}'); if (!root) return { tiny: -1, fuera: true };
  const tiny = [...root.querySelectorAll('*')].filter(e => e.offsetParent && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) > 0 && parseFloat(getComputedStyle(e).fontSize) < 10.5).map(e => e.className || e.tagName).slice(0, 3);
  const r = root.querySelector('.ct-pickbox')?.getBoundingClientRect() || root.getBoundingClientRect();
  return { tiny: tiny.length, cuales: tiny, fuera: r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1, hscroll: document.documentElement.scrollWidth > innerWidth + 1 }; })()`;
let browser;
try {
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  for (const [w, h, tema] of [[1512, 900, 'light'], [1512, 900, 'dark'], [1024, 768, 'light'], [390, 844, 'light']]) {
    const tag = `${w}-${tema}`, completo = tag === '1512-light'; // lo que crea cosas, una sola vez
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: tema, reducedMotion: 'reduce', hasTouch: w < 500, isMobile: w < 500 }); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(t => { try { localStorage.setItem('ao.theme', t); localStorage.setItem('ao.onboarded', '1'); localStorage.setItem('ao.ct.mode', '"cal"'); } catch {} }, tema);
    await page.goto(base + '/'); await page.waitForTimeout(1500);
    await page.keyboard.press('Escape'); await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('k'); await page.waitForSelector('#ctOv .ct-mode', { state: 'visible' }); await page.waitForTimeout(500);
    const vista = async v => { const b = await page.$(`#ctOv .ct-views [data-v="${v}"]`); if (b && await b.isVisible()) await b.click(); else await page.selectOption('#ctOv .ct-vsel', v).catch(() => {}); await page.waitForTimeout(700); };
    // A. lo publicado en el mes
    await vista('month');
    if (!await page.$('#ctGrid .pz-pub')) { await page.click('#ctPrev'); await page.waitForTimeout(800); }
    const a = await page.evaluate(() => ({ pub: document.querySelectorAll('#ctGrid .pz-pub').length, aria: document.querySelector('#ctGrid .pz-pub')?.getAttribute('aria-label') || '', rs: [...document.querySelectorAll('#ctGrid .cv-ev.pz:not(.pz-pub) .pz-rs')].map(x => x.textContent.trim()), tz: document.querySelector('#ctStats .ct-tz')?.textContent || '' }));
    step(a.pub >= 1 && /Publicada en Instagram/.test(a.aria) && /de alcance/.test(a.aria), `${tag} mes: lo publicado a mano sale como tarjeta, con sus cifras para el lector de pantalla (${a.pub})`);
    step(a.rs.includes('1,5 mil'), `${tag} mes: la pieza que ya salió lleva su alcance (${a.rs.join(', ')})`);
    if (w >= 1024) step(/Horas de .+ · UTC[+−]\d\d:\d\d/.test(a.tz) && !/Horas de UTC/.test(a.tz), `${tag}: la zona horaria a la vista («${a.tz}»)`);
    await page.screenshot({ path: path.join(OUT, `${tag}-mes.png`) });
    // B. la vista previa al pasar, y el filtro
    if (w >= 1024) {
      await page.locator('#ctGrid .pz-pub').first().hover(); await page.waitForTimeout(700);
      const hv = await page.evaluate(() => { const x = document.querySelector('.ct-hov'); return { on: !x.hidden, t: x.textContent }; });
      step(hv.on && /PUBLICADA/.test(hv.t) && /NO SALIÓ DE UNA PIEZA/.test(hv.t) && /de alcance/.test(hv.t), `${tag}: al pasar por lo publicado, su texto y sus cifras`);
      await page.screenshot({ path: path.join(OUT, `${tag}-vistazo.png`) });
      await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    }
    if (!await page.isVisible('#ctChips [data-pub]')) { await page.click('[data-filters]'); await page.waitForTimeout(200); }
    await page.click('#ctChips [data-pub]'); await page.waitForTimeout(400);
    step(await page.evaluate(() => !document.querySelector('#ctGrid .pz-pub')), `${tag}: «Publicado fuera» apagado esconde esas tarjetas`);
    await page.click('#ctChips [data-pub]'); await page.waitForTimeout(400);
    if (await page.evaluate(() => document.querySelector('#ctOv').classList.contains('chipsOpen'))) await page.click('[data-filters]');
    // C. la semana: las mejores horas de UNA red
    if (w >= 1024) {
      await page.click('#ctToday'); await vista('week'); await page.waitForTimeout(600);
      const tiene = await page.$('#ctStats [data-horared]');
      step(!!tiene, `${tag} semana: «Mejores horas de [tus redes ▾]» junto a la leyenda`);
      if (tiene) {
        await page.selectOption('#ctStats [data-horared]', 'facebook'); await page.waitForTimeout(800);
        step(await page.evaluate(() => /sin datos para esa red todavía/.test(document.querySelector('#ctStats .ct-hbleg')?.textContent || '') && document.activeElement?.matches('[data-horared]')), `${tag}: Facebook no tiene todavía: lo dice, y el selector conserva el foco`);
        await page.selectOption('#ctStats [data-horared]', 'instagram'); await page.waitForTimeout(800);
        step(await page.evaluate(() => /Mejores horas de .*Instagram.*, según lo que ya publicaste/.test(document.querySelector('#ctStats .ct-hbleg')?.textContent || '')), `${tag}: Instagram sí: según lo ya publicado`);
        await page.selectOption('#ctStats [data-horared]', ''); await page.waitForTimeout(500);
      }
      await page.screenshot({ path: path.join(OUT, `${tag}-semana.png`) });
    }
    // D. Llenar la semana
    await page.click('#ctNew'); await page.waitForTimeout(200); await page.click('.ct-newmenu [data-llenar]');
    await page.waitForSelector('.ct-tool .ll-intro', { timeout: 15000 }); await page.waitForTimeout(400);
    const ll = await page.evaluate(() => ({ huecos: document.querySelectorAll('.ct-tool .ll-h').length, vu: [...document.querySelectorAll('.ct-tool .ll-vm b')].map(x => x.textContent), novu: !!document.querySelector('.ct-tool .ll-novu'), que: [...document.querySelectorAll('.ct-tool [data-ll-que]')].map(s => s.value), foco: document.activeElement?.matches('[data-ll="dias"]'), ok: document.querySelector('.ct-tool [data-a="ok"]')?.textContent }));
    if (completo) step(ll.huecos >= 3 && ll.vu.some(t => /Antes y después/.test(t)) && ll.que.some(v => v.startsWith('v:')) && ll.que.includes('marketing'), `${tag} Llenar la semana: ${ll.huecos} huecos con su hora, lo que vuelve («${ll.vu[0] || '—'}») ya repartido`);
    else step(ll.huecos >= 3 && !ll.vu.length && ll.novu && ll.que.every(v => v === 'marketing'), `${tag} Llenar la semana: ${ll.huecos} huecos; lo que volvió hace un momento no vuelve otra vez (8 semanas) y lo dice`);
    step(ll.foco && /^Crear \d+$/.test(ll.ok || ''), `${tag}: el foco en la ventana y el botón dice cuántas crea («${ll.ok}»)`);
    const m1 = await page.evaluate(medir('.ct-tool')); step(m1.tiny === 0 && !m1.fuera && !m1.hscroll, `${tag}: la ventana cabe y no tiene letra bajo 10,5 px${m1.tiny ? ' — ' + m1.cuales.join(', ') : ''}`);
    await page.screenshot({ path: path.join(OUT, `${tag}-llenar.png`) });
    if (completo) {
      await page.fill('.ct-tool [data-ll="pide"]', 'Esta semana empujamos el examen gratis.');
      await page.click('.ct-tool [data-a="ok"]'); await page.waitForSelector('.ct-tool .ll-hecho', { timeout: 15000 });
      const hecho = await page.textContent('.ct-tool .ll-hecho');
      step(/vuelve, en revisión/.test(hecho) && /pedidos? a Marketing: la tarea «Llenar la semana/.test(hecho), `${tag}: creado — lo que vuelve en revisión y la tarea para Marketing`);
      await page.screenshot({ path: path.join(OUT, `${tag}-llenar-hecho.png`) });
      await page.click('.ct-tool [data-a="ver"]'); await page.waitForTimeout(1200);
      const prog = await page.evaluate(() => ({ bor: !!document.querySelector('#ctp-bor'), btn: document.querySelector('[data-okbor]')?.textContent || '', vuelve: [...document.querySelectorAll('.ct-need .ct-rt')].map(x => x.textContent) }));
      step(prog.bor && /Aprobar el que puede salir|Aprobar los \d+ que pueden salir/.test(prog.btn), `${tag} Programación: «Borradores de la semana» con «${prog.btn}»`);
      step(prog.vuelve.some(t => /Antes y después/.test(t)), `${tag}: lo que vuelve espera tu OK en «Requiere tu acción»`);
      await page.screenshot({ path: path.join(OUT, `${tag}-programacion.png`) });
      await page.click('[data-okbor]'); await page.waitForTimeout(1200);
      step(/aprobado/.test(await page.textContent('#ctOv .cv-toast span')) && (await api('GET', `/api/contenido/piezas/${borr.id}`)).pieza.estado === 'aprobada', `${tag}: «Aprobar» los borradores que pueden salir: el del sábado queda aprobado`);
      const tareas = await api('GET', '/api/tasks'); step(tareas.some(t => /^Llenar la semana/.test(t.title) && /empujamos el examen gratis/.test(t.text)), `${tag}: la tarea de Marketing lleva los huecos y lo que pediste`);
      await page.click('#ctOv .ct-mode [data-m="cal"]'); await page.waitForTimeout(600);
    } else { await page.click('.ct-tool [data-a="x"]'); await page.waitForTimeout(300); step(!await page.$('.ct-tool'), `${tag}: Cancelar cierra la ventana`); }
    // E. Desde una plantilla
    await page.click('#ctNew'); await page.waitForTimeout(200); await page.click('.ct-newmenu [data-tplnew]');
    await page.waitForSelector('.ct-tool .tp-list, .ct-tool .ct-empty', { timeout: 15000 }); await page.waitForTimeout(300);
    step(await page.evaluate(() => [...document.querySelectorAll('.ct-tool .tp-i b')].some(b => b.textContent === 'Promo del mes')), `${tag} Desde una plantilla: la lista (nota del Cerebro)`);
    const m2 = await page.evaluate(medir('.ct-tool')); step(m2.tiny === 0 && !m2.fuera && !m2.hscroll, `${tag}: la ventana de plantillas cabe, letra ≥ 10,5 px`);
    await page.screenshot({ path: path.join(OUT, `${tag}-plantillas.png`) });
    if (completo) {
      await page.click('.ct-tool [data-usar="0"]'); await page.waitForTimeout(1500);
      await page.click('.ct-panel [data-a="cuando"]'); await page.waitForTimeout(600); // las mejores horas van en «cuándo sale»
      const ed = await page.evaluate(() => ({ texto: document.querySelector('.ct-panel [data-f="texto"]')?.value || '', hred: !!document.querySelector('.ct-panel [data-hred]') }));
      step(/Este mes en PanaClaw/.test(ed.texto), `${tag}: «Usar» abre una pieza nueva con su texto`);
      step(ed.hred, `${tag} editor: «Mejores horas de [sus 2 redes, juntas ▾]»`);
      await page.waitForTimeout(1200);
      step((await api('GET', `/api/contenido?desde=${dia(0)}&hasta=${dia(40)}`)).piezas.some(p => p.titulo === 'Promo del mes' && /Este mes en PanaClaw/.test(p.texto)), `${tag}: la pieza de la plantilla se guarda sola`);
      // F. «Guardar como plantilla» en el pie
      await page.click('.ct-panel [data-a="tpl"]'); await page.waitForTimeout(200);
      await page.fill('.ct-panel [data-tpl="nombre"]', 'Promo de octubre'); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
      step(/Plantilla «Promo de octubre» guardada/.test(await page.textContent('.ct-panel .pz-state')) && (await api('GET', '/api/contenido/plantillas')).plantillas.length === 2, `${tag}: «Guardar como plantilla» la deja en el Cerebro`);
      step(fs.existsSync(path.join(brain, 'Contenido', 'Plantillas', 'Promo de octubre.md')), `${tag}: es una nota: Contenido/Plantillas/Promo de octubre.md`);
      await page.screenshot({ path: path.join(OUT, `${tag}-editor-plantilla.png`) });
      await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    } else { await page.keyboard.press('Escape'); await page.waitForTimeout(300); step(!await page.$('.ct-tool') && await page.evaluate(() => document.body.classList.contains('ctOpen')), `${tag}: Esc cierra la ventana y deja Contenido abierto`); }
    step(!errs.length, `${tag}: sin errores de la página${errs.length ? ': ' + errs[0] : ''}`);
    await ctx.close();
  }
} catch (e) { fails++; console.log('✗ ' + e.message.split('\n')[0]); }
finally { await browser?.close(); srv.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
console.log(fails ? `✗ ${fails} paso(s) fallaron · capturas en ${path.relative(ROOT, OUT)}` : `✓ todo bien · capturas en ${path.relative(ROOT, OUT)}`);
if (fails && process.env.AO_LOG) console.log(log.slice(-3000));
process.exit(fails ? 1 : 0);
