# Cómo elige fuentes cada plataforma de IA

Cada buscador con IA tiene su propio índice, su propia lógica de ordenamiento y sus preferencias de contenido. Esta guía dice qué importa en cada uno para que te citen.

Fuentes citadas: estudio GEO de Princeton (KDD 2024), estudio de autoridad de dominio de SE Ranking y análisis de ajuste contenido-respuesta de ZipTie. Trata todas las cifras como fotos con fecha: el sistema cambia rápido.

## Contenido
- Lo básico (vale para todas)
- Google AI Overviews
- ChatGPT
- Perplexity
- Microsoft Copilot
- Claude
- Permitir los bots de IA en robots.txt
- Por dónde empezar

---

## Lo básico (vale para todas)

Toda plataforma de IA exige tres cosas:

1. **Tu contenido tiene que estar en su índice.** Cada plataforma usa un buscador distinto de fondo (Google, Bing, Brave o el propio). Si no estás indexado, no te pueden citar.
2. **Tu contenido tiene que poder rastrearse para el descubrimiento.** Permite la vía de descubrimiento de búsqueda en robots.txt y en el firewall (WAF) de la web; los controles de entrenamiento de modelos son otra cosa.
3. **Tu contenido tiene que poder extraerse.** La IA saca pasajes, no páginas. Ganan la estructura clara y los párrafos que se entienden solos.

Más allá de eso, cada plataforma pesa señales distintas.

---

## Google AI Overviews (resúmenes de IA de Google)

Se alimentan del índice propio de Google y se apoyan mucho en E-E-A-T (Experiencia, Pericia, Autoridad, Confiabilidad). Estudios los midieron en cerca del 45 % de las palabras clave rastreadas (BrightEdge).

**Qué los hace distintos:** ya tienen tus señales de SEO tradicional (enlaces, autoridad de página, relevancia temática). La capa de IA agrega preferencia por contenido con fuentes citadas y datos estructurados. El estudio GEO (Aggarwal et al., 2023) halló que agregar citas, citaciones y estadísticas subió la visibilidad cerca de un 30–40 % en su métrica; los ejemplos sueltos del artículo muestran saltos mucho mayores, pero no son típicos ni se suman.

**No reciclan el top 10 tradicional.** Algunos estudios ponen el solapamiento entre las fuentes de los resúmenes de IA y los resultados orgánicos en apenas ~15 %, aunque las cifras varían mucho según el estudio, la fecha y las consultas. Una página que no entraría en la primera página puede ser citada si da respuestas claras y extraíbles. Aun así, quienes lo practican ven que mejor posición orgánica significa mejor visibilidad en IA: no tomes la cifra de bajo solapamiento como permiso para saltarte el SEO.

**En qué enfocarte:**
- Los datos estructurados (schema) dan contexto (Article, HowTo, Product). Son una palanca entre varias y Google dice que no se requiere ningún marcado especial para sus funciones de IA. Google limitó en 2023 los resultados enriquecidos de FAQ a sitios de gobierno y salud: no prometas un impulso de IA por el marcado FAQPage.
- Construye autoridad temática con grupos de contenido y buenos enlaces internos.
- Incluye citas con nombre y fuente (no solo afirmaciones).
- Las biografías de autor con credenciales reales importan: E-E-A-T pesa mucho.
- Entra al Grafo de Conocimiento de Google donde se pueda (una ficha de Wikipedia exacta ayuda).
- Apunta a consultas tipo «cómo hacer» y «qué es»: son las que más disparan resúmenes de IA.
- Para negocio local: la ficha de Google Business Profile completa y al día alimenta estas respuestas.

**Vigila OKF.** En junio de 2026 Google presentó el [Open Knowledge Format](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing), una especificación en markdown para paquetes de sitio legibles por agentes. No hay señal confirmada de que los AI Overviews lo usen hoy, pero la especificación está publicada. Es una apuesta de «registrarse temprano», como lo fue schema.org hace una década. Detalle en la referencia `formato-abierto-okf`.

---

## ChatGPT

La búsqueda web de ChatGPT usa un índice basado en Bing. Lo combina con su conocimiento de entrenamiento para armar la respuesta y cita las fuentes web en que se apoyó.

**Qué lo hace distinto:** aquí la autoridad de dominio pesa más que en otras plataformas. Un análisis de SE Ranking sobre 129.000 dominios halló que las señales de autoridad y credibilidad explican cerca del 40 % de la probabilidad de cita, la calidad del contenido cerca del 35 % y la confianza de la plataforma el 25 %. Los sitios con muchísimos dominios que enlazan (350.000 o más) promedian 8,4 citas por respuesta; con una confianza algo menor (91–96 frente a 97–100) bajan de 8,4 a 6.

