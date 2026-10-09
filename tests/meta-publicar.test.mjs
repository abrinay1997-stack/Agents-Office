// F3 (8 oct 2026): publicar directo en Instagram y Facebook — contenido/meta-publicar.mjs, contra un Graph DE MENTIRA que habla como el
// de Meta (Facebook, Instagram y la subida reanudable de rupload). Nada de esto toca a Meta: lo de verdad se prueba con
// scripts/check-meta-publicar.mjs. Lo que importa aquí: Facebook se programa en Meta; Instagram sale a su hora y NUNCA dos veces;
// lo tarde falla con su motivo; lo que Meta no contesta no se repite a ciegas; el token no toca el disco.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearMeta, PERMISOS_LECTURA, PERMISOS_PUBLICAR, ESPERA_LIMITE_MIN } from '../contenido/meta.mjs';
import { crearConductorMeta, planRed, vaNativa, PREPARAR_ANTES_MS, TARDE_MAX_MS, NATIVA_MIN_MS } from '../contenido/meta-publicar.mjs';
import { crearAlmacen } from '../contenido/piezas.mjs';
import { crearProgramador } from '../contenido/programador.mjs';
import { cuotaTxt } from '../src/contenido-cola.js';
import { crearMetaStand, json } from './meta-stand.mjs';

const TOKEN = 'EAAG-TOKEN-DE-USUARIO-PUBLICAR-0123456789'; // secrets-ok: un token de mentira para el Graph de mentira
const TOKEN_PAGINA = 'EAAG-TOKEN-DE-PAGINA-PUBLICAR-9876543210'; // secrets-ok: idem
const GRAPH = 'https://graph.test', RUP = 'https://rupload.test';
const H = 3600e3, DIA = 24 * H, MIN = 60e3;

/** El Meta de mentira compartido (tests/meta-stand.mjs), con estado: fotos, publicaciones, contenedores y medios de Instagram. */
function graphFalso({ torcer = () => null, permisos = [...PERMISOS_LECTURA, ...PERMISOS_PUBLICAR], conIG = true, procesar = 0 } = {}) {
  return crearMetaStand({
    token: TOKEN, tokenPagina: TOKEN_PAGINA, permisos, procesar, rupload: RUP, torcer,
    paginas: [{ id: 'P1', name: 'PanaClaw', access_token: TOKEN_PAGINA, ...(conIG ? { instagram_business_account: { id: 'IG1', username: 'panaclaw' } } : {}) }],
  });
}

const archivos = dir => {
  const f = { 'a.png': Buffer.from('png'), 'b.jpg': Buffer.from('jpg'), 'r.mp4': Buffer.alloc(2048, 7), 'v.webm': Buffer.from('webm') };
  for (const [n, b] of Object.entries(f)) fs.writeFileSync(path.join(dir, n), b);
  return id => (f[id] ? path.join(dir, id) : null);
};

async function montar(opciones = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-metapub-'));
  let reloj = new Date(2026, 9, 8, 10, 0).getTime();
  const g = graphFalso(opciones); g.st.reloj = reloj;
  const env = { META_ACCESS_TOKEN: TOKEN, META_GRAPH_HOST: GRAPH, META_RUPLOAD_HOST: RUP };
  const meta = crearMeta({ env, fetchFn: g.fetchFn, dir, ahora: () => reloj });
  await meta.sincronizar();
  const convertidas = [], cambios = [], avisos = [];
  const c = crearConductorMeta({ meta, rutaMedio: archivos(dir), aJpeg: async b => { convertidas.push(b.toString()); return Buffer.from('jpeg'); }, archivo: path.join(dir, 'meta-agenda.json'), ahora: () => reloj, alCambiar: () => cambios.push(reloj), avisar: (t, o) => avisos.push({ t, ...o }), inmediato: false });
  return { dir, meta, c, g, convertidas, cambios, avisos, get reloj() { return reloj; }, ir: ms => { reloj = ms; g.st.reloj = ms; }, avanzar: ms => { reloj += ms; g.st.reloj = reloj; } };
}
const entrega = (t, extra = {}) => ({ clave: 'post:0', variante: 'post', redes: ['facebook'], texto: 'Agenda tu examen visual.', comentario: '', medios: ['b.jpg'], momento: t.reloj + 2 * DIA, formato: 'post', extras: { colaboradores: [] }, ...extra });
const de = (g, metodo, ruta) => g.llamadas.filter(l => l.metodo === metodo && l.ruta === ruta);

