// Agents Office — la BIBLIOTECA de habilidades (7 oct 2026). Métodos de trabajo que viajan con la oficina, en español y para
// cualquier empresa (la primera colección: marketing, adaptada de marketingskills de Corey Haines, MIT). A diferencia de una skill
// (skills.mjs), que se lee ENTERA antes de cada tarea, una habilidad de la biblioteca se lee CUANDO HACE FALTA:
//   · cada agente ve en su prompt el ÍNDICE de las suyas (id, título, cuándo usarla) — unas líneas;
//   · la que mejor encaja con la tarea se le adelanta entera (elegir());
//   · las demás y sus referencias las pide con la herramienta habilidades (habilidades-mcp.mjs → /api/biblioteca).
// Así 50 métodos de 10–20 páginas caben sin llenar cada ejecución.
//
//   biblioteca/<colección>/<id>/SKILL.md          la de la oficina (viaja por GitHub, igual para todos)
//   biblioteca/<colección>/<id>/referencias/*.md  lo detallado, que se pide por nombre
//   biblioteca/<colección>/<id>/evals.json        pedidos de prueba (scripts/evals-skill.mjs)
//   <cerebro>/Agents Office/biblioteca/<id>/…     la del dueño: gana a la de la oficina con el mismo id
//   <cerebro>/Agents Office/skills/<id>/          una skill del dueño con el mismo id la reemplaza (y esa sí se lee siempre)
// Lo de la empresa (posicionamiento, cliente ideal, voz, cifras) NO va aquí: está en el Cerebro (00-Empresa/…). Puro salvo leer el disco.
import fs from 'node:fs';
import path from 'node:path';
import { parseSkill } from './skills.mjs';
import { AREAS, UMBRAL, TOPES, raices, recortar, lista, armarBiblioteca, textoHabilidad, buscarReferencia, textoReferencia, errorSinReferencia } from './biblioteca-core.mjs'; // el núcleo puro (también lo usa la nube)
export { AREAS, UMBRAL, TOPES, raices, recortar };
const CAMPOS = ['name', 'titulo', 'description', 'area', 'departments', 'agents', 'origen', 'palabras'];
const LEGIBLE = /\.(md|txt|csv|json)$/i;

function leerUna(dir, id, fuente, problemas) {
  const archivo = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(archivo)) { problemas.push(`${id}/: falta SKILL.md — no se usa`); return null; }
  const { meta, body } = parseSkill(fs.readFileSync(archivo, 'utf8'));
  if (!body) { problemas.push(`${id}/SKILL.md: vacío — no se usa`); return null; }
  for (const k of Object.keys(meta)) if (!CAMPOS.includes(k)) problemas.push(`${id}/SKILL.md: campo desconocido «${k}» — se ignora`);
  if (meta.name && meta.name !== id) problemas.push(`${id}/SKILL.md: name «${meta.name}» no es el nombre de su carpeta`);
  const area = AREAS[meta.area] ? meta.area : 'estrategia';
  if (!AREAS[meta.area]) problemas.push(`${id}/SKILL.md: área «${meta.area || ''}» desconocida (${Object.keys(AREAS).join(', ')}) — va a estrategia`);
  const description = String(meta.description || '').trim();
  if (!description) problemas.push(`${id}/SKILL.md: falta description (cuándo usarla)`);
  const refDir = path.join(dir, 'referencias'), referencias = [];
  if (fs.existsSync(refDir)) for (const f of fs.readdirSync(refDir).sort()) { const p = path.join(refDir, f); if (!f.startsWith('.') && LEGIBLE.test(f) && fs.statSync(p).isFile()) referencias.push({ nombre: f.replace(/\.md$/i, ''), archivo: f, chars: fs.statSync(p).size }); }
  return { id, titulo: String(meta.titulo || id).trim(), description: description.slice(0, 400), area, departments: lista(meta.departments).map(s => s.toLowerCase()), agents: lista(meta.agents).map(s => s.toLowerCase()),
    origen: String(meta.origen || '').trim(), palabras: lista(meta.palabras), cuerpo: body, referencias, dir, fuente, evals: fs.existsSync(path.join(dir, 'evals.json')) };
}

/** Lee la biblioteca de la oficina (todas sus colecciones) y la del dueño en el Cerebro. Nunca lanza. */
export function cargarBiblioteca({ raiz, brainPath, agentes = [], deptos = [], skillsDelDueno = [] } = {}) {
  const problemas = [], porId = new Map();
  const oficina = path.join(raiz, 'biblioteca'), delDueno = brainPath ? path.join(brainPath, 'Agents Office', 'biblioteca') : null;
  const colecciones = fs.existsSync(oficina) ? fs.readdirSync(oficina, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => ({ dir: path.join(oficina, e.name), coleccion: e.name })) : [];
  for (const { dir, coleccion } of colecciones) for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue;
    if (porId.has(e.name)) problemas.push(`${coleccion}/${e.name}: el id ya existe en otra colección — gana la primera`);
    const h = leerUna(path.join(dir, e.name), e.name, 'oficina', problemas); if (h && !porId.has(e.name)) porId.set(e.name, { ...h, coleccion });
  }
  if (delDueno && fs.existsSync(delDueno)) for (const e of fs.readdirSync(delDueno, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue;
    const h = leerUna(path.join(delDueno, e.name), e.name, 'cerebro', problemas); if (h) porId.set(e.name, { ...h, coleccion: porId.get(e.name)?.coleccion || 'propia' });
  }
  const b = armarBiblioteca({ habilidades: [...porId.values()], agentes, deptos, skillsDelDueno, problemas });
  /** Lo que devuelve leer_habilidad: el cuerpo (con la lista de referencias) o una referencia. */
  function leer(id, referencia = null) {
    const h = b.porId(String(id || '').trim()); if (!h) return { error: `no hay ninguna habilidad «${id}» (ver_habilidades da la lista)` };
    if (!referencia) return { habilidad: h, texto: textoHabilidad(h) };
    const r = buscarReferencia(h, referencia); if (!r) return { error: errorSinReferencia(h, referencia) };
    const p = path.join(h.dir, 'referencias', r.archivo); if (!path.resolve(p).startsWith(path.resolve(h.dir) + path.sep)) return { error: 'referencia fuera de su carpeta' };
    return { habilidad: h, referencia: r.nombre, texto: textoReferencia(h, r, fs.readFileSync(p, 'utf8')) };
  }
  return { ...b, leer };
}
