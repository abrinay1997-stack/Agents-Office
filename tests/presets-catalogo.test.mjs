// Banco de presets (F1, equipo de datos): la fábrica de presets/ — el esquema (§4 y §12 de docs/propuesta-banco-presets.md),
// el catálogo partido sin perder nada, los iconos, que cada preset lo sirva algún modelo del catálogo y que el buscador
// encuentre lo que el dueño escribe con sus palabras («fondo blanco», «más luz», «quitar sombra», «catálogo web»…).
// Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cargarFabrica, juntar, cuentas, rutaDeGrupo } from '../presets/fabrica.mjs';
import { validarFabrica, validarPreset, ctxDe, servible, expandirIncluye, marcadoresDe, largoPeor, normal, EJES_EXCLUSIVOS } from '../presets/validar.mjs';
import { encontrar, normalizar, raiz, casi, expandir } from '../presets/indice.mjs';
import { iconoSVG, trazoDe, RESERVA } from '../presets/iconos.mjs';
import { allModels, capsOf, familiaDe, FAMILIAS } from '../media/catalogo.mjs';

const fab = cargarFabrica();
const ctx = ctxDe(fab);
const caps = allModels().map(m => ({ ...capsOf(m), ajustes: Object.keys(m.settings || {}) }));
const byId = ctx.byId;
const copia = id => structuredClone(byId.get(id));
const docs = JSON.parse(fs.readFileSync(new URL('../docs/presets-catalogo.json', import.meta.url), 'utf8'));

test('la fábrica carga sin problemas y el esquema entero pasa (cada preset, grupo, canal, familia, icono y sinónimo)', () => {
  assert.deepEqual(fab.problemas, []);
  const r = validarFabrica(fab, { capacidades: caps });
  assert.deepEqual(r.problemas, [], r.problemas.join('\n'));
});

test('partir el catálogo no perdió nada: cada preset de docs/presets-catalogo.json está, en su grupo y su archivo', () => {
  for (const p of docs.presets) {
    const q = byId.get(p.id);
    assert.ok(q, `falta «${p.id}»`);
    assert.equal(q.categoria, p.categoria, p.id);
    assert.ok(q.v >= p.v, `«${p.id}» bajó de versión`);
  }
  for (const g of docs.grupos) if (g.medio !== 'todos') assert.ok(fab.archivos.includes(rutaDeGrupo(g)), `falta presets/${rutaDeGrupo(g)}`);
  assert.deepEqual(fab.tipos, docs.tipos);
  assert.deepEqual(fab.iconos, docs.iconos);
  assert.equal(fab.canales.length, docs.canales.length);
  // los presets que cambiaron respecto de docs/ subieron su versión (el trabajo guarda id@v: «Repetir» lo nota)
  for (const p of docs.presets) if (JSON.stringify(byId.get(p.id)) !== JSON.stringify(p)) assert.ok(byId.get(p.id).v > p.v, `«${p.id}» cambió sin subir v`);
});

test('las cuentas del Anexo A: 127 de imagen, 53 de video, 5 de música, 3 de voz; F1 trae 66 (solo imagen) y todo nace beta', () => {
  const c = cuentas(fab.presets);
  assert.deepEqual({ imagen: c.imagen, video: c.video, musica: c.musica, voz: c.voz, total: c.total, fase1: c.fase1 }, { imagen: 127, video: 53, musica: 5, voz: 3, total: 188, fase1: 66 });
  assert.ok(c.imagen >= 70 && c.video >= 25, 'mínimos de §12');
  assert.ok(fab.presets.filter(p => p.fase === 1).every(p => p.medios[0] === 'image'), 'F1 es imagen');
  assert.ok(fab.presets.every(p => p.estado === 'beta'), 'nada es estable sin probarlo con 5 fotos reales');
  for (const g of fab.grupos.filter(g => g.medio !== 'todos')) assert.ok(fab.presets.some(p => p.categoria === g.id), `el grupo «${g.id}» está vacío`);
  // la portada de cada puerta: hay recetas estrella de imagen desde cero, sobre tu foto y con una referencia
  const estrella = fab.presets.filter(p => p.estrella && p.medios[0] === 'image');
  for (const m of ['foto', 'cero', 'ref']) assert.ok(estrella.some(p => p.modos.includes(m) || (m === 'ref' && p.modos.includes('foto+ref'))), `ninguna estrella para «${m}»`);
});

