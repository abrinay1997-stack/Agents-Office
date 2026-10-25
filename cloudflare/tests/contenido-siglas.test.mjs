// Donde se muestra una red social se ve su LOGO, no dos siglas («IG», «FB»…). Barre, en un navegador real, el editor de una pieza con las NUEVE redes puestas
// (fichas «Redes y formato», «Publicar en», pestañas de la vista previa, «Editar por red», contadores), la Bandeja y Analíticas, y falla si algún elemento visible
// tiene por texto una sigla de red; y comprueba que cada logo tiene su nombre para el lector de pantalla cuando es la única información.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { chromium, hayDist, abrir } from './csp-ayudas.mjs';
import { montarMundo } from './csp-recorrido.mjs';
import { SALTAR as SIN_D1 } from './d1-memoria.mjs';

const RAIZ = new URL('../../', import.meta.url);
const NUEVE = ['instagram', 'facebook', 'linkedin', 'x', 'threads', 'bluesky', 'tiktok', 'pinterest', 'youtube'];
const SIGLAS = /^(IG|FB|IN|TT|YT|TH|BS|PI|LI|TW)$/;

test('el código ya no define siglas de red para mostrar (RED sin `short`, vistas sin `red_`, Analíticas sin `corto`)', () => {
  const leer = (f) => readFileSync(new URL(f, RAIZ), 'utf8');
  assert.ok(!/short:/.test(leer('src/pieza-base.js').split('\n').find((l) => l.startsWith('export const RED =')) || ''), 'RED no lleva siglas');
  assert.ok(!/red_:/.test(leer('src/contenido-preview.js')), 'las vistas previas no llevan siglas');
  assert.ok(!/corto: '(IG|FB)'/.test(leer('src/analiticas.js')));
  for (const f of ['src/pieza.js', 'src/contenido-bandeja.js', 'src/contenido-herramientas.js', 'src/contenido-preview.js', 'src/analiticas.js']) assert.ok(!/RED\[[^\]]+\]\??\.short|\bred\.short|RED\[[^\]]+\]\??\.corto/.test(leer(f)), `${f}: sin .short ni .corto`);
});

const SALTAR = SIN_D1 || process.env.AO_SIN_NAVEGADOR === '1' || (!chromium() ? 'Playwright no está instalado' : !hayDist() ? 'falta dist/ (node build.mjs)' : false);
let nav, mundo;
before(async () => { if (SALTAR) return; nav = await chromium().launch(); mundo = await montarMundo(); }, { timeout: 120000 });
after(async () => { await nav?.close(); });

