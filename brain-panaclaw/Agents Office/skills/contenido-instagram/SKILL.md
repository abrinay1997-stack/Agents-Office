---
name: contenido-instagram
description: El contenido orgánico de Instagram del mes de PanaClaw, listo para que Meta AI monte las piezas
agents: [iggy]
---
# Contenido de Instagram del mes
Úsalo para «el contenido de Instagram del mes», «planeamiento del siguiente mes enfocado en eBot», «las publicaciones con sus descripciones», «el prompt para que Meta me arme las piezas». No para una imagen suelta (PROMPTS VISUALES) ni para pauta (ANUNCIOS).

## Antes de escribir
1. Lee `publicado` PRIMERO: ningún titular de ahí se repite, y las puertas ya gastadas con este público arrancan usadas.
2. Lee `calendario-mensual`, `tipos-publicacion`, `firmas-taglines`, `publicos`, `escenas-visuales` y la nota de precios del producto del mes.
3. Datos que hacen falta (si no, usa los de por defecto): producto del mes (uno) · número de publicaciones (12) · qué no se puede repetir del mes anterior. Por defecto: todo 4:5, 1080×1350; entre 4 y 6 carruseles; llamada a la acción en 4 de 12 como máximo.

## Pasos
1. Fija un público, un ángulo y la firma del mes (la tagline del producto si la tiene; si no, la de marca).
2. Reparte los tipos para 12: 4 cifra publicada · 3 desastre explicado · 3 objeción contestada · 1 frontera · 1 trabajo enseñado (solo si hay un proyecto que encaje; si no, otra cifra, y se dice).
3. Asigna a cada pieza su puerta de entrada: ninguna más de 2 veces y al menos 5 de las 8. Y su altura: 4 consecuencia, 3 hecho, 1 condición por cada 8; como mucho 1 de cada 3 abre por el límite.
4. Escribe cada pieza en este orden: titular (2–8 líneas, cortes escritos por unidad de sentido, un solo tramo en naranja: la afirmación o la cifra, nunca la negación; «eBot» nunca dentro del titular) → antetítulo (la categoría) → cifra y nota del límite si hay cifra o plazo → descripción (primera línea ≤100 caracteres con su emoji al final, cuerpo ≤300 sin emojis, cifra con ⚡, firma con 🌋; total ≤500 sin hashtags) → hasta 6 hashtags concretos.
5. Asigna la escena madre del producto y varía distancia, ángulo, cantidad o momento. Añade los negativos del tema.
6. Carruseles: un solo fondo para todo el carrusel, el mismo antetítulo, anclaje y brillo en todas las diapositivas; los tramos naranjas leídos en orden forman una frase; el sujeto entra en la primera y se detiene en la última.
7. Arma el prompt maestro para Meta AI con `contrato-meta-ai.md` (al lado de este archivo): la prohibición de escribir va primero y se repite al final.

## La forma
Primero, la ficha del mes (público, producto, ángulo, firma, tabla de 12 con tipo · puerta · altura · titular · escena) para que el dueño la apruebe. Después, el prompt maestro completo en un bloque, listo para pegar. Al final, las filas nuevas para añadir a `publicado` (fecha, puerta, titular, escena).

## Reglas
- Claude escribe el 100 % del texto. Meta AI no redacta nada: solo genera fondos y monta el HTML copiando literal.
- Ninguna frase del ADN se copia literal (salvo la tagline). Ningún titular de `publicado` se repite.
- Toda cifra de las notas de precios; único y mensual nunca sumados.
- Emojis solo en la descripción y solo en sus tres articulaciones. Ninguno dentro de la imagen.
- Sin datos inventados, sin testimonios, sin métricas de proyectos.
- Al entregar: cuántas publicaciones, de qué producto y para qué público · qué pieza no se pudo escribir y qué dato faltaría · qué decisión podría querer distinta el dueño.
