# Carril H — estado

- ✅ **N0.0 (D06) — un único `emitirAviso()`** (rama `carril-h-n00-emitir-aviso`).
  - `cloudflare/worker/lib/avisos.js` es el único que escribe avisos: `emitirAviso`, `emitirAvisos` (lote, destino `filas` por defecto o `doc` para `notices`), más `leerAvisos`, `leerAvisosDoc`, `marcarAvisosLeidos`, `marcarAvisosDocLeidos`. `avisar()` queda como alias.
  - Refactorizados: `lib/tareas/sesion.js` (volcado en lote), `lib/agentes/ejecutor.js`, `lib/contenido/servicio.js` y `lib/anuncios-nube.js` (doc `notices`), `modulos/agentes.js` (leer / marcar leídos) y `lib/salud.js` (lectura de las dos tablas).
  - Test: `cloudflare/tests/emitir-aviso.test.mjs` (mismo aviso que antes por emisor + grep estructural que falla si aparece un escritor directo).
- ✅ **N0 cimientos (parte servidor)** (rama `carril-h-n0-cimientos`).
  - Migración reservada: `cloudflare/migraciones/0140_notificaciones.sql` (deshacer: `drop table if exists notificaciones;`).
  - Archivos: `worker/lib/notificaciones.js` (categorías por rol, destinatarios, `proyectar`, `listar`, `marcarLeidas`), `worker/modulos/notificaciones.js` (`GET /api/notificaciones`, `POST /api/notificaciones/leer`, `GET|POST /api/notificaciones/config`), enganche en `lib/avisos.js`, poda en `lib/mantenimiento.js` (leídas 60 d, sin leer 180 d), `CONSERVA_TABLAS`/`CONSERVA_DOCS` en `lib/restablecer.js`, `TABLAS`/`ESCRIBEN` en `tests/auditoria-transversal.test.mjs`.
  - Flags (doc `notificaciones.config`, apagados): `activo` y `lecturaVeResultados` (SEG-04, supuesto del plan: `lectura` ve tareas y calendario, no agentes/Cerebro/anuncios).
  - Delta de bytes en la página: 0 (solo Worker). Test: `cloudflare/tests/notificaciones.test.mjs`.
  - Pendiente: `visto_at`/`entro_at`, preferencias, `para:[userIds]` del Hub, campanita/push (paquete aparte).
