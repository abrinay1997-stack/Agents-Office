# Plan: Dimitri como director creativo (29 oct 2026)

**Estado:** plan escrito, nada construido. Es la **Fase 11** de `docs/plan-auditoria-y-mejoras-2026-10-29.md` (que manda en reglas, carriles y orden de ejecución; este documento manda en el diseño de Dimitri creativo).

## 0. Qué pidió el dueño

> «Dimitri debería tener toda la potestad y habilidad de poder crear varias imágenes consecutivas bajo un contexto. Si yo le pido un storyboard de un video musical con las 30 imágenes que están en dicha carpeta, él debería poder hacerlo: tener el guion, el contexto y el poder de hacerlo. Si le digo "hazme todos los carruseles de todo el mes", él debería ir, revisar las imágenes, leer la información de ellas y, en función a ello, tomar referencias y hacer carruseles.»
>
> «Cuando hace una tarea, debería poder leer el Cerebro, ver las imágenes, los videos, el calendario, todo a la vez, y tener criterio y contexto. Incluso usar conectores y todo en paralelo para tomar decisiones y que no se limite a unas cuantas funciones. Que pueda crear múltiples imágenes y programarlas, y leer el Cerebro para crear imágenes, una tras otra, con sentido, con coherencia, con branding, con las referencias tal cual, sin alucinar: si ve una imagen de referencia, que la respete; que respete siempre el branding y siempre el Cerebro. Tiene que estar muy bien entrenado.»
>
> «Que pueda hacer más que cualquier diseñador gráfico.»

## 1. Mapa de brechas: lo que hay hoy (verificado en el código) y lo que falta

Resumen: Dimitri **hoy propone un máximo de 8 creativos por turno, con una sola llamada al modelo y sin herramientas en local**; no puede leer una carpeta (ve ≤ 4 imágenes adjuntas por mensaje); **nada guarda una descripción o etiqueta de una imagen**; no existe un objeto «guion/escaleta», ni «biblia de estilo», ni «hoja de personaje»; la coherencia entre imágenes depende del historial recortado del chat, de notas del Cerebro y de la semilla en 5 modelos de imagen; **no puede crear una pieza carrusel con N medios** (los agentes sí); no hay láminas con texto encima; el «trabajo largo» que existe (lotes) solo edita fotos existentes y solo en local; la nube no tiene lotes ni presets.

