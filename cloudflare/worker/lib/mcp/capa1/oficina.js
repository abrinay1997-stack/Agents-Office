// La OFICINA vista por el conector remoto (P3b): la interfaz `office(ruta, cuerpo?, método?)` con la que hablan oficina-tools.mjs y estudio-tools.mjs, ejecutada EN PROCESO con la sesión de la
// persona del token (siempre un administrador: lo comprueba permisos.js antes de llegar aquí) y por los MISMOS módulos y permisos que la página (`crearOffice`, el patrón de Dimitri).
// Lo único que el Worker no tenía eran las cinco rutas `/api/oficina/*` del asistente local (oficina/rutas.mjs): aquí se contestan con las MISMAS piezas puras y el MISMO ejecutor que Dimitri
// (sub.parseOps para validar, crearEjecutor → runOp/undoOp para hacer y deshacer). No hay un fetch a sí mismo y no hay una segunda copia de las reglas.
//   · NUNCA aprobar, enviar, publicar, pagar ni borrar: no están en sub.OPS y no pasan el validador.
//   · NUNCA gastar: los tipos de sub.OPS_GASTO dan un 403 claro (el dueño los confirma en dos pasos, en la oficina o en Telegram).
//   · El DESHACER no puede vivir en memoria (cada invocación del Worker es otra): la clave se apunta en `docs` (`mcp.undo:<clave>`, 10 minutos) y se poda sola.
// Todo se importa PEREZOSAMENTE (el módulo `modulos/index.js` importa al conector: un import estático sería un círculo y haría pesado el arranque).
import { MAPA, REGLAS_ASISTENTE, ACCIONES } from '../../../../../oficina/mapa.mjs';
import * as sub from '../../../../../sub-core.mjs';
import { guardarDoc, leerDoc } from '../../almacen.js';
import { testigo } from '../../ids.js';
import { auditar } from '../auditoria.js';

export const DESHACER_MS = 10 * 60e3; // como el asistente local: un asistente tarda más que un clic en pensarlo
export const PREFIJO_UNDO = 'mcp.undo:';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const idDe = (o) => String(o.id || o.pieza || o.routineId || o.task || o.borrador || '').slice(0, 80) || null;
const etiqueta = (o) => String(o.desc || o.title || o.titulo || o.type).slice(0, 160);
const claveNueva = () => testigo(9);
/** Lo que `hacer` NO ejecuta por MCP (con su motivo): cada una pone a un agente a trabajar o escribe en lo que leen todos los agentes sin que una persona lo vea. Se servirán cuando exista el paso humano. */
export const OPS_FUERA_HACER = Object.freeze({
  rutina_ahora: 'corre una rutina YA: pone a un agente a trabajar (y a gastar en el Estudio antes del OK) sin la confirmación de la página. Se hace en la oficina (Calendario → la rutina → Ejecutar).',
  contenido_llenar: 'crea una tarea para Marketing que genera piezas (y puede pedir imágenes) sin la confirmación de la página. Se hace en Contenido → «Llenar la semana».',
  nota_crear: 'escribe en el Cerebro, que leen todos los agentes sin que una persona lo vea: un texto con órdenes escondidas quedaría guardado. Lo retoma el carril del Cerebro con marca de origen.',
  nota_agregar: 'escribe en el Cerebro, que leen todos los agentes sin que una persona lo vea. Lo retoma el carril del Cerebro con marca de origen.',
});
/** `rutina_editar` por MCP solo cambia el horario: lo que la rutina PIDE y si espera el OK es del dueño en la oficina. */
export const CAMPOS_RUTINA_VEDADOS = Object.freeze(['text', 'needsOk', 'autonomous']);
class Rechazo extends Error { constructor(msg, status) { super(msg); this.status = status; } }

async function podarUndo(db) {
  try { await db.prepare("delete from docs where clave >= 'mcp.undo:' and clave < 'mcp.undo;' and actualizado < ?").bind(new Date(Date.now() - 2 * DESHACER_MS).toISOString()).run(); } catch { /* nunca tumba */ }
}

