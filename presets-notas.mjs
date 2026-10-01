// Banco de presets: los PRESETS PROPIOS del dueño son NOTAS del Cerebro (§15.4 de docs/propuesta-banco-presets.md).
//
//   <cerebro>/Estudio/Presets/<nombre>.md
//
// Una nota así es una neurona más del Cerebro 3D (graph-build.mjs lee Estudio/, no lee Agents Office/), entra en la
// búsqueda y la memoria aprende de las que se aprueban. La CABECERA (front matter) guarda la receta, que es lo que manda:
//   pila (los presets de fábrica con sus parámetros), ejes de la referencia, escena 3D, canal, modelo y las referencias
//   fijas (ids de la galería: las imágenes NUNCA se copian a la nota).
// El CUERPO es para leer: el nombre, la frase, [[enlaces]] a la marca, a la campaña y al preset del que sale (basadoEn),
// la receta en palabras, la escena en palabras y una sección «## Notas» del dueño, que se conserva tal cual al reescribir.
//
// PURO: sin archivos ni red (quien lee y escribe en disco es presets.mjs). Corre en el servidor y en la página.
//
//   notaAPreset(md, { archivo, byId, canales })   → { preset, problemas: [] }
//   presetANota(preset, { byId, previa })         → md                 (con `previa`, conserva sus «## Notas»)
//   validarPropio(preset, { byId, canales })      → problemas: []
//   normalizarEscena(e)                           → { escena, problemas }
//   idDesdeNombre(nombre) · archivoDeNombre(nombre) · rutaDe(nombre)   → 'mio-cama-web' · 'Cama web.md' · 'Estudio/Presets/Cama web.md'
//   aPresetDeBanco(propio, { byId, iconos })      → el preset propio con la forma de uno de fábrica, para la lista del banco

export const CARPETA = 'Estudio/Presets';
export const TIPO = 'preset';
export const EJES_REF = ['estilo', 'color', 'composicion', 'luz', 'fondo', 'pose', 'producto']; // §5.4, de 0 (apagado) a 3 (fuerte)
export const LENTES = [14, 24, 35, 50, 85, 135];
export const FONDOS_ESCENA = ['color', 'set', 'locacion'];
const MEDIOS = ['image', 'video', 'audio', 'music'];
const ID_PROPIO = /^mio-[a-z0-9-]{1,36}$/;
const ORDEN = ['tipo', 'id', 'nombre', 'v', 'medio', 'icono', 'frase', 'basadoEn', 'canal', 'modelo', 'pila', 'ejes', 'escena', 'fijas', 'marca', 'campana', 'enlaces', 'buscar', 'estado', 'creado', 'actualizado'];
const FUERZA_ES = ['apagado', 'suave', 'normal', 'fuerte'];
const INTENSIDAD = { id: 'intensidad', tipo: 'intensidad', es: 'Intensidad', valores: [{ v: 'suave', es: 'Suave' }, { v: 'normal', es: 'Normal' }, { v: 'fuerte', es: 'Fuerte' }] };
const EJE_ES = { estilo: 'Estilo', color: 'Color / LUT', composicion: 'Composición', luz: 'Luz', fondo: 'Fondo', pose: 'Pose', producto: 'Producto' };

