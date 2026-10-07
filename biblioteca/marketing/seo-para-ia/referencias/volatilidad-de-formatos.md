# Volatilidad de formatos: qué formatos cita la IA (y qué tan rápido cambia)

La volatilidad de las *fuentes* de citas (Reddit borrado de un día para otro, Gemini favoreciendo sitios propios) está en `preparacion-para-agentes`. Esta referencia cubre el segundo eje de volatilidad: el *formato* de las citas, es decir, qué tipos de página recuperan y citan los motores de IA, y la evidencia de agosto de 2026 de que los formatos muy explotados se degradan.

Léela antes de recomendar páginas comparativas, listas o contenido «los mejores X» para visibilidad en IA. El consejo cambió de forma importante con ChatGPT 5.6.

## El cambio de formatos de ChatGPT 5.6 (agosto de 2026)

Datos de Peec AI (compartidos por Tomek Rudzki vía Lily Ray, ago 2026), que comparan el comportamiento de recuperación de ChatGPT antes y después del lanzamiento de la 5.6:

**Consultas de «fan-out»** (las búsquedas de fondo que ChatGPT lanza): los modificadores que más cayeron como parte de ellas:

- «vs»
- «comparación»
- «top»
- «mejor»
- «reseñas»

Al mismo tiempo: un aumento de las búsquedas `site:` y de modificadores como **«oficial»**.

**Citas por tipo de página** (porcentaje del total de citas de ChatGPT):

| Tipo de página | Antes de la 5.6 | Después de la 5.6 | Cambio |
|---|---:|---:|---:|
| Listas («Top 10 X», «8 mejores Y») | 15,77 % | 7,80 % | **−50,5 %** |
| Páginas comparativas («X vs Y», alternativas) | 9,08 % | 6,17 % | **−32,1 %** |

La interpretación (de Lily Ray, y encaja con los datos de fan-out): son justo los dos formatos que las empresas escalaron para GEO en los 18 meses previos, y ChatGPT ajustó su recuperación para mitigar el spam. El aumento de `site:` y «oficial» apunta igual: **hacia fuentes primarias y dominios propios, lejos de los formatos de agregadores.**

## Qué cambia (y qué no)

**NO significa «dejar de hacer páginas comparativas».** El contenido comparativo y de «los mejores» sigue:

- Convirtiendo a compradores humanos (su trabajo original).
- Siendo citado por los AI Overviews de Google (que siguen los rankings centrales, no la recuperación de ChatGPT).
- Alimentando a Gemini y Perplexity, que no han mostrado la misma degradación.
- Respondiendo consultas reales de mitad de embudo en tu propio sitio.

**SÍ significa:**

1. **Deja de justificar la producción en masa de listas y comparativas con «gana citas de IA».** En ChatGPT, la mayor superficie de respuestas de IA, esa razón perdió la mitad de su fuerza en una sola versión.
2. **El giro hacia lo «oficial»/fuente primaria favorece tus páginas propias.** Páginas de producto o servicio, documentación, precios, investigación original: las páginas que solo tú puedes publicar suben como clase citable. Se suma al hallazgo de Gemini (los sitios de las empresas ≈ 60 % de las citas).
3. **La estrategia de formatos ahora es por plataforma.** Mira qué motores importan en tu categoría antes de elegir formatos:

| Formato | ChatGPT (post-5.6) | Google AIO | Gemini | Perplexity |
|---|---|---|---|---|
| Listas / «los mejores» | Degradado | Depende del ranking | Bien | Bien |
| Comparativas / páginas «vs» | Degradado | Depende del ranking | Bien | Bien |
| Investigación original + datos | Fuerte | Fuerte | Fuerte | Fuerte |
| Producto/documentación/precios (propios, «oficiales») | **Subiendo** | Fuerte | **Dominante** | Fuerte |
| Cómo hacer / guías | Estable | Fuerte | Bien | Fuerte |

*(Advertencia de la tabla: la degradación se midió solo en ChatGPT. «Bien» en Gemini/Perplexity significa que no se ha reportado degradación, no que se haya medido la estabilidad. Cualquier motor puede lanzar su propio cambio tipo 5.6.)*

4. **Trata cada número de arriba como una foto con fecha.** La misma doctrina que con la volatilidad de fuentes: son mediciones de agosto de 2026 de un sistema que se mueve. Verifica con tu propio seguimiento de citas antes de apostar presupuesto.

## LinkedIn como superficie de citas

