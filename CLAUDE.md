# Agents Office — for Claude Code

You are in the Agents Office repo. The owner will most often ask you to change **who the agents are and what they do**, to teach an agent **how a kind of work is done** (a brief or a skill), to put something **on the timetable** (a routine), or to change **which connectors the agents may use**. Do that by editing the JSON files and skill folders described below. Do not touch `src/`, `serve.mjs` or the build for those requests.

## Trabajo en equipo (PanaClaw) — reglas

Esta copia es la oficina de **PanaClaw**. El dueño (Abrinay) y la gente de PanaClaw la mejoran cada uno en su propia computadora y con su propia sesión de Claude Code; **GitHub** (`abrinay1997-stack/Agents-Office`, rama `main`) es lo que los une. Lo que alguien sube, el dueño lo trae con un doble clic y lo ve en su oficina como si se hubiera hecho en su máquina.

**Idioma:** con el dueño y con el equipo de PanaClaw, responde siempre en español.

**Qué viaja por GitHub:**
- el código;
- `office.config.equipo.json` (nombre PanaClaw, cerebro `brain-panaclaw`, qué conector usa cada departamento);
- las notas de empresa de `brain-panaclaw/`;
- el roster, las rutinas y las skills del cerebro (`brain-panaclaw/Agents Office/agents.json`, `routines.json`, `skills/`);
- la auditoría y este plan.

**Qué NO viaja (se queda en cada máquina):**
- `data/` (tareas, historial, trabajos del Estudio);
- `office.config.local.json` (ajustes de esa máquina, que ganan sobre los del equipo);
- las entregas y correcciones de los agentes (`brain-panaclaw/Agents Office/*`);
- las imágenes del Estudio;
- las keys (variables de entorno de Windows);
- la sesión de Claude de cada uno.

Por eso quien clona ve la misma oficina y el mismo cerebro, pero con el historial de tareas vacío.

**Reglas:**
1. **Antes de empezar, trae lo último:** `git pull`, o `Actualizar-Oficina.bat`.
2. **Trabaja en una rama con nombre** (p. ej. `mejora/aprobaciones`) y abre un Pull Request hacia `main`; el dueño lo acepta. Solo sube directo a `main` si el dueño lo pidió.
3. **Antes de subir:** `npm run check` en verde (incluye `npm test` y la revisión de secretos), y commits en español que digan qué cambió y por qué. GitHub vuelve a correr todo en cada push.
4. **Nunca subas** keys, `data/`, `office.config.local.json` ni las entregas de los agentes (el `.gitignore` ya lo impide: no lo fuerces). El repositorio puede ser público: lo que viaja lo puede leer cualquiera.
5. **Al arreglar un punto de la auditoría,** márcalo ✅ en `docs/auditoria-ux-2026-09-24.md` en el mismo commit. Al cambiar algo que el dueño usa, actualiza este archivo y el README.
6. **Avísense antes de tocar a la vez los archivos grandes:** `src/main.js`, `src/tasks.js`, `src/shell.html`, `serve.mjs`. Son los que más chocan.
7. **`dist/command-centre-v2.html` y `src/braingraph.js` se regeneran solos** al arrancar. Si chocan, quédate con cualquiera de las dos versiones y reconstruye con `node build.mjs`.

**El dueño, para ver el trabajo del equipo:** doble clic en **`Actualizar-Oficina.bat`**.
- Guarda primero sus cambios propios (rutinas, agentes, notas) en un commit local, así nunca se pierden.
- Descarta lo que se regenera solo, trae lo nuevo de GitHub e instala las librerías si cambiaron.
- Abre la oficina con el iniciador.
- Si él y el equipo tocaron la misma línea de un archivo, no cambia nada y lo dice. Entonces se le pide a Claude Code en esta carpeta: «combina mis cambios con los del equipo».

**Alguien nuevo del equipo, la primera vez:**
1. El dueño le da acceso de colaborador en GitHub.
2. Instala Node 20 o más nuevo, Git y Claude Code, y entra con su propia cuenta.
3. `git clone https://github.com/abrinay1997-stack/Agents-Office.git`.
4. Doble clic en `Agents-Office-Abrinay.bat`: instala las librerías la primera vez y abre la oficina ya como PanaClaw.
5. Para el Estudio usa sus propias keys (en variables de entorno de Windows) o el motor gratis «Prueba».

## Plan y pendientes (al 24 sep 2026)

**Hecho:**
- Fase 0 de Anuncios de Meta (8 oct 2026, rama `mejora/meta-fase-0`), primera del plan `docs/plan-meta-anuncios-y-bandeja-2026-10-09.md`: **Graph v26.0** con su tabla de caducidad (`contenido/meta.mjs → VERSIONES`, aviso en `npm run check`), el alcance de Facebook en `page_total_media_view_unique`, el **freno por uso** en el cliente (`pedir`, `leerUso`, `meta.uso()`), **un solo Meta de mentira** (`tests/meta-stand.mjs`, también Marketing API y Bandeja), **Ajustes → Anuncios** (ids y topes), los permisos **por función** (`faltanPor`) y Estado con «Anuncios» y «Mensajes de Meta». Ver «Meta: versión, freno y Meta de mentira».
- F4 de Contenido y la revisión de control (9 oct 2026, rama `claude/trusting-noether-akn71m`), pedido del dueño: «vamos con el F4 y necesito revisar que Dimitri y los agentes sepan y puedan controlar el calendario y tareas… aunque se use cualquier IA». **F4:** lo publicado enseña al Cerebro (las notas que usó el agente que escribió una pieza se acercan o se alejan según cómo le fue) y el informe del lunes habla de las redes. **Control:** Dimitri gana 9 cambios (rutinas enteras, prioridad y fecha límite, tus tareas, repetir, llenar la semana) y ve el calendario de tareas, cómo sale lo publicado y la semana de redes; los agentes leen rutinas, lo publicado con cifras y los huecos; **cualquier IA tuya** se conecta con `oficina-mcp.mjs`; 8 fallos arreglados (tus tareas ya no se mueven ni se cancelan como las de un agente, un agente no reescribe lo que espera tu OK…). Ver «Control de la oficina: Dimitri, los agentes y tu IA», `docs/auditoria-control-dimitri-agentes-2026-10-09.md` y `docs/conectar-ia.md`.
- Lo que faltaba de C2 y el C3 de Contenido (8 oct 2026, rama `claude/trusting-noether-akn71m`), pedido del dueño: «haz lo que falta de C2 y C3». **Lo ya publicado en el calendario con sus cifras** (Analíticas emparejado con la pieza; lo publicado a mano como tarjeta de solo lectura, filtro «Publicado fuera»), **las mejores horas de una red**, **la zona horaria** y **la cuota de Instagram** con Meta directo; **«Llenar la semana»** (huecos con su mejor hora: borrador de Marketing o **algo que vuelve**, sin repetirse en 8 semanas) con «Borradores de la semana» en Programación; **plantillas** como notas del Cerebro; **`/contenido` en Telegram** con la foto y ✅ Aprobar. Ver «Lo publicado, Llenar la semana, plantillas y el teléfono (C2 y C3)». Recorrido: `node scripts/c3-contenido-recorrido.mjs`.
- C1 y C2 de Contenido (8 oct 2026, rama `claude/trusting-noether-akn71m`), pedido del dueño tras comparar con Metricool: **el editor de la pieza se escribe primero** (formato por red, un solo cuadro con los archivos y la barra: emoji, hashtags, comentario, enlace, textos guardados y «✨ Mejorar con Marketing»; «Editar por red»; lo de cada red plegado; «N problemas» arriba; al pie cuándo sale y «Aprobar ▾» con «Publicar ya»; vista previa teléfono/computadora) y **las tarjetas** (texto bajo el título, «+N», el formato de la red distinta, la vista previa al pasar). El editor va en su propio paquete. Ver «El editor de una pieza (C1 y C2)». Recorridos: `node scripts/editor-contenido-recorrido.mjs` y `node scripts/tarjetas-contenido-recorrido.mjs`.
- F3 de Contenido (8 oct 2026, rama `claude/trusting-noether-akn71m`), pedido del dueño: **publicar directo con Meta**, sin Metricool (Ajustes → Contenido → «Meta directo»). Facebook queda programado en Meta y sale solo; Instagram no se puede programar por API y lo publica la oficina a su hora (la computadora encendida; hasta 30 min tarde todavía sale). Ver «Publicar en redes» y `docs/conectar-meta.md`. **Falta probarlo con el token real:** `node scripts/check-meta-publicar.mjs` (no publica nada).
- Revisión del plan D (8 oct 2026, rama `claude/trusting-noether-akn71m`), pedido del dueño: **Delegadas** ya no da por hecho lo que el agente no pudo hacer; el **calendario** vuelve a leer TUYAS al abrirse y cada 30 s; **«PARA MÍ»** en la ventanita del día del calendario y en el panel de tareas (T), con la línea **«Lo tuyo hoy · N»**; **Hoy** con las vencidas aparte y **Próximos 7 días** con un título por día; **Estado de la oficina** pasa a ser la primera pestaña de Ajustes (O), con su luz en el engranaje. Recorrido: `node scripts/lo-tuyo-recorrido.mjs`.
- Plan D (7 oct, rama `claude/happy-ritchie-0xmqaa`), pedido del dueño: **sus propias tareas**, al estilo TaskView, que conviven con las de los agentes. La pestaña **Mías** de Tareas (Bandeja, Hoy, Próximos 7 días, Todas, Delegadas, Hechas y sus proyectos; casilla redonda, «+ Añadir tarea», COMPLETADAS · N y tablero Por hacer · Haciendo · Hecha), **delegar** a un agente o a una persona, **«Lo hago yo»** con la tarea de un agente, los agentes ven lo suyo como «DEL DUEÑO» y le **sugieren** cosas, Dimitri le asigna piezas, la capa TUYAS del calendario y `/mias` · `/yo` en Telegram. Ver «Las tareas del dueño (plan D)» y `docs/analisis-tareas-del-dueno-2026-10-07.md`.
- V5.1 (2 oct, rama `mejora/estudio-modos`, en local), pedido del dueño tras probar el banco: la imagen del Estudio tiene **Básico** (el compositor de siempre; el banco ni se descarga) y **Avanzado** (los presets y el escenario 3D), un interruptor en el paso 1 que se recuerda (`ao.st.modo`); B y «/» pasan a Avanzado. Fuera «Para dónde va» (el formato lo eliges tú en «Formato y ajustes» y el cuadro del escenario 3D lo sigue), «Qué hará» y «Resultado» (lo hecho va solo a la galería; antes se acumulaban). **El modelo y el formato siempre a la vista y siempre los tuyos**, también con presets; si ese modelo no puede con la receta, el motivo sale junto a GENERAR y no se genera.
- V5.0 (2 oct, rama `mejora/dimitri-estudio`, en local), el **banco de presets** del Estudio: 127 de imagen + 53 de video (datos), local antes que IA con `sharp`, el **escenario 3D**, los presets propios como notas del Cerebro, **lotes** con seguimiento, Dimitri y los agentes. Ver «Banco de presets del Estudio» y `docs/propuesta-banco-presets.md`. **Falta:** la pantalla de video del banco (F5) y música/voz (F6), y probar con keys reales.
- V4.11 (1 oct, misma rama, en local), auditoría despiadada del diseño: `docs/auditoria-diseno-2026-10-01.md` (126 hallazgos; los 6 críticos y 38 de 41 altos arreglados; cada punto con su estado). Contenido con tarjetas que dicen qué sale cada día, cola por día y previsualizaciones por red y formato; Dimitri con preguntas en opción múltiple y cambios del calendario con un clic; el asistente de clonar voz en tres pasos; accesibilidad y rendimiento. **Al tocar un área, mira primero sus pendientes en ese informe.**
- V4.10 (1 oct, misma rama, en local), MiniMax en el Estudio, pedido del dueño: imagen, video H3, voz, música, y voces propias (diseñar, y clonar grabando con el micrófono o subiendo un fragmento). Se comprobó contra la doc oficial (`docs/minimax/api-verificada.md`). Ver «MiniMax en el Estudio (V4.10)».
- V4.9 (30 sep, rama `mejora/dimitri-estudio`, todavía en local), Dimitri maneja el Estudio, pedido del dueño. Se construyó con cuatro equipos de agentes en paralelo (worktrees) más revisión adversarial; ver la sección «Dimitri y el Estudio (V4.9)»:
  - el modo «estudio»: un plan de creativos con su costo y GENERAR;
  - imágenes en su chat, que ve con la visión de Claude;
  - el panel al lado de cada vista, con S y el chip «Viendo»;
  - el visor que no corta, con zoom y F;
  - Editar como versión nueva;
  - notas y memoria de cada creativo;
  - «Pedírselo a Dimitri» y «Mandar a un departamento».
- V4.6 (27 sep, rama `mejora/cerebro-3d`), el Cerebro y su memoria, pedido del dueño:
  - El logo lleva a la vista general (cierra la vista, Dimitri y el departamento, y la cámara vuelve).
  - **Cerebro 3D** (`src/brain3d.js`, three.js): notas = neuronas, `[[enlaces]]` = sinapsis. Cada carpeta es un lóbulo (hemisferio y vecinos por afinidad de enlaces), los índices al centro y los detalles hacia la corteza. Gira solo y se para al tocarlo; nombres clicables; vista previa al pasar el cursor; «Explorar» a la izquierda (búsqueda, regiones, cuándo, quién, sinapsis, conexiones, vecindario, herramientas, lista de notas para el teclado); la ficha se oculta (⟩) o se cierra (✕) sin cerrar el Cerebro.
  - **Memoria** (`memory.mjs`, tras estudiar cognee, Graphiti, Mem0, HippoGraph, company-brain y Engram): menciones sin enlace, resúmenes, presupuesto de contexto, vecindario en la búsqueda y **sinapsis que aprenden** de lo aprobado o devuelto (`data/memory.json`).
- V4.5 (27 sep, rama `mejora/ajustes-y-navegacion`), pedidos del dueño:
  - Estudio, Calendario y Cerebro son **vistas** bajo la barra superior (`src/views.js`): una a la vez, la barra siempre a mano; otro icono (o E, P, G) cambia de vista; el nombre de la empresa vuelve a la oficina; el Cerebro tiene su icono en el dock.
  - Ajustes gana **Apariencia** (Claro por defecto, Oscuro, Automático; se recuerda en el navegador, `ao.theme`) y **Atajos de teclado** (la lista que abre «?»). Fuera el botón de teclado del dock y la tecla D.
  - Abrir a Dimitri acerca el centro junto a su chat; el Cerebro y Dimitri crecen al acercarse (antes se achicaban).
  - Estudio: «Usar de referencia» en la fila de cada tarjeta; **Ajustes → Estudio** con el tope al día (0 = sin tope) y gasto máximo en US$ al día y al mes (`media.dailyBudget`, `media.monthlyBudget`), aplicado al instante.
- V4.4 (25 sep, misma rama): la auditoría de negocio (`docs/auditoria-negocio-2026-09-25.md`, 100 puntos): los 69 que marcó el dueño, hechos en seis tandas (seguridad y tests, confiabilidad, Telegram y disparadores, costos, aprobaciones y calidad, conocimiento y equipo). A1 (inicio de sesión) queda como issue #2.
- V4.3 (25 sep, misma rama): la auditoría profunda (`docs/auditoria-profunda-2026-09-25.md`): los 30 errores de accesibilidad visual más críticos, arreglados; axe pasa de 8 fallos críticos, 226 controles anidados y 244 contrastes bajos a 0. Anillo de foco en todos los campos, lo pausado y saltado se lee (sin atenuar), objetivos de 24 px, nada bajo 10,5 px, el Estudio cabe a 320 px, el Cerebro y Dimitri siempre legibles. Regla nueva: un botón nunca va dentro de otro elemento con rol de botón; si una fila tiene sus propios botones, el que la abre es su título.
- V4.2 (24–25 sep, misma rama): la auditoría del Estudio y del Calendario (`docs/auditoria-estudio-calendario-2026-09-24.md`, 98 puntos): los 98 arreglados (A30 en parte). Lo principal:
  - Calendario: semana y día con horas de 00 a 24 y una línea de «ahora»; el mes a una línea por evento; fechas en español; arrastrar con el dedo; el enrutador ya no pierde una tarea; la AGENDA (tecla A, la vista del teléfono); las ejecuciones pasadas de cada rutina (hecha ✓, falló ⚠, saltada, no corrió); la ventanita de la rutina con el título entero y todas sus acciones a la vista; cancelar una tarea o eliminar una rutina sin pregunta, con DESHACER 8 segundos; los días de una rutina como siete botones (L M X J V S D); mover una ejecución pregunta «solo esta vez» (se salta y queda una tarea en su lugar, mismo agente) o «siempre»; lo que está en marcha va en una franja «SIN TERMINAR»; los avisos salen abajo, junto al trabajo; las cifras filtran; la semana puede empezar el domingo y dice su número; las rutinas se buscan y van por departamento (clic las abre, 👁 muestra solo sus días); la búsqueda lista resultados con fecha; el botón Rutinas en el teléfono; «Suscribirme (.ics)» (`/api/calendar.ics`).
  - Estudio: la galería en orden por filas y sin redibujarse; el error junto al campo; el resumen del formato en el pie; ayuda cuando falta una key; pestañas en el teléfono; en cada tarjeta ★, una acción con texto y el menú «⋯» (la papelera al final); «Mejorar el prompt» dice el idioma (en inglés con su traducción debajo, o en español); con el Estudio cerrado, lo que termina se avisa (número en la claqueta del dock y aviso con VER); cada trabajo en marcha dice cuánto suele tardar (la mediana de ese modelo) con una barra; «Cancelar» en un motor de pago pregunta en la tarjeta si se cobra igual; el visor ampliado dice «3 de 8» y tiene «Variar» (mismo prompt, la imagen como referencia); las imágenes de un mismo pedido en una sola tarjeta («Ver por separado», «Descargar las N»); la galería separada por días; la imagen de un agente dice para qué tarea fue y la búsqueda encuentra por agente y por tarea; todos los modelos a la vista (los sin key atenuados, con cómo activarlos); «Una idea / Varias ideas»; aviso de costo desde US$0,50; «Nuevo»; el mismo pedido dos veces pide un segundo clic; subidas con porcentaje; pestañas con número; Historial de trabajos; compositor plegable; atajos (Ctrl+Enter, /, I, V) en la hoja «?».
- V4.1 (24 sep, rama `claude/gracious-pascal-aryw2d`):
  - el centro de la oficina sin la red neuronal: solo el icono del Cerebro y Dimitri;
  - los 31 ⏳ de `docs/auditoria-ux-2026-09-24.md`: aprobaciones por borrador, ARCHIVADAS con DESHACER, trampas de foco (`src/modal.js`), hoja de atajos «?», teclado, papelera de notas, tablet;
  - la auditoría visual de 50 puntos (`docs/auditoria-visual-2026-09-24.md`), con 37 aplicados: tarjetas compactas y encuadre en pantallas estrechas, contraste AA en oscuro, landmarks;
- motor único en el servidor;
- Estudio V2 (41 modelos, Higgsfield, trabajos en segundo plano, Animar);
- barra superior V4 con dock de herramientas;
- Dimitri con sus cinco modos;
- filtros y búsqueda del Cerebro;
- calendario con rutinas en los seis departamentos;
- ficha del agente;
- auditoría de 100 puntos: los 100 arreglados.