| Capacidad | Hoy (archivo:línea) | Falta |
|---|---|---|
| Plan de creativos | `MAX_CREATIVES = 8` (`estudio-plan.mjs:17,189`); `parsePlan` corta a 8 (`sub-core.mjs:822`); `n` ≤ `maxPerRequest` (8; 4 en video, `estudio-plan.mjs:211-212`) | Una «serie» como objeto; pedir 30 exige ≥ 4 turnos |
| Turno de Dimitri | Local: una llamada, `maxTokens 6000`, timeout 180 s, sin herramientas (`serve.mjs:938,945`); nube: `MAX_VUELTAS 6`, `MAX_LLAMADAS 10` (`dimitri/modelo.js:13-14`) | Herramientas de lectura **también en local** |
| Prompt | Parte fija ≈ 18.386 de 19.000 car. (`tests/sub-conversacion.test.mjs:115`, `tests/dimitri-auditoria.test.mjs:32`): **margen ≈ 300** | Las reglas creativas van en un **bloque condicional** (como `presetsBlock`, `PRESETS_MAX 2500`), no en lo fijo |
| GENERAR | `POST /api/sub/studio` (`serve.mjs:3151`) es la **única** puerta que gasta por Dimitri; `subStudioBusy` anti-doble clic; tarjeta «GENERAR (N) — US$X» (`src/sub-studio.js:203-206`) | Un GENERAR de 30+ pasos con progreso, pausa y reanudación; **`sub-studio.js` no importa `studio-confirmar`** (segundo clic desde US$0,50: [NV]) |
| Topes | `dailyLimit 40` (video = 5), `maxPerRequest 8`, concurrencia 1-6 (3), presupuesto diario y mensual (`media/estado.mjs:5`, `media/trabajos-core.mjs:26-35`) | Un tope **por serie** |
| Ver imágenes | Adjuntos ≤ 4 por mensaje, ≤ 8 MB, ≤ 1.568 px (`vision.mjs MAX_IMAGES=4`, `serve.mjs:3112`); un video va solo por id; los agentes ven 6 por tarea (`ver-imagen-core.mjs`) | Leer una carpeta entera; `ver_imagen` para Dimitri (local y nube) |
| Describir y guardar | **Nada.** La ficha `.json` guarda prompt, modelo, ajustes, medios usados, costo, by/agent/task, folder, versionOf, sub, purpose, qa, fav, used (`media/trabajos.mjs:111-113`) | Campos `desc`, `etiquetas`… cacheados, pagados una vez; la búsqueda (`galeria-filtro.js:36`) solo mira prompt, nombre, modelo, archivo, agente y tarea |
| Semilla | Solo 5 modelos de imagen (soul, soul-2, soul-cinema, qwen-image-3, z-image-turbo) y 7 de video; Nano Banana, GPT Image, Seedream, Flux y Veo **no** (`catalogo.mjs:143`) | Enseñarle a fijarla donde exista; anclaje donde no |
| Referencias | `capsOf(m).maxRefs` de 1 a 16 (Nano Banana 2/Pro 14, marketing-studio 16, Muse 10, GPT Image y Seedream 4 → 4, Nano Banana 3…); recortes con números distintos en 7 sitios (`presets-core.js:775-778`, `estudio-plan.mjs:139`, `estudio-lote.mjs:162`, `lotes.mjs:196`, `motores-core.mjs:30`, `trabajos-core.mjs:85`) | `referencias-core.mjs` (Fase 1.3 del plan central); «imagen anterior» automática en una serie |
| Video | 44 modelos; 37 con fotograma inicial, 22 con inicial y final (`capsOf`); `generar_video` del agente con `imagen_inicial/final` | Encadenar «último fotograma del plano N = primero del N+1»; sin objeto «plano» |
| Música y voz | Creativos `audio` y `music` (`estudio-plan.mjs:18,68-75`); música cerrada a cuentas nuevas de MiniMax (410 · 2153) | Música generada: límite de proveedor; sincronizar con la escaleta |
| Guion/escaleta | **No existe** (`sub-core.mjs:111`: `creatives` sin plano, duración, cámara ni orden) | Todo |
| Biblia de marca / personaje | Dimitri carga `voice`, `oferta`, `clientes` (≤ 1.800 car. c/u) solo en mensajes del Estudio (`serve.mjs:924-927`); presets propios = notas en `<cerebro>/Estudio/Presets/`; `approvedCreatives` (hasta 4 parecidos aprobados, `serve.mjs:872-877`). El brain de ejemplo tiene `20-Brand/sistema-visual.md` pero **no se carga por nombre** | «Biblia visual», «hoja de personaje/producto» como objetos |
| Memoria del chat | 12 mensajes, 9.000 car., 1.600 por línea; lo viejo se pliega en `hilo` ≤ 2.400; los prompts previos se resumen a 300 (`sub-core.mjs:441,457-470`) | En una serie de 4+ turnos olvida los prompts exactos: guardar la serie aparte |
| Aprender | ⭐ y `used` (`serve.mjs:3100-3103`); `learnFromMedia`; notas en `<cerebro>/Agents Office/estudio/AAAA-MM/` | Preferencias explícitas del dueño; aprendizaje por serie |
| Carruseles en Contenido | Formatos `post/reel/carrusel/historia`; 2-10 medios en Instagram (`contenido-reglas.js:22,383-387`); medios hasta 20 | Dimitri: `pieza_crear` no acepta medios (`sub-core.mjs:169,669`), `enviar_contenido` solo UN archivo (`estudio-plan.mjs:248-252`), `contenido_llenar` 1-14 días y sin medios (`contenido/rutas-nucleo.mjs:52-80`). Los **agentes sí** pueden `crear_borrador` con `medios[]` (`contenido-tools.mjs:23`) |
| Mes entero | Dimitri recibe 7 días (`serve.mjs:1022-1025`) | Vista del mes (hasta 31 días) |
| Láminas con texto | **No hay** (`imagen-local.mjs`, `posproceso.mjs`, `presets.mjs` sin `composite`/texto); solo un preset de portada con IA (`presets/imagen/marketing.json:711`); en la nube `IMAGES` ni siquiera está declarado (`wrangler.jsonc`, CON-01) | Texto determinista sobre imagen con tipografía de marca |
| Ejecución larga | Local: `lotes.mjs` (estados previsto→espera_ok→muestra→corriendo→pausado→hecho, bomba que mira topes antes de cada foto, retoma tras reinicio, `DEFAULTS max 100`); **solo edita fotos existentes**. Nube: trabajos por pasos en D1 y cron (`lib/estudio/trabajos.js`), corridas de agentes con candado compare-and-set (`lib/agentes/ejecutor.js`); lotes y presets 501 | Un «trabajo creativo» por filas generadas con estado, pausa, reanudación y costo acumulado, en local **y** nube |
| QA | `verificar.mjs` determinista (ΔE, IoU, ocupación) solo con presets; un reintento automático en lotes | QA con visión (¿mismo personaje?, ¿texto bien escrito?, ¿cabe en el formato?); comparar lado a lado |
| Exportar | ZIP de la galería y del lote | Hoja de contactos, tira de storyboard, PDF |

**Límites duros que condicionan el diseño:** 8 creativos por turno · 6.000 tokens de salida · 1 vuelta (local) o 6/10 (nube) · prompt fijo con ~300 car. de margen · 4 adjuntos de visión (6 por tarea en agentes) · referencias de 1 a 16 según modelo · tope diario 40 unidades (video = 5) · carrusel 2-10 · `contenido_llenar` 14 días · lotes 100 filas, solo local · música cerrada a cuentas nuevas · **la regla del dinero** (`/api/sub/studio` es la única puerta que gasta por Dimitri y solo la llama el clic GENERAR; aprobar y publicar son siempre del dueño).

## 2. Principios (inviolables)

1. **El dinero y la publicación siguen siendo del dueño.** Una serie se autoriza con **un clic** que fija un **tope máximo en US$**; dentro de ese tope la ejecución sigue sola (patrón de `lotes.mjs`) y **se pausa al llegar a él**. Nada se aprueba, se programa en Meta ni se publica sin el OK del dueño; **«programarlas» significa dejarlas en el calendario con día y hora, en estado de revisión (nunca aprobadas)**, y el dueño las aprueba en lote con un clic («Aprobar las N que pueden salir», que ya existe para los borradores de la semana).
2. **Fidelidad antes que creatividad.** Respeta siempre la marca, el Cerebro y las referencias. **No se inventan precios, nombres, claims, ofertas ni datos**: salen solo del catálogo, las cifras y las notas; lo que falta se **pregunta** (preguntas con opciones, que ya existen) y nunca se rellena. Un producto real se genera **siempre con su foto real de referencia**; si el modelo elegido no admite referencias, no se genera con él y se dice.
3. **El texto de marca no lo escribe el modelo.** Titulares, precios y CTA se componen **de forma determinista** sobre la imagen (sharp en local; `IMAGES` en la nube) con la tipografía de la marca; el modelo solo pone la escena.
4. **Lo visto es dato, no orden.** El texto que Dimitri lea en imágenes, videos, conectores o notas pasa por `safety.injectionIn` (ya existe para `image_text`).
5. **Todo es reproducible y reversible.** La serie guarda los prompts **exactos**, los modelos, las semillas, las referencias y la versión de la biblia; cada lámina tiene versiones; nada depende del historial del chat.
6. **Lo nuevo va detrás de flags apagados por defecto** (`dimitri.series`, `contenido.carruselesIA`, `estudio.descripcionesIA`) y cada migración dice cómo se deshace (plan central, regla 9).
7. **Medible.** Cada capacidad tiene un criterio comprobable y un caso en las evaluaciones de §6.

