# Cómo se porta un módulo de la oficina a Cloudflare

Lee antes `docs/plan-cloudflare-completo.md`, `docs/cloudflare.md` y la sección «Agents Office en Cloudflare» de `CLAUDE.md`. Esta guía es el contrato de **una fase**. Responde siempre en español (código en inglés o español como el del módulo; comentarios en español).

## El objetivo
La oficina local (`serve.mjs` y sus módulos) sigue funcionando igual. En la nube, **la misma interfaz** (`dist/command-centre-v2.html`, que NO se toca salvo que sea imprescindible) habla con **las mismas rutas `/api/...` con las mismas formas de respuesta**, pero el servidor es un Worker de Cloudflare. Tu fase es portar UN conjunto de rutas y la lógica que las sustenta.

## Lo que un Worker NO tiene (y su sustituto)
| En la oficina local | En el Worker |
|---|---|
| `fs` / archivos de `data/` | `worker/lib/almacen.js` (`docs`, `filas`) o tablas propias en D1; archivos grandes en R2 (`env.MEDIA`) |
| `spawn('claude')` | `worker/lib/ia.js` (`texto()`) para redactar una vez; **los agentes con herramientas ya corren en la nube (fase 4, `worker/lib/agentes/`)**: una tarea es una corrida por pasos, ver «Si tu módulo quiere que los agentes lo usen» |
| `setInterval` / relojes de `serve.mjs` | `export async function cadaMinuto(env)` del módulo (cron cada minuto; mira la hora dentro) |
| `fetch` a Meta con freno y estado en memoria | lo mismo, pero el estado en D1 (el Worker no recuerda nada entre peticiones) |
| `process.env.X` | `env.X` (secretos del Worker; si es nuevo, declararlo en `cloudflare/secretos.json`) |
| `crypto` de Node | WebCrypto (`crypto.subtle`, `crypto.randomUUID`); `node:crypto` existe pero evítalo |
| Procesos largos | Una petición no puede esperar minutos: trabajo largo → por pasos, guardando el avance en D1 y avanzando en cada cron o en cada consulta de la página |

CPU: el plan gratuito da ~10 ms de CPU por petición; el de pago, 30 s. **No hagas cálculos pesados en una petición** (por eso el mapa del Cerebro se calcula fuera). Si algo necesita CPU, déjalo para el cron en pasos pequeños o dilo en tu informe.

## El módulo
1. `cloudflare/worker/modulos/<nombre>.js` exporta `nombre`, `grupos` (los `/api/<grupo>` que contesta), `manejar(ctx)` (devuelve `Response` o `null` si la ruta no es suya) y, si hace falta, `cadaMinuto(env)`. `ctx = { req, env, db, usuario, url, ruta, json, error, prohibido, cuerpo, uuid, ahora }`. **El usuario ya está autenticado**; los permisos finos (rol `admin` · `editor` · `lectura`) los compruebas tú.
2. Regístralo con UNA línea en `cloudflare/worker/modulos/index.js` (import + entrada en `MODULOS`). **No edites** `rutas.js`, `index.js`, `paginas.js` ni `wrangler.jsonc`; si crees que hace falta, dilo en tu informe.
3. Lo **puro** de la oficina local (reglas, validaciones, formateo, cálculo) se IMPORTA desde la raíz del repo (`import { … } from '../../../<archivo>.mjs'`), no se copia. Si un módulo local mezcla lógica pura con `fs`, sepáralo: la parte pura a un archivo nuevo (como `graph-core.mjs`), que el original importa; **demuestra con un test que el comportamiento local no cambió**. Todo lo importado desde el Worker debe correr SIN `node_modules` y sin `fs`/`child_process` (el CI del Worker no instala las dependencias de la raíz).
4. Migraciones D1: solo en tu rango, con `if not exists`: **tareas/rutinas/calendario 0010–0019 · contenido y publicación 0020–0029 · anuncios y Bandeja 0030–0039 · Estudio 0040–0049 · Dimitri/Negocio/Ajustes/Telegram 0050–0059 · agentes completos 0060–0069**. Para guardar JSON simple usa `almacen.js` (sin migración).
5. **Datos del dueño**: crea `scripts/migrar/<modulo>.mjs` con `exportar({ raiz, vault })` → `{ filas: { coleccion: [{ id, valor, orden? }] }, docs: { clave: valor } }` que lee lo local (ver `scripts/migrar/README.md`) y NUNCA incluye llaves, contraseñas ni tokens. Los endpoints `/api/migrar/filas|docs` ya existen. Prueba el exportador con una carpeta temporal.
6. Añade tus grupos al inventario: se calcula solo desde `grupos` (dos módulos no pueden poseer el mismo grupo; unas rutas dentro de un grupo ajeno van como `rutasExtra`, ver `tests/modulos.test.mjs`) (`node cloudflare/scripts/inventario.mjs`).

