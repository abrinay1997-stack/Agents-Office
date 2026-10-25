// Anuncios de Meta y la Bandeja en el Worker (fase 7 del puerto): el «cableado» que en la oficina local hace serve.mjs.
//
// La LÓGICA es la de la raíz del repositorio, sin copiarla (anuncios/*.mjs, contenido/meta.mjs, contenido/bandeja*.mjs): lo puro se importa
// tal cual, y lo que guarda archivos corre sobre el ESPEJO (lib/espejo.js: sus archivos de data/ se traen de D1 al empezar la petición y se
// vuelcan al terminar). Lo que NO puede vivir en un archivo —los tokens del dinero y los candados— está en D1 (lib/tokens.js).
//
// LA REGLA DEL DINERO sigue donde estaba: anuncios/acciones.mjs (quién, topes, dos clics, validate_only) y anuncios/crear.mjs (todo PAUSED,
// nunca dos veces). Lo que cambia aquí es dónde se guarda lo que recuerdan, y que el Worker vuelca a D1 ANTES de cada llamada a Meta que
// escribe (apuntar el paso antes de hacerlo) y toma un candado para que no corran dos a la vez.
import fs from 'node:fs';
import path from 'node:path';
import { crearMeta } from '../../../contenido/meta.mjs';
import { crearMetaAds } from '../../../anuncios/meta-ads.mjs';
import { crearSincronizador } from '../../../anuncios/sincronizar.mjs';
import { crearAcciones } from '../../../anuncios/acciones.mjs';
import { crearBorradores } from '../../../anuncios/borradores.mjs';
import { crearCreador, resolverCuentas } from '../../../anuncios/crear.mjs';
import { crearSugerencias, crearAplicador, cargarUmbrales } from '../../../anuncios/sugerencias.mjs';
import { crearPiloto } from '../../../anuncios/piloto.mjs';
import { crearImpulsor } from '../../../anuncios/impulsar.mjs';
import { crearIndicadoresAnuncios } from '../../../anuncios/indicadores.mjs';
import { crearInforme } from '../../../anuncios/informe.mjs';
import { crearConversiones } from '../../../anuncios/conversiones.mjs';
import { crearRutasAnuncios } from '../../../anuncios/rutas.mjs';
import { agenteDeAnuncios, promptMejorarAnuncio, leerPropuesta } from '../../../anuncios/mejorar.mjs';
import { cpaObjetivo } from '../../../anuncios/diagnostico.mjs';
import { trasSondeo } from '../../../anuncios/tras-sondeo.mjs';
import { horaEn } from '../../../anuncios/modelo.mjs';
import { crearBandeja } from '../../../contenido/bandeja.mjs';
import { crearFuenteMeta } from '../../../contenido/bandeja-meta.mjs';
import { emparejar } from '../../../src/contenido-publicadas.js';
import { crearTarea } from '../../../tareas/modelo.mjs';
import { renombrar } from '../../../fs-seguro.mjs';
import { injectionIn } from '../../../safety.mjs';
import { FIELDS } from '../../../settings.mjs';
import umbralesDeFabrica from '../../../biblioteca/marketing/campanas-pagadas/umbrales.json' with { type: 'json' };
import { agentes } from './agentes.js';
import { texto as textoIA } from './ia.js';
import { leerDoc, guardarDoc, mutarDoc, listarFilas, leerFila, guardarFila } from './almacen.js';
import { tokensD1 } from './tokens.js';
import { conEspejo } from './espejo.js';
import { igualSeguro } from './ids.js';

