-- Fase 7: el tope de peticiones del webhook público de conversiones (60 por minuto), contado en D1 porque un Worker no recuerda entre peticiones.
-- Una fila por minuto; las viejas se borran solas al contar.
create table if not exists anuncios_tasa (
  ventana integer primary key,     -- el minuto (ms desde 1970 ÷ 60000, entero)
  n integer not null default 0
);
