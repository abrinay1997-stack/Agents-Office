// ============================================================
// Agents Office — Anuncios de Meta, Fase A5 (9 oct 2026): LAS SUGERENCIAS. Lo que el diagnóstico (anuncios/diagnostico.mjs) propone,
// guardado en data/anuncios/sugerencias.json (escritura atómica; no viaja por GitHub), con lo que el dueño hizo con cada una.
// docs/plan-meta-anuncios-y-bandeja-2026-10-09.md §5 (Fase A5).
//
// Estados: viva · pospuesta («recordármelo en 3 días») · descartada (no vuelve en 7 días) · aplicada. Lo aplicado pasa a `hechas` (con un
// id propio, `<id>~<marca>`) y no vuelve a proponerse hasta pasados `esperarDias`: Meta tarda en reflejar un cambio. Una viva que el
// diagnóstico ya no ve (se arregló sola, el dueño la cambió en Meta) se quita sin ruido. Las que deja un agente (`sugerir_mejora_anuncio`)
// no las quita el diagnóstico: caducan a los CADUCA_AGENTE_DIAS.
// QUÉ PASÓ DESPUÉS: a los `resultadoDias` días de aplicar una, se comparan sus cifras de después con las de antes (medirResultado). Si la
// sugerencia vino de una tarea de un agente (ada) que citó notas en «Fuentes:», eso enseña a la memoria del Cerebro como Contenido F4
// (`aprender`, que serve.mjs conecta a memory.reinforce, idempotente por sugerencia). Si no, solo se guarda el resultado.
//
// APLICAR (crearAplicador): un cambio de la A2 se hace POR anuncios/acciones.mjs, con sus reglas (quién, topes, Meta). Si gasta, la primera
// llamada devuelve `confirmar` y NO cambia nada; el segundo clic es de la página o de Telegram (/api/anuncios/accion con `confirmacion`),
// y entonces la sugerencia queda aplicada (por el token, que se recuerda aquí, o por `sugerencia: <id>`). `borrador` y `creativos` crean
// un borrador de campaña y/o una TAREA para el agente de anuncios (que propone; nunca genera imágenes por su cuenta ni toca Meta).
// QUIÉN: el dueño todo; Dimitri lo que baja el gasto (y de lo que gasta, pedir la cifra); el asistente solo lo que baja el gasto; un
// agente nada (403) salvo dejar una sugerencia nueva.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { mezclarUmbrales, REGLAS, CAMBIOS, GASTA, UMBRALES_REQUERIDOS } from './diagnostico.mjs';
import { quienDe, LIBRES, TIPOS } from './acciones.mjs';
import { buscar } from './modelo.mjs';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)

export const CADUCA_AGENTE_DIAS = 14, MAX_AGENTE_VIVAS = 10, MAX_HECHAS = 200;
const ESTADOS = ['viva', 'pospuesta', 'descartada', 'aplicada'];
const DIA = 864e5;
const escribirJSON = (f, datos) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(datos, null, 1)); renombrar(f + '.tmp', f); };
const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };
const iso = ms => new Date(ms).toISOString();
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * Los umbrales de fábrica (biblioteca/<colección>/campanas-pagadas/umbrales.json) con los del dueño encima
 * (<cerebro>/Agents Office/biblioteca/campanas-pagadas/umbrales.json): la misma regla de biblioteca.mjs, «gana el del dueño».
 * → { valores, umbrales, delDueno, problemas, archivo }
 */
export function cargarUmbrales({ raiz, brainPath = null } = {}) {
  const base = path.join(raiz, 'biblioteca');
  const fabricaArchivo = (fs.existsSync(base) ? fs.readdirSync(base) : []).map(c => path.join(base, c, 'campanas-pagadas', 'umbrales.json')).find(f => fs.existsSync(f));
  const fabrica = fabricaArchivo ? leerJSON(fabricaArchivo, null) : null;
  const propio = brainPath ? path.join(brainPath, 'Agents Office', 'biblioteca', 'campanas-pagadas', 'umbrales.json') : null;
  let delDueno = null, problemaDueno = null;
  if (propio && fs.existsSync(propio)) { try { delDueno = JSON.parse(fs.readFileSync(propio, 'utf8')); } catch (e) { problemaDueno = `del dueño: ${path.basename(propio)} no es JSON (${e.message}) — se usan los de fábrica`; } }
  if (!fabrica) return { valores: {}, umbrales: {}, delDueno: [], problemas: ['no encuentro biblioteca/…/campanas-pagadas/umbrales.json'], archivo: null };
  const r = mezclarUmbrales(fabrica, delDueno);
  return { ...r, problemas: [...r.problemas, ...(problemaDueno ? [problemaDueno] : [])], archivo: fabricaArchivo };
}

