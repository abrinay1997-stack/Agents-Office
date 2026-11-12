// P1 del plan MCP: el dominio propio de la oficina y workers.dev encendido a la vez.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const crudo = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
// Quita comentarios // y /* */ sin tocar los que están dentro de cadenas (las URL llevan //).
function sinComentarios(t) {
  let o = '', i = 0, enCad = false;
  while (i < t.length) {
    const c = t[i], n = t[i + 1];
    if (enCad) { o += c; if (c === '\\') { o += n; i += 2; continue; } if (c === '"') enCad = false; i++; continue; }
    if (c === '"') { enCad = true; o += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < t.length && t[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < t.length && !(t[i] === '*' && t[i + 1] === '/')) i++; i += 2; continue; }
    o += c; i++;
  }
  return o;
}
const conf = JSON.parse(sinComentarios(crudo));

test('wrangler.jsonc: oficina.panaclaw.com como dominio propio', () => {
  assert.ok(Array.isArray(conf.routes), 'falta routes');
  const r = conf.routes.find((x) => x && x.pattern === 'oficina.panaclaw.com');
  assert.ok(r, 'falta la ruta de oficina.panaclaw.com');
  assert.equal(r.custom_domain, true);
});

test('wrangler.jsonc: ninguna ruta apunta a otro host', () => {
  for (const r of conf.routes) assert.equal(r.pattern, 'oficina.panaclaw.com');
});

test('wrangler.jsonc: workers_dev sigue en true (escrito)', () => {
  assert.equal(conf.workers_dev, true);
});
