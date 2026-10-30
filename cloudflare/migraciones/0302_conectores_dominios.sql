-- SEG-02 (30 oct 2026): «Dominios que puede consultar» de un conector. JSON con una lista de hosts (`ejemplo.com` cubre sus subdominios, `*.ejemplo.com`), validada en lib/conectores.js (validarDominios, ≤ 20).
-- Vacío o nulo = como siempre. Solo cuenta con el ajuste `safety.dominiosPorConector` encendido (apagado por defecto). Es una columna de una tabla que ya está acotada (≤ 40 filas): no hay tabla nueva que podar.
-- OJO: es la primera migración con `alter table add column` (SQLite no admite `if not exists` ahí): NO es reaplicable a mano; solo la aplica wrangler, una vez. Excepción explícita en cloudflare/tests/despliegue.test.mjs (ALTER_PERMITIDOS).
alter table conectores_extra add column dominios_permitidos text;