**La frescura marca diferencia.** El contenido actualizado en los últimos 30 días se cita cerca de 3,2 veces más que el viejo.

**La señal más importante es el ajuste contenido-respuesta:** un análisis de ZipTie sobre 400.000 páginas halló que cuánto se parece el estilo y la estructura de tu contenido al formato de respuesta del propio ChatGPT explica cerca del 55 % de la probabilidad de cita; mucho más que la autoridad de dominio (12 %) o la estructura de la página sola (14 %). Escribe como respondería ChatGPT a la pregunta.

**Dónde mira ChatGPT además de tu sitio:** Wikipedia aporta el 7,8 % de todas sus citas, Reddit el 1,8 % y Forbes el 1,1 % (fotos antiguas; ver `volatilidad-de-formatos` y `preparacion-para-agentes`: cambian de un día para otro). Los sitios oficiales de las marcas se citan mucho, pero las menciones de terceros pesan bastante.

**En qué enfocarte:**
- Invierte en enlaces entrantes y autoridad de dominio: es la señal de base más fuerte.
- Actualiza el contenido competitivo al menos una vez al mes.
- Estructura tu contenido como ChatGPT estructura sus respuestas (conversacional, directo, ordenado).
- Incluye estadísticas verificables con fuente con nombre.
- Jerarquía de títulos limpia (H1 > H2 > H3) con títulos descriptivos.

---

## Perplexity

Perplexity siempre cita sus fuentes con enlaces, así que es la plataforma de búsqueda con IA más transparente. Combina su índice con el de Google y pasa los resultados por varias capas de reordenamiento: relevancia inicial, factores de ranking tradicionales y una evaluación de calidad con aprendizaje automático que puede descartar conjuntos enteros de resultados que no pasan el umbral.

**Qué lo hace distinto:** es el más «investigador». Mantiene listas de dominios autoritativos (Amazon, GitHub, sitios académicos importantes) con un impulso de ranking de base. Usa un algoritmo de decaimiento temporal que evalúa rápido el contenido nuevo: quien publica reciente tiene opción real de ser citado.

**Preferencias propias:**
- **Datos estructurados FAQ (JSON-LD):** las páginas con ellos se citan algo más a menudo.
- **Documentos PDF:** los PDF públicos (informes, estudios) tienen prioridad. Si tienes un PDF valioso detrás de un formulario, considera publicar una versión abierta.
- **Ritmo de publicación:** con qué frecuencia publicas pesa más que la palabra clave.
- **Párrafos que se entienden solos:** prefiere párrafos atómicos y completos que pueda extraer limpios.

**En qué enfocarte:**
- Permite a PerplexityBot en robots.txt.
- Implementa FAQPage en las páginas con preguntas y respuestas.
- Publica PDF abiertos (guías, informes).
- Agrega Article con fechas de publicación y modificación.
- Escribe párrafos claros y autosuficientes.
- Construye autoridad temática profunda en tu nicho.

---

## Microsoft Copilot

Copilot vive en el ecosistema de Microsoft (Edge, Windows, Microsoft 365 y Bing). Depende por completo del índice de Bing: si Bing no indexó tu contenido, Copilot no puede citarlo.

**Qué lo hace distinto:** la conexión con Microsoft crea oportunidades propias. Cita mucho a LinkedIn (sus citas de LinkedIn más que se duplicaron de mayo a octubre de 2026 y son cerca de 6,5 veces las de Reddit, según datos de Ahrefs) y GitHub encaja de forma natural. También pesa más la velocidad de la página: menos de 2 segundos es un umbral claro.

**En qué enfocarte:**
- Registra tu sitio en Bing Webmaster Tools (muchos solo lo registran en Google Search Console).
- Usa el protocolo IndexNow para indexar más rápido lo nuevo y lo actualizado.
- Deja la página en menos de 2 segundos.
- Escribe definiciones claras de entidades: cuando tu contenido define un término, hazlo explícito y extraíble.
- Construye presencia en LinkedIn (artículos, publicaciones y página de empresa completa; ver `linkedin-citas-ia`) y en GitHub si aplica.
- Asegúrate de que Bingbot pueda rastrear todo.

---

## Claude

Claude usa Brave Search como buscador cuando la búsqueda web está activa; no Google ni Bing. Es otro índice distinto: tu visibilidad en Brave determina si Claude puede encontrarte y citarte.

**Qué lo hace distinto:** Claude es muy selectivo con lo que cita. Procesa enormes cantidades de contenido, pero cita poco: busca lo más exacto y mejor respaldado de cada tema. El contenido denso en datos, con cifras concretas y atribución clara, rinde mucho mejor que el genérico.

