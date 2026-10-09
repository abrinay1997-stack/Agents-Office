// Herramienta de desarrollo (no entra en `npm run check`): la vista ANUNCIOS en el navegador (Fase A1, 9 oct 2026). Abre la demo
// (file://, datos de ejemplo rotulados) a 1512 en claro y oscuro, a 1024 con Dimitri al lado y a 390; recorre Resumen, Campañas (rango,
// filtros, desplegar, el detalle de un anuncio rechazado, Esc) e Historial; mide objetivos de 24 px, letra ≥ 10,5 px y que nada se salga
// a lo ancho; y comprueba que el dock cabe a 390, 360 y 320 px con el aviso «⚠ N» encendido (Anuncios va en el «⋯»).
// Fase A2 (9 oct 2026), también en la demo (en memoria, con las reglas del servidor): pausar → DESHACER; activar → la ventana con la
// cifra → «Sí» → activa; subir el presupuesto de una que aprende → el aviso antes del «Sí»; pasar el tope → el motivo con la cifra y no
// cambia nada; el menú «⋯» con el teclado; el historial con lo hecho y el filtro por quién. La tarjeta de gasto de Dimitri no se puede
// simular en la demo (Dimitri necesita la oficina): la prueban tests/anuncios-vista.test.mjs y el servidor.
// Fase A3 (9 oct 2026), en la demo: Borradores (de quién viene cada uno) → «+ Nueva campaña» → los 5 pasos (objetivo con su enlace,
// Advantage+ y el público manual, el costo máximo en palabras y el aviso sin fecha de fin, elegir de la galería, «✨ Mejorar» → Usar, las
// mejoras de Meta) → la revisión con problemas → un clic en uno lleva a su paso y a su campo → arreglado → la vista previa (feed e
// historia) → «Crear en Meta (en pausa)» → «Creado en pausa» → aparece EN PAUSA en Campañas. «Crear con el Estudio»: en la demo el
// Estudio no tiene galería (necesita la oficina), así que se prueba que abre «para el anuncio» con su barra y que «Volver al anuncio»
// devuelve al paso 4; elegir una imagen allí lo prueba la oficina servida.
// Fase A5 (9 oct 2026), en la demo: las 3 sugerencias del Resumen → «Ver todas» → aplicar la que pausa (un clic, DESHACER) → aplicar la
// de escalar (la ventana de la A2 con la cifra → «Sí») → descartar → posponer → Aplicadas con su resultado → el rechazado deja un borrador
// → Creativos con su estado escrito → «Pedir variaciones» → «Nueva campaña con este creativo».
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
  const peq = [...ov.querySelectorAll('button, select, input:not([type=hidden]), [role=tab]')].filter(vis).map(b => [b, ((b.type === 'radio' || b.type === 'checkbox') && b.closest('label') || b).getBoundingClientRect()]).filter(([, r]) => r.height < 23.5 || r.width < 23.5).map(([b, r]) => `${b.className || b.tagName}:${Math.round(r.width)}x${Math.round(r.height)}`);
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

