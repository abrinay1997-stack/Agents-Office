// DOMINIO TAREAS Y RUTINAS del conector remoto (P5, carril 2; plan MCP §14.1). Cuatro herramientas, cada una con su `accion` de lista cerrada:
//   · `tareas`   (lectura): listar, ver (con bitácora), agenda, mias, proyectos, resumen, equipo.
//   · `tareas_cambiar` (oficina): crear, editar, mover, cancelar, delegar, tomar, hecha, comentar, proyecto_nuevo, etiqueta_nueva.
//   · `rutinas`  (lectura): listar, ver.   ·  `rutinas_cambiar` (oficina): crear, horario, pausar, reanudar, saltar, no_saltar.
// Todo corre EN PROCESO con la persona del token (capa1/oficina.js) y por las MISMAS rutas de la página; cada herramienta solo puede pedir las suyas (tareas/acceso.js).
// REGLAS (decididas en la revisión de P3b): una tarea creada por MCP nace con needsOk:true y `by: 'mcp'`, y por MCP nunca se le quita el OK (ningún campo `needsOk` en los esquemas; al delegar se manda true);
// una rutina nueva espera el OK; editar una rutina existente solo cambia el horario (nunca `text`, `needsOk` ni `autonomous`) y una rutina AUTÓNOMA no se toca; no se sirve ejecutar una rutina YA, ni borrar una
// (no tiene DESHACER), ni aprobar o devolver un borrador. Lo que no se sirve está en EXCLUIDAS, con su motivo. Todo texto que un asistente escribe para otros lleva «[vía MCP]».
import { registrarHerramienta } from '../registro.js';
import { limpiarSecretos } from '../../secretos.js';
import { conIdempotencia } from '../capa1/idempotencia.js';
import { restringirRutas, ID } from '../tareas/acceso.js';
import { filtrar, pagina, fichaTarea, lineaRutina, corta, ESTADOS } from '../tareas/formato.js';
import { revisarCuando, horarioNuevo } from '../tareas/cadencia.js';

const DEPTS = ['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery'];
const PRIO = ['alta', 'media', 'baja'];
const FECHA = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;

export const ACCIONES_TAREAS = Object.freeze(['listar', 'ver', 'agenda', 'mias', 'proyectos', 'resumen', 'equipo']);
export const ACCIONES_TAREAS_CAMBIAR = Object.freeze(['crear', 'editar', 'mover', 'cancelar', 'delegar', 'tomar', 'hecha', 'comentar', 'proyecto_nuevo', 'etiqueta_nueva']);
export const ACCIONES_RUTINAS = Object.freeze(['listar', 'ver']);
export const ACCIONES_RUTINAS_CAMBIAR = Object.freeze(['crear', 'horario', 'pausar', 'reanudar', 'saltar', 'no_saltar']);