test('qué se publica en cada red, y qué no', () => {
  assert.deepEqual(planRed('instagram', 'post', ['imagen']), { como: 'imagen' });
  assert.deepEqual(planRed('instagram', 'post', ['video']), { como: 'reel' }, 'un video suelto en el feed sale como reel');
  assert.deepEqual(planRed('instagram', 'carrusel', ['imagen', 'video']), { como: 'carrusel' });
  assert.match(planRed('instagram', 'carrusel', Array(11).fill('imagen')).error, /2 a 10/);
  assert.match(planRed('instagram', 'reel', ['imagen']).error, /video/);
  assert.match(planRed('instagram', 'post', ['otro']).error, /MP4 o MOV/);
  assert.match(planRed('instagram', 'post', []).error, /imagen o un video/);
  assert.deepEqual(planRed('facebook', 'carrusel', ['imagen', 'imagen']), { como: 'fotos' });
  assert.match(planRed('facebook', 'carrusel', ['imagen', 'video']).error, /sepáralo/);
  assert.match(planRed('facebook', 'historia', ['video']).error, /a mano/);
  assert.deepEqual(planRed('facebook', 'post', []), { como: 'texto' });
  assert.match(planRed('linkedin', 'post', ['imagen']).error, /Metricool o a mano/);
  assert.equal(vaNativa('facebook', 'imagen', 20 * MIN, 0), true); assert.equal(vaNativa('facebook', 'imagen', 5 * MIN, 0), false, 'a menos de 10 min no se programa');
  assert.equal(vaNativa('facebook', 'historia', DIA, 0), false); assert.equal(vaNativa('instagram', 'imagen', DIA, 0), false, 'Instagram no se programa por API');
});

test('listo: sin cliente, sin página, sin los permisos esenciales; y con todo, la nota de Instagram', async () => {
  assert.match(crearConductorMeta().listo().motivo, /META_ACCESS_TOKEN/);
  const sinPub = await montar({ permisos: PERMISOS_LECTURA });
  assert.match(sinPub.c.listo().motivo, /pages_manage_posts, instagram_content_publish/);
  const sinCom = await montar({ permisos: [...PERMISOS_LECTURA, 'pages_manage_posts', 'instagram_content_publish'] });
  const l = sinCom.c.listo(); assert.equal(l.ok, true); assert.match(l.nota, /encendida/); assert.match(l.nota, /primer comentario no se pone/);
  const t = await montar(); assert.equal(t.c.listo().ok, true);
  const ok = await t.c.comprobar(); assert.equal(ok.ok, true); assert.match(ok.texto, /PanaClaw.*@panaclaw.*3 de 100/);
});

