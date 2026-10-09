// DATOS DE EJEMPLO de Anuncios (Fase A1): la demo file:// y el botón «Ver con datos de ejemplo». En memoria, rotulados «ejemplo» en la
// vista, nunca mezclados con lo real. Tienen lo que hay que ver: una campaña aprendiendo, otra fuera del aprendizaje, una en pausa creada
// fuera de la oficina, un anuncio rechazado y uno con problemas. Las cifras siguen el rango (hoy, 7 días, 30 días, este mes).

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
  // 2 · tráfico: fuera del aprendizaje, con un anuncio con problemas
  const cl = 'clics al enlace';
  const a2 = [an('ej-ad-21', 'Monturas otoño · carrusel', 'ACTIVE', 'Activo', { gasto: 41.2, imp: 15800, frec: 2.1, ctr: 1.4, res: 182 }, cl, { miniatura: img('#176638', '#0B6E80', 'OTOÑO'), titulo: 'Monturas nuevas de otoño', texto: 'Mira los modelos nuevos y aparta el tuyo en la web.', llamada: 'Más información' }),
    an('ej-ad-22', 'Monturas otoño · video 9:16', 'WITH_ISSUES', 'Con problemas', { gasto: 6.1, imp: 2100, frec: 1.3, ctr: 0.6, res: 11 }, cl, { miniatura: img('#A3266B', '#6B3FB5', 'VIDEO'), titulo: 'Monturas en 15 segundos', texto: 'Las monturas de otoño, una por una.', llamada: 'Más información' },
      { problemas: ['El video no tiene la proporción 9:16 en todas sus partes: Meta lo recorta en historias y reels.'] })];
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

  const campanas = [c1, c2, c3], hoy = +(c1.presupuesto.usd * 0.9 + j2.presupuesto.usd * 0.95).toFixed(2);
  return {
    configurado: true, motivo: '', ejemplo: true,
    cuenta: { id: 'act_000000000', nombre: 'PanaClaw (ejemplo)', estado: 'ACTIVE', estadoTexto: 'Activa', moneda: 'USD', zona: 'America/Panama', gastado: 1240.55, spendCap: null, saldo: 0 },
    topes: { diario: 15, mensual: 300, campana: 150 },
    gasto: { hoy, semana: +(c1.cifras.gasto / f + c2.cifras.gasto / f).toFixed(2), mes: 176.4 },
    avisos: [{ nivel: 'bad', texto: 'Un anuncio fue rechazado: «Combo lentes · antes y después». Mira el motivo en su detalle.' },
      { nivel: 'warn', texto: `El gasto de hoy va por el ${Math.round(hoy / 15 * 100)} % de tu tope diario (15 US$).` },
      { nivel: 'info', texto: '«Mensajes por WhatsApp — Combo lentes» está aprendiendo: mejor no tocarla unos días.' }],
    resumen: { resultados7d: 216, costoPorResultado7d: 0.4, tendencia: { gasto: 8.5, resultados: 14.2, costo: -5.1 } },
    campanas, sincronizadaAt: new Date(ahora - 7 * 6e4).toISOString(), error: null, uso: { pct: 12, ritmo: 'normal', frenadoHasta: null, motivo: '' },
  };
}
export const historialDeEjemplo = () => ({ items: [] }); // A1: todavía nadie cambia nada
