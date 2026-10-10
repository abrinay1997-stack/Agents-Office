// Herramienta de desarrollo (no entra en `npm run check`): ANALÍTICAS POR CUENTA en el navegador (9 oct 2026, pedido del dueño: «filtrar
// bien dentro de todas las cuentas y poder verlas individualmente»). En la demo (file://, cuatro cuentas de ejemplo rotuladas), a 1512 en
// claro y oscuro, a 1024 con Dimitri al lado y a 390: elegir una cuenta → «Viendo …» y cifras distintas; la tabla «Comparar cuentas»
// (ordenar, un clic en una fila la elige; en el teléfono, tarjetas); elegir una red deja solo sus cuentas; volver a «Todas»; el foco se
// queda en lo que se pulsó; objetivos de 24 px, letra ≥ 10,5 px y nada que se salga a lo ancho.
//   node scripts/analiticas-cuentas-recorrido.mjs   → capturas en data/capturas/analiticas-cuentas/ y ✓/✗ por paso
//   AO_AXE=<ruta a axe.min.js> además pasa axe
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'analiticas-cuentas'); fs.mkdirSync(OUT, { recursive: true });
const PAGINA = 'file://' + path.join(ROOT, 'dist', 'command-centre-v2.html').replace(/\\/g, '/');
let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };

const medir = page => page.evaluate(() => {
  const ov = document.getElementById('anOv');
  const vis = b => b.offsetParent && b.getClientRects().length;
  const peq = [...ov.querySelectorAll('button, select, summary')].filter(vis).map(b => [b, b.getBoundingClientRect()]).filter(([, r]) => r.height < 23.5 || r.width < 23.5).map(([b, r]) => `${b.className || b.tagName}:${Math.round(r.width)}x${Math.round(r.height)}`);
  const hs = document.documentElement.scrollWidth > innerWidth + 1 || ov.querySelector('.an-body').scrollWidth > ov.querySelector('.an-body').clientWidth + 1;
  const letra = [...ov.querySelectorAll('*')].filter(n => n.offsetParent && [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())).filter(n => parseFloat(getComputedStyle(n).fontSize) < 10.5).map(n => n.className || n.tagName);
  return { peq: peq.slice(0, 5), npeq: peq.length, hs, letra: letra.slice(0, 5), nletra: letra.length };
});
const ok24 = (m, tag, que) => step(!m.npeq && !m.hs && !m.nletra, `${tag}: ${que} — objetivos de 24 px, sin desplazamiento a lo ancho, letra ≥ 10,5${m.npeq ? ' · pequeños: ' + m.peq.join(' ') : ''}${m.hs ? ' · se sale' : ''}${m.nletra ? ' · letra: ' + m.letra.join(' ') : ''}`);
const txt = (page, s) => page.textContent(s).then(t => (t || '').replace(/\s+/g, ' ').trim());
const seguidores = page => txt(page, '#anOv .an-kpi:first-child .an-kv');
const foco = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 3000 }).then(() => true).catch(() => false);

