// Lo que Dimitri LEE antes de contestar (el DATO de su prompt): las notas de la empresa, el estado de la oficina con ids, Contenido, Analíticas, las rutinas, los anuncios,
// los proyectos, el dinero, y lo que el dueño tiene abierto («Viendo»). Es serve.mjs → subChatRun / dimitriOffice / dimitriViewing, hecho con lo que hay en D1 y llamando
// POR FUNCIÓN a los módulos ya portados (crearOffice: la misma puerta de la página, con sus mismas reglas). Cada trozo que falle se dice en una línea y no tumba el chat.
import * as sub from '../../../../sub-core.mjs';
import * as memory from '../../../../memory.mjs';
import * as costsCore from '../../../../costs-core.mjs';
import { agenda as agendaTareas, agendaTexto } from '../../../../tareas/agenda.mjs';
import { resumenDueno, DUENO } from '../../../../tareas/dueno.mjs';
import { progresoProyecto } from '../../../../tareas/progreso.mjs';
import { cifrasLine } from '../../../../agente-core.mjs';
import { kpis as cifrasKpis } from '../../../../src/contenido-cifras.js';
import { sdkContent } from '../../../../vision.mjs';
import { buscar as buscarAnuncio, textoObjeto as textoAnuncio } from '../../../../anuncios/modelo.mjs';
import { indiceDeNotas, notasRelevantes, leerMemoria, cifrasDe } from '../agentes/contexto.js';
import * as costos from '../agentes/costos.js';
import * as RT from '../tareas/rutinas.js';
import { leerDoc } from '../almacen.js';
import { leerKpis } from '../negocio.js';
import { avisosTodos } from '../salud.js';

export const DOC_PROYECTOS = 'tareas.proyectos';
const dia = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const localDia = dia;

const businessContext = (index) => ['CLAUDE', 'index', 'business-model', 'voice'].filter((k) => index.has(k)).map((k) => `--- ${k}.md ---\n${index.get(k).slice(0, 1200)}`).join('\n\n');
function contextText(index, names, stale, budget = 9000) {
  return memory.pack(names.map((n) => { const st = stale.get(n), via = names.via?.get(n); const body = names.passages?.get(n)?.join('\n…\n') || (index.get(n) || '').slice(0, 1800); return { head: `--- ${n}.md ---${via ? ` (relacionada con ${via}: su resumen)` : ''}${st ? ` (nota ${st.why}: confírmala antes de citar cifras de aquí)` : ''}`, body: body.slice(0, 2600) }; }), budget);
}

/** Las notas que tocan lo que se habla (BM25 × lo que el Cerebro aprendió) + las del negocio, y las cifras si el mensaje es del Estudio. → { notes (texto), read: [nombres], index } */
export async function notasDelChat(db, { texto, historia = '', context = null, conCifras = false, conVoz = false }) {
  const [{ index, stale }, mem] = await Promise.all([indiceDeNotas(db), leerMemoria(db)]);
  const read = notasRelevantes(index, null, `${historia} ${texto}`.trim(), mem, 4);
  if (context?.view === 'brain' && context.label && index.has(context.label) && !read.includes(context.label)) read.unshift(context.label); // la nota que el dueño tiene abierta
  let extra = '';
  if (conVoz) for (const k of ['voice', 'oferta', 'clientes']) if (index.has(k) && !read.includes(k)) extra += `\n\n--- ${k}.md ---\n${index.get(k).slice(0, 1800)}`;
  if (conCifras) { const c = await cifrasDe(db); extra += c.length ? '\n\n' + cifrasLine(c) : ''; }
  return { notes: businessContext(index) + (read.length ? '\n\n' + contextText(index, read, stale) : '') + extra, read: [...read], index };
}

