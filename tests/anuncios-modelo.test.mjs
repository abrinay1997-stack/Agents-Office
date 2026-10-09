// Fase A1 de Anuncios (8 oct 2026): el modelo puro — qué es un resultado según el objetivo, los estados en palabras, el dinero,
// la etiqueta de la oficina, las cifras recalculadas (nunca promediadas) y la vista que contesta GET /api/anuncios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resultadoDe, cifras, estadoTexto, aprendizaje, cuentaEstado, deMeta, aMeta, etiqueta, conEtiqueta, publicoTexto, rangos, fechaEn, armarVista, buscar, textoCampanas, textoCuenta, textoObjeto } from '../anuncios/modelo.mjs';

test('el resultado depende del objetivo y del destino', () => {
  assert.equal(resultadoDe('OUTCOME_ENGAGEMENT', { optimizacion: 'CONVERSATIONS', destino: 'WHATSAPP' }), 'mensajes');
  assert.equal(resultadoDe('OUTCOME_ENGAGEMENT', { destino: 'MESSAGING_INSTAGRAM_DIRECT_MESSENGER' }), 'mensajes');
  assert.equal(resultadoDe('OUTCOME_ENGAGEMENT', { optimizacion: 'POST_ENGAGEMENT' }), 'interacciones');
  assert.equal(resultadoDe('OUTCOME_TRAFFIC', { optimizacion: 'LINK_CLICKS', destino: 'WEBSITE' }), 'clics');
  assert.equal(resultadoDe('OUTCOME_TRAFFIC', { destino: 'INSTAGRAM_PROFILE' }), 'perfil');
  assert.equal(resultadoDe('OUTCOME_SALES', { destino: 'WEBSITE' }), 'compras');
  assert.equal(resultadoDe('OUTCOME_LEADS'), 'contactos');
  assert.equal(resultadoDe('OUTCOME_AWARENESS'), 'alcance');
  assert.equal(resultadoDe('OTRA_COSA'), null);
});

test('las cifras se suman y CTR, CPC, CPM y frecuencia se RECALCULAN; el costo por resultado sale del tipo', () => {
  const filas = [
    { spend: '10.00', impressions: '1000', reach: '800', clicks: '20', inline_link_clicks: '12', ctr: '2', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '5' }, { action_type: 'link_click', value: '12' }] },
    { spend: '5.00', impressions: '500', reach: '450', clicks: '5', inline_link_clicks: '3', ctr: '1', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '1' }] },
  ];
  const c = cifras(filas, 'mensajes', { alcance: 1000 });
  assert.equal(c.gasto, 15); assert.equal(c.impresiones, 1500); assert.equal(c.clics, 25); assert.equal(c.clicsEnlace, 15);
  assert.equal(c.ctr, 1.67, '25/1500, no el promedio de 2 % y 1 %'); assert.equal(c.cpc, 0.6); assert.equal(c.cpm, 10);
  assert.equal(c.alcance, 1000); assert.equal(c.frecuencia, 1.5);
  assert.equal(c.resultados, 6); assert.equal(c.costoPorResultado, 2.5); assert.equal(c.resultadoTexto, 'conversaciones iniciadas');
  assert.equal(cifras(filas, 'mensajes').alcance, null, 'sin el alcance del rango, no se suma el de cada día: null');
  assert.equal(cifras(filas, 'clics').resultados, 15);
  const compras = cifras([{ spend: '20', actions: [{ action_type: 'purchase', value: '2' }, { action_type: 'omni_purchase', value: '2' }, { action_type: 'offsite_conversion.fb_pixel_purchase', value: '2' }] }], 'compras');
  assert.equal(compras.resultados, 2, 'las compras se cuentan una vez, no tres');
  assert.equal(cifras([{ spend: '3', impressions: '10' }], 'mensajes').resultados, 0, 'sin la acción, fueron 0');
  assert.equal(cifras([{ spend: '3', impressions: '10' }], 'mensajes').costoPorResultado, null);
  assert.equal(cifras([{ spend: '3' }], 'perfil').resultados, null, 'un tipo sin verificar no se da por cero');
  const a = cifras([{ spend: '6', impressions: '3000', reach: '2000' }], 'alcance');
  assert.equal(a.resultados, 2000); assert.equal(a.costoPorResultado, 3); assert.equal(a.costoPor, 'mil');
  const nada = cifras([], 'mensajes', { hayDatos: false }); assert.equal(nada.gasto, null); assert.equal(nada.resultados, null);
  const cero = cifras([], 'mensajes'); assert.equal(cero.gasto, 0); assert.equal(cero.resultados, 0);
});

