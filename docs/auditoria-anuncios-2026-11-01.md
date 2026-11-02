# Auditoría del panel de Anuncios — verificación contra el código (1 nov 2026)

Hecha leyendo el código (no se puede ver la cuenta real de Meta del dueño ni la producción). Los puntos 1–4 y 15 (cálculos y umbrales) los lleva otro carril y no se tocan aquí.
**Aviso de honestidad:** en esta sesión la terminal dejó de funcionar (error E2BIG), así que no se corrió ningún test ni se tocó código: todo lo de abajo es análisis de lectura, y las correcciones del punto 17 quedan **diseñadas, no implementadas**.

## Tabla de veredictos

| # | Punto | Veredicto | Qué hace el código hoy | Qué falta | Quién |
|---|---|---|---|---|---|
| 5 | Desgloses (edad, sexo, plataforma, hora) | CIERTO | `anuncios/meta-ads.mjs` pide `/insights` solo con `level=ad&time_increment=1` y `alcance`; ningún `breakdowns` en todo el repo de `anuncios/` | Diseño abajo | Código |
| 6 | Columna Aprendizaje | FALSO | Sí se lee `learning_stage_info` (`meta-ads.mjs:25`) y `modelo.mjs:66-67` lo traduce (Aprendiendo / Fuera / Limitado) | Revisar si la columna del panel lo enseña en todas las vistas; si sale vacío con cuenta real, es dato de Meta | Código (verificar con cuenta real) |
| 7 | Recomendaciones y problemas | PARCIAL | Conjuntos y anuncios piden `issues_info` (`meta-ads.mjs:25,27`); campañas **no** lo piden; **no existe** lectura de `recommendations` (ni de campaña ni de conjunto) ni de diagnósticos del conjunto de datos | Añadir `recommendations` (GET por campaña/conjunto) y `issues_info` en campañas. Por eso «0 problemas» con una recomendación abierta en Meta: la recomendación (ubicaciones Advantage+) no es un `issues_info` | Código |
| 8 | Historial de cambios hechos fuera | CIERTO (no existe) y VIABLE | `sincronizar.mjs:122-123`: cada lectura **sobrescribe** `cuenta.json` (en la nube, una fila de D1) sin mirar la anterior; el historial solo apunta lo hecho desde la oficina (`anotar`) | Diseño abajo | Código |
| 9 | Tabla por anuncio con CRM | PARCIAL | Webhook de conversiones (`rutas.mjs:94-95,194`, nube `modulos/anuncios.js:184`) **ya acepta** `ctwa_clid`, `whatsapp_business_account_id`, `event_id`, `canal`. Pero no se guarda por anuncio ni hay tabla llegaron/contestaron | Diseño abajo | Código + el CRM del dueño |
| 10 | Número de WhatsApp | PARCIAL | `settings.mjs:46` valida `^\d{5,25}$` (solo dígitos; rechaza «+», espacios y guiones). **El número no se manda a Meta**: solo sirve para saber si hay WhatsApp (`modelo.mjs:435,477,551`); el botón usa `api.whatsapp.com/send` y `promoted_object {page_id}`: el número real es el vinculado a la página en Meta | Regla propuesta abajo; el valor lo cambia el dueño | Dueño |
| 11–13 | Conjunto de datos / eventos / emisor | CIERTO (documentado) | Ver sección propia | Decisión del dueño | Dueño |
| 14 | CPA bueno y cifras | CIERTO | `anuncios.cpaObjetivo` (`settings.mjs:50`, 0 = se calcula de `cifras.json`) | Pasos abajo | Dueño |
| 16 | AO_HOOK_TOKEN | CIERTO | Declarado en `cloudflare/secretos.json:8`; sin él (o con menos de 16 caracteres) no hay webhooks (`ajustes.js:14,62`) | Pasos abajo | Dueño |
| 17 | Cola «12 esperando, 0 en marcha» | PARCIAL — causa más probable = falsa alarma de conteo, no fallo de la cola | Ver sección propia | Explicación en palabras | Código |
| 18 | «No hay rutinas» | CIERTO | En la nube las rutinas viven en D1; la de fábrica `revision-anuncios` está en `brain-panaclaw/Agents Office/routines.json` pero **solo llega con la migración manual** (`scripts/migrar/tareas.mjs`) o creándola con `POST /api/routines` | Crear las dos rutinas | Dueño/Código |
| 19 | Saldo 14,89 US$ | PARCIAL | `modelo.mjs:277` muestra `balance` de la cuenta publicitaria. En Meta, `balance` es lo que **se debe** (por pagar), no el saldo disponible; para prepago el disponible sale de `funding_source_details`, que no se lee. El panel lo rotula «saldo» (`resumen.js:63`) | Rotular bien y avisos | Código |

