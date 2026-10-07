# Estructura de planes y empaque

Los montos de los ejemplos son ilustrativos, en unidades de moneda genéricas: nunca los uses como precios de la empresa. Los precios reales salen de las cifras de la empresa.

## Contenido
- ¿Cuántos planes?
- Bueno-Mejor-El mejor
- Cómo diferenciar los planes
- Ejemplo de estructura
- Empaque por perfiles
- Plan gratuito o prueba gratis
- Precios para grandes empresas

## ¿Cuántos planes?

**2 planes:** elección simple y clara.
- Sirve cuando: hay una división clara entre pymes y grandes empresas (o entre cliente particular y cliente empresa).
- Riesgo: dejar dinero en la mesa.

**3 planes:** el estándar.
- Bueno = la entrada
- Mejor = el recomendado (anclado al de arriba)
- El mejor = clientes de alto valor

**4 o más:** más detalle.
- Sirve cuando: hay clientes de tamaños muy distintos.
- Riesgo: parálisis al decidir y complejidad. Cada opción de más alarga la decisión (ley de Hick); antes de sumar un plan, comprueba que cubre un hueco real y no solo otra columna.

---

## Bueno-Mejor-El mejor

**Bueno (entrada):**
- Para qué: quitar barreras de entrada
- Incluye: lo esencial, uso limitado
- Precio: bajo, accesible
- Para quién: equipos pequeños, probar antes de comprar

**Mejor (recomendado):**
- Para qué: donde cae la mayoría
- Incluye: todo lo importante, límites razonables
- Precio: tu precio «ancla»
- Para quién: equipos que crecen, usuarios serios

**El mejor (premium):**
- Para qué: capturar a los clientes de alto valor
- Incluye: todo, lo avanzado, límites más altos
- Precio: premium (a menudo 2-3 veces el «Mejor»)
- Para quién: equipos grandes, usuarios intensivos, empresas

Si un plan se lleva la gran mayoría de los clientes (por ejemplo, el 70 %), es buena señal de que el plan recomendado funciona; antes de añadir otro, mira si hay clientes que se quedan en medio (demasiado grandes para el «Mejor», demasiado pequeños para el de empresas) y si se puede resolver ajustando límites del «Mejor» o con complementos.

---

## Cómo diferenciar los planes

**Por funciones:**
- Lo básico en todos
- Lo avanzado en los planes altos
- Sirve cuando las funciones tienen diferencias de valor claras

**Por límites de uso:**
- Mismas funciones, distintos límites
- Más usuarios, almacenamiento o llamadas a la API en los altos
- Sirve cuando el valor crece con el uso

**Por nivel de soporte:**
- Correo → prioritario → acompañamiento dedicado
- Sirve en productos que cuesta implementar

**Por acceso y personalización:**
- API, inicio de sesión único (SSO), marca propia
- Sirve para diferenciar el plan de empresas

---

## Ejemplo de estructura

