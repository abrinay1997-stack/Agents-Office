// Fases A6 y A7 de Anuncios (9 oct 2026): LOS INDICADORES del dueño (anuncios/indicadores.mjs) y EL INFORME DEL MES (anuncios/informe.mjs).
// Lo puro con cifras de ejemplo (totales, los mejores creativos, lo aplicado y su resultado, «sin datos» cuando no se sabe, el mes en
// curso aparte) y, con los módulos de verdad —contenido/meta.mjs, anuncios/meta-ads.mjs, anuncios/sincronizar.mjs y anuncios/rutas.mjs—
// contra el Meta de mentira (tests/meta-stand.mjs): crear los indicadores una vez, no duplicarlos, el ROAS solo con píxel y compras, que
// cada lectura de cifras los ponga al día (un punto por día), y la ruta del informe que lo arma y lo guarda en el Cerebro.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearMetaStand, TOKEN_STAND, CUENTA_STAND } from './meta-stand.mjs';
import { crearMeta, PERMISOS_LECTURA, PERMISOS_ANUNCIOS } from '../contenido/meta.mjs';
import { crearMetaAds } from '../anuncios/meta-ads.mjs';
import { crearSincronizador } from '../anuncios/sincronizar.mjs';
import { crearRutasAnuncios } from '../anuncios/rutas.mjs';
import { armarVista, fechaEn, sumarDias } from '../anuncios/modelo.mjs';
import { informeAnuncios, resumirMes, resumenDeVista, mejoresCreativos, lineaInforme, leerLinea, cambioTexto, crearInforme } from '../anuncios/informe.mjs';
import { crearIndicadoresAnuncios, roasDe, roasPosible, valores, IDS, definiciones } from '../anuncios/indicadores.mjs';
import { validateDef } from '../business.mjs';
import { renombrar } from '../fs-seguro.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const conv = n => [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: String(n) }];

// ------------------------------------------------------------------ lo puro: el informe

const GUARDADO = {
  cuenta: { id: CUENTA_STAND, name: 'PanaClaw Ads', account_status: 1, currency: 'USD', timezone_name: 'America/Panama' },
  campanas: [{ id: 'C1', name: 'Mensajes · AO:b1', objective: 'OUTCOME_ENGAGEMENT', effective_status: 'ACTIVE', daily_budget: '1000' }, { id: 'C2', name: 'Web', objective: 'OUTCOME_TRAFFIC', effective_status: 'PAUSED' }],
  conjuntos: [{ id: 'S1', campaign_id: 'C1', name: 'PA', effective_status: 'ACTIVE', optimization_goal: 'CONVERSATIONS', destination_type: 'WHATSAPP' }, { id: 'S2', campaign_id: 'C2', name: 'Ciudad', effective_status: 'PAUSED', optimization_goal: 'LINK_CLICKS', destination_type: 'WEBSITE' }],
  anuncios: [
    { id: 'A1', adset_id: 'S1', campaign_id: 'C1', name: 'Foto vitrina · AO:b1', effective_status: 'ACTIVE', creative: { id: 'K1', title: 'Combo desde 59', body: 'Escríbenos' } },
    { id: 'A2', adset_id: 'S1', campaign_id: 'C1', name: 'Video combo · AO:b1', effective_status: 'ACTIVE', creative: { id: 'K2', title: 'El combo en video' } },
    { id: 'A3', adset_id: 'S1', campaign_id: 'C1', name: 'Solo texto', effective_status: 'ACTIVE', creative: { id: 'K3', body: 'Hola' } },
    { id: 'A4', adset_id: 'S2', campaign_id: 'C2', name: 'Carrusel web', effective_status: 'PAUSED', creative: { id: 'K4' } },
  ],
  creativos: [],
};
const fila = (ad, s, c, fecha, spend, x = {}) => ({ ad_id: ad, adset_id: s, campaign_id: c, date_start: fecha, date_stop: fecha, spend: String(spend), impressions: String(x.imp ?? 1000), clicks: String(x.clics ?? 20), inline_link_clicks: String(x.enlace ?? 10), actions: x.actions ?? [] });
const SEP = [
  fila('A1', 'S1', 'C1', '2026-09-03', 10, { actions: conv(10) }), fila('A1', 'S1', 'C1', '2026-09-04', 10, { actions: conv(10) }), // 20 US$ → 20 conversaciones: 1,00 cada una
  fila('A2', 'S1', 'C1', '2026-09-03', 15, { actions: conv(5) }), // 15 US$ → 5: 3,00 cada una
  fila('A3', 'S1', 'C1', '2026-09-05', 8, { actions: [] }), // 8 US$ sin resultados
  fila('A4', 'S2', 'C2', '2026-09-10', 6, { enlace: 30 }), // tráfico: 30 clics al enlace, 0,20 cada uno
];