## Punto 5 — desgloses: diseño
- Hoy no hay ninguno. Añadir `desglose(cuenta|campaña, tipo, rango)` en `meta-ads.mjs` usando `lote()` (solo GET): tres peticiones `insights` con `level=campaign`, `date_preset`/`time_range` y `breakdowns` = `age,gender` · `publisher_platform,platform_position,device_platform` · `hourly_stats_aggregated_by_advertiser_time_zone` (esta va sola: Meta no la combina). Campos: `spend,impressions,actions,cost_per_action_type`.
- **Cuándo:** solo al abrir el detalle de una campaña (bajo demanda, nunca en el sondeo), con caché de 6 h por campaña+rango. Costo: 1 llamada HTTP al lote (3 peticiones internas que Meta cuenta por separado en el freno por uso: pasan por `meta.enviar`, que ya frena). En la nube: 1 subrequest y 1–2 consultas D1 (guardar caché en una fila): cabe de sobra en el límite de 50 y de 100 parámetros.
- **Vista:** tres tablas pequeñas en el detalle de campaña (tramo, gasto, resultados, costo por resultado, % del total de resultados) con la frase de mayor concentración («los 65+ son el 49 % de las conversaciones»). Datos nuevos de solo lectura; sin tabla propia salvo la caché.

## Punto 7 — recomendaciones
Añadir `recommendations` y `issues_info` a campañas y conjuntos, leídos junto con la estructura solo si Meta responde bien (si un campo falla, el lote falla solo esa petición). Mostrarlas en «Con problemas» (las que Meta marca) y «Sugerencias» (como notas, sin botón de aplicar: nunca cambian nada solas).

## Punto 8 — cambios hechos fuera
En `sincronizar.mjs`, antes de escribir `cuenta.json` ya está disponible `guardado()` (la lectura anterior). Comparar por id: estado, presupuesto diario/total, fechas, público (`targeting`), ubicaciones, anuncios nuevos/desaparecidos/pausados. Cada diferencia → `anotar({ quien: 'fuera de la oficina', que, objeto, antes, despues })`, **sin duplicar** lo que la oficina acaba de hacer (comparar con las últimas entradas del historial de los últimos minutos). Solo la primera lectura no compara. La nube guarda el historial en una fila con tope: ya hay recorte, no crece sin límite. Caben las comparaciones: `cuenta.json` guarda la estructura completa.

## Punto 9 — anuncio ↔ conversación ↔ venta
- Hoy sirve: el webhook ya recibe `ctwa_clid`, `waba`, `event_id`, valor y teléfono/correo; el evento se guarda **con hashes** (`resumen()` no guarda datos personales).
- Falta: guardar por evento el `ad_id` (el CRM lo conoce por el anuncio de origen del clic) y una tabla `anuncio_embudo(ad_id, dia, llegaron, contestaron, leads, ventas)` alimentada por: (a) lo que ya cuenta Meta (conversaciones iniciadas por anuncio, de `actions`), (b) eventos del CRM por una ruta nueva `POST /api/anuncios/embudo` con `X-Office-Token`: `{ ad_id|ctwa_clid, tipo: contestó|lead|venta, valor?, event_id }` (idempotente por `event_id`).
- «% que contesta» = contestaron / llegaron; costo por conversación que contesta = gasto / contestaron. Necesita que el CRM mande `contestó`. Sin ese dato la columna dice «sin datos», nunca un número inventado.

