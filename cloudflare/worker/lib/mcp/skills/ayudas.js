// Ayudas del dominio SKILLS del conector MCP (P5, carril 7): texto de las lecturas, la marca de origen y la revisión de lo que se escribe. No toca el servidor del conector.
import { injectionIn } from '../../../../../safety.mjs';
import { NOMBRES_RESERVADOS, parseSkill, lista } from '../../../../../skills-core.mjs';

/** Las skills de ejemplo que trae la oficina: por MCP no se borran (se hace en la oficina). */
export const SKILLS_DE_FABRICA = Object.freeze(['catalogo-fotos', 'client-reply', 'house-style', 'plan-contenido', 'proposal']);
export const NOMBRE_SKILL = /^[a-z0-9][a-z0-9._-]{0,59}$/;
export const ID_HABILIDAD = /^[a-z0-9][a-z0-9-]{0,59}$/;
export const TEXTO_MAX = 5800; // el cuerpo de una skill admite 6.000: aquí caben la marca de origen y un margen

export const marca = (fecha) => `(escrita vía MCP el ${fecha}; revísala antes de confiar en ella)`;
/** El texto con la marca REAL de origen como primera línea (la que el modelo traiga por su cuenta se quita: no puede fingirla). */
export function conMarca(texto, fecha) { return `${marca(fecha)}\n${String(texto || '').trim().replace(/^\(escrita vía MCP[^\n]*\n?/, '').trim()}`; }
export const nombreOk = (n) => NOMBRE_SKILL.test(n) && !NOMBRES_RESERVADOS.includes(n);

/** ¿Algo de lo que se va a escribir parece pedir que un agente se salte sus reglas? → la frase detectada | null */
export function sospecha({ description, text, files } = {}) { return injectionIn([description, text, ...(Array.isArray(files) ? files : []).flatMap((f) => [f?.name, f?.text])].filter(Boolean).join('\n')) || null; }

/** Texto de terceros dentro de un cerco: no puede cerrarlo (`<` se vuelve «‹») y, si por sí solo parece pedir saltarse reglas, se retiene sin tumbar el resto. */
export const RETENIDO = '[contenido retenido: parece pedir saltarse reglas; léelo en la oficina]';
export const seguro = (t) => { const x = String(t ?? ''); return injectionIn(x) ? RETENIDO : x.replace(/</g, '‹'); };
const llega = (s) => s.everyone ? 'TODOS los agentes' : [s.departments?.length ? `departamentos ${s.departments.join(', ')}` : '', s.agents?.length ? `agentes ${s.agents.join(', ')}` : ''].filter(Boolean).join(' y ') || 'nadie';
export function listaTexto(r) {
  const l = Array.isArray(r?.skills) ? r.skills : [];
  if (!l.length) return 'No hay skills todavía.';
  const fila = (s) => `- ${s.name} · llega a ${llega(s)} · ${s.size} letras${s.files?.length ? ` · ${s.files.length} archivos` : ''}${s.problems?.length ? ` · PROBLEMAS: ${seguro(s.problems.join('; '))}` : ''}`;
  return `${l.length} de ${r.tope ?? '?'} skills posibles:\n` + l.map((s) => `${fila(s)}\n  ${seguro(String(s.description || '').slice(0, 160))}`).join('\n');
}
export function verTexto(r) {
  const s = r?.skill; if (!s) return 'No existe esa skill.';
  const arch = (s.files || []).map((f) => `\n--- archivo ${seguro(f.name)} ---\n${f.text == null ? '(no se lee: no es texto)' : seguro(f.text)}`).join('');
  return `Skill «${s.name}» · llega a ${llega(s)} · actualizado: ${s.actualizado || 'sin fecha'} (pásalo como «base» al reemplazarla)\n${s.problems?.length ? `PROBLEMAS: ${seguro(s.problems.join('; '))}\n` : ''}${seguro(s.md)}${arch}`;
}
export function versionesTexto(r) {
  if (r?.text !== undefined) return `Versión ${r.at} de «${r.name}» (${r.accion}, por ${seguro(r.por)}):\n${seguro(r.text)}`;
  const v = Array.isArray(r?.versions) ? r.versions : [];
  return v.length ? `Versiones de «${r.name}» (la más nueva primero; «at» es su id):\n` + v.map((x) => `- at ${x.at} · ${new Date(x.at).toISOString().slice(0, 16)}Z · ${x.accion} · por ${seguro(x.por)} · ${x.size} letras`).join('\n') : `«${r?.name}» no tiene versiones guardadas.`;
}
export function papeleraTexto(r) {
  const l = Array.isArray(r?.items) ? r.items : [];
  return l.length ? `Papelera (se conserva ${r.keepDays} días; «id» sirve para restaurar):\n` + l.map((x) => `- ${x.id} · ${x.name} · borrada ${new Date(x.at).toISOString().slice(0, 16)}Z por ${seguro(x.por)}`).join('\n') : 'La papelera está vacía.';
}
export function bibliotecaTexto(r) {
  const l = Array.isArray(r?.habilidades) ? r.habilidades : [];
  if (!l.length) return 'La Biblioteca no tiene habilidades que encajen.';
  return `${l.length} de ${r.total} habilidades (solo lectura; «habilidad» con el id las lee):\n` + l.map((h) => `- ${h.id} · ${seguro(h.titulo || h.title || '')} · ${seguro(h.area || '')}\n  ${seguro(String(h.description || h.cuando || '').slice(0, 200))}`).join('\n')
    + (r.problemas?.length ? `\nProblemas: ${seguro(r.problemas.slice(0, 5).join('; '))}` : '');
}
export function habilidadTexto(r) { return `Habilidad «${r?.id}»${r?.referencia ? ` · referencia ${seguro(r.referencia)}` : ''}:\n${seguro(r?.texto ?? '')}`; }

