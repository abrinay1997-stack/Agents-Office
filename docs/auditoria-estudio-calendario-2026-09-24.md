# Auditoría del Estudio y del Calendario — 24 sep 2026

Revisión a fondo de las dos ventanas que faltaban. Se hizo de tres formas:

- **Uso real.** En un servidor aislado, con la galería llena: 8 imágenes y videos del motor gratis, uno hecho por un agente y un intento con un modelo sin key. En el calendario, 7 rutinas (una pausada y una cada 2 horas) y 8 tareas programadas repartidas en seis departamentos.
- **Capturas** a 390, 1024 y 1512 px, en claro y en oscuro, en cada estado: selector de modelos, video, selección, visor ampliado, errores, mes, semana, día y las ventanitas.
- **Lectura completa del código:** `src/studio.js`, `src/calendar.js`, `media.mjs` y las rutas de `serve.mjs`.

**✅ = arreglado** en V4.2 (misma rama, 24 sep): las prioridades de «Por dónde empezar» y algunos vecinos que tocaban el mismo código — 9 del Estudio y 15 del Calendario —, y después la agenda del teléfono (B5), lo que ya pasó (B7) las acciones de la galería (A20, A21), y luego «Mejorar el prompt» (A2), la ventanita de la rutina (B16) el aviso con el Estudio cerrado (A41), y por último el tiempo estimado y el aviso al cancelar (A39, A40), el visor ampliado (A32–A35) y DESHACER en el calendario (B21). En total 38; el resto sigue abierto. Cada punto va con su gravedad y con lo que se propone.

**Gravedad:**
- **alta:** molesta a diario o puede hacer perder trabajo o dinero;
- **media:** confunde o hace dar vueltas;
- **baja:** pulido.

---

## A. El Estudio (52 hallazgos)

### A1. Lo que confunde al crear

