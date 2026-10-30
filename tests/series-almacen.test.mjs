// Fase 11.5 PR A (30 oct 2026): la serie PERSISTIDA — almacén, lectura, estados, pausar y cancelar. NADA de esto gasta ni reserva. Sin red, sin hora del día.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as B from '../biblia-core.mjs';
import * as P from '../serie-propuesta-core.mjs';
import { hashEscaleta } from '../serie-core.mjs';
import { crearAlmacen, vistaSerie, resumenSerie, pausarSerie, cancelarSerie, MAX_SERIES } from '../series.mjs';
import { crearSeries } from '../serie-local.mjs';
import { crearBiblia } from '../biblia-local.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bib = B.normalizarBiblia({ paleta: [{ rol: 'primario', hex: '#1a2b3c' }], luz: 'cálida', nunca: ['fondos oscuros'], reglas: [] });
const aprobada = { existe: true, version: 1, estado: 'aprobada', biblia: bib };
const plano = (n, x = {}) => ({ n, rol: 'desarrollo', descripcion: `plano ${n}`, prompt: `Un sofá gris en la sala, toma ${n}`, ...x });
const propuesta = (n = 3, id = 'serie-1') => P.armarPropuesta({ brief: { titulo: 'Sofá', objetivo: 'vender' }, planos: Array.from({ length: n }, (_, i) => plano(i + 1)), biblia: aprobada, hojas: [],
  ctx: { id, capsDe: () => ({ maxRefs: 4 }), existeRef: () => true, precioPlano: () => ({ generacion: 0.1 }), modeloUnico: 'nb' } });
const tmp = t => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-series-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };
const ren = (a, b) => fs.renameSync(a, b);

test('guardar una propuesta: queda «previsto», con su hash, sin libro ni autorización, y el archivo es JSON válido', t => {
  const f = path.join(tmp(t), 'data', 'series.json'), A = crearAlmacen({ archivo: f, renombrar: ren, ahora: () => 1000 });
  const r = propuesta(), s = A.crear(r.serie, { costo_mostrado_usd: r.costoMostradoUsd });
  assert.equal(s.estado, 'previsto'); assert.equal(s.hash, r.hash); assert.equal(s.hash, hashEscaleta(s)); assert.equal(s.escaleta_v, 1); assert.equal(s.libro, null); assert.equal(s.autorizado, null); assert.equal(s.token_reg, null);
  assert.equal(s.costo_mostrado_usd, 0.6); assert.equal(s.escaleta.length, 3);
  const disco = JSON.parse(fs.readFileSync(f, 'utf8')); assert.equal(disco.series.length, 1); assert.ok(!fs.existsSync(f + '.tmp'), 'el temporal se renombró');
  assert.equal(crearAlmacen({ archivo: f, renombrar: ren }).uno('serie-1').hash, r.hash, 'otra instancia lee lo mismo (sobrevive a un reinicio)');
});

test('versionado: cambiar la escaleta sube escaleta_v y cambia el hash; cambiar solo el estado no; el id repetido no pisa', t => {
  const A = crearAlmacen({ archivo: path.join(tmp(t), 's.json'), renombrar: ren, azar: () => 'zz' });
  const s0 = A.crear(propuesta().serie);
  const s1 = A.actualizar('serie-1', x => ({ ...x, pausa_motivo: 'nota' })); assert.equal(s1.escaleta_v, 1); assert.equal(s1.hash, s0.hash); assert.equal(s1.v, 2);
  const s2 = A.actualizar('serie-1', x => { x.escaleta[0].prompt_exacto += ' distinto'; return x; }); assert.equal(s2.escaleta_v, 2); assert.notEqual(s2.hash, s0.hash); assert.equal(s2.v, 3);
  assert.equal(A.actualizar('serie-1', () => undefined).v, 3, 'devolver undefined no escribe');
  const otra = A.crear(propuesta().serie); assert.equal(otra.id, 'serie-1-zz'); assert.equal(A.todas().length, 2); assert.equal(A.uno('serie-1').escaleta_v, 2, 'la primera quedó como estaba');
  assert.equal(A.actualizar('no-existe', x => x), null);
});

