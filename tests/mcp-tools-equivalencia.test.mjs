// oficina-mcp.mjs y estudio-mcp.mjs por stdio (JSON-RPC), contra una oficina simulada: la lista de herramientas (nombre, descripción,
// esquema), lo que contestan las llamadas, los errores y las peticiones que hacen a la API deben ser IGUALES a la «foto» tomada del
// código anterior a separar las definiciones en oficina-tools.mjs y estudio-tools.mjs (tests/fixtures/mcp-tools-foto.json).
// Un cambio a propósito se vuelve a fotografiar con:   AO_FOTO=1 node --test tests/mcp-tools-equivalencia.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'mcp-tools-foto.json');

const JOB_LISTO = { state: 'done', items: ['2026-11/a.png', '2026-11/b.png'], kind: 'image', modelName: 'Img 1', cost: 0.04, prompt: 'una cama [x]' };
const JOB_VIDEO = { state: 'running', id: 'j1', kind: 'video', modelName: 'Vid 1', note: 'en cola', prompt: 'un video' };
const LOTE = { id: 'l1', nombre: 'Camas', estado: 'espera_ok', filas: [{ estado: 'ok' }, { estado: 'revisar' }], previa: { costo: 5 }, motivo: 'pasa del tope', costo: { gastado: 0, estimado: 5 }, cuentas: { total: 2 }, resumen: '0', bitacora: [{ t: 'nace' }] };
const PRESETS = { presets: [{ id: 'fondo-blanco', nombre: 'Fondo blanco', medios: ['image'], frase: 'Para la web', on: true, ejecutor: 'local', estrella: true,
    entradas: [{ rol: 'foto', es: 'una foto', min: 1 }], parametros: [{ id: 'fuerza', valores: [{ v: 'suave' }, { v: 'fuerte' }], def: 'suave' }] }, 
    { id: 'giro', nombre: 'Giro', medios: ['video'], frase: 'Gira', on: false, motivo: 'sin modelo' }], sharp: true, fabrica: { canales: [{ id: 'web', nombre: 'Web' }] } };
const COMPLETO = {
  'GET /api/media/models': { models: [{ id: 'img1', name: 'Img 1', kind: 'image', engine: 'google', on: true, note: 'rápido' }, { id: 'vid1', name: 'Vid 1', kind: 'video', engine: 'google', on: true }, { id: 'voz1', name: 'Voz 1', kind: 'audio', engine: 'minimax', on: true }, 
    { id: 'mus1', name: 'Mus 1', kind: 'music', engine: 'minimax', on: true }, { id: 'off1', name: 'Apagado', kind: 'image', engine: 'xai', on: false }], engines: [{ id: 'meta', name: 'Meta', on: true }, { id: 'google', name: 'Google', on: true }, 
    { id: 'xai', name: 'xAI', on: false }], default: { image: 'img1', video: 'vid1' }, voices: { voices: [{ voiceId: 'v1', name: 'Ana' }] }, 
    budget: { left: 10, limit: 20, maxPerRequest: 4, costLeftDay: 3.5, dailyBudget: 5, costLeftMonth: null } },
  'GET /api/media/presets': PRESETS, 'GET /api/media/presets?q=fondo+blanco': PRESETS,
  'GET /api/media?n=0': { folders: [{ id: 'f1', name: 'Camas', n: 2 }] },
  'GET /api/media?n=12': { total: 1, items: [{ file: '2026-11/a.png', kind: 'image', prompt: 'una cama', w: 100, h: 80, folder: 'f1', upload: true }] },
  'POST /api/media/jobs#image': { job: JOB_LISTO }, 'POST /api/media/jobs#video': { job: JOB_VIDEO }, 'POST /api/media/jobs#audio': { job: { ...JOB_LISTO, kind: 'audio', items: ['2026-11/v.mp3'] } },
  'GET /api/media/jobs/j1?wait=60000': { job: JOB_VIDEO }, 'GET /api/media/jobs?active=1&task=tarea1': { jobs: [{ id: 'j1', modelName: 'Vid 1', note: 'en cola', state: 'running' }] },
  'GET /api/media/vision?file=2026-11%2Fa.png': { w: 100, h: 80, bytes: 1234, original: null, data: 'QUJD', media_type: 'image/jpeg' },
  'POST /api/media/presets/apply': { plan: { resumen_es: 'fondo blanco' }, jobs: [JOB_LISTO] },
  'POST /api/media/lotes': { lote: LOTE }, 'GET /api/media/lotes/l1': { lote: { ...LOTE, estado: 'corriendo' } },
  'PATCH /api/media/lotes/l1': { lote: { ...LOTE, estado: 'corriendo' } },
  'POST /api/media/understand': { model: 'muse-spark', text: 'se ve una cama' },
};
const OFICINA = {
  'GET /api/oficina/mapa': { mapa: 'MAPA', reglas: 'REGLAS', acciones: { rutina_crear: 'dept, text, when' } }, 'GET /api/oficina/estado': { texto: 'ESTADO' },
  'GET /api/oficina/calendario?desde=2026-11-12': { texto: 'CALENDARIO' },
  'GET /api/tareas/t1': { tarea: { id: 't1', title: 'Cobrar', state: 'next', agent: 'invo', dept: 'fin', text: 'Cobrar la factura', pasos: [{ hecho: true, texto: 'listar' }, { hecho: false, texto: 'redactar' }], 
    comments: [{ by: 'dueño', text: 'ojo' }], result: 'listo' }, bloquean: [{ id: 't0', title: 'Antes', state: 'doing' }] },
  'GET /api/tareas/mias': { texto: 'MIAS', listas: { hoy: { pendientes: [{ id: 'm1', title: 'Llamar', limite: '2026-11-12T10:00', prioridad: 'alta' }] }, vacia: { pendientes: [] } } },
  'GET /api/tasks?light=1': [{ id: 't1', title: 'Cobrar', state: 'next', agent: 'invo', dept: 'fin' }, { id: 't2', title: 'Mía', state: 'next', person: 'Tú' }],
  'POST /api/oficina/accion': { hecho: 'pausé la rutina', deshacer: 'k1', hasta: 1790000000000 }, 'POST /api/oficina/deshacer': { deshecho: 'la rutina' },
  'POST /api/tasks': { id: 't9', title: 'Hola', agent: 'elead', dept: 'emails' }, 'POST /api/tareas/mias': { tarea: { id: 'm2', title: 'Firmar', limite: '2026-11-13' } },
  'POST /api/sub/chat': { messages: [{ text: 'Claro', plan: { tasks: [{ dept: 'marketing', title: 'Post', instruction: 'Haz un post' }] }, ops: [{ k: 1, state: 'p', type: 'rutina_pausar', id: 'r1' }] }] },
};

