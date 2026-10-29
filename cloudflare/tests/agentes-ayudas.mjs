// Ayudas de los tests de la fase 4: una oficina con D1 en memoria, un Anthropic de mentira (respuestas en guion) y un servidor MCP de mentira.
import { crearD1, sembrar, envDePrueba } from './d1-memoria.mjs';
import { instalarZona } from '../worker/lib/zona.js';
import * as AGENTES from '../worker/modulos/agentes.js';
import * as TAREAS from '../worker/modulos/tareas.js';
import { cargarTareas } from '../worker/lib/tareas/sesion.js';

/** El texto del `system` de una petición a Anthropic: string, o bloques [{ type: 'text', text, cache_control }] (COS-01). */
export const sis = c => Array.isArray(c?.system) ? c.system.map(b => b.text).join('\n') : c?.system;
export const URL_MCP = 'https://gmail.mcp.example.com/mcp';
export const respuesta = (content, extra = {}) => ({ content, stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 }, model: 'claude-sonnet-5', ...extra });
export const texto = t => respuesta([{ type: 'text', text: t }]);
export const usar = (...usos) => respuesta(usos.map(([name, input], i) => ({ type: 'tool_use', id: 'tu_' + Math.random().toString(36).slice(2, 8) + i, name, input })), { stop_reason: 'tool_use' });

/** Un fetch que contesta a Anthropic con un guion (cola de respuestas) y a un servidor MCP con herramientas. `registro` guarda lo enviado. */
export function crearFetch({ guion = [], herramientasMcp = {}, tokenMcp = 'tok-mcp', fallaAnthropic = null } = {}) {
  const registro = { anthropic: [], mcp: [], otros: [] };
  const fetchFn = async (url, init = {}) => {
    const u = String(url), cuerpo = init.body ? JSON.parse(init.body) : null;
    if (u.startsWith('https://api.anthropic.com/')) {
      registro.anthropic.push({ cuerpo, cabeceras: init.headers });
      if (fallaAnthropic) return new Response(JSON.stringify({ error: { message: fallaAnthropic.mensaje || 'x' } }), { status: fallaAnthropic.estado });
      const r = guion.shift() || texto('Entrega final.\nFuentes: ninguna.');
      return new Response(JSON.stringify(r), { status: 200 });
    }
    if (u === URL_MCP) {
      registro.mcp.push({ cuerpo, auth: init.headers?.authorization, sesion: init.headers?.['mcp-session-id'] });
      if (init.headers?.authorization !== `Bearer ${tokenMcp}`) return new Response('no', { status: 401 });
      const rpc = (result) => new Response(JSON.stringify({ jsonrpc: '2.0', id: cuerpo.id, result }), { status: 200, headers: { 'content-type': 'application/json', 'mcp-session-id': 's1' } });
      if (cuerpo.method === 'initialize') return rpc({ protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'gmail', version: '1' } });
      if (cuerpo.method === 'notifications/initialized') return new Response(null, { status: 202 });
      if (cuerpo.method === 'tools/list') return rpc({ tools: Object.entries(herramientasMcp).map(([name, h]) => ({ name, description: h.descripcion || name, inputSchema: { type: 'object', properties: {} } })) });
      if (cuerpo.method === 'tools/call') { const h = herramientasMcp[cuerpo.params.name]; if (!h) return rpc({ content: [{ type: 'text', text: 'no existe' }], isError: true }); h.llamadas = (h.llamadas || 0) + 1; h.ultimo = cuerpo.params.arguments; if (h.alLlamar) await h.alLlamar(cuerpo.params.arguments); return rpc({ content: [{ type: 'text', text: h.salida ?? 'ok' }] }); }
    }
    registro.otros.push(u);
    return new Response('{}', { status: 404 });
  };
  return { fetchFn, registro, guion };
}

export async function oficina({ ajustes = null, env: extra = {}, conector = true } = {}) {
  instalarZona('America/Panama');
  const d1 = crearD1(); await sembrar(d1);
  const env = envDePrueba(d1, { ANTHROPIC_API_KEY: 'sk-ant-secreto-de-prueba', MCP_GMAIL_TOKEN: 'tok-mcp', ...extra });
  if (ajustes) d1._db.prepare("insert into docs (clave, json, version, actualizado) values ('ajustes', ?, 1, 'x')").run(JSON.stringify(ajustes));
  if (conector) d1._db.prepare("insert into conectores (id,nombre,url,secreto,departamentos,herramientas_lectura,herramientas_envio,activo,created_at) values ('1','gmail',?,?,?,?,?,1,'x')")
    .run(URL_MCP, 'MCP_GMAIL_TOKEN', '["emails"]', '["search_threads","create_draft"]', '["send_email"]');
  return { d1, env };
}

/** Crea una tarea lista en la cola para un agente. */
export async function tarea(env, campos = {}) {
  return TAREAS.altaTareaDb(env, { dept: 'emails', agent: 'elead', title: 'Contestar al cliente', text: 'Contesta el correo de Ana.', by: 'you', needsOk: false, ...campos }, { por: 'dueno', arrancar: false });
}
export const tareaEnDisco = async (d1, id) => (await cargarTareas(d1)).find(t => t.id === id);

/** Corre el reloj de los agentes N veces (cada una es «un minuto»). */
export async function minutos(env, fetchFn, n = 1, opciones = {}) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(await AGENTES.cadaMinuto(env, { fetchFn, ...opciones }));
  return out;
}
export const filas = (d1, sql, ...a) => d1._db.prepare(sql).all(...a);

/** La página: entra como admin / editor / lectura y llama a la API del Worker. */
export async function pagina({ d1, env }) {
  const { manejar } = await import('../worker/lib/rutas.js');
  const editor = await sembrar(d1, { email: 'editor@panaclaw.test', rol: 'editor' });
  const lectura = await sembrar(d1, { email: 'lee@panaclaw.test', rol: 'lectura' });
  const admin = { email: 'dueno@panaclaw.test', clave: 'una-clave-larga-123' }; // secrets-ok
  const entrar = async u => (await manejar(new Request('https://oficina.test/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: u.email, contrasena: u.clave }) }), env)).headers.get('set-cookie').split(';')[0];
  const cookies = { admin: await entrar(admin), editor: await entrar(editor), lectura: await entrar(lectura) };
  const llamar = quien => async (metodo, ruta, cuerpo) => {
    const r = await manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { 'content-type': 'application/json', cookie: cookies[quien] }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }), env);
    const tx = await r.text(); let j; try { j = JSON.parse(tx); } catch { j = tx; } return { status: r.status, j, texto: tx };
  };
  return { admin: llamar('admin'), editor: llamar('editor'), lectura: llamar('lectura') };
}
/** Todo lo que hay en D1 como un solo texto (para comprobar que un secreto no está en ningún sitio). */
export function todoD1(d1) {
  const tablas = d1._db.prepare("select name from sqlite_master where type = 'table'").all().map(t => t.name);
  return tablas.map(t => JSON.stringify(d1._db.prepare(`select * from "${t}"`).all())).join('\n');
}

/** Cambia una tarea EN D1 por detrás de la API (lo que haría otra petición, otra fase o alguien con acceso a la base) sin tocar su versión. */
export function mutarTarea(d1, id, fn) {
  const fila = d1._db.prepare("select json from filas where coleccion = 'tareas' and id = ?").get(id);
  const t = JSON.parse(fila.json); fn(t);
  d1._db.prepare("update filas set json = ? where coleccion = 'tareas' and id = ?").run(JSON.stringify(t), id);
  return t;
}
