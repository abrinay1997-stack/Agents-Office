// Agents Office — Fase 11.0 (carril K): dinero de una serie, puro. Reservar -> ejecutar -> liquidar al máximo del proveedor (plan K §13.2).
// Todo en micro-USD enteros (1e6 = US$1): sin errores de coma flotante. Sin E/S, sin reloj, sin llamar a ningún modelo.
import { weightOf } from './estudio-pesos.mjs'; // única fuente del peso de cada medio (video 5, música 3, el resto 1)

export const CONFIG_SERIE = Object.freeze({
  topeSerieUsd: 10, // por serie; lo cambia el dueño (Ajustes), no es una constante enterrada
  topeMesCarruselesUsd: 45, // por mes, solo carruseles
  reintentosMax: 1, // un reintento automático con más fidelidad (plan §4.5)
  reservaCupoFueraDeSeries: 0.25, // la serie nunca usa más del 75 % del cupo diario
});
export const usd2u = usd => Math.round((+usd || 0) * 1e6);
export const u2usd = u => +(u / 1e6).toFixed(6);
const pos = x => Math.max(0, usd2u(x));
const cfg = c => ({ ...CONFIG_SERIE, ...(c || {}) });

// Costo de un plano en micro-USD. Máximo = lo peor que el proveedor puede cobrar: (generación + QA + VISIÓN) por cada intento (cada intento se revisa), más la
// edición con su propia revisión de visión (11.4: lo mostrado incluye la visión), y la descripción una vez.
export function costoPlano(p, { reintentos = 0 } = {}) {
  const veces = 1 + Math.max(0, reintentos | 0), vision = pos(p?.vision), edicion = pos(p?.edicion);
  return (pos(p?.generacion) + pos(p?.qa) + vision) * veces + edicion + (edicion > 0 ? vision : 0) + pos(p?.descripcion);
}
export const costoMaximoPlano = (p, c) => costoPlano(p, { reintentos: cfg(c).reintentosMax });
export function estimarSerie(precios, c) { // precios: un objeto por plano {generacion, edicion, vision, qa, descripcion} (USD)
  const l = Array.isArray(precios) ? precios : [];
  const esperado = l.reduce((a, p) => a + costoPlano(p), 0), maximo = l.reduce((a, p) => a + costoMaximoPlano(p, c), 0);
  return { planos: l.length, esperadoUsd: u2usd(esperado), maximoUsd: u2usd(maximo), esperado, maximo };
}
export function cabeEnTope(est, topeUsd) { return !!est && est.maximo <= usd2u(topeUsd); } // lo que se reserva es el máximo, no el esperado

// Libro de la serie. Estados de una línea: reservado -> liquidado | liberado | incierto (un envío que pudo cobrarse y no se sabe).
export const nuevoLibro = (topeUsd = CONFIG_SERIE.topeSerieUsd) => ({ tope: pos(topeUsd), lineas: {} });
const suma = (libro, estado) => Object.values(libro.lineas).filter(l => l.estado === estado).reduce((a, l) => a + (estado === 'liquidado' ? l.real : l.max), 0);
export const resumenLibro = libro => {
  const reservado = suma(libro, 'reservado'), gastado = suma(libro, 'liquidado'), incierto = suma(libro, 'incierto');
  return { tope: libro.tope, reservado, gastado, incierto, disponible: libro.tope - reservado - gastado - incierto, excedido: Object.values(libro.lineas).some(l => l.excedio) };
};
const con = (libro, clave, linea) => ({ ...libro, lineas: { ...libro.lineas, [clave]: linea } });

