// DATOS DE EJEMPLO de Anuncios (Fase A1): la demo file:// y el botón «Ver con datos de ejemplo». En memoria, rotulados «ejemplo» en la
// vista, nunca mezclados con lo real. Tienen lo que hay que ver: una campaña aprendiendo, otra fuera del aprendizaje, una en pausa creada
// fuera de la oficina (y ya terminada), una en pausa sin estrenar, un anuncio rechazado y uno con problemas. Las cifras siguen el rango.
// Fase A2 (9 oct 2026): crearDemo() hace TODAS las acciones en memoria con las MISMAS reglas que el servidor (anuncios/rutas.mjs): un clic
// para lo que baja el gasto, dos para lo que gasta (el primero devuelve { confirmar } con la cifra), los topes (día, mes, campaña) con su
// motivo, el aviso de aprendizaje, el mínimo de Meta, DESHACER 30 s y el historial. Nunca llama a la red.
import { buscar } from './campanas.js';
import { accionesDe, presupuestoDe, reiniciaAprendizaje, AVISO_APRENDIZAJE, GASTO, LIBRES, TEXTO, importe } from './acciones.js';
import { dinero, estadoDe, fechaCorta } from './comun.js';
import { srcDemo } from './demo-borradores.js';
import { objetivoDe, objetivoTexto, LLAMADA, paisNombre } from './borrador.js';

