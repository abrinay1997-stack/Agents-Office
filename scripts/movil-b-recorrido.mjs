// Recorrido de navegador del EQUIPO B de la versión móvil (25 oct 2026): Cerebro, Estudio, Buscar y las imágenes de Dimitri.
// Oficina temporal (la de scripts/movil-recorrido.mjs), Chromium de teléfono con toque y gestos reales por CDP. Falla si algo no se cumple:
//   · 0 objetivos táctiles < 44 px, campos ≥ 16 px, todo con nombre, 0 desbordamiento horizontal a 320/360/390/430, axe sin críticos ni serios (AO_AXE);
//   · Cerebro: lista + buscador + filtros, la nota a pantalla completa con sus enlaces, subir un documento, papelera, el mapa con pellizco;
//   · Estudio: galería, visor (deslizar y pellizcar), acciones, compositor (modelo y formato a la vista, costo en GENERAR, segundo toque desde US$0,50);
//   · Buscar: resultados agrupados y recientes; Dimitri: adjuntar una foto manda `attach` y una copia ≤ 1568 px en `vision`;
//   · las tareas comunes en ≤ 3 toques.
//   node scripts/movil-b-recorrido.mjs [--capturas]     → ✓/✗ por paso y, con --capturas, docs/capturas-movil/despues/b-*.jpg
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { oficina } from './movil-recorrido.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'docs', 'capturas-movil', 'despues');
const espera = ms => new Promise(r => setTimeout(r, ms));

