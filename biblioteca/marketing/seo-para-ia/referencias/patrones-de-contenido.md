# Patrones de contenido AEO y GEO

Bloques de contenido reutilizables, pensados para los motores de respuestas y para que la IA te cite.

## Contenido
- Patrones AEO (optimización para motores de respuestas): bloque de definición, de pasos, tabla comparativa, pros y contras, preguntas frecuentes, lista de «los mejores»
- Patrones GEO (optimización para motores generativos): bloque de estadística, cita de experto, afirmación autoritativa, respuesta autosuficiente, sándwich de evidencia
- Tácticas GEO por tipo de contenido (tecnología, salud, finanzas, legal, negocios y marketing, negocio local)
- Búsqueda por voz

Regla general antes de usar cualquiera: **escribe para personas y organiza con claridad.** Estos bloques son buena organización normal, no fragmentos «para la IA». Google lo dice explícito: no partas el contenido en trocitos para que la IA lo entienda mejor.

---

## Patrones AEO

Ayudan a aparecer en fragmentos destacados, resúmenes de IA, búsqueda por voz y cuadros de respuesta.

### Bloque de definición

Para consultas «¿Qué es [X]?».

```markdown
## ¿Qué es [término]?

[Término] es [definición concisa en una frase]. [Explicación ampliada de 1–2 frases con sus características clave]. [Breve contexto de por qué importa o cómo se usa].
```

**Ejemplo:**
```markdown
## ¿Qué es la optimización para motores de respuestas?

La optimización para motores de respuestas (AEO) es la práctica de estructurar el contenido para que los sistemas con IA puedan extraerlo y presentarlo como respuesta directa a lo que alguien pregunta. A diferencia del SEO tradicional, que busca posición en los resultados, el AEO apunta a los fragmentos destacados, los resúmenes de IA y las respuestas de los asistentes de voz.
```

Ejemplo para un negocio local: «¿Qué es una limpieza dental profunda? Es un tratamiento que elimina el sarro por debajo de la encía y alisa la raíz del diente. Se indica cuando hay inflamación o bolsas periodontales, y suele hacerse en una o dos citas».

### Bloque de pasos

Para consultas «Cómo [X]». Ideal para fragmentos de lista.

```markdown
## Cómo [acción/objetivo]

[Resumen del proceso en una frase]

1. **[Nombre del paso]**: [acción clara en 1–2 frases]
2. **[Nombre del paso]**: [acción clara en 1–2 frases]
3. **[Nombre del paso]**: [acción clara en 1–2 frases]
4. **[Nombre del paso]**: [acción clara en 1–2 frases]
5. **[Nombre del paso]**: [acción clara en 1–2 frases]

[Opcional: nota breve sobre el resultado esperado o el tiempo estimado]
```

**Ejemplo:**
```markdown
## Cómo optimizar un contenido para fragmentos destacados

Lograr un fragmento destacado requiere formato estratégico y respuestas directas.

1. **Identifica las oportunidades**: usa una herramienta de SEO para ver en qué palabras clave la competencia tiene un fragmento que podrías ganar.
2. **Iguala el formato**: mira si el fragmento actual es párrafo, lista o tabla y da forma a tu contenido igual.
3. **Responde directo**: da una respuesta clara y corta (40–60 palabras en fragmentos de párrafo) justo debajo del título con la pregunta.
4. **Agrega contexto**: amplía con ejemplos, datos y opinión experta en los párrafos siguientes.
5. **Usa buena estructura de títulos**: la pregunta objetivo como H2 o H3 y la respuesta inmediatamente después.
```

### Tabla comparativa

Para consultas «[X] vs [Y]». Ideal para fragmentos de tabla.

```markdown
## [Opción A] vs [Opción B]: [descriptor breve]

| Característica | [Opción A] | [Opción B] |
|----------------|------------|------------|
| [Criterio 1] | [valor/descripción] | [valor/descripción] |
| [Criterio 2] | [valor/descripción] | [valor/descripción] |
| [Criterio 3] | [valor/descripción] | [valor/descripción] |
| [Criterio 4] | [valor/descripción] | [valor/descripción] |
| Ideal para | [caso de uso] | [caso de uso] |

**En resumen**: [recomendación de 1–2 frases según las distintas necesidades]
```

