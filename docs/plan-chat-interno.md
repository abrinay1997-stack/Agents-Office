# Plan: el chat interno del equipo (módulo «Chat»), a la manera de D'CASA

**Estado:** plan escrito, nada construido (27 oct 2026). Pedido del dueño: *«me interesa tener un chat interno como lo tienen ellos, parecido al de Odoo… y dejar el plan escrito de un módulo de chat dentro, igual al de D'CASA»*.

**Fuente estudiada:** el repositorio `dcasapty/D_Casa_new_word` (commit `741930d`, leído en esta sesión, solo lectura). Las rutas de abajo son de ese repositorio. Odoo mismo (`vendor/odoo`) **no** está en el clon (es un submódulo vacío), así que lo que digo de «Discuss» es lo que se sabe de Odoo en general, no algo que yo haya leído en su código.

---

## 1. Lo primero: qué es «el chat de D'CASA» (y qué no es)

**D'CASA no tiene un módulo de chat propio entre personas.** Su chat interno es el **de Odoo** (la burbuja de la barra de arriba, con su bandeja y su contador, y el *chatter* de cada documento), con retoques encima. Lo que ellos construyeron a mano es lo que rodea a ese chat. Eso es lo que este plan copia, y lo que Odoo trae de fábrica se vuelve trabajo nuestro, porque la oficina no es Odoo.

| Pieza que tiene D'CASA | Dónde está (verificado) | Qué hace |
|---|---|---|
| La **burbuja de mensajes** en la barra, con contador rojo que late | `addons/dcasa_interfaz/static/src/scss/global.scss:26-46` | El contador es rojo (`#D92D20`), crece un poco cada 1,6 s y se queda quieto si la persona pidió «reducir movimiento». El ícono también se pone rojo. |
| La app **Discuss** escondida | `addons/dcasa_base/__init__.py:28-35` (`MENUS_OCULTOS`), `dcasa_interfaz/models/tablero.py:672-693` | Se oculta el *menú* de la app (queda solo para quien está en modo desarrollador) y se vuelve a ocultar en cada actualización. La **burbuja y el chatter siguen**. |
| **Avisos al chat** cuando pasa algo de la persona | `addons/dcasa_base/models/aviso_vendedora.py` | «Se facturó tu venta S00139», «Tu venta ya está cobrada». Una sola vez por hecho, nunca a quien hizo la acción, y **un aviso que falla jamás tumba la acción** (va en un `savepoint`). |
| **Notas internas con @mención** | `addons/dcasa_conversaciones/models/conversacion_panel.py:476-527` | Una nota que el cliente nunca ve. Solo se menciona al equipo (no a cualquiera), con tope de menciones y de largo; se avisa en Odoo **y por Telegram**; opcionalmente crea una **tarea con fecha** para la persona mencionada. |
| **Presencia**: «Ana está viendo / escribiendo…» | `addons/dcasa_conversaciones/models/presencia.py` | Una fila por persona que se reemplaza en cada pulso (cada 20 s; cada 4 s mientras teclea); se considera viva 50 s; «escribiendo» dura 8 s; lo viejo se borra a las 24 h. |
| **Tiempo real que no lleva texto** | `addons/dcasa_conversaciones/README.md` («El bus no lleva texto») y `docs/JUAN_PANEL.md` («Rendimiento y calidad») | El aviso en vivo trae solo ids y estado; la pantalla pide el texto después. Al reconectar, al volver a ver la pestaña y al volver la red se pone al día sola; sin conexión en vivo revisa cada 30 s. |
| **Quién ve qué** | `docs/PERMISOS.md` (~l.147) | Hasta lo que se esconde del menú no cambia los permisos de datos: «los chats y las menciones siguen mostrando los nombres». |
| Adjuntos con vida corta | `dcasa_conversaciones/models/firma.py`, `CLAUDE.md` (R2) | URL firmada de 15 min; los archivos de R2 no se borran al desvincular, los limpia un cron a los 45 días. |
| Resumir con IA | `docs/JUAN_PANEL.md` («Resumir») | «Resumir lo que pasó» con un modelo barato; **las notas internas nunca entran al resumen**. |

