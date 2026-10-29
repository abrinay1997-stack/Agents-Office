# Auditoría despiadada y plan de mejoras (29 oct 2026)

Pedido del dueño: auditar toda la oficina sin perdonar nada, decir cuáles son sus limitaciones más urgentes y **escribir el plan completo antes de implementar**. Principio rector: **no añadir herramientas nuevas; mejorar, optimizar y completar las que ya hay.**

Cómo se hizo: seis auditores en paralelo, de solo lectura, sobre `main` (commit `1640324`), uno por frente: Dimitri y las vistas · Estudio (galería, carpetas, referencias, banco, lotes) · publicación, cola y editor · rendimiento · íconos y conectores · seguridad y UX/UI. Yo (el coordinador) comprobé en el código cuatro de las afirmaciones más graves (marcadas ✔ abajo). **Nada se ejecutó en un navegador ni contra la nube real**: lo que dice «deducido» sale de leer el código, y lo que dice «NV» no se pudo verificar. Antes de implementar cada punto, el que lo haga debe reproducirlo.

## 0. Resumen para decidir

| # | Limitación | Gravedad | Dónde | Esfuerzo |
|---|---|---|---|---|
| 1 | Carpetas del Estudio planas: no hay carpetas dentro de carpetas, ni navegar, ni migas | **Alta** (urgente para el dueño) | EST-01 | M-L |
| 2 | Imágenes «que no se pueden eliminar»: el servidor sí dice por qué (409 + piezas) pero la pantalla lo tira | **Alta** | EST-08..11 | S-M |
| 3 | Referencias: recorte **silencioso** a 4 o 6 con números distintos en 6 sitios; carruseles y lotes pierden referencias sin aviso | **Alta** | EST-05..07 | M |
| 4 | «Publicar ya» tarda 5-7 min: `PRONTO_MIN=5` ✔ + 60 s de gracia + relojes de 30-60 s | **Alta** | CON-04/05 | M-L |
| 5 | La nube no convierte imágenes a JPG: falta el binding `IMAGES` ✔ (`wrangler.jsonc` solo declara R2) | **Alta** | CON-01..03 | S + M |
| 6 | Dimitri: ancho fijo, no se redimensiona, no se pliega, no se amplía; y en Estudio con compositor + banco la galería queda en ~46-192 px | **Alta** | DIM-01/02/07 | M-L |
| 7 | Banco de presets, lotes y entender video **no existen en la nube** (501) | **Alta** | EST-12..16 | M-L por fases |
| 8 | La vista previa de la pieza se encoge con `zoom` hasta 0,4× ✔ y arrastra las pestañas Feed/Perfil/Facebook | **Alta** | CON-06 | M |
| 9 | Programación y Bandeja lentas: sondeo de 3 peticiones cada 20 s; en la nube, la Bandeja materializa 4 archivos y los compara **en cada petición** | **Alta** | CON-09..12 | M |
| 10 | «Hoy / Mañana / viernes 31 sin hora»: cuatro generadores de etiquetas con reglas distintas; las tareas sin hora flotan por prioridad | **Alta** | CON-08, UX-04 | S |
| 11 | Íconos de conectores: tres sistemas distintos (WebP en escritorio, pictogramas propios en nube/móvil, monogramas); el mismo Gmail se ve distinto | Media-alta | ICO-01..11 | M |
| 12 | Rendimiento: página de 2,20 MB (tope 2,2 MB, margen 3 KB), 1,88 MB de JS; miniaturas = originales; paquetes sin caché larga | Media-alta | PER-01..11 | S → L |
| 13 | Seguridad: `/api/chat` sin tope por persona; detector de inyección de 8 regex; workflows sin `permissions`; `Origin: null` aceptado en local | Alta/Media | SEG-01..09 | S |
| 14 | **Comunicación del equipo** (pedido del dueño, 29 oct): no hay chat en vivo, ni recados para cuando alguien entre, ni centro de notificaciones por persona; Telegram solo conoce al dueño y a los aprobadores, no a las cuentas | **Alta** (pedido) | §3.10, Fase 8 | L (por fases) |
| 15 | La línea de arriba del chat de Dimitri («IA: … · gasto del mes … · solo conversa») sale **siempre**, aunque no haya nada que avisar | Media (pedido) | UX-11, Fase 0 | S |
| 16 | **Vanguardia frente a otros agentes** (Muse de Meta, ChatGPT, Grok, Claude, Gemini, Copilot…): lo que hacen, dónde fallan y qué construir para superarlos | Estratégica | §3.11, Fase 9 | por fases |

## 1. Hallazgos por frente

### 1.1 Dimitri y las vistas (DIM)

Hecho verificado (auditor): el ancho es CSS puro, `--subW:min(440px,34vw)` y `min-width:340px` (`src/css/dimitri.css:3-4`); la lista completa de vistas que se corren con él es `#studioOv,#calOv,#ctOv,#anOv,#brainOv,#tvOv,#anuOv` (`dimitri.css:6-8`). No hay estado, arrastre, plegado ni pantalla completa. La fórmula está **duplicada** en JS (`src/main.js:972` `chatLeft()`), que centra la oficina 3D.

- **DIM-01 · Alta · Estudio con Dimitri + compositor + banco B.** Los tres paneles se miden contra la **ventana**, no contra la vista (`studio-paneles.js:14-29`, `estudio.css:245-249`, `DESDE=1100` con `innerWidth`). Cuentas deducidas: a 1512 la galería queda ≈192 px; a 1366, ≈46 px; entre 1100 y 1300 el banco desborda sobre el compositor. Además el compositor se puede ensanchar a 760 con Dimitri abierto sin que nada lo limite.
- **DIM-02 · Alta.** El escenario 3D (vive en el banco), el visor y Lotes sufren lo mismo; los breakpoints de `shell.html:1455` y `:2091` miran la ventana.
- **DIM-03 · Media.** Calendario, Contenido, Analíticas, Anuncios y Tareas ya usan container queries y aguantan; justas a 1024 (vista de 676). Un Dimitri ensanchado las dejaría en modo estrecho: debe ser consciente.
- **DIM-04 · Media.** Cerebro 3D: `.bv-top{max-width:62vw}` mide la ventana; `.bv-side` fijo de 288 px más el panel de nota casi no dejan lienzo a 1024.
- **DIM-05 · Media.** `chatLeft()` duplica la fórmula: con ancho variable la oficina 3D se descentra.
- **DIM-06 · Baja.** Negocio y Ajustes son modales z95 que tapan a Dimitri; coherente.
- **DIM-07 · Alta (pedido del dueño).** Dimitri no se redimensiona, no se pliega, no se amplía.
- **DIM-08 · Media.** Tablet 900-1100 px: ya hay solo 560-750 px de vista; el máximo del arrastre debe ser `min(760, ventana − 480)`.
- **DIM-09 · Media.** El contexto «Viendo» es pobre: `{view,label,kind,id}`, `label` a 160 y `id` a 300 caracteres, sin los ids de una selección múltiple ni filtros/pestaña.
- **DIM-10 · Media.** Dimitri **sí** ve conectores y usa herramientas de **lectura** (`ver_conectores`, `ver_herramientas_conector`, `usar_conector`: ≤3 conectores, ≤6 llamadas); no escribe/envía (por diseño). No puede cambiar de vista ni abrirla («ábreme el calendario en la semana X»).
- **DIM-11 · Baja.** Margen del prompt: el test dice <16.000 pero está cerca de 19.000 (`tests/sub-conversacion.test.mjs:115`), quedan ~800 caracteres; cualquier mejora de contexto obliga a mover cosas fuera de la parte fija.
- **DIM-12/13 · Baja.** Latencia (hasta 6 llamadas al modelo por turno), sin timeout visible en la nube (NV), memoria sin cruce entre conversaciones salvo `hilo` y Cerebro.
- **DIM-14 · Baja.** El separador nuevo no debe chocar con atajos de una letra (usar `stopPropagation` como en `studio-paneles.js`).

### 1.2 Estudio: galería, carpetas, referencias, borrado, banco y lotes (EST)

**Carpetas.** Local: `media/galeria.mjs:46-80`, lista plana `{id,name,at}` en `<media>/folders.json`; nombre único **global** (✔ `:60`), tope 200 (✔ `:61`); `removeFolder` deja los archivos «sin carpeta». Nube: `cloudflare/worker/lib/estudio/galeria.js:86-127`, un único documento D1 `estudio.carpetas` y `folder` dentro del JSON de cada ficha; `query` carga **todas** las fichas en cada página (`:135-137`). Filtro: `src/galeria-filtro.js:26-30` compara igualdad estricta (sin descendientes). UI: `src/studio.js:1410+` (tira plana), móvil `src/movil/vistas/estudio-carpetas.js`.

- **EST-01 · Alta.** Sin jerarquía, sin orden, sin migas, sin conteo recursivo. Diseño en §3.1.
- **EST-02 · Media.** La nube relee todo el Estudio en cada lectura.
- **EST-03 · Baja.** Un lote o agente nunca reutiliza su carpeta (un «Lote <fecha>» por tanda, `lotes.mjs:243`; Dimitri la busca por nombre, `serve.mjs:1123`).
- **EST-04 · Media.** Cada creación o renombre reescribe el documento entero de carpetas en la nube (riesgo de carrera; control de versión de `mutarDoc` NV).

**Referencias.** Tope por modelo = `capsOf(m).maxRefs` (`media/catalogo.mjs:500`): Nano Banana 2 → 14; GPT Image y Seedream 4 → 4; Nano Banana 2.5 y fal → 3; Higgsfield y prueba → 8; Flux Kontext → 1.

- **EST-05 · Alta.** Recortes dispersos con números distintos: `presets-core.js:775-778` (con aviso «van las primeras»), `estudio-plan.mjs:139` y `estudio-lote.mjs:162` (`slice(0,4)` ✔, sin aviso), `lotes.mjs:196` (`slice(0,6)` ✔, sin aviso), `media/motores-core.mjs:30` (silencioso en el motor). No hay una función única ni validación del máximo en `submit` (NV).
- **EST-06 · Alta.** El recorte es silencioso en carruseles y lotes; ni el aviso del preset dice **cuáles** se descartaron.
- **EST-07 · Media.** Sin prioridad por rol: solo orden de llegada.

**Borrado y uso.**

