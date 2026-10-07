# Contenido de LinkedIn que la IA cita

LinkedIn es uno de los dominios más citados en consultas profesionales y B2B. Pero qué superficie de LinkedIn se cita depende mucho del motor, y la mezcla se movió con fuerza durante 2026. Trata cada número de aquí como una foto con fecha y revisa tus propias consultas.

## Contenido
- Qué superficie, qué motor
- Quién puede rastrear qué
- Qué hace citable el contenido de LinkedIn
- Durabilidad
- Riesgos
- Lista de revisión
- Fuentes

---

## Qué superficie, qué motor

| Motor | Qué cita de LinkedIn (2026) |
|---|---|
| **ChatGPT** | Pasó de artículos Pulse a publicaciones del feed. Los datos de Ahrefs muestran que las citas de ChatGPT a `/pulse/` bajaron ~86 % y las de `/posts/` subieron ~74 % entre mayo y octubre de 2026, con una caída general de LinkedIn de ~36 % en el cambio de recuperación de mediados de agosto que también golpeó a Reddit |
| **Perplexity** | La mayor cantidad bruta de citas de LinkedIn en la muestra de OtterlyAI y en nuestra extracción de Ahrefs, con las páginas de empresa como mayor parte en Ahrefs. (Semrush, que midió la proporción de respuestas que citan LinkedIn, la halló menor en Perplexity que en ChatGPT o AI Mode, así que el orden depende de la medida) |
| **Copilot** | Cita mucho a LinkedIn y cada vez más (las citas más que se duplicaron de mayo a octubre de 2026, ~6,5 veces las de Reddit). Aparecen Pulse y publicaciones |
| **Google AI Overviews / AI Mode** | Se citan publicaciones y Pulse, además de páginas de empresa |
| **Gemini** | Casi nunca cita LinkedIn (~0 en tres conjuntos de datos distintos). No cuentes con LinkedIn para la visibilidad en Gemini |
| **Claude** | Su rastreador de búsqueda tiene permiso en artículos, publicaciones, perfiles y páginas de empresa; hay pocos datos publicados de citas |

**Qué significa:**
- Publica de las dos formas: publicaciones del feed para ChatGPT, artículos largos para Perplexity, Copilot y las funciones de IA de Google.
- Mantén la página de empresa además de los perfiles de personas. Perplexity cita sobre todo páginas de empresa; ChatGPT y AI Mode, sobre todo miembros individuales.
- Salta los artículos colaborativos (`/advice/`): hoy casi no se citan.

**Nuestra foto de Ahrefs** (citas de direcciones de linkedin.com en los datos de respuestas de IA de Ahrefs, extraídos el 2 de octubre de 2026; el conjunto de consultas cambia con el tiempo, así que es orientativo):

| Ruta | ChatGPT, 1 may | ChatGPT, ahora | Perplexity | AI Overviews | AI Mode | Copilot | Gemini |
|---|---|---|---|---|---|---|---|
| Todo linkedin.com | 239 mil | 185 mil | 787 mil | 352 mil | 292 mil | 154 mil (65 mil en mayo) | ~0,7 mil |
| Artículos `/pulse/` | 22,7 mil | 3,3 mil | 84 mil | 43 mil | 51 mil | 23 mil | ~0 |
| `/posts/` | 17,7 mil | 30,8 mil | 133 mil | 62 mil | 55 mil | 18 mil | 0 |
| `/company/` | — | — | 474 mil | 51 mil | 41 mil | 15 mil | — |
| Perfiles `/in/` | — | — | 103 mil | 12 mil | 13 mil | 15 mil | — |

---

## Quién puede rastrear qué

El robots.txt de LinkedIn (revisado el 2 de octubre de 2026):

| Rastreador | Artículos, publicaciones, perfiles, páginas de empresa |
|---|---|
| Googlebot, Bingbot | Permitido |
| OAI-SearchBot (búsqueda de ChatGPT), Claude-SearchBot | Permitido |
| GPTBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended, CCBot | Bloqueado |

