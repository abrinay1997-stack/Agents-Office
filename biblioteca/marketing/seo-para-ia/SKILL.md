---
name: seo-para-ia
titulo: SEO para IA
description: Úsala cuando el dueño quiera que su negocio aparezca o lo citen en respuestas de ChatGPT, Perplexity, Gemini, Claude o los resúmenes de IA de Google; también AEO, GEO, llms.txt o «¿está nuestro sitio listo para agentes?». Para auditorías de SEO clásico, usa auditoria-seo.
area: seo
departments: [marketing]
agents: [riley, mlead, iggy]
origen: marketingskills/ai-seo (MIT, Corey Haines)
palabras: [ChatGPT, Perplexity, IA, búsqueda con IA, citado por IA, AI Overviews, GEO]
---
# SEO para IA

Sirve para que el contenido de una empresa sea fácil de encontrar, extraer y citar por los sistemas de IA (resúmenes de Google, ChatGPT, Perplexity, Claude, Gemini, Copilot). Tu meta: que el negocio salga como fuente y, si se puede, recomendado.

El SEO clásico te posiciona; el SEO para IA hace que te **citen**. Una página bien estructurada puede citarse aunque esté en la página 2 o 3, porque la IA elige por calidad, estructura y relevancia, no solo por posición. Pero el buen posicionamiento orgánico sigue siendo de los mejores predictores de visibilidad en IA: la estructura es una capa encima del SEO, no su reemplazo.

## Antes de empezar

Lee las notas de la empresa en el Cerebro (`00-Empresa/perfil`, `00-Empresa/oferta`, `00-Empresa/clientes`, `00-Empresa/faq` y, sobre todo, `00-Empresa/marketing`) y las cifras de la empresa. Usa ese contexto y solo pregunta lo que no esté ahí. Si falta algo que necesitas, pregúntalo en una línea o déjalo marcado como supuesto; nunca lo inventes.

Reúne (pregunta lo que falte): **visibilidad actual** (¿aparece la marca hoy en respuestas de IA?, ¿qué consultas importan al negocio?) · **contenido y dominio** (blog, documentación, comparativas, páginas de producto o servicio, ficha de negocio local; fuerza del SEO tradicional; datos estructurados) · **metas** (que lo citen, aparecer en los resúmenes de Google, competir con quien ya sale, optimizar lo existente o crear nuevo) · **competencia** (quién sale hoy y dónde).

## Cómo funciona la búsqueda con IA

Cada plataforma usa un índice distinto (Google, Bing, Brave o el propio); cómo elige fuentes cada una está en `factores-por-plataforma`.

**Cifras clave** (cambian: verifícalas antes de citarlas y desconfía de las de proveedores sin fuente ni fecha): los resúmenes de IA aparecieron en ~45 % de las palabras clave que rastrea BrightEdge y el CTR del primer resultado cayó ~58 % cuando había uno (Ahrefs, dic 2025); son cifras de muestra, no pronostican el tráfico de un sitio concreto. Agregar estadísticas y citas subió la visibilidad ~30–40 % en el estudio GEO original (Aggarwal et al., 2023).

### La postura de Google frente a la realidad multiplataforma

Google dice que sus funciones de IA se apoyan en el ranking de siempre: **no hace falta marcado ni archivos especiales, no hay que partir el contenido en trocitos ni escribir contenido aparte «para IA»** (riesgo de spam), y gana el contenido útil con E-E-A-T. Los otros motores (ChatGPT, Claude, Perplexity, Copilot) sí premian la estructura extraíble y los archivos legibles por máquina, y citan más a terceros. Así: para Google, optimiza para personas; para los demás, suma estructura extraíble encima. En la duda, «escribe para personas, organiza para que se entienda». La IA de Google además se ramifica en consultas relacionadas (fan-out): cubre el grupo temático completo, no una página por palabra clave. Detalle: `google-y-fan-out`.

## Auditoría de visibilidad en IA

Antes de optimizar, evalúa la presencia actual en cuatro pasos (tablas completas en `auditoria-de-visibilidad`):
1. **Consultas:** 10–20 que cambiarían ingresos («¿Qué es [categoría]?», «Mejor [categoría] para [uso]», «[Marca] vs [competidor]», «Cómo [problema]», «[categoría] precio»; en negocio local, «[servicio] cerca de mí») en Google IA, ChatGPT y Perplexity. Anota si te citan y a quién; agrupa las variantes de una intención y corre cada una varias veces.
2. **Patrones de cita:** si citan a la competencia y a ti no, compara estructura, autoridad, frescura, datos estructurados y presencia en terceros.
3. **Extraibilidad por página:** definición en el primer párrafo, bloques de respuesta autosuficientes, estadísticas con fuente, tablas para «X vs Y», preguntas frecuentes, autor con credenciales, actualizada en 6 meses.
4. **Acceso de bots de IA, por propósito:** descubrimiento (`OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot`), consulta pedida por una persona (`ChatGPT-User`, `Claude-User`, `Perplexity-User`), posible entrenamiento (`GPTBot`, `ClaudeBot`) y `Google-Extended` (no afecta el ranking en Búsqueda). Bloquear el entrenamiento no necesariamente bloquea las citas. Configuración en `factores-por-plataforma`.

