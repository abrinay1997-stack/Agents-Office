// Series en la nube, N0: las decisiones puras de la bomba (series-bomba-core.mjs) y el fuzz del libro de dinero. Sin red, sin reloj, sin hora del día: todo el tiempo llega como número.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planificarPaso, decidirResolucion, cerrarSerie, pagadoDe, serieValida, normalizarSerie, AUTORIZACION_MS } from '../series-bomba-core.mjs';
import { hashEscaleta, nuevoLibro, resumenLibro, reservar, liquidar, liberar, marcarIncierto, resolverIncierto, usd2u } from '../serie-core.mjs';

const T0 = 1_800_000_000_000; // un instante fijo cualquiera
const plano = (n, estado = 'previsto') => ({ n, rol: 'desarrollo', descripcion: '', refs: [], prompt_exacto: `plano ${n}`, texto_en_imagen: '', modelo: 'prueba', ajustes: {}, semilla: null, clave: false, estado, motivo: null, versiones: [], version: 0, aprobada_version: null });
const serie = (id, estado, estados, extra = {}) => ({ id, estado, creada: T0, titulo: id, brief: { formato: 'carrusel' }, biblia_version: 1, modelo_unico: 'prueba', escaleta: estados.map((e, i) => plano(i + 1, e)), intentos: {}, fallos: {}, pasos: {}, libro: null, ...extra });
const autorizada = (s, en = T0) => ({ ...s, autorizado: { hash: hashEscaleta(s), topeMax: 10, en } });
const ctx = (o = {}) => ({ activo: true, ahora: T0 + 1000, autorizacionMs: AUTORIZACION_MS, concurrencia: 1, ...o });

test('planificarPaso: con el flag apagado pausa lo que corría sin plano en el aire y nunca da un paso de gasto', () => {
  const a = autorizada(serie('a', 'corriendo', ['previsto', 'previsto'])), b = autorizada(serie('b', 'muestra', ['previsto', 'corriendo'])), c = serie('c', 'pausado', ['previsto']);
  const r = planificarPaso([a, b, c], ctx({ activo: false }));
  assert.equal(r.tipo, 'pausar_todas'); assert.deepEqual(r.ids, ['a']); assert.match(r.motivo, /vuelve a pedir el clic/);
});
test('planificarPaso: sin autorización NO hay gasto y con ella sí; una escaleta cambiada pausa', () => {
  const s = serie('a', 'corriendo', ['previsto', 'previsto']);
  assert.equal(planificarPaso([s], ctx()).tipo, 'pausar', 'sin autorización guardada no hay paso de gasto');
  const buena = autorizada(s), g = planificarPaso([buena], ctx());
  assert.equal(g.tipo, 'gasto'); assert.equal(g.id, 'a'); assert.equal(g.paso.n, 1); assert.equal(g.paso.intento, 1);
  const cambiada = { ...buena, escaleta: buena.escaleta.map((p, i) => (i === 0 ? { ...p, prompt_exacto: 'otro' } : p)) };
  const r = planificarPaso([cambiada], ctx()); assert.equal(r.tipo, 'pausar'); assert.match(r.motivo, /escaleta cambió/);
});
test('planificarPaso: concurrencia, caducidad (6 h) y turno (la muestra lista no quita el turno)', () => {
  const a = autorizada(serie('a', 'corriendo', ['corriendo', 'previsto']));
  assert.equal(planificarPaso([a], ctx()).tipo, 'nada', 'con un plano en el aire y concurrencia 1 no sale otro');
  const vieja = autorizada(serie('v', 'corriendo', ['previsto']), T0), pasadas = ctx({ ahora: T0 + AUTORIZACION_MS + 1 });
  assert.deepEqual(planificarPaso([vieja], pasadas), { tipo: 'caducada', id: 'v', motivo: 'la autorización caducó (pasaron más de 6 horas): vuelve a pedir el clic para seguir' });
  assert.equal(planificarPaso([vieja], ctx({ ahora: T0 + AUTORIZACION_MS })).tipo, 'gasto', 'justo a las 6 h todavía vale');
  const conAire = autorizada(serie('w', 'corriendo', ['corriendo', 'previsto']), T0);
  assert.equal(planificarPaso([conAire], { ...pasadas, concurrencia: 5 }).tipo, 'nada', 'caducada pero con un plano en el aire: se espera, no se pausa a ciegas');
  const lista = autorizada(serie('m', 'muestra', ['listo', 'listo', 'listo', 'previsto']), T0), otra = autorizada({ ...serie('z', 'corriendo', ['previsto']), creada: T0 + 5 });
  const r = planificarPaso([{ ...lista, muestra_lista: true }, otra], ctx()); assert.equal(r.tipo, 'gasto'); assert.equal(r.id, 'z');
  assert.deepEqual(planificarPaso([lista], ctx()), { tipo: 'muestra_lista', id: 'm' });
});
test('planificarPaso: sin planos previstos termina (y cerrarSerie hace la transición); nunca con un plano en el aire', () => {
  const s = autorizada(serie('f', 'muestra', ['listo', 'revisar']));
  assert.deepEqual(planificarPaso([s], ctx()), { tipo: 'terminar', id: 'f' });
  const c = cerrarSerie(s, T0 + 9); assert.equal(c.estado, 'hecho'); assert.equal(c.autorizado, null); assert.equal(c.fin, T0 + 9);
  assert.equal(cerrarSerie({ ...s, autorizado: null }, T0), undefined, 'sin autorización una muestra no pasa a corriendo');
  assert.equal(planificarPaso([autorizada(serie('g', 'corriendo', ['listo', 'corriendo']))], ctx({ concurrencia: 3 })).tipo, 'nada');
});
test('planificarPaso es pura: no cambia lo que recibe', () => {
  const s = autorizada(serie('a', 'corriendo', ['previsto'])), foto = JSON.stringify(s); planificarPaso([s], ctx()); assert.equal(JSON.stringify(s), foto);
});

