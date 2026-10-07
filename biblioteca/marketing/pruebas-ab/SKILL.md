---
name: pruebas-ab
titulo: Pruebas A/B y experimentos
description: Úsala cuando haya que planear, diseñar o leer una prueba A/B (dos versiones de una página, un anuncio, un correo o un mensaje), calcular cuánto debe durar, o montar un programa continuo de experimentos con su lista priorizada.
area: conversion
departments: [marketing, ops]
agents: [mlead, ada, newt, dash]
origen: marketingskills/ab-testing (MIT, Corey Haines)
palabras: [prueba A/B, experimento, variante, test, hipótesis, significancia]
---
# Pruebas A/B y experimentos

Sirve para diseñar pruebas que den resultados válidos y accionables: qué cambiar, cuánta gente hace falta, cuánto debe durar, qué medir y cómo decidir. También para convertir las pruebas sueltas en un programa continuo de experimentos.

Vale para cualquier negocio con algo que comparar: dos titulares de una página, dos versiones de un anuncio en Meta, dos asuntos de un correo, dos mensajes de WhatsApp para recuperar carritos, dos formas de presentar un menú o un paquete de servicios.

## Antes de empezar

Lee las notas de la empresa en el Cerebro (`00-Empresa/perfil`, `00-Empresa/oferta`, `00-Empresa/clientes` y, sobre todo, `00-Empresa/marketing`) y las cifras de la empresa. Si hay una nota de experimentos anteriores (el libro de jugadas, ver abajo), léela primero. Si falta algo que necesitas, pregúntalo en una línea o déjalo marcado como supuesto; nunca lo inventes, y menos una tasa de conversión o un volumen de tráfico.

Lo que necesitas entender:
1. **Contexto:** qué se quiere mejorar, qué cambio se considera y por qué, y si ya se probó algo en esa zona.
2. **Situación actual:** la tasa de conversión de esa página, anuncio o correo y cuánto tráfico recibe (visitas al día, envíos por campaña, impresiones).
3. **Restricciones:** complejidad técnica, plazo, la mejora más pequeña que vale la pena detectar y con qué herramienta se puede probar (plataforma de pruebas web, el A/B de Meta Ads, el de la herramienta de correo…). Si la empresa tiene conectada alguna, úsala para leer datos; si no, pídele las cifras al dueño.

## Principios

1. **Empieza con una hipótesis.** No «a ver qué pasa»: una predicción concreta, basada en razonamiento o datos.
2. **Prueba una sola cosa.** Una variable por prueba; si no, no sabrás qué funcionó.
3. **Rigor estadístico.** Fija el tamaño de muestra antes, no mires y pares antes de tiempo, respeta el método.
4. **Mide lo que importa.** Una métrica principal unida al valor del negocio, secundarias para dar contexto y de resguardo para no hacer daño.

## Marco de la hipótesis

```
Como [observación o dato],
creemos que [cambio]
provocará [resultado esperado]
en [público].
Lo sabremos cuando [métricas].
```

- **Débil:** «Cambiar el color del botón podría aumentar los clics».
- **Fuerte:** «Como los visitantes dicen que no encuentran el botón (según mapas de calor y comentarios), creemos que hacerlo más grande y de un color que contraste aumentará los clics en un 15 % o más entre visitantes nuevos. Mediremos el porcentaje que pasa de ver la página a empezar el registro».
- **Negocio local:** «Como la mitad de los mensajes de WhatsApp preguntan el precio, creemos que poner "desde [precio de las cifras]" en el anuncio aumentará las citas agendadas por cada mensaje recibido. Lo sabremos por la proporción de conversaciones que terminan en cita».

## Tipos de prueba

| Tipo | Qué es | Tráfico necesario |
|---|---|---|
| A/B | Dos versiones, un cambio | Moderado |
| A/B/n | Varias variantes | Mayor |
| Multivariante (MVT) | Varios cambios combinados | Muy alto |
| Por dirección (split URL) | Cada variante en una dirección distinta | Moderado |