### Bloque de pros y contras

Para consultas de evaluación: «¿Vale la pena [X]?», «¿Debería [X]?».

```markdown
## Ventajas y desventajas de [tema]

[Una frase con el contexto de la evaluación]

### Ventajas

- **[Categoría de beneficio]**: [explicación específica]
- **[Categoría de beneficio]**: [explicación específica]
- **[Categoría de beneficio]**: [explicación específica]

### Desventajas

- **[Categoría de inconveniente]**: [explicación específica]
- **[Categoría de inconveniente]**: [explicación específica]
- **[Categoría de inconveniente]**: [explicación específica]

**Veredicto**: [conclusión equilibrada de 1–2 frases, con recomendación]
```

### Bloque de preguntas frecuentes

Para páginas de tema con varias preguntas comunes. Es la base del marcado FAQ.

```markdown
## Preguntas frecuentes

### [Pregunta tal como la busca la gente]?

[Respuesta directa en la primera frase]. [Contexto de apoyo en 2–3 frases más].

### [Pregunta tal como la busca la gente]?

[Respuesta directa en la primera frase]. [Contexto de apoyo en 2–3 frases más].
```

**Consejos para las preguntas:**
- Usa frases naturales («¿Cómo hago para…?», no «¿De qué manera ha de procederse…?»).
- Incluye las palabras interrogativas: qué, cómo, por qué, cuándo, dónde, quién, cuál.
- Iguala las «Otras preguntas de la gente» que ves en los resultados de búsqueda.
- Mantén las respuestas entre 50 y 100 palabras.

### Bloque de lista «los mejores»

Para consultas «Mejores [X]», «Top [X]», «[Número] formas de [X]».

**Advertencia sobre las listas autopromocionales:** ponerte primero en tu propia guía «mejores [categoría]» hace que la página sea *citada* mucho más seguido de lo que tu marca es *recomendada*; en marcas emergentes, la respuesta de IA a menudo recoge los nombres de los competidores de tu guía y los recomienda a ellos. Lee `citas-vs-recomendaciones` antes de producir estas guías en cantidad.

```markdown
## Las [número] mejores [cosas] para [objetivo/propósito]

[1–2 frases de introducción con el contexto y el criterio de selección]

### 1. [Nombre]

[Por qué está incluido, en 2–3 frases con beneficios específicos]

### 2. [Nombre]

[Por qué está incluido, en 2–3 frases con beneficios específicos]
```

---

## Patrones GEO

Optimizan el contenido para que lo citen asistentes como ChatGPT, Claude, Perplexity y Gemini.

### Bloque de estadística citada

Las estadísticas elevan las citas de IA entre un 15 y un 30 %. Siempre con fuente.

```markdown
[Afirmación]. Según [fuente/organización], [estadística concreta con número y periodo]. [Contexto de por qué importa].
```

**Ejemplo (estructura; las cifras son de ilustración, usa solo datos reales con su fuente):**
```markdown
Optimizar para móvil ya no es opcional. Según [informe de la fuente, año], [X] % del tráfico web llega desde celulares, y las páginas que no cumplen los estándares de uso móvil tienen [Y] % más de rebote. Por eso el índice móvil primero es un factor crítico.
```

### Bloque de cita de experto

La atribución a un experto con nombre da credibilidad y aumenta la probabilidad de cita.

```markdown
«[Cita textual del experto]», dice [nombre], [cargo] en [organización]. [Una frase de contexto o interpretación].
```

Regla: la cita debe ser real, de una persona real que la dijo y que dio permiso o está publicada. **Nunca inventes una cita ni la atribuyas a alguien.** Si no hay una, pídele al dueño una frase de su especialista o de un cliente (con su permiso), o deja `[FALTA: cita de experto]`.

