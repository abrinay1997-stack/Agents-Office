# Agents Office en Cloudflare (fase 1)

Esta guía es para la versión **en la nube** de la oficina de PanaClaw. La oficina de siempre (la de tu computadora, con `claude -p` y tus MCP locales) **no cambia**. Lo nuevo vive en `cloudflare/` y se despliega con GitHub Actions, igual que CALENDARIOS-MARKETING-APP.

## Qué es y qué no es (todavía)

| | Local (`npm start`) | Cloudflare (`cloudflare/`) |
|---|---|---|
| Agentes | `claude -p` con tu sesión | API de Anthropic (o Meta/Muse) con la llave guardada como **secreto de Cloudflare**; desde la fase 4 ejecutan las tareas de la cola con candados por llamada |
| Conexiones MCP | Los MCP de tu Claude Code | **Conectores MCP remotos** (URL https + token como secreto) |
| Acceso | solo tu computadora | inicio de sesión propio (PBKDF2 + cookie `__Host-`) |
| Datos | archivos en `data/` y el Cerebro | D1 (base) y R2 (archivos) |
| Oficina 3D, Estudio, Cerebro | sí | **todavía no** (fases siguientes) |
| Publicar en redes | Contenido + Meta | **fase 2** (el cron de cada minuto ya existe) |

**Por qué no se sube el servidor tal cual:** `serve.mjs` lanza procesos (`claude`) y escribe archivos; un Worker no puede. Por eso la nube es un Worker nuevo que reutiliza lo que sí es puro: el roster (`office.agents.json`) y las reglas de seguridad (`safety.mjs`).

## Cómo funcionan los MCP en la nube

Un agente en la nube no puede usar el Claude Code de tu máquina. La alternativa es el **conector MCP de la API de Anthropic**: el Worker le manda a la API la URL de un servidor MCP **remoto** y su token, y Anthropic hace las llamadas.

1. Eliges un servidor MCP remoto (Gmail, Drive, Canva, HighLevel… cualquiera que publique una URL https con OAuth/token).
2. Su **token** se guarda como secreto de GitHub con nombre `MCP_<NOMBRE>_TOKEN` (p. ej. `MCP_GMAIL_TOKEN`). El workflow lo sube a Cloudflare solo.
3. En la página (sección *Conectores MCP*) registras: nombre, URL, **el nombre** del secreto (no el token), los departamentos que lo usan y las herramientas permitidas.
4. Cada agente solo recibe los conectores de **su departamento**.

**Candados (se prueban en `cloudflare/tests/`):**
- El token nunca se guarda en D1, ni vuelve a la página, ni sale en una respuesta: solo se dice si está puesto.
- Todo está **apagado salvo la lista permitida** de herramientas.
- Una herramienta de *lectura* tiene que serlo según `safety.kindOf` («en la duda, envía»). Las de *envío* solo se habilitan en una ejecución **aprobada por un administrador**.
- Un conector no puede usar como token tus propias llaves (`ANTHROPIC_API_KEY`, `META_API_KEY`, `CLOUDFLARE_*`, `ADMIN_*`…) ni tener nombre de servidor interno.
- Solo URLs https públicas (nada de localhost ni IPs).
- Lo que devuelve el agente pasa por la detección de órdenes escondidas; cada herramienta usada queda en la tabla `auditoria`.

**Límite honesto:** los conectores de *claude.ai* (el Gmail y el Drive que ves en tu Claude) son tuyos y no se pueden reutilizar desde un servidor. Hay que apuntar a servidores MCP remotos con credenciales propias. Y la API de Meta (Muse) no tiene conector MCP: con un modelo `muse-*` el agente corre sin herramientas remotas.

## Poner todo en marcha (cuenta de Cloudflare nueva)

Todo desde el navegador; ningún paso necesita consola.

1. **Token de Cloudflare** (dash.cloudflare.com → Mi perfil → API Tokens → Create Custom Token) con permisos de cuenta: `Workers Scripts: Edit`, `D1: Edit`, `Workers R2 Storage: Edit`, `Account Settings: Read`. Copia también el **Account ID** (Workers & Pages → Account details).
2. **Secretos en GitHub** (repositorio `Agents-Office` → Settings → Secrets and variables → Actions):

| Nombre | Para qué |
|---|---|
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | desplegar (la cuenta nueva) |
| `ANTHROPIC_API_KEY` | los agentes (obligatoria) |
| `META_API_KEY` (o `MODEL_API_KEY`) | Muse, opcional |
| `META_ACCESS_TOKEN`, `META_APP_SECRET` | fase 2: publicar en Meta |
| `MCP_<NOMBRE>_TOKEN` | un token por conector MCP |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | solo para crear tu usuario (12+ caracteres) |
| `SITIO_URL` | opcional: activa la prueba viva tras cada despliegue |

   La lista completa de nombres que se suben está en `cloudflare/secretos.json` (solo nombres). Nunca pegues una llave en un archivo.
3. Mergea a `main`: corre **Cloudflare · desplegar** (tests → crea D1 y R2 → migra → despliega → sube secretos → prueba viva).
4. Lanza **Cloudflare · sembrar administrador** y después **borra `ADMIN_PASSWORD`** de los secretos.
5. Abre `https://agents-office.<tu-subdominio>.workers.dev`, entra y registra tus conectores.

