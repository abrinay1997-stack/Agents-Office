// Identificadores y huellas. Todo sale de WebCrypto (Workers lo trae de serie y Node 22 también).
export const uuid = () => crypto.randomUUID();
export const ahora = () => new Date().toISOString();
export const enHoras = (h) => new Date(Date.now() + h * 3600_000).toISOString();

export function testigo(bytes = 24) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function sha256(texto) {
  const huella = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(huella)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Comparación en tiempo constante: un `===` se corta en el primer carácter distinto y esa diferencia se mide. */
export function igualSeguro(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
