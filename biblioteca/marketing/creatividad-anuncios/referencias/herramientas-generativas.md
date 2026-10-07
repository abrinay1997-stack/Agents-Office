# Herramientas de IA generativa para creatividades de anuncios

Referencia para producir imágenes, videos y voces de anuncios a escala con generadores de IA y con herramientas de video basadas en código. **En la oficina todo empieza por el Estudio**; el resto de este archivo explica qué es cada herramienta del mercado para que elijas bien el modelo, entiendas lo que ofrece y sepas qué recomendarle al dueño cuando algo no esté encendido.

Los precios y las capacidades de abajo son **aproximados, de la fecha del original (2026)** y cambian a menudo: úsalos para comparar, no para prometer un costo. El costo real de lo que pidas sale del Estudio (`estado_estudio`, y el aviso de costo antes de cada pedido).

---

## Lo que ya tiene la oficina: el Estudio

| Necesidad | Herramienta de la oficina |
|---|---|
| Ver qué motores y modelos están encendidos, el tope diario y el presupuesto | `estado_estudio` |
| Imagen de anuncio (estática, con o sin texto dentro) | `generar_imagen` (formato `1:1`, `4:5`, `9:16`, `16:9`…; `referencias` con fotos del dueño) |
| Video de anuncio, o animar una imagen | `generar_video` (con `imagen_inicial` e `imagen_final` para animar) |
| Voz de locución (incluidas las voces propias de la empresa) | `generar_voz` |
| Música instrumental | `generar_musica` |
| Buscar lo que ya se hizo o lo que el dueño subió (fotos de producto, logos, caras) | `buscar_en_galeria` |
| Fondos limpios, encuadre de catálogo, luz o color sobre una **foto real** del producto (el producto se conserva) | `buscar_presets` y `aplicar_preset` |
| Muchas imágenes con la misma receta | `crear_lote` y `estado_lote` (desde 10 fotos o cierto costo, espera el OK del dueño) |
| Saber en qué va un video | `estado_trabajo` |

Qué modelos hay depende de las llaves que el dueño haya puesto: típicamente Google (Nano Banana para imágenes, Veo para video), Higgsfield (Kling, Seedance, Flux, Ideogram, Soul, Wan, MiniMax…), fal.ai, OpenAI, Grok, Meta y MiniMax (voz y música). Un modelo apagado no aparece. Si lo que el concepto necesita no está encendido (por ejemplo, texto dentro de la imagen sin un modelo bueno en texto), dilo y propón la alternativa: el titular como capa de texto fuera de la imagen, o encender el motor.

Un video es un trabajo en segundo plano: devuelve «⏳ Estudio: … (trabajo …)». Déjalo tal cual en la entrega; la oficina lo cambia por el archivo cuando termina.

**Reglas del Estudio para anuncios:**
- Todo lo generado es un borrador. Nada se sube a una plataforma ni se lanza sin el OK del dueño.
- Si el producto debe verse tal cual (un empaque, un plato, una prenda), usa **la foto real como referencia** o un preset sobre ella; un modelo que «inventa» el producto es un riesgo de publicidad engañosa.
- Antes de un lote grande, mira `estado_estudio` y di cuántas piezas caben en el tope; si no caben, entrega los textos y las descripciones visuales y propón generar solo las elegidas.
- Pide el formato correcto de la ubicación desde el prompt (tabla al final de este archivo) para no recortar después.

---

## Cuándo usar herramientas generativas

| Necesidad | Categoría | Mejor opción |
|---|---|---|
| Imágenes estáticas de anuncios (banners, redes) | Generación de imagen | ChatGPT Images 2.0, Nano Banana Pro, Flux, Ideogram |
| Imágenes de anuncios con texto encima | Imagen con texto | Ideogram, Nano Banana Pro |
| Videos cortos (6–30 s) | Generación de video | Veo, Kling, Runway, Seedance |
| Video con locución | Video + voz | Veo (nativa) o Runway + una voz sintética |
| Pistas de locución | Generación de voz | ElevenLabs, OpenAI TTS, Cartesia |
| Versiones del anuncio en varios idiomas | Generación de voz | ElevenLabs, PlayHT |
| Clonar la voz de la marca | Generación de voz | ElevenLabs, Resemble AI |
| Maquetas y variaciones de producto | Imagen + referencias | Flux (varias imágenes de referencia) |
| Videos de plantilla a escala | Video basado en código | Remotion |
| Video personalizado (nombre, datos) | Video basado en código | Remotion |
| Variaciones coherentes con la marca | Imagen + referencias de estilo | Flux, Ideogram, Nano Banana Pro |

