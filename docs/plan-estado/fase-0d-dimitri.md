# Fase 0d — Dimitri, UX-11 (rama `fase-0d-dimitri-ux11`)

- ✅ **UX-11** — la línea de IA («IA: modelo · consulta la oficina… · cambiar · gasto del mes · 🔒») ya no está en la cabecera del chat de Dimitri.
  - Escritorio y nube (`src/sub.js`): un ⓘ junto al historial abre un popover (`aria-expanded`/`aria-controls`, foco al abrir, Escape y clic fuera lo cierran y el foco vuelve al ⓘ) con modelo, consultas, gasto del mes, privacidad (nube) y «Cambiar el modelo» (nube).
  - Teléfono (`src/movil/vistas/dimitri.js`): el ⓘ es una acción de la cabecera (44 px) que abre una hoja; se quitó también la línea del saludo (decisión E-12 / B15).
  - Alertas reales (`src/dimitri-ia.js`, puro y compartido): gasto pasado del tope (`nivel: 'over'`), modelo de respaldo en uso y último turno fallido por la IA. Punto de color sobre el ⓘ y, una vez (recordado en `ao.sub.ia.dicho`), un mensaje en el hilo. El fallo no duplica mensaje: ya sale como el error del propio hilo y solo da el punto.
  - Servidor (nube): `infoModelo` suma `fallo` y `respaldo`, persistidos en el doc `dimitri-ia-estado` (D1); el módulo anota el fallo de cada turno y lo limpia al contestar bien (`turnoTerminado`).
- Tests: `tests/dimitri-ia.test.mjs` (puro), `cloudflare/tests/dimitri-salas.test.mjs` (último caso), recorrido `scripts/dimitri-ia-recorrido.mjs`.
- Límite honesto: **ningún camino de la nube cambia hoy el modelo de Dimitri por uno de respaldo**; el campo `respaldo` está cableado hasta el ⓘ y probado en lo puro, pero nada lo escribe todavía. En local, la oficina no informa `ia` (el ⓘ dice que la oficina no lo informa); el punto de «falló» sí funciona porque lo detecta la página.
