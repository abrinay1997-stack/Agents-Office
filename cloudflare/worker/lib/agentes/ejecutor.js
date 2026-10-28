// El EJECUTOR de tareas en la nube: serve.mjs → runServerTask + run + askX, pero un Worker no puede esperar minutos ni lanzar `claude`.
//
//  · Una tarea que arranca (la cola de la fase 3: tomarSiguiente) o a la que el dueño aprueba o devuelve se vuelve una CORRIDA (tabla `corridas`).
//  · Cada minuto el reloj AVANZA las corridas por PASOS: un paso son varias vueltas del bucle (modelo → herramientas → modelo…) hasta que se acaba el presupuesto de la
//    invocación (llamadas externas y consultas a D1); el avance (mensajes, lo leído, el taint de inyección) se guarda en D1 y la siguiente invocación sigue donde quedó.
//  · NUNCA dos pasos de la misma tarea a la vez: el candado es compare-and-set sobre (candado, candado_hasta) y caduca solo si el Worker muere a medias.
//  · Cada llamada a una herramienta pasa por el guardián (guardian.js → safety.mjs): un envío sin el OK del dueño no se ejecuta. El gasto en un motor de pago, tampoco.
//  · Al terminar se hace lo mismo que la local: revisión del jefe, «pasar a una persona», bloqueos, borrador que espera el OK, nota en el Cerebro, costos, sinapsis que aprenden.
import * as safety from '../../../../safety.mjs';
import * as approvals from '../../../../approvals.mjs';
import * as reliability from '../../../../reliability.mjs';
import * as memory from '../../../../memory.mjs';
import * as costsCore from '../../../../costs-core.mjs';
import { HANDOFF, needsReview, reviewPrompt, parseJSON, clasificarCorreccion } from '../../../../agente-core.mjs';
import { askLine } from '../../../../routines-core.mjs';
import { pendientes as bloqueosPendientes } from '../../../../tareas/dependencias.mjs';
import { conSesion, cargarTareas } from '../tareas/sesion.js';
import { leerContexto } from '../tareas/contexto.js';
import { crearGuardian, informe as informeGuardian } from './guardian.js';
import { crearClienteMcp } from './mcp-cliente.js';
import { secretoPermitido, AVISO_SECRETO } from '../conectores.js';
import { elegirModelo, modeloPorId, llamarModelo, aliasDeHerramienta, textoDe, usosDe } from './llm.js';
import { leerModelos } from '../modelos.js';
import { conectoresActivos } from '../conectores-acceso.js';
import { capazDe, sirvePara, delAjuste } from '../../../../modelos-core.mjs';
import { herramientasInternas, OMITIDAS } from './herramientas.js';
import { leerConfig as leerConfigAnuncios } from '../anuncios-nube.js';
import { armarEjecucion, leerMemoria, guardarMemoria } from './contexto.js';
import { cargarBibliotecaNube } from '../biblioteca.js';
import { anotar as anotarCosto, estadoDelMes } from './costos.js';
import { draftFacts, huellaDe, registrar as registrarAprobacion } from './aprobaciones.js';
import { registrarLeccion } from './lecciones.js';
import { sha256 } from '../ids.js';

export const TTL_CANDADO = 5 * 60_000;       // un paso que muere a medias libera su candado a los 5 minutos
export const VUELTAS_POR_PASO = 8;           // vueltas del modelo en una invocación
export const VUELTAS_MAX = 30;               // vueltas de todo el trabajo: pasado esto, se entrega lo que haya
export const TOKENS_TURNO = 8000;            // lo que el modelo puede escribir en UN turno (razonamiento + llamadas a herramientas + texto). Con 4000, «dame 5 ideas» (5 borradores en un turno) se cortaba siempre
export const TOKENS_TURNO_ALTO = 16000;      // si un turno se corta, ese mismo turno se repite UNA vez con este límite (sin gastar un reintento de la tarea)
export const MAX_RESULTADO = 6000;           // lo que se guarda de lo que devolvió una herramienta
export const MAX_DATOS = 1_500_000;          // D1 corta una fila a 2 MB
const RESERVA = { llamadas: 3, consultas: 14 };

const clonar = x => JSON.parse(JSON.stringify(x));
class PerdiElCandado extends Error { constructor() { super('perdí el candado de la corrida'); this.perdido = true; } }
class FalloFatal extends Error { constructor(m) { super(m); this.fatal = true; } }

/** Una tarea que habla de Meta o de anuncios pero cae en un agente SIN las herramientas de Anuncios (no es de Marketing): se lo dice, para que pase la tarea a quien las tiene en lugar de pedirle al dueño «un conector de Meta que conectar» (caso real: Líder Operaciones, 27 oct 2026). */
function notaDeAnuncios(internas, task) {
  return internas.omitidas.includes(OMITIDAS.anuncios) && /meta\b|anuncio|publicidad|campa[ñn]a|\bads?\b/i.test(`${task.title || ''}\n${task.text || ''}`) ? `\n\nNOTE ABOUT YOUR TOOLS: ${OMITIDAS.anuncios}` : '';
}

/** Lo que el dueño lee cuando un turno no cabe ni con el límite alto: qué pasó y qué hacer, con lo que había dentro (para saber si se fue en razonamiento o en llamadas a herramientas). < 400 letras: es lo que guarda la tarea. */
export function mensajeDeCorte(resp, limite) {
  const n = tipo => (resp?.content || []).filter(b => b.type === tipo).length;
  const salida = Number(resp?.usage?.output_tokens) || limite;
  return `El modelo se quedó sin espacio para responder: escribió ${salida} tokens (razonamiento: ${n('thinking') + n('redacted_thinking')} bloques, llamadas a herramientas: ${n('tool_use')}, texto: ${n('text')}) y se cortó antes de terminar. Pídele menos cosas a la vez (una publicación por tarea, por ejemplo) o elige otro modelo en Ajustes → Modelos.`;
}

/* ---------- las corridas ---------- */

/** El modo con que corre una tarea que arranca sola: el OK pendiente (draft), la rutina que ganó su autonomía, o una tarea normal. */
export const modoInicial = t => (t.needsOk ? 'draft' : t.autonomous ? 'autonomous' : 'task');

