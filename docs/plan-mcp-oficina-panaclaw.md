# Plan: la oficina entera por MCP en `oficina.panaclaw.com`

> Encargo del dueño (12 nov 2026): «hacer un puente de toda la aplicación vía MCP y conectar esta
> agencia a un subdominio de panaclaw.com… esta conexión debe ser completa de todo, de cada función,
> cada tarea, todo, absolutamente todo, para que Claude también pueda hacerme cosas desde cualquier
> sesión» y «desde el cerebro, desde los anuncios, desde las estadísticas, desde la publicación, desde
> el estudio, desde las tareas, desde Dimitri, desde todos los agentes, skills, todo tiene que ser
> **ajustable** vía MCP. No puede quedar ni un cabo suelto».

En una frase: **un conector MCP en `https://oficina.panaclaw.com/mcp`, con el inicio de sesión de la
oficina, que expone las 29 áreas de la aplicación —leer y escribir— y que no puede saltarse ni la
regla del dinero ni la matriz de roles.**

---

## 0. Tu lista, punto por punto

Lo que pediste con tus palabras (12 nov), contra lo que hay. **Esta tabla es el contrato**: si algo de
aquí no queda alcanzable por MCP al final, el plan falló.

| Lo que pediste | Dónde vive | Estado hoy | Fase |
|---|---|---|---|
| «conectar **conectores** de la oficina» | `/api/conectores`, `/plantillas`, `/probar` + dominios por conector | ✅ existe, con escritura | P5 |
| «controlar o **asignarle tareas a todos los agentes**» | `/api/tasks` POST (cualquier departamento o agente), `/api/tareas/*`, delegar, el enrutador | ✅ existe | P3 + P5 |
| «**añadir o modificar notas del cerebro**» | `/api/note` POST (crear), PUT (modificar), `/append`, `/trash`, `/restore` | ✅ existe | P5 |
| «**revisarlas**» (las notas) | `/api/brain/stale` (las que conviene revisar), `/brain/actualizar` → calidad: repetidas y contradicciones | ✅ existe | P5 |
| «**tener contexto** de él / que Claude **lea el cerebro**» | `/api/brain` (el grafo), `/brain/search` (BM25 + significado), `leer_nota`, `buscar_en_cerebro` | ✅ existe | P3 |
| «todas las herramientas del **estudio**» | 30 rutas de `/api/media/*` + `/api/voces/*` (galería, generar, editar, carpetas, presets, lotes, voces, música, papelera, límites) | ✅ existe | P3 + P5 |
| «todas las herramientas del **calendario**» | el de contenido (`/api/contenido/*`) y el de tareas y rutinas (`/api/routines`, `/api/tasks`) | ✅ existe | P5 |
| «todas las herramientas de las **tareas**» | `/api/tasks`, `/api/tareas/*` (pasos, bitácora, bloqueos, proyectos, tablero, cronómetro, repetir) | ✅ existe | P3 + P5 |
| «**contenido y creación del contenido**» | piezas, cola, bandeja, mejorar con Marketing, llenar la semana, plantillas, historias automáticas | ✅ existe | P5 |
| «todas las herramientas de **analíticas**» | `/api/contenido/analiticas`, por cuenta, comparar, informe del mes, indicadores | ✅ existe | P5 |
| «todas las herramientas de **anuncios**» | 9 rutas + método, competencia, revisión 3Q, sugerencias, impulsar, borradores | ✅ existe | P3 + P5 |
| «**lectura completa de cómo está el negocio**» | `/api/business`, `/api/cifras`, `/api/costs`, `/api/quality`, `/api/status`, `/api/anuncios` | ✅ existe, pero **disperso en 6 rutas** → se añade **una** herramienta `radiografia` que lo junta en una lectura | P5 |
| «**modificar la empresa**… hacer **ajustes en los ajustes**» | `/api/settings` (todos los grupos), `/api/funciones` (interruptores), `/api/modelos`, `/api/equipo` | ✅ existe | P5 |
| «poder **dejar notas**» | `/api/notas-personales` (dejarle una nota a una persona, con color, enlace y vencimiento) y el cerebro | ✅ existe | P5 |
| «poder **dejar los mensajes**» | **cuatro sitios**: el chat del equipo (`/api/chat/*`), los comentarios de una tarea (con `@mención`), las notas personales y los avisos | ⚠️ el chat existe (C0) pero con **el interruptor apagado** | P5 + decisión 6 |

**Sobre «dejar los mensajes».** Hay cuatro superficies y conviene que elijas, porque no son lo mismo:

1. **Chat del equipo** (`/api/chat/*`): canales y mensajes directos entre las personas de PanaClaw.
   Está construido (C0, 29 oct) pero `chat.config.activo` está **apagado** y no tiene pantalla. Por
   MCP se puede usar en cuanto se encienda; lo enciendo en la P5 solo si me lo dices.
2. **Comentario en una tarea**: es lo que ya usa el equipo, y una `@mención` avisa a esa persona. Para
   «dile a Avalon que…», esto es lo correcto, no el chat.
3. **Nota personal**: «mientras no estabas». Para algo que debe ver al entrar, no ahora.
4. **Aviso** (`/api/notificaciones`): lo que el sistema avisa. Por MCP, solo leer y marcar leído:
   fabricar avisos del sistema a mano los volvería ruido.

Mi recomendación: por MCP, los cuatro para **leer**; para **escribir**, el comentario de tarea y la
nota personal desde el principio, y el chat del equipo cuando decidas encenderlo.
---

## 1. Lo que comprobé antes de escribir esto

No es de memoria. Esto es el estado real al 12 nov 2026, con la prueba al lado.

| Hecho | Cómo lo comprobé |
|---|---|
| El Worker **no sirve ningún MCP**: no hay `/mcp`, ni OAuth, ni `.well-known` | `grep -rn "'/mcp'\|well-known\|oauth" cloudflare/worker/` → vacío |
| El Worker **no tiene dominio propio**: solo `workers.dev` | `cloudflare/wrangler.jsonc` no tiene `routes` |
| Los 8 MCP que existen son **todos locales, por stdio** | `oficina-mcp.mjs`, `estudio-mcp.mjs`, `tareas-mcp.mjs`, `contenido-mcp.mjs`, `anuncios-mcp.mjs`, `habilidades-mcp.mjs`, `dimitri-lectura-mcp.mjs`, `mcp.mjs` |
| `/api/oficina/*` (lo que usa `oficina-mcp.mjs`) **solo existe en `serve.mjs`**, no en la nube | `grep -rn "api/oficina" cloudflare/` → vacío |
| La nube tiene **148 rutas `/api/` distintas** en 27 módulos | extracción de literales de `cloudflare/worker/modulos/*.js` + `lib/rutas.js` |
| La nube **ya tiene login, roles y equipo** (`admin`, `editor`, `lectura`, `agente`) | `cloudflare/worker/lib/sesion.js`, `equipo.js` |
| `agents-office` y `panaclaw-sitio`, `panaclaw-oficial`, `hub-panaclaw` están en **la MISMA cuenta de Cloudflare** | `workers_list` por el conector de Cloudflare: 8 Workers, uno es `agents-office` (modificado 2026-11-12T01:10Z, el despliegue de hoy) |
| `agents-office-db` está en esa misma cuenta | `d1_databases_list` → `a50cb528-ad04-4eb0-b51b-0d6c5bfcf0a8` |
| Las migraciones llegan hasta `0302` | `ls cloudflare/migraciones/` |

**Dos cosas que te interesan de esa tabla.**

1. **El subdominio es posible.** Un dominio propio de Worker exige que la zona esté en la misma cuenta
   que el Worker, y lo están. (Ojo: `CLAUDE.md` dice que la nube se desplegaría «en **otra** cuenta de
   Cloudflare»; en la práctica está en la cuenta principal de PanaClaw. Hay que corregir esa línea.)
2. **Lo que NO pude comprobar yo:** el conector de Cloudflare que tengo es el de *Workers Bindings* y
   no incluye zonas ni DNS. Que `panaclaw.com` sea una zona activa en esa cuenta, y que no haya ya un
   registro `oficina`, hay que verlo. Para eso está el prompt de la §12.

---

## 2. La arquitectura: cuatro capas

El problema de verdad no es el transporte —eso está resuelto— sino **cómo se expone una aplicación de
148 rutas sin que el modelo se ahogue**. Una herramienta por ruta son 148 herramientas: Claude
empieza a equivocarse mucho antes de eso. Y una sola herramienta genérica («llama a esta ruta») es
indescubrible y además deja la seguridad en manos del modelo.

La salida son cuatro capas, de más específica a más general:

**Capa 1 — las ~20 herramientas finas que ya existen y se usan.** `ver_calendario`, `ver_tareas`,
`crear_borrador`, `generar_imagen`, `hablar_con_dimitri`… Ya están diseñadas, con nombres en español,
esquemas probados y tests. No se tocan: el conector remoto sirve **las mismas**, para que lo que hoy
funciona por stdio siga igual.

