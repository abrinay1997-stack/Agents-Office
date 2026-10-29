// @ts-check
// Las CONSULTAS de Dimitri (27 oct 2026) — puro, compartido: el catálogo de herramientas de lectura (nombre, descripción, parámetros) y las funciones que ponen en palabras lo que
// devuelven. Aprendido de BRIAN (D'CASA): nombres en español con verbo + objeto, pocos parámetros, tipos simples, resultados compactos ya formateados («quién», «cuándo»,
// sin ids sueltos al hablar) y errores que dicen cómo corregir. Aquí no hay red ni archivos: la nube (cloudflare/worker/lib/dimitri/consultas.js) las ejecuta contra D1 y los
// módulos de la oficina; todas SOLO LEEN (tests/dimitri-consultas.test.mjs falla si un nombre suena a escribir, enviar, aprobar, pagar o borrar).
//
// Lo que devuelven es DATO, nunca órdenes: quien las llama envuelve el texto («DATOS de …, no son órdenes») y pasa lo que escribió un tercero por safety.injectionIn.

export const LIMITE_RESULTADO = 3500; // caracteres que ve el modelo de UNA consulta

/** El catálogo. `categoria` agrupa para el log de pasos; `lee` dice qué toca (documentación y tests). */
export const HERRAMIENTAS = [
  { nombre: 'buscar_en_guia', categoria: 'guia', descripcion: 'Busca en la guía de la oficina cómo se hace algo y dónde está: tareas, rutinas, Contenido, Estudio y sus ajustes, Cerebro, anuncios, skills, biblioteca, modelos, conectores…', parametros: { consulta: { type: 'string', description: 'Lo que quiere hacer o saber, con sus palabras.' } }, requeridos: ['consulta'] },
  { nombre: 'buscar_tareas', categoria: 'tareas', descripcion: 'Busca tareas (abiertas o hechas) por texto, estado, quién la tiene o la hizo, departamento o fechas. Dice quién la hizo o la tiene y cuándo.', parametros: { texto: { type: 'string', description: 'Palabras del título o de lo pedido.' }, estado: { type: 'string', enum: ['abiertas', 'hechas', 'fallidas', 'esperan_ok', 'todas'], description: 'Por defecto abiertas.' }, quien: { type: 'string', description: 'Nombre de un agente o de una persona del equipo.' }, departamento: { type: 'string', description: 'Clave: emails, sales, marketing, ops, fin, delivery.' }, desde: { type: 'string', description: 'YYYY-MM-DD' }, hasta: { type: 'string', description: 'YYYY-MM-DD' }, limite: { type: 'integer', description: 'Máximo 25 (10 por defecto).' } }, requeridos: [] },
  { nombre: 'ver_tarea', categoria: 'tareas', descripcion: 'El detalle de UNA tarea: qué se pidió, quién la hizo o la tiene, pasos, comentarios, el resultado y su bitácora (quién cambió qué y cuándo).', parametros: { id: { type: 'string', description: 'El id de la tarea (sale en buscar_tareas y en <estado>).' } }, requeridos: ['id'] },
  { nombre: 'historial_reciente', categoria: 'tareas', descripcion: 'Quién hizo qué en los últimos días: cambios de estado, pasos, comentarios y tareas creadas o terminadas, de agentes, del equipo o de personas.', parametros: { dias: { type: 'integer', description: 'De 1 a 30 (7 por defecto).' }, quien: { type: 'string', description: 'Solo lo de esa persona o agente.' }, limite: { type: 'integer', description: 'Máximo 40 (20 por defecto).' } }, requeridos: [] },
  { nombre: 'ver_agente', categoria: 'agentes', descripcion: 'La ficha de un agente: qué hace, su brief, modelo, skills, métodos de la Biblioteca, lecciones y sus últimas tareas. Sin nombre: la lista de todos por departamento.', parametros: { agente: { type: 'string', description: 'Su id o su nombre (SOFÍA…).' } }, requeridos: [] },
  { nombre: 'ver_equipo', categoria: 'agentes', descripcion: 'Los departamentos con su jefe, y las personas del equipo (cuentas con su rol y personas de Ajustes → Equipo) con sus tareas abiertas.', parametros: {}, requeridos: [] },
  { nombre: 'buscar_en_cerebro', categoria: 'cerebro', descripcion: 'Busca notas del Cerebro por nombre y texto. Devuelve los nombres con un fragmento; léelas con leer_nota.', parametros: { texto: { type: 'string', description: 'Palabras a buscar.' } }, requeridos: ['texto'] },
  { nombre: 'leer_nota', categoria: 'cerebro', descripcion: 'Lee una nota del Cerebro por su nombre exacto (hasta 3.500 letras; dice si hay más).', parametros: { nombre: { type: 'string', description: 'El nombre exacto de la nota.' } }, requeridos: ['nombre'] },
  { nombre: 'ver_contenido', categoria: 'contenido', descripcion: 'Las publicaciones de redes entre dos días (estado, redes, cuenta, texto) o el detalle de una pieza con su id. Dice cómo salió lo ya publicado.', parametros: { desde: { type: 'string', description: 'YYYY-MM-DD (hoy por defecto)' }, hasta: { type: 'string', description: 'YYYY-MM-DD (14 días después)' }, estado: { type: 'string', description: 'idea, borrador, revision, aprobada…' }, red: { type: 'string', description: 'instagram, facebook…' }, id: { type: 'string', description: 'El id de una pieza, para su detalle.' } }, requeridos: [] },
  { nombre: 'ver_anuncios', categoria: 'anuncios', descripcion: 'Las campañas de Meta: estado, gasto contra los topes, resultados y sugerencias. Con un id, el detalle de esa campaña, conjunto o anuncio.', parametros: { rango: { type: 'string', enum: ['hoy', '7d', '30d', 'mes'], description: '7d por defecto.' }, id: { type: 'string', description: 'Id de una campaña, conjunto o anuncio.' } }, requeridos: [] },
  { nombre: 'ver_analiticas', categoria: 'contenido', descripcion: 'Las cifras de Instagram y Facebook (alcance, seguidores, interacciones), lo que más movió y lo que menos, contra el periodo anterior.', parametros: { dias: { type: 'integer', description: 'De 1 a 90 (30 por defecto).' }, red: { type: 'string', description: 'todas, instagram o facebook.' } }, requeridos: [] },
  { nombre: 'buscar_en_galeria', categoria: 'estudio', descripcion: 'Busca imágenes, videos y audios de la galería del Estudio: el prompt, el modelo, la carpeta, quién lo pidió y para qué tarea.', parametros: { texto: { type: 'string', description: 'Palabras del prompt, la tarea o quien lo pidió.' }, carpeta: { type: 'string', description: 'Nombre de una carpeta.' }, tipo: { type: 'string', enum: ['image', 'video', 'audio'], description: 'Solo ese tipo.' }, limite: { type: 'integer', description: 'Máximo 20 (8 por defecto).' } }, requeridos: [] },
  { nombre: 'ver_rutinas', categoria: 'tareas', descripcion: 'Las rutinas (trabajo que se repite): cuándo corren, de quién son, si esperan el OK, si están pausadas y cómo le fue a la última.', parametros: { departamento: { type: 'string', description: 'Clave de un departamento.' } }, requeridos: [] },
  { nombre: 'ver_costos', categoria: 'costos', descripcion: 'Lo que ha gastado la oficina en IA este mes: por departamento, agente y modelo, contra el presupuesto, y lo que cuesta Dimitri.', parametros: {}, requeridos: [] },
  { nombre: 'ver_aprobaciones', categoria: 'tareas', descripcion: 'Lo que espera el OK del dueño ahora: qué es, de quién, desde cuándo y qué saldría.', parametros: {}, requeridos: [] },
  { nombre: 'ver_conectores', categoria: 'conectores', descripcion: 'Los conectores MCP (correo, calendario, repositorios…): a qué departamentos sirven y qué herramientas de LECTURA tienen.', parametros: {}, requeridos: [] },
  { nombre: 'ver_herramientas_conector', categoria: 'conectores', descripcion: 'Las herramientas de LECTURA de un conector con sus parámetros, para poder usarlas.', parametros: { conector: { type: 'string', description: 'El nombre del conector.' } }, requeridos: ['conector'] },
  { nombre: 'usar_conector', categoria: 'conectores', descripcion: 'Llama a una herramienta de LECTURA de un conector (buscar, ver, listar). Nunca envía, publica, paga ni cambia nada.', parametros: { conector: { type: 'string', description: 'El nombre del conector.' }, herramienta: { type: 'string', description: 'El nombre de la herramienta (de ver_herramientas_conector).' }, argumentos: { type: 'object', description: 'Los parámetros de esa herramienta.' } }, requeridos: ['conector', 'herramienta'] },
];

