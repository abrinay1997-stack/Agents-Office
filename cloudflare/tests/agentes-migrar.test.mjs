// Fase 4: el exportador de los agentes (scripts/migrar/agentes.mjs) y que lo que sube lo usan los agentes de la nube.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SALTAR } from './d1-memoria.mjs';
import { oficina, tarea, crearFetch, minutos, pagina, filas, todoD1, sis } from './agentes-ayudas.mjs';
import { exportar } from '../../scripts/migrar/agentes.mjs';

function vaultDePrueba() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-mig-')), vault = path.join(raiz, 'cerebro'), brain = path.join(vault, 'Agents Office');
  fs.mkdirSync(path.join(brain, 'skills', 'saludo'), { recursive: true }); fs.mkdirSync(path.join(brain, 'feedback'), { recursive: true }); fs.mkdirSync(path.join(brain, 'ejemplos', 'elead'), { recursive: true }); fs.mkdirSync(path.join(raiz, 'data'), { recursive: true });
  fs.writeFileSync(path.join(brain, 'skills', 'saludo', 'SKILL.md'), '---\nname: saludo\ndescription: Cómo saludamos\nagents: [elead]\n---\n# Saludar\nEmpieza siempre con el nombre del cliente.\n');
  fs.writeFileSync(path.join(brain, 'skills', 'saludo', 'plantilla.md'), 'Hola {nombre},');
  fs.writeFileSync(path.join(brain, 'feedback', 'elead.md'), '# x\n\n## Standing rules\n\n- 2026-10-01 · Sé breve ← "muy largo" (t)\n\n## One-offs\n\n- 2026-10-02 · "cambia el asunto" (t)\n');
  fs.writeFileSync(path.join(brain, 'ejemplos', 'elead', '2026-10-01-uno.md'), '---\ntarea: abc123\ntítulo: Un buen correo\n---\nHola Ana, gracias.\n');
  fs.writeFileSync(path.join(brain, 'cifras.json'), JSON.stringify({ items: [{ name: 'Precio base', value: '100', unit: 'USD', note: '', updated: '2026-10-01' }] }));
  fs.writeFileSync(path.join(raiz, 'data', 'routing.json'), JSON.stringify([{ t: 1, dept: 'sales', fromDept: 'emails', text: 'x', from: 'elead', to: 'piper' }]));
  fs.writeFileSync(path.join(raiz, 'data', 'memory.json'), JSON.stringify({ v: 1, notes: { a: { w: 1 } }, edges: {}, applied: {} }));
  return { raiz, vault };
}

test('el exportador lleva skills, lecciones, ejemplos, cifras, sinapsis y correcciones del enrutador; nunca una llave', async () => {
  const { raiz, vault } = vaultDePrueba();
  const r = await exportar({ raiz, vault });
  const saludo = r.filas.skills.find(s => s.id === 'saludo').valor;
  assert.deepEqual(saludo.agents, ['elead']); assert.match(saludo.text, /nombre del cliente/); assert.deepEqual(saludo.files, [{ name: 'plantilla.md', text: 'Hola {nombre},' }]);
  assert.deepEqual(r.docs['feedback.elead'].rules, ['2026-10-01 · Sé breve ← "muy largo" (t)']); assert.equal(r.docs['feedback.elead'].oneOffs.length, 1);
  assert.equal(r.docs['ejemplos.elead'].items[0].title, 'Un buen correo'); assert.match(r.docs['ejemplos.elead'].items[0].text, /gracias/);
  assert.equal(r.docs.cifras.items[0].value, '100'); assert.equal(r.docs['enrutador.correcciones'].lista[0].to, 'piper'); assert.ok(r.docs.memoria.notes.a);
  assert.ok(!/sk-ant|MCP_|_KEY|TOKEN/.test(JSON.stringify(r)));
  for (const k of Object.keys(r.docs)) assert.match(k, /^[a-z][a-z0-9_.-]{1,60}$/, 'la nube acepta ese nombre'); // la lista blanca de /api/migrar/docs
});

test('lo que se sube lo usa el agente de la nube en su siguiente tarea', { skip: SALTAR }, async () => {
  const { raiz, vault } = vaultDePrueba(); const r = await exportar({ raiz, vault });
  const { d1, env } = await oficina({ conector: false, env: { AGENTES_MAX_CONSULTAS: '5000', AGENTES_MAX_LLAMADAS: '500' } }); const web = await pagina({ d1, env });
  assert.equal((await web.admin('POST', '/api/migrar/filas', { coleccion: 'skills', filas: r.filas.skills })).status, 200);
  for (const [clave, valor] of Object.entries(r.docs)) assert.equal((await web.admin('POST', '/api/migrar/docs', { clave, valor })).status, 200, clave);
  assert.equal((await web.editor('POST', '/api/migrar/docs', { clave: 'cifras', valor: { items: [] } })).status, 403, 'solo un administrador sube datos');
  const ficha = (await web.admin('GET', '/api/agents/elead')).j; assert.ok(ficha.skills.some(s => s.name === 'saludo')); assert.equal(ficha.lessons.rules.length, 1);
  const lista = (await web.admin('GET', '/api/agents')).j.agents.find(a => a.id === 'elead'); assert.ok(lista.skills.includes('saludo')); assert.equal(lista.lessons, 1);
  await tarea(env); const f = crearFetch({}); await minutos(env, f.fetchFn);
  const s = sis(f.registro.anthropic[0].cuerpo);
  assert.match(s, /SKILLS[\s\S]*### saludo — Cómo saludamos[\s\S]*Hola \{nombre\}/); assert.match(s, /LESSONS[\s\S]*Sé breve/); assert.match(s, /Precio base: 100 USD/); assert.match(s, /EXAMPLES THE OWNER LIKED[\s\S]*gracias/);
  assert.equal((await web.admin('POST', '/api/agents/elead/forget', { line: '2026-10-01 · Sé breve ← "muy largo" (t)' })).status, 200);
  assert.equal((await web.admin('GET', '/api/agents/elead')).j.lessons.rules.length, 0);
  assert.ok(!todoD1(d1).includes('sk-ant-secreto'));
});
