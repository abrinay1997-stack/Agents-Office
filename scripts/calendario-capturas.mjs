// Herramienta de desarrollo (no entra en `npm run check`): captura el calendario en cada vista y ancho, con una hora fija, y guarda
// su HTML y una imagen. Se corre ANTES de tocar el motor del calendario y DESPUÉS; si el HTML no es idéntico, algo cambió.
//   node scripts/calendario-capturas.mjs guardar antes      → data/capturas/antes/
//   node scripts/calendario-capturas.mjs comparar antes     → captura de nuevo y compara con data/capturas/antes/
// Usa el Chromium que Playwright ya tiene (PLAYWRIGHT_BROWSERS_PATH) o el que diga AO_CHROME.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [modo = 'guardar', nombre = 'antes', vistaId = 'cal'] = process.argv.slice(2);
const OUT = path.join(ROOT, 'data', 'capturas', nombre);
const HORA = new Date('2026-09-30T10:20:00');
const ANCHOS = [[390, 844], [1024, 768], [1512, 900]];
const VISTAS = ['month', 'week', 'day', 'agenda'];

function chromePath() {
  if (process.env.AO_CHROME) return process.env.AO_CHROME;
  for (const p of ['/opt/pw-browsers/chromium']) if (existsSync(p)) return p;
  return undefined; // que Playwright lo encuentre solo
}

const ID = { cal: { boton: 'topCal', tecla: 'p', raiz: '#calOv', clase: 'calOpen' }, contenido: { boton: 'topContenido', tecla: 'k', raiz: '#ctOv', clase: 'ctOpen' } }[vistaId];
if (!ID) throw new Error('vista desconocida: ' + vistaId);

// Los datos fijos del calendario (se ejecuta DENTRO de la página): tareas de todas las clases y rutinas de todos los ritmos.
function datos({ hora, vista }) {
  const CC = window.CC, DAY = 864e5, agentes = {};
  for (const id of Object.keys(CC.R)) { const d = CC.R[id].a.dept; (agentes[d] ||= []).push(id); }
  const ag = (d, i = 0) => (agentes[d] || [])[i] || Object.values(agentes)[0][0];
  const t0 = new Date(hora); t0.setHours(0, 0, 0, 0); const dia = (n, h = 9, m = 0) => t0.getTime() + n * DAY + (h * 60 + m) * 60e3;
  const T = (id, o) => ({ id, sid: id, live: false, title: 'Tarea ' + id, text: 'Tarea ' + id, read: [], tools: [], used: [], result: '', addedAt: hora - DAY, changedAt: hora - 3600e3, ...o });
  const tareas = [
    T('a1', { state: 'done', dept: 'marketing', agent: ag('marketing'), title: 'Escribir la newsletter de septiembre', doneAt: dia(-1, 16, 5) }),
    T('a2', { state: 'done', dept: 'fin', agent: ag('fin'), title: 'Conciliar las facturas de la semana', doneAt: dia(0, 8, 30), error: true }),
    T('a3', { state: 'done', dept: 'sales', agent: ag('sales'), title: 'Responder a los leads de Instagram', doneAt: dia(-3, 11, 0), routine: 'r-diaria', due: dia(-3, 11, 0) }),
    T('b1', { state: 'scheduled', dept: 'marketing', agent: ag('marketing', 1), title: 'Calendario de octubre', dueAt: dia(2, 10, 0) }),
    T('b2', { state: 'scheduled', dept: 'delivery', agent: ag('delivery'), title: 'Entregar el informe al cliente', dueAt: dia(5, 15, 30) }),
    T('b3', { state: 'scheduled', dept: 'ops', agent: ag('ops'), title: 'Revisar los permisos de la oficina', dueAt: dia(9, 9, 0) }),
    T('c1', { state: 'doing', dept: 'sales', agent: ag('sales', 1), title: 'Preparar la propuesta de Dcasa' }),
    T('c2', { state: 'waiting', dept: 'emails', agent: ag('emails'), title: 'Borrador: respuesta a proveedores' }),
    T('c3', { state: 'next', dept: 'ops', agent: ag('ops', 1), title: 'Ordenar el archivo de contratos' }),
  ];
  const R = (id, o) => ({ id, title: 'Rutina ' + id, text: 'Rutina ' + id, desc: '', needsOk: true, paused: false, skips: [], nextAt: dia(1, 9), lastAt: null, model: '', ...o });
  const rutinas = [
    R('r-diaria', { title: 'Revisar la bandeja y decirme qué necesita de mí', dept: 'emails', agent: ag('emails'), when: { kind: 'daily', at: '08:00' }, nextAt: dia(1, 8) }),
    R('r-habil', { title: 'Resumen de ventas del día', dept: 'sales', agent: ag('sales'), when: { kind: 'weekdays', at: '17:30' }, nextAt: dia(0, 17, 30), needsOk: false }),
    R('r-lunes', { title: 'Planificar la semana de contenido', dept: 'marketing', agent: ag('marketing'), when: { kind: 'weekly', days: [1], at: '09:00' }, nextAt: dia(5, 9) }),
    R('r-horas', { title: 'Vigilar la cola de facturas', dept: 'fin', agent: ag('fin'), when: { kind: 'hourly', every: 1, from: '09:00', to: '17:00', weekdaysOnly: true }, nextAt: dia(0, 11), needsOk: false }),
    R('r-pausa', { title: 'Informe mensual de entrega', dept: 'delivery', agent: ag('delivery'), when: { kind: 'weekly', days: [5], at: '16:00' }, paused: true, nextAt: null }),
    R('r-salto', { title: 'Cierre de caja', dept: 'fin', agent: ag('fin', 1), when: { kind: 'weekly', days: [3], at: '18:00' }, skips: [dia(1, 18)], nextAt: dia(1, 18) }),
  ];
  const tk = CC.tasks; tk.tasks.length = 0; tk.tasks.push(...tareas); tk.routines.length = 0; tk.routines.push(...rutinas);
  if (vista === 'cal') tk.calendar.refresh();
  window.__captura = { tareas, rutinas };
}