// ------------------------------------------------------------ dónde viven las cosas dentro del espejo
export const DIR_ANUNCIOS = 'data/anuncios';
export const DIR_ANALITICAS = 'data/contenido'; // como en la oficina local: cuentas.json (lo que Meta dice del token), bandeja.json, bandeja-meta.json
export const DIR_INFORMES = 'brain/Agents Office/informes';
const UMBRALES_DUENO = 'brain/Agents Office/biblioteca/campanas-pagadas/umbrales.json';
const UMBRALES_FABRICA = 'biblioteca/marketing/campanas-pagadas/umbrales.json';
export const ESPEJO_ANUNCIOS = {
  prefijos: [DIR_ANUNCIOS + '/'],
  exactos: [`${DIR_ANALITICAS}/cuentas.json`, `${DIR_ANALITICAS}/bandeja.json`, `${DIR_ANALITICAS}/bandeja-meta.json`, UMBRALES_DUENO],
  semillas: { [UMBRALES_FABRICA]: JSON.stringify(umbralesDeFabrica) },
};
export const ESPEJO_BANDEJA = {
  prefijos: [],
  exactos: [`${DIR_ANALITICAS}/cuentas.json`, `${DIR_ANALITICAS}/bandeja.json`, `${DIR_ANALITICAS}/bandeja-meta.json`, `${DIR_ANUNCIOS}/cuenta.json`],
  semillas: {},
};
export const DOC_FRENO = 'meta.freno';
const DOC_PANEL = 'anuncios.panel';
const DOC_BANDEJA_ABIERTA = 'bandeja.abierta';
const DOC_AGENTE_SYNC = 'anuncios.agente-sync';
export const defaultsAnuncios = Object.fromEntries(['topeDiario', 'topeMensual', 'topeCampana'].map((k) => [k, FIELDS.find((f) => f.path === 'anuncios.' + k)?.default ?? null]));

const unir = (a, b) => {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b === undefined ? a : b;
  const o = { ...(a && typeof a === 'object' && !Array.isArray(a) ? a : {}) };
  for (const [k, v] of Object.entries(b)) o[k] = unir(o[k], v);
  return o;
};
/** office.config.json (doc `config`) con office.config.local.json (doc `config-local`) encima, como en la oficina local. */
export async function leerConfig(db, docs = null) {
  const d = docs || await leerDocs(db, ['config', 'config-local', 'anuncios.ajustes']);
  const base = d.config ?? {}, local = d['config-local'] ?? {};
  const propios = d['anuncios.ajustes'] ?? {}; // lo que subió la migración de esta fase (solo anuncios.* y contenido.*)
  return unir(unir({ anuncios: propios.anuncios, contenido: propios.contenido, approvals: propios.approvals, name: propios.name }, base), local);
}

/** Varios documentos de una vez (una sola consulta): { clave: valor | undefined }. */
export async function leerDocs(db, claves) {
  const { results } = await db.prepare(`select clave, json from docs where clave in (${claves.map(() => '?').join(',')})`).bind(...claves).all();
  const o = {}; for (const r of results) { try { o[r.clave] = JSON.parse(r.json); } catch { /* un documento roto es un documento que no está */ } }
  return o;
}

// ------------------------------------------------------------ la migración desde la computadora del dueño (scripts/migrar/anuncios.mjs)
/** Las únicas rutas que la migración puede escribir (la lista blanca: lo que sube el exportador, nada más). */
export const RUTAS_MIGRABLES = new Set(['data/anuncios/borradores.json', 'data/anuncios/papelera.json', 'data/anuncios/sugerencias.json', 'data/anuncios/creaciones.json', 'data/anuncios/conversiones.json', 'data/anuncios/avisados.json', 'data/anuncios/historial.jsonl', 'data/contenido/bandeja.json', 'data/contenido/bandeja-meta.json']);
/**
 * El exportador sube cada archivo como un documento `anuncios.migracion.<nombre>` (/api/migrar/docs solo admite claves simples). La primera vez que se
 * abre Anuncios o la Bandeja, esos documentos pasan a su sitio (`fs:<ruta>`, lo que lee el espejo) y se borran. Un archivo que ya existe en la nube
 * NO se pisa: lo de la nube es más nuevo que lo que se exportó. Devuelve las rutas que pasó.
 */
