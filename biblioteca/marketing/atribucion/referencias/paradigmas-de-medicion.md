# Paradigmas de medición: MTA, MMM e incrementalidad

Los *modelos* de atribución (ver `modelos-atribucion`) reparten el crédito dentro de tus datos rastreados. No pueden decirte qué habría pasado de todos modos. Para eso están estos tres paradigmas: formas cada vez más rigurosas y más caras de acercarte a la causalidad. Úsalo para ayudar al dueño a elegir y para explicar cómo se *lee* una prueba (no cómo se calcula la estadística).

## Los tres, comparados

| | **MTA** (multicontacto) | **MMM** (mezcla de medios) | **Incrementalidad** (experimentos) |
|---|---|---|---|
| **Enfoque** | De abajo hacia arriba: unir contactos por persona y aplicar un modelo | De arriba hacia abajo: regresión de resultados contra inversión y otros factores en el tiempo | Controlado: dejar a un grupo sin exposición y medir la diferencia |
| **Responde** | «¿Qué puntos de contacto aparecen en los recorridos que convierten?» | «¿Cuánto aporta cada canal en conjunto?» | «¿Este canal *causó* un aumento que no habría llegado igual?» |
| **Granularidad** | Por persona, por contacto | Por canal, por semana | Por prueba (un canal o una táctica a la vez) |
| **Datos que necesita** | Seguimiento limpio entre aparatos, por persona | 2 a 3 años de datos semanales y variación en la inversión | Poder dejar a un grupo sin exposición y volumen suficiente |
| **Reacciona** | En tiempo real | Lento (semanas o trimestres) | Por ciclo de prueba |
| **Maneja lo fuera de línea y la marca** | No | Sí | Sí (si puedes dividir la exposición) |
| **Resiste los cambios de privacidad** | Débil (pérdida de cookies e identificadores) | Fuerte (es agregado) | Fuerte (es agregado) |
| **Costo y esfuerzo** | Bajo a medio | Alto | Medio a alto |

## MTA: atribución multicontacto

**Qué es:** el enfoque por persona que la mayoría quiere decir con «atribución»: unir los contactos de una persona y aplicar crédito de primer contacto, lineal, de posición o basado en datos.

**Dónde brilla:** decisiones tácticas del día a día. «¿Esta campaña aparece en los recorridos que convierten?» Rápido, granular y barato si ya existe el seguimiento.

**Por qué se debilita estructuralmente:** depende de seguir a una persona entre contactos y aparatos, y esos datos se erosionan: los límites de cookies de Safari y Firefox, el aviso de rastreo de iOS, el consentimiento obligatorio, los bloqueadores de anuncios y el comportamiento normal entre aparatos y navegadores dentro de apps (investigar en el celular, comprar en la computadora). (Chrome anunció el fin de las cookies de terceros y luego dio marcha atrás, así que «las cookies se acaban» ya no es la historia limpia, pero todo lo demás de esa lista ya limita hoy el seguimiento por persona.)

Los recorridos basados en clics tienen un segundo sesgo: **los canales de impresión (redes, video, display) a menudo ni entran al recorrido**: una vista sin clic no deja un contacto que se pueda unir. Por eso el MTA **sobrepesa la captura de demanda** (búsqueda, correo, directo) y **subpesa la creación de demanda**. No avisa de la brecha: subestima en silencio todo lo que no puede seguir (lo manda a «directo») y sobreestima lo que sí ve. Trátalo como **incompleto y con sesgo direccional**, no como un límite inferior limpio (sus cifras de remarketing y de marca suelen estar *infladas*), y nunca como la única base de una gran reasignación.

**Úsalo para:** optimización continua y vigilar tendencias; nunca como única base de una gran reasignación de presupuesto.

## MMM: modelo de mezcla de medios

**Qué es:** un modelo estadístico de arriba hacia abajo (históricamente una regresión; hoy hay opciones abiertas como Robyn de Meta o Meridian de Google) que explica un resultado (ventas, registros) en función de la inversión por canal más controles (estacionalidad, promociones, precio, entorno económico). Nunca mira a individuos: es toda serie de tiempo agregada, por eso los cambios de privacidad no lo tocan.

**Lo que da y nadie más da:**
- **Lo fuera de línea, la marca y lo difícil de rastrear** (TV, radio, podcasts, publicidad exterior, relaciones públicas, orgánico), porque trabaja con inversión y resultados agregados, no con clics.
- **Rendimientos decrecientes y curvas de saturación:** dónde el próximo peso en un canal deja de rendir.
- **Una vista de portafolio:** cómo toda la mezcla mueve el resultado, no el crédito de un solo recorrido.

**Lo que cuesta y dónde es débil:**
- Necesita **2 a 3 años de datos semanales** y **variación real en la inversión**: si siempre gastas lo mismo en Meta, el modelo no puede aprender el efecto de Meta. A veces hay que variar presupuestos a propósito para alimentarlo.
- Es **correlacional y lento:** ve lo que se movió junto en el pasado; reacciona en trimestres, no en días. No te dice qué hacer con la campaña de mañana.
- Es **sensible a su especificación:** controles malos, coeficientes malos. Es un ejercicio de modelado real, no un interruptor de un panel.

**Úsalo para:** el reparto anual o trimestral entre una inversión material, de varios canales (sobre todo con lo fuera de línea). Valida sus coeficientes con pruebas de incrementalidad: el MMM dice «Meta aportó X»; un grupo de control prueba si eso es causal.

## Incrementalidad: los experimentos

