# Video vertical corto: especificación de producción y formatos con creador

La capa de oficio que va debajo de cualquier video 9:16 para TikTok, Reels o Shorts (las restricciones que deciden si una buena idea sobrevive al feed), más una biblioteca por niveles de formatos con creadores, contenido de clientes y fundador que rinden de forma constante en crecimiento y en pagado.

La parte 1 (la especificación) vale para **todo** video vertical de esta skill: las revelaciones de `anuncios-revelacion-ios`, los videos de `video-animado-sin-rostro` y los formatos de abajo. La parte 2 es la biblioteca de formatos. Léelo antes de producir cualquier video vertical.

---

## Parte 1: la especificación del video vertical

### Lienzo
- **1080×1920 (9:16), 30 fps, MP4.** Cualquier material de otra resolución u orientación se recorta al centro para llenar; mezclar resoluciones está bien. En el Estudio: `generar_video` con `formato: "9:16"`.

### Zonas seguras (la restricción que más se olvida)
La interfaz de la plataforma tapa los bordes: la barra de acciones, el bloque del texto, el botón de música y la fila de la cuenta van *encima* de tu video. Lo que pongas ahí se tapa. Mantén todo dentro de la **franja segura entre plataformas**, el peor caso de los márgenes de TikTok y de Reels en un lienzo de 1080×1920:

| Borde | Deja libre | Por qué |
|---|---|---|
| **Arriba** | 220 px | Pestañas de TikTok y fila de la cuenta de Instagram |
| **Abajo** | 500 px | Texto, música y botón (en las dos plataformas) |
| **Izquierda** | 180 px | Simetría con la derecha |
| **Derecha** | 180 px | Barra de acciones (me gusta, comentar, compartir, música) |

**Resultado: una franja de texto de 720×1200 centrada, de y=220 a y=1420.** Todo rótulo y todo elemento visual que cargue el mensaje va dentro. Antes de un empujón grande, revísalo contra una plantilla de zonas seguras. (Estos números cambian con las actualizaciones de las apps: vuelve a comprobarlos de vez en cuando; son un peor caso bien documentado, no una ley.)

Cuando pidas un video al Estudio, dilo en el prompt: «deja libres el tercio de abajo y los bordes; el sujeto y cualquier texto dentro del centro del cuadro».

### Estilo de rótulos (el clásico de TikTok)
Relleno blanco, contorno negro, **sin cápsula de fondo**: el aspecto nativo que se lee como orgánico, no como anuncio. Para quien edite:

```css
color: #fff;
font-family: "TikTok Sans", sans-serif;  /* o una sans parecida; incrústala, no supongas que está instalada */
font-weight: 700;
paint-order: stroke fill;                  /* el contorno detrás del relleno: letras nítidas */
-webkit-text-stroke: 8px #000;
text-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
```

- **Los rótulos son fijos:** sin animaciones de entrada ni salida. Un rótulo aparece completo en el primer cuadro de su ventana, y su ventana coincide exactamente con su segmento de video (mismo inicio, mismo final). Los rótulos animados se leen como «hecho por una marca».
- **Tamaño automático para que quepa en la franja.** Empieza en ~58 px y baja de 2 en 2 hasta que el texto quepa en la franja segura (caja de ~1150 px de alto), con un mínimo de ~26 px. Nunca se sale de la franja ni corta una letra. Un gancho largo tipo muro de texto es una entrada válida, no un error: solo se encoge. Mide después de que cargue la fuente real, no con una de reemplazo.

En la oficina, el agente entrega el texto de cada rótulo con su ventana de tiempo; los quema quien edita (CapCut, el editor de la propia red) o, si se publica en orgánico, se pueden usar los subtítulos de la plataforma.

### Audio (y la decisión orgánico o música incrustada)
- **Silencia el audio de los clips por defecto; que una sola pista de música lleve el sonido.** El audio por clip se activa a propósito (p. ej., la voz del creador al 100 %, las tomas de apoyo en silencio).
- **Baja la música en los últimos ~0,8 s:** un corte seco al silencio se siente roto.
- **La decisión orgánica:** para TikTok o Reels orgánico, a menudo conviene publicar **sin música incrustada** y poner el sonido en tendencia *dentro de la app*: el algoritmo premia el audio nativo o en tendencia, y otros pueden encontrarlo y usarlo. **Incrusta la música** en los anuncios pagados y donde no puedas poner un sonido nativo. Esta sola decisión cambia bastante el alcance orgánico.
- En el Estudio, la música de fondo sale de `generar_musica` (instrumental) y la locución de `generar_voz`; las dos se pueden incrustar en el pagado. Ojo con usar canciones comerciales en un anuncio: necesitan licencia.

