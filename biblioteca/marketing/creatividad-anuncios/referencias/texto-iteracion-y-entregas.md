# Escribir, iterar y entregar el texto de los anuncios (paso a paso)

Detalle del método de texto de `creatividad-anuncios`: cómo definir ángulos, generar y validar variaciones, iterar con datos, los estándares de titulares y descripciones, los formatos de entrega, el flujo por lotes y los errores comunes. Las reglas «sin señales de IA» y las medidas por plataforma están en el `SKILL.md`; los límites completos, en `especificaciones-plataformas`.

---

## Generar el texto

### Paso 1: define tus ángulos
Antes de escribir titulares sueltos, establece **3–5 ángulos** distintos: razones diferentes por las que alguien haría clic. Cada ángulo toca una motivación distinta.

| Categoría | Ejemplo de ángulo |
|---|---|
| Punto de dolor | «Deja de perder tiempo en X» |
| Resultado | «Logra Y en Z días» |
| Prueba social | «Únete a los más de 10.000 equipos que…» (solo con la cifra real) |
| Curiosidad | «El secreto de X que usan las mejores empresas» |
| Comparación | «A diferencia de X, nosotros hacemos Y» |
| Urgencia | «Por tiempo limitado: lleva X gratis» (solo si es verdad) |
| Identidad | «Hecho para [rol o tipo de persona específico]» |
| Contraria | «Por qué [práctica común] no funciona» |

### Paso 2: genera variaciones por ángulo
Para cada ángulo, varias variaciones. Varía:
- **La elección de palabras**: sinónimos, voz activa o pasiva.
- **La especificidad**: números o afirmaciones generales.
- **El tono**: directo, pregunta, orden.
- **La estructura**: golpe corto o beneficio completo.

### Paso 3: valida contra las medidas
Antes de entregar, comprueba cada pieza contra los límites de caracteres de la plataforma. Señala lo que se pase y da una alternativa recortada.

### Paso 4: organiza para subir
Presenta la creatividad en un formato que se corresponda con lo que pide la plataforma al subir.

---

## Iterar con datos de rendimiento

### Paso 1: analiza los ganadores
Mira las mejores creatividades (por CTR, tasa de conversión o retorno; **pregunta qué métrica importa más**) e identifica:
- **Temas ganadores**: qué temas o dolores aparecen en los mejores.
- **Estructuras ganadoras**: ¿preguntas, afirmaciones, órdenes, números?
- **Palabras ganadoras**: palabras o frases que se repiten.
- **Uso de caracteres**: ¿los mejores son más cortos o más largos?

### Paso 2: analiza los perdedores
- **Temas que no funcionan**: qué ángulos no resuenan.
- **Patrones comunes de los de bajo rendimiento**: ¿demasiado genéricos? ¿largos? ¿tono equivocado?

Ojo con leer una sola métrica: un anuncio con menos clics pero más conversiones puede ser el más eficiente (por ejemplo, un anuncio de prueba social con CTR 1,4 % y conversión 6,2 % frente a uno de dolor con CTR 2,1 % y conversión 4,5 %). Mira CTR, costo por clic y conversión juntos, y no concluyas con muy pocas impresiones.

### Paso 3: genera variaciones nuevas
Crea creatividades que:
- **Profundicen** los temas ganadores con redacción fresca.
- **Extiendan** los ángulos ganadores en variantes nuevas.
- **Prueben** 1–2 ángulos nuevos que aún no se exploraron.
- **Eviten** los patrones de los de bajo rendimiento.

### Paso 4: documenta la iteración
```
## Registro de iteración
- Ronda: [número]
- Fecha: [fecha]
- Mejores: [lista con métricas]
- Patrones ganadores: [resumen]
- Variaciones nuevas: [n] titulares, [n] descripciones
- Ángulos nuevos en prueba: [lista]
- Ángulos retirados: [lista]
```

---

## Estándares de redacción

### Titulares que hacen clic
**Fuertes:**
- Específicos («Reduce 75 % el tiempo de tus informes») mejor que vagos («Ahorra tiempo»).
- Beneficios («Entrega más rápido») mejor que funciones («tubería de integración continua»).
- Voz activa («Automatiza tus informes») mejor que pasiva.
- Con números cuando se pueda («3 veces más rápido», «en 5 minutos») y **solo con cifras reales**.

**Evita:**
- La jerga que el público no reconoce.
- Afirmaciones sin especificidad («El mejor», «Líder», «Número 1»).
- Mayúsculas sostenidas o puntuación excesiva.
- El cebo que la página de destino no puede cumplir.

### Descripciones que convierten
Complementan al titular, no lo repiten. Úsalas para:
- Añadir pruebas (cifras reales, testimonios reales, premios).
- Resolver objeciones («Sin tarjeta de crédito», «Gratis para equipos pequeños», «Cotización sin compromiso»).
- Reforzar el llamado («Empieza tu prueba gratis hoy», «Reserva tu cita»).
- Añadir urgencia cuando es genuina («Limitado a los primeros 500 registros»).