Un dominio propio se añade en `wrangler.jsonc` (`routes`, `custom_domain: true`) y exige el permiso *Zone → Workers Routes → Edit* en el token; ver `DEPLOY.md` de CALENDARIOS-MARKETING-APP.

## Tests

- `node --test "cloudflare/tests/*.test.mjs"` (también dentro de `npm test`): sesión, conectores, agentes, rutas con una D1 real en memoria (`node:sqlite` + las migraciones), y comprobaciones de despliegue (CSP, secretos solo por nombre, que el módulo de entrada solo exporte el handler, que las migraciones se puedan reaplicar, que los tests corran antes de desplegar).
- `SITIO_URL=https://… node cloudflare/scripts/prueba-viva.mjs`: prueba contra lo **ya publicado** (salud, cabeceras, que `/api` pida sesión, y con `ADMIN_*` que el acceso y los conectores respondan sin filtrar tokens). El workflow la corre tras cada despliegue.
- Local de verdad: `cd cloudflare && npm i && npx wrangler d1 migrations apply agents-office-db --local && npx wrangler dev`.

## Fase 2: la interfaz real y el Cerebro en la nube (25 oct 2026)

Al entrar en `https://agents-office.<tu>.workers.dev` ya se ve **la oficina de siempre** (la misma página de `npm start`), detrás del login. El panel sencillo de conectores quedó en `/panel`. Cada despliegue construye la interfaz (`node build.mjs`) y la copia al Worker (`cloudflare/scripts/copiar-oficina.mjs`).

**Qué funciona ya con datos reales de la nube:** el Cerebro (notas, búsqueda, lector y mapa 3D). **Qué todavía contesta «no está en la nube»:** tareas, agentes en el escritorio, estado, Contenido, Estudio… (fases 3 a 8). La página no se rompe por eso: esas zonas salen vacías. `node cloudflare/scripts/inventario.mjs` dice cuántos grupos de rutas faltan.

**Mudar tu Cerebro (una vez, desde tu computadora, en PowerShell):**

1. **Copia de seguridad primero** (guarda `data/`, tus entregas y tus ajustes locales fuera del repositorio):
   `node scripts\respaldo-local.mjs`
2. **Sube las notas y el mapa** (la contraseña va solo en variables de entorno, nunca en un archivo):
   ```
   $env:AO_NUBE_EMAIL="tu-correo"; $env:AO_NUBE_CLAVE="tu-contraseña"
   node scripts\migrar-a-nube.mjs https://agents-office.abrinay1997.workers.dev
   ```
   Con `--simulacro` cuenta lo que subiría sin enviar nada. Se puede repetir: actualiza, no duplica, y no borra nada de la nube.

**Límite conocido:** el mapa 3D se calcula en tu computadora (el cálculo de fuerzas gasta más CPU de la que da un Worker del plan gratuito). Las notas nuevas que escriban los agentes en la nube aparecerán en la búsqueda y el lector, pero entran al mapa al volver a correr el paso 2, hasta que se mueva ese cálculo a un plan con más CPU (Workers de pago, ~US$5 al mes) o a una cola.

## Anuncios de Meta y la Bandeja en la nube (fase 7, 25 oct 2026)

Módulos `cloudflare/worker/modulos/anuncios.js` y `bandeja.js`. **Nada se ha probado contra Meta de verdad**: todo contra `tests/meta-stand.mjs` (el Meta de mentira), en tests y en un `wrangler dev` real con Chromium.

