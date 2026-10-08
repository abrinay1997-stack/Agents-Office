# Las tareas del dueño (plan D)

**7 oct 2026.** Pedido del dueño: «La oficina está pensada para que trabajen los agentes, pero no contempla que yo tenga tareas para mí mismo. Quiero tener mis tareas, delegarlas o trabajarlas yo, en una plataforma con un diseño y una organización como TaskView. Que el equipo de agentes entienda que esto es del jefe, que yo pueda pasarles tareas o tomar las suyas, y que todo conviva con lo que ya tenemos».

Base: el plan T0–T6 (`docs/analisis-taskview-2026-10-06.md`) ya trajo de TaskView el orden de la vista Tareas, el modelo de tarea completo, la bitácora y las vistas. **Faltaba el dueño como alguien que también trabaja.** Hasta hoy «Tú» solo existía como la persona a la que un agente le pasaba algo («Para ti: …», «PASAR A UNA PERSONA»), y toda tarea nueva pasaba por el enrutador y caía en un escritorio.

**La licencia sigue mandando:** TaskView prohíbe productos competidores. Igual que en T0–T6, de TaskView solo se toman **ideas de organización y de pantalla** (su Inicio con Hoy y Próximo, la Bandeja, la casilla redonda, «COMPLETADAS · N», el tablero por estado, la lista que se elige a la izquierda). Ni una línea de su código, ni sus textos, ni su nombre en la interfaz.

---

## 1. Lo que hay ahora, en una página

- **Una pestaña nueva, «Mías»,** la primera de Tareas (H). A la izquierda tus listas, cada una con su número: **Bandeja** (sin fecha ni proyecto), **Hoy** (vence hoy, lo vencido y lo que estás haciendo), **Próximos 7 días**, **Todas las mías** (agrupadas por fecha), **Delegadas** (lo que pasaste a otro, hasta que vuelve) y **Hechas** (30 días); debajo, tus proyectos. En el teléfono, una fila de pastillas.
- **La lista** tiene la cabecera con «hechas/total» y su barra, cada fila con **la casilla redonda** que la marca hecha (y DESHACER), el campo punteado **«+ Añadir tarea»** que ya trae la fecha o el proyecto de esa lista, y al final **COMPLETADAS · N** plegable. **Tablero** la enseña en tres columnas: **Por hacer · Haciendo · Hecha**, arrastrando.
- **El campo de arriba** tiene «**Para mí**» en el selector (en Mías viene elegido): lo que escribes es tuyo, sin enrutador ni agente. Entiende lo de siempre: «urgente: firmar el contrato para el viernes #local».
- **El detalle de una tarea tuya:** ✓ Hecha · ▶ Empezar (con tu cronómetro) o ⏸ Dejar para luego · **Delegar…** · «Devolver a PIPER» si vino de un agente. Campos: prioridad, fecha límite (con hora), **área** (el departamento, opcional), proyecto, etiquetas, estimación, repetir, tu tiempo, pasos (subtareas), notas, espera a / la esperan, comentarios, historial.
- **Delegar** a un agente (el que elijas, el que la tenía, o «el que elija la oficina»: el enrutador, o el jefe si no responde) o a una persona del equipo, con una nota. «Que me pida el OK antes de enviar o publicar nada» viene marcado. La sigues en **Delegadas** hasta que vuelve hecha (8 oct 2026: si el agente no pudo hacerla, sigue ahí, arriba y con «Falló», en vez de pasar a «VOLVIERON HECHAS»).
- **«Lo hago yo»** en el detalle de la tarea de un agente (en cola, programada, idea o fallida) y **«Lo termino yo»** en un borrador que espera tu OK: pasa a tu lista con lo que el agente dejó. En el Tablero de la oficina, arrastrarla a la columna **«Tuyas y de personas»** hace lo mismo. Todo con DESHACER.
- **Inicio** abre con **«Lo tuyo hoy»**; «Hoy en la oficina» queda para los agentes. La **Lista** tiene el filtro **Quién** (Tuyas · De los agentes · De personas).
- **Los agentes lo entienden:** en `ver_tareas` y `ver_agenda` lo tuyo sale como **«DEL DUEÑO (la hace él)»**; su instrucción dice que no lo ejecuten ni lo cambien y que, si su trabajo depende de algo tuyo, pidan un bloqueo con su id. Una herramienta nueva, **`sugerir_al_dueno`**, les deja una sugerencia en tu **Bandeja** (nace idea: la aceptas o la descartas; cinco sin responder como mucho). Un «Para ti: …» de `pedir_bloqueo` nace tuyo y para hoy. Lo que delegas les llega con «TE LA DELEGÓ EL DUEÑO» y tu nota.
- **Dimitri** ve «Las tareas del dueño» en su `<estado>` (vencidas, hoy, haciendo, bandeja, sugerencias, lo que delegaste y sigue abierto). En un plan, una pieza puede ir a **«Tú (tu lista)»** (`"dept":"dueno"`): lo que solo puedes hacer en persona. Con Tareas abierta sugiere «¿Qué tengo yo hoy?», «¿Qué puedo delegar?», «¿Cómo va lo delegado?».
- **El calendario (P)** tiene la capa **TUYAS** (encendida): tus tareas en el día que vencen («☐»); un clic la abre en Mías. El `.ics` las lleva como pendientes tuyos. (8 oct 2026: la capa se vuelve a leer al abrir el calendario y cada 30 s; antes, lo que añadías en Mías no aparecía hasta cambiar de semana.)
- **Telegram:** `/mias` (o `/hoy`) trae lo tuyo de hoy con un ✅ para marcarlo hecho; `/yo llamar al banco el viernes a las 10` te deja una tarea.