## Punto 10 — WhatsApp: la regla
1. Aceptar al guardar `+`, espacios y guiones y quedarse con los dígitos; validar 8–15 dígitos y que **con código de país** (Panamá: 507 + 8 dígitos = 11): `62272025` (8 dígitos) debe fallar con «falta el código de país 507».
2. Dejar claro en la ayuda que ese campo **no es lo que se manda a Meta**: el número del anuncio es el vinculado a la página en Meta (Administrador de WhatsApp). Cambiarlo aquí no cambia ningún anuncio.
Hoy el código no completa nada mal: simplemente rechaza todo lo que no sean dígitos (`^\d{5,25}$`) y acepta `62272025` sin código. **El dueño** lo corrige en Ajustes → Anuncios con el número en formato 50765310721 (o el que corresponda).

## Puntos 11–13 — conjunto de datos y eventos (recomendación)
**Qué manda la oficina hoy** (`anuncios/conversiones.mjs`; APAGADA por defecto: `anuncios.conversiones` no tiene `default`, es falso si nadie la enciende — confirmado en `settings.mjs:53`):
- Al conjunto `anuncios.pixel` (hoy 1067898639025746).
- Disparador `stripe` → `Purchase` (web/sistema) con importe; disparador `form` → `Lead`.
- Bandeja: «Registrar venta» → `Purchase`; «Registrar contacto calificado» → `QualifiedLead`; un lead que llega por mensajes → `LeadSubmitted`.
- Webhook propio → el nombre que le pongan (`Purchase`/`Lead`/…).
**Deduplicación:** el `event_id` es el que mande el CRM (`event_id` en el webhook); si no, la oficina inventa `ao_`+hash(origen|ref|nombre) (`conversiones.mjs:76`). Meta deduplica con el mismo `event_name` + `event_id`: para que coincidan, el CRM tendría que mandar su mismo id a la oficina, o dejar de mandar uno de los dos. Los nombres distintos (LeadSubmitted vs QualifiedLead) **no se deduplican entre sí**: contarían doble.
**Recomendación (coincide con la auditoría):** un solo emisor (el CRM), al conjunto 1095819939503063, con un solo nombre por hecho; la oficina **no manda nada** y solo lee. Pros: sin duplicados, el CRM sabe quién compró de verdad. Contras: si el CRM falla, Meta no se entera (la oficina no respalda); hay que cambiar `anuncios.pixel` a 1095819939503063 para que las lecturas y el ROAS miren el mismo conjunto. Interruptores: dejar **apagado** `anuncios.conversiones` (ya lo está) y revisar que los disparadores `stripe`/`form` no tengan `conversion` activo. Decisión del dueño.

## Punto 14 — pasos para el dueño
1. Oficina en la nube → Ajustes → **Anuncios** → «Costo por resultado que te parece bueno (US$)» → escribe 3,00 → Guardar.
2. Ajustes → **Cifras de la empresa** → pon el valor de venta (295), el margen y la tasa de cierre → Guardar. Con el costo puesto, las cifras solo se usan si lo dejas en 0.

## Punto 16 — AO_HOOK_TOKEN (pasos; no se crea ningún valor aquí)
1. Inventa tú una clave larga (16 caracteres o más, letras y números). No la pegues en chats ni archivos.
2. GitHub → repositorio → Settings → Secrets and variables → Actions → New repository secret → Nombre `AO_HOOK_TOKEN`, valor tu clave.
3. Pestaña Actions → «Cloudflare · desplegar» → Run workflow (rama main; puede pedir aprobar el entorno «produccion»). Ese flujo sube a Cloudflare los secretos declarados en `cloudflare/secretos.json` (ya incluye `AO_HOOK_TOKEN`).
4. Ajustes → Estado: «Disparadores» deja de decir que falta el secreto. Usa la misma clave como cabecera `X-Office-Token` en el CRM.

