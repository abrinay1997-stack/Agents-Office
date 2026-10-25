// Herramienta de desarrollo y prueba de navegador del EQUIPO E de la versión móvil (25 oct 2026): Tareas, Calendario y Dimitri completos.
// Oficina temporal (serve.mjs real, sin keys, Claude que no responde) y un Chromium de teléfono con toque. Comprueba, y falla si algo no se cumple:
//   · Tareas: filtros (y guardados), detalle a pantalla completa con guardado visible (prioridad, fecha, pasos, etiquetas, bloqueos,
//     comentarios), cronómetro, delegar, «Lo hago yo», tablero (mover por hoja), proyectos (crear, añadir tarea, quién espera a quién), medidas;
//   · Calendario: día con horas y línea de «ahora», crear una rutina semanal (≤ 8 toques), mover una ejecución (solo esta vez / siempre), saltar,
//     pausar, ejecutar ahora, editar, capas, buscar, suscribirse;
//   · Dimitri: respuesta en vivo con «Detener», «Viendo», plan revisable pieza por pieza y ENVIAR A LOS JEFES, cambios con Deshacer de 30 s,
//     preguntas con opciones, nueva conversación con DESHACER, error con «Reintentar»;
//   · 0 desbordes a 320/360/390/430, 0 objetivos < 44 px, campos ≥ 16 px, nombres accesibles, axe (con AO_AXE) en claro y oscuro, las tareas
//     comunes en ≤ 3 toques.
//   node scripts/movil-e-recorrido.mjs [--capturas]     AO_AXE=<axe.min.js> para axe
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { oficina } from './movil-recorrido.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'docs', 'capturas-movil', 'despues');
const espera = ms => new Promise(r => setTimeout(r, ms));
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function correr({ capturas = false } = {}) {
  const res = []; let fallos = 0;
  const paso = (ok, que) => { if (!ok) fallos++; res.push({ ok: !!ok, que }); console.log(`${ok ? '✓' : '✗'} ${que}`); };
  const o = await oficina();
  const medidas = {}; // objetivos < 44 px por pantalla (la tabla antes/después)
  let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  try {
    // ---- los datos de la prueba ----
    const ahora = Date.now(), man = ymd(new Date(ahora + 864e5));
    const proy = (await o.api('/api/tareas/proyectos', 'POST', { nombre: 'Lanzamiento de la colección', objetivo: 'Vender 200 pares el primer mes', color: 'verde', limite: ymd(new Date(ahora + 20 * 864e5)) })).proyecto;
    const et = (await o.api('/api/tareas/etiquetas', 'POST', { nombre: 'ventas' })).etiqueta;
    await o.api('/api/tareas/seed1/organizar', 'POST', { proyecto: proy.id, etiquetas: [et.id], pasos: ['Buscar el teléfono', 'Llamar'], estimacion: 30 });
    await o.api('/api/tareas/seed4/organizar', 'POST', { proyecto: proy.id, bloqueadaPor: ['seed1'] });
    const r1 = (await o.api('/api/routines', 'POST', { dept: 'marketing', text: 'Revisar las redes y resumir lo importante', when: { kind: 'weekly', days: [1], at: '09:00' }, needsOk: true })).routine;
    const r2 = (await o.api('/api/routines', 'POST', { dept: 'fin', text: 'Cerrar la caja del día', when: { kind: 'daily', at: '18:00' }, needsOk: true })).routine;
    const msgs = [
      { id: 'm1', who: 'user', text: 'Prepara el lanzamiento de la colección', at: ahora - 90000, context: { label: 'Tus tareas · Hoy' } },
      { id: 'm2', who: 'sub', text: 'Te propongo este plan para el lanzamiento:', at: ahora - 80000, mode: 'plan', plan: { proyecto: { nombre: 'Lanzamiento', limite: ymd(new Date(ahora + 20 * 864e5)) }, tasks: [
        { i: 0, dept: 'marketing', title: 'Diseñar las fotos del lanzamiento', instruction: 'Haz 5 fotos del producto con fondo claro.', why: 'Sin fotos no hay campaña', state: 'proposed', at: ahora + 5 * 3600e3, prioridad: 'alta' },
        { i: 1, dept: 'sales', title: 'Preparar la lista de clientes que más compran', instruction: 'Saca los 20 mejores clientes.', state: 'proposed', at: ahora - 1000 },
        { i: 2, dept: 'dueno', title: 'Elegir el precio de lanzamiento', instruction: 'Decide el precio.', state: 'proposed', espera: [0] }],
        questions: [{ id: 'canal', q: 'Por qué canal lo anunciamos', options: [{ label: 'Instagram', value: 'ig' }, { label: 'Facebook', value: 'fb' }, { label: 'Correo', value: 'mail' }], multi: true, other: true }] } },
      { id: 'm3', who: 'sub', text: 'Puedo hacer este cambio:', at: ahora - 70000, mode: 'plan', ops: [{ k: 0, type: 'rutina_pausar', id: r2.id, title: r2.title, state: 'proposed' }, { k: 1, type: 'anuncio_activar', id: 'a1', nombre: 'Campaña de octubre', state: 'proposed', confirmar: { token: 't', texto: 'x', vence: ahora + 100000, cifras: { dia: 15 } } }] },
    ];
    fs.writeFileSync(path.join(o.data, 'subgerente.json'), JSON.stringify({ messages: msgs }));
    for (const t of [['Mover la hoja de gastos', 0], ['Responder el mensaje de Ana', 0]]) await o.api('/api/tareas/mias', 'POST', { title: t[0], limite: ymd(new Date(ahora + t[1] * 864e5)) });

    // ---- el teléfono ----
    const errores = [];
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale: 'es-PA' }), page = await ctx.newPage();
    page.on('pageerror', e => errores.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon|net::ERR/.test(m.text())) errores.push('console: ' + m.text()); });
    // un /api/sub/chat de mentira que responde POCO A POCO (como el de verdad) y apunta lo que se le mandó
    await page.addInitScript(() => {
      window.__chat = []; window.__chatModo = 'vivo';
      const f = window.fetch.bind(window);
      window.fetch = (u, init) => {
        const url = typeof u === 'string' ? u : u.url;
        if (!/\/api\/sub\/chat$/.test(url)) return f(u, init);
        const cuerpo = JSON.parse(init.body); window.__chat.push(cuerpo);
        if (window.__chatModo === 'cae') return Promise.reject(new TypeError('Failed to fetch'));
        const enc = new TextEncoder(), ahora = Date.now();
        const mu = { id: 'u' + ahora, who: 'user', text: cuerpo.text, at: ahora, ...(cuerpo.context ? { context: { label: cuerpo.context.label } } : {}) }, ms = { id: 's' + ahora, who: 'sub', text: 'Hoy tienes **3 cosas** para hacer: llamar al banco, revisar el inventario y la reunión.', at: ahora + 1, mode: 'charla' };
        const lineas = [{ type: 'start', run: 'r1' }, { type: 'reply', text: 'Hoy tienes ', mode: 'charla' }, 'espera', { type: 'reply', text: 'Hoy tienes **3 cosas** para hacer', mode: 'charla' }, 'espera', { type: 'done', messages: [mu, ms], ...(cuerpo.answers ? { answered: { msg: cuerpo.answers.msg, answers: [{ id: 'canal', label: 'Instagram', values: ['ig'] }] } } : {}) }];
        return Promise.resolve(new Response(new ReadableStream({ async start(c) { for (const l of lineas) { if (l === 'espera') await new Promise(r => setTimeout(r, window.__chatPausa || 1400)); else c.enqueue(enc.encode(JSON.stringify(l) + '\n')); } c.close(); } }), { status: 200, headers: { 'content-type': 'application/x-ndjson' } }));
      };
    });
    await page.goto(o.base); await page.waitForSelector('#mvRoot .mv-tabs'); await page.waitForSelector('[data-vista="inicio"] .mv-card', { timeout: 15000 }); await espera(400);
    let toques = 0; const tocar = async sel => { toques++; await page.locator(sel).first().tap(); await espera(220); };
    const foto = async n => { if (!capturas) return; fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, 'e-' + n + '.jpg'), type: 'jpeg', quality: 52, scale: 'css' }); };
    const texto = sel => page.locator(sel).first().innerText();
    const cuenta = sel => page.locator(sel).count();
    const tareas = async () => (await o.api('/api/tasks'));
    const tarea = async id => (await tareas()).find(x => x.id === id);
    const rutinas = async () => (await o.api('/api/routines')).routines;
    const cerrarHoja = async () => { await page.goBack(); await page.waitForSelector('.mv-hoja', { state: 'detached', timeout: 4000 }).catch(() => {}); await espera(120); };
    const hojaAbierta = sel => page.waitForSelector(`.mv-hoja ${sel}`, { timeout: 8000 });
    const esperaSrv = async (fn, ms = 6000) => { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch { /* sigue */ } if (Date.now() - t0 > ms) return null; await espera(150); } };

    // ---- medidas ----
    const medir = async nombre => {
      const r = await page.evaluate(() => {
        const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden],[inert]') && !e.closest('.mv-capa:not(.entra)'); };
        const raiz = document.getElementById('mvRoot'); const malos = [], sinNombre = [], chicos = [];
        for (const e of raiz.querySelectorAll('button, [role="button"], [role="switch"], input:not([type="hidden"]), select, textarea, summary, a[href]')) {
          if (!vis(e) || (e.closest('.md') && e.tagName === 'A')) continue;
          const r = e.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) continue; // lo que está fuera de la pantalla se mide cuando se ve
          if (r.height < 43.5 || r.width < 43.5) malos.push(`${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]} ${Math.round(r.width)}×${Math.round(r.height)} «${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20)}»`);
          if (/INPUT|TEXTAREA|SELECT/.test(e.tagName) && parseFloat(getComputedStyle(e).fontSize) < 16) chicos.push(e.id || e.className);
          const n = (e.getAttribute('aria-label') || e.textContent || '').trim() || (e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent.trim()) || e.getAttribute('placeholder'); if (!n) sinNombre.push(e.className || e.tagName);
        }
        return { malos, sinNombre, chicos };
      });
      medidas[nombre] = r.malos.length;
      paso(!r.malos.length, `${nombre}: ningún objetivo táctil < 44 px${r.malos.length ? ' → ' + r.malos.slice(0, 5).join(' | ') : ''}`);
      paso(!r.chicos.length, `${nombre}: campos de 16 px o más${r.chicos.length ? ' → ' + r.chicos.join(', ') : ''}`);
      paso(!r.sinNombre.length, `${nombre}: todo control tiene nombre accesible${r.sinNombre.length ? ' → ' + r.sinNombre.join(', ') : ''}`);
    };
    const desborda = async () => page.evaluate(() => {
      const w = innerWidth, scroller = e => { for (let x = e.parentElement; x && x.id !== 'mvRoot'; x = x.parentElement) { const s = getComputedStyle(x); if (/(auto|scroll)/.test(s.overflowX)) return true; } return false; };
      const sobran = [...document.querySelectorAll('#mvRoot *')].filter(e => { const b = e.getBoundingClientRect(); if (!(b.width > 0) || !(b.right > w + 1 || b.left < -1)) return false; if (e.closest('.mv-capa:not(.entra)') || e.closest('[hidden]')) return false; return !scroller(e); }).slice(0, 5).map(e => `${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]} ${Math.round(e.getBoundingClientRect().left)}→${Math.round(e.getBoundingClientRect().right)}`);
      return { ancho: document.documentElement.scrollWidth <= w, sobran };
    });
    const AXE = process.env.AO_AXE && fs.existsSync(process.env.AO_AXE) ? process.env.AO_AXE : null;
    const axe = async nombre => {
      if (!AXE) return; if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ path: AXE });
      const v = await page.evaluate(async () => { const r = await window.axe.run(document.getElementById('mvRoot'), { resultTypes: ['violations'] }); return r.violations.filter(x => x.impact === 'critical' || x.impact === 'serious').map(x => `${x.id} (${x.impact}, ${x.nodes.length}): ${x.nodes[0].target.join(' ')}`); });
      paso(!v.length, `axe · ${nombre}: sin críticos ni serios${v.length ? ' → ' + v.join(' | ') : ''}`);
    };
    const sinDesborde = async nombre => { const d = await desborda(); paso(d.ancho && !d.sobran.length, `${nombre}: sin desplazamiento horizontal${d.sobran.length ? ' → ' + d.sobran.join(', ') : ''}`); };

    // =====================================================  TAREAS  =====================================================
    await tocar('.mv-tab[data-tab="tareas"]'); await page.waitForSelector('[data-vista="tareas"] .mv-fila');
    paso(await cuenta('[data-tv]') === 4, 'Tareas: cuatro vistas (Lista, Tablero, Proyectos, Medidas)');
    await foto('tareas-lista'); await medir('Tareas · Lista'); await axe('Tareas · Lista'); await sinDesborde('Tareas · Lista');

    // filtros
    await tocar('[data-filtrar]'); await hojaAbierta('[data-fp="alta"]'); await foto('tareas-filtrar'); await medir('Tareas · hoja de filtros'); await axe('Tareas · hoja de filtros');
    await tocar('.mv-hoja [data-fp="alta"]'); await page.fill('.mv-hoja #mvFn', 'Urgentes'); await tocar('.mv-hoja .mv-btn.primario'); await page.waitForSelector('.mv-hoja', { state: 'detached' }); await espera(300);
    paso(await cuenta('[data-vista="tareas"] .mv-cuerpo-l .mv-fila') === 1 && /prioridad alta/i.test(await texto('.mv-filtro-act')), 'Filtros: «prioridad alta» deja solo lo urgente y lo dice');
    paso(await cuenta('[data-fg]') === 1, 'Filtros: el filtro guardado «Urgentes» queda como un chip');
    await tocar('[data-quitar-filtro]'); await page.waitForSelector('[data-vista="tareas"] .mv-cuerpo-l .mv-fila'); const todasN = await cuenta('[data-vista="tareas"] .mv-cuerpo-l .mv-fila'); paso(todasN > 1, 'Filtros: «Quitar» devuelve todas');
    await tocar('[data-fg]'); await espera(200); paso(await cuenta('[data-vista="tareas"] .mv-cuerpo-l .mv-fila') === 1, 'Filtros: tocar el guardado vuelve a aplicarlo'); await tocar('[data-quitar-filtro]');

    // el detalle, con guardado visible
    await tocar('[data-lista="todas"]'); await page.waitForSelector('[data-vista="tareas"] .mv-fila');
    const fila1 = page.locator('[data-vista="tareas"] .mv-fila', { hasText: 'Llamar al banco' }).first(); toques = 0; await fila1.locator('[data-abrir]').tap(); toques++;
    await page.waitForSelector('.mv-hoja.completa .mv-det-e .mv-titin'); await espera(500);
    paso(await page.evaluate(() => { const b = document.querySelector('.mv-hoja.completa').getBoundingClientRect(); return b.height >= innerHeight - 2 && b.width >= innerWidth - 1; }), 'Detalle: ocupa toda la pantalla');
    paso(/guarda solo|Guardado/i.test(await texto('.mv-guarda')), 'Detalle: la franja de arriba dice que todo se guarda solo');
    await foto('tarea-detalle'); await medir('Detalle de tarea'); await axe('Detalle de tarea'); await sinDesborde('Detalle de tarea');
    await tocar('[data-prio="baja"]'); await page.waitForSelector('.mv-guarda.ok'); paso(/Guardado/.test(await texto('.mv-guarda')) && (await tarea('seed1')).prioridad === 'baja', 'Detalle: cambiar la prioridad se guarda solo y la franja dice «Guardado ✓»');
    await tocar(`[data-lim="${man}"]`); const lim1 = await esperaSrv(async () => (await tarea('seed1')).limite === man); paso(!!lim1, 'Detalle: «Mañana» pone la fecha límite de mañana');
    await page.fill('#mvAP', 'Revisar el saldo'); await tocar('[data-nuevo-paso]'); paso(!!(await esperaSrv(async () => (await tarea('seed1')).pasos.length === 3)), 'Detalle: añadir un paso lo guarda');
    await tocar('.mv-pasos .mv-check'); paso(!!(await esperaSrv(async () => (await tarea('seed1')).pasos[0].hecho === true)), 'Detalle: marcar un paso lo guarda (casilla de 44 px)');
    await page.fill('#mvNE', 'urgente'); await tocar('[data-nueva-et]'); paso(!!(await esperaSrv(async () => (await tarea('seed1')).etiquetas.length === 2)), 'Detalle: una etiqueta nueva se crea y se pone');
    await tocar('[data-anadir-bl]'); await hojaAbierta('[data-id]'); await tocar('.mv-hoja [data-id]'); paso(!!(await esperaSrv(async () => (await tarea('seed1')).bloqueadaPor?.length === 1)), 'Detalle: «Que espere a…» elige otra tarea de una lista y la guarda');
    await page.fill('#mvCo', 'Llamé y no contestó'); await tocar('[data-comentar]'); paso(!!(await esperaSrv(async () => (await tarea('seed1')).comments?.length === 1)), 'Detalle: un comentario se envía');
    // cronómetro
    await tocar('[data-crono="iniciar"]'); paso(!!(await esperaSrv(async () => (await tarea('seed1')).cronometro?.some(c => !c.fin))), 'Detalle: «Empezar a contar el tiempo» arranca el cronómetro');
    await page.goBack(); await page.waitForSelector('.mv-hoja', { state: 'detached' }); await page.waitForSelector('.mv-crono:not([hidden])', { timeout: 8000 });
    paso(/Contando/.test(await texto('.mv-crono')) && /Llamar al banco/.test(await texto('.mv-crono')), 'Cronómetro: queda a la vista arriba con el tiempo corriendo'); await foto('tareas-cronometro'); await medir('Tareas · con el cronómetro');
    await tocar('[data-parar]'); await page.waitForSelector('.mv-crono', { state: 'hidden', timeout: 8000 }); paso(!(await tarea('seed1')).cronometro.some(c => !c.fin), 'Cronómetro: «Parar» lo detiene');
    // delegar
    await tocar('[data-lista="todas"]'); await page.locator('[data-vista="tareas"] .mv-fila', { hasText: 'inventario' }).first().locator('[data-abrir]').tap(); await page.waitForSelector('.mv-hoja.completa .mv-titin'); await espera(300);
    await tocar('[data-acc="delegar"]'); await hojaAbierta('#mvDgD'); await foto('tarea-delegar'); await medir('Delegar (hoja)'); await axe('Delegar (hoja)');
    await page.selectOption('.mv-hoja #mvDgD', 'marketing'); await page.locator('.mv-capa').last().locator('.mv-btn.primario').last().tap(); await espera(300);
    const del = await esperaSrv(async () => { const t = await tarea('seed2'); return t.agent && !t.person && t.delegada; }); paso(!!del, 'Delegar: la tarea pasa a un agente de Marketing y sale de mi lista');
    await page.waitForSelector('.mv-hoja', { state: 'detached', timeout: 6000 }).catch(() => {});
    // «Lo hago yo» con la tarea de un agente
    await tocar('[data-lista="agentes"]'); await page.waitForSelector('[data-vista="tareas"] .mv-fila.ag'); await page.locator('[data-vista="tareas"] .mv-fila.ag', { hasText: 'Post de lanzamiento' }).first().locator('[data-abrir]').tap(); await page.waitForSelector('.mv-hoja.completa .mv-titin'); await espera(300);
    await tocar('[data-acc="tomar"]'); paso(!!(await esperaSrv(async () => (await tarea('seed6')).person === 'Tú')), '«Lo hago yo»: la tarea de un agente pasa a mi lista'); await page.waitForTimeout(500);
    await page.goBack(); await page.waitForSelector('.mv-hoja', { state: 'detached' }).catch(() => {});

    // tablero
    await tocar('[data-tv="tablero"]'); await page.waitForSelector('.mv-tablero .mv-col'); await espera(400);
    paso(await cuenta('.mv-col') === 8, 'Tablero: una columna por estado (8)'); await foto('tablero'); await medir('Tareas · Tablero'); await axe('Tareas · Tablero'); await sinDesborde('Tareas · Tablero');
    await tocar('.mv-col[data-col="personas"] [data-mover]'); await hojaAbierta('[data-dest]'); await foto('tablero-mover'); await medir('Tablero · Mover a… (hoja)');
    const titMover = await texto('.mv-hoja .mv-meta'); await tocar('.mv-hoja [data-dest="hecha"]'); await espera(900);
    paso(!!(await esperaSrv(async () => (await tareas()).some(t => t.person === 'Tú' && t.state === 'done' && titMover.includes(t.title.slice(0, 20))))), 'Tablero: «Mover a…» → «marcarla hecha» cambia la tarea de verdad');

    // proyectos
    await tocar('[data-tv="proyectos"]'); await page.waitForSelector('.mv-proy'); paso(/Lanzamiento/.test(await texto('.mv-proy')), 'Proyectos: la lista muestra el proyecto con su progreso'); await foto('proyectos'); await medir('Tareas · Proyectos'); await axe('Tareas · Proyectos');
    await tocar('[data-nuevo-proy]'); await hojaAbierta('#mvFN'); await page.fill('.mv-hoja #mvFN', 'Cierre de mes'); await foto('proyecto-nuevo'); await medir('Nuevo proyecto (hoja)');
    await page.locator('.mv-hoja .mv-btn.primario').last().tap(); await page.waitForSelector('.mv-pdet-c', { timeout: 8000 }); await espera(500);
    paso(!!(await esperaSrv(async () => (await o.api('/api/tareas/catalogo')).proyectos.some(p => p.nombre === 'Cierre de mes'))), 'Proyectos: crear uno nuevo lo guarda y abre su detalle');
    await tocar('[data-anadir-tarea]'); await hojaAbierta('#mvPT'); await page.fill('.mv-hoja #mvPT', 'Cuadrar la caja'); await page.locator('.mv-capa').last().locator('.mv-btn.primario').last().tap();
    paso(!!(await esperaSrv(async () => { const p = (await o.api('/api/tareas/catalogo')).proyectos.find(x => x.nombre === 'Cierre de mes'); return (await tareas()).some(t => t.title === 'Cuadrar la caja' && t.proyecto === p.id); })), 'Proyectos: «Añadir tarea» crea la tarea dentro del proyecto');
    await page.waitForTimeout(600); await page.goBack(); await page.waitForSelector('.mv-hoja', { state: 'detached' }).catch(() => {}); await page.waitForTimeout(300);
    if (await cuenta('.mv-hoja')) await cerrarHoja();
    await page.locator('.mv-proy', { hasText: 'Lanzamiento' }).first().tap(); await page.waitForSelector('.mv-pdet-c .mv-bloq', { timeout: 8000 }); await espera(300);
    paso(/espera a|la esperan/.test(await texto('.mv-bloq')), 'Proyectos: «Quién espera a quién» dice qué tarea espera a cuál'); await foto('proyecto-detalle'); await medir('Proyecto (detalle)'); await axe('Proyecto (detalle)');
    await page.goBack(); await page.waitForSelector('.mv-hoja', { state: 'detached' });

    // medidas
    await tocar('[data-tv="medidas"]'); await page.waitForSelector('.mv-kpi'); await espera(300); paso(await cuenta('.mv-kpi') === 10, 'Medidas: diez cifras'); await foto('medidas'); await medir('Tareas · Medidas'); await axe('Tareas · Medidas'); await sinDesborde('Tareas · Medidas');
    await tocar('.mv-kpi:not([disabled])'); await hojaAbierta('[data-abrir], .mv-vacio'); paso(await cuenta('.mv-hoja [data-abrir]') >= 1, 'Medidas: tocar una cifra abre las tareas que la forman'); await cerrarHoja();
    await tocar('[data-tv="lista"]');

    // =====================================================  CALENDARIO  =====================================================
    toques = 0; await tocar('.mv-tab[data-tab="calendario"]'); await page.waitForSelector('[data-vista="calendario"] .mv-dia.hoy');
    await medir('Calendario · Agenda'); await axe('Calendario · Agenda'); await sinDesborde('Calendario · Agenda'); await foto('calendario-agenda');
    await tocar('[data-modo="dia"]'); await page.waitForSelector('.mv-linea-dia'); await espera(500);
    paso(await cuenta('.mv-hr') === 24, 'Día: 24 horas en una columna'); paso(await cuenta('.mv-ahora') === 1, 'Día: la línea de «ahora» está');
    paso(await page.evaluate(() => { const l = document.querySelector('.mv-ahora').getBoundingClientRect(), s = document.querySelector('#mvRoot [data-vista="calendario"] .mv-scroll').getBoundingClientRect(); return l.top >= s.top && l.bottom <= s.bottom; }), 'Día: al abrir, la línea de «ahora» queda a la vista');
    await foto('calendario-dia'); await medir('Calendario · Día'); await axe('Calendario · Día'); await sinDesborde('Calendario · Día');
    {
      await page.locator('.mv-hr[data-hora="10:00"]').evaluate(e => e.scrollIntoView({ block: 'center' })); await espera(200);
      const b = await page.locator('.mv-hr[data-hora="10:00"]').boundingBox(); await page.touchscreen.tap(b.x + 120, b.y + 10); await espera(350);
      await hojaAbierta('[data-k="tarea"]'); await page.locator('.mv-hoja [data-k="tarea"]').tap(); await hojaAbierta('#mvNh'); await espera(300);
      paso((await page.inputValue('.mv-hoja #mvNh')) === '10:00', 'Día: tocar una hora vacía crea algo a esa hora (10:00)'); await cerrarHoja();
    }
    // crear una rutina semanal
    toques = 0; await tocar('.mv-tab[data-tab="calendario"]'); await tocar('.mv-fab'); await hojaAbierta('[data-k="rutina"]'); await tocar('.mv-hoja [data-k="rutina"]'); await hojaAbierta('#mvRt');
    await foto('rutina-formulario'); await medir('Nueva rutina (hoja)'); await axe('Nueva rutina (hoja)'); await sinDesborde('Nueva rutina (hoja)');
    await tocar('.mv-hoja #mvRt'); await page.fill('.mv-hoja #mvRt', 'Llamar a los clientes que no compran hace un mes'); await tocar('.mv-hoja .mv-dia-b[data-dia="4"]'); await foto('rutina-dias');
    paso(/lun, jue a las 09:00/.test(await texto('.mv-hoja [data-resumen]')), 'Rutina: el resumen lo dice en palabras («lun, jue a las 09:00»)');
    await page.locator('.mv-hoja .mv-hoja-acc .mv-btn.primario').tap(); toques++;
    const creada = await esperaSrv(async () => (await rutinas()).find(r => /clientes que no compran/.test(r.text))); paso(creada && JSON.stringify(creada.when.days) === '[1,4]' && creada.when.at === '09:00' && creada.needsOk === true, `Rutina: crear una semanal (lun y jue, 09:00, pide OK) en ${toques} toques (≤ 8)`);
    paso(toques <= 8, `Rutina semanal: ${toques} toques (≤ 8)`); await page.waitForSelector('.mv-hoja', { state: 'detached', timeout: 6000 }).catch(() => {});
    // errores del formulario
    await tocar('.mv-fab'); await hojaAbierta('[data-k="rutina"]'); await tocar('.mv-hoja [data-k="rutina"]'); await hojaAbierta('#mvRt'); await page.locator('.mv-hoja .mv-hoja-acc .mv-btn.primario').tap(); await espera(400);
    paso(await cuenta('.mv-hoja .mv-err[role="alert"]') >= 1 && /Escribe qué debe hacer/.test(await texto('.mv-hoja .mv-err')), 'Rutina: sin texto, dice qué falta en palabras y marca el campo'); await cerrarHoja();
    // mover una ejecución: solo esta vez
    await tocar('[data-modo="agenda"]'); await page.waitForSelector('.mv-ev.t-rutina'); await page.locator('.mv-ev.t-rutina', { hasText: 'Revisar las redes' }).first().tap(); await hojaAbierta('[data-r="mover"]'); await foto('rutina-ejecucion'); await medir('Rutina (hoja de una ejecución)'); await axe('Rutina (hoja de una ejecución)');
    await tocar('.mv-hoja [data-r="mover"]'); await page.waitForSelector('.mv-hoja #mvMd'); await espera(500);
    const atOrig = +(await page.evaluate(() => document.querySelector('.mv-hoja #mvMd').value)) || 0; const dia0 = await page.inputValue('.mv-hoja #mvMd');
    await page.fill('.mv-hoja #mvMh', '10:30'); await espera(250); await foto('rutina-mover'); await medir('Mover una ejecución (hoja)');
    paso(/Solo esta vez/.test(await texto('.mv-pregunta')) && /Siempre/.test(await texto('.mv-pregunta')), 'Mover: pregunta «solo esta vez» o «siempre» con lo que pasa en cada caso');
    await page.locator('.mv-hoja .mv-hoja-acc .mv-btn').first().tap(); await espera(400);
    const unaVez = await esperaSrv(async () => { const t = (await tareas()).find(x => x.state === 'scheduled' && /Revisar las redes/.test(x.title) && new Date(x.dueAt).getHours() === 10 && new Date(x.dueAt).getMinutes() === 30); return t; });
    paso(!!unaVez, 'Mover «solo esta vez»: nace una tarea a esa hora, con el mismo texto'); paso(((await rutinas()).find(r => r.id === r1.id).skips || []).length === 1, 'Mover «solo esta vez»: la ejecución original queda saltada y la rutina sigue igual');
    await page.waitForSelector('.mv-hoja', { state: 'detached', timeout: 6000 }).catch(() => {});
    // mover para siempre (cambia el día de una semanal)
    await page.locator('.mv-ev.t-rutina', { hasText: 'Revisar las redes' }).nth(1).tap().catch(async () => { await page.locator('.mv-ev.t-rutina', { hasText: 'Revisar las redes' }).first().tap(); }); await hojaAbierta('[data-r]'); await espera(300);
    if (await cuenta('.mv-hoja [data-r="mover"]')) { await tocar('.mv-hoja [data-r="mover"]'); await page.waitForSelector('.mv-hoja #mvMd'); const d1 = await page.inputValue('.mv-hoja #mvMd'); const dd = new Date(d1 + 'T12:00'); dd.setDate(dd.getDate() + 1); await page.fill('.mv-hoja #mvMd', ymd(dd)); await espera(300);
      await page.locator('.mv-hoja .mv-hoja-acc .mv-btn').last().tap(); const sig = await esperaSrv(async () => JSON.stringify((await rutinas()).find(r => r.id === r1.id).when.days) === '[2]'); paso(!!sig, 'Mover «siempre»: la semanal cambia de lunes a martes para todas las veces'); }
    else paso(false, 'Mover «siempre»: no había una segunda ejecución a la que moverle el día');
    await page.waitForSelector('.mv-hoja', { state: 'detached', timeout: 6000 }).catch(() => {});
    // saltar, pausar, editar y ejecutar ahora
    await page.locator('.mv-ev.t-rutina', { hasText: 'Cerrar la caja' }).first().tap(); await hojaAbierta('[data-r="saltar"]'); await tocar('.mv-hoja [data-r="saltar"]'); paso(!!(await esperaSrv(async () => ((await rutinas()).find(r => r.id === r2.id).skips || []).length === 1)), 'Rutina: «Saltar esta vez» salta una ejecución sin pausarla');
    await page.waitForSelector('.mv-hoja', { state: 'detached', timeout: 6000 }).catch(() => {});
    await page.locator('.mv-ev.t-rutina', { hasText: 'Cerrar la caja' }).first().tap(); await hojaAbierta('[data-r="pausa"]'); await tocar('.mv-hoja [data-r="pausa"]'); paso(!!(await esperaSrv(async () => (await rutinas()).find(r => r.id === r2.id).paused === true)), 'Rutina: «Pausar la rutina» la deja en pausa'); await page.waitForSelector('.mv-hoja', { state: 'detached', timeout: 6000 }).catch(() => {});
    await page.locator('.mv-ev.t-rutina', { hasText: 'Cerrar la caja' }).first().tap(); await hojaAbierta('[data-r="pausa"]'); await tocar('.mv-hoja [data-r="pausa"]'); await esperaSrv(async () => (await rutinas()).find(r => r.id === r2.id).paused === false); await page.waitForSelector('.mv-hoja', { state: 'detached', timeout: 6000 }).catch(() => {});
    await page.locator('.mv-ev.t-rutina', { hasText: 'Cerrar la caja' }).first().tap(); await hojaAbierta('[data-r="editar"]'); await tocar('.mv-hoja [data-r="editar"]'); await page.waitForSelector('.mv-hoja #mvRt'); await espera(400);
    paso((await page.inputValue('.mv-hoja #mvRt')).includes('Cerrar la caja'), 'Editar rutina: el formulario trae lo que la rutina ya tiene'); await page.fill('.mv-hoja #mvRt', 'Cerrar la caja y contar el efectivo'); await page.locator('.mv-hoja .mv-hoja-acc .mv-btn.primario').tap();
    paso(!!(await esperaSrv(async () => /contar el efectivo/.test((await rutinas()).find(r => r.id === r2.id).text))), 'Editar rutina: guardar cambia el texto'); await page.waitForSelector('.mv-hoja', { state: 'detached', timeout: 6000 }).catch(() => {});
    await page.locator('.mv-ev.t-rutina', { hasText: 'Cerrar la caja' }).first().tap(); await hojaAbierta('[data-r="ahora"]'); const nAntes = (await tareas()).length; await tocar('.mv-hoja [data-r="ahora"]'); await page.waitForSelector('.mv-hoja .mv-btn.primario'); await page.locator('.mv-capa').last().locator('.mv-btn.primario').last().tap();
    paso(!!(await esperaSrv(async () => (await tareas()).length > nAntes)), 'Rutina: «Ejecutar ahora» (con confirmación) crea la tarea'); await page.waitForTimeout(700); while (await cuenta('.mv-hoja')) await cerrarHoja();
    // capas, buscar, suscribirse
    await tocar('[data-capas]'); await hojaAbierta('#mvCp_rutinas'); await foto('calendario-capas'); await medir('Calendario · Capas y suscripción'); await axe('Calendario · Capas y suscripción');
    paso(await cuenta('.mv-hoja [data-copiar]') === 1 && await cuenta('.mv-hoja a[href*="calendar.ics"]') >= 2, 'Suscribirse: copiar el enlace, abrirlo en el calendario del teléfono o descargar el .ics');
    await tocar('.mv-hoja #mvCp_rutinas'); await cerrarHoja(); await espera(250); paso(await cuenta('.mv-ev.t-rutina') === 0, 'Capas: apagar «Rutinas» las quita de la agenda');
    await tocar('[data-capas]'); await hojaAbierta('#mvCp_rutinas'); await tocar('.mv-hoja #mvCp_rutinas'); await cerrarHoja(); await espera(250); paso(await cuenta('.mv-ev.t-rutina') >= 1, 'Capas: volver a encenderlas las trae de vuelta');
    await tocar('[data-buscar]'); await hojaAbierta('#mvBc'); await page.fill('.mv-hoja #mvBc', 'redes'); await espera(300); await foto('calendario-buscar'); await medir('Calendario · Buscar'); paso(await cuenta('.mv-hoja .mv-bres .mv-lista-b') >= 1, 'Buscar: «redes» encuentra la rutina'); await tocar('.mv-hoja .mv-bres .mv-lista-b'); await page.waitForFunction(() => !document.querySelector('.mv-bres') && document.querySelector('.mv-hoja'), null, { timeout: 6000 }); paso(true, 'Buscar: tocar el resultado abre lo que es (la rutina o la tarea)'); await page.waitForTimeout(300); while (await cuenta('.mv-hoja')) await cerrarHoja();
    await tocar('[data-nav="1"]'); await espera(200); const lab1 = await texto('.mv-tb-t'); await tocar('[data-hoy]'); paso(lab1 !== (await texto('.mv-tb-t')), 'Calendario: ‹ › cambia de fechas y «Hoy» vuelve');
    await tocar('[data-modo="mes"]'); await page.waitForSelector('.mv-celda'); await foto('calendario-mes'); await medir('Calendario · Mes'); await axe('Calendario · Mes'); await sinDesborde('Calendario · Mes'); await tocar('[data-modo="tres"]'); await sinDesborde('Calendario · 3 días'); await tocar('[data-modo="agenda"]');

    // =====================================================  DIMITRI  =====================================================
    toques = 0; await tocar('.mv-tab[data-tab="dimitri"]'); await page.waitForSelector('[data-vista="dimitri"] .mv-msg'); await espera(400);
    paso(/Viendo/.test(await texto('.mv-viendo')) && /calendario|Calendario/.test(await texto('.mv-viendo')), 'Dimitri: «Viendo: …» dice de qué pantalla vienes');
    paso(await cuenta('.mv-sugs-fila [data-sug]') === 3, 'Dimitri: tres sugerencias según la pantalla'); await foto('dimitri-chat'); await medir('Dimitri'); await axe('Dimitri'); await sinDesborde('Dimitri');
    // el plan: revisar pieza por pieza y enviar
    await page.locator('.mv-plan').scrollIntoViewIfNeeded(); await foto('dimitri-plan'); await medir('Dimitri · plan');
    paso(await page.locator('[data-pl-si]').isDisabled(), 'Plan: no se puede enviar mientras una pieza tenga una hora que ya pasó');
    await tocar('.mv-pieza.alerta [data-pz-ed]'); await hojaAbierta('[data-ahora]'); await foto('dimitri-pieza'); await medir('Dimitri · revisar una pieza'); await axe('Dimitri · revisar una pieza'); await tocar('.mv-hoja [data-ahora]'); await tocar('.mv-hoja .mv-hoja-acc .mv-btn.primario'); await page.waitForSelector('.mv-hoja', { state: 'detached' }); await espera(300);
    paso(!(await page.locator('[data-pl-si]').isDisabled()), 'Plan: al elegir «Ahora» ya se puede enviar'); const nT = (await tareas()).length;
    await tocar('[data-pl-si]'); const enviado = await esperaSrv(async () => (await tareas()).length >= nT + 3); paso(!!enviado, 'Plan: «Enviar a los jefes» crea las tres piezas en sus departamentos y la tuya');
    paso(!!(await tareas()).find(t => t.title === 'Elegir el precio de lanzamiento' && t.person === 'Tú'), 'Plan: la pieza «para mí» nace en mi lista'); await espera(500);
    // cambios con Deshacer
    await page.locator('[data-ops-si]').scrollIntoViewIfNeeded(); await foto('dimitri-cambios'); await medir('Dimitri · cambios');
    await tocar('[data-ops-si]'); const pausada = await esperaSrv(async () => (await rutinas()).find(r => r.id === r2.id).paused === true); paso(!!pausada, 'Cambios: «Hacerlo» pausa la rutina');
    await page.waitForSelector('[data-op-undo]', { timeout: 6000 }); paso(/Deshacer · \d+ s/.test(await texto('[data-op-undo]')), 'Cambios: aparece «Deshacer» con los segundos que quedan (30)');
    await tocar('[data-op-undo]'); paso(!!(await esperaSrv(async () => (await rutinas()).find(r => r.id === r2.id).paused === false)), 'Cambios: «Deshacer» la reanuda');
    paso(/Ver en escritorio|escritorio/.test(await texto('.mv-ops')), 'Cambios: lo que gasta (anuncios) se manda a la versión de escritorio, con su cifra y sus topes');
    // preguntas con opciones
    await page.locator('.mv-preg').scrollIntoViewIfNeeded(); await tocar('[data-q-opt="ig"]'); await tocar('[data-q-opt="mail"]'); await foto('dimitri-preguntas'); await medir('Dimitri · preguntas');
    paso(await page.locator('[data-q-ok]').isEnabled(), 'Preguntas: con una opción elegida se puede responder (puedes elegir varias)'); await page.evaluate(() => { window.__chat = []; });
    await tocar('[data-q-ok]'); await page.waitForSelector('.mv-escribiendo', { timeout: 6000 }); await page.waitForSelector('[data-detener]', { timeout: 6000 }); paso(true, 'En vivo: mientras Dimitri escribe aparece «escribiendo…» y «Detener»');
    paso(await cuenta('.mv-vivo') === 1, 'En vivo: su respuesta crece en una burbuja'); await foto('dimitri-escribiendo'); await medir('Dimitri · escribiendo');
    await page.waitForFunction(() => !document.querySelector('.mv-escribiendo'), null, { timeout: 12000 }); const cuerpo = await page.evaluate(() => window.__chat[0]);
    paso(cuerpo && cuerpo.answers && cuerpo.answers.msg === 'm2' && cuerpo.answers.picks[0].values.join() === 'ig,mail' && /Canal: Instagram, Correo/.test(cuerpo.text) && cuerpo.context && /calendario|Calendario/.test(cuerpo.context.label), 'Preguntas: la respuesta viaja con sus opciones (answers) y con lo que se estaba viendo (context)');
    // sugerencia, error con Reintentar
    await page.evaluate(() => { window.__chatModo = 'cae'; }); await page.fill('#mvDim', 'Dime algo'); await tocar('.mv-compone .mv-enviar'); await page.waitForSelector('.mv-falla [data-reenviar]', { timeout: 8000 });
    paso(/No pude responder ahora/.test(await texto('.mv-falla')) && await cuenta('.mv-msg.mio') >= 1, 'Error: dice que no pudo, con el motivo, deja el mensaje a la vista y ofrece «Reintentar»'); await foto('dimitri-error'); await medir('Dimitri · error');
    await page.evaluate(() => { window.__chatModo = 'vivo'; window.__chatPausa = 200; }); await tocar('[data-reenviar]'); await page.waitForFunction(() => !document.querySelector('.mv-falla') && !document.querySelector('.mv-escribiendo'), null, { timeout: 12000 }); paso(true, 'Error: «Reintentar» lo vuelve a mandar y sale bien');
    // nueva conversación con DESHACER
    await tocar('[aria-label="Conversación nueva"]'); await page.waitForSelector('.mv-toast:has-text("Conversación nueva")', { timeout: 6000 }); await page.waitForSelector('.mv-saludo'); paso(true, 'Nueva conversación: empieza en blanco y avisa');
    await page.locator('.mv-toast-b').first().tap(); await page.waitForSelector('.mv-msg', { timeout: 6000 }); paso(await cuenta('.mv-plan') >= 1, 'Nueva conversación: «Deshacer» trae la anterior de vuelta');
    await tocar('[aria-label="Conversaciones guardadas"]'); await hojaAbierta('.mv-convs, .mv-vacio'); await foto('dimitri-historial'); await medir('Dimitri · historial'); await axe('Dimitri · historial'); await cerrarHoja();

    // =====================================================  las tareas comunes en ≤ 3 toques  =====================================================
    const nuevas = []; for (const t of ['Pagar la luz', 'Revisar el contrato', 'Comprar tinta', 'Llamar al contador', 'Enviar la factura']) nuevas.push((await o.api('/api/tareas/mias', 'POST', { title: t, limite: ymd(new Date()) })).tarea);
    const comunes = [];
    await page.locator('.mv-tab[data-tab="inicio"]').tap(); await espera(250);
    toques = 0; await tocar('.mv-tab[data-tab="tareas"]'); await page.locator('[data-tv="lista"]').tap(); await page.locator('[data-lista="hoy"]').tap(); await page.waitForSelector(`[data-vista="tareas"] [data-id="${nuevas[0].id}"]`, { timeout: 8000 }); comunes.push(['Ver mis tareas de hoy', 1]);
    toques = 0; await tocar('#mvNueva'); await page.fill('#mvNueva', 'Tarea rápida de prueba'); await tocar('.mv-anadir .mv-enviar'); await esperaSrv(async () => (await tareas()).some(t => t.title === 'Tarea rápida de prueba')); comunes.push(['Añadir una tarea', toques]);
    toques = 0; await tocar(`[data-vista="tareas"] [data-id="${nuevas[0].id}"] .mv-check`); await esperaSrv(async () => (await tarea(nuevas[0].id)).state === 'done'); comunes.push(['Completar una tarea', toques]);
    toques = 0; await tocar(`[data-vista="tareas"] [data-id="${nuevas[1].id}"] [data-abrir]`); await page.waitForSelector('.mv-hoja.completa .mv-titin'); await tocar(`[data-lim="${man}"]`); await esperaSrv(async () => (await tarea(nuevas[1].id)).limite === man); comunes.push(['Pasar una tarea a mañana', toques]);
    toques = 0; await tocar('[data-prio="alta"]'); await esperaSrv(async () => (await tarea(nuevas[1].id)).prioridad === 'alta'); comunes.push(['Cambiar la prioridad (abierta la tarea: 1 toque más)', toques + 1]);
    toques = 0; await tocar('[data-crono="iniciar"]'); await esperaSrv(async () => (await tarea(nuevas[1].id)).cronometro?.some(c => !c.fin)); comunes.push(['Empezar el cronómetro (con la tarea abierta: 1 toque más)', toques + 1]); await cerrarHoja(); await page.waitForSelector('.mv-crono:not([hidden])'); await tocar('[data-parar]');
    toques = 0; await tocar(`[data-vista="tareas"] [data-id="${nuevas[2].id}"] [data-abrir]`); await page.waitForSelector('.mv-hoja.completa .mv-titin'); await tocar('[data-acc="delegar"]'); await hojaAbierta('#mvDgD'); await page.locator('.mv-capa').last().locator('.mv-btn.primario').last().tap(); toques++; await esperaSrv(async () => (await tarea(nuevas[2].id)).agent); comunes.push(['Delegar a un agente', toques]); await page.waitForTimeout(900); while (await cuenta('.mv-hoja')) await cerrarHoja();
    toques = 0; await tocar(`[data-vista="tareas"] [data-id="${nuevas[3].id}"] [data-abrir]`); await page.waitForSelector('.mv-hoja.completa .mv-titin'); comunes.push(['Abrir una tarea', toques]); await cerrarHoja();
    toques = 0; await tocar('[data-tv="proyectos"]'); comunes.push(['Ver los proyectos (desde Tareas)', toques + 1]); await tocar('[data-tv="lista"]');
    toques = 0; await tocar('.mv-tab[data-tab="calendario"]'); comunes.push(['Ver el calendario de hoy', toques]);
    toques = 0; await tocar('.mv-fab'); await hojaAbierta('[data-k="rutina"]'); await tocar('.mv-hoja [data-k="rutina"]'); comunes.push(['Empezar a crear una rutina', toques]); await page.reload(); await page.waitForSelector('.mv-tab[data-tab="tareas"]'); await espera(600);
    for (const [n, t] of comunes) paso(t <= 3, `Tarea común en ≤ 3 toques: «${n}» (${t})`);

    // =====================================================  tema oscuro, anchos y errores  =====================================================
    await page.evaluate(() => window.CC?.setDark(true)); await espera(300);
    for (const t of ['tareas', 'calendario', 'dimitri']) { await page.locator(`.mv-tab[data-tab="${t}"]`).tap(); await espera(400); await axe(t + ' (oscuro)'); }
    await page.locator('.mv-tab[data-tab="tareas"]').tap(); await espera(300); await page.locator('[data-tv="lista"]').tap(); await espera(200); await page.locator('[data-vista="tareas"] .mv-fila [data-abrir]').first().tap(); await page.waitForSelector('.mv-hoja.completa .mv-titin'); await espera(300); await axe('Detalle de tarea (oscuro)'); await foto('tarea-detalle-oscuro'); await cerrarHoja();
    await page.evaluate(() => window.CC?.setDark(false));
    for (const w of [320, 360, 390, 430]) {
      await page.setViewportSize({ width: w, height: 800 }); await espera(250);
      for (const [t, vs] of [['tareas', ['lista', 'tablero', 'proyectos', 'medidas']], ['calendario', ['agenda', 'dia', 'tres', 'mes']], ['dimitri', ['']]]) {
        await page.locator(`.mv-tab[data-tab="${t}"]`).tap(); await espera(220);
        for (const v of vs) { if (v && t === 'tareas') await page.locator(`[data-tv="${v}"]`).tap(); if (v && t === 'calendario') await page.locator(`[data-modo="${v}"]`).tap(); await espera(260); const d = await desborda(); paso(d.ancho && !d.sobran.length, `${w} px · ${t}${v ? ' · ' + v : ''}: sin desbordamiento horizontal${d.sobran.length ? ' → ' + d.sobran.join(', ') : ''}`); }
      }
      // la hoja de una rutina nueva y su fila de siete botones (el caso más estrecho)
      await page.locator('.mv-tab[data-tab="calendario"]').tap(); await espera(200); await page.locator('.mv-fab').tap(); await page.waitForSelector('.mv-hoja [data-k="rutina"]'); await page.locator('.mv-hoja [data-k="rutina"]').tap(); await page.waitForSelector('.mv-hoja .mv-dias'); await espera(450);
      const dias = await page.evaluate(() => [...document.querySelectorAll('.mv-hoja .mv-dia-b')].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.width * 10) / 10, Math.round(r.height)]; }));
      paso(dias.length === 7 && dias.every(([a, b]) => a >= 43.5 && b >= 44), `${w} px · rutina: los siete botones L M X J V S D miden ≥ 44 px (${dias.map(d => d[0]).join(' ')})`);
      const d2 = await desborda(); paso(d2.ancho && !d2.sobran.length, `${w} px · formulario de rutina: sin desbordamiento${d2.sobran.length ? ' → ' + d2.sobran.join(', ') : ''}`); if (w === 320) await foto('320-rutina');
      await cerrarHoja(); while (await cuenta('.mv-hoja')) await cerrarHoja();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    paso(!errores.length, `sin errores de JavaScript en la consola${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`);
    await ctx.close();
  } finally { await browser.close(); o.cerrar(); }
  console.log(`\n${fallos ? fallos + ' paso(s) fallaron' : 'todo en orden'} (${res.length} comprobaciones)\nObjetivos < 44 px por pantalla (después): ${JSON.stringify(medidas)}`);
  return { fallos, res, medidas };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await correr({ capturas: process.argv.includes('--capturas') });
  process.exit(r.fallos ? 1 : 0);
}
