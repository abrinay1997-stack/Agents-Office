# Modelos de puntuación de prospectos

Plantillas detalladas, modelos de ejemplo por tipo de negocio y cómo calibrar. Los puntos son ejemplos para arrancar: la versión buena sale de comparar con las ventas reales de la empresa. Los tramos de facturación están en la moneda de la empresa: ajústalos a su mercado.

## Puntuación explícita (encaje)

### Atributos de la empresa

| Atributo | Criterio | Puntos |
|---|---|---|
| **Tamaño** | 1–10 personas | +5 |
| | 11–50 | +10 |
| | 51–200 | +15 |
| | 201–1.000 | +20 |
| | 1.000+ | +15 (o +25 si la empresa vende a cuentas grandes) |
| **Sector** | Sector objetivo principal | +20 |
| | Sector objetivo secundario | +10 |
| | Otro sector | 0 |
| **Facturación anual** | Tramo pequeño | +5 |
| | Tramo medio | +10 |
| | Tramo grande | +15 |
| | Tramo muy grande | +20 |
| **Zona** | Mercado principal | +10 |
| | Mercado secundario | +5 |
| | Fuera de mercado | 0 |

(El original usa tramos en dólares: menos de 1 M, 1–10 M, 10–100 M y más de 100 M. Define los tramos con el dueño.)

### Atributos del contacto

| Atributo | Criterio | Puntos |
|---|---|---|
| **Cargo** | Dirección general (gerente general, director de tecnología, de marketing) | +25 |
| | Vicepresidencia / dirección de área | +20 |
| | Jefatura | +15 |
| | Gerencia media / coordinación | +10 |
| | Colaborador individual | +5 |
| **Área** | Área que compra | +15 |
| | Área cercana | +5 |
| | Área sin relación | 0 |
| **Rol en la compra** | Decide | +20 |
| | Influye | +10 |
| | Usuario final | +5 |

### Atributos de tecnología

| Atributo | Criterio | Puntos |
|---|---|---|
| **Herramientas** | Usa una herramienta complementaria | +15 |
| | Usa a un competidor | +10 (conoce la categoría) |
| | Usa la herramienta que la empresa reemplaza | +20 |
| **Madurez tecnológica** | Herramientas modernas, en la nube | +10 |
| | Sistemas antiguos | +5 |

---

## Puntuación implícita (interés)

La columna **caída** dice cuánto se resta con el tiempo para que una señal vieja no infle la puntuación.

### Señales de alta intención

| Señal | Puntos | Caída |
|---|---|---|
| **Pide demo** | +30 | Ninguna |
| **Visita precios** | +20 | −5 por semana |
| **Se registra en la prueba gratis** | +25 | Ninguna |
| **Formulario de contacto con ventas / pide cotización** | +30 | Ninguna |
| **Página de casos de éxito (2+)** | +15 | −5 cada 2 semanas |
| **Visita una página comparativa** | +15 | −5 por semana |
| **Usa la calculadora de retorno** | +20 | −5 cada 2 semanas |

### Señales de intención media

| Señal | Puntos | Caída |
|---|---|---|
| **Se inscribe a un webinar** | +10 | −5 por mes |
| **Asiste a un webinar** | +15 | −5 por mes |
| **Descarga un documento técnico** | +10 | −5 por mes |
| **Lee el blog (3+ en una semana)** | +10 | −5 cada 2 semanas |
| **Clic en un correo** | +5 por clic | −2 por mes |
| **Abre correos (3+)** | +5 | −2 por mes |
| **Interactúa en redes** | +5 | −2 por mes |

### Señales de baja intención

| Señal | Puntos | Caída |
|---|---|---|
| **Una visita al blog** | +2 | −2 por mes |
| **Abre el boletín** | +2 | −1 por mes |
| **Abre un correo** | +1 | −1 por mes |
| **Solo visitó la portada** | +1 | −1 por semana |

### Señales de uso del producto (cuando se vende solo)

| Señal | Puntos | Caída |
|---|---|---|
| **Creó cuenta** | +15 | Ninguna |
| **Completó la activación** | +20 | Ninguna |
| **Usó la función principal (3+)** | +25 | −5 por mes sin actividad |
| **Invitó a un compañero** | +25 | Ninguna |
| **Llegó al límite de uso** | +20 | −10 por mes |
| **Exportó datos** | +10 | −5 por mes |
| **Conectó una integración** | +15 | Ninguna |
| **Activo a diario 5+ días** | +20 | −10 cada 2 semanas sin actividad |

### Señales en un negocio local o de servicios

| Señal | Puntos | Caída |
|---|---|---|
| **Pide cita, visita o cotización** | +30 | Ninguna |
| **Pregunta precio por WhatsApp o redes** | +20 | −5 por semana |
| **Responde a un seguimiento** | +15 | −5 cada 2 semanas |
| **Guarda o comparte una publicación** | +5 | −2 por mes |

---

## Puntuación negativa

