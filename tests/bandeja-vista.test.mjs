// Fase B1 (9 oct 2026): lo puro de la BANDEJA en la página — qué ofrece un comentario según esté oculto, sea respuesta, venga de un
// anuncio o lo sugiera ocultar un agente — y la demo (en memoria): ocultar con DESHACER y que un oculto no se responda.
import test from 'node:test';
import assert from 'node:assert/strict';
import { accionesDe, fuenteDe, fuentesDe, filtrarBandeja, publicacionDe, restante, OCULTO_NO_RESPONDE } from '../src/contenido-bandeja.js';
import { crearDatos } from '../src/contenido-datos.js';
import { ventanaDe, esConversacion, ultimoMensaje, VENTANA_CERRADA } from '../src/contenido-bandeja.js'; // B2
import { medir, bytesUtf8, imagenDeMeta, adjuntoDe, htmlConversacion, ordenados, LIMITE } from '../src/contenido-conversacion.js'; // B2 (va en el paquete del editor)

const com = o => ({ id: 'comentarios:1', tipo: 'comentarios', fuente: 'meta', red: 'instagram', autor: 'ana', texto: 'hola', estado: 'nuevo', oculto: false, enAnuncio: null, padre: null, sugerirOcultar: null, ...o });

test('un comentario de Meta se puede ocultar; uno oculto se puede mostrar y no se responde', () => {
  const a = accionesDe(com());
  assert.equal(a.ocultar, 'ocultar'); assert.equal(a.oculto, false); assert.equal(a.responder.puede, true);
  const b = accionesDe(com({ oculto: true }));
  assert.equal(b.ocultar, 'mostrar'); assert.equal(b.oculto, true);
  assert.deepEqual(b.responder, { puede: false, motivo: OCULTO_NO_RESPONDE });
});

test('nada que no sea un comentario de Meta ofrece ocultar (Metricool, mensajes, reseñas)', () => {
  assert.equal(accionesDe(com({ fuente: 'metricool' })).ocultar, null);
  assert.equal(accionesDe(com({ fuente: undefined })).ocultar, null, 'lo de antes de B1 era de Metricool');
  assert.equal(accionesDe(com({ tipo: 'conversaciones' })).ocultar, null);
  assert.equal(accionesDe(com({ tipo: 'resenas' })).ocultar, null);
  assert.equal(accionesDe(com({ fuente: 'metricool', oculto: true })).responder.puede, true, 'sin ocultar posible, «oculto» no cuenta');
});

test('responder: respondido o descartado no; cada uno dice por qué', () => {
  assert.equal(accionesDe(com({ estado: 'respondido' })).responder.puede, false);
  assert.match(accionesDe(com({ estado: 'descartado' })).responder.motivo, /reábrelo/);
  assert.equal(accionesDe(com({ estado: 'borrador' })).responder.puede, true);
  assert.equal(accionesDe(com({ estado: 'fallo' })).responder.puede, true);
});

test('la sugerencia de ocultar: con quién y su motivo; no si ya está oculto o el dueño dijo «No»', () => {
  const s = accionesDe(com({ sugerirOcultar: { motivo: 'spam' } })).sugerencia;
  assert.deepEqual(s, { quien: 'MARKETING', motivo: 'spam' });
  assert.equal(accionesDe(com({ sugerirOcultar: { motivo: 'spam' }, enAnuncio: { campana: 'c1', nombre: 'X' } })).sugerencia.quien, 'ANUNCIOS');
  assert.equal(accionesDe(com({ sugerirOcultar: { motivo: 'spam', quien: 'newt' } })).sugerencia.quien, 'NEWT');
  assert.equal(accionesDe(com({ sugerirOcultar: { motivo: 'spam' }, oculto: true })).sugerencia, null);
  assert.equal(accionesDe(com({ sugerirOcultar: { motivo: 'spam' } }), { noSugerir: new Set(['comentarios:1']) }).sugerencia, null);
  assert.equal(accionesDe(com({ sugerirOcultar: { motivo: 'spam' }, fuente: 'metricool' })).sugerencia, null, 'lo que no se puede ocultar no se sugiere');
});

test('en un anuncio, de qué publicación viene y de cuál cuelga', () => {
  const a = accionesDe(com({ enAnuncio: { campana: 'c1', anuncio: 'a1', nombre: 'Examen gratis' }, padre: 'comentarios:0', publicacion: { id: 'p', texto: 'Lentes', enlace: 'https://instagram.test/p/1', miniatura: 'https://cdn.test/m.jpg' } }));
  assert.deepEqual(a.anuncio, { campana: 'c1', anuncio: 'a1', nombre: 'Examen gratis' });
  assert.equal(a.padre, 'comentarios:0');
  assert.deepEqual(a.publicacion, { id: 'p', texto: 'Lentes', enlace: 'https://instagram.test/p/1', miniatura: 'https://cdn.test/m.jpg' });
  assert.equal(accionesDe(com()).anuncio, null); assert.equal(accionesDe(com()).padre, null);
  assert.equal(accionesDe(com({ enAnuncio: { campana: 'c1' } })).anuncio.nombre, 'sin nombre');
});

