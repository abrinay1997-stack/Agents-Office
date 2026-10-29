-- C0 (Fase 8, chat interno del equipo, docs/plan-chat-interno.md): canales, miembros y mensajes. Todo detrás del flag APAGADO `chat.config.activo` (doc). Solo en la nube.
--   chat_canales ... tipo general | canal | directo | grupo | registro (registro: C5). `clave_directo` («a|b», ids ordenados) es ÚNICA: un solo directo por pareja. #general tiene id fijo 'general'.
--   chat_miembros .. quién está en cada canal; `leido_hasta` = id del último mensaje leído (nunca baja). Pertenencia = única puerta de lectura: ni un administrador lee un canal ajeno privado ni un directo.
--   chat_mensajes .. id autoincremental (sirve de cursor). Texto plano ≤ 4.000. Borrar = lápida (cuerpo vacío + borrado_at). `menciones` = json de ids de cuenta, validados contra los miembros.
-- Poda: `chat_mensajes` a los 365 días (lib/mantenimiento.js); canales y miembros son acotados (cascada con users y canales). Sin adjuntos ni reacciones todavía (C4).
-- Cómo se deshace: `drop table if exists chat_mensajes; drop table if exists chat_miembros; drop table if exists chat_canales;` (nada más depende de ellas).
create table if not exists chat_canales (
  id text primary key,
  tipo text not null check (tipo in ('general','canal','directo','grupo','registro')),
  nombre text not null default '',
  clave_nombre text,
  privado integer not null default 0,
  clave_directo text unique,
  ref_tipo text,
  ref_id text,
  creado_por text references users(id) on delete set null,
  creado_at integer not null,
  archivado_at integer,
  ultimo_id integer not null default 0,
  ultimo_at integer
);
create unique index if not exists chat_canales_nombre on chat_canales (clave_nombre) where clave_nombre is not null;
create table if not exists chat_miembros (
  canal_id text not null references chat_canales(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  rol text not null default 'miembro' check (rol in ('dueno','miembro')),
  leido_hasta integer not null default 0,
  silenciado integer not null default 0,
  desde integer not null,
  primary key (canal_id, user_id)
);
create index if not exists chat_miembros_persona on chat_miembros (user_id);
create table if not exists chat_mensajes (
  id integer primary key autoincrement,
  canal_id text not null references chat_canales(id) on delete cascade,
  user_id text references users(id) on delete set null,
  tipo text not null default 'texto' check (tipo in ('texto','sistema')),
  cuerpo text not null default '',
  responde_a integer,
  menciones text not null default '[]',
  creado_at integer not null,
  editado_at integer,
  borrado_at integer
);
create index if not exists chat_mensajes_canal on chat_mensajes (canal_id, id);
create index if not exists chat_mensajes_viejos on chat_mensajes (creado_at);
