# Auditoría visual y de usabilidad — 24 sep 2026 (V4.1)

50 hallazgos sobre el aspecto visual, la adaptación a pantallas y la accesibilidad.

**Cómo se revisó:**
- Capturas de la oficina real (servidor aislado) y de la demo en 390, 768, 1024, 1280, 1512 y 1920 px, en modo claro y oscuro, con ratón y con pantalla táctil.
- Un análisis automático con axe-core (WCAG 2.2 AA y buenas prácticas) en siete vistas: la oficina, un departamento, el calendario, el Cerebro, el Estudio, el tablero y Dimitri.
- Uso real de cada ventana con teclado.

**Resultado:** después de los arreglos, axe no encuentra ningún fallo en esas siete vistas, ni en claro ni en oscuro. La excepción son las tarjetas atenuadas a propósito cuando hay un departamento abierto.

**Leyenda:**
- ✅ = aplicado en esta ronda (V4.1, rama `claude/gracious-pascal-aryw2d`).
- 💡 = recomendación que queda para decidir; casi todas tocan decisiones de diseño del dueño.
- La gravedad va entre corchetes.

Aplicados: 37 · Recomendaciones: 13.

## 1. La oficina (vista general 3D)

1. ✅ [alta] **En el centro seguían las «neuronas».** El grafo de líneas y puntos, los destellos y las líneas punteadas a los escritorios ya no están. Ahí quedan solo el icono del Cerebro y Dimitri, centrados sobre la plataforma. Cuando un agente lee o escribe, se encienden las sinapsis del icono. (`src/brain.js`, `src/main.js`)
2. ✅ [media] **Una línea punteada bajaba del logo de Claude al centro.** Cruzaba la oficina en diagonal. Se quitó; el logo conserva su pulso. (`src/mcp.js`)
3. ✅ [alta] **Con poco espacio, las tarjetas de departamento se amontonaban.** Pasaba de 1024 a 1366 px con el panel abierto, en tablet y en teléfono: se tapaban entre sí y tapaban los escritorios. Ahora se pliegan a una línea (punto, nombre, número de agentes y ⚠). (`body.cardsCompact`)
4. ✅ [alta] **En un teléfono, la vista general mostraba un trozo de un solo departamento.** El zoom seguía solo la altura de la ventana. Además, la cámara se corría a un lado, como si el panel estuviera a la derecha, cuando en el teléfono está abajo. Ahora la oficina entera cabe sobre la hoja de tareas. (`overviewZoom()`)
5. ✅ [media] **En el teléfono, las tarjetas quedaban pegadas al borde izquierdo** y la mitad se escondía bajo la hoja de tareas. Ahora todas quedan encima.
6. ✅ [media] **En la vista general del teléfono, los nombres de los agentes medían unos 4 px.** Aparecen al acercar.
7. ✅ [alta] **En la oficina real, ENTREGAS REALES y ESPERAN TU OK no se movían tras cargar la página.** Solo las actualizaba la actividad inventada de la demo. Ahora siguen a la lista de tareas.
8. 💡 [media] **En escritorio, los nombres de los agentes miden unos 6,5 px en la vista general** (la píldora se escala al 62 %). Opciones: un mínimo de 9 px, o mostrar solo al jefe de cada departamento hasta acercar.
9. 💡 [baja] **El punto rojo que parpadea en cada tarjeta («en vivo») se lee como alerta o como grabación.** Opciones: verde o fijo, y reservar el rojo para los errores.
10. 💡 [baja] **Las tarjetas dicen dos veces lo mismo:** «ESPERAN TU OK» y la fila ámbar «⚠ EN ESPERA DE APROBACIÓN». Basta con una.
11. 💡 [baja] **Con los iconos de conectores plegados, sus cables siguen saliendo de la esquina superior izquierda**, de un punto que no se ve. Sin iconos a la vista, mejor sin cables.
12. 💡 [baja] **En modo oscuro, los suelos de los departamentos quedan muy saturados** (el de Correos, verde intenso). Se puede bajar la mezcla del color.

## 2. Barra superior y pie

