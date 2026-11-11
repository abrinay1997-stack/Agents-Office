// @ts-check
// LOS ANUNCIOS DE LA COMPETENCIA (11 nov 2026) — puro. La Biblioteca de anuncios de Meta, leída por Scrape Creators (fuera de la UE la API de
// Meta solo da anuncios de política; Scrape Creators lee la Biblioteca pública entera). La consulta, los parámetros y la tarjeta de cada
// anuncio son los del calendario de Juancito Ads (metodo/scrape-creators.mjs, portado tal cual). Lo de aquí es lo que la oficina AÑADE:
//
//  · la SEÑAL de un anuncio sin gastar en un modelo: nadie paga semanas por algo que no vende. Días activo, más si sigue corriendo y si
//    tiene varias versiones (la misma idea probada con variantes). Es la cuenta de «Lo mejor del momento» del calendario.
//  · la LECTURA de un anunciante: cuántos corre, con qué formatos, a dónde lleva (WhatsApp o web), qué llamados usa, cuánto aguantan
//    y cuáles son sus ganadores. Es código, no IA: no cuesta nada y no inventa.
//  · las PREGUNTAS DEL CURSO para analizar cada ganador (problema, nivel de consciencia, tipo de arte, sesgo, oferta, llamado, etapa del
//    ciclo): Dimitri y el agente de anuncios las contestan LEYENDO el anuncio, con los números y el ciclo del negocio delante.
//
// Todo texto de un anuncio lo escribió un tercero: quien lo enseña a un modelo lo trata como DATO (safety.injectionIn) y nunca como orden.
import { consultaSC, pedidoDeAnuncios, anuncioSC, empresaSC, mensajeErrorSC, claveDeCache } from '../metodo/scrape-creators.mjs';
import { TIPOS_ARTE, SESGOS } from '../metodo/tipos-arte.mjs';
import { NIVELES_CONSCIENCIA } from '../metodo/consciencia.mjs';
import { ETAPAS_CICLO } from '../metodo/ciclo-ventas.mjs';

export { consultaSC, pedidoDeAnuncios, anuncioSC, empresaSC, mensajeErrorSC, claveDeCache };

export const HORAS_CACHE = 12; // la misma búsqueda no se paga dos veces en medio día
export const HORAS_CACHE_EMPRESAS = 72;
export const MAX_CACHE = 16; // búsquedas guardadas (lo más viejo se va)
export const MAX_ANUNCIOS = 30; // por búsqueda (una página)
export const MAX_COMPETIDORES = 12;
export const TOPE_SEMANA_DEFECTO = 10; // créditos por semana (cada búsqueda nueva es uno)

const corto = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const dia = (ms) => new Date(ms).toISOString().slice(0, 10);

/** El lunes (UTC) de la semana de un instante: los créditos se cuentan de lunes a domingo. */
export function semanaDe(ms = Date.now()) {
  const d = new Date(ms), n = (d.getUTCDay() + 6) % 7;
  return dia(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - n));
}

/** Los días que lleva (o estuvo) corriendo un anuncio. Sin fecha de inicio, 0. */
export function diasActivo(a, ahora = Date.now()) {
  const ini = Date.parse(a?.inicio || ''); if (!Number.isFinite(ini)) return 0;
  const fin = a?.activo ? ahora : Number.isFinite(Date.parse(a?.fin || '')) ? Date.parse(a.fin) : ahora;
  const soloDia = (ms) => Date.parse(dia(ms)); // por días de calendario: la Biblioteca da la fecha de inicio sin hora
  return Math.max(0, Math.round((soloDia(fin) - soloDia(ini)) / 864e5));
}

/** La señal: días activo (tope 180) × 1,25 si sigue corriendo × 25 % más por cada versión extra (hasta 8). La misma cuenta del calendario. */
export function senalDeAnuncio(a, ahora = Date.now()) {
  const dias = Math.min(180, diasActivo(a, ahora));
  const versiones = Math.max(1, Math.min(8, (a?.versiones?.length || 0) || (a?.relacionados || 0) || 1));
  return Math.round(dias * (a?.activo ? 1.25 : 1) * (1 + 0.25 * (versiones - 1)) * 100) / 100;
}

