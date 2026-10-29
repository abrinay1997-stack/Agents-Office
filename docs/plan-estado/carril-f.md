# Carril F · Fase 6 (velocidad), Ola 3 — estado

Rama PR 1: `mejora/ola3-f-per04` (PER-04). Rama PR 2: `mejora/ola3-f-con11-con09` (CON-11 pasos 1-2 y medición CON-09).

| Ítem | Estado | Notas |
|---|---|---|
| PER-04 / C06 | ✅ (PR 1) | `?v=` ya lo mandan los cuatro cargadores (`estudio-extra`, `tareas-vista`, `anuncios-vista`, `pieza-editor`). **Desviación del plan:** `_headers` no distingue la query (`?v=`), así que la regla `immutable` la pone el Worker (`cacheDePaquete` en `paginas.js`), solo en respuestas 200, con `v` válida (4-64 caracteres, no `dev`) y solo para esos cuatro. `PAQUETES` pasó de `Set` a regex. `dictado`, `movil`, `movil-d`, `ajustes-extra` siguen sin versión y `no-cache`. El ETag y la compresión de Cloudflare no se tocan. `_headers`, `wrangler.jsonc` y `.github/workflows` NO se tocaron. |
| CON-11 paso 1 | ✅ (PR 2), solo medido | La caché por isolate del espejo ya existía (`espejo.js`, `ponerCache`) y `flush` ya vuelca solo lo cambiado; un GET de la Bandeja en caliente cuesta 3 lecturas de D1 y 0 escrituras (test). No se cambió `espejo.js`. |
| CON-11 paso 2 | ✅ (PR 2) | `crearBandeja({ almacen: { leer, escribir } })`; sin `almacen`, el archivo de siempre (local intacto). En la nube, `almacenEnMemoria` (`anuncios-nube.js`): lee el archivo del espejo una vez por petición y escribe al archivo en el acto (el diario «enviando» sigue en el espejo antes del volcado previo a Meta). |
| CON-11 paso 3 (tabla `bandeja_items`, flag `nube.bandejaTabla`) | ⏳ no hecho | Fuera de esta entrega. No reservé migración. |
| CON-09 | ✅ medido (PR 2) | `cloudflare/tests/medir-peticiones.test.mjs`. Línea base (lecturas D1 por petición, incluida 1 de la sesión): `/api/contenido?desde&hasta` 9, `/api/contenido/cola` 7, `/api/contenido/bandeja` 4, GET Bandeja con `conBandeja` en caliente 3. Los techos del test son esa línea base. **No se cambió la frecuencia ni el endpoint** (siguiente paso: un endpoint `programacion` con ETag). |
| CON-12 / PER-06 | ⏳ no tocado | Difusión por el Hub, a propósito. |

## Archivos que toco
`cloudflare/worker/lib/paginas.js`, `cloudflare/tests/paginas.test.mjs` (PR 1); `contenido/bandeja.mjs`, `cloudflare/worker/lib/anuncios-nube.js`, `cloudflare/tests/medir-peticiones.test.mjs` (PR 2). Ninguna migración, ningún flag. Bytes de la página: 0 (no se tocó `src/`).

## Pasos manuales tras desplegar (PER-01 / PER-04, no verificables en test unitario)
Con sesión (cookie) y `<V>` la versión que pide la página (mírala en la pestaña Red del navegador al abrir Tareas):
1. `curl -sI -H "Cookie: …" "https://<dominio>/tareas-vista.js?v=<V>" | grep -i "cache-control\|etag\|content-encoding"` → `private, max-age=31536000, immutable`, un `etag` y `content-encoding` puesto por Cloudflare (br/gzip con `-H "Accept-Encoding: br"`).
2. Lo mismo sin `?v=` → sigue `private, no-cache`.
3. `curl -sI -H "If-None-Match: <etag>" …` sin `?v=` → 304.
4. En el navegador: recargar con Tareas abierta y comprobar en Red que el paquete sale «(memoria caché)».
