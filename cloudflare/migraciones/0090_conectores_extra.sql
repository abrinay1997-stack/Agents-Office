-- Conectores MCP: lo que se añade DESDE la página (25 oct 2026). La tabla `conectores` no cambia; esto va aparte para no tocar lo ya desplegado.
--   auth_tipo     ninguna | bearer | cabecera  (cómo se presenta el token al servidor MCP)
--   cabecera      el nombre de la cabecera cuando es «cabecera» (p. ej. X-API-Key); nunca authorization/cookie/host…
--   token_cifrado el token guardado desde la página, cifrado con AES-GCM (lib/cifrado.js). Jamás en claro; ninguna ruta lo devuelve.
--   plantilla     de qué plantilla viene (zapier, n8n, gmail…) para su icono
--   etiqueta      el nombre que se ve (el `nombre` de la tabla conectores es un identificador)
create table if not exists conectores_extra (
  nombre text primary key,
  auth_tipo text not null default 'bearer' check (auth_tipo in ('ninguna','bearer','cabecera')),
  cabecera text,
  token_cifrado text,
  plantilla text,
  etiqueta text,
  updated_at text not null
);
