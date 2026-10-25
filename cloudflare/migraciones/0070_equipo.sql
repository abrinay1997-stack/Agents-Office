-- Fase 10: equipo, invitaciones, perfil y presencia. Todo `create` lleva `if not exists`.
-- El perfil va en su propia tabla (y no con `alter table users`): un `alter` no se puede reaplicar.
create table if not exists perfiles (
  user_id text primary key references users(id) on delete cascade,
  nombre text not null default '',
  color text not null default '',
  foto_clave text,            -- clave en R2 (perfiles/<id>); nunca una dirección
  foto_tipo text,             -- tipo reconocido por los primeros bytes (jpeg | png | webp)
  foto_at text,               -- cuándo se subió: sirve de ?v= para la caché del navegador
  baja_at text,               -- quitado del equipo (la cuenta se conserva: las ejecuciones antiguas apuntan a ella)
  updated_at text
);

-- Una invitación es un enlace de un solo uso. En la base solo va el SHA-256 del testigo, nunca el testigo.
create table if not exists invitaciones (
  id text primary key,
  token_hash text not null unique,
  email text not null,
  nombre text not null default '',
  rol text not null check (rol in ('admin','editor','lectura')),
  creada_por text references users(id) on delete set null,
  created_at text not null,
  expires_at text not null,
  aceptada_at text,
  aceptada_por text,
  revocada_at text
);
create index if not exists invitaciones_email on invitaciones(email);

-- Límite de intentos (acceso e invitaciones) por clave (ip) y minuto. El Worker no recuerda entre peticiones: se cuenta en D1.
create table if not exists acceso_intentos (
  clave text not null,
  ventana integer not null,
  n integer not null default 0,
  primary key (clave, ventana)
);
