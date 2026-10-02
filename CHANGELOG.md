# Changelog

## V5.1 — 2 oct 2026 (Básico y Avanzado en el Estudio)

Pedido del dueño tras probar el banco: «este modo debería activarse como modo avanzado», «prefiero poner la relación de aspecto yo mismo», «el modelo prefiero siempre verlo y ajustarlo».
- **Básico · Avanzado** en el paso 1 del compositor de imagen (se recuerda, `ao.st.modo`). Básico es el compositor de siempre y no descarga el banco; Avanzado suma los presets y el escenario 3D. B y «/» pasan a Avanzado.
- **El modelo y el formato, siempre a la vista y siempre los tuyos**, también con presets: el plan los usa tal cual (`pedido.model`, `pedido.proporcion`, que gana a la escena, al preset y al canal). El cuadro del escenario 3D sigue al formato, y cambiarlo en el escenario cambia el formato.
- **Fuera** «Para dónde va», «Qué hará» y «Resultado». Lo hecho va solo a la galería (antes cada GENERAR dejaba una entrada que no se borraba). El costo o el problema del plan salen junto a GENERAR.
- **Pruebas:** el formato y el modelo que eliges ganan (`presets-core`, `presets-servidor`, `studio-banco`); `scripts/presets-recorrido.mjs` (28 pasos en el navegador) y `scripts/estudio-modos-capturas.mjs` (Básico y Avanzado a 390, 1024 y 1512 px, claro y oscuro).

## V5.0 — 2 oct 2026 (el banco de presets del Estudio)

- **Diseño:** 3 investigaciones de mercado, 3 arquitectos y un debate de 3 críticos (fotógrafo de producto, diseñador de marketing, ingeniero): `docs/propuesta-banco-presets.md`. §15 y §16 recogen las decisiones del dueño.
- **El banco** (tecla **B** en el Estudio):
  - 127 presets de imagen con icono y un buscador que entiende palabras de tienda;
  - tres puertas como atajos combinables: Desde cero · Mejorar mi foto · Copiar de una referencia;
  - pila de presets con DESHACER, referencia por ejes (estilo, color/LUT, composición, luz, fondo, pose; el producto nunca por defecto), canal;
  - «Qué hará», que dice lo que se hace gratis en tu máquina, lo que rehace la IA, lo que no cambia y el costo.
- **Local antes que IA** (`sharp`): luz, sombras, color, LUT (aplicar y exportar .cube), copiar el color de una referencia, fondo blanco con máscara (no se come lo blanco), encuadre y exportación sRGB sin EXIF. Nada cae a la IA sin decirlo.
- **Control de calidad:** forma y color dentro del producto, y la ocupación medida. Lo que no cuadra queda en «revisar».
- **Escenario 3D:**
  - el producto con sus medidas reales, que gira y se sube para el contrapicado;
  - la cámara en órbita sobre el piso, de 0 a 90°, con la distancia en cm o m y el lente;
  - atajos de toma y de distancia;
  - todo se traduce al prompt y a una imagen guía de composición, así que el producto se achica por la distancia, el fondo no cambia y nada se recorta.
- **Tus presets son notas del Cerebro** (`<cerebro>/Estudio/Presets/`): neuronas del gráfico. Se crean con «Guardar como preset».
- **Lotes** (tecla **L**):
  - entradas: Excel o CSV (con fotos incrustadas o nombradas, SKU, medidas, notas), carpeta, ZIP o selección;
  - «Probar con 3», el seguimiento foto por foto con antes y después y una bitácora;
  - pausar, reanudar, reintentar (más fuerte o con otro modelo), y reanudar si la oficina se reinicia;
  - salida: ZIP y CSV con nombres por SKU.