**Siguiente, en este orden:**
0. **PRIMERO — Anuncios de Meta y la Bandeja con Meta (plan del 9 oct 2026):** el encargo completo, con el prompt de arranque, está en **`docs/plan-meta-anuncios-y-bandeja-2026-10-09.md`**. Es un panel propio de Anuncios (ver, pausar, relanzar, crear campañas en pausa con creativos del Estudio, impulsar lo publicado, la IA que propone mejoras) y la Bandeja con los comentarios y los mensajes privados de Instagram y Facebook. Fases en su §6. **La Fase 0 está hecha (8 oct 2026)**; sigue la **A1** (ver: el panel de Anuncios en solo lectura). **Regla del dinero (§3): nada que gaste ocurre sin dos clics del dueño ni por encima de sus topes; ni los agentes ni el asistente por MCP pueden gastar.** Lo que tiene que conseguir el dueño en Meta (verificación del negocio, cuenta publicitaria, permisos, acceso avanzado para los mensajes) está en su §2.
0. **Auditoría del Estudio de imagen (6 oct 2026):** `docs/auditoria-estudio-imagen-2026-10-06.md`. Son 53 puntos (4 críticos) y un plan en 7 fases. **La Fase 1 está hecha (6 oct):** Variar es un pedido propio con su costo, lo que carga el compositor ofrece DESHACER (`src/studio-borrador.js`), los errores del proveedor se leen en español (`media/errores.mjs`), el precio va en GENERAR y Avanzado ya no se contradice. **La Fase 2 también (6 oct):** una sola lista de acciones por archivo (`src/studio-acciones.js`), la ficha de un pedido con las acciones de cada imagen, lo nuevo marcado, «Vaciar» con DESHACER, la barra de la galería en una fila («Mostrar ▾», carpetas, «⋯» con Historial, Papelera y Motores), «Voces» solo en Voz, y el teléfono más compacto. **Fase 3 (6 oct):** tokens de letra y radios (`src/css/componentes.css`), confirmar un gasto con un segundo clic (`src/studio-confirmar.js`), el día cuenta archivos, Animar con su icono. **Fase 4 (6 oct):** los atajos de una tecla se apagan en Ajustes → Atajos de teclado (`src/teclas1.js`, compartido con el paquete aparte en `build-extra.mjs → COMPARTIDOS`): un atajo nuevo de una letra debe respetar `ignorar(e)`. **Fase 5 (6 oct):** el Básico de imagen (`#studioOv.st-basico`) es la idea primero, «Automático» (`src/studio-auto.js`), «Formato» y «Cantidad» como selectores, «Imagen» junto a la idea y la mejora como propuesta en español: 14 controles. **Fase 6 (6 oct):** Avanzado tiene un solo Material (las referencias pasan al banco y vuelven al salir), el banco va al lado de la galería desde 1100 px, Comparar (`src/studio-comparar.js`: 2–4 seleccionadas o una versión con su original), la semilla en los modelos que la documentan, plantillas como notas del Cerebro (`plantillas.mjs`, `<cerebro>/Estudio/Plantillas/`, `/api/media/plantillas`) y B avisa que pasó a Avanzado. **Fase 7 (6 oct):** Variar se queda en el visor, Repetir/Animar/Usar de referencia dejan «VOLVER A LA IMAGEN» (`desdeVisor`), «Plegar» con icono, la barra fija del visor en el teléfono y microinteracciones que respetan «reducir movimiento». Quedan en parte IMG-24 e IMG-45. **Después, pedido del dueño (6 oct):** en la tarjeta, Usar de referencia, Descargar y la papelera van a la vista (`fila` de `src/studio-acciones.js`; el «⋯» ya no las repite y Editar/Variar se quedan en su icono en una tarjeta angosta); los dos paneles se ensanchan arrastrando su borde (`src/studio-paneles.js`: compositor 420–760 px, banco/escenario 460–1100; lo de siempre es lo más angosto; teclado ← →, Inicio, Fin; doble clic vuelve; se recuerda en `ao.st.izq` y `ao.st.der`) y el derecho se **oculta** sin cerrarse (pestaña al borde) o va a **toda la ventana**; en Básico formato, tamaño/calidad y cantidad son botones a la vista (también la calidad en Avanzado: `CALIDAD` en `src/studio.js`). Al tocar el compositor, la galería o el visor, mira antes sus puntos. Para medir: `node scripts/estudio-imagen-recorrido.mjs` (con `AO_AXE=<axe.min.js>` para pasar axe).
0. **Redes sociales más allá de Metricool (6 oct 2026):** `docs/analisis-metricool-cli-2026-10-06.md` analiza metricool-cli y propone un **conductor de publicación** (simulacro · Metricool · Meta) detrás de nuestra cola y aprobaciones, en fases M0–M5. El dueño dijo «mejora todo»: se asumió simulacro por defecto, Metricool como conductor real, las nueve redes y la bandeja con su OK. **Hechas M0 a M5** (ver «Publicar en redes»; de M5 quedan fuera competidores, hashtags y smart links). Lo primero con la key real del dueño: `node scripts/check-metricool.mjs` (solo crea y borra un borrador) y anotar en el análisis qué rutas «por verificar» respondieron.
0. **Tareas a otro nivel, ideas de TaskView (6 oct 2026):** `docs/analisis-taskview-2026-10-06.md` (**su licencia prohíbe productos competidores: solo ideas, nada de su código**). El dueño dijo «empieza con todo»: **hechas T0 a T6** (ver «Tareas»). Queda por probar con agentes de verdad (Claude real) que marquen pasos y pidan bloqueos, y ajustar la skill de cada departamento si hace falta; los webhooks con un Zapier de verdad.
0. **Las tareas del dueño (7 oct 2026):** hechas (ver «Las tareas del dueño (plan D)»). Queda probar con agentes de verdad que lean «DEL DUEÑO» y usen `sugerir_al_dueno` con mesura; lo pendiente está en el §5 de `docs/analisis-tareas-del-dueno-2026-10-07.md`.
0. **La Biblioteca de marketing (7 oct 2026):** las 50 skills de marketingskills adaptadas (ver «La Biblioteca de habilidades» y `docs/analisis-marketingskills-2026-10-07.md`). Falta correr los evals con Claude de verdad (`node scripts/evals-skill.mjs plan-marketing --correr`) y decidir si se generalizan los puestos de Marketing de fábrica.
0. **Probar Meta directo con el token real del dueño (8 oct 2026):** `node scripts/check-meta-publicar.mjs` (y `--video`, `--facebook`); anotar en el §17 de `docs/propuesta-contenido-y-meta.md` lo que respondió y quitar los «POR VERIFICAR» de `contenido/meta-publicar.mjs`.
0. **Contenido mejor que Metricool (8 oct 2026):** `docs/analisis-editor-contenido-2026-10-08.md`. Hechos C1, C2 y C3. Falta probarlo con cosas de verdad: «Llenar la semana» y «✨ Mejorar con Marketing» con Claude real (ajustar el brief o la skill del puesto de redes si hace falta), el emparejamiento de lo publicado con lo que Meta devuelve de verdad (el enlace de la cola contra el `permalink` de Analíticas) y `/contenido` con un bot de Telegram real (la foto por `sendPhoto`).
0. **Probar el control con otra IA (9 oct 2026):** Dimitri con Meta Muse Spark de verdad (opción 2 del iniciador): que use «plan» con cambios cuando el dueño dice «pausa los cobros» y no invente ids; y `oficina-mcp.mjs` con Claude Desktop en Windows (`docs/conectar-ia.md`). El MCP remoto (ChatGPT, Meta AI web) espera al issue #2.
0. **Probar MiniMax con la key real del dueño:** `node scripts/check-minimax.mjs` (con `--video` y `--music`) y luego una clonación grabando desde el panel «Voces». Ajustar los precios marcados «aproximado» con su primera factura.
1. Las 13 recomendaciones 💡 de `docs/auditoria-visual-2026-09-24.md`. Casi todas son decisiones de diseño del dueño. Las que más cambian el día a día:
   - el tamaño de los nombres de los agentes en la vista general (8);
   - una agenda en lugar de la cuadrícula del calendario en el teléfono (38);
   - el punto rojo que parpadea en las tarjetas (9).
2. Probar el Estudio con una key real: Higgsfield `HF_KEY`, Nano Banana `GEMINI_API_KEY` o fal.ai `FAL_KEY`.
3. Las mejoras que el dueño vaya pidiendo. Una herramienta nueva entra como un botón más en el dock de la barra superior (ver «The top bar»).

**Reglas de la interfaz (V4.1):**
- Toda ventana modal nueva llama a `modal.open(el)` al abrirse y a `modal.close(el)` al cerrarse (`src/modal.js`). Mientras está abierta, el resto de la página queda inerte y Tab da la vuelta dentro de ella.
- (V4.5) Estudio, Calendario y Cerebro no son ventanas encima de la oficina sino **vistas** debajo de la barra superior (`top: 52px`, atributo `data-view`): una a la vez. Una vista nueva lleva `data-view`, se registra con `views.add(nombre, { isOpen, close })` y llama a `views.opening(nombre)` al abrirse (`src/views.js`); su `close({ quiet: true })` no devuelve el foco. Con una vista arriba, `modal.js` deja la barra (`[data-shell]`) fuera de lo inerte. Una ventana de verdad (Ajustes, Estado…) sigue bloqueándolo todo.
- Todo atajo nuevo va también en la lista `KEYS` de `src/main.js`, que se ve en Ajustes → «Atajos de teclado» (tecla «?»).
- (V4.6) Todo lo que se pueda clicar sobre un lienzo se busca en coordenadas **del lienzo** (`clientX − rect.left`), nunca de la página, y con tolerancia de dedo (16 px ratón, 26 px táctil). Un clic que se mueve más de 5 px (10 táctil) es un arrastre.
- Los colores nuevos pasan 4,5:1 en claro y en oscuro.
- El anillo de foco usa `var(--focus)`, también en los campos de texto (un borde más oscuro no basta).
- Nada se atenúa con `opacity` para decir «pausado» o «saltado»: el texto debe seguir a 4,5:1.
- Todo objetivo mide 24 px o más (o está a 24 px de centro a centro del siguiente); ningún texto baja de 10,5 px.
- Nada que se vea en la oficina depende del ancho de la ventana sin probarlo a 390 px (teléfono), a 1024 px y a 1512 px.
- (V4.9) **Una vista puede ser más estrecha que la ventana:** Dimitri es un panel fijo a la izquierda y la vista abierta se corre (`body.subOpen :is(#studioOv,#calOv,#ctOv,#anOv,#brainOv){left:var(--subW)}`, `src/css/dimitri.css`). El estilo estrecho de una vista va con `@container` sobre la propia vista, no con `@media` de la ventana (ejemplo: `src/css/vistas-ancho.css`). Una vista nueva se registra en esa regla y se prueba con Dimitri abierto a 1024, 1366 y 1512 px.
- (V4.9) `build.mjs` junta `src/css/*.css` **por orden alfabético**: un archivo que corrige a otro debe ir después en ese orden (por eso `vistas-ancho.css` se llama así).
- (V4.9) Una vista nueva expone `selection()` → `{view, label, kind, id?}` para el chip «Viendo» de Dimitri, y se añade a `getContext` en `src/main.js`. Lo que cambia la galería fuera del Estudio dispara `ao:media-changed` (el Estudio abierto se refresca).

## Changing the agents

