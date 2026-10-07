# Videos animados sin rostro (anuncios de concepto, totalmente generados)

> Formato popularizado por Borja (@borjafat) y por la receta abierta de collage en movimiento `super-video-maker` de Bomx. Esta guía es una reexpresión propia del método, ampliada con una biblioteca de estilos y con lecciones de producción.

Un video de 15–45 s, sin presentador y sin metraje, hecho solo con una idea: un **póster con estilo** (modelo de imagen) → llevado a la vida con un movimiento sutil (modelo de imagen a video) → narrado (voz sintética) → con rótulos sincronizados palabra por palabra. Sin grabar, sin presentador, sin editor.

El formato funciona porque **la imagen fija carga la idea** (una imagen literal y un poco surrealista por golpe narrativo) y **el movimiento solo la hace respirar**. Resiste la tentación de que el video cuente la historia: esto es diseño de póster animado, no cine.

## Cuándo usarlo

- Anuncios de concepto o explicativos: una idea hecha concreta («tu CRM es un cajón de cachivaches», «tu inventario es un cuarto de San Alejo»).
- Video social de embudo alto (9:16 en Reels, Shorts y TikTok; 4:5 y 1:1 en el feed).
- Híbridos de respuesta de marca donde un estilo propio y distintivo le gana al contenido de creador genérico.
- **No sirve** para anuncios de demostración o de prueba (ahí ganan las grabaciones de pantalla), para testimonios o formatos de creador, ni para nada que necesite la foto real del producto como evidencia.

Sirve igual para un SaaS que para una clínica dental («tu agenda de citas es un rompecabezas»), una ferretería o una tienda de ropa, siempre que la idea sea un concepto y no una prueba.

## Antes de empezar

Lee las notas de la empresa en el Cerebro (`00-Empresa/…`, sobre todo `contexto-marketing` y `00-Empresa/voz`) y las cifras de la empresa. Necesitas: la idea única del video, el público, la oferta o el llamado a la acción y los colores y la tipografía de la marca (para los estilos del segundo nivel). Si falta algo, pregúntalo en una línea o márcalo como supuesto.

## El flujo (vale para cualquier proveedor)

1. **Guion**: 3–6 golpes, 20–45 s de locución. Una idea por golpe. Lo calmado y específico le gana al bombo. Termina con **una sola línea** de llamado a la acción.
2. **Pósters fijos**: uno por golpe, con una **fórmula de estilo** (abajo). Genera el golpe 1, apruébalo y pásalo como imagen de referencia de todos los siguientes para que el conjunto se lea como una serie. Si el texto de un rótulo sale deformado, regenera con una frase más corta.
3. **Animar** cada póster aprobado con un modelo de imagen a video (5–8 s por golpe). El movimiento pertenece a los objetos del cuadro; la composición no debe cambiar.
4. **Locución y rótulos**: una sola toma continua de voz sintética, transcrita con marcas de tiempo por palabra, cortes de golpe en los límites de las frases y rótulos de 2–3 palabras grabados sobre la imagen.
5. **Ensamblar**: unir los golpes recortados a lo que dura su locución (congela el último cuadro para rellenar), normalizar el volumen (referencia: `I=-16:TP=-1.5:LRA=11`) y exportar un formato por ubicación.

### Cómo se hace en la oficina

| Etapa | Con las herramientas de la oficina |
|---|---|
| Pósters | `generar_imagen` en el formato del lugar (`9:16`, `4:5`, `1:1`), con el golpe 1 aprobado como `referencias` de los demás. Los modelos con buen texto dentro de la imagen (Nano Banana, Ideogram…, si están encendidos: `estado_estudio`) dejan los rótulos legibles. |
| Movimiento | `generar_video` con `imagen_inicial` = el póster aprobado y el prompt de movimiento de abajo; 5–8 s por golpe. Un video devuelve «⏳ Estudio: … (trabajo …)»: déjalo tal cual en la entrega. |
| Voz | `generar_voz` con el guion completo en una toma, voz calmada. Si la empresa tiene una voz propia (diseñada o clonada), úsala. |
| Música (opcional) | `generar_musica`, instrumental y bajita. |
| Rótulos y ensamble | La oficina no edita video. El agente entrega el **guion con tiempos**, el texto de cada rótulo con su ventana, el orden de los clips y los ajustes de sonido, listos para quien monte el video (el dueño, un editor o su herramienta habitual, p. ej. CapCut). |

