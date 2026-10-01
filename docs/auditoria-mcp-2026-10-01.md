# Auditoría de los conectores MCP — 1 oct 2026

Pedido del dueño: «arregla los 3 pendientes que faltan, más una auditoría general de los conectores MCP».

La auditoría se hizo en solo lectura sobre el commit `3fc5b3c`, midiendo en la máquina del dueño. Los arreglos están en la rama `lane/mcp`.

## Veredicto

Antes de los arreglos, **las reglas de envío tenían agujeros reales.** El guardián decidía por el nombre de la herramienta y lo que no reconocía lo trataba como lectura. Así pasaban sin el OK del dueño:
- un `graphql_mutation` de Shopify;
- un SQL libre en Cloudflare;
- una respuesta a una invitación de Calendar;
- un lote de clics y escritura en el Chrome del dueño, con el que además se podía abrir un sitio prohibido.

Además, los conectores de plugin (que hoy son **todos** los conectores del negocio: Gmail, Calendar, Drive y Shopify llegan como `plugin:small-business:*`) no casaban con ningún nombre conocido. Por eso iban a los seis departamentos, entre ellos el Telegram personal del dueño. Cada tarea arrancaba los 131 servidores de la máquina.

**Lo que cambió:**
- Las herramientas que no se reconocen se bloquean en vez de pasar.
- Cada conector va solo a las mesas que le tocan.
- El guardián rechaza cualquier servidor que la mesa no recibió.
- Una tarea arranca solo los servidores de su mesa: pasa de 12,5 s a entre 6 y 8 s hasta estar lista, medido con la CLI real.
- El panel de conectores dice por qué falla cada uno, cómo arreglarlo y qué herramientas envían.

### Lo medido (data/mcp-audit/)
- `claude mcp list` tardó **86,8 s** y devolvió 129 servidores: 17 conectados, 74 piden autenticación, 10 fallan y 28 están sin configurar.
- Un `claude -p` de agente arrancaba 131 servidores con 153 herramientas MCP; 19 de ellas tienen nombres de más de 64 caracteres.
- Después del arreglo, con la CLI real (sin llamar al modelo; el proceso se para en el evento init):
  - **12,5 s** con todos los servidores y sin los conectores de claude.ai que la mesa no usa;
  - **6,1 s** con Gmail y Shopify aislados: conectados con su OAuth, 63 herramientas;
  - **8,3 s** con Gmail y Drive aislados, con el mismo id de herramienta que antes (`mcp__plugin_small-business_gmail__*`);
  - `--chrome` sigue añadiendo el navegador en modo aislado.

## Tabla por severidad

| Severidad | Total | ✅ Arreglado | 🟡 En parte | ⏳ Pendiente |
|---|---|---|---|---|
| crítica | 2 | 2 | 0 | 0 |
| alta | 4 | 4 | 0 | 0 |
| media | 6 | 3 | 3 | 0 |
| baja | 4 | 2 | 1 | 1 |
| **Total** | **16** | **11** | **4** | **1** |

Durante el arreglo apareció un hallazgo más, el MCP-17, que también quedó arreglado. No cuenta en la tabla.

## Los puntos

### MCP-01 · crítica · ✅ arreglado (safety.mjs: en la duda, envía; tests/mcp-kinds.test.mjs con las 153 herramientas reales)
- **Problema:** `kindOf` decidía por la primera palabra del nombre y lo desconocido era «lectura». Pasaban sin OK:
  - `graphql_mutation`, `d1_database_query`, `respond_to_event`, `copy_file`, `batch`, `react`;
  - `untrash`, `unlabel` y `unmark` de Gmail;
  - cualquier `send_draft`.
