---
name: prompts-visuales
description: Prompts de imagen de PanaClaw (Nano Banana, Grok, Canva) — una pieza, un lote o el fondo de un carrusel
agents: [gfx]
---
# Prompts visuales
Úsalo para «prompts de Nano Banana», «imágenes para la campaña», «creativos», «un lote de 20», «el fondo del carrusel», «variaciones de esta pieza». No para escribir el copy (ANUNCIOS o INSTAGRAM) ni para video (VIDEO CORTO).

## Antes de escribir
1. Lee `sistema-visual` y `escenas-visuales`.
2. Tres datos, y se preguntan si faltan: canal y proporción exactos (feed 1:1, feed 4:5, story 9:16, horizontal 1.91:1) · qué producto es el sujeto · si la pieza lleva texto encima (el texto nunca lo genera el motor). Si piden «40 creativos», pregunta si son 40 piezas distintas o menos piezas en varios formatos. Por defecto: eje producto, 4:5 + 9:16, sin texto.

## Pasos
1. Anatomía del prompt, siempre en este orden: SUJETO (una frase física y concreta) · ESCENA (dónde está, qué hace la luz, qué material) · ESTILO (el bloque literal de `bloque-estilo.md`, al lado de este archivo) · ENCUADRE (proporción y dónde queda el negro limpio) · NEGATIVOS (literal, más los del tema).
2. Usa la escena canónica del producto. Varía solo distancia, ángulo, cantidad o momento.
3. Pide el carril del texto describiendo lo que hay: vertical → «el tercio inferior queda en negro casi puro, limpio y sin detalle, con la incandescencia apagándose antes de llegar a él»; horizontal → los dos tercios izquierdos en negro limpio. Si la pieza lleva símbolo y wordmark, pide primero que los 180 px superiores y los 160 inferiores queden en negro limpio.
4. Lote: el bloque de estilo y los negativos se escriben UNA vez arriba; cada fila lleva solo producto, sujeto + escena y encuadre. Techo realista: 20–35 piezas nuevas; por encima, di cuántas son nuevas y cuántas derivadas.
5. Carrusel: un solo fondo. 2 diapositivas → una imagen 3:2; 3 → una panorámica 21:9 cortada en trozos de 1080 (los cortes, «en el primer tercio y en los dos tercios del ancho», solo con materia continua); 4 o más → cadena de relevo: cada imagen se pide con la anterior delante, avanzando la cámara hacia la derecha.

## La forma
Cada prompt en un bloque de código, completo y listo para pegar, sin huecos. Fuera del bloque, tres líneas: plataforma, proporción, y qué suele salir mal en el primer intento con su corrección (el hueco con detalle, el naranja que se va a amarillo, luz exterior, personas o texto colado).

## Reglas
- Los hex se copian (#100101, #FF5100, #FF1E1E), nunca «negro» o «naranja».
- Sin personas: única excepción, una mano de cristal oscuro descrita dos veces como no humana.
- Sin azul, verde, morado, pasteles ni fondos claros. Sin oficinas, laptops, iconos, logos, gráficos ni texto dentro de la imagen.
- El símbolo nunca se genera ni se describe: se compone después con el SVG literal.
- Seguridad: sin candados ni escudos. eBot: sin robots ni burbujas de chat. Tienda: sin carritos ni bolsas.
- Si piden otra estética (fondo claro, más colorido, gente), no es una variante: es otra marca. Dilo y ofrece la variante autorizada más cercana (fría, densa o íntima).
