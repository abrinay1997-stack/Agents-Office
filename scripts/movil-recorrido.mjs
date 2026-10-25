// Herramienta de desarrollo y prueba de navegador de la VERSIÓN MÓVIL (25 oct 2026). Oficina temporal (cerebro copiado, datos sembrados,
// sin keys, Claude que no responde) y un Chromium de teléfono (390×844, con toque). Comprueba, y falla si algo no se cumple:
//   · la barra inferior existe y cada destino abre; ningún objetivo táctil < 44 px en las 5 pantallas (+ Más y las hojas);
//   · cero desbordamiento horizontal a 320, 360, 390 y 430 px; campos de 16 px o más; todo botón con nombre accesible;
//   · el escritorio (1280 px) NO cambia (no pide movil.js y su estructura clave es la de antes: tests/fixtures/escritorio-1280.json);
//   · las tareas comunes en 3 toques o menos; completar con un deslizamiento; el botón «atrás» cierra la hoja; Más abre el escritorio y vuelve.
//   node scripts/movil-recorrido.mjs [--capturas]   → ✓/✗ por paso y, con --capturas, docs/capturas-movil/despues/*.jpg
//   node scripts/movil-recorrido.mjs --huella       → reescribe tests/fixtures/escritorio-1280.json (solo desde la rama sin la versión móvil)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearTarea } from '../tareas/modelo.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FIX = path.join(ROOT, 'tests', 'fixtures', 'escritorio-1280.json');
const OUT = path.join(ROOT, 'docs', 'capturas-movil', 'despues');
const espera = ms => new Promise(r => setTimeout(r, ms));
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function oficina({ semilla = true } = {}) {
  const claude = http.createServer((rq, rs) => { rq.resume(); rq.on('end', () => { rs.writeHead(500); rs.end('{}'); }); });
  const cport = await listen(claude);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-movil-')), data = path.join(dir, 'data'), brain = path.join(dir, 'brain');
  fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
  if (semilla) {
    const ahora = Date.now(), hoy = ymd(new Date()), man = ymd(new Date(ahora + 864e5)), ayer = ymd(new Date(ahora - 864e5));
    const mk = (c, i) => crearTarea(c, { id: 'seed' + i, ahora });
    const lista = [
      mk({ title: 'Llamar al banco por la tarjeta', person: 'Tú', limite: hoy, prioridad: 'alta' }, 1),
      mk({ title: 'Revisar el inventario de octubre', person: 'Tú', limite: hoy }, 2),
      mk({ title: 'Mandar el presupuesto a Acme', person: 'Tú', limite: ayer }, 3),
      mk({ title: 'Preparar la reunión del jueves', person: 'Tú', limite: man }, 4),
      mk({ title: 'Ordenar las facturas del trimestre', person: 'Tú' }, 5),
      mk({ title: 'Post de lanzamiento para Instagram', dept: 'marketing', agent: 'lexi', dueAt: ahora + 3 * 3600e3 }, 6),
      { ...mk({ title: 'Responder a Acme sobre la propuesta', dept: 'sales', agent: 'lexi', text: 'Responder a Acme' }, 7), state: 'waiting', waitingAt: ahora - 3600e3, draft: 'Asunto: Propuesta para Acme\nPara: compras@acme.com\n\nHola, adjunto la propuesta (propuesta.pdf) por un total de $450.\nSaludos.', needsOk: true },
    ];
    fs.writeFileSync(path.join(data, 'tasks.json'), JSON.stringify(lista));
  }
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, ANTHROPIC_API_KEY: 'x',
    TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', METRICOOL_USER_ID: '', GEMINI_API_KEY: '', HF_KEY: '', FAL_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 160; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await espera(250); }
  const api = async (ruta, m = 'GET', b) => (await fetch(base + ruta, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json();
  return { base, api, dir, brain, data, cerrar: () => { srv.kill(); claude.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

/** La estructura clave del escritorio: lo que no debe cambiar al añadir la versión móvil. */
async function huella(page) {
  return page.evaluate(() => {
    const ids = [...document.body.children].map(e => e.id || e.tagName.toLowerCase()).filter(i => !/^script|style|link$/.test(i));
    const dock = [...document.querySelectorAll('#topdock > *')].map(e => `${e.tagName.toLowerCase()}#${e.id}|${e.getAttribute('aria-label') || ''}`);
    return { cuerpo: ids.filter(i => i !== 'mvRoot' && !/^(topMoreMenu|connPanel)$/.test(i)).sort(), dock, tieneCanvas: !!document.getElementById('scene'), movil: !!document.getElementById('mvRoot') || document.body.classList.contains('movil'), topbarVisible: getComputedStyle(document.getElementById('topbar')).display !== 'none' };
  });
}

export async function correr({ capturas = false, escribirHuella = false } = {}) {
  const res = []; let fallos = 0;
  const paso = (ok, que) => { if (!ok) fallos++; res.push({ ok: !!ok, que }); console.log(`${ok ? '✓' : '✗'} ${que}`); };
  const o = await oficina();
  let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  try {
    // ---- el escritorio no cambia ----
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(); const pedidos = []; page.on('request', r => pedidos.push(new URL(r.url()).pathname));
      await page.goto(o.base); await page.waitForSelector('#topbar'); await espera(1500);
      const h = await huella(page);
      if (escribirHuella) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, JSON.stringify(h, null, 1) + '\n'); console.log('huella escrita en', FIX); }
      else {
        const antes = JSON.parse(fs.readFileSync(FIX, 'utf8'));
        paso(JSON.stringify(h.cuerpo) === JSON.stringify(antes.cuerpo) && JSON.stringify(h.dock) === JSON.stringify(antes.dock) && h.tieneCanvas && h.topbarVisible && !h.movil, 'escritorio 1280: la estructura clave es la de antes (canvas, barra, dock) y no hay versión móvil');
      }
      paso(!pedidos.includes('/movil.js'), 'escritorio 1280: no se descarga movil.js');
      await ctx.close();
      if (escribirHuella) return { fallos, res };
    }
    // ---- el teléfono ----
    const errores = [];
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }), page = await ctx.newPage();
    page.on('pageerror', e => errores.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon|net::ERR/.test(m.text())) errores.push('console: ' + m.text()); });
    await page.goto(o.base); await page.waitForSelector('#mvRoot .mv-tabs'); await page.waitForSelector('[data-vista="inicio"] .mv-card', { timeout: 15000 }); await espera(400);
    let toques = 0; const tocar = async sel => { toques++; await page.locator(sel).first().tap(); await espera(260); };
    const foto = async n => { if (!capturas) return; fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, n + '.jpg'), type: 'jpeg', quality: 55 }); };
    const texto = sel => page.locator(sel).first().innerText();

    paso(await page.locator('.mv-tabs .mv-tab').count() === 5, 'móvil: la barra de pestañas tiene 5 destinos');
    paso(await page.evaluate(() => getComputedStyle(document.getElementById('topbar')).display === 'none' && document.body.classList.contains('movil')), 'móvil: la barra y la oficina 3D de escritorio quedan escondidas');
    paso(await page.locator('.mv-tab[aria-current="page"]').getAttribute('data-tab') === 'inicio', 'móvil: Inicio es la pantalla de arranque (aria-current)');
    await foto('01-inicio');

    // ---- medidas: objetivos táctiles, campos, nombres ----
    const medir = async nombre => {
      const r = await page.evaluate(() => {
        const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden],[inert]'); };
        const raiz = document.getElementById('mvRoot'); const malos = [], sinNombre = [], chicos = [];
        for (const e of raiz.querySelectorAll('button, [role="button"], input:not([type="hidden"]), select, textarea, summary, a[href]')) {
          if (!vis(e) || e.closest('.md') && e.tagName === 'A') continue;
          const r = e.getBoundingClientRect();
          if (r.height < 43.5 || r.width < 43.5) malos.push(`${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]} ${Math.round(r.width)}×${Math.round(r.height)} «${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20)}»`);
          if (/INPUT|TEXTAREA|SELECT/.test(e.tagName) && parseFloat(getComputedStyle(e).fontSize) < 16) chicos.push(e.id || e.className);
          const n = (e.getAttribute('aria-label') || e.textContent || '').trim() || (e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent.trim()) || e.getAttribute('placeholder'); if (!n) sinNombre.push(e.className || e.tagName);
        }
        return { malos, sinNombre, chicos };
      });
      paso(!r.malos.length, `${nombre}: ningún objetivo táctil < 44 px${r.malos.length ? ' → ' + r.malos.slice(0, 5).join(' | ') : ''}`);
      paso(!r.chicos.length, `${nombre}: campos de 16 px o más${r.chicos.length ? ' → ' + r.chicos.join(', ') : ''}`);
      paso(!r.sinNombre.length, `${nombre}: todo control tiene nombre accesible${r.sinNombre.length ? ' → ' + r.sinNombre.join(', ') : ''}`);
    };
    const desborda = async nombre => {
      const r = await page.evaluate(() => { const w = innerWidth; const sobran = [...document.querySelectorAll('#mvRoot *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > w + 1 || b.left < -1) && !e.closest('.mv-chips, .mv-capa:not(.entra), .mv-burbuja .md table, .mv-borrador pre') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map(e => e.className || e.tagName); return { ancho: document.documentElement.scrollWidth <= w, sobran }; });
      return r;
    };
    await medir('Inicio');
    // ---- axe (si hay AO_AXE): sin críticos ni serios, claro y oscuro ----
    const AXE = process.env.AO_AXE && fs.existsSync(process.env.AO_AXE) ? process.env.AO_AXE : null;
    const axe = async nombre => {
      if (!AXE) return; if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ path: AXE });
      const v = await page.evaluate(async () => { const r = await window.axe.run(document.getElementById('mvRoot'), { resultTypes: ['violations'] }); return r.violations.filter(x => x.impact === 'critical' || x.impact === 'serious').map(x => `${x.id} (${x.impact}, ${x.nodes.length}): ${x.nodes[0].target.join(' ')}`); });
      paso(!v.length, `axe · ${nombre}: sin críticos ni serios${v.length ? ' → ' + v.join(' | ') : ''}`);
    };
    // ---- Inicio: conectores, franja de aprobación, Buscar ----
    await page.waitForSelector('[data-vista="inicio"] [aria-label="Conectores"]', { timeout: 8000 }).catch(() => {});
    paso(await page.locator('[data-vista="inicio"] [aria-label="Conectores"]').count() === 1, 'Inicio: los conectores se ven en una tarjeta (antes se escondían en el teléfono)');
    toques = 0; await tocar('[data-vista="inicio"] [data-conectores]'); await page.waitForSelector('.mv-hoja .mv-cxl, .mv-hoja .mv-meta'); await foto('01b-conectores'); await medir('Conectores (hoja)'); paso(toques <= 2, `Conectores: verlos está a ${toques} toques (≤ 2)`);
    await page.goBack(); await page.waitForSelector('.mv-hoja', { state: 'detached' });
    paso(await page.locator('.mv-franja:not([hidden]) [data-ver]').count() === 1 && /1 borrador espera/.test(await texto('.mv-franja')), 'Aprobaciones: la franja sobre la barra dice «1 borrador espera tu OK · Ver»'); await medir('Inicio con la franja');
    toques = 0; await tocar('.mv-buscar'); await page.waitForSelector('#findOv:not([hidden])', { timeout: 6000 }); paso(toques === 1, 'Buscar: un botón en la cabecera abre la búsqueda (1 toque)'); await foto('01c-buscar'); await page.goBack(); await page.waitForSelector('#findOv', { state: 'hidden' });
    await axe('Inicio');

    // ---- cada destino abre ----
    const destinos = [['tareas', '[data-vista="tareas"]'], ['dimitri', '[data-vista="dimitri"]'], ['calendario', '[data-vista="calendario"]'], ['inicio', '[data-vista="inicio"]']];
    for (const [t, sel] of destinos) { await tocar(`.mv-tab[data-tab="${t}"]`); await page.waitForSelector(sel + ':not([hidden])'); paso(await page.locator(`.mv-tab[data-tab="${t}"]`).getAttribute('aria-current') === 'page', `móvil: «${t}» abre y queda marcado (aria-current)`); await axe(t); if (t === 'tareas') { await page.waitForSelector('[data-vista="tareas"] .mv-fila'); await foto('02-tareas'); await medir('Tareas'); } if (t === 'calendario') { await page.waitForSelector('.mv-dia'); await foto('04-calendario-agenda'); await medir('Calendario'); } if (t === 'dimitri') { await page.waitForSelector('.mv-saludo, .mv-msg'); await foto('05-dimitri'); await medir('Dimitri'); } }
    await tocar('.mv-tab[data-tab="mas"]'); await page.waitForSelector('.mv-hoja.mv-mas'); await foto('08-mas'); await medir('Más');
    const entradas = await page.locator('.mv-hoja.mv-mas .mv-lista-b').allInnerTexts();
    paso(['Cerebro', 'Estudio', 'Contenido', 'Analíticas', 'Anuncios', 'Negocio', 'Costos', 'Conectores', 'Ajustes', 'Estado', 'Buscar'].every(n => entradas.some(t => t.startsWith(n))), 'Más: lista Cerebro, Estudio, Contenido, Analíticas, Anuncios, Negocio, Costos, Conectores, Ajustes, Estado y Buscar');
    await axe('Más'); await page.goBack(); await page.waitForSelector('.mv-hoja', { state: 'detached' });
    paso(true, 'Más: «atrás» del teléfono cierra la hoja');

    // ---- tareas ----
    await tocar('.mv-tab[data-tab="tareas"]');
    const nHoy = await page.locator('[data-vista="tareas"] .mv-fila').count();
    paso(nHoy >= 3, `Tareas (Hoy): se ven mis tareas de hoy y las vencidas (${nHoy})`);
    paso((await texto('[data-vista="tareas"] .mv-gh')).toLowerCase().includes('vencidas'), 'Tareas (Hoy): lo vencido va aparte y arriba');
    // añadir rápido
    toques = 1; await tocar('#mvNueva'); await page.fill('#mvNueva', 'Pagar el seguro para el viernes !alta #casa'); await espera(150);
    paso((await texto('.mv-entiende')).includes('prioridad alta'), 'Añadir: «Entendí: …» reconoce fecha, prioridad y etiqueta');
    await tocar('.mv-anadir .mv-enviar'); await page.waitForSelector('.mv-toast'); const n1 = toques;
    const t = (await o.api('/api/tareas/mias?')).listas; const todas = (await o.api('/api/tasks')).filter(x => x.person === 'Tú');
    const nueva = todas.find(x => /Pagar el seguro/.test(x.title));
    paso(nueva && nueva.prioridad === 'alta' && nueva.limite, `Añadir tarea: creada con prioridad alta y fecha límite (${nueva?.limite}) en ${n1} toques`);
    paso(n1 <= 3, `3 toques o menos: añadir una tarea (${n1})`);
    // completar con el toque
    toques = 1; const antesTxt = await texto('[data-vista="tareas"] .mv-fila:not(.hecha)');
    await tocar('[data-vista="tareas"] .mv-fila:not(.hecha) .mv-check'); await page.waitForSelector('.mv-toast:has-text("Hecha")'); const n2 = toques;
    paso(n2 <= 3, `3 toques o menos: completar una tarea (${n2})`);
    // deshacer
    await page.locator('.mv-toast-b').first().tap(); await espera(500);
    // detalle en hoja
    await tocar('[data-vista="tareas"] .mv-fila:not(.hecha) [data-abrir]'); await page.waitForSelector('.mv-hoja .mv-det'); await espera(500); await foto('03-tarea-detalle'); await medir('Detalle de tarea');
    paso(await page.locator('.mv-hoja textarea').evaluate(e => parseFloat(getComputedStyle(e).fontSize) >= 16), 'Detalle: el campo es de 16 px o más (iOS no hace zoom)');
    await page.goBack(); await page.waitForSelector('.mv-hoja', { state: 'detached' }); paso(true, 'Detalle: «atrás» cierra la hoja y no sale de la app');
    // chips
    for (const [k] of [['proximos'], ['todas'], ['delegadas'], ['hechas'], ['agentes']]) { await tocar(`[data-lista="${k}"]`); await page.waitForTimeout(200); paso(await page.locator(`[data-lista="${k}"]`).getAttribute('aria-pressed') === 'true', `Tareas: la lista «${k}» abre`); }
    await foto('02b-tareas-agentes'); await tocar('[data-lista="hoy"]');
    // deslizar para completar (gesto táctil real, por CDP)
    {
      const cdp = await ctx.newCDPSession(page); const li = page.locator('[data-vista="tareas"] .mv-fila:not(.hecha)').first(); const b = await li.boundingBox(); const id = await li.getAttribute('data-id');
      const y = b.y + b.height / 2, x0 = b.x + 70; const t = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await t('touchStart', x0); for (let i = 1; i <= 8; i++) { await t('touchMove', x0 + i * 22); await espera(15); } await t('touchEnd', 0); await espera(700);
      const r = (await o.api('/api/tasks')).find(x => x.id === id);
      paso(r && r.state === 'done', 'Tareas: deslizar a la derecha completa la tarea (y avisa con Deshacer)');
    }
    paso((await desborda('Tareas')).ancho, 'Tareas: sin desplazamiento horizontal');

    // ---- gestos: arrastrar la hoja para cerrarla, deslizar desde el borde para volver, tirar para refrescar ----
    {
      const cdp = await ctx.newCDPSession(page);
      const toque = async (puntos, paso = 14) => { const [a, ...r] = puntos; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] }); for (const p of r) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] }); await espera(paso); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await espera(500); };
      await tocar('.mv-tab[data-tab="tareas"]'); await page.waitForSelector('[data-vista="tareas"] .mv-fila:not(.hecha) [data-abrir]'); await tocar('[data-vista="tareas"] .mv-fila:not(.hecha) [data-abrir]'); await page.waitForSelector('.mv-hoja .mv-det'); await espera(450);
      const asa = await page.locator('.mv-hoja .mv-asa').boundingBox();
      await toque(Array.from({ length: 12 }, (_, i) => ({ x: asa.x + asa.width / 2, y: asa.y + 8 + i * 28 })));
      await page.waitForSelector('.mv-hoja', { state: 'detached', timeout: 3000 }).catch(() => {}); paso(await page.locator('.mv-hoja').count() === 0, 'Gestos: arrastrar la hoja hacia abajo la cierra');
      await page.waitForSelector('.mv-pend:not([hidden])'); await tocar('.mv-pend'); await page.waitForSelector('[data-vista="aprobaciones"] .mv-aprob');
      await toque(Array.from({ length: 10 }, (_, i) => ({ x: 6 + i * 18, y: 400 })));
      paso(await page.locator('[data-vista="aprobaciones"]:not([hidden])').count() === 0 && await page.locator('.mv-atras:not([hidden])').count() === 0, 'Gestos: deslizar desde el borde izquierdo vuelve de una pantalla');
      await tocar('.mv-tab[data-tab="tareas"]'); await page.waitForSelector('[data-vista="tareas"] .mv-filas'); await espera(300); let pedidos = 0; const cuenta = r => { if (/\/api\/tasks\?light=1/.test(r.url())) pedidos++; }; page.on('request', cuenta);
      const sc = await page.locator('#mvTareasSc').boundingBox();
      await page.evaluate(() => { document.getElementById('mvTareasSc').scrollTop = 0; });
      await toque(Array.from({ length: 10 }, (_, i) => ({ x: sc.x + 200, y: sc.y + 60 + i * 16 })));
      await espera(600); page.off('request', cuenta);
      paso(pedidos >= 1, `Gestos: tirar hacia abajo desde arriba refresca la lista (${pedidos} lectura)`);
    }

    // ---- aprobaciones ----
    await tocar('.mv-tab[data-tab="inicio"]'); await page.waitForSelector('.mv-pend:not([hidden])');
    paso((await page.locator('.mv-pend').getAttribute('aria-label')).startsWith('1 espera'), 'Aprobaciones: el ⚠ de la cabecera dice cuántas esperan (1)');
    toques = 0; await tocar('.mv-pend'); await page.waitForSelector('[data-vista="aprobaciones"] .mv-aprob'); await foto('06-aprobaciones'); await medir('Aprobaciones');
    const tarj = await texto('[data-vista="aprobaciones"] .mv-aprob');
    paso(/compras@acme\.com/i.test(tarj) && /lo que saldrá/i.test(tarj) && /riesgo/i.test(tarj), 'Aprobaciones: la tarjeta dice «Lo que saldrá», a quién y el riesgo');
    await tocar('[data-aprobar]'); await page.waitForSelector('.mv-hoja [data-acc]'); await foto('06b-aprobar-confirmar'); await medir('Confirmar aprobación');
    await page.locator('.mv-hoja .mv-btn.primario, .mv-hoja .mv-btn.peligro').last().tap(); toques++; await espera(900);
    paso(toques <= 3, `3 toques o menos: aprobar (${toques})`);
    const ap = (await o.api('/api/tasks')).find(x => x.id === 'seed7');
    paso(ap && (ap.state !== 'waiting' || ap.approving), `Aprobaciones: aprobar de verdad cambia la tarea en la oficina (${ap?.state})`);
    await page.waitForFunction(() => document.querySelector('.mv-pend')?.hidden !== false, null, { timeout: 8000 }).catch(() => {});

    // ---- calendario ----
    toques = 0; await tocar('.mv-tab[data-tab="calendario"]'); await page.waitForSelector('.mv-dia.hoy');
    paso(toques === 1 && /Hoy/.test(await texto('.mv-dia.hoy h3')), 'Calendario: la agenda de hoy está a 1 toque');
    paso(await page.locator('.mv-ev').count() >= 1, 'Calendario: la agenda lista lo programado (tarea del agente y fechas límite)');
    await tocar('[data-modo="mes"]'); await page.waitForSelector('.mv-celda'); await foto('04b-calendario-mes'); await medir('Calendario (mes)');
    await tocar('.mv-fab'); await page.waitForSelector('.mv-hoja #mvNt'); await foto('04c-calendario-crear'); await medir('Nueva tarea (calendario)'); await page.goBack(); await page.waitForSelector('.mv-hoja', { state: 'detached' });
    await tocar('[data-modo="tres"]'); await page.waitForTimeout(150); paso(await page.locator('.mv-dia').count() === 3, 'Calendario: la vista de 3 días enseña tres días'); await foto('04d-calendario-3dias');
    await tocar('[data-modo="agenda"]');

    // ---- Dimitri ----
    toques = 0; await tocar('.mv-tab[data-tab="dimitri"]'); await page.waitForSelector('#mvDim');
    await tocar('#mvDim'); await page.fill('#mvDim', '¿Cómo vamos?'); await tocar('.mv-compone .mv-enviar'); await page.waitForSelector('.mv-msg.suyo', { timeout: 15000 }).catch(() => {});
    paso(toques <= 3, `3 toques o menos: hablar con Dimitri (${toques})`);
    paso(await page.locator('.mv-msg.mio').count() >= 1, 'Dimitri: el mensaje del dueño aparece en el hilo');
    await foto('05b-dimitri-chat');
    toques = 0; await tocar('[aria-label="Conversaciones guardadas"]'); await page.waitForSelector('.mv-hoja'); await foto('05c-dimitri-historial'); paso(toques <= 2, `Dimitri: el historial está a ${toques} toques`); await page.goBack(); await page.waitForSelector('.mv-hoja', { state: 'detached' });
    paso((await desborda('Dimitri')).ancho, 'Dimitri: sin desplazamiento horizontal');

    // ---- Más → vista de escritorio dentro del contenedor ----
    toques = 0; await tocar('.mv-tab[data-tab="mas"]'); await page.waitForSelector('.mv-hoja.mv-mas'); await tocar('[data-esc="cerebro"]'); await page.waitForFunction(() => document.body.classList.contains('mv-esc') && document.getElementById('brainOv')?.classList.contains('on'), null, { timeout: 8000 }); await espera(700);
    paso(toques <= 3, `3 toques o menos: abrir el Cerebro desde Más (${toques})`);
    paso(await page.locator('.mv-atras:not([hidden])').count() === 1 && (await texto('.mv-titulo')) === 'Cerebro', 'Más → Cerebro: la cabecera dice «Cerebro» y tiene su botón Volver');
    const caja = await page.evaluate(() => { const r = document.getElementById('brainOv').getBoundingClientRect(); const b = document.querySelector('.mv-bar').getBoundingClientRect(), t = document.querySelector('.mv-tabs').getBoundingClientRect(); return { dentro: r.top >= b.bottom - 1 && r.bottom <= t.top + 1, ancho: r.width <= innerWidth + 1 }; });
    paso(caja.dentro && caja.ancho, 'Más → Cerebro: la vista de escritorio cabe entre la cabecera y la barra de pestañas'); await foto('09-cerebro-escritorio');
    await tocar('.mv-atras'); await page.waitForFunction(() => !document.body.classList.contains('mv-esc') && !document.getElementById('brainOv').classList.contains('on'), null, { timeout: 5000 });
    paso(true, 'Más → Cerebro: «Volver» cierra la vista y regresa a la pantalla de antes');
    // ajustes (una ventana): sale y vuelve
    await tocar('.mv-tab[data-tab="mas"]'); await page.waitForSelector('.mv-hoja.mv-mas'); await tocar('[data-esc="ajustes"]'); await page.waitForSelector('#setOv:not([hidden])', { timeout: 8000 }); await espera(500); await foto('10-ajustes-escritorio');
    const aj = await page.evaluate(() => { const b = document.querySelector('#setOv .sg-box').getBoundingClientRect(); return b.width <= innerWidth + 1 && b.left >= -1; });
    paso(aj, 'Más → Ajustes: la ventana cabe en el ancho del teléfono'); await page.goBack(); await page.waitForSelector('#setOv', { state: 'hidden' }); paso(true, 'Más → Ajustes: «atrás» la cierra');

    // ---- tema oscuro ----
    await tocar('.mv-tab[data-tab="mas"]'); await page.waitForSelector('.mv-hoja.mv-mas'); await tocar('[data-tema="dark"]'); await espera(300); await page.goBack(); await page.waitForSelector('.mv-hoja', { state: 'detached' });
    paso(await page.evaluate(() => document.body.classList.contains('dark')), 'Tema: Oscuro desde Más');
    for (const t of ['inicio', 'tareas', 'dimitri', 'calendario']) { await page.locator(`.mv-tab[data-tab="${t}"]`).tap(); await espera(400); await axe(t + ' (oscuro)'); } await tocar('.mv-tab[data-tab="inicio"]'); await espera(300); await foto('11-inicio-oscuro');
    const cont = await page.evaluate(() => { const l = c => { const m = c.match(/\d+/g).map(Number); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); }; const par = (a, b) => { const x = l(a), y = l(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }; const raiz = document.getElementById('mvRoot'), cs = getComputedStyle(raiz); const fondo = cs.getPropertyValue('--mv-bg'); const tinta = getComputedStyle(document.querySelector('.mv-titulo')).color; const grey = getComputedStyle(document.querySelector('.mv-fecha')).color; return { tinta: par(tinta, getComputedStyle(document.querySelector('.mv-main')).backgroundColor), gris: par(grey, getComputedStyle(document.querySelector('.mv-main')).backgroundColor) }; });
    paso(cont.tinta >= 7 && cont.gris >= 4.5, `Tema oscuro: contraste AA (texto ${cont.tinta.toFixed(1)}:1, gris ${cont.gris.toFixed(1)}:1)`);
    await page.evaluate(() => window.CC?.setDark(false)); await page.evaluate(() => localStorage.setItem('ao.theme', 'light'));

    // ---- anchos ----
    for (const w of [320, 360, 390, 430]) {
      await page.setViewportSize({ width: w, height: 800 }); await espera(250);
      for (const [t, vista] of [['inicio', 'inicio'], ['tareas', 'tareas'], ['calendario', 'calendario'], ['dimitri', 'dimitri']]) {
        await page.locator(`.mv-tab[data-tab="${t}"]`).tap(); await espera(220);
        const d = await desborda(t); paso(d.ancho && !d.sobran.length, `${w} px · ${vista}: sin desbordamiento horizontal${d.sobran.length ? ' → ' + d.sobran.join(', ') : ''}`);
      }
      if (w === 320) await foto('12-320-inicio-tabs');
      await page.locator('.mv-pend').isVisible().catch(() => {});
    }
    await page.setViewportSize({ width: 390, height: 844 });
    paso(!errores.length, `sin errores de JavaScript en la consola${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`);
    // ---- al crecer la ventana, vuelve el escritorio ----
    await page.setViewportSize({ width: 1280, height: 800 }); await espera(600);
    paso(await page.evaluate(() => !document.getElementById('mvRoot') && !document.body.classList.contains('movil') && getComputedStyle(document.getElementById('topbar')).display !== 'none'), 'al ensanchar la ventana a 1280 px vuelve el escritorio (sin recargar)');
    await page.setViewportSize({ width: 390, height: 844 }); await espera(800);
    paso(await page.evaluate(() => !!document.getElementById('mvRoot')), 'al estrechar otra vez vuelve la versión móvil');
    // preferencia manual: forzar el escritorio en un teléfono y volver
    await page.evaluate(() => { localStorage.setItem('ao.movil', 'escritorio'); dispatchEvent(new Event('ao:movil')); }); await espera(600);
    paso(await page.evaluate(() => !document.getElementById('mvRoot')), 'preferencia «Escritorio»: en un teléfono se queda la versión de escritorio');
    await page.evaluate(() => { localStorage.removeItem('ao.movil'); dispatchEvent(new Event('ao:movil')); }); await espera(600);
    paso(await page.evaluate(() => !!document.getElementById('mvRoot')), 'preferencia «Automática»: vuelve la versión móvil');
    await ctx.close();
  } finally { await browser.close(); o.cerrar(); }
  console.log(`\n${fallos ? fallos + ' paso(s) fallaron' : 'todo en orden'} (${res.length} comprobaciones)`);
  return { fallos, res };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await correr({ capturas: process.argv.includes('--capturas'), escribirHuella: process.argv.includes('--huella') });
  process.exit(r.fallos ? 1 : 0);
}
