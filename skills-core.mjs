// Agents Office — las reglas de una skill, PURAS (sin imports, sin disco): las usan skills.mjs (la oficina local, que lee carpetas)
// y cloudflare/worker/lib/skills-api.js (la nube, que las guarda en D1 y las edita por /api/skills). Una sola definición de
// la forma de SKILL.md, de los topes y de las extensiones legibles; un cambio aquí cambia las dos oficinas.

export const LIMITS = { body: 6000, files: 8000, perFile: 4000 };
export const TEXT = /\.(md|txt|csv|json|ya?ml|html?|xml|tsv)$/i;
/** Lo que el API de la nube además exige al ESCRIBIR (la local, al leer, recorta y avisa; escribir sí rechaza). */
export const LIMITES_API = { descripcion: 160, maxArchivos: 20, maxSkills: 150 };
export const CAMPOS_META = ['name', 'description', 'agents', 'departments'];
/** Nombres que el API usa como rutas (/api/skills/papelera): una skill no puede llamarse así. */
export const NOMBRES_RESERVADOS = ['papelera', 'versiones', 'volver', 'restaurar'];

const NOMBRE = /^[a-z0-9][a-z0-9._-]{0,59}$/;
const ARCHIVO = /^[A-Za-z0-9][A-Za-z0-9._-]{0,59}$/;

