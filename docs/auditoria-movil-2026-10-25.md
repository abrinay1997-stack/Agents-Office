# Auditoría móvil y plan de rediseño — 25 oct 2026

Pedido del dueño tras abrir la oficina en la nube desde el celular: «la visualización en el celular es poco accesible, no está optimizada para móviles en absoluto. El navbar es muy incómodo. La navegación por toda la oficina, el calendario, las tareas, todo es incómodo. No parece una aplicación móvil. La versión móvil debería tener su propia versión totalmente optimizada y hecha para móviles. El panel de tareas en móvil es muy incómodo, inaccesible. Los conectores deberían verse bien con sus iconos en móvil.»

Este documento es solo diagnóstico y plan: **no cambia código de la app**. Lo construye otro equipo.

## 0. Cómo se midió (y qué no)

- Herramienta: `scripts/movil-auditoria.mjs` (nueva, solo desarrollo). Levanta una oficina temporal (`serve.mjs`, cerebro copiado, sin keys, Claude que no responde), con 4 tareas de agentes, 5 tareas del dueño y 2 piezas de contenido, y la abre con Playwright/Chromium emulando **iPhone 13 (390×844), Pixel 5 (360×800) e iPhone SE (320×568)**, `hasTouch`, `isMobile`, escala 2. Los toques son `touchscreen.tap(x, y)` sobre el centro del elemento (`page.tap` no sirve: espera a la animación de la escena 3D, que en headless no termina).
- Por pantalla mide con `getBoundingClientRect` y `getComputedStyle`: objetivos táctiles <44 px, campos con fuente <16 px, texto <12 px, desbordes horizontales (`scrollWidth`) y scrolls anidados. Resultados crudos en `docs/capturas-movil/antes/medidas-{390,360,320}.json` (y `medidas-390-p3.json`).
- Capturas: `docs/capturas-movil/antes/<pantalla>-<ancho>.jpg` (JPEG calidad 60; 4,5 MB en total). A 390 están todas; a 360 y 320, las 12 pantallas principales.
- **No se pudo verificar** (decirlo importa más que adornarlo): Safari real en un iPhone (barra de URL que sube y baja, `100vh`, notch, teclado virtual, rebote de scroll); el teclado virtual tapando campos (el emulador no lo dibuja; se razona por código); la oficina **en la nube** (se auditó la local, que sirve la misma página; `nube.js`/`nube.css` solo se leyeron: ocultan su barra bajo 440 px); la barra de conectores **con conectores reales** (en el entorno de prueba hay 0, así que los iconos se ven en la captura de escritorio, no en móvil); el chip ⚠ de aprobaciones con borradores pendientes (se midió oculto); el contenido del historial 🕘 de Dimitri y de un chat de departamento (las capturas de esos dos pasos no abrieron la pantalla y se descartaron); el menú Ctrl+K con resultados.
- Los números de «toques» son los de tocar, no los de escribir.

## 1. Resumen ejecutivo

**La oficina móvil de hoy es la página de escritorio encogida con parches `@media`.** No es un fallo de una pantalla: es de arquitectura. El dueño tiene razón en las cuatro quejas, y se pueden demostrar con números:

1. **El navbar** son 6 botones de **30×30 px** separados 3 px, arriba a la derecha (la peor zona del pulgar en un teléfono de 844 px), más un «⋯» que esconde 6 herramientas (Tareas, Analíticas, Anuncios, Cerebro, Negocio, Ajustes) detrás de **2 toques**. Mide 30 px frente a los 44 px de Apple/WCAG 2.5.5 y los 48 dp de Material. Sin etiquetas: hay que adivinar qué es cada icono.
2. **Los conectores no existen en el móvil.** `@media (max-width: 760px) { #topconn { display: none } }` (`src/shell.html:1579`) los quita; el único camino es Ajustes → pestaña «Conectores» (4 toques y un scroll horizontal de pestañas). No hay forma de ver un icono de conector en un teléfono. Esto es lo que el dueño pide arreglar.
3. **El panel de tareas (T) es una hoja a 46 vh que tapa la escena** (`#tpanel { height: 46vh }`, `shell.html:1165`), con el formulario «Nueva tarea» de 4 controles (departamento, modelo, esfuerzo, REPETIR, EQUIPO, AGREGAR) y 12 filtros. Al cerrarla queda una pestaña vertical «TAREAS 4» pegada al borde derecho a media altura, que se confunde con el borde del sistema (el gesto de «atrás» en Android). Los 4 campos del panel miden 10,5–13 px.
4. **La navegación no tiene un «dónde estoy» ni un «volver»**: cada herramienta es una vista a pantalla completa con su propia banda negra y su ✕; entre una y otra hay que volver al dock de arriba. Calendario, Tareas, Contenido, Anuncios y Analíticas usan bandas negras de 140–260 px de alto que se comen un tercio de una pantalla de 568 px.
5. **Es una aplicación de teclado**: Costos (U), Estado (O), el buscador (Ctrl+K), «Aprobar todas», la hoja de atajos «?» solo existen con teclado. Costos no tiene botón en el móvil (`#usageDock` se oculta bajo 1100 px) y el buscador global no tiene ningún botón en ningún tamaño.

Lo que **ya está bien** y hay que conservar: tipografía base de 16 px en el cuerpo; cero desborde horizontal de la página a 320/360/390 (`scrollH = 0` en las 37 pantallas medidas); las vistas ya son a pantalla completa (no ventanas flotantes); la agenda del calendario (tecla A) ya es una vista de teléfono decente; Tareas → Mías con casilla redonda grande y la tarjeta «Lo tuyo hoy»; el Estudio con selector de formato en cuadros; el modo oscuro; `prefers-reduced-motion`; tener `data-view`/`modal.js` como base de foco.

**Números del estado actual (390 px)**

