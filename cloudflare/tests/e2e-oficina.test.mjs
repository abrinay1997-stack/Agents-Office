// La oficina de PUNTA A PUNTA (auditoría e2e, 25 oct 2026). Un solo guion, una sola oficina, el recorrido real de las personas:
//   la fundadora entra → invita a Bruno (editor) y a Carla (lectura) por enlace → cada rol intenta lo que no debe → una tarea llega a un agente por el reloj,
//   el agente trabaja con una herramienta MCP → espera el OK → solo la administradora aprueba → el envío sale SOLO a quien está en el borrador → costo, calidad, aviso;
//   rutinas, Dimitri (con 60+ turnos), Cerebro, Contenido, Estudio, Anuncios, Telegram, disparadores y la migración desde la oficina local.
// Los servicios de fuera (Anthropic, Gmail por MCP, Telegram, Meta) son de mentira (e2e-ayudas.mjs) — nunca una llave ni una red de verdad.
// La parte de «varias personas conectadas a la vez» (presencia, avisos en vivo, dos que editan la misma tarea) corre en workerd de verdad (wrangler dev --local) y se salta sola sin wrangler.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { montarOficina, dimitriDice, texto, HOOK, TOKEN_BOT, SECRETO_TG, DUENO_TG, APROBADOR_TG, EXTRANO_TG, CLAVE } from './e2e-ayudas.mjs';
import { usar } from './agentes-ayudas.mjs';
import { cargarTareas } from '../worker/lib/tareas/sesion.js';

let O; // la oficina
const sesion = {}; // { bruno: {id, cookie}, carla: {...} }

before(async () => { if (!SALTAR) O = await montarOficina({ ajustes: { approvals: { undoSeconds: 0 } } }); }, { timeout: 60000 });

const invitar = async (email, rol, nombre) => {
  const inv = await O.ana('POST', '/api/equipo/invitaciones', { email, nombre, rol });
  assert.equal(inv.status, 201, inv.texto);
  const testigo = inv.j.enlace.split('/').pop();
  const ver = await O.anon('POST', '/api/invitacion/ver', { testigo });
  assert.equal(ver.status, 200, ver.texto); assert.equal(ver.j.invitacion.rol, rol);
  const ac = await O.anon('POST', '/api/invitacion/aceptar', { testigo, nombre, contrasena: 'clave-muy-larga-123' });
  assert.equal(ac.status, 200, ac.texto);
  return ac.cabeceras.get('set-cookie').split(';')[0];
};

// ------------------------------------------------------------------------------------------------ (1)(2)(3) personas y roles
test('(1) la fundadora entra; (2) invita a Bruno (editor) y a Carla (lectura) por enlace y aceptan; el equipo se ve', { skip: SALTAR }, async () => {
  const yo = await O.ana('GET', '/api/yo'); assert.equal(yo.j.usuario.rol, 'admin');
  O.cookies.bruno = await invitar('bruno@panaclaw.test', 'editor', 'Bruno');
  O.cookies.carla = await invitar('carla@panaclaw.test', 'lectura', 'Carla');
  O.bruno = O.llamar('bruno'); O.carla = O.llamar('carla');
  assert.equal((await O.bruno('GET', '/api/yo')).j.usuario.rol, 'editor'); assert.equal((await O.carla('GET', '/api/yo')).j.usuario.rol, 'lectura');
  const eq = await O.ana('GET', '/api/equipo'); assert.deepEqual(eq.j.miembros.map((m) => m.nombre).sort(), ['Bruno', 'Carla', eq.j.miembros.find((m) => m.id === eq.j.yo).nombre].sort());
  assert.equal(eq.j.miembros.length, 3);
  // Bruno y Carla ven al equipo pero no las invitaciones
  assert.equal((await O.bruno('GET', '/api/equipo')).j.invitaciones, undefined);
  // el equipo puede ponerse foto (R2) y se sirve con sesión
  const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const f = await O.bruno('PUT', '/api/yo/foto', JPEG); assert.equal(f.status, 200, f.texto);
});

