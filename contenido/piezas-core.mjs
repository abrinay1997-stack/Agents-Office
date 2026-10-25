// Agents Office — el NÚCLEO PURO de las piezas de contenido (sin disco): la nota ⇄ la pieza, la huella de lo aprobado y la limpieza de lo que llega.
// Salió de contenido/piezas.mjs (que lo re-exporta tal cual) para que el Worker de Cloudflare (cloudflare/worker/lib/contenido/) use EXACTAMENTE
// las mismas reglas que la oficina local. Aquí no hay `fs`: solo texto, fechas y un hash. Lo prueban tests/contenido-piezas.test.mjs y
// cloudflare/tests/contenido-piezas.test.mjs.
import { createHash } from 'node:crypto';
import { normalizarFormatos, formatoDe } from '../src/contenido-reglas.js';
import { limpiarCuentas, cuentasLimpias, cuentasDeRedes } from '../src/contenido-cuentas.js'; // 9 oct 2026: la cuenta de cada red (qué página, qué Instagram)
const base = (f, ext = '') => { const n = String(f || '').split(/[\\/]/).pop(); return ext && n.endsWith(ext) ? n.slice(0, -ext.length) : n; };
export const ESTADOS = ['idea', 'borrador', 'revision', 'aprobada']; // los que se deciden aquí; «en Meta», «publicada» y «falló» son de la cola (F3)
export const FORMATOS = ['post', 'reel', 'carrusel', 'historia'];
export const REDES = ['instagram', 'facebook', 'linkedin', 'x', 'threads', 'bluesky', 'tiktok', 'pinterest', 'youtube']; // M2 (6 oct 2026): las nueve que publica Metricool
/** El nombre de cada red, como sale en la sección «## Texto de <Red>» de la nota. */
export const NOMBRE_RED = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X', threads: 'Threads', bluesky: 'Bluesky', tiktok: 'TikTok', pinterest: 'Pinterest', youtube: 'YouTube' };
const CON_TEXTO_PROPIO = REDES.filter(r => r !== 'instagram' && r !== 'facebook'); // Instagram lleva el texto principal; Facebook, «Texto de Facebook»
// las opciones de una red, en la cabecera como un objeto en una línea: qué campos admite cada una y su largo máximo
const OPCIONES = { pinterest: { tablero: 80, titulo: 100, enlace: 500 }, youtube: { titulo: 100, privacidad: 10, paraNinos: 0 }, tiktok: { titulo: 90, privacidad: 30 } };
const PRIVACIDAD = { youtube: ['public', 'unlisted', 'private'], tiktok: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'] };
export const ID_RE = /^p-\d{8}-[a-f0-9]{4,8}$/;
export const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/, HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const SIN_FECHA = 'sin-fecha';
export const existe = f => { const [y, m, d] = f.split('-').map(Number), x = new Date(y, m - 1, d); return x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d; }; // «31 de febrero» no rueda a marzo: no existe
// los campos que definen LO QUE SALE: si cambian tras aprobarla, el OK ya no vale (lo aprobado es este texto, esta hora, estos archivos)
const PUBLICABLES = ['fecha', 'hora', 'formato', 'redes', 'medios', 'texto', 'hashtags', 'hashtagsEnComentario', 'comentario', 'textoFacebook', 'historias', 'historiaTambien'];
// M2: también lo que sale en las redes nuevas. Va APARTE y solo si tiene algo: así la huella de lo aprobado antes de M2 no cambia
const PUBLICABLES_M2 = ['textos', 'pinterest', 'youtube', 'tiktok', 'formatos']; // C1 (8 oct 2026): `formatos`, el formato de cada red que sale distinto

/* ---------- la cabecera: un YAML mínimo (cadenas, números, booleanos, listas, un objeto en una línea) ---------- */
const BARE = /^[\p{L}\p{N}][\p{L}\p{N} ._/()\-áéíóúñÁÉÍÓÚÑ]*$/u;
const bare = s => BARE.test(s) && s === s.trim() && !/^(null|true|false|~)$/i.test(s) && !/^-?\d+(\.\d+)?$/.test(s);
const scalar = v => v === null || v === undefined ? 'null' : typeof v === 'boolean' || typeof v === 'number' ? String(v) : bare(String(v)) ? String(v) : JSON.stringify(String(v));
function readScalar(t) {
  t = t.trim();
  if (t === '' || t === 'null' || t === '~') return null;
  if (t === 'true') return true; if (t === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t[0] === '"') { try { return JSON.parse(t); } catch { return t.slice(1, -1); } }
  if (t[0] === '{') { try { return JSON.parse(t); } catch { return t; } }
  if (t[0] === '[' && t.at(-1) === ']') { const inner = t.slice(1, -1).trim(); return inner ? splitList(inner).map(readScalar) : []; }
  return t;
}
function splitList(s) { // «a, "b, c", d»: las comas dentro de comillas no separan
  const out = []; let cur = '', q = false;
  for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '"' && s[i - 1] !== '\\') q = !q; if (c === ',' && !q) { out.push(cur); cur = ''; } else cur += c; }
  out.push(cur); return out.map(x => x.trim()).filter(x => x !== '');
}
const ORDEN = ['tipo', 'id', 'titulo', 'fecha', 'hora', 'formato', 'formatos', 'redes', 'cuentas', 'estado', 'responsable', 'medios', 'historiaTambien', 'historias', 'hashtagsEnComentario', 'pinterest', 'youtube', 'tiktok', 'origen', 'tarea', 'creada', 'actualizada', 'aprobada', 'entregada'];
const OBJETOS = ['aprobada', 'entregada', 'pinterest', 'youtube', 'tiktok', 'formatos', 'cuentas']; // van en la cabecera como JSON en una línea

