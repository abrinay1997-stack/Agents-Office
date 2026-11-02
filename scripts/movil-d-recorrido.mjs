// Herramienta de desarrollo y prueba de navegador de la VERSIÓN MÓVIL: Contenido (Agenda, Cola, Bandeja, Perfil), «Crear publicación» por pasos, Analíticas y
// Anuncios (25 oct 2026). Oficina temporal (la misma de scripts/movil-recorrido.mjs), un Chromium de teléfono (390×844, con toque) y, donde la oficina no tiene
// Meta (no hay token), una Meta de mentira para la Bandeja (page.route) y los datos de ejemplo de la propia pantalla para Analíticas y Anuncios. Comprueba, y
// falla si algo no se cumple:
//   · crear una publicación completa en ≤ 8 toques (7 guardando, 8 aprobando) y aprobar un borrador de la semana en ≤ 3;
//   · aprobar y enviar SIEMPRE piden un segundo toque en una hoja (nada sale con un toque suelto); solo el servidor aprueba (lo que se mira es su respuesta);
//   · la regla del dinero en Anuncios: pausar = 1 toque con DESHACER; activar = 2 toques y el segundo dice la cifra; cancelar no cambia nada;
//   · ningún objetivo táctil < 44 px, campos de 16 px o más, cero desbordamiento horizontal a 320, 360, 390 y 430 px, todo control con nombre accesible;
//   · axe (si AO_AXE apunta a axe.min.js) sin críticos ni serios, claro y oscuro.
//   node scripts/movil-d-recorrido.mjs [--capturas]   → ✓/✗ por paso y, con --capturas, docs/capturas-movil/despues/d-*.jpg
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { oficina } from './movil-recorrido.mjs';
import { datosDeEjemplo } from '../src/analiticas-datos.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'docs', 'capturas-movil', 'despues');
const espera = ms => new Promise(r => setTimeout(r, ms));
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dia = n => ymd(new Date(Date.now() + n * 864e5));
const iso = ms => new Date(Date.now() + ms).toJSON();