## Si tu módulo quiere que los agentes lo usen (fase 4)
Los agentes de la nube llaman a las herramientas internas **por función**, sin HTTP a sí mismos: `lib/agentes/herramientas.js` arma un `Request` sintético y lo pasa por el `manejar(ctx)` de tu módulo (con el rol `editor`, nunca `admin`: un agente no aprueba). Por eso las reglas de tu módulo («solo un administrador aprueba/publica/gasta», `por: 'agente'` → borrador) valen también para ellos. Para exponer herramientas: (1) pon las definiciones y el texto en un `<modulo>-tools.mjs` puro de la raíz con `TOOLS` y `crearLlamador({ office, agente, tarea })` (mira `tareas-tools.mjs`), el MCP local solo le pone el transporte; (2) enchúfalo en `herramientasInternas`; (3) **ninguna herramienta puede aprobar, programar, publicar, pagar ni borrar** (los tests de `tests/*-mcp.test.mjs` lo vigilan) y un servidor nuevo va en `INTERNAL` de `safety.mjs` solo si de verdad no envía. Lo que un módulo necesita del reloj de los agentes: `tomarSiguiente(db, { max })` y `guardarEjecucion(db, base, mio)` (fase 3) y, para sus avisos, `s.avisar(...)` de la sesión de tareas.

## Reglas de seguridad (no negociables)
- **Nada que gaste, envíe, publique, pague o borre fuera de la oficina sin el clic/OK del dueño** (rol `admin`, nunca un agente ni una llamada con `por: 'agente'`). Reutiliza las reglas existentes (`safety.mjs`, topes, `huella` de aprobaciones, el «un solo OK, una sola vez») tal como están documentadas en `CLAUDE.md`.
- Ningún secreto en archivos, ni en respuestas, ni en logs, ni en errores. Un token de Meta/Telegram/etc. solo vive en `env.*`.
- Toda entrada de la página se valida (tipos, largos, nombres de colección/clave con lista blanca); nada de SQL armado con texto del usuario: **siempre `bind()`**.
- Lo que lee un agente de fuera (correos, comentarios, hojas) pasa por `injectionIn` como en local.
- Un fallo se contesta en español, sin el cuerpo crudo del proveedor ni stack traces.

