# Archivos legibles por máquina y experiencias de agentes

Los agentes de IA ya no solo responden preguntas: se están volviendo compradores. Cuando un agente evalúa opciones en nombre de una persona, necesita información estructurada y legible. Si tus precios están encerrados en una página que se arma con JavaScript o tras un «contacta a ventas» (o «escríbenos para cotizar»), los agentes te saltan y recomiendan a competidores cuya información sí pueden leer.

> **Postura de Google:** no se requieren para AI Overviews ni AI Mode. Su guía dice explícitamente que no hacen falta marcado nuevo, archivos de IA ni markdown para aparecer en la búsqueda con IA generativa.
>
> **Por qué incluirlos igual:** los motores que no son de Google (ChatGPT, Claude, Perplexity) y los agentes compradores autónomos sí premian la estructura extraíble. Los archivos de abajo ayudan con esos motores sin dañar a Google.

Tu entrega son los **textos de estos archivos como borradores**; los sube a la raíz del sitio quien lo administra, con el OK del dueño. Antes, mira la referencia `preparacion-para-agentes` (acceso, descubrimiento, legibilidad).

## `/pricing.md` o `/pricing.txt`: precios estructurados para agentes de IA

Los montos salen de las **cifras de la empresa**, en su moneda y tal cual; nunca de tu memoria ni de un ejemplo.

```markdown
# Precios — [Nombre del producto o negocio]

## Gratis
- Precio: 0 al mes
- Límites: 100 correos al mes, 1 usuario
- Incluye: plantillas básicas, acceso a API

## Profesional
- Precio: [monto] al mes (facturado anual) | [monto] al mes (facturado mensual)
- Límites: 10.000 correos al mes, 5 usuarios
- Incluye: dominios propios, analítica, soporte prioritario

## Empresa
- Precio: a medida — escribir a [correo]
- Límites: sin tope de correos ni usuarios
- Incluye: SSO, acuerdo de nivel de servicio (SLA), gerente de cuenta dedicado
```

Para una tienda, un restaurante, una clínica o un servicio por cotización, el mismo formato sirve con paquetes, rangos o «desde», y lo que incluye cada uno (por ejemplo: limpieza dental, desde [monto]; incluye revisión y radiografía).

**Por qué importa ahora:**
- Los agentes de IA comparan cada vez más productos de forma programática antes de que una persona visite tu sitio.
- Los precios opacos se filtran fuera de los recorridos de compra mediados por IA.
- Un archivo markdown simple lo lee cualquier modelo: sin renderizado, sin JavaScript, sin muros de acceso.
- Mismo principio que `robots.txt` (para rastreadores), `llms.txt` (contexto para IA) y `AGENTS.md` (capacidades de agentes).

**Buenas prácticas:**
- Unidades consistentes (mensual o anual, por persona o plano).
- Límites y umbrales concretos, no solo nombres de funciones.
- Lista qué incluye cada nivel, no solo lo que cambia.
- Mantenlo al día: un precio desactualizado es peor que no tener archivo.
- Enlázalo desde el sitemap y desde la página de precios.

## `/llms.txt`: archivo de contexto para sistemas de IA

Ver [llmstxt.org](https://llmstxt.org). Si no hay uno, redáctalo: da a los sistemas de IA un resumen rápido de qué hace el negocio, para quién es y enlaces a las páginas clave (incluidos los precios). Su compañero `llms-full.txt` (todo el contenido del sitio en un solo archivo) se explica en `preparacion-para-agentes`.

## `/okf/`: paquete Open Knowledge Format (de Google, v0.1)

Un paquete de archivos markdown enlazados que representan el contenido del sitio. No hay señal de ranking confirmada hoy; es un registro temprano. Todo (rutas de implementación, alojamiento, cuándo saltárselo) está en `formato-abierto-okf`.

## Datos estructurados (schema) para IA

Los datos estructurados ayudan a los sistemas de IA a entender tu contenido. Los principales:

| Tipo de contenido | Schema | Por qué ayuda |
|---|---|---|
| Artículos / entradas de blog | `Article`, `BlogPosting` | Identificación de autor, fecha y tema |
| Contenido de cómo hacer | `HowTo` | Extracción de pasos para consultas de proceso |
| Preguntas frecuentes | `FAQPage` | Extracción directa de pregunta-respuesta |
| Productos | `Product` | Precio, características, reseñas |
| Comparaciones | `ItemList` | Datos comparativos estructurados |
| Reseñas | `Review`, `AggregateRating` | Señales de confianza |
| Organización | `Organization` | Reconocimiento de entidad |
| Negocio local | `LocalBusiness` | Dirección, horarios, zona de servicio |

El contenido con datos estructurados correctos muestra 30–40 % más visibilidad en IA en los motores que no son de Google. **Nota de Google:** los datos estructurados «no son necesarios para la búsqueda con IA generativa», pero se recomiendan para la estrategia de SEO en general. Para implementarlos, usa la habilidad `datos-estructurados`.

---

## Experiencias de agentes

Más allá de los buscadores con IA que resumen contenido, los agentes autónomos empiezan a acceder a los sitios directamente: hacen clic, leen, comparan e incluso compran en nombre de las personas. La guía de Google lo señala como una categoría emergente para la que hay que prepararse.

**Cómo acceden los agentes a tu sitio:**
- **Renderizado visual:** toman capturas o leen la página como lo haría una persona.
- **Inspección del DOM:** analizan la estructura HTML de la página.
- **Árbol de accesibilidad:** usan la misma información semántica que las tecnologías de apoyo (etiquetas, roles, puntos de referencia, títulos).

**Qué hacer:**
- **Renderizar contenido significativo sin acrobacias de JavaScript:** si la página está en blanco hasta que cargan cuatro frameworks, los agentes ven una página en blanco.
- **HTML semántico:** `<main>`, `<nav>`, `<article>`, `<button>`, jerarquía de títulos correcta, `alt` en las imágenes.
- **Árbol de accesibilidad limpio:** cada elemento interactivo con etiqueta; ARIA bien usado (o ninguno cuando basta el HTML nativo).
- **Selectores estables y diseños predecibles:** los agentes sufren con sitios que se vuelven a dibujar en cada interacción.
- **Precios, especificaciones y contacto visibles:** todo lo que un agente necesite para recomendar una compra debe estar en una página pública e indexable (aquí ayudan `/pricing.md` y archivos similares).

**Emergente: Universal Commerce Protocol (UCP).** Google menciona UCP como un protocolo futuro que dará a los agentes ganchos estandarizados para interacciones de comercio (descubrir catálogo, precios, pago). Hay que vigilar su adopción; por ahora, las recomendaciones estructurales de arriba son su antecedente.

**Para comercio electrónico y negocio local en particular**, Google destaca:
- **Feeds de Merchant Center** y **Google Business Profile** para la visibilidad de productos y servicios en la búsqueda con IA.
- **Business Agent** para la atención conversacional (donde aplique).