const job = (o) => ({ state: 'failed', items: [], cost: 0, causa: '', errorClass: '', error: 'x', ...o });
const base = { n: 2, hayPaso: true, apuntoJob: true, pagado: true, genUsd: 0.04, fallos: 0, reintentosMax: 1, cancelada: false };
test('decidirResolucion: lo que no salió se libera; lo que pudo cobrarse en un motor de pago queda incierto, nunca liberado', () => {
  assert.equal(decidirResolucion({ ...base, hayPaso: false, job: null }).libro, null);
  const antes = decidirResolucion({ ...base, apuntoJob: false, job: null }); assert.equal(antes.libro, 'liberar'); assert.equal(antes.devolverUso, 1);
  const sinJob = decidirResolucion({ ...base, job: null }); assert.equal(sinJob.libro, 'incierto'); assert.equal(sinJob.plano.estado, 'revisar'); assert.match(sinJob.pausa, /puede haberse cobrado/);
  assert.equal(decidirResolucion({ ...base, pagado: false, job: null }).libro, 'liberar', 'un motor gratis sin trabajo se libera');
  const d = decidirResolucion({ ...base, job: job({ state: 'done', items: ['a.png'], cost: 0 }) }); assert.equal(d.libro, 'liquidar'); assert.equal(d.real, 0.04, 'en pago un hecho sin costo liquida lo estimado');
  assert.equal(decidirResolucion({ ...base, pagado: false, job: job({ state: 'done', items: ['a.png'], cost: 0 }) }).real, 0);
  assert.equal(decidirResolucion({ ...base, job: job({ causa: 'previo' }) }).libro, 'liberar');
  assert.equal(decidirResolucion({ ...base, job: job({ causa: 'previo', remote: 'abc' }) }).libro, 'incierto', 'si el proveedor ya tomó el pedido no es previo');
  assert.equal(decidirResolucion({ ...base, job: job({ causa: 'previo', aceptado: true }) }).libro, 'incierto');
  assert.equal(decidirResolucion({ ...base, job: job({ causa: '' }) }).libro, 'incierto', 'causa desconocida en pago = incierto');
  assert.equal(decidirResolucion({ ...base, job: job({ causa: 'cancelado' }) }).libro, 'incierto', 'cancelado sin ser previo a la cola: puede haberse cobrado');
  assert.equal(decidirResolucion({ ...base, job: job({ causa: 'cancelado_en_cola' }) }).libro, 'liberar');
});
test('decidirResolucion en un motor gratis: reintento una vez, luego «revisar»; sin saldo pausa sin contar fallo', () => {
  const g = { ...base, pagado: false };
  const t1 = decidirResolucion({ ...g, job: job({ errorClass: 'red' }) }); assert.equal(t1.plano.estado, 'previsto'); assert.equal(t1.contarFallo, true); assert.equal(t1.pausa, null);
  const t2 = decidirResolucion({ ...g, fallos: 1, job: job({ errorClass: 'red' }) }); assert.equal(t2.plano.estado, 'revisar'); assert.equal(t2.contarFallo, true); assert.match(t2.pausa, /falló/);
  const k = decidirResolucion({ ...g, job: job({ errorClass: 'saldo', error: 'sin crédito' }) }); assert.equal(k.plano.estado, 'previsto'); assert.equal(k.pausa, 'sin crédito'); assert.equal(k.contarFallo, false);
  const o = decidirResolucion({ ...g, job: job({ errorClass: 'contenido' }) }); assert.equal(o.plano.estado, 'revisar'); assert.equal(o.contarFallo, false);
  assert.equal(decidirResolucion({ ...g, cancelada: true, job: job({ errorClass: 'contenido' }) }).plano.estado, 'previsto');
});
test('decidirResolucion (fuzz): en un motor de pago ningún fallo que no sea claramente previo al cobro llega a «liberar»', () => {
  let s = 99; const az = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32, pick = l => l[Math.floor(az() * l.length)];
  for (let i = 0; i < 3000; i++) {
    const j = job({ state: pick(['failed', 'failed', 'error', 'cancelled']), causa: pick(['', 'previo', 'cancelado', 'cancelado_en_cola', 'interrumpido', 'raro']), errorClass: pick(['', 'red', 'key', 'saldo', 'contenido']), remote: pick([null, 'r']), aceptado: pick([undefined, true, false]) });
    const d = decidirResolucion({ ...base, job: j, cancelada: az() < 0.3, fallos: pick([0, 1, 2]) });
    const previo = (j.causa === 'previo' || j.causa === 'cancelado_en_cola') && !j.remote && j.aceptado !== true;
    if (!previo) assert.equal(d.libro, 'incierto', JSON.stringify(j));
    assert.notEqual(d.libro, 'liquidar');
  }
});
test('pagadoDe falla cerrado y la forma de una serie guardada se normaliza', () => {
  for (const e of ['prueba', 'prueba-video', 'local']) assert.equal(pagadoDe(e), false);
  for (const e of [null, undefined, '', 'higgsfield', 'fal', 'desconocido']) assert.equal(pagadoDe(e), true);
  assert.equal(serieValida({ id: 'a b', escaleta: [], estado: 'x' }), false); assert.equal(serieValida({ id: 'a', escaleta: [{}], estado: 'previsto' }), true);
  const n = normalizarSerie({ id: 'a', estado: 'x', escaleta: [{ n: 1, refs: 5 }], pasos: [] }); assert.deepEqual([n.pasos, n.intentos, n.libro, n.escaleta[0].refs, n.escaleta[0].versiones], [{}, {}, null, [], []]);
});