/** A dónde lleva: WhatsApp, Messenger, Instagram o una web (su dominio). */
export function destinoDe(a) {
  const u = String(a?.destino || ''), cta = String(a?.cta || '').toLowerCase();
  let host = ''; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch { /* sin enlace */ }
  if (/(^|\.)wa\.me$|whatsapp\.com$/.test(host) || /whatsapp/.test(cta)) return { tipo: 'whatsapp', texto: 'WhatsApp' };
  if (/(^|\.)m\.me$|messenger\.com$/.test(host) || /messenger|enviar mensaje|send message/.test(cta)) return { tipo: 'mensajes', texto: 'mensajes' };
  if (/instagram\.com$/.test(host)) return { tipo: 'instagram', texto: 'Instagram' };
  return host ? { tipo: 'web', texto: host } : { tipo: '', texto: '' };
}

/** Lo que se guarda y se enseña de un anuncio: la tarjeta del calendario, recortada, con su señal y su destino. Las direcciones del CDN caducan: no se guardan. */
export function fichaAnuncio(a, ahora = Date.now()) {
  const d = destinoDe(a);
  return {
    id: a.id, pagina: a.pagina, pageId: a.pageId, activo: Boolean(a.activo), inicio: a.inicio ? String(a.inicio).slice(0, 10) : '', fin: a.fin ? String(a.fin).slice(0, 10) : '',
    plataformas: a.plataformas || [], formato: a.formato, texto: corto(a.texto, 700), titulo: corto(a.titulo, 160), cta: corto(a.cta, 40), destino: d.texto, destinoTipo: d.tipo,
    versiones: (a.versiones?.length || 0) || 0, relacionados: a.relacionados || 0, enlace: a.enlace, dias: diasActivo(a, ahora), senal: senalDeAnuncio(a, ahora),
    miniatura: a.imagenes?.[0] || '', video: Boolean(a.videos?.length),
  };
}

