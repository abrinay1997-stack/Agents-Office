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

## PR 2 (rama `carril-k-111b`, sobre PR 1) — adaptador local, ruta y MCP de lectura
- ✅ `describir-local.mjs`: `plan`/`leer` (no gastan) y `ejecutar` (exige `confirmarUsd` ≥ estimado, flag `estudio.descripcionesIA` encendido, vigila el tope con lo gastado de verdad ANTES de cada tanda, auditoría `envio-tercero` por imagen, `kind:'vision'` en el ledger vía `askX`, un fallo por imagen no tumba el resto). Todo inyectado: se prueba sin red.
- ✅ `media/galeria.mjs → update()` ahora escribe tmp + `renombrar` (K1-06).
- ✅ `serve.mjs`: `GET /api/media/describir` (lo descrito + costo de lo que falta, no gasta) y `POST` (solo el dueño: `by:'agent'`/`agent` → 403; flag apagado → 409; sin costo confirmado → 409). Enganche: 1 import + 1 `const` + 8 líneas de ruta.
- ✅ `dimitri-lectura-mcp.mjs`: `ver_galeria`, `ver_descripciones`, `ver_imagen`; solo GET; test estático de que no hay POST ni nombres de gasto ni `estudio-mcp`. NO está conectado todavía a Dimitri.
- Flags: `estudio.descripcionesIA` (apagado), `estudio.descripcionesTopeUsd` (1). Sin migraciones (rango 0200-0219 sin usar). Página: +105 B en total (solo `galeria-filtro.js`).
- Tests: `tests/describir-local.test.mjs` (8, incluida la oficina real y el MCP por stdio).

## Pendiente de 11.1 (honesto; no hecho)
- ⏳ Bucle de herramientas de lectura de Dimitri en local (`askX` rama sin agente con `--strict-mcp-config` + `--allowedTools` exacto, cargando `dimitri-lectura-mcp.mjs`) y la ficha en `INTERNAL` de safety.
- ⏳ Nube: `ver_galeria`/`ver_imagen` con expansión `ao_imagen`, trabajo de servidor `describir_imagenes` en tandas de 4 (IMAGES a 1568 px), `json_set` único en D1.
- ⏳ Ampliar las regex de INJECTION de safety.mjs (K3) y clave `desc` en `dataInjection`; `desc` aún no se muestra en la página (el listado de `/api/media` ya la trae por ser parte de la ficha).

## Correcciones de revisión en #76
- ✅ `destino` ya no es fijo: `destinoDeProveedor(PROVIDER)` (anthropic · meta-contributor · compatible); la auditoría `envio-tercero` dice el destino real y Meta Contributor no recibe nada.
- ✅ `ejecutar` se niega (409) si `!PUEDE_VER` (mismo criterio que `prepararVistas`).
- ✅ Presupuesto: además del tope por pedido, cada tanda pasa por `media.checkBudget` y se cobra con `media.charge` (día y mes del Estudio).
- ✅ `injectionIn` también al LEER (`descripcionParaPrompt`, `ver_galeria`).
- ⚠️ Guardas dormidas: `privada` (ficha y carpeta) y `consentimiento_rostros` hoy NO las escribe nada, así que `puedeEnviar` no bloquea en la práctica; y los rostros se envían la primera vez (el conteo `personas` solo existe tras describir). Falta una UI/ajuste que las marque.

