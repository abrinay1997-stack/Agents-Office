// Lo que pasa DESPUÉS de una foto buena de Analíticas, en la nube (en la oficina local: contenidoAprende y llevarIndicadoresMeta de serve.mjs):
//  · aprender de lo publicado (F4): las notas que usó el agente que escribió una pieza se acercan o se alejan según cómo le fue en las redes
//    (contenido/aprender.mjs, puro → memory.reinforce, idempotente por pieza). La memoria vive en el doc `memory` y las tareas en la colección `tareas`.
//  · los indicadores del dueño (seguidores y alcance de Meta) en «Cómo va el negocio» (doc `kpis`): solo se escriben en los que el dueño TIENE.
// Las dos dependen de módulos de otras fases (tareas y negocio): si todavía no hay tareas o indicadores, no hacen nada y lo dicen; no inventan.
import * as memory from '../../../../memory.mjs';
import { lecciones } from '../../../../contenido/aprender.mjs';
import { emparejar } from '../../../../src/contenido-publicadas.js';
import { kpis as cifrasKpis } from '../../../../src/contenido-cifras.js';
import { num } from '../../../../business.mjs';
import { mutarDoc, leerDoc, listarFilas } from '../almacen.js';

export const INDICADORES_META = [
  { id: 'meta_seguidores', name: 'Seguidores (Instagram + Facebook)', unit: '', better: 'up' },
  { id: 'meta_alcance', name: 'Alcance de los últimos 30 días', unit: '', better: 'up' },
];
const dia = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Las piezas con lo que la cola sabe de ellas y lo que Analíticas leyó de Meta, emparejado. */
export function conCifras({ piezas, salidaDe, publicaciones }) {
  const ps = piezas.map(p => ({ ...p, salida: salidaDe(p.id) }));
  return { piezas: ps, ...emparejar(ps, publicaciones) };
}

/** Enseña a la memoria con lo publicado. → cuántas lecciones aplicó (0 si no hay cifras, tareas o notas citadas). */
export async function aprenderDeLoPublicado({ db, piezas, porPieza, ahora = Date.now }) {
  if (!Object.keys(porPieza).length) return 0;
  const tareas = await listarFilas(db, 'tareas', { limite: 2000 }); // las escribe la fase de tareas; antes de ella no hay con qué atribuir
  if (!tareas.length) return 0;
  const ls = lecciones({ piezas, porPieza, tareas, citadas: t => ({ cited: memory.cited(t.result, t.read || []), read: t.read || [] }), ahora: ahora() });
  if (!ls.length) return 0;
  await mutarDoc(db, 'memory', memory.emptyMemory(), mem => { for (const l of ls) memory.reinforce(mem, l); return mem; });
  return ls.length;
}

/** Seguidores y alcance de Meta a «Cómo va el negocio», solo en los indicadores que el dueño tiene; una foto repetida el mismo día no suma un punto más. */
export async function llevarIndicadoresMeta({ db, serie, publicaciones, ahora = Date.now }) {
  const hoy = dia(ahora()), d = new Date(ahora()); d.setDate(d.getDate() - 30);
  const k = cifrasKpis({ serie, publicaciones }, { desde: dia(d.getTime()), hasta: hoy });
  const valores = { meta_seguidores: k.seguidores.valor, meta_alcance: k.alcance.valor };
  const { valor } = await leerDoc(db, 'kpis', null); if (!valor?.defs) return 0;
  let n = 0;
  await mutarDoc(db, 'kpis', { defs: [], values: {} }, kp => {
    n = 0;
    for (const def of INDICADORES_META) {
      const v = valores[def.id]; if (v == null || !kp.defs.some(x => x.id === def.id)) continue;
      const last = (kp.values[def.id] || []).at(-1);
      if (last && last.v === v && dia(last.t) === hoy) continue;
      const nv = num(v); if (nv === null) continue;
      (kp.values[def.id] ||= []).push({ t: ahora(), v: nv, from: 'Meta' }); kp.values[def.id] = kp.values[def.id].slice(-400); n++;
    }
    return kp;
  });
  return n;
}

export const indicadoresEstado = async db => { const kp = (await leerDoc(db, 'kpis', { defs: [] })).valor; return Object.fromEntries(INDICADORES_META.map(d => [d.id.replace('meta_', ''), (kp.defs || []).some(x => x.id === d.id)])); };
/** El botón «Llevar a Cómo va el negocio»: los define (sin tocar los que el dueño ya tenga). → { creados } */
export async function crearIndicadores(db) {
  const creados = [];
  await mutarDoc(db, 'kpis', { defs: [], values: {} }, kp => { creados.length = 0; kp.defs ||= []; kp.values ||= {}; for (const def of INDICADORES_META) if (!kp.defs.some(x => x.id === def.id)) { kp.defs.push(def); creados.push(def.id); } return kp; });
  return { creados };
}
