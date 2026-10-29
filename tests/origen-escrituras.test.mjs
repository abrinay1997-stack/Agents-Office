// SEG-03 (fase 0a): el servidor local no acepta escrituras con `Origin: null`, de otro sitio, ni con un cuerpo vacío disfrazado; la propia página y los procesos de esta máquina siguen pudiendo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rechazoDeEscritura as r } from '../origen-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'localhost:4520';
const JSON_H = { 'content-type': 'application/json' };

test('puro: Origin null, otro origen y Sec-Fetch-Site ajeno se rechazan; el mismo origen y los procesos sin cabeceras de navegador pasan', () => {
  assert.equal(r({ origin: 'null', ...JSON_H, 'content-length': '2' }, HOST), 'origin', 'Origin: null con JSON');
  assert.equal(r({ origin: 'null', 'content-length': '0' }, HOST), 'origin', 'Origin: null sin cuerpo (antes se saltaba)');
  assert.equal(r({ origin: 'http://evil.test', ...JSON_H }, HOST), 'origin');
  assert.equal(r({ origin: 'http://localhost:9999', ...JSON_H }, HOST), 'origin', 'otro puerto de localhost es otro origen');
  assert.equal(r({ origin: 'no es una url', ...JSON_H }, HOST), 'origin');
  assert.equal(r({ ...JSON_H, 'sec-fetch-site': 'cross-site' }, HOST), 'origin', 'el navegador dice que viene de fuera aunque no mande Origin');
  assert.equal(r({ ...JSON_H, 'sec-fetch-site': 'same-site' }, HOST), 'origin');
  assert.equal(r({ origin: `http://${HOST}`, ...JSON_H, 'sec-fetch-site': 'same-origin' }, HOST), '');
  assert.equal(r({ ...JSON_H }, HOST), '', 'un proceso local (MCP, script, Telegram) no manda cabeceras de navegador');
});

test('puro: cuerpo vacío o con tipo ajeno', () => {
  assert.equal(r({ origin: `http://${HOST}`, 'content-length': '0' }, HOST), '', 'la propia página, sin cuerpo');
  assert.equal(r({ 'content-length': '0' }, HOST), '', 'un proceso local, sin cuerpo');
  assert.equal(r({ 'content-length': '0', 'sec-fetch-site': 'none' }, HOST), '', 'el usuario escribió la dirección: ok');
  assert.equal(r({ 'content-type': 'text/plain', 'content-length': '5' }, HOST), 'content-type', 'cuerpo que no es JSON');
  assert.equal(r({ 'content-type': 'application/x-www-form-urlencoded', origin: `http://${HOST}`, 'content-length': '5' }, HOST), 'content-type', 'un formulario, aunque sea del mismo origen');
  assert.equal(r({}, HOST), 'content-type', 'POST sin content-length ni tipo (como antes)');
  assert.equal(r({ origin: 'null' }, HOST, 'DELETE'), 'origin', 'DELETE con Origin null también');
  assert.equal(r({}, HOST, 'DELETE'), '', 'DELETE sin cuerpo: el tipo no se exige (como antes)');
});

test('servidor real: POST con Origin: null → 403 (con y sin cuerpo); el mismo origen y un proceso local → 200', { timeout: 60000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-origen-'));
  const probe = http.createServer(); const port = await new Promise(res => probe.listen(0, '127.0.0.1', () => res(probe.address().port))); await new Promise(res => probe.close(res));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: path.join(dir, 'brain'), AO_LOCAL_CONFIG: path.join(dir, 'local.json'), TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', CLAUDE_BIN: path.join(dir, 'no-claude.exe') };
  fs.mkdirSync(env.AO_BRAIN, { recursive: true });
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  t.after(() => { srv.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(res => setTimeout(res, 250)); }
  // fetch() de Node no deja poner Origin ni Sec-Fetch-Site a mano: se pide con node:http
  const pedir = (cab, cuerpo) => new Promise((res, rej) => {
    const q = http.request(base + '/api/notices/read', { method: 'POST', headers: { ...cab, 'content-length': String(Buffer.byteLength(cuerpo || '')) } }, rs => { rs.resume(); rs.on('end', () => res(rs.statusCode)); });
    q.on('error', rej); q.end(cuerpo || '');
  });
  assert.equal(await pedir({ origin: 'null', ...JSON_H }, '{}'), 403, 'Origin: null con cuerpo JSON');
  assert.equal(await pedir({ origin: 'null' }), 403, 'Origin: null sin cuerpo (antes pasaba)');
  assert.equal(await pedir({ origin: 'http://evil.test' }), 403);
  assert.equal(await pedir({ 'sec-fetch-site': 'cross-site' }), 403);
  assert.equal(await pedir({ origin: base }), 200, 'la propia página, sin cuerpo');
  assert.equal(await pedir({ ...JSON_H }, '{}'), 200, 'un proceso local con JSON');
  assert.equal(await pedir({}), 200, 'un proceso local sin cuerpo');
  assert.match(log, /refused POST \/api\/notices\/read \(origin/);
});