test('un archivo roto se aparta y no se pisa en silencio; la poda nunca borra una viva', t => {
  const d = tmp(t), f = path.join(d, 's.json'); fs.writeFileSync(f, '{no es json');
  const A = crearAlmacen({ archivo: f, renombrar: ren, ahora: () => 7 }); assert.deepEqual(A.todas(), []); assert.ok(fs.readdirSync(d).some(x => x.startsWith('s.json.roto-')), 'el roto queda aparte');
  for (let i = 0; i < MAX_SERIES + 5; i++) { const s = A.crear({ ...propuesta(1).serie, id: 'p' + i }); if (i < 3) A.actualizar(s.id, x => ({ ...x, estado: 'corriendo' })); else A.actualizar(s.id, x => ({ ...x, estado: 'hecho' })); }
  const ids = A.todas().map(s => s.id); assert.equal(ids.length, MAX_SERIES); assert.ok(['p0', 'p1', 'p2'].every(i => ids.includes(i)), 'las vivas siguen');
});

test('el cupo diario de series se reinicia solo al cambiar el día', t => {
  const A = crearAlmacen({ archivo: path.join(tmp(t), 's.json'), renombrar: ren });
  assert.equal(A.usoDe('2026-10-30'), 0); A.sumarUso('2026-10-30', 3); A.sumarUso('2026-10-30', 2); assert.equal(A.usoDe('2026-10-30'), 5); assert.equal(A.usoDe('2026-10-31'), 0); A.sumarUso('2026-10-31', 1); assert.equal(A.usoDe('2026-10-30'), 0);
});

test('la vista no suelta el token ni lo que autoriza, y dice el progreso y el gasto', t => {
  const A = crearAlmacen({ archivo: path.join(tmp(t), 's.json'), renombrar: ren }), r = propuesta();
  A.crear(r.serie, { costo_mostrado_usd: r.costoMostradoUsd });
  const s = A.actualizar('serie-1', x => ({ ...x, estado: 'muestra', token_reg: { token: 'SECRETO-SECRETO-1', usado: false }, autorizado: { hash: x.hash, token: 'SECRETO-SECRETO-1' } })); // secrets-ok: un centinela de prueba
  const v = vistaSerie(s), txt = JSON.stringify(v); assert.ok(!txt.includes('SECRETO'), 'ni el token ni la autorización salen'); assert.equal(v.autorizada, true); assert.equal(v.etiqueta, 'Generando la muestra');
  assert.deepEqual(v.progreso, { total: 3, listos: 0, revisar: 0, previstos: 3, corriendo: 0, omitidos: 0 }); assert.equal(v.gasto.mostradoUsd, 0.6); assert.equal(v.gasto.gastadoUsd, 0); assert.equal(v.gasto.disponibleUsd, 10);
  assert.ok(!('libro' in v) && !('pasos' in v)); assert.equal(resumenSerie(s).progreso.total, 3); assert.equal(vistaSerie(null), null);
});

test('pausar y cancelar: solo desde donde corresponde, y la cancelación borra la autorización', () => {
  const base = { ...propuesta().serie, id: 'x', autorizado: { a: 1 }, token_reg: { b: 2 } };
  for (const e of ['previsto', 'espera_ok', 'pausado', 'hecho', 'cancelado']) assert.equal(pausarSerie({ ...base, estado: e }).ok, false, `no se pausa una ${e}`);
  const p = pausarSerie({ ...base, estado: 'corriendo' }, 'tope'); assert.equal(p.serie.estado, 'pausado'); assert.equal(p.serie.autorizado, null, 'pausar quita la autorización: seguir exige otro clic'); assert.equal(p.serie.pausa_motivo, 'tope');
  for (const e of ['previsto', 'espera_ok', 'muestra', 'corriendo', 'pausado']) { const c = cancelarSerie({ ...base, estado: e }); assert.equal(c.ok, true, e); assert.equal(c.serie.estado, 'cancelado'); assert.equal(c.serie.autorizado, null); assert.equal(c.serie.token_reg, null); }
  for (const e of ['hecho', 'cancelado']) assert.equal(cancelarSerie({ ...base, estado: e }).ok, false);
});

