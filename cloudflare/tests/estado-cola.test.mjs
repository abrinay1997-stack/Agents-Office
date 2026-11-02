// Punto 17 de la auditoría de Anuncios: «Cola de trabajo» no cuenta como «esperando» lo tuyo, lo de personas ni lo bloqueado, y dice por qué espera cada una.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { oficina, tarea, pagina, mutarTarea } from './agentes-ayudas.mjs';

test('ESTADO: 12 tareas que la cola nunca arranca no son «12 esperando» ni ponen la cola en ámbar', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: { AGENTES_MAX_CONSULTAS: '5000', AGENTES_MAX_LLAMADAS: '500' } }); const web = await pagina({ d1, env });
  for (let i = 0; i < 10; i++) { const t = await tarea(env, { title: 'mía ' + i }); mutarTarea(d1, t.id, x => { x.person = i < 9 ? 'Tú' : 'Ana'; x.addedAt = Date.now() - 5 * 3600e3; }); }
  const base = await tarea(env, { title: 'base' }); mutarTarea(d1, base.id, x => { x.state = 'doing'; x.agent = 'elead'; });
  const b = await tarea(env, { title: 'bloqueada', agent: 'esales' }); mutarTarea(d1, b.id, x => { x.bloqueadaPor = [base.id]; x.addedAt = Date.now() - 5 * 3600e3; });
  const s = (await web.admin('GET', '/api/status')).j, cola = s.checks.find(c => c.id === 'cola');
  assert.match(cola.detail, /^0 esperando a la oficina; \d+ en marcha\./);
  assert.match(cola.detail, /10 son tuyas o de personas/); assert.match(cola.detail, /1 espera a que termine otra tarea/);
  assert.equal(cola.state, 'ok', 'lo viejo del dueño o bloqueado no dispara «atascada»');
});

test('ESTADO: sin llave de IA lo que sí se arrancaría se explica como «falta la llave»', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: { ANTHROPIC_API_KEY: '', META_API_KEY: '' } }); const web = await pagina({ d1, env });
  await tarea(env, { title: 'lista' });
  const cola = (await web.admin('GET', '/api/status')).j.checks.find(c => c.id === 'cola');
  assert.match(cola.detail, /1 esperando a la oficina/); assert.match(cola.detail, /falta la llave de IA/);
});
