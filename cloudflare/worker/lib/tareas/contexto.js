// Lo que las rutas de tareas necesitan saber de la oficina además de las tareas: el roster, las personas del equipo, los límites de aprobación.
// En la oficina local sale de office.config(.local).json (`cfg`); en la nube, de dos documentos del almacén:
//   'ajustes'        — lo que escribirá la fase 6 (Ajustes), con la misma forma que `cfg`;
//   'tareas.config'  — lo que sube el exportador de esta fase mientras tanto (approvals, team, name, teams, concurrency).
// El de `ajustes` gana. Si no hay ninguno, los valores de fábrica.
import { leerDoc } from '../almacen.js';
import * as approvals from '../../../../approvals.mjs';
import * as teams from '../../../../teams.mjs';
import { cargarRoster, agentesSalida, lider, DEPTS } from './roster.js';
import { nombrePorCorreo } from '../sesion.js';

export async function leerAjustes(db) {
  const [a, b] = await Promise.all([leerDoc(db, 'tareas.config', {}), leerDoc(db, 'ajustes', {})]);
  return { ...(a.valor || {}), ...(b.valor || {}) };
}

/** Las cuentas de la plataforma (administradores, editores, lectura), con el nombre con que se las ve. Una tarea se puede asignar a cualquiera de ellas.
 *  Quien está de baja no sale. Si la tabla no existe (una base sin las migraciones de equipo), no hay cuentas: las tareas siguen funcionando. */
export async function cuentasDe(db) {
  try {
    const { results } = await db.prepare('select u.id, u.email, u.rol, p.nombre from users u left join perfiles p on p.user_id = u.id where p.baja_at is null order by u.created_at, u.rowid').all();
    return results.map(f => ({ id: f.id, rol: f.rol, name: String(f.nombre || '').trim() || nombrePorCorreo(f.email) })).filter(f => f.name && f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() !== 'tu'); // (nadie con el nombre reservado «Tú»)
  } catch { return []; }
}

/** Todo junto, listo para armar las rutas: { roster, agents, depts, lider, personas, aprobaciones, equipos, nombre, ajustes }.
 *  `personas` = las de Ajustes → Equipo + las cuentas de la plataforma (26 oct 2026); si una cuenta se llama como una persona de Ajustes, es la misma (con su Telegram). */
export async function leerContexto(db) {
  const [roster, ajustes, cuentas] = await Promise.all([cargarRoster(db), leerAjustes(db), cuentasDe(db)]);
  const agents = roster.agents;
  const deAjustes = (ajustes.team?.people || []).filter(p => p && p.name);
  const personas = deAjustes.map(p => { const c = cuentas.find(x => x.name.toLowerCase() === p.name.toLowerCase()); return c ? { ...p, usuario: true, rol: c.rol, id: c.id } : p; });
  for (const c of cuentas) if (!personas.some(p => p.name.toLowerCase() === c.name.toLowerCase())) personas.push({ name: c.name, depts: [], usuario: true, soloCuenta: true, rol: c.rol, id: c.id });
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
