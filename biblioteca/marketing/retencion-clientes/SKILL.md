---
name: retencion-clientes
titulo: Retención de clientes
description: Úsala cuando la empresa pierde clientes recurrentes o suscriptores: flujo de cancelación, ofertas para retener, pausas, cobros fallidos, señales de riesgo y puntaje de salud, o «la gente se nos va».
area: crecimiento-y-retencion
departments: [marketing, delivery, emails]
agents: [dlead, ona, cmail, newt]
origen: marketingskills/churn-prevention (MIT, Corey Haines)
palabras: [cancelación, bajas, churn, retener, retención, pagos fallidos, recuperar clientes]
---

# Retención de clientes (prevenir bajas)

Sirve para reducir las dos clases de bajas de clientes recurrentes: la **voluntaria** (el cliente decide irse) y la **involuntaria** (el cobro falla), con un flujo de cancelación bien diseñado, ofertas según el motivo, retención proactiva y recuperación de cobros.

Úsala cuando el dueño hable de bajas, cancelaciones, flujo de cancelación, oferta para retener, pausar la suscripción, cobros fallidos o rechazados, recuperar pagos, encuesta de salida, «la gente cancela», «la tasa de bajas es muy alta», «¿cómo retengo a los clientes?», «los clientes se van». Para la secuencia de correos de recuperación después de la baja usa `secuencias-correo`; para pantallas de mejora de plan dentro de la app, `pantallas-de-mejora`.

**Para cualquier negocio con clientes que vuelven a pagar.** Nació en software por suscripción, pero sirve igual para: un gimnasio o estudio de yoga con membresía, una agencia o consultora con iguala mensual, una caja de suscripción de productos, un plan de mantenimiento, un colegio o academia con mensualidades, una clínica con tratamientos de varias sesiones. Donde se dice «cancelar en la app», en un negocio presencial es «el cliente avisa en recepción o por WhatsApp que se da de baja»: el flujo (motivo → oferta → confirmación → después) se hace en esa conversación, con un guion.

## Antes de empezar

Lee las notas de la empresa en el Cerebro (`00-Empresa/perfil`, `00-Empresa/oferta`, `00-Empresa/clientes`, `00-Empresa/voz` y sobre todo `00-Empresa/marketing`) y las cifras de la empresa (precios, planes, descuentos permitidos). Si falta algo que necesitas, pregúntalo en una línea o déjalo marcado como supuesto; nunca lo inventes. Los descuentos que propongas deben caber en lo que el dueño permite: si no está en las cifras, pregúntalo.

Reúne este contexto (pregunta solo lo que falte):

1. **Situación de bajas:** tasa mensual de bajas (voluntaria e involuntaria si se sabe); clientes activos; ingreso mensual medio por cliente; ¿hay flujo de cancelación o la baja es inmediata?
2. **Cobro y plataforma:** ¿con qué se cobra? (Stripe, Chargebee, Paddle, Recurly, Braintree, un proveedor local como Mercado Pago, o transferencia/efectivo a mano); ¿mensual, anual o ambos?; ¿se puede pausar o bajar de plan?; ¿usan alguna herramienta de retención?
3. **Uso:** ¿se mide el uso por cliente (asistencias, sesiones, inicios de sesión, pedidos)?; ¿se detecta cuándo alguien deja de usar?; ¿hay datos de motivos de bajas anteriores?; ¿qué hacen los clientes que se quedan que no hacen los que se van?
4. **Límites:** ¿B2B o consumidor final? ¿La ley obliga a que cancelar sea fácil? ¿Qué tono usa la marca al despedir (empático, directo, cercano)?

Si la empresa tiene conectados su sistema de cobro o su CRM, léelos; si no, pide al dueño las cifras o una exportación.

## Cómo funciona

| Tipo | Causa | Solución |
|---|---|---|
| **Voluntaria** | El cliente decide irse | Flujo de cancelación, ofertas para retener, encuesta de salida |
| **Involuntaria** | Falla el cobro | Avisos de cobro, reintentos inteligentes, actualización automática de tarjetas |

