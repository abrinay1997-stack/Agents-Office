// Ayudas del guion de punta a punta (e2e-oficina.test.mjs): UNA oficina en memoria con todo cableado — D1 con las migraciones reales, R2 de mentira, un Anthropic de
// mentira que contesta lo que se le guiona, un MCP de mentira (Gmail), un Telegram de mentira y el Meta de mentira de la oficina (tests/meta-stand.mjs).
// NUNCA una llave ni una red de verdad: cada URL externa la contesta `fetchFn` o se apunta en `reg.otros` (y el guion lo exige vacío).
import { crearD1, sembrar, envDePrueba } from './d1-memoria.mjs';
import { crearR2 } from './r2-memoria.mjs';
import { manejar, correrReloj } from '../worker/lib/rutas.js';
import { instalarZona } from '../worker/lib/zona.js';
import { guardarDoc } from '../worker/lib/almacen.js';
import { usarFetchDePrueba } from '../worker/lib/anuncios-nube.js';
import { crearMetaStand, TOKEN_STAND, CUENTA_STAND } from '../../tests/meta-stand.mjs';
import { PERMISOS_LECTURA, PERMISOS_ANUNCIOS } from '../../contenido/meta.mjs';
import { crearFetch, texto } from './agentes-ayudas.mjs';
import { prepararMeta } from './ayuda-meta.mjs';

export const TOKEN_BOT = '123456789:AAFakeTokenFakeTokenFakeTokenFake_abc'; // secrets-ok: de mentira
export const SECRETO_TG = 'secreto-del-webhook-de-prueba-123'; // secrets-ok: de mentira
export const HOOK = 'hook-de-prueba-1234567890'; // secrets-ok: de mentira
export const DUENO_TG = '111222333', APROBADOR_TG = '444555666', EXTRANO_TG = '999000111';
export const CLAVE = 'una-clave-larga-123'; // secrets-ok

export const respuestaIA = (content, extra = {}) => ({ content, stop_reason: 'end_turn', usage: { input_tokens: 1000, output_tokens: 400 }, model: 'claude-sonnet-5', ...extra });
export const dimitriDice = (obj) => respuestaIA([{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }]);
export { texto };

/** El mundo de fuera: cada URL que el Worker pueda tocar. `guion` es la cola de respuestas de Anthropic (una por llamada, en orden); sin guion, una por defecto según quién pregunta. */
export function crearMundo({ meta, herramientasMcp }) {
  const reg = { anthropic: [], telegram: [], otros: [], meta: 0 };
  const guion = [];
  const mcp = crearFetch({ herramientasMcp });
  const fetchFn = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.anthropic.com/')) {
      const cuerpo = JSON.parse(init.body); reg.anthropic.push(cuerpo);
      if (guion.length) { const r = guion.shift(); if (r instanceof Error) throw r; return new Response(JSON.stringify(r), { status: 200 }); }
      const sis = JSON.stringify(cuerpo.system ?? '');
      const r = /Eres Dimitri/.test(sis) ? dimitriDice({ mode: 'charla', reply: 'Entendido (por defecto).' }) : texto('Entrega por defecto.\nFuentes: —');
      return new Response(JSON.stringify(r), { status: 200 });
    }
    if (u.startsWith('https://api.telegram.org/bot')) {
      let cuerpo = null; try { cuerpo = typeof init.body === 'string' ? JSON.parse(init.body) : { formData: true }; } catch { /* multipart */ }
      reg.telegram.push({ metodo: u.split('/').pop(), cuerpo }); return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
    }
    if (u.startsWith('https://graph.test') || u.startsWith('https://rupload.test')) { reg.meta++; return meta.fetchFn(url, init); }
    if (u.startsWith('https://gmail.mcp.example.com')) return mcp.fetchFn(url, init);
    reg.otros.push(u); return new Response('{}', { status: 404 });
  };
  const textosTelegram = () => reg.telegram.filter((x) => x.metodo === 'sendMessage').map((x) => x.cuerpo?.text || '');
  return { fetchFn, reg, guion, mcp: herramientasMcp, mcpReg: mcp.registro, textosTelegram };
}

