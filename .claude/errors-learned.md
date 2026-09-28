# Errores aprendidos — Agents Office

## [2026-09-22] — La búsqueda de notas partía las palabras con tilde

**Contexto:** Configurar la oficina con el brain de PanaClaw (notas en español).
**Error:** `relevantNotes()` en `serve.mjs` separaba palabras con `/[^a-z0-9]+/`, así que «página» quedaba en «p» + «gina» y «clínica» en «cl» + «nica». Las tareas escritas en español casi nunca encontraban la nota correcta; solo llegaba el MOC del departamento.
**Causa raíz:** La expresión regular solo acepta ASCII y no se normalizaban los acentos, ni en el texto de la tarea ni en las notas.
**Fix aplicado:** Función `fold()` que pasa a minúsculas y quita los diacríticos (`normalize('NFD')` + quitar `̀-ͯ`) antes de partir palabras y antes de comparar con el nombre y el texto de cada nota.
**Prevención:** Toda búsqueda léxica sobre texto en español normaliza acentos en los dos lados. Los nombres de notas del brain van sin tildes (`precios-webs`, `objeciones-plazo`).
**Archivos:** `serve.mjs:184-191`

## [2026-09-22] — Las notas del brain llegan recortadas al agente

**Contexto:** Decidir cómo cargar el conocimiento de PanaClaw en el brain.
**Error:** (evitado) Clonar el repositorio PanaClaw-WorkSpace tal cual dentro del brain habría dado notas de hasta 30.000 caracteres y muchos `README.md` con el mismo nombre.
**Causa raíz:** `contextText()` corta cada nota a 1.800 caracteres, `businessContext()` corta CLAUDE, index, business-model y voice a 1.200, y `vaultIndex()` indexa por nombre de archivo (dos notas con el mismo nombre se pisan).
**Fix aplicado:** Brain curado en `brain-panaclaw/`: notas atómicas de menos de 1.800 caracteres con nombres únicos; los procedimientos largos van como skills (6.000 + 8.000 caracteres, que llegan completos).
**Prevención:** Una nota del brain dice lo esencial en sus primeros 1.200–1.800 caracteres; lo que tenga pasos y plantilla es un skill.
**Archivos:** `serve.mjs:171-201` · `brain-panaclaw/`

## [2026-09-22] — La oficina real mostraba tareas y cifras inventadas

**Contexto:** Abrir la oficina de PanaClaw con el .bat después de configurarla.
**Error:** Aparecían 118 tareas de empresas ficticias («Nectar Foods», «Totara Legal») y cifras falsas en las tarjetas («costo por usuario $41»), mezcladas con el trabajo real. Además seguían los nombres viejos, porque el servidor era el proceso anterior a los cambios.
**Causa raíz:** (1) El .bat reutiliza el servidor si ya responde, así que no cargó la configuración nueva. (2) `tasks.js` siembra una «mañana creíble» y reparte tareas inventadas a los agentes sin trabajo, y `main.js` inventa actividad y métricas, también cuando la página la sirve el servidor real.
**Fix aplicado:** Servidor reiniciado. La simulación (siembra, tareas inventadas, `fireAgentEvent`, métricas) corre solo cuando la página se abre como archivo; servida por http muestra solo trabajo real, y las tarjetas cuentan «entregas reales» y «esperan tu OK».
**Prevención:** Después de cambiar la configuración, el roster o el código del servidor, hay que reiniciarlo: cerrar el proceso de `node serve.mjs` y volver a abrir el .bat.
**Archivos:** `src/tasks.js:236,963` · `src/main.js:20,349,1025`

## [2026-09-22] — "Claude Code is not installed (claude not found on PATH)" en Windows

**Contexto:** Probar las tareas y el chat de los agentes desde la oficina (con Claude o con Meta Muse Spark).
**Error:** Todo chat/tarea respondía "No pude contactar a Claude (Claude Code is not installed (claude not found on PATH))"; la barra solo veía 1 conector (Chrome).
**Causa raíz:** La instalación npm de Claude Code pone `claude.cmd` en el PATH. `child_process.spawn('claude', …)` sin shell no ejecuta `.cmd` en Windows → ENOENT. Usar `shell:true` no sirve: el prompt y el system prompt van como argumentos y cmd.exe los rompería.
**Fix aplicado:** `CLAUDE_BIN` en `mcp.mjs` busca el `claude.exe` real (`<dir PATH>\node_modules\@anthropic-ai\claude-code\bin\claude.exe`), con override por la variable `CLAUDE_BIN`; `serve.mjs` y `mcp.discover()` lanzan ese binario.
**Prevención:** En Windows nunca hacer `spawn` de un comando instalado por npm por su nombre; resolver el `.exe` real. Las 10 comprobaciones rojas de `npm run check` (routines/calendar/smoke) son textos esperados en inglés tras la traducción al español, no este fallo.
**Archivos:** `mcp.mjs:28-40`, `mcp.mjs:133`, `serve.mjs:137`

