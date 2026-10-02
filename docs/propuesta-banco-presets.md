# Banco de presets del Estudio — especificación final

**Fecha:** 1 oct 2026 · **Rama de partida:** `mejora/dimitri-estudio` · **Catálogo:** `docs/presets-catalogo.json` (188 presets)

**Pedido del dueño, resumido.** Un banco de presets para imágenes y videos (y música, si se puede) que sea intuitivo y esté bien estructurado. Sus requisitos:
- Funciona **sin referencia** («foto de estudio», «mi cama cruda de la bodega convertida en producto de catálogo, a cierta distancia, con margen para recortar en la web») y **con referencia** («copiar el estilo, copiar LUT, copiar composición»; «pongo la idea y una referencia de marketing y que ya sepa qué hacer»).
- Presets atómicos («uno solo de luz, uno solo de sombras») junto a los combinados.
- Iconos, un buen buscador y lotes de fotos (también desde un Excel), con seguimiento «como un agente».
- Todo controlable desde Dimitri.

**Cómo se decidió.** Tres arquitectos escribieron una propuesta cada uno:
1. catálogo y datos;
2. motor y modelos;
3. experiencia, Dimitri y lotes.

Tres críticos las puntuaron y pusieron cambios obligatorios: un fotógrafo de producto y retocador, un diseñador de marketing para redes y tienda online, y un ingeniero senior desconfiado. Este documento junta las tres:
- en cada aspecto se toma la base más votada;
- se aplican **todos** los cambios obligatorios de los críticos;
- se injerta lo mejor del resto.

---

## 0. Las decisiones, en una línea cada una

| # | Decisión | Base | Quién lo pidió o propuso |
|---|---|---|---|
| D1 | **Un preset es un dato, no un prompt.** Es una receta declarativa: qué toca, qué entradas pide, qué parámetros mueve el dueño, qué hace en local y qué con IA, y qué se comprueba después. | P2 (motor) | P1, P2 y P3; investigación (Photoroom, Claid) |
| D2 | **Un solo esquema** de preset (§4) y **un solo compilador puro en `src/presets-core.js`**, que importan la página, el servidor, `parseCreatives`, el lote y el MCP. | — | Diseñador (obligatorio 1) e ingeniero (obligatorio 1) |
| D3 | **Local antes que IA.** Exposición, sombras, altas luces, contraste, balance, saturación, dominante, nitidez, ruido leve, LUT, transferencia de color, encuadre y exportación **nunca** van a un modelo generativo. Sin `sharp`, el preset dice «no disponible en esta máquina»: **nunca cae a IA sin avisar**. | P2 | Fotógrafo (obligatorio 1) e ingeniero (obligatorio 3) |
| D4 | **Recetas y ajustes.** Una receta (`capa: receta`) arma ajustes con `incluye`. «Arreglar color, luz y sombras» es la suma literal de «Que el blanco se vea blanco» + «Quitar un tono» + «Más clara» + «Ver lo que está oscuro» + «Recuperar lo quemado» + «Colores más vivos». | P1 | Los tres críticos |
| D5 | **Ejes exclusivos y ejes que se suman.** En fondo, sombra, escena, encuadre, ángulo, cámara, plano, look, formato, audio y salida, el último que eliges sustituye al anterior y se avisa con DESHACER. Limpieza, luz y color se suman. | P1 + P3 | Los tres |
| D6 | **Tres puertas de entrada**: «Desde cero», «Mejorar mi foto» y «Copiar de una referencia». Por dentro, el modo **se deduce de las entradas** y no se declara. **Lo confirma el dueño (§2).** | P3 | Fotógrafo y diseñador (lo recomiendan); ingeniero (pregunta al dueño) |
| D7 | **La referencia se separa por ejes**, cada uno con interruptor y fuerza: Estilo, Color/LUT, Composición, Luz, Fondo, Pose y Producto. Vienen encendidos Estilo y Color; **Producto nunca viene encendido**. El atajo «Hazlo como este anuncio» copia estilo, color, luz y composición. | P3 (UI) + P1 (ids) | Los tres |
| D8 | **«Copiar color / LUT» es de verdad y local**: transferencia Reinhard en Lab, aplicación de un `.cube` y «Guardar este color como LUT». **Nunca** es una frase de prompt. Estilo, composición y luz sí van con IA, y la interfaz dice «la IA rehace la imagen». | P2 | Fotógrafo (obligatorio 2) |
| D9 | **La distancia es una garantía, no una promesa.** Niveles con nombre y su porcentaje; el paso local `encuadrar` cumple el número midiendo la caja **del producto, sin sombra ni reflejo**. Hay aire mínimo en píxeles y la opción «misma escala en toda la serie». En una escena, la QA dice «no medido» en vez de inventar un número. | P1 (niveles) + P2 (medición) | Fotógrafo (obligatorio 4) y diseñador (obligatorio 5) |
| D10 | **Fondo blanco con máscara del sujeto**: umbral adaptativo, borde con antialias y sin halo, y la sombra como capa propia. Así no se come las sábanas blancas ni el mueble lacado. | — | Fotógrafo (obligatorio 3) |
| D11 | **Fidelidad medible** (forma y color dentro de la máscara del producto). «Lista» ≠ «Aprobada». «Probar con 3» viene encendido a partir de 10 fotos. El original nunca se toca. | P2 + P3 | Los tres |
| D12 | **Lenguaje de tienda.** El nombre visible está en español llano y el término técnico va como subtítulo: «Que se vea más clara» (Exposición +), «La cámara se acerca» (Push in), «Efecto vértigo» (Dolly zoom). | — | Diseñador (obligatorio 2) |
| D13 | **Menos es más al abrir.** La portada del banco muestra Favoritos, De PanaClaw, Recientes y de 6 a 8 recetas estrella según la puerta. Los grupos van plegados y el resto se encuentra con el buscador. | — | Diseñador (obligatorio 3) |
| D14 | **Canales de Panamá primero**: Web PanaClaw, IG feed 4:5, Historia/Reel 9:16, Cuadrícula 3:4, FB/IG Shop, Anuncio FB y WhatsApp Business. Amazon, Mercado Libre, Shopify y Etsy van en «Otras tiendas». | P1 (números) | Diseñador (obligatorio 4) |
| D15 | **El lote es un trabajo de agente**: `lotes.mjs` con una máquina de estados, goteo con un hueco libre para lo manual, presupuesto revisado antes de cada fila y fuera del tope de 400 trabajos. La vista Lotes lleva bitácora en voz de agente. | P2 (motor) + P3 (UI) | Los tres |
| D16 | **Dimitri no tiene un modo nuevo**: el modo `estudio` gana el campo `lote` y los creativos ganan `presets`. **GENERAR (`/api/sub/studio`) sigue siendo la única puerta.** Las acciones cerradas son `lote_pausar`, `lote_reanudar`, `lote_reintentar` y `lote_aprobar`, todas con clic. | P3 | Ingeniero |
| D17 | **Agentes:** `buscar_presets`, `aplicar_preset`, `crear_lote` y `estado_lote`. Un lote de agente por encima de N fotos o de US$X nace en `espera_ok`, en Aprobaciones. | P3 | Ingeniero (obligatorio 4: «no darles crear_lote es insuficiente») |
| D18 | **Primero se refactoriza.** F0 parte `media.mjs` en 4 módulos detrás de una fachada, en un PR propio, con un test de no regresión byte a byte. Sin ese PR en verde no entra ningún preset. | P2 | Ingeniero (obligatorio 2) |
| D19 | **Catálogo grande, primer corte pequeño.** El catálogo trae 127 de imagen, 53 de video y 8 de sonido, pero cada preset lleva `fase`. F1 sale con los 66 de imagen esenciales (catálogo y tiendas, atómicos de luz, color, limpieza y encuadre, y la referencia básica). Video en F5, música y voz en F6. Todo nace `beta` y pasa a `estable` tras probarlo con 5 fotos reales por familia de modelo. | P1 (catálogo) | Fotógrafo (9), diseñador (12) e ingeniero (7) |
| D20 | **Salida profesional**: sRGB con ICC incrustado, sin EXIF ni GPS, nombres por SKU (`SKU_01`), peso objetivo por canal y JPG sin submuestreo agresivo en los marketplaces. | — | Fotógrafo (obligatorio 7) |
| D21 | **Escalar y recortar con honestidad.** «Más grande (2K/4K)» y «Sin fondo (PNG)» llevan su campo `honestidad`. Solo se ofrecen como «fiel» con un escalador o una segmentación dedicados, o con la transparencia real de GPT Image. Si no, la tarjeta dice «regenera la imagen» o `check` lo marca «sin servir». | P1 (R3) | Fotógrafo (6) e ingeniero (7) |

Puntuación de los críticos (P1 / P2 / P3):
- fotógrafo: 7 / **9** / 7;
- diseñador: 7 / 8 / **9**;
- ingeniero: 7 / **8** / 7.

**Base:** el motor de P2, el catálogo de P1 y la experiencia de P3.

---

## 1. Por qué así: la investigación

Lo que más se repite en un trabajo de edición de producto, según foros de vendedores, guías de retoque y las herramientas líderes:
1. el fondo blanco puro, que es el motivo nº 1 de «Search Suppressed – Background isn't white enough» en Seller Central;
2. el encuadre y el margen por canal;
3. la sombra de contacto;
4. la luz y el balance de blancos;
5. el polvo, las rayas, las arrugas y los reflejos;
6. la exportación por tamaño y peso;
7. la consistencia de toda una serie.

Todo eso se hace **en lote**. Lo que cada herramienta hace bien y se copia:

| Herramienta | Lo que se copia | Fuente |
|---|---|---|
| **Photoroom** | Cada operación es un parámetro con valores con nombre: sombra (suave, dura, flotante), luz y quitar texto. La distancia es un número (`padding` de 0 a 0,49, `margin`, `alignment`, `scaling`). Tiene presets de canal (Amazon, Shopify, Etsy…) y un lote de 250 fotos en tres pasos con Visual QA. | docs.photoroom.com/getting-started/api-reference-openapi · photoroom.com/batch · help.photoroom.com/en/articles/14005668 |
| **Claid** | Una receta es una **cadena** de operaciones en una sola petición (restaurar → fondo → padding → tamaño → ajustes). Restaurar tiene nombres claros (decompress, polish, upscale). | docs.claid.ai/image-editing-api/api-reference · docs.claid.ai/guides/e-commerce |
| **Pixelz** | Granularidad por categoría y con nombre concreto: «Furniture Crease Reduction», «Keep Original Cast Shadow», «Remove Big Moles» frente a «All Moles». Especificación por marketplace con un clic. Alineación vertical de toda la serie. | pixelz.com/blog/glossary-retouching-product-images |
| **Pebblely** | Ambientes con nombre de lugar, «Sorpréndeme», tamaños con el nombre del destino y el costo visible antes del lote. | pebblely.com/blog/introducing-new-pebblely |
| **Lightroom** | Presets en grupos «Grupo: Variante» con su cantidad. La limpieza va separada (Dust, Reflections, People): es justo el «no tan general» del dueño. Point Color toca un solo color. | lightroomkillertips.com/adaptive-presets-in-lightroom-classic-part-1 · petapixel.com/2025/11/03/lightrooms-new-features… |
| **Adobe Firefly** | La referencia se separa en Style y Structure/Composition, cada una con su fuerza. Ángulo, Luz y Tono son chips combinables. Harmonize integra un producto pegado. | helpx.adobe.com/firefly/…/effects-for-text-to-image.html · …/match-image-composition-to-reference-image.html |
| **Midjourney** | Un parámetro por eje (`--sref` para el estilo, `--oref` para el objeto), cada uno con su peso, y se combinan el sujeto de una imagen y el estilo de otra. | docs.midjourney.com/…/Style-Reference |
| **Nano Banana** | Se edita con lenguaje: «cambia solo X, deja todo lo demás igual», con hasta 14 referencias y una cláusula para conservar el producto. | cloud.google.com/blog/…/ultimate-prompting-guide-for-nano-banana |
| **Color.io / fylm.ai** | «Copiar color» como acción propia que deja un `.cube` reutilizable en video. | color.io/ai-color-match · fylm.ai/ai-colour-grading |
| **Freepik / Krea** | Relight como herramienta propia y un Enhancer con «sabor» (producto, retrato, cine). | freepik.com/ai/docs/relight · krea.ai/enhancer |
| **Canva** | Verbos de una palabra. Bulk Create con CSV o XLSX: empareja las columnas solo y muestra una vista previa por fila. | canva.com/help/bulk-create-from-sheets |
| **Aftershoot / Imagen** | El perfil se aplica foto por foto adaptándose a cada una, y se puede «guardar como preset» desde una edición que gustó. | aftershoot.com/edit |
| **Flair** | Kit de marca («Look PanaClaw») con referencias fijas. | shotkit.com/flair-ai-review |
| **Higgsfield** (video) | Más de 70 movimientos de cámara con nombre y muestra, «un movimiento por clip» y recetas de producto que no piden prompt (Unboxing, Lazy Susan, Orbit, Dolly In, Hero Cam). | higgsfield.ai/camera-controls · memons.ai/higgsfield-prompt-cheat-sheet |
| **Firefly Video** | La cámara son tres selectores independientes: tamaño de plano, ángulo y movimiento. Se oculta lo que el modelo no admite. | helpx.adobe.com/firefly/…/set-shot-size-and-angle… |
| **Luma** | Escribir «camera» en el prompt abre el menú: aquí, `/` abre el banco. | lumalabs.ai/learning-hub/how-to-use-camera-motion |
| **Kling** | Intensidad, video de guía (motion control), fotograma inicial y final, Elements. | prompt-architects.com/blog/199-motion-and-camera-control-in-kling |
| **Runway Aleph** | Editar video real con verbos: nuevo ángulo, quitar objeto, reiluminar, cambiar la hora. | cined.com/runway-aleph-… |
| **Veo 3.1** | Fórmula oficial: cinematografía + sujeto + acción + contexto + estilo; audio con `SFX:` y `Ambient noise:`. | cloud.google.com/blog/…/ultimate-prompting-guide-for-veo-3-1 |
| **Premiere Lumetri** | Separa la **corrección técnica** del **look creativo**. Por eso aquí «Luz» y «Color» son una cosa y «Look» otra. | helpx.adobe.com/premiere-pro/using/looks-and-luts.html |
| **CapCut** | Formatos de salida por destino (Reel, Feed, YouTube) con proporción y duración ya puestas. | capcut.com/tools/auto-reframe |
| **Herramientas 360** (Pixelcut) | Giro 360 con solo velocidad y duración, y el aviso de qué productos salen mejor (los rígidos). | pixelcut.ai/create/360-product-video-generator |

**Números de los canales**, en `canales` del catálogo, cada uno con su fuente:
- Amazon: 2000 px, #FFFFFF, producto al 85 % (Seller Central G1881);
- Mercado Libre: 1600², al 80 % (las guías dicen de 60 a 95 %; lo decide el dueño);
- Shopify: 2048², webp de menos de 400 KB;
- Etsy: 2000×1500 con el cuadrado central del 75 %;
- IG: 1080×1350 en 4:5, 1080×1920 en 9:16 con 250 px seguros arriba y abajo, y la cuadrícula 3:4 desde enero de 2026;
- anuncio de FB: 1200×628, generado en 16:9 y recortado;
- WhatsApp Business: 1080², **por verificar**.

---

## 2. Decisiones del dueño (antes de construir; nadie las toma en silencio)

1. **¿Tres puertas o dos?** Recomendamos tres: «Desde cero», «Mejorar mi foto» y «Copiar de una referencia». «Mi cama» y «este anuncio» tienen papeles opuestos: una se conserva y la otra solo se imita. Si se juntan, el modelo acaba copiando el producto del anuncio. «Tu foto + una referencia» vive dentro de la tercera puerta.
2. **`sharp` como dependencia nativa normal.** Tiene binarios para Windows x64 y Linux (CI). Recomendado: va en `dependencies` y `npm run check` comprueba que carga. Si algún día no carga, el banco no se rompe: los presets locales dicen «no disponible en esta máquina» y nada cae a IA. Esto concilia al fotógrafo, que lo quiere obligatorio, y al ingeniero, que no quiere que su ausencia rompa nada.
3. **Ocupación por defecto de la Web PanaClaw: 60 % («Con margen») o 70 %.** Hoy está en 60 %. Se cambia en Ajustes → Estudio → `media.canal`.
4. **Ocupación de Mercado Libre:** 80 % por defecto.
5. **¿Viajan los presets de marca por GitHub?** Necesitaría `!brain-panaclaw/Agents Office/presets/` en `.gitignore`. El repositorio puede ser público. Las referencias fijas (imágenes de la galería) **no viajan** nunca.
6. **Topes del lote:** filas por lote (100 por defecto) y umbrales de agente (10 fotos o US$2) a partir de los cuales hace falta tu OK.

---

## 3. Taxonomía

### 3.1 Tres puertas, un solo modelo por dentro

| Puerta (UI) | Qué pide | Modo deducido | Modelos |
|---|---|---|---|
| ✦ **Desde cero** | Nada: la idea y los presets | `cero` (imagen) · `texto` (video, música, voz) | todos los del tipo |
| 📷 **Mejorar mi foto** | 1 foto o varias (lote) | `foto` (imagen) · `anima` / `ab` (video) · `video` (editar un video) | solo los que editan (`editModels()`) o, en video, los que tienen el `role` |
| ◐ **Copiar de una referencia** | 1 referencia y, si quieres, «tu producto» | `ref` (sin foto propia) · `foto+ref` (con foto) · `refs` (video) | los que toman `reference`, con `maxRefs` ≥ las imágenes enviadas |

**El modo no se declara: se deduce de las entradas.** `modoDe(preset, entradas)` es una función pura. Un preset lista los modos que admite (`modos`) y el banco muestra en cada puerta solo los que encajan. Un preset que admite dos modos (por ejemplo un ambiente, con foto o sin ella) sale en las dos puertas.

### 3.2 Grupos (23)

Cada grupo tiene icono y frase. El orden es el de la interfaz.

**Imagen (13).** Catálogo y tiendas, Fondo, Sombra y reflejo, Luz, Color, Limpieza, Calidad, Encuadre y ángulo, Ambientes, Personas y ropa, Con una referencia, Piezas de marketing y Exportar.

**Video (7).** Movimiento de cámara, Distancia de la cámara, Producto en video, Look, Editar un video, Formato de salida y Sonido del video.

**Sonido (2).** Música y Voz.

**Todos (1).** De PanaClaw: los presets del dueño.

Siguiendo a Lumetri, «Luz» y «Color» son **corrección técnica** y «Look» es **creativo**. Por eso «Tono cálido», «Blanco y negro» y «Look de película» están en Color pero ocupan el eje exclusivo `look`.

### 3.3 Recetas y ajustes, ejes exclusivos

- **Receta** (`capa: receta`): un trabajo completo («Catálogo para la web, con margen»). Como mucho **una** por pila.
- **Ajuste** (`capa: ajuste`): una sola cosa. Se apilan.
- `incluye`: los ajustes que contiene una receta. Se expande de forma recursiva, sin ciclos ni repetidos. Un ajuste que ya está dentro de la receta sale como chip «ya incluido»; si se elige con otro valor (por ejemplo «fuerte»), ese valor manda.
- **Ejes exclusivos:** `fondo · sombra · escena · encuadre · angulo · camara · plano · look · formato · audio · salida`. El último elegido gana y se avisa: «Fondo: “Gris de estudio” sustituyó a “Blanco puro”», con DESHACER.
- **Se suman:** `limpieza · calidad · luz · color · estilo`.
- `excluye`: parejas imposibles, como «Fondo blanco» + «Ambiente cocina». Dan error con el nombre de las dos; nunca se mezclan en silencio.
- **Video:** un solo `camara` por clip, que es la regla de Higgsfield. Cinema Studio podría permitir hasta 3 con `apilable: true`; hoy ningún preset lo usa.

### 3.4 Nombres

El nombre visible está en lenguaje de tienda y `tecnico` es el subtítulo. Ejemplos del catálogo:
- «Que se vea más clara» · Exposición +
- «Ver lo que está oscuro» · Abrir sombras
- «Recuperar lo quemado» · Bajar altas luces
- «Que el blanco se vea blanco» · Balance de blancos
- «Arreglar foto de WhatsApp» · Quitar compresión
- «Fotos desde arriba, ordenadas» · Knolling
- «Desde abajo, que se vea imponente» · Contrapicado
- «La cámara se acerca» · Push in
- «Efecto vértigo» · Dolly zoom

---

## 4. Modelo de datos (el esquema único)

### 4.1 Un preset

Este es el ejemplo real del catálogo, recortado:

```json
{
  "id": "cat-web-panaclaw", "v": 1,
  "nombre": "Catálogo para la web, con margen",
  "icono": { "id": "marco", "d": "M4 8V4h4M16 4h4v4…" },
  "categoria": "catalogo",
  "frase": "Tu foto cruda → producto sobre blanco, centrado y con aire para recortarlo en la web.",
  "medios": ["image"], "capa": "receta", "modos": ["foto"],
  "ejes": ["limpieza","luz","color","fondo","sombra","encuadre","salida"], "exclusivo": false,
  "ejecutor": "local+ia",
  "entradas": [{ "rol": "sujeto", "medio": "image", "min": 1, "max": 1, "es": "Tu foto del producto", "ayuda": "…" }],
  "parametros": [{ "id": "canal", "tipo": "canal", "def": "web" }, { "id": "encuadre", "tipo": "encuadre", "valores": […], "def": "margen" }, …],
  "incluye": ["limp-polvo","luz-arreglar","color-blancos","fondo-blanco","sombra-contacto"],
  "ia": "turn this raw product photo into a clean, professional e-commerce catalog image …",
  "iaPorIntensidad": { "suave": "…", "normal": "…", "fuerte": "…" },
  "requiere": { "edit": true },
  "prefer": ["nano-banana-pro","nano-banana-2","gpt-image-1","qwen-image-3","nano-banana","flux-kontext","seedream-4","muse-image"],
  "post": ["fondo-blanco","encuadrar","exportar"],
  "qa": ["fondo-255","ocupacion","lado-min","sin-recorte","identidad"],
  "buscar": ["web","pagina","catalogo","margen","recortar","cama","mueble","bodega","para vender","que se vea pro", …],
  "estrella": true, "fase": 1, "estado": "beta",
  "prompt": { "conversacional": "Image 1 is the product photo to edit. Change only this: … Framing: {encuadre}. {idea} {conservar}",
              "instrucciones": "Edit the attached product photo.\nRequirements:\n- …\nMust stay unchanged:\n- {conservar}",
              "edicion-corta": "… {conservar}" }
}
```

