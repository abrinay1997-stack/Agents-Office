# Changelog

## La Bandeja con Meta, Fase B2: los mensajes privados — 9 oct 2026

- **Los mensajes privados de Instagram y Messenger** llegan a la Bandeja como conversaciones. Ves el hilo con la hora de cada mensaje y las imágenes que te mandan (solo si vienen de Meta).
- **La ventana de 24 horas, siempre a la vista:** «puedes responder durante 5 h más». Si se cierra, la oficina **no deja responder** (lo frena el servidor, sin llamar a Meta) y dice por qué. Si el cliente vuelve a escribir, se abre otra vez.
- **Responder** es tuyo, con el segundo clic y una sola vez. El texto tiene un límite de 1.000 caracteres, con contador. El agente deja el borrador.
- **Sin el acceso avanzado de Meta**, que es obligatorio para leer los mensajes de tus clientes, una franja dice qué falta y cómo pedirlo. Los comentarios siguen llegando.
- **Telegram** avisa de mensajes nuevos con lo que te queda para responder, sin saturarte.
- `scripts/check-meta-bandeja.mjs` lee también las conversaciones con el token real, sin enviar nada.
- La conversación viaja en el paquete del editor: la página principal solo crece 4,9 KB.

## Anuncios de Meta, Fase A4: impulsar lo que ya salió — 9 oct 2026

- **«Impulsar»** en una pieza ya publicada de Contenido (un botón por red si salió en las dos) y en «Las que más movieron» de Analíticas. Abre Anuncios con un borrador de campaña que usa **esa misma publicación**: no hay que subir nada ni reescribir el texto, solo elegir la llamada a la acción. Por defecto: «que me escriban», Advantage+, US$5 al día y 7 días.
- **Antes de crear, Meta dice si se puede impulsar.** Por ejemplo, no deja con música con derechos. Si no se puede, se dice por qué y no se crea.
- **Se crea en pausa**, como todo; activarla te pide los dos clics.
- La sugerencia de la IA «impulsa esta publicación, que funcionó» ya se puede aplicar. Antes respondía «falta la A4».
- Impulsar dos veces la misma publicación no crea dos borradores.
- Tests: `anuncios-impulsar`. Recorrido: de «Impulsar» en Analíticas a la campaña creada en pausa, con axe sin fallos.

## La Bandeja con Meta, Fase B1: los comentarios — 9 oct 2026

- **Los comentarios de Instagram y Facebook llegan a la Bandeja directamente de Meta**, sin Metricool, y también **los de tus anuncios**, marcados «EN UN ANUNCIO» con un botón que lleva a esa campaña en Anuncios.
- Cada comentario muestra la publicación de la que viene y, si es una respuesta, a qué comentario responde.
- **Responder** sigue siendo solo tuyo, con un segundo clic y **una sola vez**, aunque la oficina se apague a mitad del envío.
- **Ocultar o mostrar** un comentario (nunca borrarlo), con DESHACER. A un comentario oculto no se puede responder, y la Bandeja lo dice.
- **El agente** deja el borrador de la respuesta y puede **sugerir** ocultar un comentario (insultos, spam). Solo lo sugiere.
- **Ajustes → Contenido → «La Bandeja trae de»:** Meta, Metricool o las dos. Por defecto, Meta si hay token. Lo que llega por las dos fuentes se muestra una sola vez.
- **Telegram** avisa de comentarios nuevos sin saturarte (como mucho uno cada 15 minutos, con «y N más»).
- Lo que escribe un cliente sigue pasando por el filtro de órdenes escondidas (🛡).
- `scripts/check-meta-bandeja.mjs`, para el token real: solo lee.
- `check.mjs`: el paso de la rutina escrita en la barra espera a que el menú se vea; antes fallaba a veces en un servidor de CI lento.
- **Arreglo en Windows: ya no se pierden guardados.** La oficina guarda escribiendo un archivo temporal y renombrándolo encima del bueno. En Windows, ese renombrado falla unos milisegundos si otro programa tiene el archivo abierto (la página, un antivirus), y el guardado se perdía en silencio: por ejemplo, el aviso «el piloto pausó tu anuncio», o un cambio en una tarea.
  - Ahora `fs-seguro.mjs` reintenta y, si no puede, copia el contenido encima.
  - Lo usan los 31 archivos del servidor que guardan.
  - Así se explicaban también los tests que fallaban de vez en cuando con la máquina cargada.