1. ✅ **[alta] Con un modelo de imagen, el paso 4 habla de video.** Los huecos dicen «Imagen inicial: *el video* empieza así» y «Imagen final: *el video* termina así». Los textos de `ROLE_HELP` sirven solo para video. **Propuesta:** textos según el tipo, p. ej. «Imagen a editar» y «Resultado parecido a esta».
2. ✅ **[alta] «Mejorar el prompt» reescribe en inglés sin avisar antes.** El dueño escribe en español y recibe un párrafo en inglés que quizá no puede revisar. **Propuesta:** decirlo en el botón («Mejorar (lo pasa a inglés)») y mostrar debajo una traducción al español, o dejar elegir el idioma.
3. ✅ **[alta] El formato y la duración del video quedan escondidos al final.** El paso 5 solo se ve bajando, y el pie («1 video · gratis») no dice ni el formato ni los segundos. Es fácil generar un 16:9 cuando se quería un 9:16. **Propuesta:** el pie resume «9:16 · 5 s · 1 video · US$0,40», y un clic en ese resumen lleva al paso 5.
4. ✅ **[alta] El error aparece lejos de lo que falla.** «Escribe qué quieres crear (paso 3)» sale en rojo al pie, con el campo del prompt fuera de la vista, y el campo no se marca. **Propuesta:** subir hasta el paso que falla, marcarlo en rojo y poner el mensaje junto a él.
5. **[media] El motor aparece junto al modelo cuando dice casi lo mismo:** «Prueba de video (gratis) · PRUEBA (GRATIS)». **Propuesta:** mostrar el motor solo si aporta, p. ej. «Kling 3 · Higgsfield».
6. **[media] Sin keys, el selector solo muestra «Prueba».** Los 40 modelos restantes quedan plegados en un «Sin activar: …» de una línea, así que el dueño no sabe qué ganaría al activar cada motor. **Propuesta:** lista visible pero atenuada, con «Activar» y el precio de cada uno.
7. **[media] El selector de modelos no se maneja con el teclado.** Tiene role listbox, pero las flechas no mueven, no hay Inicio ni Fin, y Tab recorre 40 botones. **Propuesta:** flechas y Enter, como en el menú de departamento del panel.
8. **[media] La tarjeta del modelo elegido sale dos veces** al abrir la lista: arriba, y otra vez como primera opción. **Propuesta:** que la lista se abra sobre la tarjeta y la sustituya.
9. **[media] «Varias ideas (una por línea)» es una casilla pequeña al lado del título.** Cambia por completo cómo se lee el prompt y no se nota. **Propuesta:** un interruptor «Una idea / Varias ideas» con un ejemplo, y el conteo «3 ideas × 2 = 6 imágenes» a la vista.
10. **[media] Solo se pide confirmación a partir de US$1.** Diez videos de US$0,90 salen sin preguntar. **Propuesta:** un tope por pedido configurable y avisar desde US$0,50; mostrar el gasto del día junto al botón.
11. **[media] El contador de caracteres aparece de golpe a los 3000**, con el límite en 4000. **Propuesta:** mostrarlo siempre en gris y en ámbar cerca del límite.
12. **[media] Cantidad máxima 8 para imagen y 4 para video, sin decirlo.** El «+» deja de responder sin más. **Propuesta:** desactivar el «+» y poner «máximo 4 por pedido» al pasar el cursor.
13. **[baja] Después de GENERAR, el prompt se queda.** Otro clic genera lo mismo otra vez, y cuesta. **Propuesta:** un botón «Nuevo» para vaciar el compositor, y avisar si el mismo prompt se genera dos veces seguidas.
14. **[baja] Pegar una imagen en el prompt la sube sin preguntar** y la pone como referencia (el `paste` de todo el Estudio). **Propuesta:** un aviso con «Deshacer», o preguntar dónde ponerla.
15. **[baja] Formatos sin pista de uso en video:** el 16:9 dice «Web · You…» cortado, y en el teléfono los nombres se cortan. **Propuesta:** textos de una palabra, o el uso al pasar el cursor.
16. **[baja] Las subidas grandes van en base64 dentro de JSON:** un video de 25 MB viaja como 33 MB sin barra de progreso («Subiendo…» sin porcentaje). **Propuesta:** subida por partes o con progreso.

### A2. La galería