test('Facebook queda PROGRAMADO en Meta (sale solo); a su hora la oficina lo sabe, con su enlace y el primer comentario', async () => {
  const t = await montar();
  const e = entrega(t, { comentario: 'Reserva aquí' });
  const r = await t.c.programar(e);
  assert.equal(r.redes.facebook.estado, 'en_red'); assert.equal(r.redes.facebook.local, false);
  assert.equal(t.g.llamadas.filter(l => l.metodo === 'POST').length, 0, 'programar no llama a Meta: lo apunta y el pulso lo hace');
  await t.c.pulso(); assert.equal(t.cambios.length, 1, 'programada en Facebook: la cola lo sabe ya');
  const [foto] = de(t.g, 'POST', '/P1/photos');
  assert.equal(foto.campos.published, 'false'); assert.equal(Number(foto.campos.scheduled_publish_time), Math.floor(e.momento / 1000)); assert.equal(foto.campos.caption, e.texto);
  assert.ok(foto.archivo > 0, 'la imagen va como archivo (sin dirección pública)'); assert.equal(foto.h.authorization, `Bearer ${TOKEN_PAGINA}`, 'el token de la página, en la cabecera');
  assert.ok(!t.g.llamadas.some(l => l.metodo === 'POST' && String(l.q.access_token || '').length), 'el token nunca en la dirección de un POST');
  assert.equal(t.c.estado(r).redes.facebook.detalle, 'Programada en Facebook: sale sola a su hora.');
  await t.c.pulso(); assert.equal(de(t.g, 'POST', '/P1/photos').length, 1, 'no se programa dos veces');
  t.ir(e.momento + MIN); await t.c.pulso();
  const s = t.c.estado(r).redes.facebook;
  assert.equal(s.estado, 'publicada'); assert.match(s.url, /facebook\.com\/P1_F1/);
  assert.equal(de(t.g, 'POST', '/P1_F1/comments')[0].campos.message, 'Reserva aquí'); assert.equal(t.cambios.length, 2, 'avisa a la cola al programarla y al salir');
});

test('Facebook: varias fotos son una publicación (fotos temporales + attached_media); un video va a graph-video; a menos de 10 min sale a su hora', async () => {
  const t = await montar();
  const r = await t.c.programar(entrega(t, { formato: 'carrusel', medios: ['a.png', 'b.jpg'] }));
  await t.c.pulso();
  const fotos = de(t.g, 'POST', '/P1/photos'); assert.equal(fotos.length, 2); assert.ok(fotos.every(f => f.campos.published === 'false' && f.campos.temporary === 'true'));
  const [feed] = de(t.g, 'POST', '/P1/feed'); assert.deepEqual(JSON.parse(feed.campos.attached_media), [{ media_fbid: 'F1' }, { media_fbid: 'F2' }]); assert.equal(feed.campos.published, 'false');
  assert.equal(t.convertidas.length, 0, 'Facebook acepta PNG: no se convierte');
  const v = await montar(); await v.c.programar(entrega(v, { formato: 'reel', medios: ['r.mp4'] })); await v.c.pulso();
  assert.equal(de(v.g, 'POST', '/P1/videos')[0].campos.published, 'false');
  const pronto = await montar(), e = entrega(pronto, { momento: pronto.reloj + 5 * MIN });
  const rp = await pronto.c.programar(e); assert.equal(rp.redes.facebook.local, true);
  await pronto.c.pulso(); assert.equal(de(pronto.g, 'POST', '/P1/photos').length, 0, 'antes de su hora no sale');
  pronto.ir(e.momento); await pronto.c.pulso();
  const [ya] = de(pronto.g, 'POST', '/P1/photos'); assert.equal(ya.campos.published, undefined, 'a su hora se publica directamente');
  assert.equal(pronto.c.estado(rp).redes.facebook.estado, 'publicada'); assert.ok(r);
});

