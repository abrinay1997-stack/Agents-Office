// Las funciones que se publican apagadas: el catálogo y el cálculo de lo que hay que escribir (funciones-core.mjs).
// Lo que estos tests muerden: que ningún interruptor del catálogo apunte a una clave que el código no lee (un botón muerto),
// que encender no pise el resto del documento, que lo que no está listo no entre por «listas» y que una dependencia se respete.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Desde la carpeta de ESTE archivo, nunca desde donde se lanzó node: el botón de GitHub corre sus pasos dentro de `cloudflare/`
// y una ruta relativa buscaba `cloudflare/cloudflare/worker`.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
import { FUNCIONES, MANEJABLES, LISTAS, porId, plan, poner, leer, activa, documentosDe, idsDe, DOC_AJUSTES, DOC_LOCAL } from '../funciones-core.mjs';

const archivos = (dir, acc = []) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (n === 'node_modules' || n.startsWith('.')) continue;
    if (statSync(p).isDirectory()) archivos(p, acc); else if (/\.(mjs|js)$/.test(n)) acc.push(p);
  }
  return acc;
};

test('el catálogo está bien formado', () => {
  const ids = new Set();
  for (const f of FUNCIONES) {
    assert.match(f.id, /^[a-z0-9-]{3,24}$/, `id raro: ${f.id}`);
    assert.ok(!ids.has(f.id), `id repetido: ${f.id}`); ids.add(f.id);
    assert.ok(f.titulo && f.titulo.length <= 60, `${f.id}: título largo o vacío`);
    assert.ok(f.que && f.que.length <= 240, `${f.id}: «qué hace» largo o vacío`);
    assert.ok(['config', 'estudio.config', 'chat.config', 'notas.config', 'notificaciones.config'].includes(f.donde), `${f.id}: documento desconocido`);
    assert.match(f.ruta, /^[A-Za-z][\w.]*$/, `${f.id}: ruta rara`);
    assert.strictEqual(typeof f.gasta, 'boolean', `${f.id}: falta «gasta»`);
    if (!f.lista) assert.ok(f.porque, `${f.id}: si no está lista, tiene que decir por qué`);
    if (f.requiere) assert.ok(porId(f.requiere), `${f.id}: requiere «${f.requiere}», que no existe`);
  }
});

// El test que de verdad importa: un interruptor que apunte a una clave que nadie lee sería un botón que no hace nada.
test('cada interruptor lo lee el código del Worker', () => {
  const fuentes = archivos(join(RAIZ, 'cloudflare/worker')).map((p) => readFileSync(p, 'utf8')).join('\n');
  for (const f of FUNCIONES) {
    const hoja = f.ruta.split('.').pop();
    assert.ok(fuentes.includes(hoja), `«${f.id}» apunta a ${f.donde} → ${f.ruta}, pero el Worker no menciona «${hoja}» en ninguna parte: sería un botón muerto`);
  }
});

// El botón falló dos veces por el ENTORNO, no por el catálogo: una por la ruta y otra porque wrangler.jsonc lleva un
// marcador en database_id hasta que `preparar-cuenta.mjs` escribe el id real. Este test vigila el orden de los pasos.
test('el workflow prepara la cuenta antes de hablar con la base, y comprueba antes de escribir', () => {
  const y = readFileSync(join(RAIZ, '.github/workflows/cloudflare-encender.yml'), 'utf8');
  const preparar = y.indexOf('preparar-cuenta.mjs');
  const comprobar = y.indexOf('funciones-core.test.mjs');
  const encender = y.indexOf('encender-funciones.mjs');
  assert.ok(preparar > 0, 'falta preparar-cuenta.mjs: wrangler.jsonc tiene un marcador en database_id y D1 contesta «Invalid uuid»');
  assert.ok(comprobar > 0, 'falta la comprobación del catálogo');
  assert.ok(encender > 0, 'falta el paso que enciende');
  assert.ok(preparar < encender, 'preparar la cuenta va ANTES de tocar la base');
  assert.ok(comprobar < encender, 'comprobar el catálogo va ANTES de escribir nada');
  assert.match(y, /environment: produccion/, 'falta la guarda del entorno de producción');
  assert.match(y, /refs\/heads\/main/, 'falta la guarda de que solo corre desde main');
});

test('encender no pisa el resto del documento', () => {
  const docs = { [DOC_AJUSTES]: { name: 'PanaClaw', dimitri: { otra: 1 }, costs: { monthlyBudget: 50 } }, [DOC_LOCAL]: { name: 'PanaClaw' } };
  const { cambios } = plan(docs, [{ id: 'series-nube', activo: true }]);
  assert.strictEqual(leer(cambios[DOC_AJUSTES], 'dimitri.seriesNube'), true);
  assert.strictEqual(leer(cambios[DOC_AJUSTES], 'dimitri.otra'), 1, 'se llevó por delante lo que había al lado');
  assert.strictEqual(cambios[DOC_AJUSTES].name, 'PanaClaw');
  assert.strictEqual(leer(cambios[DOC_AJUSTES], 'costs.monthlyBudget'), 50, 'se llevó por delante el presupuesto');
  assert.strictEqual(leer(cambios[DOC_LOCAL], 'dimitri.seriesNube'), true, 'los dos documentos de ajustes se escriben juntos');
});

