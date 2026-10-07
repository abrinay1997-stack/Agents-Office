# Auditoría de visibilidad en IA (los cuatro pasos completos)

Antes de optimizar, evalúa la presencia actual. Entrega las tablas llenas, con la fecha y quién corrió cada consulta.

## Paso 1: Revisa las respuestas de IA de las consultas clave

Prueba 10–20 de las consultas más importantes en varias plataformas:

| Consulta | Resumen IA de Google | ChatGPT | Perplexity | ¿Te citan? | ¿Citan a competidores? |
|---|:-:|:-:|:-:|:-:|:-:|
| [consulta 1] | Sí/No | Sí/No | Sí/No | Sí/No | [quién] |
| [consulta 2] | Sí/No | Sí/No | Sí/No | Sí/No | [quién] |

**Tipos de consulta:** «¿Qué es [tu categoría]?» · «Mejor [categoría] para [uso]» · «[Tu marca] vs [competidor]» · «Cómo [problema que resuelves]» · «[Tu categoría] precio». Para negocio local: «[servicio] cerca de mí», «mejor [servicio] en [ciudad]», «¿cuánto cuesta [servicio] en [ciudad]?».

Quédate con las consultas que cambiarían ingresos. Una cita en una pregunta de glosario («qué es la utilidad bruta») rara vez vende algo. Sigue las consultas como palabras clave: reúne las variantes de redacción de una misma intención en una consulta central y corre cada una varias veces.

## Paso 2: Analiza los patrones de cita

Cuando citan a los competidores y a ti no, mira: **estructura** (¿su contenido es más extraíble?), **señales de autoridad** (citas, estadísticas, citas de expertos), **frescura**, **datos estructurados** y **presencia de terceros** (Wikipedia, Reddit, sitios de reseñas).

## Paso 3: Revisión de extraibilidad

Por cada página prioritaria:

| Revisión | Cumple / No |
|---|---|
| ¿Definición clara en el primer párrafo? | |
| ¿Bloques de respuesta autosuficientes (funcionan sin el contexto de alrededor)? | |
| ¿Estadísticas con fuente? | |
| ¿Tablas comparativas para consultas «[X] vs [Y]»? | |
| ¿Sección de preguntas frecuentes con preguntas en lenguaje natural? | |
| ¿Datos estructurados (FAQ, HowTo, Article, Product, LocalBusiness)? | |
| ¿Atribución de experto (nombre del autor, credenciales)? | |
| ¿Actualizada en los últimos 6 meses? | |
| ¿Los títulos siguen el patrón de las consultas? | |
| ¿La política de rastreadores de IA coincide con las metas de descubrimiento y entrenamiento? | |

## Paso 4: Acceso de bots de IA

Audita los agentes de usuario de IA por propósito: **descubrimiento de búsqueda** (`OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot` y los rastreadores de búsqueda convencionales), **consulta pedida por una persona** (`ChatGPT-User`, `Claude-User`, `Perplexity-User`; el trato varía por proveedor), **posible entrenamiento** (`GPTBot`, `ClaudeBot`) y **control de producto de Google** (`Google-Extended`: afecta ciertos usos de Gemini y no la inclusión ni el ranking en Búsqueda). No son intercambiables. Revisa cada grupo y las reglas del WAF o CDN por separado: un editor puede permitir el descubrimiento y rechazar el entrenamiento; bloquear un rastreador de entrenamiento no necesariamente bloquea las citas. Configuración completa de robots.txt en `factores-por-plataforma`.