/* ---------- nombres y rutas ---------- */
const sinTildes = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
/** El id de un preset propio: «mio-» y el nombre en minúsculas con guiones (40 caracteres como mucho). */
export function idDesdeNombre(nombre) {
  const slug = sinTildes(nombre).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36).replace(/-+$/, '');
  return 'mio-' + (slug || 'preset');
}
/** El archivo de la nota: el nombre tal cual (con tildes: es una nota que lee una persona) sin lo que Windows no deja. */
export function archivoDeNombre(nombre) {
  const limpio = String(nombre ?? '').replace(/[\\/:*?"<>|#^[\]\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 80).trim();
  return (limpio || 'Preset') + '.md';
}
export const rutaDe = nombre => `${CARPETA}/${archivoDeNombre(nombre)}`;
const nombreDeArchivo = archivo => String(archivo ?? '').split(/[\\/]/).pop().replace(/\.md$/i, '');

/* ---------- la cabecera: YAML mínimo; lo anidado va en JSON de una línea (YAML válido, y Obsidian lo enseña) ---------- */
const BARE = /^[\p{L}\p{N}][\p{L}\p{N} ._/()\-]*$/u;
const bare = s => BARE.test(s) && s === s.trim() && !/^(null|true|false|~|yes|no|on|off)$/i.test(s) && !/^-?\d+(\.\d+)?$/.test(s) && !/: |\s#/.test(s);
const escalar = v => v === null || v === undefined ? 'null' : typeof v === 'boolean' || typeof v === 'number' ? String(v) : typeof v === 'object' ? JSON.stringify(v) : bare(String(v)) ? String(v) : JSON.stringify(String(v));
function leerEscalar(t) {
  t = t.trim();
  if (t === '' || t === 'null' || t === '~') return null;
  if (t === 'true') return true; if (t === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t[0] === '"' || t[0] === '{' || t[0] === '[') { try { return JSON.parse(t); } catch { return t[0] === '[' && t.at(-1) === ']' && !/[{}]/.test(t) ? listaSimple(t) : { __roto: t }; } }
  if (t[0] === "'" && t.at(-1) === "'") return t.slice(1, -1).replace(/''/g, "'");
  return t;
}
function listaSimple(t) { // «[a, b, "c, d"]» que Obsidian escribe sin comillas
  const inner = t.slice(1, -1).trim(); if (!inner) return [];
  const out = []; let cur = '', q = false;
  for (let i = 0; i < inner.length; i++) { const c = inner[i]; if (c === '"' && inner[i - 1] !== '\\') q = !q; if (c === ',' && !q) { out.push(cur); cur = ''; } else cur += c; }
  out.push(cur); return out.map(x => leerEscalar(x)).filter(x => x !== null && x !== '');
}
export function leerCabecera(md) {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/.exec(String(md ?? ''));
  if (!m) return { cab: null, cuerpo: String(md ?? '') };
  const cab = {}, lineas = m[1].split(/\r?\n/);
  for (let i = 0; i < lineas.length; i++) {
    const k = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(lineas[i]); if (!k) continue;
    if (k[2].trim() === '') { // lista en bloque (como la deja Obsidian al editar una propiedad)
      const items = []; while (i + 1 < lineas.length && /^\s*-\s/.test(lineas[i + 1])) items.push(leerEscalar(lineas[++i].replace(/^\s*-\s/, '')));
      cab[k[1]] = items;
    } else cab[k[1]] = leerEscalar(k[2]);
  }
  return { cab, cuerpo: m[2] };
}
function escribirCabecera(v) {
  const lineas = [];
  for (const k of ORDEN) {
    if (!(k in v)) continue; const x = v[k];
    if (Array.isArray(x) && ['fijas', 'enlaces', 'buscar'].includes(k)) lineas.push(x.length ? `${k}:\n${x.map(i => `  - ${escalar(i)}`).join('\n')}` : `${k}: []`);
    else lineas.push(`${k}: ${escalar(x === '' ? null : x)}`);
  }
  return `---\n${lineas.join('\n')}\n---\n`;
}

/* ---------- la escena 3D (§16.1) ---------- */
const num = x => typeof x === 'number' && Number.isFinite(x);
const giro180 = a => { let x = ((a + 180) % 360 + 360) % 360 - 180; if (x === -180 && a > 0) x = 180; return Math.round(x * 10) / 10; };
/** La escena con sus números comprobados: el piso es el cero (la cámara y el producto nunca por debajo), los ángulos de
 *  −180 a 180, la distancia y las medidas en cm, el lente uno de los de la lista. Lo que no vale va en `problemas`. */
export function normalizarEscena(e) {
  const problemas = [];
  if (e === null || e === undefined) return { escena: null, problemas };
  if (typeof e !== 'object' || Array.isArray(e) || e.__roto) return { escena: null, problemas: ['escena: no se entiende (debe ser { producto, camara, cuadro, fondo })'] };
  const pr = e.producto || {}, ca = e.camara || {}, cu = e.cuadro || {}, fo = e.fondo || {};
  const medida = (x, campo, min, max) => { if (!num(x) || x < min || x > max) { problemas.push(`escena: ${campo} debe ser un número de ${min} a ${max} cm`); return null; } return Math.round(x * 10) / 10; };
  const producto = {
    tipo: typeof pr.tipo === 'string' && pr.tipo.trim() ? pr.tipo.trim().slice(0, 40) : (problemas.push('escena: el producto dice qué es (tipo)'), ''),
    ancho: medida(pr.ancho, 'el ancho del producto', 0.5, 5000), alto: medida(pr.alto, 'el alto del producto', 0.5, 5000), fondo: medida(pr.fondo, 'el fondo del producto', 0.5, 5000),
    giro: num(pr.giro ?? 0) ? giro180(pr.giro ?? 0) : (problemas.push('escena: el giro del producto es un número de grados'), 0),
    elevacion: num(pr.elevacion ?? 0) && (pr.elevacion ?? 0) >= 0 && (pr.elevacion ?? 0) <= 1000 ? pr.elevacion ?? 0 : (problemas.push('escena: el producto se sube de 0 a 1000 cm (el piso es el cero)'), 0),
  };
  const camara = {
    distancia: medida(ca.distancia, 'la distancia de la cámara', 5, 10000),
    azimut: num(ca.azimut ?? 0) ? giro180(ca.azimut ?? 0) : (problemas.push('escena: «alrededor» (azimut) es un número de grados'), 0),
    altura: num(ca.altura) && ca.altura >= 0 && ca.altura <= 10000 ? ca.altura : (problemas.push(num(ca.altura) && ca.altura < 0 ? 'escena: la cámara no baja del piso (altura desde 0 cm)' : 'escena: la altura de la cámara es un número de 0 a 10000 cm'), Math.max(0, num(ca.altura) ? Math.min(ca.altura, 10000) : 0)),
    lente: LENTES.includes(ca.lente) ? ca.lente : (problemas.push(`escena: el lente es uno de ${LENTES.join(', ')} mm`), 50),
  };
  const cuadro = { proporcion: /^\d+(\.\d+)?:\d+$/.test(cu.proporcion || '') ? cu.proporcion : (problemas.push('escena: la proporción del cuadro es «ancho:alto» (4:5)'), '1:1') };
  let fondo = { tipo: FONDOS_ESCENA.includes(fo.tipo) ? fo.tipo : 'color', valor: typeof fo.valor === 'string' ? fo.valor.trim().slice(0, 80) : '' };
  if (!FONDOS_ESCENA.includes(fo.tipo)) problemas.push(`escena: el fondo es ${FONDOS_ESCENA.join(', ')}`);
  if (fondo.tipo === 'color' && !/^#[0-9A-Fa-f]{6}$/.test(fondo.valor)) { problemas.push('escena: un fondo de color es #RRGGBB'); fondo = { tipo: 'color', valor: '#FFFFFF' }; }
  if (fondo.tipo !== 'color' && !fondo.valor) problemas.push('escena: el set o la locación dice cuál es');
  return { escena: { producto, camara, cuadro, fondo }, problemas };
}
const cmES = cm => cm >= 100 ? `${String(Math.round(cm) / 100).replace('.', ',')} m` : `${String(cm).replace('.', ',')} cm`;
/** La escena en una frase para la nota (no es el prompt: la traducción al prompt es de src/escena3d-core.js). */
export function escenaEnPalabras(e) {
  if (!e) return '';
  const p = e.producto, c = e.camara;
  return `${p.tipo || 'Producto'} de ${p.ancho} × ${p.fondo} × ${p.alto} cm (ancho × fondo × alto)${p.giro ? `, girado ${p.giro}°` : ''}${p.elevacion ? `, subido ${cmES(p.elevacion)}` : ''}. `
    + `Cámara a ${cmES(c.distancia)} y ${cmES(c.altura)} de alto, ${c.azimut}° alrededor, lente de ${c.lente} mm. Cuadro ${e.cuadro.proporcion}. `
    + `Fondo: ${e.fondo.tipo === 'color' ? 'color ' + e.fondo.valor : e.fondo.tipo === 'set' ? 'set «' + e.fondo.valor + '»' : 'locación «' + e.fondo.valor + '»'}.`;
}

/* ---------- validar la receta ---------- */
const lista = x => Array.isArray(x) ? x : [];
const esIdGaleria = s => typeof s === 'string' && /^[^\\:]{1,240}$/.test(s) && !s.startsWith('/') && !/(^|\/)\.\.(\/|$)/.test(s) && !/^data:|^https?:/i.test(s);
/** Los problemas de un preset propio, en frases. `byId`: los presets (de fábrica y propios) por id; `canales`: ids. */
export function validarPropio(p, { byId = null, canales = null } = {}) {
  const out = [], mal = (campo, frase) => out.push(`${campo}: ${frase}`);
  if (!p || typeof p !== 'object') return ['la nota no tiene receta'];
  if (!ID_PROPIO.test(p.id || '')) mal('id', '«mio-» y de 1 a 36 letras minúsculas, números o guiones');
  if (typeof p.nombre !== 'string' || !p.nombre.trim() || p.nombre.length > 60) mal('nombre', 'falta o pasa de 60 caracteres');
  if (!Number.isInteger(p.v) || p.v < 1) mal('v', 'un entero desde 1');
  if (!MEDIOS.includes(p.medio)) mal('medio', `uno de ${MEDIOS.join(', ')}`);
  const r = p.receta || {};
  const pila = lista(r.pila);
  if (!pila.length) mal('pila', 'la receta no tiene ningún preset');
  let recetas = 0;
  for (const [i, x] of pila.entries()) {
    if (!x || typeof x !== 'object' || typeof x.id !== 'string') { mal(`pila[${i}]`, 'debe ser { id, params }'); continue; }
    if (x.params !== undefined && (typeof x.params !== 'object' || Array.isArray(x.params) || x.params === null)) mal(`pila[${i}]`, 'params es un objeto');
    if (x.id === p.id) { mal(`pila[${i}]`, 'un preset no se incluye a sí mismo'); continue; }
    if (!byId) continue;
    const q = byId.get(x.id);
    if (!q) { mal(`pila[${i}]`, `«${x.id}» no es un preset que exista`); continue; }
    if (q.capa === 'receta') recetas++;
    const medioQ = (q.medios || [q.medio])[0];
    if (p.medio && medioQ && medioQ !== p.medio) mal(`pila[${i}]`, `«${x.id}» es de ${medioQ} y el preset de ${p.medio}`);
    for (const [k, v] of Object.entries(x.params || {})) {
      // la intensidad vale para todo chip (Suave · Normal · Fuerte, §7.4), la declare el preset o no
      const par = (q.parametros || []).find(z => z.id === k) || (k === 'intensidad' ? INTENSIDAD : null);
      if (!par) { mal(`pila[${i}]`, `«${x.id}» no tiene el parámetro «${k}»`); continue; }
      if (Array.isArray(par.valores)) { const vs = par.valores.map(z => z.v); const dados = par.tipo === 'multi' ? String(v).split(',') : [String(v)]; for (const d of dados) if (!vs.includes(d)) mal(`pila[${i}]`, `«${k}» no admite «${d}» (${vs.join(', ')})`); }
      if (par.tipo === 'canal' && canales && !canales.has(v)) mal(`pila[${i}]`, `el canal «${v}» no existe`);
    }
  }
  if (recetas > 1) mal('pila', 'como mucho una receta por pila (los demás son ajustes)');
  if (r.ejes !== null && r.ejes !== undefined) {
    if (typeof r.ejes !== 'object' || Array.isArray(r.ejes) || r.ejes.__roto) mal('ejes', 'debe ser { estilo, color, composicion, luz, fondo, pose, producto } de 0 a 3');
    else for (const [k, v] of Object.entries(r.ejes)) { if (!EJES_REF.includes(k)) mal('ejes', `«${k}» no es un eje de la referencia`); else if (![0, 1, 2, 3].includes(v)) mal('ejes', `«${k}» va de 0 (apagado) a 3 (fuerte)`); }
  }
  if (r.escena !== null && r.escena !== undefined) out.push(...normalizarEscena(r.escena).problemas);
  if (r.canal !== null && r.canal !== undefined && (typeof r.canal !== 'string' || (canales && !canales.has(r.canal)))) mal('canal', `«${r.canal}» no es un canal`);
  if (r.modelo !== null && r.modelo !== undefined && (typeof r.modelo !== 'string' || !r.modelo)) mal('modelo', 'el id de un modelo o nada');
  for (const f of lista(r.fijas)) if (!esIdGaleria(f)) mal('fijas', `«${String(f).slice(0, 60)}» no es un id de la galería (las imágenes no se copian a la nota)`);
  if (r.fijas !== undefined && !Array.isArray(r.fijas)) mal('fijas', 'una lista de ids de la galería');
  if (p.basadoEn !== null && p.basadoEn !== undefined) {
    const m = /^([a-z0-9-]{3,40})@(\d+)$/.exec(p.basadoEn || '');
    if (!m) mal('basadoEn', '«id@versión», por ejemplo «cat-web-panaclaw@1»');
    else if (byId && !byId.has(m[1])) mal('basadoEn', `«${m[1]}» no existe`);
  }
  for (const k of ['marca', 'campana']) if (p[k] !== null && p[k] !== undefined && typeof p[k] !== 'string') mal(k, 'un nombre de nota');
  if (!Array.isArray(p.buscar)) mal('buscar', 'una lista');
  return out;
}

/* ---------- la nota → el preset ---------- */
const enlacesDe = texto => [...new Set([...String(texto ?? '').matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)].map(m => m[1].trim()).filter(Boolean))];
function seccion(cuerpo, titulo) {
  const re = new RegExp(`^##\\s+${titulo}\\s*$`, 'im'), m = re.exec(cuerpo);
  if (!m) return '';
  const resto = cuerpo.slice(m.index + m[0].length), fin = /^##\s+/m.exec(resto);
  return (fin ? resto.slice(0, fin.index) : resto).replace(/^\r?\n/, '').replace(/\s+$/, '');
}
/** Lee una nota de preset. Lo que la cabecera no trae toma su valor de siempre; los problemas no tiran: se dicen. */
export function notaAPreset(md, { archivo = '', byId = null, canales = null } = {}) {
  const { cab, cuerpo } = leerCabecera(md);
  if (!cab) return { preset: null, problemas: ['la nota no tiene cabecera (--- … ---) con la receta'] };
  if (cab.tipo !== TIPO) return { preset: null, problemas: [`la nota no es un preset (tipo: ${cab.tipo ?? 'falta'})`] };
  const problemas = [];
  const roto = (k, v) => { if (v && typeof v === 'object' && v.__roto) { problemas.push(`${k}: no se entiende «${String(v.__roto).slice(0, 60)}» (JSON en una línea)`); return true; } return false; };
  const nombre = typeof cab.nombre === 'string' && cab.nombre.trim() ? cab.nombre.trim() : nombreDeArchivo(archivo) || 'Preset';
  const pila = roto('pila', cab.pila) ? [] : lista(cab.pila).map(x => x && typeof x === 'object' ? { id: String(x.id ?? ''), params: x.params && typeof x.params === 'object' && !Array.isArray(x.params) ? x.params : {} } : x);
  const escN = roto('escena', cab.escena) ? { escena: null, problemas: [] } : normalizarEscena(cab.escena);
  const strOrNull = v => typeof v === 'string' && v.trim() ? v.trim() : null;
  const notas = seccion(cuerpo, 'Notas');
  const preset = {
    tipo: 'propio', id: typeof cab.id === 'string' ? cab.id : idDesdeNombre(nombre), nombre, v: Number.isInteger(cab.v) && cab.v > 0 ? cab.v : 1,
    medio: MEDIOS.includes(cab.medio) ? cab.medio : 'image', icono: strOrNull(cab.icono) || 'marca', frase: typeof cab.frase === 'string' ? cab.frase : '',
    basadoEn: strOrNull(cab.basadoEn),
    receta: { pila, ejes: roto('ejes', cab.ejes) ? null : cab.ejes ?? null, escena: escN.escena, canal: strOrNull(cab.canal), modelo: strOrNull(cab.modelo), fijas: lista(cab.fijas).map(String) },
    marca: strOrNull(cab.marca), campana: strOrNull(cab.campana),
    enlaces: [...new Set([...lista(cab.enlaces).map(x => String(x).replace(/^\[\[|\]\]$/g, '')), ...enlacesDe(notas)])],
    buscar: lista(cab.buscar).map(String), estado: cab.estado === 'estable' ? 'estable' : 'beta',
    creado: strOrNull(cab.creado), actualizado: strOrNull(cab.actualizado), notas, archivo: archivo || rutaDe(nombre),
  };
  problemas.push(...validarPropio({ ...preset, receta: { ...preset.receta, escena: cab.escena && !cab.escena.__roto ? cab.escena : null } }, { byId, canales }));
  return { preset, problemas: [...new Set(problemas)] };
}

/* ---------- el preset → la nota ---------- */
function paramsEnPalabras(q, params) {
  return Object.entries(params || {}).map(([k, v]) => {
    const par = (q && (q.parametros || []).find(z => z.id === k)) || (k === 'intensidad' ? INTENSIDAD : null);
    const val = par && Array.isArray(par.valores) ? (par.valores.find(z => z.v === String(v))?.es ?? v) : v;
    return `${par?.es || k}: ${val}`;
  }).join(' · ');
}
/** Escribe la nota. `byId` pone los nombres en lenguaje de tienda; `previa` (la nota de antes) conserva sus «## Notas». */
export function presetANota(p, { byId = null, previa = null } = {}) {
  const r = p.receta || {};
  const notas = previa ? seccion(leerCabecera(previa).cuerpo, 'Notas') : (p.notas || '');
  const cab = escribirCabecera({
    tipo: TIPO, id: p.id, nombre: p.nombre, v: p.v ?? 1, medio: p.medio || 'image', icono: p.icono || 'marca', frase: p.frase || '',
    basadoEn: p.basadoEn ?? null, canal: r.canal ?? null, modelo: r.modelo ?? null, pila: lista(r.pila).map(x => ({ id: x.id, params: x.params || {} })),
    ejes: r.ejes ?? null, escena: r.escena ?? null, fijas: lista(r.fijas), marca: p.marca ?? null, campana: p.campana ?? null,
    enlaces: lista(p.enlaces).filter(x => !enlacesDe(notas).includes(x)), buscar: lista(p.buscar), estado: p.estado || 'beta', creado: p.creado ?? null, actualizado: p.actualizado ?? null,
  });
  const nombreDe = id => byId?.get(id)?.nombre || id;
  const base = p.basadoEn ? /^([a-z0-9-]+)@/.exec(p.basadoEn)?.[1] : null;
  const de = [base && `Sale de [[${nombreDe(base)}]] (\`${p.basadoEn}\`).`, p.marca && `Marca: [[${p.marca}]].`, p.campana && `Campaña: [[${p.campana}]].`,
    lista(p.enlaces).filter(x => !enlacesDe(notas).includes(x) && x !== p.marca && x !== p.campana).map(x => `[[${x}]]`).join(' · ')].filter(Boolean).join(' ');
  const pasos = lista(r.pila).map((x, i) => { const q = byId?.get(x.id), pp = paramsEnPalabras(q, x.params); return `${i + 1}. ${nombreDe(x.id)} (\`${x.id}\`)${pp ? ' · ' + pp : ''}`; });
  const ejes = r.ejes && typeof r.ejes === 'object' ? EJES_REF.filter(k => k in r.ejes).map(k => `${EJE_ES[k]}: ${FUERZA_ES[r.ejes[k]] ?? r.ejes[k]}`).join(' · ') : '';
  const cuerpo = [
    `# ${p.nombre}`, p.frase && p.frase.trim(), de,
    `## Receta\n${pasos.join('\n') || '(vacía)'}${r.canal ? `\n\nPara: ${r.canal}.` : ''}${r.modelo ? ` Modelo: ${r.modelo}.` : ''}`,
    ejes && `## Referencia\n${ejes}`,
    r.escena && `## Escena 3D\n${escenaEnPalabras(normalizarEscena(r.escena).escena)}`,
    lista(r.fijas).length && `## Referencias fijas\n${lista(r.fijas).map(f => `- \`${f}\` (galería del Estudio)`).join('\n')}`,
    `## Notas\n${notas.trim()}`,
  ].filter(Boolean).join('\n\n');
  return `${cab}${cuerpo}\n`;
}

