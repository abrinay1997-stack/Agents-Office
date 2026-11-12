// P4 del plan MCP (§14.2): el PASO 1 del dinero. Un token de MCP con alcance «gasto» PIDE un gasto y deja una TARJETA «espera tu OK»; no gasta. El paso 2 lo da SOLO una persona con su sesión o por Telegram.
// Todo contra el Worker real (D1 en memoria con las migraciones reales), el reloj de la prueba (ninguna prueba depende de la fecha de hoy) y SIN red: un fetch que cuente cualquier llamada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SALTAR } from './d1-memoria.mjs';
import { mundo } from './mcp-ayudas.mjs';
import { guardarDoc } from '../worker/lib/almacen.js';
import { podar } from '../worker/lib/mantenimiento.js';
import { herramientas } from '../worker/lib/mcp/registro.js';
import { MAX_ABIERTAS, MAX_POR_DIA, VENCE_MS, veredicto } from '../worker/lib/mcp/gasto.js';
import { armar, salientes } from '../worker/lib/telegram.js';
import { MODULOS_BOT, mcpSoloSolicitudes } from '../worker/modulos/telegram.js';
import { gastoMcpDeAviso } from '../../telegram-core.mjs';
import { TOKEN_BOT, DUENO_TG, EXTRANO_TG } from './fase6-ayudas.mjs';
import { IDS_AMBITOS, PALABRA } from '../../restablecer-core.mjs';

const KEYS = { MINIMAX_API_KEY: 'clave-de-mentira', OPENAI_API_KEY: 'otra-de-mentira' }; // secrets-ok: de mentira
const texto = (r) => r.j.result.content[0].text;
const IMG = { prompt: 'una cama queen en un cuarto claro', cantidad: 2 };

async function oficina({ extraEnv = {}, alcance = 'gasto' } = {}) {
  const m = await mundo({ extraEnv: { ...KEYS, MCP_ESCRITURAS_MINUTO: '1000', ...extraEnv } }); // (el tope de escrituras por minuto del conector no es lo que se prueba aquí)
  const { tokens } = await m.conectar({ alcance });
  const trabajos = () => m.db.prepare('select count(*) n from estudio_trabajos').get().n;
  const tarjetas = () => m.db.prepare('select * from mcp_solicitudes order by creada_at').all();
  return { m, t: tokens.access_token, trabajos, tarjetas, pedir: (args = IMG, nombre = 'generar_imagen') => m.llamar(tokens.access_token, nombre, args) };
}
/** Cuenta las llamadas a la red: el paso 1 no puede tocar ni al Estudio ni a Meta. */
function sinRed() {
  const orig = globalThis.fetch, v = { n: 0, urls: [] };
  globalThis.fetch = (...a) => { v.n++; v.urls.push(String(a[0]?.url || a[0])); return Promise.reject(new Error('sin red en esta prueba')); };
  return { v, parar: () => { globalThis.fetch = orig; } };
}

test('PASO 1: un token «gasto» deja la tarjeta con la cifra del SERVIDOR y NO gasta (ni un trabajo, ni una llamada a la red)', { skip: SALTAR }, async () => {
  const o = await oficina(), red = sinRed();
  try {
    const r = await o.pedir(IMG); const x = texto(r);
    assert.equal(r.j.result.isError, false, x);
    assert.match(x, /tarjeta «espera tu OK»/); assert.match(x, /Este conector no genera ni gasta/); assert.match(x, /PREPARADO — no se generó nada/);
    assert.equal(o.trabajos(), 0, 'ni un trabajo del Estudio'); assert.equal(red.v.n, 0, 'ni una llamada a la red: ' + red.v.urls.join(','));
    const [f] = o.tarjetas(); assert.equal(f.estado, 'espera'); assert.equal(f.herramienta, 'generar_imagen');
    assert.ok(f.cifra_usd > 0 && f.cifra_usd < 1, 'la cifra la calcula el servidor con el catálogo');
    assert.equal(f.vence_at - f.creada_at, VENCE_MS); assert.equal(f.vence_at - o.m.ahora() > 0, true);
    assert.equal(JSON.parse(f.args).prompt, IMG.prompt); assert.ok(!('clave_idempotencia' in JSON.parse(f.args)));
    assert.ok(JSON.parse(f.topes).left > 0, 'los topes de ese momento quedan en la tarjeta');
    // quién la pidió: la conexión y la persona
    const l = (await o.m.admin('GET', '/api/conectar-claude/solicitudes')).j;
    assert.equal(l.esperan.length, 1); assert.equal(l.esperan[0].conexion.nombre, 'Claude de prueba'); assert.equal(l.esperan[0].persona.email, 'dueno@panaclaw.test');
  } finally { red.parar(); }
});

