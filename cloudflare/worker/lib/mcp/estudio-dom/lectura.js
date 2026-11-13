// Cómo se cuenta la galería, los trabajos, los presets, los lotes y las voces a un asistente: texto corto, una línea por cosa, sin bytes (un servidor MCP remoto solo devuelve texto: se da el id y el enlace).
// Funciones puras sobre lo que ya contestó la oficina: se prueban sin D1.
import { clip } from './comun.js';

const fecha = (ms) => (Number.isFinite(+ms) && +ms > 0 ? new Date(+ms).toISOString().slice(0, 16).replace('T', ' ') : '—');
const dinero = (n) => `US$${(+n || 0).toFixed(2).replace('.', ',')}`;
const tipo = (it) => (it.kind === 'audio' ? (it.wanted === 'music' ? 'música' : 'voz') : it.kind === 'video' ? 'video' : it.upload ? 'subida' : 'imagen');
const quienDe = (it) => (it.by === 'agent' ? `agente ${clip(it.agent, 30)}` : it.by === 'dimitri' ? 'Dimitri' : it.upload ? 'subida a mano' : 'tú');
/** El enlace de un archivo: se abre en la oficina con la sesión (el conector no manda bytes). */
export const enlaceDe = (file) => `/media/${String(file).split('/').map(encodeURIComponent).join('/')}`;

