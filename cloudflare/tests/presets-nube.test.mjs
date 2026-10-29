// Fase 4 A+B (carril D): el banco de presets en la nube. Lista y compila sin gastar; aplica con los topes del Estudio; los presets propios
// son notas del Cerebro en D1; lo que necesita sharp se dice en español y nunca cae a la IA. Motores de mentira en 127.0.0.1: jamás una llave real.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { manejar } from '../worker/lib/rutas.js';
import * as estudio from '../worker/modulos/estudio.js';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';
import { crearR2 } from './r2-memoria.mjs';
import { SIN_LOCAL } from '../worker/lib/estudio/presets.js';

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.from([0, 0, 4, 0, 0, 0, 2, 0]), Buffer.alloc(30)]);
const dataUrl = (buf, mime) => `data:${mime};base64,${buf.toString('base64')}`;
const CLAVE = 'g-prueba-123456'; // secrets-ok: una llave inventada del doble de prueba

async function google() {
  const seen = [];
  const srv = http.createServer((req, res) => { const ch = []; req.on('data', (d) => ch.push(d)); req.on('end', () => {
    let body = null; try { body = JSON.parse(Buffer.concat(ch).toString('utf8')); } catch { /* vacío */ }
    seen.push({ url: req.url, body, key: req.headers['x-goog-api-key'] });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] }));
  }); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { seen, base: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}
async function montar(extra = {}, rol = 'admin') {
  const d1 = crearD1(), admin = await sembrar(d1, { rol }), R2 = crearR2();
  const env = { ...envDePrueba(d1), MEDIA: R2, ...extra };
  const r = await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: admin.email, contrasena: admin.clave } });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const api = async (ruta, o = {}) => { const res = await pedir(manejar, env, ruta, { ...o, cookie }); const t = await res.text(); let j = null; try { j = JSON.parse(t); } catch { /* binario */ } return { status: res.status, j, t }; };
  return { d1, env, R2, api };
}
const subirFoto = async (api) => (await api('/api/media/upload', { metodo: 'POST', cuerpo: { name: 'bodega', data: dataUrl(png, 'image/png') } })).j.item.file;

test('GET /api/media/presets: la fábrica entera sin sharp; lo que lo exige sale marcado «solo en la oficina», no oculto', { skip: SALTAR }, async () => {
  const { api } = await montar({ GEMINI_API_KEY: CLAVE });
  const x = await api('/api/media/presets?medio=image');
  assert.equal(x.status, 200);
  assert.ok(x.j.presets.length >= 100 && x.j.fabrica.grupos.length > 5 && x.j.fabrica.canales.length > 3 && x.j.sharp === false);
  const local = x.j.presets.find((p) => p.id === 'luz-mas-clara');
  assert.equal(local.on, false); assert.equal(local.motivo, SIN_LOCAL);
  const ia = x.j.presets.find((p) => p.id === 'enc-desde-arriba');
  assert.equal(ia.on, true); assert.ok(ia.modelos.length);
  const q = await api('/api/media/presets?q=' + encodeURIComponent('fondo blanco'));
  assert.ok(q.j.presets.length > 0 && q.j.presets[0].score != null);
  assert.deepEqual(x.j.propios, []);
});

test('compilar no gasta: el plan trae el costo, y lo de sharp dice en español que la nube todavía no lo hace; la QA no se inventa', { skip: SALTAR }, async () => {
  const g = await google();
  try {
    const { api } = await montar({ GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base });
    const ok = await api('/api/media/presets/compile', { metodo: 'POST', cuerpo: { pila: ['enc-desde-arriba'], idea: 'una cafetera' } });
    assert.equal(ok.status, 200); assert.deepEqual(ok.j.plan.errores, []); assert.ok(ok.j.plan.costo.usd > 0 && ok.j.plan.request.model);
    assert.ok(ok.j.budget);
    const foto = await subirFoto(api);
    const qa = await api('/api/media/presets/compile', { metodo: 'POST', cuerpo: { pila: ['fondo-gris'], entradas: { foto: [foto] } } });
    assert.deepEqual(qa.j.plan.errores, []);
    assert.ok(qa.j.plan.avisos.some((a) => a.tipo === 'qa' && /QA/.test(a.texto)), 'avisa que la QA no corre en la nube');
    const sin = await api('/api/media/presets/compile', { metodo: 'POST', cuerpo: { pila: ['luz-mas-clara'], entradas: { foto: [foto] } } });
    assert.ok(sin.j.plan.errores.length && /nube/.test(sin.j.plan.errores[0]) && !/esta máquina/.test(sin.j.plan.errores[0]), sin.j.plan.errores.join('|'));
    const blanco = await api('/api/media/presets/compile', { metodo: 'POST', cuerpo: { pila: ['fondo-blanco'], entradas: { foto: [foto] } } });
    assert.ok(blanco.j.plan.errores.length, 'el blanco 255 necesita sharp: no cae a la IA');
    assert.equal(g.seen.length, 0, 'compilar jamás llama a un motor');
  } finally { await g.close(); }
});