test('ningún preset de imagen pide fotogramas; los ejes exclusivos y «exclusivo» cuadran; los parámetros traen su valor por defecto', () => {
  for (const p of fab.presets.filter(p => p.medios[0] === 'image')) assert.ok(!p.entradas.some(e => e.rol === 'inicial' || e.rol === 'final'), p.id);
  for (const p of fab.presets) assert.equal(p.exclusivo, p.capa === 'ajuste' && p.ejes.some(e => EJES_EXCLUSIVOS.includes(e)), p.id);
  const x = copia('luz-mas-clara'); x.parametros[0].def = 'muchisimo';
  assert.match(validarPreset(x, ctx).join('\n'), /el valor por defecto «muchisimo» no está entre los permitidos/);
});

test('recetas: incluye se abre de forma recursiva, sin ciclos ni repetidos, y deja solo ajustes', () => {
  assert.deepEqual(expandirIncluye('color-arreglar', byId).lista, ['color-blancos', 'color-quitar-tono', 'luz-mas-clara', 'luz-abrir-sombras', 'luz-recuperar-quemado', 'color-mas-vivo']);
  const web = expandirIncluye('cat-web-panaclaw', byId);
  assert.deepEqual(web.problemas, []);
  assert.deepEqual(web.lista, ['limp-polvo', 'luz-mas-clara', 'luz-abrir-sombras', 'luz-recuperar-quemado', 'color-blancos', 'fondo-blanco', 'sombra-contacto'], 'luz-arreglar (receta) se abre en sus tres ajustes');
  for (const p of fab.presets.filter(p => p.incluye)) for (const id of expandirIncluye(p.id, byId).lista) assert.equal(byId.get(id).capa, 'ajuste', `${p.id} → ${id}`);
  // un ciclo y un id que no existe se dicen
  const m = new Map(byId); const a = copia('luz-arreglar'); a.incluye = ['color-arreglar']; m.set('luz-arreglar', a);
  const c = copia('color-arreglar'); c.incluye = ['luz-arreglar', 'no-existe']; m.set('color-arreglar', c);
  const r = expandirIncluye('color-arreglar', m);
  assert.match(r.problemas.join('\n'), /ciclo en incluye: color-arreglar → luz-arreglar → color-arreglar/);
  assert.match(r.problemas.join('\n'), /incluye «no-existe», que no existe/);
  // un ajuste con incluye, o una receta que deja otra receta sin abrir
  const aj = copia('luz-mas-clara'); aj.incluye = ['luz-mas-oscura'];
  assert.match(validarPreset(aj, ctx).join('\n'), /solo una receta incluye ajustes/);
});

test('el validador dice en frases lo que está mal (id, grupo, fase, buscar con tildes, marcadores, precios, campos desconocidos)', () => {
  const bad = copia('fondo-gris');
  Object.assign(bad, { id: 'Fondo Gris', categoria: 'no-hay', fase: 5, buscar: ['Gris', 'estudio', 'estudio'], colour: 'x' });
  bad.prompt.conversacional += ' {inventado} {p.nada} for $49';
  const s = validarPreset(bad, ctx).join('\n');
  for (const re of [/id: debe ser de 3 a 40/, /categoria: «no-hay» no es un grupo/, /fase: un preset de image va en la fase 1 o 4/, /«Gris» va en minúsculas/, /sinónimos repetidos/,
    /colour: campo desconocido/, /marcador «\{inventado\}» desconocido/, /«\{p\.nada\}» en «conversacional» no es un parámetro/, /trae un precio escrito/]) assert.match(s, re);
  const v = copia('cam-acercar'); v.fase = 1; v.exclusivo = false;
  const sv = validarPreset(v, ctx).join('\n');
  assert.match(sv, /fase: un preset de video va en la fase 5/);
  assert.match(sv, /exclusivo: debe ser true/);
  const img = copia('fondo-gris'); img.entradas.push({ rol: 'inicial', medio: 'image', min: 0, max: 1, es: 'Fotograma' });
  assert.match(validarPreset(img, ctx).join('\n'), /nunca pide fotograma inicial ni final/);
  const mio = copia('fondo-gris'); mio.id = 'mio-fondo'; mio.basadoEn = 'fondo-gris@1';
  assert.match(validarPreset(mio, ctx).join('\n'), /prefijo de los presets del dueño[\s\S]*basadoEn y fijas son solo de los presets del dueño/);
});