- **Dimitri** arma y sigue lotes y presets: «convierte estas 40 fotos en catálogo para la web». Nada arranca sin tu clic, y si el costo real supera el del botón, pide un segundo clic.
- **Agentes de los departamentos:** buscar y aplicar presets y crear lotes. Los pedidos grandes esperan tu OK en Aprobaciones.
- **Video:** los 53 presets y su traductor, con el escenario 3D en movimiento. Su pantalla viene en la próxima entrega.
- **Rendimiento:** el banco, los lotes y el escenario 3D se cargan al abrir el Estudio (`dist/estudio-extra.js`, 201 KB); la página queda en 2.075 KB, dentro de su presupuesto.
- **Cómo se hizo:** unos 50 agentes en fases (F0 → F3, y F5 adelantada), con revisión adversarial y remate en cada una, más ayudantes en paralelo.
  - Al integrar se arreglaron 2 cosas: la página arrastraba lo diferido, y una receta de fila de pago salía «gratis».
  - Tests 694/694 y `npm run check` 85/85.
  - Recorridos en el navegador: banco 19/19, lotes 14/14, carga 44/44, Dimitri con lote y agentes, todos en verde.
- **Sin probar con keys reales:** las ediciones con Google, Meta u OpenAI de verdad, ni el costo real frente al estimado.

## V4.11 — 1 oct 2026 (auditoría despiadada del diseño, y lo urgente corregido)

- **La auditoría:** `docs/auditoria-diseno-2026-10-01.md`. 126 hallazgos (6 críticos, 41 altos, 54 medios, 25 bajos) de seis auditores: contenido, previsualizaciones, Dimitri, Estudio y voces, accesibilidad (axe-core en todas las vistas) e infraestructura. Se comparó con Metricool, Meta Business Suite, Later, Buffer y ElevenLabs. **Arreglados:** los 6 críticos, 38 de 41 altos, y lo barato de medios y bajos. Cada punto dice su estado.
- **Calendario de contenido:**
  - Cada tarjeta lleva miniatura, hora, formato (post, carrusel, reel, historia), IG/FB y estado, en mes, semana, día y agenda.
  - La **Programación** es una cola por día con su propia carga, sin depender del mes que se ve.
  - El panel de la pieza va en dos columnas, con días rápidos y «Siguiente hueco libre».
  - Aprobar exige una hora futura.
  - **Las reglas de proporción y duración se aplican por fin**: antes una historia 16:9 decía «cumple».
- **Previsualizaciones fieles por red y formato.** Pestañas: Instagram Feed, Perfil (la cuadrícula), Reel e Historia, y Facebook Feed y Reel.
  - El teléfono va a 9:16 con las zonas que tapa la interfaz y el «… más» real.
  - El carrusel y las historias se pasan deslizando.
  - Avisos de recorte y de texto tapado.
- **Dimitri:**
  - Pregunta en **opción múltiple** cuando conviene: botones, elección múltiple y «Otra…».
  - Ve toda la oficina: Contenido de los próximos días, rutinas, Analíticas y lo que tienes seleccionado.
  - Propone cambios del calendario y de las rutinas con un clic y Deshacer; nada se hace sin tu clic.
  - Prompt reordenado por secciones y un chat que ya no se redibuja entero cada 3 s.
  - Si la hora que dijiste ya pasó, te pregunta.
- **Clonar tu voz como asistente de tres pasos** (graba o sube · escúchalo · ponle nombre y clona):
  - un guion para leer en voz alta mientras grabas;
  - un medidor en dBFS que avisa «muy bajo» o «satura»;
  - el id de la voz se genera solo;
  - el precio y la cuenta verificada se dicen una vez y claro;
  - la casilla de consentimiento es obligatoria y queda guardada;
  - al terminar, «Probar esta voz»;
  - MiniMax limpia el ruido y normaliza el volumen.
- **Accesibilidad e interfaz:**
  - Dimitri tiene botón en el dock, y cada icono dice su nombre con el teclado.
  - Lo deshabilitado ya no se atenúa con opacidad: pasa a 4,5:1.
  - Las tarjetas de departamento ya no se tapan.
  - Las vistas son regiones accesibles.
  - axe-core: 0 fallos críticos o serios en las vistas revisadas.
- **Rendimiento:**
  - La galería vive en memoria: `/api/media` ya no lee el disco dos veces.
  - El sondeo de tareas pesa poco y el Cerebro se lee una vez.
  - Los turnos sin herramientas (Dimitri, el enrutador) no arrancan los MCP de la máquina: `--strict-mcp-config`, probado con la CLI real.
  - Nada repinta con la pestaña oculta.
  - Nuevo punto en el semáforo: «Respuesta del servidor».
  - `npm run check` falla si la página pasa de 2,2 MB.
  - El paso intermitente «Limpiar listas» quedó estable.
