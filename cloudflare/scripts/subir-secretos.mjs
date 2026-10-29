#!/usr/bin/env node
// Sube a Cloudflare, como secretos del Worker, los secretos de GitHub Actions que secretos.json nombra (+ los MCP_*).
// Entrada: SECRETS_JSON (toJSON(secrets) del workflow). Nunca imprime un valor: solo nombres.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
export function elegir(todos, config) {
  const conocidos = new Set([...config.obligatorios, ...config.opcionales]);
  const salida = {};
  for (const [k, v] of Object.entries(todos)) {
    if (!v) continue;
    if (conocidos.has(k) || k.startsWith(config.prefijoConectores)) salida[k] = String(v);
  }
  const faltan = config.obligatorios.filter((k) => !salida[k]);
  return { salida, faltan };
}

/** El entorno para wrangler: el de este proceso sin SECRETS_JSON (el token y el id de la cuenta de Cloudflare sí se quedan: los necesita). */
export const entornoSinSecretos = (env = process.env) => { const { SECRETS_JSON, ...resto } = env; return resto; };

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = JSON.parse(readFileSync(join(AQUI, '..', 'secretos.json'), 'utf8'));
  const { salida, faltan } = elegir(JSON.parse(process.env.SECRETS_JSON || '{}'), config);
  if (faltan.length) { console.error(`Faltan secretos obligatorios en GitHub: ${faltan.join(', ')}`); process.exit(1); }
  const dir = mkdtempSync(join(tmpdir(), 'ao-sec-'));
  const archivo = join(dir, 'secretos.json');
  try {
    writeFileSync(archivo, JSON.stringify(salida), { mode: 0o600 });
    execFileSync('npx', ['wrangler', 'secret', 'bulk', archivo], { stdio: 'inherit', cwd: join(AQUI, '..'), env: entornoSinSecretos() }); // SEG-07: wrangler (y todo lo que arranque) no hereda el volcado de TODOS los secretos del repositorio
    console.log(`Secretos subidos (${Object.keys(salida).length}): ${Object.keys(salida).sort().join(', ')}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
