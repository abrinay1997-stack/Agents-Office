// Versión móvil (1 nov 2026) — INICIO, la parte pura (sin DOM, con test): qué se dice primero y sin repetir.
//   · avisos sin repetir (el mismo aviso salía dos veces, y uno de hace un día mezclado con los de hoy);
//   · «lo que viene» sin duplicados (la ejecución de una rutina y la fecha límite de la tarea que nace de ella son UNA entrada) y por día;
//   · el motivo del aviso amarillo de la oficina («2 conectores sin autorizar · +1») y a dónde lleva;
//   · el saludo corto y las cifras pequeñas de «Lo tuyo hoy».
import { corto } from './ui.js';

const DIA = 864e5;
const inicioDe = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const ymdDe = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** El texto sin lo que cambia de un aviso al otro de lo mismo: marcas, acentos graves, espacios, mayúsculas. */
export const normaTexto = t => String(t ?? '').replace(/[`⚑▲●■]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Avisos de la oficina sin repetir. El mismo aviso (misma tarea, mismo tipo, mismo texto) sale UNA vez, el más nuevo, con cuántas veces se dijo.
 * Separa lo de hoy de lo anterior y deja fuera los ya leídos (salvo `leidos: true`).
 * @returns {{ hoy: object[], antes: object[], total: number }}  cada aviso lleva `veces`
 */
export function avisosSinRepetir(notices, { ahora = Date.now(), leidos = false } = {}) {
  const lista = (Array.isArray(notices) ? notices : []).filter(n => n && n.text && (leidos || !n.read)).sort((a, b) => (b.t || 0) - (a.t || 0));
  const vistos = new Map();
  for (const n of lista) {
    const k = `${n.task || ''}|${n.kind || ''}|${normaTexto(n.text)}`;
    const v = vistos.get(k); if (v) { v.veces++; if (!n.read) v.leido = false; v.ids.push(n.id); continue; }
    vistos.set(k, { ...n, veces: 1, leido: !!n.read, ids: [n.id] });
  }
  const unicos = [...vistos.values()], desde = inicioDe(ahora);
  return { hoy: unicos.filter(n => (n.t || 0) >= desde), antes: unicos.filter(n => (n.t || 0) < desde), total: unicos.length };
}

/** «Lun 2 nov» con la primera en mayúscula · «Hoy» · «Mañana» */
export function diaCorto(ms, ahora = Date.now()) {
  const d = ymdDe(ms);
  if (d === ymdDe(ahora)) return 'Hoy';
  if (d === ymdDe(ahora + DIA)) return 'Mañana';
  const t = corto(ms); return t[0].toUpperCase() + t.slice(1);
}

/**
 * «Lo que viene»: de los eventos del calendario (agenda.js → eventos) deja UNA entrada por cosa, agrupada por día y recortada.
 * Una rutina que dispara una tarea con el mismo título el mismo día, o una tarea con su fecha límite, es una sola entrada: gana la que tiene hora
 * y, si la otra es una fecha límite, la entrada dice «vence». Lo pausado o saltado no se va a hacer: no se muestra.
 * @returns {{ grupos: {dia:string, titulo:string, items:object[]}[], total:number, resto:number }}
 */
export function proximosPorDia(evs, { ahora = Date.now(), max = 4 } = {}) {
  const esTarea = e => e.tipo !== 'rutina', esLim = e => e.tipo === 'limite' || e.tipo === 'mia';
  const lista = [];
  // 1) lo que es la MISMA tarea (mismo id el mismo día: su hora y su fecha límite) es una entrada; dos tareas con ids distintos NUNCA se funden
  const porTarea = new Map();
  for (const e of evs || []) {
    if (!e || e.hecha || e.pausada || e.saltada) continue;
    if (esTarea(e) && e.id) {
      const k = `${e.id}|${ymdDe(e.at)}`, v = porTarea.get(k);
      if (v) { if (esLim(e)) v.vence = true; if (e.conHora && !v.conHora) Object.assign(v, { at: e.at, conHora: true, tipo: e.tipo }); continue; }
      const n = { ...e, vence: esLim(e) }; porTarea.set(k, n); lista.push(n);
    } else lista.push({ ...e, vence: esLim(e) });
  }
  // 2) una rutina y la tarea que ella misma dispara (mismo título el mismo día): se funden uno a uno; dos rutinas, o dos tareas, con el mismo título no
  const rutinas = lista.filter(e => e.tipo === 'rutina'), tomadas = new Set();
  for (const r of rutinas) {
    const t = lista.find(x => x !== r && !tomadas.has(x) && esTarea(x) && ymdDe(x.at) === ymdDe(r.at) && normaTexto(x.titulo) === normaTexto(r.titulo));
    if (!t) continue;
    tomadas.add(t); r.vence = r.vence || t.vence; r.fundida = t.id; lista.splice(lista.indexOf(t), 1);
    if (!r.conHora && t.conHora) Object.assign(r, { at: t.at, conHora: true });
  }
  const unicos = lista.sort((a, b) => a.at - b.at);
  const corte = unicos.slice(0, max), dias = new Map();
  for (const e of corte) { const k = ymdDe(e.at); if (!dias.has(k)) dias.set(k, { dia: k, titulo: diaCorto(e.at, ahora), items: [] }); dias.get(k).items.push(e); }
  return { grupos: [...dias.values()], total: unicos.length, resto: Math.max(0, unicos.length - corte.length) };
}

// a dónde lleva cada comprobación del estado (la misma lista que la pantalla Estado)
const IR = { conectores: 'conectores', aprobaciones: 'aprobaciones', rutinas: 'calendario', cola: 'tareas', errores: 'tareas', seguridad: 'tareas' };
const primeraFrase = (t, max = 78) => { const s = String(t || '').replace(/`/g, '').replace(/\s+/g, ' ').trim(), f = s.split(/(?<=[.;])\s/)[0] || s; return f.length > max ? f.slice(0, max - 1).trimEnd() + '…' : f; };