/** Analíticas resumida para Dimitri: las mismas cuentas que la vista (src/contenido-cifras.js), o por qué no hay. */
export async function analiticasResumen(office, { dias = 30, red = 'todas' } = {}) {
  const r = await office(`/api/contenido/analiticas?dias=${dias * 2 + 5}`);
  const conectado = !!r.meta?.configurado;
  if (!(r.serie || []).length) return { conectado, ultimaFoto: r.ultimaFoto, dias };
  const d = new Date(); d.setDate(d.getDate() - dias + 1);
  const desde = dia(d.getTime()), hasta = dia(Date.now());
  const p = new Date(r.serie[0].fecha + 'T12:00:00'); p.setDate(p.getDate() - 45);
  const k = cifrasKpis({ serie: r.serie, publicaciones: r.publicaciones }, { desde, hasta, red, cobertura: 0.7, publicacionesDesde: dia(p.getTime()) });
  const pubs = (r.publicaciones || []).filter((x) => x.publicadaAt && dia(Date.parse(x.publicadaAt)) >= desde && (red === 'todas' || x.red === red)).sort((a, b) => (b.interacciones || 0) - (a.interacciones || 0));
  return { conectado, ultimaFoto: r.ultimaFoto, dias, k, mejores: pubs.slice(0, 3), peores: pubs.length > 3 ? pubs.slice(-3).reverse() : [] };
}

async function proyectosDe(db) { const v = (await leerDoc(db, DOC_PROYECTOS, { lista: [] })).valor; return Array.isArray(v?.lista) ? v.lista : []; }

/** El resto de la oficina para <estado>: Contenido, publicación, Analíticas, anuncios, rutinas, proyectos, agenda, lo del dueño, dinero, indicadores y avisos. */
export async function oficinaTexto({ db, office, C, lista, cfg }) {
  const out = [], nombre = C.nombreAgente;
  const probar = async (f, rotulo) => { try { const t = await f(); if (t) out.push(t); } catch (e) { if (rotulo) out.push(`${rotulo}: no lo pude leer (${String(e?.message || e).slice(0, 120)}).`); } };
  const hoy = dia(Date.now()), d13 = new Date(); d13.setDate(d13.getDate() + 13);
  await probar(async () => sub.contenidoText((await office(`/api/contenido?desde=${hoy}&hasta=${dia(d13.getTime())}&sinFecha=1`)).piezas || [], { now: new Date(), dias: 7 }), 'Contenido');
  await probar(async () => sub.publicacionText(await office('/api/contenido/cola')));
  await probar(async () => sub.analiticasText(await analiticasResumen(office)));
  await probar(async () => { const v = await office('/api/anuncios?rango=7d'); let top = []; try { top = (await office('/api/anuncios/sugerencias')).sugerencias?.slice(0, 3) || []; } catch { /* sin sugerencias */ } return sub.anunciosText(v, top); });
  await probar(async () => sub.rutinasText((await RT.rutinasConEstado(db, C.agents)).list, lista, { agents: C.agents }));
  await probar(async () => {
    const proy = await proyectosDe(db);
    const t1 = sub.proyectosText(proy.map((p) => ({ ...p, progreso: progresoProyecto(p, lista) })), lista, { name: nombre });
    const a = agendaTareas(lista, { ahora: Date.now() }), it = (x) => `«${String(x.title).slice(0, 50)}» (${x.person === DUENO ? 'del dueño' : x.person ? x.person : nombre(x.agent)}${x.limite ? ', límite ' + x.limite : ''})`;
    const agenda = [a.vencidas.length ? `Tareas vencidas (${a.vencidas.length}): ${a.vencidas.slice(0, 5).map(it).join('; ')}` : '', a.bloqueadas.length ? `Tareas bloqueadas (${a.bloqueadas.length}): ${a.bloqueadas.slice(0, 5).map(it).join('; ')}` : '', a.hoy.length ? `Para hoy (${a.hoy.length}): ${a.hoy.slice(0, 5).map(it).join('; ')}` : '',
      (v => (v.length ? `Vencen en los próximos 7 días (${v.length}): ${v.slice(0, 6).map((x) => `${it(x)} id ${x.id}`).join('; ')}` : ''))(a.proximas.filter((x) => x.limite))].filter(Boolean).join('\n');
    return [t1, agenda, resumenDueno(lista, { nombre })].filter(Boolean).join('\n');
  });
  await probar(async () => {
    const [kp, avisos, lineas] = [await leerKpis(db), (await avisosTodos(db, 60)).filter((n) => !n.read), await costos.leer(db, Date.now() - 32 * 864e5)];
    return sub.oficinaText({ budget: costsCore.budgetState(lineas, costsCore.config(cfg.costs)), kpis: kp.defs.map((d) => ({ id: d.id, name: d.name, goal: d.goal ?? d.target, value: (kp.values[d.id] || []).at(-1)?.v ?? null })), unread: avisos.length, notices: avisos.slice(0, 4) });
  });
  return out.filter(Boolean).join('\n');
}

