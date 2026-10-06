// M2 (6 oct 2026): las nueve redes — sus reglas, el texto propio de cada una, las opciones de Pinterest, YouTube y TikTok, y que la nota
// las guarda y las vuelve a leer sin cambiar la huella de lo aprobado antes de M2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { revisarPublicacion, textoPara, longitudPara, postDePieza, LIMITES } from '../src/contenido-reglas.js';
import { normalizar, serializar, parsear, huella, REDES } from '../contenido/piezas.mjs';
import { entregasDe } from '../contenido/entrega.mjs';
import { cuerpoPost } from '../contenido/metricool.mjs';

const img = i => ({ src: `2026-10/f${i}.jpg`, tipo: 'imagen', ancho: 1080, alto: 1350 });
const vid = (seg, ancho = 1080, alto = 1920) => ({ src: '2026-10/v.mp4', tipo: 'video', duracion: seg, ancho, alto });
const rev = (post, redes) => revisarPublicacion({ format: 'post', descripcion: 'Hola', medios: [img(1)], ...post }, redes);

test('son nueve redes, cada una con su nombre y sus límites', () => {
  assert.deepEqual(REDES, ['instagram', 'facebook', 'linkedin', 'x', 'threads', 'bluesky', 'tiktok', 'pinterest', 'youtube']);
  for (const r of ['linkedin', 'x', 'threads', 'bluesky', 'pinterest', 'youtube']) assert.ok(LIMITES[r].caracteres > 0, r);
});

test('X cuenta un enlace como 23 y Bluesky cuenta grafemas', () => {
  assert.equal(longitudPara('mira https://ejemplo.com/una/ruta/muy/larga/de/verdad', 'x'), 5 + 23);
  assert.equal(longitudPara('👨‍👩‍👧', 'bluesky'), 1);
  assert.equal(longitudPara('👨‍👩‍👧', 'linkedin'), '👨‍👩‍👧'.length);
});