## Anuncios de Meta, Fase A5: la IA que mejora las campañas — 9 oct 2026

- **Sugerencias**, una pestaña nueva. Después de cada lectura de cifras, la oficina revisa tus campañas con las reglas del plan:
  - **no tocar** lo que está aprendiendo, y **esperar** antes de juzgar;
  - **cortar** lo que gasta sin resultados;
  - **creativos nuevos** cuando un anuncio se cansa, sin subir el presupuesto;
  - **escalar** un 20 % lo que va bien;
  - **juntar** conjuntos que no salen del aprendizaje;
  - lo **rechazado**, con su texto corregido como borrador;
  - **impulsar** lo que funcionó en orgánico.

  Cada tarjeta dice **el dato con su cifra, el porqué, el cambio exacto, el efecto y el riesgo**, con Aplicar · Descartar · Recordármelo en 3 días. Lo que gasta sigue pidiendo tus dos clics.
- **Los umbrales salen de la Biblioteca, no del código:** `biblioteca/marketing/campanas-pagadas/umbrales.json`, cada cifra con la frase de la que sale. Puedes cambiarlos en tu Cerebro.
- **Creativos**, otra pestaña: cada creativo con sus cifras y su estado escrito (funciona, se está cansando, gasta sin resultados, todavía no destaca, sin datos) y «Pedir variaciones».
- **El Resumen** muestra las 3 sugerencias más importantes.
- **Piloto automático** (apagado por defecto, en Ajustes → Anuncios): **solo pausa** lo que cruza el umbral de cortar, o todo si pasas el tope del día. Avisa con DESHACER. Nunca activa ni sube.
- **Telegram:** una sugerencia de escalar al día, con «✅ Subir 20 %» y dos toques.
- **El agente de anuncios** tiene una rutina semanal, «Revisión de anuncios» (lunes 8:30, solo lee y propone), y puede dejar sugerencias. **Lo aplicado se mide 7 días después** y enseña a la memoria del Cerebro.
- Evaluaciones: `evals/anuncios-diagnostico/evals.json`. Tests: `anuncios-diagnostico` (cada regla) y `anuncios-sugerencias` (con el servidor real: el piloto nunca activa).

## Anuncios de Meta, Fase A3: crear campañas desde la oficina, siempre en pausa — 9 oct 2026

- **Pestaña Borradores** con el **asistente de 5 pasos**. Guarda solo mientras escribes.
  1. **Objetivo**, en tus palabras: que te escriban por WhatsApp, Instagram o Messenger, visitas a tu web, ventas, contactos o que te conozcan.
  2. **Público:** Advantage+ en Panamá, 18+, por defecto. El manual va detrás de un botón, y la pregunta de categoría especial está siempre.
  3. **Presupuesto y fechas**, con el costo máximo en palabras.
  4. **Creativos** (3 a 6): de la galería o «Crear con el Estudio» para el anuncio, el formato, los textos, «✨ Mejorar con el agente de anuncios» y las mejoras automáticas de Meta una por una.
  5. **Revisión:** los problemas, cada uno lleva a su campo; la vista previa; y **«Crear en Meta (en pausa)»**, de un clic porque no gasta.