export async function aplicarMigracion(db) {
  const { results } = await db.prepare("select clave from docs where clave like 'anuncios.migracion.%'").all();
  const hechas = [];
  for (const { clave } of results) {
    const { valor } = await leerDoc(db, clave, null);
    const ruta = String(valor?.ruta || ''), texto = typeof valor?.texto === 'string' ? valor.texto : null;
    let bien = RUTAS_MIGRABLES.has(ruta) && texto !== null && texto.length <= 1_900_000;
    if (bien) { try { if (ruta.endsWith('.jsonl')) texto.split('\n').filter(Boolean).forEach((l) => JSON.parse(l)); else JSON.parse(texto); } catch { bien = false; } }
    if (bien) { try { await guardarDoc(db, 'fs:' + ruta, { t: texto }, { espera: 0 }); hechas.push(ruta); } catch (e) { if (!e.conflicto) throw e; /* ya hay uno en la nube: manda ese */ } }
    else console.warn(`[anuncios] la migración «${clave}» no vale (ruta o texto): se descarta`);
    await db.prepare('delete from docs where clave = ?').bind(clave).run();
  }
  return hechas;
}

// ------------------------------------------------------------ avisos (notice) y auditoría: se juntan y se guardan al final
export function crearAvisos(db, { ahora = () => Date.now() } = {}) {
  const cola = [], audit = [];
  return {
    avisar: (kind, texto, { level = 'info', task = null, key = null } = {}) => { cola.push({ kind, level, text: String(texto), task, key }); },
    auditar: (quien, entrada) => { audit.push({ quien, entrada }); },
    pendientes: () => cola.length,
    /** Mismo formato que data/notices.json de la oficina local; lo mismo dicho en 6 horas no se repite. */
    async volcar() {
      if (cola.length) {
        const t = ahora();
        await mutarDoc(db, 'notices', [], (lista) => {
          const l = Array.isArray(lista) ? lista : [];
          for (const n of cola) {
            if (n.key && l.some((x) => x.key === n.key && t - x.t < 6 * 3600e3)) continue;
            l.push({ id: crypto.randomUUID().slice(0, 12), t, kind: n.kind, level: n.level, text: n.text, task: n.task, key: n.key, read: false });
          }
          return l.slice(-200);
        });
        cola.length = 0;
      }
      for (const a of audit.splice(0)) {
        await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date(ahora()).toISOString(), 'anuncios', String(a.quien || 'sistema').slice(0, 120), JSON.stringify(a.entrada ?? {})).run();
      }
    },
  };
}

// ------------------------------------------------------------ los medios del Estudio (R2): lo que Meta necesita y la oficina tiene en la galería
const EXT_VIDEO = /\.(mp4|mov|webm|m4v)$/i, EXT_IMAGEN = /\.(jpe?g|png|webp|gif)$/i, EXT_AUDIO = /\.(mp3|wav)$/i;
const ID_MEDIO = /^\d{4}-\d{2}\/[^/\\\0]{1,200}$/;
/** La galería que ve anuncios/crear.mjs: { ruta(id) → archivo en el espejo, item(id) → { kind } }. `cargar` baja de R2 (head, o los bytes). */
export function galeriaNube({ env, esp }) {
  const conocidos = new Map();
  const kindDe = (id) => (EXT_VIDEO.test(id) ? 'video' : EXT_IMAGEN.test(id) ? 'image' : EXT_AUDIO.test(id) ? 'audio' : 'file');
  return {
    async cargar(ids, { bytes = false } = {}) {
      for (const id of [...new Set(ids.filter(Boolean))]) {
        if (!ID_MEDIO.test(id) || id.includes('..') || !env.MEDIA) continue;
        try {
          if (bytes) {
            const o = await env.MEDIA.get(id); if (!o) continue;
            const p = esp.ruta('media/' + id); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.from(await o.arrayBuffer()));
            conocidos.set(id, { kind: kindDe(id) });
          } else if (await env.MEDIA.head(id)) conocidos.set(id, { kind: kindDe(id) });
        } catch (e) { console.warn('[anuncios] medio', id, e?.message ?? e); }
      }
    },
    ruta: (id) => (conocidos.has(id) && fs.existsSync(esp.ruta('media/' + id)) ? esp.ruta('media/' + id) : null),
    item: (id) => conocidos.get(id) || null,
  };
}

// ------------------------------------------------------------ el cableado
const ESCRIBEN = new Set(['cambiar', 'copiar', 'crearEn', 'subirImagen', 'subirVideo']);
/** Solo pruebas: un Meta de mentira (tests/meta-stand.mjs) en lugar de `fetch`. En producción nadie lo llama. */
let fetchDePrueba = null;
export const usarFetchDePrueba = (f) => { fetchDePrueba = typeof f === 'function' ? f : null; };
const elFetch = (f) => f || fetchDePrueba || ((...a) => fetch(...a));
export const pareceDeAgente = (v) => String(v ?? '').trim().toLowerCase() === 'agente';

