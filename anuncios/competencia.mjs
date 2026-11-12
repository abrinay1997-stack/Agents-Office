// LOS ANUNCIOS DE LA COMPETENCIA en la oficina (11 nov 2026): la llamada a Scrape Creators con su llave, la caché, el tope semanal de
// créditos, los competidores guardados y las rutas. Lo puro, en anuncios/competencia-core.mjs.
//
//   · La llave es SCRAPECREATORS_API_KEY (variable de entorno en la computadora; secreto del Worker en la nube). Va SOLO en la cabecera
//     `x-api-key`: nunca en una dirección, en un archivo, en un error ni en una respuesta.
//   · Cada búsqueda nueva gasta UN crédito. La misma búsqueda vale 12 h desde la caché (data/anuncios/competencia.json; las empresas, 72 h)
//     y no gasta. Hay un TOPE por semana (Ajustes → Anuncios, `anuncios.competenciaTopeSemana`; 0 = apagado): pasado el tope, solo la caché.
//     Los agentes y las lecturas automáticas nunca pasan del tope; el dueño tampoco (lo sube en Ajustes si quiere más).
//   · Solo LEE la Biblioteca pública de anuncios. No toca la cuenta publicitaria, no descarga archivos y no guarda direcciones del CDN (caducan).
//
// RUTAS (las despacha anuncios/rutas.mjs; iguales en local y en la nube):
//   GET    /api/anuncios/competencia                       → { configurado, motivo, semana: { usados, tope }, competidores, recientes }
//   GET    /api/anuncios/competencia/empresas?q=           → { empresas: [{ pageId, nombre, categoria, seguidores, pais, instagram }], cache }
//   GET    /api/anuncios/competencia/anuncios?empresa=|pageId=|q=&pais=&estado=&medio=&orden= → { consulta, anuncios: [ficha], lectura, texto, cache, semana }
//   POST   /api/anuncios/competencia/competidores { nombre, pageId?, pais?, nota? } → { ok, competidores } (dueño y Dimitri)
//   DELETE /api/anuncios/competencia/competidores?clave=   → { ok, competidores } (solo el dueño)
//   GET    /api/anuncios/competencia/texto?…               → { texto } (Dimitri, agentes, asistente; mismos parámetros que /anuncios; sin
//                                                            ninguno, la lectura de los competidores guardados que ya estén en la caché)
// NADA de esto se ha probado contra Scrape Creators real: los tests usan un `fetch` de mentira con la forma de su documentación.
import fs from 'node:fs';
import path from 'node:path';
import { renombrar } from '../fs-seguro.mjs';
import { quienDe } from './acciones.mjs';
import { SC_BASE } from '../metodo/scrape-creators.mjs';
import { consultaSC, pedidoDeAnuncios, anuncioSC, empresaSC, mensajeErrorSC, claveDeCache, fichaAnuncio, lecturaDe, textoLectura, limpiarCompetidor, claveCompetidor, semanaDe,
  HORAS_CACHE, HORAS_CACHE_EMPRESAS, MAX_CACHE, MAX_ANUNCIOS, MAX_COMPETIDORES, TOPE_SEMANA_DEFECTO } from './competencia-core.mjs';

export class ErrorSC extends Error { constructor(mensaje, status = 502) { super(mensaje); this.status = status; } }
const estadoPara = (s) => (s === 402 ? 402 : s === 404 ? 404 : s === 400 ? 400 : s === 403 ? 409 : 502);
const leerJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? d; } catch { return d; } };
function escribirJSON(f, v) { fs.mkdirSync(path.dirname(f), { recursive: true }); const tmp = `${f}.tmp-${process.pid}`; fs.writeFileSync(tmp, JSON.stringify(v)); renombrar(tmp, f); }

/**
 * @param {object} o
 * @param {string} o.dir          data/anuncios
 * @param {() => string} o.llave  la llave de Scrape Creators ('' si no hay)
 * @param {() => object} [o.ajustes] los de Anuncios (competenciaTopeSemana, competenciaPais)
 * @param {Function} [o.fetchFn]
 */
