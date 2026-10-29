// N2 (D01): el manejador de una cuenta VINCULADA que escribe al bot. NUNCA es `who`: no aprueba, no envía, no gasta, no toca anuncios ni Dimitri. Sus comandos, por rol (§3.10 punto 6):
//   lectura ... /ayuda · /notas · /nota @persona texto · /silencio · /desvincular          editor ... además /mias y /yo texto
// Todo lo demás —/pendientes, /anuncios, /estado, un botón ✅ de aprobar— contesta «no autorizado» y no hace nada. `/chat` llega con el chat (C1).
import { cargarTareas } from './tareas/sesion.js';
import { listarMias, marcar, crear, personas, leerConfig as leerConfigNotas } from './notas-personales.js';
import { desvincular, enviarTelegram, llamarTelegram, escHtml, claveNombre } from './telegram-cuentas.js';
import { crearOffice } from './agentes/herramientas.js';
import { avisarNotaNueva } from './notas-avisos.js';

const hace = (t, ahora) => { const m = Math.max(0, Math.round((ahora - t) / 60000)); return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };
const AYUDA = (rol) => ['<b>Lo que puedes hacer desde aquí</b>',
  ...(rol === 'lectura' ? [] : ['/mias — tus tareas abiertas', '/yo <i>texto</i> — anotar algo para ti']),
  '/notas — las notas que te dejaron', '/nota @persona <i>texto</i> — dejarle una nota a alguien',
  '/silencio <i>horas</i> — no molestar (ej. /silencio 2; /silencio 22-7 cada día; /silencio 0 lo quita)', '/desvincular — quitar este Telegram',
  'Aprobar, enviar o gastar se hace en la oficina.'].join('\n');

