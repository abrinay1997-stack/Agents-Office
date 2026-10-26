// La semilla «PanaClaw por defecto» en el Worker: la generó el despliegue (cloudflare/scripts/semilla.mjs) y vive como activo estático bajo /semilla/.
// Un navegador NO la pide (lib/paginas.js solo sirve lo que lista): el Worker la lee por dentro con env.ASSETS, y solo para «Restablecer oficina» y la Biblioteca de habilidades.
// No está en D1 ni en el paquete del Worker: no cuenta contra su tamaño y se actualiza sola con cada despliegue.
const CACHE = new WeakMap(); // por binding ASSETS: lo ya leído y parseado (un isolate vive minutos; un despliegue nuevo trae uno nuevo)
const TTL_MS = 10 * 60 * 1000;

async function pedir(env, ruta) {
  if (!env?.ASSETS?.fetch) return null;
  try {
    const r = await env.ASSETS.fetch(new Request('https://semilla.interna/semilla/' + ruta));
    if (!r.ok) { try { await r.body?.cancel(); } catch { /* ya está */ } return null; }
    return await r.text();
  } catch { return null; }
}

/** El texto de un archivo de la semilla (o null si no está). `cache: false` para lo que no conviene guardar (referencias de la biblioteca). */
export async function textoSemilla(env, ruta, { cache = true } = {}) {
  let c = null; if (cache && env?.ASSETS) { c = CACHE.get(env.ASSETS); if (!c) CACHE.set(env.ASSETS, c = new Map()); }
  const hit = c?.get(ruta); if (hit && Date.now() - hit.t < TTL_MS) return hit.v;
  const v = await pedir(env, ruta);
  if (c && v !== null) c.set(ruta, { t: Date.now(), v });
  return v;
}
/** Un JSON de la semilla, o null si falta o está mal. */
export async function jsonSemilla(env, ruta) {
  const t = await textoSemilla(env, ruta); if (t === null) return null;
  try { return JSON.parse(t); } catch { return null; }
}
export const manifiesto = (env) => jsonSemilla(env, 'manifest.json');
export const notasSemilla = (env) => jsonSemilla(env, 'notas.json');
export const grafoSemilla = (env) => jsonSemilla(env, 'grafo.json');
export const equipoSemilla = (env) => jsonSemilla(env, 'equipo.json');
export const indiceBiblioteca = (env) => jsonSemilla(env, 'biblioteca/indice.json');
/** El cuerpo de una habilidad de la oficina o una de sus referencias (`archivo`). El id y el archivo se validan: nada de rutas fuera de la carpeta. */
export async function textoHabilidadDeFabrica(env, id, archivo = null) {
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(String(id))) return null;
  if (archivo === null) return textoSemilla(env, `biblioteca/${id}/cuerpo.md`);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(String(archivo)) || String(archivo).includes('..')) return null;
  return textoSemilla(env, `biblioteca/${id}/referencias/${archivo}`, { cache: false });
}
/** Para las pruebas: olvida lo leído. */
export function olvidarSemilla(env) { if (env?.ASSETS) CACHE.delete(env.ASSETS); }
