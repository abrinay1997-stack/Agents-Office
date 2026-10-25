// Una D1 de mentira sobre node:sqlite con las migraciones REALES. Para lo que un doble a mano no ve: que las consultas existen en el esquema.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIG = join(dirname(fileURLToPath(import.meta.url)), '..', 'migraciones');
export function crearD1() {
  const db = new DatabaseSync(':memory:');
  db.exec('pragma foreign_keys = on');
  for (const f of readdirSync(MIG).filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(join(MIG, f), 'utf8'));
  const sentencia = (sql, args = []) => ({
    bind: (...a) => sentencia(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: r.changes } }; },
  });
  return { prepare: (sql) => sentencia(sql), _db: db };
}
export async function sembrar(d1, { email = 'dueno@panaclaw.test', clave = 'una-clave-larga-123' /* secrets-ok */, rol = 'admin' } = {}) {
  const { hashearContrasena } = await import('../worker/lib/sesion.js');
  const { salt, password_hash } = await hashearContrasena(clave);
  d1._db.prepare('insert into users (id,email,rol,password_hash,salt) values (?,?,?,?,?)').run(crypto.randomUUID(), email, rol, password_hash, salt);
  return { email, clave };
}
export const envDePrueba = (d1, extra = {}) => ({ DB: d1, ASSETS: { fetch: async () => new Response('<html>', { headers: { 'content-type': 'text/html' } }) }, ...extra });
export const pedir = (manejar, env, ruta, { metodo = 'GET', cuerpo, cookie } = {}) =>
  manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }), env);