**Capa 2 — una herramienta por DOMINIO, con `accion` de lista cerrada (24).** `cerebro`, `tareas`,
`contenido`, `anuncios`, `estudio`, `agentes`, `skills`, `ajustes`, `equipo`… Cada una declara en su
descripción las acciones que acepta (`cerebro` → `buscar · leer · crear · agregar · conectar ·
calidad · mapa · papelera · restaurar`). Así las 148 rutas caben en 24 herramientas que el modelo
puede descubrir, y cada acción sigue siendo un valor de un `enum`, no texto libre.

**Capa 3 — `hacer` y `deshacer`: las 24 operaciones ya vetadas.** `sub.OPS` (en `sub-core.mjs`) es
una lista cerrada de 24 operaciones de escritura que YA pasaron auditoría, con su ejecutor
(`cloudflare/worker/lib/dimitri/ops.js`), su validador (`parseOps`) y sus 30 segundos de DESHACER.
No se reimplementa: el MCP entra por la misma puerta que Dimitri.

**Capa 4 — el puente con tabla blanca, para la cola larga.** Lo que no cubra nada de lo anterior se
alcanza con `oficina_ruta`, que **no es un `fetch` libre**: lee una tabla declarada
(`mcp-superficie.mjs`) donde cada entrada es `ruta · método · rol mínimo · lectura|escritura|gasto`.
Una ruta que no está en la tabla no se puede llamar. Esta capa es la que hace verdadero el «todo».

### El invariante que garantiza «ningún cabo suelto»

Esto es lo más importante del plan, y es un **test**, no una promesa:

> `cloudflare/tests/mcp-cobertura.test.mjs` extrae del código las 148 rutas `/api/` y falla si alguna
> no está (a) cubierta por una herramienta de las capas 1–3, (b) declarada en la tabla de la capa 4, o
> (c) en la lista explícita de exclusiones **con su motivo escrito**.

Una ruta nueva que alguien añada mañana rompe ese test hasta que diga cómo se alcanza por MCP o por
qué no debe alcanzarse. Es el mismo mecanismo con el que el repositorio ya obliga a clasificar cada
tabla de D1 en `restablecer.js`.

---

## 3. El subdominio `oficina.panaclaw.com`

**Qué cambia en `cloudflare/wrangler.jsonc`:**

```jsonc
"routes": [{ "pattern": "oficina.panaclaw.com", "custom_domain": true }],
"workers_dev": true,
```

Cuatro trampas, todas documentadas por el calendario, que pagó cada una:

1. **`workers_dev: true` va escrito.** Con `routes` puesto, wrangler da `workers_dev` por `false` y
   **apaga workers.dev en el siguiente despliegue**. De workers.dev cuelgan las vueltas de OAuth ya
   registradas y los webhooks; apagarlo los rompe. Un test lo exigirá.
2. **El token de despliegue necesita `Zone → Workers Routes → Edit` sobre `panaclaw.com`.** Sin ese
   permiso **falla el despliegue entero**, no solo la ruta.
3. **`run_worker_first` ya cubre `/*`** en esta aplicación, así que `/mcp`, `/oauth/*` y
   `/.well-known/*` los atiende el Worker sin tocar nada. (El calendario tuvo que enumerarlos; aquí
   no hace falta.)
4. **El registro DNS lo crea el despliegue**, no se añade a mano. Si ya existe un `oficina` en la
   zona, el despliegue falla: hay que quitarlo antes.

**La cookie de sesión** usa el prefijo `__Host-`, que funciona en cualquier host https: el login sigue
igual en el subdominio. Pero **las sesiones abiertas en `workers.dev` no sirven en
`oficina.panaclaw.com`** (son otro host): hay que entrar una vez en el dominio nuevo.

---

## 4. Seguridad: lo que un token de MCP NO puede hacer

Un token de MCP es **una persona con su rol**, no un agente. Los candados del guardián
(`safety.mjs`) son para los agentes; estos son los que aplican aquí, y ninguno se relaja:

| Regla | Cómo se impone |
|---|---|
| **El dinero pide dos pasos, siempre** | Las 4 operaciones de `sub.OPS_GASTO` (activar, reanudar, subir presupuesto, relanzar) devuelven la cifra y un testigo de un solo uso; la segunda llamada con ese testigo aplica. Lo exige `anuncios/acciones.mjs` **en el servidor**: el MCP no tiene atajo. |
| **El Estudio no gasta a ciegas** | Desde US$0,50 el servidor pide `confirmado: true`; los topes de día y mes se miran antes de cada imagen. Igual para Suno, ElevenLabs y las series. |
| **`lectura` no escribe** | El servidor rechaza toda herramienta sin `readOnlyHint` si el rol es `lectura`, como ya hace el calendario. |
| **`editor` no decide lo del dueño** | La matriz `SOLO_ADMIN` de `auditoria-transversal.test.mjs` se aplica igual por MCP. |
| **Nunca por MCP: aprobar un borrador, enviar desde la Bandeja, publicar ya, pagar, borrar una cuenta, restablecer la oficina** | No se declaran como herramientas y van en la lista de exclusiones con su motivo. Eso se hace en la aplicación, con la cara delante. |
| **Lo que escribió un tercero no manda** | Todo texto de fuera (resultados de agentes, notas, comentarios, galería, conectores, competencia) pasa por `safety.injectionIn` antes de llegar al modelo, como ya hacen las consultas de Dimitri. |
| **El MCP de la oficina no llega a un agente** | `esDeLaOficina` en `mcp-estado.js` ya lo impide: un agente con los controles del dueño saldría de sus propias reglas. |

**Alcances por conexión.** La pantalla de permiso deja elegir qué puede ese conector:
`lectura` · `oficina` (escribir sin gastar) · `gasto` (habilita el segundo paso del dinero). Así
puedes tener un conector de solo lectura en el teléfono y otro completo en tu computadora. El alcance
viaja en el token y se comprueba en cada llamada.

**Rastro.** Cada llamada deja una fila en `auditoria` con la herramienta, la persona, el conector y si
se permitió. Las conexiones se ven y se cortan desde Ajustes.

---

## 5. Datos nuevos

Una migración, `0400_mcp.sql`, con tres tablas (las del calendario, probadas):

- `mcp_clientes` — las aplicaciones registradas (`client_id`, nombre, direcciones de vuelta).
- `mcp_codigos` — el código de autorización, de un solo uso, con su reto PKCE y su caducidad.
- `mcp_tokens` — el testigo de acceso y el de renovación, atados a la persona, su rol y su alcance.

Obligaciones del repositorio que esto dispara:

- Las tres tablas se **clasifican en `cloudflare/worker/lib/restablecer.js`** (ámbito nuevo `mcp`), o
  `restablecer.test.mjs` falla. Restablecer la oficina debe **cortar todas las conexiones**.
- `cloudflare/tests/despliegue.test.mjs` exige que cada tabla declare su tope de poda: los códigos
  caducados y los tokens sin usar se podan en `mantenimiento.js`.
- Ninguna tabla usa `alter table add column` (la excepción de 0302 fue explícita).

---

## 6. El inventario completo, dominio por dominio

Esto es la respuesta a «ningún cabo suelto»: las 29 áreas, con lo que hoy se puede hacer por HTTP en
la nube y qué hace falta. **«Construir» significa que la nube todavía no tiene esa superficie**, así
que no se puede puentear hasta que exista.