- **Cómo:** el código de la oficina local (`anuncios/`, `contenido/bandeja*.mjs`) corre igual en el Worker sobre un *espejo*: por petición se trae de D1 (tabla `docs`, clave `fs:<ruta>`) lo que necesita a la carpeta virtual `/tmp` de workerd y los cambios se vuelven a guardar en D1 (`worker/lib/espejo.js`, con fusión de tres vías si dos peticiones tocan lo mismo). Antes de cada escritura en Meta se guarda el paso en D1.
- **La regla del dinero, en D1:** el token de los dos clics (2 min, un solo uso, atado a tipo + id + valor) vive en `anuncios_tokens` y se consume de forma atómica (dos peticiones con el mismo token: una 200, otra 409). Las acciones llevan candado (`anuncios_candados`). Topes siempre hacia no gastar. Todo se crea en pausa. Ni los agentes ni el asistente confirman un gasto (403).
- **Crear en Meta no cabe en una petición:** la petición deja el borrador «creando» (202) y lo hace el cron de cada minuto, un candado por borrador, buscando antes cada objeto por su etiqueta `· AO:<id>` (nunca crea dos veces, también tras un corte).
- **Bandeja:** responder y ocultar solo el dueño y una vez (candado + testigo «enviando» en D1 antes de llamar a Meta); la ventana de 24 h y los 1.000 caracteres se comprueban antes de llamar.
- **El token** es `META_ACCESS_TOKEN` (+ `META_APP_SECRET`), secreto del Worker; nunca en D1, respuestas ni registros.
- **Migrar lo de tu computadora:** `node scripts/migrar/anuncios.mjs` (borradores, sugerencias, historial, bandeja; sin tokens; no pisa lo que ya está en la nube).
- **Necesita el plan de pago de Workers (Workers Paid, ~US$5 al mes).** Crear una campaña hace unas 30 llamadas a Meta (imágenes, creativos, campaña, conjunto, anuncios, y la búsqueda por etiqueta antes de cada una) en UNA ejecución del reloj; el plan gratuito corta en **50 subrequests y 10 ms de CPU por ejecución** (el panel además lee archivos de cifras grandes). Sin el plan de pago, mirar el panel y pausar funciona, pero crear campañas puede cortarse a medias. Si se corta por infraestructura, el borrador **no falla**: queda «creando», no se archiva nada y el reloj lo retoma por la etiqueta `· AO:` (hasta 5 cortes seguidos). `cloudflare/scripts/preparar-cuenta.mjs` lo avisa al preparar la cuenta.
- **Medios grandes:** la nube solo sube a Meta imágenes y videos de hasta **25 MB** (el Worker los baja enteros a memoria); uno más grande se rechaza al validar, en español, con su peso.
- **Un reloj, una creación:** el candado del reloj dura 4 min y se renueva con un latido tras cada paso; el reloj hace como mucho UNA creación por minuto.
- **Webhook de conversiones:** `POST /api/anuncios/conversiones/webhook` es público (sin sesión) y se protege con `AO_HOOK_TOKEN` (cabecera `X-Office-Token` o `Authorization: Bearer`, nunca en la dirección), cuerpo de hasta 16 KB, 60 por minuto y exige `event_id` (o usa el hash del cuerpo). Ver `lib/rutas.js`.
- **Pendiente:** el webhook de conversiones solo registra el evento y lo envía el reloj del minuto siguiente (hasta un minuto de retraso); un evento que Meta rechace queda «fallo» en el panel. Una prueba con un Meta real sigue pendiente.

## Lo que sigue en la nube (Contenido y publicación)

Contenido y publicación: portar a D1 las piezas y la cola (`contenido/piezas.mjs`, `programador.mjs`, `entrega.mjs`) y el publicador de Meta (`contenido/meta-publicar.mjs`) al cron de cada minuto, como hace `worker/lib/publicador.js` en CALENDARIOS-MARKETING-APP (Facebook programado en Meta; Instagram lo publica el cron a su hora). Después: Bandeja, tareas y rutinas; y limitar el intento de acceso por IP.

## Fase 8a: el Estudio en la nube (25 oct 2026)

`cloudflare/worker/modulos/estudio.js` (+ `worker/lib/estudio/`) contesta `/api/media/*` y `/api/voces/*` con las mismas rutas y formas que la oficina local. **La galería** son los archivos en R2 (`env.MEDIA`) con la MISMA clave de siempre (`AAAA-MM/AAAA-MM-DD <prompt> HHMMSS.<ext>`, nunca reutilizada) y su ficha en D1 (`estudio_archivos`); Contenido y Anuncios leen de R2 con esas claves. Las carpetas, lo gastado, las voces y los topes van en `docs` (`estudio.*`). **Los trabajos** son filas de D1 (`estudio_trabajos`) que se avanzan **de a un paso** en el cron de cada minuto: el que contesta en el acto (imagen) hace todo en su paso; el de cola (Higgsfield, fal, Veo, MiniMax video) guarda su id remoto antes de nada y en cada paso solo pregunta «¿ya?». Cada paso toma un permiso con caducidad; **enviar a un motor de pago no se repite**: si un paso murió a medias, el trabajo falla diciendo que puede haberse cobrado y el dueño decide si reintenta. Los motores son el mismo código que la oficina local (`media/motores-core.mjs`, `crearMotores(io)`), con R2 y los secretos del Worker en vez de disco y `process.env`.

