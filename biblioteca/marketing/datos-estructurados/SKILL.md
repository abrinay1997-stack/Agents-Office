---
name: datos-estructurados
titulo: Datos estructurados (schema)
description: Úsala cuando haya que añadir, corregir o mejorar el marcado schema.org (JSON-LD) de una web para que Google muestre resultados enriquecidos: estrellas, precios, preguntas frecuentes, migas, negocio local o eventos.
area: seo
departments: [marketing]
agents: [mlead, riley]
origen: marketingskills/schema (MIT, Corey Haines)
palabras: [schema, datos estructurados, rich snippets, JSON-LD]
---
# Datos estructurados (schema)

Sirve para escribir el marcado schema.org en formato JSON-LD que ayuda a los buscadores (y a los asistentes de IA) a entender una página y que la vuelve elegible para resultados enriquecidos: estrellas de valoración, precio y disponibilidad, preguntas frecuentes, migas de pan, ficha de negocio local, eventos.

## Antes de empezar

Lee las notas de la empresa en el Cerebro (`00-Empresa/perfil`, `00-Empresa/oferta`, `00-Empresa/faq`, sobre todo `contexto-marketing`) y las cifras de la empresa. De ahí salen el nombre exacto, la dirección, el teléfono, los horarios, los precios y las redes sociales. Si falta algo que necesitas, pregúntalo en una línea o déjalo marcado como supuesto; nunca lo inventes. Un precio, una valoración o un número de reseñas que no conste en las cifras o en la propia página no se escribe.

Antes de escribir el marcado, entiende tres cosas:

1. **Tipo de página.** ¿Qué clase de página es? ¿Cuál es su contenido principal? ¿Qué resultados enriquecidos son posibles para ella?
2. **Estado actual.** ¿Ya tiene marcado? ¿Tiene errores? ¿Qué resultados enriquecidos aparecen ya? (Si tienes búsqueda web, abre la página y mira su código; si no, pídele al dueño la dirección o el HTML.)
3. **Objetivo.** ¿Qué resultado enriquecido se busca y qué valor tiene para el negocio? (Una clínica quiere su ficha local con horario; una tienda, precio y estrellas; un blog, la fecha y el autor.)

### Preguntas para este trabajo (si no están en el Cerebro)
1. ¿Qué tipo de página es?
2. ¿Qué resultado enriquecido quieres conseguir?
3. ¿Qué datos hay para rellenar el marcado (precios, reseñas, horarios, autor)?
4. ¿La página ya tiene marcado?
5. ¿Con qué está hecha la web (WordPress, Shopify, Wix, un desarrollo propio, Next.js…)?

## Principios

### 1. La exactitud primero
- El marcado debe representar con exactitud el contenido visible de la página.
- No marques contenido que no existe en la página (reseñas que no se ven, precios que no aparecen).
- Mantenlo al día cuando cambie el contenido (un precio nuevo, un horario de temporada).

### 2. Usa JSON-LD
- Es el formato que recomienda Google.
- Es más fácil de poner y de mantener que microdatos o RDFa.
- Va en el `<head>` o al final del `<body>`.

### 3. Sigue las directrices de Google
- Usa solo el marcado que Google admite para resultados enriquecidos.
- Nada de trucos (reseñas propias inventadas, valoraciones de toda la empresa en cada producto).
- Revisa los requisitos de elegibilidad de cada tipo.

### 4. Valídalo todo
- Prueba antes de publicar.
- Vigila Search Console.
- Corrige los errores en cuanto aparezcan.

## Tipos de schema más comunes

| Tipo | Para qué | Propiedades obligatorias |
|------|----------|--------------------------|
| Organization | Página de inicio o «Quiénes somos» | name, url |
| WebSite | Página de inicio (cuadro de búsqueda) | name, url |
| Article / BlogPosting | Entradas de blog, noticias | headline, image, datePublished, author |
| Product | Páginas de producto | name, image, offers |
| SoftwareApplication | Páginas de un SaaS o una app | name, offers |
| FAQPage | Preguntas frecuentes | mainEntity (lista de pregunta y respuesta) |
| HowTo | Tutoriales paso a paso | name, step |
| BreadcrumbList | Cualquier página con migas de pan | itemListElement |
| LocalBusiness (y sus subtipos: Dentist, Restaurant, Store, HardwareStore…) | Negocio con local o zona de servicio | name, address |
| Event | Eventos, talleres, webinars | name, startDate, location |

Los ejemplos completos en JSON-LD están en la referencia `ejemplos-schema`.

## Referencia rápida

**Organization (página de la empresa).** Obligatorias: name, url. Recomendadas: logo, sameAs (perfiles en redes), contactPoint.

**Article / BlogPosting.** Obligatorias: headline, image, datePublished, author. Recomendadas: dateModified, publisher, description.

**Product.** Obligatorias: name, image, offers (precio + disponibilidad). Recomendadas: sku, brand, aggregateRating, review.

**FAQPage.** Obligatoria: mainEntity (lista de pares Question/Answer).

**BreadcrumbList.** Obligatoria: itemListElement (lista con position, name, item).

**LocalBusiness.** Obligatorias: name, address. Recomendadas: telephone, openingHoursSpecification, geo, image, priceRange, url. Usa el subtipo más preciso (Dentist, Restaurant, ClothingStore, HardwareStore, AutoRepair…) en vez del genérico.

### Según el negocio
- **Tienda en línea:** Product + Offer + AggregateRating/Review (solo si las reseñas se ven en la página) + BreadcrumbList.
- **Negocio local (clínica, restaurante, ferretería):** LocalBusiness con su subtipo, horarios, dirección y teléfono idénticos a los de su ficha de Google; FAQPage si hay preguntas frecuentes visibles.
- **Servicios / agencia:** Organization (o ProfessionalService) + Service por servicio + FAQPage.
- **SaaS o app:** Organization + WebSite + SoftwareApplication (o Product).
- **Blog o medio:** Article/BlogPosting + BreadcrumbList + Person para los autores.
- **Eventos y talleres:** Event con modo de asistencia (presencial, en línea o mixto) y Offer con el precio de la entrada.

