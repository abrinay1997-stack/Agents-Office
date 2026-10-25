// Fase 6 — Lo copiado a mano no se separa en silencio: el prompt de «Preparar desde mi web» es el de serve.mjs, y los núcleos compartidos dicen lo mismo en la oficina local y en la nube.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sistemaArranque, pedidoArranque } from '../../arranque-core.mjs';
import * as sub from '../../sub.mjs';
import * as subCore from '../../sub-core.mjs';
import * as tg from '../../telegram.mjs';
import * as tgCore from '../../telegram-core.mjs';
import * as trig from '../../triggers.mjs';
import * as trigCore from '../../triggers-core.mjs';
import * as docs from '../../documents.mjs';
import * as docsCore from '../../documents-core.mjs';

test('«Preparar desde mi web»: la oficina local y la nube le piden lo mismo al modelo — un solo texto (arranque-core.mjs), ninguna copia en serve.mjs', () => {
  const leer = (f) => fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
  assert.ok(!leer('serve.mjs').includes('Preparas la oficina de agentes'), 'serve.mjs ya no lleva su propia copia del prompt');
  for (const f of ['arranque-local.mjs', 'cloudflare/worker/lib/arranque.js']) assert.match(leer(f), /import \{[^}]*sistemaArranque[^}]*pedidoArranque[^}]*\} from '(\.\.\/)*(\.\.\/\.\.\/\.\.\/)?arranque-core\.mjs'|import \{ sistemaArranque, pedidoArranque, [^}]*\} from '(\.\/|(\.\.\/){3})arranque-core\.mjs'/, f + ' usa el texto compartido');
  assert.match(sistemaArranque('ACME'), /ACME/); assert.match(pedidoArranque('https://a.com', 'Vendemos.', '<web>x</web>'), /Vendemos\./);
});

test('la oficina local y la nube usan los mismos núcleos (todo lo puro está re-exportado, nada de más)', () => {
  const sin = (o, dejar = []) => Object.keys(o).filter((k) => !dejar.includes(k));
  for (const [local, core] of [[sub, subCore], [tg, tgCore], [trig, trigCore], [docs, docsCore]]) for (const k of Object.keys(core)) if (k !== 'default' && (k in local || local !== docs)) assert.equal(local[k], core[k], `${k} debe ser el mismo en local y en la nube`);
  assert.ok(sin(sub).length >= sin(subCore).length);
});