// Reservar ANTES de llamar al motor. Idempotente por clave (misma clave = misma reserva). `mes` y `dia` son opcionales y se comprueban si llegan.
export function reservar(libro, clave, maxUsd, { mes, dia, kind = 'image', n = 1 } = {}) {
  if (typeof clave !== 'string' || !clave) return { ok: false, codigo: 'clave', motivo: 'falta la clave de idempotencia' };
  const max = pos(maxUsd), ya = libro.lineas[clave];
  if (ya) return ya.estado === 'liberado' ? { ok: false, codigo: 'liberada', motivo: 'esa reserva ya se liberó; usa otro intento' } : { ok: true, libro, repetida: true };
  const r = resumenLibro(libro);
  if (max > r.disponible) return { ok: false, codigo: 'tope_serie', motivo: `no cabe en el tope de la serie (US$${u2usd(libro.tope)}): quedan US$${u2usd(Math.max(0, r.disponible))} y el paso puede costar hasta US$${u2usd(max)}` };
  if (mes && max > usd2u(mes.topeUsd) - usd2u(mes.gastadoUsd)) return { ok: false, codigo: 'tope_mes', motivo: `no cabe en el tope del mes (US$${mes.topeUsd}) de carruseles` };
  if (dia) { const v = cupoDia({ ...dia, kind, n }); if (!v.ok) return { ok: false, codigo: 'cupo_dia', motivo: v.motivo }; }
  return { ok: true, libro: con(libro, clave, { estado: 'reservado', max }) };
}
// Liquidar con el costo real. Un real mayor que lo reservado se anota (`excedio`) y NUNCA se oculta.
export function liquidar(libro, clave, realUsd) {
  const l = libro.lineas[clave];
  if (!l) return { ok: false, codigo: 'sin_reserva', motivo: 'no hay reserva para esa clave' };
  if (l.estado === 'liquidado') return { ok: true, libro, repetida: true };
  const real = pos(realUsd);
  return { ok: true, libro: con(libro, clave, { estado: 'liquidado', max: l.max, real, excedio: real > l.max }) };
}
export function liberar(libro, clave) { // el paso no llegó a salir (se sabe seguro): devuelve la reserva
  const l = libro.lineas[clave];
  if (!l || l.estado !== 'reservado') return { ok: false, codigo: 'no_reservado', motivo: 'solo se libera una reserva viva' };
  return { ok: true, libro: con(libro, clave, { estado: 'liberado', max: l.max }) };
}
export function marcarIncierto(libro, clave) { // envío a motor de pago sin respuesta: «puede haberse cobrado»; sigue contando y pide decisión
  const l = libro.lineas[clave];
  if (!l || l.estado !== 'reservado') return { ok: false, codigo: 'no_reservado', motivo: 'solo un paso reservado puede quedar incierto' };
  return { ok: true, libro: con(libro, clave, { estado: 'incierto', max: l.max }) };
}
export const resolverIncierto = (libro, clave, huboCobro, realUsd = 0) => { // decisión del dueño
  const l = libro.lineas[clave];
  if (!l || l.estado !== 'incierto') return { ok: false, codigo: 'no_incierto', motivo: 'ese paso no está en duda' };
  return { ok: true, libro: con(libro, clave, huboCobro ? { estado: 'liquidado', max: l.max, real: pos(realUsd) || l.max, excedio: pos(realUsd) > l.max } : { estado: 'liberado', max: l.max }) };
};

// Cupo diario: la serie no usa más de (1 - reserva) del límite del día; el resto queda para lo manual (plan §13.2). limit 0 = sin tope.
export function cupoSerieDia(limit, c) { const l = +limit || 0; return l ? Math.floor(l * (1 - cfg(c).reservaCupoFueraDeSeries)) : 0; }
export function cupoDia({ limit, usadoSeries = 0, kind = 'image', n = 1, config }) {
  const tope = cupoSerieDia(limit, config);
  if (!tope) return { ok: true, sinTope: true };
  const peso = weightOf(kind) * Math.max(1, n | 0);
  return usadoSeries + peso <= tope ? { ok: true, quedan: tope - usadoSeries - peso } : { ok: false, codigo: 'cupo_dia', motivo: `el cupo diario de series (${tope} de ${limit}) no alcanza; se reanuda al cambiar el día` };
}
