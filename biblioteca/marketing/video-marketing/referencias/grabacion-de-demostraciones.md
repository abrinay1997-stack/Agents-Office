# Grabación de demostraciones de producto

Adaptado de una contribución de @klepfish (PR n.º 345).

**Para quién es esta guía:** la oficina no ejecuta código ni controla navegadores. Esta guía es para una persona técnica del equipo (o un proveedor) que va a grabar una demostración guionada y repetible de una función de una aplicación web (registro, inducción, un flujo de ajustes, una interacción en un tablero) manejando la aplicación en un Chromium sin pantalla con Playwright. **Lo que sí hace el agente:** escribir la lista de escenas y subtítulos, el guion de la voz en off, la tarjeta de título y la lista de verificación, y generar la voz con `generar_voz`. El resultado es un MP4 con tarjeta de título, subtítulos por escena, un cursor visible y, opcionalmente, narración con voz sintética.

## Cuándo usar este formato

| Situación | Formato |
|-----------|---------|
| Un flujo de función que volverás a grabar en cada versión | **Grabación guionada dentro de la aplicación** (esta guía) |
| Un recorrido narrado donde importa la personalidad | Grabación de pantalla en vivo (herramientas como Loom, Screen Studio, Tella) |
| Video de portada o de lanzamiento con diseño de movimiento | Programático (Hyperframes/Remotion) sobre capturas de pantalla |
| Explicativo con una persona hablando y cortes a la interfaz | Avatar de IA más grabación de pantalla |
| Demo de ventas hecha a la medida de un prospecto | Grabación en vivo o una herramienta de demos interactivas |

La grabación guionada se paga cuando:
- La interfaz cambia a menudo y necesitas regenerar el video en minutos.
- Quieres corridas idénticas (mismos datos, mismo ritmo, sin temblor de ratón).
- La demostración debe correr sobre una versión local o de pruebas antes del lanzamiento.
- Varios flujos necesitan el mismo aspecto de marca.

Omítela para un video único en el que una grabación humana tomaría diez minutos.

## Implementación de referencia

Los guiones de trabajo del contribuyente (una plantilla de grabador y un narrador) viven en una versión fija del historial del repositorio original (marketingskills, carpeta `skills/feature-demo/scripts`, versión `37cb655`). Requieren Node 18 o superior, Playwright y ffmpeg. Trátalos como una implementación de referencia para copiar y adaptar. El flujo de abajo está escrito para que se pueda reconstruir sin ellos.

## Antes de grabar

Reúne:
1. **Audiencia y producto:** prospectos, clientes actuales, desarrolladores o control de calidad interno. Esto fija el tono de los subtítulos (sin jerga para prospectos, detalle de implementación para desarrolladores) y el ritmo.
2. **URL de entrada y lista de escenas:** una línea por escena. La lista de escenas es también los subtítulos, así que escribe cada línea como el subtítulo que quieres en pantalla.
3. **Estado de sesión:** ¿la demostración empieza con la sesión iniciada? Planea un usuario de prueba más un inicio de sesión programático o cookies inyectadas.
4. **Narración:** por defecto, en silencio con subtítulos. Añade voz solo si se pide.
5. **Marca:** nombre de la app, dominio de demostración para la barra de direcciones falsa, colores del fondo y del acento de la tarjeta de título, logo opcional en SVG. Sácalos del contexto de marketing (`contexto-marketing`) si existe.

## Flujo de grabación

### 1. Levanta la aplicación en local

Ejecuta la aplicación en una dirección estable (p. ej. `http://127.0.0.1:8000`). Sirve cualquier tecnología, porque el grabador solo necesita HTTP y una página que se muestre en Chromium sin pantalla. Ábrela primero en un navegador real y haz el flujo con clics una vez. Lee la sección de trampas antes de tu primera corrida.

### 2. Instala las herramientas

```bash
npx playwright install chromium --with-deps
which ffmpeg || brew install ffmpeg   # o apt-get install ffmpeg
```

### 3. Configura el contexto del navegador

Crea un contexto con:
- `viewport` y `recordVideo.size` del mismo tamaño (1280×800 es un buen valor por defecto).
- `bypassCSP: true` para que no se bloqueen las superposiciones inyectadas.
- `ignoreHTTPSErrors: true` si sirves un certificado autofirmado.
- Un `addInitScript` que inyecte la superposición (barra de subtítulos, insignia de paso, cursor falso) en cada carga de página.

