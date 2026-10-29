// @ts-check
// Escribir en el Cerebro (27 oct 2026) — lo PURO de crear, editar y añadir a una nota; lo comparten la oficina local (serve.mjs: archivos .md) y la nube (D1). Pedido del dueño:
// «no puedo eliminar notas que yo he creado, no puedo editarlas, tengo que subir un documento… quisiera escribirlas, o pedirle a Dimitri que añada información a una nota».
// Nada de red ni de archivos aquí.

export const MAX_NOTA = 200000;   // lo mismo que /api/note: más largo se corta al leer, y aquí no se deja escribir
export const MAX_NOMBRE = 80;
export const GRUPO_NUEVAS = 'Notas';   // la carpeta (el «lóbulo» del Cerebro) donde nacen las notas que se escriben a mano

const PROHIBIDO = /[\\/:*?"<>|#^[\]\u0000-\u001f]/;

/** El nombre de una nota: sin saltos, ni barras, ni los caracteres de un [[enlace]]; 1 a 80 letras. → { ok, nombre } | { ok: false, error } */
export function nombreValido(n) {
  const nombre = String(n ?? '').replace(/\s+/g, ' ').trim();
  if (!nombre) return { ok: false, error: 'La nota necesita un nombre.' };
  if (nombre.length > MAX_NOMBRE) return { ok: false, error: `El nombre es muy largo (máximo ${MAX_NOMBRE} letras).` };
  if (PROHIBIDO.test(nombre)) return { ok: false, error: 'El nombre no puede llevar \\ / : * ? " < > | # ^ [ ] (rompen los enlaces y las carpetas).' };
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(nombre.split('.')[0].trim())) return { ok: false, error: 'Ese nombre está reservado por Windows (CON, PRN, AUX, NUL, COM1…): elige otro.' };
  if (nombre.startsWith('.') || nombre.endsWith('.') || /^\.+$/.test(nombre)) return { ok: false, error: 'El nombre no puede empezar ni terminar con un punto.' };
  return { ok: true, nombre };
}

/** La carpeta de una nota nueva: una sola, sin barras. Vacía → «Notas». */
export function grupoValido(g) {
  const grupo = String(g ?? '').replace(/\s+/g, ' ').trim() || GRUPO_NUEVAS;
  if (grupo.length > 60 || PROHIBIDO.test(grupo) || grupo.startsWith('.')) return { ok: false, error: 'El nombre de la carpeta no es válido (sin barras ni puntos al principio, hasta 60 letras).' };
  return { ok: true, grupo };
}

export function textoValido(t, { vacio = true } = {}) {
  const texto = String(t ?? '').replace(/\r\n/g, '\n');
  if (!vacio && !texto.trim()) return { ok: false, error: 'La nota no puede quedar vacía.' };
  if (texto.length > MAX_NOTA) return { ok: false, error: `La nota es demasiado larga (máximo ${MAX_NOTA.toLocaleString('es')} letras).` };
  if (texto.includes('\u0000')) return { ok: false, error: 'La nota trae caracteres que no son texto.' };
  return { ok: true, texto };
}

/**
 * Añade `nuevo` al final de la nota, o al final de la sección `seccion` (un título que ya existe; si no existe, se crea al final). Nunca toca lo que ya decía.
 * Respeta la cabecera YAML (--- … ---) y no cuenta como títulos las líneas de un bloque de código. → el texto nuevo.
 */
export function agregarTexto(texto, nuevo, { seccion = '' } = {}) {
  const base = String(texto ?? '').replace(/\r\n/g, '\n').replace(/\s+$/, ''), add = String(nuevo ?? '').replace(/\r\n/g, '\n').trim();
  if (!add) return base ? base + '\n' : '';
  const sec = String(seccion ?? '').replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim();
  if (!sec) return `${base}${base ? '\n\n' : ''}${add}\n`;
  const lineas = base.split('\n'), plano = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  let i0 = 0;
  if (lineas[0] === '---') { const c = lineas.findIndex((l, k) => k > 0 && l === '---'); if (c > 0) i0 = c + 1; } // la cabecera no tiene títulos
  let en = false, at = -1, nivel = 0, fin = lineas.length;
  const titulo = (l) => { const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l); return m ? { n: m[1].length, t: m[2] } : null; };
  for (let k = i0; k < lineas.length; k++) {
    if (/^\s*(```|~~~)/.test(lineas[k])) { en = !en; continue; }
    if (en) continue;
    const h = titulo(lineas[k]); if (!h) continue;
    if (at < 0) { if (plano(h.t) === plano(sec)) { at = k; nivel = h.n; } } else if (h.n <= nivel) { fin = k; break; }
  }
  if (at < 0) return `${base}${base ? '\n\n' : ''}## ${sec}\n\n${add}\n`;
  const antes = lineas.slice(0, fin), despues = lineas.slice(fin);
  while (antes.length && antes[antes.length - 1].trim() === '') antes.pop();
  return [...antes, '', add, ...(despues.length ? ['', ...despues] : [])].join('\n').replace(/\n*$/, '\n');
}

/** ¿Es una nota «de fábrica» que casi nadie querría tirar sin pensarlo? Solo para el aviso del botón: se puede mandar a la papelera igual (vuelve en 30 días). */
export const NOTAS_CLAVE = ['CLAUDE', 'index', 'business-model', 'voice', 'contexto-marketing'];
export const esClave = (nombre) => NOTAS_CLAVE.includes(String(nombre));

/**
 * Lo contrario de agregarTexto, para el DESHACER de Dimitri: quita `nuevo` (la última vez que sale) y el título de sección que el añadido creó, si quedó vacío.
 * Si lo añadido ya no está tal cual (la nota se editó después), no toca nada. → { ok: true, texto } | { ok: false }
 */
export function quitarTexto(texto, nuevo, { seccion = '', seccionCreada = false } = {}) {
  const t = String(texto ?? '').replace(/\r\n/g, '\n'), add = String(nuevo ?? '').replace(/\r\n/g, '\n').trim();
  const i = add ? t.lastIndexOf(add) : -1;
  if (i < 0) return { ok: false };
  let antes = t.slice(0, i).replace(/\s+$/, ''), despues = t.slice(i + add.length).replace(/^\s+/, '');
  const sec = String(seccion ?? '').replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim();
  if (seccionCreada && sec && !despues) { const m = /(?:^|\n)(#{1,6})\s+(.*?)\s*#*\s*$/.exec(antes); if (m && m[2].replace(/\s+/g, ' ').trim().toLowerCase() === sec.toLowerCase()) antes = antes.slice(0, antes.length - m[0].length).replace(/\s+$/, ''); }
  return { ok: true, texto: [antes, despues].filter(Boolean).join('\n\n').replace(/\n*$/, '\n') };
}

/** ¿La nota ya tiene un título con ese nombre? (para saber si añadir lo CREA, y entonces el DESHACER lo quita también). */
export function tieneSeccion(texto, seccion) {
  const sec = String(seccion ?? '').replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!sec) return true;
  let en = false;
  for (const l of String(texto ?? '').replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(l)) { en = !en; continue; }
    const m = !en && /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(l);
    if (m && m[1].replace(/\s+/g, ' ').trim().toLowerCase() === sec) return true;
  }
  return false;
}
