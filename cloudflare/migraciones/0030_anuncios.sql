-- Fase 7 (Anuncios de Meta y la Bandeja): lo único que NO puede vivir en un archivo espejado.
--  · anuncios_tokens  — los tokens de un solo uso del dinero: la confirmación de un gasto (2 min, atada a tipo + id + valor) y los de DESHACER
--                       (anuncios y Bandeja). Se consumen con un DELETE: solo una petición se lleva el token (la regla de los dos clics).
--  · anuncios_candados — «solo uno a la vez» entre peticiones y cron: una acción sobre la cuenta publicitaria, una creación en Meta, una
--                       respuesta a un cliente. Caducan solos (si el Worker muere con el candado puesto, se suelta a los pocos minutos).
-- El resto del estado (borradores, cifras, sugerencias, bandeja…) se guarda como documentos `fs:…` en `docs` (cloudflare/worker/lib/espejo.js).
create table if not exists anuncios_tokens (
  token text primary key,
  tipo text not null check (tipo in ('conf', 'desh', 'bandeja')),
  json text not null check (json_valid(json)),
  caduca integer not null          -- ms desde 1970: pasado este momento, el token ya no existe
);
create index if not exists anuncios_tokens_caduca on anuncios_tokens(caduca);

create table if not exists anuncios_candados (
  clave text primary key,
  hasta integer not null,          -- ms desde 1970
  quien text not null default ''
);
