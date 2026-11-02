// Fase A1 de Anuncios (8 oct 2026): el modelo puro — qué es un resultado según el objetivo, los estados en palabras, el dinero,
// la etiqueta de la oficina, las cifras recalculadas (nunca promediadas) y la vista que contesta GET /api/anuncios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resultadoDe, cifras, estadoTexto, aprendizaje, cuentaEstado, deMeta, aMeta, etiqueta, conEtiqueta, publicoTexto, rangos, fechaEn, armarVista, buscar, textoCampanas, textoCuenta, textoObjeto,
  borradorPorDefecto, normalizarBorrador, validarBorrador, combinacion, COMBINACIONES, TODAS_LAS_COMBINACIONES, costoMaximo, ErrorBorrador, lineaBorrador } from '../anuncios/modelo.mjs';

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
  assert.equal(c.ctr, 1, 'CTR de ENLACE: 15/1500, no el promedio de los diarios ni los 25 clics de todo tipo'); assert.equal(c.cpc, 1, 'CPC de enlace: 15 de gasto entre 15 clics al enlace');
  assert.equal(c.ctrTodos, 1.67, 'con todos los clics: 25/1500'); assert.equal(c.cpcTodos, 0.6); assert.equal(c.cpm, 10);
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

test('tendencia (auditoría 1 nov 2026): sin DOS semanas completas desde que empezó la campaña no hay porcentaje, y dice por qué', () => {
  const hoy = '2026-11-01'; // la semana anterior va del 19 al 25 oct, la de ahora del 26 oct al 1 nov
  const base = camp => ({ cuenta: { id: 'act_1', currency: 'USD', timezone_name: 'America/Panama', account_status: 1 }, campanas: [{ id: 'C1', name: 'M', objective: 'OUTCOME_ENGAGEMENT', effective_status: 'ACTIVE', ...camp }], conjuntos: [{ id: 'S1', campaign_id: 'C1', name: 'S', effective_status: 'ACTIVE', optimization_goal: 'CONVERSATIONS', destination_type: 'WHATSAPP' }], anuncios: [] });
  const MSG = [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '2' }];
  const fila = (fecha, spend) => ({ ad_id: 'A1', adset_id: 'S1', campaign_id: 'C1', date_start: fecha, spend: String(spend), impressions: '500', actions: MSG });
  // una campaña de 2 días: la semana anterior casi no existe (gastó 1 y ahora 11: «sube 1000 %»)
  const filasNueva = [fila('2026-10-25', 1), ...['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'].map(f => fila(f, 11 / 7))];
  const nueva = armarVista({ guardado: base({ start_time: '2026-10-25T10:00:00-0500' }), filas: filasNueva, rango: '7d', hoy, hayCifras: true });
  assert.equal(nueva.resumen.tendencia.gasto, null); assert.equal(nueva.resumen.tendencia.resultados, null);
  assert.equal(nueva.resumen.tendenciaMotivo, 'campaña nueva: sin con qué comparar');
  assert.match(textoCuenta(nueva), /sin porcentaje contra la semana anterior \(campaña nueva/);
  // empezó el 19 oct, justo el primer día de la semana anterior: ya hay dos ventanas completas
  const filasVieja = ['2026-10-19', '2026-10-21', '2026-10-25', '2026-10-26', '2026-10-30', '2026-11-01'].map(f => fila(f, 5));
  const vieja = armarVista({ guardado: base({ start_time: '2026-10-19T00:00:00-0500' }), filas: filasVieja, rango: '7d', hoy, hayCifras: true });
  assert.equal(vieja.resumen.tendenciaMotivo, null); assert.equal(vieja.resumen.tendencia.gasto, 0);
  // un día más tarde (20 oct): la semana anterior no está completa
  assert.equal(armarVista({ guardado: base({ start_time: '2026-10-20T00:00:00-0500' }), filas: filasVieja, rango: '7d', hoy, hayCifras: true }).resumen.tendenciaMotivo, 'campaña nueva: sin con qué comparar');
  // sin start_time, vale created_time; sin ninguno de los dos, no se sabe cuándo empezó y no se inventa
  assert.equal(armarVista({ guardado: base({ created_time: '2026-09-01T00:00:00-0500' }), filas: filasVieja, rango: '7d', hoy, hayCifras: true }).resumen.tendenciaMotivo, null);
  assert.match(armarVista({ guardado: base({}), filas: filasVieja, rango: '7d', hoy, hayCifras: true }).resumen.tendenciaMotivo, /sin saber cuándo empezó/);
  // sin cifras de la semana anterior
  assert.equal(armarVista({ guardado: base({ created_time: '2026-09-01T00:00:00-0500' }), filas: [fila('2026-11-01', 5)], rango: '7d', hoy, hayCifras: true }).resumen.tendenciaMotivo, 'sin cifras de la semana anterior');
  // el rango dice exactamente qué días cubre
  const R = rangos(hoy); assert.deepEqual(R['7d'], ['2026-10-26', '2026-11-01']); assert.deepEqual(R['30d'], ['2026-10-03', '2026-11-01']); assert.deepEqual(R.mes, ['2026-11-01', '2026-11-01']); assert.deepEqual(R.hoy, ['2026-11-01', '2026-11-01']);
  assert.deepEqual([nueva.desde, nueva.hasta], ['2026-10-26', '2026-11-01']);
});

