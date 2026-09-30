# Contenido y Meta en la oficina: calendario de contenido, programación y analíticas

Propuesta del 30 sep 2026. **Nada de esto está implementado.** Es el plan para traer a la oficina lo mejor de Juancito Ads (conexión con Meta, calendario de contenido, cola de publicación, métricas) sin romper lo que la oficina ya es. Al final están las decisiones abiertas; hasta que el dueño las conteste no se escribe código.

## 1. Resumen en diez líneas

1. La oficina gana **tres vistas** bajo la barra superior, como el Estudio y el Cerebro: **Calendario de contenido**, **Programación** y **Analíticas**. Las tres hablan con Meta (Instagram y Facebook).
2. El calendario de tareas y rutinas (P) **no se toca en lo visible**. Su motor (la cuadrícula de mes, semana, día y agenda) se saca a un módulo puro, `calendar-core`, y el calendario de contenido lo reutiliza con otras tarjetas.
3. Una **pieza** es una nota de texto (idea, caption, medios del Estudio, día, hora, redes). Su estado de publicación (en cola, publicando, publicada, falló) vive aparte, en `data/`, igual que en Juancito Ads.
4. **Los agentes nunca publican.** Escriben borradores por una herramienta interna (`contenido`, como la del Estudio) que no puede aprobar ni programar. Publica el reloj de la oficina, y solo lo que el dueño aprobó.
5. Se trae de Juancito Ads lo que es **código puro** (reglas por red, planificación de la cola, cifras, hora sugerida, semanas) copiado con su procedencia y sus tests, y lo que habla con Meta (cliente de la Graph API, pasos de publicación, métricas) reescrito sobre archivos en vez de D1.
6. Lo que **no** viene: varios espacios, roles, sockets, aprobación por un cliente externo, TikTok, auditorías e informes (estos dos últimos, en una fase tardía).
7. **Meta desde una máquina local** tiene tres problemas reales: cómo se conecta sin un sitio público, de dónde baja Meta las imágenes, y qué pasa si el computador duerme a la hora de publicar. La propuesta resuelve los tres, y los marca como **por comprobar con la cuenta real**.
8. Empieza en **modo simulacro**: todo funciona con un Meta de mentira (como el motor «Prueba» del Estudio) hasta que el dueño pone su token y pasa a «real» con dos toques.
9. Seis fases. La primera (**F0**) es solo refactor, sin cambio visible; la segunda (**F1**) ya deja un calendario de contenido usable, sin Meta.
10. Cada fase termina en `npm run check` en verde, con tests nuevos y con la vista probada a 390, 1024 y 1512 px.

## 2. Qué hay hoy en cada lado

| | Juancito Ads (Cloudflare) | Agents Office (local) |
|---|---|---|
| Qué es | La agencia planifica, aprueba y publica el contenido de **varios clientes** | El dueño dirige **agentes** que trabajan para una sola empresa |
| Calendario | Publicaciones por día y por mes (`calendars` → `days` → `posts`), con estados, aprobación del cliente, hora, redes | Tareas fechadas y rutinas en sus días (`src/calendar.js`, 661 líneas, sin tests): mes, semana, día y agenda |
| Publicar | Cola (`publicaciones_programadas`), cron de un minuto, Instagram, Facebook y TikTok, reintentos, avisos | No hay |
| Meta | OAuth de la agencia, cuentas asignadas por cliente, token de cada página | No hay (los agentes de Marketing tienen el conector Metricool, que es de otro tercero) |
| Métricas | Foto diaria de cada cuenta y de la competencia, pantalla Resultados, informes | Solo los KPI del dueño (`recordKpi`, tecla N) |
| Imágenes y video | El Estudio (Google, fal.ai, Higgsfield) | El Estudio (Google, fal.ai, Higgsfield, xAI, OpenAI), más completo en galería y carpetas |
| Memoria | Un cerebro por cliente en D1 + R2, que aprende de lo que pasa después de escribir | Un cerebro de empresa en carpetas `.md`, con grafo 3D, menciones y sinapsis que aprenden |
| Dónde corre | Worker + D1 + R2 + Durable Object, siempre encendido | Node en el computador del dueño (Windows), a veces dormido |
| Secretos | `wrangler secret put` | Variables de entorno de Windows; **nunca en archivos** |

Lo esencial: Juancito Ads **ya resolvió** publicar y medir. La oficina **ya tiene** los agentes, el Estudio y el Cerebro. Lo que falta en la oficina es el puente entre lo que los agentes preparan y lo que sale en las redes.

## 3. Qué se trae y qué no

