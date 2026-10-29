// Fase 4 D con workerd de verdad (wrangler dev --local): el Worker ARRANCA con el retoque importado y, si el binding IMAGES local sabe devolver píxeles crudos,
// un retoque todo-local corre de punta a punta. Lo que el binding LOCAL de wrangler haga NO prueba al de Cloudflare en producción: si contesta que no sabe, el test
// lo apunta (no falla) y el hallazgo queda en docs/plan-estado/carril-d.md. Se salta sin wrangler.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hayWrangler, levantar, entrar } from './vivo-ayudas.mjs';

const SALTAR = hayWrangler();
let sharp = null; try { sharp = (await import('sharp')).default; } catch { /* sin sharp */ }
const ANA = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'ana@panaclaw.test', rol: 'admin', nombre: 'Ana', color: '#1E6FD9' };
let o, c;
const api = (ruta, { metodo = 'GET', cuerpo } = {}) => fetch(o.base + ruta, { method: metodo, headers: { cookie: c, ...(cuerpo ? { 'content-type': 'application/json' } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => null) }));
before(async () => { if (SALTAR || !sharp) return; o = await levantar({ usuarios: [ANA] }); c = await entrar(o.base, ANA.email); }, { timeout: 240000 });
after(async () => { await o?.cerrar(); });

test('el Worker real arranca con los retoques importados; encendido, lista los que sí y un retoque todo-local corre (o dice por qué no)', { skip: SALTAR || (sharp ? false : 'sin sharp para hacer la foto de prueba'), timeout: 200000 }, async (t) => {
  assert.equal((await api('/api/media/limites', { metodo: 'PUT', cuerpo: { retoquesNube: true } })).status, 200);
  const l = await api('/api/media/presets?medio=image');
  assert.equal(l.status, 200);
  const clara = l.j.presets.find((p) => p.id === 'luz-mas-clara'); assert.equal(clara.on, true, 'con el interruptor y el binding IMAGES de wrangler, el preset está disponible');
  assert.equal(l.j.presets.find((p) => p.id === 'enc-distancia').on, false);
  const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#555555' } }).png().toBuffer();
  const up = await api('/api/media/upload', { metodo: 'POST', cuerpo: { name: 'bodega', data: 'data:image/png;base64,' + png.toString('base64') } });
  assert.equal(up.status, 200, JSON.stringify(up.j));
  const r = await api('/api/media/presets/apply', { metodo: 'POST', cuerpo: { pila: ['luz-mas-clara'], entradas: { foto: [up.j.item.file] } } });
  if (r.status !== 200) { t.diagnostic('HALLAZGO: el binding IMAGES de wrangler dev --local no sirvió para retocar: ' + JSON.stringify(r.j).slice(0, 300)); assert.match(String(r.j?.error), /imagen|píxeles|retocar/i); return; }
  assert.equal(r.j.jobs[0].state, 'done'); t.diagnostic('el binding local de wrangler devolvió píxeles crudos y el retoque corrió de punta a punta');
});
