// Agents Office (6 oct 2026, plan T5 · §6.6) — las ANALÍTICAS de las tareas, de las tareas y de su bitácora. Pura, con test.
// Cada cifra lleva las tareas que la forman (`ids`): en la vista, un clic en la cifra las enseña. Lo que no se puede saber se dice
// (null), nunca se inventa: el tiempo en cada estado solo existe desde que hay bitácora (6 oct 2026).
import { visible } from './estados.mjs';
import { limiteMs } from './modelo.mjs';

const mediana = l => { if (!l.length) return null; const s = [...l].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const minutos = ms => (ms == null ? null : Math.round(ms / 60000));

export function resumenTareas({ tareas = [], lineas = [], desde = 0, ahora = Date.now(), nombre = id => id, depts = {} } = {}) {
  const porId = new Map(tareas.map(t => [t.id, t]));
  const delPeriodo = tareas.filter(t => t.state === 'done' && (t.doneAt || 0) >= desde && !t.registro);
  const bien = delPeriodo.filter(t => !t.error), fallidas = delPeriodo.filter(t => t.error && !t.stopped);
  const conLimite = bien.filter(t => t.limite), tarde = conLimite.filter(t => t.doneAt > limiteMs(t.limite)), aTiempo = conLimite.filter(t => t.doneAt <= limiteMs(t.limite));
  const ciclos = bien.filter(t => t.addedAt && t.doneAt).map(t => t.doneAt - t.addedAt);
  const esperas = bien.filter(t => t.waitingAt && t.approvedAt).map(t => t.approvedAt - t.waitingAt);
  const abiertas = tareas.filter(t => t.state !== 'done' && !t.archived);
  const bloqueadas = abiertas.filter(t => visible(t, porId) === 'bloqueada');
  const vencidas = abiertas.filter(t => t.limite && limiteMs(t.limite) < ahora);
  const devueltas = delPeriodo.filter(t => (t.revisions || 0) > 0);
  const esperanOk = abiertas.filter(t => t.state === 'waiting');

  // tiempo en cada estado, de la bitácora (las transiciones), en minutos (mediana)
  const enEstado = {}, porTarea = new Map();
  for (const l of lineas) if (l.tipo === 'estado' || l.tipo === 'creada') { if (!porTarea.has(l.tarea)) porTarea.set(l.tarea, []); porTarea.get(l.tarea).push(l); }
  for (const [, ls] of porTarea) {
    ls.sort((a, b) => a.t - b.t);
    for (let i = 0; i < ls.length - 1; i++) { const est = ls[i].tipo === 'creada' ? ls[i].estado : String(ls[i].a).split(':')[0]; if (!est) continue; (enEstado[est] ||= []).push(ls[i + 1].t - ls[i].t); }
  }
  const tiempoEnEstado = Object.fromEntries(Object.entries(enEstado).map(([k, v]) => [k, { mediana: minutos(mediana(v)), n: v.length }]));

  const carga = {}; for (const t of abiertas) { const k = t.person ? 'persona:' + t.person : t.agent; (carga[k] ||= { quien: t.person || nombre(t.agent), persona: !!t.person, abiertas: 0, ids: [] }); carga[k].abiertas++; carga[k].ids.push(t.id); }
  const porDept = {}; for (const t of delPeriodo) { const d = (porDept[t.dept] ||= { dept: t.dept, nombre: depts[t.dept]?.name || t.dept, hechas: 0, fallidas: 0, costo: 0 }); if (t.error) d.fallidas++; else d.hechas++; d.costo += t.cost || 0; }
  const porProyecto = {}; for (const t of tareas) if (t.proyecto) { const p = (porProyecto[t.proyecto] ||= { proyecto: t.proyecto, tareas: 0, hechas: 0, costo: 0 }); p.tareas++; if (t.state === 'done' && !t.error) p.hechas++; p.costo += t.cost || 0; }
  const cifra = (valor, ids, extra = {}) => ({ valor, ids, ...extra });
  return {
    desde, hasta: ahora,
    hechas: cifra(bien.length, bien.map(t => t.id)),
    fallidas: cifra(fallidas.length, fallidas.map(t => t.id)),
    aTiempo: cifra(aTiempo.length, aTiempo.map(t => t.id), { de: conLimite.length }),
    tarde: cifra(tarde.length, tarde.map(t => t.id), { de: conLimite.length }),
    cicloMin: cifra(minutos(mediana(ciclos)), bien.map(t => t.id), { n: ciclos.length }),
    esperaOkMin: cifra(minutos(mediana(esperas)), bien.filter(t => t.waitingAt && t.approvedAt).map(t => t.id), { n: esperas.length }),
    esperanOk: cifra(esperanOk.length, esperanOk.map(t => t.id)),
    bloqueadas: cifra(bloqueadas.length, bloqueadas.map(t => t.id)),
    vencidas: cifra(vencidas.length, vencidas.map(t => t.id)),
    devueltas: cifra(devueltas.length, devueltas.map(t => t.id), { veces: devueltas.reduce((n, t) => n + (t.revisions || 0), 0) }),
    tiempoEnEstado,
    carga: Object.values(carga).sort((a, b) => b.abiertas - a.abiertas),
    porDept: Object.values(porDept).map(d => ({ ...d, costo: Math.round(d.costo * 100) / 100 })).sort((a, b) => b.hechas - a.hechas),
    porProyecto: Object.values(porProyecto).map(p => ({ ...p, costo: Math.round(p.costo * 100) / 100 })),
  };
}