// ---- las rutas ----
function rutas(t, { guardar = true } = {}) {
  const d = tmp(t), BRAIN = path.join(d, 'brain'), DATA = path.join(d, 'data'); fs.mkdirSync(DATA, { recursive: true });
  const L = crearBiblia({ BRAIN, DATA, renombrar: ren, ask: async () => ({}), activo: () => true }); L.guardar({ biblia: { ...bib, reglas: [] }, aprobar: true });
  const A = crearAlmacen({ archivo: path.join(DATA, 'series.json'), renombrar: ren }), flags = { series: true, generar: guardar }, audit = [], cancelados = [];
  const S = crearSeries({ biblia: L, activo: () => flags.series, generarActivo: () => flags.generar, almacen: A, capsDe: () => ({ maxRefs: 4 }), existeRef: () => true, precioPlano: () => ({ generacion: 0.1 }), modeloUnico: () => 'nb',
    auditar: l => audit.push(l), alCancelar: s => cancelados.push(s.id), id: () => 'serie-r1' });
  return { S, A, flags, audit, cancelados, DATA };
}
const cuerpo = (x = {}) => ({ brief: { titulo: 'Sofá' }, planos: [plano(1), plano(2)], ...x });

test('proponer sin guardar:true no guarda; con guardar:true y el flag apagado dice por qué y no guarda; con el flag guarda previsto', async t => {
  const o = rutas(t, { guardar: false });
  const a = await o.S.ruta('POST', '/api/series/proponer', { cuerpo: cuerpo() }); assert.equal(a.estado, 200); assert.equal(a.cuerpo.guardada, undefined); assert.ok(!fs.existsSync(path.join(o.DATA, 'series.json')));
  const b = await o.S.ruta('POST', '/api/series/proponer', { cuerpo: cuerpo({ guardar: true }) }); assert.equal(b.estado, 200); assert.equal(b.cuerpo.guardada, null); assert.match(b.cuerpo.motivoNoGuardada, /serieGenerar/); assert.equal(o.A.todas().length, 0);
  o.flags.generar = true;
  const c = await o.S.ruta('POST', '/api/series/proponer', { cuerpo: cuerpo({ guardar: true }) }); assert.equal(c.estado, 200); assert.equal(c.cuerpo.gasta, false); assert.equal(c.cuerpo.guardada.id, 'serie-r1'); assert.equal(c.cuerpo.guardada.estado, 'previsto');
  const s = o.A.uno('serie-r1'); assert.equal(s.libro, null, 'guardar no reserva nada'); assert.equal(s.hash, c.cuerpo.hash); assert.deepEqual(o.audit.map(x => x.accion), ['guardar']);
  assert.equal((await o.S.ruta('POST', '/api/series/proponer', { cuerpo: cuerpo({ guardar: true }), agente: true })).estado, 403, 'un agente no propone ni guarda');
  assert.equal(o.A.todas().length, 1);
});

test('lectura: GET /api/series y /api/series/<id> funcionan con TODOS los flags apagados (solo lectura) y no sueltan secretos; un id raro o ausente da 404', async t => {
  const o = rutas(t); await o.S.ruta('POST', '/api/series/proponer', { cuerpo: cuerpo({ guardar: true }) });
  o.A.actualizar('serie-r1', x => ({ ...x, token_reg: { token: 'SECRETO-SECRETO-2' }, autorizado: { token: 'SECRETO-SECRETO-2' } })); // secrets-ok: un centinela de prueba
  o.flags.series = false; o.flags.generar = false;
  const l = await o.S.ruta('GET', '/api/series'); assert.equal(l.estado, 200); assert.equal(l.cuerpo.series.length, 1); assert.equal(l.cuerpo.series[0].estado, 'previsto'); assert.equal(l.cuerpo.activo, false);
  const u = await o.S.ruta('GET', '/api/series/serie-r1'); assert.equal(u.estado, 200); assert.equal(u.cuerpo.serie.progreso.previstos, 2); assert.ok(!JSON.stringify([l, u]).includes('SECRETO'));
  assert.equal((await o.S.ruta('GET', '/api/series/nada')).estado, 404); assert.equal(await o.S.ruta('GET', '/api/series/../x/y'), null);
});

