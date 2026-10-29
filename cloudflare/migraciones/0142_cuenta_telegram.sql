-- N2 (Fase 8, 29 oct 2026): vincular Telegram a una CUENTA (D01–D04). Una fila por cuenta (acotada; cascada con users). Todo detrás del flag `notificaciones.config.activo`.
--   telegram_id ........... el id de Telegram YA confirmado (único: un id sirve para UNA cuenta). Null mientras la cuenta no está vinculada.
--   codigo_hmac / codigo_vence_at ... el código de vinculación que pidió la app: de 10 caracteres sin ambiguos, guardado como HMAC con un secreto del Worker (nunca en claro), un solo uso, 10 minutos.
--   pend_telegram_id / pend_username / pend_vence_at ... lo canjeado en el bot que espera la CONFIRMACIÓN en la app (Confirmar / Rechazar); caduca a los 10 minutos.
--   silencio_hasta ........ «no molestar» hasta ese instante (ms) · silencio_desde_h / silencio_hasta_h: ventana diaria en horas de la oficina (null = sin ventana).
-- Poda: una fila por cuenta, sin crecimiento. Un código o un pendiente caducado NO sirve (se comprueba el vencimiento en cada uso) y se sobrescribe al pedir uno nuevo. Quitar a la persona del equipo la desvincula (cascada + baja_at).
-- Cómo se deshace: `drop table if exists cuenta_telegram;` (nada depende de ella; con el flag apagado queda sin uso).
create table if not exists cuenta_telegram (
  user_id text primary key references users(id) on delete cascade,
  telegram_id text unique,
  telegram_username text,
  vinculada_at integer,
  codigo_hmac text,
  codigo_vence_at integer,
  pend_telegram_id text,
  pend_username text,
  pend_vence_at integer,
  silencio_hasta integer,
  silencio_desde_h integer,
  silencio_hasta_h integer
);
create index if not exists cuenta_telegram_codigo on cuenta_telegram (codigo_hmac);
