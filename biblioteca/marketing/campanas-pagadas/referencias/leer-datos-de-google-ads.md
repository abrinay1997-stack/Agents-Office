# Cómo leer los datos de Google Ads sin sacar conclusiones falsas

Lee esto antes de analizar, auditar o informar sobre una cuenta de Google Ads, o antes de decidir si pausar, mantener o escalar algo en ella. `auditoria-y-criterio.md` explica cómo *calificar* lo que encuentres. Este archivo explica cómo los datos *te engañan* antes de llegar ahí.

Los informes de Google Ads son parciales por diseño y verosímiles por accidente. Las vistas por defecto omiten datos sin avisar, los nombres de los recursos sugieren contenidos que no tienen y las cuentas pequeñas producen números que parecen hallazgos. La mayoría de las conclusiones equivocadas vienen de no saber esto, no de razonar mal.

(Si la empresa tiene la cuenta conectada, trabaja con lo que el conector te devuelva; si no, pide al dueño las exportaciones: términos de búsqueda sin filtrar, conversiones por acción, historial de cambios.)

## Lo que los datos esconden

### Los términos de búsqueda son una muestra, no el total

Google oculta cualquier búsqueda hecha por muy pocas personas. En cuentas de poco volumen, **entre el 50 y el 65 % de los clics suele no tener término de búsqueda divulgado.** Los términos visibles son una muestra no aleatoria, inclinada hacia las búsquedas comunes.

- Toda afirmación sobre «qué está comprando esta campaña» lleva la proporción: *de los 13 clics que Google divulga, de 33 en total.*
- Saca el informe **sin filtrar primero**. Filtrar por `clics > 0` también descarta todos los términos con solo impresiones y, junto con un `LIMIT` bajo, esconde la mayor parte del cuadro.
- **Nada recupera las búsquedas ocultas.** La búsqueda nunca se le pasa al sitio, así que GA4, PostHog o un CRM pueden mostrar qué *hizo* cada sesión (unida por gclid), nunca qué se *escribió*.

```
clics divulgados = SUMA(clics del informe de términos de búsqueda)
clics totales    = clics de la campaña en la misma ventana
ocultos          = totales - divulgados
```

### Los nombres describen intenciones, no contenidos

Un grupo de anuncios llamado «Competidor - Comercial» puede tener palabras clave puramente informativas. Una campaña con el nombre de un tema puede apuntar a otro. Lee la lista de palabras clave y los términos de búsqueda; trata cada nombre como una etiqueta que alguien escribió una vez.

### «Conversiones» son varias cosas en una sola columna

`metrics.conversions` cuenta las acciones marcadas como principales, más cualquier acción secundaria que el objetivo personalizado de una campaña incluya. `metrics.all_conversions` suma el resto. Revisa los objetivos de campaña además de los ajustes de cada acción. Las conversiones de una campaña pueden mezclar una vista de página usada como indicador, un registro de prueba y una demo agendada.

- Segmenta por acción de conversión antes de llamar «contacto» o «demo» a nada.
- Revisa de paso el modelo de atribución y la ventana de clic de cada acción.
- La atribución basada en datos también funciona con poco volumen, pero con pocas conversiones sus asignaciones individuales de crédito son blandas. No leas mucho en la parte de una sola campaña.

### Un grupo de anuncios puede mandar tráfico a varias páginas

Los anuncios llevan sus propias URL finales, y las páginas viejas siguen en rotación mucho después de lanzar una página nueva. Antes de concluir nada sobre el rendimiento de una página de destino, revisa qué destinos están sirviendo y cómo se reparte el tráfico entre ellos.

### Las fechas son fechas de clic

Las conversiones se atribuyen al clic que las originó. Una conversión registrada hoy puede aparecer con fecha de una semana antes. Cuando un cliente dice «tuvimos una conversión hoy» y tu extracción dice el día 11, los dos tienen razón. Di «clic del día 11».

### Los nombres de campaña idénticos suelen ser ramas de un experimento

Las ramas vencidas de un experimento heredan el nombre de la campaña base y pueden seguir con estado HABILITADO sin servir nada. Revisa `campaign.experiment_type` y `campaign.serving_status` antes de creer que existe un duplicado.

### El historial de cambios es corto: 30 días con detalle, 90 sin él

`change_event` (antes y después por campo) cubre 30 días. `change_status` cubre 90 días pero solo dice qué recurso cambió, no qué. Más allá no hay nada en la API. Un cambio de rendimiento de hace cuatro meses puede no tener explicación recuperable: dilo, en vez de adivinar una.

### Otras personas cambian la cuenta

El personal del cliente, las reglas automáticas, los scripts y los agentes dejan cambios. En `change_event`, `client_type` dice qué cliente hizo el cambio: `GOOGLE_ADS_WEB_CLIENT` (la interfaz), `GOOGLE_ADS_API`, `GOOGLE_ADS_SCRIPTS`, `GOOGLE_ADS_AUTOMATED_RULE`, `GOOGLE_ADS_BULK_UPLOAD`, `GOOGLE_ADS_RECOMMENDATIONS`, `INTERNAL_TOOL` (herramientas de Google) y otros. Informa el cliente, no una conjetura de quién o por qué: un cambio por API puede ser una herramienta de agencia o un script. Los cambios hechos con Google Ads Editor no se devuelven, así que una edición ausente no significa que nadie la hiciera. Un patrón repetido de día de la semana y hora bajo un usuario es una tarea programada, no una persona.

