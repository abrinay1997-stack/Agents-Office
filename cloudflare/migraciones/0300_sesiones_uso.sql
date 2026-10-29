-- SEG-05 (Fase 7): cuándo se usó por última vez cada sesión. Tabla aparte (no `alter table sessions`): una sesión sin fila aquí sigue valiendo y su "último uso" es su creación,
-- así que desplegar esto NO desloguea a nadie y la migración se puede reaplicar. Solo se lee/escribe con el flag `sesion.deslizante` (config-local) encendido.
-- Cómo se deshace: apagar el flag (nada la lee) y, si hace falta, `drop table sesiones_uso;` — no hay datos que perder.
create table if not exists sesiones_uso (
  token_hash text primary key references sessions(token_hash) on delete cascade,
  last_used_at text not null
);