- **Arreglo:**
  - Ahora es lectura solo si el nombre empieza por un verbo de lectura (o lo trae) y no trae ninguno que cambie algo. Un nombre desconocido es envío.
  - Hay verbos fuertes (`mutation`, `sql`, `respond`, `copy`, `batch`, `react`, `untrash`, `restore`, `generate`, `switch`, `apply`, `install`…) y débiles. Los débiles (`schedule`, `post`, `label`…) son también sustantivos y no cuentan tras un verbo de lectura: `get_schedule` sigue leyendo.
  - `query` cuenta como envío en una base de datos (sql, d1, supabase, snowflake…).
  - `draft` solo vuelve inofensiva una herramienta si no lleva `send`, `publish`, `schedule` o `submit`.
  - Nuevo `safety.toolKinds` para que el dueño fije el tipo de una herramienta concreta (`read`, `write` o `cost`, con `*`). `npm run check` avisa de un valor que no existe.
- **Pendiente menor:** las anotaciones MCP `readOnlyHint` y `destructiveHint` no llegan en el evento init de Claude Code, así que no se pueden usar todavía. Por ahora se usan el nombre y `toolKinds`.

### MCP-02 · crítica · ✅ arreglado (safety.decide: el lote del navegador, elemento por elemento)
- **Problema:** `browser_batch` (navegar, hacer clic, escribir) y `shortcuts_execute` salían como lectura. `browser_batch` se saltaba los sitios prohibidos, y la herramienta real `tabs_create_mcp` no casaba con `tabs_create`.
- **Arreglo:**
  - `decide()` revisa cada elemento de `input.actions` como si se llamara solo: sitio, envío y política. El lote se bloquea si se bloquea uno de ellos y es envío si uno lo es.
  - Un lote vacío o raro es envío.
  - Un `computer` que solo mira (screenshot, scroll, zoom, wait, hover) es lectura.
  - `shortcuts_execute` y `gif_creator` son envío, y el chequeo de sitio usa `/^tabs_create/`.
  - Tests con las formas exactas, también a través del hook (`tests/guard.test.mjs`).

### MCP-03 · alta · ✅ arreglado (mcp.mjs: nombres de plugin; lo desconocido no llega a ninguna mesa)
- **Problema:** `plugin:<plugin>:<servidor>` no casaba con logos, departamentos ni con `deny`, `allow` o `departments` escritos como «Gmail». Un agente de Emails recibía 18 servidores.
- **Arreglo:**
  - Se usa el último tramo del nombre: «Gmail», «Google Calendar», «Shopify». El plugin se guarda aparte y sale como subtítulo en el panel.
  - Hay alias nuevos (shopify, cloudflare, telegram, github…).
  - `matches()` acepta el nombre corto, el nombre bruto y el id.
  - **Un servidor desconocido no va a ninguna mesa** hasta que se le asigna. Con la lista real, Emails recibe Gmail y Calendar y nada más.
  - Tests con la lista real (`tests/fixtures/mcp/mcp-list.txt`, sin rutas personales) y un paso nuevo en `npm run check`.

### MCP-04 · alta · ✅ arreglado (estados honestos, el motivo y un semáforo que cuenta)
- **Arreglo:**
  - «- Not configured» pasa a ser `not-configured`: no está en la barra, no está en el semáforo y no es un fallo.
  - El motivo («HTTP 400…», «Request timed out») se guarda con las claves tapadas.
  - Un servidor que llega a una ejecución `disabled` o `pending` ya no sale como conectado.
  - El semáforo dice «17 conectados · 10 fallan · 74 piden entrar», y solo se pone en rojo cuando falla un conector que usa una mesa.
  - El aviso de cada 3 h solo sale para un conector que usa una mesa, y dice el motivo.

### MCP-05 · alta · ✅ arreglado (los nombres largos, desde la caché y con un reintento)
- **Arreglo:**
  - Los nombres de más de 64 caracteres se guardan en `data/mcp-cache-<proveedor>.json` y se leen al arrancar.
  - La sonda corre en paralelo con `claude mcp list`, no después.
  - Si una ejecución falla con el error de los 64 caracteres, la oficina aprende el nombre (el init de esa misma ejecución ya lo trajo, y si el error lo nombra también) y reintenta una sola vez (`askX` → `askRun`).
- **Sin reproducir:** el texto exacto del error de la API (no se quiso gastar la sesión del dueño). La expresión que lo reconoce es amplia y tiene test.