17. ✅ **[alta] El orden de lectura está roto.** Las columnas de tipo «masonry» (CSS `columns`) ordenan de arriba abajo por columna: lo más nuevo baja por la primera columna y después salta a la segunda. De izquierda a derecha, las fechas quedan desordenadas. **Propuesta:** una cuadrícula que ordene por filas, o masonry con JavaScript por filas.
18. ✅ **[alta] Cada 20 s la galería entera se redibuja** (`load` → `renderGrid` → `innerHTML`). Mientras algo se genera, cada 2,5 s. Resultado: los videos con la vista previa en marcha vuelven a empezar, se pierde el foco del teclado, parpadea y se descargan las miniaturas otra vez. **Propuesta:** redibujar solo las tarjetas nuevas o cambiadas.
19. **[media] Las imágenes de un mismo pedido salen como tarjetas sueltas** («logo … (1/2)», «(2/2)»), a veces lejos una de otra. **Propuesta:** agrupar por pedido, con el prompt una sola vez, y «Elegir la mejor» o «Descartar el resto».
20. ✅ **[media] Seis iconos sin texto sobre la imagen al pasar el cursor:** estrella, descargar, claqueta, más, repetir y papelera. La claqueta es «Animar» y el «+» es «Usar de referencia»: no se adivinan. Además, la papelera queda pegada a «Repetir». **Propuesta:** dos o tres acciones visibles con texto, el resto en un menú «⋯», y la papelera separada.
21. ✅ **[media] En pantallas táctiles los seis iconos se ven siempre y tapan media imagen** (en el teléfono, la mitad derecha). **Propuesta:** un menú «⋯» de un toque.
22. **[media] Las pestañas no dicen cuántos hay:** Favoritas, Tuyas, De agentes, Videos y Subidas. **Propuesta:** el número en cada una, como en el panel de tareas.
23. **[media] No hay forma de ordenar ni de agrupar por fecha** («Hoy», «Esta semana»), y todo carga de una vez. Con cientos de archivos se vuelve lento y cuesta encontrar algo. **Propuesta:** separadores por día y carga por partes.
24. **[media] «Tuyas» deja fuera tus propias subidas**, y la búsqueda solo mira el prompt, el modelo y el nombre del archivo, no el agente ni la tarea. **Propuesta:** que «Tuyas» incluya las subidas o se llame «Generadas por ti»; que la búsqueda mire también el agente y la tarea.
25. **[media] Una tarjeta hecha por un agente no dice para qué tarea fue.** Solo lo dice el visor, con «Ver la tarea». **Propuesta:** una etiqueta con la tarea en la tarjeta y un filtro «De esta tarea».
26. **[media] Al entrar en modo selección, la barra negra empuja la galería hacia abajo** (salto de 50 px), y no hay «Ninguna». **Propuesta:** la barra se superpone arriba de la galería, con «Todas / Ninguna» y el número.
27. **[media] Borrar desde la barra de selección pregunta *y además* ofrece DESHACER.** Desde la tarjeta no pregunta. **Propuesta:** en todos los casos, sin pregunta y con DESHACER (como el panel de tareas).
28. **[baja] Las casillas de selección solo aparecen al pasar el cursor**, y Mayús+clic para un rango no se ve en ninguna parte. **Propuesta:** decirlo en la barra: «Mayús + clic elige un rango».
29. ✅ **[baja] Se usan 13 px para la fecha y el modelo en la tarjeta,** y la fecha no dice la hora («24 sept»). **Propuesta:** «hoy 21:19», «ayer» y la fecha solo si es más antigua.
30. **[baja] Las tarjetas de prueba de video son una imagen**, no un video: el texto se monta encima («video de 5s del pan / saliendo del horno»), y no se puede probar reproducir. **Propuesta:** un clip corto de prueba de verdad.
31. ✅ **[baja] «Aún no hay nada…» cambia de texto según el filtro**, pero no ofrece volver a «Todo». **Propuesta:** un botón «Ver todo» (como en el panel de tareas).

### A3. El visor ampliado

32. ✅ **[media] No dice en qué posición estás** («3 de 8») y las flechas ‹ › quedan encima de la imagen. **Propuesta:** el contador arriba y las flechas fuera de la imagen.
33. ✅ **[media] «Copiar prompt» cambia a «Copiado ✓» y se queda así** hasta cerrar. **Propuesta:** que vuelva a su texto a los 1,5 s, como en el chat.
34. ✅ **[media] La fecha sale como «24/9/2026, 21:19:46»,** con segundos y otro formato que el resto de la oficina. **Propuesta:** «jue 24 sep, 9:19 p. m.».
35. ✅ **[media] Falta «Variar»** (otra versión parecida) **y comparar dos lado a lado.** Son las acciones que más se usan después de generar. **Propuesta:** «Variar» genera con la imagen como referencia y el mismo prompt.
36. **[baja] Las acciones del visor van en una columna de botones sin jerarquía,** y Papelera tiene el mismo peso que Descargar. **Propuesta:** Descargar y Animar como principales, el resto en «⋯».
37. **[baja] La descarga baja con un nombre técnico**, no con el prompt. **Propuesta:** que el archivo se llame con el prompt recortado y la fecha.

### A4. Trabajos en marcha y errores