### Se trae (código puro, se copia con procedencia y tests)

Son módulos ESM sin dependencias, que en Juancito Ads importan igual el Worker y el navegador. La oficina hace lo mismo: `serve.mjs` ya importa de `src/` (`when.js`, `data.js`, `models.js`).

| Módulo de Juancito Ads | Líneas | Para qué |
|---|---|---|
| `src/lib/publicacion.js` | 426 | Límites por red, proporciones, qué medios salen en cada red, `revisarPublicacion` con sus arreglos, historias, colaboradores |
| `src/lib/cola.js` | 180 | La cola resumida para la rejilla y el panel |
| `src/lib/resultados.js` | 203 | De filas de métricas a cifras, formatos y horarios; `horaSugerida` |
| `src/lib/agenda.js`, `semanas.js` | 242 · 75 | Agrupar por semana, «hoy» en zona horaria (la oficina ya tiene `when.js`; se reconcilia, no se duplica) |
| `src/lib/subir.js` | 142 | Formato deducido del archivo, redes por defecto, mover una pieza de día |
| `src/lib/aprobacion.js` | 191 | Solo lo que sirva para «aprobada = por programar» (el resto es del cliente externo) |

### Se reescribe sobre archivos (habla con el mundo, hoy con D1 y Cloudflare)

| Módulo de Juancito Ads | Líneas | En la oficina |
|---|---|---|
| `worker/lib/meta.js` | 259 | `contenido/meta.mjs`: cliente de la Graph API (versión fijada), traducción de errores de Meta a frases |
| `worker/lib/publicador.js` | 750 | `contenido/publicador.mjs` y `cola.mjs`: los pasos, la reserva, «publicar es lo único que no se repite» |
| `worker/lib/metricas.js` | 312 | `contenido/metricas.mjs`: foto diaria, cada grupo de métricas por su lado |

### Queda fuera

Varios espacios de trabajo y `owner_id`, D1, R2, Durable Object y socket (la oficina es de una sola persona y de una sola máquina), roles y colaboradores, la página de aprobación del cliente externo, el servidor MCP con OAuth, TikTok, auditorías de perfil e informes mensuales. TikTok, informes y aprobación externa podrían entrar en F5 si el dueño los pide.

## 4. Principios (no se negocian sin preguntar)

1. **Los agentes no publican.** Ningún agente recibe una herramienta que apruebe, programe o publique. La herramienta interna `contenido` se agrega a `INTERNAL` en `safety.mjs` (como `estudio`) y un test comprueba que su lista de herramientas no contiene ningún verbo de envío.
2. **Publica el reloj de la oficina, y solo lo aprobado.** El OK del dueño en la vista es el único paso que convierte una pieza en «aprobada». La cola solo toma piezas aprobadas, y un interruptor en Ajustes (`apagado`, `simulacro`, `real`) manda por encima.
3. **La definición de la pieza y su estado de publicación son cosas distintas.** La nota describe lo que se quiere publicar; `data/contenido/cola.json` dice qué pasó. La vista junta las dos (igual que `cola.js` en Juancito Ads). Aprendido allí: el `status` del calendario no es la verdad de lo publicado.
4. **Doble testigo de lo publicado.** Cuando Meta devuelve el id de una publicación, se guarda en la cola **y** en la cabecera de la nota. El publicador se niega a publicar una pieza cuya nota ya dice «publicada». Así, si `data/` se pierde o se restaura de una copia vieja, no se duplica nada en el perfil de la marca.
5. **Nada secreto se escribe en disco.** El token de Meta y las llaves del almacén de medios viven en variables de entorno de Windows. Los tokens de página se piden a Meta al usarlos y no se guardan.
6. **Módulos nuevos, archivos grandes intactos.** `serve.mjs` (1.690 líneas), `src/main.js` (1.810) y `src/shell.html` (2.549) son los que más chocan entre el dueño y el equipo. Cada uno recibe solo unas pocas líneas de cableado; todo lo nuevo vive en módulos propios.
7. **Simulacro primero.** Hasta que haya token, todo el circuito (aprobar, programar, «publicar», ver el resultado) corre contra un Meta de mentira. Lo mismo que el motor `prueba` del Estudio, y lo que permite probar sin arriesgar un perfil real.
8. **Lo que falla se ve.** Un fallo de publicación no puede perderse en un aviso: queda en Programación, en el semáforo de salud (O), en el número del icono y, si Telegram está encendido, en el teléfono.
9. **Lo copiado lleva su origen.** Cada módulo portado empieza con un comentario: repositorio, archivo, commit y qué se cambió. Los tests puros de Juancito Ads se copian con él.

