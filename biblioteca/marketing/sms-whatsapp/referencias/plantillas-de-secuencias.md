# Plantillas de secuencias de mensajes

Plantillas completas con conteo de caracteres, tiempos y lógica de segmentación para cada flujo importante de SMS. Sirven también para WhatsApp (ver su referencia para el formato de plantilla aprobada y los botones).

> Los conteos asumen codificación GSM-7. Los emojis fuerzan UCS-2 (70 caracteres por segmento en lugar de 160), y en español las vocales «á», «í», «ó» y «ú» suelen hacer lo mismo: **previsualiza el conteo de segmentos en la plataforma** y ajusta. Todas las plantillas usan `[Marca]`, `[Nombre]` y `[enlace.corto]` como marcadores. Los descuentos y códigos son de ejemplo: los reales salen de las cifras de la empresa. Los conteos son aproximados.

---

## Bienvenida / confirmación del alta

### Envío 1 — Inmediato (tras el alta)

```
De [Marca]: ¡Bienvenido! Tu código de 10 % de descuento: BIENVENIDO10. Compra ya: [enlace.corto]
Responde STOP para darte de baja, HELP para ayuda. Pueden aplicar tarifas.
```
~155 caracteres / 1 segmento (justo). El pie es obligatorio en el primer envío.

### Envío 2 — 24 horas después (opcional)

```
De [Marca]: No olvides tu código BIENVENIDO10: vence en 48 h. Lo más pedido: [enlace.corto]
```
~108 caracteres / 1 segmento.

### Envío 3 — 7 días después (opcional, solo si no compró)

```
De [Marca]: Última oportunidad de 10 % con BIENVENIDO10. Vence hoy a medianoche: [enlace.corto]
```
~107 caracteres / 1 segmento.

---

## Carrito abandonado (el flujo de mayor retorno en tiendas en línea)

### Envío 1 — 30 minutos después del abandono

```
De [Marca]: Hola [Nombre], ¡dejaste algo pendiente! Tu carrito sigue aquí: [enlace.corto]
```
~95 caracteres / 1 segmento.

### Envío 2 — 4 horas después (si no compró)

```
De [Marca]: Lo de tu carrito se está agotando. Te lo guardamos 24 h: [enlace.corto]
```
~98 caracteres / 1 segmento.

### Envío 3 — 24 horas después (si no compró; aquí sí cabe un descuento)

```
De [Marca]: ¿Lo sigues pensando? Aquí tienes 10 % para decidir: AHORRA10. Compra: [enlace.corto]
```
~99 caracteres / 1 segmento.

**Notas**:
- Un descuento en el envío 1 enseña a los clientes a abandonar. Resérvalo para el 2 o el 3.
- Excluye a quienes abandonaron carritos de menos de cierto valor o a los que abandonan siempre (juegan con el descuento).
- Detén la secuencia al comprar, al darse de baja o a las 48 horas.

---

## Abandono de navegación

### Envío 1 — 1 hora después de navegar (un producto o una categoría)

```
De [Marca]: ¿Sigues pensando en [producto]? Échale otro vistazo: [enlace.corto]
```
~84 caracteres / 1 segmento.

**Notas**:
- Dispáralo solo tras una señal de navegación clara (3 o más productos vistos o más de 2 minutos en la página del producto).
- Exclúyelo si compró otro producto.

---

## Flujo de posventa

### Envío 1 — Justo tras la compra (transaccional, consentimiento aparte)

```
De [Marca]: ¡Pedido #12345 confirmado! Te avisaremos del envío por aquí. Rastrea: [enlace.corto]
```
~95 caracteres / 1 segmento.

### Envío 2 — El día del despacho

```
De [Marca]: Tu pedido va en camino. Entrega estimada: [fecha]. Rastrea: [enlace.corto]
```
~92 caracteres / 1 segmento.

### Envío 3 — El día de la entrega

```
De [Marca]: ¡Tu pedido debería llegar hoy! ¿Dudas? Responde o entra a [enlace.corto]
```
~88 caracteres / 1 segmento.

### Envío 4 — 2 días después de la entrega (requiere consentimiento de marketing)

```
De [Marca]: ¿Qué tal tu [producto]? Cuéntanos y recibe 15 % en tu próximo pedido: [enlace.corto]
```
~108 caracteres / 1 segmento.

### Envío 5 — 14 días después de la entrega (venta cruzada, consentimiento de marketing)

```
De [Marca]: Combina de maravilla con tu [producto]: [artículo-relacionado]. 10 % en el combo: [enlace.corto]
```
~99 caracteres / 1 segmento.

---

## Reactivación (clientes dormidos)

### Envío 1 — 60 a 90 días después de la última compra

```
De [Marca]: [Nombre], ¡te extrañamos! Lo que creemos que te va a encantar: [enlace.corto]
```
~84 caracteres / 1 segmento.

### Envío 2 — 14 días después (si no compró)

```
De [Marca]: Vuelve con 15 % en tu próximo pedido: VUELVE15. Vence en 7 días: [enlace.corto]
```
~106 caracteres / 1 segmento.

### Envío 3 — 14 días después del envío 2 (final, si no compró)

