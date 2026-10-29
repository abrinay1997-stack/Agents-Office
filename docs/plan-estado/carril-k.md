# Carril K — Fase 11.0 `serie-core.mjs` puro (rama `carril-k-110-serie-core`)

- ✅ `serie-core.mjs`: estados (previsto · espera_ok · muestra · corriendo · pausado · hecho · cancelado) y transiciones; plano con versiones y aprobación por versión; `validarEscaleta` (refs sobre `maxRefs` → `skipped` con motivo, modelo apagado, ref perdida, precio fuera de catálogo; nunca recorta); tandas ≤8; `hashEscaleta` (SHA-256 síncrono propio, igual a node:crypto); `claveIdempotencia` `serie_id:n:intento`; token de un solo uso (`emitirToken`/`verificarToken`/`consumirToken`, reloj y nonce inyectados); `siguientePaso` es el ÚNICO productor de acciones de gasto y exige token+hash; `validarOpSerie` (§13.1) rechaza aprobar/programar/publicar y las ops de gasto fuera del dueño; `ajustarReferencias` (producto > personaje > biblia > anterior; rechazo si lo obligatorio no cabe).
- ✅ `serie-topes-core.mjs`: `CONFIG_SERIE` (US$10/serie, US$45/mes carruseles, 1 reintento, 25 % de cupo fuera de series); micro-USD enteros; `reservar → liquidar` idempotente por clave, `liberar`, `marcarIncierto`/`resolverIncierto` («puede haberse cobrado»), tope de mes, cupo diario con `estudio-pesos.mjs`.
- ✅ `serie-deriva-core.mjs`: 4 ejes + ΔE (CIE76), `fidelidadPaleta`, `evaluarDeriva` (pausa con dos seguidos <3/5), re-anclaje cada 5, anclas fijas.
- ✅ Tests: `tests/serie-core.test.mjs`, `serie-topes.test.mjs`, `serie-deriva.test.mjs` (28 casos, incluido el de «dinero»).
- ℹ️ Peso de música: no hay inconsistencia real. `trabajos-core.mjs:26` usa `audios + music*2` porque `spendOn` cuenta la música TAMBIÉN en `audios` (1 + 2 = 3); `weightOf` de `estudio-pesos.mjs` da 3. Es fácil de leer mal; no se tocó. Antes de 11.3, conviene un comentario o que `trabajos-core` use `weightOf`.
- ⏳ No hecho (a propósito): persistencia, rutas, UI, llamadas a modelos, migraciones (rango K 0200-0219 sin usar).

# Fase 11.1 «Ver y describir» (3 PR máx.)

## PR 1 (rama `carril-k-111`) — núcleo puro + búsqueda
- ✅ `descripcion-core.mjs` (puro): ficha de descripción (`desc`, `etiquetas`, `texto_visible`, `personas`, `producto`, `calidad`, `apta_para`, `confianza`, `desc_modelo`, `desc_version`, `desc_huella`), truncado a 300, `injectionIn` → `desc_sospecha` (no entra a prompts ni a la búsqueda), caché por huella+versión (`necesitaDescribir`), `planDescripcion` (tandas de 4, costo estimado, tope y máximo SIN recortar en silencio, omitidas con motivo), prompt de visión, `leerRespuesta` tolerante, `resumenParaChat` (≤3.500, paginado).
- ✅ `media/privacidad-core.mjs → puedeEnviar()` única: carpeta/imagen privada, personas sin consentimiento, destino no declarado y Meta Contributor (nunca).
- ✅ `src/galeria-filtro.js → haystack`: la búsqueda encuentra por lo descrito (nunca lo sospechoso). Página: +105 B.
- ✅ Tests: `tests/descripcion-core.test.mjs`.
- Archivos: `descripcion-core.mjs`, `media/privacidad-core.mjs`, `src/galeria-filtro.js` (1 línea), tests. Sin migraciones, sin flags, sin rutas.

## Pendiente de 11.1 (honesto)
- ⏳ PR 2: adaptador local (`describir-local.mjs`: escribe la ficha con tmp+`renombrar`, ledger `kind:'vision'`, auditoría `envio-tercero`), ruta `POST /api/media/describir` (enganche ≤10 líneas en serve.mjs), MCP de solo lectura `dimitri-lectura-mcp.mjs` (test: ninguna herramienta gasta).
- ⏳ Bucle de herramientas de lectura de Dimitri en local (`askX` rama sin agente) y `ver_galeria`/`ver_imagen` en la nube + trabajo `describir_imagenes` del Worker: no hechos.
