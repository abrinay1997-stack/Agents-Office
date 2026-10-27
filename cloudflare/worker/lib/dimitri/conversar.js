// El chat de Dimitri en la nube: serve.mjs → subChatRun. El MISMO prompt y los MISMOS lectores de su respuesta (sub-core.mjs: systemPrompt, parsePlan, parseOps,
// dataInjection…); lo que cambia es de dónde salen los datos (D1 y los módulos portados) y que la respuesta llega entera (no hay streaming del texto: la página
// recibe `start` y al final `done`).
//
// DIMITRI NUNCA actúa por su cuenta: contesta, PROPONE (tareas, ops, creativos) y espera el clic del dueño. No manda correos, no publica, no paga, no aprueba.
// Desde el 27 oct 2026 CONSULTA: tiene herramientas de LECTURA (consultas.js: tareas y su bitácora, agentes, Contenido, anuncios, galería, Cerebro, costos, la guía de la oficina y los
// conectores MCP de lectura) y cada consulta se ve como un paso. El prompt va en dos partes (fija, con caché, y variable) y lleva la guía que toca y qué IA corre.
// Si lo que leyó (una imagen, una nota, un resultado de un correo) trae órdenes escondidas, se lo dice al dueño y esa respuesta no trae cambios (el escudo de safety.mjs).
import * as sub from '../../../../sub-core.mjs';
import * as estudioPlan from '../../../../estudio-plan.mjs';
import * as estudioLote from '../../../../estudio-lote.mjs';
import * as catalogo from '../../../../media/catalogo.mjs';
import * as safety from '../../../../safety.mjs';
import { validateVision } from '../../../../vision.mjs';
import { cargarTareas } from '../tareas/sesion.js';
import { leerContexto } from '../tareas/contexto.js';
import { leerCfg } from '../ajustes.js';
import { prepararEstudio } from '../estudio/entorno.js';
import * as galeria from '../estudio/galeria.js';
import * as chat from './chat.js';
import { preguntar, preguntarConHerramientas, resolverModelo, descripcionModelo } from './modelo.js';
import { crearConsultas } from './consultas.js';
import { guiaPara } from '../../../../guia-oficina.mjs';
import { listarFilas } from '../almacen.js';
import { estadoDelMes } from '../agentes/costos.js';
import { cargarBibliotecaNube } from '../biblioteca.js';
import { listarHabilidades } from '../../../../biblioteca-core.mjs';
import { contextoDeOps, oficinaDelDueno } from './ops.js';
import { yoDe } from '../tareas/servicios.js';
import { conLecturaUnica } from './lectura-unica.js';
import { notasDelChat, oficinaTexto, viendoTexto, resumenRapido } from './datos.js';
import { DEPTS_ESTUDIO } from '../agentes/herramientas.js';

export const MAX_TEXTO = 8000;
export const MAX_IMAGENES = 4;

/** Valida lo que manda la página en POST /api/sub/chat (serve.mjs). → { ok, texto, attach, imagenes, context, answers } | { error, estado } */
export function leerPeticion(b) {
  const text = String(b?.text || '').trim();
  const attach = Array.isArray(b?.attach) ? [...new Set(b.attach.filter((x) => typeof x === 'string'))] : [];
  if (attach.length > MAX_IMAGENES) return { error: 'como mucho 4 imágenes por mensaje', estado: 400 };
  { const odd = attach.find((id) => !/\.(png|jpe?g|webp|svg|mp4|webm|mp3|wav)$/i.test(id)); if (odd) return { error: `«${String(odd).split('/').pop()}» no se puede adjuntar: solo imágenes (PNG, JPG, WEBP), video (MP4, WEBM) o audio (MP3, WAV)`, estado: 400 }; }
  const vis = validateVision(b?.vision); if (vis.error) return { error: vis.error, estado: 400 };
  if (!text && !attach.length && !vis.images.length) return { error: 'mensaje vacío', estado: 400 };
  if (text.length > MAX_TEXTO) return { error: `el mensaje es muy largo (máx. ${MAX_TEXTO} caracteres)`, estado: 400 };
  const c = b?.context && typeof b.context === 'object' && typeof b.context.view === 'string' ? b.context : null;
  const context = c ? { view: c.view.slice(0, 20), label: String(c.label || '').slice(0, 160), kind: c.kind ? String(c.kind).slice(0, 20) : null, id: c.id ? String(c.id).slice(0, 300) : null, ...(c.rango ? { rango: String(c.rango).slice(0, 8) } : {}) } : null;
  const answers = b?.answers && typeof b.answers === 'object' && typeof b.answers.msg === 'string' && Array.isArray(b.answers.picks) ? { msg: b.answers.msg.slice(0, 40), picks: b.answers.picks.slice(0, 6) } : null;
  return { ok: true, texto: text || (attach.length ? 'Mira esto.' : 'Mira estas imágenes.'), attach, imagenes: vis.images, context, answers };
}

