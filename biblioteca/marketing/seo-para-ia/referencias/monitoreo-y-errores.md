# Monitoreo de la visibilidad en IA y errores comunes

## Qué seguir

| Métrica | Qué mide | Cómo verla |
|---|---|---|
| Presencia en resúmenes de IA | ¿Aparecen resúmenes de IA para tus consultas? | Revisión manual o Semrush/Ahrefs |
| Tasa de citas de la marca | Cuántas veces te citan en respuestas de IA | Herramientas de visibilidad en IA (abajo) |
| Participación de voz en IA | Tus citas frente a las de la competencia | Peec AI, Otterly, ZipTie |
| Sentimiento de las citas | Cómo describe la IA a tu marca | Revisión manual + herramientas de monitoreo |
| Tasa de recomendación | Si estás en la lista corta, no solo citado (ver `citas-vs-recomendaciones`) | Seguimiento de consultas + el encuadre de la mención |
| Atribución de fuente | Qué páginas tuyas se citan | Tráfico de referencia de fuentes de IA |

## Herramientas de monitoreo de visibilidad en IA (opciones, ninguna obligatoria)

| Herramienta | Cobertura | Ideal para |
|---|---|---|
| **Otterly AI** | ChatGPT, Perplexity, Google AI Overviews | Seguir la participación de voz en IA |
| **Peec AI** | ChatGPT, Gemini, Perplexity, Claude, Copilot y más | Monitoreo multiplataforma a escala |
| **ZipTie** | Google AI Overviews, ChatGPT, Perplexity | Menciones de marca y sentimiento |
| **LLMrefs** | ChatGPT, Perplexity, AI Overviews, Gemini | Traducir palabras clave a visibilidad en IA |

Si la empresa tiene conectadas herramientas de SEO o analítica (Semrush, Ahrefs, Search Console, GA4), úsalas: presencia de resúmenes de IA, análisis de brechas de contenido, rendimiento y consultas, y tráfico de referencia desde fuentes de IA. No des por hecho que están conectadas.

## Monitoreo casero (sin herramientas)

Revisión manual mensual:
1. Elige tus 20 consultas principales.
2. Córrelas en ChatGPT, Perplexity y Google.
3. Anota: ¿te citan?, ¿a quién citan?, ¿qué página?
4. Llévalo en una hoja de cálculo y sigue la evolución mes a mes.

Tú no puedes abrir esas plataformas por tu cuenta: pídele a una persona que las corra (o usa la búsqueda web de la oficina si está encendida, sabiendo que no es lo mismo) y te pegue los resultados. Las respuestas de IA son **no deterministas**: una corrida es una anécdota, no una medición. Corre cada consulta 3–5 veces por plataforma y sigue la *tasa* de menciones con su tamaño de muestra («citado 3/5, n=5»), comparando tasas en el tiempo y no corridas sueltas. La lista completa de rigor está en `volatilidad-de-formatos`.

Esto se presta a una **rutina** de la oficina: cada mes, una tarea para Marketing que prepare la hoja de seguimiento y compare con el mes anterior (con el OK del dueño si hay que cambiar algo).

## Expectativas con Search Console

La guía de Google es explícita: **no hay informes de Search Console específicos de IA.** Los AI Overviews y AI Mode usan el ranking central, así que los informes estándar de Search Console (Rendimiento, Cobertura, Core Web Vitals) siguen siendo con lo que mides en Google. Las herramientas de terceros de arriba son la única forma de ver el comportamiento de citas entre plataformas.

---

## Errores comunes

- **Ignorar por completo la búsqueda con IA:** cerca del 45 % de las búsquedas de Google muestran resúmenes de IA, y ChatGPT y Perplexity crecen rápido.
- **Tratar el SEO para IA como algo aparte del SEO:** el buen SEO tradicional es la base; el SEO para IA agrega estructura y autoridad encima.
- **Escribir para la IA y no para las personas:** si el contenido parece hecho para engañar a un algoritmo, no se citará ni convertirá.
- **Sin señales de frescura:** el contenido sin fecha pierde frente al fechado, porque los sistemas de IA pesan mucho lo reciente. Muestra cuándo se actualizó.
- **Encerrar todo el contenido:** la IA no puede acceder al contenido cerrado. Deja abierto lo más autoritativo.
- **Ignorar la presencia de terceros:** puedes obtener más citas de IA por una mención en Wikipedia que por tu propio blog.
- **Sin datos estructurados:** el marcado da a los sistemas de IA contexto estructurado sobre tu contenido.
- **Relleno de palabras clave:** a diferencia del SEO tradicional, donde solo es ineficaz, reduce la visibilidad en IA un 10 % (estudio GEO de Princeton).
- **Esconder precios tras «contacta a ventas» o páginas con JavaScript:** los agentes que evalúan tu producto en nombre de compradores no pueden analizar lo que no leen. Agrega un archivo `/pricing.md`.
- **Bloquear rastreadores de descubrimiento sin revisar su propósito:** restringir `OAI-SearchBot`, `PerplexityBot` o `Claude-SearchBot` puede reducir la visibilidad en búsqueda; los controles de entrenamiento son aparte.
- **Contenido genérico sin datos:** «somos los mejores» no se cita. «Nuestros clientes ven 3 veces la mejora en [métrica]» (si es cierto y hay prueba) sí.
- **Olvidar monitorear:** no se mejora lo que no se mide. Revisa la visibilidad en IA al menos cada mes.

## Preguntas específicas de la tarea

1. ¿Cuáles son tus 10–20 consultas más importantes?
2. ¿Has revisado si hoy existen respuestas de IA para esas consultas?
3. ¿Tienes datos estructurados (schema) en tu sitio?
4. ¿Qué tipos de contenido publicas (blog, documentación, comparativas, etc.)?
5. ¿Los competidores aparecen citados por la IA donde tú no?
6. ¿Tienes página de Wikipedia o presencia en sitios de reseñas?
