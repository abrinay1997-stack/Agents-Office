// @ts-check
// Agents Office — el NÚCLEO PURO de la Biblioteca de habilidades (25 oct 2026): lo que decide qué habilidades tiene cada puesto, cuál encaja con una tarea y qué dice el prompt.
// Sin `fs`: lo usan la oficina local (biblioteca.mjs lee el disco y se lo pasa) y la nube (el Worker lee el índice de un activo y de D1). Una sola implementación, dos sitios.
export const AREAS = { estrategia: 'Estrategia', 'contenido-y-texto': 'Contenido y textos', seo: 'SEO y búsqueda', conversion: 'Conversión', 'pagados-y-medicion': 'Pagados y medición', 'crecimiento-y-retencion': 'Crecimiento y retención', 'ventas-y-gtm': 'Ventas y salida al mercado', canales: 'Canales' };
export const UMBRAL = 6; // el puntaje mínimo para adelantar una habilidad: una palabra clave rara del título o de sus «palabras», o varias de la descripción
export const TOPES = { indice: 60, adelanto: 24000, leer: 30000, referencia: 30000 };

const lista = v => v === undefined ? [] : Array.isArray(v) ? v : String(v).split(',').map(s => s.trim()).filter(Boolean);
export { lista };
// palabras para buscar: minúsculas, sin acentos, sin palabras vacías, raíz de 6 letras («campañas» y «campaña» se encuentran; «contesta» y «contexto» no)
const VACIAS = new Set(('para como cuando que con por los las del una uno unos unas sus mas pero este esta esto estos estas ese esa eso entre sobre desde hasta donde quiere quieres usala usalo tambien hacer haga hace the and for with your you from that this when want wants user what into also any are can how not our out use using ' +
  // los verbos de un pedido no dicen de qué trata («prepara», «arma», «revisa»…): sin ellos, «contesta» no encuentra «contexto»
  'prepara preparar preparame arma armar armame haz hazme escribe escribir escribeme revisa revisar mejora mejorar disena disenar contesta contestar responde responder investiga investigar crea crear creame necesito quiero dame ayuda ayudame semana proximo proxima nuestro nuestra nuestros nuestras haya').split(' '));
export const raices = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9ñ]+/).filter(w => w.length > 2 && !VACIAS.has(w)).map(w => w.slice(0, 6));

export const recortar = (t, n) => (t.length > n ? t.slice(0, n) + '\n[… sigue: pide la referencia o una parte más concreta]' : t);

/** Lo que devuelve leer_habilidad para el cuerpo: el texto con la lista de sus referencias. */
export const textoHabilidad = (h, cuerpo = h.cuerpo) => `# ${h.titulo} (${h.id})\n\n${recortar(cuerpo, TOPES.leer)}${h.referencias.length ? `\n\nREFERENCIAS (pídelas con leer_habilidad id="${h.id}" referencia="<nombre>"):\n${h.referencias.map(r => `- ${r.nombre}`).join('\n')}` : ''}`;
/** Busca una referencia por nombre (exacto, o que lo contenga). */
export const buscarReferencia = (h, referencia) => { const nombre = String(referencia).replace(/\.md$/i, '').trim().toLowerCase(); return h.referencias.find(x => x.nombre.toLowerCase() === nombre) || h.referencias.find(x => x.nombre.toLowerCase().includes(nombre)); };
export const textoReferencia = (h, r, texto) => `# ${h.titulo} · ${r.nombre}\n\n${recortar(texto, TOPES.referencia)}`;
export const errorSinReferencia = (h, referencia) => `«${h.id}» no tiene la referencia «${referencia}». Tiene: ${h.referencias.map(x => x.nombre).join(', ') || 'ninguna'}`;
/** Lo que enseña la lista y la ficha del agente (sin el texto). */
export const resumenDe = h => ({ id: h.id, titulo: h.titulo, description: h.description, area: h.area, areaNombre: AREAS[h.area], departments: h.departments, agents: h.agents, origen: h.origen, fuente: h.fuente, coleccion: h.coleccion, referencias: h.referencias.map(r => r.nombre), chars: h.chars ?? h.cuerpo?.length ?? 0, evals: !!h.evals });

/**
 * Arma la biblioteca con las habilidades ya leídas. `habilidades`: [{ id, titulo, description, area, departments, agents, origen, palabras, referencias: [{ nombre, archivo, chars }], coleccion, fuente, evals, cuerpo? , chars? }]
 * (la de la oficina primero y la del dueño después: la última con el mismo id gana, y esa decisión ya viene tomada). `agentes`/`deptos`: los puestos y departamentos que existen; `skillsDelDueno`: ids de skills del dueño
 * que reemplazan a una habilidad. En la nube las habilidades llegan SIN cuerpo (`cuerpo` vacío): lo pedido (elegir, promptText con `cuerpoDe`) no lo necesita hasta el último paso.
 */