test('cada preset lo sirve algún modelo del catálogo (los de F1 sin excepción; el resto, con el motivo si no)', () => {
  const r = validarFabrica(fab, { capacidades: caps });
  const sinServir = [...r.servir].filter(([, s]) => !s.ok);
  for (const [id] of sinServir) assert.notEqual(byId.get(id).fase, 1, `«${id}» es de F1 y nadie lo sirve`);
  // hoy: «Sin fondo (PNG)» espera el ajuste background de GPT Image (§5.9.7); el aviso lo dice en palabras
  for (const [id, s] of sinServir) assert.match(s.motivo, /^ningún modelo de \w+ del catálogo que /, id);
  assert.ok(r.avisos.some(a => /cat-sin-fondo» sin servir: .*fondo transparente/.test(a)) || r.servir.get('cat-sin-fondo').ok);
  // los locales no necesitan modelo
  assert.deepEqual(servible(byId.get('luz-mas-clara'), caps), { ok: true, modelos: [], motivo: 'en tu máquina (sharp)' });
  // el catálogo de Amazon lo hacen los que editan, nunca un modelo legacy ni la prueba gratis
  const am = servible(byId.get('cat-amazon'), caps);
  assert.ok(am.ok && am.modelos.includes('nano-banana-2') && !am.modelos.includes('prueba'));
  for (const m of am.modelos) assert.ok(capsOf(m).editar && !capsOf(m).legacy, m);
  // un video de un fotograma a otro necesita inicial y final
  for (const m of servible(byId.get('vp-antes-despues'), caps).modelos) assert.ok(capsOf(m).start && capsOf(m).end, m);
  // pedir lo imposible da un motivo
  const raro = copia('ref-estilo'); raro.requiere = { refsMin: 99 };
  assert.deepEqual(servible(raro, caps), { ok: false, modelos: [], motivo: 'ningún modelo de image del catálogo que toma 99 imágenes' });
  // prefer solo nombra modelos que existen y son del medio del preset
  const pf = structuredClone(fab); pf.presets.find(p => p.id === 'vp-ugc').prefer.push('marketing-studio', 'no-existe');
  const pr = validarFabrica(pf, { capacidades: caps }).problemas.join('\n');
  assert.match(pr, /«vp-ugc» · prefer: «marketing-studio» es de image, el preset de video/);
  assert.match(pr, /«no-existe» no es un modelo del catálogo/);
});

test('el prompt de cada familia cabe en su tope (max de la familia y maxPrompt de sus modelos) en el peor caso', () => {
  for (const p of fab.presets) for (const fam of Object.keys(p.prompt || {})) {
    if (typeof p.prompt[fam] !== 'string' || fam === 'modoCero') continue;
    const tope = fab.familias[fam]?.max || 4000;
    assert.ok(largoPeor(p, fam, fab) <= tope, `${p.id}/${fam}: ${largoPeor(p, fam, fab)} > ${tope}`);
  }
  const largo = copia('fondo-gris'); largo.prompt['edicion-corta'] = 'x'.repeat(590) + ' {conservar}';
  const f2 = structuredClone(fab); f2.presets = f2.presets.map(p => p.id === 'fondo-gris' ? largo : p);
  assert.match(validarFabrica(f2, { capacidades: caps }).problemas.join('\n'), /«fondo-gris» · prompt: la plantilla de «edicion-corta» llega a \d+ caracteres y la familia admite 600/);
  assert.deepEqual(marcadoresDe('a {idea} b {p.fuerza} {cifras.precio}'), ['idea', 'p.fuerza', 'cifras.precio']);
});

test('las familias de presets/familias.json son las de media/catalogo.mjs, y todo modelo vigente cae en una', () => {
  for (const [k, v] of Object.entries(fab.familias)) assert.deepEqual(v.modelos, FAMILIAS[k], k);
  for (const m of allModels().filter(m => !m.legacy)) assert.ok(familiaDe(m.id, fab.familias), `«${m.id}» no tiene familia de prompt`);
});