**Lo que D'CASA tiene y NO se copia:** la bandeja de clientes por WhatsApp (Juan, reparto de conversaciones, etiquetas, cotizaciones). En esta oficina eso ya existe como la Bandeja de Meta (Contenido); este plan es solo para **hablar entre el equipo**.

## 2. Qué tenemos ya para montarlo (verificado en este repositorio)

- **Cuentas, roles e invitaciones** (`cloudflare/worker/lib/equipo.js`, `modulos/equipo.js`): `admin · editor · lectura`; el nombre visible es único (`claveNombre`), sin marcas bidi; «Tú» está reservado.
- **Presencia y tiempo real** (`cloudflare/worker/hub.js`, `lib/vivo.js`): un Durable Object `Hub` con sockets hibernables, tope por persona y por mensaje, latido sin despertar el objeto, y `difundir()` a todos. **Lo que le falta para un chat:** mandar a *algunas* personas (hoy es a todos, o solo a administradores).
- **Avisos y Telegram**: `lib/avisos.js` (un aviso por clave en 6 h), `lib/telegram.js`, horario de silencio (`telegram.quiet`), ids de Telegram por persona en Ajustes → Equipo.
- **Tareas para una persona** (`tareas/dueno.mjs → asignadaA`, `POST /api/tareas/mias { persona, limite }`): sirve tal cual para «menciono a Beto y le dejo una tarea con fecha».
- **Archivos**: R2 con tipo comprobado por sus primeros bytes (`tipoDeImagen`), tope de tamaño y servido con sesión.
- **Dimitri por cuenta** (27 oct): ya existe el principio «lo tuyo no lo lee otro, ni abriéndolo por su id».
- **El celular** (`src/movil/`): `shell.registrarVista`, hojas, paquetes bajo demanda (`dist/movil-d.js` es el ejemplo a seguir).

## 3. Reglas del módulo (las heredadas de D'CASA y las de esta oficina)

1. **El aviso en vivo lleva ids, nunca texto.** El Worker difunde `{canal, mensaje, de}`; la pantalla pide el texto con su sesión. Así la autorización la decide siempre D1, no el canal en vivo.
2. **Un aviso nunca hace fallar lo que lo causó.** Escribir un mensaje se guarda aunque el aviso, el contador o Telegram fallen.
3. **Un aviso, una vez.** Misma persona, mismo mensaje, mismo canal: una sola notificación (tabla de «ya avisé»). **Nunca a quien lo escribió.**
4. **Lo privado es privado.** Un chat directo y un canal privado lo leen solo sus miembros. **Ningún administrador tiene puerta trasera** (como el chat de Dimitri por cuenta). Un administrador puede moderar canales *públicos*; para lo privado solo ve metadatos (que existe, cuántos miembros).
5. **D1 es la verdad; el socket es un atajo.** Si se pierde un aviso, el sondeo de 30 s y la «puesta al día» al reconectar lo recuperan. Probado, no supuesto.
6. **Nada de HTML.** Los mensajes son texto plano con tres adornos que la página arma por su cuenta (`@nombre`, enlaces `https://`, `[[nota]]`/`#tarea`); todo pasa por `esc()`. Nombres con `<` o marcas bidi se pintan como texto.
7. **Lo que escribe un tercero es dato, no orden.** Si un agente o Dimitri llegan a leer chat (fase C6), pasa por `safety.injectionIn`. **Los agentes no leen el chat del equipo** (mala idea por privacidad y por inyección); solo Dimitri, y solo lo que su cuenta ya puede ver.
8. **Topes y poda declarados** (regla de la revisión transversal): toda tabla nueva declara su tope en `cloudflare/tests/auditoria-transversal.test.mjs` y la poda va en `lib/mantenimiento.js`.
9. **Límites de D1** que las pruebas con SQLite no ven: máx. 100 parámetros por sentencia y 5 términos en una consulta compuesta. Las listas de miembros y de ids se parten en trozos.
10. **Solo en la nube.** La oficina de tu computadora no tiene cuentas ni equipo: el botón no aparece sin `window.AO_NUBE` (igual que «Mi perfil» y «Equipo»).
11. **El texto de la gente no entra al Cerebro ni a las skills solo.** Lo que valga siempre se promueve a una nota a mano (con «Pásalo al Cerebro» en un mensaje: C5).