| Medida | Resultado |
|---|---|
| Objetivos táctiles <44 px en pantalla (por vista) | entre 5 y 37; en la mayoría de vistas **todos** los visibles (p. ej. Tareas Inicio 32 de 32; Calendario 28 de 32; Contenido 20 de 20) |
| Botones del dock | 30×30 px, separación 3 px, las 6 herramientas visibles |
| Campos con fuente <16 px (zoom automático de iOS al enfocar) | casi todos: panel de tareas 13/10,5/10,5 px, Estudio 14, Dimitri 13,5, Ajustes 13,5, buscadores del calendario 12,5, selector de Contenido 12 |
| Textos <12 px | 17–30 por pantalla (etiquetas en 10,5 px: pestañas del calendario, de Contenido y Analíticas, nombres de departamento) |
| Scroll horizontal de la página | 0 px en todo (bien) |
| Scroll anidado (panel dentro de panel) | 1 en Tareas, Calendario, Analíticas, Anuncios, Estudio, Ajustes |
| `viewport-fit=cover` / `env(safe-area-inset-*)` | **0 usos** en `shell.html` y `src/css/` (hay contenido bajo la barra de inicio de un iPhone) |
| `dvh` | solo en `estudio.css`; Ajustes, Costos, Negocio y las ventanitas del calendario usan `100vh` (`shell.html:1708, 2182, 2211, 2223`) |
| Tamaño de letra mínimo declarado | ~1.020 líneas de `shell.html` y `src/css/` declaran un `font-size` de 10–14,5 px (conteo con `grep`, aproximado) |

**Toques para las 10 tareas comunes (desde la vista general, a 390 px, medidos con el script salvo donde se dice)**

| Tarea | Hoy | Meta del rediseño |
|---|---|---|
| Ver mis tareas de hoy | 1 (línea «Lo tuyo hoy · 3» del panel) + scroll | 1 (pestaña Hoy) |
| Añadir una tarea mía | 2 en el panel (elegir «Para mí» + escribir + AGREGAR = 3 en realidad) / 4 en Tareas → Mías | 2 (botón «+» flotante, escribir, Enter) |
| Aprobar un borrador | no medido (chip ⚠ solo aparece con pendientes; por código: ⚠ → ventana → detalle → Aprobar ≥3) | 2 (insignia → tarjeta con deslizar o botón) |
| Ver el calendario de hoy | 1 (icono) — abre Agenda | 1 |
| Hablar con Dimitri | 1 (inicial «D») | 1 (pestaña) |
| Mirar el Cerebro | 2 (⋯ → Cerebro) | 2 (Más → Cerebro) o 1 desde Inicio |
| Ver un conector | **imposible en la barra**; 4 por Ajustes | 1 (chip en Inicio) o 2 |
| Cambiar un ajuste | 5 (⋯, Ajustes, pestaña, campo, Guardar) | 3 |
| Ver un aviso | ≥4 (Ajustes → Avisos) | 1 (campana en la cabecera) |
| Abrir el Estudio | 1 | 1 |

## 2. Hallazgos por pantalla

Severidad: **C** crítico (bloquea o se equivoca de objetivo), **A** alto (fricción diaria), **M** medio, **B** bajo. «Cap.» = captura en `docs/capturas-movil/antes/`.

### 2.1 Vista general (oficina) y barra superior — `01-oficina-{390,360,320}`

- **C** Dock de 6 iconos de 30×30 px con 3 px de hueco, arriba a la derecha. A 320 px los iconos quedan a 33 px de centro a centro. La zona del pulgar derecho en un teléfono de 844 px empieza ~450 px más abajo. (`dockVisible` en `medidas-*.json`.)
- **C** Cinco herramientas esconden sus nombres detrás del «⋯»; el menú (cap. `02-panel-tareas-390`) repite el nombre largo con tecla de atajo («Analíticas: cómo rinden tus redes · R»), que en un teléfono no sirve. Un menú de 6 filas de 56 px tapa la escena.
- **A** Sin «dónde estoy»: ninguna pestaña activa en el dock fuera de que el icono se pinte negro; en el «⋯» no se ve cuál de las 6 está abierta.
- **A** Los rótulos de departamento sobre la escena 3D son botones de 109–150×32 px con texto de 10,5 px (`.b-name`), y los números (7, 6, 4) se leen como decoración. La escena (`#scene`, `touch-action: none`) captura todo gesto: no se puede hacer scroll vertical de la página desde ella, y el rotulado se solapa (ENTREGAS con VENTAS, cap. 01).
- **A** Aviso de aprobaciones ⚠ en la barra: a 320 px empuja al logo con puntos suspensivos (regla de `dock.css`); su fuente es de 11 px.
- **M** La nube oculta su barra (perfil, equipo, presencia) bajo 440 px (`nube.css:14`): en el móvil no se ve quién está conectado, ni se puede cambiar de usuario sin ir a Ajustes.
- **M** Pie «1.1.1_ © 2026 · Agents Office by Abrinay» a 10,5 px sobre el contenido, flotando encima del panel (cap. 01).
- **B** Controles de zoom (+, −, ⌂) de 66×66 px sobre la escena: grandes y bien situados; conservar la idea.

### 2.2 Panel de tareas (T) — `01-oficina`, `02-panel-tareas`

- **C** El panel es una hoja inferior permanente de 46 vh (≈390 px de 844). Con ella abierta, el 55 % de la escena y de su botón de zoom quedan tapados, y el contenido es: selector de departamento, campo de texto de 13 px, selector de modelo y esfuerzo (10,5 px, `.tp-model`, `.tp-effort`), REPETIR, EQUIPO, AGREGAR, «ESTADO DE TAREAS», pestaña «LIVE · CLAUDE API», «Lo tuyo hoy», buscador y 12 chips de filtro. Son 37 objetivos <44 px.
- **C** Al plegarlo (`tpMin`) queda una pestaña vertical «TAREAS 4» a media altura del borde derecho (cap. `02-panel-tareas`): unos 50×110 px (estimado de la captura), pegada al borde donde actúa el gesto «atrás» de Android/iOS; fácil de activar por error y difícil de encontrar.
- **A** El panel y la vista Tareas (H) son **dos interfaces de tareas distintas** con los mismos datos: el dueño no sabe cuál usar; el panel no tiene detalle de tarea ni estados, solo lista.
- **A** El campo «Nueva tarea para Marketing» se corta a media palabra (`Marketir`) y el icono de ampliar (↗) está a 22 px.
- **M** Doble nombre «ESTADO DE TAREAS» y «TODA LA OFICINA»: texto de cabecera que no es una acción.

