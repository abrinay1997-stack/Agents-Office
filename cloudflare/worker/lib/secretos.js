// Que un secreto del Worker no salga NUNCA en un texto, aunque lo repita quien lo recibe (revisión transversal del 25 oct 2026).
// Un proveedor (o un conector MCP, o un proxy) a veces repite en su mensaje de error la cabecera o la dirección que recibió; ese mensaje se guardaba en D1 (ejecuciones, tareas, trabajos)
// y se devolvía a la página tal cual. Ahora los VALORES de los secretos que el Worker conoce, y lo que tiene forma de llave, se tapan en todo mensaje de error.
const VALORES = new Set();
const CLAVE_SECRETA = /(KEY|TOKEN|SECRET|PASSWORD)$|^MCP_/;
/** El Worker sabe sus secretos por `env`: se anotan una vez por petición (barato: son unos pocos). */
export function registrarSecretos(env) {
  if (!env || typeof env !== 'object') return;
  for (const [k, v] of Object.entries(env)) if (typeof v === 'string' && v.length >= 12 && CLAVE_SECRETA.test(k)) VALORES.add(v);
}
const FORMAS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/g,
  /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/g, // llaves de Anthropic, OpenAI…
  /\bEAA[A-Za-z0-9]{20,}/g, // token de Meta
  /\bAIza[0-9A-Za-z_-]{30,}/g, // llave de Google
  /\b\d{6,12}:[A-Za-z0-9_-]{30,}/g, // token de un bot de Telegram
];
/** → el texto con los secretos tapados («…»). Un valor que no es texto se devuelve igual. */
export function limpiarSecretos(texto) {
  if (typeof texto !== 'string' || !texto) return texto;
  let t = texto;
  for (const v of VALORES) if (t.includes(v)) t = t.split(v).join('«…»');
  for (const f of FORMAS) t = t.replace(f, (m) => (/^Bearer/.test(m) ? 'Bearer «…»' : '«…»'));
  return t;
}
export const _olvidarTodo = () => VALORES.clear(); // solo las pruebas
