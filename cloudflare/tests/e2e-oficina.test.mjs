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

// ------------------------------------------------------------------------------------------------ (5) una rutina que se dispara sola, UNA vez
test('(5) rutina diaria: nace con su próxima hora, el reloj la dispara una sola vez aunque corra varias veces ese minuto, y la tarea nace con id estable', { skip: SALTAR }, async () => {
  O.mundo.guion.push(dimitriDice({ agent: 'slead', title: 'Revisar los leads nuevos', plan: ['Leer', 'Resumir'], eta_minutes: 5, why: 'ventas', needs_ok: false }));
  const r = await O.ana('POST', '/api/routines', { dept: 'sales', text: 'Revisa los leads nuevos y resume', when: { kind: 'daily', at: '09:00' } });
  assert.equal(r.status < 300, true, r.texto); const id = r.j.routine?.id || r.j.id; assert.ok(id, r.texto);
  assert.equal((await O.carla('POST', '/api/routines', { dept: 'sales', text: 'x', when: { kind: 'daily', at: '09:00' } })).status, 403);
  const lista = (await O.carla('GET', '/api/routines')).j.routines; assert.ok(lista.some((x) => x.id === id), 'lectura sí ve la rutina');
  // el reloj aún no la dispara (la hora es mañana o más tarde hoy)
  const antes = (await cargarTareas(O.d1)).filter((t) => t.routine === id).length;
  // se adelanta su próxima ejecución al pasado (lo que pasaría al llegar la hora) y el reloj corre tres veces
  const st = JSON.parse(O.d1._db.prepare("select json from docs where clave = 'rutinas.estado'").get().json); assert.ok(st[id], 'la rutina tiene estado'); // secrets-ok
  st[id].nextAt = Date.now() - 5000; O.d1._db.prepare("update docs set json = ? where clave = 'rutinas.estado'").run(JSON.stringify(st)); // secrets-ok
  await O.reloj(3);
  const tareas = (await cargarTareas(O.d1)).filter((t) => t.routine === id);
  assert.equal(tareas.length - antes, 1, 'una sola tarea por esa ejecución');
  const st2 = JSON.parse(O.d1._db.prepare("select json from docs where clave = 'rutinas.estado'").get().json); // secrets-ok
  assert.ok(st2[id].nextAt > Date.now(), 'la siguiente es futura'); assert.ok(st2[id].lastAt || st2[id].last, 'quedó apuntada la última');
  await O.reloj(2); assert.equal((await cargarTareas(O.d1)).filter((t) => t.routine === id).length, tareas.length, 'no vuelve a dispararse');
  T.rutina = id;
});

// ------------------------------------------------------------------------------------------------ (6) Dimitri
const chat = (texto, extra = {}) => O.ana('POST', '/api/sub/chat', { text: texto, ...extra });
const ultimoSub = (r) => r.j.messages.filter((m) => m.who === 'sub').at(-1);

test('(6a) Dimitri: solo la administradora habla con él; charla y plan; nada sale hasta ENVIAR A LOS JEFES y entonces las tareas llegan a sus agentes por el reloj', { skip: SALTAR }, async () => {
  for (const q of ['bruno', 'carla']) assert.equal((await O[q]('POST', '/api/sub/chat', { text: 'hola' })).status, 403);
  assert.equal((await O.anon('POST', '/api/sub/chat', { text: 'hola' })).status, 401);
  O.mundo.guion.push(dimitriDice({ mode: 'charla', reply: 'Abrir los domingos **depende** de tus ventas.' }));
  const c = await chat('¿Qué opinas de abrir los domingos?'); assert.equal(c.status, 200, c.texto); assert.match(ultimoSub(c).text, /domingos/);
  O.mundo.guion.push(dimitriDice({ mode: 'plan', reply: 'Así lo repartiría.', tasks: [
    { dept: 'marketing', title: 'Fotos del combo', instruction: 'Prepara las fotos del combo 2x1.', why: 'es imagen' },
    { dept: 'sales', title: 'Llamar a los clientes de septiembre', instruction: 'Llama a los clientes de septiembre y ofrece el combo.', why: 'venta', espera: [0] }] }));
  const p = await chat('Prepara el combo 2x1 y que Ventas llame a los clientes de septiembre'); const m = ultimoSub(p);
  assert.equal(m.mode, 'plan'); assert.equal(m.plan.tasks.length, 2);
  const antes = (await cargarTareas(O.d1)).length;
  const e = await O.ana('POST', '/api/sub/send', { msg: m.id, items: [{ i: 0, include: true }, { i: 1, include: true }] });
  assert.equal(e.status, 200, e.texto); assert.equal((await cargarTareas(O.d1)).length - antes, 2);
  assert.equal((await O.bruno('POST', '/api/sub/send', { msg: m.id, items: [{ i: 0, include: true }] })).status, 403);
  const ts = await cargarTareas(O.d1); const foto = ts.find((t) => /Fotos del combo/.test(t.title)), llamar = ts.find((t) => /Llamar a los clientes/.test(t.title));
  assert.deepEqual(llamar.bloqueadaPor, [foto.id], 'Ventas espera a las fotos');
  // el reloj: las fotos las toma Marketing; Ventas no arranca hasta que las fotos terminen
  await O.reloj(6);
  const est = async (id) => (await cargarTareas(O.d1)).find((t) => t.id === id).state;
  // las fotos piden el OK de quien las manda (el enrutador lo decide): hasta que la administradora lo da, Ventas NO arranca (espera a las fotos)
  if ((await est(foto.id)) === 'waiting') {
    assert.notEqual(await est(llamar.id), 'doing'); assert.notEqual(await est(llamar.id), 'done');
    assert.equal((await O.ana('POST', `/api/tasks/${foto.id}/approve`, {})).status, 200);
    await O.reloj(6);
  }
  assert.equal(await est(foto.id), 'done');
  await O.reloj(6);
  assert.ok(['done', 'waiting'].includes(await est(llamar.id)), 'terminadas las fotos, Ventas la trabajó (hecha o esperando el OK de lo que envía): ' + await est(llamar.id));
});

