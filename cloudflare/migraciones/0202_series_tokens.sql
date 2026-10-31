-- Series en la nube, N4 (carril K): el token de UN solo uso de GENERAR SERIE (2 minutos, atado a la escaleta, a la cifra y a los topes) y la huella de la Idempotency-Key de ese clic.
-- Tabla aparte de `anuncios_tokens` (cuyo CHECK de tipo no se cambia sin reconstruirla): mismo contrato, misma regla de «solo una petición se lo lleva» (un DELETE que cambia una fila).
create table if not exists series_tokens (
  token text primary key,
  json text not null check (json_valid(json)),
  caduca integer not null          -- ms desde 1970: pasado este momento, el token ya no existe
);
create index if not exists series_tokens_caduca on series_tokens(caduca);