/**
 * @param {object} o
 * @param {string} o.dir       data/anuncios
 * @param {Function} o.umbrales () → { clave: valor } (para descartarDias, posponerDias, esperarDias, resultadoDias)
 */
export function crearSugerencias({ dir, ahora = () => Date.now(), umbrales = () => ({}) }) {
  const F = path.join(dir, 'sugerencias.json');
  const vacio = () => ({ v: 1, items: {}, hechas: [], tokens: {}, bloqueo: {}, escalarAvisado: null, notas: [], sinObjetivo: null, cpa: null, at: null });
  const leer = () => ({ ...vacio(), ...leerJSON(F, {}) });
  const U = k => { const v = Number(umbrales()?.[k]); return v > 0 ? v : ({ descartarDias: 7, posponerDias: 3, esperarDias: 3, resultadoDias: 7 })[k]; };
  let st = leer();
  const guardar = () => escribirJSON(F, st);

  /** Tras cada diagnóstico: las nuevas entran vivas, las que siguen se ponen al día, las que ya no se ven se quitan. */
  function actualizar(diag = {}) {
    st = leer();
    const t = ahora(), vistas = new Set();
    for (const s of diag.sugerencias || []) {
      vistas.add(s.id);
      const prev = st.items[s.id];
      if (st.bloqueo[s.id] && st.bloqueo[s.id] > t) continue; // recién aplicada: Meta tarda en reflejarlo
      if (!prev) { st.items[s.id] = { ...s, origen: 'diagnostico', estado: 'viva', creadaAt: iso(t), vistaAt: iso(t) }; continue; }
      const { estado, creadaAt, descartadaAt, posponerHasta, origen, tarea, agente } = prev;
      let e = estado, c = creadaAt;
      if (estado === 'pospuesta' && Date.parse(posponerHasta) <= t) e = 'viva';
      if (estado === 'descartada' && t - Date.parse(descartadaAt) >= U('descartarDias') * DIA) { e = 'viva'; c = iso(t); }
      st.items[s.id] = { ...s, origen: origen || 'diagnostico', ...(tarea ? { tarea, agente } : {}), estado: e, creadaAt: c, vistaAt: iso(t), ...(e === 'descartada' ? { descartadaAt } : {}), ...(e === 'pospuesta' ? { posponerHasta, hasta: posponerHasta } : {}) };
    }
    for (const [id, x] of Object.entries(st.items)) {
      const viejaAgente = x.origen === 'agente' && t - Date.parse(x.creadaAt) >= CADUCA_AGENTE_DIAS * DIA;
      const descartadaVieja = x.estado === 'descartada' && t - Date.parse(x.descartadaAt) >= U('descartarDias') * DIA && !vistas.has(id);
      if ((x.origen !== 'agente' && !vistas.has(id) && x.estado !== 'descartada') || viejaAgente || descartadaVieja) delete st.items[id];
    }
    for (const [id, hasta] of Object.entries(st.bloqueo)) if (hasta <= t) delete st.bloqueo[id];
    for (const [k, x] of Object.entries(st.tokens)) if (x.vence <= t) delete st.tokens[k];
    if ('notas' in diag) st.notas = (diag.notas || []).slice(0, 40);
    if ('sinObjetivo' in diag) st.sinObjetivo = diag.sinObjetivo ?? null;
    if ('cpa' in diag) st.cpa = diag.cpa ?? null;
    st.at = iso(t);
    guardar();
    return lista();
  }

  const orden = (a, b) => (a.estado === 'viva' ? 0 : 1) - (b.estado === 'viva' ? 0 : 1) || a.prioridad - b.prioridad || String(b.creadaAt).localeCompare(String(a.creadaAt));
  /** GET /api/anuncios/sugerencias → items (vivas primero, luego pospuestas, descartadas y lo aplicado, lo más nuevo primero). */
  function lista() {
    st = leer();
    const vivas = Object.values(st.items).sort(orden), hechas = [...st.hechas].sort((a, b) => String(b.aplicadaAt).localeCompare(String(a.aplicadaAt))).slice(0, 50);
    return [...vivas, ...hechas];
  }
  /** Lo de arriba de la pestaña: el costo objetivo, por qué no lo hay, las notas y los umbrales (valores de umbrales.json; la pestaña Creativos los usa). */
  const estado = () => {
    st = leer(); const u = umbrales() || {};
    return { cpaObjetivo: st.cpa?.valor ?? null, cpaTexto: st.cpa?.texto || null, sinObjetivo: st.sinObjetivo, notas: st.notas, at: st.at, ...(Object.keys(u).length ? { umbrales: { ...u } } : {}) }; // los mismos nombres de umbrales.json (fracciones como fracción)
  };
  const leerUna = id => { st = leer(); return st.items[id] || st.hechas.find(h => h.id === id) || st.hechas.filter(h => h.sugerencia === id).at(-1) || null; }; // por el id de origen también: aplicar dos veces da «ya se aplicó»
  /** Las N vivas más importantes (Dimitri, Telegram). */
  const top = (n = 3) => { st = leer(); return Object.values(st.items).filter(x => x.estado === 'viva').sort(orden).slice(0, n); };

  /** La sugerencia queda aplicada: pasa a `hechas` con su marca, y el diagnóstico no la repite en `esperarDias`. */
  function marcarAplicada(id, { quien = 'dueno', hecho = null } = {}) {
    st = leer();
    const x = st.items[id]; if (!x) return null;
    const t = ahora(), h = { ...x, id: `${id}~${t.toString(36)}`, sugerencia: id, estado: 'aplicada', aplicadaAt: iso(t), aplicadaPor: quien, ...(hecho?.texto ? { hecho: clip(hecho.texto, 300) } : {}) };
    delete st.items[id];
    st.hechas.push(h); st.hechas = st.hechas.slice(-MAX_HECHAS);
    st.bloqueo[id] = t + U('esperarDias') * DIA;
    for (const [k, v] of Object.entries(st.tokens)) if (v.id === id) delete st.tokens[k];
    guardar(); return h;
  }
  function descartar(id) {
    st = leer(); const x = st.items[id]; if (!x) return null;
    x.estado = 'descartada'; x.descartadaAt = iso(ahora()); delete x.posponerHasta; delete x.hasta; guardar(); return x;
  }
  function posponer(id, dias = null) {
    st = leer(); const x = st.items[id]; if (!x) return null;
    const n = Math.min(30, Math.max(1, Math.round(Number(dias) || U('posponerDias'))));
    x.estado = 'pospuesta'; x.posponerHasta = iso(ahora() + n * DIA); x.hasta = x.posponerHasta; guardar(); return x;
  }
  /** El token de una confirmación de gasto pedida desde una sugerencia: al confirmarse, la sugerencia queda aplicada. */
  function registrarToken(token, id, vence) { st = leer(); st.tokens[String(token)] = { id, vence: Date.parse(vence) || ahora() + 5 * 60e3 }; guardar(); }
  const porToken = token => { st = leer(); return st.tokens[String(token || '')]?.id || null; };

  /** Una sugerencia que deja un agente (sugerir_mejora_anuncio). `objeto` ya validado contra lo leído de Meta. */
  function deAgente({ agente, tarea = null, regla, objeto, dato, porque, efecto, cambio }) {
    st = leer();
    const vivas = Object.values(st.items).filter(x => x.origen === 'agente' && x.agente === agente && x.estado === 'viva').length;
    if (vivas >= MAX_AGENTE_VIVAS) return { error: `ya tienes ${MAX_AGENTE_VIVAS} sugerencias sin responder: espera a que el dueño las vea`, status: 429 };
    const id = `agente-${regla}-${String(objeto.id).replace(/[^A-Za-z0-9_]/g, '_').slice(0, 50)}`, t = ahora();
    const s = { id, regla, objeto, dato: clip(dato, 400), porque: clip(porque, 600), cambio, efecto: clip(efecto, 400), riesgo: { reiniciaAprendizaje: false, gastaMas: GASTA.has(cambio.tipo), texto: GASTA.has(cambio.tipo) ? 'Gasta más: si la aplicas, pide tus dos clics con la cifra y pasa por tus topes.' : 'No gasta más.' }, prioridad: ['rechazado', 'problemas', 'cuenta', 'cortar'].includes(regla) ? 1 : ['estructura', 'impulsar'].includes(regla) ? 3 : 2, gasto: GASTA.has(cambio.tipo), origen: 'agente', agente, ...(tarea ? { tarea } : {}), estado: 'viva', creadaAt: iso(t), vistaAt: iso(t) };
    st.items[id] = s; guardar(); return { sugerencia: s };
  }

  /** Las aplicadas que ya pueden medirse. `medir(h)` → resultado | null; `aprender(h, resultado)` → memoria (si vino de una tarea). */
  function cerrarResultados({ medir, aprender = () => {} } = {}) {
    st = leer(); let n = 0;
    for (const h of st.hechas) {
      if (h.resultado || ahora() - Date.parse(h.aplicadaAt) < (U('resultadoDias') + 1) * DIA) continue;
      let r = null; try { r = medir(h); } catch { r = null; }
      if (!r) continue;
      h.resultado = r; n++;
      if (h.tarea && r.r !== null) { try { aprender(h, r); } catch { /* la memoria es un extra */ } }
    }
    if (n) guardar();
    return n;
  }
  /** La sugerencia de escalar del día (como mucho una al día): la marca como avisada y la devuelve. */
  function escalarDelDia(dia) {
    st = leer(); if (st.escalarAvisado === dia) return null;
    const x = Object.values(st.items).filter(s => s.estado === 'viva' && s.regla === 'escalar' && s.cambio?.tipo === 'subir_presupuesto').sort(orden)[0];
    if (!x) return null;
    st.escalarAvisado = dia; guardar(); return x;
  }
  return { actualizar, lista, estado, leer: leerUna, top, marcarAplicada, descartar, posponer, registrarToken, porToken, deAgente, cerrarResultados, escalarDelDia, ESTADOS };
}

