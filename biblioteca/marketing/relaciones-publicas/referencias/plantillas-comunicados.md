# Plantillas de comunicados de crisis

Adaptado de una contribución de @fyscleaning-jpg (PR #381 del repositorio original).

Estructuras para los comunicados de crisis más comunes. Llénalas con datos reales. Nada sale con corchetes todavía puestos, y nada sale sin el OK del dueño. Para saber cuándo usar cada una, lee `comunicacion-de-crisis`.

## Contenido
- Comunicado de espera
- Comunicado completo del incidente
- Aviso de filtración de datos o incidente de seguridad
- Comunicado de caída del servicio
- Comunicado de daño a un cliente / disculpa
- Comunicado de error de cobro o de precios
- Análisis posterior público

## Comunicado de espera

Úsalo en los primeros 30–60 minutos, antes de confirmar los hechos.

```
Sabemos de [el problema concreto: la caída / los reportes de X / el incidente descrito en Y].

Lo estamos investigando y compartiremos una actualización completa antes de las [hora concreta].

[Opcional: Mientras tanto, [enlace a la página de estado / alternativa para seguir trabajando].]
```

No digas nada sobre la causa, el alcance ni a quién afecta. Eso va en el comunicado completo, cuando esté confirmado.

## Comunicado completo del incidente

```
[Qué pasó, en una o dos frases claras.]

[A quién afecta. Sé concreto: «clientes del plan X», «usuarios que se registraron antes del [fecha]», «todos los clientes de [ciudad o región]».]

[Qué está confirmado y qué sigue en investigación.]

[Qué estamos haciendo ahora mismo.]

[Qué deben hacer los afectados, si algo.]

[Cuándo compartiremos la próxima actualización.]

[Un contacto o canal directo para preguntas.]
```

## Aviso de filtración de datos o incidente de seguridad

El abogado debe revisarlo antes de que salga. Los plazos de aviso y el contenido exigido cambian según el país (RGPD, leyes locales de protección de datos) y el tipo de dato, y el abogado decide cuáles aplican. Deja el lenguaje de responsabilidad y disculpa solo cuando el abogado lo haya aprobado.

```
Asunto: Aviso importante de seguridad sobre tu cuenta de [Empresa]

Te escribimos para contarte sobre un incidente de seguridad que [afectó / pudo afectar] tu cuenta.

Qué pasó: [Cómo se descubrió, cuándo y por quién (equipo interno, investigador externo, aviso de un cliente).]

Qué información se vio involucrada: [Sé exacto. Si el alcance aún se confirma: «Confirmamos que se vio afectado [X]. Seguimos investigando si se afectó [Y] y te avisaremos antes del [fecha] en cualquier caso».]

Qué hicimos: [Pasos de contención, p. ej. «Corregimos la vulnerabilidad, cambiamos las credenciales afectadas y contratamos una empresa de seguridad externa para auditar la corrección».]

Qué debes hacer: [Pasos concretos: cambia tu contraseña, activa la verificación en dos pasos, revisa tus estados de cuenta en busca de [actividad concreta].]

Qué vamos a cambiar: [El cambio de proceso o de sistema que evita que se repita.]

Lamentamos la preocupación que esto te causa. Si tienes preguntas, escríbenos a [contacto] y te responderemos en [plazo].
```

## Comunicado de caída del servicio

**Inicial (página de estado o publicación fijada):**
```
Tenemos [el síntoma concreto, p. ej. «errores frecuentes en [función]» o «una caída total del servicio»] que afecta a [alcance: todos los usuarios / usuarios de la región X / usuarios del plan Y].

Lo estamos investigando y publicaremos una actualización antes de las [hora].
```

**Resolución:**
```
Este incidente quedó resuelto a las [hora].

Causa: [Resumen en lenguaje claro. El detalle técnico completo va en el análisis posterior.]

Duración: de [inicio] a [fin], afectando a [alcance].

Qué cambia: [Paso concreto de prevención.]

Lamentamos la interrupción. [Si aplica: detalle del crédito y cómo se aplicará automáticamente, sin que tengas que pedirlo.]
```

**En un negocio físico** el equivalente es el cierre imprevisto, la falta de un servicio o un retraso general (p. ej. «la clínica no atenderá hoy por un corte de luz»): mismo esquema, publicado en el perfil de Google, las redes y el WhatsApp de la empresa, y aviso directo a quienes tenían cita.

## Comunicado de daño a un cliente / disculpa

Para la mala experiencia de un cliente que se hizo pública. Contacta al cliente en privado primero. Una disculpa pública que el cliente no vio, o que contradice lo que le dijiste, lo empeora.

```
Vimos la experiencia de [cliente] con [situación concreta] y lo sentimos. [Di con claridad qué salió mal, sin «si».]

[Qué estamos haciendo para resolverlo con este cliente.]

[Qué estamos cambiando para que no les pase a otros. Nombra el cambio, no «estamos revisando nuestros procesos».]

Ya nos comunicamos con [cliente] directamente y seguiremos trabajando con él hasta resolverlo.
```

## Comunicado de error de cobro o de precios

Empieza por el arreglo que ya está en marcha. No les pidas a los afectados que se presenten.

```
Encontramos un error que [problema concreto, p. ej. «cobró de más a los clientes del plan anual entre el [fecha] y el [fecha]»], y afecta a [número o porcentaje] de clientes.

Ya [hicimos los reembolsos / aplicamos créditos / corregimos el cálculo de cobro]. No tienes que hacer nada. [Los reembolsos / créditos] se verán reflejados antes del [fecha]. Si no lo ves para entonces, escríbenos a [canal].

Esto pasó por [causa raíz breve y honesta, p. ej. «un error en el cambio de nuestro sistema de cobro»]. Ya lo corregimos y añadimos [salvaguarda concreta] para detectarlo antes de que llegue a los clientes.

Lamentamos la molestia y agradecemos tu paciencia.
```

(Los montos y las fechas salen de los datos de Finanzas, nunca se estiman.)

## Análisis posterior público

Para incidentes de nivel 3 y 4, publicado una vez resuelta la crisis y confirmada la causa raíz.

```
# [Nombre del incidente]: análisis posterior

Resumen: [2–3 frases: qué pasó, el impacto, la duración.]

Cronología:
- [Hora]: [Hecho, p. ej. se introdujo el problema, primeros reportes, escalamiento interno, se aplicó el arreglo, resuelto por completo]

Causa raíz: [Causa técnica o de proceso concreta. Evita frases vagas como «un problema de configuración».]

Impacto: [Quiénes y qué se vio afectado, alcance, duración.]

Qué vamos a cambiar:
1. [Cambio concreto y verificable, p. ej. «añadimos la reversión automática cuando falla una actualización»]
2. [Cambio concreto y verificable]

Qué salió bien: [Opcional. P. ej. detección rápida, comunicación interna clara.]

Qué haríamos distinto: [Huecos honestos en la respuesta, más allá de la causa técnica.]
```

Los compromisos vagos («lo haremos mejor») se olvidan. Los concretos y verificables reconstruyen la confianza.
