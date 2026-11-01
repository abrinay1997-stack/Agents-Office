// Recorrido de navegador de INICIO en el teléfono (1 nov 2026). Oficina temporal (la de movil-recorrido.mjs) y un Chromium de teléfono con toque,
// con DATOS que reproducen las capturas del dueño: avisos repetidos, una rutina de las 09:00 y su fecha límite con el mismo título, la oficina con
// «algo necesita atención», la campanita y el chat del equipo de la nube (se inyectan sus paquetes con un `AO_NUBE` de mentira).
// Comprueba, a 320, 360, 390 y 430 px, en claro y en oscuro: sin desbordes, objetivos de 44 px, nada tapado con el scroll al fondo (ni por la campanita),
// campanita y chat en la cabecera sin pisarse, ningún aviso ni «lo que viene» repetido, las acciones y lo urgente en los primeros 400 px.
//   node scripts/movil-inicio-recorrido.mjs [--capturas] [--antes]     (con --antes solo saca fotos a docs/capturas-movil/antes/: se usa sobre la versión vieja)
//   recuerda `node build.mjs` antes: el servidor sirve dist/movil.js tal cual.  AO_AXE=<axe.min.js> también pasa axe.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { oficina } from './movil-recorrido.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const espera = ms => new Promise(r => setTimeout(r, ms));
const leer = f => fs.readFileSync(path.join(ROOT, 'cloudflare', 'public', f), 'utf8');
const SHIM = `window.AO_NUBE = { esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), yo: () => ({ rol: 'admin', nombre: 'Abrinay' }), presentes: () => [], aviso() {}, conexion: () => 'conectado',
  api: async (ruta, o = {}) => { const r = await fetch(ruta, { method: o.metodo || 'GET', headers: { 'content-type': 'application/json' }, body: o.cuerpo === undefined ? undefined : JSON.stringify(o.cuerpo) }); return r.json(); } };`;

const ANCHOS = [320, 360, 390, 430];

/** Los datos del dueño: avisos repetidos, la rutina de las 09:00 con su fecha límite, y un conector que pide entrar. */
function datos() {
  const ahora = Date.now(), d0 = new Date(ahora); d0.setHours(0, 0, 0, 0); const inicio = d0.getTime();
  const ayer = inicio - 3600e3, hoyAviso = Math.min(ahora - 1000, inicio + 60e3), dec = '«Decidir si pausamos la campaña de Meta y qué se rehace»';
  const m = new Date(ahora + 864e5), manana = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
  const notices = [
    { id: 'n1', t: ayer, kind: 'limite', level: 'info', task: 'seed-dec', key: 'limite-vispera-seed-dec', read: false, text: `Mañana vence ${dec} y aún no empezó (Abrinay).` },
    { id: 'n2', t: ayer - 3600e3, kind: 'limite', level: 'info', task: 'seed-dec', key: 'limite-vispera-seed-dec', read: false, text: `⚑ Mañana vence ${dec} y aún no empezó (Abrinay).` },
    { id: 'n3', t: ayer - 60e3, kind: 'limite', level: 'info', task: 'seed-plan', key: 'limite-vispera-seed-plan', read: false, text: 'Mañana vence «Plan de mejora de la campaña y borradores de anuncios» y aún no empezó (LÍDER MARKETING).' },
    { id: 'n4', t: hoyAviso, kind: 'limite', level: 'info', task: 'seed-hoy', key: 'limite-hoy-seed-hoy', read: false, text: 'Hoy vence «Llamar al banco por la tarjeta».' },
  ];
  const checks = [
    { id: 'claude', label: 'Proveedor de IA', state: 'ok', detail: 'Bien.' },
    { id: 'conectores', label: 'Conectores', state: 'warn', detail: '2 conectores sin autorizar: Gmail y Drive. Autorízalos en Conectores.', fix: '' },
    { id: 'rutinas', label: 'Rutinas', state: 'warn', detail: 'La última ejecución falló en «Revisión de anuncios».' },
  ];
  const tareas = [
    { id: 'seed-dec', title: 'Decidir si pausamos la campaña de Meta y qué se rehace', person: 'Tú', state: 'next', limite: manana, addedAt: ahora - 2 * 864e5 },
    { id: 'seed-inv', title: 'Investigar Meta Ads y Andromeda con fuentes y fecha', dept: 'marketing', agent: 'lexi', state: 'next', limite: manana, addedAt: ahora - 864e5 },
    { id: 'seed-ana', title: 'Analizar la campaña activa de Meta y dar recomendación', dept: 'marketing', agent: 'lexi', state: 'next', limite: manana, addedAt: ahora - 864e5 },
  ];
  const dow = m.getDay(); // solo mañana (y dentro de una semana): así la rutina de las 09:00 y la fecha límite caen el MISMO día, como en la captura
  const rutinas = [
    { id: 'r-inv', title: 'Investigar Meta Ads y Andromeda con fuentes y fecha', dept: 'marketing', agent: 'lexi', when: { kind: 'weekly', days: [dow], at: '09:00' } },
    { id: 'r-ana', title: 'Analizar la campaña activa de Meta y dar recomendación', dept: 'marketing', agent: 'lexi', when: { kind: 'weekly', days: [dow], at: '09:00' } },
  ];
  return { notices, checks, tareas, rutinas };
}

