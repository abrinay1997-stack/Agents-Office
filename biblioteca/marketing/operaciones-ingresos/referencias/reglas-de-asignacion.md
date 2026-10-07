# Reglas de asignación de prospectos

Árboles de decisión, configuración por plataforma, territorios, cuentas clave y datos de velocidad de respuesta.

## Árbol de decisión

Plantilla para dibujar la lógica de asignación:

```
Llega un prospecto nuevo
│
├─ ¿Es una cuenta clave o con nombre?
│  ├─ SÍ → Al responsable de esa cuenta
│  └─ NO ↓
│
├─ ¿El ticket probable es grande? (por tamaño + sector; el umbral lo fija la empresa, el original usa 50.000 al año)
│  ├─ SÍ → Al equipo de cuentas grandes
│  └─ NO ↓
│
├─ ¿Es un registro en el producto con uso de equipo?
│  ├─ SÍ → Al especialista en ventas de producto
│  └─ NO ↓
│
├─ ¿Coincide con un territorio?
│  ├─ SÍ → Al responsable del territorio
│  └─ NO ↓
│
└─ Por defecto: rotación entre vendedores disponibles
   └─ Si no hay nadie: a la cola del equipo con SLA de 1 hora
```

Ajusta el árbol a la empresa. El principio: **primero la coincidencia más específica, luego la general.**

Para un negocio pequeño el árbol puede ser de dos ramas: «¿es cliente actual? → a quien lo atiende; si no → a quien está de turno (y si no contesta en 15 min, al dueño)».

---

## Rotación (round-robin)

### Reglas básicas

1. Reparte por igual entre los vendedores habilitados.
2. Salta a quien está de vacaciones, sin capacidad o con el embudo lleno.
3. Pondera por cumplimiento de meta (quien va por debajo recibe algo de prioridad).
4. Reinicia el conteo cada semana o cada mes.
5. Registra cada asignación para revisarla.

### En HubSpot

**Con la herramienta de rotación:**
- Automatización → Flujos de trabajo.
- Disparador: la propiedad «Etapa del ciclo de vida» es igual a «MQL».
- Acción: rotar el propietario del contacto entre usuarios elegidos.
- Opciones: reparto parejo, saltar a quien no está disponible.
- Agregar una espera + creación de tarea después de asignar.

**Rotación a medida con flujos:**
1. Crear una propiedad numérica «Contador de rotación».
2. Disparador: se crea un MQL.
3. Ramas según el valor del contador (0, 1, 2… uno por vendedor).
4. Poner como propietario al vendedor correspondiente.
5. Sumar 1 al contador (volver a 0 al llegar al máximo).
6. Crear tarea de seguimiento con fecha límite del SLA.

### En Salesforce

**Con reglas de asignación de prospectos:**
1. Configuración → Marketing → Reglas de asignación de prospectos.
2. Crear las entradas en orden de prioridad (lo más específico primero).
3. Para rotación: regla de asignación + lógica a medida.

**Con Flow para asignación avanzada:**
1. Flow disparado al crear un prospecto.
2. Obtener registros: consultar un objeto «Cola de vendedores» para ver quién sigue.
3. Decisión: disponibilidad, capacidad, territorio.
4. Actualizar registros: asignar el propietario.
5. Crear tarea: seguimiento con SLA.
6. Actualizar la «Cola de vendedores» con la última asignación.

En otros CRM (Pipedrive, Zoho, Bitrix24, Kommo u otro) hay funciones equivalentes; si la empresa lo tiene conectado, revisa qué permite antes de proponer.

---

## Territorios

### Por zona

| Territorio | Regiones | Equipo |
|---|---|---|
| Norte | (estados, provincias o departamentos del norte) | Equipo Norte |
| Centro | (los del centro) | Equipo Centro |
| Sur | (los del sur) | Equipo Sur |
| Internacional | Fuera del país | Equipo internacional |

(El original reparte EE. UU. en Oeste, Centro y Este por estados. Arma las zonas con el mapa de la empresa.)

### Por tamaño de empresa

| Segmento | Tamaño | Equipo |
|---|---|---|
| Pequeña | 1–50 personas | Venta interna |
| Mediana | 51–500 | Vendedores de empresas medianas |
| Grande | 501–5.000 | Vendedores de cuentas grandes |
| Estratégica | 5.000+ | Equipo de cuentas estratégicas |

### Por sector

