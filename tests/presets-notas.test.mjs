// Banco de presets (§15.4): un preset propio es una NOTA del Cerebro, <cerebro>/Estudio/Presets/<nombre>.md — la receta en la
// cabecera (pila, ejes de la referencia, escena 3D, canal) y un cuerpo que se lee, con [[enlaces]] a la marca, la campaña y
// el preset del que sale. Este test comprueba el lector y el escritor (puros) de presets-notas.mjs. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { notaAPreset, presetANota, validarPropio, normalizarEscena, idDesdeNombre, archivoDeNombre, rutaDe, aPresetDeBanco, leerCabecera, escenaEnPalabras, CARPETA } from '../presets-notas.mjs';
import { cargarFabrica } from '../presets/fabrica.mjs';
import { readVault } from '../graph-build.mjs';

const fab = cargarFabrica();
const byId = new Map(fab.presets.map(p => [p.id, p]));
const canales = new Set(fab.canales.map(c => c.id));
const ESCENA = { producto: { tipo: 'cama queen', ancho: 160, alto: 50, fondo: 200, giro: 0, elevacion: 0 }, camara: { distancia: 320, azimut: 30, altura: 120, lente: 50 }, cuadro: { proporcion: '4:5' }, fondo: { tipo: 'color', valor: '#FFFFFF' } };
const PROPIO = {
  tipo: 'propio', id: 'mio-camas-web-octubre', nombre: 'Camas para la web (octubre)', v: 3, medio: 'image', icono: 'marca',
  frase: 'Las camas de la bodega, sobre blanco y con margen: la casa de PanaClaw.', basadoEn: 'cat-web-panaclaw@1',
  receta: {
    pila: [{ id: 'cat-web-panaclaw', params: { encuadre: 'margen', canal: 'web' } }, { id: 'limp-arrugas', params: { intensidad: 'fuerte' } }],
    ejes: { estilo: 2, color: 3, composicion: 0, luz: 0, fondo: 0, pose: 0, producto: 0 }, escena: ESCENA, canal: 'web', modelo: 'nano-banana-2',
    fijas: ['2026-10/2026-10-01 look panaclaw 101010.jpg'],
  },
  marca: 'PanaClaw', campana: 'Camas octubre', enlaces: ['Voz de marca'], buscar: ['camas', 'web octubre'], estado: 'beta',
  creado: '2026-10-01T10:00:00.000Z', actualizado: '2026-10-01T12:30:00.000Z', notas: 'Probada con la Roma 140 y la Milán king. Ver [[Proveedor China]].',
  archivo: 'Estudio/Presets/Camas para la web (octubre).md',
};

test('escribir y leer devuelve el mismo preset (la receta entera viaja en la cabecera)', () => {
  const md = presetANota(PROPIO, { byId });
  const { preset, problemas } = notaAPreset(md, { archivo: PROPIO.archivo, byId, canales });
  assert.deepEqual(problemas, []);
  assert.deepEqual(preset, { ...PROPIO, enlaces: ['Voz de marca', 'Proveedor China'] }, 'los [[enlaces]] que el dueño escribe en Notas también cuentan');
  assert.equal(presetANota(preset, { byId }), md, 'reescribir no cambia nada (estable)');
});

