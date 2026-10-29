// Auditoría TRANSVERSAL (25 oct 2026): lo que las revisiones por fase no miraron porque cruza módulos.
//  · la matriz ruta × método × rol, ejecutada contra una D1 de verdad (lectura nunca escribe; sin sesión todo es 401; el editor no decide lo del dueño);
//  · los atajos entre módulos: /api/tareas/* trata a quien llega por la página como EL DUEÑO, y en la nube un editor no lo es;
//  · límites: tope del cuerpo JSON (también sin sesión) y poda de lo que solo crece;
//  · todo secreto que leen los módulos compartidos está declarado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { crearSincronizador, HISTORIAL_MAX_BYTES, HISTORIAL_GUARDAR_BYTES, HISTORIAL_MINIMO } from '../../anuncios/sincronizar.mjs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manejar, correrReloj, ordenDelReloj } from '../worker/lib/rutas.js';
import { MODULOS } from '../worker/modulos/index.js';
import { cuerpo, TOPE_JSON } from '../worker/lib/respuesta.js';
import { podar, tocaPodar, RETENCION_DIAS, LOTE } from '../worker/lib/mantenimiento.js';
import { conSesion, cargarTareas } from '../worker/lib/tareas/sesion.js';
import { archivarViejas, DIAS_HECHAS_VIVAS, LOTE_ARCHIVO, cadaMinuto as relojTareas } from '../worker/modulos/tareas.js';
import { crearTarea } from '../../tareas/modelo.mjs';
import { instalarZona } from '../worker/lib/zona.js';
import { crearR2 } from './r2-memoria.mjs';
import * as AY from './agentes-ayudas.mjs';
import { herramientasInternas } from '../worker/lib/agentes/herramientas.js';
import { urlPermitida } from '../worker/lib/conectores.js';
import { crearAlmacenD1 } from '../worker/lib/contenido/piezas.js';
import { limpiarSecretos, registrarSecretos } from '../worker/lib/secretos.js';
import { igualSeguro } from '../worker/lib/ids.js';
import { indiceDeNotas, DIAS_ENTREGABLES_EN_EL_INDICE } from '../worker/lib/agentes/contexto.js';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const nada = async () => new Response('{"error":"sin red en las pruebas"}', { status: 500 });

async function oficina(extra = {}) {
  instalarZona('America/Panama');
  const d1 = crearD1();
  const admin = await sembrar(d1), editor = await sembrar(d1, { email: 'ed@panaclaw.test', rol: 'editor' }), lectura = await sembrar(d1, { email: 'le@panaclaw.test', rol: 'lectura' });
  const env = envDePrueba(d1, { ANTHROPIC_API_KEY: 'k', META_ACCESS_TOKEN: 'tok', AO_HOOK_TOKEN: 'h'.repeat(20), __pruebas: { fetchIA: nada, fetch: nada }, ...extra });
  const entrar = async (u) => (await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: u.email, contrasena: u.clave } })).headers.get('set-cookie').split(';')[0];
  const cookies = { admin: await entrar(admin), editor: await entrar(editor), lectura: await entrar(lectura), anon: null };
  const como = (q) => async (metodo, ruta, c) => {
    const r = await manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { 'content-type': 'application/json', ...(cookies[q] ? { cookie: cookies[q] } : {}) }, body: c === undefined ? undefined : JSON.stringify(c) }), env, { waitUntil() {} });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, j };
  };
  return { d1, env, admin: como('admin'), editor: como('editor'), lectura: como('lectura'), anon: como('anon') };
}
const con = (o, fn) => conSesion(o.d1, fn);

/* ---------- 1) la matriz de roles ---------- */
// Rutas que ESCRIBEN (cualquier método distinto de GET). Cada una se prueba como anónimo, lectura y editor; las `soloAdmin` también contra el editor.
// Si se añade una ruta de escritura a un módulo, tiene que aparecer aquí (el último test de este bloque lo exige).
const ESCRIBEN = [
  '/api/yo/sesiones/cerrar', '/api/yo/sesiones/cerrar-todas',
  '/api/modelos', '/api/modelos/probar', '/api/modelos/comparar', '/api/conectores/probar', '/api/conectores/gmail/token',
  '/api/conectores', '/api/conectores/gmail', '/api/migrar/notas', '/api/migrar/filas', '/api/migrar/docs', '/api/agentes/olead/ejecutar',
  '/api/tasks', '/api/tasks/abc123', '/api/tasks/abc123/approve', '/api/tasks/abc123/reject', '/api/tasks/approve-batch', '/api/tasks/abc123/revise', '/api/tasks/abc123/undo', '/api/tasks/abc123/draft',
  '/api/tasks/abc123/run', '/api/tasks/abc123/stop', '/api/tasks/abc123/archive', '/api/tasks/abc123/repeat', '/api/tasks/abc123/example',
  '/api/tareas/mias', '/api/tareas/abc123/estado', '/api/tareas/abc123/delegar', '/api/tareas/abc123/tomar', '/api/tareas/lote',
  '/api/routines', '/api/routines/abc123', '/api/routines/abc123/run', '/api/agents/olead', '/api/agents/olead/forget',
  '/api/contenido/piezas', '/api/contenido/piezas/abc123', '/api/contenido/piezas/abc123/aprobar', '/api/contenido/piezas/abc123/entregar', '/api/contenido/config', '/api/contenido/cola/tick',
  '/api/contenido/llenar', '/api/contenido/mejorar', '/api/contenido/guardados', '/api/contenido/plantillas', '/api/contenido/bandeja/sincronizar', '/api/contenido/bandeja/abc123/enviar',
  '/api/anuncios/accion', '/api/anuncios/borradores', '/api/anuncios/borradores/abc123/crear', '/api/anuncios/sincronizar', '/api/anuncios/deshacer', '/api/anuncios/conversiones',
  '/api/media/jobs', '/api/media/generate', '/api/media/upload', '/api/media/trash/purge', '/api/voces/design', '/api/voces/clone',
  '/api/chat', '/api/sub/chat', '/api/sub/ops', '/api/sub/studio', '/api/settings', '/api/settings/telegram', '/api/cifras', '/api/voice', '/api/business/kpi', '/api/triggers', '/api/onboard/company', '/api/onboard/aplicar', '/api/onboard/descartar', '/api/onboard/deshacer', '/api/restablecer', '/api/restablecer/confirmar', '/api/restablecer/deshacer',
  '/api/equipo/invitaciones', '/api/notices/read', '/api/notificaciones/leer', '/api/notificaciones/config', '/api/chat/config', '/api/chat/canales', '/api/chat/directo', '/api/chat/canales/abc123/mensajes', '/api/chat/canales/abc123/escribiendo', '/api/notas-personales', '/api/notas-personales/config', '/api/notas-personales/preferencias-conexion', '/api/vinculo-telegram/codigo', '/api/vinculo-telegram/confirmar', '/api/vinculo-telegram/desvincular', '/api/notas-personales/0123abcd-0000-0000-0000-000000000000/cerrar', '/api/costs/apply', '/api/anuncios/informe', '/api/contenido/analiticas/actualizar', '/api/contenido/meta/sincronizar', '/api/contenido/analiticas/indicadores',
  '/api/media/presets', '/api/media/presets/apply', '/api/media/lotes', '/api/media/lotes/hoja', '/api/media/folders', '/api/media/move', '/api/media/restore', '/api/media/zip', '/api/media/edit', '/api/media/enhance', '/api/business/value', '/api/brain/upload',
];
// Lo que el editor NO puede hacer aunque pueda escribir en otras partes de la misma oficina (todo lo que decide el dueño, gasta o toca fuera de la oficina).
const SOLO_ADMIN = [
  ['POST', '/api/chat/config'],
  ['PUT', '/api/modelos'], ['POST', '/api/modelos/probar'], ['POST', '/api/modelos/comparar'], ['POST', '/api/conectores/probar'], ['PUT', '/api/conectores/gmail/token'], ['DELETE', '/api/conectores/gmail/token'],
  ['POST', '/api/conectores'], ['POST', '/api/migrar/notas'], ['POST', '/api/migrar/filas'], ['POST', '/api/migrar/docs'],
  ['POST', '/api/tasks/abc123/approve'], ['POST', '/api/tasks/abc123/reject'], ['POST', '/api/tasks/approve-batch'], ['POST', '/api/tasks/abc123/revise'], ['POST', '/api/tasks/abc123/undo'], ['POST', '/api/tasks/abc123/draft'],
  ['POST', '/api/routines'], ['PATCH', '/api/agents/olead'], ['POST', '/api/agents/olead/forget'],
  ['POST', '/api/contenido/piezas/abc123/aprobar'], ['POST', '/api/contenido/piezas/abc123/entregar'], ['PUT', '/api/contenido/config'], ['POST', '/api/contenido/cola/tick'], ['POST', '/api/contenido/llenar'], ['POST', '/api/contenido/mejorar'],
  ['POST', '/api/anuncios/accion'], ['POST', '/api/anuncios/borradores/abc123/crear'], ['POST', '/api/anuncios/sincronizar'], ['POST', '/api/anuncios/deshacer'], ['POST', '/api/anuncios/conversiones'],
  ['POST', '/api/restablecer'], ['POST', '/api/restablecer/confirmar'], ['POST', '/api/restablecer/deshacer'], ['POST', '/api/onboard/aplicar'], ['POST', '/api/onboard/deshacer'], ['POST', '/api/onboard/descartar'],
  ['POST', '/api/sub/chat'], ['POST', '/api/sub/ops'], ['PUT', '/api/settings/telegram'], ['POST', '/api/settings'], ['POST', '/api/costs/apply'], ['POST', '/api/contenido/meta/sincronizar'], ['POST', '/api/contenido/analiticas/actualizar'], ['POST', '/api/contenido/analiticas/indicadores'], ['POST', '/api/business/value'], ['POST', '/api/brain/upload'], ['POST', '/api/cifras'], ['PUT', '/api/triggers'], ['POST', '/api/equipo/invitaciones'], ['POST', '/api/voces/design'],
];

