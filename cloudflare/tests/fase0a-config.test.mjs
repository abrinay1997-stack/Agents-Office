// Fase 0a (plan del 29 oct 2026): CON-01 (binding IMAGES), SEG-08 (HSTS), WEB-06 (Permissions-Policy, COOP, Trusted Types solo para medir) y PER-01 (la página no pierde su ETag ni se re-comprime a mano).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';
import { conCabecerasGlobales, CABECERAS_GLOBALES, json } from '../worker/lib/respuesta.js';
import { aJpegDeEnv } from '../worker/lib/contenido/conductores.js';
import { avisoDeFormato } from '../worker/modulos/contenido.js';
import { manejar } from '../worker/lib/rutas.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => readFileSync(join(RAIZ, f), 'utf8');
const sinComentarios = t => t.replace(/^\s*\/\/.*$/gm, '');

test('CON-01: wrangler.jsonc declara el binding IMAGES (el código lo lee con env["IMAGES"])', () => {
  const w = JSON.parse(sinComentarios(leer('wrangler.jsonc')));
  assert.deepEqual(w.images, { binding: 'IMAGES' });
});

test('CON-01: aJpegDeEnv convierte con el binding (éxito), dice qué hacer sin él y traduce el fallo del binding', async () => {
  const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const visto = [];
  const IMAGES = { input: () => ({ transform: t => { visto.push(t); return { output: async o => { visto.push(o); return { response: () => new Response(JPEG) }; } }; } }) };
  const salida = await aJpegDeEnv({ IMAGES })(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]));
  assert.deepEqual([...salida], [...JPEG]); assert.equal(visto[0].background, '#ffffff', 'la transparencia va sobre blanco'); assert.equal(visto[1].format, 'image/jpeg');
  await assert.rejects(aJpegDeEnv({})(new Uint8Array(4)), /falta el binding IMAGES/);
  const roto = { input: () => ({ transform: () => ({ output: async () => { throw new Error('formato no soportado'); } }) }) };
  await assert.rejects(aJpegDeEnv({ IMAGES: roto })(new Uint8Array(4)), /no pude convertir la imagen a JPEG: formato no soportado/);
});

test('CON-01/13: al aprobar avisa, archivo por archivo, de CUALQUIER imagen que no sea JPEG (convertible o no), sin depender del binding', () => {
  const pz = medios => ({ redes: ['instagram'], medios });
  assert.equal(avisoDeFormato(pz(['2026-10/a.jpg', '2026-10/b.JPEG', '2026-10/c.mp4']), false), null, 'JPEG y video: nada que decir');
  for (const f of ['png', 'webp']) { assert.match(avisoDeFormato(pz([`2026-10/x.${f}`]), false), /binding IMAGES/, f); assert.match(avisoDeFormato(pz([`2026-10/x.${f}`]), true), /se convertirá a JPEG/, f); }
  for (const f of ['gif', 'heic', 'avif', 'bmp']) assert.match(avisoDeFormato(pz([`2026-10/x.${f}`]), true), /no sé convertirla/, f);
  assert.match(avisoDeFormato(pz(['2026-10/x.svg']), true), /SVG/);
  assert.equal(avisoDeFormato({ redes: ['facebook'], medios: ['2026-10/x.gif'] }, false), null, 'solo importa si va a Instagram');
});

test('SEG-08 / WEB-06: toda respuesta del Worker lleva HSTS, Permissions-Policy con microphone=(self) y COOP; un socket no se toca', async () => {
  for (const r of [json({ ok: 1 }), json({ error: 'x' }, 500), new Response('<html>', { headers: { 'content-type': 'text/html' } }), Response.redirect('https://x.test/', 302)]) {
    const c = conCabecerasGlobales(r);
    assert.match(c.headers.get('strict-transport-security'), /max-age=31536000/);
    assert.match(c.headers.get('permissions-policy'), /microphone=\(self\)/); assert.match(c.headers.get('permissions-policy'), /camera=\(\)/);
    assert.equal(c.headers.get('cross-origin-opener-policy'), 'same-origin');
  }
  const con = new Response('x', { headers: { 'Strict-Transport-Security': 'max-age=1' } });
  assert.equal(conCabecerasGlobales(con).headers.get('strict-transport-security'), 'max-age=1', 'lo que ya traía no se pisa');
  const socket = { status: 101, headers: new Headers(), webSocket: {} };
  assert.equal(conCabecerasGlobales(socket), socket);
  assert.deepEqual(Object.keys(CABECERAS_GLOBALES).length, 3);
});

test('SEG-08 / WEB-06: index.js aplica las cabeceras a todo, y _headers las repite para lo que sirve Static Assets; Trusted Types solo en report-only y solo en la oficina', () => {
  assert.match(sinComentarios(leer('worker/index.js')), /conCabecerasGlobales\(await manejar/);
  const h = leer('public/_headers'), bloques = {}; let ruta = null;
  for (const l of h.split('\n')) { if (/^\S/.test(l) && !l.startsWith('#')) { ruta = l.trim(); bloques[ruta] = ''; } else if (ruta) bloques[ruta] += l + '\n'; }
  assert.match(bloques['/*'], /Strict-Transport-Security: max-age=31536000; includeSubDomains/);
  assert.match(bloques['/*'], /Permissions-Policy: [^\n]*microphone=\(self\)/); assert.match(bloques['/*'], /Cross-Origin-Opener-Policy: same-origin/);
  assert.ok(!/preload/i.test(h), 'HSTS sin preload: es irreversible');
  assert.match(bloques['/oficina/*'], /Content-Security-Policy-Report-Only: require-trusted-types-for 'script'/);
  assert.ok(!/(^|\n)\s*Content-Security-Policy: [^\n]*require-trusted-types/.test(h), 'Trusted Types NO se activa en firme');
  for (const [r, b] of Object.entries(bloques)) if (r !== '/oficina/*') assert.ok(!/trusted-types/.test(b), `${r} sin Trusted Types`);
  assert.ok(!/^[ \t]+#/m.test(h), 'los comentarios de _headers van en columna 0');
});

test('PER-01: la página de la oficina conserva un ETag propio (y contesta 304), no pone Content-Encoding por su cuenta y la API tampoco', { skip: SALTAR }, async () => {
  const d1 = crearD1(); const c = await sembrar(d1);
  const env = envDePrueba(d1, { ASSETS: { fetch: async () => new Response('<html><body>hola</body></html>', { headers: { 'content-type': 'text/html', etag: '"abc123"', 'cache-control': 'private, no-cache' } }) } });
  const ck = (await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: c.email, contrasena: c.clave } })).headers.get('set-cookie').split(';')[0];
  const r = await pedir(manejar, env, '/', { cookie: ck });
  const etag = r.headers.get('etag');
  assert.match(etag, /^W\/"abc123-nube2"$/); assert.ok(!r.headers.get('content-encoding'), 'la compresión la pone Cloudflare, no el Worker');
  const r2 = await manejar(new Request('https://oficina.test/', { headers: { cookie: ck, 'if-none-match': etag } }), env);
  assert.equal(r2.status, 304);
  assert.ok(!(await pedir(manejar, env, '/api/health')).headers.get('content-encoding'));
});

test('PER-01 / SEG-08: la prueba viva de después del despliegue comprueba HSTS, permisos, COOP y la compresión', () => {
  const p = leer('scripts/prueba-viva.mjs');
  for (const t of ['strict-transport-security', 'permissions-policy', 'cross-origin-opener-policy', 'content-encoding']) assert.ok(p.includes(t), t);
});