export function lineaItem(it) {
  return `- ${it.file} · ${tipo(it)} · ${fecha(it.at)} · ${clip(it.modelName || it.model || '', 40) || 'sin modelo'} · ${quienDe(it)}${it.fav ? ' · ★' : ''}${it.folder ? ` · carpeta ${it.folder}` : ''} · «${clip(it.prompt, 90)}»`;
}
export function listaGaleria(pg) {
  const items = Array.isArray(pg?.items) ? pg.items : [];
  const c = pg?.counts || {};
  const cab = `Galería del Estudio: ${items.length} de ${pg?.total ?? items.length} que coinciden` + (c.all != null ? ` (en total ${c.all}: ${c.fav || 0} favoritas, ${c.video || 0} videos, ${c.none || 0} sin carpeta)` : '') + '.';
  return [cab, ...items.map(lineaItem), items.length ? 'Cada archivo se abre en la oficina como /media/<archivo> (con tu sesión).' : 'No hay archivos con ese filtro.'].join('\n');
}
export function fichaItem(it) {
  if (!it) return 'No encuentro ese archivo.';
  const s = it.s || it.settings;
  const L = [`Archivo ${it.file} (${tipo(it)})`, `Enlace: ${enlaceDe(it.file)} (en la oficina, con sesión)`, `Hecho: ${fecha(it.at)} · modelo ${clip(it.modelName || it.model || '—', 60)} · ${quienDe(it)}`];
  if (it.w && it.h) L.push(`Tamaño: ${it.w}×${it.h}${it.size ? ` · ${Math.round(it.size / 1024)} KB` : ''}`);
  if (it.folder) L.push(`Carpeta: ${it.folder}`);
  if (it.fav) L.push('Favorita ★');
  if (it.task) L.push(`Tarea: ${clip(it.task, 60)}`);
  if (it.prompt) L.push(`Prompt: «${clip(it.prompt, 1500)}»`);
  if (s && typeof s === 'object' && Object.keys(s).length) L.push(`Ajustes: ${clip(JSON.stringify(s), 400)}`);
  if (it.versionOf) L.push(`Es una versión de: ${it.versionOf}`);
  if (Array.isArray(it.versions) && it.versions.length) L.push(`Versiones (${it.versions.length}): ${it.versions.slice(0, 12).map((v) => (typeof v === 'string' ? v : v?.file)).filter(Boolean).join(', ')}`);
  if (it.qa?.estado) L.push(`QA: ${clip(it.qa.estado, 40)}${Array.isArray(it.qa.checks) ? ` (${it.qa.checks.length} comprobaciones)` : ''}`);
  return L.join('\n');
}
export function listaCarpetas(folders) {
  const l = Array.isArray(folders) ? folders : [];
  if (!l.length) return 'No hay carpetas: todo está «sin carpeta».';
  return [`Carpetas del Estudio (${l.length}):`, ...l.slice(0, 200).map((f) => `- ${f.id} · «${clip(f.name, 60)}» · ${f.n ?? 0} archivos${f.parentId ? ` · dentro de ${f.parentId}` : ''}`)].join('\n');
}
export function listaPapelera(r) {
  const it = Array.isArray(r?.items) ? r.items : [];
  if (!it.length) return 'La papelera del Estudio está vacía.';
  const fila = (x) => `- ${x.id} · ${tipo(x)} · tirada ${fecha(x.trashedAt)} · quedan ${x.daysLeft} días · «${clip(x.prompt, 70)}»`;
  return [`Papelera del Estudio (${it.length}; se vacía sola a los ${r.days ?? 30} días):`, ...it.slice(0, 100).map(fila),
    'Para recuperar uno: galeria_cambiar → papelera_restaurar con su id.'].join('\n');
}
export function listaTrabajos(jobs, budget) {
  const l = Array.isArray(jobs) ? jobs : [];
  const L = [`Trabajos del Estudio (${l.length}):`];
  for (const j of l.slice(0, 40)) L.push(`- ${j.id} · ${j.state} · ${j.kind || '?'} · ${clip(j.model, 40)} · ${fecha(j.at)}${j.cost ? ` · ${dinero(j.cost)}` : ''}${j.error ? ` · ${clip(j.error, 100)}` : ''} · «${clip(j.prompt, 70)}»`);
  if (!l.length) L.push('No hay trabajos.');
  if (budget) L.push(`Hoy: ${budget.used ?? '?'} generaciones${budget.limit ? ` de ${budget.limit}` : ''}${budget.costDay != null ? ` · ${dinero(budget.costDay)} gastados` : ''}.`);
  return L.join('\n');
}
export function listaPresets(r, max = 40) {
  const p = Array.isArray(r?.presets) ? r.presets : [];
  if (!p.length) return 'No hay presets con ese filtro.';
  const fila = (x) => `- ${x.id} · ${x.medio || x.kind || ''} · ${clip(x.nombre || x.name || x.id, 50)}${x.propio || x.origen === 'propio' ? ' · TUYO' : ''} · ${clip(x.descripcion || x.desc || x.cuando || '', 90)}`;
  return [`Presets (${p.length}${p.length > max ? `, enseño ${max}` : ''}):`, ...p.slice(0, max).map(fila)].join('\n');
}
export function listaLotes(r) {
  const l = Array.isArray(r?.lotes) ? r.lotes : [];
  if (!l.length) return 'No hay lotes.';
  return [`Lotes (${l.length}):`, ...l.slice(0, 40).map((x) => `- ${x.id} · ${x.estado} · «${clip(x.nombre, 60)}» · ${x.filas?.length ?? x.cuentas?.total ?? '?'} fotos`), 'Por este conector los lotes solo se ven: crearlos o ponerlos a trabajar es del Estudio de la oficina.'].join('\n');
}
export function fichaLote(l) {
  if (!l) return 'No encuentro ese lote.';
  const c = l.cuentas || {};
  return [`Lote ${l.id} · ${l.estado} · «${clip(l.nombre, 80)}»`, l.resumen ? clip(l.resumen, 300) : '', `Fotos: ${c.total ?? l.filas?.length ?? '?'} · hechas ${c.hechas ?? '?'} · por revisar ${c.revisar ?? '?'} · fallidas ${c.falladas ?? c.fallidas ?? '?'}`,
    ...(Array.isArray(l.filas) ? l.filas.slice(0, 30).map((f) => `- ${f.n} · ${f.estado}${f.sku ? ` · ${clip(f.sku, 30)}` : ''}`) : [])].filter(Boolean).join('\n');
}
export function listaVoces(r) {
  const v = Array.isArray(r?.voices) ? r.voices : [];
  const sis = Array.isArray(r?.system) ? r.system : [];
  return [v.length ? `Voces propias (${v.length}):` : 'No hay voces propias.', ...v.slice(0, 50).map((x) => `- ${x.id} · ${clip(x.name || x.nombre, 50)} · ${clip(x.kind || x.tipo || '', 20)}`),
    `Voces del sistema: ${sis.length}${sis.length ? ` (por ejemplo ${sis.slice(0, 5).map((x) => x.id || x.voice_id).filter(Boolean).join(', ')})` : ''}.`, 'Diseñar o clonar una voz cuesta dinero: se hace en el Estudio de la oficina.'].join('\n');
}
export function textoLimites(r) {
  const l = r?.limites || {}, b = r?.budget || {};
  return `Topes del Estudio: ${Object.entries(l).filter(([, v]) => typeof v !== 'object').map(([k, v]) => `${k}=${v}`).join(' · ') || 'sin topes guardados'}.` + (b.left != null ? ` Hoy quedan ${b.left} generaciones.` : '');
}
