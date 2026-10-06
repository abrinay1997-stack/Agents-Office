# Análisis de metricool-cli y cómo hacer una oficina más potente que Metricool

**Fecha:** 6 oct 2026 · **Pedido del dueño:** «leer este repositorio, hacer un análisis profundo, ver sus mejores prácticas, diseño y estructura, y cómo aprender de ellos para mejorar la oficina, sobre todo el planificador de contenido y todo lo de redes sociales. La idea es tener una aplicación más potente e intuitiva que Metricool.»

**Repositorio leído:** [Purple-Horizons/metricool-cli](https://github.com/Purple-Horizons/metricool-cli), commit `5fd93d1` (19 mar 2026), licencia MIT. Leído entero: los 47 archivos, que son el código (2.522 líneas), los tests (688), la skill para agentes, las referencias, las evaluaciones y el historial de commits.

**Comparado con nuestro lado:**
- `contenido/` (piezas, Meta, métricas);
- `src/contenido*.js` y `src/analiticas*.js`;
- `docs/propuesta-contenido-y-meta.md` (F0–F5);
- los pendientes de `docs/auditoria-diseno-2026-10-01.md` (PRE-*, CON-*).

---

## 1. Resumen en diez líneas

1. **Qué es:** metricool-cli es un **CLI de Node de un solo archivo**. Cubre la API REST de Metricool: más de 100 comandos en 16 áreas, desde programar, analíticas y competidores hasta la bandeja de mensajes, IA, enlaces de bio, biblioteca, informes, anuncios y agencia.
2. **Por qué existe:** el MCP oficial de Metricool **no podía programar posts**. Mandaba las redes como texto (`["linkedin"]`) en vez de objetos (`[{"network":"linkedin"}]`). Para un agente, ese detalle es la diferencia entre funcionar y no funcionar.
3. **Su mejor idea no es el código, es la *skill*.** Tiene un `SKILL.md` que se dispara con frases normales («¿cómo va nuestro LinkedIn?», «programa algo para mañana»), y su regla de oro es **borrador por defecto**. Además la mide con **evaluaciones con y sin skill**, con calificación y evidencia, en dos iteraciones: 94 % de acierto medio en la segunda.
4. **Su peor parte es la seguridad.** Cualquier agente con terminal puede publicar en 9 redes sin candado: el borrador es solo un consejo en un texto. Además, la key viaja en la URL, nada evita publicar dos veces y los errores salen crudos.
5. **Lo que nos enseña de Metricool como producto:** el mapa completo de lo que un programador de redes «serio» ofrece, y la forma de su API (`/v2/scheduler/posts`, `/v2/analytics/...`, `/v2/inbox/...`).
6. **La oportunidad más grande para nosotros: usar Metricool como «conductor» de publicación**, detrás de nuestra propia cola, nuestras aprobaciones y nuestro guardián. Esto resuelve de golpe los tres problemas abiertos de F3:
   - **¿Deja Instagram programar por API?** Metricool publica desde sus servidores.
   - **¿Dónde se alojan las imágenes?** Metricool tiene `normalize`, que las aloja él; no hace falta un bucket R2.
   - **La computadora dormida:** deja de importar, porque publica Metricool.

   Y abre **9 redes** en lugar de 2.
7. **Nuestra ventaja sobre Metricool no está en igualar sus 100 comandos.** Está en lo que Metricool no tiene:
   - agentes que planifican con el Cerebro y la voz de marca;
   - el Estudio (imagen, video, voz y lotes) dentro del mismo flujo;
   - aprobaciones con candados de verdad;
   - una memoria que aprende de los resultados;
   - Dimitri para pedir en lenguaje normal;
   - todo en español y local.
8. **Lo que hay que copiar:**
   - borrador por defecto, convertido en **regla del servidor**, no en consejo;
   - «mejor hora» antes de programar;
   - mirar las analíticas «en amplio» y resumir, nunca volcar datos;
   - normalizar medios;
   - fecha más zona horaria explícitas, sin convertir a UTC;
   - redes como objetos;
   - evaluaciones de skills con y sin;
   - tests de integración que se saltan solos sin credenciales.
9. **Lo que no hay que copiar:**
   - un archivo de 2.500 líneas con la misma comprobación repetida 100 veces;
   - tests que **reimplementan** la lógica en vez de importarla (pasan aunque el código esté roto);
   - la key en la URL;
   - `America/New_York` como zona por defecto;
   - ni reintentos, ni topes, ni idempotencia.
10. **El plan propuesto** (sección 8) va en 5 fases que encajan con F3–F5:
    - **M1:** programar a través de un conductor (Metricool o Meta), con simulacro.
    - **M2:** 9 redes con reglas y vista previa por red.
    - **M3:** analíticas y mejor hora.
    - **M4:** bandeja unificada con respuestas redactadas por agentes y aprobadas por el dueño.
    - **M5:** competencia, hashtags, recurrencia, cuadrícula del perfil e informes.

---

## 2. Qué es metricool-cli, por dentro

| Aspecto | Cómo está hecho |
|---|---|
| **Lenguaje y forma** | Node ESM, **un solo archivo** `metricool.js` (2.522 líneas), `commander` para los comandos, `node-fetch` y `dotenv`. `npm link` lo deja como orden global `metricool`. |
| **Autenticación** | `METRICOOL_USER_TOKEN`, `METRICOOL_USER_ID` y `METRICOOL_BLOG_ID` (la «marca»), del entorno o de un `.env`; el entorno gana (`override: false`). El token va **en la cabecera `X-Mc-Auth` y también en la URL** (`?userToken=…&userId=…&blogId=…`). |
| **Base** | `https://app.metricool.com/api`, con rutas `v2/…` y algunas antiguas (`/stats/…`, `/actions/…`). |
| **Un helper** | `apiRequest(endpoint, options, blogId)`: añade la autenticación, hace `fetch`, lanza un error si no es 2xx (imprime el cuerpo crudo) e intenta parsear JSON. Sin reintentos, sin tiempo máximo, sin traducir errores. |
| **Salida** | Siempre JSON con sangría (`output()` ignora su propio `--json`: las dos ramas hacen lo mismo). |
| **Marca por defecto** | `--blog-id` en cada orden, y si no, `METRICOOL_BLOG_ID`. La comprobación `if (!blogId) throw …` está repetida en casi cada función. |
| **Tests** | `node:test` + `node:assert`. Unitarios «con API simulada», integración contra la API real (se saltan sin credenciales) y validación de argumentos. |
| **Para agentes** | `SKILL.md` con front matter (`name`, `description` con los disparadores), flujos clave, reglas («`--draft` por defecto») y consejos de presentación. `references/commands.md` es la referencia completa, cargada solo cuando hace falta. |
| **Evaluaciones** | `evals/evals.json` (3 pedidos reales: «programa un post de LinkedIn mañana a las 2», «¿cómo nos fue en Instagram el mes pasado?», «revisa la bandeja»). `metricool-workspace/iteration-N/` guarda, por pedido, la salida **con skill** y **sin skill**, la calificación con evidencia (`grading.json`), el tiempo y los tokens, más un `benchmark.json`. |
| **Historial** | 19 commits en un mes. Arreglos reales que dejan lecciones: parámetros `from/to` en vez de `start/end` en analíticas v2; fechas `YYYYMMDD` en las rutas antiguas `/stats/…`; `provider` en mayúsculas en la bandeja; borrador reforzado en la skill tras una evaluación fallida. |

### Las 16 áreas (lo que Metricool ofrece por API)

| Área | Rutas principales | ¿Lo tenemos? |
|---|---|---|
| **Posts / programador** | `GET/POST/PUT/DELETE /v2/scheduler/posts`, notas, aprobación, `approval-tasks` | Piezas, estados y aprobación del dueño. **Programar: no (F3)** |
| **Analíticas** | `/v2/analytics/posts|reels/{red}`, `/stats/timeline|distribution|aggregation/{métrica}`, `/stats/{red}/stories`, hashtags | Foto diaria de Meta (IG + FB), **sin probar con el token real** |
| **Mejor hora** | `/planner/best-time-to-publish` | **No** (la «hora sugerida» es de F4) |
| **Competidores** | `/v2/analytics/competitors/{red}` (+ posts, timelines) | No (F5) |
| **Bandeja** | `/v2/inbox/conversations`, `post-comments`, `reviews` (leer y responder) | **No** |
| **IA** | generar post, regenerar, acciones rápidas (acortar, alargar…), **fecha en lenguaje natural** | Lo hacen los agentes y Dimitri, con el Cerebro (mejor) |
| **Biblioteca** | `/v2/scheduler/library/posts` | Plantillas solo en el Estudio; en Contenido, «Duplicar» |
| **Hashtags** | seguimiento y estadísticas | No |
| **Smart links** (link in bio) | CRUD + analíticas | No |
| **Informes / dashboards** | informes y paneles | «Cómo va el negocio» (N) y Analíticas (R), sin informe mensual |
| **Medios** | biblioteca, subida S3, **`/actions/normalize/image/url`** | El Estudio (mucho más), sin alojamiento público |
| **Calendarios** | calendarios y eventos | Calendario de contenido y el de tareas (P) |
| **Marca** | info, conexiones, imágenes | Cerebro (voz, cifras, perfil) |
| **Anuncios** | campañas, grupos, anuncios, palabras clave | No |
| **Agencia** | clientes, equipo, roles, colaboradores | Personas del equipo (Ajustes) y aprobadores delegados (Telegram) |
| **Utilidades** | GIFs, sugerencias de cuentas, contadores, ping | Salud (O) |

---

## 3. Lo que hacen bien (y cómo se traduce aquí)

| # | Práctica | Por qué funciona | Cómo la adoptamos |
|---|---|---|---|
| B1 | **Borrador por defecto** («solo publica si dicen *publícalo ya*») | El error caro en redes es irreversible: un post publicado | Ya es ley aquí (los agentes no publican). Ir más lejos: **en el servidor**, el conductor rechaza todo envío sin `aprobada` + modo `real`. Un consejo en una skill no basta: su evaluación 1 lo incumplió con un pedido ambiguo |
| B2 | **La skill se dispara con lenguaje normal** y dice *cuándo* usarse | El agente la usa sin que nadie diga «Metricool» | Nuestras skills (`plan-contenido`, `catalogo-fotos`) ya empiezan con su disparador. Añadir `responder-comentarios` y `analizar-redes` con frases reales del dueño |
| B3 | **Evaluaciones con y sin skill**, calificadas con evidencia, por iteración | Mide si la skill sirve y deja ver qué regla falló | Hoy no medimos nuestras skills (DIM-20, en parte). Crear `evals/` por skill con 3–5 pedidos reales del dueño y un recorrido que corra con el Claude simulado (forma) y, a mano, con el real (fondo) |
| B4 | **«Mira en amplio y resume»**: posts + reels + stories + timeline + agregados, y nunca JSON crudo | Una respuesta útil sobre «cómo vamos» cruza varias fuentes | `ver_analiticas` (F4) devuelve **ya resumido** (cifras, qué funciona, qué falta madurar), no filas |
| B5 | **Mejor hora antes de programar** | Programa con datos, no a ojo | Sombrear las mejores franjas en la semana del calendario y proponer la hora al aprobar (F4, con el mínimo de datos de Juancito Ads) |
| B6 | **Normalizar medios externos** a un alojamiento del propio servicio | Instagram exige una URL pública | Si el conductor es Metricool: `normalize` en vez de un bucket R2 propio (adiós a 5 variables de entorno) |
| B7 | **Fecha tal cual + zona horaria explícita**, sin convertir a UTC | Evita el clásico «sale una hora antes» | Mandar la hora local de la pieza con la zona de la máquina (`Intl…timeZone`), nunca una zona fija |
| B8 | **Redes como objetos** (`[{ network }]`) y datos por red (`instagramData.type`, `collaborators`, `linkedinData`) | La API lo exige; el MCP oficial falló por eso | El cuerpo lo arma un **módulo puro con test** que compara contra la forma documentada |
| B9 | **Tests de integración que se saltan sin credenciales** | La CI nunca toca la cuenta real, y el desarrollador sí puede | Igual que `check-minimax.mjs`: `scripts/check-metricool.mjs` con la key real, y los tests contra un Metricool de mentira |
| B10 | **Referencia aparte** (`references/commands.md`) cargada solo cuando hace falta | La skill queda corta y legible | Ya lo hacemos (archivos junto al `SKILL.md`, con topes) |
| B11 | **Solución de problemas en la doc** (401, 400 de fecha, `blogId`) | El error más común tiene su frase | Lo hacemos mejor: errores traducidos en el servidor (`media/errores.mjs` como modelo) |

## 4. Lo que hacen mal (y no copiamos)

| # | Problema | Riesgo | Aquí |
|---|---|---|---|
| M1 | **Un archivo de 2.522 líneas**, con la misma validación copiada ~100 veces | Cada arreglo hay que hacerlo cien veces | Módulos pequeños y puros: `conductores/metricool.mjs` (rutas), `contenido/cola.mjs` (estado), `src/…-reglas.js` (lo que se ve) |
| M2 | **Tests que reimplementan la lógica** (el test de redes hace su propio `split`, no llama al código) | Los tests pasan aunque `createPost` esté roto | Cada test importa la función real (como en todo `tests/`) |
| M3 | **La key en la URL** además de la cabecera | Se filtra en registros, proxys e historiales | Solo `X-Mc-Auth`, con el token del entorno y nunca en un texto, aviso o error (como `sinToken()` de Meta) |
| M4 | **Sin candado para publicar**: el borrador es un consejo | Un agente equivocado publica en 9 redes | Tres candados: aprobada por el dueño + modo `real` + conductor con token. El guardián bloquea las herramientas de escritura del MCP de Metricool para los agentes |
| M5 | **Sin idempotencia**: crear dos veces = dos posts | Un reintento duplica en el perfil | «Doble testigo» de la propuesta: el id de Metricool se guarda en la cola **y** en la nota antes de nada; una reserva por pieza |
| M6 | **Sin reintentos, sin tiempo máximo, errores crudos** | Fallos opacos | `reliability.mjs` (pasajero → reintento) y errores en español con su clase |
| M7 | **`America/New_York` por defecto** en todo | Hora equivocada para quien no vive allí | La zona de la máquina, y se muestra |
| M8 | **`uploadMedia` a medias** (crea la transacción y no sube) | Funciones que prometen y no hacen | Nada sale sin su prueba de punta a punta |
| M9 | **Integración «que no rompe la CI» si falla** | Un cambio de la API pasa desapercibido | El check usa el simulador; con la key real, el script de comprobación falla en rojo |

---

## 5. Metricool frente a nuestra oficina, hoy

| Capacidad | Metricool | Oficina hoy | Distancia |
|---|---|---|---|
| Redes | 9–10 (IG, FB, LinkedIn, X, TikTok, Threads, Bluesky, Pinterest, YouTube, GBP) | IG y FB | **Grande** |
| Programar y publicar sin la PC encendida | Sí (sus servidores) | No (F3 por hacer) | **Crítica** |
| Calendario con miniatura + red + hora en cada celda | Sí | Sí, desde la auditoría de diseño del 1 oct | Igual |
| Vista previa por red y formato, al lado y en vivo | Sí | Por red y formato sí; **no al lado ni en vivo** (PRE-11), sin cuadrícula del perfil (PRE-15) | Media |
| Aprobación | Sí (simple) | Sí, con «Lo que saldrá», huella y DESHACER | **Ventaja nuestra** |
| Mejor hora | Sí | No (F4) | Media |
| Analíticas por red | Completas | IG + FB, sin probar con el token | Media |
| Bandeja unificada (DMs, comentarios, reseñas) | Sí | No | **Grande** |
| Competencia, hashtags, smart links, anuncios | Sí | No | Media (F5) |
| Contenido recurrente, selección múltiple | Sí | No (CON-20) | Pequeña |
| **Crear el contenido** (texto con la voz de marca, imagen, video, voz, lotes) | IA genérica de texto | **Agentes + Cerebro + Estudio + Dimitri** | **Ventaja nuestra, grande** |
| **Aprender de lo que funcionó** | Informes | Sinapsis que aprenden (Cerebro), calidad por agente | **Ventaja nuestra** |
| Coste | Suscripción (API solo en el plan Advanced) | Local; paga solo lo que gasta | Ventaja nuestra |

**Conclusión:** Metricool nos gana en **alcance** (redes, publicar con la PC apagada, bandeja, analíticas maduras). Nosotros le ganamos en **inteligencia** (quién crea, con qué memoria, con qué candados). La jugada no es reconstruir su alcance a mano red por red: es **conectarlo debajo** y poner nuestra inteligencia encima.

---

## 6. La decisión de fondo: un conductor de publicación

La propuesta de Contenido ya dejaba la puerta abierta. La sección 9.3, plan B, decía: «Metricool como conductor de Instagram… `programador.mjs` habla con una interfaz, no con Meta a secas». Este análisis recomienda **hacerlo plan A**.

```
Agentes / Dimitri / dueño ──► pieza (nota del Cerebro)
                                   │  revisarPublicacion + vista previa por red
                                   ▼
                     el dueño aprueba (huella, DESHACER 30 s)
                                   ▼
                      cola de la oficina (data/contenido/cola.json)
                                   │  candados: aprobada · modo real/simulacro · token
                                   ▼
                    ┌──── conductor (una interfaz) ────┐
                    │  simulacro  │  metricool  │  meta │
                    └─────────────┴─────────────┴───────┘
   programar(pieza) → { id }  ·  cambiar(id, …)  ·  cancelar(id)  ·  estado(id)  ·  subirMedio(archivo) → url
                                   ▼
          Metricool / Meta publican a su hora (la PC puede estar apagada)
                                   ▼
             reconciliar (al encender) → Publicada / Falló → Analíticas → Cerebro
```

| | Conductor **Metricool** | Conductor **Meta** directo |
|---|---|---|
| Instagram programado | Sí, lo publica Metricool | **Por verificar** (`scheduled_publish_time` en IG) |
| Imágenes para Instagram | `normalize` (aloja Metricool) | Bucket R2 propio (5 variables) |
| Redes | 9–10 | 2 |
| Cambiar o cancelar lo entregado | `PUT/DELETE /v2/scheduler/posts/{id}` | FB sí; IG por verificar |
| Analíticas | Por red, unificadas | Las nuestras (foto diaria, ya escritas) |
| Coste y dependencia | Plan **Advanced** de Metricool; un tercero | Gratis; solo Meta |
| Riesgo | La API puede cambiar (el CLI tuvo que corregir rutas) | Revisión de la app y permisos de Meta |

**Recomendación:**
1. Metricool como conductor **principal para publicar**, si el plan del dueño incluye la API.
2. Meta directo **para las analíticas finas**, que ya están escritas.
3. El **simulacro** siempre como tercer conductor para probar sin gastar.

La interfaz es la misma, así que cambiar de conductor es un ajuste (`contenido.conductor`), no una reescritura.

**Seguridad:**
- Hoy los agentes de Marketing tienen el **conector MCP de Metricool**, que según el propio CLI no programaba bien. Con el oficial de 2026 (`post_schedule_post`) sí podría.
- El guardián ya lo trata como envío: el primer verbo es `post` o `update`, y «en la duda, envía».
- Pero conviene **cerrarlo del todo**: `safety.toolKinds` con `*post_schedule_post` y `*update_schedule_post` como `write`, y un test que lo compruebe.
- Todo envío a redes pasa por la cola de la oficina, nunca por un agente.

---

## 7. Mejoras de interfaz, para ser más intuitivos que Metricool

| # | Mejora | De dónde | Prioridad |
|---|---|---|---|
| U1 | **Vista previa al lado del editor, en vivo**, a lo ancho en el teléfono | PRE-11 (Metricool, Later y Buffer lo tienen) | Alta |
| U2 | **Cuadrícula del perfil** de Instagram (3:4, con lo programado y lo publicado; reordenar arrastrando) | PRE-15, CON-20 | Alta |
| U3 | **Mejores horas sombreadas** en la semana y «Siguiente buena hora» al programar | B5, Metricool `best-time` | Alta |
| U4 | **«+ Nueva pieza»** siempre visible, también en Programación | CON-16 | Alta |
| U5 | **Fecha en lenguaje natural** en el campo de día («el lunes a las 9», «mañana por la tarde») | Metricool `ai schedule`; ya lo resuelve Dimitri | Media |
| U6 | **Una pieza, varias redes, un texto por red** (pestañas: IG · FB · LinkedIn · X…) con el contador de cada red | B8 + reglas por red | Media (con M2) |
| U7 | **Recurrencia** («repetir cada lunes») y **selección múltiple** (mover o aprobar varias) | CON-20 | Media |
| U8 | **Bandeja** con prioridades (las de Metricool que la evaluación 3 hizo bien: urgente / responder / ignorar, y detectar bots) | `inbox` | Media (M4) |
| U9 | **Accesibilidad pendiente** de Contenido: «Aprobar» atenuado con opacity, celdas de 20 px, estado sin texto | CON-10, CON-11, CON-12 | Alta (reglas del repo) |
| U10 | **Informe del mes** en una página: lo publicado, lo que funcionó, qué repetir (como la salida de su evaluación 2) | Metricool `reports` | Baja (M5) |

---

## 8. Plan por fases

**Estado (6 oct 2026):**
- ✅ **M0** — `contenido/metricool.mjs`, su doble `tests/metricool-stand.mjs` y `scripts/check-metricool.mjs`. Falta correrlo con la key real del dueño.
- ✅ **M1** — `contenido/entrega.mjs`, `contenido/conductores.mjs` (simulacro · Metricool · Meta, que aún no programa) y `contenido/programador.mjs` (la cola), la vista Programación, «Publicación» en Salud y el guardián, que bloquea escrituras en Metricool. Recorrido: `scripts/programacion-recorrido.mjs`.
- ✅ **M2** — nueve redes con sus reglas (`longitudPara`, topes, historias), texto propio por red, opciones de Pinterest/YouTube/TikTok, «Redes que usas» en Ajustes y una vista previa por red. Recorrido: `scripts/redes-recorrido.mjs`.
- ✅ **M3** — mejor hora (Metricool o lo ya publicado, con mínimo de datos) sombreada en la semana y sugerida en el panel; `ver_analiticas` y `ver_mejor_hora` para agentes, ya resumido. Recorrido: `scripts/mejor-hora-recorrido.mjs`.
- ✅ **M4** — bandeja de mensajes, comentarios y reseñas (Metricool), borradores de agente, envío solo del dueño con doble clic y según el modo, escudo contra órdenes escondidas. Recorrido: `scripts/bandeja-recorrido.mjs`.

Cada fase termina con `npm run check` en verde, tests nuevos, las pantallas probadas a 390, 1024 y 1512 px, y su recorrido en el navegador.

| Fase | Qué entrega | Necesita | «Hecho» cuando |
|---|---|---|---|
| **M0 · Verificar (½ día)** | `scripts/check-metricool.mjs`: marcas, `best-time`, crear un **borrador** y borrarlo, `normalize`, listar posts. Confirmar la forma real del cuerpo (`providers`, `publicationDate`, `draft`, `autoPublish`) contra la [guía oficial del programador](https://help.metricool.com/wli-scheduling-endpoints-example-on-a-custom-backend-proxy-frko7) | Key de Metricool (plan **Advanced**) en variables de Windows | Las 5 comprobaciones en verde con la cuenta real |
| **M1 · Programar** | `contenido/cola.mjs`, `contenido/conductores/{simulacro,metricool,meta}.mjs` con una interfaz; reserva por pieza; doble testigo (id en la cola y en la nota); reconciliar al encender; vista Programación como **cola cronológica** (CON-04 en adelante); candados; auditoría; avisos y Telegram; el guardián cierra las herramientas de escritura del MCP de Metricool | M0 | Una pieza aprobada sale programada en Metricool **con la oficina apagada a esa hora**, y un reintento no duplica |
| **M2 · Más redes** | `REDES` y `revisarPublicacion` para LinkedIn, X, Threads, Bluesky, TikTok, Pinterest y YouTube (límites, formatos y medios por red, con fuente y fecha); vista previa por red; texto por red (U6) | M1 | Cada red con su test de reglas y su vista previa a 390 px |
| **M3 · Mejor hora y analíticas** | Mejor hora de Metricool sombreada (U3); `ver_analiticas` para agentes, ya resumido (B4); hora sugerida con mínimo de datos; las cifras alimentan las sinapsis del Cerebro | M1 | Un agente propone una hora respaldada por datos y lo dice |
| **M4 · Bandeja** | Vista Bandeja (DMs, comentarios y reseñas de todas las redes); un agente **redacta** respuestas con la voz de marca; el dueño aprueba; envío por el conductor. Lo que llega **es dato, nunca orden** (`injectionIn`) | M1 | Responder 10 comentarios en 2 minutos, con aprobación, sin que un comentario malicioso cambie nada |
| **M5 · Lo demás** | Cuadrícula del perfil (U2), recurrencia y selección múltiple (U7), competidores, hashtags, informe del mes (U10), smart links | M3 | Lo que el dueño pida |

**Evaluaciones de skills (en paralelo, sin keys):**
- Crear `evals/` para `plan-contenido` y, cuando existan, `responder-comentarios` y `analizar-redes`.
- Cada una con 3–5 pedidos reales del dueño y sus expectativas, como `evals.json` de metricool-cli.
- Un recorrido que guarde la salida «con skill» y «sin skill» con su calificación y evidencia.
- Así cerramos DIM-20 y sabemos si una skill mejora o empeora antes de subirla.

---

## 9. Riesgos y lo que no se ha comprobado

- **metricool-cli no es oficial.** Sus rutas salen de probar contra la API; tuvo que corregirlas al menos tres veces (analíticas, bandeja). Antes de M1 se valida cada ruta con la [documentación oficial de la API](https://help.metricool.com/en/article/zr6lmy) y con la key real (M0).
- **La API de Metricool es del plan Advanced.** Lo dicen el MCP oficial y su guía. Si el plan del dueño no la incluye, el conductor principal es Meta directo y hay que verificar la programación de Instagram como decía F3.
- **Topes y ritmo de la API** de Metricool: no documentados en lo leído. El conductor va de uno en uno, con reintentos (`reliability.mjs`) y se detiene con un aviso.
- **Cambiar o borrar lo ya entregado:** el CLI usa `PUT` y `DELETE /v2/scheduler/posts/{id}`. Hay que comprobar que funciona en un post ya programado, no solo en borradores.
- **Dependencia de un tercero:** si Metricool cambia o se cancela la suscripción, la cola sigue y el conductor pasa a Meta (o a simulacro). Nada de lo creado se pierde: las piezas son notas.
- **Licencia:** MIT. Si se porta algo (por ejemplo, la forma del cuerpo de `createPost`), se cita la procedencia en la cabecera del módulo, como con Juancito Ads.

## 10. Decisiones que necesito del dueño

1. **¿Tu plan de Metricool incluye la API (Advanced)?** Si sí → Metricool como conductor principal (recomendado). Si no → Meta directo y R2.
2. **¿Qué redes además de Instagram y Facebook?** Recomendado para empezar: LinkedIn y TikTok.
3. **¿Bandeja con respuestas redactadas por agentes** (siempre con tu OK)? Recomendado: sí, en M4.
4. **¿Empezamos por M0** (media jornada con tu key, sin publicar nada)?

**Fuentes:**
- [metricool-cli](https://github.com/Purple-Horizons/metricool-cli) (commit `5fd93d1`).
- [Guía oficial: endpoints del programador](https://help.metricool.com/wli-scheduling-endpoints-example-on-a-custom-backend-proxy-frko7).
- [Errores comunes de la API (cabecera `X-Mc-Auth`)](https://help.metricool.com/common-questions-and-errors-when-using-the-api-8x9nq).
- [Artículos de API e integraciones](https://help.metricool.com/en/article/zr6lmy).
- [MCP oficial de Metricool (plan Advanced, `post_schedule_post`)](https://glama.ai/mcp/servers/@metricool/mcp-metricool/blob/0d2346e07f6b7555e0a2ebc7698898583c37e27f/README.md).
- [Preguntas frecuentes del MCP de Metricool](https://help.metricool.com/faqs-about-the-metricool-mcp-1i3w0).