### Que se pueda repetir (si se genera con código)
Si alguien de la empresa renderiza con código (Remotion, HyperFrames o ffmpeg), el render debe ser reproducible: nada de relojes, números aleatorios ni descargas durante el render. Mismos insumos → mismo MP4, siempre. (Ver `video-marketing` para elegir herramienta.)

---

## Parte 2: biblioteca de formatos con creador

Formatos cortos con creadores y clientes reales que rinden en crecimiento y pagado. Cada uno es una *estructura*, no un guion: ponle tu material y tu gancho. Todos cumplen la parte 1.

**Los niveles** miden una sola cosa: ¿el formato *escala un anuncio frío a públicos nuevos* (escalador unicornio) o solo *convierte a quien ya está a mitad o al final del embudo* (reparto)? **S** = los pocos que escalan en frío y además educan mucho. **A** = escala bien. **B** = buen reparto en las condiciones correctas. **C** = situacional u operativamente complejo (derechos, talento concreto, o mejor recrearlo que capturarlo). Arma un *portafolio* entre niveles. La entrega por personas tipo de Meta explica por qué los formatos con creador al frente (Charlatán, Investigación, Autoridad, VSL) van tan arriba: llegan a la persona tipo a través de los creadores que ya sigue. El mapa completo está en `formatos-meta-por-nivel`, y la lógica de portafolio en el sistema de decisiones de Meta de `campanas-pagadas`.

### Formato 1. Reacción + demostración (corte seco) · A
**Forma:** un clip de reacción de un creador con un rótulo de gancho → **corte seco** a la grabación de pantalla o demostración del producto. Unos 9–12 s en total.

```
[ reacción · ~3 s · rótulo de gancho ] → [ demostración · completa · rótulo opcional de resultado ]
```

- **Cuándo:** tienes (o puedes conseguir) una reacción creíble y una demostración nítida. El caballo de batalla para apps y herramientas.
- **El rótulo del gancho** va sobre la reacción y hace toda la venta: es el anuncio. Escríbelo como el monólogo interior de la reacción («estaba por caer y esta app me convenció de no hacerlo»), no como una afirmación de producto.
- **El corte seco es el mecanismo:** sin transición. La reacción gana la atención y el corte entrega el resultado. Un segundo rótulo opcional sobre la demo remata el resultado (solo si es real).
- **Insumos:** las reacciones reales son el cuello de botella; el formato vale lo que vale la autenticidad de la reacción.

### Formato 2. Tutorial en pantalla partida «sin hablar» · B
**Forma:** tutorial rápido y silencioso. Intro a pantalla completa → **pantalla partida 50/50** (lo que se escribe o hace en una mitad, el resultado en vivo en la otra), rótulos de pasos en la costura. La promesa «…pero sin hablar» = puro valor.

```
[ intro · pantalla completa · gancho ] → [ partida: entrada | salida · rótulos de pasos en orden en la costura ]
```

- **Cuándo:** un «cómo se hace» donde *mostrar* gana a narrar: configuraciones, recorridos, tutoriales de herramienta. El silencio es lo que vende (la gente ve en silencio; «sin hablar» filtra a los interesados).
- **Los rótulos cargan los pasos:** en orden, fijos, uno por momento, en la costura para que se vean las dos mitades. Tamaño automático según la parte 1.
- Sin voz; solo música (ver la decisión orgánica). Ritmo apretado: el tiempo muerto mata la retención.

### Formato 3. Reacción con pantalla verde · A
**Forma:** un video ocupa la pantalla; el creador va **recortado de su fondo** y superpuesto encima, reaccionando o narrando sobre el contenido de abajo. Opcional: empieza al centro y luego se achica y se arrastra a una esquina.

```
[ video a pantalla completa (grabación de pantalla, otra publicación) + creador recortado encima · rótulo de gancho opcional ]
```

