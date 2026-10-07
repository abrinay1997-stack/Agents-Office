# Videos de YouTube que la IA cita

YouTube es una de las superficies de terceros más citadas en las respuestas de IA: Google AI Overviews y Gemini lo citan mucho, y ChatGPT y Perplexity toman de él para consultas de «cómo hacer». La idea central que cambia cómo se produce para YouTube:

**Los modelos no ven tu video. Leen todo lo que lo rodea.** La cita se gana con la capa de texto (título, transcripción, subtítulos, capítulos, descripción y comentarios), no con las imágenes. Un video de aspecto mediocre con una capa de texto limpia y estructurada le gana a uno hermoso que es opaco para un rastreador.

## La anatomía

Trabájala en orden de impacto:

### 1. La transcripción (el contenido real)

Es lo que el modelo realmente lee. Optimiza las *palabras habladas*:

- **Responde las preguntas con frases completas y citables.** «Los cinco pasos para crear un procedimiento son…» se extrae limpio; una respuesta divagada repartida en tres tangentes, no.
- Escribe un guion o esquema de las respuestas clave antes de grabar, para que cada pregunta central tenga una respuesta hablada clara y estructurada en un solo lugar.
- Di en voz alta los términos importantes: el nombre del producto, la categoría, las entidades que quieres asociar. Si solo está en una diapositiva, puede que el modelo nunca lo vea.

### 2. Subtítulos exactos

Los subtítulos automáticos son un desastre: nombres de producto mal oídos, sin puntuación, frases rotas, y eso es lo que lee el modelo si no lo arreglas. Sube subtítulos limpios (o al menos corrige los automáticos). Es el arreglo más barato de la lista.

### 3. Un título en forma de pregunta

Los modelos comparan el título con la consulta del usuario. «Cómo crear procedimientos que hagan crecer tu negocio» le gana siempre a un título ingenioso. Pon al frente la pregunta o la tarea; deja la marca para el canal.

### 4. Capítulos y marcas de tiempo

Los capítulos permiten al modelo (y a los espectadores) saltar a la respuesta exacta. Estructura = extraibilidad: el título de cada capítulo es una afirmación más, rotulada y citable, de lo que cubre el video. Iguala los títulos de los capítulos con las subpreguntas que la gente realmente hace.

### 5. Una descripción rica en palabras clave y estructurada

Repite los puntos clave del video *como texto* en la descripción: un resumen corto, luego una lista con viñetas de lo que se cubre y luego los enlaces de recursos. Refuerza el tema y las entidades en texto simple y rastreable y le da al modelo una segunda copia, más limpia, de la respuesta.

### 6. Un comentario fijado con el resumen

Otro bloque de texto citable: fija un comentario con la respuesta central en pasos numerados más los enlaces clave. Está indexado, estructurado y sobrevive aunque los espectadores nunca abran la descripción.

### 7. Miniatura e interacción

Los modelos de lenguaje no leen la interacción directamente, pero esta impulsa las señales de visualización que suben el posicionamiento en YouTube, y ese posicionamiento alimenta lo que los sistemas de IA muestran y citan. El trabajo de la miniatura es el clic; el de la capa de texto, la cita.

## Lista de revisión antes de publicar

- [ ] El título tiene forma de pregunta o tarea e iguala una consulta real
- [ ] Las respuestas clave se dicen como afirmaciones completas y estructuradas
- [ ] Subtítulos subidos o corregidos (nombres de producto bien escritos)
- [ ] Capítulos agregados, titulados por subpregunta
- [ ] La descripción repite los puntos clave en texto con desglose en viñetas
- [ ] El comentario fijado lleva el resumen y los enlaces
- [ ] Las entidades importantes (marca, categoría, producto) se dicen *y* se escriben

## Notas de campo (sep 2026)

- **El listón de la cita puede ser bajo.** En una comprobación en vivo, un video de 8 días con menos de 100 vistas fue la primera fuente citada en el AI Overview de Google para «best email marketing software». Vale la pena probar videos frescos y bien rotulados en términos generales.
- **Libera tus demostraciones.** Publica las demos de producto abiertas, con títulos que empiecen por la palabra clave («Demo de software de [categoría] – [Marca]»), en vez de encerrarlas detrás de un formulario.
- **Los videos patrocinados de creadores son difíciles de atribuir.** Profesionales citan de 20 a 40 mil dólares por video patrocinado y ninguna forma fiable de probar el retorno. Presupuéstalos con un plan de atribución (el campo declarado de `citas-vs-recomendaciones`) o no los presupuestes.

## Cómo se hace desde la oficina

- El guion, el título, la descripción, los capítulos y el comentario fijado los redactas tú como entrega; la grabación y la subida las hace una persona del negocio.
- Si el video lo produce la oficina, el Estudio ofrece `generar_video` y `generar_voz`; el texto hablado sigue las mismas reglas de arriba.
- La publicación en YouTube se deja como borrador en Contenido con `crear_borrador` (red YouTube, con título y privacidad); la aprueba el dueño.

## Relacionado

- La misma lógica de «los modelos leen la capa de texto» aplica a los pódcast: los episodios se transcriben y las notas del episodio se publican, así que ser invitado a un pódcast es prensa ganada que se acumula en las respuestas de IA; ver la referencia de preparación de invitados a pódcast de la habilidad `relaciones-publicas`.
- Para producir los videos mismos, ver `video-marketing`.

---

*Patrón de anatomía de Ross Simmonds / Foundation Inc. («The Anatomy of a YouTube Video AI Cites», 2026), destilado y ampliado con crédito.*
