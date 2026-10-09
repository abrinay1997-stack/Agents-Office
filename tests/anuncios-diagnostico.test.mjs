// Fase A5 de Anuncios (9 oct 2026): EL DIAGNÓSTICO, puro (anuncios/diagnostico.mjs). Una regla del §7 del plan por test, con series de
// cifras de mentira; los umbrales de la Biblioteca (umbrales.json), validados y con su fuente real; y los mismos casos de
// evals/anuncios-diagnostico/evals.json, que deben dar su «decision».
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnosticar, validarUmbrales, mezclarUmbrales, valoresDe, cpaObjetivo, medirResultado, GASTA, CAMBIOS, REGLAS, UMBRALES_REQUERIDOS, SIN_OBJETIVO } from '../anuncios/diagnostico.mjs';
import { DE_GASTO, TIPOS } from '../anuncios/acciones.mjs';
import { armarVista, sumarDias, rangos } from '../anuncios/modelo.mjs';
import { validarEvals } from '../scripts/evals-skill.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HAB = path.join(ROOT, 'biblioteca', 'marketing', 'campanas-pagadas');
const FABRICA = JSON.parse(fs.readFileSync(path.join(HAB, 'umbrales.json'), 'utf8'));
const U = valoresDe(FABRICA);
const HOY = '2026-10-09', AYER = sumarDias(HOY, -1), AHORA = Date.parse('2026-10-09T15:00:00Z');
const MSG = 'onsite_conversion.messaging_conversation_started_7d';

/** Una cuenta con una campaña de mensajes (C1), un conjunto (S1) y sus anuncios, a partir de un «caso» (el formato de evals.json). */
export function armar(caso, { conjuntos = null, cuenta = {}, campana = {} } = {}) {
  const sets = conjuntos || [{ id: 'S1', ...caso.conjunto, anuncios: caso.anuncios }];
  const g = { cuenta: { id: 'act_1', name: 'PanaClaw', account_status: 1, currency: 'USD', timezone_name: 'America/Panama', amount_spent: '0', spend_cap: '0', balance: '0', ...cuenta },
    campanas: [{ id: 'C1', name: 'Mensajes · AO:b1', objective: 'OUTCOME_ENGAGEMENT', effective_status: 'ACTIVE', spend_cap: '15000', ...campana }], conjuntos: [], anuncios: [], creativos: [] };
  const filas = [], ad7 = {};
  const R = rangos(HOY)['7d'];
  for (const s of sets) {
    g.conjuntos.push({ id: s.id, campaign_id: 'C1', name: s.nombre || `Conjunto ${s.id}`, effective_status: s.estado || 'ACTIVE', optimization_goal: 'CONVERSATIONS', destination_type: 'WHATSAPP', learning_stage_info: { status: s.aprendizaje, conversions: s.conversiones ?? null }, ...(s.presupuesto ? { daily_budget: String(Math.round(s.presupuesto * 100)) } : {}), ...(s.inicio ? { start_time: s.inicio } : {}), targeting: { geo_locations: { countries: ['PA'] } } });
    for (const a of s.anuncios || []) {
      g.anuncios.push({ id: a.id, adset_id: s.id, campaign_id: 'C1', name: `Anuncio ${a.id}`, effective_status: a.estado || 'ACTIVE', ...(a.revision ? { ad_review_feedback: a.revision } : {}), creative: { id: 'K' + a.id, body: 'Texto de ' + a.id } });
      const n = a.serie.length; let imp7 = 0;
      a.serie.forEach(([gasto, impr, clics, res], i) => {
        const fecha = sumarDias(AYER, -(n - 1 - i));
        filas.push({ campaign_id: 'C1', adset_id: s.id, ad_id: a.id, date_start: fecha, spend: String(gasto), impressions: String(impr), clicks: String(clics), reach: String(Math.round(impr / 1.2)), ...(res ? { actions: [{ action_type: MSG, value: String(res) }] } : {}) });
        if (fecha >= R[0] && fecha <= R[1]) imp7 += impr;
      });
      if (a.frecuencia7) ad7[a.id] = Math.round(imp7 / a.frecuencia7);
    }
  }
  const alcances = { rangos: { '7d': { desde: R[0], hasta: R[1], account: null, campaign: {}, adset: {}, ad: ad7 } } };
  const vista = armarVista({ guardado: g, filas, alcances, rango: '7d', hoy: HOY, topes: {}, hayCifras: true });
  return { vista, filas };
}
const correr = (caso, o = {}) => { const { vista, filas } = armar(caso, o); return diagnosticar({ vista, filas, hoy: HOY, cpa: caso.cpa > 0 ? { valor: caso.cpa, texto: 'objetivo' } : { valor: null, motivo: SIN_OBJETIVO }, umbrales: U, ahora: AHORA, ...(o.diag || {}) }); };
const serie = (n, fila) => Array.from({ length: n }, (_, i) => (typeof fila === 'function' ? fila(i) : fila));
const de = (r, id) => r.sugerencias.filter(s => s.objeto.id === id);