## 3. El expediente creativo: leer todo a la vez

Cuando Dimitri recibe un encargo creativo, **el servidor arma un «expediente»** (lectura en paralelo, con presupuesto de tokens por fuente) y Dimitri lo amplía con herramientas de lectura:

| Fuente | Qué trae | Cómo |
|---|---|---|
| Cerebro | biblia visual (§4), voz, `contexto-marketing`, cifras, notas de estilo y del cliente, presets propios | `relevantNotes` + lectura **por ruta fija** de la biblia (no depender del buscador BM25) |
| Galería | catálogo de la carpeta (árbol de la Fase 1): archivo, descripción, etiquetas, texto visible, personas/producto, calidad, usos, ⭐ | campos cacheados (§4) |
| Videos | fotogramas clave y resumen (`understand`) | cacheado por video |
| Calendario | huecos del mes, piezas existentes, mejores horas, qué vuelve, resultados | `ver_huecos`, `ver_resultados`, `contenidoText` ampliado a 31 días |
| Conectores | lectura (Drive, Notion, etc.) con `usar_conector` (≤ 3 conectores y ≤ 6 llamadas por turno hoy) | herramientas de lectura **también en local** |
| Tareas y rutinas | lo que ya está en marcha, para no duplicar | `ver_tareas` |

**Herramientas nuevas de lectura para Dimitri** (todas solo leen; van en `INTERNAL`): `ver_galeria` (carpeta o ruta del árbol, con filtros y paginación), `ver_imagen` (en tandas de 4 con copia reducida, `media/vision.mjs: copiaParaVer`), `describir_imagenes` (guarda el resultado), `ver_video`, `ver_serie`, `ver_calendario_mes`, `ver_biblia`. El **bucle de herramientas pasa a existir en local** (hoy solo la nube lo tiene) y sube `MAX_VUELTAS`/`MAX_LLAMADAS` solo para encargos creativos. **Lo que escribe** (crear serie, crear piezas) **nunca es una herramienta**: son acciones propuestas con clic, como hoy (`sub.OPS`).

## 4. Objetos nuevos

1. **Biblia visual de la marca** (`Marca/biblia-visual.md`, nota del Cerebro con tipo propio y versión): paleta con roles (hex), tipografías (archivos de fuente subidos), reglas del logo, luz y lente, grano, composición, tono, lo prohibido («nunca»), zonas seguras por formato, ejemplos aprobados (ids de galería). **La propone Dimitri leyendo el Cerebro y las imágenes aprobadas; el dueño la corrige y aprueba**; cada pedido cita su versión; se re-ancla a ella cada N imágenes.
2. **Hoja de personaje o de producto** (`Estudio/Personajes/<nombre>.md`): descripción en texto, **imágenes de referencia fijas** (ids), vistas, vestuario, rasgos que no cambian; para un producto real, sus fotos reales (obligatorias en todo plano donde aparezca).
3. **Descripción de imagen** (campos nuevos de la ficha, escritos **una vez por imagen y versión** por visión, con costo visible por tanda): `desc`, `etiquetas`, `texto_visible`, `personas` (número, sin identificar), `producto`, `calidad`, `apta_para`, `desc_modelo`, `desc_version`. Indexa la búsqueda sola (`galeria-filtro.js:36`). Si la imagen cambia, se vuelve a describir.
4. **Serie** (la pieza central): `{ id, titulo, brief {objetivo, publico, formato destino, restricciones}, biblia_version, personajes[], escaleta [ { n, rol (gancho · desarrollo · cierre/CTA, o plano de storyboard con duración, cámara, acción, letra), descripcion, refs[], prompt_exacto, texto_en_imagen, modelo, ajustes, semilla, estado, versiones[] } ], modelo_unico, semilla_compartida, tope_usd, costo_estimado, costo_real, estado, carpeta (árbol), origen (galería existente o generado) }`. Local: `data/series.json` (atómico con `renombrar`); nube: tabla D1 `series` (rango de migración del carril K) con la misma forma. Lógica **pura** en `serie-core.mjs` (validar, costear, ordenar, siguiente paso, reanclar), compartida entre local y nube.
5. **Trabajo creativo**: la ejecución de una serie por pasos. Estados `previsto · espera_ok · muestra · corriendo · pausado · hecho · cancelado` (los de `lotes.mjs`); **bomba** que antes de cada paso mira el tope de la serie, el del día y el del mes, la concurrencia y el cupo diario; reintento pasajero con `reliability.mjs`; un reintento automático con más fidelidad si la QA falla; pausa si falla dos veces; **retoma tras un reinicio sin duplicar** (marca `serie:{id,n}` en cada trabajo, como `lote:{id,fila}`). Local: sobre la máquina de `lotes.mjs` ampliada a filas generadas con prompt por fila. Nube: sobre `estudio_trabajos` + el cron de cada minuto (patrón de `corridas`).

## 5. Flujos

