// Fase B1 (9 oct 2026): lo puro de la BANDEJA en la página — qué ofrece un comentario según esté oculto, sea respuesta, venga de un
// anuncio o lo sugiera ocultar un agente — y la demo (en memoria): ocultar con DESHACER y que un oculto no se responda.
import test from 'node:test';
import assert from 'node:assert/strict';
import { accionesDe, fuenteDe, fuentesDe, filtrarBandeja, publicacionDe, restante, OCULTO_NO_RESPONDE } from '../src/contenido-bandeja.js';
import { crearDatos } from '../src/contenido-datos.js';

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
