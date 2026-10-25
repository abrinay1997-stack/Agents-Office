# Auditoría de estados de acción (25 oct 2026)

Queja del dueño: «No hay animaciones de estado. En Ajustes, si activo en Conectores la casilla “búsqueda web” y le doy Guardar, no hay una animación ni algo que me indique que se está guardando. Toco el botón y no pasa nada, ni se oprime ni nada.»

Causa en Ajustes (antes): `save()` hacía `fetch` sin estado intermedio, sin `try/catch` (una red caída se perdía en silencio), el mensaje se quedaba para siempre y `await load()` repintaba sin avisar.

## El patrón único: `src/accion.js`

`conEstado(boton, () => promesa, { ocupado, hecho, ms })`:

| Momento | Qué ve y qué oye quien usa la pantalla |
|---|---|
| al instante (medido: 2–5 ms desde el clic) | `aria-busy="true"` + `aria-disabled` (el foco se queda), giro CSS + «Guardando…», el botón «se oprime» (`:active`) |
| éxito | icono ✓ + «Guardado» (verde, nunca solo color) 1,8 s y vuelve a su texto; se anuncia en una región `aria-live="polite"` única (`#acLive`) |
| error | «!» + «Reintentar», el motivo en español en un `role="alert"` junto al botón; el botón queda usable |
| segundo clic mientras trabaja | no hace nada (sin doble envío) |
| movimiento reducido | el giro se cambia por puntos estáticos y no hay escala al pulsar |
| móvil / táctil | alto mínimo de 44 px |

Ayudas: `pedir(url)` / `enviar(url, cuerpo, método)` (JSON, **tiempo máximo de 20 s**, red caída → «Sin conexión con la oficina…», 5xx, 401/403 y el texto del servidor, todo en español) y `fallaHTML(motivo)` («No pude cargar. Reintentar») para las vistas que se quedaban en blanco.

**Los botones de antes sin migrar** (se apagan y cambian a «Enviando…», unos 25 sitios): un observador de `disabled` (en `accion.js`) les pone `aria-busy` cuando el texto acaba en «…», y el CSS (`src/css/accion.css`) les da el giro. Además todo `button[class*="btn"]` se oprime al pulsarlo.

Ajustes además dice, junto a Guardar, **«Sin guardar» → «Guardando…» → «Guardado ✓»**, no pierde lo escrito al cambiar de pestaña (cifras y voz incluidas) y **avisa al cerrar con cambios pendientes** (Guardar y cerrar · Descartar · Seguir editando).

## Tabla de cobertura

Líneas = antes de este cambio (`origin/main`). Estado antes: **N** ninguno · **P** parcial (se apaga/cambia el texto, pero sin aria-busy, sin giro, sin confirmar o sin error visible) · **B** bueno. Ahora: **✔** usa `conEstado` · **A** automático (aria-busy + giro por el observador) · **B** ya era bueno, no se toca.