### 4.2 Campos y reglas

| Campo | Regla |
|---|---|
| `id` | `^[a-z0-9-]{3,40}$`, único. El prefijo dice el grupo. Los del dueño empiezan por `mio-`; si usan el id de uno de fábrica, lo tapan. |
| `v` | Entero que sube con cada cambio. El trabajo guarda `id@v`, y «Repetir» usa esa versión y avisa si hay una más nueva. |
| `nombre` / `tecnico` / `frase` | El nombre va en lenguaje de tienda (máx. 48 caracteres). El técnico es el subtítulo y también un sinónimo. La frase tiene como mucho 140 caracteres. |
| `icono` | `{ id, d }`: un solo trazo SVG, viewBox `0 0 24 24`, `stroke="currentColor"`, `fill="none"`, trazo de 1,6 y extremos redondeados (el estilo de `I{}` en `src/studio.js`). Los 103 trazos están también en `iconos` del catálogo. |
| `categoria` | Uno de los 23 grupos. |
| `medios` | `image` · `video` · `music` · `audio` (los `KINDS` de `media.mjs`). |
| `capa` | `receta` o `ajuste`. |
| `modos` | Imagen: `cero`, `foto`, `ref`, `foto+ref`. Video: `texto`, `anima`, `ab`, `refs`, `video`. Sonido: `texto`. |
| `ejes` | Los ejes canónicos que toca. `exclusivo` se calcula (es un ajuste en algún eje exclusivo). |
| `ejecutor` | `local` (sharp, gratis y exacto) · `ia` (un modelo) · `local+ia` (la IA hace lo creativo y lo local garantiza el número) · `ajustes` (solo pone ajustes del modelo). |
| `entradas[]` | `rol`: `sujeto`, `referencia` (con `eje`), `inicial`, `final`, `guia`, `origen`, `extra` (logo o empaque) o `lut` (un `.cube`). Cada una lleva `medio`, `min`, `max` y el rótulo `es`. **Un preset de imagen nunca pide `inicial` ni `final`.** |
| `parametros[]` | `{ id, tipo, es, valores?, def }`. Los tipos compartidos (`tipos` del catálogo) son `intensidad`, `fuerza`, `encuadre`, `escalaSerie`, `alinear`, `lado`, `proporcion`, `color`, `texto`, `angulo`, `duracion`, `velocidad` y `canal`. También hay propios (`enum`, `texto`, `rango`, `multi`). Cada valor puede traer su fragmento `en`. |
| `ia` / `iaPorIntensidad` | El fragmento en inglés y sus tres variantes por intensidad. |
| `local[]` | Operaciones de `imagen-local.mjs` con sus valores por intensidad, por ejemplo `{op:'exposicion', ev:{suave:.2, normal:.4, fuerte:.7}}`. |
| `incluye` / `excluye` | Ids que existen. Sin ciclos. |
| `requiere` | `edit`, `refsMin`, `roles {start, end, video, reference}`, `settings` (por ejemplo `["imageSize"]` o `["background"]`) y `local`. |
| `prefer` | Orden de preferencia de modelos. Si no hay ninguno encendido, se usa `PREFER` de `media.mjs`. |
| `ajustesModelo` | Ajustes que fija el preset (`aspectRatio`, `duration`, `generateAudio`, `imageSize`, `style`…). Pasan por `cleanSettings`. |
| `post[]` / `qa[]` | Pasos locales después del modelo (§5.5) y comprobaciones (§5.7). |
| `honestidad` / `aviso` | Lo que el dueño debe saber («la IA rehace la imagen», «medido solo con fondo liso»). La tarjeta lo muestra **en texto**. |
| `buscar[]` | De 3 a 30 sinónimos en español (y algún término en inglés), sin tildes. Incluyen frases de quien no sabe vocabulario técnico. |
| `estrella` | Sale en la portada de su puerta. |
| `fase` / `estado` | La fase de construcción (1, 4, 5 o 6). El estado es `beta` hasta probarlo con 5 fotos reales por familia de modelo; después pasa a `estable`. |
| `prompt` | La plantilla por familia de modelo (§5.8), o `null` si el preset es local o solo pone ajustes. |
| `basadoEn` / `fijas` | Solo en los del dueño: `"cat-web-panaclaw@1"` y sus referencias de marca, como ids de la galería. |

### 4.3 Dónde vive cada cosa

```
src/presets-core.js           PURO, lo importan la página y el servidor: validar, expandir, modoDe, modelosPara,
                              compilar, buscar, resumen_es. (Como src/contenido-reglas.js.)
src/presets-buscar.js         PURO: normalizar, sinónimos, tolerancia de una letra, plurales, ranking.
presets/                      la fábrica (en el repo; build.mjs la incrusta para la demo file://)
  tipos.json canales.json familias.json iconos.json columnas.json
  imagen/<grupo>.json  video/<grupo>.json  musica/<grupo>.json
  luts/*.cube                 los looks locales (pastel, película cálida…)
presets.mjs                   servidor: carga la fábrica y el Cerebro, los mezcla, guarda el historial, rutas /api/media/presets*
imagen-local.mjs              sharp: medir, máscara, fondo-blanco, encuadrar, tonos, LUT, transferir color, exportar
verificar.mjs                 QA determinista (y la de visión, opcional)
lotes.mjs                     máquina de estados del lote, bomba y rutas
lotes-hoja.mjs                PURO salvo exceljs: leer Excel o CSV → filas
estudio-lote.mjs              PURO: validar el «lote» que propone Dimitri
src/studio-banco.js           hoja del banco, pila de chips, ejes de referencia, canal y encuadre, «Qué hará»
src/studio-lotes.js           pestaña Lotes: crear (3 pasos) y seguimiento
src/css/estudio-banco.css, src/css/estudio-lotes.css   (no crecen shell.html)
<cerebro>/Agents Office/presets/<id>.json             los del dueño
data/history/presets/<id>/<ts>.json                   cada versión anterior de un preset del dueño
data/media-lotes.json                                 los lotes (no viaja)
```

`docs/presets-catalogo.json` se parte en los archivos de `presets/` en F1, con un script de una vez.

---

## 5. El motor

### 5.1 Las firmas (`src/presets-core.js`)

```js
validar(preset, ctx)            → string[]                       // problemas en frases
expandir(pila, byId)            → { lista, avisos }              // incluye[], exclusivos (gana el último), excluye → error
modoDe(entradas, kind)          → 'cero'|'foto'|'ref'|'foto+ref'|'texto'|'anima'|'ab'|'refs'|'video'
modelosPara(lista, models, caps)→ [{ id, on, motivo? }]          // filtra por requiere y capsOf; ordena por prefer, luego por PREFER
compilar({ pila, params, entradas, idea, producto, model, models, byId, familias, tipos, canales, cifras, capacidades })
  → { modo, kind, model, alternativas, porque,
      request /* listo para media.submit */, local: { antes:[], despues:[] }, post, qa,
      pasos_es[], conserva_es, resumen_es, prompt, prompt_es?, costo, avisos[], errores[],
      preset: [{ id, v, params }] }
buscar(q, presets, { medio, modo, grupo, favoritos, recientes }) → [{ id, score, por }]
```

Un solo compilador para todos. Sin red ni `fs`, así que la página lo corre al instante para la vista previa y en la demo.

### 5.2 Editar o generar: una regla cerrada

| Entradas | Modo | Medios en la petición |
|---|---|---|
| Foto del dueño + preset de imagen | **editar** | `reference[0] = foto`, `versionOf = foto`; las referencias van detrás, en `reference[1..]` |
| Sin foto + preset de imagen | **generar** | solo las referencias, si las hay; sin `versionOf` |
| Foto + preset de video | **animar** | `start = foto`; con `ab`, `end = 2.ª foto` (en el bucle, la misma) |
| Video + preset de video | **editar-video** | `video = origen` (más `start` en motion control); `versionOf = video` |
| Preset que pide foto, sin foto | **error** | «Este preset trabaja sobre tu foto: súbela o elige uno de “Desde cero”» |

Si todo lo apilado es `local`, **no se llama a ningún modelo**: costo 0, al instante y con fidelidad perfecta. Si hay algo `ia`, se hace **una sola llamada** que junta todo lo de IA. Lo local se reparte en dos momentos:
- `antes`: enderezar y quitar la dominante, porque ayudan al modelo;
- `despues`: blanco puro, encuadre, LUT, igualar la serie y exportar.

### 5.3 Apilar, paso a paso

1. Expandir la pila: primero la receta, después los ajustes en el orden canónico de ejes. En un eje exclusivo gana el último y se avisa. Si hay un `excluye`, se da el error.
2. Resolver los parámetros: primero el valor por defecto del preset, luego el del canal y por último lo que eligió el dueño. `canal` fija la salida y `encuadre` fija la ocupación.
3. Repartir las entradas en los roles de `media.mjs`. Si el modelo no admite tantas, se rechaza **antes de gastar**.
4. Ranuras y plantilla de la familia (§5.8). Si el texto se pasa de `maxPrompt`, se recorta en este orden: estilo, escena, luz. **Nunca** se recortan `accion`, `conservar` ni `encuadre`.
5. Ajustes del modelo:
   - `aspectRatio` del canal, o el más cercano que admita el modelo (con `ratioOf`), y después `exportar` lo deja exacto;
   - `imageSize` en 2K si el canal pide más de 1024 px;
   - en video, `duration` y `generateAudio`;
   - todo pasa por `cleanSettings`.
6. Resumen en español para «Qué hará» (§7.4) y el prompt en inglés tras «Ver el prompt».

### 5.4 La referencia por ejes

La UI pasa `ejes: { estilo, color, composicion, luz, fondo, pose, producto }` con valores de 0 a 3: apagado, suave, normal o fuerte.

| Eje | Ejecutor | Qué se hace |
|---|---|---|
| **Color / LUT** | **local** | `transferir-color` (Reinhard en Lab, fuerza 0,4 / 0,7 / 1) **dentro de la máscara del producto o en toda la imagen**, según el preset. «Aplicar LUT (.cube)» usa la interpolación trilineal (17, 33 o 65). «Guardar este color como LUT» exporta un `.cube` de 33 para el lote y el video. |
| Estilo | IA | «Use Image n only for its visual style (medium, texture, mood); do not copy its objects, people, products, text, logos or brand names.» |
| Composición | IA | «…only as a layout guide: camera angle, framing, placement, negative space.» |
| Luz | IA | «relight … the lighting of the reference: direction, softness, color temperature.» Rotulado «la IA rehace la imagen». |
| Fondo | IA | «a background like the reference (materials, colors, depth); do not copy its objects.» |
| Pose | IA | Solo cuando hay una persona. |
| Producto | IA | **Nunca encendido por defecto.** «Mi producto en esa foto» solo reemplaza el producto de la referencia por el del dueño. |

**Negativo obligatorio** en toda referencia: «do not copy its objects, people, products, text, logos or brand names». Las fuerzas se traducen así: `baja` → «loosely inspired by», `media` → «following», `alta` → «closely matching».

### 5.5 Operaciones locales (`imagen-local.mjs`, con sharp)