### 5.1 Storyboard de un video musical (30 imágenes de una carpeta)
1. **Brief.** Dimitri pregunta solo lo que falta (canción, letra o guion, duración, estilo, formato 16:9 o 9:16, protagonistas, qué es obligatorio) con preguntas de opciones.
2. **Expediente.** Lee la carpeta (catálogo descrito en tandas de 4, costo de visión a la vista), la biblia visual, el Cerebro y las notas de la marca.
3. **Escaleta.** Propone la serie: planos numerados con duración, cámara, acción y letra o beat, cuáles imágenes de la carpeta usa como **referencias** de cada plano y cuáles planos hay que **generar**. Se muestra como **storyboard en miniaturas baratas** (texto y bocetos con el modelo barato o «Prueba», **antes de gastar en serio**) con el costo exacto por plano y el total.
4. **Aprobación.** El dueño edita planos (reordenar, cambiar, bloquear) y pulsa **GENERAR SERIE** con su tope. Segundo clic desde US$0,50.
5. **Producción** (muestra de 3 → resto). Mismo modelo y semilla en toda la serie; referencias obligatorias (personaje y producto) más la **imagen anterior** y la **portada/plano clave**; **re-anclaje** a la biblia cada N planos; texto de marca solo por composición.
6. **QA** de cada plano (determinista + visión, §7); un plano que falla se **corrige por edición**, no se regenera entero.
7. **Entrega:** carpeta de la serie en la galería (árbol), **hoja de contactos** y **tira de storyboard** (PNG y PDF), ZIP, y la escaleta como nota del Cerebro. Si el dueño quiere video, se propone encadenar clips con primer y último fotograma (modelos que lo admiten) como **otra serie** con su costo. **Música:** no se genera (MiniMax cerrada a cuentas nuevas); se usa la que el dueño suba, y se avisa de los derechos del audio.

### 5.2 «Hazme todos los carruseles de todo el mes»
1. **Plan del mes** (hasta 31 días): huecos, redes, ritmo semanal, tipos de contenido, fechas especiales, lo que ya está en el calendario, mejores horas, resultados, y qué vuelve. Dimitri propone **N carruseles con tema, objetivo y día/hora** (o los pide si faltan datos).
2. **Revisión de imágenes**: por cada carrusel, empareja imágenes **existentes** del catálogo descrito (producto real, personas, ambiente) con láminas; **solo genera lo que falte**.
3. **Láminas**: portada (gancho; título centrado por el recorte 3:4 del perfil), desarrollo (una idea por lámina), cierre con CTA; 2-10 láminas, 4:5 por defecto, margen seguro; **texto compuesto determinista** con tipografía de marca, contraste ≥ 4,5:1 y tamaño mínimo legible en móvil; **texto alternativo** en cada lámina.
4. **Contenido**: cada carrusel entra como **pieza de Contenido** (`formato: carrusel`, `medios[]`, texto de la publicación, hashtags, redes, cuenta, día y hora) **en revisión**, con las reglas de `contenido-reglas.js` ya validadas (problemas con su «Arreglar»).
5. **Costo y ritmo**: estimación **antes** (N carruseles × láminas a generar) con tope mensual de la serie; ejecución por **tandas semanales**; la primera tanda es una **muestra** que el dueño aprueba antes de seguir.
6. **Aprobación**: «Aprobar las N que pueden salir» en un clic; las que tengan problemas no entran.

## 6. «Muy bien entrenado»: cómo se entrena

- **Skills del director creativo** en la Biblioteca (`biblioteca/diseno/`, formato de la Biblioteca existente: se leen **cuando hacen falta**, no en el prompt fijo): *brief creativo*, *biblia visual*, *hoja de personaje*, *escaleta y storyboard*, *carrusel* (estructura narrativa, retícula, jerarquía, contraste), *continuidad entre planos*, *QA visual*, *texto en imagen*, *cumplimiento* (derechos, rostros, claims). Se adaptan al negocio con la regla de siempre (copiar al Cerebro del dueño y editar allí).
- **Ejemplos reales**: lo ⭐ y lo usado (ya hay `approvedCreatives`) y las **series aprobadas** como ejemplos de estilo; `learnFromMedia` extendido a la serie.
- **Preferencias explícitas del dueño** («siempre fondo claro», «nunca X») como notas del Cerebro leídas junto a la biblia.
- **Evaluaciones** (`evals/dimitri-creativo/evals.json`, `node scripts/evals-skill.mjs`): casos fijos — storyboard de 30 planos con los mismos personajes; carruseles del mes sin repetir tema; **una referencia que se respeta**; **no inventar un precio ni un claim**; **respetar el «nunca» de la biblia**; texto exacto; pausa al llegar al tope. Corren **sin gasto** con un modelo simulado en CI (estructura, topes, anclaje, referencias), y con modelo real a pedido, con rúbrica y juez con evidencia.
- **Presupuesto del prompt**: todo lo creativo va en un bloque que solo entra cuando el mensaje pide una serie (`pideSerie`, como `pideEstudio`), medido por un test; lo fijo no crece.

## 7. Calidad: fidelidad, coherencia y sin alucinar

Revisión por capas, de barata a cara, sobre cada plano o lámina:
1. **Determinista (gratis):** formato y proporción; zonas seguras; contraste y tamaño del texto compuesto; ΔE de color contra la paleta, IoU del producto (`verificar.mjs`, que hoy solo corre con presets); número de referencias usadas contra `maxRefs`.
2. **Visión (con costo visible):** ¿es el mismo personaje y el mismo producto que la hoja?; ¿respeta la biblia (paleta, luz, «nunca»)?; ¿hay texto inventado o mal escrito (OCR del resultado contra el esperado)?; ¿aparece una marca ajena, un rostro de un tercero o algo que contradiga el Cerebro? Devuelve puntaje y motivo, **guardados en la ficha**.
3. **Humano:** el dueño ve la serie como **tablero** (hoja de contactos) y aprueba, bloquea o pide cambios por plano; lo que ya pasó las capas anteriores no se revisa pieza por pieza.
Un plano que falla se **corrige con edición** (instrucción + «conserva lo demás») y solo se regenera si la edición no basta; dos fallos seguidos **pausan** la serie y lo dicen. Se mide: aprobación a la primera, costo por pieza aceptada, tasa de planos corregidos, y la correlación entre el puntaje automático y la aprobación humana.

## 8. Cambios concretos en lo que ya existe