---

## 2. Decisiones

1. **Una tarea del dueño es una tarea normal con `person: 'Tú'`.** Es la marca que ya usaba la oficina (la cola no la arranca, la mezcla la respeta, las rutas la conocen), así que nada de lo de antes tuvo que cambiar de forma: la bitácora, las dependencias, los proyectos, repetir, los avisos de fecha límite, el cronómetro y los webhooks funcionan igual con las tuyas.
2. **Sin escritorio.** Una tarea tuya no tiene `agent` (y el departamento es opcional: el «área»). Al **tomar** la de un agente, deja de ser de su escritorio (`agent` se quita, `deAgente` recuerda de quién era): así no cuenta en la calidad ni en la carga de ese agente, y «Devolver a …» sabe a quién. Los «Para ti» que crea un bloqueo nacen igual. La única excepción es «PASAR A UNA PERSONA» (el agente se rinde a mitad de una ejecución): conserva su escritorio como antes y suma `deAgente`.
3. **«Haciendo» no es un estado nuevo:** es `empezada` (la hora en que empezaste). `doing` sigue siendo solo «un agente la está ejecutando»: la cola cuenta procesos con él y no podía confundirse.
4. **El estado visible «Tuya»** (`tareas/estados.mjs → visible`), distinto de «En manos de una persona». Bloqueada gana.
5. **Estados:** solo una transición nueva, `waiting → next` por el dueño («Lo termino yo»). Todo lo demás ya existía (`next → done`, `done → next`, `idea → next`).
6. **Un agente nunca toma, delega, empieza ni marca hecha una tarea tuya:** solo la **sugiere**. Dimitri tampoco delega: propone una pieza para ti y tú pulsas ENVIAR.
7. **«Para cuándo», no «cuándo arranca».** Lo tuyo no lo arranca un reloj: «el lunes a las 9» en una tarea tuya es su fecha límite con hora (`limite: 'AAAA-MM-DDT09:00'`), no un `dueAt`. Al tomar una programada, su hora pasa a ser tu fecha límite (y DESHACER se la devuelve).
8. **DESHACER de verdad:** deshacer «Lo hago yo» la devuelve a su escritorio como estaba (con su hora si era programada); deshacer «Delegar» la vuelve a tu lista sin marcas.
9. **Lo que pide el OK sigue pidiéndolo:** al delegar, un importe por encima del tope del dueño (`approvals.amountLimit`) espera el OK siempre, marques lo que marques.

