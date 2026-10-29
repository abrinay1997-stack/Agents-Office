-- Fase 1.a del Estudio (29 oct 2026): carpetas en árbol. Borrar, mover y contar por carpeta filtran por `folder`, que vive DENTRO de la ficha (json).
-- Un índice de expresión lo hace barato sin cambiar la tabla ni duplicar el dato (una columna generada no se puede añadir con seguridad a una tabla viva).
-- Las consultas usan EXACTAMENTE json_extract(json, '$.folder') para que SQLite use este índice.
-- Cómo se deshace: drop index if exists estudio_archivos_carpeta;  (no se pierde ningún dato; solo vuelven a ser consultas sin índice)
create index if not exists estudio_archivos_carpeta on estudio_archivos(json_extract(json, '$.folder'));
