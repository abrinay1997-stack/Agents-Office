// Conectores MCP remotos: el reemplazo en la nube de «los MCP de mi Claude Code local».
//
// El TOKEN de un conector NUNCA se guarda en D1 ni en un archivo ni viaja a la página: vive como secreto del Worker
// (`wrangler secret put`, que el workflow de despliegue sube desde los secretos de GitHub). La tabla `conectores` solo
// guarda el NOMBRE de ese secreto (`secreto`), y el Worker lo lee de `env[secreto]` al llamar.
//
// Las reglas de envío de la oficina se mantienen: una herramienta solo entra en `herramientas_lectura` si safety.kindOf
// dice que lee (o es un borrador); las de `herramientas_envio` solo se habilitan en una ejecución APROBADA por un admin.
import { kindOf } from '../../../safety.mjs';
import { PLANTILLAS, iconoUri } from './iconos-conectores.js';

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

const PUERTOS_INTERNOS = new Set([21, 22, 23, 25, 53, 110, 111, 135, 139, 143, 389, 445, 465, 587, 993, 995, 1433, 1521, 2375, 2376, 3306, 3389, 5432, 5900, 6379, 9200, 11211, 27017]);
/** Una URL pública https. Nada de localhost, redes privadas ni direcciones IP sueltas (un conector no es un túnel interno). */
export function urlPermitida(texto) {
  let u;
  try { u = new URL(String(texto)); } catch { return 'la dirección no es válida'; }
  if (u.protocol !== 'https:') return 'debe ser https';
  if (u.username || u.password) return 'no puede llevar usuario ni contraseña en la dirección';
  const h = u.hostname.toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || /\.(localhost|local|internal|lan|intranet|corp|home|private|localdomain)$/.test(h) || h.endsWith('.home.arpa')) return 'no puede ser una dirección local';
  if (u.port && PUERTOS_INTERNOS.has(Number(u.port))) return `no puede apuntar al puerto ${u.port} (es de un servicio interno)`;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':') || /^\[/.test(h)) return 'debe ser un nombre de dominio, no una dirección IP';
  if (!h.includes('.')) return 'debe ser un dominio completo';
  return null;
}

export const MAX_DOMINIOS = 20;
/** Sufijos públicos donde cualquiera puede publicar o subir contenido: permitirlos entera abre la exfiltración por la dirección. Lista corta a propósito, no es la lista completa de sufijos públicos. */
const SUFIJOS_AMPLIOS = ['github.io', 'githubusercontent.com', 'vercel.app', 'netlify.app', 'pages.dev', 'workers.dev', 'herokuapp.com', 's3.amazonaws.com', 'amazonaws.com', 'cloudfront.net', 'blogspot.com', 'wordpress.com', 'appspot.com', 'web.app', 'firebaseapp.com', 'azurewebsites.net', 'ngrok.io', 'ngrok-free.app', 'trycloudflare.com', 'glitch.me', 'repl.co', 'onrender.com', 'fly.dev', 'surge.sh', 'weebly.com', 'wixsite.com', 'co.uk', 'com.pa', 'com.mx', 'com.br', 'com.ar', 'com.co', 'co.jp', 'com.au', 'org.uk', 'gob.pa', 'edu.pa'];
const esAmplio = (base) => SUFIJOS_AMPLIOS.includes(base);
/** SEG-02: «Dominios que puede consultar» de un conector. Una lista de hosts (`ejemplo.com`, que cubre sus subdominios, o `*.ejemplo.com`): sin esquema, sin ruta, sin puerto, sin `*` suelto,
 *  sin IPs ni nombres locales, ≤ 20. Acepta un arreglo o texto (uno por línea). → { ok, lista } o { ok: false, errores }. Solo la edita un administrador (POST /api/conectores). */