La voluntaria suele ser la mayor parte de las bajas; la involuntaria suele ser una parte grande (a menudo entre un tercio y la mitad en suscripciones con tarjeta) y es la más fácil de arreglar.

Tres modos de trabajo:
1. **Armar un flujo de cancelación** desde cero: encuesta, ofertas y confirmación.
2. **Mejorar uno existente:** analizar los datos de bajas y subir el porcentaje de retenidos.
3. **Recuperar cobros fallidos:** reintentos y secuencia de avisos.

## Flujo de cancelación

```
Disparador → Encuesta → Oferta según el motivo → Confirmación → Después de la baja
```

1. **Disparador:** el cliente pulsa «Cancelar suscripción» (o avisa que se da de baja).
2. **Encuesta de salida:** por qué se va. Decide qué oferta mostrar.
3. **Oferta según el motivo:** descuento, pausa, bajar de plan, etc.
4. **Confirmación:** si igual quiere irse, confírmalo claro, diciendo hasta cuándo conserva el acceso.
5. **Después:** expectativas claras, camino fácil para volver, y arranca la secuencia de recuperación.

### Encuesta de salida

| Motivo | Qué dice |
|---|---|
| Muy caro | Sensible al precio; puede responder a un descuento o a bajar de plan |
| No lo uso lo suficiente | Poco uso; puede responder a una pausa o a ayuda para arrancar |
| Le falta algo que necesito | Hueco del producto o servicio; mostrar lo que viene o una alternativa |
| Me cambio a la competencia | Presión competitiva; entender qué le ofrecen |
| Problemas técnicos / fallas | Calidad; escalar a soporte |
| Es temporal / de temporada | Patrón de uso; ofrecer pausa |
| Cerré o cambió mi negocio | Inevitable; aprender y despedirse bien |
| Otro | Con campo de texto libre |

**Buenas prácticas:** 1 pregunta, una sola opción con texto libre opcional; 5–8 motivos como máximo; los más comunes primero (revisar cada trimestre); nada que suene a reproche; «Ayúdanos a mejorar» funciona mejor que «¿Por qué te vas?».

### Ofertas según el motivo

La clave: **la oferta debe corresponder al motivo.** Un descuento no retiene a quien no usa el servicio; mostrar lo que viene no retiene a quien no puede pagarlo.

| Motivo | Oferta principal | Oferta de respaldo |
|---|---|---|
| Muy caro | Descuento (20–30 % por 2–3 meses) | Bajar a un plan más barato |
| No lo uso | Pausa (1–3 meses) | Sesión gratis de acompañamiento |
| Le falta algo | Lo que viene y cuándo | Guía para resolverlo de otra forma |
| Se va a la competencia | Comparación + descuento | Llamada para escuchar su opinión |
| Problemas técnicos | Escalar a soporte de inmediato | Crédito + arreglo con prioridad |
| Temporal / de temporada | Pausar | Bajar de plan por un tiempo |
| Cerró el negocio | Sin oferta (respetar la situación) | — |

### Tipos de oferta

- **Descuento:** 20–30 % por 2–3 meses suele ser el punto justo; evita 50 % o más (enseña a cancelar para conseguir rebaja); con límite de tiempo («esta oferta vale mientras estés en esta página»); muestra cuánto ahorra en la moneda de la empresa, no solo el porcentaje.
- **Pausa:** máximo 1–3 meses (las pausas más largas rara vez vuelven); muchas pausas terminan en reactivación; reactivación automática con aviso previo; se conservan los datos y la configuración. En un gimnasio: congelar la membresía.
- **Bajar de plan:** un plan menor en vez de irse; mostrar qué conserva y qué pierde; presentarlo como «ajusta tu plan a lo que usas»; camino fácil para volver a subir.
- **Desbloquear o extender:** activar una función premium que no probó; extender la prueba de un plan superior. Funciona con «no le saco provecho».
- **Contacto personal:** para las cuentas de más valor (el 10–20 % superior por ingreso); llamada de atención al cliente; en empresas pequeñas, un mensaje personal del dueño.

