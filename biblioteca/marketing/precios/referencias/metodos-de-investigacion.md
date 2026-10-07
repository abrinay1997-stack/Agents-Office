# Métodos para investigar el precio

## Contenido
- Medidor de sensibilidad al precio de Van Westendorp (las cuatro preguntas, cómo analizar, consejos, ejemplo de resultado)
- Análisis MaxDiff (cómo funciona, pregunta de ejemplo, análisis, uso para empaquetar)
- Encuestas de disposición a pagar
- Correlación entre uso y valor
- La versión mínima para un negocio pequeño

Las encuestas y entrevistas son borradores: el agente prepara el cuestionario y el plan; enviarlos a clientes lo aprueba el dueño.

## Medidor de sensibilidad al precio de Van Westendorp

Encuentra el rango de precio aceptable del producto o servicio.

### Las cuatro preguntas
A cada persona:
1. «¿A qué precio te parecería [producto] tan caro que no lo considerarías?» (Demasiado caro)
2. «¿A qué precio te parecería tan barato que dudarías de su calidad?» (Demasiado barato)
3. «¿A qué precio empezaría a parecerte caro, aunque todavía lo considerarías?» (Caro)
4. «¿A qué precio te parecería una ganga, una gran compra por lo que cuesta?» (Barato / buen valor)

### Cómo analizar
1. Grafica la distribución acumulada de cada pregunta.
2. Busca los cruces:
   - **Punto de barato marginal (PMC):** «Demasiado barato» cruza «Caro».
   - **Punto de caro marginal (PME):** «Demasiado caro» cruza «Barato».
   - **Punto de precio óptimo (OPP):** «Demasiado barato» cruza «Demasiado caro».
   - **Punto de indiferencia (IDP):** «Caro» cruza «Barato».

**Rango aceptable:** de PMC a PME.
**Zona óptima:** entre OPP e IDP.

### Consejos
- Hacen falta 100-300 respuestas para datos fiables.
- Segmenta por perfil (la disposición a pagar cambia).
- Usa descripciones realistas del producto.
- Considera añadir preguntas de intención de compra.

### Ejemplo de resultado (cifras inventadas para ilustrar)

```
Análisis de sensibilidad al precio:
─────────────────────────────────
Punto de barato marginal:   29 /mes
Precio óptimo:              49 /mes
Punto de indiferencia:      59 /mes
Punto de caro marginal:     79 /mes

Rango recomendado: 49-59 /mes
Precio actual: 39 /mes (por debajo del óptimo)
Oportunidad: subir 25-50 % sin un impacto grande en la demanda
```

En una entrega real, el «precio actual» sale de las cifras de la empresa y los demás puntos solo de una encuesta hecha de verdad. Si no hay encuesta, no hay puntos: se propone hacerla.

---

## Análisis MaxDiff (mejor-peor)

Identifica qué funciones o atributos valora más el cliente; orienta cómo armar los planes.

### Cómo funciona
1. Lista 8-15 funciones que podrías incluir.
2. Muestra a cada persona grupos de 4-5 funciones a la vez.
3. Pregunta: «¿Cuál es la MÁS importante? ¿Cuál la MENOS?»
4. Repite con varios grupos hasta comparar todas.
5. El análisis estadístico da una puntuación de importancia.

### Pregunta de ejemplo

```
¿Cuál es la MÁS importante para ti?
¿Cuál es la MENOS importante para ti?

□ Proyectos ilimitados
□ Tu propia marca
□ Soporte prioritario
□ Acceso a la API
□ Analítica avanzada
```

Para una clínica dental, los atributos podrían ser: horario extendido, pago a meses, revisión de urgencia el mismo día, recordatorios por WhatsApp, estacionamiento.

### Análisis
Las funciones se ordenan por utilidad:
- Utilidad alta = imprescindible (va en el plan base)
- Utilidad media = diferenciador (separa los planes)
- Utilidad baja = deseable (plan premium o se quita)

### Usar MaxDiff para empaquetar

| Puntuación | Decisión |
|---|---|
| 20 % superior | En todos los planes (lo mínimo esperado) |
| 20-50 % | Para diferenciar los planes |
| 50-80 % | Solo en los planes altos |
| 20 % inferior | Quitar o vender como complemento premium |

---

## Encuestas de disposición a pagar

**Método directo (simple pero sesgado):**
«¿Cuánto pagarías por [producto]?»

**Mejor: método Gabor-Granger:**
«¿Comprarías [producto] a [X]?» (Sí/No). Cambia el precio entre personas para armar una curva de demanda.

**Aún mejor: análisis conjunto (conjoint):**
Muestra combinaciones de producto a distintos precios; la persona elige la que prefiere. El análisis estadístico revela la sensibilidad al precio de cada función.

---

## Correlación entre uso y valor

### 1. Registra el uso
Cómo usan los clientes el producto:
- Frecuencia de uso de cada función
- Volumen (usuarios, registros, llamadas a la API)
- Resultados (ingresos generados, tiempo ahorrado)

En un negocio de servicios o una tienda: frecuencia de compra, ticket promedio, servicios por cliente, antigüedad.

### 2. Crúzalo con el éxito del cliente
- ¿Qué patrones de uso predicen que el cliente se queda?
- ¿Cuáles predicen que compra más?
- ¿Qué clientes pagan más y por qué?

### 3. Identifica umbrales de valor
- ¿A partir de qué uso el cliente «lo entiende»?
- ¿A partir de qué uso amplía?
- ¿A partir de qué uso debería subir el precio?

### Ejemplo de análisis (ilustrativo)

```
Correlación uso-valor:
─────────────────────────────────
Segmento: clientes de alto valor
Usuarios activos al mes (promedio): 15
Proyectos (promedio): 8
Integraciones (promedio): 4

Segmento: clientes que se dieron de baja
Usuarios activos al mes (promedio): 3
Proyectos (promedio): 2
Integraciones (promedio): 0

Conclusión: el valor va con la adopción del equipo (usuarios)
            y la profundidad de uso (integraciones)

Recomendación: cobrar por usuario, dejar las integraciones para planes altos
```

Los datos de uso los da el dueño o los conectores que la empresa tenga (su sistema de cobro, su CRM, su analítica); si no hay, dilo y propone qué registrar.

---

## La versión mínima para un negocio pequeño

Sin presupuesto para 300 encuestas:
1. **Entrevista a 10-15 clientes o prospectos** con las cuatro preguntas de Van Westendorp y una de «¿qué otra cosa considerarías en vez de esto?». No es estadística, pero muestra el rango.
2. **Revisa los precios públicos de 3-5 competidores** (búsqueda web, si está encendida). Anota qué incluyen, no solo el número.
3. **Prueba dos precios con clientes nuevos** durante un periodo acotado (o dos paquetes en el mismo mostrador) y mide cuántos compran.
4. **Escucha las objeciones de ventas:** pide al equipo de Ventas (o léelo en las notas) cuántas veces el precio fue la razón de un «no».