- **Quién puede qué:** mirar, todos; carpetas, subir, favoritos, papelera y la tarjeta «Prueba» (gratis), editor y administrador; **lo que gasta** (cualquier motor real, editar, diseñar o clonar una voz) solo el administrador. Un pedido por HTTP siempre es «tú»: los agentes pedirán por las funciones del módulo cuando se porte su fase.
- **Topes:** `GET|PUT /api/media/limites` (solo en la nube; en la local es Ajustes → Estudio): día, mes, cuántos al día, cuántos a la vez, departamentos. Se revisan **antes de enviar** con el costo estimado, contando lo que sigue en marcha.
- **Dónde está el día del dueño:** `AO_ZONA` (por defecto `America/Panama`) decide el nombre de los archivos y cuándo cambia el día del presupuesto.
- **Las llaves** (`HF_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `OPENAI_API_KEY`, `META_API_KEY`/`MODEL_API_KEY`, `FAL_KEY`, `MINIMAX_API_KEY`) son secretos del Worker; nunca salen en una respuesta. Para saber cómo se activa un motor, la página dice «guarda X como secreto en GitHub y vuelve a desplegar».
- **Todavía contestan 501 (en español):** el banco de presets (`/api/media/presets*`), los lotes, las plantillas, entender un video o un audio (`understand`), «Mandar a un departamento» (necesita las tareas) y **todo lo que dependa de `sharp`** (los retoques locales y la QA: no existe en un Worker).
- **Un cambio necesario fuera del módulo:** para ver las imágenes la página pide `/media/<archivo>`, que no está bajo `/api/`. `worker/lib/rutas.js` lo manda al módulo, con sesión. **Hasta aplicarlo, las imágenes no se ven en la página.** (Probado con `wrangler dev` y Playwright con el parche puesto.)
- **Subir:** la página sube por JSON (hasta ~17 MB de archivo; un video más grande no entra por ahí). La migración sube cada archivo con `PUT /api/media/archivo/<clave>` (administrador, hasta 60 MB; más grande se queda en la computadora): `node scripts/migrar/estudio.mjs https://tu-sitio.workers.dev` (con `AO_NUBE_EMAIL`/`AO_NUBE_CLAVE`; `--simulacro` cuenta sin enviar). Las fichas, las carpetas y las voces suben también por `node scripts/migrar-a-nube.mjs`.
- **Límites que conviene saber:** la primera foto de un pedido de pago tarda hasta un minuto en empezar (la avanza el cron; los videos preguntan cada minuto o cuando la página consulta); la galería se lee entera de D1 en cada consulta (bien con miles de archivos, a vigilar con decenas de miles en el plan gratuito); la papelera conserva el archivo en R2 hasta los 30 días.
- Tests: `cloudflare/tests/estudio.test.mjs`, `estudio-migrar.test.mjs` y, del núcleo compartido, `tests/media-nucleo.test.mjs`.

## Fase 3: tareas, rutinas y calendario (25 oct 2026)

La página ya trabaja con **tus tareas de verdad en la nube**: la barra de tareas, la vista Tareas (Mías, Inicio, Lista, Tablero, Proyectos, Medidas), el calendario con sus rutinas, el roster de los 35 puestos y el .ics. Mismas rutas y mismas formas de respuesta que la oficina local (`tests/nube-paridad-tareas.test.mjs` lanza la oficina local de verdad y el Worker y compara).

**Cómo está hecho.** Las rutas de `tareas/` son las del repositorio, sin copiar: corren contra una copia en memoria de las tareas y, al terminar, el Worker vuelca a D1 solo lo que cambió, **tarea por tarea y con su versión**. Si otra petición cambió esa tarea en medio, no se pisa: se repite la petición con la copia nueva (y la bitácora de la que perdió no se escribe). Datos: tareas y rutinas son filas (`filas`: `tareas`, `rutinas`, `avisos`), el estado de las rutinas, los proyectos, las etiquetas y el roster del Cerebro/propio son documentos (`docs`), y la bitácora tiene su tabla (`tarea_bitacora`, migración 0010).

**El reloj** (cada minuto, `cadaMinuto`): una rutina que toca se vuelve una tarea (con un id que sale de la rutina y la hora, así que aunque corran dos relojes a la vez nace una sola; una atrasada sale marcada «tarde», y con `catchUp: false` se salta y avisa), lo programado para ahora pasa a la cola, y cada 10 minutos los avisos de fecha límite y de proyectos atrasados (se guardan en `filas`/`avisos`; los manda Telegram en la fase 6). **Zona horaria:** un Worker corre en UTC, y «lunes a las 9» es la hora de tu oficina; la variable `ZONA_HORARIA` (por defecto `America/Panama`) debe ser la de tu navegador, porque las ejecuciones que dibuja el calendario las calcula tu navegador.

**Los agentes (fase 4) se enchufan aquí:** `tomarSiguiente(db, { max })` decide con la cola de siempre (prioridad, fecha límite, orden, un agente a la vez, nada de lo tuyo ni de lo bloqueado) y **reserva** las tareas (`next` → `doing`, con candado de versión); `guardarEjecucion(db, base, mio)` guarda lo que hizo un agente mezclado con lo que tú cambiaste mientras. Aprobar, devolver, detener y corregir contestan 501 con su motivo hasta entonces.

**Subir tus datos (una vez):** `node scripts/migrar-a-nube.mjs <url>` sube con `scripts/migrar/tareas.mjs` tus tareas (lo que un agente estaba ejecutando vuelve a la cola), rutinas y su estado, proyectos, etiquetas, los agentes del Cerebro y los tuyos, y de la configuración solo los límites de aprobación y las personas del equipo (nunca una llave). Subir tareas **reemplaza** las del mismo id: después de mudarte, la nube es la copia de trabajo.

**Límites.** La bitácora anterior a la mudanza no sube (empieza ese día). Cada petición carga todas las tareas: 1.500 tareas de 4 KB cuestan ~160 ms de CPU (el sondeo ligero no saca de D1 el trabajo de lo archivado); necesita el plan de pago de Workers (el gratuito da ~10 ms) cuando el historial crece, y conviene archivar lo viejo. Las notas del Cerebro de «guardar como ejemplo» y de «archivar con su nota», los webhooks salientes (T6) y los avisos a una persona por Telegram quedan para las fases 4 y 6.

**Revisión de la fase 3 (25 oct 2026).** Arreglado: el volcado de tareas consulta de a 90 ids (D1 admite 100 parámetros por sentencia) y mete tareas y bitácora en **un solo lote**; toda tarea cuyo JSON cambia sube de versión (antes, un cambio que la bitácora no cuenta —orden, `seenAt`, avisos, cronómetro— no la subía y dos cambios a la vez se pisaban); cambiar lo que hace una rutina (texto, horario, agente, modelo, `needsOk`) y dejar una tarea sin pedir tu OK (`needsOk: false`) son **solo del administrador** (pausar/reanudar, de cualquiera que trabaje); el reloj **crea primero la tarea (id estable) y luego adelanta el reloj** de la rutina (`planearReloj` → tareas → `confirmarReloj`: si el Worker muere en medio, el minuto siguiente confirma sin duplicar); un conflicto que no cede tras 3 intentos es **409 «vuelve a intentarlo»**, no 500; el texto de una rutina tiene tope (4.000) y su horario solo conserva las claves que existen; los avisos con clave se consultan en una sola tanda. **La zona horaria es una sola** (`worker/lib/zona.js`, la misma para Contenido): `lib/rutas.js` la instala una vez al entrar una petición y al correr el cron (`correrReloj`); ningún módulo la instala.
**Queda pendiente (fase 3):** (a) un volcado de MÁS de ~90 tareas hace la consulta previa en varias tandas y un solo lote de escritura: la comprobación previa no es atómica con la escritura (el candado de versión de cada tarea sí), así que un choque entre ambas se detecta al escribir, pero ya quedó escrito lo de las tareas que no chocaron en ese lote; D1 corre un lote como transacción, y el 409 pide repetir. (b) El alta de una tarea todavía recalcula toda la lista en memoria (`calcularGuardado` compara cada tarea); aceptable con cientos, pesado con miles. (c) Una rutina que cambia de zona (`ZONA_HORARIA`) recalcula su próxima ejecución en la siguiente lectura.

## Fase 5: Contenido, publicación en Meta y Analíticas (25 oct 2026)

`cloudflare/worker/modulos/contenido.js` contesta las mismas rutas `/api/contenido/*` que la oficina local (piezas, aprobar con huella, cola, cuentas, publicadas, llenar la semana, plantillas, textos guardados, mejorar con IA, informe, mejor hora, Analíticas y su foto diaria, aprender de lo publicado). **No** incluye la Bandeja (`/api/contenido/bandeja*` sigue en 501: fase 7). La lógica es la misma: los núcleos puros están en la raíz (`contenido/*-core.mjs`, `*-nucleo.mjs`, `rutas-nucleo.mjs`) y la oficina local los usa también; la nube solo pone el almacenamiento (`worker/lib/contenido/`: D1, R2 y la tabla `notas`). Los tests de la oficina local siguen en verde.
- **Candados intactos:** aprueba solo un `admin` (un agente nunca); cambiar lo que sale quita el OK; la cola exige aprobada con su huella + modo + conductor listo; minuto de gracia, vencida a los 3 min, reintentos a 1, 5 y 15; «nunca dos veces» (la cola y la nota guardan el estado, el contenedor de Instagram se lee antes de publicar y lo incierto no se repite). Cada paso se apunta en D1 **antes** de llamar a Meta, y una vuelta del cron no se pisa con otra (candado en `contenido_candado`).
- **Ajustes de la nube:** `GET|PUT /api/contenido/config` (modo `simulacro` · `real` · `apagado`, conductor `metricool` · `meta`, horas de antelación, zona, página de Meta). Nace en **simulacro**.
- **Secretos:** `META_ACCESS_TOKEN` (y `META_APP_SECRET` si lo hay; `METRICOOL_*` si usas Metricool) son secretos del Worker; no entran a D1, a las respuestas ni a los logs. El freno por uso de Meta se guarda en D1.
- **Mudarse:** `node scripts/migrar-a-nube.mjs <url>` (con `scripts/migrar/contenido.mjs`) sube piezas, cola, agenda de Meta y la foto diaria; la nube las adopta la primera vez que se usa Contenido, sin pisar lo que ya tenga. **Los ajustes llegan siempre en simulacro.** Antes de pasar a «real» en la nube, pon el modo «apagado» en la computadora (Ajustes → Contenido), o lo mismo saldrá dos veces.
- **Límites y topes por invocación (revisión del 25 oct):** un Worker gratuito permite ~50 llamadas externas y ~50 consultas internas. `crearPresupuesto` (`worker/lib/contenido/presupuesto.js`) cuenta las llamadas a Meta/Metricool, **cada sentencia de D1 y cada operación de R2**, y la vuelta se corta ANTES de pasarse; lo que falta sigue en la próxima. Topes (vars de wrangler, no secretos): `CONTENIDO_MAX_LLAMADAS` (40), `CONTENIDO_MAX_CONSULTAS` (40, D1 + R2) y `CONTENIDO_MAX_ACCIONES` (6 acciones de cola por vuelta). Analíticas: una cuenta por vuelta del cron (desde las 6:00 de la oficina) y «Actualizar» no empieza una cuenta si no caben sus ~30 llamadas y ~12 sentencias. **Con `ctx.waitUntil`** (ahora `ctx.waitUntil` en los módulos; lo pone `lib/rutas.js` y `index.js` ya lo pasa) «Entregar ya», «Reintentar», «Quitar», «Comprobar conexión» y «Actualizar» contestan al instante y la vuelta sigue detrás; sin él (pruebas) se espera. (2) Instagram solo acepta JPEG: convertir PNG/WebP necesita el binding `IMAGES` (**no declarado en `wrangler.jsonc`**, pendiente del coordinador; sin él Instagram falla con un mensaje claro y Facebook y Metricool funcionan). Ahora **al aprobar** una pieza con PNG/WebP para Instagram sin ese binding sale un aviso. (3) Los archivos del Estudio viven en R2 (`2026-10/<archivo>`); `/media/…` lo pondrá la fase 8, hasta entonces las miniaturas de las tarjetas salen rotas (404).
- **Nunca dos veces (revisión):** antes de mandar a Facebook o a Metricool se apunta —y se ESPERA— `intentando`; si la respuesta no quedó apuntada, la próxima vuelta no repite: pasa a «fallo» con «mira tu página / míralo allí». Una entrega «entregando» de más de 10 min pasa igual a «fallo» con aviso (`incierto: true`), y «Reintentar» a mano la rechaza: se cambia la hora y se vuelve a aprobar. **Mientras quede algo por adoptar de la migración, la vuelta del cron y las acciones que cambian cosas esperan** (las piezas se adoptan antes que la cola). Tests: `cloudflare/tests/contenido-seguridad.test.mjs` y `contenido-revision.test.mjs`.
- **Pendiente (anotado para quien siga):** declarar `IMAGES` y `vars` (`CONTENIDO_MAX_*`) en `wrangler.jsonc`; la ruta pública firmada de medios no hace falta (Instagram usa foto temporal en Facebook y Metricool recibe los bytes); probar con Meta y Metricool reales; el contador de consultas se mira entre acciones (una acción larga puede gastar varias a la vez, por eso los defectos dejan margen); `ctx.waitUntil` no se usa en `cadaMinuto` (el cron espera por sí mismo).
- **Depende de otras fases:** «Llenar la semana» no puede crear la tarea del agente de Marketing (fase 3); aprender de lo publicado y los indicadores de Meta necesitan tareas y Negocio (fases 3 y 6); los costos del modelo (`kind: 'contenido'`) y las skills y lecciones del agente de redes, la fase 4.
- **No verificado contra Meta ni Metricool reales:** todo se probó con el Meta de mentira (`tests/meta-stand.mjs`) y el de Metricool. Con el token real: «Comprobar conexión» en Analíticas y la prueba del §17 de `docs/propuesta-contenido-y-meta.md`.
- Tests: `node --test "cloudflare/tests/contenido-*.test.mjs"` (D1 de memoria y R2 de mentira).

## Fase 4: los agentes completos en la nube (25 oct 2026)

Las tareas de la oficina **las ejecutan los agentes en la nube**, como lo hace `serve.mjs` en local: cada minuto el cron toma la siguiente tarea de la cola (`tomarSiguiente`, fase 3), la ejecuta con el agente de su puesto y guarda el resultado con el mismo candado de versión de la fase 3. Código en `cloudflare/worker/lib/agentes/` y `cloudflare/worker/modulos/agentes.js`.

**Cómo corre una tarea (por pasos).** Un Worker no espera minutos ni lanza `claude`, así que una tarea es una **corrida** (tabla `corridas`, una por tarea): cada invocación del cron la avanza varias vueltas del bucle *modelo → herramientas → modelo* (hasta 8) y guarda el avance en D1 (mensajes, lo leído, el aviso de inyección); si se acaba el presupuesto de llamadas externas o de consultas de la invocación, se corta **entre** vueltas y sigue el minuto siguiente sin repetir ninguna herramienta (una herramienta pedida pero no ejecutada queda en `datos.turno`). Hasta 3 corridas por minuto; hasta 30 vueltas por tarea. **Nunca dos pasos de la misma tarea a la vez:** el candado es un compare-and-set sobre `(candado, candado_hasta)`, caduca a los 5 minutos si el Worker muere a medias, y detener una tarea borra su corrida (el paso en vuelo pierde el candado y no escribe nada). Topes por invocación: variables de `wrangler.jsonc` `AGENTES_MAX_LLAMADAS` (60) y `AGENTES_MAX_CONSULTAS` (300), pensadas para el plan de pago; en el gratuito (50 y 50) bájalas y las tareas avanzan más despacio, no se rompen. Una tarea sencilla gasta ~50 consultas a D1 y 2 llamadas externas.

**El bucle es del Worker, con cliente MCP propio** (`mcp-cliente.js`, transporte Streamable HTTP): el conector MCP de la API de Anthropic llama por su cuenta y no se puede interceptar, así que aquí el Worker llama él mismo a cada servidor de `conectores` (el token sale de `env[secreto]`, solo viaja en la cabecera, solo https públicos, sin seguir redirecciones) y **revisa cada llamada con el guardián** (`guardian.js` → `safety.mjs`: `kindOf`, `decide`, destinatarios del borrador aprobado, `injectionIn` sobre lo que devuelve cada herramienta, topes por agente y por destino al día, servidores de la mesa, «cost» del Estudio). Cada decisión, permitida o no, queda en `auditoria_agentes` (el `data/audit` local); si no se puede apuntar, la llamada no se hace. Con Meta Muse no hay herramientas (la API no las tiene): una sola respuesta.

**Reglas del dinero (no negociables).** La herramienta de envío de un conector **solo se ofrece en una ejecución aprobada por un administrador** (modo `approve` tras su OK, o `autonomous` de una rutina que ganó su autonomía), y aun ofrecida el guardián exige que cada dirección esté en el borrador aprobado. Una tarea que intenta enviar sin OK **no se pierde**: queda esperando el OK con su borrador (`heldForOk`), como en local. **Solo un administrador** aprueba, devuelve, deshace, edita el borrador, aprueba por lote o guarda un ejemplo (403 al editor y al de solo lectura). El gasto en un motor de pago del Estudio tampoco corre antes del OK (más estricto que la local): antes solo la tarjeta de «prueba»; con el OK, el motor real y quedan en los topes del Estudio. Un secreto nunca llega a D1, a una respuesta ni al modelo (hay un test que busca cada uno en todas las tablas y en las respuestas).

**Lo que se portó:** ejecución completa (brief, skills, lecciones, cifras, ejemplos, notas del Cerebro con `knowledge.mjs`/`memory.mjs`, «mismo cliente»); aprobaciones (`aprobaciones.js`: esperar el OK, riesgo y «lo que saldrá», editar el borrador, aprobar con ventana de deshacer, devolver con corrección, recordatorio y caducidad, el importe sobre el tope siempre espera); el paso que sigue al OK; reintentos y límites de uso (`reliability.mjs`); calidad (`/api/quality`) y la revisión del jefe en lo delicado; **costos** en D1 (`/api/costs`, `.csv`, `apply`, presupuesto del mes con `stopAtBudget`); **lecciones** (el «revise: …» y el «devolver» se clasifican y quedan en `feedback.<id>`; el 👎 con motivo también); sinapsis que aprenden (`memoria`); la entrega se vuelve una nota del Cerebro; «pasar a una persona»; bloqueos; `/api/status` y `/api/notices/read`; lo que el Estudio termina después se pega en la tarea. Las herramientas internas son las **mismas definiciones y el mismo texto** que los MCP locales (`tareas-tools.mjs` y `contenido-tools.mjs` se extrajeron de `tareas-mcp.mjs` y `contenido-mcp.mjs`, que ahora solo ponen el transporte) y llaman **por función** a los módulos (`tareas`, `contenido`, `estudio`), no por HTTP a sí mismo. Lo puro compartido y probado igual en los dos lados: `costs-core.mjs`, `agente-core.mjs` (los textos de modo, pasos, instrucciones, revisión del jefe, clasificar una corrección).

**Lo que NO está (con su motivo en el propio agente):** las herramientas de Anuncios (fase 7), la Biblioteca de habilidades (`habilidades-mcp`), la Bandeja, los presets/lotes del Estudio (8b); **Agent Teams** (un equipo corre como su jefe solo, sin repartir piezas); Telegram, los KPI de una entrega y la oferta de «autonomía que se gana» (fase 6); el nivel de esfuerzo (`effort`) no se manda a la API; sin streaming (una vuelta es una llamada) ni límite de tiempo por tarea; el historial de costos local no sube (el libro empieza vacío); «mejorar con Marketing» de Contenido sigue usando `lib/ia.js` sin costos (`kind: 'contenido'`) hasta que se enchufe a `anotar`.

**Subir lo que hace que tus agentes trabajen como tú quieres** (una vez, junto con el resto): `node scripts/migrar-a-nube.mjs <url>` corre `scripts/migrar/agentes.mjs` y sube skills (las de la oficina y las de tu Cerebro), lecciones, ejemplos, cifras, las sinapsis que aprenden y las correcciones del enrutador; solo lee, nunca lleva una llave. **Sube la memoria y los docs pisando los de la nube**, así que hazlo antes de usar la nube en serio.

**Límites que conviene saber:** cada tarea lee todas las notas del Cerebro y arma su índice de búsqueda (CPU de un Worker de pago; con cientos de notas largas puede acercarse a su tope); una conversación con herramientas que crece más de ~1,5 MB se corta (D1 limita la fila); el reintento de una tarea larga empieza de cero.

**Tests:** `node --test "cloudflare/tests/agentes-*.test.mjs"` (D1 en memoria, un Anthropic de mentira y un MCP de mentira): ejecución completa, envío bloqueado sin OK y permitido tras el OK de un administrador, destinatario no aprobado, inyección, candado (3 avances y 2 relojes a la vez → una sola ejecución; candado caducado), detener a mitad, reintentos, presupuesto, límites por pasos, revisión del jefe, devolver con lección, deshacer, caducidad, secretos. Cada candado va con su caso que pasa y su caso que se bloquea, para que el test falle si alguien quita el chequeo. **Prueba en workerd real** (`unstable_startWorker` de wrangler con D1 persistente, Anthropic y MCP de mentira como servicio de salida, y Chromium): una tarea se crea desde la página, el cron la ejecuta (lee por MCP), queda «esperando tu OK» (se ve en la oficina), el administrador aprueba y el siguiente minuto envía al destinatario del borrador. **No probado contra el Anthropic real ni un servidor MCP real**: la forma de la petición sale de su documentación.

## Fase 6: Dimitri, Negocio, Ajustes, Estado, Telegram y disparadores (25 oct 2026)

Todo con las **mismas rutas y formas** que `serve.mjs`; la lógica pura se separó en núcleos que comparten la oficina local y la nube (`sub-core.mjs`, `telegram-core.mjs`, `triggers-core.mjs`, `documents-core.mjs`; los archivos de siempre los re-exportan y siguen con sus tests). Migración D1 `0050`.

- **Dimitri** (`modulos/dimitri.js`, `lib/dimitri/`): `/api/sub/*` (chat en JSON o NDJSON, estado, ops con DESHACER, ENVIAR A LOS JEFES, Estudio, archivar/recuperar, informe del lunes por el reloj). El prompt, los modos, las preguntas con opciones y la lista cerrada de ops son los de `sub-core.mjs`. La conversación es una fila por mensaje en `filas('subgerente')`; su gasto va a la tabla de costos (`tipo: 'dimitri'`). **Solo un administrador** habla con él. Nunca aprueba, envía, publica, paga ni borra, y **nunca confirma un gasto de anuncios**: una op que gasta queda «por confirmar» con la cifra; el segundo clic es del dueño en Anuncios y deja su tarjeta hecha. No hecho: el texto no se va escribiendo (llega entero), y los **lotes de fotos** del Estudio contestan 501.
- **Negocio** (`modulos/negocio.js`): `/api/business`, indicadores, `POST /api/kpi/<id>` (público, con `AO_HOOK_TOKEN`, tope de 16 KB y de 60 por minuto), las líneas `KPI x = n` de lo que los agentes terminan (por el reloj), Cifras, voz de marca, notas por revisar y «Preparar desde mi web» (con lo que cuentas; solo la dirección contesta 501: la lectura de webs aún no está). **Documentos:** CSV, texto, Markdown, JSON y HTML se convierten en la nube; PDF, Word y Excel contestan 501 con el motivo y se suben con `node cloudflare/scripts/subir-documento.mjs <url> archivo.pdf` (convierte en tu computadora y sube el texto).
- **Ajustes** (`modulos/ajustes.js`, `lib/ajustes.js`): `GET|POST /api/settings` con los campos de `settings.mjs` (los mismos), guardados en D1 y aplicados al instante; solo un administrador escribe; ninguna llave pasa por aquí (una ruta con pinta de secreto o inventada se rechaza) y cambiar un valor no se lleva el resto de su grupo. `/api/settings/telegram` guarda quién aprueba qué departamentos.
- **Estado:** `/api/health` sin sesión dice lo mínimo; con sesión es rico (`salud(ctx)` opcional por módulo, ver `cloudflare/PORTAR.md`). `/api/status` suma Telegram, disparadores y notas por revisar, y `/api/notices/read` marca los avisos.
- **Telegram** (`modulos/telegram.js`): webhook público `POST /api/telegram/webhook`. El secreto `X-Telegram-Bot-Api-Secret-Token` (`TELEGRAM_WEBHOOK_SECRET`) se comprueba en tiempo constante **antes** de abrir el cuerpo o tocar D1; después, tope por minuto, cuerpo con tope y cada `update_id` una sola vez. Solo los ids de `TELEGRAM_OWNER_ID` usan el bot (un extraño recibe su id y nada más); un aprobador delegado solo aprueba o devuelve lo de sus departamentos; los anuncios son solo del dueño, con dos toques y la cifra. Comandos: `/estado /pendientes /tarea /mias /yo /contenido /anuncios /silencio`, ✅ ↩ ↻. Los avisos salen por el reloj de cada minuto (con el no molestar; la primera vez no manda el historial). **Para conectarlo:** guarda `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_ID` y `TELEGRAM_WEBHOOK_SECRET` (16+ caracteres, letras, números, `_`, `-`) como secretos del repositorio, despliega y lanza **Actions → Cloudflare · conectar Telegram** (o `node cloudflare/scripts/telegram-webhook.mjs <url>`, también `--estado` y `--quitar`). Nunca imprime un secreto.
- **Disparadores** (`modulos/disparadores.js`): `POST /api/hook/<id>` (público): token primero, tope por minuto, disparador existente y no pausado, cuerpo ≤ 1 MB, el mismo evento una sola vez, `perHour`, y lo recibido va al agente como DATOS; si trae órdenes escondidas, la tarea espera tu OK. Fuentes `form`, `stripe`, `whatsapp`, `email`, `generic`; `GET /api/hook/<id>` contesta la verificación de WhatsApp. `GET|PUT /api/triggers` (solo un administrador escribe).
- **Mudar los datos:** `node scripts/migrar-a-nube.mjs <url>` corre además `scripts/migrar/dimitri.mjs` (la conversación) y `scripts/migrar/negocio.mjs` (indicadores, cifras, disparadores y los campos de Ajustes + aprobadores de Telegram; **nunca** una llave).
- **Tests:** `node --test "cloudflare/tests/fase6-*.test.mjs"` (Anthropic y Telegram de mentira, el Meta de mentira de la oficina para el dinero). Muerden: secreto antes que D1 en los tres webhooks, extraño/aprobador/dueño, `update_id` repetido, no gastar por Dimitri, ajustes sin secretos ni pérdida de grupo, el prompt de «Preparar desde mi web» idéntico al de `serve.mjs`.
- **Sin probar de verdad:** Telegram real (solo un Telegram de mentira), Anthropic real y el navegador contra un `wrangler dev`.

## Siguiente

Limitar el intento de acceso por IP.
