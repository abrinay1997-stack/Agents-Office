---
name: imagenes-marketing
titulo: Imágenes de marketing
description: Úsala cuando haya que crear, editar u optimizar imágenes de marketing: portadas de artículos, gráficos para redes, banners de perfil, imágenes de producto, visuales de fichas y directorios, o imágenes para compartir enlaces (OG).
area: canales
departments: [marketing, delivery]
agents: [gfx, iggy, mlead, dasst]
origen: marketingskills/image (MIT, Corey Haines)
palabras: [imagen, foto, gráfico, arte, diseño, portada, visual, banner]
---
# Imágenes de marketing

Sirve para producir imágenes de marketing profesionales sin perder tiempo: desde la portada de un artículo y el gráfico de una publicación hasta el banner de un perfil, la foto de un producto o la imagen que se ve cuando alguien comparte un enlace.

Trabajas como productor de contenido visual: eliges el camino correcto (generar con el Estudio, editar una foto real, usar una plantilla de diseño o tomar una captura real), escribes el pedido con precisión y dejas el archivo listo para su lugar de uso. Para anuncios pagados y sus medidas por plataforma, usa `creatividad-anuncios`. Para video, `video-marketing`.

## Antes de empezar

Lee las notas de la empresa en el Cerebro (`00-Empresa/perfil`, `00-Empresa/oferta`, `00-Empresa/voz`, `00-Empresa/clientes`, `00-Empresa/faq` y, sobre todo, `00-Empresa/marketing`) y las cifras de la empresa. Usa ese contexto y solo pregunta lo que no esté ahí o sea propio de este encargo. Si falta algo que necesitas, pregúntalo en una línea (o con `pedir_bloqueo` si sin eso no puedes seguir) o déjalo marcado como supuesto; nunca lo inventes.

Reúne esto (pregunta solo lo que falte):

### 1. El objetivo de la imagen
- ¿Qué tipo de imagen es? (portada de artículo, gráfico para redes, imagen de producto, banner, activo de marca, imagen para compartir enlaces)
- ¿Para qué lugar? (sitio web, redes, ficha de directorio o de mapa, tienda de apps, correo, catálogo, local físico)
- ¿Qué medidas necesita?

### 2. El enfoque de producción
- ¿Hay activos de marca? (logo, colores, tipografías, guía de estilo, fotos de producto reales, fotos del local y del equipo)
- ¿Debe ser fotográfica o ilustrada?
- ¿Es una pieza única o una plantilla para repetir?

### 3. El contexto técnico
- ¿Qué motores del Estudio están encendidos y qué tope de gasto hay? Míralo con `estado_estudio` antes de proponer algo que cueste.
- ¿La imagen va a una web? Entonces también hay que optimizarla para que cargue rápido.
- ¿Hay una carpeta de la galería del Estudio con las fotos de la empresa? Búscalas con `buscar_en_galeria` antes de pedir otras.

---

## Cómo elegir el enfoque

| Enfoque | Sirve para | Herramientas | Cuándo usarlo |
|---|---|---|---|
| **Generar con IA** | Imágenes originales a partir de un texto | Estudio: `generar_imagen` (con el modelo que convenga, ver abajo) | Portadas, gráficos para redes, escenas de ambiente, fondos |
| **Editar con IA** | Modificar una imagen que ya existe | Estudio: edición de una imagen de la galería; presets de fotos de producto (`buscar_presets`, `aplicar_preset`) | Quitar o cambiar el fondo, mejorar la luz, variantes, fotos de producto limpias |
| **Herramientas de diseño** | Piezas con plantilla y fieles a la marca | Canva o Figma, si la empresa los tiene conectados | Banners de perfil, plantillas para redes, presentaciones |
| **Captura real + marco** | Mostrar la pantalla de un producto digital | Capturas reales que te dé el dueño, enmarcadas | Maquetas de producto, anuncios de funciones |
| **Fotografía real o de stock** | Escenas genéricas de negocio o de vida diaria | Fotos del dueño; bancos gratuitos como Unsplash o Pexels | Cuando la rapidez importa más que lo único |

**Regla de oro para tiendas, restaurantes y negocios locales:** una foto real del producto, del plato, del local o del equipo casi siempre convence más que una imagen inventada. La IA se usa para mejorar esa foto (luz, fondo, encuadre, versiones para cada red) o para lo que no se puede fotografiar (fondos, ambientes, ilustraciones), nunca para fingir que el producto es otro.

---

## Generar con IA (el Estudio de la oficina)

La forma más rápida de hacer visuales únicos. En la oficina se hace con el Estudio:

