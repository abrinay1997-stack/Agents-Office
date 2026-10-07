# Modelos de atribución: la matemática, resuelta

La tabla de los modelos, seis reglas de crédito aplicadas a un mismo recorrido y la atribución basada en datos explicada sin caja negra. Úsala cuando haya que explicar *por qué* dos modelos discrepan, o elegir uno con argumentos.

**Disponibilidad:** Google Ads y GA4 ya no ofrecen como modelos de reporte el primer clic, el lineal, el decaimiento temporal ni el basado en posición (retirados en 2023). Usa este archivo para los *conceptos* y para puntuar recorridos sobre tus propios datos (CRM, almacén de datos, recorrido propio). En las interfaces de Google hoy: basado en datos y último clic.

## Los modelos y cuándo miente cada uno

| Modelo | Regla de crédito | Sirve para | Cómo miente |
|---|---|---|---|
| **Primer contacto** | 100 % al primer contacto conocido | Valorar la parte alta del embudo y la generación de demanda; ciclos cortos | Ignora todo lo que cerró la venta; sobrevalora los canales de notoriedad |
| **Último contacto** | 100 % al último contacto antes de la conversión | Respuesta directa, compra rápida en línea | Sobrevalora la parte baja del embudo y la búsqueda de marca o el directo; ignora lo que creó la demanda |
| **Último no directo** | 100 % al último contacto, saltando «directo» | Arreglo barato de la contaminación del directo | Sigue siendo de un solo contacto; solo cambia el punto ciego de lugar |
| **Lineal** | Crédito igual a cada contacto | Recorridos largos donde cada paso importa | Trata una visita de paso como una demostración; favorece los canales de alta frecuencia |
| **Decaimiento temporal** | Más crédito a los contactos cercanos a la conversión | Ciclos más largos donde la cercanía pesa | Subestima la parte alta; sigue siendo una suposición, no una medición |
| **Basado en posición (en U)** | 40 % al primero, 40 % al último, 20 % repartido en el medio | Ventas con un momento claro de «se creó» y «se cerró» | El 40/40/20 es arbitrario; los contactos de en medio salen perdiendo |
| **Basado en datos (algorítmico/Shapley)** | Crédito según la contribución marginal modelada | Cuentas con mucho volumen de conversiones | Caja negra; necesita volumen; no ve lo que no recibió (fuera de línea, redes privadas) |

## El recorrido de ejemplo

El camino de un comprador de servicios a una venta anual de 12.000 (en la moneda de la empresa), cinco contactos en 38 días:

| # | Día | Contacto | Papel en la historia |
|---|---|---|---|
| C1 | 0 | Anuncio en redes (pago) | Te descubrió: creó notoriedad |
| C2 | 5 | Artículo del blog (búsqueda orgánica) | Volvió a informarse: construyó interés |
| C3 | 12 | Anuncio de remarketing (redes de pago) | Lo hizo volver a mitad de la consideración |
| C4 | 30 | Búsqueda de marca (búsqueda de pago) | Listo para actuar: buscó tu nombre |
| C5 | 38 | Directo → solicita cotización | Convirtió |

Lo esencial: **el contacto que se lleva el crédito depende por completo del modelo, y cada modelo cuenta una historia distinta de dónde salieron los 12.000.**

## Los seis modelos por reglas, aplicados

Crédito de la venta de 12.000 bajo cada regla (el último no directo es una variante del último contacto que salta «directo»):

| Contacto | Canal | Primer contacto | Último contacto | Último no directo | Lineal | Decaimiento | Posición (U) |
|---|---|---|---|---|---|---|---|
| C1 | Redes de pago | **12.000** | 0 | 0 | 2.400 | 175 | **4.800** |
| C2 | Orgánico | 0 | 0 | 0 | 2.400 | 290 | 800 |
| C3 | Redes de pago | 0 | 0 | 0 | 2.400 | 575 | 800 |
| C4 | Búsqueda de pago (marca) | 0 | 0 | **12.000** | 2.400 | 3.415 | 800 |
| C5 | Directo | 0 | **12.000** | 0 | 2.400 | **7.545** | **4.800** |

*(El decaimiento usa una vida media de 7 días: peso = 0,5^(días antes de la conversión / 7), normalizado: porcentajes de ~1,5 % / 2,4 % / 4,8 % / 28,5 % / 62,9 %, con las cantidades redondeadas para sumar 12.000. En un recorrido de 38 días el crédito se concentra en los dos últimos contactos, por eso el decaimiento temporal se comporta casi como el último contacto en ciclos largos. El basado en posición es 40/40/20, con el 20 % del medio repartido por igual entre C2, C3 y C4.)*