/** Crea la corrida de una tarea (una sola: si ya hay una, no hace nada). → true si nació. */
export async function crearCorrida(db, tarea, { modo, feedback = null, origen = null, huella = null }, ahora = Date.now()) {
  const run = Math.random().toString(36).slice(2, 10) + ahora.toString(36);
  const r = await db.prepare('insert or ignore into corridas (tarea, run, modo, feedback, estado, candado, candado_hasta, paso, datos, creada, actualizada) values (?,?,?,?,?,?,?,?,?,?,?)')
    .bind(tarea.id, run, modo, feedback, 'cola', null, 0, 0, JSON.stringify({ origen, ...(huella ? { huella } : {}) }), ahora, ahora).run();
  return (r.meta?.changes ?? 0) === 1;
}
export async function corridasVivas(db) { return (await db.prepare('select tarea, run, modo, estado, candado_hasta, paso, actualizada from corridas order by creada').all()).results; }
export async function borrarCorrida(db, tarea) { await db.prepare('delete from corridas where tarea = ?').bind(tarea).run(); }

async function tomarCandado(db, tarea, ahora) {
  const token = Math.random().toString(36).slice(2) + ahora.toString(36);
  const r = await db.prepare("update corridas set candado = ?, candado_hasta = ?, estado = 'corriendo', actualizada = ? where tarea = ? and (candado is null or candado_hasta < ?)").bind(token, ahora + TTL_CANDADO, ahora, tarea, ahora).run();
  return (r.meta?.changes ?? 0) === 1 ? token : null;
}
async function guardarAvance(db, tarea, token, datos, ahora, { estado = 'corriendo', soltar = false } = {}) {
  const j = JSON.stringify(datos);
  if (j.length > MAX_DATOS) throw new FalloFatal('La conversación del agente creció más de lo que cabe en la base: se corta aquí.');
  const r = await db.prepare('update corridas set datos = ?, paso = paso + 1, estado = ?, candado = ?, candado_hasta = ?, actualizada = ? where tarea = ? and candado = ?')
    .bind(j, soltar ? 'pausada' : estado, soltar ? null : token, soltar ? 0 : ahora + TTL_CANDADO, ahora, tarea, token).run();
  if ((r.meta?.changes ?? 0) !== 1) throw new PerdiElCandado();
}

async function verificarCandado(db, tarea, token) { // si detuvieron la tarea mientras se terminaba, no se escribe nada
  const f = await db.prepare('select 1 x from corridas where tarea = ? and candado = ?').bind(tarea, token).first();
  if (!f) throw new PerdiElCandado();
}

/* ---------- avisos y apuntes sueltos ---------- */
async function avisar(db, aviso, ahora = Date.now()) { // lo que serve.mjs hace con notice(): el mismo problema se dice una vez cada 6 horas
  if (aviso.key) { const ya = await db.prepare("select 1 x from filas where coleccion = 'avisos' and orden > ? and json_extract(json,'$.key') = ?").bind(ahora - 6 * 3600e3, aviso.key).first(); if (ya) return; }
  const id = `${ahora.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  await db.prepare('insert into filas (coleccion, id, json, orden, actualizado) values (?,?,?,?,?) on conflict (coleccion, id) do nothing').bind('avisos', id, JSON.stringify({ id, t: ahora, read: false, level: 'info', task: null, key: null, ...aviso }), ahora, new Date(ahora).toISOString()).run();
}

async function escribirNota(db, task, C, ahora) { // writeNote: el entregable se vuelve una nota del Cerebro, enlazada a lo que leyó
  const a = C.agents.find(x => x.id === task.agent);
  const dia = new Date(task.doneAt).toLocaleDateString('en-CA'); // AAAA-MM-DD en la zona de la oficina
  const slug = String(task.title).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const base = `${dia} ${slug}`; let nombre = base;
  for (let n = 2; n < 40; n++) { // la misma tarea otra vez (un «revise») conserva su nota; otra con el mismo título ese día toma «-2»
    const f = await db.prepare('select tarea from notas where nombre = ?').bind(nombre).first();
    if (!f || f.tarea === task.id) break; nombre = `${base}-${n}`;
  }
  const cuerpo = `---\nagent: ${a.name}\ndepartment: ${C.depts[a.department].name}\ntask: ${task.id}\ndone: ${new Date(task.doneAt).toISOString()}${task.used?.length ? '\ntools: ' + task.used.join(', ') : ''}${task.skills?.length ? '\nskills: ' + task.skills.join(', ') : ''}${task.routine ? '\nroutine: ' + task.when + (task.late ? ' (late)' : '') : ''}${task.modelUsed ? '\nmodel: ' + task.modelUsed : ''}${task.approved ? '\napproved: ' + new Date(task.approvedAt).toISOString() : ''}\n---\n` +
    `# ${task.title}\n\n${task.result}\n\n---\nRead: ${(task.read || []).map(n => `[[${n}]]`).join(' · ') || '—'}\n`;
  await db.prepare(`insert into notas (nombre, grupo, oficina, texto, bytes, actualizado, tarea) values (?,?,?,?,?,?,?)
    on conflict (nombre) do update set grupo=excluded.grupo, oficina=excluded.oficina, texto=excluded.texto, bytes=excluded.bytes, actualizado=excluded.actualizado, tarea=excluded.tarea`)
    .bind(nombre, 'Agents Office', 1, cuerpo, new TextEncoder().encode(cuerpo).length, ahora, task.id).run();
  return nombre;
}

async function aprender(db, task) { // learnFrom: lo que se leyó enseña al Cerebro según cómo le fue al trabajo
  if (!task || !task.read?.length || task.piece || (task.error && !task.stopped)) return;
  const mem = await leerMemoria(db);
  memory.reinforce(mem, { id: task.id, r: memory.outcome(task), cited: memory.cited(task.result, task.read), read: task.read });
  await guardarMemoria(db, mem);
}

/* ---------- lo que corre en un paso ---------- */

