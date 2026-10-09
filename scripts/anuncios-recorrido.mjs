// Herramienta de desarrollo (no entra en `npm run check`): la vista ANUNCIOS en el navegador (Fase A1, 9 oct 2026). Abre la demo
// (file://, datos de ejemplo rotulados) a 1512 en claro y oscuro, a 1024 con Dimitri al lado y a 390; recorre Resumen, Campañas (rango,
// filtros, desplegar, el detalle de un anuncio rechazado, Esc) e Historial; mide objetivos de 24 px, letra ≥ 10,5 px y que nada se salga
// a lo ancho; y comprueba que el dock cabe a 390, 360 y 320 px con el aviso «⚠ N» encendido (Anuncios va en el «⋯»).
// Fase A2 (9 oct 2026), también en la demo (en memoria, con las reglas del servidor): pausar → DESHACER; activar → la ventana con la
// cifra → «Sí» → activa; subir el presupuesto de una que aprende → el aviso antes del «Sí»; pasar el tope → el motivo con la cifra y no
// cambia nada; el menú «⋯» con el teclado; el historial con lo hecho y el filtro por quién. La tarjeta de gasto de Dimitri no se puede
// simular en la demo (Dimitri necesita la oficina): la prueban tests/anuncios-vista.test.mjs y el servidor.
// Si además hay una oficina que ya sirve /api/anuncios y /anuncios-vista.js (serve.mjs con la Fase A1), abre una temporal sin Meta:
// la tarjeta de conexión y «Ver con datos de ejemplo». Si no, lo dice y sigue con la demo.
//   node scripts/anuncios-recorrido.mjs   → capturas en data/capturas/anuncios/ y ✓/✗ por paso
//   AO_AXE=<ruta a axe.min.js> además pasa axe en cada pestaña
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'anuncios'); fs.mkdirSync(OUT, { recursive: true });
const PAGINA = 'file://' + path.join(ROOT, 'dist', 'command-centre-v2.html').replace(/\\/g, '/');
let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
if (!fs.existsSync(path.join(ROOT, 'dist', 'anuncios-vista.js'))) { console.log('✗ falta dist/anuncios-vista.js: node build.mjs'); process.exit(1); }

const medir = page => page.evaluate(() => {
  const ov = document.getElementById('anuOv');
  const vis = b => b.offsetParent && b.getClientRects().length;
  const peq = [...ov.querySelectorAll('button, select, input:not([type=hidden]), [role=tab]')].filter(vis).map(b => [b, b.getBoundingClientRect()]).filter(([, r]) => r.height < 23.5 || r.width < 23.5).map(([b, r]) => `${b.className || b.tagName}:${Math.round(r.width)}x${Math.round(r.height)}`);
  const hs = document.documentElement.scrollWidth > innerWidth + 1;
  const letra = [...ov.querySelectorAll('*')].filter(n => n.offsetParent && [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())).filter(n => parseFloat(getComputedStyle(n).fontSize) < 10.5).map(n => n.className || n.tagName);
  return { peq: peq.slice(0, 5), npeq: peq.length, hs, letra: letra.slice(0, 5), nletra: letra.length };
});
const ok24 = (m, tag, que) => step(!m.npeq && !m.hs && !m.nletra, `${tag}: ${que} — objetivos de 24 px, sin desplazamiento a lo ancho, letra ≥ 10,5${m.npeq ? ' · pequeños: ' + m.peq.join(' ') : ''}${m.hs ? ' · se sale' : ''}${m.nletra ? ' · letra: ' + m.letra.join(' ') : ''}`);

async function abrir(page) {
  const movil = await page.evaluate(() => innerWidth <= 440);
  if (movil) { await page.click('#topMore'); await page.click('#topMoreMenu [data-for="topAnuncios"]'); }
  else await page.click('#topAnuncios');
  await page.waitForSelector('#anuOv .anu-kpis, #anuOv .anu-conectar', { timeout: 15000 });
  await page.waitForTimeout(300);
}

