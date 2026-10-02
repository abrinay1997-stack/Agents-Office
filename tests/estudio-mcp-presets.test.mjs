// Banco de presets E8 (§8.4, §15.5 y D17): los agentes de los departamentos y el banco de presets.
//   · safety.mjs   aplicar_preset y crear_lote gastan («cost»: permitidos antes del OK, nunca con «nunca»); buscar y estado leen;
//                  una herramienta del Estudio que nadie nombró como lectura es «cost», y un ajuste no la baja a lectura.
//   · approvals.mjs el lote que espera el OK, como borrador: «Lo que saldrá», el riesgo y la línea ⏳ cambiada por el resumen.
//   · estudio-mcp.mjs por stdio contra una oficina simulada: las cuatro herramientas, ids desconocidos fuera (diciéndolo),
//                  quién pide (by: agent, su id y su tarea), el lote en espera sin arrancarlo, y ninguna herramienta que apruebe.
//   · La oficina de verdad (serve.mjs en una carpeta desechable, sin keys, un preset local con sharp) y un «Claude» simulado que
//     llama al MCP como lo haría el agente: 10 fotos → espera_ok → ⚠ Aprobaciones → tu OK lo arranca; devolver lo cancela;
//     5 fotos arrancan solas y, al terminar, la línea ⏳ de la entrega pasa a ser el resumen con miniaturas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as S from '../safety.mjs';
import * as A from '../approvals.mjs';
import { escenaDeAgente, escenaEnPalabras, pilaDe, presetEnLinea, avisoFuera } from '../estudio-mcp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MCP = path.join(ROOT, 'estudio-mcp.mjs');
const espera = ms => new Promise(r => setTimeout(r, ms));
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
let sharp = null; try { sharp = (await import('sharp')).default; } catch {}