/** Las herramientas que se le dan al modelo: las internas y las de los conectores remotos de su departamento (allowlist; las de envío solo si esta ejecución puede enviar). */
async function armarHerramientas({ db, env, agente, tarea, modo, writes, gasto, quien, modulos, presupuesto, fetchFn, deptsEstudio, deptsContenido, deptsAnuncios, C }) {
  const habilidades = (await cargarBibliotecaNube({ env, db, agentes: C.agents })).b.de(agente).length > 0; // solo el puesto que tiene habilidades recibe las dos herramientas de la Biblioteca
  const internas = herramientasInternas({ env, db, agente, tarea: tarea.id, modulos, gasto, quien, deptsEstudio, deptsContenido, deptsAnuncios, habilidades });
  const defs = internas.defs.map(d => ({ nombre: d.nombre, servidor: d.servidor, descripcion: d.descripcion, esquema: d.esquema, remota: false }));
  const remotas = [];
  const conectores = await conectoresActivos(db, env);
  for (const c of conectores) {
    if (!JSON.parse(c.departamentos || '[]').includes(agente.department)) continue;
    if (c.secreto && !secretoPermitido(c.secreto)) { remotas.push({ servidor: c.nombre, motivo: AVISO_SECRETO(c.secreto) }); continue; }
    if (c.secreto && !env[c.secreto]) { remotas.push({ servidor: c.nombre, motivo: `falta el secreto ${c.secreto}` }); continue; }
    if (!c.secreto && c.auth_tipo && c.auth_tipo !== 'ninguna' && !c._token) { remotas.push({ servidor: c.nombre, motivo: c.token_cifrado ? 'su token guardado ya no se puede abrir (cambió AO_CLAVE_CIFRADO): ponlo otra vez en Ajustes → Conectores MCP' : 'falta su token (Ajustes → Conectores MCP)' }); continue; }
    const permitidas = new Set([...JSON.parse(c.herramientas_lectura || '[]'), ...(writes ? JSON.parse(c.herramientas_envio || '[]') : [])]);
    if (!permitidas.size) continue;
    try {
      const cli = crearClienteMcp({ conector: c, env, fetchFn, presupuesto });
      const lista = await cli.listar();
      for (const x of lista.excluidas || []) remotas.push({ servidor: c.nombre, motivo: `«${x.name}» se dejó fuera: ${x.motivo}` });
      for (const t of lista) if (permitidas.has(t.name)) defs.push({ nombre: `mcp__${c.nombre}__${t.name}`, servidor: c.nombre, original: t.name, descripcion: t.description, esquema: t.inputSchema, remota: true });
    } catch (e) { remotas.push({ servidor: c.nombre, motivo: String(e.message).slice(0, 200) }); }
  }
  return { internas, defs, fallos: remotas };
}

/** Ejecuta una llamada a una herramienta, con el guardián delante y detrás. → { texto, esError } */
async function ejecutarHerramienta({ uso, def, guardian, internas, clientes, db, env, fetchFn, presupuesto, conectoresPorNombre, antes = null }) {
  const entrada = uso.input && typeof uso.input === 'object' ? uso.input : {};
  const d = await guardian.antes(def.nombre, entrada);
  if (!d.allow) return { texto: d.why, esError: true, bloqueada: true };
  if (antes) await antes(d.kind, def.nombre); // «detener» y el apunte previo de lo que cuesta o envía: si se perdió el candado, esto lanza y la herramienta NO corre
  let texto, esError = false;
  try {
    if (def.remota) {
      let cli = clientes.get(def.servidor);
      if (!cli) { cli = crearClienteMcp({ conector: conectoresPorNombre.get(def.servidor), env, fetchFn, presupuesto }); clientes.set(def.servidor, cli); }
      const r = await cli.llamar(def.original, entrada); texto = r.texto; esError = r.esError;
    } else texto = await internas.llamar(def.nombre, entrada);
  } catch (e) { texto = 'No se pudo: ' + String(e?.message || 'falló').slice(0, 300); esError = true; }
  const aviso = await guardian.despues(def.nombre, entrada, texto);
  texto = String(texto).slice(0, MAX_RESULTADO) + (aviso ? '\n\n' + aviso : '');
  return { texto, esError, kind: d.kind };
}

/* ---------- el paso ---------- */

/**
 * Avanza UNA corrida lo que el presupuesto deje. deps: { env, db, presupuesto, modulos, fetchFn, ahora, deptsEstudio, deptsContenido }
 * → { tarea, estado: 'ocupada'|'sin-tarea'|'pausada'|'terminada'|'reintento'|'fallo'|'perdida' }
 */
export async function avanzar(deps, tareaId) {
  const { db, ahora: reloj = () => Date.now() } = deps;
  const t0 = reloj();
  const fila = await db.prepare('select * from corridas where tarea = ?').bind(tareaId).first();
  if (!fila) return { tarea: tareaId, estado: 'sin-corrida' };
  const token = await tomarCandado(db, tareaId, t0);
  if (!token) return { tarea: tareaId, estado: 'ocupada' };
  const viva = await db.prepare('select * from corridas where tarea = ? and candado = ?').bind(tareaId, token).first(); // releer YA con el candado: la lectura de antes pudo quedar vieja (otro paso terminó en medio)
  if (!viva) return { tarea: tareaId, estado: 'perdida' };
  Object.assign(fila, viva);
  let task = null, datos = JSON.parse(viva.datos || '{}');
  try {
    const lista = await cargarTareas(db);
    task = lista.find(t => t.id === tareaId) || null;
    if (!task || task.state !== 'doing') { await borrarCorrida(db, tareaId); return { tarea: tareaId, estado: 'sin-tarea' }; } // la detuvieron, la archivaron o ya no es suya
    const r = await trabajar(deps, { fila, token, datos, task, lista });
    return { tarea: tareaId, ...r };
  } catch (e) {
    if (e?.perdido) return { tarea: tareaId, estado: 'perdida' }; // alguien (detener, borrar) se llevó la corrida mientras trabajaba: no se toca la tarea
    try { return { tarea: tareaId, ...(await fallar(deps, { fila, token, datos, task, error: e })) }; }
    catch (e2) { if (e2?.perdido) return { tarea: tareaId, estado: 'perdida' }; throw e2; }
  }
}

