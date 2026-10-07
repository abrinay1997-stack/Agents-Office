# Guía de prompts para video con IA

Cómo escribir prompts eficaces para modelos de generación de video (los del Estudio: Veo, Kling, Seedance, Hailuo, Wan, LTX, PixVerse y otros; y, si la empresa los usa por fuera, Runway o Pika). Los prompts se pasan a `generar_video`; confirma con `estado_estudio` qué modelos están encendidos.

---

## Estructura del prompt

Un prompt de video sólido sigue esta fórmula:

```
[Sujeto] + [Acción] + [Movimiento de cámara] + [Estilo visual] + [Luz y ambiente] + [Especificaciones técnicas]
```

### Ejemplos de prompts por caso de uso

**Plano héroe de producto:**
```
Una laptop elegante sobre un escritorio blanco minimalista, la pantalla brilla con un tablero de control,
la cámara orbita lentamente 180 grados alrededor del escritorio,
luz volumétrica suave desde la izquierda, poca profundidad de campo,
estética comercial cinematográfica, 4K
```

**Material de apoyo de estilo de vida:**
```
Una mujer en un espacio de trabajo compartido moderno sonríe mientras mira su teléfono,
luz natural de ventana, sensación documental espontánea,
cámara en mano con movimiento sutil, corrección de color cálida
```

**Abstracto o de marca:**
```
Partículas de oro líquido fluyen y forman la silueta de una red de nodos,
fondo oscuro, las partículas atrapan la luz al moverse,
estilo de fotografía macro en cámara lenta, luz de contorno dramática
```

**Escena para un explicativo:**
```
Una toma cenital de un equipo alrededor de una mesa de juntas señalando gráficos,
la cámara avanza despacio, oficina moderna y luminosa,
estilo corporativo limpio, luz pareja, 1080p
```

**Negocio local (tienda, restaurante, clínica):**
```
Manos de una panadera sacando una charola de panes recién horneados del horno,
vapor que sube a contraluz, cocina de barrio con luz cálida de la mañana,
la cámara hace un paneo lento hacia el mostrador, estilo documental, calidez natural
```

---

## Vocabulario de movimiento de cámara

Usa estos términos: los modelos de video los entienden.

| Término | Efecto |
|---------|--------|
| **Fija** (static) | Cámara bloqueada, sin movimiento |
| **Paneo izquierda/derecha** (pan) | La cámara gira en horizontal |
| **Inclinación arriba/abajo** (tilt) | La cámara gira en vertical |
| **Dolly adelante/atrás** (dolly in/out) | La cámara se acerca o se aleja del sujeto |
| **Órbita** (orbit) | La cámara rodea al sujeto |
| **Toma de seguimiento** (tracking) | La cámara sigue a un sujeto en movimiento |
| **Grúa o aérea** (crane/aerial) | La cámara sube o baja |
| **En mano** (handheld) | Temblor sutil, sensación documental |
| **Zoom** | Zoom del lente (distinto del dolly) |
| **Empuje lento** (slow push) | Dolly gradual hacia adelante: genera tensión o foco |

Los modelos suelen responder mejor a los términos en inglés; puedes poner el término en inglés dentro del prompt aunque el resto esté en español.

---

## Palabras de estilo

### Cinematográfico
- «corrección de color cinematográfica» (cinematic color grading)
- «destello de lente anamórfico» (anamorphic lens flare)
- «poca profundidad de campo» (shallow depth of field)
- «grano de película» (film grain)
- «película de 35 mm» (35mm film)

### Comercial o corporativo
- «iluminación comercial limpia»
- «luminoso y aireado»
- «estética corporativa profesional»
- «luz pareja y difusa»

### Documental
- «estilo documental en mano»
- «luz natural»
- «espontáneo, sin posar»
- «cámara observacional»

### Social o de tendencia
- «vertical 9:16»
- «cortes rápidos»
- «textos en pantalla llamativos» (los textos se ponen en edición, no los genera el modelo)
- «alto contraste, colores saturados»

---

## Consejos por modelo