| Cambio | Dónde | Nota |
|---|---|---|
| `serie` en el contrato JSON de Dimitri y su validador | `sub-core.mjs:111`, `estudio-plan.mjs` (`parseCreatives`, `estimatePlan`) | el límite de 8 creativos por turno **no** se sube: la serie es otro objeto con su propia escaleta paginada |
| Bucle de herramientas de lectura en local | `serve.mjs:938-961`, `consultas-core.mjs` | hoy solo la nube (`cloudflare/worker/lib/dimitri/modelo.js`) |
| `ver_imagen`, `ver_galeria`, `describir_imagenes`, `ver_video`, `ver_calendario_mes`, `ver_biblia` | `consultas-core.mjs`, `cloudflare/worker/lib/dimitri/consultas.js`, `estudio-mcp.mjs` | solo lectura, en `INTERNAL`; tope de bytes y de imágenes por turno |
| `enviar_contenido` a `files[]` y `pieza_crear` con `medios` (2-10 y formato carrusel) | `estudio-plan.mjs:248-252`, `sub-core.mjs:169,669-673`, `serve.mjs:1096-1101,1365` | siempre borrador o revisión; nunca aprobada |
| `contenido_llenar` y `semanaContenido` hasta 31 días | `contenido/rutas-nucleo.mjs:52-80`, `serve.mjs:1022-1025` | con `dias` y vista mensual |
| Texto compuesto sobre imagen | `imagen-local.mjs` (sharp + SVG; fuentes de marca **[NV: comprobar que sharp use una fuente propia]**), nube: binding `IMAGES` (CON-01) | determinista, con contraste y tamaño comprobados |
| Hoja de contactos y tira de storyboard | `imagen-local.mjs`; nube: `IMAGES` | PNG y PDF |
| `referencias-core.mjs` con `ajustarReferencias` | Fase 1.3 del plan central | prioridad por rol; guía 3D y fotogramas obligatorios |
| `serie-core.mjs` + adaptadores local y nube | nuevo | lógica pura compartida |
| `sub-studio.js` pide segundo clic desde US$0,50 | `src/sub-studio.js` con `studio-confirmar.js` | hoy no se importa ([NV] la lógica de botones) |
| Tarjeta «Serie» | `src/sub-studio.js` (paquete bajo demanda) y `src/movil/vistas/dimitri-extra.js` | storyboard en miniaturas, editar planos, tope, progreso, pausa, comparar, enviar a Contenido |
| Tope propio de la serie | `media/trabajos-core.mjs`, `estudio-pesos.mjs` | un storyboard de 30 consume 30 de las 40 unidades diarias: la serie lleva su cupo, declarado y visible |

## 9. Fases (carril K; cada una se despliega sola)

| Fase | Entrega | Depende de | Esfuerzo | «Hecha» cuando… |
|---|---|---|---|---|
| **11.0** | Decisiones (§11) y `serie-core.mjs` + tests puros | — | S | validar, costear, ordenar y reanclar con casos |
| **11.1** | **Ver y describir**: `ver_imagen`/`ver_galeria` para Dimitri (local y nube), `describir_imagenes` con descripción cacheada en la ficha, indexada en la búsqueda; bucle de herramientas en local | Fase 0a (`IMAGES`), Fase 1 (árbol) | M | Dimitri lista y describe 30 imágenes de una carpeta; la segunda vez no paga visión; imágenes de terceros nunca salen sin pasar el filtro de privacidad |
| **11.2** | **Biblia visual y hoja de personaje**: notas tipadas, propuesta desde el Cerebro y las imágenes aprobadas, versión y re-anclaje | 11.1 | M | todo pedido de serie cita su versión; un «nunca» de la biblia se respeta en el caso de evaluación |
| **11.3** | **Serie y trabajo creativo** (local sobre `lotes.mjs`; nube sobre `estudio_trabajos`): escaleta, GENERAR SERIE con tope, muestra, pausa, reanudación, costo acumulado | 11.0-11.2, Fase 1.3 (referencias) | L | 30 planos con el mismo modelo, semilla y referencias; se pausa al tope; retoma tras un reinicio sin duplicar |
| **11.4** | **QA creativa**: determinista en cada plano, visión con puntaje, corrección por edición, hoja de contactos y storyboard (PNG/PDF) | 11.3 | M | el caso de texto inventado y el de personaje distinto se detectan |
| **11.5** | **Carruseles**: texto compuesto determinista, `enviar_contenido`/`pieza_crear` con medios, plan del mes de 31 días, tandas semanales, alt text | 11.3-11.4, Fase 2 (conversión), CON-01 | L | un mes de carruseles queda como piezas en revisión, validadas por las reglas, con costo previo |
| **11.6** | **Entrenamiento**: skills de `biblioteca/diseno/`, ejemplos de series aprobadas, preferencias, evaluaciones en CI sin gasto y con modelo real a pedido | 11.2-11.5 | M | las evaluaciones corren en CI y bajan los fallos al cambiar el prompt |
| **11.7** | **Video musical por escenas**: encadenar clips (primer y último fotograma), duración y letra; derechos de audio | 11.3 | M-L | clips encadenados coherentes en 2 modelos |
| **11.8** | **Diferenciadoras**: A/B con hipótesis, aprender del rendimiento publicado, moodboard automático, variantes por mercado (checklist de la §10) | 11.5 | M | cada una con su métrica |

## 10. Qué hace mejor que un diseñador (y dónde el humano sigue mandando)

Ventajas **medibles**: volumen y velocidad (30 planos o un mes de carruseles en un turno de aprobación), **consistencia** frente a la biblia y la hoja, **cumplimiento** automático (contraste, formato, «nunca», cifras del catálogo), **trazabilidad** (cada pieza sabe de qué prompt, modelo, referencias y versión de biblia salió), **datos** (horas, formatos y temas por rendimiento real, A/B), accesibilidad (alt text en todo), costo por pieza aceptada visible. **El humano sigue ganando** en gusto, idea original, matices culturales y juicio sobre qué no publicar: por eso aprueba la biblia, la escaleta y cada lote, y el costo.