test('juntar() avisa de un preset en el archivo de otro grupo, de un id repetido y de un grupo que no existe', () => {
  const p = copia('fondo-gris');
  const r = juntar({ grupos: fab.grupos, archivos: [{ ruta: 'imagen/luz.json', grupo: 'luz', presets: [p] }, { ruta: 'imagen/fondo.json', grupo: 'fondo', presets: [p] }, { ruta: 'imagen/x.json', grupo: 'x', presets: [] }] });
  assert.match(r.problemas.join('\n'), /imagen\/luz\.json: «fondo-gris» dice categoria «fondo» pero está en el archivo de «luz»/);
  assert.match(r.problemas.join('\n'), /el id «fondo-gris» está repetido/);
  assert.match(r.problemas.join('\n'), /el grupo «x» no está en grupos\.json/);
});

test('iconos: un solo trazo por icono, con el estilo del Estudio (currentColor, 1,6, redondeado); decorativo salvo con título', () => {
  for (const p of fab.presets) assert.equal(p.icono.d, fab.iconos[p.icono.id], p.id);
  for (const g of fab.grupos) assert.ok(fab.iconos[g.icono], g.id);
  const svg = iconoSVG(byId.get('luz-mas-clara').icono);
  assert.match(svg, /^<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1\.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M8\.5 15/);
  const t = iconoSVG('marco', { iconos: fab.iconos, tam: 24, titulo: 'Catálogo <web> & "más"', clase: 'pb-ic' });
  assert.match(t, /class="pb-ic" width="24".*role="img" aria-label="Catálogo &lt;web&gt; &amp; &quot;más&quot;"><title>Catálogo &lt;web&gt;/);
  assert.equal(trazoDe('no-existe', fab.iconos), RESERVA);
  assert.equal(trazoDe({ id: 'x', d: '"><script>' }), RESERVA, 'un trazo con otra cosa no entra en el SVG');
});

// Lo que el dueño escribe → lo que tiene que salir (en los primeros `top`). Frases reales: las de §12 y las del pedido.
const FRASES = [
  ['fondo blanco', ['fondo-blanco'], 1], ['fondo blanco', ['cat-amazon'], 3],
  ['más luz', ['luz-mas-clara'], 1], ['se ve oscura', ['luz-mas-clara'], 1], ['foto oscura', ['luz-mas-clara'], 2],
  ['quitar sombra', ['sombra-quitar', 'luz-abrir-sombras'], 2], // ambiguo: la sombra del suelo o lo oscuro de la foto
  ['catálogo web', ['cat-web-panaclaw'], 1], ['Catálogo para la web', ['cat-web-panaclaw'], 1], ['catalogo', ['cat-web-panaclaw'], 2],
  ['como este anuncio', ['ref-anuncio'], 1], ['igual a este anuncio', ['ref-anuncio'], 1],
  ['foto fea', ['cat-proveedor', 'cal-whatsapp'], 2], ['foto de WhatsApp', ['cal-whatsapp', 'cat-proveedor'], 3],
  ['quitar lo de atrás', ['fondo-blanco', 'cat-sin-fondo', 'limp-objetos'], 3], ['quitar el fondo', ['fondo-blanco', 'cat-sin-fondo'], 2],
  ['que se vea pro', ['cat-web-panaclaw', 'luz-estudio'], 2], ['para la web', ['cat-web-panaclaw'], 1], ['para vender', ['cat-web-panaclaw'], 1],
  ['para Instagram', ['enc-recortes-redes', 'cat-fbshop'], 5], ['para amazon', ['cat-amazon'], 1], ['mercadolibre', ['cat-mercadolibre'], 1],
  ['la sábana arrugada', ['limp-arrugas'], 1], ['sabanas arrugadas', ['limp-arrugas'], 1], ['que no se corte', ['cat-margen-recortar', 'enc-distancia', 'enc-ampliar'], 3],
  ['más espacio alrededor', ['enc-ampliar', 'cat-margen-recortar'], 3], ['que dé vueltas', ['cam-orbita', 'vp-giro-360'], 2], ['girar 360', ['vp-giro-360'], 1],
  ['sombras', ['luz-abrir-sombras', 'sombra-quitar'], 5], ['sin fondo', ['cat-sin-fondo'], 1], ['fondo transparente', ['cat-sin-fondo'], 1],
  ['más nítida', ['cal-nitidez'], 1], ['quitar marca de agua', ['limp-texto'], 1], ['se ve amarilla', ['color-blancos'], 1], ['más color', ['color-mas-vivo'], 1],
  ['copiar el color', ['ref-color'], 1], ['todas iguales', ['cat-serie-muebles', 'ref-serie-patron'], 2], ['que no flote', ['sombra-contacto'], 1],
  ['quitar el precio', ['limp-etiquetas'], 1], ['quitar gente', ['limp-personas'], 1], ['quitar ubicación', ['sal-limpiar-datos'], 1],
  ['mi cama de la bodega', ['cat-web-panaclaw'], 1], ['luz de estudio', ['luz-estudio'], 1], ['desde abajo', ['enc-desde-abajo'], 1],
  ['video vertical', ['vf-reel'], 2], ['música para reel', ['mus-reel'], 1], ['locución', ['voz-anuncio'], 1], ['colchón', ['vp-colchon'], 2],
  // video (F5): las frases del dueño para un clip
  ['producto girando', ['vp-giro-360'], 1], ['zoom lento', ['cam-acercar'], 1], ['unboxing', ['vp-unboxing'], 1], ['abrir la caja', ['vp-unboxing'], 1],
  ['antes y después', ['vp-antes-despues', 'mkt-antes-despues'], 2], ['antes/después', ['vp-antes-despues'], 2], ['cámara en mano', ['cam-mano'], 1],
  ['que se repita', ['vp-bucle-web'], 1], ['sin sonido', ['vs-mudo'], 1], ['copiar movimiento', ['ved-copiar-movimiento'], 1],
  // una letra de más, de menos, cambiada o traspuesta (palabras de 5 letras o más)
  ['exposicon', ['luz-mas-clara'], 2], ['sabana arugada', ['limp-arrugas'], 1], ['fodno blanco', ['fondo-blanco'], 2], ['nitides', ['cal-nitidez'], 2],
];