/** Una oficina simulada: contesta lo que está en `rutas` (el cuerpo del POST /api/media/jobs elige por kind) y apunta cada petición. */
async function oficinaFalsa(rutas) {
  const log = [];
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', d => { b += d; }); req.on('end', () => {
      let cuerpo = null; try { cuerpo = b ? JSON.parse(b) : null; } catch { cuerpo = b; }
      const k = `${req.method} ${req.url}`; log.push([k, cuerpo]);
      const suelta = k.split('?')[0] === 'POST /api/media/jobs' ? `POST /api/media/jobs#${cuerpo?.kind}` : null;
      const r = rutas[suelta] || rutas[k] || (k.startsWith('GET /api/media?n=12') ? rutas['GET /api/media?n=12'] : null);
      if (k === 'POST /api/tasks' && cuerpo?.dept === 'fallo') { res.statusCode = 500; return res.end(JSON.stringify({ error: 'se cayó' })); }
      res.setHeader('content-type', 'application/json');
      if (!r) { res.statusCode = 404; return res.end(JSON.stringify({ error: 'no existe ' + k })); }
      res.end(JSON.stringify(r));
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}`, log, close: () => srv.close() };
}

/** El MCP por stdio: `pide(método, params)`; el que arranca el test, con el entorno que le pone serve.mjs. */
function mcp(archivo, env) {
  const p = spawn(process.execPath, [path.join(ROOT, archivo)], { cwd: ROOT, env: { ...process.env, TZ: 'UTC', ...env }, stdio: ['pipe', 'pipe', 'ignore'] });
  let buf = '', n = 0; const esperas = new Map();
  p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); esperas.get(m.id)?.(m); esperas.delete(m.id); } });
  const pide = (method, params) => new Promise(r => { const id = ++n; esperas.set(id, r); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  return { pide, cerrar: () => p.kill() };
}

async function recorrer(archivo, rutas, llamadas) {
  const of = await oficinaFalsa(rutas);
  const m = mcp(archivo, { AO_OFFICE: of.url, AO_AGENT: 'agente1', AO_TASK: 'tarea1' });
  try {
    const init = (await m.pide('initialize', { protocolVersion: '2025-06-18' })).result;
    const lista = (await m.pide('tools/list', {})).result.tools;
    const desconocido = await m.pide('algo/raro', {});
    const llamados = [];
    for (const [name, args] of llamadas) llamados.push({ name, args, respuesta: (await m.pide('tools/call', { name, arguments: args })).result });
    return { servidor: { nombre: init.serverInfo.name, version: init.serverInfo.version, instrucciones: init.instructions || null, capacidades: init.capabilities }, desconocido: desconocido.error, herramientas: lista, llamados, peticiones: of.log };
  } finally { m.cerrar(); of.close(); }
}

const LLAMADAS_OFICINA = [
  ['como_funciona', {}], ['estado_oficina', {}], ['ver_calendario', { desde: '2026-11-12' }], ['ver_tarea', { id: 't1' }], ['ver_tarea', { id: 'nada' }], ['ver_mis_tareas', {}], ['ver_tareas', {}],
  ['hablar_con_dimitri', { texto: 'hola' }], ['crear_tarea', { dept: 'emails', texto: 'Hola' }], ['crear_tarea', { dept: 'emails', texto: 'x', at: '2020-01-01T10:00' }], ['crear_tarea', { dept: 'fallo', texto: 'x' }],
  ['crear_mi_tarea', { titulo: 'Firmar', limite: '2026-11-13', prioridad: 'alta' }], ['hacer', { type: 'rutina_pausar', id: 'r1' }], ['deshacer', { clave: 'k1' }], ['no_existe', {}],
];
const LLAMADAS_ESTUDIO = [
  ['estado_estudio', {}], ['buscar_en_galeria', { buscar: 'cama' }], ['buscar_en_galeria', { carpeta: 'no existe' }], ['generar_imagen', { prompt: 'una cama', cantidad: 2, formato: '4:5', referencias: ['2026-11/a.png'] }],
  ['generar_video', { prompt: 'un video', segundos: 5, imagen_inicial: '2026-11/a.png' }], ['generar_voz', { texto: 'Hola', voz: 'v1' }], ['estado_trabajo', { trabajo: 'j1' }], ['ver_imagen', { id: '2026-11/a.png' }], ['ver_imagen', {}],
  ['analizar_video', { instruccion: 'qué pasa', video: '2026-11/v.mp4' }], ['buscar_presets', { texto: 'fondo blanco' }],
  ['aplicar_preset', { presets: ['fondo-blanco', 'inventado'], foto: '2026-11/a.png', canal: 'web' }], ['aplicar_preset', { presets: [] }],
  ['crear_lote', { nombre: 'Camas', presets: ['fondo-blanco'], carpeta: 'Camas' }], ['crear_lote', { nombre: 'x', presets: ['fondo-blanco'] }], ['estado_lote', { lote: 'l1' }], ['no_existe', {}],
];

async function foto() {
  return {
    oficina: await recorrer('oficina-mcp.mjs', OFICINA, LLAMADAS_OFICINA),
    estudio_completo: await recorrer('estudio-mcp.mjs', COMPLETO, LLAMADAS_ESTUDIO),
    estudio_vacio: await recorrer('estudio-mcp.mjs', {}, [['estado_estudio', {}], ['generar_imagen', { prompt: 'x' }]]),
  };
}

test('oficina-mcp.mjs y estudio-mcp.mjs por stdio: lista, respuestas, errores y peticiones iguales a la foto de antes de separar las definiciones', async () => {
  const ahora = JSON.parse(JSON.stringify(await foto()));
  if (process.env.AO_FOTO === '1') { fs.writeFileSync(FIXTURE, JSON.stringify(ahora, null, 1) + '\n'); return; }
  const antes = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  for (const k of Object.keys(antes)) {
    assert.deepEqual(ahora[k].servidor, antes[k].servidor, `${k}: el servidor cambió`);
    assert.deepEqual(ahora[k].herramientas, antes[k].herramientas, `${k}: la lista de herramientas (nombre, descripción, esquema) cambió`);
    assert.deepEqual(ahora[k].llamados, antes[k].llamados, `${k}: lo que contesta una herramienta cambió`);
    assert.deepEqual(ahora[k].peticiones, antes[k].peticiones, `${k}: las peticiones a la oficina cambiaron`);
    assert.deepEqual(ahora[k].desconocido, antes[k].desconocido, `${k}: el error de un método desconocido cambió`);
  }
  assert.equal(antes.oficina.herramientas.length, 18);
  assert.equal(antes.estudio_completo.herramientas.length, 14, 'con todo encendido el Estudio ofrece sus 14 herramientas');
});