Checklist de capacidades (I imprescindible · D diferenciadora · F futura): 1 brief estructurado con preguntas I · 2 lectura de carpeta (visión + metadatos) I · 3 biblia visual versionada I · 4 hoja de personaje y producto I · 5 selección de referencias con tope por modelo I · 6 storyboard aprobable antes de gastar I · 7 muestra de 3, luego lote con costo previo I · 8 retícula y jerarquía tipográfica I · 9 contraste y tamaño mínimo I · 10 estructura narrativa del carrusel I · 11 especificaciones por red I · 12 OCR contra el texto esperado I · 13 cifras solo del catálogo I · 14 consentimiento y derechos de rostros y marcas I · 15 todo borrador; aprueba una persona I · 16 autocrítica con visión D · 17 re-anclaje anti-deriva D · 18 modelo por tarea D · 19 planificación del mes D · 20 aprender de lo aprobado y de las métricas D · 21 texto alternativo D · 22 variantes A/B D · 23 moodboard automático D · 24 etiquetado de contenido IA (C2PA) D · 25 aviso de derechos de música D · 26 identidades propias por marca F · 27 localización por mercado F · 28 edición local por instrucciones F · 29 seguimiento por pieza F · 30 video musical por escenas F.

## 11. Decisiones que necesito del dueño

1. **«Programarlas»:** propongo que Dimitri las deje en el calendario con día y hora **en revisión** y que **tú apruebes en lote con un clic**. ¿Quieres además que alguna serie pueda aprobarse sola? (Recomiendo que no.)
2. **Tope por serie:** ¿te sirve «un clic con un tope máximo en US$; sigue solo hasta el tope y se pausa»? ¿Qué tope máximo por defecto (propongo US$5 por serie de imágenes y US$20 por mes de carruseles, editable)?
3. **Texto de marca compuesto** (no escrito por el modelo): ¿de acuerdo? Necesito que subas **las fuentes de la marca** (archivos) para componer con ellas.
4. **Privacidad de imágenes:** ¿marcamos como «no enviar a terceros» las carpetas con rostros de clientes, menores o documentos? Propongo que sí, con una marca por carpeta que Dimitri respete.
5. **Música:** MiniMax está cerrada a cuentas nuevas; ¿subes tú el audio de cada video musical?
6. **Cupo diario:** un storyboard de 30 consume 30 de las 40 unidades diarias; ¿damos a cada serie un cupo propio dentro del tope mensual?

## 12. Lo que NO está verificado

- Si la tarjeta de Dimitri pide hoy segundo clic desde US$0,50 (no se importa `studio-confirmar`, pero no se revisó la lógica de los botones).
- Si el buscador carga `20-Brand/sistema-visual.md` al pedir una serie; si ⭐ y `used` bastan para que aprenda preferencias estables.
- Si `sharp` puede usar una **fuente propia** al componer texto y si `IMAGES` lo permite en la nube; el rendimiento de componer 30 láminas en un Worker.
- Que los modelos mantengan coherencia real a 30 planos con las referencias disponibles (la semilla existe solo en 5 modelos de imagen): hay que **probarlo con keys reales** antes de prometer.
- Si el límite real de láminas de un carrusel de Instagram es 10 o 20 (los blogs discrepan; el repo asume 10, que es seguro).
- Peso de la música en el tope diario (`trabajos-core.mjs:26` cuenta ×2; `estudio-pesos.mjs:4` y `CLAUDE.md` dicen 3).
- El estado y los límites del etiquetado de contenido IA (UE, C2PA) y de derechos de autor: fuentes secundarias, sin leer el texto legal.
- Nada de esto se probó en navegador ni contra proveedores reales; todo es plan.

## 13. Enmiendas de las auditorías K2–K5 (PREVALECEN sobre las secciones 1–12)

Cuatro auditorías independientes (fidelidad, seguridad/dinero/legal, omisiones, operación). La de viabilidad en el código (K1) está integrada en §13.7.

### 13.1 Integración con el plan central (K5-01, 02, 04, 10)
- Esta es la **Fase 11 (carril K)**. Se añade a `plan-auditoria-y-mejoras-2026-10-29.md` (§0.1, §5, §8, decisiones). Regla 1 enmendada: K arranca tras las Fases 0–3; 11.0 y 11.1 son solo lectura y no la violan.
- Migraciones: rango **K 0200–0219**, cada una con «cómo se deshace» y su poda declarada en `TABLAS` de `cloudflare/tests/auditoria-transversal.test.mjs`.
- Choques: el código de K vive en archivos nuevos (`serie-core.mjs`, `serie-local.mjs`, `cloudflare/worker/lib/series/*`, `src/sub-serie.js`); en `sub.js`, `serve.mjs`, `sub-core.mjs` solo enganches de ≤10 líneas y nunca en la misma semana que el carril B. Depende de Fase 3 (UX-11) y COS-04 (caché de prompt).
- Flags nuevos (`dimitri.series`, `dimitri.seriesNube`, `contenido.carruselesIA`, `estudio.descripcionesIA`) se añaden a la regla 9; apagar un flag conserva las series en solo lectura.
- «Programarlas» = pieza en estado `revision`, `por:'dimitri'`; un test falla si una op de serie fija `aprobada` o programa en Meta. Aprobar en lote lo hace el dueño con un clic.
- Música: resolver el peso único (`estudio-pesos.mjs`) antes de 11.3.

