# Cumplimiento en la prospección

Las restricciones legales y de condiciones de las plataformas que aplican al armado de listas de prospectos. Léelas primero, en cada encargo.

> Orientación operativa, no asesoría legal. Para programas de mucho volumen o que alcancen a residentes de la Unión Europea o el Reino Unido, consulta con una persona abogada de protección de datos. Las leyes de cada país cambian: lo de abajo son ejemplos, y la ley que manda es la del país de la empresa y la del país del prospecto.

---

## Estados Unidos: CAN-SPAM (en el envío posterior)

CAN-SPAM regula el **envío** del correo en frío, no el armado de la lista. Pero el armado importa porque:
- Debes poder identificar la fuente de cada dirección que contactas (si te lo piden).
- Las reglas sobre el remitente y el contenido aplican al enviar, pero no puedes mentir sobre cómo conseguiste el contacto.
- Las bajas se respetan en un máximo de 10 días hábiles y se registran.

**Para la prospección en concreto:** guarda la dirección de la fuente y la fecha de cada contacto que añadas a una lista. CAN-SPAM no lo exige de forma explícita, pero defender tus prácticas de envío depende de ello.

---

## Unión Europea y Reino Unido: RGPD (GDPR)

El marco más estricto que puede aplicar. Se activa cuando:
- tu prospecto reside en la UE o el Reino Unido;
- tratas datos personales (cualquier dato que identifique, incluido un correo de trabajo ligado a una persona con nombre).

### Bases legales para el contacto B2B en frío

Hay tres opciones creíbles:

1. **Interés legítimo** (la más común en B2B). Exige:
   - que la persona tenga un puesto de negocio al que probablemente le interese la oferta;
   - que el dato se haya tomado de una fuente pública y de contexto de negocio;
   - que des una forma clara de decir que no;
   - que puedas explicar por escrito la prueba del interés legítimo.

2. **Consentimiento:** normalmente no es viable para el contacto en frío (no lo tienes antes del primer contacto).

3. **Relación previa como cliente:** solo aplica a clientes actuales, no a prospectos.

### Lo que debes hacer
- Guardar **fuente + fecha + base legal** de cada contacto.
- Atender las solicitudes de acceso de las personas: poder informar, corregir o borrar lo que tengas cuando lo pidan.
- Incluir un aviso de privacidad y una forma de darse de baja en el primer mensaje.
- No guardar datos personales más tiempo del necesario para el interés legítimo.

### Lo que descalifica una lista
- Datos de LinkedIn extraídos en masa: viola las condiciones de la plataforma y aumenta el riesgo del RGPD.
- Direcciones compradas a un vendedor de listas sin origen demostrable.
- Correos adivinados del tipo «cualquiera @ este dominio» que se envían sin verificar (multiplica el riesgo y los rebotes).

---

## Canadá: CASL

Más estricta que CAN-SPAM. El contacto B2B en frío exige:
- **consentimiento expreso** (aceptación explícita), que normalmente no existe en la prospección en frío;
- **o consentimiento implícito:** una relación comercial en los últimos 24 meses, o la dirección de trabajo publicada en la web de la propia empresa con el fin de recibir ese tipo de mensajes.

**Consecuencia práctica con prospectos canadienses:** apoyarse en la excepción de la dirección publicada es la base más defendible. Cada mensaje debe llevar identificación del remitente, dirección postal y un mecanismo para darse de baja.

---

## América Latina: ejemplos de leyes de protección de datos

Casi todos los países de la región tienen una ley de protección de datos personales, y varias se parecen al RGPD en que exigen una base para tratar los datos, información al titular y derechos de acceso, corrección y borrado. Algunos ejemplos (verifica el texto vigente y consulta a quien sepa del tema en tu país):
- **Brasil:** Ley General de Protección de Datos (LGPD).
- **México:** Ley Federal de Protección de Datos Personales en Posesión de los Particulares.
- **Colombia:** Ley 1581 de 2012 y sus normas complementarias.
- **Argentina:** Ley 25.326 de Protección de los Datos Personales.
- **Chile:** la ley de protección de datos personales y sus actualizaciones recientes.
- **Panamá:** Ley 81 de 2019 sobre protección de datos personales.

**Qué hacer en la práctica:** aplica el mismo mínimo que con el RGPD (fuente, fecha, base, forma de darse de baja, no guardar de más) y, ante la duda sobre un país, **excluye el contacto** y déjalo marcado para que el dueño decida. Esta guía no dice que algo sea legal en un país concreto; solo dice qué registrar para poder defenderlo.