## Tamaño de muestra

Referencia rápida, personas por variante, con 95 % de confianza y 80 % de potencia (calculado con la fórmula estándar para dos proporciones y redondeado; confirma con una calculadora):

| Conversión de base | Mejora de 10 % | Mejora de 20 % | Mejora de 50 % |
|---|---|---|---|
| 1 % | 163.000 | 43.000 | 7.800 |
| 3 % | 53.000 | 14.000 | 2.500 |
| 5 % | 31.000 | 8.200 | 1.500 |
| 10 % | 15.000 | 3.800 | 690 |

Calculadoras gratuitas: la de Evan Miller, la de Optimizely, AB Test Guide (con opción bayesiana), la de duración de VWO. Tablas completas, cálculo de duración y qué hacer cuando no alcanza el tráfico: `guia-tamano-de-muestra`.

**Si el negocio tiene poco tráfico** (lo normal en un consultorio, una tienda de barrio o una empresa que empieza): prueba solo cambios grandes, prueba donde hay más volumen (anuncios, correos a toda la base, el primer paso del embudo), o decide con datos cualitativos. Una prueba que necesitaría seis meses no es una prueba.

## Métricas

- **Principal:** una sola, la que más importa, unida a la hipótesis; con ella se declara el resultado.
- **Secundarias:** ayudan a interpretar la principal; explican por qué o cómo funcionó.
- **De resguardo:** lo que no debe empeorar; si empeora de forma significativa, se para la prueba.

Ejemplo, página de precios: principal, porcentaje que elige un plan; secundarias, tiempo en la página y reparto entre planes; resguardo, consultas al soporte y devoluciones.
Ejemplo, anuncio de un restaurante: principal, reservas por cada 1.000 personas alcanzadas; secundaria, clics; resguardo, cancelaciones y reseñas negativas sobre «no era lo que decía el anuncio».

## Diseñar las variantes

| Qué cambiar | Ejemplos |
|---|---|
| Titulares y texto | Ángulo, propuesta de valor, nivel de detalle, tono |
| Diseño | Disposición, color, imágenes, jerarquía (las imágenes se pueden preparar con el Estudio: `generar_imagen`) |
| Botón | Texto, tamaño, lugar, cantidad |
| Contenido | Qué información, en qué orden, cuánta, qué prueba social |

Buenas prácticas: un cambio único y con sentido, lo bastante audaz para notarse, fiel a la hipótesis. Para escribir el texto de las variantes, usa `redaccion-publicitaria`.

## Reparto del tráfico

| Enfoque | Reparto | Cuándo |
|---|---|---|
| Estándar | 50/50 | Por defecto en A/B |
| Prudente | 90/10, 80/20 | Para limitar el riesgo de una mala variante |
| Escalonado | Empieza pequeño y sube | Para mitigar riesgo técnico |

Cuida que cada persona vea siempre la misma variante cuando vuelve, y que ambas variantes reciban tráfico parejo a lo largo del día y de la semana.

## Implementación

- **En el navegador:** un script cambia la página al cargar. Rápido de montar, puede «parpadear». Herramientas: PostHog, Optimizely, VWO, entre otras.
- **En el servidor:** la variante se decide antes de mostrar la página. Sin parpadeo, requiere trabajo de desarrollo. Herramientas: PostHog, LaunchDarkly, Split, entre otras.
- **En plataformas:** Meta Ads, Google Ads y la mayoría de las herramientas de correo traen su propio A/B. Suele ser lo más fácil para un negocio pequeño.

El agente no instala ni lanza nada: deja el plan, las variantes y la lista de verificación para que el dueño (o quien maneje la web o la cuenta de anuncios) lo monte con su OK.

## Durante la prueba

**Antes de lanzar:**
- [ ] Hipótesis escrita
- [ ] Métrica principal definida
- [ ] Tamaño de muestra calculado
- [ ] Variantes bien montadas
- [ ] Medición verificada
- [ ] Revisión de todas las variantes (también en el teléfono)

