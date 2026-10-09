// Plan M5 (6 oct 2026): las evaluaciones de skills — el archivo de cada skill se valida y el veredicto del juez se lee bien.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validarEvals, leerVeredicto } from '../scripts/evals-skill.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('cada evals/<skill>/evals.json es válido y su skill existe', () => {
  const dir = path.join(ROOT, 'evals'), skills = fs.readdirSync(dir);
  assert.ok(skills.includes('plan-contenido'));
  for (const s of skills) {
    const e = JSON.parse(fs.readFileSync(path.join(dir, s, 'evals.json'), 'utf8'));
    assert.deepEqual(validarEvals(e), [], s); assert.equal(e.skill, s);
    // A5 (9 oct 2026): o una habilidad de la biblioteca con otro nombre («habilidad»: evals/anuncios-diagnostico → campanas-pagadas)
    const conHabilidad = e.habilidad && fs.readdirSync(path.join(ROOT, 'biblioteca')).some(c => fs.existsSync(path.join(ROOT, 'biblioteca', c, e.habilidad, 'SKILL.md')));
    assert.ok(conHabilidad || fs.existsSync(path.join(ROOT, 'skills', s, 'SKILL.md')), `skills/${s}/SKILL.md o la habilidad «${e.habilidad}»`);
  }
});

test('el validador dice qué falta, y el veredicto del juez se lee aunque traiga texto alrededor', () => {
  assert.match(validarEvals({ skill: 'x', evals: [{ id: 'a', prompt: 'corto', expectations: ['una sola expectativa'] }] }).join(' '), /prompt.*expectations/);
  assert.match(validarEvals({ skill: 'x', evals: [{ id: 'a', prompt: 'un pedido de verdad', expectations: ['cumple esto bien', 'y también esto'] }, { id: 'a', prompt: 'otro pedido de verdad', expectations: ['cumple esto bien', 'y también esto'] }] }).join(' '), /repetido/);
  assert.deepEqual(leerVeredicto('Aquí va:\n{"cumple":[true,false],"evidencia":["«dice X»","no aparece"]}\nListo.', 2), { cumple: [true, false], evidencia: ['«dice X»', 'no aparece'] });
  assert.equal(leerVeredicto('{"cumple":[true]}', 2), null, 'un veredicto con otro número de expectativas no vale');
  assert.equal(leerVeredicto('sin json', 1), null);
});