- `estado_estudio`: qué motores y modelos hay encendidos y cuánto queda de tope.
- `buscar_presets`: busca una receta lista en el banco de presets (fotos de producto, fondos blancos para catálogo, luz, encuadre) antes de escribir un pedido desde cero.
- `aplicar_preset`: aplica esa receta a una foto o a un pedido. Gasta como cualquier generación y pasa por los topes del Estudio.
- `generar_imagen`: genera desde un texto, con referencias de la galería si las hay.
- `buscar_en_galeria`: encuentra imágenes ya hechas (de la empresa, de otros agentes) para reusarlas o usarlas de referencia.
- `estado_trabajo`: el video y algunos modelos tardan; el trabajo sigue en segundo plano y la oficina pone el archivo en tu entrega cuando termina.

Una imagen suele volver dentro de la misma llamada; la entregas con su enlace, marcada como borrador. **Nunca publiques ni subas nada a una red o a una web: eso lo aprueba el dueño.** Si hay un calendario de contenido, deja la pieza con `crear_borrador` y el archivo adjunto.

### Qué modelo elegir

El Estudio muestra qué modelos hay encendidos (varían según las llaves que tenga la empresa). Elige según lo que necesita la imagen y confirma con `estado_estudio` que ese modelo existe; si no, usa el más cercano y dilo.

| Necesito… | Busca un modelo… | Ejemplos de familias (si están encendidas) |
|---|---|---|
| Texto o titulares dentro de la imagen | Fuerte en tipografía | Ideogram, Nano Banana, GPT Image |
| Coherencia de marca o de producto en muchas imágenes | Que acepte varias imágenes de referencia | Flux, Nano Banana Pro, Recraft |
| Editar una foto existente | Con edición nativa | Nano Banana, Flux Kontext, GPT Image |
| Ilustración o activos vectoriales | Fuerte en ilustración | Recraft |
| La mejor calidad estética | De gama alta | Flux Pro, Midjourney (solo fuera de la oficina: no tiene API) |
| Muchas imágenes a bajo costo | Rápido y barato | Flux rápido, Gemini Flash, Stable Diffusion |

Los precios y las versiones cambian a menudo: la oficina muestra el costo estimado de cada pedido; úsalo en vez de recordar tarifas.

### Lo básico de un buen pedido de imagen

Un buen texto sigue este orden: **Sujeto + Escena + Estilo + Luz + Composición + Datos técnicos**

```
Un portátil sobre un escritorio blanco minimalista mostrando un panel de datos,
luz suave direccional desde la izquierda, poca profundidad de campo,
estilo de fotografía comercial limpia, formato 16:9, alta resolución
```

**Errores comunes:**
- Demasiado vago («una imagen de negocios»): añade detalles concretos.
- Olvidar el formato: indica siempre la proporción.
- Pedir mucho texto dentro de la imagen: para todo lo que pase de un titular corto, usa superposiciones.
- Sin dirección de estilo: «fotorrealista», «ilustración plana», «render 3D».

La guía detallada, con ejemplos por caso y consejos por modelo, está en la referencia `guia-de-prompts-imagenes`.

---

## Herramientas de diseño

Para trabajo con plantilla y fiel a la marca, donde generar con IA es excesivo o demasiado impredecible.

### Canva

Lo mejor para quien no es diseñador y necesita algo pulido rápido.
- **Fortalezas:** gran biblioteca de plantillas, kit de marca, cambio de tamaño mágico (un diseño → todos los formatos), trabajo en equipo.
- **Ideal para:** gráficos de redes, presentaciones, encabezados de correo, banners sencillos, carteles y volantes de un negocio local.
- **Límites:** menos control que Figma; las plantillas pueden verse genéricas.
- **En la oficina:** si la empresa tiene Canva conectado, úsalo; si no, prepara el texto, la estructura y las medidas, y propón el encargo a `gfx` o hazlo con el Estudio.

### Figma

Lo mejor para equipos con sistema de diseño o que necesitan precisión al píxel.
- **Fortalezas:** componentes de sistema de diseño, auto layout, entrega a desarrollo, plugins.
- **Ideal para:** imágenes OG con plantillas, activos del sistema de diseño, composiciones complejas.
- **Límites:** curva de aprendizaje más alta; requiere oficio de diseño.
- **En la oficina:** si está conectado, puede leerse el diseño; no inventes archivos que no hayas visto.

### Cuándo diseño y cuándo IA

| Escenario | Herramienta de diseño | Generar con IA |
|---|:-:|:-:|
| Hay que seguir una guía de marca exacta | Sí | Quizá (con buenas imágenes de referencia) |
| Hacen falta 20 tamaños de un mismo diseño | Sí (cambio de tamaño de Canva) | No |
| Imagen única para la portada de un artículo | No | Sí |
| Plantilla recurrente para redes (oferta del día, frase, menú) | Sí | No |
| Maqueta de producto con pantalla real | No (usa capturas) | No (la IA inventa la pantalla) |
| Visual abstracto o creativo | No | Sí |
| Foto de producto de un catálogo | No | Mejor mejorar la foto real con un preset |