## Punto 17 — la cola «atascada» (investigación)
**Cómo trabaja la nube:** cada minuto `correrReloj` (`lib/rutas.js:45-54`) corre todos los módulos en orden, con `agentes` el **último**; `agentes.cadaMinuto` (`modulos/agentes.js:127`) hace: aprobaciones → corridas pendientes → `tomarSiguiente` (solo si hay llave de IA, línea 142) → avanzar corridas.
**Qué deja una tarea en cola sin arrancar** (`tareas/cola.mjs:30-48`, razón por tarea): `persona` (es de una persona), `bloqueada` (depende de otra), `reintento` (espera su hora), `agente` (ese agente ya tiene una en curso), `presupuesto` (tope del mes con «detener»), `oficina` (se llenó el tope de procesos a la vez, 3 por defecto); además, sin llave de IA (`hayLlave`) no se toma nada.
**Hallazgo (probable falsa alarma):** `estado()` (`agentes.js:108-109`) cuenta como «esperando» **toda** tarea `state === 'next'`, incluidas las **tuyas y las de personas** (que la cola nunca arranca) y las bloqueadas. Tus tareas de «Mías» y las delegadas a personas nacen en `next` (`rutas-dueno.mjs:75,120`). Si son 12, sale «12 esperando; 0 en marcha» y, pasada una hora, ámbar «atascada» aunque no haya nada que arrancar. Lo mismo ocurre en la oficina local (`serve.mjs:2348`). «En marcha» solo cuenta corridas vivas (`corridasVivas`), no tareas `doing`.
**Otras causas reales posibles (no verificables sin la producción):**
- Un `doing` huérfano retiene a su agente (y ocupa un hueco de los 3); hay recuperación a los 3 min (`ejecutor.js:496`), así que se limpia solo salvo fallo repetido.
- Si en el plan gratuito la suma de consultas D1/peticiones de todos los módulos pasa de 50, `agentes` (el último) es el primero en quedarse sin ellas; el error solo va a `console.error` (`rutas.js:53`) y el dueño no lo ve. Hay que mirar los registros del Worker (`wrangler tail`) por «Too many subrequests». Si la cuenta es de pago (necesaria para Anuncios/Bandeja, fase 7), no aplica.
- Falta de llave (Estado ya lo pone en rojo), presupuesto cruzado con «detener» (Estado → «Presupuesto del mes»).
**Corrección diseñada (no implementada por la falla de terminal):** (1) función pura `explicarCola(tareas, {max, ahora, sinPresupuesto})` en `tareas/cola.mjs` que reutiliza `planear().puestos` y devuelve conteos por razón; (2) en `estado()` de la nube y en `serve.mjs`: texto «12 en la lista: 9 son tuyas o de personas, 2 bloqueadas por otra tarea, 1 espera a que su agente termine; N esperan tu OK» y ámbar solo si hay tareas con razón `turno/oficina/agente` de más de una hora; (3) un aviso `doing` sin corrida de más de 10 min; (4) tests con `ahora` fijo (planear ya recibe `ahora`). Qué ve hoy el dueño: Ajustes → Estado → «Cola de trabajo» y «Aprobaciones».

## Punto 18 — rutinas en la nube
Crear con `POST /api/routines` (administrador; también desde el calendario → rutina). Las del repo **no** llegan solas (solo por la migración única). Propuestas, ambas solo leen (`needsOk: false`):
1. `lectura-meta-diaria` — dept `marketing`, agente `ada`, `when {kind:'daily', at:'07:30'}`: «Lee la cuenta, campañas y cifras de ayer (ver_cuenta_anuncios, ver_campanas, ver_resultados_anuncios) y deja una nota de 5 líneas con gasto, resultados y alertas. No cambias nada.»
2. `informe-lunes-anuncios` — mismo dept/agente, `when {kind:'weekly', days:[1], at:'08:30'}`: el texto de `revision-anuncios` del repo ampliado con «termina con una tabla de decisión: anuncio · dato · mantener/cortar/escalar · porqué».
Falta: que el dueño las cree (o pedirle a Dimitri), y Meta conectado en la nube (`META_ACCESS_TOKEN`).

