// Fase 5 (ICO-01/03/04/06/07): el registro único de íconos. Cobertura (cada red, cada conector conocido, cada plantilla de la nube tiene su ícono),
// forma del modelo, contraste de las placas propias, que la página ya no lleve teselas WebP y que el monograma sea el único respaldo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { REDES } from '../contenido/piezas-core.mjs';
import { ICONOS, iconoCapas, iconoTesela, monograma, uriDeSvg, resolverId, colorDeNombre, iniciales } from '../src/iconos-registro.mjs';
import { MCP_LOGOS, MCP_BY_DEPT } from '../src/mcplogos.js';
import { ALIASES } from '../mcp.mjs';
import { PLANTILLAS } from '../cloudflare/worker/lib/iconos-conectores.js';
import { tile } from '../src/connectors.js';

test('modelo: cada entrada tiene nombre, capas con trazado, origen y fuente; lo propio lleva placa', () => {
  for (const [id, e] of Object.entries(ICONOS)) {
    assert.ok(e.nombre, id); assert.ok(Array.isArray(e.capas) && e.capas.length, id + ': sin capas');
    for (const c of e.capas) assert.ok(typeof c.d === 'string' && c.d.length > 10, id + ': capa sin trazado');
    assert.ok(['simple-icons', 'propio'].includes(e.origen), id + ': origen'); assert.ok(e.fuente, id + ': sin fuente documentada');
    if (e.origen === 'propio') { assert.match(e.placa, /^#[0-9A-F]{6}$/i, id); assert.ok(e.capas.every(c => c.trazo), id + ': un propio es de trazo'); }
    else for (const c of e.capas) assert.match(c.fill, /^(#[0-9A-Fa-f]{3,8})?$/, id + ': fill');
  }
});

test('cobertura: cada red, cada conector del mapa del escritorio, cada marca conocida de mcp.mjs y cada plantilla de la nube tiene ícono', () => {
  const sin = (lista) => lista.filter(k => !ICONOS[k] || !ICONOS[k].capas[0].d);
  assert.deepEqual(sin(REDES), [], 'redes sin ícono');
  assert.deepEqual(sin(Object.keys(MCP_LOGOS)), [], 'teselas del escritorio sin ícono');
  assert.deepEqual(sin([...new Set(Object.values(MCP_BY_DEPT).flat())]), [], 'conectores de MCP_BY_DEPT sin ícono');
  assert.deepEqual(sin(Object.keys(ALIASES)), [], 'marcas conocidas de mcp.mjs sin ícono (cada clave de ALIASES debe estar en el registro)');
  assert.deepEqual(sin(PLANTILLAS.map(p => p.icono)), [], 'plantillas de la nube sin ícono');
  assert.ok(ICONOS.telegram && ICONOS.whatsapp, 'ICO-07: Telegram y WhatsApp entran');
  for (const [k, l] of Object.entries(MCP_LOGOS)) assert.equal(l.name, ICONOS[k].nombre, k);
});

test('la página ya no lleva teselas WebP (ICO-04) y cada tesela es un SVG autónomo sin hosts externos', () => {
  assert.doesNotMatch(fs.readFileSync(new URL('../src/mcplogos.js', import.meta.url), 'utf8'), /data:image\/webp/);
  for (const id of Object.keys(ICONOS)) {
    const svg = iconoTesela(id);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="160" height="160" viewBox="0 0 40 40">/, id);
    assert.equal((svg.match(/https?:\/\//g) || []).length, 1, id + ': solo el xmlns'); assert.doesNotMatch(svg, /<image|href=|<script|onload|<foreignObject/i, id);
    assert.match(uriDeSvg(svg), /^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/);
  }
  for (const l of Object.values(MCP_LOGOS)) assert.match(l.img, /^data:image\/svg\+xml;base64,/);
});

test('los pictogramas propios pasan 4,5:1 con el trazo blanco; los logos negros usan currentColor en línea y tinta oscura en la tesela', () => {
  const lum = (hex) => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  for (const [id, e] of Object.entries(ICONOS)) if (e.placa) assert.ok(1.05 / (lum(e.placa) + .05) >= 4.5, id + ' placa ' + e.placa + ' no llega a 4,5:1');
  for (const id of ['x', 'threads', 'tiktok', 'notion', 'github']) { assert.match(iconoCapas(id), /fill="currentColor"/, id); assert.match(iconoTesela(id), /fill="#111"/, id); }
  assert.match(iconoTesela('instagram'), /<radialGradient id="aoig"/); assert.match(iconoCapas('youtube'), /#FF0000[\s\S]*#fff/, 'YouTube: dos capas, multicolor');
});

test('el monograma es el único respaldo: estable, distinto por nombre, sin HTML, y un servicio conocido nunca cae en él (ICO-06)', () => {
  assert.equal(monograma('Mi CRM'), monograma('Mi CRM')); assert.notEqual(colorDeNombre('Mi CRM'), colorDeNombre('Otro'));
  assert.match(monograma('Mi CRM'), />MC</); assert.equal(iniciales('plugin:small-business:gmail'), 'GM');
  assert.doesNotMatch(monograma('<b>x</b>'), /<b>/);
  assert.equal(resolverId('plugin:small-business:Gmail'), 'gmail'); assert.equal(resolverId('claude.ai Google Drive'), 'googledrive'); assert.equal(resolverId('Meta Ads'), 'meta'); assert.equal(resolverId('inventado-xyz'), null);
  assert.equal(tile('Zapier MCP', 'zapier'), uriDeSvg(iconoTesela('zapier')), 'un servicio del registro enseña su logo, no un monograma');
  assert.equal(tile('Mi CRM'), uriDeSvg(monograma('Mi CRM')));
});

// ---- Fase 5, segunda entrega (ICO-05, 08, 09, 10, 11) ----
import { iconoRed } from '../src/redes-iconos.js';
const leer = (r) => fs.readFileSync(new URL('../' + r, import.meta.url), 'utf8');
const lum = (hex) => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

test('ICO-09: un logo de red nunca se dibuja bajo 16 px y lleva su id para el CSS', () => {
  for (const r of REDES) { assert.match(iconoRed(r, { tam: 10 }), /width="16" height="16"/, r); assert.match(iconoRed(r), new RegExp(`data-r="${r}"`)); }
  assert.match(iconoRed('instagram', { tam: 22 }), /width="22"/);
  assert.doesNotMatch(leer('src/css/contenido.css') + leer('src/css/editor-contenido.css'), /\.pz-nb\s*\{\s*width:\s*1[0-5]px/, 'ninguna regla encoge el logo de una red bajo 16 px');
});

test('ICO-11: cada logo de red llega a 3:1 sobre el fondo oscuro (con su `oscuro` si lo necesita) y el CSS lo aplica', () => {
  const fondo = '#1E1F24';
  for (const id of [...REDES, 'whatsapp', 'messenger']) {
    const e = ICONOS[id]; const c = e.placa || e.capas[0].oscuro || e.capas[0].fill; if (!c) continue; // currentColor: sale claro
    assert.ok(contraste(c, fondo) >= 3, `${id} ${c} sobre ${fondo}: ${contraste(c, fondo).toFixed(2)}:1`);
  }
  assert.ok(contraste(ICONOS.imessage.capas[0].fill, fondo) >= 3 && contraste(ICONOS.instagram.capas[0].fill, fondo) >= 3);
  const css = leer('src/css/iconos.css');
  for (const [id, e] of Object.entries(ICONOS)) for (const c of e.capas) if (c.oscuro) assert.ok(css.includes(`[data-r="${id}"] { fill: ${c.oscuro}; }`), `${id}: falta su regla oscura en src/css/iconos.css`);
  assert.equal((css.match(/\[data-r=/g) || []).length, Object.values(ICONOS).flatMap(e => e.capas).filter(c => c.oscuro).length, 'una regla de más');
});

test('ICO-08: LinkedIn lleva pictograma propio (su marca pidió retirar el logo) y la placa pasa 4,5:1', () => {
  assert.equal(ICONOS.linkedin.origen, 'propio'); assert.match(ICONOS.linkedin.fuente, /Simple Icons|ICO-08/); assert.ok(contraste(ICONOS.linkedin.placa, '#ffffff') >= 4.5);
  assert.match(iconoRed('linkedin'), /<rect[^>]*fill="#0C7BB8"/);
});

test('ICO-05: los logos de red sin su nombre al lado llevan nombre accesible', () => {
  assert.match(leer('src/contenido.js').split('\n').find(l => l.startsWith('const netBadges')), /iconoRed\(r, \{ titulo: /, 'las insignias de red de las tarjetas dicen qué red son');
  assert.match(leer('src/movil/vistas/crear.js'), /iconoRed\(r, \{ tam: 16, titulo: NOMBRE_RED\[r\] \|\| r \}\)\} \$\{c\.n\}/, 'los contadores por red del móvil');
  assert.match(iconoRed('pinterest', { titulo: 'Pinterest' }), /role="img" aria-label="Pinterest"/);
});

test('ICO-10: las pestañas de la vista previa miden 44 px en táctil o estrecho (30 en escritorio)', () => {
  assert.match(leer('src/css/contenido-preview.css'), /@media \(pointer: coarse\), \(max-width: 820px\) \{ \.pv-tabs \[role="tab"\] \{ min-height: 44px; \} \}/);
});
