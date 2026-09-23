// Agents Office V3 — the work layer.
// V3.3 (AJ, 6 Sep 2026): a PERMANENT Task Status panel on the right — a one-line command bar
// (department dropdown + input, the office names the agent as you type) over a live feed of
// every task, newest change first, with status chips as filters. The flying tickets are gone:
// new work and handoffs simply appear in the feed (and a 📋 pops over the desk). Each status
// carries its own honest meta — backlog: how long it has waited · in progress: a real progress
// bar · waiting: minutes waiting for AJ's tick · done: the time it finished. Company-wide
// Kanban still lives on B. DOING / NEXT / DONE rows stay on every pod card.
// Session-only theatre — nothing persists (AJ's call: gauge interest first).
// V3.5 (AJ, 9 Sep 2026): ROUTINES — tasks on the office's own clock, Emails / Accounting / Sales
// only this release. Set one in the bar ("every weekday at 8am, …" or the REPEAT picker), by
// telling an agent in chat, or in <brain>/Agents Office/routines.json. Live: the server keeps the
// clock, fires and runs them page or no page; this page polls and shows the card move
// SCHEDULED → BACKLOG → IN PROGRESS → (WAITING ON APPROVAL) → DONE. A draft that needs the owner's
// OK makes the agent stand and wave; APPROVE sends it, REJECT + a note reworks it. Demo (file://):
// session-only routines fired by this tick.
// V3.2 (16 Sep 2026): AGENT TEAMS — TEAM in the bar (or "as a team" in the sentence) sends the task
// to the department lead, who splits it into pieces; the pieces appear as cards on the teammates'
// desks (↳), all IN PROGRESS at once, each teammate's finished piece lands in their own chat and
// walks back to the lead (📋), notes they leave each other pop as 💬, and the lead's card finishes
// with the combined deliverable. Live: the server does it (serve.mjs runTeam, one Claude process per
// desk); this page reads `task.team` off /api/tasks. Demo: the same theatre on a timer.
import { DEPTS, AGENTS, DEPT_KEYS } from './data.js';
import { P, rnd, ri } from './v1data.js';
import { applyTasks, PROFILE, titleCase } from './profile.js';
import { parseWhen, describe, nextRun, fromPicker, untilText } from './when.js';
import { initCalendar } from './calendar.js'; // V3.2.1 (16 Sep 2026): the calendar on P
import { MODEL_KEYS, MODELS, DEFAULT_MODEL, modelName, normModel, FROM_TEXT , EFFORT_KEYS, EFFORT_NAME, normEffort, effortName, effortFor } from './models.js';

const SEGMENTS = ['roofing', 'HVAC', 'dental', 'logistics', 'fitness', 'property', 'landscaping', 'legal'];

// generic-business task pool per agent (AJ: generic business, not TerriTool-flavoured)
const POOL = {
  elead: ['Revisar la bandeja nocturna, derivar 40 correos', 'Revisar el tono de 6 respuestas a clientes', 'Resumen semanal de la bandeja para AJ', 'Actualizar las plantillas de respuesta', 'Escalar 2 hilos a AJ'],
  cmail: ['Responder la pregunta de alcance de {co}', 'Enviar el resumen de arranque a {co}', 'Responder 9 correos de clientes de la noche', 'Redactar el aviso de aumento de precios', 'Pedir a {co} la aprobación del brief'],
  imail: ['Clasificar 14 correos internos', 'Circular los números semanales', 'Responder al equipo sobre el plan Q3', 'Resumir el hilo de 40 mensajes', 'Agendar la revisión con el cliente en el calendario'],
  vmail: ['Resumir la revisión del SLA del proveedor', 'Responder al proveedor de SMS sobre el nivel del plan', 'Pedir una cotización al proveedor de impresión', 'Pedir al proveedor de hosting el reporte de la caída', 'Confirmar la fecha de renovación del proveedor'],
  kmail: ['Responder la consulta de factura del diseñador', 'Enviar el brief al redactor', 'Confirmar las horas semanales del contratista', 'Pedir al desarrollador la estimación', 'Responder al contratista de video sobre la fecha límite'],
  lexi:  ['Revisar el enriquecimiento nocturno antes de que lo vean los reps', 'Armar las listas de llamadas de hoy', 'Dar seguimiento a {n} negocios quietos hace 14 días', 'Preparar la revisión semanal del pipeline', 'Ajustar el ICP con Prospector'],
  enzo:  ['Enriquecer {n} registros nocturnos', 'Verificar móviles del lote AU', 'Completar tamaño de empresa en 12 leads', 'Calificar el lote matutino para el líder de ventas', 'Repetir 3 enriquecimientos fallidos'],
  ilm:   ['Calificar {n} leads entrantes del sitio web', 'Derivar 6 leads calientes a los reps', 'Responder a {co} en menos de una hora', 'Agendar una llamada de descubrimiento con {co}', 'Limpiar la cola entrante, 12 duplicados'],
  pros:  ['Buscar {n} empresas de {segment} para outbound', 'Calificar 40 prospectos contra el ICP', 'Armar la lista de llamadas en frío de mañana', 'Comparar hallazgos nuevos con clientes actuales', 'Verificar móviles del lote nuevo'],
  piper: ['Propuesta para el prospecto de 40 puestos', 'Actualizar la plantilla de propuesta del plan Growth', 'Opciones de precios para {co}', 'Paquete de seguimiento de propuesta para {co}', 'Enlace de firma en línea para la propuesta de {co}'],
  folo:  ['Dar seguimiento a {n} cotizaciones de la semana pasada', 'Retomar 8 leads fríos', 'Registrar resultados de llamadas en el CRM', 'Enviar el recordatorio de 14 días a negocios quietos', 'Agendar una demo para {co}'],
  mlead: ['Revisar el contenido semanal antes de publicarlo', 'Mover $50/día al anuncio ganador', 'Definir la parrilla de reels de la próxima semana', 'Resumen semanal de marketing para AJ', 'Pedir a Research el ángulo de {segment}'],
  riley: ['Monitoreo matutino: 49 fuentes', 'Monitoreo semanal de precios de la competencia', 'Conseguir 3 datos para el newsletter', 'Brief de tendencias para el líder de ventas', 'Leer 6 reseñas de compradores para ángulos'],
  newt:  ['Redactar el newsletter de septiembre', 'Asuntos A/B para la edición 32', 'Registrar los números de la edición 31', 'Rehacer la secuencia de bienvenida, correo 2', 'Limpiar 40 suscriptores rebotados'],
  gfx:   ['Set de tarjetas de cita para la página de precios', 'Exports de historia + cuadrado, kit de marca', 'Miniatura para el reel de "la regla de las 10am"', 'Portada de carrusel, 3 opciones', 'Redimensionar la creatividad del anuncio a 4:5'],
  ada:   ['Refrescar el set de anuncios fatigado', 'Lanzar 4 variantes de "ansiedad de llamadas en frío"', 'Sacar el reporte diario de gasto', 'Mover $50/día al ganador', 'Excluir clientes actuales de la segmentación'],
  iggy:  ['Escribir el gancho del carrusel', 'Registrar el rendimiento de ganchos en el playbook', 'Programar 3 publicaciones de la semana', 'Responder 14 mensajes directos', 'Recortar el texto del reel de "la regla de las 10am"'],
  vid:   ['Renderizar el reel de "la regla de las 10am", con subtítulos', 'Cortar un teaser de 15 s de la demo', 'Re-renderizar variantes de anuncios en 4:5', 'Pasada de subtítulos al clip del webinar', 'Color + subtítulos al reel del fundador', 'Renderizar el corte demo de 45 s'],
  olead: ['Revisar los contratos y alertas de la semana', 'Dar seguimiento a {n} renovaciones abiertas de proveedores', 'Priorizar los hallazgos de Intel', 'Resumen semanal de operaciones para AJ', 'Preparar las secciones del board pack'],
  scout: ['Comparar la página de precios de la competencia', 'Revisar reseñas G2 de los 3 rivales principales', 'Memo de oportunidad: alza de precios del rival', 'Actualizar el mapa de mercado, Q3', 'Vigilar la página de lanzamiento del rival'],
  legal: ['Revisar el MSA modificado, 2 cláusulas', 'Contrato del diseñador como contratista', 'Revisión anual de la política de privacidad', 'Marcar en rojo los términos de {co}', 'Revisar la cláusula de precio fijo'],
  comply:['La página de regulación AU cambió, comparando', 'Auditoría de textos de consentimiento en los formularios', 'Revisión de retención de datos, 3 sistemas', 'Checklist trimestral de compliance', 'Revisión del banner de cookies'],
  report:['Board pack semanal, 6 secciones', 'Consolidado mensual de KPIs', 'Reporte de cohortes de churn para el Brain', 'Reporte de SLA de entregas', 'Resumen de actividad de los reps'],
  dash:  ['Actualizar el dashboard de ventas', 'Agregar el tile de entregas a tiempo', 'Corregir el gráfico de ingresos, período equivocado', 'Crear la vista de tiempos de respuesta de la bandeja', 'Chequeo semanal del dashboard'],
  alead: ['Revisar la posición de caja de la semana', 'Aprobar el pago a contratistas', 'Preparar el paquete de cierre de mes', 'Revisión de tarifas de proveedores', 'Pronóstico de caja, próximas 8 semanas'],
  invo:  ['Emitir {n} facturas de la semana', 'Cobrar 3 facturas vencidas', 'Nota de crédito para {co}', 'Facturar a {co} $840', 'Recordatorio 2 de 3 a {co}'],
  apay:  ['Conciliar los cargos de tarjeta de hoy', 'Auditar la factura #218 del contratista vs contrato', 'Programar los pagos a contratistas', 'Marcar una suscripción duplicada', 'Revisar el nivel del plan del proveedor de SMS'],
  recon: ['Conciliar 14 pagos, 2 marcados', 'Conciliación bancaria de fin de mes', 'Cruzar pagos de Stripe con facturas', 'Aclarar 2 cargos sin conciliar', 'Cuadrar el estado de cuenta de la tarjeta'],
  dlead: ['Revisar 12 proyectos activos por riesgo', 'Resumen semanal de entregas para AJ', 'Replanificar el cronograma de {co}', 'Aprobar la entrega de {co}', 'Asignar personal al proyecto de {co}'],
  pco:   ['Actualizar el plan del proyecto de {co}', 'Mover 3 hitos tras el cambio de alcance', 'Pedir 2 aprobaciones vencidas del cliente', 'Agendar la revisión de {co}', 'Registrar las horas semanales por proyecto'],
  qa:    ['QA a la entrega del sitio de {co}', 'Revisar el paquete de reportes de {co} por errores', 'Probar el login del portal del cliente', 'Corregir el set de assets, reglas de marca', 'Pasada de regresión al formulario de reservas'],
  crep:  ['Reporte de estado de septiembre para {co}', 'Paquete mensual de reportes, 14 clientes', 'Agregar la sección de resultados al reporte de {co}', 'Enviar el reporte de {co}, 2 alertas', 'Graficar los números de leads de {co}'],
  cass:  ['Sincronizar los assets de {co} al portal', 'Organizar la biblioteca de assets de {co}', 'Exportar el set de logos, 4 formatos', 'Archivar los archivos terminados de {co}', 'Etiquetar 60 assets por campaña'],
  dasst: ['Borrador de plantillas sociales de {co}', 'Redimensionar los banners de {co}, 6 tamaños', 'Maquetar la landing page de {co}', 'Preparar la hoja de marca de {co}', 'Diseñar la portada del reporte de {co}'],
  ona:   ['Preparar la llamada de arranque de {co}', 'Checklist de onboarding para {co}', 'Configurar el portal del cliente de {co}', 'Acompañar a {co} en su primer reporte', 'Check-in día 7 con {co}'],
};