- **EST-08 · Alta.** El servidor devuelve 409 con el motivo y `piezas:[{id,titulo,fecha}]` (`serve.mjs:3104`; `cloudflare/worker/modulos/estudio.js:184-185`), pero `trashMany` (`src/studio.js:1400-1405`) cuenta fallos y descarta `e.message` y `piezas`. El dueño ve «No se pudo mover… a la papelera» sin motivo.
- **EST-09 · Media.** `usos()` (`contenido/piezas.mjs:129`) cuenta toda pieza que lista el medio, también publicada o archivada vieja (correcto, pero invisible). **Los anuncios y otros módulos no consultan `usos`**: el borrado no los protege (falso negativo). Falta normalizar el id (`validoId`).
- **EST-10 · Media.** No hay vista de «dónde se usa» ni insignia, ni filtro «En uso», ni «quitar de la pieza y borrar».
- **EST-11 · Baja.** El borrado en lote es un DELETE por archivo en serie; en la nube cada uno hace un `LIKE` sobre las piezas.

**Banco de presets, lotes, entender video en la nube.**

- **EST-12 · Alta (confirmado).** `cloudflare/worker/modulos/estudio.js:22-29` (`NO_ESTA`) y `:92` devuelven 501 para presets, lotes, plantillas, entender video y «mandar a un departamento». El front (`src/studio-banco.js:211,403,537`) llama a `/api/media/presets*` y por eso «no tiene el banco».
- **EST-13 · Alta.** Es portable: el compilador `src/presets-core.js` (1053 líneas) y `presets-buscar.js`/`escena3d-core.js` son puros; la fábrica `presets/` pesa 584 KB y cabe empaquetada. `presets.mjs` (servidor) depende de `node:fs`, `sharp`, notas del Cerebro local: hay que escribir `cloudflare/worker/lib/estudio/presets.js`. Lo que usa `sharp` (`ejecutor:'local'`) hay que sustituirlo (ver §3.4).
- **EST-14 · Media.** Fases propuestas: compilar sin gastar → aplicar sobre `trabajos.pedir` → presets propios en D1 → ejecutor local con Cloudflare Images/WASM → plantillas y entender video.
- **EST-15 · Media.** Límites locales de lotes: `max:100`, concurrencia 2, `agenteSinOk:10`/US$2, muestra de 3 desde 10 filas (`lotes.mjs:44`); sube de hasta 40 MB por foto.
- **EST-16 · Alta.** En la nube no hay lotes ni hoja Excel; si se portan, el bucle de 100 filas debe ir por cron y por pasos (128 MB, 30 s de CPU, 50 subpeticiones en plan gratis).
- **EST-17 · Media.** Con muchas fotos (local): refs recortadas en silencio, una carpeta plana por tanda, `query`/conteos que recorren todo.

### 1.3 Contenido: publicar, cola, editor, Programación y Bandeja (CON)

- **CON-01 · Alta ✔.** `cloudflare/wrangler.jsonc` solo declara R2 `MEDIA`; **no hay binding `IMAGES`**. `cloudflare/worker/lib/contenido/conductores.js:37-46` (`aJpegDeEnv`) lanza «Instagram solo acepta JPEG… falta el binding IMAGES» para todo lo que no sea JPG. En local sí convierte (`serve.mjs:298`, sharp). Se convierte solo **al entregar**, y el aviso al aprobar solo cubre `.png|.webp` (`modulos/contenido.js:103-106`; GIF, HEIC, AVIF no avisan).
- **CON-02 · Alta.** `MEDIO_RE = png|jpe?g|webp|svg|mp4|webm` (`contenido/piezas.mjs:26` y `cloudflare/worker/lib/contenido/piezas.js:9`): GIF, HEIC, AVIF y MOV quedan fuera de Contenido. SVG pasa la lista y es una trampa (Meta no lo acepta). Facebook sube los bytes tal cual: un WebP/AVIF depende de lo que Meta acepte (NV). `esJPEG` (`src/contenido-reglas.js:121`) solo nombra «PNG o WebP».
- **CON-03 · Media.** `contenido-reglas.js:406` promete «al programar se ajusta sola» solo cuando `navegador` es true; en servidor la proporción es un **error bloqueante** («Recórtala en el Estudio…»). No hay `canvas`/`toBlob` en `src/` (NV).
- **CON-04 · Alta ✔.** Cadena de esperas: `PRONTO_MIN = 5` (`contenido/piezas-core.mjs:178`) + `GRACIA_MS = 60e3` + relojes (local `tick` 60 s y `pulsoMeta` 30 s; nube cron `* * * * *`) + Instagram prepara el contenedor desde 15 min antes y publica en `t >= momento`; Facebook nativo exige ≥ 11 min (si no, publica «local» a la hora fijada). Suma típica **5-7 min**.
- **CON-05 · Alta.** «Publicar ahora» real: ver §3.2.
- **CON-06 · Alta ✔.** `src/ventana-ajuste.js` aplica `pv.style.zoom` entre 0,4 y 1 sobre `.pz-preview`; las pestañas Feed/Perfil/Facebook (`.pv-tabs`) están **dentro** y se escalan con todo (13 px → ~5 px). Posible causa de «no vuelven»: el alto natural se calcula como `getBoundingClientRect().height / z` y la medición depende de cómo cada navegador trata `zoom` (NV); además un `MutationObserver` sobre `class` re-mide en cada cambio y la histéresis solo baja.
- **CON-07 · Media.** Pasos ①-④: `aria-current` solo al pulsar; sin `IntersectionObserver`; el paso 4 en escritorio solo abre el desplegable del pie.
- **CON-08 · Media.** Etiquetas de día generadas en cuatro sitios con reglas distintas (`contenido-cola.js:115-116`, `contenido.js:368` con `hoy + DAY + 3600e3` frágil al cambio de hora, `calendar-core.js:26-27`, `pieza.js:372,377`). La UI ofrece días rápidos **sin hora** y luego bloquea aprobar sin hora.
- **CON-09 · Alta.** Con el panel abierto, `setInterval(() => load(true), 20000)` (`src/contenido.js:711`) hace 3 peticiones (`list` del mes, `cola`, `list` desde hoy−14 sin tope) más un `bgPoll` de 60 s; sin ETag, sin paginación, sin proyección ligera; en la nube el filtro `q` es en JS.
- **CON-10 · Media-alta.** `conServicio` arma ajustes, almacén, cola y conductores **por petición**; la cola y la agenda de Meta son documentos enteros en D1.
- **CON-11 · Alta.** Bandeja en la nube: por **cada** petición `conBandeja` (`cloudflare/worker/lib/anuncios-nube.js:299-316`) aplica migración, lee inicio, abre un «espejo» (`espejo.js:203`) que materializa `cuentas.json`, `bandeja.json`, `bandeja-meta.json`, `cuenta.json` desde D1 y al final los vuelca y compara. El cron lo repite cada minuto. El front pinta todo sin virtualizar y guarda borradores reescribiendo `bandeja.json` entero.
- **CON-12 · Media.** Sondeos acumulados (60 s bandeja, 20 s panel, 60 s resumen, 30-60 s relojes del servidor).
- **CON-13..16 · Media/Baja.** Aviso de aprobación en la nube incompleto; «sale en unos 5 minutos» escrito a mano en `pieza.js:382,492,557`; `rel()` frágil al horario de verano; **Instagram no se puede borrar por API**, el aviso previo de «Publicar ahora» debe decirlo.

### 1.4 Rendimiento (PER)

Medido: `dist/command-centre-v2.html` = **2.303.817 B** (tope 2.306.867; margen ~3 KB); gzip −9 = 708.820 B (tope 716.800); brotli q11 = 594.106 B. Un solo `<script>` de 1,88 MB, `<style>` de 404 KB, fuente woff2 en base64. Dentro: `mcplogos.js` 160 KB, `v1data.js` 140 KB (mundo falso de la demo), three.js ~570 KB, `studio.js` 253 KB. Solo existe un presupuesto (`check.mjs:34`); no hay LCP/TTI.

- **PER-01 · Alta · S.** No está verificado que la página de 2,3 MB salga comprimida: `conNube` la pasa por `HTMLRewriter` y borra `content-length`/`etag`. Medir con `curl -sI -H 'accept-encoding: br'` y blindar con un test.
- **PER-02 · Alta · L.** Sacar `v1data` de la ruta real y `mcplogos` a un paquete aparte (patrón `estudio-carga.js`): ~300 KB brutos.
- **PER-03 · Media.** `run_worker_first:["/*"]`: toda petición hace una consulta D1 de sesión. No se puede quitar sin romper la garantía de sesión; sí cachear la sesión unos segundos en el isolate.
- **PER-04 · Media.** Paquetes con `private, no-cache` y nombre fijo: cada recarga revalida cada uno. Poner hash en la URL y `immutable`.
- **PER-05 · Media-alta · M.** La galería usa el **original** como miniatura (`studio.js:188,518`); 120 por página: 100-500 MB en el peor caso. Generar miniatura de 400 px o usar Cloudflare Images.
- **PER-06 · Media.** Sondeos: tareas 6 s (ya con ETag), contenido 20 s, vista de tareas 8 s, bandeja 60 s, etc. Con el WebSocket `/api/live` conectado, subir a 30-60 s.
- **PER-07 · Media.** La oficina 3D baja a 30 fps en reposo; bajar a 15 fps tras ~10 s sin entrada.
- **PER-08/09 · Media/Baja.** Cron cada minuto con N consultas D1 por módulo (salir rápido si no hay nada); índices D1 sin `EXPLAIN` sobre datos reales.
- **PER-10/11 · Baja.** Cerebro 3D con miles de notas (NV), fuente en base64 en el CSS (dejarlo).

### 1.5 Íconos y conectores (ICO)

Las 9 redes + WhatsApp/Messenger ya usan logos reales de Simple Icons en **un** registro (`src/redes-iconos.js:10-24`), compartido por escritorio y móvil. Los **conectores** tienen tres sistemas: (1) escritorio: 26 teselas WebP de 160 px en base64 (`src/mcplogos.js`, 160 KB, dentro de un cuadro blanco, sin variante oscura); (2) desconocidos: monograma en canvas (`src/connectors.js:15-31`); (3) nube y móvil: pictogramas propios sobre placa de color (`cloudflare/worker/lib/iconos-conectores.js:1-5` decide **explícitamente** «no se copia ningún logotipo de nadie»).

