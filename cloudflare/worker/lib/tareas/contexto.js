// Lo que las rutas de tareas necesitan saber de la oficina además de las tareas: el roster, las personas del equipo, los límites de aprobación.
// En la oficina local sale de office.config(.local).json (`cfg`); en la nube, de dos documentos del almacén:
//   'ajustes'        — lo que escribirá la fase 6 (Ajustes), con la misma forma que `cfg`;
//   'tareas.config'  — lo que sube el exportador de esta fase mientras tanto (approvals, team, name, teams, concurrency).
// El de `ajustes` gana. Si no hay ninguno, los valores de fábrica.
import { leerDoc } from '../almacen.js';
import * as approvals from '../../../../approvals.mjs';
import * as teams from '../../../../teams.mjs';
import { cargarRoster, agentesSalida, lider, DEPTS } from './roster.js';

export async function leerAjustes(db) {
  const [a, b] = await Promise.all([leerDoc(db, 'tareas.config', {}), leerDoc(db, 'ajustes', {})]);
  return { ...(a.valor || {}), ...(b.valor || {}) };
}

/** Todo junto, listo para armar las rutas: { roster, agents, depts, lider, personas, aprobaciones, equipos, nombre, ajustes } */
export async function leerContexto(db) {
  const [roster, ajustes] = await Promise.all([cargarRoster(db), leerAjustes(db)]);
  const agents = roster.agents;
  const personas = (ajustes.team?.people || []).filter(p => p && p.name);
  return {
    roster, agents, depts: DEPTS, ajustes,
    lider: dept => lider(agents, dept),
    nombreAgente: id => agents.find(a => a.id === id)?.name || id,
    personas,
    persona: nombre => personas.find(p => p.name.toLowerCase() === String(nombre || '').toLowerCase()) || null,
    aprobaciones: approvals.config(ajustes.approvals),
    equipos: teams.settings(ajustes),
    nombre: ajustes.name || 'PanaClaw',
    salida: () => agentesSalida(agents),
  };
}
