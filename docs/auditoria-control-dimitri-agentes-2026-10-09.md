# Revisión: ¿Dimitri, los agentes y cualquier IA saben y pueden controlar el calendario y las tareas? (9 oct 2026)

Pedido del dueño: «necesito revisar que Dimitri y los agentes sepan y puedan controlar el calendario y tareas; imagínate que el día de mañana todo pudiera conectarse vía MCP y todo debería estar muy bien conectado, y Dimitri debería conocer todo el sistema muy bien aunque se use cualquier IA, la de Meta, ChatGPT o Claude. Me gustaría saber que tenemos esto bien cubierto.»

Se revisó el código de Dimitri (`sub.mjs`, sus tarjetas `src/sub-ops.js`, su ejecutor en `serve.mjs`), los servidores MCP de los agentes (`tareas-mcp.mjs`, `contenido-mcp.mjs`, `estudio-mcp.mjs`) y las rutas que usan (`tareas/`, `contenido/rutas.mjs`). Lo que faltaba se hizo en la misma rama (`claude/trusting-noether-akn71m`).

## Resumen

- **Dimitri ve toda la oficina y ahora puede mover casi todo el calendario y las tareas** (rutinas enteras, prioridades, fechas límite, tus tareas, llenar la semana). Siempre con tu clic en HACER y con DESHACER.
- **Los agentes leen todo lo que necesitan** (ahora también las rutinas, lo publicado con cifras y los huecos) y **solo proponen**. No cambian fechas, prioridades ni estados, y no aprueban.
- **Cualquier IA tuya en esta computadora** (Claude Desktop, Claude Code, Cursor…) se conecta con `oficina-mcp.mjs`. Ve lo mismo que Dimitri y hace los mismos cambios, con las mismas reglas.
- **Nadie salvo tú aprueba, envía, publica, paga ni borra.** No es una instrucción en un prompt: esas acciones no existen en la lista y la API las rechaza. Lo prueban los tests.
- **ChatGPT y Meta AI en la web** necesitan un servidor remoto con inicio de sesión. Eso espera al issue #2. Dimitri sí puede pensar con Meta Muse Spark (u otro proveedor compatible), y su respuesta se lee aunque el modelo no sea Claude.

## Quién puede qué

✅ hace · 👁 ve · 💡 propone (tú decides) · — no

| | Dimitri | Agentes | Tu IA (MCP) | Solo tú |
|---|---|---|---|---|
| Ver el estado, las tareas y la agenda, con ids | 👁 | 👁 `ver_tareas`, `ver_agenda` (+`dias`, `dept`) | 👁 `estado_oficina`, `ver_tareas`, `ver_agenda` | |
| Ver tu lista personal | 👁 | 👁 («DEL DUEÑO») | 👁 `ver_mis_tareas` | |
| Ver las rutinas | 👁 | 👁 `ver_rutinas` **(nuevo)** | 👁 | |
| Ver el calendario de un rango | 👁 al lado del calendario **(corregido)** | 👁 la agenda | 👁 `ver_calendario` **(nuevo)** | |
| Ver Contenido | 👁 | 👁 | 👁 `ver_contenido` | |
| Ver lo publicado y sus cifras | 👁 **(nuevo)** | 👁 `ver_resultados` **(nuevo)** | 👁 | |
| Ver los días sin publicación y lo que puede volver | 👁 **(nuevo)** | 👁 `ver_huecos` **(nuevo)** | 👁 | |
| Ver cómo sale lo aprobado (modo, conductor, cuota, fallos) | 👁 **(nuevo)** | — | 👁 | |
| Crear trabajo para un departamento | 💡 ENVIAR A LOS JEFES | 💡 nace idea | ✅ `crear_tarea`, que siempre espera tu OK | |
| Crear una tarea tuya | 💡 | 💡 `sugerir_al_dueno` | ✅ `crear_mi_tarea` | |
| Mover o cancelar una tarea de un agente que no empezó | ✅ con tu clic | — | ✅ `hacer` | |
| Cambiar prioridad o fecha límite | ✅ **(nuevo)** | — | ✅ | |
| Delegar una tarea tuya o marcarla hecha | ✅ **(nuevo)** | — | ✅ | |
| Repetir o reintentar una tarea | ✅ **(nuevo)** | — | ✅ | |
| Rutinas: crear, saltar una vez | ✅ | — | ✅ (siempre espera tu OK) | |
| Rutinas: pausar, reanudar, cambiar, correr ahora | ✅ **(nuevo)** | — | ✅ | |
| Borrador de Contenido; moverlo de día | ✅ | ✅ sus borradores | ✅ | |
| Llenar la semana | ✅ **(nuevo)** | 💡 `ver_huecos` + `crear_borrador` | ✅ | |
| Quitarle el OK a una rutina | — | — | — | ✅ |
| Aprobar, enviar, publicar, pagar, borrar | — | — | — | ✅ |

## Fallos que se encontraron y se arreglaron