13. ✅ [media] **La línea de licencia se montaba sobre el medidor de uso** entre 1100 y 1700 px, y sobre la hoja de tareas en el teléfono. Ahora va justo encima del medidor, y en el teléfono en el margen de abajo.
14. ✅ [baja] **La hora y un texto salían en el formato y el idioma del navegador:** «SE REINICIA 12:12 AM» y «LIMIT». Ahora dicen «12:12 a. m.» y «LÍMITE».
15. ✅ [media] **El ⚠ de la barra era un `<span>` sin nombre para los lectores de pantalla.** Ahora es un botón con nombre («2 borradores esperan tu visto bueno») y va al siguiente con cada clic.
16. ✅ [media] **No había forma de descubrir los atajos.** Ahora hay un botón de teclado en el dock y la hoja «?». Cada línea de la hoja ejecuta su acción, y el modo oscuro es un interruptor que se recuerda.
17. 💡 [baja] **Hay dos versiones a la vista:** el pie dice «1.1.1_» y el proyecto va por la 3.2.1 (`package.json`). Conviene mostrar solo una.
18. 💡 [baja] **En modo oscuro, el logo de Claude es un cuadrado blanco dentro del dock.** Falta una versión del logo para fondo oscuro.

## 3. Panel de tareas

19. ✅ [media] **La cabecera partía palabras:** «LIVE ·» quedaba en una línea y «CLAUDE» en otra, y lo mismo con «TODA LA / OFICINA». Ahora va en dos filas ordenadas: el título arriba, y debajo LIVE y lo que muestra la lista.
20. ✅ [media] **Los textos de ayuda de las cajas se partían y dejaban ver media segunda línea.** Pasaba en la caja de tareas, en el chat del agente y en Dimitri. Ahora ocupan una línea: «Nueva tarea para Marketing…» y «Escríbele a este agente…». Los ejemplos pasaron al texto que aparece al pasar el cursor.
21. ✅ [media] **Los menús SONNET y AUTO no tenían nombre**, solo el texto al pasar el cursor. Ahora se llaman «Modelo que la ejecuta» y «Esfuerzo: cuánto piensa».
22. ✅ [baja] **Las tareas listas se veían tachadas:** parecían canceladas y costaba leerlas. Ahora van sin tachar, en un tono más suave. La etiqueta LISTO ya dice que terminaron.
23. 💡 [baja] **«AUTO» no dice qué es** si no pasas el cursor por encima. Falta una etiqueta visible o un icono de «esfuerzo».
24. 💡 [baja] **En paneles estrechos, «VER RESULTADO →» se parte en dos líneas.** Iría mejor como un botón propio de la fila.

## 4. Chat de un departamento

25. ✅ [media] **Cada archivo decía «clic para verlo · clic para leer».** Ahora lo dice una sola vez.
26. ✅ [media] **Las tarjetas de archivo tenían de titular el nombre técnico** «2026-09-24 responder-a-panader-a-sol…md», que además perdía las tildes. Ahora el titular es el título de la tarea, y el nombre del archivo va debajo, en pequeño y con las tildes bien pasadas a letras (`panaderia`).
27. ✅ [media] **Las sugerencias flotaban sin separación sobre el último mensaje.** Ahora tienen su propia franja.
28. ✅ [media] **En el teléfono, «VISTA GENERAL» flotaba encima de los mensajes.** Ahora se oculta: la ✕ del chat vuelve a la oficina.
29. 💡 [baja] **El nombre del agente, en serif grande, se parte en dos líneas** («LÍDER / CORREOS»). Convendría 18 px o cortarlo con puntos suspensivos.

## 5. Ventanas: tablero, calendario, Cerebro, Estudio y Dimitri

