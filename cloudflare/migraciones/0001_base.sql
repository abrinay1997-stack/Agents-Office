-- Agents Office en Cloudflare — esquema base (D1). Todo `create` lleva `if not exists` (una migración debe poder reaplicarse).
create table if not exists users (
  id text primary key,
  email text not null unique,
  rol text not null default 'admin' check (rol in ('admin','editor','lectura')),
  password_hash text not null,
  salt text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create table if not exists sessions (
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  created_at text not null,
  expires_at text not null,
  user_agent text not null default ''
);
create index if not exists sessions_expira on sessions(expires_at);

-- Conectores MCP remotos. El TOKEN no está aquí: `secreto` es el NOMBRE de un secreto del Worker (wrangler secret).
create table if not exists conectores (
  id text primary key,
  nombre text not null unique,
  url text not null,
  secreto text,
  departamentos text not null default '[]' check (json_valid(departamentos)),
  herramientas_lectura text not null default '[]' check (json_valid(herramientas_lectura)),
  herramientas_envio text not null default '[]' check (json_valid(herramientas_envio)),
  activo integer not null default 1,
  created_at text not null
);

-- Cada ejecución de un agente. Sin el texto de los secretos; el resultado puede ser largo.
create table if not exists ejecuciones (
  id text primary key,
  agente text not null,
  usuario_id text not null references users(id),
  texto text not null,
  modo text not null default 'borrador' check (modo in ('borrador','aprobada')),
  estado text not null default 'corriendo' check (estado in ('corriendo','hecha','fallo')),
  resultado text,
  error text,
  modelo text,
  tokens_in integer,
  tokens_out integer,
  created_at text not null,
  terminada_at text
);
create index if not exists ejecuciones_fecha on ejecuciones(created_at);

-- Auditoría de lo que hacen los agentes con los conectores (qué herramienta, permitida o no).
create table if not exists auditoria (
  id integer primary key autoincrement,
  at text not null,
  tipo text not null,
  quien text not null,
  detalle text not null default '{}' check (json_valid(detalle))
);