test('un texto largo para X o Bluesky pide un texto propio; con el suyo, sale tal cual y sin hashtags', () => {
  const largo = 'a'.repeat(400);
  const r = rev({ descripcion: largo }, ['instagram', 'x', 'bluesky']);
  assert.match(r.errores.join(' '), /El texto de X tiene 400 caracteres; el máximo es 280/);
  assert.match(r.errores.join(' '), /Bluesky tiene 400 caracteres; el máximo es 300/);
  assert.deepEqual(r.arreglos[r.errores.find(e => /de X/.test(e))], { codigo: 'texto-red:x', etiqueta: 'Escribir uno para X' });
  const post = { format: 'post', descripcion: largo, hashtagsFinales: '#optica', medios: [img(1)], textos: { x: 'Corto para X' } };
  assert.equal(textoPara(post, 'x'), 'Corto para X');
  assert.match(textoPara(post, 'instagram'), /#optica$/);
  assert.ok(!revisarPublicacion(post, ['x']).errores.length);
});

test('las redes sin historias lo dicen y ofrecen quitarse; los topes de imágenes y de video se cumplen', () => {
  assert.match(rev({ format: 'historia' }, ['instagram', 'linkedin']).errores.join(' '), /LinkedIn no tiene historias/);
  assert.match(rev({ medios: [1, 2, 3, 4, 5].map(img) }, ['x']).errores.join(' '), /X admite hasta 4 imágenes por publicación y hay 5/);
  assert.match(rev({ medios: [img(1), vid(20)] }, ['bluesky']).errores.join(' '), /Bluesky no mezcla un video/);
  assert.match(rev({ medios: [vid(200)] }, ['x']).errores.join(' '), /Un video de X dura como mucho 140 s/);
  assert.match(rev({ medios: Array.from({ length: 12 }, (_, i) => img(i)) }, ['threads']).errores.join(' '), /Threads admite hasta 10 archivos/);
  assert.match(rev({ descripcion: '', medios: [] }, ['linkedin']).errores.join(' '), /LinkedIn necesita texto o al menos/);
  assert.ok(!rev({ descripcion: 'Solo texto', medios: [] }, ['linkedin', 'x', 'threads', 'bluesky']).errores.length, 'texto solo vale en las redes de texto');
});

test('Pinterest pide tablero y una imagen; YouTube, un video y su título; un Short largo propone video normal', () => {
  const p = rev({}, ['pinterest']);
  assert.match(p.errores.join(' '), /Pinterest necesita un tablero/);
  assert.deepEqual(p.arreglos[p.errores[0]], { codigo: 'opciones:pinterest', etiqueta: 'Elegir el tablero' });
  assert.ok(!rev({ pinterest: { tablero: '123' } }, ['pinterest']).errores.length);
  assert.match(rev({ pinterest: { tablero: '1', enlace: 'http://x.com' } }, ['pinterest']).errores.join(' '), /https/);
  assert.match(rev({ pinterest: { tablero: '1' }, medios: [img(1), img(2)] }, ['pinterest']).avisos.join(' '), /primer archivo/);
  assert.match(rev({}, ['youtube']).errores.join(' '), /YouTube necesita un video/);
  assert.match(rev({ medios: [vid(30)] }, ['youtube']).errores.join(' '), /YouTube necesita un título/);
  assert.ok(!rev({ medios: [vid(30)], youtube: { titulo: 'Así limpias tus lentes' } }, ['youtube']).errores.length);
  const short = rev({ format: 'reel', medios: [vid(240)], youtube: { titulo: 'T' } }, ['youtube']);
  assert.match(short.errores.join(' '), /Un Short dura como mucho 3 minutos/);
  assert.equal(short.arreglos[short.errores[0]].codigo, 'formato:post');
  assert.match(rev({ format: 'reel', medios: [vid(30, 1920, 1080)], youtube: { titulo: 'T' } }, ['youtube']).avisos.join(' '), /horizontal/);
});

test('«también como historia» con redes sin historias lo avisa', () => {
  const r = rev({ historiaTambien: true, historias: [img(9)] }, ['instagram', 'linkedin']);
  assert.match(r.avisos.join(' '), /sólo en Instagram y Facebook/);
  assert.match(rev({ historiaTambien: true, historias: [img(9)] }, ['linkedin']).avisos.join(' '), /LinkedIn no tiene historias/);
});

test('la nota guarda el texto de cada red y las opciones, y los vuelve a leer igual', () => {
  const { pieza } = normalizar({ redes: ['instagram', 'x', 'pinterest', 'youtube', 'tiktok'], texto: 'Principal', textos: { x: 'Para X', linkedin: '   ', facebook: 'Para FB' }, pinterest: { tablero: 'tab-1', titulo: 'Pin', raro: 'no' }, youtube: { titulo: 'Video', privacidad: 'secreta', paraNinos: true }, tiktok: { privacidad: 'SELF_ONLY' } });
  assert.deepEqual(pieza.textos, { x: 'Para X' }); assert.equal(pieza.textoFacebook, 'Para FB');
  assert.deepEqual(pieza.pinterest, { tablero: 'tab-1', titulo: 'Pin' });
  assert.deepEqual(pieza.youtube, { titulo: 'Video', paraNinos: true }, 'una privacidad que no existe no entra');
  const md = serializar({ ...pieza, id: 'p-20261006-abcd' });
  assert.match(md, /## Texto de X\nPara X/); assert.match(md, /^pinterest: \{"tablero":"tab-1","titulo":"Pin"\}$/m);
  const back = parsear(md);
  for (const k of ['textos', 'pinterest', 'youtube', 'tiktok', 'textoFacebook', 'texto']) assert.deepEqual(back[k], pieza[k], k);
  assert.match(normalizar({ textos: { myspace: 'x' } }).error, /«myspace» no es una red/);
  assert.equal(normalizar({ texto: '## Texto de X\nhola' }).pieza.texto, '# Texto de X\nhola', 'un título de sección dentro del texto se rebaja');
});

test('la huella de lo aprobado antes de M2 no cambia; un texto propio sí la cambia', () => {
  const base = { fecha: '2026-10-07', hora: '10:00', formato: 'post', redes: ['instagram'], medios: [], texto: 'a', hashtags: '', hashtagsEnComentario: false, comentario: '', textoFacebook: '', historias: [], historiaTambien: false };
  const h = huella(base);
  assert.equal(huella({ ...base, textos: {}, pinterest: null, youtube: null, tiktok: null }), h);
  assert.notEqual(huella({ ...base, textos: { x: 'otro' } }), h);
  assert.notEqual(huella({ ...base, youtube: { titulo: 'T' } }), h);
});

test('la entrega agrupa por texto: X con el suyo va aparte, y Metricool recibe los datos de cada red', () => {
  const pieza = { fecha: '2026-10-09', hora: '10:00', formato: 'post', redes: ['instagram', 'linkedin', 'x', 'pinterest'], medios: ['2026-10/a.jpg'], texto: 'Principal', textos: { x: 'Para X' }, pinterest: { tablero: 'tab-1', titulo: 'Pin', enlace: 'https://panaclaw.test' } };
  const es = entregasDe(pieza);
  assert.equal(es.length, 2);
  assert.deepEqual(es.find(e => e.texto === 'Para X').redes, ['x']);
  assert.deepEqual(es.find(e => e.texto === 'Principal').redes, ['instagram', 'linkedin', 'pinterest']);
  const body = cuerpoPost({ ...es.find(e => e.redes.includes('pinterest')), zona: 'America/Panama' });
  assert.deepEqual(body.providers.map(p => p.network), ['instagram', 'linkedin', 'pinterest']);
  assert.equal(body.pinterestData.boardId, 'tab-1'); assert.equal(body.pinterestData.pinLink, 'https://panaclaw.test');
  assert.equal(cuerpoPost({ ...es.find(e => e.redes.includes('x')), zona: 'America/Panama' }).providers[0].network, 'twitter');
  assert.ok(postDePieza(pieza).pinterest.tablero);
});