---

## Condiciones de las plataformas

### LinkedIn
- **Sales Navigator** como herramienta de investigación: bien.
- **Extraer datos de LinkedIn a cualquier escala:** violación expresa de sus condiciones. Las cuentas bloqueadas lo quedan para siempre. No.
- **Apollo, Clay y ZoomInfo** dicen tener datos que se solapan con LinkedIn por vías legítimas: verifica de dónde vienen sus datos antes de dar por hecho que cumplen.
- **InMail y solicitudes de conexión:** los rigen las propias normas de mensajes de LinkedIn, no CAN-SPAM ni el RGPD (porque son internos de la plataforma). Aun así, aquí nadie los envía sin el OK del dueño.

### Google Maps
- Sus condiciones prohíben la extracción masiva o convertir los datos de Maps en un producto.
- La investigación asistida en el navegador como ayuda para descubrir: aceptable.
- Guardar identificadores de lugar o grandes cantidades de datos estructurados de Maps en tu CRM: prohibido de forma expresa.
- Usa Maps para **encontrar** negocios locales y luego toma de la web del propio negocio los datos que vas a conservar.

### Apollo / ZoomInfo / Clearbit
- Cada uno tiene sus condiciones que limitan la reventa, el uso compartido y los usos permitidos.
- Lee tu contrato: normalmente puedes usar los datos para tu propio contacto, pero no convertirlos en un producto.
- No compartas extractos en público (por ejemplo, en un ranking o un informe público).

### Crunchbase
- El plan gratuito es solo de lectura para uso personal.
- El plan de pago permite un uso más amplio dentro del alcance del contrato.
- El acceso por API exige un plan de pago superior.

---

## Antipatrones (no los hagas)

1. **Extracción masiva de LinkedIn, Google Maps o Yelp.** La investigación asistida en el navegador está bien; los extractores automáticos dirigidos a esas plataformas, no. **Leer la web propia de un prospecto concreto** (la dirección que encontraste con el descubrimiento manual) está bien; apuntar a las plataformas que alojan prospectos, no.
2. **Comprar listas a vendedores desconocidos** sin origen demostrable. Heredas su exposición legal.
3. **Adivinar correos y enviarlos sin verificar.** Una tasa de rebote superior al 2 % destruye la reputación del remitente; y legalmente no puedes alegar «interés legítimo» sobre un correo que fabricaste.
4. **Recolectar correos personales** (Gmail, Outlook personal, etc.) de perfiles públicos. Las direcciones personales elevan mucho el riesgo con el RGPD y las leyes locales.
5. **Guardar datos que no necesitas.** Minimiza la conservación. No conserves listas de prospectos para siempre: el derecho al borrado aplica.
6. **Saltarte la documentación de la base legal.** Si te cuestionan, hay que poder mostrar el trabajo. Guarda la dirección de la fuente y la fecha de recolección de cada contacto.
7. **Revender listas de prospectos.** Puede que no tengas derecho a compartirlas. Lee los contratos de tus proveedores de datos.
8. **Saltarte CAPTCHAs o muros de inicio de sesión.** Aunque sea posible técnicamente, delata comportamiento de bot y viola prácticamente todas las condiciones.

---

## Lista de revisión rápida

Antes de entregar una lista al dueño (o pasarla a `correo-en-frio`):

- [ ] Cada contacto tiene dirección de la fuente y fecha de recolección.
- [ ] Ningún contacto viene de datos extraídos de LinkedIn.
- [ ] No se guardan identificadores de lugar de Google Maps ni datos estructurados de Maps en gran cantidad.
- [ ] La base legal está documentada (la prueba del interés legítimo en B2B, o la alternativa que corresponda; la ley del país del prospecto).
- [ ] Los correos están validados (comprobación de entrega antes del contacto).
- [ ] Las direcciones personales (Gmail, etc.) están marcadas o excluidas.
- [ ] Los contratos de los proveedores de datos permiten el uso previsto.
- [ ] Hay un plan de conservación (cuándo borrar).
- [ ] El primer mensaje llevará forma de darse de baja y aviso de privacidad (es asunto de `correo-en-frio`, pero menciónalo desde ahora).
- [ ] Nadie ha contactado a nadie: los mensajes quedan como borradores para el OK del dueño.