| # | Dominio | Rutas hoy | Herramienta MCP | Falta construir |
|---|---|---|---|---|
| 1 | **Cerebro** | `/api/brain`, `/search`, `/stale`, `/upload`, `/actualizar`, `/api/note` (GET, POST, PUT, append, trash, restore) | `cerebro` (buscar, leer, crear, agregar, conectar, calidad, mapa, papelera, restaurar) + `buscar_en_cerebro`, `leer_nota` | — (está completo) |
| 2 | **Anuncios** | 9 rutas (`/accion`, `/deshacer`, `/impulsar`, `/informe`, `/sincronizar`, `/sugerencias`, `/conversiones/webhook`) | `anuncios` + las 14 de `anuncios-tools.mjs` + `hacer` (las 6 de anuncios) | — |
| 3 | **Método y competencia** | dentro de `/api/anuncios/metodo/*` (12 nov) | `ver_numeros_negocio`, `ver_revision_campanas`, `ver_ciclo_ventas`, `ver_anuncios_competencia` + escritura del negocio | — |
| 4 | **Estadísticas / Analíticas** | `/api/contenido/analiticas`, `/actualizar`, `/indicadores` | `analiticas` (resumen, por cuenta, comparar, informe, indicadores) | — |
| 5 | **Publicación / Contenido** | 10 rutas (piezas, cola, config, mejorar, Meta) | `contenido` + las 13 de `contenido-tools.mjs` | — |
| 6 | **Bandeja** | `/api/contenido/bandeja/*` | `bandeja` (leer, borrador, ocultar, sugerir) | **enviar queda fuera** (es del dueño, en la app) |
| 7 | **Estudio** | 30 rutas (galería, trabajos, carpetas, presets, lotes, voces, papelera, límites) | `estudio` + las 14 de `estudio-mcp.mjs` | separar `estudio-mcp.mjs` en `estudio-tools.mjs` |
| 8 | **Series** | `/api/series`, `/proponer`, `/<id>/*` | `series` (ver, proponer, tanda, libro) | el gasto sigue cerrado en la nube (flags apagadas) |
| 9 | **Tareas** | `/api/tasks`, `/api/tareas/*`, `/resumen` | `tareas` + las 10 de `tareas-tools.mjs` | — |
| 10 | **Rutinas** | `/api/routines`, `/fabrica` | `rutinas` (ver, crear, editar, pausar, reanudar, saltar, ahora) + `hacer` | — |
| 11 | **Dimitri** | 16 rutas (`/chat`, `/ops`, `/ops/undo`, conversaciones, semanal, estudio) | `dimitri` (hablar, plan, ops, conversaciones, semanal) + `hablar_con_dimitri` | — |
| 12 | **Agentes (el roster)** | `/api/agents` GET + PATCH (`guardarAgente`) | `agentes` (ver, editar brief, modelo, esfuerzo, herramientas, lecciones, ejemplos, versiones, volver a una) | — (la escritura existe) |
| 13 | **Skills** | **ninguna**: se guardan en `filas/skills` y se leen por dentro, pero **no hay ruta HTTP** | `skills` (listar, leer, crear, editar, borrar, a qué agente) | **CONSTRUIR `/api/skills`** en la nube |
| 14 | **Biblioteca de habilidades** | `/api/biblioteca` (lectura) | `habilidades` + las 2 de `habilidades-tools.mjs` | escritura de las propias del dueño |
| 15 | **Ajustes** | `/api/settings`, `/telegram` | `ajustes` (leer, cambiar un grupo) | — |
| 16 | **Funciones (interruptores)** | `/api/funciones` | `funciones` (listar, encender, apagar) | — (lo que gasta pide segundo toque) |
| 17 | **Equipo y cuentas** | `/api/equipo`, `/invitaciones`, `/api/yo/*` | `equipo` (ver, invitar, rol, quitar) | **borrar una cuenta queda fuera** |
| 18 | **Conectores MCP** | `/api/conectores`, `/plantillas`, `/probar` | `conectores` (ver, añadir, probar, apagar, dominios) | el token se manda una vez y no se devuelve |
| 19 | **Modelos** | `/api/modelos`, `/activos`, `/comparar`, `/probar` | `modelos` (ver, asignar, probar, comparar) | — |
| 20 | **Costos y calidad** | `/api/costs`, `.csv`, `/apply`, `/api/quality`, `/api/usage` | `costos` (mes, por agente, calidad, aplicar sugerencia, CSV) | — |
| 21 | **Negocio y cifras** | `/api/business`, `/kpi`, `/value`, `/api/cifras`, `/confirmar`, `/api/voice` | `negocio` (indicadores, anotar, cifras, voz de marca) | — |
| 22 | **Onboarding / preparar** | `/api/onboard/*` (propuesta, aplicar, descartar, deshacer) | `onboard` (propuesta, aplicar, descartar) | — |
| 23 | **Notificaciones** | `/api/notificaciones`, `/config`, `/leer` | `notificaciones` (ver, leer, config) | — |
| 24 | **Notas personales** | `/api/notas-personales` | `notas` (ver, crear, editar, borrar) | — |
| 25 | **Disparadores** | `/api/triggers`, `/api/hook/<id>` | `disparadores` (ver, crear, editar, apagar) | el secreto nunca sale |
| 26 | **Estado y salud** | `/api/status`, `/api/notices/read`, `/api/health`, `/api/ejecuciones` | `estado` (semáforo, avisos, ejecuciones) | — |
| 27 | **Telegram** | `/api/settings/telegram`, `/api/vinculo-telegram` | `telegram` (estado, vincular) | el webhook no se expone |
| 28 | **Chat del equipo** | `/api/chat/resumen`, `/personas`, `/canales`, `/directo`, `/canales/<id>/mensajes` | `chat` (canales, leer, escribir, directo) | ⚠️ construido pero con `chat.config.activo` **apagado**; sin pantalla ni sockets |
| 29 | **Radiografía del negocio** | junta `/api/business`, `/api/cifras`, `/api/costs`, `/api/quality`, `/api/status`, `/api/anuncios` | `radiografia` (una lectura: caja, pauta, contenido, tareas, costos, salud) | **CONSTRUIR**: es una herramienta nueva que compone, no una ruta nueva |

