---
name: video-marketing
titulo: Producción de video de marketing
description: Úsala cuando haya que crear un video de marketing: demostración, explicativo, clip para redes, anuncio o tutorial; con el Estudio (generar_video, voz, música), con material real o con un editor. Incluye prompts, guiones y planes de edición.
area: canales
departments: [marketing, delivery]
agents: [vid, gfx, iggy, mlead]
origen: marketingskills/video (MIT, Corey Haines)
palabras: [video, reel, clip, TikTok, YouTube, guion de video, short]
---
# Producción de video de marketing

Sirve para producir videos de marketing con eficiencia, de una demostración de producto o un explicativo a un clip social o un anuncio, combinando lo que genera el Estudio de la oficina, el material real de la empresa y el trabajo de quien edita.

Trabajas como productor de video. **Tu entrega es el plan y el guion completos, y los videos, voces y músicas que genera el Estudio; no publicas nada.** Publicar, programar o pagar anuncios lo aprueba el dueño.

## Antes de empezar

Lee las notas de la empresa en el Cerebro (`00-Empresa/perfil`, `00-Empresa/oferta`, `00-Empresa/voz`, `00-Empresa/clientes`, `00-Empresa/faq` y, sobre todo, `contexto-marketing`) y las cifras de la empresa. Usa ese contexto y solo pregunta lo que falte. Si falta algo que necesitas, pregúntalo en una línea (o con `pedir_bloqueo`) o déjalo marcado como supuesto; nunca lo inventes. Los precios, ofertas y datos que salgan en el video vienen de las cifras de la empresa, tal cual.

Reúne esto (pregunta lo que no esté):

1. **Objetivo del video:** ¿demostración, explicativo, testimonio, clip social, anuncio o tutorial? ¿Para qué plataforma (YouTube, TikTok, Reels, Shorts, la web, anuncios, una presentación de ventas)? ¿Qué duración?
2. **Cómo se produce:** ¿hace falta una persona presentadora, una voz en off o una grabación de pantalla? ¿Hay material real (fotos del producto, logos, capturas, videos del local, testimonios)? ¿Hace falta material generado (escenas, tomas de apoyo)? ¿Es único o una plantilla para repetir?
3. **Presupuesto y manos:** ¿cuánto se puede gastar en generación (el Estudio tiene topes diarios y mensuales)? ¿Quién edita y publica?

## Cómo produce la oficina un video

| Necesitas | Herramienta |
|---|---|
| Escenas y tomas generadas desde texto o desde una imagen | `generar_video` (con `imagen_inicial` e `imagen_final` para animar una imagen; los modelos que estén encendidos los dice `estado_estudio`) |
| Imágenes de partida, portadas, fotogramas clave | `generar_imagen`, `buscar_en_galeria` (lo que ya existe) |
| Voz en off o locución | `generar_voz` |
| Música o jingle | `generar_musica` |
| Receta lista de movimiento de cámara, giro de producto, bucle | `buscar_presets`, `aplicar_preset` |
| Seguir un video en proceso | `estado_trabajo` (un video es asíncrono: la entrega lleva «⏳ Estudio: … (trabajo id)» y la oficina lo cambia por el archivo al terminar) |
| Entender un video existente (referencia, grabación) | `analizar_video`, solo si la empresa tiene conectado Meta |
| Dejar la pieza lista en el calendario | `crear_borrador` (reel o historia) con el archivo del Estudio |

El Estudio gasta dinero real en motores de pago: **empieza con el plan y pide el OK antes de tandas grandes**, itera con imágenes y clips cortos y deja el final para el modelo de mejor calidad. Si un motor no está encendido, dilo y propón la alternativa; nunca finjas que generaste algo.

## Elegir el enfoque

| Enfoque | Sirve para | Cómo | Cuándo |
|---|---|---|---|
| **Generación con IA** | Material original desde texto o imagen | `generar_video` | Tomas de apoyo, planos héroe, imágenes que no puedes filmar |
| **Voz y música** | Un video con voz en off sin presentador | `generar_voz` + `generar_musica` sobre imágenes, capturas o clips | Explicativos, tutoriales, anuncios |
| **Material real** | Demostraciones, testimonios, «cómo es el lugar» | Lo graba una persona (celular, grabación de pantalla); tú escribes guion y lista de planos | Producto o servicio real, caras reales, locales |
| **Presentador sintético** | Una persona hablando sin filmar | Herramienta externa de avatares que maneje el dueño o diseño; tú escribes el guion | Contenido recurrente o en varios idiomas; ver `herramientas-externas` |
| **Edición y reutilización** | Cortar lo largo en clips | Plan de cortes para quien edite | Seminario o charla → clips para redes |
| **Plantillas programáticas** | Video repetible con datos | Una persona técnica con herramientas de código | Actualizaciones, videos personalizados; ver `herramientas-externas` |

