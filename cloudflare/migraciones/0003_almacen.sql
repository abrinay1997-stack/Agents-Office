-- Almacén genérico: reemplaza los archivos JSON de data/ que usa la oficina local (tasks.json, routines.json, kpis.json…).
-- Un módulo que necesite algo más específico crea sus propias tablas en su rango de migraciones (ver cloudflare/PORTAR.md).
create table if not exists docs (
  clave text primary key,                  -- p. ej. 'kpis', 'subgerente'
  json text not null check (json_valid(json)),
  version integer not null default 1,      -- para guardar sin pisar lo que otro cambió a la vez
  actualizado text not null
);
create table if not exists filas (
  coleccion text not null,                 -- p. ej. 'tareas', 'rutinas', 'piezas'
  id text not null,
  json text not null check (json_valid(json)),
  orden real not null default 0,
  actualizado text not null,
  primary key (coleccion, id)
);
create index if not exists filas_orden on filas(coleccion, orden);