test('Instagram (imagen): no se programa en Meta; 15 min antes prepara el contenedor con la dirección de una foto temporal, a su hora publica', async () => {
  const t = await montar();
  const e = entrega(t, { redes: ['instagram'], medios: ['a.png'], comentario: 'Link en la bio', extras: { colaboradores: ['optica.sol'] } });
  const r = await t.c.programar(e);
  assert.equal(r.redes.instagram.local, true); assert.match(r.redes.instagram.detalle, /encendida/);
  await t.c.pulso(); assert.equal(t.g.llamadas.filter(l => l.metodo === 'POST').length, 0, 'un día antes no hace nada'); assert.equal(t.avisos.length, 0);
  t.ir(e.momento - 50 * MIN); await t.c.pulso(); await t.c.pulso();
  assert.equal(t.avisos.length, 1, 'una hora antes, UN aviso'); assert.match(t.avisos[0].t, /^En 50 min sale en Instagram «Agenda tu examen visual\.» desde esta computadora: déjala encendida/);
  t.ir(e.momento - PREPARAR_ANTES_MS); await t.c.pulso();
  assert.deepEqual(t.convertidas, ['png'], 'Instagram pide JPEG: la PNG se convierte');
  const [temp] = de(t.g, 'POST', '/P1/photos'); assert.equal(temp.campos.published, 'false'); assert.equal(temp.campos.temporary, 'true');
  const [cont] = de(t.g, 'POST', '/IG1/media');
  assert.equal(cont.campos.image_url, 'https://scontent.fbcdn.test/F1.jpg', 'la dirección más grande que dio Meta'); assert.equal(cont.campos.caption, e.texto);
  assert.deepEqual(JSON.parse(cont.campos.collaborators), ['optica.sol']);
  assert.equal(de(t.g, 'POST', '/IG1/media_publish').length, 0, 'todavía no es su hora');
  t.ir(e.momento); await t.c.pulso();
  assert.equal(de(t.g, 'POST', '/IG1/media_publish')[0].campos.creation_id, 'C2');
  const s = t.c.estado(r).redes.instagram; assert.equal(s.estado, 'publicada'); assert.equal(s.url, 'https://www.instagram.com/p/M3/');
  assert.equal(de(t.g, 'POST', '/M3/comments')[0].campos.message, 'Link en la bio');
  assert.deepEqual(t.g.st.borrados, ['F1'], 'la foto temporal se borra al terminar');
  // C2 (8 oct 2026): la cuota a la vista — la que leyó al preparar (3 de 100) y lo publicado desde aquí en 24 h
  assert.deepEqual(t.c.cuota(), { nuestras: 1, usadas: 3, total: 100, cuando: e.momento - PREPARAR_ANTES_MS });
  assert.equal(cuotaTxt(t.c.cuota()), 'Instagram: 3 de 100 publicaciones por API en 24 h.');
  t.avanzar(25 * 3600e3); assert.deepEqual(t.c.cuota(), { nuestras: 0, usadas: null, total: null, cuando: null }, 'pasadas 24 h ya no dice nada viejo');
  assert.match(cuotaTxt(t.c.cuota()), /^Instagram: 0 publicadas desde aquí en 24 h/);
});

test('Instagram (reel): el video va por la subida reanudable (OAuth en la cabecera), se espera a que Meta lo procese y sale una vez', async () => {
  const t = await montar({ procesar: 2 });
  const e = entrega(t, { redes: ['instagram'], formato: 'reel', medios: ['r.mp4'] });
  const r = await t.c.programar(e);
  t.ir(e.momento - 10 * MIN); await t.c.pulso();
  const [cont] = de(t.g, 'POST', '/IG1/media'); assert.equal(cont.campos.media_type, 'REELS'); assert.equal(cont.campos.upload_type, 'resumable'); assert.equal(cont.campos.share_to_feed, 'true');
  const [sub] = t.g.llamadas.filter(l => l.host === RUP); assert.equal(sub.ruta, '/ig-api-upload/C1'); assert.equal(sub.cuerpo, 2048); assert.equal(sub.h.file_size, '2048');
  assert.ok(!t.g.llamadas.some(l => l.host === RUP && Object.keys(l.q).length), 'nada del token en la dirección de la subida');
  t.ir(e.momento); await t.c.pulso(); assert.equal(de(t.g, 'POST', '/IG1/media_publish').length, 0, 'Meta sigue procesando: se espera');
  t.avanzar(MIN); await t.c.pulso(); t.avanzar(MIN); await t.c.pulso();
  assert.equal(de(t.g, 'POST', '/IG1/media_publish').length, 1); assert.equal(t.c.estado(r).redes.instagram.estado, 'publicada');
});