/** C1: los formatos por red de la cabecera: solo redes y formatos que existen. */
const formatosLimpios = v => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([r, f]) => REDES.includes(r) && FORMATOS.includes(f))) : {});

/** Las opciones de una red (Pinterest, YouTube, TikTok), limpias: solo los campos que admite, cada uno a su largo; vacías → null. */
function opciones(red, v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {};
  for (const [k, max] of Object.entries(OPCIONES[red])) {
    if (!(k in v)) continue;
    if (k === 'paraNinos') { if (v[k] === true) out[k] = true; continue; }
    const x = String(v[k] ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
    if (k === 'privacidad' && !PRIVACIDAD[red].includes(x)) continue;
    if (x) out[k] = x;
  }
  return Object.keys(out).length ? out : null;
}

/** La nota → la pieza. Lo que la cabecera no traiga toma su valor de siempre; el cuerpo se parte en sus secciones. */
export function parsear(md, { file = '' } = {}) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(String(md ?? ''));
  const head = {}, lines = (m ? m[1] : '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const k = /^([A-Za-z][\w]*):\s*(.*)$/.exec(lines[i]); if (!k) continue;
    if (k[2].trim() === '') { const items = []; while (i + 1 < lines.length && /^\s+-\s/.test(lines[i + 1])) items.push(readScalar(lines[++i].replace(/^\s+-\s/, ''))); head[k[1]] = items; }
    else head[k[1]] = readScalar(k[2]);
  }
  const body = m ? m[2] : String(md ?? '');
  const secciones = { texto: [], comentario: [], hashtags: [], textoFacebook: [], notas: [] }, DE = { 'primer comentario': 'comentario', hashtags: 'hashtags', 'texto de facebook': 'textoFacebook', notas: 'notas' };
  for (const r of CON_TEXTO_PROPIO) { DE[`texto de ${NOMBRE_RED[r].toLowerCase()}`] = `red:${r}`; secciones[`red:${r}`] = []; } // M2: «## Texto de LinkedIn»…
  let cur = 'texto';
  for (const line of body.split(/\r?\n/)) { const h = /^##\s+(.+?)\s*$/.exec(line); if (h && DE[h[1].toLowerCase()]) { cur = DE[h[1].toLowerCase()]; continue; } secciones[cur].push(line); }
  const t = k => secciones[k].join('\n').trim();
  const textos = {}; for (const r of CON_TEXTO_PROPIO) { const x = t(`red:${r}`); if (x) textos[r] = x; }
  const lista = v => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x) : [];
  return {
    id: head.id || base(file, '.md'), titulo: String(head.titulo ?? ''), fecha: FECHA_RE.test(head.fecha ?? '') ? head.fecha : '', hora: HORA_RE.test(head.hora ?? '') ? head.hora : '',
    formato: FORMATOS.includes(head.formato) ? head.formato : 'post', formatos: formatosLimpios(head.formatos), redes: lista(head.redes).filter(r => REDES.includes(r)), cuentas: cuentasLimpias(head.cuentas),
    estado: ESTADOS.includes(head.estado) ? head.estado : 'borrador', responsable: String(head.responsable ?? ''),
    medios: lista(head.medios), historiaTambien: head.historiaTambien === true, historias: lista(head.historias),
    texto: t('texto'), comentario: t('comentario'), hashtags: t('hashtags'), hashtagsEnComentario: head.hashtagsEnComentario === true, textoFacebook: t('textoFacebook'), notas: t('notas'),
    origen: String(head.origen ?? 'dueno'), tarea: head.tarea ? String(head.tarea) : '', creada: String(head.creada ?? ''), actualizada: String(head.actualizada ?? ''),
    aprobada: head.aprobada && typeof head.aprobada === 'object' && !Array.isArray(head.aprobada) ? { cuando: String(head.aprobada.cuando ?? ''), huella: String(head.aprobada.huella ?? ''), por: String(head.aprobada.por ?? '') } : null,
    // M1 (6 oct 2026): el doble testigo de lo entregado al conductor (Metricool, simulacro): la cola lo apunta, y la nota también
    textos, pinterest: opciones('pinterest', head.pinterest), youtube: opciones('youtube', head.youtube), tiktok: opciones('tiktok', head.tiktok),
    entregada: head.entregada && typeof head.entregada === 'object' && !Array.isArray(head.entregada) ? { conductor: String(head.entregada.conductor ?? ''), huella: String(head.entregada.huella ?? ''), cuando: String(head.entregada.cuando ?? ''), remoto: head.entregada.remoto && typeof head.entregada.remoto === 'object' ? head.entregada.remoto : {} } : null,
  };
}