### MCP-06 · alta · ✅ arreglado (cada mesa arranca solo sus servidores; medido con la CLI real)
- **Arreglo:**
  - `mcp.runConfig(agent)` reconstruye la configuración exacta de cada servidor de la mesa. La de un plugin sale de su `.mcp.json` en `~/.claude/plugins`, y casa por la URL que dio `claude mcp list`.
  - La ejecución va con `--strict-mcp-config` y un `--mcp-config` en un archivo temporal, que se borra al terminar (la configuración de un servidor puede llevar una key).
  - El archivo lleva también el Estudio y Contenido, con el **mismo id de herramienta** que antes.
  - Si la oficina no puede reconstruir un servidor exacto (un conector de claude.ai, un comando de plugin con `${CLAUDE_PLUGIN_ROOT}`, una cabecera con `${VAR}`), esa mesa carga todo como antes. Aun así, si la mesa no usa ningún conector de claude.ai, esa ejecución tampoco los arranca (`ENABLE_CLAUDEAI_MCP_SERVERS=false`).
  - Un servidor que una ejecución aislada no alcanza vuelve a la carga completa (`noIsolate`), sin que se marque como caído.
  - `mcp.isolate: false` lo apaga.
- **Por probar:** el init con OAuth está medido (conectado, con sus herramientas). Falta una llamada real a Gmail en una tarea aislada; se hará con la primera tarea del dueño.

### MCP-07 · media · ✅ arreglado (un candado en el guardián, en vez de quitar los ajustes del dueño)
- **Arreglo:**
  - La ejecución pasa al guardián la lista de servidores que recibió la mesa (`servers`), y `decide()` rechaza cualquier otro, aunque los ajustes del dueño lo permitan.
  - Un servidor que aparece en un init y no estaba en la lista queda como `fresh` y no llega a nadie hasta la siguiente comprobación.
  - El plugin `telegram` está bloqueado por defecto. Vuelve si el dueño lo nombra en `mcp.allow` o en `mcp.departments`.
- **No se hizo `--setting-sources` sin `user`:** los conectores del negocio son plugins activados en los ajustes de usuario, y quitarlos dejaba a los agentes sin Gmail. El candado del guardián cubre el mismo riesgo.

### MCP-08 · media · 🟡 en parte (la clase «cost»; falta el gasto en el aviso de la tarea)
- **Hecho:**
  - `generar_*`, `analizar_video` y `transcribir_audio` del Estudio son `cost`.
  - Se permiten antes del OK (los topes del Estudio limitan el importe) y se bloquean con la política «nunca». Todo queda en el registro de `data/audit/`.
  - Las demás herramientas del Estudio y Contenido siguen como lectura.
- **Pendiente:** que el aviso de la tarea diga cuánto gastó. Eso toca `media.mjs` y `tasks`, de otros equipos.

### MCP-09 · media · ✅ arreglado (una sola comprobación a la vez; la página no enseña la demo)
- **Arreglo:**
  - `discover()` comparte la llamada en curso, el tope pasa a 180 s y el comentario está al día.
  - `/api/mcp` contesta al instante con `discovering` y el icono de Chrome.
  - La página, servida por la oficina, dice «comprobando conectores… (1–2 min la primera vez)» y vuelve a preguntar. Nunca pinta la demo como si fuera real.

### MCP-10 · media · ✅ arreglado (la barra y los nombres)
- **Arreglo:**
  - La barra muestra lo conectado y lo que falla de verdad (19 iconos con la lista real, antes 131). El resto queda en un «+71» que abre el panel.
  - Los iconos sin logo usan las iniciales del nombre propio, no «PS».
  - El panel llama a cada conector por su nombre, con el plugin debajo.
  - Comprobado con `scripts/conectores-recorrido.mjs` a 1512, 1024 y 390 px, en claro y en oscuro (capturas en `data/capturas/mcp/`).

