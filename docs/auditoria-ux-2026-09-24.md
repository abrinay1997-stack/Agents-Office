# Auditoría de experiencia de usuario y funcionamiento — 24 sep 2026

Estos son los 100 problemas más importantes de la oficina: desplazamiento, navegación, pantallas, accesibilidad y lógica. Salieron de tres fuentes:

- lo que el dueño reportó (U);
- una revisión de accesibilidad y adaptación a pantallas (A);
- una revisión de lógica y navegación (L).

Se unieron los duplicados y cada punto va con su estado.

**✅ = arreglado** (commits `c69cfd4` y siguientes; los 31 que quedaban, en V4.1, rama `claude/gracious-pascal-aryw2d`) · **⏳ = pendiente** · la gravedad va entre corchetes.

## 1. Lo que reportó el dueño

1. ✅ [alta] **La rueda del ratón no desplazaba ningún panel.** La vista 3D la capturaba en toda la página: había que arrastrar la barra de scroll. Ahora la rueda solo acerca la oficina cuando el cursor está sobre ella; en paneles, listas y chats desplaza. (`src/main.js`, listener `wheel`)
2. ✅ [alta] **Al abrir un departamento, su chat no se podía cerrar** más que con «Vista general». Ahora tiene ✕ en su cabecera, y alejar con la rueda ya no lo cierra a mitad de conversación.
3. ✅ [alta] **Dimitri (antes «Subgerente») siempre repartía** y mostraba «repartiendo…».
   - Ahora elige entre charla, estado, análisis, plan o pregunta.
   - Lee las notas del cerebro y los últimos resultados.
   - Solo propone tareas cuando hay trabajo que hacer.
   - Mientras trabaja muestra «Dimitri está pensando».
4. ✅ [media] **El Subgerente estaba en la barra de arriba.** Ahora Dimitri vive en el centro de la oficina, junto al Cerebro, que tiene un icono de cerebro animado (las sinapsis se encienden cuando un agente lee una nota). Tecla S.
5. ✅ [media] **«BETA» junto al nombre** era la etiqueta de versión del proyecto original. Ahora se ve el nombre del negocio (PanaClaw · OFICINA), y la versión queda en la línea de licencia de abajo.
6. ✅ [media] **Al desplegar los conectores, los botones de la derecha se movían.** Ahora los conectores tienen su propio carril, que se encoge (los iconos bajan de 27 a 16 px), y las herramientas quedan en un dock fijo.
7. ✅ [media] **Estudio y Calendario eran botones de texto.** Ahora son iconos: la claqueta para el Estudio y el calendario, con su nombre y atajo al pasar el cursor.
8. ✅ [media] **El reloj con segundos movía la barra.** Se quitó.
9. ✅ [media] **El panel de tareas de la derecha no se podía ocultar desde arriba.** Ahora hay un interruptor en el dock (y la tecla T).
10. ✅ [baja] **Decía «OPERA CON» antes del logo de Claude.** Ahora solo se ve el logo: Claude, o Meta si el iniciador arrancó con Meta.
11. ✅ [baja] **Los medidores de sesión y semana estaban en la barra.** Ahora están en la esquina inferior izquierda, junto a la marca. Sí funcionan: leen el uso real del plan de Claude.
12. ✅ [media] **Visualización de conectores.** Ahora hay un panel con tres grupos:
    - los listos, con los departamentos que alimentan;
    - los que necesitan atención, con el motivo en palabras;
    - los bloqueados para los agentes.

    Incluye un interruptor para mostrar u ocultar los iconos en la barra.
13. ✅ [alta] **Los filtros del Cerebro eran pobres.** Hoy permiten:
    - carpetas en modo «solo estas / todas», con su cuenta;
    - filtrar por fecha (hoy, 7 o 30 días), por quién la escribió (la empresa o los agentes), por departamento, y ver las notas sin enlaces;
    - buscar en el TEXTO de las notas, ignorando acentos, con una lista de resultados (↑ ↓ Enter);
    - ver un contador, «Limpiar filtros» y un aviso cuando nada coincide;
    - recordar los filtros.
14. ✅ [alta] **El Estudio era poco intuitivo.** Ahora es un compositor en 5 pasos:
    - un selector de modelos que dice para qué sirve cada uno;
    - el formato elegido con figuras, y «Más ajustes» plegado;
    - Cantidad y GENERAR siempre visibles;
    - las acciones como iconos sobre cada imagen.