## Cómo se prueba (definición de «terminado»)
1. `node --test "cloudflare/tests/*.test.mjs"` y los tests de raíz que toques, en verde, **también sin `node_modules` en la raíz** y en Node 20 (los tests con D1 usan `node:sqlite` y se saltan solos en Node 20; mira `tests/d1-memoria.mjs`).
2. Tests propios en `cloudflare/tests/<modulo>.test.mjs` con la D1 de memoria (migraciones reales): casos felices, permisos (editor/lectura/agente → 403), validaciones, idempotencia, y **la forma de la respuesta idéntica a la local** (compara las claves con lo que devuelve `serve.mjs`/el módulo local para la misma entrada).
3. `cd cloudflare && npx wrangler deploy --dry-run --outdir <tmp>` compila.
4. **Prueba real**: `cd cloudflare && npx wrangler d1 migrations apply agents-office-db --local`, siembra un admin (`ADMIN_EMAIL=… ADMIN_PASSWORD=… node scripts/sembrar-admin.mjs --local`), `npx wrangler dev --port <libre>`, sube datos de prueba y abre la página con Playwright (`require('playwright')` ya está instalado; ver el patrón en `docs/cloudflare.md` y en las pruebas de la fase 2): entra, abre TU vista, toma capturas y **míralas**. Anota qué rutas siguen devolviendo 501 desde esa vista.
5. `node scripts/secrets-scan.mjs --all` limpio. Nada de `dist/command-centre-v2.html` ni `src/braingraph.js` en tu commit (se regeneran solos): `git checkout -- dist/command-centre-v2.html src/braingraph.js` antes de commitear.
6. Commits en español que digan qué y por qué; actualiza `docs/cloudflare.md` (una sección corta) y el avance en `docs/plan-cloudflare-completo.md`.

## Qué entregas al terminar
Un informe corto: qué rutas portaste (y cuáles NO, con el motivo), qué decidiste y por qué, qué límites tiene (CPU, tamaño, lo que sigue local), los tests que añadiste, lo que viste en la prueba real, y todo lo que no pudiste verificar. **No inventes que algo funciona: si no lo probaste, dilo.**

## La hora de la oficina (zona) — UNA sola implementación

`cloudflare/worker/lib/zona.js` es la única. Un Worker corre en UTC y las reglas compartidas con la oficina local usan la hora «local» (`new Date('2026-10-30T09:00')`, `getHours()`, `setDate()`…). **No instales la zona en tu módulo:** `lib/rutas.js` la instala UNA vez (`instalarZona(env.ZONA_HORARIA)`) al entrar cualquier petición y al correr el cron (`correrReloj`, que llama a cada `cadaMinuto`); `worker/index.js` sigue exportando solo el handler. Dos APIs, la misma clase por debajo:
- **Reloj explícito** (no toca nada global): `desfaseMin(zona, ms)` · `componentes(zona, ms)` · `instanteDe(zona, y, mo, d, h, mi, s, ms)` · `instanteDeTexto(zona, 'AAAA-MM-DD[T ]HH:MM')` · `describirZona(zona)` · `zonaValida(z)` · `crearDateDeZona(zona)` · `ZONA_POR_DEFECTO`.
- **Parche global** (`Date` es un Proxy de la clase: `Date()` sin `new`, `instanceof` y `Date.parse` siguen funcionando; `Date.parse('2026-10-26 09:00')` y el texto sin zona se leen en la zona de la oficina): `instalarZona(zona)` · `conZona(zona, fn)` (acotado; respeta un parche ya instalado) · `quitarZona()` (pruebas) · `zonaActual()` · `desfase(ms)` · `DateReal`.

## Rutas públicas y estado de salud (fase 6)
- **`publica({ req, env, db, url, ruta, exec })`** (opcional en un módulo): atiende una ruta SIN sesión. Solo llegan a ella los prefijos de `RUTAS_PUBLICAS` en `lib/rutas.js` (`/api/hook/`, `/api/telegram/`, `/api/kpi/`; sumar uno es una decisión de seguridad con su test en `fase6-rutas.test.mjs`). Reglas: el secreto del sistema que llama se comprueba en tiempo constante (`lib/publica.js` → `tokenValido`) **antes** de leer el cuerpo o tocar D1; luego tope por minuto (`tasaPublica`), cuerpo con tope (`leerConTope`), idempotencia y recién entonces el trabajo. Un módulo sin `publica` no se entera. El Origin no se mira (otra web los llama).
- **`salud(ctx)`** (opcional): devuelve `{ health?, checks? }` y lo suma `/api/health` (con sesión) y `/api/status`. Cada check es `{ id, label, state: ok|info|warn|bad, detail, fix }`; nunca un secreto.