export function crearCompetencia({ dir, llave = () => '', ajustes = () => ({}), fetchFn = (...a) => fetch(...a), ahora = () => Date.now(), auditar = () => {} }) {
  const F = path.join(dir, 'competencia.json');
  const estado = () => { const e = leerJSON(F, {}); return { competidores: Array.isArray(e.competidores) ? e.competidores : [], cache: e.cache && typeof e.cache === 'object' ? e.cache : {}, creditos: e.creditos && typeof e.creditos === 'object' ? e.creditos : {} }; };
  const tope = () => { const t = Number(ajustes()?.competenciaTopeSemana); return Number.isFinite(t) && t >= 0 ? Math.min(500, Math.floor(t)) : TOPE_SEMANA_DEFECTO; };
  const paisDefecto = () => (/^[A-Za-z]{2}$/.test(String(ajustes()?.competenciaPais || '')) ? String(ajustes().competenciaPais).toUpperCase() : 'PA');
  const semana = (e = estado()) => ({ usados: Number(e.creditos[semanaDe(ahora())]) || 0, tope: tope(), desde: semanaDe(ahora()) });
  const configurado = () => Boolean(llave());
  const motivo = () => (configurado() ? '' : 'Falta la llave de Scrape Creators: ponla en la variable SCRAPECREATORS_API_KEY (en la nube, como secreto del Worker). Sin ella no se puede leer la Biblioteca de anuncios.');

  async function pedir(ruta, params) {
    const url = `${SC_BASE}${ruta}?${new URLSearchParams(params)}`;
    let ultimo = 0;
    for (let intento = 0; intento < 2; intento++) { // un 5xx se reintenta UNA vez
      const r = await fetchFn(url, { headers: { 'x-api-key': llave(), accept: 'application/json' } });
      if (r.ok) { const d = await r.json().catch(() => null); if (!d || d.success === false) throw new ErrorSC(mensajeErrorSC(502, String(d?.message ?? '').slice(0, 200)), 502); return d; }
      ultimo = r.status;
      if (r.status < 500) { const det = await r.json().then((j) => String(j?.message ?? j?.error ?? '').slice(0, 200)).catch(() => ''); throw new ErrorSC(mensajeErrorSC(r.status, det), estadoPara(r.status)); }
    }
    throw new ErrorSC(mensajeErrorSC(ultimo), 502);
  }

  // Las consultas que PAGAN van de una en una: dos a la vez leían el mismo `usados` y las dos pasaban el tope de la semana (una gastaba un crédito de más).
  let enFila = Promise.resolve();
  const enTurno = (fn) => { const r = enFila.then(fn, fn); enFila = r.then(() => {}, () => {}); return r; };

  /** Con la caché delante. `armar(datos)` reduce la respuesta a lo que se guarda. → { valor, cache, at } */
  function consultar(ruta, params, o) {
    const clave = claveDeCache(ruta, params), g = estado().cache[clave];
    if (g && ahora() - Date.parse(g.at) < o.horas * 3600e3) return Promise.resolve({ valor: g.valor, cache: true, at: g.at }); // de la caché: ni paga ni espera turno
    return enTurno(() => pagar(ruta, params, o));
  }

  async function pagar(ruta, params, { horas, armar, quien = 'dueno' }) {
    const clave = claveDeCache(ruta, params), e = estado(), g = e.cache[clave];
    if (g && ahora() - Date.parse(g.at) < horas * 3600e3) return { valor: g.valor, cache: true, at: g.at };
    if (!configurado()) throw new ErrorSC(motivo(), 503);
    const s = semana(e);
    if (s.usados >= s.tope) {
      if (g) return { valor: g.valor, cache: true, at: g.at, vieja: true }; // sin créditos esta semana: lo último que se leyó, dicho
      throw new ErrorSC(s.tope === 0 ? 'Leer anuncios de la competencia está apagado (el tope de créditos por semana es 0 en Ajustes → Anuncios).'
        : `Esta semana ya se usaron los ${s.tope} créditos de Scrape Creators que fijaste (Ajustes → Anuncios → «Créditos por semana»). Vuelve el lunes o sube el tope.`, 429);
    }
    const datos = await pedir(ruta, params), at = new Date(ahora()).toJSON();
    const valor = armar(datos), e2 = estado();
    e2.creditos = { [s.desde]: (Number(e2.creditos[s.desde]) || 0) + 1 }; // solo la semana en curso
    e2.cache[clave] = { at, valor };
    const claves = Object.keys(e2.cache).sort((a, b) => Date.parse(e2.cache[b].at) - Date.parse(e2.cache[a].at));
    for (const k of claves.slice(MAX_CACHE)) delete e2.cache[k];
    escribirJSON(F, e2);
    try { auditar({ que: 'competencia', ruta, quien }); } catch { /* el registro no tumba la lectura */ }
    return { valor, cache: false, at };
  }

  async function empresas(q, o = {}) {
    const query = String(q ?? '').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (!query) throw new ErrorSC('Escribe el nombre de la empresa.', 400);
    const r = await consultar('/v1/facebook/adLibrary/search/companies', { query }, { horas: HORAS_CACHE_EMPRESAS, quien: o.quien, armar: (d) => (d.searchResults ?? []).map(empresaSC).filter((x) => x.pageId).slice(0, 20).map(({ foto, ...x }) => x) });
    return { empresas: r.valor, cache: r.cache };
  }

  /** Los anuncios de una empresa (por su pageId o su nombre) o de una palabra clave: una página, ya como fichas con su señal. */
  async function anuncios(entrada = {}, o = {}) {
    const { consulta, errores } = consultaSC({ pais: paisDefecto(), ...entrada, modo: entrada.q && !entrada.empresa && !entrada.pageId ? 'palabra' : 'empresa' });
    if (errores.length) throw new ErrorSC(errores.join(' '), 400);
    const { ruta, params } = pedidoDeAnuncios(consulta);
    const r = await consultar(ruta, params, { horas: HORAS_CACHE, quien: o.quien, armar: (d) => (d.results ?? d.searchResults ?? []).map(anuncioSC).filter((a) => a.id).slice(0, MAX_ANUNCIOS).map((a) => fichaAnuncio(a, ahora())) });
    const de = consulta.modo === 'palabra' ? `«${consulta.q}» en ${consulta.pais}` : `${consulta.empresa || r.valor[0]?.pagina || 'página ' + consulta.pageId} · ${consulta.pais}`;
    return { consulta, anuncios: r.valor, lectura: lecturaDe(r.valor), cache: r.cache, at: r.at, vieja: Boolean(r.vieja), de, semana: semana() };
  }

  function guardarCompetidor(x) {
    const c = limpiarCompetidor(x); if (!c) throw new ErrorSC('Falta el nombre o la página del competidor.', 400);
    const e = estado(), k = claveCompetidor(c), l = e.competidores.filter((y) => claveCompetidor(y) !== k);
    if (l.length >= MAX_COMPETIDORES) throw new ErrorSC(`Ya hay ${MAX_COMPETIDORES} competidores guardados: quita uno antes.`, 409);
    escribirJSON(F, { ...e, competidores: [...l, c] });
    return [...l, c];
  }
  function quitarCompetidor(clave) { const e = estado(), l = e.competidores.filter((y) => claveCompetidor(y) !== String(clave)); escribirJSON(F, { ...e, competidores: l }); return l; }

  /** Lo que ya está leído (sin gastar): la última búsqueda de cada entrada de la caché de anuncios. */
  function recientes() {
    const e = estado();
    return Object.entries(e.cache).filter(([k, v]) => /adLibrary\/(company|search)\/ads/.test(k) && Array.isArray(v.valor)).sort((a, b) => Date.parse(b[1].at) - Date.parse(a[1].at))
      .map(([k, v]) => ({ clave: k, at: v.at, total: v.valor.length, de: v.valor[0]?.pagina || '', activos: v.valor.filter((f) => f.activo).length }));
  }

  function resumen() { const e = estado(); return { configurado: configurado(), motivo: motivo(), semana: semana(e), competidores: e.competidores, recientes: recientes().slice(0, 8), paisDefecto: paisDefecto() }; }

  /** Para Dimitri y los agentes. Con una búsqueda, su lectura; sin ella, qué competidores hay y qué se leyó ya (no gasta). */
  async function texto(entrada = {}, o = {}) {
    if (entrada.empresa || entrada.pageId || entrada.q) { const r = await anuncios(entrada, o); return textoLectura(r.anuncios, { de: r.de, cache: r.cache, at: r.at }) + (r.vieja ? '\n(Sin créditos esta semana: es la última lectura guardada.)' : ''); }
    const r = resumen();
    const l = [`COMPETENCIA EN ANUNCIOS: ${r.configurado ? `conectada (Scrape Creators). Créditos de esta semana: ${r.semana.usados} de ${r.semana.tope}.` : r.motivo}`];
    l.push(r.competidores.length ? `Competidores guardados: ${r.competidores.map((c) => `${c.nombre}${c.pageId ? ` [página ${c.pageId}]` : ''}${c.nota ? ` (${c.nota})` : ''}`).join('; ')}.` : 'No hay competidores guardados todavía: busca una empresa por su nombre y guárdala.');
    if (r.recientes.length) l.push(`Ya leído (no gasta volver a mirarlo en 12 h): ${r.recientes.map((x) => `${x.de || 'búsqueda'} · ${x.total} anuncios, ${x.activos} activos`).join('; ')}.`);
    return l.join('\n');
  }

  /** /api/anuncios/competencia[/…]. → true si la atendió. */
  async function rutas(req, res, url, { json, body }) {
    const p = url.pathname, M = req.method;
    if (p !== '/api/anuncios/competencia' && !p.startsWith('/api/anuncios/competencia/')) return false;
    const sub = p.slice('/api/anuncios/competencia'.length).replace(/^\//, ''), q = url.searchParams;
    const b = M === 'GET' || M === 'DELETE' ? {} : await body(req).catch(() => ({}));
    const quien = quienDe(b?.por ?? q.get('por') ?? undefined);
    const no = (code, error) => (json(res, code, { error, motivo: error }), true);
    if (quien === 'otro') return no(403, 'quién pide no se reconoce');
    const entrada = () => Object.fromEntries(['empresa', 'pageId', 'q', 'pais', 'estado', 'medio', 'orden'].filter((k) => q.get(k)).map((k) => [k, q.get(k)]));
    try {
      if (M === 'GET') {
        if (!sub) return json(res, 200, resumen()), true;
        if (sub === 'empresas') return json(res, 200, await empresas(q.get('q'), { quien })), true;
        if (sub === 'anuncios') { const r = await anuncios(entrada(), { quien }); return json(res, 200, { ...r, texto: textoLectura(r.anuncios, { de: r.de, cache: r.cache, at: r.at }) }), true; }
        if (sub === 'texto') return json(res, 200, { texto: await texto(entrada(), { quien }) }), true;
        return no(404, 'no existe');
      }
      if (quien === 'agente' || quien === 'asistente' || quien === 'piloto') return no(403, 'guardar o quitar competidores es del dueño; tú puedes leerlos');
      if (sub === 'competidores' && M === 'POST') return json(res, 200, { ok: true, competidores: guardarCompetidor(b) }), true;
      if (sub === 'competidores' && M === 'DELETE') { if (quien !== 'dueno') return no(403, 'quitar un competidor es del dueño'); return json(res, 200, { ok: true, competidores: quitarCompetidor(q.get('clave')) }), true; }
      return no(405, 'método no admitido');
    } catch (e) {
      if (e instanceof ErrorSC) return json(res, e.status, { error: e.message, motivo: e.message, semana: semana() }), true;
      throw e;
    }
  }

  return { configurado, resumen, empresas, anuncios, texto, guardarCompetidor, quitarCompetidor, rutas, semana };
}
