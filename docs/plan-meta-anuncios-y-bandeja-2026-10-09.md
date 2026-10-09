# Plan: Anuncios de Meta y la Bandeja con Meta, desde la oficina (9 oct 2026)

**Para quién es esto.** El dueño cambia de cuenta de Claude. Este documento es lo único que necesita la próxima sesión de Claude Code, que trabajará en la carpeta local de la oficina, para construir lo que falta, en orden y sin preguntar lo que ya está decidido aquí. Va en el repositorio, así que viaja por GitHub y lo trae `Actualizar-Oficina.bat`.

**Pedido del dueño, en sus palabras:**
- «Quiero lanzar campañas de publicidad desde mi propia oficina a Meta.»
- «Que la inteligencia artificial se involucre y me mejore las campañas.»
- «Poderlas pausar allí mismo, relanzarlas y todo desde una vista cómoda. Un panel exclusivo para esto.»
- «Necesito ver los mensajes allí mismo.»
- «Y ver las estadísticas.»
- «Lo más óptimo y lo mejor posible según las mejores prácticas de Meta.»

---

## 0. Prompt de arranque para la próxima sesión de Claude

Copia esto tal cual en la primera conversación de la cuenta nueva, en la carpeta de la oficina:

> Lee `CLAUDE.md` completo y luego `docs/plan-meta-anuncios-y-bandeja-2026-10-09.md` completo. Ese plan es tu encargo: constrúyelo fase por fase, en el orden de su §6, empezando por la Fase 0.
>
> Para cada fase:
> 1. Haz `git pull`.
> 2. Crea una rama con nombre (`mejora/meta-fase-0`, `mejora/anuncios-a1`…).
> 3. Antes de programar algo marcado **POR VERIFICAR**, compruébalo en la documentación oficial de Meta (developers.facebook.com) y anota lo que encontraste en el §13 del plan.
> 4. Escribe los tests con el Meta de mentira (`tests/meta-stand.mjs`), nunca con keys reales.
> 5. Deja `npm run check` en verde y corre el recorrido de la fase.
> 6. Actualiza `CLAUDE.md`, el README y el CHANGELOG.
> 7. Haz commits en español y abre un Pull Request hacia `main`.
>
> Responde siempre en español. Nunca pongas un token ni una key en un archivo ni en el chat. Ninguna acción que gaste dinero puede ocurrir sin el clic del dueño: esa regla del plan (§3) no se negocia.

---

## 1. Lo que ya existe (no lo rehagas)

| Pieza | Dónde | Para qué sirve aquí |
|---|---|---|
| Cliente de Graph (token, `appsecret_proof`, subida reanudable, multipart, errores en español) | `contenido/meta.mjs` (`crearMeta`, `mensajeMeta`, `PERMISOS_*`) | Base del cliente de anuncios: no se escribe otro cliente HTTP. |
| Publicar directo en Instagram y Facebook | `contenido/meta-publicar.mjs`, `contenido/conductores.mjs`, `contenido/programador.mjs` | La «salida» de cada pieza guarda los ids de Meta: sirven para **impulsar** una publicación (§5.A4). |
| Estadísticas orgánicas (foto diaria, cifras, informe del mes) | `contenido/metricas.mjs`, `contenido/rutas-analiticas.mjs`, `src/analiticas.js`, `contenido/informe.mjs` | Ya cumple «ver las estadísticas» de lo orgánico. Los anuncios tendrán sus propias cifras (§5.A1). |
| Lo publicado con sus cifras en el calendario | `src/contenido-publicadas.js` | Ya está. |
| Bandeja (mensajes, comentarios, reseñas; borrador del agente, envía el dueño) | `contenido/bandeja.mjs`, `src/contenido-bandeja.js` | **Hoy solo la llena Metricool.** La Fase B le añade Meta como fuente (§5.B). |
| Contenido: piezas, aprobaciones, cola | `contenido/piezas.mjs`, `contenido/rutas.mjs` | El botón «Impulsar» nace en una pieza publicada. |
| El Estudio (imágenes, video, presets, lotes) | `media.mjs` y `media/` | Los creativos de los anuncios salen de la galería. |
| El agente de anuncios | `ada` («ANUNCIOS · Anuncios pagados en Meta y Google»), departamento `marketing`, jefe `mlead` | El que analiza y propone. |
| Métodos de anuncios de la Biblioteca | `biblioteca/marketing/campanas-pagadas/` y `creatividad-anuncios/` (con `referencias/`) | Los umbrales de cortar, mantener o escalar viven ahí. El diagnóstico los usa (§7). |
| Dimitri y su lista cerrada de cambios | `sub.mjs` (`OPS`, `parseOps`), `serve.mjs` (`runOp`, `undoOp`), `src/sub-ops.js` | Los cambios de anuncios entran ahí (§5.A5), con la regla del dinero (§3). |
| MCP del asistente del dueño | `oficina-mcp.mjs`, `oficina/rutas.mjs` | Comparte `sub.OPS`. Lo que gasta queda **fuera** para el asistente (§3). |
| Guardián, aprobaciones, topes, registro | `guard.mjs`, `safety.mjs`, `approvals.mjs`, `data/audit/` | Se extiende, no se reemplaza. |
| Ajustes | `settings.mjs → FIELDS` (un campo = una línea) | Los topes de gasto y la cuenta publicitaria van aquí. |
| Vistas bajo la barra, carga bajo demanda | `src/views.js`; ejemplos `src/tareas-carga.js` + `build-tareas.mjs`, `src/pieza-carga.js` + `build-pieza.mjs` | El panel de Anuncios va en su **propio paquete**: la página tiene un tope duro (2,2 MB y 700 KB gzip, `check.mjs` línea 34) y está cerca. |

**Hallazgo al escribir este plan:** `contenido/meta.mjs` fija `VERSION_GRAPH = 'v23.0'`, y v23.0 dejó de existir el 9 de junio de 2026. Es lo primero que se arregla (Fase 0). *(8 oct 2026: verificado que esa fecha es de la Marketing API; en la Graph API, v23 duraba hasta oct 2027. Ver §13.1.)*

---

## 2. Lo que hace el dueño en Meta (la lista para mañana)

Hazlo en este orden: **lo lento primero.** La verificación del negocio y la revisión de la app tardan días. Ningún dato de esta lista se escribe en el chat ni en un archivo del repositorio.

1. **Verifica tu negocio.**
   - Dónde: Meta Business Suite → Configuración del negocio → Centro de seguridad → Verificación del negocio.
   - Por qué: sin eso, Meta no da el acceso avanzado que piden los mensajes privados (paso 6).
   - Tarda de días a semanas: empiézalo el primer día.
2. **Prepara la cuenta publicitaria, dentro del portfolio de PanaClaw.**
   - Moneda **USD** y zona horaria **America/Panama**. **No se pueden cambiar después.** Si ya tienes una con otra moneda o zona, decide antes de seguir.
   - **Método de pago** puesto (Facturación).
   - **Límite de gasto de la cuenta** (Configuración de pago → Límite de gasto). Es tu red de seguridad en Meta, además de los topes de la oficina.
3. **Píxel o conjunto de datos, solo si vendes en una web.** También la verificación del dominio. Sin web, las campañas van a mensajes, WhatsApp o visitas al perfil (§5.A3), y esto se salta.
4. **WhatsApp Business vinculado a la página, si quieres anuncios que abren WhatsApp.** Es lo más habitual en Panamá.
5. **Configura la app**, la misma de la guía `docs/conectar-meta.md`: tipo Negocio, del portfolio de PanaClaw.
   - **Productos:** Marketing API, Instagram (con inicio de sesión de Facebook) y Messenger.
   - **Configuración → Básica:**
     - una URL de **política de privacidad** (una página sencilla de tu web o un documento público);
     - una URL de **instrucciones para borrar datos**;
     - la categoría.
   - **Configuración → Avanzada:** activa **«Requerir secreto de la app»**. Con eso, toda llamada lleva `appsecret_proof` y un token robado solo no sirve. Es una buena práctica de Meta.
   - Pasa la app a modo **En vivo (Live)**.