## [2026-09-23] — Todas las ejecuciones fallaban con «API Error: 400 `name` must be at most 64 characters, got 66»

**Contexto:** Rutinas y tareas de agentes (triage de la bandeja, revisar enlace de Meet).
**Error:** El resultado de la tarea era el texto del error, se marcaba como correcta y se guardaba como nota en el cerebro.
**Causa raíz:** (1) El conector claude.ai «Cloudflare Developer Platform» trae herramientas con nombres de hasta 77 caracteres (`mcp__claude_ai_Cloudflare_Developer_Platform__search_cloudflare_documentation`); la API rechaza >64 y tumba la ejecución entera. `mcp.deny` no las quita del contexto. (2) `askX` aceptaba `is_error: true` con texto como si fuera un entregable.
**Fix aplicado:** `mcp.probeTools()` arranca `claude -p` al iniciar, lee el evento `init` y lo mata antes de llamar al modelo; los nombres >64 y los servidores no permitidos van a `--disallowedTools` (sí los saca de la lista: 403 → 364 herramientas). `is_error` ahora rechaza la promesa.
**Prevención:** Nunca confiar en que `deny`/`--allowedTools` reduzcan el contexto: solo `--disallowedTools` lo hace. Todo resultado con `is_error` es un fallo, nunca una nota.
**Archivos:** `mcp.mjs` (probeTools, disallowedTools), `serve.mjs` (askX)

## [2026-09-23] — Pausar o editar una rutina borraba otras del archivo del dueño

**Contexto:** Editar rutinas desde el calendario/chat.
**Error:** Rutinas inválidas (escritas a mano) y el campo `team` desaparecían de `routines.json` al pausar cualquier otra.
**Causa raíz:** `editRoutine` guardaba `rlist.routines`, la lista YA validada (sin las inválidas), y `routines.save` no escribía `team`.
**Fix aplicado:** `routines.patchFile()` edita el documento tal como está en disco, solo la rutina tocada; escritura atómica (tmp + rename).
**Prevención:** Nunca reescribir un archivo del dueño desde una vista filtrada/validada; parchear el crudo.
**Archivos:** `routines.mjs` (patchFile), `serve.mjs` (editRoutine, removeRoutine)

## [2026-09-23] — npm run check 37/47 tras traducir la interfaz

**Contexto:** Fork traducido al español.
**Error:** Los tests de humo buscaban textos en inglés («Added», «Routine set», «NEXT», «SCHEDULED»…) y un fallo dejaba el editor grande abierto, bloqueando los siguientes (fallos en cascada).
**Causa raíz:** Aserciones por texto visible + orden de pasos dependiente del estado anterior (el filtro PROGRAMADAS quedaba activo). Además un `textarea` vacío mide su placeholder: al envolver en 2 líneas no «encogía».
**Fix aplicado:** Aserciones en español, `waitForFunction` en vez de esperas fijas, el test de aprobación vuelve a «TODAS», `grow()` deja la caja en 30 px si está vacía.
**Prevención:** Al traducir textos de la UI, correr `npm run check` en el mismo cambio; esperar condiciones, no milisegundos.
**Archivos:** `check.mjs`, `src/tasks.js:301`

## [2026-09-23] — Las pruebas compartían data/ y el cerebro reales con la oficina del dueño

**Contexto:** Probar el Subgerente y `npm run check` mientras la oficina del dueño estaba abierta.
**Error:** Los servidores de prueba (puerto 4610 y el que lanza `check.mjs`) leían y escribían `data/tasks.json`, `data/routines.json` y `<brain>/Agents Office/routines.json` reales. Entre 08:52 y 09:03 esos archivos quedaron vacíos y no se pudo determinar con certeza qué proceso lo hizo.
**Causa raíz:** `serve.mjs` tenía `DATA = ROOT/data` fijo; `check.mjs` arrancaba el servidor con el cerebro real. Además `load()` convertía un JSON ilegible en `[]`, que el siguiente `save()` habría escrito encima.
**Fix aplicado:** `AO_DATA` (carpeta de datos configurable); `check.mjs` arranca su servidor con una carpeta temporal y una COPIA del cerebro; `load()` ya no devuelve `[]` ante un archivo corrupto (guarda una copia y falla); copia diaria en `data/backups/` (14 días).
**Prevención:** Nunca probar contra los datos del dueño: servidor de prueba siempre con `AO_DATA` y `AO_BRAIN` temporales. Nada que falle al leer debe tratarse como «vacío».
**Archivos:** `serve.mjs` (DATA, load, backups), `check.mjs` (sandbox del server smoke)

