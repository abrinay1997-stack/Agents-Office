# Plantillas de pruebas A/B

Plantillas para planear, documentar y analizar experimentos. Cópialas dentro de tu entrega y complétalas; lo que no sepas, déjalo marcado como supuesto o pídelo (`pedir_bloqueo`), nunca lo inventes.

## Contenido
- Plantilla de plan de prueba
- Plantilla de resultados
- Entrada del registro de pruebas
- Ficha rápida de prueba
- Informe de avance para el dueño
- Matriz de priorización de experimentos
- Banco de hipótesis
- Libro de jugadas (una entrada por prueba ganadora)

---

## Plantilla de plan de prueba

```markdown
# Prueba A/B: [Nombre]

## Resumen
- **Responsable**: [Nombre]
- **ID de la prueba**: [ID en la herramienta de pruebas, o un número propio]
- **Página, anuncio o pieza**: [Qué se prueba]
- **Fechas previstas**: [Inicio] - [Fin]

## Hipótesis

Como [observación o dato],
creemos que [cambio]
provocará [resultado esperado]
en [público].
Lo sabremos cuando [métricas].

## Diseño de la prueba

| Elemento | Detalle |
|---|---|
| Tipo de prueba | A/B / A/B/n / Multivariante |
| Duración | X semanas |
| Tamaño de muestra | X por variante |
| Reparto del tráfico | 50/50 |
| Herramienta | [Nombre: plataforma web, Meta Ads, herramienta de correo…] |
| Implementación | En el navegador / En el servidor / En la plataforma |

## Variantes

### Control (A)
[Captura]
- La experiencia actual
- [Datos clave del estado actual]

### Variante (B)
[Captura o maqueta]
- [Cambio específico 1]
- [Cambio específico 2]
- Razón: [Por qué creemos que ganará]

## Métricas

### Principal
- **Métrica**: [nombre]
- **Definición**: [cómo se calcula]
- **Base actual**: [X %]
- **Efecto mínimo detectable**: [X %]

### Secundarias
- [Métrica 1]: [qué nos dice]
- [Métrica 2]: [qué nos dice]
- [Métrica 3]: [qué nos dice]

### De resguardo
- [Métrica que no debe empeorar]
- [Otra métrica de seguridad]

## Plan de análisis por segmento
- Teléfono y computadora
- Visitantes nuevos y recurrentes
- Fuente de tráfico
- [Otros segmentos relevantes]

## Criterios de éxito
- Ganadora: [la métrica principal mejora en X % con 95 % de confianza]
- Perdedora: [la métrica principal baja de forma significativa]
- No concluyente: [qué haremos si no hay resultado significativo]

## Lista previa al lanzamiento
- [ ] Hipótesis escrita y revisada
- [ ] Métrica principal definida y medible
- [ ] Tamaño de muestra calculado
- [ ] Duración estimada
- [ ] Variantes montadas correctamente
- [ ] Medición verificada en todas las variantes
- [ ] Revisión de todas las variantes completada (también en el teléfono)
- [ ] Interesados informados
- [ ] Fecha de análisis apartada en el calendario
- [ ] OK del dueño para lanzar
```

---

## Plantilla de resultados

```markdown
# Resultados de la prueba A/B: [Nombre]

## Resumen
| Elemento | Valor |
|---|---|
| ID de la prueba | [ID] |
| Fechas | [Inicio] - [Fin] |
| Duración | X días |
| Resultado | Ganadora / Perdedora / No concluyente |
| Decisión | [Qué vamos a hacer] |

## Hipótesis (recordatorio)
[Copiar del plan de prueba]

## Resultados

### Tamaño de muestra
| Variante | Objetivo | Real | % del objetivo |
|---|---|---|---|
| Control | X | Y | Z % |
| Variante | X | Y | Z % |

### Métrica principal: [Nombre de la métrica]
| Variante | Valor | IC 95 % | Frente al control |
|---|---|---|---|
| Control | X % | [X %, Y %] | — |
| Variante | X % | [X %, Y %] | +X % |

**Significancia estadística**: p = X,XX (95 % = significativa / no significativa)
**Significancia práctica**: [¿esta mejora importa para el negocio?]

### Métricas secundarias

| Métrica | Control | Variante | Cambio | ¿Significativo? |
|---|---|---|---|---|
| [Métrica 1] | X | Y | +Z % | Sí/No |
| [Métrica 2] | X | Y | +Z % | Sí/No |

### Métricas de resguardo

| Métrica | Control | Variante | Cambio | ¿Preocupa? |
|---|---|---|---|---|
| [Métrica 1] | X | Y | +Z % | Sí/No |

### Análisis por segmento

**Teléfono y computadora**
| Segmento | Control | Variante | Mejora |
|---|---|---|---|
| Teléfono | X % | Y % | +Z % |
| Computadora | X % | Y % | +Z % |

**Nuevos y recurrentes**
| Segmento | Control | Variante | Mejora |
|---|---|---|---|
| Nuevos | X % | Y % | +Z % |
| Recurrentes | X % | Y % | +Z % |

## Interpretación

### ¿Qué pasó?
[Explicación de los resultados en lenguaje sencillo]

### ¿Por qué creemos que pasó?
[Análisis y razonamiento]

### Salvedades
[Límites, factores externos o preocupaciones]

## Decisión

**Ganadora**: [Control / Variante]

**Acción**: [Implementar la variante / Quedarse con el control / Repetir la prueba]

**Plazo**: [Cuándo se aplicarán los cambios; se aplican con el OK del dueño]

## Aprendizajes

### Qué aprendimos
- [Hallazgo clave 1]
- [Hallazgo clave 2]

### Qué probar después
- [Idea de prueba de seguimiento 1]
- [Idea de prueba de seguimiento 2]

### Impacto
- **Mejora proyectada**: [X % de mejora en la métrica Y]
- **Impacto en el negocio**: [ingresos, conversiones, citas, etc.; con cifras reales de la empresa]
```

