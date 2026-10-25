// Fase A4 de Anuncios (9 oct 2026): IMPULSAR lo que ya salió en Contenido, contra el Meta de mentira (tests/meta-stand.mjs).
//   · desde una pieza publicada en Instagram (emparejada con lo que leyó Analíticas) y en Facebook (con el id que apuntó la cola) se llega a
//     un borrador válido y se crea EN PAUSA con el creativo correcto: `source_instagram_media_id` + `object_id` + `instagram_user_id`, o
//     `object_story_id` (+ `instagram_user_id` solo si Meta dice `is_instagram_eligible`); sin subir nada;
//   · una que Meta no deja impulsar (música con derechos) no se crea y dice por qué;
//   · aplicar la sugerencia `impulsar` (A5) crea ese borrador; un agente solo deja el borrador (y nunca crea en Meta);
//   · lo que no salió, o salió sin id conocido, se dice en palabras (409); dos veces la misma publicación no hace dos borradores.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearMetaStand, TOKEN_STAND, CUENTA_STAND } from './meta-stand.mjs';
import { crearMeta } from '../contenido/meta.mjs';
import { crearMetaAds, motivoNoImpulsable } from '../anuncios/meta-ads.mjs';
import { crearBorradores } from '../anuncios/borradores.mjs';
import { crearCreador } from '../anuncios/crear.mjs';
import { crearImpulsor, resolverOrigen, borradorDeImpulso } from '../anuncios/impulsar.mjs';
import { crearSugerencias, crearAplicador } from '../anuncios/sugerencias.mjs';
import { crearRutasAnuncios } from '../anuncios/rutas.mjs';
import { cuerpoCreativo } from '../anuncios/construir.mjs';
import { normalizarBorrador, validarBorrador } from '../anuncios/modelo.mjs';
import { emparejar } from '../src/contenido-publicadas.js';

const AJ = { cuenta: CUENTA_STAND, whatsapp: '50760001111', topeDiario: 20, topeMensual: 300, topeCampana: 150 };
const HOY = '2026-10-05';
const PIEZAS = {
  pig: { id: 'pig', titulo: 'Combo', fecha: HOY, hora: '18:00', redes: ['instagram'], estado: 'aprobada', texto: 'Combo 2x1 en lentes de sol: solo esta semana.', medios: ['2026-10/combo.jpg'] },
  pfb: { id: 'pfb', titulo: 'Examen', fecha: HOY, hora: '12:00', redes: ['facebook'], estado: 'aprobada', texto: 'Examen de la vista en 20 minutos.', medios: ['2026-10/examen.jpg'] },
  pfb2: { id: 'pfb2', titulo: 'Sin IG', fecha: HOY, hora: '13:00', redes: ['facebook'], estado: 'aprobada', texto: 'Solo para Facebook.', medios: [] },
  pmus: { id: 'pmus', titulo: 'Con música', fecha: HOY, hora: '19:00', redes: ['instagram'], estado: 'aprobada', texto: 'El reel con la canción del verano.', medios: [] },
  pno: { id: 'pno', titulo: 'Sin salir', fecha: '2026-10-20', hora: '10:00', redes: ['instagram'], estado: 'aprobada', texto: 'Todavía no.', medios: [] },
  psinid: { id: 'psinid', titulo: 'Salió sin id', fecha: HOY, hora: '09:00', redes: ['instagram'], estado: 'aprobada', texto: 'Ya salió.', medios: [] },
};
const SALIDAS = {
  pig: { estado: 'publicada', redes: { instagram: { estado: 'publicada', url: 'https://www.instagram.com/p/M7/' } } },
  pfb: { estado: 'publicada', entregadaAt: Date.parse(`${HOY}T12:00:00`), redes: { facebook: { estado: 'publicada', url: 'https://www.facebook.com/P1_55', id: 'P1_55' } } },
  pfb2: { estado: 'publicada', redes: { facebook: { estado: 'publicada', url: 'https://www.facebook.com/P1_56', id: 'P1_56' } } },
  pmus: { estado: 'publicada', redes: { instagram: { estado: 'publicada', url: 'https://www.instagram.com/p/M8/' } } },
  psinid: { estado: 'publicada', redes: { instagram: { estado: 'publicada', url: '' } } },
};
const PUBS = [ // lo que Analíticas guardó de Meta (contenido/metricas.mjs): id = `<cuenta>|<id de Meta>`
  { id: 'IG1|M7', cuentaId: 'IG1', red: 'instagram', externoId: 'M7', tipo: 'imagen', enlace: 'https://www.instagram.com/p/M7/', texto: 'Combo 2x1 en lentes de sol: solo esta semana.', miniatura: '/api/contenido/miniatura/0123456789abcdef0123', publicadaAt: `${HOY}T23:00:00.000Z`, interacciones: 300, alcance: 4000 },
  { id: 'IG1|M8', cuentaId: 'IG1', red: 'instagram', externoId: 'M8', tipo: 'reel', enlace: 'https://www.instagram.com/p/M8/', texto: 'El reel con la canción del verano.', miniatura: '', publicadaAt: `${HOY}T23:59:00.000Z`, interacciones: 120, alcance: 2000 },
];

