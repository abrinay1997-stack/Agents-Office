// Fase 7 del puerto: la Bandeja con Meta en el Worker (/api/contenido/bandeja*): los comentarios de Instagram y Facebook (también los de los
// anuncios) y los mensajes privados de Instagram y Messenger, con la ventana de 24 h vigilada en el SERVIDOR (fuera de ella no se llama a Meta).
// Las rutas se quedan solo con /api/contenido/bandeja*: el resto de /api/contenido/* es de otro módulo (por eso `grupos: []` y `rutasExtra`),
// y este debe ir ANTES en la lista de modulos/index.js.
//
// Las reglas son las de contenido/bandeja.mjs (no se reescriben): responder y ocultar son SOLO del dueño (rol admin), UNA vez, según el modo de
// Contenido (simulacro: se apunta sin salir; apagado: no sale; real: va a Meta). Un agente deja el borrador y SUGIERE ocultar. Aquí se añade
// lo que un Worker necesita: un candado por mensaje (dos clics o dos pestañas no mandan dos respuestas), el testigo «enviando» ya en D1 antes
// de llamar a Meta, y los tokens de DESHACER en D1.
import { conBandeja, asegurarCuentas, pareceDeAgente } from '../lib/anuncios-nube.js';
import { resolverBandeja, analizarRuta } from '../lib/bandeja-rutas.js';
import { candados } from '../lib/tokens.js';
import { uuid } from '../lib/ids.js';

export const nombre = 'bandeja';
export const grupos = [];
export const rutasExtra = ['/api/contenido/bandeja'];

/** lectura mira; el editor puede escribir el borrador de una respuesta; todo lo demás (traer, enviar, ocultar, descartar, deshacer) es del dueño. */
export function permitido(rol, metodo, r) {
  if (metodo === 'GET' || metodo === 'HEAD') return true;
  if (rol === 'admin') return true;
  return rol === 'editor' && metodo === 'PATCH' && Boolean(r?.id) && !r.accion;
}

export async function manejar(ctx) {
  const { req, env, db, usuario, url, ruta, json } = ctx;
  const r = analizarRuta(ruta);
  if (!r) return ruta.startsWith('/api/contenido/bandeja') ? json({ error: 'esa ruta de la Bandeja no existe' }, 404) : null;
  const metodo = req.method;
  if (!permitido(usuario.rol, metodo, r)) return ctx.prohibido(usuario.rol === 'lectura' ? 'Tu usuario solo puede mirar la Bandeja.' : 'Responder, ocultar o descartar es del dueño (administrador).');
  const b = metodo === 'GET' || metodo === 'HEAD' ? {} : (await ctx.cuerpo(req)) || {};
  // la sesión de una persona solo puede declararse «agente» (menos permisos); nunca otra identidad
  if (b && typeof b === 'object') { const ag = pareceDeAgente(b.por); delete b.por; if (ag) b.por = 'agente'; }
  const fetchFn = typeof env.FETCH_META === 'function' ? env.FETCH_META : undefined;
  const cand = candados(db), yo = 'bandeja-' + uuid().slice(0, 8);
  // una respuesta u ocultar por mensaje, de una en una (el candado va ANTES de tocar nada: el que llega segundo no cambia el estado de nadie)
  const escribe = metodo === 'POST' && (r.accion === 'enviar' || r.accion === 'ocultar') && r.id;
  const clave = escribe ? `bandeja:${r.accion}:${r.id}` : null;
  if (clave && !(await cand.tomar(clave, 5 * 60e3, yo))) return json({ error: 'ya se está procesando ese mensaje: no se envía ni se cambia dos veces' }, 409);
  try {
    return await conBandeja({ db, env, fetchFn }, async ({ bandeja, meta }) => {
      const res = await resolverBandeja({ bandeja, metodo, ruta, url, b, asegurar: () => asegurarCuentas(meta) });
      if (!res) return json({ error: 'esa ruta de la Bandeja no existe' }, 404);
      return json(res.cuerpo, res.status);
    });
  } finally { if (clave) await cand.soltar(clave, yo); }
}

/** El reloj de la Bandeja: Meta cada 3 min con la Bandeja abierta y 10 si no (× el freno de Meta); lo decide contenido/bandeja.mjs → tick. */
export async function cadaMinuto(env) {
  const db = env.DB, cand = candados(db), yo = 'cron-' + uuid().slice(0, 8);
  if (!(await cand.tomar('bandeja:cron', 8 * 60e3, yo))) return;
  const fetchFn = typeof env.FETCH_META === 'function' ? env.FETCH_META : undefined;
  try {
    await conBandeja({ db, env, fetchFn }, async ({ bandeja, meta }) => {
      if (!meta.configurado()) return;
      try { await asegurarCuentas(meta); } catch (e) { console.warn('[bandeja] cuentas:', e?.message ?? e); }
      await bandeja.tick();
    });
  } finally { await cand.soltar('bandeja:cron', yo); }
}