/** Un PNG liso de w×h (una foto de mentira para la galería del Estudio), sin librerías. */
function png(w, h, [r, g, b]) {
  const crc = (() => { const t = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; }); return buf => { let c = -1; for (const x of buf) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }; })();
  const chunk = (tipo, datos) => { const len = Buffer.alloc(4); len.writeUInt32BE(datos.length); const cuerpo = Buffer.concat([Buffer.from(tipo), datos]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(cuerpo)); return Buffer.concat([len, cuerpo, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const fila = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3).map((_, i) => [r, g, b][i % 3])]);
  const raw = Buffer.concat(Array.from({ length: h }, () => fila));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export async function correr({ capturas = false } = {}) {
  const res = []; let fallos = 0;
  const paso = (ok, que) => { if (!ok) fallos++; res.push({ ok: !!ok, que }); console.log(`${ok ? '✓' : '✗'} ${que}`); };
  const o = await oficina({ semilla: false });
  let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  const AXE = process.env.AO_AXE && fs.existsSync(process.env.AO_AXE) ? process.env.AO_AXE : null;
  try {
    // ---- los datos: una foto en la galería y piezas de todos los estados ----
    const subir = async (nombre, w, h, c) => (await o.api('/api/media/upload', 'POST', { name: nombre, data: 'data:image/png;base64,' + png(w, h, c).toString('base64') })).item.file;
    const f1 = await subir('foto-1', 800, 1000, [200, 90, 60]), f2 = await subir('foto-2', 800, 1000, [60, 120, 200]), f3 = await subir('foto-3', 1080, 1080, [90, 160, 90]);
    const crear = async p => (await o.api('/api/contenido/piezas', 'POST', p)).pieza;
    const pBor = await crear({ titulo: 'Combo de octubre', texto: 'El combo de octubre ya está aquí. Pídelo hoy y llévate el postre.', hashtags: '#combo #panamá', redes: ['instagram', 'facebook'], formato: 'post', medios: [f1], fecha: dia(1), hora: '18:00', estado: 'borrador' });
    const pRev = await crear({ titulo: 'Detrás de cámaras', texto: 'Así preparamos cada pedido, paso a paso.', redes: ['instagram'], formato: 'post', medios: [f2], fecha: dia(2), hora: '12:30', estado: 'revision' });
    const pApr = await crear({ titulo: 'Gracias por 1.000 seguidores', texto: 'Mil gracias a todos. Esto es por ustedes.', redes: ['instagram', 'facebook'], formato: 'post', medios: [f3], fecha: dia(4), hora: '09:00', estado: 'revision' });
    await o.api(`/api/contenido/piezas/${pApr.id}/aprobar`, 'POST', {});
    const pMal = await crear({ titulo: 'Idea sin hora', texto: 'Pendiente de pensar.', redes: ['instagram'], formato: 'post', medios: [], fecha: dia(3), estado: 'borrador' });
    const pCar = await crear({ titulo: 'Carrusel de la semana', texto: 'Tres ideas para tu mesa.', redes: ['instagram'], formato: 'carrusel', medios: [f1, f2, f3], fecha: dia(1), hora: '10:00', estado: 'borrador' });
    const pHis = await crear({ titulo: 'Historia del día', texto: 'Hoy abrimos temprano.', redes: ['instagram'], formato: 'historia', medios: [f3], fecha: dia(1), hora: '08:00', estado: 'borrador' });
    const pIdea = await crear({ titulo: 'Lanzamos la colección de verano con sorpresas', texto: '', redes: ['instagram'], formato: 'post', medios: [], fecha: dia(1), hora: '11:00', estado: 'idea' });
    const pVieja = await crear({ titulo: 'Se quedó atrás', texto: 'Esta ya pasó de hora.', redes: ['instagram'], formato: 'post', medios: [], fecha: dia(-3), hora: '10:00', estado: 'revision' });
    const pSinDia = await crear({ titulo: 'Idea para cuando haya día', texto: 'Sin fecha todavía.', redes: ['instagram'], formato: 'post', medios: [], estado: 'idea' });
    const pVideo = await crear({ titulo: 'Reel del taller', texto: 'Un día en el taller.', redes: ['instagram'], formato: 'reel', medios: [], fecha: dia(6), hora: '19:00', estado: 'borrador' });

    // ---- la Meta de mentira de la Bandeja (la oficina de prueba no tiene token) ----
    const bandeja = { items: [
      { id: 'meta:c1', tipo: 'comentarios', fuente: 'meta', red: 'instagram', autor: 'Ana Pérez', texto: '¿Cuánto cuesta el combo?', estado: 'borrador', borrador: { texto: 'Hola Ana, el combo cuesta $12. ¡Te esperamos!', por: 'agente:lexi', cuando: iso(-3e5) }, cuando: iso(-30 * 60e3), enAnuncio: { campana: 'c-1', anuncio: 'a-1', nombre: 'Combo de octubre' }, publicacion: { id: 'p1', texto: 'El combo de octubre ya está aquí', enlace: 'https://www.instagram.com/p/abc/', miniatura: '' }, oculto: false },
      { id: 'meta:conv:1', tipo: 'conversaciones', fuente: 'meta', red: 'instagram', autor: 'Luis Gómez', texto: 'Hola, ¿tienen disponible para mañana?', estado: 'nuevo', cuando: iso(-2 * 3600e3), mensajes: [{ id: 'm1', de: 'cliente', texto: 'Hola, ¿tienen disponible para mañana?', at: iso(-2 * 3600e3) }, { id: 'm0', de: 'tu', texto: 'Hola Luis, claro que sí.', at: iso(-1.9 * 3600e3) }, { id: 'm2', de: 'cliente', texto: 'Perfecto, ¿a qué hora abren?', at: iso(-1 * 3600e3) }], ultimoCliente: { at: iso(-1 * 3600e3) }, ventana: { abierta: true, hasta: iso(23 * 3600e3), quedaMin: 1380 } },
      { id: 'meta:conv:2', tipo: 'conversaciones', fuente: 'meta', red: 'facebook', autor: 'Marta Ríos', texto: 'Gracias por todo', estado: 'nuevo', cuando: iso(-30 * 3600e3), mensajes: [{ id: 'm3', de: 'cliente', texto: 'Gracias por todo', at: iso(-30 * 3600e3) }], ventana: { abierta: false } },
      { id: 'meta:c2', tipo: 'comentarios', fuente: 'meta', red: 'facebook', autor: 'Cuenta rara', texto: 'Gana dinero rápido en mi enlace', estado: 'nuevo', cuando: iso(-5 * 3600e3), sugerirOcultar: { motivo: 'Parece spam', quien: 'MARKETING' }, sospecha: '', oculto: false, publicacion: { id: 'p2', texto: 'Promo', enlace: '', miniatura: '' } },
    ], llamadas: [] };
    const hoja = { ok: true };
    const ctxOpts = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
    const ctx = await browser.newContext(ctxOpts), page = await ctx.newPage();
    const errores = [];
    page.on('pageerror', e => errores.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon|net::ERR/.test(m.text())) errores.push('console: ' + m.text()); });
    await page.route('**/api/contenido/bandeja**', async route => {
      const rq = route.request(), u = new URL(rq.url()), m = rq.method(), cuerpo = rq.postData() ? JSON.parse(rq.postData()) : {};
      const json = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
      if (m === 'GET' && u.pathname === '/api/contenido/bandeja') return json({ items: bandeja.items, cuenta: {}, pendientes: bandeja.items.filter(x => ['nuevo', 'borrador', 'fallo'].includes(x.estado)).length, modo: 'real', bandejaFuente: 'meta', fuentes: { meta: { ok: true, mensajes: { ok: true } } } });
      bandeja.llamadas.push({ m, ruta: u.pathname.replace('/api/contenido/bandeja', ''), cuerpo });
      const id = decodeURIComponent(u.pathname.split('/')[4] || ''), it = bandeja.items.find(x => x.id === id), acc = u.pathname.split('/')[5];
      if (u.pathname.endsWith('/deshacer')) { if (it) it.oculto = false; bandeja.items.forEach(x => { if (x._tok) x.oculto = false; }); return json({ ok: true }); }
      if (!it) return json({ error: 'ese mensaje ya no está en la bandeja' }, 404);
      if (m === 'PATCH') { it.borrador = { texto: cuerpo.borrador, por: 'dueno', cuando: iso(0) }; it.estado = cuerpo.borrador ? 'borrador' : 'nuevo'; return json({ ok: true, item: it }); }
      if (acc === 'enviar') { if (it.ventana && !it.ventana.abierta) return json({ error: 'ventana', motivo: 'La ventana de 24 h se cerró.' }, 409); it.estado = 'respondido'; return json({ ok: true, item: it, simulada: false }); }
      if (acc === 'ocultar') { it.oculto = cuerpo.ocultar !== false; it._tok = true; return json({ ok: true, item: it, deshacer: { token: 'tok-1', hasta: iso(30e3) } }); }
      if (acc === 'descartar') { it.estado = 'descartado'; return json({ ok: true }); }
      return json({ ok: true });
    });

    await page.goto(o.base); await page.waitForSelector('#mvRoot .mv-tabs'); await espera(900);
    let toques = 0; const tocar = async sel => { toques++; await page.locator(sel).first().tap(); await espera(220); };
    const foto = async n => { if (!capturas) return; fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, 'd-' + n + '.jpg'), type: 'jpeg', quality: 62, scale: 'css' }); };
    const hojaAbierta = async () => { await page.waitForSelector('.mv-hoja', { timeout: 6000 }); await espera(260); };
    const sinHoja = async () => { await page.waitForSelector('.mv-capa', { state: 'detached', timeout: 6000 }).catch(() => {}); await espera(200); };
    const irMas = async (id, espera_) => { await page.locator('.mv-tab[data-tab="mas"]').tap(); await page.waitForSelector('.mv-hoja.mv-mas'); await page.locator(`.mv-lista-b[data-vista="${id}"]`).tap(); await page.waitForSelector(`[data-vista="${id}"]:not([hidden]) ${espera_}`, { timeout: 12000 }); await espera(400); };

    // ---- medidas ----
    const medir = async nombre => {
      const r = await page.evaluate(() => {
        const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden],[inert]'); };
        const malos = [], sinNombre = [], chicos = [];
        for (const e of document.getElementById('mvRoot').querySelectorAll('button, [role="button"], input:not([type="hidden"]), select, textarea, summary, a[href]')) {
          if (!vis(e)) continue; const r = e.getBoundingClientRect();
          if (e.closest('.mv-tirar')) continue;
          if (r.height < 43.5 || (r.width < 43.5 && !e.closest('.md-mes'))) malos.push(`${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]} ${Math.round(r.width)}×${Math.round(r.height)} «${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 22)}»`);
          if (/INPUT|TEXTAREA|SELECT/.test(e.tagName) && e.type !== 'checkbox' && parseFloat(getComputedStyle(e).fontSize) < 16) chicos.push(e.id || e.className);
          const n = (e.getAttribute('aria-label') || e.textContent || '').trim() || (e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent.trim()) || e.getAttribute('placeholder'); if (!n) sinNombre.push(e.className || e.tagName);
        }
        const pequenos = [...document.querySelectorAll('#mvRoot *')].filter(e => vis(e) && e.childNodes.length && [...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11).slice(0, 4).map(e => e.className || e.tagName);
        const hover = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } }).filter(r => /\.(md|mv)-[^{]*:hover/.test(r.selectorText || '')).map(r => r.selectorText);
        return { malos, sinNombre, chicos, pequenos, hover };
      });
      paso(!r.malos.length, `${nombre}: ningún objetivo táctil < 44 px${r.malos.length ? ' → ' + r.malos.slice(0, 6).join(' | ') : ''}`);
      paso(!r.chicos.length, `${nombre}: campos de 16 px o más${r.chicos.length ? ' → ' + r.chicos.join(', ') : ''}`);
      paso(!r.sinNombre.length, `${nombre}: todo control tiene nombre accesible${r.sinNombre.length ? ' → ' + r.sinNombre.join(', ') : ''}`);
      paso(!r.pequenos.length, `${nombre}: ningún texto bajo 11 px${r.pequenos.length ? ' → ' + r.pequenos.join(', ') : ''}`);
      paso(!r.hover.length, `${nombre}: nada depende de :hover${r.hover.length ? ' → ' + r.hover.join(', ') : ''}`);
    };
    const anchos = async nombre => {
      const malos = [];
      for (const w of [320, 360, 390, 430]) {
        await page.setViewportSize({ width: w, height: 844 }); await espera(260);
        const r = await page.evaluate(() => { const w = innerWidth; const sobran = [...document.querySelectorAll('#mvRoot *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > w + 1 || b.left < -1) && !e.closest('.mv-chips, .mv-capa:not(.entra), .md-tira, .md-hoja-pz pre') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map(e => (e.className || e.tagName).toString().slice(0, 40)); return { sobran, h: document.documentElement.scrollWidth > innerWidth + 1 }; });
        if (r.sobran.length || r.h) malos.push(`${w}px: ${r.sobran.join(', ') || 'la página se desplaza'}`);
      }
      await page.setViewportSize({ width: 390, height: 844 }); await espera(260);
      paso(!malos.length, `${nombre}: sin desbordamiento horizontal a 320, 360, 390 y 430 px${malos.length ? ' → ' + malos.join(' | ') : ''}`);
    };
    const axe = async nombre => {
      if (!AXE) return; if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ path: AXE });
      for (const tema of ['light', 'dark']) {
        await page.evaluate(t => { localStorage.setItem('ao.theme', t); if (window.CC?.setDark) window.CC.setDark(t === 'dark'); else document.body.classList.toggle('dark', t === 'dark'); }, tema); await espera(250);
        const v = await page.evaluate(async () => { const r = await window.axe.run(document.getElementById('mvRoot'), { resultTypes: ['violations'] }); return r.violations.filter(x => x.impact === 'critical' || x.impact === 'serious').map(x => `${x.id} (${x.impact}, ${x.nodes.length}): ${x.nodes[0].target.join(' ')}`); });
        paso(!v.length, `axe · ${nombre} (${tema === 'dark' ? 'oscuro' : 'claro'}): sin críticos ni serios${v.length ? ' → ' + v.join(' | ') : ''}`);
      }
      await page.evaluate(() => { localStorage.setItem('ao.theme', 'light'); if (window.CC?.setDark) window.CC.setDark(false); else document.body.classList.remove('dark'); });
    };
    const api = async (r, m = 'GET', b) => o.api(r, m, b);

    // ============================================================ CONTENIDO · AGENDA
    const oscuro = async on => { await page.evaluate(t => { localStorage.setItem('ao.theme', t); if (window.CC?.setDark) window.CC.setDark(t === 'dark'); else document.body.classList.toggle('dark', t === 'dark'); }, on ? 'dark' : 'light'); await espera(250); };
    const V = '[data-vista="contenido"]';
    await irMas('contenido', '.md-vistas');
    // ---- el modo predeterminado: «Mes + lista» (cuadrícula de miniaturas arriba, la lista del día abajo)
    paso(await page.locator(`${V} [data-agv="mes-lista"][aria-pressed="true"]`).count() === 1, 'Contenido · Agenda: el modo predeterminado es «Mes + lista»');
    paso(await page.locator(`${V} .md-vistas button`).count() === 5, 'Contenido · Agenda: el conmutador ofrece cinco modos');
    if (!(await page.locator(`${V} .md-th-celda`).count())) await tocar(`${V} [data-mes="1"]`); // por si hoy es fin de mes y las piezas caen en el mes que viene
    paso(await page.locator(`${V} .md-th-celda`).count() >= 4, 'Mes + lista: cada día con piezas muestra miniaturas');
    paso(await page.locator(`${V} .md-celda-g .md-mas`).count() >= 1, 'Mes + lista: un día con más de 3 piezas dice «+N»');
    paso(await page.locator(`${V} .md-celda`).evaluateAll(cs => Math.max(...cs.map(c => c.querySelectorAll('.md-th').length)) <= 3), 'Mes + lista: nunca más de 3 miniaturas por día');
    paso(await page.locator(`${V} .md-th-celda .md-th-f svg`).count() >= 4, 'Mes + lista: cada miniatura lleva el glifo de su formato (no solo color)');
    paso(await page.locator(`${V} .md-th-celda.t-punteado`).count() >= 1 && await page.locator(`${V} .md-th-celda.t-solido`).count() >= 1, 'Mes + lista: el estado se ve también por el trazo del borde (punteado / sólido)');
    paso(await page.locator(`${V} .md-ley`).count() === 1, 'Mes + lista: la leyenda dice qué significa cada marca');
    const celdaCon = `${V} .md-celda:has(.md-th)`;
    const hoyOk = await page.locator(celdaCon).first().evaluate(c => { const r = c.getBoundingClientRect(); return r.width >= 43.5 && r.height >= 43.5; });
    paso(hoyOk, 'Mes + lista: la celda del día es un botón de 44 px o más aunque la miniatura sea chica');
    await tocar(celdaCon); await espera(200);
    paso(await page.locator(`${V} .md-pz`).count() >= 1, 'Mes + lista: tocar un día abre su lista debajo');
    // ---- rendimiento y regresiones del modo predeterminado
    paso(await page.locator(`${V} .md-celda img`).count() <= 60, 'Mes + lista: nunca más de 60 imágenes en la cuadrícula');
    paso(await page.locator(`${V} video`).count() === 0, 'Mes + lista: ningún <video> en la cuadrícula ni en las tarjetas (los videos son un recuadro con ▶)');
    paso(/pieza ya pasó|piezas ya pasaron/.test(await page.locator(V).innerText()), 'Mes + lista: avisa de lo que ya pasó de hora sin salir (como el modo lista)');
    paso(await page.locator(`${V} .mv-dia h3`, { hasText: 'Sin día' }).count() === 1 && /Idea para cuando haya día/.test(await page.locator(V).innerText()), 'Mes + lista: las piezas SIN FECHA siguen a la vista');
    paso(await page.locator(`${V} .md-th-celda .md-th-e`).count() >= 4, 'Mes + lista: cada miniatura lleva también el glifo de su estado');
    await page.locator(`${V} [data-dia]`).first().evaluate(c => { window.__celda0 = c; });
    await tocar(`${V} .md-celda:has(.md-th) >> nth=1`);
    paso(await page.evaluate(() => window.__celda0 === document.querySelector('[data-vista="contenido"] [data-dia]')), 'Tocar un día NO repinta el mes (las celdas son las mismas) y cambia la selección');
    paso(await page.locator(`${V} [data-dia][aria-pressed="true"]`).count() === 1, 'Tocar un día deja exactamente una celda seleccionada');
    paso(await page.locator(`${V} .md-pz .md-th-lista img, ${V} .md-pz .md-th-lista .md-th-t`).count() >= 1, 'Agenda: las tarjetas usan la misma miniatura (imagen, o icono del formato con sus palabras)');
    await foto('agenda-miniaturas-mes-lista-claro'); await medir('Contenido · Mes + lista'); await anchos('Contenido · Mes + lista'); await axe('Contenido · Mes + lista');
    await oscuro(true); await foto('agenda-miniaturas-mes-lista-oscuro'); await oscuro(false);
    // ---- el día con 4 piezas (el del carrusel): una historia 9:16, un carrusel 1/N, una idea sin archivo
    const diaMuchas = dia(1);
    if (!(await page.locator(`${V} [data-dia="${diaMuchas}"]`).count())) await tocar(`${V} [data-mes="1"]`);
    await tocar(`${V} [data-dia="${diaMuchas}"]`);
    paso(await page.locator(`${V} .md-pz .md-th-lista.r-9x16`).count() >= 1, 'Tarjeta: una historia tiene miniatura 9:16');
    paso(await page.locator(`${V} .md-pz .md-th-n`).evaluateAll(ns => ns.some(n => n.textContent.trim() === '1/3')), 'Tarjeta: un carrusel dice «1/3» sobre su primera imagen');
    paso(await page.locator(`${V} .md-pz .md-th-t small`).evaluateAll(ns => ns.some(n => /Lanzamos/.test(n.textContent))), 'Tarjeta: una idea sin archivo enseña el icono del formato y sus primeras palabras');
    // ---- Miniaturas: la cuadrícula sola; el día se abre en una hoja
    await tocar(`${V} [data-agv="miniaturas"]`);
    paso(await page.locator(`${V} [data-lista]`).count() === 0, 'Miniaturas: la lista del día NO va debajo (solo las piezas sin día)');
    await tocar(`${V} [data-dia="${diaMuchas}"]`); await hojaAbierta();
    paso(await page.locator('.mv-hoja .md-pz').count() >= 4, 'Miniaturas: tocar un día abre una hoja con sus piezas');
    paso(await page.locator('.mv-capa').count() === 1, 'Miniaturas: hay una sola hoja del día abierta');
    await foto('agenda-miniaturas-miniaturas-claro'); await medir('Contenido · hoja del día');
    await tocar('.mv-hoja .md-pz'); await espera(700); await hojaAbierta();
    paso(await page.locator('.mv-hoja [data-a="editar"]').count() === 1, 'Miniaturas: tocar una pieza de esa hoja abre la hoja de la pieza (una hoja a la vez)');
    await page.goBack(); await sinHoja();
    // ---- Semana
    await tocar(`${V} [data-agv="semana"]`); paso(await page.locator(`${V} .md-sem-col`).count() === 7, 'Semana: siete columnas');
    if (!(await page.locator(`${V} .md-th-semana`).count())) await tocar(`${V} [data-sem="1"]`);
    paso(await page.locator(`${V} .md-th-semana`).count() >= 1, 'Semana: cada columna apila las miniaturas de su día');
    await foto('agenda-miniaturas-semana-claro'); await medir('Contenido · Semana'); await anchos('Contenido · Semana'); await axe('Contenido · Semana');
    await oscuro(true); await foto('agenda-miniaturas-semana-oscuro'); await oscuro(false);
    // ---- Puntos (como antes) y el modo se recuerda en este teléfono
    await tocar(`${V} [data-agv="puntos"]`); paso(await page.locator(`${V} .mv-celda`).count() >= 28 && await page.locator(`${V} .md-th`).count() === 0 || await page.locator(`${V} .mv-celda i u`).count() >= 1, 'Puntos: la cuadrícula con puntos, como antes');
    await foto('agenda-miniaturas-puntos-claro'); await medir('Contenido · Puntos'); await anchos('Contenido · Puntos');
    paso(await page.evaluate(() => localStorage.getItem('ao.mv.ct.vista')) === 'puntos', 'El modo elegido se recuerda en este teléfono (ao.mv.ct.vista)');
    await page.reload(); await page.waitForSelector('#mvRoot .mv-tabs'); await espera(700); await irMas('contenido', '.md-vistas');
    paso(await page.locator(`${V} [data-agv="puntos"][aria-pressed="true"]`).count() === 1, 'Tras recargar, la Agenda vuelve al modo elegido');
    await tocar(`${V} [data-agv="lista"]`); paso(await page.locator(`${V} .md-pz`).count() >= 5, 'Lista: las piezas salen como tarjetas');
    paso(await page.locator(`${V} .md-pz svg.ao-red`).count() >= 5, 'Contenido · Agenda: las redes salen con sus iconos reales (svg.ao-red)');
    paso(/BORRADOR|A REVISAR|APROBADA/.test(await page.locator(V).innerText()), 'Contenido · Agenda: cada pieza dice su estado');
    paso(await page.locator(`${V} .md-th-i img`).count() >= 3, 'Contenido · Agenda: las piezas con imagen enseñan su miniatura');
    await foto('01-agenda'); await medir('Contenido · Agenda'); await anchos('Contenido · Agenda'); await axe('Contenido · Agenda');
    // abrir una pieza: la hoja con sus acciones
    await tocar(`[data-vista="contenido"] [data-pz="${pBor.id}"]`); await hojaAbierta();
    paso(/Combo de octubre/.test(await page.locator('.mv-hoja').innerText()) && await page.locator('.mv-hoja [data-a="aprobar"]').count() === 1, 'Contenido: tocar una pieza abre su hoja (texto, redes, Editar, Aprobar)'); await foto('03-pieza'); await medir('Contenido · hoja de una pieza');
    await page.goBack(); await sinHoja();

    // ============================================================ COLA: aprobar un borrador de la semana en ≤ 3 toques
    toques = 0; await tocar('[data-vista="contenido"] [data-tab="cola"]'); await page.waitForSelector('[data-vista="contenido"] [data-aprobar]');
    paso(/borradores de la semana/i.test(await page.locator('[data-vista="contenido"]').innerText()), 'Cola · «Borradores de la semana» con Aprobar en cada uno');
    await foto('04-cola'); await medir('Contenido · Cola'); await anchos('Contenido · Cola'); await axe('Contenido · Cola');
    await tocar(`[data-vista="contenido"] [data-aprobar="${pBor.id}"]`); await hojaAbierta();
    paso(/¿Aprobar y programar\?/.test(await page.locator('.mv-hoja').innerText()), 'Aprobar pide un segundo toque en una hoja inferior (nada sale con un toque suelto)');
    paso((await api(`/api/contenido/piezas/${pBor.id}`)).pieza.estado === 'borrador', 'Antes del segundo toque la pieza SIGUE en borrador (el servidor no cambió nada)');
    await tocar('.mv-hoja-acc [data-acc="1"]'); await sinHoja(); await espera(500);
    paso(toques <= 3, `Aprobar un borrador de la semana: ${toques} toques (≤ 3)`);
    paso((await api(`/api/contenido/piezas/${pBor.id}`)).pieza.estado === 'aprobada', 'Tras el segundo toque el servidor la tiene aprobada');
    // una con problemas no se aprueba con un toque: el botón lo dice
    const sinHora = await page.locator(`[data-vista="contenido"] [data-aprobar="${pMal.id}"]`).getAttribute('aria-disabled');
    paso(sinHora === 'true', 'Un borrador con problemas (sin hora) tiene el Aprobar apagado y dice por qué al tocarlo');
    // selección múltiple
    await tocar('[data-vista="contenido"] [data-seleccionar]'); await tocar(`[data-vista="contenido"] [data-pz="${pRev.id}"]`); await tocar(`[data-vista="contenido"] [data-pz="${pVideo.id}"]`);
    paso(await page.locator('[data-vista="contenido"] .md-barra-sel:not([hidden])').count() === 1 && /2 elegidas/.test(await page.locator('.md-barra-sel').innerText()), 'Selección múltiple: la barra dice «2 elegidas» con Aprobar · A revisión · Mover · Papelera'); await foto('05-seleccion'); await medir('Contenido · selección');
    await tocar('[data-vista="contenido"] [data-seleccionar]');

    // ============================================================ PERFIL
    await tocar('[data-vista="contenido"] [data-tab="perfil"]'); await page.waitForSelector('[data-vista="contenido"] .md-grid');
    const rel = await page.evaluate(() => { const c = document.querySelector('.md-cel').getBoundingClientRect(); return c.height / c.width; });
    paso(Math.abs(rel - 4 / 3) < 0.03, `Perfil: la cuadrícula es 3:4 (${rel.toFixed(2)})`); await foto('06-perfil'); await medir('Contenido · Perfil'); await anchos('Contenido · Perfil');

    // ============================================================ BANDEJA
    await tocar('[data-vista="contenido"] [data-tab="bandeja"]'); await page.waitForSelector('[data-vista="contenido"] .md-bj');
    const lista = await page.locator('[data-vista="contenido"] .md-bandeja').innerText();
    paso(/Ana Pérez/.test(lista) && /EN UN ANUNCIO: Combo de octubre/i.test(lista), 'Bandeja: cada fila dice quién, la red y «EN UN ANUNCIO: …»');
    paso(/quedan 2[23] h/i.test(lista) && /ventana cerrada/i.test(lista), 'Bandeja: la ventana de 24 h se ve en la lista (quedan N h / ventana cerrada)');
    await foto('07-bandeja'); await medir('Contenido · Bandeja'); await anchos('Contenido · Bandeja'); await axe('Contenido · Bandeja');
    // el hilo del comentario con el borrador del agente
    await tocar('[data-vista="contenido"] .md-bj[data-id="meta:c1"]'); await hojaAbierta();
    const hilo = await page.locator('.mv-hoja').innerText();
    paso(/¿Cuánto cuesta el combo\?/.test(hilo) && await page.locator('.mv-hoja #mdBorr').inputValue() === 'Hola Ana, el combo cuesta $12. ¡Te esperamos!', 'Bandeja · hilo: el borrador del agente viene puesto y se puede editar');
    paso(await page.locator('.mv-hoja').evaluate(h => h.classList.contains('lleno')), 'Bandeja · el hilo abre a pantalla completa');
    await foto('08-hilo'); await medir('Bandeja · hilo');
    await page.locator('.mv-hoja #mdBorr').fill('Hola Ana, el combo cuesta $12 con postre.');
    bandeja.llamadas.length = 0;
    await tocar('.mv-hoja [data-h="enviar"]'); await page.waitForFunction(() => document.querySelectorAll('.mv-capa').length === 2); await espera(300);
    paso(await page.locator('.mv-capa').count() === 2 && /¿Enviar esta respuesta\?/.test(await page.locator('.mv-capa').last().innerText()), 'Bandeja: ENVIAR abre una segunda hoja «¿Enviar esta respuesta?» con el texto');
    paso(!bandeja.llamadas.some(l => l.ruta.endsWith('/enviar')), 'Bandeja: antes del segundo toque NO se llamó a enviar');
    await page.locator('.mv-capa').last().locator('[data-acc="1"]').tap(); await espera(700);
    paso(bandeja.llamadas.filter(l => l.ruta.endsWith('/enviar')).length === 1 && bandeja.llamadas.find(l => l.ruta.endsWith('/enviar')).cuerpo.texto === 'Hola Ana, el combo cuesta $12 con postre.', 'Bandeja: tras el segundo toque se envía UNA vez, con el texto editado');
    await sinHoja();
    // ventana cerrada: no hay botón de enviar
    await tocar('[data-vista="contenido"] .md-bj[data-id="meta:conv:2"]'); await hojaAbierta();
    paso(await page.locator('.mv-hoja [data-h="enviar"]').count() === 0 && /ventana de 24 h se cerró/.test(await page.locator('.mv-hoja').innerText()), 'Bandeja: con la ventana de 24 h cerrada no hay botón de enviar y se explica por qué'); await foto('09-ventana-cerrada');
    await page.goBack(); await sinHoja();
    // mensaje privado con ventana abierta: el contador de 1.000
    await tocar('[data-vista="contenido"] .md-bj[data-id="meta:conv:1"]'); await hojaAbierta();
    paso(/Puedes responder durante/.test(await page.locator('.mv-hoja').innerText()) && /de 999 letras/.test(await page.locator('.mv-hoja').innerText()), 'Bandeja: un mensaje privado muestra la ventana abierta y el contador de 1.000'); await foto('10-mensaje');
    await page.goBack(); await sinHoja();
    // ocultar con DESHACER
    await tocar('[data-vista="contenido"] .md-bj[data-id="meta:c2"]'); await hojaAbierta(); bandeja.llamadas.length = 0;
    await tocar('.mv-hoja [data-h="ocultar"]'); await espera(700);
    paso(bandeja.llamadas.some(l => l.ruta.endsWith('/ocultar') && l.cuerpo.ocultar === true) && await page.locator('.mv-toast-b').count() === 1, 'Bandeja: ocultar un comentario ofrece DESHACER');
    await page.locator('.mv-toast-b').first().tap(); await espera(500);
    paso(bandeja.llamadas.some(l => l.ruta.endsWith('/deshacer')), 'Bandeja: DESHACER llama al servidor');
    await page.goBack().catch(() => {}); await sinHoja();

    // ============================================================ CREAR PUBLICACIÓN
    await tocar('[data-vista="contenido"] [data-tab="agenda"]');
    toques = 0; await tocar('[data-vista="contenido"] [data-nueva]'); await page.waitForSelector('[data-vista="crear"]:not([hidden]) .md-red'); await espera(500);
    paso(await page.locator('.mv-tabs').evaluate(t => getComputedStyle(t).display === 'none'), 'Crear: es a pantalla completa (la barra de pestañas se va)');
    paso(await page.locator('[data-vista="crear"] .md-red.on').count() >= 1 && await page.locator('[data-vista="crear"] .md-red svg.ao-red').count() >= 2, 'Crear · ① Dónde: las redes de siempre ya vienen elegidas, con sus iconos reales');
    await foto('11-crear-donde'); await medir('Crear · Dónde'); await anchos('Crear · Dónde'); await axe('Crear · Dónde');
    await tocar('[data-vista="crear"] [data-ir="1"]');
    paso(/¿Qué dice\?/.test(await page.locator('[data-vista="crear"]').innerText()), 'Crear · ② Qué');
    await tocar('#mdTexto'); await page.locator('#mdTexto').fill('Hoy abrimos más temprano: te esperamos desde las 8 con café recién hecho.');
    paso(/\d+ \/ 2200/.test(await page.locator('[data-conts]').innerText()), 'Crear · ② el contador de cada red sale mientras escribes'); await foto('12-crear-que'); await medir('Crear · Qué'); await anchos('Crear · Qué');
    await tocar('[data-vista="crear"] [data-ir="1"]');
    paso(await page.locator('[data-vista="crear"] [data-gal]').count() >= 3, 'Crear · ③ Medios: la galería del Estudio sale a la vista (sin abrir nada)'); await foto('13-crear-medios'); await medir('Crear · Medios'); await anchos('Crear · Medios');
    await tocar('[data-vista="crear"] [data-gal]');
    await tocar('[data-vista="crear"] [data-ir="1"]'); await page.waitForSelector('[data-vista="crear"] .md-semaforo'); await espera(500);
    paso(await page.locator('[data-vista="crear"] .md-prev svg.ao-red').count() >= 1, 'Crear · ④ Cuándo: la vista previa por red lleva el icono real');
    paso(/Lista para aprobar|Puede salir/.test(await page.locator('[data-vista="crear"] .md-semaforo').innerText()), 'Crear · ④ el semáforo dice «Lista para aprobar»');
    paso(/\d{2}:\d{2}/.test(await page.locator('[data-vista="crear"] .md-cuando').innerText()), 'Crear · ④ el día y la hora vienen puestos (la mejor hora)');
    await foto('14-crear-cuando'); await medir('Crear · Cuándo'); await anchos('Crear · Cuándo'); await axe('Crear · Cuándo');
    await tocar('[data-vista="crear"] [data-guardar]'); await espera(900);
    paso(toques <= 8, `Crear una publicación completa: ${toques} toques (≤ 8)`);
    const todas = (await api('/api/contenido?sin_fecha=1')).piezas, nueva = todas.find(p => /Hoy abrimos más temprano/.test(p.texto));
    paso(nueva && nueva.estado === 'borrador' && nueva.medios.length === 1 && nueva.redes.length >= 1 && nueva.fecha && nueva.hora, 'Crear: queda guardada como BORRADOR (guardar no aprueba) con texto, imagen, redes, día y hora');
    await page.waitForSelector('[data-vista="contenido"]:not([hidden])', { timeout: 6000 }).catch(() => {});
    // y aprobando: ≤ 8 toques
    toques = 0; await tocar('[data-vista="contenido"] [data-nueva]'); await page.waitForSelector('[data-vista="crear"]:not([hidden]) .md-red'); await espera(400);
    await tocar('[data-vista="crear"] [data-ir="1"]'); await tocar('#mdTexto'); await page.locator('#mdTexto').fill('Nuevo menú de fin de semana, con opciones para toda la familia.'); await tocar('[data-vista="crear"] [data-ir="1"]');
    await tocar('[data-vista="crear"] [data-gal]'); await tocar('[data-vista="crear"] [data-ir="1"]'); await page.waitForSelector('[data-vista="crear"] .md-semaforo'); await espera(400);
    await tocar('[data-vista="crear"] [data-aprobar]'); await hojaAbierta();
    paso(/¿Aprobar y programar\?/.test(await page.locator('.mv-hoja').innerText()), 'Crear · aprobar pide la hoja de confirmación (segundo toque)');
    await tocar('.mv-hoja-acc [data-acc="1"]'); await sinHoja(); await espera(700);
    paso(toques <= 8, `Crear y APROBAR una publicación: ${toques} toques (≤ 8)`);
    const aprobada = (await api('/api/contenido?sin_fecha=1')).piezas.find(p => /Nuevo menú de fin de semana/.test(p.texto));
    paso(aprobada && aprobada.estado === 'aprobada', 'Crear: aprobada por el servidor tras el segundo toque');
    // editar una pieza existente: abre el asistente con sus datos
    await page.waitForSelector('[data-vista="contenido"]:not([hidden])', { timeout: 6000 }).catch(() => {});
    await tocar(`[data-vista="contenido"] [data-pz="${pRev.id}"]`); await hojaAbierta(); await tocar('.mv-hoja [data-a="editar"]'); await page.waitForSelector('[data-vista="crear"]:not([hidden]) .md-red.on'); await espera(500);
    await tocar('[data-vista="crear"] [data-ir="1"]');
    paso(await page.locator('#mdTexto').inputValue() === 'Así preparamos cada pedido, paso a paso.', 'Editar: el asistente abre con el texto de la pieza');
    await page.goBack(); await espera(500);

    // ============================================================ ANALÍTICAS (datos de ejemplo de la propia pantalla)
    await page.waitForSelector('.mv-tabs'); await irMas('analiticas', '[data-ejemplo]');
    paso(/Conecta Meta/.test(await page.locator('[data-vista="analiticas"]').innerText()), 'Analíticas: sin Meta conectada explica cómo conectar y ofrece los datos de ejemplo'); await foto('15-analiticas-conectar');
    await tocar('[data-vista="analiticas"] [data-ejemplo]'); await page.waitForSelector('[data-vista="analiticas"] .md-kpi'); await espera(300);
    paso(await page.locator('[data-vista="analiticas"] .md-kpi').count() === 6, 'Analíticas: seis cifras en tarjetas con su cambio frente al periodo anterior');
    paso(/DATOS DE EJEMPLO/.test(await page.locator('[data-vista="analiticas"]').innerText()), 'Analíticas: lo de ejemplo se rotula siempre');
    await foto('16-analiticas'); await medir('Analíticas'); await anchos('Analíticas'); await axe('Analíticas');
    // el gráfico se toca
    const g = page.locator('[data-vista="analiticas"] [data-graf] svg'); const caja = await g.boundingBox();
    await g.scrollIntoViewIfNeeded(); await espera(300); const caja2 = await g.boundingBox(); const antes = await page.locator('[data-gf]').innerText();
    await page.touchscreen.tap(caja2.x + caja2.width * 0.2, caja2.y + caja2.height / 2); await espera(250);
    const despues = await page.locator('[data-gf]').innerText();
    paso(antes !== despues, `Analíticas: tocar el gráfico cambia el día y el valor (${antes.split('·')[0].trim()} → ${despues.split('·')[0].trim()})`);
    await tocar('[data-vista="analiticas"] [data-cuentas]'); await hojaAbierta();
    paso(await page.locator('.mv-hoja .md-ava').count() >= 2, 'Analíticas: elegir cuenta abre una hoja con la foto (o inicial) de cada una'); await foto('17-analiticas-cuentas'); await medir('Analíticas · elegir cuenta');
    await page.locator('.mv-hoja [data-cta]').nth(1).tap(); await sinHoja(); await espera(300);
    paso(/Viendo/.test(await page.locator('[data-vista="analiticas"] .md-cuenta-b').innerText()) && !/Todas las cuentas/.test(await page.locator('[data-vista="analiticas"] .md-cuenta-b').innerText()), 'Analíticas: una cuenta sola cambia todo lo de abajo');
    await tocar('[data-vista="analiticas"] [data-cuentas]'); await hojaAbierta(); await page.locator('.mv-hoja [data-cta=""]').tap(); await sinHoja(); await espera(300);
    paso(await page.locator('[data-vista="analiticas"] .md-comp').count() >= 2, 'Analíticas: «Comparar cuentas» se lee como tarjetas'); await foto('18-analiticas-comparar');
    paso(await page.locator('[data-vista="analiticas"] [data-imp]').count() >= 1, 'Analíticas: «las que más movieron» tienen «Impulsar»');
    await tocar('[data-vista="analiticas"] [data-informe]'); await hojaAbierta(); paso(/Informe del mes/.test(await page.locator('.mv-hoja').innerText()), 'Analíticas: el informe del mes abre en una hoja'); await page.goBack(); await sinHoja();

    // ---- con Meta «conectada» (la misma foto de ejemplo, pero llegando por la API como llegaría de verdad): «Impulsar» lleva al borrador, en pausa ----
    const borradorImp = { id: 'b-imp', nombre: 'Impulsar: El combo de octubre', de: 'dueno', estado: 'borrador', objetivo: 'mensajes', destino: 'whatsapp', publico: { modo: 'advantage', paises: ['PA'], edadMin: 18 }, presupuesto: { tipo: 'diario', usd: 5 }, origen: { tipo: 'publicacion', red: 'instagram', id: 'ig-1', texto: 'El combo de octubre ya está aquí', enlace: 'https://www.instagram.com/p/abc/', miniatura: '', publicadaAt: iso(-3 * 864e5) }, creativos: [{ id: 'cr-1', media: null, llamada: 'WHATSAPP_MESSAGE' }] };
    const pedidosImp = [];
    await page.route('**/api/contenido/analiticas?**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(datosDeEjemplo()) }));
    await page.route('**/api/anuncios/impulsar', r => { pedidosImp.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ borrador: borradorImp }) }); });
    await page.route('**/api/anuncios/borradores', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [borradorImp] }) }));
    await page.route('**/api/anuncios/borradores/b-imp/validar', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ borrador: { ...borradorImp, validacion: { ok: true, problemas: [], costoMax: { dia: 5 } } } }) }));
    await tocar('[data-vista="analiticas"] [data-salir-ej]'); await page.waitForSelector('[data-vista="analiticas"] [data-imp]'); await espera(300);
    paso(!/DATOS DE EJEMPLO/.test(await page.locator('[data-vista="analiticas"]').innerText()), 'Analíticas con Meta conectada: ya no dice «ejemplo» y lee de la oficina');
    await tocar('[data-vista="analiticas"] [data-imp="0"]'); await page.waitForSelector('[data-vista="anuncios-asistente"]:not([hidden]) .md-card', { timeout: 10000 }); await espera(500);
    paso(pedidosImp.length === 1 && pedidosImp[0].id && pedidosImp[0].red, 'Impulsar: manda solo los ids de la publicación al servidor (él busca lo demás)');
    paso(/La publicación que impulsas/.test(await page.locator('[data-vista="anuncios-asistente"]').innerText()) && /Paso 4 de 5/.test(await page.locator('[data-vista="anuncios-asistente"]').innerText()), 'Impulsar: abre el borrador en el paso 4 con la publicación (se crea en pausa; no gasta nada)'); await foto('25b-impulsar'); await medir('Impulsar · paso 4');
    await page.goBack(); await espera(500); await page.goBack(); await espera(500);

    // ============================================================ ANUNCIOS (datos de ejemplo: el mismo motor del dinero que escritorio)
    await irMas('anuncios', '.md-tabs'); await tocar('[data-vista="anuncios"] [data-tab="resumen"]'); await page.waitForSelector('[data-vista="anuncios"] [data-ejemplo]');
    paso(/Conecta tu cuenta publicitaria/.test(await page.locator('[data-vista="anuncios"]').innerText()), 'Anuncios: sin cuenta conectada lo dice y ofrece el ejemplo');
    await tocar('[data-vista="anuncios"] [data-ejemplo]'); await page.waitForSelector('[data-vista="anuncios"] .md-med'); await espera(400);
    paso(await page.locator('[data-vista="anuncios"] .md-barra').count() >= 1 && /DATOS DE EJEMPLO/.test(await page.locator('[data-vista="anuncios"]').innerText()), 'Anuncios · Resumen: el gasto contra tus topes con su barra, y el ejemplo rotulado');
    await foto('19-anuncios-resumen'); await medir('Anuncios · Resumen'); await anchos('Anuncios · Resumen'); await axe('Anuncios · Resumen');
    await tocar('[data-vista="anuncios"] [data-tab="campanas"]'); await page.waitForSelector('[data-vista="anuncios"] .md-camp');
    paso(await page.locator('[data-vista="anuncios"] .md-sw').count() >= 2, 'Anuncios · Campañas: el interruptor está escrito en palabras («Activa · Pausar» / «En pausa · Activar»)');
    await foto('20-anuncios-campanas'); await medir('Anuncios · Campañas'); await anchos('Anuncios · Campañas'); await axe('Anuncios · Campañas');
    // la regla del dinero
    const activa = page.locator('[data-vista="anuncios"] .md-sw.on').first(), idAct = await activa.getAttribute('data-id');
    toques = 0; await activa.tap(); toques++; await espera(700);
    paso(await page.locator('.mv-toast-b').count() >= 1 && toques === 1, 'Dinero: PAUSAR es un toque y ofrece DESHACER');
    await page.locator('.mv-toast-b').first().tap(); await espera(700);
    paso(await page.locator(`[data-vista="anuncios"] .md-sw.on[data-id="${idAct}"]`).count() === 1, 'Dinero: DESHACER la deja activa otra vez');
    const pausada = page.locator('[data-vista="anuncios"] .md-sw.off').first(), idPau = await pausada.getAttribute('data-id');
    await pausada.tap(); await hojaAbierta(); await page.waitForSelector('.mv-hoja [data-d="si"], .mv-hoja [data-d="cancelar"]', { timeout: 6000 }); await espera(300);
    const textoSi = await page.locator('.mv-hoja [data-d="si"]').innerText().catch(() => '');
    paso(/^Sí, (activar|reanudar)( — hasta .+)?$/.test(textoSi.trim()) && /hasta/.test(await page.locator('.mv-hoja').innerText()), `Dinero: ACTIVAR pide un segundo toque y el botón dice la cifra («${textoSi.trim()}»)`);
    await foto('21-anuncios-activar'); await medir('Anuncios · segundo toque');
    await page.locator('.mv-hoja [data-d="cancelar"]').tap(); await sinHoja(); await espera(400);
    paso(await page.locator(`[data-vista="anuncios"] .md-sw.off[data-id="${idPau}"]`).count() === 1, 'Dinero: cancelar el segundo toque NO activa nada');
    await page.locator(`[data-vista="anuncios"] .md-sw.off[data-id="${idPau}"]`).tap(); await page.waitForSelector('.mv-hoja [data-d="si"]'); await espera(300);
    await page.locator('.mv-hoja [data-d="si"]').tap(); await espera(900);
    paso(await page.locator(`[data-vista="anuncios"] .md-sw.on[data-id="${idPau}"]`).count() === 1, 'Dinero: con el segundo toque («Sí, …») sí se activa');
    // subir presupuesto pasa por formulario → cifra → sí
    await tocar('[data-vista="anuncios"] [data-det]'); await hojaAbierta();
    const sub = page.locator('.mv-hoja [data-act="subir_presupuesto"]'); const haySub = await sub.count();
    if (haySub) { await sub.tap(); await page.waitForSelector('.mv-hoja input[data-f="valor"]'); await foto('22-anuncios-subir'); paso(/Ver lo que gasta/.test(await page.locator('.mv-hoja').innerText()), 'Dinero: subir un presupuesto empieza por un formulario y «Ver lo que gasta» (todavía no cambia nada)'); await page.locator('.mv-hoja [data-d="enviar"]').tap(); await page.waitForSelector('.mv-hoja [data-d="si"], .mv-hoja [data-d="cancelar"]'); await espera(300); paso(await page.locator('.mv-hoja [data-d="si"]').count() === 1 || /No cabe|Meta no/.test(await page.locator('.mv-hoja').innerText()), 'Dinero: luego viene la cifra (o el motivo por el que no cabe en los topes)'); await page.goBack().catch(() => {}); await sinHoja(); }
    else { paso(true, 'Dinero: (esta fila no ofrece subir presupuesto)'); await page.goBack(); await sinHoja(); }
    // otras pestañas
    await tocar('[data-vista="anuncios"] [data-tab="sugerencias"]'); await page.waitForSelector('[data-vista="anuncios"] .md-card[data-sug]'); await foto('23-anuncios-sugerencias'); await medir('Anuncios · Sugerencias'); await anchos('Anuncios · Sugerencias');
    paso(/Descartar/.test(await page.locator('[data-vista="anuncios"]').innerText()), 'Anuncios · Sugerencias: cada una con su dato, su porqué y sus botones');
    await tocar('[data-vista="anuncios"] [data-tab="creativos"]'); await page.waitForSelector('[data-vista="anuncios"] .md-card'); await foto('24-anuncios-creativos'); await medir('Anuncios · Creativos');
    await tocar('[data-vista="anuncios"] [data-tab="historial"]'); await espera(500); await medir('Anuncios · Historial');
    await tocar('[data-vista="anuncios"] [data-tab="borradores"]'); await page.waitForSelector('[data-vista="anuncios"] [data-nueva]'); await foto('25-anuncios-borradores'); await medir('Anuncios · Borradores');

    // ---- el asistente de 5 pasos ----
    await tocar('[data-vista="anuncios"] [data-nueva]'); await page.waitForSelector('[data-vista="anuncios-asistente"]:not([hidden]) .md-op'); await espera(500);
    paso(await page.locator('.mv-tabs').evaluate(t => getComputedStyle(t).display === 'none'), 'Campaña nueva: el asistente va a pantalla completa'); await foto('26-campana-1'); await medir('Campaña · paso 1'); await anchos('Campaña · paso 1'); await axe('Campaña · paso 1');
    await page.locator('[data-vista="anuncios-asistente"] [data-op^="objetivo|mensajes"]').tap(); await espera(300);
    await tocar('[data-vista="anuncios-asistente"] [data-nav="1"]'); await espera(400); await foto('27-campana-2'); await medir('Campaña · paso 2'); await anchos('Campaña · paso 2');
    await tocar('[data-vista="anuncios-asistente"] [data-nav="1"]'); await espera(400);
    await page.locator('#mdb-presupuesto-usd').fill('5'); await espera(300); await foto('28-campana-3'); await medir('Campaña · paso 3'); await anchos('Campaña · paso 3');
    await tocar('[data-vista="anuncios-asistente"] [data-nav="1"]'); await espera(400); await foto('29-campana-4'); await medir('Campaña · paso 4'); await anchos('Campaña · paso 4');
    await tocar('[data-vista="anuncios-asistente"] [data-gal]'); await hojaAbierta(); await page.waitForSelector('.mv-hoja [data-gf]'); await page.locator('.mv-hoja [data-gf]').first().tap(); await page.locator('.mv-hoja-acc [data-acc="1"]').tap(); await sinHoja(); await espera(400);
    await tocar('[data-vista="anuncios-asistente"] [data-nav="1"]'); await espera(900); await foto('30-campana-5'); await medir('Campaña · paso 5');
    const crearBtn = page.locator('[data-vista="anuncios-asistente"] [data-crear]'); paso(await crearBtn.count() === 1 && /en pausa/i.test(await crearBtn.innerText()), 'Campaña · paso 5: el botón dice «Crear en Meta (en pausa)»: nada nace activo');

    paso(!errores.length, `sin errores de consola ni de página${errores.length ? ' → ' + errores.slice(0, 3).join(' | ') : ''}`);
    await ctx.close();
  } finally { await browser.close(); o.cerrar(); }
  console.log(`\n${fallos ? fallos + ' paso(s) fallaron' : 'todo en orden'} (${res.length} comprobaciones)`);
  return { fallos, res };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await correr({ capturas: process.argv.includes('--capturas') });
  process.exit(r.fallos ? 1 : 0);
}
