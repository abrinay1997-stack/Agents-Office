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

## Anuncios de Meta y la Bandeja en la nube (fase 7, 25 oct 2026)

Módulos `cloudflare/worker/modulos/anuncios.js` y `bandeja.js`. **Nada se ha probado contra Meta de verdad**: todo contra `tests/meta-stand.mjs` (el Meta de mentira), en tests y en un `wrangler dev` real con Chromium.

- **Cómo:** el código de la oficina local (`anuncios/`, `contenido/bandeja*.mjs`) corre igual en el Worker sobre un *espejo*: por petición se trae de D1 (tabla `docs`, clave `fs:<ruta>`) lo que necesita a la carpeta virtual `/tmp` de workerd y los cambios se vuelven a guardar en D1 (`worker/lib/espejo.js`, con fusión de tres vías si dos peticiones tocan lo mismo). Antes de cada escritura en Meta se guarda el paso en D1.
- **La regla del dinero, en D1:** el token de los dos clics (2 min, un solo uso, atado a tipo + id + valor) vive en `anuncios_tokens` y se consume de forma atómica (dos peticiones con el mismo token: una 200, otra 409). Las acciones llevan candado (`anuncios_candados`). Topes siempre hacia no gastar. Todo se crea en pausa. Ni los agentes ni el asistente confirman un gasto (403).
- **Crear en Meta no cabe en una petición:** la petición deja el borrador «creando» (202) y lo hace el cron de cada minuto, un candado por borrador, buscando antes cada objeto por su etiqueta `· AO:<id>` (nunca crea dos veces, también tras un corte).
- **Bandeja:** responder y ocultar solo el dueño y una vez (candado + testigo «enviando» en D1 antes de llamar a Meta); la ventana de 24 h y los 1.000 caracteres se comprueban antes de llamar.
- **El token** es `META_ACCESS_TOKEN` (+ `META_APP_SECRET`), secreto del Worker; nunca en D1, respuestas ni registros.
- **Migrar lo de tu computadora:** `node scripts/migrar/anuncios.mjs` (borradores, sugerencias, historial, bandeja; sin tokens; no pisa lo que ya está en la nube).
- **Límites:** crear una campaña hace ~30 llamadas a Meta: necesita **Workers de pago** (el plan gratuito da 50 por petición). Falta una ruta pública en `rutas.js` para el webhook de conversiones (`webhookConversiones`) y la ruta `/media/…` de la fase 8.

## Fase 3 (siguiente)

Contenido y publicación: portar a D1 las piezas y la cola (`contenido/piezas.mjs`, `programador.mjs`, `entrega.mjs`) y el publicador de Meta (`contenido/meta-publicar.mjs`) al cron de cada minuto, como hace `worker/lib/publicador.js` en CALENDARIOS-MARKETING-APP (Facebook programado en Meta; Instagram lo publica el cron a su hora). Después: Bandeja, tareas y rutinas; y limitar el intento de acceso por IP.
