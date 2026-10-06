// Agents Office (6 oct 2026, plan T1/T4 · §5.B, §5.H) — PROYECTOS y ETIQUETAS. Un proyecto cruza departamentos (el lanzamiento de los
// lentes: fotos en el Estudio, post en Marketing, correo en Emails); una etiqueta es libre («#lentes», «urgente-cliente»).
// Viven en data/tareas/proyectos.json y data/tareas/etiquetas.json (de esta máquina, como las tareas: no viajan por GitHub).
// Los colores son claves de una paleta (no hex), y la vista los pinta con tokens que pasan 4,5:1 en claro y en oscuro.
import fs from 'node:fs';
import path from 'node:path';
import { limiteValido } from './modelo.mjs';

export const COLORES = ['azul', 'verde', 'ambar', 'rojo', 'violeta', 'cian', 'rosa', 'gris'];
export const ESTADOS_PROYECTO = ['activo', 'pausa', 'terminado', 'archivado'];
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

function leer(f) { try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(j) ? j : []; } catch { return []; } }
function escribir(f, l) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(l, null, 1)); fs.renameSync(f + '.tmp', f); }

export function crearCatalogo({ dataDir, ahora = () => Date.now() } = {}) {
  const FP = path.join(dataDir, 'tareas', 'proyectos.json'), FE = path.join(dataDir, 'tareas', 'etiquetas.json');
  const unico = (base, lista, pref) => { let id = pref + (slug(base) || 'x'), n = 2; const b = id; while (lista.some(x => x.id === id)) id = `${b}-${n++}`; return id; };

  function proyecto(datos, previo = {}) {
    const nombre = String(datos.nombre ?? previo.nombre ?? '').trim().slice(0, 80);
    if (!nombre) return { error: 'el proyecto necesita un nombre' };
    const lim = datos.limite === undefined ? previo.limite ?? null : limiteValido(datos.limite);
    if (lim === undefined) return { error: 'la fecha límite va como AAAA-MM-DD' };
    const p = { ...previo, ...(/^\d{4}-\d{2}-\d{2}$/.test(datos.avisoAtraso || '') ? { avisoAtraso: datos.avisoAtraso } : {}), nombre, // avisoAtraso: el día que la oficina ya avisó que va atrasado (serve.mjs)
      color: COLORES.includes(datos.color) ? datos.color : previo.color || COLORES[Math.floor(Math.random() * 6)],
      objetivo: String(datos.objetivo ?? previo.objetivo ?? '').trim().slice(0, 500),
      estado: ESTADOS_PROYECTO.includes(datos.estado) ? datos.estado : previo.estado || 'activo',
      responsable: String(datos.responsable ?? previo.responsable ?? '').trim().slice(0, 60) };
    if (lim) p.limite = lim; else delete p.limite;
    if (!p.objetivo) delete p.objetivo; if (!p.responsable) delete p.responsable;
    return { proyecto: p };
  }

  return {
    proyectos: () => leer(FP),
    proyecto: id => leer(FP).find(p => p.id === id) || null,
    crearProyecto(datos = {}) {
      const l = leer(FP); const r = proyecto(datos); if (r.error) return r;
      if (l.some(p => p.nombre.toLowerCase() === r.proyecto.nombre.toLowerCase() && p.estado !== 'archivado')) return { error: 'ya hay un proyecto con ese nombre' };
      const p = { id: unico(r.proyecto.nombre, l, 'pr-'), ...r.proyecto, creado: ahora() }; l.push(p); escribir(FP, l); return { proyecto: p };
    },
    cambiarProyecto(id, datos = {}) {
      const l = leer(FP); const i = l.findIndex(p => p.id === id); if (i < 0) return { error: 'ese proyecto ya no existe', status: 404 };
      const r = proyecto(datos, l[i]); if (r.error) return r; l[i] = { ...r.proyecto, cambiado: ahora() }; escribir(FP, l); return { proyecto: l[i] };
    },
    borrarProyecto(id) { const l = leer(FP); const p = l.find(x => x.id === id); if (!p) return { error: 'ese proyecto ya no existe', status: 404 }; escribir(FP, l.filter(x => x.id !== id)); return { ok: true, proyecto: p }; },
    restaurarProyecto(p) { const l = leer(FP); if (!p?.id || l.some(x => x.id === p.id)) return { error: 'no se puede recuperar' }; l.push(p); escribir(FP, l); return { proyecto: p }; },

    etiquetas: () => leer(FE),
    crearEtiqueta(datos = {}) {
      const nombre = String(datos.nombre || '').trim().replace(/^#/, '').slice(0, 30); if (!nombre) return { error: 'la etiqueta necesita un nombre' };
      const l = leer(FE); const ya = l.find(e => e.nombre.toLowerCase() === nombre.toLowerCase()); if (ya) return { etiqueta: ya, existia: true };
      const e = { id: unico(nombre, l, 'e-'), nombre, color: COLORES.includes(datos.color) ? datos.color : COLORES[l.length % COLORES.length] }; l.push(e); escribir(FE, l); return { etiqueta: e };
    },
    cambiarEtiqueta(id, datos = {}) {
      const l = leer(FE); const e = l.find(x => x.id === id); if (!e) return { error: 'esa etiqueta ya no existe', status: 404 };
      if (datos.nombre !== undefined) { const n = String(datos.nombre).trim().replace(/^#/, '').slice(0, 30); if (!n) return { error: 'la etiqueta necesita un nombre' }; e.nombre = n; }
      if (COLORES.includes(datos.color)) e.color = datos.color; escribir(FE, l); return { etiqueta: e };
    },
    borrarEtiqueta(id) { const l = leer(FE); if (!l.some(x => x.id === id)) return { error: 'esa etiqueta ya no existe', status: 404 }; escribir(FE, l.filter(x => x.id !== id)); return { ok: true }; },
  };
}

export { progresoProyecto } from './progreso.mjs';
