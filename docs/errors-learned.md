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