## 4. Qué es el módulo (alcance)

**Sí:** canales públicos y privados, mensajes directos, un canal `#general` que existe desde el primer día, mensajes con respuesta/cita, @menciones, reacciones, adjuntos (imágenes y documentos), editar y borrar lo propio, no leídos con contador, buscar, silenciar, «escribiendo…» y «en línea», avisos por Telegram a quien no está mirando, hilos de un registro (tarea, pieza, nota) con mensajes de sistema, y a Dimitri para resumir.

**No (por ahora):** llamadas y video, chat con clientes (eso es la Bandeja), bots de terceros, correo hacia el chat, notificaciones push del navegador (C6, aparte), cifrado de extremo a extremo.

## 5. Modelo de datos (D1, migración `0102_chat.sql`)

```
chat_canales   id (texto corto, p. ej. 8 letras)  ·  tipo  general | canal | directo | grupo | registro
               nombre  ·  privado (0/1)  ·  clave_directo (ids ordenados «a|b», ÚNICA: un solo directo por pareja)
               ref_tipo, ref_id (para los hilos de un registro: tarea, pieza, nota)  ·  creado_por  ·  creado_at
               archivado_at  ·  ultimo_id  ·  ultimo_at           -- para ordenar la lista sin contar
chat_miembros  canal_id, user_id  (PK)  ·  rol dueno|miembro  ·  leido_hasta (id de mensaje)
               silenciado (0/1)  ·  desde
chat_mensajes  id INTEGER AUTOINCREMENT  (sirve de cursor: «dame lo que pasó después del 1.204»)
               canal_id  ·  user_id  ·  tipo texto | sistema  ·  cuerpo (≤ 4.000)
               responde_a  ·  menciones (json de user_id)  ·  adjuntos (json: clave R2, nombre, tipo, bytes)
               creado_at  ·  editado_at  ·  borrado_at          -- borrar = dejar la lápida, cuerpo vacío
chat_reacciones mensaje_id, user_id, emoji  (PK)
chat_avisados  mensaje_id, user_id, via  (PK)                   -- «ya avisé», para no repetir
```

- Índices: `chat_mensajes(canal_id, id)`, `chat_miembros(user_id)`, `chat_canales(clave_directo)`.
- **No leídos** = mensajes del canal con `id > leido_hasta`, de otra persona y sin lápida. Se cuentan con el índice; el total de la campanita es la suma de los canales no silenciados **más** todas las menciones, aunque el canal esté silenciado.
- Un directo se crea al escribir el primer mensaje (no antes), con `clave_directo` única: dos personas que se escriben a la vez terminan en el mismo canal.
- Una persona quitada del equipo (`baja_at`) deja sus mensajes con su nombre y sale de los canales; nunca se reutiliza su cuenta.

## 6. API (`cloudflare/worker/modulos/chat.js`, lógica en `lib/chat/`)

Todas con sesión; escribir pide `admin` o `editor`; un `lectura` lee los canales de los que es miembro y no escribe (decisión 3 del §13).

