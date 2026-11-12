// QUIÉN PUEDE LLAMAR QUÉ, en un solo sitio y en este orden (cada llamada a `tools/call` lo recorre entero):
//   1. el ALCANCE del token   (un token de «lectura» solo llama herramientas de solo lectura, aunque quien conectó sea administrador)
//   2. el ROL vigente         (se relee de D1; solo un administrador del equipo: el rol «lectura» tampoco escribe nunca, y un editor ya ni siquiera lee por aquí)
//   3. el INTERRUPTOR general (mcp.activo: apagado, nada responde)
//   4. los TOPES              (solo las escrituras: por minuto y por día, por conexión)
// La primera capa que dice no, para: el motivo y la capa quedan en la auditoría. Puro salvo `topes`, que solo se llama si las tres primeras pasaron.
import { nivelDe } from './constantes.js';

/** ¿El alcance de la conexión alcanza para esta herramienta? */
export function alcanzaElAlcance(alcanceToken, herramienta) {
  if (herramienta.soloLectura) return true; // lo de solo lectura lo puede llamar cualquier alcance
  return nivelDe(alcanceToken) >= nivelDe(herramienta.alcance) && nivelDe(alcanceToken) >= nivelDe('oficina');
}

/** → { ok: true } | { ok: false, capa: 'alcance'|'rol'|'interruptor'|'tope', motivo } */
export async function decidirLlamada({ conexion, usuario, herramienta, interruptor, topes = null }) {
  if (!alcanzaElAlcance(conexion?.alcance, herramienta)) {
    return { ok: false, capa: 'alcance', motivo: `Esta conexión es de alcance «${conexion?.alcance}»: ${herramienta.soloLectura ? '' : 'no puede escribir. '}Para esto hace falta una conexión de alcance «${herramienta.alcance}». Vuelve a conectar Claude y elígelo.` };
  }
  if (!usuario || usuario.rol !== 'admin') {
    return { ok: false, capa: 'rol', motivo: usuario?.rol === 'lectura' && !herramienta.soloLectura ? 'Una cuenta de solo lectura nunca escribe.' : 'Solo un administrador de la oficina puede usar este conector.' };
  }
  if (interruptor !== true) return { ok: false, capa: 'interruptor', motivo: 'El conector está apagado (Ajustes → Funciones nuevas → Conectar Claude).' };
  if (!herramienta.soloLectura && typeof topes === 'function') {
    const t = await topes();
    if (t && t.ok === false) return { ok: false, capa: 'tope', motivo: t.motivo };
  }
  return { ok: true };
}