---

## Generación de imagen

### Nano Banana Pro (Gemini)
El modelo de imágenes de Google DeepMind, disponible por la API de Gemini.
- **Ideal para:** imágenes de anuncios de alta calidad, visuales de producto, texto dentro de la imagen.
- **Precio (orientativo):** ~0,04 USD por imagen (Gemini 2.5 Flash Image); ~0,24 USD por imagen 4K (Nano Banana Pro).
- **Fortalezas:** buen texto en imagen (logotipos, titulares); edición nativa (modificar una imagen con instrucciones); generación y edición en un mismo modelo.
- **Usos en anuncios:** imágenes de anuncio para redes desde una descripción; variaciones de maqueta de producto; editar un anuncio existente (cambiar el fondo o los colores); imágenes con el titular incluido.

### Flux (Black Forest Labs)
Modelos de imagen con pesos abiertos, con API a través de varios proveedores.
- **Ideal para:** imágenes fotorrealistas, variaciones coherentes con la marca, generación con varias referencias.
- **Precio (orientativo):** ~0,01–0,06 USD por imagen según modelo y resolución.

| Modelo | Velocidad | Calidad | Costo | Ideal para |
|---|---|---|---|---|
| Flux 2 Pro | ~6 s | La más alta | 0,015 USD/MP | Piezas finales de producción |
| Flux 2 Flex | ~22 s | Alta + edición | 0,06 USD/MP | Edición iterativa |
| Flux 2 Dev | ~2,5 s | Buena | 0,012 USD/MP | Prototipos rápidos |
| Flux 2 Klein | La más rápida | Buena | El más bajo | Lotes de alto volumen |

- **Fortalezas:** varias imágenes de referencia (hasta 8) para mantener la misma identidad en todos los anuncios; consistencia de producto (el mismo producto en contextos distintos); transferencia de estilo desde referencias.
- **Usos en anuncios:** 50+ variaciones con el mismo producto o persona; el producto en contexto (una tienda en distintos escenarios, una prenda en distintas fotos de estilo de vida); igualar el estilo de los materiales de marca existentes; pruebas A/B rápidas de imagen.

### Ideogram
Especializado en tipografía y texto dentro de las imágenes.
- **Ideal para:** banners con texto, gráficos de marca, imágenes sociales con titular.
- **Precio (orientativo):** ~0,06 USD por imagen (API); ~0,009 USD por imagen (suscripción).
- **Fortalezas:** el mejor texto en imagen de su clase (~90 % de acierto frente a ~30 % en la mayoría de herramientas, según el original); sistema de referencias de estilo (hasta 3 imágenes); muchísimos estilos predefinidos para mantener una estética de marca; bueno en logotipos y tipografía de marca.
- **Usos en anuncios:** banners con el titular dentro de la imagen; gráficos para redes con texto de marca; varios diseños con la misma tipografía; material promocional sin diseñador para cada iteración.

### Otras herramientas de imagen

| Herramienta | Ideal para | Estado de la API | Notas |
|---|---|---|---|
| **DALL-E 3 / modelos de imagen de OpenAI** | Imagen general | API oficial | Integrada con ChatGPT, buen texto |
| **Midjourney** | Imágenes artísticas de alta estética | Sin API pública oficial | Se maneja por Discord; las API no oficiales arriesgan bloqueos |
| **Stable Diffusion** | Autoalojado y personalizable | Código abierto | Para equipos con infraestructura de GPU |

---

## Generación de video