- **Se crea en orden y nunca dos veces:** imágenes y videos, creativos, campaña, conjunto, anuncios, todo **en pausa**. Si la oficina se apaga a mitad, al volver busca lo creado por su etiqueta y sigue desde ahí. Si algo falla, archiva lo de ese intento y dice por qué.
- **El tope por campaña viaja a Meta** (`spend_cap`) si es de US$100 o más, que es el mínimo de Meta. Así, aunque la oficina esté apagada, Meta no gasta más.
- **La vista previa de Meta** solo se muestra como un `<iframe>` aislado de facebook.com. La oficina nunca pinta el HTML que manda Meta.
- **Dimitri, tu asistente y el agente de anuncios** pueden dejar borradores en la oficina. Crearlos en Meta es solo tu clic.
- `scripts/check-meta-anuncios.mjs --crear-pausada`, para el token real: crea una campaña de prueba en pausa, prueba las combinaciones con `validate_only` y la archiva.
- Tests: `anuncios-construir`, `anuncios-crear` (con la oficina cayéndose entre el conjunto y el anuncio) y `anuncios-borradores-servidor`. Recorrido: 397 pasos y axe sin fallos.

## Anuncios de Meta, Fase A2: controlar desde la oficina — 9 oct 2026

- **Lo que baja el gasto va con un clic:** pausar una campaña, un conjunto o un anuncio, bajar un presupuesto y archivar. Se deshace durante 30 segundos, salvo archivar, porque Meta no desarchiva.
- **Lo que gasta, con dos clics, y el segundo dice la cifra:** activar, reanudar, subir un presupuesto, alargar la fecha de fin y relanzar. El texto es del tipo «Sí, activar — hasta US$15 al día, US$105 esta semana». Lo comprueba el **servidor**, no solo la página: el primer clic no cambia nada y el segundo trae un permiso de 2 minutos que vale para esa acción y esa cifra, una sola vez.
- **Tus topes no se pasan:** al día, al mes y por campaña, sin atajo. Si no cabe, dice cuánto quedaría y contra qué tope. Una campaña de presupuesto diario sin fecha de fin no cabe en el tope por campaña; ponle fecha de fin.
- **Meta lo valida antes:** si rechaza un presupuesto por bajo, sale su motivo y el mínimo.
- **Aviso de aprendizaje:** subir más de un 20 % un conjunto que está aprendiendo avisa de que reinicia el aprendizaje. Avisa, no lo impide.
- **Relanzar** algo terminado lo duplica **en pausa** con fechas nuevas; luego lo activas tú.
- **Historial:** quién cambió qué (tú, Dimitri, tu asistente, el piloto), el antes y el después, con filtro.
- **Dimitri** propone pausar o bajar con su clic de siempre. Si propone gastar, su tarjeta muestra la cifra y pide tu segundo clic.
- **Telegram `/anuncios`:** pausar con un toque y activar con dos. Solo el dueño.
- **Tu asistente** puede pausar y bajar presupuestos, nunca gastar (403). **Los agentes**, nada.
- Tests: `anuncios-topes`, `anuncios-acciones` y `anuncios-control` (este, con el servidor real). También se ampliaron `control-oficina` (falla si algo de gasto llega a Meta sin tu confirmación), `telegram` y `anuncios-mcp`.

## Anuncios de Meta, Fase A1: el panel en solo lectura — 9 oct 2026

- **Panel de Anuncios:** el megáfono de la barra (tecla **J**; en el teléfono, en «⋯»).
  - **Resumen:** arriba, los avisos (pago pendiente, anuncios rechazados, tope cerca). Debajo, cuatro cifras con su tendencia: gasto de hoy contra el tope del día, gasto del mes contra el del mes, resultados de 7 días y su costo. Y las campañas activas.
  - **Campañas:** una tabla que se despliega campaña → conjunto → anuncio, con el estado en palabras, el aprendizaje, el presupuesto, el gasto, los resultados y su costo, el CTR, la frecuencia y la fecha de fin. Filtros (activas, en pausa, con problemas) y rango (hoy, 7 días, 30 días, este mes). Al abrir una, su detalle: el creativo, el público y lo que dijo la revisión de Meta.
  - **Historial:** vacío hasta la Fase A2.
  - Sin Meta conectada, dice qué falta y deja ver datos de ejemplo.