let browser;
try {
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  const axe = process.env.AO_AXE && fs.existsSync(process.env.AO_AXE) ? fs.readFileSync(process.env.AO_AXE, 'utf8') : null;
  if (process.env.AO_AXE && !axe) console.log(`· AO_AXE=${process.env.AO_AXE} no existe: sin axe`);
  for (const [w, h, tema] of [[1512, 900, 'light'], [1512, 900, 'dark'], [1024, 768, 'light'], [390, 844, 'light']]) {
    const tag = `${w}-${tema}`, movil = w < 500, errs = [];
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: movil, isMobile: movil, colorScheme: tema });
    let page = null;
    try {
      page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
      await page.addInitScript(() => { try { for (const k of ['ao.an.cuenta', 'ao.an.red', 'ao.an.dias']) localStorage.removeItem(k); } catch {} });
      await page.goto(PAGINA + '?s=check', { timeout: 90000 }); await page.waitForTimeout(2500);
      if (tema === 'dark') await page.evaluate(() => document.body.classList.add('dark'));
      if (w === 1024) { await page.click('#topDimitri'); await page.waitForTimeout(800); }
      if (movil) { await page.click('#topMore'); await page.click('#topMoreMenu [data-for="topAnaliticas"]'); } else await page.click('#topAnaliticas');
      await page.waitForSelector('#anOv .an-kpis', { timeout: 15000 }); await page.waitForTimeout(300);
      if (w === 1024) { const l = await page.evaluate(() => document.getElementById('anOv').getBoundingClientRect().left); step(l > 300, `${tag}: con Dimitri abierto, Analíticas se corre (empieza en ${Math.round(l)} px)`); }
      const pasaAxe = async que => { if (!axe) return; if (!await page.evaluate(() => !!window.axe)) await page.addScriptTag({ content: axe }); const r = await page.evaluate(async () => (await window.axe.run('#anOv', { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(v => `${v.id}(${v.nodes.length}) ${v.nodes[0]?.target?.join(' ') || ''}`)); step(!r.length, `${tag}: axe en ${que}${r.length ? ': ' + r.join(' ') : ''}`); };

      // 1 · todas
      const vTodas = await txt(page, '#anOv .an-viendo'), sTodas = await seguidores(page);
      step(/Viendo todas las cuentas · suma 4 cuentas/.test(vTodas), `${tag}: arriba dice qué se ve («${vTodas}»)`);
      const estrecha = await page.isVisible('#anOv .an-csel'); // la vista estrecha (teléfono, o 1024 con Dimitri): desplegable y tarjetas
      step(estrecha ? await page.isVisible('#anOv .an-csel') && !await page.isVisible('#anOv .an-ctas') : (await page.$$eval('#anOv .an-ctas .an-cta', l => l.length)) === 5 && !await page.isVisible('#anOv .an-csel'), `${tag}: el selector de cuenta ${estrecha ? 'es un desplegable (vista estrecha)' : 'muestra «Todas» y las cuatro cuentas con su inicial, agrupadas por red'}`);
      const filas = await page.$$eval('#anOv .an-comp tbody tr', l => l.length);
      step(filas === 4, `${tag}: «Comparar cuentas» tiene una fila por cuenta (${filas})`);
      ok24(await medir(page), tag, 'todas las cuentas');
      await page.screenshot({ path: path.join(OUT, `${tag}-todas.png`), fullPage: false });
      await pasaAxe('todas las cuentas');

      // 2 · elegir una cuenta
      if (estrecha) { await page.selectOption('#anOv .an-csel', 'instagram:ejemplo-ig2'); await foco(page, () => document.activeElement?.matches?.('#anOv .an-csel')); }
      else { await page.click('#anOv .an-ctas [data-cta="instagram:ejemplo-ig2"]'); step(await foco(page, () => document.activeElement?.dataset?.cta === 'instagram:ejemplo-ig2'), `${tag}: el foco se queda en la cuenta pulsada`); }
      await page.waitForTimeout(200);
      const vUna = await txt(page, '#anOv .an-viendo'), sUna = await seguidores(page);
      step(/Viendo @segunda_marca · Instagram/.test(vUna), `${tag}: elegir una cuenta lo dice arriba («${vUna}»)`);
      step(sUna !== sTodas, `${tag}: las cifras son solo de esa cuenta (seguidores ${sTodas} → ${sUna})`);
      step(await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('ao.an.cuenta')); } catch { return null; } }) === 'instagram:ejemplo-ig2', `${tag}: la cuenta se recuerda (ao.an.cuenta)`);
      step(await page.$eval('#anOv .an-comp tr.on .an-crow', b => b.dataset.cta === 'instagram:ejemplo-ig2' && b.getAttribute('aria-pressed') === 'true'), `${tag}: en «Comparar», su fila va marcada`);
      ok24(await medir(page), tag, 'una cuenta');
      await page.screenshot({ path: path.join(OUT, `${tag}-una.png`) });
      await pasaAxe('una cuenta');

      // 3 · Comparar: ordenar y elegir desde la tabla
      await page.locator('#anOv .an-comp').scrollIntoViewIfNeeded();
      if (!estrecha) {
        await page.click('#anOv [data-ord="seguidores"]');
        step(await foco(page, () => document.activeElement?.dataset?.ord === 'seguidores'), `${tag}: el foco se queda en el título que ordena`);
        const desc = await page.$$eval('#anOv .an-comp tbody tr td:nth-of-type(1)', l => l.map(t => t.textContent));
        const sort = await page.$eval('#anOv [data-ord="seguidores"]', b => b.closest('th').getAttribute('aria-sort'));
        await page.click('#anOv [data-ord="seguidores"]');
        const asc = await page.$$eval('#anOv .an-comp tbody tr td:nth-of-type(1)', l => l.map(t => t.textContent));
        step(sort === 'descending' && JSON.stringify(asc) === JSON.stringify(desc.slice().reverse()), `${tag}: «Seguidores» ordena de más a menos y, otra vez, al revés (aria-sort)`);
      }
      await page.click('#anOv .an-crow[data-cta="facebook:ejemplo-fb"]');
      step(await foco(page, () => document.activeElement?.matches?.('.an-crow[data-cta="facebook:ejemplo-fb"]')), `${tag}: un clic en una fila la elige y el foco se queda en ella`);
      step(/Viendo Tu marca \(página\) · Facebook/.test(await txt(page, '#anOv .an-viendo')), `${tag}: … y arriba dice la nueva («${await txt(page, '#anOv .an-viendo')}»)`);
      if (estrecha) step(await page.$eval('#anOv .an-comp thead', t => getComputedStyle(t).display === 'none') && await page.$eval('#anOv .an-comp tbody tr', t => getComputedStyle(t).display === 'grid'), `${tag}: en la vista estrecha la tabla se lee como tarjetas`);
      ok24(await medir(page), tag, 'Comparar cuentas');
      await page.screenshot({ path: path.join(OUT, `${tag}-comparar.png`) });
      await pasaAxe('Comparar cuentas');

      // 4 · elegir una red deja sus cuentas (y suelta la de otra red)
      await page.click('#anOv .an-redes [data-r="instagram"]'); await page.waitForTimeout(200);
      const vRed = await txt(page, '#anOv .an-viendo');
      step(/Viendo Instagram · suma 2 cuentas/.test(vRed) && (await page.$$eval('#anOv .an-comp tbody tr', l => l.length)) === 2 && (estrecha ? (await page.$$eval('#anOv .an-csel option', l => l.length)) === 3 : (await page.$$eval('#anOv .an-ctas .an-cta', l => l.length)) === 3), `${tag}: INSTAGRAM deja solo sus cuentas y suelta la de Facebook («${vRed}»)`);
      await page.screenshot({ path: path.join(OUT, `${tag}-red.png`) });
      await pasaAxe('una red');

      // 5 · volver a todas
      await page.click('#anOv .an-redes [data-r="todas"]');
      if (estrecha) await page.selectOption('#anOv .an-csel', ''); else await page.click('#anOv .an-ctas [data-cta=""]');
      await page.waitForTimeout(200);
      step(/Viendo todas las cuentas · suma 4 cuentas/.test(await txt(page, '#anOv .an-viendo')) && await seguidores(page) === sTodas, `${tag}: «Todas las cuentas» vuelve a la suma (${sTodas})`);
      // el informe del mes lleva el selector de cuenta (en la demo no hay informe: se dice)
      await page.click('#anInforme'); await page.waitForSelector('#anOv .an-inf', { timeout: 5000 }); await page.waitForTimeout(500); /* el botón cambia de color con una transición */
      step(await page.$$eval('#anOv .an-inf-cta option', l => l.length) === 5, `${tag}: el informe del mes deja elegir la cuenta`);
      await pasaAxe('el informe del mes');
      await page.click('#anOv [data-a="inf-volver"]');
      step(!errs.length, `${tag}: sin errores de la página${errs.length ? ': ' + errs[0] : ''}`);
    } catch (e) {
      fails++; console.log(`✗ ${tag}: ${e.message.split('\n')[0]}${errs.length ? ' · página: ' + errs[0] : ''}`);
      await page?.screenshot({ path: path.join(OUT, `${tag}-fallo.png`) }).catch(() => {});
    } finally { await ctx.close(); }
  }
} catch (e) { fails++; console.log('✗ ' + e.message); }
finally { await browser?.close(); }
console.log(fails ? `\n✗ ${fails} paso(s) fallaron · capturas en ${path.relative(ROOT, OUT)}` : `\n✓ todo bien · capturas en ${path.relative(ROOT, OUT)}`);
process.exit(fails ? 1 : 0);