test('la nota se lee como una nota: nombre, frase, [[enlaces]] a la marca, la campaña y el preset de fábrica, la receta y la escena en palabras', () => {
  const md = presetANota(PROPIO, { byId });
  const { cab, cuerpo } = leerCabecera(md);
  assert.equal(cab.tipo, 'preset');
  assert.match(cuerpo, /^# Camas para la web \(octubre\)\n\nLas camas de la bodega/);
  assert.match(cuerpo, /Sale de \[\[Catálogo para la web, con margen\]\] \(`cat-web-panaclaw@1`\)\. Marca: \[\[PanaClaw\]\]\. Campaña: \[\[Camas octubre\]\]\. \[\[Voz de marca\]\]/);
  assert.match(cuerpo, /## Receta\n1\. Catálogo para la web, con margen \(`cat-web-panaclaw`\) · Distancia del producto: Con margen · 60 % · Para dónde es: web\n2\. Arrugas de sábanas y cojines \(`limp-arrugas`\) · Intensidad: Fuerte/);
  assert.match(cuerpo, /## Referencia\nEstilo: normal · Color \/ LUT: fuerte · Composición: apagado/);
  assert.match(cuerpo, /## Escena 3D\ncama queen de 160 × 200 × 50 cm \(ancho × fondo × alto\)\. Cámara a 3,2 m y 1,2 m de alto, 30° alrededor, lente de 50 mm\. Cuadro 4:5\. Fondo: color #FFFFFF\./);
  assert.match(cuerpo, /## Referencias fijas\n- `2026-10\/2026-10-01 look panaclaw 101010\.jpg` \(galería del Estudio\)/);
  assert.ok(!/data:image|base64/.test(md), 'las imágenes se citan por su id, nunca se copian');
  // la pila y la escena van en JSON de una línea (YAML válido); las listas, en bloque, como las deja Obsidian
  assert.match(md, /^pila: \[\{"id":"cat-web-panaclaw","params":\{"encuadre":"margen","canal":"web"\}\},/m);
  assert.match(md, /^fijas:\n {2}- 2026-10\/2026-10-01 look panaclaw 101010\.jpg$/m);
  assert.match(md, /^basadoEn: "cat-web-panaclaw@1"$/m);
});

test('las Notas del dueño se conservan al reescribir, aunque el preset cambie', () => {
  const previa = presetANota(PROPIO, { byId }).replace('Probada con la Roma 140', 'Probada con la Roma 140 (y la Venecia, ver [[Fotos bodega]])');
  const nuevo = { ...PROPIO, v: 4, receta: { ...PROPIO.receta, canal: 'ig-feed' }, notas: 'esto no manda' };
  const md = presetANota(nuevo, { byId, previa });
  assert.match(md, /## Notas\nProbada con la Roma 140 \(y la Venecia, ver \[\[Fotos bodega\]\]\) y la Milán king/);
  assert.ok(!md.includes('esto no manda'));
  assert.match(md, /^canal: ig-feed$/m);
  assert.deepEqual(notaAPreset(md, { byId, canales }).preset.enlaces, ['Voz de marca', 'Fotos bodega', 'Proveedor China']);
});

test('una nota editada a mano en Obsidian (listas en bloque, comillas simples, sin algunos campos) se lee igual', () => {
  const md = ['---', 'tipo: preset', "nombre: 'Mesa de noche, detalle'", 'medio: image', 'pila:', '  - {"id":"cat-detalle","params":{}}', 'buscar: [mesa, noche, "detalle, madera"]', 'tags:', '  - estudio', '---', '# Mesa de noche', '', '## Notas', 'La de [[Roble]].', ''].join('\n');
  const { preset, problemas } = notaAPreset(md, { archivo: 'Estudio/Presets/Mesa de noche, detalle.md', byId, canales });
  assert.deepEqual(problemas, []);
  assert.equal(preset.id, 'mio-mesa-de-noche-detalle', 'sin id, sale del nombre');
  assert.equal(preset.v, 1);
  assert.deepEqual(preset.receta.pila, [{ id: 'cat-detalle', params: {} }]);
  assert.deepEqual(preset.buscar, ['mesa', 'noche', 'detalle, madera']);
  assert.deepEqual(preset.enlaces, ['Roble']);
  assert.equal(preset.receta.escena, null);
});

test('lo que no vale se dice en frases, sin tirar: ids desconocidos, dos recetas, parámetros, ejes, canal, fijas, JSON roto, notas que no son preset', () => {
  const p = structuredClone(PROPIO);
  p.receta.pila = [{ id: 'cat-web-panaclaw', params: { encuadre: 'lejisimos', color: 'x' } }, { id: 'cat-amazon' }, { id: 'no-existe' }, { id: 'cam-acercar' }];
  p.receta.ejes = { estilo: 5, sabor: 1 };
  p.receta.canal = 'tiktok';
  p.receta.fijas = ['C:\\fotos\\cama.jpg', '../data/x.jpg', 'data:image/png;base64,AAAA'];
  p.basadoEn = 'cat-web-panaclaw';
  const s = validarPropio(p, { byId, canales }).join('\n');
  for (const re of [/«encuadre» no admite «lejisimos»/, /no tiene el parámetro «color»/, /«no-existe» no es un preset que exista/, /como mucho una receta por pila/, /«cam-acercar» es de video y el preset de image/,
    /«estilo» va de 0 \(apagado\) a 3/, /«sabor» no es un eje de la referencia/, /canal: «tiktok» no es un canal/, /no es un id de la galería[\s\S]*no es un id de la galería[\s\S]*no es un id de la galería/, /basadoEn: «id@versión»/]) assert.match(s, re);
  assert.match(validarPropio({ ...PROPIO, id: 'cama-web' }).join('\n'), /id: «mio-»/);
  // JSON roto en la cabecera: se dice cuál, el resto se lee
  const roto = presetANota(PROPIO, { byId }).replace(/^pila: .*$/m, 'pila: [{"id":"cat-web-panaclaw"');
  const r = notaAPreset(roto, { byId, canales });
  assert.match(r.problemas.join('\n'), /pila: no se entiende/);
  assert.equal(r.preset.nombre, PROPIO.nombre);
  assert.deepEqual(notaAPreset('# Solo una nota', {}), { preset: null, problemas: ['la nota no tiene cabecera (--- … ---) con la receta'] });
  assert.match(notaAPreset('---\ntipo: pieza\n---\nx', {}).problemas[0], /no es un preset \(tipo: pieza\)/);
});

test('la escena 3D: el piso es el cero, los ángulos dan la vuelta, el lente es uno de la lista', () => {
  assert.deepEqual(normalizarEscena(ESCENA), { escena: ESCENA, problemas: [] });
  const e = normalizarEscena({ ...ESCENA, producto: { ...ESCENA.producto, giro: 270, elevacion: 40 }, camara: { ...ESCENA.camara, azimut: -200, altura: 0 } });
  assert.deepEqual(e.problemas, []);
  assert.equal(e.escena.producto.giro, -90);
  assert.equal(e.escena.camara.azimut, 160);
  assert.equal(e.escena.camara.altura, 0, 'a ras de piso vale (contrapicado)');
  assert.equal(e.escena.producto.elevacion, 40, 'el producto se sube para el contrapicado');
  const mal = normalizarEscena({ producto: { tipo: '', ancho: -1, alto: 50, fondo: 200 }, camara: { distancia: 2, azimut: 0, altura: -30, lente: 70 }, cuadro: { proporcion: 'cuadrado' }, fondo: { tipo: 'color', valor: 'blanco' } });
  const s = mal.problemas.join('\n');
  for (const re of [/dice qué es/, /el ancho del producto debe ser/, /la distancia de la cámara debe ser un número de 5/, /la cámara no baja del piso/, /el lente es uno de 14, 24, 35, 50, 85, 135/, /«ancho:alto»/, /un fondo de color es #RRGGBB/]) assert.match(s, re);
  assert.equal(mal.escena.camara.altura, 0, 'nunca bajo el piso, ni siquiera mal escrita');
  assert.match(normalizarEscena({ ...ESCENA, fondo: { tipo: 'locacion', valor: '' } }).problemas.join(), /dice cuál es/);
  assert.match(escenaEnPalabras({ ...ESCENA, producto: { ...ESCENA.producto, elevacion: 40 }, fondo: { tipo: 'set', valor: 'estudio gris' } }), /subido 40 cm\. .*Fondo: set «estudio gris»\./);
  assert.equal(normalizarEscena(null).escena, null);
});

test('nombres y rutas: el archivo lleva el nombre legible; el id, «mio-» y el nombre sin tildes', () => {
  assert.equal(CARPETA, 'Estudio/Presets');
  assert.equal(idDesdeNombre('Camas para la web (octubre)'), 'mio-camas-para-la-web-octubre');
  assert.equal(idDesdeNombre('¡Ñandú!'), 'mio-nandu');
  assert.equal(idDesdeNombre('   '), 'mio-preset');
  assert.ok(idDesdeNombre('x'.repeat(90)).length <= 40);
  assert.equal(archivoDeNombre('Fondo: blanco / gris?'), 'Fondo blanco gris.md');
  assert.equal(archivoDeNombre('Catálogo [[web]]. '), 'Catálogo web.md');
  assert.equal(rutaDe('Sala cálida'), 'Estudio/Presets/Sala cálida.md');
});

test('en la lista del banco un preset propio tiene la forma de uno de fábrica (grupo «De PanaClaw», su pila en incluye)', () => {
  const b = aPresetDeBanco(PROPIO, { byId, iconos: fab.iconos });
  assert.equal(b.categoria, 'mios');
  assert.equal(b.capa, 'receta');
  assert.deepEqual(b.incluye, ['cat-web-panaclaw', 'limp-arrugas']);
  assert.equal(b.ejecutor, 'local+ia');
  assert.deepEqual(b.modos, ['foto']);
  assert.equal(b.icono.d, fab.iconos.marca);
  assert.ok(b.requiere.edit && b.post.includes('encuadrar') && b.buscar.includes('panaclaw') && b.buscar.includes('camas octubre'));
  assert.equal(b.propio.escena, ESCENA);
  const local = aPresetDeBanco({ ...PROPIO, receta: { pila: [{ id: 'luz-mas-clara' }, { id: 'color-calido' }] } }, { byId, iconos: fab.iconos });
  assert.equal(local.ejecutor, 'local', 'todo local: no llama a ningún modelo');
});

test('el Cerebro lee la carpeta Estudio/Presets: la nota es una neurona y sus [[enlaces]] son sinapsis', () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-presets-'));
  try {
    fs.mkdirSync(path.join(vault, 'Estudio', 'Presets'), { recursive: true });
    fs.mkdirSync(path.join(vault, '20-Brand'), { recursive: true });
    fs.writeFileSync(path.join(vault, '20-Brand', 'PanaClaw.md'), '# PanaClaw\n');
    fs.writeFileSync(path.join(vault, rutaDe(PROPIO.nombre)), presetANota(PROPIO, { byId }));
    const { notes, raw } = readVault(vault);
    assert.ok(notes.has(PROPIO.nombre), 'la nota está en el Cerebro');
    assert.equal(notes.get(PROPIO.nombre).group, 'Estudio');
    const links = raw.filter(([de]) => de === PROPIO.nombre).map(([, a]) => a);
    for (const x of ['PanaClaw', 'Camas octubre', 'Catálogo para la web, con margen', 'Voz de marca', 'Proveedor China']) assert.ok(links.includes(x), x);
  } finally { fs.rmSync(vault, { recursive: true, force: true }); }
});
