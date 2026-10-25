// Cifrado de los tokens de conectores que se guardan DESDE la página (D1, columna `token_cifrado`). AES-GCM de 256 bits; la llave se DERIVA con HKDF-SHA256 de un secreto del
// Worker (`AO_CLAVE_CIFRADO`, 32 caracteres o más) y de un contexto fijo, así que D1 por sí sola (una copia, un volcado, un error de consulta) no sirve para leer ningún token.
//  · cada token lleva su IV aleatorio de 12 bytes y el NOMBRE del conector como dato autenticado: un token copiado a otra fila no se descifra;
//  · formato: `v1.<iv>.<texto cifrado>` en base64url;
//  · sin el secreto no se guarda nada (no hay un «cifrado de adorno»); si el secreto cambia, los tokens guardados dejan de abrirse y el conector pide el token otra vez.
// El texto en claro solo existe en memoria, dentro de una petición, y solo viaja en la cabecera hacia la dirección registrada del conector.
const SAL = new TextEncoder().encode('agents-office/conectores/v1');
const INFO = new TextEncoder().encode('token-de-conector');
export const MIN_SECRETO = 32;

const b64u = (b) => { let s = ''; for (const x of new Uint8Array(b)) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const deB64u = (t) => { const s = atob(String(t).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(t).length + 3) % 4)); const o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; };

export const hayClave = (env) => typeof env?.AO_CLAVE_CIFRADO === 'string' && env.AO_CLAVE_CIFRADO.length >= MIN_SECRETO;
export const SIN_CLAVE = 'Para guardar el token aquí, la oficina necesita el secreto AO_CLAVE_CIFRADO (32 caracteres o más al azar) en Cloudflare: guárdalo como secreto del repositorio en GitHub y vuelve a desplegar. Mientras tanto, usa un secreto del Worker (MCP_…).';

async function llave(env) {
  if (!hayClave(env)) throw Object.assign(new Error(SIN_CLAVE), { sinClave: true });
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.AO_CLAVE_CIFRADO), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: SAL, info: INFO }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** → `v1.<iv>.<cifrado>`. `contexto`: el nombre del conector. */
export async function cifrar(env, texto, contexto) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(String(contexto)) }, await llave(env), new TextEncoder().encode(String(texto)));
  return `v1.${b64u(iv)}.${b64u(c)}`;
}

/** → el texto, o null si no se puede abrir (otro secreto, otro conector, datos tocados). Nunca lanza por eso: el conector simplemente «pide el token». */
export async function descifrar(env, blob, contexto) {
  try {
    const m = /^v1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(blob || '')); if (!m) return null;
    const t = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64u(m[1]), additionalData: new TextEncoder().encode(String(contexto)) }, await llave(env), deB64u(m[2]));
    return new TextDecoder().decode(t);
  } catch { return null; }
}