test('Instagram (carrusel mixto): un contenedor por archivo (el video como VIDEO), el padre con los hijos y el texto', async () => {
  const t = await montar();
  const e = entrega(t, { redes: ['instagram'], formato: 'carrusel', medios: ['b.jpg', 'r.mp4'] });
  await t.c.programar(e); t.ir(e.momento - MIN); await t.c.pulso();
  const conts = de(t.g, 'POST', '/IG1/media');
  assert.equal(conts.length, 3);
  assert.equal(conts[0].campos.is_carousel_item, 'true'); assert.equal(conts[0].campos.caption, undefined, 'los hijos no llevan texto');
  assert.equal(conts[1].campos.media_type, 'VIDEO'); assert.equal(conts[1].campos.is_carousel_item, 'true');
  assert.equal(conts[2].campos.media_type, 'CAROUSEL'); assert.equal(conts[2].campos.children, 'C2,C3'); assert.equal(conts[2].campos.caption, e.texto);
  assert.equal(t.convertidas.length, 0, 'un JPEG no se toca');
});

test('NUNCA dos veces: si /media_publish no contesta se lee el contenedor; publicado = salió; sin publicar = se publica el mismo contenedor', async () => {
  // 1) Meta publicó pero la respuesta se perdió
  const a = await montar({ torcer: (l, st) => (l.ruta === '/IG1/media_publish' && !st.perdida ? (st.perdida = true, st.cont[l.campos.creation_id].estado = 'PUBLISHED', st.media.unshift({ id: 'M77', caption: 'Agenda tu examen visual.', permalink: 'https://www.instagram.com/p/M77/' }), json({ error: { message: 'fallo interno' } }, 500)) : null) });
  const ea = entrega(a, { redes: ['instagram'] }); const ra = await a.c.programar(ea);
  a.ir(ea.momento); await a.c.pulso();
  assert.equal(a.c.estado(ra).redes.instagram.estado, 'en_red', 'incierta: todavía no se sabe');
  a.avanzar(MIN); await a.c.pulso();
  assert.equal(de(a.g, 'POST', '/IG1/media_publish').length, 1, 'no se publicó otra vez');
  const sa = a.c.estado(ra).redes.instagram; assert.equal(sa.estado, 'publicada'); assert.equal(sa.url, 'https://www.instagram.com/p/M77/', 'la encontró por su texto');
  // 2) Meta no contestó y no publicó: se publica el MISMO contenedor (que solo se puede publicar una vez)
  const b = await montar({ torcer: (l, st) => (l.ruta === '/IG1/media_publish' && !st.caida ? (st.caida = true, json({ error: { message: 'caída' } }, 503)) : null) });
  const eb = entrega(b, { redes: ['instagram'] }); const rb = await b.c.programar(eb);
  b.ir(eb.momento); await b.c.pulso(); b.avanzar(MIN); await b.c.pulso();
  const pubs = de(b.g, 'POST', '/IG1/media_publish'); assert.equal(pubs.length, 2); assert.equal(pubs[0].campos.creation_id, pubs[1].campos.creation_id);
  assert.equal(b.c.estado(rb).redes.instagram.estado, 'publicada');
});

test('tarde: con la oficina apagada a su hora sale hasta 30 min después; más tarde, falla con el motivo y no publica', async () => {
  const t = await montar();
  const e = entrega(t, { redes: ['instagram'] }); const r = await t.c.programar(e);
  t.ir(e.momento + 20 * MIN); await t.c.pulso();
  assert.equal(t.c.estado(r).redes.instagram.estado, 'publicada', '20 minutos tarde todavía sale');
  const u = await montar(); const eu = entrega(u, { redes: ['instagram'] }); const ru = await u.c.programar(eu);
  u.ir(eu.momento - 5 * MIN); await u.c.pulso(); // preparado…
  u.ir(eu.momento + TARDE_MAX_MS + MIN); await u.c.pulso(); // …y la computadora se apagó a su hora
  const s = u.c.estado(ru).redes.instagram; assert.equal(s.estado, 'fallo'); assert.match(s.detalle, /media hora/);
  assert.equal(de(u.g, 'POST', '/IG1/media_publish').length, 0);
});