- **Solo lee:** la oficina habla con Meta solo con GET y por lotes de hasta 50, al ritmo del plan y con el freno de la Fase 0. Avisa (también por Telegram) de un anuncio rechazado o con problemas, de la cuenta con pago pendiente y del gasto de hoy por encima del 90 % del tope.
- **El «resultado» de cada campaña depende de su objetivo:** conversaciones iniciadas, clics al enlace, compras, contactos o alcance. El panel dice, por ejemplo, «12 conversaciones a US$1,40».
- **Dimitri** sabe cómo van los anuncios y ve lo que tienes abierto en el panel. **Los agentes de Marketing** los leen con `anuncios-mcp.mjs`, que no tiene ninguna herramienta para cambiar nada. **Tu asistente** los lee con `ver_anuncios`.
- **El dinero de los anuncios va aparte** del de los modelos: «Publicidad» en el resumen del lunes y en Costos y retorno.
- `scripts/check-meta-anuncios.mjs`, para el token real: solo lee.
- Tests: `anuncios-modelo`, `anuncios-servidor` (comprueba que solo hay GET), `anuncios-mcp` y `anuncios-vista`. Recorrido: `node scripts/anuncios-recorrido.mjs`.

## Anuncios de Meta, Fase 0: la base — 8 oct 2026

Primera fase del plan `docs/plan-meta-anuncios-y-bandeja-2026-10-09.md`. Todavía no hay panel de Anuncios: esto es lo que necesitan todas las fases siguientes.
- **Graph de Meta v23.0 → v26.0** (`contenido/meta.mjs`). Verificado en la documentación de Meta: la Marketing API v23 caducó el 9 jun 2026 (la Graph API v23 vivía hasta oct 2027). Una sola versión para publicar, Analíticas, Anuncios y la Bandeja, con su tabla de fechas (`VERSIONES`): `npm run check` avisa cuando le queden menos de 90 días.
- **El alcance de Facebook** pasa a `page_total_media_view_unique`: Meta retiró `page_impressions_unique` en v25 y en v26 daba error. La vieja queda de respaldo.
- **El freno por uso:** la oficina lee las cabeceras de uso de Meta en cada respuesta. Si Meta limita (códigos 4, 17, 32, 613, 80000–80014), deja de llamar durante el tiempo que pide Meta, o 5 minutos si no lo dice. Lo heredan publicar, Analíticas, Anuncios y la Bandeja. Antes reintentaba al minuto y alargaba el castigo.
- **Un solo Meta de mentira** (`tests/meta-stand.mjs`) para todos los tests y para `npm run check`. Antes había tres, cada uno con su trozo. Responde también a la Marketing API (campañas, conjuntos, anuncios, creativos, `validate_only`, copias, cifras, el lote) y a la Bandeja (comentarios, ocultar, mensajes con la ventana de 24 h), con modos de fallo.
- **Ajustes → Anuncios:** la cuenta publicitaria, la página, el Instagram, el píxel, el WhatsApp, los topes de gasto (US$20 al día, US$300 al mes y US$150 por campaña), el costo por resultado y el piloto automático (apagado). Ningún secreto: el token sigue solo en variables de Windows.
- **Los permisos, por función:** «Comprobar conexión», en Analíticas y en Programación, dice lo que le falta al token para Analíticas, Publicar, Anuncios y los Mensajes, cada uno por separado.
- **Ajustes → Estado (O)** tiene dos filas nuevas: «Anuncios (Meta)» y «Mensajes de Meta».
- Tests: `tests/meta-freno.test.mjs` y `tests/meta-stand.test.mjs`. Ampliados: `tests/settings.test.mjs`, `tests/meta-publicar.test.mjs` y `tests/contenido-meta.test.mjs`.
- **`npm run check` ya no se cuelga en Windows.** En GitHub (Linux) no se notaba:
  - `tests/biblioteca.test.mjs` armaba la ruta con `.pathname` (en Windows daba `C:\C:\…`) y se quedaba esperando un MCP que nunca arrancó;
  - `tests/minimax.test.mjs` dejaba un video en marcha;
  - tres esperas fijas (5 ms, 30 ms y una ventana de 1,5 s) en los tests de la cola de tareas fallaban con la máquina cargada; ahora esperan a que pase lo que comprueban.

