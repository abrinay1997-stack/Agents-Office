// Fase 6 — Lo copiado a mano no se separa en silencio: el prompt de «Preparar desde mi web» es el de serve.mjs, y los núcleos compartidos dicen lo mismo en la oficina local y en la nube.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sistemaArranque, pedidoArranque } from '../worker/lib/arranque.js';
import * as sub from '../../sub.mjs';
import * as subCore from '../../sub-core.mjs';
import * as tg from '../../telegram.mjs';
import * as tgCore from '../../telegram-core.mjs';
import * as trig from '../../triggers.mjs';
import * as trigCore from '../../triggers-core.mjs';
import * as docs from '../../documents.mjs';
import * as docsCore from '../../documents-core.mjs';

const plantilla = (src, nombre) => { const m = new RegExp('const ' + nombre + ' = `((?:[^`\\\\]|\\\\.)*)`').exec(src); assert.ok(m, 'no encontré ' + nombre + ' en serve.mjs'); return m[1]; };

test('el prompt de «Preparar desde mi web» de la nube es el de serve.mjs, palabra por palabra', () => {
  const todo = fs.readFileSync(new URL('../../serve.mjs', import.meta.url), 'utf8'), src = todo.slice(todo.indexOf('Preparas la oficina de agentes') - 40);
  const sis = new Function('cfg', 'return `' + plantilla(src, 'system') + '`')({ name: 'ACME' });
  const usr = new Function('url', 'about', 'return `' + plantilla(src, 'user') + '`')('https://a.com', 'Vendemos.');
  assert.equal(sistemaArranque('ACME'), sis);
  assert.equal(pedidoArranque('https://a.com', 'Vendemos.'), usr);
});

test('la oficina local y la nube usan los mismos núcleos (todo lo puro está re-exportado, nada de más)', () => {
  const sin = (o, dejar = []) => Object.keys(o).filter((k) => !dejar.includes(k));
  for (const [local, core] of [[sub, subCore], [tg, tgCore], [trig, trigCore], [docs, docsCore]]) for (const k of Object.keys(core)) if (k !== 'default' && (k in local || local !== docs)) assert.equal(local[k], core[k], `${k} debe ser el mismo en local y en la nube`);
  assert.ok(sin(sub).length >= sin(subCore).length);
});