test('la publicación: texto de antes, objeto de B1, y nada de enlaces raros', () => {
  assert.deepEqual(publicacionDe({ publicacion: 'Lentes' }), { id: '', texto: 'Lentes', enlace: '', miniatura: '' });
  assert.equal(publicacionDe({ publicacion: null }), null); assert.equal(publicacionDe({}), null);
  const p = publicacionDe({ publicacion: { texto: 'x', enlace: 'javascript:alert(1)', miniatura: 'data:image/png;base64,AAA' } });
  assert.equal(p.enlace, ''); assert.equal(p.miniatura, '');
});

test('fuentes y filtros: por fuente y solo en anuncios', () => {
  const l = [com({ id: 'a' }), com({ id: 'b', fuente: 'metricool' }), com({ id: 'c', enAnuncio: { campana: 'c1', nombre: 'X' } }), { id: 'd', tipo: 'resenas' }];
  assert.equal(fuenteDe({}), 'metricool');
  assert.deepEqual(fuentesDe(l), ['meta', 'metricool']); assert.deepEqual(fuentesDe([com()]), ['meta']);
  assert.deepEqual(filtrarBandeja(l, { fuente: 'meta' }).map(x => x.id), ['a', 'c']);
  assert.deepEqual(filtrarBandeja(l, { fuente: 'metricool' }).map(x => x.id), ['b', 'd']);
  assert.deepEqual(filtrarBandeja(l, { anuncios: true }).map(x => x.id), ['c']);
  assert.equal(filtrarBandeja(l).length, 4);
});

test('la cuenta atrás de DESHACER', () => {
  assert.equal(restante(10_500, 1_000), 10); assert.equal(restante(500, 1_000), 0);
  assert.equal(restante(new Date(16_000).toISOString(), 1_000), 15); assert.equal(restante('nada'), 0);
});

test('la demo: hay de todo, ocultar deja DESHACER, un oculto no se responde (409) y deshacer lo devuelve', async () => {
  const d = crearDatos({ served: false });
  const r = await d.bandeja({ estado: 'pendiente' });
  assert.deepEqual(fuentesDe(r.items), ['meta', 'metricool']);
  assert.ok(r.items.some(x => x.enAnuncio), 'uno en un anuncio'); assert.ok(r.items.some(x => x.sospecha), 'uno con 🛡');
  assert.ok(r.items.some(x => x.sugerirOcultar), 'uno con sugerencia'); assert.ok(r.items.some(x => x.padre), 'una respuesta');
  assert.equal((await d.bandeja({ fuente: 'metricool' })).items.every(x => x.fuente === 'metricool'), true);
  const o = await d.bandejaOcultar('comentarios:d7', true);
  assert.equal(o.item.oculto, true); assert.ok(o.deshacer.token); assert.ok(restante(o.deshacer.hasta) > 0);
  await assert.rejects(d.bandejaAccion('comentarios:d7', 'enviar', 'hola'), e => e.status === 409 && /oculto/.test(e.motivo));
  await d.bandejaDeshacer(o.deshacer.token);
  const m = (await d.bandeja()).items.find(x => x.id === 'comentarios:d7');
  assert.equal(m.oculto, false); assert.ok(m.sugerirOcultar, 'la sugerencia vuelve con el deshacer');
  await assert.rejects(d.bandejaDeshacer(o.deshacer.token), /ya pasó/);
  await assert.rejects(d.bandejaOcultar('resenas:d3', true), /solo se ocultan/);
});

/* ---------- Fase B2 (9 oct 2026): las conversaciones privadas ---------- */
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const AHORA = Date.parse('2026-10-09T12:00:00Z');
const conv = o => ({ id: 'meta:conv:1', tipo: 'conversaciones', fuente: 'meta', red: 'instagram', autor: 'ana', estado: 'nuevo', borrador: null, sospecha: '',
  mensajes: [{ id: 'b', de: 'tu', texto: 'Hola', at: '2026-10-09T10:00:00Z', adjuntos: [] }, { id: 'a', de: 'cliente', texto: '¿Precio?', at: '2026-10-09T09:00:00Z', adjuntos: [] }, { id: 'c', de: 'cliente', texto: 'Este', at: '2026-10-09T11:00:00Z', adjuntos: [{ tipo: 'image', url: 'https://scontent.cdninstagram.com/x.jpg' }] }],
  ventana: { abierta: true, hasta: new Date(Date.now() + 5 * 3600e3 + 30e3).toISOString(), quedaMin: 300 }, ...o });