## 2. Navegación y ventanas

15. ✅ [alta] Las teclas de una letra seguían funcionando con una ventana abierta: G, B, 1–6 abrían otras ventanas invisibles detrás. Ahora se ignoran, salvo la tecla de esa misma ventana. (A1, L13)
16. ✅ [alta] Esc no cerraba Dimitri, la ficha del agente ni el panel de conectores: salía del departamento y los dejaba abiertos. Ahora cierra siempre la ventana de arriba. (A6, L14)
17. ✅ [alta] «Ver su nota en el Cerebro» o «Abrir el chat» desde el detalle de una tarea abrían el destino DEBAJO del calendario, del tablero o del propio detalle. Ahora cierran lo de encima. (A9, L10)
18. ✅ [alta] El detalle de una tarea se redibujaba cada 6 s: el scroll volvía arriba, «Guardado.» desaparecía y se perdía el foco. Ahora solo se redibuja si la tarea cambió. (A5, L6)
19. ✅ [media] Al cerrar Dimitri, el Estudio o el detalle, el cursor se quedaba «dentro» de la ventana oculta y se tragaba los atajos. Ahora se suelta.
20. ✅ [media] El Cerebro y el calendario cerrados seguían alcanzables con Tab, aunque invisibles. Ahora quedan inertes al cerrarse. (A3)
21. ✅ [media] El calendario no devolvía el foco al cerrarse. (A22)
22. ✅ [media] Faltaban trampas de foco en las ventanas modales: con el Estudio o el Cerebro abiertos, Tab salía a la barra de arriba. Ahora, con una ventana abierta, el resto de la página queda inerte y Tab da la vuelta dentro de ella (`src/modal.js`). (A21)
23. ✅ [media] El tablero cerrado y el panel minimizado conservaban controles alcanzables con Tab. Ahora quedan inertes; el tablero recibe el foco al abrirse y lo devuelve al cerrarse. (A4)
24. ✅ [media] El detalle se abría fuera del calendario, que tiene aria-modal, y los lectores de pantalla no llegaban a él. Ahora, abierto encima de otra ventana, el detalle es modal y la de abajo queda inerte hasta que se cierra. (A10)
25. ✅ [media] La ficha del agente descartaba los cambios sin guardar al cerrarse, sin avisar. Ahora pregunta antes (también al pasar a otro agente o cerrar la página). (L35)
26. ✅ [baja] La ventanita «Programar para» del calendario perdía lo escrito con un clic fuera. Ahora lo recupera al abrirse otra vez, con «Borrarlo». (L51)
27. ✅ [media] B (tablero), D (oscuro), 1–6 y X solo existían como teclas. Ahora hay una hoja de atajos con «?» o el teclado del dock (cada línea es un botón que lo hace) y el modo oscuro se recuerda en el navegador. (L33)
28. ✅ [baja] La tecla X (una reunión inventada) funcionaba en la oficina real. Ahora solo en la demo. (L60)
29. ✅ [baja] Pulsar una rutina en el tablero no la abría: cambiaba el filtro y movía la cámara. Ahora abre el calendario en su próxima ejecución, con su editor; también con el teclado. (L55)
30. ✅ [media] La fila EN CURSO/PRÓXIMO/LISTO hacía dos cosas distintas según dónde estuviera. Ahora, en la tarjeta o en el chat, muestra ese departamento en el panel de tareas (y lo abre si estaba plegado). (L32)

## 3. Tareas, aprobaciones y rutinas (lógica)

