// N2b (Fase 8, §3.10 punto 7): «Ana se conectó». Una VISITA nueva (la decide D1 en tocarPresencia: más de 30 min sin verla) avisa UNA vez a los administradores que lo pidieron,
// por el Hub y SIN texto: el socket lleva solo el id de quien entró. Decidido por el dueño (29 oct 2026): va, sin bloqueos legales. Sigue detrás del flag de notificaciones
// (`notificaciones.config.activo`, apagado) hasta que el dueño lo encienda.
//   · Quién recibe: SOLO administradores (D08), opt-in por persona (`avisarme`, apagado por defecto), de todas las personas o de una lista (`de`).
//   · Quién es visible: todos en la lista de presentes; cada cuenta puede elegir «No avisar que me conecto» (`noAvisar`): sigue en línea pero no dispara aviso.
//   · Transparencia: solo se registra cuándo entraste (`entro_at`) y tu última actividad (`visto_at`); nunca qué hiciste, ni IP, ni dispositivo.
//   · Nunca a quien se conecta; un regreso antes de 30 min no es visita nueva (no repite); al fallar, el aviso no tumba nada.
// Preferencias: un doc por cuenta (`presencia.pref:<id>`), sin tabla nueva. El canal Telegram queda para N2 (la vinculación por cuenta aún no existe): `telegram` se guarda pero no se usa.
import { leerDoc, guardarDoc } from './almacen.js';
import { leerConfig as leerConfigNotif } from './notificaciones.js';
import { difundir } from './vivo.js';

export const PREFIJO_PREF = 'presencia.pref:';
export const TEXTO_TRANSPARENCIA = 'Se guarda solo cuándo entraste a la oficina y tu última actividad. Nunca qué hiciste, ni tu dirección de red, ni tu dispositivo. Quien lo pidió (un administrador) recibe un aviso cuando entras, salvo que elijas «No avisar que me conecto».';
const PREF0 = Object.freeze({ avisarme: false, oficina: true, telegram: false, de: 'todas', noAvisar: false });
const MAX_LISTA = 50;

export function limpiarPref(p, base = PREF0) {
  const o = { ...base };
  for (const k of ['avisarme', 'oficina', 'telegram', 'noAvisar']) if (typeof p?.[k] === 'boolean') o[k] = p[k];
  if (p?.de === 'todas') o.de = 'todas';
  else if (Array.isArray(p?.de)) o.de = [...new Set(p.de.map((x) => String(x).slice(0, 60)).filter(Boolean))].slice(0, MAX_LISTA);
  return o;
}
export const leerPref = async (db, userId) => limpiarPref((await leerDoc(db, PREFIJO_PREF + userId, {})).valor || {});
export async function guardarPref(db, usuario, cambios) {
  const nueva = limpiarPref(cambios, await leerPref(db, usuario.id));
  if (usuario.rol !== 'admin') { nueva.avisarme = false; nueva.de = 'todas'; } // recibir avisos de conexión es solo de administradores
  await guardarDoc(db, PREFIJO_PREF + usuario.id, nueva);
  return nueva;
}

/** A quién le toca el aviso de que `quien` entró: administradores activos que lo pidieron, con la oficina como canal, que vigilan a `quien`; nunca al propio. → [ids] */
export async function receptores(db, quien) {
  const { results } = await db.prepare("select u.id from users u left join perfiles p on p.user_id = u.id where u.rol = 'admin' and p.baja_at is null and u.id != ?").bind(quien.id).all();
  const ids = [];
  for (const { id } of results) {
    const p = await leerPref(db, id);
    if (!p.avisarme || !p.oficina) continue;
    if (p.de !== 'todas' && !p.de.includes(quien.id)) continue;
    ids.push(id);
  }
  return ids;
}

/** Tras tocarPresencia: si arrancó una visita nueva y la cuenta no pidió ocultarse, avisa a quien corresponde. Atrapa todo error. → cuántos receptores. */
export async function avisarConexion(db, env, usuario, visita) {
  try {
    if (!visita?.nueva || !(await leerConfigNotif(db)).activo) return 0;
    if ((await leerPref(db, usuario.id)).noAvisar) return 0;
    const para = await receptores(db, usuario);
    if (!para.length) return 0;
    difundir(env, { tipo: 'conexion', userId: usuario.id, para, at: Date.now() }); // solo el id: el nombre y la foto los resuelve la página con la presencia que ya tiene
    return para.length;
  } catch (e) { console.error('[presencia] no se pudo avisar:', e?.message ?? e); return 0; }
}