**Lee el desacuerdo:**
- **Primer contacto** se lo da todo al **anuncio en redes**: sirve para defender el valor de generar demanda; es ciego a lo que cerró.
- **Último contacto** se lo da todo a **Directo**, que en realidad significa «no sabemos»: el cajón de sastre. Así se desfinancia la parte alta del embudo.
- **Último no directo** se lo da a la **búsqueda de marca**; pero esa búsqueda solo ocurrió porque el anuncio y el blog crearon la demanda. Acreditar el clic de cierre es acreditar tu propia marca por una demanda que creó otro canal.
- **Lineal** lo reparte parejo: honesto en que los cinco importaron, inútil para decidir qué recortar (todo parece igual de importante).
- **Decaimiento temporal** favorece lo reciente: razonable en ciclos cortos; aquí subestima el anuncio que lo empezó todo.
- **Basado en posición** acredita los **extremos** (descubrió y cerró): suele ser el modelo único más defendible en ventas de ciclo largo, porque «qué creó la venta» y «qué la cerró» son las dos decisiones que de verdad tomas.

**Lo que le dices al dueño:** reporta **primer y último contacto lado a lado**. La distancia entre el anuncio en redes y Directo *es* el hallazgo: dice que las redes de pago crean demanda que luego aparece como directo o búsqueda de marca. Ningún número lo captura; la distancia, sí.

## Atribución basada en datos (Shapley), sin tecnicismos

El modelo por datos (el de Google, el de la mayoría de las herramientas multicontacto) no usa una regla fija. Pregunta algo contrafactual: **¿cuánto cambia cada contacto la probabilidad de convertir?** El motor formal es el **valor de Shapley**, de la teoría de juegos cooperativos. En cristiano:

- Cada contacto es un «jugador» de un equipo que produjo la venta.
- Se miran *todos* los recorridos, los que convierten y los que no.
- Para un contacto dado, se comparan las tasas de conversión de los recorridos que lo tuvieron contra recorridos parecidos que no, en todas las combinaciones posibles de los demás contactos.
- El crédito del contacto es su **aporte marginal promedio** a la probabilidad de convertir.

Si los recorridos con remarketing convierten bastante más que recorridos idénticos sin él, el remarketing se gana crédito real. Si agregar un canal no cambia nada, gana casi cero, aunque aparezca en todos los recorridos.

**Cuándo vale la pena:**
- Hay **volumen**: los contrafactuales necesitan suficientes conversiones para ser estables. Google lo condicionó históricamente a ~3.000 interacciones y ~300 conversiones en 30 días; los mínimos duros ya no existen y es el modelo por defecto, pero Google sigue recomendando unas **200 conversiones y 2.000 interacciones** en 30 días para que sea de calidad. Por debajo se parece mucho al último clic. En Google/GA4 con poco volumen: último clic (o aceptar el ruido). Con datos propios: basado en posición, o primer y último contacto lado a lado.
- Los recorridos son **sobre todo digitales y rastreados**: Shapley solo pesa los contactos que recibió. Ferias, boca a boca, mostrador y contactos con cookies perdidas le son invisibles, así que un negocio con mucho boca a boca recibirá un modelo por datos con mucha seguridad y mal. Combínalo con la pregunta al cliente.

**Sus límites honestos:**
- **Caja negra:** no puedes explicarle fácilmente a un dueño por qué LinkedIn recibió el 23 %. «Lo dice el modelo» es un argumento débil para mover presupuesto.
- **Correlación, no causalidad:** modela lo que *coincide* con la conversión, no lo que la *causa*. Por eso existe la incrementalidad (ver `paradigmas-de-medicion`): para validar lo que afirma.
- **Basura entra, basura sale:** hereda todos los puntos ciegos del seguimiento. Si la mitad de los recorridos es «directo», el modelo reparte crédito con confianza sobre datos a medio ver.

## Elegir: una guía corta

- **Ciclo corto, pocos contactos, poco volumen** → último no directo, más una pregunta al cliente. No modeles de más.
- **Ciclo largo, momentos claros de «se creó» y «se cerró»** → basado en posición como principal sobre tus propios datos, con primer y último contacto al lado. (No es una opción del menú de Google Ads.)
- **Mucho volumen, mayormente digital, hace falta repartir a diario** → basado en datos, validado periódicamente con incrementalidad.
- **Fuera de línea y mucha marca, con presupuesto real** → no confíes en un modelo por persona; MMM + incrementalidad (ver `paradigmas-de-medicion`).

En todos los casos: **elige un modelo, mantente consistente y acompáñalo de una verificación fuera del modelo.** Cambiar de modelo para que un canal se vea bien es la forma más rápida de perder la confianza en todo el programa de atribución.