async function preparar(browser, { ancho, tema, escenario, o }) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }), page = await ctx.newPage(), errores = [];
  await ctx.addInitScript(t => { try { localStorage.setItem('ao.theme', t); } catch {} }, tema);
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  const d = datos(), vacio = escenario === 'vacio';
  const json = (route, cuerpo) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) });
  await page.route('**/api/status', r => json(r, vacio ? { overall: 'ok', checks: [], notices: [], unread: 0 } : { overall: 'warn', checks: d.checks, notices: d.notices, unread: d.notices.length }));
  await page.route('**/api/routines', r => json(r, { routines: vacio ? [] : d.rutinas }));
  await page.route('**/api/tasks?light=1', async r => { const real = await (await r.fetch()).json(), l = Array.isArray(real) ? real : real.tasks || []; json(r, vacio ? [] : [...l, ...d.tareas]); });
  await page.route('**/api/mcp', r => json(r, { servers: [{ name: 'GitHub', key: 'github', status: 'connected', depts: ['ops'] }] }));
  await page.route('**/api/notas-personales/entrada', r => json(r, { activo: true, notasActivas: true, notas: [], notificaciones: { noLeidas: 3 } }));
  await page.route('**/api/chat/resumen', r => json(r, { activo: true, canales: [], total: 2 }));
  await page.goto(o.base); await page.waitForSelector('#mvRoot .mv-tabs'); await page.waitForSelector('[data-vista="inicio"] .mv-acc-fila, [data-vista="inicio"] .mv-card', { timeout: 15000 }); await espera(500);
  await page.addStyleTag({ content: leer('nube.css') }); await page.addScriptTag({ content: SHIM }); await page.addScriptTag({ content: leer('nube-notas.js') }); await page.addScriptTag({ content: leer('nube-chat.js') });
  await page.waitForSelector('#nbCampana'); await page.waitForSelector('#nbChatBtn').catch(() => {}); await espera(700);
  return { ctx, page, errores };
}