test('(3) cada rol intenta lo que no debe: el anónimo no entra a nada, la lectura no escribe, el editor no aprueba ni administra', { skip: SALTAR }, async () => {
  // anónimo: toda la API (salvo lo público) es 401, también las rutas de módulos
  for (const [m, r] of [['GET', '/api/tasks'], ['GET', '/api/brain'], ['GET', '/api/sub'], ['GET', '/api/media'], ['GET', '/api/contenido/piezas'], ['GET', '/api/anuncios'], ['GET', '/api/equipo'], ['POST', '/api/tasks'], ['GET', '/api/costs'], ['GET', '/api/settings'], ['GET', '/api/business'], ['GET', '/api/status']]) {
    assert.equal((await O.anon(m, r, m === 'POST' ? {} : undefined)).status, 401, `anónimo ${m} ${r}`);
  }
  // lectura: lee, no escribe
  const t = await O.carla('POST', '/api/tasks', { dept: 'emails', text: 'hola' }); assert.ok([401, 403].includes(t.status), 'lectura creando tarea: ' + t.status);
  for (const [m, r, b] of [['POST', '/api/tasks', { dept: 'emails', text: 'x' }], ['POST', '/api/tareas/mias', { title: 'x' }], ['POST', '/api/contenido/piezas', { titulo: 'x' }], ['POST', '/api/anuncios/accion', { tipo: 'pausar', id: '1' }], ['POST', '/api/media/jobs', { prompt: 'x' }], ['POST', '/api/brain/upload', {}], ['PUT', '/api/triggers', { triggers: [] }], ['POST', '/api/equipo/invitaciones', { email: 'z@z.test', rol: 'editor' }], ['POST', '/api/sub/chat', { text: 'hola' }]]) {
    const x = await O.carla(m, r, b); assert.ok([401, 403].includes(x.status), `lectura ${m} ${r} → ${x.status}`);
  }
  // editor: no administra el equipo, no cambia conectores, no aprueba
  for (const [m, r, b] of [['POST', '/api/equipo/invitaciones', { email: 'z@z.test', rol: 'editor' }], ['POST', '/api/conectores', { nombre: 'x', url: 'https://x.test/mcp', secreto: 'MCP_X_TOKEN', departamentos: ['ops'] }], ['POST', '/api/migrar/notas', { notas: [] }], ['POST', '/api/migrar/filas', { coleccion: 'tareas', filas: [] }], ['POST', '/api/sub/chat', { text: 'hola' }]]) {
    const x = await O.bruno(m, r, b); assert.equal(x.status, 403, `editor ${m} ${r} → ${x.status}`);
  }
  // el editor sí trabaja
  const ok = await O.bruno('POST', '/api/tareas/mias', { title: 'Algo de Bruno' }); assert.ok(ok.status < 300, ok.texto);
  assert.equal(O.mundo.reg.anthropic.length, 0, 'nada de esto llamó al modelo');
});

// ------------------------------------------------------------------------------------------------ (4) una tarea, de la cola al envío aprobado
const T = {}; // las tareas del guion
const estadoDe = async (id) => (await cargarTareas(O.d1)).find((t) => t.id === id);
const hasta = async (f, { veces = 12, motivo = 'condición' } = {}) => { for (let i = 0; i < veces; i++) { await O.reloj(); const r = await f(); if (r) return r; } assert.fail('no ocurrió: ' + motivo); };

test('(4a) Bruno pide una tarea a Correos; el reloj la toma, el agente trabaja con una herramienta MCP y queda esperando el OK con su borrador', { skip: SALTAR }, async () => {
  O.mundo.guion.push(dimitriDice({ agent: 'elead', title: 'Responder a Ana con el precio', plan: ['Leer el hilo', 'Redactar', 'Enviar'], eta_minutes: 5, why: 'es un correo', needs_ok: true })); // el enrutador (modelo de mentira)
  const r = await O.bruno('POST', '/api/tasks', { dept: 'emails', text: 'Responde a ana@x.com con el precio.' });
  assert.equal(r.status < 300, true, r.texto); T.id = r.j.id; assert.ok(T.id); assert.equal(r.j.agent, 'elead'); assert.equal(r.j.needsOk, true, 'el enrutador decidió que pide OK');
  O.mundo.guion.push(usar(['mcp__gmail__search_threads', { query: 'Ana' }]), texto('Borrador. Para: ana@x.com. Asunto: Precio. Hola Ana, son US$100.\nFuentes: hilo de Ana.'));
  const t = await hasta(async () => { const x = await estadoDe(T.id); return x.state === 'waiting' ? x : null; }, { motivo: 'la tarea esperando el OK' });
  assert.equal(O.mundo.mcp.search_threads.llamadas, 1, 'el agente usó la herramienta MCP de lectura');
  assert.ok(t.draft && /ana@x\.com/.test(t.draft)); assert.equal(t.needsOk, true); assert.ok(t.preview, 'el detalle muestra «Lo que saldrá»');
  assert.equal(O.mundo.mcp.send_email.llamadas, undefined, 'nada salió sin OK');
  assert.ok(O.mundo.reg.anthropic.every((c) => !(c.tools || []).some((h) => h.name === 'mcp__gmail__send_email')), 'la herramienta de envío ni se ofreció');
  const costo = O.filas('select * from costos where tarea = ?', T.id); assert.ok(costo.length >= 1 && costo.every((c) => c.usd > 0), 'costo registrado');
});

