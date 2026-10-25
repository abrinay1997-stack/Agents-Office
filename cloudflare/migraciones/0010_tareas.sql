-- Fase 3 (tareas, rutinas y calendario). Las tareas, las rutinas, los proyectos, las etiquetas y los avisos viven en el almacén genérico (0003: `filas` y
-- `docs`); aquí solo la BITÁCORA, que crece sin parar y se consulta por tarea y por fecha (lo que en la oficina local era data/tareas/bitacora/AAAA-MM.jsonl).
create table if not exists tarea_bitacora (
  n integer primary key autoincrement,
  t integer not null,                       -- cuándo (ms)
  tarea text not null,
  json text not null check (json_valid(json))  -- la línea completa: { t, tarea, por, tipo, … }
);
create index if not exists tarea_bitacora_tarea on tarea_bitacora(tarea, n);
create index if not exists tarea_bitacora_t on tarea_bitacora(t);
