# Arquitectura de contenido para páginas comparativas

Cómo organizar y mantener los datos de los competidores para que muchas páginas comparativas digan lo mismo y se actualicen juntas.

## Contenido
- Datos centralizados del competidor
- Plantilla de la nota del competidor
- Los datos de tu propia empresa
- Cómo se generan las páginas
- Páginas índice (de alternativas, de comparaciones, buenas prácticas)
- Enlaces en el pie de página

## Datos centralizados del competidor

Una sola fuente de verdad por competidor. En Agents Office, cada competidor es **una nota del Cerebro**; el agente entrega el texto de la nota y el dueño la guarda (por ejemplo, en una carpeta `Competidores/`):

```
Competidores/
├── cadena-gimnasios-x.md
├── notion.md
├── airtable.md
└── ...
```

## Plantilla de la nota del competidor

Por competidor, documenta (en la cabecera o como lista):

```yaml
nombre: Notion
web: notion.so
lema: "El espacio de trabajo todo en uno"
fundado: 2016
sede: San Francisco

# Posicionamiento
uso_principal: "documentos + bases de datos ligeras"
publico: "equipos que quieren un espacio flexible"
posicion: "premium, con muchas funciones"

# Procedencia (verificar antes de volver a publicar)
ultima_verificacion: 2026-03-14
fuentes:
  precios: notion.so/pricing
  funciones: notion.so/help + prueba propia

# Precios (en su moneda, con la fecha de arriba)
modelo_de_precios: por usuario
plan_gratis: true
limites_gratis: "bloques limitados, 1 usuario"
precio_inicial: "[precio] por usuario al mes"
precio_negocio: "[precio] por usuario al mes"
empresa: a cotizar

# Funciones (valora de 1 a 5 o describe, y di cómo lo valoraste)
funciones:
  documentos: 5
  bases_de_datos: 4
  gestion_de_proyectos: 3
  colaboracion: 4
  integraciones: 3
  app_movil: 3
  sin_conexion: 2
  api: 4

# Fortalezas (con honestidad)
fortalezas:
  - Muy flexible y personalizable
  - Interfaz moderna y cuidada
  - Muchas plantillas
  - Comunidad activa

# Debilidades (con justicia)
debilidades:
  - Puede ir lento con bases de datos grandes
  - Curva de aprendizaje en lo avanzado
  - Automatizaciones limitadas frente a herramientas dedicadas
  - Modo sin conexión limitado

# Para quién sí
ideal_para:
  - Equipos que quieren todo en un espacio
  - Trabajo con mucho contenido
  - Equipos que documentan primero
  - Empresas pequeñas que empiezan

# Para quién no
no_ideal_para:
  - Gestión de proyectos compleja
  - Bases de datos grandes (miles de filas)
  - Equipos que necesitan trabajar sin conexión
  - Grandes empresas con cumplimiento estricto

# Quejas comunes (de reseñas, con su fuente)
quejas_comunes:
  - "Se pone lento con mucho contenido"
  - "Cuesta encontrar las cosas cuando crece"
  - "La app móvil es torpe"

# Notas para el cambio
cambio_desde:
  dificultad: media
  exportacion: "Markdown, CSV, HTML"
  que_se_traslada: "Páginas, bases de datos"
  que_no: "Automatizaciones, configuración de integraciones"
  tiempo_estimado: "1 a 3 días para un equipo pequeño"
```

Para un negocio local cambian los campos, no la idea: sedes y horarios, servicios y precios publicados (con fecha), calificación en Google y número de reseñas (con fecha), quejas frecuentes en reseñas, formas de pago, tiempos de espera, garantía.

## Los datos de tu propia empresa

La misma estructura para ti, con honestidad. Mucho ya está en `00-Empresa/oferta`, `contexto-marketing` y las cifras de la empresa: úsalo, no lo dupliques.

```yaml
nombre: [Tu producto o negocio]
# ... los mismos campos

fortalezas:
  - [Tus fortalezas reales]

debilidades:
  - [Tus debilidades honestas]

ideal_para:
  - [Tus clientes ideales]

no_ideal_para:
  - [Quién debería usar otra cosa]
```

## Cómo se generan las páginas

Cada página sale de las notas centrales:

- **Alternativa a [Competidor]:** datos del competidor + los tuyos.
- **Alternativas a [Competidor]:** datos del competidor + los tuyos + otras alternativas.
- **Tú vs [Competidor]:** los tuyos + los del competidor.
- **[A] vs [B]:** los de ambos competidores + los tuyos.