31. ✅ [alta] Con dos borradores del mismo agente esperando, APROBAR/RECHAZAR en el chat actuaba sobre el primero de la lista, no sobre el que se ve. Ahora cada tarjeta guarda el id de su tarea y cada botón actúa sobre la suya. (L1)
32. ✅ [alta] Aprobar desde el detalle o el tablero no limpiaba el ⚠ del agente, ni el contador, ni la tarjeta del chat. Ahora el ⚠ sigue a los borradores que de verdad esperan, venga la decisión de donde venga (también de otra ventana). (L2)
33. ✅ [alta] RECHAZAR en el chat quitaba el ⚠ aunque la tarea seguía esperando, y lo siguiente que escribías se tomaba como corrección. Ahora RECHAZAR abre la nota en la propia tarjeta (DEVOLVER CON ESTA NOTA / CANCELAR) y el ⚠ se queda hasta que la nota sale. (L7)
34. ✅ [alta] «tarea: …» en el chat creaba, en la oficina real, una tarea falsa que solo existía en la página. Ahora va al servidor, y también acepta «agregar tarea:» y «pendiente:». (L3)
35. ✅ [alta] «El viernes a las 10 publica…» se volvía una rutina SEMANAL. Ahora:
    - un día nombrado una vez es una tarea programada para esa fecha;
    - «cada / los / todos los», los plurales o «cada semana» crean una rutina;
    - «el informe del lunes» no se toma como fecha. (L4)
36. ✅ [alta] En el chat de un agente, «¿qué hiciste el martes?» respondía «¿A qué hora?» y podía crear una rutina. (L5)
37. ✅ [alta] ELIMINAR una rutina desde el panel o el chat la borraba sin preguntar, y un fallo no se mostraba. (L11)
38. ✅ [media] Solo se entendía «revise: …» en inglés. Ahora también «revisa:», «corrige:» y «cambia:». (L25)
39. ✅ [media] «Limpiar listas» y «Archivar» no tenían vista de archivadas ni Deshacer. Ahora hay un filtro ARCHIVADAS con «Devolver a la lista» en cada fila, y un aviso con DESHACER (10 s, se pausa con el cursor encima). (L12)
40. ✅ [media] La lista mostraba solo 60 tareas sin avisar. Ahora dice «Se ven 60 de N» y muestra 60 más al pulsarlo. (L23)
41. ✅ [media] La lista se reordenaba bajo el cursor y un clic podía abrir otra tarea. Ahora se queda quieta mientras el ratón está sobre ella (y se mueve), y una fila con el foco del teclado lo conserva al redibujarse. (L24)
42. ✅ [media] Con un filtro activo, la lista vacía decía «Nada aquí por ahora» sin mencionar el filtro. Ahora nombra el filtro o la búsqueda y ofrece «Ver todas» o «Borrar la búsqueda». (L39)
43. ✅ [media] «LISTO» y «ENTREGAS REALES» contaban distinto la misma cosa. Ahora, en la oficina real, los dos cuentan las entregas de la lista (sin las partes de un equipo). (L31)
44. ✅ [media] Al abrir la página se volvían a publicar en los chats las entregas pasadas, incluidas las archivadas. Ahora las archivadas no vuelven, y las demás quedan solo como la tarjeta del archivo (sin «Listo», sin aviso en la actividad). (L37)
45. ✅ [media] El ⚠ de arriba contaba agentes, no borradores, y siempre llevaba al primero. Ahora cuenta borradores y cada clic lleva al siguiente, del que más espera al más nuevo; es un botón de verdad, con su nombre para lectores de pantalla. (L42)
46. ✅ [baja] Crear una rutina cambiaba el filtro del panel a «Programadas» sin avisar. Ahora el filtro se queda, el chip PROGRAMADAS destella y el aviso trae «Ver en PROGRAMADAS». (L58)
47. ✅ [baja] Tras Archivar o Eliminar en el detalle no había aviso ni Deshacer. Ahora los dos lo tienen; Eliminar ya no pregunta: la tarea sale al instante y el servidor la borra cuando pasa el DESHACER (o al cerrar la página). (L57)
48. ✅ [baja] Se añadía una espera artificial de 0,5–1 s antes de enviar un mensaje del chat real. Ahora solo la demo «escribe». (L59)

## 4. Dimitri

49. ✅ [media] Cada 3 s se cerraban las «Instrucciones para el jefe» que habías desplegado. (L15)
50. ✅ [media] «Descartar el plan» mostraba «Enviando a los jefes…». (L40)
51. ✅ [media] Un fallo al cargar la conversación parecía una conversación vacía; «Nueva conversación» vaciaba la vista aunque fallara. (L41)
52. ✅ [media] Cada 3 s el lector de pantalla releía toda la conversación. Ahora solo anuncia la respuesta nueva. (A24)
53. ✅ [media] La fecha que propone Dimitri para cada pieza no se podía editar ni quitar desde la tarjeta. Ahora es un campo de fecha y hora, con ✕ para quitarla («ya»); una hora pasada se rechaza. (L16)
54. ✅ [media] En la demo (sin servidor), Dimitri intentaba cargar la conversación y daba error.