/** Lo que NO se sirve por MCP, con su motivo. El test falla si una ruta o acción de estos módulos no está servida ni aquí. */
export const EXCLUIDAS = Object.freeze({
  'POST /api/tasks/:id/approve': 'aprobar el borrador de un agente es del dueño en la oficina (regla del dinero y de los envíos).',
  'POST /api/tasks/:id/reject': 'devolver el borrador de un agente es del dueño en la oficina.',
  'POST /api/tasks/approve-batch': 'aprobar en lote es del dueño en la oficina.',
  'POST /api/tasks/:id/undo': 'deshacer una aprobación pertenece a quien aprobó, en la oficina.',
  'POST /api/tasks/:id/draft': 'editar el borrador que espera el OK es del dueño: el texto aprobado es lo que sale.',
  'POST /api/tasks/:id/run': 'ejecutar una tarea ya (puede gastar y enviar) no se hace sin una persona delante.',
  'POST /api/tasks/:id/stop': 'detener a un agente en curso se hace en la oficina.',
  'POST /api/tasks/:id/revise': 'revisar con instrucciones nuevas vuelve a poner a un agente a trabajar sin una persona delante.',
  'POST /api/tasks/:id/repeat': 'repetir una tarea hereda su `needsOk` original: podría volver a correr un agente sin OK.',
  'POST /api/tasks/:id/example': 'guardar un ejemplo enseña al agente: se decide en la oficina.',
  'POST /api/tasks/:id/vote': 'el 👍/👎 mide a un agente y un 👎 con motivo se vuelve su lección: lo decide el dueño.',
  'POST /api/tasks/:id/archive': 'archivar se hace en la oficina (queda en el historial de calidad).',
  'POST /api/tareas/:id/estado': 'se sirve solo «hecha» de lo del dueño (op mia_hecha); el resto de estados no se mueve por MCP.',
  'POST /api/tareas/lote': 'los cambios en lote se hacen de uno en uno por MCP (cada uno con su clave y su auditoría).',
  'POST /api/tareas/borrador': 'es de los agentes (crear_borrador_tarea), no de una persona.',
  'POST /api/tareas/sugerir': 'es de los agentes (sugerir_al_dueno), no de una persona.',
  'DELETE /api/tareas/proyectos/:id': 'borrar un proyecto no es de MCP: solo se crean.',
  'DELETE /api/tareas/etiquetas/:id': 'borrar una etiqueta no es de MCP: solo se crean.',
  'DELETE /api/routines/:id': 'borrar una rutina no tiene DESHACER: se hace en la oficina.',
  'POST /api/routines/:id/run': 'ejecutar una rutina YA pone a un agente a trabajar sin una persona delante (se retoma con el paso humano).',
  'POST /api/routines/fabrica': 'añadir las rutinas de fábrica es del administrador en la oficina.',
});
/** Las rutas /api/ que este dominio cubre (para el test de cobertura de la P6). */
export const RUTAS = Object.freeze([
  'GET /api/tasks', 'GET /api/tareas/:id', 'GET /api/tareas/:id/bitacora', 'GET /api/tareas/agenda', 'GET /api/tareas/mias', 'GET /api/tareas/catalogo', 'GET /api/tareas/resumen', 'GET /api/team', 'GET /api/agents', 'GET /api/routines',
  'POST /api/tasks', 'POST /api/tareas/mias', 'POST /api/tareas/:id/organizar', 'POST /api/tareas/:id/delegar', 'POST /api/tareas/:id/tomar', 'POST /api/tasks/:id/comment', 'POST /api/tareas/proyectos', 'POST /api/tareas/etiquetas',
  'POST /api/oficina/accion', 'POST /api/routines', 'PATCH /api/routines/:id', 'POST /api/routines/:id/pause', 'POST /api/routines/:id/resume', 'POST /api/routines/:id/skip', 'POST /api/routines/:id/unskip',
]);
const LECTURAS = ['GET'];
const PERMITIDAS = Object.freeze({
  tareas: LECTURAS, rutinas: LECTURAS,
  tareas_cambiar: ['GET', 'POST /api/tasks', 'POST /api/tareas/mias', 'POST /api/tareas/:id/organizar', 'POST /api/tareas/:id/delegar', 'POST /api/tareas/:id/tomar', 'POST /api/tasks/:id/comment',
    'POST /api/tareas/proyectos', 'POST /api/tareas/etiquetas', 'POST /api/oficina/accion'],
  rutinas_cambiar: ['GET', 'POST /api/routines', 'PATCH /api/routines/:id', 'POST /api/routines/:id/pause', 'POST /api/routines/:id/resume', 'POST /api/routines/:id/skip', 'POST /api/routines/:id/unskip'],
});
const MCP = '[vía MCP] ';
/** El texto de una tarea o rutina se marca al FINAL: el título sale de la primera línea y no debe ser la marca. */
const marcada = (t) => `${String(t).trim()}\n\n[vía MCP]`;
class Falta extends Error {}
const falta = (m) => { throw new Falta(m); };
const idDe = (a) => (ID.test(String(a.id || '')) ? String(a.id) : falta('falta el `id` (el de la tarea o la rutina; mira `tareas` · listar).'));
const idem = (ctx, herramienta, fn) => conIdempotencia(ctx.db, { conexionId: ctx.conexion.id, herramienta, clave: ctx.claveIdempotencia, ms: ctx.ahoraMs, fn });

