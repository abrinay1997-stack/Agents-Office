// El roster en la nube: los 35 puestos, con las mismas reglas que la oficina local (roster-core.mjs). Las fuentes, de la más floja a la más fuerte,
// igual que en roster.mjs:  lo de fábrica (office.agents.json, empaquetado con el Worker)  ←  el cerebro (agents.json del Cerebro, que sube la migración)
// ←  lo del dueño (editado desde la ficha del agente en la página). Los dos últimos viven en D1 (docs).
import fabrica from '../../../../office.agents.json' with { type: 'json' };
import { fusionar, defaults, validate, EDITABLE } from '../../../../roster-core.mjs';
import { DEPTS } from '../../../../src/data.js';
import { leerDoc, mutarDoc } from '../almacen.js';

export const DOC_CEREBRO = 'agentes.cerebro';
export const DOC_LOCAL = 'agentes.local';
export { DEPTS };

export async function cargarRoster(db) {
  const [cerebro, local] = await Promise.all([leerDoc(db, DOC_CEREBRO, null), leerDoc(db, DOC_LOCAL, null)]);
  const fuentes = [{ etiqueta: 'office.agents.json', doc: fabrica }];
  if (cerebro.valor) fuentes.push({ etiqueta: 'brain/Agents Office/agents.json', doc: cerebro.valor });
  if (local.valor) fuentes.push({ etiqueta: 'office.agents.local.json', doc: local.valor });
  const r = fusionar(fuentes);
  return { ...r, files: fuentes.map(f => f.etiqueta) };
}

export const lider = (agents, dept) => agents.find(a => a.department === dept && a.lead) || agents.find(a => a.department === dept);
const setUp = (agents, dept) => agents.some(a => a.department === dept && a.brief); // sin skills todavía (fase 4): basta con que un puesto tenga su brief

/** La forma de cada agente en /api/agents (serve.mjs → agentsOut). Las skills y las lecciones llegan con la fase 4: por ahora, vacías. */
export function agentesSalida(agents) {
  return agents.map(a => ({ id: a.id, name: a.name, role: a.role, does: a.does, tools: a.tools, brief: a.brief || '', model: a.model || '', effort: a.effort || '', skills: [], lessons: 0, department: a.department, lead: a.lead,
    interviewer: lider(agents, a.department)?.id === a.id, setUp: setUp(agents, a.department) }));
}

/** Guarda lo que el dueño editó de UN agente (solo los campos editables, validado con las mismas reglas). → { problems } o { ok: true } */
export async function guardarAgente(db, id, patch) {
  const base = defaults(); if (!base.some(a => a.id === id)) return { problems: [`"${id}" is not one of the 35 seats`] };
  const e = { id }; for (const k of EDITABLE) if (patch[k] !== undefined) e[k] = patch[k];
  const problems = validate({ agents: [e] }, base).problems;
  if (problems.length) return { problems };
  await mutarDoc(db, DOC_LOCAL, { agents: [] }, d => {
    const lista = Array.isArray(d.agents) ? d.agents : [];
    const i = lista.findIndex(a => a && a.id === id); if (i < 0) lista.push(e); else lista[i] = { ...lista[i], ...e };
    return { ...d, agents: lista };
  });
  return { ok: true, problems: [] };
}