- **ICO-01 · Alta.** Tres sistemas inconsistentes: el mismo Gmail es logo real en la barra de escritorio y un sobre rojo en nube/móvil.
- **ICO-02 · Alta.** La decisión de no usar logos reales contradice lo que pide el dueño: se revoca y se anota en `CLAUDE.md`. Faltan en todas partes: Zapier, n8n, Make, GitHub, HubSpot, Airtable, Cloudflare, Linear, Asana.
- **ICO-03 · Media.** No hay test de cobertura (cada red, plantilla y conector debe tener ícono).
- **ICO-04 · Media.** 154 KB de WebP en la página, sin escala ni modo oscuro.
- **ICO-05/06 · Media/Baja.** `alt=""` donde el nombre no está al lado; monogramas con fórmulas distintas.
- **ICO-07 · Media.** Falta Telegram y cualquier red nueva cae a un globo genérico sin aviso.
- **ICO-08 · Baja.** LinkedIn se queda en `simple-icons@9.0.0` (versiones nuevas la retiraron a petición de la marca): revisar su guía de uso.
- **ICO-09 · Media.** Tamaños distintos por contexto (14-18 px); por debajo de 16 px Instagram, Threads y TikTok pierden detalle. **Posible causa de «se achican»**: `contenido.css:271` baja `.pz-nb` a 14 px en columnas estrechas (el auditor no encontró regla que encoja `.pv-net`; la causa principal es CON-06).
- **ICO-10 · Media.** Objetivos táctiles bajo 44 px: `.pv-tabs [role=tab]` (30 px), `.md-cont` (28 px).
- **ICO-11 · Baja.** Sin test de contraste para Instagram (degradado) y Pinterest sobre fondo oscuro.

### 1.6 Seguridad y UX/UI (SEG, UX)

Bien (no tocar): PBKDF2 con huella de sesión y `__Host-`, AES-GCM con HKDF e IV aleatorio, firmas con `igualSeguro`, proxy `imagen-meta` con lista blanca, SVG con sandbox, restablecer con admin y paso doble, invitaciones de un solo uso, no hay `pull_request_target`, `probar` no usa secretos, ningún workflow imprime secretos.

- **SEG-01 · Alta · S.** `/api/chat` no llama a `tasa` (`modulos/chat-agente.js:17-37`): hasta 4 vueltas y 6 herramientas por petición con tu clave del modelo; solo se corta si `stopAtBudget`. Lo mismo `POST /api/agentes/:id/ejecutar`.
- **SEG-02 · Alta · M.** El detector de inyección (`safety.mjs:156-169`) son 8 regex, sin normalizar Unicode ni caracteres de ancho cero. La Bandeja y `contenido/` no llaman a `injectionIn` (NV si el borrador de la Bandeja pasa por modelo). El chat permite herramientas de lectura con `fetch|browse|query|search`: un conector con parámetro de URL puede exfiltrar por los argumentos (NV).
- **SEG-03 · Media · S.** Servidor local: `Origin: null` y POST sin cuerpo saltan los chequeos (`serve.mjs:2240-2248`).
- **SEG-04 · Media · S.** El rol `lectura` lee ejecuciones de agentes, Cerebro y notas sin filtro (`rutas.js:108-114,168`): decidir y documentar.
- **SEG-05 · Media · M.** Sesiones de 30 días fijos, sin expiración por inactividad ni lista de dispositivos (`lib/sesion.js:10`).
- **SEG-06 · Media · S.** Login sin contador global por correo; cada intento fallido hace DELETE + UPSERT en D1.
- **SEG-07 · Media · S.** `check.yml` sin `permissions`; `cloudflare-desplegar.yml:21` permite `workflow_dispatch` desde cualquier rama y sin `environment` con aprobación; `:90` vuelca `toJSON(secrets)` al paso que corre `npx wrangler`; `npm install` en vez de `npm ci`.
- **SEG-08 · Baja · S.** Sin HSTS; CSP con `script-src 'unsafe-inline'`; `?token=` aceptado en `/api/hook`; candidatos de XSS a mirar: `src/studio-lotes.js:141`, `src/sub.js:190` (más de 400 `innerHTML` sin revisar).
- **SEG-09 · Baja · S.** El proxy `imagen-meta` llena R2 sin tope total ni expiración.
- **UX-01..04** coinciden con DIM-07, EST-01, CON-06 y CON-08. En UX-04: `tareas/cola.mjs:10-12` ordena por prioridad antes que por límite, `tareas/dueno.mjs:116-118` (`porDia`) no ordena dentro del día, `tareas/modelo.mjs:30` convierte «día sin hora» en 23:59 sin marcarlo, `src/when.js:23,191` interpreta «mañana» como 08:00 o «día siguiente» según el contexto.
- **UX-05 · Alta.** Acciones destructivas con `confirm()` del navegador mezcladas con DESHACER: `detail.js:162`, `studio.js:1461`, `business.js:53`, `agentsheet.js:89,92,102`, `brain.js:466`.
- **UX-06 · Media.** Dock con 11 herramientas y ~20 atajos de una letra con significados distintos según la vista.
- **UX-07 · Media.** Primer uso en la nube: sin recorrido; «Restablecer» carga 59 notas de PanaClaw (una oficina de otro negocio arranca con ellas); el login no tiene «olvidé mi contraseña».
- **UX-08 · Media.** «Más» móvil depende del DOM escondido del escritorio (`src/movil/escritorio.js`): sin test, un id cambiado rompe en silencio.
- **UX-09 · Media.** Paridad escritorio/móvil/nube: lo que contesta 501 sigue visible; mostrar capacidades por `/api/health` y desactivar con una frase.
- **UX-10 · Baja.** Controles de 32/24/18 px en Dimitri; ~55 reglas con fuente ≤ 10,5 px.
- **UX-11 · Media (pedido del dueño) · S.** `paintIa()` (`src/sub.js:54-61`, `.sb-ia-head`, `src/css/dimitri.css:230-231`) pinta siempre «IA: <modelo> · consulta la oficina por sí mismo / solo conversa (este modelo no usa herramientas) · cambiar · gasto de IA del mes». Es información útil una vez, ruido a diario. Arreglo en §3.11.

## 2. Reglas del plan

1. **Nada de herramientas nuevas hasta cerrar las Fases 0-3, salvo lo que el dueño pidió expresamente** (la Fase 8: chat, recados y notificaciones). Cada fase mejora lo que ya existe.
2. **Toda fase termina con `npm run check` verde, tests nuevos y documentación al día** (`CLAUDE.md`, `README.md`, y este plan con ✅ en cada punto, en el mismo commit).
3. **Lo que toca la nube se prueba con workerd real** (`cloudflare/tests/vivo-ayudas.mjs`); lo de D1 con los límites conocidos (≤5 términos por SELECT compuesto, ≤100 parámetros).
4. **Cada pantalla se prueba a 320/360/390/430, 1024, 1366 y 1512, con y sin Dimitri, en claro y oscuro** (`scripts/*-recorrido.mjs`, axe).
5. **La regla del dinero y los candados de envío no se tocan**: nada de esto relaja aprobar, enviar o gastar.
6. **Un PR por fase o sub-fase**, a `main`, con CI en verde; el despliegue es el de siempre.
7. **Los archivos grandes chocan** (`src/main.js`, `src/tasks.js`, `src/shell.html`, `serve.mjs`, `src/studio.js`): al repartir trabajo entre agentes en paralelo, cada agente trabaja en su *carril* (§5) y nadie edita el mismo archivo grande a la vez.

## 3. Diseños

### 3.1 Carpetas en árbol (EST-01..04)

- **Modelo.** `{ id, name, parentId|null, orden:number, tipo?:'proyecto'|'carpeta'|'lote'|'carrusel', color?, creadaPor:'you'|'agent'|'dimitri'|'lote', creada, loteId? }`. La ruta se **calcula en lectura**, nunca se guarda (un renombrar no deja rutas viejas). El campo `folder` del archivo no cambia: es el id de la hoja y **ningún archivo se mueve** en disco ni en R2; los enlaces siguen valiendo.
- **Migración perezosa.** `parentId ?? null` y `orden ?? índice`; un `folders.json` viejo es válido (todas raíces). Se escribe `v:2` al guardar. No hay paso de migración.
- **Unicidad.** El nombre es único **entre hermanos** (sin mayúsculas ni acentos). Los duplicados automáticos de lotes y agentes reciben « (2)». Profundidad máxima 8; tope subido a 500 con aviso claro («ya hay 490 de 500»).
- **Cálculo único** `arbol(items, carpetas)` puro en `media/galeria-core.mjs` (compartido con la nube y el móvil): por carpeta `{id,name,parentId,path,ruta,n (directo),nTotal (recursivo),hijos}` en una pasada O(items+carpetas). `n` conserva su significado de hoy para no romper a Dimitri.
- **Filtro.** `GF.matcher` gana `folder` con `recursivo` (por defecto sí): pasa si `it.folder` está en `{id}+descendientes`, calculado una vez por consulta. `folder='none'` se mantiene.
- **API** (local y nube, mismas formas): `POST /api/media/folders {name,parentId?,files?}`; `PATCH /folders/:id {name?,parentId?,orden?}` (mover una carpeta es cambiar `parentId`); `PATCH /folders/reorder {parentId,ids}`; `DELETE /folders/:id?modo=subir|vaciar`; `GET /api/media/folders` (árbol); `POST /move` igual. Las respuestas existentes añaden campos, no quitan.
- **Casos borde.** Ciclo o mover a su propio hijo → 422 «no puedes meter una carpeta dentro de sí misma» (se valida subiendo desde el destino, con tope de recorrido). Borrar con subcarpetas: por defecto `subir` (archivos y subcarpetas suben al padre; si hay un hermano con ese nombre se renombra el que sube; la UI dice «Tiene 3 subcarpetas y 120 archivos: se quedan en «X»»); `vaciar` los manda a «Sin carpeta»; **nunca se borran archivos**. Padre inexistente → se trata como raíz. Carpetas de lote/Dimitri/agente: se crean dentro de una raíz «Lotes» (`tipo:'lote'`) o del proyecto elegido. Carrusel/reel: `agruparGaleria` no existe en este árbol (NV: puede vivir en otra rama); la regla es que el grupo sea una carpeta `tipo:'carrusel'` hija de su proyecto con `orden` por lámina.
- **Nube.** Pasar las carpetas de un documento único a filas (o, mínimo, versionar `mutarDoc`), y promover `folder` a columna indexada de `estudio_archivos` con un conteo cacheado por carpeta con `rev` (EST-02/04).
- **Escritorio.** Panel lateral con árbol plegable y conteo recursivo; **migas de pan** sobre la rejilla (cada miga es destino de arrastre); arrastrar archivos y carpetas sobre el árbol; menú contextual (Nueva subcarpeta, Mover a…, Renombrar); buscar sin carpeta busca en todo el árbol con la miga en cada resultado; **navegación por teclado completa**.
- **Móvil.** Lista del nivel actual con migas; tocar entra, «‹ Padre» sube; `elegirCarpeta` navega por niveles («Elegir aquí», «Nueva carpeta aquí»); selección múltiple + «Mover».
- **Criterios de aceptación.** Crear A/B/C; mover B a otra raíz; mover A dentro de C (rechazado); borrar B con `subir`; el conteo recursivo cuadra; ningún archivo cambia de ruta; lo anterior funciona en local, en la nube y en móvil; las rutas viejas siguen contestando.

