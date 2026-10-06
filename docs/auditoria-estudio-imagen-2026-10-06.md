# Auditoría del Estudio: crear y generar imágenes — 6 oct 2026

Pedido: auditoría integral de UX, UI, usabilidad, intuitividad, funcionalidad, accesibilidad y navegación, con foco en todo lo que crea, edita y guarda imágenes (Básico, Avanzado, galería, visor, banco de presets, escenario 3D y lotes). Prioridad pedida: **claridad → simplicidad → velocidad → control → consistencia → accesibilidad**. La meta no es añadir funciones, sino que un principiante llegue a su primera imagen sin dudar y un profesional no pierda tiempo.

**Cómo se midió.** La rama `main` del 2 oct 2026 (V5.1: Básico y Avanzado).
- **Navegador:** Playwright y Chromium, en una oficina temporal con un **Google simulado** (las imágenes salen de verdad por el motor, sin key real ni gasto) y el motor Prueba.
- **Anchos y temas:** 1440 px en claro y en oscuro, y 390 px en táctil.
- **Medidas:** axe-core en 7 vistas, el orden de tabulación, el conteo de controles visibles, los tamaños de letra y de objetivo, y los radios.
- **Código:** se leyeron `src/studio.js`, `src/studio-banco*.js`, `src/escena3d*.js` y sus estilos.
- **Para repetirlo:** `node scripts/estudio-imagen-recorrido.mjs`. Las capturas van a `data/capturas/estudio-imagen/`, que no viaja por GitHub.

**Estado al 6 oct 2026:** hechas la **Fase 1** (IMG-01, 02, 03, 04, 05, 06, 19, 40, 41 ✅; IMG-39 🟡 en lo mínimo) la **Fase 2** (IMG-07, 08, 09, 10, 23, 48, 49, 50, 52 ✅) la **Fase 3** (IMG-11, 13, 15, 16, 17, 18, 20, 22 ✅; IMG-21 y 24 🟡) y la **Fase 4** (IMG-25 a 30 ✅). `node scripts/estudio-imagen-recorrido.mjs` comprueba cada uno en el navegador. Lo demás, ⏳ pendiente.

**Estado de cada punto:** ✅ hecho · 🟡 en parte · ⏳ pendiente. Al arreglar uno, se marca ✅ en este archivo en el mismo commit (regla 5 de CLAUDE.md).

---

## 1. Resumen ejecutivo

El Estudio ya pasó cuatro auditorías y se nota. axe-core no encuentra **ninguna violación** en las 7 vistas medidas. El contraste, el foco, el teclado del visor, deshacer la papelera, el aviso de pedido repetido y la estimación de tiempo están bien resueltos. Lo que falla ahora no es el detalle, sino **la arquitectura**:

1. **Las acciones sobre un resultado reescriben el compositor sin avisar.** «Variar» gasta al instante, sin la confirmación de costo que sí tiene GENERAR. Además borra lo que estabas escribiendo, baja la cantidad a 1 y deja la imagen pegada como referencia: **el pedido siguiente sale contaminado** (lo comprobó el recorrido).
2. **Avanzado tiene dos sistemas de referencias a la vez**: el del banco («Tu foto», «Referencias») y el paso 4. Al elegir un preset, el paso 4 se esconde con tus imágenes dentro y el plan no las usa. Además, nada más entrar, la pantalla se contradice: la puerta pulsada dice «Mejorar mi foto», el texto dice «Ahora: Desde cero» y aparece un error en rojo antes de tocar nada.
3. **Básico no es básico.** Tiene 38 controles y mide 1.195 px de alto (1,6 pantallas a 1440×900):
   - cuatro tipos de medio y «Varias ideas, una por línea»;
   - un selector de idioma y 16 formatos (1:8, 8:1…);
   - la ficha larga del modelo y «Motores y cómo activarlos».
   Lo único imprescindible (idea → generar) compite con todo lo demás.
4. **El resultado no es protagonista.** Lo generado cae como una tarjeta de 235 px en una galería de 1.000 px, sin resaltar. Si el pedido es de 2 o más, esa tarjeta **no tiene ninguna acción** salvo «Ver por separado» y «Descargar».
5. **El sistema no habla con una sola voz.**
   - Los mensajes van en una única línea al pie, y uno pisa al otro: con una ficha fallida en pantalla, el pie decía «Listo: 1 archivo(s) nuevos».
   - Los errores del proveedor llegan en inglés crudo («400 Request contains an invalid argument»).
   - El primer uso promete «Prueba (gratis)», pero el modelo elegido cobra.
6. **La misma imagen tiene cuatro juegos de acciones distintos**: la fila de 6 iconos, el menú «⋯» de 8 a 10 opciones, los 20 controles del visor y las 2 acciones de la ficha agrupada. Las integraciones de la oficina (Dimitri, departamento, calendario) se mezclan con las de imagen.
7. **El sistema visual se ha ido desdibujando**:
   - 13 tamaños de letra entre 10,5 y 24 px, y Arial que se cuela;
   - 7 radios de borde en los botones;
   - el borde discontinuo significa a la vez «deshabilitado» y «suelta aquí».

**Recomendación central.** Reorganizar el Estudio en torno a **un compositor que empieza por la idea**. El modelo, el formato y la cantidad pasan a chips con su costo en el botón. Encima va **un único bloque «Material»** con roles, que comparten Básico y Avanzado, y **un único juego de acciones** por resultado, en tres densidades. Avanzado no es otro formulario: son **grupos plegables** (Material · Receta · Composición · Técnico) sobre el mismo compositor. Las acciones de la galería **nunca** tocan el borrador sin deshacer, y **nada gasta sin pasar por la misma puerta de costo**.

| Gravedad | Cuántos |
|---|---|
| 🔴 Crítico | 4 |
| 🟠 Alto | 11 |
| 🟡 Medio | 32 |
| 🟢 Bajo | 6 |
| **Total** | **53** |

**Lo que funciona y hay que conservar:**
- **Seguridad y control:**
  - Papelera con DESHACER y 30 días.
  - Aviso al pedir dos veces lo mismo y confirmación desde US$0,50.
  - Topes del día y del mes en la cabecera.
- **Estados de los trabajos:**
  - Tiempo típico por modelo con barra, y «tarda más de lo normal».
  - Ficha fallida con «Reintentar».
  - Historial de trabajos con el motivo.
- **Visor:** zoom con rueda, pellizco y teclado, «3 de 8», pantalla completa y versiones enlazadas.
- **Básico no descarga el banco** (195 KB menos) y el modo elegido se recuerda.
- **Accesibilidad:** el escenario 3D se maneja con el teclado y resume la toma en texto («Frontal · algo elevada · a 6,5 m con 50 mm…»), y axe da limpio en todas las vistas.
- **Lotes:** el estado vacío explica qué pasa antes de gastar.

---

## 2. Principales problemas encontrados

| # | Problema | Gravedad |
|---|---|---|
| IMG-01 | «Variar» gasta sin confirmar, pisa el borrador y contamina el pedido siguiente | 🔴 |
| IMG-39 | Avanzado: dos sistemas de referencias; al elegir un preset, tus referencias se esconden y no se usan | 🔴 |
| IMG-40 | Avanzado: entrada contradictoria (puerta «Mejorar mi foto», «Ahora: Desde cero», error rojo sin haber hecho nada) | 🔴 |
| IMG-02 | Repetir, Animar y Usar de referencia reemplazan el compositor (tipo, modelo, material) sin deshacer | 🔴 |
| IMG-32 | Básico: 38 controles y 1,6 pantallas de alto | 🟠 |
| IMG-07 | El resultado no se resalta ni se acerca: cae en la galería como uno más | 🟠 |
| IMG-08 | La ficha de un pedido de N imágenes no tiene Editar, Variar, Referencia, Papelera ni «⋯» | 🟠 |
| IMG-03 | Una sola línea de avisos al pie: los mensajes se pisan y llegan a contradecir lo que se ve | 🟠 |
| IMG-04 | Errores del proveedor en inglés crudo y con código HTTP | 🟠 |
| IMG-05 | «Empieza aquí» promete gratis y el modelo elegido cobra; el costo va en gris bajo el botón | 🟠 |

---

## 3. Auditoría UX

### IMG-01 · 🔴 crítico · ✅ — «Variar» gasta sin confirmar, pisa el borrador y contamina el pedido siguiente
- **Dónde:** `src/studio.js:1153` (`vary`), que llama a `reuse(it, true)`, a `addMedia('reference', …)`, pone `qty = 1` y llama a `generate()` directamente. Se salta la confirmación de `src/studio.js:1621` (≥ US$0,50) y la firma de pedido repetido (1622-1624).
- **Evidencia:** en el recorrido, con «TEXTO A MEDIO ESCRIBIR» en la idea, pulsar ⋯ → Variar dejó en el campo el prompt de la imagen; el texto propio se perdió sin deshacer. La cantidad pasó de 2 a 1. La imagen quedó como «Referencias · 1 de 14», y el pedido siguiente, sin relación («FALLA esta a propósito»), salió **con esa referencia** (captura `13-fallo`).
- **Impacto:**
  - gasto con un clic, sin ver el costo;
  - pérdida del trabajo en curso;
  - resultados mezclados que el usuario no pidió, y que no entenderá.
- **Solución:** «Variar» es un pedido **autónomo**, con el prompt, el modelo y los ajustes de esa imagen y la imagen como referencia.
  - Pasa por la misma puerta de costo que GENERAR, y el menú muestra el precio: «Variar · US$0,07».
  - No toca el compositor.
  - Si el usuario quiere cambiar algo, «Variar con cambios…» abre el compositor tras guardar el borrador actual (con DESHACER).
- **Hecho (6 oct, Fase 1):** «Variar» es un pedido propio (`src/studio-borrador.js → pedidoVariar`, con test): el prompt, el modelo y los ajustes de esa imagen, ella como única referencia, 1 archivo, por la misma puerta de costo que GENERAR (`okCosto`). El menú dice su precio. El compositor no se toca.
- **Prioridad:** Fase 1.

### IMG-02 · 🔴 crítico · ✅ — Las acciones de la galería reescriben el compositor sin deshacer
- **Dónde:** `reuse` (1162), `animate` (1133), `useAsRef` (1148). `animate` cambia el tipo a Video y reemplaza todo el material. `useAsRef` puede **cambiar el modelo** si el actual no admite referencias.
- **Evidencia:** en el código, `media = { start: [it.file], end: [], reference: [], video: [] }` en `animate`. `reuse` escribe `$('.st-prompt').value = it.prompt`. Ninguna guarda el estado anterior.
- **Impacto:** el usuario pierde lo que componía. Además, el modelo cambia solo y el precio cambia con él, sin una decisión consciente (WCAG 3.2.2, cambio de contexto sin pedirlo).
- **Solución:** un **borrador con historia**: antes de cualquier acción que cargue el compositor, se guarda el estado y sale un aviso «Cargado en el compositor · DESHACER». Si la acción tiene que cambiar el modelo, lo dice en el aviso con el precio nuevo: «Cambié a Nano Banana 2 (US$0,07) porque el anterior no acepta referencias».
- **Hecho (6 oct, Fase 1):** Repetir, Animar, Usar de referencia y «Otro modelo…» pasan por `cargar()`: lo que había se guarda (`BR.pila`) y un aviso ofrece DESHACER. Si «Usar de referencia» cambia de modelo, lo dice con el precio nuevo.
- **Prioridad:** Fase 1.

