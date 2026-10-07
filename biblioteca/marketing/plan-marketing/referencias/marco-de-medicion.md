# Marco de medición: indicadores, estrella polar y cadencia

Todo plan necesita una sección de medición que le diga al equipo cómo saber si el plan funciona. Esta guía es la fuente de la subsección de medición de la Sección 13.

**Documentos relacionados:**
- `patrones-de-crecimiento`: la trayectoria 3-3-2-2-2 del capital riesgo (3× en los años 1–2, 2× en los años 3–7 desde 1.000.000 de ARR) y en qué fase de crecimiento está la empresa (de 0 a 10.000 / de 10.000 a 100.000 / de 100.000 a 1.000.000+)
- `planificacion-del-presupuesto`: el cálculo del CAC (combinado, no solo pagado) y la revisión de realidad del pronóstico (los pronósticos por debajo de 100 millones de ARR son conjeturas informadas, no predicciones precisas)

## El principio de la estrella polar

Una estrella polar es una sola métrica que captura la tesis del modelo de negocio al nivel más alto. Debe:
- Poder derivarse del embudo y del modelo de ingresos
- Moverse lo bastante despacio para ser una brújula estratégica (sin que el ruido semanal la sacuda)
- Equilibrarse bien contra otras métricas: mejorar la estrella polar debería, por lo general, mejorar el negocio

No pongas por defecto «ARR» o «ingreso mensual» solos. Son resultados, no estrellas polares. Elige algo que capture el modelo de negocio.

## Patrones de estrella polar por modelo de negocio

### SaaS B2B (suscripción)
- **Retención neta de ingresos (NRR):** mantiene en foco a los clientes existentes más la expansión
- Alternativa: «retención de clientes (logos) × ARR de expansión»
- Por qué: el ARR solo esconde las bajas y deja que el crecimiento bruto de altas tape problemas de encaje con el producto

### App de consumo D2C (suscripción)
- **LTV combinado / CAC combinado:** mantiene honesta la economía por cliente mientras escala lo pagado
- Alternativa: «usuarios de pago al día 35 de la cohorte × LTV»
- Por qué: las métricas mensuales de suscripción son volátiles; cohorte × LTV las suaviza

### Híbrido de producto físico + software
- **LTV combinado / CAC combinado entre producto físico y software:** captura la tesis de la cuña
- Alternativa: «conversión de compradores del producto físico a suscriptores × margen combinado»
- Por qué: el ingreso del producto físico no es gratis (cuesta fabricarlo); el ingreso por suscripción no es caro de adquirir si el producto físico lo financia

### Plataforma de dos lados
- **Razón de liquidez × comisión:** captura ambos lados más la monetización
- Alternativa: «usuarios que transaccionan al mes × comisión × frecuencia de recompra»
- Por qué: el volumen transado solo no captura si la plataforma se está volviendo un hábito

### Herramienta para desarrolladores / código abierto
- **Desarrolladores activos por semana × conversión a pago:** captura adopción y monetización
- Alternativa: «organizaciones activas por semana × puestos por organización × ingreso medio por usuario»

### Negocio de contenido o medios
- **Lectores / oyentes activos por día × ingreso publicitario por sesión:** captura alcance y monetización
- Alternativa: «cantidad de suscriptores × retención × ingreso medio por usuario»

### Comercio (DTC, sin suscripción)
- **Tasa de recompra × valor medio del pedido × frecuencia:** captura la monetización sobre la calidad del cliente
- Alternativa: «LTV del cliente / CAC × plazo de recuperación»

### Servicios y negocio local (añadido)
- **Clientes nuevos por recomendación × valor medio por cliente al año:** captura el canal que más pesa (el boca a boca) y su valor
- Alternativa: «citas o ventas atendidas por semana ÷ capacidad disponible» (la utilización de la agenda o del local) junto con el costo por cliente nuevo
- Por qué: en un negocio con capacidad limitada, llenar de demanda lo que no se puede atender destruye la experiencia

## Indicadores adelantados por etapa AARRR

Después de la estrella polar, todo plan necesita indicadores adelantados por etapa AARRR. Se mueven más rápido que la estrella polar y disparan investigaciones.

### Indicadores adelantados de Adquisición
- Visitas orgánicas por mes, total y por pilar (salud del SEO)
- Tasa de visita a instalación de la ficha en la tienda de apps (salud de la ASO)
- Crecimiento de los canales de la cara del dueño → conversión a suscriptores de correo (embudos de LinkedIn / X / Substack)
- Tasa de conversión de evento a app o a cliente (retorno de un evento)
- Visitas atribuidas a embajadores (embudo de referidos)
- CAC pagado por canal (cuando lo pagado está en marcha)
- Para negocio local: llamadas, mensajes, solicitudes de ruta y visitas a la ficha de Google

### Indicadores adelantados de Activación
- Tasa de conversión a pago de día 1 / día 7 / día 35
- Tasa de finalización de la sesión de incorporación
- Finalización de la primera acción clave (el evento de activación posterior al registro)
- Tasa de conversión de la tienda de apps (instalación → prueba → pago)
- Tasa de conversión de prueba a pago
- Para servicios: % de consultas que reciben respuesta en menos de X horas y % que agenda

