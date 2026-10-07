# Preparación para agentes: ¿puede un agente llegar, navegar y entender tu sitio?

El trabajo de visibilidad en IA tiene dos capas: lo que dice tu contenido (el resto de esta habilidad) y si un agente puede *llegar* a él siquiera. Esta referencia cubre la segunda capa (la auditoría de acceso, descubrimiento y legibilidad) y el paso de sitios «legibles por agentes» a sitios «accionables por agentes».

En agosto de 2026 salieron dos herramientas gratuitas de puntaje que volvieron esto una disciplina medible:

| Herramienta | Cómo se usa | Método |
|---|---|---|
| **Is Agentic** (Vercel + Ora) | Se corre sobre el dominio desde la terminal (`npx is-agentic tudominio.com`) o en is-agentic.com | Más de 100 revisiones; las Esenciales pesan casi todo el puntaje; las Recomendadas solo se activan si hay evidencia de esa superficie (API, servidor MCP, comercio); las que no aplican se excluyen, no se reprueban; incluye un recorrido observado de un agente real que muestra dónde se atoró |
| **Frase Agent Readiness Checker** | frase.io/tools/agent-readiness | Tríada Acceso / Descubrimiento / Legibilidad; 80+ = los agentes pueden usar el sitio con fiabilidad, 60–79 = sólido con huecos, menos de 60 = problemas reales de acceso |

Tú no corres comandos: recomienda la herramienta, pídele a quien administra la web (o al dueño, en el navegador, con la de Frase) que la use y te pegue el resultado. Corre una antes y otra después de cualquier trabajo de preparación para agentes: el puntaje es un entregable compartible y las revisiones fallidas son tu lista de trabajo. (Ambas son herramientas de proveedores con un producto detrás; lo valioso son las *revisiones*, no el discurso comercial.)

## Las tres preguntas

### 1. Acceso: ¿puede un agente llegar a la página y ver contenido real?

- **El contenido principal, en la respuesta HTML inicial.** La mayoría de los agentes nunca ejecutan JavaScript. Si el contenido solo existe después de que el navegador lo arma, no existe. Es la revisión esencial n.º 1 en ambas herramientas.
- **Sin desafío de bots ni bloqueo del firewall** en la vía de descubrimiento prevista. Bloquear `OAI-SearchBot`, `PerplexityBot` o `Claude-SearchBot` puede reducir la visibilidad en búsqueda. Bloquear rastreadores de desarrollo de modelos como `GPTBot` o `ClaudeBot` puede ser una decisión deliberada de no participar en entrenamiento y no es, por sí solo, un fallo de visibilidad. Audita qué hace de verdad tu CDN o WAF con cada agente de usuario: muchos sitios los bloquean por defecto sin que nadie lo haya decidido.
- **Comportamiento HTTP correcto:** códigos de estado reales (sin falsos 404), direcciones canónicas estables, errores recuperables.

### 2. Descubrimiento: ¿tus archivos dicen a los agentes qué hay aquí?

- **robots.txt con una postura explícita sobre rastreadores de IA:** nombra los agentes de usuario relevantes y declara una política por propósito, en vez de dejarla a la suposición (ver la guía de acceso de bots en la habilidad y `factores-por-plataforma`).
- **Un sitemap que carga y se lee limpio.**
- **llms.txt en la raíz del dominio** (ver «Archivos legibles por máquina» en la habilidad).
- **`llms-full.txt`:** la compañera más nueva: todo el contenido del sitio en un solo archivo, para que el agente lo obtenga todo en una petición en vez de rastrear. Emergente, barato de generar junto con llms.txt y puntuado como señal extra por las dos herramientas.
- **Declaraciones de uso de contenido en robots.txt:** una convención emergente para declarar qué puede hacer la IA con tu contenido (entrenar, citar, resumir), para que la respuesta venga de ti y no de suposiciones.

### 3. Legibilidad: una vez allí, ¿puede el agente saber qué es la página?

