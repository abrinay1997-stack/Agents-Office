// Cerebro — cómo saber si una mejora de la búsqueda o de las conexiones sirve de verdad (issue #45, «Cómo saber que mejoró»). PURO: sin archivos ni red.
// Dos medidas, las dos con un número que se compara antes y después:
//  · BÚSQUEDA — un conjunto de preguntas (evals-cerebro/preguntas.json) con la nota que contiene la respuesta. Se mide el recall@k (¿la nota correcta está entre las k primeras?) y el MRR
//    con el MISMO buscador que usan los agentes (knowledge.mjs: BM25 por pasajes). Una mejora (significado, enlaces) debe subir estos números; un cambio que los baje, no entra.
//  · ENLACES — «Actualizar conexiones» preselecciona ~25 notas parecidas para que la IA elija a cuáles enlazar. Se esconde un enlace que el equipo SÍ escribió y se mira si esa nota aparece en la
//    lista (recall@25 de enlaces escondidos): mide la preselección sin gastar un centavo en IA.
// Lo usan scripts/evals-cerebro.mjs, tests/cerebro-evals.test.mjs y cloudflare/tests/cerebro-evals-enlaces.test.mjs.
import * as knowledge from './knowledge.mjs';

/** Las notas que la búsqueda de los agentes nunca devuelve (serve.mjs y agentes/contexto.js las apartan igual). */
export const NO_BUSCAR = new Set(['CLAUDE', 'index', 'log']);
export const KS = [1, 3, 5];

/** Posición (1, 2, 3…) de la primera nota esperada en el ranking, o 0 si no aparece. */
export function posicion(ranking, esperadas) {
  const quiero = new Set(esperadas);
  const i = (ranking || []).findIndex((n) => quiero.has(n));
  return i < 0 ? 0 : i + 1;
}

/**
 * casos: [{ id, q, esperadas, ranking }] → { n, recall: { 1, 3, 5 }, mrr, fallos: [{ id, q, esperadas, ranking }] } (los fallos son los que no la tienen entre las primeras 5).
 * El MRR cuenta hasta la posición 10 (1/posición; 0 si no aparece).
 */
export function resumir(casos) {
  const n = casos.length, aciertos = Object.fromEntries(KS.map((k) => [k, 0]));
  let mrr = 0; const fallos = [];
  for (const c of casos) {
    const p = posicion(c.ranking, c.esperadas);
    for (const k of KS) if (p && p <= k) aciertos[k]++;
    if (p && p <= 10) mrr += 1 / p;
    if (!p || p > 5) fallos.push({ id: c.id, q: c.q, esperadas: c.esperadas, ranking: (c.ranking || []).slice(0, 5) });
  }
  const r = (x) => (n ? +(x / n).toFixed(4) : 0);
  return { n, recall: Object.fromEntries(KS.map((k) => [k, r(aciertos[k])])), mrr: r(mrr), fallos };
}

/** El índice de pasajes de los agentes sobre estas notas (Map nombre → texto), sin las que nunca se buscan. */
export const indiceDeBusqueda = (notas) => knowledge.buildIndex(new Map([...notas].filter(([k]) => !NO_BUSCAR.has(k))));

/** El ranking por palabras (BM25) que ven los agentes: los nombres de las mejores notas, la mejor primero. */
export const rankingBM25 = (ix, q, n = 10) => knowledge.search(ix, q, { n, per: 1 }).filter((x) => x.score > 0).map((x) => x.note);

/**
 * Mide la búsqueda. notas: Map nombre → texto · preguntas: [{ id, q, esperadas }] · ranking(ix, q) → nombres (puede ser async: así mide también la búsqueda por significado).
 * Lanza si una pregunta espera una nota que no existe (una pregunta podrida no puede contar como fallo del buscador).
 */
export async function evaluarBusqueda(notas, preguntas, { ranking = rankingBM25, indice = null } = {}) {
  const ix = indice || indiceDeBusqueda(notas);
  const casos = [];
  for (const p of preguntas) {
    const faltan = p.esperadas.filter((e) => !notas.has(e));
    if (faltan.length) throw new Error(`La pregunta «${p.id}» espera notas que no existen: ${faltan.join(', ')}`);
    casos.push({ ...p, ranking: await ranking(ix, p.q) });
  }
  return resumir(casos);
}

/** Los pares de notas que enlaza el texto de cada nota (`[[a]]`), sin repetir, solo entre notas que existen. → [[desde, hasta]] */
export function enlacesReales(notas) {
  const existen = new Set(notas.keys()), vistos = new Set(), out = [];
  for (const [nombre, texto] of notas) {
    for (const m of String(texto).matchAll(/\[\[([^\]|#]+)/g)) {
      const b = m[1].trim().split('/').pop();
      if (!existen.has(b) || b === nombre) continue;
      const k = nombre + '\u0001' + b; if (vistos.has(k)) continue; vistos.add(k); out.push([nombre, b]);
    }
  }
  return out;
}

/** Un texto como si su autor no hubiera escrito ningún [[enlace]] pero sí dicho el nombre: la nota nueva a la que «Actualizar conexiones» tiene que encontrarle compañía. */
export const sinEnlaces = (texto) => String(texto).replace(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g, (_, n) => n.trim().split('/').pop());
/** Lo mismo pero SIN el nombre: el enlace desaparece del todo. Es la prueba justa (el nombre de la nota enlazada no se cuela como palabra que la delate). */
export const quitarEnlaces = (texto) => String(texto).replace(/\[\[[^\]]*\]\]/g, '');

/**
 * Mide la preselección de candidatas. enlaces: [[desde, hasta]] · candidatas(desde, hasta) → nombres de la lista que vería la IA para `desde` con el enlace a `hasta` escondido.
 * → { n, recall, fallos: [[desde, hasta]] }: la fracción de enlaces escondidos que SÍ aparecen en la lista.
 */
export async function evaluarEnlaces(enlaces, candidatas) {
  let ok = 0; const fallos = [];
  for (const [desde, hasta] of enlaces) { if ((await candidatas(desde, hasta)).includes(hasta)) ok++; else fallos.push([desde, hasta]); }
  return { n: enlaces.length, recall: enlaces.length ? +(ok / enlaces.length).toFixed(4) : 0, fallos };
}