### 13.2 Dinero (K3)
- El tope de la serie cuenta TODO (generación, edición, visión, QA, reintentos, descripciones) con **reservar → ejecutar → liquidar** al máximo del proveedor. Estimación realista: 30 planos ≈ US$4,6–5,0 (QA y visión ≈ 40 %). Topes por defecto: **US$10 por serie, US$45/mes en carruseles** (ajustables; el dueño decide).
- Idempotencia `serie_id:n:intento` escrita en disco/D1 con CAS **antes** de llamar al motor; nunca un `Set` en memoria. ENVIAR a un motor de pago no se repite: un paso muerto queda «puede haberse cobrado» y pide decisión.
- GENERAR SERIE: token de un solo uso + `hash_escaleta` + `topeMax`; las `OPS_GASTO` se rechazan desde MCP/agentes. Cupo diario: reservar 25 % fuera de series.
- Un solo clic con tope sustituye al segundo clic de US$0,50 (no se suman).
- Permisos: solo administrador genera/pausa; editor edita la escaleta; lectura no ve prompts. La cron ejecuta con `aprobada_por`.

### 13.3 Seguridad y privacidad (K3, K5-10e)
- `desc` (descripción de imagen) es dato no confiable: separar `texto_visible`, truncar a 300, pasar por `injectionIn`, marcar `desc_sospecha`; ampliar las regex de INJECTION.
- `media/privacidad-core.mjs → puedeEnviar()` único: privacidad por carpeta, auditoría `envio-tercero`; **ninguna visión a Meta Contributor**; rostros de personas solo con consentimiento registrado.
- SVG: `escapeXml`; nunca persistir ni servir SVG; fuentes verificadas por bytes, ≤3 MB, fuera de `/media`.
- Paso de cumplimiento con 4 casillas (derechos, rostros, claims, marca) antes de la muestra.

### 13.4 Fidelidad y calidad (K2)
- Jerarquía de técnicas: composición determinista del producto real recortado sobre fondo generado > edición «conserva todo» (solo modelos `edit:true`, con fallback) > generación con referencias. Prioridad de huecos de referencia: producto > personaje > biblia > plano anterior; `serie-core` usa `ajustarReferencias` y el rechazo pausa el plano.
- Deriva: anclas fijas no encadenadas (hoja + plano clave aprobado), re-anclaje cada 5, métrica por visión en 4 ejes + ΔE; pausa si dos planos seguidos <3/5. `verificar.mjs` no mide escenas («No medido»): no se promete IoU.
- QA por visión con modelo de otra familia, evidencia obligatoria, costo dentro del tope; calibración con 40 imágenes (recall ≥85 %, falsos positivos ≤15 %). Honestamente: las evals de calidad son **manuales, a pedido**; en CI solo tests de estructura con Claude simulado (`tests/serie-*.test.mjs`).
- Logo siempre estampado, texto de marca siempre compuesto (nunca generado); precios y claims por código (validador `skipped`).
- Cerebro: presupuesto por fuente y prioridad (instrucción del dueño > biblia > cifras/catálogo > notas); conflictos → pregunta; notas >180 días no derivan precios.
- Biblia: colores por k-means determinista, reglas con ≥3 evidencias, prueba de ida y vuelta ΔE ≤ 8. Descripciones con `confianza`; etiquetas críticas se confirman.
- Muestra de 3 planos con comparación lado a lado antes de producir el resto.

### 13.5 Omisiones incorporadas (K4)
Brief obligatorio versionado; rondas de revisión con comentarios por plano (`rondas[]`); tabla de modos de falla; higiene de activos (duplicados, resolución, derechos, caducidad, «lista de tomas»); sistema de láminas parametrizable (plantillas/retícula); coherencia del conjunto (cuadrícula del PERFIL y ritmo); adaptación multi-formato desde una «idea madre»; accesibilidad (daltonismo, subtítulos); localización (Panamá/neutro); estrategia (ángulos/objeciones; competencia sin copiar); A/B con hipótesis; animatic; paquete de entrega (nombres, manifest, C2PA); @menciones; gobernanza de la biblia; rúbrica y prueba ciega contra un diseñador; series recurrentes; política legal y de marca. Entran por PR pequeños dentro de 11.3–11.8, no todo a la vez.

### 13.6 Operación (K5)
- **UI fuera de la página** (margen de 3 KB): `src/sub-serie.js` + paquete diferido `dist/dimitri-serie.js` (patrón `estudio-carga.js`, servido con sesión); la página solo gana un cargador ≤0,3 KB; test que falla si la página importa `sub-serie`; Fase 0.0 es prerrequisito. En móvil, vía `movil-d`/`diferidas.js`.
- **Matriz local/nube:** 11.1 y 11.4 ambos; 11.3 local primero, nube tras `dimitri.seriesNube` y prueba de 30 planos en workerd; 11.5 (texto compuesto, hoja de contactos) **solo local** hasta un spike de fuentes en `workerd`/`IMAGES`; 11.7 solo local. La nube contesta 501 en español donde no aplique. PNG/PDF fuera de la nube hasta tener librería.
- **Nube:** cada plano en su fila (`series_planos`, ≤100 parámetros/INSERT), serie solo metadatos; exentar de la poda de 400 a los trabajos de una serie viva; contador de `uso` por serie (no un único documento); ritmo 2–3 planos por minuto medido con test de carga; candado por CAS sobre `series.version`.
- **Avisos** vía `emitirAviso()` (categoría `dimitri`, dueño/admin) y Telegram con Continuar/Descartar: `serie.muestra_lista`, `pausada(motivo)`, `hecha`, `fallo_qa`; un test fuerza el tope y exige exactamente un aviso.
- **Recuperación:** borrar una imagen usada → `usos()` cuenta series o el plano pasa a «referencia perdida» y pausa; carpeta a papelera → pausa; la serie fija `biblia_version`, cambiarla exige «Reanclar desde el plano n»; aprobación por `version` del plano; GENERAR SERIE con idempotency-key; un test mata el proceso en cada transición.
- **Costos:** `kind:'serie'`, cada línea con `serie` y `n`; Costos muestra por serie; caché de prompt del expediente.
- **UI:** ≤60 `img` en el DOM con 300 planos (virtualización/miniaturas), roles ARIA, `aria-live`, 44 px, 4 anchos, axe; `scripts/serie-recorrido.mjs`.
- **PR:** 11.1 son 3 PR, 11.3 al menos 5, 11.5 son 4. Esfuerzo total «L+», ≥6 semanas con el límite de 3 PR por carril. Orden: 11.0 → 11.1 → 11.2 → 11.3 local → 11.4 → spike de fuentes → 11.5; nube de series al final.
- Fixtures a re-fotografiar: `media-fachada`, `sub-conversacion` (<19000, el bloque `pideSerie` se mide en un mensaje sin serie), `dimitri-auditoria`, `escritorio-1280`.

