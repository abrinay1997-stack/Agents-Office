// V4.7: Contenido en manos de los agentes — lo que pueden hacer (leer, dejar borradores) y lo que NO (aprobar, programar, publicar).
// Levanta las rutas de verdad sobre una carpeta temporal y habla con contenido-mcp.mjs como lo haría Claude Code: JSON-RPC por stdio.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crearAlmacen } from '../contenido/piezas.mjs';
import { crearRutas } from '../contenido/rutas.mjs';
import { kindOf } from '../safety.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const json = (res, code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
const body = req => new Promise((ok, no) => { let s = ''; req.on('data', d => { s += d; }); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { no(e); } }); });

async function oficina() {
  const almacen = crearAlmacen({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'ao-cont-')), medioExiste: m => /^2026-10\/[\w-]+\.(png|jpg)$/.test(m) });
  const avisos = [];
  const handle = crearRutas({ almacen, json, body, notice: (k, t, o) => avisos.push({ k, t, o }) });
  const srv = http.createServer(async (req, res) => { const u = new URL(req.url, 'http://x'); if (!await handle(req, res, u)) json(res, 404, { error: 'no' }); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const api = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
  return { almacen, avisos, base, api, cerrar: () => srv.close() };
}

function mcp(base, agente = 'newt', tarea = 't1') {
  const p = spawn(process.execPath, [path.join(ROOT, 'contenido-mcp.mjs')], { env: { ...process.env, AO_OFFICE: base, AO_AGENT: agente, AO_TASK: tarea }, stdio: ['pipe', 'pipe', 'inherit'] });
  const espera = new Map(); let buf = '';
  p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); try { const m = JSON.parse(l); espera.get(m.id)?.(m); } catch {} } });
  let n = 0;
  const rpc = (method, params) => new Promise(ok => { const id = ++n; espera.set(id, ok); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  return { rpc, tools: async () => (await rpc('tools/list')).result.tools, llamar: async (name, args) => (await rpc('tools/call', { name, arguments: args })).result, cerrar: () => p.kill() };
}
const texto = r => r.content[0].text;

test('las herramientas que reciben los agentes no aprueban, no programan y no publican', async () => {
  const o = await oficina(), m = mcp(o.base);
  try {
    const init = await m.rpc('initialize', {}); assert.equal(init.result.serverInfo.name, 'contenido');
    const nombres = (await m.tools()).map(t => t.name);
    assert.deepEqual(nombres.sort(), ['crear_borrador', 'mejorar_borrador', 'ver_calendario_contenido', 'ver_pieza']);
    for (const n of nombres) assert.doesNotMatch(n, /aprob|program|public|enviar|entreg|approve|schedule|publish|send/i, `«${n}» suena a una acción que un agente no debe tener`);
    const props = (await m.tools()).flatMap(t => Object.keys(t.inputSchema.properties || {}));
    assert.ok(!props.includes('estado') && !props.includes('aprobada'), 'ninguna herramienta deja elegir el estado');
    for (const n of nombres) assert.equal(kindOf(`mcp__contenido__${n}`), 'read', 'el candado de envío trata a Contenido como interno');
  } finally { m.cerrar(); o.cerrar(); }
});

test('un agente deja un borrador, lo ve en el calendario y lo mejora; el dueño recibe un aviso', async () => {
  const o = await oficina(), m = mcp(o.base);
  try {
    await m.rpc('initialize', {});
    const r = await m.llamar('crear_borrador', { titulo: 'Examen gratis', fecha: '2026-10-05', hora: '09:00', formato: 'post', redes: ['instagram', 'facebook'], texto: 'Agenda tu examen visual gratis.', hashtags: '#optica' });
    assert.ok(!r.isError, texto(r));
    assert.match(texto(r), /Borrador creado: p-20261005-[a-f0-9]{4} · 2026-10-05 09:00 · post · instagram\+facebook · borrador/);
    assert.match(texto(r), /le falta: Instagram necesita al menos una imagen o un video|Todavía le falta: Instagram necesita/);
    const lista = o.almacen.listar(); assert.equal(lista.length, 1);
    assert.equal(lista[0].estado, 'borrador'); assert.equal(lista[0].origen, 'agente:newt'); assert.equal(lista[0].tarea, 't1');
    assert.equal(o.avisos.length, 1); assert.match(o.avisos[0].t, /Un agente dejó un borrador en Contenido: «Examen gratis»/); assert.equal(o.avisos[0].o.key, 'contenido-t1');
    const cal = texto(await m.llamar('ver_calendario_contenido', { desde: '2026-10-01', hasta: '2026-10-31' })); assert.match(cal, /1 pieza\(s\)/); assert.match(cal, /«Examen gratis»/); assert.match(cal, /sin imagen/);
    const id = lista[0].id;
    assert.match(texto(await m.llamar('ver_pieza', { id })), /TEXTO:\nAgenda tu examen visual gratis\.[\s\S]*LE FALTA: Instagram necesita/);
    const mej = await m.llamar('mejorar_borrador', { id, medios: ['2026-10/examen.png'] });
    assert.match(texto(mej), /Ya cumple las reglas de cada red/); assert.deepEqual(o.almacen.leer(id).medios, ['2026-10/examen.png']);
    assert.match(texto(await m.llamar('ver_calendario_contenido', { desde: '2026-11-01', hasta: '2026-11-30' })), /libre/);
  } finally { m.cerrar(); o.cerrar(); }
});

test('un agente que inventa una imagen o un dato malo recibe el motivo en palabras, sin crear nada', async () => {
  const o = await oficina(), m = mcp(o.base);
  try {
    await m.rpc('initialize', {});
    const a = await m.llamar('crear_borrador', { texto: 'x', medios: ['2026-10/no-existe.gif'] }); assert.equal(a.isError, true); assert.match(texto(a), /el Estudio no tiene/);
    const b = await m.llamar('crear_borrador', { texto: 'x', fecha: 'pronto' }); assert.equal(b.isError, true); assert.match(texto(b), /AAAA-MM-DD/);
    const c = await m.llamar('crear_borrador', { texto: 'x', redes: ['tiktok'] }); assert.equal(c.isError, true); assert.match(texto(c), /no es una red/);
    assert.equal(o.almacen.listar().length, 0);
  } finally { m.cerrar(); o.cerrar(); }
});

test('la API no deja a quien llega como agente aprobar, devolver, elegir un estado ni tocar lo aprobado', async () => {
  const o = await oficina();
  try {
    const c = await o.api('POST', '/api/contenido/piezas', { por: 'agente', agente: 'newt', titulo: 'A', texto: 'hola', fecha: '2026-10-05', estado: 'aprobada', medios: ['2026-10/a.png'] });
    assert.equal(c.status, 200); assert.equal(c.pieza.estado, 'borrador', 'un agente no puede crearla aprobada: queda borrador');
    const id = c.pieza.id;
    assert.equal((await o.api('POST', `/api/contenido/piezas/${id}/aprobar`, { por: 'agente' })).status, 403);
    assert.equal((await o.api('POST', `/api/contenido/piezas/${id}/devolver`, { por: 'agente' })).status, 403);
    assert.equal((await o.api('PATCH', `/api/contenido/piezas/${id}`, { por: 'agente', estado: 'revision' })).pieza.estado, 'borrador', 'el estado que manda un agente se ignora');
    // el dueño la aprueba; desde ahí, el agente ya no la toca
    const ok = await o.api('POST', `/api/contenido/piezas/${id}/aprobar`, { quien: 'Abrinay' }); assert.equal(ok.status, 200); assert.equal(ok.pieza.estado, 'aprobada');
    const tocar = await o.api('PATCH', `/api/contenido/piezas/${id}`, { por: 'agente', texto: 'cambiado' }); assert.equal(tocar.status, 409); assert.match(tocar.error, /solo el dueño/);
    assert.equal(o.almacen.leer(id).texto, 'hola');
  } finally { o.cerrar(); }
});

test('el dueño aprueba lo que puede salir, y la pantalla recibe el motivo de lo que no', async () => {
  const o = await oficina();
  try {
    const p = (await o.api('POST', '/api/contenido/piezas', { titulo: 'B', fecha: '2026-10-06', texto: 'Hola' })).pieza;
    const no = await o.api('POST', `/api/contenido/piezas/${p.id}/aprobar`, {});
    assert.equal(no.status, 409); assert.match(no.error, /todavía no puede salir/); assert.ok(no.errores.length);
    assert.ok(p.revision.errores.length && 'arreglos' in p.revision, 'cada pieza trae su revisión: errores, avisos y el arreglo de cada uno');
    await o.api('PATCH', `/api/contenido/piezas/${p.id}`, { medios: ['2026-10/b.jpg'] });
    assert.equal((await o.api('POST', `/api/contenido/piezas/${p.id}/aprobar`, {})).status, 200);
    const cambio = await o.api('PATCH', `/api/contenido/piezas/${p.id}`, { texto: 'Hola, con otro precio' }); assert.equal(cambio.soltada, true); assert.equal(cambio.pieza.estado, 'revision');
    const r = (await o.api('GET', '/api/contenido/resumen')); assert.deepEqual([r.total, r.revisar, r.aprobadas], [1, 1, 0]);
    assert.equal((await o.api('POST', `/api/contenido/piezas/${p.id}/devolver`, { estado: 'borrador' })).pieza.estado, 'borrador');
    assert.equal((await o.api('GET', '/api/contenido?desde=2026-10-01&hasta=2026-10-31')).piezas.length, 1);
    assert.equal((await o.api('GET', '/api/contenido/usos?medio=2026-10/b.jpg')).usos.length, 1);
    assert.equal((await o.api('DELETE', `/api/contenido/piezas/${p.id}`)).ok, true);
    assert.equal((await o.api('GET', `/api/contenido/piezas/${p.id}`)).status, 404);
    assert.equal((await o.api('GET', '/api/contenido/otra-cosa')).status, 404);
    assert.equal((await o.api('GET', '/api/contenido/piezas/no-es-un-id!')).status, 404);
  } finally { o.cerrar(); }
});
