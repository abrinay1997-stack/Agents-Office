#!/usr/bin/env node
// Alta (o recuperación) del administrador. Usa el MISMO hash que luego comprueba el Worker (worker/lib/sesion.js).
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashearContrasena } from '../worker/lib/sesion.js';

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const clave = process.env.ADMIN_PASSWORD || '';
const remoto = !process.argv.includes('--local');
if (!email || !clave) { console.error('Faltan ADMIN_EMAIL o ADMIN_PASSWORD.'); process.exit(1); }
if (clave.length < 12) { console.error('La contraseña debe tener 12 caracteres como mínimo.'); process.exit(1); }
if (!/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(email)) { console.error('El correo no es válido.'); process.exit(1); }
const { salt, password_hash } = await hashearContrasena(clave);
const sql = `insert into users (id, email, rol, password_hash, salt, created_at) values ('${crypto.randomUUID()}','${email}','admin','${password_hash}','${salt}','${new Date().toISOString()}') ` +
  `on conflict (email) do update set password_hash = excluded.password_hash, salt = excluded.salt, rol = 'admin'; ` +
  // cambiar la clave cierra TODAS las sesiones de esa persona (recuperar una cuenta no debe dejar entrar a quien tenía una cookie)
  `delete from sessions where user_id = (select id from users where email = '${email}');`;
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('npx', ['wrangler', 'd1', 'execute', 'agents-office-db', remoto ? '--remote' : '--local', '--command', sql], { cwd: raiz, stdio: 'inherit' });
console.log(`Administrador listo: ${email}`);
