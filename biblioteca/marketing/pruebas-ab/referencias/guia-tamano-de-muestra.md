# Guía de tamaño de muestra

Cómo calcular cuántas personas necesita una prueba y cuánto debe durar.

## Contenido
- Lo básico (qué datos hacen falta y qué significan)
- Tablas de referencia
- Cálculo de la duración
- Calculadoras en línea
- Más de dos variantes
- Errores comunes
- Cuando el tamaño necesario es demasiado alto
- Pruebas secuenciales
- Decisión rápida

## Lo básico

### Datos que hacen falta

1. **Tasa de conversión de base:** la actual.
2. **Efecto mínimo detectable (EMD):** el cambio más pequeño que vale la pena detectar.
3. **Nivel de significancia:** casi siempre 95 % (α = 0,05).
4. **Potencia estadística:** casi siempre 80 % (β = 0,20).

### Qué significan

**Tasa de base:** si la página convierte al 5 %, esa es tu base. Usa la de esa página o ese paso, no el promedio del sitio.

**Efecto mínimo detectable:** la mejora más pequeña que te importa detectar. Fíjalo según:
- el impacto en el negocio (¿una mejora del 5 % significa algo en ventas?);
- el costo de implementarlo (¿vale el esfuerzo?);
- lo realista (¿qué mostraron pruebas anteriores?).

**Significancia del 95 %:** si en realidad no hubiera diferencia, verías una como esta menos del 5 % de las veces.

**Potencia del 80 %:** si existe un efecto real del tamaño del EMD, tienes un 80 % de probabilidad de detectarlo.

## Tablas de referencia

Personas por variante, con 95 % de significancia (dos colas) y 80 % de potencia, calculadas con la fórmula estándar para comparar dos proporciones y redondeadas. La mejora es relativa (un 20 % sobre 5 % es pasar a 6 %). Confirma siempre con una calculadora antes de lanzar.

> Nota de esta adaptación: las tablas del original en inglés no coincidían entre sí; estas se recalcularon con la fórmula estándar.

### Conversión de base: 1 %

| Mejora a detectar | Por variante | Total (2 variantes) |
|---|---|---|
| 5 % (1 % → 1,05 %) | 637.000 | 1.274.000 |
| 10 % (1 % → 1,1 %) | 163.000 | 326.000 |
| 20 % (1 % → 1,2 %) | 43.000 | 86.000 |
| 50 % (1 % → 1,5 %) | 7.800 | 15.600 |
| 100 % (1 % → 2 %) | 2.300 | 4.600 |

### Conversión de base: 3 %

| Mejora a detectar | Por variante | Total |
|---|---|---|
| 5 % (3 % → 3,15 %) | 208.000 | 416.000 |
| 10 % (3 % → 3,3 %) | 53.000 | 106.000 |
| 20 % (3 % → 3,6 %) | 14.000 | 28.000 |
| 50 % (3 % → 4,5 %) | 2.500 | 5.000 |
| 100 % (3 % → 6 %) | 750 | 1.500 |

### Conversión de base: 5 %

| Mejora a detectar | Por variante | Total |
|---|---|---|
| 5 % (5 % → 5,25 %) | 122.000 | 244.000 |
| 10 % (5 % → 5,5 %) | 31.000 | 62.000 |
| 20 % (5 % → 6 %) | 8.200 | 16.400 |
| 50 % (5 % → 7,5 %) | 1.500 | 3.000 |
| 100 % (5 % → 10 %) | 440 | 880 |

### Conversión de base: 10 %

| Mejora a detectar | Por variante | Total |
|---|---|---|
| 5 % (10 % → 10,5 %) | 58.000 | 116.000 |
| 10 % (10 % → 11 %) | 15.000 | 30.000 |
| 20 % (10 % → 12 %) | 3.800 | 7.600 |
| 50 % (10 % → 15 %) | 690 | 1.380 |
| 100 % (10 % → 20 %) | 200 | 400 |

### Conversión de base: 20 %

| Mejora a detectar | Por variante | Total |
|---|---|---|
| 5 % (20 % → 21 %) | 26.000 | 52.000 |
| 10 % (20 % → 22 %) | 6.500 | 13.000 |
| 20 % (20 % → 24 %) | 1.700 | 3.400 |
| 50 % (20 % → 30 %) | 300 | 600 |
| 100 % (20 % → 40 %) | 85 | 170 |

**La fórmula** (por si hay que calcular otro caso): n por variante = (1,96 · √(2·p̄·(1−p̄)) + 0,84 · √(p₁(1−p₁) + p₂(1−p₂)))² / (p₂ − p₁)², donde p₁ es la tasa de base, p₂ la tasa con la mejora y p̄ su promedio.

## Cálculo de la duración

### Fórmula

```
Duración (días) = (Muestra por variante × Número de variantes) / (Tráfico diario × % expuesto a la prueba)
```

### Ejemplos

**Escenario 1: página con mucho tráfico**
- Necesitas 10.000 por variante (2 variantes = 20.000)
- Tráfico diario: 5.000 visitas, 100 % expuesto
- Duración: 20.000 / 5.000 = **4 días** (pero mira la duración mínima abajo)

**Escenario 2: tráfico medio**
- Necesitas 30.000 por variante (60.000 en total)
- Tráfico diario: 2.000, 100 % expuesto
- Duración: 60.000 / 2.000 = **30 días**

