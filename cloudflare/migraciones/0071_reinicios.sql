-- Restablecer la contraseña de alguien (admin): un enlace de un solo uso para una cuenta que ya existe. Solo va el SHA-256 del testigo.
create table if not exists reinicios (
  id text primary key,
  token_hash text not null unique,
  user_id text not null references users(id) on delete cascade,
  creado_por text references users(id) on delete set null,
  created_at text not null,
  expires_at text not null,
  usado_at text
);
