-- N0 (Fase 8, 29 oct 2026): notificaciones POR PERSONA. Es una PROYECCIÓN ADICIONAL de los avisos de la oficina (lib/avisos.js → emitirAvisos): `filas('avisos')` y el doc `notices`
-- siguen siendo lo que leen el semáforo y Dimitri; esta tabla solo dice a QUIÉN le toca cada aviso y si ya lo leyó. Apagada por defecto (doc `notificaciones.config`, `activo`).
--   user_id ........ la persona (cascada: una cuenta que se borra se lleva sus notificaciones)
--   aviso_id ....... el aviso global del que sale; (user_id, aviso_id) es único: reproyectar el mismo aviso no duplica
--   categoria ...... notas · chat · menciones · aprobaciones · tareas · contenido · agentes · anuncios · bandeja · sistema (lib/notificaciones.js decide qué rol ve cuál)
--   titulo ......... el texto del aviso, recortado (≤ 240); sin cuerpo largo: el detalle vive en su destino
--   enlace ......... destino interno opcional ('tarea:<id>'), nunca una URL
--   causante_id .... quien lo provocó (si se sabe): nunca se le avisa a él
-- Poda: leídas a los 60 días y sin leer a los 180 (lib/mantenimiento.js). Sin texto privado de terceros más allá del aviso ya existente.
-- Cómo se deshace: `drop table if exists notificaciones;` (nada más depende de ella; el flag apagado ya la deja sin uso). No toca ninguna tabla existente.
create table if not exists notificaciones (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  aviso_id text not null,
  categoria text not null,
  nivel text not null default 'info',
  titulo text not null,
  enlace text,
  clave_dedupe text,
  causante_id text,
  creada_at integer not null,
  leida_at integer
);
create unique index if not exists notificaciones_aviso on notificaciones (user_id, aviso_id);
create index if not exists notificaciones_persona on notificaciones (user_id, leida_at, creada_at desc);
create index if not exists notificaciones_creada on notificaciones (creada_at);
