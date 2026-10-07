# Recetas de automatización

Recetas por plataforma para HubSpot, Salesforce, herramientas de agenda y automatización entre herramientas. El agente no las configura: las entrega como especificación para que el dueño (o quien él diga) las active. Úsalas solo si la empresa tiene esa herramienta; si usa otra (Pipedrive, Zoho, Kommo, Make, n8n…), traduce la receta a su equivalente.

## Recetas de HubSpot

### 1. Aviso y asignación de MQL

**Nombre:** Aviso de MQL y creación de tarea
**Disparador:** la propiedad «Etapa del ciclo de vida» cambia a «MQL»
**Acciones:**
1. Rotar el propietario entre el equipo de ventas.
2. Correo interno al propietario con el contexto del prospecto.
3. Tarea: «Dar seguimiento a [nombre]» — vence en 4 horas.
4. Aviso en el canal de ventas (Slack, Teams o el grupo interno que usen).
5. Inscribir en la secuencia «Seguimiento de MQL» (si usan secuencias).
**Resultado:** cada MQL queda asignado al instante con un SLA claro.
**Notas:** excluir a los prospectos que ya tienen propietario.

---

### 2. Escalamiento del SLA de MQL

**Nombre:** Alerta de incumplimiento del SLA
**Disparador:** «Etapa» igual a «MQL» Y «Días desde el último contacto» mayor a 0,5 (12 horas)
**Acciones:**
1. Correo interno al propietario: «Atención: no se ha contactado a [nombre]».
2. Si a las 24 horas sigue sin actividad → aviso al jefe de ventas.
3. Si a las 48 horas sigue sin actividad → reasignar por rotación.
4. Tarea para el nuevo propietario: «Urgente: contactar a [nombre] — reasignado por SLA».
**Resultado:** ningún MQL queda más de 48 horas sin atender.
**Notas:** excluir contactos cuya última actividad es una llamada o reunión.

---

### 3. Actualizar la puntuación y promover a MQL

**Nombre:** MQL automático al llegar al umbral
**Disparador:** la puntuación del contacto es mayor o igual a 65
**Acciones:**
1. Poner la etapa en «MQL».
2. Guardar «Fecha de MQL» = hoy.
3. Sacarlo de los flujos de nutrición de marketing.
4. Disparar la receta 1.
**Resultado:** los prospectos pasan solos a MQL al llegar al umbral.
**Notas:** lista de exclusión para clientes actuales y competidores.

---

### 4. Aviso de reunión agendada

**Nombre:** Aviso de reunión al vendedor
**Disparador:** se registra una reunión para el contacto (por la herramienta de agenda)
**Acciones:**
1. Correo interno al propietario con los detalles.
2. Actualizar «Última reunión agendada» = hoy.
3. Si la etapa es «Prospecto» → pasarla a «MQL».
4. Tarea: «Preparar la reunión con [nombre]» — 1 hora antes.
5. Aviso en el canal de reuniones.
**Resultado:** el vendedor llega preparado a cada reunión.
**Notas:** incluir en el aviso las páginas vistas y descargas recientes.

---

### 5. Traspaso a atención al ganar

**Nombre:** Arranque de cliente
**Disparador:** la etapa del negocio cambia a «Ganado»
**Acciones:**
1. Pasar a «Cliente» la etapa de los contactos asociados.
2. Guardar «Cliente desde» = hoy.
3. Asignar responsable de atención (por segmento o territorio).
4. Tarea para atención: «Agendar arranque con [empresa]» — en 2 días hábiles.
5. Inscribir en la secuencia de bienvenida.
6. Aviso interno al jefe de atención.
7. Sacar de todas las secuencias de ventas.
**Resultado:** traspaso sin fricción de ventas a atención.
**Notas:** incluir notas del negocio, valor del contrato y personas clave.

---

### 6. Alerta de negocio estancado

**Nombre:** Higiene del embudo — negocios estancados
**Disparador:** «Días en la etapa actual» mayor al doble del promedio de esa etapa
**Acciones:**
1. Correo al dueño del negocio: «[Negocio] lleva [X] días en [etapa]».
2. Tarea: «Actualizar o cerrar [negocio]» — en 3 días hábiles.
3. Si a los 7 días no hay cambios → aviso al jefe de ventas.
4. Sumarlo a la lista «Negocios estancados» del tablero.
**Resultado:** el embudo se mantiene limpio y la previsión es fiable.
**Notas:** umbral por etapa (Diagnóstico: 14 días, Propuesta: 10, Negociación: 21).