Así que ChatGPT y Claude pueden citar LinkedIn desde sus índices de búsqueda, pero sus agentes en vivo de «ve a leer esta página» no pueden abrirlo. Perplexity cita a LinkedIn más que nadie pese a tener bloqueados sus dos bots, presumiblemente por otro índice.

**Revisa tus propios artículos por `noindex`.** LinkedIn parece poner `noindex` a algunos artículos Pulse, según reportes de cuentas con pocos seguidores o poca interacción, y solo para los rastreadores, así que el autor con sesión iniciada nunca lo ve (una prueba pequeña, n=3). Hay que revisar tanto la etiqueta meta robots como la cabecera `X-Robots-Tag` de la respuesta final, para cada rastreador que te importe. Esto lo hace una persona con acceso a una terminal o a una herramienta de revisión de SEO; tú puedes pasar este recetario:

```bash
URL=https://www.linkedin.com/pulse/slug-de-tu-articulo
for UA in Googlebot bingbot OAI-SearchBot; do
  echo "== $UA"
  curl -sIL -A "$UA" "$URL" | grep -iE '^(HTTP/|x-robots-tag)'
  curl -sL -A "$UA" "$URL" | grep -ioE '<meta[^>]+name="(robots|googlebot|bingbot)"[^>]*>'
done
```

Un `noindex` en cualquiera de los dos lugares para un rastreador significa que el índice de ese motor probablemente no tendrá el artículo. Que no aparezca la etiqueta no prueba que esté indexado; confírmalo con una búsqueda `site:`.

---

## Qué hace citable el contenido de LinkedIn

**Respaldado por datos independientes:**
- **La interacción casi no importa.** Los «me gusta» y comentarios casi no se correlacionan con la cita. La publicación citada mediana tiene 15–25 reacciones; 100 reacciones se citan casi igual que 10.000.
- **El número de seguidores importa poco.** Se cita a autores con menos de 500 seguidores y cerca de la mitad de las citas viene de autores con menos de 10 mil.
- **Original sobre compartido.** Cerca del 95 % de las publicaciones citadas son originales.
- **Enseña algo.** La mayoría de las publicaciones citadas comparten conocimiento o consejos.
- **Constancia.** Cerca del 75 % de los autores citados publicó 5 o más veces en las cuatro semanas previas.
- **Extensión.** Los artículos citados suelen tener 500–2.000 palabras; las publicaciones citadas, 50–300.
- **Recientes.** Cerca de la mitad del contenido citado tiene menos de tres meses.

**Modelo causal de un proveedor (Scrunch, ~4 mil publicaciones, tómalo como orientación):** el detalle técnico (+77 %), las entidades con nombre como herramientas, empresas y personas (+33 %) y un tema de nicho (+18 %) subieron la cita. El texto en negrita o cursiva Unicode (−58 %) y el «enlace en los comentarios» (−31 %) bajaron las citas de la propia publicación. El estudio es sobre ChatGPT y también halló que el enlace en comentarios puede ayudar a que se cite la página enlazada: es un equilibrio si tu meta es que citen tu sitio.

**Informado por la plataforma (guía de LinkedIn, mar 2026):** artículos de 800–1.200 palabras, publicaciones de 200–300 palabras, publicar 2–3 veces por semana. La guía también sugiere que ayudan 3.000+ seguidores y 10+ comentarios, lo que los datos independientes no respaldan.

**Mecánica:**
- Las primeras palabras de una publicación se vuelven su dirección (slug): pon al principio la frase objetivo.
- Estructura los artículos como contenido de blog: títulos claros, respuesta directa pronto, cifras y nombres específicos.

**Cómo se entrega aquí:** las publicaciones de LinkedIn se dejan como borrador en Contenido con `crear_borrador` (red LinkedIn), y el dueño las aprueba. Si una pieza ya lleva su propio texto para LinkedIn, ese texto sale tal cual.