**Exclusiones, con su motivo** (van en la lista del test de cobertura):

| Ruta | Por qué no se expone |
|---|---|
| `/api/acceso`, `/api/salir`, `/api/yo/sesiones/*` | la sesión del navegador; el MCP tiene su propio token |
| `/api/telegram/webhook`, `/api/hook/<id>`, `/api/kpi/<id>`, `/api/anuncios/conversiones/webhook` | son webhooks públicos con su propio secreto, no cosas que Claude llame |
| `/api/restablecer/*` | vacía la oficina; se hace con la cara delante |
| `/api/migrar/*` | la herramienta de migración de tu computadora, de un solo uso |
| `/api/live` | el socket de presencia |
| `/api/imagen-meta`, `/api/icono-conector`, `/media/*` | sirven bytes al navegador; por MCP las piezas van como imagen en el resultado |
| `/api/invitacion/<t>` | la abre una persona en su navegador |

---

## 7. Lo que hay que construir antes de poder puentearlo

Cuatro cosas. Son trabajo real, no plomería del MCP.

1. **`/api/skills` en la nube** (§6, fila 13). Las skills ya viven en D1 (`filas/skills`) y las leen
   los agentes y `salud.js`, pero no hay ruta para listarlas, leerlas, crearlas ni editarlas. Sin
   esto, «skills ajustable vía MCP» no se puede cumplir. Es un módulo nuevo,
   `cloudflare/worker/modulos/skills.js`, con la validación de `skills.mjs` (cabecera, topes de
   6.000/4.000/8.000 caracteres, el enlace a un agente o departamento que existe).
2. **Separar `oficina-mcp.mjs` y `estudio-mcp.mjs` en `*-tools.mjs`.** El repositorio ya tiene esa
   convención (`tareas-tools.mjs`, `contenido-tools.mjs`, `anuncios-tools.mjs`,
   `habilidades-tools.mjs`): las definiciones puras aparte y el transporte encima. Esas dos (18 y 14
   herramientas) todavía las tienen mezcladas, y el conector remoto necesita las definiciones sin el
   stdio.
3. **`/api/oficina/*` en la nube**, o su equivalente. Hoy `mapa`, `estado`, `calendario`, `accion` y
   `deshacer` solo existen en `serve.mjs`. En la nube, `accion`/`deshacer` ya tienen dueño
   (`lib/dimitri/ops.js`), así que lo que falta de verdad es **`como_funciona`**: el mapa de la
   oficina y sus reglas, que es lo que hace que Claude sepa dónde está parado. Se porta desde
   `oficina/mapa.mjs` y `guia-oficina.mjs` (45 entradas).
4. **La herramienta `radiografia`.** «Una lectura completa de cómo está el negocio» hoy son seis
   llamadas (`/api/business`, `/api/cifras`, `/api/costs`, `/api/quality`, `/api/status`,
   `/api/anuncios`). No falta ninguna ruta: falta **una herramienta que las junte** y devuelva una
   sola lectura —caja y cifras, pauta y su costo por resultado, contenido de la semana, tareas y
   aprobaciones esperando, gasto de IA contra el presupuesto, y el semáforo— en el orden en que tú
   preguntas. Es composición, no una ruta nueva: va en `cloudflare/worker/lib/radiografia.js`, pura
   salvo las lecturas, con su test.

---

## 8. Las fases

Cada fase deja la oficina funcionando y se puede desplegar sola.

**P0 · Verificar el dominio (tú y la gente de Cloudflare).** La zona `panaclaw.com` activa en la
cuenta correcta, sin registro `oficina` previo, y el token de despliegue con
`Zone → Workers Routes → Edit`. Prompt en la §12. **Nada de código hasta que esto esté claro.**

**P1 · El subdominio, sin MCP todavía.** `routes` + `workers_dev: true` en `wrangler.jsonc`, un test
que exija los dos, y desplegar. Resultado: la oficina abre en `https://oficina.panaclaw.com` y sigue
abriendo en workers.dev. Riesgo bajo, y deja el dominio probado antes de montarle nada encima.

**P2 · OAuth y el servidor MCP vacío.** Migración `0400_mcp.sql`; `cloudflare/worker/modulos/mcp.js`
portado de `worker/rutas/mcp.js` del calendario; la pantalla de permiso `/conectar-claude` (una página
de la oficina, para entrar con la sesión de siempre); `initialize`, `ping`, `tools/list` con **una**
herramienta (`como_funciona`). Se añade el conector en claude.ai y se comprueba el baile entero.
Tests: el flujo OAuth contra workerd real (como `vivo.test.mjs`), PKCE obligatorio, código de un solo
uso, renovación rotada, un token de otra persona no ve nada.

