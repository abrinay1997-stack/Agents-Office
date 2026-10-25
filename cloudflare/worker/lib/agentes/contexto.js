// Lo que un agente sabe antes de trabajar, en la nube: serve.mjs → agentSystem, hecho con lo que hay en D1.
//  · sus instrucciones fijas, skills y lecciones (docs/filas: `skills`, `feedback.<id>`), las cifras de la empresa (`cifras`) y los ejemplos que el dueño guardó (`ejemplos.<id>`);
//  · las notas del Cerebro (tabla `notas`) buscadas con el MISMO código que la local (knowledge.mjs: BM25 por pasajes; memory.mjs: vecindario, presupuesto y sinapsis que aprenden);
//  · lo que otros departamentos hicieron con el mismo cliente (knowledge.sameClient).
// El texto de las instrucciones es el de agente-core.mjs (compartido con serve.mjs): las mismas palabras en los dos sitios.
import * as knowledge from '../../../../knowledge.mjs';
import * as memory from '../../../../memory.mjs';
import { agentBrief, instruccionesBase, cifrasLine, TAREAS_TEXT, CONTENIDO_TEXT, modeLineFor, pasosLine, reanudaLine } from '../../../../agente-core.mjs';
import { leerDoc, listarFilas, guardarDoc } from '../almacen.js';

export const DOC_MEMORIA = 'memoria';
export const MOC = { emails: 'MOC-Emails', sales: 'MOC-Sales', marketing: 'MOC-Marketing', ops: 'MOC-Operations', fin: 'MOC-Finance', delivery: 'MOC-Delivery' };

export async function leerMemoria(db) { const m = (await leerDoc(db, DOC_MEMORIA, null)).valor; return m && m.notes ? m : memory.emptyMemory(); }
export async function guardarMemoria(db, mem) { await guardarDoc(db, DOC_MEMORIA, mem); }

/** Las skills que le tocan a un agente (skills.mjs → forAgent), de la colección `skills`. */
export async function skillsDe(db, a) {
  const todas = await listarFilas(db, 'skills', { limite: 200 });
  return todas.filter(s => s && s.text && (s.everyone || (s.agents || []).includes(a.id) || (s.departments || []).includes(a.department)));
}
export async function leccionesDe(db, id) { return (await leerDoc(db, 'feedback.' + id, { rules: [], oneOffs: [] })).valor; }
export async function cifrasDe(db) { const v = (await leerDoc(db, 'cifras', { items: [] })).valor; return Array.isArray(v.items) ? v.items : []; }
async function ejemplosDe(db, id) {
  const it = ((await leerDoc(db, 'ejemplos.' + id, { items: [] })).valor.items || []).slice(-2).reverse();
  return it.length ? '\n\nEXAMPLES THE OWNER LIKED (from your own past work — copy their shape, length and tone, not their content):\n' + it.map(x => '--- ' + x.title + ' ---\n' + String(x.text).slice(0, 1500)).join('\n\n') : '';
}

/** El índice nombre → texto de las notas, y cuáles están viejas. */
export async function indiceDeNotas(db) {
  const { results } = await db.prepare('select nombre, texto, actualizado, grupo from notas').all();
  const index = new Map(), stale = new Map();
  for (const n of results) {
    index.set(n.nombre, n.texto);
    const st = knowledge.staleness(n.nombre, n.texto, n.actualizado || 0, n.grupo || '');
    if (st.stale) stale.set(n.nombre, st);
  }
  return { index, stale };
}