const estudioDeptos = (cfg, C) => (Array.isArray(cfg.media?.departments) && cfg.media.departments.length ? cfg.media.departments : DEPTS_ESTUDIO).map((k) => C.depts[k]?.name).filter(Boolean).join(', ');

/** Quién escribe (26 oct 2026): la cuenta de la sesión ({ nombre, rol }); por Telegram (`telegram:<id>`), la persona del equipo que tiene ese id; el reloj y lo demás, nadie en particular. → { nombre, rol, via } | null */
export function quienEs(usuario, C) {
  if (usuario?.nombre) return { nombre: String(usuario.nombre), rol: usuario.rol, via: '' };
  const tg = /^telegram:(\d{4,15})$/.exec(String(usuario?.email || ''))?.[1];
  if (!tg) return null;
  const p = (C?.personas || []).find((x) => x.telegram && String(x.telegram) === tg);
  return { nombre: p?.name || null, rol: p?.rol, via: 'Telegram' };
}

/** Un mensaje del dueño → la respuesta de Dimitri, guardada en el chat. → { messages: [u, m], answered? } */
export async function conversar({ env: env0, db: db0, usuario, modulos, req: p, signal = null, fetchFn = null, alPaso = null, sala: sala0 = null }) {
  const db = conLecturaUnica(db0), env = { ...env0, DB: db };
  const sala = sala0 || chat.sala(db, await chat.uidDe(db, usuario) || (() => { throw new Error('Esta cuenta no tiene conversación con Dimitri.'); })()); // la sala de ESTA cuenta (27 oct 2026): nadie lee la de otro // una consulta idéntica se hace una vez por turno (el límite de 50 de una invocación del plan gratuito)
  // Se leen MAX + HOLGURA: hasta HOLGURA mensajes más viejos que el chat siguen guardados SIN plegar en el resumen (chat.recortar espera a que sobren más de HOLGURA), y si no se
  // leyeran, lo que el dueño pidió recordar en ellos faltaría del prompt unos turnos (y volvería al plegarse). Se pliegan aquí, al vuelo, sin escribir nada.
  const todo = await sala.cargar({ limite: sub.MAX + chat.HOLGURA }), st = { messages: todo.messages.slice(-sub.MAX) }, fuera = todo.messages.slice(0, Math.max(0, todo.messages.length - sub.MAX));
  const hiloGuardado = await sala.hiloActual(), hilo0 = fuera.length ? sub.plegarHilo(hiloGuardado, fuera) : hiloGuardado, ultimoId = st.messages.at(-1)?.id || null, C2 = await leerContexto(db), cfg2 = await leerCfg(db), lista2 = await cargarTareas(db);
  const ctxFn = { env, db, cfg: cfg2, fetchFn, signal };
  const quien = quienEs(usuario, C2); // 26 oct 2026: Dimitri sabe quién le escribe (la cuenta; o la persona del equipo que escribe por Telegram)
  const office = oficinaDelDueno({ env, db, usuario, modulos });
  let { texto: text } = p; const { attach, imagenes, context, answers } = p;
  // las opciones que el dueño tocó: el mensaje dice lo que eligió (con las palabras del SERVIDOR; el texto de la página es solo su vista previa)
  let picked = null;
  if (answers?.msg) { const q = st.messages.find((x) => x.id === answers.msg); if (q?.plan?.questions?.length && !q.plan.answers) { picked = sub.answerText(q.plan.questions, answers.picks); if (picked.answers.length) { if (picked.text) text = picked.text; } else picked = null; } }
  const historia = st.messages.slice(-4).map((m) => m.text).join(' ');
  const estudioish = !!(attach.length || imagenes.length || context?.view === 'studio' || estudioLote.pideEstudio(text, { hayLotes: false }) || st.messages.slice(-2).some((m) => m.who === 'sub' && m.mode === 'estudio' && m.studio?.creatives?.some((c) => c.state === 'proposed' || c.state === 'sent')));
  const { notes, read } = await notasDelChat(db, { texto: text, historia, context, conCifras: estudioish, conVoz: estudioish });
  const studioBlock = estudioish ? await bloqueEstudio({ env, db, office, attach, text }) : '';
  const recent = sub.recentText(lista2, C2.agents), viewing = await viendoTexto({ c: context, db, office, C: C2, lista: lista2, yo: yoDe(usuario) });
  const rutDepts = (await import('../../../../routines-core.mjs')).ALLOWED.map((k) => `${C2.depts[k].name} (${k})`);
  const nombre = sub.nameOf(cfg2);
  const win = sub.historyWindow(st.messages, { name: nombre, depts: C2.depts }, 12); // las últimas vueltas, con tope; lo que no cabe entra resumido en <hilo>
  const equipoTxt = sub.equipoText({ people: C2.personas, yo: quien?.nombre ? { nombre: quien.nombre, rol: quien.rol } : null, tasks: lista2, via: quien?.via, depts: C2.depts });
  // 27 oct 2026: qué IA corre (y de dónde sale), la guía que toca, las skills y los métodos de la Biblioteca de cada jefe, y si este turno puede consultar
  const resuelto = await resolverModelo(ctxFn, { tipo: 'dimitri' });
  const conConsultas = cfg2.deputy?.consultas !== false && !!resuelto.modelo.caps?.herramientas && !resuelto.modelo.meta;
  const [skillsAll, lib] = await Promise.all([listarFilas(db, 'skills', { limite: 200 }).catch(() => []), cargarBibliotecaNube({ env, db, agentes: C2.agents }).catch(() => null)]);
  const skillsOf = (a) => skillsAll.filter((x) => x && x.text && (x.everyone || (x.agents || []).includes(a.id) || (x.departments || []).includes(a.department))).map((x) => x.name);
  const habilidadesOf = (a) => (lib && a.lead ? listarHabilidades(lib.b, a, '').map((h) => h.id) : []);
  const partes = sub.systemPromptParts({ name: nombre, business: cfg2.name || 'PanaClaw', depts: C2.depts, agents: C2.agents, skillsOf, habilidadesOf, routineDepts: rutDepts,
    status: sub.statusText(lista2, C2.agents, C2.depts), office: await oficinaTexto({ db, office, C: C2, lista: lista2, cfg: cfg2, yo: yoDe(usuario) }), recent, notes, studio: estudioDeptos(cfg2, C2), studioBlock, viewing, hilo: sub.hiloText(st.messages, hilo0, { depts: C2.depts, shown: win.shown }),
    equipo: equipoTxt, guia: guiaPara(text, { historia, vista: context?.view }), modelo: descripcionModelo(resuelto), herramientas: conConsultas });
  const system = partes;
  const convo = win.text;
  const userMsg = (convo ? convo + '\n' : '') + `${quien?.nombre || 'Dueño'}: ${text}${imagenes.length ? ` [adjuntó ${imagenes.length} ${imagenes.length === 1 ? 'imagen' : 'imágenes'}: las ves arriba${attach.length ? '; sus ids: ' + attach.join(', ') : ''}]` : attach.length ? ` [adjuntó: ${attach.join(', ')}]` : ''}\n${nombre} (solo JSON):`;
  const opts = { maxTokens: 6000, tipo: 'dimitri', imagenes: imagenes.length ? imagenes : null, resuelto };
  const consultas = conConsultas ? crearConsultas({ env, db, office, C: C2, lista: lista2, cfg: cfg2, fetchFn, signal }) : null;
  const r1 = consultas ? await preguntarConHerramientas(ctxFn, system, userMsg, { ...opts, herramientas: consultas.herramientas, ejecutar: consultas.ejecutar, alPaso }) : await preguntar(ctxFn, system, userMsg, opts);
  let out = r1.text; const pasos = r1.pasos || [], porConsulta = r1.inyeccion || null;
  db.olvidar(); // pasaron segundos: lo que se valide abajo (tareas, rutinas, piezas) se lee como está AHORA, no como estaba al empezar
  if (signal?.aborted) return detenido({ sala, text, attach, context, quien });
  let plan = sub.parsePlan(out, { depts: C2.depts, agents: C2.agents, personas: sub.nombresDe(C2.personas) });
  if (plan.bad) { // la respuesta llegó rota sin arreglo: una vez más, pidiendo menos (nunca el JSON crudo en el chat)
    out = await preguntar(ctxFn, system, userMsg + '\n(Tu respuesta anterior no era un JSON válido o se cortó. Devuelve SOLO el objeto JSON, más corto: un reply breve y como mucho 3 creativos.)', opts).then((r) => r.text, () => '');
    db.olvidar();
    if (signal?.aborted) return detenido({ sala, text, attach, context, quien });
    plan = sub.parsePlan(out, { depts: C2.depts, agents: C2.agents, personas: sub.nombresDe(C2.personas) });
  }
  // EL ESCUDO: una imagen, el resultado de una tarea (un correo, un webhook), lo que está abierto o una nota con órdenes escondidas marca el mensaje y la respuesta no trae cambios
  const shield = sub.dataInjection({ image: plan.image_text, recent, viewing, notes, equipo: equipoTxt }, safety.injectionIn) // los nombres de las cuentas los pone cada persona: también son datos
    || (porConsulta ? `lo que leí con ${porConsulta.tool} traía órdenes escondidas (${porConsulta.why})` : null);
  let studio = null;
  if (plan.mode === 'estudio') {
    const ctxE = await contextoEstudio({ env, db, office, creativos: plan.creatives });
    const creatives = estudioPlan.parseCreatives(plan.creatives, ctxE.parse);
    studio = { creatives, actions: shield ? [] : estudioPlan.parseActions(plan.actions, { galleryHas: ctxE.parse.galleryHas }), estimate: estudioPlan.estimatePlan(creatives, { estimate: catalogo.estimate, budget: ctxE.budget, models: ctxE.parse.models }) };
    if (plan.lote) { plan.questions = [...plan.questions, ...[]].slice(0, sub.MAX_QUESTIONS); plan.loteNoEsta = true; } // los lotes de fotos siguen en la oficina de la computadora (fase 8b)
  }
  const ctxO = plan.ops.length && !shield ? await contextoDeOps({ office, C: C2, db, ops: plan.ops, usuario }) : null;
  const parsedOps = ctxO ? sub.parseOps(plan.ops, ctxO) : { ops: [], motivos: [] };
  const ops = parsedOps.ops, opsFuera = sub.motivosText(parsedOps.motivos); // lo que no se pudo leer se dice, nunca se tira en silencio
  const u = sub.message('user', text, { ...(quien?.nombre ? { por: quien.nombre } : {}), ...(attach.length ? { attach } : {}), ...(context?.view ? { context: { view: context.view, label: context.label || '' } } : {}), ...(picked ? { answers: { msg: answers.msg, picks: picked.answers } } : {}) });
  const fallback = plan.bad ? 'Se me cortó la respuesta y no la pude leer. ¿La repito más corta?' : studio ? (studio.creatives.length ? 'Te propongo esto. Nada se genera hasta que pulses GENERAR.' : studio.actions.length ? 'Esto puedo hacer; pulsa HACER si te parece.' : plan.loteNoEsta ? 'Los lotes de fotos todavía no están en la nube: siguen en la oficina de tu computadora.' : 'No encontré cómo hacerlo con los modelos encendidos.') : plan.tasks.length || ops.length ? 'Así lo haría:' : plan.questions.length ? 'Antes de seguir, dime:' : '¿Me das un poco más de detalle?';
  const reply = (plan.reply || fallback) + (opsFuera ? '\n\n' + opsFuera : '') + (plan.loteNoEsta ? '\n\n_(Los lotes de fotos todavía no están en la nube: siguen en la oficina de tu computadora.)_' : '') + (plan.cut ? '\n\n_(La respuesta me llegó cortada: puede faltar algo. Si ves algo incompleto, pídemelo de nuevo.)_' : '') + (shield ? `\n\n🛡 ${shield[0].toUpperCase() + shield.slice(1)}: no las sigo, y esta respuesta no trae cambios para hacer.` : '');
  const m = sub.message('sub', reply, { mode: plan.mode, ia: resuelto.nombre, ...(quien?.nombre ? { para: quien.nombre } : {}), ...(pasos.length ? { pasos } : {}), ...(read.length ? { read } : {}), ...(plan.tasks.length || plan.questions.length ? { plan: { tasks: plan.tasks, questions: plan.questions, ...(plan.proyecto ? { proyecto: plan.proyecto } : {}) } } : {}), ...(studio ? { studio } : {}), ...(ops.length ? { ops } : {}), ...(shield ? { shield } : {}), ...(plan.bad ? { retry: true } : {}), ...(plan.cut ? { cut: true } : {}) });
  // si mientras pensaba el dueño abrió otra conversación o empezó una nueva, esta respuesta es de otra charla: no se mete en la que está viendo
  if (ultimoId && !(await sala.mensaje(ultimoId))) throw new Error('Cambiaste de conversación mientras yo pensaba, así que no guardé esa respuesta. Vuelve a enviar tu mensaje donde quieras seguir.');
  if (picked) { const q = await sala.mensaje(answers.msg); if (q?.plan) { q.plan.answers = picked.answers; await sala.reemplazar(q); } }
  await sala.anexar(u, m);
  return { messages: [u, m], ...(picked ? { answered: { msg: answers.msg, answers: picked.answers } } : {}) };
}