test('los umbrales de la Biblioteca: todos, con su unidad y su fuente, y la frase está de verdad donde dice', () => {
  assert.deepEqual(validarUmbrales(FABRICA), []);
  const plan = fs.readFileSync(path.join(ROOT, 'docs', 'plan-meta-anuncios-y-bandeja-2026-10-09.md'), 'utf8');
  for (const k of UMBRALES_REQUERIDOS) {
    const u = FABRICA.umbrales[k];
    if (u.fuente.startsWith('referencias/') || u.fuente === 'SKILL.md') assert.ok(fs.readFileSync(path.join(HAB, u.fuente), 'utf8').includes(u.frase), `${k}: la frase no está en ${u.fuente}`);
    else if (u.fuente.startsWith('plan')) assert.ok(plan.includes(u.frase), `${k}: la frase no está en el plan`);
    else assert.equal(u.fuente, 'oficina', `${k}: fuente desconocida`);
  }
  assert.ok(validarUmbrales({ umbrales: { ...FABRICA.umbrales, fatigaCaidaCtr: { ...FABRICA.umbrales.fatigaCaidaCtr, valor: 30 } } }).some(p => /fracción/.test(p)), '30 no es una fracción');
  assert.ok(validarUmbrales({ umbrales: { esperarDias: FABRICA.umbrales.esperarDias } }).some(p => /falta el umbral/.test(p)));
  assert.ok(validarUmbrales({ umbrales: { ...FABRICA.umbrales, inventado: { valor: 1, unidad: 'x', fuente: 'oficina', frase: 'xxxxxxxx' } } }).some(p => /inventado/.test(p)));
  // el del dueño gana, clave a clave; lo que no se entiende se ignora y se dice
  const m = mezclarUmbrales(FABRICA, { umbrales: { fatigaFrecuencia: 3.5, cortarSinResultadoCpa: { valor: -1 }, fatigaCaidaCtr: { valor: 0.25 } } });
  assert.equal(m.valores.fatigaFrecuencia, 3.5); assert.equal(m.valores.fatigaCaidaCtr, 0.25); assert.equal(m.valores.cortarSinResultadoCpa, 2);
  assert.deepEqual(m.delDueno.sort(), ['fatigaCaidaCtr', 'fatigaFrecuencia']); assert.ok(m.problemas.some(p => /cortarSinResultadoCpa/.test(p)));
  assert.throws(() => diagnosticar({ vista: null, hoy: HOY, umbrales: {} }), /faltan umbrales/, 'sin umbrales no se diagnostica (nunca un número suelto)');
});

test('los tipos de gasto del diagnóstico son los de anuncios/acciones.mjs, y todo cambio de la A2 existe', () => {
  assert.deepEqual([...GASTA].sort(), [...DE_GASTO].sort());
  for (const t of TIPOS) assert.ok(CAMBIOS.includes(t), t);
  assert.deepEqual(REGLAS.sort(), ['aprendizaje', 'cortar', 'cuenta', 'escalar', 'esperar', 'estructura', 'fatiga', 'impulsar', 'limitado', 'problemas', 'rechazado'].sort());
});

