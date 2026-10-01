// LOTES del Estudio (docs/propuesta-banco-presets.md §6 y §7.4; E6, 1 oct 2026): muchas fotos con la misma receta.
// Una pestaña del Estudio («Crear · Galería · Lotes», tecla L) con tres vistas:
//   · la LISTA de lotes (en marcha arriba);
//   · CREAR en 3 pasos: 1 qué fotos (carpeta, las seleccionadas, subirlas o un Excel/CSV) → 2 qué presets, canal y escena
//     (el mismo banco: buscador, pila, canal y escenario 3D para toda la serie) → 3 revisar (las 5 primeras, el modelo, el costo
//     y lo que queda hoy) con PROBAR CON 3 y GENERAR TODAS. Nada se gasta antes de ese clic: el paso 3 solo crea el lote
//     «previsto» (POST /api/media/lotes, que no gasta);
//   · el SEGUIMIENTO, como un agente trabajando: progreso, cada foto con su estado (en cola, trabajando, lista, revisar,
//     aprobada, falló) y su antes/después, aprobar o reintentar una, pausar/reanudar todo, la bitácora y descargar todo.
// El motor es del servidor (lotes.mjs, E5) y aquí solo se pide por la API de §6.4. En la demo (file://) un lote de mentira en
// memoria (crearDemo) corre con el motor «prueba» y responde a las mismas rutas. Lo puro va exportado y con tests
// (tests/studio-lotes.test.mjs).
//   initLotes(host, ctx) → { el, abrir(), nuevo(origen?), seguir(id), refrescar(), destruir(), estado() }
import { buscar } from './presets-buscar.js';
import * as E3 from './escena3d-core.js';
import { initEscena3d } from './escena3d.js';
import { iconoSVG } from '../presets/iconos.mjs';
import { cargarFabricaDemo } from './presets-fabrica.js';
import { marca, anadir, usd } from './studio-banco.js';

const arr = v => (Array.isArray(v) ? v : []);
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : 0));
const escHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- los estados (§6.2) ---------- */
export const ESTADO_FILA = Object.freeze({
  en_cola: { es: 'En cola', grupo: 'cola', ico: '○' },
  editando: { es: 'Trabajando', grupo: 'trabajando', ico: '◔' },
  verificando: { es: 'Comprobando', grupo: 'trabajando', ico: '◑' },
  lista: { es: 'Lista', grupo: 'lista', ico: '✓' },
  revisar: { es: 'Revisar', grupo: 'revisar', ico: '⚠' },
  aprobada: { es: 'Aprobada', grupo: 'aprobada', ico: '✔' },
  fallo: { es: 'Falló', grupo: 'fallo', ico: '✕' },
  omitida: { es: 'Omitida', grupo: 'omitida', ico: '–' },
});
export const FILTROS = Object.freeze([['todas', 'Todas'], ['cola', 'En cola'], ['trabajando', 'Trabajando'], ['lista', 'Listas'], ['revisar', 'Revisar'], ['aprobada', 'Aprobadas'], ['fallo', 'Fallaron'], ['omitida', 'Omitidas']]);
export const ESTADO_LOTE = Object.freeze({ previsto: 'Sin empezar', espera_ok: 'Espera tu OK', muestra: 'Probando con 3', corriendo: 'Trabajando', pausado: 'En pausa', hecho: 'Terminado', cancelado: 'Cancelado' });
export const ACTIVOS = Object.freeze(['muestra', 'corriendo']);
const TERMINAL = new Set(['lista', 'revisar', 'aprobada', 'fallo', 'omitida']);
export const grupoDe = estado => (ESTADO_FILA[estado] || ESTADO_FILA.en_cola).grupo;
/** Las columnas de un Excel (§6.1) y lo que significa cada una. */
export const CAMPOS = Object.freeze([['foto', 'Foto'], ['sku', 'SKU'], ['nombre', 'Nombre'], ['preset', 'Preset'], ['canal', 'Canal'], ['encuadre', 'Encuadre'], ['notas', 'Notas (idea)'], ['', 'No usar']]);
export const MAX_FILAS = 100; // §15.5: el tope de filas por lote (Ajustes lo cambia; el servidor manda)

/** Las cuentas de un lote: cuántas hay en cada grupo, las terminadas, el %, el dinero y los minutos que faltan (estimados). */
export function resumen(lote, now = Date.now()) {
  const filas = arr(lote?.filas), por = { cola: 0, trabajando: 0, lista: 0, revisar: 0, aprobada: 0, fallo: 0, omitida: 0 };
  for (const f of filas) por[grupoDe(f.estado)]++;
  const total = filas.length || num(lote?.total);
  const hechas = filas.filter(f => TERMINAL.has(f.estado)).length;
  const pct = total ? Math.round(hechas * 100 / total) : 0;
  const objetivo = lote?.estado === 'muestra' ? Math.min(total, num(lote?.muestra) || 3) : total;
  let eta = null;
  if (ACTIVOS.includes(lote?.estado) && lote.inicio && hechas > 0 && hechas < objetivo) eta = Math.max(1, Math.round((now - lote.inicio) / hechas * (objetivo - hechas) / 60000));
  return { total, hechas, pct, por, gastado: num(lote?.costo?.gastado), estimado: num(lote?.costo?.estimado), eta };
}
/** La línea de cifras bajo la barra: «24/40 · 2 revisar · 1 falló · ~6 min». */
export function lineaCifras(r) {
  const p = [`${r.hechas}/${r.total}`];
  if (r.por.revisar) p.push(`${r.por.revisar} revisar`);
  if (r.por.fallo) p.push(`${r.por.fallo} ${r.por.fallo === 1 ? 'falló' : 'fallaron'}`);
  if (r.por.aprobada) p.push(`${r.por.aprobada} aprobada${r.por.aprobada === 1 ? '' : 's'}`);
  if (r.eta) p.push(`~${r.eta} min`);
  return p.join(' · ');
}
export const costoTexto = r => (r.estimado || r.gastado ? `${r.gastado ? usd(r.gastado) : 'US$0,00'} de ${usd(r.estimado).replace('US$', '')}` : 'gratis');

/** ¿La pausa es la de «Probar con 3» (se sigue con «continuar») o una pausa del dueño, del presupuesto o de los créditos? */
export function pausaDeMuestra(lote) {
  if (lote?.estado !== 'pausado') return false;
  const por = lote.pausa?.por;
  if (por) return por === 'muestra';
  const motivo = lote.pausa?.motivo || lote.motivo || '';
  if (motivo) return /muestra|prueba|probar|probé/i.test(motivo);
  const filas = arr(lote.filas), empezadas = filas.filter(f => f.estado !== 'en_cola').length;
  return num(lote.muestra) > 0 && empezadas <= num(lote.muestra) && filas.some(f => f.estado === 'en_cola');
}
/** Los botones del lote entero, en orden. */
export function controles(lote) {
  const r = resumen(lote);
  switch (lote?.estado) {
    case 'previsto': case 'espera_ok': return [...(r.total > 3 ? ['probar'] : []), 'iniciar', 'cancelar'];
    case 'muestra': case 'corriendo': return ['pausar', 'cancelar'];
    case 'pausado': return [pausaDeMuestra(lote) ? 'continuar' : 'reanudar', 'cancelar'];
    default: return [];
  }
}
/** Lo que se puede hacer con una foto (§6.3 y §7.4). Las acciones son del servidor e idempotentes. */
export function accionesFila(fila, lote) {
  if (!fila || lote?.estado === 'cancelado') return [];
  const pre = lote?.estado === 'previsto' || lote?.estado === 'espera_ok';
  switch (fila.estado) {
    case 'en_cola': return ['omitir'];
    case 'lista': return pre ? [] : ['aprobar', 'otra', 'mas_fuerte', 'modelo'];
    case 'revisar': return ['aprobar', 'reintentar', 'mas_fuerte', 'modelo', 'omitir'];
    case 'fallo': return ['reintentar', 'modelo', 'omitir'];
    case 'aprobada': return ['otra'];
    default: return [];
  }
}
export const ACCION_ES = Object.freeze({ aprobar: 'Aprobar', otra: 'Otra versión', reintentar: 'Reintentar', mas_fuerte: 'Reintentar más fuerte', modelo: 'Cambiar de modelo', omitir: 'Omitir' });
/** El cuerpo de POST /api/media/lotes/<id>/filas para una acción de la interfaz. */
export function pedidoFila(accion, filas, { modelo } = {}) {
  const ns = arr(filas).map(Number).filter(Number.isFinite);
  if (accion === 'aprobar' || accion === 'omitir') return { accion, filas: ns };
  if (accion === 'mas_fuerte') return { accion: 'reintentar', filas: ns, mas_fuerte: true };
  if (accion === 'modelo') return { accion: 'reintentar', filas: ns, ...(modelo ? { modelo } : {}) };
  return { accion: 'reintentar', filas: ns }; // reintentar y «otra versión»
}
export function filtrar(filas, f) { return f && f !== 'todas' ? arr(filas).filter(x => grupoDe(x.estado) === f) : arr(filas); }

