// Fase 6 — Los scripts de ayuda: el webhook de Telegram no imprime ni manda un secreto de más, y subir-documento convierte aquí y sube texto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { conectar, direccion } from '../scripts/telegram-webhook.mjs';
import { subir } from '../scripts/subir-documento.mjs';

const TOKEN = '123456789:AAFakeTokenFakeTokenFakeTokenFake_abc', SECRETO = 'secreto-del-webhook-de-prueba-123'; // secrets-ok: de mentira

test('telegram-webhook: solo https, secreto largo, y el error nunca lleva el token', async () => {
  assert.equal(direccion('https://a.workers.dev/algo'), 'https://a.workers.dev/api/telegram/webhook');
  assert.throws(() => direccion('http://a.com'));
  const vistos = [];
  const ok = async (url, init) => { vistos.push({ url: String(url), cuerpo: JSON.parse(init.body) }); return new Response(JSON.stringify({ ok: true, result: true })); };
  assert.equal(await conectar('https://a.workers.dev', { token: TOKEN, secreto: SECRETO, fetchFn: ok }), 'https://a.workers.dev/api/telegram/webhook');
  assert.equal(vistos[0].cuerpo.secret_token, SECRETO); assert.deepEqual(vistos[0].cuerpo.allowed_updates, ['message', 'callback_query']); assert.ok(vistos[0].url.endsWith('/setWebhook'));
  await assert.rejects(conectar('https://a.workers.dev', { token: TOKEN, secreto: 'corto', fetchFn: ok }), /16 caracteres/);
  await assert.rejects(conectar('https://a.workers.dev', { token: 'mal', secreto: SECRETO, fetchFn: ok }), /TELEGRAM_BOT_TOKEN/);
  const mal = async () => new Response(JSON.stringify({ ok: false, description: `Unauthorized ${TOKEN}` }), { status: 401 });
  await assert.rejects(conectar('https://a.workers.dev', { token: TOKEN, secreto: SECRETO, fetchFn: mal }), (e) => !e.message.includes(TOKEN));
});

test('subir-documento: convierte un CSV aquí y sube el texto; rechaza lo que no se puede leer', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'subdoc-')), f = path.join(dir, 'precios.csv'); fs.writeFileSync(f, 'producto,precio\nCombo,12\n');
  const llamadas = [];
  const fetchFn = async (url, init) => { llamadas.push({ url: String(url), cuerpo: init.body ? JSON.parse(init.body) : null }); return String(url).endsWith('/api/acceso') ? new Response('{}', { status: 200, headers: { 'set-cookie': 'ao=1; Path=/' } }) : new Response(JSON.stringify({ ok: true, path: 'Documentos/precios.md', chars: 40 }), { status: 200 }); };
  const j = await subir('https://a.workers.dev', f, { email: 'a@b.c', clave: 'x', fetchFn });
  assert.equal(j.ok, true); assert.match(Buffer.from(llamadas[1].cuerpo.data, 'base64').toString(), /Combo/); assert.equal(llamadas[1].cuerpo.name, 'precios.md');
  fs.writeFileSync(path.join(dir, 'a.exe'), 'MZ');
  await assert.rejects(subir('https://a.workers.dev', path.join(dir, 'a.exe'), { fetchFn }), /no se puede leer/);
});
