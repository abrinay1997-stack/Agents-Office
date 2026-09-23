# Contrato técnico del blog (schema de src/content.config.ts)

El sitio valida cada post con zod: si un campo no cumple, el build falla.

```yaml
---
title: "…"          # 15–90 caracteres. Es el h1 y el título de la pestaña.
description: "…"    # 60–200 caracteres. Resumen del listado y meta description.
date: AAAA-MM-DD     # Fecha de publicación (hoy, salvo que el dueño diga otra).
category: …          # precios | guias | comparativas | casos | panama
keywords: ["…"]      # De 1 a 6, en minúscula. Deciden los posts relacionados.
readingTime: N        # Entero de 2 a 30 (minutos).
draft: false          # Opcional.
---
```

Slug (nombre del archivo = URL panaclaw.com/blog/<slug>/): minúsculas, guiones, sin tildes ni eñes, 3 a 6 palabras, que no repita uno existente.

Categorías:
- precios: cuánto cuesta algo y por qué.
- guias: cómo decidir, cómo elegir, qué preguntar.
- comparativas: una opción contra otra, sin bando.
- casos: un proyecto propio. BLOQUEADA hasta que los proyectos tengan reto, solución y métricas medidas. Si se escribe de un proyecto, sin cifra de resultado y avisando que es una ficha a medias.
- panama: contexto local (Yappy, ley de datos, dominio .com.pa).

Antes de entregar:
- title, description, keywords y readingTime dentro de rango, contados.
- El slug y el ángulo no repiten nada de `blog-publicado`.
- Lead por la escena o la pregunta; cada H2 una pregunta real.
- Ninguna llamada a la acción a mitad del cuerpo.
- Toda cifra coincide con las notas de precios; la del sector lleva atribución.
- Enlaces a rutas reales.
- Sin jerga, sin voseo, sin emojis, sin exclamaciones.