## Punto 19 — saldo
`balance` de Meta = lo adeudado (facturado pero sin pagar); no es crédito disponible. `amount_spent` = gastado en total; `spend_cap` = tope de la cuenta. Cambio propuesto: rotular «Por pagar» (o leer `funding_source_details` para un prepago) y un aviso (solo aviso, nunca gasta) cuando lo por pagar o el disponible baje del gasto de un día (`topeDiario`), con la misma lógica «una vez por día» de `revisarAvisos` (`sincronizar.mjs:94-108`). Por el nombre «Saldo 14,89 US$» el dueño pudo creer que le queda ese crédito.

## Punto 20 (pedido del dueño, 2 nov 2026): ¿sobre QUÉ cuenta corre cada anuncio? ✅
El portafolio tiene UNA cuenta publicitaria compartida por varias páginas de Facebook e Instagram, y ni Anuncios ni la Bandeja decían de cuál cuenta era cada cosa (Analíticas sí). **Hecho (solo lectura y presentación; la regla del dinero no se tocó):**
- **Anuncios:** cada campaña, conjunto y anuncio lleva su cuenta (`cuentas`, `cuentaTexto`, `cuentaClave`), sacada **sin llamadas nuevas** del creativo (`object_story_spec.page_id`, `instagram_user_id`/`instagram_actor_id`, prefijo de `effective_object_story_id`) y, si no, del `promoted_object.page_id` del conjunto (`anuncios/cuentas.mjs`); el nombre y el @usuario, de `meta.estado().cuentas`. Sin pista: «cuenta no identificada», nunca se adivina. El único campo nuevo pedido a Meta es `instagram_user_id` del creativo (POR VERIFICAR con la cuenta real). Resumen → «Por cuenta» (gasto y resultados de cada marca; un anuncio cuenta una vez), filtro «Cuenta» en Resumen, Campañas y Creativos (`?cuenta=` en la API), la cuenta en el detalle, Sugerencias, Borradores (la página de Ajustes → Anuncios, o la de la campaña ya creada), Historial (la cuenta del momento) y **en la hoja de confirmación del gasto** (línea «En: …»; el flujo de dos clics, los topes y los tokens no cambian).
- **Bandeja:** cada comentario y mensaje lleva `deCuenta` (nombre, @usuario, foto), la fila y el hilo la dicen, el filtro por cuenta, «Responderás como @cuenta en Instagram» y el segundo clic lo repite (la hoja del teléfono también). **Arreglo de fondo:** los comentarios de un ANUNCIO se leían siempre con la primera página/Instagram encontrados; ahora van a la página del anuncio (prefijo de su historia) y al Instagram de su creativo, y con varios Instagram y sin pista no se adivina (se salta y se dice).
- **Dimitri, agentes y asistente:** los textos dicen la cuenta de cada objeto y el reparto por cuenta; `ver_campanas`, `ver_resultados_anuncios`, `ver_anuncios` (asistente y Dimitri en la nube) y `ver_bandeja` aceptan `cuenta`. Telegram nombra la cuenta al pedir el segundo toque.
- **Pendiente:** «Impulsar» y la creación de campañas siguen usando la única página/Instagram de Ajustes → Anuncios (si una pieza se publicó en otra página, el borrador sale con la de Ajustes: el borrador ahora lo dice, pero elegir otra por borrador es un cambio de escritura que no se hizo aquí). Nada se probó contra Meta real.

## No verificado
Todo lo que depende de la cuenta real de Meta y de la producción: si el 14,89 es deuda o crédito, lo que Meta devuelve en `learning_stage_info`/`recommendations`, si la cuenta de Cloudflare es de pago, qué dicen los registros del cron, el contenido de los ajustes guardados (WhatsApp 62272025, píxel).
