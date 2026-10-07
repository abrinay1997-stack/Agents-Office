# Atribución según el tipo de negocio

Los valores por defecto de la atribución cambian mucho con el modelo de negocio. La misma pregunta, «¿qué canal genera ingresos?», pide otra fuente de verdad, otro modelo y otro paradigma según la duración del ciclo, cuántas personas intervienen y a dónde va el presupuesto. Hay tres guías: ciclo largo con venta asistida (B2B y servicios de alto valor), tienda en línea o marca directa, y negocio local o de servicios con cita. Haz coincidir el negocio del dueño con una (o mezcla, para quien vende en autoservicio y también con venta asistida).

---

## Ciclo largo con venta asistida (B2B, software de empresa, agencia, constructora, servicios de alto valor)

**La forma del problema:** los recorridos duran semanas o meses, involucran a varias personas (quien propone, quien decide el presupuesto, quienes lo usan) e incluyen contactos que nunca aparecen en la analítica web: una conversación en una feria, una llamada de ventas, la mención en un grupo de WhatsApp o de Slack, una recomendación entre colegas. Los montos son altos y el volumen bajo, así que cada venta importa y los promedios son ruidosos.

**Por qué los modelos de un solo contacto engañan mucho aquí:** con 15 contactos en 3 meses entre 4 personas, «último contacto = directo» y «primer contacto = un anuncio» son casi inútiles. El medio, y lo fuera de línea, es donde en realidad se ganó la venta.

### La guía

1. **Fuente de verdad = el CRM** (o el libro de ventas), no una herramienta de analítica. Los ingresos son reales en el CRM (venta cerrada, valor del contrato); todo lo demás explica de dónde salieron. La atribución de embudo e ingresos vive en `operaciones-ingresos`: la atribución le da la dimensión de «origen».
2. **Modelos: primer contacto + basado en posición, juntos.** El primer contacto valora la creación de demanda (qué canal *empezó* las cuentas que se volvieron embudo). El de posición acredita los extremos, «se creó» y «se cerró», las dos decisiones que de verdad tomas. El último contacto solo desfinanciará tu parte alta: no abras con él.
3. **La atribución declarada por el cliente es tu señal más fuerte, no un adorno.** Pregunta «¿cómo supiste de nosotros por primera vez?» en el **formulario de solicitud de cotización o demostración** y de nuevo, de forma cualitativa, en las llamadas de ventas. En el B2B con mucho boca a boca y tráfico privado, atrapa lo que el seguimiento no puede (podcasts, comunidades, «un excompañero de trabajo los usa»). Dale mucho peso.
4. **Atribuye a las etapas del embudo, no solo a la conversión.** La pregunta útil no es «¿qué llenó el formulario?» sino «¿qué generó *embudo calificado* y *ventas cerradas*?». Desglosa de prospecto a oportunidad a venta cerrada por canal de primer contacto: un canal que llena formularios pero nunca cierra es una trampa. (La mecánica de etapas, en `operaciones-ingresos`.)
5. **El MTA es lo más débil aquí; la incrementalidad es incómoda pero valiosa.** El poco volumen hace poco fiable al modelo por datos y difíciles las pruebas por zonas. Usa **pruebas de apagar y prender** en los programas grandes (apaga un canal un trimestre y mira el embudo) y apóyate en la atribución declarada y el primer contacto para el resto.
6. **A nivel de cuenta, no solo del prospecto.** La atribución debe resumir los contactos a la *cuenta* (todas las personas de la empresa compradora), o acreditarás a quien llenó el formulario. En la práctica, una organización son varias personas que se registran con **correos mixtos de trabajo y personales**, así que la atribución por persona dispersa la historia en varios registros: une los contactos a la cuenta (dominio del correo, enriquecimiento o el vínculo contacto→cuenta del CRM) y atribuye a nivel de **cuenta**. Ahí tiene que aterrizar la señal para servirle a quien trabaja todo el comité de compra. Excluye de la coincidencia por dominio los correos gratuitos (Gmail, Yahoo, Outlook): no identifican a una empresa; para esos, recurre al enriquecimiento o a la unión manual. *(Énfasis de producción de Tessa Kriesel; la mecánica de sincronizar con el CRM está en `seguimiento-propio`, paso 5.)*

