// Agents Office (9 oct 2026, revisión de control) — /api/oficina/*: la oficina entera para un ASISTENTE del dueño (Claude Desktop,
// Claude Code, Cursor o cualquier cliente MCP en esta máquina, por oficina-mcp.mjs). Lo mismo que Dimitri ve y lo mismo que Dimitri
// propone, con las mismas reglas: el validador es sub.parseOps y el ejecutor es runOp de serve.mjs (no hay una segunda copia).
//   GET  /api/oficina/mapa                        → { mapa, reglas, acciones }       qué hay en la oficina y qué se puede hacer
//   GET  /api/oficina/estado                      → { texto }                         lo que Dimitri ve en <estado>, en palabras y con ids
//   GET  /api/oficina/calendario?desde=&hasta=    → { texto }                         tareas con hora, rutinas, lo del dueño, piezas
//   POST /api/oficina/accion { op: { type, … } }  → { ok, hecho, op, deshacer, hasta } | 409 { error, motivo }
//   POST /api/oficina/deshacer { deshacer }       → { ok } | 409 { error }
// NUNCA hay aquí aprobar, enviar, publicar, pagar ni borrar: esas acciones no están en sub.OPS y por eso no pasan el validador.
// Lo que propone Dimitri espera el OK en una rutina nueva y aquí también (el asistente no es el dueño pulsando la casilla).
import crypto from 'node:crypto';
import { MAPA, REGLAS_ASISTENTE } from './mapa.mjs';

export const DESHACER_MS = 10 * 60e3; // un asistente tarda más que un clic en pensarlo: 10 minutos (Dimitri, 30 s en la tarjeta)
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Lo que cada acción lleva, para el esquema del MCP y la guía (la validación de verdad es sub.parseOps). */
export const ACCIONES = {
  rutina_crear: 'dept, text, when {kind daily|weekdays|weekly|monthly, at "HH:MM", days [0-6] o day/nth+weekday}, agent? — espera el OK siempre',
  rutina_saltar: 'id, at "YYYY-MM-DDTHH:MM" (una ejecución exacta)',
  rutina_pausar: 'id', rutina_reanudar: 'id', rutina_ahora: 'id (la corre ahora)',
  rutina_editar: 'id, when?, text?',
  tarea_mover: 'id (de un agente, sin empezar), at "YYYY-MM-DDTHH:MM"', tarea_cancelar: 'id (de un agente, sin empezar)',
  tarea_editar: 'id, prioridad? alta|media|baja, limite? "YYYY-MM-DD[THH:MM]" o null', tarea_repetir: 'id (hecha o que falló)',
  mia_delegar: 'id (del dueño), dept, agent?, nota?', mia_hecha: 'id (del dueño)',
  pieza_crear: 'titulo, texto, fecha?, hora?, formato? post|reel|carrusel|historia, redes? — nace BORRADOR',
  pieza_mover: 'id, fecha, hora? — si estaba aprobada pierde el OK',
  contenido_llenar: 'dias? 1-14, redes?, pide? — los días sin publicación, como «Llenar la semana»',
};

export function crearRutasOficina({ json, body, sub, opsContext, runOp, undoOp, estadoTexto, calendarioTexto, etiqueta = o => o.type, auditar = () => {}, ahora = () => Date.now() }) {
  const hechas = new Map(); // token → { o, at }: lo que se puede deshacer (en memoria: un reinicio lo olvida, y lo dice)
  const limpiar = () => { const t = ahora(); for (const [k, v] of hechas) if (t - v.at > DESHACER_MS) hechas.delete(k); while (hechas.size > 200) hechas.delete(hechas.keys().next().value); };

  async function accion(op) {
    if (!op || typeof op !== 'object') return { status: 400, error: 'falta la acción: { op: { type, … } }' };
    if (!sub.OPS.includes(op.type)) return { status: 403, error: `«${String(op.type || '?').slice(0, 40)}» no se puede hacer desde aquí. Aprobar, enviar, publicar, pagar o borrar lo hace el dueño en la oficina o en Telegram.` };
    const { ops: [v], motivos } = sub.parseOps([op], { ...opsContext(), owner: false });
    if (!v) return { status: 409, error: `no se puede: ${motivos[0]?.why || 'algo no cuadra con la oficina'}`, motivo: motivos[0]?.why || '' };
    try { await runOp(v, { por: 'asistente' }); }
    catch (e) { auditar({ accion: v.type, id: v.id || null, ok: false, error: e.message }); return { status: 409, error: e.message }; }
    limpiar();
    const token = v.undo ? crypto.randomBytes(9).toString('base64url') : null;
    if (token) hechas.set(token, { o: v, at: ahora() });
    auditar({ accion: v.type, id: v.id || v.pieza || v.routineId || v.task || null, ok: true });
    const { undo, antes, k, state, ...vista } = v;
    return { ok: true, hecho: etiqueta(v), op: vista, ...(token ? { deshacer: token, hasta: new Date(ahora() + DESHACER_MS).toISOString() } : { aviso: 'esto no se puede deshacer desde aquí' }) };
  }

  function deshacer(token) {
    limpiar();
    const h = hechas.get(String(token || ''));
    if (!h) return { status: 409, error: 'esa clave ya no sirve: pasaron más de 10 minutos, ya se deshizo o la oficina se reinició. Cámbialo con otra acción.' };
    const r = undoOp(h.o, { por: 'asistente' }); if (r.error) return { status: 409, error: r.error };
    hechas.delete(String(token)); auditar({ accion: 'deshacer:' + h.o.type, id: h.o.id || null, ok: true });
    return { ok: true, deshecho: etiqueta(h.o) };
  }

  return async function rutasOficina(req, res, url) {
    const p = url.pathname; if (!p.startsWith('/api/oficina/')) return false;
    try {
      if (p === '/api/oficina/mapa' && req.method === 'GET') return json(res, 200, { mapa: MAPA, reglas: REGLAS_ASISTENTE, acciones: ACCIONES }), true;
      if (p === '/api/oficina/estado' && req.method === 'GET') return json(res, 200, { texto: estadoTexto() }), true;
      if (p === '/api/oficina/calendario' && req.method === 'GET') {
        const q = url.searchParams, hoy = new Date(ahora()), ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const desde = FECHA.test(q.get('desde') || '') ? q.get('desde') : ymd(hoy);
        let hasta = FECHA.test(q.get('hasta') || '') ? q.get('hasta') : (() => { const d = new Date(hoy); d.setDate(d.getDate() + 13); return ymd(d); })();
        if (hasta < desde) return json(res, 400, { error: '«hasta» va después de «desde»' }), true;
        if ((Date.parse(hasta) - Date.parse(desde)) / 864e5 > 62) hasta = ymd(new Date(Date.parse(desde + 'T12:00:00') + 62 * 864e5)); // dos meses como mucho
        return json(res, 200, { desde, hasta, texto: calendarioTexto({ desde, hasta }) }), true;
      }
      if (p === '/api/oficina/accion' && req.method === 'POST') { const b = await body(req); const r = await accion(b.op || b); return json(res, r.status || 200, r.status ? { error: r.error, ...(r.motivo ? { motivo: r.motivo } : {}) } : r), true; }
      if (p === '/api/oficina/deshacer' && req.method === 'POST') { const b = await body(req); const r = deshacer(b.deshacer || b.token); return json(res, r.status || 200, r.status ? { error: r.error } : r), true; }
      return json(res, 404, { error: 'esa dirección de la oficina no existe' }), true;
    } catch (e) { return json(res, 500, { error: e.message }), true; }
  };
}