/** Parse the front-matter block of a SKILL.md → { meta, body }. Values: text, [a, b], or "- a" lines. */
export function parseSkill(text) {
  const meta = {}; let body = text;
  const m = text.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (m) {
    body = text.slice(m[0].length);
    let key = null;
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (kv) {
        key = kv[1].toLowerCase(); const v = kv[2].trim();
        if (v.startsWith('[')) meta[key] = v.replace(/^\[|\]$/g, '').split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        else if (v === '') meta[key] = [];
        else meta[key] = v.replace(/^["']|["']$/g, '');
      } else if (key && /^\s*-\s+/.test(line)) { if (!Array.isArray(meta[key])) meta[key] = []; meta[key].push(line.replace(/^\s*-\s+/, '').trim().replace(/^["']|["']$/g, '')); }
    }
  }
  return { meta, body: body.trim() };
}

/** Un valor de cabecera (lista, «a, b» o nada) → lista de textos. */
export const lista = v => v === undefined || v === null ? [] : Array.isArray(v) ? v.map(String) : String(v).split(',').map(s => s.trim()).filter(Boolean);

/** La skill como texto de SKILL.md (para leerla, compararla y guardar una versión). */
export function armarMd(s) {
  const cab = ['---', `name: ${s.name}`, `description: ${String(s.description || '').replace(/\r?\n/g, ' ')}`];
  if ((s.agents || []).length) cab.push(`agents: [${s.agents.join(', ')}]`);
  if ((s.departments || []).length) cab.push(`departments: [${s.departments.join(', ')}]`);
  cab.push('---', '');
  return cab.join('\n') + (s.text || '') + '\n';
}

/**
 * Valida una skill que alguien quiere GUARDAR. Entrada (cuerpo del PUT): { md } (un SKILL.md entero) o { description, agents, departments, text },
 * y `files: [{ name, text }]`. Sin `agents` ni `departments`, hace falta `todos: true` (una skill para toda la casa se pide a propósito).
 * ctx: { agentIds: [...], deptKeys: [...] }. → { ok, errores: [...], avisos: [...], valor }  (valor = la fila lista para guardar).
 */
export function validarSkill(nombre, entrada, { agentIds = [], deptKeys = [] } = {}) {
  const errores = [], avisos = [];
  const e = entrada && typeof entrada === 'object' && !Array.isArray(entrada) ? entrada : {};
  nombre = String(nombre ?? '');
  if (!NOMBRE.test(nombre)) errores.push('El nombre de la skill va en minúsculas, con letras, números, punto, guion o guion bajo (hasta 60), sin espacios ni barras.');
  else if (nombre.includes('..')) errores.push('El nombre de la skill no puede llevar «..».');
  else if (NOMBRES_RESERVADOS.includes(nombre)) errores.push(`«${nombre}» es una palabra que usa el sistema; elige otro nombre.`);

  let meta, text;
  if (typeof e.md === 'string') {
    const p = parseSkill(e.md); meta = p.meta; text = p.body;
    if (meta.name !== undefined && String(meta.name).trim().toLowerCase() !== nombre) errores.push(`El «name» de la cabecera (${meta.name}) no es el de la ruta (${nombre}).`);
    for (const k of Object.keys(meta)) if (!CAMPOS_META.includes(k)) avisos.push(`La cabecera trae «${k}», que no se usa: se ignora.`);
  } else { meta = { description: e.description, agents: e.agents, departments: e.departments }; text = typeof e.text === 'string' ? e.text.trim() : ''; }

  const description = String(meta.description ?? '').trim();
  if (!description) errores.push('Falta la descripción (una línea: cuándo se usa esta skill).');
  else if (description.length > LIMITES_API.descripcion) errores.push(`La descripción pasa de ${LIMITES_API.descripcion} caracteres (tiene ${description.length}).`);
  if (!text) errores.push('La skill está vacía: escribe las instrucciones.');
  else if (text.length > LIMITS.body) errores.push(`Las instrucciones pasan de ${LIMITS.body} caracteres (tienen ${text.length}); lo largo va en archivos al lado.`);

  const ids = new Set(agentIds), depts = new Set(deptKeys);
  const agents = [...new Set(lista(meta.agents).map(s => s.toLowerCase()))], departments = [...new Set(lista(meta.departments).map(s => s.toLowerCase()))];
  for (const id of agents) if (!ids.has(id)) errores.push(`«${id}» no es el id de ningún agente.`);
  for (const k of departments) if (!depts.has(k)) errores.push(`«${k}» no es un departamento (${deptKeys.join(', ')}).`);
  const everyone = !agents.length && !departments.length;
  if (everyone && e.todos !== true) errores.push('Dime a quién va: `agents` o `departments`. Una skill para todos los agentes se pide con `todos: true` (solo para el estilo de la casa).');
  else if (everyone) avisos.push('Esta skill va a TODOS los agentes: úsala solo para el estilo de la casa.');

  const files = [];
  const archivos = e.files === undefined ? [] : e.files;
  if (!Array.isArray(archivos)) errores.push('`files` es una lista de { name, text }.');
  else {
    if (archivos.length > LIMITES_API.maxArchivos) errores.push(`Hasta ${LIMITES_API.maxArchivos} archivos por skill.`);
    let total = 0; const vistos = new Set();
    for (const f of archivos.slice(0, LIMITES_API.maxArchivos)) {
      const n = f && typeof f === 'object' ? String(f.name ?? '') : '';
      if (!ARCHIVO.test(n) || n.includes('..')) { errores.push(`El nombre de archivo «${n.slice(0, 40)}» no vale (letras, números, punto, guion; sin barras ni empezar por punto).`); continue; }
      if (n.toUpperCase() === 'SKILL.MD') { errores.push('SKILL.md es la skill misma: no va entre los archivos.'); continue; }
      if (vistos.has(n.toLowerCase())) { errores.push(`El archivo «${n}» está repetido.`); continue; }
      vistos.add(n.toLowerCase());
      if (!TEXT.test(n)) { errores.push(`«${n}»: solo se guardan archivos de texto (.md .txt .csv .json .yaml .yml .html .xml .tsv).`); continue; }
      if (typeof f.text !== 'string') { errores.push(`«${n}» no trae su texto.`); continue; }
      const t = f.text.trim();
      if (t.length > LIMITS.perFile) { errores.push(`«${n}» pasa de ${LIMITS.perFile} caracteres (tiene ${t.length}).`); continue; }
      total += t.length; files.push({ name: n, text: t });
    }
    if (total > LIMITS.files) errores.push(`Los archivos juntos pasan de ${LIMITS.files} caracteres (llevan ${total}).`);
  }
  const valor = { name: nombre, description, agents, departments, everyone, text, files, source: 'brain' };
  return { ok: !errores.length, errores, avisos, valor };
}

/** El resumen que enseña la lista: sin el texto, con tamaño y lo que le pasa. */
export function resumenSkill(s, { agentIds = [], deptKeys = [] } = {}) {
  const ids = new Set(agentIds), depts = new Set(deptKeys), problemas = [];
  for (const id of s.agents || []) if (!ids.has(id)) problemas.push(`«${id}» ya no es un agente`);
  for (const k of s.departments || []) if (!depts.has(k)) problemas.push(`«${k}» no es un departamento`);
  const sinAgentes = !(s.everyone) && (s.agents || []).length + (s.departments || []).length > 0 && !(s.agents || []).some(a => ids.has(a)) && !(s.departments || []).some(d => depts.has(d));
  if (sinAgentes) problemas.push('no llega a ningún agente');
  if ((s.text || '').length > LIMITS.body) problemas.push('pasa del tope de instrucciones');
  const tamano = (s.text || '').length + (s.files || []).reduce((a, f) => a + (f.text ? f.text.length : 0), 0);
  return { name: s.name, description: s.description || '', agents: s.agents || [], departments: s.departments || [], everyone: !!s.everyone, files: (s.files || []).map(f => f.name), size: tamano, source: s.source || 'brain', problems: problemas };
}
