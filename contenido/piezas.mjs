// Agents Office V4.7 (30 sep 2026) — las PIEZAS de contenido: lo que se quiere publicar, un día y una hora, en unas redes.
// Una pieza es una nota de texto (`<cerebro>/Agents Office/contenido/AAAA-MM/<id>.md`): una cabecera con lo que es (día, hora, formato,
// redes, estado, medios del Estudio) y el cuerpo con lo que se publica (el texto, el primer comentario, los hashtags). Se lee y se corrige
// a mano, la ven los agentes y el Cerebro, y NO viaja por GitHub: es la carpeta de las entregas, que el .gitignore ya excluye
// (el repositorio puede ser público y un texto sin publicar trae precios y lanzamientos).
//
// Aquí solo vive lo que se decide ANTES de publicar. Qué pasó al entregarla a Meta (ids, intentos, fallos) es de la cola (F3);
// las dos cosas se unen al pintar, igual que en Juancito Ads: el estado de la agenda no es la verdad de lo publicado.
//
//   parsear(md) · serializar(pieza) · huella(pieza) · normalizar(datos, previa)    → puros, con tests
//   crearAlmacen({ dir, medioExiste, ahora })                                       → { listar, leer, crear, guardar, aprobar, devolver, borrar, usos }
// Cubierto por tests/contenido-piezas.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { revisarPublicacion, postDePieza } from '../src/contenido-reglas.js';

export const ESTADOS = ['idea', 'borrador', 'revision', 'aprobada']; // los que se deciden aquí; «en Meta», «publicada» y «falló» son de la cola (F3)
export const FORMATOS = ['post', 'reel', 'carrusel', 'historia'];
export const REDES = ['instagram', 'facebook'];
const ID_RE = /^p-\d{8}-[a-f0-9]{4,8}$/;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/, HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SIN_FECHA = 'sin-fecha';
const existe = f => { const [y, m, d] = f.split('-').map(Number), x = new Date(y, m - 1, d); return x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d; }; // «31 de febrero» no rueda a marzo: no existe
// los campos que definen LO QUE SALE: si cambian tras aprobarla, el OK ya no vale (lo aprobado es este texto, esta hora, estos archivos)
const PUBLICABLES = ['fecha', 'hora', 'formato', 'redes', 'medios', 'texto', 'hashtags', 'hashtagsEnComentario', 'comentario', 'textoFacebook', 'historias', 'historiaTambien'];

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
const ORDEN = ['tipo', 'id', 'titulo', 'fecha', 'hora', 'formato', 'redes', 'estado', 'responsable', 'medios', 'historiaTambien', 'historias', 'hashtagsEnComentario', 'origen', 'tarea', 'creada', 'actualizada', 'aprobada'];

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
  let cur = 'texto';
  for (const line of body.split(/\r?\n/)) { const h = /^##\s+(.+?)\s*$/.exec(line); if (h && DE[h[1].toLowerCase()]) { cur = DE[h[1].toLowerCase()]; continue; } secciones[cur].push(line); }
  const t = k => secciones[k].join('\n').trim();
  const lista = v => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x) : [];
  return {
    id: head.id || path.basename(file, '.md'), titulo: String(head.titulo ?? ''), fecha: FECHA_RE.test(head.fecha ?? '') ? head.fecha : '', hora: HORA_RE.test(head.hora ?? '') ? head.hora : '',
    formato: FORMATOS.includes(head.formato) ? head.formato : 'post', redes: lista(head.redes).filter(r => REDES.includes(r)),
    estado: ESTADOS.includes(head.estado) ? head.estado : 'borrador', responsable: String(head.responsable ?? ''),
    medios: lista(head.medios), historiaTambien: head.historiaTambien === true, historias: lista(head.historias),
    texto: t('texto'), comentario: t('comentario'), hashtags: t('hashtags'), hashtagsEnComentario: head.hashtagsEnComentario === true, textoFacebook: t('textoFacebook'), notas: t('notas'),
    origen: String(head.origen ?? 'dueno'), tarea: head.tarea ? String(head.tarea) : '', creada: String(head.creada ?? ''), actualizada: String(head.actualizada ?? ''),
    aprobada: head.aprobada && typeof head.aprobada === 'object' && !Array.isArray(head.aprobada) ? { cuando: String(head.aprobada.cuando ?? ''), huella: String(head.aprobada.huella ?? ''), por: String(head.aprobada.por ?? '') } : null,
  };
}