/**
 * Todo lo de Anuncios construido sobre un espejo ya abierto.
 * @param {object} o  { db, env, esp, cfg, fetchFn, ahora, avisos, freno, panelAt, bandejaAbiertaAt, kpis, piezas, usuario }
 */
export async function construirAnuncios({ db, env, esp, cfg, fetchFn = undefined, ahora = () => Date.now(), avisos, freno = null, panelAt = 0, bandejaAbiertaAt = 0, kpis = null, preload = {} }) {
  const dirAn = esp.ruta(DIR_ANUNCIOS), dirMeta = esp.ruta(DIR_ANALITICAS);
  const aj = () => cfg.anuncios || {};
  const avisar = (texto, o) => avisos.avisar('anuncios', texto, o);
  const auditar = (quien) => (a) => avisos.auditar(quien, a);
  const meta = crearMeta({ env, fetchFn: elFetch(fetchFn), dir: dirMeta, ahora });
  meta.frenoRestaurar(freno);
  const adsBase = crearMetaAds({ meta });
  // antes de cada llamada que ESCRIBE en Meta, se vuelca a D1 lo apuntado (el diario de la creación, el testigo del envío)
  const ads = Object.fromEntries(Object.entries(adsBase).map(([k, f]) => [k, ESCRIBEN.has(k) ? async (...a) => { await esp.flush(); return f(...a); } : f]));
  const pendiente = { refrescar: false };
  const sync = crearSincronizador({ meta, ads, dir: dirAn, ajustes: aj, defaults: defaultsAnuncios, ahora, avisar, despuesDeCifras: () => {}, panelAtInicial: panelAt });
  const tokens = tokensD1(db, { ahora });
  const acc = crearAcciones({ sync, ads, ahora, undoSeconds: () => Number(cfg.approvals?.undoSeconds ?? 30), auditar: auditar('anuncios'), refrescar: () => { pendiente.refrescar = true; }, tokens });
  const borr = crearBorradores({ dir: dirAn, ajustes: aj, ahora });
  const cuentasA = () => resolverCuentas({ ajustes: aj(), cuentas: meta.estado().cuentas || [], paginaContenido: cfg.contenido?.metaPagina || '' });
  const galeria = galeriaNube({ env, esp });
  const creador = crearCreador({ dir: dirAn, ads, sync, borradores: borr, galeria, ajustes: aj, defaults: defaultsAnuncios, cuentas: cuentasA, aJpeg: null, auditar: auditar('anuncios'), ahora, diferir: true });
  const umbrales = () => cargarUmbrales({ raiz: esp.raiz, brainPath: path.join(esp.raiz, 'brain') });
  const sug = crearSugerencias({ dir: dirAn, ahora, umbrales: () => umbrales().valores });
  const piloto = crearPiloto({ acciones: acc, ajustes: aj, avisar });
  const impulsor = crearImpulsor({ borradores: borr, creador, ajustes: aj, ahora, fuentes: () => ({ leerPieza: (id) => preload.piezas?.[id] || null, salidaDe: (id) => preload.salidas?.[id] || null, publicaciones: preload.publicaciones || [], emparejar }) });
  const archivoCuenta = path.join(dirAn, 'cuenta.json');
  const monedaDe = () => { try { return JSON.parse(fs.readFileSync(archivoCuenta, 'utf8'))?.cuenta?.currency || 'USD'; } catch { return 'USD'; } };
  const conv = crearConversiones({ meta, archivo: path.join(dirAn, 'conversiones.json'), ajustes: aj, moneda: monedaDe, auditar: auditar('conversiones'), avisar, ahora });
  const estadoKpis = { v: kpis ? structuredClone(kpis) : { defs: [], values: {} }, sucio: false };
  const ind = crearIndicadoresAnuncios({ sync, kpis: { leer: () => estadoKpis.v, guardar: (k) => { estadoKpis.v = k; estadoKpis.sucio = true; } }, ajustes: aj, ahora, registradas: () => (conv.encendida() ? conv.ventas(ahora() - 30 * 864e5) : null) });
  const informe = crearInforme({ sync, sugerencias: sug, dir: esp.ruta(DIR_INFORMES), fs, renombrar, ahora, unirRuta: path.join });
  const tareasNuevas = [];
  const aplicador = crearAplicador({ sug, acciones: acc, borradores: borr, vista: () => sync.vista('7d'), impulsar: (b) => impulsor.impulsar(b),
    encargar: async ({ texto, titulo }) => { // una tarea para el agente de anuncios (ada): propone; no genera imágenes ni toca Meta
      const a = agenteDeAnuncios(agentes()); if (!a) throw new Error('no hay ningún puesto de Marketing');
      const t = crearTarea({ dept: a.department, text: texto, agent: a.id, title: titulo, needsOk: false, por: 'anuncios' }, { ahora: ahora() });
      tareasNuevas.push(t);
      return { id: t.id, titulo: t.title, agent: t.agent, agente: a.name };
    } });
  const mejorar = async ({ borrador, creativo, campo, pide }) => {
    const a = agenteDeAnuncios(agentes()); if (!a) throw Object.assign(new Error('no hay ningún puesto de Marketing'), { status: 409 });
    const nota = async (n) => (await db.prepare('select texto from notas where nombre = ?').bind(n).first())?.texto || '';
    const { system, user } = promptMejorarAnuncio({ empresa: cfg.name || 'PanaClaw', agente: a, instrucciones: a.brief ? [].concat(a.brief).join('\n') : '', voz: await nota('voice'), contexto: await nota('contexto-marketing'), cifras: '', metodos: '', borrador, creativo, campo, pide });
    const r = await textoIA(env, { sistema: system, usuario: user, maxTokens: 1500, fetchFn: elFetch(fetchFn) });
    return { ...leerPropuesta(r.texto), agente: a.name, campo };
  };
  const bandejaLect = construirBandeja({ esp, cfg, meta, ahora, avisos, abiertaAt: bandejaAbiertaAt, tokens });
  const hookOk = (req, url) => { const t = String(env.AO_HOOK_TOKEN || ''); if (!t) return false; const dado = req.headers['x-office-token'] || url.searchParams.get('token') || String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''); return igualSeguro(String(dado), t); };
  const rutas = (syncRuta, json, body) => crearRutasAnuncios({ sync: syncRuta, meta, json, body, acciones: acc, alHacer: () => {}, ahora, borradores: borr, creador, mejorar, sugerencias: sug, aplicador, impulsor, informe, indicadores: ind, conversiones: conv, bandeja: bandejaLect, hookOk });

  const tras = () => trasSondeo({ sync, sug, piloto, umbrales, cpa: () => cpaObjetivo({ ajuste: aj().cpaObjetivo, cifras: preload.cifras || [] }), publicaciones: () => preload.publicaciones || [],
    avisarUmbrales: (U) => { for (const p of U.problemas) console.warn('anuncios (umbrales):', p); },
    avisar, hora: () => horaEn(sync.vista('hoy').cuenta?.zona || null, ahora()) });

  /** Lo que queda por hacer al terminar una petición: la relectura que pidió un cambio, y guardar lo que el Worker no puede recordar. */
  async function cerrar() {
    if (pendiente.refrescar) { try { await sync.sincronizar({ cifras: false }); } catch { /* la próxima lectura lo trae */ } }
    await guardarFreno(db, meta, freno);
    if (sync.panelAtAhora() - panelAt > 60e3) await guardarDoc(db, DOC_PANEL, { at: sync.panelAtAhora() }); // basta con un minuto: el sondeo mira «hace 3 min»
    if (bandejaLect.abiertaAtAhora() - bandejaAbiertaAt > 60e3) await guardarDoc(db, DOC_BANDEJA_ABIERTA, { at: bandejaLect.abiertaAtAhora() });
    if (estadoKpis.sucio) await guardarDoc(db, 'kpis', estadoKpis.v);
    for (const t of tareasNuevas.splice(0)) await guardarFila(db, 'tareas', t.id, t, ahora());
  }
  return { meta, ads, sync, acc, borr, creador, sug, piloto, impulsor, conv, ind, informe, aplicador, bandeja: bandejaLect, galeria, rutas, tras, cerrar, umbrales, pendiente, tokens, estadoKpis };
}