- **Pendiente:**
  - galería de más de 600 archivos sin paginar (INF-03);
  - streaming y botón Detener en Dimitri (DIM-14);
  - el resumen instantáneo de «¿Cómo vamos?» (DIM-10);
  - la lista completa, con su motivo, en el informe.

## V4.10 — 1 oct 2026 (MiniMax: imagen, video, voz, música y voces propias)

- **Un motor nuevo, MiniMax, con una sola key** (`MINIMAX_API_KEY`; opcionales `MINIMAX_GROUP_ID` y `MINIMAX_API_BASE`).
  - Antes de escribir código se comprobó todo contra la documentación oficial, con la URL de cada dato: `docs/minimax/api-verificada.md`. Donde la propuesta del dueño difería, mandó la documentación: precios, cancelar un video en cola, `music-3.0-free`, las emociones de la voz y el `file_id` int64.
  - Cliente: `minimax.mjs`.
- **Modelos:**
  - Imagen: `mmx-image-01`, US$0,0035.
  - Video: `mmx-h3` y `mmx-h3-max`. Hay fotogramas o referencias; el trabajo retoma tras un reinicio con su `task_id`, y cancelar en cola no se cobra.
  - Voz: `mmx-voz-2.8-hd/turbo` y `2.6-hd/turbo`, hasta 9.999 caracteres, con voz, emoción, velocidad, volumen, tono e idioma.
  - Música: `mmx-musica-3` y `mmx-musica-3-gratis`, con letra o instrumental y estilo.
  - Los precios no confirmados en la página oficial van rotulados «aproximado».
- **El Estudio ahora crea cuatro cosas:** Imagen, Video, **Voz** y **Música**.
  - Voz: el texto que se lee, con su contador, y un selector de voz con las del sistema y las tuyas.
  - Música: letra con [Verse] [Chorus]…, o una descripción si es instrumental.
  - La galería suma los filtros Voz y Música.
  - En el visor, «Repetir con otra voz».
  - Topes: un video pesa 5, una canción 3 y una voz 1.
- **Panel «Voces»:**
  - **Diseñar** una voz desde una descripción, con una muestra para escuchar.
  - **Clonar** una voz: **grabarla con el micrófono** o **subir un fragmento**. La oficina usa todo lo que MiniMax admite (de 10 s a 5 min y 20 MB), y lo dice: «cuanto más, mejor».
    - Grabación: un reloj «0:32 de 5:00», un medidor de nivel, y se para sola a los 5:00.
    - Grabaciones y fragmentos quedan en la galería, en «Grabaciones de voz», y se clonan desde ahí.
    - Lo que MiniMax no aceptaría (WebM del navegador, otro formato, más de 20 MB o más de 5 min) se convierte en el navegador a WAV 24 kHz mono con los primeros 5:00. Un MP3, WAV o M4A que cabe va tal cual.
    - Menos de 10 s se rechaza sin subir nada.
  - Listar, copiar el id, usar y borrar; borrar también la quita en MiniMax.
  - Cada voz queda «fijada» para que MiniMax no la borre a los 7 días.
  - Registro: `data/minimax-voices.json`, que no viaja.
- **Agentes:** `generar_voz` y `generar_musica` en el Estudio de los agentes, solo cuando hay modelos encendidos; en los entregables, el audio va como `[🔊 archivo](/media/…)`. **Dimitri** también puede proponer creativos de voz y de música.
- **Pruebas:**
  - Tests contra un MiniMax simulado (`tests/minimax-stand.mjs`): `minimax.test.mjs`, `minimax-voces.test.mjs` y `studio-voz.test.mjs`; 301 tests en total.
  - En el navegador: `scripts/estudio-voz-capturas.mjs` (216/216, con y sin key, claro y oscuro, a 1512, 1024 y 390 px) y `scripts/voz-clonar-recorrido.mjs`. Este último graba con un micrófono simulado, clona, recorta 7 min a 5:00, rechaza 5 s, y comprueba que cerrar el panel mientras graba no guarda nada.
  - Prueba de humo con una key real: `node scripts/check-minimax.mjs` (salida en `data/salida-minimax/`).
