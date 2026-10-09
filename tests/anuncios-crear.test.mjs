// Fase A3 de Anuncios (9 oct 2026): «Crear en Meta (en pausa)» contra el Meta de mentira (tests/meta-stand.mjs). anuncios/crear.mjs:
//   · en orden (imágenes → creativos → campaña → conjunto → anuncios) y TODO en pausa, con la etiqueta AO:<id> en cada nombre;
//   · la oficina «se cae» entre el conjunto y el anuncio (Meta creó el conjunto y la respuesta no llegó nunca) → al volver, reconcilia por
//     la etiqueta y termina SIN duplicar: una campaña y un conjunto en Meta;
//   · un paso que falla archiva lo creado en ese intento (nunca DELETE) y deja el borrador «fallo» con el error en palabras; reintentar
//     empieza un intento nuevo que no toma lo archivado;
//   · solo el dueño crea (403 a un agente, al asistente y a Dimitri); uno que no valida → 422 con los problemas.
// Se espera AL HECHO (bucles con tope), nunca un tiempo fijo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearMetaStand, TOKEN_STAND, CUENTA_STAND } from './meta-stand.mjs';
import { crearMeta } from '../contenido/meta.mjs';
import { crearMetaAds } from '../anuncios/meta-ads.mjs';
import { crearBorradores } from '../anuncios/borradores.mjs';
import { crearCreador, resolverCuentas } from '../anuncios/crear.mjs';
import { etiqueta } from '../anuncios/modelo.mjs';

const esperar = async (fn, { max = 15000, cada = 20, que = 'algo' } = {}) => { const t0 = Date.now(); for (;;) { const r = await fn(); if (r) return r; if (Date.now() - t0 > max) throw new Error(`no llegó a tiempo: ${que}`); await new Promise(x => setTimeout(x, cada)); } };
const JPEG = n => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, n)]);
const AJ = { cuenta: CUENTA_STAND, whatsapp: '50760001111', topeDiario: 20, topeMensual: 300, topeCampana: 150 };