### IMG-03 · 🟠 alto · ✅ — Una sola línea de avisos al pie, y los mensajes se pisan
- **Dónde:** `say()` en `src/studio.js:174`, que escribe en `.st-msg`; `watch()` (`src/studio.js:620`).
- **Evidencia:** con la ficha «No se pudo» en pantalla, el pie decía «Listo: 1 archivo(s) nuevos en la galería.» (captura `13-fallo`). El mensaje de un trabajo terminado pisa el del fallo y al revés.
- **Impacto:** el sistema se contradice. Con el lector de pantalla, solo se anuncia el último mensaje.
- **Solución:**
  - Cada trabajo informa **en su propia ficha**.
  - Los avisos entre trabajos van en **toasts apilables** (máximo 3, cada uno con su acción: VER o REINTENTAR).
  - El pie queda solo para la validación del formulario.
  - Escribir «archivo nuevo / archivos nuevos» según el número, nunca «archivo(s)».
- **Hecho (6 oct, Fase 1):** `src/studio-avisos.js` (con test) dice lo nuevo con su plural y no esconde una ficha fallida a la vista. Además había una carrera: si la recarga de 20 s llegaba antes que el sondeo, el final no se decía nunca y el pie seguía en «En marcha». Ahora cada trabajo visto en marcha se anuncia una vez, venga de donde venga (`anunciar()`).
- **Prioridad:** Fase 1.

### IMG-04 · 🟠 alto · ✅ — Errores del proveedor en inglés crudo
- **Dónde:** la ficha fallida (`jobTile`) y el Historial muestran `j.error` tal cual.
- **Evidencia:** «Nano Banana 2: 400 Request contains an invalid argument.» (capturas `13-fallo`, `14-historial`, `26-movil-galeria`).
- **Impacto:** el usuario no sabe qué hacer. «Reintentar» repite el mismo pedido y falla igual.
- **Solución:**
  - Traducir el error por clase en `media/motores.mjs`, como ya hace `minimax.mjs`. Ejemplo para un 400: «Google no aceptó el pedido. Suele ser el formato o el tamaño con este modelo».
  - Proponer acciones: «Reintentar con 1:1», «Reintentar con otro modelo ▾».
  - Dejar el original en «Detalles técnicos», plegado.
- **Hecho (6 oct, Fase 1):** `media/errores.mjs` (con test): clase y frase en español; el original queda en `errorRaw` y la ficha lo enseña plegado en «Detalles técnicos». La ficha ofrece «Otro modelo…» (salvo key, saldo o cancelado). Un error que ya llega en español (MiniMax, la oficina) pasa tal cual.
- **Prioridad:** Fase 1.

### IMG-05 · 🟠 alto · ✅ — El primer uso promete gratis y cobra
- **Dónde:** el estado vacío («Empieza aquí», `src/studio.js:491`), `estimate()` y el pie.
- **Evidencia:** el paso 2 de «Empieza aquí» dice «Con **Prueba (gratis)** ves todo el recorrido sin gastar». Sin embargo, el modelo elegido por defecto es Nano Banana 2 (~US$0,07 por imagen). El costo solo se ve en la tercera línea gris, de 12 px, bajo GENERAR (capturas `02`, `06`).
- **Impacto:** el principiante gasta sin saberlo. La confianza se rompe al ver el gasto en la cabecera.
- **Solución:**
  - **El costo va dentro del botón**: «Generar 2 imágenes · US$0,13», o «Generar · gratis».
  - El estado vacío nombra el modelo activo y su precio, con un enlace «Probar gratis primero», que cambia a Prueba.
- **Hecho (6 oct, Fase 1):** el precio va dentro de GENERAR («GENERAR 2 IMÁGENES · US$0.13», o «· gratis»), que salta de línea dentro de su columna. «Empieza aquí» nombra el modelo elegido y su precio, con «Probar gratis primero».
- **Prioridad:** Fase 1.

### IMG-06 · 🟠 alto · ✅ — Esc dentro de la idea cierra todo el Estudio
- **Dónde:** el manejador de teclado, `src/studio.js:1753-1758`: si no hay lista, banco, selección ni búsqueda que vaciar, llama a `close()`, también con el foco en la `textarea`.
- **Evidencia:** en el recorrido, Esc con el foco en el prompt cerró el Estudio (`escEnPromptCierra: true`). El texto sobrevive en el DOM, pero la vista desaparece.
- **Impacto:** un gesto reflejo (Esc para cerrar un autocompletado del navegador o del IME) saca al usuario de su tarea.
- **Solución:** con el foco en un campo de texto, Esc solo quita el foco (`blur`). Un segundo Esc, fuera del campo, cierra el Estudio.
- **Hecho (6 oct, Fase 1):** en un campo, Esc solo quita el foco; un segundo Esc cierra el Estudio.
- **Prioridad:** Fase 1.

### IMG-07 · 🟠 alto · ✅ — El resultado no es protagonista
- **Dónde:** `generate()` → `watch()` → `load()`; `renderGrid()`.
- **Evidencia:** a 1440 px, las imágenes nuevas aparecen como una tarjeta de 235 px en la esquina superior izquierda de un lienzo de 1.000 px, sin resaltar ni desplazarse a ellas. El mensaje de «listo» va al pie del compositor, lejos (captura `07-resultado`).
- **Impacto:** el momento más importante (¿salió bien?) se vive en miniatura. Para comparar o editar hay que abrir el visor.
- **Solución:**
  - Al terminar, la galería se desplaza a lo nuevo, que queda marcado con «Nuevo» y un borde que dura 3 s.
  - En un pedido de N imágenes, una **tira de resultados** grande arriba de la galería, con las N juntas y sus acciones, hasta el siguiente pedido.
  - En el teléfono ya se cambia a Galería; falta desplazarse hasta lo nuevo.
- **Hecho (6 oct, Fase 2):** lo recién hecho sale con la marca «NUEVO» y un borde durante unos segundos, y la galería lo trae a la vista sin mover el foco (`marcarNuevos`). **En lugar de la tira de resultados:** lo nuevo ya llega el primero, arriba de «Hoy», así que una tira repetía lo mismo.
- **Prioridad:** Fase 2.

### IMG-08 · 🟠 alto · ✅ — La ficha de un pedido de N imágenes no tiene acciones
- **Dónde:** `groupCard()` (`src/studio.js:468`).
- **Evidencia:** la ficha «2 imágenes de un pedido» solo ofrece «Ver por separado» y «Descargar las 2» (`grupoHTML`, captura `07-resultado`). No hay Editar, Variar, Usar de referencia, Papelera ni «⋯».
- **Impacto:** para editar una de las dos hace falta un paso de más, que además cambia toda la galería a fichas sueltas.
- **Solución:** cada miniatura de la ficha agrupada lleva su propio «⋯» y, al pasar el cursor, las 3 acciones primarias. La agrupación pasa a ser un **encabezado de pedido** («Taza de café · 2 imágenes · Nano Banana 2») sobre tarjetas normales.
- **Hecho (6 oct, Fase 2):** la ficha de un pedido es un encabezado (prompt, «N imágenes de un pedido», Ver por separado, Descargar las N) y, debajo, cada imagen como tarjeta con Editar, Variar, Descargar y «⋯». Cada una se arrastra sola.
- **Prioridad:** Fase 2.

### IMG-09 · 🟡 medio · ✅ — Cuatro juegos de acciones para la misma imagen
- **Dónde:** la fila de iconos de `card()` (Animar, Usar de referencia, Editar, Descargar, Papelera, ⋯), el menú `menu` (Favorita, Variar, Repetir, Carpeta, Calendario, Dimitri, Departamento, Preset), el visor (`visorAcciones`: 20 controles) y `groupCard` (2).
- **Evidencia:**
  - «Repetir» está en el menú de la tarjeta y en el visor, pero no en la fila.
  - «Editar» está en la fila y en el visor, pero no en el menú.
  - «Favorita» se llama «Marcar favorita» en el menú y «Favorita» en el visor.
- **Impacto:** no hay un modelo mental estable de «qué puedo hacer con esta imagen».
- **Solución:** **una sola lista de acciones** (un módulo puro con su test), pintada en tres densidades:

  | Grupo | Acciones | Ficha | Visor |
  |---|---|---|---|
  | Primarias | Editar · Variar · Descargar | iconos con texto corto | botones |
  | Crear a partir de esta | Usar de referencia · Animar · Repetir | en «⋯» | fila secundaria |
  | Organizar | Favorita · Carpeta · Papelera | estrella sobre la imagen; el resto en «⋯» | fila secundaria |
  | Enviar a… | Calendario · Dimitri · Departamento | submenú en «⋯» | botón «Enviar a…» |
- **Hecho (6 oct, Fase 2):** `src/studio-acciones.js` (con test) es la única lista. La tarjeta enseña las primarias (Editar, Variar, Descargar); «⋯» lleva el resto en tres grupos y la papelera al final; el visor, las mismas en filas con su nombre. **Cambio:** la estrella no va sobre la imagen (la regla del dueño: nada encima de una imagen); sigue en «⋯ → Organizar».
- **Prioridad:** Fase 2.

### IMG-10 · 🟡 medio · ✅ — «Nuevo» vacía la idea y las referencias sin deshacer
- **Dónde:** `src/studio.js:1577`.
- **Evidencia:** el botón, en negrita junto al contador, borra el prompt y todo el material.
- **Impacto:** se pierde trabajo con un clic. Además, «Nuevo» puede leerse como «nueva imagen».
- **Solución:** renombrarlo «Vaciar» y añadir DESHACER 8 s (el toast ya existe).
- **Hecho (6 oct, Fase 2):** «Vaciar», con DESHACER (el mismo borrador de la Fase 1).
- **Prioridad:** Fase 2.

### IMG-11 · 🟡 medio · ✅ — La confirmación de costo usa `confirm()` del navegador
- **Dónde:** `src/studio.js:1621`.
- **Evidencia:** es un diálogo nativo, que bloquea la página y no lleva el estilo de la oficina. En algunos sistemas sale en el idioma del navegador («OK / Cancel»).
- **Impacto:** rompe la experiencia y no se puede probar bien.
- **Solución:** confirmar en el propio botón, como ya se hace con el pedido repetido: el primer clic lo cambia a «Confirmar · US$0,64» durante 6 s.
- **Hecho (6 oct, Fase 3):** `src/studio-confirmar.js` (con test). Desde US$0,50 el primer clic arma GENERAR («Confirmar · US$0.80», unos 6 s) y el segundo gasta; Variar lo pide con «VARIAR» en el aviso; los presets pasan por la misma puerta. Ya no hay `confirm()` para gastar.
- **Prioridad:** Fase 3.

### IMG-12 · 🟡 medio · ⏳ — Las acciones del visor sacan del visor
- **Dónde:** el visor: `a === 'vary' | 'again' | 'anim' | 'ref'` → `closeLight()`.
- **Evidencia:** Variar, Repetir, Animar y Usar de referencia cierran el visor y llevan al compositor.
- **Impacto:** cambio de contexto: para ver otra vez la imagen hay que volver a buscarla.
- **Solución:** después de la acción, un aviso con «Volver a la imagen». Con IMG-01, Variar ya no necesita salir del visor.
- **Prioridad:** Fase 7.