| Señal | Puntos | Notas |
|---|---|---|
| **Dominio de un competidor** | −50 | Marcar para revisión |
| **Correo de estudiante (.edu)** | −30 | A veces es válido |
| **Correo personal (gmail, hotmail)** | −10 | Poco relevante en B2B; en negocios pequeños o venta al consumidor no restes |
| **Se dio de baja de los correos** | −20 | Baja la puntuación de interés |
| **Rebote duro** | −50 | Sacar de la puntuación |
| **Queja de spam** | −100 | Sacar de todas las secuencias |
| **Cargo: estudiante / practicante** | −25 | Poca autoridad de compra |
| **Cargo: consultor** | −10 | Puede evaluar para un cliente |
| **Sin visitas en 90 días** | −15 | Caída de la puntuación |
| **Teléfono inválido** | −10 | Señal de mala calidad de datos |
| **Solo visitó la página de empleo** | −30 | Probablemente busca trabajo |

---

## Modelos de ejemplo

### Modelo 1: software que se vende solo (ticket anual bajo, p. ej. 500–5.000 en la moneda de referencia)

**Peso: 30 % encaje / 70 % interés (pesa mucho el uso del producto)**

**Encaje:** empresa de 10–500: +15 · sector objetivo: +10 · cargo de jefatura o más: +10 · usa herramienta complementaria: +10.

**Interés:** creó cuenta gratis: +15 · completó la activación: +20 · usó la función principal 3+ veces: +25 · invitó a un compañero: +25 · llegó al límite de uso: +20 · visitó precios: +15.

**Negativa:** correo personal: −10 · sin entrar en 14 días: −15 · dominio de competidor: −50.

**Umbral de MQL: 60 puntos.**
**Recalibrar: cada mes** (mucho volumen, respuesta rápida).

---

### Modelo 2: venta con vendedor a cuentas grandes (ticket anual alto, p. ej. 50.000+)

**Peso: 60 % encaje / 40 % interés (con este ticket, el encaje es crítico)**

**Encaje:** empresa de 500+: +20 · facturación en el tramo alto: +15 · sector objetivo: +15 · cargo de dirección o más: +20 · quien decide está confirmado: +15 · usa a un competidor: +10.

**Interés:** pidió demo: +30 · varias personas de la empresa interactúan: +20 · asistió a un webinar para directivos: +15 · descargó la guía de retorno: +10 · visitó precios 2+: +15.

**Negativa:** empresa demasiado pequeña (<100): −30 · solo colaboradores individuales: −15 · dominio de competidor: −50.

**Umbral de MQL: 75 puntos.**
**Recalibrar: cada trimestre** (ciclos largos, pocos casos).

---

### Modelo 3: empresa mediana, mixto (ticket anual medio, p. ej. 5.000–25.000)

**Peso: 50 % encaje / 50 % interés**

**Encaje:** empresa de 50–1.000: +15 · sector objetivo: +10 · cargo de jefatura a dirección: +15 · zona objetivo: +10 · usa herramienta complementaria: +10.

**Interés:** pidió demo o prueba: +25 · visitó precios: +15 · descargó un caso de éxito: +10 · asistió a un webinar: +10 · 3+ clics en correos: +10 · 5+ páginas del blog: +10.

**Negativa:** correo personal: −10 · sin interacción en 30 días: −10 · dominio de competidor: −50 · cargo de estudiante o practicante: −25.

**Umbral de MQL: 65 puntos.**
**Recalibrar: cada trimestre.**

---

## Calibrar el umbral

### Fijar el umbral inicial

1. **Saca las ventas ganadas** de los últimos 6–12 meses.
2. **Puntúa hacia atrás** cada una con el modelo nuevo.
3. **Busca el corte natural:** ¿qué puntuación separaba ganadas de perdidas?
4. **Fija el umbral** justo por debajo de donde habrían quedado el 80 % de las ganadas.
5. **Valida** con las perdidas: si muchas quedan por encima del umbral, endurece los criterios.

### Cada cuánto recalibrar

| Tipo de negocio | Frecuencia | Por qué |
|---|---|---|
| Se vende solo / mucho volumen | Mensual | Respuesta rápida, muchos datos |
| Empresa mediana | Trimestral | Ciclo moderado |
| Cuentas grandes | Trimestral a semestral | Ciclos largos, pocos casos |

### Pasos

1. **Saca los datos** de MQL a cierre del periodo.
2. **Compara puntuación con resultado:**
   - Puntuación alta + ganada = bien puntuado.
   - Puntuación alta + perdida = posible falso positivo (endurecer).
   - Puntuación baja + ganada = posible falso negativo (aflojar).
3. **Ajusta los pesos** según qué atributos se relacionaron de verdad con las ventas.
4. **Ajusta el umbral** si hay demasiados MQL (subirlo) o muy pocos (bajarlo).
5. **Documenta los cambios** y comunícalos al equipo de ventas.

### Señales de que hay que recalibrar

- La aceptación de MQL por ventas cae por debajo de 30 %.
- Ventas rechaza MQL una y otra vez como «no están listos».
- Los de puntuación alta no compran y los de baja sí.
- Suben los MQL sin que suba el ingreso.
- Cambió el producto o el mercado desde la última calibración.

Una revisión trimestral de la puntuación puede ser una **rutina** de la oficina (Ventas o Marketing, cada trimestre, que solo lee y propone): sugiérela al dueño.
