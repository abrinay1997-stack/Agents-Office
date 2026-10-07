# La memoria de un ciclo y su registro de ejecuciones

La idempotencia solo es real si el ciclo puede recordar lo que ya hizo entre una ejecución y otra. Esta referencia define dónde vive esa memoria en la oficina y cómo se registra cada ejecución, para que un ciclo no actúe dos veces, no le insista a la misma gente y no repita la misma alerta.

## Dónde vive la memoria en la oficina

Los agentes no tienen archivos ni terminal: no pueden guardar un `.json` entre ejecuciones. Su memoria es **el texto de su propia entrega**. Cada ejecución de un ciclo termina con un bloque fijo:

```
## Estado del ciclo
- Última ejecución: 2026-10-07
- Marca (hasta dónde miré): 2026-10-06 23:59
- Ya atendidos (claves, sin datos personales): C-1042, C-1077
- Enfriamientos (clave → no tocar hasta): C-1042 → 2026-10-21
- En curso (pruebas o gestiones abiertas): prueba-precios-3
- Contadores (intentos por clave): C-1042 = 2
```

La ejecución siguiente **lee el bloque de la última entrega de la misma rutina** (con `ver_tareas` busca la tarea anterior de esa rutina; `ver_mi_tarea` te dice cuál es la actual) y parte de ahí. Además, el dueño puede dejar en el Cerebro una nota con el estado que quiere conservar (una lista de directorios ya enviados, la hoja de ruta creativa, el cajón de experimentos): si existe, se lee igual que cualquier otra nota de la empresa y, cuando el ciclo la cambia, la entrega trae el texto completo nuevo para que el dueño lo guarde.

Si no encuentras el bloque anterior (primera ejecución, o la entrega no está), dilo en una línea, trata esta ejecución como la primera y aplica «primera ejecución» más abajo. **Nunca supongas lo que hiciste.**

## Qué guardar

El bloque guarda lo que el ciclo necesita para no repetirse:

- **Marca de avance (cursor)** — hasta dónde se procesó (una fecha o un identificador). El ciclo solo mira lo posterior.
- **Ya atendidos** — claves de lo que ya se trabajó, para que las ejecuciones siguientes lo salten.
- **Enfriamientos** — por cliente o por elemento, hasta cuándo no se le debe volver a tocar. Nunca contactes a alguien dentro de su ventana.
- **En curso** — pruebas, gestiones o piezas abiertas, para no iniciar otra que choque.
- **Contadores** — número de intentos que activan una condición de parada («tras 2 correos de reconquista, parar»).

Mantén el bloque corto y poda: borra los «ya atendidos» y los enfriamientos cuando pasó su ventana.

## Patrones de idempotencia

- **Marca de avance**: procesa solo lo posterior a la marca; avánzala al final de una ejecución correcta. Repetirla no reprocesa.
- **Conjunto de atendidos**: antes de actuar sobre un elemento, comprueba su clave; añádela después de actuar.
- **Mapa de enfriamientos**: antes de contactar a alguien, mira su enfriamiento; ponlo después del contacto.
- **Guardia de «en curso»**: antes de empezar algo que no debe solaparse (una prueba, una gestión), mira lo que está en curso.

## El registro de ejecuciones

El registro es la **primera línea de cada entrega**, haya actuado o no. Es la pista de auditoría y el detector de ciclos de vanidad.

```
2026-10-07 · revisé=312 · actué=2 · nota="2 clientes nuevos en riesgo, gestiones preparadas"
2026-10-08 · revisé=298 · actué=0 · nota="sin novedad"
2026-10-09 · revisé=305 · actué=0 · nota="sin novedad"
```

Anota como mínimo: la fecha, cuántos elementos revisó, en cuántos actuó y una nota corta. La oficina guarda además, por su cuenta, el historial de cada rutina en el calendario: las ejecuciones pasadas aparecen como hecha ✓, falló ⚠, saltada o no corrió. Con las dos cosas se responde:
- **¿Es un ciclo de vanidad?** Si todas las ejecuciones son `actué=0` durante semanas y nadie lo extraña, o si actúa en todas (señal de que persigue ruido), reconsidéralo.
- **¿Actuó dos veces?** Dos ejecuciones sobre el mismo elemento significan que la memoria no está funcionando.

## Reiniciar y rellenar con seguridad

- Para **reiniciar** un ciclo, borra la marca y los «ya atendidos», pero **conserva los enfriamientos**: reiniciar no debe hacerle ruido a quien fue contactado hace poco.
- En la **primera ejecución** (sin estado), pon la marca en «ahora» en vez de procesar todo el historial; si no, escribirás a todo lo histórico. Si de verdad quieres un relleno del pasado, haz primero una prueba en seco (di qué harías, no prepares nada) y respeta los enfriamientos.
- Si la computadora estuvo dormida, la oficina hace la ejecución atrasada una vez (o la salta si la rutina tiene `catchUp: false`): el ciclo debe aguantar que haya un hueco en su marca de avance y mirar todo lo posterior a ella.
- Nunca pongas datos personales en el bloque de estado ni en el registro: usa claves internas o iniciales («C-1042»), nunca nombres completos, correos o teléfonos (ver `guardarrailes.md`).