## El control de la oficina: Dimitri, los agentes y cualquier IA — 9 oct 2026

Pedido del dueño: «necesito revisar que Dimitri y los agentes sepan y puedan controlar el calendario y tareas… aunque se use cualquier IA». Informe: `docs/auditoria-control-dimitri-agentes-2026-10-09.md`.
- **Dimitri controla más, siempre con tu clic y con DESHACER:**
  - pausar, reanudar, cambiar o correr ahora una rutina;
  - la prioridad y la fecha límite de una tarea;
  - delegar o marcar hecha una tarea tuya;
  - repetir o reintentar una tarea;
  - llenar la semana en Contenido.

  Sus piezas pueden ir a las nueve redes.
- **Ve más:**
  - al lado del calendario de tareas, sus tareas, rutinas y tus fechas límite (antes veía las piezas de Contenido);
  - en Tareas, la tarea o el proyecto abierto;
  - cómo sale lo aprobado (modo, conductor, cuota de Instagram, fallos);
  - la semana de redes;
  - ids en todo lo que puede tocar.

  Y el mapa de la oficina va en su prompt.
- **Dice lo que no pudo hacer** («No incluyo 2 cambios que pensé: …»). Antes se perdía en silencio.
- **Cualquier modelo:** su respuesta se lee aunque el modelo escriba antes del JSON, ponga un ejemplo o use un bloque de código.
- **Fallos arreglados:**
  - tus tareas ya no se mueven ni se cancelan como las de un agente;
  - un agente ya no reescribe una pieza que espera tu OK, ni borra piezas o textos guardados;
  - la tarjeta de una rutina mensual se lee bien y no se vuelve semanal;
  - el atajo «Rellena los huecos» contaba 7 días diciendo dos semanas.
- **Los agentes leen** las rutinas (`ver_rutinas`), lo publicado con sus cifras (`ver_resultados`) y los huecos de la semana (`ver_huecos`). La agenda acepta `dias` y `dept`.
- **Tu IA en esta computadora** (Claude Desktop, Claude Code, Cursor…) se conecta con `oficina-mcp.mjs` (`docs/conectar-ia.md`):
  - lee todo;
  - habla con Dimitri;
  - crea trabajo, que siempre espera tu OK antes de enviar;
  - hace los mismos cambios que Dimitri, con una clave para deshacer durante 10 minutos.

  Nunca aprueba, envía, publica, paga ni borra. Ningún agente recibe ese MCP.

## F4 de Contenido: aprender de lo publicado — 9 oct 2026

- **Lo publicado enseña al Cerebro.** Cinco días después de salir, cada pieza se ordena entre las demás por sus interacciones. Si la escribió un agente, las notas que citó se acercan o se alejan según cómo le fue (`contenido/aprender.mjs`).
- **El informe del lunes habla de las redes:**
  - lo que salió y cómo le fue;
  - la que más y la que menos movió;
  - los días sin nada;
  - lo que puede volver.

## Lo que faltaba de C2 y el C3 de Contenido — 8 oct 2026 (lo publicado con sus cifras, llenar la semana, plantillas y el teléfono)

