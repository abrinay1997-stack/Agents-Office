// Conectores MCP remotos: el reemplazo en la nube de «los MCP de mi Claude Code local».
//
// El TOKEN de un conector NUNCA se guarda en D1 ni en un archivo ni viaja a la página: vive como secreto del Worker
// (`wrangler secret put`, que el workflow de despliegue sube desde los secretos de GitHub). La tabla `conectores` solo
// guarda el NOMBRE de ese secreto (`secreto`), y el Worker lo lee de `env[secreto]` al llamar.
//
// Las reglas de envío de la oficina se mantienen: una herramienta solo entra en `herramientas_lectura` si safety.kindOf
// dice que lee (o es un borrador); las de `herramientas_envio` solo se habilitan en una ejecución APROBADA por un admin.
import { kindOf } from '../../../safety.mjs';

/** Secretos que jamás pueden usarse como token de un conector: mandarlos a la URL de un tercero los regalaría. */
const SECRETOS_PROPIOS = /^(ADMIN_|CLOUDFLARE_|ANTHROPIC_API_KEY$|META_API_KEY$|MODEL_API_KEY$|META_APP_SECRET$|AO_)/;
const NOMBRE_SECRETO = /^[A-Z][A-Z0-9_]{2,63}$/;
/** LISTA BLANCA: el token de un conector es siempre un secreto que se llama MCP_<ALGO>. Una lista negra de «lo que no» (ANTHROPIC_API_KEY, ADMIN_…) deja pasar el secreto de mañana
 *  (un `GITHUB_TOKEN`, un `STRIPE_KEY`…): quien registra un conector podría mandarlo a SU servidor. Solo `MCP_*` puede salir hacia un conector. */
export const SECRETO_CONECTOR = /^MCP_[A-Z0-9_]{2,60}$/;
export const secretoPermitido = (nombre) => typeof nombre === 'string' && SECRETO_CONECTOR.test(nombre);
export const AVISO_SECRETO = (n) => `El secreto «${n}» no sirve para un conector: debe llamarse MCP_ seguido de MAYÚSCULAS y guiones bajos (por ejemplo MCP_GMAIL_TOKEN). Renómbralo en el conector y guarda el token con ese nombre en GitHub.`;
const NOMBRE_CONECTOR = /^[a-z][a-z0-9-]{1,39}$/;
const DEPARTAMENTOS = ['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery'];

/** Una URL pública https. Nada de localhost, redes privadas ni direcciones IP sueltas (un conector no es un túnel interno). */
export function urlPermitida(texto) {
  let u;
  try { u = new URL(String(texto)); } catch { return 'la dirección no es válida'; }
  if (u.protocol !== 'https:') return 'debe ser https';
  if (u.username || u.password) return 'no puede llevar usuario ni contraseña en la dirección';
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return 'no puede ser una dirección local';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':') || /^\[/.test(h)) return 'debe ser un nombre de dominio, no una dirección IP';
  if (!h.includes('.')) return 'debe ser un dominio completo';
  return null;
}

const lista = (v) => (Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim()).filter(Boolean))] : []);