### Bloque de afirmación autoritativa

Estructura las afirmaciones para extraerlas fácil, con atribución clara.

```markdown
[Tema] [es/tiene/requiere/implica] [afirmación clara y específica]. [Fuente] [confirma/informa/halló] que [evidencia de apoyo]. Esto [explica/significa/sugiere] [implicación o acción].
```

**Ejemplo:**
```markdown
E-E-A-T es la piedra angular de cómo Google evalúa la calidad del contenido. Las pautas para evaluadores de calidad de búsqueda de Google indican que la confianza es el factor más crítico. Esto significa que quien crea contenido debe priorizar la transparencia y la exactitud por encima de cualquier otra táctica.
```

### Bloque de respuesta autosuficiente

Afirmaciones que se pueden citar solas, que la IA puede extraer tal cual.

```markdown
**[Tema/pregunta]**: [Respuesta completa y autosuficiente, que se entiende sin más contexto. Incluye datos concretos, cifras o ejemplos en 2–3 frases.]
```

**Ejemplo:**
```markdown
**Tiempo de entrega de un pedido en Quito**: los pedidos hechos antes de las 2 p. m. se entregan al día siguiente hábil; los de provincia tardan de 2 a 4 días. Los envíos son gratis desde [monto, en la moneda de la empresa, de sus cifras].
```

### Bloque sándwich de evidencia

Afirmaciones respaldadas con evidencia, para máxima credibilidad.

```markdown
[Afirmación inicial].

La evidencia incluye:
- [Dato 1 con fuente]
- [Dato 2 con fuente]
- [Dato 3 con fuente]

[Conclusión que conecta la evidencia con algo accionable].
```

---

## Tácticas GEO por tipo de contenido

Cada área se beneficia de señales de autoridad distintas.

### Tecnología
- Precisión técnica y terminología correcta.
- Números de versión y fechas de software o herramientas.
- Referencia a la documentación oficial.
- Ejemplos de código cuando aplique.

### Salud y medicina
- Cita estudios revisados por pares con sus datos de publicación.
- Incluye las credenciales de quien firma (médico, enfermera, odontólogo, nutricionista…).
- Señala limitaciones y contexto de los estudios.
- Agrega la fecha de «última revisión».

### Finanzas
- Referencia a los organismos reguladores de tu país.
- Cifras concretas con periodos de tiempo.
- Aclara que la información es educativa y no asesoría.
- Cita instituciones financieras reconocidas.

### Legal
- Cita leyes, normas y reglamentos específicos.
- Indica con claridad la jurisdicción.
- Incluye avisos profesionales.
- Anota cuándo conviene consultar a un profesional.

### Negocios y marketing
- Casos de estudio con resultados medibles.
- Referencias a investigaciones e informes del sector.
- Variaciones porcentuales con sus plazos.
- Citas de líderes reconocidos (reales y con permiso).

### Negocio local, tienda y servicios
- Datos que una persona pregunta antes de ir o comprar: horarios, zona de servicio, precios o rangos, formas de pago, garantía, tiempos.
- Reseñas reales y recientes, con respuesta del dueño.
- Fotos y fichas de producto con atributos completos (medidas, material, talla, compatibilidad).

---

## Búsqueda por voz

Las consultas por voz son conversacionales y en forma de pregunta. Optimiza para estos patrones:

### Formatos de pregunta para voz
- «¿Qué es…?»
- «¿Cómo hago…?»
- «¿Dónde puedo encontrar…?»
- «¿Por qué…?»
- «¿Cuándo debería…?»
- «¿Quién es…?»
- «¿Hay un [negocio] cerca de mí que…?»

### Estructura de respuesta para voz
- Empieza con la respuesta directa (idealmente menos de 30 palabras).
- Lenguaje natural y conversacional.
- Evita la jerga, salvo que el público sea experto.
- Incluye contexto local donde corresponda.
- Estructúralo para una sola respuesta hablada.
