// V4.7: un texto sin publicar trae precios, lanzamientos y promociones, y el repositorio de la oficina puede ser público. Las piezas de Contenido viven
// en <cerebro>/Agents Office/contenido/, la carpeta de las entregas de los agentes, y git tiene que ignorarla —salvo lo que se respalda a propósito.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ignorado = f => spawnSync('git', ['check-ignore', '-q', f], { cwd: ROOT }).status === 0;

test('las piezas de contenido no viajan por GitHub, ni las del cerebro del equipo ni las de un cerebro local', () => {
  for (const f of ['brain-panaclaw/Agents Office/contenido/2026-10/p-20261005-a1b2.md', 'brain-panaclaw/Agents Office/contenido/sin-fecha/p-20261005-a1b2.md', 'brain/Agents Office/contenido/2026-10/p-20261005-a1b2.md', 'data/contenido/cola.json'])
    assert.ok(ignorado(f), `${f} debería estar ignorado por git`);
});

test('lo que sí se respalda del cerebro sigue respaldándose (el roster, las rutinas y las skills)', () => {
  for (const f of ['brain-panaclaw/Agents Office/agents.json', 'brain-panaclaw/Agents Office/routines.json', 'brain-panaclaw/Agents Office/skills/x/SKILL.md'])
    assert.ok(!ignorado(f), `${f} debería viajar`);
});