## 5. El Cerebro

55. ✅ [alta] Al terminar cualquier tarea se recargaba la nota que estabas leyendo y el lector saltaba arriba. (L8)
56. ✅ [alta] Las notas sin enlaces no estaban en el grafo: no se veían ni se encontraban. Ahora están en un anillo exterior. (L9)
57. ✅ [media] La búsqueda solo miraba el nombre, distinguía acentos, no daba lista y no abría con Enter. (L17, L18, A33)
58. ✅ [media] Tras recargar el grafo, la búsqueda señalaba notas equivocadas. (L19)
59. ✅ [media] «Nuevas hoy» usaba la hora UTC: en Panamá, desde las 19:00, marcaba 0. (L20)
60. ✅ [media] Los colores por carpeta estaban fijados a la demo: el cerebro real salía gris. Ahora cada carpeta tiene un color estable. (L21)
61. ✅ [media] Con ciertos filtros el lienzo quedaba vacío sin explicación. (L22)
62. ✅ [baja] Con una nota abierta, la rueda no acercaba hacia el cursor. (L43)
63. ✅ [baja] No había vista de la papelera de notas, y «Deshacer» desaparecía al hacer clic en otra. Ahora el Cerebro tiene «🗑 Papelera»: cada nota tirada se ve 30 días, con «Restaurar». (L44)
64. ✅ [baja] «+N más» enlaces no se podía pulsar. Ahora es un botón que muestra el resto. (L45)
65. ✅ [baja] Un [[enlace]] a una nota fuera del grafo solo se ponía gris, sin decir por qué. Ahora dice «(no está en el Cerebro)» y explica el motivo al pasar el cursor. (L47)
66. ✅ [media] En tablet no se podía arrastrar ni pellizcar el grafo. Ahora usa Pointer Events: un dedo arrastra, dos pellizcan, un toque abre la nota. (A41)

## 6. El Estudio

67. ✅ [media] Un fallo al cargar la galería se mostraba como «Aún no hay nada». Ahora dice el error y ofrece Reintentar. (L36)
68. ✅ [baja] La papelera ignoraba los archivos que fallaban, y la favorita quedaba marcada aunque no se guardara. (L53)
69. ✅ [baja] La recarga cada 20 s cerraba el desplegable de modelo que tenías abierto. (L54)
70. ✅ [media] El visor ampliado no era un diálogo, no recibía el foco ni lo devolvía. (A23)
71. ✅ [media] Las acciones de las tarjetas se llamaban por su emoji para un lector de pantalla. Ahora tienen nombre. (A29)
72. ✅ [media] GENERAR tenía un contraste de 3,3:1. Ahora es naranja oscuro, ≈5:1. (A38)
73. ✅ [baja] Las casillas de selección y las acciones solo aparecían al pasar el ratón. En pantallas táctiles ahora siempre se ven. (A44)
74. ✅ [baja] Esc en el buscador cerraba todo el Estudio. Ahora primero vacía la búsqueda. (A57)
75. ✅ [baja] Las flechas del visor quedaban fuera de la pantalla entre 900 y 1050 px. (A42)

## 7. Pantallas y tamaños (responsive)

76. ✅ [alta] La franja del calendario se salía de la pantalla bajo ~1500 px y se llevaba el ✕. (A2)
77. ✅ [media] Entre 900 y 1280 px, el rail y el panel dejaban ~200 px de oficina. Ahora ambos se estrechan. (A12)
78. ✅ [media] Bajo 900 px, los botones +/−/⌂ quedaban debajo de la hoja de tareas. (A11)
79. ✅ [media] Bajo 900 px, «Vista general» tapaba la cabecera del chat. (A17)
80. ✅ [media] El rail ancho tapaba el panel de tareas. (A20)
81. ✅ [media] La marca de abajo tapaba el chat con el rail ancho. (A18)
82. ✅ [media] Las carriles del tablero se cortaban sin scroll. (A16)
83. ✅ [media] El Cerebro no tenía diseño para pantallas pequeñas. (A14)
84. ✅ [media] El calendario en pantallas estrechas: ahora se pliega la lista de rutinas y el popover cabe. Parcial: la cuadrícula de 7 días sigue apretada en un teléfono. (A13)
85. ✅ [media] El tablero en pantallas estrechas: ahora las columnas tienen ancho mínimo y scroll lateral. Parcial. (A15)
86. ✅ [media] El tablero quedaba debajo de «Vista general» y de la marca. Ahora va por encima de todo, con su ✕ para cerrarlo y el nombre del negocio. (A19)
87. ✅ [baja] El popover del calendario se cortaba en pantallas bajas. (A43)

