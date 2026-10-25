// Versión móvil (25 oct 2026): la estructura de lo de Contenido, Bandeja, «Crear publicación», Analíticas y Anuncios — qué viaja en qué paquete, que las
// pantallas diferidas dicen lo mismo que las de verdad, las reglas de estilo (nada de :hover, nada de texto bajo 11 px, nada atenuado con opacity) y que la
// regla del dinero de Anuncios no tiene atajos en el código. El comportamiento (los toques, las hojas, el servidor) lo prueba el recorrido de navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { construirMovil, construirMovilD, CSS_MOVIL, CSS_MOVIL_D } from '../build-movil.mjs';
import { PANTALLAS } from '../src/movil/vistas/diferidas.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const leer = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('el paquete de Contenido, Analíticas y Anuncios registra las mismas pantallas que las diferidas, con los mismos rótulos', async () => {
  const { js } = await construirMovilD();
  const ventana = { };
  const caja = { window: ventana, console, matchMedia: () => ({ matches: false, addEventListener() {} }), localStorage: { getItem: () => null, setItem() {} } };
  vm.runInNewContext(js, { ...caja, globalThis: caja });
  const defs = ventana.AO_MOVIL_D;
  assert.ok(defs, 'el paquete deja window.AO_MOVIL_D');
  assert.deepEqual(Object.keys(defs).sort(), PANTALLAS.map(p => p.id).sort(), 'las pantallas del paquete son las diferidas');
  for (const p of PANTALLAS) {
    const d = defs[p.id];
    assert.equal(typeof d.montar, 'function', `${p.id} no tiene montar`);
    for (const k of ['titulo', 'icono', 'grupo', 'sec', 'texto']) assert.equal(d[k], p[k], `${p.id}: «${k}» no coincide entre la diferida y la de verdad`);
  }
});

test('cada paquete lleva lo suyo: el armazón no trae Contenido ni Anuncios y la página no trae ninguno de los dos', async () => {
  const m = await construirMovil(), d = await construirMovilD();
  for (const f of ['src/movil/vistas/contenido.js', 'src/movil/vistas/crear.js', 'src/movil/vistas/bandeja.js', 'src/movil/vistas/analiticas.js', 'src/movil/vistas/anuncios.js']) {
    assert.ok(!m.aparte.includes(f), `${f} no debe ir en dist/movil.js (pesa más que todo el armazón)`);
    assert.ok(d.aparte.includes(f), `${f} va en dist/movil-d.js`);
  }
  assert.ok(m.aparte.includes('src/movil/vistas/diferidas.js'));
  assert.ok(!m.js.includes('data-ao-movil-d'), 'el estilo del paquete aparte no viaja en el armazón');
  assert.ok(d.js.startsWith('(function(){if(typeof document==="undefined"||document.querySelector("style[data-ao-movil-d]"))return;'), 'el estilo viaja dentro del paquete');
  const f = path.join(ROOT, 'dist/command-centre-v2.html');
  if (fs.existsSync(f)) { const pagina = fs.readFileSync(f, 'utf8'); assert.ok(!pagina.includes('AO_MOVIL_D') && !pagina.includes('data-ao-movil-d') && !pagina.includes('md-pasos'), 'la página no lleva nada de este paquete'); }
});