test('la vista: estructura, estados, aprendizaje, rechazos con su motivo, cifras por nivel, gasto contra topes y tendencia', () => {
  const hoy = '2026-10-08';
  const guardado = {
    cuenta: { id: 'act_1001', name: 'PanaClaw Ads', account_status: 1, currency: 'USD', timezone_name: 'America/Panama', amount_spent: '12345', spend_cap: '0', balance: '500' },
    campanas: [{ id: 'C1', name: 'Mensajes · AO:b1', objective: 'OUTCOME_ENGAGEMENT', effective_status: 'ACTIVE', daily_budget: '1500', spend_cap: '15000', created_time: '2026-09-01T10:00:00-0500' }, { id: 'C2', name: 'Vieja', objective: 'OUTCOME_TRAFFIC', effective_status: 'PAUSED' }],
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

// ---------------------------------------------------------------- Fase A3 (9 oct 2026): el borrador de campaña

const AHORA = Date.parse('2026-10-09T15:00:00Z');
const OK_CUENTAS = { pagina: 'P1', instagram: 'IG1' }, IMAGEN = () => ({ kind: 'image' });
const tres = [1, 2, 3].map(i => ({ id: `k${i}`, media: `m${i}`, formato: i === 3 ? '9:16' : '1:1', texto: `Escríbenos ${i}` }));

test('A3: los valores por defecto del plan (§12) — «que me escriban» por WhatsApp si hay número, si no por Instagram; Advantage+ en Panamá, 18+', () => {
  const b = borradorPorDefecto({ ajustes: { whatsapp: '50760001111' }, ahora: AHORA });
  assert.equal(b.objetivo, 'mensajes'); assert.equal(b.destino, 'whatsapp'); assert.equal(b.estado, 'borrador'); assert.equal(b.de, 'dueno');
  assert.deepEqual(b.publico, { modo: 'advantage', paises: ['PA'], radio: null, edadMin: 18, edadMax: null, intereses: [] });
  assert.deepEqual(b.mejoras, { texto: false, retoques: true, recorte: true, plantilla: false }, 'solo las que no tocan el texto');
  assert.equal(borradorPorDefecto({ ajustes: {} }).destino, 'instagram');
  for (const k of ['id', 'nombre', 'de', 'creadoAt', 'actualizadoAt', 'estado', 'objetivo', 'destino', 'publico', 'categoriaEspecial', 'presupuesto', 'inicio', 'fin', 'enlace', 'creativos', 'mejoras', 'validacion', 'meta', 'error']) assert.ok(k in b, `el contrato lleva «${k}»`);
});

test('A3: normalizar — solo cambia lo que llega, nunca el estado ni lo de Meta; lo que no existe es un 400 en palabras', () => {
  const b0 = normalizarBorrador({ nombre: 'Combo · AO:x1', presupuesto: { usd: 'US$7,50' }, creativos: tres }, null, { ahora: AHORA });
  assert.equal(b0.nombre, 'Combo', 'la etiqueta la pone la oficina'); assert.equal(b0.presupuesto.usd, 7.5); assert.deepEqual(b0.creativos.map(c => c.id), ['k1', 'k2', 'k3']);
  const b1 = normalizarBorrador({ objetivo: 'web', estado: 'creado', meta: { campana: 'X' }, validacion: { ok: true } }, { ...b0, validacion: { ok: true } }, { ahora: AHORA });
  assert.equal(b1.estado, 'borrador'); assert.equal(b1.meta, null); assert.equal(b1.validacion, null, 'otro borrador: la validación de antes no vale'); assert.equal(b1.destino, null, 'web no tiene destino de mensajes');
  for (const [e, re] of [[{ objetivo: 'likes' }, /objetivo es uno de/], [{ destino: 'telegram' }, /whatsapp, instagram o messenger/], [{ categoriaEspecial: 'CASINO' }, /categoría especial/], [{ presupuesto: { tipo: 'semanal' } }, /diario.*total/], [{ fin: 'mañana' }, /no se entiende/], [{ creativos: [{ formato: '16:9' }] }, /1:1, 4:5 o 9:16/], [{ creativos: Array(11).fill({}) }, /Como mucho 10/]]) {
    assert.throws(() => normalizarBorrador(e, null, { ahora: AHORA }), err => err instanceof ErrorBorrador && err.status === 400 && re.test(err.message), JSON.stringify(e));
  }
  const fallo = normalizarBorrador({ nombre: 'Otra' }, { ...b0, estado: 'fallo', error: 'x' }, { ahora: AHORA });
  assert.equal(fallo.estado, 'borrador', 'cambiarlo tras un fallo lo deja listo para crear'); assert.equal(fallo.error, null);
});

test('A3: la tabla de combinaciones — objetivo ↔ objective ↔ optimization_goal ↔ destination_type ↔ botón', () => {
  assert.deepEqual(Object.keys(COMBINACIONES), ['mensajes', 'web', 'ventas', 'contactos', 'conocer']);
  const w = combinacion('mensajes', 'whatsapp');
  assert.equal(w.objective, 'OUTCOME_ENGAGEMENT'); assert.equal(w.optimization_goal, 'CONVERSATIONS'); assert.equal(w.destination_type, 'WHATSAPP'); assert.equal(w.app_destination, 'WHATSAPP'); assert.deepEqual(w.pide, ['whatsapp']);
  assert.equal(combinacion('mensajes', 'instagram').destination_type, 'INSTAGRAM_DIRECT'); assert.equal(combinacion('mensajes', 'messenger').destination_type, 'MESSENGER');
  assert.equal(combinacion('mensajes', null), null, 'mensajes sin destino no existe');
  assert.equal(combinacion('web').objective, 'OUTCOME_TRAFFIC'); assert.equal(combinacion('ventas').objective, 'OUTCOME_SALES'); assert.equal(combinacion('contactos').objective, 'OUTCOME_LEADS'); assert.equal(combinacion('conocer').objective, 'OUTCOME_AWARENESS');
  assert.deepEqual(combinacion('ventas').pide, ['pixel', 'enlace']); assert.deepEqual(combinacion('web').pide, ['enlace']);
  assert.equal(TODAS_LAS_COMBINACIONES().length, 7);
  for (const c of TODAS_LAS_COMBINACIONES()) { assert.ok(c.llamadas.length, c.objetivo); assert.equal(c.billing_event, 'IMPRESSIONS'); assert.notEqual(c.verificado, true, 'nada está verificado del todo todavía: lo dice la validación'); }
});

test('A3: validar — los problemas en palabras y por campo; lo que falta en Ajustes; los creativos de la galería', () => {
  const v = (e, o = {}) => validarBorrador(normalizarBorrador(e, null, { ahora: AHORA, ajustes: o.ajustes || {} }), { ajustes: o.ajustes || {}, cuentas: o.cuentas || OK_CUENTAS, medio: o.medio || IMAGEN, ahora: AHORA });
  const t = r => r.problemas.filter(p => p.nivel === 'error').map(p => p.texto).join(' | ');
  assert.match(t(v({})), /Faltan creativos: Meta recomienda 3 a 6/);
  assert.match(t(v({ destino: 'whatsapp', creativos: tres })), /número de WhatsApp Business en Ajustes/);
  assert.match(t(v({ objetivo: 'ventas', creativos: tres })), /necesita el píxel/); assert.match(t(v({ objetivo: 'ventas', creativos: tres })), /dirección de tu web/);
  assert.match(t(v({ objetivo: 'web', enlace: 'http://x.com', creativos: tres })), /https:\/\//);
  assert.match(t(v({ presupuesto: { usd: 0.5 }, creativos: tres })), /El presupuesto diario mínimo es US\$1/);
  assert.match(t(v({ inicio: '2026-10-20', fin: '2026-10-15', creativos: tres })), /La fecha de fin es anterior al inicio/);
  assert.match(t(v({ presupuesto: { tipo: 'total', usd: 50 }, creativos: tres })), /presupuesto total necesita fecha de fin/);
  assert.match(t(v({ creativos: tres }, { cuentas: {} })), /Falta la página de Facebook/);
  assert.match(t(v({ creativos: tres }, { medio: id => (id === 'm2' ? null : id === 'm3' ? { kind: 'audio' } : { kind: 'image' }) })), /creativo 2 ya no está en la galería.*creativo 3 es un audio/);
  assert.match(t(v({ objetivo: 'web', enlace: 'https://x.com', creativos: [{ ...tres[0], llamada: 'WHATSAPP_MESSAGE' }] })), /El botón «Enviar WhatsApp» no vale para «Visitas a mi web»/);
  const bien = v({ destino: 'instagram', creativos: tres });
  assert.equal(bien.ok, true, t(bien)); assert.ok(bien.problemas.every(p => p.campo && p.texto && ['error', 'aviso'].includes(p.nivel)));
  assert.ok(v({ destino: 'instagram', creativos: tres.slice(0, 1) }).problemas.some(p => p.nivel === 'aviso' && /Con 1 creativo/.test(p.texto)));
  assert.equal(v({ destino: 'instagram', creativos: tres.slice(0, 1) }).ok, true, 'uno o dos creativos se avisan, no frenan');
});

test('A3: el costo máximo — al día, en total y la campaña con su spend_cap como techo; sin fin, sin límite', () => {
  const b = normalizarBorrador({ presupuesto: { usd: 10 }, inicio: '2026-10-10T00:00:00Z', fin: '2026-10-17T00:00:00Z' }, null, { ahora: AHORA });
  assert.deepEqual(costoMaximo(b, { ajustes: { topeCampana: 150 }, ahora: AHORA }), { dia: 10, total: 70, campana: 70 });
  assert.deepEqual(costoMaximo({ ...b, fin: null }, { ajustes: { topeCampana: 150 }, ahora: AHORA }), { dia: 10, total: Infinity, campana: 150 });
  const v = validarBorrador({ ...b, fin: null, creativos: tres }, { ajustes: { topeCampana: 50, topeDiario: 5 }, cuentas: OK_CUENTAS, medio: IMAGEN, ahora: AHORA });
  assert.equal(v.costoMax.total, null); assert.equal(v.costoMax.sinLimite, true);
  assert.ok(v.problemas.some(p => /tope diario es US\$5: se crea en pausa, pero no se podrá activar así/.test(p.texto)));
  assert.ok(v.problemas.some(p => /Sin fecha de fin gastaría sin límite/.test(p.texto)));
  assert.match(lineaBorrador({ ...b, creativos: tres }), /^b\w+ · «Campaña nueva» \(Que me escriban por Instagram Direct\) · US\$10 al día · 3 creativo\(s\) · de dueno · borrador$/);
});