test('el costo objetivo: el de Ajustes, uno explícito de las cifras, el de equilibrio, o ninguno y lo dice', () => {
  assert.equal(cpaObjetivo({ ajuste: 2.5 }).valor, 2.5);
  assert.equal(cpaObjetivo({ ajuste: 0, cifras: [{ name: 'Costo por conversación objetivo', value: 'US$1,80' }] }).valor, 1.8);
  const e = cpaObjetivo({ ajuste: 0, cifras: [{ name: 'Valor promedio de una venta', value: 40 }, { name: 'Margen bruto', value: '50 %' }, { name: 'Tasa de cierre de conversaciones', value: '10 %' }] });
  assert.equal(e.valor, 2); assert.match(e.texto, /equilibrio/);
  const x = cpaObjetivo({ ajuste: 0, cifras: [{ name: 'Margen', value: '50 %' }] });
  assert.equal(x.valor, null); assert.match(x.motivo, /^Sin costo objetivo no puedo juzgar el costo/);
});

test('aprendizaje: un conjunto que aprende NO se toca, aunque cueste más que el objetivo; solo una nota', () => {
  const r = correr({ cpa: 2, conjunto: { aprendizaje: 'LEARNING', conversiones: 12, presupuesto: 10 }, anuncios: [{ id: 'A1', frecuencia7: 1.4, serie: serie(4, [3, 1000, 20, 1]) }] });
  assert.deepEqual(r.sugerencias, []);
  assert.ok(r.notas.some(n => n.regla === 'aprendizaje' && n.objeto.id === 'S1' && /no se toca/.test(n.texto)));
});

test('aprendizaje con algo roto: si gasta sin NINGÚN resultado por encima del umbral, sí se corta', () => {
  const r = correr({ cpa: 2, conjunto: { aprendizaje: 'LEARNING', presupuesto: 10 }, anuncios: [{ id: 'A1', frecuencia7: 1.1, serie: serie(4, [2, 500, 4, 0]) }, { id: 'A2', frecuencia7: 1.1, serie: serie(4, [2, 500, 8, 1]) }] });
  assert.deepEqual(r.sugerencias.map(s => [s.regla, s.objeto.id, s.cambio.tipo]), [['cortar', 'A1', 'pausar']]);
});

test('esperar: con poco gasto o pocos días no se juzga (ni se corta)', () => {
  const r = correr({ cpa: 2, conjunto: { aprendizaje: 'SUCCESS', presupuesto: 10 }, anuncios: [{ id: 'A1', frecuencia7: 1.1, serie: serie(2, [3, 500, 4, 0]) }, { id: 'A2', frecuencia7: 1.1, serie: serie(2, [3, 500, 8, 2]) }] });
  assert.deepEqual(de(r, 'A1'), [], '2 días: todavía no');
});

test('cortar: 2× el objetivo sin resultados → pausar (baja el gasto, sin riesgo de aprendizaje); 3× con costo > 2× → pausar', () => {
  const r = correr({ cpa: 2, conjunto: { aprendizaje: 'SUCCESS', presupuesto: 10 }, anuncios: [{ id: 'A1', frecuencia7: 1.5, serie: serie(5, [2, 500, 6, 0]) }, { id: 'A2', frecuencia7: 1.5, serie: serie(5, [3, 800, 16, 2]) }, { id: 'A3', frecuencia7: 1.5, serie: serie(5, i => [2, 500, 5, i === 4 ? 2 : 0]) }] });
  const a1 = de(r, 'A1')[0];
  assert.equal(a1.regla, 'cortar'); assert.equal(a1.cambio.tipo, 'pausar'); assert.equal(a1.gasto, false); assert.equal(a1.prioridad, 1);
  assert.match(a1.dato, /US\$10 en 30 días \(5 veces tu costo objetivo de US\$2\)/); assert.equal(a1.riesgo.reiniciaAprendizaje, false); assert.equal(a1.riesgo.gastaMas, false);
  const a3 = de(r, 'A3')[0]; assert.equal(a3?.regla, 'cortar', 'US$10 con 2 resultados a US$5 (2,5× el objetivo) tras gastar 5×'); assert.match(a3.dato, /a US\$5 cada una/);
  assert.deepEqual(de(r, 'A2'), [], 'el que funciona no se toca');
  assert.equal(a1.id, 'cortar-A1', 'el id es estable: regla + objeto');
});

