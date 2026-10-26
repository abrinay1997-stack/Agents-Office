// Recorrido de navegador de las CARPETAS del Estudio en el teléfono (26 oct 2026): crear, mover con «Seleccionar», mover desde el visor, renombrar,
// eliminar y DESHACER, en Chromium de teléfono con toque, contra una oficina temporal (la de scripts/movil-recorrido.mjs) y el motor gratis «Prueba».
// Falla si algo no se cumple: objetivos táctiles ≥ 44 px, campos ≥ 16 px, sin desbordes a 320/360/390/430, y que el servidor quede como se ve en pantalla.
//   node scripts/movil-carpetas-recorrido.mjs [--capturas]     → ✓/✗ por paso y, con --capturas, docs/capturas-movil/despues/carpetas-*.jpg
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
    for (const p of ['un gato sobre un sofá azul', 'taza de café en una mesa de madera', 'logo de una panadería', 'paisaje al atardecer', 'zapatos deportivos blancos']) await o.api('/api/media/jobs', 'POST', { prompt: p, n: 1, kind: 'image', model: 'prueba', settings: {}, media: {}, by: 'you', wait: 15000 });
    await espera(800);
    const total = async () => (await o.api('/api/media?n=0')).total;
    const carpetas = async () => (await o.api('/api/media?n=0')).folders || [];
    const n0 = await total(); paso(n0 >= 5, `semilla: ${n0} imágenes en el Estudio`);

    const errores = [];
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }), page = await ctx.newPage();
    page.on('pageerror', e => errores.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/i.test(m.text())) errores.push(m.text()); });
    if (process.env.DEPURAR) { page.on('console', m => console.log('consola:', m.type(), m.text())); await page.addInitScript(() => addEventListener('unhandledrejection', e => console.log('RECHAZO', e.reason && (e.reason.stack || e.reason.message || e.reason)))); }
    await page.goto(o.base); await page.waitForSelector('#mvRoot .mv-tabs'); await page.waitForSelector('[data-vista="inicio"] .mv-card', { timeout: 15000 }); await espera(400);
    let toques = 0; const tocar = async sel => { toques++; await page.locator(sel).first().tap(); await espera(300); };
    const foto = async n => { if (!capturas) return; fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, 'carpetas-' + n + '.jpg'), type: 'jpeg', quality: 50 }); };
    const medir = async nombre => {
      const r = await page.evaluate(() => {
        const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden],[inert]') && !e.closest('.mv-capa.saliendo'); };
        const malos = [], chicos = [], sinNombre = [];
        for (const e of document.getElementById('mvRoot').querySelectorAll('button, [role="button"], input:not([type="hidden"]):not(.mv-sr), select, textarea')) {
          if (!vis(e)) continue; const r = e.getBoundingClientRect();
          if (r.height < 43.5 || r.width < 43.5) malos.push(`${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]} ${Math.round(r.width)}×${Math.round(r.height)} «${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)}»`);
          if (/INPUT|TEXTAREA|SELECT/.test(e.tagName) && parseFloat(getComputedStyle(e).fontSize) < 16) chicos.push(e.id || e.className);
          if (!(e.getAttribute('aria-label') || e.textContent || '').trim() && !(e.id && document.querySelector(`label[for="${e.id}"]`)) && !e.getAttribute('placeholder')) sinNombre.push(e.className);
        }
        return { malos, chicos, sinNombre };
      });
      paso(!r.malos.length, `${nombre}: ningún objetivo táctil < 44 px${r.malos.length ? ' → ' + r.malos.slice(0, 5).join(' | ') : ''}`);
      paso(!r.chicos.length && !r.sinNombre.length, `${nombre}: campos de 16 px y todo con nombre`);
    };
    const desborda = async nombre => {
      const r = await page.evaluate(() => { const w = innerWidth; const sobran = [...document.querySelectorAll('#mvRoot *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > w + 1 || b.left < -1) && !e.closest('.mv-chips, .mv-capa:not(.entrando)'); }).map(e => e.className).slice(0, 4); return { ancho: document.documentElement.scrollWidth <= innerWidth + 1, sobran }; });
      paso(r.ancho && !r.sobran.length, `${nombre}: sin desplazamiento horizontal${r.sobran.length ? ' → ' + r.sobran.join(', ') : ''}`);
    };
    const toast = () => page.locator('.mv-toast').innerText().catch(() => '');
    const esperarToast = async re => { await page.waitForFunction(r => new RegExp(r, 'i').test(document.querySelector('.mv-toast')?.innerText || ''), re.source, { timeout: 6000 }).catch(() => {}); return toast(); };
    const abrirMas = async id => { await tocar('.mv-tab[data-tab="mas"]'); await page.waitForSelector('.mv-hoja.mv-mas'); await tocar(`.mv-hoja [data-vista="${id}"]`); await page.waitForSelector(`section[data-vista="${id}"]:not([hidden])`); await espera(300); };
    const chip = nombre => page.locator(`[data-vista="estudio"] [data-carp]`, { hasText: nombre });

    await abrirMas('estudio'); await page.waitForSelector('[data-vista="estudio"] .mv-tile', { timeout: 10000 });
    paso(await page.locator('[data-vista="estudio"] [data-carp-nueva]').isVisible(), 'Carpetas: «+ Carpeta» está a la vista aunque todavía no haya ninguna');
    paso(await page.locator('[data-vista="estudio"] [data-sel-modo]').isVisible(), 'Carpetas: «Seleccionar» está a la vista');
    await foto('galeria'); await medir('Galería con carpetas'); 

    // ---- crear una carpeta ----
    toques = 0; await tocar('[data-vista="estudio"] [data-carp-nueva]'); await page.waitForSelector('.mv-hoja #mvCN');
    await foto('nueva'); await medir('Hoja «Nueva carpeta»');
    await page.fill('#mvCN', '   '); await page.locator('.mv-hoja [data-acc="1"]').tap(); await espera(250);
    paso(/nombre/i.test(await page.locator('#mvCNe').innerText()), 'Carpetas: un nombre vacío se rechaza en palabras');
    await page.fill('#mvCN', 'Navidad'); await page.locator('.mv-hoja [data-acc="1"]').tap(); toques += 2; await page.waitForSelector('.mv-hoja', { state: 'detached', timeout: 5000 }); await espera(500);
    paso((await carpetas()).some(f => f.name === 'Navidad'), 'Carpetas: «Navidad» quedó creada en el servidor');
    paso(await chip('Navidad').count() === 1 && toques <= 3, `Carpetas: aparece su chip (${toques} toques)`);
    await tocar('[data-vista="estudio"] [data-carp-nueva]'); await page.waitForSelector('.mv-hoja #mvCN'); await page.fill('#mvCN', 'navidad'); await page.locator('.mv-hoja [data-acc="1"]').tap(); await espera(250);
    paso(/Ya hay una carpeta/i.test(await page.locator('#mvCNe').innerText()), 'Carpetas: un nombre repetido (aunque cambie la mayúscula) se rechaza'); await page.locator('.mv-hoja [data-acc="0"]').tap(); await page.waitForSelector('.mv-hoja', { state: 'detached' });

    // ---- seleccionar 2 y moverlas ----
    toques = 0; await tocar('[data-vista="estudio"] [data-sel-modo]');
    paso(await page.locator('[data-vista="estudio"] .mv-selbar').isVisible(), 'Carpetas: «Seleccionar» muestra la barra de acciones');
    await tocar('[data-vista="estudio"] .mv-tile >> nth=0'); await tocar('[data-vista="estudio"] .mv-tile >> nth=1');
    paso(/2 elegidas/.test(await page.locator('.mv-selbar').innerText()) && await page.locator('[data-vista="estudio"] .mv-tile.sel').count() === 2, 'Carpetas: tocar dos imágenes las elige (marca visible y contador «2 elegidas»)');
    paso(await page.locator('.mv-visor').count() === 0, 'Carpetas: en modo selección tocar una imagen NO abre el visor'); await foto('seleccion'); await medir('Selección');
    await tocar('[data-vista="estudio"] [data-sel-mover]'); await page.waitForSelector('.mv-hoja [data-c]'); await foto('mover'); await medir('Hoja «Mover a…»');
    const opciones = await page.locator('.mv-hoja [data-c]').allInnerTexts();
    paso(opciones.some(t => /Nueva carpeta/.test(t)) && opciones.some(t => /Sin carpeta/.test(t)) && opciones.some(t => /Navidad/.test(t)), `Carpetas: la hoja ofrece «Nueva carpeta…», «Sin carpeta» y «Navidad» (${opciones.length} opciones)`);
    await page.locator('.mv-hoja [data-c^="c:"]', { hasText: 'Navidad' }).tap(); toques++; await esperarToast(/movidos/); await espera(600);
    paso(/2 archivos movidos a «Navidad»/.test(await toast()), `Carpetas: avisa «${(await toast()).split('\n')[0]}» (${toques} toques para mover 2)`);
    paso((await o.api('/api/media?n=50&folder=' + (await carpetas()).find(f => f.name === 'Navidad').id)).items.length === 2, 'Carpetas: el servidor guarda las 2 imágenes dentro de «Navidad»');
    paso(await page.locator('[data-vista="estudio"] .mv-tile.sel').count() === 0 && !(await page.locator('[data-vista="estudio"] .mv-selbar').count()), 'Carpetas: al mover, termina el modo selección');
    paso(/Navidad\s*2/.test((await chip('Navidad').innerText()).replace(/\s+/g, ' ')), 'Carpetas: el chip de «Navidad» cuenta 2');

    // ---- DESHACER ----
    await page.locator('.mv-toast .mv-toast-b').first().tap(); await espera(900);
    paso((await o.api('/api/media?n=50&folder=' + (await carpetas()).find(f => f.name === 'Navidad').id)).items.length === 0, 'Carpetas: «Deshacer» devuelve las 2 a donde estaban');
    // volver a moverlas para seguir
    await tocar('[data-vista="estudio"] [data-sel-modo]'); await tocar('[data-vista="estudio"] .mv-tile >> nth=0'); await tocar('[data-vista="estudio"] .mv-tile >> nth=1'); await tocar('[data-vista="estudio"] [data-sel-mover]'); await page.waitForSelector('.mv-hoja [data-c]');
    await page.locator('.mv-hoja [data-c^="c:"]', { hasText: 'Navidad' }).tap(); await espera(900);

    // ---- ver la carpeta, renombrarla ----
    await tocar('[data-vista="estudio"] [data-carp]:has-text("Navidad")'); await espera(600);
    paso(await page.locator('[data-vista="estudio"] .mv-tile').count() === 2, 'Carpetas: abrir «Navidad» enseña solo sus 2 imágenes');
    paso(await page.locator('[data-vista="estudio"] [data-carp-ren]').isVisible() && await page.locator('[data-vista="estudio"] [data-carp-del]').isVisible(), 'Carpetas: la carpeta abierta trae «Renombrar» y «Eliminar»'); await foto('carpeta-abierta'); await medir('Carpeta abierta');
    await tocar('[data-vista="estudio"] [data-carp-ren]'); await page.waitForSelector('.mv-hoja #mvCN');
    paso((await page.locator('#mvCN').inputValue()) === 'Navidad', 'Carpetas: renombrar trae el nombre de ahora');
    await page.fill('#mvCN', 'Fiestas'); await page.locator('.mv-hoja [data-acc="1"]').tap(); await page.waitForSelector('.mv-hoja', { state: 'detached' }); await espera(700);
    paso((await carpetas()).some(f => f.name === 'Fiestas') && !(await carpetas()).some(f => f.name === 'Navidad'), 'Carpetas: renombrar cambia el nombre en el servidor');
    paso(await chip('Fiestas').count() === 1, 'Carpetas: el chip dice «Fiestas»');

    // ---- mover desde el visor ----
    await tocar('[data-vista="estudio"] .mv-tile >> nth=0'); await page.waitForSelector('.mv-hoja.mv-visor .mv-stage'); await espera(400);
    paso(/en «Fiestas»/.test(await page.locator('.mv-visor .mv-vis-pie').innerText()), 'Carpetas: el visor dice en qué carpeta está la imagen');
    await tocar('.mv-visor [data-acc]'); await page.waitForSelector('[data-a="carpeta"]'); await foto('visor-acciones'); await medir('Acciones del visor');
    paso(/Fiestas/.test(await page.locator('[data-a="carpeta"]').innerText()), 'Carpetas: «Mover a una carpeta…» dice dónde está ahora');
    await tocar('[data-a="carpeta"]'); if (process.env.DEPURAR) { await espera(1500); console.log('errores:', errores); console.log(await page.evaluate(() => [...document.querySelectorAll('.mv-capa')].map(c => `${c.className} | ${c.querySelector('h2')?.textContent} | ${(c.querySelector('.mv-hoja-cuerpo')?.innerHTML || '').slice(0, 160)}`))); } await page.waitForSelector('.mv-hoja [data-c]'); await page.locator('.mv-hoja [data-c=""]').tap(); await esperarToast(/sacado/);
    paso(/sacado de su carpeta/.test(await toast()), 'Carpetas: desde el visor se saca de la carpeta');
    await page.goBack(); await page.waitForSelector('.mv-hoja.mv-visor', { state: 'detached', timeout: 4000 }).catch(() => {}); await espera(900);
    paso(await page.locator('[data-vista="estudio"] .mv-tile').count() === 1, 'Carpetas: al cerrar el visor la galería de «Fiestas» queda con 1');
    paso((await carpetas()).find(f => f.name === 'Fiestas').n === 1, 'Carpetas: el servidor cuenta 1 en «Fiestas»');

    // ---- crear una carpeta ya con imágenes elegidas ----
    await tocar('[data-vista="estudio"] [data-carp="all"]'); await espera(500);
    await tocar('[data-vista="estudio"] [data-sel-modo]'); await tocar('[data-vista="estudio"] .mv-tile >> nth=2'); await tocar('[data-vista="estudio"] [data-carp-nueva]'); await page.waitForSelector('.mv-hoja #mvCN');
    paso(/Crear y mover/.test(await page.locator('.mv-hoja [data-acc="1"]').innerText()), 'Carpetas: con imágenes elegidas, «+ Carpeta» ofrece «Crear y mover»');
    await page.fill('#mvCN', 'Producto'); await page.locator('.mv-hoja [data-acc="1"]').tap(); await page.waitForSelector('.mv-hoja', { state: 'detached' }); await espera(900);
    paso((await carpetas()).find(f => f.name === 'Producto')?.n === 1, 'Carpetas: «Producto» nace con la imagen elegida dentro');

    // ---- eliminar ----
    const antesTotal = await total();
    await tocar('[data-vista="estudio"] [data-carp]:has-text("Fiestas")'); await espera(500); await tocar('[data-vista="estudio"] [data-carp-del]'); await page.waitForSelector('.mv-capa .mv-hoja'); await espera(300); await foto('eliminar');
    paso(/no se borra ninguna imagen/i.test(await page.locator('.mv-capa .mv-hoja').last().innerText()), 'Carpetas: eliminar avisa que NO se borra ninguna imagen');
    await page.locator('.mv-capa .mv-hoja button', { hasText: /Eliminar la carpeta/ }).first().tap(); await espera(1000);
    paso(!(await carpetas()).some(f => f.name === 'Fiestas') && (await total()) === antesTotal, 'Carpetas: eliminar quita la carpeta y NO borra imágenes');
    paso(await chip('Fiestas').count() === 0, 'Carpetas: su chip desaparece');
    await page.locator(".mv-toast .mv-toast-b").first().tap(); await espera(1000);
    paso((await carpetas()).some(f => f.name === 'Fiestas' && f.n === 1), 'Carpetas: «Deshacer» la vuelve a crear con su imagen');

    // ---- crear dentro de una carpeta: se guarda ahí ----
    await tocar('[data-vista="estudio"] [data-carp]:has-text("Producto")'); await espera(500); await tocar('[data-tab="crear"]'); await espera(500);
    paso(/carpeta «Producto»/.test(await page.locator('[data-gen]').innerText()), 'Carpetas: la pestaña Crear dice en qué carpeta se guardará lo nuevo'); await foto('crear-en-carpeta');

    // ---- anchos y consola ----
    await tocar('[data-tab="galeria"]'); await tocar('[data-vista="estudio"] [data-carp="all"]'); await espera(400);
    for (const w of [320, 360, 390, 430]) { await page.setViewportSize({ width: w, height: 800 }); await espera(250); await desborda(`${w} px · galería con carpetas`); }
    await page.setViewportSize({ width: 390, height: 844 }); await espera(200);
    await tocar('[data-vista="estudio"] [data-sel-modo]'); await tocar('[data-vista="estudio"] .mv-tile >> nth=0');
    for (const w of [320, 360, 390, 430]) { await page.setViewportSize({ width: w, height: 800 }); await espera(250); await desborda(`${w} px · selección`); }
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
