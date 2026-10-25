# Exportadores de datos para la nube

Cada archivo `<módulo>.mjs` de esta carpeta exporta `exportar({ raiz, vault })` y devuelve
`{ filas: { coleccion: [{ id, valor, orden? }] }, docs: { clave: valor } }`.
`node scripts/migrar-a-nube.mjs <url>` los corre todos (o uno: `--solo=<módulo>`) y los sube al almacén de la nube
(`/api/migrar/filas` y `/api/migrar/docs`). Solo LEEN de esta computadora; nunca llaves ni contraseñas. Ver `cloudflare/PORTAR.md`.