export function validarDominios(entrada) {
  const crudo = Array.isArray(entrada) ? entrada : String(entrada ?? '').split(/[\n,;]+/);
  const errores = [], lista = [];
  for (const x of crudo) {
    const t = String(x ?? '').trim().toLowerCase(); if (!t) continue;
    const base = t.startsWith('*.') ? t.slice(2) : t;
    if (/^[a-z][a-z0-9+.-]*:\/\//.test(t) || /[/?#@:\s\\]/.test(t)) errores.push(`«${t.slice(0, 40)}»: solo el dominio, sin https://, ruta, puerto ni espacios.`);
    else if (t === '*' || base.includes('*') || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(base)) errores.push(`«${t.slice(0, 40)}»: no es un dominio válido (por ejemplo ejemplo.com o *.ejemplo.com).`);
    else if (esAmplio(base)) errores.push(`«${t.slice(0, 40)}»: es un dominio público donde cualquiera puede publicar contenido (permitirlo entero deja sacar datos por la dirección). Pon un dominio propio o de confianza, por ejemplo docs.tuempresa.com.`);
    else { const m = urlPermitida('https://' + base + '/'); if (m) errores.push(`«${t.slice(0, 40)}»: ${m}.`); else if (!lista.includes(t)) lista.push(t); }
  }
  if (lista.length > MAX_DOMINIOS) errores.push(`Como mucho ${MAX_DOMINIOS} dominios por conector.`);
  return errores.length ? { ok: false, errores } : { ok: true, lista };
}
/** Los dominios guardados de una fila (JSON en `dominios_permitidos`); lo roto o ausente = ninguno (como siempre). */
export function dominiosDe(fila) { try { const v = JSON.parse(fila?.dominios_permitidos || '[]'); if (!Array.isArray(v)) return []; return v.filter((x) => typeof x === 'string' && validarDominios([x]).ok && x === x.trim().toLowerCase()).slice(0, MAX_DOMINIOS); } catch { return []; } } // se revalida al leer: una fila escrita por otra vía (migración, SQL a mano) no puede meter `*`, rutas ni dominios amplios
/** → { servidor: [hosts] } de las filas que tienen lista: lo que recibe el guardián como `ctx.dominios`. */
export const dominiosPorServidor = (filas) => Object.fromEntries((filas || []).map((c) => [c.nombre, dominiosDe(c)]).filter(([, l]) => l.length));

const lista = (v) => (Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim()).filter(Boolean))] : []);

const AUTENTICACIONES = ['ninguna', 'bearer', 'cabecera'];
/** Cabeceras que un conector NO puede fijar: las del transporte, las de sesión del navegador y las que el propio protocolo MCP ya usa. */
const CABECERA_PROHIBIDA = /^(host|content-length|content-type|accept|accept-encoding|accept-language|connection|cookie|set-cookie|origin|referer|user-agent|transfer-encoding|upgrade|te|trailer|expect|forwarded|authorization|proxy-.*|sec-.*|mcp-.*|cf-.*|x-forwarded-.*|x-real-ip|x-pestana)$/i;
const NOMBRE_CABECERA = /^[A-Za-z][A-Za-z0-9-]{0,39}$/;
export const TOKEN_VALIDO = /^[\x21-\x7E]{8,2000}$/; // sin espacios ni saltos de línea (una cabecera): un token pegado con un salto de línea se rechaza, no se «arregla»

/** Una URL sin lo que parezca un secreto metido en la ruta (Zapier y otros ponen su token ahí): se enseña así en pantalla; la entera solo la usa el Worker al llamar. */
export function urlVisible(u) {
  try { const x = new URL(u); return x.origin + x.pathname.split('/').map((seg) => (/^[A-Za-z0-9_~.-]{20,}$/.test(seg) ? '…' : seg)).join('/') + (x.search ? '?…' : ''); } catch { return ''; }
}