- **Cuándo:** reaccionar a la publicación de un competidor, a una tendencia, a una grabación de pantalla o a tu propio producto: el formato nativo de «déjame reaccionar a esto». Se lee como comentario, y el algoritmo y el público lo tratan como orgánico.
- **Los dos audios pueden convivir** (el video de abajo y el creador), a diferencia de la regla de silencio por defecto: la voz de la reacción es lo importante.
- El movimiento a la esquina (el creador empieza grande y se achica para dejar respirar al contenido) es el momento característico.

### Formato 4. Charlatán (yapper) · A
**Forma:** un creador habla directo a cámara y cuenta una historia personal que aterriza en tu producto. No hacen falta cortes: la historia *es* el anuncio. 20–60 s.

```
[ creador a cámara · el gancho primero · historia personal → el producto como desenlace ]
```

- **Cuándo:** tienes al creador *correcto* (alguien que se lee un paso por delante de quien mira, entusiasta y concreto) y una historia *con guion* y arco real. Difícil de lograr (creador, guion y lugar deben funcionar a la vez), pero escala en frío cuando sale.
- **Mecánica:** abre con una opinión fuerte o un gancho de historia («Casi cancelo esta app tres veces»), no con una afirmación de producto. Gancho → historia → el producto entra como el giro, nunca como lista de funciones. Rótulos activados (estilo parte 1); un lugar casero (el carro, una caminata, un rincón) se ve nativo. La energía plana lo mata: la forma de contarlo carga el formato.
- El casting es el cuello de botella: falla mucho más por el creador equivocado que por el guion equivocado.

### Formato 5. Investigación amateur · A
**Forma:** un creador «investiga» tu producto, tu nicho o una pregunta en nombre de quien mira: visita lugares, compara opciones, pone a prueba afirmaciones. El arco de descubrimiento retiene.

```
[ el creador plantea la pregunta · investiga (material real) · llega a tu producto como hallazgo ]
```

- **Cuándo:** tu producto gana en la comparación o aguanta el escrutinio: la investigación se gana la recomendación en vez de afirmarla. Escala en frío porque se ve como contenido.
- **Mecánica:** plantea una pregunta genuina («¿vale la pena la garantía extendida de la agencia de autos?»), deja que el creador haga el trabajo de campo en cámara y que tu producto surja como *la conclusión de la investigación*, no como un espacio patrocinado. La captura en el mundo real (lugares, comparaciones) es la credibilidad.

### Formato 6. David contra Goliat · A
**Forma:** la marca como el pequeño (David) frente a una industria, un gigante o un statu quo roto (Goliat). Una historia para hinchar por ti.

```
[ nombra a Goliat (el villano o la norma rota) · la lucha de la marca contra él · por qué ganas o en qué eres distinto ]
```

- **Cuándo:** hay un antagonista real: un gigante inflado, una práctica de la industria que abusa, una opción por defecto peor que la tuya. La historia hace que quien mira *quiera* que ganes.
- **Mecánica:** haz concreto a Goliat y emocionales las apuestas; el origen de la marca («lo creamos porque X estaba roto») le da fuerza. Va natural con el fundador al frente. No fabriques un villano que no existe: el formato vive o muere con un antagonista genuino.

### Formato 7. Autoridad · A
**Forma:** un experto con credenciales (médico, dermatólogo, ingeniero, profesional del oficio) presenta o respalda el producto desde su conocimiento.

```
[ experto a cámara (credenciales claras) · el problema de su campo · por qué este producto es la respuesta ]
```

- **Cuándo:** nichos muy competidos donde manda la confianza (suplementos, cuidado de la piel, salud, todo lo regulado), donde una credencial convence lo que el contenido de clientes no. Valida y suma variedad.
- **Mecánica:** el experto debe ser real y las afirmaciones verdaderas y demostrables: es el formato más cerca del riesgo regulatorio. Las afirmaciones de salud, médicas o financieras pasan por revisión legal (y por la autoridad sanitaria o el colegio profesional de tu país cuando aplique); nunca fabriques credenciales ni pongas palabras en boca de un experto. Cumple al pie de la letra las reglas de fundamentación de la skill.

### Formato 8. VSL (carta de ventas en video) · S
**Forma:** video largo (de 60 s a varios minutos) de respuesta directa que educa antes de vender: problema → mecanismo → prueba → oferta.

```
[ gancho + problema · por qué pasa (el mecanismo) · la solución + prueba · la oferta + llamado a la acción ]
```

