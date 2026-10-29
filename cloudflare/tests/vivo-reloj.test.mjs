// CON-12 / PER-06: lo que cambia el RELOJ (cron) en Contenido o la Bandeja se avisa a las páginas abiertas con UNA señal por el Hub: solo el área, nunca texto
// ni ids de piezas. La página (nube.js → contenido.js) relee por su API; el sondeo baja a 60 s con el socket vivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { avisarDelReloj } from '../worker/lib/vivo.js';
import { cadaMinuto as bandejaCada } from '../worker/modulos/bandeja.js';
import { PERMISOS_LECTURA, PERMISOS_PUBLICAR, PERMISOS_ANUNCIOS, PERMISOS_MENSAJES } from '../../contenido/meta.mjs';
import { SALTAR } from './d1-memoria.mjs';
import { nube } from './ayuda-meta.mjs';

const hubFalso = () => { const visto = []; return { visto, HUB: { idFromName: (n) => n, get: () => ({ fetch: async (req) => { visto.push({ ruta: new URL(req.url).pathname, cuerpo: await req.json() }); return new Response(null, { status: 204 }); } }) } }; };

test('avisarDelReloj: una señal de área, sin texto; los solo-administrador y lo desconocido no se avisan por aquí', async () => {
  const h = hubFalso(); const env = { HUB: h.HUB };
  await avisarDelReloj(env, 'contenido');
  assert.equal(h.visto.length, 1); assert.equal(h.visto[0].ruta, '/difundir');
  const c = h.visto[0].cuerpo; assert.deepEqual(Object.keys(c).sort(), ['area', 'at', 'nombre', 'por', 'tipo']); assert.equal(c.area, 'contenido'); assert.equal(c.nombre, '');
  assert.equal(avisarDelReloj(env, 'ajustes'), null); assert.equal(avisarDelReloj(env, 'no-existe'), null); assert.equal(avisarDelReloj({}, 'contenido') ?? null, null);
  assert.equal(h.visto.length, 1);
});

test('el reloj de la Bandeja avisa SOLO cuando llega algo nuevo', { skip: SALTAR }, async () => {
  const permisos = [...PERMISOS_LECTURA, ...PERMISOS_PUBLICAR, ...PERMISOS_ANUNCIOS, ...PERMISOS_MENSAJES];
  const o = await nube({ preparar: false, permisos, config: { anuncios: { cuenta: 'act_1001' }, contenido: { modo: 'simulacro' } } });
  const h = hubFalso(); o.env.HUB = h.HUB;
  o.g.st.media = [{ id: 'M1', caption: 'Lentes', permalink: 'https://www.instagram.com/p/M1/', timestamp: new Date().toISOString(), comments_count: 1, media_type: 'IMAGE' }];
  o.g.st.comentarios.M1 = [{ id: 'c1', text: '¿Precio? texto-secreto-del-cliente', username: 'eva', from: { id: 'U1', username: 'eva' }, timestamp: new Date().toISOString() }];
  await bandejaCada(o.env);
  assert.equal(h.visto.length, 1, 'llegó un comentario: una señal');
  assert.ok(!JSON.stringify(h.visto[0]).includes('texto-secreto'), 'la señal no lleva el texto');
  await bandejaCada(o.env);
  assert.equal(h.visto.length, 1, 'sin nada nuevo no se vuelve a avisar');
});

test('la página escucha: nube.js convierte el aviso en ao:contenido-cambio y contenido.js baja el sondeo con el socket vivo', () => {
  const nubeJs = fs.readFileSync(new URL('../public/nube.js', import.meta.url), 'utf8'), ct = fs.readFileSync(new URL('../../src/contenido.js', import.meta.url), 'utf8');
  assert.match(nubeJs, /m\.area === 'contenido'[^\n]*ao:contenido-cambio/);
  assert.match(ct, /ao:contenido-cambio/); assert.match(ct, /conexion\?\.\(\) !== 'conectado'/);
});
