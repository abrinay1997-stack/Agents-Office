// 27 oct 2026 — La GUÍA de la oficina (lo que Dimitri sabe de cómo se hace cada cosa), como el catálogo de BRIAN: cada entrada dice qué logras, dónde queda y las reglas; se busca
// sin tildes y con las palabras de la gente; y una vista nueva que no aparece aquí hace fallar la prueba (la regla de BRIAN: «toda función nueva debe poder usarla»).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GUIA, COBERTURA, buscarEnGuia, guiaPara, guiaTexto, indiceGuia, normalizar } from '../guia-oficina.mjs';

const TECLAS = new Set(['E', 'P', 'K', 'R', 'J', 'G', 'H', 'N', 'U', 'O', 'S', 'T', 'B', 'L']);

test('cada entrada tiene su id, su tema, dónde queda, palabras de la gente y un texto de largo razonable', () => {
  const ids = new Set();
  for (const e of GUIA) {
    assert.ok(/^[a-z0-9-]+$/.test(e.id) && !ids.has(e.id), 'id único: ' + e.id); ids.add(e.id);
    assert.ok(['tareas', 'agentes', 'contenido', 'estudio', 'cerebro', 'oficina'].includes(e.tema), `${e.id}: tema ${e.tema}`);
    assert.ok(e.titulo.length >= 5 && e.titulo.length <= 70, `${e.id}: título`); assert.ok(e.donde.length >= 6, `${e.id}: dice dónde queda`);
    assert.ok(Array.isArray(e.palabras) && e.palabras.length >= 3, `${e.id}: palabras`); assert.ok(Array.isArray(e.vistas), `${e.id}: vistas`);
    assert.ok(e.texto.length >= 150 && e.texto.length <= 1000, `${e.id}: el texto mide ${e.texto.length} (150–1000)`);
    assert.doesNotMatch(e.texto, /\bhttps?:\/\//, `${e.id}: sin enlaces: la guía dice dónde, no a dónde ir`);
    assert.doesNotMatch(e.texto, /\$\s?\d{2,}/, `${e.id}: ningún precio del negocio en la guía (eso es de las cifras)`);
    for (const [, k] of e.donde.matchAll(/\(([A-Z,?])\)/g)) assert.ok(TECLAS.has(k) || k === ',' || k === '?', `${e.id}: la tecla (${k}) existe`);
    for (const [, k] of e.texto.matchAll(/\(([A-Z])\)/g)) assert.ok(TECLAS.has(k), `${e.id}: la tecla (${k}) del texto existe`);
  }
  assert.ok(GUIA.length >= 40, 'una guía completa: ' + GUIA.length);
});

test('toda vista de la oficina tiene su entrada (una vista nueva obliga a escribirla)', () => {
  for (const v of COBERTURA) assert.ok(GUIA.some((e) => e.vistas.includes(v)), `ninguna entrada de la guía cubre la vista «${v}»`);
  const dock = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  for (const v of ['studio', 'cal', 'contenido', 'analiticas', 'brain', 'tareas', 'anuncios']) assert.match(dock, new RegExp(`['"]?${v}['"]?\\s*:`), `main.js conoce la vista ${v}`);
});

test('buscar: las preguntas de verdad del dueño llegan a su entrada, con tildes o sin ellas', () => {
  const primero = (q, vista) => buscarEnGuia(q, { vista })[0]?.entrada.id;
  assert.equal(primero('¿Dónde está la biblioteca de habilidades o skills de cada jefe de departamento?'), 'biblioteca');
  assert.equal(primero('donde esta la biblioteca de habilidades'), 'biblioteca');
  assert.equal(primero('¿Cómo se crea una tarea?'), 'tareas-crear');
  assert.equal(primero('quien completo esta tarea y quien realizo cada accion'), 'tareas-quien');
  assert.equal(primero('¿Qué parámetros y ajustes tiene cada modelo del Estudio? la proporción, la semilla'), 'estudio-ajustes');
  assert.equal(primero('quiero borrar una nota que escribí en el cerebro'), 'cerebro');
  assert.equal(primero('¿qué inteligencia artificial usas? quiero cambiar de modelo'), 'modelos');
  assert.equal(primero('pausar una campaña de anuncios que gasta mucho'), 'anuncios');
  assert.equal(primero('cómo agrego un conector de gmail'), 'conectores');
  assert.equal(primero('cómo se programa y se publica un post en instagram'), 'contenido-publicar');
  assert.equal(primero('cómo asigno una tarea a Avalon, una persona del equipo'), 'tareas-mias');
  assert.equal(primero('que es una rutina y como la pauso'), 'rutinas');
  assert.equal(primero('qué es una skill y cómo le enseño a un agente'), 'skills');
  assert.ok(buscarEnGuia('cuánto me cuesta generar un video, el tope').slice(0, 2).map((x) => x.entrada.id).includes('estudio-video'));
  assert.deepEqual(buscarEnGuia('asdf qwer zxcv'), [], 'sin coincidencia no se inventa nada'); assert.deepEqual(buscarEnGuia(''), []);
  assert.deepEqual(buscarEnGuia('hola, ¿cómo estás hoy?'), [], 'una charla no trae guía');
});

test('la vista abierta pesa un poco; guiaPara respeta el tope y mira la conversación si el mensaje no dice nada', () => {
  const sin = buscarEnGuia('cómo hago esto de las fotos', { vista: '' }), con = buscarEnGuia('cómo hago esto de las fotos', { vista: 'studio' });
  assert.ok((con[0]?.puntaje || 0) >= (sin[0]?.puntaje || 0));
  const g = guiaPara('¿cómo creo una tarea y la ajusto con prioridad y fecha límite?', { maxChars: 1200 }); assert.ok(g.length <= 1300 && g.startsWith('## '), g.length);
  assert.equal(guiaPara('gracias'), ''); assert.equal(guiaPara('sí, hazlo', { historia: 'estábamos viendo cómo crear una rutina que se repite cada lunes' }).includes('Rutinas'), true, 'sin nada directo, usa lo que se hablaba');
  assert.ok(guiaTexto(GUIA.slice(0, 20), { maxChars: 2000 }).length <= 2400);
});

test('el índice lleva todos los temas y es corto (va en cada prompt)', () => {
  const i = indiceGuia(); assert.ok(i.length < 1600, 'el índice mide ' + i.length);
  for (const t of ['tareas', 'agentes', 'contenido', 'estudio', 'cerebro', 'oficina']) assert.match(i, new RegExp(`^${t}: `, 'm'));
  assert.match(i, /La Biblioteca de habilidades/); assert.equal(normalizar('Ñandú ÁÉÍ'), 'nandu aei');
});

test('lo que la guía promete que Dimitri puede hacer, existe: sus ops y sus consultas', async () => {
  const sub = await import('../sub-core.mjs'), { NOMBRES } = await import('../consultas-core.mjs');
  const dimitri = GUIA.find((e) => e.id === 'dimitri').texto, cerebro = GUIA.find((e) => e.id === 'cerebro').texto;
  assert.match(cerebro, /Dimitri puede crear una nota o añadir información/); assert.ok(sub.OPS.includes('nota_crear') && sub.OPS.includes('nota_agregar'));
  assert.match(dimitri, /Nunca aprueba, envía, publica, paga ni borra/); for (const t of NOMBRES) assert.ok(t.length > 4);
  assert.ok(!sub.OPS.some((o) => /borrar|eliminar|aprobar|enviar|publicar|pagar/.test(o)), 'ninguna op suena a lo que Dimitri nunca hace');
});
