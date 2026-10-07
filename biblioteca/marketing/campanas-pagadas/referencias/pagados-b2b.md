# Manual de anuncios pagados para B2B

Reglas de operación entre plataformas para la adquisición pagada B2B: donde los ciclos de venta duran de 2 a 24 meses, las conversiones dentro de la plataforma engañan y la *calidad* de los contactos importa más que su costo. Úsalo junto con los manuales por plataforma (`meta-sistema-de-decisiones.md`, `linkedin-b2b.md`, `google-busqueda.md`, `abm-cuentas-objetivo.md`). Aplica a cualquier empresa que venda a otras empresas o con ciclos largos de decisión: una constructora, una consultora, una agencia, un proveedor industrial, un SaaS.

## Contenido

- El ciclo de vida de la demanda (5 etapas, más allá del embudo)
- Presupuesto por etapa
- Señales adelantadas frente a señales rezagadas
- Economía unitaria: CPL y CPC de equilibrio
- Reglas de corte
- La trampa de optimizar para calidad (y el ciclo de conversiones fuera de línea)
- Puntaje de calidad de contactos (Urgencia / Presupuesto / Encaje)
- El cuadrante de escalamiento
- Revisión de madurez de medición
- Selección de canales

## El ciclo de vida de la demanda (5 etapas, más allá del embudo)

El embudo (parte alta / media / baja) termina en la conversión. Los ingresos B2B no: los tratos perdidos, el pipeline abierto y los clientes actuales se pueden alcanzar con anuncios. Planea a lo largo de cinco etapas:

| Etapa | Resultado | Conciencia del comprador | Ofertas típicas | KPI |
|-------|---------|-----------------|----------------|------|
| **Crear** | Construir afinidad y confianza | No sabe / Conoce el problema | Contenido educativo, punto de vista | Costo por consumo, costo combinado por oportunidad |
| **Captar** | Convertir compradores que ya buscan | Conoce la solución / el producto | Demos, pruebas | Pipeline por gasto, costo directo por oportunidad |
| **Acelerar** (venta asistida) / **Activar** (guiada por el producto) | Cerrar tratos abiertos más rápido / convertir usuarios gratis | Conoce el producto / la oferta | Casos de éxito, seminarios web, eventos | Velocidad del pipeline, altas de pago |
| **Revivir** | Reabrir los perdidos | Conoce la oferta | Demos con incentivo, pruebas guiadas | Oportunidades calificadas creadas, costo por oportunidad |
| **Expandir** | Hacer crecer cuentas actuales | La más informada | Programas de referidos, contenido de funciones nuevas | Ingreso por expansión, oportunidades influenciadas |

**Construye de abajo hacia arriba para el retorno más rápido**: Expandir → Revivir → Acelerar/Activar → Captar → Crear. Las etapas de abajo son baratas, de audiencia pequeña y se recuperan rápido; Crear es la inversión más grande y lenta. La mayoría de los equipos construye de arriba hacia abajo y quema meses esperando el retorno.

## Presupuesto por etapa

| Etapa | Tamaño del presupuesto | Tiempo al retorno | Dificultad |
|-------|------------|-------------|------------|
| Crear | Alto | 90+ días | Alta (pide buen contenido y punto de vista) |
| Captar | Moderado | <45 días | Alta (caro y competido) |
| Acelerar/Activar | Bajo | Sigue el ciclo de venta | Baja |
| Revivir | Bajo | <45 días | Baja |
| Expandir | Bajo | <60 días | Media (audiencias pequeñas) |

Pondera según el movimiento: lo guiado por el producto inclina el presupuesto hacia Crear + Captar; la venta asistida con un mercado pequeño, hacia Crear + Acelerar. La etapa con más *pipeline* no es automáticamente la que merece más *presupuesto*: financia donde la parte del pipeline supera la parte del presupuesto y la audiencia está poco penetrada.

## Señales adelantadas frente a señales rezagadas

No puedes optimizar sobre ventas cerradas cuando los tratos cierran en 6 meses. Divide las métricas de cada etapa:

- **Adelantadas** (se mueven en <1 mes: optimiza sobre estas): CTR, interacción, CPL, costo por contacto calificado, cuentas alcanzadas
- **Rezagadas** (se mueven en >1 mes: la verdad, se revisan cada mes o trimestre): pipeline por gasto, ingreso influenciado, tiempo hasta cerrar, ingreso por expansión

La métrica adelantada debe correlacionar demostrablemente con la rezagada: un indicador sustituto que vale la pena optimizar es medible, movible, no es un promedio y es difícil de manipular. Si el CPL baja y el pipeline no se mueve, el indicador se rompió; arregla el indicador, no los anuncios.

## Economía unitaria: CPL y CPC de equilibrio

Deriva las metas de la matemática de los tratos, no de benchmarks de la plataforma:

- **CPL de equilibrio** = valor promedio del trato × tasa de contacto-a-cierre. (Contrato de $3.000 × 10 % de cierre = CPL de $300.)
- **CPC de equilibrio** = CPL objetivo × tasa de conversión de la página de destino. (CPL de $300 × 5 % de conversión de la página = CPC de $15.)

Fija la meta real por debajo del equilibrio según el margen que necesites. Cada regla de corte y cada decisión de escalamiento depende de este número. (Los valores del trato, las tasas de cierre y los márgenes salen de las cifras de la empresa o de su CRM; si no están, pregúntalos o márcalos como supuesto.)

## Reglas de corte

Dos reglas duras que quitan la emoción de las decisiones de pausar:

- **Regla del que no rinde** (anuncios nuevos, en cualquier momento): pausa cuando un anuncio gastó **2–3 veces el CPL objetivo con cero conversiones**. CPL objetivo $300 → se corta a los $600–900 gastados sin conversiones.
- **Regla de mantenimiento** (anuncios con más de ~7–14 días): pausa cuando el CPL de un anuncio está **1,5–2 veces por encima de la meta**. Meta $300 → se corta con un CPL de $450–600.

Estas reglas no son estadísticamente rigurosas: son repetibles, baratas de aplicar y mejores que decidir por estado de ánimo. Nunca pauses a uno que produce sin tener un reemplazo preparado (ver las reglas de relevo en `meta-sistema-de-decisiones.md`). **Atención:** son reglas de partida para este caso B2B con tratos grandes; en una cuenta real, antes de pausar nada revisa el tamaño de muestra y el retraso de conversión (ver `auditoria-y-criterio.md`, «Seguridad al recomendar»). Y pausar lo aplica el dueño.

## La trampa de optimizar para calidad (y el ciclo de conversiones fuera de línea)

La puja inteligente optimiza hacia lo que llames «conversión». Si le das formularios llenados crudos, te comprará formularios basura baratos: el CPL mejora mientras el pipeline muere. La solución, en orden:

1. **Cierra el ciclo de conversiones fuera de línea.** Devuelve los cambios de etapa del CRM (contacto → oportunidad calificada → oportunidad → cerrado-ganado) a las plataformas de anuncios: GCLID + importación fuera de línea en Google, eventos de ciclo de vida de CAPI en Meta, API de conversiones en LinkedIn. Es la jugada de mayor impacto en una cuenta B2B: el algoritmo empieza a comprar pipeline en lugar de formularios llenados. (Esto lo implementa quien administre el CRM y las cuentas; tú entregas qué etapas enviar y el esquema.)
2. **Valora las conversiones de forma distinta.** Una solicitud de demo no es la descarga de un ebook.
3. **Mientras no fluyan los datos fuera de línea, que una persona lea la calidad de los contactos cada semana**: cargos y empresas, no solo el CPL.

Concilia cada mes las conversiones que informa la plataforma con el CRM. Cuando discrepan, **gana el CRM**.

## Puntaje de calidad de contactos (Urgencia / Presupuesto / Encaje)

La plataforma no ve la calidad de un contacto: puntúala tú y ordena los anuncios con ella:

- **Urgencia** (0–3): 0 solo mirando → 3 necesidad urgente con fecha
- **Presupuesto** (0–3): 0 ninguno o sin autoridad → 3 aprobado y listo
- **Encaje** (0–3): 0 fuera del cliente ideal → 3 cliente ideal perfecto

Quien haga las llamadas de venta puntúa cada contacto (máximo 9) y lo anota contra el anuncio de origen. Tras ~20 llamadas puntuadas, **ordena los anuncios por puntaje promedio de calidad, no por CPL ni CTR**: el anuncio con mejor CPL es con frecuencia el que produce contactos de 3/9. Escala los de puntaje alto; corta las variantes cuyo promedio caiga por debajo de ~5.

## El cuadrante de escalamiento

Dirige las tácticas de escalamiento según tu restricción real:

| | Poco esfuerzo | Mucho esfuerzo |
|---|---|---|
| **Presupuesto alto** | **Audiencias**: audiencias más grandes, más segmentos, más frecuencia | **Geografía**: países o regiones nuevos (requiere localizar) |
| **Presupuesto bajo** | **Anuncios**: creatividad, ángulos y formatos nuevos | **Objetivos y pujas**: cambiar de objetivo o estrategia de puja para comprar más barato |

- ¿Hay presupuesto pero no tiempo? Trabaja la fila de arriba (audiencias, luego geografía).
- ¿Necesitas escala pero el presupuesto está topado? Trabaja la fila de abajo (mejor creatividad y puja más barata liberan dinero).

## Revisión de madurez de medición

Antes de escalar el gasto, puntúate de 1 a 3 en cada uno: tablero combinado de pipeline; tablero por canal; seguimiento de conversiones (1 = ninguno, 2 = solo píxel, 3 = conversiones fuera de línea fluyendo); analítica web; un proceso de atribución documentado y acordado. Por debajo de ~6/15, arregla la visibilidad antes de añadir presupuesto: vuelas a ciegas y toda optimización es una adivinanza. Arregla primero el puntaje más bajo.

## Selección de canales

Cinco familias de canales: redes sociales pagadas, búsqueda pagada, **listados de reseñas pagados** (G2, Capterra, Software Advice u otros directorios del sector: a menudo se saltan y tienen intención alta), programática (display, audio, TV conectada, nativa) y patrocinios (boletines, pódcast, eventos, creadores). Evalúa en cuatro ejes: ¿puedes segmentar de verdad a tu cliente ideal?; costo de los medios (CPC/CPM); alcance con tu segmentación; política de la plataforma para tu industria.

Antes de comprometerte con un canal nuevo, **corre una campaña de prueba de ~US$100** (o su equivalente) para conocer su CPC/CPM real con tu segmentación: las estimaciones de las plataformas y los benchmarks publicados fallan de forma consistente para clientes ideales específicos. (Gastar esa prueba lo aprueba el dueño.)

---

*Linaje del marco: varias reglas de operación de este archivo están adaptadas (reexpresadas, reestructuradas y ampliadas) de manuales de profesionales, en especial ads-skills de Ivan Falco. Los benchmarks y umbrales son puntos de partida reportados por profesionales: recalíbralos siempre con los primeros 30 días de tu propia cuenta.*
