---
name: video-corto
description: Guion plano a plano y prompts de generación para reels, stories y anuncios en video de PanaClaw
agents: [vid]
---
# Video corto
Úsalo para «un reel», «una story», «guion para un video», «anuncio en video», «prompt para Veo o Sora».

## Antes de escribir
1. Lee `video-corto`, `escenas-visuales`, `voice` y la nota de precios del producto.
2. Tres datos: duración (6 s anuncio, 15 s story, 20–30 s reel) · si lleva voz (la marca no tiene locutor: pregunta si es la voz del dueño, sintética o solo texto) · la única acción que tiene que provocar. Por defecto: sin voz, texto en pantalla, 15 s.

## Pasos
1. Estructura de tres tiempos: el desastre (40 %) · la cifra (35 %) · la salida (25 %, una acción). El primer plano es el problema, nunca el logo.
2. Reparte por duración. 6 s: 0–2,5 escena madre cerrada con el desastre en 4–6 palabras · 2,5–5 la escena abriéndose, la cifra sola · 5–6 negro, símbolo, wordmark y CTA. 15 s: 0–1 negro y un filamento · 1–6 escena en plano general, el desastre en dos líneas · 6–11 plano cerrado, cifra y plazo · 11–14 la escena apagándose, qué NO incluye en una línea · 14–15 negro, símbolo, wordmark, CTA. 25 s: como el de 15, con 5 s para la objeción entre la cifra y el cierre.
3. Un plano = un prompt de generación: sujeto y escena en una frase · MOVIMIENTO (una sola cosa: o se mueve el sujeto o la cámara) · el bloque de estilo literal (del skill de prompts visuales) · Cámara: un movimiento lento, duración, 9:16 con el tercio inferior en negro limpio para el texto · negativos en prosa.

## La forma
Una tabla plano a plano: tiempo · qué se ve · texto en pantalla · movimiento. Debajo, un bloque de código por plano con su prompt. Al final, tres líneas: formato y duración · qué no incluye (no hay cadena de producción de video ni identidad sonora) · qué decidiste por defecto.

## Reglas
- Tiene que entenderse sin sonido.
- El plano de «qué no incluye» no se corta nunca: si falta tiempo, se acorta la apertura.
- Sin transiciones de efecto: corte seco o fundido a negro. Mínimo 2 s por plano. Nada rápido.
- Texto en pantalla: Archivo 600 en versalitas, #FFF7F7, entra por opacidad, una idea por plano; la cifra sola en su plano; nunca texto en #FF1E1E.
- Música, si la hay: instrumental y grave, sin percusión marcada ni efectos de interfaz.
- Sin personas, sin datos inventados, sin emojis. Una sola llamada a la acción; el CTA de WhatsApp sin número.