test('resumirMes: suma por campaña y por anuncio desde las filas diarias, cada uno con su tipo de resultado; lo que ya no está, con su id', () => {
  const v = armarVista({ guardado: GUARDADO, filas: [], rango: '30d', hoy: '2026-09-30', hayCifras: true });
  const r = resumirMes({ campanas: v.campanas, filas: [...SEP, fila('A9', 'S9', 'C9', '2026-09-11', 2)] });
  assert.equal(r.gasto, 51); assert.equal(r.dias, 5);
  const c1 = r.campanas.find(c => c.id === 'C1');
  assert.equal(c1.cifras.gasto, 43); assert.equal(c1.cifras.resultados, 25); assert.equal(c1.cifras.resultadoTexto, 'conversaciones iniciadas'); assert.equal(c1.cifras.costoPorResultado, 1.72);
  assert.equal(r.campanas.find(c => c.id === 'C2').cifras.resultadoTexto, 'clics al enlace');
  assert.equal(r.anuncios.find(a => a.id === 'A1').cifras.costoPorResultado, 1);
  assert.equal(r.anuncios.find(a => a.id === 'A3').cifras.resultados, 0, 'sin la acción, 0 resultados (Meta no manda ceros)');
  assert.match(r.campanas.find(c => c.id === 'C9').nombre, /C9 \(ya no está en la cuenta\)/);
});

test('mejoresCreativos: por costo por resultado del tipo con más gasto; sin resultados, por CTR (con 300 impresiones o más)', () => {
  const v = armarVista({ guardado: GUARDADO, filas: [], rango: '30d', hoy: '2026-09-30', hayCifras: true });
  const m = mejoresCreativos(resumirMes({ campanas: v.campanas, filas: SEP }).anuncios);
  assert.equal(m.por, 'costo'); assert.equal(m.resultadoTexto, 'conversaciones iniciadas', 'el tráfico (6 US$) no se mezcla con las conversaciones (43 US$)');
  assert.deepEqual(m.lista.map(a => a.id), ['A1', 'A2']);
  const sinRes = [{ id: 'x', cifras: { gasto: 3, resultados: 0, ctr: 1.2, impresiones: 900 } }, { id: 'y', cifras: { gasto: 3, resultados: 0, ctr: 4, impresiones: 100 } }, { id: 'z', cifras: { gasto: 2, resultados: null, ctr: 2.5, impresiones: 500 } }];
  assert.deepEqual(mejoresCreativos(sinRes).lista.map(a => a.id), ['z', 'x'], 'por CTR; con pocas impresiones no cuenta');
  assert.equal(mejoresCreativos([]).por, null);
});