---

### 7. Reciclaje a nutrición

**Nombre:** Reciclaje de MQL rechazados
**Disparador:** la propiedad «Motivo de rechazo de ventas» tiene cualquier valor
**Acciones:**
1. Etapa = «Reciclado».
2. Poner la puntuación de interés en la base (conservar la de encaje).
3. Inscribir en «Nutrición de reciclados» (menos frecuente).
4. «Fecha de reciclaje» = hoy.
5. Permitir reinscripción: si vuelve a superar el umbral, se dispara de nuevo el flujo de MQL.
**Resultado:** los rechazados tienen otra oportunidad sin atascar el embudo.
**Notas:** medir aparte la conversión de reciclado a MQL.

---

### 8. Resumen diario de actividad

**Nombre:** Resumen diario de prospectos
**Disparador:** programado, todos los días a las 8:00 hora local
**Acciones:**
1. Filtrar contactos en «SQL» u «Oportunidad» con actividad en la web en las últimas 24 horas.
2. Correo a cada propietario con la actividad de sus prospectos.
3. Incluir páginas vistas, descargas, correos abiertos y clics.
**Resultado:** cada vendedor empieza el día sabiendo quién está activo.
**Notas:** solo actividad con sentido (sin visitas sueltas a la portada).

En la oficina, este resumen puede ser una **rutina** diaria de Ventas (por ejemplo `ilm` o `folo`, días hábiles a las 8:00, que solo lee y reporta, sin esperar OK) si la empresa tiene el CRM conectado.

---

## Equivalentes en Salesforce (Flow)

### 1. Aviso y asignación de MQL

**Tipo:** Flow disparado por registro · **Objeto:** prospecto
**Disparador:** «Estado» cambia a «MQL»
**Pasos:**
1. Obtener registros: consultar el objeto «Asignación de vendedores» para el siguiente disponible.
2. Actualizar registros: poner al vendedor como propietario.
3. Crear registros: tarea «Contactar MQL: {nombre}» con vencimiento = ahora + 4 horas.
4. Acción: correo de aviso al nuevo propietario.
5. Actualizar registros: guardar la hora de la última asignación.
**Notas:** el objeto a medida «Asignación de vendedores» guarda el estado de la rotación.

### 2. Escalamiento del SLA

**Tipo:** Flow programado · **Frecuencia:** cada 4 horas en horario hábil
**Pasos:**
1. Obtener registros: prospectos con estado «MQL» y última actividad anterior a ayer.
2. Decisión: ¿más de 48 horas sin actividad?
   - SÍ → reasignar, tarea urgente, aviso al jefe.
   - NO → recordatorio al propietario actual.
**Notas:** combinar con avisos en tiempo real en la asignación inicial.

### 3. Automatización por etapa del embudo

**Tipo:** Flow disparado por registro · **Objeto:** oportunidad
**Disparador:** cambia la etapa
**Pasos:**
1. Decisión: ¿a qué etapa pasó?
2. Por etapa:
   - **Diagnóstico:** tarea «Completar el cuestionario de diagnóstico».
   - **Demo:** tarea «Preparar el entorno de demo».
   - **Propuesta:** tarea «Enviar propuesta» + aviso a la mesa de aprobación si el ticket supera el umbral de la empresa.
   - **Ganada:** traspaso a atención (caso, responsable, correo de bienvenida).
   - **Perdida:** tarea «Registrar motivo de pérdida» + sumar al análisis de ganadas y perdidas.

### 4. Detección de negocios estancados

**Tipo:** Flow programado · **Frecuencia:** todos los días a las 7:00
**Pasos:**
1. Obtener oportunidades abiertas con días en la etapa > umbral de esa etapa.
2. Para cada una:
   - Tarea: «Actualizar negocio estancado: {nombre}».
   - Correo al propietario.
   - Si supera el doble del umbral → correo a su jefe.
3. Marcar el campo «Estancado» = verdadero para el tablero.

---

## Herramientas de agenda (Calendly, SavvyCal u otras)

### Rotación de reuniones

**En Calendly:**
1. Crear un tipo de evento de equipo con todos los vendedores habilitados.
2. Reparto: «optimizar para reparto parejo».
3. Disponibilidad: cada vendedor maneja su calendario.
4. Margen: 15 minutos antes y después.
5. Aviso mínimo: 4 horas (evitar reservas de último minuto).