/** serve.mjs → relevantNotes: las mejores notas para esta tarea (con las sinapsis que aprenden) y sus vecinas como resumen. */
export function notasRelevantes(index, dept, texto, mem, n = 4) {
  const ix = knowledge.buildIndex(new Map([...index].filter(([k]) => !['CLAUDE', 'index', 'log'].includes(k))));
  const moc = MOC[dept];
  const r = knowledge.search(ix, texto, { n: n + 2, per: 2, always: moc && index.has(moc) ? [moc] : [] });
  const ranked = r.filter(x => x.score > 0).map(x => ({ ...x, score: x.score * memory.boostOf(mem, x.note) })).sort((a, b) => b.score - a.score).slice(0, n);
  const always = r.filter(x => x.score === 0 && !ranked.some(y => y.note === x.note));
  const adj = memory.linkGraph(new Map([...index].filter(([k]) => !['CLAUDE', 'log'].includes(k))), { extra: memory.learnedLinks(mem) });
  const near = memory.expand(ranked, adj, { max: 2, skip: new Set(['CLAUDE', 'index', 'log', ...always.map(x => x.note)]) });
  const names = [...ranked, ...always].map(x => x.note).concat(near.map(x => x.note));
  names.passages = new Map([...ranked, ...always].map(x => [x.note, x.passages]).concat(near.map(x => [x.note, [memory.summary(index.get(x.note) || '', 420)]])));
  names.via = new Map(near.map(x => [x.note, x.via]));
  return names;
}
const businessContext = index => ['CLAUDE', 'index', 'business-model', 'voice'].filter(k => index.has(k)).map(k => `--- ${k}.md ---\n${index.get(k).slice(0, 1200)}`).join('\n\n');
function contextText(index, names, stale, budget = 9000) {
  return memory.pack(names.map(n => { const st = stale.get(n), via = names.via?.get(n); const body = names.passages?.get(n)?.join('\n…\n') || (index.get(n) || '').slice(0, 1800); return { head: `--- ${n}.md ---${via ? ` (relacionada con ${via}: su resumen)` : ''}${st ? ` (nota ${st.why}: confírmala antes de citar cifras de aquí)` : ''}`, body: body.slice(0, 2600) }; }), budget);
}

/** Qué herramientas internas existen para el agente (el texto de arriba solo habla de las que de verdad se le dan). */
const textoDeHerramientas = (a, { tieneContenido }) => TAREAS_TEXT + (tieneContenido ? CONTENIDO_TEXT : '');

/**
 * El sistema y el pedido de UNA ejecución. → { sistema, usuario, leidas: [nombres de notas] }
 * `C`: leerContexto(db). `feedback`: lo que el dueño pidió cambiar (revise). `tareas`: la lista (para «mismo cliente»).
 */
export async function armarEjecucion({ db, C, agente: a, tarea: task, modo, feedback, tareas = [], tieneContenido = false, tieneEstudio = false, proyectoDe = () => null, ahora = Date.now() }) {
  const [skills, rules, cifras, ejemplos, mem, { index, stale }] = await Promise.all([skillsDe(db, a), leccionesDe(db, a.id).then(l => l.rules || []), cifrasDe(db), ejemplosDe(db, a.id), leerMemoria(db), indiceDeNotas(db)]);
  const leidas = notasRelevantes(index, a.department, task.title + ' ' + task.text, mem);
  const deptName = C.depts[a.department]?.name || a.department;
  const sistema = `You are ${a.name}, ${a.role || 'an agent'}, in the ${deptName} department of ${C.nombre}. ${a.does}\n${agentBrief(a, { skills, rules })}` + instruccionesBase(260) +
    textoDeHerramientas(a, { tieneContenido }) + (tieneEstudio ? '\n- ESTUDIO (mcp__estudio__*): generar_imagen crea imágenes REALES; buscar_en_galeria, estado_trabajo y estado_estudio las consultan. Pon en tu entregable, tal cual, las líneas que devuelve la herramienta. El gasto en motores de pago solo corre en la ejecución que sigue al OK del dueño; antes, deja el prompt listo.' : '') +
    cifrasLine(cifras) + ejemplos +
    `\n\nCOMPANY NOTES\n${businessContext(index)}\n\nNOTES YOU READ FOR THIS TASK\n${contextText(index, leidas, stale)}` +
    knowledge.sameClientText(knowledge.sameClient(tareas, task), id => C.nombreAgente(id), d => C.depts[d]?.name || d);
  const hoy = new Date(ahora).toLocaleString('es-PA', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const lineaDeCuando = task.routine ? `\nThis is a routine (${task.when}): it runs on the office's own clock and the owner is not at the keyboard. It is now ${hoy}. Do the work for now.`
    : task.dueAt ? `\nThis task was scheduled in advance and is running now; the owner is not at the keyboard${task.late ? ' and this run is late' : ''}. It is now ${hoy}. Do the work for now.` : '';
  const usuario = `Task: ${task.title}\nOwner's request: ${task.text}` + pasosLine(task, proyectoDe) + reanudaLine(task) + (task.refs?.length ? `\nFiles from the Estudio to use: ${task.refs.join(', ')}` : '') + lineaDeCuando + modeLineFor(modo === 'approve' ? 'approve' : modo === 'draft' ? 'draft' : 'routine', task) +
    (feedback && modo !== 'approve' ? `\n\nThe owner reviewed your previous version and asked for changes: "${feedback}"\nPrevious version:\n${task.result}` : '');
  return { sistema, usuario, leidas: [...leidas] };
}