### 2.3 Vista Tareas (H) — Mías · Inicio · Lista · Tablero · Proyectos · Medidas — `03-…`, `03b…03g`

- **A** Cabecera negra de 292 px (de 844) con título, ✕ y 6 pestañas en una fila que se desborda (`#tvTab-medidas r=455`, scroll horizontal oculto): «Medidas» queda fuera de pantalla y no hay indicio.
- **A** Debajo, una fila de «Añadir / Buscar», un selector de departamento (13,5 px), «Como idea», «Añadir» y un campo de 15 px: 3 filas de controles antes de ver la primera tarea; la lista empieza a 540 px de 844.
- **A** **Dos botones «Añadir»** (el de la pastilla y el de la fila) con el mismo nombre y distinta función.
- **M** El tablero (cap. `03d`) ya está en una columna por estado con chips: aceptable; pero las tarjetas se arrastran, y arrastrar con el dedo choca con el scroll (no hay «mover a…» por menú en la tarjeta).
- **M** Las filas miden 74–76 px (bien), pero la casilla de 22 px es objetivo <44 (el área táctil real es la fila entera, no verificado).
- **B** Lista «Lo tuyo hoy» con la tarjeta «venció ayer» en rojo: buen estado de urgencia; conservar.

### 2.4 Calendario (P) — `04-…`, `04b/c/d`

- **A** Cabecera negra de 374 px (de 844): título, ✕, selector de vista (AGENDA/DÍA/SEMANA/MES en 10,5 px), navegación y «HOY». Luego «Rutinas», buscador (12,5 px), chips de departamento con scroll horizontal. La primera cita sale a 830 px (de 1688 px de captura).
- **A** La semana (cap. `04b`) pinta 3 columnas y media a 390 px (`minmax(104px, 1fr)`) con scroll horizontal dentro: el 4.º día queda cortado («J…»). No hay vista «3 días».
- **A** La vista «SIN TERMINAR» pone cuatro etiquetas de colores sin ninguna acción por toque (cap. `04`).
- **M** La agenda (default de teléfono) es la mejor pantalla de la app, pero el «+» de cada día mide 44 px y está en la esquina superior derecha (lejos del pulgar).
- **M** `#cvPop` (ventanita del día) limita su alto con `100vh − 24px`: en iOS con la barra de URL visible desborda por abajo.
- **B** Arrastrar un evento con el dedo ya funciona (`calendar-dnd.js`); falta un menú «Mover a…» sin arrastre.

### 2.5 Contenido (K) — `05-…`, `05b-contenido-{cal,prog,bandeja}`

- **A** Cabecera negra de 358 px: «+» (invisible: negro sobre negro, cap. `05-contenido-390`), modo (CALENDARIO/COLA/BANDEJA), ✕, rango, flechas, HOY y selector (12 px). Falta ✕ en la zona del pulgar.
- **A** Estado vacío «Nada programado. Un buen hueco para publicar.» ocupa 1.000 px de blanco con un solo día: sin acción principal visible; el «+» está en la banda superior.
- **M** El editor de la pieza se carga aparte (`pieza-editor.js`) y es un diálogo ancho: no se auditó con una pieza abierta (ver §0).

### 2.6 Analíticas (R) y Anuncios (J) — `06-…`, `07-…`

- **A** Analíticas: banda de 460 px con 4 filas de controles («INFORME DEL MES», «ACTUALIZAR», ✕, 7/30/90 días, TODAS/INSTAGRAM/FACEBOOK) antes del contenido; el estado «Conecta Meta» muestra 25 líneas de instrucciones técnicas con nombres de permisos; en un teléfono sobra (se debe llevar a «Ajustes» con un botón).
- **A** Anuncios: 6 pestañas en dos filas de botones con icono (bien) pero la banda ocupa 430 px; el ✕ queda solo en una tercera fila a la derecha. «Actualizar» y «Meta no está conectada…» ocupan otros 150 px.
- **M** Texto «META_ACCESS_TOKEN», `docs/conectar-meta.md`: lenguaje de administrador; en un celular debería ser una sola tarjeta «Conectar Meta» con un botón.

### 2.7 Cerebro (G) — `08-cerebro-{390,360,320}`

- **A** Lienzo 3D que ocupa toda la pantalla, con «Explorar» y ✕ arriba (lejos del pulgar). Los rótulos de nota (`.bv3-lab`) miden 11,5 px; las etiquetas se superponen; tocar una neurona requiere precisión de 16–26 px (ya hay tolerancia: bien).
- **A** El panel «Explorar» (búsqueda, regiones, sinapsis…) es un panel lateral largo: no auditado abierto (ver §0), pero por CSS es una hoja 48 vh (`.bv-pane`, `shell.html:1691`) que tapa el grafo.
- **M** El grupo de controles de abajo (reiniciar, pausa, +, −) mide 44 px: bien.
- **M** Para casi todo lo que un dueño hace con el Cerebro en el teléfono (buscar una nota, leerla) el lienzo 3D es el camino equivocado: falta una **lista de notas con buscador** como entrada, y el 3D como extra.

### 2.8 Estudio (E) — `09-estudio-{390,360,320}`

- **M** Es la pantalla más cercana a una app móvil: pestañas Crear/Galería/Lotes, 4 tipos en cuadros de 80 px, formatos en cuadros, GENERAR fijo abajo con el precio. Pero: el campo del prompt es de 14 px, «Avanzado» es un texto de 13 px sin forma de botón, el cuerpo hace scroll bajo un pie fijo (bien) y la barra superior sigue arriba.
- **M** `0/40 hoy` y ✕ comparten la fila de pestañas y el ✕ está a la derecha (lejos del pulgar).