**Herramientas (si la empresa las tiene):** un CRM (HubSpot, Salesforce u otro) como verdad; una herramienta de analítica de producto que identifique por ID de usuario o de cuenta para el primer contacto propio (ver `seguimiento-propio`); campos de atribución declarada escritos en el CRM; una herramienta de desanonimización de visitas para atrapar visitas de cuentas que no llenaron formulario (revisa la ley de privacidad de tu país antes de usarla). Si no hay nada de esto, una hoja de cálculo con «origen declarado» por cada oportunidad ya es un gran paso.

**La trampa del ciclo largo que debes nombrar:** la búsqueda de marca y el directo parecerán tus «mejores canales» porque ahí convierten los compradores que ya investigaron. No son canales: son donde se cobra la demanda *creada en otro lado*. Separa búsqueda de marca y no marca, y toma una gran proporción de directo como evidencia de que tu parte alta funciona, no como un canal en el que invertir.

---

## Tienda en línea o marca directa al consumidor (ciclo corto, autoservicio)

**La forma del problema:** los recorridos son rápidos (de minutos a unos días), de alto volumen y casi totalmente digitales y de autoservicio. El presupuesto se concentra en redes de pago, búsqueda de pago y correo, SMS o WhatsApp. La conversión es una compra que controlas por completo (tu carrito o uno alojado). La mentira dominante es la **sobreatribución de las plataformas**: Meta y Google reclamando las mismas ventas.

### La guía

1. **Fuente de verdad = tu tienda o tu sistema de cobro** (Shopify, WooCommerce, tu pasarela de pagos): el conteo de pedidos reales. Las conversiones que reportan las plataformas se desduplican *contra* ese total; nunca lo definen ni se suman.
2. **Desconfía por defecto del ROAS de la plataforma.** Tras el aviso de rastreo de iOS, las plataformas modelan y estiman conversiones, cuentan las vistas y usan ventanas generosas: el ROAS reportado queda muy por encima del ROAS incremental. Úsalo para optimizar *dentro* de la plataforma (le sirve al algoritmo), no como verdad del presupuesto entre canales.
3. **El último contacto es defendible para productos de compra por impulso y rápida:** el clic de cierre de verdad es casi toda la historia de una compra impulsiva barata. Se vuelve peligroso cuanto más larga es la consideración (ticket alto, compras meditadas): sobreacredita el remarketing y la búsqueda de marca.
4. **MMM cuando la inversión sea material.** Si gastas dinero real entre redes de pago, búsqueda y fuera de línea (podcasts, radio, televisión, influencers, publicidad exterior), el MMM es la forma de repartir: es el único paradigma que ve los canales no rastreables y las curvas de saturación. Con una inversión combinada baja (como regla de orientación, de seis cifras al mes hacia abajo, en la moneda de la empresa), el MMM es excesivo; buenos UTM y una encuesta rinden más.
5. **Incrementalidad en tus canales más grandes, sobre todo los «siempre acreditados».** Los grupos de control por zonas y las pruebas de apagar y prender se pagan solas en el remarketing, la búsqueda de marca y la prospección en Meta, que el reporte de las plataformas favorece más. El CPA incremental (inversión ÷ pedidos *incrementales*) es el número que debe mover el presupuesto. (Ver `paradigmas-de-medicion`.)
6. **Encuesta después de la compra** para atrapar el tráfico privado y la demanda de marca. Una pregunta de «¿cómo supiste de nosotros?» en la página de confirmación del pedido revela de forma consistente que los podcasts, el TikTok orgánico y el boca a boca mueven mucho más de lo que acreditan los píxeles, porque esos contactos convierten después como «directo» o búsqueda de marca. Las marcas directas al consumidor la tienen como práctica estándar por eso.

