# TaskView: qué nos quedamos para llevar las tareas a otro nivel

**6 oct 2026.** Pedido del dueño: «revisa TaskView, mira qué podemos rescatar; me gusta su interfaz limpia y el orden que maneja. Que no queden cabos sueltos: todo conectado, con lógica, bien factorizado».

Repositorio estudiado: [Gimanh/taskview-community](https://github.com/Gimanh/taskview-community), versión 1.55.0, commit `46b3d1e` (22 sep 2026), 1.917 archivos. Lo leyeron cuatro agentes, cada uno con una parte:
- el servidor y la base de datos;
- la interfaz web;
- los paquetes, el plugin para Claude Code y la documentación;
- **nuestra** gestión de tareas de hoy, para comparar.

Nada de su código se ejecutó.

---

## 0. En una página

**Lo que hace bien TaskView no es tener muchas pantallas, sino un orden estricto que se repite en todas:**
- una sola fila de tarea en toda la aplicación;
- un solo estilo de campo en el detalle;
- secciones plegables con contador y barra de progreso;
- «pendientes → añadir → COMPLETADAS · N» en cada lista;
- todo se guarda solo, sin botón Guardar;
- la dirección de la página dice dónde estás.

Por dentro tiene además piezas que nos faltan:
- un **modelo de tarea completo**: proyecto, lista, prioridad, etiquetas, fecha límite, subtareas, dependencias y estimación;
- **historial** de cada cambio;
- **orden por arrastre** que no se rompe;
- **recurrencia de verdad** (RRULE, «al completar», saltar, pausar, vista previa de las 5 próximas fechas);
- un **bus de eventos** del que cuelgan las notificaciones, los webhooks y el tiempo real;
- **permisos por campo**.

**Nuestro problema es distinto al suyo.** TaskView organiza el trabajo de personas. Nosotros organizamos el trabajo de **35 agentes que ejecutan solos**, más el dueño y su equipo. Ellos no tienen nada de esto, y nosotros sí:
- identidades de agente;
- agentes que «toman» una tarea;
- bitácora de lo que hizo el agente;
- aprobaciones;
- costos;
- equipos de agentes;
- Dimitri planificando.

Así que **no copiamos TaskView**. Tomamos su orden y su modelo de datos, y los ponemos al servicio de los agentes.

**El hallazgo más importante, sin embargo, es nuestro.** Hoy una tarea se crea copiando el mismo objeto en **seis sitios distintos** del servidor, que ya se diferencian entre sí. El archivo entero se reescribe en cada cambio, y un comentario o un voto hecho mientras un agente trabaja **se pierde** cuando el agente termina. Los estados están mezclados: «falló», «cancelada», «vencida» y «archivada» son marcas sobre «hecha» o un borrado.

Antes de añadir prioridades o vistas, hay que hacer los cimientos: **un módulo de tareas con un solo modelo, un solo almacén y una bitácora de eventos**. Esa es la fase T0 del plan (§8).

---

## 1. La licencia manda: ideas sí, código no

TaskView usa la «TaskView Source-Available License v1.0» (`LICENSE.md`). **No es software libre.**

**Lo que permite:**
- usarla dentro de la empresa;
- instalarla en un servidor propio;
- modificarla para uso interno.

**Lo que prohíbe:**
- ofrecerla como servicio a terceros;
- **crear o explotar un «producto competidor»**, es decir, cualquier software de gestión de tareas o seguimiento de trabajo ofrecido a terceros;
- distribuir copias derivadas con una licencia más permisiva.

Romper la licencia la anula sola, con 21 días para corregirlo. Su paquete MCP y su SDK están bajo la misma licencia. Para contribuir allí además hay que firmar un CLA.

**Qué significa para nosotros:** nuestro repositorio puede ser público y la oficina es justo un gestor de trabajo. Si pegamos su código, la oficina quedaría atada a esa licencia. Por eso **todo lo de este documento se reescribe desde cero**, con nuestras palabras y nuestro estilo (vanilla JS, archivos JSON, español). Lo que tomamos son ideas, patrones y diseño de pantallas, que no tienen dueño; no tomamos archivos, componentes ni textos. Tampoco usamos su nombre ni su marca.

---

## 2. TaskView en detalle (lo que importa)

### 2.1 El modelo

**La jerarquía:**

| Nivel | Qué es |
|---|---|
| Organización | El espacio de trabajo. Cada usuario tiene una personal. |
| Proyecto («goal») | Tiene color, descripción, unidad de estimación (horas o puntos) y archivo. Cada organización tiene un proyecto **Bandeja** fijo, que no se archiva ni se borra. |
| Lista («component») | Opcional. Una lista virtual «todas» muestra el proyecto entero. |
| Tarea | Ver abajo. Las **subtareas** son tareas con `parent_id`, de un nivel. |

**La tarea:**
- texto y nota en markdown;
- completada sí/no y su fecha;
- prioridad 1–3;
- fecha y hora de inicio y fin (el «fin» es la fecha límite);
- estado, que es la columna del kanban;
- dos órdenes: lista y kanban;
- etiquetas por proyecto;
- varias personas asignadas;
- estimación;
- importe de ingreso o gasto;
- enlace de origen (para tareas importadas de GitHub);
- sprint;
- regla de recurrencia;
- historial.

**Estados (columnas):**
- son propios de cada proyecto; se crean TODO, En curso y Hecho al crear el proyecto;
- «sin estado» es el backlog;
- un trigger impide asignar un estado de otro proyecto.

**Dependencias:** «B está bloqueada por A», dentro del mismo proyecto. No detecta ciclos.

**Historial:**
- antes de cada cambio guarda **la tarea entera** como JSON, y se puede «volver a esta versión»;
- **no** guarda las transiciones de estado. Su propio código de analíticas lo dice: sin eso no pueden medir el tiempo de ciclo ni el tiempo en cada estado. Nosotros no repetiremos ese error (§5.C).

**Orden por arrastre:**
- es un número decimal con huecos de 16.384;
- al soltar, el servidor pone la tarea en el punto medio entre la anterior y la siguiente;
- si los números se juntan demasiado, reparte la columna de nuevo;
- cada columna lleva una «versión», para que un cliente sepa que su copia quedó vieja.

**Recurrencia:**
- regla RRULE (diaria, semanal, mensual o anual, cada N, días de la semana, día del mes o último día, fin en fecha o tras N veces);
- zona horaria;
- modo **fijo** o **«al completar»**;
- pausar, reanudar y saltar fechas;
- la plantilla copia etiquetas y personas;
- **una sola instancia abierta a la vez**: la siguiente nace al completar la anterior, y si se completa tarde, cuenta desde hoy, sin montón de atrasadas;
- un trabajo nocturno repara las series atascadas;
- el editor enseña **las 5 próximas fechas**.

**Tiempo:**
- cronómetro (empezar uno para otro) o entrada manual;
- facturable sí/no;
- un solo cronómetro activo por persona;
- informes por día, persona o tarea.

**Otras piezas:** sprints con planificación, capacidad, burndown, velocidad y retro; analíticas por secciones con «ver las tareas» de cada cifra; notificaciones por tipo con preferencias globales y por proyecto; webhooks firmados con reintentos, historial y autodesactivación; Telegram y Slack con botones Hecho/Reabrir/Asignar; sincronización con GitHub, GitLab y Gitea; tokens de API con alcance; servidor OAuth; SSO; facturas.

### 2.2 Cómo está hecho por dentro (patrones que valen)

1. **Bus de eventos tipado + despachadores.**
   - Cada cambio emite `task.created`, `task.updated` (con `changes`, el diff, y `initiatorId`), y así con el resto.
   - Cada efecto (notificar, tiempo real, webhook, recurrencia, mensajería) es un despachador separado, con sus errores aislados.
   - Su fallo: algunos caminos (las etiquetas, el arrastre en el kanban) **saltan el bus**, y los webhooks nunca se enteran.
2. **Errores como resultado, no como excepción:** `ok(dato)` / `fail(código, motivo)`, con códigos `not_found`, `conflict`, `invalid_state`, `invalid_rule`.
3. **Permisos por campo:**
   - un mapa «campo → permiso para cambiarlo» y otro «campo → permiso para verlo»;
   - un PATCH se revisa campo por campo;
   - una lectura oculta lo que no se puede ver;
   - el mismo mapa sirve para los tokens de API, que son permisos ∩ proyectos ∩ el rol.
4. **Invariantes en la base:**
   - el estado, la etiqueta, la persona y la dependencia deben ser del mismo proyecto que la tarea;
   - un cronómetro activo por persona;
   - un sprint activo por proyecto;
   - una bandeja por organización;
   - una instancia por fecha de cada serie.
5. **Tiempo real «delgado»:** el aviso solo dice «cambió X»; el cliente vuelve a pedir el dato y el servidor aplica los permisos.
6. **Trabajos diferidos** con clave única: el recordatorio de una fecha límite se reemplaza al cambiar la fecha, y antes de disparar se vuelve a leer la fecha.

### 2.3 La interfaz (por qué se ve ordenada)

**Cabecera y navegación:**
- Una barra lateral con:
  - Inicio, cronómetro activo y campana;
  - buscar y Bandeja;
  - selector de proyecto;
  - «Herramientas» del proyecto (Tareas, Kanban, Grafo, Sprints…);
  - el espacio de trabajo y el usuario.
- **La dirección es el estado:** `/:org/:proyecto/:lista/:tarea`. Volver atrás funciona y una tarea abierta se puede enlazar.

**Inicio:** tres secciones (**Hoy** con lo vencido, **Próximo** y **Recientes**). Cada una lleva:
- icono con fondo de color;
- título y subtítulo;
- **«hechas / total» y una barra de progreso**;
- agrupar por fecha;
- **+**;
- se pliega y lo recuerda.

Debajo de cada sección van las pendientes, después una fila punteada «+ Añadir tarea» y al final el separador «COMPLETADAS · N». Añadir desde «Hoy» pone la fecha de hoy y desde «Próximo» la de mañana. El proyecto por defecto es el último usado, o la Bandeja.

**La fila de tarea** es la misma en todas partes:
- casilla con un punto de prioridad debajo;
- el texto;
- etiquetas pequeñas con la fecha (en rojo si vencida), la recurrencia, el proyecto, la lista, las personas y las etiquetas.

**Lista del proyecto:**
- un campo único que **añade o busca**, con un conmutador entre los dos modos;
- barra con filtros, «ver completadas», ordenar (fecha o prioridad, ascendente o descendente) y limpiar;
- **los filtros activos se ven como chips que se quitan**;
- marcar una tarea la saca de la lista medio segundo después.

**Kanban:**
- columnas = estados;
- campo de «añadir» arriba de cada columna;
- arrastrar con orden fraccional;
- la pizarra se desplaza sola al arrastrar y centra la columna de destino;
- los filtros van en la dirección (`?lists=1,2&assignees=3`).

**Grafo:** las dependencias como mapa. **Soltar una conexión en el vacío crea una tarea nueva ya enlazada.**

**El detalle:**
- modal o panel lateral, a elección;
- título con la casilla dentro;
- `#123` para copiar el enlace;
- **todos los campos con el mismo botón**: 52 px, icono, valor y flecha;
- **orden, visibilidad y ancho de los campos los elige el usuario**;
- subtareas con progreso;
- nota con editor que se pliega a 320 px;
- fecha con chips «Hoy, Mañana, Esta semana, Este mes» y rango;
- recurrencia con vista previa;
- dependencias «Anteriores ← | → Siguientes»;
- cronómetro;
- historial con diff y «restaurar»;
- **todo se guarda solo**, medio segundo después de dejar de escribir y al cerrar.

**Buscar (Ctrl+K):** si no encuentra nada, ofrece **«Crear tarea con este texto»**.

**Analíticas:**
- cifras con flecha que dice si es bueno o malo;
- gráficos;
- **clic en una cifra = las tareas que la forman**;
- se reordenan y ocultan.

**Diseño:**
- muy redondeado y cómodo para el dedo: campos de 52 px, opciones de 44 px;
- tonos suaves en vez de bordes;
- un solo ritmo de espaciado;
- vacíos con icono y una línea;
- claro y oscuro.

**Lo que NO tiene** y quizá esperabas:
- calendario: no hay vista de mes, semana o día; **el nuestro es mejor**;
- línea de tiempo;
- lenguaje natural al añadir: **el nuestro ya entiende «el viernes a las 10»**;
- selección múltiple;
- comentarios;
- adjuntos;
- atajos de teclado más allá de Ctrl+K.

### 2.4 Para agentes de IA

Tiene un servidor MCP con **62 herramientas**: proyectos, listas, tareas, etiquetas, kanban, dependencias, personas, notificaciones, `get_agenda` (hoy/próximo/completadas según zona horaria) y cronómetros. También un **plugin para Claude Code** con skill y comandos: `/taskview-tasks`, `/taskview-new-task`, y **`/taskview-log`, que resume la sesión y la anota como tarea hecha**.

Patrones buenos:
- **instrucciones del servidor** que enseñan el flujo: «resuelve los ids con list_*, nunca adivines»;
- las tres marcas (solo lectura, destructiva, mundo exterior) en cada herramienta;
- tokens con alcance por permiso y proyecto.

**Lo que les falta, y nosotros necesitamos:**
- comentarios o bitácora;
- **«tomar» una tarea** (bloqueo para que dos agentes no hagan la misma);
- identidad de agente: un agente es el token de una persona;
- estados para agentes: solo hay columna + completada;
- recurrencia, sprints y webhooks por MCP.

---

## 3. Cómo estamos hoy (lo que encontró el cuarto agente)

### 3.1 Lo que ya tenemos y TaskView no tiene

- **Agentes que ejecutan solos:**
  - un enrutador elige al agente (Sonnet, con el plantel, las skills y las correcciones pasadas);
  - cola con tope por agente y global;
  - reintentos;
  - topes de gasto.
- **Aprobaciones:**
  - «Lo que saldrá», riesgo y DESHACER de 30 s;
  - editar el borrador;
  - caducidad;
  - aprobar varias;
  - aprobadores delegados;
  - autonomía que se gana.
- **Equipos de agentes:**
  - el jefe divide el trabajo en piezas, que corren en paralelo;
  - notas `@id` entre ellos;
  - el jefe escribe el resultado final.
- **Dimitri:** planifica pedazos por departamento, mueve y cancela tareas.
- **Rutinas:** diaria, laborables, semanal, cada hora y minutos; saltar una; ponerse al día con aviso; rutinas de equipo.
- **Calendario:** mes, semana, día y agenda; ejecuciones pasadas; arrastrar; «solo esta vez / siempre»; suscripción `.ics`.
- **Calidad y lecciones:** puntaje por agente; lecciones del «devolver»; memoria del Cerebro.
- **Personas del equipo:** pasar una tarea a una persona; comentarios con `@`; Telegram.
- **Costo por tarea**, y **lenguaje natural** al crear («el viernes a las 10», «cada lunes»).

### 3.2 Lo que nos falta

- **Organización del trabajo:**
  - proyectos que crucen departamentos;
  - prioridad;
  - etiquetas.
- **Fechas y planificación:**
  - fecha límite separada de «cuándo arranca» (hoy `dueAt` significa «empieza a correr a esta hora»);
  - estimación visible (el enrutador calcula `eta` y nunca se enseña);
  - recurrencia mensual, «el 2.º martes», fin y conteo;
  - duración en el calendario (el `.ics` pone 30 min fijos).
- **Estructura de la tarea:**
  - subtareas o lista de pasos editable (el `plan` del enrutador existe y no se ve ni se marca);
  - dependencias.
- **Pantallas y uso:**
  - vista de lista con filtros y orden;
  - kanban de estados con orden propio;
  - acciones sobre varias tareas (solo existe «aprobar varias»);
  - campos ordenables;
  - enlace a una tarea abierta.
- **Seguimiento:**
  - historial de cambios y de estados;
  - analíticas de tareas (tiempo de ciclo, vencidas, bloqueadas, carga).

### 3.3 Los defectos de fondo (y por qué van primero)

1. **Seis fábricas de tareas.** `newTask()`, `POST /api/tasks` (que repite `newTask` en vez de llamarla), `fire()` (rutinas), `hookIn()` (disparadores), `/repeat` y el traspaso a persona dentro de `runServerTask`. Ya se diferencian: solo la ruta POST aplica el tope de importe que obliga al OK, y solo `hookIn` marca la tarea como «contaminada».
2. **Cambios que se pierden.**
   - `runServerTask` guarda la tarea con la copia que leyó al empezar.
   - Un comentario, un voto o una persona añadidos mientras el agente trabaja **se pisan**.
   - Además se reescribe `data/tasks.json` entero en cada cambio.
3. **Estados mezclados.**
   - Hay 5 estados reales (`scheduled · next · doing · waiting · done`).
   - El resto son marcas sobre «hecha» (`error`, `expired`, `rejected`) o borrados (cancelar).
   - La página se inventa un estado `sched` para rutinas.
   - Las piezas de Dimitri, las piezas de Contenido y las tareas tienen tres ciclos de vida distintos.
4. **Dos modelos de tarea**, servidor y página, sincronizados a mano: `sid`/`id`, `EXTRA` y `extraOf` repetidos, y un modo demo mezclado en el mismo archivo.
5. **Comprobaciones muertas.** Cinco módulos filtran `!t.piece`, pero el servidor nunca pone `piece`: las piezas viven dentro de `task.team`.
6. **El tope de concurrencia se puede pasar.** Una tarea de equipo cuenta como una, pero lanza hasta 4 procesos más, y sus agentes no figuran como ocupados.
7. **Reglas distintas según la puerta.**
   - `tarea_mover` de Dimitri se salta las reglas del PATCH.
   - La pizarra usa `confirm()` y `alert()`, contra la regla de `modal.js`.
   - El detalle no deja cambiar el esfuerzo, el «necesita OK» ni el título.
8. **La barra de progreso es inventada** (tiempo / 45 s). *(Corrección del 6 oct, al implementar T0: el orden de la pizarra no da NaN, porque los ids de la página son números.)*
9. **Archivos enormes y sin tests propios.**
   - `serve.mjs` tiene 2.660 líneas; las rutas son una cadena de `if`.
   - `src/tasks.js` tiene 1.417 líneas: panel, pizarra, demo, chat y sincronización juntos.
   - No hay tests de tareas, rutinas ni equipos; solo unas 18 llamadas en `check.mjs`.

---

## 4. Qué nos quedamos, qué adaptamos, qué dejamos

| De TaskView | Decisión | Por qué / cómo aquí |
|---|---|---|
| Proyecto → Lista → Tarea → Subtarea | **Adaptar** | Proyecto **opcional y transversal** (cruza departamentos). Sin «listas»: el departamento ya hace de lista. Subtareas = **pasos** (§5.B). |
| Bandeja | **Adaptar** | Lo que entra sin proyecto: Telegram, disparadores, «añadir tarea». Es una vista, no un proyecto especial. |
| Prioridad 1–3 | **Adoptar** | Alta / Media / Baja. La cola la respeta (§5.E). |
| Etiquetas con color | **Adoptar** | Globales, no por proyecto, porque la empresa es una sola. Color con contraste calculado. |
| Fecha límite + inicio | **Adoptar** | Separar **«cuándo arranca»** (lo de hoy) de **«para cuándo»** (fecha límite). |
| Estimación | **Adoptar** | La del enrutador (`eta`) más la que pongas tú; el real sale del trabajo del agente. |
| Estados como columnas | **Adaptar** | **Estados fijos**, porque los agentes dependen de ellos (§5.A). Las columnas del kanban son esos estados. |
| Orden fraccional + versión | **Adoptar** | Para prioridad manual dentro de cada estado y en la Bandeja. |
| Dependencias | **Adoptar** | «Bloqueada por». La cola no arranca una tarea bloqueada. **Con detección de ciclos**, que ellos no tienen. |
| Historial (fotos) | **Adaptar** | **Bitácora de eventos**, que además da transiciones y tiempos (§5.C). «Restaurar» para texto y campos. |
| Recurrencia RRULE | **Adaptar** | Ampliamos las rutinas (mensual, n.º día de la semana, fin, conteo) y sumamos recurrencia a tareas de personas, con modo «al completar». Vista previa de 5 fechas. |
| Bus de eventos + despachadores | **Adoptar** | El corazón de la refactorización (§5.D). Sin atajos que lo salten. |
| Errores `ok`/`fail` con código | **Adoptar** | Todas las reglas del módulo de tareas responden así; las rutas lo traducen a 4xx en español. |
| Permisos por campo | **Adaptar** | Quién puede cambiar qué: dueño, persona, agente, jefe, Dimitri, Telegram (§5.F). |
| Inicio: Hoy / Próximo / Recientes | **Adoptar** | Más «Esperan tu OK» y «Bloqueadas» (§6.1). |
| Fila única, campo único, secciones con progreso | **Adoptar** | Es lo que hace que se vea limpio. |
| Detalle con campos ordenables y guardado solo | **Adoptar** | Reemplaza el cajón de hoy (`src/detail.js`). |
| Filtros en la dirección + chips | **Adoptar** | `#tareas?dpto=ventas&prio=alta`. |
| Buscar sin resultados → crear | **Adoptar** | En Ctrl+K y en la lista. |
| Kanban con auto-desplazamiento | **Adoptar** | Rehace la pizarra de la empresa (B). |
| Grafo de dependencias | **Adoptar más tarde** | Útil para proyectos de Dimitri; fase T5. |
| Analíticas con «ver las tareas» | **Adoptar** | Analíticas de tareas (§6.6). |
| Cronómetro | **Adaptar** | Los agentes ya miden su tiempo real. Cronómetro solo para personas, opcional. |
| MCP con instrucciones y marcas | **Adoptar** | `tareas-mcp.mjs` para los agentes (§7). |
| `/taskview-log` (anotar lo hecho) | **Adaptar** | Una herramienta de agente: «registrar trabajo hecho fuera de una tarea». |
| Webhooks salientes firmados | **Adoptar opcional** | Despachador más: Zapier, Make, n8n. |
| Recordatorios de fecha límite | **Adoptar** | Para personas: Telegram y avisos. |
| Sprints | **Dejar (por ahora)** | Pensado para equipos de software; nuestro ritmo son rutinas y semanas. |
| Organizaciones, SSO, SCIM, OAuth, facturas, importes, widgets, app móvil, sync con GitHub | **Dejar** | No es nuestro caso, o ya lo cubre otra parte. |

---

## 5. Cómo funcionaría aquí: el modelo

### 5.A Un solo ciclo de vida, con estados de verdad

```
           ┌──────────── bloqueada ◄── (depende de otra sin terminar)
           ▼
idea ──► por_hacer ──► programada ──► en_cola ──► en_curso ──► espera_ok ──► hecha
                                         ▲            │  │                     │
                                         └─reintento──┘  └──► fallida          └─► (archivada: marca)
                         cualquiera sin empezar ──► cancelada (con DESHACER)
                         con una persona ──► en_manos_de (persona) ──► hecha
```

**Los estados:**
- **idea**: sin pedir todavía. Lo que dejan Dimitri y los agentes como propuesta, y la Bandeja.
- **por_hacer**: pedida, pero sin hora ni turno.
- **programada**: con hora de arranque.
- **en_cola**: lista para un agente.
- **en_curso**: un agente la tiene **tomada** (§7.2).
- **espera_ok**: el borrador espera al dueño.
- **hecha**.

**Estados que hoy son marcas o borrados, y pasan a ser estados con nombre:** `fallida` (antes `done` + `error`), `cancelada` (antes un borrado) y `bloqueada`. `vencida` (la aprobación que caducó) y `devuelta` no son estados, sino **eventos** en la bitácora.

**Las reglas:**
- Las transiciones válidas están en **una tabla pura** (`tareas/estados.mjs`), con test.
- Cada puerta pasa por ella: página, API, Telegram, Dimitri, rutinas, disparadores y agentes. Así no vuelve a pasar que una puerta se salte las reglas.
- Las columnas del kanban son estos estados. **No son personalizables**: un agente tiene que saber qué significa «en_cola».
- Lo que sí es libre son las **etiquetas**, para dividir como quieras.

### 5.B La tarea nueva (campos)

**Lo que se mantiene:** todo lo de hoy (agente, departamento, texto, resultado, aprobaciones, costo, equipo, guardián…).

**Lo nuevo:**

| Campo | Qué es | Quién lo pone |
|---|---|---|
| `proyecto` | id de un proyecto (opcional) | dueño, Dimitri |
| `prioridad` | `alta · media · baja` (defecto media) | dueño, jefe, Dimitri; el agente puede **proponer** |
| `etiquetas[]` | ids de etiquetas | dueño, jefe, agente (solo las existentes) |
| `limite` | fecha (y hora opcional) **para cuándo** | dueño, Dimitri, jefe |
| `arranque` | lo de hoy (`dueAt`): **cuándo empieza** | dueño, Dimitri |
| `estimacion` | minutos (la del enrutador como sugerencia) | enrutador, dueño |
| `pasos[]` | `{id, texto, hecho, por, cuando}`: la lista del agente | enrutador (de su `plan`), dueño, **el agente marca los suyos** |
| `bloqueadaPor[]` | ids de tareas | dueño, Dimitri, jefe; el agente **pide** un bloqueo (§7) |
| `orden` | número fraccional dentro de su estado | arrastre |
| `version` | sube en cada cambio | almacén |
| `bitacora` | aparte (§5.C) | todos, vía eventos |

**Los `pasos` son lo que más se nota en el día a día:**
- El plan del enrutador deja de ser invisible: se ve como lista con progreso.
- El agente marca cada paso al cumplirlo.
- Tú añades o quitas pasos antes de que arranque.
- Las **piezas de un equipo** se enseñan como pasos con su agente.

**Dos piezas aparte:**
- **Proyecto** (`data/proyectos.json`, o una nota del Cerebro, §9): nombre, color, objetivo, fecha límite, responsable (persona o jefe), estado (activo, en pausa, terminado, archivado). Su progreso se calcula de sus tareas.
- **Etiqueta**: nombre y color; se crea al vuelo con un color de la paleta.

### 5.C La bitácora de eventos (lo que TaskView no tiene)

Cada cambio deja una línea en `data/tareas/bitacora/AAAA-MM.jsonl`:

```json
{"t":1765000000000,"tarea":"k3x9…","tipo":"estado","de":"en_cola","a":"en_curso","por":"agente:piper","motivo":"tomada"}
{"t":1765000060000,"tarea":"k3x9…","tipo":"paso","paso":"p2","hecho":true,"por":"agente:piper"}
{"t":1765000600000,"tarea":"k3x9…","tipo":"campo","campo":"limite","antes":"2026-10-09","despues":"2026-10-10","por":"dueno"}
```

**Qué da:**
- **Historial legible** en el detalle: «Piper la tomó a las 10:02», «cambiaste la fecha límite del 9 al 10».
- **Restaurar** un texto o un campo.
- **Analíticas que TaskView no puede hacer:** tiempo de ciclo, tiempo en cada estado, cuánto tarda tu OK, retrasos frente a la fecha límite.
- **La base del bus de eventos:** escribir la línea es el evento.
- **Auditoría:** junto a `data/audit/` del guardián, quién hizo qué.

### 5.D Un bus de eventos y sus despachadores

Hoy `runServerTask` hace de todo en línea: Telegram, la nota del Cerebro, las lecciones, los KPI, el aprendizaje de memoria, los avisos y el traspaso a una persona. Pasará a ser:

```
almacen.cambiar(id, parche, quien) ──► valida (estados + permisos) ──► guarda ──► bitácora ──► bus.emit('tarea.cambio', {…, cambios, por})
                                                                                                │
   despachadores (cada uno en su archivo, con su test, errores aislados):                      ▼
   telegram · avisos · nota-cerebro · memoria · lecciones · kpi · costos · recurrencia · dependencias (desbloquear) · webhooks · tiempo-real (la página)
```

**Las reglas del bus:**
- **Nada se salta el bus**: ni el arrastre del kanban, ni las etiquetas, ni Dimitri.
- Cada evento lleva `por`: dueño, persona, `agente:id`, Dimitri, rutina, disparador o Telegram.
- Con `por`, un despachador no te avisa de lo que hiciste tú. Es el `initiatorId` de TaskView.

### 5.E La cola, ahora con prioridad, dependencias y fecha límite

`pump()` sigue con sus topes, y añade tres cosas:
1. No arranca una tarea **bloqueada**. Al terminar la que la bloqueaba, el despachador «dependencias» la pasa a `en_cola` y lo dice en la bitácora.
2. Ordena por **prioridad**, después por **fecha límite más cercana**, después por el **orden manual**, y al final por antigüedad. Hoy solo cuenta la antigüedad.
3. Cuenta bien los procesos: una tarea de equipo ocupa tantos huecos como piezas en marcha, y esos agentes figuran **ocupados**.

**Avisos de la fecha límite:**
- La víspera, si no ha empezado: aviso.
- Si se vence: aparece en **Hoy** con rojo, y aviso por Telegram (con «no molestar»).
- Para personas: un recordatorio a la hora que elijan.

### 5.F Permisos por campo (quién puede qué)

Un mapa puro (`tareas/permisos.mjs`) dice qué campos cambia cada quien, y la API lo aplica a cualquier puerta.

| Quién | Puede | No puede |
|---|---|---|
| Dueño | todo | — |
| Persona del equipo | sus tareas: estado, pasos, comentarios, fecha (si se la dieron) | aprobar lo de otros departamentos (salvo aprobador delegado) |
| Agente | **su** tarea en curso: marcar pasos, escribir en la bitácora, proponer prioridad, pedir bloqueo, entregar | aprobar, cambiar fecha límite o prioridad, tocar tareas de otros, borrar |
| Jefe de departamento | lo de su departamento: reasignar, prioridad, pasos | aprobar envíos |
| Dimitri | crear (nacen `idea` o `por_hacer`), mover, cancelar con DESHACER | aprobar, publicar |
| Telegram | aprobar o devolver (solo quien está autorizado), añadir tarea | lo demás |

Es la versión «agentes» de los permisos por campo de TaskView. Hoy esas reglas están dispersas entre `por: 'agente'`, rutas sueltas y la cabeza de cada módulo.

### 5.G Recurrencia ampliada

**Las rutinas (de agentes) ganan:**
- `mensual` (día N o último día);
- `n-esimo` («el 2.º martes»);
- `fin` (fecha) y `veces`;
- vista previa de las **5 próximas** al crearlas.

**Las tareas de personas** pueden repetirse con modo **fijo** o **«al completar»** («cada 2 semanas desde que la hice»). Hay **una sola abierta a la vez**: la siguiente nace al marcar la anterior, como en TaskView, y si se completa tarde no se amontonan atrasadas.

**Se mantiene lo que ya tenemos:** saltar una, ponerse al día, «solo esta vez / siempre» y el `.ics`. Ahora el `.ics` lleva la **duración** de la estimación, no 30 min fijos.

### 5.H Proyectos y Dimitri

**Dimitri:**
- Cuando el dueño le dice «lanzamiento de los lentes polarizados para el 20», su plan propone un **proyecto** con fecha límite.
- Propone tareas por departamento, cada una con **prioridad, fecha límite y dependencias**: «el post espera a las fotos», «la campaña de correos espera al post».
- Con ENVIAR, todo nace junto: el proyecto, las tareas (las bloqueadas, `bloqueada`) y el orden.

**El proyecto:**
- Muestra su progreso (pasos y tareas hechas), lo bloqueado y lo vencido.
- Dimitri lo lee en `<estado>` y avisa: «el proyecto Lentes va 2 días atrasado: falta la foto».

---

## 6. Cómo se vería (las pantallas)

Siempre con el sistema de la oficina:
- vistas bajo la barra superior;
- Dimitri al lado;
- claro y oscuro;
- probado a 390, 1024 y 1512 px;
- objetivos de 24 px y contraste 4,5:1.

**El panel de tareas (T) deja de ser una lista larga** y pasa a ser **la vista «Tareas»** (tecla T), con cinco pestañas:

### 6.1 INICIO (lo primero que ves)

Secciones a la manera de TaskView: icono con tinte, título, «hechas/total», barra de progreso, plegables y recordadas. Es nuestra versión, con lo que solo nosotros tenemos:
1. **Esperan tu OK** (N): con «Lo que saldrá» y aprobar, devolver o editar en la fila.
2. **Hoy**: lo que vence hoy y lo vencido, en rojo, y lo que arranca hoy.
3. **En curso**: qué agente trabaja en qué, con sus **pasos** en vivo, que son el progreso real en vez del inventado.
4. **Bloqueadas** (N): y por qué («espera la foto de Estudio»).
5. **Próximo**: 7 días, agrupado por día.
6. **Recientes**: hechas en las últimas 48 h, con 👍/👎 y «guardar como ejemplo».

Cada sección termina con la fila punteada **«+ Añadir tarea»**, que pone la fecha según la sección. Después va el separador **«COMPLETADAS · N»**.

### 6.2 LISTA

**Barra:**
- el campo único **añadir / buscar** (con el lenguaje natural de hoy);
- filtros (departamento, agente, persona, proyecto, prioridad, etiquetas, estado, fecha);
- ordenar (prioridad, fecha límite, creada, manual);
- «ver hechas».

**Comportamiento:**
- Los filtros activos son **chips** y van en la dirección (`#tareas?dpto=ventas&prio=alta`).
- **Selección múltiple** (como Programación de Contenido): aprobar, prioridad, etiquetar, mover de día, pasar a persona, cancelar (con DESHACER).
- Agrupar por departamento, proyecto, estado o día.

### 6.3 TABLERO (kanban)

**La pizarra de la empresa (B) rehecha:**
- columnas = estados;
- carriles opcionales por departamento (lo de hoy);
- arrastrar con orden fraccional;
- desplazamiento automático.

**Arrastrar respeta las reglas del §5.A:**
- a «en_cola» = ponerla a trabajar;
- a «hecha» desde «espera_ok» = aprobar, con DESHACER;
- a «cancelada» = cancelar, con DESHACER;
- **nunca con `confirm()` ni `alert()`**.

En el teléfono, una columna a la vez con pestañas.

### 6.4 PROYECTOS

**La lista de proyectos:** tarjeta con color, objetivo, fecha límite, barra de progreso, vencidas y bloqueadas.

**Al abrir uno:**
- sus tareas por estado o por departamento;
- **el mapa de dependencias** (fase T5): soltar una conexión en el vacío crea la tarea enlazada.

### 6.5 CALENDARIO (P, ya existe)

Se queda con todo lo que tiene, y gana:
- **fechas límite** como marcas propias, distintas del arranque;
- **duración** (la estimación) en semana y día;
- **prioridad** en el color del borde;
- arrastrar una fecha límite.

### 6.6 ANALÍTICAS DE TAREAS (en «Costos y retorno», U, o en Negocio, N)

**Cifras:**
- hechas, a tiempo y tarde;
- tiempo de ciclo;
- espera media de tu OK;
- bloqueadas;
- carga por agente y por persona;
- devueltas y retrabajo;
- costo por proyecto.

**Clic en una cifra = las tareas que la forman.** Las cifras se pueden reordenar y ocultar.

### 6.7 EL DETALLE DE UNA TAREA

Reemplaza `src/detail.js`:
- **Arriba:** título editable con la casilla de estado; `#id` copiable, que abre la tarea por enlace (`#tarea=k3x9`); quién la tiene y su estado.
- **Campos, todos con el mismo botón:** estado, prioridad, proyecto, etiquetas, fecha límite (chips Hoy, Mañana, Viernes, Próxima semana), arranque, estimación, agente, persona, modelo, esfuerzo, «necesita OK». **Ordenables y ocultables** en Ajustes.
- **Pasos** con progreso.
- **«Bloqueada por ← | → Bloquea a».**
- **El resultado** (lo de hoy) y «Lo que saldrá».
- **Bitácora:** lo que hizo el agente y los cambios, con «restaurar».
- **Comentarios con `@`** (lo de hoy).
- **Se guarda solo**, medio segundo después de escribir y al cerrar.
- **En el teléfono:** a pantalla completa con la barra de acciones abajo.

---

## 7. Cómo funcionaría para los agentes

### 7.1 Herramientas nuevas (`tareas-mcp.mjs`, como `contenido-mcp.mjs`)

Las herramientas empiezan por **ver** o **crear_borrador** cuando el guardián debe leerlas como lectura. Las que escriben solo tocan **la tarea propia** o crean **propuestas**:

| Herramienta | Qué hace | Regla |
|---|---|---|
| `ver_mi_tarea` | la tarea en curso: texto, pasos, bloqueos, fecha límite, comentarios | solo la suya |
| `marcar_paso` (id, hecho, nota?) | marca un paso; la nota va a la bitácora | solo pasos de su tarea |
| `anotar_en_bitacora` (texto) | «encontré X», «esperé por Y» | append, nunca sobrescribe |
| `ver_tareas` (filtros) | lo del departamento o del proyecto, ya resumido | lectura |
| `ver_agenda` | hoy, vencidas y próximas, en palabras | lectura (es el `get_agenda` de ellos) |
| `pedir_bloqueo` (tarea, por qué) | «no puedo seguir sin la foto de Estudio» | crea la dependencia **propuesta**; el jefe o el dueño la confirma, o se confirma sola si la otra tarea ya existe |
| `crear_borrador_tarea` (dpto, texto, por qué) | pide trabajo a otro departamento | nace **idea**, no `en_cola`: lo aprueba el jefe o el dueño |
| `registrar_trabajo` (texto) | anota algo hecho fuera de una tarea (el `/taskview-log` de ellos) | nace **hecha**, marcada «del agente» |

Además:
- **Instrucciones del servidor** al estilo TaskView: «usa ids de ver_tareas, nunca los adivines», «marca cada paso al cumplirlo», «si te bloquea otra cosa, pide bloqueo en vez de inventar».
- La skill de cada departamento puede añadir lo suyo.

### 7.2 Tomar una tarea (lo que TaskView no tiene)

**Al arrancar, la tarea queda «tomada»:** `tomadaPor: 'agente:piper'`, con `version` y hora. Nadie más la ejecuta:
- ni otro proceso;
- ni un «RUN NOW» doble;
- ni una pieza de equipo repetida.

**Cada cambio lleva su `version`:**
- Si llega con una vieja, el almacén **mezcla** los campos que no chocan: un comentario tuyo y el resultado del agente conviven.
- Si chocan de verdad, gana el dueño y la bitácora lo dice.
- **Se acabó perder un comentario mientras el agente trabaja.**

### 7.3 Un ejemplo de punta a punta

1. **El encargo.** Escribes a Dimitri: «Lanzamos los lentes polarizados el 20; quiero post, correo a clientes y la ficha en la web».
2. **El plan.** Dimitri propone el proyecto **Lentes polarizados** (fecha límite 20/10) con 4 tareas:
   - **Estudio · fotos de producto**: prioridad alta, límite 14/10.
   - **Marketing · post de lanzamiento**: bloqueada por las fotos, límite 18/10.
   - **Emails · correo a clientes**: bloqueada por el post, límite 19/10.
   - **Entregas · ficha en la web**: bloqueada por las fotos, límite 17/10.
3. **El arranque.** Pulsas ENVIAR. Nacen las 4: las fotos `en_cola`, las demás `bloqueada`. En **Proyectos** ves 0 %, 3 bloqueadas.
4. **Las fotos.** El agente de Estudio toma las fotos:
   - Sus 3 pasos (subir referencias, generar, elegir) se marcan en vivo; en **Inicio → En curso** ves el avance real.
   - Anota en la bitácora «usé la receta "Catálogo con margen"».
   - Al terminar, el despachador **dependencias** desbloquea el post y la ficha (pasan a `en_cola`), y la bitácora lo dice.
5. **El post y la ficha.** El agente de Marketing deja el post en `espera_ok`. Lo apruebas desde Inicio, y el correo se desbloquea.
6. **Un imprevisto.** El agente de Entregas descubre que falta el precio:
   - pide bloqueo («falta el precio en las cifras de la empresa»);
   - la tarea queda bloqueada por una **tarea para ti**, «Confirmar precio», con prioridad alta en **Hoy**.
7. **El aviso.** El 18, el proyecto va un día atrasado. Dimitri lo avisa en el resumen y por Telegram, con el porqué: la bitácora dice dónde se paró.
8. **El cierre.** Al terminar, **Analíticas** enseña el tiempo de ciclo de cada tarea, cuánto esperó tu OK y cuánto costó el proyecto.

---

## 8. La arquitectura (bien factorizada)

**Un módulo `tareas/`, como ya hicimos con `contenido/`:**

```
tareas/
  modelo.mjs        el esquema, crearTarea() (la ÚNICA fábrica), normalizar(), migrar(v1→v2)      · puro, con test
  estados.mjs       estados, transiciones válidas, puede(de, a, quien)                              · puro, con test
  permisos.mjs      campo → quién puede verlo / cambiarlo                                          · puro, con test
  orden.mjs         orden fraccional (entre, rebalancear)                                          · puro, con test
  dependencias.mjs  bloqueos, detección de ciclos, quién se desbloquea                             · puro, con test
  recurrencia.mjs   reglas nuevas (mensual, n-ésimo, fin, veces, al completar), proximas(5)         · puro, con test (amplía src/when.js)
  almacen.mjs       leer/cambiar con versión y mezcla, escritura atómica, bitácora                  · con test (carpeta temporal)
  eventos.mjs       el bus tipado (emit/on, errores aislados)
  despachadores/    telegram, avisos, nota, memoria, lecciones, kpi, costos, recurrencia, dependencias, webhooks, tiempo-real
  cola.mjs          pump(): prioridad, límite, orden, bloqueos, huecos reales de equipos          · con test
  rutas.mjs         /api/tareas/* (y /api/tasks/* como alias mientras migra la página)
  proyectos.mjs     proyectos y su progreso
  etiquetas.mjs
tareas-mcp.mjs      las herramientas de los agentes (§7)
src/tareas/         la vista: inicio.js, lista.js, tablero.js, proyectos.js, detalle.js, campos.js, fila.js, filtros.js, datos.js (servida/demo)
src/css/tareas.css
```

**De dónde sale cada pieza:**
- `serve.mjs` pierde unas 600 líneas: las rutas de tareas, `newTask` y sus seis copias, `pump` y la mitad de `runServerTask`. Le queda «arrancar el proceso del agente», que ya es bastante.
- `src/tasks.js` (1.417 líneas) se reparte en `src/tareas/`. El modo demo va a `datos.js` con los mismos contratos, como en Contenido.

**La migración:**
- Al arrancar, `migrar()` lee `data/tasks.json` (sin versión), convierte cada tarea y guarda `data/tareas/tareas.json` con `"version": 2`. Antes deja una copia: `tasks.json.v1-AAAA-MM-DD`.
- Las marcas viejas pasan a estados: `done` + `error` → `fallida`; `expired` → evento.
- Se puede volver atrás con la copia.
- **`Volver-Atras.bat` debe saberlo:** lo anotamos en `docs/`.

**Los tests:** cada archivo puro con el suyo. Además:
- un test de **puertas**: Dimitri, Telegram, disparador, rutina y página pasan por las mismas reglas;
- un test de **cambios simultáneos**: comentario durante una ejecución;
- un recorrido de navegador por fase.

---

## 9. El plan por fases

Cada fase termina con:
- `npm run check` en verde;
- tests nuevos;
- su recorrido en el navegador a 390, 1024 y 1512 px (claro y oscuro, y con Dimitri abierto);
- CLAUDE.md y README al día.

| Fase | Qué entrega | «Hecho» cuando |
|---|---|---|
| **T0 · Cimientos** (sin cambios visibles) ✅ | `tareas/` con modelo, estados, almacén con versión y mezcla, bitácora, bus y despachadores. Las **seis fábricas** pasan a llamar a `crearTarea()`. Migración v1→v2 con copia. Rutas fuera de `serve.mjs`. Se arreglan: cambios perdidos, `!t.piece` muerto, tope de concurrencia con equipos, orden NaN de la pizarra, `confirm()`/`alert()`. | Todo funciona igual que hoy, más rápido y sin perder cambios. Test de puertas y de cambios simultáneos en verde. |
| **T1 · La tarea completa** ✅ | prioridad, etiquetas, fecha límite, estimación, **pasos** (el plan del enrutador y las piezas de equipo), dependencias con detección de ciclos, proyecto. El detalle nuevo con campos únicos, guardado solo, bitácora legible y `#tarea=` en la dirección. | Una tarea se puede describir entera y los agentes marcan sus pasos. |
| **T2 · Las vistas** ✅ | Inicio (6 secciones), Lista (filtros en la dirección, chips, selección múltiple, agrupar), Tablero (estados, orden fraccional, sin `confirm`), Calendario con fecha límite y duración. Ctrl+K «crear con este texto». | El dueño encuentra «qué hay hoy» en una mirada y ordena arrastrando. |
| **T3 · Los agentes** ✅ | `tareas-mcp.mjs` (§7.1), tomar la tarea, permisos por campo en todas las puertas, la cola con prioridad, límite y bloqueos, skills al día, evals de una skill de tareas. | Un agente marca pasos, pide bloqueo y propone trabajo a otro departamento sin poder aprobar nada. |
| **T4 · Proyectos y Dimitri** ✅ | Proyectos con progreso, Dimitri planifica proyectos con dependencias y fechas, avisos de atraso con el porqué, vista Proyectos. | El ejemplo del §7.3 funciona de punta a punta. |
| **T5 · Ritmo y medida** ✅ | Recurrencia ampliada (mensual, n-ésimo, fin, veces, al completar, vista previa de 5), recordatorios de fecha límite, `.ics` con duración, Analíticas de tareas con «ver las tareas», mapa de dependencias. | El resumen del lunes dice tiempos de ciclo y atrasos reales. |
| **T6 · Pulido** ✅ | Campos ordenables y ocultables en Ajustes, modal o panel lateral, cronómetro para personas, webhooks salientes, auditoría de accesibilidad con axe. | Auditoría limpia y recorridos en verde. |

**Estado (6 oct 2026):** el dueño dijo «empieza con todo» y se tomaron las recomendaciones del §11. Proyectos transversales: sí. Estados fijos: sí. Tareas de personas: sí (recordatorios, repetir al completar y cronómetro). Tablero por estados con carriles por departamento: sí. T0 primero: sí. **Hechas T0 a T6.**

Lo que se hizo distinto de lo escrito arriba:
- Las tareas siguen en `data/tasks.json`, no en `data/tareas/tareas.json`. Se migran al leer (`normalizar`), así las copias diarias y `Volver-Atras.bat` no cambian.
- Los estados guardados son los de siempre, más `idea`; lo demás (fallida, bloqueada, en manos de una persona) se deduce con `visible()`. Así ni la página, ni Telegram, ni las cuentas tuvieron que cambiar de golpe.
- «Tomar» una tarea es `tomadaPor` mientras corre, y la mezcla (`guardarEjecucion`) evita perder lo del dueño. No hace falta comparar versiones a mano.
- La vista Tareas convive con el panel (T) y la pizarra (B). No los reemplaza: el panel sigue siendo el chat y el pulso de la oficina en 3D.

**Orden recomendado:** T0 → T1 → T2 → T3 → T4 → T5 → T6. **T0 no se salta.** Todo lo demás se apoya en la fábrica única, la bitácora y el bus; sin ellos, cada mejora repetiría los defectos del §3.3.

---

## 10. Riesgos

- **La migración toca `data/tasks.json`.** Es el corazón de la oficina. Por eso:
  - copia antes;
  - test con un `tasks.json` real anonimizado de la demo;
  - `migrar()` idempotente;
  - lectura en la versión vieja durante una versión, para poder volver atrás.
- **`serve.mjs` es el archivo que más choca con el equipo** (regla 6 de CLAUDE.md). T0 lo encoge mucho. Conviene **avisar al equipo antes de empezar** y hacerlo en una rama corta.
- **Más campos = más ruido.** Lo evitamos como TaskView:
  - campos ocultables;
  - valores por defecto que no piden nada (prioridad media, sin etiquetas, sin proyecto);
  - **el lenguaje natural** que ya tenemos: «urgente para el viernes, ventas, #lentes» rellena prioridad, fecha límite, departamento y etiqueta.
- **Agentes que piden bloqueos de más.** El jefe o el dueño los confirma. Un tope por tarea, y un aviso si un agente bloquea más que la media.

---

## 11. Las decisiones que son tuyas

1. **Proyectos transversales:** ¿sí? (recomendado). ¿O basta con etiquetas?
2. **Estados fijos** (recomendado, por los agentes) **o columnas personalizables** como TaskView.
3. **Tareas de personas:** ¿la gente de PanaClaw usará la oficina también para sus propias tareas, sin agente? Si sí, en T5 entran recordatorios, recurrencia «al completar» y cronómetro.
4. **El tablero:** ¿columnas por estado con carriles por departamento (recomendado), o por departamento como hoy?
5. **¿Empezamos por T0 aunque no se vea nada nuevo una semana?** Recomendado: sin T0, lo demás se construye sobre arena.

---

*Fuentes: el repositorio `Gimanh/taskview-community` en el commit `46b3d1e` (`api/`, `web/`, `taskview-packages/`, `taskview-plugin/`, `docs/`, `ideas/`, `LICENSE.md`), leído sin ejecutar nada; y nuestro código en `main` (`241f37c`): `serve.mjs`, `routines.mjs`, `src/when.js`, `teams.mjs`, `sub.mjs`, `src/tasks.js`, `src/detail.js`, `src/calendar.js`, `src/search.js`, `quality.mjs`, `reliability.mjs`.*
