// El tools/list COMPLETO de un token de alcance «gasto» (todas las herramientas de todos los dominios): pesa en cada conversación de Claude, así que cada carril nuevo paga con este presupuesto.
// mcp-capa1.test.mjs mide solo la Capa 1; aquí se mide el total. Si falla, acorta descripciones o esquemas (no subas el tope sin decirlo en el PR).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { mundo } from './mcp-ayudas.mjs';
import { herramientas } from '../worker/lib/mcp/registro.js';

const TOPE_LETRAS = 73000, TOPE_HERRAMIENTAS = 55, TOPE_UNA = 2000;
test('PRESUPUESTO TOTAL: tools/list de un token de gasto', { skip: SALTAR }, async () => {
  const m = await mundo();
  const tok = (await m.conectar({ alcance: 'gasto' })).tokens.access_token;
  const tools = (await m.rpc(tok, 'tools/list')).j.result.tools;
  const total = JSON.stringify(tools).length;
  console.log(`MEDIDA tools/list gasto: ${total} letras, ${tools.length} herramientas`);
  const nombres = tools.map((t) => t.name);
  assert.equal(new Set(nombres).size, nombres.length, 'sin nombres repetidos');
  assert.equal(nombres.length, herramientas().length, 'un token de gasto ve todas las herramientas registradas');
  assert.ok(total <= TOPE_LETRAS, `tools/list pesa ${total} letras (tope ${TOPE_LETRAS})`);
  assert.ok(tools.length <= TOPE_HERRAMIENTAS, `${tools.length} herramientas (tope ${TOPE_HERRAMIENTAS})`);
  for (const t of tools) { const n = (t.description || '').length + JSON.stringify(t.inputSchema).length; assert.ok(n <= TOPE_UNA, `${t.name}: ${n} letras entre descripción y esquema (tope ${TOPE_UNA})`); }
});