const AHORA = Date.parse(`${HOY}T10:00:00`) + 864e5; // el reloj de la prueba: sin esto, «hoy» real deja fuera de plazo las fechas fijas de octubre
function montar(g, { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-a4-')), listo = true } = {}) {
  const meta = crearMeta({ env: { META_ACCESS_TOKEN: TOKEN_STAND, META_GRAPH_HOST: 'https://graph.test' }, fetchFn: g.fetchFn, dir: path.join(dir, 'contenido') });
  const ads = crearMetaAds({ meta });
  const sync = { listo: () => (listo ? { ok: true, motivo: '' } : { ok: false, motivo: 'Meta no está conectada' }), cuenta: () => CUENTA_STAND, anotar: () => {}, sincronizar: async () => ({ ok: true }) };
  const borradores = crearBorradores({ dir: path.join(dir, 'anuncios'), ajustes: () => AJ, ahora: () => AHORA });
  const galeria = { ruta: () => null, item: () => null }; // una publicación impulsada no usa la galería
  const creador = crearCreador({ dir: path.join(dir, 'anuncios'), ads, sync, borradores, galeria, ahora: () => AHORA, ajustes: () => AJ, cuentas: () => ({ pagina: 'P1', instagram: 'IG1' }), auditar: () => {}, dormir: () => new Promise(r => setTimeout(r, 5)) });
  const fuentes = () => ({ leerPieza: id => PIEZAS[id] || null, salidaDe: id => SALIDAS[id] || null, publicaciones: PUBS, emparejar });
  const impulsor = crearImpulsor({ borradores, creador, fuentes, ajustes: () => AJ, ahora: () => Date.parse(`${HOY}T10:00:00`) + 864e5 });
  return { dir, ads, sync, borradores, creador, impulsor };
}
const posts = (g, sub) => g.llamadas.filter(l => l.metodo === 'POST' && l.ruta.endsWith('/' + sub) && !String(l.campos.execution_options || '').includes('validate_only'));
const obj = v => (typeof v === 'string' ? JSON.parse(v) : v);

test('desde una pieza publicada en Instagram: borrador válido con su origen y se crea EN PAUSA con source_instagram_media_id', async () => {
  const g = crearMetaStand(), o = montar(g);
  const r = await o.impulsor.impulsar({ pieza: 'pig' });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  const b = r.cuerpo.borrador;
  assert.deepEqual({ red: b.origen.red, id: b.origen.id, pieza: b.origen.pieza, ref: b.origen.ref }, { red: 'instagram', id: 'M7', pieza: 'pig', ref: 'IG1|M7' });
  assert.match(b.nombre, /^Impulsar: Combo 2x1/); assert.equal(b.objetivo, 'mensajes'); assert.equal(b.destino, 'whatsapp', 'con WhatsApp en Ajustes');
  assert.equal(b.publico.modo, 'advantage'); assert.deepEqual(b.presupuesto, { tipo: 'diario', usd: 5 }); assert.ok(b.fin, 'con fecha de fin (7 días)');
  assert.equal(b.creativos.length, 1); assert.equal(b.creativos[0].media, null, 'la publicación es el creativo: nada de la galería');
  assert.equal(b.origen.miniatura, '/api/contenido/miniatura/0123456789abcdef0123'); assert.equal(b.origen.enlace, 'https://www.instagram.com/p/M7/');
  assert.equal(b.validacion?.ok, true, JSON.stringify(b.validacion?.problemas)); assert.equal(b.validacion.impulsable.ok, true);
  assert.ok(g.llamadas.some(l => l.metodo === 'GET' && l.ruta === '/M7' && /boost_eligibility_info/.test(l.q.fields || '')), 'pregunta a Meta si deja impulsarla');
  const c = await o.creador.crear(b.id);
  assert.equal(c.status, 202, JSON.stringify(c.cuerpo)); await o.creador.esperar(b.id);
  const fin = o.borradores.leer(b.id); assert.equal(fin.estado, 'creado', fin.error);
  assert.equal(posts(g, 'adimages').length, 0, 'no sube nada'); assert.equal(posts(g, 'advideos').length, 0);
  const cr = posts(g, 'adcreatives'); assert.equal(cr.length, 1);
  assert.equal(cr[0].campos.source_instagram_media_id, 'M7'); assert.equal(cr[0].campos.object_id, 'P1'); assert.equal(cr[0].campos.instagram_user_id, 'IG1');
  assert.equal(cr[0].campos.object_story_spec, undefined); assert.equal(cr[0].campos.degrees_of_freedom_spec, undefined, 'sin mejoras de Meta sobre lo publicado');
  assert.equal(obj(cr[0].campos.call_to_action).type, 'WHATSAPP_MESSAGE');
  assert.ok([...Object.values(g.st.campanas), ...Object.values(g.st.conjuntos), ...Object.values(g.st.anuncios)].every(x => x.status === 'PAUSED'), 'todo en pausa');
  assert.equal(Object.values(g.st.anuncios).length, 1);
  // la vista previa de Meta no aplica: la publicación es lo que se ve
  assert.equal((await o.creador.vistaPrevia(b.id)).status, 409);
});

test('desde una pieza publicada en Facebook (el id que apuntó la cola): object_story_id; sin Instagram si Meta no lo deja', async () => {
  const g = crearMetaStand({ fallar: { noIG: ['P1_56'] } }), o = montar(g);
  let r = await o.impulsor.impulsar({ pieza: 'pfb' });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  let b = r.cuerpo.borrador;
  assert.deepEqual([b.origen.red, b.origen.id], ['facebook', 'P1_55']); assert.equal(b.origen.texto, PIEZAS.pfb.texto); assert.equal(b.origen.miniatura, '/media/2026-10/examen.jpg');
  assert.equal(b.validacion.ok, true, JSON.stringify(b.validacion.problemas)); assert.equal(b.validacion.impulsable.instagram, true);
  await o.creador.crear(b.id); await o.creador.esperar(b.id);
  assert.equal(o.borradores.leer(b.id).estado, 'creado', o.borradores.leer(b.id).error);
  let cr = posts(g, 'adcreatives').at(-1).campos;
  assert.equal(cr.object_story_id, 'P1_55'); assert.equal(cr.instagram_user_id, 'IG1'); assert.equal(cr.source_instagram_media_id, undefined);

  r = await o.impulsor.impulsar({ pieza: 'pfb2' }); b = r.cuerpo.borrador;
  assert.equal(b.validacion.ok, true); assert.ok(b.validacion.problemas.some(p => p.campo === 'origen' && /solo en Facebook/.test(p.texto)), 'lo dice como aviso');
  await o.creador.crear(b.id); await o.creador.esperar(b.id);
  assert.equal(o.borradores.leer(b.id).estado, 'creado', o.borradores.leer(b.id).error);
  cr = posts(g, 'adcreatives').at(-1).campos;
  assert.equal(cr.object_story_id, 'P1_56'); assert.equal(cr.instagram_user_id, undefined, 'sin instagram_user_id: Meta no la deja en Instagram');
});

test('una publicación que Meta no deja impulsar (música con derechos) no se crea y dice por qué', async () => {
  const g = crearMetaStand({ fallar: { noImpulsable: { M8: 'MUSIC_COPYRIGHT' } } }), o = montar(g);
  const r = await o.impulsor.impulsar({ pieza: 'pmus' });
  assert.equal(r.status, 200); const b = r.cuerpo.borrador;
  assert.equal(b.validacion.ok, false);
  const p = b.validacion.problemas.find(x => x.campo === 'origen' && x.nivel === 'error');
  assert.match(p.texto, /Meta no deja impulsar esta publicación: tiene música con derechos/);
  const c = await o.creador.crear(b.id);
  assert.equal(c.status, 422); assert.equal(Object.keys(g.st.creativos).length, 0); assert.equal(Object.keys(g.st.campanas).length, 0);
  assert.match(motivoNoImpulsable('NOT_ELIGIBLE_INTERACTIVE_STICKER'), /elementos interactivos/);
  assert.match(motivoNoImpulsable('IGTV'), /Instagram TV/);
});

test('lo que no salió, o salió sin id conocido, se dice; la misma publicación dos veces no hace dos borradores', async () => {
  const g = crearMetaStand(), o = montar(g);
  let r = await o.impulsor.impulsar({ pieza: 'pno' }); assert.equal(r.status, 409); assert.match(r.cuerpo.motivo, /todavía no salió/);
  r = await o.impulsor.impulsar({ pieza: 'psinid' }); assert.equal(r.status, 409); assert.match(r.cuerpo.motivo, /todavía no sé su id/);
  r = await o.impulsor.impulsar({ pieza: 'nada' }); assert.equal(r.status, 404);
  r = await o.impulsor.impulsar({}); assert.equal(r.status, 400);
  r = await o.impulsor.impulsar({ id: 'M7', red: 'tiktok' }); assert.equal(r.status, 400);
  const a = await o.impulsor.impulsar({ id: 'IG1|M7' }), b = await o.impulsor.impulsar({ pieza: 'pig' });
  assert.equal(a.status, 200); assert.equal(b.cuerpo.ya, true); assert.equal(a.cuerpo.borrador.id, b.cuerpo.borrador.id);
  assert.equal(o.borradores.lista().length, 1);
  // sin pieza y fuera de Analíticas: con la red y el id de Meta, igual
  const x = resolverOrigen({ id: '17890001', red: 'instagram' }, { publicaciones: [] });
  assert.deepEqual([x.origen.red, x.origen.id], ['instagram', '17890001']);
});

test('un agente solo deja el borrador (sin su id: 403) y nunca crea en Meta; el asistente también deja borrador', async () => {
  const g = crearMetaStand(), o = montar(g);
  assert.equal((await o.impulsor.impulsar({ pieza: 'pig', por: 'agente' })).status, 403);
  const r = await o.impulsor.impulsar({ pieza: 'pig', por: 'agente', agente: 'ada' });
  assert.equal(r.status, 200); assert.equal(r.cuerpo.borrador.de, 'agente:ada'); assert.equal(r.cuerpo.borrador.estado, 'borrador');
  assert.equal((await o.creador.crear(r.cuerpo.borrador.id, { quien: 'agente' })).status, 403);
  assert.equal(Object.keys(g.st.campanas).length, 0);
  assert.equal((await o.impulsor.impulsar({ pieza: 'pfb', por: 'asistente' })).cuerpo.borrador.de, 'asistente');
  assert.equal((await o.impulsor.impulsar({ pieza: 'pfb', por: 'piloto' })).status, 403);
});

test('aplicar la sugerencia «impulsar» (A5) crea el borrador con esa publicación y la deja aplicada; un agente y el asistente no', async () => {
  const g = crearMetaStand(), o = montar(g);
  const sug = crearSugerencias({ dir: path.join(o.dir, 'anuncios') });
  const s = { id: 'impulsar-IG1_M7', regla: 'impulsar', objeto: { id: 'IG1|M7', nivel: 'publicacion', nombre: 'Combo 2x1' }, dato: 'tuvo 300 interacciones: 3 veces tu media', porque: 'ya funcionó', cambio: { tipo: 'impulsar', id: 'IG1|M7' }, efecto: 'un borrador', riesgo: { reiniciaAprendizaje: false, gastaMas: false, texto: '' }, prioridad: 3, gasto: false };
  sug.actualizar({ sugerencias: [s] });
  const ap = crearAplicador({ sug, acciones: { accion: async () => ({ status: 500, cuerpo: {} }) }, borradores: o.borradores, impulsar: b => o.impulsor.impulsar(b) });
  assert.equal((await ap.aplicar(s.id, { por: 'agente' })).status, 403);
  assert.equal((await ap.aplicar(s.id, { por: 'asistente' })).status, 403);
  const r = await ap.aplicar(s.id, { por: 'dueno' });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo)); assert.equal(r.cuerpo.ok, true);
  assert.equal(r.cuerpo.borrador.origen.id, 'M7'); assert.equal(r.cuerpo.hecho.tipo, 'impulsar'); assert.equal(r.cuerpo.hecho.borrador, r.cuerpo.borrador.id);
  assert.equal(r.cuerpo.sugerencia.estado, 'aplicada'); assert.equal(Object.keys(g.st.campanas).length, 0, 'nada en Meta todavía');
  assert.equal((await ap.aplicar(s.id, { por: 'dueno' })).status, 409, 'aplicar dos veces: ya se aplicó');
});

