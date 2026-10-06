// Plan M1 (6 oct 2026): la cola que lleva lo aprobado al conductor — contenido/entrega.mjs, contenido/programador.mjs y contenido/conductores.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { crearAlmacen } from '../contenido/piezas.mjs';
import { entregasDe, estadoGeneral } from '../contenido/entrega.mjs';
import { planear, crearProgramador, GRACIA_MS } from '../contenido/programador.mjs';
import { crearSimulacro, crearConductorMetricool, crearConductorMeta } from '../contenido/conductores.mjs';
import { crearMetricool } from '../contenido/metricool.mjs';
import { levantarMetricool } from './metricool-stand.mjs';
import http from 'node:http';
import { crearRutas } from '../contenido/rutas.mjs';

const H = 3600e3, DIA = 24 * H;
const ymd = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hm = ms => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ao-prog-'));

function montar({ conductor: hacer, modo = 'simulacro', horasAntes = 24 } = {}) {
  const dir = tmp(); let reloj = new Date(2026, 9, 6, 10, 0).getTime();
  const ahora = () => reloj, avisos = [], audit = [];
  const almacen = crearAlmacen({ dir: path.join(dir, 'piezas'), ahora });
  const sim = crearSimulacro({ archivo: path.join(dir, 'simulacro.json'), ahora });
  let c = hacer ? hacer({ dir, ahora }) : sim, m = modo;
  const prog = crearProgramador({ almacen, archivo: path.join(dir, 'cola.json'), conductor: () => c, modo: () => m, horasAntes: () => horasAntes, avisar: (t, o) => avisos.push({ t, ...o }), auditar: a => audit.push(a), ahora });
  return { dir, almacen, sim, prog, avisos, audit, avanzar: ms => { reloj += ms; }, ahora, set conductor(x) { c = x; }, set modo(x) { m = x; } };
}
const nuevaAprobada = (t, { dias = 2, extra = {} } = {}) => {
  const momento = t.ahora() + dias * DIA;
  const p = t.almacen.crear({ titulo: 'Examen gratis', fecha: ymd(momento), hora: hm(momento), redes: ['facebook'], texto: 'Agenda tu examen visual.', estado: 'revision', ...extra }).pieza;
  const a = t.almacen.aprobar(p.id); assert.equal(a.error, undefined, a.error); return a.pieza;
};

test('entregasDe: post e historia aparte, y las redes con el mismo texto juntas', () => {
  const base = { fecha: '2026-10-12', hora: '09:00', formato: 'post', redes: ['instagram', 'facebook', 'linkedin'], medios: ['2026-10/a.jpg'], texto: 'Hola', hashtags: '#optica', comentario: 'link', historiaTambien: true, historias: ['2026-10/h.jpg'] };
  const e = entregasDe(base);
  assert.deepEqual(e.map(x => [x.variante, x.redes]), [['post', ['instagram', 'facebook', 'linkedin']], ['historia', ['instagram', 'facebook']]]);
  assert.equal(e[1].momento - e[0].momento, 15 * 60e3, 'la historia sale 15 minutos después');
  assert.equal(e[1].texto, ''); assert.deepEqual(e[1].medios, ['2026-10/h.jpg']);
  const fb = entregasDe({ ...base, historiaTambien: false, textoFacebook: 'Solo para Facebook', textos: { linkedin: 'Para LinkedIn' } });
  assert.deepEqual(fb.map(x => x.redes), [['instagram'], ['facebook'], ['linkedin']], 'cada texto distinto es una publicación');
  assert.equal(estadoGeneral({ a: { estado: 'publicada' }, b: { estado: 'fallo' } }), 'parcial');
  assert.equal(estadoGeneral({ a: { estado: 'publicada' } }), 'publicada'); assert.equal(estadoGeneral({ a: { estado: 'en_red' }, b: { estado: 'fallo' } }), 'en_red');
});