### Google Veo
- **Ideal para:** video de alta calidad con audio nativo y video vertical para redes.
- **Precio (orientativo):** ~0,15 USD/s (Veo 3.1 Fast); ~0,40 USD/s (Veo 3.1 Standard).
- **Capacidades:** hasta 60 segundos a 1080p; audio nativo (diálogo, efectos, ambiente); salida vertical 9:16 para historias, Reels y Shorts; ampliación a 4K; texto a video e imagen a video.
- **Usos en anuncios:** videos de 15–30 s desde una descripción; verticales para TikTok, Reels y Shorts; demostraciones de producto con locución; varias versiones del mismo prompt con estilos distintos.

### Kling (Kuaishou)
- **Ideal para:** video cinematográfico, contenido más largo, video sincronizado con audio.
- **Precio (orientativo):** ~0,09 USD/s (a través de un tercero).
- **Capacidades:** hasta 3 minutos a 1080p y 30–48 fps; audio y video a la vez (Kling 2.6); texto a video e imagen a video; controles de movimiento y de cámara.
- **Usos en anuncios:** explicativos de producto más largos; videos de marca cinematográficos con audio sincronizado; animar imágenes de producto.

### Runway
- **Ideal para:** generación controlada, contenido de estilo consistente y edición de metraje existente.
- **Capacidades:** Gen-4 (consistencia de personajes y escenas entre planos); pincel de movimiento y controles de cámara; imagen a video con referencias; transferencia de estilo de video a video.
- **Usos en anuncios:** videos con los mismos personajes o productos en distintas escenas; llevar metraje existente al estilo de la marca; extender o remezclar video.

### Seedance 2.0 (ByteDance)
- **Ideal para:** video rápido y económico con audio nativo y entradas de referencia multimodales.
- **Precio (orientativo):** ~0,10–0,80 USD/min según la resolución.
- **Capacidades:** hasta 20 s a 2K; audio y video a la vez; texto a video e imagen a video; hasta 12 archivos de referencia.
- **Usos en anuncios:** producción de video corto de alto volumen y bajo costo; locución y efectos sincronizados en una pasada; referencias múltiples (fotos de producto, materiales de marca, referencias de estilo); iteración rápida de conceptos.

### Higgsfield
- **Ideal para:** video social con estilo cinematográfico y contenido pensado para el móvil.
- **Capacidades:** 50+ movimientos de cámara profesionales (zooms, paneos, tomas FPV de dron); imagen a video; edición, transiciones y fotogramas clave; flujo todo en uno (imagen, animación, edición).
- **Usos en anuncios:** videos sociales de aire cinematográfico; animar imágenes de producto; varias versiones con distintos estilos de cámara; contenido de respuesta rápida.

### Comparación de video

| Herramienta | Duración máx. | Audio | Resolución | API | Ideal para |
|---|---|---|---|---|---|
| **Veo 3.1** | 60 s | Nativo | 1080p/4K | Gemini | Video social vertical |
| **Kling 2.6** | 3 min | Nativo | 1080p | Terceros | Cinematográfico más largo |
| **Runway Gen-4** | 10 s | No | 1080p | Oficial | Controlado y consistente |
| **Seedance 2.0** | 20 s | Nativo | 2K | Oficial + terceros | Alto volumen y bajo costo |
| **Higgsfield** | Varía | Sí | 1080p | Web | Social, pensado para móvil |

---

## Voz y audio

Para poner locuciones realistas sobre un video, narrar demostraciones o generar el audio de un video hecho con plantillas.

### Cuándo usar herramientas de voz
Muchos generadores de video (Veo, Kling, Seedance) ya incluyen audio nativo. Usa una voz aparte cuando necesites:
- **Locución sobre un video mudo** (Runway Gen-4 y Remotion producen video sin sonido).
- **Voz de marca constante** (clonar una voz concreta para todos los anuncios).
- **Versiones en varios idiomas** (el mismo guion en 20+ idiomas).
- **Iterar el guion** (volver a grabar sin rehacer el video).
- **Control preciso** de tiempos, emoción y ritmo.

**En la oficina:** `generar_voz` (con voces propias de la empresa si el dueño las diseñó o clonó). **Clonar la voz de una persona real exige su consentimiento expreso**; el dueño lo hace en el panel de voces del Estudio con una grabación suya. No clones ni imites la voz de un tercero.