Antes de generar varios golpes y clips, consulta `estado_estudio` (motores encendidos, tope diario y presupuesto) y dile al dueño cuánto costaría el video completo. Un video con 5 golpes son 5 imágenes + 5 clips + la voz: el costo del original ronda 3–6 dólares y unos 15 minutos de trabajo por video terminado, pero **confirma el costo real en el Estudio**. Si no caben en el tope, entrega primero el guion y los pósters y propón animar solo los elegidos.

## La biblioteca de estilos

Cinco looks probados. Cada uno es una fórmula de prompt con huecos. Usa **UN estilo por campaña** para que la cuenta construya una identidad visual reconocible. Los cinco se animan bien.

*Los prompts van en inglés porque los modelos de imagen siguen mejor las instrucciones así. El texto que debe aparecer dentro de la imagen (`<LABEL>`) va en el idioma del público.*

### A. Collage de serigrafía (editorial, aire de documental «en pocas palabras»)
> Flat screen-print collage poster, single saturated `<COLOR>` background, subtle newsprint grain. Centerpiece: a black-and-white halftone cutout of `<SUBJECT DOING THE LITERAL CONCEPT>`, treated as a paper sticker with a thin white die-cut outline, slightly torn edges, and a soft drop shadow. Visible halftone dot texture, vintage editorial photo feel, grayscale subject. Accent cutouts: 2–4 flat shapes (cream circle sun, black zigzag, scattered dots). A torn-paper label near the bottom with the words "`<LABEL>`" in bold condensed uppercase newspaper type. Matte printed risograph aesthetic, limited palette. No gradients, no glow, no 3D, no photorealism, no extra text.

### B. Ilustración vectorial plana (limpia, técnica, fácil de adaptar a cualquier marca)
> Flat vector explainer illustration in the style of a premium animated science channel: a friendly simplified `<SUBJECT>`, bold flat shapes with clean rounded edges, solid `<BRAND COLOR>` background, limited palette of `<2-3 ACCENTS>`, flat geometric accents, soft long shadows, completely flat 2D design. A clean rectangular banner near the bottom reads "`<LABEL>`" in bold geometric sans-serif uppercase. No outlines, no 3D, no photorealism, no texture, no extra text.

### C. Diorama de papel (cálido, táctil, artesanal de gama alta)
> Layered papercraft diorama: `<SUBJECT>`, every element hand-cut from colored construction paper with visible paper thickness and real drop shadows between layers, `<COLOR>` paper background with cut-paper accents, tactile handmade craft feel with slightly imperfect scissor cuts. A cut-paper banner near the bottom reads "`<LABEL>`" in chunky cut-out paper letters. Soft studio lighting on the paper layers. No digital gradients, no photorealistic humans, no extra text.

### D. Cómic pop-art (ruidoso, detiene el scroll, ideal para promociones)
> Vintage pop-art comic panel: `<SUBJECT>`, bold black ink outlines, Ben-Day halftone dots shading, flat process colors (`<PALETTE>`), comic starburst accents, thick panel border, aged newsprint paper texture. A comic caption box near the bottom reads "`<LABEL>`" in bold comic lettering. 1960s printed comic aesthetic, slight ink misregistration. No 3D, no photorealism, no gradients, no extra text.