/**
 * Aplicar, descartar y posponer (las rutas de la página, Dimitri, el asistente y Telegram) y la sugerencia que deja un agente.
 * @param {object} o
 * @param {object} o.sug         crearSugerencias(...)
 * @param {object} o.acciones    anuncios/acciones.mjs
 * @param {object} o.borradores  anuncios/borradores.mjs
 * @param {Function} o.encargar  async ({ texto, titulo }) → { id, titulo, agent, agente } (una tarea para el agente de anuncios; serve.mjs)
 * @param {Function} o.vista     () → la vista de 7 días (para validar el objeto de una sugerencia de agente)
 */
export function crearAplicador({ sug, acciones, borradores = null, encargar = null, vista = () => null, impulsar = null }) { // A4: `impulsar` = anuncios/impulsar.mjs → impulsar
  const R = (status, cuerpo) => ({ status, cuerpo });
  const no = (status, motivo, extra = {}) => R(status, { error: extra.error || motivo, motivo, ...extra });

  async function aplicar(id, b = {}) {
    const quien = quienDe(b.por);
    if (quien === 'agente' || quien === 'otro') return no(403, 'Los agentes dejan sugerencias; aplicarlas es del dueño.');
    if (quien === 'piloto') return no(403, 'El piloto automático no aplica sugerencias: solo pausa lo que pasó el umbral de cortar.');
    const s = sug.leer(id); if (!s) return no(404, 'Esa sugerencia ya no está (se resolvió sola o se quitó).');
    if (s.estado === 'aplicada') return no(409, 'Esa sugerencia ya se aplicó.', { error: 'estado' });
    const c = s.cambio || {};
    if (quien === 'asistente' && !LIBRES.includes(c.tipo)) return no(403, `«${c.tipo}» no es pausar, bajar un presupuesto ni archivar: desde el asistente solo se baja el gasto. Aplicarla es del dueño, en Anuncios (J).`);
    if (TIPOS.includes(c.tipo)) {
      if (quien === 'dimitri' && GASTA.has(c.tipo) && b.confirmacion) return no(403, 'Confirmar un gasto lo hace el dueño.');
      const r = await acciones.accion({ tipo: c.tipo, id: c.id, ...(c.valor !== undefined ? { valor: c.valor } : {}), por: quien === 'dueno' ? 'dueno' : quien });
      if (r.status === 200 && r.cuerpo.confirmar) { sug.registrarToken(r.cuerpo.confirmar.token, s.id, r.cuerpo.confirmar.vence); return R(200, { ...r.cuerpo, sugerencia: s.id }); }
      if (r.status === 200 && r.cuerpo.ok) { const h = sug.marcarAplicada(s.id, { quien, hecho: r.cuerpo.hecho }); return R(200, { ...r.cuerpo, sugerencia: h }); }
      return r;
    }
    if (quien === 'asistente') return no(403, 'Desde el asistente solo se baja el gasto.');
    if (c.tipo === 'revisar') { const h = sug.marcarAplicada(s.id, { quien, hecho: { texto: 'Marcada como hecha: el cambio lo haces tú en el Administrador de anuncios (o ya lo hiciste).' } }); return R(200, { ok: true, hecho: { tipo: 'revisar', texto: h.hecho }, sugerencia: h }); }
    if (c.tipo === 'impulsar') { // Fase A4: un borrador con esa publicación (nace en la oficina; crearlo en Meta, en pausa, es otro clic del dueño)
      if (!impulsar) return no(409, 'Impulsar no está disponible ahora mismo.', { error: 'impulsar' });
      const r = await impulsar({ id: c.id, por: quien });
      if (r.status !== 200 || !r.cuerpo?.borrador) return r;
      const bo = r.cuerpo.borrador, txt = `${r.cuerpo.ya ? 'Ya tenías' : 'Te dejé'} el borrador «${clip(bo.nombre, 60)}» con esa publicación: revísalo. No se crea nada en Meta hasta que pulses «Crear en Meta (en pausa)», y activarlo te pedirá los dos clics con la cifra.`;
      const h = sug.marcarAplicada(s.id, { quien, hecho: { texto: txt } });
      return R(200, { ok: true, hecho: { tipo: 'impulsar', texto: h.hecho, borrador: bo.id }, sugerencia: h, borrador: bo });
    }
    if (c.tipo === 'borrador' || c.tipo === 'creativos') {
      if (!encargar) return no(409, 'No hay quién lo prepare ahora (falta el agente de anuncios).');
      const v = vista(), r = v ? buscar(v, c.id) : null, o = r?.objeto;
      let borrador = null;
      if (c.tipo === 'borrador' && o && borradores) {
        const k = o.creativo || {};
        try { borrador = borradores.crear({ nombre: `Corregir: ${clip(o.nombre, 60)}`, creativos: [{ texto: k.texto || '', titular: k.titulo || '', ...(k.llamada ? { llamada: k.llamada } : {}) }] }, { de: `agente:${b.agente || 'ada'}` }); } catch { borrador = null; }
      }
      const donde = r ? `${r.tipo === 'anuncio' ? 'el anuncio' : r.tipo === 'conjunto' ? 'el conjunto' : 'la campaña'} «${o.nombre}» (id ${c.id}${r.campana && r.tipo !== 'campana' ? `, campaña «${r.campana.nombre}»` : ''})` : `el objeto ${c.id}`;
      const texto = c.tipo === 'borrador'
        ? `Anuncios: Meta rechazó ${donde}. ${s.dato} Con la habilidad campanas-pagadas, lee el anuncio (ver_anuncio) y propone el texto corregido según lo que dijo Meta, sin prometer nada que no esté en las notas ni en las cifras. ${borrador ? `Déjalo en el borrador ${borrador.id} con mejorar_borrador_campana (ya lleva el texto de ahora).` : 'Déjalo como borrador de campaña con crear_borrador_campana.'} No cambias nada en Meta: el dueño lo revisa y lo crea en pausa. Termina con «Fuentes:».`
        : `Anuncios: ${donde} se cansó. ${s.dato} Con la habilidad campanas-pagadas (y creatividad-anuncios), propone 3 variaciones del mejor anuncio de ese conjunto: cambia el gancho, lo visual o el formato, nunca edites el anuncio que ya corre. Para cada una: el texto, el titular y un prompt para el Estudio. NO generes las imágenes: el dueño las genera desde el Estudio con su costo a la vista. Si ya hay imágenes en la galería que sirvan (buscar_en_galeria), deja las variaciones en un borrador de campaña (crear_borrador_campana). No cambias nada en Meta. Termina con «Fuentes:».`;
      let t;
      try { t = await encargar({ texto, titulo: c.tipo === 'borrador' ? `Corregir el anuncio rechazado «${clip(o?.nombre || c.id, 50)}»` : `Creativos nuevos para «${clip(o?.nombre || c.id, 50)}»` }); }
      catch (e) { return no(409, `No pude encargárselo al agente de anuncios: ${e.message}`); }
      const ag = t?.agente || 'el agente de anuncios';
      const h = sug.marcarAplicada(s.id, { quien, hecho: { texto: c.tipo === 'creativos' ? `Le pedí a ${ag} 3 variaciones de «${clip(o?.nombre || c.id, 50)}» (tarea ${t?.id || '—'}). Las imágenes las generas tú en el Estudio, con su costo a la vista; nada cambia en Meta.` : `Le pedí a ${ag} el texto corregido (tarea ${t?.id || '—'})${borrador ? `; queda en el borrador ${borrador.id}` : ''}. Nada cambia en Meta hasta que lo crees en pausa.` } });
      return R(200, { ok: true, hecho: { tipo: c.tipo, texto: h.hecho, tarea: t?.id || null, ...(borrador ? { borrador: borrador.id } : {}) }, sugerencia: h, tarea: t ? { id: t.id, agent: t.agent || null, titulo: t.titulo || '' } : null, ...(borrador ? { borrador } : {}) });
    }
    return no(400, `«${c.tipo}» no es un cambio que se pueda aplicar.`);
  }

  /** POST /api/anuncios/creativos/<id anuncio>/variaciones: pedir variaciones de un creativo SIN sugerencia (solo el dueño). Una tarea para
   *  el agente de anuncios, que propone textos y prompts; NO genera imágenes (las genera el dueño en el Estudio, con su costo a la vista). */
  async function variaciones(id, b = {}) {
    if (quienDe(b.por) !== 'dueno') return no(403, 'Pedir variaciones lo hace el dueño, desde Anuncios (J).');
    if (!encargar) return no(409, 'No hay quién lo prepare ahora (falta el agente de anuncios).');
    const v = vista(), r = v ? buscar(v, String(id)) : null;
    if (!r || r.tipo !== 'anuncio') return no(404, `No hay ningún anuncio con el id ${id} en lo leído de Meta.`);
    const o = r.objeto, pide = clip(b.pide, 300);
    const texto = `Anuncios: el dueño pide variaciones del anuncio «${o.nombre}» (id ${o.id}, campaña «${r.campana?.nombre || ''}»).${pide ? ` Lo que pide: «${pide}».` : ''} Con la habilidad campanas-pagadas (y creatividad-anuncios), lee el anuncio y sus cifras (ver_anuncio) y propone 3 variaciones: cambia el gancho, lo visual o el formato, nunca edites el anuncio que ya corre. Para cada una: el texto, el titular y un prompt para el Estudio. NO generes las imágenes: el dueño las genera desde el Estudio con su costo a la vista. Si ya hay imágenes en la galería que sirvan (buscar_en_galeria), deja las variaciones en un borrador de campaña (crear_borrador_campana). No cambias nada en Meta. Termina con «Fuentes:».`;
    let t; try { t = await encargar({ texto, titulo: `Variaciones de «${clip(o.nombre, 50)}»` }); } catch (e) { return no(409, `No pude encargárselo al agente de anuncios: ${e.message}`); }
    return R(200, { ok: true, hecho: { tipo: 'creativos', texto: `Le pedí a ${t?.agente || 'el agente de anuncios'} 3 variaciones de «${clip(o.nombre, 50)}» (tarea ${t?.id || '—'}). Las imágenes las generas tú en el Estudio, con su costo a la vista; nada cambia en Meta.`, tarea: t?.id || null }, tarea: t ? { id: t.id, agent: t.agent || null, titulo: t.titulo || '' } : null });
  }

  function descartar(id, b = {}) {
    const quien = quienDe(b.por);
    if (quien !== 'dueno' && quien !== 'dimitri') return no(403, 'Descartar una sugerencia lo hace el dueño (o Dimitri con su clic).');
    const s = sug.leer(id); if (!s) return no(404, 'Esa sugerencia ya no está.');
    if (s.estado === 'aplicada') return no(409, 'Esa sugerencia ya se aplicó.', { error: 'estado' });
    return R(200, { ok: true, sugerencia: sug.descartar(id) });
  }
  function posponer(id, b = {}) {
    const quien = quienDe(b.por);
    if (quien !== 'dueno' && quien !== 'dimitri') return no(403, 'Posponer una sugerencia lo hace el dueño.');
    const s = sug.leer(id); if (!s) return no(404, 'Esa sugerencia ya no está.');
    if (s.estado === 'aplicada') return no(409, 'Esa sugerencia ya se aplicó.', { error: 'estado' });
    return R(200, { ok: true, sugerencia: sug.posponer(id, b.dias) });
  }
  /** POST /api/anuncios/sugerencias { por: 'agente', agente, tarea?, id, regla, tipo, valor?, dato, porque, efecto }. */
  function crear(b = {}) {
    const quien = quienDe(b.por);
    if (quien !== 'agente') return no(403, 'Las sugerencias nuevas las dejan los agentes; el diagnóstico de la oficina hace las suyas solo.');
    const agente = String(b.agente || '').trim(); if (!/^[A-Za-z0-9_-]{1,30}$/.test(agente)) return no(403, 'Un agente deja sugerencias con su id (agente).');
    const regla = String(b.regla || ''), tipo = String(b.tipo || '');
    if (!REGLAS.includes(regla)) return no(400, `La regla es una de: ${REGLAS.join(', ')}.`);
    if (!CAMBIOS.includes(tipo)) return no(400, `El cambio es uno de: ${CAMBIOS.join(', ')}.`);
    if (!String(b.dato || '').trim() || !String(b.porque || '').trim()) return no(400, 'Falta el dato que la motiva (con su cifra) y el porqué.');
    const v = vista(), id = String(b.id || '').trim();
    if (regla === 'impulsar' || tipo === 'impulsar') return no(400, 'Impulsar una publicación lo propone el diagnóstico con las cifras de Analíticas (Fase A4).');
    const r = v && id ? buscar(v, id) : null;
    if (!r) return no(404, `No hay ninguna campaña, conjunto ni anuncio con el id ${id || '(vacío)'} en lo leído de Meta: usa los ids de ver_campanas.`);
    let valor;
    if (tipo === 'subir_presupuesto' || tipo === 'bajar_presupuesto') {
      valor = Math.round(Number(b.valor) * 100) / 100;
      if (!(valor > 0)) return no(400, 'Para un presupuesto, pon el valor nuevo en US$ (valor).');
    }
    const objeto = { id: r.objeto.id, nivel: r.tipo, nombre: r.objeto.nombre };
    const x = sug.deAgente({ agente, tarea: /^[A-Za-z0-9_-]{1,40}$/.test(String(b.tarea || '')) ? String(b.tarea) : null, regla, objeto, dato: b.dato, porque: b.porque, efecto: b.efecto || '', cambio: { tipo, id: objeto.id, ...(valor !== undefined ? { valor } : {}) } });
    return x.error ? no(x.status || 400, x.error) : R(200, x);
  }
  return { aplicar, descartar, posponer, crear, variaciones };
}

export { UMBRALES_REQUERIDOS };
