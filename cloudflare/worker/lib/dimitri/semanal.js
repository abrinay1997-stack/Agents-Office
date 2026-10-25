// El informe del lunes de Dimitri (serve.mjs → weeklyReport): cómo fue la semana y qué decidir. Los datos son los de la semana (tareas, costos, calidad, indicadores,
// proyectos); la redacción, una llamada al modelo. Sale al chat de Dimitri y a los avisos (y de ahí a Telegram). Se apaga en Ajustes (`deputy.weekly`).
import * as sub from '../../../../sub-core.mjs';
import * as costsCore from '../../../../costs-core.mjs';
import * as quality from '../../../../quality.mjs';
import * as business from '../../../../business.mjs';
import { resumenTareas } from '../../../../tareas/resumen.mjs';
import { progresoProyecto } from '../../../../tareas/progreso.mjs';
import { leerContexto } from '../tareas/contexto.js';
import { cargarTareas } from '../tareas/sesion.js';
import { leerCfg } from '../ajustes.js';
import { leerKpis } from '../negocio.js';
import * as costos from '../agentes/costos.js';
import { avisar } from '../avisos.js';
import { mutarDoc, leerDoc } from '../almacen.js';
import * as chat from './chat.js';
import { preguntar } from './modelo.js';
import { DOC_PROYECTOS } from './datos.js';

export const DOC_SEMANA = 'dimitri.semanal';
/** El número de la semana como lo cuenta serve.mjs (para no mandar dos informes en la misma). */
export const claveSemana = (now = new Date()) => `${now.getFullYear()}-${Math.ceil(((now - new Date(now.getFullYear(), 0, 1)) / 864e5 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7)}`;

async function tareasSemana(db, l, C) {
  try {
    const desde = Date.now() - 7 * 864e5;
    const { results } = await db.prepare('select json from tarea_bitacora where t >= ? order by n desc limit 4000').bind(desde).all();
    const lineas = results.reverse().map((r) => { try { return JSON.parse(r.json); } catch { return null; } }).filter((x) => x && ['estado', 'creada'].includes(x.tipo));
    const r = resumenTareas({ tareas: l, lineas, desde, nombre: C.nombreAgente, depts: C.depts });
    const min = (m) => (m == null ? 'sin datos' : m < 60 ? `${m} min` : `${Math.round(m / 6) / 10} h`);
    const proy = (await leerDoc(db, DOC_PROYECTOS, { lista: [] })).valor?.lista || [];
    const atr = proy.filter((p) => p.estado === 'activo').map((p) => ({ p, g: progresoProyecto(p, l) })).filter((x) => x.g.atrasado);
    return `Tareas (7 días): ${r.hechas.valor} hechas, ${r.fallidas.valor} fallaron, ${r.tarde.valor} tarde de ${r.tarde.de} con fecha límite; de pedido a hecha ${min(r.cicloMin.valor)}; tu OK tarda ${min(r.esperaOkMin.valor)}; ahora ${r.vencidas.valor} vencidas, ${r.bloqueadas.valor} bloqueadas, ${r.esperanOk.valor} esperan tu OK.${atr.length ? ` Proyectos atrasados: ${atr.map((x) => `«${x.p.nombre}» (${x.g.hechas}/${x.g.total})`).join(', ')}.` : ''}`;
  } catch (e) { return `Tareas: no las pude resumir (${e.message}).`; }
}

/** Escribe el informe (si es lunes, desde las 8, no se mandó esta semana y `deputy.weekly` no está apagado; con `force`, siempre). → el texto, o null si no tocaba. */
export async function informeSemanal({ env, db, force = false, ahora = new Date(), fetchFn = null }) {
  const cfg = await leerCfg(db), wk = claveSemana(ahora);
  if (!force && (ahora.getDay() !== 1 || ahora.getHours() < 8 || !(cfg.deputy?.weekly ?? true))) return null;
  // se reclama la semana ANTES de pensar, con la versión del documento como condición: dos relojes (o dos instancias) a la vez no mandan dos informes
  let mio = false;
  await mutarDoc(db, DOC_SEMANA, {}, (ya) => { if (!force && ya.week === wk) { mio = false; return ya; } mio = true; return { ...ya, week: wk, at: ahora.getTime() }; });
  if (!mio) return null;
  const [C, l, k] = [await leerContexto(db), await cargarTareas(db), await leerKpis(db)];
  const c = costsCore.report(await costos.leer(db, Date.now() - 70 * 864e5), l, C.agents, cfg.costs), q = quality.byAgent(l, C.agents);
  const facts = [`Estado: ${sub.statusText(l, C.agents, C.depts)}`, `Últimos trabajos: ${sub.recentText(l, C.agents, 15)}`, `Costo del mes: US$${c.usd.toFixed(2)}${c.budget.budget ? ' de US$' + c.budget.budget : ''}; horas ahorradas ${c.hours.toFixed(1)}`,
    `Calidad por agente: ${q.filter((a) => a.tasks).map((a) => `${a.name} ${a.score}/100 (${a.tasks})`).join(', ') || 'sin datos'}`,
    `Indicadores: ${k.defs.map((d) => { const x = business.summary(d, k.values[d.id]); return `${d.name}: ${x.value ?? 'sin dato'}${x.change !== null ? ` (${Math.round(x.change * 100)} %)` : ''}`; }).join('; ') || 'ninguno definido'}`,
    `Sugerencias de costo: ${c.suggestions.map((x) => x.text).join(' | ') || 'ninguna'}`, await tareasSemana(db, l, C)].filter(Boolean).join('\n');
  const nombre = sub.nameOf(cfg);
  const { text } = await preguntar({ env, db, cfg, fetchFn }, `Eres ${nombre}, la mano derecha del dueño de ${cfg.name || 'PanaClaw'}. Escribes el informe del lunes: claro, concreto, en español, 180–260 palabras, sin relleno.`,
    `Datos de la semana:\n${facts}\n\nEscribe: 1) cómo fue la semana en tres líneas, 2) lo que salió bien, 3) lo que falló o se atasca, 4) tres decisiones que el dueño debería tomar esta semana, cada una con el porqué. Solo texto.`, { maxTokens: 1200, tipo: 'informe', model: 'sonnet' });
  await chat.anexar(db, sub.message('sub', '📋 Informe de la semana\n\n' + text, { mode: 'analisis' }));
  await avisar(db, { kind: 'weekly', text: `📋 Informe de la semana de ${nombre}:\n${text}` });
  return text;
}