| Operación | Cómo se hace | Para qué |
|---|---|---|
| `mascara(buf, original?)` | Máscara del sujeto. **(a)** Si hay original alineado, diferencia contra él más el color del borde. **(b)** Si no, distancia al color del borde con umbral adaptativo (Otsu sobre la franja del borde) y relleno de huecos. Devuelve la máscara del producto **y la de la sombra por separado** (zona baja, oscura y de bajo croma, contigua a la base). | Todo lo que mide o toca el fondo |
| `fondo-blanco` | Pone a 255 **solo lo de fuera de la máscara**, con un degradado de 1 a 2 px en el borde (antialias, sin halo). La sombra de contacto se conserva como capa propia (`sombra-conservar`) o se regenera suave. | Amazon y la web: un 255 garantizado **sin comerse las sábanas blancas** |
| `encuadrar({ocupacion, alinear, base, lado, aireMinPx, escalaSerie})` | Caja del **producto** (sin sombra ni reflejo). Escala hasta que el lado largo valga `ocupacion × lienzo`. Si el producto es muy apaisado (una cama 2:1 en 1:1), manda el lado largo con un aire vertical mínimo. Centra, o pone la base al `base` % del alto. Rellena con el fondo y aplica `aireMinPx` por lado. Con `escalaSerie: misma` usa una escala común: px por cm si hay medidas, o el mayor producto de la serie como referencia. | «La cama a cierta distancia»: el número sale del preset |
| `extender` | Agranda el lienzo con el color del fondo. Solo cuando el fondo es liso; si no, va a IA y se avisa. | «Dar más espacio alrededor» |
| `exposicion`, `sombras`, `altas`, `contraste`, `saturacion` (con piel protegida), `balance` (mundo gris o punto neutro), `dominante`, `temperatura`, `blanco-y-negro`, `auto-niveles` | `modulate`, `linear`, `gamma` y curvas por LUT 1D sobre el raw | Los atómicos de luz y color |
| `lut3d`, `transferir-color`, `exportar-lut`, `grano` | Se lee el `.cube` y se aplica en trilineal; Reinhard en Lab | Copiar color y LUT de verdad |
| `igualar-serie` | Mide la temperatura y la exposición de la foto patrón (la primera aprobada de la muestra) y las lleva a cada foto; también la línea del suelo (`apoyado`) | 40 camas sin 40 temperaturas distintas |
| `nitidez`, `ruido` | `sharpen` y mediana o bilateral suave | Calidad |
| `rotar-horizonte` | Detecta las líneas dominantes y endereza hasta ±5°. Lo que pase de eso va a IA. | Enderezar |
| `exportar` | sRGB con ICC incrustado, **sin EXIF ni GPS**, el lado y la proporción exactos del canal (recorta o rellena; 1,91:1 sale de 16:9), JPG 4:4:4 en los marketplaces, búsqueda binaria de la calidad hasta el peso objetivo y nombre `{sku}_{n}` | Salida profesional |
| `exportar-varios` | Un archivo por canal elegido | «Recortar para cada red» |

- **Dónde corre.** En `runJob`, después de recibir los bytes del modelo y antes de `store`, llamando a `imagenLocal.pipeline(buf, j.post, ctx)`. Lo local vive en su módulo, no mezclado con `store` (ingeniero, obligatorio 3).
- **Los crudos del modelo** se guardan en `media/.crudo/<job>-<n>.<ext>` durante 7 días y cuentan para el disco del semáforo.
- **El original nunca se toca**: el resultado es `versionOf`.

**Video.** No se añade ffmpeg en esta fase. El encuadre de un video se resuelve eligiendo una proporción que el modelo admita. Veo solo hace 16:9 y 9:16: para 4:5 o 1:1, el compilador prefiere Kling o Seedance y lo avisa.

### 5.6 Elegir el modelo

**`capsOf(m)`** se deriva del `CATALOG`, nunca se escribe a mano:

```js
{ familia, editar, maxRefs, proporciones, tamanos, start, end, video, refYFotogramas, transparencia, calidad, costo }
```

Sale de `roles`, `needs`, `settings`, `EDIT_MODELS` e `INFO`.

**`pickModel`** elige en tres pasos:
1. **Filtra** los modelos encendidos, que no sean `legacy`, del `kind` correcto, que cumplan el modo y `requiere`, con `maxRefs` ≥ las imágenes y con una proporción admitida (o convertible en local).
2. **Puntúa:** sube por estar en `prefer`, por calidad y por fidelidad (en catálogo, Nano Banana Pro y GPT Image arriba); baja por costo solo si el dueño eligió «Más barato» o si es un lote grande.
3. **Devuelve** `{ model, alternativas, porque }`. El «porque» se ve en la tarjeta y lo lee Dimitri.

Reglas fijas:
- Flux Kontext nunca recibe 2 imágenes.
- Veo nunca recibe 1:1.
- En Seedance, `start/end` y `reference` no van juntos.
- **Muse Image baja en catálogo**, porque busca referencias en la web.
- Si no hay nada encendido, se devuelve el mismo `no-edit-engine` de `editRequest`, con cómo encenderlo.

### 5.7 Fidelidad y QA (`verificar.mjs`)

**Capa 1: la cláusula de conservación.** Siempre va y un preset no puede quitarla:

> «Preserve the product exactly: same shape, proportions, materials, colors, label, logos and text. Do not add, invent or remove … Keep everything not mentioned exactly the same.»

**Capa 2: lo local, local.**

**Capa 3: la QA determinista (gratis).**

| `qa` | Comprueba |
|---|---|
| `fondo-255` | % de la franja del borde **fuera de la máscara** a 255 (≥ 98 %) |
| `ocupacion` | Caja del producto (sin sombra) a ±3 % del objetivo; en escenas, «no medido» |
| `sin-recorte` | La caja no toca ningún borde |
| `lado-min` / `proporcion` / `peso` | Los del canal |
| `alfa` | El PNG tiene transparencia real |
| `linea-suelo` | La base, a ±1 % de la línea de la serie |
| `identidad` | **IoU de silueta** (máscaras de 64×64 alineadas por la caja) ≥ 0,85 **y ΔE2000 del color medio dentro de la máscara** ≤ 6 |
| `delta-e` | Para «Color fiel» e «Igualar a la patrón» |
| `sin-texto` | Solo en Amazon, con visión: opcional y con su costo |

**Capa 4: la QA de visión, opcional** (`qa: 'auto'`, unos US$0,001 por foto con Gemini Flash). Recibe la original y el resultado y responde un JSON:

```json
{ "mismoProducto": …, "logosInventados": …, "textoCambiado": …, "partesFaltantes": …, "fondoLimpio": …, "nota": "" }
```

Esa respuesta es **dato, no órdenes**.

**Si algo falla:** un reintento automático con más fidelidad («If unsure, leave the product untouched») y otra semilla. Si vuelve a fallar, la foto queda en **«Revisar»** con el motivo en una frase. Nunca queda «Lista».

### 5.8 Familias de prompt

Están en `familias` del catálogo y los modelos se asignan por patrón con `familiaDe(id)`. Cada preset trae su plantilla por familia en `prompt`, con estos marcadores:
- `{idea}`: lo que escribió el dueño;
- `{producto}`: el nombre o la fila del lote;
- `{conservar}`: la cláusula de la familia;
- `{encuadre}`: el fragmento del nivel de encuadre;
- `{p.<id>}`: el fragmento de un parámetro;
- `{n1}`: el número de la referencia (2 con foto propia, 1 sin ella);
- `{cifras.precio}`: un valor de `cifras.json`, **nunca del preset**.

| Familia | Modelos | Forma |
|---|---|---|
| `conversacional` | nano-banana*, muse-image, mmx-image-01 | «Image 1 is… Image n is a reference for X only… Change only this: … Framing: … {conservar}» |
| `instrucciones` | gpt-image-1 | Lista de requisitos más «Must stay unchanged» |
| `edicion-corta` | flux-kontext, qwen-image-3, seedream-4, grok-imagine-2 | Imperativo de una frase, como mucho 600 caracteres |
| `descriptiva` | soul*, z-image-turbo, recraft*, ideogram*, marketing-studio*… | Solo desde cero: describe la foto final |
| `veo` | veo-* | Cinematografía + sujeto + acción + contexto + look; `SFX:` y `Ambient noise:` |
| `kling` | kling-* | Un movimiento; «static camera» si la cámara está fija |
| `seedance` | seedance-* | Plano y lente primero |
| `minimax-video` | mmx-h3*, minimax-*, hailuo-* | Texto llano. **Los corchetes de cámara (`[Push in]`…) no están en `docs/minimax/api-verificada.md`: no se usan hasta verificarlos.** |
| `video-generico` | wan, ltx, pixverse, happy-horse, grok-imagine-video, cinema-studio, genjutsu | Cámara, plano, sujeto y look |
| `musica-minimax` / `voz-minimax` | mmx-musica-*, mmx-voz-* | Solo `settings.style`, `instrumental`, voz, emoción y velocidad; el texto es el del dueño, literal |

### 5.9 Lo que necesita `media.mjs` (después de F0)

1. `submit(req)` acepta y guarda (con `trail()`), en el trabajo y en el `.json` de cada archivo:
   - `preset: [{id, v, params}]`;
   - `lote: {id, fila}`;
   - `post` y `qa`.
2. `runJob` pasa por `imagenLocal.pipeline` antes de `store`. El registro guarda `post: { pasos, medido: { ocupacion, bbox, fondoBorde, iou, deltaE } }`.
3. `saveJobs`: un trabajo con `lote` vivo **no cuenta** en el `.slice(-400)` ni en la semana.
4. Un hook nuevo, `hooks.onItem(job, item)`, para pintar el lote foto a foto.
5. `editRequest` pasa a ser un caso del compilador (pila `[{ id: 'libre', texto }]`), con la misma firma.
6. `estimate()` acepta un plan: el `unitCost` del modelo + la QA de visión (si va) + 0 por lo local.
7. `gpt-image-1` gana el ajuste `background` (`auto`, `transparent`, `opaque`) en `CATALOG`, para que «Sin fondo (PNG)» sea honesto.

---

## 6. El lote

### 6.1 Entrada (cuatro formas)

1. **Una carpeta de la galería**: «las de la carpeta Bodega».
2. **Las seleccionadas**: la barra de selección gana «Editar en lote…».
3. **Fotos soltadas en el Estudio**: se suben con el `upload` de siempre a una carpeta nueva «Lote <fecha>».
4. **Un Excel o un CSV** (`lotes-hoja.mjs`, con exceljs). Las columnas se emparejan solas por sinónimos (`presets/columnas.json`), sin mayúsculas ni tildes, y hay un desplegable para corregirlas:

| Campo | Columnas que acepta |
|---|---|
| foto | foto, imagen, archivo, file, id, ruta |
| sku | sku, código, referencia |
| nombre | nombre, producto, título |
| preset | preset, receta, edición, estilo (el id o el nombre, resuelto con `buscar()`, y varios con `+`) |
| canal | canal, destino, tienda, marketplace |
| encuadre | encuadre, distancia, margen |
| notas → `idea` | notas, instrucciones, idea, comentario |

**Las fotos de un Excel se buscan en este orden:**
1. imágenes **incrustadas** en la fila (`ws.getImages()`);
2. un **nombre de archivo** que coincide con las fotos soltadas junto al Excel o con una carpeta elegida;
3. un **id de la galería**;
4. una **URL https**: apagada por defecto. Si se enciende en Ajustes, solo pasan imágenes de hasta 15 MB y sin IP privada (SSRF).

**Nunca se aceptan rutas del disco** (`C:\…`).

Las `notas` entran **como datos, no como órdenes**, y pasan por `safety.injectionIn`. Una fila sin foto válida queda en «Revisar» y no gasta nada.