**Mientras corre, sí:** vigilar problemas técnicos, revisar la calidad de cada segmento, anotar factores externos (un feriado, una promoción, una mención en medios). Esto se puede dejar como una rutina semanal de la oficina que solo lee y reporta.
**Evita:** mirar resultados y parar antes de tiempo, cambiar las variantes, meter tráfico de fuentes nuevas.

**El problema de espiar:** mirar los resultados antes de llegar a la muestra y parar temprano produce falsos positivos y malas decisiones. Comprométete con el tamaño de muestra y confía en el proceso. Si de verdad necesitas mirar antes, usa una prueba secuencial (ver la guía).

## Leer los resultados

**Significancia estadística:** 95 % de confianza equivale a un valor p < 0,05; quiere decir que hay menos de un 5 % de probabilidad de ver esa diferencia si en realidad no hay ninguna. Es un umbral, no una garantía.

**Lista de análisis:**
1. ¿Se llegó a la muestra? Si no, el resultado es preliminar.
2. ¿Es significativo? Revisa los intervalos de confianza.
3. ¿El efecto es relevante? Compáralo con la mejora mínima que te importaba y proyecta el impacto.
4. ¿Las secundarias son coherentes con la principal?
5. ¿Algún resguardo empeoró?
6. ¿Hay diferencias por segmento (teléfono o computadora, nuevos o recurrentes)?

| Resultado | Conclusión |
|---|---|
| Ganadora significativa | Implementar la variante |
| Perdedora significativa | Quedarse con el control y aprender por qué |
| Sin diferencia significativa | Hace falta más tráfico o una prueba más audaz |
| Señales mezcladas | Investigar más, quizá por segmento |

**Documenta cada prueba:** hipótesis, variantes (con capturas), resultados (muestra, métricas, significancia), decisión y aprendizajes. Plantillas: `plantillas-de-pruebas`.

## Programa de experimentos

Una prueba suelta vale; un programa continuo es un activo que se acumula.

**El ciclo:**
```
1. Generar hipótesis (datos, investigación, competencia, comentarios de clientes)
2. Priorizar con ICE
3. Diseñar y correr la prueba
4. Analizar con rigor
5. Pasar las ganadoras al libro de jugadas
6. Sacar hipótesis nuevas de lo aprendido
→ Repetir
```

**De dónde salen las hipótesis:**

| Fuente | Qué buscar |
|---|---|
| Analítica | Dónde se cae la gente, páginas que convierten poco, segmentos flojos |
| Investigación de clientes | Dolores, confusión, expectativas no cumplidas (ver `investigacion-clientes`) |
| Competencia | Funciones, mensajes o diseños que usan y tú no |
| Soporte, WhatsApp, reseñas | Preguntas o quejas que se repiten sobre cómo comprar |
| Mapas de calor y grabaciones | Dónde dudan, hacen clic con rabia o abandonan |
| Pruebas anteriores | Las perdedoras significativas suelen abrir ángulos nuevos |

**Priorizar con ICE.** Puntúa cada hipótesis de 1 a 10 en tres dimensiones:

| Dimensión | Pregunta |
|---|---|
| **Impacto** (Impact) | Si funciona, ¿cuánto mueve la métrica principal? |
| **Confianza** (Confidence) | ¿Qué tan seguros estamos de que funcione? (Con datos, no con intuición) |
| **Facilidad** (Ease) | ¿Qué tan rápido y barato se monta y se mide? |

**Puntaje ICE** = (Impacto + Confianza + Facilidad) / 3. Corre primero las de mayor puntaje y vuelve a puntuar cada mes.

**Ritmo del programa (orientación, no reglas):**