- **Sin probar con una key real:** nada de MiniMax. La música de pago solo funciona para cuentas que ya pagaban antes del 20 de agosto de 2026; la gratis, para todas. Clonar exige una cuenta verificada (error 2038).

## V4.9 — 30 sep 2026 (Dimitri maneja el Estudio)

- **Dimitri hace creativos.** Un modo nuevo, «estudio», se activa cuando le pides imágenes, video, un reel, un post o editar una foto.
  - **Qué hace:** lee la voz de la marca, las cifras, la oferta, los clientes y los creativos que ya aprobaste. Elige modelos del catálogo real (solo los encendidos, respetando referencias, fotogramas y lo que cada modelo necesita) y dice en una línea por qué. Escribe los prompts de producción en inglés con su traducción.
  - **Qué te muestra:** un **plan de creativos** editable (prompt, cantidad, formato, carpeta, modelo) con el costo y si cabe en tus topes.
  - **Nada se genera hasta que pulsas GENERAR** (`POST /api/sub/studio`, la única ruta que gasta por Dimitri). Todo pasa por los topes del Estudio y queda en costos.
  - **Además ordena:** crea y renombra carpetas, mueve archivos y deja ideas en Contenido (nunca aprobadas). Cuando terminan, te avisa en su chat con las miniaturas.
  - `estudio-plan.mjs` valida todo contra el catálogo y la galería.
- **Imágenes en el chat de Dimitri.** 📎, arrastrar o pegar, hasta 4 imágenes.
  - El original se sube a la galería, en la carpeta «Referencias de Dimitri» o en la que tengas abierta en el Estudio.
  - **Dimitri las ve con la visión de Claude:** bloques de imagen por la CLI (`--input-format stream-json`, `vision.mjs`) o por el SDK.
  - Lo que diga una imagen son datos, no órdenes. Si trae órdenes escondidas, el mensaje se marca 🛡 y ese plan pierde sus acciones.
- **Dimitri en todas partes.** Es un panel fijo a la izquierda: el Estudio, el calendario, Contenido, Analíticas y el Cerebro se corren a su lado en vez de quedar tapados.
  - La tecla **S** funciona dentro de cada vista.
  - Un chip «Viendo: …» le dice lo que tienes seleccionado: la imagen del visor, la nota, la pieza o el día.
  - A menos de 900 px el panel ocupa toda la pantalla.
- **El visor del Estudio ya no corta las fotos grandes.**
  - Una vertical 9:16 se veía al 43 % a 1512 y 1366 px; ahora caben las 24 combinaciones medidas (4K, 9:16 y 21:9 a 1512, 1366, 1024 y 390 px, claro y oscuro; `scripts/estudio-capturas.mjs`).
  - Nuevo: zoom con rueda, pellizco y arrastre, Ajustar / 100 %, `+ − 0`, y **F** para pantalla completa (`src/viewer-zoom.js`).
- **Editar una imagen.** «Editar» en la tarjeta y en el visor: escribes qué cambiar y sale una **versión nueva** junto a la original, en la misma carpeta y enlazada como «versión de». La original nunca se toca.
  - Modelos de edición: Nano Banana 2, Pro y 2.5, Muse Image, GPT Image, Qwen Image 3, Grok Imagine 2, Flux Kontext y Seedream 4.
  - Sin ninguno encendido, te dice qué key activar.
  - Ruta: `POST /api/media/edit`.
- **Cerebro ⇄ Estudio ⇄ oficina.**
  - Cada creativo de Dimitri o de un agente deja una nota en `<cerebro>/Agents Office/estudio/` con el prompt, el modelo, la carpeta, el propósito y las notas leídas. No viaja por GitHub.
  - Usarlo (⭐, como referencia, en una pieza o en el calendario) enseña a la memoria. Tirar todo un pedido sin usarlo la corrige, y recuperarlo de la papelera lo deshace.
  - Desde una imagen: **«Pedírselo a Dimitri»** y **«Mandar a un departamento…»** (una tarea con esa imagen como referencia, `POST /api/media/to-dept`).
  - Los agentes ven las carpetas del Estudio, y `buscar_en_galeria` busca por carpeta.