| Ruta | Para qué |
|---|---|
| `GET /api/chat/resumen` | Mis canales: último mensaje (80 letras), no leídos, menciones, silenciado; y el **total** de la campanita. |
| `GET /api/chat/canales/<id>/mensajes?antes=&limite=50` | El hilo, hacia atrás, en tramos. |
| `POST /api/chat/canales/<id>/mensajes` | Escribir (`cuerpo`, `respondeA?`, `adjuntos?`). Las menciones se leen del texto y se **validan contra los miembros**. |
| `PATCH` · `DELETE /api/chat/mensajes/<id>` | Editar (15 min) o borrar lo propio; un administrador borra en canales públicos. |
| `POST /api/chat/canales/<id>/leido { hasta }` | Marcar leído (nunca baja). |
| `POST /api/chat/canales` · `POST /api/chat/directo { con }` | Crear un canal o abrir el directo con alguien. |
| `POST` · `DELETE /api/chat/canales/<id>/miembros` | Invitar / salir / sacar. |
| `GET /api/chat/novedades?desde=<id>` | Lo que pasó mientras estaba desconectada (la «puesta al día»). |
| `GET /api/chat/buscar?q=` | Busca solo en mis canales. |
| `POST /api/chat/mensajes/<id>/reaccion` | Poner o quitar. |
| `POST /api/chat/canales/<id>/escribiendo` | «Está escribiendo» (sin tocar la base; máx. 1 cada 3 s). |
| `GET /api/chat/adjuntos/<clave>` | Con sesión **y** pertenencia al canal (no basta tener la clave). |

Toda ruta comprueba la pertenencia en D1 (`chat_miembros`) antes de leer o escribir. **Un id ajeno da 404**, no 403 (no se confirma que existe). Las escrituras pasan por `tasa()`: 30 mensajes por minuto y persona.

## 7. Tiempo real (extender el `Hub`)

- `difundir(evento, excluir, fuera)` ya existe. Se añade **`para: [userIds]`**: solo reciben los sockets de esas personas. Los eventos del chat son `{ tipo: 'chat', evento: 'mensaje'|'leido'|'escribiendo'|'miembros', canal, id, de }` (ids, nunca texto).
- **El chat NO entra en `AREAS`** de `lib/vivo.js`. Esa lista blanca difunde a todos que «alguien cambió X»; un chat privado no puede anunciarse así. El módulo difunde por su cuenta, dirigido.
- **Trampa de privacidad:** la presencia actual (`presentes()`) manda a todos el `area` de cada persona. Para «Ana está en este canal» **no** se pone el id de un canal privado en el `area`; «viendo» y «escribiendo» se mandan solo a los miembros.
- Al reconectar y al volver a ver la pestaña: `GET /api/chat/novedades?desde=<último id>`. Sin socket: sondeo cada 30 s. El tope por socket del Hub (10 de ráfaga, 5 por segundo) no se toca.
- Prueba con workerd real (`cloudflare/tests/vivo-ayudas.mjs`): dos sesiones, un mensaje privado, y la tercera sesión **no** recibe nada, ni siquiera el id.

## 8. Avisos y contador