### 3.2 «Publicar ahora» real y conversión universal (CON-01..05, 13, 14, 16)

**Publicar ahora.**
1. Botón que dice la verdad: «Sale ahora en Instagram y Facebook. No se puede deshacer; después solo se puede borrar o archivar. En Instagram no se puede borrar desde aquí.» (dos pasos, como `confirmaYa`).
2. Ruta nueva `POST /api/contenido/piezas/:id/publicar-ya` junto a `aprobar` (`rutas-nucleo.mjs:231`), atómica: valida candados (solo el dueño, revisión sin errores, huella vigente, modo `real`), aprueba con hora = ahora (sin +5), crea la entrada de cola con `ya:true` y ejecuta **en el mismo request** (en la nube con `waitUntil`) un `tick` acotado a esa pieza y el pulso de Meta para ese trabajo.
3. Núcleo: `listaDesde` salta `GRACIA_MS` y `MARGEN_MS` si `ya`; Facebook publica con `published=true` inmediato; Instagram salta la espera de 15 min, crea el contenedor, sondea `FINISHED` con tope corto y `media_publish`; si no termina, queda `preparada` para el siguiente pulso.
4. Invariantes que **no** se tocan: «nunca dos veces» (`intentando` e incierta), el candado `vuelta`, `puedeSeguir`.
5. Latencia esperada (estimación, NV): foto 3-8 s, carrusel 5-15 s, video 20 s a varios minutos.
6. Mínimo viable si se quiere algo rápido: `PRONTO_MIN` a 1, `GRACIA` a 0 para «ya» y llamar a `tick()`/`pulso()` desde el endpoint. La constante se importa en los textos de `pieza.js:382,492,557`.

**Conversión universal de imágenes.**
1. **Cloudflare Images** (`"images": {"binding":"IMAGES"}` en `wrangler.jsonc`): arregla la nube con una línea y una prueba (PNG, WebP, GIF, AVIF; HEIC NV). Tiene costo por transformación (precio actual NV): decisión del dueño.
2. **Navegador, al subir al Estudio**: `createImageBitmap` + `canvas.toBlob('image/jpeg', .92)`; corregir orientación EXIF, aplanar el alfa sobre blanco (un PNG transparente a JPEG queda negro) y relleno/recorte a 4:5, 1,91:1 o 9:16 según el ajuste; guardar el JPEG como derivado y conservar el original. HEIC solo en Safari: `heic2any`/libheif-wasm a demanda.
3. Respaldo en el Worker: `IMAGES` o WASM (jSquash/photon), cuidando CPU y memoria.
4. Mensajes por archivo («`foto.heic` se convertirá a JPEG al guardar») y bloqueo con la causa real; unificar la lista de formatos entre `MEDIO_RE`, `esJPEG`, el aviso al aprobar y la nube (CON-02/13). SVG se rasteriza o se rechaza con motivo.

### 3.3 Referencias sin recortes mudos (EST-05..07)

Módulo puro `media/referencias-core.mjs` (local y Worker) con `ajustarReferencias({refs:[{id,rol,peso?,descripcion?}], caps, estrategia}) → {usadas, descartadas, aviso, plan}`. **Todos los `slice` actuales llaman a esta función** y la única fuente del tope es `capsOf(m).maxRefs`. Estrategias, en orden:
1. **Prioridad por rol**: producto/rostro/logo (obligatorias) > estilo > ambiente > extras; dentro de cada rol, el orden del usuario.
2. **Contact-sheet** con `sharp` (local) o `IMAGES` (nube): unir N referencias del mismo rol en **una** imagen con cuadrícula y etiquetas («Ref 3: logo»); el prompt dice «la imagen N es una cuadrícula de referencias»; se guarda en la galería con `refDe:[ids]`. No mezclar rostro ni producto exacto (pierden fidelidad).
3. **Resumen por texto** con visión (`vision.mjs`, `ver_imagen` en la nube): una línea por referencia sobrante añadida al prompt; la descripción se cachea en la ficha para pagarla una vez.
4. **Rotación por lámina** en carruseles: cada lámina recibe las obligatorias + una rebanada de las demás, más la cadena (portada + lámina anterior con cupo reservado de 2).
5. **Cambio de modelo**: si hacen falta más que `maxRefs`, sugerir (o elegir, si el dueño lo permitió) el modelo más barato con `maxRefs ≥ n` y mostrar el costo diferencial antes de generar.
6. **Aviso obligatorio**: «Se usaron 4 de 9 referencias: …» en el plan, el lote y la tarjeta de la lámina. Nunca silencioso.

Criterios: un test recorre el catálogo y comprueba que ninguna ruta envía más referencias que `maxRefs`; los avisos aparecen en lote y carrusel.

### 3.4 Banco de presets en la nube (EST-12..16)

1. **Fase A.** Quitar el 501 de `GET /api/media/presets` y `POST /compile` con el compilador puro y la fábrica empaquetada (`build`); `capacidades.local=false` para que el front marque «no disponible aquí» solo los presets que lo exigen, en vez de ocultar el banco. El dueño ya ve el banco y los costos antes de gastar.
2. **Fase B.** `POST /apply` sobre `trabajos.pedir` con los topes del día y del mes de la nube. Los presets con IA funcionan.
3. **Fase C.** Presets propios y versiones en D1; sinónimos y búsqueda (`presets-buscar.js`).
4. **Fase D.** Ejecutor local en el Worker con **Cloudflare Images** (binding `IMAGES`: resize, rotate, brillo/contraste, trim, borde) o WASM (photon/jSquash) para los presets `ejecutor:'local'` más usados (fondo blanco, recorte, salida por canal); el resto sigue marcado «solo en la oficina». Alternativas: delegar a edición con IA (cuesta dinero) o Cloudflare Containers con sharp (NV).
5. **Fase E.** Lotes por cron y por pasos (no en una petición): una tabla por lote y un Durable Object o cola; hoja Excel/CSV portada (NV si `lotes-hoja.mjs` es portable). Plantillas y entender video con un modelo de visión desde la nube.

### 3.5 Dimitri: ancho, plegado, ampliado y reparto (DIM-01..08)

1. **Fuente única del ancho.** `--subW:var(--sub-w,min(440px,34vw))`; JS escribe `--sub-w`; `chatLeft()` y todo lo demás lee la medida real de `#subOv` y se emite un evento `ao:sub-ancho`. Rango 340-760 (y máximo `min(760, ventana − 480)`), recordado en `ao.sub.w`.
2. **`src/panel-ancho.js`** extraído de `studio-paneles.js`: `bordeArrastrable({el,lado,min,max,paso,get,set,aria})` con pointer capture, teclado ←/→ (24 px), Inicio/Fin, doble clic = mínimo, `role=separator` con `aria-valuenow`, y `anchos()` generalizado a **N paneles** `{id,min,max,prio}`; `studio-paneles` y `sub.js` lo usan. El borde de Dimitri a su derecha, solo ≥ 900 px; `stopPropagation` para no chocar con los atajos de una letra.
3. **Plegar** (no cerrar): botón en `.sb-head` y pestaña vertical al borde (como `.st-hver`), clase `body.subFold`; el `tick` y el chip «Viendo» siguen vivos; Esc sigue cerrando; `isOn()` distingue abierto/plegado para `topWin` y el dock.
4. **Ampliado**: `body.subMax` a pantalla completa con `modal.open(el)`; al abrir una tarjeta que navega sale del modo ampliado; el chip «Viendo» se limpia o se rotula cuando la vista queda tapada.
5. **Reparto en el Estudio**: container queries en `#studioOv` (como ya hacen `#calOv`, `#ctOv`, `#anOv`, `#tvOv`, `#anuOv`); `conSitio()` usa el ancho de `.st-body`, no `innerWidth`; Dimitri entra como tercer panel; orden de cesión: primero el banco pasa a *overlay*/oculto, luego el compositor a su mínimo, luego Dimitri a su mínimo; garantizar `GALERIA_MIN` (320).
6. **Cerebro**: `62vw` → contenedor, y plegar `.bv-side` automáticamente si la vista mide < 800.
7. **Contexto y navegación** (DIM-09/10): enviar `ids` (≤ 20) y un `resumen` corto por vista; acción propuesta «navegar» con clic (abrir vista/semana). Cuidado con el tope del prompt: lo nuevo va en `<viendo>` fuera de la parte cacheada.
8. Móvil: `src/movil/vistas/dimitri*.js` ya es una pantalla completa por diseño; no se toca. `body.movil.subOpen` no recibe clases nuevas sin probar.

Criterios: arrastrar, teclado y doble clic funcionan; se recuerda entre sesiones; con Dimitri a 760 px y el Estudio abierto la galería nunca baja de 320 px; a 1024, 1366 y 1512 ninguna vista queda cortada ni con scroll horizontal; la oficina 3D sigue centrada.

### 3.6 Registro único de íconos (ICO-01..11)

`src/iconos-registro.mjs` (puro, sin DOM; el Worker lo recibe copiado por el build): `ICONOS = { id: { nombre, d (trazado 24×24), color, mono, alias:[claves de plugin] } }`, `iconoSvg(id,{tam,titulo,monocromo})`, `iconoPlaca(id,nombre)`, `monograma(nombre)` (**único** fallback, color estable por hash). Redes y conectores en el mismo mapa; `PLANTILLAS` referencia `icono:'gmail'` en vez de `glifo/color`; se eliminan `GLIFOS` y las 26 teselas WebP (~154 KB de la página → ~10-20 KB). Logos de **Simple Icons** (CC0 para el trazado; las marcas siguen siendo de sus dueños, uso nominativo; Google exige su logo a color). `currentColor` solo para los negros (X, Threads, TikTok, Notion, GitHub). Inline como SVG (sin tocar la CSP; en `login.html`/`invitacion.html`, sin `data:`, SVG en línea o sprite del mismo origen). Hero 3D: rasterizar el SVG a canvas en tiempo de ejecución (patrón de `tile()`). Conectores que añade el usuario: monograma estable, y opcionalmente favicon por un proxy del mismo origen (`/api/icono-conector?host=`, mismo patrón y mismas protecciones SSRF que `imagen-meta`). Test que **falla** si una red (`RED`), una plantilla, una clave de `MCP_BY_DEPT` o un nombre de `MCP_LOGOS` no tiene entrada con `d` no vacío, y que el SVG de nube y el de escritorio son idénticos para el mismo id. Tamaño mínimo de 16 px para logos con detalle; objetivos táctiles de 44 px; `aria-hidden` si el nombre está al lado, `role="img"` + `aria-label` si es lo único.

### 3.7 Vista previa de la pieza, pasos y etiquetas de día (CON-06..08, UX-04)