**Ventajas:** cambias el precio del competidor una vez y cambia en todas partes; añades una comparación de función una vez y aparece en todas las páginas; las páginas dicen lo mismo; es más fácil de mantener a escala (ver `seo-programatico`).

## Páginas índice

### Índice de alternativas

**Dirección:** `/alternativas`
**Para qué:** lista todas las páginas «Alternativa a [Competidor]».

**Estructura:**
1. Titular: «[Tu producto] como alternativa»
2. Introducción breve: por qué la gente se cambia a ti
3. Lista de todas las páginas de alternativa con: nombre o logo del competidor, una línea con el diferenciador frente a ese competidor, enlace a la comparación completa
4. Razones comunes para cambiarse (agregadas)
5. Llamado a la acción

**Ejemplo:**
```markdown
## Conoce [Tu producto] como alternativa

¿Piensas cambiarte? Mira cómo se compara [Tu producto] con lo que estás evaluando:

- **[Alternativa a Notion](/alternativas/notion)**: mejor para equipos que necesitan [X]
- **[Alternativa a Airtable](/alternativas/airtable)**: mejor para equipos que necesitan [Y]
- **[Alternativa a Monday](/alternativas/monday)**: mejor para equipos que necesitan [Z]
```

### Índice de comparaciones

**Dirección:** `/vs` o `/comparar`
**Para qué:** lista todas las páginas «Tú vs [Competidor]» y «[A] vs [B]».

**Estructura:**
1. Titular: «Compara [Tu producto]»
2. Sección «[Tu producto] vs la competencia»: las comparaciones directas
3. Sección «Cara a cara»: las páginas [A] vs [B]
4. Nota breve de método (cómo comparamos y cuándo revisamos)
5. Llamado a la acción

### Buenas prácticas de los índices

- **Mantenlos al día:** cada página comparativa nueva entra en su índice.
- **Enlaces internos:** del índice a cada página, de cada página de vuelta al índice, y entre comparaciones relacionadas.
- **Valor para buscadores:** los índices pueden posicionar términos amplios como «comparativa de herramientas de gestión de proyectos», pasan autoridad a cada página y ayudan a que los buscadores encuentren todo.
- **Formas de ordenar:** por popularidad (volumen de búsqueda), alfabético, por categoría o caso de uso, por fecha (muestra que está fresco).
- **Incluye:** fecha de última actualización, cuántas comparaciones hay, y filtros rápidos si son muchas.

## Enlaces en el pie de página

El pie de página aparece en todas las páginas de marketing, así que es una buena oportunidad para enlazar las comparaciones.

### Opción 1: enlaces a los índices (lo mínimo)

```
Pie de página
├── Compara
│   ├── Alternativas  →  /alternativas
│   └── Comparaciones →  /vs
```

Así cada página de marketing pasa autoridad al centro de comparaciones.

### Opción 2: columnas por formato (recomendada para buscadores)

```
Pie de página
├── [Producto] vs           ├── Alternativas a           ├── Compara
│   ├── vs Notion           │   ├── Alternativa a Notion │   ├── Notion vs Airtable
│   ├── vs Airtable         │   ├── Alternativa a Airtable│  ├── Monday vs Asana
│   ├── vs Monday           │   ├── Alternativa a Monday │   ├── Notion vs Monday
│   ├── ...                 │   ├── ...                  │   └── Ver todas →
│   └── Ver todas →         │   └── Ver todas →          │
```

**Pautas:**
- Hasta 8 enlaces por columna (los competidores con más búsquedas).
- Un enlace «Ver todas» al índice completo.
- Solo columnas de formatos que de verdad existan.
- Prioriza los competidores con más volumen de búsqueda.

### Por qué importan

1. **Distribución en todo el sitio:** pasan autoridad desde todas las páginas.
2. **Rastreo:** los buscadores encuentran rápido todas las comparaciones.
3. **Descubrimiento:** quien está evaluando las encuentra fácil.
4. **Posicionamiento:** le dice a los buscadores que eres un actor clave del rubro.

### Al implementarlo

- Actualiza el pie cuando agregues una comparación prioritaria.
- Mantenlo limpio: solo las principales, no todas.
- Los títulos de columna coinciden con la estructura de direcciones (columna «vs» → `/vs/`).
- En el teléfono las columnas se apilan: ordénalas por prioridad.
- El agente propone el pie; quien cambia la web es el dueño o su equipo.
