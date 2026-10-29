-- Fase 4 E (lotes del Estudio en la nube, 29 oct 2026). Todo detrás del interruptor `lotesNube` del Estudio (apagado por defecto): sin él esta tabla no se toca.
--   estudio_lotes .. UNA fila por lote (json con sus filas, bitácora y costos; ≤ 100 filas por lote) y, con estado 'hoja', las hojas CSV recién leídas (2 horas).
--                    `turno` reparte las vueltas del reloj. `version` es el candado: un cambio solo se guarda si nadie más lo cambió desde que se leyó (el cron y el clic del dueño no se pisan).
-- Poda: los lotes terminados (hecho o cancelado) a los 90 días (lib/mantenimiento.js) y las hojas a las 2 horas (el reloj de cada minuto); como mucho 200 lotes vivos por lista.
-- Cómo se deshace: `drop table if exists estudio_lotes;` (nada más depende de ella; las fotos de los lotes son archivos normales de la galería).
create table if not exists estudio_lotes (
  id text primary key,
  json text not null,
  estado text not null,
  version integer not null default 1,
  at integer not null,
  turno integer not null default 0 -- la última vez que el reloj le dio vez: reparte el goteo entre lotes sin que los nuevos esperen
);
create index if not exists estudio_lotes_estado on estudio_lotes (estado, at);