### Indicadores adelantados de Retención
- Retención a los días 30 / 60 / 90
- Tasa de bajas mensual (bruta y neta)
- Participación en el ciclo de correo (aperturas / clics / bajas por flujo)
- Tasa de activación del producto físico a la app (para negocios híbridos)
- Tasa de recuperación / reactivación
- Tasa de recompra o de clientes que vuelven en 90 días

### Indicadores adelantados de Referidos
- Nuevas suscripciones atribuidas a embajadores (vía Dub o similar)
- Tasa del momento de «compartir después del valor» (% de usuarios que comparten)
- Tasa de finalización de referidos de dos lados
- Referidos del programa de guías (cuando esté en marcha)
- Puntaje NPS (si se encuesta)

### Indicadores adelantados de Ingresos
- Ingreso medio por usuario por cohorte
- % de adopción del plan anual
- LTV de la cohorte por fuente
- Cambios en la mezcla de planes
- Tasa de ventas adicionales del producto físico (para híbridos)
- Ingreso de expansión (B2B)

## Cadencia de revisión

El plan debe especificar tres ritmos:

### Semanal (sincronización operativa)
- **Quién:** el director de marketing (o el puesto de la oficina que lleva el plan) ↔ el dueño
- **Duración:** 30 min
- **Formato:** tablero AARRR (números actuales vs. los de la semana pasada en los indicadores adelantados) + lo que sale esta semana + bloqueos
- **Resultado:** acciones pendientes, decisiones tomadas
- **En la oficina:** es una buena **rutina**: cada semana, el jefe de marketing (`mlead`) arma el tablero con los datos disponibles y deja el resumen para el dueño.

### Mensual (revisión de métricas)
- **Quién:** el responsable del plan + el dueño + el equipo ampliado (el líder de producto, de diseño si aplica)
- **Duración:** 60–90 min
- **Formato:** revisión completa de métricas + comparación con las metas de indicadores trimestrales + aprendizajes cualitativos + repriorización del banco de ideas
- **Resultado:** posibles ajustes al plan, decisiones de contratación
- **En la oficina:** otra rutina mensual (informe del mes: `ver_informe_mes` si hay redes conectadas).

### Trimestral (recalibración del plan)
- **Quién:** el responsable del plan + el dueño + asesores clave
- **Duración:** 2–3 horas
- **Formato:** revisión completa del plan frente a los resultados de 90 días y de 12 meses, análisis por canal, comprobación de la transición de nivel de recursos, recalibración de los siguientes 90 días
- **Resultado:** plan actualizado (puede ser una versión v2 / v3 del documento)

## Fijar las metas de indicadores

Por cada trimestre de la Sección 10, el plan debe incluir 3–5 metas concretas de indicadores. Deben ser:
- **Específicas:** no «mejorar la retención», sino «retención al día 30 de 22 % → 30 %»
- **Medibles:** salen de una fuente de datos conectada
- **Ambiciosas pero plausibles:** basadas en el estado del embudo y en patrones históricos
- **Que disparen decisiones:** si no se cumplen, ¿qué significa? (ajustar la estrategia, matar un canal, etc.)

### Patrones de metas por trimestre

**T1 (trimestre de cimientos):**
- Sobre todo métricas de *base*: arreglar fugas. «Se revierte la caída de conversión de la compuerta de los audífonos». «Día 1 → pago +25–50 %».
- Algunas métricas de *cimiento*: tender los rieles. «4 pilares de SEO plantados». «Reescritura de la ficha en la tienda de apps publicada».
- Evita metas de crecimiento audaces: los cimientos todavía no están puestos

**T2 (trimestre de validación):**
- Sobre todo métricas de *validación*: ¿funciona lo que construimos? «CAC pagado < X combinado». «Tráfico orgánico de 1.500–3.500 por mes».
- Algunas métricas de *cohorte*: ¿las cohortes nuevas se comportan mejor? «Retención al día 7 de la cohorte del T2 vs. la del T1».

**T3 (trimestre de escalado):**
- Sobre todo métricas de *escalado*: ¿hasta dónde llega? «Lo pagado escala a 20.000–30.000 por mes con el CAC estable». «Primer caso de referencia de instalación B2B en vivo».
- Algunas métricas de *capacidad*: ¿qué cosas nuevas están en marcha? «Primer piloto del programa de guías lanzado».

**T4 (trimestre de composición):**
- Sobre todo métricas de *composición*: ¿está girando el volante de inercia? «Más de 50 % de las suscripciones nuevas vienen de canales no pagados». «15–25 % de las suscripciones nuevas guiadas por embajadores».
- Algunas métricas de *narrativa*: ¿la historia para la siguiente ronda se escribe sola? «LTV/CAC combinado > 3».

## Anclar contra la trayectoria del capital riesgo