### MCP-11 · media · 🟡 en parte (la ficha de cada conector; falta la entrada en el teléfono)
- **Hecho:**
  - Cada conector se despliega y muestra:
    - su estado y el motivo exacto;
    - los departamentos, en palabras;
    - dónde está (solo el host);
    - las herramientas, marcadas lee, envía o gasta tal como las ve el guardián;
    - cómo conectarlo: `/mcp` para un plugin, el enlace a claude.ai para uno de claude.ai.
  - El panel tiene «Volver a comprobar».
  - Ya no es `role=dialog`: es un desplegable (`aria-controls` y `aria-expanded`). Esc lo cierra.
  - Los objetivos miden 24 px o más (comprobado), el foco usa `var(--focus)` y las etiquetas de color pasan 4,5:1 en claro y en oscuro.
- **Pendiente:** en el teléfono (760 px o menos) la barra de conectores está oculta desde V4, así que el panel no tiene por dónde abrirse. Falta una entrada en el «⋯» del dock (`src/dock.js`, de otro equipo).

### MCP-12 · media · 🟡 en parte (al instante y con lista blanca; falta la tabla)
- **Hecho:**
  - `mcp.deny` y el nuevo `mcp.allow` («Solo estos conectores») se aplican al guardar, sin reiniciar: `saveSettings` llama a `mcp.configure`.
  - En cada guardado se vuelven a calcular las mesas de cada conector, así que lo que se haya escrito en `mcp.departments` también entra sin reiniciar.
- **Pendiente:** la tabla conector × departamento con casillas. Necesita un tipo de campo nuevo en `src/settings.js`, de otro equipo. Mientras tanto, la ficha de cada conector dice dónde asignarlo.

### MCP-13 · baja · 🟡 en parte (respuestas largas sí; tiempo de espera por servidor no)
- **Hecho:** `MAX_MCP_OUTPUT_TOKENS=60000` en el entorno de cada ejecución, para que una respuesta larga no se pierda en un archivo que el agente no puede leer.
- **Pendiente:** `MCP_TOOL_TIMEOUT` es único para todos los servidores. Bajarlo para todos menos el Estudio exige un tiempo por servidor que Claude Code no ofrece por variable de entorno.

### MCP-14 · baja · ✅ arreglado (el navegador no ve rutas ni claves)
- **Arreglo:**
  - `/api/mcp` manda solo el host de una URL, o «local» para un comando.
  - `mask()` tapa también tokens Bearer y segmentos de ruta largos y aleatorios.
  - Hay un test que comprueba que no sale ninguna ruta `C:/Users`.

### MCP-15 · baja · ✅ arreglado (dos servidores de una marca)
- **Arreglo:** el icono compartido toma el mejor estado (conectado gana a falla, y falla gana a pide entrar) y une los departamentos de los que están conectados. El panel enseña cada servidor por separado.

### MCP-16 · baja · ⏳ pendiente (estudio-mcp.mjs es de otro equipo)
- **Por qué no:** `estudio-mcp.mjs` no es de este equipo y lo están tocando a la vez. El arreglo sigue siendo el de la auditoría: `AbortSignal.timeout(130000)` en las llamadas POST, con un mensaje claro en español, y un test con un servidor que no contesta.

### MCP-17 · media · ✅ arreglado (hallazgo nuevo: un borrador recién arrancada la oficina no perdía las herramientas de envío)
- **Problema:** `writeTools()`, que quita las herramientas de envío de un borrador, lee las herramientas de cada servidor. Esas herramientas solo se aprendían en la primera ejecución, así que el primer borrador tras reiniciar no perdía ninguna. El guardián lo seguía bloqueando, pero el agente las veía.
- **Arreglo:** la caché guarda también las herramientas de cada servidor. Hay test.

## Cómo comprobarlo
- `npm test`:
  - `tests/mcp-kinds.test.mjs`: las 153 herramientas reales, Chrome, el candado de servidores y el Estudio;
  - `tests/mcp-plugins.test.mjs`: la lista real, nombres, departamentos, Telegram, init, nombres largos, caché, aislamiento, una sola comprobación y rutas;
  - `tests/guard.test.mjs` y `tests/safety.test.mjs`.
- `npm run check`: el paso «connectors: claude mcp list parses» incluye los plugins y la regla «en la duda, envía».
- `node scripts/conectores-recorrido.mjs`: la barra y el panel en el navegador, con la lista real.