```
De [Marca]: Última oportunidad: 20 % hasta esta noche: VUELVE20. Si prefieres no recibir más, responde STOP. [enlace.corto]
```
~130 caracteres / 1 segmento.

**Notas**:
- Tras el envío 3 sin interacción, suprime al menos 90 días.
- Tras dos ciclos completos de reactivación sin interacción, retira a la persona de la lista activa.

---

## Promociones y campañas

### Oferta relámpago (un solo envío)

```
De [Marca]: RELÁMPAGO 24 H: 25 % en todo con RELAMPAGO25. Termina a medianoche: [enlace.corto]
```
~94 caracteres / 1 segmento.

### Lanzamiento o edición limitada

```
De [Marca]: Acaba de llegar: [nombre-del-producto]. Stock limitado; los miembros entran primero: [enlace.corto]
```
~115 caracteres / 1 segmento.

### Fecha fuerte del año (Black Friday, Navidad, Día de la Madre…; secuencia de 2 envíos)

Envío 1 — El día de arranque:
```
De [Marca]: ¡Ya empezó el Black Friday! Hasta 50 % en toda la tienda. Compra: [enlace.corto]
```
~92 caracteres / 1 segmento.

Envío 2 — El mismo día (o la noche, empujón de cierre):
```
De [Marca]: Quedan 6 horas de ofertas. No te quedes sin lo tuyo: [enlace.corto]
```
~73 caracteres / 1 segmento.

---

## Transaccionales y avisos de cuenta

### Confirmación del pedido

```
[Marca]: Pedido #12345 confirmado. Total [monto]. Rastrea en [enlace.corto]. Responde HELP para ayuda.
```

### Aviso de envío

```
[Marca]: ¡Tu pedido #12345 salió! Rastrea: [enlace.corto]. Llega el [fecha].
```

### Confirmación de entrega

```
[Marca]: Pedido #12345 entregado. ¡Disfrútalo! ¿Algún problema? Responde o entra a [enlace-de-soporte].
```

### Recordatorio de cita (negocios de servicios, clínicas, salones)

```
[Marca]: Te esperamos mañana [día] a las [hora] en [sucursal]. Para cambiar tu cita responde CAMBIAR o llama al [teléfono].
```

### Código de verificación (2FA)

```
Código de verificación de [Marca]: 123456. Vence en 10 min. No lo compartas.
```

### Alerta de cuenta

```
[Marca]: Inicio de sesión desde un dispositivo nuevo en [lugar]. ¿No fuiste tú? Protege tu cuenta: [enlace.corto]
```

---

## Recuperar el interés (suscriptores que se enfriaron)

Para suscriptores de mensajes que no han interactuado con ningún envío en 60 días o más.

### Envío 1 — Reactivación suave

```
De [Marca]: ¡Te hemos extrañado, [Nombre]! Mira las novedades: [enlace.corto]
```
~80 caracteres / 1 segmento.

### Envío 2 — Confirmar el interés (si no hubo interacción)

```
De [Marca]: ¿Quieres seguir recibiendo mensajes nuestros? Responde SÍ para quedarte o STOP para darte de baja.
```
~98 caracteres / 1 segmento.

Sin respuesta: suprime 60 días y luego retira de la lista activa. Así proteges la tasa de bajas y evitas gasto inútil.

---

## Reposición (productos consumibles)

Para productos con ciclos de uso predecibles (cuidado de la piel, suplementos, café, alimento de mascotas, medicamentos de uso continuo si la ley lo permite).

### Envío 1 — En la ventana esperada de recompra (p. ej., a los 28 días de un suministro de 30)

```
De [Marca]: ¿Se te está acabando [producto]? Repón con un toque: [enlace.corto]
```
~73 caracteres / 1 segmento.

### Envío 2 — 7 días después (si no compró)

```
De [Marca]: ¡No te quedes sin él! 10 % en tu recompra de [producto]: RECARGA10 [enlace.corto]
```
~92 caracteres / 1 segmento.

---

## Clientes VIP y programas de lealtad

Más frecuencia, ofertas exclusivas, acceso anticipado: rigen reglas de ritmo distintas, pero las horas de silencio y STOP siguen siendo obligatorios.

### Acceso anticipado

```
De [Marca]: Los VIP reciben el nuevo lanzamiento 24 h antes. Ya es tuyo: [enlace.corto]
```
~72 caracteres / 1 segmento.

### Hito de lealtad

```
De [Marca]: ¡Llegaste al nivel Oro! Tus beneficios: 15 % + envío gratis. [enlace.corto]
```
~95 caracteres / 1 segmento.

---

## Reglas de segmentación en todos los flujos

- **Suprime** de las promociones a quienes están en una secuencia activa (sin doble toque).
- **Suprime** de todo a quienes se dieron de baja (la plataforma lo hace).
- **Tope de frecuencia**: máximo 4 a 6 envíos de marketing por semana por suscriptor (menos para los nuevos).
- **Horas de silencio**: 9 a. m.–8 p. m., hora local del destinatario.
- **Enfriamiento**: tras una compra motivada por un descuento, suprime las promociones durante 14 días.