38. ✅ **[alta] Si un modelo no tiene key, el error solo aparece como texto rojo al pie** («… no tiene key: guárdala en Windows con setx …»). No queda ninguna tarjeta, y el prompt sigue ahí sin saber qué hacer. **Propuesta:** un aviso con el paso a paso y un botón «Usar Prueba mientras tanto».
39. ✅ **[media] Una tarjeta en marcha no tiene barra de progreso ni tiempo estimado,** solo «Generando · 1:23». **Propuesta:** «suele tardar ~2 min» según el modelo.
40. ✅ **[media] «Cancelar» un trabajo no pregunta y no explica si se cobra.** **Propuesta:** decir «Ya se envió al motor: puede cobrarse igual» cuando corresponda.
41. ✅ **[media] Al terminar solo avisa el Estudio abierto.** Con el Estudio cerrado no hay aviso en la oficina (ni el dock ni un toast), aunque «sigue generando aunque cierres». **Propuesta:** un punto en el icono del Estudio del dock y un aviso «3 imágenes listas».
42. **[baja] Un trabajo fallado desaparece de la vista a los 3 días** sin dejar rastro. **Propuesta:** un historial de trabajos (hechos, fallados y cancelados), con el motivo.

### A5. Cabecera, tamaños y teclado

43. **[media] La barra de gasto del día no tiene texto en pantallas de menos de 900 px:** queda una barrita gris sin explicación junto al título. **Propuesta:** «12 / 40 hoy» siempre visible, o sin barra.
44. ✅ **[alta] En el teléfono, el compositor y la galería comparten la pantalla con dos scrolls anidados.** La galería queda en una franja de ~150 px debajo. **Propuesta:** dos pestañas en el teléfono, «Crear | Galería»; al generar, saltar a la galería.
45. **[media] A 1024 px el compositor ocupa el 40 % y la galería baja a 2 columnas** con el orden roto (ver 17). **Propuesta:** un compositor plegable a una franja.
46. **[media] El subtítulo del Estudio ocupa espacio en cada visita:** «Imágenes y video reales. Sigue generando…». **Propuesta:** mostrarlo solo la primera vez o dentro de «?».
47. **[media] Faltan atajos propios:** Ctrl+Enter genera, pero no aparece en la hoja «?» ni en el botón; tampoco hay atajos para el cambio imagen/video ni para buscar («/»). **Propuesta:** añadirlos a la hoja «?» y al título del botón.
48. **[media] La tecla «?» no funciona con el Estudio abierto:** el Estudio se come todas las teclas (`stopPropagation`). **Propuesta:** dejar pasar «?».
49. **[baja] El `<input type="range">` de los ajustes no dice la unidad** («Duración (segundos) 5»). **Propuesta:** «5 s».
50. **[baja] En modo oscuro, el logo de la cabecera es un cuadrado blanco**, y los botones «Subir» y «Seleccionar» tienen poco contraste de borde.
51. **[baja] El mensaje de estado del pie empuja el botón GENERAR hacia arriba** cuando aparece y cuando desaparece (salto de 20 px). **Propuesta:** reservar la línea.
52. **[baja] Sin ayuda de primera vez.** Un Estudio nuevo con «Prueba» no explica que es gratis y de mentira, ni cómo pasar a un motor real en un paso. **Propuesta:** una tarjeta «Empieza aquí» en la galería vacía.

---

## B. El Calendario (46 hallazgos)

### B1. Leer el mes, la semana y el día

1. ✅ **[alta] En el mes, las tarjetas se cortan.** La tercera se corta por la mitad dentro de la celda (se ven 2,5 tarjetas), y los títulos se reducen a «Revisar la bandeja y d…» o «Seguimiento a prospe…». Un día con carga no se entiende. **Propuesta:**
    - en el mes, una línea por evento: hora, punto de color y título;
    - «+N más» siempre visible;
    - la celda crece en la semana en curso.