Anota `Date.now()` cuando empiece el contexto. Cada subtítulo registra su desfase desde ese momento, lo que permite alinear la narración después.

### 4. Guiona el flujo en pasos

Envuelve cada escena en una función `step(etiqueta, subtítulo, fn, { modo })` que:
1. Muestra el subtítulo en la barra y registra `{ paso, texto, desfaseMs }` en un arreglo de tiempos.
2. Espera la duración de la narración (ver modos de paso).
3. Ejecuta las acciones de Playwright en `fn`.
4. Si falla, guarda una captura de pantalla con el nombre de la etiqueta para diagnóstico.

Pautas:
- **Subtítulos de 50 a 80 caracteres** se leen bien y mantienen las pausas cortas.
- **Muestra una insignia «PASO N / TOTAL»** para que el espectador sepa cuánto dura la demostración.
- **Restablece el estado del servidor al principio** si la demostración usa una cuenta fija (ver trampas).
- **Usa esperas explícitas** (`waitForURL`, `getByRole(...).waitFor()`) en vez de pausas fijas.

### 5. Haz visible el cursor

Playwright dispara eventos del DOM sin puntero visible, así que el espectador no ve en qué se hizo clic. Inyecta un elemento de cursor falso y envuelve los clics y los rellenos en funciones auxiliares:
- `clickWithCursor(locator)` desplaza el objetivo a la vista, anima el cursor a su centro (~500 ms), reproduce una onda de clic y luego hace clic.
- `fillWithCursor(locator, value)` hace lo mismo y luego escribe.

Mantén los objetivos por encima de la barra de subtítulos para que nunca tape el elemento donde se hace clic.

### 6. Añade una tarjeta de título y el marco del navegador

- **Tarjeta de título:** genera un PNG a cuadro completo con el logo (o un nombre en texto) sobre el fondo de marca con un subrayado de acento. Manténla al inicio del video. También sirve de miniatura. (El agente puede bocetar la tarjeta con `generar_imagen`; el logo real lo pone una persona.)
- **Marco del navegador:** genera una tira de pestañas y barra de direcciones que muestre `dominioDeDemo + ruta` como un PNG aparte y apílalo sobre la grabación con ffmpeg. Así la dirección real de localhost no sale en el video.

### 7. Exporta

Escribe el arreglo de tiempos en un archivo JSON junto al `.webm`. Para una versión silenciosa con subtítulos y marco:

```bash
ffmpeg -y -i recording.webm -i browser-frame.png \
  -filter_complex "[1:v][0:v]vstack=inputs=2" \
  -c:v libx264 -crf 23 out.mp4
```

Recorta los cuadros en blanco del primer pintado al inicio (empieza unos 150 ms antes del desfase del primer subtítulo). Exporta con la proporción de la plataforma de destino.

## Modos de paso

Cada paso elige cuándo suena la narración respecto a su acción. Esto mantiene alineados audio e imagen.

| Modo | Orden | Úsalo para |
|------|-------|------------|
| **before** (por defecto) | Terminan el subtítulo y la narración, luego corre la acción | Transiciones: un clic que navega a otra página |
| **during** | La narración y la acción corren en paralelo; deben terminar las dos | Acciones visibles en el lugar: llenar un formulario, arrastrar, abrir un menú |
| **after** | Corre la acción y luego el subtítulo y la narración | Describir un estado que la acción acaba de producir (poco común) |

**Por qué before es el valor por defecto:** si un clic que navega se dispara temprano, quien habla sigue describiendo la página vieja mientras el espectador ya está en la nueva; todo el video queda desfasado una escena.

**Elegir el modo:**

| Escena | Modo |
|--------|------|
| Clic en un botón y la página navega | `before` |
| Llenar un formulario o escribir en un campo | `during` |
| Omitir o descartar y luego navegar | `before` |
| Pasar el cursor o abrir un menú sin navegar | `during` |
| Llegar a un estado final (tablero, pantalla de éxito) | `during` |
| Clic que abre una ventana que quieres describir | `before` |

Los clips de narración suelen durar de 3 a 7 segundos, mientras las acciones toman de 1,5 a 2 segundos. Con un solo modo fijo para todos los pasos, ambos se desfasan a lo largo de una demostración larga.

## Trampas de las aplicaciones locales

### Las cookies `Secure; SameSite=None` se rechazan por HTTP