### 6.2 Estado (`data/media-lotes.json`)

Se escribe con escritura atómica, como `saveJobs`. Hay un solo registro y una sola máquina de estados.

```json
{ "id": "L…", "nombre": "Camas bodega → web", "by": "you|dimitri|agent", "agent": null, "task": null, "sub": { "msg": "…" },
  "receta": { "pila": [{ "id": "cat-serie-muebles", "params": { "encuadre": "apoyado" } }], "canal": "web",
              "ejes": null, "refs": {}, "modelo": "nano-banana-2", "patron": null },
  "estado": "previsto|espera_ok|muestra|corriendo|pausado|hecho|cancelado",
  "muestra": 3, "concurrencia": 2, "tope": { "usd": 15, "fotos": 100 }, "qa": "auto", "carpeta": "c…",
  "costo": { "estimado": 1.56, "gastado": 0.94 },
  "filas": [{ "n": 12, "src": "2026-10/…cama-roma.jpg", "sku": "CM-140", "nombre": "Cama Roma 140", "notas": "", "pila": null,
              "estado": "en_cola|editando|verificando|lista|revisar|aprobada|fallo|omitida",
              "job": "j…", "out": "2026-10/…", "intentos": 1, "error": null,
              "medido": { "ocupacion": 0.71, "fondoBorde": 0.996, "iou": 0.93, "deltaE": 2.1 } }],
  "bitacora": [{ "at": 0, "n": 14, "t": "El fondo quedó en 248, no en 255. La pongo para revisar." }],
  "creado": 0, "inicio": 0, "fin": 0 }
```

### 6.3 El ciclo

- **`prever`** compila cada fila sin enviar nada. Devuelve las 5 primeras con su prompt, modelo, avisos y costo, el total, y si cabe en el tope del día, del mes y del lote (`checkBudget`, `dailyLimit`; un video cuenta 5).
- **«Probar con 3»** viene **encendido a partir de 10 fotos**. Corre 3 filas y pasa a `pausado`. Las aprobadas pueden ser la **foto patrón** de la serie.
- **La bomba** (`tickLote`, con `onDone` y un intervalo de 5 s):
  - mete trabajos **por goteo**, como mucho `concurrency − 1`, para dejar siempre un hueco a lo manual;
  - **antes de cada envío** vuelve a mirar el presupuesto y el tope del lote; si no cabe, pasa a `pausado` con el motivo;
  - un 403 o un aviso de créditos **pausa el lote entero**.
- **Al terminar cada trabajo:** `verificar` y la fila pasa a `lista`, a `revisar` o a reintento. Hay como mucho 2 reintentos, con el backoff de `reliability.mjs` para los fallos pasajeros.
- **Las acciones por fila son idempotentes**: aprobar o reintentar dos veces no gasta dos veces.
  - `aprobar` marca `used` y enseña a la memoria (`learn()`).
  - `reintentar` admite «más fuerte» (sube la intensidad del paso que falló la QA) o «con otro modelo».
  - `omitir` salta la fila.
- **Reinicio de la oficina:** el estado se recalcula a partir de los trabajos, sin duplicar. Las filas `editando` con su trabajo vivo siguen el poll de `loadJobs`; las demás vuelven a `en_cola`.
- **Al final:**
  - un ZIP de las aprobadas nombrado por `SKU_n`;
  - un CSV de resumen con fila, original, resultado, estado, motivo y costo;
  - una nota en el Cerebro (`<cerebro>/Agents Office/estudio/AAAA-MM/<fecha> lote <nombre>.md`, con la tabla de antes y después);
  - un aviso y Telegram: «Lote listo: 37 listas, 2 para revisar, 1 falló».

### 6.4 API

```
GET  /api/media/presets?medio=&modo=&q=          → la mezcla de fábrica y Cerebro, cada uno con modo, modelos encendidos y on
POST /api/media/presets/compile                    { pila, entradas, idea, model? } → el plan (no gasta)
POST /api/media/presets/apply                      { …compile, by, agent?, task? }  → trabajo(s)
POST /api/media/presets                            { desde: <file|job>, nombre }     → «Guardar como preset» (en el Cerebro)
DELETE /api/media/presets/<id> · GET /api/media/presets/<id>/versiones
POST /api/media/lotes/hoja                         { name, data(base64) } → { columnas, filas, avisos } (no crea nada)
POST /api/media/lotes                              { origen, receta, tope?, qa?, by } → lote «previsto» + vista previa
GET  /api/media/lotes[/<id>] · GET /api/media/lotes/<id>/{zip|csv}
PATCH /api/media/lotes/<id>                        { accion: probar|iniciar|continuar|pausar|reanudar|cancelar }
POST /api/media/lotes/<id>/filas                   { accion: aprobar|reintentar|omitir, filas, modelo?, mas_fuerte? }  (idempotente)
```

Los errores van en español, con su código HTTP: 409 para «no cabe en el presupuesto» y «lote pausado», 400 para un Excel con rutas del disco.

---

## 7. La interfaz

### 7.1 Dónde vive

El banco **no es una vista nueva ni un modal**: es parte del compositor del Estudio.
- Es una hoja `aside.st-bank` con `role="region"` y `aria-label`; no llama a `modal.open`.
- Se abre con el botón, con la tecla **B** (con el Estudio abierto) o con `/` al principio de una línea del prompt.
- En escritorio tapa la galería; a 600 px o menos ocupa la pantalla entera (`@container` sobre `#studioOv`).
- Los lotes son una pestaña nueva, **Crear · Galería · Lotes**, con la tecla **L**.
- Las teclas B y L van en `KEYS` de `src/main.js`.
- Ctrl+K también encuentra presets: abre el banco con ese preset marcado.

### 7.2 Boceto a 1512 px (Estudio, puerta «Mejorar mi foto», banco abierto)

```
┌ ESTUDIO ─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [Crear] Galería  Lotes                                                                                       │
│ ┌ Compositor ───────────────────────────────┐ ┌ Banco de presets ──────────────────────────────── ✕ ┐        │
│ │ Tipo: (Imagen) Video Voz Música            │ │ 🔍 [ se ve oscura                       ] 4 result.   │        │
│ │ ¿De dónde partes?                          │ │ (Imagen) Video Sonido · Desde cero|Mi foto|Ref         │        │
│ │  ✦ Desde cero │📷 Mejorar mi foto│ ◐ Ref   │ │ ── Resultados ─────────────────────────────────────── │        │
│ │ [foto cama-bodega.jpg ▢]                   │ │ [☀↑] Que se vea más clara · Exposición +   gratis ★│        │
│ │ ── Presets ─────────────────────────────── │ │ [◐ ] Ver lo que está oscuro · Abrir sombras gratis ★│        │
│ │ [▦ Banco B] [Catálogo web · 5 pasos ▾ ✕]   │ │ [☀ ] Arreglar la luz (todo)               gratis ★│        │
│ │            [+ Arrugas de sábanas ✕]        │ │ [▦ ] Arreglar color, luz y sombras        gratis ★│        │
│ │ Opcional: algo más (p. ej. «la madera se…»)│ │                                                        │        │
│ │ ── Para dónde y a qué distancia ────────── │ │ (sin búsqueda la portada muestra:                      │        │
│ │ Canal: [Web PanaClaw] IG 4:5  Historia      │ │  ★ Favoritos · ◆ De PanaClaw · ⟲ Recientes            │        │
│ │        FB/IG Shop  Anuncio  WhatsApp ▸ Otras│ │  Estrella: Catálogo web · Serie de muebles · De la   │        │
│ │ Distancia: Detalle─Medio─Aire─[Margen]─85% │ │  bodega a pared limpia · Proveedor a catálogo ·       │        │
│ │  ┌──────────┐  El producto ocupa el 60 %    │ │  Limpieza completa · Arreglar color…  ▸ ver grupos)   │        │
│ │  │  ┌────┐  │  · aire mínimo 164 px por lado │ └────────────────────────────────────────────────────────┘        │
│ │  │  │cama│  │  · se recorta a 4:5 sin cortar │                                                                  │
│ │  │  └────┘  │  Alinear: Auto (muebles: base) │                                                                  │
│ │  └──────────┘  Serie: ○ llenar ● misma escala│                                                                  │
│ │ ▾ Qué hará · US$0,04 · Nano Banana 2        │                                                                  │
│ │  1. Limpia polvo y arrugas (IA, solo zonas) │                                                                  │
│ │  2. Luz y blancos (en tu máquina, gratis)   │                                                                  │
│ │  3. Fondo blanco 255 con la sombra suave    │                                                                  │
│ │  4. Producto al 60 %, base al 85 %, 2048²   │                                                                  │
│ │  No cambia: forma, color, tela, etiquetas.  │                                                                  │
│ │  ▸ Ver el prompt (inglés, con traducción)   │                                                                  │
│ │                     [ GENERAR · US$0,04 ]   │                                                                  │
│ └────────────────────────────────────────────┘                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Boceto a 390 px

```
┌ Estudio ───────── ⋯ ┐        ┌ Banco ─────────── ✕ ┐       ┌ Lote · Camas → web ── ⏸ ┐
│ Crear Galería Lotes │        │🔍[ cama          ] 6│       │█████████░░ 24/40        │
│ ✦ Cero 📷 Foto ◐ Ref│  B →   │ Img Video Sonido    │       │2 revisar · 1 falló · ~6m│
│ [▢ cama.jpg]        │        │ Cero|Foto|Ref  →    │       │US$0,94 de 1,56          │
│ [Catálogo web ▾]→   │        │[▦] Catálogo web…  ★ │       │Todas Revisar(2) Fallo(1)│
│ [+Arrugas] +2       │        │[▤] Serie de mueb. ★ │       │┌──────┬──────┐ #12 ✓   │
│ Canal: Web ▾        │        │[🛏] Dormitorio    ★ │       ││antes │despué│ CM-140   │
│ Distancia ●───── 60%│        │[🛏] Habitación con… │       │└──────┴──────┘ ⋯        │
│ ▸ Qué hará · $0,04  │        │  (tarjetas de 44 px,│       │#14 ⚠ fondo 248 [Reint.] │
│ [ GENERAR ]         │        │   1 columna)        │       │[Aprobar listas][ZIP]    │
└─────────────────────┘        └─────────────────────┘       └─────────────────────────┘
```

### 7.4 Piezas

- **Tarjeta del banco.** Es un `<button aria-pressed>` de 44 px como mínimo. Lleva:
  - el icono de 20 px;
  - el nombre (13 px) y el técnico como subtítulo (11,5 px);
  - una línea de texto con la marca: «gratis · en tu máquina», «la IA rehace la imagen», «necesita tu foto», «solo con Nano Banana / GPT Image…» o «sin motor: actívalo» (abre `keyHelp()`).

  La ★ es un botón **hermano, no anidado**. Nada se apaga con `opacity`.
- **Pila de chips.** Los chips están en orden de ejecución. Una receta es **un chip con contador** («5 pasos ▾») que se despliega. Cada chip tiene un popover con Suave · Normal · Fuerte (`aria-pressed`), Quitar y «Ver qué hace». Si un preset reemplaza a otro, sale un toast con DESHACER.
- **Ejes de referencia** (puerta ◐). Cada eje es un `role="switch"` con un segmentado de 3. Vienen encendidos Estilo y Color/LUT. Atajos: «Todo el look», «Solo color (LUT)», «Solo composición» y «Hazlo como este anuncio». En video: Look, Movimiento de cámara y **Movimiento del sujeto** (pide un video de guía y cambia a Kling Motion o Genjutsu).
- **Canal y encuadre.** Arriba van los chips de los canales de Panamá y después «Otras tiendas». La distancia es un `range` con `list` y 5 o 6 paradas con nombre. La **maqueta en vivo** usa la silueta real de la foto con el margen sombreado, y se describe con una frase: «ocupa el 60 % · aire mínimo 164 px · se recorta a 4:5 sin cortar». Sin sharp, el control dice «aprox.».
- **«Qué hará».** Un `details` con los pasos en español, qué no cambia, qué va en local (gratis) y qué con IA, el modelo con su «porque», el costo y los avisos. «Ver el prompt» muestra el inglés con su traducción.
- **Buscador** (`src/presets-buscar.js`). Puntúa:
  - el nombre empieza por lo buscado: 100;
  - sinónimo exacto: 80;
  - un uso («cama», «amazon»): 60;
  - el grupo: 30;
  - error de una letra en palabras de 5 o más letras: ×0,6;
  - favorito: +15; reciente: +10; algún modelo encendido: +5.

  Normaliza minúsculas, tildes y plurales simples, y busca a cada tecla. Si no encuentra nada: «Nada con “x”. [Pedírselo a Dimitri]», que abre el chat con el texto y la foto. El número de resultados va en `aria-live="polite"`.
- **Favoritos y recientes:** en `localStorage`, `ao.studio.presets.fav` y `.rec` (los 12 últimos), con try/catch.
- **«Guardar como preset»** en el menú «⋯» de la tarjeta de la galería y en el visor. Toma la pila, los parámetros, el canal y las referencias fijas de ese trabajo, y su antes y después real pasa a ser la miniatura del preset.
- **Lotes.**
  - Crear en 3 pasos: Fotos → Receta (el mismo banco, más canal y encuadre, más «Probar primero con 3») → Revisar y lanzar (5 filas, modelo, costo y lo que queda hoy).
  - El seguimiento es la barra de §7.3 más:
    - filtros por estado;
    - un botón **Antes | Después** por fila (más el `range` en el visor);
    - por fila: Aprobar, Otra versión, Reintentar, Reintentar más fuerte y Cambiar modelo;
    - la **bitácora** plegada, en voz de agente y solo con datos reales.
  - En el teléfono, cada fila es una tarjeta con las acciones en «⋯», el progreso fijo arriba y «Aprobar todas» y «ZIP» fijos abajo.
- **Accesibilidad:**
  - objetivos de 24 px (44 en el teléfono) y nada por debajo de 10,5 px;
  - 4,5:1 en claro y oscuro, también los tokens de color por grupo (`--pg-catalogo`…);
  - foco con `var(--focus)`;
  - en los grupos, ↑↓ con roving tabindex, Enter añade, Espacio marca ★ y Esc cierra y devuelve el foco;
  - el progreso del lote se anuncia cada 10 % o en cada fallo;
  - todo movimiento respeta `prefers-reduced-motion`.
- **Pruebas de pantalla:** a 390, 360 y 320 px **con el aviso «⚠ N» encendido**; a 1024, 1366 y 1512 px **con Dimitri abierto**; y en la demo `file://`, donde la fábrica va incrustada y el lote corre con el motor «prueba» en memoria.