Pedido del dueño: «haz lo que falta de C2 y C3» (`docs/analisis-editor-contenido-2026-10-08.md`).
- **Lo ya publicado en el calendario, con sus resultados.** Lo que Analíticas lee de Meta se junta con la pieza de la que salió (por su enlace, o por la red, la hora y el principio del texto): la tarjeta suma el alcance y las interacciones, y la vista previa al pasar las da red por red. Lo publicado a mano (o antes de la oficina) sale como tarjeta propia, de solo lectura y con enlace, con el filtro **«Publicado fuera»**.
- **Las mejores horas de una red:** «Mejores horas de [tus redes ▾]» en la semana y en «cuándo sale» del editor (se recuerda).
- **La zona horaria a la vista** (las horas son las del reloj de la oficina, con su desfase de UTC) y **la cuota de Instagram** con Meta directo («3 de 100 publicaciones por API en 24 h», o lo publicado desde aquí).
- **Llenar la semana** («+ Crear» o Programación): los días sin nada en tus redes, cada uno con su mejor hora; en cada hueco, un borrador nuevo de Marketing (con imagen del Estudio) o **algo que ya funcionó y vuelve** (la mitad de arriba de lo publicado, sin repetirse en 8 semanas). Crea las copias que vuelven (en revisión) y una tarea para tu puesto de redes. Programación gana **«Borradores de la semana»** con «Aprobar los N que pueden salir».
- **Plantillas de publicación** como notas del Cerebro (`Contenido/Plantillas/<nombre>.md`): «Guardar como plantilla» al pie de una pieza y «Desde una plantilla…» en «+ Crear». Los agentes las leen con `ver_plantillas_contenido`.
- **Aprobar desde el teléfono:** `/contenido` en Telegram, y el borrador de un agente llega solo, cada pieza con su foto, su texto y sus botones.
- **La página no crece:** las dos ventanas nuevas viajan con el editor (`dist/pieza-editor.js`).
- **Pruebas:** `tests/contenido-c3.test.mjs` (8 casos) y la cuota en `tests/meta-publicar.test.mjs`; `node scripts/c3-contenido-recorrido.mjs` (1512 claro y oscuro, 1024 y 390).

## C1 y C2 de Contenido — 8 oct 2026 (el editor que se escribe primero y las tarjetas que se leen de un vistazo)

Pedido del dueño tras comparar con Metricool: «¿podemos tener un panel mucho mejor que ellos?» → «haz C1 y las tarjetas de C2».
- **Formato por red:** cada red de la pieza lleva su ficha con su formato (Instagram Reel y Facebook Post con el mismo video; Short o Video en YouTube; Pin en Pinterest). Las reglas revisan cada red con el suyo, el arreglo de un formato toca solo esas redes, y cada formato distinto sale como su propia publicación (Meta, Metricool y el simulacro). Lo aprobado antes no cambia de huella: `formatos` solo se guarda si alguna red sale distinta.
- **Un solo cuadro de escribir:** el texto, los archivos dentro (se ordenan arrastrando, o con ‹ ›) y una barra con emoji, hashtags (tus juegos y los que más usas), primer comentario, enlace, **textos guardados** (la firma, una llamada a la acción; una nota del Cerebro, `Contenido/Textos guardados.md`) y **✨ Mejorar con Marketing**: tu agente de contenido propone el texto con la voz de la marca, sus instrucciones, sus lecciones y tus cifras; tú lo usas, pides otra o lo descartas (DESHACER). Un contador por red.
- **Editar por red:** pestañas sobre el mismo cuadro (el texto principal, Facebook, X…); la que lleva texto propio se marca.
- **Lo demás, plegado:** «Configuración de Instagram» (la historia también), Pinterest, YouTube, TikTok y las notas; se abren solas si les falta algo. **«N problemas»** arriba se despliega con sus arreglos de un clic.
- **El pie:** cuándo sale (con los días y las horas rápidas y la mejor hora, que se despliegan) y **Aprobar ▾**: pasar a revisión, volver a borrador y **Publicar ya** (aprobada para dentro de unos 5 minutos, con un segundo clic).
- **Vista previa en teléfono o computadora.**
- **Tarjetas del calendario:** el texto que sale bajo el título, «+N» sobre la miniatura cuando hay más archivos, el icono del formato de la red que sale distinto, y **la vista previa al pasar el ratón** (o al llegar con el teclado): la imagen, el texto entero, los hashtags y el estado; un clic la abre, Esc la cierra.
- **La página pesa menos que antes:** el editor llega en su propio paquete (`dist/pieza-editor.js`, `build-pieza.mjs`, `src/pieza-carga.js`) que se trae al abrir Contenido. La página baja de 2,27 a 2,22 MB.
- **Pruebas:** `tests/contenido-formatos.test.mjs`, `tests/contenido-editor.test.mjs`; `node scripts/editor-contenido-recorrido.mjs` y `node scripts/tarjetas-contenido-recorrido.mjs` (1512, 1024 y 390, claro y oscuro); el calendario de tareas, idéntico (`calendario-capturas`).