La disponibilidad cambia con las llaves encendidas y con lo que ofrezcan los proveedores; el Estudio muestra la calidad, la velocidad y el costo estimado de cada uno. Estos consejos vienen de la fuente y son orientativos.

### Veo (Google)

- Destaca en fotorrealismo y escenas complejas.
- Admite audio generado y sincronizado con el video.
- Rinde mejor con prompts detallados y descriptivos.
- Indica «alta resolución» o «1080p» para la mejor calidad.
- Maneja varios sujetos y transiciones de escena.

### Runway Gen-4 (herramienta externa)

- Control de movimiento fuerte: especifica los movimientos de cámara con precisión.
- La mejor consistencia temporal (los sujetos se mantienen entre cuadros).
- Usa el pincel de movimiento para animar un área concreta.
- Imagen a video funciona bien: da un cuadro de referencia.
- Prompts de menos de 100 palabras rinden mejor.

### Kling

- Puede generar tomas largas (mucho más que otros).
- Bueno para secuencias narrativas más largas.
- Más económico para generación en volumen.
- La calidad baja un poco en duraciones largas.
- Rinde mejor con escenas simples y pocos sujetos.

### Pika (herramienta externa)

- El tiempo de generación más rápido (menos de 2 minutos).
- Bueno para iteraciones rápidas y experimentos.
- El modo de efectos añade movimiento a imágenes fijas.
- Mejor para clips cortos (5 a 15 segundos).
- Menos control sobre el movimiento de cámara.

---

## Errores comunes en los prompts

| Error | Por qué falla | Arreglo |
|-------|---------------|---------|
| «Una persona usando nuestra app» | Demasiado vago, sin detalle visual | Describe la persona, el lugar, la luz y la cámara |
| Incluir texto o logos | La IA no escribe texto legible | Añade el texto en edición (o con una plantilla programática) |
| «Hazlo viral» | No es una instrucción visual | Describe el estilo visual que quieres |
| Prompts larguísimos (más de 200 palabras) | Los modelos pierden el foco | Mantén 50 a 100 palabras, sé específico |
| Sin dirección de cámara | Cámara al azar o fija | Especifica siempre el movimiento o «fija» |
| «Realista» a secas | No es suficientemente específico | «Fotorrealista, luz natural, filmado con cámara de cine» |

---

## Flujo para prompts

1. **Referencia primero:** encuentra un video real que se parezca a lo que quieres (pídeselo al dueño o búscalo si hay búsqueda web).
2. **Descríbelo:** desmóntalo en sujeto, acción, cámara, estilo y ambiente.
3. **Genera 3 o 4 variaciones:** mismo concepto, otros ángulos o estilos (cuida el costo: empieza con clips cortos).
4. **Itera sobre la mejor:** afina el prompt con los resultados.
5. **Compón:** combina el material de IA con textos y recursos puestos en edición.

---

## Proporciones

Especifícalas siempre en el prompt o en los ajustes de generación:

| Plataforma | Proporción | Resolución |
|------------|-----------|------------|
| YouTube | 16:9 | 1920×1080 o 3840×2160 |
| TikTok, Reels, Shorts | 9:16 | 1080×1920 |
| Feed de Instagram | 1:1 o 4:5 | 1080×1080 o 1080×1350 |
| Portada de una web | 16:9 | 1920×1080 |
| LinkedIn | 16:9 o 1:1 | 1920×1080 |

---

## Optimización de costos

- **Itera en baja resolución:** sube de calidad solo la versión final.
- **Usa un modelo económico para borradores** (Kling suele ser el más barato por segundo) y pasa a Veo u otro de gama alta para los finales.
- **Imagen a video:** dar un cuadro de referencia ahorra créditos y da mejores resultados (`imagen_inicial`).
- **Agrupa prompts parecidos:** muchos proveedores dan descuentos por volumen.
- **Guarda y reutiliza:** el material de apoyo se puede reutilizar en varios videos (`buscar_en_galeria` antes de generar otra vez).
- Pide el OK del dueño antes de tandas grandes y respeta los topes del Estudio.