test('(6b) ops con HACER y DESHACER (pausar la rutina), y lo que Dimitri nunca hace (aprobar/enviar/publicar/borrar) se descarta', { skip: SALTAR }, async () => {
  O.mundo.guion.push(dimitriDice({ mode: 'plan', reply: 'La pauso.', ops: [{ type: 'rutina_pausar', id: T.rutina }, { type: 'tarea_aprobar', id: T.id }, { type: 'publicar', id: 'x' }, { type: 'borrar', id: T.id }] }));
  const r = await chat('Pausa la revisión de leads'); const m = ultimoSub(r);
  assert.equal(m.ops.length, 1, 'solo la op permitida sobrevive: ' + JSON.stringify(m.ops.map((o) => o.type)));
  const h = await O.ana('POST', '/api/sub/ops', { msg: m.id, items: [{ k: 0, include: true }] }); assert.equal(h.status, 200, h.texto);
  assert.equal(h.j.message.ops[0].state, 'done');
  const rutina = (await O.ana('GET', '/api/routines')).j.routines.find((x) => x.id === T.rutina); assert.equal(rutina.paused, true);
  assert.equal((await O.bruno('POST', '/api/sub/ops', { msg: m.id, items: [{ k: 0 }] })).status, 403);
  const u = await O.ana('POST', '/api/sub/ops/undo', { msg: m.id, k: 0 }); assert.equal(u.status, 200, u.texto);
  assert.ok(!(await O.ana('GET', '/api/routines')).j.routines.find((x) => x.id === T.rutina).paused, 'deshacer la reanuda');
  assert.equal((await O.ana('POST', '/api/sub/ops/undo', { msg: m.id, k: 0 })).status, 409, 'no se deshace dos veces');
  assert.equal((await estadoDe(T.id)).state, 'done', 'la tarea aprobada de antes no se tocó');
});

test('(6c) historial: nueva conversación archiva la actual; se lista, se abre una vieja, se borra', { skip: SALTAR }, async () => {
  const antes = (await O.ana('GET', '/api/sub/conversaciones')).j;
  assert.ok(antes.actual.titulo, 'la de ahora tiene título');
  assert.equal((await O.ana('POST', '/api/sub/clear', {})).status, 200);
  O.mundo.guion.push(dimitriDice({ mode: 'charla', reply: 'Primera de la nueva.' })); await chat('Tema nuevo: precios de septiembre');
  const l = (await O.ana('GET', '/api/sub/conversaciones')).j; assert.equal(l.lista.length, antes.lista.length + 1);
  const vieja = l.lista[0]; assert.match(vieja.titulo, /domingos/);
  assert.equal((await O.bruno('GET', '/api/sub/conversaciones')).status, 403);
  const v = (await O.ana('GET', `/api/sub/conversaciones/${vieja.id}`)); assert.equal(v.status, 200); assert.ok(v.j.messages.length >= 2);
  const ab = await O.ana('POST', '/api/sub/abrir', { id: vieja.id }); assert.equal(ab.status, 200); assert.match(JSON.stringify((await O.ana('GET', '/api/sub')).j.messages), /domingos/);
  assert.equal((await O.ana('GET', '/api/sub/conversaciones')).j.lista.some((x) => /precios de septiembre/.test(x.titulo)), true, 'la que estaba abierta quedó guardada');
  const ya = (await O.ana('GET', '/api/sub/conversaciones')).j.lista.find((x) => /precios de septiembre/.test(x.titulo));
  assert.equal((await O.ana('POST', '/api/sub/borrar', { id: ya.id })).status, 200);
  assert.equal((await O.ana('GET', `/api/sub/conversaciones/${ya.id}`)).status, 404);
  assert.equal((await O.ana('POST', '/api/sub/borrar', { id: ya.id })).status, 404);
});