test('pausar y cancelar por la ruta: solo el dueño (agente 403), con el flag apagado también (bajan el gasto), 404 y 409 en palabras; cancelar avisa al generador', async t => {
  const o = rutas(t); await o.S.ruta('POST', '/api/series/proponer', { cuerpo: cuerpo({ guardar: true }) });
  assert.equal((await o.S.ruta('POST', '/api/series/serie-r1/cancelar', { agente: true })).estado, 403);
  assert.equal((await o.S.ruta('POST', '/api/series/serie-r1/pausar', {})).estado, 409, 'una prevista no se pausa');
  o.flags.series = false; o.flags.generar = false;
  const c = await o.S.ruta('POST', '/api/series/serie-r1/cancelar', {}); assert.equal(c.estado, 200); assert.equal(c.cuerpo.serie.estado, 'cancelado'); assert.deepEqual(o.cancelados, ['serie-r1']);
  assert.equal((await o.S.ruta('POST', '/api/series/serie-r1/cancelar', {})).estado, 409); assert.equal((await o.S.ruta('POST', '/api/series/otra/cancelar', {})).estado, 404);
  assert.deepEqual(o.audit.map(x => x.accion), ['guardar', 'cancelar']);
});

test('DINERO (PR A): ni el almacén ni las rutas de lectura/estado saben gastar', () => {
  for (const f of ['series.mjs']) { const s = fs.readFileSync(path.join(ROOT, f), 'utf8'); assert.doesNotMatch(s, /media\.|submit\(|reservar\(|liquidar\(|fetch\(|serie_generar/, f); }
});

// ---- la oficina real ----
test('serve.mjs real: guardar, leer, pausar/cancelar; los flags apagados; agente 403; cuerpo malo 400; nada genera ni gasta', { timeout: 90000 }, async t => {
  const d = tmp(t), brain = path.join(d, 'brain'); fs.mkdirSync(brain, { recursive: true });
  fs.writeFileSync(path.join(d, 'office.config.local.json'), JSON.stringify({ dimitri: { series: true, serieGenerar: true } }));
  const probe = http.createServer(); const port = await new Promise(r => probe.listen(0, '127.0.0.1', () => r(probe.address().port))); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(d, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(d, 'office.config.local.json'), ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', CLAUDE_BIN: path.join(d, 'no-claude.exe'),
    TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: 'ignore' }); t.after(() => srv.kill());
  const base = `http://127.0.0.1:${port}`; for (let i = 0; i < 160; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* aún */ } await new Promise(r => setTimeout(r, 250)); }
  const call = async (p, b, method = b === undefined ? 'GET' : 'POST') => {
    const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json' }, ...(b === undefined ? {} : { body: typeof b === 'string' ? b : JSON.stringify(b) }) });
    return { status: r.status, j: await r.json().catch(() => ({})) };
  };
  assert.equal((await call('/api/biblia', { biblia: { ...bib, reglas: [] }, aprobar: true }, 'PUT')).status, 200);
  const modelo = (await call('/api/media/models')).j.models.find(m => m.kind === 'image' && m.engine === 'prueba' && m.on); assert.ok(modelo, 'el motor gratis «prueba» está encendido');
  const cu = { guardar: true, brief: { titulo: 'Sofá' }, planos: [plano(1, { modelo: modelo.id }), plano(2, { modelo: modelo.id })] };
  assert.equal((await call('/api/series/proponer', 'null')).status, 400);
  const p = await call('/api/series/proponer', cu); assert.equal(p.status, 200, JSON.stringify(p.j)); assert.ok(p.j.guardada?.id, JSON.stringify(p.j)); const id = p.j.guardada.id;
  assert.equal((await call('/api/series/proponer', { ...cu, by: 'agent' })).status, 403);
  const l = await call('/api/series'); assert.equal(l.status, 200); assert.equal(l.j.series.length, 1); assert.equal(l.j.series[0].estado, 'previsto');
  const u = await call('/api/series/' + id); assert.equal(u.status, 200); assert.equal(u.j.serie.progreso.previstos, 2); assert.equal(u.j.serie.hash, p.j.hash);
  assert.equal((await call('/api/media/jobs')).j.jobs.length, 0, 'guardar no genera nada');
  assert.equal((await call(`/api/series/${id}/cancelar`, { by: 'agent' })).status, 403);
  assert.equal((await call(`/api/series/${id}/pausar`, {})).status, 409);
  assert.equal((await call(`/api/series/${id}/cancelar`, {})).j.serie.estado, 'cancelado');
  assert.ok(fs.existsSync(path.join(d, 'data', 'series.json'))); assert.equal((await call('/api/series/' + id)).j.serie.estado, 'cancelado');
});
