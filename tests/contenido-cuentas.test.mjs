// 9 oct 2026 — LA CUENTA de una pieza (pedido del dueño: «cuando voy a programar no sé a qué cuenta se programará de todas las que puedo
// ver»). Lo puro (src/contenido-cuentas.js), la nota y su huella (contenido/piezas.mjs), la entrega (contenido/entrega.mjs), la ruta
// GET /api/contenido/cuentas, y publicar con Meta en la página y el Instagram elegidos, contra el Graph de mentira (tests/meta-stand.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { limpiarCuentas, cuentasLimpias, porDefecto, motivoNoPublica, listaCuentas, cuentaCorta, saleEn, cuentaDe, MOTIVO_METRICOOL } from '../src/contenido-cuentas.js';
import { parsear, serializar, huella, normalizar, crearAlmacen } from '../contenido/piezas.mjs';
import { entregasDe } from '../contenido/entrega.mjs';
import { crearRutas } from '../contenido/rutas.mjs';
import { crearSimulacro, crearConductorMetricool } from '../contenido/conductores.mjs';
import { crearMeta, PERMISOS_LECTURA, PERMISOS_PUBLICAR } from '../contenido/meta.mjs';
import { crearConductorMeta, PREPARAR_ANTES_MS } from '../contenido/meta-publicar.mjs';
import { crearMetaStand } from './meta-stand.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ao-cuentas-'));
const TOKEN = 'EAAG-TOKEN-DE-USUARIO-CUENTAS-0123456789'; // secrets-ok: un token de mentira para el Graph de mentira
const TK1 = 'EAAG-TOKEN-PAGINA-UNO-CUENTAS-111111111'; // secrets-ok: idem
const TK2 = 'EAAG-TOKEN-PAGINA-DOS-CUENTAS-222222222'; // secrets-ok: idem
const MIN = 60e3, DIA = 864e5;
// lo que da meta.estado().cuentas con el token del dueño: dos marcas con su página y su Instagram, una página sola y un Instagram sin página
const CUENTAS = [
  { id: 'facebook:P1', red: 'facebook', externoId: 'P1', paginaId: 'P1', nombre: 'PanaClaw', foto: 'https://scontent.test/p1.jpg' },
  { id: 'instagram:IG1', red: 'instagram', externoId: 'IG1', paginaId: 'P1', nombre: 'PanaClaw', usuario: 'pana.claw', foto: '' },
  { id: 'facebook:P2', red: 'facebook', externoId: 'P2', paginaId: 'P2', nombre: 'BukoFlow', foto: '' },
  { id: 'instagram:IG2', red: 'instagram', externoId: 'IG2', paginaId: 'P2', nombre: 'BukoFlow', usuario: 'bukoflow', foto: 'javascript:alert(1)' },
  { id: 'facebook:P3', red: 'facebook', externoId: 'P3', paginaId: 'P3', nombre: 'Avalon Davies', foto: '' },
  { id: 'instagram:IG9', red: 'instagram', externoId: 'IG9', paginaId: '', nombre: 'LiveSync Pro', usuario: 'livesyncpro', foto: '' },
];