/** La Bandeja sobre un espejo abierto (la misma de contenido/bandeja.mjs; su fuente de Meta, con el volcado antes de escribir). */
export function construirBandeja({ esp, cfg, meta, ahora = () => Date.now(), avisos, abiertaAt = 0, tokens = null }) {
  const fuente0 = crearFuenteMeta({ meta, archivo: path.join(esp.ruta(DIR_ANALITICAS), 'bandeja-meta.json'), anuncios: () => { try { return JSON.parse(fs.readFileSync(path.join(esp.ruta(DIR_ANUNCIOS), 'cuenta.json'), 'utf8')); } catch { return null; } }, ahora });
  // responder y ocultar escriben en Meta: ANTES de la llamada se vuelca a D1 el testigo «enviando» (si el Worker se corta, no se repite sin «forzar»).
  // El «solo uno a la vez» lo pone la ruta (un candado por mensaje, antes de tocar nada).
  const antes = (f) => async (...a) => { await esp.flush(); return f(...a); };
  const fuente = { ...fuente0, responder: antes(fuente0.responder), ocultar: antes(fuente0.ocultar) };
  const av = (kind) => (t, o) => (avisos ? avisos.avisar(kind, t, o) : undefined);
  return crearBandeja({ metricool: null, meta: fuente, elegir: () => cfg.contenido?.bandejaFuente || 'auto', archivo: path.join(esp.ruta(DIR_ANALITICAS), 'bandeja.json'),
    modo: () => cfg.contenido?.modo || 'simulacro', ahora, avisar: av('contenido'), avisarComentario: av('bandeja-comentario'), avisarMensaje: av('bandeja-mensaje'),
    injectionIn, undoSeconds: () => Number(cfg.approvals?.undoSeconds ?? 30), tokens, abiertaAtInicial: abiertaAt });
}