### La pantalla

```
┌─────────────────────────────────────┐
│  Lamentamos que te vayas            │
│  ¿Cuál es el motivo principal?      │
│  ○ Es muy caro                      │
│  ○ No lo uso lo suficiente          │
│  ○ Le falta algo que necesito       │
│  ○ Me cambio a otra opción          │
│  ○ Problemas técnicos               │
│  ○ Es temporal / no lo necesito ya  │
│  ○ Otro: [____________]             │
│  [Continuar]                        │
│  [Mejor no, sigo con mi plan]       │
└─────────────────────────────────────┘
          ↓ (elige «Es muy caro»)
┌─────────────────────────────────────┐
│  ¿Y si te ayudamos?                 │
│  ┌───────────────────────────────┐  │
│  │ 25 % menos los próximos 3     │  │
│  │ meses · ahorras [monto]/mes   │  │
│  │ [Aceptar la oferta]           │  │
│  └───────────────────────────────┘  │
│  O cámbiate al [plan Básico] por    │
│  [precio]/mes →                     │
│  [No, gracias, quiero cancelar]     │
└─────────────────────────────────────┘
```

**Principios:** «seguir cancelando» siempre visible (sin trucos); una oferta principal + una de respaldo, no un muro de opciones; ahorro concreto en dinero; el nombre y los datos del cliente cuando se pueda; pensado para el teléfono (muchas bajas ocurren ahí).

Patrones por tipo de negocio, por periodo de cobro, la escalera de descuentos, la pausa, el después de la baja, segmentos y la lista de implementación: `referencias/flujos-de-cancelacion.md`.

## Predecir y retener antes

La mejor retención ocurre antes de que el cliente pulse «Cancelar».

| Señal | Riesgo | Cuánto antes |
|---|---|---|
| Uso o inicios de sesión bajan 50 %+ | Alto | 2–4 semanas antes |
| Deja de usar lo principal | Alto | 1–3 semanas |
| Muchas consultas a soporte y luego silencio | Alto | 1–2 semanas |
| Bajan las aperturas de correos | Medio | 2–6 semanas |
| Más visitas a la página de facturación | Alto | Días antes |
| Quita usuarios de su equipo | Alto | 1–2 semanas |
| Exporta sus datos | Crítico | Días antes |
| Su recomendación (NPS) baja de 6 | Medio | 1–3 meses |

En un negocio presencial las señales equivalentes son: deja de asistir, cancela citas, no responde mensajes, pide su historial o sus archivos, se queja.

**Puntaje de salud (0–100):**
```
Salud = uso o frecuencia × 0,30 + uso de lo principal × 0,25
      + tono en soporte × 0,15 + estado de cobro × 0,15 + interacción × 0,15
```

| Puntaje | Estado | Acción |
|---|---|---|
| 80–100 | Sano | Oportunidad de vender más |
| 60–79 | Requiere atención | Contacto proactivo |
| 40–59 | En riesgo | Campaña de intervención |
| 0–39 | Crítico | Contacto personal |

**Intervenciones proactivas:**

| Disparador | Intervención |
|---|---|
| Uso baja más de 50 % por 2 semanas | Mensaje «Vimos que no has usado [función]. ¿Te ayudamos?» |
| Se acerca al límite de su plan | Sugerencia de subir de plan (sin bloquear; eso es de `pantallas-de-mejora`) |
| 14 días sin entrar o sin venir | Mensaje de reenganche con las novedades |
| Detractor en NPS (0–6) | Seguimiento personal en 24 horas |
| Consulta sin resolver más de 48 h | Escalar + aviso proactivo del estado |
| Renovación anual en 30 días | Resumen del valor recibido + confirmación de la renovación |

