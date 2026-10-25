// Agents Office (6 oct 2026, plan T0 · §5.C, §8) — el ALMACÉN de las tareas: data/tasks.json (el mismo archivo de siempre: las copias
// diarias, Volver-Atras.bat y la papelera de 90 días lo siguen encontrando) con tres cosas nuevas:
//   1. cada tarea se lee en la forma de hoy (modelo.normalizar: v2, prioridad, versión, pasos del plan);
//   2. cada guardado compara con lo que había y deja la BITÁCORA (data/tareas/bitacora/AAAA-MM.jsonl, una línea por cambio: estado,
//      campo, paso, comentario; quién y cuándo) y emite al bus (eventos.mjs). Así toda puerta que guarda —la API, una rutina,
//      Telegram, Dimitri, la cola— queda contada, sin que cada una tenga que acordarse;
//   3. guardarEjecucion(base, mio): una ejecución larga guarda MEZCLANDO con lo que hay en disco (cambios.mezclar), nunca pisándolo.
// Un tasks.json dañado vuelve de la copia diaria más reciente (antes vivía en serve.mjs; misma regla).
import fs from 'node:fs';
import path from 'node:path';
import { normalizar } from './modelo.mjs';
import { mezclar } from './cambios.mjs';
import { calcularGuardado, mesDe } from './guardado.mjs';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)

const mes = mesDe;

export function crearAlmacenTareas({ file, dataDir = path.dirname(file), bus = null, avisarRestaurado = () => {}, ahora = () => Date.now() } = {}) {
  const BIT = path.join(dataDir, 'tareas', 'bitacora');

  function leerCrudo() {
    let raw; try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
    return JSON.parse(raw);
  }
  // a missing file is an empty office; an unreadable one is NOT (reading it as [] and saving would wipe every task)
  function load() {
    let raw; try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
    try { return JSON.parse(raw).map(normalizar); } catch {
      const aside = file.replace(/\.json$/, `.unreadable-${ahora()}.json`); try { fs.copyFileSync(file, aside); } catch {}
      const dir = path.join(dataDir, 'backups'); let copy = null;
      try { copy = fs.readdirSync(dir).filter(f => /^tasks-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse().find(f => { try { JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); return true; } catch { return false; } }); } catch {}
      if (copy) {
        const list = JSON.parse(fs.readFileSync(path.join(dir, copy), 'utf8')).map(normalizar); escribir(list);
        console.error(`tasks.json could not be read — restored from backups/${copy} (the damaged file is at ${aside})`);
        setImmediate(() => avisarRestaurado(copy, aside));
        return list;
      }
      console.error(`tasks.json could not be read — a copy is at ${aside}`); throw new Error('no se pudo leer data/tasks.json (se guardó una copia al lado)');
    }
  }
  function escribir(list) { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(list, null, 2)); renombrar(tmp, file); } // write-then-rename

  function anotar(lineas) {
    if (!lineas.length) return;
    try {
      fs.mkdirSync(BIT, { recursive: true });
      const porMes = new Map(); for (const l of lineas) { const m = mes(l.t); if (!porMes.has(m)) porMes.set(m, []); porMes.get(m).push(JSON.stringify(l)); }
      for (const [m, ls] of porMes) fs.appendFileSync(path.join(BIT, m + '.jsonl'), ls.join('\n') + '\n');
    } catch (e) { console.warn('bitácora:', e.message); }
  }

  // save(list, { por, motivo }): guarda y cuenta lo que cambió (tareas/guardado.mjs, la misma cuenta que usa el almacén del Worker). `por` = quién (si no lo dice, se deduce del paso de estado).
  function save(list, { por = null, motivo = null } = {}) {
    let antes = []; try { antes = leerCrudo(); } catch {}
    const { lineas, eventos } = calcularGuardado(antes, list, { por, motivo, t0: ahora() });
    escribir(list); anotar(lineas);
    if (bus) for (const [tipo, datos] of eventos) setImmediate(() => bus.emit(tipo, datos));
    return lineas.length;
  }

  // una ejecución termina: guarda su copia MEZCLADA con lo que hay ahora en disco (lo que el dueño hizo mientras tanto se queda)
  function guardarEjecucion(base, mio, { por = null } = {}) {
    const list = load(); const i = list.findIndex(t => t.id === mio.id);
    if (i < 0) return { tarea: null, choques: [], borrada: true }; // la borraron mientras trabajaba: no se resucita
    const { tarea, choques } = mezclar(base, mio, list[i]);
    list[i] = tarea; save(list, { por });
    if (choques.length) anotar([{ t: ahora(), tarea: tarea.id, por: 'oficina', tipo: 'choque', campos: choques }]);
    return { tarea, choques };
  }

  // cambiar(id, fn, { por }): lee, aplica fn a ESA tarea (fresca) y guarda. fn devuelve false para no guardar, o { error } para negarse.
  function cambiar(id, fn, opts = {}) {
    const list = load(); const t = list.find(x => x.id === id); if (!t) return { error: 'esa tarea ya no existe', status: 404 };
    const r = fn(t, list); if (r === false) return { tarea: t, sinCambios: true }; if (r && r.error) return r;
    save(list, opts); return { tarea: t };
  }

  // la bitácora de una tarea (los últimos `meses` archivos), lo más viejo primero
  function bitacora(id, { meses = 6, max = 300 } = {}) {
    let files = []; try { files = fs.readdirSync(BIT).filter(f => /^\d{4}-\d{2}\.jsonl$/.test(f)).sort().slice(-meses); } catch { return []; }
    const out = [];
    for (const f of files) { let txt = ''; try { txt = fs.readFileSync(path.join(BIT, f), 'utf8'); } catch { continue; } for (const l of txt.split('\n')) { if (!l || !l.includes(`"${id}"`)) continue; try { const j = JSON.parse(l); if (j.tarea === id) out.push(j); } catch {} } }
    return out.slice(-max);
  }
  // todas las líneas desde un momento (para las analíticas de tareas)
  function bitacoraDesde(desde, { tipos = null } = {}) {
    let files = []; try { files = fs.readdirSync(BIT).filter(f => /^\d{4}-\d{2}\.jsonl$/.test(f) && f.slice(0, 7) >= mes(desde)).sort(); } catch { return []; }
    const out = [];
    for (const f of files) { let txt = ''; try { txt = fs.readFileSync(path.join(BIT, f), 'utf8'); } catch { continue; } for (const l of txt.split('\n')) { if (!l) continue; try { const j = JSON.parse(l); if (j.t >= desde && (!tipos || tipos.includes(j.tipo))) out.push(j); } catch {} } }
    return out;
  }

  return { load, save, guardarEjecucion, cambiar, bitacora, bitacoraDesde, anotar, dir: BIT };
}