| Área | Control | Archivo:línea | Antes | Qué le faltaba | Ahora |
|---|---|---|---|---|---|
| Ajustes | Guardar (todas las pestañas: Conectores/búsqueda web, Estudio, Equipo, Costos…) | `src/settings.js:110` | N | todo: estado, error, doble clic, aviso al cerrar | ✔ |
| Ajustes | Cifras → Guardar; Voz de marca → Guardar | `settings.js:111-112` | N | sin `ok` visible ni error de red | ✔ |
| Ajustes | Leer mi web y preparar la oficina | `settings.js:132` | P | solo `disabled`; error de red sin capturar | ✔ |
| Ajustes | Carga de los ajustes / cifras / voz | `settings.js:81,86` | N | si fallaba, «Leyendo…» para siempre o pantalla vacía | ✔ «No pude cargar… Reintentar» |
| Ajustes → Estado | Probar conexiones ahora; Marcar como leídos | `src/health.js:40-41` | P / N | «Probando…» a mano; «leídos» sin nada | ✔ |
| Ajustes → Estado | Carga | `health.js:3` | N | «Leyendo el estado…» sin fin si fallaba | ✔ con Reintentar |
| Costos (U) | Aplicar una sugerencia | `src/costs.js:69` | P | `disabled`, sin giro, error mudo | ✔ |
| Costos (U) | Carga | `costs.js:62` | N | «Sumando…» sin fin si fallaba | ✔ con Reintentar |
| Negocio (N) | Añadir / Quitar indicador, Anotar valor | `src/business.js:49,50,55` | N | sin estado; errores con `alert()` | ✔ |
| Negocio (N) | Carga | `business.js:40` | N | «Leyendo…» sin fin si fallaba | ✔ con Reintentar |
| Tareas (detalle de la tarea) | Aprobar y enviar · Devolver · Deshacer · Guardar · Hecha · Detener · Eliminar · Archivar · Repetir · Ejecutar ahora | `src/detail.js:130` (`run`) | P | se apagaban todos los botones y salía «Un momento…», pero el pulsado no cambiaba | ✔ el botón pulsado dice «Aprobando…»; error con Reintentar |
| Tareas (detalle) | Guardar como ejemplo · Comentar · Pasar a persona · Borrador · 👍/👎 | `detail.js:164-168` | N | sin estado intermedio (rápidas, pero sin confirmar ni error de red capturado salvo `msg`) | P (queda el mensaje de `post()`) |
| Ficha del agente | GUARDAR · Olvidar lección · Restaurar versión | `src/agentsheet.js:70,3,96` | P / N / N | «Guardando…» solo en texto; olvidar y restaurar sin nada; `alert()` | ✔ |
| Cerebro | Subir documento · Restaurar · Mover a la papelera · Deshacer | `src/brain.js:413,439,447,453` | B | ya dicen «leyendo… / Restaurando… / Moviendo…» y el error | B |
| Cerebro | Búsqueda, carga de nota | `brain.js:252,373` | B | tiene «Leyendo…»/error en el panel | B |
| Dimitri | Enviar mensaje (chat con «escribiendo…»/stream) | `src/sub.js:346` | B | ya hay respuesta en vivo | B |
| Dimitri | ENVIAR A LOS JEFES / Descartar | `sub.js:375` | P | `disabled` + «Enviando a los jefes…», error como mensaje del chat | A |
| Dimitri | GENERAR (Estudio) · PROBAR CON 3 | `sub.js:391` | P | ídem | A |
| Dimitri | HACER (rutinas/tareas) · segundo clic de anuncios | `sub.js:413,425` | P | ídem | A |
| Tareas (barra del panel) | Agregar tarea / rutina | `src/tasks.js:567,622` | B | línea de estado «Pasando por Claude…» y error con el texto devuelto a la caja | B |
| Tareas (panel) | Cancelar una programada · editar · rutina (PATCH/DELETE) | `tasks.js:1296,1311,1331,664` | P | aparece error en el calendario/ventanita; sin giro | A |
| Calendario | Saltar esta ejecución · pausar/eliminar rutina | `src/calendar.js:442,448` | P | `disabled` + `say()` | P (sin cambio) |
| Estudio | GENERAR (trabajos con tarjeta de progreso, cancelar) | `src/studio.js:736` | B | tarjetas con barra y motivo del fallo | B |
| Estudio | Editar (Crear versión) · Crear la muestra de voz · Clonar · Mejorar el prompt | `studio.js:1670,1146,1164,1843` | P | texto cambia, `disabled`, sin giro | A |
| Contenido | Editor de la pieza (autoguardado) | `src/pieza.js:120-141` | B | «Escribiendo… / Guardando… / Guardado / error» | B |
| Contenido | Aprobar · pasar a revisión · quitar de la cola (acciones de la cola) | `src/contenido.js:625,668` | P | `disabled` + nota; sin giro | P |
| Contenido | Registrar venta / contacto calificado | `src/contenido-conversacion.js:124` | P | `disabled` + nota | P |
| Anuncios | Aplicar sugerencia · Deshacer · Crear indicadores · Evento de prueba | `src/anuncios/vista.js:324,285,384,395` | P | `aria-busy` y `disabled` ya puestos; faltaba el giro | A (el CSS de `aria-busy` les da el giro) |
| Anuncios | Segundo clic de gasto; guardar borrador; informe | `anuncios/vista.js` (diálogo), `asistente.js:199`, `informe.js:78` | B / B / P | «Guardando…» y toasts | B |
| Anuncios / Tareas / Analíticas | Carga de la vista | `anuncios/vista.js:102`, `tareas/vista.js:98`, `analiticas.js:291` | B | ya tenían «No se pudieron traer… Reintentar» | B |
| Conectores | Volver a comprobar | `src/mcp.js:209` | P | `disabled` + texto; su archivo lo toca otro equipo | P (documentado) |
| Conectores | Barra de conectores al cargar | `src/connectors.js:64` | P | «comprobando…» pero un fallo se pinta como «sin conectores» | P (documentado) |
| Aprobaciones | Aprobar/devolver desde el panel ⚠ | (usa `detail.js`) | P | ver Tareas (detalle) | ✔ |
| Aprobaciones | En Telegram | — | no aplica | | |
| Calendario | Cargas de capas (TUYAS, Contenido) | `calendar.js:132-148` | B | se repintan solas; no dejan pantalla en blanco | B |

## Qué queda

- **P** (Calendario, acciones de la cola de Contenido, Conectores, algunas del detalle) funcionan, pero conviene migrarlas a `conEstado` cuando se toque su archivo: `src/mcp.js`, `src/connectors.js` y `src/calendar.js` los tocan otros equipos y no se editaron aquí para no chocar.
- La capa de datos de Anuncios, Tareas y Contenido (`datos.js`) devuelve `{ ok, motivo }` y la vista lo muestra en un aviso; no lanza, así que no se envolvió.
- Regla desde hoy (en `CLAUDE.md`): **toda acción asíncrona nueva usa `conEstado`**.