test('«poner» crea lo que falta y devuelve una copia', () => {
  const antes = { a: 1 };
  const despues = poner(antes, 'x.y.z', true);
  assert.strictEqual(leer(despues, 'x.y.z'), true);
  assert.strictEqual(despues.a, 1);
  assert.deepStrictEqual(antes, { a: 1 }, 'tocó el original');
});

test('solo «=== true» cuenta como encendida', () => {
  const f = porId('sesion-deslizante');
  assert.strictEqual(activa(f, { [DOC_AJUSTES]: { sesion: { deslizante: 'true' } } }), false, 'un "true" de texto no puede encender nada');
  assert.strictEqual(activa(f, { [DOC_AJUSTES]: { sesion: { deslizante: 1 } } }), false);
  assert.strictEqual(activa(f, { [DOC_AJUSTES]: { sesion: { deslizante: true } } }), true);
});

test('«listas» deja fuera lo que no está construido, y «todas» lo incluye para que se decida a mano', () => {
  const listas = idsDe('listas');
  assert.ok(!listas.includes('retoques-nube'), 'los retoques no están probados en producción: no entran por «listas»');
  assert.ok(!listas.includes('series-nube-pago'), 'la parte que genera en la nube no existe todavía');
  assert.ok(!listas.includes('dominios-conector'), 'ya tiene su interruptor en la pantalla');
  assert.ok(listas.includes('chat') && listas.includes('lotes-nube'));
  assert.deepStrictEqual(idsDe('todas'), MANEJABLES.map((f) => f.id));
  assert.deepStrictEqual(idsDe('chat, lotes-nube'), ['chat', 'lotes-nube']);
  assert.deepStrictEqual(idsDe(''), LISTAS.map((f) => f.id));
});

test('lo que ya se cambia desde una pantalla no se toca desde aquí', () => {
  const { cambios, avisos } = plan({}, [{ id: 'dominios-conector', activo: true }]);
  assert.deepStrictEqual(cambios, {});
  assert.match(avisos.join(' '), /Ajustes → Seguridad/);
});

test('una función que depende de otra no se enciende sola', () => {
  const solo = plan({}, [{ id: 'series-nube-pago', activo: true }]);
  assert.deepStrictEqual(solo.cambios, {}, 'encendió el gasto sin su requisito');
  assert.match(solo.avisos.join(' '), /antes hay que encender/);
  const juntas = plan({}, [{ id: 'series-nube', activo: true }, { id: 'series-nube-pago', activo: true }]);
  assert.strictEqual(leer(juntas.cambios[DOC_AJUSTES], 'dimitri.seriesNubePago'), true, 'con su requisito en la misma tanda, sí');
  const yaEsta = plan({ [DOC_AJUSTES]: { dimitri: { seriesNube: true } } }, [{ id: 'series-nube-pago', activo: true }]);
  assert.strictEqual(leer(yaEsta.cambios[DOC_AJUSTES], 'dimitri.seriesNubePago'), true, 'con el requisito ya encendido, también');
});

test('apagar funciona y lo que ya estaba como se pide no se reescribe', () => {
  const docs = { 'chat.config': { activo: true, otra: 'cosa' } };
  const off = plan(docs, [{ id: 'chat', activo: false }]);
  assert.strictEqual(off.cambios['chat.config'].activo, false);
  assert.strictEqual(off.cambios['chat.config'].otra, 'cosa');
  const igual = plan(docs, [{ id: 'chat', activo: true }]);
  assert.deepStrictEqual(igual.cambios, {}, 'reescribió un documento que ya estaba bien');
  assert.ok(igual.hechos[0].yaEstaba);
});

test('documentosDe dice los dos documentos de ajustes, y uno para los propios', () => {
  assert.deepStrictEqual(documentosDe([porId('series-nube')]).sort(), [DOC_AJUSTES, DOC_LOCAL].sort());
  assert.deepStrictEqual(documentosDe([porId('chat')]), ['chat.config']);
  assert.deepStrictEqual(documentosDe([porId('lotes-nube')]), ['estudio.config']);
});

test('ninguna función que gasta se enciende sin decirlo', () => {
  for (const f of FUNCIONES.filter((x) => x.gasta)) assert.ok(f.nota || f.porque, `${f.id}: gasta y no explica nada al dueño`);
});
