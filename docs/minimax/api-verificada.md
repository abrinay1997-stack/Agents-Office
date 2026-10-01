# MiniMax — lo que se comprobó en la documentación oficial (30 sep 2026)

Fuente: la documentación de MiniMax en `platform.minimax.io/docs` (índice: https://platform.minimax.io/docs/llms.txt). Todo lo de abajo se leyó en esas páginas el 30 sep 2026. **Nada se ha probado todavía con una key real** (como Meta y Higgsfield): la primera prueba es `node scripts/check-minimax.mjs` con `MINIMAX_API_KEY` puesta.

Donde la propuesta del dueño (`propuesta-original.md`) dice otra cosa, **manda la documentación**; cada diferencia está marcada con ⚠.

## Común a todo

- Host `https://api.minimax.io`, cabecera `Authorization: Bearer <MINIMAX_API_KEY>`.
- Muchas respuestas llegan con HTTP 200 y `base_resp: { status_code, status_msg }`; `status_code` distinto de 0 es un error. La oficina revisa las dos cosas.
- `GroupId`: ninguna de las páginas consultadas lo pide. Queda como opcional (`MINIMAX_GROUP_ID`) por si una cuenta antigua lo exige. **Sin confirmar.**
- Códigos de error (https://platform.minimax.io/docs/api-reference/errorcode.md): 1000 desconocido · 1001 tiempo agotado · 1002 límite de peticiones · 1004 no autorizado · 1008 **saldo insuficiente** · 1024 interno · 1026 entrada sensible · 1027 salida sensible · 1033 sistema · 1039 límite de tokens · 1041 límite de conexiones · 1042 demasiados caracteres invisibles · 1043 falló la comparación ASR · 1044 falló la similitud del clone_prompt · 2013 parámetros inválidos · 20132 voice_id o muestras inválidas · 2037 duración de voz muy corta o muy larga · 2039 voice_id de clonación duplicado · 2042 sin acceso a ese voice_id · 2045 crecimiento de uso limitado · 2048 audio de prompt muy largo · 2049 **API key inválida** · 2056 límite de uso superado.
  - 2038 («sin permiso de clonación: revisa la verificación de la cuenta») no está en esa tabla, pero sí en la página de clonar voz.

## Imagen — `image-01`

https://platform.minimax.io/docs/api-reference/image-generation-t2i.md · https://platform.minimax.io/docs/api-reference/image-generation-i2i.md

- `POST /v1/image_generation` con `{ model: "image-01" | "image-01-live", prompt (≤1500), aspect_ratio, response_format: "url"|"base64", n (1–9), seed, prompt_optimizer, subject_reference? }`.
- `aspect_ratio`: `1:1, 16:9, 4:3, 3:2, 2:3, 3:4, 9:16, 21:9` (por defecto 1:1).
- `subject_reference: [{ type: "character", image_file }]`: solo retratos (una cara); `image_file` es una URL pública o un data URL; **JPG/JPEG/PNG, menos de 10 MB** (⚠ WEBP no: la oficina lo rechaza con un mensaje claro).
- Respuesta: `data.image_urls` (o `data.image_base64`), `metadata.success_count/failed_count`, `base_resp`.
- ⚠ `prompt_optimizer` vale `false` por defecto en la doc; la propuesta lo ponía en `true`. La oficina lo deja como ajuste (por defecto no).
- La oficina pide `response_format: "base64"`: así no hay URL que caduque ni segunda descarga.
- Precio: **US$0,0035 por imagen** (https://platform.minimax.io/docs/guides/pricing-paygo.md). ⚠ La propuesta decía 0,01.

## Video — `MiniMax-H3` y `MiniMax-H3-Max` (API v2)

https://platform.minimax.io/docs/api-reference/video-generation-v2-create.md · …-v2-query.md · …-v2-delete.md · https://platform.minimax.io/docs/guides/video-generation.md

- `POST /v2/video_generation` `{ model, content: [...], resolution, duration, ratio?, extra?: { prompt_expansion_mode: disabled|balanced|quality }, callback_url? }` → `{ task_id }`.
- `content[]`: `{ type: text|image_url|video_url|audio_url, text?, image_url?: { url }, video_url?: { url }, audio_url?: { url }, role? }`. Siempre un `text` no vacío (≤7000 caracteres).
  - `role`: `first_frame`, `last_frame`, `reference_image`, `reference_video`, `reference_audio`.
  - `url`: URL pública, `mm_file://{file_id}` o **data URI** (`data:image/<fmt>;base64,…`). La oficina manda data URI.
  - **Imagen→video y referencia→video se excluyen**: si hay una referencia, no puede haber primer ni último fotograma (y al revés). La oficina, con fotogramas, deja fuera las referencias.
  - Límites: hasta 9 imágenes, 3 videos y 3 audios de referencia (12 archivos en total); cuerpo ≤ 64 MB; imagen ≤ 30 MB, lado 256–5760 px, proporción 2:5–5:2.
- `MiniMax-H3`: 768P o 2K, 4–15 s. `MiniMax-H3-Max`: 480P o 768P (por defecto 768P), 5–15 s. `ratio`: `adaptive` (por defecto), `21:9, 16:9, 4:3, 1:1, 3:4, 9:16`. `duration` es obligatorio.
- `GET /v2/query/video_generation/{task_id}` → `{ task: { id, model, status, error?: { code, message }, content: { url }, usage, … } }`. Estados: `queued, running, succeeded, failed, cancelled`. Solo se consultan tareas de los últimos 7 días; la URL caduca (hay que bajarla enseguida o consultar otra vez).
- `DELETE /v2/video_generation/{task_id}`: **cancela una tarea en cola sin cobrar** (en marcha no se puede). ⚠ La propuesta decía que no había cancelación remota; la oficina la usa cuando el trabajo sigue en cola.
- La API v1 (`/v1/video_generation` + `/v1/query/video_generation` + `/v1/files/retrieve`, modelos Hailuo) sigue documentada; la oficina usa la v2 para H3. Hailuo ya está en el Estudio vía Higgsfield y fal.
- Precio (pago por uso): H3 768P **US$0,08/s**, 2K **US$0,13/s**; H3-Max 480P **US$0,05/s**; las primeras 5 (H3) o 2 (Max) imágenes de entrada gratis, después US$0,04 / US$0,074 cada una. ⚠ La propuesta decía 0,05 y 0,03 por segundo. **H3-Max a 768P no tiene precio publicado**: la oficina usa 0,08 como aproximado y lo dice.

## Voz (TTS) — `speech-2.8/2.6/02 hd|turbo`

https://platform.minimax.io/docs/api-reference/speech-t2a-http.md · voces del sistema: https://platform.minimax.io/docs/faq/system-voice-id.md

- `POST /v1/t2a_v2` `{ model, text (<10.000), stream: false, output_format: "hex"|"url", language_boost, voice_setting: { voice_id, speed [0.5,2], vol (0,10], pitch [-12,12], emotion? }, audio_setting: { sample_rate, bitrate, format, channel }, pronunciation_dict?, subtitle_enable? }`.
- Modelos: speech-2.8-hd, speech-2.8-turbo, speech-2.6-hd, speech-2.6-turbo, speech-02-hd, speech-02-turbo, speech-01-hd, speech-01-turbo.
- `emotion`: `happy, sad, angry, fearful, disgusted, surprised, calm, fluent, whisper`. ⚠ La propuesta incluía `neutral`, que no está: la oficina lo deja «automática» (no manda el campo).
- `format`: mp3, pcm, flac, wav, pcmu_raw, pcmu_wav, opus. La oficina ofrece mp3, wav y flac (los que reproduce un navegador). `sample_rate` 8000…44100; `bitrate` solo mp3.
- `language_boost`: 40+ idiomas con el nombre en inglés (`Spanish`, `English`, `Portuguese`…) o `auto`.
- Respuesta: `data.audio` en **hex**, `data.status` (2 = terminado), `extra_info` (`audio_length` ms, `usage_characters`…), `trace_id`, `base_resp`.
- `Spanish_Narrator` existe (y otras 46 voces en español, p. ej. `Spanish_SereneWoman`, `Spanish_CaptivatingStoryteller`, `Spanish_ConfidentWoman`).
- Precio: speech-2.8-hd **US$100 por millón de caracteres**, speech-2.8-turbo **US$60**. La página de precios no lista 2.6: la oficina usa los mismos (aproximado).

## Música — `music-3.0`

https://platform.minimax.io/docs/api-reference/music-generation.md

- `POST /v1/music_generation` `{ model, prompt (1–2000), lyrics (1–3500), is_instrumental, lyrics_optimizer, output_format: "hex"|"url", stream, audio_setting: { sample_rate, bitrate, format: mp3|wav|pcm } }`. Instrumental: `prompt` obligatorio; cantada: `lyrics` obligatorio.
- Modelos: `music-3.0`, `music-2.6`, `music-cover` (de pago) y **`music-3.0-free`, `music-2.6-free`, `music-cover-free` (todos los usuarios, 3 peticiones por minuto)**.
- Aviso de la doc: «desde el 20 de agosto de 2026 las API de pago ya no están disponibles para usuarios nuevos; los que ya pagan siguen». ⚠ Por eso la oficina añade `mmx-musica-3-gratis` (`music-3.0-free`), que cualquier cuenta puede usar.
- Respuesta: `data.audio` (hex), `extra_info.music_duration`…, `base_resp`.
- Precio: US$0,15 por pieza de hasta 5 min según buscadores que citan la página de precios; **no se pudo leer en la página oficial**: aproximado.

## Subir archivos

https://platform.minimax.io/docs/api-reference/file-management-upload.md · https://platform.minimax.io/docs/api-reference/voice-cloning-uploadcloneaudio.md

- `POST /v1/files/upload`, multipart: `purpose` (`voice_clone, prompt_audio, t2a_async_input, video_understanding, video_generation_input`) y `file`.
- Respuesta `{ file: { file_id (int64), bytes, created_at, filename, purpose }, base_resp }`.
- ⚠ `file_id` es un entero de 64 bits (el ejemplo de la doc, 123456789012345680, ya no cabe en un número de JavaScript). La oficina lo lee del texto de la respuesta, sin pasarlo por `JSON.parse`, y lo devuelve igual en el cuerpo de la clonación.

## Clonar voz

https://platform.minimax.io/docs/api-reference/voice-cloning-clone.md

- Audio: mp3, m4a o wav, **10 s a 5 min, ≤ 20 MB**, subido con `purpose: voice_clone`.
- `POST /v1/voice_clone` `{ file_id, voice_id, clone_prompt?, text? (≤1000), model? (obligatorio con text), language_boost?, text_validation?, accuracy (0,7), need_noise_reduction, need_volume_normalization, aigc_watermark }`.
- `voice_id`: 8–256 caracteres, empieza por letra, letras/dígitos/`-`/`_`, no termina en `-` ni `_`, único (2039 si se repite).
- Respuesta: `demo_audio` (URL, solo con `text` + `model`), `input_sensitive`, `extra_info`, `base_resp`. 2038 = la cuenta no tiene permiso de clonar (verificación).
- Las voces clonadas se borran a los **7 días sin uso**. Precio: **US$1,5 por voz** (rapid voice cloning).

## Diseñar voz

https://platform.minimax.io/docs/api-reference/voice-design-design.md

- `POST /v1/voice_design` `{ prompt, preview_text (≤500, obligatorio), voice_id? }` → `{ voice_id, trial_audio (hex), base_resp }`.
- Precio: **US$3 por voz**, más la muestra a US$30 por millón de caracteres.
- La caducidad a los 7 días no está escrita en esta página (sí en la de clonar); la oficina la «fija» igual con un TTS corto.

## Listar y borrar voces

https://platform.minimax.io/docs/api-reference/voice-management-get.md · https://platform.minimax.io/docs/api-reference/voice-management-delete.md

- `POST /v1/get_voice` `{ voice_type: system|voice_cloning|voice_generation|all }` → `{ system_voice: [{ voice_id, voice_name, description[], created_time }], voice_cloning: [...], voice_generation: [...] }`. La oficina lo usa para la lista del sistema, con caché de 12 h, y cae a una lista corta si falla.
- `POST /v1/delete_voice` `{ voice_type: voice_cloning|voice_generation, voice_id }`. Un voice_id borrado no se puede reutilizar. ⚠ La propuesta solo borraba del registro local; la oficina también la borra en MiniMax (si falla, la quita del registro igual y lo dice).

## Lo que NO se pudo confirmar

- Si una cuenta necesita `GroupId` en la URL.
- El precio de H3-Max a 768P, el de speech-2.6 y el de la música (se muestran como aproximados).
- Si `music-3.0-free` tiene otros límites además de 3 peticiones por minuto.
- Cuánto tarda un video H3 de verdad (la oficina consulta cada 6 s y espera hasta 30 min).
- Todo lo anterior, contra la API real: la oficina se probó solo con un MiniMax simulado (`tests/minimax.test.mjs`, `tests/minimax-voces.test.mjs`).
