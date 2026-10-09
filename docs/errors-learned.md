# Errores aprendidos

Una entrada por error que costó encontrar. Solo se añade al final.

## [2026-10-01] — El atributo `hidden` no oculta un elemento con `display` propio

**Contexto:** Integración F2 del banco de presets: la pestaña Lotes del Estudio debía tapar el compositor y la galería.
**Error:** Al abrir Lotes, el compositor y la galería seguían a la vista encima de los lotes (captura `6-terminado`).
**Causa raíz:** `.st-body { display: grid }` en `src/shell.html` gana a la regla del navegador `[hidden] { display: none }`, así que `el.hidden = true` no hacía nada.
**Fix aplicado:** `#studioOv[data-pane="lotes"] .st-body { display: none; }` en `src/css/estudio-lotes.css`.
**Prevención:** Para ocultar algo que tiene `display` en su CSS, usa una regla con el estado (`[data-pane=…]`, `[hidden]` explícito) y compruébalo en una captura, no solo por el atributo.
**Archivos:** `src/css/estudio-lotes.css`, `src/studio.js` (showPane)

## [2026-10-01] — La página pasó su presupuesto de peso al juntar dos equipos

**Contexto:** Juntar `lane/presets-lotes-ui` (la interfaz de los lotes) en `presets/base`.
**Error:** `npm run check` → «the page passed its budget: 2,22 MB (max 2,2) · 702 KB gzip (max 700)».
**Causa raíz:** Cada equipo midió su rama sola; juntas suman ~45 KB más. El CSS de `src/css/` entraba con todos sus comentarios.
**Fix aplicado:** `build.mjs` quita comentarios y blancos de más del CSS de las vistas al empaquetar (`cssCorto`), ~36 KB: 2,19 MB y 694 KB gzip.
**Prevención:** El integrador corre `npm run check` (no solo `npm test`) después de cada merge. Lo próximo grande se carga bajo demanda, junto a la página, como `dist/presets-fabrica.js`.
**Archivos:** `build.mjs:23`, `check.mjs:34`

## [2026-10-08] — La fecha de caducidad de una versión de Meta no es la misma en la Graph API y en la Marketing API

**Contexto:** Fase 0 de Anuncios: pasar `contenido/meta.mjs` de Graph v23.0 a v26.0.
**Error:** El plan decía «v23.0 dejó de existir el 9 de junio de 2026». La página de versiones de la Graph API dice que v23.0 vive hasta el 8 de octubre de 2027.
**Causa raíz:** Meta publica dos tablas de versiones con fechas distintas. La de la Marketing API caduca mucho antes (v23: 9 jun 2026; v24: 6 oct 2026) que la de la Graph API.
**Fix aplicado:** Tabla `VERSIONES` en `contenido/meta.mjs` con las dos fechas por versión, y un paso de `npm run check` que avisa cuando cualquiera de las dos baje de 90 días.
**Prevención:** Al hablar de la caducidad de una versión de Meta, decir de cuál de las dos API es. La que manda para la oficina es la más corta, porque usa una sola versión para todo.
**Archivos:** `contenido/meta.mjs` (VERSIONES, caducidad), `check.mjs` (paso «meta»)

## [2026-10-08] — Reescribir un archivo desde PowerShell lo pasa entero a CRLF

**Contexto:** Añadir una línea al README con `[IO.File]::WriteAllLines` en PowerShell.
**Error:** `git diff --stat` daba 991 líneas cambiadas en vez de 1.
**Causa raíz:** `WriteAllLines` usa el fin de línea de Windows (CRLF), y el repositorio está en LF.
**Fix aplicado:** Volver a escribir el archivo con `-replace "`r`n", "`n"` y `WriteAllText`.
**Prevención:** Para editar archivos del repositorio, usar Edit/Write o un heredoc en Bash, nunca `WriteAllLines` ni `Set-Content`. Después de editar desde la consola, mirar `git diff --stat`.
**Archivos:** `README.md`