function montar(g, { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-a3-crear-')), listo = true } = {}) {
  const gal = path.join(dir, 'galeria'); fs.mkdirSync(gal, { recursive: true });
  const archivos = { m1: 'uno.jpg', m2: 'dos.jpg', m3: 'tres.png', v1: 'clip.mp4' };
  for (const [id, f] of Object.entries(archivos)) if (!fs.existsSync(path.join(gal, f))) fs.writeFileSync(path.join(gal, f), id === 'v1' ? Buffer.alloc(300, 7) : JPEG(id.charCodeAt(1)));
  const galeria = { ruta: id => (archivos[id] ? path.join(gal, archivos[id]) : null), item: id => (archivos[id] ? { kind: id.startsWith('v') ? 'video' : 'image' } : null) };
  const meta = crearMeta({ env: { META_ACCESS_TOKEN: TOKEN_STAND, META_GRAPH_HOST: 'https://graph.test' }, fetchFn: g.fetchFn, dir: path.join(dir, 'contenido') });
  const ads = crearMetaAds({ meta });
  const historial = [], auditoria = [], sincronizadas = [];
  const sync = { listo: () => (listo ? { ok: true, motivo: '' } : { ok: false, motivo: 'Meta no está conectada' }), cuenta: () => CUENTA_STAND, anotar: e => historial.push(e), sincronizar: async o => { sincronizadas.push(o); return { ok: true }; } };
  const borradores = crearBorradores({ dir: path.join(dir, 'anuncios'), ajustes: () => AJ });
  const creador = crearCreador({ dir: path.join(dir, 'anuncios'), ads, sync, borradores, galeria, ajustes: () => AJ, cuentas: () => ({ pagina: 'P1', instagram: 'IG1' }), auditar: a => auditoria.push(a), dormir: () => new Promise(r => setTimeout(r, 5)), videoCadaMs: 5 });
  return { dir, ads, sync, borradores, creador, historial, auditoria, sincronizadas };
}
const creativos = [{ id: 'k1', media: 'm1', formato: '1:1', texto: 'Escríbenos por WhatsApp', titular: 'Combo 2x1' }, { id: 'k2', media: 'm2', formato: '4:5', texto: 'Tu combo, hoy' }, { id: 'k3', media: 'm1', formato: '9:16', texto: 'Pídelo ya' }];
const nuevo = (o, e = {}) => o.borradores.crear({ nombre: 'Combo', presupuesto: { usd: 10 }, creativos, ...e });

test('crear en orden y todo EN PAUSA: imágenes (una sola subida por imagen), creativos, campaña, conjunto y anuncios, con la etiqueta', async () => {
  const g = crearMetaStand(), o = montar(g), b = nuevo(o);
  const r = await o.creador.crear(b.id);
  assert.equal(r.status, 202, JSON.stringify(r.cuerpo)); assert.equal(o.borradores.leer(b.id).estado, 'creando');
  assert.equal(g.st.validaciones, 1, 'validate_only en la campaña antes de nada');
  await o.creador.esperar(b.id);
  const fin = o.borradores.leer(b.id);
  assert.equal(fin.estado, 'creado', fin.error); assert.equal(fin.progreso, null);
  const camps = Object.values(g.st.campanas), conjs = Object.values(g.st.conjuntos), ads = Object.values(g.st.anuncios);
  assert.equal(camps.length, 1); assert.equal(conjs.length, 1); assert.equal(ads.length, 3); assert.equal(Object.keys(g.st.creativos).length, 3);
  assert.ok([...camps, ...conjs, ...ads].every(x => x.status === 'PAUSED'), 'todo nace en pausa');
  for (const x of [...camps, ...conjs, ...ads, ...Object.values(g.st.creativos)]) assert.equal(etiqueta(x.name).borrador, b.id, x.name);
  assert.deepEqual(fin.meta, { campana: camps[0].id, conjunto: conjs[0].id, creativos: Object.keys(g.st.creativos), anuncios: ads.map(a => a.id) });
  assert.equal(Object.keys(g.st.imagenes).length, 2, 'm1 se sube una vez aunque la usen dos creativos');
  // el orden: creativos antes de la campaña; la campaña antes del conjunto; el conjunto antes de los anuncios
  const posts = g.llamadas.filter(l => l.metodo === 'POST' && /\/(adimages|adcreatives|campaigns|adsets|ads)$/.test(l.ruta) && !String(l.campos.execution_options || '').includes('validate_only')).map(l => l.ruta.split('/').pop());
  assert.deepEqual([...new Set(posts)], ['adimages', 'adcreatives', 'campaigns', 'adsets', 'ads']);
  assert.equal(camps[0].spend_cap, '15000'); assert.equal(conjs[0].destination_type, 'WHATSAPP');
  assert.equal(o.historial.length, 1); assert.equal(o.historial[0].que, 'crear en pausa'); assert.equal(o.historial[0].objeto.id, camps[0].id);
  assert.ok(o.auditoria.some(a => a.que === 'crear en pausa' && a.ok && a.objeto?.nivel === 'campana'));
  assert.equal(o.sincronizadas.length, 1, 'se relee la cuenta al terminar');
  // y no se crea dos veces
  assert.equal((await o.creador.crear(b.id)).status, 409);
});

test('la oficina se cae entre el conjunto y el anuncio → al volver reconcilia por la etiqueta y termina SIN duplicar', async () => {
  const g = crearMetaStand({ fallar: { trasConjunto: true } }), o1 = montar(g), b = nuevo(o1);
  assert.equal((await o1.creador.crear(b.id)).status, 202);
  await esperar(() => g.st.colgadas === 1, { que: 'Meta creó el conjunto y no contestó' });
  // «la oficina se cae»: el creador 1 queda colgado para siempre; otro proceso arranca sobre la misma carpeta
  const diario = JSON.parse(fs.readFileSync(path.join(o1.dir, 'anuncios', 'creaciones.json'), 'utf8'))[b.id];
  assert.equal(diario.enCurso.nivel, 'conjunto', 'el diario apuntó el conjunto ANTES de pedirlo'); assert.equal(diario.pasos.conjunto, null, 'y nunca supo su id');
  assert.ok(diario.pasos.campana, 'la campaña sí quedó apuntada');
  const o2 = montar(g, { dir: o1.dir });
  assert.deepEqual(o2.creador.alArrancar(), [b.id]);
  await o2.creador.esperar(b.id);
  const fin = o2.borradores.leer(b.id);
  assert.equal(fin.estado, 'creado', fin.error);
  assert.equal(Object.keys(g.st.campanas).length, 1, 'UNA campaña'); assert.equal(Object.keys(g.st.conjuntos).length, 1, 'UN conjunto');
  assert.equal(Object.keys(g.st.anuncios).length, 3); assert.equal(Object.keys(g.st.creativos).length, 3, 'los creativos tampoco se duplican');
  assert.equal(fin.meta.conjunto, Object.keys(g.st.conjuntos)[0], 'el conjunto que Meta ya tenía');
  assert.ok(JSON.parse(fs.readFileSync(path.join(o1.dir, 'anuncios', 'creaciones.json'), 'utf8'))[b.id].creados.some(x => x.nivel === 'conjunto' && x.reconciliado));
});

test('un paso que falla archiva lo creado en ese intento y deja «fallo» con el error en palabras; reintentar no toma lo archivado', async () => {
  const g = crearMetaStand({ fallar: { crearAnuncio: 1 } }), o = montar(g), b = nuevo(o);
  assert.equal((await o.creador.crear(b.id)).status, 202);
  await o.creador.esperar(b.id);
  const f = o.borradores.leer(b.id);
  assert.equal(f.estado, 'fallo'); assert.match(f.error, /No se pudo crear en Meta: Meta no lo acepta: El creativo no es válido para esta ubicación/); assert.match(f.error, /ARCHIVADO/);
  assert.equal(Object.values(g.st.campanas)[0].status, 'ARCHIVED'); assert.equal(Object.values(g.st.conjuntos)[0].status, 'ARCHIVED');
  assert.equal(g.st.borrados.length, 0, 'nunca DELETE');
  assert.ok(o.historial.some(h => h.que === 'crear en pausa (falló)'));
  // reintentar: un intento nuevo, con objetos nuevos (lo archivado no cuenta)
  assert.equal((await o.creador.crear(b.id)).status, 202);
  await o.creador.esperar(b.id);
  const ok = o.borradores.leer(b.id);
  assert.equal(ok.estado, 'creado', ok.error);
  assert.equal(Object.values(g.st.campanas).filter(c => c.status === 'PAUSED').length, 1); assert.equal(Object.values(g.st.campanas).length, 2);
  assert.notEqual(ok.meta.campana, Object.values(g.st.campanas)[0].id);
});

test('solo el dueño crea; uno que no valida da 422 con los problemas; sin Meta, 409; Meta que rechaza en validate_only, 422', async () => {
  const g = crearMetaStand(), o = montar(g);
  const b = nuevo(o);
  for (const quien of ['agente', 'asistente', 'dimitri', 'otro']) assert.equal((await o.creador.crear(b.id, { quien })).status, 403, quien);
  const malo = o.borradores.crear({ nombre: 'Sin nada', creativos: [] });
  const r = await o.creador.crear(malo.id);
  assert.equal(r.status, 422); assert.equal(r.cuerpo.error, 'validacion'); assert.match(r.cuerpo.problemas[0].texto, /Faltan creativos/);
  assert.equal(o.borradores.leer(malo.id).estado, 'borrador');
  const sinMeta = montar(g, { listo: false }); const b2 = nuevo(sinMeta);
  assert.equal((await sinMeta.creador.crear(b2.id)).status, 409);
  const bajo = nuevo(o, { presupuesto: { usd: 1.2 } });
  const g2 = crearMetaStand({ torcer: l => (l.ruta === `/${CUENTA_STAND}/campaigns` && String(l.campos.execution_options || '').includes('validate_only') ? new Response(JSON.stringify({ error: { message: 'x', code: 100, error_user_title: 'El presupuesto es demasiado bajo', error_user_msg: 'Mínimo US$2.00' } }), { status: 400, headers: { 'content-type': 'application/json' } }) : null) });
  const o3 = montar(g2, { dir: o.dir });
  const r3 = await o3.creador.crear(bajo.id);
  assert.equal(r3.status, 422); assert.match(r3.cuerpo.problemas.map(p => p.texto).join(' '), /demasiado bajo/);
  assert.equal(o3.borradores.leer(bajo.id).validacion.meta.ok, false);
  assert.equal(Object.keys(g2.st.campanas).length, 0, 'nada creado');
});

test('un video: se sube a advideos, se espera a que Meta lo procese y el creativo lleva video_data con su miniatura', async () => {
  const g = crearMetaStand({ procesar: 2 }), o = montar(g);
  const b = nuevo(o, { creativos: [{ id: 'k1', media: 'v1', formato: '9:16', texto: 'Mira esto' }, ...creativos.slice(0, 2)] });
  assert.equal((await o.creador.crear(b.id)).status, 202);
  await o.creador.esperar(b.id);
  assert.equal(o.borradores.leer(b.id).estado, 'creado', o.borradores.leer(b.id).error);
  const cre = Object.values(g.st.creativos).find(c => c.object_story_spec.video_data);
  assert.equal(cre.object_story_spec.video_data.video_id, Object.keys(g.st.videos)[0]); assert.match(cre.object_story_spec.video_data.image_url, /miniatura/);
  assert.equal(cre.degrees_of_freedom_spec.creative_features_spec.video_auto_crop.enroll_status, 'OPT_IN');
});

test('la vista previa de Meta: sube la imagen (mismo hash) y devuelve el HTML de generatepreviews; sin Meta, 409', async () => {
  const g = crearMetaStand(), o = montar(g), b = nuevo(o);
  const r = await o.creador.vistaPrevia(b.id, { formato: 'INSTAGRAM_STORY' });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo)); assert.match(r.cuerpo.html, /INSTAGRAM_STORY/); assert.equal(r.cuerpo.creativo, 'k1');
  assert.equal((await o.creador.vistaPrevia(b.id, { formato: 'RARO' })).status, 400);
  assert.equal(Object.keys(g.st.campanas).length, 0, 'no crea nada');
  assert.equal((await montar(g, { dir: o.dir, listo: false }).creador.vistaPrevia(b.id)).status, 409);
});

test('resolverCuentas: la de Ajustes, si no la de Contenido, si no la primera con Instagram', () => {
  const cuentas = [{ red: 'facebook', paginaId: 'P0', externoId: 'P0' }, { red: 'facebook', paginaId: 'P1', externoId: 'P1' }, { red: 'instagram', paginaId: 'P1', externoId: 'IG1' }];
  assert.deepEqual(resolverCuentas({ cuentas }), { pagina: 'P1', instagram: 'IG1' });
  assert.deepEqual(resolverCuentas({ cuentas, paginaContenido: 'P0' }), { pagina: 'P0', instagram: null });
  assert.deepEqual(resolverCuentas({ cuentas, ajustes: { pagina: 'P1', instagram: '999' } }), { pagina: 'P1', instagram: '999' });
  assert.deepEqual(resolverCuentas({}), { pagina: null, instagram: null });
});