### IMG-13 · 🟡 medio · ✅ — Los contadores no cuadran
- **Dónde:** la cabecera (`budgetHTML`), `countLine` y el encabezado del día.
- **Evidencia:** a la vez se ven «Hoy 3 de 40» (cabecera), «3 archivos» (contador) y «Hoy 4» (el encabezado del día cuenta la ficha fallida). El pie dice «2 archivo(s)».
- **Impacto:** el usuario duda de qué cuenta cada número.
- **Solución:** el día cuenta archivos, y los fallidos van aparte («Hoy 3 · 1 falló»). Plurales correctos.
- **Hecho (6 oct, Fase 3):** el día dice «Hoy 3 archivos · 1 en curso · 1 falló»: la ficha de un trabajo ya no cuenta como archivo.
- **Prioridad:** Fase 3.

### IMG-14 · 🟡 medio · ⏳ — No hay manera de comparar
- **Dónde:** el visor.
- **Evidencia:** el antes y después solo existe en Lotes (`lt-ab`, `src/studio-lotes.js:472`). Una versión hecha con «Editar» se abre por separado, y no hay comparación lado a lado de un pedido.
- **Impacto:** comparar es el corazón del flujo profesional (editar → ¿mejoró?).
- **Solución:**
  - Reutilizar `lt-ab` en el visor cuando la imagen tiene `versionOf` o `versions`.
  - Con 2 a 4 seleccionadas, añadir «Comparar» en la barra de selección.
- **Prioridad:** Fase 6.

---

## 4. Auditoría UI

### Sistema de diseño: ¿existe?

En parte. Hay tokens de color (`--ink`, `--cream`, `--grey`, `--hairline`, `--focus`) con tema oscuro, dos familias tipográficas (Inter para la interfaz, Instrument Serif para los títulos) y un patrón de foco consistente. **No hay** escala tipográfica, escala de espacio, tokens de radio ni componentes compartidos: cada archivo (`shell.html`, `estudio-banco.css`, `estudio-lotes.css`) redefine sus propios botones segmentados, chips y botones de subida.

**Componentes que deberían ser reutilizables (CSS y una función de pintado):**

| Componente | Hoy, en el Estudio | Debe ser |
|---|---|---|
| Segmentado | `.st-nivel`, `.st-modeseg`, `.bk-seg` (Suave/Normal/Fuerte), `.st-tabs`, `.st-ptabs` | `.seg` con `aria-pressed`, un tamaño y dos densidades |
| Chip / insignia | `.st-tags i`, «receta», «beta», `.st-badge`, chips de carpeta | `.chip` (neutro, informativo, aviso) |
| Botón de subir | `.st-add` (88×56 con icono) en Básico; botones de texto «Subir / De la galería» en el banco | `.drop-add` con icono, texto y soltar |
| Tarjeta de opción | `.st-mo` (modelo), `.bk-card` (preset), `.st-ar` (formato) | `.opt-card` con título, meta, precio y estado |
| Aviso | `.st-msg`, `.st-toast`, `.bk-toast`, `.st-note`, `.st-keyhelp` | `toast()` único con cola y acción |
| Panel lateral u hoja | `.st-bank`, `.st-lpanel`, `.st-hist` | `.sheet` (lateral en escritorio, inferior en el teléfono) |

### IMG-15 · 🟡 medio · ✅ — Escala tipográfica sin sistema
- **Evidencia:** en el Estudio a 1440 px (medidas `basico-1440`) hay 13 tamaños: 10,5 · 11 · 11,5 · 12 · 12,5 · 13 · 13,5 · 14 · 15 · 16 · 19 · 22 · 24 px. Aparece la familia **Arial**: algún control no hereda `var(--ui)`.
- **Impacto:** jerarquía borrosa: 12 y 12,5, o 11 y 11,5, no se distinguen, pero sí suman ruido.
- **Solución:**
  - Cinco pasos como tokens: `--fs-xs: 11.5px` · `--fs-s: 12.5px` · `--fs-m: 14px` · `--fs-l: 16px` · `--fs-xl: 22px` (serif).
  - `button, input, select, textarea { font: inherit }` en `#studioOv`.
- **Hecho (6 oct, Fase 3):** las reglas del Estudio usan 11,5 · 12,5 · 14 · 16 · 22 (tokens `--fs-*` en `src/css/componentes.css`); los controles heredan la letra de la interfaz (sin Arial). El recorrido mide 5 tamaños.
- **Prioridad:** Fase 3.

### IMG-16 · 🟡 medio · ✅ — Siete radios de borde en los botones
- **Evidencia:** 0 · 9 · 10 · 11 · 12 · 99 px y 50 % (medidas `avanzado-1440`).
- **Solución:** tres tokens: `--r-s: 8px` (controles), `--r-m: 12px` (tarjetas y paneles) y `--r-pill: 999px` (segmentados y chips).
- **Hecho (6 oct, Fase 3):** radios de 8, 12 y pastilla (`--r-*`); las formas dibujadas (los cuadritos de proporción) conservan el suyo.
- **Prioridad:** Fase 3.

### IMG-17 · 🟡 medio · ✅ — El borde discontinuo significa dos cosas opuestas
- **Dónde:** `src/css/estados.css:7` (deshabilitado = `1px dashed`); «+ Nueva carpeta» y las ranuras de referencias también son discontinuas.
- **Evidencia:** el «−» de Cantidad en 1 y el «‹» del visor en la primera imagen parecen casillas para soltar o elementos pendientes (capturas `02`, `10`).
- **Impacto:** el usuario intenta pulsarlos o soltar algo encima.
- **Solución:** discontinuo **solo** para las zonas de soltar. Un control deshabilitado lleva el borde sólido atenuado, el texto a 4,5:1 y un `title` o texto que diga por qué.
- **Hecho (6 oct, Fase 3):** en el Estudio, un botón deshabilitado lleva borde sólido y texto gris; el discontinuo queda para «suelta aquí». La regla global de `estados.css` no se tocó (otras vistas).
- **Prioridad:** Fase 3.

### IMG-18 · 🟡 medio · ✅ — Iconos ambiguos en la ficha
- **Evidencia:** la claqueta significa tres cosas: el Estudio (logo y dock), el tipo «Video» y la acción «Animar» (captura `08-tarjeta-hover`). El icono de «Usar de referencia» (imagen con +) no se reconoce sin el `title`.
- **Impacto:** el usuario tiene que pasar el cursor por cada icono para saber qué hace; en el teléfono no hay cursor.
- **Solución:**
  - Animar con un icono de movimiento (play con estela).
  - En la ficha, solo 3 iconos primarios (Editar, Variar, Descargar) y lo demás en «⋯» (IMG-09).
  - Un tooltip propio en foco y al mantener pulsado (`data-tip`, como en el dock).
- **Hecho (6 oct, Fases 2 y 3):** Animar tiene su icono propio (ya no la claqueta); la tarjeta enseña Editar y Variar con su nombre (Fase 2). El tooltip en foco y al mantener pulsado va con IMG-27.
- **Prioridad:** Fase 3.

### IMG-19 · 🟡 medio · ✅ — «Más ajustes» se pinta roto
- **Dónde:** `.st-more` dentro de `.st-step` (`src/shell.html`).
- **Evidencia:**
  - Abierto, el resumen «▼ Más ajustes · tamaño» queda centrado y el selector «Tamaño» a su lado, en la misma fila (captura `04-formato-y-ajustes`).
  - Plegado, el selector mide **20 px** de ancho (`select "1K2K4K" 20×35`).
- **Impacto:** se ve como un error de maquetación, y el tamaño (1K, 2K o 4K), que cambia la calidad y el precio, queda escondido y mal dibujado.
- **Solución:** `details.st-more { display:block }` con el contenido debajo y `select { min-width: 96px }`. Con Nano Banana 2, el Tamaño debería ir con el Formato (cambia el precio), no plegado.
- **Hecho (6 oct, Fase 1):** la causa era un choque de nombres: el pie «Cargar más» de la galería también se llamaba `.st-more` y `galeria.css` le daba `display:flex` centrado a «Más ajustes» (y relleno al «⋯» de las tarjetas). El pie pasa a `.st-loadmore`; «Más ajustes» es un bloque y sus selectores miden 96 px o más. Queda para la Fase 5 sacar el Tamaño de lo plegado.
- **Prioridad:** Fase 1 (quick win).

### IMG-20 · 🟢 bajo · ✅ — El nombre del modelo se parte
- **Evidencia:** en la tarjeta de modelo se lee «Nano Banana / 2», porque «GOOGLE (GEMINI API)» en versalitas comparte la fila (capturas `02`, `24`).
- **Solución:** el motor debajo del nombre, en la línea de meta. El nombre siempre en una línea.
- **Hecho (6 oct, Fase 3):** el motor va debajo del nombre, que queda en una línea.
- **Prioridad:** Fase 3.

### IMG-21 · 🟢 bajo · 🟡 en parte — Formato: etiqueta pegada y formatos sin nombre
- **Evidencia:** «Formato» (11,5 px) toca la cuadrícula sin aire. Cinco de los 16 formatos no tienen nombre (5:4, 1:4, 4:1, 1:8, 8:1).
- **Solución:** 6 px de separación; los formatos raros, solo bajo «Más formatos» y con un uso («Banner», «Tira»).
- **Hecho en la Fase 3 (6 oct):** la etiqueta «Formato» con aire. **Los formatos sin nombre** se resuelven en la Fase 5 (IMG-33: 4 y «Más formatos»).
- **Prioridad:** Fase 3.

### IMG-22 · 🟡 medio · ✅ — El pie no tiene jerarquía
- **Evidencia:** debajo de GENERAR hay tres líneas grises de 12 px que compiten: el resumen («1:1 Cuadrado cambiar»), el costo y el estado.
- **Impacto:** el dato que más importa antes de gastar es el menos visible.
- **Solución:** el costo dentro del botón (IMG-05); el resumen como chips sobre el botón («1:1 ▾ · ×2 ▾ · Nano Banana 2 ▾»); el estado en toasts (IMG-03).
- **Hecho (6 oct, Fases 1 y 3):** el costo va en el botón (IMG-05); el resumen («1:1 Cuadrado cambiar») sube encima de la cantidad y GENERAR; debajo quedan solo el costo del día y los avisos.
- **Prioridad:** Fase 3.

### IMG-23 · 🟡 medio · ✅ — Demasiado cromo antes de la primera imagen
- **Evidencia:** a 1440×900, las imágenes empiezan a 365 px (el 40 % de la altura). Por encima van:
  - la barra de la oficina (52 px);
  - la cabecera del Estudio con su subtítulo (62);
  - las pestañas (40);
  - dos filas de filtros y botones (≈ 95: 8 filtros, buscar, Subir, Seleccionar, Historial, Papelera, Voces);
  - la fila de carpetas (≈ 50) y el contador.
- **Impacto:** se ven menos resultados y la pantalla se siente pesada.
- **Solución:**
  - La cabecera del Estudio y sus pestañas, en una sola fila.
  - Los 8 filtros en un desplegable «Mostrar: Todo ▾».
  - Historial, Papelera y Voces en un «⋯».
  - Las carpetas en un desplegable junto a «Mostrar», o una barra lateral plegable.
  - Meta: imágenes desde unos 200 px.
- **Hecho (6 oct, Fase 2):** las pestañas van en la fila de la cabecera; los 8 filtros son un «Mostrar ▾» con sus números; las carpetas comparten la fila y se desplazan; Historial, Papelera y Motores van en un «⋯»; la línea «N archivos» solo sale cuando dice más que el encabezado del día. A 1440×900 la galería empieza a 213 px (antes, 365).
- **Prioridad:** Fase 2.