## [2026-09-24] — La galería en columnas se desbordaba de lado

**Contexto:** Galería «masonry» del Estudio V2 con CSS `columns`.
**Error:** Barra de desplazamiento horizontal y una tercera columna cortada a la derecha.
**Causa raíz:** Un contenedor multicolumna con altura fija (`flex: 1` + `overflow-y: auto`) llena cada columna hasta esa altura y crea columnas nuevas hacia el lado en vez de crecer hacia abajo.
**Fix aplicado:** Las columnas van en una caja interior (`.st-cols`) sin altura; el contenedor con scroll es el de fuera (`.st-grid`, `overflow-x: hidden`).
**Prevención:** Nunca poner `columns` en el mismo elemento que tiene la altura limitada y el scroll.
**Archivos:** `src/studio.js` (renderGrid), `src/shell.html` (.st-grid, .st-cols)

## [2026-09-24] — Un heredoc largo rompía el shell de Windows

**Contexto:** Parchear `serve.mjs` con un script de Python pegado en un heredoc de bash.
**Error:** `unexpected EOF while looking for matching "'"` (el script nunca corrió).
**Causa raíz:** El bash de Windows (Git Bash) se atraganta con heredocs largos llenos de comillas y backticks.
**Fix aplicado:** Escribir el script como archivo (herramienta Write) en el scratchpad y ejecutarlo con `python archivo.py`.
**Prevención:** Parches de más de unas líneas: siempre como archivo, nunca en heredoc.
**Archivos:** —

## [2026-09-24] — La rueda del ratón no desplazaba ningún panel

**Contexto:** Queja del dueño: «tengo que ir a la barra de scroll y arrastrar; con la ruedita no funciona».
**Error:** Ningún panel (tareas, detalle, Estudio, calendario, Dimitri) desplazaba con la rueda.
**Causa raíz:** `src/main.js` tenía `addEventListener('wheel', …, { passive: false })` en `window` con `preventDefault()` para el zoom de la vista 3D, y solo exceptuaba `#rail`. Cada panel nuevo quedaba sin rueda.
**Fix aplicado:** El zoom solo actúa si el objetivo es el canvas o está dentro de `#hud` (tarjetas y píldoras sobre la escena); en cualquier otro sitio la rueda hace lo normal.
**Prevención:** Un listener global que cancela un evento del navegador debe decir DÓNDE actúa (lista blanca), nunca dónde no (lista negra). Hay un test de humo que lo comprueba (`dispatchEvent` de un WheelEvent devuelve si se canceló).
**Archivos:** `src/main.js` (wheel), `check.mjs` (smoke V4)

## [2026-09-24] — Tras cerrar una ventana, los atajos dejaban de funcionar

**Contexto:** Test de humo: S abre Dimitri, Esc lo cierra, B debía abrir el tablero.
**Error:** B no hacía nada (y de forma intermitente).
**Causa raíz:** Al cerrar, la ventana se oculta con `hidden` tras una transición, pero el textarea de dentro seguía siendo `document.activeElement`. El handler global ignora las teclas si el foco está en un TEXTAREA.
**Fix aplicado:** `close()` hace `document.activeElement.blur()` si el foco está dentro (Dimitri, Estudio, detalle).
**Prevención:** Al ocultar un contenedor, soltar primero el foco que tenga dentro. En los tests, esperar condiciones (`waitForFunction`) y no milisegundos.
**Archivos:** `src/sub.js`, `src/studio.js`, `src/detail.js` (close)

## [2026-09-24] — Los acentos se rompían al parchear con un heredoc en Windows