## F3 de Contenido — 8 oct 2026 (publicar directo con Meta)

Pedido del dueño: «quiero ir conectando Meta, para las métricas y estadísticas y publicar posts» → «construye la publicación directa con Meta». Guía: `docs/conectar-meta.md`; diseño: §17 de `docs/propuesta-contenido-y-meta.md`.
- **Meta directo** en Ajustes → Contenido → «Quién publica en modo real». Usa el token de Analíticas con los permisos de publicar.
- **Facebook** (foto, varias fotos, video, texto) queda programado en Meta y sale solo, con la computadora apagada.
- **Instagram** (imagen, carrusel, reel, historia) no se puede programar por la API de Meta. Lo publica la oficina a su hora: prepara 15 minutos antes y publica a la hora. Hasta 30 min tarde todavía sale; después, FALLÓ con el motivo.
- **Nunca dos veces:** se lee el contenedor antes de publicar, y lo que Meta no contesta no se repite a ciegas.
- **El resto:** el primer comentario después de publicar; los enlaces en Programación al instante; «Comprobar conexión» con la página, el Instagram, los permisos y la cuota.
- **Programación lo dice:** «PROGRAMADA» (en Meta), «SALE A SU HORA» (Instagram, desde esta computadora), «PUBLICADA» con enlaces.
- **Para probar con el token real sin publicar nada:** `node scripts/check-meta-publicar.mjs` (`--video`, `--facebook`).
- **Pruebas:** `tests/meta-publicar.test.mjs` (14 casos), `tests/contenido-cola.test.mjs` y `tests/contenido-programador.test.mjs`.

## Plan D, arreglos y lo tuyo fuera de Tareas — 8 oct 2026 (revisión de las tareas del dueño)