/** La pieza → la nota. `parsear(serializar(p))` devuelve la misma pieza. */
export function serializar(p) {
  const v = { tipo: 'pieza', ...p, aprobada: p.aprobada ? JSON.stringify({ cuando: p.aprobada.cuando, huella: p.aprobada.huella, por: p.aprobada.por ?? '' }) : null, entregada: p.entregada ? JSON.stringify(p.entregada) : null };
  for (const k of ['pinterest', 'youtube', 'tiktok']) v[k] = p[k] ? JSON.stringify(p[k]) : null;
  v.formatos = p.formatos && Object.keys(p.formatos).length ? JSON.stringify(p.formatos) : null;
  v.cuentas = p.cuentas && Object.keys(p.cuentas).length ? JSON.stringify(p.cuentas) : null; // 9 oct 2026: { red: 'red:<id>' }, en una línea
  const cab = ORDEN.map(k => {
    const x = v[k];
    if (Array.isArray(x)) return x.length ? `${k}:\n${x.map(i => `  - ${scalar(i)}`).join('\n')}` : `${k}: []`;
    if (OBJETOS.includes(k)) return x === null || x === undefined ? (k === 'aprobada' || k === 'entregada' ? `${k}: null` : '') : `${k}: ${x}`;
    return `${k}: ${scalar(x === '' ? null : x)}`;
  }).filter(Boolean);
  const propios = CON_TEXTO_PROPIO.filter(r => String(p.textos?.[r] ?? '').trim()).map(r => `## Texto de ${NOMBRE_RED[r]}\n${p.textos[r].trim()}`);
  const cuerpo = [p.texto.trim(), p.comentario.trim() && `## Primer comentario\n${p.comentario.trim()}`, p.hashtags.trim() && `## Hashtags\n${p.hashtags.trim()}`, p.textoFacebook.trim() && `## Texto de Facebook\n${p.textoFacebook.trim()}`, ...propios, p.notas.trim() && `## Notas\n${p.notas.trim()}`].filter(Boolean).join('\n\n');
  return `---\n${cab.join('\n')}\n---\n${cuerpo}${cuerpo ? '\n' : ''}`;
}