Los agentes de la oficina no ejecutan código ni editan en programas de edición: si el enfoque lo requiere, entrega la especificación para quien lo haga.

## Generación con IA: elegir modelo y escribir el prompt

Modelos que ofrece el Estudio según las llaves encendidas (confírmalo con `estado_estudio`; no prometas uno apagado): Veo (Google), Kling, Seedance, Hailuo / MiniMax, Wan, LTX, PixVerse, Grok Imagine Video, entre otros. Orientación general:

- **Mejor calidad y audio sincronizado:** Veo.
- **Volumen y costo:** Kling y Seedance.
- **Consistencia de personaje entre tomas:** Hailuo.
- **Animar una imagen que ya tienes:** cualquier modelo de imagen a video (da `imagen_inicial`; ahorra créditos y mejora el resultado).
- **Borradores baratos y final en el mejor modelo.**

El Estudio dice la calidad, la velocidad y el precio estimado de cada modelo: úsalo. Sora y la API de videos de OpenAI se cerraron en septiembre de 2026 (según las notas de la fuente); no los recomiendes.

**Un buen prompt de video especifica: sujeto + acción + cámara + estilo + ambiente.**

```
Primer plano de manos escribiendo en el teclado de una laptop,
poca profundidad de campo, luz cálida de oficina,
la cámara se aleja despacio y revela un espacio de trabajo moderno,
corrección de color cinematográfica
```

Errores comunes: demasiado vago («una persona trabajando»: añade detalle); ignorar el movimiento de cámara (di dolly, paneo o fija); olvidar el estilo («cinematográfico», «documental», «comercial»); pedir texto dentro del video (los modelos no escriben texto legible: ponlo en edición). La guía completa con ejemplos, vocabulario de cámara y proporciones está en `guia-de-prompts-de-video`.

**IA frente a material de archivo o real:** la IA gana para la escena exacta que imaginaste y el estilo consistente entre clips; pierde para lugares reales reconocibles (alucina), y para productos o marcas concretas usa fotos reales del producto como imagen inicial. Para tomas de apoyo rápidas sirven ambos.

## Voz, música y presentador

Con `generar_voz` y `generar_musica` produces voz en off y música sin pantalla ni cámara. Escribe el guion para ser dicho (frases cortas, una idea por frase, sin siglas raras), indica emoción y ritmo y mide la duración (unos 12 caracteres por segundo hablado como estimación). Voz clonada de una persona: solo con su consentimiento y por el panel de voces del Estudio que maneja el dueño; nunca generes la voz de alguien real que no lo autorizó.

Un presentador sintético (avatar) conviene a contenido recurrente, versiones en varios idiomas y mensajes personalizados; **no** a contenido auténtico del fundador (se filma a la persona) ni a recorridos de la interfaz (grabación de pantalla). Dilo con honestidad: un avatar que se nota artificial puede restar confianza.

## Edición y reutilización

Flujo para convertir un contenido largo (seminario, charla, demostración) en clips: limpiar y pulir → elegir de 5 a 10 mejores momentos → subtítulos y estilo de plataforma → distribuir (TikTok, Reels, Shorts, LinkedIn). Entrega un **plan de cortes**: marca de tiempo de inicio y fin, gancho de los primeros 2 o 3 segundos, texto en pantalla, formato y título. Los subtítulos son esenciales: gran parte del video en redes se ve sin sonido.

**Copiar el estilo de una edición que admiras:** descomponla en una *especificación de edición* (hoja de momentos y 3 a 5 movimientos firma) y aplícala a tu material propio; copias la gramática, nunca el contenido. El método completo está en `anatomia-de-una-edicion`.

## Flujos de producción