Pedido del dueño tras la revisión: «haz los cuatro cambios» — tus tareas desde el calendario y desde el panel, las listas Hoy y Próximos más claras, y el estado de la oficina dentro de Ajustes.
- **Calendario (P):** «PARA MÍ» es la primera opción al hacer clic en un día. Lo que escribes es una tarea tuya (Tareas → Mías), sin agente, modelo, esfuerzo ni equipo: «todo el día» en el mes, la hora que tocaste en la semana, y REPETIR la repite cada día, semana, 2 semanas o mes como tus tareas. Aparece al instante en TUYAS. Se recuerda la elección.
- **Panel de tareas (T):** «PARA MÍ» encabeza el menú de departamento (lee «para el viernes», «!alta», «#etiqueta»; sin modelo, REPETIR ni EQUIPO) y la línea **«Lo tuyo hoy · N»** (con las vencidas en rojo) abre Tareas → Mías → Hoy. Lo tuyo no entra en la lista de los agentes.
- **Mías:** **Hoy** pone las vencidas aparte y arriba; **Próximos 7 días** lleva un título por día («Mañana», «viernes 9 oct»…).
- **Ajustes → Estado:** «Estado de la oficina» deja de ser un botón del dock y pasa a ser la primera pestaña de Ajustes (la tecla O la sigue abriendo). El engranaje lleva su luz, solo en ámbar o rojo, y entonces abre en Estado. Ajustes ya no enseña por un momento la pestaña anterior al abrirse.
- **Pruebas:** `tests/tareas-dueno.test.mjs` (Hoy y Próximos); `node scripts/lo-tuyo-recorrido.mjs` (calendario, panel y Estado a 1512 claro y oscuro y a 390); `scripts/mias-recorrido.mjs` y `calendario-capturas` sin cambios.
- **Delegadas:** lo que delegaste y el agente **no pudo hacer** (falló tras sus reintentos) salía bajo «VOLVIERON HECHAS» y dejaba de contarse. Ahora sigue pendiente, arriba, con «Falló» y el número de la lista en rojo; Dimitri también lo ve («FALLÓ: el agente no pudo»). Lo que detuviste tú no se cuenta ni como pendiente ni como hecho. Test en `tests/tareas-dueno.test.mjs`.
- **Calendario (P):** la capa TUYAS (y la de CONTENIDO) se leía una sola vez por rango de fechas: una tarea tuya creada o marcada en Mías, en Telegram o por Dimitri no aparecía al volver al calendario hasta cambiar de semana o apagar y encender la capa. Ahora se vuelve a leer al abrir el calendario y cada 30 s, y solo se redibuja si algo cambió (`calendario-capturas`: idéntico).

## Plan D — 7 oct 2026 (las tareas del dueño)

Pedido del dueño: «la oficina está pensada para que trabajen los agentes, pero no contempla que yo tenga tareas para mí mismo; quiero tenerlas, delegarlas o trabajarlas yo, como en TaskView, y que los agentes entiendan que esto es del jefe». Diseño: `docs/analisis-tareas-del-dueno-2026-10-07.md`.
- **Mías**, la primera pestaña de Tareas: Bandeja, Hoy, Próximos 7 días, Todas (por fecha), Delegadas, Hechas y tus proyectos, con su número; la casilla redonda que la marca hecha (DESHACER), «+ Añadir tarea» con la fecha o el proyecto de la lista, COMPLETADAS · N y el tablero Por hacer · Haciendo · Hecha.
- **«Para mí»** en el campo de arriba: una tarea tuya, sin enrutador ni agente (y «el lunes a las 9» es su hora).
- **El detalle de lo tuyo:** Hecha, Empezar (con tu cronómetro) o Dejar para luego, **Delegar…** a un agente o a una persona con una nota, Devolver a quien la tenía; área, notas, pasos y lo de siempre.
- **«Lo hago yo» / «Lo termino yo»** sobre la tarea de un agente (también arrastrándola a «Tuyas y de personas» en el Tablero), con DESHACER que la devuelve como estaba.
- **Los agentes:** lo tuyo sale «DEL DUEÑO» y no lo tocan; `sugerir_al_dueno` te deja sugerencias en la Bandeja (cinco como mucho); lo delegado les llega con tu nota; un «Para ti» de un bloqueo nace tuyo y para hoy.
- **Dimitri** lee tu lista y puede asignarte una pieza («Tú (tu lista)»); **Inicio** abre con «Lo tuyo hoy»; la **Lista** filtra por «Quién»; el **calendario** tiene la capa TUYAS y el `.ics` las lleva; **Telegram** suma `/mias` (con ✅) y `/yo`.
- **Pruebas:** `tests/tareas-dueno.test.mjs` (lo puro, las rutas, el MCP, la vista, Dimitri), `tests/telegram.test.mjs`; `node scripts/mias-recorrido.mjs` en el navegador a 390, 1024 (con Dimitri) y 1512 px, claro y oscuro.

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
