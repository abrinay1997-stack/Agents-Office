// Ayudas de las pruebas del Cerebro en la nube: una oficina con las 59 notas de fábrica de verdad (la semilla) y su mapa guardado, lista para pedirle cosas como un administrador.
// (cerebro-conexiones.test.mjs trae su propia versión con la IA de mentira; estas pruebas no necesitan IA o la traen aparte.)
import { oficina, pagina } from './agentes-ayudas.mjs';
import { semillaEnDisco, assetsDe } from './semilla-ayudas.mjs';
import { guardarNotas, guardarGrafo } from '../worker/lib/cerebro.js';

/** → { ...oficina, p: la página (p.admin/p.editor/p.lectura), semilla, fabrica: Set de nombres de fábrica }. Las notas quedan con `actualizado: 1000` y el mapa calculado en 2000. */
export async function mundoDelCerebro({ fetchIA = null } = {}) {
  const o = await oficina({ conector: false }), { dir, semilla } = await semillaEnDisco();
  o.env.ASSETS = assetsDe(dir); if (fetchIA) o.env.__pruebas = { fetch: fetchIA };
  await guardarNotas(o.d1, semilla.notas.map((n) => ({ nombre: n.nombre, grupo: n.grupo, oficina: 0, texto: n.texto, actualizado: 1000, tarea: null })));
  await guardarGrafo(o.d1, structuredClone(semilla.grafo));
  o.d1._db.prepare('update grafo set calculado = ? where id = 1').run(new Date(2000).toISOString());
  return { ...o, p: await pagina(o), semilla, fabrica: new Set(semilla.notas.map((n) => n.nombre)) };
}
export const crearNota = (m, name, text, group = 'Notas') => m.p.admin('POST', '/api/note', { name, text, group });
export const textoEnDb = (m, name) => m.d1._db.prepare('select texto from notas where nombre = ?').get(name)?.texto;
/** Una memoria con una sinapsis aprendida entre dos notas: `veces` trabajos buenos y `peso` hoy. */
export const memoriaCon = (pares, notas = {}) => ({
  v: 1, notes: Object.fromEntries(Object.entries(notas).map(([k, w]) => [k, { w, n: 2, last: Date.now() }])), applied: {},
  edges: Object.fromEntries(pares.map(([a, b, peso, veces]) => [a < b ? a + '\u0001' + b : b + '\u0001' + a, { w: peso, n: veces, last: Date.now() }])),
});
