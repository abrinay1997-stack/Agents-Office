-- Series en la nube, N1 (carril K, 30 oct 2026). Todo detrás de los interruptores `dimitri.seriesNube` y `dimitri.seriesNubePago` (apagados por defecto): sin ellos esta tabla no se toca.
--   series .. UNA fila por serie de imágenes (storyboard, carruseles): `json` es la serie como la guarda la oficina local (escaleta, pasos, intentos, autorización…; ≤ 1 MB, el límite de fila de D1 es 2 MB).
--             `version` es el candado: un cambio solo se guarda si nadie más lo cambió desde que se leyó (la bomba del reloj y el clic del dueño no se pisan).
--             El DINERO no vive aquí sino en `series_libro` (0201): una sentencia atómica por reserva.
-- Poda: las series terminadas (hecho o cancelado) a los 180 días (lib/mantenimiento.js). Una serie viva no se poda nunca.
-- Cómo se deshace: `drop table if exists series;` (nada depende de ella; las imágenes son archivos normales de la galería).
create table if not exists series (
  id text primary key,
  estado text not null,
  version integer not null default 1,
  json text not null,
  creada integer not null,
  actualizada integer not null
);
create index if not exists series_estado on series (estado, actualizada);