/** Qué IA corre Dimitri (para su cabecera y para GET /api/sub): { id, nombre, de, herramientas, consultas, gasto }. `gasto`: lo que lleva gastado la oficina en IA este mes frente a su tope (la pastilla de su cabecera). */
export async function infoModelo({ env, db }) {
  const cfg = await leerCfg(db), r = await resolverModelo({ env, db, cfg }, { tipo: 'dimitri' });
  const e = await estadoDelMes(db, cfg.costs).catch(() => null);
  return { id: r.modelo.id, nombre: r.nombre, de: r.modelo.de || '', herramientas: !!r.modelo.caps?.herramientas && !r.modelo.meta, consultas: cfg.deputy?.consultas !== false && !!r.modelo.caps?.herramientas && !r.modelo.meta,
    ...(e ? { gasto: { usd: Math.round((+e.spent || 0) * 100) / 100, tope: +e.budget > 0 ? +e.budget : null, nivel: e.level || 'none' } } : {}) };
}

/** «Detener»: el mensaje queda «Detenido por ti» y nada de lo que propuso se guarda. */
async function detenido({ sala, text, attach, context, quien = null }) {
  const u = sub.message('user', text, { ...(quien?.nombre ? { por: quien.nombre } : {}), ...(attach.length ? { attach } : {}), ...(context?.view ? { context: { view: context.view, label: context.label || '' } } : {}) });
  const m = sub.message('sub', '_Detenido por ti._', { mode: 'charla', stopped: true });
  await sala.anexar(u, m);
  return { messages: [u, m], stopped: true };
}