## 5. Arquitectura de módulos

```
contenido/                      (servidor, .mjs)
  piezas.mjs                    leer, escribir y validar las notas de pieza; estados; el doble testigo
  cola.mjs                      la cola: planificar, reservar, avanzar, cancelar, reintentar (data/contenido/cola.json)
  publicador.mjs                los pasos de Instagram y Facebook; el modo apagado / simulacro / real
  meta.mjs                      cliente de la Graph API y sus errores en español
  medios-publicos.mjs           poner un archivo donde Meta pueda bajarlo, y quitarlo después
  metricas.mjs                  la foto diaria de cada cuenta y de cada publicación (data/contenido/metricas/)
  rutas.mjs                     las rutas /api/contenido/* (un solo import en serve.mjs)
contenido-mcp.mjs               la herramienta interna de los agentes (borradores y lectura, nunca publicar)
src/
  contenido-reglas.js           límites por red, revisarPublicacion, arreglos (portado, puro)
  contenido-cola.js             la cola resumida para pintar (portado, puro)
  contenido-cifras.js           cifras, formatos, horarios, horaSugerida (portado, puro)
  calendar-core.js              el motor de cuadrículas, sacado de calendar.js (puro, con tests)
  calendar.js                   el calendario de tareas y rutinas, ahora sobre calendar-core
  contenido.js                  la vista Calendario de contenido (data-view="contenido")
  programacion.js               la vista Programación (data-view="programacion")
  analiticas.js                 la vista Analíticas (data-view="analiticas")
  pieza.js                      el panel de una pieza, compartido por Contenido y Programación
  css/contenido.css, ...        el estilo de cada vista, fuera de shell.html (ver F0)
tests/
  contenido-*.test.mjs          piezas, reglas, cola, publicador con un Meta de mentira, métricas, MCP
```

El servidor hace tres cosas más, todas de una línea: importar `contenido/rutas.mjs`, llamar a `tickContenido()` desde el mismo reloj de un minuto que ya vigila las tareas fechadas, y añadir `data/contenido/` a `dailyBackup`.

### Dónde vive cada dato

| Dato | Dónde | ¿Viaja por GitHub? |
|---|---|---|
| La pieza (idea, caption, día, hora, redes, medios, historias) | `<cerebro>/Agents Office/contenido/AAAA-MM/<id>.md`, con cabecera YAML | **No.** Es la misma carpeta que las entregas, ignorada por git |
| Estado de publicación (en cola, ids de Meta, intentos, motivo del fallo) | `data/contenido/cola.json` | No (`data/` se queda en cada máquina) |
| Cuentas de Meta (id y nombre, sin tokens) | `data/contenido/cuentas.json` | No |
| Métricas | `data/contenido/metricas/AAAA-MM.json` | No |
| Modo, ventana de tolerancia, hora por defecto | `office.config.json → contenido` (y Ajustes) | Sí, sin secretos |

**Ojo con la privacidad.** El repositorio de la oficina «puede ser público». Un caption sin publicar puede traer un precio, un lanzamiento o una promoción. Por eso las piezas van en `Agents Office/`, que el `.gitignore` ya excluye, y no en las carpetas de notas de empresa que sí viajan. Dentro del cerebro siguen siendo notas: el Cerebro las muestra, los agentes las encuentran con la búsqueda y las pueden citar en su línea `Fuentes:`, que es lo que alimenta las sinapsis que aprenden.

### Cómo se ve una pieza

```yaml
---
tipo: pieza
id: p-20261005-01
titulo: Examen gratis y regalo a elegir
fecha: 2026-10-05
hora: "09:00"
formato: carrusel        # post | reel | carrusel | historia
redes: [instagram, facebook]
estado: aprobada         # idea | borrador | revision | aprobada
responsable: newt        # un agente o una persona
medios:
  - media/2026-10/2026-10-01 examen-gratis 101533.png
publicada: null          # el segundo testigo: { red: id, cuando } cuando salga
---
Texto de la publicación…

## Primer comentario
#optica #gafas

## Historias
…
```

## 6. Las tres vistas

Las tres siguen la regla V4.5: una vista más bajo la barra superior (`top: 52px`, `data-view`), registrada con `views.add()`, que llama a `views.opening()` al abrirse. El estilo es el de la oficina: crema y tinta (`--cream`, `--ink`), líneas finas, serifa para los títulos, los colores de cada departamento como etiqueta, iconos SVG monocromos (no emoji).

### 6.1 Calendario de contenido