test('LA CIFRA LA FIJA EL SERVIDOR: un argumento «costo» del cliente se rechaza (esquema cerrado) y no abre tarjeta; el costo solo sale del catálogo', { skip: SALTAR }, async () => {
  const o = await oficina();
  const mala = await o.pedir({ ...IMG, costo: 0 }); assert.equal(mala.j.result?.isError ?? true, true);
  assert.equal(o.tarjetas().length, 0, 'un argumento inventado no abre nada');
  const dos = await o.pedir({ prompt: 'x', cantidad: 8 }); const [f] = o.tarjetas();
  assert.ok(f.cifra_usd > 0.01 && texto(dos).includes('tarjeta'));
  // varias cantidades: más imágenes, más costo (viene de estimar el catálogo, no de lo que diga el cliente)
  await o.pedir({ prompt: 'x', cantidad: 1 }); const [a, b] = o.tarjetas(); assert.ok(a.cifra_usd > b.cifra_usd);
});

test('NINGÚN TOKEN PUEDE APROBAR NI CANJEAR: la ruta pide la sesión, un Bearer de MCP (cualquier alcance) da 401 y el registro no tiene herramientas que aprueben', { skip: SALTAR }, async () => {
  const o = await oficina(); await o.pedir(IMG); const [f] = o.tarjetas();
  const ruta = `/api/conectar-claude/solicitudes/${f.id}/aprobar`;
  for (const alcance of ['lectura', 'oficina', 'gasto']) {
    const { tokens } = await o.m.conectar({ alcance });
    for (const [metodo, r] of [['POST', ruta], ['POST', ruta.replace('aprobar', 'rechazar')], ['GET', '/api/conectar-claude/solicitudes']]) {
      const x = await o.m.crudo(r, { metodo, cuerpo: metodo === 'POST' ? {} : undefined, cabeceras: { authorization: 'Bearer ' + tokens.access_token } });
      assert.equal(x.status, 401, `${alcance} ${metodo} ${r}`);
    }
  }
  assert.equal(o.tarjetas()[0].estado, 'espera'); assert.equal(o.trabajos(), 0);
  // las herramientas: ninguna aprueba, y las de gasto solo preparan
  for (const h of herramientas()) { assert.ok(!/aprob|canje|confirm/.test(h.nombre), h.nombre); if (h.alcance === 'gasto') assert.equal(h.soloPrepara, true, h.nombre); }
  // por el propio /mcp tampoco hay manera: una herramienta que no existe
  for (const n of ['aprobar_gasto', 'aprobar_solicitud', 'confirmar_gasto']) assert.match(JSON.stringify((await o.m.llamar(o.t, n, { id: f.id })).j), /desconocida|no existe|unknown/i, n);
  assert.equal(o.tarjetas()[0].estado, 'espera');
});

test('SOLO UN ADMINISTRADOR CON SESIÓN APRUEBA: el editor y el lector reciben 403; el administrador la ejecuta UNA vez por la ruta de siempre y su segundo clic no repite', { skip: SALTAR }, async () => {
  const o = await oficina(); await o.pedir(IMG); const [f] = o.tarjetas(), ruta = `/api/conectar-claude/solicitudes/${f.id}`;
  for (const q of ['editor', 'lectura']) { for (const a of ['aprobar', 'rechazar']) assert.equal((await o.m[q]('POST', `${ruta}/${a}`, {})).status, 403, `${q} ${a}`); assert.equal((await o.m[q]('GET', '/api/conectar-claude/solicitudes')).status, 403); }
  assert.equal((await o.m.crudo(`${ruta}/aprobar`, { metodo: 'POST', cuerpo: {} })).status, 401, 'sin sesión');
  assert.equal(o.tarjetas()[0].estado, 'espera'); assert.equal(o.trabajos(), 0);
  const [a, b] = await Promise.all([o.m.admin('POST', `${ruta}/aprobar`, {}), o.m.admin('POST', `${ruta}/aprobar`, {})]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409], 'dos clics a la vez: uno ejecuta y el otro encuentra la tarjeta ya resuelta');
  assert.equal(o.trabajos(), 1, 'un solo trabajo');
  const ok = a.status === 200 ? a : b; assert.equal(ok.j.estado, 'ejecutada'); assert.match(ok.j.texto, /Pedida al Estudio/);
  const j = JSON.parse(o.m.db.prepare('select json from estudio_trabajos').get().json);
  assert.equal(j.n, 2); assert.equal(j.prompt, IMG.prompt); assert.equal(j.by, 'you', 'el trabajo nace de la sesión de la persona, no de un testigo de MCP');
  assert.equal((await o.m.admin('POST', `${ruta}/aprobar`, {})).status, 409); assert.equal(o.trabajos(), 1);
  const fin = o.tarjetas()[0]; assert.equal(fin.estado, 'ejecutada'); assert.equal(fin.resuelta_por, 'dueno@panaclaw.test');
});