# Fase 11.2 «Biblia visual y hoja de personaje» (rama `carril-k-112`, 1 PR)
- ✅ `biblia-core.mjs` (puro): biblia normalizada (paleta con roles y hex, tipografías, logo, luz, lente, grano, composición, tono, `nunca`, zonas seguras, ejemplos, reglas con evidencias), nota con encabezado + bloque JSON editable a mano, versión que sube SOLO si cambió el contenido (hash), `lineaDeBiblia`/`citarBiblia` (todo pedido cita «Biblia visual vN»), `violaNunca` (sin tildes, respeta «sin …») y `verificarPedido`, `cambiarBibliaDeSerie` (exige «reanclar desde el plano n»), `anclasDeBiblia`, `paletaDeterminista` (k-means sin azar) e `idaYVuelta` (ΔE ≤ 8), `promptProponerBiblia`/`leerPropuestaBiblia` (reglas inferidas con < 3 evidencias válidas se descartan y se dicen; lo sospechoso no entra), hoja de personaje/producto (un producto real exige su foto real).
- ✅ `biblia-local.mjs`: `Marca/biblia-visual.md` y `Estudio/Personajes/<nombre>.md` en el Cerebro (rutas fijas, tmp + `renombrar`), `leer`/`linea`/`hojas` sin gasto, `proponer` (solo el dueño, flag `dimitri.series`, costo confirmado ≥ US$0,05 estimado, presupuesto del Estudio, `kind:'biblia'`), `guardar` (solo el dueño; la propuesta NO es vigente hasta aprobarla; la versión anterior queda en `data/history/biblias/`).
- ✅ Rutas `GET|PUT /api/biblia`, `POST /api/biblia/proponer`, `GET|PUT /api/biblia/personajes` (agente → 403). Enganche en `serve.mjs`: 1 import + 1 `const` + 4 líneas de ruta. `dimitri-lectura-mcp.mjs` gana `ver_biblia` (solo GET).
- Flag: `dimitri.series` (apagado; solo gobierna `proponer`). Sin migraciones. Página: 0 B.
- Tests: `tests/biblia-core.test.mjs` (16, incluida la oficina real). El caso de evaluación «respeta el nunca» está como prueba de estructura (`violaNunca`/`verificarPedido`); `evals/dimitri-creativo/evals.json` (con modelo real) sigue para 11.6.
- ⏳ No hecho: la interfaz de revisión de la biblia (11.2 solo trae API y MCP), medir los colores de las imágenes aprobadas con sharp (`paletaDeterminista` existe pero nadie la llama aún), la nube, y que la serie (11.3) llame a `citarBiblia`.

## Arreglos de la revisión de #90
- ✅ `verificarPedido` exige que el pedido TERMINE en `lineaDeBiblia(biblia, version)` y revisa todo lo anterior sin dividir por regex.
- ✅ `leerPropuestaBiblia`: sin `idsConocidos` no se acepta ninguna evidencia ni ejemplo (nunca «vacío = cualquiera»).
- ✅ `violaNunca` compara por palabra clave (plural, sin tildes, «ne0n»), ventana de 6 palabras, negaciones «sin/no/nunca/evitar/ni». Es una red de seguridad, no una garantía: se documenta en el código; la línea NUNCA se cita en cada pedido y al reanclar, y la visión (11.4) vuelve a mirar.
- ✅ `proponer` con cerrojo (`proponiendo`): dos POST seguidos cobran una vez (el segundo, 409).
- ✅ `guardar` devuelve `desaprobada:true` si editar sin aprobar quita la vigencia; una nota dañada se copia a `history/biblias/roto-<ts>.md` antes de escribir; el historial lleva el hash en el nombre (`biblia-visual-vN-<hash8>.md`) para no pisarse; `cambiarBibliaDeSerie(null)` no lanza; `nombreValido` rechaza nombres reservados de Windows (CON, PRN, AUX, NUL, COM1-9, LPT1-9, también con extensión).
- ⚠️ Riesgo conocido: en `serve.mjs`, `agente: b.by === 'agent' || !!b.agent` lo decide quien llama (cualquier proceso local puede omitirlo). Es el mismo patrón que las demás rutas locales de gasto (`/api/media/describir`, Contenido); lo que cierra el dinero es el flag, `confirmarUsd`, el presupuesto del Estudio y que la propuesta no se guarde sola. La oficina ya está limitada a esta máquina (issue #2 para exponerla).