test('un lector puede mirar el banco pero no compilar, aplicar ni guardar (la matriz de roles: toda escritura es de editor o administrador)', { skip: SALTAR }, async () => {
  const { api } = await montar({ GEMINI_API_KEY: CLAVE }, 'lectura');
  assert.equal((await api('/api/media/presets')).status, 200);
  assert.equal((await api('/api/media/presets/compile', { metodo: 'POST', cuerpo: { pila: ['enc-desde-arriba'], idea: 'x' } })).status, 403);
  assert.equal((await api('/api/media/presets/apply', { metodo: 'POST', cuerpo: { pila: ['enc-desde-arriba'], idea: 'x' } })).status, 403);
  assert.equal((await api('/api/media/presets', { metodo: 'POST', cuerpo: { nombre: 'x', receta: { pila: ['enc-desde-arriba'] } } })).status, 403);
});

test('aplicar: solo el administrador, por los topes, UN trabajo con el rastro del preset; un plan con errores no crea nada', { skip: SALTAR }, async () => {
  const g = await google();
  try {
    const { api, env, d1 } = await montar({ GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base });
    const foto = await subirFoto(api);
    const mal = await api('/api/media/presets/apply', { metodo: 'POST', cuerpo: { pila: ['luz-mas-clara'], entradas: { foto: [foto] } } });
    assert.equal(mal.status, 400); assert.ok(mal.j.plan.errores.length); assert.match(mal.j.error, /nube/);
    assert.equal((await d1.prepare('select count(*) n from estudio_trabajos').first()).n, 0, 'un plan con errores no crea trabajo');
    const e = await montar({ GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base }, 'editor');
    const no = await e.api('/api/media/presets/apply', { metodo: 'POST', cuerpo: { pila: ['enc-desde-arriba'], idea: 'una cafetera' } });
    assert.equal(no.status, 403); assert.match(no.j.error, /administrador/); assert.equal(g.seen.length, 0);

    await api('/api/media/limites', { metodo: 'PUT', cuerpo: { dailyBudget: 0.01 } });
    const tope = await api('/api/media/presets/apply', { metodo: 'POST', cuerpo: { pila: ['enc-desde-arriba'], idea: 'una cafetera' } });
    assert.equal(tope.status, 400); assert.match(tope.j.error, /presupuesto|tope/i); assert.equal(g.seen.length, 0, 'los topes se miran antes de gastar');
    await api('/api/media/limites', { metodo: 'PUT', cuerpo: { dailyBudget: 0 } });

    const ok = await api('/api/media/presets/apply', { metodo: 'POST', cuerpo: { pila: ['enc-desde-arriba'], idea: 'una cafetera', n: 1 } });
    assert.equal(ok.status, 200); assert.equal(ok.j.jobs.length, 1); assert.equal(ok.j.jobs[0].state, 'queued'); assert.equal(g.seen.length, 0, 'aplicar pone el trabajo en cola; lo envía el cron');
    assert.deepEqual(ok.j.jobs[0].preset.map((p) => p.id), ['enc-desde-arriba']); assert.equal(ok.j.jobs[0].purpose, 'banco de presets');
    assert.ok(ok.j.jobs[0].receta.pila.length && ok.j.budget);
    await estudio.cadaMinuto(env);
    const h = (await api('/api/media/jobs')).j.jobs[0]; assert.equal(h.state, 'done'); assert.equal(g.seen.length, 1);
    const it = (await api('/api/media/item/' + encodeURIComponent(h.items[0]))).j;
    assert.equal(it.preset[0].id, 'enc-desde-arriba'); assert.ok(it.receta.pila.length, 'el archivo guarda su receta para «Guardar como preset»');
    assert.equal(it.qa, undefined, 'sin sharp no hay QA: nunca un ✓ inventado');
  } finally { await g.close(); }
});

