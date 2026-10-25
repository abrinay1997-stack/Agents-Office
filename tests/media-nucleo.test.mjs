// El núcleo del Estudio sin disco ni entorno (25 oct 2026, fase 8a del puerto a Cloudflare): lo que la oficina local y la nube comparten.
// media/galeria-core.mjs · media/trabajos-core.mjs · media/motores-core.mjs. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { sniffExt, nombreBase, zipFiles, slug, FILE_RE } from '../media/galeria-core.mjs';
import { usageOf, spendOn, budgetOf, checkBudgetOf, weightOf } from '../media/trabajos-core.mjs';
import { crearMotores, Pendiente } from '../media/motores-core.mjs';
import * as catalogo from '../media/catalogo.mjs';
import { S } from '../media/estado.mjs';

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.alloc(40)]);
const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom'), Buffer.alloc(40)]);

test('un archivo se reconoce por sus primeros bytes, no por lo que diga; un SVG solo si se permite', () => {
  assert.equal(sniffExt(png), 'png'); assert.equal(sniffExt(mp4), 'mp4');
  assert.equal(sniffExt(Buffer.from('<html><script>1</script></html>')), null);
  assert.equal(sniffExt(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  assert.equal(sniffExt(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), { svg: true }), 'svg');
  assert.equal(sniffExt(Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00')), 'mp3');
});

test('el nombre de un archivo: fecha y hora del dueño, el prompt sin acentos, y la clave que valida la galería', () => {
  const { sub, base } = nombreBase({ y: 2026, mo: 10, d: 5, h: 9, mi: 3, s: 7 }, 'Árbol de Navidad ¡grande!');
  assert.equal(sub, '2026-10'); assert.equal(base, '2026-10-05 arbol-de-navidad-grande 090307');
  assert.ok(FILE_RE.test(`${sub}/${base}.png`)); assert.ok(!FILE_RE.test('../x.png')); assert.equal(slug(''), 'imagen');
});

test('un .zip sin comprimir lleva todos sus archivos', () => {
  const z = zipFiles([{ name: 'a.png', data: png }, { name: 'b.mp4', data: mp4 }], new Date(2026, 9, 25, 10, 0, 0));
  assert.equal(z.count, 2); assert.equal(z.buf.readUInt32LE(0), 0x04034b50);
  assert.equal(z.buf.readUInt16LE(z.buf.length - 22 + 10), 2, 'dos entradas en el directorio central');
});

test('el presupuesto: el día y el mes, lo reservado por lo que sigue en marcha, y las palabras al pasarse', () => {
  const u = spendOn(usageOf(null, '2026-10-25'), 'images', 3, 0.2); assert.equal(u.images, 3); assert.equal(u.monthCost, 0.2);
  assert.equal(usageOf(u, '2026-10-26').images, 0, 'otro día, el conteo empieza; el mes sigue'); assert.equal(usageOf(u, '2026-10-26').monthCost, 0.2);
  assert.equal(usageOf(u, '2026-11-01').monthCost, 0, 'otro mes, de cero');
  const b = budgetOf(u, [{ state: 'running', engine: 'gemini', kind: 'image', weight: 2, items: [], unit: 0.1, n: 2 }], { dailyLimit: 10, dailyBudget: 1, monthlyBudget: 0, maxPerRequest: 8 });
  assert.equal(b.left, 5); assert.equal(b.costReserved, 0.2); assert.equal(b.costLeftDay, 0.6); assert.equal(b.costLeftMonth, null);
  assert.throws(() => checkBudgetOf(0.7, b), /presupuesto del día del Estudio/); assert.doesNotThrow(() => checkBudgetOf(0.6, b));
  assert.equal(weightOf('video', 2), 10); assert.equal(weightOf('music', 1), 3);
});

test('los motores en modo «paso» (la nube): un motor con cola envía UNA vez y las demás veces solo pregunta', async () => {
  const keep = S.cfg; S.cfg = { dailyLimit: 40, maxPerRequest: 8, models: {} };
  catalogo.setEnv({ FAL_KEY: 'f-prueba', AO_FAL_QUEUE: 'https://cola.example' });
  const m = catalogo.models().find((x) => x.engine === 'fal' && x.kind === 'video'), full = catalogo.model(m.id);
  const llamadas = []; let preguntas = 0;
  const fetchFalso = async (url, o = {}) => {
    llamadas.push(`${o.method || 'GET'} ${url}`);
    const json = (b) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
    if (o.method === 'POST') return json({ request_id: 'r1', status_url: 'https://cola.example/s', response_url: 'https://cola.example/r', cancel_url: 'https://ajeno.example/c' });
    if (url === 'https://cola.example/s') return json({ status: ++preguntas < 3 ? 'IN_PROGRESS' : 'COMPLETED' });
    if (url === 'https://cola.example/r') return json({ video: { url: 'https://cola.example/v.mp4' } });
    return new Response(mp4, { status: 200, headers: { 'content-type': 'video/mp4' } });
  };
  const job = { id: 'j1', prompt: 'x', n: 1, s: { aspectRatio: '16:9', duration: 5 }, media: {}, startedAt: Date.now(), items: [] };
  const guardados = []; const ctx = { save: async () => {}, add: async (buf, ext) => { guardados.push([buf.length, ext]); } };
  const { RUN } = crearMotores({ env: () => ({ FAL_KEY: 'f-prueba', AO_FAL_QUEUE: 'https://cola.example' }), paso: true, fetch: fetchFalso, inputFiles: async () => ({ start: [], end: [], reference: [], video: [], audio: [] }), item: async () => null, update: async () => null });
  let pendientes = 0;
  for (let i = 0; i < 5 && !job.remote?.every((r) => r.done); i++) { try { await RUN.fal(full, job, ctx); } catch (e) { if (!e.pendiente) throw e; assert.ok(e instanceof Pendiente); pendientes++; } }
  assert.equal(llamadas.filter((l) => l.startsWith('POST')).length, 1, 'se envió una sola vez');
  assert.equal(pendientes, 2); assert.deepEqual(guardados, [[mp4.length, 'mp4']]);
  assert.equal(job.remote[0].cancel.startsWith('https://cola.example'), true, 'una dirección de cancelar que no es del servicio se cambia por la de su documentación');
  S.cfg = keep; catalogo.setEnv(null);
});