---

## Durabilidad

- Las citas pueden ser duraderas para consultas específicas y poco competidas. Seis artículos Pulse de una redactora B2B se citaron en el 54–86 % de 28 corridas rastreadas durante ~20 semanas para una consulta de nicho (Kaleigh Moore, sep 2026, anécdota).
- A nivel de plataforma son volátiles. Un estudio de consultas fijas midió que la participación de LinkedIn en las respuestas de IA cayó ~65 % de febrero a julio de 2026, mientras otros midieron que subía en Perplexity en los mismos meses. Sigue por motor y no pongas todo tu esfuerzo de terceros en LinkedIn (ver la sección de volatilidad en `preparacion-para-agentes`).

---

## Riesgos

- **Sin control de la dirección canónica.** LinkedIn fija su propia canónica en los artículos, así que republicar entero un artículo de tu blog compite con tu propia página. Publica primero en tu sitio y después una versión adaptada (reescribe una parte considerable) o un resumen que enlace de vuelta.
- **No es tuyo.** LinkedIn decide la indexación, puede poner `noindex` a artículos y cambia los formatos. Por defecto, el contenido de los miembros de EE. UU. puede usarse para entrenar modelos de LinkedIn y Microsoft (revisa lo que aplique en tu país).
- **Punto ciego de Gemini.** La visibilidad construida en LinkedIn no pasa a Gemini.

---

## Lista de revisión

- [ ] Publicaciones del feed y artículos largos en la mezcla, según los motores que te importan
- [ ] Página de empresa completa y coherente con la página «Quiénes somos» (ver `posicionamiento-y-consenso`)
- [ ] Frase objetivo en las primeras palabras de una publicación
- [ ] Contenido original, específico, técnico, con entidades con nombre; sin negrita Unicode; decide con intención dónde va el enlace (en la publicación ayuda a la publicación; en comentarios puede ayudar al destino)
- [ ] Artículos revisados por `noindex` de rastreadores
- [ ] Entradas del blog publicadas primero en tu sitio; la versión de LinkedIn adaptada, no duplicada
- [ ] Citas seguidas por motor, revisadas cada mes

---

## Fuentes

Todas con fecha; la mayoría son estudios de proveedores con sus propios rastreadores, así que ninguna es del todo neutral.

- Profound, LinkedIn como dominio más citado en consultas profesionales (mar 2026): https://www.tryprofound.com/blog/linkedin-is-the-most-cited-domain-for-professional-queries-in-ai-search
- Semrush, estudio de visibilidad de LinkedIn en IA, 325 mil consultas (mar 2026): https://www.semrush.com/blog/linkedin-ai-visibility-study/
- OtterlyAI, estudio de citas de LinkedIn en búsqueda con IA, 1,31 millones de citas (jun 2026): https://otterly.ai/blog/linkedin-ai-search-citations-study/
- Cloro, artículos de LinkedIn frente a publicaciones (ago–sep 2026): https://cloro.dev/blog/linkedin-articles-vs-posts/
- Goodie, estudio de citas de IA en redes sociales (sep 2026): https://higoodie.com/blog/social-media-ai-citations-study-2026/
- Scrunch, publicaciones de LinkedIn y citas de ChatGPT (may 2026): https://scrunch.com/blog/linkedin-posts-robots-cant-resist-what-data-says-about-chatgpt-citations
- Cambio de fuentes de ChatGPT de mediados de agosto de 2026 (Promptwatch, Petra Labs): https://somethinginc.com/blog/chatgpt-citation-sources-docs-replaced-reddit/
- Datos de respuestas de IA de Ahrefs por ruta de dirección, extraídos el 2 de octubre de 2026 (orientativo; el conjunto de consultas cambia con el tiempo)
- robots.txt de LinkedIn, consultado el 2 de octubre de 2026; guía AEO de LinkedIn (mar 2026)
