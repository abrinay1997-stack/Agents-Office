// Un cliente MCP remoto propio (transporte «Streamable HTTP»: JSON-RPC por POST, con respuesta JSON o SSE). Es lo que permite que el Worker
// revise CADA llamada a una herramienta con safety.mjs: el conector MCP de la API de Anthropic llama por su cuenta y no se puede interceptar.
//
// Reglas (no negociables):
//  · el token sale de `env[conector.secreto]` y SOLO viaja en la cabecera Authorization hacia la URL del conector; jamás en un error, un registro ni D1;
//  · solo https públicos (la misma regla que al registrar el conector: lib/conectores.js → urlPermitida), sin seguir redirecciones (un 30x podría llevarse el token);
//  · cada petición HTTP cuenta como una llamada externa del presupuesto de la invocación (50 en el plan gratuito);
//  · lo que devuelve un servidor es un DATO: se recorta, y el guardián lo revisa en busca de órdenes escondidas antes de que el modelo lo lea.
import { urlPermitida, secretoPermitido, AVISO_SECRETO } from '../conectores.js';
import { injectionIn } from '../../../../safety.mjs';

export const VERSION_PROTOCOLO = '2025-06-18';
const MAX_RESPUESTA = 1_000_000;   // bytes que se leen de un servidor
const MAX_TEXTO = 20_000;          // lo que se le deja ver al modelo de una sola herramienta
const TIEMPO_MS = 25_000;
const MAX_ESQUEMA = 8_000;         // una herramienta con un esquema mayor se deja fuera
const MAX_CATALOGO = 60_000;       // y lo que ocupan todas las herramientas remotas juntas en el pedido al modelo

/** Un mensaje de error sin el token ni la dirección completa. */
const limpio = (m, token) => { let t = String(m ?? 'falló'); if (token) t = t.split(token).join('«secreto»'); return t.slice(0, 300); };

/** Lee el cuerpo por trozos y se corta al pasar `tope` bytes: nunca se carga entero en memoria lo que un tercero decida mandar. */
async function leerConTope(r, tope) {
  if (!r.body?.getReader) { const t = await r.text(); if (t.length > tope) throw Object.assign(new Error('grande'), { tope: true }); return t; }
  const lector = r.body.getReader(), trozos = []; let n = 0;
  try {
    for (;;) {
      const { done, value } = await lector.read(); if (done) break;
      n += value.byteLength; if (n > tope) { try { await lector.cancel(); } catch { /* */ } throw Object.assign(new Error('grande'), { tope: true }); }
      trozos.push(value);
    }
  } finally { try { lector.releaseLock(); } catch { /* */ } }
  const todo = new Uint8Array(n); let o = 0; for (const t of trozos) { todo.set(t, o); o += t.byteLength; }
  return new TextDecoder().decode(todo);
}

function mensajeDeSSE(texto, id) {
  for (const bloque of String(texto).split(/\r?\n\r?\n/)) {
    const datos = bloque.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
    if (!datos) continue;
    try { const m = JSON.parse(datos); if (m && (id === undefined || m.id === id)) return m; } catch { /* un evento que no es JSON-RPC */ }
  }
  return null;
}