// ---- fuzz del libro: lo reservado + gastado + en duda nunca pasa del tope ----
export function fuzzLibro(semilla, { pasos = 400 } = {}) {
  let s = semilla >>> 0; const az = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32, pick = l => l[Math.floor(az() * l.length)];
  let libro = nuevoLibro(10), n = 0; const topeMes = 45;
  for (let i = 0; i < pasos; i++) {
    const claves = Object.keys(libro.lineas), vivas = claves.filter(c => libro.lineas[c].estado === 'reservado'), dudas = claves.filter(c => libro.lineas[c].estado === 'incierto');
    const op = pick(['res', 'res', 'res', 'liq', 'lib', 'inc', 'res2', 'resolver']);
    if (op === 'res' || op === 'res2') {
      const clave = op === 'res2' && claves.length ? pick(claves) : `s:${++n}:1`, max = +(az() * 4).toFixed(2); // a veces repite una clave (idempotencia)
      const r0 = resumenLibro(libro), r = reservar(libro, clave, max, { mes: { topeUsd: topeMes, gastadoUsd: (r0.reservado + r0.gastado + r0.incierto) / 1e6 }, dia: { limit: 40, usadoSeries: Math.floor(az() * 25) } });
      if (r.ok) libro = r.libro;
    } else if (op === 'liq' && vivas.length) { const c = pick(vivas); libro = liquidar(libro, c, +(libro.lineas[c].max / 1e6 * az()).toFixed(6)).libro; } // el proveedor cobra a lo más el máximo
    else if (op === 'lib' && vivas.length) libro = liberar(libro, pick(vivas)).libro;
    else if (op === 'inc' && vivas.length) libro = marcarIncierto(libro, pick(vivas)).libro;
    else if (op === 'resolver' && dudas.length) { const c = pick(dudas), cobro = az() < 0.5; libro = resolverIncierto(libro, c, cobro, cobro ? +(libro.lineas[c].max / 1e6 * az()).toFixed(6) : 0).libro; }
    const r = resumenLibro(libro);
    assert.ok(r.reservado + r.gastado + r.incierto <= usd2u(10), `semilla ${semilla} paso ${i}: ${r.reservado + r.gastado + r.incierto} > tope`);
    assert.ok(r.disponible >= 0 && !r.excedido);
  }
  return libro;
}
test('fuzz del libro: reservado + gastado + incierto ≤ tope en miles de secuencias (con repetidas, incierto y resolver)', () => {
  for (let semilla = 1; semilla <= 60; semilla++) fuzzLibro(semilla);
});
test('un gasto real MAYOR que lo reservado nunca se oculta: se anota y el libro lo dice', () => {
  let l = nuevoLibro(10); l = reservar(l, 'a:1:1', 1).libro; l = liquidar(l, 'a:1:1', 1.5).libro;
  const r = resumenLibro(l); assert.equal(r.excedido, true); assert.equal(r.gastado, usd2u(1.5));
});