test('lo puro: qué cuenta vale, cuál es la de siempre y en cuál no se puede publicar', () => {
  assert.deepEqual(limpiarCuentas({ instagram: 'instagram:IG2', facebook: '' }), { cuentas: { instagram: 'instagram:IG2' } }, 'vacío = la de Ajustes');
  assert.deepEqual(limpiarCuentas(null), { cuentas: {} });
  assert.match(limpiarCuentas({ instagram: 'facebook:P1' }).error, /no es una cuenta de Instagram/);
  assert.match(limpiarCuentas({ x: 'x:1' }).error, /solo se elige cuenta para Instagram y Facebook/);
  assert.match(limpiarCuentas({ facebook: 'facebook:P1/../x' }).error, /no es una cuenta de Facebook/);
  assert.match(limpiarCuentas('instagram:IG1').error, /van como/);
  assert.deepEqual(cuentasLimpias({ instagram: 'instagram:IG1', facebook: 'nada', x: 'x:1' }), { instagram: 'instagram:IG1' }, 'al leer una nota, lo malo se ignora');
  assert.deepEqual(porDefecto(CUENTAS, ''), { facebook: 'facebook:P1', instagram: 'instagram:IG1' }, 'sin elegir en Ajustes: la primera página con Instagram');
  assert.deepEqual(porDefecto(CUENTAS, 'P2'), { facebook: 'facebook:P2', instagram: 'instagram:IG2' }, 'contenido.metaPagina manda');
  assert.deepEqual(porDefecto(CUENTAS, 'P3'), { facebook: 'facebook:P3', instagram: '' });
  assert.deepEqual(porDefecto([], 'P1'), { facebook: '', instagram: '' });
  assert.equal(motivoNoPublica(CUENTAS[5]), '@livesyncpro no tiene página de Facebook vinculada: vincúlala para publicar en ella');
  assert.equal(motivoNoPublica(CUENTAS[3]), '');
  assert.match(motivoNoPublica(null), /ya no la ve el token/);
  assert.equal(motivoNoPublica(CUENTAS[3], { conductor: 'metricool', defecto: porDefecto(CUENTAS) }), MOTIVO_METRICOOL, 'Metricool: solo las de su marca');
  assert.equal(motivoNoPublica(CUENTAS[1], { conductor: 'metricool', defecto: porDefecto(CUENTAS) }), '');
});

test('GET /api/contenido/cuentas: la lista, la de siempre y las que no pueden publicar (con su motivo)', () => {
  const l = listaCuentas({ cuentas: CUENTAS, metaPagina: '', conductor: 'meta' });
  assert.equal(l.cuentas.length, 6); assert.equal(l.conectada, true);
  assert.deepEqual(l.porDefecto, { facebook: 'facebook:P1', instagram: 'instagram:IG1' });
  const ig9 = l.cuentas.find(c => c.id === 'instagram:IG9'); assert.equal(ig9.puedePublicar, false); assert.match(ig9.motivo, /vincúlala/);
  assert.equal(l.cuentas.find(c => c.id === 'instagram:IG2').foto, '', 'una foto que no es https no llega a la página');
  assert.equal(l.cuentas.find(c => c.id === 'facebook:P1').foto, 'https://scontent.test/p1.jpg');
  assert.ok(l.cuentas.every(c => !('externoId' in c) && !('access_token' in c)), 'solo lo que la pantalla necesita');
  const mc = listaCuentas({ cuentas: CUENTAS, conductor: 'metricool' });
  assert.deepEqual(mc.cuentas.filter(c => c.puedePublicar).map(c => c.id), ['facebook:P1', 'instagram:IG1'], 'con Metricool, solo la de su marca');
  assert.equal(listaCuentas({ cuentas: [] }).conectada, false);
  // lo que pinta la página
  assert.equal(cuentaCorta({ redes: ['instagram', 'facebook'] }, l), '@pana.claw');
  assert.equal(cuentaCorta({ redes: ['facebook'], cuentas: { facebook: 'facebook:P2' } }, l), 'BukoFlow');
  assert.equal(cuentaCorta({ redes: ['instagram'] }, { cuentas: [] }), '', 'sin Meta, nada');
  assert.equal(saleEn({ redes: ['instagram'], cuentas: { instagram: 'instagram:IG2' } }, 'instagram:IG2', l), true);
  assert.equal(saleEn({ redes: ['instagram'] }, 'instagram:IG2', l), false);
  assert.equal(saleEn({ redes: ['facebook'] }, 'instagram:IG1', l), false, 'una pieza sin Instagram no sale en uno');
  assert.match(cuentaDe({ redes: ['instagram'], cuentas: { instagram: 'instagram:IG7' } }, 'instagram', l).motivo, /ya no la ve/);
});

