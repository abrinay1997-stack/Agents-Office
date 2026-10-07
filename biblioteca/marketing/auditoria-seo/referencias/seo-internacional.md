# SEO internacional: qué revisar, errores comunes y fuentes

Para sitios que sirven a varios idiomas o países. Primero la lista de revisión detallada; después, las pruebas y fuentes de cada punto. Las fuentes están en inglés; las citas van traducidas.

---

# Parte 1. Qué revisar

## hreflang

Tres formas equivalentes de ponerlo: `<link>` en el `<head>` del HTML, cabeceras HTTP `Link`, o `<xhtml:link>` en el sitemap XML. Si usas varias, deben coincidir: si se contradicen, Google descarta esa pareja. Con 10 idiomas o más, mejor en el sitemap (no pesa en la página ni en cada visita).

**Revisa:**
- Cada página se incluye a sí misma en su grupo hreflang (autorreferencia).
- Los enlaces son recíprocos: si A apunta a B, B apunta a A (si no, se ignoran los dos).
- Códigos válidos: idioma ISO 639-1 y, si hace falta, región ISO 3166-1 alfa-2 (`es`, `es-MX`, `es-CO`, `en-GB`; nunca `en-UK`).
- Hay `x-default` apuntando a la página de respaldo (selector de idioma o idioma por defecto).
- Todas las direcciones de destino responden 200, son indexables y coinciden con su canónica.
- No hay códigos idioma-región repetidos que apunten a direcciones distintas.

**Errores comunes:** falta la autorreferencia (se ignora todo el hreflang); no hay etiqueta de retorno (se descarta la pareja); códigos inválidos como `en-UK` (usa `en-GB`); el destino no es canónico, da 404 o está bloqueado (se descarta el grupo); el HTML y el sitemap no coinciden (se descarta la pareja en conflicto).

**A escala:** los `<xhtml:link>` no cuentan para el límite de 50.000 direcciones por sitemap, pero el límite de 50 MB por archivo pasa a ser el cuello de botella (planea 2.000-5.000 direcciones por archivo con hreflang completo). Concentra el hreflang en las páginas que reciben tráfico en el idioma equivocado; no hace falta en todas. Para Bing: añade `<html lang>` y `<meta http-equiv="content-language">` (Bing trata hreflang como señal débil).

## Canónicas en sitios de varios idiomas

- Cada versión de idioma es canónica a sí misma (`/es/pagina` → `/es/pagina`).
- Nunca una canónica entre idiomas (del francés al inglés): suprime la versión no canónica.
- La dirección canónica debe estar en el grupo hreflang; si no, se ignora todo el hreflang.
- Si la canónica y el hreflang chocan, gana la canónica.
- Protocolo y dominio coherentes entre canónica, hreflang y sitemap (`https` y la misma variante de dominio).
- Páginas paginadas por idioma: cada página canónica a sí misma (nunca la 2 y siguientes a la 1).

**Errores comunes:** todas las versiones con canónica al inglés (mata su indexación); la canónica fuera del grupo hreflang (se ignora sin aviso); protocolo distinto entre canónica y hreflang; un gestor de contenido que pone la canónica de páginas internas al inicio.

## Sitemaps internacionales

**Revisa:**
- Espacio de nombres `xmlns:xhtml` en `<urlset>`; cada `<url>` incluye `<xhtml:link>` para todos los idiomas, también el propio.
- Incluye la alternativa `x-default`; todas las direcciones absolutas (protocolo y dominio).
- El índice de sitemaps está en Search Console y en robots.txt; se parten por tipo de contenido, no por idioma.

**Ojo con Next.js:** `alternates.languages` NO añade sola la autorreferencia `<xhtml:link>` de la dirección `<loc>`: hay que incluir el idioma propio de forma explícita.

## Estructura de direcciones por idioma

