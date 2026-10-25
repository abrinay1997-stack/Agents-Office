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

test('wrangler: /api/* va primero al Worker, hay cron, D1 y R2', () => {
  assert.deepEqual(wrangler.assets.run_worker_first, ['/api/*']);
  assert.equal(wrangler.assets.not_found_handling, 'single-page-application');
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

test('la CSP de la página es estricta y la API no se abre a terceros', () => {
  const h = leer('public/_headers');
  assert.match(h, /connect-src 'self'/); assert.match(h, /frame-ancestors 'none'/);
  assert.ok(!/script-src[^;]*unsafe-inline/.test(h));
  assert.ok(!/<script>[^<]/.test(leer('public/index.html')), 'sin scripts en línea');
});

test('todo secreto que lee el Worker (env.X) está declarado en secretos.json', () => {
  const cfg = JSON.parse(leer('secretos.json'));
  const declarados = new Set([...cfg.obligatorios, ...cfg.opcionales]);
  const vars = new Set(Object.keys(wrangler.vars));
  const propios = new Set(['DB', 'ASSETS', 'MEDIA']);
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

test('preparar-cuenta escribe el database_id y las migraciones son reaplicables', () => {
  assert.match(ponerId(leer('wrangler.jsonc'), 'abc-123'), /"database_id": "abc-123"/);
  for (const f of readdirSync(join(RAIZ, 'migraciones'))) {
    const sql = leer(`migraciones/${f}`);
    for (const m of sql.matchAll(/create\s+(table|index)\s+(?!if not exists)/gi)) assert.fail(`${f}: «${m[0]}» sin if not exists`);
  }
});

test('el workflow de despliegue verifica antes de publicar y nunca imprime secretos', () => {
  const w = readFileSync(join(RAIZ, '..', '.github/workflows/cloudflare-desplegar.yml'), 'utf8');
  assert.ok(w.indexOf('npm test') < w.indexOf('wrangler deploy'), 'los tests van antes del despliegue');
  assert.ok(w.indexOf('migrations apply') < w.indexOf('wrangler deploy'), 'las migraciones van antes del código');
  assert.ok(w.includes('subir-secretos.mjs'), 'los secretos se suben');
  assert.ok(!/echo.*secrets\./.test(w));
});

test('worker/index.js solo exporta el handler por defecto (workerd rechaza otras constantes exportadas)', () => {
  const t = leer('worker/index.js');
  assert.ok(!/^export\s+(const|let|var|function|class)\b/m.test(t));
  assert.equal((t.match(/^export\s/gm) || []).length, 1);
});
