-- Fase 4: los agentes completos en la nube. Todo `create` lleva `if not exists` (una migración debe poder reaplicarse).

-- Una CORRIDA es la ejecución de UNA tarea por un agente, hecha por pasos entre invocaciones del cron. La clave primaria es la tarea:
-- una tarea tiene como mucho una corrida viva, y el CANDADO (token + caducidad) decide quién la avanza (compare-and-set: nunca dos a la vez).
-- `datos` guarda el avance (mensajes del modelo, herramientas, lo que se leyó, el taint de inyección). Nunca lleva un secreto.
create table if not exists corridas (
  tarea text primary key,
  run text not null,
  modo text not null check (modo in ('task','draft','approve','routine','autonomous')),
  feedback text,
  estado text not null default 'cola' check (estado in ('cola','corriendo','pausada')),
  candado text,
  candado_hasta integer not null default 0,
  paso integer not null default 0,
  datos text not null default '{}' check (json_valid(datos)),
  creada integer not null,
  actualizada integer not null
);
create index if not exists corridas_candado on corridas(candado_hasta);

-- El registro de auditoría de cada llamada a una herramienta (data/audit/AAAA-MM-DD.jsonl en la local): permitida o no, por qué y a quién iba.
create table if not exists auditoria_agentes (
  id integer primary key autoincrement,
  t integer not null,
  dia text not null,
  run text,
  tarea text,
  agente text,
  dept text,
  herramienta text not null,
  fase text not null default 'pre',
  clase text,
  decision text not null,
  codigo text,
  motivo text,
  destinos text not null default '[]' check (json_valid(destinos))
);
create index if not exists auditoria_agentes_dia on auditoria_agentes(dia, agente, decision, clase);
create index if not exists auditoria_agentes_run on auditoria_agentes(run);

-- El libro de costos (data/costs.jsonl): una fila por llamada a un modelo.
create table if not exists costos (
  id integer primary key autoincrement,
  t integer not null,
  tarea text,
  agente text,
  dept text,
  tipo text not null default 'task',
  modelo text not null default '',
  proveedor text not null default 'anthropic',
  tin integer not null default 0,
  tout integer not null default 0,
  cache_read integer not null default 0,
  cache_write integer not null default 0,
  usd real not null default 0,
  fuente text not null default 'tabla',
  ms integer
);
create index if not exists costos_t on costos(t);
