// Agents Office (6 oct 2026, plan T1 · §5.B) — «B está bloqueada por A». Puro, con test. A diferencia de TaskView, aquí un ciclo
// (A espera a B que espera a A) se rechaza al crearlo: dos tareas esperándose se quedarían en la cola para siempre.

// ¿añadir `nuevos` como bloqueos de `id` cierra un ciclo? → la cadena del ciclo (ids) o null
export function ciclo(tareas, id, nuevos) {
  const porId = new Map(tareas.map(t => [t.id, t]));
  const deps = x => (x === id ? nuevos : porId.get(x)?.bloqueadaPor || []);
  for (const inicio of nuevos) {
    const pila = [[inicio, [id, inicio]]], visto = new Set();
    while (pila.length) {
      const [x, camino] = pila.pop();
      if (x === id) return camino;
      if (visto.has(x)) continue; visto.add(x);
      for (const y of deps(x)) pila.push([y, [...camino, y]]);
    }
  }
  return null;
}

// los bloqueos válidos: existen, no son ella misma, sin repetir
export function limpiar(tareas, id, ids) {
  const hay = new Set(tareas.map(t => t.id));
  return [...new Set((ids || []).map(String))].filter(x => x !== id && hay.has(x));
}

// al terminar `hecha`: las tareas que la esperaban y ya no esperan a nadie
export function desbloqueadas(tareas, hecha) {
  const porId = new Map(tareas.map(t => [t.id, t]));
  const terminada = x => { const d = porId.get(x); return !d || (d.state === 'done' && !d.error); };
  return tareas.filter(t => (t.bloqueadaPor || []).includes(hecha) && t.state !== 'done' && t.bloqueadaPor.every(terminada));
}

// lo que bloquea `t` ahora mismo (para decirlo en palabras)
export const pendientes = (tareas, t) => { const porId = new Map(tareas.map(x => [x.id, x])); return (t.bloqueadaPor || []).map(id => porId.get(id)).filter(d => d && !(d.state === 'done' && !d.error)); };

// las que `t` bloquea (las «siguientes»)
export const siguientes = (tareas, t) => tareas.filter(x => (x.bloqueadaPor || []).includes(t.id));
