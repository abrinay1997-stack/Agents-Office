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
