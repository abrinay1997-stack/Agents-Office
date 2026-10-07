# App Store (Apple) — especificaciones y pautas oficiales

Datos de developer.apple.com a marzo de 2026. Apple los cambia: si algo es decisivo, verifícalo en la fuente.

## Límites de caracteres

| Campo | Límite | ¿Se indexa para búsqueda? | Notas |
|---|---|---|---|
| Nombre de la app | 30 caracteres (mín. 2) | Sí | Único; sin marcas registradas ajenas, nombres de competidores ni precios |
| Subtítulo | 30 caracteres | Sí | Sin afirmaciones que no se puedan verificar |
| Palabras clave | 100 bytes | Sí (oculto) | Separadas por comas, sin espacios |
| Descripción | 4.000 caracteres | **No** | Solo texto, sin HTML |
| Texto promocional | 170 caracteres | **No** (Apple lo confirmó) | Se cambia sin publicar versión nueva |
| Novedades | 4.000 caracteres | No | Obligatorio en toda versión después de la primera |
| Nombre de compra dentro de la app | 35 caracteres | Sí | Sale en la búsqueda |
| Descripción de compra dentro de la app | 55 caracteres | No | |
| Nombre de evento dentro de la app | 30 caracteres | Sí | Con mayúscula inicial en cada palabra (title case) |
| Descripción corta del evento | 50 caracteres | Sí | Mayúscula solo al inicio |
| Descripción larga del evento | 120 caracteres | No | Mayúscula solo al inicio |

**El campo de palabras clave es de 100 bytes, no 100 caracteres.** Las escrituras no latinas (árabe, chino, japonés, coreano) usan 2–3 bytes por carácter y caben muchas menos palabras. En español, las letras con tilde o la ñ ocupan 2 bytes en UTF-8: cuéntalo.

## Capturas

| Dispositivo | ¿Obligatorio? | Cantidad | Tamaño (vertical) |
|---|---|---|---|
| iPhone 6,9" | **Sí** | 1–10 | 1260 × 2736 |
| iPad 13" | **Sí** | 1–10 | 2064 × 2752 |
| Mac | Si aplica | 1–10 | Hasta 2880 × 1800 (16:10) |
| Apple Watch | Si aplica | 1–10 | Varía por modelo |
| Apple TV | Si aplica | 1–10 | 1920 × 1080 o 3840 × 2160 |
| Apple Vision Pro | Si aplica | 1–10 | 3840 × 2160 |

- Formatos: JPEG, PNG.
- Apple escala solo desde los tamaños base a los dispositivos más pequeños.

## Video de vista previa

- **Cantidad:** hasta 3 por app.
- **Duración:** 15–30 segundos.
- **Tamaño máximo:** 500 MB.
- **Códecs:** H.264 (10–12 Mbps, hasta 30 fps) o ProRes 422 HQ.
- **Audio:** estéreo, AAC 256 kbps o PCM, 44,1/48 kHz.
- **Formatos:** .mov, .m4v, .mp4.
- **Comportamiento:** se reproduce solo y sin sonido en la ficha (iOS 11+).

## Páginas de producto personalizadas (CPP)

- **Máximo:** 70 páginas adicionales (más la predeterminada).
- **Se personalizan:** capturas, texto promocional, videos de vista previa, enlaces profundos (iOS 18+).
- **Palabras clave:** cada combinación debe ser única de una sola CPP.
- **Revisión:** se envían a revisión aparte de las actualizaciones de la app.
- **Búsqueda orgánica:** aparecen en resultados orgánicos desde julio de 2025.
- **Rendimiento:** +2,5 puntos porcentuales de conversión en promedio frente a la predeterminada.

## Optimización de la página de producto (pruebas A/B)

- **Variantes:** hasta 3 contra la original.
- **Se prueban:** iconos, capturas, videos.
- **No se prueban:** título, subtítulo, descripción, palabras clave.
- **Pruebas simultáneas:** 1 por app.
- **Duración máxima:** 90 días.
- **Iconos:** todas las variantes deben estar dentro de la versión publicada de la app.
- **Confianza:** Apple recomienda un umbral de 90 % (método bayesiano).
- Una prueba **no se puede modificar** una vez empezada.

## Eventos dentro de la app

- **Aprobados a la vez en App Store Connect:** 15.
- **Publicados a la vez en la tienda:** 10.
- **Duración máxima:** 31 días por evento.
- **Promoción previa:** hasta 14 días antes del inicio.
- **Tipos de insignia:** Desafío, Competencia, Evento en vivo, Actualización importante, Nueva temporada, Estreno, Evento especial.

**Imagen de la tarjeta:** 16:9, mín. 1920×1080, máx. 3840×2160.
**Imagen del detalle:** 9:16, mín. 1080×1920, máx. 2160×3840.

**No sirven para:** tareas diarias repetitivas, rebajas de precio sin contenido nuevo, campañas genéricas de notoriedad.

## Calificaciones y reseñas

- **Diálogo del sistema para pedir reseña (SKStoreReviewController):** máximo 3 veces cada 365 días.
- El sistema decide cuándo mostrarlo (puede mostrar menos de 3).
- No uses botones propios para pedir reseñas.
- Se puede responder a todas las reseñas desde App Store Connect.
- La calificación resumida es por país.

## Motivos de rechazo por metadatos (pautas de revisión)

| Pauta | Motivo |
|---|---|
| 2.3.1 | Funciones ocultas, marketing engañoso, precios falsos |
| 2.3.2 | No informar las compras dentro de la app en descripción o capturas |
| 2.3.3 | Capturas que no muestran la app en uso (solo pantalla de inicio o de acceso) |
| 2.3.4 | Videos con contenido que no es de la app |
| 2.3.5 | Categoría equivocada |
| 2.3.7 | Relleno de palabras clave: marcas ajenas, competidores, precios, términos irrelevantes |
| 2.3.8 | Metadatos no aptos para todo público (deben ser 4+) |
| 2.3.10 | Nombres o imágenes de otras plataformas (Android, etc.) |
| 2.3.12 | «Novedades» genéricas para cambios importantes |
| 2.3.13 | Metadatos de eventos inexactos |

Fuentes: developer.apple.com/app-store/product-page/, developer.apple.com/app-store/search/, developer.apple.com/app-store/review/guidelines/
