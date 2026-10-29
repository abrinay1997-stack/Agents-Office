// Fase 5 (ICO-01): el mismo conector se ve IGUAL en la nube y en el escritorio. Los dos salen del registro único (src/iconos-registro.mjs);
// esta prueba lo ata: el SVG de cada plantilla de la nube es, byte a byte, el de la tesela de escritorio, y el móvil no inventa otro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANTILLAS, svgDe, iconoUri } from '../worker/lib/iconos-conectores.js';
import { ICONOS, iconoTesela, monograma, uriDeSvg } from '../../src/iconos-registro.mjs';
import { MCP_LOGOS } from '../../src/mcplogos.js';

test('nube = escritorio: cada plantilla da el mismo SVG que la tesela del registro, y el de la barra de escritorio cuando existe', () => {
  for (const p of PLANTILLAS) {
    if (p.id === 'otro') { assert.equal(svgDe({ plantilla: 'otro', nombre: 'Mi CRM' }), monograma('Mi CRM'), 'Otro: monograma'); continue; }
    assert.ok(ICONOS[p.icono], p.id + ': ícono fuera del registro');
    assert.equal(svgDe({ plantilla: p.id, nombre: 'cualquier nombre' }), iconoTesela(p.icono), p.id);
    assert.equal(iconoUri({ plantilla: p.id }), uriDeSvg(iconoTesela(p.icono)), p.id);
    if (MCP_LOGOS[p.icono]) assert.equal(MCP_LOGOS[p.icono].img, iconoUri({ plantilla: p.id }), p.id + ': la barra de escritorio y la nube difieren');
  }
});

test('un conector sin plantilla cae en el monograma de siempre; el mismo Gmail ya no es un sobre rojo en la nube y un logo en el escritorio', () => {
  assert.equal(svgDe({ nombre: 'Mi CRM' }), monograma('Mi CRM'));
  assert.equal(MCP_LOGOS.gmail.img, iconoUri({ plantilla: 'gmail' }));
  assert.match(svgDe({ plantilla: 'gmail' }), /#EA4335/); assert.doesNotMatch(svgDe({ plantilla: 'gmail' }), /stroke="#fff"/, 'ya no es un pictograma de trazo sobre placa');
});