// ------------------------------------------------------------ el estado que recuerda D1 entre peticiones
const FRENO_LIBRE = { pct: 0, hasta: 0, vistoAt: null, motivo: '' };
/** El freno por uso de Meta cruza peticiones: se guarda solo si cambió (un panel abierto pide datos cada pocos segundos). */
async function guardarFreno(db, meta, antes) {
  const ahoraF = meta.frenoEstado(), previo = antes && typeof antes === 'object' ? { ...FRENO_LIBRE, ...antes } : FRENO_LIBRE;
  if (JSON.stringify(ahoraF) !== JSON.stringify({ pct: Number(previo.pct) || 0, hasta: Number(previo.hasta) || 0, vistoAt: previo.vistoAt || null, motivo: String(previo.motivo || '') })) await guardarDoc(db, DOC_FRENO, ahoraF);
}
export async function estadoGuardado(db, docs = null) {
  const d = docs || await leerDocs(db, [DOC_FRENO, DOC_PANEL, DOC_BANDEJA_ABIERTA, 'kpis']);
  const k = d.kpis && typeof d.kpis === 'object' ? { defs: d.kpis.defs || [], values: d.kpis.values || {} } : null;
  return { freno: d[DOC_FRENO] ?? null, panelAt: Number(d[DOC_PANEL]?.at) || 0, bandejaAbiertaAt: Number(d[DOC_BANDEJA_ABIERTA]?.at) || 0, kpis: k };
}
/** Lo que una petición necesita saber antes de empezar: la configuración del dueño y lo que D1 recuerda entre peticiones. UNA consulta. */
async function leerInicio(db) {
  const d = await leerDocs(db, ['config', 'config-local', 'anuncios.ajustes', DOC_FRENO, DOC_PANEL, DOC_BANDEJA_ABIERTA, 'kpis']);
  return { cfg: await leerConfig(db, d), guardado: await estadoGuardado(db, d) };
}