---

## 8. Dimitri y los agentes

### 8.1 Lo que Dimitri lee

- **`STUDIO_ASK`** (en `serve.mjs`) gana palabras: `cat[aá]logo|lote|preset|fondo blanco|recort|margen|bodega|retoc|sombra|luz|amazon|mercado ?libre|shopify|excel|hoja|lut|referencia`.
- **`studioPromptBlock`** añade «PRESETS (usa SOLO estos ids)». Es compacto, como mucho 2.500 caracteres, y **solo entra en los mensajes del Estudio** (DIM-04). Contiene:
  - los ids por grupo;
  - los 5 más relevantes al mensaje con su frase (vía `buscar()`);
  - los canales y los ejes de referencia;
  - la regla: «LOTE: propónlo con más de 4 fotos o con un Excel».
- **Un Excel o CSV adjunto** sube por `/api/media/lotes/hoja`. Dimitri recibe el **resumen** (cabeceras, número de filas, 5 filas de muestra y las filas sin foto) dentro de `<datos>`, nunca como órdenes. «Estas 40 fotos» llegan por carpeta o por Excel, no como 40 adjuntos (`MAX_ATTACH` no aplica).
- **`sub.mjs → systemPrompt`:**
  - «Si el dueño nombra una tarea de edición (fondo blanco, Amazon, luz, polvo, LUT…), usa presets en vez de escribir el prompt.»
  - «Si falta el canal, la distancia o qué fotos, NO propongas el lote: haz UNA pregunta con 2 a 4 opciones», con los botones de DIM-06, por ejemplo «¿Para dónde son? [Web con margen 60 %] [Instagram 4:5] [FB/IG Shop] [Amazon 85 %]».

### 8.2 El contrato JSON (modo `estudio`)

```json
{ "mode": "estudio", "reply": "…",
  "creatives": [{ "kind": "image", "presets": [{ "id": "cat-web-panaclaw", "params": { "encuadre": "margen" } }],
                  "input": "2026-10/…lampara.jpg", "refs": [], "ejes": null, "canal": "web", "idea": "que se vea la madera",
                  "model": null }],
  "lote": { "nombre": "Camas bodega → web",
            "fotos": { "carpeta": "Bodega" },
            "receta": { "pila": [{ "id": "cat-serie-muebles" }, { "id": "limp-arrugas", "params": { "intensidad": "fuerte" } }],
                        "canal": "web", "ejes": null, "refs": {} },
            "modelo": null, "muestra": 3, "carpeta_destino": "Catálogo web",
            "por_que": "Muebles: los alineo por la base para que la web se vea pareja." },
  "actions": [], "questions": [] }
```

`fotos` puede ser `{ "carpeta" }`, `{ "ids": [...] }` o `{ "hoja": "<id de la hoja>" }`.

**Validación** (`estudio-lote.mjs` y `parseCreatives`, que llaman a `compilar()`):
- los ids desconocidos se descartan **diciéndolo**;
- un preset que no sirve para el modo se cambia por su equivalente o queda como aviso;
- el modelo debe cumplir `requiere`, o se cambia por el primero que lo cumpla;
- las fotos tienen que estar en la galería, como máximo `lotes.max`;
- la carpeta se resuelve sin mayúsculas ni tildes;
- se calculan el costo y `fits`.

Un creativo con presets **no necesita prompt**. El resultado es `{ lote, estimate: { total, porFoto, fits, why }, state: 'proposed'|'skipped', error? }`.

### 8.3 La tarjeta y los botones

```
LOTE · Camas bodega → web
[▫▫▫▫▫▫▫▫ +32]   40 fotos de «Bodega»
Receta: [Serie de muebles ▾] [Arrugas · fuerte] [Web 2048² · apoyado · misma escala]   (chips editables)
Modelo: Nano Banana 2 ▾ · aprox. US$1,56 · cabe hoy
[PROBAR CON 3 · US$0,12]   [GENERAR LAS 40]   Descartar
```

- **GENERAR sigue siendo la única puerta.** `POST /api/sub/studio {msg, items, lote: {muestra, ediciones}}` extiende `subStudio`; no hay ruta nueva. Revalida con `estudio-lote.mjs` y llama a `lotes.crear({..., by: 'dimitri'})`.
- **Al terminar la muestra**, Dimitri escribe «Listas 3 de prueba: ¿sigo con las 37?» con [SEGUIR] y [CAMBIAR RECETA]. SEGUIR va por la misma ruta con `lote.continuar: true`.
- **La tarjeta está viva**: `subJobDone` actualiza el mensaje con `lote: {id, hechas, revisar, fallo, total}` y lleva un botón «Ver el lote».
- **Acciones cerradas en `ACTIONS`**, que solo se ejecutan con un clic:
  - `lote_pausar`;
  - `lote_reanudar`;
  - `lote_reintentar {filas|'fallidas', modelo?}`: **gasta**, y la tarjeta enseña el costo;
  - `lote_aprobar {filas|'listas'}`: no envía nada fuera de la máquina.

### 8.4 Agentes (`estudio-mcp.mjs`)

Solo se muestran si hay un motor que los sirva (`has()`):

```js
buscar_presets { texto, medio?: 'imagen'|'video'|'musica'|'voz', modo?: 'cero'|'foto'|'ref' }
  → [{ id, nombre, frase, entradas, parametros, modelosEncendidos }]
aplicar_preset { presets: [{id, params?}], foto?, referencia?, ejes?, canal?, idea?, modelo? }
  → UNA pieza, por compile + submit, con by:'agent'
crear_lote     { nombre, presets, carpeta?|fotos?, canal? }
  → si pasa de lotes.agenteSinOk (10 fotos) o de lotes.agenteUsd (US$2), nace «espera_ok» en ⚠ Aprobaciones
    con «Lo que saldrá»: N fotos, receta y costo. Devuelve «⏳ Estudio: lote «x» (lote <id>)»; la oficina cambia esa
    línea por un resumen con miniaturas al terminar
estado_lote    { lote }
```

- Van en `INTERNAL` de `safety.mjs`, porque no envían nada fuera.
- Ninguna herramienta aprueba lo que espera el OK del dueño.
- Skill sugerida para Marketing: `<cerebro>/Agents Office/skills/catalogo-fotos/SKILL.md`. Dice qué preset y canal usa PanaClaw y señala la nota de canales, **sin números de precio**.

---

## 9. Seguridad y costos

- **Dinero:**
  - antes de **cada** envío (lote, Dimitri o agente) se miran `checkBudget()`, `dailyLimit` (un video cuenta 5), `dailyBudget`, `monthlyBudget` y el tope del lote;
  - un 403 o un aviso de créditos pausa el lote entero;
  - «Probar con 3» va por defecto desde 10 fotos;
  - el costo se ve antes de gastar, en la tarjeta, en «Qué hará» y en el paso 3 del lote;
  - lo local cuesta 0 y lo dice;
  - la QA de visión va apagada por defecto y, encendida, suma su costo a la estimación;
  - cada llamada va al registro de costos como siempre, con `preset` y `lote` para poder desglosar.
- **Quién gasta:**
  - el dueño, con GENERAR;
  - Dimitri, solo con el clic GENERAR o SEGUIR;
  - un agente, sin OK solo hasta los umbrales y, por encima, con aprobación.
- **Excel:**
  - nunca rutas del disco;
  - URL apagada por defecto (si se enciende: https público, 15 MB, solo imagen y sin IP privada);
  - notas por `injectionIn`;
  - tope de filas configurable (100).
- **Privacidad:**
  - `exportar` quita EXIF y GPS (las fotos de la bodega llevan la ubicación);
  - los presets del dueño y sus referencias quedan en el Cerebro; **las imágenes no viajan por GitHub**.
- **Referencias ajenas:**
  - el negativo «no copiar logos, marcas ni textos» es obligatorio;
  - Producto nunca viene encendido;
  - «Oferta o precio» toma el precio de `cifras.json`, nunca del preset.
- **Disco:** los crudos se borran a los 7 días y cuentan en el semáforo; `media/.crudo` no viaja.

---

## 10. Refactors