/** Qué se aprobó: una huella de todo lo que define lo que sale. Cambia una coma y ya es otra. */
export function huella(p) {
  const base = PUBLICABLES.map(k => p[k] ?? null);
  const m2 = PUBLICABLES_M2.filter(k => p[k] && Object.keys(p[k]).length).map(k => [k, p[k]]);
  const ctas = cuentasDeRedes(p); if (Object.keys(ctas).length) m2.push(['cuentas', ctas]); // 9 oct 2026: dónde sale es «lo que sale»; solo si tiene algo (lo aprobado antes sigue aprobado)
  return createHash('sha1').update(JSON.stringify(m2.length ? [...base, m2] : base)).digest('hex').slice(0, 16);
}

const cadena = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').slice(0, max);
// una línea «## Notas» dentro de un texto se leería, al volver a abrir la nota, como el comienzo de esa sección: se rebaja a «# Notas» (el resto del texto queda igual)
const SECCION = new RegExp(`^##(\\s+(?:Primer comentario|Hashtags|Texto de (?:${Object.values(NOMBRE_RED).join('|')})|Notas)\\s*)$`, 'gim');
const cuerpo = (v, max) => cadena(v, max).replace(SECCION, '#$1');
const lista = (v, max = 30) => (Array.isArray(v) ? v : String(v ?? '').split(/[\n,]/)).map(x => String(x ?? '').trim()).filter(Boolean).slice(0, max);

/**
 * Los datos que llegan (de la pantalla, de un agente) → una pieza limpia, encima de la previa si la hay. Solo se toca lo que viene:
 * un campo ausente conserva su valor. Devuelve { pieza } o { error } en palabras.
 */