/**
 * El aviso amarillo o rojo de la oficina dicho en palabras: el motivo principal (lo que falla antes que lo que solo pide atención) y cuántos más hay.
 * `excluir`: comprobaciones que ya se ven en otra parte de Inicio (p. ej. «aprobaciones»).
 * @returns {null | { tono:'warn'|'bad', texto:string, mas:number, ir:string, id:string }}
 */
export function motivoAtencion(status, { excluir = [] } = {}) {
  const cs = (status && Array.isArray(status.checks) ? status.checks : []).filter(c => (c.state === 'bad' || c.state === 'warn') && !excluir.includes(c.id));
  if (!cs.length) return null;
  const orden = { bad: 0, warn: 1 }, [c] = cs.slice().sort((a, b) => orden[a.state] - orden[b.state]);
  const detalle = primeraFrase(c.detail);
  return { tono: c.state === 'bad' ? 'bad' : 'warn', texto: detalle ? (normaTexto(detalle).includes(normaTexto(c.label).slice(0, 6)) ? detalle : `${c.label}: ${detalle}`) : String(c.label || 'Algo necesita atención'), mas: cs.length - 1, ir: cs.length > 1 ? 'estado' : (IR[c.id] || 'estado'), id: c.id };
}

/** Saludo corto según la hora (0–23) */
export const saludoDe = (hora = new Date().getHours()) => (hora < 6 ? 'Buenas noches' : hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches');

/** «3 pendientes · 2 hechas hoy» (o «Todo hecho por hoy» si no quedan y ya hizo algo, o «Nada pendiente») */
export function resumenHoy(pendientes, hechas) {
  const p = pendientes | 0, h = hechas | 0;
  if (!p && !h) return 'Nada pendiente';
  if (!p) return `Todo hecho: ${h} ${h === 1 ? 'hecha' : 'hechas'} hoy`;
  return `${p} ${p === 1 ? 'pendiente' : 'pendientes'}${h ? ` · ${h} ${h === 1 ? 'hecha' : 'hechas'} hoy` : ''}`;
}
