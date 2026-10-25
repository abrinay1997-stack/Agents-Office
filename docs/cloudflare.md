# Agents Office en Cloudflare (fase 1)

Esta guía es para la versión **en la nube** de la oficina de PanaClaw. La oficina de siempre (la de tu computadora, con `claude -p` y tus MCP locales) **no cambia**. Lo nuevo vive en `cloudflare/` y se despliega con GitHub Actions, igual que CALENDARIOS-MARKETING-APP.

## Qué es y qué no es (todavía)

| | Local (`npm start`) | Cloudflare (`cloudflare/`) |
|---|---|---|
| Agentes | `claude -p` con tu sesión | API de Anthropic (o Meta/Muse) con la llave guardada como **secreto de Cloudflare** |
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

## Lo que sigue en la nube (Contenido y publicación)

Contenido y publicación: portar a D1 las piezas y la cola (`contenido/piezas.mjs`, `programador.mjs`, `entrega.mjs`) y el publicador de Meta (`contenido/meta-publicar.mjs`) al cron de cada minuto, como hace `worker/lib/publicador.js` en CALENDARIOS-MARKETING-APP (Facebook programado en Meta; Instagram lo publica el cron a su hora). Después: Bandeja, tareas y rutinas; y limitar el intento de acceso por IP.

## Fase 3: tareas, rutinas y calendario (25 oct 2026)

La página ya trabaja con **tus tareas de verdad en la nube**: la barra de tareas, la vista Tareas (Mías, Inicio, Lista, Tablero, Proyectos, Medidas), el calendario con sus rutinas, el roster de los 35 puestos y el .ics. Mismas rutas y mismas formas de respuesta que la oficina local (`tests/nube-paridad-tareas.test.mjs` lanza la oficina local de verdad y el Worker y compara).

**Cómo está hecho.** Las rutas de `tareas/` son las del repositorio, sin copiar: corren contra una copia en memoria de las tareas y, al terminar, el Worker vuelca a D1 solo lo que cambió, **tarea por tarea y con su versión**. Si otra petición cambió esa tarea en medio, no se pisa: se repite la petición con la copia nueva (y la bitácora de la que perdió no se escribe). Datos: tareas y rutinas son filas (`filas`: `tareas`, `rutinas`, `avisos`), el estado de las rutinas, los proyectos, las etiquetas y el roster del Cerebro/propio son documentos (`docs`), y la bitácora tiene su tabla (`tarea_bitacora`, migración 0010).

**El reloj** (cada minuto, `cadaMinuto`): una rutina que toca se vuelve una tarea (con un id que sale de la rutina y la hora, así que aunque corran dos relojes a la vez nace una sola; una atrasada sale marcada «tarde», y con `catchUp: false` se salta y avisa), lo programado para ahora pasa a la cola, y cada 10 minutos los avisos de fecha límite y de proyectos atrasados (se guardan en `filas`/`avisos`; los manda Telegram en la fase 6). **Zona horaria:** un Worker corre en UTC, y «lunes a las 9» es la hora de tu oficina; la variable `ZONA_HORARIA` (por defecto `America/Panama`) debe ser la de tu navegador, porque las ejecuciones que dibuja el calendario las calcula tu navegador.

**Los agentes (fase 4) se enchufan aquí:** `tomarSiguiente(db, { max })` decide con la cola de siempre (prioridad, fecha límite, orden, un agente a la vez, nada de lo tuyo ni de lo bloqueado) y **reserva** las tareas (`next` → `doing`, con candado de versión); `guardarEjecucion(db, base, mio)` guarda lo que hizo un agente mezclado con lo que tú cambiaste mientras. Aprobar, devolver, detener y corregir contestan 501 con su motivo hasta entonces.

**Subir tus datos (una vez):** `node scripts/migrar-a-nube.mjs <url>` sube con `scripts/migrar/tareas.mjs` tus tareas (lo que un agente estaba ejecutando vuelve a la cola), rutinas y su estado, proyectos, etiquetas, los agentes del Cerebro y los tuyos, y de la configuración solo los límites de aprobación y las personas del equipo (nunca una llave). Subir tareas **reemplaza** las del mismo id: después de mudarte, la nube es la copia de trabajo.

**Límites.** La bitácora anterior a la mudanza no sube (empieza ese día). Cada petición carga todas las tareas: 1.500 tareas de 4 KB cuestan ~160 ms de CPU (el sondeo ligero no saca de D1 el trabajo de lo archivado); necesita el plan de pago de Workers (el gratuito da ~10 ms) cuando el historial crece, y conviene archivar lo viejo. Las notas del Cerebro de «guardar como ejemplo» y de «archivar con su nota», los webhooks salientes (T6) y los avisos a una persona por Telegram quedan para las fases 4 y 6.

**Revisión de la fase 3 (25 oct 2026).** Arreglado: el volcado de tareas consulta de a 90 ids (D1 admite 100 parámetros por sentencia) y mete tareas y bitácora en **un solo lote**; toda tarea cuyo JSON cambia sube de versión (antes, un cambio que la bitácora no cuenta —orden, `seenAt`, avisos, cronómetro— no la subía y dos cambios a la vez se pisaban); cambiar lo que hace una rutina (texto, horario, agente, modelo, `needsOk`) y dejar una tarea sin pedir tu OK (`needsOk: false`) son **solo del administrador** (pausar/reanudar, de cualquiera que trabaje); el reloj **crea primero la tarea (id estable) y luego adelanta el reloj** de la rutina (`planearReloj` → tareas → `confirmarReloj`: si el Worker muere en medio, el minuto siguiente confirma sin duplicar); un conflicto que no cede tras 3 intentos es **409 «vuelve a intentarlo»**, no 500; el texto de una rutina tiene tope (4.000) y su horario solo conserva las claves que existen; los avisos con clave se consultan en una sola tanda. **La zona horaria es una sola** (`worker/lib/zona.js`, la misma para Contenido): `lib/rutas.js` la instala una vez al entrar una petición y al correr el cron (`correrReloj`); ningún módulo la instala.
**Queda pendiente (fase 3):** (a) un volcado de MÁS de ~90 tareas hace la consulta previa en varias tandas y un solo lote de escritura: la comprobación previa no es atómica con la escritura (el candado de versión de cada tarea sí), así que un choque entre ambas se detecta al escribir, pero ya quedó escrito lo de las tareas que no chocaron en ese lote; D1 corre un lote como transacción, y el 409 pide repetir. (b) El alta de una tarea todavía recalcula toda la lista en memoria (`calcularGuardado` compara cada tarea); aceptable con cientos, pesado con miles. (c) Una rutina que cambia de zona (`ZONA_HORARIA`) recalcula su próxima ejecución en la siguiente lectura.