### ElevenLabs
- **Ideal para:** las locuciones más naturales, clonación de la voz de la marca y multilingüe.
- **Precio (orientativo):** ~0,12–0,30 USD por 1.000 caracteres según el plan.
- **Capacidades:** 29+ idiomas con acento y entonación naturales; clonación desde clips cortos (instantánea) o grabaciones largas (profesional); control de emoción y estilo; flujo en tiempo real; cientos de voces prediseñadas.
- **Usos en anuncios:** pistas de locución; clonar la voz del portavoz de la marca; el mismo anuncio en 10+ idiomas desde un guion; probar A/B estilos de voz (autoritaria, amable, urgente).

### OpenAI TTS
- **Ideal para:** locuciones rápidas y económicas a escala, integración sencilla.
- **Precio (orientativo):** 15 USD por millón de caracteres (estándar), 30 (HD); ~0,015 USD/min con gpt-4o-mini-tts.
- **Capacidades:** 13 voces integradas (sin clonación); varios idiomas; flujo en tiempo real; opción HD.
- **Usos:** locución barata y rápida para versiones de prueba; narración de alto volumen; prototipo del audio antes de invertir en una voz premium.

### Cartesia Sonic
- **Ideal para:** voz en tiempo real, la menor latencia y la mayor expresividad emocional.
- **Precio (orientativo):** desde 5 USD/mes; pago por uso desde ~0,03 USD/min.
- **Capacidades:** 40 ms hasta el primer audio (el más rápido de su clase); 15+ idiomas; expresividad no verbal (risa, respiración, inflexiones); API de flujo continuo.
- **Usos:** vista previa en tiempo real durante la iteración; videos de demostración interactivos; anuncios que necesitan risas, suspiros o reacciones emocionales naturales.

### Voicebox (código abierto)
Estudio de voz gratuito y local, basado en Qwen3-TTS: la alternativa abierta a ElevenLabs.
- **Ideal para:** clonar voces gratis, generar en privado y en local, producir lotes sin costo por carácter.
- **Precio:** gratis (licencia MIT); corre en la máquina de quien lo instala.
- **Capacidades:** clonación desde muestras cortas; varios idiomas (inglés y chino, más en camino); editor de línea de tiempo de varias pistas; inferencia mucho más rápida en Apple Silicon; API local; sin dependencia de la nube.
- **Usos:** voz de portavoz gratis en todas las variaciones; locuciones en lote sin costo por carácter; generación privada cuando el contenido es sensible o aún no se lanza; probar voces antes de pagar un servicio. Requiere a alguien que lo instale y lo maneje; la oficina no lo corre.

### Otras herramientas de voz

| Herramienta | Ideal para | Diferenciador |
|---|---|---|
| **PlayHT** | Gran biblioteca de voces, baja latencia | 900+ voces, <300 ms, muy realista |
| **Resemble AI** | Clonación empresarial | Despliegue en servidores propios, voz a voz en tiempo real |
| **WellSaid Labs** | Voces éticas y seguras para uso comercial | Voces de actores compensados |
| **Fish Audio** | Económico, control de emoción | ~50–70 % más barato que ElevenLabs, etiquetas de emoción |
| **Murf AI** | Equipos no técnicos | Estudio en el navegador, 200+ voces |
| **Google Cloud TTS** | Ecosistema Google, escala | 220+ voces, 40+ idiomas, acuerdos empresariales |
| **Amazon Polly** | Ecosistema AWS, costo | Voces neuronales, control SSML, barata a volumen |

### Comparación de voces

| Herramienta | Calidad | Clonación | Idiomas | Latencia | Precio por 1.000 caracteres |
|---|---|---|---|---|---|
| **ElevenLabs** | La mejor | Sí (instantánea + pro) | 29+ | ~200 ms | 0,12–0,30 USD |
| **OpenAI TTS** | Buena | No | 13+ | ~300 ms | 0,015–0,030 USD |
| **Cartesia Sonic** | Muy buena | No | 15+ | ~40 ms | ~0,03 USD/min |
| **PlayHT** | Muy buena | Sí | 140+ | <300 ms | ~0,10–0,20 USD |
| **Fish Audio** | Buena | Sí | 13+ | ~200 ms | ~0,05–0,10 USD |
| **WellSaid** | Muy buena | No (voces de actores) | Inglés | ~300 ms | A convenir |
| **Voicebox** | Buena | Sí (local) | 2+ | Local | Gratis (código abierto) |

