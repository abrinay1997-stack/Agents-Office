# Patrones de flujo de cancelación

Patrones detallados por tipo de negocio, periodo de cobro y sector. Los precios y umbrales son ejemplos: los reales salen de las cifras de la empresa.

---

## Por tipo de negocio

### Consumidor final / software que se contrata solo

Mucho volumen, poco contacto. El flujo funciona sin personas.

```
Botón cancelar → Encuesta (1 pregunta) → Oferta según motivo → Confirmar → Después
```

- Totalmente automático.
- Rápido: 2–3 pantallas como máximo.
- Una oferta + una de respaldo, no un menú.
- Pensado para el teléfono.
- «Seguir cancelando» claro en cada paso.

**Retenidos habituales:** 20–30 % (orientativo).

**Ejemplo para una app de productividad de 29 al mes:**
1. «¿Cuál es el motivo principal?» → 6 opciones.
2. Elige «Muy caro» → «25 % menos por 3 meses (ahorras 21,75)».
3. Rechaza → «O cámbiate al plan Inicial por 12 al mes».
4. Rechaza → «Lamentamos que te vayas. Tu acceso sigue hasta [fecha]».

---

### B2B / planes de equipo

Menos volumen, más en juego. El contacto personal vale lo que cuesta.

```
Botón cancelar → Encuesta → Oferta (o pasar a atención) → Confirmar → Después
```

- Las cuentas por encima de cierto ingreso pasan a atención al cliente.
- Mostrar el efecto en el equipo («tus 8 compañeros perderán el acceso»).
- Llamada entre administradores para cuentas grandes.
- Más tiempo para decidir: «agendar una llamada» como opción.
- Solo el administrador o dueño de la cuenta puede cancelar.

**Retenidos habituales:** 30–45 % (más alto por el trato personal; orientativo).

**Ruta según el ingreso mensual de la cuenta** (el original usa dólares; fija los tramos con el dueño):

| Ingreso mensual de la cuenta | Flujo |
|---|---|
| Tramo bajo (<100) | Automático con ofertas |
| 100–500 | Automático + aviso a atención para seguimiento |
| 500–2.000 | Pasa a atención antes de completar la baja |
| 2.000+ | Sin baja por autoservicio: llamada con atención (ojo: revisa que la ley del país lo permita; si la contratación fue en línea, la baja suele tener que poder hacerse en línea) |

---

### Gratis + de pago (freemium)

Quien cancela el plan de pago para volver al gratis no se va: baja de nivel. Otra psicología.

```
Botón cancelar → «¿Pasar al plan gratis?» → Encuesta (si sigue) → Oferta → Confirmar
```

- Primero el plan gratis (antes que cualquier oferta).
- Mostrar qué conserva gratis y qué pierde.
- La «retención» es que se quede en el gratis, no perderlo del todo.
- Seguir a los usuarios gratis para campañas de volver a subir.

---

### Negocios presenciales y de servicios (adaptación)

**Gimnasio, estudio, academia (membresía):** la baja llega en recepción, por WhatsApp o por correo. El «flujo» es un guion para quien atiende: preguntar el motivo con amabilidad → ofrecer lo que corresponde (congelar la membresía 1–3 meses, cambiar a un plan de menos días, una sesión con un entrenador para retomar) → si insiste, confirmar por escrito hasta cuándo vale y cómo volver.

**Agencia o consultora (iguala mensual):** la baja suele anunciarse en una reunión o un correo del cliente. Antes de aceptarla: reunión para entender el motivo, propuesta de ajuste de alcance (bajar de plan), pausa por un periodo, o cierre ordenado con entrega de todo el material. El jefe de Entregas prepara el borrador de la propuesta para el OK del dueño.

**Caja de suscripción o plan de reposición:** «saltar el próximo envío» es la pausa natural; cambiar la frecuencia (cada 2 meses en vez de cada mes) es el «bajar de plan».

---

## Por periodo de cobro

### Mensual

- Más sensibles al precio, menos compromiso.
- Los descuentos funcionan (20–30 % por 2–3 meses).
- La pausa funciona (1–2 meses).
- Sugerir el plan anual con descuento como alternativa.

**Prioridad de ofertas:**
1. Descuento (si el motivo es el precio).
2. Pausa (si no lo usa o es temporal).
3. Pasar a anual (si lo usa pero le pesa el precio).