test('cortar agrupa: si todos los anuncios de un conjunto pasan el umbral, una sola sugerencia: pausar el conjunto', () => {
  const r = correr({ cpa: 2, conjunto: { aprendizaje: 'SUCCESS', presupuesto: 10 }, anuncios: [{ id: 'A1', frecuencia7: 1.5, serie: serie(5, [2, 500, 6, 0]) }, { id: 'A2', frecuencia7: 1.5, serie: serie(5, [2, 500, 6, 0]) }] });
  assert.deepEqual(r.sugerencias.map(s => [s.regla, s.objeto.nivel, s.cambio.tipo, s.cambio.id]), [['cortar', 'conjunto', 'pausar', 'S1']]);
});

test('fatiga: frecuencia > 3 y el CTR un 30 % por debajo de sus primeros días → creativos nuevos, y NO escalar aunque esté barato', () => {
  const r = correr({ cpa: 2, conjunto: { aprendizaje: 'SUCCESS', presupuesto: 10 }, anuncios: [{ id: 'A1', frecuencia7: 3.8, serie: serie(14, i => [6, 1000, i < 3 ? 20 : 10, 4]) }] });
  assert.deepEqual(r.sugerencias.map(s => [s.regla, s.objeto.id, s.cambio.tipo]), [['fatiga', 'A1', 'creativos']]);
  const s = r.sugerencias[0]; assert.match(s.dato, /Frecuencia 3,8/); assert.match(s.efecto, /NO se sube el presupuesto/); assert.equal(s.gasto, false);
  // la misma caída con la frecuencia baja no es cansancio
  const r2 = correr({ cpa: 2, conjunto: { aprendizaje: 'SUCCESS', presupuesto: 10 }, anuncios: [{ id: 'A1', frecuencia7: 1.8, serie: serie(14, i => [6, 1000, i < 3 ? 20 : 10, 4]) }] });
  assert.ok(!r2.sugerencias.some(x => x.regla === 'fatiga'));
});

test('escalar: fuera del aprendizaje, 3 días con el costo un 20 % bajo el objetivo → +20 % (gasta, dos clics), una vez cada 72 h, dentro de los topes', () => {
  const caso = { cpa: 2, conjunto: { aprendizaje: 'SUCCESS', presupuesto: 10 }, anuncios: [{ id: 'A1', frecuencia7: 1.6, serie: [[9.6, 3000, 60, 8], [10, 3000, 60, 10], [9.8, 3000, 60, 7]] }] };
  const r = correr(caso);
  assert.deepEqual(r.sugerencias.map(s => [s.regla, s.objeto.id, s.cambio.tipo, s.cambio.valor]), [['escalar', 'S1', 'subir_presupuesto', 12]]);
  const s = r.sugerencias[0]; assert.equal(s.gasto, true); assert.equal(s.riesgo.gastaMas, true); assert.equal(s.riesgo.reiniciaAprendizaje, false); assert.match(s.porque, /30 %/);
  assert.match(s.dato, /US\$1\.20, US\$1, US\$1\.40/);
  // subido hace 24 h: espera
  const r2 = correr(caso, { diag: { subidas: { S1: AHORA - 24 * 3600e3 } } });
  assert.deepEqual(r2.sugerencias, []); assert.ok(r2.notas.some(n => n.regla === 'escalar' && /72 h/.test(n.texto)));
  // un día por encima del 80 % del objetivo rompe la racha
  const r3 = correr({ ...caso, anuncios: [{ id: 'A1', frecuencia7: 1.6, serie: [[9.6, 3000, 60, 8], [10, 3000, 60, 5], [9.8, 3000, 60, 7]] }] });
  assert.deepEqual(r3.sugerencias, []);
  // no cabe en el tope diario: no se propone, se dice
  const r4 = correr(caso, { diag: { topes: { diario: 11, mensual: 300, campana: 150 } } });
  assert.deepEqual(r4.sugerencias, []); assert.ok(r4.notas.some(n => n.regla === 'escalar' && /topes/.test(n.texto)));
  // aprendiendo: nunca
  assert.deepEqual(correr({ ...caso, conjunto: { aprendizaje: 'LEARNING', presupuesto: 10 } }).sugerencias, []);
});