async function trabajar(deps, { fila, token, datos, task, lista }) {
  const { env, db, presupuesto, modulos, fetchFn, ahora: reloj = () => Date.now() } = deps;
  const C = await leerContexto(db), aj = C.ajustes;
  const agente = C.agents.find(a => a.id === task.agent);
  if (!agente) throw new FalloFatal('El agente de esta tarea ya no existe en el roster.');
  const modo = fila.modo, aprobada = modo === 'approve' || modo === 'autonomous';
  const pol = safety.modeFor(aj.safety, agente.department);
  const writes = safety.writesAllowed(pol, modo) && aprobada; // en la nube, solo una ejecución APROBADA (por un administrador) o autónoma gana el derecho a enviar
  const gasto = aprobada && pol !== 'nunca';
  const apr = approvals.config(aj.approvals);

  // --- paso 0: el sistema, el pedido, las herramientas ---
  if (!datos.sistema) {
    if (modo === 'approve') { // el OK vale para el borrador que el dueño vio: si ya no es ese, no se envía nada y la tarea vuelve a esperar su visto bueno
      const h = await huellaDe(task);
      if (!datos.huella || datos.huella !== h || task.approving) return anularAprobacion(deps, { task, datos, fila });
      datos.aprobado = String(task.draft || task.result || '');
      datos.textoDeAdmin = task.textoAdmin && task.textoAdmin === await sha256(String(task.text || '')) ? String(task.text) : ''; // el texto amplía los destinatarios solo si sigue siendo EXACTAMENTE el que escribió un administrador
    }
    const modelos = await leerModelos(db);
    let modelo = elegirModelo({ task, agent: agente, env, cfgModelo: aj.model, modelos });
    const deptsContenido = Array.isArray(aj.contenido?.departments) && aj.contenido.departments.length ? aj.contenido.departments : undefined;
    const deptsEstudio = Array.isArray(aj.media?.departments) && aj.media.departments.length ? aj.media.departments : undefined;
    const cfgAnuncios = await leerConfigAnuncios(db).catch(() => ({})); // `anuncios.departments` vive en config / config-local / anuncios.ajustes (la migración), no en los Ajustes de la página: lo lee quien lo lee el módulo de Anuncios
    const deptsAnuncios = Array.isArray(cfgAnuncios.anuncios?.departments) && cfgAnuncios.anuncios.departments.length ? cfgAnuncios.anuncios.departments : undefined;
    const quien = [...(task.approvals || [])].reverse().find(x => x.action === 'approve')?.by || null;
    const h = await armarHerramientas({ db, env, agente, tarea: task, modo, writes, gasto, quien, modulos, presupuesto, fetchFn, deptsEstudio, deptsContenido, deptsAnuncios, C });
    // Un modelo sin herramientas (Muse) NO falla en silencio: si el agente tiene conectores a su alcance, la tarea cae a un modelo capaz y la entrega lo dice; si no hay uno, se rechaza con el motivo.
    let avisoModelo = '';
    if (h.defs.some(d => d.remota) && !sirvePara({ herramientas: modelo.caps.herramientas }, { herramientas: true }).ok) {
      const capaz = capazDe(modelos, { tieneAnthropic: !!env.ANTHROPIC_API_KEY });
      if (!capaz) throw new FalloFatal(`El modelo ${modelo.id} no usa herramientas y este agente necesita sus conectores. Elige un modelo de Claude para este agente en Ajustes → Modelos (y guarda ANTHROPIC_API_KEY).`);
      avisoModelo = `ℹ Esta tarea necesitaba los conectores del agente y ${modelo.id} no usa herramientas: la hizo ${capaz.id}. Cámbialo en Ajustes → Modelos si prefieres otra cosa.`;
      modelo = modeloPorId(capaz.id, modelos, 'caída por falta de herramientas');
    } else if (modelo.meta && h.defs.length) avisoModelo = `ℹ ${modelo.id} no usa herramientas: esta tarea se redactó sin ellas.`;
    const e = await armarEjecucion({ db, env, C, agente, tarea: task, modo, feedback: fila.feedback, tareas: lista, tieneContenido: h.defs.some(d => d.servidor === 'contenido'), tieneEstudio: h.defs.some(d => d.servidor === 'estudio'), tieneHabilidades: h.defs.some(d => d.servidor === 'habilidades'), ahora: reloj() });
    Object.assign(datos, {
      base: clonar(task), sistema: e.sistema + notaDeAnuncios(h.internas, task), usuario: e.usuario, leidas: e.leidas, modelo: { id: modelo.id, meta: modelo.meta, pick: modelo.pick }, avisoModelo,
      herramientas: modelo.meta ? [] : h.defs, fallosConectores: h.fallos, omitidas: h.internas.omitidas, mensajes: [{ role: 'user', content: e.usuario }],
      usd: 0, vueltas: 0, usadas: [], skills: [], texto: '', ctx: { deptsEstudio, deptsContenido, deptsAnuncios, quien, writes, gasto },
    });
    await guardarAvance(db, task.id, token, datos, reloj());
  }
  const ctxEj = datos.ctx || {};
  const internas = herramientasInternas({ env, db, agente, tarea: task.id, modulos, gasto: !!ctxEj.gasto, quien: ctxEj.quien, deptsEstudio: ctxEj.deptsEstudio, deptsContenido: ctxEj.deptsContenido, deptsAnuncios: ctxEj.deptsAnuncios, habilidades: datos.herramientas.some(d => d.servidor === 'habilidades') });
  const conectores = await conectoresActivos(db, env);
  const conectoresPorNombre = new Map(conectores.map(c => [c.nombre, c])), clientes = new Map();
  const servers = [...new Set(datos.herramientas.map(d => d.servidor))];
  const guardian = crearGuardian({ db, estado: datos, ahora: reloj, ctx: { run: fila.run, tarea: task.id, agente: agente.id, dept: agente.department, writes: !!ctxEj.writes, runMode: modo, policy: pol, known: modo === 'approve' ? `${datos.textoDeAdmin ?? ''}\n${datos.aprobado ?? ''}` : null, safety: aj.safety || {}, amountLimit: apr.amountLimit, servers } });
  const usados = new Set(), porAlias = new Map();
  const herramientasApi = datos.herramientas.map(d => { const alias = aliasDeHerramienta(d.nombre, usados); porAlias.set(alias, d); return { alias, descripcion: d.descripcion, esquema: d.esquema }; });
  const modelo = datos.modelo;

  // --- las vueltas ---
  let vueltas = 0;
  while (true) {
    if (!presupuesto.puedeSeguir(RESERVA)) { await guardarAvance(db, task.id, token, datos, reloj(), { soltar: true }); return { estado: 'pausada', motivo: 'presupuesto de la invocación' }; }
    if (vueltas >= VUELTAS_POR_PASO) { await guardarAvance(db, task.id, token, datos, reloj(), { soltar: true }); return { estado: 'pausada', motivo: 'siguen las vueltas en el próximo minuto' }; }
    // 1) las herramientas que el modelo pidió y todavía no corrieron (un paso anterior se cortó a la mitad del turno)
    if (datos.turno) {
      for (const uso of datos.turno.usos) {
        const previa = datos.turno.hechos[uso.id];
        if (previa && !previa.pendiente) continue;
        if (previa?.pendiente) { // A2: se anotó que iba a salir y el paso se cortó antes de saber cómo acabó: NUNCA se repite (podría ser un correo duplicado). Falla cerrado.
          datos.turno.hechos[uso.id] = { texto: `No se sabe si «${previa.tool || uso.name}» llegó a salir (el paso se cortó justo después de pedirla). NO la repitas: revisa en el servicio de destino (p. ej. los enviados) y dilo en tu entrega.`, esError: true, incierta: true };
          (datos.inciertos ||= []).push({ tool: previa.tool || uso.name, at: reloj() });
          continue;
        }
        if (!presupuesto.puedeSeguir({ llamadas: 2, consultas: 6 })) { await guardarAvance(db, task.id, token, datos, reloj(), { soltar: true }); return { estado: 'pausada', motivo: 'presupuesto de la invocación' }; }
        const def = porAlias.get(uso.name);
        let costosa = false;
        const antes = async kind => {
          await verificarCandado(db, task.id, token); // A1: si detuvieron la tarea mientras el turno corría, ninguna herramienta que envía o gasta arranca
          if (kind === 'write' || (kind === 'cost' && ctxEj.gasto)) { // A2: se apunta ANTES de ejecutar (y se renueva el candado): si el paso muere en medio, al retomar se sabe que esta llamada pudo salir
            costosa = true;
            const antesEnv = [...(datos.envios || [])];
            datos.turno.hechos[uso.id] = { pendiente: true, tool: def.nombre };
            if (kind === 'write' && !(datos.envios ||= []).includes(def.nombre)) datos.envios.push(def.nombre); // «SE ENVIÓ» solo cuenta envíos de verdad, no un gasto en el Estudio
            try { await guardarAvance(db, task.id, token, datos, reloj()); }
            catch (e) { delete datos.turno.hechos[uso.id]; datos.envios = antesEnv; throw e; } // si no se pudo apuntar, la herramienta NO corre y no se dice que salió
          }
        };
        const r = def ? await ejecutarHerramienta({ uso, def, guardian, internas, clientes, db, env, fetchFn, presupuesto, conectoresPorNombre, antes }) : { texto: `La herramienta «${uso.name}» no existe en esta ejecución.`, esError: true };
        if (def && !datos.usadas.includes(def.nombre)) datos.usadas.push(def.nombre);
        datos.turno.hechos[uso.id] = { texto: r.texto, esError: r.esError };
        if (costosa) await guardarAvance(db, task.id, token, datos, reloj()); // ya se sabe cómo acabó: se apunta enseguida
      }
      datos.mensajes.push({ role: 'user', content: datos.turno.usos.map(u => ({ type: 'tool_result', tool_use_id: u.id, content: datos.turno.hechos[u.id].texto, ...(datos.turno.hechos[u.id].esError ? { is_error: true } : {}) })) });
      delete datos.turno;
      await guardarAvance(db, task.id, token, datos, reloj());
      continue;
    }
    // 2) una vuelta del modelo
    if (datos.vueltas >= VUELTAS_MAX) { datos.texto = datos.texto || 'Se llegó al máximo de vueltas sin una entrega final.'; break; }
    const t1 = reloj();
    const limite = datos.maxTokens || TOKENS_TURNO;
    const resp = await llamarModelo({ env, modelo, sistema: datos.sistema, mensajes: datos.mensajes, herramientas: herramientasApi, maxTokens: limite, fetchFn, presupuesto });
    await verificarCandado(db, task.id, token); // A1: si la detuvieron mientras el modelo pensaba, no se sigue
    datos.vueltas++; vueltas++;
    datos.usd += await anotarCosto(db, { tarea: task.id, agente: agente.id, dept: agente.department, tipo: modo, modelo: resp.model, proveedor: modelo.meta ? 'meta' : 'anthropic', usage: resp.usage, cfgPrices: aj.costs?.prices, ms: reloj() - t1 });
    if (resp.stop_reason === 'max_tokens') { // el turno se llenó antes de terminar: lo escrito no se guarda en la conversación (una llamada a herramienta cortada no se puede contestar) y NUNCA se ejecuta
      if (limite < TOKENS_TURNO_ALTO) { datos.maxTokens = TOKENS_TURNO_ALTO; await guardarAvance(db, task.id, token, datos, reloj()); continue; } // el mismo turno, con más espacio; no gasta un reintento de la tarea (repetir con el mismo límite fallaba siempre igual)
      const parcial = textoDe(resp.content);
      if (parcial && !usosDe(resp.content).length) { datos.texto = `${parcial}\n\n⚠ La respuesta se cortó por el límite de longitud del modelo (${limite} tokens): puede faltarle el final.`; break; }
      throw new FalloFatal(mensajeDeCorte(resp, limite)); // repetirla costaría igual y fallaría igual: se dice la verdad y no se reintenta
    }
    delete datos.maxTokens; // el límite alto es solo para repetir el turno cortado: los siguientes vuelven al normal (se guarda con el próximo avance)
    datos.mensajes.push({ role: 'assistant', content: resp.content });
    const usos = usosDe(resp.content);
    if (usos.length && resp.stop_reason === 'tool_use' && !modelo.meta) { datos.turno = { usos: usos.map(u => ({ id: u.id, name: u.name, input: u.input })), hechos: {} }; await guardarAvance(db, task.id, token, datos, reloj()); continue; }
    datos.texto = textoDe(resp.content);
    break;
  }
  return finalizar(deps, { fila, token, datos, task, C, agente, aj, apr, modo, pol });
}