/** La pieza → la nota. `parsear(serializar(p))` devuelve la misma pieza. */
export function serializar(p) {
  const v = { tipo: 'pieza', ...p, aprobada: p.aprobada ? JSON.stringify({ cuando: p.aprobada.cuando, huella: p.aprobada.huella, por: p.aprobada.por ?? '' }) : null };
  const cab = ORDEN.map(k => {
    const x = v[k];
    if (Array.isArray(x)) return x.length ? `${k}:\n${x.map(i => `  - ${scalar(i)}`).join('\n')}` : `${k}: []`;
    if (k === 'aprobada') return `${k}: ${x === null ? 'null' : x}`;
    return `${k}: ${scalar(x === '' ? null : x)}`;
  });
  const cuerpo = [p.texto.trim(), p.comentario.trim() && `## Primer comentario\n${p.comentario.trim()}`, p.hashtags.trim() && `## Hashtags\n${p.hashtags.trim()}`, p.textoFacebook.trim() && `## Texto de Facebook\n${p.textoFacebook.trim()}`, p.notas.trim() && `## Notas\n${p.notas.trim()}`].filter(Boolean).join('\n\n');
  return `---\n${cab.join('\n')}\n---\n${cuerpo}${cuerpo ? '\n' : ''}`;
}

/** Qué se aprobó: una huella de todo lo que define lo que sale. Cambia una coma y ya es otra. */
export function huella(p) {
  return crypto.createHash('sha1').update(JSON.stringify(PUBLICABLES.map(k => p[k] ?? null))).digest('hex').slice(0, 16);
}

const cadena = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').slice(0, max);
// una línea «## Notas» dentro de un texto se leería, al volver a abrir la nota, como el comienzo de esa sección: se rebaja a «# Notas» (el resto del texto queda igual)
const SECCION = /^##(\s+(?:Primer comentario|Hashtags|Texto de Facebook|Notas)\s*)$/gim;
const cuerpo = (v, max) => cadena(v, max).replace(SECCION, '#$1');
const lista = (v, max = 30) => (Array.isArray(v) ? v : String(v ?? '').split(/[\n,]/)).map(x => String(x ?? '').trim()).filter(Boolean).slice(0, max);

/**
 * Los datos que llegan (de la pantalla, de un agente) → una pieza limpia, encima de la previa si la hay. Solo se toca lo que viene:
 * un campo ausente conserva su valor. Devuelve { pieza } o { error } en palabras.
 */
export function normalizar(d = {}, previa = null) {
  const p = previa ? { ...previa } : { id: '', titulo: '', fecha: '', hora: '', formato: 'post', redes: ['instagram'], estado: 'borrador', responsable: '', medios: [], historiaTambien: false, historias: [], texto: '', comentario: '', hashtags: '', hashtagsEnComentario: false, textoFacebook: '', notas: '', origen: 'dueno', tarea: '', creada: '', actualizada: '', aprobada: null };
  const has = k => Object.prototype.hasOwnProperty.call(d, k) && d[k] !== undefined;
  if (has('titulo')) p.titulo = cadena(d.titulo, 140).replace(/\n/g, ' ').trim();
  if (has('fecha')) { const f = String(d.fecha ?? ''); if (f && !FECHA_RE.test(f)) return { error: 'la fecha va como AAAA-MM-DD' }; if (f && !existe(f)) return { error: 'esa fecha no existe' }; p.fecha = f; }
  if (has('hora')) { const h = String(d.hora ?? ''); if (h && !HORA_RE.test(h)) return { error: 'la hora va como HH:MM, de 00:00 a 23:59' }; p.hora = h; }
  if (has('formato')) { if (!FORMATOS.includes(d.formato)) return { error: `el formato es uno de: ${FORMATOS.join(', ')}` }; p.formato = d.formato; }
  if (has('redes')) { const r = lista(d.redes).map(x => x.toLowerCase()); const mala = r.find(x => !REDES.includes(x)); if (mala) return { error: `«${mala}» no es una red de esta oficina (por ahora: ${REDES.join(', ')})` }; p.redes = [...new Set(r)]; }
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
  if (has('origen')) p.origen = cadena(d.origen, 40) || 'dueno';
  if (has('tarea')) p.tarea = cadena(d.tarea, 40);
  if (!p.redes.length) p.redes = ['instagram'];
  return { pieza: p };
}