- **Vista previa:** sacar `.pv-tabs` y `.pz-side-h` del elemento que se escala (escalar solo la maqueta); sustituir `zoom` por `transform: scale()` con `transform-origin: top center`, midiendo `offsetHeight` (layout, sin escalar); **piso de ~0,75** (si no cabe, scroll en la columna o la maqueta en pestaña aparte a tamaño real); quitar `class` del `attributeFilter` o hacer debounce con umbral ≥ 8 px; `.pz-side` con `position:sticky; max-height:100%; overflow:auto`.
- **Pasos:** `IntersectionObserver` sobre las tres secciones para marcar el paso activo sin hacer scroll; el paso 4 lleva al pie y lo resalta.
- **Etiquetas de día:** una sola función `etiquetaDia(fecha, hora, ahora)` en `src/calendar-core.js` («Hoy 31 oct · 14:30», «Mañana vie 1 nov», «Sin hora» con color de aviso), con `ahora` de la zona de la oficina (`config.zona`), usada por las cuatro vistas; dentro de cada día, subgrupos «Con hora» (por hora) y «Sin hora» (por prioridad) con chip «Todo el día»; confirmar frases ambiguas («mañana»).

### 3.8 Rendimiento de Programación y Bandeja (CON-09..12)

- **Un endpoint** `/api/contenido/programacion?desde=&hasta=` que devuelve piezas + cola + resumen, con **ETag/If-None-Match** (`max(actualizada)` + versión de la cola) y 304 vacío; proyección ligera para el listado y pieza completa solo al abrirla; tope superior (+90 días).
- **Sondeo único** por el Hub/WebSocket (`/api/live`) que avise «cola cambió / bandeja cambió»; mientras tanto, 60 s con la pestaña visible y suspendido si `document.hidden`.
- **Nube, Bandeja:** tabla `bandeja_items(id, estado, fuente, tipo, ts, json)` con índice `(estado, ts desc)` y paginación `?cursor=`; los GET leen filas, **sin espejo**; guardar borradores con `PATCH` por ítem; render por lotes de 50 o virtualizado.
- **Nube, cola:** índice parcial por `estado in ('espera','entregando','en_red')` para que el cron lea solo lo vivo; purgar terminadas a 7 días; cachear el servicio por isolate.

### 3.9 Rendimiento global (PER)

Presupuesto propuesto: página ≤ 2,0 MB bruto / ≤ 650 KB gzip / ≤ 550 KB brotli; cada paquete diferido ≤ 150 KB gzip; objetivos en móvil 4G lento (NV, validar con Lighthouse): LCP ≤ 2,5 s, TTI ≤ 4 s, CLS ≤ 0,1, ≤ 12 peticiones `/api` al arrancar. CI: ampliar `check.mjs:34` (brotli, tamaño de cada `dist/*.js`) y un test de cabeceras en la nube (`content-encoding`, `ETag`, `Cache-Control`, 304 con `If-None-Match`); después, Lighthouse CI opcional con `budget.json`.

### 3.10 Comunicación del equipo: chat en vivo, recados para cuando entren, notificaciones y Telegram (pedido del dueño, 29 oct)

**Lo que ya existe (verificado en este árbol).**
- **El plan del chat ya está escrito:** `docs/plan-chat-interno.md` (27 oct; fases C0-C6, «nada construido»): canales, directos, `#general`, menciones, reacciones, adjuntos, tiempo real por el `Hub` con envío dirigido, avisos y Telegram, hilos de registros, Dimitri. **Este plan no lo duplica: lo adopta como fuente de verdad del chat** y le añade lo que el dueño pidió y allí no está (recados, hoja de entrada, centro de notificaciones por persona, vinculación de Telegram por cuenta).
- **Presencia en vivo:** `cloudflare/worker/hub.js` (Durable Object `Hub`, sockets hibernables, `difundir()` a todos; falta envío a algunas personas, como ya anota el plan del chat).
- **Avisos:** `cloudflare/worker/lib/avisos.js` guarda avisos **de la oficina entera** (`filas('avisos')`, dedupe por `key` en 6 h); no son por persona, no tienen «leído por quién» ni preferencias.
- **Telegram:** `telegram-core.mjs`/`modulos/telegram.js` atienden **solo** a `TELEGRAM_OWNER_ID`, a administradores registrados en Ajustes y a aprobadores delegados (`telegram.approvers`); a cualquier otro, silencio total. Los ids de Telegram de las personas viven en **Ajustes → Equipo (`team.people`)** como un campo de texto libre: **no están vinculados a las cuentas** (`users`), por eso no se les puede avisar «a ti» de forma fiable ni dejarles recados.
- Comentarios de tareas con `@nombre` (avisan por Telegram a esa persona si tiene id) y tareas para una persona (`asignadaA`).

**Lo que falta, pieza por pieza.**

1. **Última visita por cuenta.** Columnas `visto_at` (última actividad) y `entro_at` (inicio de la visita actual) en `users` o en una tabla `presencia_cuenta`, escritas al abrir sesión y en el latido del `Hub` (con tope: una escritura cada 5 min). Es la base del «mientras no estabas».
2. **Recados («notas para cuando entres»).** Tabla `recados`: `id · de_user_id · para` (una persona, un rol o todos) `· cuerpo` (texto plano ≤ 1.000) `· prioridad` (normal · importante) `· vence_at · fijado` `· enlace` (opcional: tarea, pieza, nota o vista) `· requiere_enterado (0/1)`; y `recados_estado(recado_id, user_id, entregado_at, leido_at, enterado_at)`. Se escribe desde la hoja del chat, desde la ficha de una persona, desde un comentario con `@nombre` («Déjale un recado») y desde Telegram (`/recado @ana texto`). Reglas: nunca a quien lo escribió; un recado a «todos» llega una vez a cada persona; **lo privado es privado** (un administrador ve que existe y si se leyó, no el texto de uno ajeno); vence solo; el que «requiere enterado» no se da por entregado hasta el clic «Enterado», y a quien lo dejó se le avisa. Tope de recados abiertos por persona y de largo.
3. **Hoja «Mientras no estabas»** al entrar (escritorio y móvil, bajo demanda, un paquete aparte como `dist/movil-d.js`): una sola pantalla, ordenada por urgencia, con lo que pasó desde `visto_at`: recados (los importantes arriba, con «Enterado»), menciones y mensajes del chat sin leer, lo que **espera tu OK** y lo **tuyo de hoy y lo vencido**, tareas que te asignaron o delegaron, cambios en lo que tú creaste, fallos de lo que lanzaste, y avisos de la oficina que te tocan por tu rol. Se cierra con un clic, nunca bloquea el trabajo, no sale si no hay nada nuevo, y cada línea abre su destino. Misma información que el centro de notificaciones (no un sistema aparte).
4. **Centro de notificaciones por persona.** Tabla `notificaciones(id, user_id, tipo, titulo, cuerpo_corto, enlace, clave_dedupe, creada_at, leida_at, canal_entregado)` que **sustituye por persona** lo que hoy es un único montón de la oficina; `avisos.js` sigue existiendo y, para cada aviso, decide **a quién** le toca (por rol y por pertenencia) y escribe una notificación por persona. La campanita (escritorio: dock; móvil: cabecera) lleva el contador del no leído. Categorías: recados · chat · menciones · aprobaciones · tareas · contenido y Bandeja · anuncios · sistema. **Preferencias por persona** (Ajustes → Mi perfil): qué categorías, por qué canal (en la app, Telegram, y push del navegador si se activa), «no molestar» con horario y zona, y resumen diario opcional en lugar de avisos sueltos.
5. **Reglas de entrega** (las del plan del chat, ampliadas): un aviso por hecho y canal (`clave_dedupe` + tabla de «ya avisé»); **nunca a quien lo causó**; **el aviso que falla no tumba la acción** (`savepoint`/`try`); por Telegram solo si la persona **no tiene un socket vivo hace unos minutos**; agrupar ráfagas («y 4 más»); el socket lleva ids, nunca texto; D1 es la verdad y el sondeo de 30 s y la puesta al día al reconectar recuperan lo perdido. Toda tabla nueva declara su tope y su poda (`cloudflare/tests/auditoria-transversal.test.mjs`, `lib/mantenimiento.js`) y respeta los límites de D1 (≤ 100 parámetros, ≤ 5 términos compuestos).
6. **Vinculación de Telegram por cuenta** (lo que hoy no existe).
   - En la app: Ajustes → Mi perfil → «Conectar mi Telegram» genera un **código de un solo uso de 8 caracteres, válido 10 minutos**, atado a la cuenta y a la sesión que lo pidió, guardado con huella (nunca en claro).
   - La persona le escribe `/vincular CÓDIGO` al bot; el bot lo canjea, guarda `telegram_user_id` y `telegram_username` en una tabla `cuenta_telegram(user_id, telegram_id UNIQUE, vinculada_at, silencio_desde, silencio_hasta, preferencias)`, responde «Listo, <nombre>» y la app muestra «Telegram conectado». Un id de Telegram sirve para **una** cuenta; se puede desvincular desde la app o con `/desvincular`; quitar a la persona del equipo desvincula.
   - Se mantiene el **silencio total** para quien no esté vinculado ni sea dueño/aprobador: ni su id, ni «bot privado», ni un error. El canje de un código malo o vencido contesta lo mismo que el silencio, con tope de intentos.
   - **Qué puede hacer cada persona vinculada** (hoy solo el dueño y los aprobadores actúan): según su **rol**: `lectura` recibe avisos; `editor` además `/mias`, `/yo …`, `/recados`, `/recado @persona texto` y `/chat` (los no leídos); `admin` además lo de siempre (`/estado`, `/pendientes`, `/contenido`, `/anuncios`). **Aprobar sigue siendo solo del dueño y de los aprobadores delegados**; el vínculo no da permisos nuevos de envío ni de dinero.
   - **Qué lleva el aviso:** por defecto «Ana te dejó un recado» / «Ana te escribió en #ventas» **sin el texto** (Telegram es un tercero); que lleve el texto es una decisión del dueño por categoría (decisión 2 del plan del chat). Los botones «Enterado», «Marcar leído» y «Abrir» funcionan por `callback` firmado y de un solo uso.
   - Responder al aviso desde Telegram queda fuera de esta fase salvo `/recado` y «Enterado».