### IMG-24 · 🟡 medio · 🟡 en parte — Componentes duplicados con estilos distintos
- **Evidencia:** la tabla de arriba. Ejemplo: subir una referencia es una tarjeta de 88×56 con icono en Básico y un botón de texto plano en el banco de Avanzado (capturas `02` y `15`).
- **Solución:** los componentes de la tabla, en `src/css/componentes.css` (que vaya antes en el orden alfabético que los que lo usan; ver la regla de `build.mjs`).
- **Hecho en la Fase 3 (6 oct):** `src/css/componentes.css` con los tokens y un segmentado común (Básico · Avanzado, Una idea · Varias, Suave · Normal · Fuerte). **Falta:** fusionar las tarjetas de opción, los chips y los botones de subir en componentes propios.
- **Prioridad:** Fase 3.

---

## 5. Auditoría de accesibilidad

**Automático:** axe-core da **0 violaciones** en las 7 vistas: básico claro, galería, visor, avanzado, banco, escenario 3D y básico oscuro. Las auditorías anteriores dejaron bien el contraste, los landmarks, los nombres accesibles y el foco visible. Lo que sigue es lo que un analizador **no** ve:

### IMG-25 · 🟡 medio · ✅ — El error de la idea vacía no está unido al campo
- **Dónde:** `fieldErr('prompt', …)` (`src/studio.js:166`).
- **Evidencia:** tras GENERAR con la idea vacía, el campo tiene `aria-invalid: null` y `aria-describedby: null`; el texto del error vive en `.st-ferr`, sin relación con el campo (`errorVacio`).
- **Impacto:** con el lector de pantalla, se oye el campo pero no el error.
- **Solución:** `aria-invalid="true"` y `aria-describedby="<id de .st-ferr>"` mientras dure el error. Igual en las ranuras obligatorias y en el «Tu foto» del banco.
- **Hecho (6 oct, Fase 4):** la idea vacía lleva `aria-invalid` y `aria-describedby` hacia su error; una ranura obligatoria vacía, el botón que la llena lleva el motivo.
- **Prioridad:** Fase 4.

### IMG-26 · 🟡 medio · ✅ — Atajos de una sola tecla que no se pueden apagar
- **Dónde:** el teclado del Estudio (`src/studio.js:1722-1734`): E, I, V, B, L, «/», y en el visor +, −, 0, F.
- **Evidencia:** no hay ningún ajuste para desactivarlos (WCAG 2.1.4, «Atajos de una tecla»).
- **Impacto:** quien usa control por voz o tiene temblor puede cambiar de modo o de vista sin querer.
- **Solución:** en Ajustes → Atajos de teclado, un interruptor «Atajos de una tecla» (activado por defecto) que todos respeten.
- **Hecho (6 oct, Fase 4):** Ajustes → Atajos de teclado tiene «Atajos de una tecla» (`src/teclas1.js`, con test; `ao.keys1` en el navegador). Apagados, la oficina, el Estudio, el visor y el banco ignoran las letras sueltas; Ctrl + K, Esc y las flechas siguen.
- **Prioridad:** Fase 4.

### IMG-27 · 🟡 medio · ✅ — Iconos sin texto visible
- **Evidencia:** la ficha tiene 6 botones que solo son un icono. Tienen `aria-label` (bien), pero su texto solo aparece con `title`, que no sale con el teclado ni en el táctil.
- **Impacto:** la gente con dificultades cognitivas o visuales tiene que adivinar.
- **Solución:** IMG-18, más un tooltip propio en `:focus-visible` y al mantener pulsado.
- **Hecho (6 oct, Fase 4):** los botones que solo son un icono (Descargar, «⋯», Subir y Seleccionar en el teléfono, Cerrar, Quitar) llevan `data-tip`: su nombre sale con el foco del teclado y al mantenerlos pulsados.
- **Prioridad:** Fase 4.

### IMG-28 · 🟡 medio · ✅ — Orden de foco: la idea es la parada 15
- **Evidencia:** al abrir el Estudio y pulsar Tab, las paradas son:
  - el medidor de presupuesto, Cerrar y las pestañas;
  - Plegar y los 4 tipos;
  - Básico/Avanzado, el modelo y Una idea/Varias;
  - y solo entonces el **prompt (parada 15)**.

  GENERAR es la parada 38, tras los 16 formatos (`tabOrden`).
- **Impacto:** con el teclado, crear una imagen exige muchas teclas (Ctrl+Enter existe, pero no se ve).
- **Solución:**
  - Al abrir el Estudio sin nada más que hacer, el foco va a la idea.
  - Los formatos como un `radiogroup` (una parada, con flechas).
  - Mostrar «Ctrl+Enter» como pista dentro del campo.
- **Hecho (6 oct, Fase 4):** al abrir, el foco ya iba a la idea. Los formatos son un `radiogroup` (una parada de Tab; las flechas eligen); «Ctrl + Enter genera» se ve junto a la idea y GENERAR lleva `aria-keyshortcuts`.
- **Prioridad:** Fase 4.

### IMG-29 · 🟢 bajo · ✅ — Objetivos de menos de 24 px
- **Evidencia:**
  - «Quitar» de la miniatura de referencia: 22×22.
  - El enlace «Ajustes → Estudio»: 19 px de alto.
  - «Motores y cómo activarlos»: 21 px de alto (medidas).
- **Solución:** 24 px como mínimo (la regla de la casa), con relleno o `min-height`.
- **Hecho (6 oct, Fase 4):** «Quitar» de 24 px y los enlaces del Estudio con 24 px de alto. El recorrido mide 0 objetivos por debajo.
- **Prioridad:** Fase 4.

### IMG-30 · 🟡 medio · ✅ — Texto informativo en el mínimo, en versalitas
- **Evidencia:** 10 textos a 10,5 px, como las insignias (PRUEBA, SUBIDA) y las cabeceras de grupo de la lista de modelos («GOOGLE (GEMINI API) · listo»), en mayúsculas espaciadas.
- **Impacto:** cumple la regla de 10,5 px, pero en mayúsculas con espaciado cuesta leer, sobre todo a quien tiene baja visión o dislexia.
- **Solución:** 11,5 px como mínimo para el texto que informa; las versalitas solo para rótulos de sección, nunca para datos.
- **Hecho (6 oct, Fases 3 y 4):** con la escala, ningún texto del Estudio baja de 11,5 px.
- **Prioridad:** Fase 4.

### IMG-31 · 🟡 medio · ⏳ — Carga cognitiva
- **Evidencia:**
  - 38 controles en Básico y 48 en Avanzado (95 en todo el Estudio con Avanzado);
  - 127 presets;
  - 29 modelos de imagen, 24 de ellos «sin activar» en la misma lista.
- **Impacto:** es la mayor barrera para personas con dificultades cognitivas o de atención, y para cualquier principiante.
- **Solución:** las fases 5 y 6 (revelado progresivo, valores por defecto inteligentes, listas filtradas a lo que está listo).
- **Prioridad:** Fase 5.

---

## 6. Auditoría del modo básico

**Pregunta: ¿es sencillo para un usuario nuevo?** No. Llegar a la primera imagen cuesta 3 acciones (escribir, GENERAR y esperar), y eso está bien. Pero la pantalla presenta **38 controles en 1.195 px**, y la mitad no hacen falta para la primera imagen. Inventario de lo que se ve hoy en Básico, con su veredicto:

| Elemento | Hoy | Veredicto para Básico |
|---|---|---|
| Tipo: Imagen · Video · Voz · Música | 4 botones grandes, paso 1 | **Mover**: pestañas compactas arriba del compositor |
| Básico · Avanzado | segmentado sin número entre el paso 1 y el 2 | **Renombrar y mover**: interruptor «Ajustes avanzados» en la cabecera del compositor |
| Modelo | tarjeta con descripción larga, etiquetas y precio | **Simplificar**: chip «Modelo: Nano Banana 2 · US$0,07 ▾»; la descripción, dentro de la lista |
| Una idea · Varias ideas, una por línea | segmentado | **Mover a Avanzado** (es un modo de lote) |
| Idea (prompt) | `textarea` de 96 px | **Mantener y agrandar**: lo primero y con el foco al abrir |
| Mejorar el prompt + «en inglés» + Nuevo | botón, selector y botón | Mantener «Mejorar»; **el idioma, a Avanzado** (en Básico, la mejora en español); «Nuevo» → «Vaciar» con DESHACER |
| Imágenes de referencia | bloque con explicación larga, Subir y De la galería | **Simplificar**: un botón «+ Imagen» junto a la idea, como en un chat, y soltar sobre la idea = referencia |
| Formato | 16 botones (1:8, 8:1…) | **4 + «Más formatos»** (Cuadrado, Feed 4:5, Historia 9:16, Horizontal 16:9) |
| Más ajustes · tamaño | plegable, roto (IMG-19) | Tamaño a la vista si cambia el precio; lo demás, a Avanzado |
| Motores y cómo activarlos | plegable al final | **Fuera**: a Ajustes → Estudio; un enlace solo cuando haga falta |
| Cantidad − 1 + | contador | **Segmentado** 1 · 2 · 4 |
| GENERAR | botón grande | Mantener, **con el costo dentro** |
| Resumen · costo · estado | tres líneas grises | Chips arriba del botón y toasts (IMG-22, IMG-03) |
| ‹ plegar | texto de 11 px | Icono de panel en la cabecera del compositor |

Resultado esperado: **unos 12 controles** y todo en una pantalla de 900 px, con la idea arriba.

### IMG-32 · 🟠 alto · ⏳ — Básico no es básico
- **Evidencia:** 38 controles en el compositor (`controlesCompositor: 38`) y `scrollHeight` de 1.195 px (captura `02-basico-compositor-entero`).
- **Impacto:** un principiante no sabe qué es obligatorio y qué es opcional: tiene que leerlo todo antes de atreverse a pulsar.
- **Solución:** la tabla de arriba.
- **Prioridad:** Fase 5.

### IMG-33 · 🟠 alto · ⏳ — 16 formatos a la vista
- **Evidencia:** Nano Banana 2 ofrece 16 proporciones; todas salen como botones en Básico, incluidas 1:4, 4:1, 1:8 y 8:1 (captura `04`).
- **Impacto:** 3 filas de botones para algo que el 95 % resuelve con 4.
- **Solución:** 4 formatos con su uso y «Más formatos ▾» con el resto. Si el modelo no hace uno de los 4, se muestra atenuado con «Este modelo no lo hace».
- **Prioridad:** Fase 5.

### IMG-34 · 🟡 medio · ⏳ — El paso 1 mezcla dos decisiones
- **Evidencia:** «1 ¿Qué quieres crear?» lleva el tipo de medio y, sin número, el interruptor Básico/Avanzado; los pasos se renumeran según el modelo (4 o 5).
- **Solución:** el tipo de medio fuera del formulario, en pestañas arriba (Imagen · Video · Audio). El nivel, en la cabecera del compositor. Los pasos, por título y sin números, porque los números cambian (ya pasó en EST-01).
- **Prioridad:** Fase 5.

### IMG-35 · 🟡 medio · ⏳ — Mejorar el prompt cambia el idioma
- **Evidencia:** por defecto «en inglés»: el texto del usuario se reemplaza por uno en inglés, con la traducción debajo y «Volver al mío» (`src/studio.js:1607`).
- **Impacto:** para quien escribe en español, su idea desaparece del campo.
- **Solución:** en Básico, mejorar en español por defecto (los modelos de Google lo entienden). Mostrar la mejora como **sugerencia** que se acepta («Usar esta» o «Seguir con la mía»), en lugar de reemplazar el texto.
- **Prioridad:** Fase 5.