- **Calendario y Contenido caben en su vista**, no en la ventana: sus cabeceras usan `@container` (`src/css/vistas-ancho.css`). Antes, a 1072 y 1200 px el mes salía cortado; con Dimitri al lado se montaban los botones.
- **Cómo se hizo:** cuatro equipos de agentes en paralelo (worktrees), cada uno con revisión adversarial y corrección.
  - Tests nuevos: `estudio-plan`, `sub-estudio`, `vision`, `sub-studio`, `media-edit`, `media-dimitri`, `estudio-memoria` y `viewer-zoom` (267 en total).
  - `npm run check`: 81/81.
  - Recorrido en el navegador: `scripts/dimitri-recorrido.mjs`.
- **Sin probar con keys reales:** la edición con Google, Meta y OpenAI de verdad, y el costo real frente al estimado. La visión por la CLI sí se probó con una imagen real.

## V4.8 — 30 sep 2026 (Meta en el Estudio)

- **Muse Image (Meta)** como motor del Estudio: `muse-image-1.0` en `api.meta.ai/v1`, con `META_API_KEY` o `MODEL_API_KEY`. Sin referencias genera (`/images/generations`); con hasta 10 referencias edita y compone (`/images/edits`, cuerpo JSON de Meta con `images: [{ image_url }]`). Formato (proporción), calidad (`reasoning_strength`: alta o baja) y archivo (webp, png, jpeg). Busca referencias reales por su cuenta, incluido en el precio: US$0,01 por imagen, registrado en costos.
- **Entender video y audio con Muse Spark**: `understand.mjs`, la ruta `POST /api/media/understand` y dos herramientas para los agentes, `analizar_video` (mp4 de la galería o una URL https; también lee lo que se dice) y `transcribir_audio` (mp3/wav). `muse-spark-1.3` para video y `muse-spark-1.2` para audio. Solo aparecen con la key de Meta. El texto le llega al agente marcado como material, no como órdenes. Cada consulta se registra en costos como «entendimiento». No genera video: eso sigue con Veo, Kling y Seedance.
- La galería del Estudio acepta **mp3 y wav** (tarjeta ♪ con reproductor); un audio nunca se usa como referencia ni como fotograma.
- Pruebas nuevas: `tests/meta.test.mjs` y `tests/understand.test.mjs`, contra un Meta simulado. Todavía sin probar con una key real.

## 3.2.1-beta.2 — 19 Sep 2026

- **Licence.** LICENSE now opens with the Required Notices (Copyright 2026 Sahni.ai; Agents Office is a Sahni.ai product) and Sahni.ai's additional terms: the name and mark stay, no renaming or rebranding, no wiring it into or bundling it with another product, agent system or workforce, and anything else needs written permission. The PolyForm Noncommercial 1.0.0 text below them is unchanged. README says the same in plain English. No change to the office itself.

## 3.2.1-beta.1 — 16 Sep 2026

- **The calendar (P).** Month and week. Finished tasks on the day they finished, today's work on today, tasks scheduled for a date, and every routine projected forward on the days it will fire, one dashed card per run. A rail lists the routines themselves (cadence, agent, next run, paused, waits for your OK); click one to see only its days. Department filters, routines and done toggles, search. Click a card: a finished task opens the agent's chat; a routine run offers RUN NOW / PAUSE / DELETE; a scheduled task can be cancelled.
- **Schedule from a day.** Click any day: what should happen, department, time, model, ADD. Claude names the agent now; the server runs it at that minute, page open or not, LATE (once) if the office was off; it waits for your OK if it would send anything. REPEAT makes it a routine that starts on that date (`when.start`, e.g. `every weekday · 08:00 · from 5 Oct`) — on the grid from that day, never before.
- A **CALENDAR** button in the top bar, beside the approval counter, opens it too.
- **Sahni.ai branding.** The `sahni.ai_` wordmark (Kode Mono, embedded) as a small tile at the bottom-left of the office (out of the top bar; with a department in focus it sits at the top-left of the scene), linking to sahni.ai, and a licence line at the bottom of every view: © 2026 Sahni.ai · PolyForm Noncommercial 1.0.0 · free for personal and internal use · not for resale. Hidden in the website hero embed.
- Scheduled tasks show under the SCHEDULED chip and in the SCHEDULED column with CANCEL. `POST /api/tasks` takes `at`; `routines.json` takes `when.start`. Five more checks, one live (a task scheduled 75 s ahead fires and lands; a routine from a date waits for it).