En la oficina, revisar las señales puede ser una **rutina** (por ejemplo semanal, del jefe de Entregas `dlead`, que lee y propone a quién contactar) y los mensajes de intervención los deja `cmail` como borradores para el OK. Propónselo al dueño.

## Bajas involuntarias: recuperar cobros

```
Prevención → Reintento inteligente → Avisos de cobro → Periodo de gracia → Baja definitiva
```

**Prevención:** avisos de tarjeta por vencer (30, 15 y 7 días antes); pedir un segundo medio de pago; servicios de actualización automática de tarjetas de Visa y Mastercard (reducen los rechazos por tarjeta vencida o reemplazada); aviso 3–5 días antes del cargo en planes anuales.

**Reintentos según el tipo de rechazo:**

| Tipo | Ejemplos | Estrategia |
|---|---|---|
| Suave (temporal) | Fondos insuficientes, error del procesador | Reintentar 3–5 veces en 7–10 días |
| Duro (permanente) | Tarjeta robada, cuenta cerrada | No reintentar: pedir otra tarjeta |
| Requiere autenticación | 3D Secure, SCA | Enviar al cliente a autenticar |

Calendario: reintento 1 a las 24 h, 2 a los 3 días, 3 a los 5, 4 a los 7 (con aviso más urgente); después, baja con camino para reactivar. Consejo: reintentar el mismo día del mes en que antes funcionó el cobro (Stripe lo hace solo con «Smart Retries»).

**Secuencia de avisos:**

| Aviso | Cuándo | Tono | Contenido |
|---|---|---|---|
| 1 | Día 0 | Aviso amable | «Tu pago no pasó. Actualiza tu tarjeta.» |
| 2 | Día 3 | Recordatorio útil | «Recuerda actualizar tu pago para mantener el acceso.» |
| 3 | Día 7 | Urgencia | «Tu cuenta se pausará en 3 días.» |
| 4 | Día 10 | Último aviso | «Última oportunidad para mantener tu cuenta activa.» |

Enlace directo para actualizar el pago (sin pedir inicio de sesión si se puede); decir qué perdería; sin culpar («tu pago no pasó», no «no pagaste»); contacto de soporte; texto simple suele funcionar mejor que un correo diseñado. Si se cobra por transferencia o en efectivo, la «recuperación» es una secuencia de recordatorios de pago con los datos para pagar, por correo o WhatsApp (ver `sms-whatsapp`).

**Referencias de recuperación (orientativas):**

| Métrica | Baja | Media | Buena |
|---|---|---|---|
| Rechazos suaves recuperados | <40 % | 50–60 % | 70 %+ |
| Rechazos duros recuperados | <10 % | 20–30 % | 40 %+ |
| Recuperación total | <30 % | 40–50 % | 60 %+ |
| Fallos evitados con prevención | Nada | 10–15 % | 20–30 % |

Plantillas de los cuatro avisos, códigos de rechazo, periodo de gracia, configuración por proveedor, avisos dentro de la app y cálculo de retorno: `referencias/cobros-fallidos.md`.

## Métricas

| Métrica | Fórmula | Referencia orientativa |
|---|---|---|
| Tasa mensual de bajas | bajas / clientes al inicio del mes | <5 % consumidor, <2 % B2B |
| Bajas de ingreso (netas) | (ingreso perdido − ingreso por ampliaciones) / ingreso inicial | Negativa (expansión neta) |
| Retenidos en el flujo | retenidos / sesiones de cancelación | 25–35 % |
| Aceptación de ofertas | aceptadas / mostradas | 15–25 % |
| Reactivación tras pausa | reactivados / pausados | 60–80 % |
| Recuperación de cobros | recuperados / cobros fallidos | 50–60 % |
| Tiempo hasta la baja | días desde la primera señal hasta la baja | Seguir la tendencia |

**Por cohortes:** canal de adquisición (¿cuáles traen clientes que se quedan?), plan, antigüedad (¿a los 30, 60, 90 días?), motivo de baja (¿cuál crece?), tipo de oferta (¿cuál funciona en cada segmento?).