7. **Quién entró** (lectura del pedido: «un buen sistema de notificación cuando los usuarios entren» puede ser lo que ve cada persona al entrar —punto 3— y/o que **el dueño sepa cuándo entra alguien**). Para lo segundo: indicador «en línea» y «visto hace…» en la lista del equipo (ya hay presencia), y, **opcional y apagado por defecto**, un aviso al administrador «Ana entró» (una vez al día por persona, con el horario de no molestar). Es seguimiento de personas: se activa por persona y lo ve la propia persona en su perfil. **Decisión del dueño** (§6).
8. **Seguridad y privacidad de todo esto** (se prueba, no solo se escribe): matriz de roles ejecutada contra cada ruta nueva; un id de recado o de notificación ajeno da 404; ni el id ni el texto de un privado salen por el socket a quien no es destinatario (prueba con workerd real: tres sesiones, la tercera no recibe nada); escapado de nombres y mensajes (`esc()`, marcas bidi); `safety.injectionIn` si Dimitri llega a resumir recados o chat; **los agentes no leen el chat ni los recados del equipo**; el canje de códigos de Telegram con tope de intentos y comparación en tiempo constante; ningún secreto en respuestas ni en el registro.

**Fases de esta pieza (Fase 8):**
- **N0 — Cimientos (M):** `visto_at`/`entro_at`, tabla `notificaciones` + preferencias, campanita con contador y centro de notificaciones sobre los avisos que ya existen (cada aviso decide a quién le toca). Sin chat todavía.
- **N1 — Recados y hoja «Mientras no estabas» (M):** tabla `recados`, rutas, hoja de entrada en escritorio y móvil, «Enterado», aviso a quien lo dejó.
- **N2 — Telegram por cuenta (M):** vinculación con código, comandos por rol (`/recados`, `/recado`, `/chat`, `/mias`, `/yo`), «no molestar» y desvincular; avisos de N0/N1 por Telegram con las reglas de entrega.
- **C0-C6 — Chat en vivo** según `docs/plan-chat-interno.md` (canales, directos, tiempo real dirigido, menciones con tarea, adjuntos, hilos de tareas, Dimitri), **integradas con las notificaciones de N0**: una mención o un directo son notificaciones, no un sistema paralelo.
- **N3 — Resumen y push (S-M):** resumen diario opcional, y push del navegador opcional (requiere *service worker* y permiso; hoy el repositorio no tiene uno, así que es trabajo propio).

Criterios de aceptación: un recado dejado desde la app y desde Telegram aparece en la hoja de entrada de la persona correcta y de nadie más; «Enterado» avisa a quien lo dejó; la misma notificación no llega dos veces por el mismo canal; no llega a quien la causó; una persona sin vincular no recibe nada por Telegram y el bot sigue en silencio con extraños; un editor no puede aprobar por Telegram; un código vencido, reutilizado o ajeno no vincula; la oficina local (sin cuentas) no muestra nada de esto sin `window.AO_NUBE`.

### 3.11 Estar a la vanguardia: qué hacen los demás agentes y cómo superarlos (pedido del dueño, 29 oct)

**Cómo se investigó y cuánto vale.** Tres investigaciones web en paralelo (Meta Muse · OpenAI y xAI · Anthropic, Google, Microsoft, Perplexity, automatización y marketing). **Fiabilidad limitada y hay que decirlo:** las páginas oficiales de Meta, OpenAI y xAI no se pudieron abrir desde esta sesión (dominios fuera de la red permitida); solo se leyó en directo el cookbook de Meta en GitHub. Casi todo lo demás viene de resúmenes de búsqueda, prensa y blogs de proveedores con interés, y varias cifras se contradicen entre fuentes. Todo lo que sigue es **hipótesis hasta verificar**; lo no confirmado lleva [NV]. **Antes de decidir una inversión grande por una de estas comparaciones, repetir la investigación con acceso a las fuentes primarias** (decisión §6). Fechas = las de las fuentes (2026).

**Meta · Muse (agente y API).**
- *Qué es:* Muse Spark, primer modelo de la familia Muse de Meta Superintelligence Labs (lanzado ~8 abr 2026): multimodal con razonamiento, uso de herramientas y orquestación multiagente. Versiones 1.1 (jul), 1.2 y **1.3 (2-3 sep)**, con ~20 % menos llamadas a herramientas y ~25 % menos tokens que la 1.2 y contexto de 1.048.576 tokens (el cookbook de Meta confirma `muse-spark-1.3` por defecto). Modos Instant, Thinking y **Contemplating** (varios agentes razonando en paralelo; salió escalonado). *Muse Code* (subagentes, metas, tareas programadas, sandbox) aparece en el cookbook.
- *App agente «Muse»* (reseñas la fechan el 8 sep 2026; solo EE. UU.; planes de pago reportados de US$20 y US$100 [NV]): agente personal en su app o dentro de WhatsApp, para correo, viajes, formularios, facturas y compras con Link de Stripe. Meta dice que pregunta, confirma antes de acciones con consecuencias y ajusta cuántas actualizaciones da [NV]. Una sola fuente habla de «Muse for Small Business» que revisa anuncios y redacta campañas sin gastar sin aprobación [NV]: si es cierto, compite directo con nuestro módulo de Anuncios.
- *API* (`api.meta.ai/v1`, compatible con los SDK de OpenAI y de Anthropic): funciones, búsqueda con citas, JSON con esquema, esfuerzo de razonamiento, caché, visión, **Muse Image**. Precios de agregadores (no de Meta): nivel *Contributor* 1.3 ≈ US$0,10/0,20 por millón (entrada/salida) **pero entrena con lo que recibe**; estándar ≈ US$1,25/4,25 y no entrena. Video: solo SAM 3 (segmenta/rastrea), **no genera video**; el entendimiento de audio en 1.3 no está completo según Meta. **Nuestro código usa Muse Spark para entender video y audio: re-verificarlo contra la documentación actual.**
- *Críticas:* en un índice de terceros, 1.3 ≈ 48,1 frente a ≈ 50,8 de Claude Opus 5; lento (~146 tok/s, ~48 s al primer token en `max`) y verboso [NV]. De memoria, voz, tareas programadas y notificaciones de la app no hay fuentes fiables.

**OpenAI y xAI (solo segunda mano, [NV] casi todo).**
- OpenAI: el «modo agente» parece haber sido sustituido por **ChatGPT Work** (una sola fuente, jul 2026): se ejecuta una vez, de forma recurrente, por evento o **vigilando un cambio**; *Pulse* retirado el 17 jun y sustituido por **Scheduled Tasks** (una ejecución por hora como máximo, pausa de las desatendidas, cada ejecución cuenta contra el límite mensual); **Agent Builder y Evals se retiran el 30 nov 2026** (recomiendan el Agents SDK) → dos productos de agente retirados en un año: **volatilidad**. Aprobaciones: «confirmación antes de acciones de alto impacto» y *watch mode*; no se pudo confirmar si Work lo conserva.
- xAI: Grok 4.7 (21 sep) con API de ~US$2/6 por millón [NV]; **Agent Tools API** con búsqueda web y en X, código, colecciones y **MCP remoto** (herramientas de servidor ~US$5 por 1.000 invocaciones [NV]); Grok Build (agente de código en CLI, código abierto [NV]). De Grok Tasks, Companions, voz, memoria o incidentes de seguridad: **nada fiable**.

**Anthropic, Google, Microsoft, Perplexity y el resto.**
- Claude: **Cowork con tareas programadas** que corren con conectores y Skills y, según las notas de versión, sin dispositivo en línea; **memoria unificada** entre chat y Cowork, visible por temas en Ajustes (25 ago); lo de Cowork accesible desde cualquier conversación (16 sep). *Managed Agents*, *Dreaming* y un mercado de Skills de ~600: solo fuentes terciarias [NV].
- Google: Agentspace fusionado en Gemini Enterprise; **«Gemini agent»**, agente universal para el trabajo (8 oct, vista previa privada según una fuente); Project Mariner discontinuado según una fuente y listado según otra (conflicto).
- Microsoft: Agent Mode por defecto en Word, Excel y PowerPoint (jun), **Agent 365** como plano de control de agentes (inventario, identidad, seguridad; desde el 1 jul las protecciones de Copilot Studio exigen su licencia) y nuevo Copilot con «Home, Code y Autopilot» (25 sep).
- Automatización y marketing: Zapier Agents (cobro aparte), Lindy, Manus y Genspark (créditos), Relevance AI, Agentforce (~US$2 por conversación) [precios de blogs, contradictorios]; **Adspirer** (servidor MCP para anuncios «con tu aprobación»), **AdAmigo** (modos «revisar primero» y «aplicar automático»).
- **Riesgos documentados:** inyección de prompt en navegadores agente (OpenAI admite que quizá nunca se «resuelva» para Atlas; Trail of Bits encontró 4 técnicas que filtraban datos de Gmail por Comet, feb 2026; Brave, Zenity y Unit 42 con ataques demostrados); Gartner prevé que **más del 40 % de los proyectos agénticos se cancelen a fines de 2027** por costos, valor poco claro y controles débiles. No se encontraron incidentes documentados de borrado de datos o gastos descontrolados con fuente sólida: no se afirman.

**Patrones ganadores comunes** (con fuente): el agente cruza apps y vive donde ya se trabaja; tareas recurrentes sin dispositivo encendido; **memoria visible y editable**; gobierno central de agentes con dueño y reversión; aprobación antes de gastar en los agentes de anuncios; cobro por créditos o consumo (costo impredecible). Sobre chat lateral ajustable, plan visible, voz y evaluaciones no hay patrón documentado.

**Lo que ya tenemos y es ventaja** (no construir de nuevo): aprobación obligatoria con candado en código (el guardián revisa **cada** llamada; las herramientas de envío solo corren en una ejecución aprobada y solo a los destinatarios del borrador) — más estricta que los «con tu aprobación» de los blogs; regla del dinero con dos clics y topes; Cerebro con memoria que aprende de lo aprobado o devuelto; 35 puestos con skills, jefes y equipos; Estudio con presets, lotes y QA; Contenido, Anuncios y Bandeja de Meta; Telegram con aprobación de un toque; todo en la cuenta de Cloudflare del dueño, en español, con una oficina completa por defecto; motor propio sobre **MCP estándar** y multimodelo (Anthropic/Meta), que nos protege de la volatilidad de productos ajenos.

**Mejoras para superarlos (VAN-xx; no repiten lo que ya hay).** Esfuerzo S = días, M = 1-3 semanas, L = más de un mes.

