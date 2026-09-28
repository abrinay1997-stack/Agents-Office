# Auditoría profunda — 25 sep 2026 (V4.3)

Una revisión de lógica, funcionamiento, UX, UI, rendimiento, conexiones e intuitividad. De ahí salieron los **30 errores de accesibilidad visual más críticos**, y los 30 están arreglados.

**Cómo se revisó:**
- **axe-core (WCAG 2.2 AA y buenas prácticas).**
  - 19 vistas:
    - la oficina, un departamento, el chat, el detalle de una tarea, los atajos y los conectores;
    - el calendario: mes, semana, agenda, crear y rutina;
    - el Cerebro, el tablero, Dimitri y la ficha del agente;
    - el Estudio: la vista principal, la lista de modelos, el visor y el historial.
  - Cada vista en claro y en oscuro, a 1440 px y a 390 px (teléfono, táctil).
- **Un recorrido con teclado.** Hasta 60 pulsaciones de Tab por vista, anotando las paradas sin anillo de foco o fuera de pantalla.
- **Una medición de tamaños.** Los objetivos de menos de 24 px y los textos de menos de 11 px.
- **Una prueba de reflujo a 320 px.**
- **Lectura del código:** las esperas y consultas periódicas (*polling*), las conexiones y los estados.

**Resultado:**

| | antes | después |
|---|---|---|
| Fallos críticos de axe (nombres, roles) | 8 | 0 |
| Controles anidados (un botón dentro de otro) | 226 nodos | 0 |
| Contraste bajo 4,5:1 | 244 nodos | 0 |
| Objetivos táctiles bajo 24 px | 233 nodos | 6 (tarjetas que la cámara escala en el teléfono, ver B) |
| Campos sin anillo de foco | 10 tipos | 0 |
| El Estudio a 320 px | cortado a la derecha | cabe |

Leyenda: ✅ = arreglado en esta ronda (rama `claude/gracious-pascal-aryw2d`). 💡 = recomendación que queda para decidir. La gravedad va entre corchetes.

## A. Los 30 errores de accesibilidad visual (todos ✅)

### Nombres y roles (lo que oye un lector de pantalla)
- ✅ **A1** [crítica] **Estudio: la lista de modelos era un `listbox` con un buscador dentro.** Un `listbox` solo puede contener opciones. Ahora el buscador queda fuera, y cada motor es un grupo con nombre («Higgsfield, listo» o «fal.ai, sin activar»). (`src/studio.js`)
- ✅ **A2** [crítica] **Calendario, crear: el desplegable del departamento no tenía nombre.** Ahora se llama «Departamento». (`src/calendar.js`)
- ✅ **A3** [crítica] **Calendario, editar una tarea o una rutina: el texto «Qué debe pasar» no tenía nombre.** La etiqueta visible no estaba unida al campo. (`src/calendar.js`)
- ✅ **A4** [menor] **El detalle de la tarea era un `<aside>` con rol `dialog`**, una combinación que HTML no permite. Ahora es un `<div>`. (`src/detail.js`)
- ✅ **A5** [grave] **Lista de tareas: las filas programadas eran un botón con CANCELAR y CALENDARIO dentro.** El lector no distinguía los tres. Ahora el título es el botón que abre el detalle, y los otros dos quedan aparte. (`src/tasks.js`)
- ✅ **A6** [grave] **Calendario: la tarjeta de rutina era un botón con el 👁 dentro.** Ahora el 👁 va al lado de la tarjeta. (`src/calendar.js`)
- ✅ **A30** [media] **Todos los 👁 se llamaban igual** («Ver solo esta rutina»). Ahora cada uno dice su rutina: «Ver solo los días de «Reporte semanal» en el calendario».

### Foco visible (quien usa el teclado sabe dónde está)
- ✅ **A7** [grave] **Buscar en el calendario y buscar una rutina** solo oscurecían el borde. Ahora muestran el anillo de foco.
- ✅ **A8** [grave] **Los campos de texto del calendario** (qué debe pasar, el título, el título corto): lo mismo.
- ✅ **A9** [grave] **El buscador del Cerebro:** lo mismo.
- ✅ **A10** [grave] **El campo del chat y el editor grande de tareas:** lo mismo.
- ✅ **A11** [grave] **Estudio: el prompt, el buscador de modelos y el de la galería no tenían borde propio.** Ahora el anillo rodea la caja que los contiene (`:focus-within`).
- ✅ **A12** [grave] **Los resultados de la búsqueda del calendario y el menú «⋯» del Estudio** solo cambiaban el fondo, un 12 % más gris. Ahora llevan anillo.
- ✅ **A13** [media] **El anillo tardaba en aparecer:** crecía de 0 a 2 px con la animación del botón. Ahora aparece de golpe.

### Contraste (texto que se lee)
- ✅ **A14** [grave] **Calendario: las rutinas pausadas** se atenuaban al 45 %, con el texto a 2,1:1. Ahora van con fondo suave, borde discontinuo y texto a más de 4,5:1.
- ✅ **A15** [grave] **Calendario: las ejecuciones saltadas:** el mismo arreglo (siguen tachadas).
- ✅ **A16** [grave] **Calendario oscuro: las ejecuciones pasadas** estaban a 4,2:1. Ahora a más de 7:1.
- ✅ **A17** [grave] **Rutinas pausadas en la lista, el tablero y el calendario** (al 55 %, 3,3:1). Ahora el borde es discontinuo y el texto se lee.
- ✅ **A18** [grave] **El Cerebro y Dimitri se atenuaban al 33 % con un departamento abierto, pero seguían siendo botones** (1,1:1). Se usan desde cualquier vista, así que ahora se quedan enteros. (`src/main.js`)
- ✅ **A19** [grave] **En oscuro, el filtro «Con error»** estaba en rojo sobre negro (2,5:1). Ahora es un rojo claro.
- ✅ **A20** [grave] **En oscuro, el estado del detalle** (PROGRAMADA, EN CURSO, ESPERA TU VISTO BUENO) bajaba a 2,7–2,9:1. Ahora pasa.
- ✅ **A21** [grave] **En oscuro, el «● listo» de los motores del Estudio** estaba a 3:1. Ahora pasa.
- ✅ **A22** [media] **Estudio: los números de las pestañas** («Tuyas 12») estaban al 70 %, a 3,3:1. Ahora al 100 %.

