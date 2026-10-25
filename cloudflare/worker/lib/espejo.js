// El ESPEJO: cómo corre en el Worker el código de la oficina que guarda su estado en archivos de data/ (anuncios/, contenido/bandeja…).
//
// Un Worker no tiene disco que dure: lo que en la oficina local es `data/anuncios/borradores.json` aquí es una fila de D1 (tabla `docs`,
// clave `fs:data/anuncios/borradores.json`). En vez de reescribir cada módulo contra D1 (y mantenerlo dos veces), cada petición:
//   1. TRAE de D1 los archivos que el módulo va a usar y los pone en una carpeta temporal del Worker (`node:fs` de workerd: /tmp, privada
//      de la petición y que se borra sola);
//   2. corre el módulo de la raíz del repositorio TAL CUAL (el mismo código, los mismos tests, la misma lógica);
//   3. VUELCA a D1 lo que el módulo cambió (y borra lo que quitó).
// `flush()` se puede llamar a mitad de la petición: antes de cada llamada a Meta que escribe (crear, pausar, responder) se vuelca el diario
// («apuntar el paso ANTES de llamar»), y así un corte no deja a la oficina sin saber qué hizo.
//
// Dos peticiones a la vez: cada archivo lleva su versión. Si otra petición lo cambió mientras tanto, se hace una FUSIÓN de tres vías
// (lo que había al traerlo · lo mío · lo que hay ahora): el JSON se junta objeto con objeto y, en las listas de cosas con `id`, id con id;
// un .jsonl (el historial) conserva las líneas de las dos; lo demás, gana lo último en escribir.
// Un archivo no puede pasar de ~1,9 MB (D1 corta la fila a 2 MB): si pasa, se dice en palabras.
//
// Una caché por isolate (clave → versión + texto) evita volver a traer de D1 lo que no cambió.
import fs from 'node:fs';
import path from 'node:path';
import { leerDoc, guardarDoc } from './almacen.js';
import { uuid } from './ids.js';

export const PREFIJO = 'fs:';
export const MAX_ARCHIVO = 1_900_000;
const CACHE_MAX = 40_000_000; // caracteres en caché por base de datos
const cachePorBase = new WeakMap();
const cacheDe = (db) => { let c = cachePorBase.get(db); if (!c) { c = { mapa: new Map(), tam: 0 }; cachePorBase.set(db, c); } return c; };
const ponerCache = (db, clave, version, texto) => {
  const c = cacheDe(db), antes = c.mapa.get(clave);
  if (antes) c.tam -= antes.texto.length;
  if (c.tam + texto.length > CACHE_MAX) { c.mapa.clear(); c.tam = 0; }
  c.mapa.set(clave, { version, texto }); c.tam += texto.length;
};
const quitarCache = (db, clave) => { const c = cacheDe(db), a = c.mapa.get(clave); if (a) { c.tam -= a.texto.length; c.mapa.delete(clave); } };

const claveDe = (rel) => PREFIJO + rel;
const escapeLike = (s) => s.replace(/[\\%_]/g, (m) => '\\' + m);
const esTmp = (n) => n.endsWith('.tmp');

// ------------------------------------------------------------ la fusión de tres vías
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const objeto = (v) => v && typeof v === 'object' && !Array.isArray(v);
const conIds = (l) => Array.isArray(l) && l.length > 0 && l.every((x) => objeto(x) && typeof x.id === 'string');

/** Junta lo que cambié yo y lo que cambió otro sobre la misma base. Si no se puede saber, gana lo mío (lo último en escribir). */
export function fusionarJson(base, mio, suyo) {
  if (igual(mio, base)) return suyo;
  if (igual(suyo, base) || igual(mio, suyo)) return mio;
  if (objeto(mio) && objeto(suyo)) {
    const b = objeto(base) ? base : {};
    const salida = {};
    for (const k of new Set([...Object.keys(suyo), ...Object.keys(mio)])) {
      const enMio = k in mio, enSuyo = k in suyo;
      if (!enMio) { if (!igual(suyo[k], b[k])) salida[k] = suyo[k]; continue; } // lo quité yo; si el otro lo tocó, se queda lo suyo
      if (!enSuyo) { if (!(k in b) || !igual(mio[k], b[k])) salida[k] = mio[k]; continue; } // lo quitó el otro; si yo lo toqué, se queda lo mío
      salida[k] = fusionarJson(b[k], mio[k], suyo[k]);
    }
    return salida;
  }
  if (conIds(mio) && conIds(suyo)) {
    const b = new Map((conIds(base) ? base : []).map((x) => [x.id, x])), m = new Map(mio.map((x) => [x.id, x])), s = new Map(suyo.map((x) => [x.id, x]));
    const salida = [];
    for (const [id, x] of s) {
      if (!m.has(id)) { if (!b.has(id) || !igual(x, b.get(id))) salida.push(x); continue; } // lo quité yo (salvo que el otro lo cambiara)
      salida.push(fusionarJson(b.get(id), m.get(id), x));
    }
    for (const [id, x] of m) if (!s.has(id) && !b.has(id)) salida.push(x); // lo nuevo mío
    return salida;
  }
  return mio;
}

