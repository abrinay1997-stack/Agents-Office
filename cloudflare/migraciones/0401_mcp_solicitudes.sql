-- Gastos que Claude PIDE por el conector MCP (P4 del plan docs/plan-mcp-oficina-panaclaw.md, §14.2): una TARJETA «espera tu OK» por pedido. Nada de esto gasta: es la solicitud.
-- El paso 2 (aprobar y ejecutar por la ruta de siempre) lo da SOLO una persona con su sesión o por Telegram; un testigo de MCP no llega a estas filas ni a su ruta.
-- Todo `create ... if not exists` (sin `alter table`). Los tiempos son milisegundos del reloj inyectable (lib/mcp/config.js). `args` son los argumentos YA normalizados de la herramienta (sin secretos).
create table if not exists mcp_solicitudes (
  id text primary key,
  familia text not null,                                             -- la conexión (familia de mcp_tokens) que la pidió
  user_id text not null,                                             -- la persona dueña de esa conexión
  conexion text not null,                                            -- cómo se llama la conexión en Ajustes (informativo)
  herramienta text not null,                                         -- generar_imagen, generar_video, generar_voz, generar_musica, aplicar_preset, crear_lote
  args text not null check (json_valid(args)),
  resumen text not null,                                             -- lo que se pide, en una frase corta (lo escribe el servidor)
  cifra_usd real not null,                                           -- LA CIFRA LA CALCULA EL SERVIDOR al crear; un argumento «costo» del cliente se ignora
  cifra_nota text,                                                   -- cuándo la cifra es por foto o aproximada
  topes text not null check (json_valid(topes)),                     -- los topes de ese momento (solo números)
  hash text not null,                                                -- SHA-256 de herramienta + args: la misma petición no abre dos tarjetas
  estado text not null check (estado in ('espera','ejecutando','ejecutada','rechazada','vencida','descartada','incierta')),
  motivo text,                                                       -- «incierta» = salió algo mal DESPUÉS de empezar: puede haberse gastado; la persona revisa el Estudio
  creada_at integer not null,
  vence_at integer not null,
  resuelta_at integer,
  resuelta_por text
);
create index if not exists mcp_solicitudes_familia on mcp_solicitudes(familia, creada_at);
create index if not exists mcp_solicitudes_estado on mcp_solicitudes(estado, vence_at);
-- la misma petición (mismo hash) de una conexión no abre dos tarjetas a la vez, ni aunque lleguen juntas
create unique index if not exists mcp_solicitudes_hash_espera on mcp_solicitudes(familia, hash) where estado = 'espera';