export async function correr({ capturas = false, antes = false } = {}) {
  const res = []; let fallos = 0;
  const paso = (ok, que) => { if (!ok && !antes) fallos++; res.push({ ok: !!ok, que }); console.log(`${ok ? '✓' : (antes ? '·' : '✗')} ${que}`); };
  const o = await oficina();
  let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  const OUT = path.join(ROOT, 'docs', 'capturas-movil', antes ? 'antes' : 'despues');
  const AXE = process.env.AO_AXE && fs.existsSync(process.env.AO_AXE) ? process.env.AO_AXE : null;
  try {
    for (const tema of ['light', 'dark']) for (const ancho of ANCHOS) {
      const { ctx, page, errores } = await preparar(browser, { ancho, tema, escenario: 'lleno', o }), n = `${ancho}px ${tema === 'dark' ? 'oscuro' : 'claro'}`;
      const foto = async nombre => { if (!capturas) return; fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, `inicio-${nombre}-${ancho}-${tema}.jpg`), type: 'jpeg', quality: 60 }); };
      await foto('arriba');
      if (antes) { await page.evaluate(() => { const s = document.querySelector('[data-vista="inicio"] .mv-scroll'); s.scrollTop = s.scrollHeight; }); await espera(300); await foto('abajo'); await ctx.close(); continue; }

      // ---- sin desbordes ----
      const desborda = await page.evaluate(() => { const w = innerWidth; return [...document.querySelectorAll('#mvRoot *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > w + 1 || b.left < -1) && !e.closest('[hidden]'); }).map(e => e.className.toString().slice(0, 30)).slice(0, 4); });
      paso(!desborda.length, `${n}: Inicio sin desbordes horizontales${desborda.length ? ' → ' + desborda.join(', ') : ''}`);
      // ---- objetivos táctiles de 44 px (Inicio y cabecera) ----
      const chicos = await page.evaluate(() => [...document.querySelectorAll('#mvRoot .mv-bar button, #mvRoot [data-vista="inicio"] button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && !e.closest('[hidden]') && (r.height < 43.5 || r.width < 43.5); }).map(e => `${e.className.toString().split(' ')[0]} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`));
      paso(!chicos.length, `${n}: ningún objetivo táctil < 44 px${chicos.length ? ' → ' + chicos.join(' | ') : ''}`);
      // ---- la campanita y el chat viven en la cabecera, sin pisarse ----
      const cab = await page.evaluate(() => {
        const bar = document.querySelector('#mvRoot .mv-bar').getBoundingClientRect(), bell = document.getElementById('nbCampana'), chat = document.getElementById('nbChatBtn');
        const hijos = [...document.querySelectorAll('#mvRoot .mv-bar-der > *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && !e.hidden; });
        let pisa = false; for (let i = 0; i < hijos.length; i++) for (let j = i + 1; j < hijos.length; j++) { const a = hijos[i].getBoundingClientRect(), b = hijos[j].getBoundingClientRect(); if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) pisa = true; }
        const b = bell.getBoundingClientRect();
        return { enCab: !!bell.closest('.mv-bar-der'), pos: getComputedStyle(bell).position, dentro: b.top >= bar.top - 1 && b.bottom <= bar.bottom + 1 && b.right <= innerWidth + 1, pisa, chatEnCab: !!chat?.closest('.mv-bar-der'), tit: document.getElementById('mvTitulo').getBoundingClientRect().width, n: bell.querySelector('.nt-n')?.textContent.trim(), aria: bell.getAttribute('aria-label') };
      });
      paso(cab.enCab && cab.pos === 'relative' && cab.dentro, `${n}: la campanita vive en la cabecera (no flota)`);
      paso(cab.chatEnCab && !cab.pisa, `${n}: campanita, chat, lupa y aprobaciones no se pisan`);
      paso(cab.tit >= 60, `${n}: el título de la cabecera conserva sitio (${Math.round(cab.tit)} px)`);
      paso(cab.n === '3' && /sin leer/.test(cab.aria), `${n}: la campanita lleva su contador y su nombre`);
      // ---- la jerarquía: lo urgente y las acciones, en los primeros 400 px ----
      const alto = await page.evaluate(() => { const top = document.querySelector('#mvRoot .mv-main').getBoundingClientRect().top, y = s => { const e = document.querySelector('[data-vista="inicio"] ' + s); return e ? Math.round(e.getBoundingClientRect().bottom - top) : 9999; }; return { nueva: y('[data-nueva]'), banda: y('.mv-banda'), hoy: Math.round(document.querySelector('[data-vista="inicio"] [aria-label="Lo tuyo hoy"], [data-vista="inicio"] .ini-linea[data-tareas]').getBoundingClientRect().top - top), orden: [...document.querySelectorAll('[data-vista="inicio"] .mv-cuerpo > *')].map(e => e.className.toString().split(' ')[0] + ':' + (e.getAttribute('aria-label') || '')).join('|') }; });
      paso(alto.nueva <= 400, `${n}: «Añadir tarea» se ve sin scroll (a ${alto.nueva} px del borde)`);
      paso(alto.banda <= 400 && alto.hoy <= 400, `${n}: el aviso de la oficina y «Lo tuyo hoy» empiezan en los primeros 400 px (${alto.banda} / ${alto.hoy})`);
      // ---- «algo necesita atención» dice qué ----
      const banda = await page.locator('[data-vista="inicio"] .mv-banda').first().innerText();
      paso(/2 conectores sin autorizar: Gmail y Drive/.test(banda) && /1 cosa más/.test(banda), `${n}: el aviso amarillo dice el motivo y cuántos más`);
      // ---- sin repetir ----
      const avisos = await page.locator('[data-vista="inicio"] .mv-iav-t').allInnerTexts(), norm = t => t.replace(/[⚑]/g, '').trim().toLowerCase();
      paso(new Set(avisos.map(norm)).size === avisos.length && avisos.length >= 1, `${n}: los avisos no se repiten (${avisos.length})`);
      const antesDeHoy = await page.locator('[data-vista="inicio"] [data-avisos]').allInnerTexts();
      paso(antesDeHoy.some(t => /Antes de hoy · 2/.test(t)), `${n}: lo de ayer va aparte («Antes de hoy · 2»: las dos tareas, sin la copia)`);
      const evs = await page.locator('[data-vista="inicio"] .ini-ev-t').allInnerTexts();
      paso(new Set(evs).size === evs.length && evs.length >= 1, `${n}: «Lo que viene» no repite nada (${evs.length})`);
      const ev0 = await page.locator('[data-vista="inicio"] .ini-ev', { hasText: 'Investigar Meta Ads' }).first().innerText();
      paso(/\d\d:\d\d/.test(ev0) && /vence/.test(ev0), `${n}: la rutina de las 09:00 y su fecha límite son una sola entrada («09:00 … vence»)`);
      paso(await page.locator('[data-vista="inicio"] .ini-dia').count() >= 1, `${n}: «Lo que viene» va con títulos de día`);
      // ---- las acciones ----
      const orden = await page.evaluate(() => { const c = document.querySelector('[data-vista="inicio"] .mv-cuerpo'); const a = c.querySelector('.mv-acc-fila'), s = c.querySelector('[aria-label="Lo que viene"]'); return a && s ? a.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING : 0; });
      paso(!!orden, `${n}: las acciones rápidas van antes que todo lo demás`);
      // ---- icono del chat distinto al de Dimitri ----
      const iconos = await page.evaluate(() => ({ chat: document.querySelector('#nbChatBtn svg').innerHTML, dim: document.querySelector('.mv-tab[data-tab="dimitri"] svg').innerHTML, a: document.getElementById('nbChatBtn').getAttribute('aria-label'), b: document.querySelector('.mv-tab[data-tab="dimitri"]').textContent.trim() }));
      paso(iconos.chat !== iconos.dim && iconos.a !== iconos.b && /equipo/.test(iconos.a), `${n}: el chat del equipo y Dimitri no se parecen (icono y nombre)`);
      // ---- scroll al fondo: nada tapado (ni por la barra de pestañas ni por una campanita flotante) ----
      await page.evaluate(() => { const s = document.querySelector('[data-vista="inicio"] .mv-scroll'); s.scrollTop = s.scrollHeight; }); await espera(350);
      const tapado = await page.evaluate(() => {
        const tabs = document.querySelector('#mvRoot .mv-tabs').getBoundingClientRect().top, mainTop = document.querySelector('#mvRoot .mv-main').getBoundingClientRect().top, malos = [];
        for (const e of document.querySelectorAll('[data-vista="inicio"] .mv-cuerpo button, [data-vista="inicio"] .mv-cuerpo time, [data-vista="inicio"] .mv-cuerpo .mv-iav-t')) {
          const r = e.getBoundingClientRect(); if (!r.width || r.top + r.height / 2 < mainTop + 2) continue; // lo que ya subió bajo la cabecera no cuenta
          if (r.bottom > tabs + 1) { malos.push('bajo la barra: ' + (e.textContent || '').trim().slice(0, 24)); continue; }
          const arriba = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (arriba && arriba !== e && !e.contains(arriba) && !arriba.contains(e)) malos.push(`tapado por ${arriba.id || arriba.className.toString().split(' ')[0]}: ` + (e.textContent || '').trim().slice(0, 24));
        }
        const ult = document.querySelector('[data-vista="inicio"] .mv-cuerpo').lastElementChild.getBoundingClientRect(); if (ult.bottom > tabs + 1) malos.push('el final queda bajo la barra');
        return malos;
      });
      paso(!tapado.length, `${n}: con el scroll al fondo no hay nada tapado${tapado.length ? ' → ' + tapado.slice(0, 3).join(' | ') : ''}`);
      await foto('abajo');
      if (AXE) { if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ path: AXE }); const v = await page.evaluate(async () => (await window.axe.run(document.getElementById('mvRoot'), { resultTypes: ['violations'] })).violations.filter(x => x.impact === 'critical' || x.impact === 'serious').map(x => `${x.id} (${x.impact}, ${x.nodes.length}): ${x.nodes[0].target.join(' ')}`)); paso(!v.length, `${n}: axe sin críticos ni serios${v.length ? ' → ' + v.join(' | ') : ''}`); }
      paso(!errores.length, `${n}: sin errores de página${errores.length ? ' → ' + errores.join(' | ') : ''}`);

      if (ancho === 390 && tema === 'light') {
        // ---- los toques ----
        await page.evaluate(() => { document.querySelector('[data-vista="inicio"] .mv-scroll').scrollTop = 0; });
        await page.locator('[data-vista="inicio"] [data-nueva]').tap(); await page.waitForSelector('[data-vista="tareas"]:not([hidden])'); await espera(500);
        paso(await page.evaluate(() => document.activeElement?.id === 'mvNueva'), 'Añadir tarea: un toque desde Inicio deja el cursor listo para escribir');
        await page.locator('.mv-tab[data-tab="inicio"]').tap(); await page.waitForSelector('[data-vista="inicio"]:not([hidden])'); await espera(300);
        await page.locator('[data-vista="inicio"] .mv-banda').first().tap(); await page.waitForSelector('[data-vista="estado"]:not([hidden]), .mv-hoja', { timeout: 6000 }).catch(() => {}); await espera(400);
        paso(await page.evaluate(() => !!document.querySelector('[data-vista="estado"]:not([hidden])') || !!document.querySelector('.mv-vista:not([hidden]) .mv-semaforo, .mv-semaforo')), 'El aviso de la oficina lleva a Estado (hay más de una cosa)');
        await page.locator('.mv-tab[data-tab="inicio"]').tap(); await espera(400);
        await page.waitForSelector('[data-vista="inicio"]:not([hidden])');
        await page.locator('[data-vista="inicio"] [data-avisos]').tap(); await page.waitForSelector('.mv-hoja .mv-gh'); await espera(300);
        const hoja = await page.locator('.mv-hoja').innerText();
        paso(/HOY/i.test(hoja) && /ANTES DE HOY/i.test(hoja) && (hoja.match(/Mañana vence «Decidir/g) || []).length === 1, 'Avisos (hoja): «Hoy» y «Antes de hoy» separados y el aviso repetido sale una vez');
        await foto('avisos'); await page.goBack(); await page.waitForSelector('.mv-hoja', { state: 'detached' }).catch(() => {});
        await page.evaluate(() => { document.querySelector('[data-vista="inicio"] .mv-scroll').scrollTop = 0; });
        await page.locator('[data-vista="inicio"] .ini-ev').first().tap(); await page.waitForSelector('[data-vista="tareas"]:not([hidden]), [data-vista="calendario"]:not([hidden])', { timeout: 5000 }).catch(() => {});
        paso(await page.evaluate(() => !!document.querySelector('[data-vista="tareas"]:not([hidden]), [data-vista="calendario"]:not([hidden])')), 'Un toque en una entrada de «Lo que viene» la abre');
      }
      await ctx.close();
    }

    // ---- lo vacío: filas compactas (nada de una tarjeta entera para decir «nada») ----
    if (!antes) for (const tema of ['light', 'dark']) {
      const { ctx, page } = await preparar(browser, { ancho: 390, tema, escenario: 'vacio', o }), n = `vacío ${tema === 'dark' ? 'oscuro' : 'claro'}`;
      const r = await page.evaluate(() => ({ tarjetas: document.querySelectorAll('[data-vista="inicio"] .mv-card').length, lineas: [...document.querySelectorAll('[data-vista="inicio"] .ini-linea')].map(e => e.textContent.trim()), alto: document.querySelector('[data-vista="inicio"] .mv-cuerpo').scrollHeight, vis: document.querySelector('#mvRoot .mv-main').getBoundingClientRect().height }));
      paso(r.tarjetas === 0 && r.lineas.length >= 4, `${n}: sin nada que hacer, todo es una fila compacta (${r.lineas.length} filas)`);
      paso(r.lineas.some(t => /Lo tuyo hoy.*Nada pendiente/.test(t)) && r.lineas.some(t => /Avisos.*Todo al día/.test(t)), `${n}: estados vacíos amables («Nada pendiente ✓», «Todo al día ✓»)`);
      paso(r.alto <= r.vis, `${n}: todo Inicio cabe en una pantalla (${r.alto} de ${r.vis} px)`);
      if (capturas) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, `inicio-vacio-390-${tema}.jpg`), type: 'jpeg', quality: 60 }); }
      await ctx.close();
    }
  } finally { await browser.close(); o.cerrar(); }
  console.log(`\n${fallos ? fallos + ' paso(s) fallaron' : 'todo en orden'} (${res.length} comprobaciones)`);
  return { fallos, res };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await correr({ capturas: process.argv.includes('--capturas'), antes: process.argv.includes('--antes') });
  process.exit(r.fallos ? 1 : 0);
}
