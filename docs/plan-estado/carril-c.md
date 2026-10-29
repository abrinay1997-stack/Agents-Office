# Carril C · Fase 2 — publicar y convertir

Rama `fase-2-publicar-ahora`. Flag: `contenido.publicarYa` (apagado por defecto; local en Ajustes → Contenido, nube en `PUT /api/contenido/config`). Migración: ninguna. Delta de `dist/command-centre-v2.html`: +181 B.

## PR 1 (servidor + puro + tests)
- ✅ CON-04/05 ruta `POST /api/contenido/piezas/:id/publicar-ya` (202, sin deshacer, `confirmado:true`, solo `por` ausente/`dueno`, `SOLO_ADMIN` en la nube, modo real + Meta directo, retira antes lo ya entregado — B05).
- ✅ B02/B06 `aprobada.ya` (único origen del flag), hora = minuto en curso (`ahoraAbajo`), `revisarMomento({ya})`, `planear` sin gracia ni margen durante `YA_VENTANA_MS` (30 min), encolar+entregar en la misma vuelta, `tick({solo})`, `retirarAhora`.
- ✅ B01 test de que Dimitri, el asistente, los agentes y Telegram no lo alcanzan.
- ✅ B07/CON-14 `PROGRAMAR.pronto`/`PRONTO_MIN`/`PRONTO_TXT` en `src/contenido-reglas.js`; test que busca el literal.
- Tests: `tests/contenido-publicar-ya.test.mjs`, `cloudflare/tests/contenido-publicar-ya.test.mjs`.

## Pendiente (PR 2 / PR 3)
- ⏳ UI en `dist/pieza-editor.js` (botón «Publicar ahora», dos pasos, «Publicando…» sondeando la cola) y `d-comun.js` (móvil).
- ⏳ CON-02/03/13 conversión universal (navegador al subir + respaldo `IMAGES`, listas de formatos, HEIC, aviso al aprobar), CON-16, CON-07.

## PR 2 (interfaz de «Publicar ahora», CON-16, CON-07) — rama `fase-2-publicar-ahora-ui`
Sin migración. Flag `contenido.publicarYa` (apagado por defecto). Delta de página: +169 B (solo el aviso de CON-16 en `src/contenido.js`); lo demás va en `dist/pieza-editor.js` y `dist/movil-d.js`.
- ✅ Escritorio (`src/pieza.js`): «Publicar ahora» en «Aprobar ▾», solo con el flag; reemplaza al «Publicar ya» antiguo; primer clic = confirmación con el aviso «No se puede deshacer»; segundo clic = `POST publicar-ya {confirmado:true}`; sondea la cola hasta 2 min («Publicando…»).
- ✅ Móvil (`src/movil/vistas/d-comun.js` + `contenido.js`): hoja de confirmación en rojo y misma ruta.
- ✅ `src/contenido-ya.js` (textos y `motivoNoYa`, compartidos con el servidor; fuera de la página).
- ✅ CON-16: aviso de que Instagram no se borra por API al eliminar una pieza ya publicada (escritorio y móvil).
- ✅ CON-07: el paso marcado sigue el desplazamiento en escritorio (IntersectionObserver en `src/ventana-pasos.js`, re-observa al repintar).
- Tests: `tests/publicar-ya-ui.test.mjs`, `tests/publicar-ya-navegador.test.mjs` (Chromium + oficina real).