/* ---------- el final: runServerTask, después de run() ---------- */
async function finalizar(deps, { fila, token, datos, task, C, agente, aj, apr, modo, pol }) {
  const { env, db, presupuesto, fetchFn, ahora: reloj = () => Date.now() } = deps;
  const aprobar = modo === 'approve', feedback = fila.feedback;
  await verificarCandado(db, task.id, token);
  let texto = String(datos.texto || '').trim();
  if (!texto) throw new Error('Claude returned nothing');
  // D5: en lo delicado el jefe revisa y el agente corrige UNA vez antes de que llegue al dueño
  const vista = { ...task, id: task.id };
  if (!aprobar && !feedback && !datos.revisado && needsReview(vista, texto, { agent: agente, cfgReview: aj.quality?.review, amountLimit: apr.amountLimit })) {
    datos.revisado = true;
    const lead = C.lider(task.dept);
    if (lead && presupuesto.puedeSeguir({ llamadas: 3, consultas: 10 })) {
      const { system, user } = reviewPrompt({ task, lead, agent: agente, deptName: C.depts[task.dept].name, negocio: C.nombre, result: texto });
      try {
        const t1 = reloj();
        const modelosRev = await leerModelos(db), delJefe = delAjuste(modelosRev, { funcion: 'revision' }), mRev = delJefe ? modeloPorId(delJefe.id, modelosRev, delJefe.de) : datos.modelo; // el jefe puede revisar con otro modelo (Ajustes → Modelos → Revisión del jefe)
        const resp = await llamarModelo({ env, modelo: { id: mRev.id, meta: mRev.meta }, sistema: system, mensajes: [{ role: 'user', content: user }], maxTokens: 700, fetchFn, presupuesto });
        datos.usd += await anotarCosto(db, { tarea: task.id, agente: lead.id, dept: task.dept, tipo: 'revision', modelo: resp.model, proveedor: mRev.meta ? 'meta' : 'anthropic', usage: resp.usage, cfgPrices: aj.costs?.prices, ms: reloj() - t1 });
        const j = parseJSON(textoDe(resp.content));
        datos.review = { ok: !!j.ok, fixes: Array.isArray(j.fixes) ? j.fixes.slice(0, 5).map(String) : [], by: lead.id, at: reloj() };
      } catch (e) { datos.review = null; }
      if (datos.review && !datos.review.ok && datos.review.fixes.length) { // el agente corrige lo que el jefe marcó: otra corrida de trabajo desde su texto
        const aviso = `Revisión de ${C.nombreAgente(datos.review.by)} (tu jefe) antes de mostrarlo al dueño:\n- ${datos.review.fixes.join('\n- ')}`;
        const e = await armarEjecucion({ db, env, C, agente, tarea: { ...task, result: texto }, modo, feedback: aviso, tareas: [], tieneContenido: datos.herramientas.some(d => d.servidor === 'contenido'), tieneEstudio: datos.herramientas.some(d => d.servidor === 'estudio'), tieneHabilidades: datos.herramientas.some(d => d.servidor === 'habilidades'), ahora: reloj() });
        Object.assign(datos, { sistema: e.sistema, usuario: e.usuario, mensajes: [{ role: 'user', content: e.usuario }], texto: '', turno: undefined, vueltas: 0 });
        await guardarAvance(db, task.id, token, datos, reloj(), { soltar: true });
        return { estado: 'pausada', motivo: 'el jefe pidió correcciones' };
      }
    }
  }
  // --- la tarea, como la deja runServerTask ---
  const ahora = reloj(), out = { result: texto + (datos.avisoModelo && !aprobar ? `\n\n---\n${datos.avisoModelo}` : ''), usd: datos.usd, read: datos.leidas, tools: [...new Set(datos.usadas.map(n => n.split('__')[1]).filter(Boolean))], used: datos.usadas, skills: [], modelUsed: datos.modelo.pick?.model, modelFrom: datos.modelo.pick?.from, modelId: datos.modelo.id };
  const base = datos.base, mio = clonar(task); mio.startedAt = mio.startedAt || ahora;
  let resultado;
  await conSesion(db, {}, async s => {
    const enDisco = s.alm.load().find(t => t.id === task.id);
    const m = clonar(mio);
    const costo = () => { m.cost = Math.round(((m.cost || 0) + (out.usd || 0)) * 1e6) / 1e6; };
    const comunes = () => Object.assign(m, { read: out.read, tools: out.tools, used: out.used, modelUsed: out.modelUsed });
    const marcarIncierto = () => { // A2: una llamada que enviaba pudo salir sin que se sepa: queda dicho en la entrega, en un aviso y en la tarea, salga la tarea por donde salga
      if (!datos.inciertos?.length) return;
      const lista = [...new Set(datos.inciertos.map(x => x.tool))].join(', ');
      m.result += `\n\n---\n⚠ REVISA A MANO: no se sabe si salió ${lista} (el paso se cortó justo después de pedirla y la oficina no la repite para no duplicarla).`;
      m.revisarEnvio = { tools: [...new Set(datos.inciertos.map(x => x.tool))], at: ahora };
      s.avisar('envio-incierto', `«${m.title}»: no se sabe si salió ${lista}. Revísalo a mano antes de repetir nada.`, { level: 'error', task: m.id });
    };
    if (!aprobar && enDisco?.pidioBloqueo?.at >= m.startedAt && bloqueosPendientes(s.alm.load(), enDisco).length) { // T3: el agente pidió un bloqueo: se para con lo que lleva y sigue sola
      Object.assign(m, { state: 'next', result: out.result, partial: out.result, bloqueadaPor: enDisco.bloqueadaPor, pidioBloqueo: enDisco.pidioBloqueo, addedAt: ahora }); costo(); comunes(); delete m.tomadaPor; delete m.corrida; delete m.approving;
      marcarIncierto(); s.alm.guardarEjecucion(base, m, { por: 'agente:' + task.agent }); resultado = { estado: 'bloqueada' }; return;
    }
    if (aprobar) { m.result = (m.draft || m.result) + '\n\n---\nAFTER YOUR OK\n' + out.result; m.approved = true; m.approvedAt = ahora; } else m.result = out.result;
    marcarIncierto();
    delete m.retryAt; delete m.lastError; delete m.partial;
    if (!aprobar && HANDOFF.test(out.result || '')) { // I6: el agente pide a una persona
      const persona = (C.personas.find(p => !p.soloCuenta && (!p.depts?.length || p.depts.includes(m.dept))) || {}).name || 'Tú'; // (una cuenta de la plataforma solo recibe lo que se le asigna a ella)
      m.handoff = { at: ahora, from: m.agent, why: out.result.replace(HANDOFF, '').split('\n').slice(0, 3).join(' ').slice(0, 300) };
      Object.assign(m, { person: persona, result: out.result.replace(HANDOFF, ''), state: 'next', needsOk: false, addedAt: ahora, deAgente: m.agent }); comunes(); costo(); delete m.tomadaPor; delete m.corrida; delete m.approving;
      marcarIncierto(); s.alm.guardarEjecucion(base, m, { por: 'agente:' + task.agent });
      s.avisar('handoff', `${C.nombreAgente(m.agent)} pasa «${m.title}» a ${persona}: ${m.handoff.why}`, { task: m.id }); resultado = { estado: 'persona' }; return;
    }
    costo(); if (feedback) m.revisions = (m.revisions || 0) + 1;
    const g = informeGuardian(datos, aprobar, ahora);
    if (g) m.guard = g; else if (!m.trigger) delete m.guard;
    const quiso = (datos.bloqueos || []).some(b => b.code === 'no-writes' || b.code === 'amount'); // A3: bajo «aprobar», lo que intentó enviar sin el OK no se pierde: espera el OK con su borrador
    if (!aprobar && !m.needsOk && quiso && !datos.taint && pol !== 'nunca') { m.needsOk = true; m.heldForOk = true; }
    comunes(); m.tools = [...new Set([...(task.tools || []), ...out.tools])]; m.used = [...new Set([...(task.used || []), ...out.used])]; m.error = false; m.modelFrom = out.modelFrom; m.modelId = out.modelId;
    if (datos.review) m.review = datos.review;
    delete m.tomadaPor; delete m.corrida; delete m.approving;
    if (m.needsOk && !aprobar) { Object.assign(m, { state: 'waiting', draft: m.result, waitingAt: ahora, ask: askLine(m) }); delete m.editedDraft; delete m.remindedAt; draftFacts(m, apr); resultado = { estado: 'espera-ok' }; }
    else { Object.assign(m, { state: 'done', doneAt: ahora }); resultado = { estado: 'hecha', terminada: true }; }
    s.alm.guardarEjecucion(base, m, { por: 'agente:' + task.agent });
    if (resultado.terminada) resultado.final = m;
    if (m.state === 'waiting') s.avisar('espera-ok', `«${m.title}» está lista y espera tu visto bueno.`, { task: m.id });
  });
  if (resultado.final) { // lo que se hace solo con una tarea terminada
    const f = resultado.final;
    try { f.note = await escribirNota(db, f, C, ahora); await conSesion(db, {}, async s => { s.alm.cambiar(f.id, t => { t.note = f.note; }, { por: 'oficina' }); }); } catch (e) { console.error('[agentes] nota:', e?.message); }
    try { await aprender(db, f); } catch (e) { console.error('[agentes] memoria:', e?.message); }
  }
  // Un «devuelve» con su corrección enseña al agente (classify + lección); un aviso de presupuesto si se cruzó
  if (feedback && ['reject', 'revise'].includes(datos.origen)) {
    try {
      const v = await clasificarCorreccion(async (sistema, usuario) => textoDe((await llamarModelo({ env, modelo: { id: datos.modelo.id, meta: datos.modelo.meta }, sistema, mensajes: [{ role: 'user', content: usuario }], maxTokens: 200, fetchFn, presupuesto })).content), agente, task, feedback);
      await registrarLeccion(db, agente, task, feedback, v);
    } catch (e) { console.warn('[agentes] lección:', e?.message); }
  }
  try {
    const b = await estadoDelMes(db, aj.costs, ahora);
    if (b.level === 'over' || b.level === 'alert') await avisar(db, { kind: 'budget', level: b.level === 'over' ? 'error' : 'warn', key: `budget-${b.month}-${b.level}`, text: b.level === 'over' ? `Se llegó al presupuesto del mes: US$${b.spent.toFixed(2)} de US$${b.budget.toFixed(2)}.${costsCore.config(aj.costs).stopAtBudget ? ' Las tareas nuevas esperan hasta que subas el presupuesto o empiece el mes.' : ''}` : `Van US$${b.spent.toFixed(2)} de US$${b.budget.toFixed(2)} del presupuesto del mes (${Math.round(b.ratio * 100)} %).` }, ahora);
  } catch { /* un aviso no tumba una entrega */ }
  await borrarCorrida(db, task.id);
  return { estado: resultado.estado, resultado: resultado.estado };
}

