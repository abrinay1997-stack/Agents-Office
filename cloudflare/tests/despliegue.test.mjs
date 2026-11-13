// Comprueba que lo que se despliega es lo que se cree que se despliega (la CSP, las rutas, los secretos, las migraciones).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { elegir } from '../scripts/subir-secretos.mjs';
import { ponerId } from '../scripts/preparar-cuenta.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => readFileSync(join(RAIZ, f), 'utf8');
const quitaComentarios = (t) => t.replace(/^\s*\/\/.*$/gm, '');
const wrangler = JSON.parse(quitaComentarios(leer('wrangler.jsonc')));
const archivos = (d = RAIZ, acc = []) => { for (const f of readdirSync(d)) { if (f === 'node_modules') continue; const p = join(d, f); statSync(p).isDirectory() ? archivos(p, acc) : acc.push(p); } return acc; };

test('wrangler: todo va primero al Worker (portero), hay cron, D1 y R2', () => {
  assert.deepEqual(wrangler.assets.run_worker_first, ['/*']); // todo pasa por el portero: nada de la oficina sale sin sesión
  assert.equal(wrangler.assets.html_handling, 'none');
  assert.ok(wrangler.triggers.crons.length);
  assert.equal(wrangler.d1_databases[0].binding, 'DB');
  assert.equal(wrangler.r2_buckets[0].binding, 'MEDIA');
  assert.equal(wrangler.workers_dev, true);
});

test('ningún secreto va en wrangler.jsonc ni en el código: solo nombres', () => {
  const formatos = [new RegExp('sk-' + 'ant-[A-Za-z0-9_-]{20,}'), new RegExp('\\b(ghp' + '_|github' + '_pat_)[A-Za-z0-9_]{30,}'), new RegExp('\\b[a-f0-9]{40}\\b.*(?:cloudflare|token)', 'i')];
  for (const f of archivos().filter((x) => /\.(js|mjs|json|jsonc|html|sql|md)$/.test(x))) {
    const t = readFileSync(f, 'utf8');
    for (const re of formatos) assert.ok(!re.test(t), `${f} parece contener una clave`);
  }
  assert.ok(!Object.keys(wrangler.vars).some((k) => /KEY|SECRET|TOKEN|PASSWORD/i.test(k)));
});

test('la CSP: el acceso y el panel son estrictos; solo la oficina real admite scripts en línea, y ninguna habla con terceros', () => {
  const h = leer('public/_headers');
  const bloques = Object.fromEntries(h.split(/\n(?=\/)/).map((b) => [b.split('\n')[0].trim(), b]));
  for (const ruta of ['/login.html', '/panel.html', '/oficina/*']) {
    assert.ok(bloques[ruta], `falta el bloque de ${ruta}`);
    assert.match(bloques[ruta], /connect-src 'self'/); assert.match(bloques[ruta], /frame-ancestors 'none'/);
  }
  for (const ruta of ['/login.html', '/panel.html']) assert.ok(!/script-src[^;]*unsafe-inline/.test(bloques[ruta]), `${ruta} sin scripts en línea`);
  assert.ok(!/default-src[^;]*\*|script-src[^;]*https?:/.test(h), 'ningún origen de fuera');
  // las imágenes de Meta van por /api/imagen-meta: img-src nunca suma un host de terceros; y el único marco permitido es la vista previa de anuncios de Meta, con su ruta exacta
  const ofi = bloques['/oficina/*'], dir = (n) => (new RegExp(`${n} ([^;]*)`).exec(ofi) || [])[1];
  assert.equal(dir('img-src'), "'self' data: blob:"); assert.equal(dir('frame-src'), 'https://www.facebook.com/ads/api/preview_iframe.php');
  for (const d of ['connect-src', 'script-src', 'style-src', 'font-src', 'media-src']) assert.ok(!/https?:/.test(dir(d) || ''), `${d} sin hosts de fuera`);
  for (const f of ['login.html', 'panel.html']) assert.ok(!/<script>[^<]/.test(leer('public/' + f)), `${f} sin scripts en línea`);
});

test('todo secreto que lee el Worker (env.X) está declarado en secretos.json', () => {
  const cfg = JSON.parse(leer('secretos.json'));
  const declarados = new Set([...cfg.obligatorios, ...cfg.opcionales]);
  const vars = new Set(Object.keys(wrangler.vars));
  const propios = new Set(['DB', 'ASSETS', 'MEDIA', 'HUB', 'AI', 'RELOJ_MS', 'MCP_BITACORA_SINK', 'FETCH_IMAGEN_META', 'FETCH_ICONO_CONECTOR']); // AI: el binding de Workers AI que lee lib/significado.js (opcional: sin él se usan las llaves de Gemini, OpenAI o Voyage, y sin nada la búsqueda sigue por palabras; aún no está declarado en wrangler.jsonc). RELOJ_MS y FETCH_IMAGEN_META: solo los pone una prueba (el reloj de los topes de acceso; el `fetch` del proxy de imágenes de Meta)
  for (const f of archivos(join(RAIZ, 'worker')).filter((x) => x.endsWith('.js'))) {
    for (const m of leer(f.slice(RAIZ.length + 1)).matchAll(/\benv\.([A-Z][A-Z0-9_]+)/g))
      assert.ok(declarados.has(m[1]) || vars.has(m[1]) || propios.has(m[1]), `${f}: env.${m[1]} no está en secretos.json`);
  }
});

