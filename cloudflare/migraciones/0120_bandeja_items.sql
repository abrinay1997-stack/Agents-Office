-- CON-11 paso 3 (Fase 6, carril F, 29 oct 2026): la Bandeja en una tabla, un ítem por fila, en lugar del archivo `bandeja.json` (hasta ~1,9 MB) que el espejo traía,
-- parseaba y comparaba entero en CADA petición. SOLO se usa con el flag `nube.bandejaTabla` encendido (config-local, apagado por defecto): con el flag apagado nada lee ni escribe aquí.
--   id ............ el id del ítem (p. ej. 'meta:<comentario>' o 'meta:conv:<hilo>')
--   estado/fuente/tipo/ts ... lo que se filtra y ordena (el resto va dentro de json); ts = el `cuando` del ítem
--   json .......... el ítem entero tal cual lo entiende contenido/bandeja.mjs (con su borrador, respuesta, `enviando`…)
--   version ....... compare-and-set por fila: si otra petición la cambió, se junta (fusionarJson) en vez de pisarla
--   enviando_at ... el testigo «ya se está enviando» (candado de «una sola vez»): solo pasa de nulo a un valor si sigue nulo en D1 (update … where enviando_at is null)
-- Lo que no es un ítem (ultimo, error, alias, fuentes, aviso, avisoMensajes) vive en el documento 'bandeja.estado'. La primera vez se importa lo que haya en el archivo fs:data/contenido/bandeja.json (insert or ignore).
-- Poda: la acota el propio módulo (se queda con los 800 más recientes, MAX en contenido/bandeja.mjs); no hay reloj de poda. CONSERVA: el archivo viejo (la copia para volver atrás) y los avisos.
-- Cómo se deshace: apagar el flag (la Bandeja vuelve al archivo; `tablaAArchivo(db)` en lib/bandeja-tabla.js lo actualiza con lo que llegó mientras estuvo encendido) y luego
--   `drop table if exists bandeja_items; delete from docs where clave = 'bandeja.estado';` -- secrets-ok: la clave de un documento, no una llave
create table if not exists bandeja_items (
  id text primary key,
  estado text not null,
  fuente text not null default '',
  tipo text not null default '',
  ts text not null default '',
  json text not null,
  version integer not null default 1,
  enviando_at integer,
  actualizado integer not null
);
create index if not exists bandeja_items_estado on bandeja_items (estado, ts desc);