/** Los elementos visibles cuyo texto propio es una sigla de red. */
const siglasVisibles = (p) => p.evaluate((re) => { const R = new RegExp(re); return [...document.querySelectorAll('body *')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && [...e.childNodes].some((n) => n.nodeType === 3 && R.test(n.textContent.trim()))).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)}: ${e.textContent.trim().slice(0, 20)}`); }, SIGLAS.source);

test('el editor con las nueve redes, sus vistas previas, la Bandeja y Analíticas: ningún elemento visible dice «IG», «FB»…', { skip: SALTAR, timeout: 300000 }, async () => {
  const s = await abrir(nav, { env: mundo.env, cookie: mundo.ck.admin }); s.p.setDefaultTimeout(12000);
  await s.p.goto('https://oficina.test/', { waitUntil: 'domcontentloaded', timeout: 30000 }); await s.p.waitForSelector('#topdock', { state: 'attached', timeout: 30000 }); await s.p.waitForTimeout(1500);
  const hallados = [];
  await s.p.keyboard.press('k'); await s.p.getByRole('button', { name: /crear/i }).first().click(); await s.p.getByText('Post', { exact: true }).first().click(); await s.p.waitForTimeout(1500);
  await s.p.locator('[data-a="mas-redes"]').click().catch(() => {}); await s.p.waitForTimeout(400);
  for (const r of NUEVE) { const b = s.p.locator(`.pz-net[data-red="${r}"]`); if (await b.count() && (await b.getAttribute('aria-pressed')) === 'false') await b.click(); }
  await s.p.waitForTimeout(600);
  assert.equal(await s.p.locator('.pz-nets .pz-nb svg.ao-red').count() >= 9, true, 'las nueve fichas llevan su logo (svg)');
  hallados.push(...await siglasVisibles(s.p));
  // la vista previa: una pestaña por red (y por formato); cada una con su nombre accesible
  const pestanas = await s.p.locator('.pv-tabs [role=tab]').all(); assert.ok(pestanas.length >= 3);
  for (const t of pestanas) { const nombre = await t.getAttribute('aria-label'); assert.match(nombre, /^(Instagram|Facebook|LinkedIn|X|Threads|Bluesky|TikTok|Pinterest|YouTube) · /); assert.ok(await t.locator('svg.ao-red').count(), 'el logo, no siglas'); }
  for (const r of NUEVE) { const t = s.p.locator('.pv-tabs [role=tab]').filter({ has: s.p.locator(`.pv-net.${r}`) }).first(); if (await t.count()) { await t.click().catch(() => {}); hallados.push(...await siglasVisibles(s.p)); } }
  await s.p.locator('[data-a="por-red"], .pz-tog').first().click().catch(() => {}); await s.p.waitForTimeout(500);
  hallados.push(...await siglasVisibles(s.p));
  // axe (si AO_AXE apunta a axe.min.js): nombres accesibles y contraste de los logos y de lo que los rodea, en el editor con las nueve redes
  if (process.env.AO_AXE && existsSync(process.env.AO_AXE)) {
    await s.p.addScriptTag({ content: readFileSync(process.env.AO_AXE, 'utf8') });
    const sel = ['.pz-nets', '.pz-ct1', '.pv-tabs', '.pz-ttabs', '.pz-cc'];
    const r = await s.p.evaluate(async (sel) => { const incl = sel.filter((x) => document.querySelector(x)); const x = await window.axe.run({ include: incl.map((i) => [i]) }, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] }); return { revisados: incl, violaciones: x.violations.map((v) => ({ id: v.id, n: v.nodes.length, ej: v.nodes.slice(0, 2).map((n) => n.html.slice(0, 120)) })) }; }, sel);
    console.log('axe (editor, 9 redes):', JSON.stringify(r));
    assert.deepEqual(r.violaciones, [], 'axe: ' + JSON.stringify(r.violaciones));
  }
  // los contadores por red llevan el nombre (es lo único que dice de qué red es el número)
  const cc = await s.p.locator('.pz-cc[data-cc]:not([data-cc=hashtags])').all(); for (const c of cc) assert.ok(await c.locator('svg[role=img][aria-label]').count(), 'el contador lleva el nombre de la red para el lector de pantalla: ' + (await c.evaluate((e) => e.outerHTML)).slice(0, 300));
  // la Bandeja y Analíticas
  await s.p.goto('https://oficina.test/', { waitUntil: 'domcontentloaded' }); await s.p.waitForSelector('#topdock', { state: 'attached', timeout: 30000 }); await s.p.waitForTimeout(1200);
  await s.p.keyboard.press('k'); await s.p.getByRole('button', { name: /bandeja/i }).first().click(); await s.p.waitForTimeout(1200); hallados.push(...await siglasVisibles(s.p));
  await s.p.goto('https://oficina.test/', { waitUntil: 'domcontentloaded' }); await s.p.waitForSelector('#topdock', { state: 'attached', timeout: 30000 }); await s.p.waitForTimeout(1200);
  await s.p.keyboard.press('r'); await s.p.waitForSelector('.an-ava', { timeout: 8000 }); await s.p.waitForTimeout(500); hallados.push(...await siglasVisibles(s.p));
  assert.ok(await s.p.locator('.an-net svg.ao-red').count() >= 4, 'Analíticas: el logo en los grupos y la tabla');
  if (process.env.AO_AXE && existsSync(process.env.AO_AXE)) {
    await s.p.addScriptTag({ content: readFileSync(process.env.AO_AXE, 'utf8') });
    const r = await s.p.evaluate(async () => { const x = await window.axe.run({ include: [['#anOv']] }, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] }); return x.violations.map((v) => ({ id: v.id, n: v.nodes.length, ej: v.nodes.slice(0, 2).map((n) => n.html.slice(0, 120)) })); });
    console.log('axe (Analíticas):', JSON.stringify(r));
    assert.deepEqual(r, [], 'axe Analíticas: ' + JSON.stringify(r));
  }
  assert.deepEqual([...new Set(hallados)], [], 'siglas de red a la vista');
  await s.cerrar();
});