test('subir-secretos: toma lo declarado y los MCP_*, ignora el resto, avisa de los obligatorios', () => {
  const cfg = JSON.parse(leer('secretos.json'));
  const r = elegir({ ANTHROPIC_API_KEY: 'a', MCP_GMAIL_TOKEN: 'b', CLOUDFLARE_API_TOKEN: 'no', ADMIN_PASSWORD: 'no', META_API_KEY: '' }, cfg);
  assert.deepEqual(Object.keys(r.salida).sort(), ['ANTHROPIC_API_KEY', 'MCP_GMAIL_TOKEN']);
  assert.deepEqual(elegir({}, cfg).faltan, ['ANTHROPIC_API_KEY']);
});

// 0302 (SEG-02, dominios por conector): la primera migración con `alter table add column`. Se aplica una sola vez por wrangler; la D1 de una cuenta nueva la recibe en orden. Aplicarla a mano dos veces falla.
const ALTER_PERMITIDOS = new Set(['0302_conectores_dominios.sql']);

test('preparar-cuenta escribe el database_id y las migraciones son reaplicables', () => {
  assert.match(ponerId(leer('wrangler.jsonc'), 'abc-123'), /"database_id": "abc-123"/);
  for (const f of readdirSync(join(RAIZ, 'migraciones'))) {
    const sql = leer(`migraciones/${f}`);
    for (const m of sql.matchAll(/create\s+(table|index)\s+(?!if not exists)/gi)) assert.fail(`${f}: «${m[0]}» sin if not exists`);
    // SQLite no tiene `add column if not exists`: un `alter table … add column` NO es reaplicable a mano. Solo vale si wrangler lo aplica una vez (d1_migrations) y está aquí, explícito.
    for (const m of sql.matchAll(/alter\s+table\s+\w+\s+add\s+column/gi)) assert.ok(ALTER_PERMITIDOS.has(f), `${f}: «${m[0]}» no es reaplicable; si de verdad hace falta, añádelo a ALTER_PERMITIDOS con su motivo`);
  }
});

test('el workflow de despliegue verifica antes de publicar y nunca imprime secretos', () => {
  const w = readFileSync(join(RAIZ, '..', '.github/workflows/cloudflare-desplegar.yml'), 'utf8');
  assert.ok(w.indexOf('node --test') < w.indexOf('npx wrangler deploy\n'), 'los tests van antes del despliegue');
  assert.ok(w.indexOf('copiar-oficina.mjs') < w.indexOf('npx wrangler deploy\n'), 'la interfaz se copia antes de desplegar');
  assert.ok(w.indexOf('migrations apply') < w.indexOf('npx wrangler deploy\n'), 'las migraciones van antes del código');
  assert.ok(w.lastIndexOf('scripts/semilla.mjs') < w.indexOf('npx wrangler deploy\n') && w.indexOf('scripts/semilla.mjs') < w.indexOf('npx wrangler deploy --dry-run'), 'la semilla «PanaClaw por defecto» se genera antes de desplegar (y se prueba en el simulacro)');
  assert.ok(/paths:[^\n]*brain-panaclaw\/\*\*[^\n]*biblioteca\/\*\*/.test(w), 'cambiar las notas de fábrica o la Biblioteca vuelve a desplegar');
  assert.ok(w.includes('subir-secretos.mjs'), 'los secretos se suben');
  assert.ok(!/echo.*secrets\./.test(w));
});

test('worker/index.js exporta el handler por defecto y SOLO la clase del Durable Object (workerd rechaza cualquier otra constante exportada)', () => {
  const t = quitaComentarios(leer('worker/index.js'));
  assert.ok(!/^export\s+(const|let|var|function|class)\b/m.test(t));
  const salidas = t.match(/^export\s.*$/gm) || [];
  assert.equal(salidas.length, 2);
  assert.ok(salidas.some((l) => /^export default\b/.test(l)));
  assert.ok(salidas.some((l) => /^export\s*\{\s*Hub\s*\}\s*from\s*'\.\/hub\.js'/.test(l)), 'la clase Hub se reexporta desde el módulo main');
});

test('el Durable Object Hub: binding HUB y migración con new_sqlite_classes (new_classes pediría plan de pago)', () => {
  assert.deepEqual(wrangler.durable_objects.bindings, [{ name: 'HUB', class_name: 'Hub' }]);
  const mig = wrangler.migrations;
  assert.ok(mig.length && mig.every((x) => !x.new_classes), 'ninguna migración usa new_classes');
  assert.ok(mig.some((x) => (x.new_sqlite_classes || []).includes('Hub')));
  assert.match(leer('worker/hub.js'), /acceptWebSocket/); // hibernación
  assert.doesNotMatch(leer('worker/hub.js').replace(/\/\/.*$/gm, ''), /\.accept\(\)/);
});

test('inventario: lista los grupos que usa la interfaz y marca los portados', async () => {
  const { gruposUsados } = await import('../scripts/inventario.mjs');
  const g = gruposUsados("fetch('/api/brain'); fetch(`/api/note/x`); fetch('/api/brain/graph')");
  assert.deepEqual([...g], [['brain', 2], ['note', 1]]);
  const { PORTADAS } = await import('../worker/lib/portadas.js');
  assert.ok(PORTADAS.includes('health'));
});