/** Valida lo que manda la página. Devuelve { ok, valor } o { ok: false, errores }. */
export function validarConector(entrada) {
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const errores = [];
  const nombre = String(e.nombre ?? '').trim().toLowerCase();
  if (!NOMBRE_CONECTOR.test(nombre)) errores.push('El nombre: minúsculas, números y guiones (2 a 40), empieza por letra.');
  const motivoUrl = urlPermitida(e.url);
  if (motivoUrl) errores.push(`La dirección ${motivoUrl}.`);
  const secreto = e.secreto == null || e.secreto === '' ? null : String(e.secreto).trim();
  if (secreto && !NOMBRE_SECRETO.test(secreto)) errores.push('El secreto es el NOMBRE de una variable (MAYÚSCULAS_Y_GUIONES_BAJOS), nunca el token.');
  if (secreto && NOMBRE_SECRETO.test(secreto) && !SECRETO_CONECTOR.test(secreto) && !SECRETOS_PROPIOS.test(secreto)) errores.push(AVISO_SECRETO(secreto));
  if (secreto && SECRETOS_PROPIOS.test(secreto)) errores.push(`«${secreto}» es un secreto de la oficina: no puede usarse como token de un conector.`);
  const departamentos = lista(e.departamentos);
  for (const d of departamentos) if (!DEPARTAMENTOS.includes(d)) errores.push(`Departamento desconocido: ${d}.`);
  const lectura = lista(e.herramientas_lectura);
  const envio = lista(e.herramientas_envio);
  for (const t of [...lectura, ...envio]) if (!/^[A-Za-z0-9_.:-]{1,100}$/.test(t)) errores.push(`Nombre de herramienta no válido: ${t.slice(0, 40)}.`);
  // Una herramienta de lectura tiene que LEER: en la duda envía (safety.kindOf), así que una que no se reconoce no entra aquí.
  // kindOf entiende el nombre completo `mcp__<servidor>__<herramienta>`; un nombre de servidor interno de la oficina (estudio, tareas…)
  // haría que todo contara como lectura, así que ese nombre no puede usarse para un conector.
  if (NOMBRE_CONECTOR.test(nombre) && kindOf(`mcp__${nombre}__send_message`) !== 'write') errores.push(`«${nombre}» es un nombre reservado de la oficina.`);
  for (const t of lectura) if (kindOf(`mcp__${nombre}__${t}`) !== 'read') errores.push(`«${t}» no parece de solo lectura: ponla en «envío» (solo corre en ejecuciones aprobadas).`);
  if (errores.length) return { ok: false, errores };
  return { ok: true, valor: { nombre, url: new URL(e.url).toString(), secreto, departamentos, herramientas_lectura: lectura, herramientas_envio: envio } };
}

/** Lo que la API enseña de un conector: nunca el token, solo SI está puesto. */
export function publico(fila, env) {
  return {
    id: fila.id, nombre: fila.nombre, url: fila.url, secreto: fila.secreto,
    tokenPuesto: !fila.secreto || (secretoPermitido(fila.secreto) && typeof env?.[fila.secreto] === 'string' && env[fila.secreto].length > 0),
    ...(fila.secreto && !secretoPermitido(fila.secreto) ? { secretoInvalido: AVISO_SECRETO(fila.secreto) } : {}),
    departamentos: JSON.parse(fila.departamentos || '[]'),
    herramientas_lectura: JSON.parse(fila.herramientas_lectura || '[]'),
    herramientas_envio: JSON.parse(fila.herramientas_envio || '[]'),
    activo: !!fila.activo,
  };
}

/**
 * Lo que pide la Messages API de Anthropic (conector MCP, beta mcp-client-2025-11-20) para un conector:
 * el servidor con su token y un toolset que tiene TODO apagado salvo la lista permitida.
 * `aprobada` suma las herramientas de envío. Sin ninguna herramienta permitida, el conector no se manda.
 */
export function paraAnthropic(fila, env, { aprobada = false } = {}) {
  const lectura = JSON.parse(fila.herramientas_lectura || '[]');
  const envio = aprobada ? JSON.parse(fila.herramientas_envio || '[]') : [];
  const permitidas = [...new Set([...lectura, ...envio])];
  if (!fila.activo || !permitidas.length) return null;
  if (fila.secreto && (!secretoPermitido(fila.secreto) || !env?.[fila.secreto])) return null; // sin token no se llama: el agente lo sabrá por la nota de la ejecución
  const servidor = { type: 'url', url: fila.url, name: fila.nombre };
  if (fila.secreto) servidor.authorization_token = env[fila.secreto];
  const toolset = {
    type: 'mcp_toolset', mcp_server_name: fila.nombre,
    default_config: { enabled: false },
    configs: Object.fromEntries(permitidas.map((t) => [t, { enabled: true }])),
  };
  return { servidor, toolset };
}
