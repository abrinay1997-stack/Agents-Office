// Fase A3 de Anuncios (9 oct 2026): los BORRADORES de campaña y «Crear en Meta (en pausa)» contra el serve.mjs REAL (carpeta temporal) y el
// Meta de mentira como Graph. El dueño hace un borrador con fotos de la galería del Estudio, lo valida (validate_only), pide la vista previa
// de Meta, lo crea (202 → «creando» → «creado», todo PAUSED en Meta); un agente, el asistente y Dimitri no crean en Meta (403); Dimitri y el
// asistente dejan un borrador con la op anuncio_borrador (y se deshace a la papelera). Se espera AL HECHO, nunca un tiempo fijo corto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crearMetaStand, TOKEN_STAND, CUENTA_STAND } from './meta-stand.mjs';
import { PERMISOS_LECTURA, PERMISOS_ANUNCIOS } from '../contenido/meta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const esperar = async (fn, { max = 60000, cada = 250, que = 'algo' } = {}) => { const t0 = Date.now(); for (;;) { const r = await fn(); if (r) return r; if (Date.now() - t0 > max) throw new Error(`no llegó a tiempo: ${que}`); await new Promise(x => setTimeout(x, cada)); } };

test('Anuncios A3: borrador → validar → vista previa → crear EN PAUSA en Meta; solo el dueño crea; Dimitri y el asistente dejan borradores', { timeout: 240000 }, async t => {
  const g = crearMetaStand({ permisos: [...PERMISOS_LECTURA, ...PERMISOS_ANUNCIOS] });
  const graph = await g.escuchar();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-anuncios-a3-')), brain = path.join(dir, 'brain'), local = path.join(dir, 'office.config.local.json');
  fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana.\n');
  fs.writeFileSync(local, JSON.stringify({ anuncios: { cuenta: CUENTA_STAND, pagina: '1000001', instagram: '2000002', topeDiario: 30, topeMensual: 300, topeCampana: 150 } }));
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: local,
    ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', CLAUDE_BIN: path.join(dir, 'no-claude.exe'),
    META_ACCESS_TOKEN: TOKEN_STAND, META_APP_SECRET: '', META_GRAPH_HOST: graph.url, META_GRAPH_VERSION: '',
    TELEGRAM_BOT_TOKEN: '', METRICOOL_USER_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '', VOYAGE_API_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  t.after(async () => { srv.kill(); await graph.cerrar(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  const base = `http://127.0.0.1:${port}`;
  await esperar(async () => { try { return (await fetch(base + '/api/health')).ok; } catch { return false; } }, { max: 30000, que: 'la oficina arranca: ' + log.slice(-300) });
  const call = async (p, b, metodo) => { const r = await fetch(base + p, { method: metodo || (b ? 'POST' : 'GET'), headers: { 'content-type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }); let j = {}; try { j = await r.json(); } catch {} return { status: r.status, j }; };

  // tres fotos en la galería del Estudio
  const sharp = (await import('sharp')).default, fotos = [];
  for (let i = 0; i < 3; i++) {
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 40 * i, g: 120, b: 200 } } }).png().toBuffer();
    const u = await call('/api/media/upload', { name: `combo ${i}.png`, data: 'data:image/png;base64,' + png.toString('base64') });
    assert.equal(u.status, 200, JSON.stringify(u.j)); fotos.push(u.j.item.file);
  }
  const g2 = await call('/api/media?kind=image,video&n=60');
  assert.ok(fotos.every(f => g2.j.items.some(x => x.file === f && x.kind === 'image' && x.w === 40 && x.h === 40)), 'la galería da file, kind, w y h');

  // 1) el borrador: los valores por defecto y lo que falta
  let r = await call('/api/anuncios/borradores', { nombre: 'Combo 2x1' });
  assert.equal(r.status, 200, JSON.stringify(r.j)); const id = r.j.borrador.id;
  assert.equal(r.j.borrador.objetivo, 'mensajes'); assert.equal(r.j.borrador.destino, 'instagram', 'sin WhatsApp en Ajustes, Instagram'); assert.equal(r.j.borrador.de, 'dueno');
  r = await call(`/api/anuncios/borradores/${id}/validar`, {});
  assert.equal(r.status, 200); assert.equal(r.j.borrador.validacion.ok, false); assert.ok(r.j.borrador.validacion.problemas.some(p => p.campo === 'creativos' && /Faltan creativos/.test(p.texto)));
  r = await call(`/api/anuncios/borradores/${id}/crear`, {});
  assert.equal(r.status, 422); assert.equal(r.j.error, 'validacion');
  r = await call(`/api/anuncios/borradores/${id}`, { presupuesto: { usd: 8 }, creativos: fotos.map((f, i) => ({ media: f, formato: i === 2 ? '9:16' : '1:1', texto: `Escríbenos y pide tu combo ${i + 1}` })) }, 'PATCH');
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(r.j.borrador.creativos.length, 3); assert.equal(r.j.borrador.validacion, null);
  r = await call(`/api/anuncios/borradores/${id}/validar`, {});
  assert.equal(r.j.borrador.validacion.ok, true, JSON.stringify(r.j.borrador.validacion.problemas)); assert.equal(r.j.borrador.validacion.meta.ok, true);
  assert.deepEqual(r.j.borrador.validacion.costoMax, { dia: 8, total: null, campana: 150, sinLimite: false });
  assert.equal(Object.keys(g.st.campanas).length, 0, 'validar no crea nada');

  // 2) la vista previa de Meta
  r = await call(`/api/anuncios/borradores/${id}/vista-previa?formato=INSTAGRAM_STANDARD`);
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.match(r.j.html, /INSTAGRAM_STANDARD/);

  // 3) solo el dueño crea en Meta
  for (const por of ['agente', 'asistente', 'dimitri']) assert.equal((await call(`/api/anuncios/borradores/${id}/crear`, { por, agente: 'ada' })).status, 403, por);
  r = await call(`/api/anuncios/borradores/${id}/crear`, {});
  assert.equal(r.status, 202, JSON.stringify(r.j));
  const hecho = await esperar(async () => { const b = (await call('/api/anuncios/borradores')).j.items.find(x => x.id === id); return b && b.estado !== 'creando' ? b : null; }, { que: 'que termine de crearse' });
  assert.equal(hecho.estado, 'creado', hecho.error);
  assert.equal(Object.keys(g.st.campanas).length, 1); assert.equal(Object.keys(g.st.anuncios).length, 3);
  assert.ok([...Object.values(g.st.campanas), ...Object.values(g.st.conjuntos), ...Object.values(g.st.anuncios)].every(x => x.status === 'PAUSED'), 'todo EN PAUSA');
  assert.equal(Object.values(g.st.creativos)[0].object_story_spec.page_id, '1000001'); assert.equal(Object.values(g.st.creativos)[0].object_story_spec.instagram_user_id, '2000002');
  assert.equal((await call(`/api/anuncios/borradores/${id}/crear`, {})).status, 409, 'no dos veces');
  assert.equal((await call(`/api/anuncios/borradores/${id}`, { nombre: 'Otra' }, 'PATCH')).status, 409, 'uno creado no se cambia');
  assert.ok((await call('/api/anuncios/historial')).j.items.some(h => h.que === 'crear en pausa' && h.objeto.id === hecho.meta.campana));
  const audit = fs.readdirSync(path.join(dir, 'data', 'audit')).map(f => fs.readFileSync(path.join(dir, 'data', 'audit', f), 'utf8')).join('');
  assert.match(audit, /"kind":"anuncios"[^\n]*"que":"crear en pausa"/);
  await esperar(async () => (await call('/api/anuncios')).j.campanas?.some(c => c.id === hecho.meta.campana && c.estado === 'PAUSED' && !c.creadoFuera), { que: 'la campaña nueva en la vista, de la oficina' });

  // 4) un agente deja el suyo; no quita, no crea
  r = await call('/api/anuncios/borradores', { por: 'agente', agente: 'ada', nombre: 'Idea de ada' });
  assert.equal(r.status, 200); assert.equal(r.j.borrador.de, 'agente:ada');
  assert.equal((await call(`/api/anuncios/borradores/${r.j.borrador.id}`, { por: 'agente', agente: 'ada' }, 'DELETE')).status, 403);
  assert.equal((await call(`/api/anuncios/borradores/${r.j.borrador.id}`, {}, 'DELETE')).status, 200, 'el dueño sí (a la papelera)');

  // 5) el asistente por /api/oficina/accion: anuncio_borrador sí (y se deshace); crear en Meta no existe para él
  r = await call('/api/oficina/accion', { op: { type: 'anuncio_borrador', nombre: 'Del asistente', objetivo: 'mensajes', usd: 6, texto: 'Hola', media: [fotos[0]] } });
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.ok(r.j.deshacer);
  const delAsistente = (await call('/api/anuncios/borradores')).j.items.find(b => b.de === 'asistente');
  assert.ok(delAsistente); assert.equal(delAsistente.creativos[0].media, fotos[0]); assert.equal(delAsistente.presupuesto.usd, 6);
  assert.equal((await call('/api/oficina/deshacer', { deshacer: r.j.deshacer })).status, 200);
  assert.ok(!(await call('/api/anuncios/borradores')).j.items.some(b => b.id === delAsistente.id), 'deshecho: a la papelera');
  assert.equal(Object.keys(g.st.campanas).length, 1, 'nada más en Meta');
});