// keywords that route a typed task to the right agent inside the chosen department
const KEYS = {
  elead: ['summary', 'template', 'escalate', 'inbox'], cmail: ['client', 'customer', 'reply', 'scope', 'kickoff'],
  imail: ['team', 'internal', 'staff', 'calendar', 'thread'], vmail: ['vendor', 'supplier', 'sla', 'renewal', 'quote'],
  kmail: ['contractor', 'freelance', 'designer', 'developer', 'copywriter'],
  lexi: ['pipeline', 'call list', 'rep', 'review', 'deal'], enzo: ['enrich', 'signup', 'verify', 'data'],
  ilm: ['inbound', 'qualify', 'route', 'website lead', 'discovery'], pros: ['prospect', 'list', 'mine', 'find', 'companies', 'icp'],
  piper: ['proposal', 'pricing', 'seat', 'quote'], folo: ['follow', 'chase', 'nudge', 'demo'],
  mlead: ['content plan', 'calendar', 'budget', 'marketing summary', 'line-up'], riley: ['research', 'scan', 'trend', 'stat', 'source'], newt: ['newsletter', 'issue', 'subscriber', 'welcome'],
  gfx: ['design', 'graphic', 'thumbnail', 'image', 'creative', 'banner', 'card', 'cover'], ada: ['ad', 'ads', 'meta', 'campaign', 'spend', 'budget', 'variant'],
  iggy: ['instagram', 'post', 'hook', 'dm', 'story', 'carousel', 'schedule'], vid: ['video', 'reel', 'cut', 'render', 'edit', 'caption', 'clip', 'footage', 'teaser'],
  olead: ['renewal', 'escalate', 'board pack', 'operations summary', 'checklist'], scout: ['intel', 'competitor', 'rival', 'market', 'memo'], legal: ['contract', 'msa', 'terms', 'legal', 'clause', 'agreement'],
  comply: ['compliance', 'regulation', 'consent', 'privacy', 'retention', 'cookie'], report: ['report', 'kpi', 'board pack', 'roll-up', 'summary'],
  dash: ['dashboard', 'chart', 'tile', 'metric', 'view'],
  alead: ['cash', 'vendor', 'forecast', 'month-end', 'approve'], invo: ['invoice', 'overdue', 'credit note'],
  apay: ['bill', 'pay', 'payable', 'charge', 'contractor', 'subscription'], recon: ['reconcile', 'bank', 'stripe', 'match', 'statement'],
  dlead: ['risk', 'timeline', 'handover', 'staff', 'summary'], pco: ['plan', 'milestone', 'schedule', 'sign-off', 'hours'],
  qa: ['qa', 'test', 'check', 'proof', 'bug', 'regression'], crep: ['report', 'status', 'results', 'monthly'],
  cass: ['asset', 'file', 'portal', 'library', 'export', 'logo'], dasst: ['design', 'mock', 'template', 'banner', 'brand sheet', 'resize'],
  ona: ['onboard', 'kickoff', 'checklist', 'welcome'],
};

// handoff chains — one piece of work passing desk to desk (the multi-agent story)
const CHAINS = [
  [['mlead', 'Definir la parrilla de reels de la próxima semana'], ['riley', 'Investigar ángulos para la parrilla'], ['iggy', 'Escribir los ganchos de la parrilla']],
  [['legal', 'Revisar el MSA modificado de {co}'], ['olead', 'Decidir sobre la cláusula de {co}, escalar si hace falta']],
  [['riley', 'Investigar ángulos de gancho para el próximo reel'], ['iggy', 'Escribir el guion del reel desde la investigación'], ['vid', 'Cortar y renderizar el reel, con subtítulos']],
  [['gfx', 'Creatividad para el nuevo set de anuncios de {segment}'], ['ada', 'Lanzar el set de anuncios de {segment}, 4 variantes']],
  [['pros', 'Armar una lista de prospectos de {segment}'], ['ilm', 'Calificar la lista de {segment}, derivar los calientes'], ['lexi', 'Revisar los leads derivados con los reps']],
  [['enzo', 'Enriquecer los registros nocturnos'], ['ilm', 'Derivar el lote enriquecido a los reps']],
  [['ilm', 'Lead calificado: {co} quiere una cotización'], ['piper', 'Propuesta para {co}'], ['legal', 'Revisar los términos de {co}']],
  [['piper', 'Propuesta aceptada por {co}'], ['ona', 'Onboarding de {co}: llamada de arranque'], ['pco', 'Armar el plan del proyecto de {co}']],
  [['cmail', 'Solicitud de cambio de alcance de {co}'], ['pco', 'Replanificar los hitos de {co}'], ['crep', 'Actualizar el reporte de estado de {co}']],
  [['dasst', 'Borrador del set de assets de {co}'], ['qa', 'QA al set de assets de {co}'], ['cass', 'Publicar los assets de {co} en el portal']],
  [['scout', 'Cambio de precios del rival detectado, memo'], ['piper', 'Actualizar la tabla de precios de la propuesta']],
  [['invo', 'Emitir las facturas de esta semana'], ['recon', 'Cruzar los pagos con las facturas nuevas']],
  [['report', 'Consolidado mensual de KPIs'], ['dash', 'Actualizar el dashboard de KPIs'], ['alead', 'Sumar los KPIs al paquete de cierre de mes']],
  [['vmail', 'Cotización de proveedor recibida para {co}'], ['apay', 'Revisar la cotización del proveedor contra el presupuesto']],
  [['kmail', 'Consulta de factura del diseñador como contratista'], ['apay', 'Auditar la factura del contratista vs contrato']],
  [['imail', 'El equipo pide los números del Q3'], ['dash', 'Actualizar el dashboard del Q3']],
  [['crep', 'Reporte de septiembre listo para {co}'], ['cmail', 'Enviar el reporte de {co} con un resumen']],
];

applyTasks({ POOL, KEYS, CHAINS, SEGMENTS, AGENTS }); // INDUSTRY PROFILE (12 Sep 2026): per-industry demo file; no-op otherwise
function fill(s, v) { return s.replace('{co}', v.co).replace('{n}', v.n).replace('{segment}', v.segment); }
function vars() { return { co: rnd(P.co), n: ri(6, 40), segment: rnd(SEGMENTS) }; }
function timeStr(ts) {
  return new Date(ts).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}