La misma cuadrícula que el calendario de tareas (mes, semana, día, agenda), con otras tarjetas:

- **Tarjeta de pieza:** miniatura a la izquierda (nada encima de la imagen), título y hora a la derecha, iconos de las redes y una etiqueta de estado. En el mes, una línea por pieza; en semana y día, con miniatura.
- **Estados** (etiqueta con texto, nunca solo color): Idea · Borrador · En revisión · Aprobada · Programada · Publicando · Publicada · Falló · A mano.
- **Arrastrar una pieza a otro día** la mueve; si ya estaba programada, mueve también lo programado. Con teclado y en el teléfono: «Mover a…» en el panel, como en el Estudio.
- **Filtros:** por red, por estado, por formato, por responsable; «Mías» y «Necesitan revisión».
- **Barra de meses** `‹ Octubre 2026 › Hoy` y la agenda como vista del teléfono, por defecto por debajo de 760 px.
- **Panel de la pieza** (lateral a lo ancho, hoja inferior en el teléfono, con `modal.open`): Idea → Contenido (texto, primer comentario, hashtags) → Medios (arrastrar, pegar, reordenar, portada) → Redes (cada red con su casilla y «lo que sale en ella») → Revisión (los problemas que detecta `revisarPublicacion`, cada uno con su arreglo de un clic) → «¿Cuándo sale?» con **un solo botón** que dice lo que va a pasar («Aprobar y programar para lun 5 oct, 9:00 a. m.»).

### 6.2 Programación

Lo operativo, en listas, no en fechas (la primera pantalla de `/programacion` de Juancito Ads, adaptada):

1. **Por revisar:** piezas en «En revisión», con «Aprobar todas» (dos clics, como en Aprobaciones).
2. **Aprobadas, por programar:** lo aprobado que aún no está en la cola.
3. **Lo que falló:** con el motivo en español y **Reintentar** o **Descartar**.
4. **Lo que sale:** la cola por hora, con **Cancelar** y **Publicar ahora** (pide confirmar).
5. **Lo que salió:** con enlace a la publicación y sus primeras cifras.

Arriba, tres contadores y el estado de las cuentas («Instagram: @marca · Facebook: Página · token vigente»). El icono de la vista lleva un número rojo cuando algo falló, como la luz de salud.

### 6.3 Analíticas

Botón aparte, como pidió el dueño. Solo lectura sobre Meta:

- **Cuentas:** seguidores, alcance, visualizaciones e interacciones, últimos 7, 30 y 90 días, con línea de tendencia (SVG propio, sin librería; la ventana de Costos ya dibuja algo parecido).
- **Qué funciona:** formatos (reel, carrusel, post, historia), días y franjas horarias, y las publicaciones con mejor resultado, con miniatura.
- **Hora sugerida:** solo aparece con datos suficientes (Juancito Ads exige dos publicaciones del mismo día y franja, o cuatro en la franja); con menos, no se muestra nada. Una sugerencia sacada de una publicación es ruido con aspecto de consejo.
- **Avisos honestos:** «esta cifra aún no maduró» (una publicación de hace tres días sigue subiendo), «Meta no da este dato para tu cuenta», «tu token no tiene el permiso X».
- **Va a los indicadores del dueño:** seguidores y alcance entran en «Cómo va el negocio» (N) por `recordKpi`, con tendencia y meta, sin una segunda contabilidad.

Las miniaturas de Meta caducan: al hacer la foto diaria se guardan en `data/contenido/miniaturas/`.

### 6.4 Una capa en el calendario de tareas

En el calendario P, un interruptor «Contenido» dibuja las piezas como fichas pequeñas junto a las tareas. Clic sobre una ficha abre la vista Calendario de contenido en esa pieza. Es solo lectura: se planifica en un sitio y se ve en los dos.

## 7. De punta a punta

```
Rutina del lunes «Planificar la semana de contenido»  (o Dimitri, o el dueño a mano)
   │  el agente de Marketing lee: analíticas (ver_analiticas), el Cerebro (voz, ofertas, cifras),
   │  lo ya programado (ver_calendario_contenido)
   ▼
Escribe borradores  ── crear_borrador ──►  notas «borrador» en Contenido
   │  pide imágenes al Estudio (generar_imagen: ya existe) y las adjunta a la pieza
   ▼
El dueño abre Contenido: edita, cambia la hora, arregla lo que revisarPublicacion marca
   │  «Aprobar y programar»   ← el único paso humano que autoriza
   ▼
La cola guarda la salida (estado: programada, con la hora)
   ▼
El reloj de la oficina (cada minuto)  ── tickContenido ──►  publicador
   │  Facebook: publica o programa nativo · Instagram: contenedor → esperar → publicar
   │  el id que devuelve Meta se guarda ANTES que nada (cola + nota)
   ▼
Publicada  ──►  aviso (y Telegram)  ──►  las cifras maduran  ──►  Analíticas
                                              └──►  el Cerebro aprende qué notas dieron buen resultado
```

