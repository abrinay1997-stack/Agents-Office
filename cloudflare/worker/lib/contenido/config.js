// Los ajustes de Contenido en la nube (en la oficina local: office.config.json → contenido, editados en Ajustes → Contenido).
// Viven en `docs` con la clave `config.contenido`. La pestaña de Ajustes de la nube es de otra fase (6); mientras tanto un administrador los cambia con
// PUT /api/contenido/config (solo existe en la nube) y los lee GET /api/contenido/config. Por defecto, SIMULACRO: nada sale de verdad hasta que el dueño diga «real».
import { leerDoc, guardarDoc } from '../almacen.js';
import { REDES } from '../../../../contenido/piezas-core.mjs';
import { ZONA_POR_DEFECTO, zonaValida } from '../zona.js';
import { ajustesHistorias, MAX_POR_DIA } from '../../../../contenido/historias-auto.mjs';

const ajustesDeHistorias = g => { const a = ajustesHistorias(g); return { historiasAuto: a.activo, historiasHora: a.hora, historiasPorDia: a.porDia, historiasSinOk: a.sinOk }; };

export const CLAVE_CONFIG = 'config.contenido';
export const MODOS = ['apagado', 'simulacro', 'real'];
export const CONDUCTORES = ['metricool', 'meta'];
export const DEFECTO = Object.freeze({ modo: 'simulacro', conductor: 'metricool', entregarHorasAntes: 24, metaPagina: '', redes: ['instagram', 'facebook'], departamentos: ['marketing', 'delivery'], zona: ZONA_POR_DEFECTO, bandejaFuente: 'auto', publicarYa: false });

/** Lo guardado, con lo que falte puesto a su valor de siempre y lo que no valga descartado. */
export function completar(guardado) {
  const g = guardado && typeof guardado === 'object' ? guardado : {};
  const redes = Array.isArray(g.redes) ? g.redes.filter(r => REDES.includes(r)) : [];
  const h = Number(g.entregarHorasAntes);
  return {
    modo: MODOS.includes(g.modo) ? g.modo : DEFECTO.modo,
    conductor: CONDUCTORES.includes(g.conductor) ? g.conductor : DEFECTO.conductor,
    entregarHorasAntes: Number.isFinite(h) && h >= 0 ? Math.min(h, 720) : DEFECTO.entregarHorasAntes,
    metaPagina: /^[A-Za-z0-9_]{1,40}$/.test(String(g.metaPagina || '')) ? String(g.metaPagina) : '',
    redes: redes.length ? [...new Set(redes)] : [...DEFECTO.redes],
    departamentos: Array.isArray(g.departamentos) && g.departamentos.length ? g.departamentos.filter(d => /^[a-z]{2,20}$/.test(d)) : [...DEFECTO.departamentos],
    zona: zonaValida(g.zona) ? g.zona : DEFECTO.zona,
    bandejaFuente: ['auto', 'meta', 'metricool', 'ambas'].includes(g.bandejaFuente) ? g.bandejaFuente : DEFECTO.bandejaFuente,
    ...ajustesDeHistorias(g), // 11 nov 2026: historias automáticas (apagadas hasta que el dueño las encienda)
    publicarYa: g.publicarYa === true, // CON-04: «Publicar ahora», apagado hasta que el dueño lo encienda
  };
}
export async function leerConfig(db) { return completar((await leerDoc(db, CLAVE_CONFIG, {})).valor); }

/** Valida un cambio de PUT /api/contenido/config (solo lo que viene) → { ok, valor } | { error } en palabras. */
export function validarCambio(entrada, actual) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return { error: 'manda un objeto con los ajustes que cambian' };
  const ok = ['modo', 'conductor', 'entregarHorasAntes', 'metaPagina', 'redes', 'departamentos', 'zona', 'bandejaFuente', 'publicarYa', 'historiasAuto', 'historiasHora', 'historiasPorDia', 'historiasSinOk'];
  const raro = Object.keys(entrada).find(k => !ok.includes(k)); if (raro) return { error: `«${raro}» no es un ajuste de Contenido (son: ${ok.join(', ')})` };
  if ('modo' in entrada && !MODOS.includes(entrada.modo)) return { error: `el modo es uno de: ${MODOS.join(', ')}` };
  if ('conductor' in entrada && !CONDUCTORES.includes(entrada.conductor)) return { error: `el conductor es uno de: ${CONDUCTORES.join(', ')}` };
  if ('entregarHorasAntes' in entrada && !(Number(entrada.entregarHorasAntes) >= 0 && Number(entrada.entregarHorasAntes) <= 720)) return { error: 'entregarHorasAntes va de 0 a 720' };
  if ('metaPagina' in entrada && entrada.metaPagina !== '' && !/^[A-Za-z0-9_]{1,40}$/.test(String(entrada.metaPagina))) return { error: 'metaPagina es el número de la página de Facebook (o vacío)' };
  if ('redes' in entrada && (!Array.isArray(entrada.redes) || !entrada.redes.length || entrada.redes.some(r => !REDES.includes(r)))) return { error: `redes es una lista de: ${REDES.join(', ')}` };
  if ('departamentos' in entrada && (!Array.isArray(entrada.departamentos) || entrada.departamentos.some(d => !/^[a-z]{2,20}$/.test(d)))) return { error: 'departamentos es una lista de claves como marketing, delivery' };
  if ('zona' in entrada && !zonaValida(entrada.zona)) return { error: 'zona es un nombre de zona horaria como America/Panama' };
  if ('bandejaFuente' in entrada && !['auto', 'meta', 'metricool', 'ambas'].includes(entrada.bandejaFuente)) return { error: 'bandejaFuente es: auto, meta, metricool o ambas' };
  if ('publicarYa' in entrada && typeof entrada.publicarYa !== 'boolean') return { error: 'publicarYa es verdadero o falso' };
  for (const k of ['historiasAuto', 'historiasSinOk']) if (k in entrada && typeof entrada[k] !== 'boolean') return { error: `${k} es verdadero o falso` };
  if ('historiasHora' in entrada && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(entrada.historiasHora))) return { error: 'historiasHora es una hora como 18:00' };
  if ('historiasPorDia' in entrada && !(Number(entrada.historiasPorDia) >= 1 && Number(entrada.historiasPorDia) <= MAX_POR_DIA)) return { error: `historiasPorDia va de 1 a ${MAX_POR_DIA}` };
  return { ok: true, valor: completar({ ...actual, ...entrada }) };
}
export async function guardarConfig(db, valor) { await guardarDoc(db, CLAVE_CONFIG, valor); return valor; }