```
┌────────────────┬─────────────────┬─────────────────┬─────────────────┐
│                │ Inicial         │ Pro             │ Empresa         │
│                │ 29 /mes         │ 79 /mes         │ 199 /mes        │
├────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Usuarios       │ Hasta 5         │ Hasta 20        │ Ilimitados      │
│ Proyectos      │ 10              │ Ilimitados      │ Ilimitados      │
│ Almacenamiento │ 5 GB            │ 50 GB           │ 500 GB          │
│ Integraciones  │ 3               │ 10              │ Ilimitadas      │
│ Analítica      │ Básica          │ Avanzada        │ A medida        │
│ Soporte        │ Correo          │ Prioritario     │ Dedicado        │
│ Acceso a API   │ ✗               │ ✓               │ ✓               │
│ SSO            │ ✗               │ ✗               │ ✓               │
│ Registro de    │ ✗               │ ✗               │ ✓               │
│ auditoría      │                 │                 │                 │
└────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

El mismo esquema para un servicio (agencia de redes):

```
┌──────────────────┬──────────────┬──────────────┬──────────────┐
│                  │ Esencial     │ Crecimiento  │ Completo     │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ Publicaciones/mes│ 8            │ 16           │ 30           │
│ Redes            │ 2            │ 3            │ 5            │
│ Reels o videos   │ —            │ 2            │ 6            │
│ Informe mensual  │ Básico       │ Con análisis │ Con reunión  │
│ Anuncios pagados │ —            │ —            │ Incluidos    │
└──────────────────┴──────────────┴──────────────┴──────────────┘
```

---

## Empaque por perfiles

### Identificar los perfiles de precio
Los clientes difieren en: disposición a pagar, necesidades, forma de comprar y percepción de valor.

**Segmenta por:**
- Tamaño (independiente → pyme → gran empresa)
- Caso de uso (marketing, ventas, soporte)
- Nivel (principiante → usuario avanzado)
- Industria (presupuestos distintos)

### Empaque por perfiles

**Paso 1: define los perfiles**

| Perfil | Tamaño | Necesita | Disposición a pagar | Ejemplo |
|---|---|---|---|---|
| Independiente | 1 persona | Lo básico | Baja | 19 /mes |
| Equipo pequeño | 2-10 | Colaborar | Media | 49 /mes |
| Empresa que crece | 10-50 | Escala, integraciones | Más alta | 149 /mes |
| Gran empresa | 50+ | Seguridad, soporte | Alta | A medida |

**Paso 2: asigna funciones a cada perfil**

| Función | Independiente | Equipo pequeño | Que crece | Gran empresa |
|---|---|---|---|---|
| Lo esencial | ✓ | ✓ | ✓ | ✓ |
| Colaboración | — | ✓ | ✓ | ✓ |
| Integraciones | — | Limitadas | Completas | Completas |
| Acceso a API | — | — | ✓ | ✓ |
| SSO/SAML | — | — | — | ✓ |
| Registro de auditoría | — | — | — | ✓ |
| Contrato a medida | — | — | — | ✓ |

**Paso 3: precio según el valor de cada perfil**
- Investiga la disposición a pagar por segmento.
- Pon precios que capturen valor sin frenar la adopción.
- Considera páginas de aterrizaje por segmento.

---

## Plan gratuito o prueba gratis

### Cuándo conviene un plan gratuito (freemium)
**Funciona cuando:**
- El producto se contagia o tiene efectos de red.
- Los usuarios gratis aportan valor (contenido, datos, recomendaciones).
- El mercado es grande y un pequeño porcentaje de conversión da volumen.
- Atender a un usuario gratis cuesta poco.
- Hay límites claros de funciones o uso que empujan a pagar.

**Riesgos:**
- Los usuarios gratis pueden no convertir nunca.
- Baja la percepción de valor.
- Costos de soporte por gente que no paga.
- Más difícil subir precios después.

### Cuándo conviene una prueba gratis
**Funciona cuando:**
- El producto necesita tiempo para mostrar su valor.
- Requiere configuración o aprendizaje.
- Es B2B con varios que deciden.
- El precio es alto.
- El producto «se pega» una vez configurado.

**Buenas prácticas:**
- 7-14 días para productos simples.
- 14-30 días para productos complejos.
- Acceso completo (no recortado).
- Cuenta regresiva y recordatorios claros (los recordatorios son borradores de `secuencias-correo`).
- Decidir si pedir la tarjeta al empezar o no.

**Pedir la tarjeta al empezar** (orientación, varía mucho por producto):
- Suele dar más conversión de prueba a pago (cifras que circulan: 40-50 % frente a 15-25 % sin tarjeta)
- Menos pruebas
- Prospectos mejor calificados

### Enfoques mixtos
**Gratuito + prueba:** un plan gratis limitado y una prueba de las funciones premium. Ejemplo: Zoom (gratis con reuniones de 40 minutos, prueba del plan Pro).

**Prueba inversa:** empiezas con acceso completo; al terminar la prueba bajas al plan gratuito. El cliente ve el valor premium y convive con los límites hasta que está listo.

**Fuera del software:** la «primera clase gratis», la «consulta de valoración sin costo», la muestra o degustación, el «primer mes a mitad de precio». Mismas preguntas: ¿cuánto cuesta darlo?, ¿atrae al cliente que luego paga?, ¿hay un paso claro a la compra?

---

## Precios para grandes empresas

### Cuándo añadir precio a medida
Añade «Habla con ventas» cuando:
- Las ventas superan un monto anual alto por cliente (en software, como referencia, 10.000 dólares al año o más).
- Hacen falta contratos a medida.
- Hay implementación o acompañamiento inicial.
- Hay requisitos de seguridad o cumplimiento.
- Hay procesos de compras.

### Qué lleva el plan de empresas
**Lo mínimo:** SSO/SAML, registro de auditoría, controles de administración, acuerdo de nivel de servicio (SLA), certificaciones de seguridad.
**Valor extra:** soporte o acompañamiento dedicado, puesta en marcha a medida, capacitaciones, integraciones a medida, voz en la hoja de ruta.

### Estrategias
**Por puesto a escala:** descuento por volumen para equipos grandes. Ejemplo: 15 por usuario (estándar) → 10 por usuario (100 o más).

**Cuota de plataforma + uso:** cuota base por el acceso y cobro por uso por encima de un umbral. Ejemplo: 500 al mes de base + 0,01 por llamada a la API.

**Contratos por valor:** precio atado a los ingresos o resultados del cliente. Ejemplo: un porcentaje de las transacciones, reparto de ingresos.

Los descuentos por volumen y las condiciones de contrato las aprueba el dueño; si existen, están en las cifras de la empresa.
