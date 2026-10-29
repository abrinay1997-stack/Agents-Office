# Carril H — estado

- ✅ **N0.0 (D06) — un único `emitirAviso()`** (rama `carril-h-n00-emitir-aviso`).
  - `cloudflare/worker/lib/avisos.js` es el único que escribe avisos: `emitirAviso`, `emitirAvisos` (lote, destino `filas` por defecto o `doc` para `notices`), más `leerAvisos`, `leerAvisosDoc`, `marcarAvisosLeidos`, `marcarAvisosDocLeidos`. `avisar()` queda como alias.
  - Refactorizados: `lib/tareas/sesion.js` (volcado en lote), `lib/agentes/ejecutor.js`, `lib/contenido/servicio.js` y `lib/anuncios-nube.js` (doc `notices`), `modulos/agentes.js` (leer / marcar leídos) y `lib/salud.js` (lectura de las dos tablas).
  - Test: `cloudflare/tests/emitir-aviso.test.mjs` (mismo aviso que antes por emisor + grep estructural que falla si aparece un escritor directo).
- ⬜ Tabla `notificaciones` y su poda: es N0 (cimientos), no N0.0. No se creó migración.