### IMG-36 · 🟡 medio · ⏳ — Elegir modelo: demasiado y confuso
- **Evidencia:** la lista tiene 29 modelos de imagen, 24 de ellos «sin activar» (`modelosImagen`). «Nano Banana (2.5)» y «Nano Banana 2» se confunden. En Básico, la tarjeta del modelo ocupa unos 110 px.
- **Solución:**
  - En Básico, un chip compacto con la opción **«Automático (recomendado)»**, que elige según lo que hay en el pedido (con referencia → el mejor editor; texto legible → Ideogram; si no, el de por defecto) y dice cuál usó.
  - La lista enseña solo los modelos listos, y al final «Ver los 24 sin activar».
  - Renombrar «Nano Banana (2.5)» a «Nano Banana 2.5 (anterior)».
- **Prioridad:** Fase 5.

### IMG-37 · 🟢 bajo · ⏳ — Cantidad como contador
- **Solución:** segmentado 1 · 2 · 4 (el máximo depende del tope), que da una decisión en un clic.
- **Prioridad:** Fase 5.

### IMG-38 · 🟡 medio · ⏳ — Referencias: soltar no va donde se espera
- **Evidencia:** soltar un archivo en cualquier parte del Estudio lo **sube a la galería** («Suelta aquí para subir»), no lo pone como referencia. El bloque de referencias explica en 2 líneas qué es una referencia.
- **Impacto:** el gesto natural (arrastrar la foto del producto a la idea) no hace lo que el usuario espera.
- **Solución:** soltar sobre la idea o sobre «+ Imagen» = referencia; soltar sobre la galería = subir. Cada zona se ilumina con su texto.
- **Prioridad:** Fase 5.

**Regenerar, variar, editar, descargar y compartir, en Básico:**
- **Regenerar** («Repetir»): solo en «⋯» y en el visor, y carga el compositor. Debería ser un botón «Otra vez» que genere con el mismo pedido, con costo y confirmación (IMG-01).
- **Variar:** ver IMG-01.
- **Editar:** bien resuelto en el visor («¿Qué cambio?» y ejemplos), pero el visor se cierra al enviar y la versión hay que buscarla. Debería quedarse abierto y mostrar la versión con antes y después al terminar.
- **Descargar:** un clic, con buen nombre de archivo, y «Descargar las N» en los pedidos. Correcto.
- **Compartir:** no existe, y está bien: la oficina es local y «Enviar a…» (calendario, Dimitri, departamento) es su forma de compartir. Se agrupa en un submenú (IMG-09).

---

## 7. Auditoría del modo avanzado

**Cómo se presenta hoy.** Avanzado inserta un paso «★ Presets» entre Modelo e Idea. Ese paso tiene:
- tres «puertas»: Desde cero · Mejorar mi foto · Copiar de una referencia;
- «Tu foto», «Referencias», «Lo que se hará» con el botón «Banco · B»;
- «Escenario 3D» y «Guardar esta receta como preset…».

El banco (127 presets, 13 grupos) y el escenario 3D se abren como una **hoja que tapa la galería**. Todo lo de Básico sigue debajo, incluido el paso 4 de referencias.

**Parámetros, uno por uno:**

| Parámetro | ¿Existe? | Dónde | Veredicto |
|---|---|---|---|
| Modelos | Sí, 29 | Paso 2 | Bien; filtrar a los listos (IMG-36) |
| Control de estilo | Por presets y referencias | Banco y Referencias | Bien; unificar referencias por rol (IMG-39) |
| Referencias | Sí, dos sistemas | Banco y paso 4 | **Fusionar** (IMG-39) |
| Imagen a imagen | Sí | «Tu foto» y referencias | Bien; el «modo» se deduce, pero las puertas contradicen (IMG-40) |
| Inpainting / máscaras | No | — | Añadir solo con los modelos que lo admiten (IMG-45) |
| Outpainting | Como preset («dar espacio») | Banco → Encuadre | Bien como preset; que se encuentre buscando «ampliar» |
| Composición | Sí, escenario 3D | Hoja del banco | Potente; simplificar el primer nivel (IMG-44) |
| Control de estructura | Escenario 3D y «Copiar composición» | Banco | Bien |
| Semilla | No | — | Añadir en «Técnico» (IMG-45) |
| Guidance / strength | Solo Suave/Normal/Fuerte por preset | Pila del banco | Generalizar como «Fidelidad a tu foto» (IMG-45) |
| Resolución | «Tamaño» 1K/2K/4K, plegado | Más ajustes | A la vista (cambia el precio) (IMG-19) |
| Relación de aspecto | 16 botones, más otra en el escenario 3D | Paso 5 y escenario | Una sola fuente (IMG-44) |
| Control de detalles | Presets (Limpieza, Calidad, Luz, Color) | Banco | Bien |
| Historial | Sí | Galería → Historial | Bien; que abra el trabajo en el visor |
| Variaciones | Sí | ⋯ y visor | Ver IMG-01 |
| Presets | 127 de fábrica, más los propios en el Cerebro | Banco | Bien; quitar ruido (IMG-43) |
| Configuraciones reutilizables | Solo con una receta activa | «Guardar esta receta…» | Generalizar (IMG-46) |
| Herramientas de edición | Solo texto | Visor → Editar | Añadir zona (IMG-45) |
| Comparar | Solo en Lotes | — | IMG-14 |

### IMG-39 · 🔴 crítico · 🟡 en parte (Fase 1) — Dos sistemas de referencias; con un preset, las tuyas se esconden y no se usan
- **Dónde:** el banco (`src/studio-banco.js`: «Tu foto», «Referencias») y el paso 4 del compositor. `src/css/estudio-banco.css:125` oculta `.st-matstep` con `#studioOv.st-banco-on`; `bancoManda()` → `banco.generar()` usa `st.foto` y `st.refs` del banco, no `media.reference`.
- **Evidencia:** en Avanzado se ven las dos cosas a la vez: «TU FOTO · se conserva», «REFERENCIAS · se imita…» y «4 Imágenes de referencia · 1 de 14» con la imagen verde (`avanzado.pasos`, captura `16`). Al elegir un preset, el paso 4 desaparece con la imagen dentro, y los pasos saltan de «3» a «5» (captura `18`).
- **Impacto:** el usuario pone su referencia, elige un preset, genera, y su referencia **no se usó**, sin ningún aviso. Dos lugares para el mismo concepto.
- **Solución:** un único bloque **«Material»**, para Básico y Avanzado, con roles:
  - **Tu foto** (se conserva el producto);
  - **Estilo** (se imita la luz y el color);
  - **Composición** (se imita el encuadre);
  - **Personaje o logo**.

  Básico enseña solo «+ Imagen», que es rol automático: con un preset que necesita foto, es «Tu foto»; si no, «Estilo». Avanzado deja elegir el rol con un menú en cada miniatura. El banco y el compositor leen el mismo estado, y nada se esconde con material dentro. Un test que falle si `.st-banco-on` oculta algo que contiene archivos.
- **Hecho en la Fase 1 (6 oct):** con un preset activo y referencias en el paso 4, un aviso junto a GENERAR lo dice y «Pasarlas a «Referencias»» las lleva al banco (`banco.anadirRefs`). Los pasos ya no saltan de 3 a 5. **Falta (Fase 6):** la fusión en un solo bloque «Material» con roles.
- **Prioridad:** Fase 1 (lo mínimo: el plan del banco usa `media.reference` o avisa «Tus 2 referencias no se usan con este preset»), y Fase 6 (la fusión completa).

### IMG-40 · 🔴 crítico · ✅ — Entrada contradictoria y un error antes de tocar nada
- **Dónde:** `src/studio-banco.js:42` (la puerta por defecto es `'foto'`), `:126-127` (la puerta pulsada y «Ahora: <modo deducido>») y `src/studio-banco-core.js:101` (`faltaEnPuerta`).
- **Evidencia:** al pasar a Avanzado, se pulsa «Mejorar mi foto», el texto dice «Ahora: **Desde cero**» y, en rojo, «Falta tu foto: el producto que se va a conservar.» (`avanzado.modo`, `avanzado.puertaPulsada`, captura `15`). El bloque «Para empezar · Mejorar mi foto» del banco abre con presets que **necesitan** foto.
- **Impacto:** el primer contacto con Avanzado dice tres cosas distintas y regaña al usuario. Es el patrón que hace que un profesional desconfíe de la herramienta.
- **Solución:**
  - Las puertas son atajos: ninguna aparece pulsada, o aparece la que coincide con el modo deducido.
  - Por defecto, «Desde cero».
  - «Falta tu foto» solo aparece al elegir un preset que la necesita o al pulsar GENERAR, y como error **del campo «Tu foto»**, que se ilumina.
- **Hecho (6 oct, Fase 1):** la puerta por defecto es «Desde cero». La línea «Ahora» nombra la puerta pulsada cuando aún le falta algo (`estadoPuerta`, con test), y lo que falta es una pista gris que solo pasa a rojo cuando ya intentaste generar.
- **Prioridad:** Fase 1.

### IMG-41 · 🟠 alto · ✅ — GENERAR sigue activo con un plan imposible
- **Evidencia:** con «Catálogo para la web» elegido y sin foto, el botón sigue naranja con «GENERAR». Junto a él, en rojo: «trabaja sobre tu foto: súbela o elige uno de «Desde cero»» (`trasPreset`, captura `18`).
- **Solución:** el botón dice lo que falta («Falta tu foto»), con `aria-disabled` y su explicación; el clic lleva al campo. Es el mismo patrón que `fieldErr` en Básico.
- **Hecho (6 oct, Fase 1):** GENERAR dice «Falta tu foto» o «Falta la referencia» (`botonBloqueado`, con test), y su clic lleva y da el foco a lo que falta. **Cambio respecto a la propuesta:** sin `aria-disabled`, porque el botón sí hace algo (lleva a lo que falta); va con `aria-describedby` a la explicación.
- **Prioridad:** Fase 1.

### IMG-42 · 🟠 alto · ⏳ — El banco y el escenario tapan la galería
- **Evidencia:** la hoja `.st-bank` ocupa toda la columna de la galería (capturas `17`, `19`). Mientras eliges una receta, no ves tu foto, tus referencias ni los resultados. Con Dimitri abierto, la columna es aún más estrecha.
- **Solución:** la hoja como **panel lateral** de unos 420 px que reduce la galería (ya mide su ancho con `@container bk`), o un selector grande con vista previa de la receta **sobre tu foto**. En el teléfono, la hoja inferior a pantalla completa está bien.
- **Prioridad:** Fase 6.

### IMG-43 · 🟡 medio · ⏳ — Ruido en las tarjetas de preset
- **Evidencia:**
  - Las 127 tarjetas dicen «beta», y muchas «receta» en una píldora.
  - «necesita tu foto · la IA y aquí se garantiza» no se entiende.
  - La estrella es una casilla aparte de 36 px junto a cada tarjeta, lo que duplica los objetos de la cuadrícula (captura `17`).
- **Solución:**
  - Quitar «beta» de las tarjetas: una sola nota en la cabecera del banco.
  - «receta» como icono de capas con el tooltip «Combina varios pasos».
  - Tres niveles de garantía en palabras claras: «Gratis, en tu equipo» · «Con IA» · «Con IA · se comprueba el fondo blanco».
  - La estrella, dentro de la tarjeta.
- **Prioridad:** Fase 6.

