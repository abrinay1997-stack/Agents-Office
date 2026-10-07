# Guía de pedidos para generar imágenes con IA

Cómo escribir pedidos eficaces para los modelos de imagen del Estudio (`generar_imagen`, `aplicar_preset`). Los nombres de modelos son familias conocidas; confirma con `estado_estudio` cuáles están encendidos en esta empresa.

---

## Estructura de un pedido

Un buen pedido sigue esta fórmula:

```
[Sujeto] + [Escena o contexto] + [Estilo visual] + [Luz] + [Composición] + [Datos técnicos]
```

### Ejemplos por caso de uso

**Portada de blog, producto digital:**
```
Un espacio de trabajo limpio con un portátil que muestra un panel de analítica colorido,
escritorio minimalista con una taza de café y una libreta,
luz natural brillante de ventana desde la derecha,
poca profundidad de campo, estilo de fotografía comercial,
1200x630, alta resolución
```

**Gráfico para redes, anuncio de novedad:**
```
Degradado abstracto fluido en morado profundo y azul eléctrico,
formas geométricas que dibujan una red,
luz de contorno dramática en los bordes,
estética tecnológica moderna, limpia y minimalista,
1080x1080, colores vibrantes
```

**Foto de producto en un ambiente de vida diaria:**
```
Una persona en una oficina moderna sonriendo mientras mira una tableta,
con una interfaz de gestión de proyectos en pantalla,
fotografía cálida y espontánea, luz natural,
plano medio, poca profundidad de campo, estilo editorial
```

**Banner de perfil, profesional:**
```
Fondo panorámico abstracto en azul marino y verde azulado,
trama geométrica sutil con degradado suave,
estética corporativa limpia, luz tenue,
1584x396, sin texto, espacio para el logo en el tercio izquierdo
```

**Ficha de directorio, Product Hunt:**
```
Captura del producto sobre un fondo degradado limpio,
sombra suave debajo, ligera inclinación 3D en perspectiva,
estilo moderno de presentación de producto,
1270x760, brillante y profesional
```

**Para un negocio que no es de software (ejemplos añadidos):**

*Panadería, publicación de redes:*
```
Pan de masa madre recién horneado sobre una tabla de madera,
vapor ligero, harina espolvoreada, fondo de cocina desenfocado,
luz cálida de ventana lateral, plano cercano desde arriba en ángulo,
fotografía de alimentos, 1080x1350
```

*Clínica dental, portada de artículo:*
```
Consultorio dental luminoso y ordenado, silla y lámpara a contraluz suave,
tonos blancos y verde menta, sensación de calma,
fotografía de interiores, gran angular, espacio libre arriba para el titular,
1200x630
```

*Tienda de ropa, escena de temporada:*
```
Perchero de lino en colores tierra frente a una pared de ladrillo claro,
una planta grande a un lado, luz de mañana,
estética de catálogo cálida, composición con la regla de los tercios, 1080x1350
```

*Para fotos de un producto real, no generes el producto: sube la foto a la galería y mejórala con un preset (`buscar_presets`, `aplicar_preset`) o pide solo el fondo y la escena como referencia.*

---

## Palabras de estilo

### Fotorrealista
- «fotografía comercial»
- «hecha con una cámara profesional de gama alta»
- «estilo editorial»
- «luz natural»
- «poca profundidad de campo»

### Limpio y corporativo
- «estética moderna y limpia»
- «diseño minimalista»
- «estilo corporativo profesional»
- «brillante y aireado»
- «fondo blanco»

### Ilustrado
- «ilustración vectorial plana»
- «render 3D isométrico»
- «estilo de boceto a mano»
- «ilustración en acuarela»
- «arte lineal»

### Abstracto y de marca
- «degradado fluido»
- «patrón geométrico»
- «visualización de datos abstracta»
- «efectos de partículas»
- «iridiscente holográfico»

### Tecnología y software
- «estética de interfaz en modo oscuro»
- «luz de acento neón»
- «glassmorphism» (efecto de vidrio esmerilado)
- «minimalismo futurista»
- «pensado para desarrolladores»

---

## Palabras de luz

| Término | Efecto | Ideal para |
|---|---|---|
| **Luz natural** | Cálida, orgánica | Vida diaria, editorial |
| **Luz de estudio** | Pareja y controlada | Fotos de producto |
| **Luz de contorno** | Realza los bordes, dramática | Imágenes principales, abstracto |
| **Direccional suave** | Sombras suaves, da volumen | Cabeceras de blog |
| **Volumétrica** | Rayos de luz, atmósfera | Dramático, cinematográfico |
| **Plana o pareja** | Sin sombras, limpia | Iconos, diagramas |
| **Hora dorada** | Tonos naranjas cálidos | Vida diaria, exteriores |
| **Clave alta** | Brillante, pocas sombras | Limpio, corporativo |

---

## Palabras de composición

| Término | Efecto | Ideal para |
|---|---|---|
| **Regla de los tercios** | Sujeto descentrado | Editorial, vida diaria |
| **Centrada** | Sujeto en el medio | Productos, iconos |
| **Ancha o panorámica** | Vista amplia | Banners, cabeceras |
| **Primer plano o macro** | Foco en el detalle | Texturas, detalle de producto |
| **Vista cenital** | Desde arriba | Escritorios, mesas, platos |
| **Espacio negativo** | Hueco para poner texto | Cabeceras de blog, banners |
| **Simétrica** | Equilibrada, formal | Corporativo, lujo |

---

## Consejos por modelo

### Gemini Image (Google, «Nano Banana»)
- El mejor todoterreno para imágenes de marketing: buena calidad y costo razonable.
- Permite **editar**: parte de una imagen existente y describe los cambios.
- Texto aceptable: maneja titulares cortos.
- Pide «alta resolución» para el mejor resultado.
- Funciona bien con pedidos descriptivos y detallados.