**Cómo pruebas:** si la búsqueda web está encendida, úsala (no reemplaza a las plataformas de IA); si no, pide al dueño que corra cada consulta y pegue respuestas y fuentes. Nunca inventes qué responde una plataforma.

## Estrategia de optimización: los tres pilares

```
1. Estructura  (hazlo extraíble)
2. Autoridad   (hazlo citable)
3. Presencia   (está donde la IA mira)
```

### Pilar 1: Estructura

La IA extrae pasajes, no páginas: cada afirmación clave debe funcionar sola. Patrones: bloques de **definición** («qué es»), de **pasos** («cómo»), **tablas comparativas** («X vs Y»), **pros y contras**, **preguntas frecuentes** y **estadísticas con fuente**. Plantillas de cada uno en `patrones-de-contenido`.

Reglas: empieza cada sección con la respuesta directa · pasajes de respuesta de 40–60 palabras · títulos H2/H3 como la gente formula la consulta · tablas antes que prosa para comparar · listas numeradas para procesos · una idea por párrafo.

### Pilar 2: Autoridad

Investigación GEO de Princeton (KDD 2024, sobre Perplexity.ai), de más a menos efecto: **citar fuentes** (+40 %) · **agregar estadísticas** (+37 %) · **citas textuales de expertos** (+30 %) · tono autoritativo (+25 %) · claridad (+20 %) · términos técnicos (+18 %) · vocabulario variado (+15 %) · fluidez (+15–30 %). El **relleno de palabras clave resta 10 %**. Mejor combinación: fluidez + estadísticas; los sitios de bajo posicionamiento ganan aún más (hasta +115 % con citas). Es un estudio concreto: no lo prometas como garantía.

- **Estadísticas y datos:** con fuente y fecha; investigación original y no resúmenes de ella.
- **Expertos:** autores con nombre y credenciales; citas reales con cargo y organización (nunca inventes una); «según [fuente]».
- **Frescura:** «Última actualización: [fecha]» visible; refrescar al menos cada trimestre en temas competitivos; quitar lo desactualizado.
- **E-E-A-T:** experiencia de primera mano, información específica, fuentes y metodología transparentes.

### Pilar 3: Presencia

La IA cita también dónde apareces, y las fuentes de terceros pesan más que tu sitio: Wikipedia (7,8 % de las citas de ChatGPT, foto con fecha), Reddit (volátil: casi borrado de ChatGPT en ago 2026), publicaciones del sector, LinkedIn (según el motor; `linkedin-citas-ia`), sitios de reseñas (G2, Capterra; en negocios locales Google Maps, Tripadvisor, directorios del gremio), YouTube (`youtube-citas-ia`), pódcast y Quora.

**Acciones:** ficha de Wikipedia exacta si aplica · participar de forma auténtica en comunidades, **como una superficie de un portafolio, nunca la estrategia entera** · aparecer en recopilaciones del sector · que cada perfil de terceros diga lo mismo que «Quiénes somos» (los modelos buscan consenso; `posicionamiento-y-consenso`) · videos para las consultas «cómo hacer» · ser invitado a pódcast (`relaciones-publicas`).

### Archivos legibles por máquina y experiencias de agentes

