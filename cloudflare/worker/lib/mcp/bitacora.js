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
export function lineaDe({ req, ruta, estado, ms, motivo, redirects }) {
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
  };
}

/** Las direcciones de vuelta de un registro (para ver cuál mandó el cliente cuando se rechaza). Lee un texto ya acotado; nada más del cuerpo se guarda. */
export function redirectsDeRegistro(texto) {
  try { const j = JSON.parse(String(texto).slice(0, 8000)); return Array.isArray(j?.redirect_uris) ? j.redirect_uris.slice(0, 5).map(direccionCorta) : []; } catch { return []; }
}

/** Escribe la línea. `env.MCP_BITACORA_SINK` (una función) solo la pone una prueba; sin ella, console.log. */
export function escribir(env, linea) {
  try { (typeof env?.MCP_BITACORA_SINK === 'function' ? env.MCP_BITACORA_SINK : console.log)(JSON.stringify(linea)); } catch { /* la bitácora nunca rompe la petición */ }
}