const txt = (page, s) => page.textContent(s).then(t => (t || '').replace(/\s/g, ' '));
const visible = (page, s) => page.$eval(s, n => !n.hidden && !n.closest('[hidden]') && n.getClientRects().length > 0).catch(() => false);
/** Fase A2 en la demo: cada acción hace lo que dice, y lo que gasta no pasa sin los dos clics ni por encima del tope. */
async function a2(page, tag, w, pasaAxe) {
  if (w === 1024) { await page.click('#topDimitri'); await page.waitForTimeout(800); }
  await page.click('#anuOv [data-tab="campanas"]'); await page.waitForTimeout(250);
  if (await page.$('#anuOv [data-cerrardet]')) { await page.click('#anuOv [data-cerrardet]'); await page.waitForTimeout(150); }
  // 1 · pausar: un clic, con DESHACER
  await page.click('#anuOv .anu-int[data-acc="pausar"][data-id="ej-c-2"]'); await page.waitForSelector('#anuOv .anu-toast:not([hidden]) [data-deshacer]', { timeout: 5000 });
  const tt = await txt(page, '#anuOv .anu-toast');
  step(/Pausaste/.test(tt) && /DESHACER \d+ s/.test(tt) && /En pausa/.test(await txt(page, '#anuOv [data-fila="ej-c-2"]')) && !!await page.$('#anuOv .anu-int[data-acc="reanudar"][data-id="ej-c-2"]'), `${tag}: A2 · «Pausar» es un clic: la fila dice «En pausa», el interruptor «Reanudar», y sale DESHACER con su cuenta atrás`);
  step(!await page.$('#anuOv .anu-fondo:not([hidden])'), `${tag}: A2 · pausar no pide confirmación`);
  ok24(await medir(page), tag, 'A2 · el aviso con DESHACER');
  await page.screenshot({ path: path.join(OUT, `${tag}-a2-deshacer.png`) });
  await pasaAxe('A2 · el aviso con DESHACER');
  await page.click('#anuOv [data-deshacer]'); await page.waitForTimeout(400);
  step(/Activa/.test(await txt(page, '#anuOv [data-fila="ej-c-2"]')) && !!await page.$('#anuOv .anu-int[data-acc="pausar"][data-id="ej-c-2"]') && /Deshecho/.test(await txt(page, '#anuOv .anu-toast')), `${tag}: A2 · DESHACER la deja como estaba`);
  // 2 · activar: el primer clic NO activa; la ventana dice la cifra; «Sí» activa
  await page.click('#anuOv .anu-int[data-acc="activar"][data-id="ej-c-4"]'); await page.waitForSelector('#anuOv .anu-fondo:not([hidden]) [data-dlg="si"]', { timeout: 5000 });
  const si = (await txt(page, '#anuOv [data-dlg="si"]')).trim(), dt = await txt(page, '#anuOv .anu-dlg');
  step(/^Sí, activar — hasta 10,00 US\$ al día$/.test(si) && /70,00 US\$ esta semana/.test(dt) && /Esta semana/.test(dt) && /Hasta fin de mes/.test(dt), `${tag}: A2 · «Activar» abre la confirmación con la cifra («${si}»), y las cifras del día, la semana, el mes y la campaña`);
  step(/En pausa/.test(await txt(page, '#anuOv [data-fila="ej-c-4"]')), `${tag}: A2 · el primer clic no activó nada`);
  step(await page.$eval('#anuOv .anu-dlg', d => d.getAttribute('role') === 'dialog' && d.getAttribute('aria-modal') === 'true' && !!document.getElementById(d.getAttribute('aria-labelledby'))) && await page.evaluate(() => document.querySelector('#anuOv .anu-main').closest('[inert]') !== null || document.querySelector('#anuOv .anu').inert), `${tag}: A2 · la confirmación es una ventana (role="dialog") y lo de detrás queda inerte`);
  ok24(await medir(page), tag, 'A2 · la confirmación');
  await page.screenshot({ path: path.join(OUT, `${tag}-a2-confirmar.png`) });
  await pasaAxe('A2 · la confirmación');
  await page.click('#anuOv [data-dlg="si"]'); await page.waitForTimeout(500);
  step(!await visible(page, '#anuOv .anu-fondo') && /Activa/.test(await txt(page, '#anuOv [data-fila="ej-c-4"]')) && /Activaste/.test(await txt(page, '#anuOv .anu-toast')) && !!await page.$('#anuOv .anu-int[data-acc="pausar"][data-id="ej-c-4"]'), `${tag}: A2 · «Sí» la activa: la fila dice «Activa» y su interruptor ya es «Pausar»`);
  // 3 · el menú «⋯» con el teclado; Esc lo cierra y el foco vuelve
  await page.focus('#anuOv [data-menu="ej-c-1"]'); await page.keyboard.press('Enter'); await page.waitForSelector('#anuOv .anu-menu-caja:not([hidden]) [role="menuitem"]', { timeout: 3000 });
  const f0 = await page.evaluate(() => document.activeElement?.getAttribute('role')); await page.keyboard.press('ArrowDown');
  const f1 = await page.evaluate(() => document.activeElement?.dataset?.acc);
  const notas = await txt(page, '#anuOv .anu-menu');
  step(f0 === 'menuitem' && !!f1 && /no se borra: se archiva/.test(notas) && /gasta/.test(notas), `${tag}: A2 · el «⋯» abre un menú con el teclado (foco en el primero, ↓ al siguiente: ${f1}); dice «gasta» y «no se borra: se archiva»`);
  ok24(await medir(page), tag, 'A2 · el menú');
  await page.screenshot({ path: path.join(OUT, `${tag}-a2-menu.png`) });
  await pasaAxe('A2 · el menú');
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  step(!await visible(page, '#anuOv .anu-menu-caja') && await page.evaluate(() => document.activeElement?.dataset?.menu) === 'ej-c-1' && await page.$eval('#anuOv', o => o.classList.contains('on')), `${tag}: A2 · Esc cierra el menú, el foco vuelve al «⋯» y Anuncios sigue abierta`);
  // 4 · subir el presupuesto de la que aprende: el aviso, ANTES del «Sí»
  await page.click('#anuOv [data-menu="ej-c-1"]'); await page.click('#anuOv .anu-menu [data-acc="subir_presupuesto"]'); await page.waitForSelector('#anuOv .anu-dlg [data-campo="valor"]', { timeout: 3000 });
  step(/8,00 US\$ al día/.test(await txt(page, '#anuOv .anu-dlg')) && /USD/.test(await txt(page, '#anuOv .anu-dlg')), `${tag}: A2 · el formulario dice el presupuesto de ahora y la moneda de la cuenta`);
  await page.fill('#anuOv [data-campo="valor"]', '12'); await page.click('#anuOv .anu-dform [type="submit"]'); await page.waitForSelector('#anuOv [data-dlg="si"]', { timeout: 5000 });
  const da = await txt(page, '#anuOv .anu-dlg'), iAviso = da.indexOf('reinicia el aprendizaje'), iSi = da.indexOf('Sí, subir');
  step(iAviso > 0 && iSi > iAviso && /hasta 12,00 US\$ al día/.test(da), `${tag}: A2 · subir más de un 20 % lo que aprende: sale el aviso antes del «Sí, subir — hasta 12,00 US$ al día» (no lo bloquea)`);
  await page.screenshot({ path: path.join(OUT, `${tag}-a2-aviso.png`) });
  await pasaAxe('A2 · el aviso de aprendizaje');
  await page.click('#anuOv [data-dlg="cancelar"]'); await page.waitForTimeout(250);
  step(/8,00 US\$ al día/.test(await txt(page, '#anuOv [data-fila="ej-c-1"]')) && await page.evaluate(() => document.activeElement?.closest?.('[data-fila="ej-c-1"]') != null), `${tag}: A2 · «Cancelar» no cambia nada y el foco vuelve a su fila`);
  // 5 · pasar el tope: el motivo con la cifra, y no cambia
  await page.click('#anuOv [data-menu="ej-c-1"]'); await page.click('#anuOv .anu-menu [data-acc="subir_presupuesto"]'); await page.waitForSelector('#anuOv .anu-dlg [data-campo="valor"]');
  await page.fill('#anuOv [data-campo="valor"]', '30'); await page.click('#anuOv .anu-dform [type="submit"]'); await page.waitForSelector('#anuOv .anu-dlg .anu-derr', { timeout: 5000 });
  const dtope = await txt(page, '#anuOv .anu-dlg');
  step(/No cabe en tus topes/.test(dtope) && /tope diario es 30,00 US\$/.test(dtope) && /Quedaría en/.test(dtope) && !await page.$('#anuOv [data-dlg="si"]'), `${tag}: A2 · pasar el tope: el motivo con su cifra, sin «Sí» ni atajo`);
  ok24(await medir(page), tag, 'A2 · el tope');
  await page.screenshot({ path: path.join(OUT, `${tag}-a2-tope.png`) });
  await pasaAxe('A2 · el tope');
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  step(!await visible(page, '#anuOv .anu-fondo') && /8,00 US\$ al día/.test(await txt(page, '#anuOv [data-fila="ej-c-1"]')) && await page.$eval('#anuOv', o => o.classList.contains('on')), `${tag}: A2 · Esc cierra la ventana; el presupuesto sigue en 8,00 US$ y Anuncios abierta`);
  // 6 · el historial lo cuenta
  await page.click('#anuOv [data-tab="historial"]'); await page.waitForTimeout(300);
  const hi = await txt(page, '#anuOv .anu-hist');
  step(/Tú activó la campaña · Reseñas/.test(hi) && /pausó la campaña/.test(hi) && /deshizo/.test(hi) && /Antes: En pausa → Después: Activa/.test(hi), `${tag}: A2 · el Historial cuenta lo hecho: quién, qué, antes → después`);
  await page.click('#anuOv [data-quien="dimitri"]'); await page.waitForTimeout(150);
  step(!/activó/.test(await txt(page, '#anuOv .anu-hist')) && /Dimitri/.test(await txt(page, '#anuOv .anu-hist')), `${tag}: A2 · el filtro «Dimitri» deja solo lo suyo`);
  ok24(await medir(page), tag, 'A2 · el Historial');
  await page.screenshot({ path: path.join(OUT, `${tag}-a2-historial.png`) });
  await pasaAxe('A2 · el Historial');
  await page.click('#anuOv [data-quien="todos"]');
  // 7 · desde el detalle y desde el Resumen
  await page.click('#anuOv [data-tab="resumen"]'); await page.waitForTimeout(250);
  step(!!await page.$('#anuOv .anu-tarj [data-acc="pausar"][data-id="ej-c-4"]'), `${tag}: A2 · la tarjeta del Resumen de la recién activada trae su interruptor`);
  if (w === 1024) { await page.click('#topDimitri'); await page.waitForTimeout(400); }
}