test('limitado → revisar (juntar, abrir, más presupuesto, optimizar más arriba) con el presupuesto que haría falta', () => {
  const r = correr({ cpa: 3, conjunto: { aprendizaje: 'FAIL', conversiones: 8, presupuesto: 5 }, anuncios: [{ id: 'A1', frecuencia7: 1.3, serie: serie(7, [5, 1500, 22, 1]) }] });
  const s = r.sugerencias.find(x => x.regla === 'limitado');
  assert.equal(s.objeto.id, 'S1'); assert.equal(s.cambio.tipo, 'revisar'); assert.match(s.porque, /US\$21\.43 al día/); assert.equal(s.riesgo.reiniciaAprendizaje, true);
});

test('estructura: más de 3 conjuntos parecidos atascados en el aprendizaje → juntarlos, y no un «limitado» por cada uno', () => {
  const sets = ['S1', 'S2', 'S3', 'S4'].map(id => ({ id, aprendizaje: 'FAIL', presupuesto: 3, inicio: '2026-09-20T00:00:00-0500', anuncios: [{ id: 'A' + id, frecuencia7: 1.2, serie: serie(10, [3, 800, 10, 1]) }] }));
  const r = correr({ cpa: 5 }, { conjuntos: sets });
  assert.deepEqual(r.sugerencias.map(s => [s.regla, s.objeto.id]), [['estructura', 'C1']]);
  assert.match(r.sugerencias[0].efecto, /US\$12 al día/);
});

test('rechazado → borrador del texto corregido; con problemas → el motivo; los dos aunque el conjunto aprenda', () => {
  const r = correr({ cpa: 2, conjunto: { aprendizaje: 'LEARNING', presupuesto: 10 }, anuncios: [{ id: 'A1', estado: 'DISAPPROVED', revision: { global: { 'Afirmaciones de salud': 'promete curar' } }, serie: [] }, { id: 'A2', estado: 'WITH_ISSUES', serie: [] }] });
  const a1 = de(r, 'A1')[0], a2 = de(r, 'A2')[0];
  assert.equal(a1.regla, 'rechazado'); assert.equal(a1.cambio.tipo, 'borrador'); assert.match(a1.dato, /Afirmaciones de salud: promete curar/);
  assert.equal(a2.regla, 'problemas'); assert.equal(a2.cambio.tipo, 'revisar');
});

test('la cuenta: un pago pendiente y el gasto cerca del tope', () => {
  const { vista, filas } = armar({ cpa: 2, conjunto: { aprendizaje: 'SUCCESS', presupuesto: 10 }, anuncios: [{ id: 'A1', frecuencia7: 1.2, serie: [] }] }, { cuenta: { account_status: 3 } });
  vista.gasto = { hoy: 19, semana: 50, mes: 100 };
  const r = diagnosticar({ vista, filas, hoy: HOY, cpa: { valor: 2 }, umbrales: U, ahora: AHORA, topes: { diario: 20, mensual: 300, campana: 150 } });
  assert.deepEqual(r.sugerencias.filter(s => s.regla === 'cuenta').map(s => s.id).sort(), ['cuenta-act_1-estado', 'cuenta-act_1-tope-dia']);
});

test('lo que no se puede medir se dice: sin costo objetivo no se juzga el costo; sin píxel no se saben las compras', () => {
  const r = correr({ cpa: 0, conjunto: { aprendizaje: 'SUCCESS', presupuesto: 10 }, anuncios: [{ id: 'A1', frecuencia7: 1.2, serie: serie(6, [2, 600, 5, 0]) }] });
  assert.deepEqual(r.sugerencias, []); assert.match(r.sinObjetivo, /^Sin costo objetivo no puedo juzgar el costo/);
  const { vista, filas } = armar({ cpa: 2, conjunto: { aprendizaje: 'SUCCESS', presupuesto: 10 }, anuncios: [{ id: 'A1', frecuencia7: 1.2, serie: serie(6, [2, 600, 5, 0]) }] }, { campana: { objective: 'OUTCOME_SALES' } });
  const r2 = diagnosticar({ vista, filas, hoy: HOY, cpa: { valor: 2 }, umbrales: U, ahora: AHORA, pixel: false });
  assert.deepEqual(r2.sugerencias, []); assert.ok(r2.notas.some(n => /sin píxel no sé cuántas compras vinieron del anuncio/.test(n.texto)));
});