**Contexto:** Un script de Python pasado por heredoc en Git Bash para editar `serve.mjs`.
**Error:** `AssertionError` al buscar texto con «ñ», «→» y «é», aunque el texto existía.
**Causa raíz:** Python leyó el script desde stdin con la codificación de la consola de Windows (cp1252), no UTF-8, y los caracteres no ASCII llegaron cambiados.
**Fix aplicado:** Para cambios con acentos, usar la herramienta Edit o un archivo `.py` escrito con Write (que Python lee como UTF-8).
**Prevención:** Nada con caracteres no ASCII por heredoc en Windows.
**Archivos:** —
**Nota (2026-09-27):** con `python -` (el script entero por stdin, heredoc entre comillas `<<'EOF'`) los acentos llegaron bien: Python lee el código fuente como UTF-8. El problema es con `python -c` o al leer texto de stdin como datos. Igual, comprobar con `grep "Ã\|â€"` después.

## [2026-09-27] — La cámara volaba hacia atrás un cuadro al empezar un vuelo

**Contexto:** Al abrir a Dimitri se acerca el centro (`enterFocus('brain')` → `flyTo`); una prueba medía el zoom cada 150 ms.
**Error:** El zoom pasaba de 0,51 a −0,54 y luego a 3,1: un zoom negativo por un momento (en un navegador normal, un tirón de un cuadro hacia afuera antes de acercarse).
**Causa raíz:** `tickTween(now)` recibe la hora del cuadro de `requestAnimationFrame`, que empezó ANTES del clic que llamó a `flyTo` (`t0 = performance.now()`). El progreso `k` salía negativo y la curva de easing devuelve valores negativos fuera de [0, 1].
**Fix aplicado:** `k = Math.min(1, Math.max(0, (now - t0) / dur))`.
**Prevención:** Toda animación que mezcle `performance.now()` de un evento con la hora de rAF debe acotar el progreso a [0, 1].
**Archivos:** `src/main.js` (tickTween)

## [2026-09-27] — Tab se atascaba o se escapaba con una vista abierta

**Contexto:** V4.5: Estudio, Calendario y Cerebro son vistas bajo la barra superior; `modal.js` deja la barra fuera de lo inerte y Tab recorre barra + vista.
**Error:** `npm run check`: «Tab left the Estudio and its top bar 1 times»; luego, Tab se quedaba quieto en un `<summary>`.
**Causa raíz:** (1) Un aviso con DESHACER lleva `data-modal-keep` (nunca inerte) y está en la página entre la barra y la vista: el navegador lo visitaba al salir del último icono de la barra. (2) Un botón dentro de un `<details>` cerrado tiene cajas (`getClientRects` no vacío) pero no acepta el foco, y la lista de «enfocables» lo incluía.
**Fix aplicado:** Con una vista arriba, `modal.js` lleva el orden de Tab él mismo (paso a paso por la lista, saltando lo que no acepte el foco) y excluye lo que está dentro de un `<details>` cerrado.
**Prevención:** Si se deja algo fuera de lo inerte, controlar el orden de Tab en vez de confiar en el orden del DOM; «visible» no es «enfocable».
**Archivos:** `src/modal.js`

## [2026-09-27] — `npm run check` generaba (y cobraba) una imagen real de Gemini

**Contexto:** El paso «estudio: the free test engine generates…» de `check.mjs` comprueba que un motor sin key avisa de cuál falta, pidiendo una imagen a `gemini`.
**Error:** «✗ … — trash» en cada check de esta máquina; a la vez, una imagen de verdad en la cuenta de Google del dueño (≈US$0,04) por cada ejecución.
**Causa raíz:** El dueño ya tiene `GEMINI_API_KEY` en Windows: el pedido «sin key» salió de verdad, la imagen extra entró en la galería de prueba y la cuenta de la papelera ya no daba 1. La condición `!process.env.GEMINI_API_KEY` solo esquivaba el mensaje, no el gasto.
**Fix aplicado:** Quitar `GEMINI_API_KEY` del entorno solo durante esa llamada y devolverla en `finally`.
**Prevención:** Una prueba que «no debe tener key» la quita ella misma; nunca confía en que la máquina no la tenga. Las pruebas de motores de pago usan un sustituto local (`HF_API_BASE_URL`, `AO_GEMINI_BASE`, `AO_FAL_QUEUE`).
**Archivos:** `check.mjs` (paso del motor de prueba)

## [2026-09-27] — `hidden` no ocultaba el botón Guardar de Ajustes

**Contexto:** Las pestañas nuevas de Ajustes (Apariencia, Atajos) se aplican al instante y no deben mostrar «Guardar».
**Error:** El botón seguía a la vista aunque tenía `hidden` (también pasaba en «Preparar desde mi web»).
**Causa raíz:** `.sg-btn { display: inline-flex }` gana al `display: none` que el navegador da a `[hidden]`.
**Fix aplicado:** `.sg-btn[hidden], .bz-btn[hidden] { display: none; }`.
**Prevención:** Toda clase que fije `display` en un elemento que se oculta con `hidden` necesita su regla `[hidden]`.
**Archivos:** `src/shell.html`


