# Guía de cobros fallidos

Cómo recuperar pagos fallidos y reducir las bajas involuntarias. Los mensajes de abajo son plantillas: el agente los adapta a la voz de la empresa (`00-Empresa/voz`) y los deja como borradores para el OK del dueño.

---

## Por qué importa

- Los cobros fallidos explican una parte grande de las bajas en suscripciones con tarjeta (a menudo entre un tercio y la mitad).
- La mayoría se puede recuperar con la estrategia correcta.
- Una buena recuperación suele rescatar la mitad o más de los cobros fallidos.

---

## Calendario

```
Días −30 a −7: Prevención (evitar fallos)
Día 0:         Falla el cobro → reintento 1 + aviso 1
Días 1–3:      Reintento 2 + aviso 2
Días 3–5:      Reintento 3
Días 5–7:      Reintento 4 + aviso 3
Días 7–10:     Último reintento + aviso 4 (último aviso)
Días 10–14:    Termina el periodo de gracia → cuenta pausada o cancelada
Día 14+:       Empieza la recuperación
```

---

## Prevención: evitar el fallo

### Tarjetas por vencer

| Cuándo | Acción |
|---|---|
| 30 días antes | Correo: «Tu tarjeta terminada en 4242 vence el próximo mes» |
| 15 días antes | Correo: «Actualiza tu medio de pago para evitar interrupciones» |
| 7 días antes | Correo: «Tu tarjeta vence en 7 días: actualízala ahora» |
| 3 días antes | Aviso en la app: «Tu medio de pago vence pronto» |

**Plantilla — tarjeta por vencer:**
```
Asunto: Tu tarjeta terminada en 4242 vence pronto

Hola, [Nombre]:

La tarjeta registrada para tu suscripción a [Producto] vence el [fecha].

Actualiza tu medio de pago para que no haya interrupciones:

[Actualizar medio de pago →]

Toma menos de 30 segundos.

— El equipo de [Producto]
```

### Actualización automática de tarjetas

Las redes de tarjetas tienen programas que actualizan solas las tarjetas guardadas:

| Servicio | Red | Qué hace |
|---|---|---|
| Visa Account Updater (VAU) | Visa | Actualiza número y vencimiento guardados |
| Mastercard Automatic Billing Updater (ABU) | Mastercard | Lo mismo para Mastercard |
| Amex Cardrefresher | American Express | Lo mismo para Amex |

**Efecto:** reduce mucho los rechazos por tarjeta vencida o reemplazada.

**Cómo activarlo:**
- **Stripe:** automático, activo por defecto.
- **Chargebee:** desde la configuración de la pasarela.
- **Recurly:** incluido, activo por defecto.
- **Braintree:** pedirlo al procesador.
- **Otros proveedores (incluidos los locales):** consultar si lo ofrecen; no lo des por hecho.

### Segundo medio de pago

Pedir uno de respaldo:
- Al registrarse: «Agrega un medio de pago de respaldo» (pocos aceptan).
- Tras el primer cobro exitoso: «Protege tu cuenta con una tarjeta de respaldo» (mejor momento).
- Tras recuperar un cobro fallido: «Agrega un respaldo para evitar interrupciones» (el mejor: acaban de sentir el problema).

### Aviso antes del cargo

Para planes anuales o de alto valor:
- Correo 7 días antes de la renovación con el monto y la fecha.
- Enlace para actualizar el medio de pago.
- Qué incluye la renovación.
- Algunas leyes lo exigen para las renovaciones automáticas.

### Si se cobra por transferencia, efectivo o pago en tienda

No hay reintentos automáticos. La «prevención» es un recordatorio antes del vencimiento con los datos para pagar (monto, cuenta o referencia, fecha límite), y la «recuperación» es la misma secuencia de avisos de abajo, adaptada: «aún no vemos tu pago de [mes]» en vez de «tu tarjeta fue rechazada». Por WhatsApp, con `sms-whatsapp`.

---

## Reintentos inteligentes

### Tipos de rechazo

| Código (como lo llaman los procesadores) | Tipo | Significa | ¿Reintentar? |
|---|---|---|---|
| `insufficient_funds` | Suave | Saldo bajo temporal | Sí, en 2–3 días |
| `card_declined` (genérico) | Suave | Varios motivos temporales | Sí, 3–4 veces |
| `processing_error` | Suave | Problema de pasarela o red | Sí, en 24 h |
| `expired_card` | Duro | Tarjeta vencida | No: pedir otra |
| `stolen_card` | Duro | Tarjeta reportada robada | No: pedir otra |
| `do_not_honor` | Suave/duro | El banco la rechazó (ambiguo) | Una vez más; luego pedir otra |
| `authentication_required` | Autenticación | Hace falta SCA/3DS | Enviar al cliente a autenticar |

### Calendario por proveedor

