-- Fase 6: Dimitri, Negocio, Ajustes, Telegram y los disparadores. Todo `create` lleva `if not exists`.
-- (El chat de Dimitri, los indicadores, los ajustes, el estado de Telegram y los disparadores van en `docs`/`filas`; aquí solo lo que necesita un índice o ser atómico.)

-- Los eventos que ya llegaron por un disparador (POST /api/hook/<id>): el mismo evento dos veces se toma UNA vez (insert or ignore cambia una fila para una sola petición),
-- y contar las filas de la última hora es el tope `perHour`. `evento` es el id que trae la fuente (o uno inventado para los que no traen: así también cuentan para el tope).
create table if not exists hook_eventos (
  disparador text not null,
  evento text not null,
  t integer not null,                      -- ms desde 1970
  primary key (disparador, evento)
);
create index if not exists hook_eventos_t on hook_eventos(disparador, t);

-- El tope de peticiones por minuto de cada ruta pública (el Worker no recuerda entre peticiones): una fila por (ruta, minuto).
create table if not exists publica_tasa (
  clave text not null,
  ventana integer not null,                -- el minuto (ms ÷ 60000, entero)
  n integer not null default 0,
  primary key (clave, ventana)
);

-- Las actualizaciones de Telegram ya atendidas (update_id): Telegram reintenta si tardamos, y un botón no se pulsa dos veces.
create table if not exists telegram_updates (
  update_id integer primary key,
  t integer not null
);