test('B2 · la ventana de 24 h → texto: horas, minutos, cerrada, y quedaMin contado desde que llegó', () => {
  const v = ventanaDe({ abierta: true, hasta: new Date(AHORA + 5 * 3600e3 + 30e3).toISOString() }, AHORA);
  assert.equal(v.abierta, true); assert.equal(v.texto, 'Puedes responder durante 5 h más.'); assert.equal(v.corto, 'quedan 5 h');
  assert.equal(ventanaDe({ abierta: true, hasta: new Date(AHORA + 80 * 60e3).toISOString() }, AHORA).texto, 'Puedes responder durante 1 h 20 min más.');
  assert.equal(ventanaDe({ abierta: true, hasta: new Date(AHORA + 40 * 60e3).toISOString() }, AHORA).corto, 'quedan 40 min');
  const c = ventanaDe({ abierta: false, hasta: null }, AHORA);
  assert.deepEqual([c.abierta, c.texto, c.corto], [false, VENTANA_CERRADA, 'ventana cerrada']);
  assert.equal(ventanaDe({ abierta: true, hasta: new Date(AHORA - 1).toISOString() }, AHORA).abierta, false, 'pasada la hora, se cerró aunque diga abierta');
  assert.equal(ventanaDe({ abierta: true, quedaMin: 300 }, AHORA + 60 * 60e3, AHORA).corto, 'quedan 4 h', 'sin «hasta», quedaMin desde que llegó');
  assert.equal(ventanaDe({ abierta: true, quedaMin: null, hasta: null }, AHORA).corto, 'ventana abierta');
  assert.equal(ventanaDe(null).abierta, false);
});

test('B2 · el contador: menos de 1.000 caracteres y 1.000 bytes UTF-8 como mucho', () => {
  assert.equal(LIMITE, 1000);
  assert.equal(medir('a'.repeat(999)).ok, true); assert.equal(medir('a'.repeat(1000)).ok, false, '1.000 ya no: Meta pide MENOS de 1.000');
  assert.match(medir('a'.repeat(1000)).motivo, /quita 1\./);
  assert.equal(bytesUtf8('ñ'), 2); assert.equal(bytesUtf8('😀'), 4); assert.equal(medir('😀').chars, 1, 'un emoji es un carácter');
  const x = medir('ñ'.repeat(501));
  assert.deepEqual([x.chars, x.bytes, x.ok], [501, 1002, false]); assert.match(x.texto, /bytes/); assert.match(x.motivo, /bytes/);
  assert.equal(medir('ñ'.repeat(500)).ok, true, '1.000 bytes justos sí');
  assert.doesNotMatch(medir('hola').texto, /bytes/, 'los bytes solo se dicen si pasan');
  assert.equal(medir('').ok, true); assert.equal(medir(null).chars, 0);
});

test('B2 · solo se ven las imágenes de Meta; las demás, «Envió una imagen» con su enlace', () => {
  assert.equal(imagenDeMeta('https://scontent.cdninstagram.com/a.jpg'), true);
  assert.equal(imagenDeMeta('https://scontent-mia3-1.xx.fbcdn.net/a.jpg'), true);
  assert.equal(imagenDeMeta('https://fbcdn.net/a.jpg'), true);
  assert.equal(imagenDeMeta('http://scontent.cdninstagram.com/a.jpg'), false, 'solo https');
  assert.equal(imagenDeMeta('https://cdninstagram.com.malo.test/a.jpg'), false);
  assert.equal(imagenDeMeta('https://malofbcdn.net/a.jpg'), false);
  assert.equal(imagenDeMeta('javascript:alert(1)'), false); assert.equal(imagenDeMeta(''), false);
  assert.deepEqual(adjuntoDe({ tipo: 'image', url: 'https://x.fbcdn.net/a.jpg' }), { forma: 'imagen', url: 'https://x.fbcdn.net/a.jpg' });
  assert.deepEqual(adjuntoDe({ tipo: 'image', url: 'https://ejemplo.test/a.png' }), { forma: 'aviso', url: 'https://ejemplo.test/a.png', tipo: 'image' });
  assert.equal(adjuntoDe({ tipo: 'image', url: 'javascript:alert(1)' }).url, '', 'un enlace raro no se ofrece');
  assert.equal(adjuntoDe({ tipo: 'file', url: 'https://x.test/a.pdf' }).forma, 'archivo');
});

