# Optimización web e imágenes OG

## Optimización de imágenes para la web

Cada imagen de un sitio afecta la velocidad de la página, y eso afecta el SEO y las ventas.

### Guía de formatos

| Formato | Mejor para | Compresión | Compatibilidad |
|---|---|---|:-:|
| **WebP** | Fotos y gráficos: la opción por defecto | Con y sin pérdida | ~96 % |
| **AVIF** | La máxima compresión, el más nuevo | Mejor que WebP | ~94 % |
| **JPEG** | Respaldo para navegadores viejos | Solo con pérdida | Universal |
| **PNG** | Transparencia y capturas | Sin pérdida | Universal |
| **SVG** | Logos, iconos e ilustraciones | Vectorial (escala) | Universal |

### Lista de revisión

- [ ] **Servir WebP** con JPEG/PNG de respaldo (elemento `<picture>` o formato automático de la CDN)
- [ ] **Ajustar al tamaño de pantalla:** no servir 4000 px en un contenedor de 800 px
- [ ] **Comprimir:** calidad de 75 a 85 % en fotos; casi sin pérdida en capturas
- [ ] **Carga diferida** de lo que está bajo el primer pantallazo (`loading="lazy"`)
- [ ] **Dimensiones explícitas:** los atributos `width` y `height` evitan que la página salte (CLS)
- [ ] **Usar una CDN** con optimización automática (Cloudflare, Vercel, Imgix, Cloudinary)
- [ ] **Texto alternativo:** descriptivo, con la palabra clave si encaja, sin llenarlo de claves
- [ ] **Nombre de archivo** claro (`arreglo-de-frenos-ciudad.webp`, no `IMG_4821.webp`)

### Cómo se hace

No ejecutas comandos. Entrega al dueño o a quien administre la web la lista de lo que hay que hacer con cada imagen (formato, medida, peso objetivo, texto alternativo, nombre de archivo). Si hace falta una herramienta, nómbrala como opción: `cwebp` o ImageMagick en una computadora, un plugin de optimización en WordPress o Shopify, o la optimización automática de la plataforma. En el Estudio, las imágenes se entregan en el formato del modelo; para convertir y recortar, la oficina tiene los presets de exportación.

## Imágenes OG y de vista previa social

La imagen que aparece cuando se comparte tu enlace en redes, WhatsApp, Slack o Discord.

### Etiquetas necesarias

Se las entregas a quien edite la web (o al dueño) tal cual:

```html
<meta property="og:image" content="https://tusitio.com/og/nombre-de-pagina.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://tusitio.com/og/nombre-de-pagina.jpg" />
```

### Imágenes OG dinámicas

Para páginas con contenido dinámico (entradas de blog, perfiles, fichas de producto), se pueden generar por código:
- **Vercel OG** (`@vercel/og`): genera imágenes en el borde con JSX.
- **Satori:** convierte HTML/CSS a SVG (es lo que usa Vercel OG).
- **Cloudinary:** superposición de texto por URL sobre una imagen plantilla.

**Ideal para SEO programático** (`seo-programatico`): imágenes OG únicas por página con una plantilla más datos dinámicos. Tú diseñas la plantilla (qué lleva, dónde, qué tamaño de letra); la instalación la hace quien administre la web. Si la tienda o el blog usan Shopify, WordPress o similar, hay complementos que hacen lo mismo sin programar.

