// Ayudas de las pruebas de la semilla («PanaClaw por defecto»): la genera el MISMO script del despliegue en una carpeta temporal y un ASSETS de mentira la sirve.
import { mkdtempSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { construirSemilla, escribirSemilla } from '../scripts/semilla.mjs';

let cache = null;
/** La semilla real del repositorio, escrita una vez por proceso de prueba. → { dir, manifest, semilla } */
export async function semillaEnDisco() {
  if (cache) return cache;
  const dir = mkdtempSync(join(tmpdir(), 'ao-semilla-'));
  const semilla = await construirSemilla();
  const manifest = await escribirSemilla(semilla, dir);
  return (cache = { dir, manifest, semilla });
}
/** Un ASSETS como el de Cloudflare: sirve /semilla/<ruta> desde `dir`. `pedidas` anota lo que se pidió (para probar que no se lee de más). */
export function assetsDe(dir, pedidas = []) {
  return { fetch: async (req) => {
    const p = decodeURIComponent(new URL(req.url).pathname); pedidas.push(p);
    const f = join(dir, p.replace(/^\/semilla\//, ''));
    if (!p.startsWith('/semilla/') || p.includes('..') || !existsSync(f) || !statSync(f).isFile()) return new Response('no', { status: 404 });
    return new Response(readFileSync(f), { status: 200, headers: { 'content-type': 'text/plain' } });
  } };
}