/* ---------- el almacén: los archivos ---------- */
const mesDe = f => (FECHA_RE.test(f) ? f.slice(0, 7) : SIN_FECHA);
const nuevoId = (fecha, ahora) => `p-${(FECHA_RE.test(fecha) ? fecha : new Date(ahora()).toISOString().slice(0, 10)).replace(/-/g, '')}-${crypto.randomBytes(2).toString('hex')}`;

/**
 * `dir` es la carpeta de las piezas; `medioExiste(id)` dice si un archivo es del Estudio (así una pieza no apunta a algo que no está);
 * `ahora()` el momento actual (para probar). Todo lo que se escribe va a un temporal y se renombra: nunca una nota a medias.
 */
export function crearAlmacen({ dir, medioExiste = () => true, ahora = Date.now } = {}) {
  const ruta = (id, fecha) => path.join(dir, mesDe(fecha), `${id}.md`);
  const escribir = (p, viejaFecha) => {
    const f = ruta(p.id, p.fecha); fs.mkdirSync(path.dirname(f), { recursive: true });
    const tmp = f + '.tmp'; fs.writeFileSync(tmp, serializar(p)); fs.renameSync(tmp, f);
    if (viejaFecha !== undefined && mesDe(viejaFecha) !== mesDe(p.fecha)) fs.rmSync(ruta(p.id, viejaFecha), { force: true }); // cambió de mes: se mueve, no se duplica
  };
  const carpetas = () => (fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => /^\d{4}-\d{2}$/.test(x) || x === SIN_FECHA).sort() : []);
  const deArchivo = f => { try { return parsear(fs.readFileSync(f, 'utf8'), { file: f }); } catch { return null; } };
  const buscar = id => { if (!ID_RE.test(String(id))) return null; for (const c of carpetas()) { const f = path.join(dir, c, `${id}.md`); if (fs.existsSync(f)) return f; } return null; };
  const todas = meses => { const out = []; for (const c of carpetas()) { if (meses && !meses.has(c)) continue; for (const f of fs.readdirSync(path.join(dir, c)).filter(x => x.endsWith('.md'))) { const p = deArchivo(path.join(dir, c, f)); if (p) out.push(p); } } return out; };
  const conEstado = p => ({ ...p, cambiadaTrasAprobar: p.estado === 'aprobada' && !!p.aprobada && p.aprobada.huella !== huella(p) });
  const revisar = p => revisarPublicacion(postDePieza(p), p.redes);
  const medios = p => { for (const m of [...p.medios, ...p.historias]) if (!medioExiste(m)) return `el Estudio no tiene «${m}»`; return null; };

  return {
    dir, revisar,
    /** Las piezas de un rango de días (o todas), más las que no tienen día si se piden. Ordenadas por día y hora. */
    listar({ desde = '', hasta = '', sinFecha = false, estado, formato, red, q = '' } = {}) {
      let meses = null;
      if (FECHA_RE.test(desde) && FECHA_RE.test(hasta)) { // solo se abren las carpetas de los meses que toca el rango
        meses = new Set(); const fin = new Date(hasta + 'T00:00:00'); const d = new Date(desde + 'T00:00:00'); d.setDate(1);
        for (; d <= fin; d.setMonth(d.getMonth() + 1)) meses.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        if (sinFecha) meses.add(SIN_FECHA);
      }
      const needle = String(q).toLowerCase().trim();
      return todas(meses).filter(p => (p.fecha ? (!desde || p.fecha >= desde) && (!hasta || p.fecha <= hasta) : (sinFecha || (!desde && !hasta)))
        && (!estado || p.estado === estado) && (!formato || p.formato === formato) && (!red || p.redes.includes(red))
        && (!needle || `${p.titulo} ${p.texto} ${p.hashtags} ${p.notas}`.toLowerCase().includes(needle)))
        .map(conEstado).sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999') || (a.hora || '99').localeCompare(b.hora || '99') || a.creada.localeCompare(b.creada));
    },
    leer(id) { const f = buscar(id); const p = f && deArchivo(f); return p ? conEstado(p) : null; },
    crear(datos = {}, { por = 'dueno' } = {}) {
      const r = normalizar(datos); if (r.error) return { error: r.error };
      const p = r.pieza; const mal = medios(p); if (mal) return { error: mal };
      if (p.estado === 'aprobada') return { error: 'una pieza no nace aprobada: apruébala después, con «Aprobar»' };
      p.id = nuevoId(p.fecha, ahora); p.creada = p.actualizada = new Date(ahora()).toISOString(); if (!datos.origen) p.origen = por;
      escribir(p); return { pieza: conEstado(p) };
    },
    /** Cambia lo que venga. Si estaba aprobada y cambia algo de lo que sale, deja de estarlo: el OK era de otro texto. */
    guardar(id, datos = {}) {
      const f = buscar(id), previa = f && deArchivo(f); if (!previa) return { error: 'esa pieza ya no existe', nada: true };
      if ('estado' in datos && datos.estado === 'aprobada' && previa.estado !== 'aprobada') return { error: 'para aprobar una pieza usa «Aprobar»: revisa antes que pueda salir' };
      const r = normalizar(datos, previa); if (r.error) return { error: r.error };
      const p = r.pieza; const mal = medios(p); if (mal) return { error: mal };
      p.id = previa.id; p.creada = previa.creada; p.actualizada = new Date(ahora()).toISOString();
      let soltada = false;
      if (previa.estado === 'aprobada' && p.estado === 'aprobada' && huella(p) !== (previa.aprobada?.huella ?? '')) { p.estado = 'revision'; p.aprobada = null; soltada = true; }
      if (p.estado !== 'aprobada') p.aprobada = null;
      escribir(p, previa.fecha); return { pieza: conEstado(p), soltada };
    },
    /** El OK del dueño: solo si puede salir (sin errores de las reglas de cada red) y tiene día. */
    aprobar(id, { por = 'dueno' } = {}) {
      const f = buscar(id), p = f && deArchivo(f); if (!p) return { error: 'esa pieza ya no existe', nada: true };
      if (!p.fecha) return { error: 'ponle un día antes de aprobarla', errores: ['Sin día'] };
      const { errores, avisos } = revisar(p); if (errores.length) return { error: 'todavía no puede salir: ' + errores[0], errores, avisos };
      const mal = medios(p); if (mal) return { error: mal };
      p.estado = 'aprobada'; p.aprobada = { cuando: new Date(ahora()).toISOString(), huella: huella(p), por }; p.actualizada = p.aprobada.cuando;
      escribir(p); return { pieza: conEstado(p), avisos };
    },
    /** Devolver una pieza a revisión (o a borrador): quita el OK. */
    devolver(id, estado = 'revision') {
      const f = buscar(id), p = f && deArchivo(f); if (!p) return { error: 'esa pieza ya no existe', nada: true };
      p.estado = ['idea', 'borrador', 'revision'].includes(estado) ? estado : 'revision'; p.aprobada = null; p.actualizada = new Date(ahora()).toISOString();
      escribir(p); return { pieza: conEstado(p) };
    },
    /** A la papelera de las piezas (`.papelera/`, junto a ellas): nada se pierde sin querer. */
    borrar(id) {
      const f = buscar(id); if (!f) return { error: 'esa pieza ya no existe', nada: true };
      const bin = path.join(dir, '.papelera'); fs.mkdirSync(bin, { recursive: true });
      fs.renameSync(f, path.join(bin, `${ahora()}-${path.basename(f)}`)); return { ok: true };
    },
    /** Las piezas que usan un archivo del Estudio (para no dejar que la papelera se lo lleve). */
    usos(medio) { return todas().filter(p => p.medios.includes(medio) || p.historias.includes(medio)).map(p => ({ id: p.id, titulo: p.titulo, fecha: p.fecha })); },
  };
}