const browser = await chromium.launch({ executablePath: chromePath(), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const fotos = {};
try {
  for (const [w, h] of ANCHOS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errores = []; page.on('pageerror', e => errores.push(process.env.AO_DEBUG ? e.stack : e.message));
    // Nada al azar y nada que avance solo: Math.random con semilla, y un reloj que solo corre cuando se le manda (la simulación de la
    // demo, los avisos y los minutos de «ahora» quedan quietos). Lo que se ve en el calendario sale de los datos de abajo.
    await page.addInitScript(() => { let a = 0x9E3779B9; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; });
    await page.clock.install({ time: HORA });
    await page.clock.pauseAt(new Date(HORA.getTime() + 1000));
    await page.goto('file://' + path.join(ROOT, 'dist', 'command-centre-v2.html') + '?s=captura', { timeout: 90000 });
    await page.waitForFunction(() => window.CC, null, { timeout: 60000 });
    await page.clock.runFor(3000);
    await page.evaluate(datos, { hora: HORA.getTime(), vista: vistaId });
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.click('#' + ID.boton);
    await page.waitForFunction(c => document.body.classList.contains(c), ID.clase, { timeout: 8000 });
    await page.waitForTimeout(700);
    for (const v of VISTAS) {
      const b = page.locator(`${ID.raiz} .cv-seg button[data-v="${v}"]`);
      if (!await b.count() || !await b.isVisible()) continue; // la agenda solo se ofrece en el teléfono
      await b.click(); await page.waitForTimeout(500);
      const html = await page.evaluate(sel => {
        const r = document.querySelector(sel); if (!r) return '';
        const c = r.cloneNode(true);
        c.querySelectorAll('.cv-nowline').forEach(n => n.removeAttribute('style')); // la hora está fija, pero el minuto cae donde caiga
        return c.outerHTML.replace(/\s+/g, ' ');
      }, ID.raiz);
      const k = `${w}-${v}`;
      fotos[k] = html;
      const png = await page.locator(ID.raiz).screenshot({ animations: 'disabled' });
      fotos[k + '.png'] = png;
    }
    if (errores.length) throw new Error(`errores en la página a ${w}px: ${errores[0]}`);
    await ctx.close();
  }
} finally { await browser.close(); }

if (modo === 'guardar') {
  mkdirSync(OUT, { recursive: true });
  for (const [k, v] of Object.entries(fotos)) writeFileSync(path.join(OUT, k.endsWith('.png') ? k : k + '.html'), v);
  console.log(`guardadas ${Object.keys(fotos).length} capturas en ${path.relative(ROOT, OUT)}`);
} else {
  if (!existsSync(OUT)) throw new Error('no hay capturas de referencia en ' + OUT);
  let bad = 0;
  for (const [k, v] of Object.entries(fotos)) {
    const f = path.join(OUT, k.endsWith('.png') ? k : k + '.html');
    if (!existsSync(f)) { console.log('✗', k, 'no estaba en la referencia'); bad++; continue; }
    const antes = readFileSync(f);
    const igual = k.endsWith('.png') ? Buffer.compare(antes, v) === 0 : antes.toString('utf8') === v;
    if (!igual && k.endsWith('.png')) { console.log('⚠', k, 'la imagen cambió (píxeles: puede ser el suavizado; lo que manda es el HTML)'); continue; }
    if (!igual) { bad++; console.log('✗', k, k.endsWith('.png') ? 'la imagen cambió' : 'el HTML cambió'); if (!k.endsWith('.png')) { const a = antes.toString('utf8'); let i = 0; while (i < a.length && a[i] === v[i]) i++; console.log('   primera diferencia:', JSON.stringify(a.slice(Math.max(0, i - 60), i + 80)), 'vs', JSON.stringify(v.slice(Math.max(0, i - 60), i + 80))); } }
    else console.log('✓', k);
  }
  const sobran = readdirSync(OUT).length - Object.keys(fotos).length; if (sobran > 0) console.log('(la referencia tiene', sobran, 'archivos más)');
  if (bad) { console.log(`\n${bad} diferencia(s)`); process.exit(1); }
  console.log('\nidéntico a la referencia');
}