- **Cuándo:** la venta necesita *educar primero*: salud, bienestar, ejercicio, finanzas, todo lo que el comprador debe entender antes de convertir. De los pocos que escalan en frío y además enseñan mucho; por eso es S.
- **Mecánica:** el oficio está en el guion: un gancho de problema apretado, un mecanismo creíble, pruebas apiladas y una oferta clara. La retención se diseña momento a momento (intrigas abiertas, giros a mitad que añaden un hecho nuevo). Rótulos todo el tiempo; sirve una persona real o voz en off sobre tomas de apoyo (en la oficina, `generar_voz` + tomas de `generar_video`). Es ante todo una disciplina de escritura: invierte en el guion (ver `redaccion-publicitaria`).

### Formato 9. Comentario con pantalla verde · A
**Forma:** el creador habla *sobre* imágenes a pantalla completa (capturas, fotos del producto, gráficos, la página de un competidor) y acompaña una explicación con lo que se ve. (Distinto del formato 3: esto es una capa de *enseñanza*, no una reacción a una publicación.)

```
[ creador recortado + imágenes de referencia detrás · narración educativa ligada a lo que hay en pantalla ]
```

- **Cuándo:** ropa, y todo lo que tenga un ángulo educativo donde *mostrar mientras explicas* gana a solo hablar. Se lee como comentario o clase, que la plataforma trata como orgánico.
- **Mecánica:** cambia la imagen de fondo en cada punto de la narración (lo visual siempre ilustra lo que se está diciendo). La voz del creador manda; que la explicación sea útil de verdad, no una venta disfrazada.

### Formato 10. Conversación · B
**Forma:** dos personas en un intercambio real (entrevista, diálogo, ida y vuelta) donde el producto aparece con naturalidad.

```
[ dos personas hablando · pregunta y respuesta reales · el producto entra como parte del diálogo ]
```

- **Cuándo:** puedes montar una dinámica de dos personas que se sienta genuina y el producto cabe en un momento natural de la charla. Buen reparto; convierte más de lo que escala en frío.
- **Mecánica:** difícil: la química y la naturalidad lo son todo; un diálogo que suena a guion lo mata. Mejor cuando el intercambio saca una objeción real y la responde en el camino.

### Formato 11. Dueto / reacción · C (necesita derechos)
**Forma:** reaccionar, hacer dueto o stitch con el video de otro creador: tu comentario junto a su clip o después.

```
[ el clip del creador original · tu reacción, dueto o stitch respondiéndole ]
```

- **Cuándo:** hay una publicación concreta que vale la pena responder y abre rincones de público nuevos. Situacional.
- **Mecánica:** **necesitas derechos** del creador original para usar su material en un anuncio pagado: esa es la puerta, no la creatividad. Sin derechos, no lo corras como anuncio.

### Formato 12. ASMR · C
**Forma:** video sensorial, guiado por el sonido (golpecitos, unboxing, aplicación, texturas), con el producto como objeto sensorial.

```
[ acción sensorial en primer plano · el producto al frente · el audio ASMR manda (sin voz) ]
```

- **Cuándo:** mascotas, belleza, comida o productos táctiles donde la experiencia sensorial *es* el atractivo. Situacional, y necesita un creador nativo de ASMR.
- **Mecánica:** rompe la regla del silencio por defecto: el audio es lo importante; grábalo limpio. Necesita talento que de verdad grabe ASMR; un creador generalista no finge ese oficio.

### Formato 13. Entrevista en la calle · C («a menudo mejor recrearla»)
**Forma:** preguntas a gente en la calle (reales o recreadas) que capturan reacciones espontáneas a tu producto o a una pregunta de la categoría.

```
[ montaje en la calle · pregunta a transeúntes · respuestas espontáneas → tu ángulo ]
```

- **Cuándo:** quieres la credibilidad de la reacción pública sin guion. Situacional y pesado de capturar con honestidad.
- **Mecánica:** capturarla de verdad es un suplicio (permisos, tomas muertas, clima, suerte), así que a menudo es **mejor montarla o recrearla** con el mismo lenguaje visual: más rápida, controlable, y se lee igual. Si la montas, que las afirmaciones sigan siendo reales (rigen los insumos fundamentados) y no la presentes como testimonio espontáneo.

### Estructuras para el fundador y el vlog orgánico