Los navegadores no guardan cookies `Secure` por HTTP simple en un servidor que no sea localhost (por ejemplo una IP de la red local o un dominio de desarrollo propio), así que la sesión nunca se queda y cada navegación rebota al inicio de sesión. `http://localhost` suele tratarse como seguro y está bien. Si no, o quitas la marca `Secure` durante la grabación (`SameSite=None` exige `Secure`, así que pasa a `SameSite=Lax` a la vez; suele ser una variable de entorno), o sirves HTTPS con un certificado autofirmado y `ignoreHTTPSErrors: true`.

### Una política CSP estricta bloquea la superposición

Una política `style-src 'self'` sin `unsafe-inline` bloquea los estilos en línea de la barra de subtítulos y del cursor. Mantén `bypassCSP: true` en el contexto.

### Si la aplicación de una sola página falla al arrancar, el video queda en blanco

Una variable de entorno faltante que lanza un error al arrancar (un cliente de tiempo real o de analítica con una clave vacía) deja la página en blanco, y el grabador la graba sin quejarse. Confirma primero que la página se muestra en un navegador real. Recortar el inicio no rescata una página rota.

### El estado se acumula entre corridas

Repetir con una cuenta fija deja filas de más, que vuelven ambiguos los selectores de texto (la nueva opción de la ventana y una tarjeta sobrante coinciden las dos). Añade un restablecimiento al principio del guion que limpie solo las filas que toca la demostración, con la herramienta de tu tecnología (`rails runner`, `php artisan tinker`, una línea de SQL, una llamada a la API de administración). Al invocar comandos del sistema, usa la forma de arreglo de `spawnSync` para que el intérprete no expanda variables. Las demostraciones que registran un correo aleatorio nuevo en cada corrida pueden omitir esto.

### Variables de entorno que apuntan a producción

Algunas sesiones de agentes exportan `DB_HOST` o `DB_PASSWORD` de una base de datos de producción. Cualquier comando de restablecimiento o de carga de datos que herede el entorno del intérprete tocará producción. Pasa un entorno explícito a los procesos hijos con el servidor de la base local en vez de reenviar `process.env`.

### Revierte la configuración solo de grabación

Devuelve a su sitio las marcas de cookies y los cambios de entorno hechos para grabar antes de confirmar cambios, para que la diferencia contenga solo el guion del grabador.

## Narración opcional

La narración reutiliza los subtítulos como guion.

1. **Genera un clip por subtítulo** con un proveedor de voz sintética. En la oficina, `generar_voz` (Estudio) cumple ese papel; fuera de ella hay opciones neutras como ElevenLabs (voces expresivas, amplia biblioteca) o la API de voz de OpenAI (sencilla y económica). Guarda los clips por paso para que las regrabaciones no vuelvan a llamar a la API.
2. **Usa las duraciones reales de los clips como esperas de los pasos.** Mide cada clip con `ffprobe` y aplícalo a los tiempos `before`/`during`. Sin voz sintética, estima unos 12 caracteres por segundo.
3. **Narra la tarjeta de título** con una introducción de una frase en la misma voz.
4. **Mezcla con ffmpeg:** retrasa cada clip hasta el desfase de su subtítulo (`adelay`), empuja cualquier clip que se solape con el anterior, mezcla con `amix` y alarga la cola del video (`tpad=stop_mode=clone`) si el audio se pasa de las imágenes.

**Llaves de API:** la llave del servicio de voz va en una variable de entorno (p. ej. `ELEVENLABS_API_KEY`) o en un gestor de secretos, cargada por el guion al ejecutarse. Nunca pidas que se pegue una llave en el chat y nunca escribas una en el repositorio ni en un archivo `.env` confirmado. Si la llave no está, di qué variable debe poner la persona en su propio equipo y vuelve mientras tanto a una grabación silenciosa. Si alguien pega una llave en el chat igual, no la uses: dile que la rote, porque los registros del chat no son un lugar seguro para secretos.

## Lista de verificación de entrega

- [ ] La página se ve bien en un navegador real antes de grabar
- [ ] La sesión persiste entre navegaciones (comprobación de cookies)
- [ ] Cada paso usa el modo correcto
- [ ] El cursor es visible en cada clic y cada relleno
- [ ] Los subtítulos se leen y nunca tapan el elemento activo
- [ ] La barra de direcciones falsa muestra el dominio público
- [ ] La tarjeta de título sirve de miniatura
- [ ] La configuración solo de grabación se revirtió
- [ ] Se entrega el MP4 con un resumen de una línea de lo que muestra