1. **Dimitri podía mover o cancelar una tarea tuya como si fuera de un agente.** Mover le ponía una hora de arranque en vez de su fecha límite. Cancelar la borraba de tu lista. Ahora tus tareas se cambian por su fecha límite (`tarea_editar`), se delegan (`mia_delegar`) o se marcan hechas (`mia_hecha`). Las de una persona del equipo tampoco se tocan.
2. **Un agente podía reescribir una pieza que esperaba tu OK** («en revisión»). Ahora solo cambia ideas y borradores.
3. **Borrar una pieza o un texto guardado no comprobaba si lo pedía un agente.** Ahora responde 403.
4. **La tarjeta de una rutina mensual se leía «cada  a las 09:00»**, y tocar un día la volvía semanal. Ahora dice «el último día de cada mes…» y no ofrece días.
5. **Al lado del calendario de tareas, Dimitri veía las piezas de Contenido** en lugar de las tareas y las rutinas. Con Tareas abierta no veía nada concreto. Ahora ve tareas con hora, ejecuciones de rutinas y tus fechas límite. En Tareas ve la tarea, el proyecto o la agenda.
6. **Lo que Dimitri proponía y no se podía hacer se perdía en silencio.** Ahora lo dice al final de su respuesta: «No incluyo 2 cambios que pensé: …».
7. **El atajo «Rellena los huecos» decía dos semanas, pero contaba 7 días.** Ahora es «Llena la semana» y propone el cambio de verdad.
8. **La respuesta de Dimitri se rompía si el modelo escribía algo antes del JSON**, o ponía un ejemplo con llaves. Ahora se busca el objeto que es la respuesta (`sub.pickJSON`). Pasa con cualquier modelo.

Otros arreglos:
- Las piezas que crea Dimitri pueden ir a las nueve redes, no solo a Instagram y Facebook.
- En `<estado>`, lo que está en curso, espera tu OK o falló lleva su id.
- Las fechas límite de los próximos 7 días van a la vista.

## Cómo está hecho (una sola puerta)

- **Una lista cerrada de cambios**, `sub.OPS`. Son 15: `rutina_crear`, `rutina_saltar`, `rutina_pausar`, `rutina_reanudar`, `rutina_editar`, `rutina_ahora`, `tarea_mover`, `tarea_cancelar`, `tarea_editar`, `tarea_repetir`, `mia_delegar`, `mia_hecha`, `pieza_crear`, `pieza_mover` y `contenido_llenar`.
- **Un validador**, `sub.parseOps`. Comprueba cada cambio contra la oficina tal como está y da el motivo de lo que no pasa.
- **Un ejecutor**, `runOp` y `undoOp` en `serve.mjs`. Usa las mismas reglas que las pantallas: `tareas/rutas.mjs` (organizar, estado), `tareas/rutas-dueno.mjs` (delegar, tomar) y `contenido/rutas.mjs` (llenar).
- **Dos entradas:**
  - el botón HACER de Dimitri: tu clic, 30 s para deshacer;
  - `/api/oficina/accion`: tu IA, 10 min para deshacer con su clave.
- **El mapa de la oficina**, `oficina/mapa.mjs`. Va en el prompt de Dimitri y en `como_funciona` del MCP: los dos conocen el sistema por el mismo texto, sea cual sea el modelo.
- **El MCP de la oficina nunca llega a un agente** (`mcp.isOffice`), ni aunque se nombre en Ajustes. Un agente con tus controles saldría de sus reglas.

## Con cualquier IA

| | Hoy | Qué falta |
|---|---|---|
| Dimitri pensando con Claude | ✅ | — |
| Dimitri con Meta Muse Spark (opción 2 del iniciador) u otro proveedor compatible (DeepSeek, Kimi, GLM, OpenRouter) | ✅ el contrato y su lectura no dependen del modelo | Probarlo con la key real de Meta: que elija bien los cambios y respete el JSON |
| GPT (OpenAI) como cerebro de Dimitri | Vía OpenRouter, por verificar | Un cliente propio de OpenAI, si hiciera falta |
| Claude Desktop, Claude Code, Cursor, LM Studio controlando la oficina | ✅ `oficina-mcp.mjs` (guía: `docs/conectar-ia.md`) | Probarlo en la computadora del dueño |
| ChatGPT o Meta AI (web) controlando la oficina | — | Un MCP remoto con inicio de sesión: después del issue #2 |

## Lo que queda (dicho claro)

- **Probar con modelos que no sean Claude.** Con Meta Muse Spark de verdad: que use el modo «plan» con cambios cuando le dices «pausa los cobros», y que no invente ids.
- **Probar `oficina-mcp.mjs` en Windows** con Claude Desktop real.
- **Algunos cambios no se deshacen si el agente ya empezó:**
  - delegar tu tarea;
  - correr una rutina ahora;
  - repetir una tarea.

  Su tarjeta lo dice. Si hace falta, se detiene la tarea.
- **Las claves para deshacer del asistente viven en memoria.** Si la oficina se reinicia, se pierden, y la oficina lo dice.
- **Borrar una rutina sigue siendo solo tuyo,** desde el calendario y con su DESHACER. Dimitri y tu IA la pausan.
- **El MCP remoto** (ChatGPT, Meta AI) espera al issue #2.

## Cómo se comprobó

- `tests/control-oficina.test.mjs` (puro, 8 pruebas):
  - lo tuyo no se toca como si fuera de un agente;
  - las rutinas enteras;
  - lo prohibido no existe;
  - cada cambio tiene tarjeta, línea en el prompt y campos para el asistente;
  - la rutina mensual;
  - el JSON con texto alrededor;
  - lo que Dimitri ve.
- `tests/oficina-servidor.test.mjs` (serve.mjs real y el MCP, 5 pruebas):
  - el ejecutor y su deshacer;
  - Contenido y los agentes;
  - Dimitri dice lo que no pudo proponer;
  - llenar la semana y repetir;
  - `oficina-mcp.mjs` lista, lee y hace, y no tiene herramientas para aprobar, enviar, publicar, pagar ni borrar.
- `tests/mcp-plugins.test.mjs`: el MCP de la oficina nunca llega a un agente.
- `npm run check` en verde y `node scripts/dimitri-recorrido.mjs` («todo bien»).
