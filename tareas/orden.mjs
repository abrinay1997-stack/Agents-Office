// Agents Office (6 oct 2026, plan T1 · §5.B) — el ORDEN manual (arrastrar una tarea entre otras dos). Un número con huecos: al soltar,
// la tarea toma el punto medio entre la de arriba y la de abajo; si ya no cabe un número entre ellas, la columna se reparte de nuevo.
// Una tarea sin orden va después de las ordenadas (y entre ellas, por antigüedad). Puro, con test.
export const HUECO = 1024;

// el número entre `antes` y `despues` (cualquiera puede faltar: al principio o al final)
export function entre(antes, despues) {
  const a = Number.isFinite(antes) ? antes : null, d = Number.isFinite(despues) ? despues : null;
  if (a === null && d === null) return HUECO;
  if (a === null) return d - HUECO;
  if (d === null) return a + HUECO;
  const m = (a + d) / 2;
  return m > a && m < d && d - a > 1e-6 ? m : null; // null: no cabe — hay que repartir
}

// lista ordenada (como se ve) → { id: orden } con huecos parejos
export const repartir = ids => Object.fromEntries(ids.map((id, i) => [id, (i + 1) * HUECO]));

// poner `id` en la posición `pos` de `ids` (el orden que se ve, sin ella) → { [id]: orden } a guardar (una o, si no cabe, todas)
export function colocar(lista, id, pos) {
  const sin = lista.filter(t => t.id !== id);
  const i = Math.max(0, Math.min(pos, sin.length));
  const n = entre(sin[i - 1]?.orden, sin[i]?.orden);
  const todasOrdenadas = sin.every(t => Number.isFinite(t.orden));
  if (n !== null && todasOrdenadas) return { [id]: n };
  const ids = sin.map(t => t.id); ids.splice(i, 0, id);
  return repartir(ids);
}
