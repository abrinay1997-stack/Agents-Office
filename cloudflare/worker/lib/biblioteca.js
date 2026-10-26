// La Biblioteca de habilidades en la nube (biblioteca.mjs en la oficina local). Una sola lógica: biblioteca-core.mjs (qué habilidades tiene cada puesto, cuál encaja con una tarea, qué dice el prompt).
//   · las de FÁBRICA vienen del activo /semilla/biblioteca/ (se actualizan con cada despliegue; no ocupan D1);
//   · las del DUEÑO (las de su Cerebro, que sube la migración) son filas de la colección `biblioteca` y ganan a la de fábrica con el mismo id;
//   · una skill del dueño (colección `skills`, origen «brain») con el mismo id también reemplaza a la de fábrica, como en local.
import { armarBiblioteca, listarHabilidades, textoHabilidad, buscarReferencia, textoReferencia, errorSinReferencia, contextoMarketingTexto } from '../../../biblioteca-core.mjs';
import { DEPT_KEYS } from '../../../src/data.js';
import { indiceBiblioteca, textoHabilidadDeFabrica } from './semilla.js';
import { listarFilas } from './almacen.js';
import { cargarRoster } from './tareas/roster.js';

export const COLECCION = 'biblioteca';
export { contextoMarketingTexto };

/** La biblioteca armada para esta oficina. → { b, propias: Map(id → fila del dueño) } (b = el objeto de biblioteca-core). `agentes`: el roster (para no leerlo dos veces). */
export async function cargarBibliotecaNube({ env, db, agentes = null }) {
  const [indice, filas, skills, roster] = await Promise.all([indiceBiblioteca(env), listarFilas(db, COLECCION, { limite: 200 }), listarFilas(db, 'skills', { limite: 200 }), agentes ? null : cargarRoster(db)]);
  const habilidades = (indice?.habilidades || []).map((h) => ({ ...h, fuente: 'oficina', evals: !!h.evals }));
  const propias = new Map();
  for (const f of filas) {
    if (!f || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(String(f.id))) continue;
    propias.set(f.id, f);
    const i = habilidades.findIndex((h) => h.id === f.id), previa = i >= 0 ? habilidades[i] : null;
    const h = { id: f.id, titulo: String(f.titulo || f.id), description: String(f.description || '').slice(0, 400), area: f.area || 'estrategia', departments: f.departments || [], agents: f.agents || [], origen: f.origen || '', palabras: f.palabras || [],
      referencias: (f.referencias || []).map((r) => ({ nombre: r.nombre, archivo: r.archivo, chars: r.chars || 0 })), coleccion: previa?.coleccion || 'propia', fuente: 'cerebro', evals: false, chars: String(f.cuerpo || '').length };
    if (i >= 0) habilidades[i] = h; else habilidades.push(h);
  }
  const skillsDelDueno = skills.filter((s) => s && s.source === 'brain').map((s) => s.name);
  const ag = agentes || roster.agents;
  const b = armarBiblioteca({ habilidades, agentes: ag, deptos: DEPT_KEYS, skillsDelDueno });
  return { env, b, propias };
}

/** El cuerpo de una habilidad (la del dueño o la de fábrica). null si no existe. */
export async function cuerpoDe(env, propias, h) {
  const p = propias.get(h.id); if (p) return String(p.cuerpo || '');
  return textoHabilidadDeFabrica(env, h.id);
}

/** GET /api/biblioteca/<id>[?referencia=]: lo que devuelve leer_habilidad. → { habilidad, texto, referencia? } o { error } */
export async function leerHabilidad({ env, b, propias }, id, referencia = null) {
  const h = b.porId(String(id || '').trim()); if (!h) return { error: `no hay ninguna habilidad «${id}» (ver_habilidades da la lista)` };
  if (!referencia) { const c = await cuerpoDe(env, propias, h); if (c === null) return { error: `«${h.id}» no está en esta oficina (falta la semilla del despliegue)` }; return { habilidad: h, texto: textoHabilidad(h, c) }; }
  const r = buscarReferencia(h, referencia); if (!r) return { error: errorSinReferencia(h, referencia) };
  const p = propias.get(h.id);
  const t = p ? (p.refs || {})[r.archivo] ?? null : await textoHabilidadDeFabrica(env, h.id, r.archivo);
  if (t === null || t === undefined) return { error: `la referencia «${r.nombre}» no se pudo leer` };
  return { habilidad: h, referencia: r.nombre, texto: textoReferencia(h, r, String(t)) };
}

/** Lo que va al prompt de un agente: el índice de sus habilidades y la que encaja entera. Vacío si no tiene ninguna. */
export async function textoParaAgente({ env, b, propias }, agente, pedido = '') {
  const elegida = pedido ? b.elegir(pedido, agente, 1)[0] : null;
  const cuerpo = elegida ? await cuerpoDe(env, propias, elegida) : null;
  return b.promptText(agente, pedido, elegida && cuerpo ? () => cuerpo : null);
}

export { listarHabilidades };
