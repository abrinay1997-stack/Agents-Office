// El script que enciende las funciones en producción (cloudflare/scripts/encender-funciones.mjs), contra un wrangler DE MENTIRA.
// Nunca toca una base real ni una llave. Lo que muerde: el SQL que escribe, el escapado, la comprobación de versión,
// que verifique después de guardar, y que «--probar» no escriba nada.
import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..'); // no `process.cwd()`: estos tests deben correr desde cualquier carpeta

/** Monta un `npx` de mentira que habla como wrangler: lee de un JSON de documentos y apunta cada comando que recibe. */
function montar(docs) {
  const dir = mkdtempSync(join(tmpdir(), 'ao-func-'));
  const estado = join(dir, 'docs.json'), diario = join(dir, 'sql.txt');
  writeFileSync(estado, JSON.stringify(docs));
  writeFileSync(diario, '');
  const falso = `#!/usr/bin/env node
const fs = require('fs');
const a = process.argv.slice(2);
const i = a.indexOf('--command'), cmd = i < 0 ? '' : a[i + 1];
fs.appendFileSync(${JSON.stringify(diario)}, cmd + '\\n---\\n');
const docs = JSON.parse(fs.readFileSync(${JSON.stringify(estado)}, 'utf8'));
const des = (s) => s.replace(/''/g, "'");
if (a.includes('--json')) {
  const claves = [...cmd.matchAll(/'((?:[^']|'')*)'/g)].map((m) => des(m[1]));
  const filas = claves.filter((c) => docs[c]).map((c) => ({ clave: c, json: JSON.stringify(docs[c].valor), version: docs[c].versionLeida !== undefined ? docs[c].versionLeida : docs[c].version }));
  process.stdout.write('ruido antes\\n' + JSON.stringify([{ results: filas, success: true, meta: {} }]) + '\\nruido despues\\n');
  process.exit(0);
}
// escrituras: un update con versión, o un insert
let m = cmd.match(/^update docs set json = '((?:[^']|'')*)', version = version \\+ 1, actualizado = '[^']*' where clave = '((?:[^']|'')*)' and version = (\\d+)$/);
if (m) { const [, j, clave, v] = m; const d = docs[clave]; if (d && d.version === Number(v)) { d.valor = JSON.parse(des(j)); d.version++; } }
else if ((m = cmd.match(/^insert into docs \\(clave, json, version, actualizado\\) values \\('((?:[^']|'')*)', '((?:[^']|'')*)', 1, '[^']*'\\)$/))) {
  docs[des(m[1])] = { valor: JSON.parse(des(m[2])), version: 1 };
}
fs.writeFileSync(${JSON.stringify(estado)}, JSON.stringify(docs));
`;
  const bin = join(dir, 'npx');
  writeFileSync(bin, falso); chmodSync(bin, 0o755);
  return {
    dir,
    correr: (args) => execFileSync('node', [join(RAIZ, 'cloudflare/scripts/encender-funciones.mjs'), '--local', ...args], { cwd: join(RAIZ, 'cloudflare'), encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, GITHUB_STEP_SUMMARY: '' } }),
    docs: () => JSON.parse(readFileSync(estado, 'utf8')),
    sql: () => readFileSync(diario, 'utf8'),
  };
}

test('enciende las listas y escribe los dos documentos de ajustes', () => {
  const m = montar({ ajustes: { valor: { name: 'PanaClaw', costs: { monthlyBudget: 50 } }, version: 7 }, 'config-local': { valor: { name: 'PanaClaw' }, version: 3 } });
  const salida = m.correr(['--funciones=listas']);
  const d = m.docs();
  assert.strictEqual(d.ajustes.valor.dimitri.seriesNube, true);
  assert.strictEqual(d.ajustes.valor.sesion.deslizante, true);
  assert.strictEqual(d.ajustes.valor.acceso.retroceso, true);
  assert.strictEqual(d['config-local'].valor.dimitri.seriesNube, true, 'el espejo que lee la sesión no se escribió');
  assert.strictEqual(d.ajustes.valor.costs.monthlyBudget, 50, 'se llevó por delante el presupuesto');
  assert.strictEqual(d.ajustes.version, 8, 'no subió la versión una sola vez');
  assert.strictEqual(d['chat.config'].valor.activo, true, 'el chat vive en su propio documento');
  assert.strictEqual(d['estudio.config'].valor.carpetasArbol, true);
  assert.strictEqual(d['estudio.config'].valor.lotesNube, true);
  assert.match(salida, /ENCENDIDA/);
  assert.ok(!/retoques/i.test(salida.split('Listo:')[0]) || /no se encendió/.test(salida), 'los retoques no deben encenderse por «listas»');
});

