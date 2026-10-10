// 9 oct 2026 — Analíticas por cuenta («filtrar dentro de todas las cuentas y verlas individualmente»): los datos de ejemplo con cuatro
// cuentas distintas, el resumen para los agentes (`ver_analiticas` con y sin `cuenta`), el informe del mes de una cuenta y las rutas que
// llevan la cuenta hasta ellos. Las cuentas puras (el filtro) están en tests/contenido-cifras.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { datosDeEjemplo } from '../src/analiticas-datos.js';
import { kpis, sumarDias, cuentasDe } from '../src/contenido-cifras.js';
import { resumenAnaliticas } from '../contenido/resumen-analiticas.mjs';
import { informeDelMes } from '../contenido/informe.mjs';
import { crearRutas } from '../contenido/rutas.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CUENTAS = [{ id: 'instagram:1', red: 'instagram', nombre: 'PanaClaw', usuario: 'pana.claw' }, { id: 'instagram:2', red: 'instagram', nombre: 'BukoFlow', usuario: 'bukoflow' }, { id: 'facebook:9', red: 'facebook', nombre: 'Patitasvip' }];
const fila = (cuentaId, fecha, seguidores, alcance) => ({ cuentaId, red: cuentaId.split(':')[0], fecha, seguidores, alcance, vistas: 0, interacciones: 0, visitas: 0 });
const serie = [];
for (let i = 0; i < 20; i++) { const f = sumarDias('2026-09-15', i); serie.push(fila('instagram:1', f, 1000 + i, 300), fila('instagram:2', f, 200 + i * 2, 40), fila('facebook:9', f, 500, 90)); }
const pub = (cuentaId, d, n) => ({ id: `${cuentaId}|${d}`, cuentaId, red: cuentaId.split(':')[0], tipo: 'imagen', interacciones: n, alcance: n * 10, texto: `pub ${cuentaId} ${d}`, publicadaAt: `${d}T15:00:00.000Z` });
const publicaciones = [pub('instagram:1', '2026-09-20', 80), pub('instagram:2', '2026-09-21', 30), pub('facebook:9', '2026-09-22', 12)];

test('los datos de ejemplo traen cuatro cuentas, dos de cada red, con números distintos', () => {
  const d = datosDeEjemplo('2026-10-09'), cs = d.meta.cuentas;
  assert.equal(cs.length, 4); assert.equal(cuentasDe(cs, 'instagram').length, 2); assert.equal(cuentasDe(cs, 'facebook').length, 2);
  for (const c of cs) { assert.match(c.externoId, /^ejemplo-/); assert.equal(c.base, undefined, 'lo interno del generador no sale'); }
  const o = { desde: sumarDias(d.hoy, -30), hasta: d.hoy };
  const seg = cs.map(c => kpis(d, { ...o, red: c.id }).seguidores.valor);
  assert.equal(new Set(seg).size, 4, 'cada cuenta tiene sus seguidores');
  for (const c of cs) assert.ok(d.publicaciones.some(p => p.cuentaId === c.id), `${c.id} tiene publicaciones`);
});

test('ver_analiticas: sin cuenta, el total por red y una línea por cuenta; con cuenta, solo esa; una que no existe lo dice', () => {
  const datos = { serie, publicaciones, ultimaFoto: '2026-10-04' };
  const todo = resumenAnaliticas(datos, { dias: 14, hoy: '2026-10-05', cuentas: CUENTAS }).texto;
  assert.match(todo, /Instagram \(suma de 2 cuentas\): 1,2 mil seguidores|Instagram \(suma de 2 cuentas\): 1257 seguidores/);
  assert.match(todo, /Por cuenta/); assert.match(todo, /- @pana\.claw \(Instagram, «PanaClaw»\): 1019 seguidores/); assert.match(todo, /- @bukoflow \(Instagram, «BukoFlow»\): 238 seguidores/); assert.match(todo, /- Patitasvip \(Facebook\): 500 seguidores/);
  const una = resumenAnaliticas(datos, { dias: 14, hoy: '2026-10-05', cuentas: CUENTAS, cuenta: '@bukoflow' }).texto;
  assert.match(una, /solo la cuenta @bukoflow \(Instagram, «BukoFlow»\)/);
  assert.match(una, /\nInstagram: 238 seguidores/); assert.doesNotMatch(una, /Facebook|pana\.claw|Por cuenta/);
  assert.match(resumenAnaliticas(datos, { cuentas: CUENTAS, cuenta: 'nadie' }).texto, /No hay ninguna cuenta «nadie».*@pana\.claw \(Instagram, «PanaClaw»\), id instagram:1/);
});