/** La oficina entera. El fundador es admin desde el primer día; el resto entra por invitación (lo hace el guion). */
export async function montarOficina({ extraEnv = {}, ajustes = null } = {}) {
  instalarZona('America/Panama');
  const d1 = crearD1(), admin = await sembrar(d1, { email: 'ana@panaclaw.test', clave: CLAVE });
  const meta = crearMetaStand({ permisos: [...PERMISOS_LECTURA, ...PERMISOS_ANUNCIOS] });
  const ids = await prepararMeta(meta);
  const herramientasMcp = { search_threads: { salida: 'Hilo con Ana: pide el precio.' }, create_draft: { salida: 'borrador creado' }, send_email: { salida: 'enviado' } };
  const mundo = crearMundo({ meta, herramientasMcp });
  const r2 = crearR2();
  await guardarDoc(d1, 'config-local', { anuncios: { cuenta: CUENTA_STAND, whatsapp: '50760001111', topeDiario: 30, topeMensual: 300, topeCampana: 150 }, contenido: { modo: 'simulacro' } });
  if (ajustes) await guardarDoc(d1, 'ajustes', ajustes);
  d1._db.prepare("insert into conectores (id,nombre,url,secreto,departamentos,herramientas_lectura,herramientas_envio,activo,created_at) values ('1','gmail',?,?,?,?,?,1,'x')")
    .run('https://gmail.mcp.example.com/mcp', 'MCP_GMAIL_TOKEN', '["emails"]', '["search_threads","create_draft"]', '["send_email"]');
  const env = envDePrueba(d1, {
    MEDIA: r2, ANTHROPIC_API_KEY: 'sk-ant-secreto-de-prueba', MCP_GMAIL_TOKEN: 'tok-mcp', META_ACCESS_TOKEN: TOKEN_STAND, META_GRAPH_HOST: 'https://graph.test', AO_HOOK_TOKEN: HOOK,
    TELEGRAM_BOT_TOKEN: TOKEN_BOT, TELEGRAM_OWNER_ID: DUENO_TG, TELEGRAM_WEBHOOK_SECRET: SECRETO_TG, STRIPE_WEBHOOK_SECRET: 'whsec_secreto_de_prueba_1234567890', // secrets-ok: de mentira
    AGENTES_MAX_CONSULTAS: '5000', AGENTES_MAX_LLAMADAS: '500', ...extraEnv,
  });
  env.__pruebas = { fetch: mundo.fetchFn, fetchIA: mundo.fetchFn };
  env.AO_FETCH = mundo.fetchFn;
  usarFetchDePrueba(mundo.fetchFn);
  const cookies = {};
  const llamar = (quien) => async (metodo, ruta, cuerpo, cabeceras = {}) => {
    const r = await manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { ...(cuerpo !== undefined && typeof cuerpo !== 'string' && !(cuerpo instanceof Uint8Array) ? { 'content-type': 'application/json' } : {}), ...(quien && cookies[quien] ? { cookie: cookies[quien] } : {}), ...cabeceras }, body: cuerpo === undefined ? undefined : typeof cuerpo === 'string' || cuerpo instanceof Uint8Array ? cuerpo : JSON.stringify(cuerpo) }), env);
    const tx = await r.text(); let j; try { j = JSON.parse(tx); } catch { j = tx; } return { status: r.status, j, texto: tx, cabeceras: r.headers };
  };
  const entrar = async (quien, email, clave) => {
    const r = await manejar(new Request('https://oficina.test/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, contrasena: clave }) }), env);
    if (r.status !== 200) throw new Error('no entró ' + email + ' ' + r.status);
    cookies[quien] = r.headers.get('set-cookie').split(';')[0];
  };
  await entrar('ana', admin.email, admin.clave);
  const reloj = async (n = 1) => { for (let i = 0; i < n; i++) await correrReloj(env); };
  const filas = (sql, ...a) => d1._db.prepare(sql).all(...a);
  return { d1, env, mundo, meta, ids, r2, cookies, llamar, entrar, reloj, filas, ana: llamar('ana'), anon: llamar(null) };
}