const cuenta = (lista) => { const m = new Map(); for (const x of lista) if (x) m.set(x, (m.get(x) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
const mediana = (l) => { const s = l.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const primeraLinea = (t) => corto(String(t || '').split(/\n|(?<=[.!?¿¡])\s/)[0], 140);

/**
 * La lectura de una lista de fichas (un anunciante o una palabra clave), sin modelo: qué corre, cómo y qué le aguanta.
 * → { total, activos, formatos, destinos, llamados, plataformas, diasMediana, ganadores: [ficha], ganchos: [texto], anunciantes }
 */
export function lecturaDe(fichas = []) {
  const l = fichas.filter((f) => f?.id);
  const orden = [...l].sort((a, b) => b.senal - a.senal);
  return {
    total: l.length, activos: l.filter((f) => f.activo).length,
    formatos: cuenta(l.map((f) => f.formato)), destinos: cuenta(l.map((f) => f.destinoTipo || '')), llamados: cuenta(l.map((f) => f.cta)).slice(0, 5),
    plataformas: cuenta(l.flatMap((f) => f.plataformas)).slice(0, 5), diasMediana: Math.round(mediana(l.map((f) => f.dias))),
    anunciantes: cuenta(l.map((f) => f.pagina)).slice(0, 8),
    ganadores: orden.slice(0, 5),
    ganchos: [...new Set(orden.map((f) => primeraLinea(f.texto || f.titulo)).filter(Boolean))].slice(0, 8),
  };
}

const NOMBRE_FORMATO = { imagen: 'imagen', video: 'video', carrusel: 'carrusel' };
const NOMBRE_DESTINO = { whatsapp: 'WhatsApp', mensajes: 'mensajes', instagram: 'Instagram', web: 'web' };
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

/** Las preguntas del curso para analizar un anuncio, con los valores que valen (los ids del método). Una vez por respuesta. */
export function marcoDeAnalisis() {
  return [
    'CÓMO ANALIZAR CADA GANADOR (método de campañas; contesta leyendo el anuncio, sin inventar lo que no se ve):',
    '· Problema que ataca (uno, en una frase) y a quién le habla.',
    `· Nivel de consciencia: ${NIVELES_CONSCIENCIA.map((n) => n.nombre.toLowerCase()).join(' · ')}.`,
    `· Etapa del ciclo para la que sirve: ${ETAPAS_CICLO.map((e) => e.nombre.toLowerCase()).join(' · ')}.`,
    `· Tipo de arte: ${TIPOS_ARTE.map((t) => t.nombre.toLowerCase()).join(' · ')}.`,
    `· Sesgo que usa: ${SESGOS.map((s) => s.nombre.toLowerCase()).join(' · ')}.`,
    '· Oferta (lo que recibe quien responde) y llamado (qué pide hacer y a dónde lleva).',
    '· Por qué aguanta (lleva días corriendo: algo le funciona) y la idea PROPIA que deja: su forma, nunca su texto ni su marca.',
  ].join('\n');
}

/** Una ficha en una línea larga (para un modelo): lo que dice y lo que se sabe de él. */
export function lineaAnuncio(f, i = null) {
  const que = [f.activo ? `ACTIVO hace ${f.dias} días` : `corrió ${f.dias} días`, NOMBRE_FORMATO[f.formato] || f.formato, f.versiones > 1 ? `${f.versiones} versiones` : f.relacionados > 1 ? `${f.relacionados} variantes` : '',
    f.plataformas?.length ? f.plataformas.join('/') : '', f.cta ? `botón «${f.cta}»` : '', f.destino ? `lleva a ${f.destino}` : ''].filter(Boolean).join(' · ');
  return `${i === null ? '-' : `${i + 1}.`} [${f.id}] ${f.pagina || 'anunciante'} — ${que}${f.titulo ? `\n   Título: ${f.titulo}` : ''}${f.texto ? `\n   Texto: ${f.texto}` : ''}`;
}

/** La lectura en palabras + los ganadores con su texto + el marco de análisis. `de`: de qué búsqueda es. */
export function textoLectura(fichas, { de = '', max = 5, conMarco = true, cache = false, at = null } = {}) {
  const L = lecturaDe(fichas);
  if (!L.total) return `Anuncios de la competencia${de ? ` (${de})` : ''}: no hay anuncios con esos filtros en la Biblioteca de Meta.`;
  const lista = (pares, nombres = {}) => pares.map(([k, n]) => `${nombres[k] || k || 'sin dato'} ${pct(n, L.total)} %`).join(', ');
  const out = [
    `ANUNCIOS DE LA COMPETENCIA${de ? ` · ${de}` : ''}: ${L.total} leídos de la Biblioteca de anuncios de Meta, ${L.activos} activos${at ? ` (leído ${String(at).slice(0, 16).replace('T', ' ')}${cache ? ', de la caché: no gastó crédito' : ''})` : ''}.`,
    `Formatos: ${lista(L.formatos, NOMBRE_FORMATO)}. Llevan a: ${lista(L.destinos, NOMBRE_DESTINO)}. Un anuncio suyo dura de mediana ${L.diasMediana} días.`,
    L.llamados.length ? `Botones más usados: ${L.llamados.map(([k, n]) => `«${k}» (${n})`).join(', ')}.` : '',
    L.anunciantes.length > 1 ? `Quién anuncia: ${L.anunciantes.map(([k, n]) => `${k} (${n})`).join(', ')}.` : '',
    `GANADORES (los que más aguantan; la señal son días activos, más si sigue y si tiene versiones):`,
    ...L.ganadores.slice(0, max).map((f, i) => lineaAnuncio(f, i)),
    L.ganchos.length ? `Primeras líneas que usan: ${L.ganchos.map((g) => `«${g}»`).join(' · ')}` : '',
    conMarco ? marcoDeAnalisis() : '',
  ];
  return out.filter(Boolean).join('\n');
}

/** Un competidor guardado, limpio: { nombre, pageId?, pais?, nota? }. */
export function limpiarCompetidor(x = {}) {
  const nombre = corto(x.nombre, 80), pageId = /^\d{3,30}$/.test(String(x.pageId ?? '')) ? String(x.pageId) : '';
  if (!nombre && !pageId) return null;
  const pais = /^[A-Za-z]{2}$/.test(String(x.pais ?? '')) ? String(x.pais).toUpperCase() : '';
  return { nombre: nombre || `página ${pageId}`, ...(pageId ? { pageId } : {}), ...(pais ? { pais } : {}), ...(corto(x.nota, 160) ? { nota: corto(x.nota, 160) } : {}) };
}
export const claveCompetidor = (c) => (c.pageId ? `p:${c.pageId}` : `n:${c.nombre.toLowerCase()}`);
