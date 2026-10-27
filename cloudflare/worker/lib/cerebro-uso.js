// Cerebro en la nube — enlaces que el USO ya demostró (issue #45, idea 7: «enlaces propuestos durante el trabajo»). PURO.
// Cuando un agente cita dos notas juntas en el «Fuentes:» de un trabajo que salió bien, la memoria (memory.mjs → reinforce) refuerza una sinapsis «aprendida» entre ellas, que se dibuja en dorado.
// Eso no escribe nada en las notas. Aquí se mira esa memoria y se PROPONE al dueño convertir en un [[enlace]] de verdad las parejas que se usaron juntas varias veces y no están enlazadas.
// Sin IA y gratis: es lo que ya pasó. Se aplica con el mismo camino que las propuestas de la IA (aplicarConexiones: una sección «Relacionadas» en la nota, nunca en una de fábrica ni clave).
import * as memory from '../../../memory.mjs';

export const MIN_USOS = 2;       // veces que se reforzó la pareja (con un solo trabajo bueno puede ser casualidad)
export const MIN_PESO = 0.25;    // fuerza de la sinapsis hoy (nace en 0,2; sube con cada trabajo aprobado y se apaga sola sin uso, vida media de 90 días)
export const MAX_PAREJAS = 12;   // parejas que se enseñan por vez
const MAX_POR_NOTA = 5;          // lo mismo que MAX_ENLACES de conexiones.js
const llave = (a, b) => (a < b ? a + '\u0001' + b : b + '\u0001' + a);

/**
 * mem: la memoria ({ notes, edges }) · pares: [[a, b]] los enlaces que ya existen · notas: [{ nombre, grupo, actualizado, … }]
 * puedeEscribir(nota) / puedeEnlazar(nota): las reglas de conexiones.js (no se escribe en una nota de fábrica, clave ni de un agente; no se enlaza a index, log ni CLAUDE).
 * → [{ nota, grupo, rev, origen: 'uso', enlaces: [{ a, porque, usos, peso }] }] con la forma de las propuestas de la IA, la más fuerte primero.
 */
export function enlacesPorUso({ mem, pares, notas, puedeEscribir, puedeEnlazar = () => true, ahora = Date.now() }) {
  if (!mem || !mem.edges) return [];
  const filas = new Map(notas.map((n) => [n.nombre, n])), ya = new Set((pares || []).map(([a, b]) => llave(a, b)));
  const candidatas = [];
  for (const [k, e] of Object.entries(mem.edges)) {
    const [a, b] = k.split('\u0001'), fa = filas.get(a), fb = filas.get(b);
    if (!fa || !fb || a === b || ya.has(llave(a, b))) continue;
    const usos = Number(e?.n) || 0, peso = memory.effective(e, ahora, 0);
    if (usos < MIN_USOS || peso < MIN_PESO) continue;
    const ea = puedeEscribir(fa) && puedeEnlazar(fb), eb = puedeEscribir(fb) && puedeEnlazar(fa);
    if (!ea && !eb) continue; // las dos son de fábrica o claves: el oro del mapa ya las junta; no hay dónde escribir el enlace
    const desde = ea && eb ? (Number(fa.actualizado) >= Number(fb.actualizado) ? a : b) : ea ? a : b; // se escribe en la que se puede y, si son las dos, en la más reciente
    candidatas.push({ desde, hasta: desde === a ? b : a, usos, peso });
  }
  candidatas.sort((x, y) => y.peso - x.peso || y.usos - x.usos || x.desde.localeCompare(y.desde) || x.hasta.localeCompare(y.hasta));
  const porNota = new Map(); let parejas = 0;
  for (const c of candidatas) {
    if (parejas >= MAX_PAREJAS) break;
    const lista = porNota.get(c.desde) || []; if (lista.length >= MAX_POR_NOTA) continue;
    lista.push(c); porNota.set(c.desde, lista); parejas++;
  }
  return [...porNota].map(([nombre, lista]) => ({
    nota: nombre, grupo: filas.get(nombre).grupo, rev: filas.get(nombre).actualizado, origen: 'uso',
    enlaces: lista.map((c) => ({ a: c.hasta, porque: `los agentes las usaron juntas en ${c.usos} trabajos que salieron bien`, usos: c.usos, peso: +c.peso.toFixed(2) })),
  }));
}