2. ✅ **[alta] La vista de semana no tiene horas.** Es una lista por día, sin eje de tiempo, así que no se ven los huecos ni los choques. **Propuesta:** columnas por día con franjas horarias, como en cualquier calendario.
3. ✅ **[alta] En la vista de día, las tareas de la noche quedan cortadas** (19:13 y 20:10 se ven como una rayita dentro de su fila de 46 px). La vista no salta a la hora actual ni marca «ahora». **Propuesta:** filas que crezcan con su contenido, saltar a la hora actual y una línea roja de «ahora».
4. ✅ **[alta] La vista de día solo va de 06:00 a 22:00, y lo de fuera se mete sin avisar en la primera o la última fila.** Una rutina a las 05:00 aparece en «06:00» y una tarea a las 23:30 en «22:00». **Propuesta:** 00–24, con scroll a la hora laboral.
5. ✅ **[alta] En el teléfono, la semana no se puede leer:** siete columnas de 45 px, con los títulos partidos letra a letra («P… l… p… d…»). **Propuesta:** en el teléfono, una agenda (lista por días) en lugar de la semana y el mes.
6. ✅ **[media] El número del día va abajo a la derecha,** y las tarjetas empiezan arriba sin fecha a la vista. En días llenos el número queda tapado. **Propuesta:** el número arriba a la izquierda, como en todos los calendarios.
7. ✅ **[media] Lo que ya pasó no se ve:**
    - las rutinas solo se proyectan hacia adelante, así que una ejecución que falló o se saltó en el pasado no aparece;
    - solo salen las tareas terminadas;
    - no se sabe si la rutina de ayer corrió.

    **Propuesta:** marcar en el pasado cada ejecución: hecha ✓, falló ⚠, saltada, no corrió (oficina cerrada).
8. **[media] Pendiente, en curso y en espera se pintan siempre en HOY,** aunque se pidieran hace una semana. **Propuesta:** una franja «sin terminar» arriba del calendario, no dentro del día.
9. **[media] El avatar de cada tarjeta es una letra, y todos los jefes son «L»** (LÍDER CORREOS, LÍDER VENTAS…). No sirve para distinguir. **Propuesta:** el nombre corto del agente al pasar el cursor, y en la tarjeta el color del departamento con dos letras («LC», «LV»).
10. **[media] Los cuatro tipos de tarjeta se distinguen apenas por el borde y un símbolo pequeño:** rutina (discontinuo ⏱), programada (sólido ◷), lista (✓, fondo de color) y pausada (atenuada). **Propuesta:** una leyenda arriba y etiquetas de texto cortas.
11. **[media] La rutina «cada 2 horas» ocupa una tarjeta con «cada 2 horas de 09:00 a 17:00 · días hábiles»** en cada día del mes. **Propuesta:** una sola línea «⏱ cada 2 h» y el detalle al abrirla.
12. ✅ **[media] Los fines de semana tienen un rayado diagonal** que ensucia las tarjetas encima. **Propuesta:** un fondo liso un poco más oscuro.
13. **[baja] La semana empieza el lunes, con el comentario «AU/NZ/UK».** En Panamá lo habitual es el domingo. **Propuesta:** elegir el día de inicio (ajuste de la oficina).
14. **[baja] No hay número de semana ni vista de «próximos 7 días»** desde hoy (la semana siempre empieza el lunes).

### B2. Las ventanitas (crear, tarea programada, rutina, «+N más»)

15. ✅ **[alta] Salen fecha y hora en inglés o en formato de EE. UU.:**
    - en la rutina: «Esta ejecución: *Friday, September 25 at 08:30 AM*»;
    - en la tarea: «*09/26/2026*» y «*10:05 AM*»;
    - al crear: «*09:00 AM*».

    Mezcla el idioma y el formato del navegador con el de la oficina. **Propuesta:** `es-PA` en todos los textos, y hora de 24 h o «a. m./p. m.» en español.
