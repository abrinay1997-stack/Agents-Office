// Fase 6 — Las únicas rutas que contestan sin sesión son /api/health, /api/acceso y los tres prefijos de webhook, cada uno con su secreto. Lo demás es 401, también las nuevas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oficina6, HOOK } from './fase6-ayudas.mjs';
import { RUTAS_PUBLICAS } from '../worker/lib/rutas.js';
import { MODULOS } from '../worker/modulos/index.js';
import { SALTAR } from './d1-memoria.mjs';

test('solo tres prefijos públicos, y solo los módulos que declaran `publica` los atienden', { skip: SALTAR }, () => {
  assert.deepEqual(RUTAS_PUBLICAS, ['/api/hook/', '/api/telegram/', '/api/kpi/']);
  assert.deepEqual(MODULOS.filter((m) => typeof m.publica === 'function').map((m) => m.nombre).sort(), ['disparadores', 'negocio', 'telegram']);
});

test('sin sesión todo lo nuevo es 401 (menos los webhooks, que piden su secreto)', { skip: SALTAR }, async () => {
  const o = await oficina6();
  for (const [m, r] of [['GET', '/api/sub'], ['POST', '/api/sub/chat'], ['GET', '/api/business'], ['GET', '/api/cifras'], ['GET', '/api/voice'], ['GET', '/api/settings'], ['GET', '/api/settings/telegram'], ['GET', '/api/triggers'], ['PUT', '/api/triggers'], ['GET', '/api/brain/stale'], ['POST', '/api/brain/upload'], ['POST', '/api/onboard/company'], ['POST', '/api/notices/read'], ['GET', '/api/status']]) {
    assert.equal((await o.anon(m, r, m === 'GET' ? undefined : {})).status, 401, `${m} ${r}`);
  }
  assert.equal((await o.anon('POST', '/api/telegram/otra-cosa', {})).status, 404);
  assert.equal((await o.anon('POST', '/api/hook/ruta mala', {}, { 'x-office-token': HOOK })).status, 404);
});

test('un webhook no mira el Origin (lo llama otra web) pero una escritura con sesión desde otro origen sigue prohibida', { skip: SALTAR }, async () => {
  const o = await oficina6();
  assert.equal((await o.anon('POST', '/api/kpi/ventas_semana', { value: 1 }, { origin: 'https://otra-web.com', 'x-office-token': HOOK })).status, 400, 'llegó a la ruta (el indicador no existe), no se frenó por el Origin');
  assert.equal((await o.admin('POST', '/api/settings', { changes: { name: 'X' } }, { origin: 'https://otra-web.com' })).status, 403);
});