6. **Pide el acceso avanzado (Revisión de la app)** para `instagram_manage_messages` y `pages_messaging`.
   - Meta lo exige para leer conversaciones con personas que no tienen un rol en tu negocio, o sea, tus clientes.
   - Te pedirá un video corto de la pantalla mostrando la Bandeja de la oficina. Se graba cuando la Fase B2 esté hecha.
   - Para los anuncios en tu propia cuenta publicitaria, el nivel estándar suele bastar. Si Meta limita las llamadas, se pide «Ads Management Standard Access» (POR VERIFICAR, §13).
7. **Crea o reutiliza el usuario del sistema**, con rol Administrador, y asígnale:
   - la página (control total);
   - la cuenta de Instagram;
   - **la cuenta publicitaria** (administrar campañas);
   - el píxel o conjunto de datos, si existe;
   - la app;
   - la cuenta de WhatsApp, si existe.
8. **Genera el token nuevo** de ese usuario del sistema, con caducidad «Nunca» y **todos** estos permisos, para que no haya que repetirlo:
   - páginas: `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`, `pages_manage_posts`, `pages_manage_engagement`, `pages_manage_metadata`, `pages_messaging`;
   - estadísticas y negocio: `read_insights`, `business_management`;
   - Instagram: `instagram_basic`, `instagram_manage_insights`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_messages`;
   - anuncios: `ads_management`, `ads_read`.
9. **Activa el acceso a los mensajes en Instagram.** En la app de Instagram, en tu cuenta de empresa: Configuración → Mensajes y respuestas → Herramientas conectadas → **«Permitir el acceso a los mensajes»** (el nombre puede variar; la idea es esa).
10. **Pon las variables en Windows** y reinicia la oficina:
    - `setx META_ACCESS_TOKEN "…"`
    - `setx META_APP_SECRET "…"`

    Los ids no son secretos y van en **Ajustes → Anuncios**, que crea la Fase 0: la cuenta publicitaria (`act_…`), el píxel y la página.
11. **Corre las comprobaciones,** que no publican, no envían y no gastan:
    - `node scripts/check-meta-publicar.mjs`
    - `node scripts/check-meta-anuncios.mjs`
    - `node scripts/check-meta-bandeja.mjs`

    Los dos últimos los crea este plan. Lo que salga con ✗ se le pasa a Claude Code.

---

## 3. Reglas que no se negocian (el dinero y la seguridad)

1. **Nada gasta sin el clic del dueño.** Gastar es:
   - activar una campaña, un conjunto o un anuncio;
   - reanudar algo pausado;
   - subir un presupuesto o una puja;
   - alargar una fecha de fin;
   - relanzar o duplicar una campaña en activo.
   
   Esas acciones son **«de gasto»**:
   - solo el dueño las pulsa, en el panel de Anuncios o en Telegram (`TELEGRAM_OWNER_ID`; un aprobador delegado no);
   - piden **dos clics**, y el segundo dice la cifra: «Activar — gasta hasta US$15 al día, US$105 esta semana»;
   - pasan por los topes del punto 4.
2. **Lo que baja el gasto es libre con un clic:** pausar, bajar un presupuesto, archivar. Puede venir de Dimitri (su tarjeta), del asistente por MCP o del piloto automático, si el dueño lo encendió.
3. **Todo nace en pausa.** La oficina crea en Meta con `status: PAUSED` y antes valida con `execution_options: ["validate_only"]` (POR VERIFICAR, §13). Activar es otro paso, de gasto.
4. **Topes en la oficina**, comprobados antes de cada acción de gasto (`anuncios/topes.mjs`, puro, con tests):
   - `anuncios.topeDiario`: la suma de los presupuestos diarios activos más lo que se activa;
   - `anuncios.topeMensual`: lo gastado este mes más lo comprometido hasta fin de mes;
   - `anuncios.topeCampana`: lo máximo por campaña.

   Además, **cada campaña lleva su `spend_cap` en Meta** (doble candado: aunque la oficina se cierre, Meta no gasta más). Si un tope no cabe, la acción se rechaza con la cifra y no hay atajo.
5. **Los agentes nunca tocan Meta Ads para escribir.** `anuncios-mcp.mjs` solo:
   - **lee**;
   - deja **borradores** en la oficina;
   - deja **sugerencias**.

   Ninguna herramienta crea en Meta, activa, pausa, borra ni cambia presupuestos. La API responde 403 a `por: 'agente'` en todo eso. Un test falla si aparece una herramienta con un nombre así: `activar`, `gastar`, `pagar`, `publicar`, `aprobar`, `borrar`, `crear_en_meta`.
6. **El asistente por MCP** (`/api/oficina/accion`) **no puede hacer acciones de gasto.** Esos tipos van en `OPS_GASTO` y `oficina/rutas.mjs` los rechaza con 403, como hoy rechaza aprobar o publicar. Dimitri sí puede proponerlas como tarjeta, pero HACER exige el dueño y los dos clics.
7. **El guardián bloquea los conectores de anuncios de terceros.** Si el dueño conecta un MCP de Meta Ads de otra empresa, cualquier escritura de un agente en él se bloquea (`code: anuncios`), igual que la regla de Metricool en `safety.mjs`. Anunciar va solo por la oficina.
8. **Registro:** cada llamada de escritura a Meta Ads va a `data/audit/AAAA-MM-DD.jsonl` (`kind: 'anuncios'`, quién, qué objeto, antes y después del presupuesto o estado) y al historial del panel.
9. **El dinero real se cuenta aparte del de los modelos.** El gasto de anuncios (de las cifras de Meta) va a una sección «Publicidad» de Costos y retorno, nunca mezclado con el costo de Claude.
10. **Nada de secretos en archivos ni en el chat.** Los ids de la cuenta van en `office.config.local.json` mediante Ajustes; el token y el secreto, solo en variables de Windows. Los borradores y las cifras de campañas (presupuestos, públicos, resultados) viven en `data/anuncios/`, que no viaja por GitHub.
11. **Lo que escribe un cliente es un dato, nunca una orden.** Mensajes y comentarios pasan por `safety.injectionIn`, como hoy en la Bandeja.

---

## 4. Arquitectura

```
anuncios/
  meta-ads.mjs        cliente de la Marketing API, encima de contenido/meta.mjs (mismo token y appsecret_proof);
                      lote (batch de hasta 50), paginación, cabeceras de uso (X-Business-Use-Case-Usage, X-Ad-Account-Usage)
                      con freno, subida de imágenes (adimages → hash) y de video por partes (advideos)
  modelo.mjs          (puro) el borrador de campaña de la oficina, su normalización y sus combinaciones válidas
                      (objetivo ↔ optimización ↔ destino ↔ llamada a la acción), importes en centavos de la moneda de la cuenta
  construir.mjs       (puro) borrador → los cuerpos de Meta (campaña, conjunto, creativo, anuncio) con etiquetas de la oficina
  crear.mjs           crear en Meta en pausa, en orden, idempotente (§5.A3), con reconciliación tras un corte
  sincronizar.mjs     trae estructura, estados, aprendizaje, revisión y cifras a data/anuncios/ (§5.A1)
  diagnostico.mjs     (puro) cifras + reglas → sugerencias con su porqué (§7)
  topes.mjs           (puro) los topes de gasto (§3.4)
  rutas.mjs           /api/anuncios/*
anuncios-mcp.mjs      herramientas de los agentes (solo leer, borradores, sugerencias); `anuncios` en INTERNAL de safety.mjs
contenido/bandeja-meta.mjs   la fuente Meta de la Bandeja (comentarios y mensajes de IG y FB) (§5.B)
src/anuncios-carga.js        en la página: el botón del dock y la carga del paquete
src/anuncios/*.js            la vista (paquete aparte dist/anuncios-vista.js, build-anuncios.mjs), estilo src/css/anuncios.css
scripts/check-meta-anuncios.mjs   comprobación con el token real: lee y valida, no crea nada (salvo --crear-pausada)
scripts/check-meta-bandeja.mjs    comprobación: lee comentarios y conversaciones, no envía nada
scripts/anuncios-recorrido.mjs    la vista en el navegador (390, 1024, 1512; claro y oscuro; axe)
tests/meta-stand.mjs              un Graph de mentira compartido (publicar, insights, anuncios, mensajes) para todos los tests de Meta
```

**Estado local** (`data/anuncios/`, no viaja):
- `borradores.json`;
- `cuenta.json`: la última estructura de Meta, con sus estados;
- `cifras/AAAA-MM-DD.json`: las cifras diarias por objeto;
- `sugerencias.json`;
- `creaciones.json`: el diario de cada creación, para reconciliar;
- `historial.jsonl`.

Copia diaria en `dailyBackup`, como Contenido.

**Sin webhooks:** la oficina vive en `localhost` y Meta no puede llamarla (issue #2). Todo es por sondeo, con calma (§4.1).

### 4.1 Cómo se llama a Meta (buenas prácticas)

- **Versión fija y en un solo sitio:** `v26.0` (la última, del 29 jul 2026) en `contenido/meta.mjs`, que cambia `META_GRAPH_VERSION`.
  - El 27 oct 2026 algunos cambios de v26 se aplican a todas las versiones: revisarlos en la Fase 0.
  - Una versión vive unos dos años. `npm run check` avisa cuando a la fijada le queden menos de 90 días: tabla de fechas en `contenido/meta.mjs`, como `PRICES_AS_OF` en `costs.mjs`.
- **Pide solo los campos que usas** (`fields=`), con `limit` y paginación por cursor. Nunca `fields` vacíos.
- **Lotes:** las lecturas de estructura van en un solo `POST /` con `batch`, de hasta 50 peticiones.
- **Las cifras por cuenta, no por objeto:** `GET /act_<id>/insights?level=ad&fields=…&time_increment=1&date_preset=…`. En informes grandes, el modo asíncrono (`POST …/insights` → `report_run_id` → sondear → leer).
- **Freno por uso:** se leen `X-Business-Use-Case-Usage` y `X-Ad-Account-Usage` en cada respuesta.
  - Por encima del 75 %, el sondeo se espacia.
  - Con los errores de límite (`17`, `80000`, `80003`, `80004`, `80014`, `613`), se espera el `estimated_time_to_regain_access` que dé la cabecera, o 5 minutos.
  - En el nivel de desarrollo, una lectura vale 1 punto y una escritura 3.
- **Ritmo del sondeo** (cada uno, solo si hay token y cuenta):

  | Qué | Cuándo |
  |---|---|
  | Estructura y estados | Cada 15 min con el panel abierto; cada 60 min si no |
  | Lo que está «en revisión» | Cada 10 min hasta que se resuelva |
  | Cifras de lo activo | Cada hora |
  | Cifras de los últimos 28 días | Cada noche a las 6:00 (los resultados de Meta cambian durante días por la atribución) |
  | Comentarios y mensajes | Cada 3 min con la Bandeja abierta; cada 10 min si no |

- **Leer el estado bien:** `effective_status` con `configured_status`, `issues_info` (cuando es `WITH_ISSUES`) y `ad_review_feedback` (cuando es `DISAPPROVED`). Del conjunto, además, `learning_stage_info` (aprendiendo, terminado o limitado; POR VERIFICAR el nombre en v26).
- **Etiquetas de la oficina:** todo lo que crea la oficina lleva en el nombre un sufijo corto `· AO:<idBorrador>` y, si la versión lo admite, `adlabels` con `ao:<idBorrador>` (POR VERIFICAR). Así se reconcilia tras un corte y se distingue lo creado aquí de lo creado en el Administrador de anuncios. Lo segundo se ve y se puede pausar, pero se marca «creado fuera».
- **Nunca se borra en Meta.** Para limpiar se **archiva** (`status: ARCHIVED`). Borrar de verdad lo hace el dueño en el Administrador de anuncios.

---

## 5. Las fases

Cada fase:
- se termina en su propia rama y Pull Request;
- deja `npm run check` en verde, con sus tests y su recorrido;
- actualiza la documentación;
- se considera **hecha** cuando cumple su «Hecho cuando».

### Fase 0 — La base (antes de todo) ✅ (8 oct 2026, rama `mejora/meta-fase-0`)

> Hecho: v26.0 con tabla de caducidad y aviso; el alcance de Facebook movido a `page_total_media_view_unique` (verificado, §13.1); `tests/meta-stand.mjs` sirve a todos los tests de Meta y a `npm run check`; el freno por uso en `contenido/meta.mjs`; Ajustes → Anuncios; `PERMISOS_ANUNCIOS` y `PERMISOS_MENSAJES` con lo que falta por función en los dos «Comprobar conexión»; Estado con «Anuncios (Meta)» y «Mensajes de Meta». **Queda del dueño:** correr `node scripts/check-meta-publicar.mjs` con el token real.

1. **Versión de Graph a `v26.0`.**
   - Revisar en el changelog de v24, v25 y v26 lo que toca a publicar (`contenido/meta-publicar.mjs`), a las métricas orgánicas (`contenido/metricas.mjs`: Meta está retirando métricas viejas de alcance e impresiones; POR VERIFICAR cuáles y por cuáles se cambian) y a los anuncios.
   - Correr `tests/meta*.test.mjs` y, con el token real, `node scripts/check-meta-publicar.mjs`.
   - Añadir la tabla de caducidad de versiones y el aviso en `npm run check`.
2. **`tests/meta-stand.mjs`:** un Graph de mentira único, sacado de lo que hoy está dentro de `tests/meta-publicar.test.mjs` y de `check.mjs`.
   - Responde a publicar, insights orgánicos y Marketing API (campañas, conjuntos, anuncios, creativos, `adimages`, `advideos`, `insights`, `copies`, `generatepreviews`, `validate_only`).
   - Responde a la Bandeja: comentarios, conversaciones y mensajes.
   - Tiene modos de fallo: límite de uso con su cabecera, `100` (parámetro), presupuesto bajo, anuncio rechazado, `WITH_ISSUES`, cuenta con pago pendiente (`account_status: 3`).
3. **El freno por uso** (§4.1) en `contenido/meta.mjs`, para que lo hereden publicar, Analíticas, Anuncios y la Bandeja.
4. **Ajustes → Anuncios** (`settings.mjs → FIELDS`, grupo nuevo `anuncios`):

   | Campo | Valor por defecto |
   |---|---|
   | `anuncios.cuenta` (`act_…`) | — |
   | `anuncios.pagina` | Si vacío, la de Contenido |
   | `anuncios.instagram` | Si vacío, el de la página |
   | `anuncios.pixel` | Vacío |
   | `anuncios.whatsapp` | Vacío |
   | `anuncios.topeDiario` | US$20 |
   | `anuncios.topeMensual` | US$300 |
   | `anuncios.topeCampana` | US$150 |
   | `anuncios.cpaObjetivo` | Si vacío, se calcula de las cifras: margen y valor de cliente en `cifras.json`; si no hay, se pregunta |
   | `anuncios.pilotoAutomatico` | Apagado |

   Los valores por defecto los confirma el dueño la primera vez (§12).
5. **`PERMISOS_ANUNCIOS` y `PERMISOS_MENSAJES`** en `contenido/meta.mjs`, y que «Comprobar conexión» (Analíticas y Programación) diga cuáles faltan, separados por función.
6. **Ajustes → Estado (O)** gana «Anuncios» y «Mensajes de Meta»: conectado o no, lo que falta y el último sondeo.

**Hecho cuando:**
- `v26.0` está fijada y probada con el Meta de mentira;
- `meta-stand.mjs` sirve a todos los tests de Meta;
- los ajustes y el estado se ven;
- `check-meta-publicar.mjs` pasa con el token real (eso lo corre el dueño).

### Fase A1 — Ver: el panel de Anuncios en solo lectura ✅ (9 oct 2026, rama `mejora/anuncios-a1`)

> Hecho: `anuncios/` (modelo, lectura por lotes solo GET, sincronizar con su ritmo y avisos, rutas), el panel (tecla J, Resumen · Campañas · Historial, paquete aparte), Dimitri (`sub.anunciosText`, «Viendo»), `anuncios-mcp.mjs` de solo lectura, el asistente (`ver_anuncios`), «Publicidad» aparte en el lunes y en Costos, y `scripts/check-meta-anuncios.mjs`. Diferencias con lo escrito arriba: la lectura de noche trae **37 días**, no 28 (cubre la vista de 30 días y la tendencia de 7 contra 7); si un nivel de la cuenta tiene más de 500 objetos, el lote de alcance solo trae la primera página y el resto sale con alcance «—». **Queda del dueño:** `node scripts/check-meta-anuncios.mjs` con el token real.

- **Lo que trae `anuncios/sincronizar.mjs`:**
  - la cuenta: `account_status`, `disable_reason`, `currency`, `timezone_name`, `amount_spent`, `spend_cap`, `balance`;
  - las campañas, cada una con objetivo, estado, presupuesto, `bid_strategy`, `spend_cap`, fechas y `advantage_state_info` (POR VERIFICAR);
  - los conjuntos, con optimización, destino, público, ubicaciones, presupuesto, aprendizaje y estado;
  - los anuncios, con su creativo (miniatura, texto, llamada a la acción), estado y revisión;
  - las cifras diarias por anuncio (`level=ad`): `spend`, `impressions`, `reach`, `frequency`, `clicks`, `inline_link_clicks`, `ctr`, `cpc`, `cpm`, `actions`, `cost_per_action_type`, `purchase_roas` cuando hay píxel, y las métricas de visualizaciones que Meta esté introduciendo en v26 (POR VERIFICAR).
- **«Resultado» se define por objetivo:** mensajes iniciados, clics al enlace, compras, contactos o visitas al perfil. La tabla vive en `anuncios/modelo.mjs`, con tests. Así el panel dice «12 conversaciones a US$1,40» y no «actions: [...]».
- **El panel:** la vista «Anuncios» (§8), pestañas **Resumen**, **Campañas** e **Historial**, sin botones de cambio todavía.
- **Avisos** (`notice`, y Telegram si está):
  - un anuncio rechazado o con problemas;
  - la cuenta con pago pendiente o desactivada;
  - el gasto de hoy por encima del 90 % del tope diario.
- **Dimitri:**
  - `<estado>` gana `sub.anunciosText`: lo activo, el gasto de hoy, de la semana y del mes contra los topes, los resultados y su costo, y lo que tiene problemas, con ids;
  - «Viendo» del panel con `selection()`.
- **`anuncios-mcp.mjs`, solo lectura:** `ver_cuenta_anuncios`, `ver_campanas`, `ver_resultados_anuncios` (rango y nivel), `ver_anuncio`. Va en `INTERNAL`, con su test de nombres prohibidos.
- **El resumen del lunes y Costos y retorno:** el gasto de anuncios de la semana y su costo por resultado («Publicidad», aparte).
- **`scripts/check-meta-anuncios.mjs`:** lee la cuenta, los permisos, la moneda, la zona y el estado, y lista 3 campañas. No crea nada.

**Hecho cuando:** con el Meta de mentira, el panel muestra campañas, estados, aprendizaje, revisión y cifras correctas a 390, 1024 y 1512 px, y Dimitri contesta «¿cómo van los anuncios?» con cifras reales e ids.

### Fase A2 — Controlar: pausar, reanudar, presupuesto, relanzar ✅ (9 oct 2026, rama `mejora/anuncios-a2`)

> Hecho: `anuncios/topes.mjs` y `anuncios/acciones.mjs`; los dos clics viven en el SERVIDOR (token de 2 min, un solo uso, atado a la acción y a la cifra; los topes se vuelven a mirar al confirmar); el panel con interruptores, «⋯», la ventana del segundo clic, DESHACER e Historial; Dimitri (`OPS_GASTO`, su tarjeta con la cifra); Telegram `/anuncios`; el asistente solo baja el gasto (403 al resto). Decisiones: relanzar con más de 3 anuncios copia por partes (hasta 30); deshacer una pausa vuelve a gastar, así que es solo del dueño y pasa los topes; una campaña diaria sin fecha de fin ni `spend_cap` no cabe en el tope por campaña (el motivo pide la fecha). **POR VERIFICAR con el token** (marcado en el código): `validate_only` en conjuntos, anuncios y `/copies`; cambiar `stop_time` de una campaña; que lo archivado no se reactive; el texto del mínimo de presupuesto; el formato de fecha `+0000`; la regla de Meta de gastar hasta un 75 % más del diario en un día.

- **Bajar el gasto** (libre, un clic, con DESHACER durante 30 s cuando se puede):
  - pausar una campaña, un conjunto o un anuncio;
  - bajar un presupuesto;
  - archivar.
- **De gasto** (§3.1: solo el dueño, dos clics con la cifra, topes):
  - **Activar** lo que está en pausa. Si estaba «en revisión», se activa igual y sale cuando Meta lo apruebe; el panel lo dice.
  - **Reanudar.**
  - **Subir el presupuesto.** Si sube más de un 20 % en un conjunto que está aprendiendo, el panel avisa: «esto reinicia el aprendizaje; mejor un 20 % cada 2–3 días» (§7). No lo prohíbe: lo explica.
  - **Alargar la fecha de fin.**
- **Relanzar:**
  - Pausada → reanudar.
  - Terminada, o un cambio grande que reiniciaría el aprendizaje → **duplicar** con `POST /<campaña>/copies` (`deep_copy: true`, `status_option: PAUSED`; POR VERIFICAR los parámetros en v26), con fechas nuevas y la etiqueta de la oficina. Luego el dueño la activa (de gasto).
- **Presupuesto en la moneda de la cuenta**, en centavos. Antes de mandar, la oficina valida con Meta (`validate_only`) y muestra el mínimo si Meta lo rechaza por bajo.
- **Telegram** (`telegram.mjs`):
  - `/anuncios`: lo activo y el gasto de hoy, con «⏸ Pausar» por campaña;
  - el aviso de algo con problemas trae «⏸ Pausar»;
  - las acciones de gasto llegan como tarjeta con «✅ Activar — gasta hasta US$X/día» y un segundo toque de confirmación. Solo el dueño.
- **Dimitri** (`sub.OPS`):
  - `anuncio_pausar` y `anuncio_bajar_presupuesto`, que bajan el gasto;
  - `anuncio_activar`, `anuncio_reanudar`, `anuncio_subir_presupuesto` y `anuncio_relanzar`, en `OPS_GASTO`: su tarjeta dice la cifra, HACER pide un segundo clic y `oficina/rutas.mjs` los rechaza al asistente.

  `tests/control-oficina.test.mjs` se amplía. La regla de nombres sigue: nada que suene a pagar o publicar.

**Hecho cuando:** con el Meta de mentira, cada acción hace lo que dice, las de gasto no pasan sin el dueño ni por encima de los topes (con tests de servidor, también desde Dimitri, el asistente y un agente), y todo queda en el historial y en `data/audit/`.

### Fase A3 — Crear: borradores, creativos del Estudio, en pausa

- **El borrador de campaña** (`anuncios/modelo.mjs`), un asistente de 5 pasos en el panel:
  1. **Objetivo.** Opciones, en palabras del dueño:
     - «Que me escriban por WhatsApp, Instagram o Messenger» (`OUTCOME_ENGAGEMENT` con destino de mensajes);
     - «Visitas a mi web» (`OUTCOME_TRAFFIC`);
     - «Ventas en mi web» (`OUTCOME_SALES`, pide píxel);
     - «Contactos con formulario» (`OUTCOME_LEADS`);
     - «Que me conozcan» (`OUTCOME_AWARENESS`).

     Las combinaciones válidas con su `optimization_goal`, `destination_type` y llamadas a la acción van en una tabla con tests (POR VERIFICAR, contra la documentación de v26, cada combinación).
  2. **Público.**
     - **Por defecto, lo que Meta recomienda hoy:** **público Advantage+** (`targeting_automation.advantage_audience: 1`) con país o radio en Panamá y la edad mínima, y como mucho «sugerencias» de intereses.
     - Público manual solo si el dueño lo pide, con el tamaño estimado (`/act_<id>/delivery_estimate`, si sigue en v26).
     - `special_ad_categories` siempre presente: vacío salvo empleo, vivienda, crédito o política, que el borrador pregunta.
  3. **Presupuesto y fechas.**
     - **Presupuesto Advantage+ de campaña** (a nivel campaña) por defecto, diario o total, con fecha de inicio y fin.
     - El `spend_cap` de la campaña sale del tope.
     - `bid_strategy` por defecto: el menor costo sin tope. «Costo objetivo» solo si hay `cpaObjetivo` y el dueño lo elige.
  4. **Creativos** (3 a 6 por conjunto, buena práctica de Meta):
     - desde la galería del Estudio (imagen o video), o «Crear con el Estudio» (abre el Estudio «para el anuncio», como hoy «para la pieza»);
     - formatos: 1:1 o 4:5 para el feed y 9:16 para historias y reels; si solo hay uno, Meta recorta (ubicaciones Advantage+);
     - texto principal, titular, descripción y llamada a la acción, con «✨ Mejorar con el agente de anuncios» (`ada`, como «Mejorar con Marketing» en Contenido);
     - las mejoras automáticas de Meta (`degrees_of_freedom_spec.creative_features_spec`: `text_optimizations`, `image_touchups`, `image_template`, `video_auto_crop`…) se eligen **una por una**, porque el paquete «standard enhancements» ya no existe en la API. Por defecto, solo las que no cambian el texto de la marca, y el dueño decide en Ajustes.
  5. **Revisión.**
     - La oficina valida con Meta (`validate_only`) y muestra lo que Meta diga.
     - La vista previa del anuncio por ubicación: la propia de la oficina (`src/contenido-preview.js` adaptada) y, opcional, la de Meta (`/act_<id>/generatepreviews`).
     - El costo máximo: «hasta US$X al día · US$Y en total · tope de la campaña US$Z».
     - El botón **«Crear en Meta (en pausa)»**. No gasta, así que es de un clic.
- **Crear (`anuncios/crear.mjs`), en este orden:**
  1. Subir las imágenes (`POST /act_<id>/adimages` → `hash`) y los videos (`POST /act_<id>/advideos`, por partes si es grande; esperar `status.video_status = ready`).
  2. El creativo (`POST /act_<id>/adcreatives`, `object_story_spec` con `page_id` e `instagram_user_id`; POR VERIFICAR si v26 sigue aceptando `instagram_actor_id` en algún caso).
  3. La campaña, `PAUSED`.
  4. El conjunto, `PAUSED`.
  5. Los anuncios, `PAUSED`.

  Cada paso se apunta en `creaciones.json` antes y después. Si la oficina se corta a mitad, al volver **reconcilia por la etiqueta** (§4.1) y sigue: nunca crea dos veces. Si un paso falla, archiva lo creado en ese intento y deja el borrador con el error en palabras.
- **Los agentes:** `crear_borrador_campana` y `mejorar_borrador_campana` en `anuncios-mcp.mjs`. Nacen borrador en la oficina, nunca en Meta. La skill de `ada` se amplía (Biblioteca `campanas-pagadas` y `creatividad-anuncios`, o una skill del Cerebro `anuncios-panaclaw`).
- **Dimitri:** `anuncio_borrador` en `sub.OPS` (como `pieza_crear`). Nace borrador; crear en Meta es otro clic en el panel.

**Hecho cuando:** un borrador hecho en el panel, por `ada` o por Dimitri se valida, se previsualiza y se crea en pausa en el Meta de mentira, con reconciliación tras un corte probada en un test (la oficina se cae entre el conjunto y el anuncio), y `check-meta-anuncios.mjs --crear-pausada` lo prueba con el token real: crea una campaña de prueba en pausa y la archiva.

### Fase A4 — Impulsar lo que ya salió en Contenido

- En una pieza **publicada**, en Contenido (y en Analíticas, en «las que más movieron»), el botón **«Impulsar»** abre un borrador de anuncio con esa publicación:
  - **Facebook:** `object_story_id = "<pagina>_<post>"`.
  - **Instagram:** `source_instagram_media_id` + `instagram_user_id` (POR VERIFICAR qué publicaciones admite Meta: con música con derechos, por ejemplo, no se puede).
- Los ids salen de la «salida» de la cola (`programador.salidaDe`) o, si se publicó fuera, del emparejamiento de lo publicado (`src/contenido-publicadas.js`).
- El diagnóstico (§7) propone impulsar lo que mejor funcionó orgánicamente («esta publicación tuvo 3 veces las interacciones de tu media»).

**Hecho cuando:** desde una pieza publicada se llega a un borrador válido y se crea en pausa en el Meta de mentira, en las dos redes.

### Fase A5 — La IA que mejora las campañas

- **El diagnóstico** (`anuncios/diagnostico.mjs`, puro, con tests): toma las cifras y las reglas de §7 y devuelve **sugerencias**, cada una con:
  - el dato que la motiva;
  - el porqué;
  - el cambio exacto (que es una acción de §5.A2 o un borrador);
  - el efecto esperado;
  - el riesgo (¿reinicia el aprendizaje? ¿gasta más?).
  
  Corre después de cada sondeo de cifras.
- **La pestaña Sugerencias** del panel:
  - «Aplicar» (si es de gasto, con sus dos clics), «Descartar» y «Recordármelo en 3 días»;
  - lo descartado no vuelve en 7 días;
  - se recuerda qué se aplicó y qué pasó después, y eso entra en el aprendizaje de la memoria, como hoy en Contenido F4.
- **El agente `ada`:**
  - **Rutina semanal**, «Revisión de anuncios», lunes 8:30, `needsOk: false` porque solo lee y propone: lee las cifras, las sugerencias y la Biblioteca, y entrega un análisis corto con decisiones.
  - **Creativos nuevos:** cuando un creativo se fatiga, propone variaciones y le pide al Estudio las imágenes, con la tarjeta de costo de siempre.
  - **Por anuncio:** «✨ Mejorar con el agente de anuncios» en el borrador y en un anuncio rechazado (propone el texto corregido según `ad_review_feedback`).
- **Dimitri:** con `sub.anunciosText` en `<estado>` contesta y propone las acciones de §5.A2 como tarjetas. «¿Qué hago con los anuncios?» → análisis con opciones y tarjetas.
- **Piloto automático** (opcional, apagado, en Ajustes): solo hace sin preguntar **lo que baja el gasto**:
  - pausar un anuncio que pasó el umbral de «cortar»;
  - pausar todo si la cuenta pasa el tope diario.

  Cada acción avisa y se puede deshacer. **Subir presupuestos o activar nunca es automático**, aunque el dueño lo pida. Si lo pide, se explica por qué no, y la mejora que sí se puede es una sugerencia diaria de escalar con un toque en Telegram.
- **Evaluaciones:** `evals/anuncios-diagnostico/evals.json`, casos con cifras y la decisión correcta, corridos con `node scripts/evals-skill.mjs`.

**Hecho cuando:** con series de cifras de mentira (una campaña que aprende, una que se fatiga, una que gasta sin resultados, una que escala bien), el diagnóstico propone lo correcto y no propone nada a lo que aprende; las sugerencias se aplican y deshacen desde el panel y Telegram; y `ada` entrega su revisión semanal con Claude simulado.

### Fase B1 — La Bandeja con Meta: comentarios

- **`contenido/bandeja-meta.mjs`**, una fuente con la interfaz que ya usa `contenido/bandeja.mjs` con Metricool: `sincronizar`, `enviar` y `ocultar`.
- **Ajustes → Contenido → «La Bandeja trae de»:** `metricool`, `meta` o `ambas`. Por defecto `meta` si hay token de Meta, y si no `metricool`.
- **Lectura:**
  - **Instagram:** los comentarios de las publicaciones de los últimos 30 días con `GET /<ig-media>/comments` (campos `id`, `text`, `username`, `timestamp`, `replies{…}`) y las publicaciones con `GET /<ig-user>/media`.
  - **Facebook:** `GET /<post>/comments` (campos `id`, `message`, `from`, `created_time`, `comments{…}`).
  - Solo lo nuevo desde el último sondeo.
- **Responder:**
  - **Instagram:** `POST /<comentario>/replies {message}`.
  - **Facebook:** `POST /<comentario>/comments {message}`.
  - Con los mismos candados de hoy: solo el dueño envía, una vez, según el modo de Contenido (simulacro, real, apagado).
- **Ocultar** (no borrar):
  - **Instagram:** `POST /<comentario> {hide: true}`.
  - **Facebook:** `POST /<comentario> {is_hidden: true}`.
  
  Para los insultos o el spam. Lo hace el dueño; el agente lo puede sugerir.
- **Los comentarios de los anuncios.** Se leen igual, con el id del post del anuncio (`effective_object_story_id` y `effective_instagram_media_id` del creativo), y llegan marcados «en un anuncio».
- **`scripts/check-meta-bandeja.mjs`:** lee y no responde.

**Hecho cuando:** los comentarios de las dos redes, de lo orgánico y de los anuncios, llegan a la Bandeja; el agente deja el borrador y el dueño responde u oculta, con el Meta de mentira.

### Fase B2 — La Bandeja con Meta: mensajes privados

Para esta fase hace falta que Meta haya dado el acceso avanzado (§2.6). Sin él, la fase se construye y se prueba con el Meta de mentira, y queda apagada con su motivo en Estado.

- **Lectura:**
  - `GET /<pagina>/conversations?platform=instagram` y `…&platform=messenger`, campos `id`, `updated_time`, `participants` y `messages.limit(20){id,message,from,to,created_time,attachments}`;
  - solo las que cambiaron desde el último sondeo (`updated_time`);
  - las conversaciones de «Solicitudes» sin actividad en 30 días no llegan: Meta no las devuelve.
- **Responder:** `POST /<pagina>/messages {recipient: {id: <IGSID|PSID>}, messaging_type: "RESPONSE", message: {text}}`.
- **La ventana de 24 horas.**
  - Cada conversación muestra cuánto queda: «puedes responder durante 5 h más».
  - Fuera de la ventana, el botón Enviar no se ofrece y se explica por qué.
  - La etiqueta `HUMAN_AGENT` (7 días) solo existe con el permiso «Human Agent» aprobado. Las fuentes no coinciden en si vale en Instagram: POR VERIFICAR.
  - Las etiquetas nunca son para promociones, y la oficina no las usa para eso.
- **Adjuntos:** se muestran las imágenes que manda el cliente; no se envían adjuntos en esta fase.
- **Privacidad:** los mensajes viven en `data/contenido/bandeja.json`, no viajan y entran en la copia diaria. El agente los lee como datos, con `injectionIn`.
- **Telegram:** un mensaje nuevo avisa, con «Ver en la oficina», y se respeta el horario de no molestar.

**Hecho cuando:** con el Meta de mentira, se leen y se responden mensajes de Instagram y Messenger dentro de la ventana, y fuera de ella el envío se niega con el motivo. Con acceso aprobado, `check-meta-bandeja.mjs` lista conversaciones reales.

### Fase A6 — Medir mejor (opcional, si hay web)

- **API de conversiones** (servidor a servidor) además del píxel, con `event_id` para no contar dos veces, si el dueño vende en una web. Esta fase solo se hace si el dueño confirma que tiene web y qué eventos importan.
- Los indicadores del dueño: `meta_gasto_anuncios`, `meta_costo_resultado` y `meta_roas` (cuando aplique), con el botón «Crear indicador», como hoy `meta_seguidores`.

### Fase A7 — Informe de anuncios

- «Informe de anuncios del mes» en el panel, sin modelo, como `contenido/informe.mjs`:
  - gasto;
  - resultados y costo por resultado por campaña;
  - los mejores creativos;
  - lo que se aplicó de las sugerencias y qué pasó.
- Se guarda como nota en `<cerebro>/Agents Office/informes/AAAA-MM anuncios.md` (no viaja).

---

## 6. El orden

| # | Fase | Por qué en ese lugar |
|---|---|---|
| 1 | **0** Base | Sin la versión al día y el Meta de mentira, todo lo demás se rompe |
| 2 | **A1** Ver | Ver antes de tocar, y los datos que usa todo lo demás |
| 3 | **A2** Controlar | Pausar y relanzar es lo que el dueño pidió primero |
| 4 | **A3** Crear | Lanzar campañas desde la oficina |
| 5 | **A5** IA | Mejora lo que ya existe; necesita A1 a A3 |
| 6 | **B1** Comentarios | No espera la revisión de Meta |
| 7 | **A4** Impulsar | Pequeña una vez está A3 |
| 8 | **B2** Mensajes | Espera el acceso avanzado de Meta: para entonces ya debería estar |
| 9 | **A6** y **A7** | Medir mejor e informe |

**Mientras tanto, el dueño** empieza ya la verificación del negocio (§2.1) y, cuando B2 esté lista para grabar, la revisión de la app (§2.6).

---

## 7. Cómo mejora la IA las campañas (las reglas)

Los umbrales concretos salen de la Biblioteca (`campanas-pagadas/referencias/`) y de Ajustes, nunca escritos a mano en el código. Lo de abajo es la lógica, que el diagnóstico implementa con tests.

1. **Aprendizaje primero.**
   - Un conjunto **aprendiendo** (unos 50 resultados en 7 días para salir; práctica común, POR VERIFICAR la cifra actual) **no se toca**: ni presupuesto, ni público, ni creativos. Excepción: algo roto (rechazado, sin entregar, gasto sin ningún resultado muy por encima del objetivo).
   - **Limitado** (no llega a esos resultados) → propone juntar conjuntos, abrir el público, subir el presupuesto u optimizar a un evento más arriba del embudo (de «compra» a «iniciar conversación»).
   - Nunca propone cambios pequeños seguidos: los agrupa en uno.
2. **Esperar antes de juzgar:** al menos 3 a 5 días o 1 a 2 veces el costo objetivo gastado, lo que llegue después.
3. **Cortar:** un anuncio que gastó 2 veces el costo objetivo sin ningún resultado, o 3 veces con un costo por resultado mayor que el doble del objetivo → pausar (baja el gasto: con un clic, o sola con el piloto automático).
4. **Fatiga:** frecuencia por encima de 3 a 4 en público frío y el CTR cayendo un 30 % o más contra sus primeros días → proponer creativos nuevos (variaciones del mejor, pedidas al Estudio) y no subir el presupuesto.
5. **Escalar:** fuera del aprendizaje, con el costo por resultado 20 % o más por debajo del objetivo durante 3 días o más → proponer +20 % de presupuesto (de gasto: dos clics), como mucho una vez cada 48 a 72 h. Un salto grande se propone como duplicar con más presupuesto, no como editar.
6. **Estructura:** pocos conjuntos con más presupuesto rinden más que muchos con poco. Con más de 3 conjuntos parecidos que no salen del aprendizaje, propone juntarlos. Buenas prácticas de 2026: Advantage+ en público, presupuesto y ubicaciones, y 3 a 6 creativos por conjunto. **El creativo pesa más que el público:** la mayor palanca es probar creativos.
7. **Rechazados y problemas:** `ad_review_feedback` → el texto corregido por `ada`, como borrador. `WITH_ISSUES` → el motivo en palabras y qué hacer.
8. **La cuenta:** pago pendiente, desactivada o un tope a punto de alcanzarse → aviso arriba en el panel, en Estado (O) y en Telegram.
9. **Lo orgánico manda señales:** una publicación con interacciones muy por encima de la media → «Impulsar» (A4).
10. **Explicar siempre:** cada sugerencia dice qué dato la motiva, qué cambia, qué se espera y su riesgo. Lo que no se puede medir se dice («sin píxel no sé cuántas compras vinieron del anuncio»), nunca se inventa.

---

## 8. El panel «Anuncios»

**El botón y la carga:**
- Un botón más en el dock: un megáfono `<button class="tb-ic">` con su SVG, `aria-label`, `title` con la tecla y `data-tip`.
- **La tecla:** hoy están tomadas E, P, H, K, R, G, O, U, N, `,`, `?`, S, B, T, C y 0–6, y además W, M, A y D dentro de los calendarios. Propuesta: **J**, comprobando antes `KEYS` en `src/main.js`. Se añade a `KEYS` y respeta `ignorar(e)` (`src/teclas1.js`).
- En el teléfono va en el «⋯» (`src/dock.js`). Se prueba a 390, 360 y 320 px **con el aviso «⚠ N» de aprobaciones encendido**.
- **Es una vista** (`data-view`, `views.add('anuncios', …)`, `views.opening`) que se corre con Dimitri abierto (regla de `src/css/dimitri.css`, estilo estrecho con `@container`). Expone `selection()` para el chip «Viendo» y entra en `getContext` de `src/main.js`.
- **Va en su propio paquete:** `src/anuncios-carga.js` en la página y `dist/anuncios-vista.js` aparte (`build-anuncios.mjs`, como Tareas). `serve.mjs` lo sirve y lo reconstruye si es de otra construcción. `build.mjs` falla si la página importa algo de `src/anuncios/`.

**Pestañas:**
1. **Resumen.**
   - Arriba, una franja si algo pide atención: pago pendiente, rechazados, tope cerca.
   - Cuatro cifras: gasto de hoy contra el tope diario, gasto del mes contra el tope mensual, resultados de 7 días y costo por resultado de 7 días, cada una con su tendencia.
   - Las campañas activas en tarjetas, con su interruptor.
   - Las 3 sugerencias más importantes.
   - «Nueva campaña».
2. **Campañas.**
   - Una tabla que se despliega: campaña → conjunto → anuncio.
   - Columnas: interruptor (pausar · activar), nombre (con «creado fuera» si no es de la oficina), estado efectivo en palabras, aprendizaje, presupuesto, gasto, resultados, costo por resultado, CTR, frecuencia y fin.
   - Rango de fechas (hoy, 7 días, 30 días, este mes) y filtros (activas, en pausa, con problemas).
   - Menú por fila: subir o bajar presupuesto, duplicar o relanzar, ver el anuncio, archivar.
   - Clic en la fila: un panel lateral con el detalle (gráfico diario de gasto y resultados, el creativo, el público, la revisión).
   - En el teléfono, la tabla se vuelve tarjetas.
3. **Borradores.** La lista y el asistente de 5 pasos (§5.A3). Lo que deja `ada` o Dimitri se marca de quién viene.
4. **Creativos.**
   - Todos los creativos, con su miniatura y sus cifras juntas (CTR, costo por resultado, frecuencia) y su estado: «funciona», «se está cansando», «sin datos».
   - «Pedir variaciones» al Estudio.
5. **Sugerencias.** §5.A5.
6. **Historial.** Cada cambio: quién (tú, Dimitri, el piloto automático), qué, antes y después, cuándo; y DESHACER donde se puede.

**Reglas de la interfaz** (las de `CLAUDE.md`, que siguen valiendo):
- toda ventana con `modal.open` y `modal.close`;
- contraste 4,5:1 en claro y oscuro;
- foco con `var(--focus)`;
- objetivos de 24 px o más;
- nada por debajo de 10,5 px;
- nada se atenúa con `opacity` para decir «pausado»: se escribe;
- un botón nunca va dentro de otro.

Las cifras de dinero llevan la moneda de la cuenta siempre. En la demo `file://`, datos de ejemplo rotulados «ejemplo», en memoria.

**Recorrido:** `node scripts/anuncios-recorrido.mjs`, con una oficina temporal y el Meta de mentira. Comprueba:
- 1512 px en claro y oscuro, 1024 px con Dimitri abierto, 390 px;
- crear un borrador, crearlo en pausa, activarlo (con los dos clics), pausarlo y relanzarlo;
- una sugerencia aplicada;
- con `AO_AXE`, axe sin fallos.

---

## 9. Los agentes, Dimitri, el asistente y Telegram (resumen)

| | Ver | Borradores | Sugerir | Bajar gasto | Gastar | Crear en Meta |
|---|---|---|---|---|---|---|
| Dueño (panel o Telegram) | ✅ | ✅ | — | ✅ | ✅ dos clics y topes | ✅ un clic, en pausa |
| Dimitri (su tarjeta, con clic del dueño) | ✅ | ✅ | ✅ | ✅ | ✅ dos clics y topes | — (lo hace el panel) |
| `ada` y los agentes (`anuncios-mcp.mjs`) | ✅ | ✅ | ✅ | — | — | — |
| Asistente por MCP (`oficina-mcp.mjs`) | ✅ | ✅ | — | ✅ | — (403) | — |
| Piloto automático (si está encendido) | — | — | — | ✅ con aviso | — | — |

`oficina/lecturas.mjs` gana `anunciosTexto`. `oficina-mcp.mjs` gana `ver_anuncios`. El mapa (`oficina/mapa.mjs`) gana una línea de ANUNCIOS y de la Bandeja con Meta.

---

## 10. Pruebas

- **Puras:**
  - `tests/anuncios-modelo.test.mjs`: combinaciones válidas, centavos, etiquetas, resultado por objetivo;
  - `tests/anuncios-construir.test.mjs`: los cuerpos exactos para Meta;
  - `tests/anuncios-topes.test.mjs`;
  - `tests/anuncios-diagnostico.test.mjs`: cada regla de §7, con series de cifras.
- **Con servidor** (el `serve.mjs` real y `tests/meta-stand.mjs`):
  - `tests/anuncios-servidor.test.mjs`:
    - sincronizar;
    - pausar y reanudar;
    - de gasto sin dueño → 403;
    - por encima del tope → 409 con la cifra;
    - crear en pausa;
    - reconciliar tras un corte;
    - duplicar;
    - el freno por límite de uso;
  - `tests/anuncios-mcp.test.mjs`: los nombres prohibidos y los 403 a `por: 'agente'`;
  - `tests/bandeja-meta.test.mjs`: comentarios, ocultar, mensajes, la ventana de 24 h y el modo simulacro;
  - `tests/control-oficina.test.mjs`, ampliado: `OPS_GASTO` rechazados al asistente, con tarjeta y segundo clic en Dimitri.
- **En el navegador:** `scripts/anuncios-recorrido.mjs` y el de la Bandeja (`scripts/bandeja-recorrido.mjs`, ampliado con Meta).
- **Con el token real del dueño** (nunca en CI):
  - `scripts/check-meta-anuncios.mjs` (y `--crear-pausada`);
  - `scripts/check-meta-bandeja.mjs`;
  - `scripts/check-meta-publicar.mjs`, después del cambio de versión.

---

## 11. Documentación a actualizar en cada fase

- `CLAUDE.md`:
  - una sección «Anuncios de Meta» (archivos, reglas del dinero, cómo se añade una acción);
  - la Bandeja con Meta en «Publicar en redes»;
  - el «Hecho» y el «Siguiente» del plan;
  - el dock y la tecla nueva.
- `docs/conectar-meta.md`: la lista de §2 (permisos completos, cuenta publicitaria, acceso avanzado, herramientas conectadas de Instagram).
- `README.md` y `CHANGELOG.md`.
- `docs/conectar-ia.md` y `oficina/mapa.mjs`: los anuncios para el asistente.
- Este plan: marcar ✅ cada fase y anotar en §13 lo verificado.

---

## 12. Decisiones del dueño (con su valor por defecto, para no frenar el trabajo)

| Decisión | Por defecto, si no dice otra cosa |
|---|---|
| Topes: diario, mensual y por campaña | US$20 al día, US$300 al mes y US$150 por campaña. Se piden la primera vez que abre el panel. |
| Objetivo más común | «Que me escriban» (WhatsApp, Instagram Direct o Messenger), lo habitual para un negocio local en Panamá |
| Público | Advantage+ con Panamá (o un radio alrededor del local) y edad mínima 18 |
| Mejoras automáticas de Meta en los creativos | Solo las que no tocan el texto (recorte de video, retoques de imagen); «mejorar el texto», apagado |
| Piloto automático | Apagado |
| ¿Quién recibe los avisos de anuncios en Telegram? | Solo el dueño |
| Bandeja | Meta si hay token; Metricool si no |

---

## 13. POR VERIFICAR (contra la documentación de Meta, antes de programar cada cosa)

La documentación de Meta no se pudo abrir desde donde se escribió este plan (la red la bloqueaba). Lo de abajo sale de búsquedas del 9 oct 2026 en páginas de Meta y de terceros, enlazadas al final. Al verificar cada punto, anota lo que encontraste y la fecha.

1. Versión: v26.0 (29 jul 2026) es la última; v23.0 terminó el 9 jun 2026. ¿Qué cambios de v26 se aplican a todas las versiones el 27 oct 2026? ¿Afectan a publicar o a las métricas orgánicas?
   - ✅ **Verificado el 8 oct 2026** (developers.facebook.com: changelog de versiones de Graph y de Marketing API, y el blog «Introducing Graph API v26 and Marketing API v26»):
     - **Corrección al plan:** v23.0 caducó el 9 jun 2026 **en la Marketing API**; en la **Graph API** vive hasta el **8 oct 2027**. La v24.0 de Marketing caducó el 6 oct 2026. Se pasa a v26.0 igual: una sola versión para todo, y los anuncios la necesitan. Tabla de fechas en `contenido/meta.mjs → VERSIONES` y aviso en `npm run check`.
     - **El 27 oct 2026, en todas las versiones:** `pretty` y `debug` se ignoran; `date_format` y `GET /?ids=…` dan error de parámetro; `If-None-Match` se ignora. La oficina no usa ninguno (comprobado con búsqueda en el código).
     - **También el 27 oct, en toda la Marketing API:** las historias de Messenger salen de `messenger_positions` sin aviso; los anuncios de encuesta se rechazan; `applink_treatment: web_only` no vale con conversiones web y de app. Se tienen en cuenta en A3.
     - **v26 en anuncios:** la ubicación «Explorar» de Instagram ya no existe (da error); en categorías especiales (vivienda, empleo, crédito), `targeting_automation.advantage_audience` tiene que ir explícito (1 o 0) al crear o copiar un conjunto (responde en parte al punto 3); `delivery_estimate` pierde `daily_outcomes_curve`, `budget_guardrail` y `estimate_dau`.
     - **Métricas orgánicas:** `page_impressions_unique` está **retirada desde v25**. El alcance de Facebook pasa a `page_total_media_view_unique` (con la vieja de respaldo), en `contenido/metricas.mjs`. Las de Instagram (`reach`, `views`, `total_interactions`…) siguen.
     - **Publicar:** nada de v24 a v26 toca las rutas de `contenido/meta-publicar.mjs` (los cambios de Páginas son campos del perfil: `current_location`, `genre`, `parking`…, que no se usan).
2. `execution_options: ["validate_only"]` en la creación de campaña, conjunto y anuncio en v26.
   - ✅ **Verificado el 9 oct 2026** (referencia de Campaign): los valores son `validate_only` e `include_recommendations` (este último no se usa solo). Con `validate_only`, «la llamada no hace el cambio»: si pasa, responde `{"success": true}`; si no, el error con su detalle. Se actualiza con `POST /{id}`. **`spend_cap` va en la subunidad de la moneda (centavos) y tiene un mínimo de US$100**: un tope por campaña menor no se puede poner en Meta (la oficina lo dice y, en ese caso, el único candado es el suyo).
3. *(9 oct 2026, A1: `advantage_state_info` todavía no se pide —un campo desconocido hace fallar la petición entera—; `scripts/check-meta-anuncios.mjs` lo prueba con el token real, solo leyendo. Lo mismo `effective_instagram_media_id`, para B1. Y está por verificar el `action_type` de «visitas al perfil» y qué monedas no llevan decimales: mientras tanto, ese resultado sale «—».)*
   Advantage+: desde v25 no hay `smart_promotion_type`. Una campaña Advantage+ se obtiene con público, presupuesto y ubicaciones Advantage+ (`advantage_state_info`). ¿Cuáles son los campos exactos en v26? Y para las categorías especiales, ¿es obligatorio `targeting_automation.advantage_audience`?
4. `instagram_user_id` frente a `instagram_actor_id` en `object_story_spec`. Las páginas de Meta usan los dos según el tipo de anuncio.
5. `learning_stage_info` en el conjunto: nombre y valores.
   - ✅ **Verificado el 8 oct 2026** (referencia AdCampaignLearningStageInfo): `status` es `LEARNING` (aprendiendo), `SUCCESS` (salió del aprendizaje) o `FAIL` (no logra resultados suficientes: lo que el plan llama «limitado»). Trae además `conversions` (desde el último cambio importante; 0 al salir con éxito), `last_sig_edit_ts` y `attribution_windows`. El `effective_status` de un conjunto es `ACTIVE`, `PAUSED`, `DELETED`, `CAMPAIGN_PAUSED`, `ARCHIVED`, `IN_PROCESS` o `WITH_ISSUES`; `configured_status` es `ACTIVE`, `PAUSED`, `DELETED` o `ARCHIVED`. Los presupuestos van «en la moneda de la cuenta» (en la práctica, centavos para USD; `bid_amount` lo dice explícitamente).
6. Las métricas de cifras: qué reemplaza a impresiones y alcance en v26, si algo.
   - ✅ **Verificado el 8 oct 2026** (changelog oficial de v25): en las **Ads Insights** no se retira ni se añade `reach`, `impressions` ni `frequency`. Lo que se retira son métricas **orgánicas** de página, publicación, video e historia (`page_impressions_unique` → `page_total_media_view_unique`; `post_impressions_unique` → `post_total_media_view_unique`), que pasan a dar error en todas las versiones con v26. Los anuncios siguen pidiendo `reach` e `impressions`.
   - Del mismo changelog (para A3): desde el 19 may 2026 ya no se pueden crear, duplicar ni actualizar campañas «Advantage+ shopping» de la estructura vieja (`POST /act_…/campaigns` y `/copies`). Se usa la estructura nueva.
7. `copies` para duplicar en v26 (`deep_copy`, `status_option`).
   - ✅ **Verificado el 9 oct 2026** (referencia de `/{campaign_id}/copies`): `deep_copy` (bool, por defecto false), `status_option` (`ACTIVE`, `PAUSED` —por defecto— o `INHERITED_FROM_SOURCE`), `start_time` y `end_time` (de los conjuntos copiados; `end_time=0` en uno de presupuesto diario = sin fin), `rename_options { rename_strategy: DEEP_RENAME|ONLY_TOP_LEVEL_RENAME|NO_RENAME, rename_prefix, rename_suffix }` y `parameter_overrides`. Devuelve `copied_campaign_id` y `ad_object_ids [{ ad_object_type, source_id, copied_id }]`. **Límite: hasta 3 anuncios hijos en una copia síncrona** (51 en asíncrona): con más, la oficina copia por partes (campaña sin hijos, luego cada conjunto con los suyos) o lo dice.
8. `adlabels` todavía disponible para etiquetar.
9. Niveles de acceso de la Marketing API: ¿basta el nivel por defecto para una sola cuenta propia? ¿Cuánta cuota tiene por hora?
10. Mensajes: si el acceso avanzado es obligatorio para `instagram_manage_messages` y `pages_messaging` con clientes; si `HUMAN_AGENT` vale en Instagram; y cuáles son los campos de `conversations` y `messages`.
11. Comentarios: si con acceso estándar se ven el nombre y el texto de comentarios de personas sin rol, o hace falta acceso avanzado para `pages_read_user_content` o `instagram_manage_comments`.
12. Si Meta exige declarar en un anuncio que la imagen se hizo con IA. Hay fuentes de terceros que lo dicen y no está confirmado.
13. Las combinaciones de objetivo, `optimization_goal`, `destination_type` y llamada a la acción para mensajes (WhatsApp, Instagram Direct, Messenger y varios destinos).
14. Presupuestos mínimos por día en USD según la optimización.

---

## 14. Fuentes consultadas (9 oct 2026)

- Meta, versiones de Graph y Marketing API: https://developers.facebook.com/docs/graph-api/changelog/versions/
- Meta, «Introducing Graph API v26 and Marketing API v26» (29 jul 2026): https://developers.facebook.com/blog/post/2026/07/29/introducing-graph-api-v26-and-marketing-api-v26/
- Meta, Advantage+ campaigns (estructura nueva): https://developers.facebook.com/docs/marketing-api/advantage-campaigns
- Meta, límites de uso de la Marketing API: https://developers.facebook.com/docs/marketing-api/overview/rate-limiting
- Meta, `object_story_spec`: https://developers.facebook.com/docs/marketing-api/reference/ad-creative-object-story-spec/
- Meta, usar publicaciones como anuncios de Instagram: https://developers.facebook.com/docs/instagram/ads-api/guides/use-posts-as-ads
- Meta, mejoras de Advantage+ creative en v22: https://developers.facebook.com/blog/post/2025/01/17/marketing-api-v22-impacts-to-advantage-plus-creative-enhancements/
- Meta, `effective_status` y objetos con problemas: https://developers.facebook.com/documentation/ads-commerce/marketing-api/ads-webhooks/effective-status
- Meta, API de conversaciones de Messenger e Instagram: https://developers.facebook.com/docs/messenger-platform/conversations/
- Meta, enviar mensajes: https://developers.facebook.com/docs/messenger-platform/send-messages
- Meta, mensajería de Instagram: https://developers.facebook.com/docs/messenger-platform/instagram
- Terceros (orientativos, no autoridad):
  - el cambio a v26: https://ppc.land/meta-blocks-47-commerce-endpoints-as-graph-api-v26-0-lands-today/
  - la migración de Advantage+: https://ppc.land/meta-deprecates-legacy-campaign-apis-for-advantage-structure/
  - la fase de aprendizaje: https://segwise.ai/blog/how-to-manage-meta-ads-guide
