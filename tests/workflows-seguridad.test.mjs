// SEG-07 (fase 0a): los workflows de GitHub no se pueden correr aquí, pero sí leer. Este test exige lo que la revisión pidió:
// permisos mínimos, despliegue solo desde main y con entorno aprobado, `npm ci`, concurrencia y el nombre del job `check` (el ruleset de main lo exige).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { entornoSinSecretos } from '../cloudflare/scripts/subir-secretos.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.github', 'workflows');
const wf = f => fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r/g, '');
const sinComentarios = t => t.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
const todos = fs.readdirSync(DIR).filter(f => /\.ya?ml$/.test(f));

test('todo workflow declara permisos mínimos (contents: read) a nivel de archivo y nadie pide escritura', () => {
  for (const f of todos) {
    const t = sinComentarios(wf(f));
    assert.match(t, /^permissions:\s*\n\s+contents: read\s*$/m, `${f}: falta permissions: contents: read`);
    assert.ok(!/:\s*write\b/.test(t), `${f}: pide permiso de escritura`);
  }
});

test('todo workflow tiene concurrency y ninguno usa «npm install» (solo npm ci, con el lock)', () => {
  for (const f of todos) {
    const t = sinComentarios(wf(f));
    assert.match(t, /^concurrency:/m, `${f}: sin concurrency`);
    assert.ok(!/npm install\b/.test(t), `${f}: usa npm install`);
  }
});

test('lo que despliega o toca secretos corre solo desde main y con el entorno «produccion» (aprobador)', () => {
  for (const [f, job] of [['cloudflare-desplegar.yml', 'desplegar'], ['cloudflare-sembrar-admin.yml', 'sembrar'], ['cloudflare-telegram-webhook.yml', 'telegram']]) {
    const t = sinComentarios(wf(f)); const i = t.search(new RegExp(`^  ${job}:`, 'm')); assert.ok(i >= 0, `${f}: no encuentro el job ${job}`);
    const bloque = t.slice(i, i + 700);
    assert.match(bloque, /github\.ref == 'refs\/heads\/main'/, `${f}: ${job} no se limita a main`);
    assert.match(bloque, /environment: produccion/, `${f}: ${job} sin environment`);
  }
  assert.match(sinComentarios(wf('cloudflare-desplegar.yml')), /github\.event_name != 'pull_request' && github\.ref == 'refs\/heads\/main'/);
});

test('el job de check.yml se sigue llamando «check» (el ruleset de main lo exige) y la rama no-main cancela lo anterior', () => {
  const t = sinComentarios(wf('check.yml'));
  assert.match(t, /^jobs:\s*\n  check:/m)
  assert.match(t, /cancel-in-progress: \$\{\{ github\.ref != 'refs\/heads\/main' \}\}/);
});

test('el despliegue nunca cancela a medias y el volcado de secretos no llega a wrangler', () => {
  assert.match(sinComentarios(wf('cloudflare-desplegar.yml')), /cancel-in-progress: false/);
  const env = entornoSinSecretos({ SECRETS_JSON: '{"A":"x"}', CLOUDFLARE_API_TOKEN: 't', PATH: '/bin' });
  assert.equal(env.SECRETS_JSON, undefined); assert.equal(env.CLOUDFLARE_API_TOKEN, 't'); assert.equal(env.PATH, '/bin');
});
