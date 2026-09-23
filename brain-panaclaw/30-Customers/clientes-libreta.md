# La libreta de clientes y el historial de propuestas

Vive en el hub interno de PanaClaw (el cotizador del equipo, detrás de Cloudflare Access). No es el CRM de eBot: eso es otro sistema (CRM-PANACLAW).

Estados de un cliente: prospecto · cliente activo · inactivo.
Estados de una propuesta: emitida · aceptada · perdida. Numeración PROP-AAAA-NNNN, la asigna el servidor al emitir.
Ficha: negocio, RUC o cédula (empresa o persona), contacto, cargo, WhatsApp, teléfono, correo, ciudad, dirección, asesor, notas.

Cómo se reconoce a un cliente (gana el primer peldaño): 1) RUC o cédula (único que une solo); 2) documento casi igual; 3) WhatsApp por los 8 dígitos nacionales (el que más trabaja: casi todo entra por WhatsApp); 4) correo; 5) nombre del negocio. Del 2 al 5 se pregunta antes de unir: dos negocios pueden llamarse igual.

Reglas: la ficha manda, la propuesta toma prestado. Borrar un cliente no borra sus propuestas; se borra en dos tiempos (papelera y definitivo).
Las sumas del historial son dos: lo de una vez y lo de cada mes. Nunca una sola.
El cotizador interno no factura, no cobra, no manda correos y no inventa planes.

Cotizador público del sitio (panaclaw.com/cotizador/): cuatro preguntas, da la cifra antes de pedir datos, recomienda el plan más pequeño que cubre lo marcado y termina en un WhatsApp redactado.

Fuente: PanaClaw-WorkSpace/cotizador/README.md · compartido/clientes.ts