test('informeAnuncios: un mes cerrado con sus totales, por campaña, los mejores, lo aplicado y qué pasó, lo pausado y activado', () => {
  const v = armarVista({ guardado: GUARDADO, filas: [], rango: '30d', hoy: '2026-10-09', hayCifras: true });
  const sugerencias = [
    { id: 's1~a', regla: 'cortar', objeto: { id: 'A3', nivel: 'anuncio', nombre: 'Solo texto' }, cambio: { tipo: 'pausar' }, estado: 'aplicada', aplicadaAt: '2026-09-12T15:00:00Z', aplicadaPor: 'dueno', resultado: { texto: 'Gastó 0,00 US$ en los 7 días siguientes (antes, 8,00 US$).', mejoro: true } },
    { id: 's2~b', regla: 'escalar', objeto: { id: 'S1', nivel: 'conjunto', nombre: 'PA' }, cambio: { tipo: 'subir_presupuesto', valor: 12 }, estado: 'aplicada', aplicadaAt: '2026-09-28T15:00:00Z', aplicadaPor: 'dueno' },
    { id: 's3~c', regla: 'fatiga', objeto: { id: 'A2', nivel: 'anuncio', nombre: 'Video combo' }, cambio: { tipo: 'creativos' }, estado: 'aplicada', aplicadaAt: '2026-08-20T15:00:00Z', resultado: { texto: 'x', mejoro: false } }, // de otro mes: no entra
    { id: 's4', regla: 'limitado', objeto: { id: 'S2', nombre: 'Ciudad' }, estado: 'descartada', descartadaAt: '2026-09-15T10:00:00Z' },
  ];
  const historial = [
    { at: '2026-09-12T15:00:00Z', quien: 'dueno', que: 'pausar', objeto: { id: 'A3', nivel: 'anuncio', nombre: 'Solo texto' }, antes: { estado: 'ACTIVE' }, despues: { estado: 'PAUSED' } },
    { at: '2026-09-28T15:00:00Z', quien: 'dueno', que: 'subir_presupuesto', objeto: { id: 'S1', nivel: 'conjunto', nombre: 'PA' }, antes: { estado: 'ACTIVE', presupuesto: { tipo: 'diario', usd: 10 } }, despues: { estado: 'ACTIVE', presupuesto: { tipo: 'diario', usd: 12 } } },
    { at: '2026-09-29T10:00:00Z', quien: 'piloto', que: 'pausar', objeto: { id: 'A9', nivel: 'anuncio', nombre: 'Otro' }, antes: { estado: 'ACTIVE' }, despues: { estado: 'PAUSED' } },
    { at: '2026-09-29T10:01:00Z', quien: 'dueno', que: 'deshacer:pausar', objeto: { id: 'A9', nivel: 'anuncio', nombre: 'Otro' }, antes: { estado: 'PAUSED' }, despues: { estado: 'ACTIVE' } },
    { at: '2026-10-02T10:00:00Z', quien: 'dueno', que: 'activar', objeto: { id: 'C2', nivel: 'campana', nombre: 'Web' }, antes: { estado: 'PAUSED' }, despues: { estado: 'ACTIVE' } }, // octubre: no entra
  ];
  const r = informeAnuncios({ mes: '2026-09', hoy: '2026-10-09', zona: 'America/Panama', moneda: 'USD', resumen: resumirMes({ campanas: v.campanas, filas: SEP }), cobertura: { leidos: 30, total: 30 }, historial, sugerencias, topes: { mensual: 300 } });
  assert.equal(r.titulo, 'Informe de anuncios — septiembre de 2026');
  const t = r.texto;
  assert.match(t, /## El gasto\n- Gastado en el mes: \*\*49,00\sUS\$\*\*\./); assert.doesNotMatch(t, /tope mensual/, 'el tope es el de ahora: solo se cita en el mes en curso');
  assert.ok(t.indexOf('**Mensajes**') < t.indexOf('**Web**'), 'las campañas, la que más gastó primero');
  assert.match(t, /\*\*Mensajes\*\* \(Interacción\): gastó 43,00\sUS\$ · 25 conversaciones iniciadas a 1,72\sUS\$ cada uno · CTR/);
  assert.match(t, /\*\*Web\*\* \(Tráfico\): gastó 6,00\sUS\$ · 30 clics al enlace a 0,20\sUS\$ cada uno/);
  assert.match(t, /## Los mejores creativos\n_Por costo por resultado \(conversaciones iniciadas\)[^\n]*\n- \*\*Foto vitrina\*\* \(campaña «Mensajes»\): 20 conversaciones iniciadas a 1,00\sUS\$ cada uno · gastó 20,00\sUS\$ · «Combo desde 59»\.\n- \*\*Video combo\*\*/);
  assert.match(t, /2026-09-12 · «gasta sin resultados» sobre «Solo texto» \(pausar\), aplicada por ti — después: Gastó 0,00\sUS\$ en los 7 días siguientes \(antes, 8,00\sUS\$\) \(mejoró\)\./);
  assert.match(t, /2026-09-28 · «va bien: escalar» sobre «PA» \(subir presupuesto\), aplicada por ti — todavía no se sabe qué pasó: se mide 7 días después de aplicarla\./);
  assert.doesNotMatch(t, /Video combo» \(creativos\)/, 'lo aplicado en agosto no es de septiembre');
  assert.match(t, /1 sugerencia descartada este mes/);
  assert.match(t, /- En total: 2 pausas, 1 subida de presupuesto\./);
  assert.match(t, /2026-09-28 · Subida de presupuesto del conjunto «PA» \(10,00\sUS\$ al día → 12,00\sUS\$ al día\), por ti\./);
  assert.match(t, /2026-09-29 · Pausa del anuncio «Otro» \(activa → en pausa\), por el piloto automático\./);
  assert.match(t, /2026-09-29 · Deshecha la pausa del anuncio «Otro» \(en pausa → activa\), por ti\./);
  assert.doesNotMatch(t, /2026-10-02/, 'lo de octubre no entra');
  assert.match(t, /## Qué repetir y qué cambiar\n- Repite lo de «Foto vitrina»[^\n]*\n- «Solo texto» gastó 8,00\sUS\$ sin ningún resultado/);
  assert.deepEqual({ gasto: r.cifras.gasto, campanas: r.cifras.campanas, aplicadas: r.cifras.aplicadas, mejoraron: r.cifras.aplicadasMejoraron, cambios: r.cifras.cambios, mejor: r.cifras.mejor.nombre }, { gasto: 49, campanas: 2, aplicadas: 2, mejoraron: 1, cambios: 4, mejor: 'Foto vitrina' });
  // la línea del lunes y vuelta
  const l = lineaInforme(r.cifras);
  assert.match(l, /^Anuncios de septiembre de 2026: gastado 49,00\sUS\$ en 2 campañas; mejor creativo «Foto vitrina» \(1,00\sUS\$ por resultado\); 2 sugerencias aplicadas \(1 mejoraron\); 4 cambios desde la oficina\.$/);
  assert.equal(leerLinea(`---\ntipo: informe\nlinea: ${JSON.stringify(l)}\n---\n# x`), l);
  assert.equal(leerLinea('# sin cabecera'), null);
});

test('informeAnuncios: «sin datos» cuando no se sabe, el mes en curso aparte (con su tope), lo que falta de cobertura, y un mes futuro no', () => {
  const nada = informeAnuncios({ mes: '2026-07', hoy: '2026-10-09', resumen: null, historial: [], sugerencias: [] });
  assert.match(nada.texto, /## El gasto\n- Sin datos: la oficina no tiene cifras de anuncios de este mes/);
  assert.match(nada.texto, /## Por campaña\n- Sin datos\./); assert.match(nada.texto, /## Los mejores creativos\n- Sin datos\./);
  assert.match(nada.texto, /Ninguna sugerencia aplicada este mes/); assert.match(nada.texto, /Ningún cambio hecho desde la oficina este mes/);
  assert.match(nada.texto, /Todavía no hay datos suficientes para recomendar algo/);
  assert.doesNotMatch(nada.texto, /0,00\sUS\$/, 'sin datos nunca es un cero inventado');
  assert.equal(nada.cifras.gasto, null); assert.equal(lineaInforme(nada.cifras), 'Anuncios de julio de 2026: sin cifras de Meta.');
  assert.match(informeAnuncios({ mes: '2026-07', hoy: '2026-10-09', conectado: false }).texto, /Meta no está conectada para anuncios/);
  // leído y sin gastar no es «sin datos»
  const cero = informeAnuncios({ mes: '2026-09', hoy: '2026-10-09', resumen: { gasto: 0, campanas: [], anuncios: [], dias: 0 }, cobertura: { leidos: 30, total: 30 } });
  assert.match(cero.texto, /Gastado en el mes: \*\*0,00\sUS\$\*\*\.\n- Los anuncios no gastaron nada este mes\./);
  // el mes en curso: «lo que va», hasta hoy, con el tope de ahora; y la cobertura que falta
  const v = armarVista({ guardado: GUARDADO, filas: [], rango: '30d', hoy: '2026-10-09', hayCifras: true });
  const oct = informeAnuncios({ mes: '2026-10', hoy: '2026-10-09', resumen: resumirMes({ campanas: v.campanas, filas: [fila('A1', 'S1', 'C1', '2026-10-02', 30, { actions: conv(6) })] }), cobertura: { leidos: 4, total: 31 }, topes: { mensual: 300 } });
  assert.equal(oct.titulo, 'Informe de anuncios — octubre de 2026 (en curso)'); assert.equal(oct.cifras.enCurso, true);
  assert.match(oct.texto, /_El mes no ha terminado: las cifras van del 1 al 9 de octubre/);
  assert.match(oct.texto, /## Lo que va del mes\n- Gastado en lo que va del mes: \*\*30,00\sUS\$\*\* de un tope mensual de 300,00\sUS\$ \(10 %\)\.\n- Cifras de 4 de los 9 días que van/);
  assert.throws(() => informeAnuncios({ mes: '2026-11', hoy: '2026-10-09' }), e => e.status === 400 && /todavía no empieza/.test(e.message));
  assert.throws(() => informeAnuncios({ mes: 'octubre', hoy: '2026-10-09' }), e => e.status === 400);
  // la demo: la vista del mes ya trae las cifras
  const rv = resumenDeVista({ gasto: { mes: 12 }, campanas: [{ id: 'C', nombre: 'Demo', objetivoTexto: 'x', cifras: { gasto: 12, resultados: 3, resultadoTexto: 'conversaciones', costoPorResultado: 4 }, conjuntos: [{ anuncios: [{ id: 'a', nombre: 'Ad', cifras: { gasto: 12, resultados: 3, resultadoTexto: 'conversaciones', costoPorResultado: 4 } }] }] }] });
  assert.equal(rv.gasto, 12); assert.equal(rv.anuncios[0].campana, 'Demo');
  assert.equal(cambioTexto('9,00 US$ al día', '7,00 US$ al día'), '9,00 US$ al día → 7,00 US$ al día', 'el historial de la demo trae textos');
});

// ------------------------------------------------------------------ lo puro: los indicadores

test('roasDe y roasPosible: el ROAS del periodo es lo vendido entre lo gastado (no el promedio de los días); sin píxel o sin compras, no', () => {
  const f = (spend, roas, compras) => ({ spend: String(spend), ...(roas != null ? { purchase_roas: [{ action_type: 'omni_purchase', value: String(roas) }] } : {}), actions: compras ? [{ action_type: 'offsite_conversion.fb_pixel_purchase', value: String(compras) }] : [] });
  const r = roasDe([f(10, 4, 2), f(30, 2, 1)]); // vendido 40 + 60 = 100 de 40 gastados → 2,5 (el promedio de 4 y 2 diría 3)
  assert.deepEqual({ compras: r.compras, gasto: r.gasto, vendido: r.vendido, roas: r.roas }, { compras: 3, gasto: 40, vendido: 100, roas: 2.5 });
  assert.equal(roasPosible({ pixel: false, filas30: [f(10, 4, 2)] }).puede, false); assert.match(roasPosible({ pixel: false }).motivo, /no hay píxel de Meta en Ajustes → Anuncios/);
  assert.match(roasPosible({ pixel: true, filas30: [f(10, null, 0)] }).motivo, /no midió ninguna compra/);
  assert.match(roasPosible({ pixel: true, filas30: [f(10, null, 2)] }).motivo, /no su valor \(purchase_roas\)/);
  assert.equal(roasPosible({ pixel: true, filas30: [f(10, 4, 2)] }).puede, true);
  for (const d of definiciones('USD')) assert.ok(validateDef(d).def, `«${d.id}» es una definición válida de business.mjs`);
  assert.equal(definiciones('PAB')[0].unit, 'PAB', 'la unidad es la moneda de la cuenta');
  const v = valores({ vistaMes: { gasto: { mes: 50 } }, vista30: { campanas: [{ resultado: 'mensajes', cifras: { gasto: 30, resultados: 10, resultadoTexto: 'conversaciones' } }, { resultado: 'mensajes', cifras: { gasto: 10, resultados: 10, resultadoTexto: 'conversaciones' } }, { resultado: 'clics', cifras: { gasto: 5, resultados: 100 } }] } });
  assert.equal(v[IDS.gasto], 50); assert.equal(v[IDS.costo], 2, 'gasto / resultados del tipo con más gasto (40 / 20), sin mezclar clics'); assert.equal(v[IDS.roas], null);
  assert.equal(valores({})[IDS.costo], null, 'sin cifras, null: nunca un 0');
});

// ------------------------------------------------------------------ con los módulos de verdad y el Meta de mentira

const pedir = async (g, ruta, campos) => (await g.fetchFn(`https://graph.test/v26.0${ruta}`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN_STAND}` }, body: new URLSearchParams(Object.entries(campos).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])) })).json();

async function montar(t, { pixel = '' } = {}) {
  const g = crearMetaStand({ permisos: [...PERMISOS_LECTURA, ...PERMISOS_ANUNCIOS] });
  const c = await pedir(g, `/${CUENTA_STAND}/campaigns`, { name: 'Ventas web · AO:b1', objective: 'OUTCOME_SALES', special_ad_categories: [], status: 'PAUSED', daily_budget: 1000 });
  const s = await pedir(g, `/${CUENTA_STAND}/adsets`, { campaign_id: c.id, name: 'PA', optimization_goal: 'OFFSITE_CONVERSIONS', billing_event: 'IMPRESSIONS', destination_type: 'WEBSITE', targeting: { geo_locations: { countries: ['PA'] }, age_min: 18, targeting_automation: { advantage_audience: 1 } }, status: 'PAUSED' });
  const cr = await pedir(g, `/${CUENTA_STAND}/adcreatives`, { name: 'k', object_story_spec: { page_id: 'P1', link_data: { message: 'Compra el combo', name: 'Combo del mes' } } });
  const a = (await pedir(g, `/${CUENTA_STAND}/ads`, { adset_id: s.id, name: 'Combo · AO:b1', creative: { creative_id: cr.id }, status: 'PAUSED' })).id;
  for (const id of [c.id, s.id, a]) await pedir(g, `/${id}`, { status: 'ACTIVE' });
  const hoy = fechaEn('America/Panama'), ayer = sumarDias(hoy, -1);
  const f = (fecha, spend, compras, roas) => ({ ad_id: a, adset_id: s.id, campaign_id: c.id, date_start: fecha, date_stop: fecha, spend: String(spend), impressions: '2000', reach: '900', clicks: '40', inline_link_clicks: '30',
    actions: compras ? [{ action_type: 'offsite_conversion.fb_pixel_purchase', value: String(compras) }, { action_type: 'link_click', value: '30' }] : [{ action_type: 'link_click', value: '30' }], ...(roas != null ? { purchase_roas: [{ action_type: 'omni_purchase', value: String(roas) }] } : {}) });
  g.st.cifras = [f(ayer, 10, 2, 5), f(hoy, 10, 1, 3)];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-a6a7-'));
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  const meta = crearMeta({ env: { META_ACCESS_TOKEN: TOKEN_STAND, META_GRAPH_HOST: 'https://graph.test' }, fetchFn: g.fetchFn, dir });
  const aj = { cuenta: CUENTA_STAND, topeDiario: 30, topeMensual: 300, topeCampana: 150, pixel };
  let kp = { defs: [], values: {} }, guardados = 0;
  const kpis = { leer: () => JSON.parse(JSON.stringify(kp)), guardar: k => { kp = JSON.parse(JSON.stringify(k)); guardados++; } };
  let ind = null, despues = 0;
  // como serve.mjs: tras cada lectura buena de cifras, los indicadores al día
  // reloj fijo al mediodía de Panamá de «hoy»: el historial se apunta con la hora UTC y, entre las 19:00 del último día del mes y la medianoche, caía en el mes siguiente y el test fallaba solo a esa hora
  const AHORA = Date.parse(`${hoy}T12:00:00-05:00`);
  const sync = crearSincronizador({ meta, ads: crearMetaAds({ meta }), dir: path.join(dir, 'anuncios'), ajustes: () => aj, ahora: () => AHORA, despuesDeCifras: () => { despues++; ind?.llevar(); } });
  ind = crearIndicadoresAnuncios({ sync, kpis, ajustes: () => aj });
  return { g, sync, ind, aj, dir, hoy, ayer, f, kp: () => kp, poner: k => { kp = JSON.parse(JSON.stringify(k)); }, guardados: () => guardados, despues: () => despues };
}
const esperar = async (fn, que) => { const t0 = Date.now(); for (;;) { if (await fn()) return; if (Date.now() - t0 > 20000) throw new Error('no llegó a tiempo: ' + que); await new Promise(r => setTimeout(r, 20)); } };

test('A6: «Crear indicadores» los crea una vez (el ROAS no, sin píxel, y dice por qué), no duplica, y cada lectura de cifras los pone al día (un punto por día)', async t => {
  const m = await montar(t);
  const c0 = m.ind.crear(); // sin cifras todavía también se puede: los valores llegan con la primera lectura
  assert.deepEqual(c0.creados, [IDS.gasto, IDS.costo]); assert.deepEqual(c0.ya, []); assert.equal(c0.motivo, roasPosible({ pixel: false }).motivo);
  const k0 = m.kp(); assert.deepEqual(k0.defs.map(d => d.id), [IDS.gasto, IDS.costo], 'gasto y costo, sin ROAS');
  assert.deepEqual(Object.keys(k0.values), [], 'sin lectura de Meta, ningún valor inventado');
  assert.deepEqual(await m.sync.sincronizar({ cifras: true }), { ok: true });
  await esperar(() => m.despues() > 0 && (m.kp().values[IDS.gasto] || []).length, 'los indicadores tras la lectura');
  let k = m.kp();
  assert.deepEqual(k.values[IDS.gasto].map(x => x.v), [m.ayer.slice(0, 7) === m.hoy.slice(0, 7) ? 20 : 10], 'el gasto del mes (ayer + hoy, si ayer es de este mes)');
  assert.deepEqual(k.values[IDS.costo].map(x => x.v), [6.67], '20 US$ entre 3 compras (el resultado de una campaña de ventas)');
  assert.equal(k.values[IDS.costo][0].from, 'Meta anuncios');
  assert.equal(k.values[IDS.roas], undefined);
  // otra vez: no duplica nada
  const otra = m.ind.crear();
  assert.deepEqual(otra.creados, []); assert.deepEqual(otra.ya, [IDS.gasto, IDS.costo]); assert.match(otra.motivo, /no hay píxel/);
  assert.equal(m.kp().defs.length, 2);
  // Meta corrige el gasto de hoy: la lectura siguiente CORRIGE el punto de hoy, no suma otro
  m.g.st.cifras = [m.f(m.ayer, 10, 2, 5), m.f(m.hoy, 16, 2, 3)];
  const n0 = m.despues();
  assert.deepEqual(await m.sync.sincronizar({ cifras: true }), { ok: true });
  await esperar(() => m.despues() > n0 && m.kp().values[IDS.costo][0].v !== 6.67, 'la corrección');
  k = m.kp();
  assert.equal(k.values[IDS.gasto].length, 1, 'un punto por día'); assert.equal(k.values[IDS.gasto][0].v, m.ayer.slice(0, 7) === m.hoy.slice(0, 7) ? 26 : 16);
  assert.equal(k.values[IDS.costo][0].v, 6.5, '26 US$ entre 4 compras');
  // un indicador que el dueño borró no vuelve solo, y la lectura siguiente tampoco le pone valores
  const sinCosto = { defs: k.defs.filter(d => d.id !== IDS.costo), values: { [IDS.gasto]: k.values[IDS.gasto] } };
  m.poner(sinCosto);
  m.g.st.cifras = [m.f(m.ayer, 10, 2, 5), m.f(m.hoy, 18, 2, 3)];
  const n1 = m.despues();
  assert.deepEqual(await m.sync.sincronizar({ cifras: true }), { ok: true });
  await esperar(() => m.despues() > n1, 'la tercera lectura');
  assert.deepEqual(m.kp().defs.map(d => d.id), [IDS.gasto]); assert.equal(m.kp().values[IDS.costo], undefined);
  assert.deepEqual(m.ind.estado(), { gasto: true, costo: false, roas: false, roasPosible: roasPosible({ pixel: false }) });
});

test('A6: con píxel y compras, el ROAS se crea (lo vendido entre lo gastado) y se lleva; la ruta solo deja crearlos al dueño', async t => {
  const m = await montar(t, { pixel: '1234567890' });
  assert.deepEqual(await m.sync.sincronizar({ cifras: true }), { ok: true });
  assert.ok(m.g.llamadas.some(l => /\/insights$/.test(l.ruta) && /purchase_roas/.test(l.q.fields || '')), 'con píxel, se piden los purchase_roas');
  const json = (res, code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  const body = req => new Promise(ok => { let x = ''; req.on('data', d => { x += d; }); req.on('end', () => { try { ok(x ? JSON.parse(x) : {}); } catch { ok({}); } }); });
  const handle = crearRutasAnuncios({ sync: m.sync, meta: { uso: () => ({ pct: 0, ritmo: 1 }) }, json, body, indicadores: m.ind });
  const srv = http.createServer(async (req, res) => { if (!await handle(req, res, new URL(req.url, 'http://x'))) json(res, 404, {}); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); t.after(() => srv.close());
  const api = async (metodo, p, b) => { const r = await fetch(`http://127.0.0.1:${srv.address().port}${p}`, { method: metodo, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
  const antes = await api('GET', '/api/anuncios?rango=7d');
  assert.deepEqual(antes.indicadores, { gasto: false, costo: false, roas: false, roasPosible: { puede: true, motivo: '', fuente: 'meta' } }, 'la vista dice cuáles tiene el dueño');
  for (const por of ['agente', 'dimitri', 'asistente']) assert.equal((await api('POST', '/api/anuncios/indicadores', { por })).status, 403, por);
  assert.equal(m.kp().defs.length, 0, 'nadie más los crea');
  const r = await api('POST', '/api/anuncios/indicadores', {});
  assert.equal(r.status, 200); assert.deepEqual(r.creados, [IDS.gasto, IDS.costo, IDS.roas]); assert.deepEqual(r.ya, []); assert.equal(r.motivo, undefined);
  const k = m.kp();
  // vendido: ayer 10 × 5 = 50, hoy 10 × 3 = 30 → 80 de 20 gastados = 4 (el promedio de 5 y 3 también da 4: lo distinto lo prueba roasDe)
  assert.deepEqual(k.values[IDS.roas].map(x => x.v), [4]); assert.equal(k.defs.find(d => d.id === IDS.roas).unit, 'x');
  const otra = await api('POST', '/api/anuncios/indicadores', {});
  assert.deepEqual(otra.creados, []); assert.deepEqual(otra.ya, [IDS.gasto, IDS.costo, IDS.roas]);
  assert.equal(m.kp().defs.length, 3, 'no duplica'); assert.equal(m.kp().values[IDS.roas].length, 1);
  assert.deepEqual((await api('GET', '/api/anuncios/indicadores')).roas, true);
});

test('A7: la ruta del informe lo arma con lo leído de Meta, lo guarda como nota en el Cerebro (temporal y renombrar) y un agente solo lo lee', async t => {
  const m = await montar(t);
  assert.deepEqual(await m.sync.sincronizar({ cifras: true }), { ok: true });
  m.sync.anotar({ quien: 'dueno', que: 'pausar', objeto: { id: 'A1', nivel: 'anuncio', nombre: 'Combo' }, antes: { estado: 'ACTIVE' }, despues: { estado: 'PAUSED' } });
  const cerebro = path.join(m.dir, 'brain'), dirInf = path.join(cerebro, 'Agents Office', 'informes');
  const informe = crearInforme({ sync: m.sync, dir: dirInf, fs, renombrar, unirRuta: path.join });
  const json = (res, code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  const body = req => new Promise(ok => { let x = ''; req.on('data', d => { x += d; }); req.on('end', () => { try { ok(x ? JSON.parse(x) : {}); } catch { ok({}); } }); });
  const handle = crearRutasAnuncios({ sync: m.sync, meta: { uso: () => ({ pct: 0, ritmo: 1 }) }, json, body, informe });
  const srv = http.createServer(async (req, res) => { if (!await handle(req, res, new URL(req.url, 'http://x'))) json(res, 404, {}); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); t.after(() => srv.close());
  const api = async (metodo, p, b) => { const r = await fetch(`http://127.0.0.1:${srv.address().port}${p}`, { method: metodo, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
  const mes = m.hoy.slice(0, 7), gastoMes = m.ayer.slice(0, 7) === mes ? '20,00' : '10,00';
  const g = await api('GET', '/api/anuncios/informe');
  assert.equal(g.status, 200); assert.match(g.titulo, /\(en curso\)$/); assert.equal(g.cifras.mes, mes);
  assert.match(g.texto, new RegExp(`Gastado en lo que va del mes: \\*\\*${gastoMes}\\sUS\\$\\*\\* de un tope mensual de 300,00\\sUS\\$`));
  assert.match(g.texto, /\*\*Ventas web\*\* \(Ventas\): gastó [\d,]+\sUS\$ · \d+ compras a [\d,]+\sUS\$ cada uno/);
  assert.match(g.texto, /## Lo que se pausó o activó\n- En total: 1 pausa\.\n- \d{4}-\d{2}-\d{2} · Pausa del anuncio «Combo» \(activa → en pausa\), por ti\./);
  assert.equal((await api('GET', '/api/anuncios/informe?mes=octubre')).status, 400);
  assert.equal((await api('GET', '/api/anuncios/informe?mes=2999-01')).status, 400, 'un mes que no empezó');
  const ag = await api('GET', `/api/anuncios/informe?por=agente&mes=${mes}`); assert.equal(ag.status, 200, 'un agente lo lee');
  assert.equal((await api('POST', '/api/anuncios/informe', { por: 'agente', mes })).status, 403);
  assert.equal(fs.existsSync(dirInf), false, 'un agente no guarda nada');
  const p = await api('POST', `/api/anuncios/informe?mes=${mes}`, {});
  assert.equal(p.status, 200); assert.equal(p.nota, `Agents Office/informes/${mes} anuncios.md`);
  const nota = fs.readFileSync(path.join(dirInf, `${mes} anuncios.md`), 'utf8');
  assert.match(nota, new RegExp(`^---\\ntipo: informe\\nde: anuncios\\nmes: ${mes}\\ncreado: `)); assert.ok(nota.includes(g.texto), 'la nota es el mismo informe');
  assert.deepEqual(fs.readdirSync(dirInf), [`${mes} anuncios.md`], 'sin temporales sueltos');
  assert.match(leerLinea(nota), /^Anuncios de .* \(en curso\): gastado/);
  assert.ok(!nota.includes(TOKEN_STAND), 'nunca un token');
  // el mes que viene: el lunes cita el de este mes (lineaMesAnterior lee la nota guardada)
  const sig = crearInforme({ sync: { ...m.sync, hoy: () => sumarDias(`${mes}-01`, 40).slice(0, 7) + '-05' }, dir: dirInf, fs, renombrar, unirRuta: path.join });
  assert.equal(sig.lineaMesAnterior(), leerLinea(nota));
  assert.equal(crearInforme({ sync: m.sync, dir: dirInf, fs, renombrar, unirRuta: path.join }).lineaMesAnterior(), null, 'del mes anterior no hay nota');
});

test('A7: la nota del informe no viaja por GitHub (`.gitignore` ya ignora brain-panaclaw/Agents Office/*)', () => {
  const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/).map(l => l.trim());
  assert.ok(gi.includes('brain-panaclaw/Agents Office/*'), 'la carpeta de la oficina en el cerebro del equipo está ignorada');
  const vuelta = gi.filter(l => l.startsWith('!brain-panaclaw/Agents Office/'));
  assert.ok(!vuelta.some(l => /informes/.test(l)), 'y ninguna excepción la devuelve: ' + vuelta.join(', '));
});

test('el informe cuenta el mes en la zona de la cuenta, no en UTC (borde del mes)', () => {
  const h = (at) => ({ at, quien: 'dueno', que: 'pausar', objeto: { id: 'A1', nivel: 'anuncio', nombre: 'Combo' }, antes: { estado: 'ACTIVE' }, despues: { estado: 'PAUSED' } });
  const zona = 'America/Panama'; // UTC-5, sin cambio de hora
  const oct = new Date('2026-10-31T23:30:00-05:00').toISOString(), nov = new Date('2026-11-01T00:30:00-05:00').toISOString(); // = 2026-11-01T04:30Z y 05:30Z: en UTC los dos son noviembre
  assert.equal(oct, '2026-11-01T04:30:00.000Z');
  const de = (mes, hoy, at) => informeAnuncios({ mes, hoy, zona, historial: [h(at)] }).texto;
  const t1 = de('2026-10', '2026-11-05', oct);
  assert.match(t1, /En total: 1 pausa\./, '31 oct 23:30 Panamá cuenta en octubre'); assert.match(t1, /2026-10-31 · Pausa/, 'y se rotula con su día local');
  assert.doesNotMatch(de('2026-11', '2026-11-05', oct), /En total: 1 pausa\./, 'y no en noviembre');
  assert.match(de('2026-11', '2026-11-05', nov), /En total: 1 pausa\./, '1 nov 00:30 Panamá cuenta en noviembre');
  assert.doesNotMatch(de('2026-10', '2026-11-05', nov), /En total: 1 pausa\./, 'y no en octubre');
});
