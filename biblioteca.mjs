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

export const AREAS = { estrategia: 'Estrategia', 'contenido-y-texto': 'Contenido y textos', seo: 'SEO y búsqueda', conversion: 'Conversión', 'pagados-y-medicion': 'Pagados y medición', 'crecimiento-y-retencion': 'Crecimiento y retención', 'ventas-y-gtm': 'Ventas y salida al mercado', canales: 'Canales' };
const CAMPOS = ['name', 'titulo', 'description', 'area', 'departments', 'agents', 'origen', 'palabras'];
export const UMBRAL = 6; // el puntaje mínimo para adelantar una habilidad: una palabra clave rara del título o de sus «palabras», o varias de la descripción
export const TOPES = { indice: 60, adelanto: 14000, leer: 30000, referencia: 30000 };
const LEGIBLE = /\.(md|txt|csv|json)$/i;

const lista = v => v === undefined ? [] : Array.isArray(v) ? v : String(v).split(',').map(s => s.trim()).filter(Boolean);
// palabras para buscar: minúsculas, sin acentos, sin palabras vacías, raíz de 6 letras («campañas» y «campaña» se encuentran; «contesta» y «contexto» no)
const VACIAS = new Set(('para como cuando que con por los las del una uno unos unas sus mas pero este esta esto estos estas ese esa eso entre sobre desde hasta donde quiere quieres usala usalo tambien hacer haga hace the and for with your you from that this when want wants user what into also any are can how not our out use using ' +
  // los verbos de un pedido no dicen de qué trata («prepara», «arma», «revisa»…): sin ellos, «contesta» no encuentra «contexto»
  'prepara preparar preparame arma armar armame haz hazme escribe escribir escribeme revisa revisar mejora mejorar disena disenar contesta contestar responde responder investiga investigar crea crear creame necesito quiero dame ayuda ayudame semana proximo proxima nuestro nuestra nuestros nuestras haya').split(' '));
