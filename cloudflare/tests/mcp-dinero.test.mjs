// LA REGLA DEL DINERO del conector MCP (no negociable): un token de MCP NUNCA canjea un testigo de gasto. El alcance «gasto» solo permitirá, en fases futuras, PREPARAR un gasto; el segundo paso
// lo da una persona en la oficina o en Telegram. Este test falla si el registro deja pasar una herramienta que canjee un testigo, o un argumento que lo lleve, o un nombre que suene a aprobar/enviar/publicar/pagar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearRegistro, PROPIEDADES_PROHIBIDAS, herramientas } from '../worker/lib/mcp/registro.js';
import '../worker/lib/mcp/servidor.js'; // carga todas las herramientas reales

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ok = (extra = {}) => ({ nombre: 'dinero_prueba', descripcion: 'Una herramienta de prueba.', esquema: { type: 'object', properties: {} }, alcance: 'gasto', soloLectura: false, ejecutar: async () => 'x', ...extra });

test('el registro NO admite una herramienta que canjee un testigo de gasto', () => {
  const r = crearRegistro();
  assert.throws(() => r.registrar(ok({ canjeaGasto: true })), /nunca canjea|ninguna herramienta MCP canjea/);
  assert.throws(() => r.registrar(ok({ canjeaTestigo: true })), /canjea/);
  r.registrar(ok()); // una que PREPARA el gasto (sin testigo) sí cabe en el alcance «gasto»
});

test('…ni un argumento que lleve o reciba el testigo (a cualquier profundidad, con cualquier mayúscula)', () => {
  for (const p of PROPIEDADES_PROHIBIDAS) {
    const r = crearRegistro();
    assert.throws(() => r.registrar(ok({ esquema: { type: 'object', properties: { [p]: { type: 'string' } } } })), /testigo de un gasto/, p);
    assert.throws(() => r.registrar(ok({ esquema: { type: 'object', properties: { datos: { type: 'object', properties: { [p.toUpperCase()]: { type: 'string' } } } } } })), /testigo de un gasto/, p + ' anidado');
  }
  assert.ok(['confirmacion', 'testigo'].every((p) => PROPIEDADES_PROHIBIDAS.includes(p)), '`confirmacion` es el argumento con que anuncios/acciones.mjs canjea el segundo paso');
});

test('…ni un nombre que suene a aprobar, enviar, publicar, pagar o restablecer (como tests/control-oficina.test.mjs)', () => {
  for (const n of ['aprobar_gasto', 'canjear_testigo', 'confirmar_gasto', 'enviar_correo', 'publicar_pieza', 'pagar_factura', 'restablecer_oficina', 'borrar_cuenta', 'aprueba_todo']) {
    assert.throws(() => crearRegistro().registrar(ok({ nombre: n })), /nombre/, n);
  }
});

test('el registro REAL del Worker cumple lo mismo: ninguna herramienta que gaste hoy, ninguna con esos argumentos ni esos nombres', () => {
  const todas = herramientas(); assert.ok(todas.length >= 1);
  assert.deepEqual(todas.filter((h) => h.alcance === 'gasto').map((h) => h.nombre), [], 'en la P2 no hay ninguna herramienta que gaste');
  for (const h of todas) {
    const json = JSON.stringify(h.esquema).toLowerCase();
    for (const p of PROPIEDADES_PROHIBIDAS) assert.ok(!json.includes(`"${p}"`), `${h.nombre} lleva «${p}»`);
    assert.doesNotMatch(h.nombre, /(aprobar|canjear|enviar|publicar|pagar|restablecer)/);
  }
});

test('el código del conector no sabe canjear un testigo de gasto: no importa anuncios/acciones ni toca `confirmacion` fuera del registro que lo prohíbe', () => {
  const arch = (d, acc = []) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) arch(p, acc); else if (n.endsWith('.js')) acc.push(p); } return acc; };
  const fuentes = [...arch(join(RAIZ, 'worker/lib/mcp')), join(RAIZ, 'worker/modulos/mcp.js')];
  for (const f of fuentes) {
    const t = readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.doesNotMatch(t, /anuncios\/acciones|anuncios-nube|lib\/anuncios/, `${f}: el conector no llama al ejecutor de gasto`);
    if (!/registro\.js$/.test(f)) assert.doesNotMatch(t, /\bconfirmacion\b|\bcanjear\b|testigo de gasto/i, `${f}: un token de MCP no maneja el testigo de un gasto`);
  }
});

test('el registro del dinero está escrito: el contrato de registro.js dice que el segundo paso es de una persona', () => {
  const t = readFileSync(join(RAIZ, 'worker/lib/mcp/registro.js'), 'utf8');
  assert.match(t, /LA REGLA DEL DINERO/); assert.match(t, /paso 2 lo da una persona/);
});