test('MATRIZ: sin sesión, toda ruta de escritura es 401 y nada se escribe', { skip: SALTAR }, async () => {
  const o = await oficina();
  const antes = o.d1._db.prepare('select total_changes() c').get().c;
  for (const r of ESCRIBEN) for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const x = await o.anon(m, r, {});
    assert.equal(x.status, 401, `${m} ${r} sin sesión dio ${x.status}`);
  }
  assert.equal(o.d1._db.prepare('select total_changes() c').get().c, antes, 'sin sesión no se escribe ni una fila');
});

test('MATRIZ: un usuario de solo lectura no puede escribir en NINGUNA ruta (salvo su propia sesión y su perfil)', { skip: SALTAR }, async () => {
  const o = await oficina();
  const suyas = new Set(['/api/yo', '/api/yo/sesiones/cerrar', '/api/yo/sesiones/cerrar-todas', '/api/yo/foto', '/api/yo/contrasena', '/api/salir', '/api/notificaciones/leer', '/api/notas-personales', '/api/notas-personales/0123abcd-0000-0000-0000-000000000000/cerrar', '/api/notas-personales/preferencias-conexion', '/api/vinculo-telegram/codigo', '/api/vinculo-telegram/confirmar', '/api/vinculo-telegram/desvincular']); // (cada cuenta maneja SU vínculo) // (las notas: cualquier rol deja notas a personas y cierra las suyas, D09) // marcar leídas SUS notificaciones es personal (solo toca filas de su user_id)
  for (const r of ESCRIBEN) for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    if (suyas.has(r)) continue;
    const x = await o.lectura(m, r, {});
    assert.ok([403, 404, 405].includes(x.status) || (x.status === 501), `${m} ${r}: lectura recibió ${x.status} ${JSON.stringify(x.j).slice(0, 80)}`);
    assert.notEqual(x.status, 200, `${m} ${r}: lectura escribió`);
  }
});

test('MATRIZ: el editor no puede lo que decide el dueño (aprobar, tocar Meta, conectores, ajustes, Dimitri…)', { skip: SALTAR }, async () => {
  const o = await oficina({ MINIMAX_API_KEY: 'k-de-prueba' }); // con la llave puesta, el rechazo es por rol y no por «falta la llave»
  for (const [m, r] of SOLO_ADMIN) {
    const x = await o.editor(m, r, {});
    assert.equal(x.status, 403, `${m} ${r}: el editor recibió ${x.status} ${JSON.stringify(x.j).slice(0, 100)}`);
  }
});