| ID | Mejora | Por qué (comparación) | Esf. |
|---|---|---|---|
| VAN-01 | **Autonomía graduada** por acción y por monto: borrador · automático con tope · automático. Hoy `autonomous` es todo o nada por rutina y solo bajar gasto es automático | AdAmigo ofrece «revisar primero» y «aplicar automático»; Gartner pide gobierno. Los envíos y el dinero **siguen** bajo el candado actual | M |
| VAN-02 | **Panel de gobierno de agentes**: inventario con último uso, costo, errores y permisos; «pausar todo»; jubilar o pausar lo que nadie abre en N semanas (ya existe la sugerencia «rutina que nadie lee») | Agent 365 de Microsoft | M |
| VAN-03 | **Red-team continuo de inyección** en CI: un banco de ataques (correo, web, PDF, imagen, conector) contra el guardián en cada despliegue; enlaza con SEG-02 | Ataques demostrados a Comet y Atlas; nuestro `injectionIn` es heurístico | M |
| VAN-04 | **Plan de herramientas visible** en cada ejecución de agente y OK solo en los pasos de envío | Patrón común de plan visible; Meta lo anuncia como virtud | S |
| VAN-05 | **Simulación de rutinas** («¿qué haría hoy?» sin enviar, con costo estimado) | Costo impredecible de créditos y conversaciones | S |
| VAN-06 | **Presupuesto por agente y por rutina** con corte duro (hoy es mensual y global) y **costo por herramienta** además de por token en `costs` | Dolor del costo variable (Manus, Agentforce); herramientas de servidor tarifadas por invocación | S |
| VAN-07 | **Canal de WhatsApp** (Cloud API) para aprobar y pedir, reutilizando la Bandeja de Meta y los vínculos de la Fase 8 | La app agente de Meta vive en WhatsApp: es la brecha de acceso más grande frente a Telegram solo | M-L |
| VAN-08 | **Cuántos avisos por rutina**: «en cada paso» o «solo al terminar», en Telegram y móvil | Meta ajusta cuántas actualizaciones da | S |
| VAN-09 | **Memoria visible por temas** y «olvida esto» desde el chat; memoria personal del dueño editable | Cowork (memoria por temas, ago 2026); ya tenemos lecciones y notas | S |
| VAN-10 | **Constructor guiado** de rutinas y agentes en lenguaje natural, con prueba, plantillas y versiones, incluido «vigila X y avísame si cambia» (disparadores + KPI como tipo de rutina de primera clase) | Workspace Studio, Copilot Studio, Lindy, ChatGPT Work | M |
| VAN-11 | **Enrutamiento automático de modelo** por tarea (barato para triage, fuerte para lo delicado) con fallback, medido por el módulo de calidad; **Muse Spark estándar como segundo proveedor barato** de redacción; etiqueta visible y candado de que **nunca** se usa *Contributor* con notas internas, clientes, precios o chats | Gemini enruta entre modelos [NV]; Contributor es ~12× más barato pero entrena con los datos | M |
| VAN-12 | **Tablero de evaluaciones de agentes** (regresiones al cambiar brief, skill o modelo; hoy los evals son por línea de comandos) | Gartner: «valor poco claro» | M |
| VAN-13 | **Dos borradores en paralelo** (modelo barato frente a fuerte) antes de aprobar, y modo **Equipo** con costo previo y un único resultado revisado por el jefe | Modo *Contemplating* de Meta | S-M |
| VAN-14 | **Agente con tu identidad en Gmail y Calendar** con borrador obligatorio (aprovecha conectores y el candado) | Gemini agent y Agent Mode viven en la bandeja | M |
| VAN-15 | **Informe de valor para el dueño** (ahorro y retorno por agente) y **resumen diario por Telegram** con acciones | Gartner (valor poco claro); «morning brief» de Cowork | S |
| VAN-16 | **Catálogo compartible de skills y rutinas** con importación en un clic (ya hay Biblioteca y GitHub) | Mercado de Skills [NV], plantillas de Zapier | M |
| VAN-17 | **Salida de voz** y notas de voz de Telegram transcritas (Muse Voice Transcribe u otro) [no probado] | Voz en las apps de consumo | M |
| VAN-18 | **Computer use en la nube** (navegador aislado en contenedor, lista blanca de sitios, solo lectura por defecto, aprobación para escribir y vista en vivo de lo que visita) — **diferido**: solo después de VAN-03, por el riesgo de inyección | Comet, Gemini agent; hoy solo hay Chrome en la oficina local | L |

**Reglas para esta fase.** (1) Nada de esto relaja los candados de envío, destinatarios, importes ni la regla del dinero. (2) Una mejora que dependa de una comparación [NV] no empieza hasta verificarla con la fuente primaria. (3) Cada mejora lleva su test y su prueba de seguridad; las que usan datos de terceros pasan por `safety.injectionIn`. (4) Antes de VAN-11 hay que **re-verificar** lo que nuestro código supone de Muse Spark (entender video y audio, precios, límites) contra la documentación vigente.

**Línea de IA de Dimitri (UX-11).** La función pura `cuandoMostrarIa(iaInfo, pref)` decide: *avisos* (por defecto) muestra la línea solo si (a) el modelo no usa herramientas, (b) el gasto del mes está en alerta o pasó el tope, (c) corre un modelo de respaldo distinto del elegido, o (d) el último turno falló por la IA; *siempre* y *nunca* son opciones del dueño (`ao.sub.ia`, también en Ajustes). El nombre del modelo, lo que hace y no hace y el botón «cambiar» pasan a un **ⓘ en la cabecera** de Dimitri (un popover, con 44 px en móvil). Archivos: `src/sub.js:54-61`, `src/css/dimitri.css:230-231`, y en la nube la misma regla.

## 4. Fases

Cada fase es un PR (o varios) y termina verde. El orden sigue lo que el dueño llamó urgente y el beneficio/costo.

### Fase 0 — Arreglos rápidos (1-2 días, riesgo bajo, mucho efecto)

| Punto | Hacer | Prueba |
|---|---|---|
| CON-01 | Añadir `"images":{"binding":"IMAGES"}` a `wrangler.jsonc` y que `aJpegDeEnv` lo use; avisar al aprobar para **cualquier** formato no JPG | test de conductor con binding simulado + prueba en workerd |
| EST-08 | `trashMany` y el móvil muestran el motivo del 409 y las piezas con enlace | test de UI + recorrido |
| CON-06 | Pestañas fuera del `zoom`; piso 0,75; debounce | recorrido de la ventana a 5 tamaños |
| CON-08 / UX-04 | `etiquetaDia` única; «Con hora / Sin hora» | tests puros + recorrido de Mías |
| CON-14 | Textos «unos 5 minutos» desde la constante | test que busca el literal |
| SEG-01 | `tasa` por persona + tope diario en `/api/chat` y `/api/agentes/:id/ejecutar` | test de roles/tasa |
| SEG-03 | Rechazar `Origin: null` en escrituras locales y exigir cabecera propia | test del servidor |
| SEG-07 | `permissions: contents: read`; `environment` con aprobador; despliegue solo desde `main`; `npm ci` | revisión del workflow |
| SEG-08 | HSTS | test de cabeceras |
| PER-01 | Medir y blindar la compresión con un test | test de cabeceras |
| ICO-03 | Test de cobertura de íconos (aunque aún use los sistemas viejos) | el propio test |
| UX-08 | Test de que `ESCRITORIO` no apunta a ids muertos; borrar entradas muertas | el propio test |
| UX-11 | La línea de IA de Dimitri solo cuando hay algo que avisar (modelo sin herramientas, gasto en alerta o pasado del tope, modelo de respaldo en uso, error de IA); el nombre del modelo y «cambiar» pasan a un ⓘ en la cabecera; preferencia «Mostrar la línea de IA: nunca · solo avisos (por defecto) · siempre» | test puro de `cuandoMostrarIa()` + recorrido de Dimitri |

### Fase 1 — Galería del Estudio (urgente para el dueño)

1. EST-01..04: carpetas en árbol (§3.1), en **tres sub-fases**: (a) modelo, API, `arbol()` puro y tests en local y nube; (b) UI de escritorio (árbol, migas, arrastrar, menú, teclado); (c) UI móvil.
2. EST-09..11: endpoint `GET /api/media/usos?files=…` (una sola pasada), insignia «Usada en N» con enlace a la pieza, filtro «En uso / Sin usar», «Quitar de la pieza y borrar» (`POST /api/media/item/:id/liberar`, se niega si la pieza está aprobada o programada para hoy), borrado en lote con endpoint propio, y los anuncios entran en `usos`.
3. EST-05..07: `media/referencias-core.mjs` y sustituir los seis sitios (§3.3); aviso visible en plan, lote y lámina; contact-sheet y resumen visual en una segunda entrega.
4. PER-05: miniaturas de 400 px al guardar (o `cf.image`), original solo en el visor.

### Fase 2 — Publicar y convertir (de «cinco minutos» a «ya»)

1. CON-04/05 «Publicar ahora» real (§3.2).
2. CON-02/03/13 conversión universal: en el navegador al subir y respaldo en el Worker; unificar la lista de formatos y los mensajes.
3. CON-16: aviso claro de que Instagram no se borra por API.
4. CON-07: pasos con `IntersectionObserver`.

### Fase 3 — Dimitri al nivel del Estudio

1. `src/panel-ancho.js` y `anchos()` de N paneles; container queries en `#studioOv` (DIM-01/02/08).
2. Ancho, plegado y ampliado de Dimitri; fuente única del ancho (DIM-05/07).
3. Cerebro `62vw` y `.bv-side` (DIM-04); UX-10 (objetivos de 44 px con `pointer:coarse`).
4. DIM-09/10: contexto con `ids`/`resumen` y acción «navegar».

### Fase 4 — Banco de presets, lotes y entender video en la nube

Fases A→E de §3.4 (EST-12..16). La A y la B resuelven la queja del dueño; la D requiere decidir entre Cloudflare Images o WASM.

### Fase 5 — Íconos originales en todo

§3.6: registro único, logos de Simple Icons para redes y conectores, borrar teselas WebP y `GLIFOS`, test de cobertura y de igualdad nube/escritorio, revocar la decisión de `iconos-conectores.js:1-5` en `CLAUDE.md`, ICO-05..11.

### Fase 6 — Velocidad

1. CON-09..12 (§3.8) para Programación y Bandeja.
2. PER-04 (hash en la URL y `immutable`), PER-02 (`v1data` fuera de la ruta real, `mcplogos` a un paquete), PER-06/07 (sondeo con el WebSocket, 15 fps en reposo), PER-08/09 (cron que sale rápido, `EXPLAIN` en las 10 rutas más llamadas), PER-10 (medir con 2.000 notas sintéticas).
3. Presupuesto y vigilancia en CI (§3.9).

### Fase 7 — UX y seguridad restantes

SEG-02 (normalizar NFKC y quitar invisibles, no tratar la regex como frontera, excluir herramientas con URL libre del chat), SEG-04 (decidir y documentar lo que ve el rol `lectura`), SEG-05 (sesión deslizante de 7 días, «cerrar en todos los sitios», lista de dispositivos), SEG-06 (contador global por correo, Turnstile), SEG-09 (expiración en R2), revisión de los ~400 `innerHTML`, `?token=` fuera en 2 versiones; UX-05 (un solo patrón «hacer y deshacer» o hoja de confirmación), UX-06 (dock en 4 áreas con etiqueta y teclas homogéneas), UX-07 (bienvenida de 3 pasos, semilla neutra, ayuda en el login), UX-09 (capacidades por `/api/health`), `npm audit` en CI.