| Vertical | Sectores | Especialista |
|---|---|---|
| Tecnología | Software, servicios de TI, equipos | Especialista en tecnología |
| Finanzas | Bancos, seguros, fintech | Especialista en finanzas |
| Salud | Hospitales, farmacéuticas, clínicas | Especialista en salud |
| General | Todos los demás | Grupo general (rotación) |

### Modelo combinado

```
Llega un prospecto
├─ ¿Empresa de más de 1.000 personas?
│  ├─ SÍ → Equipo de cuentas grandes
│  │  └─ Sub-asignar por zona
│  └─ NO ↓
├─ ¿Sector = salud o finanzas?
│  ├─ SÍ → Especialista del sector
│  └─ NO ↓
└─ Rotación en el grupo general
   └─ Ponderada por preferencia de zona
```

---

## Cuentas clave (ABM)

### Preparación

1. **Define la lista de cuentas objetivo** (suelen ser 50–500).
2. **Asigna responsables** en el CRM (1 vendedor por cuenta).
3. **Lógica de coincidencia:** cualquier prospecto del dominio de una cuenta objetivo va a su responsable.
4. **Reglas de coincidencia:**
   - Dominio del correo (principal).
   - Nombre de empresa parecido (secundaria, con revisión manual).
   - Empresa por IP (terciaria, para visitantes anónimos; solo si la empresa tiene esa herramienta y lo permite la ley de datos del país).

### Niveles

| Nivel | Tipo de cuenta | Asignación | SLA de respuesta |
|---|---|---|---|
| Nivel 1 | Las 20 cuentas más estratégicas | Responsable fijo, aviso inmediato | 1 hora |
| Nivel 2 | Las 100 cuentas objetivo | Responsable fijo, aviso normal | 4 horas |
| Nivel 3 | Coinciden en sector o tamaño | Territorio o rotación | Mismo día hábil |

### Varios contactos de la misma cuenta

Cuando interactúan varias personas de la misma cuenta:
- Todas van al **mismo responsable**.
- Se avisa al responsable de cada contacto nuevo.
- Se mide el interés de la cuenta (suma de todos los contactos).
- Aviso de «comité de compra» cuando 3+ contactos de la cuenta interactúan.

---

## Velocidad de respuesta

### Efecto del tiempo de respuesta en la conversión

| Tiempo de respuesta | Probabilidad relativa de calificar | Nota |
|---|---|---|
| Menos de 5 minutos | **21 veces** más | Lo ideal |
| 5–10 minutos | 10 veces más | Todavía fuerte |
| 10–30 minutos | 4 veces más | Aceptable |
| 30 min – 1 hora | 2 veces más | Por debajo de lo recomendable |
| 1–24 horas | Base | Promedio del sector |
| Más de 24 horas | 60 % por debajo de la base | El prospecto está frío |

Fuente: Lead Connect, InsideSales.com (mercado de EE. UU.; tómalo como orientación).

### Cómo implementarlo

1. **Aviso inmediato:** notificación + correo (o WhatsApp interno) al vendedor al crearse el MQL.
2. **Tarea con temporizador:** tarea con SLA de 5 minutos.
3. **Cadena de escalamiento:**
   - 5 min: se avisa al vendedor asignado.
   - 15 min: se avisa al de respaldo.
   - 30 min: se avisa al jefe.
   - 1 hora: se reasigna al siguiente disponible.
4. **Medir e informar:** tiempos reales cada semana; reconocer a quien responde rápido.

### Automatización

**Disparador:** se crea un MQL.
**Acciones:**
1. Asignar según las reglas (al instante).
2. Notificación + correo al vendedor.
3. Tarea: «Contactar a [nombre] — SLA 5 min».
4. Iniciar el temporizador del SLA.
5. Sin actividad en 15 min → avisar al de respaldo.
6. Sin actividad en 30 min → avisar al jefe.
7. Sin actividad en 60 min → reasignar por rotación.

En la oficina, un **disparador** (formulario, WhatsApp, correo) puede crear la tarea para el puesto de prospectos entrantes al instante, y ese agente deja listo el primer mensaje como borrador para el OK. Propónselo al dueño; tú no lo activas.

### Qué medir cada semana

- **Tiempo medio al primer contacto** (de la creación del MQL a la primera llamada o mensaje).
- **Tiempo mediano** (menos afectado por casos extremos).
- **% de prospectos contactados dentro del SLA** (meta: 90 %+).
- **Contacto por hora del día** (huecos de cobertura).
- **Conversión por tiempo de respuesta** (demuestra lo que vale la rapidez).