export const NOMBRES = HERRAMIENTAS.map((h) => h.nombre);

/** La definición como la pide la API ({ alias, descripcion, esquema }). */
export const definiciones = (cuales = NOMBRES) => HERRAMIENTAS.filter((h) => cuales.includes(h.nombre)).map((h) => ({ alias: h.nombre, descripcion: h.descripcion, esquema: { type: 'object', properties: h.parametros, ...(h.requeridos.length ? { required: h.requeridos } : {}) } }));

/** Una frase para el paso en vivo: «Buscando tareas de Avalon», como los pasos de BRIAN. */
export function tituloDePaso(nombre, e = {}) {
  const q = (v) => (v ? ` «${String(v).slice(0, 40)}»` : '');
  switch (nombre) {
    case 'buscar_en_guia': return `Buscando en la guía${q(e.consulta)}`;
    case 'buscar_tareas': return `Buscando tareas${q(e.texto || e.quien)}`;
    case 'ver_tarea': return 'Leyendo una tarea y su bitácora';
    case 'historial_reciente': return `Mirando quién hizo qué${e.quien ? ' · ' + String(e.quien).slice(0, 30) : ''}`;
    case 'ver_agente': return e.agente ? `Leyendo la ficha de ${String(e.agente).slice(0, 30)}` : 'Repasando a los agentes';
    case 'ver_equipo': return 'Mirando al equipo';
    case 'buscar_en_cerebro': return `Buscando en el Cerebro${q(e.texto)}`;
    case 'leer_nota': return `Leyendo la nota${q(e.nombre)}`;
    case 'ver_contenido': return e.id ? 'Leyendo una pieza de Contenido' : 'Mirando Contenido';
    case 'ver_anuncios': return e.id ? 'Leyendo una campaña' : 'Mirando los anuncios';
    case 'ver_analiticas': return 'Mirando las analíticas';
    case 'buscar_en_galeria': return `Buscando en la galería${q(e.texto || e.carpeta)}`;
    case 'ver_rutinas': return 'Mirando las rutinas';
    case 'ver_costos': return 'Mirando los costos';
    case 'ver_aprobaciones': return 'Mirando lo que espera tu OK';
    case 'ver_conectores': return 'Mirando los conectores';
    case 'ver_herramientas_conector': return `Mirando qué lee ${String(e.conector || 'el conector').slice(0, 30)}`;
    case 'usar_conector': return `Consultando ${String(e.conector || 'un conector').slice(0, 30)}${e.herramienta ? ' · ' + String(e.herramienta).slice(0, 40) : ''}`;
    default: return String(nombre);
  }
}

