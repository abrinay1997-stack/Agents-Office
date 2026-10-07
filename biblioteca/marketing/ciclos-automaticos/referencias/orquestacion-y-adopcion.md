# Cómo se combinan los ciclos y en qué orden se encienden

Los ciclos no son piezas sueltas: forman un sistema operativo de marketing. Esta referencia explica cómo encajan y en qué orden conviene encenderlos, para no encender 45 de una vez. En la oficina, cada ciclo es una rutina; **encender un ciclo es crear una rutina, y el dueño decide cuántas leer**.

## La vista de conjunto

Los ciclos caen en cuatro capas. Los datos bajan y los aprendizajes suben.

```
SENTIR          anomalias-de-medicion · control-de-la-medicion · revision-semanal-de-marketing
                  │  (detectar qué cambió; primero confiar en las cifras)
                  ▼
DIAGNOSTICAR    vigilantes por etapa: abandono-en-la-activacion, senales-de-abandono,
                vigilancia-caidas-posicion, regresion-paginas-de-destino, fatiga-de-anuncios, …
                  │  (entender qué hacer al respecto)
                  ▼
ACTUAR          borradores listos, empujones, contactos, movimientos de presupuesto
                  │  (casi todos con el OK del dueño)
                  ▼
APRENDER        cajon-de-experimentos · balance-de-campanas · voz-del-cliente
                  │  (guardar lo que funcionó)
                  └──────────────► vuelve a SENTIR y a DIAGNOSTICAR
```

Los hilos que los unen:
- **`revision-semanal-de-marketing` es el enrutador.** Lee las cifras principales y reparte cada movimiento notable al ciclo que lo atiende. Es el único que ve todo el tablero.
- **`control-de-la-medicion` y `anomalias-de-medicion` son el cimiento.** Todos los demás ciclos leen la analítica. Si la medición está rota, todo lo que viene después actúa sobre mentiras. Van primero.
- **`cajon-de-experimentos` es el sumidero.** Las hipótesis que generan muchos ciclos (fugas en el registro, precios, activación, voz del cliente) llegan aquí y de aquí pasan a `pruebas-ab`. Que cada ciclo no haga sus propias pruebas.
- **`voz-del-cliente` es una fuente.** El lenguaje del cliente que extrae alimenta el texto de la fatiga de anuncios, las secuencias de correo, las páginas de destino y los precios (y la nota `00-Empresa/marketing`).
- **`balance-de-campanas` cierra el círculo.** Sus aprendizajes son las hipótesis y los insumos del próximo plan.

Evita la propiedad duplicada: cuando dos ciclos podrían actuar sobre la misma señal, uno es el dueño de la acción y el otro solo avisa. (Un cliente en riesgo es de `senales-de-abandono`, no de `ampliacion-y-venta-adicional`: nunca le vendas más a quien se está yendo.) En la oficina eso se traduce en que cada rutina tiene un solo puesto responsable, y en que el texto de una dice «si ves X, dáselo a la rutina Y» en vez de hacerlo ella.

## Orden de adopción

Enciende un ciclo solo cuando los anteriores corren y se ganan su lugar. Cada etapa supone que la anterior está sólida.

**Etapa 0 — Cimiento (confiar en los datos y ver el tablero).**
`control-de-la-medicion`, `revision-semanal-de-marketing`.
No se puede correr ningún ciclo con responsabilidad sobre datos poco fiables ni sin un pulso de todo el embudo. Esto va primero.

**Etapa 1 — Tapar las fugas (el mayor retorno; protege lo que ya ingresa).**
`cobros-fallidos`, `senales-de-abandono`, `renovar-secuencias-de-correo`.
Recuperar a los clientes que ya tienes cuesta menos que conseguir nuevos. Solo el recobro de pagos suele pagar todo el sistema.

**Etapa 2 — Convertir lo que ya llega (arregla el balde antes de echar más agua).**
`abandono-en-la-activacion`, `fugas-en-el-registro`, `conversion-de-la-prueba`.
Más tráfico en un embudo con fugas es desperdicio. Sella primero la activación y la conversión.

