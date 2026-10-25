// Un aviso de la oficina (serve.mjs → notice): lo que el dueño debe saber sin abrir una tarea. Se guarda en `filas('avisos')`, que es lo que lee el semáforo y lo que
// manda Telegram. Lo mismo dicho dos veces en 6 horas (misma `key`) se dice una. → el aviso guardado, o null si era repetido.
export async function avisar(db, { kind, text, level = 'info', task = null, key = null, ...resto }, ahora = Date.now()) {
  if (key) {
    const ya = await db.prepare("select 1 x from filas where coleccion = 'avisos' and orden > ? and json_extract(json,'$.key') = ?").bind(ahora - 6 * 3600e3, key).first();
    if (ya) return null;
  }
  const id = `${ahora.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const aviso = { id, t: ahora, read: false, kind, level, text: String(text), task, key, ...resto };
  await db.prepare('insert into filas (coleccion, id, json, orden, actualizado) values (?,?,?,?,?) on conflict (coleccion, id) do nothing').bind('avisos', id, JSON.stringify(aviso), ahora, new Date(ahora).toISOString()).run();
  return aviso;
}