test('el escenario 3D: la guía se sube UNA vez por escena y va de referencia; si el tope dice que no, la guía recién subida va a la papelera', { skip: SALTAR }, async () => {
  const g = await google();
  try {
    const { api, env } = await montar({ GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base });
    const escena = { producto: { tipo: 'cama-queen' } };
    const cuerpo = { pila: ['enc-desde-arriba'], idea: 'una cama', escena };
    const a = await api('/api/media/presets/apply', { metodo: 'POST', cuerpo });
    assert.equal(a.status, 200);
    const guia = a.j.jobs[0].media.reference.find((f) => !/escena:guia/.test(f)); assert.ok(guia, 'la guía va de referencia');
    assert.equal((await api('/api/media/item/' + encodeURIComponent(guia))).j.guia, true);
    const b = await api('/api/media/presets/apply', { metodo: 'POST', cuerpo });
    assert.equal(b.j.jobs[0].media.reference[0], guia, 'la misma escena reutiliza la guía');
    assert.equal((await api('/api/media?n=50')).j.items.filter((i) => i.guia).length, 1);
    // otra escena + tope alcanzado → no deja una guía huérfana
    await api('/api/media/limites', { metodo: 'PUT', cuerpo: { dailyBudget: 0.01 } });
    const c = await api('/api/media/presets/apply', { metodo: 'POST', cuerpo: { ...cuerpo, escena: { producto: { tipo: 'sofa' } } } });
    assert.equal(c.status, 400);
    assert.equal((await api('/api/media?n=50')).j.items.filter((i) => i.guia).length, 1, 'la guía de la escena rechazada no se queda en la galería');
    void env;
  } finally { await g.close(); }
});

test('mis presets son notas del Cerebro: guardar, listar, versionar, el mismo nombre con otras tildes es el mismo preset, borrar a la papelera', { skip: SALTAR }, async () => {
  const { api, d1 } = await montar({ GEMINI_API_KEY: CLAVE });
  const vacio = await api('/api/media/presets', { metodo: 'POST', cuerpo: { nombre: 'Catálogo web', receta: { pila: [] } } });
  assert.equal(vacio.status, 400); assert.match(vacio.j.error, /receta está vacía/);
  assert.equal((await api('/api/media/presets', { metodo: 'POST', cuerpo: { receta: { pila: ['enc-desde-arriba'] } } })).status, 400);
  const s = await api('/api/media/presets', { metodo: 'POST', cuerpo: { nombre: 'Catálogo web', receta: { pila: [{ id: 'enc-desde-arriba' }], canal: null }, frase: 'Mi catálogo' } });
  assert.equal(s.status, 200); assert.equal(s.j.preset.id, 'mio-catalogo-web'); assert.equal(s.j.preset.v, 1); assert.equal(s.j.archivo, 'Estudio/Presets/Catálogo web.md');
  const nota = await d1.prepare('select grupo, texto from notas where nombre = ?').bind('Catálogo web').first();
  assert.equal(nota.grupo, 'Estudio'); assert.match(nota.texto, /^---\ntipo: preset\n/);
  const l = await api('/api/media/presets?medio=image');
  const mio = l.j.presets.find((p) => p.id === 'mio-catalogo-web'); assert.ok(mio && mio.categoria === 'mios' && mio.propio.pila[0].id === 'enc-desde-arriba'); assert.deepEqual(l.j.propios, ['mio-catalogo-web']);
  // un preset propio en la pila se abre en su receta al compilar
  const c = await api('/api/media/presets/compile', { metodo: 'POST', cuerpo: { pila: ['mio-catalogo-web'], idea: 'una cafetera' } });
  assert.deepEqual(c.j.plan.errores, []); assert.ok(c.j.plan.preset.some((p) => p.id === 'enc-desde-arriba'));
  // mismo nombre sin tildes → la misma nota (v2) y la de antes queda en las versiones
  const s2 = await api('/api/media/presets', { metodo: 'POST', cuerpo: { nombre: 'Catalogo web', receta: { pila: [{ id: 'enc-desde-arriba', params: {} }] } } });
  assert.equal(s2.status, 200); assert.equal(s2.j.preset.v, 2); assert.equal((await d1.prepare("select count(*) n from notas where grupo = 'Estudio'").first()).n, 1);
  const v = await api('/api/media/presets/mio-catalogo-web/versiones'); assert.equal(v.j.versiones.length, 1); assert.equal(v.j.versiones[0].v, 1);
  assert.deepEqual((await api('/api/media/presets/mio-otro/versiones')).j.versiones, []);
  // una nota que no es un preset con ese nombre no se pisa
  await d1.prepare("insert into notas (nombre, grupo, oficina, texto, bytes, actualizado) values ('Mi nota', 'Estudio', 0, 'hola', 4, 1)").run();
  const choca = await api('/api/media/presets', { metodo: 'POST', cuerpo: { nombre: 'Mi nota', receta: { pila: ['enc-desde-arriba'] } } });
  assert.equal(choca.status, 409);
  // borrar
  assert.equal((await api('/api/media/presets/mio-no-existe', { metodo: 'DELETE' })).status, 404);
  assert.equal((await api('/api/media/presets/mio-catalogo-web', { metodo: 'DELETE' })).status, 200);
  assert.equal((await api('/api/media/presets?medio=image')).j.propios.length, 0);
  assert.equal((await d1.prepare('select count(*) n from notas_papelera').first()).n, 1, 'va a la papelera de 30 días, no se pierde');
});