/** «¿Cómo vamos?» al instante, sin modelo (serve.mjs → dimitriQuick). */
export async function resumenRapido({ db, office, C, lista, cfg }) {
  const d = new Date(); d.setDate(d.getDate() + 6);
  let piezas = [], rts = [], lineas = [], unread = 0;
  try { piezas = (await office(`/api/contenido?desde=${dia(Date.now())}&hasta=${dia(d.getTime())}`)).piezas || []; } catch { /* sin Contenido */ }
  try { rts = (await RT.rutinasConEstado(db, C.agents)).list; } catch { /* sin rutinas */ }
  try { lineas = await costos.leer(db, Date.now() - 32 * 864e5); } catch { /* sin libro */ }
  try { unread = (await avisosTodos(db, 60)).filter((n) => !n.read).length; } catch { /* sin avisos */ }
  const m0 = new Date(); m0.setHours(0, 0, 0, 0);
  return sub.quickStatus({ tasks: lista, agents: C.agents, piezas, routines: rts, spentToday: lineas.filter((l) => l.t >= m0.getTime()).reduce((s, l) => s + (+l.usd || 0), 0), budget: costsCore.budgetState(lineas, costsCore.config(cfg.costs)), unread });
}

/** El calendario entre dos días (ids incluidos), para «Viendo» el calendario de tareas. */
export async function calendarioTexto({ db, office, C, lista, desde, hasta, piezas = false }) {
  const t0 = new Date(desde + 'T00:00:00').getTime(), t1 = new Date(hasta + 'T00:00:00').getTime() + 864e5, now = Date.now();
  const tareas = lista.filter((t) => !t.archived && t.dueAt >= t0 && t.dueAt < t1).sort((x, y) => x.dueAt - y.dueAt);
  const rts = (await RT.rutinasConEstado(db, C.agents)).list;
  const rutinas = t1 <= now ? [] : rts.flatMap((r) => sub.runsOf(r, now, { days: Math.max(1, Math.ceil((t1 - now) / 864e5)), max: 120 }).filter((x) => x >= t0 && x < t1).map((at) => ({ at, id: r.id, title: r.title, agent: r.agent, skip: (r.skips || []).includes(at) }))).sort((x, y) => x.at - y.at);
  const mias = lista.filter((t) => t.person === DUENO && !t.archived && t.limite && String(t.limite).slice(0, 10) >= desde && String(t.limite).slice(0, 10) <= hasta).sort((x, y) => String(x.limite).localeCompare(String(y.limite)));
  let pz = null; if (piezas) { try { pz = (await office(`/api/contenido?desde=${desde}&hasta=${hasta}`)).piezas || []; } catch { pz = []; } }
  return sub.calendarioText({ desde, hasta, tareas, rutinas, mias, piezas: pz, name: C.nombreAgente });
}