export const raices = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9ñ]+/).filter(w => w.length > 2 && !VACIAS.has(w)).map(w => w.slice(0, 6));

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
  const ids = new Set(agentes.map(a => a.id));
  for (const h of [...porId.values()]) {
    const tenia = h.agents.length + h.departments.length;
    h.agents = h.agents.filter(id => ids.has(id) || (problemas.push(`${h.id}: «${id}» no es un puesto — se ignora`), false));
    h.departments = h.departments.filter(k => deptos.includes(k) || (problemas.push(`${h.id}: «${k}» no es un departamento — se ignora`), false));
    if (tenia && !h.agents.length && !h.departments.length) { problemas.push(`${h.id}: ninguno de sus puestos o departamentos existe — no se usa`); porId.delete(h.id); }
    else if (!tenia) { problemas.push(`${h.id}: no dice qué departamentos o puestos la usan — no se usa`); porId.delete(h.id); }
  }
  const reemplazadas = new Set(skillsDelDueno.map(s => String(s).toLowerCase())); // una skill del dueño con el mismo id manda
  for (const id of reemplazadas) porId.delete(id);
  const todas = [...porId.values()].sort((a, b) => a.area.localeCompare(b.area) || a.titulo.localeCompare(b.titulo, 'es'));
  const de = a => todas.filter(h => h.agents.includes(a.id) || h.departments.includes(a.department));
  // para elegir: cada habilidad es un pequeño documento (id y título pesan 3, sus palabras clave 3, la descripción 1); una palabra
  // que sale en muchas habilidades («página», «cliente») vale poco y una rara («SEO», «Meta», «precio») vale mucho (idf, como BM25)
  const docs = new Map(todas.map(h => { const m = new Map(); const pon = (t, w) => { for (const r of new Set(raices(t))) m.set(r, Math.max(m.get(r) || 0, w)); };
    pon(h.description, 1); pon(h.palabras.join(' '), 3); pon(`${h.id.replace(/-/g, ' ')} ${h.titulo}`, 3); return [h.id, m]; }));
  const df = new Map(); for (const m of docs.values()) for (const r of m.keys()) df.set(r, (df.get(r) || 0) + 1);
  const N = Math.max(1, todas.length), idf = r => Math.log(1 + (N - (df.get(r) || 0) + 0.5) / ((df.get(r) || 0) + 0.5));
  const puntaje = (q, h) => { const m = docs.get(h.id); let s = 0; for (const r of q) if (m.has(r)) s += m.get(r) * idf(r); return s; };

  /** Las que mejor encajan con un pedido (para adelantar la primera entera). Las del puesto pesan un poco más; nada por debajo del umbral. */
  function elegir(texto, a, n = 1) {
    const q = [...new Set(raices(texto))]; if (!q.length || !a) return [];
    const l = de(a).map(h => ({ h, s: puntaje(q, h) * (h.agents.includes(a.id) ? 1.15 : 1) })).filter(x => x.s >= UMBRAL).sort((x, y) => y.s - x.s);
    if (n === 1 && l.length > 1 && l[0].s < l[1].s * 1.2) return []; // dos casi empatadas: mejor no adelantar ninguna (el agente elige con el índice)
    return l.slice(0, n).map(x => x.h);
  }
  /** El bloque del prompt: la habilidad adelantada (si hay) y el índice de las del agente. */
  function promptText(a, texto = '') {
    const mias = de(a); if (!mias.length) return '';
    const propias = mias.filter(h => h.agents.includes(a.id)), resto = mias.filter(h => !h.agents.includes(a.id));
    const linea = h => `- ${h.id} — ${h.titulo}: ${h.description.replace(/^Úsala cuando\s*/i, 'cuando ').slice(0, 170)}`;
    const elegida = texto ? elegir(texto, a, 1)[0] : null;
    const adelanto = elegida ? `\nHABILIDAD QUE APLICA A ESTA TAREA: ${elegida.titulo} (${elegida.id}). Síguela; sus referencias se piden con leer_habilidad.\n${recortar(elegida.cuerpo, TOPES.adelanto)}\n` : '';
    return `${adelanto}\nBIBLIOTECA DE HABILIDADES (mcp__habilidades__*): métodos probados para este trabajo. Si la tarea encaja con una, léela ANTES de empezar con leer_habilidad (id) y síguela; sus referencias (plantillas, listas, ejemplos) se piden con leer_habilidad (id, referencia). Lo de la empresa no está ahí: está en las notas del Cerebro (00-Empresa) y en las cifras.\n` +
      `${propias.length ? `Las de tu puesto:\n${propias.slice(0, TOPES.indice).map(linea).join('\n')}\n` : ''}${resto.length ? `Las de tu departamento:\n${resto.slice(0, TOPES.indice - propias.length).map(linea).join('\n')}\n` : ''}`;
  }
  /** Lo que devuelve leer_habilidad: el cuerpo (con la lista de referencias) o una referencia. */
  function leer(id, referencia = null) {
    const h = porId.get(String(id || '').trim()); if (!h) return { error: `no hay ninguna habilidad «${id}» (ver_habilidades da la lista)` };
    if (!referencia) return { habilidad: h, texto: `# ${h.titulo} (${h.id})\n\n${recortar(h.cuerpo, TOPES.leer)}${h.referencias.length ? `\n\nREFERENCIAS (pídelas con leer_habilidad id="${h.id}" referencia="<nombre>"):\n${h.referencias.map(r => `- ${r.nombre}`).join('\n')}` : ''}` };
    const nombre = String(referencia).replace(/\.md$/i, '').trim().toLowerCase();
    const r = h.referencias.find(x => x.nombre.toLowerCase() === nombre) || h.referencias.find(x => x.nombre.toLowerCase().includes(nombre));
    if (!r) return { error: `«${h.id}» no tiene la referencia «${referencia}». Tiene: ${h.referencias.map(x => x.nombre).join(', ') || 'ninguna'}` };
    const p = path.join(h.dir, 'referencias', r.archivo); if (!path.resolve(p).startsWith(path.resolve(h.dir) + path.sep)) return { error: 'referencia fuera de su carpeta' };
    return { habilidad: h, referencia: r.nombre, texto: `# ${h.titulo} · ${r.nombre}\n\n${recortar(fs.readFileSync(p, 'utf8'), TOPES.referencia)}` };
  }
  /** Las relacionadas que nombra su sección «Habilidades relacionadas» y no existen (para el check). */
  const rotas = h => { const sec = /#+\s*Habilidades relacionadas[\s\S]*?(?=\n#+\s|$)/i.exec(h.cuerpo)?.[0] || ''; return [...new Set([...sec.matchAll(/`([a-z0-9-]+)`/g)].map(m => m[1]))].filter(x => !porId.has(x)); };
  const resumen = h => ({ id: h.id, titulo: h.titulo, description: h.description, area: h.area, areaNombre: AREAS[h.area], departments: h.departments, agents: h.agents, origen: h.origen, fuente: h.fuente, coleccion: h.coleccion, referencias: h.referencias.map(r => r.nombre), chars: h.cuerpo.length, evals: h.evals });
  return { todas, problemas, de, elegir, promptText, leer, resumen, rotas, porId: id => porId.get(id) || null };
}
export const recortar = (t, n) => (t.length > n ? t.slice(0, n) + '\n[… sigue: pide la referencia o una parte más concreta]' : t);