/** Texto con tres vías. `.jsonl`: las líneas de los dos. JSON: fusión. Otro texto: gana el mío. */
export function fusionarTexto(rel, base, mio, suyo) {
  if (mio === suyo) return mio;
  if (base !== null && mio === base) return suyo;
  if (base !== null && suyo === base) return mio;
  if (rel.endsWith('.jsonl')) {
    const antes = new Set(String(base ?? '').split('\n').filter(Boolean)), lineasSuyas = String(suyo).split('\n').filter(Boolean), tengo = new Set(lineasSuyas);
    const nuevas = String(mio).split('\n').filter((l) => l && !antes.has(l) && !tengo.has(l));
    return [...lineasSuyas, ...nuevas].join('\n') + '\n';
  }
  try {
    const j = (t) => (t === null ? undefined : JSON.parse(t));
    const f = fusionarJson(j(base), JSON.parse(mio), JSON.parse(suyo));
    return JSON.stringify(f, null, rel.endsWith('/cuentas.json') || rel.includes('/borradores') ? 1 : undefined);
  } catch { return mio; }
}

// ------------------------------------------------------------ el espejo
function listar(dir, rel = '') {
  const salida = [];
  let nombres = [];
  try { nombres = fs.readdirSync(dir); } catch { return salida; }
  for (const n of nombres) {
    const r = rel ? `${rel}/${n}` : n;
    let dirOk = false; try { dirOk = fs.statSync(path.join(dir, n)).isDirectory(); } catch { continue; }
    if (dirOk) salida.push(...listar(path.join(dir, n), r));
    else if (!esTmp(n)) salida.push(r);
  }
  return salida;
}

/**
 * Abre un espejo. `prefijos`: trae todo lo que empiece así (p. ej. 'data/anuncios/'); `exactos`: archivos sueltos. `semillas`
 * { 'ruta/relativa': 'texto' }: archivos que el módulo necesita y que vienen con el Worker (no se guardan en D1). `ignorar`: carpetas
 * (prefijos) que son solo de esta petición y nunca se vuelcan (p. ej. 'media/', las imágenes que se bajan de R2 para subirlas a Meta).
 * @returns {{ raiz, ruta, flush, cerrar, tocados }}
 */