/** Un fallo esperado se vuelve texto claro; lo inesperado, además, se registra. Nunca lleva un secreto. */
function fallo(nombre, e) {
  if (!(e instanceof Falta)) console.error(`[mcp:tareas] ${nombre}:`, e?.message ?? e);
  return { texto: `No se pudo: ${limpiarSecretos(String(e?.message || e)).replace(/\s+/g, ' ').slice(0, 300)}`, esError: true };
}
async function conOficina(ctx, herramienta) {
  const { crearOficinaMcp } = await import('../capa1/oficina.js');
  return restringirRutas(await crearOficinaMcp({ env: ctx.env, db: ctx.db, usuario: ctx.usuario, ahoraMs: ctx.ahoraMs }), PERMITIDAS[herramienta]);
}
/** La tarea que crea un asistente nace con la marca `by: 'mcp'` (el servidor no la admite en el cuerpo): se apunta después, sobre la fila, y SE COMPRUEBA. → null si quedó marcada, o el aviso. */
async function marcarOrigen(db, id) {
  const aviso = `ATENCIÓN: la tarea ${id} se creó pero NO pude marcarla como creada por el conector; avísale al dueño para que la revise.`;
  if (!id) return aviso;
  try { const r = await db.prepare("update filas set json = json_set(json, '$.by', 'mcp') where coleccion = 'tareas' and id = ?").bind(String(id)).run(); return r?.meta?.changes === 0 ? aviso : null; }
  catch (e) { console.warn('[mcp:tareas] no se pudo marcar el origen:', e?.message ?? e); return aviso; }
}
/** Un texto ya hecho + el aviso de marca, si lo hay (un fallo de marca es un error CLARO, sin tirar la llamada: la tarea ya existe y repetir la duplicaría). */
const conMarca = (texto, aviso) => (aviso ? { texto: `${texto}\n${aviso}`, esError: true } : texto);
/** Rechaza si la tarea espera el OK del dueño: un borrador de agente no sale de Aprobaciones por MCP. */
async function sinOkPendiente(office, id) {
  const t = (await office(`/api/tareas/${id}`))?.tarea;
  if (!t) falta('esa tarea no existe.');
  if (t.state === 'waiting' || t.approving) falta('esa tarea espera el visto bueno del dueño: un borrador de un agente no sale de Aprobaciones por este conector (se decide en la oficina).');
}
const limpio = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const fechaOk = (v, que) => (v === undefined || v === null || (typeof v === 'string' && FECHA.test(v)) ? v : falta(`${que} va como AAAA-MM-DD (y la hora, si quieres, THH:MM).`));

/** Las personas a las que se puede asignar (cuentas y Ajustes → Equipo). → { nombres, yo } */
async function personas(office) { const r = await office('/api/team'); return { nombres: (r.people || []).map((p) => p.name), yo: r.yo?.nombre || null }; }
async function personaValida(office, nombre) {
  const { nombres } = await personas(office), k = String(nombre).trim().toLowerCase(), ok = nombres.find((n) => String(n).toLowerCase() === k);
  return ok || falta(`«${String(nombre).slice(0, 60)}» no es una persona de la oficina. Las que hay: ${nombres.join(', ') || '(ninguna)'}.`);
}
async function agenteValido(office, id, dept) {
  const r = await office('/api/agents'), a = (r.agents || []).find((x) => x.id === id);
  if (!a) falta(`«${String(id).slice(0, 40)}» no es un agente de la oficina.`);
  if (dept && a.department !== dept) falta(`«${id}» es del departamento ${a.department}, no de ${dept}.`);
  return a;
}

/* ---------- lectura de tareas ---------- */
async function leerTareas(office, a) {
  switch (a.accion) {
    case 'listar': return pagina(filtrar(await office('/api/tasks?light=1'), { estado: a.estado, dept: a.dept, agente: a.agente, quien: a.quien, texto: a.texto, archivadas: a.archivadas === true }), a.cursor);
    case 'ver': { const id = idDe(a); const [r, b] = await Promise.all([office(`/api/tareas/${id}`), office(`/api/tareas/${id}/bitacora`).catch(() => ({ lineas: [] }))]); return { texto: fichaTarea(r, b.lineas) }; }
    case 'agenda': { const q = new URLSearchParams(limpio({ dias: a.dias ? String(a.dias) : undefined, agente: a.agente, dept: a.dept })).toString(); return { texto: corta(String((await office(`/api/tareas/agenda${q ? '?' + q : ''}`)).texto || '(sin agenda)')) }; }
    case 'mias': return { texto: corta(String((await office('/api/tareas/mias')).texto || '(sin tareas tuyas)')) };
    case 'proyectos': { const c = await office('/api/tareas/catalogo'); return { texto: corta(`Proyectos:\n${(c.proyectos || []).map((p) => `${p.id} «${p.nombre}» [${p.estado || ''}]${p.progreso ? ` ${JSON.stringify(p.progreso).slice(0,
      80)}` : ''}`).join('\n') || '(ninguno)'}\nEtiquetas: ${(c.etiquetas || []).map((e) => `${e.id} (${e.nombre})`).join(', ') || '(ninguna)'}`) }; }
    case 'resumen': return { texto: JSON.stringify(await office(`/api/tareas/resumen${a.dias ? '?dias=' + Math.max(7, Math.min(180, +a.dias || 30)) : ''}`)).slice(0, 8000) };
    case 'equipo': { const { nombres, yo } = await personas(office); return { texto: `Personas a las que se puede asignar trabajo: ${nombres.join(', ') || '(ninguna)'}${yo ? `\nTe escribe: ${yo}` : ''}` }; }
    default: return falta('esa acción no existe.');
  }
}