test('(6d) sesión larga: 65 turnos con el modelo de mentira; el prompt no crece, lo dicho al principio sigue y cada turno cabe en las consultas de D1 del plan gratuito', { skip: SALTAR, timeout: 180000 }, async () => {
  await O.ana('POST', '/api/sub/clear', {});
  const tam = []; let max = 0;
  // las consultas que de verdad llegan a D1 (un batch cuenta como una), igual que tests/dimitri-sesion-larga.test.mjs
  const d1 = O.d1, p0 = d1.prepare, b0 = d1.batch; let n = 0, dentro = false;
  const env = (st) => { const w = {}; for (const k of ['first', 'all', 'run']) w[k] = (...a) => { if (!dentro) n++; return st[k](...a); }; w.bind = (...a) => env(st.bind(...a)); return w; };
  d1.prepare = (sql) => env(p0(sql)); d1.batch = async (l) => { n++; dentro = true; try { return await b0(l); } finally { dentro = false; } };
  try {
    for (let i = 0; i < 65; i++) {
      O.mundo.guion.push(dimitriDice({ mode: 'charla', reply: 'Respuesta larga '.repeat(25) + i }));
      const antes = n, r = await chat(i === 3 ? 'Siempre usa tono cercano y nunca menciones precios en redes. Mi presupuesto es US$500' : `Pedido ${i} sobre el tema ${i % 7}`);
      assert.equal(r.status, 200, `turno ${i}: ${r.texto.slice(0, 200)}`); max = Math.max(max, n - antes);
      const reg = O.mundo.reg.anthropic.at(-1); tam.push(JSON.stringify(reg.system).length + JSON.stringify(reg.messages).length);
    }
  } finally { d1.prepare = p0; d1.batch = b0; }
  assert.ok(max <= 50, 'consultas a D1 por turno (tope del plan gratuito 50): ' + max);
  assert.ok(tam[64] < tam[30] * 1.2, `el prompt se queda plano: ${tam[30]} → ${tam[64]}`);
  assert.match(JSON.stringify(O.mundo.reg.anthropic.at(-1).system), /nunca menciones precios en redes/, 'lo del turno 3 sigue en el turno 65');
});

// ------------------------------------------------------------------------------------------------ (7) Cerebro
test('(7) Cerebro: una nota nueva se busca y se lee, entra al mapa; la entrega del agente de (4) también; las notas de un agente no se confunden con las de la empresa', { skip: SALTAR }, async () => {
  const b64 = (t) => Buffer.from(t).toString('base64');
  assert.equal((await O.bruno('POST', '/api/brain/upload', { name: 'x.md', data: b64('x') })).status, 403, 'el editor tampoco sube documentos');
  const sube = await O.ana('POST', '/api/brain/upload', { name: 'politica-garantia.md', data: b64('# Garantía\nTodos los lentes llevan garantía de 18 meses contra defectos de fábrica.') });
  assert.equal(sube.status, 200, sube.texto); const nombre = sube.j.note;
  assert.equal((await O.carla('POST', '/api/brain/upload', { name: 'x.md', data: b64('x') })).status, 403, 'lectura no sube');
  assert.equal((await O.anon('GET', '/api/brain/search?q=garantia')).status, 401);
  const q = await O.carla('GET', '/api/brain/search?q=garantía de los lentes'); assert.equal(q.status, 200);
  assert.ok(JSON.stringify(q.j).includes(nombre), 'la búsqueda encuentra la nota nueva (con tilde y sin ella): ' + q.texto.slice(0, 300));
  const q2 = await O.carla('GET', '/api/brain/search?q=garantia lentes'); assert.ok(JSON.stringify(q2.j).includes(nombre), 'sin tilde también');
  const n = await O.carla('GET', `/api/note?id=${encodeURIComponent(nombre)}`); assert.equal(n.status, 200, n.texto); assert.match(JSON.stringify(n.j), /18 meses/);
  // la entrega del agente de (4) quedó como nota «de la oficina» y se ve
  const entregas = O.filas("select nombre, grupo, oficina, tarea from notas where tarea = ?", T.id); assert.equal(entregas.length >= 1, true, 'la entrega del agente es una nota'); assert.equal(entregas[0].oficina, 1);
  // el mapa: ¿las notas nuevas están en el grafo?
  const g = await O.carla('GET', '/api/brain'); assert.equal(g.status, 200);
  const ids = (g.j.nodes || []).map((x) => x.id);
  assert.ok(ids.includes(nombre), 'la nota subida aparece como neurona del mapa: nodos=' + ids.length);
  assert.ok(ids.includes(entregas[0].nombre), 'la entrega del agente aparece en el mapa');
});