export async function abrirEspejo(db, { prefijos = [], exactos = [], semillas = {}, ignorar = ['media/'], base = '/tmp' } = {}) {
  const raiz = path.join(base, `ao-${uuid()}`);
  fs.mkdirSync(raiz, { recursive: true });
  const snap = new Map(); // rel → { version, texto } (lo que había al traerlo o al volcarlo la última vez)
  const ruta = (rel) => path.join(raiz, rel);
  const poner = (rel, texto) => { fs.mkdirSync(path.dirname(ruta(rel)), { recursive: true }); fs.writeFileSync(ruta(rel), texto); };
  const decodificar = (json) => { try { return String(JSON.parse(json).t ?? ''); } catch { return ''; } };

  // lo de D1: primero qué hay y en qué versión; solo se trae lo que la caché no tiene al día
  const hay = new Map(); // clave → versión
  for (const p of prefijos) {
    const { results } = await db.prepare("select clave, version from docs where clave like ? escape '\\'").bind(escapeLike(claveDe(p)) + '%').all();
    for (const r of results) hay.set(r.clave, r.version);
  }
  for (const e of exactos) {
    const r = await db.prepare('select clave, version from docs where clave = ?').bind(claveDe(e)).first();
    if (r) hay.set(r.clave, r.version);
  }
  const cache = cacheDe(db);
  const faltan = [];
  for (const [clave, version] of hay) {
    const c = cache.mapa.get(clave);
    if (c && c.version === version) { const rel = clave.slice(PREFIJO.length); poner(rel, c.texto); snap.set(rel, { version, texto: c.texto }); }
    else faltan.push(clave);
  }
  for (let i = 0; i < faltan.length; i += 20) {
    const lote = faltan.slice(i, i + 20);
    const { results } = await db.prepare(`select clave, json, version from docs where clave in (${lote.map(() => '?').join(',')})`).bind(...lote).all();
    for (const r of results) {
      const rel = r.clave.slice(PREFIJO.length), texto = decodificar(r.json);
      poner(rel, texto); snap.set(rel, { version: r.version, texto }); ponerCache(db, r.clave, r.version, texto);
    }
  }
  const semilla = new Set(Object.keys(semillas));
  const propio = (rel) => semilla.has(rel) || ignorar.some((p) => rel.startsWith(p));
  for (const [rel, texto] of Object.entries(semillas)) poner(rel, texto);
  const tocados = new Set();

  async function volcarUno(rel, texto) {
    if (texto.length > MAX_ARCHIVO) throw new Error(`«${rel}» pasó de ${Math.round(MAX_ARCHIVO / 1e6 * 10) / 10} MB y no cabe en una fila de D1: hay que partirlo.`);
    const clave = claveDe(rel);
    let anterior = snap.get(rel), mio = texto;
    for (let intento = 0; intento < 4; intento++) {
      try {
        const version = await guardarDoc(db, clave, { t: mio }, { espera: anterior ? anterior.version : 0 });
        snap.set(rel, { version, texto: mio }); ponerCache(db, clave, version, mio); tocados.add(rel);
        if (mio !== texto) poner(rel, mio); // lo fusionado vuelve a la carpeta: el módulo sigue viendo lo que hay
        return;
      } catch (e) {
        if (!e.conflicto) throw e;
        const { valor, version } = await leerDoc(db, clave, null);
        const suyo = valor ? String(valor.t ?? '') : null;
        if (suyo === null) { anterior = undefined; continue; } // lo borraron: se vuelve a crear
        mio = fusionarTexto(rel, anterior ? anterior.texto : null, mio, suyo);
        anterior = { version, texto: suyo };
      }
    }
    throw new Error(`«${rel}» cambia sin parar en otra petición: no pude guardarlo; vuelve a intentarlo.`);
  }

  /** Vuelca a D1 lo que cambió desde la última vez y borra lo que el módulo quitó. */
  async function flush() {
    const ahoraEnDisco = new Set(listar(raiz).filter((r) => !propio(r)));
    for (const rel of ahoraEnDisco) {
      let texto; try { texto = fs.readFileSync(ruta(rel), 'utf8'); } catch { continue; }
      const prev = snap.get(rel);
      if (prev && prev.texto === texto) continue;
      await volcarUno(rel, texto);
    }
    for (const rel of [...snap.keys()]) {
      if (ahoraEnDisco.has(rel)) continue;
      await db.prepare('delete from docs where clave = ?').bind(claveDe(rel)).run();
      snap.delete(rel); quitarCache(db, claveDe(rel)); tocados.add(rel);
    }
  }
  function cerrar() { try { fs.rmSync(raiz, { recursive: true, force: true }); } catch { /* la carpeta es de la petición: se borra sola */ } }
  return { raiz, ruta, flush, cerrar, tocados, snap };
}

/**
 * Abre el espejo, corre `fn(espejo)` y vuelca SIEMPRE lo cambiado (también si `fn` falla: si ya se llamó a Meta, la oficina tiene que saberlo).
 * Si `fn` y el volcado fallan, gana el error de `fn`.
 */
export async function conEspejo(db, opciones, fn) {
  const esp = await abrirEspejo(db, opciones);
  let resultado, fallo = null;
  try { resultado = await fn(esp); } catch (e) { fallo = e; }
  try { await esp.flush(); } catch (e) { if (!fallo) fallo = e; else console.error('[espejo] no pude volcar tras un fallo:', e?.message ?? e); }
  esp.cerrar();
  if (fallo) throw fallo;
  return resultado;
}