---

## Entrada del registro de pruebas

Para llevar todas las pruebas en un solo lugar (por ejemplo, una nota `Marketing/experimentos` del Cerebro que el dueño guarda):

```markdown
| ID | Nombre | Página o pieza | Fechas | Métrica principal | Resultado | Mejora | Enlace |
|---|---|---|---|---|---|---|---|
| 001 | Titular del inicio | Inicio | 1/1-15/1 | Clics en el botón | Ganadora | +12 % | [Enlace] |
| 002 | Disposición de la tabla de precios | Precios | 10/1-31/1 | Plan elegido | Perdedora | -5 % | [Enlace] |
| 003 | Campos del formulario de cita | Reservas | 1/2-14/2 | Formularios completados | No concluyente | +2 % | [Enlace] |
```

(Los números del ejemplo son ilustrativos.)

---

## Ficha rápida de prueba

Para pruebas sencillas que no necesitan documentación completa:

```markdown
## [Nombre de la prueba]

**Qué**: [Descripción en una frase]
**Por qué**: [Hipótesis en una frase]
**Métrica**: [Métrica principal]
**Duración**: [X semanas]
**Resultado**: [Por definir / Ganadora / Perdedora / No concluyente]
**Aprendizaje**: [Conclusión clave]
```

---

## Informe de avance para el dueño

```markdown
## Avance de la prueba A/B: [Nombre]

**Estado**: En curso / Terminada
**Días restantes**: X (o terminada)
**Muestra actual**: X % del objetivo

### Observaciones preliminares
[Lo que se ve, sin tomar decisiones todavía]

### Próximos pasos
[Qué sigue]

### Calendario
- [Fecha]: Análisis terminado
- [Fecha]: Decisión y recomendación
- [Fecha]: Implementación (si hay ganadora; con tu OK)
```

---

## Matriz de priorización de experimentos

Para decidir qué pruebas correr:

| Factor | Peso | Prueba A | Prueba B | Prueba C |
|---|---|---|---|---|
| Impacto potencial | 30 % | | | |
| Confianza en la hipótesis | 25 % | | | |
| Facilidad de implementación | 20 % | | | |
| Riesgo si me equivoco | 15 % | | | |
| Alineación estratégica | 10 % | | | |
| **Total** | | | | |

Puntuación: de 1 a 5 (5 = lo mejor). En «Riesgo si me equivoco», 5 significa riesgo bajo. Para una priorización más rápida está el puntaje ICE de `SKILL.md`.

---

## Banco de hipótesis

Para juntar ideas de prueba:

```markdown
| ID | Página o área | Observación | Hipótesis | Impacto potencial | Estado |
|---|---|---|---|---|---|
| H1 | Inicio | Poca profundidad de desplazamiento | Una cabecera más corta aumentará el desplazamiento | Alto | En prueba |
| H2 | Precios | La gente compara planes | Una tabla comparativa ayudará | Medio | En espera |
| H3 | Reservas | Se caen en el paso del correo | Pedir solo el teléfono aumentará las reservas completadas | Medio | En espera |
```

---

## Libro de jugadas (una entrada por prueba ganadora)

Cuando una prueba gana, documenta el patrón además de implementarlo:

```markdown
## [Nombre del experimento]
**Fecha**: [fecha]
**Hipótesis**: [la hipótesis]
**Tamaño de muestra**: [n por variante]
**Resultado**: [ganadora / perdedora / no concluyente] — [métrica principal] cambió en [X %] (IC 95 %: [rango], p = [valor])
**Resguardos**: [métricas de resguardo y su resultado]
**Diferencias por segmento**: [diferencias notables por dispositivo, segmento o cohorte]
**Por qué funcionó o falló**: [análisis]
**Patrón**: [la lección reutilizable, p. ej. «la prueba social junto al botón de precios aumenta la elección de plan»]
**Aplicar en**: [otras páginas o flujos donde este patrón podría funcionar]
**Estado**: [implementado / en pausa / requiere una prueba de seguimiento]
```

Con el tiempo, el libro de jugadas se vuelve una biblioteca de patrones de crecimiento probados para este negocio y este público. Propón guardarlo como nota del Cerebro para que cada agente lo lea antes de proponer pruebas.