Para **anuncios con el fundador al frente** y contenido de marca nativo, cuatro estructuras narrativas (inspiradas en el trabajo publicado de Oren John) le dan al fundador algo que *decir*, y un sistema de grabación y edición lo vuelve rápido. No son un nivel aparte: son el arco *dentro* de un Charlatán, una Investigación o un vlog. El contenido del fundador suele ser el primer gran ganador de una marca.

**Las cuatro estructuras (elige el arco y graba para él):**
- **Viaje del héroe:** pasa lo que esté ocurriendo en el negocio por: problema → antecedentes → intento → fracaso → revelación → avance → final abierto. El replanteamiento importa más que los hechos. Permite publicar *menos*: un buen vlog-historia a la semana puede ganarle a contenido diario, porque la gente sigue el viaje. (Para este arco puedes usar la IA *solo para el esquema*: con el contexto de la marca y la persona tipo, un esquema de 60–90 s; las palabras las escribe el fundador.)
- **Matemáticas:** el dinero como palanca: un desglose de costos o un reto con presupuesto fijo («Gasté 200 en anuncios de Meta. Este es el desglose»). Lo *inesperadamente barato* rinde más que lo caro; la pregunta de cuánto cuesta crea curiosidad. No uses el lujo como gancho: no escala y se lee como presunción.
- **Objeto brillante:** ánclalo en algo visualmente nuevo que quien mira no ha visto y a lo que tú tienes *acceso* (tu taller, una máquina, un proceso artesanal, una feria). Nunca el dinero o el lujo como objeto brillante.
- **Guía de nicho con experiencia:** narra el mundo real desde tu mirada profesional («lo que yo evitaría como diseñadora de interiores», grabado en la tienda). Un punto de vista de *aprendiz* también sirve: sé honesto sobre cuál eres. Salir al mundo es el truco mientras todos los demás hablan en su carro.

**El sistema de tres tomas** (vuelve rápida cualquiera de las anteriores):
- Graba cada momento **de tres formas: cerca, medio y lejos (0,5x)** para sacar el máximo material de cualquier momento.
- **Solo clips de 2–3 segundos:** muchos clips pequeños, nunca tomas largas (se arman fácil).
- **Regla del movimiento:** si el sujeto se mueve, el teléfono quieto; si nada se mueve, un acercamiento lento o un deslizamiento lateral.
- Haz la actividad primero y luego repasa al final (~5 min) tomando tres ángulos de 10–12 cosas: interrumpe menos.
- Una carpeta del teléfono por salida; **marca como favorita la mejor toma de gancho** para tener la apertura elegida. Al menos **5 tomas de ti mismo**: eres el hilo conductor.

**La fórmula de corte de 0,5–1 s** (la edición): cada toma dura **0,5–1 segundo**; una voz en off de 45 segundos se vuelve ~45 tomas de un segundo. Graba primero la voz o el texto hablado, pon los clips debajo, reordena, recorta. Edita en CapCut o en el editor de Instagram; no hace falta Premiere ni DaVinci. Ese ritmo de corte, primo del corte seco del formato 1, es lo que hace que el material se sienta con energía y no lento.

---

## Qué entrega el agente

El agente no graba ni edita. Entrega, por video: el formato y su nivel, el guion con tiempos (gancho en sus tres componentes, rampa, cuerpo, cierre), el texto de cada rótulo con su ventana, la lista de tomas (o los prompts para el Estudio si se genera), la decisión de música y el fundamento de cada afirmación. Lo generado con `generar_video`, `generar_voz` o `generar_musica` va con sus líneas ⏳ o ![…] tal cual. Una pieza orgánica se deja como borrador en Contenido (`crear_borrador`); un anuncio, listo para que el dueño lo apruebe y lo suba.

*La especificación de video vertical (franja segura, receta de rótulos, tamaño automático, audio orgánico o incrustado) y los tres primeros formatos se inspiran en las plantillas reelclaw de Daniel Hangan (sobre HyperFrames de HeyGen). La biblioteca por niveles se inspira en el ranking de tipos de creatividad de Meta de Dara Denney; las estructuras para el fundador, el sistema de tres tomas y el corte de 0,5–1 s, en las guías de vlog de Oren John. Fuentes reconocidas, redacción propia. Los números de zonas seguras son un peor caso entre plataformas: compruébalos contra la interfaz actual.*