/** Parte `/comando@bot resto`. */
export function parteComando(texto) { const m = /^\/([a-zA-Z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/.exec(String(texto || '').trim()); return m ? { cmd: m[1].toLowerCase(), arg: (m[2] || '').trim() } : null; }

/** `/silencio` → { hasta } (horas desde ahora), { desde_h, hasta_h } (ventana diaria) o { quitar }. null si no se entiende. */
export function parseSilencio(arg, ahora = Date.now()) {
  const a = String(arg || '').trim();
  if (/^0+$/.test(a) || /^(quitar|no|off)$/i.test(a)) return { quitar: true };
  let m = /^(\d{1,2})(?:[.,](\d))?\s*h?$/.exec(a);
  if (m) { const h = +m[1] + (m[2] ? +m[2] / 10 : 0); return h > 0 && h <= 24 ? { hasta: ahora + Math.round(h * 3600e3) } : null; }
  m = /^(\d{1,2})\s*[-–a]\s*(\d{1,2})$/.exec(a);
  if (m && +m[1] < 24 && +m[2] < 24 && m[1] !== m[2]) return { desde_h: +m[1], hasta_h: +m[2] };
  return null;
}

export async function atenderCuenta({ env, db, cfg, update, cuenta, modulos, ahora = Date.now() }) {
  const chat = cuenta.telegramId, di = (t, extra) => enviarTelegram(env, chat, t, extra);
  const usuario = { id: cuenta.id, email: cuenta.email, rol: cuenta.rol, nombre: cuenta.nombre };
  const puedeTareas = cuenta.rol !== 'lectura';
  // botones: solo «cerrar una nota» es suyo. Todo lo demás (✅ aprobar, ↩, ⏸…) es de otro nivel: no autorizado, sin tocar nada.
  if (update.callback_query) {
    const q = update.callback_query, m = /^nc:([0-9a-f-]{8,40})$/.exec(String(q.data || ''));
    if (!m) { await llamarTelegram(env, 'answerCallbackQuery', { callback_query_id: q.id, text: 'No autorizado desde este Telegram.', show_alert: false }); return 'no-autorizado'; }
    const ok = await marcar(db, usuario, m[1], 'cerrar', ahora);
    await llamarTelegram(env, 'answerCallbackQuery', { callback_query_id: q.id, text: ok ? 'Nota cerrada' : 'Esa nota ya no está' });
    return ok ? 'nota-cerrada' : 'nota-ausente';
  }
  const c = parteComando(update.message?.text);
  if (!c) { await di('Escribe /ayuda para ver lo que puedes hacer desde aquí.'); return 'ayuda'; }
  switch (c.cmd) {
    case 'start': case 'ayuda': case 'help': await di(AYUDA(cuenta.rol)); return 'ayuda';
    case 'desvincular': await desvincular(db, cuenta.id); await di('Listo: este Telegram ya no está conectado a tu cuenta.'); return 'desvinculada';
    case 'silencio': {
      const s = parseSilencio(c.arg, ahora);
      if (!s) { await di('Dime cuántas horas (/silencio 2), una ventana diaria (/silencio 22-7) o /silencio 0 para quitarlo.'); return 'silencio-error'; }
      if (s.quitar) await db.prepare('update cuenta_telegram set silencio_hasta = null, silencio_desde_h = null, silencio_hasta_h = null where user_id = ?').bind(cuenta.id).run();
      else if (s.hasta) await db.prepare('update cuenta_telegram set silencio_hasta = ? where user_id = ?').bind(s.hasta, cuenta.id).run();
      else await db.prepare('update cuenta_telegram set silencio_desde_h = ?, silencio_hasta_h = ? where user_id = ?').bind(s.desde_h, s.hasta_h, cuenta.id).run();
      await di(s.quitar ? 'Avisos de nuevo activos.' : s.hasta ? `Sin avisos por ${Math.round((s.hasta - ahora) / 360000) / 10} h.` : `Sin avisos de ${s.desde_h}:00 a ${s.hasta_h}:00 (hora de la oficina), cada día.`); return 'silencio';
    }
    case 'mias': {
      if (!puedeTareas) break;
      const k = claveNombre(cuenta.nombre), lista = (await cargarTareas(db, { ligera: false })).filter((t) => !t.archived && t.state !== 'done' && t.person && claveNombre(t.person) === k).slice(0, 12);
      await di(lista.length ? `<b>Tus tareas (${lista.length})</b>\n` + lista.map((t) => `• ${escHtml(String(t.title || t.text || '').slice(0, 120))}`).join('\n') : 'No tienes tareas abiertas. 🎉'); return 'mias';
    }
    case 'yo': {
      if (!puedeTareas) break;
      if (!c.arg) { await di('Escribe qué quieres anotar: /yo llamar al proveedor el viernes'); return 'yo-vacio'; }
      try { await crearOffice({ env, db, usuario, modulos })('/api/tareas/mias', { title: c.arg.slice(0, 200) }, 'POST'); await di('Anotada en tus tareas.'); return 'yo'; } catch (e) { await di('No pude anotarla: ' + escHtml(String(e.message || '').slice(0, 120))); return 'yo-error'; }
    }
    case 'notas': {
      if (!(await leerConfigNotas(db)).activo) { await di('Las notas todavía no están encendidas en esta oficina.'); return 'notas-apagadas'; }
      const notas = await listarMias(db, usuario, ahora);
      // Telegram es un tercero: se dice de quién y cuándo, no el texto. El texto se lee en la oficina.
      if (!notas.length) { await di('No tienes notas sin cerrar.'); return 'notas-vacio'; }
      for (const n of notas.slice(0, 8)) await di(`📝 Nota de <b>${escHtml(n.de)}</b> · ${hace(n.t, ahora)}\nLéela en la oficina.`, { reply_markup: { inline_keyboard: [[{ text: 'Cerrar', callback_data: 'nc:' + n.id }]] } });
      return 'notas';
    }
    case 'nota': {
      if (!(await leerConfigNotas(db)).activo) { await di('Las notas todavía no están encendidas en esta oficina.'); return 'notas-apagadas'; }
      const m = /^@?(\S+)\s+([\s\S]+)$/.exec(c.arg);
      if (!m) { await di('Así: /nota @ana Revisa el presupuesto'); return 'nota-uso'; }
      const gente = (await personas(db, usuario)).filter((p) => claveNombre(p.nombre) === claveNombre(m[1]) || claveNombre(p.nombre).startsWith(claveNombre(m[1])));
      const exacta = gente.filter((p) => claveNombre(p.nombre) === claveNombre(m[1]));
      const elegida = exacta.length === 1 ? exacta[0] : gente.length === 1 ? gente[0] : null;
      if (!elegida) { await di(gente.length ? 'Hay varias personas con ese nombre: escribe el nombre completo.' : 'No encuentro a esa persona.'); return 'nota-persona'; }
      const r = await crear(db, usuario, { para: 'persona:' + elegida.id, cuerpo: m[2] }, ahora);
      if (r.error) { await di(escHtml(r.error)); return 'nota-error'; }
      await avisarNotaNueva(env, db, cfg, usuario, r);
      await di(`Nota dejada para <b>${escHtml(elegida.nombre)}</b>.`);
      return 'nota';
    }
    default: break;
  }
  await di('No autorizado desde este Telegram. Eso se hace en la oficina. /ayuda te dice lo que puedes hacer aquí.');
  return 'no-autorizado';
}