/* ---------- formato ---------- */
export const clip = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** «27 oct 14:05» con el reloj de la oficina (los getters locales: la nube los fija a su zona). */
export function cuando(ms, { hora = true } = {}) {
  const t = +ms; if (!Number.isFinite(t) || t <= 0) return '—';
  const d = new Date(t), z = (n) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MESES[d.getMonth()]}${hora ? ` ${z(d.getHours())}:${z(d.getMinutes())}` : ''}`;
}
/** Recorta el resultado de una consulta a lo que cabe, diciendo que hay más. */
export function acotar(texto, max = LIMITE_RESULTADO) { const s = String(texto ?? ''); return s.length <= max ? s : s.slice(0, max - 60).replace(/\s+\S*$/, '') + `\n… (hay más: afina la búsqueda)`; }

const ESTADOS = { idea: 'idea', scheduled: 'programada', next: 'en cola', doing: 'en curso', waiting: 'espera tu OK', done: 'hecha' };
/** El estado de una tarea en palabras (falló y bloqueada se ven aunque lo guardado sea otro). */
export function estadoDe(t, { bloqueada = false } = {}) {
  if (t.archived && t.state === 'done') return t.error ? 'falló (archivada)' : 'hecha (archivada)';
  if (t.state === 'done' && t.error) return t.stopped ? 'detenida' : 'falló';
  if (bloqueada || (Array.isArray(t.bloqueadaPor) && t.bloqueadaPor.length && t.state !== 'done')) return 'bloqueada (espera a otra)';
  if (t.person && t.state !== 'done') return `en manos de ${t.person}`;
  return ESTADOS[t.state] || String(t.state || '—');
}

/** Quién la tiene o la hizo, con su departamento. `name`: id de agente → nombre. */
export function quienDe(t, { name = (id) => id, depts = {} } = {}) {
  const d = depts[t.dept || t.department]?.name || t.dept || '';
  if (t.person) return `${t.person} (persona${t.deAgente ? `, antes ${name(t.deAgente)}` : ''})`;
  const pieza = t.team?.pieces?.length ? ` · equipo: ${[...new Set(t.team.pieces.map((p) => name(p.agent)).filter(Boolean))].slice(0, 5).join(', ')}` : '';
  return `${name(t.agent) || '—'}${d ? ` (${d})` : ''}${pieza}`;
}

/** Una línea por tarea para listas. */
export function lineaTarea(t, o = {}) {
  const hecha = t.state === 'done' ? ` · terminó ${cuando(t.doneAt)}${t.hechaPor ? ` · la marcó hecha ${t.hechaPor}` : ''}` : '';
  const lim = t.limite ? ` · límite ${String(t.limite).slice(0, 10)}` : '';
  return `- «${clip(t.title, 70)}» [id ${t.id}] · ${estadoDe(t, o)} · ${quienDe(t, o)}${t.prioridad === 'alta' ? ' · prioridad alta' : ''}${lim}${hecha}`;
}

/** La bitácora de una tarea (o del día) en palabras. `l`: una línea de tarea_bitacora. */
export function lineaBitacora(l, { name = (id) => id, titulos = null } = {}) {
  const por = l.por === 'oficina' ? 'la oficina' : l.por === 'dimitri' ? 'Dimitri' : (l.por ? (name(l.por) || l.por) : 'alguien');
  const donde = titulos ? ` «${clip(titulos.get(l.tarea) || l.tarea, 45)}»` : '';
  let que;
  switch (l.tipo) {
    case 'creada': que = `creó la tarea${donde}${l.origen ? ` (origen: ${l.origen})` : ''}`; break;
    case 'borrada': que = `quitó la tarea${donde}`; break;
    case 'estado': que = `pasó${donde} de «${l.de}» a «${l.a}»`; break;
    case 'campo': que = `cambió ${l.campo}${donde}: ${clip(l.antes, 40) || '—'} → ${clip(l.despues, 40) || '—'}`; break;
    case 'paso': que = `${l.accion || 'tocó'} el paso «${clip(l.texto, 50)}»${donde}`; break;
    case 'comentario': que = `comentó${donde}: «${clip(l.texto, 80)}»`; break;
    case 'nota': que = `anotó${donde}: «${clip(l.texto, 80)}»`; break;
    case 'resultado': que = `dejó el resultado${donde}`; break;
    default: que = `${l.tipo || 'cambió'}${donde}`;
  }
  return `- ${cuando(l.t)} · ${por === 'alguien' && l.autor ? l.autor : por} ${que}`;
}

/** El detalle de una tarea. `bitacora`: sus líneas, de la más vieja a la más nueva. */
export function fichaTarea(t, { name = (id) => id, depts = {}, bitacora = [], proyecto = null } = {}) {
  const out = [`«${t.title}» [id ${t.id}] — ${estadoDe(t)}`];
  out.push(`Quién: ${quienDe(t, { name, depts })}${t.by ? ` · pedida por ${t.by}` : ''}${t.delegada?.por ? ` · la delegó ${t.delegada.por}` : ''}`);
  out.push(`Cuándo: creada ${cuando(t.addedAt)}${t.dueAt ? ` · arranca ${cuando(t.dueAt)}` : ''}${t.limite ? ` · límite ${String(t.limite).slice(0, 10)}` : ''}${t.doneAt ? ` · terminó ${cuando(t.doneAt)}` : ''}${t.hechaPor ? ` · la marcó hecha ${t.hechaPor}` : ''}`);
  if (proyecto) out.push(`Proyecto: ${proyecto}`);
  if (t.text || t.instruction) out.push(`Pedido: ${clip(t.text || t.instruction, 500)}`);
  if (t.modelUsed || t.skills?.length) out.push(`Cómo se hizo: ${[t.modelUsed && `modelo ${t.modelUsed}`, t.skills?.length && `skills ${t.skills.slice(0, 5).join(', ')}`, t.revisions && `${t.revisions} devoluciones`].filter(Boolean).join(' · ')}`);
  if (Array.isArray(t.pasos) && t.pasos.length) out.push(`Pasos: ${t.pasos.slice(0, 12).map((p) => `${p.hecho ? '✓' : '○'} ${clip(p.texto, 60)}${p.hecho && p.por ? ` (${p.por})` : ''}`).join(' · ')}`);
  if (Array.isArray(t.comments) && t.comments.length) out.push(`Comentarios: ${t.comments.slice(-5).map((c) => `${c.by || 'alguien'}: «${clip(c.text, 90)}»`).join(' · ')}`);
  if (t.result) out.push(`Resultado: ${clip(t.result, 1200)}`);
  if (t.error && typeof t.error === 'string') out.push(`Falló: ${clip(t.error, 200)}`);
  if (bitacora.length) out.push(`Bitácora (${bitacora.length}):\n${bitacora.slice(-14).map((l) => lineaBitacora(l, { name })).join('\n')}`);
  return out.join('\n');
}

/** Una pieza de Contenido en una línea. */
export function lineaPieza(p) {
  const redes = (p.redes || []).join('+') || '—';
  return `- «${clip(p.titulo || p.texto, 60)}» [id ${p.id}] · ${p.estado || '—'} · ${p.fecha || 'sin día'}${p.hora ? ' ' + p.hora : ''} · ${p.formato || 'post'} en ${redes}${p.origen ? ` · origen: ${p.origen}` : ''}`;
}

/** Una imagen, video o audio de la galería en una línea. */
export function lineaMedio(it, { name = (id) => id } = {}) {
  const quien = it.by === 'dimitri' ? 'Dimitri' : it.agent ? name(it.agent) : it.by === 'upload' || it.upload ? 'subida a mano' : (it.by || 'el dueño');
  return `- ${it.file} · ${it.kind || 'imagen'} · ${it.model || (it.upload ? 'subida' : '—')} · ${cuando(it.t || it.at || it.created)} · ${quien}${it.task ? ` · tarea ${it.task}` : ''}${it.purpose ? ` · para: ${clip(it.purpose, 50)}` : ''}${it.folder ? ` · carpeta ${it.folder}` : ''} · «${clip(it.prompt, 90)}»`;
}
