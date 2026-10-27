// 27 oct 2026 — La auditoría de Dimitri (docs/auditoria-dimitri-2026-10-27.md), lo que se puede morder sin un modelo de verdad:
//  · la voz: natural, corta y clara, y PRIMERO en el prompt (el dueño recibió «un reporte enorme, difícil de entender»);
//  · el prompt va en dos partes: la FIJA no cambia entre mensajes (el proveedor la guarda en caché) y la VARIABLE lleva la hora, el equipo, la guía que toca y qué IA corre;
//  · el resumen del lunes es corto y sin títulos;
//  · lo que Dimitri sabe de sí mismo (qué IA es, dónde se cambia, qué consulta) coincide con lo que de verdad puede hacer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sub from '../sub-core.mjs';

const DEPTS = { marketing: { name: 'Marketing' }, ops: { name: 'Operaciones' }, brain: { name: 'Cerebro' } };
const AGENTS = [{ id: 'mkt', name: 'MARA', role: 'Marketing Lead', does: 'Lidera Marketing.', department: 'marketing', lead: true }, { id: 'ops', name: 'OLGA', role: 'Ops', does: 'Opera.', department: 'ops', lead: true }];
const base = (o = {}) => ({ name: 'Dimitri', business: 'PanaClaw', depts: DEPTS, agents: AGENTS, skillsOf: () => [], routineDepts: ['Marketing (marketing)'], status: 'En curso: 0', ...o });
const partes = (o) => sub.systemPromptParts(base(o));

test('la voz va PRIMERO y es corta, sencilla y sin informes', () => {
  const { fijo } = partes();
  const i = (k) => fijo.indexOf(k);
  assert.ok(i('CÓMO HABLAS') > 0 && i('CÓMO HABLAS') < i('CÓMO RESPONDES') && i('CÓMO RESPONDES') < i('ELIGE UN MODO'), 'la voz antes del contrato');
  for (const frase of [/Palabras sencillas y frases cortas/, /Primero la respuesta, en una o dos frases/, /Ningún informe, ninguna tabla larga/, /unas 120 palabras como tope/, /Cierra con el siguiente paso/, /los ids van en tasks\/ops, nunca en lo que dices/]) assert.match(fijo, frase);
  assert.doesNotMatch(fijo, /hasta ~220 palabras/, 'el análisis ya no llega a 220 palabras'); assert.match(fijo, /analisis: hasta ~180 palabras/);
});

test('el prompt en dos partes: lo FIJO es igual pase lo que pase en el mensaje (la caché del proveedor acierta); lo variable trae lo del momento', () => {
  const a = partes({ now: new Date('2026-10-27T10:00:00'), notes: 'NOTA-A', status: 'A', equipo: 'Te escribe ahora: Ana', guia: '## Tema A\nTexto', viewing: 'Tareas', hilo: 'h1', recent: 'r1', office: 'o1', modelo: 'Claude X (claude-x)' });
  const b = partes({ now: new Date('2026-10-28T23:59:00'), notes: 'NOTA-B', status: 'B', equipo: '', guia: '', viewing: '', hilo: '', recent: 'r2', office: 'o2', modelo: 'Claude Y (claude-y)' });
  assert.equal(a.fijo, b.fijo, 'cambió la hora, las notas, el estado, el equipo, la guía y la IA: lo fijo ni se entera');
  assert.match(a.variable, /^Ahora es [^\n]+\.\nCorres con Claude X \(claude-x\)\./); assert.match(a.variable, /<guia>\n## Tema A\nTexto\n<\/guia>/); assert.doesNotMatch(b.variable, /<guia>/); assert.match(a.variable, /<equipo>\nTe escribe ahora: Ana/);
  assert.doesNotMatch(a.fijo, /Ahora es|\n<(notas|estado|guia|resultados|calendario|departamentos|equipo|viendo|hilo)>\n/, 'en lo fijo no hay datos');
  assert.equal(sub.systemPrompt(base({ now: new Date('2026-10-27T10:00:00') })), `${partes({ now: new Date('2026-10-27T10:00:00') }).fijo}\n\n${partes({ now: new Date('2026-10-27T10:00:00') }).variable}`, 'systemPrompt es las dos partes juntas');
  const con = partes({ herramientas: true }).fijo, sin = partes({ herramientas: false }).fijo;
  assert.match(con, /CONSULTAS — tienes herramientas de LECTURA/); assert.match(sin, /CONSULTAS — esta vez no tienes herramientas de consulta/); assert.notEqual(con, sin);
  assert.ok(con.length < 19000 && con.length > 10000, 'lo fijo mide ' + con.length); assert.ok(partes({ now: new Date() }).variable.length < 1200, 'sin datos, lo variable es mínimo');
});

test('la guía va en el prompt: un índice de temas siempre, y solo la entrada que toca en <guia>', () => {
  const { fijo } = partes();
  assert.match(fijo, /GUÍA — conoces esta oficina por dentro/); assert.match(fijo, /^tareas: Crear una tarea/m); assert.match(fijo, /Biblioteca de habilidades/); assert.match(partes({ herramientas: true }).fijo, /o la herramienta buscar_en_guia/); assert.doesNotMatch(partes({ herramientas: false }).fijo, /herramienta buscar_en_guia/);
});

test('el roster le dice a Dimitri las skills y los métodos de la Biblioteca de cada jefe (antes en la nube no veía ninguno)', () => {
  const { variable } = partes({ skillsOf: (a) => (a.id === 'mkt' ? ['plan-contenido', 'prompts-visuales'] : []), habilidadesOf: (a) => (a.lead ? ['estrategia-marca', 'seo-basico', 'a', 'b', 'c', 'd', 'e'] : []) });
  assert.match(variable, /- mkt · MARA \[LÍDER\] · Marketing Lead · Lidera Marketing\. · skills: plan-contenido, prompts-visuales · biblioteca: estrategia-marca, seo-basico, a, b, c \(\+2\)/);
  assert.doesNotMatch(partes().variable, /biblioteca:/, 'sin métodos no se escribe «biblioteca:»');
});

test('el resumen del lunes: ≤ 110 palabras, sin títulos ni secciones numeradas, con lo que importa y UNA recomendación', () => {
  const s = sub.informeSistema('Dimitri', 'PanaClaw'), p = sub.informePedido('Estado: x');
  assert.match(s, /Máximo 110 palabras/); assert.match(s, /Sin títulos, sin secciones numeradas, sin tablas/); assert.match(s, /palabras sencillas \(nada de siglas ni jerga\)/); assert.doesNotMatch(s + p, /180–260|tres decisiones|1\)\s*cómo fue/);
  assert.match(p, /hasta 3 viñetas/); assert.match(p, /una sola recomendación/); assert.match(p, /Si un dato no está, no lo inventes/); assert.ok(p.includes('Estado: x'));
});

test('lo que Dimitri sabe de sí mismo es verdad: consulta con herramientas de lectura y propone, no ejecuta', async () => {
  const { HERRAMIENTAS } = await import('../consultas-core.mjs'), { fijo } = partes({ herramientas: true });
  assert.match(fijo, /Nunca apruebas, envías, programas en Meta ni publicas/); assert.match(fijo, /Tú nunca envías, publicas ni pagas nada: solo propones/); assert.match(fijo, /"type":"nota_crear"/); assert.match(fijo, /"type":"nota_agregar"/);
  assert.ok(HERRAMIENTAS.every((h) => !/\b(escribe|envía|publica|paga|borra|aprueba)\b/i.test(h.descripcion.replace(/Nunca envía, publica, paga ni cambia nada\./, ''))), 'ninguna herramienta dice que escriba o envíe');
});