test('POST /api/anuncios/impulsar: también un agente (nace borrador); otro método, 405', async () => {
  const g = crearMetaStand(), o = montar(g);
  const json = (res, code, cuerpo) => { res.code = code; res.cuerpo = cuerpo; };
  const handle = crearRutasAnuncios({ sync: o.sync, meta: { uso: () => ({}) }, json, body: async req => req.cuerpo, borradores: o.borradores, creador: o.creador, impulsor: o.impulsor });
  const pedir = async (metodo, cuerpo) => { const res = {}; await handle({ method: metodo, cuerpo }, res, new URL('http://x/api/anuncios/impulsar')); return res; };
  let res = await pedir('POST', { pieza: 'pfb', por: 'agente', agente: 'ada' });
  assert.equal(res.code, 200, JSON.stringify(res.cuerpo)); assert.equal(res.cuerpo.borrador.de, 'agente:ada'); assert.equal(res.cuerpo.borrador.origen.id, 'P1_55');
  res = await pedir('GET'); assert.equal(res.code, 405);
});

test('el modelo: con origen, un solo creativo (la publicación) y se conserva la llamada; los cuerpos de Meta, puros', () => {
  const ahora = Date.parse(`${HOY}T10:00:00`);
  let b = normalizarBorrador({ ...borradorDeImpulso({ tipo: 'publicacion', red: 'instagram', id: 'M7', texto: 'Hola' }, { ajustes: AJ, ahora }), creativos: [{ llamada: 'LEARN_MORE' }, { media: 'x' }] }, null, { ajustes: AJ, ahora });
  assert.equal(b.creativos.length, 1); assert.equal(b.creativos[0].llamada, 'LEARN_MORE'); assert.equal(b.creativos[0].texto, 'Hola');
  b = normalizarBorrador({ nombre: 'Otro nombre' }, b, { ajustes: AJ, ahora });
  assert.equal(b.creativos[0].llamada, 'LEARN_MORE', 'cambiar otra cosa no la pierde');
  assert.throws(() => normalizarBorrador({ origen: { red: 'tiktok', id: '1' } }, null, { ajustes: AJ, ahora }), /Instagram o de Facebook/);
  assert.throws(() => normalizarBorrador({ origen: { red: 'instagram', id: 'a/b' } }, null, { ajustes: AJ, ahora }), /id de Meta/);
  const v = validarBorrador(b, { ajustes: AJ, cuentas: { pagina: 'P1', instagram: null }, ahora });
  assert.ok(v.problemas.some(p => p.campo === 'origen' && p.nivel === 'error' && /Instagram de empresa/.test(p.texto)), 'IG sin Instagram unido: no');
  assert.ok(!v.problemas.some(p => /creativo/.test(p.campo)), 'nada de «faltan creativos»');
  const ig = cuerpoCreativo(b, b.creativos[0], { pagina: 'P1', instagram: 'IG1' });
  assert.deepEqual(Object.keys(ig).sort(), ['call_to_action', 'instagram_user_id', 'name', 'object_id', 'source_instagram_media_id']);
  const fb = cuerpoCreativo({ ...b, origen: { ...b.origen, red: 'facebook', id: '55' } }, b.creativos[0], { pagina: 'P1', instagram: 'IG1', sinInstagram: true });
  assert.equal(fb.object_story_id, 'P1_55', 'el id sin página se completa con la página'); assert.equal(fb.instagram_user_id, undefined);
});