test('la nota: la cuenta va en la cabecera; la huella la cuenta solo si tiene algo (lo aprobado antes no se suelta)', () => {
  const p = normalizar({ titulo: 'Promo', redes: ['instagram', 'facebook'], texto: 'Hola', cuentas: { instagram: 'instagram:IG2' } }).pieza;
  assert.deepEqual(p.cuentas, { instagram: 'instagram:IG2' });
  const md = serializar(p); assert.match(md, /^cuentas: \{"instagram":"instagram:IG2"\}$/m);
  assert.deepEqual(parsear(md).cuentas, { instagram: 'instagram:IG2' });
  const sin = normalizar({ titulo: 'Promo', redes: ['instagram', 'facebook'], texto: 'Hola' }).pieza;
  assert.doesNotMatch(serializar(sin), /^cuentas:/m, 'sin elegir no escribe nada');
  const vieja = { ...sin }; delete vieja.cuentas;
  assert.equal(huella(sin), huella(vieja), 'una pieza sin cuentas tiene la huella de siempre');
  assert.notEqual(huella(p), huella(sin), 'otra cuenta es otra cosa que sale');
  assert.equal(huella({ ...sin, cuentas: { facebook: 'facebook:P2' }, redes: ['instagram'] }), huella({ ...sin, redes: ['instagram'] }), 'la cuenta de una red que no sale no cuenta');
  assert.deepEqual(normalizar({ cuentas: { instagram: '' } }, p).pieza.cuentas, {}, '«» la devuelve a la de siempre');
  assert.deepEqual(normalizar({ cuentas: { facebook: 'facebook:P3' } }, p).pieza.cuentas, { instagram: 'instagram:IG2', facebook: 'facebook:P3' }, 'solo cambia la red que viene');
  assert.match(normalizar({ cuentas: { instagram: 'IG2' } }).error, /no es una cuenta de Instagram/);
});

test('el almacén: nace con la de siempre, una cuenta que no puede publicar se rechaza y cambiarla en una aprobada le quita el OK', () => {
  const ahora = new Date(2026, 9, 9, 10).getTime();
  const al = crearAlmacen({ dir: tmp(), medida: () => ({ ancho: 1080, alto: 1350 }), ahora: () => ahora,
    cuentasPorDefecto: () => porDefecto(CUENTAS, ''), validarCuenta: id => motivoNoPublica(CUENTAS.find(c => c.id === id)) });
  const a = al.crear({ titulo: 'A', redes: ['instagram'], texto: 'Hola', medios: ['2026-10/a.jpg'] }).pieza;
  assert.deepEqual(a.cuentas, { instagram: 'instagram:IG1' }, 'solo la de sus redes');
  const b = al.crear({ titulo: 'B', redes: ['instagram', 'facebook'], texto: 'Hola', cuentas: {} }).pieza;
  assert.deepEqual(b.cuentas, {}, 'quien pasa «cuentas» decide (vacío = la de siempre al publicar)');
  assert.match(al.crear({ titulo: 'C', redes: ['instagram'], texto: 'x', cuentas: { instagram: 'instagram:IG9' } }).error, /no tiene página de Facebook vinculada/);
  assert.match(al.crear({ titulo: 'C', redes: ['instagram'], texto: 'x', cuentas: { instagram: 'instagram:IG7' } }).error, /ya no la ve el token/);
  assert.match(al.guardar(a.id, { cuentas: { instagram: 'instagram:IG9' } }).error, /vincúlala/);
  // aprobada → cambiar la cuenta le quita el OK; cambiar el título no
  assert.equal(al.guardar(a.id, { fecha: '2026-10-12', hora: '18:00' }).pieza.fecha, '2026-10-12');
  const ok = al.aprobar(a.id); assert.equal(ok.pieza.estado, 'aprobada', ok.error);
  assert.equal(al.guardar(a.id, { titulo: 'A bis' }).soltada, false);
  const r = al.guardar(a.id, { cuentas: { instagram: 'instagram:IG2' } });
  assert.equal(r.soltada, true); assert.equal(r.pieza.estado, 'revision'); assert.deepEqual(al.leer(a.id).cuentas, { instagram: 'instagram:IG2' });
  // sin Meta conectada: no se elige nada y todo sigue como antes
  const sinMeta = crearAlmacen({ dir: tmp(), ahora: () => ahora });
  assert.deepEqual(sinMeta.crear({ titulo: 'X', redes: ['instagram'], texto: 'x' }).pieza.cuentas, {});
});