const img = (a, b, t) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/><text x="60" y="68" font-family="sans-serif" font-size="16" font-weight="700" fill="#fff" text-anchor="middle">${t}</text></svg>`);
const FACTOR = { hoy: 1 / 7, '7d': 1, '30d': 4.2, mes: 1.3 };
function cif(base, f, resultadoTexto) {
  const gasto = +(base.gasto * f).toFixed(2), impresiones = Math.round(base.imp * f), alcance = Math.round(impresiones / base.frec), clics = Math.round(impresiones * base.ctr / 100), resultados = base.res == null ? null : Math.round(base.res * f);
  return { gasto, impresiones, alcance, frecuencia: base.frec, clics, clicsEnlace: Math.round(clics * 0.8), ctr: base.ctr, cpc: clics ? +(gasto / clics).toFixed(2) : null, cpm: impresiones ? +(gasto / impresiones * 1000).toFixed(2) : null,
    resultados, resultadoTexto, costoPorResultado: resultados ? +(gasto / resultados).toFixed(2) : null };
}
const suma = (hijos, resultadoTexto) => {
  const s = k => hijos.reduce((a, h) => a + (h.cifras[k] || 0), 0), gasto = +s('gasto').toFixed(2), impresiones = s('impresiones'), alcance = s('alcance'), clics = s('clics'), r = hijos.some(h => h.cifras.resultados != null) ? s('resultados') : null;
  return { gasto, impresiones, alcance, frecuencia: alcance ? +(impresiones / alcance).toFixed(2) : null, clics, clicsEnlace: s('clicsEnlace'), ctr: impresiones ? +(clics / impresiones * 100).toFixed(2) : null, cpc: clics ? +(gasto / clics).toFixed(2) : null, cpm: impresiones ? +(gasto / impresiones * 1000).toFixed(2) : null, resultados: r, resultadoTexto, costoPorResultado: r ? +(gasto / r).toFixed(2) : null };
};
/** Los topes de la demo (Ajustes → Anuncios): sumados, los presupuestos diarios activos del ejemplo dan 15 US$ al día. */
export const TOPES_DEMO = { diario: 30, mensual: 1200, campana: 400 };
const ymd = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function datosDeEjemplo(rango = '7d', ahora = Date.now()) {
  const f = FACTOR[rango] ?? 1, dia = 864e5;
  const an = (id, nombre, estado, estadoTexto, base, rt, creativo, extra = {}) => ({ id, nombre, estado, estadoTexto, revision: [], problemas: [], creativo, cifras: cif(base, f, rt), ...extra });
  // 1 · mensajes: aprendiendo, con un anuncio rechazado
  const conv = 'conversaciones';
  const a1 = [an('ej-ad-11', 'Combo lentes · foto de la vitrina', 'ACTIVE', 'Activo', { gasto: 38.5, imp: 9100, frec: 1.6, ctr: 1.9, res: 27 }, conv, { miniatura: img('#1F5FD0', '#6B3FB5', 'COMBO'), titulo: 'Lentes + montura desde US$59', texto: 'Escríbenos por WhatsApp y te apartamos tu combo hoy mismo.', llamada: 'Enviar mensaje' }),
    an('ej-ad-12', 'Combo lentes · antes y después', 'DISAPPROVED', 'Rechazado', { gasto: 0, imp: 0, frec: 1, ctr: 0, res: 0 }, conv, { miniatura: img('#B42318', '#8A5A00', 'ANTES'), titulo: 'Ve mejor en 1 día', texto: '¿Ves borroso? Con nuestros lentes se acaba tu problema de vista.', llamada: 'Enviar mensaje' },
      { revision: ['El texto se dirige a una condición personal («¿Ves borroso?»): las normas de Meta no lo permiten.'] })];
  const j1 = { id: 'ej-as-1', nombre: 'Panamá · 25–55 · Advantage+', optimizacion: 'Conversaciones', destino: 'WhatsApp', estado: 'ACTIVE', estadoTexto: 'Activo', aprendizaje: { estado: 'LEARNING', texto: 'Aprendiendo: 18 de 50 conversiones', conversiones: 18 },
    presupuesto: null, publico: { lugares: ['Panamá'], edad: { min: 25, max: 55 }, advantage: true }, anuncios: a1 };
  j1.cifras = suma(a1, conv);
  const c1 = { id: 'ej-c-1', nombre: 'Mensajes por WhatsApp — Combo lentes', objetivo: 'OUTCOME_ENGAGEMENT', objetivoTexto: 'Que me escriban por WhatsApp', estado: 'ACTIVE', estadoTexto: 'Activa', creadoFuera: false,
    presupuesto: { tipo: 'diario', usd: 8 }, spendCap: 240, inicio: ymd(ahora - 5 * dia), fin: ymd(ahora + 25 * dia), conjuntos: [j1] };
  c1.cifras = suma([j1], conv);
  // 2 · tráfico: fuera del aprendizaje, con un anuncio con problemas, uno que se cansa (frecuencia 3,8: A5) y uno que gasta sin resultados
  const cl = 'clics al enlace';
  const a2 = [an('ej-ad-21', 'Monturas otoño · carrusel', 'ACTIVE', 'Activo', { gasto: 41.2, imp: 15800, frec: 3.8, ctr: 1.4, res: 182 }, cl, { miniatura: img('#176638', '#0B6E80', 'OTOÑO'), titulo: 'Monturas nuevas de otoño', texto: 'Mira los modelos nuevos y aparta el tuyo en la web.', llamada: 'Más información' }),
    an('ej-ad-22', 'Monturas otoño · video 9:16', 'WITH_ISSUES', 'Con problemas', { gasto: 6.1, imp: 2100, frec: 1.3, ctr: 0.6, res: 11 }, cl, { miniatura: img('#A3266B', '#6B3FB5', 'VIDEO'), titulo: 'Monturas en 15 segundos', texto: 'Las monturas de otoño, una por una.', llamada: 'Más información' },
      { problemas: ['El video no tiene la proporción 9:16 en todas sus partes: Meta lo recorta en historias y reels.'] }),
    // A5: uno que gasta sin resultados (la sugerencia de «cortar» lo pausa)
    an('ej-ad-23', 'Monturas otoño · solo texto', 'ACTIVE', 'Activo', { gasto: 9.8, imp: 3900, frec: 1.7, ctr: 0, res: 0 }, cl, { miniatura: img('#5A5A5A', '#1F5FD0', 'TEXTO'), titulo: 'Monturas desde US$59', texto: 'Tenemos monturas nuevas. Pasa a verlas.', llamada: 'Más información' })];
  const j2 = { id: 'ej-as-2', nombre: 'Ciudad de Panamá · 15 km · 22–60', optimizacion: 'Clics al enlace', destino: 'Sitio web', estado: 'ACTIVE', estadoTexto: 'Activo', aprendizaje: { estado: 'SUCCESS', texto: 'Fuera del aprendizaje' },
    presupuesto: { tipo: 'diario', usd: 7 }, publico: { lugares: ['Ciudad de Panamá + 15 km'], edad: { min: 22, max: 60 }, intereses: ['moda', 'gafas de sol'] }, anuncios: a2 };
  j2.cifras = suma(a2, cl);
  const c2 = { id: 'ej-c-2', nombre: 'Visitas a la web — Monturas otoño', objetivo: 'OUTCOME_TRAFFIC', objetivoTexto: 'Visitas a mi web', estado: 'ACTIVE', estadoTexto: 'Activa', creadoFuera: false,
    presupuesto: null, spendCap: null, inicio: ymd(ahora - 21 * dia), fin: null, conjuntos: [j2] };
  c2.cifras = suma([j2], cl);
  // 3 · reconocimiento: en pausa, creada en el Administrador de anuncios
  const al = 'personas alcanzadas';
  const a3 = [an('ej-ad-31', 'Septiembre · marca', 'CAMPAIGN_PAUSED', 'En pausa (su campaña)', { gasto: 12, imp: 22000, frec: 3.4, ctr: 0.4, res: null }, al, { miniatura: img('#5A5A5A', '#151414', 'MARCA'), titulo: 'PanaClaw, tu óptica', texto: 'Más de 10 años cuidando la vista de Panamá.', llamada: 'Más información' })];
  const j3 = { id: 'ej-as-3', nombre: 'Todo Panamá · 18+', optimizacion: 'Alcance', destino: 'Sin destino', estado: 'CAMPAIGN_PAUSED', estadoTexto: 'En pausa (su campaña)', aprendizaje: { estado: null, texto: 'No aplica' }, presupuesto: null, publico: 'Todo Panamá, 18 años o más', anuncios: a3 };
  j3.cifras = suma(a3, al);
  const c3 = { id: 'ej-c-3', nombre: 'Que me conozcan — Septiembre', objetivo: 'OUTCOME_AWARENESS', objetivoTexto: 'Que me conozcan', estado: 'PAUSED', estadoTexto: 'En pausa', creadoFuera: true,
    presupuesto: { tipo: 'total', usd: 60 }, spendCap: null, inicio: ymd(ahora - 40 * dia), fin: ymd(ahora - 9 * dia), conjuntos: [j3] };
  c3.cifras = suma([j3], al);

  // 4 · reseñas: en pausa, sin estrenar (para activarla con sus dos clics)
  const re = 'conversaciones';
  const a4 = [an('ej-ad-41', 'Reseñas · cliente feliz', 'CAMPAIGN_PAUSED', 'En pausa (su campaña)', { gasto: 0, imp: 0, frec: 1, ctr: 0, res: 0 }, re, { miniatura: img('#0B6E80', '#176638', 'RESEÑA'), titulo: '«Me atendieron en 20 minutos»', texto: 'Lo que dicen nuestros clientes. Escríbenos y agenda tu examen de la vista.', llamada: 'Enviar mensaje' })];
  const j4 = { id: 'ej-as-4', nombre: 'Panamá · 30–65 · Advantage+', optimizacion: 'Conversaciones', destino: 'WhatsApp', estado: 'CAMPAIGN_PAUSED', estadoTexto: 'En pausa (su campaña)', aprendizaje: { estado: null, texto: 'Todavía no empieza' },
    presupuesto: null, publico: { lugares: ['Panamá'], edad: { min: 30, max: 65 }, advantage: true }, inicio: ymd(ahora), fin: ymd(ahora + 14 * dia), anuncios: a4 };
  j4.cifras = suma(a4, re);
  const c4 = { id: 'ej-c-4', nombre: 'Reseñas — Promo octubre', objetivo: 'OUTCOME_ENGAGEMENT', objetivoTexto: 'Que me escriban por WhatsApp', estado: 'PAUSED', estadoTexto: 'En pausa', creadoFuera: false,
    presupuesto: { tipo: 'diario', usd: 10 }, spendCap: 140, inicio: ymd(ahora), fin: ymd(ahora + 14 * dia), conjuntos: [j4] };
  c4.cifras = suma([j4], re);

  const campanas = [c1, c2, c3, c4], hoy = +(c1.presupuesto.usd * 0.9 + j2.presupuesto.usd * 0.95).toFixed(2);
  return {
    configurado: true, motivo: '', ejemplo: true,
    cuenta: { id: 'act_000000000', nombre: 'PanaClaw (ejemplo)', estado: 'ACTIVE', estadoTexto: 'Activa', moneda: 'USD', zona: 'America/Panama', gastado: 1240.55, spendCap: null, saldo: 0 },
    topes: { ...TOPES_DEMO },
    gasto: { hoy, semana: +(c1.cifras.gasto / f + c2.cifras.gasto / f).toFixed(2), mes: 176.4 },
    avisos: [{ nivel: 'bad', texto: 'Un anuncio fue rechazado: «Combo lentes · antes y después». Mira el motivo en su detalle.' },
      { nivel: 'info', texto: '«Mensajes por WhatsApp — Combo lentes» está aprendiendo: mejor no tocarla unos días.' }],
    resumen: { resultados7d: 216, costoPorResultado7d: 0.4, tendencia: { gasto: 8.5, resultados: 14.2, costo: -5.1 } },
    campanas, sincronizadaAt: new Date(ahora - 7 * 6e4).toISOString(), error: null, uso: { pct: 12, ritmo: 'normal', frenadoHasta: null, motivo: '' },
  };
}

/* ---------- Fase A2: las acciones, en memoria, con las reglas del servidor ---------- */
const DIA = 864e5;
const finDia = s => Date.parse(String(s).length === 10 ? s + 'T23:59:59' : s);
const diasHasta = (fin, ahora) => (fin ? Math.max(0, Math.ceil((finDia(fin) - ahora) / DIA)) : null);
const diasMes = ahora => { const d = new Date(ahora); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1; };
const PAUSA = /^(PAUSED|CAMPAIGN_PAUSED|ADSET_PAUSED|ARCHIVED|DELETED)$/;
const NIVEL_TXT = { campana: 'la campaña', conjunto: 'el conjunto', anuncio: 'el anuncio' };
const QUE = { pausar: 'pausó', activar: 'activó', reanudar: 'reanudó', subir_presupuesto: 'subió el presupuesto de', bajar_presupuesto: 'bajó el presupuesto de', alargar: 'alargó el fin de', relanzar: 'relanzó', archivar: 'archivó' };
const terminadaD = (c, ahora) => String(c.estado).toUpperCase() === 'COMPLETED' || (c.fin && finDia(c.fin) < ahora);
const presTxt = (p, m) => (p ? `${dinero(p.usd, m)} ${p.tipo === 'diario' ? 'al día' : 'en total'}` : 'sin presupuesto');
const r2 = v => Math.round(v * 100) / 100;

/** El historial de ejemplo con el que arranca la demo: algo de Dimitri y algo tuyo, para ver el filtro. */
export function historialDeEjemplo(ahora = Date.now()) {
  return { items: [
    { at: new Date(ahora - 2 * DIA).toISOString(), quien: 'dimitri', que: 'bajó el presupuesto del conjunto', objeto: { id: 'ej-as-2', nivel: 'conjunto', nombre: 'Ciudad de Panamá · 15 km · 22–60' }, antes: '9,00 US$ al día', despues: '7,00 US$ al día' },
    { at: new Date(ahora - 5 * DIA).toISOString(), quien: 'dueno', que: 'creó en pausa la campaña', objeto: { id: 'ej-c-4', nivel: 'campana', nombre: 'Reseñas — Promo octubre' }, antes: null, despues: 'En pausa' },
  ] };
}

/**
 * La demo que se puede tocar: crearDemo() → { vista(rango), historial(), accion(cuerpo), deshacer({ token }) }. Contesta como
 * POST /api/anuncios/accion y /api/anuncios/deshacer, con `status` dentro: 200 { ok, hecho, deshacer } · 200 { confirmar, aviso } ·
 * 409 { error: 'tope', motivo, tope, quedaria } · 422 { error: 'meta', motivo, minimo } · 409 { error: 'confirmacion', motivo }.
 */
export function crearDemo({ ahora = () => Date.now(), topes = TOPES_DEMO } = {}) {
  const cambios = new Map(), copias = [], creadas = [], confirmaciones = new Map(), deshaceres = new Map();
  const hist = historialDeEjemplo(ahora()).items; let n = 0;
  const token = p => `${p}-${(++n).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  function aplicar(nodo, padre, nivelPadre) {
    const c = cambios.get(nodo.id);
    if (c) { for (const k of ['estado', 'presupuesto', 'fin', 'inicio']) if (k in c) { nodo[k] = c[k]; if (k === 'estado') delete nodo.estadoTexto; } }
    if (padre) {
      const pe = String(padre.estado || '').toUpperCase(), propio = String(nodo.estado || '').toUpperCase(), marca = nivelPadre === 'campana' ? 'CAMPAIGN_PAUSED' : 'ADSET_PAUSED';
      if (PAUSA.test(pe) && propio === 'ACTIVE') { nodo.estado = marca; delete nodo.estadoTexto; }
      else if (pe === 'ACTIVE' && /^(CAMPAIGN_PAUSED|ADSET_PAUSED)$/.test(propio)) { nodo.estado = 'ACTIVE'; delete nodo.estadoTexto; }
    }
    for (const j of nodo.conjuntos || []) aplicar(j, nodo, 'campana');
    for (const a of nodo.anuncios || []) aplicar(a, nodo, 'conjunto');
  }
  function vista(rango = '7d') {
    const d = datosDeEjemplo(rango, ahora());
    for (const cp of copias) {
      const base = d.campanas.find(c => c.id === cp.de); if (!base) continue;
      const x = JSON.parse(JSON.stringify(base)), cero = o => { o.cifras = { ...o.cifras, gasto: 0, impresiones: 0, alcance: 0, clics: 0, clicsEnlace: 0, resultados: 0, costoPorResultado: null, cpc: null, cpm: null, ctr: null, frecuencia: null }; };
      Object.assign(x, { id: cp.id, nombre: cp.nombre, estado: 'PAUSED', creadoFuera: false, inicio: cp.inicio, fin: cp.fin || null }); delete x.estadoTexto; cero(x);
      x.conjuntos.forEach((j, i) => {
        j.id = `${cp.id}-as${i + 1}`; j.estado = 'CAMPAIGN_PAUSED'; delete j.estadoTexto; j.aprendizaje = { estado: null, texto: 'Todavía no empieza' }; cero(j);
        j.anuncios.forEach((a, k) => { a.id = `${j.id}-ad${k + 1}`; a.estado = 'CAMPAIGN_PAUSED'; delete a.estadoTexto; a.revision = []; a.problemas = []; cero(a); });
      });
      d.campanas.push(x);
    }
    for (const c of creadas) d.campanas.push(JSON.parse(JSON.stringify(c))); // A3: lo creado en pausa desde un borrador
    for (const c of d.campanas) aplicar(c, null);
    return d;
  }
  /** Lo que gastan al día las campañas activas (su presupuesto diario, o el de sus conjuntos activos). */
  function diarioActivo(d) {
    let s = 0; const t = ahora();
    for (const c of d.campanas) {
      if (String(c.estado).toUpperCase() !== 'ACTIVE' || terminadaD(c, t)) continue;
      if (c.presupuesto?.tipo === 'diario') s += c.presupuesto.usd;
      else for (const j of c.conjuntos || []) if (String(j.estado).toUpperCase() === 'ACTIVE' && j.presupuesto?.tipo === 'diario') s += j.presupuesto.usd;
    }
    return r2(s);
  }
  /** El cambio que haría la acción, sin hacerlo: → { id: {…} } (y `copia`, si relanza). */
  function cambioDe(f, tipo, { valor, fin, inicio } = {}) {
    const p = presupuestoDe(f), hoy = ymd(ahora());
    if (tipo === 'pausar') return { [f.id]: { estado: 'PAUSED' } };
    if (tipo === 'activar' || tipo === 'reanudar') return { [f.id]: { estado: 'ACTIVE' } };
    if (tipo === 'archivar') return { [f.id]: { estado: 'ARCHIVED' } };
    if (tipo === 'subir_presupuesto' || tipo === 'bajar_presupuesto') return { [p.de === f.nivel ? f.id : (p.de === 'conjunto' ? f.conjunto : f.campana).id]: { presupuesto: { tipo: p.tipo, usd: importe(valor) } } };
    if (tipo === 'alargar') return { [f.id]: { fin } };
    if (tipo === 'relanzar') { const ini = inicio || hoy; return { copia: { de: f.campana.id, id: `${f.campana.id}-r${copias.length + 1}`, nombre: `${f.campana.nombre} (relanzada)`, inicio: ini, fin: fin || ymd(Date.parse(ini + 'T12:00:00') + 30 * DIA) } }; }
    return {};
  }
  function conCambio(cm, fn) {
    const antes = new Map(), copia = cm.copia;
    for (const [id, c] of Object.entries(cm)) if (id !== 'copia') { antes.set(id, cambios.get(id)); cambios.set(id, { ...(cambios.get(id) || {}), ...c }); }
    if (copia) copias.push(copia);
    try { return fn(); } finally { for (const [id, c] of antes) { if (c === undefined) cambios.delete(id); else cambios.set(id, c); } if (copia) copias.pop(); }
  }
  /** Las cifras de lo que se compromete y los topes: → { cifras, tope, cm } */
  function evaluar(d0, f, tipo, opc) {
    const t = ahora(), m = d0.cuenta.moneda, cm = cambioDe(f, tipo, opc);
    const d1 = conCambio(cm, () => vista('7d')), f1 = buscar(d1.campanas, f.id) || f, camp = f1.campana;
    const antes = diarioActivo(d0), despues = diarioActivo(d1), p = presupuestoDe(f1);
    const dCamp = diasHasta(camp.fin, t), quedaMes = dCamp == null ? diasMes(t) : Math.min(diasMes(t), dCamp);
    let cifras = {};
    if (tipo !== 'relanzar' && p) {
      if (p.tipo === 'diario') {
        cifras = { dia: p.usd, semana: r2(p.usd * Math.min(7, dCamp ?? 7)), mes: r2(p.usd * quedaMes), campana: dCamp == null ? null : r2(p.usd * dCamp) };
        if (tipo === 'alargar') cifras.campana = r2(p.usd * Math.max(0, diasHasta(opc.fin, t) - (diasHasta(f.nodo.fin, t) || 0)));
      } else cifras = { campana: p.usd };
    }
    let tope = null;
    if (tipo !== 'relanzar') {
      if (topes.diario > 0 && despues > antes && despues > topes.diario) tope = { error: 'tope', motivo: `Con esto, lo activo sumaría ${dinero(despues, m)} al día y tu tope diario es ${dinero(topes.diario, m)}.`, tope: topes.diario, quedaria: despues };
      const mes = r2((d0.gasto?.mes || 0) + despues * diasMes(t));
      if (!tope && topes.mensual > 0 && despues > antes && mes > topes.mensual) tope = { error: 'tope', motivo: `Con esto, el mes cerraría en ${dinero(mes, m)} y tu tope mensual es ${dinero(topes.mensual, m)}.`, tope: topes.mensual, quedaria: mes };
      const enCamp = p ? (p.tipo === 'diario' ? (dCamp == null ? null : p.usd * dCamp) : p.usd) : null;
      if (!tope && topes.campana > 0 && enCamp != null && enCamp > topes.campana && String(camp.estado).toUpperCase() === 'ACTIVE') tope = { error: 'tope', motivo: `«${camp.nombre}» podría gastar ${dinero(enCamp, m)} hasta su fin y tu tope por campaña es ${dinero(topes.campana, m)}.`, tope: topes.campana, quedaria: r2(enCamp) };
    }
    return { cifras, tope, cm };
  }
  function textoConfirmar(f, tipo, opc, cifras, m, p0) {
    const nom = `«${f.nodo.nombre}»`, gasta = [cifras.dia != null ? `gasta hasta ${dinero(cifras.dia, m)} al día` : cifras.campana != null ? `gasta hasta ${dinero(cifras.campana, m)} en la campaña` : '', cifras.semana != null ? `${dinero(cifras.semana, m)} esta semana` : ''].filter(Boolean).join(', ');
    if (tipo === 'relanzar') { const c = cambioDe(f, tipo, opc).copia; return `Relanzar ${nom} — se duplica EN PAUSA con fechas nuevas (del ${fechaCorta(c.inicio)} al ${fechaCorta(c.fin)}); no gasta hasta que la actives`; }
    if (tipo === 'subir_presupuesto') return `Subir ${nom} de ${presTxt(p0, m)} a ${presTxt({ ...p0, usd: importe(opc.valor) }, m)} — ${gasta}`;
    if (tipo === 'alargar') return `Alargar ${nom} hasta el ${fechaCorta(opc.fin)} — ${gasta}${cifras.campana != null ? `, ${dinero(cifras.campana, m)} más en la campaña` : ''}`;
    return `${TEXTO[tipo]} ${nom} — ${gasta || 'vuelve a gastar'}`;
  }
  const anota = (f, tipo, antes, despues) => hist.unshift({ at: new Date(ahora()).toISOString(), quien: 'dueno', que: `${QUE[tipo]} ${NIVEL_TXT[f.nivel]}`, objeto: { id: f.id, nivel: f.nivel, nombre: f.nodo.nombre }, antes, despues });

  function accion(b = {}) {
    const { tipo, id, valor, fin, inicio, confirmacion } = b, t = ahora();
    const d0 = vista('7d'), m = d0.cuenta.moneda, f = buscar(d0.campanas, id);
    if (!f) return { status: 404, error: 'no', motivo: 'No encuentro eso en la cuenta (ejemplo).' };
    if (!GASTO.has(tipo) && !LIBRES.has(tipo)) return { status: 400, error: 'tipo', motivo: 'Esa acción no existe.' };
    if (!accionesDe(f, t).some(a => a.tipo === tipo)) return { status: 409, error: 'estado', motivo: `«${f.nodo.nombre}» está ${estadoDe(f.nodo).texto.toLowerCase()}: ahora no se puede ${TEXTO[tipo].toLowerCase()}.` };
    const p0 = presupuestoDe(f);
    if (tipo === 'subir_presupuesto' || tipo === 'bajar_presupuesto') {
      const v = importe(valor);
      if (!(v > 0)) return { status: 400, error: 'valor', motivo: 'Escribe un importe mayor que 0.' };
      if (v < 1) return { status: 422, error: 'meta', motivo: `Meta no acepta un presupuesto ${p0.tipo === 'diario' ? 'diario ' : ''}de menos de ${dinero(1, m)} en esta cuenta.`, minimo: 1 };
      if (tipo === 'subir_presupuesto' ? !(v > p0.usd) : !(v < p0.usd)) return { status: 400, error: 'valor', motivo: `El presupuesto ya es ${presTxt(p0, m)}.` };
    }
    if (tipo === 'alargar' && !(fin && finDia(fin) > Math.max(t, f.nodo.fin ? finDia(f.nodo.fin) : 0))) return { status: 400, error: 'valor', motivo: 'La fecha nueva tiene que ser después de la de ahora y de hoy.' };
    const ev = evaluar(d0, f, tipo, { valor, fin, inicio });
    if (GASTO.has(tipo)) {
      if (ev.tope) return { status: 409, ...ev.tope };
      const aviso = tipo === 'subir_presupuesto' && reiniciaAprendizaje(f, p0?.usd, importe(valor)) ? AVISO_APRENDIZAJE : undefined;
      const val = valor == null || valor === '' ? null : importe(valor);
      if (!confirmacion) {
        const tk = token('conf');
        confirmaciones.set(tk, { tipo, id, valor: val, fin: fin || null, vence: t + 120000 });
        return { status: 200, confirmar: { token: tk, texto: textoConfirmar(f, tipo, { valor, fin, inicio }, ev.cifras, m, p0), cifras: ev.cifras, vence: new Date(t + 120000).toISOString() }, ...(aviso ? { aviso } : {}) };
      }
      const c = confirmaciones.get(confirmacion); confirmaciones.delete(confirmacion);
      if (!c || c.vence <= t || c.tipo !== tipo || c.id !== id || c.valor !== val || c.fin !== (fin || null)) return { status: 409, error: 'confirmacion', motivo: 'Esa confirmación venció o era de otra cosa: vuelve a pedirlo.' };
    }
    const antesTxt = tipo.includes('presupuesto') ? presTxt(p0, m) : tipo === 'alargar' ? `termina el ${fechaCorta(f.nodo.fin)}` : estadoDe(f.nodo).texto;
    const previo = new Map(Object.keys(ev.cm).filter(k => k !== 'copia').map(k => [k, cambios.get(k)]));
    for (const [k, c] of Object.entries(ev.cm)) if (k !== 'copia') cambios.set(k, { ...(cambios.get(k) || {}), ...c });
    if (ev.cm.copia) copias.push(ev.cm.copia);
    const f1 = buscar(vista('7d').campanas, id) || f, p1 = presupuestoDe(f1);
    const despuesTxt = tipo.includes('presupuesto') ? presTxt(p1, m) : tipo === 'alargar' ? `termina el ${fechaCorta(fin)}` : tipo === 'relanzar' ? `copia «${ev.cm.copia.nombre}» en pausa` : estadoDe(f1.nodo).texto;
    anota(f, tipo, antesTxt, despuesTxt);
    const nom = `«${f.nodo.nombre}»`, dia = ev.cifras.dia != null ? `: gasta hasta ${dinero(ev.cifras.dia, m)} al día` : '';
    const texto = { pausar: `Pausaste ${nom}.`, archivar: `Archivaste ${nom}: no se borró; para volver a usarla, relánzala.`, bajar_presupuesto: `Bajaste el presupuesto de ${nom} de ${antesTxt} a ${despuesTxt}.`,
      activar: `Activaste ${nom}${dia}.`, reanudar: `Reanudaste ${nom}${dia}.`, subir_presupuesto: `Subiste el presupuesto de ${nom} de ${antesTxt} a ${despuesTxt}.`,
      alargar: `${nom} ahora termina el ${fechaCorta(fin)}.`, relanzar: `Relanzaste ${nom}: la copia «${ev.cm.copia?.nombre}» está EN PAUSA; actívala cuando quieras.` }[tipo];
    let deshacer = null;
    if (tipo === 'pausar' || tipo === 'bajar_presupuesto') {
      const tk = token('desh');
      deshaceres.set(tk, { previo, f, tipo, antesTxt, despuesTxt, hasta: t + 30000 });
      deshacer = { token: tk, hasta: new Date(t + 30000).toISOString() };
    }
    return { status: 200, ok: true, hecho: { tipo, id, antes: antesTxt, despues: despuesTxt, texto }, deshacer };
  }
  function deshacer({ token: tk } = {}) {
    const u = deshaceres.get(tk), t = ahora();
    if (!u) return { status: 404, error: 'no', motivo: 'No hay nada que deshacer.' };
    deshaceres.delete(tk);
    if (u.hasta <= t) return { status: 409, error: 'vencido', motivo: 'Ya pasaron los 30 segundos: si quieres volver atrás, hazlo a mano.' };
    for (const [k, c] of u.previo) { if (c === undefined) cambios.delete(k); else cambios.set(k, c); }
    hist.unshift({ at: new Date(t).toISOString(), quien: 'dueno', que: `deshizo: ${QUE[u.tipo]} ${NIVEL_TXT[u.f.nivel]}`, objeto: { id: u.f.id, nivel: u.f.nivel, nombre: u.f.nodo.nombre }, antes: u.despuesTxt, despues: u.antesTxt });
    return { status: 200, ok: true, hecho: { texto: `Deshecho: «${u.f.nodo.nombre}» vuelve a estar como antes (${u.antesTxt}).` } };
  }
  /** A3: un borrador creado EN PAUSA (demo-borradores.js) → su campaña, su conjunto y un anuncio por creativo; → el id de la campaña. */
  function agregarCreada(b) {
    const id = `ej-c-n${creadas.length + 1}`, cero = { gasto: 0, impresiones: 0, alcance: 0, frecuencia: null, clics: 0, clicsEnlace: 0, ctr: null, cpc: null, cpm: null, resultados: 0, resultadoTexto: '', costoPorResultado: null };
    const pub = b.publico || {}, lugar = pub.radio ? `${pub.radio.km} km alrededor de tu local` : (pub.paises || []).map(paisNombre).join(', ') || 'Panamá';
    const anuncios = (b.creativos || []).map((c, i) => ({ id: `${id}-as1-ad${i + 1}`, nombre: `${b.nombre} · creativo ${i + 1}`, estado: 'CAMPAIGN_PAUSED', revision: [], problemas: [], cifras: { ...cero },
      creativo: { miniatura: srcDemo(c.media), titulo: c.titular || '', texto: c.texto || '', llamada: LLAMADA[c.llamada] || '' } }));
    const conjunto = { id: `${id}-as1`, nombre: `${lugar} · ${pub.edadMin || 18}${pub.edadMax ? '–' + pub.edadMax : '+'}${pub.modo === 'manual' ? '' : ' · Advantage+'}`, optimizacion: objetivoDe(b.objetivo)?.n || '', destino: b.destino || '', estado: 'CAMPAIGN_PAUSED',
      aprendizaje: { estado: null, texto: 'Todavía no empieza' }, presupuesto: null, publico: { lugares: [lugar], edad: { min: pub.edadMin || 18, max: pub.edadMax || null }, advantage: pub.modo !== 'manual' }, anuncios, cifras: { ...cero } };
    creadas.push({ id, nombre: b.nombre, objetivo: objetivoDe(b.objetivo)?.meta || '', objetivoTexto: objetivoTexto(b), estado: 'PAUSED', estadoTexto: 'En pausa', creadoFuera: false,
      presupuesto: { ...b.presupuesto }, spendCap: b.validacion?.costoMax?.campana ?? null, inicio: b.inicio, fin: b.fin || null, conjuntos: [conjunto], cifras: { ...cero }, deBorrador: b.id });
    hist.unshift({ at: new Date(ahora()).toISOString(), quien: 'dueno', que: 'creó en pausa la campaña', objeto: { id, nivel: 'campana', nombre: b.nombre }, antes: null, despues: 'En pausa' });
    return id;
  }
  return { vista, historial: () => ({ items: hist.slice() }), accion, deshacer, topes, agregarCreada };
}