### 2.9 Negocio (N) y Ajustes (,) — `10-negocio-…`, `11-ajustes-*`

- **A** Ajustes es un modal centrado de 17 pestañas en una fila con scroll horizontal oculto (Estado · General · Apariencia · Seguridad · Aprobaciones · Costos · Estudio · Contenido · Anuncios · Avisos y Telegram · Conectores · Calidad · Equipo · Cifras · Voz de marca · Preparar desde mi web · Atajos): a 390 px se ven 4 y el resto no se sabe que existe. Es un menú de 17 elementos en una pestaña. En un teléfono es una **lista** que lleva a pantallas.
- **A** Campos de 13,5 px en todas las pestañas con campos (General, Seguridad, Estudio, Contenido, Anuncios): iOS hace zoom al enfocar y desplaza la página.
- **A** `max-height: calc(100vh − 190px)` en `.sg-pane` y el botón Guardar fuera del área desplazable: con teclado virtual el campo enfocado queda tapado.
- **M** Negocio: botones «+ Ventas de la semana» de 32 px de alto en columna; correctos pero pequeños.
- **M** Costos y retorno (U): sin botón en teléfono (el uso del plan está en la esquina inferior y se oculta bajo 1100 px). Solo se llega por Ajustes → Costos.

### 2.10 Dimitri (S) — `12-dimitri-…`

- **A** Es un panel a pantalla completa (bien) pero cabecera con 3 botones de 32 px (🕘, +, ✕) y el campo de 13,5 px con micrófono dentro; ENVIAR en 11 px. El 🕘 historial y «Nueva conversación» son iconos sin texto.
- **A** Sugerencias («¿Cómo vamos?», «¿Qué falló?») en chips de 32 px sobre el campo: bien por posición, pequeños por tamaño.
- **M** En iOS el campo fijo abajo se desplaza con el teclado solo si usa `visualViewport`: no se verificó.
- **M** Dimitri es un botón de 30 px en el dock («D»): es **la función principal de la oficina** y tiene el mismo peso que Estudio.

### 2.11 Buscar, conectores, aprobaciones, agentes

- **C** **Buscar (Ctrl+K)**: sin botón en ninguna parte; en teléfono no existe. (`src/search.js`; no hay `#topSearch`.)
- **C** **Conectores**: ocultos bajo 760 px; con `#topconn` forzado visible (cap. `17b`) aparece una sola píldora «CONECTORES · 0 ▾» de 28 px de alto con los iconos colapsados; el panel (`#connPanel`) usa una rejilla 2 columnas diseñada para escritorio (`.cp-c`, `.cp-d` a 11 px) y detalles con tablas `dt/dd` de 10,5 px.
- **A** **Aprobaciones (⚠)**: aparece solo con pendientes y compite por sitio con el logo; sin contador visible en las demás vistas fuera de la barra; no hay hoja de aprobación con deslizar.
- **A** **Ficha de un agente / chat del departamento**: se abre con el rail lateral (`#rail`, `width: 100vw` ≤900 px) pero no se auditó con captura (ver §0).

### 2.12 Transversales (medidos en todo)

- **C** Sin `viewport-fit=cover` ni `env(safe-area-inset-*)`: la barra de inicio de iPhone se superpone a GENERAR, Enviar y los pies fijos.
- **A** `touch-action`: la escena y el lienzo del Cerebro capturan los gestos; no hay `overscroll-behavior` en vistas (el rebote de iOS «tira» de la página).
- **A** Sin gestos de app: no hay deslizar para volver, pull-to-refresh, deslizar una fila para acciones ni hojas arrastrables.
- **M** Dependencias de hover: `.cv-add { opacity: 0 }` se compensa con `@media (hover: none)`; los `data-tip` solo salen manteniendo pulsado. No se encontraron dependencias críticas de hover en los flujos medidos, pero el 100 % de las acciones secundarias (⋯) son iconos sin texto.
- **M** `body { overflow: hidden }` (la página no hace scroll; cada vista lo hace por dentro): rompe «tocar la barra de estado para volver arriba» en iOS y la barra de URL nunca se esconde.

## 3. Referencias de aplicaciones móviles (ideas de patrón, no de código ni de imágenes)