test('MATRIZ: toda ruta de escritura escrita en un módulo aparece en la lista de arriba', () => {
  // Saca los literales '/api/…' del código de los módulos y de lib/rutas.js (sin comentarios); los de lectura pura no cuentan. Una ruta nueva que escribe tiene que entrar en ESCRIBEN y se prueba sola.
  const fuentes = [join(RAIZ, 'worker/lib/rutas.js'), ...readdirSync(join(RAIZ, 'worker/modulos')).filter((f) => f.endsWith('.js')).map((f) => join(RAIZ, 'worker/modulos', f))];
  const LECTURA = new Set(['/api/acceso', '/api/salir']); // el acceso es público a propósito (tope de intentos) y salir es la sesión de cada quien
  const normal = (r) => r.replace(/\/$/, '');
  const lista = new Set(ESCRIBEN.map(normal));
  const cubierta = (r) => [...lista].some((l) => l === r || r.startsWith(l + '/') || l.startsWith(r + '/'));
  const huerfanas = [];
  for (const f of fuentes) {
    const codigo = readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
    // solo las rutas que se comparan junto a un método que escribe: `ruta === '/api/x' && req.method === 'POST'` (o metodo)
    for (const m of codigo.matchAll(/ruta === '(\/api\/[a-z0-9\-/.]+)'\s*&&\s*\(?(?:req\.method|metodo)\s*(?:===|!==)\s*'(POST|PUT|PATCH|DELETE)'/g)) {
      if (!cubierta(normal(m[1])) && !LECTURA.has(m[1])) huerfanas.push(`${f.slice(RAIZ.length + 1)}: ${m[2]} ${m[1]}`);
    }
  }
  assert.deepEqual(huerfanas, [], 'rutas que escriben y no están en la matriz de roles (añádelas a ESCRIBEN)');
});

/* ---------- 2) atajos entre módulos: /api/tareas/* ---------- */
test('TAREAS: un editor no puede saltarse «necesita el visto bueno» delegando (delegar con needsOk:false es del administrador)', { skip: SALTAR }, async () => {
  const o = await oficina();
  const id = (await o.editor('POST', '/api/tareas/mias', { title: 'Cosa mía', notas: 'detalle' })).j.tarea.id; // (26 oct 2026: una tarea «mía» es de cada cuenta; el editor delega la SUYA)
  const e = await o.editor('POST', `/api/tareas/${id}/delegar`, { a: 'agente', dept: 'ops', needsOk: false });
  assert.equal(e.status, 403); assert.match(e.j.error, /administrador/);
  assert.equal((await con(o, async (s) => s.alm.load().find((t) => t.id === id))).agent, undefined, 'la tarea no se delegó');
  // con el visto bueno pedido, o sin decir nada, sí puede delegar
  assert.equal((await o.editor('POST', `/api/tareas/${id}/delegar`, { a: 'agente', dept: 'ops', needsOk: true })).status, 200);
  const id2 = (await o.admin('POST', '/api/tareas/mias', { title: 'Otra', notas: 'x' })).j.tarea.id;
  const a = await o.admin('POST', `/api/tareas/${id2}/delegar`, { a: 'agente', dept: 'ops', needsOk: false });
  assert.equal(a.status, 200); assert.equal(a.j.tarea.needsOk, false, 'el administrador sí puede');
});

async function conBorradorEnEspera(o) {
  await con(o, async (s) => {
    const l = s.alm.load();
    for (const id of ['espera01', 'espera02', 'espera03']) { const t = crearTarea({ dept: 'ops', agent: 'olead', title: 'Borrador ' + id, text: 'manda el correo', needsOk: true }, { id: () => id }); t.state = 'waiting'; t.draft = 'Borrador para a@b.com'; t.waitingAt = Date.now(); l.push(t); }
    s.alm.save(l);
  });
}

test('TAREAS: lo que espera el OK del dueño no lo mueve, toma, delega, archiva, borra ni reanuda un editor', { skip: SALTAR }, async () => {
  const o = await oficina(); await conBorradorEnEspera(o);
  const intentos = [
    ['POST', '/api/tareas/espera01/estado', { a: 'done' }], ['POST', '/api/tareas/espera01/estado', { a: 'next' }], ['POST', '/api/tareas/espera01/tomar', {}],
    ['POST', '/api/tareas/espera01/delegar', { a: 'agente', dept: 'ops' }], ['POST', '/api/tasks/espera01/archive', {}], ['POST', '/api/tasks/espera01/person', { person: 'Tú' }],
    ['POST', '/api/tasks/espera01/run', {}], ['DELETE', '/api/tasks/espera01', undefined],
  ];
  for (const [m, r, c] of intentos) { const x = await o.editor(m, r, c); assert.equal(x.status, 403, `${m} ${r} ${JSON.stringify(c)} → ${x.status} ${JSON.stringify(x.j).slice(0, 80)}`); }
  assert.equal((await con(o, async (s) => s.alm.load().find((t) => t.id === 'espera01'))).state, 'waiting', 'sigue esperando el OK');
  // organizar (prioridad, etiquetas…) y comentar SÍ lo puede un editor: no es decidir
  assert.equal((await o.editor('POST', '/api/tareas/espera01/organizar', { prioridad: 'alta' })).status, 200);
  assert.equal((await o.editor('POST', '/api/tasks/espera01/comment', { text: 'ojo con el precio' })).status, 200);
  // el administrador sí decide
  assert.equal((await o.admin('POST', '/api/tareas/espera02/estado', { a: 'done' })).status, 200);
  assert.equal((await o.admin('POST', '/api/tasks/espera03/archive', {})).status, 200);
});

/* ---------- 3) límites ---------- */
test('LÍMITES: el cuerpo JSON tiene tope (por content-length y por lectura), y sin sesión es de 16 KB', async () => {
  const pide = (texto, cabeceras = {}) => new Request('https://oficina.test/x', { method: 'POST', headers: { 'content-type': 'application/json', ...cabeceras }, body: texto });
  assert.deepEqual(await cuerpo(pide('{"a":1}')), { a: 1 });
  assert.equal(await cuerpo(pide('no es json')), null);
  assert.equal(await cuerpo(pide('{"a":"' + 'x'.repeat(2000) + '"}'), 1000), null, 'pasa del tope dado');
  assert.equal(await cuerpo(pide('{}', { 'content-length': String(TOPE_JSON + 1) })), null, 'un content-length enorme se corta sin leer');
  assert.ok(TOPE_JSON >= 8_000_000 && TOPE_JSON <= 16_000_000, 'el tope general deja pasar el chat con imágenes (8 MB) y no llega al límite de memoria del Worker');
});

test('LÍMITES: el acceso sin sesión deja de leer el cuerpo al pasar de 16 KB (no lo recibe entero)', { skip: SALTAR }, async () => {
  const o = await oficina();
  let leidos = 0, i = 0;
  const flujo = new ReadableStream({ pull(c) { if (i++ >= 500) return c.close(); leidos += 1000; c.enqueue(new TextEncoder().encode('x'.repeat(1000))); } });
  const r = await manejar(new Request('https://oficina.test/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: flujo, duplex: 'half' }), o.env);
  assert.equal(r.status, 401);
  assert.ok(leidos <= 40_000, `leyó ${leidos} bytes de un cuerpo de 500 KB sin sesión`);
  assert.equal(o.d1._db.prepare('select count(*) n from sessions').get().n, 3, 'no se abrió ninguna sesión nueva (solo las 3 de la preparación)');
});

test('PODA: auditoría, ejecuciones, invitaciones y reinicios viejos se borran por tandas; lo reciente se queda', { skip: SALTAR }, async () => {
  const o = await oficina(); const db = o._db || o.d1._db;
  const ahora = Date.parse('2026-10-25T12:00:00Z'), dias = (n) => new Date(ahora - n * 864e5).toISOString();
  const uid = db.prepare('select id from users limit 1').get().id;
  for (const [d, tipo] of [[RETENCION_DIAS.auditoria + 5, 'vieja'], [10, 'nueva']]) db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').run(dias(d), tipo, 'x', '{}');
  for (const [d, tarea] of [[RETENCION_DIAS.auditoria_agentes + 5, 'vieja'], [3, 'nueva']]) db.prepare("insert into auditoria_agentes (t, dia, run, tarea, agente, dept, herramienta, fase, decision) values (?,?,?,?,?,?,?,?,?)").run(ahora - d * 864e5, dias(d).slice(0, 10), 'r', tarea, 'olead', 'ops', 'tool', 'pre', 'allow');
  for (const [d, id] of [[RETENCION_DIAS.ejecuciones + 5, 'e-vieja'], [5, 'e-nueva']]) db.prepare("insert into ejecuciones (id, agente, usuario_id, texto, created_at) values (?,?,?,?,?)").run(id, 'olead', uid, 't', dias(d));
  for (const [d, id] of [[RETENCION_DIAS.invitaciones + 5, 'i-vieja'], [1, 'i-nueva']]) db.prepare("insert into invitaciones (id, token_hash, email, rol, creada_por, created_at, expires_at) values (?,?,?,?,?,?,?)").run(id, 'h' + id, id + '@x.test', 'editor', uid, dias(d + 7), dias(d));
  for (const [d, id] of [[RETENCION_DIAS.reinicios + 5, 'r-viejo'], [1, 'r-nuevo']]) db.prepare("insert into reinicios (id, token_hash, user_id, created_at, expires_at) values (?,?,?,?,?)").run(id, 'h' + id, uid, dias(d + 1), dias(d));
  for (const [d, nombre] of [[RETENCION_DIAS.contenido_papelera + 5, 'p-vieja'], [2, 'p-nueva']]) db.prepare("insert into contenido_papelera (tipo, nombre, texto, borrada) values ('plantilla', ?, 'x', ?)").run(nombre, ahora - d * 864e5);
  for (const [d, nombre] of [[RETENCION_DIAS.notas_papelera + 5, 'n-vieja'], [2, 'n-nueva']]) db.prepare("insert into notas_papelera (nombre, grupo, texto, borrada) values (?, 'Notas', 'x', ?)").run(nombre, ahora - d * 864e5);
  const n = await podar(o.d1, ahora);
  assert.deepEqual(n, { auditoria: 1, auditoria_agentes: 1, ejecuciones: 1, invitaciones: 1, reinicios: 1, contenido_papelera: 1, notas_papelera: 1, notificaciones: 0, notas_personales: 0, chat_mensajes: 0, estudio_lotes: 0 });
  assert.equal(db.prepare("select count(*) n from contenido_papelera where nombre = 'p-nueva'").get().n, 1);
  assert.equal(db.prepare("select count(*) n from notas_papelera where nombre = 'n-nueva'").get().n, 1);
  assert.equal(db.prepare("select count(*) n from auditoria where tipo = 'nueva'").get().n, 1);
  assert.equal(db.prepare("select count(*) n from auditoria_agentes where tarea = 'nueva'").get().n, 1);
  assert.equal(db.prepare("select count(*) n from ejecuciones where id = 'e-nueva'").get().n, 1);
  assert.equal(db.prepare("select count(*) n from invitaciones where id = 'i-nueva'").get().n, 1);
  assert.equal(db.prepare("select count(*) n from reinicios where id = 'r-nuevo'").get().n, 1);
});

test('PODA: una tabla atrasada se pone al día por tandas (no borra más de TANDAS×LOTE por día) y toca a las 03:17 de la hora de la oficina', { skip: SALTAR }, async () => {
  const o = await oficina(); const db = o.d1._db;
  const ahora = Date.parse('2026-10-25T12:00:00Z'), vieja = new Date(ahora - 500 * 864e5).toISOString();
  db.exec('begin'); const ins = db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)'); for (let i = 0; i < LOTE * 6 + 7; i++) ins.run(vieja, 'x', 'q', '{}'); db.exec('commit');
  const n = await podar(o.d1, ahora);
  assert.equal(n.auditoria, LOTE * 5, 'una tanda tras otra, con tope por día');
  assert.equal(db.prepare('select count(*) n from auditoria').get().n, LOTE + 7);
  assert.equal((await podar(o.d1, ahora)).auditoria, LOTE + 7, 'al día siguiente termina');
  instalarZona('America/Panama');
  assert.equal(tocaPodar(Date.parse('2026-10-25T08:17:00Z')), true, '03:17 en Panamá (UTC−5)');
  assert.equal(tocaPodar(Date.parse('2026-10-25T08:18:00Z')), false);
  assert.equal(tocaPodar(Date.parse('2026-10-25T09:17:00Z')), false);
});

/* ---------- 4) secretos de lo que el Worker importa ---------- */
test('SECRETOS: todo env.X que leen los módulos COMPARTIDOS que importa el Worker está declarado, es un binding o una variable', () => {
  const decl = JSON.parse(readFileSync(join(RAIZ, 'secretos.json'), 'utf8')); const declarados = new Set([...decl.obligatorios, ...decl.opcionales]);
  const wr = readFileSync(join(RAIZ, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''); const vars = new Set(Object.keys(JSON.parse(wr).vars));
  // Bindings de Cloudflare, ganchos de pruebas (siempre funciones: un secreto es un texto), y desvíos de servidor que NO se pueden poner desde los secretos (solo con una variable en wrangler.jsonc, o sea con acceso al despliegue).
  const permitidos = new Set(['DB', 'ASSETS', 'MEDIA', 'HUB', 'IMAGES', 'RELOJ_MS', 'FETCH_IMAGEN_META', 'AO_FETCH', 'AO_AHORA', 'META_GRAPH_HOST', 'META_GRAPH_VERSION', 'META_RUPLOAD_HOST', 'METRICOOL_API_BASE', 'AO_FAL_QUEUE', 'HF_API_BASE_URL', 'HF_API_KEY', 'HF_API_SECRET', 'VOYAGE_API_KEY']);
  const vistos = new Set(), cola = [resolve(RAIZ, 'worker/index.js')], faltan = {};
  while (cola.length) {
    const f = cola.pop(); if (vistos.has(f)) continue; vistos.add(f); let s; try { s = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of s.matchAll(/(?:from|import\()\s*['"](\.[^'"]+)['"]/g)) cola.push(resolve(dirname(f), m[1]));
    const codigo = s.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    for (const m of codigo.matchAll(/(?<![.\w])env\??\.([A-Z][A-Z0-9_]{2,})|\benv\[\s*['"]([A-Z][A-Z0-9_]+)['"]\s*\]/g)) { const n = m[1] || m[2]; if (!declarados.has(n) && !vars.has(n) && !permitidos.has(n)) (faltan[n] ||= []).push(f.slice(RAIZ.length + 1)); }
  }
  assert.deepEqual(faltan, {}, 'un secreto que el código lee y nadie sube al Worker: la función queda apagada sin avisar');
  assert.ok(vistos.size > 100, 'se recorrió el árbol de imports');
});

test('PODA: el reloj de cada minuto la corre a las 03:17 (y a otra hora no toca nada)', { skip: SALTAR }, async () => {
  const o = await oficina(); const db = o.d1._db;
  const vieja = new Date(Date.parse('2026-10-25T08:17:00Z') - 500 * 864e5).toISOString();
  db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').run(vieja, 'vieja', 'q', '{}');
  await correrReloj(o.env, Date.parse('2026-10-25T09:17:00Z')); // 04:17 en Panamá
  assert.equal(db.prepare("select count(*) n from auditoria where tipo = 'vieja'").get().n, 1, 'a las 04:17 no poda');
  await correrReloj(o.env, Date.parse('2026-10-25T08:17:00Z')); // 03:17 en Panamá
  assert.equal(db.prepare("select count(*) n from auditoria where tipo = 'vieja'").get().n, 0, 'a las 03:17 poda');
});

test('ESCALA: las tareas hechas hace más de 180 días salen del conjunto vivo (a tareas-archivo, enteras); lo abierto y lo reciente se queda', { skip: SALTAR }, async () => {
  const o = await oficina(); const db = o.d1._db;
  const ahora = Date.parse('2026-10-25T12:00:00Z'), hace = (d) => ahora - d * 864e5;
  const caso = { 'vieja-a': ['done', hace(DIAS_HECHAS_VIVAS + 5)], 'vieja-b': ['done', hace(400)], 'reciente': ['done', hace(10)], 'espera': ['waiting', hace(400)], 'cola': ['next', hace(400)] };
  await con(o, async (s) => {
    const l = s.alm.load();
    for (const [id, [estado, cuando]] of Object.entries(caso)) { const t = crearTarea({ dept: 'ops', agent: 'olead', title: id, text: 'x' }, { id: () => id }); t.state = estado; t.doneAt = cuando; t.addedAt = cuando; t.result = 'R'.repeat(50); l.push(t); }
    s.alm.save(l);
  });
  assert.equal(await archivarViejas(o.d1, ahora), 2);
  const vivas = (await cargarTareas(o.d1)).map((t) => t.id).sort();
  assert.deepEqual(vivas, ['cola', 'espera', 'reciente']);
  const guardadas = db.prepare("select id, json from filas where coleccion = 'tareas-archivo' order by id").all();
  assert.deepEqual(guardadas.map((f) => f.id), ['vieja-a', 'vieja-b']);
  assert.equal(JSON.parse(guardadas[0].json).result, 'R'.repeat(50), 'la fila viaja entera');
  assert.equal(await archivarViejas(o.d1, ahora), 0, 'repetirlo no hace nada');
  assert.equal(db.prepare("select count(*) n from filas where coleccion = 'tareas'").get().n, 3);
});

test('ESCALA: el archivo diario va por tandas y el reloj de las 03:10 lo corre', { skip: SALTAR }, async () => {
  const o = await oficina(); const db = o.d1._db;
  const ahora = new Date(); ahora.setHours(3, 10, 0, 0); const t0 = ahora.getTime();
  const ins = db.prepare("insert into filas (coleccion, id, json, orden, actualizado) values ('tareas', ?, ?, ?, ?)");
  db.exec('begin');
  for (let i = 0; i < LOTE_ARCHIVO + 30; i++) { const t = crearTarea({ dept: 'ops', agent: 'olead', title: 'v' + i, text: 'x' }, { id: () => 'v' + i }); t.state = 'done'; t.doneAt = t0 - 300 * 864e5; ins.run(t.id, JSON.stringify(t), i, 'x'); }
  db.exec('commit');
  assert.equal(await archivarViejas(o.d1, t0), LOTE_ARCHIVO, 'una tanda');
  assert.equal(db.prepare("select count(*) n from filas where coleccion = 'tareas'").get().n, 30);
  await relojTareas(o.env, t0);
  assert.equal(db.prepare("select count(*) n from filas where coleccion = 'tareas'").get().n, 0, 'el reloj de las 03:10 termina lo que quedaba');
});

test('ESCALA: el historial de Anuncios (una fila de D1 de ~1,9 MB en la nube) se recorta solo y conserva lo último', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ao-hist-'));
  try {
    const sync = crearSincronizador({ meta: { configurado: () => false, uso: () => ({ ritmo: 1 }) }, ads: {}, dir, ajustes: () => ({}) });
    for (let i = 0; i < 3500; i++) sync.anotar({ tipo: 'pausar', id: 'c' + i, por: 'dueno', texto: 'x'.repeat(450) });
    const f = join(dir, 'historial.jsonl'), t = statSync(f).size;
    assert.ok(t <= HISTORIAL_MAX_BYTES + 1000, `el archivo pesa ${t} bytes`);
    const lineas = readFileSync(f, 'utf8').split('\n').filter(Boolean);
    assert.ok(lineas.length >= HISTORIAL_MINIMO && t > 0 && lineas.length < 3500, 'recortado pero con las últimas');
    assert.ok(statSync(f).size >= HISTORIAL_GUARDAR_BYTES / 2 || lineas.length >= HISTORIAL_MINIMO);
    assert.equal(JSON.parse(lineas.at(-1)).id, 'c3499', 'la última acción se conserva');
    assert.equal(sync.historial()[0].id, 'c3499', 'y es la primera que lee la página (las más nuevas primero)');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('ESCALA: la vuelta de cada minuto de Contenido pide las piezas por el índice de fecha, con una sola cota (no lee todas)', { skip: SALTAR }, async () => {
  const d1 = crearD1(), db = d1._db;
  const ins = db.prepare("insert into contenido_piezas (id, fecha, hora, estado, json, borrada, creada, actualizada) values (?,?,?,?,?,0,'x','x')");
  db.exec('begin');
  for (let i = 0; i < 400; i++) { const fecha = i < 395 ? `2026-0${1 + (i % 6)}-1${i % 9}` : `2026-10-2${i - 395}`; const id = 'p-2026' + String(i).padStart(4, '0') + '-a' + String(i).padStart(3, '0'); ins.run(id, fecha, '10:00', 'borrador', JSON.stringify({ id, titulo: 'T' + i, fecha, hora: '10:00', estado: 'borrador', formato: 'post', redes: ['instagram'], medios: [], historias: [], texto: 'x', creada: 'x', actualizada: 'x' }));
  }
  db.exec('commit');
  const sqls = []; const prep = d1.prepare; d1.prepare = (sql) => { sqls.push(sql); return prep(sql); };
  const almacen = crearAlmacenD1({ db: d1 });
  const r = await almacen.listar({ desde: '2026-10-20' });
  assert.deepEqual(r.map((p) => p.titulo).sort(), ['T395', 'T396', 'T397', 'T398', 'T399']);
  assert.ok(sqls.every((q) => /fecha >= \?/.test(q)), 'la consulta lleva la cota: ' + sqls.join(' | ').slice(0, 200));
  const plan = db.prepare('explain query plan ' + sqls[0].replace(/\?/g, "'2026-10-20'")).all().map((x) => x.detail).join(' ');
  assert.match(plan, /USING INDEX contenido_piezas_fecha|SEARCH contenido_piezas/, 'usa el índice de fecha: ' + plan);
  assert.equal((await almacen.listar({ hasta: '2026-01-31' })).every((p) => p.fecha <= '2026-01-31'), true, 'la cota de arriba sola también');
  assert.equal((await almacen.listar({})).length, 400, 'sin cotas, todas');
});

test('ENVÍOS: el panel de la fase 1 ya no ofrece herramientas de envío (la llamada la hace Anthropic y el guardián no la ve): enviar va por una tarea', { skip: SALTAR }, async () => {
  const o = await oficina();
  await o.admin('POST', '/api/conectores', { nombre: 'correo', url: 'https://mcp.example.com/x', departamentos: ['ops'], herramientas_lectura: ['search_threads'], herramientas_envio: ['send_email'] });
  const r = await o.admin('POST', '/api/agentes/olead/ejecutar', { texto: 'Responde al correo de Ana', aprobada: true });
  assert.equal(r.status, 409); assert.match(r.j.error, /tarea/);
  assert.equal((await o.editor('POST', '/api/agentes/olead/ejecutar', { texto: 'x', aprobada: true })).status, 403, 'un editor sigue sin poder aprobar');
});

const LLAVE_FALSA = 'sk-' + 'ant-api03-ABCDEFGHIJKLMNOP'; // partida: el escáner de secretos del repositorio no debe verla como una llave
test('SECRETOS: aunque un proveedor repita la cabecera o la llave en su error, no sale en la respuesta ni queda en D1', { skip: SALTAR }, async () => {
  const S = { ANTHROPIC_API_KEY: 'SENT_ANTH_0123456789abcdef', MINIMAX_API_KEY: 'SENT_MINIMAX_0123456789abcdef', MCP_X_TOKEN: 'SENT_MCP_0123456789abcdef', META_APP_SECRET: 'SENT_APP_0123456789abcdef' };
  const o = await oficina(S);
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init) => new Response(JSON.stringify({ error: { message: `rechazado ${u?.url ?? u} ${JSON.stringify(init?.headers ?? {})} Bearer abcdefghijklmnop1234 ${LLAVE_FALSA}` } }), { status: 400 });
  try {
    const respuestas = [
      await o.admin('POST', '/api/agentes/olead/ejecutar', { texto: 'hola' }),
      await o.admin('POST', '/api/voces/design', { prompt: 'una voz grave', text: 'hola' }),
      await o.admin('POST', '/api/tasks', { dept: 'ops', text: 'hola' }),
    ].map((r) => JSON.stringify(r.j));
    const base = o.d1._db; let volcado = '';
    for (const { name } of base.prepare("select name from sqlite_master where type = 'table'").all()) volcado += JSON.stringify(base.prepare(`select * from "${name}"`).all());
    for (const texto of [...respuestas, volcado]) {
      for (const v of Object.values(S)) assert.ok(!texto.includes(v), 'un secreto salió en un texto');
      assert.ok(!/Bearer abcdefghijklmnop1234/.test(texto) && !texto.includes(LLAVE_FALSA), 'una llave con forma de llave salió');
    }
    assert.ok(respuestas.some((t) => /rechazado/.test(t)), 'el error sí se dice (sin la llave)');
  } finally { globalThis.fetch = real; }
});

test('SECRETOS: limpiarSecretos tapa los valores conocidos y lo que tiene forma de llave, y deja el resto', () => {
  registrarSecretos({ MI_TOKEN: 'valor-secreto-largo-1234', CORTO_KEY: 'corto', OTRA_COSA: 'no-es-secreto-1234567' });
  assert.equal(limpiarSecretos('x valor-secreto-largo-1234 y'), 'x «…» y');
  assert.equal(limpiarSecretos('a no-es-secreto-1234567 b'), 'a no-es-secreto-1234567 b');
  assert.equal(limpiarSecretos('usa corto'), 'usa corto', 'un valor de menos de 12 caracteres no se registra (taparía palabras)');
  assert.equal(limpiarSecretos('Authorization: Bearer abcdefghijklmnopqrstu'), 'Authorization: Bearer «…»');
  assert.equal(limpiarSecretos('mira EAAB0123456789012345678901 ok'), 'mira «…» ok');
  assert.equal(limpiarSecretos(12), 12);
});

test('ESCALA: el índice de notas de una ejecución deja fuera los entregables viejos (siguen en el Cerebro) y nunca las notas escritas a mano', { skip: SALTAR }, async () => {
  const d1 = crearD1(), db = d1._db, ahora = Date.parse('2026-10-25T12:00:00Z'), hace = (d) => ahora - d * 864e5;
  const ins = db.prepare('insert into notas (nombre, grupo, oficina, texto, bytes, actualizado, tarea) values (?,?,?,?,?,?,null)');
  ins.run('2025-01-01 entrega vieja', 'Agents Office', 1, 'x', 1, hace(DIAS_ENTREGABLES_EN_EL_INDICE + 10));
  ins.run('2026-10-20 entrega reciente', 'Agents Office', 1, 'x', 1, hace(5));
  ins.run('guia-de-precios', '10-Business', 0, 'x', 1, hace(900)); // a mano, aunque sea antigua
  const { index } = await indiceDeNotas(d1, ahora);
  assert.deepEqual([...index.keys()].sort(), ['2026-10-20 entrega reciente', 'guia-de-precios']);
  assert.equal(db.prepare('select count(*) n from notas').get().n, 3, 'nada se borra');
});

/* ---------- toda tabla que solo crece declara cómo se poda ---------- */
const TABLAS = {
  // tablas del equipo y la configuración: crecen con las personas y las decisiones del dueño, no con el uso
  users: 'acotada', perfiles: 'acotada', notas_vectores: 'acotada (un vector por pasaje de las notas escritas de ahora, tope de 4.000; los de pasajes que ya no existen se borran al indexar: lib/significado.js)', conectores: 'acotada', conectores_extra: 'acotada (una fila por conector, tope de 40 en modulos/conectores.js)', grafo: 'acotada', docs: 'acotada (config; el espejo de Anuncios se recorta solo)',
  // se podan en su uso o por el reloj
  sessions: 'caduca (el reloj las borra cada minuto)', sesiones_uso: 'acotada (una fila por sesión, cascada con sessions; el reloj borra las huérfanas)', acceso_intentos: 'efímera (ventana de un minuto)', publica_tasa: 'efímera (ventana de un minuto)', anuncios_tasa: 'efímera', anuncios_candados: 'efímera',
  anuncios_tokens: 'caduca en 2 minutos', contenido_candado: 'efímera', telegram_updates: 'poda a los 3 días (lib/telegram.js)', hook_eventos: 'poda cada hora (lib/disparadores.js)',
  corridas: 'una por tarea en curso; se borra al terminar', estudio_trabajos: 'poda al guardar (lib/estudio/trabajos.js)', estudio_archivos: 'la galería; su papelera se vacía a los 30 días',
  contenido_pubs: 'poda (lib/contenido/analiticas.js)', contenido_cola: 'una fila por pieza entregada; se limpia con la pieza', contenido_piezas: 'su papelera se vacía a los 30 días; el reloj lee por fecha (índice)',
  contenido_dias: 'una fila por cuenta y día de Analíticas (pequeña)', notas: 'el índice de una ejecución deja fuera los entregables de más de 180 días',
  filas: 'por colección: tareas hechas >180 días a tareas-archivo, avisos >60 días (modulos/tareas.js); presets-versiones: las últimas 20 por preset, podadas al guardar (lib/estudio/presets.js); el resto es configuración',
  estudio_lotes: 'mantenimiento',
  tarea_bitacora: 'poda a los 400 días (modulos/tareas.js)',
  // las que poda lib/mantenimiento.js (retención en RETENCION_DIAS)
  auditoria: 'mantenimiento', auditoria_agentes: 'mantenimiento', ejecuciones: 'mantenimiento', invitaciones: 'mantenimiento', reinicios: 'mantenimiento', contenido_papelera: 'mantenimiento', notas_papelera: 'mantenimiento', notificaciones: 'mantenimiento', chat_mensajes: 'mantenimiento', notas_personales: 'mantenimiento',
  bandeja_items: 'acotada (el módulo se queda con los 800 más recientes: contenido/bandeja.mjs → MAX; solo con el flag nube.bandejaTabla)',
  cuenta_telegram: 'acotada (una fila por cuenta, cascada con users; los códigos caducan a los 10 min)', notas_estado: 'acotada (cascada con su nota, que se poda a los 30 días de vencer)', presencia_cuenta: 'acotada (una fila por cuenta, cascada con users)',
  chat_canales: 'acotada (canales: los crean las personas con tope por persona; cascada con su creador)', chat_miembros: 'acotada (cascada con canales y cuentas)',
  // el libro contable: se conserva (una fila de ~150 bytes por llamada a un modelo), se lee por rango con índice
  costos: 'libro contable (se conserva)',
};
test('ESCALA: toda tabla de D1 declara cómo se acota (poda, caducidad o libro); una tabla nueva obliga a decidirlo', () => {
  const creadas = new Set();
  for (const f of readdirSync(join(RAIZ, 'migraciones')).filter((x) => x.endsWith('.sql'))) for (const m of readFileSync(join(RAIZ, 'migraciones', f), 'utf8').matchAll(/create table if not exists (\w+)/g)) creadas.add(m[1]);
  assert.deepEqual([...creadas].filter((t) => !(t in TABLAS)).sort(), [], 'tablas sin política de crecimiento: añádelas a TABLAS (y a lib/mantenimiento.js si hace falta podarlas)');
  assert.deepEqual(Object.keys(TABLAS).filter((t) => !creadas.has(t)), [], 'una tabla declarada que ya no existe');
  for (const t of Object.keys(RETENCION_DIAS)) assert.equal(TABLAS[t], 'mantenimiento', t + ' se poda en mantenimiento.js y la lista debe decirlo');
  for (const [t, p] of Object.entries(TABLAS)) if (p === 'mantenimiento') assert.ok(t in RETENCION_DIAS, t + ' dice «mantenimiento» y mantenimiento.js no la poda');
});

test('RUTINAS: «ejecutar ya» una rutina que corre sola o sin pedir el OK es del administrador (un editor la repetiría a su antojo); las que piden el OK sí', { skip: SALTAR }, async () => {
  const o = await oficina();
  const crea = async (texto, needsOk) => (await o.admin('POST', '/api/routines', { dept: 'ops', text: texto, needsOk })).j.routine.id;
  const conOk = await crea('cada día a las 8, revisa los pagos', true), sinOk = await crea('cada día a las 9, lista las facturas vencidas', false), sola = await crea('cada día a las 10, manda los recordatorios', true);
  o.d1._db.prepare("update filas set json = json_set(json, '$.autonomous', json('true')) where coleccion = 'rutinas' and id = ?").run(sola);
  assert.equal((await o.editor('POST', `/api/routines/${sinOk}/run`, {})).status, 403, 'sin OK');
  assert.equal((await o.editor('POST', `/api/routines/${sola}/run`, {})).status, 403, 'autónoma');
  assert.equal((await o.lectura('POST', `/api/routines/${conOk}/run`, {})).status, 403, 'lectura');
  assert.equal((await o.editor('POST', `/api/routines/${conOk}/run`, {})).status, 200, 'la que pide el OK sí');
  assert.equal((await o.admin('POST', `/api/routines/${sinOk}/run`, {})).status, 200, 'el administrador, todas');
  assert.equal((await o.admin('POST', `/api/routines/${sola}/run`, {})).status, 200);
});

test('LÍMITES: el tope general del cuerpo (12 MB) no corta las subidas de archivos, que llevan el suyo (24 MB de JSON)', { skip: SALTAR }, async () => {
  const o = await oficina({ MEDIA: crearR2() });
  const mp4 = Buffer.alloc(11_000_000, 7); mp4.write('ftypisom', 4, 'latin1'); // ~14,7 MB en base64: más que el tope general, menos que el de las subidas
  const r = await o.admin('POST', '/api/media/upload', { name: 'clip.mp4', data: 'data:video/mp4;base64,' + mp4.toString('base64') });
  assert.equal(r.status, 200, JSON.stringify(r.j).slice(0, 200)); assert.ok(r.j.item, 'el archivo entró');
  const grande = await o.admin('POST', '/api/migrar/filas', { coleccion: 'avisos', filas: [{ id: 'x', valor: { t: 'x'.repeat(13_000_000) } }] });
  assert.equal(grande.status, 422, 'el resto de las rutas sí cortan a 12 MB (cuerpo ilegible → colección o filas no válidas)');
});

test('RENDIMIENTO: la oficina (2 MB) vuelve a llevar ETag aunque el Worker le inyecte lo de la nube: la recarga sin cambios es un 304', { skip: SALTAR }, async () => {
  const d1 = crearD1(); const c = await sembrar(d1);
  let version = '"v1"';
  const env = { ...envDePrueba(d1), ASSETS: { fetch: async (req) => new Response(new URL(req.url).pathname === '/login.html' ? '<html><body>ACCESO</body></html>' : '<html><body>OFICINA</body></html>', { headers: { 'content-type': 'text/html', etag: version, 'cache-control': 'private, no-cache' } }) } };
  const cookie = (await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: c.email, contrasena: c.clave } })).headers.get('set-cookie').split(';')[0];
  const ver = (h = {}) => manejar(new Request('https://oficina.test/', { headers: { cookie, ...h } }), env);
  const a = await ver(); const etag = a.headers.get('etag');
  assert.equal(a.status, 200); assert.match(await a.text(), /nube\.js/); assert.match(etag, /^W\/"v1-nube2"$/);
  const b = await ver({ 'if-none-match': etag }); assert.equal(b.status, 304); assert.equal(await b.text(), ''); assert.equal(b.headers.get('etag'), etag);
  version = '"v2"'; // un despliegue nuevo cambia el ETag de Cloudflare y con él el nuestro
  const c2 = await ver({ 'if-none-match': etag }); assert.equal(c2.status, 200); assert.match(c2.headers.get('etag'), /v2-nube2/);
  const sinSesion = await manejar(new Request('https://oficina.test/', { headers: { 'if-none-match': etag } }), env);
  assert.equal(sinSesion.status, 200, 'sin sesión nunca se contesta 304 de la oficina: se ve el acceso'); assert.ok(!/OFICINA/.test(await sinSesion.text()));
});

test('SESIÓN: una sesión caducada no entra (ni la página ni la API), y el reloj las borra', { skip: SALTAR }, async () => {
  const o = await oficina(); const db = o.d1._db;
  assert.equal((await o.editor('GET', '/api/yo')).status, 200);
  db.prepare("update sessions set expires_at = ? where user_id = (select id from users where email = 'ed@panaclaw.test')").run(new Date(Date.now() - 1000).toISOString());
  assert.equal((await o.editor('GET', '/api/yo')).status, 401, 'caducada');
  assert.equal((await o.editor('POST', '/api/tasks', { dept: 'ops', text: 'x' })).status, 401);
  assert.equal((await o.admin('GET', '/api/yo')).status, 200, 'las demás siguen');
  await correrReloj(o.env);
  assert.equal(db.prepare("select count(*) n from sessions s join users u on u.id = s.user_id where u.email = 'ed@panaclaw.test'").get().n, 0, 'el reloj de cada minuto las borra');
});

test('SECRETOS: la comparación de tokens en tiempo constante no acepta prefijos, vacíos ni tipos raros', () => {
  assert.equal(igualSeguro('secreto-largo-1234', 'secreto-largo-1234'), true);
  for (const [a, b] of [['secreto', 'secreto-largo-1234'], ['secreto-largo-1234', 'secreto'], ['', 'x'], ['x', ''], ['abc', 'abd']]) assert.equal(igualSeguro(a, b), false, `${a} vs ${b}`);
  for (const [a, b] of [[null, 'x'], ['x', undefined], [123, 123], [['a'], ['a']]]) assert.equal(igualSeguro(a, b), false);
});

test('RELOJ: la vuelta de los agentes (espera al modelo) va la última; el orden de las rutas no cambia', () => {
  const nombres = ordenDelReloj(MODULOS).filter((m) => m.cadaMinuto).map((m) => m.nombre);
  assert.equal(nombres.at(-1), 'agentes'); assert.ok(nombres.indexOf('tareas') < nombres.indexOf('agentes'), 'tareas crea lo que agentes toma en la misma vuelta');
  for (const rapido of ['telegram', 'disparadores', 'contenido', 'anuncios']) assert.ok(nombres.indexOf(rapido) < nombres.indexOf('agentes'), rapido);
  const rutas = MODULOS.map((m) => m.nombre); assert.ok(rutas.indexOf('bandeja') < rutas.indexOf('contenido'), 'la Bandeja contesta antes que Contenido');
});

/* ---------- envíos: lo que las pruebas por fase no cubrían ---------- */
const GRANDE = { AGENTES_MAX_CONSULTAS: '5000', AGENTES_MAX_LLAMADAS: '500' };
const MCP = () => ({ search_threads: { salida: 'Hilo con Ana: pide el precio.' }, create_draft: { salida: 'borrador creado' }, send_email: { salida: 'enviado' } });
test('ENVÍO: con la política «pedido» (el texto de la tarea lo pide), una ejecución SIN el OK de un administrador ni recibe la herramienta de envío ni envía', { skip: SALTAR }, async () => {
  const { d1, env } = await AY.oficina({ env: GRANDE, ajustes: { safety: { writes: 'pedido' } } });
  const t = await AY.tarea(env, { text: 'Envía el correo a ana@x.com diciéndole que el precio es 100.', needsOk: false });
  const mcp = MCP();
  const f = AY.crearFetch({ herramientasMcp: mcp, guion: [AY.usar(['mcp__gmail__send_email', { to: 'ana@x.com', body: 'Hola Ana, el precio es 100.' }]), AY.texto('No pude enviarlo.\nFuentes: —')] });
  await AY.minutos(env, f.fetchFn);
  assert.equal(f.registro.anthropic[0].cuerpo.tools.some((h) => h.name === 'mcp__gmail__send_email'), false, 'la herramienta de envío no se ofrece sin el OK');
  assert.equal(mcp.send_email.llamadas, undefined, 'y aunque el modelo la nombre, no corre');
  assert.equal((await AY.tareaEnDisco(d1, t.id)).state, 'done');
});

test('ENVÍO: las herramientas internas de un agente entran por la oficina como EDITOR (solo el Estudio de una ejecución aprobada, como administrador)', { skip: SALTAR }, async () => {
  const vistos = [];
  const modulos = [{ nombre: 'espia', grupos: [], manejar: async (ctx) => { vistos.push(`${ctx.usuario.rol} ${ctx.req.method} ${ctx.ruta}`); return new Response('{"tareas":[],"piezas":[],"models":[],"items":[]}', { status: 200, headers: { 'content-type': 'application/json' } }); } }];
  const agente = { id: 'mlead', department: 'marketing' };
  for (const gasto of [false, true]) {
    vistos.length = 0;
    const h = herramientasInternas({ env: {}, db: null, agente, tarea: 't1', modulos, gasto });
    for (const nombre of ['mcp__tareas__ver_tareas', 'mcp__contenido__ver_calendario_contenido', 'mcp__estudio__estado_estudio']) { try { await h.llamar(nombre, {}); } catch { /* la respuesta falsa puede no cuadrar: interesa con qué rol se llamó */ } }
    assert.ok(vistos.length >= 3, 'las tres entraron: ' + vistos.join(' | '));
    for (const v of vistos) {
      const esEstudio = /\/api\/media/.test(v);
      assert.equal(v.startsWith('admin'), esEstudio && gasto, `${gasto ? 'ejecución aprobada' : 'sin OK'}: «${v}»`);
    }
  }
});

test('CONECTORES: una dirección IPv6 o de red privada no se acepta como conector', () => {
  for (const u of ['https://[::1]/mcp', 'https://[fe80::1]/mcp', 'https://127.0.0.1/mcp', 'https://10.0.0.5/mcp', 'https://169.254.169.254/latest', 'https://localhost/mcp', 'http://ejemplo.com/mcp', 'https://usuario:clave@ejemplo.com/mcp', 'https://intranet/mcp'])
    assert.ok(urlPermitida(u), u + ' debería rechazarse');
  assert.equal(urlPermitida('https://mcp.ejemplo.com/mcp'), null);
});
