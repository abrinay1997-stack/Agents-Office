---
name: blog-seo
description: Un post del blog de PanaClaw para SEO, listo para src/content/blog/ del sitio
agents: [newt]
---
# Post del blog para SEO
Úsalo para «escribe un post sobre X», «el próximo artículo del blog», «qué blog toca este mes», «un artículo para posicionar [búsqueda]». No para Instagram, anuncios ni fichas de producto.

## Antes de escribir
1. Lee `blog-publicado`: ningún tema nuevo comparte el ángulo central de uno existente, aunque cambie el titular. Si el tema pedido ya está cubierto, dilo y ofrece el ángulo libre más cercano.
2. Lee `publicos`, `prueba-verificable`, `deuda-conocida` y la nota de precios del producto al que enlaza el cierre.
3. Datos que hacen falta: el tema (o elígelo tú), la categoría (precios, guias, comparativas, casos, panama) y el público. Por defecto: la categoría con menos posts (casos está bloqueada), el público que no se tocó en el último post, lectura de 5–7 minutos.

## Pasos
1. Escribe el tema como lo buscaría un dueño de negocio panameño en Google, no como un titular de marca. Sale de una situación de `publicos` o de las tres cosas contra las que se define la marca (la agencia que se queda tu sitio, el WordPress que se rompe solo, el mes y medio que se convierte en tres).
2. Comprueba que el ángulo no necesita un dato que no existe. Si necesita una estadística de mercado, de la competencia o una métrica de proyecto que no está en `prueba-verificable`, ese ángulo no se escribe: busca otro o di qué falta.
3. Escribe el frontmatter con el contrato de `contrato-blog.md` (al lado de este archivo). Cuenta los caracteres.
4. Escribe el cuerpo: lead de 1–2 párrafos con la escena o la pregunta tal cual se busca (nunca «en este artículo…», nunca abriendo por el precio o la marca) · de 4 a 8 H2, cada uno una pregunta real que se hace quien buscó esto (nunca «Introducción» ni «Conclusión») · cierre de un párrafo, «Cómo lo hacemos en PanaClaw», con enlace interno a una ruta real.
5. Método: escribe largo, recorta una sola vez lo que no trabaja, léelo en voz alta.

## La forma
Un solo bloque de código Markdown con frontmatter y cuerpo, listo para guardarse como `src/content/blog/<slug>.md`. Debajo, tres líneas: título, categoría y público · qué no incluye o qué ángulo cambiaste y por qué · qué decidiste por defecto.

## Reglas
- Ninguna llamada a la acción a mitad del cuerpo: la plantilla del sitio pone la tarjeta del cotizador al final.
- Única estadística de sector permitida, con atribución en la misma frase: cuatro de cada diez personas abandonan una página que tarda más de tres segundos (dato del sector, no medición nuestra).
- Nada sobre cómo cobra o se comporta la competencia. Nada de casos anecdóticos sin fuente.
- Toda cifra de PanaClaw de las notas de precios; único y mensual nunca sumados.
- Enlaces solo a rutas reales: /planes/, /cotizador/, /servicios/#diagnostico, /servicios/#care, /proyectos/, /ebot/, /seguridad/, /contacto/ o /blog/<slug>/ de un post existente.
- De tú y en «nosotros» plural (sin voseo: nada de «querés» o «tenés»).
- Cero jerga técnica.
- Se publica solo con la aprobación del dueño.