**Stripe (Smart Retries, recomendado):**
- Activar «Smart Retries» en el panel → Facturación → Configuración.
- Stripe elige el mejor momento para reintentar con su modelo.
- Suele hacer 4–8 intentos en 3–4 semanas.
- Según Stripe, recupera más que un calendario fijo.

**Calendario manual (sin reintentos inteligentes):**

| Reintento | Cuándo | Mejor día/hora |
|---|---|---|
| 1 | Día 1 (24 h después) | En la mañana, el mismo día de la semana del cobro original |
| 2 | Día 3 | Probar otra hora del día |
| 3 | Día 5 | Después de una quincena típica (1 y 15) |
| 4 | Día 7 | Mañana del siguiente día hábil |
| 5 (último) | Día 10 | Último intento antes de que termine la gracia |

**Consejos de momento:**
- Reintentar el mismo día del mes en que el cobro funcionó.
- Reintentar después de los días de pago habituales (quincena y fin de mes en muchos países).
- Evitar fines de semana (menos aprobaciones).
- Las mañanas (8–10 h local) rinden algo mejor.

---

## Secuencia de avisos

### Aviso 1: el pago falló (día 0)

**Tono:** amable, sin alarma.
```
Asunto: Acción necesaria: tu pago no pasó

Hola, [Nombre]:

Intentamos cobrar en tu [tipo de tarjeta] terminada en [últimos 4]
tu suscripción a [Producto] ([monto]), pero no pasó.

Pasa a veces; casi siempre se arregla actualizando la tarjeta.

[Actualizar medio de pago →]

Tu acceso todavía no se ve afectado. Lo reintentaremos
automáticamente, pero actualizar la tarjeta es lo más rápido.

¿Necesitas ayuda? Responde este correo.

— El equipo de [Producto]
```

### Aviso 2: recordatorio (día 3)

**Tono:** útil, un poco más urgente.
```
Asunto: Recordatorio: actualiza tu pago de [Producto]

Hola, [Nombre]:

Te avisamos que todavía no pudimos procesar tu pago de [monto]
para [Producto].

[Actualizar medio de pago →]

Toma menos de 30 segundos. Tus [datos/proyectos/accesos del
equipo] están a salvo, pero necesitamos un medio de pago válido
para mantener tu cuenta activa.

¿Dudas? Responde aquí y te ayudamos.

— El equipo de [Producto]
```

### Aviso 3: urgencia (día 7)

**Tono:** directo, consecuencias claras.
```
Asunto: Tu cuenta de [Producto] se pausará en 3 días

Hola, [Nombre]:

Intentamos procesar tu pago varias veces, pero tu [tipo de
tarjeta] terminada en [últimos 4] sigue siendo rechazada.

Si no recibimos el pago antes del [fecha], tu cuenta se pausará
y perderás el acceso a:

• [Función o datos que usa]
• [Sus proyectos/espacio de trabajo]
• [Acceso del equipo para X personas]

[Actualizar medio de pago ahora →]

Tus datos no se borrarán: puedes reactivar cuando quieras
actualizando tu medio de pago.

— El equipo de [Producto]
```

### Aviso 4: último aviso (día 10)

**Tono:** final, claro, sin culpa.
```
Asunto: Última oportunidad para mantener activa tu cuenta de [Producto]

Hola, [Nombre]:

Este es nuestro último recordatorio. Tu pago de [monto] está
vencido y tu cuenta se pausará mañana ([fecha]).

[Actualizar medio de pago →]

Después de la pausa:
• Tus datos se guardan [90 días]
• Puedes reactivar cuando quieras
• Solo actualiza tu tarjeta para recuperar el acceso

Si querías cancelar, no tienes que hacer nada: tu cuenta se
pausará sola.

— El equipo de [Producto]
```

---

## Periodo de gracia

| Ajuste | Recomendación |
|---|---|
| Duración | 7–14 días después del último reintento |
| Acceso | Reducido (solo lectura) o completo |
| Visibilidad | Aviso en la app: «Pago vencido: actualízalo para seguir» |
| Reintentos | Siguen en segundo plano |
| Comunicación | Siguen los avisos |

### Opciones de acceso

**A: acceso completo durante la gracia (recomendado en B2B).** Menos fricción, el cliente se siente respetado; más recuperación (sigue viendo el valor); riesgo: algunos abusan de la gracia.

**B: solo lectura (recomendado para consumidor final).** Puede ver pero no crear ni editar; da urgencia sin miedo a perder datos; mensaje claro: «Actualiza tu pago para volver a usarlo completo».

**C: bloqueo inmediato (no recomendado).** Agresivo, daña la relación, recupera menos; solo para planes muy baratos.

### Después de la gracia

