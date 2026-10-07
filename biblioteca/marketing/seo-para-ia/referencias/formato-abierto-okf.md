# Open Knowledge Format (OKF)

La especificación v0.1 de Google, en markdown, para representar el contenido de un sitio como un paquete legible por agentes. Se presentó en el [blog de Google Cloud](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing) el 12 de junio de 2026 y viene dentro de Knowledge Catalog.

## Qué es

OKF es una carpeta de archivos markdown enlazados entre sí. Cada archivo tiene:

- Un bloque de cabecera YAML (`type` obligatorio; `title`, `description`, `resource`, `tags` y `timestamp` recomendados).
- Un cuerpo en markdown normal.
- Enlaces markdown normales a otros archivos del paquete (la especificación los trata como relaciones entre conceptos).

Un `index.md` opcional lista los archivos para que el agente vea la forma del paquete antes de abrir cada uno. El paquete puede distribuirse como repositorio git (lo recomendado), un archivo comprimido o una subcarpeta de un repositorio mayor.

La [especificación completa](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/HEAD/okf/SPEC.md) cabe en una página. El repositorio está bajo `GoogleCloudPlatform` (el aviso «no es un producto oficial de Google» es el texto estándar de sus repositorios de código abierto, no una negativa).

### Un archivo de concepto mínimo

```markdown
---
type: Article
title: Cómo conectar el servidor MCP de Ahrefs a Manus
description: Los servidores MCP oficiales, por qué no conectaban y la solución.
resource: https://tusitio.com/blog/ahrefs-mcp-manus/
tags: [mcp, ahrefs]
---

# Cómo conectar el servidor MCP de Ahrefs a Manus

El cuerpo del artículo, como markdown limpio.
```

Agrega un `index.md` que liste todos los archivos para que un agente vea la forma del paquete antes de abrirlos. Ese es todo el formato.

## Con honestidad

**Google creó OKF para que los equipos de datos compartan metadatos de catálogo**: tablas, endpoints de API, métricas, procedimientos. Casi todos los ejemplos de la especificación son de equipos de datos, no de blogs. El mensaje de Google: «mejorar el intercambio de datos» y «documentación estandarizada» para colaborar entre equipos.

Aplicar OKF a un sitio de marketing es un **reaprovechamiento ingenioso**, popularizado por [Suganthan Mohanadasan](https://suganthan.com/blog/open-knowledge-format/). Es un uso legítimo, pero no el principal de Google. Preséntalo así cuando se lo expliques a un dueño o a un equipo de marketing.

## Qué hace hoy por la búsqueda con IA

Nada inmediato. Nada rastrea la web en busca de paquetes OKF todavía: la especificación tiene semanas, ningún motor de IA anunció integración y Knowledge Catalog solo ingiere paquetes de equipos de datos de clientes empresariales de pago.

Trátalo como **registro a nivel de protocolo**: la misma apuesta que fue adoptar `schema.org` temprano hace una década. Schema tardó casi diez años en rendir; quienes lo adoptaron pronto aún se alegran.

Un beneficio secundario que sí rinde hoy: **generar el paquete es en sí una auditoría de enlaces internos.** La herramienta de Suganthan dibuja cada página como un nodo y cada enlace interno como una arista, y las islas y páginas huérfanas se ven de un vistazo.

## Dónde encaja en la pila legible por agentes

| Capa | Para qué sirve |
|---|---|
| `sitemap.xml` | Dice a un rastreador qué direcciones existen |
| `robots.txt` (con reglas para bots de IA) | Permite o bloquea rastreadores de IA |
| `llms.txt` | Señala a un agente las pocas páginas que más quieres que lea |
| `/pricing.md` | Precios estructurados para que un agente comprador compare |
| **Paquete `/okf/`** | Entrega el contenido mismo como conceptos enlazados |
| Datos estructurados (schema) | Datos por página (Article, FAQPage, Product, etc.) |

Se apilan, no compiten. `llms.txt` es un letrero; OKF es la biblioteca.

## Cómo publicar uno

Tres opciones, de menos a más trabajo (las hace quien administra la web; tú recomiendas y preparas el contenido):

### 1. La herramienta web gratuita de Suganthan (recomendada para la mayoría)

[suganthan.com/okf-generator](https://suganthan.com/okf-generator/): pegas una dirección o un sitemap, rastrea hasta 100 páginas y devuelve un paquete descargable. También dibuja el grafo de páginas para ver las desconectadas antes de publicar.

### 2. Plugin de WordPress (pendiente de aprobación en wp.org al momento de escribir)

El plugin de Suganthan (gratuito, GPL) se instala en un minuto, sirve el paquete en `/okf/` y se reconstruye con cada publicación o edición. Pide WordPress 6.0+ y PHP 7.4+. Es de solo lectura: nunca edita entradas ni ajustes.

### 3. A mano

Solo práctico para un puñado de páginas. Cada entrada se vuelve un archivo markdown con cabecera y enlaces manuales. Penoso para un sitio entero. Si el dueño lo pide, puedes redactar tú los archivos del paquete como texto en tu entrega, uno por página.

## Alojamiento y descubrimiento

Sirve el paquete en `tusitio.com/okf/`, empezando por `tusitio.com/okf/index.md`:

- **Alojamientos estáticos / Cloudflare:** arrastrar y soltar.
- **WordPress:** el plugin se encarga.
- **Sitios estáticos con rutas propias:** sube la carpeta a `/okf/`.
- **Plataformas cerradas (Wix, Squarespace, la mayoría de constructores de páginas, tiendas en línea alojadas):** normalmente no se pueden servir archivos en rutas propias; sáltate OKF.

Cuando ya esté sirviéndose, agrega una línea en `llms.txt` que apunte al paquete, para que los agentes que leen `llms.txt` (hoy) puedan descubrirlo (más adelante).

## Cuándo saltárselo

- El sitio tiene menos de 10 páginas: el esfuerzo supera el beneficio.
- El sitio está en una plataforma cerrada que no permite rutas propias.
- No mantienes `llms.txt`, datos estructurados ni otros archivos legibles por máquina (OKF suma con ellos; solo, no hace nada).
- No puedes dedicar 30 minutos al trimestre a refrescar el paquete cuando cambie el contenido.

## Qué vigilar

OKF está en v0.1, con semanas de vida. Vale seguirlo, no obsesionarse:

- Si Google anuncia soporte de OKF en AI Overviews o el Grafo de Conocimiento (hoy, ninguna señal).
- Si motores que no son de Google (ChatGPT, Perplexity, Claude) anuncian lectura de OKF.
- Si la especificación pasa a v1.0 (puede haber cambios que rompan antes de 1.0).
- Si Knowledge Catalog agrega puntos de ingesta públicos.
- Señales de adopción: busca en GitHub `okf/index.md` para ver quién publica paquetes.