test('planear: nada antes de la gracia ni de la ventana; vencida si su hora pasó; retirar si perdió el OK', () => {
  const t0 = new Date(2026, 9, 6, 10, 0).getTime(), mom = t0 + 2 * DIA;
  const p = { id: 'p-1', estado: 'aprobada', aprobada: { huella: 'h1', cuando: new Date(t0).toJSON() }, fecha: ymd(mom), hora: hm(mom), redes: ['facebook'], texto: 'x', medios: [] };
  assert.deepEqual(planear([p], {}, { ahora: t0 }).map(a => a.tipo), ['encolar']);
  const e = { estado: 'espera', huella: 'h1', momento: mom, entregarDesde: mom - DIA, historial: [] };
  assert.deepEqual(planear([p], { 'p-1': e }, { ahora: t0 + 30e3 }), [], 'ni en la gracia ni antes de la ventana');
  assert.deepEqual(planear([p], { 'p-1': { ...e, entregarDesde: 0 } }, { ahora: t0 + 30e3 }), [], 'la gracia manda aunque se pida «ya»');
  assert.deepEqual(planear([p], { 'p-1': { ...e, entregarDesde: 0 } }, { ahora: t0 + GRACIA_MS + 1 }).map(a => a.tipo), ['entregar']);
  assert.deepEqual(planear([p], { 'p-1': e }, { ahora: mom - 60e3 }).map(a => a.tipo), ['vencer']);
  assert.deepEqual(planear([{ ...p, estado: 'revision', aprobada: null }], { 'p-1': { ...e, estado: 'en_red', remoto: { 'post:0': { id: 'x' } } } }, { ahora: t0 }).map(a => a.tipo), ['retirar']);
  assert.deepEqual(planear([p], { 'p-1': { ...e, estado: 'publicada' } }, { ahora: t0 }), [], 'lo publicado no se vuelve a publicar');
  assert.deepEqual(planear([p], { 'p-1': { ...e, huella: 'h0', estado: 'en_red', remoto: { a: {} } } }, { ahora: t0 }).map(a => a.tipo), ['retirar'], 'otra versión entregada: se retira primero');
});

test('el circuito con el simulacro: aprobar, esperar la ventana, entregar, publicar, avisar', async () => {
  const t = montar();
  const p = nuevaAprobada(t);
  await t.prog.tick(); assert.equal(t.prog.salidaDe(p.id).estado, 'espera');
  t.avanzar(2 * 60e3); await t.prog.tick(); assert.equal(t.prog.salidaDe(p.id).estado, 'espera', 'faltan más de 24 h: todavía se edita sin límites');
  assert.deepEqual(t.prog.entregarYa(p.id), { ok: true }); await t.prog.tick();
  const s = t.prog.salidaDe(p.id); assert.equal(s.estado, 'en_red'); assert.equal(s.conductor, 'simulacro');
  assert.equal(t.almacen.leer(p.id).entregada.conductor, 'simulacro', 'el doble testigo: la nota también lo dice');
  t.avanzar(2 * DIA + 11 * 60e3); await t.prog.tick();
  assert.equal(t.prog.salidaDe(p.id).estado, 'publicada'); assert.match(t.prog.salidaDe(p.id).redes.facebook.url, /simulacro\.invalid/);
  assert.ok(t.avisos.some(a => /Publicada: «Examen gratis» \(simulacro/.test(a.t)));
  assert.ok(t.audit.some(a => a.que === 'entregada') && t.audit.some(a => a.que === 'publicada'));
  t.avanzar(DIA); await t.prog.tick(); assert.equal(t.prog.salidaDe(p.id).estado, 'publicada', 'no se publica dos veces');
});

test('cambiar una pieza entregada la retira; volver a aprobarla la entrega otra vez', async () => {
  const t = montar({ horasAntes: 999 });
  const p = nuevaAprobada(t); await t.prog.tick(); t.avanzar(2 * 60e3); await t.prog.tick();
  assert.equal(t.prog.salidaDe(p.id).estado, 'en_red');
  const g = t.almacen.guardar(p.id, { texto: 'Otro texto' }); assert.equal(g.soltada, true);
  await t.prog.tick(); assert.equal(t.prog.salidaDe(p.id).estado, 'cancelada'); assert.equal(t.almacen.leer(p.id).entregada, null);
  const sim = JSON.parse(fs.readFileSync(path.join(t.dir, 'simulacro.json'), 'utf8')); assert.equal(Object.values(sim.posts).filter(x => x.borrada).length, 1);
  t.avanzar(10e3); t.almacen.aprobar(p.id); await t.prog.tick(); t.avanzar(2 * 60e3); await t.prog.tick();
  assert.equal(t.prog.salidaDe(p.id).estado, 'en_red');
  t.prog.cancelar(p.id); await t.prog.tick(); assert.equal(t.prog.salidaDe(p.id).estado, 'cancelada', '«Quitar de la cola» le quita el OK y la retira');
});

test('doble testigo: si se pierde la cola, lo entregado se adopta y no se entrega dos veces', async () => {
  const t = montar({ horasAntes: 999 });
  const p = nuevaAprobada(t); await t.prog.tick(); t.avanzar(2 * 60e3); await t.prog.tick();
  const antes = Object.keys(JSON.parse(fs.readFileSync(path.join(t.dir, 'simulacro.json'), 'utf8')).posts).length;
  fs.rmSync(path.join(t.dir, 'cola.json'));
  await t.prog.tick(); t.avanzar(2 * 60e3); await t.prog.tick();
  assert.equal(t.prog.salidaDe(p.id).estado, 'en_red');
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(t.dir, 'simulacro.json'), 'utf8')).posts).length, antes, 'ninguna publicación nueva');
  assert.ok(t.audit.some(a => a.que === 'adoptada'));
});