test('estados, aprendizaje y la cuenta en palabras', () => {
  assert.equal(estadoTexto('ACTIVE'), 'Activa'); assert.equal(estadoTexto('CAMPAIGN_PAUSED'), 'Pausada por su campaña'); assert.equal(estadoTexto('ADSET_PAUSED'), 'Pausada por su conjunto');
  assert.equal(estadoTexto('DISAPPROVED'), 'Rechazado por Meta'); assert.equal(estadoTexto('PENDING_REVIEW'), 'En revisión de Meta'); assert.equal(estadoTexto('WITH_ISSUES'), 'Con problemas'); assert.equal(estadoTexto('IN_PROCESS'), 'Procesando'); assert.equal(estadoTexto('ARCHIVED'), 'Archivada');
  assert.deepEqual(aprendizaje({ status: 'LEARNING', conversions: 12 }), { estado: 'LEARNING', texto: 'Aprendiendo', conversiones: 12 });
  assert.equal(aprendizaje({ status: 'FAIL' }).texto, 'Aprendizaje limitado'); assert.equal(aprendizaje({ status: 'SUCCESS' }).texto, 'Fuera del aprendizaje'); assert.equal(aprendizaje(null).estado, null);
  assert.equal(cuentaEstado(1).nivel, 'ok'); assert.equal(cuentaEstado(3).texto, 'Con un pago pendiente'); assert.equal(cuentaEstado(3).nivel, 'bad'); assert.equal(cuentaEstado(2).texto, 'Desactivada');
  assert.equal(cuentaEstado(9).nivel, 'warn'); assert.equal(cuentaEstado(101).texto, 'Cerrada');
});

test('el dinero de Meta va en centavos (en USD); el de las cifras, en la moneda', () => {
  assert.equal(deMeta('1500', 'USD'), 15); assert.equal(deMeta('1500', 'JPY'), 1500); assert.equal(deMeta('0', 'USD', { ceroEsNada: true }), null); assert.equal(deMeta('', 'USD'), null);
  assert.equal(aMeta(15.5, 'USD'), 1550);
});

test('la etiqueta de la oficina distingue lo creado aquí de lo creado fuera', () => {
  assert.deepEqual(etiqueta('Mensajes Panamá · AO:b12'), { nombre: 'Mensajes Panamá', borrador: 'b12', creadoFuera: false });
  assert.equal(etiqueta('Campaña del Administrador').creadoFuera, true);
  assert.equal(conEtiqueta('Mensajes · AO:viejo', 'b2'), 'Mensajes · AO:b2');
  assert.equal(publicoTexto({ geo_locations: { countries: ['PA'] }, age_min: 18, targeting_automation: { advantage_audience: 1 } }), 'Panamá · 18+ · Advantage+');
  assert.equal(publicoTexto({ geo_locations: { custom_locations: [{ radius: 10, distance_unit: 'kilometer' }] }, age_min: 25, age_max: 45, genders: [2] }), 'radio de 10 km · 25–45 · mujeres');
});

test('los rangos y la fecha en la zona de la cuenta', () => {
  const r = rangos('2026-10-08');
  assert.deepEqual(r['7d'], ['2026-10-02', '2026-10-08']); assert.deepEqual(r.mes, ['2026-10-01', '2026-10-08']); assert.deepEqual(r.previo7, ['2026-09-25', '2026-10-01']); assert.deepEqual(r['30d'][0], '2026-09-09');
  assert.equal(fechaEn('America/Panama', Date.UTC(2026, 9, 9, 3)), '2026-10-08', 'a las 22:00 de Panamá todavía es el 8');
});