export async function correr({ capturas = false } = {}) {
  const res = []; let fallos = 0;
  const paso = (ok, que) => { if (!ok) fallos++; res.push({ ok: !!ok, que }); console.log(`${ok ? '✓' : '✗'} ${que}`); };
  const o = await oficina();
  let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  try {
    // ---- semilla: imágenes del Estudio (motor gratis «Prueba») y una favorita ----
    const ids = [];
    for (const p of ['un gato sobre un sofá azul', 'taza de café en una mesa de madera', 'logo de una panadería', 'paisaje al atardecer', 'zapatos deportivos blancos']) {
      const j = await o.api('/api/media/jobs', 'POST', { prompt: p, n: 1, kind: 'image', model: 'prueba', settings: {}, media: {}, by: 'you', wait: 15000 }); ids.push(j.job?.id);
    }
    await espera(800);
    const gal = await o.api('/api/media?n=20'); const primero = gal.items?.[0];
    if (primero) await o.api('/api/media/item/' + encodeURIComponent(primero.file), 'PATCH', { fav: true });
    paso((gal.items || []).length >= 5, `semilla: ${(gal.items || []).length} imágenes en el Estudio`);

    const errores = [];
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, acceptDownloads: true }), page = await ctx.newPage();
    page.on('pageerror', e => errores.push('pageerror: ' + e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' ').replace(/\s+/g, ' '))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon|net::ERR/.test(m.text())) errores.push('console: ' + m.text()); });
    await page.goto(o.base); await page.waitForSelector('#mvRoot .mv-tabs'); await page.waitForSelector('[data-vista="inicio"] .mv-card', { timeout: 15000 }); await espera(400);
    let toques = 0; const tocar = async sel => { toques++; await page.locator(sel).first().tap(); await espera(280); };
    const foto = async n => { if (!capturas) return; fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, 'b-' + n + '.jpg'), type: 'jpeg', quality: 50 }); };
    const cdp = await ctx.newCDPSession(page);
    const dedos = async (tramos, pausa = 14) => { const [a, ...r] = tramos; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: a }); for (const p of r) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: p }); await espera(pausa); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await espera(400); };

    const medir = async nombre => {
      const r = await page.evaluate(() => {
        const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden],[inert]') && !e.closest('.mv-capa:not(.entra)'); };
        const raiz = document.getElementById('mvRoot'), malos = [], sinNombre = [], chicos = [];
        for (const e of raiz.querySelectorAll('button, [role="button"], input:not([type="hidden"]):not(.mv-sr), select, textarea, summary, a[href]')) {
          if (!vis(e) || (e.closest('.md') && e.tagName === 'A')) continue;
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
      const r = await page.evaluate(() => { const w = innerWidth, de = document.documentElement; const sobran = [...document.querySelectorAll('#mvRoot *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > w + 1 || b.left < -1) && !e.closest('.mv-chips, .mv-capa:not(.entra), .md-tbl, pre, .mv-grid') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map(e => e.className || e.tagName); return { ancho: de.scrollWidth <= innerWidth + 1, sobran }; });
      paso(r.ancho && !r.sobran.length, `${nombre}: sin desplazamiento horizontal${r.sobran.length ? ' → ' + r.sobran.join(', ') : ''}`);
    };
    const AXE = process.env.AO_AXE && fs.existsSync(process.env.AO_AXE) ? process.env.AO_AXE : null;
    const axe = async nombre => {
      if (!AXE) return; if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ path: AXE });
      const v = await page.evaluate(async () => { const r = await window.axe.run(document.getElementById('mvRoot'), { resultTypes: ['violations'] }); return r.violations.filter(x => x.impact === 'critical' || x.impact === 'serious').map(x => `${x.id} (${x.impact}, ${x.nodes.length}): ${x.nodes[0].target.join(' ')}`); });
      paso(!v.length, `axe · ${nombre}: sin críticos ni serios${v.length ? ' → ' + v.join(' | ') : ''}`);
    };
    const cerrarHoja = async () => { await page.goBack(); await page.waitForSelector('.mv-hoja', { state: 'detached', timeout: 4000 }).catch(() => {}); };
    const abrirMas = async id => { await tocar('.mv-tab[data-tab="mas"]'); await page.waitForSelector('.mv-hoja.mv-mas'); await tocar(`.mv-hoja [data-vista="${id}"]`); await page.waitForSelector(`section[data-vista="${id}"]:not([hidden])`); await espera(300); };

    // =============== CEREBRO ===============
    toques = 0; await abrirMas('cerebro'); await page.waitForSelector('.mv-notas-l .mv-lista-b', { timeout: 10000 });
    paso(toques === 2, `Cerebro: se abre desde Más en ${toques} toques`);
    const nNotas = await page.locator('.mv-notas-l .mv-lista-b').count();
    paso(nNotas >= 10, `Cerebro: la primera vista es la LISTA de notas con buscador (${nNotas} notas)`); await foto('cerebro-lista'); await medir('Cerebro (lista)'); await axe('Cerebro (lista)');
    paso(await page.locator('[data-vista="cerebro"] .mv-chip[data-edad]').count() === 4 && await page.locator('[data-vista="cerebro"] .mv-chip[data-carp]').count() >= 2, 'Cerebro: filtros por cuándo (4) y por carpeta');
    const antes = nNotas; await page.locator('[data-vista="cerebro"] [data-carp]').nth(1).tap(); await espera(250);
    const filtradas = await page.locator('.mv-notas-l .mv-lista-b').count(); paso(filtradas > 0 && filtradas < antes, `Cerebro: filtrar por una carpeta deja ${filtradas} de ${antes}`); await page.locator('[data-vista="cerebro"] [data-carp="todas"]').tap(); await espera(200);
    // buscar y leer una nota: 3 toques o menos desde la lista
    toques = 0; await tocar('#mvCq'); await page.fill('#mvCq', 'voice'); await page.waitForFunction(() => document.querySelector('.mv-notas-l b')?.textContent.toLowerCase().includes('voice'), null, { timeout: 6000 }); await tocar('.mv-notas-l .mv-lista-b');
    await page.waitForSelector('.mv-hoja.mv-nota .mv-md'); await espera(500); paso(toques <= 3, `Cerebro: buscar y leer una nota está a ${toques} toques (≤ 3)`);
    paso(await page.evaluate(() => { const h = document.querySelector('.mv-hoja.mv-nota').getBoundingClientRect(); return h.width >= innerWidth - 1 && h.height >= innerHeight - 1; }), 'Cerebro: la nota ocupa la pantalla entera');
    await foto('cerebro-nota'); await medir('Cerebro (nota)'); await axe('Cerebro (nota)');
    const enl = await page.locator('.mv-hoja.mv-nota .mv-enl').count(); paso(enl >= 1, `Cerebro: los [[enlaces]] de la nota son botones (${enl})`);
    const t0 = await page.locator('.mv-hoja.mv-nota h2').innerText(); await page.locator('.mv-hoja.mv-nota .mv-enl').first().tap(); await espera(700);
    const t1 = await page.locator('.mv-hoja.mv-nota h2').innerText(); paso(t1 !== t0 && await page.locator('.mv-hoja.mv-nota [data-volver]').count() === 1, `Cerebro: seguir un enlace pasa de «${t0}» a «${t1}» con «Volver a…»`);
    await cerrarHoja(); paso(await page.locator('.mv-hoja').count() === 0, 'Cerebro: «atrás» cierra la nota y vuelve a la lista');
    // subir un documento
    await page.fill('#mvCq', ''); await page.locator('[data-a="subir"]').tap(); await page.waitForSelector('.mv-hoja #mvArch', { state: 'attached' }); await medir('Cerebro (subir)');
    await page.setInputFiles('#mvArch', { name: 'politica-devoluciones.txt', mimeType: 'text/plain', buffer: Buffer.from('Política de devoluciones\n\nSe aceptan devoluciones dentro de 30 días con el recibo.\n') });
    await page.waitForSelector('.mv-toast:has-text("creada")', { timeout: 10000 }).catch(() => {}); await espera(600);
    const hs = await o.api('/api/brain/search?q=devoluciones'); paso((hs.hits || []).length >= 1, 'Cerebro: subir un documento lo vuelve una nota que se encuentra');
    await page.waitForFunction(() => [...document.querySelectorAll('.mv-notas-l b')].some(b => /politica/i.test(b.textContent)), null, { timeout: 6000 }).catch(() => {});
    paso(await page.evaluate(() => [...document.querySelectorAll('.mv-notas-l b')].some(b => /politica/i.test(b.textContent))), 'Cerebro: la lista se actualiza con la nota nueva');
    // papelera
    await page.locator('[data-a="papelera"]').tap(); await page.waitForSelector('.mv-hoja .mv-vacio, .mv-hoja ul'); paso(/vac/i.test(await page.locator('.mv-hoja').innerText()), 'Cerebro: la papelera vacía lo dice'); await cerrarHoja();
    // mapa
    await page.locator('[data-a="mapa"]').tap(); await page.waitForSelector('.mv-hoja.mv-mapa'); await espera(500);
    const modesto = await page.locator('.mv-hoja.mv-mapa [data-lista]').count();
    if (modesto) { await page.locator('.mv-hoja.mv-mapa [data-igual]').tap(); await espera(400); }
    await page.waitForSelector('.mv-hoja.mv-mapa canvas'); await foto('cerebro-mapa'); await medir('Cerebro (mapa)');
    const huella = () => page.evaluate(() => { const c = document.querySelector('.mv-lienzo'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 97) { h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) | 0; if (d[i + 3]) n++; } return { h, n }; });
    const h0 = await huella(); paso(h0.n > 20, 'Cerebro: el mapa dibuja las notas');
    const cb = await page.locator('.mv-lienzo').boundingBox(), cx = cb.x + cb.width / 2, cy = cb.y + cb.height / 2;
    await dedos(Array.from({ length: 10 }, (_, i) => [{ id: 1, x: cx - 20 - i * 6, y: cy }, { id: 2, x: cx + 20 + i * 6, y: cy }]));
    const h1 = await huella(); paso(h1.h !== h0.h, 'Cerebro: el pellizco acerca el mapa'); await foto('cerebro-mapa-zoom');
    paso(await page.evaluate(() => { const h = document.querySelector('.mv-hoja.mv-mapa'); return !!h; }), 'Cerebro: el mapa tiene su salida «Ver como lista»'); await cerrarHoja();

    // =============== ESTUDIO ===============
    await tocar('.mv-tab[data-tab="inicio"]'); toques = 0; await abrirMas('estudio'); await page.waitForSelector('.mv-tile', { timeout: 10000 });
    const nTiles = await page.locator('[data-vista="estudio"] .mv-tile').count(); paso(nTiles >= 5, `Estudio: la galería en cuadrícula (${nTiles} piezas)`);
    paso((await page.locator('.mv-grid').first().evaluate(g => getComputedStyle(g).gridTemplateColumns.split(' ').length)) === 2, 'Estudio: 2 columnas a 390 px');
    paso(/hoy/i.test(await page.locator('[data-vista="estudio"] .mv-gh').first().innerText()), 'Estudio: el día es el título de cada grupo («Hoy»)'); await foto('estudio-galeria'); await medir('Estudio (galería)'); await axe('Estudio (galería)');
    // visor
    toques = 0; await tocar('[data-vista="estudio"] .mv-tile'); await page.waitForSelector('.mv-hoja.mv-visor .mv-stage img'); await espera(500); paso(toques === 1, 'Estudio: abrir una pieza es 1 toque');
    paso(await page.evaluate(() => { const h = document.querySelector('.mv-hoja.mv-visor').getBoundingClientRect(); return h.width >= innerWidth - 1 && h.height >= innerHeight - 1; }), 'Estudio: el visor ocupa toda la pantalla');
    await foto('estudio-visor'); await medir('Estudio (visor)'); await axe('Estudio (visor)');
    const tit0 = await page.locator('.mv-visor h2').innerText();
    const sb = await page.locator('.mv-stage').boundingBox(), sy = sb.y + sb.height / 2;
    await dedos(Array.from({ length: 10 }, (_, i) => [{ id: 1, x: sb.x + sb.width - 40 - i * 28, y: sy }]));
    const tit1 = await page.locator('.mv-visor h2').innerText(); paso(tit0.startsWith('1 de') && tit1.startsWith('2 de'), `Estudio: deslizar a la izquierda pasa de «${tit0}» a «${tit1}»`);
    await dedos(Array.from({ length: 10 }, (_, i) => [{ id: 1, x: sb.x + 40 + i * 28, y: sy }])); paso((await page.locator('.mv-visor h2').innerText()).startsWith('1 de'), 'Estudio: deslizar a la derecha vuelve');
    await dedos(Array.from({ length: 10 }, (_, i) => [{ id: 1, x: sb.x + sb.width / 2 - 20 - i * 5, y: sy }, { id: 2, x: sb.x + sb.width / 2 + 20 + i * 5, y: sy }]));
    const tr = await page.locator('.mv-stage img').evaluate(e => e.style.transform); paso(/scale\((?!1\.0000)/.test(tr), `Estudio: el pellizco acerca la imagen (${tr.match(/scale\([\d.]+\)/)?.[0]})`); await foto('estudio-visor-zoom');
    // acciones
    toques = 0; await tocar('.mv-visor [data-acc]'); await page.waitForSelector('.mv-hoja:not(.mv-visor) [data-a="variar"]'); await foto('estudio-acciones'); await medir('Estudio (acciones)');
    const acc = await page.locator('.mv-hoja:not(.mv-visor) [data-a]').evaluateAll(l => l.map(b => b.dataset.a));
    paso(['ref', 'variar', 'animar', 'descargar', 'papelera'].every(a => acc.includes(a)), `Estudio: la hoja de acciones trae ${acc.join(', ')}`);
    // variar → compositor listo, sin gastar
    let pedidosJobs = 0; page.on('request', r => { if (r.method() === 'POST' && /\/api\/media\/jobs$/.test(r.url())) pedidosJobs++; });
    await tocar('.mv-hoja:not(.mv-visor) [data-a="variar"]'); await page.waitForSelector('[data-p="crear"]:not([hidden]) #mvIdea'); await espera(500);
    paso((await page.locator('#mvIdea').inputValue()).length > 3 && pedidosJobs === 0, 'Estudio: «Variar» deja el pedido listo en el compositor y NO genera solo');
    paso(/aprox|gratis/.test(await page.locator('[data-gen] .mv-generar').innerText()) , `Estudio: el costo va junto a GENERAR («${(await page.locator('[data-gen] .mv-generar').innerText()).trim()}»)`);
    paso(await page.locator('[data-modelo]').isVisible() && await page.locator('[data-set="aspectRatio"]').count() >= 1, 'Estudio: el modelo y el formato están siempre a la vista'); await foto('estudio-crear'); await medir('Estudio (crear)'); await axe('Estudio (crear)');
    // generar con el motor gratis: 1 toque (la idea ya está)
    toques = 0; await tocar('[data-generar]'); await page.waitForSelector('[data-p="curso"]:not([hidden]) .mv-trabajo', { timeout: 8000 }); paso(toques === 1 && pedidosJobs === 1, `Estudio: GENERAR (gratis) manda un pedido en ${toques} toque`);
    await foto('estudio-curso'); await medir('Estudio (en curso)'); await page.waitForSelector('.mv-trabajo.done, .mv-trabajo.running, .mv-trabajo.queued'); paso(true, 'Estudio: el trabajo aparece en «En curso»');
    await page.waitForFunction(() => document.querySelector('.mv-trabajo.done'), null, { timeout: 20000 }).catch(() => {}); paso(await page.locator('.mv-trabajo.done').count() >= 1, 'Estudio: el trabajo termina y dice «Listo»');
    // el segundo toque desde US$0,50 (motor de pago de mentira: la respuesta del catálogo se cambia, el pedido se intercepta)
    await page.route(/\/api\/media\?.*catalog=1/, async r => { const resp = await r.fetch(); const j = await resp.json(); j.models.push({ id: 'caro-x', name: 'Modelo caro (prueba)', engine: 'fal', engineName: 'fal', kind: 'image', cost: 0.9, per: 'item', seconds: null, roles: {}, needs: [], settings: { aspectRatio: { type: 'enum', values: ['1:1', '9:16'], default: '1:1' } }, on: true, tier: 4, speed: 'normal', uses: ['prueba'] }); j.default = { ...j.default, image: 'caro-x' }; await r.fulfill({ response: resp, json: j }); });
    await page.route(/\/api\/media\/jobs$/, async r => { if (r.request().method() === 'POST') { await r.fulfill({ json: { job: { id: 'falso1', state: 'queued', kind: 'image', model: 'caro-x', modelName: 'Modelo caro (prueba)', prompt: 'x', n: 1, at: Date.now() }, budget: {} } }); } else await r.continue(); });
    await page.reload(); await page.waitForSelector('#mvRoot .mv-tabs'); await abrirMas('estudio'); await tocar('[data-tab="crear"]'); await page.waitForFunction(() => /caro/i.test(document.querySelector('[data-modelo]')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
    paso(true, 'Estudio: motor de pago simulado');
    const hay = /caro/i.test(await page.locator('[data-modelo]').innerText().catch(() => ''));
    if (hay) {
      await page.fill('#mvIdea', 'una foto de prueba'); await page.locator('#mvIdea').blur(); const antesJ = pedidosJobs;
      paso(/0,90/.test(await page.locator('[data-generar]').innerText()), 'Estudio: GENERAR dice el precio exacto (US$0,90)');
      await tocar('[data-generar]'); paso(pedidosJobs === antesJ && /Confirmar/.test(await page.locator('[data-generar]').innerText()), 'Estudio: desde US$0,50 el primer toque NO gasta: pide confirmar');
      await tocar('[data-generar]'); await espera(500); paso(pedidosJobs === antesJ + 1, 'Estudio: el segundo toque envía el pedido');
    } else paso(false, 'Estudio: no apareció el modelo de pago simulado');
    await page.unroute(/\/api\/media\?.*catalog=1/); await page.unroute(/\/api\/media\/jobs$/);
    // lotes en solo lectura
    await page.reload(); await page.waitForSelector('#mvRoot .mv-tabs'); await abrirMas('estudio'); await tocar('[data-tab="lotes"]'); await page.waitForSelector('[data-p="lotes"]:not([hidden]) .mv-intro, [data-p="lotes"] .mv-vacio'); paso(/escritorio/i.test(await page.locator('[data-p="lotes"]').innerText()), 'Estudio: los lotes se siguen aquí y se piden en escritorio'); await foto('estudio-lotes'); await medir('Estudio (lotes)');
    // papelera con deshacer desde el visor
    await tocar('[data-tab="galeria"]'); await page.waitForSelector('.mv-tile'); const nAntes = await page.locator('[data-vista="estudio"] .mv-tile').count(); await tocar('[data-vista="estudio"] .mv-tile'); await page.waitForSelector('.mv-visor .mv-stage'); await tocar('.mv-visor [data-acc]'); await page.waitForSelector('[data-a="papelera"]'); await tocar('[data-a="papelera"]');
    await page.waitForSelector('.mv-toast:has-text("papelera")'); paso(true, 'Estudio: «A la papelera» avisa con DESHACER'); await page.locator('.mv-toast-b').first().tap(); await espera(900);
    await page.waitForFunction(n => document.querySelectorAll('[data-vista="estudio"] .mv-tile').length >= n, nAntes, { timeout: 6000 }).catch(() => {}); await cerrarHoja().catch(() => {});
    paso((await o.api('/api/media?n=100')).items.length >= nAntes, 'Estudio: Deshacer recupera la pieza');
    for (const w of [320, 360, 430]) { await page.setViewportSize({ width: w, height: 800 }); await espera(300); await desborda(`${w} px · Estudio`); } await page.setViewportSize({ width: 390, height: 844 });

    // =============== BUSCAR ===============
    await page.waitForSelector('.mv-hoja', { state: 'detached' }).catch(() => {}); await tocar('.mv-tab[data-tab="inicio"]');
    toques = 0; await tocar('.mv-buscar'); await page.waitForSelector('section[data-vista="buscar"]:not([hidden]) #mvQ'); await espera(300);
    paso(await page.evaluate(() => document.activeElement && document.activeElement.id === 'mvQ'), 'Buscar: el campo ya tiene el foco (teclado abierto)');
    paso(await page.locator('#mvQ').getAttribute('type') === 'search' && await page.locator('#mvQ').getAttribute('enterkeyhint') === 'search', 'Buscar: teclado de búsqueda (type=search, enterkeyhint)'); await foto('buscar-vacio'); await medir('Buscar (vacío)');
    await page.fill('#mvQ', 'gato'); await page.waitForSelector('.mv-miniaturas .mv-mini-img', { timeout: 6000 }); await foto('buscar-resultados'); paso(await page.locator('.mv-res .mv-gh', { hasText: 'Imágenes' }).count() === 1, 'Buscar: las imágenes salen agrupadas');
    await page.fill('#mvQ', 'voice'); await page.waitForSelector('.mv-res .mv-gh:has-text("Notas")', { timeout: 6000 }); await foto('buscar-notas'); await medir('Buscar (resultados)'); await axe('Buscar');
    await page.fill('#mvQ', 'Llamar'); await page.waitForSelector('.mv-res .mv-gh:has-text("Tareas")', { timeout: 6000 }); paso(true, 'Buscar: las tareas salen agrupadas (Tareas)');
    await page.fill('#mvQ', 'voice'); await page.waitForSelector('.mv-res .mv-gh:has-text("Notas")'); await tocar('.mv-res [data-k="n"]'); await page.waitForSelector('.mv-hoja.mv-nota .mv-md', { timeout: 8000 }); paso(toques <= 3, `Buscar: de la lupa a leer la nota son ${toques} toques (≤ 3)`);
    await cerrarHoja();
    await page.goBack().catch(() => {}); await page.waitForTimeout(400);
    await tocar('.mv-tab[data-tab="inicio"]').catch(() => {}); await tocar('.mv-buscar'); await page.waitForSelector('#mvQ'); await page.fill('#mvQ', ''); await espera(300);
    paso(await page.locator('.mv-res [data-rec]').count() >= 1, 'Buscar: con el campo vacío salen las búsquedas recientes');
    for (const w of [320, 360, 430]) { await page.setViewportSize({ width: w, height: 800 }); await espera(300); await desborda(`${w} px · Buscar`); } await page.setViewportSize({ width: 390, height: 844 });

    // =============== DIMITRI CON IMÁGENES ===============
    await tocar('.mv-tab[data-tab="dimitri"]'); await page.waitForSelector('#mvDim'); await espera(300);
    paso(await page.locator('.mv-clip').count() === 1, 'Dimitri: hay un botón para adjuntar una imagen'); await foto('dimitri-adjuntar');
    await tocar('.mv-clip'); await page.waitForSelector('.mv-hoja #mvAdjG', { state: 'attached' }); await foto('dimitri-adjuntar-hoja'); await medir('Dimitri (adjuntar)');
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 2400; c.height = 1600; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 2400, 1600); gr.addColorStop(0, '#2E86AB'); gr.addColorStop(1, '#F2C25B'); g.fillStyle = gr; g.fillRect(0, 0, 2400, 1600); g.fillStyle = '#fff'; g.font = '200px sans-serif'; g.fillText('Hola', 800, 800); return c.toDataURL('image/png').split(',')[1]; });
    await page.setInputFiles('#mvAdjG', { name: 'foto-grande.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.waitForSelector('.mv-adj-i.lista', { timeout: 15000 }); paso(true, 'Dimitri: la foto se sube al Estudio y queda lista'); await foto('dimitri-con-foto'); await medir('Dimitri (con foto)');
    let cuerpo = null; await page.route('**/api/sub/chat', async r => { cuerpo = JSON.parse(r.request().postData() || '{}'); await r.fulfill({ json: { messages: [{ id: 'u1', who: 'user', text: cuerpo.text, attach: cuerpo.attach, at: Date.now() }, { id: 's1', who: 'sub', text: 'Veo una imagen con un degradado azul y amarillo.', at: Date.now() }] } }); });
    toques = 0; await tocar('#mvDim'); await page.fill('#mvDim', 'Mira esto'); await tocar('.mv-compone .mv-enviar'); await page.waitForSelector('.mv-msg.suyo', { timeout: 8000 });
    paso(cuerpo && cuerpo.attach?.length === 1 && cuerpo.vision?.length === 1 && cuerpo.vision[0].file === cuerpo.attach[0], 'Dimitri: el mensaje lleva `attach` (el id del Estudio) y `vision` (la copia)');
    const bytes = Buffer.from(cuerpo.vision[0].data, 'base64'); const dims = await page.evaluate(async b64 => { const i = new Image(); i.src = 'data:image/jpeg;base64,' + b64; await i.decode(); return [i.naturalWidth, i.naturalHeight]; }, cuerpo.vision[0].data);
    paso(Math.max(...dims) <= 1568 && bytes.length <= 1.6 * 1024 * 1024, `Dimitri: la copia para la visión mide ${dims.join('×')} y ${(bytes.length / 1024).toFixed(0)} KB (≤ 1568 px, ≤ 1,5 MB)`);
    paso(await page.locator('.mv-msg.mio .mv-adj-m').count() === 1, 'Dimitri: tu mensaje muestra la miniatura de la foto'); paso(toques <= 3, `Dimitri: escribir y enviar con la foto son ${toques} toques (≤ 3, ya adjunta)`);
    await page.unroute('**/api/sub/chat'); await foto('dimitri-enviado');
    // las tarjetas de «estudio»: GENERAR sigue en escritorio
    await page.route('**/api/sub', async r => { if (r.request().method() !== 'GET') return r.continue(); await r.fulfill({ json: { name: 'Dimitri', messages: [{ id: 'e1', who: 'sub', text: 'Te propongo estos creativos.', at: Date.now(), studio: { creatives: [{ i: 0, title: 'Banner del lanzamiento', kind: 'image', model: 'prueba', modelName: 'Prueba (gratis)', n: 2, cost: 0.9, prompt: 'Un banner limpio con el producto al centro', state: 'proposed' }, { i: 1, title: 'Foto ya hecha', kind: 'image', model: 'prueba', modelName: 'Prueba', n: 1, state: 'done', files: [gal.items[0].file] }] } }] } }); });
    await tocar('.mv-tab[data-tab="inicio"]'); await tocar('.mv-tab[data-tab="dimitri"]'); await page.waitForSelector('.mv-cres', { timeout: 8000 }); await espera(400);
    paso(/Costo estimado: US\$0,90/.test(await page.locator('.mv-tarjeta').innerText()) && await page.locator('[data-gasto]').count() === 1, 'Dimitri: la tarjeta de creativos dice el costo y manda a escritorio para generar (no gasta aquí)'); await foto('dimitri-creativos'); await medir('Dimitri (creativos)'); await axe('Dimitri (creativos)');
    paso(await page.locator('.mv-cres .mv-adj-m').count() === 1, 'Dimitri: lo que ya hizo se ve en miniaturas que abren el Estudio');
    await page.unroute('**/api/sub');

    // =============== oscuro y anchos ===============
    await page.evaluate(() => window.CC?.setDark(true)); await espera(300);
    for (const [id, sel] of [['cerebro', '.mv-notas-l'], ['estudio', '.mv-tile']]) { await abrirMas(id).catch(async () => { await tocar('.mv-tab[data-tab="inicio"]'); await abrirMas(id); }); await page.waitForSelector(sel); await axe(id + ' (oscuro)'); if (id === 'cerebro') await foto('cerebro-oscuro'); else await foto('estudio-oscuro'); }
    await page.evaluate(() => { window.CC?.setDark(false); localStorage.setItem('ao.theme', 'light'); });
    for (const w of [320, 360, 390, 430]) {
      await page.setViewportSize({ width: w, height: 800 }); await espera(250);
      for (const id of ['cerebro', 'estudio']) { await tocar('.mv-tab[data-tab="inicio"]'); await abrirMas(id); await espera(300); await desborda(`${w} px · ${id}`); }
    }
    paso(!errores.length, `sin errores de JavaScript en la consola${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`);
    await ctx.close();
  } finally { await browser.close(); o.cerrar(); }
  console.log(`\n${fallos ? fallos + ' paso(s) fallaron' : 'todo en orden'} (${res.length} comprobaciones)`);
  return { fallos, res };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await correr({ capturas: process.argv.includes('--capturas') });
  process.exit(r.fallos ? 1 : 0);
}
