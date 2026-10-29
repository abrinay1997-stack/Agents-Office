-- SEG-08 (D14): cuántas veces entra un webhook público con el secreto en la dirección (?token=), por ruta y día, para saber cuándo se puede retirar.
-- Una fila por (ruta, día): nunca guarda el token ni nada de quien llama. Se poda a los 60 días (lib/disparadores.js → limpiarEventos). Todo `create` lleva `if not exists`.
create table if not exists hook_token_query (
  clave text not null,                     -- 'hook' | 'kpi'
  dia integer not null,                    -- días desde 1970 (UTC)
  n integer not null default 0,
  primary key (clave, dia)
);