**Integración con el CRM:**
1. La herramienta avisa (webhook) al reservarse.
2. Buscar el correo del invitado en el CRM.
3. Si el contacto existe → asignar la reunión a su propietario (aunque toque otro en la rotación).
4. Si es nuevo → crear prospecto, asignar por reglas, registrar la reunión.
5. Pasar la etapa a MQL (una reunión es alta intención).

### SavvyCal

**Ventajas frente a Calendly:** prioridad de horarios (preferir ciertas franjas); calendarios superpuestos (ver la disponibilidad del equipo en una vista); enlaces personalizados por vendedor.

**Integración:**
1. Enlace de equipo con reglas de prioridad.
2. Aviso al reservar → Zapier/Make → CRM.
3. Buscar o crear el contacto, asignar propietario, crear tarea.
4. Confirmación con material para preparar la reunión.

### Asignar reuniones por criterio

```
Se envía el formulario de reserva
├─ ¿Empresa de más de 500 personas? (campo del formulario)
│  ├─ SÍ → Calendario de vendedores de cuentas grandes
│  └─ NO ↓
├─ ¿Ya es cliente? (consulta al CRM)
│  ├─ SÍ → Calendario de su responsable
│  └─ NO ↓
└─ Rotación entre quienes califican
```

### Cuando el prospecto no se presenta

**Disparador:** pasó la hora de la reunión y no hay notas registradas en 30 minutos
**Acciones:**
1. Esperar 30 minutos tras la hora agendada.
2. ¿Se registró una llamada o reunión?
   - SÍ → nada.
   - NO → mensaje «Sentimos no haber coincidido» al prospecto (como borrador, si lo prepara un agente de la oficina, para el OK).
3. Tarea: «Reagendar con [nombre]» — próximo día hábil.
4. Si falta una segunda vez → marcar el contacto y avisar al jefe.

---

## Automatización entre herramientas (Zapier, Make, n8n)

### 1. Prospecto nuevo → CRM + aviso + tarea

**Disparador:** nuevo formulario (Typeform, HubSpot, la web de la empresa)
**Acciones:**
1. Crear o actualizar el contacto en el CRM.
2. Enriquecer (si hay herramienta).
3. Aviso en el canal de prospectos nuevos con los datos.
4. Tarea en la herramienta de proyectos.

### 2. Reunión agendada → CRM + correo de preparación

**Disparador:** nueva reserva
**Acciones:**
1. Buscar o crear el contacto.
2. Etapa = MQL.
3. Correo de preparación al vendedor (enlace al CRM, perfil público, actividad reciente).
4. Tarea previa a la reunión.

### 3. Venta ganada → arranque del cliente

**Disparador:** el negocio pasa a «Ganado»
**Acciones:**
1. Crear el cliente en la herramienta de atención.
2. Sumarlo a la plantilla de proyecto de arranque.
3. Correo de bienvenida.
4. Canal interno para el cliente.
5. Aviso al equipo de atención.

### 4. Puntuación → sincronizar herramientas

**Disparador:** la puntuación en el CRM supera el umbral de MQL
**Acciones:**
1. Actualizar el estado en la herramienta de marketing.
2. Sumarlo a una audiencia de remarketing (Meta, Google Ads), si las políticas y la ley de datos lo permiten.
3. Disparar la secuencia de quien califica.
4. Registrar el evento en la analítica.

### 5. SLA incumplido → aviso por varios canales

**Disparador:** tarea de seguimiento de MQL vencida
**Acciones:**
1. Mensaje directo al vendedor.
2. Correo al vendedor.
3. Con 2+ horas de retraso → mensaje al jefe.
4. Con 4+ horas → reasignar en el CRM.

### 6. Resumen semanal del embudo

**Disparador:** todos los lunes a las 8:00
**Acciones:**
1. Consultar el resumen del embudo (valor total, negocios nuevos, estancados, cierres esperados).
2. Darle formato.
3. Publicarlo en el canal del equipo de ventas.
4. Enviarlo a la dirección comercial.

En la oficina, este resumen encaja como una **rutina** semanal del jefe de Ventas (`lexi`), si el CRM está conectado: lee y reporta, sin esperar OK. Propónsela al dueño.