test('la vista: estructura, estados, aprendizaje, rechazos con su motivo, cifras por nivel, gasto contra topes y tendencia', () => {
  const hoy = '2026-10-08';
  const guardado = {
    cuenta: { id: 'act_1001', name: 'PanaClaw Ads', account_status: 1, currency: 'USD', timezone_name: 'America/Panama', amount_spent: '12345', spend_cap: '0', balance: '500' },
    campanas: [{ id: 'C1', name: 'Mensajes · AO:b1', objective: 'OUTCOME_ENGAGEMENT', effective_status: 'ACTIVE', daily_budget: '1500', spend_cap: '15000' }, { id: 'C2', name: 'Vieja', objective: 'OUTCOME_TRAFFIC', effective_status: 'PAUSED' }],
    conjuntos: [{ id: 'S1', campaign_id: 'C1', name: 'Panamá', effective_status: 'ACTIVE', optimization_goal: 'CONVERSATIONS', destination_type: 'WHATSAPP', learning_stage_info: { status: 'LEARNING', conversions: 6 }, targeting: { geo_locations: { countries: ['PA'] }, age_min: 18 } }],
    anuncios: [
      { id: 'A1', adset_id: 'S1', campaign_id: 'C1', name: 'Bueno · AO:b1', effective_status: 'ACTIVE', creative: { id: 'K1' } },
      { id: 'A2', adset_id: 'S1', campaign_id: 'C1', name: 'Malo', effective_status: 'DISAPPROVED', ad_review_feedback: { global: { 'Texto engañoso': 'Promete lo que no se puede.' } }, creative: { id: 'K1' } },
    ],
    creativos: [{ id: 'K1', thumbnail_url: 'https://scontent.fbcdn.test/k.jpg', body: 'Escríbenos', title: 'Combo', call_to_action_type: 'WHATSAPP_MESSAGE' }],
    sincronizadaAt: '2026-10-08T12:00:00.000Z',
  };
  const fila = (ad, fecha, spend, conv) => ({ ad_id: ad, adset_id: 'S1', campaign_id: 'C1', date_start: fecha, spend: String(spend), impressions: '1000', reach: '700', clicks: '10', inline_link_clicks: '8', actions: conv ? [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: String(conv) }] : [] });
  const filas = [fila('A1', hoy, 9.5, 4), fila('A1', '2026-10-05', 5, 2), fila('A1', '2026-09-28', 5, 4)];
  const v = armarVista({ guardado, filas, alcances: {}, rango: '7d', hoy, topes: { diario: 10, mensual: 300, campana: 150 }, hayCifras: true });
  assert.equal(v.cuenta.estadoTexto, 'Activa'); assert.equal(v.cuenta.gastado, 123.45); assert.equal(v.cuenta.spendCap, null); assert.equal(v.cuenta.saldo, 5);
  const c1 = v.campanas.find(c => c.id === 'C1');
  assert.equal(c1.nombre, 'Mensajes'); assert.equal(c1.creadoFuera, false); assert.deepEqual(c1.presupuesto, { tipo: 'diario', usd: 15 }); assert.equal(c1.spendCap, 150); assert.equal(c1.objetivoTexto, 'Interacción');
  assert.equal(v.campanas.find(c => c.id === 'C2').creadoFuera, true);
  const s1 = c1.conjuntos[0]; assert.equal(s1.aprendizaje.texto, 'Aprendiendo'); assert.equal(s1.aprendizaje.conversiones, 6); assert.equal(s1.publico, 'Panamá · 18+');
  const malo = s1.anuncios.find(a => a.id === 'A2'); assert.equal(malo.estadoTexto, 'Rechazado por Meta'); assert.deepEqual(malo.revision, ['Texto engañoso: Promete lo que no se puede.']);
  const bueno = s1.anuncios.find(a => a.id === 'A1'); assert.equal(bueno.creativo.texto, 'Escríbenos'); assert.equal(bueno.creativo.llamada, 'WHATSAPP_MESSAGE'); assert.equal(bueno.creativo.miniatura, 'https://scontent.fbcdn.test/k.jpg');
  assert.equal(bueno.cifras.gasto, 14.5); assert.equal(bueno.cifras.resultados, 6); assert.equal(bueno.cifras.costoPorResultado, 2.42); assert.equal(malo.cifras.gasto, 0);
  assert.equal(c1.cifras.resultadoTexto, 'conversaciones iniciadas');
  assert.deepEqual(v.gasto, { hoy: 9.5, semana: 14.5, mes: 14.5 });
  assert.equal(v.resumen.resultados7d, 6); assert.equal(v.resumen.costoPorResultado7d, 2.42);
  assert.equal(v.resumen.tendencia.gasto, 190, '14,50 contra 5 de la semana anterior'); assert.equal(v.resumen.tendencia.resultados, 50);
  assert.ok(v.avisos.some(a => a.nivel === 'bad' && /rechazó un anuncio: «Malo» \(Texto engañoso/.test(a.texto)));
  assert.ok(v.avisos.some(a => /de hoy va en US\$9\.50 de un tope de 10\.00/.test(a.texto)), 'el 95 % del tope diario se avisa');
  assert.equal(buscar(v, 'A2').tipo, 'anuncio'); assert.equal(buscar(v, 'S1').campana.id, 'C1'); assert.equal(buscar(v, 'nada'), null);
  assert.match(textoCampanas(v, { nivel: 'anuncio' }), /A2 · «Malo» \(creado fuera de la oficina\) · Rechazado por Meta[\s\S]*PROBLEMA: Texto engañoso/);
  assert.match(textoCuenta(v, { topes: { diario: 10, mensual: 300 } }), /6 conversaciones iniciadas a US\$2\.42/);
  assert.match(textoObjeto(v, 'S1'), /Aprendiendo \(6 conversiones\)/);
  // sin cifras leídas, nada se inventa
  const sin = armarVista({ guardado, filas: [], rango: '7d', hoy, topes: {}, hayCifras: false });
  assert.equal(sin.gasto.hoy, null); assert.equal(sin.campanas[0].cifras.gasto, null); assert.equal(sin.resumen.resultados7d, null); assert.equal(sin.resumen.tendencia.gasto, null);
  // la cuenta con un pago pendiente sale arriba
  const pago = armarVista({ guardado: { ...guardado, cuenta: { ...guardado.cuenta, account_status: 3 } }, filas: [], rango: 'hoy', hoy, hayCifras: true });
  assert.ok(pago.avisos.some(a => a.nivel === 'bad' && /pago pendiente/.test(a.texto)));
});
