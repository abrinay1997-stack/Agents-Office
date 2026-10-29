-- N1 (Fase 8, 29 oct 2026): notas para cuando entres + última visita por cuenta. Todo detrás del flag APAGADO `notas.config.activo` (doc): con el flag apagado ninguna ruta escribe aquí.
--   notas_personales ... una nota que una persona le deja a otra (o a un rol, o a todos). Texto plano ≤ 500, color de una paleta corta, enlace opcional INTERNO ('tarea:<id>'…), vence sola (30 días por defecto, máx. 90).
--       para_tipo ........ 'persona' (para_valor = users.id) · 'rol' (admin|editor|lectura) · 'todos'. Una nota grupal se reparte AL LEER (llega a quien tenga cuenta mientras no venza).
--   notas_estado ....... por nota y por persona: cuándo se le entregó, la leyó, la cerró («eliminar para mí») o la reportó. Cascada: borrar la nota o la cuenta borra su estado.
--   presencia_cuenta ... una fila por cuenta: visto_at (última actividad, escrita como mucho cada 5 min), entro_at (inicio de la visita actual; una visita nueva = más de 30 min sin verla)
--       y visto_anterior (el visto_at de la visita anterior, para «mientras no estabas»). Nunca qué hizo dentro, ni IP ni dispositivo.
-- Poda: notas_personales 30 días después de vencer (lib/mantenimiento.js); notas_estado cae por cascada; presencia_cuenta es una fila por cuenta (acotada, cascada con users).
-- Cómo se deshace: `drop table if exists notas_estado; drop table if exists notas_personales; drop table if exists presencia_cuenta;` (nada más depende de ellas; con el flag apagado ya están sin uso).
create table if not exists notas_personales (
  id text primary key,
  de_user_id text not null references users(id) on delete cascade,
  para_tipo text not null check (para_tipo in ('persona','rol','todos')),
  para_valor text not null default '',
  cuerpo text not null,
  color text not null default 'amarillo',
  enlace text,
  creada_at integer not null,
  vence_at integer not null
);
create index if not exists notas_personales_para on notas_personales (para_tipo, para_valor, vence_at);
create index if not exists notas_personales_de on notas_personales (de_user_id, creada_at);
create index if not exists notas_personales_vence on notas_personales (vence_at);
create table if not exists notas_estado (
  nota_id text not null references notas_personales(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  entregada_at integer,
  leida_at integer,
  cerrada_at integer,
  reportada_at integer,
  primary key (nota_id, user_id)
);
create index if not exists notas_estado_persona on notas_estado (user_id, cerrada_at);
create table if not exists presencia_cuenta (
  user_id text primary key references users(id) on delete cascade,
  visto_at integer not null,
  entro_at integer not null,
  visto_anterior integer
);