/** Abre el espejo de Anuncios, lo construye todo y corre `fn(a)`; al terminar cierra (relecturas pedidas, freno, avisos) y vuelca. */
export async function conAnuncios({ db, env, fetchFn, ahora = () => Date.now(), preload = {}, espejo = ESPEJO_ANUNCIOS }, fn) {
  await aplicarMigracion(db);
  const { cfg, guardado } = await leerInicio(db), avisos = crearAvisos(db, { ahora });
  return conEspejo(db, espejo, async (esp) => {
    const a = await construirAnuncios({ db, env, esp, cfg, fetchFn, ahora, avisos, preload, ...guardado });
    let r, fallo = null;
    try { r = await fn(a, { esp, cfg, avisos }); } catch (e) { fallo = e; }
    try { await a.cerrar(); await esp.flush(); await avisos.volcar(); } catch (e) { if (!fallo) fallo = e; else console.error('[anuncios] no pude cerrar tras un fallo:', e?.message ?? e); }
    if (fallo) throw fallo;
    return r;
  });
}

/** Abre el espejo de la Bandeja y corre `fn(b)` con { bandeja, meta, esp, cfg }; al terminar guarda el freno, cuándo se miró y los avisos. */
export async function conBandeja({ db, env, fetchFn, ahora = () => Date.now() }, fn) {
  await aplicarMigracion(db);
  const { cfg, guardado } = await leerInicio(db), avisos = crearAvisos(db, { ahora });
  return conEspejo(db, ESPEJO_BANDEJA, async (esp) => {
    const meta = crearMeta({ env, fetchFn: elFetch(fetchFn), dir: esp.ruta(DIR_ANALITICAS), ahora });
    meta.frenoRestaurar(guardado.freno);
    const bandeja = construirBandeja({ esp, cfg, meta, ahora, avisos, abiertaAt: guardado.bandejaAbiertaAt, tokens: tokensD1(db, { ahora }) });
    let r, fallo = null;
    try { r = await fn({ bandeja, meta, esp, cfg, avisos }); } catch (e) { fallo = e; }
    try {
      await guardarFreno(db, meta, guardado.freno);
      if (bandeja.abiertaAtAhora() - guardado.bandejaAbiertaAt > 60e3) await guardarDoc(db, DOC_BANDEJA_ABIERTA, { at: bandeja.abiertaAtAhora() });
      await esp.flush(); await avisos.volcar();
    } catch (e) { if (!fallo) fallo = e; else console.error('[bandeja] no pude cerrar tras un fallo:', e?.message ?? e); }
    if (fallo) throw fallo;
    return r;
  });
}

/** Asegura que la oficina sabe qué páginas e Instagram ve el token (lo que en local hace «Comprobar conexión»): cada 6 h o si no se sabe. */
export async function asegurarCuentas(meta, { ahora = () => Date.now() } = {}) {
  if (!meta.configurado()) return null;
  const e = meta.estado(), t = Date.parse(e.sincronizadaAt || '') || 0;
  if ((e.cuentas || []).length && ahora() - t < 6 * 3600e3) return e;
  if (meta.uso().frenadoHasta) return e;
  return meta.sincronizar();
}

/** Lo de otras fases que Anuncios lee, si ya está en D1 (filas `piezas`, doc `analiticas.publicaciones`, doc `cifras`): si no, vacío. */
export async function leerPreload(db, { pieza = null } = {}) {
  const out = { piezas: {}, salidas: {}, publicaciones: [], cifras: [] };
  try {
    if (pieza && /^[\w-]{1,60}$/.test(pieza)) { const p = await leerFila(db, 'piezas', pieza); if (p) out.piezas[pieza] = p; }
    const pub = (await leerDoc(db, 'analiticas.publicaciones', null)).valor; if (Array.isArray(pub?.publicaciones)) out.publicaciones = pub.publicaciones; else if (Array.isArray(pub)) out.publicaciones = pub;
    const c = (await leerDoc(db, 'cifras', null)).valor; if (Array.isArray(c?.items)) out.cifras = c.items;
    const cola = (await leerDoc(db, 'contenido.cola', null)).valor; if (cola?.entradas && pieza && cola.entradas[pieza]) out.salidas[pieza] = cola.entradas[pieza];
  } catch (e) { console.warn('[anuncios] preload:', e?.message ?? e); }
  return out;
}
export { listarFilas };