/** El MCP del Estudio por stdio, como lo arranca serve.mjs: env AO_OFFICE, AO_AGENT, AO_TASK. */
function mcp(t, env) {
  const p = spawn(process.execPath, [MCP], { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => p.kill());
  let buf = '', n = 0; const wait = new Map();
  p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); wait.get(m.id)?.(m); wait.delete(m.id); } });
  const rpc = (method, params) => new Promise(r => { const id = ++n; wait.set(id, r); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  const call = async (name, args) => { const m = await rpc('tools/call', { name, arguments: args }); return { text: m.result.content[0].text, error: !!m.result.isError }; };
  return { rpc, call, list: async () => (await rpc('tools/list', {})).result.tools, close: () => p.kill() };
}

/* ---------- safety ---------- */
test('safety: aplicar_preset y crear_lote gastan; buscar_presets y estado_lote leen; lo desconocido del Estudio gasta', () => {
  for (const t of ['aplicar_preset', 'crear_lote']) {
    assert.equal(S.kindOf(`mcp__estudio__${t}`), 'cost', t);
    assert.equal(S.decide(`mcp__estudio__${t}`, {}, { writes: false, policy: 'aprobar', runMode: 'draft' }).allow, true, `${t}: antes del OK, sí`);
    assert.equal(S.decide(`mcp__estudio__${t}`, {}, { writes: false, policy: 'nunca' }).code, 'cost', `${t}: con «nunca», no`);
  }
  for (const t of ['buscar_presets', 'estado_lote', 'buscar_en_galeria', 'estado_trabajo', 'estado_estudio']) assert.equal(S.kindOf(`mcp__estudio__${t}`), 'read', t);
  assert.equal(S.kindOf('mcp__estudio__herramienta_nueva'), 'cost', 'una herramienta del Estudio que nadie nombró como lectura nunca es lectura');
  assert.equal(S.kindOf('mcp__estudio__crear_lote', undefined, { '*crear_lote': 'read' }), 'cost', 'un ajuste no baja a lectura lo que gasta');
  assert.equal(S.kindOf('mcp__estudio__estado_lote', undefined, { '*estado_lote': 'cost' }), 'cost', 'subirlo sí se puede');
  assert.match(S.problems({ toolKinds: { 'mcp__estudio__aplicar_preset': 'read' } })[0], /gasta/);
  assert.equal(S.decide('mcp__estudio__crear_lote', {}, { writes: true, servers: ['gmail'] }).code, 'server', 'MCP-07 sigue: un servidor que no es de la mesa');
});

/* ---------- approvals ---------- */
const LOTE = { id: 'Labcd1234', nombre: 'Camas bodega → web', by: 'agent', agent: 'gfx', task: 'tk1abcd', estado: 'espera_ok', motivo: 'Lo pidió un agente y llega a 12 fotos (el tope sin tu OK es 9): espera tu OK.',
  receta: { pila: [{ id: 'cat-web-panaclaw' }], canal: 'web', escena: { producto: {} } }, costo: { estimado: 1.56, gastado: 0 },
  filas: [...Array(12)].map((_, i) => ({ n: i + 1, estado: i === 11 ? 'revisar' : 'en_cola', src: `2026-10/f${i}.png` })) };
test('approvals: el lote que espera el OK se lee como un borrador (Lo que saldrá, riesgo, bloque)', () => {
  const x = A.loteParaAprobar(LOTE, { nombreDe: id => (id === 'cat-web-panaclaw' ? 'Catálogo para la web, con margen' : id), canalDe: () => 'Web PanaClaw' });
  assert.deepEqual({ fotos: x.fotos, total: x.total, receta: x.receta, canal: x.canal, costo: x.costo, escena: x.escena }, { fotos: 11, total: 12, receta: 'Catálogo para la web, con margen', canal: 'Web PanaClaw', costo: 1.56, escena: true });
  const b = A.bloqueLote(x);
  assert.match(b, /Fotos: 11 \(y 1 que no se pueden editar y no gastan\)/); assert.match(b, /US\$1,56/); assert.match(b, /prueba de 3 fotos/); assert.match(b, /se cancela sin gastar/);
  assert.ok(!A.marcaLote(LOTE.id).test(b), 'el bloque no lleva la marca de la línea ⏳ (si no, el resumen caería en el bloque)');
  const p = A.previewConLotes(A.preview('Te dejo el catálogo listo.'), [x]);
  assert.match(p.channel, /Estudio: lote «Camas bodega → web» · 11 fotos/); assert.deepEqual(p.amounts, [1.56]);
  assert.equal(A.riesgoConLotes('bajo', [x]), 'medio', 'gastar dinero es al menos riesgo medio');
  assert.equal(A.riesgoConLotes('bajo', [{ ...x, costo: 250 }], A.DEFAULTS), 'alto', 'por encima del límite de importes, alto');
  assert.equal(A.previewConLotes(p, []), p);
});
test('approvals: al terminar, la línea ⏳ del lote pasa a ser el resumen con miniaturas (una vez)', () => {
  const l = { ...LOTE, estado: 'hecho', costo: { estimado: 1.56, gastado: 1.2 }, filas: [...Array(8)].map((_, i) => ({ n: i + 1, sku: `CM-${i}`, estado: i < 7 ? 'lista' : 'fallo', out: i < 7 ? `2026-10/out ${i}.png` : null })) };
  const texto = `Listo el catálogo.\n${A.lineaLote(l)}\nFuentes: x`;
  const r = A.resumenLote(l);
  assert.match(r, /^✓ Estudio: lote «Camas bodega → web» terminado: 7 listas, 1 falló · gastado US\$1,20\./);
  assert.equal((r.match(/!\[/g) || []).length, 6, 'hasta 6 miniaturas'); assert.match(r, /out%200\.png/); assert.match(r, /y 1 más/);
  const nuevo = A.ponerResumenLote(texto, l);
  assert.ok(!nuevo.includes('⏳'), 'la línea ⏳ ya no está'); assert.match(nuevo, /^Listo el catálogo\.\n✓ Estudio/); assert.match(nuevo, /Fuentes: x$/);
  assert.equal(A.ponerResumenLote('Sin línea', l).split('\n')[2].slice(0, 9), '✓ Estudio', 'si el agente no dejó la línea, va al final');
  assert.match(A.resumenLote({ ...l, estado: 'cancelado' }), /^✗ Estudio: el lote .* se canceló/);
});

/* ---------- las funciones puras del MCP ---------- */
test('mcp: la escena en palabras sencillas → la del Estudio (atajos de toma y distancia, nunca bajo el piso)', () => {
  const e = escenaDeAgente({ producto: 'cama-king', toma: 'frontal', encuadre: 'margen', proporcion: '4:5' });
  assert.equal(e.producto.ancho, 193); assert.equal(e.cuadro.proporcion, '4:5'); assert.ok(e.camara.altura >= 0);
  assert.match(escenaEnPalabras(e), /^Frontal · .* ocupa ~60 % /);
  const c = escenaDeAgente({ producto: 'cafetera', toma: 'contrapicado' });
  assert.match(escenaEnPalabras(c), /contrapicado/); assert.ok(c.camara.altura >= 0);
  const propio = escenaDeAgente({ producto: 'Mesa', ancho_cm: 120, alto_cm: 75, profundidad_cm: 80, fondo: 'locacion', fondo_valor: 'terraza', altura_cm: -40 });
  assert.equal(propio.producto.tipo, 'mesa'); assert.equal(propio.producto.fondo, 80); assert.equal(propio.fondo.tipo, 'locacion'); assert.equal(propio.camara.altura, 0, 'el piso es el cero');
  assert.equal(escenaDeAgente(null), null); assert.equal(escenaDeAgente('frontal'), null);
});
test('mcp: los ids que el banco no conoce quedan fuera y se dice; los de video no se aplican aquí', () => {
  const banco = [{ id: 'cat-web-panaclaw', medios: ['image'] }, { id: 'luz-mas-clara', medios: ['image'] }, { id: 'vcam-orbita', medios: ['video'] }];
  const r = pilaDe([{ id: 'cat-web-panaclaw', params: { encuadre: 'margen' } }, 'luz-mas-clara', { id: 'inventado' }, 'vcam-orbita', 7, null], banco);
  assert.deepEqual(r.pila, [{ id: 'cat-web-panaclaw', params: { encuadre: 'margen' } }, { id: 'luz-mas-clara' }]);
  assert.deepEqual(r.fuera, ['inventado']); assert.deepEqual(r.noImagen, ['vcam-orbita']);
  assert.match(avisoFuera(r.fuera, r.noImagen), /No conozco «inventado».*vcam-orbita es de video/);
  assert.match(presetEnLinea({ id: 'x', nombre: 'X', frase: 'f', ejecutor: 'local', on: true, modos: ['foto'], parametros: [{ id: 'intensidad', valores: [{ v: 'suave' }, { v: 'normal' }], def: 'normal' }] }), /parámetros: intensidad \(suave\|normal; por defecto normal\) · ✓ en la máquina del dueño, gratis/);
  assert.match(presetEnLinea({ id: 'y', nombre: 'Y', on: false, motivo: 'ningún modelo encendido' }), /✗ ahora no: ningún modelo encendido/);
});

/* ---------- por stdio, contra una oficina simulada ---------- */
function oficinaSimulada(t, { modelos = [{ id: 'nano-banana-2', name: 'Nano Banana 2', kind: 'image', engine: 'google', on: true }], sharpOk = true, lote = 'previsto' } = {}) {
  const pedidos = [];
  const srv = http.createServer((rq, rs) => {
    let b = ''; rq.on('data', d => { b += d; }); rq.on('end', () => {
      const body = b ? JSON.parse(b) : null, u = new URL(rq.url, 'http://x'); pedidos.push({ method: rq.method, path: u.pathname, search: u.search, body });
      const ok = o => { rs.writeHead(200, { 'content-type': 'application/json' }); rs.end(JSON.stringify(o)); };
      if (u.pathname === '/api/media/models') return ok({ models: modelos, engines: [], default: {}, budget: { left: null, limit: 0, maxPerRequest: 4 } });
      if (u.pathname === '/api/media/presets' && rq.method === 'GET') return ok({ sharp: sharpOk, fabrica: { canales: [{ id: 'web', nombre: 'Web PanaClaw' }] }, presets: [
        { id: 'cat-web-panaclaw', nombre: 'Catálogo para la web, con margen', frase: 'Blanco, con aire.', medios: ['image'], modos: ['foto'], ejecutor: 'local+ia', estrella: true, on: true, modelos: ['nano-banana-2'], entradas: [{ es: 'Tu foto del producto', min: 1 }], parametros: [{ id: 'canal' }] },
        { id: 'luz-mas-clara', nombre: 'Más clara', frase: 'Sube la luz.', medios: ['image'], modos: ['foto'], ejecutor: 'local', on: true, modelos: [] }] });
      if (u.pathname === '/api/media/presets/apply') return ok({ plan: { resumen_es: 'Sobre tu foto · 1 paso' }, jobs: [{ id: 'jx1', state: 'done', kind: 'image', items: ['2026-10/salida.png'], modelName: 'Nano Banana 2', cost: 0.04, prompt: 'Catálogo' }] });
      if (u.pathname === '/api/media/lotes' && rq.method === 'POST') {
        const n = body.origen.ids ? body.origen.ids.length : 12;
        return ok({ lote: { id: 'Lsim0001', nombre: body.nombre, by: 'agent', estado: lote, muestra: 0, motivo: lote === 'espera_ok' ? 'Lo pidió un agente y llega a 12 fotos: espera tu OK.' : null, filas: [...Array(n)].map((_, i) => ({ n: i + 1, estado: 'en_cola' })), costo: { estimado: 0.5 }, previa: { costo: 0.5 } } });
      }
      if (/^\/api\/media\/lotes\/L/.test(u.pathname) && rq.method === 'PATCH') return ok({ lote: { id: 'Lsim0001', nombre: 'x', estado: 'corriendo', filas: [] } });
      if (/^\/api\/media\/lotes\/L/.test(u.pathname)) return ok({ lote: { id: 'Lsim0001', nombre: 'Camas', estado: 'hecho', resumen: '1 lista', cuentas: { total: 1 }, costo: { estimado: 0.1, gastado: 0.1 }, filas: [{ n: 1, estado: 'lista', out: '2026-10/a.png', sku: 'CM-1' }] } });
      rs.writeHead(404); rs.end('{}');
    });
  });
  t.after(() => srv.close());
  return listen(srv).then(port => ({ url: `http://127.0.0.1:${port}`, pedidos }));
}

test('stdio: las cuatro herramientas, solo si algo las sirve, y ninguna aprueba ni autoriza', async t => {
  const o = await oficinaSimulada(t), m = mcp(t, { AO_OFFICE: o.url, AO_AGENT: 'gfx', AO_TASK: 'tk1abcd' });
  await m.rpc('initialize', {});
  const tools = await m.list(), names = tools.map(x => x.name);
  for (const n of ['buscar_presets', 'aplicar_preset', 'crear_lote', 'estado_lote']) assert.ok(names.includes(n), n);
  assert.ok(!names.some(n => /aprob|autoriz|approv|authori|publi|program|schedul/i.test(n)), 'ningún nombre aprueba, autoriza, publica ni programa');
  for (const x of tools) for (const k of Object.keys(x.inputSchema?.properties || {})) assert.ok(!['estado', 'accion', 'by', 'agent', 'task', 'tope', 'muestra'].includes(k), `${x.name} no deja elegir «${k}»: eso lo pone la oficina`);
  for (const x of tools.filter(x => ['aplicar_preset', 'crear_lote'].includes(x.name))) assert.equal(S.kindOf(`mcp__estudio__${x.name}`), 'cost');
  for (const x of tools.filter(x => ['buscar_presets', 'estado_lote'].includes(x.name))) assert.equal(S.kindOf(`mcp__estudio__${x.name}`), 'read');
  m.close();

  const sin = await oficinaSimulada(t, { modelos: [{ id: 'prueba', kind: 'image', engine: 'prueba', on: true }], sharpOk: false }), m2 = mcp(t, { AO_OFFICE: sin.url });
  assert.ok(!(await m2.list()).some(x => x.name === 'crear_lote'), 'sin un modelo de imagen con key y sin sharp, no se muestran (la tarjeta «prueba» no cuenta)');
});

test('stdio: buscar no gasta; aplicar pide como agente, deja fuera lo desconocido y devuelve la imagen', async t => {
  const o = await oficinaSimulada(t), m = mcp(t, { AO_OFFICE: o.url, AO_AGENT: 'gfx', AO_TASK: 'tk1abcd' });
  const b = await m.call('buscar_presets', { texto: 'para la web', modo: 'foto' });
  assert.match(b.text, /cat-web-panaclaw · «Catálogo para la web, con margen»/); assert.match(b.text, /No gasta nada/); assert.match(b.text, /web = Web PanaClaw/);
  assert.equal(o.pedidos.find(p => p.path === '/api/media/presets' && p.search).search, '?q=para+la+web&modo=foto');

  const a = await m.call('aplicar_preset', { presets: [{ id: 'cat-web-panaclaw' }, { id: 'no-existe' }], foto: '2026-10/cama.png', canal: 'web', escena: { producto: 'cama-queen', encuadre: 'margen' } });
  assert.equal(a.error, false, a.text);
  assert.match(a.text, /No conozco «no-existe»/); assert.match(a.text, /Escena: Frontal/); assert.match(a.text, /!\[.*\]\(\/media\/2026-10\/salida\.png\)/);
  const ap = o.pedidos.find(p => p.path === '/api/media/presets/apply').body;
  assert.deepEqual({ by: ap.by, agent: ap.agent, task: ap.task, pila: ap.pila, foto: ap.entradas.foto, canal: ap.params.canal }, { by: 'agent', agent: 'gfx', task: 'tk1abcd', pila: [{ id: 'cat-web-panaclaw' }], foto: ['2026-10/cama.png'], canal: 'web' });
  assert.equal(ap.escena.producto.tipo, 'cama-queen'); assert.ok(ap.wait > 0);

  const n = o.pedidos.length, x = await m.call('aplicar_preset', { presets: ['inventado'] });
  assert.equal(x.error, true); assert.match(x.text, /No conozco «inventado».*Nada se hizo/);
  assert.equal(o.pedidos.slice(n).filter(p => p.method === 'POST').length, 0, 'sin ningún preset conocido no se pide nada');
});

test('stdio: un lote que espera el OK no se arranca; uno por debajo del tope arranca como agente', async t => {
  const o = await oficinaSimulada(t, { lote: 'espera_ok' }), m = mcp(t, { AO_OFFICE: o.url, AO_AGENT: 'gfx', AO_TASK: 'tk1abcd' });
  const r = await m.call('crear_lote', { nombre: 'Camas bodega → web', presets: ['cat-web-panaclaw'], carpeta: 'Bodega', canal: 'web', escena: { producto: 'cama-queen', toma: 'frontal', encuadre: 'margen' } });
  assert.match(r.text, /Aprobaciones/); assert.match(r.text, /No se gastó nada/); assert.match(r.text, /⏳ Estudio: lote «Camas bodega → web» \(lote Lsim0001\)/); assert.match(r.text, /Escena para toda la serie/);
  const c = o.pedidos.find(p => p.path === '/api/media/lotes').body;
  assert.deepEqual({ by: c.by, agent: c.agent, task: c.task, origen: c.origen, canal: c.receta.canal, pila: c.receta.pila }, { by: 'agent', agent: 'gfx', task: 'tk1abcd', origen: { carpeta: 'Bodega' }, canal: 'web', pila: [{ id: 'cat-web-panaclaw' }] });
  assert.ok(c.receta.escena?.camara, 'una misma escena para toda la serie');
  assert.ok(!o.pedidos.some(p => p.method === 'PATCH'), 'nada arranca un lote que espera el OK');

  const o2 = await oficinaSimulada(t), m2 = mcp(t, { AO_OFFICE: o2.url, AO_AGENT: 'gfx', AO_TASK: 'tk1abcd' });
  const r2 = await m2.call('crear_lote', { nombre: 'Tres sillas', presets: ['luz-mas-clara'], fotos: ['a.png', 'b.png', 'c.png'] });
  assert.match(r2.text, /^En marcha: lote «x», 3 fotos/m);
  const pt = o2.pedidos.find(p => p.method === 'PATCH');
  assert.deepEqual({ path: pt.path, accion: pt.body.accion, by: pt.body.by }, { path: '/api/media/lotes/Lsim0001', accion: 'iniciar', by: 'agent' });
  const e = await m2.call('estado_lote', { lote: 'Lsim0001' });
  assert.match(e.text, /terminado/); assert.match(e.text, /✓ Estudio: lote «Camas» terminado/); assert.match(e.text, /!\[CM-1\]\(\/media\/2026-10\/a\.png\)/);
  const f = await m2.call('crear_lote', { nombre: 'Sin fotos', presets: ['luz-mas-clara'] });
  assert.equal(f.error, true); assert.match(f.text, /de dónde salen las fotos/);
});

/* ---------- la oficina de verdad ---------- */
async function oficinaReal(t, dir, alPedir) {
  const claude = http.createServer((rq, rs) => { // un Claude simulado: a la tarea del agente le contesta llamando al MCP, como el agente
    let b = ''; rq.on('data', d => { b += d; }); rq.on('end', async () => {
      let text = 'ok';
      try { text = await alPedir(JSON.parse(b || '{}')); } catch (e) { text = 'falló el simulador: ' + e.message; }
      rs.writeHead(200, { 'content-type': 'application/json' });
      rs.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } }));
    });
  });
  const cport = await listen(claude);
  fs.writeFileSync(path.join(dir, 'office.config.local.json'), JSON.stringify({ approvals: { undoSeconds: 0 } }));
  t.after(() => { claude.close(); claude.closeAllConnections?.(); });
  // con toda la batería en paralelo, otro test puede quedarse con el puerto probado: se espera a que ESTE proceso diga que escucha
  // en él (si no, a la primera petición le contestaría la oficina de otro test), y si sale, se prueba otro puerto
  let srv, log = '', port = 0;
  for (let intento = 0; intento < 4 && !port; intento++) {
    const probe = http.createServer(), p = await listen(probe); await new Promise(r => probe.close(r));
    const env = { ...process.env, PORT: String(p), AO_DATA: path.join(dir, 'data'), AO_BRAIN: path.join(dir, 'brain'), AO_LOCAL_CONFIG: path.join(dir, 'office.config.local.json'),
      ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, CLAUDE_BIN: path.join(dir, 'no-claude.exe'),
      TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', VOYAGE_API_KEY: '', MINIMAX_API_KEY: '' };
    log = ''; srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
    const s = srv; t.after(() => s.kill()); let salio = false; s.once('exit', () => { salio = true; });
    for (let i = 0; i < 160 && !salio && !log.includes(`localhost:${p}`); i++) await espera(250);
    if (!salio && log.includes(`localhost:${p}`)) port = p; else s.kill();
  }
  if (!port) throw new Error('la oficina no arrancó: ' + log.split('\n').slice(-6).join(' | '));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await espera(250); }
  const call1 = async (p, b, method) => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }); return { status: r.status, j: await r.json().catch(() => null) }; };
  const call = (p, b, method = b ? 'POST' : 'GET') => call1(p, b, method).catch(e => (method === 'GET' ? espera(300).then(() => call1(p, b, method)) : Promise.reject(e))); // una lectura que cae se repite una vez
  if ((await call('/api/health').catch(() => ({ status: 0 }))).status !== 200) throw new Error('la oficina no arrancó: ' + log.split('\n').slice(-6).join(' | '));
  return { base, call, log: () => log };
}
// con la batería entera en paralelo, una petición suelta puede caer («fetch failed»: una conexión keep-alive que el servidor
// cerró a la vez); al sondear, eso es «todavía no», no un fallo
const hasta = async (fn, ms = 90000) => { const fin = Date.now() + ms; let v, ult = null; while (Date.now() < fin) { try { v = await fn(); if (v) return v; } catch (e) { ult = e; } await espera(250); } throw new Error('no llegó a tiempo' + (ult ? ` (${ult.message})` : '')); };

