import test from 'node:test';
import assert from 'node:assert/strict';
import { validarConector, urlPermitida, publico, paraAnthropic } from '../worker/lib/conectores.js';

const base = { nombre: 'gmail', url: 'https://gmail.mcp.example.com/mcp', secreto: 'MCP_GMAIL_TOKEN', departamentos: ['emails'], herramientas_lectura: ['search_threads', 'get_thread', 'create_draft'], herramientas_envio: ['send_email'] };

test('urlPermitida: solo https público con nombre de dominio', () => {
  assert.equal(urlPermitida('https://x.example.com/mcp'), null);
  for (const mala of ['http://x.example.com', 'https://localhost/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://[::1]/x', 'https://intranet/x', 'https://u:p@x.example.com', 'nada', 'https://x.internal/m'])
    assert.ok(urlPermitida(mala), mala);
});

test('un conector válido pasa y se normaliza', () => {
  const v = validarConector(base);
  assert.equal(v.ok, true);
  assert.equal(v.valor.nombre, 'gmail');
});

test('el secreto es un NOMBRE: un token pegado, o un secreto de la oficina, se rechaza', () => {
  assert.equal(validarConector({ ...base, secreto: 'sk-' + 'ant-api03-abcdefghijklmnop' }).ok, false);
  for (const s of ['ANTHROPIC_API_KEY', 'META_API_KEY', 'CLOUDFLARE_API_TOKEN', 'ADMIN_PASSWORD', 'MODEL_API_KEY', 'AO_HOOK_TOKEN'])
    assert.equal(validarConector({ ...base, secreto: s }).ok, false, s);
});

test('una herramienta que envía no puede declararse de lectura (en la duda, envía)', () => {
  assert.equal(validarConector({ ...base, herramientas_lectura: ['send_email'] }).ok, false);
  assert.equal(validarConector({ ...base, herramientas_lectura: ['herramienta_rara'] }).ok, false);
});

test('departamento desconocido y nombre inválido', () => {
  assert.equal(validarConector({ ...base, departamentos: ['marte'] }).ok, false);
  assert.equal(validarConector({ ...base, nombre: 'Gmail Raro!' }).ok, false);
});

const fila = (o = {}) => ({ id: '1', nombre: 'gmail', url: base.url, secreto: 'MCP_GMAIL_TOKEN', activo: 1, departamentos: '["emails"]', herramientas_lectura: '["search_threads"]', herramientas_envio: '["send_email"]', ...o });

test('publico() dice si el token está puesto pero jamás lo enseña', () => {
  const env = { MCP_GMAIL_TOKEN: 'tok-secreto-xyz' };
  const p = publico(fila(), env);
  assert.equal(p.tokenPuesto, true);
  assert.ok(!JSON.stringify(p).includes('tok-secreto-xyz'));
  assert.equal(publico(fila(), {}).tokenPuesto, false);
});

test('paraAnthropic: todo apagado salvo lo permitido; el envío solo en ejecución aprobada', () => {
  const env = { MCP_GMAIL_TOKEN: 'tok' };
  const a = paraAnthropic(fila(), env);
  assert.deepEqual(Object.keys(a.toolset.configs), ['search_threads']);
  assert.equal(a.toolset.default_config.enabled, false);
  assert.equal(a.servidor.authorization_token, 'tok');
  const b = paraAnthropic(fila(), env, { aprobada: true });
  assert.deepEqual(Object.keys(b.toolset.configs).sort(), ['search_threads', 'send_email']);
});

test('sin token, inactivo o sin herramientas: no se manda', () => {
  assert.equal(paraAnthropic(fila(), {}), null);
  assert.equal(paraAnthropic(fila({ activo: 0 }), { MCP_GMAIL_TOKEN: 'x' }), null);
  assert.equal(paraAnthropic(fila({ herramientas_lectura: '[]', herramientas_envio: '[]' }), { MCP_GMAIL_TOKEN: 'x' }), null);
});

test('un conector no puede llamarse como un servidor interno (todo contaría como lectura)', () => {
  for (const n of ['estudio', 'tareas', 'contenido']) assert.equal(validarConector({ ...base, nombre: n, herramientas_lectura: [] }).ok, false, n);
});