| Refactor | Por qué | Cómo se prueba que no rompe nada |
|---|---|---|
| **F0: partir `media.mjs`** (1.211 líneas) en `media/catalogo.mjs` (CATALOG, INFO, PREFER, EDIT_MODELS, `settingsFor`, `unitCost` y el nuevo **`capsOf`**), `media/motores.mjs`, `media/galeria.mjs` y `media/trabajos.mjs`, detrás de una **fachada** `media.mjs` que reexporta lo mismo | El banco va a tocar este archivo más que ningún otro | Los tests actuales intactos y en verde (higgsfield, google, meta, media-names, media-folders…). Un test nuevo compara **byte a byte** `models()`, `editRequest()` y `estimate()` antes y después. PR propio y aviso al equipo (regla 6). |
| `editRequest` → caso del compilador | Un solo camino para editar | La misma firma y el mismo test |
| `saveJobs` con la excepción de lotes vivos | Un lote de 250 fotos echaría fuera a los demás trabajos | `tests/lotes.test.mjs` |
| `documents.mjs` gana `filasDe(buf, ext)` | El lote necesita filas, no Markdown | `tests/lotes-hoja.test.mjs` |
| El paso 1 y el paso 5 del compositor de `src/studio.js` solo **enganchan** `studio-banco.js` | `studio.js` tiene 1.696 líneas: no debe crecer | Las capturas de `scripts/estudio-capturas.mjs`, más combinaciones nuevas |
| `gpt-image-1` + `background` | «Sin fondo» honesto | `tests/presets-modelo.test.mjs` |

---

## 11. Plan de construcción (equipos en paralelo, con propiedad de archivos)

Cada equipo trabaja en su rama y con su PR hacia `main`, y **solo toca sus archivos**. Los archivos compartidos grandes (`serve.mjs`, `src/studio.js`, `estudio-plan.mjs`, `sub.mjs`, `src/main.js`) tienen **un solo dueño por fase** y se tocan **en secuencia**, avisando (regla 6 del equipo). `npm run check` en verde antes de cada PR.

### Fase F0 (bloqueante, 1 equipo)

| Equipo | Archivos | Entrega |
|---|---|---|
| **E0 Motor base** | `media.mjs` → `media/*.mjs` (fachada), `tests/media-fachada.test.mjs` | `capsOf`, cero cambios de comportamiento, test de no regresión |

### Fase F1 (el núcleo y el banco de imagen; 4 equipos en paralelo después de F0)

| Equipo | Archivos que son **suyos** | Entrega |
|---|---|---|
| **E1 Datos** | `presets/**` (lo parte del catálogo), `scripts/presets-partir.mjs`, `tests/presets-catalogo.test.mjs`, el paso «Presets» de `check.mjs` | Esquema validado (§12) e iconos |
| **E2 Compilador** | `src/presets-core.js`, `src/presets-buscar.js`, `tests/presets-core.test.mjs`, `tests/presets-buscar.test.mjs`, `tests/presets-modelo.test.mjs` | expandir, modoDe, modelosPara, compilar por familia, buscar |
| **E3 Imagen local** | `imagen-local.mjs`, `verificar.mjs`, `package.json` (sharp), `tests/imagen-local.test.mjs`, `tests/verificar.test.mjs` | máscara, fondo-blanco, encuadrar, tonos, LUT, transferir, exportar, QA |
| **E4 Banco (UI)** | `src/studio-banco.js`, `src/css/estudio-banco.css`, `tests/studio-banco.test.mjs` | Hoja, pila, ejes, canal y encuadre, «Qué hará» |
| **Integración F1** (E2, en secuencia) | `presets.mjs`, `media/trabajos.mjs` (submit, post, hooks), rutas en `serve.mjs`, enganches en `src/studio.js`, `KEYS` en `src/main.js`, `build.mjs` (fábrica en la demo) | Un preset de punta a punta |

### Fase F2 (lotes; 2 equipos)

| Equipo | Archivos | Entrega |
|---|---|---|
| **E5 Motor del lote** | `lotes.mjs`, `lotes-hoja.mjs`, `presets/columnas.json`, `tests/lotes.test.mjs`, `tests/lotes-hoja.test.mjs`; la excepción de lotes en `saveJobs` | Estado, bomba, Excel, ZIP y CSV, nota en el Cerebro |
| **E6 Lotes (UI)** | `src/studio-lotes.js`, `src/css/estudio-lotes.css`, `tests/studio-lotes.test.mjs` | Crear en 3 pasos, seguimiento, bitácora, Antes/Después |
| Integración F2 (E5) | rutas `/api/media/lotes*` en `serve.mjs`, pestaña Lotes y «Editar en lote…» en `src/studio.js`, tecla L | — |

### Fase F3 (Dimitri y agentes; 2 equipos, en secuencia sobre `serve.mjs`)

| Equipo | Archivos | Entrega |
|---|---|---|
| **E7 Dimitri** | `estudio-lote.mjs`, `estudio-plan.mjs` (bloque de presets, `parseCreatives`), `sub.mjs` (systemPrompt, ACTIONS), `src/sub-studio.js` (`loteHTML`), `subChat`/`subStudio`/`subJobDone` de `serve.mjs`, `tests/estudio-lote.test.mjs`, `tests/sub-studio.test.mjs`, `scripts/dimitri-recorrido.mjs` (recorrido «40 fotos de la bodega → web») | Lote por GENERAR, preguntas con opciones, tarjeta viva |
| **E8 Agentes** | `estudio-mcp.mjs`, `INTERNAL` en `safety.mjs`, el lote en `espera_ok` en `approvals.mjs`, `skills/catalogo-fotos/` (ejemplo de fábrica), `tests/estudio-mcp-presets.test.mjs` | 4 herramientas y aprobación |

### Fases F4 a F6

| Fase | Equipo | Entrega |
|---|---|---|
| **F4** | E1 + E2 + E4 | Los presets de imagen de `fase: 4` (ambientes, referencia avanzada, marketing, personas, 2K/4K, sin fondo), la QA de visión, «Guardar como preset», los presets de marca con historial y `basadoEn` |
| **F5** | E1 + E2 + E4 | Video: los 53 presets de `fase: 5`, ejes de cámara, plano, look, formato y sonido, «Movimiento del sujeto» |
| **F6** | E1 + E2 | Música y voz (8 presets que solo rellenan ajustes) |

---

## 12. Tests y criterios de «terminado»

**Tests nuevos** (todos dentro de `npm test`):
- **`presets-catalogo`:**
  - el esquema: campos obligatorios, id con su patrón y único, grupo conocido, icono con su trazo, `medios` dentro de `KINDS` y longitudes;
  - `incluye` sin ciclos y solo con ajustes;
  - ningún preset de imagen pide fotogramas;
  - los parámetros tienen su valor por defecto entre los permitidos;
  - **cada preset es servible por algún modelo del CATALOG** (si no, sale en rojo con el motivo);
  - el prompt compila y cabe en `maxPrompt` para cada familia de sus modelos;
  - mínimos: 70 de imagen, 25 de video, cada grupo con algún preset;
  - sinónimos obligatorios.
- **`presets-core`:**
  - editar, generar, animar o editar-video según la entrada;
  - el último gana en los exclusivos y se avisa;
  - `excluye` da error;
  - la cláusula de conservación siempre presente;
  - una línea «only for» y el negativo por referencia;
  - `maxPrompt` recorta primero lo opcional;
  - si todo es local, no hay modelo;
  - sin sharp, «no disponible» y no IA.
- **`presets-modelo`:** con cada combinación de keys encendidas, el modelo elegido cumple roles, needs y proporción. Veo nunca recibe 1:1, Kontext nunca recibe 2 imágenes y Muse no queda primero en catálogo.
- **`presets-buscar`:** frases de tienda que deben encontrar el preset correcto: «se ve oscura», «foto fea», «quitar lo de atrás», «que se vea pro», «para la web», «para Instagram», «para vender», «la sábana arrugada», «foto de WhatsApp», «que no se corte», «más espacio alrededor», «como este anuncio», «que dé vueltas», «catalogo» sin tilde, «sombras» en plural, una letra de error y «quitar sombra» (ambiguo: salen dos).
- **`imagen-local`** (imágenes sintéticas; si no hay sharp, se salta limpio):
  - una sábana blanca sobre blanco roto conserva su borde con `fondo-blanco` (IoU ≥ 0,97 con la máscara real);
  - `encuadrar(0.60)` mide entre 0,59 y 0,61 **sin contar una sombra larga**;
  - una cama 2:1 respeta el aire vertical mínimo;
  - la LUT identidad no cambia nada y un `.cube` conocido da el píxel esperado;
  - la salida es sRGB y sin EXIF.
- **`verificar`:** IoU, ΔE, fondo-255 y ocupación sobre casos buenos y malos.
- **`lotes`** (motor «prueba»): 10 filas con concurrencia 2 y goteo; pausar a mitad, reanudar, cancelar y reintentar las fallidas; el tope de US$ que pausa; el 403 que pausa; un reinicio a mitad sin duplicar; los 400 trabajos no expulsan filas vivas; acciones idempotentes.
- **`lotes-hoja`:** cabeceras con sinónimos, imágenes incrustadas, nombre de archivo, fila sin foto, rutas `C:\` rechazadas y notas con inyección marcadas.
- **`estudio-lote`, `sub-studio`, `estudio-mcp-presets`:** ids desconocidos fuera (diciéndolo), lote solo con GENERAR, el lote de agente en `espera_ok` por encima de los umbrales, y que ninguna herramienta apruebe.
- **`media-fachada`:** no regresión de F0.

**«Terminado» por fase:**
- **F0:** la fachada y su test en verde, y todos los tests de antes sin tocar.
- **F1:**
  - el dueño sube la foto de la cama de la bodega, elige «Catálogo para la web, con margen» y obtiene un 2048² sobre blanco 255, con el producto al 60 % medido (±1 %), la base al 85 %, sin EXIF y con nombre por SKU;
  - «Qué hará» dijo eso antes de gastar, y la QA lo confirma en la tarjeta;
  - «Que se vea más clara» cuesta 0 y no llama a ningún modelo;
  - el buscador pasa su test;
  - accesibilidad y capturas a 390, 360 y 320 px con «⚠ N», y a 1024, 1366 y 1512 px con Dimitri abierto;
  - la demo `file://` funciona.
- **F2:** un Excel de 40 filas (fotos incrustadas o por nombre), «Probar con 3», SEGUIR, 37 listas, 2 en «Revisar» con su motivo y 1 fallo con «Reintentar con otro modelo». El ZIP y el CSV salen por SKU. El aviso llega y la nota queda en el Cerebro. Un reinicio a mitad no duplica nada.
- **F3:**
  - «Dimitri, convierte las 40 fotos de la carpeta Bodega en catálogo para la web» da la pregunta con opciones si falta el canal y, después, la tarjeta del lote con su costo. Nada se gasta sin GENERAR y la tarjeta se actualiza sola;
  - un agente con `crear_lote` de 40 fotos queda en Aprobaciones.
- **F4, F5 y F6:** sus presets pasan `check` y cada uno sale `estable` tras probarlo con 5 fotos reales por familia de modelo.

Al cerrar cada fase se actualizan CLAUDE.md (las secciones del Estudio, Dimitri y la tecla B/L en «The top bar»…) y el README.

---

## 13. Riesgos y lo que falta verificar

