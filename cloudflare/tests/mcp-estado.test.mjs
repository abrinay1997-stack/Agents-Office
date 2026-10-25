// GET /api/mcp en la nube: la forma de la local (mcp.summary), desde la tabla `conectores`; sin tokens ni nombres de secretos; respeta mcp.deny/allow/departments;
// el MCP de la propia oficina nunca llega a un agente.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resumenMcp, esDeLaOficina } from '../worker/lib/mcp-estado.js';
import { SALTAR } from './d1-memoria.mjs';
import { oficina, pagina } from './agentes-ayudas.mjs';

const fila = (o = {}) => ({ nombre: 'gmail', url: 'https://gmail.mcp.example.com/mcp', secreto: 'MCP_GMAIL_TOKEN', departamentos: '["emails"]', herramientas_lectura: '["search_threads"]', herramientas_envio: '["send_email"]', activo: 1, ...o });

test('un conector con su token puesto está conectado, llega a sus departamentos y dice qué herramientas leen o envían', () => {
  const r = resumenMcp({ filas: [fila()], env: { MCP_GMAIL_TOKEN: 'tok' } });
  assert.deepEqual(['discovering', 'servers', 'browser', 'web'].filter((k) => !(k in r)), []);
  const s = r.servers[0];
  assert.equal(s.status, 'connected'); assert.deepEqual(s.depts, ['emails']); assert.equal(s.allowed, true); assert.equal(s.target, 'gmail.mcp.example.com');
  assert.deepEqual(s.kinds, { search_threads: 'read', send_email: 'write' });
});
test('sin su token está «needs-auth», apagado está «disabled»; nunca sale el token ni el nombre del secreto', () => {
  const r = resumenMcp({ filas: [fila(), fila({ nombre: 'otro', activo: 0 })], env: {} });
  assert.deepEqual(r.servers.map((s) => s.status), ['needs-auth', 'disabled']);
  assert.ok(!JSON.stringify(r).includes('MCP_GMAIL_TOKEN'));
});
test('mcp.deny, mcp.allow y mcp.departments mandan; el MCP de la oficina nunca llega a un agente, ni nombrándolo', () => {
  const env = { MCP_GMAIL_TOKEN: 't', MCP_X: 't' };
  const d = resumenMcp({ filas: [fila()], env, cfg: { deny: ['Gmail'] } }).servers[0]; assert.deepEqual([d.denied, d.allowed, d.depts], [true, false, []]);
  const a = resumenMcp({ filas: [fila(), fila({ nombre: 'slack' })], env, cfg: { allow: ['slack'] } }).servers; assert.deepEqual(a.map((s) => s.allowed), [false, true]);
  const p = resumenMcp({ filas: [fila()], env, cfg: { departments: { gmail: ['sales', 'nada'] } } }).servers[0]; assert.deepEqual(p.depts, ['sales']);
  const o = fila({ nombre: 'agents-office', url: 'https://x.example.com/oficina-mcp.mjs' }); assert.equal(esDeLaOficina(o), true);
  const so = resumenMcp({ filas: [o], env, cfg: { allow: ['agents-office'], departments: { 'agents-office': ['ops'] } } }).servers[0];
  assert.deepEqual([so.denied, so.allowed, so.depts, so.office], [true, false, [], true]);
});
test('RUTA: /api/mcp contesta 200 con los conectores de D1 (antes 501 y «CONECTORES · 0»)', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({}); const web = await pagina({ d1, env });
  const r = await web.admin('GET', '/api/mcp'); assert.equal(r.status, 200);
  assert.equal(r.j.servers.length, 1); assert.equal(r.j.servers[0].status, 'connected'); assert.ok(!r.texto.includes('tok-mcp'));
  assert.equal((await web.lectura('GET', '/api/mcp')).status, 200);
});