/** Fase A3 en la demo: un borrador de punta a punta, hasta crearlo EN PAUSA. */
async function a3(page, tag, w, pasaAxe) {
  const movil = w < 500;
  if (w === 1024) { await page.click('#topDimitri'); await page.waitForTimeout(800); }
  if (await page.$('#anuOv [data-cerrardet]')) { await page.click('#anuOv [data-cerrardet]'); await page.waitForTimeout(150); }
  await page.click('#anuOv [data-tab="borradores"]'); await page.waitForSelector('#anuOv .anu-blista', { timeout: 5000 });
  const lista = await txt(page, '#anuOv .anu-blista');
  step(/De: Dimitri/.test(lista) && /\(agente\)/.test(lista) && /Creado en pausa/.test(lista) && /Costo máximo/.test(lista) && !!await page.$('#anuOv [data-vercamp="ej-c-4"]'), `${tag}: A3 · Borradores: de quién viene cada uno, su estado, su costo máximo y el creado enlaza a su campaña`);
  ok24(await medir(page), tag, 'A3 · Borradores');
  await page.screenshot({ path: path.join(OUT, `${tag}-a3-borradores.png`) });
  await pasaAxe('A3 · Borradores');
  // borrar pide el segundo clic en la fila
  await page.click('#anuOv [data-bborrar="ej-b-2"]'); await page.waitForSelector('#anuOv [data-bborrar-si="ej-b-2"]', { timeout: 3000 });
  await page.waitForFunction(() => document.activeElement?.dataset?.bborrarSi === 'ej-b-2', null, { timeout: 2000 }).catch(() => {}); // el foco llega a los 20 ms de pintar: se espera al hecho
  step(await page.evaluate(() => document.activeElement?.dataset?.bborrarSi) === 'ej-b-2' && /¿Borrar/.test(await txt(page, '#anuOv [data-bfila="ej-b-2"]')), `${tag}: A3 · «Borrar» pide el segundo clic en la misma fila (el foco va al «Sí, borrar»)`);
  await page.click('#anuOv [data-bborrar-no="ej-b-2"]'); await page.waitForTimeout(150);
  // 1 · objetivo
  await page.click('#anuOv .anu-bcab [data-a="nueva"]'); await page.waitForSelector('#anuOv .anu-asis', { timeout: 5000 });
  step(await page.$eval('#anuOv [data-paso="0"]', b => b.getAttribute('aria-current')) === 'step' && await page.$eval('#anuOv input[data-bc="objetivo"][value="mensajes"]', i => i.checked) && await page.$eval('#anuOv input[data-bc="destino"][value="whatsapp"]', i => i.checked) && await page.evaluate(() => document.activeElement?.id) === 'anuBPasoT',
    `${tag}: A3 · «+ Nueva campaña» abre el paso 1 con «Que me escriban» por WhatsApp marcado (el foco en el título del paso)`);
  if (movil) step(await page.$eval('#anuOv .anu-linea', n => getComputedStyle(n).display === 'none'), `${tag}: A3 · en el teléfono el asistente ocupa la vista`);
  await page.click('#anuOv label:has(input[data-bc="objetivo"][value="web"])'); await page.waitForSelector('#anuOv [data-bc="enlace"]', { timeout: 3000 });
  await page.fill('#anuOv [data-bc="enlace"]', 'https://panaclaw.example/otono');
  step(!await page.$('#anuOv [data-bc="destino"]'), `${tag}: A3 · «Visitas a mi web» pide la dirección y quita el destino`);
  ok24(await medir(page), tag, 'A3 · paso 1');
  await page.screenshot({ path: path.join(OUT, `${tag}-a3-paso1.png`) });
  await pasaAxe('A3 · paso 1');
  await page.click('#anuOv label:has(input[data-bc="objetivo"][value="mensajes"])'); await page.waitForTimeout(200);
  // 2 · público
  await page.click('#anuOv [data-bnav="1"]'); await page.waitForSelector('#anuOv [data-bmodo]', { timeout: 3000 });
  const p2 = await txt(page, '#anuOv .anu-paso');
  step(/Advantage\+: Meta busca a quién mostrarlo/.test(p2) && await page.$eval('#anuOv input[data-bc="categoriaEspecial"][value=""]', i => i.checked) && await page.$eval('#anuOv [data-bpais]', s => s.value) === 'PA' && await page.$eval('#anuOv [data-bc="publico.edadMin"]', i => i.value) === '18',
    `${tag}: A3 · paso 2: Advantage+ en Panamá, 18+, y la categoría especial siempre presente con «Ninguna» marcada`);
  await page.click('#anuOv [data-bmodo="manual"]'); await page.waitForSelector('#anuOv [data-bc="publico.intereses"]', { timeout: 3000 });
  await page.waitForFunction(() => document.activeElement?.dataset?.bmodo === 'advantage', null, { timeout: 2000 }).catch(() => {}); // el foco llega a los 20 ms de pintar
  step(await page.evaluate(() => document.activeElement?.dataset?.bmodo) === 'advantage', `${tag}: A3 · «Prefiero un público manual» trae los intereses (y el foco sigue en el botón, que ahora vuelve a Advantage+)`);
  ok24(await medir(page), tag, 'A3 · paso 2');
  await page.screenshot({ path: path.join(OUT, `${tag}-a3-paso2.png`) });
  await pasaAxe('A3 · paso 2');
  await page.click('#anuOv [data-bmodo="advantage"]'); await page.waitForTimeout(150);
  // 3 · presupuesto y fechas
  await page.click('#anuOv [data-bnav="1"]'); await page.waitForFunction(() => /hasta 5,00\sUS\$ al día/.test(document.querySelector('#anuOv [data-costo]')?.textContent || ''), null, { timeout: 5000 });
  step(/70,00\sUS\$ en total/.test(await page.textContent('#anuOv [data-costo]')), `${tag}: A3 · paso 3: el costo máximo en palabras («${(await txt(page, '#anuOv [data-costo]')).trim()}»)`);
  await page.click('#anuOv [data-bsinfin]'); await page.waitForSelector('#anuOv [data-avisofin]', { timeout: 3000 });
  step(/no cabe en tu tope por campaña/.test(await txt(page, '#anuOv [data-avisofin]')), `${tag}: A3 · sin fecha de fin y presupuesto diario: el aviso de que así no se podrá activar`);
  const fin = await page.evaluate(() => { const d = new Date(Date.now() + 13 * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  await page.fill('#anuOv [data-bc="fin"]', fin); await page.dispatchEvent('#anuOv [data-bc="fin"]', 'change');
  await page.fill('#anuOv [data-bc="presupuesto.usd"]', '50');
  await page.waitForFunction(() => /hasta 50,00\sUS\$ al día/.test(document.querySelector('#anuOv [data-costo]')?.textContent || ''), null, { timeout: 6000 }).catch(() => {});
  step(/hasta 50,00\sUS\$ al día/.test(await page.textContent('#anuOv [data-costo]')) && !await page.$('#anuOv [data-avisofin]'), `${tag}: A3 · cambiar el presupuesto se guarda solo y el costo máximo se vuelve a calcular`);
  ok24(await medir(page), tag, 'A3 · paso 3');
  await page.screenshot({ path: path.join(OUT, `${tag}-a3-paso3.png`) });
  await pasaAxe('A3 · paso 3');
  // 4 · creativos: de la galería, mejorar, las mejoras de Meta
  await page.click('#anuOv [data-bnav="1"]'); await page.waitForSelector('#anuOv [data-bgaleria]', { timeout: 3000 });
  await page.click('#anuOv [data-bgaleria]'); await page.waitForSelector('#anuOv .anu-fondo-gal:not([hidden]) [data-gfile]', { timeout: 5000 });
  step(await page.$eval('#anuOv .anu-dlg-gal', d => d.getAttribute('role') === 'dialog' && d.getAttribute('aria-modal') === 'true'), `${tag}: A3 · «Elegir de la galería» es una ventana`);
  await page.click('#anuOv [data-gfile="demo/anu-combo.jpg"]'); await page.click('#anuOv [data-gfile="demo/anu-cliente.jpg"]');
  ok24(await medir(page), tag, 'A3 · la galería');
  await page.screenshot({ path: path.join(OUT, `${tag}-a3-galeria.png`) });
  await pasaAxe('A3 · la galería');
  await page.click('#anuOv [data-gusar]'); await page.waitForSelector('#anuOv [data-bcr="1"]', { timeout: 3000 });
  step((await page.$$eval('#anuOv [data-bcr]', l => l.length)) === 2 && await page.$eval('#anuOv [data-bc="creativos.1.formato"]', s => s.value) === '9:16' && await page.$eval('#anuOv [data-bc="creativos.0.llamada"]', s => s.value) === 'WHATSAPP_MESSAGE',
    `${tag}: A3 · dos creativos de la galería, cada uno con su formato (9:16 para el alto) y la llamada del objetivo`);
  await page.fill('#anuOv [data-bc="creativos.0.texto"]', 'Lentes listos en 1 día, con examen incluido');
  await page.click('#anuOv [data-bmejorar="0"][data-campo="texto"]'); await page.waitForSelector('#anuOv [data-busar="0"]', { timeout: 5000 });
  const prop = await txt(page, '#anuOv .anu-bprop');
  step(/Propuesta de ANUNCIOS/.test(prop) && /Por qué/.test(prop) && await page.$eval('#anuOv [data-bc="creativos.0.texto"]', t => t.value) === 'Lentes listos en 1 día, con examen incluido', `${tag}: A3 · «✨ Mejorar» trae la propuesta con su porqué, sin tocar tu texto`);
  ok24(await medir(page), tag, 'A3 · paso 4');
  await page.screenshot({ path: path.join(OUT, `${tag}-a3-paso4.png`) });
  await pasaAxe('A3 · paso 4');
  await page.click('#anuOv [data-busar="0"]'); await page.waitForTimeout(200);
  step(/WhatsApp/.test(await page.$eval('#anuOv [data-bc="creativos.0.texto"]', t => t.value)) && await page.evaluate(() => document.activeElement?.dataset?.bc) === 'creativos.0.texto', `${tag}: A3 · «Usar» pone la propuesta y el foco vuelve al texto`);
  await page.click('#anuOv [data-bmejora="texto"]'); await page.waitForTimeout(150);
  step(await page.$eval('#anuOv [data-bmejora="texto"]', b => b.getAttribute('aria-checked') === 'true' && /Encendida/.test(b.textContent)), `${tag}: A3 · las mejoras de Meta, una por una, con su estado escrito`);
  await page.click('#anuOv [data-bmejora="texto"]'); await page.waitForTimeout(150);
  // el Estudio «para el anuncio»
  if (await page.$('#anuOv [data-bestudio]')) {
    await page.click('#anuOv [data-bestudio]'); await page.waitForSelector('.st-forpiece:not([hidden])', { timeout: 6000 });
    const barra = await txt(page, '.st-forpiece');
    step(/Para el anuncio «Campaña nueva/.test(barra) && /Volver al anuncio/.test(barra), `${tag}: A3 · «Crear con el Estudio» abre el Estudio «para el anuncio» con su barra («${barra.trim().slice(0, 70)}…»)`);
    await page.screenshot({ path: path.join(OUT, `${tag}-a3-estudio.png`) });
    await page.click('.st-forpiece [data-f="back"]'); await page.waitForSelector('#anuOv.on [data-paso="3"][aria-current="step"]', { timeout: 6000 });
    step((await page.$$eval('#anuOv [data-bcr]', l => l.length)) === 2, `${tag}: A3 · «Volver al anuncio» devuelve a Anuncios en el paso 4, con lo que ya tenía`);
  } else step(false, `${tag}: A3 · falta «Crear con el Estudio»`);
  // 5 · revisión: los problemas llevan a su campo
  await page.click('#anuOv [data-paso="4"]'); await page.waitForSelector('#anuOv [data-bir]', { timeout: 6000 });
  const probs = await page.$$eval('#anuOv [data-bir]', l => l.map(b => b.textContent));
  step(probs.some(t => /tope diario/.test(t)) && probs.some(t => /creativo 2/.test(t)) && await page.$eval('#anuOv [data-bcrear]', b => b.getAttribute('aria-disabled')) === 'true' && /Arregla/.test(await txt(page, '#anuOv .anu-bcrear')), `${tag}: A3 · la revisión dice qué falta (${probs.length}) y «Crear» lo dice en vez de crear`);
  ok24(await medir(page), tag, 'A3 · revisión con problemas');
  await page.screenshot({ path: path.join(OUT, `${tag}-a3-problemas.png`) });
  await pasaAxe('A3 · revisión con problemas');
  const iTope = probs.findIndex(t => /tope diario/.test(t));
  await page.click(`#anuOv [data-bir="${iTope}"]`); await page.waitForTimeout(300);
  step(await page.$eval('#anuOv [data-paso="2"]', b => b.getAttribute('aria-current')) === 'step' && await page.evaluate(() => document.activeElement?.dataset?.bc) === 'presupuesto.usd', `${tag}: A3 · un clic en el problema lleva al paso 3 con el foco en el presupuesto`);
  await page.fill('#anuOv [data-bc="presupuesto.usd"]', '5'); await page.waitForTimeout(700);
  await page.click('#anuOv [data-paso="4"]'); await page.waitForSelector('#anuOv [data-bir]', { timeout: 6000 });
  const i2 = (await page.$$eval('#anuOv [data-bir]', l => l.map(b => b.textContent))).findIndex(t => /creativo 2/.test(t));
  await page.click(`#anuOv [data-bir="${i2}"]`); await page.waitForTimeout(300);
  step(await page.evaluate(() => document.activeElement?.dataset?.bc) === 'creativos.1.texto', `${tag}: A3 · …y el del creativo 2 lleva a su texto`);
  await page.fill('#anuOv [data-bc="creativos.1.texto"]', 'Pruébate las monturas nuevas. Escríbenos y te las apartamos.'); await page.waitForTimeout(700);
  await page.click('#anuOv [data-paso="4"]'); await page.waitForFunction(() => /Todo en orden/.test(document.querySelector('#anuOv .anu-paso')?.textContent || ''), null, { timeout: 6000 });
  step((await page.$$eval('#anuOv .anu-pv-f', l => l.length)) === 2 && /5,00\sUS\$ al día/.test(await page.textContent('#anuOv .anu-paso')) && await page.$eval('#anuOv [data-bcrear]', b => !b.hasAttribute('aria-disabled')), `${tag}: A3 · todo en orden: la vista previa del feed de los dos creativos, el costo máximo y «Crear» disponible`);
  await page.click('#anuOv [data-bubic="historia"]'); await page.waitForTimeout(200);
  step((await page.$$eval('#anuOv .anu-pv-h', l => l.length)) === 2, `${tag}: A3 · la vista previa de historias y reels (9:16)`);
  ok24(await medir(page), tag, 'A3 · revisión');
  await page.screenshot({ path: path.join(OUT, `${tag}-a3-revision.png`) });
  await pasaAxe('A3 · revisión');
  // crear en pausa
  await page.click('#anuOv [data-bcrear]'); await page.waitForSelector('#anuOv .anu-bok.t-ambar', { timeout: 4000 });
  step(/Creando en Meta…/.test(await txt(page, '#anuOv .anu-paso')), `${tag}: A3 · «Crear en Meta (en pausa)»: un clic y «Creando en Meta…»`);
  await page.waitForSelector('#anuOv .anu-bok.t-verde [data-vercamp]', { timeout: 8000 });
  step(/Creado en pausa\. ?Actívalo desde Campañas cuando quieras \(te pedirá los dos clics/.test(await txt(page, '#anuOv .anu-bok.t-verde')), `${tag}: A3 · «Creado en pausa. Actívalo desde Campañas cuando quieras (te pedirá los dos clics)»`);
  await page.screenshot({ path: path.join(OUT, `${tag}-a3-creado.png`) });
  await pasaAxe('A3 · creado');
  const camp = await page.$eval('#anuOv .anu-bok.t-verde [data-vercamp]', b => b.dataset.vercamp);
  await page.click('#anuOv .anu-bok.t-verde [data-vercamp]'); await page.waitForSelector('#anuOv .anu-det:not([hidden]) .anu-dh', { timeout: 6000 });
  step(await page.$eval('#anuTab-campanas', b => b.getAttribute('aria-selected')) === 'true' && /En pausa/.test(await txt(page, `#anuOv [data-fila="${camp}"]`)) && !!await page.$(`#anuOv .anu-int[data-acc="activar"][data-id="${camp}"]`),
    `${tag}: A3 · «Ver en Campañas»: la campaña nueva está EN PAUSA y su interruptor dice «Activar» (los dos clics de la A2)`);
  await page.screenshot({ path: path.join(OUT, `${tag}-a3-campanas.png`) });
  await page.click('#anuOv [data-cerrardet]'); await page.waitForTimeout(150);
  await page.click('#anuOv [data-tab="borradores"]'); await page.waitForTimeout(300);
  step(/Creado en pausa/.test(await txt(page, '#anuOv .anu-blista li:last-child')) || (await page.$$eval('#anuOv .anu-blista li', l => l.filter(x => /Creado en pausa/.test(x.textContent)).length)) === 2, `${tag}: A3 · en Borradores, el nuevo ya dice «Creado en pausa»`);
  await page.click('#anuOv [data-tab="resumen"]'); await page.waitForTimeout(200);
  if (w === 1024) { await page.click('#topDimitri'); await page.waitForTimeout(400); }
}

/** Fase A5 en la demo: las sugerencias (aplicar lo que baja el gasto con DESHACER, lo que gasta con la ventana de la cifra, descartar,
 *  posponer, los filtros, el borrador del rechazado) y los creativos (su estado escrito, «Pedir variaciones», «Nueva campaña con este
 *  creativo»). Los pasos que dependen del foco esperan al hecho (waitForFunction), no a un tiempo fijo. */
async function a5(page, tag, w, pasaAxe) {
  if (w === 1024) { await page.click('#topDimitri'); await page.waitForTimeout(800); }
  if (await page.$('#anuOv [data-cerrardet]')) { await page.click('#anuOv [data-cerrardet]'); await page.waitForTimeout(150); }
  const enCard = () => page.waitForFunction(() => !!document.activeElement?.closest?.('#anuOv [data-sug]') || !!document.activeElement?.dataset?.sfiltro, null, { timeout: 4000 }).then(() => true).catch(() => false);
  // las 3 del Resumen
  await page.click('#anuOv [data-tab="resumen"]'); await page.waitForSelector('#anuOv .anu-sec-sug', { timeout: 5000 });
  const tres = await page.$$eval('#anuOv .anu-sec-sug .anu-sug', l => l.map(x => x.dataset.sug));
  const rt = await txt(page, '#anuOv .anu-sec-sug');
  step(tres.length === 3 && tres.includes('ej-s-2') && /Gasta sin resultados/.test(rt) && /El dato/.test(rt) && !!await page.$('#anuOv .anu-sec-sug [data-ir="sugerencias"]'), `${tag}: A5 · el Resumen trae las 3 sugerencias más importantes (${tres.join(', ')}) con «Ver todas»`);
  ok24(await medir(page), tag, 'A5 · Resumen con sugerencias');
  await page.screenshot({ path: path.join(OUT, `${tag}-a5-resumen.png`) });
  await pasaAxe('A5 · Resumen con sugerencias');
  await page.click('#anuOv .anu-sec-sug [data-ir="sugerencias"]'); await page.waitForSelector('#anuOv .anu-sugs', { timeout: 5000 });
  await page.waitForFunction(() => document.activeElement?.id === 'anuTab-sugerencias', null, { timeout: 2000 }).catch(() => {});
  step(await page.$eval('#anuTab-sugerencias', b => b.getAttribute('aria-selected')) === 'true' && await page.evaluate(() => document.activeElement?.id) === 'anuTab-sugerencias', `${tag}: A5 · «Ver todas» lleva a la pestaña Sugerencias (el foco en su pestaña)`);
  const cuenta = (await txt(page, '#anuTab-sugerencias')).trim(), tx = await txt(page, '#anuOv .anu-main');
  step(/6$/.test(cuenta) && /Para saber/.test(tx) && !await page.$('#anuOv [data-sapl="ej-s-1"]') && /reinicia el aprendizaje|gasta más: pide tus dos clics/.test(tx) && /Aplicar — pide tus dos clics/.test(tx),
    `${tag}: A5 · Sugerencias: 6 vivas en la pestaña («${cuenta}»), «aprendiendo» sin «Aplicar», y la que gasta lo dice («Aplicar — pide tus dos clics»)`);
  step(['El dato', 'Por qué', 'El cambio', 'Qué se espera', 'El riesgo'].every(k => tx.includes(k)), `${tag}: A5 · cada tarjeta: el dato, el porqué, el cambio, lo que se espera y el riesgo`);
  ok24(await medir(page), tag, 'A5 · Sugerencias');
  await page.screenshot({ path: path.join(OUT, `${tag}-a5-sugerencias.png`), fullPage: false });
  await pasaAxe('A5 · Sugerencias');
  // 1 · aplicar la que pausa: un clic, DESHACER
  await page.click('#anuOv [data-sapl="ej-s-2"]'); await page.waitForSelector('#anuOv .anu-toast:not([hidden]) [data-deshacer]', { timeout: 5000 });
  const foco1 = await enCard();
  step(/Pausaste «Monturas otoño · solo texto»/.test(await txt(page, '#anuOv .anu-toast')) && !await page.$('#anuOv [data-sug="ej-s-2"]') && !await visible(page, '#anuOv .anu-fondo') && foco1,
    `${tag}: A5 · «Aplicar» la que pausa: un clic, sin ventana, DESHACER; sale de Vivas y el foco va a la siguiente tarjeta`);
  await page.screenshot({ path: path.join(OUT, `${tag}-a5-pausada.png`) });
  await page.click('#anuOv [data-deshacer]'); await page.waitForSelector('#anuOv [data-sug="ej-s-2"]', { timeout: 5000 });
  step(/Deshecho/.test(await txt(page, '#anuOv .anu-toast')) && !!await page.$('#anuOv [data-sapl="ej-s-2"]'), `${tag}: A5 · DESHACER: el anuncio vuelve a estar activo y la sugerencia, viva`);
  // 2 · aplicar la de escalar: la ventana del segundo clic con la cifra; «Sí» la aplica
  await page.click('#anuOv [data-sapl="ej-s-4"]'); await page.waitForSelector('#anuOv .anu-fondo:not([hidden]) [data-dlg="si"]', { timeout: 5000 });
  const si = (await txt(page, '#anuOv [data-dlg="si"]')).trim(), dl = await txt(page, '#anuOv .anu-dlg');
  step(/^Sí, subir — hasta 8,40 US\$ al día$/.test(si) && /de 7,00 US\$ al día a 8,40 US\$ al día/.test(dl) && !!await page.$('#anuOv [data-sug="ej-s-4"]'), `${tag}: A5 · «Aplicar» la de escalar abre la ventana de la A2 con la cifra («${si}») y todavía no cambió nada`);
  ok24(await medir(page), tag, 'A5 · la cifra de escalar');
  await page.screenshot({ path: path.join(OUT, `${tag}-a5-escalar.png`) });
  await pasaAxe('A5 · la cifra de escalar');
  await page.click('#anuOv [data-dlg="si"]'); await page.waitForSelector('#anuOv .anu-fondo', { state: 'hidden', timeout: 5000 });
  const foco2 = await enCard();
  step(/Subiste el presupuesto/.test(await txt(page, '#anuOv .anu-toast')) && !await page.$('#anuOv [data-sug="ej-s-4"]') && foco2, `${tag}: A5 · «Sí» la aplica: el presupuesto sube, sale de Vivas y el foco vuelve a las tarjetas`);
  // 3 · descartar y posponer
  await page.click('#anuOv [data-sdesc="ej-s-6"]'); await page.waitForFunction(() => !document.querySelector('#anuOv [data-sug="ej-s-6"]'), null, { timeout: 4000 });
  step(/Descartada/.test(await txt(page, '#anuOv .anu-toast')) && await enCard(), `${tag}: A5 · «Descartar»: un clic, no vuelve en 7 días, y el foco sigue en las tarjetas`);
  await page.click('#anuOv [data-spos="ej-s-2"]'); await page.waitForSelector('#anuOv .anu-sug-luego', { timeout: 4000 });
  step(/Te la recuerdo en 3 días/.test(await txt(page, '#anuOv .anu-toast')) && /Pospuesta hasta el/.test(await txt(page, '#anuOv [data-sug="ej-s-2"]')) && !await page.$('#anuOv [data-sapl="ej-s-2"]'), `${tag}: A5 · «Recordármelo en 3 días»: pasa a «Para más tarde», escrito, sin botones`);
  // 4 · los filtros: Aplicadas con su resultado, Descartadas escrito
  await page.click('#anuOv [data-sfiltro="aplicada"]'); await page.waitForTimeout(150);
  const apl = await txt(page, '#anuOv .anu-main');
  step(/Qué pasó después/.test(apl) && /11,90 US\$ menos/.test(apl) && /Todavía no se sabe/.test(apl) && !await page.$('#anuOv [data-sapl]'), `${tag}: A5 · «Aplicadas»: lo que pasó después (o que todavía no se sabe), sin «Aplicar»`);
  ok24(await medir(page), tag, 'A5 · Aplicadas');
  await page.screenshot({ path: path.join(OUT, `${tag}-a5-aplicadas.png`) });
  await pasaAxe('A5 · Aplicadas');
  await page.click('#anuOv [data-sfiltro="descartada"]'); await page.waitForTimeout(150);
  step(/Descartada: no vuelve en 7 días/.test(await txt(page, '#anuOv .anu-main')) && await page.$$eval('#anuOv .anu-sug', l => l.length) === 2, `${tag}: A5 · «Descartadas»: escrito, no atenuado`);
  await page.click('#anuOv [data-sfiltro="viva"]'); await page.waitForTimeout(150);
  // 5 · el rechazado: un borrador con el texto corregido, abierto en Borradores
  await page.click('#anuOv [data-sapl="ej-s-5"]'); await page.waitForSelector('#anuOv .anu-asis [data-paso="3"][aria-current="step"]', { timeout: 6000 });
  step(await page.$eval('#anuTab-borradores', b => b.getAttribute('aria-selected')) === 'true' && /apartamos/.test(await page.$eval('#anuOv [data-bc="creativos.0.texto"]', t => t.value)) && /borrador/.test(await txt(page, '#anuOv .anu-toast')),
    `${tag}: A5 · «Aplicar — deja un borrador» (el rechazado): abre el borrador en Borradores con el texto corregido`);
  // 6 · Creativos
  await page.click('#anuOv [data-tab="creativos"]'); await page.waitForSelector('#anuOv .anu-crs', { timeout: 5000 });
  const cr = await txt(page, '#anuOv .anu-crs'), ncr = await page.$$eval('#anuOv .anu-cr', l => l.length);
  step(ncr >= 7 && /funciona/.test(cr) && /se está cansando/.test(cr) && /sin datos/.test(cr) && /US\$/.test(cr) && !!await page.$('#anuOv [data-crvar="ej-s-3"]') && !!await page.$('#anuOv .anu-cr img'),
    `${tag}: A5 · Creativos: ${ncr} con su miniatura, sus cifras con moneda y su estado escrito; el cansado ofrece «Pedir variaciones»`);
  ok24(await medir(page), tag, 'A5 · Creativos');
  await page.screenshot({ path: path.join(OUT, `${tag}-a5-creativos.png`) });
  await pasaAxe('A5 · Creativos');
  await page.click('#anuOv [data-crvar="ej-s-3"]'); await page.waitForFunction(() => /tarjeta de costo del Estudio/.test(document.querySelector('#anuOv .anu-toast')?.textContent || ''), null, { timeout: 4000 }).catch(() => {});
  step(/Le pedí a ANUNCIOS variaciones/.test(await txt(page, '#anuOv .anu-toast')) && !await page.$('#anuOv [data-crvar="ej-s-3"]'), `${tag}: A5 · «Pedir variaciones» aplica la sugerencia: «Le pedí a ANUNCIOS variaciones: te llegará la tarjeta de costo del Estudio»`);
  await page.click('#anuOv [data-crnueva="ej-ad-11"]'); await page.waitForSelector('#anuOv .anu-asis [data-paso="3"][aria-current="step"]', { timeout: 6000 });
  step(/WhatsApp/.test(await page.$eval('#anuOv [data-bc="creativos.0.texto"]', t => t.value)) && /elige su imagen/.test(await txt(page, '#anuOv .anu-toast')), `${tag}: A5 · «Nueva campaña con este creativo»: un borrador con su texto, en el paso 4 para elegir la imagen`);
  await page.click('#anuOv [data-tab="resumen"]'); await page.waitForTimeout(250);
  if (w === 1024) { await page.click('#topDimitri'); await page.waitForTimeout(400); }
}

/** Fase A4 (9 oct 2026), en la demo: «Impulsar» en Analíticas («las que más movieron») abre Anuncios → Borradores con un borrador que
 *  impulsa esa publicación: el paso 4 enseña la publicación (no la galería) y solo la llamada; la revisión dice qué se impulsa; se crea en
 *  pausa. Lo mismo que hace el botón de una pieza publicada en Contenido (el evento ao:abrir-anuncios). */
async function a4(page, tag, w, pasaAxe) {
  const movil = w < 500;
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300); // cerrar Anuncios
  if (movil) { await page.click('#topMore'); await page.click('#topMoreMenu [data-for="topAnaliticas"]'); } else await page.click('#topAnaliticas');
  await page.waitForSelector('#anOv .an-imp', { timeout: 8000 });
  const nImp = await page.$$eval('#anOv .an-imp', l => l.length);
  step(nImp > 0, `${tag}: A4 · Analíticas: «Impulsar» en las que más movieron (${nImp})`);
  ok24(await page.evaluate(() => { const b = [...document.querySelectorAll('#anOv .an-imp')].map(x => x.getBoundingClientRect()); const peq = b.filter(r => r.height < 23.5 || r.width < 23.5); return { npeq: peq.length, peq: peq.map(r => `${Math.round(r.width)}x${Math.round(r.height)}`), hs: document.documentElement.scrollWidth > innerWidth + 1, nletra: 0, letra: [] }; }), tag, 'A4 · el botón de Analíticas');
  await page.click('#anOv .an-imp');
  await page.waitForSelector('#anuOv .anu-borig', { timeout: 8000 });
  step(await page.$eval('#anuTab-borradores', b => b.getAttribute('aria-selected')) === 'true' && /Paso 4/.test(await txt(page, '#anuOv .anu-asis-n')), `${tag}: A4 · abre Anuncios → Borradores con el borrador en el paso 4`);
  const p4 = await txt(page, '#anuOv .anu-paso');
  step(/La publicación que impulsas/.test(p4) && !await page.$('#anuOv [data-bgaleria]') && !!await page.$('#anuOv [data-bc="creativos.0.llamada"]') && !!await page.$('#anuOv .anu-borig-m img'), `${tag}: A4 · el paso 4 enseña la publicación (miniatura y texto) y solo la llamada, sin la galería`);
  step(/pausa/.test(await txt(page, '#anuOv .anu-toast')), `${tag}: A4 · el aviso dice que nace borrador y no crea nada en Meta`);
  ok24(await medir(page), tag, 'A4 · el paso 4 con la publicación');
  await page.screenshot({ path: path.join(OUT, `${tag}-a4-publicacion.png`) });
  await pasaAxe('A4 · el paso 4 con la publicación');
  await page.selectOption('#anuOv [data-bc="creativos.0.llamada"]', { index: 1 }); await page.waitForTimeout(700);
  await page.click('#anuOv [data-paso="4"]'); await page.waitForFunction(() => /Se impulsa la publicación de (Instagram|Facebook)/.test(document.querySelector('#anuOv .anu-paso')?.textContent || ''), null, { timeout: 6000 });
  step(!await page.$('#anuOv [data-bmetaver]'), `${tag}: A4 · la revisión dice qué publicación se impulsa (sin la vista previa de Meta)`);
  await page.waitForFunction(() => /Todo en orden|cosa/.test(document.querySelector('#anuOv .anu-paso')?.textContent || ''), null, { timeout: 6000 }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, `${tag}-a4-revision.png`) });
  await pasaAxe('A4 · la revisión');
  if (await page.$('#anuOv [data-bcrear]:not([aria-disabled="true"])')) {
    await page.click('#anuOv [data-bcrear]');
    await page.waitForFunction(() => /Creado en pausa/.test(document.querySelector('#anuOv .anu-paso')?.textContent || ''), null, { timeout: 8000 }).then(() => step(true, `${tag}: A4 · se crea EN PAUSA (en la demo)`)).catch(() => step(false, `${tag}: A4 · no llegó a «Creado en pausa»`));
  } else step(false, `${tag}: A4 · «Crear en Meta (en pausa)» no está disponible: ${(await txt(page, '#anuOv .anu-bprobs').catch(() => '')).slice(0, 160)}`);
  await page.click('#anuOv [data-bvolver]'); await page.waitForSelector('#anuOv .anu-blista', { timeout: 5000 });
  step(/se impulsa la publicación de/.test(await txt(page, '#anuOv .anu-blista')), `${tag}: A4 · en Borradores, la fila dice qué publicación impulsa`);
  await page.click('#anuOv [data-tab="resumen"]'); await page.waitForTimeout(250);
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
      await a3(page, tag, w, pasaAxe);
      await a5(page, tag, w, pasaAxe);
      await a4(page, tag, w, pasaAxe);
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