**Etapa 3 — Hacer crecer la parte alta (ahora sí, escalar la captación).**
`huecos-palabras-clave`, `reutilizar-contenido`, `fatiga-de-anuncios`, `escucha-en-redes`, `anomalias-de-medicion`.
Con el balde sellado, enciende la generación de demanda y el vigilante de anomalías como red de seguridad.

**Etapa 4 — Optimizar la monetización.**
`experimentos-pagina-de-precios`, `optimizacion-pantalla-de-mejora`, `intencion-de-compra`, `ampliacion-y-venta-adicional`.
Cuando el volumen es sano, afina el ingreso por cliente, juzgado por la calidad del ingreso y no solo por la conversión.

**Etapa 5 — Acumulación y recomendación.**
`empujon-de-referidos`, `cosecha-de-resenas-y-contenido`, `gestion-de-sitios-de-resenas`, `busqueda-de-casos-de-exito`, `flujo-de-alianzas`, `menciones-y-reputacion`, `cajon-de-experimentos`, `balance-de-campanas`.
El volante: clientes contentos y menciones ganadas que alimentan la captación, más los ciclos de aprendizaje que hacen que todo se acumule.

Los demás ciclos del catálogo (`contenido-que-se-desgasta`, `enlaces-internos`, `calidad-seo-programatico`, `relleno-calendario-editorial`, `mineria-busquedas-de-pago`, `higiene-del-remarketing`, `regresion-paginas-de-destino`, `participacion-en-comunidades`, `vigilancia-de-la-competencia`, `busqueda-de-enlaces`, `altas-en-directorios`, `activo-de-captacion`, `adopcion-de-funciones`, `reactivacion`, `entregabilidad-del-correo`, `voz-del-cliente`, `lote-diario-de-creativos`, `revision-mensual-de-creativos`, `aprovechar-la-noticia`) entran en la etapa que corresponde a su función, a medida que cada canal se vuelve prioridad.

## Cómo pensarlo según el tipo de negocio

No todos necesitan todas las etapas. Una orientación (no una regla):
- **Negocio local de servicios (clínica, taller, peluquería, gimnasio)**: etapa 0 simple (¿llegan las reservas y los mensajes?), `revision-semanal-de-marketing`, `menciones-y-reputacion` y `gestion-de-sitios-de-resenas`, `reactivacion` (clientes que no volvieron), `empujon-de-referidos`, `altas-en-directorios` (mapas y directorios de la ciudad) y `cobros-fallidos` si factura a plazo.
- **Tienda en línea o física**: `control-de-la-medicion`, `senales-de-abandono` (recompra), `reactivacion`, `fatiga-de-anuncios`, `lote-diario-de-creativos`, `cosecha-de-resenas-y-contenido`, `reutilizar-contenido`.
- **Agencia o consultoría**: `revision-semanal-de-marketing`, `intencion-de-compra` (consultas entrantes), `busqueda-de-casos-de-exito`, `flujo-de-alianzas`, `vigilancia-de-la-competencia`, `aprovechar-la-noticia`.
- **Producto digital (SaaS, app, curso)**: el catálogo completo tal como está, en el orden de arriba.

## Reglas de adopción

- **Uno por uno.** Demuestra que un ciclo se gana su lugar (alguien actúa sobre lo que entrega, mueve su métrica) antes de añadir el siguiente.
- **Cimiento antes que crecimiento.** Captación antes de una medición sólida y de retención es echar agua a un balde con fugas.
- **Pon un tope al total.** Si corres más ciclos de los que puedes leer, tienes ciclos de vanidad. Retira los que nadie usa (pausa la rutina o bórrala).
- **Revísalos cada trimestre.** Recalibra los umbrales, quita los ciclos muertos y asciende los que consistentemente mueven a la acción.
- **Cuida el costo.** Cada ejecución de una rutina es una llamada a un modelo: un ciclo diario cuesta unas 30 ejecuciones al mes. Una rutina que casi siempre dice «sin novedad» puede pasar de diario a semanal sin perder nada. (La ventana «Costos y retorno» de la oficina muestra el costo por tarea y por agente, y sugiere qué rutina nadie lee.)