test('impulsar: una publicación con 3× las interacciones de la media de su red (solo la mejor)', () => {
  const t = i => new Date(AHORA - i * 864e5).toISOString();
  const pubs = [...serie(6, i => ({ id: `ig|${i}`, red: 'instagram', texto: `Normal ${i}`, publicadaAt: t(i + 1), interacciones: 10 })), { id: 'ig|top', red: 'instagram', texto: 'La de los lentes\nmás', publicadaAt: t(2), interacciones: 80 }];
  const { vista, filas } = armar({ cpa: 2, conjunto: { aprendizaje: 'SUCCESS', presupuesto: 10 }, anuncios: [] });
  const r = diagnosticar({ vista, filas, hoy: HOY, cpa: { valor: 2 }, umbrales: U, ahora: AHORA, publicaciones: pubs });
  const s = r.sugerencias.find(x => x.regla === 'impulsar');
  assert.equal(s.cambio.tipo, 'impulsar'); assert.equal(s.cambio.id, 'ig|top'); assert.equal(s.gasto, false); assert.match(s.dato, /La de los lentes/); assert.equal(s.id, 'impulsar-ig_top');
});

test('qué pasó después: los 7 días siguientes contra los 7 anteriores', () => {
  const filas = [...serie(16, i => ({ campaign_id: 'C1', adset_id: 'S1', ad_id: 'A1', date_start: sumarDias('2026-09-20', i), spend: '10', impressions: '1000', clicks: '20', actions: [{ action_type: MSG, value: i < 8 ? '4' : '8' }] }))];
  const r = medirResultado({ filas, nivel: 'conjunto', id: 'S1', tipo: 'mensajes', aplicadaEl: '2026-09-28', hoy: HOY, dias: 7, cambio: 'subir_presupuesto' });
  assert.equal(r.antes.costoPorResultado, 2.5); assert.equal(r.despues.costoPorResultado, 1.25); assert.equal(r.mejoro, true); assert.equal(r.r, 1);
  assert.equal(medirResultado({ filas, nivel: 'conjunto', id: 'S1', tipo: 'mensajes', aplicadaEl: '2026-10-05', hoy: HOY }), null, 'todavía no pasaron 7 días');
});

test('los casos de evals/anuncios-diagnostico/evals.json: el diagnóstico puro da la decisión correcta en cada uno', () => {
  const e = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals', 'anuncios-diagnostico', 'evals.json'), 'utf8'));
  assert.deepEqual(validarEvals(e), []);
  assert.ok(e.evals.length >= 4);
  for (const x of e.evals) {
    const r = correr(x.caso), d = x.decision, mias = r.sugerencias.filter(s => ['S1', 'C1', ...(x.caso.anuncios || []).map(a => a.id)].includes(s.objeto.id));
    if (d.objeto === null) {
      assert.deepEqual(mias, [], `${x.id}: no debe proponer nada`);
      if (d.nota) assert.ok(r.notas.some(n => n.regla === d.nota), `${x.id}: falta la nota «${d.nota}»`);
      if (d.sinObjetivo) assert.ok(r.sinObjetivo, `${x.id}: debe decir que no hay costo objetivo`);
      continue;
    }
    const s = mias.find(y => y.objeto.id === d.objeto);
    assert.ok(s, `${x.id}: falta la sugerencia para ${d.objeto} (hay: ${mias.map(y => y.id).join(', ') || 'ninguna'})`);
    assert.equal(s.regla, d.regla, x.id); assert.equal(s.cambio.tipo, d.tipo, x.id);
    if (d.valor !== undefined) assert.equal(s.cambio.valor, d.valor, x.id);
    for (const no of d.sin || []) assert.ok(!mias.some(y => y.regla === no), `${x.id}: no debe proponer «${no}»`);
  }
});