### IMG-44 · 🟡 medio · ⏳ — Escenario 3D: duplica el formato y habla como un fotógrafo
- **Evidencia:** «Proporción del cuadro» repite el Formato del compositor y añade 1.91:1, que el modelo puede no hacer. En el primer nivel hay lente (mm), altura (m), alrededor (°), giro y «Subir el producto» (`escena`, captura `19`).
- **Solución:**
  - Primer nivel: **Toma** y **Distancia** (ya existen como chips) y las medidas del producto.
  - «Cámara (ajuste fino)», plegado.
  - Sin selector de proporción: se muestra la del compositor, con «cambiar», que lleva allí.
- **Prioridad:** Fase 6.

### IMG-45 · 🟡 medio · ⏳ — Faltan controles técnicos para los profesionales
- **Evidencia:** no hay semilla, prompt negativo, fidelidad a la referencia ni máscara (`grep seed|negative|guidance|strength|mask media/catalogo.mjs` = 0 ajustes). «Editar» es solo texto. Solo en Lotes se puede comparar.
- **Impacto:** un profesional no puede reproducir un resultado ni editar una zona concreta.
- **Solución:** no añadirlo todo, solo lo que da control real, en un grupo plegable «Técnico»:
  1. **Semilla**, en los modelos que la aceptan. «Repetir» reusa la misma semilla; «Variar», otra.
  2. **Fidelidad a tu foto**: Suave/Normal/Fuerte, generalizado fuera de los presets.
  3. **Zona** en Editar: un pincel o rectángulo sobre la imagen en el visor. Con modelos de máscara (GPT Image, Flux Kontext en fal) se manda la máscara; con Nano Banana, la zona se traduce a texto («en la esquina superior derecha»).
  4. **Prompt negativo**, solo donde el modelo lo admite; si no, no se muestra.
- **Prioridad:** Fase 6.

### IMG-46 · 🟡 medio · ⏳ — Solo se guarda lo que tiene receta
- **Evidencia:** «Guardar esta receta como preset…» solo aparece con un preset activo. No se puede guardar «Nano Banana 2 · 4:5 · 2K · ×4 · estilo de marca» como plantilla.
- **Solución:** «Guardar como plantilla» con cualquier configuración del compositor (modelo, formato, tamaño, cantidad, material de estilo, receta y prompt base), como nota del Cerebro, igual que los presets.
- **Prioridad:** Fase 6.

### IMG-47 · 🟢 bajo · ⏳ — La tecla B cambia el modo sin preguntar
- **Evidencia:** B pasa a Avanzado y abre el banco (`src/studio.js:1733`).
- **Solución:** que lo diga en un aviso: «Pasé a Avanzado para abrir el banco · Volver a Básico».
- **Prioridad:** Fase 6.

**Qué debe estar visible, plegado o fuera, en Avanzado:**
- **Visible:** la idea; el material con roles; la receta (la pila de presets con su intensidad); el modelo; el formato y el tamaño; la cantidad; Generar con el costo.
- **Plegado (grupos con su resumen):** Composición (escenario 3D: «Frontal · 60 %»); Técnico (semilla, fidelidad, negativo); Varias ideas, una por línea; el idioma de la mejora.
- **Fuera:** Motores y cómo activarlos (a Ajustes); la proporción del escenario (IMG-44).

---

## 8. Auditoría de ventanas, paneles y secciones

Columnas: **Nec.** = ¿es necesario? · **Lugar** = ¿está donde debe? · **Claro** = ¿se entiende? · **Jer.** = ¿jerarquía adecuada? · **Pred.** = ¿se comporta como se espera? · **Modo** = ¿Básico o Avanzado? Los veredictos que piden un cambio están en negrita.

| Elemento | Nec. | Lugar | Claro | Jer. | Pred. | Alternativa más simple | Visible / oculto | Modo | Veredicto |
|---|---|---|---|---|---|---|---|---|---|
| Cabecera del Estudio (logo, título, subtítulo, presupuesto, ✕) | Sí | Sí | Sí | Ocupa 62 px | Sí | Una fila con las pestañas | Visible, compacta | Ambos | **Compactar** |
| Pestañas «Crear y galería · Lotes» | Sí | Sí | «Crear y galería» es largo | Bien | Sí | «Crear · Lotes» | Visible | Ambos | Renombrar |
| Paso 1 · Tipo (Imagen, Video, Voz, Música) | Sí | No: está dentro del formulario | Sí | Pesa demasiado (4 botones grandes) | Sí | Pestañas arriba | Visible y compacto | Ambos | **Mover** |
| Básico / Avanzado | Sí | No: entre el paso 1 y el 2, sin número | Sí | Bien | Avanzado cambia el formulario entero | Interruptor «Ajustes avanzados» que despliega grupos | Visible | — | **Mover y renombrar** |
| Tarjeta de modelo | Sí | Sí | Sí | Demasiado grande en Básico | Sí | Chip con «Automático» | Chip | Ambos | **Simplificar** |
| Lista de modelos | Sí | Sí | Sí | 24 sin activar entre los listos | Sí | Solo los listos y «ver más» | Desplegable | Ambos | **Filtrar** |
| Una idea / Varias ideas | Avanzado | No | Sí | Bien | Sí | — | Plegado | Avanzado | **Mover** |
| Idea + Mejorar + idioma + Nuevo | Sí | Sí | «Nuevo» ambiguo | La idea debería ser lo primero | «Nuevo» sin deshacer | — | Visible | Ambos | Renombrar «Vaciar» y subir la idea |
| Paso 4 · Imágenes de referencia | Sí | Duplicado en Avanzado | Sí | Bien | Se esconde con un preset | «Material» único | Visible | Ambos | **Fusionar** con el banco |
| Paso 5 · Formato (16) | Sí | Sí | 5 sin nombre | Demasiado | Sí | 4 + «Más» | Visible: 4 | Ambos | **Reducir** |
| Más ajustes | Sí | Sí | Sí | Roto (IMG-19) | Sí | — | Plegado | Avanzado | Arreglar |
| Motores y cómo activarlos | Sí, una vez | No: es configuración | Sí | — | Sí | Ajustes → Estudio | Fuera | — | **Mover** |
| Pie: cantidad, GENERAR, resumen, costo, estado | Sí | Sí | Costo poco visible | El costo debajo y en gris | Sí | Costo en el botón | Visible | Ambos | **Reordenar** |
| ‹ plegar | Sí | Sí | Texto pequeño | Bajo | Sí | Icono de panel | Visible | Ambos | Rediseñar |
| Filtros de galería (8) | Sí | Sí | Sí | Fila entera | Sí | Desplegable «Mostrar» | Desplegable | Ambos | **Compactar** |
| Buscar · Subir · Seleccionar | Sí | Sí | Sí | Bien | Sí | — | Visible | Ambos | Mantener |
| Historial · Papelera | Sí | Sí | Sí | Pesan como acciones primarias | Sí | En «⋯» | «⋯» | Ambos | **Mover** a «⋯» |
| Voces (en la galería) | Sí, para Voz | No: es de Voz | Sí | — | Sí | Ya está en el compositor de Voz | Solo en Voz | — | **Quitar** de la galería |
| Carpetas | Sí | Sí | Sí | Una fila entera | Sí | Desplegable o barra lateral | Desplegable | Ambos | Compactar |
| Ficha de imagen (6 iconos) | Sí | Sí | Iconos ambiguos | Papelera junto a Descargar | Sí | 3 primarias con texto y «⋯» | Visible | Ambos | **Reducir** |
| Menú «⋯» de la ficha | Sí | Sí | Sí | Mezcla imagen y oficina | Sí | Grupos y «Enviar a…» | Menú | Ambos | Agrupar |
| Ficha de pedido de N | Sí | Sí | Sí | Sin acciones | No: las acciones desaparecen | Encabezado de pedido y tarjetas normales | Visible | Ambos | **Rediseñar** (IMG-08) |
| Ficha de trabajo en marcha | Sí | Sí | Sí | Bien | Sí | — | Visible | Ambos | Mantener |
| Ficha fallida | Sí | Sí | Error en inglés | Bien | «Reintentar» repite el error | Reintentar con otro modelo | Visible | Ambos | Mejorar (IMG-04) |
| Visor: zoom y navegación | Sí | Sí | Sí | Bien | Sí | — | Visible | Ambos | Mantener |
| Visor: acciones (20) | Sí | Sí | Sí | Tres niveles; oficina mezclada | Algunas cierran el visor | Lista única (IMG-09) | Primarias visibles | Ambos | **Agrupar** |
| Panel Editar (visor) | Sí | Sí | Sí | Bien | El visor se cierra al enviar | Quedarse y mostrar la versión | Panel | Ambos | Mejorar (y zona, IMG-45) |
| Panel «Mandar a un departamento» | Sí | En «Enviar a…» | Sí | — | Sí | — | Submenú | Ambos | Mover |
| Avanzado: puertas | Atajos útiles | Sí | No: contradicen el modo | — | No | Quitarlas o reflejar el modo | Visible | Avanzado | **Arreglar o eliminar** (IMG-40) |
| Avanzado: Tu foto / Referencias | Sí | Duplicado | Sí | — | Esconde el paso 4 | «Material» único | Visible | Ambos | **Fusionar** |
| Avanzado: Lo que se hará (pila) | Sí | Sí | Sí | Bien | Sí | — | Visible | Avanzado | Mantener |
| Hoja del banco | Sí | Tapa la galería | Ruido (beta, receta) | Bien agrupado | Sí | Panel lateral | Hoja | Avanzado | **Mover** y limpiar |
| Escenario 3D | Sí, profesional | Tapa la galería | Jerga | Bien | Sí | Toma y distancia primero | Plegado | Avanzado | Simplificar |
| Lotes | Sí | Pestaña propia | Sí | Bien | Sí | — | Pestaña | Avanzado o pro | Mantener |
| Historial (modal) | Sí | Sí | Sí | Bien | No abre el trabajo | Clic → visor | Modal | Ambos | Mejorar |
| Papelera (modal) | Sí | Sí | Sí | Bien | Sí | — | Modal | Ambos | Mantener |
| Aviso al terminar con el Estudio cerrado | Sí | Sí | Sí | Bien | Sí | — | Toast | Ambos | Mantener |
| Confirmación de costo (`confirm()`) | Sí | No | Sí | — | Rompe el estilo | Segundo clic en el botón | — | Ambos | **Reemplazar** (IMG-11) |

### IMG-48 · 🟡 medio · ✅ — Las integraciones de la oficina compiten con las acciones de imagen
- **Evidencia:** en el visor, «Enviar al calendario», «Pedírselo a Dimitri» y «Mandar a un departamento…» van al mismo nivel que «Usar de referencia», «Repetir» o «Copiar prompt» (captura `10`).
- **Solución:** un botón «Enviar a… ▾» con las tres opciones.
- **Hecho (6 oct, Fase 2):** «Enviar a…» agrupa calendario, Dimitri y departamento, en el «⋯» y en el visor.
- **Prioridad:** Fase 2.

### IMG-49 · 🟡 medio · ✅ — La galería de imagen enseña Voz, Música y Voces
- **Evidencia:** los filtros Videos, Voz y Música y el botón «Voces» se ven también trabajando con imágenes.
- **Solución:** filtros en el desplegable (IMG-23); Voces solo en el compositor de Voz, donde ya está.
- **Hecho (6 oct, Fase 2):** Voz y Música quedan como opciones de «Mostrar ▾»; el botón «Voces» sale de la galería y se abre desde Voz («Clonar tu voz o diseñar una» y el selector de voz).
- **Prioridad:** Fase 2.