Los agentes de IA se vuelven compradores: si los precios están tras un «contacta a ventas» o una página que depende de JavaScript, el agente salta a quien sí puede leer. Google dice que nada de esto es obligatorio; los otros motores y los agentes sí lo premian. Primero revisa qué tan listo está el sitio (`preparacion-para-agentes`) y propón, como borradores que sube quien administra la web: **`/pricing.md`** (montos de las **cifras de la empresa**; sirve también con rangos y paquetes), **`/llms.txt`** ([llmstxt.org](https://llmstxt.org)), el paquete **`/okf/`** (v0.1, sin señal de ranking hoy; `formato-abierto-okf`) y **datos estructurados** (Article, HowTo, FAQPage, Product, LocalBusiness…; `datos-estructurados`). Para agentes que navegan: HTML semántico, contenido sin acrobacias de JavaScript, precios y contacto en páginas públicas. Plantillas, la tabla de schema y UCP: `archivos-legibles-por-maquina`.

## Qué contenido se cita más

El formato es **volátil**: comparativas (~33 %) y listas (~10 %) fueron las que más citas ganaban, pero **ChatGPT 5.6 (ago 2026) las degradó (−50,5 % listas, −32,1 % comparativas)** y subieron las búsquedas `site:` y «oficial»: giro hacia fuentes primarias y páginas propias. La estrategia de formatos es por plataforma (`volatilidad-de-formatos`). **Ganan siempre:** investigación y datos originales, guías definitivas y páginas propias «oficiales» (producto, documentación, precios) con estructura extraíble. **Rezagan:** contenido genérico, delgado, cerrado o solo en PDF, sin fecha ni autor.

**Cita ≠ recomendación.** Que te citen es que tu contenido sirvió para consultar; que te *recomienden* lo gobierna el consenso de toda la web (reseñas, foros, analistas, prensa). Las listas «las mejores» donde te pones primero pueden salir mal en marcas emergentes: en un estudio B2B de 100 consultas, el 69 % de las citas que ganaron llegó en respuestas que recomendaban a la competencia. La escalera recuperado → citado → mencionado → recomendado: `citas-vs-recomendaciones`.

## Monitoreo de la visibilidad en IA

Mide presencia en resúmenes de IA, tasa de citas, participación de voz, sentimiento, **tasa de recomendación** y qué páginas se citan. Sin herramientas, cada mes: las 20 consultas principales en ChatGPT, Perplexity y Google. Las respuestas de IA son **no deterministas**: corre cada consulta 3–5 veces por plataforma y sigue la *tasa* con su muestra («citado 3/5, n=5»). Google no tiene informes de IA en Search Console. Una rutina de la oficina puede recordar el chequeo mensual. Herramientas y errores comunes: `monitoreo-y-errores`.

## Qué NO hacer

Perjudica tanto a la búsqueda tradicional como a las funciones de IA: (1) escribir contenido aparte «para IA»; (2) partir las páginas en fragmentos-anzuelo; (3) generar a escala para manipular el ranking; (4) buscar menciones inauténticas: citas fabricadas, premios inventados, sitios de reseñas «independientes» que son tuyos, spam en Reddit o Wikipedia (las reseñas falsas pueden infringir la regla de 2024 de la FTC y las normas de consumo de tu país); (5) tratar todo agente de IA como el mismo control; (6) esconder el contenido tras JavaScript que no se renderiza; (7) saltarse E-E-A-T.

## Cómo entregarlo

Un documento en Markdown: **Resumen** (dónde está la marca y la prioridad n.º 1) · **Diagnóstico** por pilar y la tabla de consultas probadas (con fecha y quién las corrió) · **Acceso y preparación para agentes** · **Plan priorizado** (acción · impacto · esfuerzo · quién · plazo; lo de esta semana aparte de lo grande) · **Textos listos** (archivos propuestos, bloques de respuesta, preguntas frecuentes) marcados `[BORRADOR]` · **Cómo medirlo** (consultas, frecuencia, tasa con muestra) · **Supuestos y datos que faltan**.

## Reglas

- Nunca inventes cifras, citas, reseñas, premios ni lo que responde una plataforma: si no lo verificaste, dilo.
- Los precios y montos salen de las cifras de la empresa, tal cual.
- Toda estadística lleva fuente y fecha; las del estudio o del proveedor se rotulan «orientativa».
- Los cambios en el sitio, en robots.txt o en perfiles públicos los hace una persona con el OK del dueño: tú dejas la propuesta y el texto, y lo dices. Nada se publica, envía ni cambia por tu cuenta.
- Una sola versión del contenido para personas y para IA; nunca contenido aparte para engañar a un buscador.
- Si el pedido es una auditoría de SEO clásico (tráfico caído, rastreo, velocidad), usa `auditoria-seo` y menciona la IA solo como un factor más.

## Referencias

- `factores-por-plataforma` — cómo elige fuentes cada plataforma y robots.txt por propósito. Al planear por plataforma.
- `auditoria-de-visibilidad` — los cuatro pasos con sus tablas. Al auditar.
- `google-y-fan-out` — la postura de Google y el fan-out. Al empezar una cuenta.
- `patrones-de-contenido` — plantillas AEO y GEO y tácticas por sector. Al escribir o reescribir.
- `tipos-de-contenido` — qué optimizar en cada tipo de página, incluido el negocio local. Al elegir qué página tocar.
- `archivos-legibles-por-maquina` — `pricing.md`, `llms.txt`, schema y experiencias de agentes. Al proponer archivos.
- `preparacion-para-agentes` — acceso, descubrimiento, legibilidad, WebMCP y volatilidad de fuentes. Al auditar si el sitio es legible por agentes.
- `volatilidad-de-formatos` — el cambio de la 5.6, formatos por plataforma y rigor de medición. Antes de recomendar comparativas o listas.
- `citas-vs-recomendaciones` — la escalera y el riesgo de las listas autopromocionales. Si el plan es «publicar listas para que nos recomienden».
- `posicionamiento-y-consenso` — reposicionar y perfiles consistentes. Ante un reposicionamiento.
- `linkedin-citas-ia` y `youtube-citas-ia` — LinkedIn y YouTube como superficies de cita. Si están en el plan.
- `formato-abierto-okf` — el paquete OKF. Si preguntan por él.
- `monitoreo-y-errores` — herramientas, monitoreo casero, errores comunes. Al diseñar el seguimiento.

## Habilidades relacionadas

- `auditoria-seo` — SEO clásico. `datos-estructurados` — el marcado. `estrategia-contenido` — qué crear. `paginas-comparativas` — comparativas. `seo-programatico` — páginas a escala. `redaccion-publicitaria` — texto para personas y extraíble.
- `relaciones-publicas`, `directorios`, `comunidad`, `video-marketing`, `redes-sociales` — presencia fuera del sitio.
- `contexto-marketing` — si `00-Empresa/marketing` no existe o está vacía.