Base: las guías de Apple (Human Interface Guidelines), Material Design 3 y WCAG 2.5.5/2.5.8, y el uso habitual de estas aplicaciones. Búsqueda web hecha: [guías de navegación móvil de Smashing Magazine](https://uxdesign.smashingmagazine.com/2019/08/bottom-navigation-pattern-mobile-web-pages) y [UXPin 2026](https://www.uxpin.com/studio/blog/mobile-navigation-examples/) confirman la barra inferior de 3–5 destinos como el patrón principal, y las zonas del pulgar (Hoober: ~75 % de los toques son con un pulgar). No pude consultar las pantallas actuales de Linear, Todoist, Notion, Google Calendar ni Slack en esta sesión: lo que sigue sale de lo que conozco de ellas, no de una comprobación de hoy.

| App | Patrón que conviene tomar | Dónde aplicarlo aquí |
|---|---|---|
| **Linear** (móvil) | Barra inferior con pocos destinos (Bandeja, Mis asuntos, Proyectos…), cada asunto una fila con estado, prioridad y responsable; deslizar la fila para cambiar estado; hoja inferior para elegir estado/prioridad; botón «+» que abre escribir con el teclado ya abierto | Tareas: filas con acciones al deslizar, hoja para estado/prioridad/delegar, «+» flotante |
| **Todoist** | «Hoy» como pantalla de inicio; añadir rápido con una hoja y lenguaje natural (ya existe `tareas/rapida.mjs`); casilla circular grande; deslizar para reprogramar/completar; vencidas arriba | Inicio = «Lo tuyo hoy»; el «+» abre la hoja de captura que ya entiende «mañana», `#etiqueta`, `!alta` |
| **Notion** (móvil) | Barra inferior (Inicio, Buscar, Bandeja, Crear), la búsqueda como destino de primer nivel; la navegación profunda se hace con migas y hojas | Buscar como pestaña; Cerebro como lista con buscador antes del grafo |
| **Google Calendar** | Vista de agenda (lista), vista de 3 días como alternativa móvil a la semana, FAB «+» (crear), selector de mes desplegable, hoja inferior al tocar un evento | Agenda por defecto; añadir vista «3 días»; evento → hoja con acciones |
| **Slack** | Barra inferior (Inicio, MD, Actividad, Tú); lista con insignias; el «Más» como pantalla, no como menú; composer fijo con teclado | Dimitri como conversación fija; Avisos como pantalla «Actividad» |

Reglas generales que se toman: 3–5 destinos abajo con icono **y** texto, acción principal a la altura del pulgar, hojas inferiores en vez de modales, listas que llevan a pantallas (en vez de pestañas horizontales), estado vacío con una acción, y la cabecera pequeña (una línea de 48–56 px).

## 4. Plan de rediseño móvil

### 4.1 Principios

1. **Una cosa por pantalla, el pulgar manda.** Navegación abajo; lo que se toca a diario, a ≤ 1 toque; las acciones destructivas o de dinero nunca al alcance de un toque accidental (se mantiene la regla de dos clics y el DESHACER).
2. **No es otra aplicación: es otra piel sobre las mismas vistas y las mismas APIs.** Los datos, las rutas y las reglas (aprobaciones, `safety`, roles) no cambian.
3. **Reutilizar por CSS lo que ya es lista; reescribir lo que es lienzo o tabla ancha.**
4. **Cero crecimiento de la página**: todo el código y estilo móvil viaja en un paquete aparte.
5. **Sin hover, sin teclado, sin arrastrar como única vía.**

### 4.2 Arquitectura de navegación propuesta

**Barra inferior de 5 destinos** (icono + texto de 11–12 px, 56–64 px de alto + safe-area):

```
 ┌────────┬────────┬────────┬────────┬────────┐
 │ Inicio │ Tareas │   D    │Calend. │  Más   │
 │  ⌂     │  ☑     │Dimitri │  ▦     │  ⋯     │
 └────────┴────────┴────────┴────────┴────────┘
```

- **Inicio**: un tablero de tarjetas (ver §4.4): lo tuyo hoy, lo que espera tu OK, avisos, conectores, oficina. Sustituye a la escena 3D como entrada en móvil (la escena queda como «Oficina» dentro de «Más»).
- **Tareas**: la vista Tareas, con Mías/Hoy como primera pestaña y segmentos Hoy · Próximas · Delegadas · Hechas; las pestañas Lista/Tablero/Proyectos/Medidas pasan a un selector de «vista» en la cabecera.
- **Dimitri** (centro, destacado): conversación a pantalla completa; es la acción más importante del producto.
- **Calendario**: Agenda por defecto; Día, 3 días, Semana, Mes.
- **Más**: pantalla (no menú) con la lista de herramientas, cada una con icono, nombre, una línea de descripción y su insignia: Contenido, Estudio, Analíticas, Anuncios, Cerebro, Negocio, Costos, Conectores, Estado, Ajustes, Equipo/Perfil, Oficina 3D. Las que se usan más suben al principio (se recuerda).

**Cabecera compacta de una línea (48 px + safe-area superior)**: título de la pantalla a la izquierda, a la derecha **Buscar** (🔍), **Avisos** (🔔 con insignia) y, en nube, el avatar del usuario. Nada más. Los ✕ desaparecen: el botón físico/gesto «atrás» y un `‹` a la izquierda en las pantallas de segundo nivel.

**Aprobaciones desde cualquier sitio**: insignia ámbar en «Inicio» y en la cabecera (🔔 abre Avisos con «Esperan tu visto bueno» primero); una **franja de aprobación pegada sobre la barra inferior** cuando hay un borrador esperando (una línea «1 borrador espera tu OK · Ver») que se puede descartar por sesión.

**Conectores**: tarjeta en Inicio «Conectores: 6 de 8 activos» con una fila de iconos (los mismos de escritorio, 36 px) y un punto de color (ok, falla, sin conectar); al tocar abre una **hoja inferior** con la lista (icono, nombre, estado, a qué mesas llega) y el detalle por fila (el mismo de `#connPanel`, en una columna). Debe verse sin pasar por Ajustes.

**Navegación y estado**: la dirección usa el hash existente (`#tareas=…`) más `#m=…`; el botón «atrás» del sistema cierra primero la hoja, luego la pantalla de segundo nivel, luego vuelve a Inicio; se recuerda la última pestaña (`ao.m.tab`).

### 4.3 Tokens (móvil)

Se añaden como variables `--m-*` en `movil.css` (no tocan los de escritorio).

| Token | Valor | Razón |
|---|---|---|
| `--m-tap` | 44 px (preferido 48) | WCAG 2.5.5 / HIG / Material |
| `--m-gap-tap` | ≥ 8 px entre objetivos | evita el toque erróneo |
| `--m-pad` | 16 px lateral (`--m-pad-s` 12 px) | margen de lectura |
| `--m-sp` | 4 · 8 · 12 · 16 · 24 · 32 | escala de espacio |
| Cuerpo | 16 px / 1.45 (mínimo 14 px solo para metadatos secundarios; nunca <12) | legibilidad |
| Campos | **16 px** (obligatorio) | evita el zoom de iOS |
| Títulos | pantalla 22 px; sección 17 px; tarjeta 16 px semibold | jerarquía |
| Etiquetas de barra | 11–12 px con texto | icono + texto, nunca solo icono |
| Radios | 12 (controles) · 16 (tarjetas) · 24 (hoja inferior arriba) · pill | coherente con los de escritorio |
| Sombras | 2: tarjeta (0 1px 3px) y hoja (0 -8px 30px) | elevación |
| Safe-area | `padding-bottom: env(safe-area-inset-bottom)` en barra y pies; `viewport-fit=cover` | home indicator |
| Altura | `100dvh` / `visualViewport` para el teclado | barras de URL |
| Color | reutiliza `--cream`/`--ink`/`--focus` y los semánticos; mínimo 4,5:1 texto, 3:1 componentes, en claro y oscuro | AA |
| Movimiento | 150–220 ms; `prefers-reduced-motion` lo apaga | |

### 4.4 Pantallas clave (maquetas en `docs/diseno-movil/*.svg`)

| Pantalla | Archivo | Qué resuelve |
|---|---|---|
| Armazón: cabecera + barra inferior + hoja | `01-armazon.svg` | navegación, buscar, avisos, safe-area |
| Inicio | `02-inicio.svg` | lo tuyo hoy, aprobaciones, conectores, atajos |
| Tareas (Hoy) con captura rápida | `03-tareas.svg` | lista, deslizar, «+», hoja de captura |
| Conectores (hoja inferior) | `04-conectores.svg` | iconos y estados en móvil |
| Más | `05-mas.svg` | todo lo que hoy cuelga del «⋯» y de los atajos |

Resumen de las demás (sin SVG; se construyen con los mismos componentes):

- **Calendario**: agenda por defecto; cabecera de una línea con mes ▾ (selector que despliega mes), `‹ ›` y «Hoy»; chips de vista (Agenda · Día · 3 días · Semana · Mes) bajo la cabecera; «+» flotante abajo a la derecha (sobre la barra); un evento abre una hoja con título, hora, agente, estado y botones (Mover a…, Saltar esta, Marcar hecho). Departamentos: filtro en hoja, no chips de scroll.
- **Contenido**: Calendario (agenda) / Cola / Bandeja como segmentos; «+» flotante; tarjeta de pieza con miniatura de 64 px, texto 2 líneas, estado y hora; abrir = pantalla completa con editor simplificado (texto, archivos, red, cuándo) y Aprobar en un pie fijo; lo avanzado (por red, reglas) en «Más opciones».
- **Analíticas/Anuncios**: tarjetas de cifras en 2 columnas, selector de rango y cuenta en una hoja; «Conectar Meta» como una tarjeta con un botón (los pasos técnicos pasan a «Ver pasos»). Acciones que gastan: el mismo doble toque con cifra, a pantalla completa (nunca en una hoja que se cierre al tocar fuera).
- **Cerebro**: lista de notas con buscador y filtros (tipo, reciente) como entrada; «Ver mapa» abre el lienzo 3D a pantalla completa con botones grandes; una nota abre su lectura en pantalla completa con sus enlaces.
- **Estudio**: se conserva (Crear / Galería / Lotes en pestañas arriba o abajo del contenido); campos a 16 px, «Avanzado» como interruptor de 44 px, GENERAR fijo sobre la barra con el precio; galería en rejilla de 2 columnas; visor a pantalla completa con acciones en hoja.
- **Dimitri**: conversación; campo fijo con teclado (usa `visualViewport`); chips de sugerencias en una fila desplazable; cabecera con historial (🕘 con texto «Historial») y «Nueva»; tarjetas de plan con botones a ancho completo (ENVIAR A LOS JEFES, GENERAR) y la cifra visible.
- **Aprobaciones**: lista de tarjetas con asunto, a quién, importe y riesgo; **deslizar a la derecha = Aprobar (pide confirmar una vez, con DESHACER), a la izquierda = Devolver**; el botón también existe (no depende del gesto); abrir = «Lo que saldrá» y Editar.
- **Ajustes**: lista agrupada (Cuenta · Oficina · Seguridad · Equipo · Integraciones · Apariencia) cuyas filas abren una pantalla con sus campos (16 px) y **Guardar fijo abajo** (sobre el teclado); Estado primero y con su luz.
- **Buscar**: pantalla completa con campo arriba (teclado abierto), resultados por tipo, recientes.
- **Departamento / agente**: hoja a ~85 % con el chat del departamento, y la ficha de agente como pantalla de segundo nivel.
- **Oficina 3D**: se mantiene como pantalla opcional en «Más → Oficina», con los rótulos más grandes; no es la entrada.

### 4.5 Patrones

- **Hojas inferiores** (en lugar de modales centrados) para: elegir estado/prioridad/fecha, filtros, selector de cuenta o rango, detalle de evento, conector, confirmar un gasto (con su cifra), menús «⋯». Se cierran con arrastre hacia abajo, ✕ y atrás; tienen asa visible y `role="dialog"` con `modal.open`. Alto máximo 90 dvh; contenido con scroll propio; pie fijo con la acción.
- **Listas con deslizar** (derecha = completar/aprobar; izquierda = más: mover, delegar, saltar), siempre con la alternativa por botón/menú y DESHACER 8 s (ya existe el patrón).
- **Pull-to-refresh** en Inicio, Tareas, Calendario, Contenido, Bandeja (llama a lo que hoy es «Actualizar»); en Anuncios/Analíticas solo con confirmación (cuota de Meta).
- **Estados vacíos** con una frase, una acción y, si aplica, un ejemplo («Nada para hoy · + Añadir una tarea»).
- **Esqueletos de carga** (3 filas grises) en lugar de «Cargando…»; el paquete móvil y sus vistas ya tienen estado de carga (`estudio-carga.js` lo hace para el Estudio: reutilizar la idea).
- **Teclado virtual**: el pie con la acción se ancla a `visualViewport.height`; al enfocar un campo se hace `scrollIntoView({block:'center'})`.
- **Objetivos**: toda fila es un botón de ≥ 48 px de alto; los iconos solos miden 44×44 con 8 px de separación o llevan texto.
- **Toasts** arriba de la barra inferior (no sobre el pulgar), 4–6 s, con DESHACER.

### 4.6 Estrategia técnica

**Paquete bajo demanda**, como `dist/tareas-vista.js`, `dist/anuncios-vista.js`, `dist/pieza-editor.js`:

- `build-movil.mjs` (nuevo, como `build-tareas.mjs`): entrada `src/movil/shell-movil.js`, estilos `src/css/movil.css` incrustados; salida `dist/movil.js` con su primera línea `/*ao-movil:<versión>*/`. `serve.mjs` lo sirve en `/movil.js` y lo reconstruye si es de otra construcción; la nube lo sube con `copiar-oficina.mjs`. `check.mjs` comprueba que existe y que la página no lo importa (igual que los otros).
- **Cargador mínimo en la página** (`src/movil-carga.js`, <1 KB): si `matchMedia('(max-width: 820px)').matches || matchMedia('(pointer: coarse) and (max-width: 1100px)').matches`, añade `<link>`/`<script>` y pone `body.movil`. No carga nada en escritorio. Los 6 KB de margen de la página bastan para ese cargador; si no, se pasa a `cloudflare/public/` (como `nube.js`) y solo la nube lo inyecta, y la oficina local lo recibe del mismo `dist/`.
- **Qué hace el paquete**: (a) crea la barra inferior, la cabecera compacta, las hojas y la pantalla «Más»; (b) **oculta** el dock, el `#topbar` y la escena con CSS (`body.movil #topbar { display:none }`), nunca los borra (el atajo y las funciones siguen existiendo y los módulos que los buscan por id no fallan); (c) enruta cada destino a la vista existente llamando a lo que el dock llama (`document.getElementById('topCal').click()`, `views.opening`, `modal.js`), de modo que **cada vista conserva su foco, su historial y su `selection()` para Dimitri**; (d) añade la hoja de conectores leyendo `/api/mcp` y reusando el modelo de `src/mcp.js`; (e) hoja de aprobaciones leyendo lo mismo que el chip ⚠.
- **Reutilización**:
  - **Tal cual con CSS móvil** (listas que ya funcionan): Tareas Mías/Inicio/Lista/Tablero (quitar la cabecera negra, reordenar controles, 16 px, objetivos 48 px), Calendario agenda/día, Contenido Cola y Bandeja, Estudio, Negocio, Estado, Costos, Dimitri, Anuncios (pestañas), Analíticas (tarjetas).
  - **Necesitan componente nuevo**: barra inferior, cabecera, hoja inferior (genérica), «Más», Inicio móvil, captura rápida («+»), lista de notas del Cerebro, Ajustes como lista → pantalla, hoja de aprobaciones, hoja de conectores, calendario de 3 días.
  - **Se reescriben solo en móvil**: Ajustes (17 pestañas → lista), el panel T (se **elimina** en móvil: Tareas y la captura rápida lo sustituyen), el rótulo de departamentos de la escena (`.badge`), el Cerebro (entrada por lista), `#cvPop` (ventanita del día → hoja).
- **Sin tocar el servidor**: no hay APIs nuevas, salvo, si se quiere, `GET /api/inicio-movil` que junte en una llamada lo tuyo hoy + pendientes + conectores + avisos (opcional; con el Worker en nube es un handler de solo lectura que reutiliza los módulos; rol lectura).
- **Nube**: `nube.js` ya inyecta perfil/equipo; en móvil, el avatar va en la cabecera y «Equipo» en «Más». `nube.css` deja de ocultar su barra bajo 440 px porque en móvil la barra ya no existe.
- **Viewport**: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` (cambio de una línea en `shell.html`, de ambas oficinas; no crece nada) y `theme-color` claro/oscuro; `body.movil` usa `min-height: 100dvh` y deja de ser `overflow: hidden` en las vistas que hacen scroll de documento.
- **Accesibilidad**: la barra es `<nav aria-label="Principal">` con `aria-current="page"`; hojas con `role="dialog" aria-modal`, foco atrapado y devuelto al origen (`modal.js`); gestos con alternativa; contraste AA; tamaño de texto del sistema respetado (usar `rem`/`em` en el paquete).
- **Pruebas** (todo cambio con test que muerda): `tests/movil-*.test.mjs` (lo puro: enrutado, listas) y `cloudflare/tests/movil-navegador.test.mjs` con Playwright a 390/360/320 que falla si hay un objetivo <44 px, un campo <16 px, `scrollWidth > clientWidth`, un contenido bajo `env(safe-area)`; y las 10 tareas comunes con su máximo de toques (§1). Reutilizar `scripts/movil-auditoria.mjs` como base: ya mide todo esto y escribe un JSON.

### 4.7 Fases y criterios de aceptación

Cada fase se entrega con `npm run check` verde, el test de navegador de la fase y capturas `docs/capturas-movil/despues/…` (misma herramienta, mismas pantallas, mismas medidas).

| Fase | Contenido | Criterios medibles |
|---|---|---|
| **M0 · Cimientos** (1–2 días) | `viewport-fit=cover`, `theme-color`, `dvh` en vez de `vh` en los modales, `env(safe-area-inset-*)` en pies fijos; campos a 16 px en móvil (regla `body.movil input,select,textarea{font-size:16px}`); `build-movil.mjs`, cargador y `body.movil` (sin UI nueva aún) | los campos con fuente <16 px (hoy 1–6 por pantalla, §1) a **0**; ningún elemento fijo bajo la barra de inicio (medido con `env()` simulado); la página no crece más de 1 KB; el paquete no se descarga en 1512 px |
| **M1 · Armazón** (3–4 días) | barra inferior de 5 destinos, cabecera compacta con Buscar y Avisos, pantalla «Más», dock y `#topbar` ocultos, «atrás» del sistema, botón Buscar | **0 objetivos <44 px en la barra y la cabecera**; **las 10 tareas comunes alcanzables sin atajos de teclado**; Buscar y Costos alcanzables en ≤2 toques; cero scroll horizontal a 320 px |
| **M2 · Inicio y conectores** (3 días) | Inicio móvil (lo tuyo hoy, aprobaciones, conectores, avisos, oficina), hoja de conectores con iconos y estados, franja de aprobación sobre la barra, hoja de aprobaciones con deslizar y botón | ver un conector en ≤2 toques con iconos de 36 px visibles; aprobar un borrador en ≤3 toques; el chip de aprobaciones visible en toda pantalla de primer nivel; ninguna acción de envío cambia de reglas (se prueba con `safety`/roles) |
| **M3 · Tareas y captura** (4–5 días) | Tareas con cabecera de una línea, segmentos Hoy/Próximas/Delegadas/Hechas, «+» flotante con la hoja de captura rápida, deslizar para completar/mover/delegar, detalle como pantalla, desaparición del panel T en móvil | añadir una tarea en ≤2 toques; ver «hoy» en 1; filas ≥48 px; todo gesto con alternativa; el panel T no se pinta bajo `body.movil`; cabecera ≤ 56 px (hoy 292 px) |
| **M4 · Calendario y Dimitri** (3–4 días) | calendario con cabecera compacta, vista de 3 días, hoja de evento, «+» flotante; Dimitri con teclado correcto (`visualViewport`), tarjetas de plan a ancho completo, «Historial» con texto | cabecera del calendario ≤ 112 px (hoy 374); primera cita visible sin scroll; Dimitri: campo siempre visible con teclado abierto (prueba con `visualViewport` simulado); botones de plan ≥48 px |
| **M5 · Resto de vistas** (5–6 días) | Contenido (segmentos, tarjeta de pieza, editor simplificado), Analíticas/Anuncios (tarjetas, «Conectar Meta» en una tarjeta), Cerebro (lista primero, mapa después), Estudio (campos y barra), Negocio, Costos, Estado | las 12 pantallas a 390/360/320: **0 objetivos <44 px**, **0 campos <16 px**, **0 texto <12 px**, `scrollWidth === clientWidth`; cada vista con su estado vacío y su esqueleto |
| **M6 · Ajustes y pulido** (3–4 días) | Ajustes como lista → pantalla con Guardar fijo; hojas de filtros; pull-to-refresh; animaciones y `prefers-reduced-motion`; modo oscuro revisado con axe | 17 pestañas de Ajustes ≤2 toques cada una; **axe sin críticos ni serios** en claro y oscuro; contraste AA; probar en un iPhone y un Android reales |

Criterio final: **cero scroll horizontal a 320 px**; **ningún objetivo <44 px**; las 10 tareas comunes en **≤3 toques** (ver tabla de §1); campos a **16 px**; sin pérdida de funciones (cada botón del dock sigue funcionando en escritorio y la suite 466 + 1161 sigue verde).

### 4.8 Riesgos y decisiones que quedan

- **¿Se mantiene la escena 3D como entrada móvil?** Se propone que **no** (consume batería, captura gestos, rótulos solapados); queda en «Más → Oficina». Decisión del dueño.
- **Dos interfaces de tareas** (panel T y vista H): en móvil se queda solo la vista. A decidir si en escritorio también se unifican (fuera de alcance).
- **Teléfonos con teclado/ratón y tabletas**: el corte propuesto es 820 px de ancho; entre 821 y 1100 px con `pointer: coarse` (iPad), se propone la misma barra inferior con el contenido a dos columnas. A validar.
- **Instalación como app (PWA)**: `manifest.webmanifest` + `display: standalone` y `theme-color` darían «parece una aplicación». No se incluyó en M0 porque la nube exige sesión por cookie `__Host-` y un service worker de caché sería una decisión de seguridad aparte; recomendable como M7 con revisión.
- **Pruebas en dispositivos reales**: este informe no las incluye; son condición de salida de M6.

## 5. Las 15 correcciones que más cambian la experiencia (por orden)

1. **Barra inferior de 5 destinos con texto** (Inicio · Tareas · Dimitri · Calendario · Más) y quitar el dock de 30 px de arriba. (§2.1) — M1
2. **Conectores visibles en el móvil**: tarjeta en Inicio con iconos y hoja inferior de detalle; hoy `#topconn` se oculta bajo 760 px. (§2.11) — M2
3. **Quitar el panel de tareas T en móvil** y sustituirlo por Tareas + «+» flotante con captura rápida. (§2.2, §2.3) — M3
4. **Todos los campos a 16 px** (evita el zoom de iOS): hoy casi ninguno lo es. (§1) — M0
5. **Objetivos de 44–48 px y 8 px de separación** en todo el móvil. (§1) — M1–M5
6. **Botón Buscar y botón Avisos** en la cabecera (el buscador solo existe con Ctrl+K; Costos solo con U). (§2.11) — M1
7. **«Más» como pantalla con nombre, icono y descripción de cada herramienta**, no un menú de atajos. (§2.1) — M1
8. **Cabeceras compactas de una línea**: las bandas negras de 290–460 px de Tareas, Calendario, Contenido, Analíticas y Anuncios pasan a 48–56 px + chips. (§2.3–2.6) — M3–M5
9. **Hojas inferiores en lugar de modales centrados** (filtros, eventos, estados, confirmar gasto). (§2.4, §2.9) — M2–M6
10. **Safe-area y `dvh`**: `viewport-fit=cover`, `env(safe-area-inset-bottom)` en pies fijos, sin `100vh`. (§2.12) — M0
11. **Aprobaciones accesibles desde cualquier pantalla**: franja sobre la barra + hoja con deslizar y botón. (§2.11) — M2
12. **Ajustes como lista → pantalla** con Guardar fijo, en lugar de 17 pestañas horizontales. (§2.9) — M6
13. **Dimitri como destino central** con teclado bien manejado (`visualViewport`), historial con texto y botones de plan grandes. (§2.10) — M4
14. **Cerebro con lista y buscador antes del grafo 3D**. (§2.7) — M5
15. **Calendario con vista de 3 días, «+» flotante y hoja de evento** (en lugar de la semana de 3,5 columnas y la ventanita del día). (§2.4) — M4

## Anexo — archivos

- Herramienta: `scripts/movil-auditoria.mjs` (`PERFIL=390|360|320`, `PARTE2=1`, `PARTE3=1`).
- Capturas y medidas: `docs/capturas-movil/antes/`.
- Maquetas: `docs/diseno-movil/*.svg`.
