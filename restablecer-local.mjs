// «Restablecer oficina» en la oficina LOCAL (serve.mjs). La misma regla que la nube (restablecer-core.mjs), con archivos:
//  · antes de tocar nada, lo que el pedido toca SE MUEVE (no se borra) a data/respaldos/<id>/, con un meta.json que dice de dónde vino cada cosa; restaurar lo devuelve (7 días; después se borra);
//  · «PanaClaw por defecto» copia el Cerebro de fábrica: si tu Cerebro ES brain-panaclaw/ del repositorio, la fábrica es lo que Git tiene guardado (HEAD), no tus cambios sin subir; si es otra carpeta, la copia
//    de brain-panaclaw/ del repositorio. Las 50 habilidades de marketing son del producto (biblioteca/): no se tocan;
//  · nunca toca: costos, auditoría, copias diarias, avisos, disparadores, Anuncios y Bandeja, ajustes (office.config*.json), llaves (viven en variables de Windows) ni los respaldos.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { MODOS, AMBITOS, POR_DEFECTO, CONSERVA, DIAS_RESPALDO, TOPE_RESPALDOS, validarPedido, resumenDePedido, nuevoPaso, verificarPaso, idRespaldo, venceRespaldo, textoRespaldo, traeFabrica } from './restablecer-core.mjs';
import { readVault } from './graph-build.mjs';
import { renombrar } from './fs-seguro.mjs';

const AO = 'Agents Office';
/** Dónde vive, en esta computadora, cada cosa que un ámbito restablece. base: 'brain' (la carpeta del Cerebro) · 'data' (data/) · 'root' (la carpeta de la oficina). */
export const RUTAS = {
  cerebro: [{ base: 'data', rel: 'memory.json' }, { base: 'data', rel: 'embeddings.json' }], // + las notas (se listan al vuelo)
  habilidades: [{ base: 'brain', rel: `${AO}/skills` }, { base: 'brain', rel: `${AO}/biblioteca` }, { base: 'data', rel: 'history' }],
  equipo: [{ base: 'brain', rel: `${AO}/agents.json` }, { base: 'root', rel: 'office.agents.local.json' }],
  rutinas: [{ base: 'brain', rel: `${AO}/routines.json` }, { base: 'data', rel: 'routines.json' }],
  cifras: [{ base: 'brain', rel: `${AO}/cifras.json` }, { base: 'data', rel: 'cifras-porconfirmar.json' }],
  kpis: [{ base: 'data', rel: 'kpis.json' }],
  tareas: [{ base: 'data', rel: 'tasks.json' }, { base: 'data', rel: 'tareas' }, { base: 'data', rel: 'archive' }, { base: 'data', rel: 'routing.json' }, { base: 'data', rel: 'interviews.json' }, { base: 'brain', rel: `${AO}/feedback` }, { base: 'brain', rel: `${AO}/ejemplos` }],
  dimitri: [{ base: 'data', rel: 'subgerente.json' }, { base: 'data', rel: 'subgerente-archivo.json' }, { base: 'data', rel: 'weekly.json' }],
  estudio: [{ base: 'brain', rel: `${AO}/media` }, { base: 'brain', rel: `${AO}/estudio` }, { base: 'data', rel: 'media-index.json' }, { base: 'data', rel: 'media-jobs.json' }, { base: 'data', rel: 'media-lotes.json' }],
  contenido: [{ base: 'brain', rel: `${AO}/contenido` }, { base: 'data', rel: 'contenido/cola.json' }, { base: 'data', rel: 'contenido/simulacro.json' }, { base: 'data', rel: 'contenido/meta-agenda.json' }],
};
/** Lo que nunca se mueve. El test de la oficina local lo compara con lo que de verdad hay en data/. */
export const CONSERVA_DATA = ['costs.jsonl', 'audit', 'backups', 'notices.json', 'triggers.json', 'anuncios', 'media-usage.json', 'minimax-voices.json', 'respaldos', 'contenido/bandeja.json', 'version-anterior.txt', 'salida-meta', 'usage.json', 'telegram.json', 'cuentas'];

const existe = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };
const SKIP_NOTAS = new Set([AO]);

