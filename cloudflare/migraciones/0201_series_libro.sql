-- Series en la nube, N1 (carril K, 30 oct 2026): el LIBRO del dinero de las series. Una fila por intento de un plano (`clave` = `serie:n:intento`, igual que en local).
--   Sin clave ajena a `series` A PROPÓSITO: es contabilidad, y un restablecimiento o la poda de una serie nunca debe borrar lo que se reservó o se gastó (lib/restablecer.js la conserva).
--   Estados: reservado → liquidado | liberado | incierto (un envío a un motor de pago que pudo cobrarse y no se sabe: sigue contando contra los topes hasta que el dueño decide).
--   Todo en micro-USD enteros (1e6 = US$1), como serie-topes-core.mjs. `salio` = 0 solo si se sabe con certeza que nada llegó al motor (el cupo diario se devuelve únicamente entonces).
--   La reserva es UNA sentencia con las tres condiciones (tope de la serie, tope del mes de carruseles, cupo del día): dos reservas a la vez no pueden pasarse del tope (lib/series/libro.js).
-- Poda: lo ya cerrado (liquidado o liberado) a los 400 días; lo reservado o incierto NUNCA se poda (lib/mantenimiento.js). Se lee con índice por serie, por mes y por día.
-- Cómo se deshace: `drop table if exists series_libro;`.
create table if not exists series_libro (
  clave text primary key,
  serie_id text not null,
  n integer not null,
  intento integer not null,
  estado text not null check (estado in ('reservado', 'liquidado', 'liberado', 'incierto')),
  max_micro integer not null,
  real_micro integer not null default 0,
  excedio integer not null default 0,
  mes text not null,
  dia text not null,
  carrusel integer not null default 0,
  peso integer not null default 1,
  salio integer not null default 1,
  at integer not null
);
create index if not exists series_libro_serie on series_libro (serie_id, estado);
create index if not exists series_libro_mes on series_libro (mes, carrusel, estado);
create index if not exists series_libro_dia on series_libro (dia, estado);
create index if not exists series_libro_at on series_libro (at);