/** «¿Cómo vamos?» al instante, sin modelo, y «Analizar con Dimitri» después (POST /api/sub/estado). */
export async function estadoRapido({ env, db, usuario, modulos, texto, sala }) {
  const [C, cfg, lista] = [await leerContexto(db), await leerCfg(db), await cargarTareas(db)];
  const office = oficinaDelDueno({ env, db, usuario, modulos });
  const u = sub.message('user', String(texto || '¿Cómo vamos?').trim().slice(0, 200) || '¿Cómo vamos?');
  const m = sub.message('sub', await resumenRapido({ db, office, C, lista, cfg }), { mode: 'estado', quick: true });
  await sala.anexar(u, m);
  return { messages: [u, m] };
}

/* ---------- el Estudio visto por Dimitri (modo «estudio») ---------- */
async function bloqueEstudio({ env, db, office, attach, text }) {
  try {
    await prepararEstudio(env, db);
    const m = await office('/api/media/models');
    const fl = (await office('/api/media?n=1')).folders || [];
    const items = [];
    for (const id of attach) { const it = await galeria.item(db, id); items.push({ id, prompt: it?.prompt, folder: it?.folder ? fl.find((f) => f.id === it.folder)?.name : null }); }
    return estudioPlan.studioPromptBlock({ models: m.models || [], budget: m.budget, folders: fl, attach: items, approved: [], voices: Array.isArray(m.voices?.voices) ? m.voices.voices.map((v) => ({ voiceId: v.voiceId, name: v.name, kind: v.kind === 'design' ? 'design' : 'clone', at: v.at })).concat((m.voices?.system || []).map((v) => ({ voiceId: v.voiceId, name: v.name, kind: 'system' }))) : [], ask: text, defaults: (k) => catalogo.defaultModel(k) });
  } catch (e) { return `El Estudio no se pudo leer (${String(e?.message || e).slice(0, 100)}): dilo y no propongas creativos.`; }
}
async function contextoEstudio({ env, db, office, creativos }) {
  await prepararEstudio(env, db);
  const m = await office('/api/media/models'), fl = (await office('/api/media?n=1')).folders || [];
  const ids = (creativos || []).flatMap((c) => Object.values(c?.media || {}).flat()).filter((x) => typeof x === 'string');
  const hay = await galeria.cuales(db, ids);
  const galleryHas = (id) => hay.has(galeria.validoId(id) || '');
  const budget = m.budget || { maxPerRequest: 8 };
  return { budget, parse: { models: m.models || [], folders: fl, galleryHas, maxPerRequest: budget.maxPerRequest || 8, defaultModel: (k) => catalogo.defaultModel(k), estimate: catalogo.estimate, voices: null } };
}

