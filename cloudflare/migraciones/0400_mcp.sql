-- El conector MCP remoto de la oficina (P2 del plan docs/plan-mcp-oficina-panaclaw.md).
-- Tres tablas y nada más; todo `create ... if not exists` (sin `alter table`: una migración debe poder reaplicarse).
-- LOS TESTIGOS NUNCA SE GUARDAN EN CLARO: solo su SHA-256 (access_hash, refresh_hash, codigo_hash). Los tiempos son milisegundos (los pone el reloj inyectable de lib/mcp/config.js).

-- Las aplicaciones registradas por registro dinámico (RFC 7591): claude.ai, Claude Code, Claude Desktop…
create table if not exists mcp_clientes (
  client_id text primary key,
  nombre text not null,
  redirect_uris text not null check (json_valid(redirect_uris)),   -- lista cerrada, ya validada al registrar
  creado_at integer not null,
  ip_huella text,                                                    -- SHA-256 de la IP que lo registró (tope por IP y hora); nunca la IP
  ultimo_uso_at integer                                              -- null = nunca se usó; el mantenimiento borra al que lleva 30 días así y sin conexiones
);
create index if not exists mcp_clientes_creado on mcp_clientes(creado_at);
create index if not exists mcp_clientes_ip on mcp_clientes(ip_huella, creado_at);

-- El código de autorización: de UN solo uso, con su reto PKCE y su redirect_uri; caduca en un minuto.
create table if not exists mcp_codigos (
  codigo_hash text primary key,
  client_id text not null,
  user_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  alcance text not null check (alcance in ('lectura','oficina','gasto')),
  nombre text not null,                                              -- cómo se llamará la conexión en Ajustes
  familia text not null,                                             -- la conexión que nacerá de este código (si el código se reutiliza, se corta)
  caduca_at integer not null,
  usado_at integer
);
create index if not exists mcp_codigos_caduca on mcp_codigos(caduca_at);

-- Una fila por testigo emitido. Una CONEXIÓN es una familia: cada renovación rota el testigo (la fila vieja queda `rotado_at`, la nueva es la vigente).
-- Presentar un testigo de renovación ya rotado corta TODA la familia (alguien lo copió).
create table if not exists mcp_tokens (
  id text primary key,
  familia text not null,
  access_hash text not null unique,
  refresh_hash text not null unique,
  client_id text not null,
  user_id text not null references users(id) on delete cascade,
  rol text not null,                                                 -- el rol al emitir (informativo: en cada llamada se relee el vigente)
  alcance text not null check (alcance in ('lectura','oficina','gasto')),
  nombre text not null,
  familia_creada_at integer not null,
  creado_at integer not null,
  ultimo_uso_at integer,
  access_caduca_at integer not null,
  refresh_caduca_at integer not null,
  rotado_at integer,
  revocado_at integer
);
create index if not exists mcp_tokens_familia on mcp_tokens(familia);
create index if not exists mcp_tokens_usuario on mcp_tokens(user_id);
create index if not exists mcp_tokens_caduca on mcp_tokens(refresh_caduca_at);