## [2026-09-27] — Clicar una nota del Cerebro fallaba siempre por 52 px

**Contexto:** V4.5 bajó las vistas (Estudio, Calendario, Cerebro) bajo la barra superior (`inset: 52px 0 0 0`).
**Error:** El dueño: «cuando intento cliquear algún archivo es muy difícil». Casi nunca abría la nota.
**Causa raíz:** El Cerebro 2D comparaba `clientX/clientY` (coordenadas de la página) con posiciones dibujadas en coordenadas del lienzo; al bajar el lienzo 52 px, todo clic apuntaba 52 px por encima. Además el alcance era de 12 px sin sumar el radio del punto, un clic con 3 px de temblor contaba como arrastre y el clic abría el `hover` del último movimiento.
**Fix aplicado:** El Cerebro 3D (`src/brain3d.js`) busca la nota en coordenadas del lienzo (`getBoundingClientRect`), con tolerancia de 16 px (26 táctil) más el radio de la neurona, toma la candidata al pulsar y la confirma al soltar; un arrastre es > 5 px (10 táctil). Los nombres también se pueden clicar.
**Prevención:** Al mover un contenedor de un lienzo interactivo, revisar su detección de clic. Regla en CLAUDE.md (reglas de la interfaz).
**Archivos:** `src/brain3d.js` (pickAt, pointerdown/up)

## [2026-09-27] — Una nota nueva movía todo el Cerebro 3D

**Contexto:** `layout3D` con posiciones previas (`prev`) al llegar una nota nueva.
**Error:** Prueba «a new note joins beside its neighbour and the others keep their place»: una nota vieja se movió 1,49 (medio cerebro).
**Causa raíz:** Las regiones se ordenaban por número de notas: una nota más cambiaba el orden, todas las anclas se movían y el asentado de 90 vueltas arrastraba a todas las notas.
**Fix aplicado:** Con posiciones previas solo se mueven las notas nuevas y sus vecinas; las regiones salen de la afinidad de enlaces; la rejilla se adapta al número de notas (2.000 notas: 6,7 s → 1,2 s la primera vez; una nota nueva 1,7 s → 25 ms). Las posiciones se recuerdan en el navegador (`ao.bv.pos`).
**Prevención:** En una disposición incremental, lo ya colocado queda fijo; probarlo con un test de «no se mueve».
**Archivos:** `src/brain3d.js` (layout3D, regionAnchors), `tests/brain3d.test.mjs`

## [2026-09-27] — Los heredocs con comillas simples dentro fallan en la consola de Bash de esta máquina

**Contexto:** Pasar CSS o JS con `content: ''` o `'\u0001'` por `cat > archivo <<'EOF'`.
**Error:** `unexpected EOF while looking for matching '` aunque el heredoc tenía el delimitador entre comillas.
**Causa raíz:** La herramienta revisa el equilibrio de comillas del comando entero antes de ejecutarlo, sin entender los heredocs.
**Fix aplicado:** Escribir esos archivos con la herramienta Write (y los scripts de Python también), y ejecutarlos después.
**Prevención:** Nada con comillas simples sueltas dentro de un heredoc; archivos auxiliares, con Write.
**Archivos:** —

## [2026-09-27] — Un comentario `//` metido a mitad de línea anuló el código que seguía

**Contexto:** Parches con Python que añadían una explicación a líneas largas de una sola línea (`src/studio.js` closeMenus; `src/brain3d.js` setData).
**Error:** esbuild: «Expected ")" but found end of file»; la segunda vez no hubo error de compilación: el Cerebro 3D se quedó sin posiciones (`P = layout3D(...)` quedó comentado), sin nombres visibles y con «computeBoundingSphere(): Computed radius is NaN».
**Causa raíz:** Un `// comentario` insertado en medio de una línea convierte en comentario todo lo que sigue en esa línea.
**Fix aplicado:** `/* comentario */` en su lugar.
**Prevención:** En una línea que sigue después del punto de inserción, solo comentarios de bloque `/* */`. Un `//` va únicamente al final real de la línea. Tras parchear, `node build.mjs` y una prueba que ejercite lo tocado.
**Archivos:** `src/studio.js` (closeMenus), `src/brain3d.js` (setData)
