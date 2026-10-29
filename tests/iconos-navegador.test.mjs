// Fase 5 (ICO-10, ICO-11): en un navegador de verdad, la pestaña de la vista previa mide 44 px en táctil y Pinterest sube a su relleno claro sobre el fondo oscuro.
// Se salta solo si Chromium no arranca (como el resto de las pruebas de navegador).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { iconoRed } from '../src/redes-iconos.js';

let chromium = null; try { chromium = (await import('playwright-core')).chromium; } catch { /* sin playwright */ }
let nav = null, motivo = chromium ? false : 'Playwright no está instalado';
if (chromium && process.env.AO_SIN_NAVEGADOR !== '1') { try { nav = await chromium.launch(); } catch (e) { motivo = 'Chromium no arranca: ' + String(e.message).split('\n')[0]; } } else if (chromium) motivo = 'AO_SIN_NAVEGADOR=1';
const css = (f) => fs.readFileSync(new URL('../src/css/' + f, import.meta.url), 'utf8');

test('pestañas de la vista previa: 44 px en táctil/estrecho, 30 en escritorio; Pinterest sube a su relleno claro en oscuro', { skip: motivo }, async () => {
  const html = `<style>${css('contenido-preview.css')}${css('iconos.css')}</style><body class="${'${cl}'}"><div class="pv-tabs"><button role="tab">Instagram</button></div>${iconoRed('pinterest', { tam: 16 })}</body>`;
  for (const [ancho, esperado] of [[390, 44], [1280, 30]]) {
    const p = await nav.newPage({ viewport: { width: ancho, height: 700 } }); await p.setContent(html.replace('${cl}', ''));
    const h = Math.round((await p.locator('.pv-tabs [role=tab]').boundingBox()).height); assert.ok(ancho < 820 ? h >= esperado : h >= esperado && h < 44, `${ancho}px: ${h}`);
    await p.close();
  }
  const p = await nav.newPage(); await p.setContent(html.replace('${cl}', 'dark'));
  assert.equal(await p.locator('svg.ao-red').evaluate(e => getComputedStyle(e).fill), 'rgb(229, 56, 74)');
  await p.setContent(html.replace('${cl}', '')); assert.equal(await p.locator('svg.ao-red').evaluate(e => getComputedStyle(e).fill), 'rgb(189, 8, 28)');
  await p.close();
});
test.after(async () => { if (nav) await nav.close(); });
