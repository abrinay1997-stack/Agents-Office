// Las conexiones de Claude (MCP) se CORTAN cuando la persona cambia: la quitan del equipo, le bajan el rol, cambia su contraseña o cierra todas sus sesiones; y al restablecer la oficina.
// También: el panel de Ajustes → «Conectar Claude» (solo administradores) lista y corta, y la poda de lo que caduca.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR, sembrar } from './d1-memoria.mjs';
import { mundo } from './mcp-ayudas.mjs';
import { podar } from '../worker/lib/mantenimiento.js';
import { aplicarReinicio, crearReinicio } from '../worker/lib/equipo.js';
import { PALABRA } from '../../restablecer-core.mjs';

const opts = { skip: SALTAR };

/** Una oficina con un SEGUNDO administrador (no fundador) que conecta; el primero (fundador) lo gestiona. */
async function dosAdmins() {
  const m = await mundo();
  const seg = await sembrar(m.d1, { email: 'admin2@panaclaw.test', rol: 'admin' });
  m.db.prepare("update users set created_at = '2999-01-01T00:00:00.000Z' where email = ?").run(seg.email);
  const r = await m.crudo('/api/acceso', { metodo: 'POST', cuerpo: { email: seg.email, contrasena: seg.clave } });
  m.cookies.admin2 = r.headers.get('set-cookie').split(';')[0]; m.admin2 = m.como('admin2');
  m.id2 = m.db.prepare('select id from users where email = ?').get(seg.email).id; m.seg = seg;
  return m;
}
const vivas = (m, uid) => m.db.prepare('select count(*) n from mcp_tokens where user_id = ? and revocado_at is null').get(uid).n;

test('lo que corta una conexión: bajar el rol, quitar del equipo, cambiar la contraseña, cerrar todas las sesiones, restablecer una contraseña', opts, async () => {
  // 1) bajarle el rol (PATCH /api/equipo/<id>)
  { const m = await dosAdmins(); const t = (await m.conectar({ q: 'admin2', alcance: 'oficina' })).tokens;
    assert.equal(vivas(m, m.id2), 1); assert.equal((await m.admin('PATCH', `/api/equipo/${m.id2}`, { rol: 'editor' })).status, 200);
    assert.equal(vivas(m, m.id2), 0, 'bajar de rol cortó la conexión (el gancho, no solo el rol releído)'); assert.equal((await m.rpc(t.access_token, 'ping')).status, 401); }
  // 2) quitarlo del equipo (DELETE /api/equipo/<id>)
  { const m = await dosAdmins(); const t = (await m.conectar({ q: 'admin2' })).tokens;
    assert.equal((await m.admin('DELETE', `/api/equipo/${m.id2}`)).status, 200); assert.equal(vivas(m, m.id2), 0); assert.equal((await m.rpc(t.access_token, 'ping')).status, 401); }
  // 3) cambiar su contraseña (POST /api/yo/contrasena)
  { const m = await dosAdmins(); const t = (await m.conectar({ q: 'admin2' })).tokens;
    const r = await m.admin2('POST', '/api/yo/contrasena', { actual: m.seg.clave, nueva: 'otra-clave-bien-larga-1' }); assert.equal(r.status, 200, JSON.stringify(r.j));
    assert.equal(vivas(m, m.id2), 0); assert.equal((await m.rpc(t.access_token, 'ping')).status, 401); }
  // 4) cerrar todas sus sesiones (POST /api/yo/sesiones/cerrar-todas)
  { const m = await dosAdmins(); const t = (await m.conectar({ q: 'admin2' })).tokens;
    assert.equal((await m.admin2('POST', '/api/yo/sesiones/cerrar-todas', {})).status, 200); assert.equal(vivas(m, m.id2), 0); assert.equal((await m.rpc(t.access_token, 'ping')).status, 401); }
  // 5) un administrador restablece su contraseña (enlace de un solo uso)
  { const m = await dosAdmins(); const t = (await m.conectar({ q: 'admin2' })).tokens;
    const c = await crearReinicio(m.d1, { id: m.db.prepare("select id from users where email = 'dueno@panaclaw.test'").get().id }, m.id2); assert.ok(c.testigo);
    const x = await aplicarReinicio(m.d1, c.testigo, 'una-clave-nueva-muy-larga-1'); assert.ok(x.id, JSON.stringify(x));
    assert.equal(vivas(m, m.id2), 0); assert.equal((await m.rpc(t.access_token, 'ping')).status, 401); }
});

