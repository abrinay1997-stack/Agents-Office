// PLANTILLAS DEL ESTUDIO (auditoría del Estudio de imagen, IMG-46, Fase 6, 6 oct 2026). Antes solo se guardaba lo que tenía receta
// (un preset con su pila). Ahora cualquier configuración del compositor se guarda como plantilla: modelo, formato y ajustes,
// cantidad, el prompt base y las imágenes de estilo (por su id de la galería: las imágenes nunca se copian a la nota).
// Una plantilla es una NOTA del Cerebro, como los presets propios: <cerebro>/Estudio/Plantillas/<nombre>.md, legible y editable a
// mano, con la configuración en la cabecera. Borrar la manda a Estudio/Plantillas/.papelera.
//   aNota(p) → md          deNota(md, archivo) → { plantilla, problemas }          (puros, con test)
//   crearPlantillas({ brainPath, onNota }) → { lista(), guardar(b), borrar(id) }
import fs from 'node:fs';
import path from 'node:path';
import { leerCabecera } from './presets-notas.mjs';

export const CARPETA = 'Estudio/Plantillas';
const KINDS = ['image', 'video', 'audio', 'music'];
const ID = /^pl-[a-z0-9-]{1,40}$/;
const sinTildes = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const idDe = nombre => 'pl-' + (sinTildes(nombre).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'plantilla');
const archivoDe = nombre => String(nombre).replace(/[\\/:*?"<>|#^[\]]/g, '').trim().slice(0, 60) + '.md';
const esIdGaleria = f => typeof f === 'string' && /^[^\0]{1,300}$/.test(f) && !/^([a-z]:|\/|\\|\.\.)/i.test(f) && !f.includes('..');

/** Lo que llega de la página, limpio. Lanza con status 400 si no se puede guardar. */
export function limpiar(b = {}) {
  const nombre = String(b.nombre ?? '').replace(/[\\/*?"<>|#^[\]\r\n]/g, '').trim().slice(0, 48);
  if (!nombre) throw Object.assign(new Error('ponle un nombre a la plantilla'), { status: 400 });
  const kind = KINDS.includes(b.kind) ? b.kind : 'image';
  const modelo = typeof b.modelo === 'string' && /^[\w.:-]{1,80}$/.test(b.modelo) ? b.modelo : '';
  const ajustes = {};
  for (const [k, v] of Object.entries(b.ajustes && typeof b.ajustes === 'object' && !Array.isArray(b.ajustes) ? b.ajustes : {})) {
    if (!/^[A-Za-z][\w]{0,40}$/.test(k)) continue;
    if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) ajustes[k] = v;
    else if (typeof v === 'string' && v.length <= 200) ajustes[k] = v;
  }
  const n = Math.max(1, Math.min(8, Math.round(+b.n) || 1));
  const prompt = String(b.prompt ?? '').slice(0, 4000);
  const estilo = (Array.isArray(b.estilo) ? b.estilo : []).filter(esIdGaleria).slice(0, 10);
  return { id: idDe(nombre), nombre, kind, modelo, ajustes, n, prompt, estilo };
}

export function aNota(p, { previa = '' } = {}) {
  const cab = { tipo: 'plantilla', id: p.id, nombre: p.nombre, kind: p.kind, modelo: p.modelo || null, ajustes: p.ajustes || {}, n: p.n || 1, estilo: p.estilo || [], actualizado: new Date().toISOString().slice(0, 10) };
  const notas = /^##\s+Notas\s*$/im.exec(previa) ? previa.slice(/^##\s+Notas\s*$/im.exec(previa).index) : '## Notas\n';
  const ajTxt = Object.entries(p.ajustes || {}).map(([k, v]) => `${k}: ${v}`).join(' · ');
  return `---\n${Object.entries(cab).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n# ${p.nombre}\n\nPlantilla del Estudio: ${p.modelo || 'el modelo que esté elegido'}${ajTxt ? ` · ${ajTxt}` : ''} · ${p.n} por pedido.\n\n## Prompt base\n\n${p.prompt || '(vacío: escribes la idea cada vez)'}\n\n${notas.trimEnd()}\n`;
}

export function deNota(md, archivo = '') {
  const { cab, cuerpo } = leerCabecera(md), problemas = [];
  if (!cab || cab.tipo !== 'plantilla') return { plantilla: null, problemas: ['no es una plantilla'] };
  const m = /^##\s+Prompt base\s*\n+([\s\S]*?)(?=\n##\s|\s*$)/im.exec(cuerpo);
  const prompt = m && !/^\(vacío/.test(m[1].trim()) ? m[1].trim() : '';
  try {
    const p = limpiar({ nombre: cab.nombre || path.basename(archivo, '.md'), kind: cab.kind, modelo: cab.modelo || '', ajustes: cab.ajustes, n: cab.n, prompt, estilo: cab.estilo });
    if (cab.id && ID.test(cab.id)) p.id = cab.id;
    if (cab.ajustes && cab.ajustes.__roto) problemas.push('ajustes: no se pudo leer (JSON de una línea)');
    return { plantilla: { ...p, archivo }, problemas };
  } catch (e) { return { plantilla: null, problemas: [e.message] }; }
}

export function crearPlantillas({ brainPath, onNota = () => {} } = {}) {
  const dir = () => path.join(brainPath, CARPETA);
  const leer = () => {
    let fs_ = []; try { fs_ = fs.readdirSync(dir()).filter(f => f.endsWith('.md')); } catch { return []; }
    return fs_.map(f => { try { return deNota(fs.readFileSync(path.join(dir(), f), 'utf8'), f).plantilla; } catch { return null; } }).filter(Boolean)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  };
  return {
    lista: () => ({ plantillas: leer() }),
    guardar(b) {
      const p = limpiar(b); fs.mkdirSync(dir(), { recursive: true });
      const otra = leer().find(x => x.id === p.id), archivo = otra ? otra.archivo : archivoDe(p.nombre), ruta = path.join(dir(), archivo);
      let previa = ''; try { previa = fs.readFileSync(ruta, 'utf8'); } catch {}
      const tmp = ruta + '.tmp'; fs.writeFileSync(tmp, aNota(p, { previa })); fs.renameSync(tmp, ruta);
      onNota(); return { plantilla: { ...p, archivo }, archivo: `${CARPETA}/${archivo}`, reemplazo: !!otra };
    },
    borrar(id) {
      const p = leer().find(x => x.id === id); if (!p) return false;
      const bin = path.join(dir(), '.papelera'); fs.mkdirSync(bin, { recursive: true });
      fs.renameSync(path.join(dir(), p.archivo), path.join(bin, `${Date.now()} ${p.archivo}`)); onNota(); return true;
    },
  };
}