### Fase 8 — Comunicación del equipo (pedido del dueño, 29 oct)

Es el único frente que añade capacidad nueva; entra por pedido expreso del dueño y se apoya en lo que ya existe (presencia del `Hub`, avisos, Telegram, tareas para una persona). Orden: **N0 → N1 → N2** (en este orden, cada una útil por sí sola), luego **C0-C6** del chat (`docs/plan-chat-interno.md`) ya integrado con las notificaciones, y al final **N3**. N0-N2 pueden arrancar en paralelo con las Fases 1-3 porque no tocan los archivos grandes de la galería ni de Dimitri (§5, carril H). Detalle en §3.10.

### Fase 9 — Vanguardia (VAN-01…18, §3.11)

Va después de las Fases 0-3 y **en paralelo con la 8** donde no choque. Orden por beneficio/costo y por riesgo: primero lo pequeño y de gobierno (**VAN-04, 05, 06, 08, 09, 15**), luego **VAN-03** (red-team; precondición de cualquier cosa con navegador o con más autonomía), **VAN-02, 01, 10, 11, 12, 13, 14, 16**, y al final **VAN-07 (WhatsApp)**, **VAN-17** y **VAN-18 (computer use)**. La línea de IA de Dimitri (UX-11) va en la Fase 0.

## 5. Cómo ejecutarlo con varios agentes en paralelo

Carriles que **no comparten archivos grandes**, pensados para correr a la vez (cada uno en su rama y su worktree, un PR por carril):

| Carril | Fases | Archivos principales | Choca con |
|---|---|---|---|
| A · Estudio-galería | 1 | `media/galeria*.mjs`, `cloudflare/worker/lib/estudio/galeria.js`, `src/galeria-filtro.js`, `src/movil/vistas/estudio*.js`, `src/studio.js` (solo carpetas y borrado) | **B** (también toca `studio.js`): coordinar o secuenciar |
| B · Dimitri y paneles | 3 | `src/sub.js`, `src/css/dimitri.css`, `src/panel-ancho.js`, `src/studio-paneles.js`, `src/css/estudio.css`, `src/main.js` (`chatLeft`) | A en `studio.js`; avisar antes de tocar `main.js` |
| C · Publicación | 2 y CON-09..12 | `contenido/*`, `cloudflare/worker/lib/contenido/*`, `src/pieza.js`, `src/ventana-*.js`, `src/contenido*.js`, `cloudflare/worker/lib/anuncios-nube.js`, `espejo.js` | ninguno si no toca `main.js` |
| D · Nube-Estudio | 4 | `cloudflare/worker/modulos/estudio.js`, `cloudflare/worker/lib/estudio/presets.js`, `build` de la fábrica | A en la galería de la nube: secuenciar tras A.a |
| E · Íconos | 5 | `src/iconos-registro.mjs`, `redes-iconos.js`, `mcplogos.js`, `connectors.js`, `cloudflare/worker/lib/iconos-conectores.js` | `shell.html` si cambia la fuente |
| F · Rendimiento y CI | 6 y 0 (PER, SEG-07/08) | `build.mjs`, `check.mjs`, `cloudflare/public/_headers`, `wrangler.jsonc`, `.github/workflows/*` | todos (solo configuración): último en fusionarse |
| G · Seguridad y UX | 7 | `safety.mjs`, `cloudflare/worker/lib/sesion.js`, `src/detail.js`, `src/dock.js`… | revisar caso a caso |
| H · Comunicación | 8 | `cloudflare/worker/modulos/{chat,recados,notificaciones}.js`, `lib/notificaciones/*`, `lib/avisos.js`, `hub.js`, `telegram-core.mjs`, `modulos/telegram.js`, `src/notificaciones/*` (paquete aparte, **nunca en la página**) | `hub.js` y `telegram.js` los toca poca gente; la campanita añade un botón al dock (`shell.html`/`dock.js`: avisar); Carril B si se cambia el dock |
| I · Vanguardia | 9 y UX-11 | `safety.mjs`, `guardian.js`, `cloudflare/worker/lib/agentes/*`, `costs-core.mjs`, `lib/modelos.js`, `evals/*`, `src/sub.js` (solo UX-11: coordinar con B) | B en `sub.js`; H en `telegram.js` (VAN-07/15) |

Orden recomendado de arranque: **Fase 0 completa primero** (un solo carril, un PR, o por ítems pequeños); después **A + C + B en paralelo** (A y B comparten `studio.js`: A primero en su parte, B después) y D tras A.a. E y F pueden correr en paralelo con cualquiera. Cada carril entrega con `npm run check` verde y los recorridos que le tocan.

## 6. Decisiones que necesito del dueño

1. **Cloudflare Images** (de pago por transformación; precio actual NV): ¿lo activamos para convertir a JPG y para el ejecutor local de presets en la nube, o preferimos WASM en el Worker (gratis pero con tope de CPU)? Recomendación: activar Images (una línea y menos código).
2. **Borrar una carpeta con contenido**: por defecto «subir» los archivos y subcarpetas al padre (nunca se borra nada). ¿Te sirve ese valor por defecto?
3. **«Publicar ahora»**: confirmo que tras publicar ya **no hay deshacer** (solo borrar en Facebook; Instagram no se borra por API). ¿Quieres conservar un «Cancelar» de pocos segundos mientras la pieza aún no salió?
4. **Conversión en el navegador al subir**: guarda un JPEG derivado y conserva el original (ocupa más espacio). ¿De acuerdo?
5. **Rol `lectura`** (SEG-04): ¿puede ver los resultados de los agentes y el Cerebro, o solo tareas y calendario?
6. **Semilla de «Restablecer»**: ¿añadimos una semilla neutra además de «PanaClaw por defecto» y «Vacía»?
7. **Logos de marca**: usar los logos reales (Simple Icons) implica revisar la guía de cada red; ¿aceptas el uso nominativo y que LinkedIn se quede en la versión retirada del paquete?
8. **«Cuando los usuarios entren»**: ¿es la hoja «Mientras no estabas» que ve cada persona al entrar (lo propongo como base), y/o un aviso **al administrador** de que alguien entró («Ana entró»)? Lo segundo es seguimiento de personas: lo dejaría apagado y por persona. ¿Qué eliges?
9. **Quién puede dejar recados**: propongo que cualquier administrador o editor pueda dejarlos a una persona, a un rol o a todos, y que `lectura` solo los reciba. ¿De acuerdo? ¿Y puede un recado «requerir enterado»?
10. **Telegram por cuenta**: ¿cada persona vincula el suyo con un código de un solo uso? ¿El aviso lleva el texto o solo «te dejaron un recado» (propongo solo el aviso, por privacidad)? ¿Qué puede hacer un editor desde Telegram (propongo: recados, `/mias`, `/yo`, `/chat`; aprobar sigue siendo solo del dueño y de los aprobadores)?
11. **Orden**: ¿N0-N2 (notificaciones, recados, Telegram por cuenta) antes o después de la galería del Estudio (Fase 1)? Propongo en paralelo, en carriles distintos.
12. **Investigación de la competencia**: las páginas oficiales de Meta, OpenAI y xAI no se pudieron abrir desde esta sesión, así que §3.11 es de segunda mano. ¿Permites esos dominios (ai.meta.com, research.meta.ai, openai.com, platform.openai.com, help.openai.com, x.ai, docs.x.ai) para repetirla con fuentes primarias antes de invertir?
13. **Prioridades de la Fase 9**: ¿qué te importa más superar primero — autonomía graduada y gobierno (VAN-01/02), WhatsApp (VAN-07), el constructor de rutinas por lenguaje natural (VAN-10), o el enrutamiento de modelos con Muse Spark barato (VAN-11)?
14. **Línea de IA de Dimitri**: ¿«solo avisos» por defecto (propongo), o prefieres quitarla del todo y dejar solo el ⓘ?

## 7. Lo que NO está verificado

- Ninguna medida de tiempo real (TTFB, LCP, compresión efectiva en la nube).
- El comportamiento visual por vista y ancho (DIM) y la causa exacta de que la vista previa «no vuelva» (CON-06): hay que reproducirlos en navegador.
- Capacidades de Cloudflare Images (HEIC, precio), Containers, y el comportamiento de `mutarDoc` ante concurrencia.
- Que `lotes-hoja.mjs` (Excel) sea portable al Worker.
- Si la Bandeja redacta borradores con un modelo sin pasar por `injectionIn` (SEG-02).
- Más de 400 `innerHTML` de `src/` sin revisar uno a uno; `npm audit` no se pudo ejecutar (sin red).
- `agruparGaleria` (carruseles y reels en la galería) no existe en este árbol: confirmar en qué rama vive antes de diseñar su carpeta.
- Comunicación (§3.10): no se midió cuántas personas usan la nube ni cuántos avisos al día habría; el costo de D1 y del `Hub` con un chat real es NV. No se verificó que los ids de `team.people` estén usados hoy por alguien. Las notificaciones push del navegador no se diseñaron en detalle (no hay *service worker*).
- Competencia (§3.11): casi todo de segunda mano; páginas oficiales de Meta, OpenAI y xAI sin abrir; precios y límites contradictorios entre fuentes; «Muse for Small Business», «ChatGPT Work», la retirada de Agent Builder y los datos de Grok 4.7 son de una o dos fuentes secundarias. Que nuestro código use Muse Spark para entender video y audio hay que re-verificarlo.
- Que la nube de verdad devuelva 304 con `If-None-Match` para los paquetes diferidos (la página sí, por test).

## 8. Seguimiento

Cada punto lleva su ID (DIM-xx, EST-xx, CON-xx, PER-xx, ICO-xx, SEG-xx, UX-xx). Al cerrar uno, se marca ✅ aquí **en el mismo commit** y se actualiza `CLAUDE.md`. El estado de las fases:

- [ ] Fase 0 — arreglos rápidos
- [ ] Fase 1 — galería del Estudio
- [ ] Fase 2 — publicar y convertir
- [ ] Fase 3 — Dimitri y paneles
- [ ] Fase 4 — banco de presets en la nube
- [ ] Fase 5 — íconos originales
- [ ] Fase 6 — velocidad
- [ ] Fase 7 — UX y seguridad restantes
- [ ] Fase 9 — vanguardia (VAN-01…18; UX-11 va en la Fase 0)
- [ ] Fase 8 — comunicación del equipo (N0 cimientos · N1 recados · N2 Telegram por cuenta · C0-C6 chat · N3 resumen y push)
