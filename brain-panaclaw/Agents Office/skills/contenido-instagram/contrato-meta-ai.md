# Contrato para el prompt maestro de Meta AI (resumen)

Orden del prompt: 1 QUÉ ERES Y QUÉ NO HACES · 2 EL SISTEMA VISUAL · 3 EL CONTRATO DEL HTML · 4 EL BLOQUE DE ESTILO (literal) · 5 LOS NEGATIVOS (literal) · 6 LAS PIEZAS · 7 ANTES DE DEVOLVER (repite la prohibición).

Prohibición, literal al principio y al final:
«No escribas, no redactes, no completes, no acortes, no traduzcas y no "mejores" ningún texto. Todo el texto ya está escrito más abajo. Cópialo carácter por carácter, con sus tildes, sus eñes y sus puntos finales. No añadas ninguna cifra, porcentaje, estadística, plazo, testimonio ni beneficio que no esté escrito literalmente.»

Sistema visual: fondo #100101 · texto #FFF7F7 · secundario #BABABA · acento #FF5100 · #FF1E1E solo en fondos. Fuentes de Google Fonts: Antonio 700 (titular y cifra) y Archivo 300/400/500/700 (lo demás).
Lienzo 1080×1350. Márgenes x=72. Símbolo 88×72 centrado, borde superior en y=96. Wordmark PANACLAW. con punto naranja, línea base en y=1254. Anclajes del bloque: alto y=248 (6–8 líneas), medio centro óptico y=594 (3–5), bajo base y=1112.
Escala: titular XL 132 px (2–3 líneas), L 112 (4–5), M 92 (6–8), interlínea base 0.88/0.88/0.90, tracking −0.01em · antetítulo Archivo 500 24 px #FF5100 · bajada Archivo 300 30 px #BABABA · nota Archivo 400 20 px · cifra Antonio 700 76 px.
Orden del bloque: antetítulo · titular · bajada · cifra · nota. La cifra nunca va antes del titular.
Interlínea línea a línea (se entrega resuelta en cada par): avance = base + 0.34 si la línea de abajo lleva Á É Í Ó Ú (0.27 Ñ, 0.25 Ü) + 0.24 si la de arriba lleva coma (0.22 Q, 0.20 ¿, 0.18 ¡).
Velo: brillo de la imagen 0.55–0.75; degradado de rgba(16,1,1,0.92) a rgba(16,1,1,0.10) desde el borde del texto. Ninguna caja detrás del texto.

Símbolo, literal (nunca descrito):
<svg width="88" height="72" viewBox="0 0 100 81.56"><path fill="#FF5100" fill-rule="evenodd" d="M73.43 28.64L54.69 50.19L42.73 77.94L67.38 50.63L67.45 47.83L68.19 44.36Z M81.03 21.85L73.95 28.93L85.68 40.52L67.9 58.38L75.2 65.76L100 40.52Z M74.61 15.5L74.39 15.5L73.8 16.09L73.65 16.39L73.28 16.61L72.69 17.2L72.62 17.42L67.6 22.44L67.6 22.59L72.1 27.01L72.25 27.01L79.19 20.08Z M25.17 15.35L0 40.3L25.39 65.32L32.32 58.16L14.32 40.37L32.18 22.36Z M59.26 1.77L32.69 28.79L32.62 31.52L31.59 36.31L26.64 51.74L45.68 29.75L50.41 19.41Z M75.94 0.15L52.18 27.24L50.85 31L41.62 43.62L23.91 81.56L48.12 52.55L49.89 47.98L59.04 35.65Z"/></svg>
En el lienzo de exportación, el mismo trazado como Path2D, ctx.scale(0.88, 0.88) en los dos ejes y ctx.fill(SIMBOLO, "evenodd"). fill, nunca stroke.

HTML: lista vertical de publicaciones (no rejilla). Vista previa a 480 px: la pieza se construye a 1080 y se escala calc(480/1080) dentro de un marco 480×600 con overflow:hidden y transform-origin top left. Botón de descarga PNG por pieza (canvas 1080×1350) y descarga una por una. Debajo, descripción y hashtags seleccionables con botón «Copiar descripción» (con respaldo execCommand). Carrusel: primero la tira a escala 0.2 pegada, luego cada diapositiva. El prompt del fondo no va en el documento.
El prompt completo y las nueve trampas del exportador: PanaClaw-WorkSpace/prompts/plataformas/meta-ai.md (manda sobre este resumen).