test('cortar las conexiones de una persona NO toca las de otra', opts, async () => {
  const m = await dosAdmins(); const a = (await m.conectar({ q: 'admin' })).tokens, b = (await m.conectar({ q: 'admin2' })).tokens;
  await m.admin2('POST', '/api/yo/sesiones/cerrar-todas', {});
  assert.equal((await m.rpc(b.access_token, 'ping')).status, 401); assert.equal((await m.rpc(a.access_token, 'ping')).status, 200);
});

test('RESTABLECER la oficina corta TODAS las conexiones (y un respaldo no las resucita); el interruptor sobrevive', opts, async () => {
  const m = await mundo(); const t = (await m.conectar({ alcance: 'oficina' })).tokens; const cli = (await m.conectar({ alcance: 'lectura' })).tokens;
  const p = await m.admin('POST', '/api/restablecer', { modo: 'vacia', ambitos: ['cerebro'] }); assert.equal(p.status, 200, JSON.stringify(p.j));
  const c = await m.admin('POST', '/api/restablecer/confirmar', { token: p.j.pendiente.token, escribio: PALABRA }); assert.equal(c.status, 200, JSON.stringify(c.j));
  assert.equal((await m.rpc(t.access_token, 'ping')).status, 401); assert.equal((await m.rpc(cli.access_token, 'ping')).status, 401);
  assert.equal(m.db.prepare('select count(*) n from mcp_tokens').get().n, 0);
  assert.equal(m.db.prepare("select count(*) n from docs where clave = 'mcp.config'").get().n, 1, 'el interruptor no se restablece');
  assert.equal((await m.crudo('/.well-known/oauth-authorization-server')).status, 200, 'y el conector sigue encendido: solo hay que volver a conectar');
  const r = await m.admin('POST', '/api/restablecer/deshacer', { id: c.j.respaldo.id }); assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.equal(m.db.prepare('select count(*) n from mcp_tokens').get().n, 0, 'restaurar un respaldo no trae de vuelta las conexiones');
});

test('PANEL (Ajustes → Conectar Claude): solo administradores; lista sin testigos; corta una o todas; queda en la auditoría', opts, async () => {
  const m = await mundo();
  for (const q of ['editor', 'lectura']) {
    assert.equal((await m[q]('GET', '/api/conectar-claude')).status, 403, q);
    assert.equal((await m[q]('POST', '/api/conectar-claude/cortar-todas', {})).status, 403, q);
    assert.equal((await m[q]('DELETE', '/api/conectar-claude/' + 'a'.repeat(32))).status, 403, q);
  }
  assert.equal((await m.crudo('/api/conectar-claude')).status, 401);
  const a = await m.conectar({ alcance: 'oficina', nombre: 'Portátil' }), b = await m.conectar({ alcance: 'lectura', nombre: 'Teléfono' });
  const g = await m.admin('GET', '/api/conectar-claude'); assert.equal(g.status, 200);
  assert.equal(g.j.activo, true); assert.equal(g.j.url, 'https://oficina.test/mcp'); assert.deepEqual(g.j.alcances, ['lectura', 'oficina', 'gasto']);
  assert.deepEqual(g.j.conexiones.map((c) => [c.nombre, c.alcance]).sort(), [['Portátil', 'oficina'], ['Teléfono', 'lectura']]);
  const texto = JSON.stringify(g.j); assert.ok(!texto.includes(a.tokens.access_token) && !texto.includes(a.tokens.refresh_token) && !/_hash|mcpa_|mcpr_/.test(texto), 'la lista no lleva testigos ni huellas');
  assert.equal(g.j.conexiones[0].persona.email, 'dueno@panaclaw.test'); assert.equal(g.j.conexiones.find((c) => c.nombre === 'Teléfono').ultimoUso, null);
  await m.rpc(b.tokens.access_token, 'ping'); assert.ok((await m.admin('GET', '/api/conectar-claude')).j.conexiones.find((c) => c.nombre === 'Teléfono').ultimoUso, 'el último uso se apunta');
  const id = g.j.conexiones.find((c) => c.nombre === 'Portátil').id;
  assert.equal((await m.admin('DELETE', '/api/conectar-claude/' + id)).status, 200);
  assert.equal((await m.rpc(a.tokens.access_token, 'ping')).status, 401); assert.equal((await m.rpc(b.tokens.access_token, 'ping')).status, 200);
  assert.equal((await m.admin('DELETE', '/api/conectar-claude/' + id)).status, 404, 'ya estaba cortada');
  const t = await m.admin('POST', '/api/conectar-claude/cortar-todas', {}); assert.equal(t.status, 200); assert.deepEqual(t.j.conexiones, []);
  assert.equal((await m.rpc(b.tokens.access_token, 'ping')).status, 401);
  const filas = m.db.prepare("select detalle from auditoria where tipo = 'mcp'").all().map((x) => x.detalle).join('\n'); assert.match(filas, /"evento":"cortar"/); assert.match(filas, /"evento":"cortar-todas"/);
});