/** A cuántos agentes llega una skill: { todos, agentes:Set, deptos:Set (los cubiertos: nombrados o con TODOS sus agentes) }. `roster` = [{ id, department }]. */
export function alcance(v, roster) {
  const ag = new Set(), dp = new Set(), deptos = [...new Set(roster.map((a) => a.department))];
  const todos = !!v?.everyone || (!(v?.agents || []).length && !(v?.departments || []).length);
  for (const a of roster) if (todos || (v.agents || []).includes(a.id) || (v.departments || []).includes(a.department)) ag.add(a.id);
  for (const d of deptos) if (todos || (v.departments || []).includes(d) || roster.filter((a) => a.department === d).every((a) => ag.has(a.id))) dp.add(d);
  return { todos, agentes: ag, deptos: dp };
}
export const MIN_DEPTOS = 5, MIN_AGENTES = 10;
/** ¿Esto pide la confirmación expresa del dueño? (el alcance EFECTIVO, no lo que dice el campo) → texto | null. `antes` = la skill que ya hay; `fabrica` = ¿la que ya hay es de fábrica? */
export function pideConfirmar(nuevo, antes, roster, { fabrica = false } = {}) {
  const n = alcance(nuevo, roster), o = antes ? alcance(antes, roster) : null;
  const motivos = [];
  if (n.todos) motivos.push('llega a TODOS los agentes');
  else { if (n.deptos.size >= MIN_DEPTOS) motivos.push(`cubre ${n.deptos.size} de ${new Set(roster.map((a) => a.department)).size} departamentos`); if (n.agentes.size >= MIN_AGENTES) motivos.push(`llega a ${n.agentes.size} agentes`); }
  if (o && [...n.agentes].some((a) => !o.agentes.has(a))) motivos.push(`su alcance CRECE (de ${o.agentes.size} a ${n.agentes.size} agentes)`);
  if (fabrica && antes) motivos.push('es una skill de fábrica de la oficina');
  return motivos.length ? motivos.join('; ') : null;
}
/** De un SKILL.md (versión del historial) → { everyone, agents, departments }. */
export function metaDeMd(md, todos = false) { const m = parseSkill(String(md || '')).meta; return { everyone: todos, agents: lista(m.agents), departments: lista(m.departments) }; }