Para clientes con capital riesgo que superan 1.000.000 de ARR, ancla las metas de 12 meses y de varios años contra la **regla 3-3-2-2-2** (3× en los años 1 y 2, luego 2× del año 3 al 7). Cumplirla es raro; la mayoría de las empresas no lo logra. Anclar contra ella obliga al plan a igualarla y mostrar cómo, o a defender explícitamente una trayectoria más lenta. Tabla completa y contexto en `patrones-de-crecimiento`.

Para empresas sin capital riesgo (autofinanciadas, financiadas por el fundador, enfocadas en la utilidad), el 3-3-2-2-2 no aplica. Usa metas de patrón lineal («X de ingreso mensual añadido por mes») o de escalones («salto de Y en ingresos después de que salga el nivel para empresas grandes»).

## Revisión de realidad del pronóstico

Un plan deriva un presupuesto y una meta anual. No produce un pronóstico mes a mes de 12 meses que sea fiable al peso.

**Salvo que la empresa cotice en bolsa, todos los pronósticos son conjeturas informadas.** Ninguna empresa nueva logra de forma consistente pronósticos mes a mes. La revisión trimestral es cuando el plan se ajusta, no cuando la variación se trata como fracaso.

A lo que el plan se compromete con honestidad:
- La meta anual es un rumbo defendible
- El presupuesto es el compromiso de recursos que hace plausible la meta
- La hoja de ruta de 90 días (Sección 9) es lo accionable ahora
- La proyección mes a mes es ilustrativa, no una promesa

Los dueños que sobreconstruyen el pronóstico terminan explicando la variación cada mes en lugar de ejecutar. El plan debe resistirlo: nombra la meta anual, los indicadores trimestrales y los criterios de parada. No prometas el mes.

Contexto completo en `planificacion-del-presupuesto`.

## Criterios de parada

Para cada canal o iniciativa, el plan debe especificar cuándo parar. Es algo que a menudo falta en los planes; los criterios de parada fuerzan la disciplina.

Ejemplos:
- «Si un canal pagado tiene un CAC > 2× la meta tras 30 días con gasto significativo, pausar».
- «Si la Variante 3 de incorporación no muestra una mejora estadísticamente significativa (o una mejora direccional con una señal cualitativa congruente) tras 4 semanas, pasar a la Variante 1».
- «Si el Flujo 4 del ciclo de vida tiene una tasa de apertura < 12 % tras 6 semanas, rehacer los asuntos y la segmentación de audiencia».

## Indicadores de resguardo

Algunas métricas llevan un resguardo duro (no pueden bajar de un umbral). Sirven para proteger la marca o la economía por cliente durante un crecimiento agresivo.

Ejemplos:
- «Una tasa de quejas por la voz de marca > 1 % de la retroalimentación de clientes dispara una revisión del contenido».
- «Un CAC pagado > X durante dos meses seguidos pausa el escalado pagado en espera de una auditoría».
- «Si la calificación de la tienda de apps baja de 4,5, dispara una revisión del producto».

## Mapeo de fuentes de datos

El plan debe nombrar de dónde sale cada métrica. Eso lo hace auditable.

| Métrica | Fuente |
|---|---|
| Tráfico orgánico | GA4 / herramienta de SEO |
| Conversión de la tienda de apps | App Store Connect |
| Conversión del embudo (día N → pago) | Analítica interna (Mixpanel / Amplitude) o exportación de cohortes de App Store Connect |
| Retención | Segmentos de la plataforma de correo + analítica de producto |
| Ingreso mensual / anual | Pagos o facturación (Stripe, caja, contabilidad) |
| Mezcla de planes | Pagos o facturación |
| Métricas del correo de ciclo de vida | Plataforma de correo |
| Atribución de embajadores | Dub.co u otro enlace con seguimiento |
| Activación del producto físico a la app | Tienda en línea + tienda de apps + un cruce interno |
| NPS | Herramienta de encuestas (plataforma de correo / Typeform / SurveyMonkey) |
| Alcance y compromiso de redes | `ver_analiticas` de la oficina si Contenido tiene Meta conectada |

## Cuando los datos no están conectados

Si una métrica no se puede medir hoy, márcalo en las decisiones abiertas de la Sección 13. Ejemplo:

> «La tasa de activación del producto físico a la app no es visible hoy en el tablero de la tienda de apps. Requiere un cruce entre la tienda en línea y App Store Connect. Tarea del T1».

Un plan con metas imposibles de medir es un plan que no se puede validar. Haz explícito el trabajo de instrumentación.

## Cadencia de reportes y automatización

Donde sea posible, genera la revisión de métricas de forma automática en lugar de armarla a mano cada vez. Los conectores de pagos, analítica y correo pueden traer la mayor parte de lo necesario. En la oficina, un informe semanal o mensual es una **rutina** que corre sola y deja el resumen para el dueño.

Para clientes del Nivel 1, un simple correo semanal de métricas al equipo (una tabla en Markdown) no cuesta nada y crea disciplina.

Para clientes del Nivel 2 en adelante, considera un tablero real (Hex, Metabase, Looker o una herramienta interna).