16. ✅ **[alta] La ventanita de la rutina no cabe:** el título «Preparar los posts de Instagram de la semana» se sale del campo, y la fila de botones se reparte en varias líneas. Dos opciones (Eliminar y «Solo esta») quedan escondidas si no se baja dentro de la ventanita. **Propuesta:** título en un campo de dos líneas; botones Guardar y Ejecutar ahora; el resto en «⋯».
17. ✅ **[alta] Crear no pide confirmación visual del agente.** Al pulsar AGREGAR, Claude elige al agente en segundo plano y la ventanita se cierra. No se ve a quién le tocó hasta abrir la tarjeta. **Propuesta:** un aviso «Para el viernes 10:05 — lo tiene LÍDER MARKETING · Cambiar».
18. ✅ **[alta] Si el enrutador de Claude responde mal, crear falla con «Unexpected end of JSON input»** y la tarea se pierde. Visto en la prueba: `route()` hace `parseJSON` y no se recupera. **Propuesta:** si no hay JSON, dársela al jefe del departamento (como con un id desconocido) y decirlo en palabras.
19. ✅ **[media] «Necesita mi visto bueno» se ve siempre al crear**, aunque solo vale para las rutinas: `hidden` no gana a `display:flex`. Así parece que una tarea de una vez también esperará. **Propuesta:** mostrarlo solo con REPETIR, o que también valga para una tarea programada.
20. **[media] Los errores salen en la línea de cifras de arriba** (`say` en `E.stats`, p. ej. «No se pudo mover…»), lejos de la ventanita o de la tarjeta. **Propuesta:** el mensaje junto a lo que falló, y un aviso con DESHACER.
21. ✅ **[media] Cancelar una tarea programada pregunta** («¿Cancelar…?») y no ofrece deshacer; eliminar una rutina, igual. **Propuesta:** sin pregunta, con DESHACER, como el panel.
22. **[media] «Ejecutar ahora» no dice qué pasa luego:** si esperará tu OK, ni dónde aparecerá. **Propuesta:** un aviso «En marcha: la ves en EN CURSO y te pedirá el OK».
23. **[media] El selector de cadencia tiene solo 10 opciones** (diario, días hábiles, un día de la semana, cada hora). Una rutina «lun, mié, vie» aparece como un texto fijo que no se puede editar sin perderla. **Propuesta:** casillas de días (L M X J V S D) y hora; «cada N horas» con desde y hasta.
24. **[media] El modelo (SONNET) aparece en la ventanita de crear,** pero no el esfuerzo ni EQUIPO, que el panel sí tiene. **Propuesta:** las mismas opciones que el panel, plegadas en «Más».
25. **[media] La ventanita se abre al lado de la celda y tapa el día elegido y sus vecinos.** En la fila de abajo tapa la semana siguiente. **Propuesta:** anclarla con una flecha y dejar visible el día elegido.
26. **[baja] «+N más» abre otra ventanita encima**, en lugar de pasar a la vista de ese día. **Propuesta:** «Ver el día» dentro de la ventanita.
27. **[baja] El nombre de la tarea programada es el texto entero** («Revisar la campaña de octubre con el cliente número 1»). No hay título corto editable como en las rutinas.

### B3. Arrastrar y mover

28. ✅ **[alta] Arrastrar solo funciona con ratón** (HTML5 drag and drop). En tablet o teléfono no se puede mover nada, y no hay alternativa de teclado. **Propuesta:** Pointer Events para arrastrar con el dedo, y «Mover a…» en la ventanita.
29. **[media] Muchas tarjetas no se pueden arrastrar y no se explica por qué.** Solo se mueven las tareas programadas y las rutinas semanales de un solo día, más las diarias en la vista de día. Una rutina «lun, mié, vie» o una tarea lista no se mueve, y el cursor no avisa. **Propuesta:** cursor «no permitido» con un texto «Esta rutina se cambia desde su ventanita».
30. **[media] Soltar una rutina semanal en otro día cambia la rutina para siempre** (el día de la semana), sin preguntar si era solo esta vez. **Propuesta:** preguntar «¿Solo esta vez o siempre?».
31. ✅ **[media] No se puede cambiar la duración ni la hora arrastrando en la semana** (no hay eje horario, ver 2).
32. **[baja] «SIN FECHA» no aclara que se puede arrastrar**, salvo al pasar el cursor. Si está vacía ocupa espacio igual («Nada pendiente sin fecha»). **Propuesta:** plegarla cuando está vacía.

### B4. La columna de la izquierda

