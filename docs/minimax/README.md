# MiniMax en el Estudio — pedido del dueño (30 sep 2026)

Pendiente: se implementa **después** de la rama `mejora/dimitri-estudio` (Dimitri ⇄ Estudio).

El dueño entregó cinco piezas, guardadas tal cual en `propuesta-original.md`:
1. `minimax.mjs`: el cliente (imagen `image-01`, video H3/H3-Max, TTS `speech-*`, música `music-3.0`, subir archivos, clonar voz y diseñar voz).
2. `minimax-voices.mjs`: el registro de voces en `data/minimax-voices.json`; «fija» cada voz con un TTS corto para que no caduque.
3. `INTEGRACION-media.mjs.md`: los parches para `media.mjs`, `serve.mjs`, `estudio-mcp.mjs` y `office.config.json`.
4. `check-minimax.mjs`: la prueba de humo con una key real.
5. El plan por fases (de la 0 a la 5) y los avisos.

## Hay que reconciliarlo con el código de hoy antes de pegar
- **El audio ya existe** desde V4.8. `store()` ya marca `kind:'audio'` para mp3/wav y la galería ya tiene el reproductor ♪. Los parches 1.4, 2.1 y 2.3 están escritos sobre una versión anterior: solo hay que **ampliar** a flac/m4a y añadir `music`.
- **Ya hay modelos de MiniMax vía Higgsfield** (`minimax-hailuo-2.3`, `minimax-h3`) y **vía fal** (`hailuo-02-fal`). Los directos llevan otros ids (`mmx-*`) y el nombre dice «directo». En `INFO` se distinguen por fabricante y motor.
- **`media.submit` y `budget()`** ahora también los toca la rama de Dimitri (`by:'dimitri'`, `versionOf`, `editModels`). Este trabajo va encima de esa rama ya fusionada.
- **Los detalles de la API se comprueban contra la documentación oficial** antes de escribir (platform.minimax.io / docs de MiniMax): rutas, `content[]` del video v2, estados, `base_resp`, audio en hex, límites de clonación. Lo que no se pueda confirmar se marca «sin probar con una key real», como Meta y Higgsfield.
- **Los tests usan un MiniMax simulado** (como `tests/meta.test.mjs`), nunca la key real. `check-minimax.mjs` va a `scripts/` y su salida a `data/`, que no viaja.
- **Voces:** las rutas `/api/voces/*` y un panel «Voces» en el Estudio que alimente el selector de `voiceId`. Los agentes reciben `generar_voz` y `generar_musica` en `estudio-mcp.mjs`.
- **La música está cerrada a usuarios nuevos desde el 20 de agosto de 2026.** El modelo se muestra igual, y si la API lo rechaza, el error dice por qué.