- **Campanita** (escritorio: ícono en el dock; celular: ícono en la cabecera junto a Buscar y ⚠). Contador rojo que late como el de D'CASA, **apagado con «reducir movimiento»**, y que no vive solo de color (lleva el número).
- **Qué cuenta:** mensajes sin leer de canales no silenciados, y siempre las menciones y los directos. «No molestar» y las horas de silencio de Telegram se respetan.
- **Telegram** solo para directos y menciones, y solo si la persona **no tiene un socket vivo** desde hace unos minutos (si está mirando, no se le insiste). Por defecto el aviso dice «Ana te escribió en #ventas» **sin el texto** (Telegram es un tercero); que lleve el texto es una decisión del dueño (§13).
- **Mención con tarea** (como D'CASA): al mencionar, un botón «dejarle una tarea para el… (fecha)» llama a `POST /api/tareas/mias { persona, limite }`. Solo si la persona mencionada está en el canal.
- **Mensajes del sistema** (fase C5): en el hilo de un registro, «Beto la marcó hecha», «Ana cambió la fecha límite»; a quien lo hizo no se le avisa.

## 9. Pantallas

**Escritorio.** Un botón en el dock (con su `aria-label`, `title` con la tecla y contador) abre la **vista Chat** (`data-view="chat"`, se registra con `views.add`, expone `selection()` para el chip «Viendo» de Dimitri). Dos paneles: a la izquierda la lista (buscador, no leídos primero, directos y canales, «+ Nuevo»), a la derecha el hilo con la caja abajo. **Tecla:** hay que elegir una que no choque (hoy están E P H K R J G O U N , ? S B T V C 1–6; la `M` choca con Calendario y Contenido cuando están abiertos): decidir en C1 mirando `src/teclas1.js` y el `ignorar(e)`; el atajo entra también en la lista `KEYS` de `src/main.js`. Más adelante, «ventanitas» abajo a la derecha como las de Odoo (C6).

**Celular.** Un ícono en la cabecera con el contador; la lista y el hilo son pantallas separadas (el hilo, una hoja `lleno`; «atrás» del teléfono la cierra). La caja de respuesta va fija abajo y sube con el teclado (`visualViewport`); la barra de pestañas se esconde con el teclado. Objetivos de **44 px**, campo de **16 px**, nada de `:hover`, `env(safe-area-inset-*)`, colores `--mv-*`. En «Más» aparece como otra entrada. Probar a **320, 360, 390 y 430 px**.

**Dónde vive el código** (la página está a ~3 KB de su tope de 2,2 MB, así que **nada del chat entra en la página**): un paquete aparte `dist/chat.js` (`build-chat.mjs`, como `build-movil.mjs`), servido en `/chat.js` y, en la nube, con sesión por `paginas.js`; la página solo gana un cargador diminuto y el botón. `build.mjs` falla si la página importa algo de `src/chat/`. Las pantallas móviles se registran con `registrarVista` y se traen bajo demanda como `dist/movil-d.js`.

## 10. Seguridad y privacidad (lo que se prueba, no solo se escribe)

- **Matriz de roles ejecutada**: admin, editor y lectura contra cada ruta; un `lectura` no escribe; un editor no ve un directo ajeno; un admin no lee un directo ajeno (404).
- **Ni el id ni el texto de un privado salen por el socket** a quien no es miembro (prueba con workerd real).
- **Escapado**: un nombre de canal, de persona o un mensaje con `<img onerror>` o marcas bidi se pinta como texto.
- **Adjuntos**: tipo por los primeros bytes, nunca SVG ni HTML, tope de tamaño, servidos con sesión **y** pertenencia al canal, nunca con una URL pública. Los archivos de R2 no se borran al quitar un mensaje: los limpia un cron a los 45 días (como D'CASA).
- **Menciones**: solo a miembros del canal, con tope por mensaje; `@todos` solo en canales públicos y solo si lo permite un administrador.
- **Centinela**: ningún secreto aparece en una respuesta del chat (los tests de la oficina ya barren un centinela).
- **Retención**: 365 días por defecto (ajustable en Ajustes → Chat); la poda diaria quita mensajes viejos y deja los canales. «Exportar mi conversación» y «borrar mi cuenta» tienen que contar con esto (C6).

## 11. Integraciones

| Con | Cómo | Cuándo |
|---|---|---|
| **Tareas** | Mención con tarea (arriba). El hilo de una tarea (C5) **muestra** sus comentarios actuales como mensajes; la fuente de verdad sigue siendo la tarea (no se duplica el almacén). | C3 · C5 |
| **Cerebro** | Un `[[nota]]` en un mensaje es un enlace que abre la nota. «Pásalo al Cerebro» crea una nota con el mensaje (con el clic de la persona, nunca solo). | C5 |
| **Dimitri** | Consulta de **lectura** `ver_chat` (solo canales de la cuenta que pregunta, con el escudo de inyección) y «Resumir este canal» (como D'CASA: lo privado nunca entra al resumen). Dimitri **no escribe** en un canal sin un clic. | C6 |
| **Guía de Dimitri** (`guia-oficina.mjs`) | Una entrada nueva en el **mismo cambio** que la vista (regla del repositorio). | C1 |
| **Telegram** | Avisos (arriba). Contestar desde Telegram al chat queda fuera. | C3 |
| **Agentes** | Ninguna. Ni leen ni escriben el chat del equipo. | siempre |

## 12. Fases (cada una se despliega sola y deja la oficina funcionando)

| Fase | Qué entrega | Tamaño | «Hecha» cuando… |
|---|---|---|---|
| **C0** | Decisiones del §13, migración `0102`, `chat-core.mjs` (puro: limpiar el cuerpo, leer menciones, clave del directo, contar no leídos), módulo y rutas **sin pantalla**. | M | Tests de rutas con SQLite + matriz de roles; topes declarados en la revisión transversal. |
| **C1** | `#general`, canales, directos, lista e hilo en escritorio y celular, no leídos, marcar leído, sondeo de 30 s (**sin sockets todavía**). | M | Recorridos en navegador a los 4 anchos del celular y a 1280 px; axe sin críticos; entrada en la guía de Dimitri. |
| **C2** | Tiempo real: `Hub` con envío dirigido, «escribiendo», «viendo», puesta al día al reconectar, contador que late. | M | Prueba con workerd real: la tercera persona no recibe ni el id; el mensaje llega solo; el corte y la vuelta no pierden ninguno. |
| **C3** | Menciones, avisos (campanita y Telegram), silenciar, «no molestar», mención con tarea. | M | Un aviso por hecho; nunca a quien escribió; el aviso que falla no tumba el mensaje. |
| **C4** | Adjuntos (R2), respuestas, reacciones, editar y borrar, buscar. | M | Adjunto ajeno = 404; SVG/HTML rechazado; búsqueda solo en mis canales. |
| **C5** | Hilos de registros (tarea, pieza, nota) con mensajes de sistema; `[[nota]]` y `#tarea` en los mensajes; «Pásalo al Cerebro». | M | El hilo de una tarea refleja sus comentarios sin duplicarlos. |
| **C6** | Dimitri (`ver_chat`, resumir), ventanitas de escritorio, retención y exportar. Aparte y si se quiere: push del navegador. | M | Dimitri no ve un canal ajeno ni uno privado de otra cuenta. |

## 13. Decisiones que necesito del dueño (con lo que propongo)

1. **¿Quién puede usar el chat?** Propongo: administradores y editores escriben; **lectura** puede leer los canales a los que lo inviten pero no escribir.
2. **¿Telegram lleva el texto del mensaje?** Propongo que **no** (solo «Ana te escribió en #ventas»), por privacidad.
3. **¿`#general` incluye a todos automáticamente?** Propongo que sí, y que quien llegue por una invitación entre solo en `#general`.
4. **¿Dimitri puede escribir en un canal?** Propongo que **no** hasta C6 y, después, solo con un clic de una persona.
5. **¿Cuánto se guardan los mensajes?** Propongo 365 días.
6. **¿Los comentarios de las tareas se mudan al chat o se muestran en él?** Propongo **mostrar** (no mudar): menos riesgo y nada que migrar.
7. **El nombre y la tecla.** «Chat» y una tecla libre, a elegir en C1.

## 14. Lo que NO está verificado

- No se leyó el código de Odoo Discuss (el submódulo no está en el clon): sus pantallas y comportamientos se describen por conocimiento general, no por lectura.
- No se probó ningún caso real de D'CASA; todo lo de §1 sale de leer su código y su documentación.
- Falta medir el costo de D1 y del `Hub` con el equipo real (¿cuántas personas y cuántos mensajes al día?). Con un equipo pequeño es irrelevante; con cientos de mensajes por minuto habría que mover el reparto a un Durable Object por canal.
- Las notificaciones push del navegador no se diseñaron aquí (requieren un *service worker* y un permiso del usuario).