### E. Plastilina o stop motion (encantador, rompe el patrón con fuerza)
> Stop-motion claymation scene: a charming handmade plasticine `<SUBJECT>`, visible fingerprints and clay texture, `<COLOR>` clay backdrop and floor, chunky clay props, warm soft studio lighting like a stop-motion film set, shallow depth of field. A small clay sign near the bottom reads "`<LABEL>`" in hand-molded clay letters. Handcrafted miniature feel. No 2D illustration, no photorealistic humans, no extra text.

## Estilos flexibles a la marca (por «huecos» de marca)

Los cinco looks de arriba tienen **carácter propio**: imponen su paleta. Este segundo nivel es **la marca primero**: cada estilo se define por huecos, de modo que los elementos de cualquier empresa entran y el resultado se lee como el sistema de diseño de esa marca.

**El contrato de huecos de marca.** Antes de generar, resuelve esto desde las guías de marca (o desde `contexto-marketing` y `00-Empresa/voz`; si la empresa no tiene guía, pídele al dueño sus colores y su tipografía):

- `FIELD`: el fondo neutro (blanco o blanco roto de la marca, o su oscuro).
- `INK`: el color del trazo y del texto (gris de la marca, carbón, casi negro).
- `ACCENT`: **UN** color o degradado de la marca, usado con moderación (una línea, un haz, un cuadrado).
- `TYPE FEEL`: la voz tipográfica de la marca («grotesca moderna y limpia», «geométrica», «mono para los pies de texto»).
- Cualquier restricción propia (por ejemplo, «degradados solo en bordes, nunca en rellenos»).

Mantén el acento verdaderamente escaso: un elemento por cuadro. La escasez es lo que hace que se lea como diseñado y no como generado.

### F. Monolínea editorial (la más universal para una marca)
> Minimal editorial monoline illustration poster: `<SUBJECT>`, drawn entirely in elegant thin single-weight `<INK>` lines on a clean `<FIELD>` background, the style of a premium tech company blog illustration. Sparse composition with generous whitespace, a few small monoline accent details, and ONE restrained `<ACCENT>` element: `<a thin accent underline sweep / a small accent arc>`. A small caption near the bottom reads "`<LABEL>`" in `<TYPE FEEL>`, `<INK>`, letterspaced uppercase, with a thin `<ACCENT>` underline. Precise, technical, refined. No fills except the single accent, no gradients, no 3D, no photorealism, no texture, no extra text.

### G. Tipográfico suizo (la tipografía ES la imagen: sirve a cualquier marca con una letra y un color)
> Swiss International Typographic Style poster: the words "`<LABEL>`" set enormous in a bold `<TYPE FEEL>`, `<INK>` on a `<FIELD>` background, filling the upper two thirds with tight leading and cropped edges. A small black-and-white photographic cutout of `<SUBJECT>` sits on a thin baseline grid in the lower third, aligned to an asymmetric grid with one thin `<ACCENT>` rule line and a small `<ACCENT>` square as the only color. Visible faint grid lines, precise margins, mathematical composition. Flat, printed, matte. No gradients, no 3D, no decoration, no extra text beyond the label and one small letterspaced caption line.

### H. Línea luminosa (keynote oscuro: marcas de herramientas técnicas o de modo oscuro)
> Dark minimal tech-keynote poster: `<SUBJECT>` rendered as an elegant thin light-gray wireframe line drawing on a near-black `<FIELD>` background with subtle film grain. From `<the focal object>` emanates a soft narrow beam of glowing `<ACCENT>` gradient light, the only color, feathered and atmospheric. Faint thin concentric geometric guide circles. A caption near the bottom reads "`<LABEL>`" in `<TYPE FEEL>`, light gray, letterspaced uppercase, with a hairline gradient rule beneath it. Restrained, premium, technical. No photorealism, no 3D render look, no busy elements, no extra text.