test('Facebook: si Meta no contesta al programar NO se repite (podría duplicarla) y lo dice; un límite de uso se reintenta solo', async () => {
  const t = await montar({ torcer: l => (l.ruta === '/P1/photos' ? json({ error: { message: 'error' } }, 500) : null) });
  const r = await t.c.programar(entrega(t)); await t.c.pulso(); t.avanzar(5 * MIN); await t.c.pulso();
  assert.equal(de(t.g, 'POST', '/P1/photos').length, 1); assert.match(t.c.estado(r).redes.facebook.detalle, /no sé si la recibió/);
  const u = await montar({ torcer: (l, st) => (l.ruta === '/P1/photos' && !st.limitada ? (st.limitada = true, json({ error: { message: 'Application request limit reached', code: 4 } }, 400)) : null) });
  const ru = await u.c.programar(entrega(u)); await u.c.pulso();
  assert.equal(u.c.estado(ru).redes.facebook.estado, 'en_red'); assert.match(u.c.estado(ru).redes.facebook.detalle, /^Se programa en Facebook en un momento \(último intento: Meta está saturado/);
  u.avanzar(MIN); await u.c.pulso(); assert.equal(de(u.g, 'POST', '/P1/photos').length, 1, 'con el freno puesto ni se intenta: Meta pidió dejar de llamar');
  u.avanzar(ESPERA_LIMITE_MIN * MIN); await u.c.pulso(); assert.equal(de(u.g, 'POST', '/P1/photos').length, 2); assert.equal(u.c.agenda().trabajos[Object.keys(u.c.agenda().trabajos)[0]].estado, 'nativa');
});

test('retirar: lo programado en Facebook se borra allí; lo de Instagram que no salió se olvida; lo publicado no se quita desde aquí', async () => {
  const t = await montar();
  const r = await t.c.programar(entrega(t, { redes: ['facebook', 'instagram'] })); await t.c.pulso();
  assert.equal(await t.c.retirar(r), true); assert.deepEqual(t.g.st.borrados, ['P1_F1']); assert.equal(t.c.estado(r), null);
  const p = await montar(); const e = entrega(p, { redes: ['instagram'] }); const rp = await p.c.programar(e);
  p.ir(e.momento); await p.c.pulso(); await assert.rejects(p.c.retirar(rp), /ya salió en Instagram/);
});

test('cambiar de conductor no deja una programada huérfana: la cola la retira con Meta (el que la entregó)', async () => {
  const t = await montar();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-metacambio-'));
  const almacen = crearAlmacen({ dir: path.join(dir, 'piezas'), ahora: () => t.reloj });
  let actual = t.c; const otro = { id: 'metricool', nombre: 'Metricool', listo: () => ({ ok: true }), programar: async () => { throw new Error('no debería'); }, retirar: async () => true, estado: async () => null };
  const prog = crearProgramador({ almacen, archivo: path.join(dir, 'cola.json'), conductor: () => actual, porId: id => ({ meta: t.c, metricool: otro })[id], modo: () => 'real', horasAntes: () => 999, ahora: () => t.reloj });
  const pad = n => String(n).padStart(2, '0'), d = new Date(t.reloj + 2 * DIA);
  const p = almacen.crear({ titulo: 'X', fecha: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, hora: '10:00', redes: ['facebook'], texto: 'Hola', medios: ['b.jpg'], estado: 'revision' }).pieza;
  almacen.aprobar(p.id); await prog.tick(); t.avanzar(2 * MIN); await prog.tick(); await t.c.pulso();
  assert.equal(de(t.g, 'POST', '/P1/photos').length, 1);
  actual = otro; almacen.devolver(p.id, 'revision'); await prog.tick(); // el dueño cambió a Metricool y le quitó el OK
  assert.equal(prog.salidaDe(p.id).estado, 'cancelada'); assert.deepEqual(t.g.st.borrados, ['P1_F1'], 'se borró en Meta, no quedó viva');
});

test('redes que Meta no publica y cuentas que faltan: se dicen por red; si no queda ninguna, la entrega falla con el porqué', async () => {
  const t = await montar();
  const r = await t.c.programar(entrega(t, { redes: ['facebook', 'linkedin'] }));
  assert.equal(r.redes.linkedin.estado, 'fallo'); assert.match(r.redes.linkedin.detalle, /Metricool o a mano/); assert.equal(r.redes.facebook.estado, 'en_red');
  await assert.rejects(t.c.programar(entrega(t, { redes: ['linkedin'], clave: 'post:9' })), /LinkedIn: Meta solo publica/);
  const sinIG = await montar({ conIG: false });
  await assert.rejects(sinIG.c.programar(entrega(sinIG, { redes: ['instagram'] })), /no tiene un Instagram de empresa vinculado/);
  await assert.rejects(t.c.programar(entrega(t, { redes: ['instagram'], medios: ['v.webm'], clave: 'post:8' })), /MP4 o MOV/);
  await assert.rejects(t.c.programar(entrega(t, { medios: ['no-existe.jpg'], clave: 'post:7' })), /ya no tiene/);
});

test('el token no toca el disco: ni la agenda ni los errores lo llevan', async () => {
  const t = await montar({ torcer: l => (l.ruta === '/P1/photos' ? json({ error: { message: `token ${TOKEN_PAGINA} sin permiso`, code: 200 } }, 403) : null) });
  const r = await t.c.programar(entrega(t)); await t.c.pulso();
  const s = t.c.estado(r).redes.facebook; assert.equal(s.estado, 'fallo'); assert.match(s.detalle, /permiso/);
  const disco = fs.readdirSync(t.dir).map(f => { try { return fs.readFileSync(path.join(t.dir, f), 'utf8'); } catch { return ''; } }).join('\n');
  assert.ok(!disco.includes(TOKEN) && !disco.includes(TOKEN_PAGINA), 'ningún archivo lleva un token');
});

test('con la cola: aprobada para Instagram y Facebook → Facebook programado en Meta, Instagram a su hora → PUBLICADA en las dos, sin esperar 10 min', async () => {
  const t = await montar();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-metacola-'));
  const almacen = crearAlmacen({ dir: path.join(dir, 'piezas'), ahora: () => t.reloj });
  const prog = crearProgramador({ almacen, archivo: path.join(dir, 'cola.json'), conductor: () => t.c, porId: id => (id === 'meta' ? t.c : null), modo: () => 'real', horasAntes: () => 999, ahora: () => t.reloj });
  const pad = n => String(n).padStart(2, '0'), d = new Date(t.reloj + 2 * DIA);
  const p = almacen.crear({ titulo: 'Examen', fecha: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`, redes: ['instagram', 'facebook'], texto: 'Agenda tu examen visual.', medios: ['b.jpg'], estado: 'revision' }).pieza;
  almacen.aprobar(p.id);
  await prog.tick(); t.avanzar(2 * MIN); await prog.tick();
  let s = prog.salidaDe(p.id); assert.equal(s.estado, "en_red", s.error); assert.equal(s.conductor, 'meta');
  assert.equal(s.redes.instagram.local, true); assert.equal(s.redes.facebook.local, false);
  await t.c.pulso(); assert.equal(de(t.g, 'POST', '/P1/photos').length, 1, 'Facebook ya quedó programado en Meta');
  const momento = s.momento; t.ir(momento); await t.c.pulso();
  await prog.refrescar('meta'); // lo que hace alCambiar en la oficina
  s = prog.salidaDe(p.id); assert.equal(s.estado, 'publicada'); assert.match(s.redes.instagram.url, /instagram\.com/); assert.match(s.redes.facebook.url, /facebook\.com/);
  assert.ok(NATIVA_MIN_MS > 10 * MIN);
});