/** GENERAR: el clic del dueño. Es la ÚNICA ruta por la que Dimitri gasta, y solo si un administrador la llama (el Estudio vuelve a exigir lo mismo). Los topes del Estudio mandan. */
export async function generar({ env, db, usuario, modulos, msgId, items, actions, sala }) {
  const m = await sala.mensaje(msgId);
  if (!m || !m.studio) return { error: 'esa propuesta ya no existe' };
  const office = oficinaDelDueno({ env, db, usuario, modulos });
  const ctxE = await contextoEstudio({ env, db, office, creativos: [] });
  const byI = new Map((Array.isArray(items) ? items : []).filter((e) => e && Number.isInteger(e.i)).map((e) => [e.i, e]));
  const fl = (await office('/api/media?n=1')).folders || [];
  const carpetaId = async (name) => { if (!name) return undefined; const f = fl.find((x) => x.name.toLowerCase() === String(name).toLowerCase()); if (f) return f.id; const n = await office('/api/media/folders', { name }); return n.folder?.id || n.id; };
  let sent = 0, failed = 0, usd = 0, done = 0;
  for (const c of m.studio.creatives || []) {
    if (c.state !== 'proposed') continue;
    const e = byI.get(c.i); if (!e) continue; // solo lo que la página listó: un creativo que quedó fuera sigue esperando
    if (e.include === false) { c.state = 'skipped'; continue; }
    const ed = { ...c, ...(typeof e.prompt === 'string' && e.prompt.trim() ? { prompt: e.prompt } : {}), ...(e.n != null ? { n: e.n } : {}), ...(typeof e.model === 'string' && e.model ? { model: e.model } : {}), settings: { ...c.settings, ...(e.settings && typeof e.settings === 'object' ? e.settings : {}) }, ...(typeof e.folder === 'string' ? { folder: e.folder } : {}) };
    const hay = await galeria.cuales(db, Object.values(ed.media || {}).flat());
    const [v] = estudioPlan.parseCreatives([ed], { ...ctxE.parse, galleryHas: (id) => hay.has(galeria.validoId(id) || '') }); // lo que el dueño cambió en la tarjeta se comprueba otra vez, como la primera
    Object.assign(c, { prompt: v.prompt, n: v.n, model: v.model, modelName: v.modelName, kind: v.kind, settings: v.settings, media: v.media, folder: v.folder, cost: v.cost });
    if (v.state !== 'proposed') { c.state = 'skipped'; c.error = v.error; failed++; continue; }
    try {
      const r = await office('/api/media/jobs', { model: c.model, kind: c.kind, prompt: c.prompt, n: c.n, settings: c.settings, media: Object.fromEntries(Object.entries(c.media).filter(([, l]) => l.length)), folder: await carpetaId(c.folder) });
      Object.assign(c, { state: 'sent', jobId: r.job.id }); delete c.error; sent++; usd += +c.cost || 0;
    } catch (err) { c.state = 'failed'; c.error = String(err.message || err).slice(0, 300); failed++; }
  }
  const incl = Array.isArray(actions) ? new Map(actions.filter((a) => a && Number.isInteger(a.k)).map((a) => [a.k, a.include !== false])) : null;
  if (!m.shield) for (const a of m.studio.actions || []) { // ordenar la galería va con el mismo clic
    if (a.state !== 'proposed') continue;
    if (estudioLote.ACCIONES_LOTE.includes(a.type)) { a.state = 'failed'; a.error = 'los lotes de fotos todavía no están en la nube'; continue; }
    const on = incl ? incl.get(a.k) : true;
    if (on === false) { if (incl && incl.has(a.k)) a.state = 'skipped'; continue; }
    if (on === undefined) continue;
    try { await accionEstudio({ office, a, fl }); a.state = 'done'; done++; } catch (err) { a.state = 'failed'; a.error = String(err.message || err).slice(0, 300); }
  }
  await sala.reemplazar(m);
  const aviso = (sent || failed || done) ? sub.message('sub', [sent || failed ? `${sent ? `Mandé ${sent} ${sent === 1 ? 'creativo' : 'creativos'} al Estudio (aprox. US$${usd.toFixed(2)}). Te aviso aquí cuando estén.` : 'No mandé nada al Estudio.'}${failed ? ` ${failed} no se pudo: lo dice en su tarjeta.` : ''}` : '', done ? `Ordené ${done} ${done === 1 ? 'cosa' : 'cosas'} en la galería.` : ''].filter(Boolean).join(' ')) : null;
  if (aviso) await sala.anexar(aviso);
  return { ok: true, message: m, messages: aviso ? [aviso] : [] };
}
async function accionEstudio({ office, a, fl }) { // las 4 acciones cerradas del contrato (estudio-plan.parseActions ya tiró el resto)
  const hallar = (n) => fl.find((f) => f.name.toLowerCase() === String(n).toLowerCase());
  if (a.type === 'carpeta_crear') { if (!hallar(a.name)) await office('/api/media/folders', { name: a.name }); return; }
  if (a.type === 'carpeta_renombrar') { const f = hallar(a.from); if (!f) throw new Error(`no hay una carpeta «${a.from}»`); await office(`/api/media/folders/${f.id}`, { name: a.to }, 'PATCH'); return; }
  if (a.type === 'mover') { const f = hallar(a.folder) || (await office('/api/media/folders', { name: a.folder })).folder; await office('/api/media/move', { files: a.files, folder: f.id }); return; }
  if (a.type === 'enviar_contenido') { // una IDEA en Contenido, nunca aprobada: el dueño decide allí
    const titulo = String(a.titulo || a.creative?.title || 'Idea de Dimitri').replace(/\s+/g, ' ').slice(0, 80), formato = a.formato || (/\.(mp4|webm)$/i.test(a.file) ? 'reel' : 'post');
    await office('/api/contenido/piezas', { titulo, texto: a.texto || '', medios: [a.file], estado: a.fecha ? 'borrador' : 'idea', origen: 'dimitri', formato, ...(a.fecha ? { fecha: a.fecha } : {}), ...(a.hora ? { hora: a.hora } : {}), ...(a.redes?.length ? { redes: a.redes } : {}) });
    return;
  }
  throw new Error('acción desconocida');
}