**P3 · Capa 1: las herramientas que ya existen.** Separar las dos que faltan (§7.2) y servir las
~20 finas. Aquí ya puedes hacer cosas de verdad desde cualquier sesión.

**P4 · Capa 3: `hacer` y `deshacer`.** Las 24 operaciones vetadas por el ejecutor de Dimitri, con el
segundo paso del dinero y los 30 segundos de DESHACER. Test: ninguna op nueva entra sin estar en
`sub.OPS`; las 4 de gasto no se aplican sin testigo.

**P5 · Capa 2: las 24 herramientas de dominio.** Una por área, con su `accion` cerrada. Es la fase
más larga y la que de verdad cubre «todo». Se hace dominio por dominio, en el orden que tú digas; mi
orden sería: cerebro → tareas → contenido → anuncios → estudio → agentes → skills → el resto.

**P6 · Construir lo que falta.** `/api/skills` (§7.1), el mapa de la oficina (§7.3) y la herramienta
`radiografia` (§7.4). Si decides encender el chat del equipo, su interruptor va aquí.

**P7 · Capa 4: el puente con tabla blanca.** `mcp-superficie.mjs` y `oficina_ruta`. Con esto se cierra
el test de cobertura: ya no queda ninguna ruta sin camino.

**P8 · Alcances, rastro y la pantalla de conexiones.** Los tres alcances, la fila de `auditoria` por
llamada, Ajustes → Conectar Claude con la lista de conexiones y su botón de cortar, y los topes por
token.

---

## 9. Tests e invariantes

El repositorio ya obliga a varias cosas; el plan las respeta y añade las suyas.

**Ya existentes, que hay que satisfacer:**

- `cloudflare/tests/restablecer.test.mjs` — las 3 tablas nuevas clasificadas, o falla.
- `cloudflare/tests/auditoria-transversal.test.mjs` — toda ruta nueva que escribe va en `ESCRIBEN`, y
  si es del dueño, en `SOLO_ADMIN`. El test extrae las rutas del código: no se puede olvidar.
- `cloudflare/tests/despliegue.test.mjs` — el tope de poda de cada tabla; nada de `alter table`.
- `tests/control-oficina.test.mjs` — falla si aparece una operación que suene a aprobar, enviar,
  publicar, pagar o borrar.
- `scripts/topes-codigo-nuevo.mjs` — líneas ≤ 300 caracteres, archivo nuevo ≤ 800 líneas.

**Nuevos:**

- `cloudflare/tests/mcp-cobertura.test.mjs` — **el invariante del encargo** (§2): ninguna ruta sin
  camino ni exclusión motivada.
- `cloudflare/tests/mcp-oauth.test.mjs` — el baile completo contra workerd real.
- `cloudflare/tests/mcp-roles.test.mjs` — la matriz rol × herramienta: `lectura` no escribe, `editor`
  no toca lo del dueño, un alcance `lectura` no gasta aunque el rol sea `admin`.
- `cloudflare/tests/mcp-dinero.test.mjs` — las 4 operaciones de gasto no se aplican sin el testigo, y
  el testigo es de un solo uso y caduca.
- `cloudflare/tests/mcp-dominio.test.mjs` — `routes` y `workers_dev: true` juntos en `wrangler.jsonc`.
- Banco de inyección: lo que devuelve cada herramienta con texto de terceros pasa por `injectionIn`
  (reusar `tests/fixtures/banco-ataques.mjs`).

---

## 10. Lo que este plan NO hace

Para que no haya sorpresas:

- **No expone la oficina de tu computadora.** Esto es la nube. El `oficina-mcp.mjs` local sigue como
  está, por stdio, para Claude Desktop y Claude Code en tu máquina.
- **No cambia quién puede gastar.** Ni un centavo más sin tus dos pasos.
- **No hace que Claude apruebe borradores ni publique.** Eso se queda en la aplicación.
- **No toca los agentes como ejecutores.** Los agentes siguen con sus mesas y su guardián; lo que se
  vuelve ajustable es su *ficha* (brief, modelo, esfuerzo, skills), no su libertad.
- **No prueba nada contra Meta, Scrape Creators ni los motores reales.** Eso sigue pendiente de la
  entrega anterior.

---

## 11. Decisiones que espero de ti

Cinco, y con tus respuestas el plan queda cerrado:

1. **El subdominio.** ¿`oficina.panaclaw.com`, como propones? (Me parece bien: dice lo que es.)
2. **¿Mantener workers.dev?** Mi recomendación: sí, encendido, como red de seguridad y porque apagarlo
   rompe vueltas de OAuth ya registradas. El dominio nuevo sería el oficial.
3. **Los alcances.** ¿Quieres los tres (`lectura`, `oficina`, `gasto`) o con uno te basta al principio?
   Mi recomendación: los tres desde el principio, porque añadirlos después obliga a reconectar.
4. **Quién puede conectar.** ¿Solo tú (admin), o también los editores de PanaClaw con su propia cuenta?
   Mi recomendación: admin y editor, cada uno con su token y su rol; `lectura` solo con alcance de
   lectura.
5. **El orden de la P5.** ¿Te sirve mi orden (cerebro → tareas → contenido → anuncios → estudio →
   agentes → skills → resto) o prefieres otro?
6. **El chat del equipo.** ¿Lo enciendo (`chat.config.activo`) para poder dejar mensajes por MCP, o
   prefieres que «dejar un mensaje» sea solo un comentario en una tarea y una nota personal? Mi
   recomendación: empezar sin el chat (comentario + nota cubren el 90 %) y encenderlo cuando tenga
   pantalla, para que nadie reciba mensajes que no puede ver desde la oficina.

---

## 12. Prompt para la gente de Cloudflare (la parte del DNS que no puedo ver)

Esto es lo que pediste: un prompt para que lo analicen con la extensión de Chrome. Cópialo tal cual.

```
Necesito preparar un subdominio para un Cloudflare Worker que ya está desplegado.
Contexto: el Worker se llama «agents-office» y está en la misma cuenta que los Workers
«panaclaw-sitio», «panaclaw-oficial» y «hub-panaclaw». La zona panaclaw.com acaba de
moverse a Cloudflare. Quiero servirlo en oficina.panaclaw.com como dominio propio de
Worker (Custom Domain), no como ruta.

Por favor comprueba y dime:

1. ¿La zona panaclaw.com está ACTIVA en esta misma cuenta de Cloudflare (la que tiene el
   Worker «agents-office»)? Si está en otra cuenta, dime en cuál, porque entonces un
   dominio propio de Worker no es posible y habría que usar otra solución.
2. ¿Existe ya algún registro DNS para «oficina» en panaclaw.com (A, AAAA, CNAME) o algún
   Worker Route que case con oficina.panaclaw.com? Si existe, dime qué es y a dónde
   apunta, porque hay que quitarlo antes: el despliegue falla si ya hay un registro.
3. ¿Cómo está el modo SSL/TLS de la zona? Necesito «Full» o «Full (strict)»; con
   «Flexible» hay bucles de redirección.
4. ¿Hay alguna regla que pueda interceptar ese subdominio antes del Worker: Page Rules,
   Redirect Rules, Transform Rules, Bulk Redirects, Access/Zero Trust, o WAF con bloqueo
   por país o por bot? El subdominio tiene que llegar al Worker SIN que nada lo reescriba,
   porque sirve un API y un endpoint de OAuth.
5. ¿Está «Always Use HTTPS» encendido en la zona? (Lo quiero encendido.)
6. El token de API que usa el despliegue por GitHub Actions: ¿tiene el permiso
   «Zone → Workers Routes → Edit» sobre panaclaw.com, además de los de Workers Scripts,
   D1 y R2? Si no lo tiene, el despliegue falla completo, no solo la ruta. Dime qué
   permisos tiene hoy.
7. ¿Hay límite de Custom Domains en el plan de esta cuenta y cuántos se están usando?

No cambies nada todavía: primero dime cómo está todo y qué habría que ajustar.
```

Cuando te contesten, pégame la respuesta y ajusto la P1 con lo que digan.

---

## 13. Resumen para decidir

- **Es posible, y el camino está probado:** el calendario ya tiene este mismo conector funcionando
  (`worker/rutas/mcp.js`, 272 líneas, con OAuth, PKCE y la pantalla de permiso). Se porta, no se
  inventa.
- **El trabajo grande no es el MCP, es la cobertura:** 148 rutas en 29 áreas, y cuatro cosas que hay que
  construir antes (skills, el mapa, separar dos MCP).
- **El «ningún cabo suelto» es un test**, no una promesa: `mcp-cobertura.test.mjs` falla si queda una
  ruta sin camino.
- **La regla del dinero no se toca.** Ni por MCP, ni desde el teléfono, ni desde otra sesión.