### Tamaño de los objetivos (dedo y ratón, WCAG 2.5.8)
- ✅ **A23** [grave] **Calendario: el «+» de cada día** medía 20 px. Ahora 24.
- ✅ **A24** [grave] **Calendario, mes: las líneas de evento medían 17 px y estaban a 2 px entre sí.** Ahora miden 20 px con 4 px entre una y otra: 24 px de centro a centro.
- ✅ **A25** [media] **Botones de texto pequeños** (las cifras del calendario, «La semana empieza…», «Suscribirme», «Plegar», «Nuevo», el resumen del formato y la tarea de origen en el Estudio): de 14–22 px a un mínimo de 24.
- ✅ **A26** [media] **Cerebro: los segmentos de fecha y la Papelera** medían 20–22 px. Ahora 24. La casilla de selección del Estudio pasa de 16 a 20 px, dentro de una zona de 28.
- ✅ **A27** [media] **Tarjetas de departamento plegadas** (22 px) y los títulos desplegables (`summary`, de 12 px): ahora a partir de 24.

### Legibilidad y reflujo
- ✅ **A28** [media] **13 textos de 8,5 a 9,5 px** (el número del día en el teléfono, el uso del plan, la licencia, chips y etiquetas): ahora 10,5 px como mínimo, el tamaño más pequeño que ya usaba la oficina.
- ✅ **A29** [grave] **Estudio a 320 px:** el pie (Generar, el costo y el mensaje) salía 30 px por la derecha y el botón quedaba cortado. Ahora cabe (WCAG 1.4.10).

## B. Lógica y funcionamiento
- Se probaron de punta a punta, contra un servidor aislado con un Claude simulado, y funcionan:
  - crear, mover, saltar y cancelar tareas y rutinas;
  - aprobar un borrador;
  - los trabajos del Estudio (cola, reintento, cancelación);
  - la búsqueda del calendario.
- 💡 [media] **Las tarjetas de los departamentos no abiertos bajan al 25 %, pero siguen siendo clicables.** Es a propósito: se ve que están detrás. Opción: al 60 %, o que un clic en una atenuada solo cambie de departamento.
- 💡 [baja] **En el teléfono, la cámara escala las tarjetas plegadas de departamento al ~85 %**, así que miden 22 px aunque su alto real ya sea de 26. Opción: no escalar las tarjetas plegadas.
- 💡 [baja] **El detalle de una tarea muestra la entrega del agente con sus propios títulos.** Un `####` salta niveles tras el `<h2>` del título (axe: *heading-order*). Opción: bajar los títulos de la entrega un nivel al mostrarla.
- 💡 [baja] **Los nombres de los agentes escalan con la cámara** y en la vista general miden unos 14 px de alto. Es el punto 8 de la auditoría visual, todavía por decidir. Con teclado se llega a ellos desde la ficha del departamento.

## C. Rendimiento
- Consultas periódicas del navegador:
  - la lista de tareas cada 6 s (se detiene con la pestaña oculta);
  - las tarjetas cada 1,5 s. ✅ Ahora también se detienen con la pestaña oculta;
  - Dimitri abierto, cada 3 s;
  - los trabajos del Estudio cada 15 s, con el Estudio cerrado y solo con la pestaña visible;
  - el calendario abierto, cada 30 s, y solo si algo cambió.
- En el servidor:
  - el reloj de las rutinas cada 20 s;
  - la cola cada 5 s;
  - el archivado automático cada 6 h.
- Todo es barato: respuestas de pocos KB, sin trabajo cuando no hay cambios.
- 💡 [baja] **La página es un solo HTML de 1,48 MB**, porque el grafo del Cerebro va incrustado. Carga una sola vez en local, así que no hace falta cambiarlo. Si algún día se sirve por internet, conviene separar `braingraph.js`.

## D. Conexiones
- **Higgsfield.**
  - Verificado el 25 sep contra sus clientes oficiales:
    - autenticación `Key id:secret`;
    - estado en `/requests/{id}/status`;
    - subidas firmadas.
  - Un 403 ahora dice «sin créditos en Higgsfield».
- Las keys viven solo en variables de entorno. Nada se escribe en disco.
- Los conectores MCP salen de `claude mcp list`.
  - Un servidor en `deny` se ve, pero los agentes no lo usan.
- 💡 [baja] Si la red bloquea `docs.higgsfield.ai`, la documentación no se puede consultar desde la sesión en la nube. No afecta a la oficina local.

## E. Intuitividad
- 💡 [media] **El 👁 de cada rutina se entiende solo al pasar el ratón.** Opción: la palabra «solo» junto al ojo en pantallas anchas.
- 💡 [baja] **La hoja «?» es la única forma de descubrir los atajos.** Opción: mostrar la tecla en el `title` de cada botón del dock. Ya pasa con casi todos; faltan algunos del Estudio.

## Cómo repetir la revisión
Con la oficina en marcha, se pasa axe-core por cada vista (claro/oscuro, 1440 y 390 px) y se recorre cada una con Tab. `npm run check` sigue siendo la prueba de siempre.
