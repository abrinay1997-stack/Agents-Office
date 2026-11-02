// Agents Office (2 nov 2026) — DE QUÉ CUENTA es cada comentario y cada mensaje de la Bandeja: la página de Facebook o el Instagram desde donde se
// lee y desde donde saldrá la respuesta. Pedido del dueño: con varias cuentas de marca no se sabía «como quién» se estaba respondiendo.
// Puro (sin DOM, sin red): lo usan la Bandeja de escritorio, la del teléfono y los tests. El servidor pone `deCuenta` en cada mensaje de Meta
// (contenido/bandeja.mjs); lo que llega de Metricool no la lleva (una sola marca) y se dice, no se inventa.
const RED = { facebook: 'Facebook', instagram: 'Instagram' };

/** La cuenta de un mensaje, o null (lo de Metricool). */
export const cuentaDeItem = m => (m && m.deCuenta && (m.deCuenta.id || m.deCuenta.porConfirmar) ? m.deCuenta : null);
/** «@pana.claw» o «PanaClaw»; si la oficina ya no la ve, «página 123» / «Instagram 456» (el id, no un nombre inventado). */
export function cuentaNombre(c) {
  if (!c) return '';
  if (c.porConfirmar) return 'cuenta por confirmar';
  if (c.usuario) return '@' + c.usuario;
  if (c.nombre) return c.nombre;
  const id = String(c.id || '').split(':')[1] || '';
  return c.red === 'facebook' ? `página ${id}` : `Instagram ${id}`;
}
/** «@pana.claw · Instagram» — lo que va en la fila y en el hilo. */
export const cuentaLinea = c => (!c ? '' : c.porConfirmar ? 'cuenta por confirmar' : `${cuentaNombre(c)} · ${RED[c.red] || c.red}`);
/**
 * ¿Se puede responder u ocultar? Con una cuenta desconocida (ya no la ve el token) o «por confirmar» (se guardó con la atribución vieja) NO: se
 * respondería desde la marca equivocada. → '' (sí) o la razón en palabras. El servidor también se niega (contenido/bandeja-meta.mjs → cuentaDelMensaje).
 */
export function bloqueoCuenta(m) {
  const c = m && m.deCuenta; if (!c || c.conocida !== false) return '';
  return c.porConfirmar ? 'No se sabe desde qué cuenta es este comentario (se guardó antes de que la oficina distinguiera las cuentas): pulsa «Traer lo nuevo» y se confirma solo.' : 'Meta ya no dice de qué cuenta es este mensaje (el token ya no la ve): abre Analíticas → «Comprobar conexión» y vuelve a traer lo nuevo.';
}
/** «@pana.claw en Instagram» (o '' si el mensaje no trae cuenta: lo de Metricool). */
export function comoCuenta(m) { const c = cuentaDeItem(m); return c && !c.porConfirmar && c.conocida !== false ?`${cuentaNombre(c)} en ${RED[c.red] || c.red}` : ''; }
/** La línea de quién responde: «Responder como @pana.claw en Instagram». Sin cuenta (Metricool), lo dice. */
export function responderComo(m) {
  const c = cuentaDeItem(m);
  if (!c) return m?.fuente === 'meta' ? 'Responder (no se sabe desde qué cuenta)' : 'Responder desde la cuenta de Metricool';
  return `Responder como ${cuentaNombre(c)} en ${RED[c.red] || c.red}`;
}
/** Las opciones del filtro por cuenta (solo si hay más de una con mensajes). → [[valor, texto]] */
export function opcionesCuentaBandeja(r) {
  const l = r?.cuentasBandeja || [];
  if (l.length < 2) return [];
  return [['', 'Todas las cuentas'], ...l.map(c => [c.id, `${cuentaLinea(c)}${c.pendientes ? ` (${c.pendientes} por responder)` : ''}`])];
}

/** La foto de una cuenta: solo https de los hosts de Meta (la nube los reescribe a /api/imagen-meta; la CSP no abre ninguno más). */
export function fotoMeta(u) {
  try { const x = new URL(String(u || '')); return x.protocol === 'https:' && x.href.length <= 600 && ['fbcdn.net', 'cdninstagram.com', 'fbsbx.com'].some(d => x.hostname === d || x.hostname.endsWith('.' + d)) ? x.href : ''; } catch { return ''; }
}