/** «👁 Viendo: …» con sus datos (serve.mjs → dimitriViewing). Lo que no se pueda leer se dice, nunca se inventa. */
export async function viendoTexto({ c, db, office, C, lista }) {
  if (!c || !c.view) return '';
  const data = {};
  try {
    if (c.view === 'contenido' && c.kind === 'pieza' && c.id) { const p = (await office(`/api/contenido/piezas/${encodeURIComponent(String(c.id))}`).catch(() => null))?.pieza; if (p) data.pieza = p; else data.none = 'Esa pieza ya no está en Contenido.'; }
    else if (c.view === 'cal' && c.kind === 'range' && /^\d{4}-\d{2}-\d{2}$/.test(c.id || '')) {
      const a = new Date(c.id + 'T00:00:00'), d0 = new Date(a), d1 = new Date(a); d0.setDate(d0.getDate() - 7); d1.setDate(d1.getDate() + 21);
      data.calendario = await calendarioTexto({ db, office, C, lista, desde: dia(d0.getTime()), hasta: dia(d1.getTime()) });
    } else if (c.view === 'contenido' && c.kind === 'range' && /^\d{4}-\d{2}-\d{2}$/.test(c.id || '')) {
      const a = new Date(c.id + 'T12:00:00'), d0 = new Date(a), d1 = new Date(a); d0.setDate(d0.getDate() - 7); d1.setDate(d1.getDate() + 21);
      data.desde = dia(d0.getTime()); data.hasta = dia(d1.getTime()); data.piezas = (await office(`/api/contenido?desde=${data.desde}&hasta=${data.hasta}`)).piezas || [];
    } else if (c.view === 'cal' && c.kind === 'routine' && c.id) {
      const r = (await RT.rutinasConEstado(db, C.agents)).list.find((x) => x.id === c.id);
      if (r) { data.routine = { ...r, agentName: C.nombreAgente(r.agent) }; data.runs = lista.filter((t) => t.routine === r.id).sort((x, y) => (y.addedAt || 0) - (x.addedAt || 0)).slice(0, 3); } else data.none = 'Esa rutina ya no está.';
    } else if ((c.view === 'cal' || c.view === 'tareas') && c.kind === 'task' && c.id) {
      const t = lista.find((x) => x.id === c.id); if (t) data.task = { ...t, agentName: C.nombreAgente(t.agent) }; else data.none = 'Esa tarea ya no está.';
    } else if (c.view === 'tareas' && c.kind === 'proyecto' && c.id) {
      const proy = await proyectosDe(db), p = proy.find((x) => x.id === c.id);
      if (!p) data.none = 'Ese proyecto ya no está.';
      else { const suyas = lista.filter((t) => t.proyecto === p.id && !t.archived); data.proyecto = sub.proyectosText([{ ...p, estado: p.estado === 'activo' || p.estado === 'pausa' ? p.estado : 'activo', progreso: progresoProyecto(p, lista) }], lista, { name: C.nombreAgente }) + `\nSus tareas (${suyas.length}):\n` + suyas.slice(0, 25).map((t) => `- ${t.id} · «${String(t.title).slice(0, 60)}» · ${t.state}${t.person === DUENO ? ' · del dueño' : ''}`).join('\n'); }
    } else if (c.view === 'tareas') {
      data.texto = `${agendaTexto(agendaTareas(lista, { ahora: Date.now() }), { nombre: C.nombreAgente })}\n\n${resumenDueno(lista, { nombre: C.nombreAgente })}`;
    } else if (c.view === 'anuncios') {
      const v = await office(`/api/anuncios?rango=${['hoy', '7d', '30d', 'mes'].includes(c.rango) ? c.rango : '7d'}`);
      if (c.id && ['campana', 'conjunto', 'anuncio'].includes(c.kind)) data.texto = buscarAnuncio(v, String(c.id)) ? textoAnuncio(v, String(c.id)) : 'Eso ya no está en lo leído de Meta.';
      else data.texto = sub.anunciosText(v);
    } else if (c.view === 'analiticas') {
      const [metrica, red, dias] = String(c.id || '').split(':');
      data.metric = `Métrica en pantalla: ${metrica || '—'}\n` + sub.analiticasText(await analiticasResumen(office, { dias: Math.max(1, Math.min(365, +dias || 30)), red: ['instagram', 'facebook'].includes(red) ? red : 'todas' }));
    }
  } catch (e) { data.none = `No pude leer lo que tiene abierto (${String(e?.message || e).slice(0, 120)}).`; }
  return sub.viewingText(c, data);
}

export { sdkContent };

/** El anuncio, conjunto o campaña `id` según lo leído de Meta (para validar las ops de anuncios): { tipo, nombre, estado, presupuesto } | null. */
export function anuncioDeVista(v, id) {
  try { const r = buscarAnuncio(v, String(id)); return r ? { tipo: r.tipo, nombre: r.objeto.nombre, estado: r.objeto.estado, presupuesto: r.objeto.presupuesto } : null; } catch { return null; }
}