LinkedIn es de los dominios más citados en consultas profesionales, pero la mezcla de superficies cambió en 2026 y difiere por motor: ChatGPT pasó de artículos Pulse a publicaciones del feed, Perplexity y Copilot siguen citando artículos y páginas de empresa, y Gemini casi no cita LinkedIn. Las primeras palabras de una publicación siguen convirtiéndose en su dirección (slug), así que pon al principio la frase objetivo.

Corrección: la guía de LinkedIn no dice que los artículos reciban ~60 % de las citas frente a ~40 % de las publicaciones. Dice que artículos, boletines y publicaciones *juntos* suman el 60 %. Reparticiones de terceros ponen los artículos por delante en general (aprox. 60–70 % contra 25–35 %), pero ya no en ChatGPT.

Desglose completo por motor, acceso de rastreadores, autorrevisión de `noindex` y qué hace citables las publicaciones: `linkedin-citas-ia`.

## Diagnóstico casero: extraer las búsquedas de fondo reales de ChatGPT

No necesitas una herramienta para ver qué busca realmente ChatGPT en tu nicho (método que circuló públicamente en ago 2026). Lo hace una persona con acceso al navegador; tú le dictas los pasos y analizas lo que pegue:

1. Lanzar en ChatGPT (con búsqueda) una consulta importante de tu categoría.
2. Abrir las herramientas de desarrollador (DevTools) → pestaña Network (Red) y recargar la conversación (el identificador de la dirección tras `/c/`).
3. Encontrar la respuesta de datos de la conversación y buscar en ella `queries`.
4. Se verán las búsquedas de fondo literales a las que ChatGPT se ramificó.

**Úsalo para:** armar tu lista de consultas de prueba con el comportamiento real del fan-out en vez de adivinar; comprobar si los fan-outs de tu categoría aún usan modificadores «mejor/vs» o pasaron a patrones `site:`/«oficial»; encontrar subtemas que tu contenido no cubre.

**Luego trabaja hacia atrás desde los dominios.** Si el fan-out lanza búsquedas `site:` en fuentes de terceros (Gartner, G2, Capterra, o directorios del sector) para tu categoría, esos perfiles son tu lista de prioridades, a menudo por delante de nuevas páginas en tu propio sitio. Ver `posicionamiento-y-consenso`.

**No lo uses para:** generar y publicar en masa un artículo por cada consulta del fan-out. Es exactamente el patrón de contenido a escala que degradó la 5.6 (y que nombra la política de contenido a escala de Google). El diagnóstico es para planificar cobertura, no para hacer spam de contenido.

## Rigor de medición: las respuestas de IA no son deterministas

Una sola respuesta de ChatGPT es una anécdota, no una medición: la misma consulta devuelve fuentes distintas de una vez a otra. (El enfoque de rigor estadístico lo popularizó la habilidad de auditoría AEO de Initial Commit, Josh Pigford, ago 2026; la práctica se sostiene sola.)

Al auditar o monitorear:

- **Sigue las consultas como palabras clave.** «Busco el mejor X», «cuál es el mejor X» y «encuéntrame el mejor X» suelen devolver las mismas marcas. Reúne las variantes de redacción en una consulta central por intención y gasta el presupuesto en repeticiones.
- **Corre cada consulta de 3 a 5 veces por plataforma**, con sesión nueva cada vez.
- **Sigue la *tasa* de menciones/citas** («citado en 3 de 5 corridas»), nunca un sí/no de una sola corrida.
- **Reporta el tamaño de la muestra** con cada número («40 % de menciones, n=5») para que quien lo lea después sepa cuánto confiar.
- **Compara tasas en el tiempo, no corridas.** Bajar de 4/5 a 3/5 es ruido; bajar de 4/5 a 0/5 sostenido durante un mes es señal.
- Antes de diagnosticar *por qué* no te citan, separa las causas como lo haría una auditoría: **técnica** (no se puede rastrear ni leer; ver `preparacion-para-agentes`), **comprensión** (la IA te describe de forma inexacta o vaga) o **confianza** (te entiende pero no te elige; ver `citas-vs-recomendaciones`).

---

*Fuentes, todas con etiqueta y fecha: datos de citas de Peec AI antes y después de la 5.6 vía Tomek Rudzki y Lily Ray (ago 2026); cifras de la guía AEO de LinkedIn vía Chris Long (sep 2026, informadas por la plataforma); método de extracción del fan-out tal como circuló públicamente (ago 2026); enfoque de rigor de medición atribuido a la habilidad de auditoría AEO de Initial Commit (Josh Pigford, ago 2026). Son fotos de un sistema volátil: verifica con tu propio seguimiento.*