export function crearRestablecerLocal({ root, brain, data, hayTareasEnMarcha = () => false, alCambiar = async () => {}, avisar = () => {}, fabricaDe = null }) {
  const base = { brain, data, root };
  const abs = (r) => path.join(base[r.base], ...r.rel.split('/'));
  const dirRespaldos = path.join(data, 'respaldos');
  let paso = null;

  /* ---------- las notas del Cerebro (md del vault + las que escriben los agentes en «Agents Office/*.md») ---------- */
  const notasDe = (vault) => {
    const out = []; const { notes } = readVault(vault);
    for (const [, n] of notes) out.push(path.relative(vault, n.path));
    const dir = path.join(vault, AO);
    if (existe(dir)) for (const f of fs.readdirSync(dir)) if (f.endsWith('.md') && fs.statSync(path.join(dir, f)).isFile()) out.push(path.join(AO, f));
    return out;
  };

  /* ---------- mover sin perder ---------- */
  function mover(src, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try { renombrar(src, dest); }
    catch (e) { if (e.code !== 'EXDEV' && e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; fs.cpSync(src, dest, { recursive: true }); fs.rmSync(src, { recursive: true, force: true }); } // otra unidad: copiar y quitar
  }

  /** Todo lo que un pedido toca ahora mismo: [{ ambito, base, rel }] (solo lo que existe). */
  function tocados(ambitos) {
    const l = [];
    for (const a of ambitos) {
      for (const r of RUTAS[a]) if (existe(abs(r))) l.push({ ambito: a, base: r.base, rel: r.rel });
      if (a === 'cerebro') for (const rel of notasDe(brain)) l.push({ ambito: a, base: 'brain', rel: rel.split(path.sep).join('/') });
    }
    return l;
  }

  /* ---------- la fábrica ---------- */
  let fabricaCache = null;
  /** La carpeta del Cerebro de fábrica de PanaClaw. Si el Cerebro de esta oficina ES la del repositorio, lo que Git guarda (HEAD); si no, la del repositorio. → { dir, desdeGit } o lanza con el motivo */
  function fabrica() {
    if (fabricaDe) return fabricaDe();
    const repo = path.join(root, 'brain-panaclaw');
    if (fabricaCache && existe(fabricaCache.dir)) return fabricaCache;
    if (path.resolve(brain) === path.resolve(repo)) {
      let archivos;
      try { archivos = execFileSync('git', ['-C', root, 'ls-tree', '-r', '--name-only', 'HEAD', '--', 'brain-panaclaw'], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 20_000_000 }).toString().split(/\r?\n/).filter(Boolean); }
      catch { throw new Error('Tu Cerebro es el de fábrica del repositorio y no puedo leer cómo venía sin Git. Instala Git (o clona de nuevo el repositorio) y vuelve a intentarlo.'); }
      if (!archivos.length) throw new Error('Git no tiene guardado el Cerebro de fábrica (brain-panaclaw/).');
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-fabrica-')), vault = path.join(dir, 'brain-panaclaw');
      for (const f of archivos) {
        const dest = path.join(dir, ...f.split('/')); fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, execFileSync('git', ['-C', root, 'show', `HEAD:${f}`], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 50_000_000 }));
      }
      return (fabricaCache = { dir: vault, desdeGit: true });
    }
    if (!existe(repo)) throw new Error('No encuentro brain-panaclaw/ en la carpeta de la oficina.');
    return { dir: repo, desdeGit: false };
  }
  const manifiestoFabrica = () => {
    try {
      const f = fabrica().dir; if (!existe(f)) return null;
      const ao = path.join(f, AO), cuenta = (d) => { try { return fs.readdirSync(d).filter((x) => !x.startsWith('.')).length; } catch { return 0; } };
      let rutinas = 0; try { rutinas = (JSON.parse(fs.readFileSync(path.join(ao, 'routines.json'), 'utf8')).routines || []).length; } catch { /* sin rutinas */ }
      const notas = notasDe(f).length; if (!notas) return null; // sin notas de fábrica no hay a qué volver
      return { notas, skills: cuenta(path.join(ao, 'skills')), rutinas };
    } catch { return null; }
  };

  /** Lo que «PanaClaw por defecto» pone en cada ámbito (se copia desde la fábrica). */
  function cargarFabrica(ambitos) {
    const f = fabrica().dir, ao = path.join(f, AO), copiar = (de, a) => { if (existe(de)) { fs.mkdirSync(path.dirname(a), { recursive: true }); fs.cpSync(de, a, { recursive: true }); } };
    if (ambitos.includes('cerebro')) for (const rel of notasDe(f)) copiar(path.join(f, rel), path.join(brain, rel));
    if (ambitos.includes('habilidades')) copiar(path.join(ao, 'skills'), path.join(brain, AO, 'skills'));
    if (ambitos.includes('equipo')) copiar(path.join(ao, 'agents.json'), path.join(brain, AO, 'agents.json'));
    if (ambitos.includes('rutinas')) copiar(path.join(ao, 'routines.json'), path.join(brain, AO, 'routines.json'));
  }

  /* ---------- respaldos ---------- */
  function respaldos(ahora = Date.now()) {
    const out = [];
    if (existe(dirRespaldos)) for (const id of fs.readdirSync(dirRespaldos)) { try { const m = JSON.parse(fs.readFileSync(path.join(dirRespaldos, id, 'meta.json'), 'utf8')); out.push({ ...m, id }); } catch { /* una carpeta a medias */ } }
    return out.sort((a, b) => b.at - a.at).filter((r) => r.vence > ahora);
  }
  function purgar(ahora = Date.now()) {
    if (!existe(dirRespaldos)) return 0; let n = 0;
    const vivos = new Set(respaldos(ahora).slice(0, TOPE_RESPALDOS).map((r) => r.id));
    for (const id of fs.readdirSync(dirRespaldos)) if (!vivos.has(id)) { fs.rmSync(path.join(dirRespaldos, id), { recursive: true, force: true }); n++; }
    return n;
  }
  /** Mueve lo que el pedido toca a data/respaldos/<id>/. → el registro */
  function respaldar({ modo, ambitos, ahora, quien = '' }) {
    const id = idRespaldo(ahora), dir = path.join(dirRespaldos, id), items = tocados(ambitos);
    fs.mkdirSync(dir, { recursive: true });
    const hechos = [];
    try { for (const it of items) { const src = abs(it); if (!existe(src)) continue; mover(src, path.join(dir, 'cosas', it.base, ...it.rel.split('/'))); hechos.push(it); } }
    catch (e) { for (const it of hechos.reverse()) { try { mover(path.join(dir, 'cosas', it.base, ...it.rel.split('/')), abs(it)); } catch { /* lo que se pueda */ } } throw e; } // si algo falla a medias, lo ya movido vuelve
    const meta = { at: ahora, vence: venceRespaldo(ahora), modo, ambitos, items: hechos, resumen: `${textoRespaldo(modo, ambitos)} · ${hechos.length} archivo(s) o carpeta(s)`, quien };
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
    return { id, ...meta };
  }

  /* ---------- lo que ve la página ---------- */
  function cuentas() {
    const pl = (n, u, v) => `${n} ${n === 1 ? u : v}`, json = (p, def) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; } };
    const lleno = (...rs) => rs.some((r) => { const p = abs(r); if (!existe(p)) return false; const s = fs.statSync(p); return s.isDirectory() ? fs.readdirSync(p).length > 0 : s.size > 2; });
    const notas = notasDe(brain).length, tareas = json(path.join(data, 'tasks.json'), []), cif = json(path.join(brain, AO, 'cifras.json'), { items: [] }).items?.length || 0;
    return {
      cerebro: notas ? pl(notas, 'nota', 'notas') : 'vacío', habilidades: lleno(...RUTAS.habilidades) ? 'con skills tuyas' : 'ninguna', equipo: lleno(...RUTAS.equipo) ? 'con cambios' : 'de fábrica',
      rutinas: lleno(...RUTAS.rutinas) ? 'con rutinas' : 'ninguna', cifras: cif ? pl(cif, 'cifra', 'cifras') : 'vacías', kpis: lleno(...RUTAS.kpis) ? 'con indicadores' : 'vacío', tareas: Array.isArray(tareas) && tareas.length ? pl(tareas.length, 'tarea', 'tareas') : 'ninguna',
      dimitri: lleno(...RUTAS.dimitri) ? 'con conversación' : 'sin conversación', estudio: lleno(...RUTAS.estudio) ? 'con archivos' : 'vacía', contenido: lleno(...RUTAS.contenido) ? 'con piezas' : 'sin piezas',
    };
  }
  function estado(ahora = Date.now()) {
    const m = manifiestoFabrica(), c = cuentas();
    return {
      modos: MODOS.map((x) => (x.id === 'panaclaw' && !m ? { ...x, disponible: false, motivo: 'No encuentro el Cerebro de fábrica (brain-panaclaw/) en esta computadora.' } : x)),
      ambitos: AMBITOS.map((a) => ({ ...a, actual: c[a.id] })), porDefecto: POR_DEFECTO, conserva: CONSERVA, diasRespaldo: DIAS_RESPALDO, semilla: m,
      respaldos: respaldos(ahora).map((r) => ({ id: r.id, at: r.at, vence: r.vence, modo: r.modo, modoNombre: MODOS.find((x) => x.id === r.modo)?.nombre || r.modo, resumen: r.resumen, ambitos: r.ambitos })),
    };
  }

  /** Paso 1. → { pendiente } o { error, status } */
  function pedir(pedido, ahora = Date.now()) {
    const v = validarPedido(pedido); if (!v.ok) return { error: v.error, status: 400 };
    const m = manifiestoFabrica();
    if (v.modo === 'panaclaw' && !m) return { error: 'No encuentro el Cerebro de fábrica (brain-panaclaw/) en esta computadora: «PanaClaw por defecto» no está disponible.', status: 409 };
    paso = nuevoPaso(v, ahora);
    return { pendiente: { token: paso.token, vence: paso.vence, modo: v.modo, ambitos: v.ambitos, resumen: resumenDePedido({ modo: v.modo, ambitos: v.ambitos, cuentas: cuentas(), semilla: m }) } };
  }

  /** Paso 2. → { ok, respaldo, hecho } o { error, status } */
  async function confirmar({ token, escribio }, { ahora = Date.now() } = {}) {
    const motivo = verificarPaso(paso, { token, escribio }, ahora); if (motivo) return { error: motivo, status: 409 };
    const { modo, ambitos } = paso; paso = null; // de un solo uso
    if (hayTareasEnMarcha()) return { error: 'Hay una tarea de un agente en marcha: espera a que termine (o páusala) y vuelve a intentarlo.', status: 409 };
    if (modo === 'panaclaw') { try { fabrica(); } catch (e) { return { error: e.message, status: 409 }; } } // si no se puede leer la fábrica, no se quita nada
    const r = respaldar({ modo, ambitos, ahora });
    try { if (modo === 'panaclaw') cargarFabrica(ambitos); }
    catch (e) { await restaurarDe(r, ahora, false); return { error: 'No pude cargar la fábrica y dejé todo como estaba: ' + e.message, status: 500 }; }
    purgar(ahora);
    await alCambiar();
    avisar('restablecer', `Restableciste la oficina (${textoRespaldo(modo, ambitos)}). Hay un respaldo para deshacerlo hasta el ${new Date(r.vence).toLocaleDateString('es-PA')}.`);
    return { ok: true, respaldo: { id: r.id, vence: r.vence }, hecho: resumenDePedido({ modo, ambitos, cuentas: {}, semilla: manifiestoFabrica() }) };
  }

  /** Devuelve lo de un respaldo a su sitio (antes quita lo que hay ahora de esos ámbitos). */
  async function restaurarDe(r, ahora, conPrevio = true) {
    const dir = path.join(dirRespaldos, r.id);
    if (conPrevio) respaldar({ modo: r.modo, ambitos: r.ambitos, ahora }); // el estado de ahora queda respaldado: restaurar también se puede deshacer
    else for (const it of tocados(r.ambitos)) fs.rmSync(abs(it), { recursive: true, force: true });
    for (const it of r.items) { const src = path.join(dir, 'cosas', it.base, ...it.rel.split('/')); if (existe(src)) mover(src, abs(it)); }
    if (conPrevio) { /* el respaldo restaurado queda vacío: se limpia */ fs.rmSync(dir, { recursive: true, force: true }); }
    else fs.rmSync(dir, { recursive: true, force: true });
    await alCambiar();
  }
  async function restaurar({ id }, ahora = Date.now()) {
    const r = respaldos(ahora).find((x) => x.id === id);
    if (!r) return { error: 'Ese respaldo ya no está o ya venció.', status: 404 };
    if (hayTareasEnMarcha()) return { error: 'Hay una tarea de un agente en marcha: espera a que termine y vuelve a intentarlo.', status: 409 };
    await restaurarDe(r, ahora, true);
    avisar('restablecer', `Restauraste el respaldo del ${new Date(r.at).toLocaleString('es-PA')} (${r.resumen}).`);
    return { ok: true, resumen: r.resumen };
  }

  return { estado, pedir, confirmar, restaurar, respaldos, purgar, tocados, manifiestoFabrica };
}