1. **La máscara sin segmentación dedicada.** Con fondos muy parecidos al producto (una cama beige contra una pared beige), la diferencia por color del borde falla. **Mitigación:** la QA lo detecta (IoU bajo) y la foto pasa a «Revisar». Más adelante, un modelo de segmentación (por ejemplo el `background-removal` de fal) como paso opcional.
2. **Que los modelos de edición «inventen».** La cláusula, la QA y «Lista ≠ Aprobada» lo contienen, pero no lo eliminan. Cada preset pasa a `estable` solo tras probarlo con fotos reales.
3. **Sin probar con keys reales:**
   - el `background: transparent` de GPT Image vía nuestra ruta;
   - los comandos de cámara de MiniMax entre corchetes;
   - el canal de WhatsApp Business;
   - el 1,91:1 recortado.
4. **Tamaño del bloque de Dimitri.** Con 188 presets, el bloque se filtra por `buscar()` para no pasar de 2.500 caracteres. Si se pasa, se ven solo los grupos que coinciden con el pedido.
5. **Conflictos de archivos grandes.** Se mitigan con un dueño por fase y la integración en secuencia (§11).

---

## Anexo A. Cuentas del catálogo (`docs/presets-catalogo.json`)

| | Presets |
|---|---|
| Imagen | **127** (catálogo 15 · fondo 7 · sombra 7 · luz 14 · color 12 · limpieza 12 · calidad 7 · encuadre 10 · ambientes 13 · personas 6 · referencia 12 · marketing 10 · exportar 2) |
| Video | **53** (cámara 15 · plano 4 · producto 13 · look 8 · editar 6 · formato 5 · sonido 2) |
| Música | **5** · Voz **3** |
| Total | **188** · en F1: **66** · estrella: **21** · iconos: **103** · canales: **12** · familias: **11** |

**Por ejecutor:** los atómicos de luz, color, calidad (nitidez y ruido), encuadre (distancia, centrar, recortes), «Copiar color», «LUT», «Igualar a la patrón», «Conservar la sombra» y «Exportar» son `local`, a costo 0. Las recetas de catálogo son `local+ia`. Limpieza, ambientes, reiluminar, ángulos, estilo y composición son `ia`, con su campo `honestidad`.

---

## 15. Decisiones del dueño (1 oct 2026). Mandan sobre todo lo anterior

1. **Puertas: «el mejor sistema posible y sin limitaciones».** Las tres puertas (Desde cero · Mejorar mi foto · Copiar de una referencia) quedan como **atajos de entrada**, no como modos cerrados.
   - Dentro, el compositor deja **combinarlo todo a la vez**: tu foto, una o varias referencias por ejes, el **escenario 3D** (§16) y una pila de presets.
   - Cambiar de puerta nunca borra lo que ya pusiste.
   - El modo se sigue deduciendo de las entradas (`modoDe`).
2. **`sharp` se instala** como dependencia normal. Ver §2.2.
3. **El margen no es un porcentaje: es un escenario 3D.** Ver §16. El producto se achica por la DISTANCIA de la cámara, en cm o m. El fondo (un color, un set o una locación) no cambia, y no se recorta nada.
   - La ocupación en % sigue existiendo, pero como **resultado medido** (la QA de §5.7), no como entrada.
   - Los niveles «ajustado · catálogo · con margen · mucho aire» quedan como **atajos de distancia** del escenario.
4. **Los presets propios son notas del Cerebro: neuronas del gráfico.**
   - Van en `<cerebro>/Estudio/Presets/<nombre>.md`: front matter con la receta (pila, ejes, escenario 3D, canal) y un cuerpo legible, con `[[enlaces]]` a la marca, a la campaña y al preset de fábrica del que salen (`basadoEn`).
   - Aparecen en el Cerebro 3D (`graph-build.mjs` lee esa carpeta; no lee `Agents Office/`) y en la búsqueda, y la memoria aprende de los que se aprueban.
   - Las imágenes de referencia se citan por su id de galería y **no** se copian a la nota.
   - Esa carpeta viaja con las demás notas de la empresa; si un día no debe viajar, va a `.gitignore`.
   - Sustituye a `<cerebro>/Agents Office/presets/*.json` de §4.3.
5. **Topes del lote:** los de §2.6 (100 filas; para un agente, 10 fotos o US$2 necesitan el OK).

## 16. El escenario 3D: cámara, producto y distancia

Pedido del dueño: «un editor 3D en un espacio… el objeto puede ser algo cuadrado que signifique el producto (la persona, una cama, una cafetera, un televisor); lo voy a poder rotar, frontal o de un ángulo; la lejanía de la cámara en centímetros y metros; la altura o rotación de la cámara siempre apuntando; regla orbital no completa: el piso es cero, sin eje negativo porque no se toma una foto desde el subsuelo; hasta 90° arriba; y si el objeto está al frente, que se pueda subir un poco para el contrapicado, como una foto desde sus pies… y que todo se traduzca muy bien en el prompt».

### 16.1 El modelo (puro, `src/escena3d-core.js`, con tests)

```js
escena = {
  producto: { tipo: 'cama', ancho: 160, alto: 50, fondo: 200 /* cm reales */, giro: 0 /* grados alrededor del eje vertical; 0 = su FRENTE mira a la cámara en azimut 0 */, elevacion: 0 /* cm sobre el piso: una base, una mesa */ },
  camara:   { distancia: 320 /* cm, del centro del producto al lente, medido en el suelo */, azimut: 0 /* de -180 a 180 grados, alrededor del producto */, altura: 120 /* cm sobre el piso, nunca menos de 0 */, lente: 50 /* mm equivalentes: 14, 24, 35, 50, 85, 135 */ },
  cuadro:   { proporcion: '4:5' },
  fondo:    { tipo: 'color', valor: '#FFFFFF' }   // o { tipo: 'set', valor: 'estudio gris' } o { tipo: 'locacion', valor: 'sala moderna' }
}
```

- **El piso es el cero.** La cámara nunca baja de 0 cm y siempre apunta al centro del producto.
  - La inclinación sale sola: `atan((altura - centroDelProducto) / distancia)`.
  - Es positiva cuando mira hacia abajo (picado) y llega a 90° en el cenital.
  - Es **negativa cuando el producto está más alto que la cámara**: subirlo con `elevacion`, o bajar la cámara a ras de piso, da el contrapicado («una foto desde sus pies»).
- **El producto gira** sobre su eje vertical. El prompt usa el **ángulo relativo** `rel = azimut - giro`, que es lo que ve la cámara.
- **Distancia y lente → ocupación.** Con el campo de visión del lente (sensor de 36×24 recortado a la proporción del cuadro) y el tamaño aparente de la caja del producto proyectada, se calcula qué fracción del cuadro ocupa: `ocupacionEstimada()`.

### 16.2 La traducción al prompt (`describirEscena(escena, familia)`, con un test por cada fila)

| Dato | Rango | Frase para el motor (en inglés, con su traducción para el dueño) |
|---|---|---|
| ángulo relativo | menos de 15° | straight-on front view |
| ángulo relativo | 15 a 60° | three-quarter view from the left / right (el signo decide el lado) |
| ángulo relativo | 60 a 120° | side profile view |
| ángulo relativo | 120 a 165° | three-quarter rear view |
| ángulo relativo | más de 165° | rear view |
| inclinación | menos de -20° | dramatic low-angle shot looking up at it (worm's-eye view) |
| inclinación | -20 a -5° | slightly low angle, heroic |
| inclinación | -5 a 10° | eye-level |
| inclinación | 10 a 35° | slightly elevated high-angle shot |
| inclinación | 35 a 70° | high-angle shot looking down |
| inclinación | más de 70° | top-down overhead flat-lay |
| lente | 14/24 · 35 · 50 · 85/135 | wide-angle with perspective · 35mm · 50mm natural perspective · 85mm telephoto, compressed perspective |
| distancia y ocupación | — | camera {d} m away; the {tipo} fills about {ocupación}% of the frame {width/height}, with even empty space around it |
| fondo | — | the same {fondo} background, unchanged, filling the whole frame (el fondo nunca se reencuadra) |

- **Medidas y escala:** «a {tipo} about {ancho}×{fondo}×{alto} cm». Para una persona, su estatura y full body o from the knees, según lo que entre en el cuadro.
- **Las frases van por familia** (§5.8): Gemini y GPT entienden párrafos; Flux y Seedream, frases cortas; el video añade el movimiento de la cámara del preset de video.

### 16.3 La imagen guía de composición (lo que de verdad lo fija)

Además del texto, la oficina **renderiza la escena en blanco y gris**: la caja del producto con su cara FRENTE marcada, el horizonte y el piso en perspectiva, con esa cámara, ese lente y esa proporción. La pasa como **referencia de composición** a los modelos que aceptan referencias, rotulada así: «Image N is a LAYOUT GUIDE ONLY: match the camera angle, the horizon height, and the size and position of the box, which stands for the product. Do not draw the box.»

- Con la foto del dueño («mejorar mi foto»), la guía va además de su foto (que manda en la identidad del producto) y del fondo elegido.
- Así el producto sale a esa distancia, con ese ángulo y en ese sitio del cuadro, sin recortar.

### 16.4 El editor (`src/escena3d.js` con three.js, que ya está en el proyecto; `src/css/escena3d.css`)

- **Dos vistas:**
  - el **escenario** (órbita libre para mirarlo: el piso cuadriculado con los metros marcados, la caja del producto, la cámara dibujada como un cuerpo con su cono de visión);
  - **«Lo que ve la cámara»** (el cuadro final con la proporción elegida).
  - A 390 px son dos pestañas.
- **Arrastrar en el escenario:**
  - arrastrar la cámara la mueve en su órbita (alrededor, el azimut; arriba y abajo, la altura, nunca bajo el piso);
  - arrastrar el producto lo gira;
  - una manija vertical lo sube.
- **Controles con número**, siempre visibles y con teclado:
  - Distancia (cm o m, de 5 en 5 cm);
  - Altura de la cámara;
  - Alrededor (°);
  - Giro del producto (°);
  - Subir el producto (cm);
  - Lente;
  - Medidas del producto (ancho × alto × fondo, con atajos por tipo: cama queen 160×200×50, king 193×203×50, cafetera 20×30×20, televisor 55 pulgadas, persona 170 cm).
- **Atajos de toma:** Frontal · 3/4 · Lateral · Picado 45° · Cenital · Contrapicado heroico · A ras de piso. Más los de distancia: Ajustado · Catálogo · Con margen · Mucho aire, que mueven la cámara para dar ~85 · 75 · 60 · 45 % de ocupación con el lente elegido.
- **En vivo:** «Frontal · a nivel de los ojos · a 3,2 m con 50 mm · ocupa ~38 % del ancho». Y el texto exacto que irá al prompt, plegado.
- **Misma escena para toda la serie:** un lote puede usar UNA escena para todas sus fotos, y así la cama queen y la king salen a su escala real.
- **Se guarda** con el preset propio (§15.4) y como «Escena» reutilizable.
- **Accesibilidad:** todo lo que se arrastra tiene su control numérico; foco visible; 24 px; `prefers-reduced-motion` sin animaciones; en el teléfono, los controles debajo del lienzo.

### 16.5 Comprobar

- Tests de `escena3d-core`:
  - el producto subido da contrapicado;
  - la altura 0 nunca baja del piso;
  - el ángulo relativo con el producto girado;
  - la ocupación estimada frente a casos medidos a mano;
  - la tabla de frases.
- La QA de §5.7 mide la ocupación real del resultado y la compara con la estimada. Si se aparta más de 12 puntos, la foto queda en «revisar» y se ofrece «Reintentar más fuerte».