## Varios tipos en una página

Puedes combinar varios tipos en una misma página con `@graph`:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", ... },
    { "@type": "WebSite", ... },
    { "@type": "BreadcrumbList", ... }
  ]
}
```

Usa `@id` (por ejemplo `https://tuweb.com/#organization`) para que un tipo apunte a otro sin repetirlo.

## Validación y pruebas

### Herramientas
- **Prueba de resultados enriquecidos de Google:** https://search.google.com/test/rich-results
- **Validador de Schema.org:** https://validator.schema.org/
- **Search Console:** los informes de «Mejoras» (si la empresa tiene acceso, pídele al dueño la captura o los errores).

El agente no puede correr estas pruebas por sí mismo: deja en la entrega la lista de comprobación para que el dueño (o quien lleve la web) la pase.

### Errores comunes
- **Faltan propiedades obligatorias:** revisa la documentación de Google para cada tipo.
- **Valores no válidos:** las fechas en ISO 8601 (`2026-10-06T09:00:00-05:00`), las URL completas (con `https://`), las enumeraciones exactas (`https://schema.org/InStock`), la moneda en código ISO 4217 (`MXN`, `COP`, `PEN`, `USD`, `EUR`…).
- **No coincide con la página:** el marcado dice algo que el contenido visible no dice.

### Si el marcado está bien pero no salen resultados enriquecidos
1. Valida la sintaxis en las dos herramientas (un error de JSON invalida todo el bloque).
2. Revisa anidamiento, propiedades obligatorias y dónde está el `<script>` (que no lo inyecte tarde un script que Google no ejecuta).
3. Distingue **errores** (impiden el resultado) de **advertencias** (propiedades recomendadas que faltan; no lo impiden).
4. Distingue **elegible** de **mostrado**: un marcado válido no garantiza el resultado enriquecido; Google decide cuándo enseñarlo. Además, Google ha restringido algunos tipos (por ejemplo, FAQ y HowTo se muestran mucho menos que antes); dilo sin prometer.
5. Mira el informe de datos estructurados en Search Console y espera a que Google vuelva a rastrear.

## Cómo se pone

### Webs estáticas
- El JSON-LD va directamente en la plantilla HTML.
- Usa fragmentos (includes/partials) para el marcado que se repite.

### Webs dinámicas (React, Next.js…)
- Un componente que pinta el marcado.
- Renderizado en el servidor, para que los buscadores lo vean.
- Los datos se serializan a JSON-LD (ejemplo en la referencia).

### CMS (WordPress, Shopify, Wix…)
- Complementos (Yoast, Rank Math, Schema Pro en WordPress; la mayoría de temas de Shopify ya traen Product).
- Cambios en el tema.
- Campos personalizados que alimentan el marcado (fecha, autor, precio), así una plantilla sirve para todas las páginas.

El agente no toca la web: entrega el código y dice dónde va. Si hace falta que alguien lo instale, propónlo con `crear_borrador_tarea` o pídeselo al dueño con `pedir_bloqueo`.

## Cómo entregarlo

Un documento en Markdown con:

1. **Resumen** — qué página, qué tipos de schema y qué resultado enriquecido se busca (una o dos líneas).
2. **El marcado** — un bloque de código JSON-LD completo, listo para pegar:
   ```json
   {
     "@context": "https://schema.org",
     "@type": "...",
     ...
   }
   ```
   Si es una plantilla para muchas páginas, marca los campos dinámicos (`{{titulo}}`, `{{fecha_publicacion}}`) y di de dónde sale cada uno en el CMS.
3. **Dónde ponerlo** — en qué parte de la página y cómo, según la plataforma.
4. **Datos que faltan o supuestos** — cada valor que no estaba en el Cerebro ni en la página, marcado.
5. **Lista de comprobación**
   - [ ] Pasa la prueba de resultados enriquecidos.
   - [ ] Sin errores ni advertencias (o advertencias explicadas).
   - [ ] Coincide con el contenido visible.
   - [ ] Tiene todas las propiedades obligatorias.

## Reglas
- El marcado describe solo lo que se ve en la página. Nunca marques reseñas, precios o preguntas que no están visibles.
- Nunca inventes una cifra: precio, valoración, número de reseñas, teléfono o dirección salen de las cifras de la empresa, del Cerebro o de la propia página.
- Siempre JSON-LD, nunca microdatos, salvo que la plataforma no permita otra cosa.
- Fechas en ISO 8601, URL completas, moneda en código ISO.
- No prometas que saldrá el resultado enriquecido: Google decide.
- No publicas nada en la web: entregas el código para el OK del dueño.
- Si el pedido es una auditoría SEO general (caída de tráfico, rastreo, redirecciones), no es esta habilidad: usa `auditoria-seo`.

## Referencias
- `ejemplos-schema` — JSON-LD completo de Organization, WebSite, Article, Product, SoftwareApplication, FAQPage, HowTo, BreadcrumbList, LocalBusiness, Event, `@graph` y un ejemplo en Next.js. Léela siempre que vayas a escribir el código.

## Habilidades relacionadas
- **auditoria-seo**: SEO general, que incluye revisar el schema.
- **seo-para-ia**: aparecer en las respuestas de los asistentes de IA (el schema les ayuda a entender el contenido).
- **seo-programatico**: schema en plantillas, para muchas páginas a la vez.
- **arquitectura-web**: la estructura de migas de pan y la navegación.
