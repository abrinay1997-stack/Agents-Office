-- Fase 2: el Cerebro (las notas de la empresa) y su mapa. Todo `create` lleva `if not exists`.
create table if not exists notas (
  nombre text primary key,                 -- el nombre de la nota (sin .md), como en el Cerebro local
  grupo text not null,                     -- la carpeta de primer nivel (00-Empresa, 10-Business…) o «Agents Office»
  oficina integer not null default 0,      -- 1 = la escribió un agente (entrega); 0 = nota del equipo
  texto text not null,
  bytes integer not null default 0,
  actualizado integer not null default 0,  -- ms desde 1970 (la fecha del archivo local)
  tarea text
);
create index if not exists notas_grupo on notas(grupo);

-- El mapa 3D ya calculado (posiciones, enlaces). Se calcula fuera del Worker (el cálculo de fuerzas gasta mucha CPU).
create table if not exists grafo (
  id integer primary key check (id = 1),
  json text not null check (json_valid(json)),
  notas integer not null default 0,
  calculado text not null
);