### El Estudio en el circuito

- Desde una imagen del Estudio: **«Enviar al calendario»** crea una pieza con ese archivo.
- Desde el panel de la pieza: **«Crear con el Estudio»** abre el Estudio con el destino «pieza X» y, al terminar el trabajo, ofrece «Usar en la pieza X». Es el mismo puente que Juancito Ads tiene entre el Estudio y el panel de publicación.
- **La papelera no puede llevarse lo que una pieza usa.** Hoy `emptyBins` borra a los 30 días. Cada archivo del Estudio lleva su registro `.json`; ahí se anota `usadoEn`, y lo usado no se purga. Es el mismo fallo silencioso que Juancito Ads ya tuvo con `usado_en`.

### Los agentes

`contenido-mcp.mjs` es un servidor MCP interno, arrancado por ejecución con el mismo patrón que `estudio-mcp.mjs`. Tiene cuatro herramientas y ninguna puede publicar:

| Herramienta | Qué hace |
|---|---|
| `ver_calendario_contenido` | Lo que hay entre dos fechas (piezas y su estado) |
| `ver_pieza` | Una pieza completa |
| `crear_borrador` | Escribe una nota en estado `borrador`. No puede poner `aprobada` |
| `ver_analiticas` | Cifras, formatos y horas que funcionan (las mismas de la vista) |

Se habilita por departamento (`contenido.departments`, por defecto Marketing y Delivery). Una skill `plan-contenido` bajo el cerebro le enseña al agente cómo planificar una semana; la oficina la incluye como ejemplo.

## 8. Seguridad

- **Tres candados independientes para publicar:** la pieza está `aprobada` por el dueño; el modo es `real` (o `simulacro`); y hay token válido. Si falta uno, no sale nada.
- **Topes:** Instagram permite 50 publicaciones cada 24 horas por cuenta; la cola consulta el límite de Meta antes de reservar y se detiene con un aviso, no con un error.
- **Un solo publicador a la vez.** Una reserva por pieza (`reservadoHasta`, que caduca sola si el proceso muere a medias) y un cerrojo en `tickContenido` para que el doble clic de «Publicar ahora» o dos ticks seguidos no publiquen dos veces.
- **Auditoría:** cada intento (permitido o no) queda en `data/audit/AAAA-MM-DD.jsonl`, como las llamadas de los agentes.
- **Deshacer:** tras «Aprobar y programar» hay 30 segundos para deshacer, como en Aprobaciones.
- **Lo que sale de la máquina:** solo los archivos de la pieza y su texto, a Meta y al almacén de medios. El almacén se vacía después de publicar.
- **Inyección:** lo que Meta devuelve (comentarios, textos de otras cuentas si algún día se leen) nunca se trata como orden; es dato.

## 9. Meta desde una máquina local

En Juancito Ads Meta encuentra un sitio público con HTTPS: recibe la vuelta del OAuth, baja las imágenes de una dirección firmada y el cron corre siempre. Una oficina en un computador de escritorio no tiene nada de eso. Estas son las opciones para cada problema. **Todo lo de esta sección se comprueba con la cuenta real antes de darlo por bueno**: los tests usarán un Meta de mentira, y un Meta de mentira solo dice lo que uno cree que Meta dice.

### 9.1 Cómo se conecta

| Opción | Cómo funciona | Contra |
|---|---|---|
| **A. Token de usuario del sistema (recomendada)** | En el Business Manager se crea un «usuario del sistema», se le asignan las cuentas y se genera un token sin caducidad. Va en `META_ACCESS_TOKEN` (variable de Windows) | Un paso manual, una vez. Sin botón «Conectar» en la oficina |
| B. OAuth contra `localhost` | La oficina abre el permiso de Meta y recibe la vuelta en su propia dirección | Meta debe aceptar `localhost` como redirección; el token resultante tendría que guardarse en un archivo, que rompe la regla de «nada de secretos en disco» |

La opción A encaja con cómo ya se ponen las llaves del Estudio, y Ajustes se limita a decir «META_ACCESS_TOKEN: falta / puesta, cuentas visibles: …, permisos que faltan: …» (como el aviso «falta una key» del Estudio).