/* ---------- cambios de tareas ---------- */
const OP = { mover: 'tarea_mover', cancelar: 'tarea_cancelar', hecha: 'mia_hecha' };
async function porOp(office, a) {
  const op = { type: OP[a.accion], id: idDe(a) };
  if (a.accion === 'mover') op.at = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(a.at || '')) ? a.at : falta('«mover» pide `at` como AAAA-MM-DDTHH:MM.');
  const r = await office('/api/oficina/accion', { op });
  return `Hecho: ${r.hecho}.${r.deshacer ? ` Para deshacerlo: la herramienta \`deshacer\` con la clave ${r.deshacer} (hasta ${String(r.hasta).slice(11, 16)} UTC).` : ` ${r.aviso || ''}`}`.trim();
}
async function cambiarTareas(ctx, office, a) {
  switch (a.accion) {
    case 'crear': {
      const nota = String(a.texto || '').trim(), titulo = String(a.titulo || '').trim();
      if (!titulo && !nota) falta('di qué hay que hacer (`titulo` y/o `texto`).');
      if (a.agente && !a.dept) falta('un `agente` pide también su `dept` (su departamento).');
      fechaOk(a.limite, 'El límite');
      const campos = limpio({ prioridad: a.prioridad, limite: a.limite || undefined, etiquetas: a.etiquetas, proyecto: a.proyecto });
      if (a.dept && !a.persona) { // trabajo para un AGENTE: pide el OK siempre, y nace marcada
        if (a.agente) await agenteValido(office, a.agente, a.dept);
        const t = await office('/api/tasks', { dept: a.dept, text: marcada(titulo && nota ? `${titulo}. ${nota}` : nota || titulo), ...(titulo ? { title: titulo } : {}), ...(a.agente ? { agent: a.agente } : {}), needsOk: true, ...campos });
        const av = await marcarOrigen(ctx.db, t.id);
        return conMarca(`Tarea creada: ${t.id} «${t.title}» para ${t.agent} (${t.dept}), ya en la cola. Si su trabajo envía, publica o paga algo, ESPERA el OK del dueño (siempre, desde aquí).`, av);
      }
      const persona = a.persona && String(a.persona).toLowerCase() !== 'yo' ? await personaValida(office, a.persona) : undefined; // para una persona, o para mí
      const r = await office('/api/tareas/mias', { title: titulo || nota.split('\n')[0].slice(0, 90), ...(nota && titulo ? { notas: MCP + nota } : {}), ...(persona ? { persona } : {}), ...(a.dept ? { dept: a.dept } : {}), ...campos });
      const av = await marcarOrigen(ctx.db, r.tarea?.id);
      return conMarca(`Tarea creada: ${r.tarea.id} «${r.tarea.title}» ${persona ? `para ${persona}` : 'en tu lista'}${r.tarea.limite ? `, límite ${String(r.tarea.limite).replace('T', ' ')}` : ''}.`, av);
    }
    case 'editar': {
      const id = idDe(a); fechaOk(a.limite, 'El límite');
      const cuerpo = limpio({ prioridad: a.prioridad, etiquetas: a.etiquetas, limite: a.limite, proyecto: a.proyecto, estimacion: a.estimacion });
      if (!Object.keys(cuerpo).length) falta('no hay nada que cambiar: pasa `prioridad`, `etiquetas`, `limite`, `proyecto` o `estimacion`.');
      const r = await office(`/api/tareas/${id}/organizar`, cuerpo);
      return `Cambiada: ${r.tarea.id} «${r.tarea.title}» (${Object.keys(cuerpo).join(', ')}).`;
    }
    case 'mover': case 'cancelar': case 'hecha': return porOp(office, a);
    case 'delegar': {
      const id = idDe(a); await sinOkPendiente(office, id);
      const nota = a.nota ? MCP + String(a.nota).slice(0, 560) : undefined;
      if (a.persona) { const persona = await personaValida(office, a.persona); const r = await office(`/api/tareas/${id}/delegar`, limpio({ a: 'persona', persona, nota })); return `Delegada a ${r.a}: ${r.tarea.id} «${r.tarea.title}».`; }
      if (!a.dept) falta('«delegar» pide `persona`, o `dept` (y, si quieres, `agente`).');
      if (a.agente) await agenteValido(office, a.agente, a.dept);
      const r = await office(`/api/tareas/${id}/delegar`, limpio({ a: 'agente', dept: a.dept, agente: a.agente, nota, needsOk: true })); // el OK nunca se quita por MCP
      return `Delegada a ${r.a} (${r.como}): ${r.tarea.id} «${r.tarea.title}». Pide el OK del dueño antes de enviar nada.`;
    }
    case 'tomar': { await sinOkPendiente(office, idDe(a)); const r = await office(`/api/tareas/${idDe(a)}/tomar`, limpio({ nota: a.nota ? MCP + String(a.nota).slice(0, 560) : undefined })); return `Ahora es tuya: ${r.tarea.id} «${r.tarea.title}».`; }
    case 'comentar': {
      const t = String(a.texto || '').trim(); if (!t) falta('el comentario está vacío (`texto`).');
      const r = await office(`/api/tasks/${idDe(a)}/comment`, { text: MCP + t.slice(0, 1900) });
      return `Comentario añadido (${(r.comments || []).length} en la tarea).`;
    }
    case 'proyecto_nuevo': { const n = String(a.nombre || '').trim(); if (!n) falta('falta el `nombre` del proyecto.'); const r = await office('/api/tareas/proyectos', { nombre: n }); return `Proyecto creado: ${r.proyecto.id} «${r.proyecto.nombre}».`; }
    case 'etiqueta_nueva': { const n = String(a.nombre || '').trim(); if (!n) falta('falta el `nombre` de la etiqueta.'); const r = await office('/api/tareas/etiquetas', { nombre: n }); return `${r.existia ? 'Ya existía' : 'Etiqueta creada'}: ${r.etiqueta.id} (${r.etiqueta.nombre}).`; }
    default: return falta('esa acción no existe.');
  }
}

/* ---------- rutinas ---------- */
async function rutinaDe(office, id) { const r = (await office('/api/routines')).routines || []; return r.find((x) => x.id === id) || falta('esa rutina no existe: mira `rutinas` · listar.'); }
async function leerRutinas(office, a) {
  const l = (await office('/api/routines')).routines || [];
  if (a.accion === 'ver') { const r = l.find((x) => x.id === idDe(a)) || falta('esa rutina no existe.'); return { texto: `${lineaRutina(r)}\nTexto: ${String(r.text || '').slice(0, 1200)}` }; }
  const f = l.filter((r) => (!a.dept || r.dept === a.dept) && (a.pausadas === undefined || !!r.paused === a.pausadas)), desde = Math.max(0, parseInt(a.cursor, 10) || 0), trozo = f.slice(desde, desde + 30);
  return { texto: `${f.length} rutinas${desde ? ` (desde la ${desde + 1})` : ''}:\n${trozo.map(lineaRutina).join('\n') || '(ninguna)'}`, siguiente: desde + 30 < f.length ? String(desde + 30) : undefined };
}
async function cambiarRutinas(office, a) {
  if (a.accion === 'crear') {
    if (!DEPTS.includes(a.dept) || !String(a.texto || '').trim() || !a.cuando) falta('«crear» pide `dept`, `texto` y `cuando` (el horario).');
    const mal = revisarCuando(a.cuando); if (mal) falta(mal);
    const r = await office('/api/routines', { dept: a.dept, text: marcada(String(a.texto).trim().slice(0, 3900)), when: a.cuando, ...(a.agente ? { agent: a.agente } : {}), needsOk: true }); // espera el OK siempre
    return `Rutina creada: ${r.routine?.id ?? '?'} «${r.routine?.title ?? ''}». Cada vez que corra, su resultado espera el OK del dueño.`;
  }
  const id = idDe(a), r = await rutinaDe(office, id);
  if (r.autonomous === true) falta('esa rutina es autónoma (envía sola): no se toca desde aquí, solo el dueño en la oficina.');
  if (a.accion === 'horario') { // solo el horario: ni `text`, ni `needsOk`, ni `autonomous`; y nunca más a menudo que el actual
    if (r.needsOk === false) falta('esa rutina no pide el OK del dueño (solo lee o trabaja libre): su horario lo cambia el dueño en la oficina.');
    const h = horarioNuevo(r.when, a.cuando); if (h.error) falta(h.error);
    await office(`/api/routines/${id}`, { when: h.when }, 'PATCH'); return `Horario cambiado: ${id}.`;
  }
  if (a.accion === 'reanudar' && (a.confirmado !== true || r.needsOk === false)) falta('reanudar una rutina que alguien pausó pide `confirmado: true` (solo si el dueño lo pidió con esas palabras) y no vale para una rutina sin OK.');
  if (a.accion === 'pausar' || a.accion === 'reanudar') { await office(`/api/routines/${id}/${a.accion === 'pausar' ? 'pause' : 'resume'}`, {}); return `${a.accion === 'pausar' ? 'Pausada' : 'Reanudada'}: ${id}.`; }
  const ms = Date.parse(String(a.at || '')); if (!(ms > 0)) falta('«saltar» pide `at`: la hora de esa ejecución (ISO, con zona: la que da `rutinas` · ver como «próxima»).');
  await office(`/api/routines/${id}/${a.accion === 'saltar' ? 'skip' : 'unskip'}`, { at: ms }); return `${a.accion === 'saltar' ? 'Esa ejecución se salta' : 'Esa ejecución vuelve'}: ${id}.`;
}

/* ---------- el registro ---------- */
const cursor = { type: 'string', maxLength: 200, description: 'La página que sigue (el `siguiente` de la respuesta anterior).' };
const comun = { id: { type: 'string', pattern: '^[A-Za-z0-9_-]{3,40}$', description: 'El id de la tarea o la rutina.' }, dept: { type: 'string', enum: DEPTS }, agente: { type: 'string', maxLength: 40, description: 'El id de un agente de ese departamento.' } };
const cuando = { type: 'object', additionalProperties: false, description: 'Horario: {kind:daily|weekdays|weekly|monthly|hourly (hourly pide every≥1, from y to; ' +
    'como mucho una vez por hora), at:"HH:MM", days:[0-6] (0=domingo), day:1..31|-1, nth/weekday, every, from, to, weekdaysOnly, start/end:"AAAA-MM-DD", count}.',
  properties: { kind: { type: 'string', enum: ['daily', 'weekdays', 'weekly', 'monthly', 'hourly'] }, at: { type: 'string' }, days: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, maxItems: 7 }, day: { type: 'integer', minimum: -1, maximum: 31 },
    nth: { type: 'integer', minimum: -1, maximum: 5 }, weekday: { type: 'integer', minimum: 0, maximum: 6 }, every: { type: 'integer', minimum: 1, maximum: 1440 }, from: { type: 'string' }, to: { type: 'string' }, weekdaysOnly: { type: 'boolean' },
    start: { type: 'string' }, end: { type: 'string' }, count: { type: 'integer', minimum: 1, maximum: 1000 } }, required: ['kind'] };

function definir({ nombre, descripcion, props, lee, destructiva, ejecutar }) {
  registrarHerramienta({
    nombre, descripcion, alcance: lee ? 'lectura' : 'oficina', soloLectura: lee, ...(lee ? {} : { destructiva: !!destructiva, idempotente: false }),
    esquema: { type: 'object', additionalProperties: false, properties: props, required: ['accion'] },
    ejecutar: async (ctx, args) => {
      try {
        const office = await conOficina(ctx, nombre), hacer = async () => { const r = await ejecutar(ctx, office, args); return typeof r === 'string' ? { texto: r } : r; };
        return lee ? await hacer() : await idem(ctx, nombre, hacer);
      } catch (e) { return fallo(nombre, e); }
    },
  });
}

definir({
  nombre: 'tareas', lee: true, ejecutar: (_c, office, a) => leerTareas(office, a),
  descripcion: 'Lee las TAREAS de la oficina (las de los agentes y las de las personas). `accion`: listar (filtros estado/dept/agente/quien/texto; por páginas), ver (una tarea con sus pasos, comentarios y bitácora; pide `id`), agenda (lo que viene: `dias`, `dept`, `agente`), '
    + 'mias (la lista de quien conecta), proyectos (y etiquetas), resumen (cifras de los últimos `dias`), equipo (las personas a las que se puede asignar). Solo lee.',
  props: { accion: { type: 'string', enum: [...ACCIONES_TAREAS] }, id: comun.id, estado: { type: 'string', enum: ESTADOS }, dept: comun.dept, agente: comun.agente, quien: { type: 'string', maxLength: 80, description: 'Una persona, o «yo».' },
    texto: { type: 'string', maxLength: 80 }, archivadas: { type: 'boolean' }, dias: { type: 'integer', minimum: 1, maximum: 180 }, cursor },
});
definir({
  nombre: 'tareas_cambiar', lee: false, destructiva: true, ejecutar: (c, office, a) => cambiarTareas(c, office, a),
  descripcion: 'Cambia TAREAS. `accion`: crear (con `dept` → trabajo para un agente, que SIEMPRE pide el OK del dueño; con `persona` o sin `dept` → una tarea para esa persona o para quien conecta; `titulo`/`texto`, `prioridad`, `limite`, `etiquetas`, `proyecto`), '
    + 'editar (`id` + prioridad/etiquetas/limite/proyecto/estimacion), mover (`id`, `at` AAAA-MM-DDTHH:MM: la de un agente que no empezó), cancelar (`id`: la de un agente que no empezó; se puede deshacer), delegar (`id` + `persona`, o `dept` y `agente`), '
    + 'tomar (`id`: «lo hago yo»), hecha (`id`: una tuya), comentar (`id`, `texto`), proyecto_nuevo y etiqueta_nueva (`nombre`). Nunca aprueba, devuelve ni quita el OK de nada. Mover, cancelar y hecha dan una clave para la herramienta `deshacer`.',
  props: { accion: { type: 'string', enum: [...ACCIONES_TAREAS_CAMBIAR] }, id: comun.id, titulo: { type: 'string', maxLength: 90 }, texto: { type: 'string', maxLength: 2000 }, dept: comun.dept, agente: comun.agente,
    persona: { type: 'string', maxLength: 80, description: 'Una persona de la oficina (mira `tareas` · equipo), o «yo».' }, nota: { type: 'string', maxLength: 560 }, at: { type: 'string', description: 'AAAA-MM-DDTHH:MM' },
    limite: { type: ['string', 'null'], description: 'AAAA-MM-DD[THH:MM], o null para quitarlo.' }, prioridad: { type: 'string', enum: PRIO }, etiquetas: { type: 'array', items: { type: 'string', maxLength: 40 }, maxItems: 10 },
    proyecto: { type: ['string', 'null'], maxLength: 60 }, estimacion: { type: ['integer', 'null'], minimum: 1, maximum: 43200, description: 'Minutos.' }, nombre: { type: 'string', maxLength: 60 } },
});
definir({
  nombre: 'rutinas', lee: true, ejecutar: (_c, office, a) => leerRutinas(office, a),
  descripcion: 'Lee las RUTINAS (tareas con horario propio). `accion`: listar (por `dept`, `pausadas`; con su próxima y su última ejecución) o ver (`id`: con su texto). Solo lee.',
  props: { accion: { type: 'string', enum: [...ACCIONES_RUTINAS] }, id: comun.id, dept: comun.dept, pausadas: { type: 'boolean' }, cursor },
});
definir({
  nombre: 'rutinas_cambiar', lee: false, destructiva: true, ejecutar: (_c, office, a) => cambiarRutinas(office, a),
  descripcion: 'Cambia RUTINAS. `accion`: crear (`dept`, `texto`, `cuando`, `agente?`: SIEMPRE espera el OK del dueño), horario (`id`, `cuando`: es lo ÚNICO que se edita y nunca corre más a menudo que antes), pausar y reanudar (`id`; reanudar pide `confirmado: true`), '
    + 'saltar y no_saltar (`id`, `at`: una ejecución concreta). No ejecuta una rutina ya, no borra rutinas y no toca una rutina autónoma.',
  props: { accion: { type: 'string', enum: [...ACCIONES_RUTINAS_CAMBIAR] }, id: comun.id, dept: comun.dept, texto: { type: 'string', maxLength: 3900 }, cuando, agente: comun.agente, at: { type: 'string', description: 'ISO de la ejecución.' }, confirmado: { type: 'boolean',
    description: 'Solo para reanudar: true si el dueño pidió reanudarla.' } },
});
