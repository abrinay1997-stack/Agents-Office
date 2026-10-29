// @ts-check
// Agents Office (29 oct 2026) — Fase 11.1 (carril K): la ÚNICA puerta que decide si una imagen de la galería puede salir hacia un tercero
// (un modelo de visión). Puro: sin red ni disco. Lo usan la descripción de imágenes (descripcion-core.mjs) y, más adelante, la QA de series.
// Reglas (plan K §13.3): privacidad por carpeta; rostros solo con consentimiento registrado; NINGUNA visión a Meta Muse «Contributor»
// (entrena con lo que recibe). Quien llama deja la auditoría `envio-tercero` con lo que esta función contesta.

/** Destinos de visión que existen hoy. `meta-contributor` nunca recibe una imagen. */
export const DESTINOS = ['anthropic', 'google', 'meta', 'meta-contributor', 'compatible'];

/**
 * @param {{ ficha?: any, carpeta?: any, destino?: string }} p  ficha = la ficha de la galería (puede traer `privada`, `personas`, `consentimiento_rostros`);
 *   carpeta = la carpeta de esa ficha (puede traer `privada`).
 * @returns {{ ok: boolean, motivo?: string }}
 */
export function puedeEnviar({ ficha = {}, carpeta = null, destino = '' } = {}) {
  if (!DESTINOS.includes(destino)) return { ok: false, motivo: `el destino «${destino || 'sin nombre'}» no está declarado: no sale ninguna imagen` };
  if (destino === 'meta-contributor') return { ok: false, motivo: 'Meta Muse Contributor entrena con lo que recibe: a ese modelo no se le manda ninguna imagen' };
  if (carpeta && carpeta.privada === true) return { ok: false, motivo: 'la carpeta de esta imagen está marcada como privada' };
  if (ficha && ficha.privada === true) return { ok: false, motivo: 'esta imagen está marcada como privada' };
  const personas = Number(ficha && ficha.personas) || 0;
  if (personas > 0 && ficha.consentimiento_rostros !== true) return { ok: false, motivo: 'en la imagen hay personas y no hay un consentimiento registrado para mandarla fuera' };
  return { ok: true };
}

/** La línea de auditoría `envio-tercero` (sin la imagen ni su contenido). */
export const lineaAuditoria = (file, destino, por) => ({ kind: 'envio-tercero', file: String(file || '').slice(0, 300), destino, por: por || 'dimitri' });

/**
 * A dónde va de verdad una imagen según el proveedor del modelo de esta oficina (serve.mjs → PROVIDER). Nunca se asume Anthropic.
 * Meta cuenta como «Contributor» (no recibe nada) salvo que el modelo configurado diga otra cosa; un proveedor compatible (DeepSeek, Kimi…) es «compatible».
 * @param {{ id?: string, model?: string }} provider
 */
export function destinoDeProveedor(provider = {}) {
  const id = String(provider.id || ''), modelo = String(provider.model || '');
  if (id === 'anthropic') return 'anthropic';
  if (id === 'meta') return /contributor/i.test(modelo) || !modelo ? 'meta-contributor' : 'meta';
  return 'compatible';
}