**Escenario 3: poco tráfico y exposición parcial**
- Necesitas 15.000 por variante (30.000 en total)
- Tráfico diario: 500, 50 % expuesto → 250 efectivos al día
- Duración: 30.000 / 250 = **120 días** (demasiado)

**Escenario 4: correo a la base de clientes**
- Base de 4.000 contactos; prueba de asunto con 1.000 por variante y el resto recibe la ganadora.
- Con una tasa de apertura de base del 30 %, 1.000 por variante detecta con fiabilidad diferencias grandes (de unos 6 puntos o más), no matices. Úsalo para decidir entre ideas muy distintas.

### Duración mínima

Aunque llegues antes a la muestra, deja correr la prueba al menos:
- **1 semana completa:** para captar la diferencia entre días.
- **2 ciclos de negocio:** si es B2B (patrones de días hábiles y fin de semana).
- **Pasando por días de pago:** en comercio (principio y fin de mes, quincenas).
- **Sin temporadas raras:** evita que la prueba coincida solo con un feriado largo, el Buen Fin, un Cyber Day o una promoción, salvo que eso sea lo que se prueba.

### Duración máxima

Evita pasar de 4 a 8 semanas:
- el efecto novedad se desgasta;
- se meten factores externos;
- cuesta la oportunidad de otras pruebas.

## Calculadoras en línea

- **Evan Miller** (evanmiller.org/ab-testing/sample-size.html): sencilla.
- **Optimizely** (optimizely.com/sample-size-calculator): lenguaje de negocio, estima la duración.
- **AB Test Guide** (abtestguide.com/calc): incluye opción bayesiana y varios tipos de prueba.
- **VWO** (vwo.com/tools/ab-test-duration-calculator): enfocada en la duración.

El agente no las usa por sí mismo salvo que tenga la búsqueda web; puede dar el cálculo con la fórmula y sugerir al dueño confirmarlo en una.

## Más de dos variantes

Con más de 2 variantes (A/B/n) hace falta más muestra:

| Variantes | Multiplicador aproximado |
|---|---|
| 2 (A/B) | 1x |
| 3 (A/B/C) | ~1,5x |
| 4 (A/B/C/D) | ~2x |
| 5 o más | Mejor reducir variantes |

**Por qué:** más comparaciones aumentan la probabilidad de falsos positivos (A contra B, A contra C, a veces B contra C). Aplica la corrección de Bonferroni o usa herramientas que lo hagan solas.

## Errores comunes

1. **Pruebas sin potencia:** no hay muestra para detectar efectos realistas. Solución: sé realista con el EMD, consigue más tráfico o no pruebes.
2. **Pruebas con potencia de sobra:** esperar la muestra cuando ya hay significancia. Esto en realidad está bien: te comprometiste con un tamaño, respétalo.
3. **Tasa de base equivocada:** usar la del sitio en vez de la de esa página y esa métrica.
4. **Ignorar segmentos:** calcular para todo el tráfico y luego analizar segmentos. Si vas a analizar por segmento, calcula para el más pequeño.
5. **Demasiadas pruebas a la vez:** dividir el tráfico de más. Prioriza sin piedad y corre menos pruebas simultáneas.

## Cuando el tamaño necesario es demasiado alto

Opciones cuando no alcanza el tráfico (lo más común en negocios pequeños y locales):

1. **Subir el EMD:** aceptar detectar solo efectos grandes (20 % o más).
2. **Bajar la confianza:** 90 % en lugar de 95 % (riesgoso; déjalo escrito).
3. **Menos variantes:** probar solo la más prometedora.
4. **Juntar tráfico:** probar en varias páginas parecidas a la vez (todas las fichas de producto, todas las sedes).
5. **Probar más arriba:** donde hay más volumen (el anuncio, el asunto del correo, la primera pantalla).
6. **No probar:** decidir con datos cualitativos (entrevistas, grabaciones, preguntas por WhatsApp).
7. **Probar más tiempo:** aceptar semanas o meses.
8. **Antes y después con cuidado:** cambiar y comparar con el mismo periodo anterior, sabiendo que es una señal débil (la temporada, el clima o una promoción pueden explicar la diferencia). Dilo así en la entrega.

## Pruebas secuenciales

Si de verdad necesitas mirar antes de llegar a la muestra.

- **Qué es:** un método estadístico que ajusta por las veces que miras los datos.
- **Cuándo usarlo:** cambios de alto riesgo, cuando hay que parar pronto una variante mala, decisiones con prisa.
- **Herramientas que lo traen:** Optimizely (Stats Accelerator), VWO (SmartStats), PostHog (enfoque bayesiano), entre otras.
- **El costo:** más libertad para parar antes, a cambio de una muestra algo mayor y un análisis más complejo.

## Decisión rápida

### ¿Puedo correr esta prueba?

```
Tráfico diario a la página: _____
Tasa de conversión de base: _____
EMD que me importa: _____

Muestra por variante: _____ (de las tablas)
Días de prueba: Muestra × variantes / Tráfico diario = _____

Si los días > 60: busca alternativas
Si los días > 30: aceptable para pruebas de alto impacto
Si los días < 14: probablemente viable
Si los días < 7: fácil; córrela igual al menos una semana completa
```