### Cómo elegir una voz

```
¿Necesitas locución para anuncios?
├── ¿Clonar una voz de marca concreta?
│   ├── Mejor calidad → ElevenLabs
│   ├── Empresarial o en servidores propios → Resemble AI
│   └── Económico → Fish Audio, PlayHT
├── ¿Multilingüe (el mismo anuncio en muchos idiomas)?
│   ├── Más idiomas → PlayHT (140+)
│   └── Mejor calidad → ElevenLabs (29+)
├── ¿Gratis, abierto o local?
│   └── Voicebox (MIT, corre en tu máquina)
├── ¿Barato, rápido y suficientemente bueno?
│   └── OpenAI TTS (~0,015 USD/min)
├── ¿Licencia comercialmente segura?
│   └── WellSaid Labs (voces de actores compensados)
└── ¿Tiempo real o interactivo?
    └── Cartesia Sonic (40 ms)
```

### Flujo: voz + video

```
1. Escribe el guion del anuncio (con esta skill).
2. Genera la locución (en la oficina: generar_voz).
3. Genera o monta el video:
   a. Video mudo (Runway o plantillas) → se le coloca la pista de voz.
   b. O Veo / Seedance con audio nativo (sin locución aparte).
4. Si se superponen por separado, quien monta el video une la pista y el video.
5. Genera variaciones (guiones, voces o idiomas distintos).
```

La oficina entrega el guion, el audio generado y las instrucciones de montaje; el montaje final lo hace el dueño o su editor.

---

## Video basado en código: Remotion

Para videos de anuncios de plantilla, a escala y con datos, Remotion (React y TypeScript) es la mejor opción. A diferencia de los generadores de video con IA, que producen un video único a partir de un prompt, genera video **determinista y fiel a la marca** desde plantillas y datos.
- **Ideal para:** variaciones de plantilla, video personalizado, producción coherente con la marca.
- **Precio:** gratis para personas y equipos pequeños; licencia comercial desde 4 empleados (según el original; confírmalo).
- **Qué necesita:** a alguien que programe o a una agencia. **La oficina no corre código ni renderiza.** Lo que el agente sí puede hacer es entregar el **diseño de la plantilla en palabras, la tabla de datos (CSV o lista) y los guiones**, listos para quien lo programe.

### Por qué Remotion para anuncios

| Generadores de video con IA | Remotion |
|---|---|
| Un resultado distinto cada vez | Determinista, exacto al píxel |
| Se maneja con prompts, menos control | Control total de cada cuadro |
| Cuesta igualar la marca exactamente | Colores, tipografías y espacios exactos de la marca |
| Una generación a la vez | Cientos en lote desde datos |
| No inserta datos dinámicos | Personaliza con nombres, precios, cifras |

### Usos en anuncios

1. **Anuncios dinámicos de producto.** Una lista de productos (nombre, precio, imagen, frase) y un video por cada uno. Un comercio con catálogo (una ferretería, una tienda de ropa) lo aprovecha mucho: cada producto tiene su anuncio de plantilla con su foto y su precio **tomado de las cifras de la empresa**.
2. **Variaciones de video para pruebas A/B.** La misma plantilla con titulares, llamados o esquemas de color distintos (por ejemplo: «Ahorra 50 % hoy» con botón «Aprovecha la oferta», tema urgencia; «Más de 10.000 clientes» con «Empieza gratis», tema prueba social; «Hecho para la velocidad» con «Pruébalo», tema beneficio). Los números de estos ejemplos son de ilustración: los reales salen de las cifras de la empresa.
3. **Videos personalizados de contacto.** Videos que saludan al prospecto por su nombre para ventas en frío o seguimiento. Respeta las leyes de privacidad y de comunicación comercial de tu país.
4. **Producción social por lotes.** El mismo contenido en distintas proporciones: 1:1 para el feed, 9:16 para historias y Reels, 16:9 para YouTube.

### Flujo con Remotion