## 3.2.0-beta.3 — 16 Sep 2026

- beta.2 shipped without `teams.mjs` (the release whitelist had not been told about it) and would not start; beta.3 is the same release with the file in, and the release script now refuses to assemble a build whose `serve.mjs` imports a file it is not shipping.

## 3.2.0-beta.2 — 16 Sep 2026

*Numbering: AJ's call, 16 Sep. This is a new release (Agent Teams + Claude in Chrome), not a patch of the 7 Sep 3.2.0-beta.1 (skills); the tag had to be free, and the 3.3–3.6.1 tags stay where they are.*

- **Agent Teams.** Press TEAM in the bar, or say "as a team" / "spawn three teammates to …", and the department lead takes the task, splits it into two to four independent pieces on the desks whose jobs or skills fit, the pieces run at the same time (one Claude process per desk, own context, brief, skills, lessons and connectors), teammates leave notes for each other and the lead (`@lead: …`, shown as 💬 over the desks), and the lead writes the finished deliverable from the pieces, ending with who did what. Piece cards (↳) sit on the teammates' desks, all IN PROGRESS together; each finished piece lands in that teammate's chat and walks back to the lead. The note in the brain carries the final, every piece, and the notes. `revise: …` reworks the final from the same pieces; APPROVE runs the lead's outbound step alone. `"team": true` on a routine. `teams.max` (default 4) and `teams.enabled` in the config. Built by the office from separate headless Claude sessions, because Claude Code's own agent teams only spawn in an interactive terminal.
- **Claude in Chrome.** Every run starts with `--chrome`; with the extension paired (`claude --chrome` once) the agents get the owner's own browser as a tool — open tabs, read pages, search, fill forms on any site the owner is signed in to. A Chrome tile in the bar, wired to every pod, lit when an agent is in the browser; grey with the fix on hover when the extension is not paired. Same rule as every connector: read freely, act on a site only when the task asks for that exact action; a login or CAPTCHA stops the agent. `tools.browser: false` (or `deny: ["Chrome"]`) keeps them out.
- Seven more checks (team intent, plan checking, notes, team routines, the browser flags and prompt, config defaults, the Chrome tile in `/api/mcp`), and two live ones: a real team task with two or more desks, and an agent reading a page in Chrome.


## 3.6.1-beta.1 — 9 Sep 2026

- **A bigger task box.** The bar is two rows now: the department and the text on top, the model menu, REPEAT and ADD underneath, so the text runs the width of the panel. The box grows as you type, up to six lines, then scrolls. Enter adds; Shift+Enter is a new line.
- **Effort, by name.** An EFFORT menu beside the model: AUTO, Low, Medium, High, Extra high, Max, the levels Claude Code uses. AUTO is the model's own (Opus runs at high). Set it on the task, the routine, the agent (`effort` in the roster) or the office (`effort` in the config), same precedence as the model; every card shows it beside the model name and the note records `effort:`.
- **The big editor.** The ⤢ button inside the box (or ⌘⇧E) opens the same task in a large window with room for a whole brief. It shows the department and the same hint line, ⌘↵ adds, Esc closes, and whatever you type there is in the bar when you close it.

## 3.6.0-beta.1 — 9 Sep 2026