## La ventana no es el cuadro completo

Una extracción de 30 días de una campaña que corre desde la primavera es un corte de una serie más larga. El CPA reciente puede diferir mucho del CPA de toda la vida.

- **Establece cuánto tiempo lleva corriendo** antes de citar cualquier cifra de eficiencia. Cita la reciente y la histórica cuando difieran.
- **No juntes periodos separados por cambios de configuración.** Si cambiaron las pujas, palabras clave, presupuesto, anuncios o segmentación a mitad de la ventana, el periodo son varios experimentos promediados.
- **Los cambios solo de puja son un caso especial.** Invalidan las comparaciones de costo y volumen pero dejan legibles las preguntas de intención y audiencia.
- **Las estrategias de puja en aprendizaje no se pueden leer.** `primary_status = LEARNING` significa que no juzgues el rendimiento ni optimices con eso. Arreglar una falla verificada (seguimiento caído, URL equivocada) va primero; ver `auditoria-y-criterio.md`.

## Números pequeños

La mayoría de los hallazgos falsos en cuentas pequeñas son errores de tamaño de muestra que parecen visión. El escepticismo va en ambos sentidos: una conversión en un clic no prueba más de lo que cero conversiones en cinco clics desmienten.

Cero conversiones en N clics solo descarta tasas de conversión iguales o mayores a (95 % de confianza):

| Clics | Descarta una tasa de conversión ≥ | Qué puedes decir |
|---|---|---|
| 5 | 45 % | Nada. Cero es el resultado esperado |
| 10 | 26 % | Todavía nada útil |
| 30 | 10 % | Puedes empezar a dudar de una tasa fuerte |
| 50 | 6 % | Significativo para búsqueda de intención alta |
| 100 | 3 % | Rinde por debajo si la tasa de equilibrio es mayor de 3 % |

Antes de llamar «desperdiciado» a un gasto, calcula con qué tasa tendría que convertir para valer la pena:

```
tasa de conversión de equilibrio = CPC ÷ CPA objetivo
```

Si la tasa de equilibrio está por debajo del rango plausible para ese tráfico, el término no está fallando: está sin medir. Luego estima cuánto tarda una muestra legible con el volumen de clics actual. «Déjalo correr» solo es una respuesta honesta si viene con una fecha en la que de verdad lo sabrás. Con cinco clics al mes, a veces la respuesta honesta es que nunca lo sabrás.

## Los documentos describen un día; las cuentas se mueven

Las auditorías, los documentos de estado y las propuestas eran ciertos cuando se escribieron. Todo número de rendimiento en ellos está viejo hasta que se vuelva a extraer. Las afirmaciones con más probabilidad de repetirse con seguridad («cero conversiones», «gasto desperdiciado», «intención equivocada») son justo las que cambian. Lleva la fecha junto a la afirmación: *a la fecha de la auditoría del día 2*.

## Cómo enunciar los hallazgos

Sabe de cuál de estos tipos es cada afirmación:

- **Verificada**: extraída en vivo en esta sesión, sin filtrar y reconciliada contra un total
- **Inferida**: razonada a partir de datos verificados; podría estar equivocada
- **Vieja**: de un documento, de una sesión anterior o del cliente, con su fecha

Deja fuera de las frases dirigidas al cliente las afirmaciones viejas, a menos que estén rotuladas como tales.

**La prueba antes de que algo le llegue al cliente: ¿puede desmentirlo en un minuto con el acceso a su propia cuenta?** Tiene los mismos informes. Adelanta tú los límites (la proporción de clics divulgados, el tamaño de muestra, los cambios de configuración). No cuesta nada, porque los encontraría igual, y es lo que hace creíble el resto.

Si una afirmación toca una página de destino, ábrela. No caracterices una página por su URL, por un documento de estado ni por lo que el cliente dice que hay. Los calendarios incrustados y los chats se cargan con JavaScript y no aparecen en una descarga estática, así que su ausencia ahí no es evidencia.

Cuando un cliente cuestiona un hallazgo y tiene razón, concede el fondo con claridad y sigue. Las retractaciones apiladas cuestan más credibilidad que el error original.

## Conclusiones que suenan bien

| Suena a | Suele ser |
|---|---|
| «Esta campaña tiene cero conversiones» | Cierto el día en que se escribió el documento |
| «Los términos de búsqueda son basura» | Estás viendo ~40 % de los clics |
| «Ese grupo de anuncios es de intención equivocada» | Se *llama* así; las palabras clave dicen otra cosa |
| «Se desperdiciaron $X en esos términos» | Por debajo de cualquier tamaño de muestra legible |
| «Convirtió, así que el término funciona» | Una conversión en un clic es ruido |
| «El rendimiento cayó en agosto» | Las pujas cambiaron tres veces ese mes |
| «El tráfico llega a la página nueva» | Sirven dos anuncios; uno apunta a la página vieja |
| «Consiguió una demo» | Consiguió una conversión; revisa qué acción |
| «Hay campañas duplicadas» | Ramas vencidas de un experimento con el nombre de la base |
| «Nadie tocó nada el trimestre pasado» | El historial de cambios solo cubre 30 días |