test('RECHAZAR no gasta nada; y una tarjeta resuelta no se puede aprobar después', { skip: SALTAR }, async () => {
  const o = await oficina(); await o.pedir(IMG); const [f] = o.tarjetas(), ruta = `/api/conectar-claude/solicitudes/${f.id}`;
  const r = await o.m.admin('POST', `${ruta}/rechazar`, {}); assert.equal(r.status, 200); assert.equal(r.j.esperan.length, 0);
  assert.equal(o.tarjetas()[0].estado, 'rechazada');
  const a = await o.m.admin('POST', `${ruta}/aprobar`, {}); assert.equal(a.status, 409); assert.match(a.j.error, /rechazada/); assert.equal(o.trabajos(), 0);
  assert.equal((await o.m.admin('POST', '/api/conectar-claude/solicitudes/g0000000000000000000/aprobar', {})).status, 404);
  assert.equal((await o.m.admin('POST', '/api/conectar-claude/solicitudes/no-es-un-id/aprobar', {})).status, 405, 'un id mal formado ni se busca');
});

test('AL APROBAR SE RECALCULA: topes que cambiaron o un costo que subió → se rechaza con el motivo y no se gasta; una vencida no se aprueba', { skip: SALTAR }, async () => {
  // a) el tope diario de generaciones bajó a 1: ya no caben las 2 imágenes
  let o = await oficina(); await o.pedir(IMG); let [f] = o.tarjetas();
  await guardarDoc(o.m.d1, 'estudio.config', { dailyLimit: 1 });
  let a = await o.m.admin('POST', `/api/conectar-claude/solicitudes/${f.id}/aprobar`, {});
  assert.equal(a.status, 200); assert.equal(a.j.ok, false); assert.equal(a.j.estado, 'rechazada'); assert.match(a.j.texto, /topes de hoy/);
  assert.equal(o.trabajos(), 0); assert.equal(o.tarjetas()[0].estado, 'rechazada'); assert.match(o.tarjetas()[0].motivo, /topes/);
  // b) el modelo por defecto pasó a uno MÁS CARO: no se gasta más de lo que la persona vio
  o = await oficina(); await guardarDoc(o.m.d1, 'estudio.config', { default: { image: 'mmx-image-01' } }); await o.pedir(IMG); [f] = o.tarjetas();
  await guardarDoc(o.m.d1, 'estudio.config', { default: { image: 'gpt-image-1' } });
  a = await o.m.admin('POST', `/api/conectar-claude/solicitudes/${f.id}/aprobar`, {});
  assert.equal(a.j.ok, false, JSON.stringify(a.j).slice(0, 300)); assert.match(a.j.texto, /costo subió/); assert.equal(o.trabajos(), 0);
  // c) vencida: pasa de las 24 h → «vencida» y no se aprueba
  o = await oficina(); await o.pedir(IMG); [f] = o.tarjetas();
  o.m.avanzar(VENCE_MS + 60_000);
  a = await o.m.admin('POST', `/api/conectar-claude/solicitudes/${f.id}/aprobar`, {});
  assert.equal(a.status, 409); assert.match(a.j.error, /vencida/); assert.equal(o.trabajos(), 0);
  assert.equal((await o.m.admin('GET', '/api/conectar-claude/solicitudes')).j.hechas[0].estado, 'vencida');
});

test('IDEMPOTENCIA: la misma clave, o la misma petición, no abren dos tarjetas', { skip: SALTAR }, async () => {
  const o = await oficina();
  const a = await o.pedir({ ...IMG, clave_idempotencia: 'clave-uno-12345' }), b = await o.pedir({ ...IMG, clave_idempotencia: 'clave-uno-12345' });
  assert.equal(o.tarjetas().length, 1); assert.match(texto(b), /ya se había hecho|no se repitió/);
  const c = await o.pedir({ ...IMG, clave_idempotencia: 'clave-dos-12345' }); // otra clave, el MISMO pedido: el hash lo reconoce
  assert.equal(o.tarjetas().length, 1); assert.match(texto(c), /ya tiene una tarjeta esperando/); assert.equal(a.j.result.isError, false);
  const d = await o.pedir({ ...IMG, cantidad: 3 }); assert.equal(o.tarjetas().length, 2, 'otra cantidad es otro pedido'); assert.equal(d.j.result.isError, false);
});

