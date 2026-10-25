// Exportador de la fase 3 (tareas, rutinas y calendario): lee lo que hay en ESTA computadora y lo deja listo para subir a la nube
// (scripts/migrar-a-nube.mjs lo manda a /api/migrar/filas y /api/migrar/docs). Solo LEE. Nunca llaves, contraseñas ni tokens: de la configuración
// toma únicamente lo que las tareas necesitan (límites de aprobación, personas del equipo, nombre, equipos de agentes, concurrencia).
//
//   filas.tareas   data/tasks.json              una fila por tarea (en el orden del archivo), ya en la forma de hoy (tareas/modelo.normalizar)
//   filas.rutinas  <cerebro>/Agents Office/routines.json   las rutinas tal como están escritas (la nube las valida al leerlas)
//   docs['rutinas.estado']     data/routines.json            cuándo toca la próxima de cada rutina (las ejecuciones saltadas, los conteos)
//   docs['tareas.proyectos' | 'tareas.etiquetas']  data/tareas/*.json
//   docs['agentes.cerebro']    <cerebro>/Agents Office/agents.json   los briefs y nombres que el equipo guardó en el Cerebro
//   docs['agentes.local']      office.agents.local.json              lo que el dueño editó en esta computadora
//   docs['tareas.config']      { approvals, team, name, teams, concurrency } de office.config(.equipo/.local).json
//
// OJO (una sola vez): subir tareas REEMPLAZA en la nube las que tengan el mismo id. Hazlo al mudarte; después la nube es la copia de trabajo y no
// conviene repetirlo con `tareas` (para repetir solo rutinas o agentes, usa --solo=… con otro módulo o súbelo a mano). Una tarea que estaba «en curso»
// (un agente la ejecutaba al exportar) sube como «en cola»: esa ejecución se interrumpió y se vuelve a pedir.
import fs from 'node:fs';
import path from 'node:path';
import { normalizar } from '../../tareas/modelo.mjs';

const leer = (f, defecto = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return defecto; } };
const fusion = (...docs) => docs.reduce((a, d) => ({ ...a, ...(d && typeof d === 'object' ? d : {}) }), {});

export const nombre = 'tareas';

export function exportar({ raiz, vault } = {}) {
  const data = path.join(raiz, 'data');
  const filas = {}, docs = {}; const resumen = {};

  // tareas
  const crudas = leer(path.join(data, 'tasks.json'), []);
  const tareas = Array.isArray(crudas) ? crudas : [];
  const ahora = Date.now();
  filas.tareas = tareas.filter(t => t && typeof t === 'object' && /^[a-z0-9]{4,24}$/i.test(String(t.id))).map((t, i) => {
    const n = normalizar(JSON.parse(JSON.stringify(t)));
    if (n.state === 'doing') { // un agente la estaba ejecutando: esa ejecución no sobrevive a la mudanza
      n.state = 'next'; n.addedAt = ahora; for (const k of ['startedAt', 'tomadaPor', 'ask']) delete n[k];
      n.migrada = { at: ahora, estaba: 'doing' };
    }
    return { id: String(n.id), valor: n, orden: i };
  });
  resumen.tareas = filas.tareas.length;

  // rutinas y su estado
  const brain = vault ? path.join(vault, 'Agents Office') : null;
  const rdoc = brain ? leer(path.join(brain, 'routines.json'), null) : null;
  const rlista = Array.isArray(rdoc) ? rdoc : Array.isArray(rdoc?.routines) ? rdoc.routines : [];
  filas.rutinas = rlista.filter(r => r && typeof r === 'object' && /^[a-z0-9][a-z0-9-]{0,60}$/i.test(String(r.id))).map((r, i) => ({ id: String(r.id), valor: r, orden: i }));
  resumen.rutinas = filas.rutinas.length;
  const estado = leer(path.join(data, 'routines.json'), null);
  if (estado && typeof estado === 'object' && !Array.isArray(estado)) docs['rutinas.estado'] = estado;

  // proyectos y etiquetas
  for (const [clave, f] of [['tareas.proyectos', 'proyectos.json'], ['tareas.etiquetas', 'etiquetas.json']]) {
    const l = leer(path.join(data, 'tareas', f), null);
    if (Array.isArray(l) && l.length) { docs[clave] = { lista: l }; resumen[clave] = l.length; }
  }

  // el roster
  const ac = brain ? leer(path.join(brain, 'agents.json'), null) : null;
  if (ac && typeof ac === 'object') docs['agentes.cerebro'] = ac;
  const al = leer(path.join(raiz, 'office.agents.local.json'), null);
  if (al && typeof al === 'object') docs['agentes.local'] = al;

  // la configuración que las tareas leen (nada de llaves)
  const cfg = fusion(leer(path.join(raiz, 'office.config.json')), leer(path.join(raiz, 'office.config.equipo.json')), leer(path.join(raiz, 'office.config.local.json')));
  const conf = {};
  for (const k of ['approvals', 'name', 'teams', 'concurrency']) if (cfg[k] !== undefined) conf[k] = cfg[k];
  if (Array.isArray(cfg.team?.people)) conf.team = { people: cfg.team.people.filter(p => p && p.name).map(p => ({ name: String(p.name), ...(Array.isArray(p.depts) ? { depts: p.depts.map(String) } : {}), ...(p.telegram ? { telegram: p.telegram } : {}) })) };
  if (Object.keys(conf).length) docs['tareas.config'] = conf;

  return { filas, docs, resumen };
}