test('apagado no entrega; un conductor sin key espera y lo dice; Meta directo dice por qué no', async () => {
  const t = montar({ modo: 'apagado', horasAntes: 999 });
  const p = nuevaAprobada(t); await t.prog.tick(); assert.equal(t.prog.salidaDe(p.id), null);
  t.modo = 'real'; t.conductor = crearConductorMeta();
  await t.prog.tick(); t.avanzar(2 * 60e3); await t.prog.tick();
  const s = t.prog.salidaDe(p.id); assert.equal(s.estado, 'espera'); assert.match(s.error, /Metricool/);
  assert.equal(t.prog.estado().conductor.ok, false);
});

test('Metricool: convierte a JPEG para Instagram, sube, programa, y al publicarse lo sabe; un fallo pasajero se reintenta', async () => {
  const s = await levantarMetricool();
  try {
    const mc = crearMetricool({ env: s.env });
    const t = montar({ modo: 'real', horasAntes: 999, conductor: ({ dir }) => {
      const png = path.join(dir, 'a.png');
      return crearConductorMetricool({ mc, rutaMedio: id => (id === '2026-10/a.png' ? png : null), aJpeg: b => sharp(b).jpeg().toBuffer(), cache: path.join(dir, 'subidas.json') });
    } });
    await sharp({ create: { width: 1080, height: 1350, channels: 3, background: '#2158CC' } }).png().toFile(path.join(t.dir, 'a.png'));
    const p = nuevaAprobada(t, { extra: { redes: ['instagram', 'facebook'], medios: ['2026-10/a.png'], hashtags: '#optica' } });
    await t.prog.tick(); t.avanzar(2 * 60e3); await t.prog.tick();
    assert.equal(t.prog.salidaDe(p.id).estado, 'en_red', t.prog.salidaDe(p.id).error);
    assert.equal([...s.subidas.values()][0].tipo, 'image/jpeg', 'Instagram solo acepta JPEG: la PNG se convirtió');
    const post = [...s.posts.values()][0];
    assert.deepEqual(post.providers.map(x => x.network), ['instagram', 'facebook']); assert.match(post.media[0], /\.jpg$/); assert.equal(post.autoPublish, true);
    assert.match(post.text, /#optica/);
    s.publicar({ fallan: ['facebook'] }); t.avanzar(3 * DIA - 60e3); await t.prog.tick();
    const fin = t.prog.salidaDe(p.id); assert.equal(fin.estado, 'parcial'); assert.equal(fin.redes.facebook.detalle, 'Media not valid');
    assert.ok(t.avisos.some(a => a.level === 'error' && /salió solo en algunas redes/.test(a.t)));
  } finally { await s.cerrar(); }

  const s2 = await levantarMetricool({ fallar: { 'POST /v2/scheduler/posts': [503, 'down'] } });
  try {
    const mc = crearMetricool({ env: s2.env });
    const t = montar({ modo: 'real', horasAntes: 999, conductor: ({ dir }) => crearConductorMetricool({ mc, rutaMedio: () => null, aJpeg: b => b, cache: path.join(dir, 'subidas.json') }) });
    const p = nuevaAprobada(t); await t.prog.tick(); t.avanzar(2 * 60e3); await t.prog.tick();
    let x = t.prog.salidaDe(p.id); assert.equal(x.estado, 'espera'); assert.equal(x.intentos, 1); assert.ok(x.siguienteIntento > t.ahora());
    for (const w of [61e3, 301e3, 901e3]) { t.avanzar(w); await t.prog.tick(); }
    x = t.prog.salidaDe(p.id); assert.equal(x.estado, 'fallo'); assert.match(x.error, /fallando/);
    assert.match(t.prog.reintentar(p.id).error || '', /^$/); assert.equal(t.prog.salidaDe(p.id).estado, 'espera');
  } finally { await s2.cerrar(); }
});

test('las rutas: cada pieza trae su salida; la cola y la conexión se miran; un agente no toca la cola', async () => {
  const s = await levantarMetricool(), t = montar({ horasAntes: 999 });
  const json = (res, code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  const body = req => new Promise(ok => { let x = ''; req.on('data', d => { x += d; }); req.on('end', () => ok(x ? JSON.parse(x) : {})); });
  const handle = crearRutas({ almacen: t.almacen, json, body, programador: t.prog, metricool: crearMetricool({ env: s.env }) });
  const sin = crearRutas({ almacen: t.almacen, json, body, programador: t.prog, metricool: crearMetricool({ env: {} }) });
  let usar = handle;
  const srv = http.createServer(async (req, res) => { if (!await usar(req, res, new URL(req.url, 'http://x'))) json(res, 404, {}); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const api = async (m, p, b) => { const r = await fetch(`http://127.0.0.1:${srv.address().port}${p}`, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, ...(await r.json()) }; };
  try {
    const p = nuevaAprobada(t); await t.prog.tick(); t.avanzar(2 * 60e3);
    const tk = await api('POST', '/api/contenido/cola/tick'); assert.equal(tk.cuenta.en_red, 1);
    const l = await api('GET', '/api/contenido'); assert.equal(l.piezas[0].salida.estado, 'en_red'); assert.equal(l.resumen.fallos, 0);
    assert.equal((await api('GET', '/api/contenido/cola')).modo, 'simulacro');
    assert.equal((await api('POST', `/api/contenido/piezas/${p.id}/quitar`, { por: 'agente' })).status, 403);
    assert.equal((await api('POST', `/api/contenido/piezas/${p.id}/reintentar`)).status, 409, 'no falló: nada que reintentar');
    const q = await api('POST', `/api/contenido/piezas/${p.id}/quitar`); assert.equal(q.ok, true); assert.equal(q.pieza.estado, 'revision');
    const c = await api('POST', '/api/contenido/conductor/comprobar'); assert.equal(c.ok, true); assert.equal(c.marca.nombre, 'PanaClaw');
    usar = sin; const c2 = await api('POST', '/api/contenido/conductor/comprobar'); assert.equal(c2.ok, false); assert.match(c2.error, /METRICOOL_USER_TOKEN/);
  } finally { srv.close(); await s.cerrar(); }
});
