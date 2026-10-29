// El chat directo con un agente (el panel de un departamento): POST /api/chat { agent, text, history } → { reply, read, tools, routines, interview }.
// La lógica vive en lib/agentes/chat.js. Un turno por petición; solo herramientas de LECTURA de los conectores del departamento, todas por el guardián.
// Quien puede escribir en la oficina (administrador y editor) puede hablar con un agente; el lector no (gasta modelo y consulta los conectores).
import { json, error, prohibido } from '../lib/respuesta.js';
import { leerContexto } from '../lib/tareas/contexto.js';
import { leerPeticion, conversar } from '../lib/agentes/chat.js';
import { limpiarSecretos } from '../lib/secretos.js';
import { cupoDeModelo } from '../lib/equipo.js';

export const nombre = 'chat-agente';
export const grupos = ['chat'];

const MAX_CUERPO = 64 * 1024;

export async function manejar(ctx) {
  const { req, env, db, usuario, ruta } = ctx;
  if (ruta !== '/api/chat') return null;
  if (req.method !== 'POST') return error('usa POST', 405);
  if (usuario.rol !== 'admin' && usuario.rol !== 'editor') return prohibido('Hablar con un agente es de quien puede trabajar en la oficina: tu cuenta es de solo lectura.');
  const sinCupo = await cupoDeModelo(db, env, 'chat', usuario.id, { porMinuto: 10, porDia: 200 }); // SEG-01: cada turno gasta modelo con la clave del dueño
  if (sinCupo) return error(sinCupo, 429);
  let b;
  try {
    const largo = Number(req.headers.get('content-length') || 0);
    if (largo > MAX_CUERPO) return error('el mensaje es demasiado grande', 413);
    const t = await req.text();
    if (t.length > MAX_CUERPO) return error('el mensaje es demasiado grande', 413);
    b = t ? JSON.parse(t) : {};
  } catch { return error('el cuerpo no es JSON', 400); }
  const C = await leerContexto(db);
  const p = leerPeticion(b, C.agents);
  if (p.error) return error(p.error, p.estado || 400);
  try {
    return json(await conversar({ env, db, p, fetchFn: env.__pruebas?.fetch || null }));
  } catch (e) {
    const estado = Number.isInteger(e?.estado) ? e.estado : e?.fatal ? 503 : 502;
    const motivo = limpiarSecretos(String(e?.message || 'falló')).replace(/\s*\[HTTP \d+\]\s*$/, '').slice(0, 300);
    return error(estado === 502 ? `No pude hablar con el modelo: ${motivo}` : motivo, estado, estado >= 500 ? e : undefined);
  }
}