| Indicador | Referencia habitual |
|---|---|
| Experimentos lanzados al mes | 4 a 8 para la mayoría de los equipos (menos con poco tráfico) |
| Porcentaje de ganadoras | 20 a 30 % es común en programas maduros; tasas altas sostenidas pueden indicar hipótesis demasiado tímidas |
| Duración media | 2 a 4 semanas |
| Lista de espera | 20 o más hipótesis en cola |
| Mejora acumulada | La suma de todas las ganadoras |

**El libro de jugadas.** Cuando una prueba gana, no solo la implementes: documenta el patrón. El formato está en `plantillas-de-pruebas`; propónlo como una nota del Cerebro (por ejemplo, `Marketing/experimentos`) que el dueño guarda, para que cada agente lo lea antes de proponer pruebas. Con el tiempo se vuelve una biblioteca de patrones probados para este negocio y este público.

**Cadencia:**
- **Semanal (30 min):** revisar las pruebas en curso por problemas técnicos y resguardos. No declarar ganadoras antes de tiempo, pero sí parar las que empeoran un resguardo de forma significativa.
- **Cada dos semanas:** cerrar las terminadas, analizar, actualizar el libro de jugadas, lanzar la siguiente de la lista.
- **Mensual (1 hora):** ritmo, porcentaje de ganadoras, mejora acumulada; reponer y volver a priorizar la lista.
- **Trimestral:** auditar el libro de jugadas: ¿qué patrones se aplicaron en todas partes? ¿qué ganadores no se han escalado? ¿qué parte del embudo está poco probada?

La revisión semanal y la mensual se pueden proponer como rutinas de la oficina (qué agente, qué día, el texto de la tarea; solo leen y reportan, así que no necesitan el OK).

## Errores comunes

- **Diseño:** probar un cambio demasiado pequeño (no se detecta), probar demasiadas cosas (no se aísla), no tener hipótesis.
- **Ejecución:** parar antes, cambiar cosas a mitad, no revisar que esté bien montada.
- **Análisis:** ignorar los intervalos de confianza, elegir a dedo los segmentos que convienen, sobreinterpretar lo que no fue concluyente.

## Cómo entregarlo

Según el pedido:
- **Plan de prueba:** la plantilla «Plan de prueba» de `plantillas-de-pruebas` completa: hipótesis, diseño, variantes (con su texto), métricas, tamaño de muestra y duración con el cálculo a la vista, plan por segmentos, criterios de éxito y la lista previa al lanzamiento.
- **Lectura de resultados:** la plantilla «Resultados» con la decisión y lo aprendido, y la entrada para el libro de jugadas.
- **Programa:** la lista de hipótesis priorizada con ICE (tabla), el ritmo propuesto, las rutinas sugeridas y el formato del libro de jugadas.
- Una línea final: qué necesita el OK del dueño para lanzarse.

## Reglas

- Nunca inventes tasas de conversión, tráfico ni resultados: si no los tienes, pídelos o márcalos como supuestos.
- Una hipótesis escrita antes de cualquier prueba.
- Una variable por prueba; tamaño de muestra fijado antes de empezar.
- No declares ganadora sin llegar a la muestra.
- Nada se lanza ni se cambia en la web o en los anuncios sin el OK del dueño.

## Referencias

- `guia-tamano-de-muestra` — tablas de tamaño de muestra, cálculo de duración, varias variantes, qué hacer con poco tráfico, pruebas secuenciales. Léela al calcular si una prueba es viable.
- `plantillas-de-pruebas` — plan de prueba, resultados, registro, ficha rápida, informe para el dueño, matriz de priorización, banco de hipótesis y libro de jugadas. Léela al entregar.

## Habilidades relacionadas

- `conversion-paginas` — ideas de prueba a partir de principios de conversión.
- `medicion-analitica` — montar la medición de la prueba.
- `redaccion-publicitaria` — escribir el texto de las variantes.
- `campanas-pagadas` y `creatividad-anuncios` — pruebas en anuncios.
- `secuencias-correo` — pruebas de asuntos y contenido de correos.