### IMG-50 · 🟡 medio · ✅ — «Motores y cómo activarlos» es configuración dentro del flujo creativo
- **Evidencia:** está al final del compositor, plegado, y repite lo de Ajustes → Estudio.
- **Solución:** moverlo a Ajustes → Estudio → Motores. En el compositor, solo un enlace cuando el modelo elegido no está activo.
- **Hecho (6 oct, Fase 2):** «Motores y keys» es un panel propio, abierto desde el «⋯» de la galería, desde «Empieza aquí» y desde la ayuda de una key. **Cambio:** no va en Ajustes porque allí no se ve qué modelos trae cada motor; el panel enlaza a Ajustes → Estudio para los topes.
- **Prioridad:** Fase 2.

### IMG-51 · 🟢 bajo · ⏳ — «‹ plegar» se descubre poco
- **Solución:** un icono de panel en la cabecera del compositor, con el atajo en el `title`.
- **Prioridad:** Fase 7.

### Responsive y rendimiento percibido

### IMG-52 · 🟠 alto · ✅ — El teléfono gasta media pantalla en controles
- **Evidencia (390×844):**
  - En **Galería**, unos 400 px de controles (8 filtros en dos filas, buscar, Subir, Seleccionar, Historial, Papelera, Voces y carpetas) antes de la primera imagen (captura `26`).
  - En **Crear**, la idea queda en el borde inferior, tras el tipo, el modo, la tarjeta del modelo y «Una idea/Varias»; el pie fijo ocupa unos 140 px (captura `24`).
- **Solución:** a 600 px o menos:
  - la idea primero;
  - el modelo, el formato y la cantidad como chips;
  - los filtros en una hoja inferior («Filtrar»);
  - la cabecera del Estudio sin logo;
  - el pie en una sola línea («Generar · US$0,07»).
- **Hecho (6 oct, Fase 2):** a 760 px o menos, la cabecera es una fila (pestañas, topes, cerrar; el título queda para el lector de pantalla), la barra de la galería son iconos, los tipos van en una fila de cuatro y la tarjeta del modelo, sin su descripción. A 390×844 la primera imagen empieza a 242 px y la idea se ve sin desplazarse. **Queda para la Fase 5:** poner la idea la primera.
- **Prioridad:** Fase 2.

### IMG-53 · 🟡 medio · ⏳ — El visor en el teléfono esconde las acciones
- **Evidencia:** la imagen ocupa un 45 % de la pantalla y las acciones obligan a desplazarse; «Mover a la papelera» queda fuera de la vista (captura `27`). El pellizco para hacer zoom sí funciona (`pointer` con dos dedos).
- **Solución:** una barra inferior fija con Editar, Variar, Descargar y «⋯»; la información, en una hoja que se despliega.
- **Prioridad:** Fase 7.

**Rendimiento percibido (bien):**
- la carga del banco bajo demanda, con «Cargando…»;
- la barra estimada y el aviso «tarda más de lo normal»;
- las fichas se actualizan sin redibujar toda la galería;
- se respeta `prefers-reduced-motion`.

---

## 9. Mapa de flujos actuales

| Flujo | Pasos hoy | Decisiones innecesarias | Puntos de abandono o confusión | Cambios de contexto |
|---|---|---|---|---|
| **F1 · Nuevo → primera imagen.** E → (Imagen ya elegido) → escribir → GENERAR → esperar (7–25 s) → encontrarla en la galería | 3 acciones, pero 38 controles a la vista | Tipo, Básico/Avanzado, Una idea/Varias, formato entre 16 | «Prueba (gratis)» vs modelo de pago (IMG-05); costo poco visible | Mirar del pie (mensaje) a la galería (resultado) |
| **F2 · Revisar → editar → descargar.** Clic en la miniatura (si es un pedido de N: antes «Ver por separado») → visor → Editar → escribir → Crear versión → **el visor se cierra** → esperar → buscar la versión → abrirla → Descargar | 8–9 | — | La versión no se abre sola; no hay antes y después | 2: visor → galería → visor |
| **F3 · Variar.** ⋯ → Variar | 2 | — | **Gasta sin confirmar; pisa el borrador; deja una referencia pegada** (IMG-01) | El compositor cambia sin pedirlo |
| **F4 · Avanzado con preset.** Avanzado → (entrada contradictoria) → puerta → Subir foto → Banco (B) → buscar → elegir → intensidad → (Escenario 3D → toma → distancia → Listo) → idea opcional → GENERAR → revisar | 10–14 | La puerta (el modo ya se deduce) | Error rojo de entrada (IMG-40); GENERAR activo con plan imposible (IMG-41); referencias del paso 4 ignoradas (IMG-39) | El banco tapa la galería (IMG-42) |
| **F5 · Profesional: comparar → modificar → regenerar → guardar preset.** Generar ×4 → abrir el visor → ← → para comparar (sin vista lado a lado) → Repetir (carga el compositor) → cambiar → GENERAR → Guardar como preset (solo si había receta) | 10+ | — | Sin semilla no se reproduce; sin comparación lado a lado; sin plantilla genérica | Visor ↔ compositor |
| **F6 · Usar una imagen como referencia.** Icono de referencia en la ficha → compositor (puede cambiar de modelo) → escribir → GENERAR | 3 | — | El cambio de modelo cambia el precio sin decirlo en el botón | Galería → compositor |
| **F7 · Descargar varias.** Seleccionar → marcar → Descargar (ZIP) | 3 | — | — | — |

---

## 10. Flujos recomendados

**F1 ideal · Nuevo (2 acciones).** Abrir el Estudio (el foco ya está en la idea) → escribir → «Generar · US$0,07» (Ctrl+Enter). El resultado aparece **resaltado arriba** con Editar, Variar y Descargar a la vista. Nada más que decidir: modelo «Automático», formato Cuadrado y cantidad 1, recordados.

**F2 ideal · Editar (4 acciones, sin salir del visor).** Clic en el resultado → Editar → escribir el cambio (o marcar una zona) → «Crear versión · US$0,07». El visor se queda abierto con «Generando versión…» y, al terminar, muestra **antes | después** y «Usar esta». Descargar está en la misma barra.

**F3 ideal · Variar (1 acción, con costo visible).** «Variar · US$0,07» (o «×4 · US$0,28») en la ficha o en el visor. Pide confirmación con un segundo clic si pasa del umbral. **No toca el compositor.** Las variaciones aparecen junto al original, en su mismo pedido.

**F4 ideal · Avanzado (un compositor, grupos plegables).**
1. **Material:** «+ Imagen» con su rol (Tu foto · Estilo · Composición · Personaje).
2. **Receta:** buscar o elegir en el panel lateral, que no tapa la galería; Suave, Normal o Fuerte.
3. **Composición** (opcional): Toma y Distancia; el ajuste fino, plegado.
4. **Técnico** (opcional): semilla, fidelidad y negativo.
5. **Generar** con el costo → **Comparar** (lado a lado) → «Guardar como plantilla».

**Qué automatizar:**
- el modelo («Automático» según el material);
- el rol de la imagen («Tu foto» si el preset la pide);
- desplazarse a lo nuevo;
- la versión con antes y después;
- reusar la semilla en «Repetir».

**Qué poner más a mano:**
- el costo, en el botón;
- Variar y Editar, en la ficha;
- Comparar, en la selección;
- Vaciar, con deshacer.

---

## 11. Problemas priorizados por gravedad

| ID | Gravedad | Problema | Fase |
|---|---|---|---|
| IMG-01 | 🔴 | Variar gasta sin confirmar, pisa el borrador y contamina el pedido siguiente | 1 |
| IMG-02 | 🔴 | Repetir, Animar y Referencia reescriben el compositor sin deshacer | 1 |
| IMG-39 | 🔴 | Dos sistemas de referencias; con un preset, las tuyas se esconden y no se usan | 1 / 6 |
| IMG-40 | 🔴 | Avanzado: entrada contradictoria y error sin haber hecho nada | 1 |
| IMG-03 | 🟠 | Avisos en una sola línea que se pisan | 1 |
| IMG-04 | 🟠 | Errores del proveedor en inglés crudo | 1 |
| IMG-05 | 🟠 | Promete gratis y cobra; el costo, escondido | 1 |
| IMG-06 | 🟠 | Esc en la idea cierra el Estudio | 1 |
| IMG-41 | 🟠 | GENERAR activo con un plan imposible | 1 |
| IMG-07 | 🟠 | El resultado no es protagonista | 2 |
| IMG-08 | 🟠 | La ficha de un pedido de N no tiene acciones | 2 |
| IMG-52 | 🟠 | El teléfono: media pantalla de controles | 2 |
| IMG-32 | 🟠 | Básico: 38 controles y 1,6 pantallas | 5 |
| IMG-33 | 🟠 | 16 formatos a la vista | 5 |
| IMG-42 | 🟠 | El banco y el escenario tapan la galería | 6 |
| IMG-19 | 🟡 | «Más ajustes» roto; Tamaño de 20 px | 1 |
| IMG-09 | 🟡 | Cuatro juegos de acciones | 2 |
| IMG-10 | 🟡 | «Nuevo» sin deshacer | 2 |
| IMG-23 | 🟡 | Demasiado cromo antes de las imágenes | 2 |
| IMG-48 | 🟡 | La oficina mezclada con las acciones de imagen | 2 |
| IMG-49 | 🟡 | Voz, Música y Voces en la galería de imagen | 2 |
| IMG-50 | 🟡 | Motores dentro del compositor | 2 |
| IMG-11 | 🟡 | `confirm()` nativo | 3 |
| IMG-13 | 🟡 | Contadores que no cuadran | 3 |
| IMG-15 | 🟡 | 13 tamaños de letra y Arial | 3 |
| IMG-16 | 🟡 | 7 radios | 3 |
| IMG-17 | 🟡 | Discontinuo = deshabilitado y soltar | 3 |
| IMG-18 | 🟡 | Iconos ambiguos | 3 |
| IMG-22 | 🟡 | Pie sin jerarquía | 3 |
| IMG-24 | 🟡 | Componentes duplicados | 3 |
| IMG-25 | 🟡 | Error sin `aria-describedby` ni `aria-invalid` | 4 |
| IMG-26 | 🟡 | Atajos de una tecla sin interruptor | 4 |
| IMG-27 | 🟡 | Iconos sin texto visible | 4 |
| IMG-28 | 🟡 | La idea es la parada de foco 15 | 4 |
| IMG-30 | 🟡 | Texto informativo a 10,5 px en versalitas | 4 |
| IMG-31 | 🟡 | Carga cognitiva | 5 |
| IMG-34 | 🟡 | El paso 1 mezcla dos decisiones | 5 |
| IMG-35 | 🟡 | Mejorar cambia el idioma | 5 |
| IMG-36 | 🟡 | Elegir modelo: demasiado y confuso | 5 |
| IMG-38 | 🟡 | Soltar no va donde se espera | 5 |
| IMG-14 | 🟡 | Sin comparación | 6 |
| IMG-43 | 🟡 | Ruido en los presets | 6 |
| IMG-44 | 🟡 | Escenario 3D: formato duplicado y jerga | 6 |
| IMG-45 | 🟡 | Sin semilla, fidelidad, zona ni negativo | 6 |
| IMG-46 | 🟡 | Solo se guarda lo que tiene receta | 6 |
| IMG-12 | 🟡 | El visor se cierra al actuar | 7 |
| IMG-53 | 🟡 | El visor en el teléfono esconde las acciones | 7 |
| IMG-20 | 🟢 | El nombre del modelo se parte | 3 |
| IMG-21 | 🟢 | Formato: etiqueta pegada, formatos sin nombre | 3 |
| IMG-29 | 🟢 | Objetivos de menos de 24 px | 4 |
| IMG-37 | 🟢 | Cantidad como contador | 5 |
| IMG-47 | 🟢 | B cambia el modo sin aviso | 6 |
| IMG-51 | 🟢 | «‹ plegar» poco visible | 7 |

