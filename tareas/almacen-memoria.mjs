// Agents Office — el almacén de tareas EN MEMORIA, con la misma interfaz que almacen.mjs (load, save, guardarEjecucion, cambiar, bitacora,
// bitacoraDesde, anotar). Lo usa el Worker de Cloudflare: las rutas de tareas/ son síncronas (rutas.mjs, rutas-dueno.mjs), pero D1 no lo es,
// así que el Worker CARGA las tareas, corre la ruta contra esta copia y después vuelca a D1 lo que cambió (`cambios()`), con su versión.
// Cuenta igual que el almacén de archivos: tareas/guardado.mjs (bitácora y eventos) y tareas/cambios.mjs (mezclar). Puro: sin fs ni red.
import { normalizar } from './modelo.mjs';
import { mezclar } from './cambios.mjs';
import { calcularGuardado } from './guardado.mjs';

const clonar = x => JSON.parse(JSON.stringify(x));

export function crearAlmacenMemoria({ tareas = [], bitacora: lineasPrevias = [], ahora = () => Date.now() } = {}) {
  let bitacora = lineasPrevias;
  const originales = new Map(); // id → JSON de cómo estaba al leer (lo que hay en la base)
  let actual = [];
  for (const t of tareas) { const n = normalizar(clonar(t)); originales.set(n.id, JSON.stringify(n)); actual.push(n); }
  const nuevas = [], eventos = [];
  const base = () => clonar(actual);

  const load = () => base();
  function save(list, { por = null, motivo = null } = {}) {
    const { lineas, eventos: ev } = calcularGuardado(actual, list, { por, motivo, t0: ahora() });
    actual = clonar(list); nuevas.push(...lineas); eventos.push(...ev);
    return lineas.length;
  }
  function guardarEjecucion(baseTarea, mio, { por = null } = {}) {
    const list = load(); const i = list.findIndex(t => t.id === mio.id);
    if (i < 0) return { tarea: null, choques: [], borrada: true };
    const { tarea, choques } = mezclar(baseTarea, mio, list[i]);
    list[i] = tarea; save(list, { por });
    if (choques.length) anotar([{ t: ahora(), tarea: tarea.id, por: 'oficina', tipo: 'choque', campos: choques }]);
    return { tarea, choques };
  }
  function cambiar(id, fn, opts = {}) {
    const list = load(); const t = list.find(x => x.id === id); if (!t) return { error: 'esa tarea ya no existe', status: 404 };
    const r = fn(t, list); if (r === false) return { tarea: t, sinCambios: true }; if (r && r.error) return r;
    save(list, opts); return { tarea: t };
  }
  const anotar = lineas => { if (lineas.length) nuevas.push(...lineas); };
  const todas = () => [...bitacora, ...nuevas];
  const bit = (id, { max = 300 } = {}) => todas().filter(l => l.tarea === id).slice(-max);
  const bitacoraDesde = (desde, { tipos = null } = {}) => todas().filter(j => j.t >= desde && (!tipos || tipos.includes(j.tipo)));

  /** Lo que hay que volcar a la base: las tareas que cambiaron o nacieron (con la versión que tenían al leer, para no pisar a otro), las borradas, la bitácora y los eventos. */
  function cambios() {
    const subir = [], vistos = new Set();
    for (const t of actual) {
      vistos.add(t.id); const antes = originales.get(t.id);
      if (antes === undefined) subir.push({ tarea: t, versionAntes: null });
      else if (antes !== JSON.stringify(t)) {
        // Toda tarea cuyo JSON cambió sube de versión, aunque la bitácora no vea nada que contar (orden, seenAt, avisos, cronómetro, handoff…): la versión es el candado de la base,
        // y sin subirla dos cambios a la vez pasarían los dos y el segundo borraría el primero.
        const va = JSON.parse(antes).version ?? 1;
        if ((t.version || 1) <= va) t.version = va + 1;
        subir.push({ tarea: t, versionAntes: va });
      }
    }
    const borrar = [...originales].filter(([id]) => !vistos.has(id)).map(([id, j]) => ({ id, versionAntes: JSON.parse(j).version ?? 1 }));
    return { subir, borrar, lineas: nuevas.slice(), eventos: eventos.slice() };
  }
  /** Ya se volcó a la base: lo de ahora es lo nuevo de partida (para seguir con lo que reaccione a los eventos, p. ej. desbloquear o repetir). */
  function confirmar() {
    originales.clear(); for (const t of actual) originales.set(t.id, JSON.stringify(t));
    bitacora = [...bitacora, ...nuevas]; nuevas.length = 0; eventos.length = 0;
  }
  return { load, save, guardarEjecucion, cambiar, bitacora: bit, bitacoraDesde, anotar, cambios, confirmar, dir: null };
}
