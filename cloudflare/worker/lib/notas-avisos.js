// Lo que pasa DESPUÉS de dejar una nota (por la app o por Telegram): el aviso en vivo por el Hub (solo ids, nunca texto) y, si la persona lo tiene vinculado y no está dentro,
// un mensaje de Telegram SIN el texto («Ana te dejó una nota») con un botón para cerrarla. Un aviso que falla no tumba la nota (todo atrapado).
import { difundir } from './vivo.js';
import { avisarPorTelegram, conectadosAhora, escHtml } from './telegram-cuentas.js';

export const MAX_AVISOS_TELEGRAM = 25;
/** `r`: lo que devuelve `crear` ({ id, para: [ids] }). `remitente`: { id, nombre }. → cuántos mensajes de Telegram salieron. */
export async function avisarNotaNueva(env, db, cfg, remitente, r) {
  try {
    difundir(env, { tipo: 'nota', para: r.para, at: Date.now() });
    const conectados = await conectadosAhora(env); let n = 0;
    for (const id of r.para.slice(0, MAX_AVISOS_TELEGRAM)) {
      const res = await avisarPorTelegram(env, db, cfg, id, `📝 <b>${escHtml(remitente.nombre || 'Alguien')}</b> te dejó una nota. Léela en la oficina.`, { botones: { inline_keyboard: [[{ text: 'Cerrar', callback_data: 'nc:' + r.id }]] }, conectados });
      if (res === 'enviado') n++;
    }
    return n;
  } catch (e) { console.error('[notas] no se pudo avisar:', e?.message ?? e); return 0; }
}