test('B2 · qué se ofrece: con la ventana abierta, Enviar; cerrada, no (y dice por qué)', () => {
  assert.equal(esConversacion(conv()), true); assert.equal(esConversacion(conv({ fuente: 'metricool' })), false); assert.equal(esConversacion(com()), false);
  const a = accionesDe(conv());
  assert.equal(a.ventana.abierta, true); assert.equal(a.responder.puede, true); assert.equal(a.ocultar, null, 'una conversación no se oculta');
  assert.deepEqual(accionesDe(conv({ ventana: { abierta: false, hasta: null, quedaMin: null } })).responder, { puede: false, motivo: VENTANA_CERRADA });
  assert.equal(accionesDe(conv({ estado: 'respondido' })).responder.puede, false);
  assert.equal(accionesDe(com()).ventana, null, 'un comentario no tiene ventana');
  const h = htmlConversacion(conv(), { esc, id: 'x' });
  assert.match(h, /data-bja="enviar"/); assert.match(h, /Puedes responder durante 5 h más/); assert.match(h, /de 1\.000 caracteres/);
  const hc = htmlConversacion(conv({ ventana: { abierta: false } }), { esc, id: 'x' });
  assert.doesNotMatch(hc, /data-bja="enviar"/, 'cerrada: Enviar no se ofrece'); assert.match(hc, /La ventana de 24 h se cerró/); assert.match(hc, /No se ofrece «Enviar»/);
  assert.match(hc, /data-bja="descartar"/, 'descartar sí');
  const hl = htmlConversacion(conv({ borrador: { texto: 'a'.repeat(1000) } }), { esc, id: 'x' });
  assert.match(hl, /data-bja="enviar"[^>]*aria-disabled="true"/, 'pasado el límite, Enviar dice que no (y por qué, en el contador)');
});

test('B2 · el hilo: en orden, lo tuyo a un lado, la imagen de Meta, y el 🛡', () => {
  const m = conv({ sospecha: 'pide datos' });
  assert.deepEqual(ordenados(m).map(x => x.id), ['a', 'b', 'c']); assert.equal(ultimoMensaje(m).id, 'c');
  const h = htmlConversacion(m, { esc, id: 'x' });
  assert.ok(h.indexOf('¿Precio?') < h.indexOf('Hola') && h.indexOf('Hola') < h.indexOf('Este'));
  assert.match(h, /class="bj-msg tu"/); assert.match(h, /class="bj-msg cli"/);
  assert.match(h, /<img data-bjimg src="https:\/\/scontent\.cdninstagram\.com\/x\.jpg"/); assert.match(h, /🛡/);
  const otra = htmlConversacion(conv({ mensajes: [{ id: 'z', de: 'cliente', texto: '', at: '2026-10-09T11:00:00Z', adjuntos: [{ tipo: 'image', url: 'https://ejemplo.test/a.png' }] }] }), { esc, id: 'x' });
  assert.doesNotMatch(otra, /<img/); assert.match(otra, /Envió una imagen/); assert.match(otra, /href="https:\/\/ejemplo\.test\/a\.png"/);
  assert.doesNotMatch(htmlConversacion(conv({ autor: '<b>x</b>' }), { esc, id: 'x' }), /<b>x<\/b>/, 'el nombre se escapa');
});

test('B2 · la demo: una de IG abierta con imagen, una de Messenger cerrada con 🛡; enviar con las mismas reglas', async () => {
  const d = crearDatos({ served: false });
  const cs = (await d.bandeja({ tipo: 'conversaciones' })).items;
  const ig = cs.find(x => x.red === 'instagram'), fb = cs.find(x => x.red === 'facebook');
  assert.ok(ig && fb && esConversacion(ig) && esConversacion(fb));
  assert.equal(ventanaDe(ig.ventana).abierta, true); assert.ok(ig.mensajes.some(x => x.adjuntos.some(a => imagenDeMeta(a.url))));
  assert.equal(ventanaDe(fb.ventana).abierta, false); assert.ok(fb.sospecha);
  await assert.rejects(d.bandejaAccion(fb.id, 'enviar', 'hola'), e => e.status === 409 && e.message === 'ventana' && /24 h/.test(e.motivo));
  await assert.rejects(d.bandejaAccion(ig.id, 'enviar', 'a'.repeat(1000)), e => e.status === 422 && /1\.000/.test(e.motivo));
  await assert.rejects(d.bandejaAccion(ig.id, 'enviar', 'ñ'.repeat(501)), e => e.status === 422);
  const n = ig.mensajes.length, x = await d.bandejaAccion(ig.id, 'enviar', 'Sí, lo tenemos.');
  assert.equal(x.item.estado, 'respondido'); assert.equal(x.item.mensajes.length, n + 1); assert.equal(ultimoMensaje(x.item).de, 'tu');
});