/** El OK ya no vale (el borrador cambió): no corre nada, la tarea vuelve a esperar el visto bueno del dueño con el borrador nuevo. */
async function anularAprobacion(deps, { task, datos, fila }) {
  const { db } = deps;
  await conSesion(db, {}, async s => {
    s.alm.cambiar(task.id, x => { if (x.state !== 'doing') return false; delete x.corrida; delete x.tomadaPor; delete x.approving; Object.assign(x, { state: 'waiting', waitingAt: x.waitingAt || Date.now() }); }, { por: 'oficina' });
    await registrarAprobacion(db, s, task.id, 'void', 'la oficina', { note: 'El borrador cambió después de tu visto bueno: se descartó el OK y no se envió nada.' });
    s.avisar('approval-void', `«${task.title}» cambió después de tu visto bueno: no se envió nada. Revisa el borrador y vuelve a aprobarlo.`, { level: 'warn', task: task.id });
  });
  await borrarCorrida(db, task.id);
  return { estado: 'anulada', motivo: 'el borrador cambió después del OK' };
}

/* ---------- cuando algo falla: reintento o fallo definitivo (runServerTask → catch) ---------- */
async function fallar(deps, { fila, token, datos, task, error }) {
  const { db, ahora: reloj = () => Date.now() } = deps;
  const C = await leerContexto(db), aj = C.ajustes;
  const ahora = reloj(), msg = String(error?.message || 'falló').replace(/\s+/g, ' ').slice(0, 400);
  if (!task) { await borrarCorrida(db, fila.tarea); return { estado: 'fallo' }; }
  const parcial = (datos.texto || '').trim();
  const paso = error?.fatal ? { retry: false, kind: 'fatal' } : reliability.nextStep({ ...task }, msg, aj.retries, ahora);
  const base = datos.base || task, m = clonar(task);
  const envios = Array.isArray(datos.envios) ? datos.envios : [];
  let estado;
  await conSesion(db, {}, async s => {
    delete m.tomadaPor; delete m.corrida; delete m.approving;
    if (envios.length) { // A3: ya salió algo (un envío, un gasto) con el OK del dueño: nada se reintenta ni vuelve a pedir otro OK; se cierra diciendo qué salió y qué falló después
      const lista = [...new Set(envios.map(n => n.split('__').pop() || n))].join(', ');
      const aprobada = fila.modo === 'approve';
      const duda = datos.inciertos?.length ? `\n⚠ REVISA A MANO: no se sabe si salió ${[...new Set(datos.inciertos.map(x => x.tool))].join(', ')}.` : '';
      m.result = `${aprobada ? (m.draft || m.result || '') : ''}${aprobada ? '\n\n---\nAFTER YOUR OK\n' : ''}${parcial ? parcial + '\n\n' : ''}SE ENVIÓ: ${lista}; falló después: ${msg}${duda}`.trim();
      Object.assign(m, { state: 'done', doneAt: ahora, failedAfterSend: { tools: envios, error: msg, at: ahora }, ...(aprobada ? { approved: true, approvedAt: ahora } : {}) });
      delete m.retryAt; delete m.lastError; delete m.partial;
      s.avisar('failed', `«${m.title}»: ya se hizo ${lista}, pero falló después: ${msg.slice(0, 160)}. No se reintenta (se duplicaría).`, { level: 'error', task: m.id });
      estado = 'fallo-tras-envio';
      s.alm.guardarEjecucion(base, m, { por: 'agente:' + task.agent });
      return;
    }
    if (paso.retry) {
      Object.assign(m, { state: 'next', attempts: paso.attempt, retryAt: paso.at, lastError: msg, lastErrorKind: paso.kind, timeoutMul: paso.timeoutMul, partial: parcial || m.partial });
      if (paso.kind === 'limit') s.avisar('limit', `El proveedor de IA llegó a su límite de uso. «${m.title}» se reintenta sola a las ${new Date(paso.at).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}.`, { level: 'warn', task: m.id, key: 'limit' });
      estado = 'reintento';
    } else {
      const porque = paso.kind === 'login' ? 'El proveedor de IA rechazó la clave. Revisa el secreto en Cloudflare y pulsa Reintentar.' : paso.kind === 'limit' ? 'Se alcanzó el límite de uso del proveedor de IA y ya no quedan reintentos. Pulsa Reintentar cuando se renueve.' : 'Could not complete this task: ' + msg;
      Object.assign(m, { state: 'done', doneAt: ahora, result: parcial ? `${parcial}\n\n---\n⚠ INCOMPLETA — ${porque}` : porque, error: true, errorKind: paso.kind, retryAt: undefined });
      if (paso.kind === 'login') s.avisar('login', 'El proveedor de IA rechazó la clave: ninguna tarea puede correr. Revisa ANTHROPIC_API_KEY en Cloudflare.', { level: 'error', key: 'login' });
      else s.avisar('failed', `«${m.title}» falló${m.attempts ? ` después de ${m.attempts + 1} intentos` : ''}: ${msg.slice(0, 160)}`, { level: 'error', task: m.id });
      estado = 'fallo';
    }
    s.alm.guardarEjecucion(base, m, { por: 'agente:' + task.agent });
  });
  await borrarCorrida(db, task.id);
  return { estado, error: msg };
}