### Anual

- Más compromiso; suelen cancelar por motivos más fuertes.
- Importan las expectativas de reembolso proporcional.
- Ventana más larga para retener (ya pagaron).
- El contacto personal se justifica más (más valor de vida en juego).

**Prioridad de ofertas:**
1. Pausar el resto del periodo (si es temporal).
2. Ajustar el plan + crédito para la próxima renovación.
3. Contacto personal de atención.
4. Reembolso parcial + bajar de plan (mejor que reembolso total + baja).

**Reembolsos:**
- Ofrecer reembolso proporcional si queda mucho tiempo.
- «Pausar hasta la renovación» si quedan menos de 3 meses.
- Ser generosos: una mala experiencia de reembolso crea detractores ruidosos.
- Cumplir lo que diga la ley del consumidor del país sobre reembolsos.

---

## Patrones de oferta

### La escalera de descuentos

No empieces por el descuento más grande. Escala:

```
Clic en cancelar → 15 % menos → sigue cancelando → 25 % menos → sigue → déjalo ir
```

- Máximo 2 ofertas de descuento por sesión de cancelación.
- Nunca más de 30 % (más alto enseña a cancelar por rebaja).
- Descuentos con plazo (2–3 meses, luego vuelve el precio normal).
- Lleva registro de quién aceptó: si vuelve a cancelar a precio normal, no repitas la oferta.

### La pausa

A menudo es mejor que un descuento porque no le quita valor al producto.

| Ajuste | Recomendación |
|---|---|
| Opciones de duración | 1, 2 o 3 meses |
| Por defecto | 1 mes (la más corta) |
| Máximo | 3 meses (las más largas rara vez vuelven) |
| Durante la pausa | Se conservan los datos, se quita el acceso |
| Reactivación | Automática, con aviso 7 días antes |
| Pausas repetidas | 1 cada 12 meses |

**Secuencia de reactivación:**
- Día −7: «Tu pausa termina en 7 días. Mira lo nuevo que hicimos.»
- Día −1: «¡Mañana vuelves! Esto te espera.»
- Día 0: «¡Volviste! Un recorrido rápido por lo nuevo.»

### Bajar de plan

En productos con varios planes, es la retención más fuerte:

```
┌─────────────────────────────────────────┐
│  Antes de irte, ¿ajustamos tu plan?     │
│  Actual: Pro ([precio]/mes)             │
│  ┌─────────────────────────────────┐    │
│  │ Cámbiate a Inicial ([precio]/mes)│   │
│  │ ✓ Conservas: proyectos,          │   │
│  │   integraciones                  │   │
│  │ ✗ Pierdes: analítica avanzada,   │   │
│  │   funciones de equipo            │   │
│  │ [Cambiar a Inicial]              │   │
│  └─────────────────────────────────┘    │
│  [No, gracias, quiero cancelar]         │
└─────────────────────────────────────────┘
```

- Mostrar exactamente qué conserva y qué pierde.
- Marcas ✓ y ✗ para leer rápido.
- Conservar sus datos aun en el plan menor.
- Si baja de plan, no mostrarle sugerencias de subir durante al menos 30 días.

### Cuando se va a la competencia

1. **Preguntar a cuál** (opcional, sin obligar).
2. **Mostrar una comparación** si la hay (ver `paginas-comparativas`).
3. **Ofrecer un crédito de cambio** («igualamos su precio por 3 meses»), si el dueño lo autoriza.
4. **Pedir una llamada para escuchar** («15 minutos para entender qué nos falta»).

Estos datos valen oro para producto y marketing: guárdalos para `perfil-competidores` e `investigacion-clientes`.

---

## Después de la baja

Lo que pasa después importa para: volver a ganarlo, el boca a boca y el tono de las reseñas.

### Página de confirmación

```
Tu suscripción fue cancelada.

Qué sigue:
• Tu acceso continúa hasta [fin del periodo pagado]
• Tus datos se conservan [90 días]
• Puedes reactivarla cuando quieras desde tu cuenta

[Reactivar mi cuenta]

Nos encantaría tenerte de vuelta. Seguiremos mejorando con lo
que nos dicen clientes como tú.
```

### Secuencia después de la baja