## 8. Accesibilidad y teclado

88. ✅ [alta] Las tarjetas de los departamentos no se podían abrir con el teclado. Ahora son botones con Enter/Espacio, y las píldoras de los agentes también (con Tab dentro de su departamento). (A7)
89. ✅ [alta] En las filas programadas, Enter sobre CANCELAR abría el detalle en vez de cancelar. (A8)
90. ✅ [media] Faltaban nombres en la caja de tareas, el editor grande y el buscador del calendario; el editor grande no era un diálogo. (A30)
91. ✅ [media] El chat del agente no se anunciaba (ahora es role="log"). Desde V4.1 un mensaje nuevo se añade al final en vez de redibujar todo el chat: el lector de pantalla oye solo lo nuevo y un archivo abierto o una nota a medio escribir no se tocan. (A25)
92. ✅ [media] El menú de departamento del panel no tenía teclado ni aria-expanded. Ahora ↓ lo abre, ↑ ↓ Inicio Fin mueven, Enter elige y Esc cierra. (A26)
93. ✅ [media] Los interruptores REPETIR/EQUIPO y los filtros del panel y del calendario no decían si estaban activos. Ahora llevan aria-pressed, también DÍA/SEMANA/MES. (A27)
94. ✅ [media] Varios elementos solo respondían al clic: rutinas del calendario, las tareas sin fecha, los [[enlaces]] fuera del chat. Ahora responden a Enter/Espacio, y un [[enlace]] en el detalle o en Dimitri abre su nota. (A31, A32)
95. ✅ [media] Los anillos de foco convertían los botones redondos en rectángulos. (A45)
96. ✅ [baja] Con «reducir movimiento» activado, los indicadores de carga quedaban congelados. (A49)
97. ✅ [baja] La oficina 3D (el canvas) no tenía alternativa en texto para lectores de pantalla. Ahora la describe y dice cómo moverse con el teclado. (A54)

## 9. Visual, modo oscuro y textos

98. ✅ [media] En modo oscuro, el ámbar, el verde, el rojo, el azul y el violeta tenían un contraste de 2,3–3,5:1. Ahora tienen versiones claras; también los fondos que desaparecían. (A35, A36)
99. ✅ [media] Textos en inglés en la interfaz y en los errores del servidor: WHOLE OFFICE, routine, failed, result ready, click to view, Delivered, no such task… Ahora están en español, y las horas en formato local. Completo desde V4.1: las respuestas sobre rutinas del chat usan ejemplos en español y entienden «pausa», «reanuda», «ejecuta» y «elimina»; los avisos de equipo y de rutinas, también en español. (A51, L26–L28, L30, L48, L49)
100. ✅ [baja] Otros ajustes visuales:
    - las barras de scroll estaban ocultas en las listas y ahora se ven finas (A52);
    - los números que cambian ya no empujan a sus vecinos (A47);
    - el tamaño mínimo de letra ahora es 10,5 px (A56);
    - las filas terminadas se leen mejor (A39);
    - pasar el cursor ya no borra el ámbar de una tarea en espera (A37).

---

**Resumen:** los 100 están arreglados. En la primera ronda se arreglaron 69 (V4) y en V4.1 los 31 que quedaban:

- el flujo de aprobaciones por borrador;
- las archivadas con Deshacer;
- las trampas de foco y la hoja de atajos;
- la lista de tareas, el teclado, la papelera de notas, la tablet y el español.

Siguen parciales el 84 y el 85: el calendario y el tablero en un teléfono. Son mucho mejores que antes, pero el calendario pide una vista de agenda (ver `docs/auditoria-visual-2026-09-24.md`, punto 38).

La siguiente revisión, la visual (50 hallazgos, 37 aplicados), está en [auditoria-visual-2026-09-24.md](auditoria-visual-2026-09-24.md).