test('oficina: el lote de un agente pasa por ⚠ Aprobaciones; tu OK lo arranca, devolverlo lo cancela, uno pequeño vuelve a su entrega', { timeout: 180000, skip: sharp ? false : 'sin sharp en esta máquina' }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-mcp-presets-'));
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  fs.mkdirSync(path.join(dir, 'brain', '20-Brand'), { recursive: true }); // un cerebro con alguna nota (con 0 notas, kIndex de serve.mjs se queda en null)
  fs.writeFileSync(path.join(dir, 'brain', '20-Brand', 'voice.md'), '# Voz\nCercana.\n');
  const respuestas = []; let o;
  const pedir = async req => { // la ejecución del agente: busca su tarea en marcha y llama al MCP con AO_TASK, como haría Claude Code
    const user = JSON.stringify(req.messages || '');
    const plan = respuestas.find(x => !x.hecho && user.includes(x.marca)); if (!plan) return 'ok';
    const tareas = (await o.call('/api/tasks')).j, tk = tareas.find(x => x.state === 'doing' && x.text.includes(plan.marca));
    const m = mcp(t, { AO_OFFICE: o.base, AO_AGENT: 'gfx', AO_TASK: tk.id });
    const r = await m.call('crear_lote', plan.lote); m.close(); plan.hecho = true; plan.respuesta = r.text;
    const linea = r.text.split('\n').find(l => l.startsWith('⏳')) || '';
    return `Preparé el catálogo.\n\n## La serie\n${linea}\n\nFuentes: galería`;
  };
  o = await oficinaReal(t, dir, pedir);

  // la galería: 10 «camas» en la carpeta Bodega y 5 en Sillas
  const png = async i => 'data:image/png;base64,' + (await sharp({ create: { width: 120, height: 90, channels: 3, background: { r: 120 + i * 7, g: 90, b: 60 } } }).png().toBuffer()).toString('base64');
  const bodega = (await o.call('/api/media/folders', { name: 'Bodega' })).j.folder.id, sillas = (await o.call('/api/media/folders', { name: 'Sillas' })).j.folder.id;
  for (let i = 0; i < 10; i++) assert.equal((await o.call('/api/media/upload', { name: `cama ${i}.png`, data: await png(i), folder: bodega })).status, 200);
  for (let i = 0; i < 5; i++) assert.equal((await o.call('/api/media/upload', { name: `silla ${i}.png`, data: await png(i + 20), folder: sillas })).status, 200);

  // 1) 10 fotos: el agente lo pide; nace «espera_ok», nada se gasta y la tarea espera tu OK con «Lo que saldrá»
  respuestas.push({ marca: 'CAMAS-1', lote: { nombre: 'Camas bodega → web', presets: ['luz-mas-clara'], carpeta: 'Bodega', canal: 'web' } }); // sin escena: la escena pide un motor de IA (la guía) y aquí no hay keys
  const t1 = (await o.call('/api/tasks', { dept: 'marketing', agent: 'gfx', needsOk: false, text: 'CAMAS-1 Prepara el catálogo de la carpeta Bodega para la web' })).j;
  const w1 = await hasta(async () => (await o.call('/api/tasks')).j.find(x => x.id === t1.id && x.state === 'waiting')).catch(async e => { throw new Error(`${e.message}: ${JSON.stringify((await o.call('/api/tasks')).j.find(x => x.id === t1.id)).slice(0, 600)}`); });
  assert.match(respuestas[0].respuesta, /Aprobaciones/);
  assert.equal(w1.lotesOk.length, 1); assert.equal(w1.lotesOk[0].fotos, 10); assert.equal(w1.loteOnly, true);
  assert.match(w1.draft, /⏳ Estudio: lote «Camas bodega → web» \(lote L/); assert.match(w1.draft, /Lote del Estudio que espera tu OK/);
  assert.match(w1.preview.channel, /Estudio: lote «Camas bodega → web» · 10 fotos · Que se vea más clara/); assert.equal(w1.risk, 'medio');
  const L1 = w1.lotesOk[0].id;
  let l1 = (await o.call(`/api/media/lotes/${L1}`)).j.lote;
  assert.equal(l1.estado, 'espera_ok'); assert.equal(l1.agent, 'gfx'); assert.equal(l1.task, t1.id);
  assert.equal((await o.call('/api/media/jobs')).j.jobs.filter(j => j.lote?.id === L1).length, 0, 'nada gastado ni enviado');
  // un agente no lo arranca ni lo autoriza por la API
  assert.equal((await o.call(`/api/media/lotes/${L1}`, { accion: 'iniciar', by: 'agent' }, 'PATCH')).status, 403);
  assert.equal((await o.call(`/api/media/lotes/${L1}`, { accion: 'autorizar', by: 'agent' }, 'PATCH')).status, 403);
  // pedirlo otra vez desde la misma tarea devuelve el mismo (el envío tras tu OK, un reintento)
  const m1 = mcp(t, { AO_OFFICE: o.base, AO_AGENT: 'gfx', AO_TASK: t1.id });
  assert.match((await m1.call('crear_lote', respuestas[0].lote)).text, new RegExp(`ya existe.*\\(lote ${L1}\\)`, 's')); m1.close();
  assert.equal((await o.call('/api/media/lotes')).j.lotes.length, 1);

  // tu OK: el lote se autoriza y arranca con la prueba de 3; la tarea termina sin otra ejecución del agente
  const ap = await o.call(`/api/tasks/${t1.id}/approve`, {});
  assert.equal(ap.status, 200, JSON.stringify(ap.j));
  const d1 = await hasta(async () => (await o.call('/api/tasks')).j.find(x => x.id === t1.id && x.state === 'done'));
  assert.equal(d1.approved, true); assert.ok(!/AFTER YOUR OK/.test(d1.result), 'no hubo otra ejecución');
  l1 = await hasta(async () => { const l = (await o.call(`/api/media/lotes/${L1}`)).j.lote; return l.estado === 'pausado' && l; });
  assert.equal(l1.pausa.por, 'muestra'); assert.equal(l1.filas.filter(f => f.out).length, 3, 'la prueba de 3, y se para para que la revises');

  // 2) devolverlo: el lote que esperaba se cancela sin gastar
  respuestas.push({ marca: 'CAMAS-2', lote: { nombre: 'Camas otra vez', presets: ['luz-mas-clara'], carpeta: 'Bodega' } });
  const t2 = (await o.call('/api/tasks', { dept: 'marketing', agent: 'gfx', needsOk: false, text: 'CAMAS-2 Otra serie de la Bodega' })).j;
  const w2 = await hasta(async () => (await o.call('/api/tasks')).j.find(x => x.id === t2.id && x.state === 'waiting'));
  const L2 = w2.lotesOk[0].id;
  assert.equal((await o.call(`/api/tasks/${t2.id}/reject`, { feedback: 'Todavía no, espera a la sesión de fotos.' })).status, 200);
  assert.equal((await o.call(`/api/media/lotes/${L2}`)).j.lote.estado, 'cancelado');
  assert.equal((await o.call('/api/media/jobs')).j.jobs.filter(j => j.lote?.id === L2).length, 0);

  // 3) 5 fotos: por debajo del tope arranca solo; al terminar, la línea ⏳ de la entrega pasa a ser el resumen con miniaturas
  respuestas.push({ marca: 'SILLAS-3', lote: { nombre: 'Sillas más claras', presets: ['luz-mas-clara'], carpeta: 'Sillas' } });
  const t3 = (await o.call('/api/tasks', { dept: 'marketing', agent: 'gfx', needsOk: false, text: 'SILLAS-3 Aclara las fotos de las sillas' })).j;
  assert.match(await hasta(async () => respuestas[2].respuesta), /^En marcha: lote «Sillas más claras», 5 fotos/m);
  const d3 = await hasta(async () => { const x = (await o.call('/api/tasks')).j.find(y => y.id === t3.id); return x?.state === 'done' && /✓ Estudio: lote «Sillas más claras» terminado/.test(x.result) && x; }, 60000);
  assert.ok(!d3.result.includes('⏳'), 'la línea ⏳ se cambió'); assert.equal((d3.result.match(/!\[/g) || []).length, 5); assert.equal(d3.media.length, 5);
  assert.ok(!d3.lotesOk, 'nunca esperó tu OK');
  assert.match(o.log(), /lote .* autorizado con la tarea/);
});