let browser;
try {
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  const axe = process.env.AO_AXE && fs.existsSync(process.env.AO_AXE) ? fs.readFileSync(process.env.AO_AXE, 'utf8') : null;
  if (process.env.AO_AXE && !axe) console.log(`· AO_AXE=${process.env.AO_AXE} no existe: sin axe`);
  for (const [w, h, tema] of [[1512, 900, 'light'], [1512, 900, 'dark'], [1024, 768, 'light'], [390, 844, 'light']]) {
    if (process.env.AO_SOLO && process.env.AO_SOLO !== `${w}-${tema}`) continue;
    const tag = `${w}-${tema}`, movil = w < 500; let pagina = null; const errs = [];
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: movil, isMobile: movil, colorScheme: tema });
    try {
      const page = await ctx.newPage(); pagina = page; page.on('pageerror', e => errs.push(e.message));
      await page.addInitScript(() => { try { localStorage.removeItem('ao.anu.tab'); localStorage.removeItem('ao.anu.filtro'); } catch {} });
      await page.goto(PAGINA + '?s=check', { timeout: 90000 }); await page.waitForTimeout(2500);
      if (tema === 'dark') await page.evaluate(() => document.body.classList.add('dark'));
      await abrir(page);
      step(await page.$eval('#anuOv', o => o.classList.contains('on')) && await page.evaluate(() => document.body.classList.contains('anuOpen')), `${tag}: Anuncios se abre como vista`);
      step(await page.$eval('#anuOv .anu-ejemplo', e => !e.hidden && /EJEMPLO/.test(e.textContent)), `${tag}: la demo va rotulada «EJEMPLO»`);
      step(await page.$eval(`#topAnuncios`, b => b.getAttribute('aria-pressed')) === 'true' || movil, `${tag}: el botón del dock queda pulsado`);
      const kpis = await page.$$eval('#anuOv .anu-kpi', l => l.length), avisos = await page.$$eval('#anuOv .anu-avisos li', l => l.length), tarj = await page.$$eval('#anuOv .anu-tarj', l => l.length);
      step(kpis === 4 && avisos >= 2 && tarj === 2, `${tag}: Resumen — 4 cifras, ${avisos} avisos y ${tarj} campañas activas`);
      step(/US\$/.test(await page.textContent('#anuOv .anu-kpis')), `${tag}: el dinero lleva su moneda`);
      ok24(await medir(page), tag, 'Resumen');
      await page.screenshot({ path: path.join(OUT, `${tag}-resumen.png`) });
      if (axe) { await page.addScriptTag({ content: axe }); }
      const pasaAxe = async que => { if (!axe) return; const r = await page.evaluate(async () => (await window.axe.run('#anuOv', { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(v => `${v.id}(${v.nodes.length}) ${v.nodes[0]?.target?.join(' ') || ''}`)); step(!r.length, `${tag}: axe en ${que}${r.length ? ': ' + r.join(' ') : ''}`); };
      await pasaAxe('Resumen');
      // Campañas: una tarjeta del Resumen abre su campaña
      await page.click('#anuOv [data-abrircamp="ej-c-1"]'); await page.waitForSelector('#anuOv .anu-det:not([hidden]) .anu-dh', { timeout: 5000 });
      step(await page.$eval('#anuTab-campanas', b => b.getAttribute('aria-selected')) === 'true', `${tag}: el nombre de una tarjeta lleva a Campañas con su detalle`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      step(await page.$eval('#anuOv .anu-det', d => d.hidden) && await page.$eval('#anuOv', o => o.classList.contains('on')), `${tag}: Esc cierra el detalle y deja Anuncios abierta`);
      // desplegar campaña → conjunto → anuncio
      if (!await page.$('#anuOv [data-fila="ej-as-1"]')) await page.click('#anuOv [data-tog="ej-c-1"]');
      await page.click('#anuOv [data-tog="ej-as-1"]'); await page.waitForTimeout(200);
      const filas = await page.$$eval('#anuOv .anu-fila', l => l.map(f => f.dataset.fila));
      step(filas.includes('ej-as-1') && filas.includes('ej-ad-12'), `${tag}: la tabla se despliega campaña → conjunto → anuncio (${filas.length} filas)`);
      await page.click('#anuOv [data-abrir="ej-ad-12"]'); await page.waitForSelector('#anuOv .anu-det:not([hidden]) .anu-crea', { timeout: 5000 });
      const det = await page.textContent('#anuOv .anu-det');
      step(/Rechazado/.test(det) && /condición personal/.test(det) && await page.$('#anuOv .anu-det img'), `${tag}: el detalle del anuncio rechazado: miniatura, texto y lo que dijo la revisión`);
      ok24(await medir(page), tag, 'Campañas con el detalle');
      await page.screenshot({ path: path.join(OUT, `${tag}-detalle.png`) });
      await pasaAxe('el detalle');
      await page.click('#anuOv [data-cerrardet]'); await page.waitForTimeout(200);
      step(await page.evaluate(() => document.activeElement?.dataset?.abrir) === 'ej-ad-12', `${tag}: al cerrar el detalle, el foco vuelve al nombre que lo abrió`);
      // rango y filtros
      const gasto7 = await page.$eval('#anuOv [data-fila="ej-c-1"] td[data-l="Gasto"]', t => t.textContent);
      await page.click('#anuOv [data-rango="30d"]'); await page.waitForTimeout(400);
      const gasto30 = await page.$eval('#anuOv [data-fila="ej-c-1"] td[data-l="Gasto"]', t => t.textContent);
      step(gasto7 !== gasto30 && /US\$/.test(gasto30), `${tag}: el rango cambia las cifras (${gasto7.trim()} → ${gasto30.trim()})`);
      await page.click('#anuOv [data-filtro="pausa"]'); await page.waitForTimeout(200);
      const enPausa = await page.$$eval('#anuOv .anu-fila.n-campana', l => l.map(f => f.dataset.fila));
      step(enPausa.length === 2 && enPausa.includes('ej-c-3') && enPausa.includes('ej-c-4') && /En pausa/.test(await page.textContent('#anuOv [data-fila="ej-c-3"]')) && /creado fuera/.test(await page.textContent('#anuOv [data-fila="ej-c-3"]')), `${tag}: «En pausa» deja la campaña en pausa, escrito y con «creado fuera»`);
      await page.click('#anuOv [data-filtro="problemas"]'); await page.waitForTimeout(200);
      step((await page.$$eval('#anuOv .anu-fila.n-campana', l => l.length)) === 2, `${tag}: «Con problemas» deja las dos con un anuncio rechazado o con problemas`);
      await page.click('#anuOv [data-filtro="todas"]'); await page.click('#anuOv [data-rango="7d"]'); await page.waitForTimeout(300);
      ok24(await medir(page), tag, 'Campañas');
      if (movil) step(await page.$eval('#anuOv .anu-tabla thead', t => getComputedStyle(t).display === 'none'), `${tag}: en el teléfono la tabla se lee como tarjetas`);
      await page.screenshot({ path: path.join(OUT, `${tag}-campanas.png`) });
      await pasaAxe('Campañas');
      // Historial
      await page.click('#anuOv [data-tab="historial"]'); await page.waitForTimeout(300);
      step(/Dimitri/.test(await page.textContent('#anuOv .anu-hist')) && !!await page.$('#anuOv [data-quien="dimitri"]'), `${tag}: el Historial dice quién hizo cada cambio (y filtra por quién)`);
      await page.screenshot({ path: path.join(OUT, `${tag}-historial.png`) });
      await pasaAxe('Historial');
      // las pestañas con las flechas
      await page.focus('#anuTab-historial'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
      step(await page.evaluate(() => document.activeElement?.id) === 'anuTab-resumen', `${tag}: ← → recorren las pestañas`);
      // con Dimitri al lado
      if (w === 1024) {
        await page.click('#topDimitri'); await page.waitForTimeout(900);
        const l = await page.evaluate(() => { const r = document.getElementById('anuOv').getBoundingClientRect(); return { left: r.left, w: r.width }; });
        step(l.left > 300, `${tag}: con Dimitri abierto, la vista se corre (empieza en ${Math.round(l.left)} px, mide ${Math.round(l.w)})`);
        await page.click('#anuOv [data-tab="campanas"]'); await page.waitForTimeout(300);
        if (!await page.$('#anuOv [data-abrir="ej-ad-12"]')) { if (!await page.$('#anuOv [data-fila="ej-as-1"]')) await page.click('#anuOv [data-tog="ej-c-1"]'); await page.click('#anuOv [data-tog="ej-as-1"]'); }
        await page.click('#anuOv [data-abrir="ej-ad-12"]'); await page.waitForTimeout(300); await page.click('#topDimitri'); await page.waitForTimeout(400); await page.click('#topDimitri'); await page.waitForTimeout(900); // Dimitri lee «Viendo» al abrirse
        const viendo = await page.$eval('.sb-ctxl b', b => b.textContent).catch(() => '');
        step(/Anuncio «Combo lentes · antes y después»/.test(viendo), `${tag}: el chip «Viendo» de Dimitri dice lo abierto («${viendo}»)`);
        ok24(await medir(page), tag, 'Campañas con Dimitri al lado');
        await page.screenshot({ path: path.join(OUT, `${tag}-dimitri.png`) });
        await page.click('#topDimitri'); await page.waitForTimeout(400);
      }
      await a2(page, tag, w, pasaAxe);
      // la tecla J abre y cierra
      await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('j'); await page.waitForTimeout(400);
      step(!(await page.$eval('#anuOv', o => o.classList.contains('on'))), `${tag}: J cierra Anuncios`);
      await page.keyboard.press('j'); await page.waitForTimeout(500);
      step(await page.$eval('#anuOv', o => o.classList.contains('on')), `${tag}: J la vuelve a abrir`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      step(!(await page.$eval('#anuOv', o => o.classList.contains('on'))), `${tag}: Esc cierra Anuncios`);
      if (movil) { // el dock cabe con el aviso «⚠ N» encendido
        await page.evaluate(() => { const a = document.getElementById('topAppr'); a.style.display = ''; a.querySelector('span').textContent = '12'; });
        for (const ww of [390, 360, 320]) {
          await page.setViewportSize({ width: ww, height: 800 }); await page.waitForTimeout(250);
          const m = await page.evaluate(() => ({ over: [...document.querySelectorAll('#topdock button')].filter(b => b.getBoundingClientRect().width > 0).some(b => b.getBoundingClientRect().right > innerWidth - 4), visible: document.getElementById('topAnuncios').getBoundingClientRect().width > 0 }));
          step(!m.over && !m.visible, `${ww} px con «⚠ 12»: el dock cabe y Anuncios va en el «⋯»`);
        }
      }
      step(!errs.length, `${tag}: sin errores de la página${errs.length ? ': ' + errs[0] : ''}`);
    } catch (e) {
      fails++; console.log(`✗ ${tag}: ${e.message.split('\n')[0]}${errs.length ? ' · página: ' + errs[0] : ''}`);
      await pagina?.screenshot({ path: path.join(OUT, `${tag}-fallo.png`) }).catch(() => {});
    } finally { await ctx.close(); }
  }

  // servida, sin Meta: la tarjeta de conexión y «Ver con datos de ejemplo» (solo si serve.mjs ya sirve la Fase A1)
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-anuncios-ui-')), data = path.join(dir, 'data'), brain = path.join(dir, 'brain');
    fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
    const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
    const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_API_KEY: '', TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', FAL_KEY: '' };
    const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'ignore'] }), base = `http://127.0.0.1:${port}`;
    try {
      let arriba = false; for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) { arriba = true; break; } } catch {} await espera(250); }
      const a = arriba ? await fetch(base + '/api/anuncios?rango=7d').catch(() => null) : null, v = arriba ? await fetch(base + '/anuncios-vista.js').catch(() => null) : null;
      if (!a?.ok || !v?.ok) console.log(`· la oficina todavía no sirve la Fase A1 (/api/anuncios ${a?.status ?? '—'} · /anuncios-vista.js ${v?.status ?? '—'}): solo la demo`);
      else {
        const j = await a.json();
        const ctx = await browser.newContext({ viewport: { width: 1512, height: 900 } }), page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.goto(base + '/'); await page.waitForTimeout(2500); await abrir(page);
        if (!j.configurado) {
          step(!!await page.$('#anuOv .anu-conectar') && (!j.motivo || (await page.textContent('#anuOv .anu-conectar')).includes(j.motivo)), `servida sin Meta: la tarjeta de conexión dice el motivo («${j.motivo || '—'}»)`);
          await page.screenshot({ path: path.join(OUT, 'servida-conectar.png') });
          await page.click('#anuOv [data-a="ejemplo"]'); await page.waitForSelector('#anuOv .anu-kpis', { timeout: 5000 });
          step(await page.$eval('#anuOv .anu-ejemplo', e => !e.hidden) && !!await page.$('#anuOv [data-a="salir"]'), 'servida: «Ver con datos de ejemplo» rotula el ejemplo y deja salir');
          await page.click('#anuOv [data-a="salir"]'); await page.waitForSelector('#anuOv .anu-conectar', { timeout: 5000 });
          step(true, 'servida: «Salir del ejemplo» vuelve a la tarjeta de conexión');
        } else step(!!await page.$('#anuOv .anu-kpis'), 'servida: con Meta configurada se ve el Resumen');
        step(!errs.length, `servida: sin errores${errs.length ? ': ' + errs[0] : ''}`);
        await ctx.close();
      }
    } finally { srv.kill(); await espera(300); fs.rmSync(dir, { recursive: true, force: true }); }
  }
} catch (e) { fails++; console.log('✗ ' + e.message); }
finally { await browser?.close(); }
console.log(fails ? `\n✗ ${fails} paso(s) fallaron · capturas en ${path.relative(ROOT, OUT)}` : `\n✓ todo bien · capturas en ${path.relative(ROOT, OUT)}`);
process.exit(fails ? 1 : 0);
