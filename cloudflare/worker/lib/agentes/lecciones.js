// Las lecciones de un agente (learn.mjs en la local: <cerebro>/Agents Office/feedback/<id>.md). Aquí viven en el doc `feedback.<id>`: { rules: [línea], oneOffs: [línea] }.
// Las reglas permanentes ("Standing rules") las lee el agente antes de cada tarea (agente-core.mjs → leccionesLine); los casos puntuales se guardan aparte.
import { mutarDoc, leerDoc } from '../almacen.js';
import { dedupe } from '../../../../quality.mjs';

const MAX = 60;

/** Apunta una corrección. `veredicto`: { standing, rule } de clasificarCorreccion, o null (sin clasificar: caso puntual). → { standing, line } */
export async function registrarLeccion(db, agente, task, feedback, veredicto) {
  const fecha = new Date().toISOString().slice(0, 10), cita = String(feedback).replace(/\s+/g, ' ').trim().slice(0, 160), ctx = task?.title ? ` (${String(task.title).slice(0, 60)})` : '';
  const permanente = !!(veredicto && veredicto.standing && veredicto.rule);
  const linea = permanente ? `${fecha} · ${String(veredicto.rule).replace(/\s+/g, ' ').trim().slice(0, 240)} ← "${cita}"${ctx}` : `${fecha} · "${cita}"${ctx}`;
  await mutarDoc(db, 'feedback.' + agente.id, { rules: [], oneOffs: [] }, d => {
    const k = permanente ? 'rules' : 'oneOffs', lista = [...(d[k] || []), linea].slice(-MAX);
    if (k === 'rules') { const r = dedupe(lista); return { ...d, rules: r.keep }; } // D9: las repetidas se funden (queda la redacción más nueva)
    return { ...d, [k]: lista };
  });
  return { standing: permanente, line: linea };
}

/** Olvida una línea (✕ de la ficha del agente). → true si estaba. */
export async function olvidarLeccion(db, id, linea) {
  let estaba = false; const quieta = String(linea || '').trim();
  await mutarDoc(db, 'feedback.' + id, { rules: [], oneOffs: [] }, d => {
    const f = l => { const sin = (l || []).filter(x => x.trim() !== quieta); if (sin.length !== (l || []).length) estaba = true; return sin; };
    return { ...d, rules: f(d.rules), oneOffs: f(d.oneOffs) };
  });
  return estaba;
}

export const cuenta = async (db, id) => ((await leerDoc(db, 'feedback.' + id, { rules: [] })).valor.rules || []).length;