test('LÍMITES: 5 abiertas por conexión y 20 por conexión y día; una conexión no agota la de otra', { skip: SALTAR }, async () => {
  const o = await oficina();
  for (let i = 0; i < MAX_ABIERTAS; i++) assert.match(texto(await o.pedir({ prompt: 'pedido ' + i })), /tarjeta «espera tu OK»/);
  const sexta = texto(await o.pedir({ prompt: 'pedido 6' })); assert.match(sexta, new RegExp(`el máximo es ${MAX_ABIERTAS}`)); assert.match(sexta, /No se abrió ninguna tarjeta/);
  assert.equal(o.tarjetas().length, MAX_ABIERTAS);
  // otra conexión del mismo dueño tiene su propio cupo
  const otra = await o.m.conectar({ alcance: 'gasto' }); assert.match(texto(await o.m.llamar(otra.tokens.access_token, 'generar_imagen', { prompt: 'de otra conexión' })), /tarjeta «espera tu OK»/);
  // el tope por día: se rechazan para liberar el cupo de «abiertas» y se llega a 20 en 24 h
  let n = o.tarjetas().filter((x) => x.familia === o.tarjetas()[0].familia).length;
  while (n < MAX_POR_DIA) {
    for (const f of o.tarjetas().filter((x) => x.estado === 'espera' && x.familia === o.tarjetas()[0].familia)) await o.m.admin('POST', `/api/conectar-claude/solicitudes/${f.id}/rechazar`, {});
    const lote = Math.min(MAX_ABIERTAS, MAX_POR_DIA - n); for (let i = 0; i < lote; i++) await o.pedir({ prompt: `lleno ${n + i}` }); n += lote;
  }
  for (const f of o.tarjetas().filter((x) => x.estado === 'espera' && x.familia === o.tarjetas()[0].familia)) await o.m.admin('POST', `/api/conectar-claude/solicitudes/${f.id}/rechazar`, {});
  assert.match(texto(await o.pedir({ prompt: 'una más' })), /últimas 24 horas/);
  o.m.db.prepare('update mcp_solicitudes set creada_at = creada_at - ?').run(25 * 3600e3); // (el testigo de acceso vive 1 hora: se envejecen las tarjetas, no el reloj)
  assert.match(texto(await o.pedir({ prompt: 'otro día' })), /tarjeta «espera tu OK»/, 'al día siguiente el cupo vuelve');
});

test('NO CABE / NO SE PUEDE: sin tarjeta cuando el modelo no existe o ya no cabe en los topes', { skip: SALTAR }, async () => {
  const o = await oficina();
  assert.match(texto(await o.pedir({ prompt: 'x', modelo: 'no-existe' })), /No hay un modelo «no-existe»[\s\S]*No se abrió ninguna tarjeta/);
  await guardarDoc(o.m.d1, 'estudio.config', { dailyLimit: 1 });
  assert.match(texto(await o.pedir({ prompt: 'x', cantidad: 4 })), /no cabe dentro de los topes de hoy/);
  assert.equal(o.tarjetas().length, 0);
});

test('CONEXIÓN CORTADA o RESTABLECER: las tarjetas se descartan y ya no se aprueban', { skip: SALTAR }, async () => {
  const o = await oficina(); await o.pedir(IMG); const [f] = o.tarjetas();
  const cx = (await o.m.admin('GET', '/api/conectar-claude')).j.conexiones.find((c) => c.alcance === 'gasto');
  assert.equal((await o.m.admin('DELETE', `/api/conectar-claude/${cx.id}`)).status, 200);
  const a = await o.m.admin('POST', `/api/conectar-claude/solicitudes/${f.id}/aprobar`, {});
  assert.equal(a.status, 409); assert.match(a.j.error, /descartada/); assert.equal(o.trabajos(), 0);
  assert.match(o.tarjetas()[0].motivo, /ya no existe/);
  // restablecer la oficina las borra (con las conexiones)
  const o2 = await oficina(); await o2.pedir(IMG); assert.equal(o2.tarjetas().length, 1);
  const p1 = await o2.m.admin('POST', '/api/restablecer', { modo: 'vacia', ambitos: IDS_AMBITOS });
  const p2 = await o2.m.admin('POST', '/api/restablecer/confirmar', { token: p1.j.pendiente.token, escribio: PALABRA }); assert.equal(p2.status, 200, JSON.stringify(p2.j).slice(0, 200));
  assert.equal(o2.tarjetas().length, 0);
});