**Recomendado:** subcarpetas (`/es/`, `/en/`). **Aceptable:** subdominios o dominios de país (ccTLD, `.mx`, `.co`). **No recomendado:** parámetros (`?lang=es`).

**Revisa:**
- Una estrategia de prefijos coherente; todos los idiomas con prefijo (ocultar el idioma impide que Google distinga las versiones).
- La raíz `/` funciona como `x-default` con redirección, o sirve el idioma por defecto.
- Nada de negociar el contenido por IP o por el idioma del navegador (Googlebot rastrea desde IP de EE. UU. y sin cabecera Accept-Language).
- Coherencia de barra final y mayúsculas en rutas, canónicas, hreflang y sitemaps.
- Redirecciones 301 del formato no canónico al canónico.

**Nota:** el informe de Segmentación internacional de Search Console ya no existe. La segmentación por país depende del hreflang, las señales del contenido y los enlaces.

## Calidad del contenido por idioma

**Calidad de la traducción:**
- El contenido traducido con IA no es spam por sí mismo (postura de Google desde 2025), pero traducciones masivas de poco valor pueden caer en la política de abuso de contenido a escala.
- Google usa el contenido visible para saber el idioma: traduce TODO (título, descripción, encabezados, cuerpo), no solo la plantilla.
- Traducir solo la plantilla o el menú y dejar el contenido en el idioma original crea duplicados.

**Versiones pobres:**
- El sistema de contenido útil es de todo el sitio: muchas versiones de idioma pobres pueden hundir también a las páginas buenas.
- No pongas `noindex` a las versiones pobres (gasta rastreo) ni canónica entre idiomas (choca con hreflang).
- Lo mejor: no crear versiones de idioma que no puedas hacer útiles de verdad.

**Revisa:**
- Todas las versiones tienen el contenido principal traducido (no solo la interfaz).
- No hay contenido casi idéntico entre versiones («Duplicada: Google eligió otra canónica» en Search Console).
- hreflang solo para idiomas con contenido real y demanda de búsqueda.
- Señales locales: moneda, formato de teléfono, direcciones donde aplique.
- Enlaces hreflang rotos (404, redirecciones): gastan rastreo e invalidan el grupo.

**Caso latinoamericano típico:** un sitio con `/mx/`, `/co/` y `/ar/` casi idénticos (solo cambia la moneda) corre el riesgo de que Google muestre una sola versión. Para que convivan, cada una necesita diferencias reales: precios en su moneda, medios de pago, envíos, teléfonos, direcciones, testimonios y preguntas locales.

---

# Parte 2. Pruebas y fuentes

## hreflang