function span(ms) { // "4 min" · "1 h 12 min" · "3 h"
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return 'ahora mismo';
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
const agentOf = id => AGENTS.find(a => a.id === id);
const STATE_LABEL = { next: 'Pendientes', doing: 'En curso', waiting: 'En espera', done: 'Listo', sched: 'Programado', scheduled: 'Programado' }; // scheduled (V3.2.1): a task with a date, not yet fired

export function initTasks(ctx) {
  const { R, deptRT, spawnEmote, chatPush, chatHist, feedPush, zoomToApproval, enterFocus, openAgent,
          getFocused, esc, brainWrite, brain, onLive, onTools, requestApproval, setStuck, onUsage } = ctx;
  // LIVE mode (served by serve.mjs): the bar routes through Claude, agents produce real
  // deliverables saved as notes in the brain, and tasks persist. Opened as a file it stays demo.
  let live = false;
  const API = '/api';
  const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

  const tasks = [];
  let seq = 1;
  // V3.5 routines. Live: the server's list (polled). Demo: session-only, fired by this tick.
  const routines = []; let rseq = 1, polling = false, railAgent = null, railExp = false;
  const RT_DEPTS = ['emails', 'fin', 'sales'];
  const RT_NAMES = PROFILE ? Object.fromEntries(Object.entries(PROFILE.pods).map(([k, v]) => [k, titleCase(v)])) : { emails: 'Emails', fin: 'Accounting', sales: 'Sales', marketing: 'Marketing', ops: 'Operations', delivery: 'Delivery' };
  const rtRefuse = k => `Routines come to ${RT_NAMES[k] || k} in a later release. This release: Emails, Accounting and Sales.`;
  const deptRoutines = k => routines.filter(r => r.dept === k);
  const agentRoutines = id => routines.filter(r => r.agent === id);
  const nextOf = list => list.filter(r => !r.paused && r.nextAt).sort((a, b) => a.nextAt - b.nextAt)[0];
  const byNext = (a, b) => (a.paused ? Infinity : a.nextAt || Infinity) - (b.paused ? Infinity : b.nextAt || Infinity);
  const doneCount = Object.fromEntries(DEPT_KEYS.map(k => [k, 0]));
  const board = { open: false };
  let dirty = false, lastBadge = 0, lastBar = 0, lastAgo = 0;

  /* ---------- model ---------- */
  function mk(o) {
    const a = agentOf(o.agent);
    const now = Date.now();
    const t = { id: seq++, dept: a.dept, state: 'next', progress: 0, addedAt: now, changedAt: now, ...o };
    tasks.push(t);
    return t;
  }
  const touch = (t, ev) => { t.changedAt = Date.now(); t.last = ev; dirty = true; };
  const agentTasks = (id, st) => tasks.filter(t => t.agent === id && t.state === st);
  const deptTasks = (k, st) => tasks.filter(t => t.dept === k && t.state === st);
  function visibleTitles(id) { return new Set(tasks.filter(t => t.agent === id && t.state !== 'done').map(t => t.title)); }
  function pick(id) {
    const seen = visibleTitles(id);
    for (let i = 0; i < 4; i++) { const t = fill(rnd(POOL[id]), vars()); if (!seen.has(t)) return t; }
    return fill(rnd(POOL[id]), vars());
  }
  // a fresh piece of work for an agent: sometimes the first step of a handoff chain
  function freshTask(id, extra = {}) {
    const starts = CHAINS.filter(c => c[0][0] === id);
    if (starts.length && Math.random() < 0.45) {
      const v = vars();
      const chain = rnd(starts).map(([aid, title]) => [aid, fill(title, v)]);
      return mk({ agent: id, title: chain[0][1], chain, chainI: 0, ...extra });
    }
    return mk({ agent: id, title: pick(id), ...extra });
  }
  function start(t, now) {
    t.state = 'doing'; t.startedAt = now; t.progress = 0; t.running = !!t.srv; t.ready = false; // a server-run task (routine) is never started from here
    t.dur = t.piece ? 40000 + Math.random() * 50000 : 90000 + Math.random() * 150000; // 1.5–4 min: a few completions a minute across the office (a team piece 40–90 s)
    t.pausedAt = null;
    touch(t, 'started');
  }
  function prune(k) {
    const done = tasks.filter(t => t.dept === k && t.state === 'done' && !t.live).sort((a, b) => b.doneAt - a.doneAt);
    for (const t of done.slice(14)) tasks.splice(tasks.indexOf(t), 1);
  }
  function complete(t) {
    t.state = 'done'; t.doneAt = Date.now(); t.progress = 1;
    doneCount[t.dept]++;
    const r = R[t.agent];
    spawnEmote(r, '✓');
    feedPush(r, '✓', 'Listo: ' + t.title);
    if (chatHist[t.agent]) chatPush(t.agent, { who: 'work', i: '✓', text: 'listo — ' + t.title });
    if (t.live) deliver(t); // the real deliverable lands in the agent's chat; the server already wrote the note
    else if (t.piece) { if (R[t.leadId]) { spawnEmote(R[t.leadId], '📋'); feedPush(R[t.leadId], '📋', `Piece in from ${agentOf(t.agent).name}: ${t.title}`); } } // demo: the piece walks back to the lead
    // demo: finished work becomes a note in the Brain — always for tasks you added, a quarter of the rest
    else if (brainWrite && (t.by === 'you' || Math.random() < 0.25)) brainWrite(t.agent, t.title);
    touch(t, 'done');
    if (!t.live && t.routine && t.needsOk && requestApproval) requestApproval(t.agent, `"${t.title}" is ready — send it?`); // demo: a routine that needs the OK asks for it
    if (t.chain && t.chainI < t.chain.length - 1) { // hand the work to the next desk — it appears in their backlog
      const [nid, ntitle] = t.chain[t.chainI + 1];
      const nt = mk({ agent: nid, title: ntitle, chain: t.chain, chainI: t.chainI + 1, from: t.agent });
      touch(nt, 'handoff');
      spawnEmote(R[nid], '📋');
    }
    prune(t.dept);
  }
  function deliver(t) {
    const a = agentOf(t.agent);
    if (t.piece) { // V3.2 (16 Sep): a teammate's piece — in their own chat, then it walks back to the lead
      const L = agentOf(t.leadId), parent = tasks.find(x => x.id === t.parent);
      chatPush(t.agent, { who: 'file', icon: t.error ? '⚠' : '📄', name: slug(t.title) + '.md', meta: `mi parte · pasada a ${L ? L.name : 'the lead'} · ${timeStr(t.doneAt)} · click to view`, content: t.result });
      if (!t.error) chatPush(t.agent, { who: 'agent', text: `Mi parte de "${parent ? parent.title : t.title}" está lista y con ${L ? L.name : 'the lead'}${t.used && t.used.length ? `. Used ${t.used.join(', ')}` : ''}.` });
      feedPush(R[t.agent], '📄', `Piece done → ${L ? L.name : 'lead'}: ${t.title}`);
      if (L && R[L.id]) { spawnEmote(R[L.id], '📋'); feedPush(R[L.id], '📋', `Piece in from ${a.name}: ${t.title}`); }
      return;
    }
    chatPush(t.agent, { who: 'file', icon: t.error ? '⚠' : '📄', name: (t.note || slug(t.title)) + '.md',
      meta: `${t.error ? 'no se pudo completar' : t.approved ? 'enviado tras tu visto bueno · guardado en tu cerebro' : 'entregado · guardado en tu cerebro'} · ${timeStr(t.doneAt)} · click to view`, content: t.result });
    if (!t.error) chatPush(t.agent, { who: 'agent', text: `Listo — "${t.title}"${t.routine ? ` (routine, ${t.when}${t.late ? ', se atrasó' : ''})` : ''} está lista arriba${t.team?.members?.length ? ` — the team was ${membersText(t)} and me` : ''}${t.read && t.read.length ? ` (I read ${t.read.slice(0, 3).join(', ')})` : ''}${t.used && t.used.length ? `. Used ${t.used.join(', ')}` : ''}. Di "revise: …" y la cambio.` });
    feedPush(R[t.agent], '📄', `Delivered: ${t.title}`);
    if (brain && t.read) for (const n of t.read.slice(0, 2)) brain.readNote(t.agent, n);
  }
  function brainSend(id) { // the Brain drops a fresh job into the agent's backlog
    const t = freshTask(id, { via: 'brain' });
    touch(t, 'added');
    spawnEmote(R[id], '📋');
    return t;
  }

  /* ---------- seed a believable morning ---------- */
  if (!location.protocol.startsWith('http')) { // only the file-opened demo; the owner's served office shows real work only
    const now = performance.now(), wall = Date.now();
    for (const a of AGENTS) {
      const r = R[a.id];
      { // everyone is mid-task at boot: the first frame must not be a column of "just now · 3%"
        const t = freshTask(a.id);
        start(t, now);
        const k = 0.05 + Math.random() * 0.8;
        t.startedAt = now - t.dur * k;
        t.changedAt = wall - t.dur * k;
      }
      const nNext = a.lead ? ri(1, 2) : ri(0, 2);
      for (let i = 0; i < nNext; i++) {
        const t = mk({ agent: a.id, title: pick(a.id) });
        t.addedAt = t.changedAt = wall - ri(8, 240) * 60000;
        t.last = 'added';
      }
    }
    for (const k of DEPT_KEYS) {
      const ids = AGENTS.filter(a => a.dept === k).map(a => a.id);
      const n = ri(5, 9);
      for (let i = 0; i < n; i++) {
        const id = rnd(ids), at = wall - ri(4, 300) * 60000;
        mk({ agent: id, title: pick(id), state: 'done', doneAt: at, changedAt: at, addedAt: at - ri(20, 90) * 60000, last: 'done' });
      }
      doneCount[k] = n;
    }
  }

  /* ---------- badge rows (far-zoom layer): DOING · NEXT · DONE per pod ---------- */
  function rowHTML(k) {
    return `<div class="b-tasks" data-tkrow="${k}" title="mostrar ${DEPTS[k].short} en el panel de tareas">
      <span>EN CURSO<b data-tk="${k}-doing">${deptTasks(k, 'doing').length}</b></span>
      <span>PRÓXIMO<b data-tk="${k}-next">${deptTasks(k, 'next').length}</b></span>
      <span>LISTO<b data-tk="${k}-done">${doneCount[k]}</b></span></div>`;
  }
  for (const k of DEPT_KEYS) deptRT[k].apprRow.insertAdjacentHTML('beforebegin', rowHTML(k));
  function syncBadges() {
    for (const k of DEPT_KEYS) {
      const vals = { doing: deptTasks(k, 'doing').length, next: deptTasks(k, 'next').length, done: doneCount[k] };
      for (const [s, n] of Object.entries(vals)) {
        document.querySelectorAll(`[data-tk="${k}-${s}"]`).forEach(b => {
          if (b.textContent !== String(n)) {
            b.textContent = n;
            b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
          }
        });
      }
    }
  }

  /* ---------- the TASK STATUS panel (always on, right side) ---------- */
  const panel = document.getElementById('tpanel');
  const P_ = {
    dd: panel.querySelector('.tp-dd'), ddName: panel.querySelector('.tp-dd .tp-ddn'), ddDot: panel.querySelector('.tp-dd .dot'),
    menu: panel.querySelector('.tp-menu'), input: panel.querySelector('.tp-in'), add: panel.querySelector('.tp-add'),
    hint: panel.querySelector('.tp-hint'), chips: panel.querySelector('.tp-chips'), rows: panel.querySelector('.tp-rows'),
    scope: panel.querySelector('.tp-scope'),
    rep: panel.querySelector('.tp-rep'), repRow: panel.querySelector('.tp-rep-row'), cad: panel.querySelector('.tp-cad'), at: panel.querySelector('.tp-at'), okc: panel.querySelector('.tp-okc'), next: panel.querySelector('.tp-next'),
    model: panel.querySelector('.tp-model'), effort: panel.querySelector('.tp-effort'),
    bigBtn: panel.querySelector('.tp-big-btn'), team: panel.querySelector('.tp-team'),
  };
  // V3.7: the box grows with the text (one line at rest, six at most) and the big editor mirrors it
  const big = document.getElementById('tpBig');
  const B_ = { in: big.querySelector('.tb-in'), dept: big.querySelector('.tb-dept'), dot: big.querySelector('.tb-head .dot'), hint: big.querySelector('.tb-hint'), add: big.querySelector('.tb-add'), close: big.querySelector('.tb-close') };
  function grow() { P_.input.style.height = '30px'; P_.input.style.height = Math.min(118, Math.max(30, P_.input.scrollHeight)) + 'px'; }
  function openBig() { B_.in.value = P_.input.value; B_.in.placeholder = P_.input.placeholder; big.classList.add('on'); mirrorHint(); B_.in.focus(); B_.in.setSelectionRange(B_.in.value.length, B_.in.value.length); }
  function closeBig() { if (!big.classList.contains('on')) return; big.classList.remove('on'); grow(); if (P_.input.value) P_.input.focus(); }
  function mirrorHint() { B_.hint.innerHTML = P_.hint.innerHTML; B_.hint.className = P_.hint.className.replace('tp-hint', 'tp-hint tb-hint'); }
  // V3.6 (D2): the model menu — Sonnet · Opus · Fable. Shows the office default; change it and it applies to this task (or this routine, with REPEAT on)
  let officeModel = DEFAULT_MODEL, modelTouched = false;
  P_.model.innerHTML = MODEL_KEYS.map(k => `<option value="${k}">${MODELS[k].name.toUpperCase()}</option>`).join('');
  P_.model.value = officeModel;
  P_.model.addEventListener('change', () => { modelTouched = P_.model.value !== officeModel; P_.model.classList.toggle('set', modelTouched); updateHint(); });
  P_.model.addEventListener('keydown', e => e.stopPropagation());
  function setOfficeModel(k) { officeModel = normModel(k) || DEFAULT_MODEL; if (!modelTouched) P_.model.value = officeModel; }
  const chosenModel = () => (modelTouched ? P_.model.value : null);
  function resetModel() { modelTouched = false; P_.model.value = officeModel; P_.model.classList.remove('set'); resetEffort(); }
  const modelBit = t => t.modelUsed ? ` · ${modelName(t.modelUsed)}${t.effortUsed ? ' ' + t.effortUsed : ''}${t.modelFrom && t.modelFrom !== 'office' ? ' (' + FROM_TEXT[t.modelFrom] + ')' : ''}` : '';
  // V3.6.1: the EFFORT menu beside the model — AUTO (the model's own; Opus = high) · Low · Medium · High · Extra high · Max. Same precedence as the model.
  let officeEffort = '', effortTouched = false;
  P_.effort.innerHTML = `<option value="">AUTO</option>` + EFFORT_KEYS.map(k => `<option value="${k}">${EFFORT_NAME[k].toUpperCase()}</option>`).join('');
  P_.effort.value = officeEffort;
  P_.effort.addEventListener('change', () => { effortTouched = P_.effort.value !== officeEffort; P_.effort.classList.toggle('set', effortTouched); updateHint(); });
  P_.effort.addEventListener('keydown', e => e.stopPropagation());
  function setOfficeEffort(k) { officeEffort = normEffort(k) || ''; if (!effortTouched) P_.effort.value = officeEffort; }
  const chosenEffort = () => (effortTouched ? (P_.effort.value || 'auto') : null); // 'auto' = the owner chose the model's own over the office's
  const effortSend = () => { const e = chosenEffort(); return e && e !== 'auto' ? e : undefined; };
  function resetEffort() { effortTouched = false; P_.effort.value = officeEffort; P_.effort.classList.remove('set'); }
  const effortUsedFor = (mdl) => effortFor({ task: effortSend(), office: chosenEffort() === 'auto' ? '' : officeEffort, model: mdl }); // what a demo card will show
  const pickBit = (forWhat) => { // the hint's "Opus · High for this task"
    const bits = []; if (modelTouched) bits.push(modelName(P_.model.value)); if (effortTouched) bits.push(effortName(P_.effort.value || ''));
    return bits.length ? ` · <b>${bits.join(' · ')}</b> for this ${forWhat}` : '';
  };
  // the REPEAT picker (B1): cadence + time; "needs my OK" defaults on (D1)
  let repeat = false;
  P_.cad.innerHTML = [['weekdays', 'Cada día hábil'], ['daily', 'Todos los días'], ['mon', 'lunes'], ['tue', 'martes'], ['wed', 'miércoles'], ['thu', 'jueves'], ['fri', 'viernes'], ['sat', 'sábados'], ['sun', 'domingos'], ['hourly', 'Cada hora, 9–5, días hábiles']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  P_.rep.addEventListener('click', () => { repeat = !repeat; P_.rep.classList.toggle('on', repeat); P_.repRow.hidden = !repeat; updateHint(); if (repeat) P_.input.focus(); });
  P_.cad.addEventListener('change', () => { P_.at.disabled = P_.cad.value === 'hourly'; updateHint(); });
  P_.at.addEventListener('change', updateHint);
  [P_.cad, P_.at, P_.okc].forEach(el => el.addEventListener('keydown', e => e.stopPropagation()));
  const routineIntent = text => repeat ? { when: fromPicker(P_.cad.value, P_.at.value), text, picker: true } : parseWhen(text);
  // V3.2 (16 Sep) Agent Teams: the TEAM toggle — the department lead splits the task across its desks, they work at once, the lead writes the final
  let teamOn = false, teamsCfg = { enabled: true, max: 4 };
  const teamIntent = text => /\b(as a team|team up|team this|get the (whole )?team|the (whole )?team (on|to|should|can)|with the team|(spawn|use|get) (\d+|two|three|four|five|a few|some) teammates?|\d+ teammates|split (it|this|the work) (up|across|between)|teammates|team:|whole department)\b/i.test(text);
  const asTeam = text => teamsCfg.enabled && (teamOn || teamIntent(text));
  const leadOf = k => AGENTS.find(x => x.dept === k && x.lead) || AGENTS.filter(x => x.dept === k)[0];
  P_.team.addEventListener('click', () => { teamOn = !teamOn; P_.team.classList.toggle('on', teamOn); updateHint(); if (teamOn) P_.input.focus(); });
  function resetTeam() { teamOn = false; P_.team.classList.remove('on'); }
  const teamBit = t => t.team?.members?.length ? ` · <span class="tp-team-chip">TEAM ${t.team.members.length + 1}</span>` : t.piece ? ' · <span class="tp-team-chip">PIECE</span>' : '';
  const membersText = t => (t.team?.members || []).map(id => agentOf(id)?.name || id).join(', ');
  let dept = 'marketing', filter = 'all';
  P_.menu.innerHTML = DEPT_KEYS.map(k => `<button data-k="${k}"><span class="dot" style="background:${DEPTS[k].chip}"></span>${DEPTS[k].name}</button>`).join('');
  P_.menu.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { setDept(b.dataset.k); P_.menu.classList.remove('on'); P_.input.focus(); }));
  P_.dd.addEventListener('click', (e) => { e.stopPropagation(); P_.menu.classList.toggle('on'); });
  document.addEventListener('click', () => P_.menu.classList.remove('on'));
  function setDept(k) {
    dept = k;
    P_.ddName.textContent = DEPTS[k].short;
    P_.ddDot.style.background = DEPTS[k].chip;
    B_.dept.textContent = DEPTS[k].name.toUpperCase(); B_.dot.style.background = DEPTS[k].chip;
    P_.input.placeholder = `Escribe una tarea para ${DEPTS[k].name.toLowerCase()}…`;
    updateHint();
  }
  // routing: keywords → the right agent in the chosen dept; fallback = the dept lead (or first agent)
  function route(k, title) {
    const low = title.toLowerCase();
    const pool = AGENTS.filter(x => x.dept === k);
    let best = pool.find(x => x.lead) || pool[0], bestN = 0;
    for (const a of pool) {
      const n = (KEYS[a.id] || []).filter(w => low.includes(w)).length;
      if (n > bestN) { bestN = n; best = a; }
    }
    return { agent: best, matched: bestN > 0 };
  }
  function updateHint() {
    grow();
    const text = P_.input.value.trim();
    if (!text) { P_.hint.innerHTML = ''; P_.hint.classList.remove('on'); return; }
    const rt = routineIntent(text);
    if (rt) { // a routine in the making: say the schedule back before Add is pressed
      if (!RT_DEPTS.includes(dept)) { P_.hint.innerHTML = `<span class="tp-amber">${esc(rtRefuse(dept))}</span>`; P_.hint.className = 'tp-hint on'; return; }
      const { agent: ra } = route(dept, rt.text || text);
      const need = rt.needsDay ? '¿qué día? di "cada lunes …"' : rt.needsTime ? '¿a qué hora? agrega "a las 8"' : null;
      P_.hint.innerHTML = `<span class="tp-av" style="border-color:${DEPTS[ra.dept].chip};background:${DEPTS[ra.dept].chip}55">⏱</span>Rutina · <b>${esc(describe(rt.when) || 'every week')}</b>` +
        (need ? ` · <span class="tp-amber">${need}</span>` : live ? ' · Claude elige al agente cuando presionas Agregar' : ` · va a <b>${ra.name}</b>`) + (rt.guessed ? ` · "${esc(rt.guessWord)}" tomado como ${rt.when.at}` : '');
      P_.hint.innerHTML += pickBit('routine');
      P_.hint.className = 'tp-hint on'; return;
    }
    if (asTeam(text)) { // a team in the making: the lead, and how many desks
      const L = leadOf(dept), chip = DEPTS[dept].chip;
      P_.hint.innerHTML = `<span class="tp-av" style="border-color:${chip};background:${chip}55">⚑</span>Equipo · <b>${L.name}</b> lo reparte en hasta ${teamsCfg.max} escritorios, trabajan al mismo tiempo, el lead escribe el final` + pickBit('task');
      P_.hint.className = 'tp-hint on'; return;
    }
    const { agent: a, matched } = route(dept, text);
    const busy = agentTasks(a.id, 'doing').length > 0 || R[a.id].state === 'stuck';
    const chip = DEPTS[a.dept].chip;
    P_.hint.innerHTML = `<span class="tp-av" style="border-color:${chip};background:${chip}55">${a.name[0]}</span>` +
      (live ? `Probablemente <b>${a.name}</b> · Claude lo confirma cuando presionas Agregar`
            : `Va a <b>${a.name}</b> · ${busy ? 'empieza después de su trabajo actual' : 'empieza de inmediato'}${matched ? '' : ' · cuenta más y elijo un especialista'}`) +
      pickBit('task');
    P_.hint.className = 'tp-hint on';
  }
  P_.input.addEventListener('input', () => { panel.querySelector('.tp-cmd').classList.toggle('typing', !!P_.input.value); grow(); updateHint(); });
  P_.input.addEventListener('blur', () => { if (!P_.input.value) panel.querySelector('.tp-cmd').classList.remove('typing'); });
  P_.input.addEventListener('keydown', (e) => { // Enter adds, Shift+Enter is a new line, ⌘⇧E opens the big editor
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    else if (e.key === 'Escape') P_.input.blur();
    else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'e') { e.preventDefault(); openBig(); }
  });
  P_.add.addEventListener('click', submit);
  P_.bigBtn.addEventListener('click', openBig);
  B_.in.addEventListener('input', () => { P_.input.value = B_.in.value; P_.input.dispatchEvent(new Event('input', { bubbles: true })); mirrorHint(); });
  B_.in.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } else if (e.key === 'Escape') closeBig(); });
  B_.add.addEventListener('click', submit);
  B_.close.addEventListener('click', closeBig);
  big.addEventListener('click', (e) => { if (e.target === big) closeBig(); });
  function say(html, cls) { P_.hint.innerHTML = html; P_.hint.className = 'tp-hint on' + (cls ? ' ' + cls : ''); grow(); if (big.classList.contains('on')) mirrorHint(); }
  async function submit() {
    let title = P_.input.value.trim().replace(/[.!]+$/, '');
    if (!title) return;
    big.classList.remove('on');
    title = title.charAt(0).toUpperCase() + title.slice(1);
    const rt = routineIntent(title);
    if (rt) { await submitRoutine(rt, title); return; }
    if (live) {
      const text = title, k = dept;
      P_.input.value = ''; P_.input.disabled = true; P_.add.disabled = true;
      const team = asTeam(text);
      say(team ? `Pasando por Claude — <b>${leadOf(k).name}</b> lo está leyendo para el equipo…` : `Pasando por Claude — ${DEPTS[k].name.toLowerCase()} lo está leyendo…`, 'busy');
      try {
        const mdl = chosenModel();
        const r = await fetch(API + '/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: k, text, model: mdl || undefined, effort: effortSend(), team: team || undefined }) });
        if (!r.ok) throw new Error((await r.json()).error || r.statusText);
        const st = await r.json();
        const t = mk({ agent: st.agent, title: st.title, text: st.text, plan: st.plan, why: st.why, by: 'you', live: true, sid: st.id, model: st.model, modelUsed: st.model || officeModel, modelFrom: st.model ? 'task' : 'office', effort: st.effort,
          team: st.team ? { lead: st.team.lead, members: [] } : undefined });
        resetModel(); resetTeam();
        touch(t, 'added'); spawnEmote(R[t.agent], st.team ? '⚑' : '📋');
        say(st.team ? `Agregado — <b>${agentOf(t.agent).name}</b> lo tiene y lo está repartiendo en el equipo` : `Agregado — <b>${agentOf(t.agent).name}</b> lo tiene${st.why ? ' · ' + esc(st.why) : ''}`);
        setTimeout(() => { if (!P_.input.value) P_.hint.classList.remove('on'); }, 7000);
      } catch (e) {
        say(`No se agregó: ${esc(e.message)}. Tu texto sigue en la caja — inténtalo de nuevo.`, 'err'); // no pretend card: a live office shows only real work
        P_.input.value = text;
      }
      P_.input.disabled = false; P_.add.disabled = false; P_.input.blur(); // hand the keys back to the office
      return;
    }
    if (asTeam(title)) { // demo: the lead + two or three desks, all at once, the lead finishes when the pieces are in
      const t = addTeamDemo(dept, title);
      const mdl = chosenModel(); t.modelUsed = mdl || officeModel; t.modelFrom = mdl ? 'task' : 'office'; const ef = effortUsedFor(t.modelUsed); t.effortUsed = ef.effort || ''; t.effortFrom = ef.from;
      resetModel(); resetTeam(); P_.input.value = ''; updateHint();
      say(`Agregado — <b>${agentOf(t.agent).name}</b> lo tiene con ${esc(membersText(t))}.`); setTimeout(updateHint, 3200); P_.input.blur();
      return;
    }
    const { agent: a } = route(dept, title);
    const t = addTask(a.id, title, 'you');
    if (t) { const mdl = chosenModel(); t.modelUsed = mdl || officeModel; t.modelFrom = mdl ? 'task' : 'office'; const ef = effortUsedFor(t.modelUsed); t.effortUsed = ef.effort || ''; t.effortFrom = ef.from; }
    resetModel();
    P_.input.value = ''; updateHint();
    if (t) { say(`Agregado — <b>${a.name}</b> lo tiene.`); setTimeout(updateHint, 2600); P_.input.blur(); }
    else say(`<b>${a.name}</b> ya tiene cinco en cola — deja que termine una primero.`);
  }
  /* ---------- V3.2 (16 Sep) demo teams: the same moves on a timer ---------- */
  function addTeamDemo(k, title) {
    const L = leadOf(k), others = AGENTS.filter(x => x.dept === k && !x.lead).sort(() => Math.random() - 0.5);
    const picks = others.slice(0, Math.max(2, Math.min(3, teamsCfg.max - 1, others.length)));
    const t = mk({ agent: L.id, title, by: 'you', team: { lead: L.id, members: picks.map(p => p.id) }, teamHold: true });
    touch(t, 'added'); spawnEmote(R[L.id], '⚑'); feedPush(R[L.id], '⚑', `Team task: ${title} — ${picks.map(p => agentOf(p.id).name).join(', ')}`);
    for (const p of picks) {
      const c = mk({ agent: p.id, title: `${title} — ${(p.role || 'their').replace(/ Agent$/i, '').toLowerCase()} part`, by: 'team', piece: true, parent: t.id, leadId: L.id, from: L.id });
      touch(c, 'handoff'); spawnEmote(R[p.id], '📋'); feedPush(R[p.id], '📋', `Team piece from ${L.name}: ${c.title}`);
    }
    return t;
  }
  /* ---------- V3.5 routines: set one from the bar ---------- */
  async function submitRoutine(rt, raw) {
    const k = dept;
    if (!RT_DEPTS.includes(k)) { say(`<span class="tp-amber">${esc(rtRefuse(k))}</span>`, 'err'); return; }
    if (rt.needsDay) { say('¿Qué día? Di "cada lunes …" o "lun y jue …".', 'err'); return; }
    if (rt.needsTime) { say('¿A qué hora? Agrega "a las 8" o "a las 17:30", o presiona REPETIR y elige una.', 'err'); return; }
    const text = (rt.text || raw).trim().replace(/[.!]+$/, '');
    if (!text) { say('¿Qué debe pasar? La frase tiene hora pero no tarea.', 'err'); return; }
    if (live) {
      P_.input.disabled = true; P_.add.disabled = true;
      say('Programando la rutina — Claude está eligiendo al agente…', 'busy');
      try {
        const r = await fetch(API + '/routines', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: k, text, when: rt.when, needsOk: rt.picker ? P_.okc.checked : undefined, model: chosenModel() || undefined, effort: effortSend() }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText);
        setRoutines([...routines.filter(x => x.id !== j.routine.id), j.routine]);
        const a = agentOf(j.routine.agent);
        say(`Rutina programada — <b>${a.name}</b> · ${esc(j.routine.desc)} · próxima ${esc(untilText(j.routine.nextAt))}${j.routine.needsOk ? ' · en espera de tu visto bueno' : ' · solo lectura'}${j.guessed ? ` · "${esc(j.guessed)}" taken as ${j.routine.when.at}` : ''}`);
        P_.input.value = ''; resetModel(); spawnEmote(R[a.id], '⏱'); feedPush(R[a.id], '⏱', `New routine: ${j.routine.title} (${j.routine.desc})`);
        filter = 'sched'; render(true); poll();
      } catch (e) { say(`Claude couldn't set it (${esc(e.message)}).`, 'err'); }
      P_.input.disabled = false; P_.add.disabled = false; P_.input.blur();
      return;
    }
    const { agent: a } = route(k, text);
    const r = addRoutine(k, a.id, text, rt.when, rt.picker ? P_.okc.checked : guessOk(text));
    r.model = chosenModel() || undefined; r.effort = effortSend(); resetModel();
    P_.input.value = ''; say(`Rutina programada — <b>${a.name}</b> · ${esc(r.desc)} · próxima ${esc(untilText(r.nextAt))}${r.needsOk ? ' · en espera de tu visto bueno' : ' · solo lectura'}`);
    spawnEmote(R[a.id], '⏱'); feedPush(R[a.id], '⏱', `New routine: ${r.title} (${r.desc})`); filter = 'sched'; render(true); P_.input.blur(); setTimeout(updateHint, 5000);
  }
  function guessOk(text) { const t = text.toLowerCase(); return /\b(send|reply|chase|nudge|remind|post|publish|pay|book|draft|message|email)\b/.test(t) || !/\b(list|summari[sz]e|triage|tell me|what|report|match|reconcile|qualify|review|check|read|find|flag|count)\b/.test(t); }
  function addRoutine(k, agentId, text, when, needsOk) { // demo: session-only
    const title = (text.charAt(0).toUpperCase() + text.slice(1)).replace(/[.!]+$/, '').slice(0, 90);
    const r = { id: 'r' + rseq++, dept: k, agent: agentId, title, text, when, desc: describe(when), needsOk: !!needsOk, paused: false, nextAt: nextRun(when), lastAt: null, runs: 0, live: false };
    routines.push(r); syncPills(); dirty = true; if (railAgent === agentId) railFor(agentId);
    return r;
  }
  function setRoutines(list) { routines.length = 0; for (const r of list) routines.push({ ...r, live: true }); syncPills(); dirty = true; if (railAgent) railFor(railAgent); }
  function fireDemo(r, manual) {
    const t = addTask(r.agent, r.title, 'routine');
    if (t) { t.routine = r.id; t.when = r.desc; t.needsOk = r.needsOk; t.modelUsed = r.model || officeModel; t.modelFrom = r.model ? 'routine' : 'office'; spawnEmote(R[r.agent], '⏱'); feedPush(R[r.agent], '⏱', `Routine${manual ? ' (run now)' : ''}: ${r.title}`); }
    r.lastAt = Date.now(); r.runs++; r.nextAt = nextRun(r.when);
  }
  async function rtAct(rid, act) { // RUN NOW · PAUSE · RESUME · DELETE — from a SCHEDULED row, a board card or the rail strip
    const r = routines.find(x => x.id === rid); if (!r) return;
    if (live) {
      let err = null;
      if (act === 'delete') { try { const res = await fetch(`${API}/routines/${rid}`, { method: 'DELETE' }); if (!res.ok) err = (await res.json().catch(() => ({}))).error || res.statusText; } catch (e) { err = 'sin conexión con la oficina'; } }
      else { const j = await post(`/routines/${rid}/${act}`); if (!j || j.error) err = (j && j.error) || 'sin conexión con la oficina'; else if (act === 'run' && j.task) reconcile(j.task); }
      if (!err && act === 'run') { spawnEmote(R[r.agent], '⏱'); feedPush(R[r.agent], '⏱', `Ejecutar ahora: ${r.title}`); }
      await poll(); return err ? { ok: false, error: err } : { ok: true };
    }
    if (act === 'delete') routines.splice(routines.indexOf(r), 1);
    else if (act === 'pause') { r.paused = true; r.nextAt = null; }
    else if (act === 'resume') { r.paused = false; r.nextAt = nextRun(r.when); }
    else if (act === 'run') fireDemo(r, true);
    syncPills(); dirty = true; if (railAgent) railFor(railAgent);
  }
  const post = (p, b) => fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }).then(r => r.json()).catch(e => { console.warn('office:', e.message); return null; });
  function syncPills() { // C2: the clock chip on the desk
    for (const id in R) {
      const n = agentRoutines(id).length, pill = R[id].pill; let s = pill.querySelector('.rt');
      if (!n) { if (s) s.remove(); continue; }
      if (!s) { s = document.createElement('span'); s.className = 'rt'; pill.appendChild(s); }
      s.textContent = '⏱ ' + n;
    }
  }
  function railFor(id) { // C2: the ROUTINES strip in the agent's rail — click to open, RUN NOW / PAUSE / DELETE per routine
    railAgent = id;
    const el = document.getElementById('mRt'); if (!el) return;
    const mine = agentRoutines(id).sort(byNext);
    el.hidden = !mine.length; if (!mine.length) { el.innerHTML = ''; return; }
    const n = nextOf(mine);
    el.className = 'mrt' + (railExp ? ' exp' : '');
    el.innerHTML = `<div class="mrt-h"><span>⏱ ${mine.length} routine${mine.length > 1 ? 's' : ''}${n ? ' · next <b>' + esc(untilText(n.nextAt)) + '</b>' : ' · all paused'}</span><span class="car">▸</span></div>
      <div class="mrt-l">${mine.map(r => `<div class="mrt-r" data-rid="${r.id}"><span>${esc(r.title)}</span><small>${esc(r.desc)} · ${modelName(r.model || officeModel)} · ${r.paused ? 'paused' : 'next ' + esc(untilText(r.nextAt))} · ${r.needsOk ? 'en espera de tu visto bueno' : 'solo lectura'}</small>
        <div class="tp-act"><button class="run" data-act="run">EJECUTAR AHORA</button><button data-act="${r.paused ? 'resume' : 'pause'}">${r.paused ? 'REANUDAR' : 'PAUSAR'}</button><button data-act="delete">ELIMINAR</button></div></div>`).join('')}</div>`;
    el.querySelector('.mrt-h').addEventListener('click', () => { railExp = !railExp; el.classList.toggle('exp', railExp); });
    el.querySelectorAll('.tp-act button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); rtAct(b.closest('[data-rid]').dataset.rid, b.dataset.act); }));
  }
  /* ---------- V3.5 live: the page keeps up with a server that runs things on its own ---------- */
  let pollN = 0, usageDue = true;
  async function pollUsage(force) { // V3.6: the plan's gauge — every 30 s, and after every run
    try { const u = await fetch(API + '/usage' + (force ? '?refresh=1' : '')).then(r => r.json()); if (onUsage) onUsage(u); } catch {}
  }
  async function poll() {
    if (!live || polling) return; polling = true;
    if (usageDue || ++pollN % 5 === 0) { usageDue = false; pollUsage(); }
    try {
      const [rl, tl] = await Promise.all([fetch(API + '/routines').then(r => r.json()), fetch(API + '/tasks').then(r => r.json())]);
      if (Array.isArray(rl.routines)) setRoutines(rl.routines);
      if (Array.isArray(tl)) for (const st of tl) reconcile(st);
      if (calendar) calendar.refresh();
      if (pollFails >= 3) setOffline(false);
      pollFails = 0;
    } catch (e) { console.warn('office poll:', e.message); if (++pollFails === 3) setOffline(true); }
    polling = false;
  }
  let pollFails = 0;
  function setOffline(off) { // the server went away (closed window, crash): say so instead of a green LIVE that lies
    const mode = panel.querySelector('.tp-mode'); if (!mode) return;
    mode.classList.toggle('live', !off); mode.classList.toggle('offline', off);
    mode.textContent = off ? 'SIN CONEXIÓN' : mode.dataset.on || 'LIVE · CLAUDE';
    if (off) say('Se perdió la conexión con la oficina. ¿Cerraste la ventana del servidor? Vuelve a abrir el iniciador.', 'err');
    else say('Conexión recuperada.');
  }
  function reconcile(st) { // a server task the page did not start (a routine firing, a catch-up, an approval finishing) → the same cards, the same moves
    if (!agentOf(st.agent)) return;
    let t = tasks.find(x => x.live && x.sid === st.id);
    if (!t) {
      t = mk({ agent: st.agent, title: st.title, text: st.text, plan: st.plan, by: st.by === 'routine' ? 'routine' : 'you', live: true, srv: !!(st.routine || st.dueAt), sid: st.id,
        routine: st.routine, when: st.when, late: !!st.late, due: st.due, needsOk: !!st.needsOk, addedAt: st.addedAt, changedAt: st.addedAt, last: 'added',
        model: st.model, modelUsed: st.modelUsed || st.model || undefined, modelFrom: st.modelFrom || (st.model ? 'task' : undefined), effort: st.effort, effortUsed: st.effortUsed, effortFrom: st.effortFrom });
      if (st.state === 'scheduled') { t.state = 'scheduled'; t.dueAt = st.dueAt; t.needsOk = !!st.needsOk; }
      else if (st.state !== 'done') { spawnEmote(R[t.agent], st.routine ? '⏱' : st.dueAt ? '⏱' : '📋'); if (st.routine) feedPush(R[t.agent], '⏱', `Routine fired: ${t.title}${t.late ? ' (late — was due ' + timeStr(t.due) + ')' : ''}`); else if (st.dueAt) feedPush(R[t.agent], '⏱', `Scheduled task fired: ${t.title}`); }
      touch(t, 'added');
    }
    apply(t, st);
  }
  function copyResult(t, st) { t.result = st.result; t.error = !!st.error; t.read = st.read || []; t.note = st.note; t.tools = st.tools || []; t.used = st.used || []; t.draft = st.draft; t.approved = !!st.approved; if (st.modelUsed) { t.modelUsed = st.modelUsed; t.modelFrom = st.modelFrom; t.effortUsed = st.effortUsed || ''; t.effortFrom = st.effortFrom; } }
  // V3.2 (16 Sep): the server's team state → piece cards on the teammates' desks, notes as 💬, the lead's members list
  const seenNotes = new Set();
  function syncTeam(t, st, quiet) {
    const tm = st.team; if (!tm) return;
    const pieces = tm.pieces || [];
    t.team = { lead: tm.lead, members: pieces.map(p => p.agent).filter(id => id !== tm.lead), why: tm.why };
    for (const p of pieces) {
      if (!agentOf(p.agent)) continue;
      const sid = `${st.id}:${p.agent}`;
      let c = tasks.find(x => x.live && x.sid === sid);
      if (!c) {
        c = mk({ agent: p.agent, title: p.title, text: p.text, by: 'team', live: true, srv: true, sid, piece: true, parent: t.id, leadId: tm.lead, from: tm.lead, addedAt: tm.plannedAt || Date.now(), changedAt: tm.plannedAt || Date.now(), last: 'handoff', running: true });
        if (!quiet) { spawnEmote(R[p.agent], '📋'); feedPush(R[p.agent], '📋', `Team piece from ${agentOf(tm.lead).name}: ${p.title}`); }
        touch(c, 'handoff');
      }
      if (p.state === 'doing' && c.state !== 'doing') { c.state = 'doing'; c.startedAt = performance.now() - Math.max(0, Date.now() - (p.startedAt || Date.now())); c.progress = 0; c.running = true; c.ready = false; c.changedAt = p.startedAt || Date.now(); touch(c, 'started'); }
      else if (p.state === 'done' && c.state !== 'done') {
        c.result = p.result; c.error = !!p.error; c.tools = p.tools || []; c.used = p.used || []; c.read = p.read || []; c.ready = true; c.running = true;
        if (quiet) { c.state = 'done'; c.doneAt = p.doneAt || Date.now(); c.changedAt = c.doneAt; c.progress = 1; c.last = 'done'; }
        else { complete(c); c.doneAt = p.doneAt || c.doneAt; c.changedAt = c.doneAt; if (c.tools.length && onTools) onTools(c.agent, c.tools); }
      }
    }
    for (const m of tm.messages || []) { // a note one teammate left another (or the lead)
      const key = `${st.id}:${m.from}:${m.to}:${m.at}`; if (seenNotes.has(key)) continue; seenNotes.add(key);
      if (quiet) continue;
      const to = m.to === 'lead' ? tm.lead : m.to, toName = agentOf(to)?.name || m.to;
      if (R[m.from]) { spawnEmote(R[m.from], '💬'); feedPush(R[m.from], '💬', `Note to ${toName}: ${m.text}`); chatPush(m.from, { who: 'work', i: '💬', text: `note to ${toName}: ${m.text}` }); }
      if (R[to]) { feedPush(R[to], '📨', `Note from ${agentOf(m.from)?.name || m.from}: ${m.text}`); chatPush(to, { who: 'work', i: '📨', text: `note from ${agentOf(m.from)?.name || m.from}: ${m.text}` }); }
    }
  }
  function apply(t, st) {
    if (st.team) syncTeam(t, st);
    if (st.state === 'scheduled') { if (t.state !== 'scheduled') { t.state = 'scheduled'; t.dueAt = st.dueAt; touch(t, 'scheduled'); } else if (t.dueAt !== st.dueAt || t.title !== st.title || t.text !== st.text) { Object.assign(t, { dueAt: st.dueAt, title: st.title, text: st.text }); dirty = true; } return; }
    if (t.state === 'scheduled' && st.state !== 'scheduled') { t.state = 'next'; t.addedAt = st.addedAt || Date.now(); t.late = !!st.late; t.due = st.due; touch(t, 'added'); spawnEmote(R[t.agent], '⏱'); feedPush(R[t.agent], '⏱', `Scheduled task fired: ${t.title}${t.late ? ' (late)' : ''}`); if (calendar) calendar.refresh(); }
    if (st.state === 'doing' && t.state !== 'doing') {
      t.state = 'doing'; t.startedAt = performance.now() - Math.max(0, Date.now() - (st.startedAt || Date.now())); t.progress = 0; t.pausedAt = null; t.running = true; t.ready = false; t.srv = true; t.changedAt = st.startedAt || Date.now(); touch(t, 'started');
    } else if (st.state === 'waiting' && t.draftAt !== st.waitingAt) { // a new draft is waiting for the OK (the first, or a rework after REJECT)
      copyResult(t, st); t.state = 'waiting'; t.draftAt = st.waitingAt; t.ask = st.ask; t.changedAt = st.waitingAt || Date.now(); t.running = true; touch(t, 'waiting');
      askApproval(t);
    } else if (st.state === 'done' && t.state !== 'done') {
      copyResult(t, st); t.ready = true; t.running = true; usageDue = true;
      complete(t); t.doneAt = st.doneAt || t.doneAt; t.changedAt = t.doneAt; // straight to done here (the tick skips a stuck agent): the chat card, the note, the graph
      if (t.tools.length && onTools) onTools(t.agent, t.tools);
      if (brain && !t.error) fetch(API + '/brain').then(r => r.json()).then(g => brain.setGraph(g)).catch(() => {});
    }
  }
  function askApproval(t) { // D1: the draft lands in the chat with APPROVE / REJECT and the agent stands and waves
    chatPush(t.agent, { who: 'file', icon: '📝', name: slug(t.title) + '.md', meta: `borrador · en espera de tu visto bueno · ${timeStr(t.changedAt)} · clic para ver`, content: t.draft || t.result });
    chatPush(t.agent, { who: 'appr', text: t.ask || `"${t.title}" está lista — aprueba para enviarla, rechaza para decirme qué cambiar.`, pending: true, live: true });
    feedPush(R[t.agent], '⏸', `En espera de tu visto bueno: ${t.title}`);
    if (setStuck) setStuck(t.agent, t.ask, t.sid);
  }
  const pendingFeedback = {}; // agentId → sid after REJECT: the owner's next chat line is the note
  function resolveLive(agentId, approved) { // APPROVE / REJECT on a live draft (main.js calls this instead of the demo onResolve)
    const t = tasks.find(x => x.live && x.agent === agentId && x.state === 'waiting'); if (!t) return false;
    if (approved) { post(`/tasks/${t.sid}/approve`); toDoing(t); chatPush(agentId, { who: 'agent', text: '✓ Aprobado — enviándolo ahora. Llega aquí cuando esté listo.' }); }
    else { pendingFeedback[agentId] = t.sid; chatPush(agentId, { who: 'agent', text: 'Entendido. ¿Qué debería cambiar? Dímelo aquí y lo rehago — vuelve para tu visto bueno.' }); }
    return true;
  }
  const pendingReject = agentId => !!pendingFeedback[agentId];
  function rejectLive(agentId, feedback) {
    const sid = pendingFeedback[agentId]; delete pendingFeedback[agentId];
    const t = tasks.find(x => x.live && x.sid === sid); if (!t) return false;
    post(`/tasks/${sid}/reject`, { feedback }); toDoing(t); chatPush(agentId, { who: 'agent', text: 'On it — reworking it with your note. It comes back here for your OK.' });
    return true;
  }
  function toDoing(t) { t.state = 'doing'; t.startedAt = performance.now(); t.progress = 0; t.pausedAt = null; t.running = true; t.ready = false; t.srv = true; touch(t, 'started'); }
  // LIVE: the agent picks the task up → Claude does it on the server → the result lands in the chat
  async function runLive(t, feedback) {
    t.running = true; t.ready = false;
    try {
      const r = await fetch(`${API}/tasks/${t.sid}/${feedback ? 'revise' : 'run'}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(feedback ? { feedback } : {}) });
      if (!r.ok) throw new Error((await r.json()).error || r.statusText);
      const st = await r.json();
      t.result = st.result; t.error = !!st.error; t.read = st.read || []; t.note = st.note; t.tools = st.tools || []; t.used = st.used || []; if (st.modelUsed) { t.modelUsed = st.modelUsed; t.modelFrom = st.modelFrom; t.effortUsed = st.effortUsed || ''; t.effortFrom = st.effortFrom; }
      usageDue = true;
      if (t.tools.length && onTools) onTools(t.agent, t.tools); // the connectors the agent really pulled on light up
      if (brain && !t.error) fetch(API + '/brain').then(r => r.json()).then(g => brain.setGraph(g)).catch(() => {}); // the new note joins the graph
    } catch (e) { t.result = 'Could not complete this task: ' + e.message; t.error = true; }
    t.ready = true;
  }
  function revise(agentId, feedback) { // "revise: …" in chat re-runs that agent's last live deliverable
    const t = [...tasks].reverse().find(x => x.live && x.agent === agentId && x.state === 'done' && !x.error);
    if (!t) return false;
    t.state = 'doing'; t.startedAt = performance.now(); t.progress = 0; t.pausedAt = null; touch(t, 'started');
    runLive(t, feedback);
    return true;
  }
  async function connect() {
    if (!location.protocol.startsWith('http')) return;
    try {
      const h = await (await fetch(API + '/health')).json();
      if (!h.ok) return;
      live = true; setOfficeModel(h.model); setOfficeEffort(h.effort);
      if (h.teams) { teamsCfg = { enabled: h.teams.enabled !== false, max: h.teams.max || 4 }; P_.team.hidden = !teamsCfg.enabled; }
      const mode = panel.querySelector('.tp-mode');
      if (mode) { mode.hidden = false; mode.textContent = mode.dataset.on = 'LIVE · ' + (h.backend === 'anthropic-sdk' ? 'CLAUDE API' : 'CLAUDE'); mode.classList.add('live'); mode.title = `${h.name} · ${h.backend} · ${modelName(h.model)} by default · brain: ${h.brain}`; }
      if (brain) { try { brain.setGraph(await (await fetch(API + '/brain')).json()); } catch {} }
      const list = await (await fetch(API + '/tasks')).json();
      for (const st of list) {
        if (!agentOf(st.agent)) continue;
        if (st.state === 'done') {
          const t = mk({ agent: st.agent, title: st.title, text: st.text, plan: st.plan, by: 'you', live: true, sid: st.id, state: 'done',
            doneAt: st.doneAt, changedAt: st.doneAt, addedAt: st.addedAt, result: st.result, read: st.read, note: st.note, tools: st.tools || [], used: st.used || [], error: !!st.error, last: 'done' });
          if (st.team) syncTeam(t, st, true);
          deliver(t);
        } else reconcile(st); // next, doing (the server may be running it), waiting for your OK, scheduled for a date — pick it up again
      }
      dirty = true;
      if (onLive) onLive(h);
      await poll(); setInterval(() => { if (!document.hidden) poll(); }, 6000); addEventListener('visibilitychange', () => { if (!document.hidden) poll(); }); // a hidden tab stops asking; back in view it catches up at once // V3.5: routines fire on the server's clock — the page keeps up
    } catch (e) { console.warn('office server not reachable — running offline:', e.message); }
  }
  connect();
  function addTask(agentId, title, by = 'you') {
    if (agentTasks(agentId, 'next').length >= 5) return null;
    const t = mk({ agent: agentId, title, by });
    touch(t, 'added');
    spawnEmote(R[agentId], '📋');
    return t;
  }
  // chips: filters with live counts
  const CHIPS = [['all', 'Todas'], ['sched', 'Programadas'], ['next', 'Pendientes'], ['doing', 'En curso'], ['waiting', 'En espera'], ['done', 'Listas']];
  function chipsHTML() {
    const scope = scoped();
    const cnt = st => st === 'all' ? scope.length : st === 'sched' ? scopedRoutines().length + scope.filter(t => t.state === 'scheduled').length : scope.filter(t => t.state === st).length;
    return CHIPS.map(([st, lab]) => `<button class="tp-chip${filter === st ? ' on' : ''}${st === 'waiting' ? ' w' : ''}" data-f="${st}">${lab}<b>${cnt(st)}</b></button>`).join('');
  }
  P_.chips.addEventListener('click', (e) => { const b = e.target.closest('.tp-chip'); if (!b) return; filter = b.dataset.f; render(true); });
  function scoped() {
    const f = getFocused();
    return (f && f !== 'brain') ? tasks.filter(t => t.dept === f) : tasks;
  }
  function scopedRoutines() { const f = getFocused(); return (f && f !== 'brain') ? deptRoutines(f) : routines.slice(); }
  function metaFor(t) {
    const a = agentOf(t.agent), now = Date.now();
    const f = getFocused();
    const who = (f && f !== 'brain') ? a.name : `${a.name} · ${DEPTS[t.dept].short}`;
    switch (t.state) {
      case 'next': {
        const src = t.piece ? `team piece from ${agentOf(t.leadId)?.name || 'the lead'}` : t.routine ? `routine · ${t.when}${t.late ? ' · <span class="tp-late">late · was due ' + timeStr(t.due) + '</span>' : ''}` : t.by === 'you' ? (t.live ? 'added by you · live' : 'added by you') : t.last === 'handoff' && t.from ? `from ${agentOf(t.from).name}` : t.revised ? 'sent back to revise' : 'from the Brain';
        const w = now - t.addedAt;
        return `${who} · ${w < 60000 ? 'recién agregada' : 'en espera ' + span(w)} · ${src}${teamBit(t)}${modelBit(t)}`;
      }
      case 'doing': return `${who}${t.live ? (t.approved === undefined && t.draftAt ? ' · enviando con Claude' : t.team?.members?.length ? ' · liderando el equipo con Claude' : ' · trabajando con Claude') : t.agent === 'vid' ? ' · rendering' : t.teamHold ? ' · waiting on the pieces' : ''}${t.routine ? ' · routine' : ''}${teamBit(t)}${modelBit(t)}`;
      case 'waiting': return `<span class="tp-amber">en espera ${span(now - t.changedAt)} de tu visto bueno</span> · ${who}${t.routine ? ' · routine draft' : ''}${teamBit(t)}${modelBit(t)}`;
      case 'scheduled': return `${who} · se ejecuta ${esc(untilText(t.dueAt))} · ${new Date(t.dueAt).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} ${timeStr(t.dueAt)}${t.needsOk ? ' · en espera de tu visto bueno' : ''}${teamBit(t)}${modelBit(t)}`;
      case 'done': return `${who} · lista ${timeStr(t.doneAt)}${t.approved ? (t.live ? ' · enviada tras tu visto bueno' : ' · aprobada') : ''}${t.late ? ' · <span class="tp-late">se atrasó</span>' : ''}${teamBit(t)}${modelBit(t)}${t.live ? (t.error ? ' · <span class="tp-amber">failed</span>' : ' · <span class="tp-res">result ready →</span>') : ''}`;
    }
    return who;
  }
  function rowHTMLp(t) {
    const pct = Math.round(t.progress * 100);
    const chip = `<span class="tp-st ${t.state}">${t.state === 'doing' ? `<span data-pct="${t.id}">${pct}%</span>` : t.state === 'scheduled' ? '◷' : STATE_LABEL[t.state]}</span>`;
    const bar = t.state === 'doing' ? `<div class="tp-bar"><i data-bar="${t.id}" style="width:${pct}%"></i></div>` : t.state === 'scheduled' ? `<div class="tp-act"><button data-act="cancel">CANCELAR</button><button data-act="calendar">CALENDAR</button></div>` : '';
    return `<div class="tp-row ${t.state}${t.last === 'handoff' ? ' handoff' : ''}${t.live ? ' live' : ''}${t.piece ? ' piece' : ''}" data-id="${t.id}" data-dept="${t.dept}" data-agent="${t.agent}">
      ${chip}<div class="tp-body"><div class="tp-t">${t.routine || t.state === 'scheduled' ? '⏱ ' : ''}${t.team?.members?.length ? '⚑ ' : ''}${esc(t.title)}</div><div class="tp-m">${metaFor(t)}</div>${bar}</div>
      <span class="tp-ago" data-ago="${t.id}">${span(Date.now() - t.changedAt)}</span></div>`;
  }
  function rowHTMLr(r) { // a SCHEDULED row: the routine itself, with its countdown and its buttons
    const a = agentOf(r.agent);
    return `<div class="tp-row sched${r.paused ? ' paused' : ''}" data-id="r:${r.id}" data-rid="${r.id}" data-dept="${r.dept}" data-agent="${r.agent}">
      <span class="tp-st sched">⏱</span>
      <div class="tp-body"><div class="tp-t">${esc(r.title)}</div><div class="tp-m">${esc(r.desc)} · ${a.name} · ${modelName(r.model || officeModel)}${r.needsOk ? ' · en espera de tu visto bueno' : ' · solo lectura'}${r.lastAt ? ' · last ' + timeStr(r.lastAt) + (r.lastLate ? ' <span class="tp-late">late</span>' : '') : ''}</div>
      <div class="tp-act"><button class="run" data-act="run">EJECUTAR AHORA</button><button data-act="${r.paused ? 'resume' : 'pause'}">${r.paused ? 'REANUDAR' : 'PAUSAR'}</button><button data-act="delete">ELIMINAR</button></div></div>
      <span class="tp-ago" data-rago="${r.id}">${r.paused ? 'PAUSADA' : esc(untilText(r.nextAt))}</span></div>`;
  }
  function renderNext() { // C1: the next-up strip under the chips
    const n = nextOf(scopedRoutines());
    P_.next.hidden = !n;
    if (n) P_.next.innerHTML = `<span class="lab">PRÓXIMA ⏱</span><span class="nx">${esc(untilText(n.nextAt))}</span><span class="tt">${esc(n.title)} · ${agentOf(n.agent).name}</span>`;
  }
  function rects() {
    const m = {};
    P_.rows.querySelectorAll('.tp-row').forEach(n => { m[n.dataset.id] = n.getBoundingClientRect(); });
    return m;
  }
  function flip(before) {
    P_.rows.querySelectorAll('.tp-row').forEach(n => {
      const b = before[n.dataset.id];
      if (!b) { n.classList.add('tp-new'); return; }
      const a = n.getBoundingClientRect();
      const dy = b.top - a.top;
      if (Math.abs(dy) < 1) return;
      n.style.transition = 'none'; n.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => requestAnimationFrame(() => { n.style.transition = 'transform .65s var(--ease)'; n.style.transform = ''; }));
    });
  }
  function render(structural) {
    const f = getFocused();
    P_.scope.textContent = (f && f !== 'brain') ? DEPTS[f].name : 'WHOLE OFFICE';
    P_.chips.innerHTML = chipsHTML();
    const list = scoped().filter(t => filter === 'all' || t.state === filter)
      .sort((a, b) => b.changedAt - a.changedAt).slice(0, 60);
    const before = structural ? {} : rects();
    P_.rows.innerHTML = filter === 'sched'
      ? ((scopedRoutines().sort(byNext).map(rowHTMLr).join('') + scoped().filter(t => t.state === 'scheduled').sort((a, b) => a.dueAt - b.dueAt).map(rowHTMLp).join('')) || `<div class="tp-empty">Sin rutinas todavía. Escribe una con hora — "cada día hábil a las 8, …" — o presiona REPETIR. Presiona <b>P</b> para el calendario…${RT_DEPTS.includes(dept) ? '' : ' Rutinas: Correos, Contabilidad y Ventas en esta versión.'}</div>`)
      : (list.map(rowHTMLp).join('') || `<div class="tp-empty">Nada aquí por ahora.</div>`);
    renderNext();
    P_.rows.querySelectorAll('.tp-act button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const row = b.closest('.tp-row'); if (row.dataset.rid) rtAct(row.dataset.rid, b.dataset.act); else if (b.dataset.act === 'cancel') cancelScheduled(tasks.find(t => String(t.id) === row.dataset.id)); else if (b.dataset.act === 'calendar' && calendar) calendar.open(); }));
    P_.rows.querySelectorAll('.tp-row.waiting').forEach(n => n.addEventListener('click', () => zoomToApproval(n.dataset.dept)));
    P_.rows.querySelectorAll('.tp-row.live.done').forEach(n => n.addEventListener('click', () => openAgent && openAgent(n.dataset.agent, 'chat')));
    if (!structural) flip(before);
  }
  function refreshBars() {
    for (const t of tasks) {
      if (t.state !== 'doing') continue;
      const bar = P_.rows.querySelector(`[data-bar="${t.id}"]`);
      if (!bar) continue;
      const pct = Math.round(t.progress * 100);
      bar.style.width = pct + '%';
      const p = P_.rows.querySelector(`[data-pct="${t.id}"]`);
      if (p) p.textContent = pct + '%';
    }
  }
  function refreshAgo() {
    const now = Date.now();
    for (const t of tasks) {
      const el = P_.rows.querySelector(`[data-ago="${t.id}"]`);
      if (el) el.textContent = span(now - t.changedAt);
    }
    for (const r of routines) { const el = P_.rows.querySelector(`[data-rago="${r.id}"]`); if (el) el.textContent = r.paused ? 'PAUSADA' : untilText(r.nextAt, now); }
    renderNext();
    // waiting / backlog metas carry a duration too — cheap to re-render those lines
    P_.rows.querySelectorAll('.tp-row.waiting .tp-m, .tp-row.next .tp-m').forEach(m => {
      const t = tasks.find(x => x.id === +m.closest('.tp-row').dataset.id);
      if (t) m.innerHTML = metaFor(t);
    });
  }
  setDept('marketing');
  render(true);

  /* ---------- the company board (B) ---------- */
  const el = document.createElement('div'); el.id = 'board'; document.body.appendChild(el);
  const dim = document.createElement('div'); dim.id = 'boardDim'; document.body.appendChild(dim);
  dim.addEventListener('click', close);
  function cardHTML(t) {
    const a = agentOf(t.agent), chip = DEPTS[t.dept].chip;
    const pct = Math.round(t.progress * 100);
    const av = `<span class="tk-av" style="border-color:${chip};background:${chip}55">${a.name[0]}</span>`;
    let meta;
    if (t.state === 'done') meta = `<span class="tk-tick">✓</span><span>${a.name}</span><span class="tk-pct">${t.approved ? 'APROBADO · ' : ''}${t.modelUsed ? modelName(t.modelUsed).toUpperCase() + ' · ' : ''}${timeStr(t.doneAt)}</span>`;
    else if (t.state === 'waiting') meta = `${av}<span>${a.name}</span><span class="tk-chip">EN ESPERA ${span(Date.now() - t.changedAt).toUpperCase()}</span>`;
    else if (t.state === 'doing') meta = `${av}<span>${a.name}</span><span class="tk-pct" data-pct="${t.id}">${t.agent === 'vid' ? 'RENDERIZANDO · ' : ''}${pct}%</span>`;
    else if (t.state === 'scheduled') meta = `${av}<span>${a.name}</span><span class="tk-pct">${esc(untilText(t.dueAt).toUpperCase())}</span>`;
    else meta = `${av}<span>${a.name}</span><span class="tk-pct">${span(Date.now() - t.addedAt).toUpperCase()} EN PENDIENTES</span>`;
    return `<div class="tk ${t.state === 'scheduled' ? 'sched scheduled' : t.state}${t.revised ? ' rev' : ''}" data-id="${t.id}" data-dept="${t.dept}">
      <div class="tk-t">${t.routine || t.state === 'scheduled' ? '⏱ ' : ''}${t.team?.members?.length ? '⚑ ' : t.piece ? '↳ ' : ''}${esc(t.title)}</div><div class="tk-m">${meta}</div>
      ${t.state === 'doing' ? `<div class="tk-bar"><i data-bar="${t.id}" style="width:${pct}%"></i></div>` : ''}</div>`;
  }
  const byState = (k, st) => {
    const l = deptTasks(k, st);
    if (st === 'doing') l.sort((a, b) => b.progress - a.progress);
    else if (st === 'done') l.sort((a, b) => b.doneAt - a.doneAt);
    else l.sort((a, b) => a.id - b.id);
    return l;
  };
  function cardHTMLr(r) { // C1: a SCHEDULED card on the company board
    const a = agentOf(r.agent), chip = DEPTS[r.dept].chip;
    return `<div class="tk sched${r.paused ? ' paused' : ''}" data-rid="${r.id}" data-dept="${r.dept}"><div class="tk-t">⏱ ${esc(r.title)}</div>
      <div class="tk-m"><span class="tk-av" style="border-color:${chip};background:${chip}55">${a.name[0]}</span><span>${a.name} · ${modelName(r.model || officeModel).toUpperCase()}</span><span class="tk-pct">${r.paused ? 'PAUSADA' : esc(untilText(r.nextAt).toUpperCase())}</span></div></div>`;
  }
  const COLS = [['sched', 'PROGRAMADAS'], ['next', 'PENDIENTES'], ['doing', 'EN CURSO'], ['waiting', 'EN ESPERA DE APROBACIÓN'], ['done', 'LISTAS']];
  function companyHTML() {
    const tot = st => DEPT_KEYS.reduce((s, k) => s + deptTasks(k, st).length, 0);
    const doneAll = DEPT_KEYS.reduce((s, k) => s + doneCount[k], 0);
    return `<div class="bd-head">
        <span class="b-name"><span class="bd-title">Agents Office</span>Today's board</span>
        <span class="bd-stats"><span>PROGRAMADAS<b>${routines.length + tot('scheduled')}</b></span><span>EN CURSO<b>${tot('doing')}</b></span><span>PENDIENTES<b>${tot('next')}</b></span><span>EN ESPERA<b>${tot('waiting')}</b></span><span>LISTAS<b>${doneAll}</b></span></span></div>
      <div class="bd-lanes"><div class="lh"></div>${COLS.map(([, lab]) => `<div class="lh">${lab}</div>`).join('')}
      ${DEPT_KEYS.map(k => {
        const d = DEPTS[k], n = AGENTS.filter(a => a.dept === k).length;
        return `<div class="ld"><span><span class="dot" style="background:${d.chip}"></span>${d.short}</span><b>${n} agents</b></div>` +
          COLS.map(([st]) => {
            const list = st === 'sched' ? [...deptRoutines(k).sort(byNext), ...byState(k, 'scheduled').sort((a, b) => a.dueAt - b.dueAt)] : byState(k, st), show = list.slice(0, 2);
            return `<div class="lc">${show.map(x => x.state ? cardHTML(x) : cardHTMLr(x)).join('')}${list.length > 2 ? `<div class="more">+${list.length - 2} more</div>` : ''}</div>`;
          }).join('');
      }).join('')}</div>`;
  }
  function renderBoard() {
    if (!board.open) return;
    el.innerHTML = companyHTML();
    el.querySelectorAll('.tk.waiting').forEach(n => n.addEventListener('click', () => { close(); zoomToApproval(n.dataset.dept); }));
    el.querySelectorAll('.tk.sched').forEach(n => n.addEventListener('click', () => { close(); filter = 'sched'; openFor(n.dataset.dept); render(true); }));
  }
  function open() {
    board.open = true;
    el.className = 'company';
    renderBoard();
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!board.open) return; el.classList.add('on'); dim.classList.add('on'); })); // a close before this frame must win, or the board sits open with nothing to close it
  }
  function close() { if (!board.open) return; board.open = false; el.classList.remove('on'); dim.classList.remove('on'); }
  function toggle() { board.open ? close() : open(); }
  const isOpen = () => board.open;
  const boardWidth = () => 0; // the dept-side board is retired — the panel is the department view
  function openFor(k) { if (getFocused() !== k) enterFocus(k); }
  function onFocusChange(k) { if (board.open) close(); if (k && k !== 'brain') setDept(k); render(true); }

  /* ---------- approvals feed the WAITING state ---------- */
  function onStuck(id, ask) {
    const d = agentTasks(id, 'doing')[0];
    if (d) d.pausedAt = performance.now();
    const w = mk({ agent: id, title: ask, state: 'waiting', isAsk: true });
    touch(w, 'waiting');
  }
  function onResolve(id, approved) {
    const d = agentTasks(id, 'doing')[0];
    if (d && d.pausedAt) { d.startedAt += performance.now() - d.pausedAt; d.pausedAt = null; }
    const w = tasks.find(t => t.agent === id && t.state === 'waiting');
    if (w) {
      if (approved) { w.state = 'done'; w.approved = true; w.doneAt = Date.now(); doneCount[w.dept]++; touch(w, 'done'); prune(w.dept); }
      else { w.state = 'next'; w.revised = true; w.addedAt = Date.now(); touch(w, 'added'); }
    }
  }

  /* ---------- chat intake still works: "add task: …" in any agent's rail ---------- */
  function handleChat(agentId, text) {
    if (!live) { // demo: "every weekday at 8am, …" · "routines" (live: the server handles these, so fall through)
      const k0 = R[agentId].a.dept, a0 = R[agentId].a;
      if (/^\s*(routines?|schedule|timetable)\s*\??\s*$/i.test(text)) {
        if (!RT_DEPTS.includes(k0)) return rtRefuse(k0);
        const mine = deptRoutines(k0).sort(byNext);
        return mine.length ? `${RT_NAMES[k0]} rutinas:\n` + mine.map(r => `• ${r.title} — ${r.desc} · ${agentOf(r.agent).name}${r.paused ? ' · PAUSADA' : ''}`).join('\n') : `Nada en el horario de ${RT_NAMES[k0]} todavía. Dame una con hora — "cada día hábil a las 8, …" — y la anoto.`;
      }
      const p = parseWhen(text);
      if (p) {
        if (!RT_DEPTS.includes(k0)) return rtRefuse(k0);
        if (p.needsDay) return '¿Qué día? Dilo de nuevo con el día: "cada lunes a las 9, …".';
        if (p.needsTime) return '¿A qué hora? Dilo de nuevo con la hora, ej. "cada día hábil a las 8, …".';
        if (!p.text) return 'Tengo la hora pero no la tarea. Dilo de nuevo con lo que debe pasar.';
        const to = a0.lead ? route(k0, p.text).agent.id : agentId;
        const r = addRoutine(k0, to, p.text, p.when, guessOk(p.text));
        return `Listo. ${r.desc.charAt(0).toUpperCase() + r.desc.slice(1)}, ${to === agentId ? 'la tengo' : agentOf(to).name + ' la tiene'}. ${r.needsOk ? 'Todo lo que haya que enviar espera tu visto bueno primero.' : 'Solo lee, así que no te esperará.'} Próxima ejecución ${untilText(r.nextAt)}. Di "routines" para ver la lista.`;
      }
    }
    const m = text.match(/^\s*(?:add\s+(?:a\s+)?(?:new\s+)?task|new\s+task|task|todo)\s*[:\-–—]?\s*(.+)$/i);
    const k = R[agentId].a.dept;
    if (m) {
      let title = m[1].trim().replace(/[.!]+$/, '');
      title = title.charAt(0).toUpperCase() + title.slice(1);
      const { agent: a, matched } = route(k, title);
      const to = matched ? a.id : agentId;
      const t = addTask(to, title, 'you');
      if (!t) return `${agentOf(to).name} ya tiene cinco en cola — deja que termine una primero, o dásela a alguien más en ${DEPTS[k].short}.`;
      const busy = agentTasks(to, 'doing').length > 0;
      const who = to === agentId ? 'lo tengo' : `${agentOf(to).name} lo tiene`;
      return `Agregado a los pendientes de ${DEPTS[k].short} — ${who}, ${busy ? 'sigue después del trabajo actual' : 'empezando ahora'}. Está en el panel de tareas a la derecha.`;
    }
    if (/\b(board|what'?s next|next up|what are (you|we) (all )?(doing|working))\b/i.test(text)) {
      const list = st => byState(k, st).slice(0, 3).map(t => `• ${t.title} (${agentOf(t.agent).name})`).join('\n');
      const doing = list('doing'), next = list('next'), waiting = list('waiting');
      return `${DEPTS[k].name} ahora mismo:\n\nEN CURSO\n${doing || '—'}\n\nPENDIENTES\n${next || '—'}` +
        (waiting ? `\n\nEN ESPERA POR TI\n${waiting}` : '') + `\n\nListas hoy: ${doneCount[k]}. Di "add task: …" para poner algo en la lista.`;
    }
    return null;
  }

  /* ---------- per-frame ---------- */
  function tick(now) {
    if (!live) { const w = Date.now(); for (const r of routines) if (!r.paused && r.nextAt && r.nextAt <= w) fireDemo(r, false); // demo: this page is the clock
      for (const t of tasks) if (t.state === 'scheduled' && t.dueAt <= w) { t.state = 'next'; t.addedAt = w; touch(t, 'added'); spawnEmote(R[t.agent], '⏱'); feedPush(R[t.agent], '⏱', `Scheduled task fired: ${t.title}`); } }
    for (const id in R) {
      const r = R[id];
      if (r.state === 'stuck') continue;
      const d = agentTasks(id, 'doing')[0];
      if (d && !d.live && agentTasks(id, 'next').some(t => t.live || t.piece)) { d.progress = 1; complete(d); continue; } // real work (and a team piece) never waits behind theatre
      if (d) {
        if (d.live) {
          if (!d.running) runLive(d);
          if (d.ready) { d.progress = 1; complete(d); }
          else d.progress = Math.min(0.92, (now - (d.startedAt || now)) / 45000);
        } else if (d.teamHold) { // demo lead: the card fills as the pieces come in, finishes when the last one lands
          const ps = tasks.filter(x => x.parent === d.id);
          d.progress = ps.length ? Math.min(0.96, ps.reduce((s, p) => s + (p.state === 'done' ? 1 : p.progress || 0), 0) / ps.length) : Math.min(0.5, (now - d.startedAt) / d.dur);
          if (ps.length && ps.every(p => p.state === 'done')) { d.progress = 1; complete(d); }
        } else {
          d.progress = Math.min(1, (now - d.startedAt) / d.dur);
          if (d.progress >= 1) complete(d);
        }
      } else {
        const nx = agentTasks(id, 'next').sort((a, b) => a.addedAt - b.addedAt)[0];
        if (nx) { start(nx, now); r.nextBrainAt = null; }
        else if (!r.nextBrainAt) r.nextBrainAt = now + 6000 + Math.random() * 16000;
        else if (now > r.nextBrainAt) { r.nextBrainAt = null; if (!location.protocol.startsWith('http')) brainSend(id); } // served: an idle agent stays idle, no invented jobs
      }
    }
    if (now - lastBadge > 400) { syncBadges(); lastBadge = now; }
    if (dirty) { render(false); renderBoard(); dirty = false; }
    else {
      if (now - lastBar > 250) { refreshBars(); lastBar = now; }
      if (now - lastAgo > 15000) { refreshAgo(); lastAgo = now; }
    }
  }

  /* ---------- V3.2.1 (16 Sep 2026): the CALENDAR (P) — tasks and routines on their days; click a day to schedule ---------- */
  async function createScheduled({ dept: k, text, at, model }) { // a task for a date: live → the server routes it now and runs it then; demo → session-only
    if (!(at > Date.now())) return { ok: false, error: 'Elige una hora que aún esté por venir.' };
    if (live) {
      try {
        const r = await fetch(API + '/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: k, text, at, model: normModel(model) || undefined, team: asTeam(text) || undefined }) });
        const st = await r.json(); if (!r.ok) throw new Error(st.error || r.statusText);
        const t = mk({ agent: st.agent, title: st.title, text: st.text, plan: st.plan, why: st.why, by: 'you', live: true, sid: st.id, state: 'scheduled', dueAt: st.dueAt, needsOk: !!st.needsOk, model: st.model, modelUsed: st.model || officeModel, modelFrom: st.model ? 'task' : 'office', team: st.team ? { lead: st.team.lead, members: [] } : undefined });
        touch(t, 'scheduled'); spawnEmote(R[t.agent], '⏱'); feedPush(R[t.agent], '⏱', `Programada para ${new Date(at).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}: ${t.title}`);
        return { ok: true, task: t };
      } catch (e) { return { ok: false, error: e.message }; }
    }
    const { agent: a } = route(k, text);
    const title = (text.charAt(0).toUpperCase() + text.slice(1)).slice(0, 90);
    const t = mk({ agent: a.id, title, text, by: 'you', state: 'scheduled', dueAt: at, needsOk: guessOk(text), modelUsed: normModel(model) || officeModel, modelFrom: model ? 'task' : 'office' });
    touch(t, 'scheduled'); spawnEmote(R[a.id], '⏱'); feedPush(R[a.id], '⏱', `Programada para ${new Date(at).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}: ${title}`);
    return { ok: true, task: t };
  }
  async function createRoutineAt({ dept: k, text, when, needsOk, model }) { // a routine from a date (when.start)
    if (!RT_DEPTS.includes(k)) return { ok: false, error: rtRefuse(k) };
    if (live) {
      try {
        const r = await fetch(API + '/routines', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: k, text, when, needsOk, model: normModel(model) || undefined }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText);
        setRoutines([...routines.filter(x => x.id !== j.routine.id), j.routine]);
        const a = agentOf(j.routine.agent); spawnEmote(R[a.id], '⏱'); feedPush(R[a.id], '⏱', `New routine: ${j.routine.title} (${j.routine.desc})`);
        return { ok: true, routine: routines.find(x => x.id === j.routine.id) };
      } catch (e) { return { ok: false, error: e.message }; }
    }
    const { agent: a } = route(k, text);
    const r = addRoutine(k, a.id, text, when, needsOk); r.model = normModel(model) || undefined;
    spawnEmote(R[a.id], '⏱'); feedPush(R[a.id], '⏱', `New routine: ${r.title} (${r.desc})`);
    return { ok: true, routine: r };
  }
  async function cancelScheduled(t) {
    if (!t || t.state !== 'scheduled') return { ok: false, error: 'Ya no está programada.' };
    if (live && t.sid) { // the card leaves the screen only when the office really dropped it
      try { const r = await fetch(`${API}/tasks/${t.sid}`, { method: 'DELETE' }); if (!r.ok && r.status !== 404) throw new Error((await r.json().catch(() => ({}))).error || r.statusText); }
      catch (e) { return { ok: false, error: e.message || 'sin conexión con la oficina' }; }
    }
    tasks.splice(tasks.indexOf(t), 1); dirty = true; feedPush(R[t.agent], '✕', `Cancelada: ${t.title}`);
    return { ok: true };
  }
  // the calendar's edit and drag: move a scheduled task (at), rewrite it (text), change its model
  async function updateScheduled(t, patch) {
    if (!t || t.state !== 'scheduled') return { ok: false, error: 'Solo se edita una tarea que aún no empezó.' };
    if (patch.at !== undefined && !(patch.at > Date.now())) return { ok: false, error: 'Esa hora ya pasó — elige una que aún esté por venir.' };
    if (live && t.sid) {
      try {
        const r = await fetch(`${API}/tasks/${t.sid}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
        const st = await r.json(); if (!r.ok) throw new Error(st.error || r.statusText);
        const moved = st.agent !== t.agent;
        Object.assign(t, { title: st.title, text: st.text, dueAt: st.dueAt, needsOk: !!st.needsOk, model: st.model, modelUsed: st.model || officeModel, modelFrom: st.model ? 'task' : 'office', plan: st.plan || t.plan });
        if (moved) t.agent = st.agent;
        touch(t, 'scheduled'); dirty = true;
        feedPush(R[t.agent], '✎', `Reprogramada para ${new Date(t.dueAt).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}: ${t.title}`);
        return { ok: true, task: t };
      } catch (e) { return { ok: false, error: e.message || 'sin conexión con la oficina' }; }
    }
    if (patch.at !== undefined) t.dueAt = patch.at;
    if (patch.text) { t.text = patch.text; t.title = (patch.text.charAt(0).toUpperCase() + patch.text.slice(1)).slice(0, 90); }
    if (patch.model !== undefined) { t.model = normModel(patch.model) || undefined; t.modelUsed = t.model || officeModel; }
    touch(t, 'scheduled'); dirty = true;
    return { ok: true, task: t };
  }
  async function updateRoutine(rid, patch) {
    const r = routines.find(x => x.id === rid); if (!r) return { ok: false, error: 'Esa rutina ya no existe.' };
    if (live) {
      try {
        const res = await fetch(`${API}/routines/${encodeURIComponent(rid)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
        const j = await res.json(); if (!res.ok) throw new Error(j.error || res.statusText);
        setRoutines(j.routines); return { ok: true, routine: routines.find(x => x.id === rid) };
      } catch (e) { return { ok: false, error: e.message || 'sin conexión con la oficina' }; }
    }
    Object.assign(r, patch); if (patch.when) { r.desc = describe(r.when); r.nextAt = r.paused ? null : nextRun(r.when); }
    syncPills(); dirty = true; if (railAgent) railFor(railAgent);
    return { ok: true, routine: r };
  }
  const calendar = initCalendar({ tasks, routines, agentOf, DEPTS, DEPT_KEYS, RT_DEPTS, rtRefuse, create: createScheduled, createRoutine: createRoutineAt, cancelTask: cancelScheduled, updateTask: updateScheduled, updateRoutine, rtAct, openAgent: (id, tab) => openAgent && openAgent(id, tab), esc, isLive: () => live, officeModel: () => officeModel, MODEL_KEYS, modelName, business: () => document.title.replace(/ — Agents Office$/, ''), currentDept: () => dept });
  return { tick, toggle, open, close, openFor, isOpen, boardWidth, onFocusChange, onStuck, onResolve, calendar, createScheduled, cancelScheduled,
           handleChat, addTask, revise, rowHTML, setDept, tasks, panelWidth: () => panel.offsetWidth, isLive: () => live,
           routines, addRoutine, rtAct, railFor, syncPills, refresh: poll, resolveLive, pendingReject, rejectLive, officeModel: () => officeModel, chosenModel, chosenEffort };
}