---

## Flujos de trabajo por tipo de imagen

### Portadas de artículos y de blog

La imagen de cabecera de cada entrada. Marca el tono, ayuda a que se comparta y se necesita para la vista previa en redes (OG).

1. **Define el concepto:** ¿qué metáfora visual representa el tema?
2. **Genera con IA:** un modelo fotorrealista o, si lleva texto, uno fuerte en tipografía.
3. **Especifica 1200×630** (sirve de portada y de imagen OG) o **1920×1080** para ancho completo.
4. **Optimiza:** comprime a menos de 200 KB y entrega en WebP con JPEG de respaldo (si la web lo admite).

**Patrón de pedido:**
```
[Metáfora visual del tema], estilo moderno y limpio,
luz natural brillante, poca profundidad de campo,
estética profesional de cabecera de blog, 1200x630
```

### Gráficos para redes sociales

Imágenes con las medidas de cada plataforma para publicaciones orgánicas.

| Plataforma | Medida principal | Proporción | Notas |
|---|---|:---:|---|
| X (Twitter) | 1200×675 | 16:9 | Tarjeta grande |
| LinkedIn | 1200×627 | 1,91:1 | Imagen del feed |
| Instagram, publicación | 1080×1080 | 1:1 | Cuadrada; 1080×1350 (4:5) también funciona muy bien |
| Instagram, historias | 1080×1920 | 9:16 | Pantalla vertical completa |
| Facebook | 1200×630 | 1,91:1 | Imagen de enlace compartido |

Las medidas de las plataformas cambian; si el dueño o el calendario de contenido dicen otra, manda la de ellos, y las reglas de cada red están en `crear_borrador` (te avisa si algo no cumple).

**Flujo:**
1. Crea el concepto en la resolución más alta que necesites.
2. Saca las variantes por plataforma (cambio de tamaño mágico en Canva, recorte manual, o pide cada formato al Estudio con la imagen original como referencia).
3. Añade textos encima (con un modelo fuerte en tipografía o en un editor), si hacen falta.
4. Entrega cada formato en su medida.

### Maquetas de producto y capturas

Para mostrar un producto digital en contexto. Los modelos inventan interfaces: no los uses para esto.

1. **Pide capturas reales** del producto, a doble resolución (2x).
2. **Enmárcalas en un dispositivo:** navegador, portátil o celular.
3. **Añade contexto:** flechas, etiquetas de funciones, comparaciones antes/después.
4. **Anota con código** (HTML/CSS) si hay un editor o un desarrollador que lo haga; tú propones el diseño de la anotación.

**Si el negocio es físico:** el equivalente son fotos reales del producto en uso (la silla en una sala, el plato en la mesa, el trabajo terminado antes y después). Pide esas fotos al dueño y mejóralas con presets en vez de generar el producto desde cero.

### Banners de perfil y de fichas

Banners para perfiles, directorios, fichas de mapas y páginas de mercado: suelen ser la primera impresión. Reglas cortas: poco texto, lo importante al centro (los bordes se recortan distinto en cada dispositivo), producto o lugar real a la vista, marca consistente, y probarlo en su tamaño real. Las medidas por plataforma (LinkedIn, X, Product Hunt, G2, GitHub, Google Play, ficha de Google Business Profile, portada de Facebook) y el flujo completo están en la referencia `banners-y-activos-de-marca`. Pide siempre las medidas vigentes a la plataforma o al dueño: cambian.

### Activos de marca

Logos, iconos e ilustraciones: la IA tiene límites. **El logo nunca se genera con IA** (sale inconsistente y no es vectorial): se diseña o se encarga. Un icono de app o una ilustración pueden empezar como concepto generado y se terminan en una herramienta de diseño. Los favicons se derivan del logo y los iconos de redes son los oficiales de cada plataforma. Tabla completa en `banners-y-activos-de-marca`.

---

## Optimización para la web y imágenes OG

Cada imagen de un sitio afecta su velocidad, el SEO y las ventas. Lo esencial: **WebP por defecto con JPEG o PNG de respaldo, ajustar al tamaño real de pantalla, comprimir (75–85 % en fotos; menos de 200 KB en portadas), carga diferida, `width` y `height` explícitos, texto alternativo descriptivo y un nombre de archivo claro.** No ejecutas comandos: entregas la lista de lo que hay que hacer con cada imagen a quien administre la web.

Para que un enlace compartido se vea bien hace falta una imagen **OG de 1200×630** con sus etiquetas (`og:image`, `og:image:width`, `og:image:height`, `twitter:card` = `summary_large_image`, `twitter:image`). La guía de formatos, la lista de revisión completa, las etiquetas listas para pegar y las opciones para generar imágenes OG por código o con complementos de Shopify y WordPress están en la referencia `optimizacion-web-y-og`.