test('AUDITORÍA: cada paso deja una fila «mcp-gasto» sin el contenido de lo pedido; y la poda borra lo viejo', { skip: SALTAR }, async () => {
  const o = await oficina(); await o.pedir({ prompt: 'SECRETO-DEL-PEDIDO-777' }); const [f] = o.tarjetas();
  await o.m.admin('POST', `/api/conectar-claude/solicitudes/${f.id}/aprobar`, {});
  const filas = o.m.db.prepare("select quien, detalle from auditoria where tipo = 'mcp-gasto' order by id").all();
  assert.deepEqual(filas.map((x) => JSON.parse(x.detalle).evento), ['pide', 'aprueba', 'ejecutada']);
  assert.ok(!JSON.stringify(filas).includes('SECRETO-DEL-PEDIDO-777'), 'el contenido no va a la auditoría');
  assert.ok(!JSON.stringify(filas).includes('access_token'));
  const n = await podar(o.m.d1, o.m.ahora() + 31 * 864e5); assert.equal(n.mcp_solicitudes, 1); assert.equal(o.tarjetas().length, 0);
});

test('PRESETS Y LOTES: la herramienta del Estudio prepara con costo por foto y deja tarjeta; nada se crea', { skip: SALTAR }, async () => {
  const o = await oficina();
  const id = (await o.m.admin('GET', '/api/media/presets')).j.presets[0].id;
  for (const [nombre, args] of [['crear_lote', { nombre: 'Lote de prueba', presets: [{ id }], fotos: ['2031-01/a.jpg', '2031-01/b.jpg'] }], ['aplicar_preset', { presets: [{ id }], idea: 'una cama' }]]) {
    const r = await o.pedir(args, nombre); assert.equal(r.j.result.isError, false, texto(r)); assert.match(texto(r), /no se (creó ningún lote|generó nada)/);
  }
  for (const f of o.tarjetas()) assert.ok(['crear_lote', 'aplicar_preset'].includes(f.herramienta));
  assert.equal(o.m.db.prepare("select count(*) n from docs where clave like 'estudio.lote%'").get().n, 0); assert.equal(o.trabajos(), 0, 'preparar un preset o un lote no crea nada');
});

test('TELEGRAM: la tarjeta sale al dueño con ✅ / ↩; solo el dueño responde; aprobar ejecuta por la ruta de siempre', { skip: SALTAR }, async () => {
  const o = await oficina({ extraEnv: { TELEGRAM_BOT_TOKEN: TOKEN_BOT, TELEGRAM_OWNER_ID: DUENO_TG } });
  const enviados = [], respuestas = [];
  const fetchFn = async (url, init) => { const cuerpo = JSON.parse(init?.body || '{}'); (/sendMessage/.test(url) ? enviados : respuestas).push(cuerpo); return new Response(JSON.stringify({ ok: true, result: {} }), { headers: { 'content-type': 'application/json' } }); };
  const bot = () => armar({ env: o.m.env, db: o.m.d1, modulos: MODULOS_BOT, fetchFn });
  await salientes(await bot()); // la primera vez solo apunta lo que ya había
  await o.pedir(IMG); const [f] = o.tarjetas();
  await salientes(await bot());
  const aviso = enviados.find((e) => /pide gastar/.test(e.text)); assert.ok(aviso, 'el aviso salió: ' + JSON.stringify(enviados).slice(0, 300));
  assert.equal(String(aviso.chat_id), DUENO_TG); assert.match(aviso.text, /US\$0,0\d/);
  const botones = aviso.reply_markup.inline_keyboard[0]; assert.deepEqual(botones.map((b) => b.callback_data), ['mg:' + f.id, 'mr:' + f.id]);
  assert.ok(!enviados.some((e) => String(e.chat_id) === EXTRANO_TG));
  const toque = (de, data, n) => ({ update_id: n, callback_query: { id: 'cb' + n, from: { id: +de }, data, message: { message_id: 5, chat: { id: +de, type: 'private' } } } });
  // un extraño que pulsa el botón no logra nada
  const t1 = await bot(); await t1.bot.procesar(toque(EXTRANO_TG, 'mg:' + f.id, 1)); assert.equal(o.tarjetas()[0].estado, 'espera'); assert.equal(o.trabajos(), 0);
  // el dueño aprueba: el Estudio recibe el trabajo por la ruta de siempre
  const t2 = await bot(); await t2.bot.procesar(toque(DUENO_TG, 'mg:' + f.id, 2));
  assert.equal(o.tarjetas()[0].estado, 'ejecutada'); assert.equal(o.trabajos(), 1);
  assert.match(enviados.map((e) => e.text).join('\n'), /Aprobado y pedido al Estudio/);
  // y rechazar desde el teléfono
  await o.pedir({ prompt: 'otra' }); const g = o.tarjetas()[1];
  const t3 = await bot(); await t3.bot.procesar(toque(DUENO_TG, 'mr:' + g.id, 3)); assert.equal(o.tarjetas()[1].estado, 'rechazada'); assert.equal(o.trabajos(), 1);
  assert.deepEqual(gastoMcpDeAviso({ key: 'mcp-gasto:no-valido' }), {}); assert.ok(!JSON.stringify(enviados).includes(TOKEN_BOT.split(':')[1]));
});

