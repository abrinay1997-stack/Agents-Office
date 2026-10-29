# Carril C · Fase 2 — conversión universal de imágenes (CON-02/03/13)

Rama `fase-2-conversion-imagenes` (independiente de #71). Sin flag, sin migración. Delta de página: +1.599 B.

- ✅ `media/formatos-imagen.mjs`: UNA lista de formatos (galería / convertibles al entregar / convertibles al subir), avisos por archivo, `prepararSubida`.
- ✅ Navegador (`src/imagen-jpeg.js`, usado en `src/studio.js`): gif, avif, bmp, tiff y heic/heif → JPEG al subir (EXIF, alfa sobre blanco, ≤ 4096 px); el original no se toca; HEIC solo donde el navegador lo lea, si no, mensaje por archivo.
- ✅ Respaldo del servidor al subir: sharp (local, `serve.mjs`) e `IMAGES` (nube, `modulos/estudio.js`); HEIC se rechaza con motivo.
- ✅ Al entregar a Instagram: png/webp → JPEG con la transparencia sobre blanco (sharp `flatten`; IMAGES `transform({background})`).
- ✅ Aviso al aprobar (modo real), uno por archivo, sin depender del binding (`contenido/rutas-nucleo.mjs`, `puedeConvertir`).
- No verificado: `transform({ background })` y la orientación EXIF de `IMAGES` contra Cloudflare real; el recorrido en navegador real (createImageBitmap con HEIC/AVIF).