test('el informe del mes de una cuenta: sus cifras, su red en Contenido y el título con la cuenta', () => {
  const piezas = [{ id: 'a', titulo: 'Reel', fecha: '2026-09-10', estado: 'aprobada', redes: ['instagram'], formato: 'reel' }, { id: 'b', titulo: 'Solo FB', fecha: '2026-09-11', estado: 'aprobada', redes: ['facebook'], formato: 'post' }];
  const base = { mes: '2026-09', piezas, analiticas: { serie, publicaciones }, cuentas: CUENTAS, hoy: '2026-10-05' };
  const todas = informeDelMes(base);
  assert.equal(todas.cuenta, null); assert.match(todas.texto, /\*\*Instagram \(2 cuentas\):\*\*/); assert.match(todas.texto, /- @bukoflow \(Instagram\): 230 seguidores/); assert.match(todas.texto, /— Instagram \(@pana\.claw\), imagen, 80/);
  const una = informeDelMes({ ...base, cuenta: 'instagram:2' });
  assert.equal(una.cuenta, 'instagram:2'); assert.match(una.titulo, /septiembre de 2026 · @bukoflow \(Instagram\)/);
  assert.match(una.texto, /Contenido no separa por cuenta/); assert.match(una.texto, /de 1 planificada/, 'solo lo planificado para su red');
  assert.match(una.texto, /\*\*Instagram:\*\* 230 seguidores/); assert.doesNotMatch(una.texto, /pana\.claw|Facebook:|pub instagram:1/);
  assert.match(una.texto, /«pub instagram:2 2026-09-21»/);
  assert.throws(() => informeDelMes({ ...base, cuenta: 'instagram:404' }), /esa cuenta no está/);
});

test('las rutas llevan la cuenta: el informe la valida y el resumen la pasa; ver_analiticas la manda', async () => {
  const pedidos = [];
  const json = (res, code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  const handle = crearRutas({ almacen: { listar: () => [] }, json, body: async req => { let t = ''; for await (const c of req) t += c; return t ? JSON.parse(t) : {}; },
    informe: async (mes, o) => { pedidos.push(['informe', mes, o]); return { titulo: 'x', texto: 'x' }; },
    analiticasTexto: async (dias, redes, cuenta) => { pedidos.push(['resumen', dias, cuenta]); return { texto: `cuenta=${cuenta || 'todas'}` }; } });
  const srv = http.createServer(async (req, res) => { if (!await handle(req, res, new URL(req.url, 'http://x'))) json(res, 404, {}); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const p = spawn(process.execPath, [path.join(ROOT, 'contenido-mcp.mjs')], { env: { ...process.env, AO_OFFICE: base }, stdio: ['pipe', 'pipe', 'inherit'] });
  const esperas = new Map(); let buf = '', n = 0;
  p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); esperas.get(m.id)?.(m); } });
  const rpc = (method, params) => new Promise(ok => { const id = ++n; esperas.set(id, ok); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  try {
    assert.equal((await fetch(base + '/api/contenido/informe?mes=2026-09&cuenta=instagram:2')).status, 200);
    assert.equal((await fetch(base + '/api/contenido/informe', { method: 'POST', body: JSON.stringify({ mes: '2026-09', cuenta: 'facebook:9' }) })).status, 200);
    assert.equal((await fetch(base + '/api/contenido/informe?mes=2026-09&cuenta=../../x')).status, 400, 'una cuenta rara no llega al informe');
    assert.deepEqual(pedidos.filter(x => x[0] === 'informe').map(x => [x[2].cuenta, x[2].guardar]), [['instagram:2', false], ['facebook:9', true]]);
    const tools = (await rpc('tools/list')).result.tools, va = tools.find(t => t.name === 'ver_analiticas');
    assert.ok(va.inputSchema.properties.cuenta, 'ver_analiticas acepta `cuenta`');
    const txt = async a => (await rpc('tools/call', { name: 'ver_analiticas', arguments: a })).result.content[0].text;
    assert.match(await txt({ dias: 14, cuenta: '@pana.claw' }), /cuenta=@pana\.claw/);
    assert.match(await txt({}), /cuenta=todas/);
  } finally { p.kill(); srv.close(); }
});
