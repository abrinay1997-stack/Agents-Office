// C0 (chat interno del equipo): lo PURO. Nada de red, de D1 ni de archivos; lo usa el Worker (cloudflare/worker/lib/chat/) y los tests.
export const MAX_CUERPO = 4000, MAX_MENCIONES = 10, MAX_NOMBRE_CANAL = 40, VENTANA_EDICION_MS = 15 * 60_000, MAX_MENSAJES_POR_MINUTO = 30, PAGINA = 50, MAX_PAGINA = 100;
export const TIPOS = ['general', 'canal', 'directo', 'grupo', 'registro'];
/** @param {unknown} s */
const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Texto plano: sin controles (salvo el salto de línea), sin marcas de dirección bidi ni caracteres invisibles, con \n normalizado y recortado. @param {unknown} t */
export const limpiarCuerpo = (t) => String(t ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g, '').trim();

/** @param {unknown} t → { ok, cuerpo } | { ok:false, error } */
export function cuerpoValido(t) {
  const cuerpo = limpiarCuerpo(t);
  if (!cuerpo) return { ok: false, error: 'Escribe el mensaje.' };
  if (cuerpo.length > MAX_CUERPO) return { ok: false, error: `El mensaje pasa de ${MAX_CUERPO} letras (te sobran ${cuerpo.length - MAX_CUERPO}).` };
  return { ok: true, cuerpo };
}

/** Nombre de un canal: 2–40 letras, sin `<>`, `#`, `@`, barras ni controles. La clave (sin tildes ni mayúsculas) es única. @param {unknown} n */
export function nombreCanalValido(n) {
  const nombre = String(n ?? '').normalize('NFC').replace(/^#+/, '').replace(/\s+/g, ' ').trim();
  if (nombre.length < 2) return { ok: false, error: 'El canal necesita un nombre de al menos 2 letras.' };
  if (nombre.length > MAX_NOMBRE_CANAL) return { ok: false, error: `El nombre del canal pasa de ${MAX_NOMBRE_CANAL} letras.` };
  if (/[<>#@\\/:*?"|\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/.test(nombre)) return { ok: false, error: 'El nombre del canal no puede llevar < > # @ / \\ : * ? " | ni caracteres invisibles.' };
  return { ok: true, nombre, clave: sinTildes(nombre) };
}

/** La clave única de un directo: los dos ids ordenados. @param {string} a @param {string} b */
export const claveDirecto = (a, b) => [String(a), String(b)].sort().join('|');

/**
 * Las @menciones de un texto, VALIDADAS contra los miembros del canal: «@Ana» solo vale si hay un miembro cuyo nombre (sin tildes ni mayúsculas) es exactamente ese, y la palabra termina ahí.
 * Gana el nombre más largo. Como mucho MAX_MENCIONES; nunca al que escribe. @param {string} texto @param {{id:string,nombre:string}[]} miembros @param {string} [yo]
 */
export function leerMenciones(texto, miembros, yo = '') {
  let t = sinTildes(texto); const vistos = new Set(), orden = [...miembros].filter((m) => m.id !== yo && m.nombre).sort((a, b) => b.nombre.length - a.nombre.length);
  for (const m of orden) {
    const k = sinTildes(m.nombre).trim(); if (!k) continue;
    let desde = 0;
    for (;;) {
      const i = t.indexOf('@' + k, desde); if (i < 0) break;
      const fin = i + 1 + k.length, sig = t[fin], ant = t[i - 1];
      if ((!ant || /[\s(¿¡"'«]/.test(ant)) && (!sig || !/[\p{L}\p{N}_]/u.test(sig))) { vistos.add(m.id); t = t.slice(0, i) + ' '.repeat(k.length + 1) + t.slice(fin); break; } // el tramo se gasta: «@Dani María» no cuenta también como «@Dani»
      desde = i + 1;
    }
    if (vistos.size >= MAX_MENCIONES) break;
  }
  return [...vistos];
}

/** ¿Puede editarse este mensaje? Solo el autor, dentro de 15 minutos y si no está borrado. @param {{user_id:string|null, creado_at:number, borrado_at?:number|null}} m @param {string} yo @param {number} ahora */
export const puedeEditar = (m, yo, ahora) => m.user_id === yo && !m.borrado_at && ahora - m.creado_at <= VENTANA_EDICION_MS;

/** No leídos de un canal: mensajes de OTRA persona, sin lápida, con id > leidoHasta. @param {{id:number,user_id:string|null,borrado_at?:number|null}[]} mensajes */
export const noLeidos = (mensajes, leidoHasta, yo) => mensajes.filter((m) => m.id > leidoHasta && m.user_id !== yo && !m.borrado_at).length;

/** El título de una notificación de chat: SIN el texto del mensaje (una notificación sale de la oficina). */
export function tituloAviso({ de, canal, tipo, mencion }) {
  const d = String(de || 'Alguien').slice(0, 60), c = String(canal || '').slice(0, 40);
  if (tipo === 'directo') return `${d} te escribió`;
  return mencion ? `${d} te mencionó en #${c}` : `${d} escribió en #${c}`;
}

/** Cursor de página: `antes` (id) y `limite` acotados. */
export function pagina(antes, limite) {
  const a = Number.parseInt(String(antes), 10), l = Number.parseInt(String(limite), 10);
  return { antes: Number.isFinite(a) && a > 0 ? a : null, limite: Math.min(Math.max(Number.isFinite(l) ? l : PAGINA, 1), MAX_PAGINA) };
}