test('guardar desde un archivo de la galería usa su receta; una imagen que no salió de un preset no tiene receta', { skip: SALTAR }, async () => {
  const g = await google();
  try {
    const { api, env } = await montar({ GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base });
    await api('/api/media/presets/apply', { metodo: 'POST', cuerpo: { pila: ['enc-desde-arriba'], idea: 'una cafetera' } });
    await estudio.cadaMinuto(env);
    const h = (await api('/api/media/jobs')).j.jobs[0];
    const ok = await api('/api/media/presets', { metodo: 'POST', cuerpo: { nombre: 'Desde arriba', desde: h.items[0] } });
    assert.equal(ok.status, 200); assert.equal(ok.j.preset.receta.pila[0].id, 'enc-desde-arriba');
    const foto = await subirFoto(api);
    const no = await api('/api/media/presets', { metodo: 'POST', cuerpo: { nombre: 'Foto suelta', desde: foto } });
    assert.equal(no.status, 400); assert.match(no.j.error, /no salió de un preset/);
    assert.equal((await api('/api/media/presets', { metodo: 'POST', cuerpo: { nombre: 'Nada', desde: 'no/existe.png' } })).status, 404);
  } finally { await g.close(); }
});

test('una nota de preset migrada desde la computadora (grupo «Estudio», sin escribir aquí) aparece en el banco; una rota se dice y no tumba el banco', { skip: SALTAR }, async () => {
  const { api, d1 } = await montar({ GEMINI_API_KEY: CLAVE });
  const notas = await import('../../presets-notas.mjs');
  const { cargarFabrica } = await import('../../presets/fabrica-worker.js');
  const fab = cargarFabrica(), byId = new Map(fab.presets.map((p) => [p.id, p]));
  const md = notas.presetANota({ tipo: 'propio', id: 'mio-bodega', nombre: 'Bodega', v: 1, medio: 'image', icono: 'marca', frase: 'Desde la oficina', receta: { pila: [{ id: 'enc-desde-arriba', params: {} }] }, enlaces: [], buscar: [], estado: 'beta' }, { byId });
  const ins = d1.prepare('insert into notas (nombre, grupo, oficina, texto, bytes, actualizado) values (?,?,0,?,?,1)');
  await ins.bind('Bodega', 'Estudio', md, md.length).run();
  await ins.bind('Rota', 'Estudio', '---\ntipo: preset\nid: mio-rota\nnombre: Rota\nmedio: image\npila: {no\n---\n# Rota\n', 50).run();
  const l = await api('/api/media/presets?medio=image');
  assert.ok(l.j.propios.includes('mio-bodega')); assert.ok(l.j.problemas.some((p) => /^Rota\.md:/.test(p)), l.j.problemas.join('|'));
  assert.equal(l.j.presets.filter((p) => p.id === 'enc-desde-arriba').length, 1);
});