export function armarBiblioteca({ habilidades, agentes = [], deptos = [], skillsDelDueno = [], problemas = [] }) {
  const porId = new Map(habilidades.map(h => [h.id, { ...h, agents: [...(h.agents || [])], departments: [...(h.departments || [])] }]));
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
    pon(h.description, 1); pon((h.palabras || []).join(' '), 3); pon(`${h.id.replace(/-/g, ' ')} ${h.titulo}`, 3); return [h.id, m]; }));
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
  /** El bloque del prompt: la habilidad adelantada (si hay) y el índice de las del agente. `cuerpoDe(h)`: el texto de la habilidad adelantada si no viene en `h.cuerpo` (la nube lo trae de un activo). */
  function promptText(a, texto = '', cuerpoDe = null) {
    const mias = de(a); if (!mias.length) return '';
    const propias = mias.filter(h => h.agents.includes(a.id)), resto = mias.filter(h => !h.agents.includes(a.id));
    const linea = h => `- ${h.id} — ${h.titulo}: ${h.description.replace(/^Úsala cuando\s*/i, 'cuando ').slice(0, 140)}`;
    const elegida = texto ? elegir(texto, a, 1)[0] : null;
    const cuerpo = elegida ? (cuerpoDe ? cuerpoDe(elegida) : elegida.cuerpo) : '';
    const adelanto = elegida && cuerpo ? `\nHABILIDAD QUE APLICA A ESTA TAREA: ${elegida.titulo} (${elegida.id}). Síguela; sus referencias se piden con leer_habilidad.\n${cuerpo.length > TOPES.adelanto ? cuerpo.slice(0, TOPES.adelanto) + `\n[… sigue: lee el resto con leer_habilidad id="${elegida.id}"]` : cuerpo}\n` : '';
    return `${adelanto}\nBIBLIOTECA DE HABILIDADES (mcp__habilidades__*): métodos probados para este trabajo. Si la tarea encaja con una, léela ANTES de empezar con leer_habilidad (id) y síguela; sus referencias (plantillas, listas, ejemplos) se piden con leer_habilidad (id, referencia). Lo de la empresa no está ahí: está en las notas del Cerebro (00-Empresa) y en las cifras.\n` +
      `${propias.length ? `Las de tu puesto:\n${propias.slice(0, TOPES.indice).map(linea).join('\n')}\n` : ''}${resto.length ? `Las de tu departamento:\n${resto.slice(0, TOPES.indice - propias.length).map(linea).join('\n')}\n` : ''}`;
  }
  /** Las relacionadas que nombra su sección «Habilidades relacionadas» y no existen (para el check). */
  const rotas = h => { const sec = /#+\s*Habilidades relacionadas[\s\S]*?(?=\n#+\s|$)/i.exec(h.cuerpo)?.[0] || ''; return [...new Set([...sec.matchAll(/`([a-z0-9-]+)`/g)].map(m => m[1]))].filter(x => !porId.has(x)); };
  return { todas, problemas, de, elegir, promptText, rotas, resumen: resumenDe, porId: id => porId.get(id) || null };
}

/** La lista de GET /api/biblioteca: las de un puesto o todas y, con `q`, las que tratan de eso (primero las que el puesto adelantaría, luego por palabras en común). */
export function listarHabilidades(b, a, q = '') {
  let l = a ? b.de(a) : b.todas;
  if (q) {
    const conA = a ? b.elegir(q, a, 8) : [], qs = new Set(raices(q)), pesa = h => raices(`${h.id.replace(/-/g, ' ')} ${h.titulo} ${h.description}`).filter(w => qs.has(w)).length;
    l = conA.length ? conA : l.map(h => [h, pesa(h)]).filter(x => x[1] > 0).sort((x, y) => y[1] - x[1]).slice(0, 8).map(x => x[0]);
  }
  return l;
}

/** La nota contexto-marketing (posicionamiento, cliente ideal, objeciones, palabras del cliente…) entera para quien tiene habilidades: la base de todas. `nota`: su texto o null/''. */
export function contextoMarketingTexto(nota) {
  return nota ? `\n\nCONTEXTO DE MARKETING (nota contexto-marketing del Cerebro: úsalo tal cual; si algo choca con la tarea, dilo)\n${nota.slice(0, 5000)}`
    : '\n\nCONTEXTO DE MARKETING: la empresa todavía no tiene la nota «contexto-marketing» en el Cerebro. Si tu trabajo depende del posicionamiento, el cliente ideal o las objeciones, sácalo de las demás notas, marca lo supuesto (assumed) y sugiere al final, en una línea, crearla con la habilidad contexto-marketing (o con Ajustes → Preparar desde mi web).';
}