| Cuándo | Acción |
|---|---|
| De inmediato | Correo de confirmación con la fecha de fin del acceso |
| Día 1 | (Nada: no parecer desesperados) |
| Día 7 | Encuesta de satisfacción sobre la experiencia completa |
| Día 30 | «Lo nuevo» con las mejoras recientes |
| Día 60 | Responder a su motivo concreto, si ya se resolvió |
| Día 90 | Último intento de recuperación con una oferta especial |

Los correos de esta secuencia los redacta `secuencias-correo`; quedan como borradores para el OK del dueño.

---

## Segmentación

Los mejores flujos muestran ofertas distintas a clientes distintos.

| Dimensión | Por qué importa |
|---|---|
| Plan / ingreso | Los de más valor reciben contacto personal |
| Antigüedad | Los clientes de años reciben ofertas más generosas |
| Nivel de uso | Quien usa mucho necesita otro mensaje que quien está dormido |
| Periodo de cobro | Mensual y anual piden enfoques distintos |
| Retenciones previas | No repetir el mismo descuento a quien ya canceló antes |
| Motivo | Decide qué oferta mostrar (la correspondencia básica) |

### Flujos por segmento

**Cliente nuevo (< 30 días):** no se activó. La retención es acompañarlo, no descontar. Oferta: llamada de arranque gratis, ayuda para configurar, prueba extendida. Pregunta: «¿Qué esperabas lograr?» (aprende qué falta).

**Cliente activo que se va por precio:** le gusta, pero no justifica el costo. Oferta: descuento, plan anual, bajar de plan. Mucho potencial de retención.

**Cliente dormido (30+ días sin entrar o sin venir):** se olvidó. Un descuento no lo trae. Oferta: pausa, conversación de «¿qué cambió?». Poco potencial: enfócate en aprender.

**Usuario intensivo que se va a la competencia:** elige otra cosa activamente. Oferta: igualar, llamada para escuchar, lo que viene. Potencial medio: depende del motivo.

---

## Lista de implementación

### Fase 1: fundamentos (semana 1)
- [ ] Flujo de cancelación (encuesta + 1 oferta + confirmación)
- [ ] Encuesta de salida con 5–7 motivos
- [ ] Una oferta por motivo (correspondencia 1 a 1)
- [ ] Registrar motivos y tasa de retenidos
- [ ] Avisos de tarjeta por vencer

### Fase 2: optimización (semanas 2–4)
- [ ] Ofertas de respaldo (principal + secundaria por motivo)
- [ ] Opción de pausa
- [ ] Secuencia de avisos de cobro (4 mensajes en 10 días)
- [ ] Reintentos inteligentes (Stripe Smart Retries o equivalente)
- [ ] Ruta según ingreso para cuentas de alto valor

### Fase 3: avanzado (mes 2 en adelante)
- [ ] Puntaje de salud a partir de señales de uso
- [ ] Disparadores de intervención proactiva
- [ ] Pruebas A/B de montos de descuento y tipos de oferta
- [ ] Flujos por plan, antigüedad y uso
- [ ] Secuencia de recuperación después de la baja (con `secuencias-correo`)
- [ ] Análisis por cohortes: bajas por canal, plan y antigüedad

---

## Notas legales

Revisa siempre las leyes de protección al consumidor y de datos del país donde vende la empresa. Ejemplos:

### Estados Unidos: regla «Click-to-Cancel» de la FTC
- Cancelar debe ser tan fácil como contratar.
- No se puede exigir una llamada para cancelar si la contratación fue en línea.
- No se pueden añadir pasos excesivos para desanimar.
- Las ofertas de retención se permiten, pero «seguir cancelando» debe ser claro.
(La regla federal fue anulada por un tribunal en 2025; varias leyes estatales exigen algo parecido. Verifica la situación vigente si la empresa vende allí.)

### Unión Europea: RGPD y conservación de datos
- Informar cuánto tiempo se conservan los datos después de la baja.
- Ofrecer exportar los datos antes de borrar la cuenta.
- Atender las solicitudes de borrado en 30 días.
- No usar los datos posteriores a la baja para marketing sin consentimiento.

### En cualquier país
- Muchas leyes latinoamericanas de protección al consumidor y de datos personales piden algo parecido: medios de baja sencillos, información clara y respeto de los datos.
- Siempre un camino claro para completar la baja.
- Nunca esconder el botón de cancelar (patrón engañoso).
- Procesar la baja aunque el flujo de retención falle.
- Confirmar la baja con un comprobante por correo.