### 13.7 K1 (viabilidad en el código; 28 citas comprobadas, estas son las correcciones)
- **Bucle local (K1-01):** hoy Dimitri llama a `askX(...,{tools:false})` (`serve.mjs:466-562`); no es un agente y la rama SDK no tiene bucle. Se añade a `askX` una rama sin `agent` con `--strict-mcp-config`, guardián y `--allowedTools` exacto, y un MCP **propio de solo lectura** (`dimitri-lectura-mcp.mjs`: `ver_galeria`, `ver_imagen`, `describir`, `ver_serie`, `ver_biblia`). **Nunca** se le da `estudio-mcp.mjs` (expone `generar_*`, `aplicar_preset`, `crear_lote`: gastaría sin el clic). Un test falla si una herramienta de Dimitri gasta. Con SDK no hay herramientas: el encargo creativo exige CLI o un bucle portado. `usar_conector` solo existe en la nube; «también en local» exige portarlo.
- **Nube no ve 30 imágenes en el chat (K1-02):** los resultados son texto (`modelo.js:111`, 3.500 caracteres, 6 vueltas/10 llamadas). `describir_imagenes` es un **trabajo de servidor** en tandas de 4 (reduce con `IMAGES` a 1568 px JPEG, llama a visión fuera del bucle, escribe en la ficha); Dimitri recibe un resumen ≤3.500 caracteres con paginación. `ver_imagen` en la nube necesita su propia expansión `ao_imagen` y tope de bytes por turno. `ver_galeria` duplica `buscar_en_galeria` (ya existe): se reutiliza.
- **`lotes.mjs` no sirve tal cual (K1-03):** exige foto y receta por fila. Se crea `series.mjs` que copia solo la máquina de estados, la bomba (topes antes de cada paso) y `reconciliar`; `trabajos.mjs` gana `serieDe()/serieVivo` y la marca `serie:{id,n}`. Los pasos llaman a `media.submit` con prompt exacto y referencias. Nube: tabla `series` y módulo `cadaMinuto` propio, usando como máximo K de los 12 huecos y respetando `dailyLimit`. 31 carruseles ≈190 trabajos superan el cupo diario (40 unidades): la serie se pausa y **se reanuda sola al cambiar el día** (o lo dice).
- **Escaleta (K1-04):** 30 planos ≈6–9k tokens no caben en un turno (6.000). El turno de chat solo emite brief + `serie:{titulo,n,formato}`; la escaleta la escribe una llamada de servidor de ≤8 planos con `maxTokens` alto; el mensaje guarda `serieRef`. `parseCreatives` recorta referencias en silencio (`estudio-plan.mjs:209`): un plano que excede `maxRefs` queda `skipped` con motivo.
- **Texto compuesto (K1-05):** no existe (`imagen-local.mjs` sin composite/texto); `IMAGES` no dibuja texto [NV]. 11.5 empieza con un **spike de 1 día**: titular con `sharp({text:{fontfile}})` en Windows con un .ttf real. En la nube el texto se compone en local o se rasteriza en el navegador (canvas) al aprobar. Salida de láminas: JPEG.
- **Ficha cacheada (K1-06):** local `galeria.mjs:209 update()` pasa a tmp+`renombrar`; nube `json_set` en un UPDATE único. `kind:'vision'` en el ledger. Lo descrito pasa por `safety.injectionIn` al guardar y al leer; clave nueva en `dataInjection`; cadena sospechosa → `desc_inyeccion`, no entra al prompt.
- **Aprobar en lote (K1-07):** `src/contenido.js:377` filtra `borrador` y <8 días; `pieza_crear` no admite medios, `estado` ni `cuentas`. 11.5 añade `estado:revision`, `medios[]`, `cuentas` y `origen:serie:<id>` a la op, y un botón «Aprobar las N de la serie» por `serieId`. El segundo clic y `revisarPublicacion` siguen en el servidor.
- **Segundo clic (K1-08):** GENERAR SERIE exige en el servidor `costoMostrado` y `topeUsd` (409 si la estimación los supera) y token de un solo uso (patrón Anuncios); no basta `pedirOk` en la página.
- **Prompt (K1-09):** ninguna línea nueva en lo fijo (≈18.386/19.000); el esquema de `serie` va solo en el bloque variable `pideSerie` (≤3.000, con test que lo mide y mide el total). `studioish` suma `pideSerie` y `serieRef.seguir`; `historyLine/plegarHilo` reciben `[serie id]` y estado vivo.
- **Citas (K1-10):** `serve.mjs:938-961` no es un bucle (es `askX`); el tope de 4 imágenes está en `vision.mjs:8`; la «hoja de contactos» reutiliza el contact-sheet de la Fase 1.3 del central (EST-05..07); `galeria-filtro` está en `src/galeria-filtro.js:36` y `desc/etiquetas` solo sirven si el listado las envía; unificar el peso de música (×2 en `trabajos-core.mjs:26` vs ×3 en `estudio-pesos.mjs:4`).
- **No verificado:** sharp con fuentes en Windows; capacidades de `IMAGES`; coherencia real a 30 planos; límite de subpeticiones del cron del plan de pago; que una pieza `revision` con carrusel pase `revisarPublicacion` sin tocar medidas.