test('la entrega lleva la cuenta elegida de sus redes; sin elegir, no lleva nada (como antes)', () => {
  const base = { fecha: '2026-10-12', hora: '18:00', formato: 'post', redes: ['instagram', 'facebook'], texto: 'Hola', medios: ['m.jpg'], comentario: '', hashtags: '', textoFacebook: '', historias: [] };
  const [sin] = entregasDe(base); assert.equal('cuentas' in sin, false);
  const [con] = entregasDe({ ...base, cuentas: { instagram: 'instagram:IG2', facebook: 'facebook:P3' } });
  assert.deepEqual(con.cuentas, { instagram: 'instagram:IG2', facebook: 'facebook:P3' });
  const partes = entregasDe({ ...base, textoFacebook: 'Otro', cuentas: { instagram: 'instagram:IG2' } });
  assert.deepEqual(partes.map(e => e.cuentas || null), [{ instagram: 'instagram:IG2' }, null], 'cada entrega, solo las de sus redes');
});

test('la ruta, con el Meta de mentira: las páginas que ve el token y sus Instagram', async () => {
  const g = crearMetaStand({ token: TOKEN, tokenPagina: TK1, permisos: [...PERMISOS_LECTURA, ...PERMISOS_PUBLICAR], paginas: [
    { id: 'P1', name: 'PanaClaw', access_token: TK1, instagram_business_account: { id: 'IG1', username: 'pana.claw' } },
    { id: 'P2', name: 'BukoFlow', access_token: TK2, instagram_business_account: { id: 'IG2', username: 'bukoflow' } },
    { id: 'P3', name: 'Avalon Davies', access_token: TK1 },
  ] });
  const dir = tmp();
  const meta = crearMeta({ env: { META_ACCESS_TOKEN: TOKEN, META_GRAPH_HOST: 'https://graph.test' }, fetchFn: g.fetchFn, dir });
  await meta.sincronizar();
  const conSinPagina = () => [...meta.estado().cuentas, CUENTAS[5]]; // un Instagram que el token ve sin página (como @livesyncpro)
  const json = (res, code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  const body = req => new Promise(ok => { let s = ''; req.on('data', d => { s += d; }); req.on('end', () => ok(s ? JSON.parse(s) : {})); });
  const handle = crearRutas({ almacen: crearAlmacen({ dir: tmp() }), json, body, cuentas: () => listaCuentas({ cuentas: conSinPagina(), metaPagina: 'P2', conductor: 'meta' }) });
  const srv = http.createServer(async (req, res) => { if (!await handle(req, res, new URL(req.url, 'http://x'))) json(res, 404, {}); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  try {
    const antes = g.llamadas.length;
    const r = await (await fetch(`http://127.0.0.1:${srv.address().port}/api/contenido/cuentas`)).json();
    assert.equal(g.llamadas.length, antes, 'ligera: no llama a Meta');
    assert.deepEqual(r.cuentas.map(c => c.id).sort(), ['facebook:P1', 'facebook:P2', 'facebook:P3', 'instagram:IG1', 'instagram:IG2', 'instagram:IG9']);
    assert.deepEqual(r.porDefecto, { facebook: 'facebook:P2', instagram: 'instagram:IG2' });
    assert.equal(r.cuentas.find(c => c.id === 'instagram:IG9').puedePublicar, false);
    assert.ok(!JSON.stringify(r).includes(TK1) && !JSON.stringify(r).includes(TOKEN), 'nunca un token');
    const sinMeta = crearRutas({ almacen: crearAlmacen({ dir: tmp() }), json, body });
    const srv2 = http.createServer(async (req, res) => { if (!await sinMeta(req, res, new URL(req.url, 'http://x'))) json(res, 404, {}); });
    await new Promise(ok => srv2.listen(0, '127.0.0.1', ok));
    const v = await (await fetch(`http://127.0.0.1:${srv2.address().port}/api/contenido/cuentas`)).json();
    assert.deepEqual(v, { cuentas: [], porDefecto: { facebook: '', instagram: '' }, conectada: false });
    await new Promise(ok => srv2.close(ok));
  } finally { await new Promise(r => srv.close(r)); }
});

/** El conductor de Meta con dos marcas: P1 (IG1) con un token y P2 (IG2) con otro. */
async function montarMeta({ extra = [] } = {}) {
  const dir = tmp();
  let reloj = new Date(2026, 9, 9, 10, 0).getTime();
  const g = crearMetaStand({ token: TOKEN, tokenPagina: TK1, permisos: [...PERMISOS_LECTURA, ...PERMISOS_PUBLICAR], paginas: [
    { id: 'P1', name: 'PanaClaw', access_token: TK1, instagram_business_account: { id: 'IG1', username: 'pana.claw' } },
    { id: 'P2', name: 'BukoFlow', access_token: TK2, instagram_business_account: { id: 'IG2', username: 'bukoflow' } },
  ] });
  g.st.reloj = reloj;
  const meta0 = crearMeta({ env: { META_ACCESS_TOKEN: TOKEN, META_GRAPH_HOST: 'https://graph.test', META_RUPLOAD_HOST: 'https://rupload.test' }, fetchFn: g.fetchFn, dir, ahora: () => reloj });
  await meta0.sincronizar();
  const meta = { ...meta0, estado: () => { const e = meta0.estado(); return { ...e, cuentas: [...e.cuentas, ...extra] }; } };
  for (const n of ['a.jpg']) fs.writeFileSync(path.join(dir, n), Buffer.from('jpg'));
  const c = crearConductorMeta({ meta, rutaMedio: id => (fs.existsSync(path.join(dir, id)) ? path.join(dir, id) : null), aJpeg: async b => b, archivo: path.join(dir, 'agenda.json'), pagina: () => 'P1', ahora: () => reloj, inmediato: false });
  return { g, c, ir: ms => { reloj = ms; g.st.reloj = ms; }, get reloj() { return reloj; } };
}
const entrega = (t, extra = {}) => ({ clave: 'post:0', variante: 'post', redes: ['facebook', 'instagram'], texto: 'Hola desde BukoFlow', comentario: '', medios: ['a.jpg'], momento: t.reloj + 2 * DIA, formato: 'post', extras: { colaboradores: [] }, ...extra });
const posts = (g, ruta) => g.llamadas.filter(l => l.metodo === 'POST' && l.ruta === ruta);

test('Meta directo: sale en la página y el Instagram ELEGIDOS, con el token de esa página', async () => {
  const t = await montarMeta();
  const e = entrega(t, { cuentas: { facebook: 'facebook:P2', instagram: 'instagram:IG2' } });
  const r = await t.c.programar(e);
  assert.equal(r.redes.facebook.estado, 'en_red'); assert.equal(r.redes.instagram.estado, 'en_red');
  assert.deepEqual(Object.values(t.c.agenda().trabajos).map(j => [j.red, j.pagina, j.ig, j.cuenta]).sort(), [['facebook', 'P2', '', 'facebook:P2'], ['instagram', 'P2', 'IG2', 'instagram:IG2']]);
  await t.c.pulso(); // Facebook: programada en Meta, en la página elegida
  const [fb] = posts(t.g, '/P2/photos'); assert.ok(fb, 'la foto va a /P2/photos'); assert.equal(fb.h.authorization, `Bearer ${TK2}`, 'con el token de P2');
  assert.equal(posts(t.g, '/P1/photos').length, 0, 'nada en la página de Ajustes');
  t.ir(e.momento - PREPARAR_ANTES_MS); await t.c.pulso(); // Instagram: el contenedor, en el Instagram elegido
  const [cont] = posts(t.g, '/IG2/media'); assert.ok(cont, 'el contenedor va a /IG2/media'); assert.equal(cont.h.authorization, `Bearer ${TK2}`);
  assert.equal(posts(t.g, '/P2/photos').length, 2, 'la foto temporal de Instagram, en la página de su Instagram');
  t.ir(e.momento); await t.c.pulso();
  assert.equal(posts(t.g, '/IG2/media_publish').length, 1); assert.equal(posts(t.g, '/IG1/media_publish').length, 0);
  assert.equal(t.c.estado(r).redes.instagram.estado, 'publicada');
});

test('Meta directo: una cuenta que no puede publicar falla con su motivo; sin elegir, sale donde siempre; otra cuenta es otro grupo', async () => {
  const t = await montarMeta({ extra: [CUENTAS[5]] });
  await assert.rejects(t.c.programar(entrega(t, { redes: ['instagram'], cuentas: { instagram: 'instagram:IG9' } })), /Instagram: @livesyncpro no tiene página de Facebook vinculada/);
  await assert.rejects(t.c.programar(entrega(t, { redes: ['facebook'], cuentas: { facebook: 'facebook:P7' } })), /Facebook: la cuenta elegida \(P7\) ya no la ve el token/);
  const mixta = await t.c.programar(entrega(t, { cuentas: { instagram: 'instagram:IG9' } }));
  assert.equal(mixta.redes.instagram.estado, 'fallo'); assert.match(mixta.redes.instagram.detalle, /vincúlala/); assert.equal(mixta.redes.facebook.estado, 'en_red', 'Facebook sale igual (en la de siempre)');
  const u = await montarMeta();
  const e = entrega(u, { redes: ['facebook'] });
  const a = await u.c.programar(e); await u.c.pulso();
  assert.equal(posts(u.g, '/P1/photos').length, 1, 'sin elegir: la página de Ajustes'); assert.equal(posts(u.g, '/P1/photos')[0].h.authorization, `Bearer ${TK1}`);
  const b = await u.c.programar({ ...e, cuentas: { facebook: 'facebook:P2' } });
  assert.notEqual(a.id, b.id, 'cambiar la cuenta reprograma: es otro grupo');
  assert.equal((await u.c.programar(e)).id, a.id, 'la misma entrega sin cuentas sigue siendo el mismo grupo');
});

test('Metricool no publica en otra cuenta; el simulacro apunta la cuenta', async () => {
  const mc = { configurado: () => true, marca: async () => ({ zona: 'America/Panama' }), programar: async () => { throw new Error('no debía llamar'); } };
  const c = crearConductorMetricool({ mc, rutaMedio: () => null, aJpeg: async b => b, cache: path.join(tmp(), 'c.json'), cuentaValida: (red, id) => (id === 'instagram:IG2' ? MOTIVO_METRICOOL : '') });
  await assert.rejects(c.programar({ redes: ['instagram'], medios: [], cuentas: { instagram: 'instagram:IG2' }, momento: Date.now() + DIA }), e => e.transitorio === false && /Meta directo/.test(e.message));
  const archivo = path.join(tmp(), 'sim.json'), s = crearSimulacro({ archivo });
  const r = await s.programar({ redes: ['instagram'], medios: [], texto: 'x', momento: Date.now() + MIN, cuentas: { instagram: 'instagram:IG2' } });
  assert.deepEqual(JSON.parse(fs.readFileSync(archivo, 'utf8')).posts[r.id].cuentas, { instagram: 'instagram:IG2' });
});