- **Three models, by name.** Sonnet, Opus, Fable. Sonnet is the default for everything, including the routing call. A menu beside REPEAT sets the model for the task you are typing or the routine you are setting; agents take a `model` in the roster; the office default is `model` in the config. The task beats the routine beats the agent beats the office, and every card says which ran and where it was set. Opus runs at effort high; nobody sees an effort setting. Until now every run inherited the login's default model.
- **The usage gauge.** The top bar shows your Claude plan the way Claude Code's usage screen does: session and week, bar and percentage, reset times on hover, amber past 75 and red past 90. Read with the login token Claude Code keeps on this machine, sent only to Anthropic's usage endpoint, never stored. When that endpoint does not answer, the office's own count for the current five-hour window shows instead. No dollars anywhere. A live office shows Claude alone in RUNS HEADLESS ON.
- Three checks: the model table and precedence, the gauge parser and window count, and (live) a task set to Opus running on Opus.

## 3.5.0-beta.1 — 9 Sep 2026

- **Routines: the office runs on its own clock.** A task the office does by itself on a timetable — every weekday at 08:00, every Monday, every hour. Emails, Accounting and Sales in this release; the other departments say "later release" if you try.
- **Three ways to set one.** Type it in the bar with the time in the sentence ("every weekday at 8am, triage the inbox…") and the hint reads the schedule back before you press Add, or press REPEAT and pick a cadence and a time; tell a department lead in chat ("routines", "pause …", "run … now", "delete …" work too); or ask Claude Code, which writes `<brain>/Agents Office/routines.json` (`CLAUDE.md` says how).
- **Where they show.** A SCHEDULED chip in the Task Status panel with a countdown and RUN NOW / PAUSE / DELETE on every routine, a next-up line under the chips, a SCHEDULED column on the company board, a clock chip on the agent's name pill and a routines strip at the top of their chat.
- **The clock lives in the server.** `npm start` fires routines and runs them whether or not the page is open; the page polls and shows the card move. A run missed while the machine slept is caught up once when it comes back, marked LATE.
- **"Needs my OK" is real.** A routine that would send, pay or change anything prepares everything and waits in WAITING ON APPROVAL — the draft in the chat, the agent standing and waving. APPROVE and the agent does the outbound step with its tools; REJECT, say what should change, and it comes back reworked (and the correction is remembered). Read-only routines go straight to DONE. Per-routine switch.
- A live office no longer invents approvals: the theatre asks that used to make a random agent stand and wave are demo-only now, so WAITING ON APPROVAL means a real draft. Real work never waits behind theatre either: a task or routine of yours starts the moment it lands, and the demo job that desk was on is finished.
- Quieter at rest. A live office shows only real reads and writes on the Brain (no theatre glints, no six-second pulse), and the connector loom in the overview runs at about half the ink and half the crawl. Inside a department nothing changed.
- Seven more connector logos: Slack, Google Calendar, Google Drive, Webflow, Playwright, Higgsfield, TerriTool. Anything else still gets an initials tile.
- Routine notes carry `routine:` (and `approved:`) in their front matter. `npm run check` gains six checks: the schedule parser, refusals, the clock and catch-up, the demo bar flow, the API, and (live) a two-minute routine firing end to end.

## 3.4.0-beta.1 — 7 Sep 2026

- Every department now has a lead. Marketing Lead and Operations Lead join at the head of their pods (35 agents). Each runs their team, owns the department's set-up interview, and is where a task lands when Claude cannot pick a specialist.

## 3.3.0-beta.2 — 7 Sep 2026

- The built office page moved from the repo root to `dist/command-centre-v2.html`. Same file, same double-click demo, cleaner repo page. `build.mjs`, `npm start` and the checks all point there.

## 3.3.0-beta.1 — 7 Sep 2026

- **The lead interviews you.** Say "set up" to a department lead. Five questions, one at a time; then it writes a brief for each agent on its team and a skill for the job you described, into your brain, and tells you what it wrote and one task to try. "skip", "done", "cancel". A lead whose department has nothing of yours yet offers this in its greeting.
- **They learn from your corrections.** Every `revise: …` is recorded in `<brain>/Agents Office/feedback/<agent>.md`; Claude sorts it into a one-off or a standing rule, and standing rules go into that agent's prompt from then on. Plain Markdown, yours to edit. `/api/lessons` shows them.
- Roster, skills and lessons are re-read before every task and chat, so a brief no longer needs a restart.
- `/api/health` carries which departments are set up; the boot line says so too.

