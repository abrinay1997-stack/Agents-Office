// Agents Office (6 oct 2026, plan T0) — lo que CAMBIÓ en una tarea, y cómo juntar dos cambios hechos a la vez. Puro, con test.
//   mezclar(base, mio, actual): una ejecución de un agente trabaja sobre la copia que leyó al empezar (`base`) y la termina (`mio`);
//     mientras tanto el dueño pudo comentar, votar, pasarla a una persona o cambiarle la prioridad (`actual`, lo que hay en disco).
//     Antes se guardaba `mio` entero y lo del dueño se perdía. Ahora: cada campo que la ejecución cambió gana; los demás quedan
//     como están en disco. Los comentarios y la bitácora se juntan (nunca se pierde uno). Si los dos cambiaron el MISMO campo,
//     gana el dueño en los campos suyos (prioridad, etiquetas, fecha límite, proyecto, persona) y la ejecución en lo demás (estado,
//     resultado), y se dice en `choques`.
//   diferencias(antes, despues): las líneas de la bitácora (estado, campos, pasos, comentarios).

const igual = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
export const DEL_DUENO = new Set(['prioridad', 'etiquetas', 'limite', 'proyecto', 'person', 'estimacion', 'bloqueadaPor', 'orden', 'vote', 'voteReason', 'archived', 'archivedAt', 'example', 'seenAt']);
const AGREGAR = new Set(['comments']); // listas a las que solo se añade

export function mezclar(base, mio, actual) {
  if (!actual) return { tarea: mio, choques: [] };
  if (!base) return { tarea: { ...actual, ...mio }, choques: [] };
  const out = { ...actual }, choques = [];
  const claves = new Set([...Object.keys(base), ...Object.keys(mio), ...Object.keys(actual)]);
  for (const k of claves) {
    if (k === 'version') continue;
    const cambioMio = !igual(base[k], mio[k]), cambioOtro = !igual(base[k], actual[k]);
    if (AGREGAR.has(k)) { // la unión, en orden de llegada
      const visto = new Set(), todos = [];
      for (const x of [...(actual[k] || []), ...(mio[k] || [])]) { const s = JSON.stringify(x); if (!visto.has(s)) { visto.add(s); todos.push(x); } }
      if (todos.length) out[k] = todos.sort((a, b) => (a.at || 0) - (b.at || 0)); else delete out[k];
      continue;
    }
    if (k === 'pasos' && cambioMio && cambioOtro) { out.pasos = mezclarPasos(base.pasos, mio.pasos, actual.pasos); continue; }
    if (!cambioMio) continue; // lo dejó como estaba: manda lo de disco
    if (cambioOtro && !igual(mio[k], actual[k])) {
      choques.push(k);
      if (DEL_DUENO.has(k)) continue; // lo del dueño gana
    }
    if (mio[k] === undefined) delete out[k]; else out[k] = mio[k];
  }
  out.version = Math.max(base.version || 0, mio.version || 0, actual.version || 0);
  return { tarea: out, choques };
}

// pasos: por id. Un paso marcado en cualquiera de los dos queda marcado; uno añadido en cualquiera queda; uno quitado por el dueño se va.
function mezclarPasos(base = [], mio = [], actual = []) {
  const quitados = new Set((base || []).filter(p => !(actual || []).some(a => a.id === p.id)).map(p => p.id));
  const porId = new Map();
  for (const p of [...(actual || []), ...(mio || [])]) {
    if (quitados.has(p.id)) continue;
    const ya = porId.get(p.id);
    porId.set(p.id, ya ? { ...ya, ...p, hecho: ya.hecho || p.hecho, at: ya.at || p.at } : p);
  }
  return [...porId.values()];
}

// los campos que la bitácora cuenta uno por uno (el resultado y el borrador no: son largos y ya están en la tarea)
export const CAMPOS = ['title', 'text', 'agent', 'dept', 'dueAt', 'needsOk', 'person', 'model', 'effort', 'prioridad', 'etiquetas', 'limite', 'proyecto', 'estimacion', 'bloqueadaPor', 'archived', 'approved', 'vote', 'tomadaPor'];
const corto = v => (v === undefined ? null : typeof v === 'string' ? v.slice(0, 200) : v);

export function diferencias(antes, despues) {
  const out = [];
  if (!antes && despues) return [{ tipo: 'creada', estado: despues.state, titulo: corto(despues.title), origen: despues.by }];
  if (antes && !despues) return [{ tipo: 'borrada', estado: antes.state, titulo: corto(antes.title) }];
  if (!antes || !despues) return out;
  if (antes.state !== despues.state || !!antes.error !== !!despues.error) out.push({ tipo: 'estado', de: antes.state + (antes.error ? ':error' : ''), a: despues.state + (despues.error ? ':error' : '') });
  for (const k of CAMPOS) if (!igual(antes[k], despues[k])) out.push({ tipo: 'campo', campo: k, antes: corto(antes[k]), despues: corto(despues[k]) });
  const pa = new Map((antes.pasos || []).map(p => [p.id, p]));
  for (const p of despues.pasos || []) {
    const v = pa.get(p.id);
    if (!v) out.push({ tipo: 'paso', paso: p.id, texto: corto(p.texto), accion: 'añadido' });
    else if (!!v.hecho !== !!p.hecho) out.push({ tipo: 'paso', paso: p.id, texto: corto(p.texto), accion: p.hecho ? 'hecho' : 'desmarcado', marcadoPor: p.por });
    else if (v.texto !== p.texto) out.push({ tipo: 'paso', paso: p.id, texto: corto(p.texto), accion: 'cambiado' });
    pa.delete(p.id);
  }
  for (const p of pa.values()) out.push({ tipo: 'paso', paso: p.id, texto: corto(p.texto), accion: 'quitado' });
  const nc = (despues.comments || []).length - (antes.comments || []).length;
  if (nc > 0) for (const c of despues.comments.slice(-nc)) out.push({ tipo: 'comentario', autor: c.by, texto: corto(c.text) });
  const nb = (despues.notas || []).length - (antes.notas || []).length;
  if (nb > 0) for (const c of despues.notas.slice(-nb)) out.push({ tipo: 'nota', autor: c.por, texto: corto(c.texto) });
  if (!!antes.result !== !!despues.result || (antes.result && despues.result && antes.result.length !== despues.result.length && despues.state !== 'doing')) out.push({ tipo: 'resultado', largo: (despues.result || '').length });
  return out;
}

// quién hizo un cambio, cuando quien guarda no lo dijo: el paso de estado lo delata
export function quienPorDefecto(antes, despues) {
  if (!antes) return despues?.by === 'routine' ? 'rutina' : despues?.by === 'trigger' ? 'disparador' : despues?.by === 'sub' ? 'dimitri' : despues?.by === 'agente' ? 'agente:' + (despues.agenteOrigen || '') : 'dueno';
  if (!despues) return 'dueno';
  if (antes.state === 'next' && despues.state === 'doing') return 'oficina';
  if (antes.state === 'doing' && despues.state !== 'doing') return 'agente:' + (despues.agent || '');
  if (antes.state === 'scheduled' && despues.state === 'next' && !despues.person) return 'oficina';
  return 'dueno';
}