/** Cada minuto: los creativos que Dimitri mandó y ya terminaron dicen «Listos: …» en su chat (serve.mjs → subJobDone). Una vez por trabajo. */
export async function trabajosTerminados({ env, db, usuario, modulos, sala }) {
  const { messages } = await sala.cargar({ limite: 40 });
  const office = oficinaDelDueno({ env, db, usuario, modulos });
  let n = 0;
  for (const m of messages) {
    for (const c of m.studio?.creatives || []) {
      if (c.state !== 'sent' || !c.jobId || c.doneAt) continue;
      let j; try { j = (await office(`/api/media/jobs/${encodeURIComponent(c.jobId)}`)).job; } catch { continue; }
      if (!j || (j.state !== 'done' && j.state !== 'failed')) continue;
      Object.assign(c, { state: j.state === 'done' ? 'done' : 'failed', files: j.items || [], doneAt: Date.now() });
      if (j.error) c.error = j.error; if (j.warning) c.warning = j.warning;
      const k = c.files.length, que = estudioPlan.unitWord(c.kind, k);
      await sala.reemplazar(m);
      await sala.anexar(c.state === 'done' ? sub.message('sub', `Listos: «${c.title}» (${k} ${que}${c.folder ? `, en la carpeta «${c.folder}»` : ''}).${j.warning ? ' ' + j.warning : ''}`, { media: c.files, ref: { msg: m.id, i: c.i } }) : sub.message('sub', `No salió «${c.title}»: ${j.error || 'el motor no devolvió nada'}`, { ref: { msg: m.id, i: c.i } }));
      n++;
    }
  }
  return n;
}