The roster lives in `office.agents.json` (shipped defaults) and `office.agents.local.json` (the owner's copy, ignored by git). **Always write to `office.agents.local.json`**: if it does not exist, create it with `{"agents": []}` and add only the agents you are changing. Never edit `office.agents.json` unless asked to change the shipped defaults.

Each agent looks like:

```json
{ "id": "newt", "department": "marketing", "lead": false,
  "name": "NEWSLETTER", "role": "Newsletter Creator Agent",
  "does": "Writes the monthly newsletter your signups actually open.",
  "tools": ["beehiiv", "loops"],
  "brief": "Five bullets and a pull quote. Subject lines under 40 characters. Never open with the company name." }
```

You may change **name, role, does, tools, brief, model**. Keep `name` short and upper case (it is the label on the desk). `does` is what the agent reads about itself before every task, so write it as a job description in one or two sentences. `tools` names the connectors this agent usually reaches for (match the names shown in the top bar, lower case). `brief` is the owner's standing instructions to that one agent, read before every task and chat turn: up to 2,000 characters, a string or a list of lines. Anything longer, or anything with steps and a template, is a skill (next section). `model` is `sonnet`, `opus` or `fable`, or empty for the office default (Sonnet); set it only when the owner names one — a task or a routine can still set its own above it. `effort` is `low`, `medium`, `high`, `xhigh` or `max`, or empty for the office's setting and then the model's own (Opus runs at high); same rule, same precedence.

The roster is read in this order, later wins: `office.agents.json` → `<brain>/Agents Office/agents.json` → `office.agents.local.json`. The brain is the folder named by `brain` in `office.config.json` (or `office.config.local.json`, which wins). If the owner keeps their roster in the brain, write there instead of the local file.

Fixed, and the office ignores edits to them: `id`, `department`, `lead`. There are **six departments and 35 seats** and that is the office. Do not add or remove agents, departments or pods. When the owner wants a new kind of agent, **rename a seat** in the right department. When they want fewer, leave the seat as is; an idle agent costs nothing.

Department keys: `emails` (5 seats) · `sales` (6) · `marketing` (7) · `ops` (6) · `fin` (4) · `delivery` (7). Every department has a lead (Emails, Sales, Marketing, Operations, Accounting, Delivery) and the lead stays the lead.

After editing: run `npm run check` (it validates the roster and prints every problem), then tell the owner to restart the office (`npm start`). Names, roles and descriptions update on the next page load.

## Teaching an agent how a task is done (skills)

When the owner says "this is how we do X", "make the agent do it this way", "here is our SOP / template / an example I was happy with", or asks why the deliverables are generic, the answer is a **skill**. A skill is a folder with a `SKILL.md` and the files beside it, the same shape as a Claude Code skill. Full guide: `SKILLS.md`. Read it once before writing your first one.

**Where to write it:** `<brain>/Agents Office/skills/<name>/SKILL.md`, where `<brain>` is the folder from `office.config.local.json` → `office.config.json` (`brain`, default `./brain`). Create the folders if they do not exist. Never write the owner's skills into the repo's `skills/` folder; that holds the shipped examples and `git pull` would fight them. A skill of the same name in the brain replaces a shipped one.

**Decide brief or skill first.** Fits in a paragraph with no steps and no template → a `brief` on the agent. Has steps, a shape, rules, or a document to copy → a skill.

**What you need before writing.** The trigger (which tasks this covers), the source material (an SOP, an example, the owner's description), the shape of the finished thing, and the rules. If the owner gave you a document, read it in full first. If one of these is missing, ask one question for it; do not invent the owner's process.

**The folder:**

```
<brain>/Agents Office/skills/proposal/
  SKILL.md       front matter + instructions (under 6,000 characters)
  template.md    the shape of the finished thing, headings kept
  example.md     one real one the owner was happy with (optional, strip anything private the owner did not hand you)
```

**SKILL.md:**

```markdown
---
name: proposal
description: How we write a client proposal
agents: [piper]
---
# Writing a proposal
Use this for any request that ends in a document a client says yes or no to.   ← the trigger, first line

## Before you write
1. …what to read first, by note name (`10-Business/offer-ladder.md`)…
## The shape
Follow `template.md` beside this file, section for section.
## Rules
- short, absolute, one per line
```

**Binding.** `agents: [id, id]` for one or more agents (ids from `office.agents.json`; pick the seat whose `does` matches, and say which one you chose). `departments: [emails]` for a whole department (`emails`, `sales`, `marketing`, `ops`, `fin`, `delivery`). Neither binds it to every agent; only do that for a house style, and say so. Unknown ids are refused and a skill with no valid binding is skipped.

**Limits the loader enforces:** `SKILL.md` body 6,000 characters; each file beside it 4,000, all files together 8,000. Readable files are `.md .txt .csv .json .yaml .html`; anything else is listed by name only. Long reference material goes into the brain as ordinary notes, which the agent reads when the task calls for them; the skill just names them.

**Writing rules.** The first line after the heading says when the skill applies. Steps, then shape, then rules. Point at notes by name. Rules are short and absolute. One skill per kind of work. Never put a number in a skill that should come from the numbers ledger; say where it comes from instead.

**After writing:** run `npm run check` (it lists every skill, its binding and every problem in plain sentences; fix what is red). Skills and briefs take effect on the next task with no restart. Tell the owner: the folder path, which agent it is bound to, and one task to type to try it. Suggest they read the result and send it back with `revise: …` from the chat; when a correction is one they will want every time, fold it into the skill.

**Reading skills back.** http://localhost:4520/api/skills (server running) or `node -e "import('./skills.mjs').then(async m=>console.log(JSON.stringify(m.loadSkills((await import('./config.mjs')).loadConfig().brainPath,(await import('./roster.mjs')).loadRoster().agents).summary(),null,1)))"`.

## La Biblioteca de habilidades (7 oct 2026)

Métodos de trabajo que **viajan con la oficina**, en español y para cualquier empresa. La primera colección es `biblioteca/marketing/`: las 50 skills de [marketingskills](https://github.com/coreyhaines31/marketingskills) (MIT, Corey Haines; licencia en `biblioteca/marketing/LICENCIA-marketingskills.txt`), adaptadas a la oficina. Análisis y decisiones: `docs/analisis-marketingskills-2026-10-07.md`.
- **Biblioteca o skill.** Una skill (`skills/`, `<cerebro>/Agents Office/skills/`) se lee ENTERA antes de cada tarea: es «cómo lo hacemos aquí». Una habilidad de la biblioteca se lee **cuando hace falta**: el agente ve el índice de las suyas (id, título, cuándo), la que encaja con la tarea se le adelanta entera (`biblioteca.elegir`) y el resto, con sus referencias, lo pide con `habilidades-mcp.mjs` (`ver_habilidades`, `leer_habilidad`; solo leen, `habilidades` va en `INTERNAL` de `safety.mjs`). Así 50 métodos de 10–20 páginas no llenan cada ejecución.
- **Lo de la empresa no va en la biblioteca:** va en el Cerebro. La nota `contexto-marketing` (posicionamiento, cliente ideal, problemas, competencia, diferencias, objeciones, por qué cambian, palabras del cliente, voz, pruebas, objetivo) es la base de todas: la ven entera los agentes que tienen habilidades (`contextoMarketingText` en `serve.mjs`). La crea **Ajustes → Preparar desde mi web** (`00-Empresa/contexto-marketing.md`) o la habilidad `contexto-marketing`. Los precios, de las cifras.
- **Formato** (`biblioteca.mjs`, validado en `npm run check` y `tests/biblioteca.test.mjs`): `biblioteca/<colección>/<id>/SKILL.md` con cabecera `name` (= la carpeta) · `titulo` · `description` («Úsala cuando…», ≤400) · `area` (estrategia · contenido-y-texto · seo · conversion · pagados-y-medicion · crecimiento-y-retencion · ventas-y-gtm · canales) · `departments` · `agents` · `origen` · `palabras` (opcional, para elegir mejor); `referencias/*.md` (lo largo, ≤30.000 cada una) y `evals.json` (`node scripts/evals-skill.mjs <id> [--correr]`). Las «Habilidades relacionadas» nombran ids que existen.
- **Del dueño:** `<cerebro>/Agents Office/biblioteca/<id>/` gana a la de la oficina con el mismo id (y viaja por GitHub con el equipo); una skill del dueño con el mismo nombre la reemplaza (y esa sí se lee siempre). Cuando el dueño diga «adapta la habilidad X a nuestro negocio», copia la carpeta a su Cerebro y edítala allí; nunca edites la de `biblioteca/` para una sola empresa.
- **Dónde se ve:** la ficha de cada agente (✎) tiene «Biblioteca de habilidades» (las de su puesto y las de su departamento, con su texto al abrirlas). El enrutador ve los métodos atados a cada puesto. API: `GET /api/biblioteca[?agente=&buscar=]`, `GET /api/biblioteca/<id>[?referencia=]`.
- **Una colección nueva** (ventas, finanzas…) es otra carpeta en `biblioteca/` con el mismo formato.

## Lessons and the set-up interview

Two more things the office writes into the brain on its own. Both are plain files you may edit when the owner asks.

- **Corrections** — `<brain>/Agents Office/feedback/<agent-id>.md`. Every `revise: …` the owner sends lands here, sorted into "## Standing rules" (read by that agent before every task) and "## One-offs". One line each, `- date · rule ← "what the owner said" (task)`. When the owner says "fold the lessons into the skill", "make that a rule", "forget that", or "the agent keeps doing X": read this file, move the durable preferences into the agent's skill (or its `brief` if there is no skill) as short absolute rules, and delete the lines you moved so they are not said twice. Never invent a rule the owner did not give.
- **The interview** — the department lead's chat runs it when the owner says "set up" (`onboard.mjs`). It writes briefs into `<brain>/Agents Office/agents.json` and one skill into `<brain>/Agents Office/skills/<name>/`. An earlier skill of the same name is kept beside it as `SKILL.md.backup-<time>`; if the owner asks you to tidy up, merge what is worth keeping and delete the backup. `data/interviews.json` holds an interview in progress; delete it if one is stuck.

## Routines: tasks on the office's own clock

When the owner says "every Monday …", "each morning …", "on a schedule", "automatically at …", "make X happen every …", that is a **routine**: a task the office fires by itself at that time and runs without anyone typing. **Every department** can have routines (`emails`, `fin`, `sales`, `marketing`, `ops`, `delivery` — since 24 Sep 2026; the first release had three). One run can be skipped without pausing the routine: SALTAR ESTA in the calendar (P), or `POST /api/routines/<id>/skip {"at": <ms>}`.

**Where:** `<brain>/Agents Office/routines.json` (`<brain>` as above). Create it with `{"routines": []}` if it does not exist. Never write routines anywhere else.

```json
{ "id": "overdue-reminders", "dept": "fin", "agent": "invo",
  "title": "List the overdue invoices and draft the reminders",
  "text": "List the overdue invoices and draft the reminders. Xero read, Gmail drafts.",
  "when": { "kind": "weekly", "days": [1], "at": "09:00" },
  "needsOk": true, "paused": false }
```

- `id` short, unique, lower-case. `dept` one of the six. `agent` an id from the roster in that department; pick the seat whose `does` matches, and say which one you chose.
- `text` is what the agent is asked to do, written as the owner would type it. `title` is the card on the board (under 90 characters).
- `when`: `{"kind":"daily","at":"HH:MM"}` · `{"kind":"weekdays","at":"HH:MM"}` · `{"kind":"weekly","days":[1,4],"at":"HH:MM"}` (0 = Sunday) · `{"kind":"monthly","day":15,"at":"HH:MM"}` (`day: -1` = the last day) · `{"kind":"monthly","nth":2,"weekday":2,"at":"HH:MM"}` (the second Tuesday; `nth: -1` = the last) · `{"kind":"hourly","every":1,"from":"09:00","to":"17:00","weekdaysOnly":true}` · `{"kind":"minutes","every":2}` (filming only). Times are the machine's local clock, 24-hour.
- `when.end`: `"YYYY-MM-DD"`, optional (plan T5, 6 Oct 2026) — nothing fires after that day («until 30 November»). `when.count`: N, optional — N runs and it stops («6 times»); the calendar and `/api/routines` say `terminada`.
- `when.start`: `"YYYY-MM-DD"`, optional (V3.2.1) — the routine starts on that date and never fires before it ("from next Monday", "starting 5 October"). Leave it out to start now. The owner can also set one by clicking a day in the calendar (P) with REPEAT on.
- `needsOk` (default true): the result waits in WAITING ON APPROVAL for the owner's tick before the agent sends, pays or changes anything. Leave it on unless the routine only reads and reports (a triage, a list, a reconciliation), and say which you chose and why.
- `paused: true` keeps it on the timetable without firing.
- `model`: `sonnet`, `opus` or `fable`, only when the owner names one; otherwise leave it out and the agent's or the office's model applies (the task beats the routine beats the agent beats the office).
- `effort`: `low`, `medium`, `high`, `xhigh` or `max`, only when the owner names one; otherwise the agent's, then the office's, then the model's own.
- `team: true` when the owner wants the whole department on it ("as a team", "get the team to …"): the department lead owns the routine (set `agent` to the lead's id; a specialist id is moved to the lead), plans the pieces when it fires, the desks work at once, the lead writes the final. Leave it out for a one-desk routine — a team costs two to four runs plus the lead's two.

The server re-reads the file every 20 seconds, so a routine lands without a restart; its next run is computed from the moment it is read. Run state (next run, last run) lives in `data/routines.json`, never in the brain file. After writing: run `npm run check` (it validates every routine and names every problem: unknown agent, wrong department, incomplete schedule, duplicate id), then tell the owner the title, the schedule in words, which agent has it, whether it waits for their OK, and that it shows under the SCHEDULED chip with a RUN NOW button to try it straight away.

## A task for a date (the calendar)

When the owner says "on Friday, …", "next Tuesday at 10, …", "on the 5th, …" for a one-off (not "every"), that is a **scheduled task**, not a routine. The office does these itself: the owner clicks the day in the calendar (P), or the page posts `{ "dept", "text", "at": <ms or ISO> }` to `/api/tasks`. There is no file to write for them (they live in `data/tasks.json`, state `scheduled`, fired by the server's clock); tell the owner to press P and click the day, and say what to type.

## Changing the connectors

The top bar shows the MCP servers **this machine's Claude Code** is connected to (`claude mcp list`). To add one: `claude mcp add …` or connect it in claude.ai; the office picks it up on restart. To decide what the agents may call, edit `office.config.json` (or `office.config.local.json`):

```json
"mcp": {
  "allow": [],
  "deny": ["Stripe"],
  "departments": { "Slack": ["emails", "ops"] }
},
"tools": { "web": true, "browser": true },
"teams": { "enabled": true, "max": 4 }
```

`allow` empty means every connected server. `deny` keeps a server in the bar but out of the agents' hands (`"Chrome"` works there too). `departments` says which pods a server is wired to; **unknown servers reach no pod** until they are named there (since the MCP audit of 1 Oct 2026; before, they went to all six). `tools.web` gives the agents web search. `tools.browser` (V3.2 (16 Sep)) gives them the owner's own Chrome through Claude Code's Chrome integration — the run starts with `--chrome` and gets the `claude-in-chrome` server (open tabs, read pages, fill forms on sites the owner is signed in to); it needs the Claude in Chrome extension paired to this machine (`claude --chrome` once) and the Claude Code login. The bar shows a Chrome tile wired to every pod. `teams` (V3.2 (16 Sep)) is Agent Teams: `enabled` shows the TEAM button and makes "as a team" mean it; `max` caps the desks (2–6, default 4).

**Reglas de la auditoría MCP (1 oct 2026, `docs/auditoria-mcp-2026-10-01.md`):**
- Un servidor de plugin («plugin:small-business:gmail») se nombra y se asigna por su último tramo: «Gmail» vale en `deny`, `allow` y `departments`, igual que el nombre bruto o el id. «- Not configured» es un hueco vacío, no un fallo.
- El plugin `telegram` es el canal personal del dueño con Claude: bloqueado para los agentes salvo que se nombre en `mcp.allow` o `mcp.departments`.
- **En la duda, envía:** `safety.kindOf` solo da «lectura» si el nombre de la herramienta lee y no cambia nada; un nombre desconocido cuenta como envío. Para corregir una herramienta concreta: `safety.toolKinds: { "*test-connection": "read" }` (read · write · cost). Nunca relajes la regla general para que pase una herramienta.
- Las del Estudio que gastan (`generar_*`, `analizar_video`, `transcribir_audio`) son «cost»: se permiten antes del OK y se bloquean con la política «nunca». «cost» solo vale para el Estudio: en `toolKinds`, un «cost» sobre otro conector cuenta como envío (y `npm run check` lo avisa).
- Un `browser_batch` solo lleva acciones de Chrome (otro servidor dentro del lote se bloquea), y lo que devuelve se revisa siempre en busca de órdenes escondidas, aunque el lote haga clic.
- El guardián solo deja llamar a los servidores que recibió esa mesa (`servers` en el JSON de la ejecución): un conector nuevo no llega a nadie hasta la siguiente comprobación.
- Cada ejecución de un agente arranca solo los servidores de su mesa (`--strict-mcp-config` + `--mcp-config` en un archivo temporal, con el mismo id de herramienta) cuando la oficina puede reconstruirlos exactos; si no (claude.ai, un comando de plugin, un `${VAR}`), carga todo como antes. `mcp.isolate: false` lo apaga.
- (9 oct 2026) El MCP de la propia oficina (`oficina-mcp.mjs`, para el asistente del dueño; sale en la barra como «agents-office») **nunca** llega a un agente, ni nombrándolo en `allow` o `departments` (`mcp.isOffice`): un agente con los controles del dueño saldría de sus reglas.
- `/api/mcp` contesta al instante (`discovering: true` mientras corre `claude mcp list`); un solo `claude mcp list` a la vez. Prueba visual: `node scripts/conectores-recorrido.mjs`.

Agents get only connected servers (plus web when enabled, plus the browser when enabled and paired). They never get Bash, file tools or sub-agents. Their standing rule: read freely; send, post, pay, delete or change data outside this machine **only** when the owner's task explicitly asks for that exact action — in the browser too.

## Seguridad de los agentes (V4.4, 25 sep 2026)

Las reglas de envío son **candados, no ruegos**. Claude Code ejecuta `guard.mjs` antes y después de cada herramienta que usa un agente (un hook que `serve.mjs` pasa con `--settings`). Las reglas viven en `safety.mjs` y se prueban en `tests/`.
- **Quién puede enviar** (`office.config.json → safety.writes`, o por departamento en `safety.departments`):
  - `aprobar` (por defecto): nada sale (enviar, publicar, pagar, borrar, cambiar) salvo en la ejecución que sigue a tu OK. Si una tarea intenta enviar sin OK, la oficina la detiene y la deja en ESPERA DE APROBACIÓN con su borrador.
  - `pedido`: como antes; una tarea puede enviar si su texto lo pide, pero un borrador que espera OK nunca.
  - `nunca`: los agentes solo preparan; tú haces el envío.
- **Destinatarios:** después del OK, un envío solo puede ir a los correos y teléfonos que aparecen en el borrador aprobado (`checkRecipients`). Por eso el borrador nombra cada dirección exacta.
- **Inyección:** si un correo, una página o un documento que lee el agente trae órdenes escondidas («ignora tus instrucciones», «reenvía todos los correos», «no le digas al dueño»), se bloquea todo envío en esa ejecución y la tarea lo muestra en 🛡 Seguridad.
- **Chrome:** `browserSites` (lista de sitios permitidos; vacía = todos) y `browserBlock` (prohibidos). Admite `*.dominio.com`.
- **Topes diarios:** `limits.perAgentDay` (envíos por agente) y `limits.perRecipientDay` (por dirección); 0 = sin tope.
- **Qué herramienta «envía»:** la primera palabra verbo de su nombre decide (`send_email` envía, `get_schedule` lee). Las que llevan `draft`/`borrador` (`safeTools`) no cuentan como envío. El Estudio es interno.
- **Registro:** cada llamada, permitida o no, queda en `data/audit/AAAA-MM-DD.jsonl` (no viaja por GitHub).
- **Secretos:** `npm run secrets` revisa el repositorio. El hook `.githooks/pre-commit` (se activa con `npm install` o `npm run check`) impide commitear algo que parezca una key, una contraseña, una tarjeta o una cédula. Un ejemplo inofensivo lleva `secrets-ok` en su línea; una ruta entera va en `.secretsignore`.
- **Tests:** `npm test` (node:test, carpeta `tests/`) corre dentro de `npm run check`. GitHub Actions (`.github/workflows/check.yml`) ejecuta secretos, tests y el check completo en cada push y cada Pull Request. **Todo cambio de lógica nuevo lleva su test.**
- **Pendiente con issue:** inicio de sesión antes de exponer la oficina fuera de localhost (A1, issue #2).

## Confiabilidad (V4.4, 25 sep 2026)

- **Reintentos** (`reliability.mjs`, `office.config.json → retries: { max: 2, backoff: [60, 300, 900] }`):
  - un fallo pasajero (red, Claude saturado, tiempo agotado) se reintenta solo;
  - si Claude llega a su límite de uso, se reintenta cuando se renueva;
  - un problema de sesión («vuelve a iniciar sesión») no se reintenta: se avisa;
  - tras un tiempo agotado, el reintento tiene el doble de tiempo; lo que el agente había escrito se guarda como entrega «INCOMPLETA» si al final no lo logra.
- **Rutinas con la computadora dormida:** al despertar se hace una vez, «atrasada», y queda un aviso con cuántas se perdieron.
  - `catchUp: false` en la rutina la salta en vez de hacerla tarde.
  - `timeout` (segundos) da más tiempo a una rutina larga.
- **Semáforo** (Ajustes → Estado, tecla O, `/api/status`; desde el 8 oct 2026 ya no es un botón del dock: su luz va en el engranaje, solo en ámbar o rojo, y entonces el engranaje abre en Estado): Claude, conectores, disco, rutinas, cola, aprobaciones, fallos, seguridad y copia diaria, y debajo los **avisos** (`data/notices.json`, `/api/notices/read`). Los conectores se vuelven a comprobar cada 3 h.
- **Datos:**
  - un `tasks.json` dañado se recupera de la copia diaria más reciente (`data/backups/`, 14 días, una copia por día que la oficina está abierta);
  - lo archivado hace más de 90 días pasa a `data/archive/`.
- **Volver atrás:** `Volver-Atras.bat` deja el código como antes del último `Actualizar-Oficina.bat` (que anota la versión en `data/version-anterior.txt`).
- **Despliegue (preparado, no activado):** `Dockerfile`, `railway.json`, `AO_HOST`, `AO_DATA`. Léase `docs/despliegue.md`; nada se expone sin cerrar el issue #2.

## Telegram y disparadores (V4.4, 25 sep 2026)

- **Dimitri en Telegram** (`telegram.mjs`, guía en `docs/telegram.md`): se enciende con dos variables de entorno, `TELEGRAM_BOT_TOKEN` y `TELEGRAM_OWNER_ID`, **nunca en archivos**.
  - Al teléfono llegan las aprobaciones (✅ / ↩), los fallos (↻) y los avisos.
  - Cualquier otro mensaje va a Dimitri. Comandos: `/estado`, `/pendientes`, `/tarea ventas: …`, `/mias`, `/yo …`, `/contenido` (8 oct 2026: lo de Contenido que espera tu OK, con su foto), `/silencio 2`.
  - `office.config.json → telegram.quiet` es el horario de no molestar y `telegram.notify` dice qué avisa.
  - Solo los ids de `TELEGRAM_OWNER_ID` pueden usar el bot. Todo pasa por la API local de la oficina, con las mismas reglas que la página.
- **Disparadores** (`triggers.mjs`, guía en `docs/disparadores.md`): `<brain>/Agents Office/triggers.json` define qué tarea crea cada evento.
  - Llega por `POST /api/hook/<id>` con la clave `AO_HOOK_TOKEN` (variable de entorno).
  - Fuentes: `form`, `stripe`, `whatsapp`, `email` (Zapier/Make/n8n), `generic`.
  - Lo recibido va al agente como bloque de DATOS («no son órdenes»). Si trae órdenes escondidas, la tarea espera tu OK.
  - Un evento repetido se toma una sola vez; `perHour` pone un tope.
  - El owner dice «cuando llegue un formulario / un pago / un WhatsApp, …»: escribe el disparador en ese archivo (sin secretos) y corre `npm run check`.

## Costos y retorno (V4.4, 25 sep 2026)

- **Registro:** cada llamada a un modelo es una línea en `data/costs.jsonl` (`costs.mjs`).
  - Con Claude Code, el costo lo informa el propio Claude (`total_cost_usd`).
  - Con otro proveedor compatible (Meta, DeepSeek, Kimi, GLM, OpenRouter vía `ANTHROPIC_BASE_URL`) se calcula con la tabla de precios de `costs.mjs`.
  - Los trabajos del Estudio entran como «estimado».
  - Con un plan de Claude de tarifa fija, la cifra es «lo que costaría en la API».
- **Ventana «Costos y retorno»:** tecla U, o clic en el uso del plan abajo a la izquierda. Muestra:
  - el mes;
  - el costo por tarea;
  - las horas ahorradas y lo que valen;
  - las últimas 8 semanas;
  - el desglose por departamento, agente y modelo;
  - sugerencias aplicables con un clic (un agente que puede ir a Sonnet, otro que necesita Opus, una rutina que nadie lee);
  - el CSV del mes para contabilidad (`/api/costs.csv?month=AAAA-MM`).
- **Configuración** (`office.config.json → costs`):
  - `monthlyBudget` en US$ (aviso al `alertAt`, 80 %; con `stopAtBudget: true`, no empiezan tareas nuevas al pasarlo);
  - `hourlyRate`: lo que cuesta una hora de una persona;
  - `minutesPerTask` por departamento; una rutina puede llevar su propio `minutesSaved`;
  - `prices`: precios propios.
- **Precios:** la tabla lleva fecha (`PRICES_AS_OF`) y sus fuentes. `npm run check` avisa cuando tiene más de 90 días; al actualizarla, usa las páginas oficiales de cada proveedor.

## Aprobaciones y calidad (V4.4, 25 sep 2026)

- **Aprobaciones** (`approvals.mjs`, `office.config.json → approvals`):
  - el detalle muestra «Lo que saldrá» (canal, destinatarios, asunto, importes, adjuntos) y el riesgo (alto, medio, bajo);
  - **Editar el borrador** a mano, sin otra ejecución;
  - al aprobar hay `undoSeconds` (30) para **Deshacer**, en la página y en Telegram;
  - historial de quién aprobó, editó, devolvió o deshizo, también en `data/audit/`;
  - **Aprobar todas** en el filtro «En espera» (dos clics);
  - recordatorio tras `remindAfterHours` (24) y caducidad tras `expireAfterDays` (7): no se envía nada;
  - todo importe mayor que `amountLimit` ($200) espera el OK siempre, aunque la tarea no lo pidiera; el guardián lo bloquea.
- **Autonomía que se gana:** tras `autonomyAfter` (20) aprobaciones seguidas sin cambios de una rutina, un aviso ofrece dejarla enviar sola. En la rutina: `"autonomous": true` en routines.json. Los importes grandes siguen esperando.
- **Aprobadores delegados:** `telegram.approvers { "<id de Telegram>": ["emails", "sales"] }` en `office.config.local.json`. Esas personas solo aprueban o devuelven lo de sus departamentos.
- **OK por acción, no por rutina:** con `safety.writes = aprobar`, una rutina con `needsOk: false` lee y trabaja libre, y solo lo que intente enviar queda esperando tu OK.
- **Calidad** (`quality.mjs`), sección «Calidad» de la ventana U:
  - puntaje por agente (una entrega usada tal cual vale 100; cada devolución resta 30; 👎 resta 50);
  - % aprobado a la primera, 👍/👎, y un aviso cuando un agente empeora tras cambiar su skill o su brief;
  - 👍/👎 en cada entrega; el motivo de un 👎 entra en sus lecciones.
- **Lo que hace cada agente:**
  - termina con «Fuentes:» (las notas o páginas que usó);
  - se revisa en silencio contra su skill antes de entregar;
  - en lo delicado (Finanzas, contratos, propuestas, facturas o importes grandes), el jefe del departamento revisa y el agente corrige una vez antes de que te llegue. Se configura en `quality.review`.
- **Historial de skills y briefs:** cada versión queda en `data/history/`. La ficha del agente tiene «Versiones de sus skills y brief» con **Volver a esta**.
- **Lecciones:** las repetidas se funden solas; con más de 15, un aviso propone pasarlas a la skill.
- **Enrutador:** cuando mueves una tarea a otro agente, se guarda en `data/routing.json`. El enrutador lee los casos parecidos antes de elegir.

## Conocimiento, equipo y negocio (V4.4, 25 sep 2026)

- **Ajustes** (tecla `,`, el engranaje del dock; `settings.mjs`, `src/settings.js`): lo que antes era JSON, en formularios que se explican. Guarda en `office.config.local.json` (en el check, `AO_LOCAL_CONFIG` lo apunta al sandbox). Los que llevan ↻ se aplican al reiniciar. Un campo nuevo es una línea en `settings.FIELDS`. Solo se envía lo que cambió (un número vacío conserva su valor por defecto). V4.5: dos pestañas del navegador, sin Guardar y también en la demo: **Apariencia** (tema) y **Atajos de teclado**.
- **Cifras de la empresa** (Ajustes): `<cerebro>/Agents Office/cifras.json`. Todos los agentes las leen antes de cada trabajo y las usan tal cual. Un precio o una comisión va aquí, nunca en una skill.
- **Voz de marca** (Ajustes): la nota `voice` del Cerebro; la leen todos.
- **Preparar desde mi web** (Ajustes, `POST /api/onboard/company`): el jefe de Operaciones lee la web y escribe `00-Empresa/{perfil,oferta,voz,faq,clientes,contexto-marketing}.md` (la última, desde el 7 oct 2026, es la base de la Biblioteca), instrucciones para cada jefe sin brief y cifras para confirmar.
- **Documentos al Cerebro** (`documents.mjs`): «⬆ Subir documento» en el Cerebro, o soltar el archivo encima. PDF, Word, Excel, CSV o texto (hasta 15 MB) se vuelven `<cerebro>/Documentos/<nombre>.md`. Se convierte en esta máquina. Un PDF escaneado se rechaza con la razón.
- **Memoria del Cerebro** (V4.6, `memory.mjs`, sin llamadas extra a un modelo; probada en `tests/memory.test.mjs`):
  - **Menciones:** una nota que nombra a otra (dos palabras o una de 7+ letras) sin `[[enlace]]` queda conectada igual (peso 0,35). Se dibujan como sinapsis tenues (`graph.extra`).
  - **Vecindario:** las 3 mejores notas de una tarea traen hasta 2 vecinas como **resumen** (`summary`: título, primera frase de cada sección, importes), castigando a las notas índice.
  - **Presupuesto de contexto:** las notas de una tarea caben en 9.000 caracteres; un pasaje casi igual a otro (Jaccard ≥ 0,8) no entra.
  - **Sinapsis que aprenden** (`data/memory.json`, de esta máquina): al terminar o votar una tarea, las notas de su línea «Fuentes:» se acercan al resultado (aprobada 1 · usada tal cual 0,75 · −0,25 por devolución · 👎 0) y la pareja citada junta refuerza su enlace (dorado en el Cerebro). Idempotente por tarea (un voto nuevo reemplaza al anterior). Sin uso vuelven a neutro (vida media 90 días). En la búsqueda: × 0,8…1,2.
  - `/api/brain` añade `extra` (menciones) y `learned` (pesos y enlaces aprendidos: solo en vivo, nunca en `src/braingraph.js`).
- **Búsqueda del Cerebro** (`knowledge.mjs`): por pasajes (BM25), y por significado si hay `GEMINI_API_KEY`, `OPENAI_API_KEY` o `VOYAGE_API_KEY` (vectores en `data/embeddings.json`). El agente recibe los párrafos que importan. Una nota con `actualizado:` de más de 180 días (o sin tocar ese tiempo) llega con aviso de «puede estar vieja» y sale en «Notas que conviene revisar».
- **Mismo cliente:** antes de trabajar, el agente ve lo que otros departamentos hicieron con ese cliente en los últimos 30 días.
- **Ejemplos:** «⭐ Guardar como ejemplo» en una tarea terminada. Se guarda en `<cerebro>/Agents Office/ejemplos/<agente>/`; el agente los lee antes de trabajar.
- **Personas del equipo** (Ajustes → Equipo: nombre, Telegram, departamento):
  - una tarea puede **pasarse a una persona**: los agentes no la tocan y la persona recibe un aviso por Telegram;
  - el agente también puede pasarla, escribiendo `PASAR A UNA PERSONA: <nombre> — <por qué>`;
  - **comentarios** en cada tarea; `@nombre` avisa a esa persona.
- **Cómo va el negocio** (tecla N, `business.mjs`, `data/kpis.json`): los indicadores del dueño, con tendencia y meta. Un valor llega de tres formas:
  - a mano;
  - por webhook: `POST /api/kpi/<id>` con `AO_HOOK_TOKEN`;
  - de una entrega con una línea `KPI ventas_semana = 1.250` (una rutina lo mantiene al día).
  - Debajo, las cifras de la oficina: terminados, respuesta a eventos, esperando OK, horas ahorradas.
- **Resumen del lunes:** cada lunes a las 8, Dimitri deja el resumen de la semana, también por Telegram. Se apaga en Ajustes (`deputy.weekly`).
- **Buscar en todo** (Ctrl+K, `src/search.js`): tareas y entregables, agentes, rutinas, notas e imágenes.
- **Instalar en otra computadora:** `Instalar-Oficina.bat` y `docs/instalar.md`.

## Agent Teams

When the owner says "as a team", "get the team on it", "spawn three teammates to …", or presses TEAM in the bar, the department **lead** takes the task and splits it into two to `teams.max` independent pieces on the desks whose `does` or skills fit; the pieces run at the same time, one Claude process each; teammates may leave one-line notes (`@lead: …`, `@<id>: …`) which reach the lead; the lead writes the final from the pieces. This is the office's own build of the shape (lead · teammates · shared piece list · notes) from separate headless Claude sessions — Claude Code's own agent teams only spawn in an interactive terminal, so they are not what runs here. Nothing to write for a team task; it is the same roster, briefs and skills. To make a seat a better teammate, improve its `does` (the lead splits by it) and its skills. A team routine is `"team": true` in `routines.json` with the lead as `agent`.

## Dimitri (the deputy manager, «Subgerente» until 24 Sep 2026)

The owner's right hand, above the six departments: the ◆ tag beside the Brain at the centre of the office, or key S. The name is `office.config.json → "deputy": { "name": "Dimitri" }`. Dimitri (`sub.mjs`, page side `src/sub.js`) reads the company's notes, the office's live state and the latest deliverables, and answers in one of five modes: **charla** (a question or an opinion — it answers), **estado** (how the office is doing, from real data), **analisis** (a decision thought through: options, a recommendation), **plan** (work to be done — it splits it into pieces per department, instructions for each lead, why, a date, one desk or the team, and moves a piece put in the wrong department) or **pregunta** (one missing fact). Only a plan carries pieces, and nothing is sent until the owner presses ENVIAR A LOS JEFES. History: `data/subgerente.json`. To change how it thinks or distributes, edit `sub.mjs → systemPrompt`; better seat descriptions (`does`) and skills make it route better with no code change.

## Dimitri conversa mejor (V4.11, 1 oct 2026, rama `lane/aud-dimitri`)

Auditoría de Dimitri (DIM-01…22). Lo que cambió y dónde:
- **Preguntas con opciones:** `questions: [{ id, q, options: [{label, value}], multi, other }]` (`sub.parseQuestions`, máximo 3). La página las pinta como botones (radio o casillas) con «Otra…» y RESPONDER (`src/sub-ops.js → questionsHTML`); una sola pregunta de una opción se responde con un clic. La respuesta vuelve como mensaje del dueño («Producto: Combo · Redes: Instagram») con `answers` en `POST /api/sub/chat`, y la pregunta queda marcada (`plan.answers`). El historial que lee Dimitri dice `[pregunté: … · respondió: …]` (`sub.historyLine`).
- **El prompt** (`sub.systemPrompt`): contrato → modos con ejemplo → reglas → DATOS entre etiquetas (`<estado>`, `<notas>`, `<viendo>`, `<estudio>`…). El catálogo del Estudio solo entra si el mensaje es del Estudio (también voz, locución, jingle, música), y con más de 12 modelos encendidos va compacto (`estudio-plan.COMPACT_OVER`). «¿Cómo vamos?» pasó de 44.000 a ~16.000 caracteres.
- **Lo que ve:** `<estado>` trae Contenido (próximos 7 días, huecos, qué falta), Analíticas (o «Meta no está conectada»), rutinas (próximas, fallidas), gasto del mes, indicadores y avisos (`sub.contenidoText`, `analiticasText`, `rutinasText`, `oficinaText`). «👁 Viendo» trae los datos de lo abierto: la pieza, las piezas del rango, la rutina y sus últimas ejecuciones, la tarea, la métrica (`serve.mjs → dimitriViewing`).
- **Ops** (el calendario y la oficina, siempre con el clic del dueño): `rutina_crear`, `rutina_saltar`, `pieza_crear` (nace borrador), `pieza_mover` (si estaba aprobada, pierde el OK), `tarea_mover`, `tarea_cancelar` — y desde el 9 oct 2026 nueve más (ver «Control de la oficina»). Lista cerrada en `sub.parseOps`; `POST /api/sub/ops` las hace y `POST /api/sub/ops/undo` las deshace durante 30 s. Nunca aprueba, programa en Meta ni publica.
- **Voz y música:** las tarjetas dicen VOZ o MÚSICA, con «Texto que se dirá», selector de voz (las clonadas del dueño primero), emoción y velocidad; la música, instrumental y estilo. Dimitri recibe la lista de voces y un `voiceId` inventado vuelve a la de por defecto, dicho en «why». El peso contra el tope sale de `estudio-plan.WEIGHT` (una sola fuente).
- **Más:** el chat se redibuja solo donde cambió (copiar una respuesta ya no se borra a los 3 s); una respuesta cortada se repara o se pide otra vez, nunca JSON crudo; una hora que ya pasó pregunta «mañana o ahora»; se adjunta un video o un audio por su id; «Nueva conversación» archiva (`data/subgerente-archivo.json`) con DESHACER; sugerencias según la vista; su gasto va como `kind: 'dimitri'` en `data/costs.jsonl`.
- Tests: `tests/sub-conversacion.test.mjs`, `tests/sub-ops.test.mjs`, `tests/sub-dimitri.test.mjs` (servidor real, Claude simulado).

## Control de la oficina: Dimitri, los agentes y tu IA (9 oct 2026)

Revisión pedida por el dueño («que Dimitri y los agentes sepan y puedan controlar el calendario y las tareas, aunque se use cualquier IA»). Informe: `docs/auditoria-control-dimitri-agentes-2026-10-09.md`; guía para conectar una IA: `docs/conectar-ia.md`.
- **Una sola puerta para cambiar el calendario, las tareas y Contenido:** la lista cerrada `sub.OPS` (15: `rutina_crear · rutina_saltar · rutina_pausar · rutina_reanudar · rutina_editar · rutina_ahora · tarea_mover · tarea_cancelar · tarea_editar · tarea_repetir · mia_delegar · mia_hecha · pieza_crear · pieza_mover · contenido_llenar`), el validador `sub.parseOps` (→ `{ ops, dropped, motivos }`: lo que no pasa, con su porqué, y `sub.motivosText` lo dice en la respuesta de Dimitri) y el ejecutor `runOp(o, { por })` / `undoOp` de `serve.mjs`, que usa las reglas de las rutas (`tareasRoutes.organizar`/`cambiarEstado`, `duenoRoutes.delegar`/`tomar`, `contenidoRoutes.llenar`/`planLlenar`, `repetirTarea`). Nunca aprobar, enviar, publicar, pagar ni borrar: no están en la lista.
- **Lo del dueño** (`person: 'Tú'`) no se mueve ni se cancela como lo de un agente: se cambia por su `limite` (`tarea_editar`), se delega (`mia_delegar`) o se marca hecho (`mia_hecha`). Lo que crea Dimitri o un asistente en una rutina espera el OK siempre (solo el dueño lo quita, en la tarjeta o en el calendario).
- **Una acción nueva** se añade en `sub.OPS`, `sub.parseOps`, el prompt (`systemPrompt`, sección OPS), `runOp`/`undoOp`, `opLabel` y `fields` (`src/sub-ops.js`), y `ACCIONES` (`oficina/rutas.mjs`). `tests/control-oficina.test.mjs` falla si falta alguna, o si un tipo suena a aprobar, enviar, publicar, pagar o borrar.
- **Lo que ve Dimitri** (además de lo de antes): ids en lo que está en curso, espera el OK o falló; las fechas límite de los próximos 7 días; cómo sale lo aprobado (`sub.publicacionText`: modo, conductor, cuota, fallos); la semana de redes (F4); al lado del calendario de tareas, sus tareas, rutinas y tus fechas límite (`calendarioOficina` → `sub.calendarioText`); en Tareas, la tarea, el proyecto o la agenda. El **mapa de la oficina** (`oficina/mapa.mjs → MAPA`) va en su prompt.
- **Cualquier modelo:** `sub.pickJSON` lee la respuesta aunque el modelo escriba antes, ponga un ejemplo o use un bloque de código; el contrato no depende de Claude.
- **Tu IA** (Claude Desktop, Claude Code, Cursor… en esta máquina): `oficina-mcp.mjs` (stdio) → `/api/oficina/*` (`oficina/rutas.mjs`: `mapa`, `estado`, `calendario`, `accion`, `deshacer` con clave de 10 min en memoria). Herramientas: `como_funciona`, `estado_oficina`, `ver_calendario`, `ver_tareas`, `ver_tarea`, `ver_agenda`, `ver_mis_tareas`, `ver_rutinas`, `ver_contenido`, `ver_resultados`, `ver_huecos`, `ver_analiticas`, `hablar_con_dimitri`, `crear_tarea` (siempre `needsOk: true`), `crear_mi_tarea`, `hacer`, `deshacer`. Cada cambio va a `data/audit/` (`kind: oficina`, `por: asistente`). Las lecturas las comparten los MCP de los agentes (`oficina/lecturas.mjs`). ChatGPT y Meta AI (web) necesitan un MCP remoto con inicio de sesión: después del issue #2.
- Tests: `tests/control-oficina.test.mjs`, `tests/oficina-servidor.test.mjs` (serve.mjs real y el MCP), `tests/mcp-plugins.test.mjs` (el MCP de la oficina nunca llega a un agente).

## Dimitri y el Estudio (V4.9, 30 sep 2026)

Dimitri hace creativos con el Estudio, ve las imágenes que le pasas y está a mano en todas las vistas.
- **Modo «estudio»** (6.º modo de `sub.mjs`): devuelve `creatives` y `actions` en JSON.
  - **Validación:** `estudio-plan.mjs` (puro) valida cada creativo contra el catálogo real y la galería:
    - un modelo apagado o desconocido pasa al de por defecto, y lo dice;
    - los ajustes salen de los valores permitidos;
    - una referencia que no está en la galería se quita;
    - un `needs` sin cumplir deja el creativo «skipped» con su motivo.
  - **Costo:** `estimatePlan` calcula el total contra `media.budget()`.
  - **Acciones:** lista cerrada: `carpeta_crear`, `carpeta_renombrar`, `mover`, `enviar_contenido`; esta última crea una idea, nunca aprobada.
  - **GENERAR:** `POST /api/sub/studio` es **la única ruta que genera por Dimitri**, y solo la llama el clic de GENERAR. Entra en `media.submit` con `by:'dimitri'`, `sub:{msg,i}`, `purpose` y `read`. Al terminar, `subJobDone(j)` pone «Listos: …» en su chat con las miniaturas.
  - **Para cambiar cómo elige modelos o escribe prompts:** `sub.mjs → systemPrompt` y `estudio-plan.mjs → studioPromptBlock`. De cada modelo, Dimitri ve la calidad, la velocidad y los usos que da `INFO` en `media.mjs`.
- **Imágenes en su chat:**
  - `POST /api/sub/chat {text, attach, vision, context}`, con un cuerpo de hasta 8 MB.
  - La página sube el original a «Referencias de Dimitri» y manda una copia reducida (≤1568 px) para la visión.
  - El servidor la pasa a Claude:
    - con la CLI, `--input-format stream-json` y bloques `image` por stdin (`vision.mjs`; probado con la CLI 2.1.286);
    - con el SDK, bloques de contenido.
  - El texto visible de la imagen (`image_text`) pasa por `safety.injectionIn`: si salta, el mensaje lleva `shield` y el plan pierde sus acciones.
- **Al lado de cada vista:**
  - el panel y el corrimiento de la vista están en `src/css/dimitri.css`;
  - la tecla S funciona dentro de las vistas;
  - `ctx.getContext()` (en `src/main.js`) junta la `selection()` de la vista abierta para el chip «Viendo».
- **El visor del Estudio:**
  - `src/css/estudio.css` (filas `minmax(0,1fr)`) y `src/viewer-zoom.js` (puro, con test) para el zoom;
  - se mide con `node scripts/estudio-capturas.mjs despues` (24 combinaciones; todas deben caber).
- **Editar:** `POST /api/media/edit {file, instruction, model?}` y `media.editRequest`. Los modelos llevan `edit:true` en `CATALOG`, en el orden de `PREFER.edit`.
  - La versión nueva lleva `versionOf` y la original suma `versions[]`.
  - Si no hay ningún motor de edición encendido: 409 con `engines[].how`.
- **Rastro y memoria** (solo motores reales, no «prueba»):
  - Cada trabajo de Dimitri o de un agente, y cada edición, deja una nota en `<cerebro>/Agents Office/estudio/AAAA-MM/`, que no viaja por GitHub.
  - Lo usado (`PATCH /api/media/item/<id> {used}` o ⭐) enseña a la memoria por trabajo.
  - Tirar todo un pedido sin usarlo resta, y «Recuperar» lo deshace.
- **De la galería a la oficina:**
  - `POST /api/media/to-dept {file, dept, text}` crea una tarea con `refs:[file]`. `task.refs` es lo que entra; `task.media` sigue siendo lo que la tarea produjo.
  - «Pedírselo a Dimitri» abre su chat con la imagen adjunta.
- **Probar sin gastar:** `node scripts/dimitri-recorrido.mjs` (Claude simulado, motor «Prueba», navegador a 1512 claro y oscuro y a 390).

## The top bar (V4, 24 Sep 2026)

Brand (the business name — a button: it closes the open view, or flies back to the whole office) · the connector lane (its label opens the connectors' panel; the icons shrink to fit and never push anything) · a fixed **dock** of icon tools on the right: the model's logo (Claude or Meta; hidden under 440 px), approvals ⚠ (it counts drafts; each click goes to the next one), the Estudio (clapperboard, E), the calendar (P), **Contenido (a feed grid since 1 Oct 2026, K, V4.7)**, Analíticas (bars, R), the Brain (G, V4.5), the business (a briefcase since 1 Oct 2026, N), the settings (`,` — with **Estado**, Apariencia and the keyboard shortcuts, «?»; since 8 Oct 2026 the office's health is Ajustes → Estado, key O, and the gear carries its light: a dot only when something is amber or red, and then the gear opens on Estado), **Dimitri (his initial, S — 1 Oct 2026: he opens beside any view, with the mouse or a finger)** and the task panel's switch (T). The open view's icon stays pressed (`aria-pressed`). Each icon has a `data-tip`: its name shows under it when it has the keyboard focus or is held down on a touch screen (`src/css/dock.css`). Ctrl+K searches everything. A new tool joins the dock as one more `<button class="tb-ic">` with an SVG, an `aria-label` and a `title` naming its key; check it still fits at 390 px. The plan's usage (session · week) sits in the bottom-left corner.

## The Estudio (images and video)

Real image and video generation, for the owner (the clapperboard in the dock, key E) and for the agents. `media.mjs` is the engine (since 1 Oct 2026, F0 of the preset bank, a **façade** with the same API over `media/`: `catalogo.mjs` — engines, `CATALOG`, `INFO`, `PREFER`, prices and `capsOf`; `galeria.mjs` — files, folders, index, bin; `motores.mjs` — talking to each service; `trabajos.mjs` — budget, jobs, edits; `estado.mjs` — the shared config. `tests/media-fachada.test.mjs` compares everything it answers with a photo taken before the split: a deliberate catalog change is re-photographed with `AO_FOTO=1 node --test tests/media-fachada.test.mjs`; sharp is a dependency and `npm run check` checks it loads), `estudio-mcp.mjs` the agents' tool, `src/studio.js` the window.

- **Engines** turn on when their key is in the Windows environment — never write a key into a file: `HF_KEY="id:secret"` (Higgsfield Cloud: Soul, Kling 3, Seedance 2/2.5, Flux 2, Ideogram 4, Recraft, Wan, MiniMax, LTX, PixVerse…; or `HF_API_KEY` + `HF_API_SECRET`; `HF_API_BASE_URL` overrides `https://api.higgsfield.ai`), `GEMINI_API_KEY` (Google: Nano Banana 2, 2 Lite, Pro and 2.5 for images; **Veo 3.1, Fast and Lite for video** — Veo needs billing on the AI Studio project; Imagen was shut down by Google on 17 Aug 2026), `XAI_API_KEY` (Grok), `OPENAI_API_KEY` (GPT Image), `META_API_KEY` or `MODEL_API_KEY` (Meta Muse Image; and Muse Spark reads video and audio for the agents), `FAL_KEY` (fal.ai: Flux, Seedream, Nano Banana, Ideogram, Kling 2.5, Seedance 1, Hailuo, Veo 3). `prueba` and `prueba-video` are free local cards for testing the flow.
- **Models** are the `CATALOG` in `media/catalogo.mjs`: each one has its engine, the media it takes (`roles`: start/end frame — **video only**, an image model never takes a frame and `npm run check` refuses one that does — references, a source video; `needs` for the required ones) and its `settings` (enum / range / boolean, shown by the page).
- **Higgsfield (V4.4, 25 Sep 2026) is built from its own documentation.** `higgsfield-schemas.json` holds every route Higgsfield documents (81 on 25 Sep 2026: fields, allowed values, limits, defaults, required), made by `node scripts/higgsfield-schemas.mjs <llms-full.txt>` from docs.higgsfield.ai. Each Higgsfield model in `media.mjs` is only a list of routes (`hfm(id, name, kind, { text, image, firstLast, reference, videoRef, edit }, cost, note)`); from the schemas the office works out its settings, the media it takes, which route a request goes to (by the media it carries) and a body with only fields that route knows, each value one it accepts. `tests/higgsfield.test.mjs` sends every combination through the schema and checks every documented route is reachable. 53 Higgsfield models: Soul, Soul 2, Soul Cinema, Marketing Studio (3), Ideogram 4, Recraft 4.1 (4), Grok Imagine 2, Qwen Image 3 (+edit), Z-Image Turbo; Kling 3 (std, pro, 4K, turbo), Kling 3 and 2.6 motion control (std, pro), Kling O3 and O1 (first-last, image reference, video reference, video edit), Kling 2.6 Pro, Kling 2.5 Turbo (std, pro), Seedance 2.0 and 2.5 (+edit, +extend), Cinema Studio 4.0, Genjutsu (motion transfer, object swap), MiniMax Hailuo 2.3 and H3, Wan 2.6/2.7/3/3 Prime (with reference), LTX 2.5 Pro/Fast (text and image), PixVerse 6, Happy Horse 1.0/1.1, Grok Imagine Video. Five routes the documentation no longer lists (Flux 2 Pro, Flux 3 video, DoP, Seedance 2.0 Fast/Mini) stay as `legacy: true` with a note. **When Higgsfield adds a model:** download the new `llms-full.txt`, rerun the script, add one `hfm(…)` line, `npm run check`. Prices of the new ones are estimates, said in their notes.
- **Google (V4.4, 27 Sep 2026)** runs on `GEMINI_API_KEY`: images by `generateContent` (each model has its own `gid`: `gemini-3.1-flash-image`, `gemini-3.1-flash-lite-image`, `gemini-3-pro-image-preview`, `gemini-2.5-flash-image`; `imageConfig.aspectRatio` and `imageSize` 1K/2K/4K), video by Veo as Google's own SDK sends it (`googleapis/js-genai`): `POST v1beta/models/<id>:predictLongRunning` → poll `GET v1beta/<operation>` → `generateVideoResponse.generatedSamples[].video.uri`, downloaded with the key (`veoRequest` in `media.mjs`; a first and last frame; up to 3 references, which go at 720p landscape; 1080p comes in 8 s). `tests/google.test.mjs` runs both against a local stand-in. The ids come from Google's cookbook (`google-gemini/cookbook`); if Google renames one, change its `gid`.
- **Meta Muse Image (V4.8, 30 sep 2026)** — engine `meta`, key `META_API_KEY` (or `MODEL_API_KEY`, the one the office already uses for Muse Spark), base `https://api.meta.ai/v1` (`AO_META_BASE` points it at a stand-in). One model, `muse-image` (`muse-image-1.0`, `media.models.meta` overrides it): no references → `POST /images/generations`; with references (up to 10) → `POST /images/edits` with Meta's own JSON body `images: [{ image_url }]` (data-URLs, no multipart). `size` is `WxH` from the ratio (`SIZE`), `quality` → `reasoning_strength` (high/low), `outputFormat` → `output_format` (webp by default). It searches the web for real references on its own, included in the price (US$0.01 per image). `tests/meta.test.mjs`. **Not yet tried against Meta with a real key.**
- **Understanding video and audio with Meta Muse Spark (V4.8, 30 sep 2026)** — `understand.mjs`, route `POST /api/media/understand` `{ prompt, kind: 'video'|'audio', media?: gallery id, url?: public https mp4 }`, and two tools in the agents' `estudio` MCP that only show with the Meta key: **`analizar_video`** (describe, summarise, «what is said at minute 2?», pull data out; it reads the speech too) and **`transcribir_audio`** (mp3/wav). It generates nothing — video generation stays with Veo, Kling, Seedance…; Meta has no video model. A gallery video goes up by the Files API (`purpose: user_data`) and is asked about by `file_id` (`input_file`); a URL goes as `input_video.video_url`; an audio inline as `input_audio` (base64). `muse-spark-1.3` for video, `muse-spark-1.2` for audio (Meta: audio on 1.3 is degraded), `max_output_tokens: 4000`. Each call lands in the cost ledger as `entendimiento` (Muse Spark's price per token in `costs.mjs`). The agent gets the text **fenced as material, not orders**, and the guard's injection check still applies. The gallery takes **mp3 and wav** now (♪ card with a player); an audio is never a reference or a frame for a model. `tests/understand.test.mjs`. **Not yet tried against Meta with a real key.**
- **Other engines.** Auth and uploads follow Higgsfield's own client (`Key id:secret`, `POST /<model>` → `status_url`/`cancel_url`, `/requests/{id}/status` → queued · in_progress · completed · failed · nsfw · canceled, `images[].url`/`video.url`, `/files/generate-upload-url` + PUT; 403 means «not enough credits»; only a queued request can be cancelled; a 401/403/404 on a status stops the poll). Your own fal or Higgsfield model: `office.config.json → media.custom: [{ "id", "name", "engine": "fal"|"higgsfield", "kind": "image"|"video", "path", "cost" }]`. Default models: `media.default: { "image": "…", "video": "…" }`.
- **Jobs**: every generation is a background job in `data/media-jobs.json` (queued → running → done/failed with the reason in plain words). Queue engines keep their request ids, so a restart resumes the poll. The page shows live tiles; a failed one says why and has REINTENTAR.
- **Agents** in `media.departments` (default marketing, delivery, sales, ops) get `generar_imagen`, `generar_video` (with `imagen_inicial`/`imagen_final` to animate), `buscar_en_galeria`, `estado_trabajo`, `estado_estudio`. An image usually comes back within the call as `![…](/media/…)`; a video hands back `⏳ Estudio: … (trabajo <id>)`, which the agent leaves in its deliverable and the office swaps for the file when the job ends (task result and its note).
- **Files**: `<brain>/Agents Office/media/YYYY-MM/`, named `YYYY-MM-DD <prompt> HHMMSS` and never reused (not even a name whose file is in the bin: a reused name made the gallery show an old picture from the browser's cache; `tests/media-names.test.mjs`); the page asks for each one as `/media/…?v=<its time>`. A `.json` record sits beside each (prompt, model, settings, media used, size, who, task). Uploads (the owner's product photos, logos, faces) live there too, marked `upload`. Trash goes to `media/.papelera`: 30 days counted from the day it went in, then it is removed; **Papelera** in the Estudio (beside Historial) lists it with its picture and days left, «Recuperar» or «Borrar para siempre», and «Vaciar la papelera» (`/api/media/trash`, `/api/media/trash/purge`). The Brain has its own bin (🗑 Papelera in the Brain, G) for the office's deliverables. Budget (V4.5: in **Ajustes → Estudio**, applied at once by `media.setLimits`): `media.dailyLimit` (a video counts 5; 0 = no cap), `media.dailyBudget` and `media.monthlyBudget` (US$, 0 = none; checked with the model's estimated price before a request is sent, jobs still running count), `media.maxPerRequest`, `media.concurrency` (jobs at once, default 3). The day is the machine's local day; `data/media-usage.json` keeps the day's count and cost and the month's cost.
- **Carga bajo demanda (1 oct 2026):** el banco de presets (con su compilador y su buscador), el escenario 3D y los lotes no van en la página: `build-extra.mjs` los empaqueta en `dist/estudio-extra.js` (con su estilo, `CSS_APARTE`), y `src/estudio-carga.js` lo trae la primera vez que el Estudio enseña el compositor de imagen o se pide el banco, el escenario o los lotes (en file:// junto a la página; servido en `/estudio-extra.js`). Hasta entonces, una cara provisional dice «Cargando…» o, si no llega, por qué, con «Reintentar». three.js no viaja dos veces: el paquete usa el de la página (`src/three-compartido.js`; un `THREE.X` nuevo del escenario se añade allí o `node build.mjs` falla). Un módulo nuevo de esas tres cosas se importa solo desde `src/estudio-extra.js`; si la página lo importa, el build falla. `npm run check` comprueba que el paquete existe, es de la misma construcción y la página no lo lleva; `node scripts/carga-recorrido.mjs` lo prueba en el navegador.
- **Folders (V4.6, 27 Sep 2026):** the owner's own labels, not directories — a file never moves on disk (the links in deliverables and references keep working); its `.json` record carries `folder: <id>` and `<media>/folders.json` keeps the names. A strip under the gallery's filters: Todas · Sin carpeta · each folder (click to see it, double click or F2 or «⋯» to rename, «⋯» to remove — its files stay, in «Sin carpeta») · + Nueva carpeta. Drag a card (or all the selected ones) onto a folder; «Mover a…» in the selection bar and «⋯ → Mover a una carpeta…» on a card do the same without a mouse (a phone cannot drag). What is generated or uploaded while a folder is open lands in it (`folder` in `/api/media/jobs` and `/api/media/upload`). API: `POST /api/media/folders {name, files?}`, `PATCH|DELETE /api/media/folders/<id>`, `POST /api/media/move {files, folder|null}`; `tests/media-folders.test.mjs`.
- **The cards (V4.4; V4.5):** nothing sits over a picture. Under the caption, icons always in sight — the main action (the clapperboard animates an image; a video repeats), **Usar de referencia** (images only, V4.5: the owner uses it a lot), Descargar, the bin — and «⋯» for the favourite, Variar and Repetir. Each icon says what it does on hover.
- **The viewer (V4.4, 27 Sep 2026):** two columns, the picture and its own panel (prompt, details, actions); the picture can only fill its own column, so the text never sits on it. Under 1100 px the panel goes below the picture.
- **The model list (V4.4, 27 Sep 2026):** sorts by Recomendado, Mejor calidad, Más barato, Más caro, Más rápido or Por creador, filters by maker, and searches by name, maker or use. Each model shows its maker, quality (●●●● 1–4), speed and «Para: …» — from `INFO` in `media/catalogo.mjs` (a model not listed there gets its engine as maker and quality 2; add a line when you add a model).
- To make an agent use it well, put the house style for prompts in its skill (e.g. `prompts-visuales`), and which model to prefer for which piece.

## MiniMax en el Estudio (V4.10, 1 oct 2026)

- **Motor `minimax`**, una sola key `MINIMAX_API_KEY` (y opcionales `MINIMAX_GROUP_ID`, `MINIMAX_API_BASE`). Cliente puro: `minimax.mjs`.
  - Valida HTTP y `base_resp`, y traduce los códigos a español: 1008 sin saldo, 1026 contenido sensible, 2038 sin permiso de clonar, 2049 key mala.
  - **Lo que manda es `docs/minimax/api-verificada.md`, no la propuesta original:** cada dato lleva su URL. Si MiniMax cambia algo, se corrige allí primero.
- **Kinds del Estudio:** `image`, `video`, `audio` (voz) y `music`.
  - El tipo de ajuste `text` (`T()` en `media/catalogo.mjs`) sirve para el `voiceId` y el estilo.
  - Un audio generado es `kind:'audio'`; si es música, su ficha lleva `wanted:'music'`.
  - Pesos para el tope: video 5, música 3, voz 1. `usage` cuenta `audios`.
  - El costo de la voz va por carácter (`perChar`) y el del video por resolución (`costBy`).
- **El video es asíncrono:** el `task_id` se guarda en `job.remote`, así que retoma tras un reinicio. Cancelar manda `DELETE /v2/video_generation/<id>` (solo en cola, sin cobro).
- **Voces** (`minimax-voices.mjs`, rutas `/api/voces`, `/design`, `/clone`, `DELETE /api/voces/<id>`, registro en `data/minimax-voices.json`):
  - Cada voz se «fija» con un TTS corto para que MiniMax no la borre a los 7 días sin uso.
  - Borrar la quita también en MiniMax.
  - Diseñar cuesta ~US$3 y clonar ~US$1,5; los dos pasan por los topes y por el ledger.
- **Clonar** (pedido del dueño: «grabar o subir un fragmento, lo máximo que pueda»; sin editor):
  - El panel graba con el micrófono (`MediaRecorder`; necesita `localhost` o https) o recibe un archivo.
  - Todo va a la galería, a «Grabaciones de voz», y se clona por su id.
  - WebM, otros formatos, más de 20 MB o más de 5 min → WAV 24 kHz mono con los primeros 5:00, en el navegador (`src/studio-voz.js`: `toMono`, `resample`, `encodeWav`, `cloneLength`). Menos de 10 s se rechaza.
  - Probar sin gastar: `node scripts/voz-clonar-recorrido.mjs` (micrófono simulado, MiniMax simulado).
- **Agentes:** `generar_voz` y `generar_musica` en `estudio-mcp.mjs`, solo con modelos encendidos. Dimitri acepta creativos `audio` y `music` (`estudio-plan.mjs`).
- **Tests:** contra `tests/minimax-stand.mjs` (MiniMax simulado), nunca la key real. Con la key real: `node scripts/check-minimax.mjs`.
- **Música de pago (`music-3.0`):** solo para cuentas que ya pagaban antes del 20 ago 2026. `mmx-musica-3-gratis` (`music-3.0-free`) sirve para cualquiera.

## Banco de presets del Estudio (F1, 1 oct 2026)

Especificación: `docs/propuesta-banco-presets.md` (§15 y §16 son decisiones del dueño y mandan). F1 = imagen; F2 = lotes (abajo); Dimitri y agentes (F3), video y música (F5–F6) vienen después.
- **La fábrica** está en `presets/` (un archivo por grupo; `presets/validar.mjs` es el esquema y `npm run check` lo valida). **Los del dueño** son notas del Cerebro en `<cerebro>/Estudio/Presets/<nombre>.md` (`presets-notas.mjs`): neuronas del Cerebro, con `[[enlaces]]` a la marca y al preset de fábrica del que salen. Viajan con las demás notas; las imágenes de referencia no (se citan por su id de galería).
- **Un solo compilador puro** (`src/presets-core.js`) para la página y el servidor: expande la pila, deduce el modo de lo que pusiste, elige el modelo (con su porqué), arma el prompt por familia y reparte lo local en antes y después. El escenario 3D (`src/escena3d-core.js`, editor `src/escena3d.js`) se traduce a frases y a una imagen guía gris («LAYOUT GUIDE ONLY») que va como la última referencia.
- **Servidor** (`presets.mjs`): `GET /api/media/presets` (la mezcla, con qué la sirve), `POST /api/media/presets/compile` (el plan; **no gasta**), `POST /api/media/presets/apply` (**gasta**: solo el clic GENERAR del dueño, por los topes del Estudio), `POST /api/media/presets` («Guardar como preset»: la nota; la versión anterior va a `data/history/presets/`), `DELETE /api/media/presets/<id>` (a `Estudio/Presets/.papelera`), `GET /api/media/presets/<id>/versiones`.
- **Todo local → sin IA:** un trabajo `engine: 'local'` (gratis, el original intacto: el resultado es una versión). **Con IA:** lo de antes (luz, color, enderezar) se hace sobre tu foto y a la IA va esa copia (`prep: true` en la galería); lo de después (blanco 255, encuadre, exportar sin EXIF) y la QA (`verificar.mjs`) corren en `runJob` por `media/posproceso.mjs`. El crudo del modelo queda 7 días en `media/.crudo`. Sin sharp, lo local dice «no disponible en esta máquina» y **nunca** cae a la IA.
- **QA en cada resultado:** `post { pasos, medido }` y `qa { estado, checks }` en el registro; la tarjeta dice «QA ✓» o «Revisar: <motivo>»; lo que no se puede medir dice «No medido», nunca un fallo inventado. Copiar el color de una referencia no se mide contra tu foto (cambia a propósito).
- **La interfaz** (`src/studio-banco.js`, `src/css/estudio-banco.css`): solo en el modo **Avanzado** de imagen (V5.1, 2 oct 2026; Básico es el compositor de siempre y no descarga `dist/estudio-extra.js`). Un paso del compositor, debajo de Modelo (tres puertas que son atajos, tu foto, referencias por ejes, la pila con Suave/Normal/Fuerte, el escenario 3D, «Guardar como preset») y una hoja sobre la galería (buscador y grupos, o el escenario; pestañas Elegir · Mi receta). Tecla **B** (o `/` al principio de la idea), que pasa a Avanzado; ↑↓ entre presets, Espacio ★, Esc cierra. **El modelo y el formato son los del compositor** (`ctx.modelo`, `ctx.proporcion` → `pedido.model` y `pedido.proporcion`, que en `compilar` gana a la escena, al preset y al canal); el cuadro del escenario sigue al formato y cambiarlo en el escenario cambia el formato si ese modelo lo hace. El costo o el primer problema del plan salen junto a GENERAR (`.st-est`); lo hecho va a la galería con su QA. Sin «Para dónde va», «Qué hará» ni «Resultado» (V5.1).
- **La demo `file://`** lleva la fábrica de imagen incrustada (`build.mjs` cambia `src/presets-fabrica.js` al empaquetar): busca y compila sin servidor; GENERAR pide la oficina.
- **Probarlo de punta a punta:** `node scripts/presets-recorrido.mjs` (oficina temporal, Google de mentira, nunca una key real) → `data/capturas/presets/integracion/`.

### Lotes (F2, 1 oct 2026)

Muchas fotos con la misma receta, como un trabajo de agente (§6 y §7.4 de la especificación). Pestaña **Lotes** del Estudio (**Crear y galería · Lotes** en escritorio, **Crear · Galería · Lotes** en el teléfono; tecla **L**, que también vuelve a Crear), y **«Editar en lote…»** en la barra de selección de la galería.
- **El motor** (`lotes.mjs`): máquina de estados `previsto · espera_ok · muestra · corriendo · pausado · hecho · cancelado` (un paso que no se puede da 409 en palabras). Estado en `data/media-lotes.json` (escritura atómica; no viaja). **Nace «previsto» y no gasta**; solo PROBAR CON 3 o GENERAR TODAS ponen la bomba a trabajar. La bomba gotea: como mucho la concurrencia del Estudio − 1 (un hueco para lo manual) y la del lote (2), y **antes de cada foto** mira el tope del lote en US$, el del día y el del mes y el de imágenes del día; si no cabe, pausa con el motivo. Un 403 o «sin créditos» pausa el lote entero. Pasajero → reintento con `reliability.mjs`; QA «revisar» → UN reintento con más fidelidad, luego «Revisar». **Un reinicio a mitad retoma sin duplicar** (`reconciliar`, la marca `lote:{id,fila}` en cada trabajo de `media/trabajos.mjs`). Un lote vivo no cuenta en los 400 trabajos del registro.
- **Entradas:** una carpeta, las seleccionadas, fotos subidas (a una carpeta «Lote <fecha>»), un ZIP o un **Excel/CSV** (`lotes-hoja.mjs`, exceljs). Columnas por sinónimos (`presets/columnas.json`: foto, sku, nombre, preset, canal, encuadre, medidas «140 x 45 x 200» en cm, notas), corregibles con el desplegable. La foto: incrustada → nombre de archivo (subidas junto a la hoja) → id de galería → URL https (apagada; `media.lotes.url`). **Nunca rutas del disco** (400 con las filas). Las notas pasan por `injectionIn`: con órdenes escondidas la fila queda en «Revisar» y no se manda.
- **Acciones por foto, idempotentes:** aprobar (solo el dueño; la primera aprobada es la foto patrón y la memoria aprende), reintentar (más fuerte, con otro modelo, «otra versión»), omitir. Un lote de **agente** desde 10 fotos o US$2 nace `espera_ok` y solo el dueño lo autoriza.
- **Salida:** ZIP con nombres por SKU (`CM-140_01.jpg`) y `resumen.csv` (BOM, sin fórmulas), CSV aparte, nota en `<cerebro>/Agents Office/estudio/AAAA-MM/<fecha> lote <nombre>.md` con el antes y el después, y un aviso (también Telegram) al terminar, al pausar y tras la muestra.
- **API** (`serve.mjs`; `lotes-puente.mjs` traduce lo que habla la página al idioma del motor, con tests): `POST /api/media/lotes/hoja` (lee la hoja, la guarda 2 h; no crea nada) · `POST /api/media/lotes` (lote «previsto» con `previa`) · `GET /api/media/lotes[/<id>]` · `PATCH /api/media/lotes/<id> {accion: probar|iniciar|continuar|pausar|reanudar|cancelar|autorizar}` · `POST /api/media/lotes/<id>/filas {accion: aprobar|reintentar|omitir, filas, modelo?, mas_fuerte?}` · `GET /api/media/lotes/<id>/zip?que=listas|aprobadas` · `GET …/csv`. Configuración: `office.config.json → media.lotes { max: 100, agenteSinOk: 10, agenteUsd: 2, url: false, concurrencia: 2, muestra: 3, muestraDesde: 10 }`.
- **La interfaz** (`src/studio-lotes.js`, `src/css/estudio-lotes.css`): crear en 3 pasos (fotos → receta con el mismo banco, canal y un escenario 3D para toda la serie → el plan con las 5 primeras, el modelo y el costo) y el seguimiento como un agente (progreso, cada foto con antes/después, bitácora, filtros, Aprobar las listas, Descargar todo). En la demo `file://` corre un lote de mentira en memoria.
- **Probarlo en el navegador:** `node scripts/lotes-capturas.mjs` (oficina temporal sin keys, un Excel de 12 fotos y un preset local: probar con 3, seguir, pausar, reanudar, la oficina se cae y vuelve, otra versión, aprobar, ZIP; y las capturas a 390, 1024 y 1512 px en claro y oscuro) → `data/capturas/presets/integracion-f2/`. `tests/lotes-servidor.test.mjs` hace lo mismo por la API dentro de `npm test`.

### Dimitri, los agentes y el video (F3 y F5 adelantada, 1–2 oct 2026)

- **Dimitri y los lotes** (`estudio-lote.mjs`, el bloque de presets de `estudio-plan.mjs`, la tarjeta en `src/sub-studio.js` + `src/css/dimitri-lote.css`):
  - entiende «convierte estas 40 fotos de la bodega en catálogo para la web» o un Excel adjunto, y elige presets y escena 3D (lee la fábrica y las notas de `<cerebro>/Estudio/Presets/`);
  - propone el lote con su costo: **PROBAR CON 3 / GENERAR TODAS** por `/api/sub/studio`, la única puerta;
  - si falta el canal o la carpeta de las fotos que nombra la hoja, pregunta con opciones;
  - sigue el lote en vivo en su tarjeta, y `lote_pausar · lote_reanudar · lote_reintentar · lote_aprobar` solo actúan con un clic.
- **El costo que se ve es el que se gasta:** si la estimación fila por fila supera lo que decía el botón, el lote NO arranca (409, con el costo nuevo en la tarjeta) y hace falta un segundo clic. El escudo de inyección lee la hoja entera: cabeceras, nombre del archivo y notas.
- **La receta de la fila gana a la del lote** (`pilaDe` en `lotes.mjs`): la pila de la fila va después, porque el compilador hace ganar al último en los ejes exclusivos y una receta seguida de sus ajustes se sustituye. Con el orden al revés, una fila de pago salía «gratis».
- **Agentes** (`estudio-mcp.mjs`): `buscar_presets`, `aplicar_preset`, `crear_lote` y `estado_lote`. Un pedido de agente desde 10 fotos o US$2 nace en `espera_ok` y va a Aprobaciones.
  - Se suma lo que esa tarea y ese agente ya pidieron hoy (`pideOkAgente`), así que partir el trabajo no salta el OK.
  - El lote de un agente vuelve a su tarea al terminar.
  - La skill de ejemplo es `skills/catalogo-fotos/`.
- **Video (F5, solo datos y compilador):** los 53 presets de video en `presets/video/` y su soporte en `src/presets-core.js`:
  - un movimiento por clip;
  - giro 360 con aviso;
  - bucle;
  - antes→después;
  - roles y `capsOf` de cada modelo;
  - el escenario 3D con el movimiento de cámara.

  **Falta su pantalla** (pestaña de video del banco) y los de música y voz (F6).
- **Regla de la página:** nada que viva en el paquete aparte (`src/estudio-extra.js`: banco, lotes, escenario, compilador, buscador) puede importarse desde un archivo de la página; `build.mjs` falla si pasa. Un dato pequeño que necesitan los dos va en su propio archivo (ejemplo: `estudio-pesos.mjs`, con `weightOf`).

## Contenido (V4.7, 30 sep 2026)

El calendario de lo que se publica en Instagram y Facebook, con su programación. Vista bajo la barra superior (tecla **K**, el botón «Contenido» del dock; `C` ya es «el chat del jefe» dentro de un departamento). Propuesta y decisiones: `docs/propuesta-contenido-y-meta.md`. Hecho: F0 (el refactor), F1 (piezas, vista, agentes, Estudio), F2 (Meta en solo lectura y Analíticas) y F3 (8 oct 2026: publicar directo con Meta, §17 de la propuesta; Instagram no se programa por API y sale desde esta computadora a su hora) y F4 (9 oct 2026: aprender de lo publicado, abajo). **Falta:** F5 lo demás.

- **Una pieza es una nota**, `<cerebro>/Agents Office/contenido/AAAA-MM/p-AAAAMMDD-xxxx.md` (las sin día, en `sin-fecha/`; la papelera, `.papelera/`): cabecera con día, hora, formato (post · carrusel · reel · historia), redes, estado, medios del Estudio; cuerpo con el texto y, bajo `## Primer comentario`, `## Hashtags`, `## Texto de Facebook` y `## Notas`. Se puede editar a mano. **No viaja por GitHub** (`brain-panaclaw/Agents Office/*` está ignorado y `tests/contenido-privacidad.test.mjs` lo comprueba): un texto sin publicar trae precios y lanzamientos y el repositorio puede ser público. `contenido/piezas.mjs` lee y escribe (cabecera YAML mínima, escritura a un temporal y renombrar); `contenido/rutas.mjs` son las rutas `/api/contenido/*`.
- **Estados que se deciden aquí:** idea · borrador · a revisar · aprobada. «En Meta», «publicada» y «falló» serán de la cola (F3), que se junta con la pieza al pintar. **Solo el dueño aprueba**, desde la vista, y solo si puede salir (`revisarPublicacion` sin errores y con día); guardar una pieza NO la aprueba y una pieza no nace aprobada. **Cambiar lo que sale** (texto, hora, día, redes, archivos, hashtags…) de una aprobada le quita el OK (`huella`): el OK era de otro texto. Cambiar el título o las notas no.
- **Las reglas de cada red son las de Juancito Ads**, portadas con su procedencia en `src/contenido-reglas.js` (commit `a100fd2` de CALENDARIOS-MARKETING-APP) y con sus tests (`tests/contenido-reglas.test.mjs`): límites de Instagram, proporciones, «un reel necesita un video», los arreglos de un clic. Si allá cambia una regla, aquí también; el archivo nombra lo poco que cambió (la hora es la del reloj de la máquina, no Panamá fijo). Las reglas hablan en «post» (`format`, `descripcion`…); `postDePieza()` traduce la pieza. La revisión se calcula en el navegador, al instante, y el servidor la repite al aprobar.
- **Aprender de lo publicado (F4, 9 oct 2026, `contenido/aprender.mjs`, puro):** tras cada foto de Analíticas (y al arrancar), las piezas ya maduras (5 días) se ordenan por interacciones (la mejor 1, la peor 0,25; con menos de 4, nada) y una pieza que escribió un agente enseña a las notas que su tarea citó en «Fuentes:» (`memory.reinforce`, idempotente por pieza: `contenido:<id>`). El informe del lunes y Dimitri reciben `semanaContenido` (lo que salió y cómo le fue, los huecos, lo que puede volver). Tests: `tests/contenido-aprender.test.mjs`.
- **Los agentes dejan borradores y nada más** (`contenido-mcp.mjs`, como `estudio-mcp.mjs`): `ver_calendario_contenido`, `ver_pieza`, `crear_borrador`, `mejorar_borrador` (solo ideas y borradores: lo que espera el OK del dueño no lo tocan, 9 oct 2026), y para leer `ver_resultados` (lo publicado con sus cifras) y `ver_huecos` (los días sin publicación y lo que puede volver). Van en `INTERNAL` de `safety.mjs` (un servidor interno no cuenta como envío) **porque ninguna herramienta aprueba, programa ni publica**: `tests/contenido-mcp.test.mjs` falla si aparece un nombre así o un campo `estado`. Y la API tampoco se lo deja a quien llega como agente (`por: 'agente'`: nace borrador, no aprueba, no devuelve, no toca lo aprobado): cualquier proceso de esta máquina puede llamar a la API. Los departamentos son `office.config.json → contenido.departments` (Marketing y Entregas; Ajustes → Contenido, ↻). La skill `skills/plan-contenido` les enseña a planificar una semana.
- **El motor del calendario es uno** (`src/calendar-core.js`, puro: fechas, rango, título, mes/semana/día/agenda, `fitMonth`; `src/calendar-dnd.js`: arrastrar con el ratón y con el dedo). El calendario de tareas (`calendar.js`) y Contenido (`contenido.js`) lo comparten. Antes de mover algo del calendario: `node scripts/calendario-capturas.mjs guardar antes` y, después, `comparar antes` (necesita `npm run build` y Chromium; guarda el HTML de cada vista y ancho con una hora y datos fijos: si el HTML no es idéntico, algo cambió). Las reglas de `#calOv` y `#cv*` en `shell.html` valen también para `#ctOv` y `#ct*` (`:is(#calOv, #ctOv)`): un id nuevo del calendario se generaliza igual.
- **El estilo de una vista nueva no crece `shell.html`:** va en `src/css/<vista>.css`, y `build.mjs` los junta donde `shell.html` dice `/* <css-vistas> */` (`check` comprueba el marcador y que cada archivo llegue una vez).
- **La papelera del Estudio no se lleva lo que una pieza usa:** `DELETE /api/media/item/<id>` contesta 409 con las piezas que lo usan (`contenido.usos()`). Es el fallo mudo que Juancito Ads ya tuvo: una imagen programada que desaparece.
- **La demo** (`file://`, sin servidor) usa piezas en memoria con las mismas reglas (`src/contenido-datos.js`, `tests/contenido-datos.test.mjs`); nada se escribe en disco.
- **Estudio ⇄ Contenido:** «Enviar al calendario» (menú de la tarjeta y vista ampliada) crea una idea con esa imagen y abre la pieza; «Crear con el Estudio» abre el Estudio «para la pieza» (una barra dice cuál; cada tarjeta ofrece «Usar en la pieza» y «Volver a la pieza» entrega lo elegido). El calendario de tareas puede mostrar las piezas como una capa (chip CONTENIDO, solo lectura: un clic las abre en Contenido).
- **En el teléfono** el dock no cabe con diez botones: a 440 px o menos, Analíticas, Tareas, el Cerebro (desde el 1 oct 2026, para dejar sitio a Dimitri), Negocio y Ajustes pasan a un «⋯» (`src/dock.js`, menú con teclado completo; la luz del estado, que desde el 8 oct 2026 lleva el engranaje de Ajustes, se copia al «⋯»). Sus atajos (O, N, `,`) siguen. Una vista nueva del dock se prueba a 390, 360 y 320 px **con el aviso «⚠ N» de aprobaciones encendido** (es el uso normal, y ensancha el dock ~56 px): sin él, el dock cabía a 390 y se salía a 360, y con él se salía también a 390 — la marca cede con puntos suspensivos (`src/css/dock.css`). El paso de `check.mjs` fuerza el aviso: en CI aparecía a otra hora que en local y el paso fallaba solo allí.
- **Copia diaria:** `dailyBackup` también copia la carpeta de piezas (`data/backups/contenido-AAAA-MM-DD/`, 14 días) y lo leído de Meta (`analiticas-AAAA-MM-DD/`, sin miniaturas): lo que Meta ya no devuelve solo existe si se apuntó.
- **Analíticas (F2, R): Meta en solo lectura** — `contenido/meta.mjs` (cliente de Graph portado de Juancito Ads), `contenido/metricas.mjs` (la foto diaria), `contenido/rutas-analiticas.mjs`, `src/analiticas.js` + `src/analiticas-datos.js` + `src/css/analiticas.css`, cuentas en `src/contenido-cifras.js` (portadas, con tests). Plan y decisiones: sección 16 de `docs/propuesta-contenido-y-meta.md`.
  · **El token es `META_ACCESS_TOKEN` (variable de Windows) y no toca el disco ni sale en ningún texto.** Usuario del sistema de Business Manager, no OAuth: la oficina no tiene una web pública a la que Meta pueda volver. `META_APP_SECRET` (opcional) pone `appsecret_proof`. Los tokens de página viven en un `Map`. Un test busca el token en `data/contenido/` y en cada respuesta de la API.
  · **La oficina no llama a Meta sin token puesto.** El reloj (`tickAnaliticas`, 10 min) hace la foto de AYER desde las 6:00 locales, una cuenta tras otra, y reintenta lo que falló pasada una hora (3 al día). `npm run check` levanta un Graph de mentira (`META_GRAPH_HOST`) y le pone al servidor un token falso; **nunca hereda el del dueño** (se pone en blanco).
  · **Nada de esto se ha probado contra Meta de verdad.** Lo primero con el token: «Comprobar conexión» en Analíticas (¿lista las páginas de un usuario del sistema por `/me/accounts`? ¿`/debug_token` da permisos y caducidad?) y comparar las cifras con Meta Business Suite.
  · **Una flecha sin con qué comparar se rotula, no se inventa:** `kpis` recibe `cobertura` (0,7) y `publicacionesDesde` (primera foto − 45 días). Comparar 30 días contra 3 fotos hacía «subir un 900 %» lo que no subió. Y una foto que falla guarda POR QUÉ (`intentar()` conserva el primer error de Meta); antes, un permiso que falta y un token muerto se veían igual.
  · **Sin token, la pantalla enseña cómo conectar y un botón «ver con datos de ejemplo»**; en la demo, siempre ejemplo, rotulado en una franja. Lo de ejemplo nunca se mezcla con lo real.
  · **En el teléfono Analíticas va en el «⋯»** (el dock no cabe con otro botón y el aviso «⚠ N»). Una vista nueva se prueba a 390, 360 y 320 px.
  · Los indicadores del dueño (`meta_seguidores`, `meta_alcance`) los crea él con un botón; después cada foto buena los actualiza (`llevarIndicadoresMeta`).
- **Pendiente de verificar con una cuenta real (F2/F3):** Instagram NO deja programar por la API (comprobado el 8 oct 2026 contra el SDK oficial: `/media` no tiene `scheduled_publish_time`), así que la oficina lo publica a su hora. Falta comprobar con el token: que Instagram acepte la imagen desde la dirección de una foto temporal de Facebook, que `/me/accounts` liste las páginas de un usuario del sistema y la cuota real. Todo eso lo prueba `node scripts/check-meta-publicar.mjs` sin publicar nada.

## El editor de una pieza (C1 y C2, 8 oct 2026)

Pedido del dueño tras comparar Contenido con Metricool: «¿podemos tener un panel mucho mejor que ellos?» → «haz C1 y las tarjetas de C2».
- **Formato por red** (`src/contenido-reglas.js`: `FORMATOS_RED`, `formatoDe`, `nombreFormato`, `ponFormato`, `formatosConRedes`, `normalizarFormatos`, `gruposDeFormato`): `formato` es el de Instagram (o el de la primera red) y `formatos: { red: formato }` solo las redes que salen distinto (en la nota, una línea JSON en la cabecera). Cambiar una red no mueve las demás; una red nueva entra con el formato de la pieza si lo tiene (X en una historia entra como post). `revisarPublicacion` revisa cada grupo de redes con su formato y el arreglo `formato:post:instagram` toca solo esas redes. `entregasDe` (`contenido/entrega.mjs`) hace una publicación por formato. La huella cuenta `formatos` solo si tiene algo: lo aprobado antes no se suelta. Los agentes pueden pasarlo en `crear_borrador` / `mejorar_borrador`.
- **El editor** (`src/pieza.js`, estilo `src/css/editor-contenido.css`): las fichas de las redes con su formato y «N problemas» (`.pz-review`, plegado; «ver los problemas» del pie lo abre); el cuadro con el texto (`.pz-ta.pz-main`, `data-f="texto"` sigue siendo el principal), los archivos dentro (arrastrar o ‹ ›) y la barra (`data-pop`: emoji, hash, enlace, guardados, mejorar; `data-a="comentario"`) con un contador por red (`.pz-cc[data-cc]`); «Editar por red» (`data-a="por-red"`, pestañas `data-ttab`; no se apaga mientras una red lleve su texto); lo de cada red y las notas en `details.pz-cfg` (con `data-op-red`); el pie con cuándo sale (`data-a="cuando"` despliega `.pz-cuando`) y «Aprobar ▾» (`data-a="menu"`: revisión, borrador y «Publicar ya», `data-a="ya"`, con un segundo clic). La vista previa tiene «Teléfono · Computadora» (`ao.ct.pv`; `preview.escritorio()` en `src/contenido-preview.js`).
- **Textos guardados** (`contenido/guardados.mjs`): la nota `<cerebro>/Contenido/Textos guardados.md`, una sección por texto; una hecha solo de hashtags es un juego (va al campo «Hashtags»). **Viaja por GitHub** con las notas del equipo: nada privado. `GET|POST /api/contenido/guardados`, `DELETE /api/contenido/guardados/<nombre>` (un agente: 403); con `usados`, los hashtags que más usan las piezas.
- **✨ Mejorar con Marketing** (`contenido/mejorar.mjs`, `POST /api/contenido/mejorar { pieza, red, pide }`, solo el dueño): el puesto de redes de Marketing (`agenteDeContenido`; si no hay, el jefe) propone el texto con su brief, skills y lecciones (`agentBrief`), la nota `voice`, `contexto-marketing` y las cifras, sin herramientas; devuelve `{ texto, porque, agente }` y no guarda nada. Va en `data/costs.jsonl` como `kind: 'contenido'`. Para cambiar cómo escribe: su brief o su skill (la de `plan-contenido` vale).
- **Publicar ya:** `POST /api/contenido/piezas/<id>/aprobar { pronto: true }` aprueba para el primer minuto entero a 5 minutos (`PRONTO_MIN`, `ahoraMas` en `contenido/piezas.mjs`): la cola entrega pasado su minuto para deshacer y a más de 3 de su hora. Las reglas de cada red siguen mandando.
- **Las tarjetas** (`src/contenido.js`: `miniatura`, `resto`, `netBadges`, `hovHTML`; estilo `src/css/tarjetas-contenido.css`): el texto bajo el título (`.pz-snip`), «+N» (`.pz-mas`), el icono del formato distinto (`.pz-nf`) y la vista previa al pasar (`.ct-hov`: con ratón o teclado, no en pantallas táctiles; se queda si el ratón pasa encima, Esc la cierra sin cerrar Contenido, un clic abre la pieza).
- **El editor va en su propio paquete** (como la vista Tareas): `build-pieza.mjs` arma `dist/pieza-editor.js` desde `src/pieza-editor.js` con `editor-contenido.css` y `contenido-preview.css`; `src/pieza-carga.js` (`panelBajoDemanda`) lo trae al abrir Contenido (`precargar`) y `serve.mjs` lo sirve en `/pieza-editor.js` (lo reconstruye si es de otra construcción). Lo pequeño que usa la página (estados, formatos, redes, iconos, la miniatura) está en `src/pieza-base.js`. Si la página importa `src/pieza.js` o `src/contenido-preview.js`, `build.mjs` falla; el editor recibe el `modal` de la página (una sola pila de ventanas).
- Tests: `tests/contenido-formatos.test.mjs` y `tests/contenido-editor.test.mjs`. Recorridos: `node scripts/editor-contenido-recorrido.mjs` (con `AO_AXE=<axe.min.js>` pasa axe) y `node scripts/tarjetas-contenido-recorrido.mjs`.

## Meta: versión, freno y Meta de mentira (Fase 0 de Anuncios, 8 oct 2026)

- **Una sola versión de Graph** para publicar, Analíticas, Anuncios y la Bandeja: `VERSION_GRAPH` en `contenido/meta.mjs` (`v26.0`). Al lado, `VERSIONES` con las fechas de fin de cada versión en la **Graph API** y en la **Marketing API** (caducan en fechas distintas: la Marketing API v23 murió el 9 jun 2026 y la Graph API v23 vive hasta oct 2027). `npm run check` falla si a la fijada le quedan menos de 90 días en cualquiera de las dos, o si la tabla tiene más de 180 días: se mira en developers.facebook.com (changelog de versiones de las dos API) y se sube.
- **El freno por uso** vive en el cliente (`pedir` en `crearMeta`), así que lo hereda todo lo que hable con Meta. Lee `X-App-Usage`, `X-Business-Use-Case-Usage` (`estimated_time_to_regain_access` va en minutos) y `X-Ad-Account-Usage` (`reset_time_duration` va en segundos) con `leerUso`. Con un código de límite (`CODIGOS_LIMITE`: 4, 17, 32, 613, 80000–80014) o con el uso al 100 %, no vuelve a llamar hasta que pase lo que pidió Meta, o `ESPERA_LIMITE_MIN` (5). Mientras tanto contesta un `ErrorMeta` pasajero con `frenado: true`, sin gastar cuota. **Todo sondeo nuevo multiplica su intervalo por `meta.uso().ritmo`** (1, 2 desde el 75 %, 4 desde el 90 %). Una llamada nueva a Meta nunca usa `fetch` directo: va por `graph`, `enviar`, `borrar` o `subirReanudable`.
- **Los permisos, por función:** `PERMISOS_POR_FUNCION` (`lectura`, `publicar`, `anuncios`, `mensajes`) y `faltanPorFuncion`. `token.faltan` sigue siendo solo lo de leer (Analíticas avisa en ámbar con eso); `token.faltanPor` dice el resto, y no es una alarma.
- **El Meta de mentira** es uno: `tests/meta-stand.mjs` (`crearMetaStand`), como `fetch` para los tests y como servidor (`escuchar()`) para `npm run check`. Tiene estado (`st`), modos de fallo (`fallar`: límite, parámetro, pago pendiente, anuncio rechazado o con problemas), cabeceras de uso (`uso`) y `torcer(llamada, st)`. Habla publicar, Analíticas, la Marketing API (con las reglas de v26: sin Explorar, `advantage_audience` explícito en categorías especiales, presupuesto mínimo, `validate_only`, `copies`, el lote de 50) y la Bandeja (comentarios, ocultar, conversaciones, la ventana de 24 h). **Un test de Meta nuevo usa este stand, nunca uno propio**, y cada regla de Meta que se le añada lleva su caso en `tests/meta-stand.test.mjs`.
- **Ajustes → Anuncios** (`settings.mjs`, grupo `anuncios`): ids de Meta (texto opcional con `pattern`; `act_` se completa solo) y topes con los valores del §12 del plan. Ningún campo de Ajustes lleva un token ni un secreto (`tests/settings.test.mjs` lo comprueba).

## Lo publicado, Llenar la semana, plantillas y el teléfono (C2 y C3, 8 oct 2026)

Pedido del dueño: «haz lo que falta de C2 y C3» (`docs/analisis-editor-contenido-2026-10-08.md`).
- **Lo ya publicado** (`src/contenido-publicadas.js`, puro): `emparejar(piezas, publicaciones)` junta lo que Analíticas guardó de Meta (`metricas.leer().publicaciones`) con la pieza de la que salió: por el **enlace** (`salida.redes[red].url` de la cola), o por la **red, la hora (± 35 min; ± 10 sin texto) y el principio del texto** (`huellaTexto`; un texto distinto nunca casa). `GET /api/contenido/publicadas?desde=&hasta=` → `{ fuente, porPieza: { id: [resultado] }, sueltas }` (`publicadas` en `crearRutas`, de `serve.mjs`). La tarjeta suma alcance e interacciones (`.pz-res`; en el mes, `.pz-rs` con el ojo) y la vista previa al pasar los da red por red; lo **suelto** (hecho a mano, o antes de la oficina) es una tarjeta de solo lectura (`.pz-pub`, `data-ev="m:<id>"`: un `<a>` a su enlace, no se arrastra ni se abre como pieza) con el chip **«Publicado fuera»** (`ao.ct.pub`). En la demo, cifras de ejemplo rotuladas (`publicadasDemo`; la aprobada que venció sigue siendo el ejemplo de «vencida»).
- **Mejores horas de una red** (`ao.ct.horaRed`, compartida): el selector va en la leyenda de la semana (`[data-horared]`) y en «cuándo sale» del editor (`[data-hred]`). **Zona horaria:** `ajustes.zona` (`zonaHoraria()` en `serve.mjs`: el nombre IANA y `UTC±hh:mm`) en las cifras (`.ct-tz`) y en «Sale el…» del editor. **Cuota de Instagram** (Meta directo): el conductor apunta la última que da Meta (`/content_publishing_limit`, al preparar o al comprobar) y cuenta lo publicado desde aquí en 24 h (`cuota()`); va en `GET /api/contenido/cola → conductor.cuota` y en el aviso de Programación (`cuotaTxt` en `src/contenido-cola.js`).
- **Llenar la semana** (`src/contenido-llenar.js`, puro): `huecos()` (los días sin nada en esas redes —las ideas no cuentan— con su mejor hora o las 18:00, nunca a menos de una hora), `queVuelven()` (lo que salió con interacciones de la mitad de arriba y que no salió —ni una copia, `origen: vuelve:<id>`— en `SEMANAS_SIN_REPETIR` = 8), `repartir()` (lo que vuelve tapa uno de cada tres huecos) y `encargo()` (el texto de la tarea). `GET /api/contenido/llenar?desde=&dias=&redes=` propone; `POST` crea las copias que vuelven **en revisión** y UNA tarea a tu puesto de redes (`encargar` → `newTask` con `agenteDeContenido`, `needsOk: false`: solo deja borradores). Un agente: 403. Programación gana **«Borradores de la semana»** (los borradores de los próximos 7 días, con Aprobar en cada uno y «Aprobar los N que pueden salir», `[data-okbor]`): el dueño puede aprobar un borrador directamente.
- **Plantillas** (`contenido/plantillas.mjs`): `<cerebro>/Contenido/Plantillas/<nombre>.md`, con la forma de la nota de una pieza (`parsear`/`serializar`) sin día, hora, archivos ni estado. **Viajan por GitHub** con las notas del equipo: nada privado. Reemplazar por el mismo nombre conserva el original; borrar va a `.papelera/`. `GET|POST /api/contenido/plantillas`, `DELETE /api/contenido/plantillas/<nombre>` (un agente: 403); los agentes las leen con `ver_plantillas_contenido`. «Guardar como plantilla» va en el pie de la pieza; «Desde una plantilla…» en «+ Crear» abre una pieza nueva con su forma (`openNew({ …, extra })`, se guarda sola).
- **Las dos ventanas** («Llenar la semana» y «Desde una plantilla», `src/contenido-herramientas.js`, estilo `src/css/contenido-herramientas.css`) **viajan con el editor** en `dist/pieza-editor.js` (`window.AO_PIEZA.llenar` / `.plantillas`; la página las pide con `panel.herramientas()`): la página no crece.
- **Telegram** (`telegram.mjs`): `/contenido` manda lo que espera tu OK (en revisión, y los borradores de la semana que pueden salir), cada pieza con su **foto** (`sendPhoto` multipart con la primera imagen; si no se puede, solo el texto) y su pie (`piezaTexto`, ≤ 1024), con **✅ Aprobar** (solo si puede salir, `piezaLista`), **↩ A borrador** y **👁 Ver completo** (`pa:`/`pb:`/`pv:`), y arriba «Aprobar las N que pueden salir» (`pt:`). Cuando un agente deja un borrador, llega la tarjeta (`alBorrador` → `TG.pieza`) en lugar del aviso de texto (`notice` de tipo `contenido-borrador`, que Telegram no repite). Solo el dueño: un aprobador delegado no las ve.
- Tests: `tests/contenido-c3.test.mjs`, la cuota en `tests/meta-publicar.test.mjs`. Recorrido: `node scripts/c3-contenido-recorrido.mjs` (1512 claro y oscuro, 1024 y 390).

## Publicar en redes (plan M0–M5, 6 oct 2026)

Lo aprobado en Contenido sale de verdad. Análisis y plan: `docs/analisis-metricool-cli-2026-10-06.md` (lo de Metricool que no confirma su MCP oficial va marcado «por verificar»).
- **Metricool** (`contenido/metricool.mjs`, cliente puro): `METRICOOL_USER_TOKEN`, `METRICOOL_USER_ID` y, si hay varias marcas, `METRICOOL_BLOG_ID` (variables de Windows, **nunca en archivos**; plan Advanced). La key va solo en la cabecera `X-Mc-Auth`, jamás en la dirección ni en un error. `METRICOOL_API_BASE` apunta a un doble. Los tests usan `tests/metricool-stand.mjs`, nunca la API real; con la key real, `node scripts/check-metricool.mjs` (solo borradores; `--bandeja`, `--analiticas`).
- **Conductores** (`contenido/conductores.mjs`), una sola interfaz `{listo, programar, retirar, estado}`: **simulacro** (por defecto: «publica» en `data/contenido/simulacro.json`), **metricool** (sube los archivos —PNG/WebP a JPEG si va a Instagram— y programa; publica Metricool con la máquina apagada) y **meta** (8 oct 2026, F3; ver abajo).
- **Meta directo** (`contenido/meta-publicar.mjs`, guía `docs/conectar-meta.md`), con el token de Analíticas (`META_ACCESS_TOKEN` + los permisos de publicar; `contenido.metaPagina` elige la página si hay varias):
  · **Facebook** (foto, varias fotos, video, texto) queda **programado en Meta** (`published=false` + `scheduled_publish_time`, de 10 min a 30 días) y sale solo; su historia, a su hora desde aquí.
  · **Instagram no se programa por API**: el pulso (cada 30 s en `serve.mjs`, solo en modo real) prepara el contenedor 15 min antes (imagen: foto temporal sin publicar en la página y su dirección de Meta, POR VERIFICAR; video: subida reanudable a rupload) y lo publica a su hora. Hasta 30 min tarde todavía sale; después, FALLÓ con el motivo. Una hora antes, un aviso (y Telegram): «no la apagues». Programación lo dice: «SALE A SU HORA» (`local` en `redes`).
  · **Nunca dos veces**: el contenedor se lee antes de publicar (PUBLISHED = ya salió) y lo que Meta no contesta queda «incierta» hasta leerlo; un POST de Facebook sin respuesta no se repite (se pide mirar la página).
  · `programar()` no llama a Meta (valida y apunta en `data/contenido/meta-agenda.json`, sin tokens); programar, retirar y el pulso van **en fila**. Al publicar, `programador.refrescar('meta')` lo mira en el acto (`porId` mira con el conductor que entregó).
  · Solo Instagram y Facebook: otra red de la misma pieza sale «fallo» con el motivo. Instagram: JPEG (se convierte), MP4/MOV, carrusel 2–10. «Comprobar conexión» de Programación comprueba Meta (página, Instagram, permisos, cuota). Con el token real: `node scripts/check-meta-publicar.mjs` (sin publicar; `--video`, `--facebook`). Tests: `tests/meta-publicar.test.mjs`.
- **La cola** (`contenido/programador.mjs`, `contenido/entrega.mjs`): `planear()` es puro y decide; `tick()` cada minuto lo hace. Tres candados: aprobada con su huella · el modo lo permite (`contenido.modo`: simulacro · real · apagado) · el conductor está listo. Un minuto de gracia tras aprobar; se entrega `contenido.entregarHorasAntes` (24) antes; más de 3 min tarde = «vencida», no se manda. Pasajero → reintento a 1, 5 y 15 min. **Doble testigo:** `data/contenido/cola.json` y la cabecera `entregada:` de la nota; si se pierde la cola, se adopta, nunca se publica dos veces. Lo publicado o publicado en parte nunca se vuelve a mandar. Cambiar lo que sale de una aprobada la retira del conductor.
- **API:** `GET /api/contenido/cola`, `POST /api/contenido/cola/tick`, `POST /api/contenido/conductor/comprobar`, `POST /api/contenido/piezas/<id>/(entregar|reintentar|quitar)` (un agente: 403). Cada entrega queda en `data/audit/` (`kind: contenido`).
- **Guardián:** cualquier escritura en un servidor MCP que se llame «metricool» se bloquea (`code: redes`): publicar va solo por Contenido.
- **Nueve redes (M2):** Instagram, Facebook, LinkedIn, X, Threads, Bluesky, TikTok, Pinterest y YouTube (`REDES` en `contenido/piezas.mjs`; reglas en `src/contenido-reglas.js`, con `longitudPara`: X cuenta un enlace como 23 y Bluesky grafemas). Cada red puede llevar **su propio texto** (`textos[red]`, en la nota como `## Texto de LinkedIn`…; sale tal cual, sin los hashtags) y Pinterest, YouTube y TikTok sus **opciones** (`pinterest {tablero, titulo, enlace}`, `youtube {titulo, privacidad, paraNinos}`, `tiktok {privacidad}`, en la cabecera como JSON). La huella solo los cuenta si tienen algo: lo aprobado antes de M2 sigue aprobado. **Ajustes → Contenido → «Redes que usas»** (`contenido.redes`, por defecto Instagram y Facebook; tipo de campo `checks`) decide qué redes salen en una pieza nueva y en los filtros; las demás, en «Más redes». Los arreglos `texto-red:<red>` y `opciones:<red>` abren ese campo. Una vista previa por red (`src/contenido-preview.js`). Topes que las redes cambian a menudo van al valor prudente y «por verificar». Recorrido: `node scripts/redes-recorrido.mjs`.
- **Mejor hora y Analíticas para agentes (M3):** `contenido/mejor-hora.mjs` saca la mejor hora de Metricool (`/v2/scheduler/besttimes`, 12 h en `data/contenido/mejores-horas.json`; si falla, lo último que dio) o, si no, de lo ya publicado en Analíticas (desde 8 publicaciones); el cálculo puro es `src/contenido-hora.js` (`cuadricula`, `mejoresDelDia`, `siguienteBuena`, `nivel`). `GET /api/contenido/mejor-hora?redes=` y `GET /api/contenido/analiticas/resumen?dias=` (`contenido/resumen-analiticas.mjs`: cifras, formatos, las que más movieron y las horas, en palabras). La semana y el día de Contenido sombrean las mejores horas (`slot` opcional de `timeGridHTML`; sin él, el HTML no cambia) con su leyenda junto a las cifras; el panel ofrece «Siguiente buena hora» y «Mejores ese día». Los agentes: `ver_analiticas` y `ver_mejor_hora` (empiezan por «ver»: el guardián las lee como lectura) y la skill `plan-contenido` las usa. Recorrido: `node scripts/mejor-hora-recorrido.mjs`.
- **Bandeja (M4):** `contenido/bandeja.mjs` trae de Metricool (`/v2/inbox/*`, por verificar; cada 10 min si hay key) los mensajes, comentarios y reseñas de todas las redes a `data/contenido/bandeja.json` (`resumenMensaje` lee los nombres de campo probables). Estados: nuevo · borrador · respondido · descartado · falló. Lo que escribe un cliente pasa por `injectionIn` y queda 🛡 si trae órdenes escondidas. Un agente deja el **borrador** (`ver_bandeja`, `crear_borrador_respuesta`; el botón «Pedir borradores a Marketing» crea esa tarea); **enviar es del dueño** (403 para `por: 'agente'`), con un segundo clic, una sola vez, y según el modo: simulacro se apunta sin salir, apagado no sale, real va a Metricool (si falla queda «falló» con el texto). API: `GET /api/contenido/bandeja`, `POST …/bandeja/sincronizar`, `PATCH …/bandeja/<id> {borrador}`, `POST …/bandeja/<id>/(enviar|descartar|reabrir)`. La vista es el tercer modo de Contenido, BANDEJA con su número (`src/contenido-bandeja.js`; en el teléfono PROGRAMACIÓN se lee «COLA»). Recorrido: `node scripts/bandeja-recorrido.mjs`.
- **Lo demás (M5):** **PERFIL**, una vista más del calendario de Contenido (`src/contenido-perfil.js`): la cuadrícula de Instagram a 3:4, lo programado encima de lo publicado; arrastrar una casilla sobre otra (o ‹ › con teclado o dedo) les cambia día y hora, con DESHACER (una aprobada vuelve a revisión y DESHACER la reaprueba). **Repetir…** en el pie de una pieza (`src/contenido-repetir.js`, `POST /api/contenido/piezas/<id>/repetir {cada, veces}`, solo el dueño): copias como borradores cada día, semana, 2 semanas o mes (hasta 12; un 31 cae el último día de los meses cortos). **Selección múltiple** en Programación: casillas y una barra para aprobar las que pueden salir, pasar a revisión, mover de día (con DESHACER) o a la papelera (8 s para deshacer). **Informe del mes** (`contenido/informe.mjs`, sin modelo, «sin datos» cuando no se sabe; en el mes en curso separa lo que está por salir): botón INFORME DEL MES en Analíticas (`src/analiticas-informe.js`), `GET|POST /api/contenido/informe?mes=` (POST lo guarda en `<cerebro>/Agents Office/informes/AAAA-MM redes.md`, que no viaja) y `ver_informe_mes` para los agentes. **Evaluaciones de skills:** `evals/<skill>/evals.json` (pedidos y expectativas; la primera, `plan-contenido`) y `node scripts/evals-skill.mjs <skill> [--correr]` (con la skill y sin ella, y un juez con evidencia; sin `--correr` no gasta). Quedan fuera del plan: competidores, hashtags y smart links. Recorrido: `node scripts/m5-recorrido.mjs`.
- **La interfaz:** Programación (`src/contenido.js`, `textoSalida` en `src/contenido-cola.js`) dice por pieza EN COLA · ENTREGANDO · PROGRAMADA/EN SIMULACRO · PUBLICADA (con enlace) · EN PARTE · FALLÓ, con sus botones; el aviso de arriba dice el modo. Ajustes → Estado (O) tiene «Publicación». Prueba visual: `node scripts/programacion-recorrido.mjs`.

## Tareas (plan T0–T6, 6 oct 2026)

Plan y decisiones: `docs/analisis-taskview-2026-10-06.md` (ideas de TaskView, **nada de su código**: su licencia prohíbe productos competidores). El dueño dijo «empieza con todo» y se tomaron las recomendaciones del §11: proyectos que cruzan departamentos, estados fijos, tareas también de personas, tablero por estados con carriles por departamento.
- **El módulo `tareas/`** (puro salvo `almacen.mjs` y `catalogo.mjs`; los puros los usan también la página y los tests):
  - `modelo.mjs`: **`crearTarea()` es la única fábrica**. En `serve.mjs`, toda tarea nace por `altaTarea()` (barra, API, Dimitri, rutina, disparador, «repetir», Estudio), que aplica las reglas de la oficina una vez (el tope de importe pide el OK). Un sitio nuevo que crea tareas llama a `altaTarea`, nunca arma el objeto a mano. `normalizar()` migra lo de antes (v1 → v2) al leer.
  - Campos nuevos: `prioridad` (alta · media · baja), `etiquetas`, `limite` (para cuándo; `dueAt` sigue siendo cuándo ARRANCA), `estimacion` (min), `pasos` (el plan del enrutador, que el agente marca), `bloqueadaPor`, `proyecto`, `orden`, `version`.
  - `estados.mjs`: lo guardado sigue igual (`idea · scheduled · next · doing · waiting · done`); lo que se ve sale de `visible()` (fallida, bloqueada, en manos de una persona…). `puede(de, a, quién)` es la puerta de cada cambio de estado.
  - `almacen.mjs`: `data/tasks.json` de siempre. Cada `save()` deja la **bitácora** (`data/tareas/bitacora/AAAA-MM.jsonl`: estado, campo, paso, comentario, quién) y emite al **bus** (`eventos.mjs`). Pasa `{ por }` cuando sepas quién. **Una ejecución guarda con `guardarRun()` / `guardarEjecucion()`, que MEZCLA con lo que hay en disco** (`cambios.mezclar`): lo que el dueño hace mientras un agente trabaja ya no se pierde. Nunca guardes una copia vieja de la lista después de un `await`.
  - `cola.mjs`: `planear()` decide qué arranca: prioridad → fecha límite → orden manual → antigüedad. No arranca lo bloqueado, lo de una persona, lo que espera reintento ni el agente ocupado. Las piezas de un equipo cuentan cada una. `pump()` y el «turno» de la página usan lo mismo.
  - `dependencias.mjs` (un círculo se rechaza), `orden.mjs` (orden fraccional), `permisos.mjs` (quién cambia qué campo), `agenda.mjs`, `progreso.mjs`, `resumen.mjs` (analíticas, cada cifra con sus `ids`), `catalogo.mjs` (proyectos y etiquetas en `data/tareas/`).
  - `rutas.mjs`: `/api/tareas/*` (organizar, estado, paso, nota, bloqueo, orden, lote, proyectos, etiquetas, agenda, resumen, borrador, registro). Las de siempre (`/api/tasks`) siguen en `serve.mjs`.
  - El despachador de dependencias desbloquea y avisa al terminar una tarea.
- **Los agentes** (`tareas-mcp.mjs`, en todas las mesas; `tareas` va en `INTERNAL` de `safety.mjs`): `ver_mi_tarea`, `ver_tareas`, `ver_agenda` (con `dias` y `dept`), `ver_rutinas` (9 oct 2026, solo leer), `marcar_paso`, `anotar_en_bitacora`, `pedir_bloqueo` (con un texto, nace «Para ti: …» para el dueño, prioridad alta; la tarea se para con lo que lleva y sigue sola), `crear_borrador_tarea` (nace **idea**) y `registrar_trabajo`. **Ninguna aprueba, envía, borra ni cambia estado, prioridad o fecha límite**; `tests/tareas-servidor.test.mjs` falla si aparece una así. Una tarea en curso está **tomada** (`tomadaPor`).
- **La vista Tareas** (tecla **H**, botón del dock; en el teléfono va en el «⋯»):
  - Va en un **paquete aparte**: `dist/tareas-vista.js`, que arma `build-tareas.mjs` desde `src/tareas/vista.js` con `src/css/tareas.css`. La página solo lleva `src/tareas-carga.js`, que lo trae al abrir. `serve.mjs` lo sirve en `/tareas-vista.js` y lo reconstruye si es de otra construcción (su primera línea `/*ao-tareas:<versión>*/`). Un módulo de la vista se importa solo desde `src/tareas/`; si la página lo importa, `build.mjs` falla.
  - Las pestañas:
    - Mías (`mias.js`, plan D): la lista personal del dueño (ver «Las tareas del dueño»).
    - Inicio (`inicio.js`).
    - Lista (`lista.js`, con filtros en la dirección `#tareas=lista&prio=alta&t=<id>`).
    - Tablero (`tablero.js`, con `movimiento()` puro).
    - Proyectos (`proyectos.js`, con el mapa: `capas()`).
    - Medidas (`medidas.js`).
  - El detalle (`detalle.js`) se guarda solo a los 500 ms; sus campos se ordenan y se ocultan («Personalizar», `ao.tv.campos`).
  - La fila es una sola (`comun.js → filaHTML`): el título es el botón que la abre.
  - Arrastrar nunca usa `confirm()`: hace el cambio y ofrece DESHACER.
  - En la demo, los datos de ejemplo de `src/tareas/demo.js`.
  - Recorrido: `node scripts/tareas-recorrido.mjs` (con `AO_AXE=<axe.min.js>` pasa axe).
- **Añadir rápido** (`tareas/rapida.mjs`):
  - `#etiqueta` (se crea al vuelo) y `!alta` o «urgente» para la prioridad.
  - «para el viernes», «antes del 20» o «hasta el 3 de noviembre» son la **fecha límite**.
  - «el lunes a las 9», sin «para», es cuándo **arranca** (`parseOnce`).
- **Calendario (P):** la fecha límite sale como «⚑ vence» (`kind: 'limite'`, `src/css/calendario-limite.css`) y lo programado dice su duración. El `.ics` lleva la duración de la estimación y la fecha límite como evento de día.
- **Dimitri y los proyectos (T4):**
  - Su plan puede traer `proyecto` (nuevo, o `{id}` de uno de `<proyectos>`). Cada pieza puede traer `prioridad`, `limite` y `espera` (índices de otras piezas; los círculos se rompen en `sub.parsePlan`).
  - Al pulsar ENVIAR, cada pieza nace con su id ya puesto (`newTask({ id })`), así que «espera a las fotos» existe antes de que la cola pueda arrancarla.
  - Ve `sub.proyectosText` (progreso, atrasos y quién bloquea a quién) y las vencidas y bloqueadas en `<estado>`.
- **Ritmo (T5):**
  - Las rutinas pueden ser `monthly` (`day` 1..31 o −1, o `nth` + `weekday`), con `end` y `count` (ver «Routines»).
  - Una tarea puede llevar `repetir { cada, modo: fijo|alcompletar, hasta? }` (`tareas/ritmo.mjs`): al terminar bien nace la siguiente, y solo hay una abierta a la vez.
  - Los avisos de fecha límite llegan la víspera, el día (si es de una persona) y al vencer, una vez cada uno (`t.avisos`). Si es de una persona, también por Telegram.
  - Un proyecto atrasado avisa una vez al día.
  - El resumen del lunes trae las cifras de las tareas (`tareasSemana`).
- **Pulido (T6):**
  - Cronómetro de las personas (`tareas/cronometro.mjs`): uno activo por persona, a mano en Inicio y en el detalle.
  - **Webhooks salientes** (`tareas/webhooks.mjs`), en `office.config(.local).json → tareas.webhooks: [{ id, url, eventos, secreto }]`:
    - `secreto` es el NOMBRE de una variable de entorno: la clave nunca va en un archivo. Con ella se firma `X-AO-Firma: sha256=…`.
    - Solo https, nunca a una red privada.
    - 3 intentos; tras 10 fallos seguidos se apaga y avisa. Su estado se ve en Medidas, con «Encender».
    - Sale lo justo: nunca el resultado ni los comentarios.
- Tests:
  - `tests/tareas-modelo.test.mjs`: lo puro.
  - `tests/tareas-servidor.test.mjs`: el almacén, las rutas y el MCP.
  - `tests/tareas-ejecucion.test.mjs`: con el serve.mjs real, el comentario hecho durante una ejecución sobrevive y la cola espera a la bloqueada.
  - `tests/tareas-vista.test.mjs`: la vista y su paquete.
  - `tests/tareas-ritmo.test.mjs`: Dimitri, las rutinas mensuales, repetir y los avisos.
  - `tests/tareas-pulido.test.mjs`: el cronómetro, los webhooks y los campos.

## Las tareas del dueño (plan D, 7 oct 2026)

El dueño también trabaja: tiene su lista, delega y toma trabajo de los agentes. Diseño y decisiones: `docs/analisis-tareas-del-dueno-2026-10-07.md` (ideas de TaskView, **nada de su código**).
- **Una tarea del dueño es una tarea con `person: 'Tú'`** (la marca de siempre: la cola no la arranca). **No tiene `agent`** y el `dept` es opcional (su «área»). Campos propios (`tareas/dueno.mjs`, todos opcionales): `deAgente` (de qué agente vino) · `tomada {at}` («Lo hago yo») · `sugeridaPor` (un agente la sugirió: nace `idea`) · `empezada` (la está haciendo: la columna «Haciendo»; `doing` sigue siendo solo «un agente la ejecuta») · `delegada {at, a: 'agente:<id>'|'persona:<nombre>', nota, como}` (la pasó a otro; la sigue en Delegadas) · `borradorAgente` (lo que el agente había dejado). El estado visible es **«Tuya»** (`estados.visible`); `waiting → next` es del dueño («Lo termino yo»).
- **Rutas** (`tareas/rutas-dueno.mjs`, que `serve.mjs` llama **antes** que `tareas/rutas.mjs`: si no, «mias» se leería como el id de una tarea): `POST /api/tareas/mias` (crear; `at` pasa a ser su fecha límite con hora; un agente: 403) · `GET /api/tareas/mias` (listas, cuentas y el texto para Dimitri; con `?desde=&hasta=`, las que vencen en esos días, para el calendario) · `POST /api/tareas/<id>/tomar` (de un agente: en cola, programada, idea, fallida o esperando OK; nunca en curso, de una rutina o de un equipo) · `POST /api/tareas/<id>/delegar {a: 'agente'|'persona', dept, agente?, persona?, nota?, needsOk?}` (sin agente: el que la tenía, o el enrutador, o el jefe; un importe sobre el tope pide el OK siempre) · `POST /api/tareas/<id>/empezar {empezar}` (con el cronómetro) · `POST /api/tareas/sugerir` (solo un agente o Dimitri; cinco sin responder por agente). `tomar` y `delegar` aceptan `deshacer: true` (el DESHACER de la página: devuelve la tarea como estaba, sin marcas). Hecha y reabrir son el `estado` de siempre (para lo tuyo: `hechaPor`, para el cronómetro).
- **Al tomar, la tarea deja su escritorio** (`agent` se quita, `deAgente` lo recuerda): no cuenta en la calidad ni en la carga de ese agente, y el panel 3D la quita del escritorio (`src/tasks.js`: el poll solo conserva tareas con agente). Los «Para ti» de `pedir_bloqueo` nacen igual, y para hoy. «PASAR A UNA PERSONA» (a mitad de una ejecución) conserva el escritorio como antes, con `deAgente`.
- **Los agentes** (`tareas-mcp.mjs`): lo del dueño sale «DEL DUEÑO (la hace él)» en `ver_tareas` (con `del_dueno: true`, solo eso) y en `ver_agenda`; lo delegado les dice «TE LA DELEGÓ EL DUEÑO» y su nota; **`sugerir_al_dueno`** deja una sugerencia en su Bandeja. Nunca toman, delegan, empiezan ni cierran lo del dueño. `serve.mjs → tareasText` se lo explica.
- **La vista** (`src/tareas/mias.js`, la pestaña **Mías**, la primera; `#tareas=mias&l=hoy`): rail de listas (en el teléfono, pastillas), lista con la casilla redonda (`data-hecha`), «+ Añadir tarea» con la fecha o el proyecto de la lista (`presetLista`), COMPLETADAS · N plegable y recordado, tablero personal (`movimientoMio`). El campo de arriba tiene **«Para mí»** (`value="yo"`, elegido en Mías). El detalle de una tarea tuya (`detalle.js`) cambia sus acciones y campos («Área», «Notas», «Delegar…» con su formulario `.tv-delegar`); el de un agente suma «Lo hago yo». Inicio abre con «Lo tuyo hoy»; la Lista tiene el filtro `quien`; el Tablero, la columna «Tuyas y de personas».
- **Dimitri**: `<estado>` trae `resumenDueno`; una pieza de su plan puede ir a `"dept":"dueno"` («Tú (tu lista)» en la tarjeta; nace tarea tuya al ENVIAR); con Tareas abierta, sus sugerencias son de lo tuyo.
- **Calendario (P)**: la capa **TUYAS** (`ao.cal.mias`, encendida; `src/css/calendario-mias.css`); un clic abre la tarea en Mías. El `.ics` las lleva como «☐». (8 oct 2026) La capa se vuelve a leer al abrir el calendario y cada 30 s (`refetchLayers`; antes, una sola vez por rango). La ventanita del día tiene **«PARA MÍ»** primero (`ctx.mias.create` → `POST /api/tareas/mias`; se recuerda en `ao.cal.yo`): sin modelo, esfuerzo ni equipo; la hora es la de tu tarea («TODO EL DÍA» en el mes, la hora tocada en la semana) y REPETIR la repite como tus tareas (`repetir`: cada día, semana, 2 semanas o mes), no como rutina.
- **El panel de la oficina (T)** (8 oct 2026, `src/tasks.js`, `src/css/panel-mias.css`): **«PARA MÍ»** encabeza el menú de departamento (`mine`; quita modelo, esfuerzo, REPETIR y EQUIPO; lee «para el viernes», «!alta», «#etiqueta» con `tareas/rapida.mjs`) y la línea **«Lo tuyo hoy · N»** (con las vencidas en rojo) abre Mías → Hoy (`ctx.mias.lista`); se cuenta con `tareas/dueno.mjs → cuentas` sobre la lista que ya trae el poll y no sale si es 0. Lo tuyo nunca entra en la lista de los agentes ni ocupa un escritorio.
- **Listas** (8 oct 2026): **Hoy** pone las vencidas aparte y arriba (`gruposHoy`; sin vencidas, sin títulos), **Próximos 7 días** lleva un título por día (`porDia`: «Mañana», «viernes 9 oct»…) y **Delegadas** deja pendiente, arriba y con el número en rojo, lo que el agente no pudo hacer (`fallo`: hecha con error y no detenida por ti; antes salía en «VOLVIERON HECHAS»).
- **Telegram**: `/mias` (o `/hoy`) con ✅ por tarea (`mh:<id>`), `/yo <texto>` (lee la fecha con `tareas/rapida.mjs`).
- Tests: `tests/tareas-dueno.test.mjs`, `tests/telegram.test.mjs`. Recorridos: `node scripts/mias-recorrido.mjs` (con `AO_AXE=<axe.min.js>` pasa axe) y `node scripts/lo-tuyo-recorrido.mjs` (calendario, panel y Ajustes → Estado).

## Everything else

- `npm run check` is the loop. Run it after any change to code; fix what is red.
- `README.md` says what the product does. Keep it true to the code.
- Release: `node scripts/release.mjs --push` (owner only).
