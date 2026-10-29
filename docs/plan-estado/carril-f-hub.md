# Carril F · CON-12 / PER-06 (difusión del reloj por el Hub)

Rama `mejora/ola3-f-hub-dirigido`. Sin migración, sin flag.

- ✅ `avisarDelReloj(env, area)` (`cloudflare/worker/lib/vivo.js`): una señal `{tipo:'cambio', area, nombre:'', por:{id:null}}` por el Hub; solo áreas de la lista blanca y no `soloAdmin`. Sin texto ni ids de piezas. Es difusión general por área (no dirigida por persona): Contenido es visible para todos los roles que ya reciben `contenido`, y no usa `para:[userIds]` (contrato del Hub intacto).
- ✅ El reloj avisa solo si hubo cambio: `modulos/contenido.js` (`tick.acciones` o `cambios` > 0) y `modulos/bandeja.js` (`nuevos` > 0). Las escrituras por HTTP ya avisaban (`avisarCambio`).
- ✅ Página: `nube.js` despacha `ao:contenido-cambio`; `src/contenido.js` relee (con 800 ms de espera) y, con el socket `conectado`, su sondeo pasa de 20 s a 60 s. Sin socket (local o caído) sigue a 20 s.
- Bytes de la página: +442 B (2.055.817 → 2.056.259).
- Archivos: `cloudflare/public/nube.js`, `src/contenido.js`, `worker/lib/vivo.js`, `worker/modulos/{contenido,bandeja}.js`, `cloudflare/tests/vivo-reloj.test.mjs`.
- No verificado: socket real en producción (solo Hub falso y la prueba de texto de la página).