```
1. Diseñar la plantilla (en código, o pidiendo a una IA que genere el componente).
2. Definir el esquema de datos (productos, titulares, llamados, imágenes).
3. Alimentar la plantilla con la lista de datos.
4. Renderizar todas las variaciones en lote.
5. Subirlas a la plataforma (con el OK del dueño).
```

---

## Cómo elegir la herramienta

```
¿Necesitas anuncios en video?
├── ¿De plantilla y con datos (misma estructura, datos distintos)?
│   └── Remotion (por parte de quien lo programe)
├── ¿Creatividad única desde prompts (exploratoria)?
│   ├── ¿Diálogo o locución? → Veo 3.1, Kling 2.6, Seedance 2.0
│   ├── ¿Coherencia entre escenas? → Runway Gen-4
│   ├── ¿Video social vertical? → Veo 3.1 (9:16 nativo)
│   ├── ¿Mucho volumen a bajo costo? → Seedance 2.0
│   └── ¿Cámara cinematográfica? → Higgsfield, Kling
└── Ambas → IA para las piezas «héroe», Remotion para las variaciones

¿Necesitas anuncios en imagen?
├── ¿Texto o titulares dentro de la imagen? → Ideogram
├── ¿Producto consistente entre variaciones? → Flux (varias referencias)
├── ¿Iteraciones rápidas sobre imágenes existentes? → Nano Banana Pro
├── ¿La mayor calidad visual? → Flux Pro, Midjourney
└── ¿Mucho volumen a bajo costo? → Flux Klein, Nano Banana
```

Recuerda: en la oficina solo puedes usar lo que el Estudio tiene **encendido**. Lo demás es información para recomendar al dueño (qué encender o qué contratar) y para el equipo que maneje la producción.

### Comparación de costos para 100 variaciones (orientativo)

| Enfoque | Herramienta | Costo aproximado |
|---|---|---|
| 100 imágenes estáticas | Nano Banana Pro | ~4–24 USD |
| 100 imágenes estáticas | Flux Dev | ~1–2 USD |
| 100 imágenes estáticas | Ideogram (API) | ~6 USD |
| 100 videos de 15 s | Veo 3.1 Fast | ~225 USD |
| 100 videos de 15 s | Remotion (plantilla) | ~0 USD (render en equipo propio) |
| 10 videos «héroe» + 90 de plantilla | Veo + Remotion | ~22 USD + tiempo de render |

### Flujo recomendado para producción a escala

1. **Genera las piezas «héroe» con IA** (Nano Banana, Flux, Veo): alta calidad, exploratorio.
2. **Construye plantillas** (Remotion u otra herramienta de plantillas) a partir de los patrones ganadores.
3. **Produce las variaciones en lote** con datos (productos, titulares, llamados). En la oficina, para imágenes: `crear_lote`.
4. **Itera**: IA para ángulos nuevos, plantillas para escala.

Este enfoque híbrido combina la exploración creativa de los generadores con la coherencia y la escala del render por código.

---

## Medidas de imagen por ubicación

Al generar imágenes de anuncios, pide las dimensiones correctas desde el prompt (y el `formato` del Estudio) para no tener que recortar ni cambiar el tamaño después.

| Plataforma | Ubicación | Proporción | Tamaño recomendado |
|---|---|---|---|
| Meta, feed | Imagen simple | 1:1 | 1080×1080 |
| Meta, historias y Reels | Vertical | 9:16 | 1080×1920 |
| Meta, carrusel | Cuadrado | 1:1 | 1080×1080 |
| Google Display | Horizontal | 1,91:1 | 1200×628 |
| Google Display | Cuadrado | 1:1 | 1200×1200 |
| LinkedIn, feed | Horizontal | 1,91:1 | 1200×627 |
| LinkedIn, feed | Cuadrado | 1:1 | 1200×1200 |
| TikTok, feed | Vertical | 9:16 | 1080×1920 |
| X (Twitter), feed | Horizontal | 16:9 | 1200×675 |
| X (Twitter), tarjeta | Horizontal | 1,91:1 | 800×418 |

Para el detalle de límites de texto y formatos por plataforma, ver `especificaciones-plataformas`.