test('los sinónimos encuentran lo que el dueño escribe con sus palabras', () => {
  const malas = [];
  for (const [q, ids, top] of FRASES) {
    const r = encontrar(q, fab.presets, { sinonimos: fab.sinonimos, grupos: fab.grupos, limite: Math.max(top, 5) });
    const primeros = r.slice(0, top).map(x => x.id);
    for (const id of ids) if (!primeros.includes(id)) malas.push(`«${q}» → «${id}» no está en los ${top} primeros: ${r.map(x => x.id).join(', ') || 'nada'}`);
  }
  assert.deepEqual(malas, []);
});

test('el buscador filtra por medio y modo, explica por qué encontró, y lo que no existe no encuentra nada', () => {
  assert.ok(encontrar('que dé vueltas', fab.presets, { sinonimos: fab.sinonimos, medio: 'image' }).every(x => byId.get(x.id).medios[0] === 'image'));
  assert.ok(encontrar('fondo', fab.presets, { modo: 'cero' }).every(x => byId.get(x.id).modos.includes('cero')));
  assert.deepEqual(encontrar('zzzz qqqq', fab.presets, { sinonimos: fab.sinonimos }), []);
  const [r] = encontrar('se ve amarilla', fab.presets, { sinonimos: fab.sinonimos });
  assert.equal(r.por, 'frase de tienda');
  assert.equal(encontrar('Exposición +', fab.presets)[0].id, 'luz-mas-clara');
});

test('las piezas del índice: normalizar, raíz de plurales, una letra de distancia y frases de sinonimos.json', () => {
  assert.equal(normalizar('  ¿Más LUZ, por favor?  '), 'mas luz por favor');
  assert.equal(normalizar('Catálogo · 4:5'), 'catalogo 4:5');
  assert.equal(normal('Pequeñas'), 'pequenas');
  for (const [a, b] of [['sombras', 'sombra'], ['colores', 'color'], ['luces', 'luz'], ['detalles', 'detalle'], ['redes', 'red'], ['camas', 'cama']]) assert.equal(raiz(a), raiz(b), `${a} / ${b}`);
  assert.ok(casi('blanco', 'blanoc') && casi('nitidez', 'nitides') && casi('fondos', 'fondo') && !casi('fondo', 'mundo'));
  assert.ok(!casi('luz', 'lus'), 'las palabras cortas no toleran errores');
  const ex = expandir('Se ve AMARILLA', fab.sinonimos).map(x => x.q);
  assert.ok(ex.includes('amarillenta') && ex[0] === 'se ve amarilla');
  for (const [k, v] of Object.entries(fab.sinonimos.frases)) { assert.equal(k, normal(k)); for (const t of v) assert.equal(t, normal(t), `${k} → ${t}`); }
});