- **Datos estructurados válidos y sustanciosos** (JSON-LD; ver la habilidad `datos-estructurados`).
- **Una representación en Markdown de la página.** Es la técnica más nueva de la pila, con dos implementaciones:
  - **Negociación de contenido:** servir Markdown compacto en la *misma dirección canónica* cuando la petición pide `Accept: text/markdown`, con una cabecera `Vary` que mantiene separadas las copias en caché de HTML y Markdown. (Así sirve Is Agentic sus propios informes: los agentes reciben Markdown, los navegadores HTML, una sola dirección.)
  - **Cabecera Link:** una cabecera HTTP `Link` en la página HTML que apunta a una versión paralela en Markdown, descubrible sin adivinar direcciones.
- **Estructura clara del documento:** un solo H1, títulos que responden subpreguntas, bloques de respuesta extraíbles (ver `patrones-de-contenido`).

## Emergente: accionable por agentes, no solo legible

Leer se está volviendo lo mínimo. La siguiente carrera es si un agente puede *actuar* en tu sitio: llenar el formulario, reservar la reunión, empezar la prueba. **WebMCP** es el estándar emergente: una página declara sus formularios y botones de acción como herramientas invocables con esquemas de entrada, para que el agente no tenga que descifrar tu interfaz. Es temprano (etiqueta: emergente, todavía no es señal de ranking ni de cita), pero la dirección es clara: si los agentes se vuelven compradores, gana el sitio que expone «empezar prueba» (o «reservar cita», «pedir cotización») como una acción estructurada, y pierde la conversión mediada por agentes quien solo tiene un botón bonito.

Práctico hoy: asegúrate de que tus acciones de mayor intención (registro, precios, reservar demo o cita, contacto) funcionen sin flujos que dependan solo de JavaScript, tengan campos de formulario con etiquetas semánticas y devuelvan una confirmación legible por máquina.

## Volatilidad de las fuentes de citas (por qué diversificar)

Las mezclas de citas de terceros **no son estables**: cambian de un día para otro con las actualizaciones de modelos y de recuperación. Agosto de 2026 fue el caso de estudio: **los cambios de ChatGPT en su búsqueda ampliada («fan-out») casi borraron a Reddit como fuente de citas** en pocos días (informado por profesionales de varios equipos de AEO; uno ganaba citas de Reddit en 24 horas con más de un millón de impresiones al mes antes del cambio). Mientras tanto, los mismos profesionales dicen que **los sitios propios de las empresas dominan las citas de Gemini (~60 %)**.

LinkedIn se movió en la misma actualización: las citas de ChatGPT a LinkedIn cayeron ~36 % a mediados de agosto de 2026 y sus citas a artículos Pulse cayeron ~86 % de mayo a octubre mientras subían las de publicaciones del feed. Perplexity y Copilot se movieron al revés. Ver `linkedin-citas-ia`.

Qué significa para la estrategia:

- **Nunca concentres el trabajo de visibilidad en IA en una sola superficie de terceros.** La lista del pilar Presencia (Wikipedia, Reddit, YouTube, pódcast, sitios de reseñas, Quora) es un portafolio, no un menú para elegir uno. Una superficie que hoy es el 2 % de las citas puede ser el 0 % tras una actualización de recuperación, o al revés.
- **Los fundamentos del sitio propio cubren la volatilidad.** Los acuerdos entre plataformas y los cambios de recuperación reordenan las fuentes de terceros; tu sitio legible por agentes es la única superficie de la que ninguna plataforma puede sacarte, y en Gemini ya es la clase de cita dominante.
- **Trata toda estadística de participación de citas como con fecha.** Las del tipo «Reddit = 1,8 % de las citas de ChatGPT» (incluidas las de esta habilidad) son fotos: mira la fecha y verifica con tu propio seguimiento de citas (el ciclo de monitoreo manual de la habilidad) antes de apostar presupuesto.
- **La velocidad es real:** el contenido fresco en superficies que se recuperan puede citarse en ~24 horas. La búsqueda con IA premia la frescura más rápido que el SEO clásico.

---

*La taxonomía de revisiones de preparación para agentes está destilada de Is Agentic de Vercel/Ora (is-agentic.com) y del Agent Readiness Checker de Frase (ambos, agosto de 2026, con crédito); los eventos de volatilidad de citas los informaron profesionales (Ashni de Hype Partners (@ashnichrist) y otros, agosto de 2026): están etiquetados así; verifica con tu propio seguimiento.*