/** `presupuesto.externa()` se llama una vez por petición HTTP. `fetchFn(url, init)` se inyecta en las pruebas. */
export function crearClienteMcp({ conector, env, fetchFn = (...a) => fetch(...a), presupuesto = null, tiempoMs = TIEMPO_MS, maxRespuesta = MAX_RESPUESTA }) {
  const secretoValido = !conector.secreto || secretoPermitido(conector.secreto); // solo un secreto MCP_* puede salir hacia un conector
  const token = conector.secreto && secretoValido ? env?.[conector.secreto] : null;
  let sesion = null, iniciado = false, n = 0;
  const motivoUrl = urlPermitida(conector.url);

  async function enviar(mensaje, esperar = true) {
    if (motivoUrl) throw new Error(`el conector «${conector.nombre}» tiene una dirección no permitida (${motivoUrl})`);
    if (!secretoValido) throw new Error(AVISO_SECRETO(conector.secreto));
    if (conector.secreto && !token) throw new Error(`falta el secreto ${conector.secreto} del conector «${conector.nombre}»`);
    presupuesto?.externa();
    const cab = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': VERSION_PROTOCOLO };
    if (token) cab.authorization = `Bearer ${token}`;
    if (sesion) cab['mcp-session-id'] = sesion;
    const ac = new AbortController(), reloj = setTimeout(() => ac.abort(), tiempoMs);
    let r, texto = '';
    try { // el plazo vale también para LEER el cuerpo: un servidor que manda la cabecera y se queda goteando bytes no puede colgar el paso
      try { r = await fetchFn(conector.url, { method: 'POST', headers: cab, body: JSON.stringify(mensaje), redirect: 'manual', signal: ac.signal }); }
      catch (e) { throw new Error(`no se pudo hablar con «${conector.nombre}»: ${e?.name === 'AbortError' ? 'tardó demasiado' : limpio(e?.message, token)}`); }
      if (r.status >= 300 && r.status < 400) throw new Error(`«${conector.nombre}» redirige a otra dirección: no se sigue (el token no sale de la dirección registrada)`);
      const sid = r.headers?.get?.('mcp-session-id'); if (sid) sesion = sid;
      if (r.status === 401 || r.status === 403) throw new Error(`«${conector.nombre}» rechazó el acceso: revisa el token del conector`);
      if (!r.ok) throw new Error(`«${conector.nombre}» contestó ${r.status}`);
      if (!esperar) { try { await r.body?.cancel?.(); } catch { /* */ } return null; }
      try { texto = await leerConTope(r, maxRespuesta); }
      catch (e) { throw new Error(e?.tope ? `«${conector.nombre}» contestó con más de ${Math.round(maxRespuesta / 1e6)} MB: se corta` : `no se pudo leer lo que contestó «${conector.nombre}»: ${ac.signal.aborted || e?.name === 'AbortError' ? 'tardó demasiado' : limpio(e?.message, token)}`); }
    } finally { clearTimeout(reloj); }
    const tipo = String(r.headers?.get?.('content-type') || '');
    let m = null;
    if (/event-stream/i.test(tipo)) m = mensajeDeSSE(texto, mensaje.id);
    else { try { m = JSON.parse(texto); } catch { /* */ } if (Array.isArray(m)) m = m.find(x => x?.id === mensaje.id) || null; }
    if (!m) throw new Error(`«${conector.nombre}» no contestó con un mensaje MCP válido`);
    if (m.error) throw new Error(`«${conector.nombre}»: ${limpio(m.error.message, token)}`);
    return m.result ?? {};
  }

  async function iniciar() {
    if (iniciado) return;
    await enviar({ jsonrpc: '2.0', id: ++n, method: 'initialize', params: { protocolVersion: VERSION_PROTOCOLO, capabilities: {}, clientInfo: { name: 'agents-office', version: '1.0.0' } } });
    try { await enviar({ jsonrpc: '2.0', method: 'notifications/initialized' }, false); } catch { /* algunos servidores no contestan a la notificación */ }
    iniciado = true;
  }

  return {
    nombre: conector.nombre,
    /** Las herramientas del servidor: [{ name, description, inputSchema }] (hasta 200). */
    async listar() {
      await iniciar();
      const out = []; let cursor;
      for (let i = 0; i < 4; i++) {
        const r = await enviar({ jsonrpc: '2.0', id: ++n, method: 'tools/list', params: cursor ? { cursor } : {} });
        out.push(...(Array.isArray(r.tools) ? r.tools : []));
        if (!r.nextCursor || out.length >= 200) break; cursor = r.nextCursor;
      }
      // M4: el nombre, la descripción y el esquema de una herramienta REMOTA llegan al modelo como si fueran del sistema. Si traen órdenes escondidas, o pesan demasiado, esa herramienta no se ofrece.
      const buenas = [], excluidas = []; let total = 0;
      for (const t of out) {
        if (!t || typeof t.name !== 'string') continue;
        const descripcion = String(t.description || '').slice(0, 1000);
        const esquema = t.inputSchema && typeof t.inputSchema === 'object' ? t.inputSchema : { type: 'object', properties: {} };
        let js; try { js = JSON.stringify(esquema); } catch { js = null; }
        const motivo = js === null ? 'su esquema no se puede leer'
          : js.length > MAX_ESQUEMA ? 'su esquema es demasiado grande'
          : injectionIn(`${t.name}\n${descripcion}\n${js}`) ? 'su descripción trae órdenes escondidas'
          : total + descripcion.length + js.length > MAX_CATALOGO ? 'el catálogo del servidor ya ocupa demasiado' : null;
        if (motivo) { excluidas.push({ name: String(t.name).slice(0, 80), motivo }); continue; }
        total += descripcion.length + js.length;
        buenas.push({ name: t.name, description: descripcion, inputSchema: esquema });
        if (buenas.length >= 200) break;
      }
      buenas.excluidas = excluidas;
      return buenas;
    },
    /** → { texto, esError }. Nunca lanza por un fallo del servidor: el modelo lo lee como resultado de la herramienta. */
    async llamar(nombreHerramienta, argumentos) {
      try {
        await iniciar();
        const r = await enviar({ jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name: nombreHerramienta, arguments: argumentos && typeof argumentos === 'object' ? argumentos : {} } });
        const partes = Array.isArray(r.content) ? r.content : [];
        let texto = partes.map(p => (p?.type === 'text' ? String(p.text ?? '') : `[${p?.type || 'contenido'}]`)).join('\n').trim();
        if (!texto && r.structuredContent) texto = JSON.stringify(r.structuredContent);
        if (texto.length > MAX_TEXTO) texto = texto.slice(0, MAX_TEXTO) + '\n[… recortado]';
        return { texto: texto || '(sin contenido)', esError: !!r.isError };
      } catch (e) { return { texto: `No se pudo: ${limpio(e?.message, token)}`, esError: true }; }
    },
  };
}
