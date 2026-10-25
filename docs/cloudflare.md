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

## Fase 3 (siguiente)

Contenido y publicación: portar a D1 las piezas y la cola (`contenido/piezas.mjs`, `programador.mjs`, `entrega.mjs`) y el publicador de Meta (`contenido/meta-publicar.mjs`) al cron de cada minuto, como hace `worker/lib/publicador.js` en CALENDARIOS-MARKETING-APP (Facebook programado en Meta; Instagram lo publica el cron a su hora). Después: Bandeja, tareas y rutinas; y limitar el intento de acceso por IP.

## Fase 8a: el Estudio en la nube (25 oct 2026)

`cloudflare/worker/modulos/estudio.js` (+ `worker/lib/estudio/`) contesta `/api/media/*` y `/api/voces/*` con las mismas rutas y formas que la oficina local. **La galería** son los archivos en R2 (`env.MEDIA`) con la MISMA clave de siempre (`AAAA-MM/AAAA-MM-DD <prompt> HHMMSS.<ext>`, nunca reutilizada) y su ficha en D1 (`estudio_archivos`); Contenido y Anuncios leen de R2 con esas claves. Las carpetas, lo gastado, las voces y los topes van en `docs` (`estudio.*`). **Los trabajos** son filas de D1 (`estudio_trabajos`) que se avanzan **de a un paso** en el cron de cada minuto: el que contesta en el acto (imagen) hace todo en su paso; el de cola (Higgsfield, fal, Veo, MiniMax video) guarda su id remoto antes de nada y en cada paso solo pregunta «¿ya?». Cada paso toma un permiso con caducidad; **enviar a un motor de pago no se repite**: si un paso murió a medias, el trabajo falla diciendo que puede haberse cobrado y el dueño decide si reintenta. Los motores son el mismo código que la oficina local (`media/motores-core.mjs`, `crearMotores(io)`), con R2 y los secretos del Worker en vez de disco y `process.env`.

- **Quién puede qué:** mirar, todos; carpetas, subir, favoritos, papelera y la tarjeta «Prueba» (gratis), editor y administrador; **lo que gasta** (cualquier motor real, editar, diseñar o clonar una voz) solo el administrador. Un pedido por HTTP siempre es «tú»: los agentes pedirán por las funciones del módulo cuando se porte su fase.
- **Topes:** `GET|PUT /api/media/limites` (solo en la nube; en la local es Ajustes → Estudio): día, mes, cuántos al día, cuántos a la vez, departamentos. Se revisan **antes de enviar** con el costo estimado, contando lo que sigue en marcha.
- **Dónde está el día del dueño:** `AO_ZONA` (por defecto `America/Panama`) decide el nombre de los archivos y cuándo cambia el día del presupuesto.
- **Las llaves** (`HF_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `OPENAI_API_KEY`, `META_API_KEY`/`MODEL_API_KEY`, `FAL_KEY`, `MINIMAX_API_KEY`) son secretos del Worker; nunca salen en una respuesta. Para saber cómo se activa un motor, la página dice «guarda X como secreto en GitHub y vuelve a desplegar».
- **Todavía contestan 501 (en español):** el banco de presets (`/api/media/presets*`), los lotes, las plantillas, entender un video o un audio (`understand`), «Mandar a un departamento» (necesita las tareas) y **todo lo que dependa de `sharp`** (los retoques locales y la QA: no existe en un Worker).
- **Un cambio necesario fuera del módulo:** para ver las imágenes la página pide `/media/<archivo>`, que no está bajo `/api/`. `cloudflare/parches/estudio-media-rutas.patch` (5 líneas en `worker/lib/rutas.js`) lo manda al módulo, con sesión. **Hasta aplicarlo, las imágenes no se ven en la página.** (Probado con `wrangler dev` y Playwright con el parche puesto.)
- **Subir:** la página sube por JSON (hasta ~17 MB de archivo; un video más grande no entra por ahí). La migración sube cada archivo con `PUT /api/media/archivo/<clave>` (administrador, hasta 60 MB; más grande se queda en la computadora): `node scripts/migrar/estudio.mjs https://tu-sitio.workers.dev` (con `AO_NUBE_EMAIL`/`AO_NUBE_CLAVE`; `--simulacro` cuenta sin enviar). Las fichas, las carpetas y las voces suben también por `node scripts/migrar-a-nube.mjs`.
- **Límites que conviene saber:** la primera foto de un pedido de pago tarda hasta un minuto en empezar (la avanza el cron; los videos preguntan cada minuto o cuando la página consulta); la galería se lee entera de D1 en cada consulta (bien con miles de archivos, a vigilar con decenas de miles en el plan gratuito); la papelera conserva el archivo en R2 hasta los 30 días.
- Tests: `cloudflare/tests/estudio.test.mjs`, `estudio-migrar.test.mjs` y, del núcleo compartido, `tests/media-nucleo.test.mjs`.
