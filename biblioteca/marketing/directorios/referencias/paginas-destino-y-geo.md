# Páginas de destino, optimización para motores de IA (GEO), comunidad y medición

El detalle de lo que sostiene a los directorios: las páginas a las que apuntan los enlaces, cómo lograr que las IA te citen, la distribución continua en comunidades y los indicadores. Léelo cuando haya que decidir *qué construir antes de enviar* y cómo medir si los directorios están sirviendo.

---

## Estrategia de páginas de destino (adonde apuntan los enlaces)

Los directorios no sirven de nada si los enlaces caen en una portada genérica. Construye estas páginas *antes* de enviar nada (pasa los detalles de construcción a `paginas-comparativas` y `seo-programatico`):

### 1. Páginas de alternativas (el mayor retorno)

Las páginas de alternativa a un competidor convierten entre **5 % y 15 %** y, para búsquedas de fondo de embudo, a menudo entre 15 % y 30 % (cifras del original, sin fuente pública: úsalas como orientación y no las prometas). Una página por cada competidor principal:

- `/alternativas/[competidor-1]`
- `/alternativas/[competidor-2]`
- `/alternativas/[competidor-3]`
- `/alternativas/[competidor-4]`

Cada página necesita: una tabla de comparación honesta de funciones, «cuándo elegir a X en lugar de nosotros», «cuándo elegirnos a nosotros en lugar de X», comparación de precios, de 3 a 5 ejemplos de casos de uso y unas preguntas frecuentes sólidas con marcado estructurado.

**Crítico:** sé honesto. Las IA cruzan las afirmaciones sobre las funciones de los competidores y bajan de posición a las páginas que mienten.

### 2. Páginas por caso de uso o por público

Cada tipo de cliente ideal tiene su propia página de aterrizaje:
- `/para/[público]`: entrenadores, agencias, comercio electrónico, consultores, clínicas, restaurantes, etc.
- `/casos-de-uso/[caso]`: calificación de prospectos, incorporación, recomendación de productos, reservas, etc.

### 3. Galería de plantillas o de recursos (si aplica)

La biblioteca de plantillas de Typeform generó **30.000 registros orgánicos sin marca y US$3 millones al año de valor de vida del cliente** (cifra que cita el original). El patrón:
- Una página indexable por plantilla en `/plantillas/[nombre]`.
- Un H1 con la palabra clave, una descripción de más de 150 palabras, una captura, «cuándo usar esta plantilla» y un botón «usar esta plantilla».
- Plantillas relacionadas al final de cada página (los enlaces internos hacen que el SEO se acumule).
- Meta realista: 100 plantillas al día 30 y 300 al día 90.
Para un negocio de servicios, el equivalente son guías, listas de verificación, calculadoras o plantillas descargables (`herramientas-gratis`, `imanes-de-prospectos`).

### 4. Listados «lo mejor de…» que escribes tú mismo

Escribe resúmenes honestos de tu propia categoría: `/blog/mejores-herramientas-de-[categoría]-2026`. Inclúyete a ti y a 10 competidores con reseñas reales. Posicionan para búsquedas de la categoría *y* sirven de referencia canónica que citan las IA.

### 5. Páginas de integraciones (cuando salgan las integraciones)

Cada integración = una página de aterrizaje en `/integraciones/[socio]`. Sigue el manual de Zapier: Zapier recibe **~2,6 millones de visitas orgánicas al mes** de sus páginas de integración generadas de forma programática (~15 % de su tráfico orgánico total, según el original).

### Para un negocio local o de servicios

Las «páginas de destino» son otras: una página por servicio principal (`/servicios/[servicio]`), una por zona atendida si hay varias, una página de contacto y reservas con dirección, mapa, horario y teléfono, preguntas frecuentes reales, y fotos y reseñas de clientes con su permiso.

---

## GEO: optimización para motores generativos

En 2026, entre el 30 % y el 50 % de las consultas del tipo «investigar una herramienta» ocurren dentro de ChatGPT, Claude, Perplexity o las Vistas Generales con IA de Google, sin tocar jamás una página de resultados tradicional (estimación del original, sin fuente pública). Los directorios también cuentan aquí: las IA toman mucho de los directorios de DR alto al generar respuestas. Pero las *páginas de destino* también deben estar optimizadas para GEO (el trabajo de fondo está en `seo-para-ia`).

### Tácticas que logran que te citen

1. **Un H1 por página y una jerarquía de títulos secuencial.** Tasa de citación 2,8 veces mayor; el 87 % de las páginas citadas usa un solo H1 (cifras del original).
2. **Contenido denso y factual con datos citables.** Las IA prefieren cifras concretas («3 veces más rápido que X») a afirmaciones vagas. Solo cifras reales y comprobables.
3. **Marcado de preguntas frecuentes (FAQ) en cada página de aterrizaje.** Las IA pesan mucho el JSON-LD `FAQPage` para extraer respuestas (`datos-estructurados`).
4. **Tablas de comparación.** Extraíbles y estructuradas: justo lo que necesita una respuesta de IA.
5. **Un párrafo explícito de «qué es» en las primeras 100 palabras.**
6. **Que te citen en Reddit y Hacker News.** Claude y Perplexity los indexan mucho. Las menciones genuinas en r/SaaS y HN cuentan como combustible de entrenamiento.
7. **Publica investigación original.** «Analizamos 10.000 [cosas] y encontramos X» se vuelve la cita principal de quien escriba sobre ese tema.
8. **Reclama las fichas de Crunchbase, la página de empresa de LinkedIn y Wikidata.** Los tres alimentan los corpus de entrenamiento de las IA.
9. **Si aplica, lístate donde miran los agentes.** El registro oficial de MCP y los directorios de MCP con buenas calificaciones (Glama en particular), el directorio de plugins de Claude para plugins y conectores, y los directorios de llms.txt cuando tu `/llms.txt` ya esté publicado. Los modelos extraen de ahí al responder sobre herramientas.
10. **Para un negocio local:** la ficha de Google Business Profile completa, con reseñas y respuestas, y datos de contacto idénticos en todo internet (NAP) es lo que más pesa cuando alguien le pregunta a una IA «¿dónde puedo…cerca de [zona]?».