test('UN SOLO SITIO DE GASTO: el módulo de la tarjeta nunca toca un testigo de MCP, y el aviso de Telegram nunca lleva argumentos', { skip: SALTAR }, () => {
  const g = readFileSync(new URL('../worker/lib/mcp/gasto.js', import.meta.url), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(!/tokens\.js|emitir\(|revocar|access_token|refresh_token|canjear/.test(g), 'gasto.js no maneja testigos');
  assert.ok(/estado = 'ejecutando'[\s\S]*estado = 'espera'/.test(g), 'el paso de espera a ejecutando es un compare-and-set');
});

test('SENTENCIAS: pedir y aprobar caben en el plan gratuito (≤ 50 por petición)', { skip: SALTAR }, async () => {
  const o = await oficina(); const orig = o.m.d1.prepare; let n = 0;
  const contar = (st) => { for (const k of ['first', 'all', 'run']) { const f = st[k].bind(st); st[k] = (...a) => (n++, f(...a)); } return st; };
  o.m.d1.prepare = function (sql) { const st = orig.call(this, sql), b = st.bind.bind(st); st.bind = (...a) => contar(b(...a)); return contar(st); };
  n = 0; await o.pedir(IMG); const pedir = n; const [f] = o.tarjetas();
  n = 0; await o.m.admin('POST', `/api/conectar-claude/solicitudes/${f.id}/aprobar`, {}); const aprobar = n;
  o.m.d1.prepare = orig;
  assert.ok(pedir <= 50, 'pedir usó ' + pedir); assert.ok(aprobar <= 50, 'aprobar usó ' + aprobar);
});

test('CARRERA: dos aprobaciones a la vez no se pisan (la perdedora no marca «rechazada» sobre una ejecutada) y la auditoría dice quién pidió y quién aprobó', { skip: SALTAR }, async () => {
  const o = await oficina(); await o.pedir(IMG); const [f] = o.tarjetas(), ruta = `/api/conectar-claude/solicitudes/${f.id}`;
  await Promise.all([o.m.admin('POST', `${ruta}/aprobar`, {}), o.m.admin('POST', `${ruta}/aprobar`, {}), o.m.admin('POST', `${ruta}/rechazar`, {})]);
  const fin = o.tarjetas()[0]; assert.ok(['ejecutada', 'rechazada'].includes(fin.estado)); assert.equal(o.trabajos(), fin.estado === 'ejecutada' ? 1 : 0, 'el estado final cuenta lo que pasó de verdad');
  const ev = o.m.db.prepare("select detalle from auditoria where tipo = 'mcp-gasto' order by id").all().map((x) => JSON.parse(x.detalle));
  assert.equal(ev.filter((e) => e.evento === 'aprueba').length <= 1, true); const ap = ev.find((e) => e.evento === 'aprueba'); if (ap) { assert.equal(ap.pidio.persona, 'dueno@panaclaw.test'); assert.ok(ap.pidio.conexion); }
  assert.equal(ev.some((e) => e.evento === 'rechazada') && fin.estado === 'ejecutada', false, 'la auditoría no miente');
});

test('FALLA A MEDIAS → «incierta»: no se reabre el mismo pedido en 30 min, y un «ejecutando» que muere se da por interrumpido y no ofrece Aprobar', { skip: SALTAR }, async () => {
  const o = await oficina(); await o.pedir(IMG); const [f] = o.tarjetas();
  // el Estudio de mentira se cae DESPUÉS del compare-and-set: se rompe la tabla de trabajos
  o.m.db.exec("create trigger cae_el_estudio before insert on estudio_trabajos begin select raise(abort, 'se cayó'); end");
  const a = await o.m.admin('POST', `/api/conectar-claude/solicitudes/${f.id}/aprobar`, {});
  o.m.db.exec('drop trigger cae_el_estudio');
  assert.equal(a.j.estado, 'incierta'); assert.match(a.j.texto, /revisa el Estudio/); assert.equal(o.tarjetas()[0].estado, 'incierta');
  assert.match(texto(await o.pedir(IMG)), /quedó a medias[\s\S]*30 minutos/, 'el mismo pedido no se reabre'); assert.equal(o.tarjetas().length, 1);
  assert.equal((await o.m.admin('POST', `/api/conectar-claude/solicitudes/${f.id}/aprobar`, {})).status, 409, 'no se vuelve a aprobar');
  // un «ejecutando» abandonado pasa a «incierta» a los 10 min
  await o.pedir({ prompt: 'otro pedido' }); const g = o.tarjetas()[1];
  o.m.db.prepare("update mcp_solicitudes set estado = 'ejecutando', resuelta_at = ? where id = ?").run(o.m.ahora(), g.id);
  assert.equal((await o.m.admin('GET', '/api/conectar-claude/solicitudes')).j.esperan.some((x) => x.id === g.id), true, 'recién empezada: aún se ve');
  o.m.avanzar(11 * 60e3); const l = (await o.m.admin('GET', '/api/conectar-claude/solicitudes')).j;
  assert.equal(l.esperan.some((x) => x.id === g.id), false); assert.equal(l.hechas.find((x) => x.id === g.id).estado, 'incierta'); assert.match(l.hechas.find((x) => x.id === g.id).motivo, /Estudio/);
});

test('TOPE ATÓMICO: ocho pedidos a la vez de una conexión abren como mucho 5 tarjetas', { skip: SALTAR }, async () => {
  const o = await oficina();
  await Promise.all(Array.from({ length: 8 }, (_, i) => o.pedir({ prompt: 'a la vez ' + i })));
  assert.ok(o.tarjetas().length <= MAX_ABIERTAS, 'abrió ' + o.tarjetas().length);
});

test('SESIÓN, ORIGEN Y CONFIRMACIÓN: un Bearer de MCP no es sesión en ninguna ruta /api/; un Origin ajeno no aprueba; ≥ US$0,50 se aprueba porque la persona vio la cifra; Telegram firma con su id', { skip: SALTAR }, async () => {
  const o = await oficina({ extraEnv: { TELEGRAM_BOT_TOKEN: TOKEN_BOT, TELEGRAM_OWNER_ID: DUENO_TG } });
  // a) el Bearer no sirve como sesión
  for (const ruta of ['/api/yo', '/api/media/models', '/api/conectar-claude', '/api/conectar-claude/solicitudes', '/api/tasks']) assert.equal((await o.m.crudo(ruta, { cabeceras: { authorization: 'Bearer ' + o.t } })).status, 401, ruta);
  // un pedido caro (un video): pasa de US$0,50
  await o.pedir({ prompt: 'un recorrido por la tienda', segundos: 10 }, 'generar_video'); const [f] = o.tarjetas(); assert.ok(f.cifra_usd >= 0.5, 'cifra ' + f.cifra_usd);
  const ruta = `/api/conectar-claude/solicitudes/${f.id}/aprobar`;
  // d) Origen ajeno: no
  assert.equal((await o.m.crudo(ruta, { metodo: 'POST', cuerpo: {}, cookie: o.m.cookies.admin, cabeceras: { origin: 'https://evil.example' } })).status, 403); assert.equal(o.tarjetas()[0].estado, 'espera');
  // b) la persona que la aprueba con la cifra delante la ejecuta (el servidor del Estudio no exige otro paso)
  const a = await o.m.admin('POST', ruta, {}); assert.equal(a.status, 200); assert.equal(a.j.ok, true, JSON.stringify(a.j)); assert.equal(o.trabajos(), 1);
  // c) por Telegram: el nombre de quien pulsó, nunca vacío
  await o.pedir({ prompt: 'otra para el teléfono' }); const g = o.tarjetas()[1];
  const fetchFn = async () => new Response(JSON.stringify({ ok: true, result: {} }), { headers: { 'content-type': 'application/json' } });
  const t = await armar({ env: o.m.env, db: o.m.d1, modulos: MODULOS_BOT, fetchFn });
  await t.bot.procesar({ update_id: 9, callback_query: { id: 'cb9', from: { id: +DUENO_TG, first_name: 'Abrinay' }, data: 'mg:' + g.id, message: { message_id: 5, chat: { id: +DUENO_TG, type: 'private' } } } });
  assert.equal(o.tarjetas()[1].estado, 'ejecutada'); assert.equal(o.tarjetas()[1].resuelta_por, 'telegram: Abrinay');
});

test('VEREDICTO de lo que contesta la herramienta: con trabajo = ejecutada; un error escrito = rechazada; sin nada = incierta (nunca «ejecutada» a ciegas)', { skip: SALTAR }, () => {
  assert.equal(veredicto('Sigue en proceso con X (queued). ⏳ Estudio: una cama (trabajo jmwdmxotm5a1)').estado, 'ejecutada');
  assert.equal(veredicto('Listo: 2 imágenes con X (aprox. US$0.01).').estado, 'ejecutada');
  assert.equal(veredicto('En marcha: lote «A», 3 fotos').estado, 'ejecutada');
  assert.equal(veredicto('⛔ El modelo está apagado').estado, 'rechazada');
  assert.equal(veredicto({ text: 'lo que sea', isError: true }).estado, 'rechazada');
  assert.equal(veredicto('Hecho.').estado, 'incierta'); assert.equal(veredicto(undefined).estado, 'incierta'); assert.match(veredicto('').texto, /Historial del Estudio/);
});

test('TELEGRAM solo ve las tarjetas: del módulo mcp el bot no llega a cortar conexiones ni a nada más de /api/conectar-claude', { skip: SALTAR }, async () => {
  const o = await oficina({ extraEnv: { TELEGRAM_BOT_TOKEN: TOKEN_BOT, TELEGRAM_OWNER_ID: DUENO_TG } }); await o.pedir(IMG); const [f] = o.tarjetas();
  const { crearOffice } = await import('../worker/lib/agentes/herramientas.js');
  const office = crearOffice({ env: o.m.env, db: o.m.d1, usuario: { id: 'telegram', email: 'telegram: x', rol: 'admin' }, modulos: MODULOS_BOT });
  assert.ok((await office('/api/conectar-claude/solicitudes')).esperan.length >= 1);
  const cx = (await o.m.admin('GET', '/api/conectar-claude')).j.conexiones[0];
  for (const [r, m] of [['/api/conectar-claude', 'GET'], ['/api/conectar-claude/cortar-todas', 'POST'], [`/api/conectar-claude/${cx.id}`, 'DELETE']]) await assert.rejects(office(r, {}, m), /todavía no está/, r);
  assert.equal((await o.m.admin('GET', '/api/conectar-claude')).j.conexiones.length >= 1, true, 'nada se cortó');
  assert.equal(mcpSoloSolicitudes.manejar({ ruta: '/api/conectar-claude/cortar-todas' }), null);
  assert.equal(o.tarjetas()[0].id, f.id);
});

test('MISMO PEDIDO A LA VEZ: tres peticiones idénticas abren UNA tarjeta (índice único parcial)', { skip: SALTAR }, async () => {
  const o = await oficina();
  const r = await Promise.all([1, 2, 3].map(() => o.pedir(IMG)));
  assert.equal(o.tarjetas().length, 1); for (const x of r) assert.equal(x.j.result.isError, false);
});

test('INCIERTA tardía: una tarjeta aprobada 2 h después de crearla y fallada bloquea el mismo pedido desde ESE momento; y un «⛔» que nombra un trabajo es rechazada', { skip: SALTAR }, async () => {
  const o = await oficina(); await o.pedir(IMG); const [f] = o.tarjetas();
  o.m.db.prepare("update mcp_solicitudes set estado = 'incierta', resuelta_at = ? where id = ?").run(o.m.ahora(), f.id); // aprobada hace un momento (la tarjeta nació hace 2 h)
  o.m.db.prepare('update mcp_solicitudes set creada_at = creada_at - ?, vence_at = vence_at - ? where id = ?').run(2 * 3600e3, 2 * 3600e3, f.id);
  assert.match(texto(await o.pedir(IMG)), /quedó a medias/); assert.equal(o.tarjetas().length, 1);
  assert.equal(veredicto('⛔ Este trabajo costaría US$3 y pasa el tope (trabajo jabc12345)').estado, 'rechazada');
  assert.equal(veredicto('trabajo sin-forma-real').estado, 'incierta');
});