/** Valida lo que manda la página. Devuelve { ok, valor, token? } o { ok: false, errores }. El `token` (si viene) va APARTE de `valor`: nunca se guarda en claro, ni se registra, ni vuelve. */
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
  const auth = e.auth_tipo == null || e.auth_tipo === '' ? undefined : String(e.auth_tipo);
  if (auth !== undefined && !AUTENTICACIONES.includes(auth)) errores.push('La autenticación es «ninguna», «bearer» o «cabecera».');
  const cabecera = e.cabecera == null || e.cabecera === '' ? null : String(e.cabecera).trim();
  if (auth === 'cabecera') {
    if (!cabecera || !NOMBRE_CABECERA.test(cabecera)) errores.push('El nombre de la cabecera: letras, números y guiones (por ejemplo X-API-Key).');
    else if (CABECERA_PROHIBIDA.test(cabecera)) errores.push(cabecera.toLowerCase() === 'authorization' ? 'Para la cabecera Authorization elige «Bearer»: la oficina pone «Bearer » delante.' : `La cabecera «${cabecera}» no se puede usar: es del transporte o de la sesión.`);
  }
  let token;
  if (e.token !== undefined && e.token !== null && e.token !== '') {
    token = String(e.token);
    if (!TOKEN_VALIDO.test(token)) errores.push('El token no es válido: de 8 a 2.000 caracteres, sin espacios ni saltos de línea (pégalo solo, sin la palabra «Bearer»).');
    if (/^bearer\s/i.test(token)) errores.push('Pega solo el token, sin la palabra «Bearer»: la oficina la pone.');
  }
  if (auth === 'ninguna' && (secreto || token)) errores.push('«Sin autenticación» no lleva token ni secreto.');
  if (secreto && token) errores.push('Elige uno: el token guardado aquí (cifrado) o un secreto del Worker, no los dos.');
  const plantilla = e.plantilla == null || e.plantilla === '' ? null : String(e.plantilla);
  if (plantilla && !PLANTILLAS.some((p) => p.id === plantilla)) errores.push('Plantilla desconocida.');
  const etiqueta = e.etiqueta == null ? '' : String(e.etiqueta).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 60);
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
  let dominios;
  if (e.dominios_permitidos !== undefined) { const r = validarDominios(e.dominios_permitidos); if (r.ok) dominios = r.lista; else errores.push(...r.errores); }
  if (errores.length) return { ok: false, errores };
  return { ok: true, token, valor: { ...(dominios !== undefined ? { dominios_permitidos: dominios } : {}), nombre, url: new URL(e.url).toString(), secreto, departamentos, herramientas_lectura: lectura, herramientas_envio: envio,
    auth_tipo: auth ?? (secreto || token ? 'bearer' : 'ninguna'), cabecera: auth === 'cabecera' ? cabecera : null, plantilla, etiqueta } };
}

/** ¿Tiene el conector con qué presentarse? (sin descifrar nada: solo si hay un secreto del Worker con valor o un token guardado) */
export function tieneAcceso(fila, env) {
  if (fila.auth_tipo === 'ninguna') return true;
  if (fila.secreto) return secretoPermitido(fila.secreto) && typeof env?.[fila.secreto] === 'string' && env[fila.secreto].length > 0;
  if (fila.token_cifrado) return true;
  return !fila.auth_tipo; // un conector de antes, sin secreto: no pedía nada
}

/** Lo que la API enseña de un conector: nunca el token ni la dirección entera si lleva algo que parezca un secreto, solo SI el token está puesto y de dónde viene. */
export function publico(fila, env) {
  return {
    id: fila.id, nombre: fila.nombre, etiqueta: fila.etiqueta || '', url: urlVisible(fila.url), secreto: fila.secreto,
    auth_tipo: fila.auth_tipo || (fila.secreto ? 'bearer' : 'ninguna'), cabecera: fila.cabecera || null, plantilla: fila.plantilla || null,
    tokenGuardado: !!fila.token_cifrado, tokenPuesto: tieneAcceso(fila, env),
    iconUri: iconoUri({ plantilla: fila.plantilla, nombre: fila.etiqueta || fila.nombre }),
    ...(fila.secreto && !secretoPermitido(fila.secreto) ? { secretoInvalido: AVISO_SECRETO(fila.secreto) } : {}),
    departamentos: JSON.parse(fila.departamentos || '[]'),
    herramientas_lectura: JSON.parse(fila.herramientas_lectura || '[]'),
    herramientas_envio: JSON.parse(fila.herramientas_envio || '[]'),
    dominios_permitidos: dominiosDe(fila),
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
  if (fila.auth_tipo === 'cabecera') return null; // el conector MCP de la API de Anthropic solo sabe Bearer: una cabecera propia solo la usa el cliente del Worker (con el guardián)
  const token = fila.secreto ? env[fila.secreto] : fila._token;
  if (!fila.secreto && fila.auth_tipo && fila.auth_tipo !== 'ninguna' && !token) return null;
  const servidor = { type: 'url', url: fila.url, name: fila.nombre };
  if (token) servidor.authorization_token = token;
  const toolset = {
    type: 'mcp_toolset', mcp_server_name: fila.nombre,
    default_config: { enabled: false },
    configs: Object.fromEntries(permitidas.map((t) => [t, { enabled: true }])),
  };
  return { servidor, toolset };
}