**Qué es:** el único paradigma que mide la *causalidad* directamente. Divide a tu audiencia en un grupo **expuesto** y un grupo **retenido o de control**; la diferencia en resultados es el **aumento incremental**: ventas que tuviste *por* el canal y no las que habrían ocurrido de todos modos.

**Diseños comunes:**
- **Control por zonas geográficas:** corres el canal en unas regiones comparables y lo retienes en otras; comparas los resultados. Es el caballo de batalla para canales que no se pueden dividir por persona. *(GeoLift de Meta, experimentos geográficos de Google.)* En un negocio local, ciudades o barrios comparables.
- **Anuncio de servicio público (PSA):** el grupo de control ve un anuncio de servicio público en lugar del tuyo, así que ambos grupos están igual de segmentados y «expuestos a un anuncio»; la única diferencia es si vieron *el tuyo*. Aísla el efecto del anuncio del sesgo de calidad de audiencia (los expuestos no son solo «la gente que el algoritmo juzgó probable de convertir»).
- **Anuncios fantasma:** la plataforma corre la subasta pero **retiene tu anuncio** del grupo de control y registra la impresión que *habría* servido; ese usuario puede ver el anuncio de otro anunciante. Comparas a quienes convirtieron entre los que habrían sido expuestos y los realmente expuestos. Más limpio y barato que el PSA (no se gasta en el anuncio de relleno) y el predeterminado moderno donde la plataforma lo permite. (Distinto de la intención de tratar cruda, que retiene sin registrar lo que se habría servido.)
- **Pruebas de apagar y prender (pulso):** apagas un canal por completo durante una ventana definida y observas qué pasa con las ventas totales. Burdo pero revelador, sobre todo para «¿la búsqueda de marca de pago está canibalizando la orgánica?».
- **Audiencias retenidas:** retienes un % al azar de un programa de remarketing o de correo; la diferencia es su aumento real.

### Cómo *leer* una prueba (sin calcular la estadística)

1. **Aumento = tasa de expuestos − tasa de control.** Si las zonas expuestas convirtieron al 4,2 % y las de control al 3,6 %, el aumento incremental es de ~0,6 puntos: el resto de ese 4,2 % habría convertido igual. Por eso el ROAS por último clic casi siempre está *sobrestimado*: cuenta todo el 4,2 %.
2. **Revisa el intervalo de confianza o la significancia.** «Aumento del 5 %, pero el intervalo va de −2 % a +12 %» significa que no aprendiste nada: la prueba tuvo poca potencia. Exige volumen y duración suficientes antes de creer una estimación puntual.
3. **Vigila la contaminación.** Usuarios de control a quienes igual se llegó (entre aparatos, derrame entre zonas) achican la diferencia medida. Un «sin aumento» puede ser una prueba con fugas, no un canal muerto.
4. **Tradúcelo en una decisión.** CPA incremental = inversión ÷ ventas *incrementales* (no totales). Es el número que debe mover el presupuesto, y suele ser peor que el CPA que reporta la plataforma: ese es el punto.

**Úsalo para:** las preguntas de mayor riesgo y los desempates: «¿el remarketing de verdad hace algo?», «¿la búsqueda de marca de pago solo compra clics que tendríamos gratis?», «¿cuál de nuestros dos canales más grandes impulsa de verdad el crecimiento?». Solo se pueden probar pocas cosas a la vez: gasta esas pruebas en las decisiones que más importan.

## Juntarlos (la pila madura)

Son capas, no competidores:

- **MTA** para la optimización táctica diaria o semanal y las tendencias: barato, granular, direccional.
- **MMM** para el reparto trimestral o anual de toda la mezcla, incluida lo fuera de línea: duradero, holístico. Prefiere el **ROI marginal y las curvas de saturación** al ROAS promedio de la plataforma al repartir el siguiente peso.
- **Incrementalidad** como **calibración y desempate**: la verdad de terreno que mantiene honestos al MTA y al MMM, corrida en tus apuestas más grandes.

### Correcciones triangulares (acercar el MTA a la realidad)

Cuando la incrementalidad, las encuestas y las brechas entre plataformas dicen lo mismo (un canal está subacreditado en el MTA por clics), **no inventes un multiplicador por la brecha entre plataformas**. Documenta una regla:

1. **Corrección por canal (capa de reporte):** después de correr el MTA, traslada una parte acotada de las conversiones de Directo y búsqueda de marca al canal subacreditado durante la ventana en que tienes evidencia (fechas de la prueba, vigencia de la campaña). Conserva intacta la tabla cruda del MTA; los paneles de decisión leen la tabla ajustada. Se hace rápido; solo a nivel de canal.
2. **Inserción a nivel de persona (avanzado):** antes de correr el MTA, agrega contactos sintéticos (p. ej. «impresión de YouTube») a un subconjunto de recorridos directos donde una coincidencia de encuesta, la pertenencia a una prueba por zonas o los registros de exposición de la plataforma lo justifiquen, y vuelve a puntuar. Requiere ingeniería; da granularidad por creativo y audiencia.

Empieza con un canal, una corrección, límites de tiempo y una parte **conservadora** del aumento medido (no el 100 % de una estimación puntual ruidosa). Amplía solo cuando los interesados confíen en la primera regla.

**Ajusta a quien te pide:** la mayoría de las pequeñas y medianas empresas necesita buenos UTM + último no directo + una pregunta al cliente + de vez en cuando una prueba de apagar y prender, no un MMM. Trae el MMM cuando la inversión fuera de línea o de marca sea material y el MTA visiblemente no la vea. Trae la incrementalidad formal cuando el presupuesto de un solo canal sea tan grande que equivocarse sea caro. **Ajusta el rigor al tamaño de la decisión.**