### Formas de ponerlo
Google admite tres métodos equivalentes: `<link>` en el `<head>`, cabeceras HTTP `Link` y `<xhtml:link>` en el sitemap. Google confirmó que ninguno tiene prioridad sobre otro. Combina las señales del HTML y del sitemap; si la misma pareja idioma-región apunta a direcciones distintas según el método, descarta la pareja en lugar de adivinar.
- [Google Search Central: Localized Versions](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [SEJ: Google Combines Hreflang Signals](https://www.searchenginejournal.com/google-combines-hreflang-signals-from-html-sitemaps/389219/)

### Reciprocidad
Documentación de Google: «Si la página X enlaza a la página Y, la página Y debe enlazar de vuelta a la X. Si no, esas anotaciones pueden ignorarse o no interpretarse bien.»
Cada página debe incluirse a sí misma en el grupo. La falta de autorreferencia es el error número 1 en las auditorías de Semrush. Un estudio de 374.756 dominios encontró problemas en el 67 % de las implementaciones de hreflang.
- [Google Search Central: Localized Versions](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Semrush: 9 Common Hreflang Errors](https://www.semrush.com/blog/hreflang-errors/)
- [SE Land: 31% of International Websites Contain Hreflang Errors](https://searchengineland.com/study-31-of-international-websites-contain-hreflang-errors-395161)

### x-default
Existe desde abril de 2013. Marca la página de respaldo para quien no coincide con ningún idioma o región declarado. Puede apuntar a la misma dirección que una de las alternativas de idioma. Debe estar en el conjunto completo de anotaciones de cada versión.
- [Google Blog: x-default hreflang](https://developers.google.com/search/blog/2013/04/x-default-hreflang-for-international-pages)
- [Google Blog: How x-default can help you (2023)](https://developers.google.com/search/blog/2023/05/x-default)

### Códigos de idioma y región
Idioma: ISO 639-1 (2 letras). Región: ISO 3166-1 alfa-2 (2 letras). Formato: `idioma[-escritura][-región]`. No se puede poner solo la región. Errores comunes: `en-UK` (debe ser `en-GB`), `es-419` (no es ISO 3166-1). Un estudio encontró códigos de idioma inválidos en el 8,9 % de los sitios con hreflang.
- [Google Search Central: Localized Versions](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [SE Land: estudio del 31 %](https://searchengineland.com/study-31-of-international-websites-contain-hreflang-errors-395161)

### hreflang a escala (20 idiomas o más)
Con 20 idiomas, el hreflang en el `<head>` añade unos 1,5 KB por página sin ningún beneficio para quien la visita. En el sitemap no afecta al rendimiento. Los `<xhtml:link>` NO cuentan para el límite de 50.000 direcciones (solo cuentan los `<loc>`).
John Mueller (Google) recomienda concentrar el hreflang en las páginas que reciben tráfico en el idioma equivocado: «No lo haría en las demás páginas del sitio, porque es muy complejo y difícil de mantener.»
- [SERoundtable: Child Elements Don't Count](https://www.seroundtable.com/google-child-elements-dont-count-towards-sitemap-url-limit-34377.html)
- [SERoundtable: Where To Focus Hreflang](https://www.seroundtable.com/using-hreflang-34127.html)
- [Yoast: hreflang Ultimate Guide](https://yoast.com/hreflang-ultimate-guide/)

### Google frente a Bing
Bing trata hreflang como «señal débil» y se apoya en la meta `content-language`, el atributo `lang` del HTML, los dominios de país y la ubicación del servidor. Yandex admite hreflang como Google. Para todos: hreflang (Google y Yandex) + `<html lang="...">` + `<meta http-equiv="content-language">` (Bing).
- [Digital Ready Marketing: Bing Doesn't Use Hreflang](https://digitalreadymarketing.com/bing-doesnt-use-hreflang-annotation-what-does-it-use/)
- [Yoast: hreflang Ultimate Guide](https://yoast.com/hreflang-ultimate-guide/)

## Canónicas e idiomas

### Canónica a sí misma
Cada versión de idioma es canónica a sí misma. Mueller: «No uses rel=canonical entre idiomas o países; úsalo solo dentro de cada país o idioma.» Google: «Indica una página canónica en el mismo idioma, o el mejor idioma sustituto si no existe una canónica en el mismo idioma.»
- [John Mueller: hreflang canonical](https://johnmu.com/hreflang-canonical/)
- [Google: Consolidate Duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

### La canónica gana al hreflang
Mueller: «Si tu canónica apunta a otro lado, Google la seguirá e ignorará tu anotación hreflang.» La canónica debe ser una de las direcciones del grupo hreflang, o se ignora todo. Google también dice que «prefiere direcciones que forman parte de grupos hreflang para elegir la canónica»: cuando las señales coinciden, el hreflang refuerza la canónica.
- [John Mueller: hreflang canonical](https://johnmu.com/hreflang-canonical/)
- [SEJ: Hreflang Tags Are Hints](https://www.searchenginejournal.com/google-reminds-that-hreflang-tags-are-hints-not-directives/546428/)
- [Google: Consolidate Duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

### Versiones regionales casi duplicadas
Mueller (sesión de preguntas de 2023): «Si el contenido es exactamente el mismo y no vemos diferencia, por sencillez y por la experiencia de la gente podemos mostrar una sola versión, aunque haya hreflang.» La detección de duplicados de Google ocurre ANTES de evaluar el hreflang. Para mantener las dos versiones indexadas hacen falta diferencias de contenido reales, más allá del símbolo de la moneda.
- [International Web Mastery: Same-Language Duplicate Pages](https://internationalwebmastery.com/blog/how-google-handles-canonicalization-of-same-language-duplicate-near-duplicate-pages/)
- [Google: Managing Multi-Regional Sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)

### Paginación por idioma
Google: «No uses la primera página de una serie paginada como canónica. Dale a cada página su propia dirección canónica.» Cada página paginada de cada idioma, canónica a sí misma. `rel="next/prev"` dejó de usarse en marzo de 2019.
- [Google: Pagination Best Practices](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading)

## Sitemaps internacionales

### Estructura
Cada `<url>` incluye `<xhtml:link>` para cada idioma. Requiere el espacio de nombres `xmlns:xhtml="http://www.w3.org/1999/xhtml"`. Se parten por tipo de contenido, no por idioma: partir por idioma complica el mantenimiento porque cada sitemap de idioma debe referenciar a todos los demás (reciprocidad).
- [Google Search Central: Localized Versions](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Lumar: How Google Handles Hreflang](https://www.lumar.io/office-hours/hreflang/)

### Límites de tamaño
50.000 direcciones o 50 MB sin comprimir por sitemap. Solo los `<loc>` cuentan para el límite de 50.000, pero con 20 alternativas por entrada el límite de 50 MB manda. Planea 2.000-5.000 direcciones por sitemap con hreflang completo.
- [Google: Build and Submit a Sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [SERoundtable: Sitemap 50,000 Limit](https://www.seroundtable.com/google-sitemap-50-000-limit-based-on-location-urls-not-alternative-urls-33843.html)

### Envío
Envía el índice de sitemaps en Search Console Y referéncialo en robots.txt. Los sitemaps hijos pueden enviarse aparte para tener informes por sitemap.
- [Google: Build and Submit a Sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)

### Next.js
`alternates.languages` NO incluye solo la autorreferencia `<xhtml:link>` del `<loc>`. Hay que poner el idioma propio en el objeto `languages`.
- [Next.js Docs: sitemap.xml](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)

## Estructura de direcciones

### Estrategias
Google trata igual subcarpetas y subdominios. Mueller: «Desde nuestro punto de vista, subdominios y subcarpetas son esencialmente equivalentes.» Los parámetros (`?lang=es`) aparecen como «No recomendado» en la documentación de Google.
- [Google: Managing Multi-Regional Sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)

### Idioma por defecto
Mueller recomienda: `/` como `x-default` y cada idioma con su prefijo. Si `/` no se marca como `x-default`, «para Google puede parecer que `/` es una página distinta de las otras».
- [Google Blog: x-default](https://developers.google.com/search/blog/2023/05/x-default)
- [Google Blog: Creating the Right Homepage](https://developers.google.com/search/blog/2014/05/creating-right-homepage-for-your)

### Negociación de contenido y redirecciones por IP
Google desaconseja las páginas que cambian según el visitante. Googlebot rastrea desde IP de EE. UU. y no envía la cabecera Accept-Language. Hacen falta direcciones separadas y hreflang.
- [Google: Locale-Adaptive Pages](https://developers.google.com/search/docs/specialty/international/locale-adaptive-pages)

### Barra final
Mueller: la barra final es «una parte significativa de la dirección y la cambia si está o no». Un solo formato para rutas, enlaces internos, canónicas, hreflang y sitemaps. Mueller (2025): «La coherencia es el factor técnico de SEO más grande.»
- [SERoundtable: Consistency Is The Biggest Technical SEO Factor](https://www.seroundtable.com/google-consistency-seo-40427.html)

### Segmentación por país en Search Console
El informe de Segmentación internacional ya no existe. Google depende del hreflang, el análisis del idioma del contenido y los enlaces. Se pueden añadir propiedades por subcarpeta para tener informes por idioma.
- [Google Support: International Targeting Deprecated](https://support.google.com/webmasters/answer/12474899?hl=en)

### Modos de idioma de los frameworks
Usa `localePrefix: 'always'` (next-intl) o su equivalente. Nunca ocultes el idioma en las direcciones: Google necesita una dirección única por idioma. El modo `'never'` desactiva los enlaces alternativos por completo.
- [next-intl: Routing Configuration](https://next-intl.dev/docs/routing/configuration)
- [Next.js Discussion #18419](https://github.com/vercel/next.js/discussions/18419)

## Calidad del contenido por idioma

### Contenido traducido automáticamente (postura de 2025)
A mediados de 2025 Google quitó su antigua recomendación contra el contenido traducido automáticamente. Postura actual: «Nuestras políticas no definen estrictamente como spam el contenido traducido por IA.» La política de abuso de contenido a escala menciona la traducción como una vía posible, pero no la prohíbe. Reddit tradujo con IA a más de 35 idiomas con conocimiento de Google. Lo que distingue es la intención y la calidad, no el método.
- [Google Spam Policies](https://developers.google.com/search/docs/essentials/spam-policies)
- [Glenn Gabe: Auto-Translating Content](https://www.gsqi.com/marketing-blog/auto-translating-content-google-scaled-content-abuse/)
- [SE Land: Reddit AI Translations](https://searchengineland.com/google-comments-on-reddits-use-of-ai-to-translate-its-pages-456908)

### Versiones pobres
Google: «Las versiones localizadas de una página solo se consideran duplicadas si el contenido principal queda sin traducir.» Las páginas con solo la plantilla traducida se agrupan como duplicadas. NO uses `noindex` para versiones no deseadas (gasta rastreo). NO pongas canónica entre idiomas (choca con hreflang). Lo mejor: no crear versiones que no puedas hacer útiles.
- [Google: Localized Versions](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google: Crawl Budget Management](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget)

### El sistema de contenido útil
Se integró al algoritmo principal en marzo de 2024. Es una señal de todo el sitio: «cualquier contenido —no solo el poco útil— de sitios con una proporción relativamente alta de contenido poco útil tiene menos probabilidades de rendir bien en la Búsqueda». Las páginas traducidas de baja calidad pueden arrastrar a todo el sitio: es el argumento más fuerte contra crear versiones que no sean útiles.
- [Google Blog: Helpful Content Update](https://developers.google.com/search/blog/2022/08/helpful-content-update)
- [Amsive: What Changed in 2024](https://www.amsive.com/insights/seo/googles-helpful-content-update-ranking-system-what-happened-and-what-changed-in-2024/)

### Traducción parcial
Google: «Traducir solo el texto de la plantilla y dejar la mayor parte del contenido en un solo idioma… puede crear una mala experiencia.» Google usa el contenido visible (no el atributo `lang`) para decidir el idioma. Si creas una versión de idioma, traduce todo el contenido. Un título o una descripción en el idioma equivocado bajan los clics.
- [Google: Managing Multi-Regional Sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)

### Presupuesto de rastreo
Solo preocupa con más de 1 millón de páginas o más de 10.000 que cambian a diario. Pero las direcciones alternativas (destinos de hreflang) sí consumen rastreo. Los enlaces hreflang rotos gastan rastreo E invalidan las señales.
- [Google: Crawl Budget Management](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget)
- [Google Blog: Crawl Budget](https://developers.google.com/search/blog/2017/01/what-crawl-budget-means-for-googlebot)

### Señales locales
Google identifica el público por «direcciones y teléfonos locales en las páginas, el uso del idioma y la moneda locales, enlaces desde otros sitios locales o señales de tu Perfil de Empresa».
- [Google: Managing Multi-Regional Sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
