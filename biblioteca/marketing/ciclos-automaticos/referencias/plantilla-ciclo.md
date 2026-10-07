# Plantilla para crear un ciclo propio

Una plantilla para escribir tu propio ciclo de marketing y proponerlo como rutina de la oficina. Llena las nueve partes de la anatomía: un ciclo al que le falte la **memoria**, la **autocomprobación** o la **condición de parada** no es un sistema: es una forma de hacer lo equivocado, con horario.

Antes de empezar, comprueba que esto **debería** ser un ciclo (ver «Cuándo NO hacer un ciclo» en `SKILL.md`): es recurrente, lo mueve una señal y no exige criterio humano para fijar la estrategia o la dirección creativa en cada ejecución.

---

## Plantilla en blanco (cópiala)

```markdown
### El ciclo de <nombre> (`<id-en-minusculas-con-guiones>`)
- **Cada cuánto revisa**: <cada cuánto mira: ajústalo a lo rápido que cambia la señal, no a lo seguido que quisieras un aviso>
- **Actúa cuando**: <la condición de acción: qué debe ser verdad para HACER algo y no solo mirar y saltar. La mayoría de las ejecuciones deberían saltar.>
- **Para qué**: <el ÚNICO resultado que este ciclo existe para mover>
- **Habilidades**: <las habilidades de la biblioteca que orquesta en cada ejecución, con sus ids>
- **Pasos**:
  1. <paso, normalmente: reunir los datos / compararlos con la última ejecución>
  2. <paso: identificar qué, si algo, cruzó la condición de acción>
  3. <paso: redactar o dejar preparada la respuesta>
- **Autocomprobación**: <la verificación ANTES de actuar: ¿la señal es real o es ruido, estacionalidad o un fallo de medición? ¿La muestra es suficiente?>
- **Memoria**: <qué recuerda entre ejecuciones: marca de la última ejecución, clave para no repetir, enfriamiento, conjunto de «ya atendidos»; así no actúa dos veces ni le insiste a la misma gente>
- **Para o escala**: <cuándo salta, se detiene, escala a una persona o se desactiva, y qué hace ante un error. Incluye el punto de aprobación del dueño antes de cualquier cosa que gaste dinero, envíe o publique.>
- **Entrega**: <a dónde van los resultados: un informe, un borrador listo, una pieza en Contenido, un aviso>
- **Rutina**: puesto `<id del puesto>` (<departamento>) · `<el when en JSON>` · espera el OK: <sí/no y por qué>
- **Texto de la tarea**: «<el pedido, escrito como lo escribiría el dueño>»
- **Necesita**: <los datos y conectores que pide; qué hace si no los tiene>
```

---

## Preguntas para llenarla (respóndelas en orden)

1. **¿Qué resultado protege o hace crecer?** (posiciones, eficiencia de los anuncios, activación, retención, ingresos, recomendaciones) → *Para qué*
2. **¿Qué tan rápido cambia de verdad esa señal?** (horas / días / semanas / meses) → *Cada cuánto revisa*
3. **¿Qué debe ser cierto para que valga la pena actuar?** (un umbral cruzado, un elemento nuevo, un retroceso frente a la línea base) → *Actúa cuando*
4. **¿Qué datos lee y qué produce en cada ejecución?** → *Pasos* y *Entrega*
5. **¿Qué la haría actuar sobre una señal falsa?** (ruido, estacionalidad, una medición rota, una muestra muy pequeña) → *Autocomprobación*
6. **¿Qué debe recordar para no repetirse?** (una clave, un enfriamiento, una marca de última ejecución) → *Memoria*
7. **¿Cuándo debe detenerse, saltar o pasar a una persona?** (no hay nada que hacer, un error, una decisión de gasto o publicación, N intentos fallidos) → *Para o escala*
8. **¿Quién de la oficina la lleva y cuándo?** (el puesto cuyo trabajo se parece más, y la hora en que el dueño la querría leer) → *Rutina*

Si no puedes responder 5, 6 y 7 con concreción, el ciclo no está listo para correr.

---

## Ejemplo trabajado (de en blanco a lleno)

Supón que tienes una clínica dental con una página de reservas y quieres dejar de perder a quienes piden cita y nunca llegan a la primera consulta.

```markdown
### El ciclo de primera cita (`primera-cita`)
- **Cada cuánto revisa**: diario
- **Actúa cuando**: alguien reservó hace 48 horas, todavía no confirmó su cita y no está ya en esta secuencia.
- **Para qué**: aumentar la parte de quienes reservan que llegan a su primera consulta.
- **Habilidades**: `activacion-clientes`, `secuencias-correo`, `sms-whatsapp`, `medicion-analitica`
- **Pasos**:
  1. Reunir las reservas de hace unas 48 horas y su estado de confirmación.
  2. Filtrar las que siguen sin confirmar y no tienen un recordatorio activo.
  3. Redactar un recordatorio dirigido («tu cita es el…, esto es lo que debes traer, responde para cambiarla»).
- **Autocomprobación**: ¿«sin confirmar» es una falta real de respuesta o un hueco de registro (confirmaciones que llegaron pero no se anotaron)? Confírmalo con la agenda de la recepción antes de escribirle a alguien que sí confirmó.
- **Memoria**: quiénes ya entraron en esta secuencia; excluir a quien confirmó desde entonces; un solo recordatorio por persona y etapa.
- **Para o escala**: tras 2 recordatorios sin respuesta, parar y pasar a la lista de llamadas de la recepción: no seguir escribiendo. Saltar la ejecución si la agenda parece desactualizada.
- **Entrega**: un recordatorio como borrador por cada reserva que califica, con el teléfono exacto + el conteo diario de citas confirmadas.
- **Rutina**: puesto `ona` (delivery) · `{"kind":"weekdays","at":"09:00"}` · espera el OK: sí (son mensajes a pacientes).
- **Texto de la tarea**: «Mira las reservas hechas hace unos dos días que aún no confirmaron su cita…»
- **Necesita**: la lista de reservas con su estado (la agenda de la clínica, pegada por la recepción).
```

Fíjate en lo que lo hace seguro: la **autocomprobación** evita escribirle a quien sí confirmó por un hueco de registro, la **memoria** evita insistir, y la **parada** limita los intentos y pasa a una persona en vez de repetir para siempre. Y como son mensajes a pacientes, la rutina **espera el OK**: nada sale solo.

---

## Lista de revisión antes de proponerlo

- [ ] Las nueve partes están llenas, sobre todo autocomprobación, memoria y parada.
- [ ] La cadencia coincide con la velocidad de la señal (no miras a diario algo que se mueve cada semana).
- [ ] Está diseñado para que **la mayoría de las ejecuciones no hagan nada**: solo actúa ante una condición real.
- [ ] Todo lo que **gasta dinero, envía o publica** tiene un punto de aprobación del dueño.
- [ ] La memoria impide actuar dos veces y insistirle a la misma gente.
- [ ] Hay un camino de error (datos desactualizados → informa «desactualizado», no inventa movimiento) y un interruptor manual (la rutina se pausa con `"paused": true`).
- [ ] La rutina trae puesto, `when`, texto y si espera el OK, y el puesto existe en el departamento que dices.

Cuando ya corra, dale unas cuantas vueltas y hazte la pregunta del «ciclo de vanidad»: si nadie actúa sobre lo que entrega, bórralo.