| Cuándo | Acción |
|---|---|
| Termina la gracia | Pausar la cuenta (no borrarla) |
| Día 1 de pausa | Correo «Tu cuenta está pausada» |
| Día 7 | Recordatorio «Tus datos siguen aquí» |
| Día 30 | Intento de recuperación con una oferta nueva |
| Día 60 | Último intento de recuperación |
| Día 90 | Aviso de borrado de datos (si aplica) |

---

## Configuración por proveedor

Úsala solo si la empresa usa ese proveedor; el agente no la configura, deja los pasos para quien administre el cobro.

### Stripe

**Activar Smart Retries:**
1. Panel → Configuración → Facturación → Suscripciones y correos.
2. Activar «Smart Retries» en las reglas de reintento.
3. Configurar los correos de pago fallido en Configuración → Correos.

**Reglas propias (sin Smart Retries):**
```
Reintento 1: 3 días después del fallo
Reintento 2: 5 días después
Reintento 3: 7 días después
Final:       marcar la suscripción como impaga tras el último
```

**Eventos (webhooks) a atender:**
- `invoice.payment_failed` — arranca los avisos.
- `invoice.paid` — detiene los avisos, devuelve el acceso.
- `customer.subscription.updated` — cambios de estado.
- `customer.subscription.deleted` — baja definitiva.

### Chargebee

1. Configuración → Retry Settings: intentos e intervalos.
2. Configuración → Email Notifications → Dunning: plantillas.
Opciones: reintentos automáticos configurables, plantillas de aviso propias, periodo de gracia por plan.

### Paddle

Paddle maneja los reintentos y avisos por su cuenta; se personaliza poco (Paddle lleva la relación). Webhooks: `subscription.payment_failed`, `subscription.cancelled`. Para quien quiere no ocuparse.

### Recurly

1. Configuración → Dunning Management.
2. Calendario de reintentos por plan.
3. Periodo de gracia y acción final (pausar o cancelar).
Extras: reintentos optimizados con aprendizaje automático, calendarios por plan, actualización de tarjetas incluida.

### Otros (Mercado Pago, pasarelas locales, cobro manual)

Revisa en su documentación qué reintentos y avisos ofrecen. Si no hay, la secuencia de avisos la manda la empresa (con el OK del dueño) y los reintentos se reemplazan por recordatorios con el enlace de pago.

---

## Avisos dentro de la app

No te fíes solo del correo.

### Franja
```
┌──────────────────────────────────────────────────────┐
│ ⚠ Tu pago de [monto] falló. Actualiza tu tarjeta     │
│ para no perder el acceso. [Actualizar →] [Cerrar]    │
└──────────────────────────────────────────────────────┘
```
- En cada carga de página durante el periodo de avisos.
- Se puede cerrar (pero vuelve en la siguiente sesión).
- Enlace directo para actualizar (los menos clics posibles).
- No bloquea el producto.

### Ventana (para el último aviso)
```
┌─────────────────────────────────────┐
│  Tu cuenta se pausará el [fecha]    │
│                                     │
│  Actualiza tu medio de pago para    │
│  mantener el acceso a tus [X]       │
│  proyectos y [Y] compañeros.        │
│                                     │
│  [Actualizar medio de pago]         │
│  [Recordármelo después]             │
└─────────────────────────────────────┘
```

---

## Medir la recuperación

| Métrica | Cálculo | Referencia orientativa |
|---|---|---|
| Recuperación | cobros recuperados / fallidos | 50–60 % |
| Recuperación por tipo | recuperados / fallidos de cada tipo | Suaves 70 %+, duros 40 %+ |
| Tiempo hasta recuperar | días del fallo al cobro exitoso | <5 días |
| Fallos evitados | fallos evitados / fallos esperados | 20–30 % |
| Apertura de los avisos | aperturas / enviados | 60 %+ |
| Clics en los avisos | clics / aperturas | 30 %+ |
| Ingreso recuperado al mes | suma de lo recuperado | Seguir la tendencia |
| Ingreso perdido por bajas involuntarias | suma de lo fallido y no recuperado | Seguir la tendencia |

### Por etapa de la empresa (orientativo, del original, en ingreso anual recurrente)

| Etapa | Bajas involuntarias típicas | Meta tras optimizar |
|---|---|---|
| Inicial (< 1 M al año) | 3–5 % del ingreso mensual | 1–2 % |
| Crecimiento (1–10 M) | 2–4 % | 0,5–1,5 % |
| Escala (10 M+) | 1–3 % | 0,3–0,8 % |

### Cálculo del retorno (ejemplo con números redondos)

```
Ingreso mensual en cobros fallidos:   10.000
Recuperación actual:                   30 % (3.000)
Recuperación meta:                     60 % (6.000)
Mejora mensual:                        3.000
Mejora anual:                          36.000
Costo de herramientas:                 ~200–500 al mes
Retorno:                               6–15 veces
```

Con las cifras reales de la empresa, este cálculo es lo primero que conviene mostrarle al dueño.