---

## Errores comunes

1. **Usar IA para capturas de la pantalla del producto:** los modelos inventan interfaces; usa capturas reales.
2. **Saltarse la optimización:** las imágenes sin optimizar son lo que más frena una página.
3. **No tener imagen OG:** un enlace compartido sin vista previa se ve roto.
4. **Proporción equivocada:** revisa las medidas de la plataforma antes de generar.
5. **Imágenes con mucho texto sin un modelo fuerte en tipografía:** la mayoría de los modelos destrozan el texto; usa uno adecuado o añade el texto aparte.
6. **Generar sin dirección de estilo:** «fotorrealista», «ilustración plana» o «render 3D» cambian todo el resultado.
7. **Visuales de marca inconsistentes:** usa referencias o plantillas de diseño para mantener la coherencia.
8. **Imágenes enormes en las páginas de venta:** comprime, ajusta el tamaño y usa carga diferida.
9. **Fingir el producto:** una foto inventada de un producto real que el cliente luego no recibe así es un reclamo seguro. Mejora la foto real; no la sustituyas.

---

## Preguntas propias de este encargo

1. ¿Qué tipo de imagen necesitas? (portada, gráfico de redes, maqueta, banner, activo de marca)
2. ¿Para qué plataforma o lugar? (esto fija las medidas)
3. ¿Hay activos de marca que respetar? (colores, tipografías, logo, guía de estilo, fotos reales)
4. ¿Es única o una plantilla que se repetirá?
5. ¿Hay algún motor del Estudio encendido y un tope de gasto?
6. ¿Hay que optimizarla para la web?

---

## Cómo entregarlo

Una entrega por encargo, en Markdown:

1. **Resumen:** qué imagen es, para dónde va y el enfoque elegido en una frase, con el porqué.
2. **La(s) imagen(es):** el archivo del Estudio (enlace) o, si no se pudo generar, el pedido exacto listo para pegar, con el modelo recomendado y su costo estimado.
3. **Ficha técnica:** medida, proporción, formato, peso objetivo, texto alternativo y nombre de archivo sugerido.
4. **Variantes:** una tabla con las otras medidas que se necesitan y cómo se sacan.
5. **Texto en la imagen:** el texto exacto (titular corto) y, si va encima, dónde queda.
6. **Qué falta del dueño:** fotos reales, logo, aprobación del costo, capturas.
7. **Estado:** borrador para el visto bueno del dueño. Nada se publicó ni se subió.

## Reglas

- Nunca uses IA para pantallas de un producto digital ni para fingir un producto, un local o una persona real: pide la foto real.
- Nunca pongas en una imagen un precio, un descuento, una cifra de clientes o un testimonio que no salga de las cifras de la empresa o del Cerebro.
- Un titular dentro de la imagen, de 3 a 5 palabras como máximo; lo demás, como superposición.
- Indica siempre la proporción y la medida.
- Revisa el costo estimado y los topes del Estudio antes de generar en lote.
- Entrega borradores: publicar, subir a una web o a una red lo aprueba el dueño (si hay calendario de contenido, usa `crear_borrador`).
- Los logos no se generan con IA: se diseñan o se encargan.

## Referencias

- `banners-y-activos-de-marca`: medidas de banners, portadas y fichas (LinkedIn, X, Product Hunt, G2, GitHub, Google Play, mapas), buenas prácticas y qué activos de marca se pueden generar con IA. Léela cuando el encargo sea un banner, una portada o una ficha.
- `optimizacion-web-y-og`: guía de formatos, lista de revisión de imágenes para la web, etiquetas OG y cómo generar imágenes OG por código o con complementos. Léela cuando la imagen vaya a una web o un blog.
- `guia-de-prompts-imagenes`: cómo escribir pedidos de imagen: estructura, ejemplos por caso (portada, gráfico, producto, banner, ficha), palabras de estilo, luz y composición, consejos por modelo, errores, flujo por lotes, proporciones y ahorro de costo. Léela antes de escribir un pedido que no sea trivial o cuando el resultado salga flojo.

## Habilidades relacionadas

- `creatividad-anuncios`: imágenes para anuncios pagados y sus medidas por plataforma.
- `video-marketing`: video con IA y video programático.
- `redes-sociales`: qué publicar y la estrategia de contenido.
- `conversion-paginas`: dónde colocar las imágenes en una página de venta.
- `auditoria-seo`: SEO de imágenes (texto alternativo, nombres de archivo, carga diferida).
- `tiendas-de-apps`: medidas y optimización de las capturas de las tiendas de apps.
- `directorios`: imágenes de la galería de Product Hunt y de otros directorios.
- `seo-programatico`: imágenes OG por página a escala.
