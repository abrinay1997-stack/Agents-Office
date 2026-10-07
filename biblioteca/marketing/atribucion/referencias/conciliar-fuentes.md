# Conciliar fuentes, atribución declarada y puntos ciegos

El detalle de tres partes del Pilar A: la pregunta al cliente, cómo conciliar cifras que se contradicen y dónde se esconden las conversiones. Léelo cuando las cifras de las herramientas no coincidan o cuando el dueño pregunte por qué «directo» es tan grande.

## Atribución declarada por el cliente

La señal más desaprovechada y, a menudo, la más honesta para ciclos largos y para el tráfico privado. Una pregunta posterior a la conversión («¿cómo supiste de nosotros?») atrapa lo que el seguimiento no puede ver por construcción: un podcast, el boca a boca, un grupo de WhatsApp o de Slack, el mensaje de un fundador, «me lo dijo un amigo».

- **Cuándo supera al seguimiento:** consideración larga, mucho boca a boca, marcas comunitarias o mucho tráfico privado. Si una parte grande de los recorridos aparece como «directo», tienes un hueco con forma de pregunta al cliente.
- **Pregunta en el momento de la conversión** (registro, primera compra, solicitud de cita o cotización): es cuando mejor se recuerda, antes de que la memoria se desvanezca. En un negocio con mostrador, consultorio o teléfono, que quien atiende lo pregunte y lo anote en un campo fijo.
- **Redacción:** la pregunta abierta («¿cómo supiste de nosotros por primera vez?») captura el tráfico privado; una lista corta es más fácil de cuantificar pero sesga la respuesta. Lo mejor: una lista de tus canales conocidos **más un «otro / cuéntanos más»** de texto libre.
- **Úsala como insumo de triangulación, no como evangelio:** el recuerdo es borroso y la gente acredita el contacto *memorable*, no el primero. **Descuenta el peso de la encuesta al convertirla en crédito** (que el 22 % recuerde YouTube es evidencia de notoriedad, no una afirmación de que YouTube merezca el 22 % de las conversiones). Combínala con incrementalidad o con las diferencias entre plataformas antes de escribir una regla de reparto.
- Del lado de construcción, esto es un campo de formulario guardado en el CRM o en la analítica como propiedad de la persona (ver `seguimiento-propio`).

## Conciliar fuentes que se contradicen

El pedido detrás de la mayoría de estos trabajos: **«Google dice 50, Meta dice 40, la analítica dice 60 y mi CRM dice 35: ¿quién tiene razón?»** Ninguno. Este es el marco.

**Por qué miente cada fuente, siempre en la misma dirección:**

| Fuente | Se inclina hacia | Porque |
|---|---|---|
| **Plataformas de anuncios** (Google/Meta/LinkedIn/TikTok) | Contarse *a sí misma* de más | Reclama conversiones por vista y por clic dentro de su propia ventana; cada plataforma cuenta la misma venta; le conviene verse bien |
| **Analítica web (GA)** | El último clic no directo | Pierde los cambios de aparato, pierde a quien bloquea cookies y manda lo desconocido a «directo» |
| **CRM o libro de ventas** | Lo que escribió la persona o capturó el formulario | Captura humana, sobreescritura del origen del prospecto, ventas fuera de línea sin rastro digital |
| **Pregunta al cliente** | El contacto *memorable* | Sesgo de recuerdo; subcuenta contactos aburridos pero reales, como el remarketing |

**Cómo triangular:**
1. **Elige una sola fuente de verdad para el conteo de ventas:** normalmente el CRM, el sistema de la tienda o el libro de ventas, donde el dinero es real. Todo lo demás explica *de dónde vinieron*; no redefine *cuántas hubo*.
2. **Nunca sumes entre plataformas.** Si Google y Meta reclaman la misma conversión, tienes una conversión con dos reclamantes, no dos conversiones. Quita duplicados contra el total de la fuente de verdad.
3. **Lee el acuerdo en dirección, no la coincidencia absoluta.** Si todas las fuentes dicen que la búsqueda de pago subió y la orgánica bajó este trimestre, esa tendencia es confiable aunque ningún par de números coincida.
4. **Usa la pregunta al cliente como desempate** cuando las plataformas se pelean por las mismas conversiones, y la **incrementalidad** cuando lo que está en juego lo justifica. **No** conviertas la brecha entre plataforma y analítica en un multiplicador (que Meta reclame el doble que la analítica no significa «dividir Meta a la mitad»): investiga las ventanas y las vistas, y fundamenta cualquier ajuste en incrementalidad.
5. **Espera la brecha y presupuéstala.** Reporta: «las plataformas reclaman N; podemos verificar M; la diferencia es sobreconteo + vistas + lo no rastreado; este es nuestro mejor reparto».
6. **Convierte la triangulación en reglas cuando puedas.** Cuando ya tengas un grupo de control o una banda confiable de la pregunta al cliente para un canal, aplica una **corrección documentada por canal** en el reporte (trasladar crédito de «directo» o marca al canal subestimado durante la ventana de la prueba) en vez de fingir que el MTA crudo es la verdad. Detalle en `paradigmas-de-medicion`.

El resultado es un reparto honesto con niveles de confianza, no una conciliación falsa al decimal.

**Ejemplo con la plantilla de reporte:** si Google reclama 50, Meta 40 y la analítica 60, pero el CRM tiene 35 ventas, el reporte dice «35 ventas reales; las plataformas reclaman 150 en conjunto (no se suman); la mayor parte del solapamiento está entre Google y Meta». No intentes que 150 se reduzca a 35 canal por canal sin evidencia: reparte con niveles de confianza y propón la prueba que desempataría.

## Los puntos ciegos

Dónde se esconden las conversiones y hacen que canales reales parezcan débiles:

- **Directo:** el cajón de sastre. Favoritos y direcciones escritas, sí, pero también referencias borradas, de aplicación a web, redes privadas y cualquier contacto que tu seguimiento perdió. Una gran proporción de directo es un problema de *medición*, no un canal.
- **Búsqueda de marca:** gente que te descubrió en otro lado y luego buscó tu nombre. El último contacto le da el crédito a la búsqueda de marca (de pago u orgánica); el verdadero motor fue lo que los hizo buscar. Sepárala de la búsqueda sin marca o desfinanciarás la parte alta del embudo.
- **Tráfico privado («dark social»):** compartir sin referencia: mensajes directos, WhatsApp, grupos de Telegram, Slack o Discord, podcasts, boletines, capturas de pantalla. Es estructuralmente invisible al seguimiento; solo la pregunta al cliente lo ve. En Latinoamérica, WhatsApp suele ser el canal privado más grande.
- **Tráfico de IA:** los asistentes y los buscadores de IA influyen cada vez más en los compradores y luego los mandan por búsqueda de marca o directo, así que el contacto de IA es invisible en la analítica. Nómbralo y pasa el trabajo de fondo a `seo-para-ia`.
- **Fuera de línea:** la recomendación en el mostrador, el cartel, la feria, la llamada, la vitrina. En un negocio local puede ser la mayor parte.

El hilo conductor: **cuando «directo» y «búsqueda de marca» dominan, tu parte alta del embudo está funcionando y tu atribución lo está escondiendo.** Dilo explícitamente: es el error de lectura más común del marketing.