test('la renovación de una conexión de alguien que dejó de ser administrador falla aunque su testigo sea bueno', opts, async () => {
  const m = await dosAdmins(); const { cli, tokens } = await m.conectar({ q: 'admin2' });
  m.db.prepare("update users set rol = 'editor' where id = ?").run(m.id2); // sin pasar por el gancho: un cambio directo en la base
  const r = await m.token({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: cli }); assert.equal(r.status, 400);
  assert.equal(vivas(m, m.id2), 0);
});

test('PODA: códigos caducados 1 día, testigos 30 días después de caducar/rotarse/cortarse y clientes sin uso 30 días — y lo vivo nunca', opts, async () => {
  const m = await mundo(); const DIA = 864e5, ahora = m.ahora();
  const vivo = await m.conectar(); // un cliente con una conexión viva
  const ci = m.db.prepare('insert into mcp_clientes (client_id, nombre, redirect_uris, creado_at, ultimo_uso_at) values (?,?,?,?,?)');
  ci.run('mcp_' + 'a'.repeat(32), 'viejo sin uso', '[]', ahora - 40 * DIA, null); ci.run('mcp_' + 'b'.repeat(32), 'viejo usado hace poco', '[]', ahora - 40 * DIA, ahora - 2 * DIA); ci.run('mcp_' + 'c'.repeat(32), 'nuevo', '[]', ahora - DIA, null);
  const co = m.db.prepare('insert into mcp_codigos (codigo_hash, client_id, user_id, redirect_uri, code_challenge, alcance, nombre, familia, caduca_at) values (?,?,?,?,?,?,?,?,?)');
  const uid = m.db.prepare('select id from users limit 1').get().id;
  co.run('1'.repeat(64), vivo.cli, uid, 'u', 'r', 'lectura', 'n', 'f1', ahora - 2 * DIA); co.run('2'.repeat(64), vivo.cli, uid, 'u', 'r', 'lectura', 'n', 'f2', ahora - 60_000);
  const ti = m.db.prepare("insert into mcp_tokens (id, familia, access_hash, refresh_hash, client_id, user_id, rol, alcance, nombre, familia_creada_at, creado_at, access_caduca_at, refresh_caduca_at, rotado_at, revocado_at) values (?,?,?,?,?,?,'admin','lectura','n',?,?,?,?,?,?)");
  ti.run('t-caducado', 'fa', 'ha1', 'hr1', vivo.cli, uid, ahora - 90 * DIA, ahora - 90 * DIA, ahora - 90 * DIA, ahora - 40 * DIA, null, null);
  ti.run('t-rotado', 'fb', 'ha2', 'hr2', vivo.cli, uid, ahora - 90 * DIA, ahora - 90 * DIA, ahora - 90 * DIA, ahora + 5 * DIA, ahora - 40 * DIA, null);
  ti.run('t-cortado', 'fc', 'ha3', 'hr3', vivo.cli, uid, ahora - 90 * DIA, ahora - 90 * DIA, ahora - 90 * DIA, ahora + 5 * DIA, null, ahora - 40 * DIA);
  ti.run('t-rotado-ayer', 'fd', 'ha4', 'hr4', vivo.cli, uid, ahora - 9 * DIA, ahora - 9 * DIA, ahora - 9 * DIA, ahora + 5 * DIA, ahora - DIA, null);
  const n = await podar(m.d1, ahora);
  assert.equal(n.mcp_codigos, 1); assert.equal(n.mcp_tokens, 3); assert.equal(n.mcp_clientes, 1);
  assert.deepEqual(m.db.prepare('select id from mcp_tokens where id like ? order by id').all('t-%').map((x) => x.id), ['t-rotado-ayer'], 'lo rotado ayer se queda (sirve para detectar un reuso)');
  assert.deepEqual(m.db.prepare("select nombre from mcp_clientes where nombre in ('viejo sin uso','viejo usado hace poco','nuevo') order by nombre").all().map((x) => x.nombre), ['nuevo', 'viejo usado hace poco']);
  assert.equal(m.db.prepare("select count(*) n from mcp_tokens where familia != 'fd' and id not like 't-%'").get().n, 1, 'la conexión viva sigue'); assert.equal((await m.rpc(vivo.tokens.access_token, 'ping')).status, 200);
});
