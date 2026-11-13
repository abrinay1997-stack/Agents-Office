// Bitácora del descubrimiento y del OAuth del conector MCP: UNA línea de console.log (JSON) por petición a /mcp, /oauth/* y /.well-known/*, para ver qué pide un cliente y qué se le contesta.
// NUNCA entra aquí: cabeceras de autorización ni cookies, cuerpos, testigos, códigos, la dirección IP, el texto de la consulta (state, code_challenge…) ni lo que devuelve una herramienta.
// Solo: cuándo, método, ruta (sin consulta), estado, el agente de usuario (60 letras), el Origin, el país, cuántos ms tardó y un motivo corto sacado del CÓDIGO de error (no de su descripción).
// Si falla, la petición sigue como si nada: una bitácora que rompe el conector sería peor que no tenerla.

const LIMPIA = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g;
const corto = (v, n) => String(v ?? '').replace(LIMPIA, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const PARECE_ORIGEN = /^(https?:\/\/[A-Za-z0-9.\-]{1,100}(:\d{1,5})?|null)$/;

/** Solo la forma «origen + ruta» de una dirección de vuelta (sin consulta ni fragmento: ahí podría ir algo ajeno a la dirección). */
export function direccionCorta(uri) {
  try { const u = new URL(String(uri)); return corto(u.protocol + '//' + u.host + u.pathname, 120); } catch { return '[no es una dirección]'; }
}

/** El motivo corto de un fallo: el CÓDIGO de error de la respuesta (`error`), nunca su descripción ni su cuerpo. */
export async function motivoDe(resp, { hostCanonico = true } = {}) {
  const e = resp.status;
  if (e < 400) return undefined;
  if (e === 404) return hostCanonico ? 'apagado' : 'otro-host';
  if (e === 405) return 'metodo';
  const www = resp.headers.get('www-authenticate') || '';
  if (e === 401 && www) return /invalid_token/.test(www) ? 'token-invalido' : 'sin-token';
  const tipo = resp.headers.get('content-type') || '';
  if (!/json/i.test(tipo)) return 'http-' + e;
  try {
    const t = await resp.clone().text();
    const j = JSON.parse(t.slice(0, 4000));
    if (typeof j?.error === 'string' && /^[a-z_]{3,40}$/.test(j.error)) return j.error;
  } catch { /* sin código */ }
  return 'http-' + e;
}

/** La línea (objeto) de una petición ya contestada. `redirects` solo cuando el registro se rechazó. */
export function lineaDe({ req, ruta, estado, ms, motivo, redirects, omitidas }) {
  const origin = req.headers.get('origin');
  return {
    evento: 'mcp-peticion',
    ts: new Date().toISOString(),
    metodo: corto(req.method, 8),
    ruta: corto(ruta, 60),
    estado,
    ua: corto(req.headers.get('user-agent'), 60),
    origin: origin === null ? undefined : (PARECE_ORIGEN.test(origin) ? origin : '[raro]'),
    pais: corto(req.cf?.country || req.headers.get('cf-ipcountry'), 2) || undefined,
    ms,
    ...(motivo ? { motivo } : {}),
    ...(redirects?.length ? { redirects } : {}),
    ...(omitidas ? { omitidas } : {}),
  };
}

/** Las direcciones de vuelta de un registro (para ver cuál mandó el cliente cuando se rechaza). Lee un texto ya acotado; nada más del cuerpo se guarda. */
export function redirectsDeRegistro(texto) {
  try { const j = JSON.parse(String(texto).slice(0, 8000)); return Array.isArray(j?.redirect_uris) ? j.redirect_uris.slice(0, 5).map(direccionCorta) : []; } catch { return []; }
}

/** Lee como mucho `max` bytes del cuerpo de una copia de la petición (nunca el cuerpo entero) y la cierra. */
export async function leerAcotado(copia, max = 8000) {
  try {
    const lector = copia.body?.getReader(); if (!lector) return '';
    const partes = []; let n = 0;
    while (n < max) { const { done, value } = await lector.read(); if (done) break; partes.push(value); n += value.length; }
    try { await lector.cancel(); } catch { /* ya cerrado */ }
    const todo = new Uint8Array(Math.min(n, max)); let o = 0;
    for (const v of partes) { const t = v.subarray(0, todo.length - o); todo.set(t, o); o += t.length; if (o >= todo.length) break; }
    return new TextDecoder().decode(todo);
  } catch { return ''; }
}

/** Un tope para el ruido: de las peticiones de «otro host» (un escáner llamando a /mcp en workers.dev) se escriben como mucho `MAX_OTRO_HOST_POR_MINUTO` por minuto y por instancia;
 *  la siguiente línea que sí se escribe dice cuántas se omitieron. Lo demás (apagado, errores, lo bueno) se escribe siempre. El estado vive en el `env` de la instancia, no en el módulo. */
export const MAX_OTRO_HOST_POR_MINUTO = 5;
const ESTADO = new WeakMap();
export function admitirLinea(env, motivo, ms) {
  if (motivo !== 'otro-host' || !env || typeof env !== 'object') return { ok: true, omitidas: 0 };
  const ventana = Math.floor(ms / 60_000);
  let e = ESTADO.get(env);
  if (!e) { e = { ventana, n: 0, omitidas: 0 }; ESTADO.set(env, e); }
  if (e.ventana !== ventana) { e.ventana = ventana; e.n = 0; }
  if (e.n >= MAX_OTRO_HOST_POR_MINUTO) { e.omitidas++; return { ok: false, omitidas: 0 }; }
  e.n++;
  const omitidas = e.omitidas; e.omitidas = 0;
  return { ok: true, omitidas };
}

/** Escribe la línea. `env.MCP_BITACORA_SINK` (una función) solo la pone una prueba; sin ella, console.log. */
export function escribir(env, linea) {
  try { (typeof env?.MCP_BITACORA_SINK === 'function' ? env.MCP_BITACORA_SINK : console.log)(JSON.stringify(linea)); } catch { /* la bitácora nunca rompe la petición */ }
}
