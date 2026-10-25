// Levanta el Worker de verdad (workerd, por `wrangler dev --local`) con una D1 y un R2 temporales, para probar lo que NO se puede afirmar leyendo código:
// que el binding HUB existe, que el socket entra, que dos personas caen en el MISMO objeto y que lo que escribe una LLEGA a la otra.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { hashearContrasena } from '../worker/lib/sesion.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CLAVE = 'clave-de-prueba-larga-1'; // secrets-ok
const wrangler = (args, opts = {}) => ({ cmd: 'npx', args: ['--no-install', 'wrangler', ...args], opts: { cwd: RAIZ, ...opts } });

/** ¿Se puede correr wrangler aquí? (el CI de la oficina local no lo instala: el test se salta con su motivo). */
export function hayWrangler() {
  if (process.env.AO_SIN_VIVO === '1') return 'AO_SIN_VIVO=1';
  try { execFileSync('npx', ['--no-install', 'wrangler', '--version'], { cwd: RAIZ, stdio: 'pipe', timeout: 60000 }); return false; } catch { return 'wrangler no está instalado (el workflow de Cloudflare sí lo instala)'; }
}
const puertoLibre = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
const sql = (s) => `'${String(s).replace(/'/g, "''")}'`;

export async function levantar({ usuarios, args: extra = [] }) {
  const persist = mkdtempSync(join(tmpdir(), 'ao-vivo-'));
  const w = (args) => { const { cmd, args: a, opts } = wrangler(args); return execFileSync(cmd, a, { ...opts, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000, env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } }); };
  w(['d1', 'migrations', 'apply', 'agents-office-db', '--local', '--persist-to', persist]);
  const filas = [];
  for (const u of usuarios) {
    const { salt, password_hash } = await hashearContrasena(CLAVE);
    filas.push(`insert into users (id,email,rol,password_hash,salt,created_at) values (${sql(u.id)},${sql(u.email)},${sql(u.rol)},${sql(password_hash)},${sql(salt)},${sql(new Date().toISOString())});`);
    filas.push(`insert into perfiles (user_id,nombre,color,updated_at) values (${sql(u.id)},${sql(u.nombre)},${sql(u.color || '#1E6FD9')},${sql(new Date().toISOString())});`);
  }
  w(['d1', 'execute', 'agents-office-db', '--local', '--persist-to', persist, '--command', filas.join(' ')]);
  const puerto = await puertoLibre();
  const { cmd, args, opts } = wrangler(['dev', '--local', '--persist-to', persist, '--port', String(puerto), '--ip', '127.0.0.1', '--inspector-port', '0', ...extra]);
  const hijo = spawn(cmd, args, { ...opts, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' } });
  let log = '';
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('wrangler dev no arrancó en 120 s:\n' + log.slice(-1500))), 120000);
    const ver = (d) => { log += d; if (/Ready on/.test(log)) { clearTimeout(t); res(); } };
    hijo.stdout.on('data', ver); hijo.stderr.on('data', ver);
    hijo.on('exit', (c) => { clearTimeout(t); rej(new Error(`wrangler dev terminó (${c}):\n` + log.slice(-1500))); });
  });
  const base = `http://127.0.0.1:${puerto}`;
  const cerrar = async () => { // npx lanza wrangler y este a workerd: se mata el GRUPO entero, o el proceso de la prueba no termina
    const muerto = new Promise((r) => { hijo.on('exit', r); setTimeout(r, 5000); });
    try { process.kill(-hijo.pid, 'SIGTERM'); } catch { hijo.kill('SIGTERM'); }
    await muerto;
    try { process.kill(-hijo.pid, 'SIGKILL'); } catch { /* ya no queda nadie */ }
    hijo.stdout.destroy(); hijo.stderr.destroy(); rmSync(persist, { recursive: true, force: true });
  };
  return { base, cerrar, log: () => log };
}

/** Entra con el acceso real y devuelve la cookie. */
export async function entrar(base, email) {
  const r = await fetch(`${base}/api/acceso`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, contrasena: CLAVE }) });
  if (r.status !== 200) throw new Error(`no se pudo entrar (${r.status}): ${await r.text()}`);
  return r.headers.get('set-cookie').split(';')[0];
}

/** Un socket de cliente que apunta lo que llega y deja esperar un evento. `origen` se manda como cabecera Origin (un navegador siempre la manda). */
export function conectarSocket(base, { cookie, origen = base } = {}) {
  const url = base.replace(/^http/, 'ws') + '/api/live';
  const ws = new WebSocket(url, { headers: { ...(cookie ? { Cookie: cookie } : {}), ...(origen ? { Origin: origen } : {}) } });
  const recibidos = [], esperas = [];
  ws.addEventListener('message', (e) => { if (e.data === 'pong') return; const m = JSON.parse(e.data); recibidos.push(m); for (const w of [...esperas]) if (w.f(m)) { esperas.splice(esperas.indexOf(w), 1); w.ok(m); } });
  const abierto = new Promise((ok, no) => { ws.addEventListener('open', () => ok(true)); ws.addEventListener('error', () => ok(false)); ws.addEventListener('close', () => ok(false)); });
  return {
    ws, recibidos, abierto,
    /** Espera (sin tiempo fijo corto) un evento que cumpla `f`; mira primero lo ya recibido desde `desde`. */
    esperar(f, { ms = 8000, desde = 0 } = {}) {
      const ya = recibidos.slice(desde).find(f); if (ya) return Promise.resolve(ya);
      return new Promise((ok, no) => { const w = { f, ok }; esperas.push(w); setTimeout(() => { const i = esperas.indexOf(w); if (i >= 0) { esperas.splice(i, 1); no(new Error('no llegó el evento esperado; llegó: ' + JSON.stringify(recibidos.slice(-4)))); } }, ms); });
    },
    enviar: (o) => ws.send(typeof o === 'string' ? o : JSON.stringify(o)),
    cerrar: () => { try { ws.close(); } catch { /* ya cerrado */ } },
  };
}