### I. Serigrafía a dos tintas (marcas con fotografía: golpe editorial con dos colores de marca)
> Bold duotone screenprint photo poster: a dramatic photograph of `<SUBJECT>`, reproduced as a two-color screenprint — `<INK>` for the shadows and `<ACCENT>` for the highlights — on an off-white `<FIELD>` paper background with visible coarse halftone grain and slight ink misregistration. Strong diagonal composition, the figure large and cropped. A wide solid `<INK>` bar near the bottom carries the words "`<LABEL>`" reversed out in bold condensed `<TYPE FEEL>` uppercase, with a small `<ACCENT>` square bullet. Editorial poster energy, matte printed feel. No gradients beyond the duotone, no 3D, no extra text.

**Notas de movimiento para este nivel:** F y G se animan como dibujo (las líneas se extienden, el barrido del acento se traza solo, la tipografía se asienta unos píxeles); H, como pulso del haz y una lenta sensación de giro del esqueleto de líneas; I, como brillo del grano y un empuje lento. Las mismas reglas duras: el movimiento pertenece a lo que ya está en el cuadro y la composición nunca cambia.

## La fórmula del prompt de movimiento

> Subtle living-`<style>` motion of the existing elements only. `<ONE literal motion tied to the concept: the pile inflates / the arrow creeps higher / the megaphone trembles with each shout>`. `<Secondary ambient motion: accents drift, gentle push-in>`. Every element that is visible now is the only thing that ever appears; the composition stays exactly as it is. Everything stays `<style descriptor: a flat printed collage / flat 2D vector / cut paper / printed comic / handmade clay>`. No camera whip, no scene change, no morphing, no added text.

## Lecciones aprendidas a golpes

- **Los modelos de video adoran añadir «manos de artesano» fotorrealistas** que entran al cuadro, sobre todo en movimientos de presionar o manipular, y **los prompts negativos lo empeoran** («sin manos» es una trampa de atención). No menciones nunca las manos; describe el movimiento como propio de los objetos e incluye «la composición se queda exactamente como está».
- **Revisa siempre los últimos 2 segundos de cada clip**: ahí aparecen los objetos intrusos y la deriva de estilo. Recorta antes o regenera; nunca entregues un cuadro «realificado».
- **Un movimiento dominante por golpe.** Dos movimientos se leen como caos a la velocidad del feed.
- **La voz sintética y la transcripción discrepan en los sonidos parecidos** («casa» y «caza», «cien» y «sien»). Lee la transcripción contra el guion antes de grabar los rótulos; prefiere una redacción del llamado sin ambigüedad fonética.
- **Mantén los rótulos lejos de la banda de la etiqueta** (rótulos hacia el 60 % de la altura, etiqueta hacia el 80 %). Evita que dos grupos de rótulos se pisen y reduce los grupos largos hasta que quepan. Respeta además la franja segura del video vertical (`video-vertical-y-formatos-creador`).
- **Específico de anuncios:** pon la marca o la etiqueta en el propio póster (sobrevive al autoplay sin sonido), adelanta el concepto al golpe 1 (el gancho de 3 segundos ES el póster) y exporta 9:16 + 4:5 + 1:1 desde los mismos golpes **regenerando los pósters por formato** en vez de recortar.

## Qué entrega el agente

Por video: la idea y el estilo elegido, el guion de 3–6 golpes con la locución de cada uno, el prompt de póster y el prompt de movimiento de cada golpe (con los huecos ya llenos), los rótulos con su ventana, las líneas de lo generado en el Estudio (⏳ o ![…] tal cual), el orden de montaje y los ajustes de sonido, el costo estimado y la lista de afirmaciones con su fundamento. Nada se publica ni se sube: queda listo para el OK del dueño.

## Cumplimiento

Los personajes son totalmente sintéticos, así que no hay problema de parecido o de contenido de usuario, pero **revisa los requisitos de divulgación de contenido hecho con IA** de la plataforma (Meta y TikTok etiquetan el contenido generado con IA) y las leyes de tu país. No inventes estadísticas ni testimonios en la locución: fundamenta cada afirmación en las notas y las cifras de la empresa.
