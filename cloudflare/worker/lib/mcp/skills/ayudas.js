// Ayudas del dominio SKILLS del conector MCP (P5, carril 7): texto de las lecturas, la marca de origen y la revisión de lo que se escribe. No toca el servidor del conector.
import { injectionIn } from '../../../../../safety.mjs';

/** Las skills de ejemplo que trae la oficina: por MCP no se borran (se hace en la oficina). */
export const SKILLS_DE_FABRICA = Object.freeze(['catalogo-fotos', 'client-reply', 'house-style', 'plan-contenido', 'proposal']);
export const NOMBRE_SKILL = /^[a-z0-9][a-z0-9._-]{0,59}$/;
export const ID_HABILIDAD = /^[a-z0-9][a-z0-9-]{0,59}$/;
export const TEXTO_MAX = 5800; // el cuerpo de una skill admite 6.000: aquí caben la marca de origen y un margen

export const marca = (fecha) => `(escrita vía MCP el ${fecha}; revísala antes de confiar en ella)`;
/** El texto con la marca de origen como PRIMERA línea (si ya la trae, no se repite). */
export function conMarca(texto, fecha) { const t = String(texto || '').trim(); return /^\(escrita vía MCP/.test(t) ? t : `${marca(fecha)}\n${t}`; }

/** ¿Algo de lo que se va a escribir parece pedir que un agente se salte sus reglas? → la frase detectada | null */
export function sospecha({ description, text, files } = {}) { return injectionIn([description, text, ...(Array.isArray(files) ? files : []).map((f) => f?.text)].filter(Boolean).join('\n')) || null; }

const llega = (s) => s.everyone ? 'TODOS los agentes' : [s.departments?.length ? `departamentos ${s.departments.join(', ')}` : '', s.agents?.length ? `agentes ${s.agents.join(', ')}` : ''].filter(Boolean).join(' y ') || 'nadie';
export function listaTexto(r) {
  const l = Array.isArray(r?.skills) ? r.skills : [];
  if (!l.length) return 'No hay skills todavía.';
  const fila = (s) => `- ${s.name} · llega a ${llega(s)} · ${s.size} letras${s.files?.length ? ` · ${s.files.length} archivos` : ''}${s.problems?.length ? ` · PROBLEMAS: ${s.problems.join('; ')}` : ''}`;
  return `${l.length} de ${r.tope ?? '?'} skills posibles:\n` + l.map((s) => `${fila(s)}\n  ${String(s.description || '').slice(0, 160)}`).join('\n');
}
export function verTexto(r) {
  const s = r?.skill; if (!s) return 'No existe esa skill.';
  const arch = (s.files || []).map((f) => `\n--- archivo ${f.name} ---\n${f.text ?? '(no se lee: no es texto)'}`).join('');
  return `Skill «${s.name}» · llega a ${llega(s)} · actualizado: ${s.actualizado || 'sin fecha'} (pásalo como «base» al reemplazarla)\n${s.problems?.length ? `PROBLEMAS: ${s.problems.join('; ')}\n` : ''}${s.md}${arch}`;
}
export function versionesTexto(r) {
  if (r?.text !== undefined) return `Versión ${r.at} de «${r.name}» (${r.accion}, por ${r.por}):\n${r.text}`;
  const v = Array.isArray(r?.versions) ? r.versions : [];
  return v.length ? `Versiones de «${r.name}» (la más nueva primero; «at» es su id):\n` + v.map((x) => `- at ${x.at} · ${new Date(x.at).toISOString().slice(0, 16)}Z · ${x.accion} · por ${x.por} · ${x.size} letras`).join('\n') : `«${r?.name}» no tiene versiones guardadas.`;
}
export function papeleraTexto(r) {
  const l = Array.isArray(r?.items) ? r.items : [];
  return l.length ? `Papelera (se conserva ${r.keepDays} días; «id» sirve para restaurar):\n` + l.map((x) => `- ${x.id} · ${x.name} · borrada ${new Date(x.at).toISOString().slice(0, 16)}Z por ${x.por}`).join('\n') : 'La papelera está vacía.';
}
export function bibliotecaTexto(r) {
  const l = Array.isArray(r?.habilidades) ? r.habilidades : [];
  if (!l.length) return 'La Biblioteca no tiene habilidades que encajen.';
  return `${l.length} de ${r.total} habilidades (solo lectura; «habilidad» con el id las lee):\n` + l.map((h) => `- ${h.id} · ${h.titulo || h.title || ''} · ${h.area || ''}\n  ${String(h.description || h.cuando || '').slice(0, 200)}`).join('\n')
    + (r.problemas?.length ? `\nProblemas: ${r.problemas.slice(0, 5).join('; ')}` : '');
}
export function habilidadTexto(r) { return `Habilidad «${r?.id}»${r?.referencia ? ` · referencia ${r.referencia}` : ''}:\n${r?.texto ?? ''}`; }