Permisos que hará falta pedirle a la app: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, y `business_management` si las cuentas se asignan por el Business Manager. Con la app en modo de desarrollo y el dueño con rol en la app, el acceso estándar alcanza (lo aprendido en Juancito Ads). Si `META_APP_SECRET` está puesto, cada llamada lleva `appsecret_proof`.

### 9.2 De dónde baja Meta las imágenes

Facebook acepta el archivo subido directamente. **Instagram no**: pide una dirección pública de la que descargarlo (`image_url`, `video_url`). Hay tres formas:

| Opción | Cómo | A favor | En contra |
|---|---|---|---|
| **A. Un bucket público de R2 (recomendada)** | La oficina sube el archivo por la API S3 de R2 y da a Meta su dirección pública; se borra al publicar | Estable, independiente de la otra app, barato | Una cuenta de Cloudflare, un bucket y una llave (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`) |
| B. Un túnel (`cloudflared`) | La oficina sirve un archivo por una dirección temporal | Sin bucket | Expone una puerta de la máquina; frágil en Windows; hoy la oficina no tiene inicio de sesión (issue #2), así que solo serviría una ruta aparte y firmada, nunca la oficina |
| C. Pasar por el Worker de Juancito Ads | La oficina envía el archivo a un extremo nuevo del Worker, que lo guarda en su R2 y lo sirve firmado (ya sabe hacerlo con `/api/medio-publico`) | Aprovecha lo que ya está desplegado; casi nada nuevo en la oficina | Acopla dos sistemas: si la agencia deja de existir o cambia, la oficina deja de publicar en Instagram. Requiere tocar el otro repositorio |

Instagram acepta además una subida por partes para los reels; si funciona con esta cuenta, evita el almacén para video. **Por verificar.** Las imágenes de Instagram siguen necesitando la dirección, y solo se aceptan en JPEG (el navegador las convierte al programar, como hace Juancito Ads).

### 9.3 Qué pasa si el computador duerme a la hora de publicar

| Política | Cómo funciona |
|---|---|
| **A. Facebook nativo + Instagram por reloj, con ventana de tolerancia (recomendada)** | Facebook permite programar una publicación (`scheduled_publish_time`, entre 10 minutos y 30 días adelante), así que sale aunque el computador esté apagado. Instagram no lo permite por la API, así que sale a la hora si la oficina está despierta. Si se despierta más tarde, publica solo si pasaron menos de N minutos (por defecto 120, configurable); si pasaron más, marca «se perdió la hora», avisa (y Telegram) y espera una decisión del dueño |
| B. Solo por reloj, como Juancito Ads | Todo sale cuando la oficina esté encendida y despierta | Lo más simple; una oficina dormida a las 9:00 es una publicación perdida |
| C. Llevar el publicador a un servidor | El despliegue ya está preparado (`Dockerfile`, `railway.json`) | Bloqueado por el issue #2 (no hay inicio de sesión) y por decidir dónde viven los datos |

La ventana de tolerancia es lo mismo que ya hacen las rutinas («atrasadas», una vez). Una publicación tarde con el cliente esperando es peor que un aviso: por eso la política por defecto no publica «lo que sea» al despertar.

**Una cuarta vía, para más adelante (F5):** el conector Metricool que los agentes de Marketing ya tienen programa en Instagram desde los servidores de Metricool, con el computador apagado. Se podría añadir como un segundo «conductor» detrás de la misma cola: el resto del sistema no se entera. Es de pago y es un tercero, así que **no** se propone de entrada; queda anotado porque el diseño lo permite sin cambios (`publicador.mjs` habla con una interfaz, no con Meta a secas).

### 9.4 Lo que ya se sabe de Meta (de Juancito Ads)

Meta no deja programar Instagram por API; descarga los medios, no se le suben; Instagram solo publica JPEG; el token que caduca es el de la persona, no el de las páginas (y un token de usuario del sistema no caduca); publicar es un proceso de varios pasos y un reel no cabe en una vuelta, así que cada paso guarda su avance; **lo único que no se repite nunca es publicar**; las métricas cambian de nombre (`impressions` → `views`) y cada grupo se pide por su lado para que uno roto no tire la foto entera; Meta guarda pocos días de historia, así que la foto diaria es lo que permite comparar contra hace un mes.

## 10. Refactor del calendario

`src/calendar.js` (661 líneas) es una sola función `initCalendar` con todo dentro: qué eventos hay (`events()`), cómo se pinta cada tarjeta (`cardHTML`), la cuadrícula (`render`, `timeGrid`), la agenda (`agendaHTML`). No tiene tests. Para que el calendario de contenido no sea una copia de 600 líneas hay que separar **qué se pinta** de **cómo se coloca**:

```
calendar-core.js   PURO. Fechas y semanas (inicio en lunes o domingo), rejilla del mes, posición y solapes
                   dentro de la cuadrícula de horas, agrupar para la agenda, línea de «ahora».
                   No sabe qué es una tarea ni una pieza: recibe eventos { id, inicio, fin?, ... }.
calendar.js        El calendario de tareas y rutinas: su fuente de eventos (tareas fechadas + ocurrencias
                   de rutinas por when.js), su tarjeta, sus atajos, sus ventanitas.
contenido.js       El calendario de contenido: su fuente (piezas + cola), su tarjeta, su panel.
```

Reglas del refactor:

1. **F0 es solo mover, sin cambiar lo que se ve.** Antes de tocar nada se guardan capturas de referencia del calendario actual (mes, semana, día, agenda, teléfono, con datos de la demo) con Chromium sin cabeza, que ya está en las herramientas del proyecto (`playwright-core`). Después del refactor se comparan. Las capturas son una herramienta de desarrollo (`scripts/`), no parte de `npm run check`; lo que sí entra en `check` son los tests de las funciones puras.
2. **Los 98 puntos de la auditoría del calendario no pueden retroceder** (`docs/auditoria-estudio-calendario-2026-09-24.md`): arrastrar con el dedo, «ahora», deshacer 8 segundos, el «SIN TERMINAR», etc. Cada uno se comprueba después de mover.
3. **El estilo sale de `shell.html`.** El calendario nuevo no cabe en un archivo que ya tiene 2.549 líneas. F0 agrega a `build.mjs` un paso que junta `src/css/*.css` en el HTML (un marcador `<!--CSS-->` en `shell.html`, una línea). Las vistas nuevas traen su CSS en su propio archivo; el resto queda como está.
4. **Coordinación:** F0 toca `src/main.js`, `src/shell.html` y `serve.mjs`, los tres archivos grandes. El dueño avisa al equipo antes.

## 11. Estética y accesibilidad

Todo lo de las reglas V4.1–V4.6, sin excepciones:

- Objetivos de 24 px o más; ningún texto bajo 10,5 px; contraste 4,5:1 en claro y oscuro; anillo de foco con `var(--focus)`.
- **Estados con texto**, no solo con color; nada se atenúa con `opacity` para decir «programada» o «falló».
- Un botón nunca va dentro de otro elemento con rol de botón: la tarjeta de una pieza tiene su título como botón y sus acciones aparte.
- Cada atajo nuevo va en la lista `KEYS` de `src/main.js` (y se ve en «?»).
- Cada ventana modal usa `modal.open/close`; cada vista, `views.add/opening`.
- Todo se prueba a **390, 1024 y 1512 px**.
- Iconos SVG propios (Instagram, Facebook, historia, reel, carrusel), monocromos con `currentColor`.

### El dock en el teléfono

Hoy el dock lleva ocho botones (Aprobaciones, Estudio, Calendario, Cerebro, Salud, Negocio, Ajustes, Panel) y a 440 px ya va justo. Dos botones más no caben: a 30 px con 3 px de separación, diez botones ocupan 330 px y sobran menos de 300. Propuesta: por debajo de 440 px, **Salud, Negocio y Ajustes pasan a un botón «⋯»** que abre un menú (`role="menu"`, teclado completo). Arriba de 440 px todo queda como está.

Atajos sugeridos, sin chocar con los actuales (E, P, G, O, N, T, `,`): **C** para Contenido, **M** para Analíticas. Se confirma al implementar.

## 12. Fases

| Fase | Qué entrega | «Hecho» cuando |
|---|---|---|
| **F0** Refactor | `calendar-core.js` sacado de `calendar.js`; el estilo por vista fuera de `shell.html`; el dock con «⋯» en el teléfono. **Sin cambio visible** | `npm run check` en verde; capturas antes/después iguales a 390, 1024 y 1512 px; los 98 puntos de la auditoría del calendario siguen cumpliéndose |
| **F1** Contenido sin Meta | Las piezas como notas; la vista Calendario de contenido con su panel; estados hasta «Aprobada»; el puente con el Estudio (incluida la protección de la papelera); `contenido-mcp` y la skill `plan-contenido`; la capa en el calendario P | Un agente escribe un borrador desde una rutina, el dueño lo edita y lo aprueba; todo probado en demo; los tests de reglas portados |
| **F2** Meta, solo lectura | Cliente de la Graph API; cuentas visibles; la vista Analíticas; fotos diarias; KPI al panel del negocio; Ajustes → Redes con el estado del token | Con el token real: se ven las cuentas, la foto diaria se guarda y las cifras coinciden con las que muestra Meta |
| **F3** Programación | La cola y el publicador; la vista Programación; **primero Facebook**, luego Instagram (post, carrusel, reel) y las historias; modo `simulacro` y modo `real`; la ventana de tolerancia; avisos y Telegram; el doble testigo | Una publicación de prueba **real** sale en una cuenta de pruebas de cada red, y una segunda vuelta del reloj no la duplica |
| **F4** Aprender | Hora sugerida; las cifras alimentan las sinapsis del Cerebro; `ver_analiticas` para los agentes; Dimitri y el resumen del lunes hablan de contenido | Un agente propone una hora respaldada por datos y lo dice |
| **F5** Después | TikTok, informes mensuales, aprobación por un cliente externo, un segundo conductor (Metricool), competencia | Solo si el dueño lo pide |

F0 y F1 no necesitan ninguna llave. F2 necesita el token de Meta. F3, además, el almacén de medios (9.2).

## 13. Riesgos y lo que no se ha comprobado

- **Nada de esta propuesta se ha probado contra Meta desde esta máquina.** Todo lo que se sabe de Meta viene de Juancito Ads, que lo vive en producción, pero con otra conexión (OAuth de la agencia). El token de usuario del sistema, los permisos exactos que pide y la subida por partes de reels desde una máquina local se verifican en F2 y F3 con una cuenta real y una publicación de prueba.
- **Copiar código crea dos copias.** Es la razón de los comentarios de procedencia y de copiar también los tests. Si algún día las dos apps deben compartir el módulo, el paso siguiente es sacarlo a un paquete; hoy no compensa (son ~1.200 líneas puras).
- **La oficina dormida.** La política de 9.3 reduce el daño; no lo quita en Instagram.
- **Perder `data/`.** El doble testigo evita duplicados; lo que se pierde es la cola (y con ella lo programado). Por eso `data/contenido/` entra en `dailyBackup` y las escrituras son atómicas (escribir a un temporal y renombrar, como hace `build.mjs`).
- **`emptyBins` y los archivos usados por una pieza.** Si se olvida la marca `usadoEn`, la papelera se llevará una imagen programada. Lleva su test.
- **Cambios de versión de la Graph API.** La versión se fija en `meta.mjs` y las métricas que Meta retire se ven como «no disponible», no como fallo total.
- **Los archivos que chocan.** F0 y el cableado tocan `serve.mjs`, `src/main.js` y `src/shell.html`. Se avisa antes.
- **El repositorio puede ser público.** Cualquier cosa nueva que se añada a `git` se revisa contra `npm run secrets`, y las piezas van en carpetas ignoradas.

## 14. Decisiones abiertas

Las cuatro primeras cambian lo que se construye; las demás están recomendadas y se cambian con una frase.

1. **Botones del dock.** Recomendado: **dos** («Contenido», con Calendario y Programación como dos modos dentro de la misma vista, y «Analíticas» aparte). Alternativas: tres botones separados, o uno solo con pestañas.
2. **Cómo llegan las imágenes a Instagram.** Recomendado: un bucket público de R2 propio de la oficina. Alternativas: un túnel, o pasar por el Worker de Juancito Ads.
3. **Si el computador duerme a la hora de publicar.** Recomendado: Facebook nativo, Instagram por reloj con una ventana de tolerancia. Alternativas: solo reloj, o un servidor.
4. **A quién pertenecen las cuentas.** Recomendado: una sola empresa (PanaClaw) con sus cuentas de Meta. Alternativa: varias marcas, con la pieza etiquetada por marca (más piezas de interfaz y de permisos).
5. **Dónde viven las piezas.** Recomendado: notas en `Agents Office/contenido/` (no viajan por GitHub) con el estado aparte. Alternativa: un JSON en `data/`, sin notas.
6. **Cómo se trae el código de Juancito Ads.** Recomendado: copiar con procedencia y tests. Alternativa: un paquete compartido.
7. **El motor del calendario.** Recomendado: `calendar-core` puro, con las capturas de antes y después. Alternativa: dejar `calendar.js` como está y hacer el de contenido aparte (más rápido hoy, dos motores para siempre).
8. **Modo por defecto.** Recomendado: `simulacro`. `real` solo cuando el dueño lo encienda.
9. **Metricool como segundo conductor.** Recomendado: solo anotado, para F5.