export function normalizar(d = {}, previa = null) {
  const p = previa ? { ...previa } : { id: '', titulo: '', fecha: '', hora: '', formato: 'post', redes: ['instagram'], estado: 'borrador', responsable: '', medios: [], historiaTambien: false, historias: [], texto: '', comentario: '', hashtags: '', hashtagsEnComentario: false, textoFacebook: '', notas: '', textos: {}, formatos: {}, cuentas: {}, pinterest: null, youtube: null, tiktok: null, origen: 'dueno', tarea: '', creada: '', actualizada: '', aprobada: null, entregada: null };
  const has = k => Object.prototype.hasOwnProperty.call(d, k) && d[k] !== undefined;
  if (has('titulo')) p.titulo = cadena(d.titulo, 140).replace(/\n/g, ' ').trim();
  if (has('fecha')) { const f = String(d.fecha ?? ''); if (f && !FECHA_RE.test(f)) return { error: 'la fecha va como AAAA-MM-DD' }; if (f && !existe(f)) return { error: 'esa fecha no existe' }; p.fecha = f; }
  if (has('hora')) { const h = String(d.hora ?? ''); if (h && !HORA_RE.test(h)) return { error: 'la hora va como HH:MM, de 00:00 a 23:59' }; p.hora = h; }
  if (has('formato')) { if (!FORMATOS.includes(d.formato)) return { error: `el formato es uno de: ${FORMATOS.join(', ')}` }; p.formato = d.formato; }
  if (has('formatos')) { // C1: { red: formato } de las redes que salen distinto; null o {} = todas con el de la pieza
    if (d.formatos !== null && (typeof d.formatos !== 'object' || Array.isArray(d.formatos))) return { error: 'los formatos por red van como { red: formato }' };
    for (const [r, f] of Object.entries(d.formatos || {})) { if (!REDES.includes(r)) return { error: `«${r}» no es una red de esta oficina (son: ${REDES.join(', ')})` }; if (!FORMATOS.includes(f)) return { error: `el formato es uno de: ${FORMATOS.join(', ')}` }; }
    p.formatos = { ...(d.formatos || {}) };
  }
  if (has('cuentas')) { const c = limpiarCuentas(d.cuentas); if (c.error) return { error: c.error }; p.cuentas = d.cuentas === null ? {} : { ...cuentasLimpias(p.cuentas), ...Object.fromEntries(Object.keys(d.cuentas).map(r => [r, c.cuentas[r]])) }; for (const r of Object.keys(p.cuentas)) if (!p.cuentas[r]) delete p.cuentas[r]; } // 9 oct 2026: solo cambia la red que viene; '' la devuelve a la de Ajustes
  if (has('redes')) { const r = lista(d.redes).map(x => x.toLowerCase()); const mala = r.find(x => !REDES.includes(x)); if (mala) return { error: `«${mala}» no es una red de esta oficina (son: ${REDES.join(', ')})` }; p.redes = [...new Set(r)]; }
  if (has('estado')) { if (!ESTADOS.includes(d.estado)) return { error: `el estado es uno de: ${ESTADOS.join(', ')}` }; p.estado = d.estado; }
  if (has('responsable')) p.responsable = cadena(d.responsable, 60).trim();
  if (has('medios')) p.medios = lista(d.medios, 20);
  if (has('historias')) p.historias = lista(d.historias, 10);
  if (has('historiaTambien')) p.historiaTambien = d.historiaTambien === true;
  if (has('hashtagsEnComentario')) p.hashtagsEnComentario = d.hashtagsEnComentario === true;
  if (has('texto')) p.texto = cuerpo(d.texto, 70000);
  if (has('comentario')) p.comentario = cuerpo(d.comentario, 2200);
  if (has('hashtags')) p.hashtags = cadena(d.hashtags, 2200).replace(/\n/g, ' ');
  if (has('textoFacebook')) p.textoFacebook = cuerpo(d.textoFacebook, 70000);
  if (has('notas')) p.notas = cuerpo(d.notas, 5000);
  if (has('textos')) { // M2: el texto propio de cada red; vacío = el principal. `textos.facebook` es «Texto de Facebook»
    if (typeof d.textos !== 'object' || Array.isArray(d.textos) || d.textos === null) return { error: 'los textos por red van como { red: texto }' };
    const t = { ...(p.textos || {}) };
    for (const [r0, v] of Object.entries(d.textos)) {
      const r = String(r0).toLowerCase(); if (!REDES.includes(r)) return { error: `«${r0}» no es una red de esta oficina (son: ${REDES.join(', ')})` };
      if (r === 'facebook') { p.textoFacebook = cuerpo(v, 70000); continue; }
      if (r === 'instagram') { p.texto = cuerpo(v, 70000); continue; }
      const x = cuerpo(v, 70000).trim(); if (x) t[r] = x; else delete t[r];
    }
    p.textos = t;
  }
  for (const r of ['pinterest', 'youtube', 'tiktok']) if (has(r)) p[r] = d[r] === null ? null : opciones(r, { ...(p[r] || {}), ...d[r] });
  if (has('origen')) p.origen = cadena(d.origen, 40) || 'dueno';
  if (has('tarea')) p.tarea = cadena(d.tarea, 40);
  if (!p.redes.length) p.redes = ['instagram'];
  // C1: los formatos por red, siempre limpios: solo las redes de la pieza y solo los que salen distinto (como en la pantalla)
  if (p.formatos && Object.keys(p.formatos).length) { const n = normalizarFormatos(p.redes, Object.fromEntries(p.redes.map(r => [r, formatoDe(p, r)]))); p.formato = n.formato; p.formatos = n.formatos; } else p.formatos = {};
  return { pieza: p };
}
export const mesDe = f => (FECHA_RE.test(f) ? f.slice(0, 7) : SIN_FECHA);
/** C1: «Publicar ya» aprueba para el primer minuto entero que falte a `min` minutos o más (la cola: 1 de gracia y 3 de margen). */
export const PRONTO_MIN = 5;
const dos = n => String(n).padStart(2, '0');
export function ahoraMas(t, min) { const d = new Date(t + min * 60e3); if (d.getSeconds() || d.getMilliseconds()) d.setMinutes(d.getMinutes() + 1, 0, 0); return { fecha: `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`, hora: `${dos(d.getHours())}:${dos(d.getMinutes())}` }; }
/** El id de una pieza nueva. `aleatorio()` da 4 caracteres hex (el almacén local usa node:crypto; el Worker, WebCrypto). */
export const nuevoId = (fecha, ahora, aleatorio) => `p-${(FECHA_RE.test(fecha) ? fecha : new Date(ahora()).toISOString().slice(0, 10)).replace(/-/g, '')}-${aleatorio()}`;
