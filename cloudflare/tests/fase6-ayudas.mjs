// Lo común de los tests de la fase 6 (Dimitri, Negocio, Ajustes, Telegram, disparadores): una oficina con D1 en memoria, un Anthropic de mentira que contesta lo que se le guiona
// (y guarda lo que recibió), un Telegram de mentira que apunta cada llamada, y la página (admin / editor / lectura) llamando a la API del Worker. NUNCA una llave ni una red de verdad.
import { crearD1, sembrar, envDePrueba } from './d1-memoria.mjs';
import { crearR2 } from './r2-memoria.mjs';
import { instalarZona } from '../worker/lib/zona.js';
import { manejar } from '../worker/lib/rutas.js';

export const respuestaIA = (content, extra = {}) => ({ content, stop_reason: 'end_turn', usage: { input_tokens: 1000, output_tokens: 400 }, model: 'claude-sonnet-5', ...extra });
export const dimitriDice = (obj) => respuestaIA([{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }]);

export const TOKEN_BOT = '123456789:AAFakeTokenFakeTokenFakeTokenFake_abc'; // secrets-ok: de mentira
export const SECRETO_WEBHOOK = 'secreto-del-webhook-de-prueba-123'; // secrets-ok: de mentira
export const DUENO_TG = '111222333', APROBADOR_TG = '444555666', EXTRANO_TG = '999000111';
export const HOOK = 'hook-de-prueba-1234567890'; // secrets-ok: de mentira

/** Un fetch con Anthropic (guion de respuestas; `registro.anthropic` guarda lo recibido) y Telegram (`registro.telegram`: cada método con su cuerpo). */
export function mundo({ guion = [], telegramFalla = null } = {}) {
  const registro = { anthropic: [], telegram: [], otros: [] };
  const fetchFn = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.anthropic.com/')) {
      { const cuerpo = JSON.parse(init.body); if (Array.isArray(cuerpo.system)) { cuerpo.systemBloques = cuerpo.system; cuerpo.system = cuerpo.system.map((b) => b.text).join('\n\n'); } registro.anthropic.push(cuerpo); } // 27 oct 2026: el sistema de Dimitri va en dos bloques (el fijo con caché); los tests lo leen como un texto y `systemBloques` guarda los bloques
      const r = guion.shift() || dimitriDice({ mode: 'charla', reply: 'Entendido.' });
      return new Response(JSON.stringify(r), { status: 200 });
    }
    if (u.startsWith('https://api.telegram.org/bot')) {
      const metodo = u.split('/').pop();
      let cuerpo = null; try { cuerpo = typeof init.body === 'string' ? JSON.parse(init.body) : { formData: true }; } catch { /* multipart */ }
      registro.telegram.push({ metodo, cuerpo, url: u });
      if (telegramFalla) return new Response(JSON.stringify({ ok: false, description: telegramFalla }), { status: 400 });
      return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
    }
    registro.otros.push(u);
    return new Response('{}', { status: 404 });
  };
  const textosTelegram = () => registro.telegram.filter((x) => x.metodo === 'sendMessage').map((x) => x.cuerpo?.text || '');
  return { fetchFn, registro, guion, textosTelegram };
}

/** La oficina: D1 con un administrador, un editor y alguien de solo lectura; las llaves de mentira; la página llamando. */
export async function oficina6({ guion = [], extraEnv = {}, ajustes = null, telegramFalla = null } = {}) {
  instalarZona('America/Panama');
  const d1 = crearD1(), admin = await sembrar(d1);
  const editor = await sembrar(d1, { email: 'editor@panaclaw.test', rol: 'editor' }), lectura = await sembrar(d1, { email: 'lee@panaclaw.test', rol: 'lectura' });
  const m = mundo({ guion, telegramFalla });
  const env = envDePrueba(d1, { MEDIA: crearR2(), ANTHROPIC_API_KEY: 'sk-ant-secreto-de-prueba', AO_HOOK_TOKEN: HOOK, ...extraEnv });
  env.__pruebas = { fetch: m.fetchFn, fetchIA: m.fetchFn };
  if (ajustes) d1._db.prepare("insert into docs (clave, json, version, actualizado) values ('ajustes', ?, 1, 'x')").run(JSON.stringify(ajustes));
  const cookies = {};
  for (const [quien, c] of [['admin', admin], ['editor', editor], ['lectura', lectura]]) {
    const r = await manejar(new Request('https://oficina.test/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: c.email, contrasena: c.clave }) }), env);
    cookies[quien] = r.headers.get('set-cookie').split(';')[0];
  }
  const llamar = (quien) => async (metodo, ruta, cuerpo, cabeceras = {}) => {
    const r = await manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { 'content-type': 'application/json', ...(quien ? { cookie: cookies[quien] } : {}), ...cabeceras }, body: cuerpo === undefined ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) }), env);
    const tx = await r.text(); let j; try { j = JSON.parse(tx); } catch { j = tx; } return { status: r.status, j, texto: tx, cabeceras: r.headers };
  };
  return { d1, env, m, admin: llamar('admin'), editor: llamar('editor'), lectura: llamar('lectura'), anon: llamar(null), llamar };
}

/** Cuenta cuántas sentencias toca D1 una función (para demostrar que una petición rechazada no abrió nada). */
export function contandoD1(d1) {
  const n = { prepare: 0 };
  return { n, d1: { ...d1, prepare: (sql) => { n.prepare++; return d1.prepare(sql); }, batch: (l) => { n.prepare++; return d1.batch(l); } } };
}
export const filas = (d1, sql, ...a) => d1._db.prepare(sql).all(...a);
export const todoD1 = (d1) => d1._db.prepare("select name from sqlite_master where type = 'table'").all().map((t) => JSON.stringify(d1._db.prepare(`select * from "${t.name}"`).all())).join('\n');