---

## 12. Quick Wins (menos de un día cada uno, poco riesgo)

1. **IMG-19:** `details.st-more` en bloque y `select { min-width: 96px }`.
2. **IMG-06:** Esc con el foco en un campo solo quita el foco.
3. **IMG-40:** puerta por defecto «Desde cero» (o ninguna pulsada) y «Falta tu foto» solo tras elegir un preset que la pide o al pulsar GENERAR.
4. **IMG-41:** GENERAR con «Falta tu foto» y `aria-disabled` mientras `banco.error()` dé algo.
5. **IMG-05:** el costo dentro del botón («Generar 2 imágenes · US$0,13»); el estado vacío nombra el modelo y su precio.
6. **IMG-01 (mínimo):** «Variar» pasa por `estimate()` y por la confirmación, guarda y restaura el borrador, no toca `qty` y quita la referencia al terminar.
7. **IMG-03 (mínimo):** el mensaje de un trabajo fallido no se pisa con un «Listo»; plurales correctos.
8. **IMG-25:** `aria-invalid` y `aria-describedby` en `fieldErr`.
9. **IMG-29:** «Quitar» de 24 px; `min-height: 24px` en `.st-lk` y en el resumen de Motores.
10. **IMG-10:** «Nuevo» → «Vaciar» con DESHACER (reusar `toast()`).
11. **IMG-43:** quitar «beta» de cada tarjeta de preset.
12. **IMG-13:** el día cuenta archivos; los fallidos aparte.
13. **IMG-39 (mínimo):** con un preset activo y referencias en el paso 4, avisar junto a GENERAR: «Tus N referencias no se usan con este preset: pásalas a «Referencias» del banco» (con un botón que lo haga).

---

## 13. Cambios estructurales

1. **Un compositor que empieza por la idea.** La idea arriba y con el foco; debajo, una fila de chips (Modelo · Formato · Cantidad · + Imagen) y «Generar · costo». El tipo de medio va en pestañas arriba. Avanzado = grupos plegables del mismo compositor, no otro formulario. Cubre IMG-32, 33, 34, 22, 28 y 52.
2. **Un único estado «Material» con roles**, compartido por el compositor, el banco, Variar y Lotes. Nada se esconde con archivos dentro. Cubre IMG-39 y 38. **Antes** de tocarlo, un test que pinte el compositor con referencias y un preset y compruebe que llegan al plan.
3. **Un borrador con historia** (pila de 10 estados en memoria). Toda acción que lo cargue (Repetir, Animar, Referencia, Variar con cambios, Vaciar) lo guarda y ofrece DESHACER. Cubre IMG-01, 02 y 10.
4. **Una sola puerta de gasto.** Todo lo que gasta (GENERAR, Variar, Repetir, Editar, el banco, Lotes) pasa por la misma función: estimar, confirmar con un segundo clic si se pasa del umbral, y deduplicar. El costo siempre en el botón. Cubre IMG-01, 05 y 11. Lleva un test que falle si una ruta de la página llama a `/api/media/jobs` sin pasar por ella.
5. **Una lista de acciones por resultado** (un módulo puro con su test), pintada en la ficha, el «⋯», la ficha agrupada y el visor. Cubre IMG-08, 09, 12 y 48.
6. **Una cola de avisos** (`toast()` único, apilable, con acción) que reemplace `.st-msg`, `.st-toast`, `.bk-toast` y `.st-keyhelp` para lo que no es validación del formulario. Cubre IMG-03.
7. **Errores traducidos en el servidor** (`media/motores.mjs`), con un código de clase (`formato`, `contenido`, `saldo`, `key`, `red`) que la página convierte en acciones («Reintentar con…»). Cubre IMG-04.
8. **Componentes y tokens** (`src/css/componentes.css`; `--fs-*`, `--r-*`): segmentado, chip, tarjeta de opción, botón de subir, aviso y hoja. Cubre IMG-15, 16, 17 y 24.

---

## 14. Plan de implementación por fases

Cada fase se cierra con `npm run check` en verde y con `node scripts/estudio-imagen-recorrido.mjs` (y `estudio-modos-capturas.mjs`, `estudio-capturas.mjs` y `presets-recorrido.mjs` cuando la fase los toque) a 390, 1024 y 1512 px, en claro y en oscuro. **Todo cambio de lógica lleva su test** (CLAUDE.md). Los archivos grandes (`src/studio.js`, `src/shell.html`) se avisan al equipo antes de tocarlos (regla 6).

### FASE 1 — Correcciones críticas (lo que gasta, pierde o miente)
- IMG-01, IMG-02 (borrador con DESHACER y Variar autónomo), IMG-39 (lo mínimo), IMG-40, IMG-41, IMG-03, IMG-04, IMG-05, IMG-06 e IMG-19.
- **Criterio de aceptación:**
  - el recorrido comprueba que Variar no cambia la idea, la cantidad ni las referencias, y que pide confirmación por encima del umbral;
  - con un preset y referencias en el paso 4, el aviso aparece;
  - al entrar en Avanzado no hay texto rojo;
  - Esc en la idea no cierra el Estudio;
  - un 400 simulado se lee en español con «Reintentar con otro modelo».
- **Tests nuevos:**
  - `tests/estudio-borrador.test.mjs` (la pila de estados);
  - `tests/media-errores.test.mjs` (la traducción por clase);
  - un caso en `tests/studio-banco-core.test.mjs` para la puerta por defecto y `faltaEnPuerta`.

### FASE 2 — Mejoras de UX (flujos más cortos)
- IMG-07 (resaltar y desplazarse a lo nuevo, la tira de resultados), IMG-08 (encabezado de pedido), IMG-09 y 48 (lista única de acciones con «Enviar a…»), IMG-10, IMG-23 (cromo compacto), IMG-49, IMG-50 e IMG-52 (teléfono).
- **Criterio de aceptación:**
  - las imágenes empiezan a 220 px o menos a 1440×900;
  - en el teléfono, la primera imagen a 260 px o menos;
  - las 3 acciones primarias están en toda ficha, también en la de pedido.

### FASE 3 — Mejoras de UI (consistencia)
- IMG-15, 16, 17, 18, 20, 21, 22, 24, 11 y 13: tokens, `componentes.css`, deshabilitado sin discontinuo, iconos con texto y confirmación en el botón.
- **Criterio de aceptación:**
  - el recorrido mide 6 tamaños de letra o menos y 3 radios en `#studioOv`;
  - la familia Arial no aparece.

### FASE 4 — Accesibilidad
- IMG-25, 26, 27, 28, 29 y 30.
- **Criterio de aceptación:**
  - axe sigue limpio;
  - la idea es la primera parada de foco al abrir;
  - los formatos son un `radiogroup`;
  - el interruptor de atajos de una tecla funciona en el Estudio, el visor y el banco;
  - ningún objetivo mide menos de 24 px;
  - ningún texto informativo baja de 11,5 px.

### FASE 5 — Modo básico
- IMG-31, 32, 33, 34, 35, 36, 37 y 38: el compositor que empieza por la idea (cambio estructural 1), el modelo «Automático», 4 formatos más «Más», «+ Imagen» y soltar sobre la idea, y la mejora en español como sugerencia.
- **Criterio de aceptación:**
  - Básico tiene 14 controles o menos y cabe en 900 px;
  - una persona que nunca lo usó crea una imagen sin preguntar (prueba con 3 personas del equipo de PanaClaw, anotando dónde dudan).

### FASE 6 — Modo avanzado
- IMG-39 completo («Material» con roles, cambio estructural 2), IMG-42 (panel lateral), IMG-43, 44, 45 (semilla, fidelidad, zona y negativo donde el modelo lo admite; cada ajuste nuevo nace de los esquemas, como Higgsfield, nunca escrito a mano por modelo), IMG-46 (plantillas), IMG-14 (comparar) e IMG-47.
- **Criterio de aceptación:**
  - el recorrido de presets (`presets-recorrido.mjs`) sigue verde;
  - una plantilla guardada se vuelve a aplicar idéntica;
  - «Repetir» con semilla da el mismo resultado en un motor simulado que la respeta.

### FASE 7 — Refinamiento
- IMG-12 (volver a la imagen), IMG-51, IMG-53 (barra inferior del visor en el teléfono) y microinteracciones:
  - la transición del resultado nuevo (con `prefers-reduced-motion`, sin animación);
  - el pulso del botón GENERAR mientras confirma;
  - los estados `hover`, `active` y `disabled` revisados en los componentes nuevos;
  - los textos de la hoja «?» al día con cualquier atajo nuevo (lista `KEYS` en `src/main.js`).

---

## 15. Recomendaciones finales

1. **Proteger el trabajo y el dinero antes que nada.** Las cuatro críticas tienen el mismo origen: una acción que cambia un estado que el usuario no ve (el borrador, las referencias escondidas, el modo deducido). La regla para todo lo nuevo: *nada gasta sin pasar por la misma puerta, y nada reescribe lo que el usuario compone sin DESHACER*.
2. **Eliminar, fusionar, mover y renombrar.** Esto es lo que se recomienda de forma explícita:
   - **Eliminar:** las puertas de Avanzado (el modo ya se deduce de lo que pones; si se quedan, como atajos que nunca contradicen); «beta» en cada preset; `confirm()`; la proporción dentro del escenario 3D; «Voces» de la barra de la galería.
   - **Fusionar:** «Tu foto» y «Referencias» del banco con el paso 4 → **«Material»**; la fila de iconos, el «⋯», el visor y la ficha agrupada → **una lista de acciones**; `.st-msg`, `.st-toast` y `.bk-toast` → **una cola de avisos**.
   - **Mover:** el tipo de medio, a pestañas; Básico/Avanzado, a la cabecera del compositor como «Ajustes avanzados»; «Motores y cómo activarlos», a Ajustes; Historial y Papelera, al «⋯» de la galería; «Varias ideas», el idioma de la mejora y el Tamaño secundario, a Avanzado; Dimitri, departamento y calendario, a «Enviar a…».
   - **Renombrar:** «Nuevo» → «Vaciar»; «Crear y galería» → «Crear»; «Nano Banana (2.5)» → «Nano Banana 2.5 (anterior)»; «la IA y aquí se garantiza» → «Con IA · se comprueba el fondo blanco».
3. **Básico para empezar, Avanzado para controlar, con el mismo formulario.** Lo que distingue a los dos modos no debe ser la estructura, sino cuántos grupos están desplegados. Así, aprender Básico ya es aprender Avanzado.
4. **El resultado es el centro.** Generar, comparar y editar deben ocurrir donde está la imagen: el resaltado, la tira de resultados y el antes y después en el visor.
5. **Medir lo que se arregla.** El recorrido nuevo mide controles, tamaños, radios, el orden del foco, la altura del compositor y axe en cada vista. Los criterios de aceptación de cada fase son números de ese recorrido, no impresiones.
6. **Lo que no conviene añadir:** más modelos a la vista, más presets en el primer nivel, parámetros técnicos que el modelo elegido no admite. La potencia ya está; lo que falta es que se encuentre en el orden correcto.
