// Dimitri sabe qué conectores MCP hay y a qué departamento sirven (no los llama: encarga el trabajo con un plan).
import test from 'node:test';
import assert from 'node:assert/strict';
import { conectoresTexto } from '../worker/lib/dimitri/datos.js';

const DEPTS = { ops: { name: 'Operaciones' }, marketing: { name: 'Marketing' } };
const gh = { name: 'GitHub', status: 'connected', allowed: true, depts: ['ops'], kinds: { get_commit: 'read', search_code: 'read', push_files: 'write' } };

test('lista el conector con su departamento y cuántas herramientas leen o envían', () => {
  const t = conectoresTexto([gh], DEPTS);
  assert.match(t, /GitHub: Operaciones · 2 herramientas de lectura, 1 que envían/);
  assert.match(t, /no digas que no lo tienes: propón un plan/);
});
test('sin departamento lo dice y dice dónde asignarlo', () => {
  assert.match(conectoresTexto([{ ...gh, depts: [] }], DEPTS), /SIN departamento .*Ajustes → Conectores MCP/);
});
test('no cuenta lo desconectado, lo bloqueado ni el MCP de la oficina; sin nada, no escribe nada', () => {
  assert.equal(conectoresTexto([{ ...gh, status: 'needs-auth' }, { ...gh, allowed: false }, { ...gh, office: true }], DEPTS), '');
  assert.equal(conectoresTexto([], DEPTS), '');
});
test('nunca nombra un token ni una dirección', () => {
  assert.doesNotMatch(conectoresTexto([{ ...gh, target: 'api.githubcopilot.com', token: 'ghp_x' }], DEPTS), /ghp_|githubcopilot/);
});