---

## Cómo entregarlo

### Salida estándar
Organizada por ángulo, con el conteo de caracteres:

```
## Ángulo: [Punto de dolor — informes manuales]

### Titulares (máx. 30 caracteres)
1. «Deja de armar informes a mano» (29)
2. «Automatiza tus informes» (23)
3. «Informes en 5 min, no en 5 h» (28)
   (si algo se pasa: «<- SE PASA, recortado abajo» y la versión recortada)

### Descripciones (máx. 90 caracteres)
1. «Ahorra más de 10 horas a la semana con informes automáticos. Empieza gratis.» (76)
2. «Conecta tus datos una vez. Informes automáticos siempre. Sin programar.» (71)
```

Cada ángulo trae: nombre, gancho, cuerpo, llamado a la acción y **la dirección visual** (qué imagen o video lo acompaña, con el prompt para el Estudio si se genera).

### Salida masiva (CSV)
Con 10 o más variaciones, ofrece el formato CSV para subida directa:

```csv
titular_1,titular_2,titular_3,descripcion_1,descripcion_2,plataforma
"Deja los informes manuales","Automatiza en 5 minutos","Más de 10 mil equipos","Ahorra 10+ h por semana. Empieza gratis.","Conecta tus datos una vez.","google_ads"
```
(Las cifras del ejemplo son ilustrativas: las reales salen de las cifras de la empresa.)

### Lote estático (modo 3)
Entrega un **índice** que se lea en 2 minutos (cada concepto: tipo de plantilla y fuente del fundamento) y, debajo, una ficha por concepto (titular, cuerpo, descripción visual, prompt de imagen, fundamento), en el formato de `plantillas-estaticos-parte-2`. El flujo humano que esto apoya: abrir la entrega, leer el índice, elegir los mejores 5–10 para probar. Elegir 5 ganadores entre 50 conceptos da mejor creatividad que elegir 5 entre 10. Las imágenes generadas van como `![…](/media/…)`.

### Tablero de revisión (para quien aprueba)
Cuando quien debe elegir no eres tú (el dueño, un cliente, un socio), entrega un **tablero de revisión**: cada concepto con su vista previa de feed, los carruseles como guion cuadro por cuadro con etiquetas, las variantes de titular para comparar y lo que está respaldado por material real. Formato y modelo de datos en `pagina-de-revision-creativa`. Es la mejora visual del índice: una decisión tomada sobre un solo documento.

### Informe de iteración
```
## Resumen de rendimiento
- Analizados: [X] titulares, [Y] descripciones
- Mejor: «[titular]» — [métrica]: [valor]
- Peor: «[titular]» — [métrica]: [valor]
- Patrón: [observación]

## Creatividad nueva
[variaciones organizadas]

## Recomendaciones
- [Qué pausar, qué escalar, qué probar después]
```

---

## Flujo de generación por lotes

Para producción creativa a gran escala (más de 100 variaciones por ciclo):

1. **Divide en sub-tareas:** titulares (enfocados en el clic), descripciones (en la conversión) y textos principales (en la interacción; Meta y LinkedIn).
2. **Genera por oleadas:** oleada 1, ángulos centrales (3–5 ángulos, 5 variaciones cada uno); oleada 2, variaciones ampliadas sobre los 2 mejores; oleada 3, ángulos comodín (contrarios, emocionales, muy específicos).
3. **Filtro de calidad:** quita lo que se pase del límite, los duplicados y casi duplicados; señala lo que pueda violar políticas de la plataforma; asegúrate de que las combinaciones de titular y descripción tengan sentido juntas.

---

## Errores comunes

- **Escribir titulares que solo funcionan juntos**: los de un RSA se combinan al azar.
- **Ignorar los límites de caracteres**: las plataformas cortan sin avisar.
- **Variaciones que suenan igual**: varía los ángulos, no solo las palabras.
- **Sin titulares de llamado a la acción**: los RSA necesitan 2–3.
- **Descripciones genéricas** («Conoce más sobre nuestra solución») que desperdician el espacio.
- **Iterar sin datos**: las corazonadas son menos fiables que las métricas.
- **Generar sin fundamento**: los conceptos sin fundamento se leen como todos los demás; primero reúne anuncios ganadores, reseñas y comentarios.
- **Saltarse los comentarios**: ahí están las objeciones y los ángulos que plantean los propios clientes, que suelen convertir mejor.
- **Probar demasiadas cosas a la vez**: cambia una variable por ciclo de prueba.
- **Retirar una creatividad demasiado pronto**: deja pasar más de 1.000 impresiones antes de juzgarla.

---