test('movil-d.css solo viaja en su paquete y respeta las reglas del estilo móvil', () => {
  assert.deepEqual(CSS_MOVIL_D, ['movil-d.css']); assert.ok(!CSS_MOVIL.includes('movil-d.css'));
  const css = leer('src/css/movil-d.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/:hover/.test(css), 'nada depende de :hover (un teléfono no lo tiene)');
  for (const m of css.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(+m[1] >= 11, `ningún texto bajo 11 px (${m[0]})`);
  for (const m of css.matchAll(/([^{}]+)\{[^}]*\bopacity:\s*([\d.]+)/g)) assert.ok(/md-area/.test(m[1]), `nada se atenúa con opacity para decir «apagado»: ${m[1].trim().slice(0, 60)}`);
  for (const r of css.matchAll(/(?:^|})\s*([^{}@]+)\{/g)) for (const sel of r[1].split(',').map(x => x.trim()).filter(Boolean)) assert.match(sel, /\.md-|\.mv-|body\.mv-inmersivo|#mvRoot/, `un selector fuera del espacio móvil: ${sel}`);
  assert.ok(/prefers-reduced-motion/.test(css), 'respeta «reducir movimiento»');
  for (const m of css.matchAll(/(?:^|[;{\s])(?:min-)?height:\s*(\d+)px/g)) void m; // (los objetivos de 44 px los mide el recorrido de navegador)
});

test('la regla del dinero de Anuncios no tiene atajos: lo que gasta nunca se aplica sin pasar por la hoja con la cifra', () => {
  const src = leer('src/movil/vistas/anuncios.js');
  // 1. el único sitio que manda `confirmacion` es el botón «Sí» de la hoja, y con el token que dio el servidor en el primer toque
  const usos = [...src.matchAll(/confirmacion:\s*([^,}]+)/g)].map(m => m[1].trim());
  assert.ok(usos.length >= 1 && usos.every(u => /^c\.token$/.test(u)), `la confirmación sale solo del token del servidor: ${usos.join(' | ')}`);
  // 2. lo que gasta nunca va por la rama «directo» (un toque)
  assert.match(src, /if \(GASTO\.has\(tipo\)\) return dialogo\(g, 'pidiendo'\)/);
  assert.match(src, /if \(pideDatos\(tipo\)\) return dialogo\(g, 'form'\)/);
  assert.match(src, /return GASTO\.has\(g\.tipo\) \? primer\(\) : directo\(b\)/, 'el formulario de un gasto va a «Ver lo que gasta», no a hacerlo');
  // 3. el segundo botón dice la cifra (botonSi) y hay cuenta atrás: una confirmación vencida se vuelve a pedir
  assert.match(src, /botonSi\(g\.tipo, c, m\)/); assert.match(src, /data-d="otra"/);
  // 4. nada nace activo: el botón de crear dice «en pausa» y se pide con una hoja de confirmación
  assert.match(src, /Crear en Meta \(en pausa\)/); assert.match(src, /¿Crear en Meta, en pausa\?/);
});

test('aprobar y enviar siempre pasan por una hoja de confirmación (nada sale con un toque suelto)', () => {
  const comun = leer('src/movil/vistas/d-comun.js'), bandeja = leer('src/movil/vistas/bandeja.js'), contenido = leer('src/movil/vistas/contenido.js'), crear = leer('src/movil/vistas/crear.js');
  assert.match(comun, /ctx\.confirmar\(\{ titulo: pronto \? '¿Publicar ya\?' : '¿Aprobar y programar\?'/);
  assert.match(bandeja, /ctx\.confirmar\(\{ titulo: '¿Enviar esta respuesta\?'/);
  // las únicas llamadas a /aprobar de las pantallas: la de d-comun (con hoja) y el lote (con su propia hoja)
  assert.equal([...comun.matchAll(/\/aprobar`/g)].length, 1);
  assert.equal([...crear.matchAll(/\/aprobar/g)].length, 0, 'crear.js aprueba solo por aprobarPieza');
  assert.equal([...contenido.matchAll(/\/aprobar`/g)].length, 1);
  assert.match(contenido, /ctx\.confirmar\(\{ titulo: `¿Aprobar \$\{ok\.length\}/, 'aprobar varias también confirma');
  // guardar no aprueba: crear.js manda siempre estado «borrador» al crear y nunca un estado al guardar
  assert.match(crear, /body: \{ \.\.\.b, estado: 'borrador' \}/); assert.ok(!/estado: 'aprobada'/.test(crear));
});
