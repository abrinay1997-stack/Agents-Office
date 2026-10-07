# Presupuesto por periodo de recuperación (payback)

La puerta antes de cualquier decisión de canal: **¿puedo permitirme este canal?** La publicidad tiene que ser **determinista**: un peso que entra, más de un peso que sale, en un plazo que puedas nombrar. El periodo de recuperación (Payback Period) es cómo fijas ese plazo. Los importes de los ejemplos van en dólares como ilustración: usa la moneda de la empresa y sus cifras reales.

## Primero, descarta el LTV:CAC

**LTV:CAC es una métrica inútil y a menudo destructiva.** Parece rigurosa y suele ser mentira. Cuatro fallos:

1. **Supone que todos los clientes se van.** El LTV (valor de por vida) incluye una muerte eventual para cada cuenta. Tus mejores clientes no se van: se acumulan. Una métrica que escribe de antemano el obituario de todos subestima tu base real.
2. **Supone que las bajas ocurren parejas en el tiempo.** No es así. Los datos de Baremetrics muestran que **hay más bajas en los primeros 3 meses que en cualquier otra ventana**: están concentradas al principio, no repartidas. El LTV combinado aplana ese pico en un promedio liso y esconde el riesgo real (y la cuenta real de recuperación).
3. **Esconde la varianza entre planes bajo un ingreso promedio por cliente (ARPU) combinado.** Un plan de $9 al mes y uno de $999 al mes se promedian en un número que no describe a ninguno. Los canales, las creatividades y la recuperación que funcionan para quien compra el de $9 no se parecen en nada a los del de $999, pero el LTV:CAC combinado dice «3:1, estamos bien» y escalas lo que no es.
4. **Ignora el retraso del ingreso.** Las pruebas gratis, los planes gratis y los ciclos de venta largos hacen que el dinero llegue semanas o meses después de gastado el CAC. El LTV:CAC trata la adquisición y el ingreso como simultáneos. No lo son. Ese hueco es donde a las empresas se les acaba el efectivo. (Vale igual para un negocio de servicios con anticipos y pagos a plazos, o una tienda que compra inventario antes de vender.)

Un LTV:CAC «sano» de 3:1 puede estar sobre un canal que te quiebra, porque la razón nunca pregunta *cuándo vuelve el dinero*.

## El reemplazo: periodo de recuperación

**Periodo de recuperación = CAC / ARPU** (mensual).

La respuesta está en **meses**: cuánto tarda un cliente en devolver lo que costó conseguirlo. **Meta: 3–12 meses.** Menos de 3 suele dejar crecimiento sobre la mesa; más de 12 significa que financias clientes por más tiempo del que aguantan la mayoría de los balances en etapa temprana.

Como se calcula por cohorte y por plan (no combinado), expone exactamente lo que el LTV:CAC esconde.

### Ejemplo resuelto: mismo CAC, recuperación muy distinta

Digamos que un canal cuesta **$300 por cliente conseguido** (CAC = $300):

| Plan | ARPU (mensual) | Recuperación = CAC / ARPU | Veredicto |
|------|---------------|----------------------|---------|
| Inicial | $9 | 300 / 9 = **33,3 meses** | Inasumible. Esperas ~3 años para recuperar la adquisición, antes de contar las bajas. No corras este canal para este plan. |
| Pro | $99 | 300 / 99 = **3,0 meses** | Sano. Piso de la banda objetivo. Escálalo. |
| Empresarial | $999 | 300 / 999 = **0,3 meses** | Excelente. Se recupera en ~9 días. Ponle presupuesto. |

Mismo CAC, mismo canal. En el plan de $9 el canal es un incinerador de efectivo; en el de $999 es una imprenta de dinero. **El LTV:CAC combinado los habría promediado en un «estamos bien» sin sentido.** El periodo de recuperación te obliga a correr el canal solo para los planes que de verdad puede costear.

La jugada práctica: calcula la recuperación **por plan (o por cohorte)** y enciende la adquisición pagada solo en los segmentos donde cae dentro de 3–12 meses. Manda a quienes compran lo barato hacia movimientos orgánicos o guiados por el producto.

**Si la empresa no es de suscripción:** el mismo cálculo sirve con el margen por venta. Una tienda con compra única usa **CAC / margen bruto de la primera compra** (y mira la recompra aparte); un consultorio o un servicio por proyecto usa **CAC / margen del primer servicio** y suma el valor de los clientes que vuelven; una constructora, con ciclos largos, mide en meses desde el gasto hasta el cobro.

## Periodo de recuperación descontado (ajustado por bajas)

El periodo bruto supone que todos sobreviven hasta pagarte. No es así, sobre todo en esos primeros 3 meses. Ajústalo:

**Periodo de recuperación descontado = CAC / (ARPU × retención anual)**

Multiplica el ARPU por la fracción de clientes que siguen pagando, para que el denominador refleje ingreso real retenido y no teórico.

Ejemplo: CAC $300, ARPU $99, retención anual 70 %:
- Bruto: 300 / 99 = 3,0 meses
- Descontado: 300 / (99 × 0,70) = 300 / 69,3 = **4,3 meses**

Sigue dentro de la banda, pero el número descontado es contra el que hay que presupuestar. Cuando la retención es débil, la recuperación descontada se pasa de 12 meses aunque la bruta se viera bien; esa brecha es tu alarma temprana.

## Úsalo como puerta de canal

1. Calcula el CAC del canal (todo incluido: gasto / clientes, con la creatividad y la gestión).
2. Calcula la recuperación descontada por plan o cohorte.
3. **Enciende el canal solo donde la recuperación descontada sea ≤ 12 meses** (apunta a 3–12).
4. Vuelve a calcular cada mes: el CAC sube al escalar, y la puerta se mueve con él.

Esto se combina con el cálculo del CPL y el CPC de equilibrio en `pagados-b2b.md`: el equilibrio te dice lo *máximo* que puedes pagar por contacto; la recuperación te dice *cuánto tiempo queda atado tu efectivo*. Necesitas las dos para escalar sin quedarte seco.

## Dos reglas vecinas

**La publicidad exterior (vallas, transporte, impresos) sin amplificación en redes es dinero tirado.** No tiene clic, ni píxel, ni ciclo determinista por sí sola. Solo se recupera cuando está pensada para ser fotografiada, publicada y amplificada en redes: la exterior compra el momento, las redes compran el alcance. Correr exterior sin plan de redes es comprar un reconocimiento que no puedes medir ni acumular. (Un negocio local lo vive con el letrero, el volante o la valla: si nadie los fotografía ni los comparte, no hay cómo saber qué trajeron.)

**Impulso narrativo** (texto del anuncio): los anuncios que mejor rinden llevan una historia hacia adelante en lugar de repetir un discurso: cada línea se gana la siguiente y construye tensión hacia el llamado a la acción, en vez de cargar las funciones al principio. Combínalo con la disciplina de **probar una variable a la vez** (texto, luego creatividad, luego audiencia) para saber qué movió de verdad la recuperación. El detalle de ambos está en `creatividad-anuncios`; este archivo solo los señala como palancas que cambian tu CAC.

---

*Fuente: Corey Haines, *Founding Marketing*, cap. 7 («Gasta el presupuesto donde los clientes pasan su tiempo»). Las metas de recuperación y el hallazgo de Baremetrics sobre las bajas en los primeros 3 meses son datos reportados por profesionales: recalíbralos con los datos de tu propia cohorte. Para la atribución de los insumos del CAC, ver `atribucion`; para definir el ARPU y la estructura de planes, ver `precios`.*