**Pruebas A/B del flujo** (una variable a la vez; diseño con `pruebas-ab`): descuento 20 % vs 30 % (retenidos, valor de vida); pausa de 1 vs 3 meses (reactivación); encuesta antes o después de la oferta; ventana emergente vs página completa; tono empático vs directo. Herramientas de análisis de producto como PostHog pueden dividir a los usuarios en flujos distintos y medir cada paso, si la empresa las tiene.

## Errores comunes

- **No tener flujo de cancelación:** la baja inmediata deja dinero sobre la mesa; aun una encuesta + una oferta retiene a una parte.
- **Esconder la cancelación:** genera resentimiento y malas reseñas; muchas leyes exigen que cancelar sea fácil.
- **La misma oferta para todos los motivos.**
- **Descuentos demasiado grandes:** enseñan a cancelar para volver con rebaja.
- **Ignorar las bajas involuntarias.**
- **No tener avisos de cobro:** dejar que los fallos cancelen cuentas en silencio.
- **Textos que culpan:** «¿Seguro que quieres abandonarnos?» daña la confianza.
- **No medir el valor de vida de los retenidos:** quien se va 30 días después no fue retenido.
- **Pausas demasiado largas:** pasados 3 meses rara vez vuelven.
- **Sin camino después de la baja:** facilita volver y arranca la recuperación.

## Cómo entregarlo

Según el pedido:
1. **Diagnóstico:** voluntaria vs involuntaria, qué falta, dónde está la mayor pérdida (con las cifras de la empresa o marcadas como supuesto).
2. **Flujo de cancelación:** cada pantalla (o el guion de la conversación en un negocio presencial) con su texto exacto, la encuesta, la tabla motivo → oferta principal → respaldo, la confirmación y el después.
3. **Retención proactiva:** señales, fórmula del puntaje de salud, niveles e intervenciones, y la rutina sugerida.
4. **Recuperación de cobros:** calendario de reintentos, los 4 avisos redactados, periodo de gracia y configuración en el proveedor de la empresa.
5. **Métricas** a seguir y pruebas sugeridas.
6. **Plan por fases** (fundamentos, optimización, avanzado) con lo que decide el dueño.

## Reglas

- La oferta corresponde al motivo; nunca una oferta igual para todos.
- Siempre un camino claro para terminar la baja; nada de trucos para impedirla. Cumple las leyes de protección al consumidor del país.
- No inventes cifras de la empresa ni descuentos que el dueño no autorizó; las referencias del sector son orientación.
- Los mensajes a clientes (avisos de cobro, intervenciones, recuperación) quedan como borradores: nada se envía, ni se cambia un plan, ni se aplica un descuento sin el OK del dueño.
- Los datos de uso y de pago son personales: trátalos según la ley de datos del país (y RGPD si aplica).

## Referencias

- `referencias/flujos-de-cancelacion.md` — flujos por tipo de negocio y por periodo de cobro, escalera de descuentos, pausa, bajar de plan, competencia, después de la baja, segmentos, lista de implementación y notas legales; léela al diseñar o mejorar el flujo.
- `referencias/cobros-fallidos.md` — calendario completo, prevención, códigos de rechazo, reintentos por proveedor, los 4 avisos redactados, periodo de gracia, avisos en la app y métricas; léela para cualquier trabajo de cobros fallidos.

## Habilidades relacionadas

- `secuencias-correo` — la secuencia de recuperación después de la baja.
- `pantallas-de-mejora` — momentos de mejora de plan y fin de prueba.
- `precios` — estructura de planes y descuento anual.
- `activacion-clientes` — la activación que evita las bajas tempranas.
- `medicion-analitica` — eventos para medir las señales de baja.
- `pruebas-ab` — probar variantes del flujo con rigor.
- `sms-whatsapp` — recordatorios de pago y reenganche por mensaje.
- `investigacion-clientes` — entrevistas a quienes se fueron.