30. ✅ [media] **El tablero decía «Agents Office» en vez del nombre del negocio y no tenía botón de cerrar.** Solo se cerraba con B o Esc. Ahora dice «PanaClaw» y tiene su ✕. Además queda por encima de «Vista general» y de la marca, que le tapaban las esquinas.
31. ✅ [media] **En el tablero, el nombre del agente se cortaba en «LID…»** porque el tiempo ocupaba todo («2 H 28 MIN EN PENDIENTES»). Ahora el tiempo es corto, «2 h 28 min»: la columna ya dice el estado.
32. ✅ [media] **En la oficina real, el tablero marcaba LISTAS 0** aunque el panel mostrara tres.
33. ✅ [baja] **«+N más» del tablero medía 12 px de alto.** Ahora mide 24 px, el mínimo para tocarlo con el dedo.
34. ✅ [alta] **En el teléfono, la ✕ del calendario se salía de la pantalla.** Solo se podía cerrar con Esc, y un teléfono no tiene esa tecla. Ahora la banda se reparte en dos filas y la ✕ siempre se ve.
35. ✅ [media] **En el teléfono, el «+» de cada día tapaba el número**, y el resumen «3 LISTAS» se cortaba. Ahora el día se toca entero y el resumen baja de línea.
36. ✅ [baja] **Decía «8 RUTINA EJECUCIONES».** Ahora dice «8 ejecuciones de rutinas».
37. ✅ [media] **El calendario atenuaba con opacidad los días de otro mes y las rutinas pasadas**, y su texto quedaba entre 2,3 y 3,4:1. Ahora se atenúan por color y el texto se lee.
38. 💡 [media] **En el teléfono, la cuadrícula de 7 columnas del calendario no deja leer las tareas** (se ve solo «✓…»). Bajo 600 px iría mejor una agenda: una lista por días.
39. 💡 [baja] **El número del día va abajo a la derecha;** en casi todos los calendarios va arriba. Moverlo haría el calendario más fácil de leer de un vistazo.
40. ✅ [media] **En el teléfono, el título del Cerebro pisaba la búsqueda** y el lector vacío ocupaba media pantalla. Ahora el título va arriba y el lector aparece solo con una nota abierta.
41. ✅ [baja] **En pantallas táctiles, el Cerebro decía «scroll acerca · arrastrar mueve».** Sin ratón ese texto ya no sale. El grafo se arrastra con un dedo y se pellizca con dos (auditoría UX 66).
42. 💡 [baja] **En el teléfono, los filtros del Cerebro ocupan la mitad de la pantalla.** Se pueden plegar bajo un botón «Filtros».
43. ✅ [baja] **El Estudio vacío decía «Genera tu primera imagen a la izquierda»**, y en el teléfono el compositor está arriba. Además repetía el motor junto al modelo: «Prueba (gratis) PRUEBA (GRATIS)». Las dos cosas están corregidas.
44. ✅ [media] **Con Dimitri abierto en modo oscuro, su nombre quedaba negro sobre negro** (1,06:1).

## 6. Accesibilidad en toda la oficina

45. ✅ [media] **En modo oscuro había textos bajo el contraste mínimo AA:**
    - LIVE: 2,7:1;
    - EN ESPERA: 3,1:1;
    - LISTO: 2,5:1;
    - los datos de las tarjetas del tablero, el texto vacío del Cerebro y «Mejorar» del Estudio.

    Ahora todos llegan a 4,5:1 o más.
46. ✅ [media] **El anillo de foco tenía tres colores:** azul en unos sitios y dos naranjas en otros. Ahora es uno solo, el token `--focus`, con su versión clara para el modo oscuro.
47. ✅ [media] **La página no tenía regiones (landmarks)**, así que un lector de pantalla no podía saltar entre partes. Ahora hay:
    - `main` para la oficina;
    - `banner` para la barra;
    - `complementary` para el panel de tareas;
    - regiones para el chat y la marca;
    - `contentinfo` para la licencia.
48. ✅ [baja] **Dimitri era un `<aside>` con role=dialog**, un rol que ese elemento no admite. Ahora es un `<div>`.
49. ✅ [media] **Salía un error de consola en cada fotograma** cuando un departamento no tenía conectores, que es lo normal en una oficina real con cero o un conector. Ya no.
50. ✅ [baja] **Con «reducir movimiento» activado, el icono del Cerebro seguía animándose.** Ahora descansa; los indicadores de carga siguen girando.

---

**Qué conviene decidir primero:** el 8 (el tamaño de los nombres en la vista general), el 38 (la agenda del calendario en el teléfono) y el 9 (el punto rojo). Son los tres que más cambian la lectura diaria. Todo lo demás de esta lista ya está aplicado y probado: `npm run check` pasa 58/58, con pruebas nuevas para el teléfono, las ventanas y las archivadas.
