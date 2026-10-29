# Estado — Carril E · Fase 5 (íconos originales, C09) · rama `carril-e-iconos`

Archivos que toca: `src/iconos-registro.mjs` (nuevo), `src/redes-iconos.js`, `src/mcplogos.js`, `src/connectors.js`, `src/mcp.js` (1 línea), `mcp.mjs` (`export ALIASES`), `check.mjs` (paso del ícono de Chrome), `cloudflare/worker/lib/iconos-conectores.js`, `CLAUDE.md`, pruebas nuevas. Sin migraciones, sin flags.

- ✅ **Registro único** `{ id → { nombre, capas:[{d, fill, trazo?, degradado?}], placa?, origen, fuente } }`, multicolor (YouTube, Instagram con su degradado). 50 entradas: 11 redes (+ Telegram y WhatsApp/Messenger), 28 conectores con logo de Simple Icons (`simple-icons@15.0.0`) y 11 pictogramas propios con placa y `origen:'propio'` (Loops, beehiiv, FullEnrich, Apollo, PandaDoc, HyperFrames, Clarity, Playwright, Higgsfield, TerriTool, «Otro»). Cada entrada lleva `fuente`.
- ✅ **ICO-01/02** El mismo SVG en nube y escritorio (`iconoTesela`); `PLANTILLAS[].icono` apunta al registro; se revoca en `CLAUDE.md` la decisión de `iconos-conectores.js:1-5`. Zapier, n8n, Make, GitHub, HubSpot, Airtable, Cloudflare, Linear y Asana ya tienen logo.
- ✅ **ICO-03** Cobertura: `tests/iconos-registro.test.mjs` (redes, `MCP_LOGOS`, `MCP_BY_DEPT`, cada clave de `mcp.mjs → ALIASES`, cada plantilla; contraste de las placas propias; sin WebP; sin hosts externos) e igualdad nube/escritorio en `cloudflare/tests/iconos-paridad.test.mjs`.
- ✅ **ICO-04** `mcplogos.js` ya no lleva las 24 teselas WebP: se arman desde el registro (vectores, mismo `{name, img}`). Sin «paquete bajo demanda»: no hizo falta (ver supuestos).
- ✅ **ICO-06** Un solo monograma (`monograma()`); `connectors.js → tile()` ya no usa canvas y prefiere el logo si el nombre/clave es conocido.
- ✅ **ICO-07** Telegram entra al registro; una red/servicio sin entrada rompe la prueba en vez de caer en silencio.
- ✅ `check.mjs:409` ahora comprueba `ICONOS.chrome` en el registro.
- ⏸ ICO-05 (`alt`), ICO-08 (guía de uso de LinkedIn), ICO-09 (mín. 16 px), ICO-10 (44 px), ICO-11 (contraste de Instagram/Pinterest en oscuro), favicon por conector del usuario (`/api/icono-conector`): no hechos en este PR.

**Bytes de la página** (`node build.mjs`, main `a865370` vs rama): 2.178.530 → 2.055.576 B (**−122.954 B**); gzip −9: 666.939 → 596.309 B (**−70.630 B**). Margen contra el tope sube a ~251 KB.

## Segunda entrega (rama `carril-e-iconos-2`)
- ✅ ICO-05 `netBadges` (tarjetas de Contenido) y los contadores por red de «Crear publicación» (móvil) llevan `iconoRed(r, {titulo})` (role=img + nombre); las `<img alt="">` de conectores del móvil se dejan: el nombre va al lado.
- ✅ ICO-08 LinkedIn solo pictograma propio (ya en #80); placa a #0C7BB8 (4,6:1 con blanco y 3,6:1 sobre el fondo oscuro).
- ✅ ICO-09 `iconoRed` mínimo 16 px (antes 14), reglas CSS de 14/15 px a 16; emite `data-r`.
- ✅ ICO-10 `.pv-tabs [role=tab]` 44 px con `pointer: coarse` o ≤ 820 px (30 en escritorio). `.md-cont` (contador del móvil) NO es un control: se deja en 28 px y se le pone nombre y 16 px de logo.
- ✅ ICO-11 `oscuro` por capa en el registro (Pinterest #E5384A) + `src/css/iconos.css`; prueba de ≥ 3:1 sobre #1E1F24 para todas las redes. WhatsApp e iMessage ya dan > 8:1 en oscuro.
- Pruebas: `tests/iconos-registro.test.mjs` (ampliado) y `tests/iconos-navegador.test.mjs` (se salta solo si Chromium no arranca).
- Bytes de la página (main 75e0382 vs rama): 2.056.259 → 2.056.408 B (+149 B); gzip −9 596.459 → 596.617 B (+158 B).