**En qué enfocarte:**
- Verifica que tu contenido aparezca en Brave Search (busca tu marca y términos clave en search.brave.com).
- Decide por separado si permites a `Claude-SearchBot` (descubrimiento), `Claude-User` (consulta pedida por una persona) y `ClaudeBot` (posible entrenamiento).
- Maximiza la densidad de hechos: cifras concretas, fuentes con nombre, estadísticas con fecha.
- Estructura clara y extraíble con títulos descriptivos.
- Cita fuentes autoritativas dentro de tu contenido.
- Apunta a ser la fuente más exacta de tu tema: Claude premia la precisión.
- No te apoyes en listas «las mejores X» donde tú mismo te pones primero. En una prueba en vivo (sep 2026), Claude notó que los resultados de una consulta «mejor [categoría]» estaban dominados por proveedores que se ubicaban a sí mismos en el puesto 1, y se apoyó en premios con jurado y reputación entre profesionales.

---

## Permitir los bots de IA en robots.txt

No copies una lista blanca genérica. Elige los controles según el propósito documentado de cada uno y revisa también las reglas del WAF y del CDN, no solo `robots.txt`. (Esto lo implementa quien administra la web; tu entrega es la recomendación y el texto propuesto.)

```text
# Descubrimiento automático de búsqueda
User-agent: Bingbot
User-agent: Googlebot
User-agent: OAI-SearchBot
User-agent: PerplexityBot
User-agent: Claude-SearchBot
Allow: /

# Posible entrenamiento de modelos (aquí, la decisión del editor es bloquear)
User-agent: GPTBot
User-agent: ClaudeBot
Disallow: /

# Entrenamiento y fundamentación de Gemini (aquí, la decisión del editor es bloquear)
User-agent: Google-Extended
Disallow: /
```

Los lectores activados por una persona (`ChatGPT-User`, `Claude-User`, `Perplexity-User`) son distintos del rastreo automático. Su comportamiento varía: OpenAI dice que las reglas de `robots.txt` pueden no aplicar a `ChatGPT-User`, y Perplexity dice que `Perplexity-User` en general las ignora porque son consultas pedidas por un usuario. Para gestionar la inclusión en ChatGPT Search usa `OAI-SearchBot`, no `ChatGPT-User`. `Google-Extended` es un token de producto, no un rastreador HTTP aparte: según Google controla ciertos usos de entrenamiento y fundamentación de Gemini y no afecta la inclusión ni el ranking en Google Search.

Verifica los nombres y consecuencias vigentes en la documentación que mantienen los proveedores: [OpenAI](https://developers.openai.com/api/docs/bots), [Perplexity](https://docs.perplexity.ai/docs/resources/perplexity-crawlers), [Anthropic](https://privacy.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) y [Google](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers).

Para revisar, lo primero es abrir `/robots.txt` del sitio a mano (cualquiera puede escribir `tusitio.com/robots.txt` en el navegador y pegarte lo que ve).

---

## Por dónde empezar

Si optimizas para IA por primera vez, enfócate donde está tu público:

**Empieza por Google AI Overviews:** llegan a más gente (más del 45 % de las búsquedas de Google) y probablemente ya tienes bases de SEO en Google. Agrega datos estructurados, incluye fuentes citadas y refuerza E-E-A-T.

**Luego ChatGPT:** es la herramienta de búsqueda con IA independiente más usada por públicos de tecnología y negocios. Enfócate en frescura (actualiza cada mes), autoridad de dominio y en igualar la estructura de tu contenido con la de sus respuestas.

**Luego Perplexity:** especialmente valioso si tu público incluye investigadores, adoptadores tempranos o profesionales de tecnología. Agrega FAQ, publica PDF y escribe párrafos autosuficientes.

**Copilot y Claude son menos prioritarios** salvo que tu público sea empresarial/Microsoft (Copilot) o de desarrolladores y analistas (Claude). Pero lo básico (contenido estructurado, fuentes citadas, datos estructurados) ayuda en todas.

**Lo que ayuda en todas partes:**
1. Fija una política de robots explícita y por propósito: permite los rastreadores de descubrimiento relevantes y decide aparte entrenamiento y consulta por usuario.
2. Implementa datos estructurados (FAQPage, Article y Organization como mínimo; para un negocio local, LocalBusiness).
3. Incluye estadísticas con fuente con nombre.
4. Actualiza el contenido con regularidad: cada mes en temas competitivos.
5. Usa una estructura de títulos clara (H1 > H2 > H3).
6. Mantén la carga por debajo de 2 segundos.
7. Agrega biografías de autor con credenciales.