## 3.2.0-beta.1 — 7 Sep 2026

- **Skills: teach an agent how a kind of work is done.** A folder in your brain, `<brain>/Agents Office/skills/<name>/`, with a `SKILL.md` (when it applies, the steps, the shape, the rules) and the template or example beside it, bound to agents or departments in its front matter. Read in full before every task and chat turn for those agents; the deliverable names the skill it followed and the saved note records it. Re-read from disk on every task, so no restart. Three examples ship in `skills/`. Guide: `SKILLS.md`.
- **Briefs.** A `brief` field on any agent in the roster: standing instructions, up to 2,000 characters, read before every task and chat turn.
- **The roster can live in the brain.** `<brain>/Agents Office/agents.json` is read between the shipped roster and the local file.
- The router sees each agent's skills, so a task that names a kind of work lands on the agent who owns that skill.
- `CLAUDE.md` tells Claude Code how to turn an SOP, a template or a good example into a skill and where to write it. `npm run check` validates skills; `/api/skills` lists what is loaded.
- The shipped roster no longer names anyone: "the owner" throughout.

## 3.1.0-beta.3 — 7 Sep 2026

- One HTML file. The separate dark build is gone; `D` and http://localhost:4520/dark open the same file in dark mode.

## 3.1.0-beta.2 — 7 Sep 2026

- The Brain graph header names your business (it was hard-coded to one company).

## 3.1.0-beta.1 — 7 Sep 2026

- **Connectors are real.** The top bar shows the MCP servers your Claude Code is connected to (`claude mcp list`), not a demo list. Servers that need authentication show grey with the reason on hover and are not wired to any pod. Unknown servers get an initials tile. Nothing connected? The bar says so.
- **Agents use tools.** While they work, agents can call those same connected servers, plus web search (`tools.web`). Bash, file tools and sub-agents stay off. Standing rule: read freely; send, post, pay, delete or change data outside the machine only when the task explicitly asks for that exact action. A deliverable says which tools it used, the note records them, and the logos pulse with the real call.
- **The roster is yours.** `office.agents.json` holds the 33 agents: name, role, what they do, their tools. Override in `office.agents.local.json` (ignored by git). Departments, leads and seats stay fixed. A `CLAUDE.md` in the repo means you can open Claude Code in the folder and say what you want changed.
- `office.config.json` grew `mcp.allow` / `mcp.deny` / `mcp.departments` and `tools.web`; `timeout` (seconds) for long tool runs.
- Live chat now opens with the agent's real job description instead of the demo greeting and sample file.
- `npm run check` validates the roster and the connector endpoint.

## 3.0.0-beta.4 — 6 Sep 2026

- Dark mode: press D, add `#dark=1`, open `command-centre-v2-dark.html`, or visit http://localhost:4520/dark. The scene relights, pods and walkways re-tint, the Brain and wires swap ink.

## 3.0.0-beta.3 — 6 Sep 2026

- No more "demo" label: the panel shows LIVE · CLAUDE when the server is connected and nothing otherwise.

## 3.0.0-beta.2 — 6 Sep 2026

- The Brain strip is gone from the task panel. Open the Brain with G, by clicking the pod, or by its tag.

## 3.0.0-beta.1 — 6 Sep 2026

Agents Office v3 (Beta): the V3 office as a real, installable app.

- Six departments, 33 agents, each with a role, a voice and a task pool.
- Task Status panel with a command bar: type a task, pick the department, the office routes it to the right agent through Claude and the agent produces the deliverable, saved as a note in your brain folder.
- The Brain is your own folder of Markdown notes with `[[wiki links]]`, drawn as a graph over the centre pod, rebuilt live as agents write. `G` opens the full graph with search and a note preview.
- Chat with any agent: real conversation in that agent's persona, grounded in your notes. `revise: …` reworks the last deliverable.
- Runs on your existing Claude Code login, or on an API key if you set one. Nothing leaves your machine except the calls to Claude.
- `npm run check` — the build loop: build, offline smoke, server smoke; `npm run check:live` adds one real task and one chat turn.


## 0.1.0 — 7 Aug 2026

First public release: daemon-based office with inboxes, approvals and an outbox.