**Video de demostración de producto:** (1) guion de funciones y propuesta de valor (`redaccion-publicitaria`); (2) grabación de pantalla o de producto real por una persona, o capturas; (3) títulos, llamadas y transiciones en edición; (4) tomas de apoyo con `generar_video`; (5) voz en off con `generar_voz` o la persona; (6) exportar para la plataforma. Para una demo repetible de una aplicación web que se regraba en cada versión, ver `grabacion-de-demostraciones` (guía para una persona técnica).

**Video explicativo:** (1) guion con el arco problema → solución → llamado a la acción; (2) elige presentador: voz en off sobre visuales, o avatar externo; (3) visuales: diapositivas, grabaciones, escenas generadas; (4) subtítulos siempre; (5) exportar: horizontal para YouTube y la web, vertical para redes.

**Clips sociales en serie:** (1) plantilla maestra (misma estructura, mismos tipos de plano); (2) datos: funciones, testimonios, cifras; (3) una variante por pieza; (4) subtítulos por plataforma; (5) cada pieza queda como borrador en Contenido con `crear_borrador`. Una serie semanal se propone como **rutina** al dueño.

## Errores comunes

1. Empezar por las herramientas y no por la estrategia: decide qué video necesitas antes de elegir cómo.
2. Texto generado por IA dentro del video: ponlo en edición.
3. Avatares que se notan artificiales cuando la calidad importa.
4. Sin subtítulos.
5. Proporción equivocada: 9:16 para redes, 16:9 para YouTube y web, 1:1 o 4:5 para el feed.
6. Producir de más: muchas veces lo auténtico rinde más que lo pulido, sobre todo en TikTok.

## Cómo entregarlo

Un documento en Markdown con:

1. **Resumen del video:** objetivo, plataforma, duración y proporción, resultado esperado y el dueño de la métrica.
2. **Guion** línea por línea (voz y texto en pantalla), con la duración estimada.
3. **Lista de planos:** para cada uno, fuente (real, generado, captura), prompt completo si es generado (sujeto + acción + cámara + estilo + ambiente), modelo recomendado y duración.
4. **Voz y música:** texto de la locución, voz y emoción, estilo musical.
5. **Subtítulos y edición:** estilo, ritmo, gancho de los primeros 2 segundos.
6. **Producción y costo:** qué genera la oficina, qué debe hacer una persona, costo estimado del Estudio (con su fuente) y plazos.
7. **Supuestos y lo que decide el dueño** (generar, publicar, pagar).

Si hay trabajo para otro puesto o departamento, propónlo con `crear_borrador_tarea`.

## Reglas

- Nada sale sin el OK del dueño: la oficina deja videos y piezas como borrador; publicar, programar o pagar anuncios es del dueño.
- No inventes cifras ni resultados que aparezcan en el video: salen de las cifras de la empresa o del Cerebro.
- Los gastos del Estudio se estiman antes y respetan los topes; nunca generes tandas grandes sin el OK.
- No pidas texto legible a un modelo de video; no uses la cara ni la voz de una persona real sin su permiso por escrito.
- Música, voces y tomas de terceros: solo con licencia; no copies el contenido de otro video.
- Nunca pidas ni uses llaves pegadas en el chat: las llaves de los motores son variables de entorno del equipo.
- Subtítulos siempre, y la proporción correcta para la plataforma.

## Referencias

- `guia-de-prompts-de-video`: estructura del prompt, vocabulario de cámara, estilos, consejos por modelo, errores, proporciones y ahorro de costos. Léela al escribir los prompts de los planos.
- `anatomia-de-una-edicion`: cómo descomponer una edición de referencia en una hoja de momentos reutilizable. Léela cuando el dueño pida «un video con este estilo».
- `grabacion-de-demostraciones`: guía para grabar de forma guionada y repetible la demo de una aplicación web (para una persona técnica), incluido el guion de voz. Léela ante una demo que se regraba en cada versión.
- `herramientas-externas`: plantillas programáticas (Hyperframes, Remotion), avatares y herramientas de edición, con comparativas. Léela cuando el enfoque exija algo que la oficina no hace sola.

## Habilidades relacionadas

- `redes-sociales`: estrategia de contenido en video, ganchos y qué publicar.
- `creatividad-anuncios`: video para anuncios pagados e iteración.
- `redaccion-publicitaria`: guiones y mensajes.
- `psicologia-marketing`: ganchos y persuasión en video.
- `imagenes-marketing`: imágenes de partida y fotogramas clave.
- `eventos`: grabaciones de seminarios y charlas para clips.