/* ---------- el preset propio en la lista del banco ---------- */
/** La forma de un preset de fábrica (categoria «mios», capa receta, incluye = su pila) para listarlo junto a los demás. */
export function aPresetDeBanco(p, { byId = new Map(), iconos = {} } = {}) {
  const qs = lista(p.receta?.pila).map(x => byId.get(x.id)).filter(Boolean);
  const ejecs = new Set(qs.map(q => q.ejecutor));
  const ejecutor = ejecs.size === 0 ? 'ia' : [...ejecs].every(e => e === 'local') ? 'local' : [...ejecs].every(e => e === 'ajustes') ? 'ajustes' : [...ejecs].some(e => e === 'local' || e === 'local+ia') && [...ejecs].some(e => e !== 'local') ? 'local+ia' : [...ejecs][0];
  const una = arr => [...new Set(arr)];
  const modos = qs.length ? qs.map(q => q.modos || []).reduce((a, b) => a.filter(x => b.includes(x))) : [];
  return {
    id: p.id, v: p.v, nombre: p.nombre, frase: p.frase || '', icono: { id: p.icono || 'marca', d: iconos[p.icono] || iconos.marca || '' },
    categoria: 'mios', medios: [p.medio], capa: 'receta', modos: modos.length ? modos : una(qs.flatMap(q => q.modos || [])),
    ejes: una(qs.flatMap(q => q.ejes || [])), exclusivo: false, ejecutor, entradas: qs.find(q => q.capa === 'receta')?.entradas || qs[0]?.entradas || [],
    parametros: [], incluye: lista(p.receta?.pila).map(x => x.id), requiere: { ...(qs.some(q => q.requiere?.edit) ? { edit: true } : {}), ...(Math.max(0, ...qs.map(q => q.requiere?.refsMin || 0)) ? { refsMin: Math.max(...qs.map(q => q.requiere?.refsMin || 0)) } : {}) },
    prefer: qs.find(q => (q.prefer || []).length)?.prefer || [], post: una(qs.flatMap(q => q.post || [])), qa: una(qs.flatMap(q => q.qa || [])),
    buscar: una([...lista(p.buscar), ...[p.marca, p.campana].filter(Boolean).map(s => sinTildes(s).toLowerCase())]), estrella: false,
    fase: Math.max(1, ...qs.map(q => q.fase || 1)), estado: p.estado || 'beta', prompt: null,
    basadoEn: p.basadoEn || null, fijas: lista(p.receta?.fijas),
    propio: { pila: lista(p.receta?.pila), ejes: p.receta?.ejes ?? null, escena: p.receta?.escena ?? null, canal: p.receta?.canal ?? null, modelo: p.receta?.modelo ?? null, archivo: p.archivo || rutaDe(p.nombre) },
  };
}
