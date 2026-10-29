// SEG-03 (fase 0a, 29 oct 2026): qué escrituras del servidor LOCAL se aceptan según quién las manda. Puro, para probarlo sin levantar el servidor.
// Un navegador siempre manda `Origin` en un POST/PATCH/PUT/DELETE y `Sec-Fetch-Site`; un proceso de esta máquina (MCP, scripts, Telegram, curl) no manda ninguno.
// · `Origin: null` (iframe con sandbox, redirecciones entre sitios, archivo local) NUNCA se acepta en una escritura.
// · Un `Origin` de otro host se rechaza; `Sec-Fetch-Site` distinto de same-origin/none también (otro puerto de localhost es «same-site», no «same-origin»).
// · Un cuerpo vacío ya no salta la comprobación del tipo: o es JSON, o viene de la propia página (mismo origen), o de un proceso sin cabeceras de navegador, o lleva la cabecera propia `X-AO-Local: 1`.
const JSON_RE = /^application\/json\b/i;
/** '' si se acepta; si no, el motivo ('origin' | 'content-type'). Solo para métodos que cambian algo (GET/HEAD se aceptan aparte). */
export function rechazoDeEscritura(h, host, metodo = 'POST') {
  const origin = h.origin, sitio = String(h['sec-fetch-site'] || '').toLowerCase();
  if (origin === 'null') return 'origin';
  if (origin) { try { if (new URL(origin).host.toLowerCase() !== String(host).toLowerCase()) return 'origin'; } catch { return 'origin'; } }
  if (sitio && sitio !== 'same-origin' && sitio !== 'none') return 'origin';
  if (metodo !== 'POST' && metodo !== 'PATCH') return ''; // PUT/DELETE: el tipo del cuerpo no se exigía y no se empieza ahora
  const tipoJson = JSON_RE.test(h['content-type'] || '');
  const vacio = h['content-length'] === '0';
  if (tipoJson) return '';
  return vacio ? '' : 'content-type'; // cuerpo vacío: ya no hay Origin null ni Sec-Fetch-Site ajeno (arriba), solo queda la propia página o un proceso de esta máquina
}