/** → `office(ruta, cuerpo?, método?)`. `usuario`: { id, email, nombre, rol } de la persona del token. */
export async function crearOficinaMcp({ env: env0, db: db0, usuario, ahoraMs = Date.now() }) {
  const [{ MODULOS }, ops, datos, { conLecturaUnica }, { cargarTareas }, { leerContexto }, { leerCfg }, { yoDe }] = await Promise.all([
    import('../../../modulos/index.js'), import('../../dimitri/ops.js'), import('../../dimitri/datos.js'), import('../../dimitri/lectura-unica.js'),
    import('../../tareas/sesion.js'), import('../../tareas/contexto.js'), import('../../ajustes.js'), import('../../tareas/servicios.js'),
  ]);
  const db = conLecturaUnica(db0), env = { ...env0, DB: db }; // (los módulos leen `env.DB`, no `db`: como en conversar) un turno lee la oficina entera: las mismas lecturas se hacen una vez (límite de 50 consultas por invocación)
  const persona = { id: usuario.id, email: usuario.email, ...(usuario.nombre ? { nombre: usuario.nombre } : {}), rol: 'admin' };
  const base = ops.oficinaDelDueno({ env, db, usuario: persona, modulos: MODULOS });
  const ejecutor = ops.crearEjecutor({ env, db, usuario: persona, modulos: MODULOS });

  async function estado() {
    const [C, cfg, lista] = await Promise.all([leerContexto(db), leerCfg(db), cargarTareas(db)]);
    const a = sub.statusText(lista, C.agents, C.depts), b = await datos.oficinaTexto({ db, office: base, C, lista, cfg, yo: yoDe(persona) });
    return { texto: [a, b].filter(Boolean).join('\n') };
  }

  async function calendario(q) {
    const hoy = new Date(ahoraMs);
    const desde = FECHA.test(q.get('desde') || '') ? q.get('desde') : ymd(hoy);
    let hasta = FECHA.test(q.get('hasta') || '') ? q.get('hasta') : (() => { const d = new Date(hoy); d.setDate(d.getDate() + 13); return ymd(d); })();
    if (hasta < desde) throw new Rechazo('«hasta» va después de «desde»', 400);
    if ((Date.parse(hasta) - Date.parse(desde)) / 864e5 > 62) hasta = ymd(new Date(Date.parse(desde + 'T12:00:00') + 62 * 864e5)); // dos meses como mucho
    const [C, lista] = await Promise.all([leerContexto(db), cargarTareas(db)]);
    return { desde, hasta, texto: await datos.calendarioTexto({ db, office: base, C, lista, desde, hasta, piezas: true }) };
  }

  async function accion(op) {
    if (!op || typeof op !== 'object' || Array.isArray(op)) throw new Rechazo('falta la acción: { op: { type, … } }', 400);
    if (!sub.OPS.includes(op.type)) throw new Rechazo(`«${String(op.type || '?').slice(0, 40)}» no se puede hacer desde aquí. Aprobar, enviar, publicar, pagar o borrar lo hace el dueño en la oficina o en Telegram.`, 403);
    if (OPS_FUERA_HACER[op.type]) throw new Rechazo(`«${op.type}» no se hace desde aquí: ${OPS_FUERA_HACER[op.type]}`, 403);
    if (op.type === 'rutina_editar' && CAMPOS_RUTINA_VEDADOS.some((c) => op[c] !== undefined)) throw new Rechazo(`«rutina_editar» por este conector solo cambia el horario (when) o la pausa: lo que la rutina pide (${CAMPOS_RUTINA_VEDADOS.join(', ')}) lo cambia el dueño en la oficina.`, 403);
    if ((sub.OPS_GASTO || []).includes(op.type)) throw new Rechazo(`«${op.type}» gasta dinero en anuncios: solo lo hace el dueño, con dos pasos y dentro de sus topes, en Anuncios (J) o en Telegram. `
      + 'Desde aquí puedes pausar (anuncio_pausar) o bajar un presupuesto (anuncio_bajar_presupuesto).', 403);
    const C = await leerContexto(db);
    const ctx = await ops.contextoDeOps({ office: base, C, db, ops: [op], usuario: persona });
    const { ops: [v], motivos } = sub.parseOps([op], { ...ctx, owner: false }); // lo que propone un asistente espera el OK en una rutina nueva: no es el dueño pulsando la casilla
    if (!v) throw new Rechazo(`no se puede: ${motivos[0]?.why || 'algo no cuadra con la oficina'}`, 409);
    await ejecutor.runOp(v, { por: 'asistente' }); // lanza Error con el motivo en español si no se pudo
    // el cambio concreto queda en la auditoría (op + id, sin contenido), como en la oficina local (`auditar` de oficina/rutas.mjs)
    await auditar(db0, ahoraMs, persona.email, { evento: 'oficina-op', op: v.type, id: idDe(v), ok: true, via: 'mcp' });
    let clave = null;
    if (v.undo) {
      clave = claveNueva();
      // el efecto YA ocurrió: si no se puede guardar la clave de deshacer, se dice, pero la llamada no falla (fallar invitaría a repetir lo ya hecho)
      try { await guardarDoc(db0, PREFIJO_UNDO + clave, { o: v, at: ahoraMs, por: persona.id }); await podarUndo(db0); } catch (e) { console.warn('[mcp] no se pudo guardar la clave de deshacer:', e?.message ?? e); clave = null; }
    }
    const { undo, antes, k, state, ...vista } = v; // eslint-disable-line no-unused-vars
    return { ok: true, hecho: etiqueta(v), op: vista, ...(clave ? { deshacer: clave, hasta: new Date(ahoraMs + DESHACER_MS).toISOString() } : { aviso: v.undo ? 'se hizo, pero no pude guardar la clave para deshacerlo: cámbialo con otra acción' : 'esto no se puede deshacer desde aquí' }) };
  }

  async function deshacer(clave) {
    const k = String(clave || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
    const { valor } = k ? await leerDoc(db0, PREFIJO_UNDO + k) : { valor: null };
    const vencida = 'esa clave ya no sirve: pasaron más de 10 minutos, ya se deshizo o no es tuya. Cámbialo con otra acción.';
    if (!valor || ahoraMs - (valor.at || 0) > DESHACER_MS || valor.por !== persona.id) throw new Rechazo(vencida, 409);
    // se reclama ANTES de deshacer (borrar la fila es atómico): dos llamadas a la vez no pueden deshacer dos veces
    const r = await db0.prepare('delete from docs where clave = ?').bind(PREFIJO_UNDO + k).run();
    if (!r.meta?.changes) throw new Rechazo(vencida, 409);
    // si deshacer falla, la clave se REPONE: no se pierde la única forma de volver atrás (insert-if-absent, atómico)
    const reponer = async () => { try { await guardarDoc(db0, PREFIJO_UNDO + k, valor, { espera: 0 }); } catch { /* ya hay otra: no se pisa */ } };
    let x;
    try { x = await ejecutor.undoOp(valor.o, { por: 'asistente' }); } catch (e) { await reponer(); throw e; }
    if (x?.error) { await reponer(); throw new Rechazo(x.error, 409); }
    await auditar(db0, ahoraMs, persona.email, { evento: 'oficina-deshacer', op: valor.o.type, id: idDe(valor.o), ok: true, via: 'mcp' });
    return { ok: true, deshecho: etiqueta(valor.o) };
  }

  /** `office(ruta, cuerpo?, método?)`: las cinco de `/api/oficina/*` aquí; todo lo demás, por el módulo que posee la ruta. */
  return async function office(ruta, cuerpo, metodo) {
    const m = metodo || (cuerpo ? 'POST' : 'GET');
    if (ruta.startsWith('/api/oficina/')) {
      const u = new URL('https://oficina.interna' + ruta);
      if (u.pathname === '/api/oficina/mapa' && m === 'GET') return { mapa: MAPA, reglas: REGLAS_ASISTENTE, acciones: ACCIONES };
      if (u.pathname === '/api/oficina/estado' && m === 'GET') return estado();
      if (u.pathname === '/api/oficina/calendario' && m === 'GET') return calendario(u.searchParams);
      if (u.pathname === '/api/oficina/accion' && m === 'POST') return accion(cuerpo?.op || cuerpo);
      if (u.pathname === '/api/oficina/deshacer' && m === 'POST') return deshacer(cuerpo?.deshacer || cuerpo?.token);
      throw new Rechazo('esa dirección de la oficina no existe', 404);
    }
    return base(ruta, cuerpo, metodo);
  };
}