---

## 3. Dónde vive cada cosa

| Pieza | Archivo |
|---|---|
| Lo puro: listas, cuentas, grupos por fecha, tablero personal, qué se puede tomar o delegar, el resumen para Dimitri | `tareas/dueno.mjs` |
| Las rutas: `POST/GET /api/tareas/mias`, `POST /api/tareas/<id>/tomar`, `/delegar`, `/empezar`, `POST /api/tareas/sugerir` (van **antes** que `tareas/rutas.mjs`) | `tareas/rutas-dueno.mjs` |
| Hecha/reabrir de una tuya (para el cronómetro, `hechaPor`), «Para ti» sin escritorio y para hoy | `tareas/rutas.mjs` |
| El estado «Tuya» y `waiting → next` | `tareas/estados.mjs` |
| Los campos nuevos (`deAgente`, `tomada`, `sugeridaPor`, `empezada`, `delegada`, `borradorAgente`) | `tareas/modelo.mjs`, `tareas/cambios.mjs` (bitácora y mezcla) |
| La agenda en palabras («DEL DUEÑO») | `tareas/agenda.mjs` |
| Los agentes: «DEL DUEÑO», `del_dueno` en `ver_tareas`, `sugerir_al_dueno`, la nota de lo delegado | `tareas-mcp.mjs`, `serve.mjs → tareasText` |
| La pestaña Mías (rail, lista, tablero) | `src/tareas/mias.js` |
| La fila (casilla redonda, chips), el detalle en modo dueño, Inicio, Lista (Quién), Tablero (columna «Tuyas y de personas») | `src/tareas/comun.js`, `detalle.js`, `inicio.js`, `lista.js`, `tablero.js`, `vista.js`, `datos.js` (servida y demo), `demo.js` |
| El estilo | `src/css/tareas.css` (va con el paquete de Tareas), `src/css/calendario-mias.css` |
| Dimitri: piezas `dueno`, `<estado>`, sugerencias | `sub.mjs`, `serve.mjs → subSend, dimitriOffice`, `src/sub.js` |
| El calendario: capa TUYAS; el `.ics` | `src/calendar.js`, `src/main.js`, `src/tasks.js`; `serve.mjs → icsFeed` |
| Telegram `/mias`, `/yo`, ✅ | `telegram.mjs` |
| El panel 3D deja de enseñar en un escritorio lo que ya no es de nadie | `src/tasks.js` (poll) |

---

## 4. Cómo se prueba

- `tests/tareas-dueno.test.mjs`: lo puro, las rutas sobre una oficina temporal (crear, empezar, hecha, reabrir, tomar en cada estado, DESHACER, delegar por cada camino, a una persona, el tope de importe), el MCP de verdad por stdio (`sugerir_al_dueno`, el tope de cinco, «DEL DUEÑO», «Para ti»), la vista (Mías, Inicio, Lista, el detalle) y Dimitri (`dueno`).
- `tests/telegram.test.mjs`: `/yo`, `/mias` y el ✅.
- `node scripts/mias-recorrido.mjs` (con `AO_AXE=<axe.min.js>` pasa axe): en el navegador a 1512 (claro y oscuro), 1024 (con Dimitri al lado) y 390 — el rail, añadir en línea, la casilla y DESHACER, Todas por fecha, empezar y delegar desde el detalle, Delegadas, «Lo hago yo», el filtro Quién, el tablero personal, Inicio, la capa TUYAS del calendario y la demo.

---

## 5. Lo que queda (para cuando el dueño lo pida)

- **Recordatorio a una hora** (TaskView avisa a la hora de la tarea): hoy avisa la víspera, el día y al vencer (plan T5).
- **Vista previa de la recurrencia en Mías** como TaskView (ya está en el detalle: «Próximas: …»).
- **Arrastrar en el calendario una tarea tuya a otro día** (hoy se cambia la fecha en su detalle).
- **Probar con agentes de verdad** que lean «DEL DUEÑO», sugieran con mesura y no repitan lo tuyo; ajustar la skill de cada departamento si hace falta.