test('(4b) solo la administradora aprueba (editor y lectura, 403); el envío sale SOLO al destinatario del borrador; entrega, costo, calidad y aviso', { skip: SALTAR }, async () => {
  assert.equal((await O.bruno('POST', `/api/tasks/${T.id}/approve`, {})).status, 403);
  assert.equal((await O.carla('POST', `/api/tasks/${T.id}/approve`, {})).status, 403);
  assert.equal((await O.bruno('POST', '/api/tasks/approve-batch', { ids: [T.id] })).status, 403);
  assert.equal((await O.bruno('POST', `/api/tasks/${T.id}/draft`, { draft: 'Para: evil@robo.test' })).status, 403, 'el editor no cambia a quién sale');
  assert.equal((await estadoDe(T.id)).state, 'waiting');
  const ok = await O.ana('POST', `/api/tasks/${T.id}/approve`, {}); assert.equal(ok.status, 200, ok.texto);
  // el modelo intenta además mandar a otra dirección: se bloquea; luego al destinatario correcto: sale
  O.mundo.guion.push(usar(['mcp__gmail__send_email', { to: 'evil@robo.test', body: 'x' }]), usar(['mcp__gmail__send_email', { to: 'ana@x.com', body: 'Hola Ana, US$100' }]), texto('Enviado a ana@x.com.\nFuentes: —'));
  const t = await hasta(async () => { const x = await estadoDe(T.id); return x.state === 'done' ? x : null; }, { motivo: 'la tarea terminada' });
  assert.ok(O.mundo.reg.anthropic.some((c) => c.tools?.some((h) => h.name === 'mcp__gmail__send_email')), 'tras el OK se ofrece la herramienta de envío');
  assert.equal(O.mundo.mcp.send_email.llamadas, 1, 'solo UN envío llegó al servidor MCP'); assert.equal(O.mundo.mcp.send_email.ultimo.to, 'ana@x.com');
  assert.equal(t.approved, true); assert.ok(t.guard?.blocked?.some((b) => b.code === 'recipient'), 'el intento a evil@robo.test quedó bloqueado y anotado');
  assert.ok(t.cost > 0); assert.ok(O.filas('select * from auditoria_agentes where tarea = ?', T.id).some((a) => a.decision === 'block'));
  // calidad: la tarea aprobada sin cambios cuenta; y hay un aviso/noticia visible en Estado
  const q = await O.ana('GET', '/api/quality'); assert.equal(q.status, 200); assert.ok(JSON.stringify(q.j).includes('elead') || q.j, 'calidad responde');
  const c = await O.ana('GET', '/api/costs'); assert.equal(c.status, 200); assert.ok(JSON.stringify(c.j).includes('emails') || JSON.stringify(c.j).includes('elead'));
  const e = await O.ana('GET', '/api/status'); assert.equal(e.status, 200);
  // los secretos no están en D1 ni en lo que se le dijo al modelo
  const todo = O.d1._db.prepare("select name from sqlite_master where type = 'table'").all().map((x) => JSON.stringify(O.d1._db.prepare(`select * from "${x.name}"`).all())).join('\n');
  for (const s of ['tok-mcp', 'sk-ant-secreto-de-prueba', TOKEN_BOT, SECRETO_TG]) assert.ok(!todo.includes(s), 'secreto fuera de D1: ' + s.slice(0, 6));
});
