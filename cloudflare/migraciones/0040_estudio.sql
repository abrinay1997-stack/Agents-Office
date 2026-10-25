-- El Estudio en la nube (fase 8a). Los archivos están en R2 (env.MEDIA) con la MISMA clave que en la oficina local
-- (`AAAA-MM/AAAA-MM-DD <prompt> HHMMSS.<ext>`); aquí van su ficha (lo que en la oficina local era el .json al lado) y los trabajos.
-- Las carpetas, lo gastado del día y del mes, la configuración y las voces propias van en `docs` (claves `estudio.*`).
create table if not exists estudio_archivos (
  file text primary key,                              -- la clave en R2: '2026-10/2026-10-25 un gato 143012.png'
  at integer not null,                                -- cuándo se guardó (ms); la galería va de lo más nuevo a lo más viejo
  kind text not null default 'image' check (kind in ('image','video','audio')),
  json text not null check (json_valid(json)),        -- la ficha: prompt, modelo, ajustes, medios usados, quién, tarea, carpeta, favorito…
  papelera_at integer                                 -- null = en la galería; si no, cuándo se tiró (30 días después se borra para siempre)
);
create index if not exists estudio_archivos_orden on estudio_archivos(papelera_at, at desc, file desc);

create table if not exists estudio_trabajos (
  id text primary key,
  json text not null check (json_valid(json)),        -- el trabajo entero (como data/media-jobs.json): estado, pedido, ids remotos, archivos entregados
  estado text not null check (estado in ('queued','running','done','failed')),
  at integer not null,
  cancelar integer not null default 0,                -- el dueño pidió cancelarlo (lo lee el paso que lo avanza)
  lease integer not null default 0,                   -- permiso de UN paso a la vez por trabajo: hasta cuándo lo tiene quien lo está avanzando
  paso integer not null default 0                     -- cuándo se dio el último paso (ms): la página no empuja un trabajo más de una vez cada pocos segundos
);
create index if not exists estudio_trabajos_estado on estudio_trabajos(estado, at);
