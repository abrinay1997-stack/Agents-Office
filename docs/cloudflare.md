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

## Fase 3 (siguiente)

Tareas y rutinas, la Bandeja, y limitar el intento de acceso por IP.