/** Lo que dice el agente, solo con datos reales del lote. */
export function agenteDice(lote) {
  const r = resumen(lote), filas = arr(lote?.filas), q = n => n === 1 ? 'foto' : 'fotos';
  const trabajando = filas.filter(f => grupoDe(f.estado) === 'trabajando');
  const cual = trabajando.slice(0, 3).map(f => `#${f.n}${f.sku ? ` (${f.sku})` : ''}`).join(', ');
  const motivo = lote?.pausa?.motivo || lote?.motivo || '';
  switch (lote?.estado) {
    case 'previsto': return `Preparé el plan: ${r.total} ${q(r.total)}${r.estimado ? `, unos ${usd(r.estimado)}` : ''}. No he gastado nada.`;
    case 'espera_ok': return `${lote.agent ? `Lo pidió ${lote.agent}` : lote.by === 'dimitri' ? 'Lo pidió Dimitri' : 'Lo pidió un agente'}: ${r.total} ${q(r.total)}. Espera tu OK antes de gastar.`;
    case 'muestra': return trabajando.length ? `Pruebo primero con ${Math.min(r.total, num(lote.muestra) || 3)}: trabajo en ${cual}.` : `Pruebo primero con ${Math.min(r.total, num(lote.muestra) || 3)}…`;
    case 'corriendo': return trabajando.length ? `Trabajo en ${cual}${trabajando.length > 3 ? ` y ${trabajando.length - 3} más` : ''} · ${trabajando.length} a la vez.` : 'Espero turno: el Estudio tiene otros trabajos en marcha.';
    case 'pausado': {
      if (pausaDeMuestra(lote)) { const rest = r.por.cola; return `Probé con ${r.hechas}. Revísalas y, si te gustan, sigo con ${rest === 1 ? 'la que queda' : `las ${rest} restantes`}.`; }
      return motivo ? `En pausa: ${motivo}` : 'En pausa. Nada nuevo se envía hasta que lo reanudes.';
    }
    case 'hecho': return `Terminé: ${r.por.lista + r.por.aprobada} ${r.por.lista + r.por.aprobada === 1 ? 'lista' : 'listas'}, ${r.por.revisar} para revisar, ${r.por.fallo} ${r.por.fallo === 1 ? 'falló' : 'fallaron'}.`;
    case 'cancelado': return 'Cancelado. Lo que ya estaba hecho se queda en la galería.';
    default: return '';
  }
}
/** Qué anunciar al lector de pantalla entre dos lecturas del lote: cada 10 %, cada fallo y el cambio de estado (§7.4). */
export function anuncio(prev, next) {
  if (!prev || !next || prev.id !== next.id) return null;
  const a = resumen(prev), b = resumen(next);
  if (prev.estado !== next.estado && ['hecho', 'pausado', 'cancelado'].includes(next.estado)) return agenteDice(next);
  if (b.por.fallo > a.por.fallo) {
    const antes = new Set(arr(prev.filas).filter(f => f.estado === 'fallo').map(f => f.n));
    const f = arr(next.filas).find(x => x.estado === 'fallo' && !antes.has(x.n));
    return f ? `Falló la foto #${f.n}${f.error ? `: ${f.error}` : '.'}` : `${b.por.fallo} fotos fallaron.`;
  }
  if (Math.floor(b.pct / 10) > Math.floor(a.pct / 10)) return `${b.pct} %: ${b.hechas} de ${b.total}.`;
  return null;
}
/** Una nota de la bitácora: la hora local y el texto (con su foto, si la tiene). */
export function lineaBitacora(b) {
  const d = new Date(num(b?.at)), hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
  return { hora: `${hh}:${mm}`, texto: `${b?.n != null ? `#${b.n} · ` : ''}${String(b?.t || '')}` };
}

/* ---------- crear: el borrador de los 3 pasos ---------- */
export function nuevoBorrador(origen = null) {
  return { paso: origen ? 2 : 1, nombre: '', origen, pila: [], canal: 'web', escena: null, escenaDe: 'no', idea: '', probar: null, topeUsd: '', loteId: null, firma: '' };
}
/** Cuántas fotos trae el origen. */
export function cuantas(o) {
  if (!o) return 0;
  if (o.tipo === 'carpeta') return num(o.n);
  if (o.tipo === 'hoja') return arr(o.filas).length;
  if (o.tipo === 'ejemplo') return num(o.n);
  return arr(o.files).length;
}
export const probarPorDefecto = n => n >= 10; // §6.3: «Probar con 3» viene encendido a partir de 10 fotos
export const probarActivo = b => (b.probar == null ? probarPorDefecto(cuantas(b.origen)) : !!b.probar);
const hojaConPresets = o => o?.tipo === 'hoja' && arr(o.filas).some(f => f.preset || f.pila);
/** Lo que falta para pasar de un paso al siguiente (frases para el dueño). */
export function erroresPaso(b, paso, { maxFilas = MAX_FILAS } = {}) {
  const e = [];
  if (paso === 1) {
    const n = cuantas(b.origen);
    if (!b.origen) e.push('Elige de dónde salen las fotos.');
    else if (b.origen.tipo === 'carpeta' && !b.origen.carpeta) e.push('Elige la carpeta.');
    else if (!n) e.push(b.origen.tipo === 'hoja' ? 'La hoja no tiene filas que se puedan usar.' : 'No hay ninguna foto todavía.');
    else if (n > maxFilas) e.push(`Un lote lleva hasta ${maxFilas} fotos y aquí hay ${n}. Pártelo en dos.`);
    if (b.origen?.tipo === 'hoja' && !arr(b.origen.columnas).some(c => c.campo === 'foto')) e.push('Di qué columna trae la foto.');
  }
  if (paso === 2 && !b.pila.length && !b.escena && !hojaConPresets(b.origen)) e.push('Elige al menos un preset (o un escenario 3D para toda la serie).');
  if (paso === 2 && b.topeUsd !== '' && !(num(b.topeUsd) > 0)) e.push('El tope del lote es un importe en US$ mayor que 0, o vacío.');
  return e;
}
function origenPedido(o) {
  if (!o) return null;
  if (o.tipo === 'carpeta') return { tipo: 'carpeta', carpeta: o.carpeta };
  if (o.tipo === 'hoja') return { tipo: 'hoja', nombre: o.nombre || '', filas: arr(o.filas), columnas: arr(o.columnas), ...(arr(o.files).length ? { fotos: o.files } : {}) };
  if (o.tipo === 'ejemplo') return { tipo: 'ejemplo', n: num(o.n) };
  return { tipo: o.tipo, files: arr(o.files) };
}
export function nombrePorDefecto(b) {
  const o = b.origen, base = o?.tipo === 'carpeta' ? o.nombre || 'Carpeta' : o?.tipo === 'hoja' ? (o.nombre || 'Hoja').replace(/\.(xlsx|xls|csv)$/i, '') : o?.tipo === 'seleccion' ? 'Seleccionadas' : o?.tipo === 'subidas' ? 'Subidas' : 'Lote';
  return b.canal ? `${base} → ${b.canal}` : base;
}
/** El cuerpo de POST /api/media/lotes (crea el lote «previsto» con su vista previa; no gasta). */
export function pedidoLote(b) {
  const tope = num(b.topeUsd);
  return {
    nombre: (b.nombre || '').trim() || nombrePorDefecto(b), by: 'you', origen: origenPedido(b.origen),
    receta: { pila: b.pila.map(x => ({ id: x.id, ...(x.params && Object.keys(x.params).length ? { params: x.params } : {}) })), canal: b.canal || null, ...(b.escena ? { escena: b.escena } : {}), ...((b.idea || '').trim() ? { idea: b.idea.trim() } : {}) },
    muestra: probarActivo(b) ? 3 : 0, qa: 'auto', ...(tope > 0 ? { tope: { usd: tope } } : {}),
  };
}
/** La vista previa del lote previsto (§6.3 prever), leída con tolerancia. */
export function previaDe(l) {
  const p = l?.previa || l?.vista || {}, total = num(p.total ?? l?.total) || arr(l?.filas).length;
  const costo = num(p.costo ?? l?.costo?.estimado), cabe = p.cabe || l?.cabe || {};
  const no = k => cabe[k] === false;
  return {
    filas: arr(p.filas || l?.filas).slice(0, 5), total, costo,
    muestraCosto: p.muestraCosto != null ? num(p.muestraCosto) : (total ? costo * Math.min(3, total) / total : 0),
    cabe: cabe.ok !== false && !no('dia') && !no('mes') && !no('lote'), cabeMuestra: cabe.muestra !== false && cabe.ok !== false,
    motivo: cabe.motivo || (no('dia') ? 'No cabe en el tope de hoy del Estudio.' : no('mes') ? 'No cabe en el tope del mes del Estudio.' : no('lote') ? 'Pasa del tope de este lote.' : null),
    quedaHoy: p.quedaHoy ?? cabe.quedaHoy ?? null, modelo: p.modeloNombre || p.modelo || l?.receta?.modelo || null, porque: p.porque || '', avisos: arr(p.avisos), errores: arr(p.errores),
  };
}
/** Las columnas que devuelve /api/media/lotes/hoja → [{ nombre, campo }] (acepta lista o mapa). */
export function columnasDe(c) {
  if (Array.isArray(c)) return c.map(x => (typeof x === 'string' ? { nombre: x, campo: '' } : { nombre: String(x.nombre ?? x.col ?? x.header ?? x.titulo ?? ''), campo: x.campo || '' }));
  if (c && typeof c === 'object') {
    const campos = new Set(CAMPOS.map(x => x[0]).filter(Boolean)), ks = Object.keys(c);
    return ks.every(k => campos.has(k)) ? ks.map(k => ({ nombre: String(c[k]), campo: k })) : ks.map(k => ({ nombre: k, campo: String(c[k] || '') }));
  }
  return [];
}

/* ---------- la demo: un lote de mentira en memoria, con el motor «prueba» (§7.4 «Pruebas de pantalla») ---------- */
function fotoDemo(i, despues) {
  const h = (i * 47) % 360, fondo = despues ? '#FFFFFF' : `hsl(${h},12%,38%)`, piso = despues ? '#F4F4F4' : `hsl(${h},10%,30%)`, cama = `hsl(${(h + 30) % 360},35%,${despues ? 62 : 48}%)`;
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${fondo}"/><rect y="130" width="200" height="70" fill="${piso}"/>${despues ? '<ellipse cx="100" cy="146" rx="62" ry="6" fill="#00000018"/>' : `<rect x="${12 + i % 3 * 6}" y="40" width="30" height="60" fill="hsl(${h},8%,52%)"/>`}<rect x="${despues ? 40 : 30 + i % 4 * 6}" y="${despues ? 104 : 96}" width="120" height="${despues ? 40 : 44}" rx="6" fill="${cama}"/><rect x="${despues ? 40 : 30 + i % 4 * 6}" y="${despues ? 86 : 78}" width="20" height="58" rx="4" fill="${cama}"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(s);
}
/** Un servidor de lotes en memoria con las rutas de §6.4. Cada lectura de un lote vivo avanza un paso. */
export function crearDemo({ costo = 0, concurrencia = 2, now = () => Date.now() } = {}) {
  const lotes = new Map(); let seq = 0;
  const nota = (l, t, n) => l.bitacora.push({ at: now(), ...(n != null ? { n } : {}), t });
  const gastado = l => +(l.filas.filter(f => f.out || f.estado === 'fallo').reduce((s, f) => s + costo * f.intentos, 0)).toFixed(4);
  function avanzar(l) {
    if (!ACTIVOS.includes(l.estado)) return;
    for (const f of l.filas.filter(x => x.estado === 'verificando')) {
      f.out = fotoDemo(f.n, true);
      if (f.n % 7 === 0 && f.intentos === 1) { f.estado = 'fallo'; f.out = null; f.error = 'El motor de prueba devolvió un error a propósito (fila múltiplo de 7).'; nota(l, `Falló: ${f.error} La dejo para que decidas.`, f.n); }
      else if (f.n % 5 === 0 && f.intentos === 1) { f.estado = 'revisar'; f.medido = { ocupacion: 0.52, fondoBorde: 0.97 }; f.error = 'El producto ocupa el 52 %, no el 60 % pedido.'; nota(l, 'El producto quedó al 52 %, no al 60 %. La pongo para revisar.', f.n); }
      else { f.estado = 'lista'; f.medido = { ocupacion: 0.6, fondoBorde: 0.998 }; f.error = null; nota(l, 'Lista: fondo 255 y producto al 60 %.', f.n); }
    }
    for (const f of l.filas.filter(x => x.estado === 'editando')) f.estado = 'verificando';
    const tope = l.estado === 'muestra' ? l.muestra : Infinity, iniciadas = () => l.filas.filter(f => f.estado !== 'en_cola' && f.estado !== 'omitida').length;
    let libres = Math.max(0, concurrencia - l.filas.filter(f => f.estado === 'editando' || f.estado === 'verificando').length);
    for (const f of l.filas) {
      if (!libres || iniciadas() >= tope) break;
      if (f.estado === 'en_cola') { f.estado = 'editando'; f.intentos++; libres--; nota(l, `Empiezo con ${f.nombre || 'la foto'}.`, f.n); }
    }
    l.costo.gastado = gastado(l);
    const vivas = l.filas.some(f => ['editando', 'verificando'].includes(f.estado));
    if (!vivas && l.estado === 'muestra') { l.estado = 'pausado'; l.pausa = { por: 'muestra', motivo: 'Probé con 3: revísalas antes de seguir.' }; nota(l, 'Probé con 3. Espero a que las revises antes de seguir con el resto.'); }
    else if (!vivas && !l.filas.some(f => f.estado === 'en_cola')) { l.estado = 'hecho'; l.fin = now(); const r = resumen(l); nota(l, `Lote terminado: ${r.por.lista + r.por.aprobada} listas, ${r.por.revisar} para revisar, ${r.por.fallo} falló.`); }
  }
  const copia = l => JSON.parse(JSON.stringify(l));
  const err = (msg, status = 400) => { const e = new Error(msg); e.status = status; throw e; };
  return async function api(method, url, body = {}) {
    const u = new URL(url, 'http://demo'), p = u.pathname.replace(/^\/api\/media\/lotes\/?/, '').split('/').filter(Boolean);
    if (!u.pathname.startsWith('/api/media/lotes')) err('La demo solo conoce los lotes.', 404);
    if (p[0] === 'hoja') err('En la demo no se leen hojas de cálculo: abre la oficina con el iniciador.');
    if (method === 'GET' && !p.length) return { lotes: [...lotes.values()].reverse().map(copia) };
    if (method === 'POST' && !p.length) {
      const o = body.origen || {}, n = Math.min(MAX_FILAS, o.tipo === 'ejemplo' ? num(o.n) || 12 : o.tipo === 'hoja' ? arr(o.filas).length : o.tipo === 'carpeta' ? 12 : arr(o.files).length);
      if (!n) err('No hay fotos en ese origen.');
      const id = 'Ldemo' + (++seq), filas = Array.from({ length: n }, (_, i) => ({ n: i + 1, src: fotoDemo(i + 1, false), sku: `CM-${140 + i}`, nombre: `Cama de ejemplo ${i + 1}`, notas: '', estado: 'en_cola', out: null, intentos: 0, error: null, medido: null }));
      const est = +(costo * n).toFixed(4);
      const l = { id, nombre: body.nombre || 'Lote de ejemplo', by: body.by || 'you', receta: { ...(body.receta || {}), modelo: 'prueba' }, estado: 'previsto', muestra: num(body.muestra), concurrencia, tope: body.tope || null, qa: 'auto', costo: { estimado: est, gastado: 0 }, filas, bitacora: [], creado: now(), inicio: 0, fin: 0, demo: true,
        previa: { total: n, costo: est, muestraCosto: +(costo * Math.min(3, n)).toFixed(4), modelo: costo ? 'Prueba (con un precio de ejemplo)' : 'Prueba (gratis, en esta máquina)', porque: 'en la demo no hay motores de pago', cabe: { ok: true }, quedaHoy: null, avisos: ['Es la demo: el motor «prueba» no cambia de verdad tus fotos.'],
          filas: filas.slice(0, 5).map(f => ({ n: f.n, src: f.src, nombre: f.nombre, sku: f.sku, modelo: 'Prueba', costo, avisos: [] })) } };
      nota(l, `Preparé el plan para ${n} fotos. No he gastado nada.`);
      lotes.set(id, l); return { lote: copia(l) };
    }
    const l = lotes.get(p[0]); if (!l) err('Ese lote ya no existe.', 404);
    if (method === 'GET' && p.length === 1) { avanzar(l); return { lote: copia(l) }; }
    if (method === 'GET' && (p[1] === 'zip' || p[1] === 'csv')) err('En la demo no se descarga nada: abre la oficina.');
    if (method === 'PATCH' && p.length === 1) {
      const a = body.accion;
      if (a === 'probar' && ['previsto', 'espera_ok'].includes(l.estado)) { l.muestra = Math.min(3, l.filas.length); l.estado = 'muestra'; l.inicio ||= now(); nota(l, 'Pruebo primero con 3 fotos.'); }
      else if (a === 'iniciar' && ['previsto', 'espera_ok'].includes(l.estado)) { l.estado = 'corriendo'; l.inicio ||= now(); nota(l, `Empiezo con las ${l.filas.length} fotos, ${concurrencia} a la vez.`); }
      else if ((a === 'continuar' || a === 'reanudar') && l.estado === 'pausado') { l.estado = 'corriendo'; l.pausa = null; nota(l, a === 'continuar' ? 'Sigo con el resto.' : 'Reanudo.'); }
      else if (a === 'pausar' && ACTIVOS.includes(l.estado)) { l.estado = 'pausado'; l.pausa = { por: 'dueño', motivo: 'la pausaste tú. Lo que ya estaba en marcha termina; nada nuevo sale.' }; nota(l, 'Pausado por ti.'); }
      else if (a === 'cancelar' && !['hecho', 'cancelado'].includes(l.estado)) { l.estado = 'cancelado'; l.filas.forEach(f => { if (f.estado === 'en_cola') f.estado = 'omitida'; }); nota(l, 'Cancelado.'); }
      return { lote: copia(l) };
    }
    if (method === 'POST' && p[1] === 'filas') {
      const ns = new Set(arr(body.filas));
      for (const f of l.filas.filter(x => ns.has(x.n))) {
        if (body.accion === 'aprobar' && ['lista', 'revisar'].includes(f.estado)) { f.estado = 'aprobada'; nota(l, 'Aprobada por ti.', f.n); }
        else if (body.accion === 'omitir' && ['en_cola', 'revisar', 'fallo'].includes(f.estado)) { f.estado = 'omitida'; nota(l, 'Omitida.', f.n); }
        else if (body.accion === 'reintentar' && ['lista', 'revisar', 'fallo', 'aprobada'].includes(f.estado)) { f.estado = 'en_cola'; f.error = null; nota(l, body.mas_fuerte ? 'La repito más fuerte.' : body.modelo ? `La repito con ${body.modelo}.` : 'La repito.', f.n); if (['hecho', 'pausado'].includes(l.estado) && !pausaDeMuestra(l)) l.estado = 'corriendo'; }
      }
      return { lote: copia(l) };
    }
    err('Esa acción no existe.', 404);
  };
}

/* ---------- la interfaz ---------- */
const ICO = {
  volver: 'M15 6l-6 6 6 6', pausa: 'M8 5v14M16 5v14', play: 'M7 5l12 7-12 7z', bajar: 'M12 4v11M7 10l5 5 5-5M5 20h14', mas: 'M5 12h.01M12 12h.01M19 12h.01',
  lote: 'M4 7h12v12H4zM8 4h12v12', hoja: 'M5 3h10l4 4v14H5zM9 11h6M9 15h6', carpeta: 'M3 7h6l2 2h10v10H3z', subir: 'M12 20V9M7 13l5-5 5 5M5 4h14', sel: 'M4 4h7v7H4zM13 13h7v7h-7zM14 5l2 2 4-4',
};
const svg = (d, t = 16) => iconoSVG(d, { tam: t });
let uid = 0;

export function initLotes(host, ctx = {}) {
  const id = 'lt' + (++uid), esc = ctx.esc || escHTML, live = () => (typeof ctx.live === 'function' ? !!ctx.live() : false);
  const demo = crearDemo({ costo: ctx.demoCosto || 0 });
  const api = (m, u, b) => (live() && ctx.api ? ctx.api(m, u, b) : demo(m, u, b));
  const say = (t, bad) => ctx.say?.(t, bad);
  const img = f => (!f ? '' : /^(data:|https?:|blob:|\/)/.test(f) ? f : ctx.src ? ctx.src(f) : '/media/' + encodeURI(f));
  let vista = { v: 'lista' }, lotes = [], lote = null, b = nuevoBorrador(), filtro = 'todas', ab = new Map(), errs = [], ocupado = false, fab = ctx.fabrica || null, presets = [], q = '', editor = null, timer = null, previa = null, hojaMsg = '';

  const el = document.createElement('section'); el.className = 'lt'; el.setAttribute('aria-labelledby', id + 'T');
  el.innerHTML = `<p class="lt-vh" aria-live="polite" data-vivo></p><div class="lt-cuerpo"></div>
    <input type="file" hidden multiple accept="image/png,image/jpeg,image/webp" data-in="fotos"><input type="file" hidden accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" data-in="hoja">`;
  host.appendChild(el);
  const cuerpo = el.querySelector('.lt-cuerpo'), vivo = el.querySelector('[data-vivo]');
  const anunciar = t => { if (!t) return; vivo.textContent = ''; setTimeout(() => { vivo.textContent = t; }, 30); };
  const foco = sel => setTimeout(() => el.querySelector(sel)?.focus({ preventScroll: false }), 0);
  const avisar = () => ctx.onCambio?.({ activos: lotes.filter(l => ACTIVOS.includes(l.estado)).length, revisar: lotes.reduce((s, l) => s + resumen(l).por.revisar, 0), espera: lotes.filter(l => l.estado === 'espera_ok').length });

  /* --- la lista --- */
  function pintarLista() {
    const orden = [...lotes].sort((x, y) => (ACTIVOS.includes(y.estado) - ACTIVOS.includes(x.estado)) || num(y.creado) - num(x.creado));
    cuerpo.innerHTML = `<header class="lt-hd"><h2 id="${id}T" tabindex="-1">${svg(ICO.lote, 18)} Lotes</h2><button type="button" class="lt-pri" data-nuevo>+ Nuevo lote</button></header>
      <p class="lt-sub">Muchas fotos con la misma receta. Primero ves el plan y el costo; nada se gasta hasta que pulses PROBAR o GENERAR.</p>
      ${orden.length ? `<ul class="lt-lista" role="list">${orden.map(l => { const r = resumen(l); return `<li><button type="button" class="lt-item" data-ver="${esc(l.id)}">
        <span class="lt-in"><b>${esc(l.nombre || 'Lote')}</b><span class="lt-est lt-l-${esc(l.estado)}">${esc(ESTADO_LOTE[l.estado] || l.estado)}</span></span>
        <span class="lt-barra" aria-hidden="true"><span style="width:${r.pct}%"></span></span>
        <small>${esc(lineaCifras(r))} · ${esc(costoTexto(r))}${l.by && l.by !== 'you' ? ` · pedido por ${esc(l.agent || l.by)}` : ''}</small></button></li>`; }).join('')}</ul>`
      : `<div class="lt-vacio"><p><b>Todavía no hay lotes.</b></p><p>Elige las fotos (una carpeta, las seleccionadas, súbelas o trae un Excel), la receta y el canal. Verás las 5 primeras y el costo antes de gastar nada.</p></div>`}`;
  }
  async function cargarLista() { try { const r = await api('GET', '/api/media/lotes'); lotes = arr(r.lotes); avisar(); } catch (e) { say(e.message, true); } if (vista.v === 'lista') pintarLista(); }

  /* --- crear --- */
  const PASOS = ['Fotos', 'Receta', 'Revisar y lanzar'];
  function pintarCrear() {
    const n = cuantas(b.origen);
    cuerpo.innerHTML = `<header class="lt-hd"><button type="button" class="lt-ic" data-volver aria-label="Volver a los lotes">${svg(ICO.volver)}</button><h2 id="${id}T" tabindex="-1">Nuevo lote${n ? ` · ${n} ${n === 1 ? 'foto' : 'fotos'}` : ''}</h2></header>
      <ol class="lt-pasos">${PASOS.map((t, i) => { const k = i + 1; return `<li${k === b.paso ? ' aria-current="step"' : ''}>${k < b.paso ? `<button type="button" data-paso="${k}"><span class="lt-pn">${k}</span>${t}<span class="lt-vh"> (hecho; volver)</span></button>` : `<span><span class="lt-pn">${k}</span>${t}</span>`}</li>`; }).join('')}</ol>
      <div class="lt-paso">${b.paso === 1 ? paso1() : b.paso === 2 ? paso2() : paso3()}</div>
      <p class="lt-err" role="alert">${errs.map(esc).join(' ')}</p>
      ${b.paso < 3 ? `<footer class="lt-pie">${b.paso > 1 ? '<button type="button" class="lt-sec" data-atras>Atrás</button>' : ''}<button type="button" class="lt-pri" data-sig>${b.paso === 2 ? 'Ver el plan y el costo' : 'Siguiente'}</button></footer>` : ''}`;
    if (b.paso === 2 && b.escenaDe === 'nueva') montarEditor();
  }
  function opcion(tipo, titulo, ico, ayuda, cuerpoHTML) {
    const on = b.origen?.tipo === tipo;
    return `<label class="lt-op${on ? ' on' : ''}"><input type="radio" name="${id}o" value="${tipo}"${on ? ' checked' : ''}><span class="lt-opt">${svg(ico, 18)}<span><b>${titulo}</b><small>${ayuda}</small></span></span></label>${on && cuerpoHTML ? `<div class="lt-opb">${cuerpoHTML}</div>` : ''}`;
  }
  function paso1() {
    const carpetas = arr(ctx.carpetas?.()), sel = arr(ctx.seleccion?.()), o = b.origen || {};
    const hoja = o.tipo === 'hoja' ? `${o.filas ? `<p class="lt-ok">${esc(o.nombre)}: ${arr(o.filas).length} filas${arr(o.filas).filter(f => !f.foto && !f.src).length ? ` · ${arr(o.filas).filter(f => !f.foto && !f.src).length} sin foto (quedan en «Revisar» y no gastan)` : ''}.</p>
        <fieldset class="lt-cols"><legend>Columnas (corrígelas si hace falta)</legend>${arr(o.columnas).map((c, i) => `<label><span>${esc(c.nombre)}</span><select data-col="${i}">${CAMPOS.map(([v, t]) => `<option value="${v}"${c.campo === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`).join('')}</fieldset>
        ${arr(o.avisos).length ? `<ul class="lt-avisos">${arr(o.avisos).map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
        <p class="lt-ayuda">¿Las fotos van aparte? Súbelas y se emparejan por el nombre del archivo. <button type="button" class="lt-sec" data-subir="hoja">Subir las fotos${arr(o.files).length ? ` (${arr(o.files).length})` : ''}</button></p>` : ''}
        <button type="button" class="lt-sec" data-elegir="hoja">${o.filas ? 'Elegir otra hoja' : 'Elegir el Excel o CSV'}</button>${hojaMsg ? `<p class="lt-ayuda" role="status">${esc(hojaMsg)}</p>` : ''}
        <p class="lt-ayuda">Columnas que entiende: foto, sku, nombre, preset, canal, encuadre y notas. Nunca rutas del disco (C:\\…): las fotos van incrustadas, por nombre o por su id de la galería.</p>` : '';
    return `<label class="lt-campo"><span>Nombre del lote <small>opcional</small></span><input type="text" data-nombre value="${esc(b.nombre)}" placeholder="${esc(b.origen ? nombrePorDefecto(b) : 'Camas bodega → web')}" maxlength="80"></label>
      <fieldset class="lt-ops"><legend>¿Qué fotos?</legend>
      ${opcion('carpeta', 'Una carpeta de la galería', ICO.carpeta, carpetas.length ? 'Todas las fotos de esa carpeta' : 'Aún no tienes carpetas en la galería',
        `<label class="lt-campo"><span>Carpeta</span><select data-carpeta><option value="">Elige…</option>${carpetas.map(c => `<option value="${esc(c.id)}"${o.carpeta === c.id ? ' selected' : ''}>${esc(c.name || c.nombre)} (${num(c.n)})</option>`).join('')}</select></label>`)}
      ${opcion('seleccion', `Las seleccionadas${sel.length ? ` (${sel.length})` : ''}`, ICO.sel, sel.length ? 'Las que marcaste en la galería' : 'Ahora no hay ninguna marcada: márcalas en la galería y vuelve', '')}
      ${opcion('subidas', 'Subir fotos', ICO.subir, 'Van a una carpeta nueva «Lote de hoy»', `<button type="button" class="lt-sec" data-subir="fotos">${arr(o.files).length ? `Añadir más (${arr(o.files).length} subidas)` : 'Elegir las fotos'}</button>`)}
      ${opcion('hoja', 'Un Excel o CSV', ICO.hoja, 'Una fila por foto, con su SKU, nombre y notas', hoja)}
      ${!live() ? opcion('ejemplo', 'Fotos de ejemplo (demo)', ICO.lote, '12 camas de mentira para ver cómo funciona', '') : ''}
      </fieldset>`;
  }
  const canalNombre = c => (fab?.canales || []).find(x => x.id === c)?.nombre || c;
  function paso2() {
    const byId = new Map(presets.map(p => [p.id, p])), comp = ctx.compositor?.(), n = cuantas(b.origen);
    const hits = (q ? buscar(q, presets, { medio: 'image', modo: 'foto', max: 8 }) : buscar('', presets.filter(p => p.estrella), { medio: 'image', modo: 'foto', max: 8 })).map(h => byId.get(h.id)).filter(Boolean);
    const canales = fab?.canales || [], cP = canales.filter(c => c.grupo === 'panama'), cO = canales.filter(c => c.grupo !== 'panama');
    const e = b.escena ? E3.normalizar(b.escena) : null, oc = e ? E3.ocupacionEstimada(e) : null;
    return `${comp && (arr(comp.pila).length || comp.escena) ? `<p class="lt-comp"><button type="button" class="lt-sec" data-comp>Usar lo del compositor</button> <small>${arr(comp.pila).length} preset${arr(comp.pila).length === 1 ? '' : 's'}${comp.canal ? ` · ${esc(canalNombre(comp.canal))}` : ''}${comp.escena ? ' · con escenario 3D' : ''}</small></p>` : ''}
      <section class="lt-sec2" aria-labelledby="${id}r"><h3 id="${id}r">La receta, para todas</h3>
      ${b.pila.length ? `<ol class="lt-pila">${b.pila.map((x, i) => { const p = byId.get(x.id); return `<li><span class="lt-pi">${p ? iconoSVG(p.icono, { tam: 16, iconos: fab?.iconos || {} }) : ''}</span><span><b>${esc(p?.nombre || x.id)}</b><small>${p ? esc(marca(p)) : 'preset que esta oficina no tiene'}</small></span><button type="button" class="lt-x" data-unpila="${i}" aria-label="Quitar ${esc(p?.nombre || x.id)}">✕</button></li>`; }).join('')}</ol>` : `<p class="lt-ayuda">Ningún preset todavía.${hojaConPresets(b.origen) ? ' Tu hoja ya trae un preset por fila: lo de aquí se suma a todas.' : ''}</p>`}
      <label class="lt-campo"><span>Añadir un preset</span><input type="search" data-q value="${esc(q)}" placeholder="«fondo blanco», «más luz», «catálogo»…" autocomplete="off"></label>
      <p class="lt-vh" aria-live="polite">${hits.length} resultado${hits.length === 1 ? '' : 's'}</p>
      ${presets.length ? (hits.length ? `<ul class="lt-res">${hits.map(p => { const ya = b.pila.some(x => x.id === p.id); return `<li><button type="button" data-add="${esc(p.id)}" aria-pressed="${ya}"><span class="lt-pi">${iconoSVG(p.icono, { tam: 18, iconos: fab?.iconos || {} })}</span><span><b>${esc(p.nombre)}</b><small>${esc(marca(p))}</small></span><span class="lt-mas" aria-hidden="true">${ya ? '✓' : '+'}</span></button></li>`; }).join('')}</ul>` : `<p class="lt-ayuda">Nada con «${esc(q)}». Prueba con otras palabras.</p>`) : '<p class="lt-ayuda">Cargando los presets…</p>'}
      </section>
      <section class="lt-sec2" aria-labelledby="${id}c"><h3 id="${id}c">Para dónde</h3>
      <div class="lt-chips" role="group" aria-label="Canal">${cP.map(c => `<button type="button" data-canal="${esc(c.id)}" aria-pressed="${b.canal === c.id}">${esc(c.nombre)}</button>`).join('')}${cO.length ? `<select data-canalo aria-label="Otras tiendas"><option value="">Otras tiendas…</option>${cO.map(c => `<option value="${esc(c.id)}"${b.canal === c.id ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select>` : ''}<button type="button" data-canal="" aria-pressed="${!b.canal}">Sin canal</button></div></section>
      <section class="lt-sec2" aria-labelledby="${id}e"><h3 id="${id}e">Escenario 3D <small>la misma escena para toda la serie: cada producto sale a su escala</small></h3>
      <div class="lt-chips" role="radiogroup" aria-label="Escenario">${[['no', 'Sin escenario'], ...(comp?.escena ? [['compositor', 'El del compositor']] : []), ['nueva', b.escena && b.escenaDe === 'nueva' ? 'Editar el de este lote' : 'Uno para este lote']].map(([v, t]) => `<button type="button" role="radio" data-esc="${v}" aria-checked="${b.escenaDe === v}">${t}</button>`).join('')}</div>
      ${e ? `<p class="lt-escl">${esc(E3.fraseAngulo(E3.anguloRelativo(e)).corto)} · ${esc(E3.fraseInclinacion(E3.inclinacion(e)).corto)} · a ${esc(E3.formatoDistancia(e.camara.distancia))} con ${e.camara.lente} mm · ocupa ~${Math.round(oc.max * 100)} % · ${esc(e.cuadro.proporcion)}</p>` : ''}
      <div class="lt-e3d"${b.escenaDe === 'nueva' ? '' : ' hidden'}></div></section>
      <section class="lt-sec2" aria-labelledby="${id}m"><h3 id="${id}m">Antes de gastar</h3>
      <label class="lt-campo"><span>Algo más, para todas <small>opcional</small></span><textarea data-idea rows="2" maxlength="400" placeholder="p. ej. «la madera se ve más cálida»">${esc(b.idea)}</textarea></label>
      <label class="lt-check"><input type="checkbox" data-probar${probarActivo(b) ? ' checked' : ''}><span><b>Probar primero con 3</b><small>${n >= 10 ? 'Recomendado con 10 fotos o más: ves 3 y decides si sigue.' : 'Corre 3 y se para para que las revises.'}</small></span></label>
      <label class="lt-campo lt-tope"><span>Tope de este lote <small>US$, opcional; al llegar, se pausa</small></span><input type="number" data-tope min="0" step="0.5" inputmode="decimal" value="${esc(b.topeUsd)}"></label></section>`;
  }
  function paso3() {
    if (!previa) return `<p class="lt-ayuda" role="status">${ocupado ? 'Preparo el plan (no gasta nada)…' : 'No pude preparar el plan.'}</p>`;
    const p = previa, n = p.total, rec = probarActivo(b) && n > 3, byId = new Map(presets.map(x => [x.id, x]));
    return `<dl class="lt-plan"><div><dt>Fotos</dt><dd>${n}</dd></div><div><dt>Receta</dt><dd>${b.pila.map(x => esc(byId.get(x.id)?.nombre || x.id)).join(' + ') || 'la de cada fila'}${b.escena ? ' · escenario 3D' : ''}</dd></div>
      <div><dt>Canal</dt><dd>${b.canal ? esc(canalNombre(b.canal)) : 'ninguno'}</dd></div><div><dt>Modelo</dt><dd>${esc(p.modelo || 'el que elija el banco')}${p.porque ? ` <small>porque ${esc(p.porque)}</small>` : ''}</dd></div>
      <div><dt>Costo</dt><dd><b>${usd(p.costo)}</b>${p.quedaHoy != null ? ` <small>· hoy te quedan ${usd(p.quedaHoy)} en el Estudio</small>` : ''}</dd></div></dl>
      ${p.errores.length ? `<ul class="lt-avisos lt-mal">${p.errores.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}${p.avisos.length ? `<ul class="lt-avisos">${p.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      <h3 class="lt-h3">Las ${Math.min(5, p.filas.length)} primeras</h3>
      <ul class="lt-prev">${p.filas.map(f => `<li>${f.src ? `<img src="${esc(img(f.src))}" alt="" loading="lazy">` : '<span class="lt-sinfoto">sin foto</span>'}<span><b>#${esc(f.n)} ${esc(f.nombre || '')}</b><small>${[f.sku, f.modelo, f.costo != null ? usd(f.costo) : ''].filter(Boolean).map(esc).join(' · ')}</small>${arr(f.avisos).map(a => `<small class="lt-av">${esc(a)}</small>`).join('')}${f.prompt ? `<details><summary>Ver el prompt</summary><pre>${esc(f.prompt)}</pre></details>` : ''}</span></li>`).join('')}</ul>
      ${!p.cabe ? `<p class="lt-mal" role="status">${esc(p.motivo || 'No cabe en los topes del Estudio.')} Sube el tope en Ajustes → Estudio o haz menos fotos.</p>` : ''}
      <footer class="lt-pie lt-lanzar"><button type="button" class="lt-sec" data-atras>Atrás</button><button type="button" class="lt-sec" data-descartar>Descartar</button>
        ${n > 3 ? `<button type="button" class="${rec ? 'lt-pri' : 'lt-sec'}" data-lanzar="probar"${p.cabeMuestra && !p.errores.length ? '' : ' disabled'}>PROBAR CON 3 · ${usd(p.muestraCosto)}</button>` : ''}
        <button type="button" class="${rec ? 'lt-sec' : 'lt-pri'}" data-lanzar="iniciar"${p.cabe && !p.errores.length ? '' : ' disabled'}>GENERAR TODAS · ${usd(p.costo)}</button></footer>`;
  }
  function montarEditor() {
    const box = cuerpo.querySelector('.lt-e3d'); if (!box) return;
    editor?.destroy?.(); editor = null;
    try { editor = initEscena3d(box, { value: b.escena || E3.ESCENA_DEFECTO, onChange: e => { b.escena = e; const l = cuerpo.querySelector('.lt-escl'); if (l) { const n = E3.normalizar(e); l.textContent = `${E3.fraseAngulo(E3.anguloRelativo(n)).corto} · ${E3.fraseInclinacion(E3.inclinacion(n)).corto} · a ${E3.formatoDistancia(n.camara.distancia)} con ${n.camara.lente} mm · ocupa ~${Math.round(E3.ocupacionEstimada(n).max * 100)} % · ${n.cuadro.proporcion}`; } } }); if (!b.escena) b.escena = editor.get?.() || E3.normalizar(E3.ESCENA_DEFECTO); }
    catch { box.innerHTML = '<p class="lt-ayuda">El editor 3D no se pudo abrir en este navegador; el lote usa la escena de siempre.</p>'; b.escena ||= E3.normalizar(E3.ESCENA_DEFECTO); }
  }
  async function cargarPresets() {
    if (presets.length) return;
    try {
      if (ctx.presets) presets = arr(typeof ctx.presets === 'function' ? await ctx.presets() : ctx.presets);
      else if (live()) { const r = await ctx.api('GET', '/api/media/presets?medio=image&modo=foto'); presets = arr(r.presets); fab = { ...(fab || {}), ...(r.fabrica || {}) }; }
      else { const f = await cargarFabricaDemo(); if (f) { fab = f; presets = arr(f.presets); } }
      if (fab?.presets && !presets.length) presets = arr(fab.presets);
      presets = presets.filter(p => arr(p.medios).includes('image'));
    } catch { /* sin presets: el paso 2 lo dice */ }
    if (vista.v === 'crear' && b.paso === 2) pintarConFoco();
  }
  async function aPaso(k) {
    errs = k > b.paso ? erroresPaso(b, b.paso) : [];
    if (errs.length) { pintarCrear(); return; }
    editor?.destroy?.(); editor = null;
    b.paso = k; pintarCrear(); foco(`#${id}T`);
    if (k === 2) cargarPresets();
    if (k === 3) await prever();
  }
  async function prever() {
    const pedido = pedidoLote(b), firma = JSON.stringify(pedido);
    if (b.loteId && firma === b.firma && previa) { pintarCrear(); return; }
    if (b.loteId) { api('PATCH', `/api/media/lotes/${encodeURIComponent(b.loteId)}`, { accion: 'cancelar' }).catch(() => {}); b.loteId = null; }
    previa = null; ocupado = true; pintarCrear();
    try { const r = await api('POST', '/api/media/lotes', pedido); const l = r.lote || r; b.loteId = l.id; b.firma = firma; previa = previaDe(l); }
    catch (e) { errs = [e.message]; }
    ocupado = false; if (vista.v === 'crear' && b.paso === 3) pintarCrear();
  }
  async function lanzar(accion) {
    if (!b.loteId || ocupado) return;
    ocupado = true; cuerpo.querySelectorAll('[data-lanzar]').forEach(x => { x.disabled = true; });
    try { const r = await api('PATCH', `/api/media/lotes/${encodeURIComponent(b.loteId)}`, { accion }); const l = r.lote || r; const idL = l.id || b.loteId; b = nuevoBorrador(); previa = null; ocupado = false; say(accion === 'probar' ? 'Pruebo con 3. Te aviso al terminar.' : 'Lote en marcha. Puedes seguir con otras cosas.'); seguir(idL, l); }
    catch (e) { ocupado = false; errs = [e.message]; pintarCrear(); }
  }
  async function leerHoja(f) {
    if (!live()) { hojaMsg = 'En la demo no se leen hojas de cálculo: abre la oficina con el iniciador.'; pintarConFoco(); return; }
    hojaMsg = `Leo ${f.name}…`; pintarConFoco();
    try {
      const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(new Error('No pude leer el archivo.')); fr.readAsDataURL(f); });
      b.origen = { tipo: 'hoja', nombre: f.name, data };
      await releerHoja();
    } catch (e) { hojaMsg = e.message; pintarConFoco(); }
  }
  async function releerHoja(columnas) {
    const o = b.origen; if (!o?.data) return;
    try { const r = await ctx.api('POST', '/api/media/lotes/hoja', { name: o.nombre, data: o.data, ...(columnas ? { columnas } : {}) }); o.filas = arr(r.filas); o.columnas = columnasDe(r.columnas); o.avisos = arr(r.avisos); hojaMsg = ''; }
    catch (e) { hojaMsg = e.message; }
    pintarConFoco();
  }

  /* --- seguir --- */
  function filaHTML(f) {
    const est = ESTADO_FILA[f.estado] || ESTADO_FILA.en_cola, acc = accionesFila(f, lote), modelos = arr(ctx.modelos?.());
    const lado = f.out ? (ab.get(f.n) || 'despues') : 'antes', ver = lado === 'despues' ? f.out : f.src;
    const prim = acc.filter(a => a === 'aprobar' || a === 'reintentar').slice(0, 1);
    const med = f.medido?.ocupacion != null ? `ocupa ${Math.round(f.medido.ocupacion * 100)} %` : '';
    return `<li class="lt-fila lt-g-${est.grupo}" data-n="${esc(f.n)}">
      <div class="lt-img">${ver ? `<button type="button" class="lt-ver" data-abrir="${esc(f.n)}" aria-label="Ampliar la foto #${esc(f.n)} (${lado === 'despues' ? 'después' : 'antes'})"><img src="${esc(img(ver))}" alt="" loading="lazy"></button>` : '<span class="lt-sinfoto">sin foto</span>'}
        ${f.out ? `<div class="lt-ab" role="group" aria-label="Ver la foto #${esc(f.n)}"><button type="button" data-ab="antes" aria-pressed="${lado === 'antes'}">Antes</button><button type="button" data-ab="despues" aria-pressed="${lado === 'despues'}">Después</button></div>` : ''}</div>
      <div class="lt-fb"><p class="lt-ft"><b>#${esc(f.n)}${f.nombre ? ` · ${esc(f.nombre)}` : ''}</b>${f.sku ? `<small>${esc(f.sku)}</small>` : ''}</p>
        <p class="lt-est lt-e-${est.grupo}"><span aria-hidden="true">${est.ico}</span> ${est.es}${f.intentos > 1 ? ` · intento ${f.intentos}` : ''}${med && ['lista', 'revisar', 'aprobada'].includes(f.estado) ? ` · ${med}` : ''}</p>
        ${f.error ? `<p class="lt-motivo">${esc(f.error)}</p>` : ''}
        ${acc.length ? `<div class="lt-acc">${prim.map(a => `<button type="button" class="lt-prim" data-acc="${a}">${ACCION_ES[a]}</button>`).join('')}
          <details class="lt-menu"><summary aria-label="Más acciones de la foto #${esc(f.n)}">${svg(ICO.mas, 18)}</summary><div class="lt-menub">${acc.map(a => a === 'modelo' ? (modelos.length ? `<label class="lt-campo"><span>Otro modelo</span><select data-mod>${modelos.map(m => `<option value="${esc(m.id)}">${esc(m.name || m.id)}${m.cost ? ` · ${usd(m.cost)}` : ''}</option>`).join('')}</select></label><button type="button" data-acc="modelo">Reintentar con ese modelo</button>` : '') : `<button type="button" data-acc="${a}">${ACCION_ES[a]}</button>`).join('')}</div></details></div>` : ''}
      </div></li>`;
  }
  function cabeceraHTML() {
    const r = resumen(lote), ctl = controles(lote), descargar = r.por.lista + r.por.aprobada > 0;
    const C = { probar: ['PROBAR CON 3', 'lt-pri', ICO.play], iniciar: [`GENERAR TODAS · ${usd(r.estimado)}`, ctl.includes('probar') ? 'lt-sec' : 'lt-pri', ICO.play], continuar: [`Seguir con ${r.por.cola === 1 ? 'la que queda' : `las ${r.por.cola} restantes`}`, 'lt-pri', ICO.play], reanudar: ['Reanudar', 'lt-pri', ICO.play], pausar: ['Pausar', 'lt-sec', ICO.pausa], cancelar: ['Cancelar el lote', 'lt-sec lt-peligro', ''] };
    return `<p class="lt-agente"><span class="lt-pulso${ACTIVOS.includes(lote.estado) ? ' on' : ''}" aria-hidden="true"></span>${esc(agenteDice(lote))}</p>
      <div class="lt-barra" role="progressbar" aria-label="Progreso del lote" aria-valuemin="0" aria-valuemax="${r.total}" aria-valuenow="${r.hechas}" aria-valuetext="${r.hechas} de ${r.total}"><span style="width:${r.pct}%"></span></div>
      <p class="lt-cifras"><span>${esc(lineaCifras(r))}</span><span>${esc(costoTexto(r))}</span></p>
      ${ctl.length || descargar ? `<div class="lt-ctl">${ctl.map(c => `<button type="button" class="${C[c][1]}" data-ctl="${c}">${C[c][2] ? svg(C[c][2], 14) : ''}${esc(C[c][0])}</button>`).join('')}</div>` : ''}`;
  }
  function filtrosHTML() {
    const r = resumen(lote), cuenta = { todas: r.total, ...r.por };
    return FILTROS.filter(([k]) => k === 'todas' || k === filtro || cuenta[k]).map(([k, t]) => `<button type="button" data-filtro="${k}" aria-pressed="${filtro === k}">${t} <b>${cuenta[k]}</b></button>`).join('');
  }
  function pieHTML() {
    const r = resumen(lote), listas = arr(lote.filas).filter(f => f.estado === 'lista').length, hay = r.por.lista + r.por.aprobada > 0;
    const zip = `/api/media/lotes/${encodeURIComponent(lote.id)}/zip`, csv = `/api/media/lotes/${encodeURIComponent(lote.id)}/csv`;
    return `${listas ? `<button type="button" class="lt-pri" data-aprobartodas>Aprobar las ${listas} listas</button>` : ''}
      ${hay ? (live() ? `<a class="lt-sec" href="${zip}" download>${svg(ICO.bajar, 14)}Descargar todo (ZIP)</a><a class="lt-sec" href="${csv}" download>Resumen CSV</a>` : `<button type="button" class="lt-sec" data-nodemo>${svg(ICO.bajar, 14)}Descargar todo (ZIP)</button>`) : ''}`;
  }
  function bitacoraHTML() {
    const bs = arr(lote.bitacora).slice().reverse();
    return `<summary>Bitácora <b>${bs.length}</b></summary><ol>${bs.slice(0, 200).map(x => { const l = lineaBitacora(x); return `<li><time>${l.hora}</time> ${esc(l.texto)}</li>`; }).join('')}</ol>`;
  }
  function pintarSeguir() {
    if (!lote) { cuerpo.innerHTML = `<header class="lt-hd"><button type="button" class="lt-ic" data-volver aria-label="Volver a los lotes">${svg(ICO.volver)}</button><h2 id="${id}T" tabindex="-1">Cargando el lote…</h2></header>`; return; }
    const filas = filtrar(lote.filas, filtro);
    cuerpo.innerHTML = `<div class="lt-arriba"><header class="lt-hd"><button type="button" class="lt-ic" data-volver aria-label="Volver a los lotes">${svg(ICO.volver)}</button><h2 id="${id}T" tabindex="-1">${esc(lote.nombre || 'Lote')}</h2><span class="lt-est lt-l-${esc(lote.estado)}">${esc(ESTADO_LOTE[lote.estado] || lote.estado)}</span></header>
      <div class="lt-cab">${cabeceraHTML()}</div></div>
      <div class="lt-filtros" role="group" aria-label="Filtrar por estado">${filtrosHTML()}</div>
      <ul class="lt-filas" aria-label="Fotos del lote">${filas.map(filaHTML).join('') || '<li class="lt-ayuda">Ninguna foto en este estado.</li>'}</ul>
      <details class="lt-bit"${el.dataset.bit === '1' ? ' open' : ''}>${bitacoraHTML()}</details>
      <footer class="lt-bulk">${pieHTML()}</footer>`;
  }
  /** Repinta el seguimiento sin perder el foco ni un menú abierto: solo cambia lo que cambió. */
  function parche(sel, html) {
    const n = cuerpo.querySelector(sel); if (!n || n.dataset.h === html) return;
    const a = document.activeElement, k = a && n.contains(a) ? (a.dataset.ctl ? `[data-ctl="${a.dataset.ctl}"]` : a.dataset.filtro ? `[data-filtro="${a.dataset.filtro}"]` : null) : null;
    n.innerHTML = html; n.dataset.h = html; if (k) (n.querySelector(k) || n.querySelector('button'))?.focus();
  }
  function actualizarSeguir() {
    if (!cuerpo.querySelector('.lt-filas')) { pintarSeguir(); return; }
    cuerpo.querySelector('.lt-hd .lt-est').className = `lt-est lt-l-${lote.estado}`; cuerpo.querySelector('.lt-hd .lt-est').textContent = ESTADO_LOTE[lote.estado] || lote.estado;
    parche('.lt-cab', cabeceraHTML()); parche('.lt-filtros', filtrosHTML()); parche('.lt-bulk', pieHTML());
    const bit = cuerpo.querySelector('.lt-bit'); if (bit && bit.dataset.n !== String(arr(lote.bitacora).length)) { bit.innerHTML = bitacoraHTML(); bit.dataset.n = String(arr(lote.bitacora).length); }
    const ul = cuerpo.querySelector('.lt-filas'), filas = filtrar(lote.filas, filtro), ya = new Map([...ul.querySelectorAll(':scope > .lt-fila')].map(li => [li.dataset.n, li]));
    if (filas.length !== ya.size || filas.some(f => !ya.has(String(f.n)))) {
      const a = document.activeElement?.closest?.('.lt-fila')?.dataset.n;
      ul.innerHTML = filas.map(filaHTML).join('') || '<li class="lt-ayuda">Ninguna foto en este estado.</li>';
      if (a) (ul.querySelector(`[data-n="${a}"] button`) || cuerpo.querySelector('.lt-filtros button[aria-pressed="true"]'))?.focus();
      return;
    }
    for (const f of filas) {
      const li = ya.get(String(f.n)), html = filaHTML(f);
      if (li.dataset.h === html || li.querySelector('details[open]')) continue;
      const tenia = li.contains(document.activeElement) ? document.activeElement : null, sel = tenia?.dataset.acc ? `[data-acc="${tenia.dataset.acc}"]` : tenia?.dataset.ab ? `[data-ab="${tenia.dataset.ab}"]` : null;
      const t = document.createElement('template'); t.innerHTML = html.trim(); const nuevo = t.content.firstElementChild; nuevo.dataset.h = html; li.replaceWith(nuevo);
      if (tenia) (sel && nuevo.querySelector(sel) || nuevo.querySelector('button') || cuerpo.querySelector('.lt-filtros button'))?.focus();
    }
  }
  async function leerLote() {
    if (!vista.id) return;
    try {
      const r = await api('GET', `/api/media/lotes/${encodeURIComponent(vista.id)}`), nuevo = r.lote || r;
      anunciar(anuncio(lote, nuevo)); lote = nuevo;
      const i = lotes.findIndex(l => l.id === lote.id); if (i >= 0) lotes[i] = lote; else lotes.unshift(lote); avisar();
      if (vista.v === 'seguir') actualizarSeguir();
    } catch (e) { say(e.message, true); }
  }
  async function patchLote(accion) {
    try { const r = await api('PATCH', `/api/media/lotes/${encodeURIComponent(lote.id)}`, { accion }); const n = r.lote || r; anunciar(anuncio(lote, n) || agenteDice(n)); lote = n; actualizarSeguir(); }
    catch (e) { say(e.message, true); anunciar(e.message); }
  }
  async function accionFila(accion, ns, extra) {
    try { const r = await api('POST', `/api/media/lotes/${encodeURIComponent(lote.id)}/filas`, pedidoFila(accion, ns, extra)); lote = r.lote || r; actualizarSeguir(); anunciar(`${ACCION_ES[accion]}: ${ns.length === 1 ? `foto #${ns[0]}` : `${ns.length} fotos`}.`); }
    catch (e) { say(e.message, true); anunciar(e.message); }
  }

  /* --- el reloj: solo mira mientras la pestaña se ve --- */
  const visible = () => el.isConnected && el.getClientRects().length > 0 && !(typeof document !== 'undefined' && document.hidden);
  function reloj() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (!visible()) return;
      if (vista.v === 'seguir' && lote && (ACTIVOS.includes(lote.estado) || arr(lote.filas).some(f => grupoDe(f.estado) === 'trabajando'))) leerLote();
      else if (vista.v === 'lista' && lotes.some(l => ACTIVOS.includes(l.estado))) cargarLista();
    }, ctx.intervalo || 2500);
  }

  /* --- los eventos --- */
  function pintarConFoco() {
    const a = document.activeElement, k = a && el.contains(a) ? ['data-q', 'data-nombre', 'data-carpeta', 'data-idea', 'data-tope', 'data-canalo'].find(x => a.hasAttribute(x)) : null, pos = k && a.selectionStart;
    if (vista.v === 'crear') pintarCrear();
    if (k) { const n = el.querySelector(`[${k}]`); n?.focus(); try { if (pos != null) n.setSelectionRange(pos, pos); } catch {} }
  }
  el.addEventListener('click', async ev => {
    const t = ev.target.closest('button, a'); if (!t || !el.contains(t)) return;
    const d = t.dataset;
    if ('nuevo' in d) return nuevo();
    if (d.ver) return seguir(d.ver);
    if ('volver' in d) { editor?.destroy?.(); editor = null; vista = { v: 'lista' }; pintarLista(); foco(`#${id}T`); cargarLista(); return; }
    if (d.paso) return aPaso(+d.paso);
    if ('sig' in d) return aPaso(b.paso + 1);
    if ('atras' in d) return aPaso(b.paso - 1);
    if ('descartar' in d) { if (b.loteId) api('PATCH', `/api/media/lotes/${encodeURIComponent(b.loteId)}`, { accion: 'cancelar' }).catch(() => {}); b = nuevoBorrador(); previa = null; vista = { v: 'lista' }; cargarLista(); foco(`#${id}T`); return; }
    if (d.subir) { el.querySelector('[data-in="fotos"]').dataset.para = d.subir; el.querySelector('[data-in="fotos"]').click(); return; }
    if (d.elegir === 'hoja') { el.querySelector('[data-in="hoja"]').click(); return; }
    if (d.add) { const p = presets.find(x => x.id === d.add); if (!p) return; if (b.pila.some(x => x.id === p.id)) b.pila = b.pila.filter(x => x.id !== p.id); else { const r = anadir(b.pila, p, new Map(presets.map(x => [x.id, x]))); b.pila = r.pila; if (r.aviso) anunciar(r.aviso.texto); } errs = []; pintarCrear(); el.querySelector(`[data-add="${CSS.escape(p.id)}"]`)?.focus(); return; }
    if (d.unpila != null) { b.pila.splice(+d.unpila, 1); pintarCrear(); (el.querySelector('[data-unpila]') || el.querySelector('[data-q]'))?.focus(); return; }
    if (d.canal != null) { b.canal = d.canal || null; pintarCrear(); el.querySelector(`[data-canal="${CSS.escape(d.canal)}"]`)?.focus(); return; }
    if (d.esc) { b.escenaDe = d.esc; if (d.esc === 'no') b.escena = null; if (d.esc === 'compositor') b.escena = ctx.compositor?.()?.escena || null; pintarCrear(); el.querySelector(`[data-esc="${d.esc}"]`)?.focus(); return; }
    if ('comp' in d) { const c = ctx.compositor?.() || {}; b.pila = arr(c.pila).map(x => ({ id: x.id, params: { ...(x.params || {}) } })); if (c.canal) b.canal = c.canal; if (c.escena) { b.escena = c.escena; b.escenaDe = 'compositor'; } pintarCrear(); anunciar('Copiado lo del compositor.'); el.querySelector('[data-comp]')?.focus(); return; }
    if (d.lanzar) return lanzar(d.lanzar);
    if (d.ctl) return patchLote(d.ctl);
    if (d.filtro) { filtro = d.filtro; pintarSeguir(); el.querySelector(`[data-filtro="${d.filtro}"]`)?.focus(); return; }
    const fila = t.closest('.lt-fila'), n = fila ? +fila.dataset.n : null;
    if (d.ab && n != null) { ab.set(n, d.ab); const f = arr(lote?.filas).find(x => x.n === n); if (f) { const t2 = document.createElement('template'); t2.innerHTML = filaHTML(f).trim(); const nu = t2.content.firstElementChild; fila.replaceWith(nu); nu.querySelector(`[data-ab="${d.ab}"]`)?.focus(); } return; }
    if (d.abrir && n != null) { const f = arr(lote?.filas).find(x => x.n === n); const file = (ab.get(n) || 'despues') === 'despues' && f?.out ? f.out : f?.src; if (file && ctx.abrirArchivo && !/^data:/.test(file)) ctx.abrirArchivo(file); return; }
    if (d.acc && n != null) { const sel = fila.querySelector('[data-mod]'); t.closest('details')?.removeAttribute('open'); return accionFila(d.acc, [n], d.acc === 'modelo' ? { modelo: sel?.value } : {}); }
    if ('aprobartodas' in d) { const ns = arr(lote?.filas).filter(f => f.estado === 'lista').map(f => f.n); if (ns.length) accionFila('aprobar', ns); return; }
    if ('nodemo' in d) { say('En la demo no se descarga nada: abre la oficina con el iniciador.'); anunciar('En la demo no se descarga nada.'); }
  });
  el.addEventListener('change', async ev => {
    const t = ev.target;
    if (t.name === id + 'o') {
      const tipo = t.value, sel = arr(ctx.seleccion?.());
      b.origen = tipo === 'seleccion' ? { tipo, files: sel } : tipo === 'ejemplo' ? { tipo, n: 12 } : b.origen?.tipo === tipo ? b.origen : { tipo, files: [] };
      errs = []; pintarCrear(); el.querySelector(`input[value="${tipo}"]`)?.focus(); return;
    }
    if (t.matches('[data-carpeta]')) { const c = arr(ctx.carpetas?.()).find(x => x.id === t.value); b.origen = { tipo: 'carpeta', carpeta: t.value, n: num(c?.n), nombre: c?.name || c?.nombre || '' }; pintarConFoco(); return; }
    if (t.matches('[data-col]')) { const cols = arr(b.origen?.columnas).map(c => ({ ...c })); cols[+t.dataset.col].campo = t.value; b.origen.columnas = cols; releerHoja(cols); return; }
    if (t.matches('[data-canalo]')) { b.canal = t.value || b.canal; pintarConFoco(); return; }
    if (t.matches('[data-probar]')) { b.probar = t.checked; return; }
    if (t.matches('[data-in="fotos"]')) {
      const files = [...t.files]; t.value = ''; if (!files.length) return;
      if (!live() || !ctx.subir) { say('En la demo no se suben fotos: abre la oficina con el iniciador.', true); anunciar('En la demo no se suben fotos.'); return; }
      try { const ids = arr(await ctx.subir(files)); if (t.dataset.para === 'hoja' && b.origen?.tipo === 'hoja') b.origen.files = [...arr(b.origen.files), ...ids]; else b.origen = { tipo: 'subidas', files: [...(b.origen?.tipo === 'subidas' ? arr(b.origen.files) : []), ...ids] }; anunciar(`${ids.length} fotos subidas.`); }
      catch (e) { say(e.message, true); }
      pintarCrear(); return;
    }
    if (t.matches('[data-in="hoja"]')) { const f = t.files[0]; t.value = ''; if (f) leerHoja(f); }
  });
  el.addEventListener('input', ev => {
    const t = ev.target;
    if (t.matches('[data-q]')) { q = t.value; pintarConFoco(); }
    else if (t.matches('[data-nombre]')) b.nombre = t.value;
    else if (t.matches('[data-idea]')) b.idea = t.value;
    else if (t.matches('[data-tope]')) b.topeUsd = t.value;
  });
  el.addEventListener('toggle', ev => { if (ev.target.matches?.('.lt-bit')) el.dataset.bit = ev.target.open ? '1' : '0'; if (ev.target.matches?.('.lt-menu') && ev.target.open) cuerpo.querySelectorAll('.lt-menu[open]').forEach(x => { if (x !== ev.target) x.open = false; }); }, true);
  el.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    const m = ev.target.closest?.('.lt-menu[open]'); if (m) { m.open = false; m.querySelector('summary')?.focus(); ev.preventDefault(); ev.stopPropagation(); }
  });

  /* --- la puerta de entrada --- */
  function nuevo(origen = null) { b = nuevoBorrador(origen); previa = null; errs = []; q = ''; vista = { v: 'crear' }; pintarCrear(); foco(`#${id}T`); if (b.paso === 2) cargarPresets(); }
  function seguir(idL, ya = null) { vista = { v: 'seguir', id: idL }; filtro = 'todas'; ab = new Map(); lote = ya && ya.id === idL ? ya : lotes.find(l => l.id === idL) || null; pintarSeguir(); foco(`#${id}T`); leerLote(); }
  pintarLista(); cargarLista(); reloj();
  return {
    el, nuevo, seguir,
    abrir() { if (vista.v === 'lista') cargarLista(); else if (vista.v === 'seguir') leerLote(); foco(`#${id}T`); },
    refrescar() { return vista.v === 'seguir' ? leerLote() : cargarLista(); },
    destruir() { clearInterval(timer); editor?.destroy?.(); el.remove(); },
    estado: () => ({ vista: vista.v, id: vista.id || null, paso: vista.v === 'crear' ? b.paso : null, lotes: lotes.length }),
  };
}
