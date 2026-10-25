#!/usr/bin/env node
// Prepara una cuenta de Cloudflare nueva: crea la base D1 y el bucket R2 si no existen y escribe el database_id en
// wrangler.jsonc (solo en la copia de trabajo del workflow; no se commitea). Idempotente.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const wr = (...a) => execFileSync('npx', ['wrangler', ...a], { cwd: RAIZ, encoding: 'utf8' });
const BASE = 'agents-office-db', BUCKET = 'agents-office-contenido';

export function ponerId(texto, id) { return texto.replace(/("database_id"\s*:\s*")[^"]*(")/, `$1${id}$2`); }

/** Anuncios de Meta (fase 7) NO cabe en el plan gratuito de Workers: crear una campaña son ~30 llamadas a Meta en una sola ejecución y el plan gratuito
 *  corta en 50 subrequests y 10 ms de CPU por ejecución. Sin el plan de pago (Workers Paid, ~US$5 al mes) el panel puede mirar, pero crear campañas falla. */
export const AVISO_PLAN_DE_PAGO = 'AVISO: Anuncios de Meta necesita el plan de pago de Workers (Workers Paid, ~US$5 al mes). Crear una campaña son ~30 llamadas a Meta en una ejecución y el plan gratuito permite 50 subrequests y 10 ms de CPU; sin él, la creación se corta a medias (queda «creando» y se retoma, pero puede no terminar nunca). Actívalo en Cloudflare → Workers y Pages → Planes.';

if (import.meta.url === `file://${process.argv[1]}`) {
  let bases = JSON.parse(wr('d1', 'list', '--json'));
  let b = bases.find((x) => x.name === BASE);
  if (!b) { wr('d1', 'create', BASE); b = JSON.parse(wr('d1', 'list', '--json')).find((x) => x.name === BASE); console.log('D1 creada'); }
  if (!b?.uuid) { console.error('No se pudo obtener el id de D1'); process.exit(1); }
  const f = join(RAIZ, 'wrangler.jsonc');
  writeFileSync(f, ponerId(readFileSync(f, 'utf8'), b.uuid));
  const buckets = wr('r2', 'bucket', 'list');
  if (!buckets.includes(BUCKET)) { wr('r2', 'bucket', 'create', BUCKET); console.log('R2 creado'); }
  console.log(`Cuenta lista (D1 ${b.uuid.slice(0, 8)}…)`);
  console.warn('\n' + AVISO_PLAN_DE_PAGO + '\n');
}