### Medición

Comprueba a mano una vez al mes: pregúntale a ChatGPT, Claude y Perplexity «¿cuáles son las mejores herramientas de [categoría]?» (o «¿cuál es el mejor [tipo de negocio] en [zona]?») y anota dónde aparece el producto. Hay herramientas gratuitas de seguimiento de GEO (GeoTracker, llmrefs) que lo automatizan, si la empresa quiere usarlas.

---

## Comunidad y distribución continua

Los directorios son un esfuerzo puntual; la comunidad es continua. Los dos alimentan el mismo embudo. La participación la hace una persona real del equipo (nunca la oficina por su cuenta); tú preparas ideas y borradores y el calendario con `crear_borrador` de Contenido cuando es una publicación propia.

### Reddit (regla 90/10)

El 90 % de la actividad debe ser genuinamente útil y solo el 10 % promocional. Violarlo lleva a que te silencien la cuenta.

**Subreddits de más valor (en orden):**
- **r/SideProject** (más de 200 mil): amigable con la promoción, se aceptan anuncios de lanzamiento.
- **r/SaaS** (más de 300 mil): los hilos «Share Your SaaS» son ventanas promocionales explícitas.
- **r/startups** (1,7 M): el hilo del Feedback Friday.
- **r/Entrepreneur** (3,5 M): hilo promocional semanal.
- **r/nocode**, **r/IndieHackers**, **r/alphaandbetausers**: amigables.
- **r/webdev**, **r/artificial**, **r/LocalLLaMA**: estrictos, solo técnico.

(Tamaños de comunidad según el original; cambian.) Para negocios que no son de software, busca los subreddits y los grupos de tu rubro y de tu ciudad, y lee sus reglas antes de escribir.

**Lo que gana:** cifras reales (ingresos mensuales, registros, cancelaciones), capturas, estructura «qué probé / qué pasó / qué haría distinto», mini casos con una lección clara. **Lo que falla:** exageración, afirmaciones vagas, publicaciones de «miren mi herramienta nueva», pedir votos.

### LinkedIn (canal principal de B2B)

El 80 % de los prospectos B2B de redes sociales viene de LinkedIn (cifra del original). Frecuencia: **3 a 5 publicaciones por semana**; menos pierde impulso, más cansa.

Tipos de contenido según su interacción en 2026, de mayor a menor:
1. Historias personales con lecciones de negocio (1,5 a 2 veces el promedio de interacción)
2. Datos o investigación originales (1,3 a 1,5 veces)
3. Opiniones contrarias sobre el sector (1,2 a 1,5 veces)
4. Carruseles de documentos de 8 a 12 diapositivas (1,3 a 1,8 veces)

### Twitter/X (canal de creadores independientes y de desarrollo)

Hilos de construir en público sobre arquitectura, ingresos y decisiones. Las inmersiones técnicas las indexan Google, Claude y Perplexity → GEO indirecto.

### Indie Hackers

- Abre un hilo de construir en público el día del lanzamiento en Product Hunt.
- Publica actualizaciones semanales: ingresos, entregas, lecciones. Las publicaciones con cero ingresos funcionan si la lección es honesta.
- Comenta 10 veces más de lo que publicas para ganar reputación antes de poner tus enlaces.

### Dev.to y Hashnode

Cada artículo técnico sustancial = un enlace dofollow y alcance entre desarrolladores. Vuelve a publicar con la URL canónica hacia el blog principal.

---

## Indicadores y seguimiento

Revísalos cada semana. Si un número no se mueve, investiga: no envíes más directorios por reflejo.

| Métrica | Día 0 | Meta al día 30 | Meta al día 90 |
|---|---|---|---|
| Domain Rating (DR) | 0 | 20 | 30+ |
| Dominios de referencia | 0 | 30 | 80+ |
| Páginas indexadas | — | 50 | 200+ |
| Clics orgánicos por día | 0 | 30 | 200+ |
| Fichas en directorios activas | 0 | 50 | 70+ |
| Reseñas en G2 | 0 | 10 | 25 |
| Reseñas en Capterra | 0 | 5 | 15 |
| Citas en IA (comprobación manual) | 0 | 3 | 15+ |
| Registros desde referencias de directorios | 0 | 50 | 300 |
| Registros desde páginas de alternativas y casos de uso | 0 | 20 | 300 |

Las metas son del original, para un producto de software que parte de cero; **no las prometas como resultado**: sirven para calibrar. Un caso autodeclarado de 2026, a modo de calibración: un servidor MCP más un micro SaaS enviados a ~35 directorios (registros de MCP, listas de GitHub, sitios de lanzamiento independientes) pasaron de DR 4 a 26 en unos 40 días y de 8 a 33 dominios de referencia en unas 3 semanas. Es una sola anécdota, pero sugiere que las metas del día 30 son alcanzables con una campaña enfocada.

**Para un negocio local**, cambia la tabla por: fichas completas y consistentes (cuántas de las del nivel 14), reseñas nuevas al mes y calificación promedio, llamadas, mensajes y solicitudes de ruta que reporta Google Business Profile (si el dueño tiene acceso y te pasa las cifras), y clientes nuevos que dicen «te encontré en Google» (ver `atribucion`). Las metas las fija el dueño según su situación; no inventes cifras objetivo.