/* ---------- el reloj de los agentes ---------- */

/** Las tareas `doing` con una orden de correr (`corrida`: aprobada, devuelta con correcciones) o que se quedaron sin corrida → su corrida. */
export async function crearCorridasPendientes(db, ahora = Date.now(), { sinPresupuesto = false } = {}) {
  const nuevas = [];
  const lista = await cargarTareas(db);
  if (sinPresupuesto) { // B8/BAJO-11: con «detener al llegar al presupuesto» y el tope cruzado, nada nuevo arranca; lo aprobado o devuelto vuelve a esperar (no se queda semanas «en curso») y el dueño decide cuando haya presupuesto
    const vivasP = new Set((await corridasVivas(db)).map(c => c.tarea));
    const quedan = lista.filter(t => t.state === 'doing' && t.corrida && t.draft && !vivasP.has(t.id) && ['approve', 'draft', 'routine'].includes(t.corrida.modo));
    if (quedan.length) await conSesion(db, {}, async s => {
      for (const t of quedan) {
        s.alm.cambiar(t.id, x => { if (x.state !== 'doing' || !x.corrida) return false; delete x.corrida; delete x.tomadaPor; delete x.approving; Object.assign(x, { state: 'waiting', waitingAt: x.waitingAt || ahora }); }, { por: 'oficina' });
        s.avisar('budget-hold', `«${t.title}» vuelve a esperar tu visto bueno: se llegó al presupuesto del mes y no empieza nada nuevo. Cuando subas el tope o empiece el mes, apruébala otra vez.`, { level: 'warn', task: t.id, key: 'budget-hold-' + t.id });
      }
    });
    return nuevas;
  }
  const vivas = new Set((await corridasVivas(db)).map(c => c.tarea));
  for (const t of lista) {
    if (t.state !== 'doing' || vivas.has(t.id) || !t.agent || t.person) continue;
    const orden = t.corrida;
    if (!orden && !(String(t.tomadaPor || '').startsWith('agente:') && ahora - (t.startedAt || 0) > 3 * 60_000)) continue; // una recién tomada la crea quien la tomó
    if (await crearCorrida(db, t, orden ? { modo: orden.modo, feedback: orden.feedback || null, origen: orden.origen || null, huella: orden.huella || null } : { modo: modoInicial(t) }, ahora)) {
      nuevas.push(t.id);
      if (orden) await conSesion(db, {}, async s => { s.alm.cambiar(t.id, x => { if (!x.corrida) return false; delete x.corrida; }, { por: 'oficina' }); }); // la orden ya es una corrida
    }
  }
  return nuevas;
}
