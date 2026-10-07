# Plantilla del informe de auditoría ASO

Usa esta forma para todo informe de ASO. Es la respuesta del agente (Markdown), no un archivo aparte.

---

## Encabezado

```
# Auditoría ASO: {Nombre de la app}
**Tienda:** {App Store / Google Play}
**Enlace:** {enlace de la ficha}
**Fecha de la auditoría:** {fecha}
**Nivel de marca:** {Dominante / Establecida / Retadora} — {una línea de por qué}
**Nota final:** {nota}/100 (Letra: {A/B/C/D/F})
```

---

## Tarjeta de puntuación

```
| Dimensión | Nota | Letra | Problema principal |
|-----------|------|-------|--------------------|
| Título y subtítulo | X/10 | {letra} | {resumen en una línea} |
| Descripción | X/10 | {letra} | {resumen} |
| Recursos visuales | X/10 | {letra} | {resumen} |
| Calificaciones y reseñas | X/10 | {letra} | {resumen} |
| Metadatos y frescura | X/10 | {letra} | {resumen} |
| Señales de conversión | X/10 | {letra} | {resumen} |
| **TOTAL** | **{ponderada}/100** | **{letra}** | |
```

Letra por dimensión: 9–10 = A, 7–8 = B, 5–6 = C, 3–4 = D, 1–2 = F.

---

## Las 3 mejoras rápidas

Los cambios de más impacto que toman menos de 1 hora:

```
### 1. {Verbo} — {cambio concreto}
**Impacto:** {Alto/Medio} | **Esfuerzo:** {<15 min / <30 min / <1 hora}
**Actual:** {lo que hay ahora}
**Recomendado:** {texto exacto de reemplazo, con conteo de caracteres}
**Por qué:** {una frase sobre el impacto}

### 2. ...
### 3. ...
```

---

## Hallazgos por dimensión

### Título y subtítulo

```
**Título actual:** "{título}" ({X}/30 caracteres)
**Subtítulo / descripción corta actual:** "{subtítulo}" ({X}/30 u /80 caracteres)

**Problemas:**
- {problema 1}
- {problema 2}

**Título recomendado:** "{nuevo}" ({X}/30) — {razón}
**Subtítulo recomendado:** "{nuevo}" ({X}/30 u /80) — {razón}
```

### Descripción

```
**Primeras 3 líneas (antes de «Ver más»):**
> {texto citado}

**Problemas:**
- {problema 1}
- {problema 2}

**Densidad de palabras clave (solo Google Play):** {X} % — objetivo: 2–3 %
**Palabras clave encontradas:** {palabra1} (Xn), {palabra2} (Xn), ...
**Palabras clave valiosas que faltan:** {palabra1}, {palabra2}, ...

**Primeras 3 líneas recomendadas:**
> {texto reescrito}
```

### Recursos visuales

```
**Capturas:** {cantidad} ({tienda} muestra las primeras {3/todas} en la búsqueda)
**Video:** {Sí/No}
**Icono:** {descripción}
**Gráfico de funciones (Google Play):** {Sí/No}

**Revisión de capturas:**
1. {descripción de la captura 1} — {bien / problema}
2. {descripción de la captura 2} — {bien / problema}
...

**Recomendaciones:**
- {cambio visual concreto 1}
- {cambio visual concreto 2}
```

### Calificaciones y reseñas

```
**Calificación media:** {X,X} estrellas ({cantidad} calificaciones)
**Sentimiento reciente:** {Positivo/Mixto/Negativo}
**Quejas comunes:** {tema1}, {tema2}
**Respuestas del desarrollador:** {Sí, activas / Esporádicas / Ninguna}

**Recomendaciones:**
- {acción concreta 1}
- {acción concreta 2}
```

### Metadatos y frescura

```
**Última actualización:** {fecha} (hace {X días/meses})
**Idiomas:** {cantidad}
**Categoría:** {categoría actual}
**Eventos / LiveOps:** {Sí/No}

**Recomendaciones:**
- {acción concreta 1}
- {acción concreta 2}
```

### Señales de conversión

```
**Modelo de precio:** {Gratis / Freemium / De pago}
**Compras dentro de la app:** {cantidad}
**Descargas (Google Play):** {rango}
**Prueba social visible:** {premios, prensa, insignias — o «ninguna»}

**Recomendaciones:**
- {acción concreta 1}
- {acción concreta 2}
```

---

## Palabras clave sugeridas

```
| Palabra clave | Por qué | Dónde ponerla | Prioridad |
|---------------|---------|---------------|-----------|
| {palabra} | {razón} | {título/subtítulo/descripción/campo de palabras clave} | {Alta/Media/Baja} |
| ... | ... | ... | ... |
```

Nota: sin herramientas de ASO de pago no hay volumen de búsqueda exacto. Estas sugerencias salen del análisis de la categoría, los metadatos de los competidores y la relevancia del sentido. Para validar el volumen, el dueño puede usar una herramienta de ASO (por ejemplo AppTweak, Sensor Tower o MobileAction).

---

## Comparación con competidores (si aplica)

```
| Métrica | {Tu app} | {Competidor 1} | {Competidor 2} |
|---------|----------|----------------|----------------|
| Palabras clave del título | ... | ... | ... |
| Calificación | ... | ... | ... |
| Capturas | ... | ... | ... |
| Video | ... | ... | ... |
| Palabras clave de la descripción | ... | ... | ... |
| Última actualización | ... | ... | ... |
| Nota ASO total | ... | ... | ... |
```

---

## Plan de acción

Ordenado por impacto (de mayor a menor) y agrupado por esfuerzo:

```
### Esta semana (mejoras rápidas)
1. {acción} — {impacto esperado}
2. {acción} — {impacto esperado}

### Este mes (esfuerzo medio)
3. {acción} — {impacto esperado}
4. {acción} — {impacto esperado}

### Próximo trimestre (esfuerzo alto)
5. {acción} — {impacto esperado}
6. {acción} — {impacto esperado}
```

---

## Límites

Incluye siempre esta sección:

> **Lo que esta auditoría no puede medir sin herramientas de ASO de pago:**
>
> - Volumen y dificultad exactos de cada palabra clave
> - Historial de posiciones por palabra clave
> - Estimaciones de descargas e ingresos
> - El contenido del campo de palabras clave de Apple (es oculto)
> - La conversión real de la ficha (solo la ve el dueño en su consola)
> - Resultados de pruebas A/B anteriores
>
> Para estos datos: la consola de la tienda (App Store Connect o Google Play Console), o una herramienta de ASO de pago (AppTweak, Sensor Tower, MobileAction u otra).