**Herramientas (si la empresa las tiene):** la tienda o el sistema de cobro como verdad; píxeles y API de conversiones para optimizar (la configuración está en `campanas-pagadas`); alguna forma de juntar en un solo lugar las cifras de las plataformas para desduplicarlas (aunque sea una hoja de cálculo); una encuesta posterior a la compra; herramientas de MMM (Robyn, Meridian o un proveedor) cuando la inversión lo justifique.

**La trampa de la tienda en línea que debes nombrar:** sumar las conversiones reportadas por las plataformas. Si Meta reclama 100 y Google 80, pero hubo 120 pedidos, **no** tienes 180 conversiones: tienes 120 con reclamos que se solapan. Ancla en los 120 y reparte lo que se solapa con incrementalidad, no creyéndole a la plataforma que más grita.

---

## Negocio local o de servicios con cita (clínica, consultorio, taller, restaurante, ferretería, salón, gimnasio, escuela)

Esta guía no viene del original; es la adaptación de la oficina para quien vende más fuera de la pantalla que dentro.

**La forma del problema:** la conversión casi nunca termina en el sitio web: es una llamada, un mensaje de WhatsApp, una reservación o una visita al local. Los volúmenes son pequeños y las decisiones de presupuesto, modestas. Casi nada se rastrea de forma automática; mucho llega por recomendación, por Google Maps o por pasar frente al local.

### La guía

1. **Fuente de verdad = la agenda, el libro de ventas o la caja.** Ahí está lo que de verdad pasó.
2. **La pregunta «¿cómo nos conociste?» es la herramienta principal.** Que quien atiende (teléfono, mostrador, WhatsApp) la haga en el primer contacto, siempre, y la anote en un campo fijo (con una lista corta: recomendación, Google, Instagram, Facebook, pasé por el local, volante, otro). Sin esta anotación no hay atribución posible; con ella, una hoja de cálculo basta.
3. **Un número o un código por canal** donde sea posible: un número de teléfono o de WhatsApp distinto por campaña, un cupón o código («di la palabra X y tienes…») por canal, un enlace corto distinto por publicación. Son rastros baratos que sobreviven fuera de línea.
4. **Lee Google Maps y el perfil de negocio como un canal:** llamadas, mensajes y solicitudes de ruta que reporte la ficha del negocio (si la empresa tiene acceso). La reputación (reseñas) pesa tanto como el anuncio.
5. **Un modelo sofisticado sobra.** Un conteo mensual por origen declarado, comparado contra lo gastado en cada canal, ya da decisiones. Para una duda grande («¿el anuncio en Meta sirve?»), una **prueba de apagar y prender** de 4 a 6 semanas es lo más práctico: apágalo y mira la agenda.
6. **Cuidado con el derrame:** lo que uno hace en redes ayuda a la búsqueda en Google y al boca a boca; no esperes que cada peso se rastree uno por uno.

**La trampa del negocio local que debes nombrar:** atribuir todo a «Google» o a «Instagram» porque es lo que se puede ver, cuando la mayoría de los clientes llegó por recomendación y solo buscó el nombre antes de llamar.

---

## Mixto: autoservicio y venta asistida a la vez

Muchos negocios hacen las dos cosas: ventas de autoservicio (compra o registro en línea) *y* un movimiento de venta asistida para cuentas o pedidos grandes (software con ventas, distribuidoras, agencias con paquetes). Mezcla las guías:

- Usa el **enfoque de tienda en línea para el embudo de autoservicio** (rápido, de alto volumen, primer contacto propio → conversión, último no directo defendible + encuesta).
- Usa el **enfoque de ciclo largo para el embudo de venta asistida** (CRM como verdad, posición, atribución por etapa, declarada en la cotización).
- **Enlaza las identidades entre los dos**, para que quien se registra solo y luego se vuelve una ampliación con ventas conserve un solo recorrido (alias entre correo e ID al registrarse; ver `seguimiento-propio`).
- Reporta los dos **por separado.** Mezclar un registro de autoservicio pequeño y una venta empresarial grande en un solo número de «atribución» esconde las dos historias.
