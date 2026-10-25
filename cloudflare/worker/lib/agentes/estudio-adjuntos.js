// serve.mjs → applyJob / attachJob: un video (o una imagen de pago) sigue generándose cuando la ejecución del agente ya terminó. El agente deja en su entregable la línea
// «⏳ Estudio: … (trabajo <id>)» y, cuando el trabajo termina, la oficina la cambia por el archivo (y, si falló, por el motivo).
import { conSesion } from '../tareas/sesion.js';
import { markAttached } from '../estudio/trabajos.js';

const AUDIO = /\.(mp3|wav|flac|m4a|ogg)$/i;
const enlace = f => '/media/' + f.split('/').map(encodeURIComponent).join('/');
export function lineasDe(j) {
  if (j.state === 'failed') return [`> ✗ El Estudio no pudo generar «${String(j.prompt || '').slice(0, 80)}» (${j.modelName || j.model}): ${j.error}`];
  return (j.items || []).map(f => { const nombre = f.split('/').pop(); return /\.(mp4|webm)$/i.test(f) ? `[▶ ${nombre}](${enlace(f)})` : AUDIO.test(f) ? `[🔊 ${nombre}](${enlace(f)})` : `![${String(j.prompt || '').slice(0, 60).replace(/[[\]()]/g, '')}](${enlace(f)})`; });
}
/** Pone el archivo en lugar de su línea ⏳ (o al final si el agente no la dejó) en los campos pedidos. */
export function aplicarTrabajo(t, j, campos = ['result', 'draft']) {
  const lineas = lineasDe(j).join('\n'), marca = new RegExp(`^.*\\(trabajo ${String(j.id).replace(/[^A-Za-z0-9]/g, '')}\\).*$`, 'm');
  let puesto = false;
  for (const k of campos) if (typeof t[k] === 'string' && marca.test(t[k])) { t[k] = t[k].replace(marca, lineas); puesto = true; }
  if (!puesto) for (const k of campos) if (typeof t[k] === 'string' || k === 'result') t[k] = (t[k] || '') + `\n\n**Del Estudio** (${j.modelName || j.model}):\n${lineas}`;
  if (j.items?.length) t.media = [...new Set([...(t.media || []), ...j.items])];
}

/** El reloj: lo que terminó y todavía no está en su tarea. → cuántos trabajos se pegaron */
export async function adjuntarTerminados(db, { max = 10 } = {}) {
  const { results } = await db.prepare("select json from estudio_trabajos where estado in ('done','failed') order by at desc limit 200").all();
  const pendientes = results.map(r => { try { return JSON.parse(r.json); } catch { return null; } }).filter(j => j && j.task && !j.attached).slice(0, max);
  let n = 0;
  for (const j of pendientes) {
    const hecho = await conSesion(db, {}, async s => {
      const t = s.alm.load().find(x => x.id === j.task);
      if (!t) return 'sin-tarea';
      if (t.state === 'doing' || t.state === 'next' || t.approving) return 'espera'; // la ejecución sigue: lo pega ella al terminar (ejecutor.js)
      s.alm.cambiar(t.id, x => { aplicarTrabajo(x, j, x.state === 'waiting' ? ['result', 'draft'] : ['result']); }, { por: 'oficina' });
      return 'pegado';
    });
    if (hecho !== 'espera') { await markAttached(db, j.id); if (hecho === 'pegado') n++; }
  }
  return n;
}