test('el update lleva la versión que se leyó: no pisa lo que otro guardó', () => {
  const m = montar({ ajustes: { valor: {}, version: 12 }, 'config-local': { valor: {}, version: 4 } });
  m.correr(['--funciones=series-nube']);
  assert.match(m.sql(), /where clave = 'ajustes' and version = 12/);
  assert.match(m.sql(), /where clave = 'config-local' and version = 4/); // secrets-ok: «clave» es la columna de la tabla docs, no una contraseña
});

test('si otro lo cambió entre medias, falla y lo dice, sin dejar nada a medias', () => {
  // la lectura dice versión 2, pero la base ya está en 9 (otro guardó entre medias): el update no toca ninguna fila
  const m = montar({ 'chat.config': { valor: { activo: false }, version: 9, versionLeida: 2 } });
  let fallo = null;
  try { m.correr(['--funciones=chat']); } catch (e) { fallo = e; }
  assert.ok(fallo, 'no falló cuando el guardado no se aplicó');
  assert.match(String(fallo.stdout || '') + String(fallo.stderr || ''), /alguien lo cambió|vuelve a lanzarlo/);
  assert.strictEqual(m.docs()['chat.config'].valor.activo, false, 'quedó escrito a medias');
});

test('«--probar» no escribe nada', () => {
  const m = montar({ ajustes: { valor: {}, version: 1 }, 'config-local': { valor: {}, version: 1 } });
  const salida = m.correr(['--funciones=todas', '--probar']);
  assert.match(salida, /solo es una prueba/);
  assert.deepStrictEqual(m.docs().ajustes.valor, {}, 'escribió con --probar');
  assert.ok(!/update docs set/.test(m.sql()), 'mandó un update con --probar');
});

test('«--apagar» las deja apagadas', () => {
  const m = montar({ 'chat.config': { valor: { activo: true, otra: 'cosa' }, version: 1 } });
  m.correr(['--funciones=chat', '--apagar']);
  const c = m.docs()['chat.config'].valor;
  assert.strictEqual(c.activo, false);
  assert.strictEqual(c.otra, 'cosa', 'se llevó por delante lo que había al lado');
});

test('lo que no está construido no entra por «todas», pero sí nombrándolo', () => {
  const a = montar({ ajustes: { valor: {}, version: 1 }, 'config-local': { valor: {}, version: 1 } });
  const salida = a.correr(['--funciones=todas']);
  assert.match(salida, /no se encendió/);
  assert.notStrictEqual(a.docs()['estudio.config']?.valor?.retoquesNube, true, '«todas» encendió algo sin probar');
  const b = montar({ 'estudio.config': { valor: {}, version: 1 } });
  b.correr(['--funciones=retoques-nube']);
  assert.strictEqual(b.docs()['estudio.config'].valor.retoquesNube, true, 'nombrándola, sí se enciende');
});

test('al encender el chat, todas las cuentas quedan en #general', () => {
  const m = montar({ 'chat.config': { valor: { activo: false }, version: 1 } });
  m.correr(['--funciones=chat']);
  assert.match(m.sql(), /insert or ignore into chat_canales/);
  assert.match(m.sql(), /insert or ignore into chat_miembros/);
});

test('un nombre con comilla no rompe el SQL', () => {
  const m = montar({ ajustes: { valor: { name: "D'CASA" }, version: 1 }, 'config-local': { valor: { name: "D'CASA" }, version: 1 } });
  m.correr(['--funciones=series-nube']);
  assert.strictEqual(m.docs().ajustes.valor.name, "D'CASA", 'el escapado se comió la comilla');
  assert.strictEqual(m.docs().ajustes.valor.dimitri.seriesNube, true);
});