33. ✅ **[alta] Cada rutina dice «EN ESPERA DE TU VISTO BUENO»**, cuando en realidad solo la *pedirá* al terminar. Se lee como si algo estuviera esperando ahora. **Propuesta:** «pedirá tu OK», y ámbar solo cuando de verdad hay un borrador esperando.
34. **[media] La lista de rutinas no se puede buscar ni agrupar por departamento,** y ocupa toda la altura. Con 20 rutinas no se encuentra nada. **Propuesta:** agrupar por departamento, con buscador y plegado.
35. **[media] Clic en una rutina la filtra («SOLO ESTA RUTINA»)**, pero no abre su editor. Para editarla hay que encontrarla en el calendario. **Propuesta:** clic abre la ventanita; «ver solo esta» va como un icono.
36. **[media] «CARGA DEL MES» es una lista de agentes con barras, sin escala ni significado claro** (¿tareas? ¿horas?). **Propuesta:** «8 ejecuciones · 2 tareas» por agente, con un aviso si alguien pasa de su tope.
37. **[baja] En pantallas de menos de 900 px la columna desaparece entera.** Las rutinas y SIN FECHA quedan inaccesibles en el teléfono. **Propuesta:** un botón «Rutinas» que la abra como panel.

### B5. Cabecera, filtros y teclado

38. ✅ **[alta] A 1512 px en la vista de semana, el ✕ de cerrar se corta en el borde derecho:** el título de la semana es más largo y la guía de teclas empuja. **Propuesta:** guía de teclas en «?» y ✕ siempre visible.
39. ✅ **[media] La guía de teclas de la cabecera dice «D W M vista»**, y en la oficina D es el modo oscuro; la hoja «?» no menciona D para el calendario. **Propuesta:** alinear la hoja «?» con el calendario, o usar otras teclas para las vistas.
40. **[media] Los filtros de departamento funcionan al revés de lo esperado.** El primer clic deja *solo* ese departamento, los siguientes van añadiendo, y al quitar el último vuelven todos. Nada lo explica. **Propuesta:** «Todos» como botón propio, igual que en el Cerebro.
41. **[media] La búsqueda no dice cuántos resultados hay** ni salta a la fecha del primero. Buscar algo de la semana que viene en el mes actual parece dar vacío. **Propuesta:** lista de resultados con su fecha, como en el Cerebro.
42. **[media] El calendario se redibuja cada 30 s** (si no hay ventanita abierta): se pierde el foco del teclado y el scroll de la vista de día vuelve arriba. **Propuesta:** redibujar solo si algo cambió.
43. **[baja] «HOY» no cambia a la vista de hoy si estás en otra vista con la fecha fuera de rango:** solo mueve el ancla.
44. **[baja] El título del mes no dice cuántas cosas tiene la semana en curso,** y las cifras («26 ejecuciones de rutinas · 8 programadas · 3 listas») no se pueden pulsar para filtrar. **Propuesta:** que cada cifra sea un filtro.
45. **[baja] En modo oscuro, la cabecera sigue siendo negra sobre fondo negro,** sin separación con el resto. **Propuesta:** un borde o un tono distinto.
46. **[baja] No se puede exportar a Google Calendar ni suscribirse (.ics)**, así que el dueño no ve las rutinas de la oficina en el calendario de su teléfono. **Propuesta:** un enlace .ics de solo lectura.

---

## Por dónde empezar

**Estudio:**
- A1 (textos de video en imagen);
- A3 (formato escondido);
- A4 (error lejos);
- A17 (orden de la galería);
- A18 (redibujado cada 20 s);
- A38 (motor sin key);
- A44 (teléfono en pestañas).

**Calendario:**
- B1 (mes ilegible);
- B2 (semana con horas);
- B3–B4 (día cortado);
- B15 (fechas en inglés);
- B18 (tarea perdida si falla el enrutador);
- B28 (arrastrar en tablet);
- B33 (el falso «en espera»);
- B38 (✕ cortada).
