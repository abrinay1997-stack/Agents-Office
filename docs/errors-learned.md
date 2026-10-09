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

## [2026-10-09] — En Windows, «escribir a un temporal y renombrar» pierde guardados (EPERM al pisar un archivo abierto)

**Contexto:** Plan de Anuncios de Meta (fases A5 y B1). Tests que fallaban solo cuando corría toda la batería a la vez: «el aviso del piloto no llegó» y «la cola espera a la bloqueada».
**Error:** `notices.json` sin el aviso del piloto, aunque el anuncio sí se había pausado. A veces, un cambio de una tarea que no quedaba guardado.
**Causa raíz:** toda la oficina guarda con `fs.writeFileSync(tmp)` y luego `fs.renameSync(tmp, archivo)`. En Windows, renombrar encima de un archivo que otro proceso tiene abierto (la página, un antivirus, un test que lo lee) falla durante unos milisegundos con EPERM, EBUSY o EACCES. En `notice()` un `catch` se tragaba el error, y el aviso se perdía sin decir nada.
**Fix aplicado:** `fs-seguro.mjs → renombrar()`: reintenta con esperas cortas y, si no puede, copia el contenido encima. Lo usan los 31 archivos del servidor que guardaban así. `tests/fs-seguro.test.mjs` falla si vuelve a aparecer un `fs.renameSync` a pelo en el servidor.
**Prevención:** en código del servidor, nunca `fs.renameSync` directo: usar `renombrar` de `fs-seguro.mjs`. Un `catch` que se traga un error de disco al guardar algo del dueño es un fallo, no una protección. Un test que falla solo con carga en Windows suele ser esto o una espera fija.
**Archivos:** `fs-seguro.mjs`, `serve.mjs` (`notice`), `tareas/almacen.mjs` y los demás que guardan (`git grep renombrar`).

## [2026-10-09] — Tests que fallan al azar, cada vez uno distinto: demasiados servidores reales a la vez

**Contexto:** Plan de Anuncios de Meta (A5 a A7). `npm run check` fallaba una de cada dos o tres veces, siempre en un test que levanta su propio `serve.mjs` (`anuncios-control`, `tareas-ejecucion`, `anuncios-sugerencias`…), y cada uno pasaba solo.
**Error:** esperas que vencían («no llegó a tiempo…») o «Meta está saturado» contra el Meta de mentira.
**Causa raíz:** `node --test` corre a la vez un archivo por núcleo menos uno (7 en esta máquina de 8). Con varios `serve.mjs` reales, Chromium y servidores de mentira a la vez, la máquina se saturaba y los tiempos se iban.
**Fix aplicado:** `--test-concurrency=4` en `package.json → test` y en el paso de tests de `check.mjs`. 1079 de 1079 en dos vueltas seguidas, y tarda lo mismo (~2 min).
**Prevención:** si un test que levanta un servidor falla solo con toda la batería, probar primero con menos concurrencia antes de alargar sus esperas. Junto con «esperar al hecho» y «renombrar con reintento», son las tres causas que se vieron.
**Archivos:** `package.json`, `check.mjs` (paso «tests»)

## [2026-10-09] — Un parámetro objeto viajaba a Meta como «[object Object]» (y el Meta de mentira lo dejaba pasar)

**Contexto:** Primera prueba con el token real del dueño (`node scripts/check-meta-anuncios.mjs`).
**Error:** `(#100) For field 'insights': param time_range must be non-empty.`
**Causa raíz:** `graph()` de `contenido/meta.mjs` ponía cada parámetro en la dirección con `String(v)`, así que `time_range: { since, until }` salía como `[object Object]`. En los lotes no pasaba (allí se usaba `JSON.stringify`). El Meta de mentira leía `time_range` con un `JSON.parse` que fallaba en silencio y devolvía todo, así que ningún test lo vio.
**Fix aplicado:** un parámetro objeto va como JSON en `graph()`; el Meta de mentira responde el mismo error 100 que Meta si `time_range` no es un JSON con `since` y `until`; test en `tests/meta-freno.test.mjs`.
**Prevención:** un doble de una API externa debe RECHAZAR lo que la API real rechaza, no tolerarlo. Al añadir un parámetro objeto a una llamada a Meta, mirar cómo se serializa en ese camino (dirección, formulario o lote).
**Archivos:** `contenido/meta.mjs` (graph), `tests/meta-stand.mjs` (cifras)