### Flux (Black Forest Labs)
- Lo mejor son las **referencias de varias imágenes**: capturas de producto, activos de marca o referencias de estilo.
- Lo mejor para **coherencia de marca** en una serie.
- Flux Pro para las piezas finales, Flux Dev para iterar rápido.
- Las versiones rápidas sirven para lotes de alto volumen (las más baratas).
- La transferencia de estilo por imágenes de referencia rinde más que las palabras de estilo.
- Los pedidos pueden ser más cortos que en otros modelos: las referencias hacen el trabajo pesado.

### Ideogram
- **El mejor texto dentro de imágenes** de todos los modelos.
- Úsalo cuando necesites titulares, frases o nombres de marca en la imagen.
- Sistema de referencias de estilo (hasta 3 imágenes) para coherencia de marca.
- Admite mejora automática del pedido.
- Mantén simple el texto: de 3 a 5 palabras como máximo para que salga fiable.
- Lo mejor para gráficos de redes y banners con texto incluido.

### GPT Image (OpenAI)
- Integrado con ChatGPT: generación conversacional.
- Bueno siguiendo pedidos detallados.
- Texto aceptable (detrás de Ideogram, parecido a Gemini).
- Reescribe el pedido automáticamente: puede desviarse de lo que pediste.
- Lo mejor para pruebas rápidas sueltas.
- Las versiones de OpenAI cambian con frecuencia (la familia `gpt-image-1` se retira a finales de 2026 y DALL-E 3 ya está descontinuado): en la oficina, usa el que `estado_estudio` muestre.

### Midjourney
- La calidad estética más alta para imágenes artísticas o editoriales.
- No tiene API oficial (Discord o web): **no sirve para los agentes de la oficina**; solo para exploración creativa manual del dueño o del diseñador.
- Opciones de estilo: `--style raw` para menos estilizado, `--ar 16:9` para la proporción.
- Lo mejor para imágenes principales donde pesa solo la calidad visual.
- Las versiones recientes mejoraron el texto, pero sigue sin ser fiable.

---

## Errores comunes en los pedidos

| Error | Por qué falla | Cómo arreglarlo |
|---|---|---|
| «Una imagen profesional» | No hay detalle visual | Describe sujeto, escena, estilo y luz |
| Un párrafo de texto dentro de la imagen | Los modelos no pueden dibujar párrafos | De 3 a 5 palabras como máximo; el texto va aparte |
| «Que se vea bien» | No es accionable | Indica un estilo: «fotografía comercial, brillante» |
| Pedidos de más de 200 palabras | El modelo pierde el foco | De 40 a 80 palabras; mejor específico que exhaustivo |
| Sin proporción | Tamaño al azar | Indica siempre medidas o proporción |
| «Logo abajo a la derecha» | La posición no es fiable | Añade los logos después, en un editor |
| «Que sea viral» | No es una instrucción visual | Describe la estética que quieres |
| Pedir capturas de interfaz | La IA inventa pantallas | Usa capturas reales |

---

## Flujo para varias imágenes con el mismo estilo

Cuando necesites varias imágenes coherentes (una serie de artículos, una campaña de redes, un catálogo):

1. **Genera de 3 a 4 imágenes de prueba** con estilos distintos.
2. **Elige el estilo ganador** según cómo encaja con la marca.
3. **Guarda el pedido exacto** como plantilla.
4. **Usa la imagen ganadora como referencia** (un modelo con varias referencias).
5. **Genera las variantes** con el mismo estilo y distinto sujeto.
6. **Posprocesa:** añade textos y logos, recorta a las medidas de cada plataforma.

Cuando son muchas fotos de producto con la misma receta (un catálogo entero), en la oficina existe el flujo de **lotes** del Estudio (`crear_lote`, `estado_lote`): propón la receta y el costo y deja que el dueño autorice el lote.

---

## Proporciones: referencia rápida

| Uso | Proporción | Píxeles | Notas |
|---|---|---|---|
| Portada de blog o imagen OG | 1,91:1 | 1200×630 | Estándar universal en la web |
| Imagen principal a todo ancho | 16:9 | 1920×1080 | Cabeceras de sitios |
| Instagram, publicación | 1:1 | 1080×1080 | Cuadrada |
| Instagram, publicación vertical | 4:5 | 1080×1350 | Ocupa más pantalla |
| Historias y reels | 9:16 | 1080×1920 | Vertical a pantalla completa |
| Portada de LinkedIn | 4:1 | 1584×396 | Perfil personal |
| Encabezado de X | 3:1 | 1500×500 | Banner de perfil |
| Galería de Product Hunt | 5:3 | 1270×760 | Página de lanzamiento |
| Vista previa social de GitHub | 2:1 | 1280×640 | Tarjeta de enlace de repositorio |

---

## Ahorrar costo

- **Itera primero en baja calidad:** usa un modelo rápido o barato para los borradores y sube de nivel para las finales.
- **Usa referencias en vez de pedidos largos:** los modelos con varias referencias dan resultados más coherentes con menos reintentos.
- **Agrupa pedidos parecidos:** genera todas las cabeceras de un blog en una sesión con el mismo estilo.
- **Guarda y reutiliza:** fondos abstractos, patrones y texturas sirven para varias imágenes (`buscar_en_galeria`).
- **Posprocesa en vez de regenerar:** recorta, superpone texto y ajusta el color en lugar de generar una imagen nueva.
- **Mira el costo estimado** que muestra el Estudio antes de enviar un pedido y respeta los topes diarios y mensuales.
