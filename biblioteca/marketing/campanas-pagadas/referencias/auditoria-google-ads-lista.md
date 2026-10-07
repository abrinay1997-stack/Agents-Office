# Lista de auditoría de Google Ads (comercio electrónico)

Una auditoría detallada, orientada al comercio electrónico, de una cuenta real de Google Ads + Merchant Center: 32 revisiones en 11 categorías, hecha para encontrar gasto desperdiciado, descubrir oportunidades de prospección y sacar a la luz ingresos incrementales antes de escalar.

**Lee primero `auditoria-y-criterio.md`: gobierna cómo se puntúa cada punto de abajo.** Cada revisión termina en exactamente uno de **pasa / falla / desconocido / no aplica**. Un *desconocido* (evidencia no disponible) baja la cobertura, nunca la salud. *No aplica* (p. ej., revisiones de Shopping en una cuenta de generación de contactos) no afecta a ninguna. No califiques lo que no pudiste ver, no inventes palabras negativas y deja en borrador todo cambio antes de tocar una cuenta real. Se trabaja con lo que el dueño exporte o con el conector que la empresa tenga conectado; los cambios los aplica el dueño o quien administre la cuenta.

Trabaja de arriba abajo. Para cada punto, anota el resultado, la evidencia que viste (o la fuente que falta) y, si falla, un arreglo en borrador, no aplicado.

---

## Seguimiento

1. **Configuración del seguimiento de conversiones**: confirma una única fuente de verdad para las compras. Dos sistemas contando el mismo pedido (importación de GA4 + etiqueta nativa, o un gtag duplicado) inflan las conversiones y hacen que la puja optimice hacia un volumen fantasma. *Falla si hay doble conteo o falta el valor de compra; pasa con una conversión de prueba verificada con el valor y la moneda correctos.* Detalle: `seguimiento-de-conversiones.md`.

## Segmentación

2. **Lista de clientes para segmentar audiencias**: revisa que haya una lista de correos de clientes con hash subida y *realmente usada*: como señal o semilla de audiencias similares para prospectar, y como exclusión donde corresponda (compradores actuales en campañas que no son de venta adicional). Subida pero sin uso es un fallo. Detalle: Customer Match en `segmentacion-de-audiencias.md`.
3. **Listas de palabras clave negativas** *(Búsqueda, Shopping)*: revisa las negativas compartidas y de campaña por búsquedas irrelevantes, fuera de mercado o no rentables que drenan presupuesto. **Sin informe de términos de búsqueda → desconocido, no fallo.** Nunca nombres negativas candidatas de imaginación; pide el informe y haz la revisión de sobrebloqueo (ver `auditoria-y-criterio.md`).

## Estructura de campañas

4. **Separación marca / no marca**: aísla el tráfico de marca en su propia campaña. Los términos de marca enterrados en campañas «genéricas» o comodín inflan el ROAS combinado y esconden la ineficiencia de lo que no es marca. Falla si marca y no marca comparten campaña sin forma de leerlas por separado.

## Merchant Center (GMC)

5. **Ajustes de envío**: confirma que las velocidades y costos de envío configurados coinciden con el cumplimiento real. Una velocidad subestimada pierde la subasta; una sobreestimada arriesga el rechazo. Los umbrales de envío gratis deben reflejarse.
6. **Promociones**: revisa que las rebajas, descuentos y ofertas permanentes estén configurados como promociones de GMC para que se vean como enlaces de promoción en los anuncios de Shopping. Faltar = dejar CTR sobre la mesa.
7. **Títulos del feed de productos**: los primeros ~70 caracteres del título hacen el posicionamiento y el clic. Verifica que la palabra clave de mayor intención, y luego la característica o beneficio clave, estén *antes* del recorte: los títulos que empiezan con la marca desperdician ese espacio, salvo que la marca sea la búsqueda.
8. **Imágenes de producto**: evalúa si las imágenes destacan en el carrusel de Shopping (limpias, sobre fondo blanco donde se exija, pero distintas de las de la competencia). Una imagen débil topa el CTR sin importar la puja. (Si hay que rehacer fotos de producto, pídelas al Estudio con `generar_imagen` o `aplicar_preset`, y que las apruebe el dueño.)
9. **Resumen de calidad de la tienda**: lee los diagnósticos de Merchant Center: productos rechazados, atributos faltantes o inválidos (GTIN, disponibilidad, discrepancias de precio) y advertencias del feed. Productos rechazados = fuga silenciosa de ingresos con cero impresiones.
10. **Calificaciones de producto**: verifica que las calificaciones de cada producto se sincronicen desde la fuente de reseñas y se muestren como estrellas. Un feed configurado que no muestra estrellas es un fallo que vale la pena perseguir.
11. **Impresiones en productos elegibles**: revisa que se esté sirviendo todo el catálogo y no que unos pocos productos estrella absorban todas las impresiones. Los productos elegibles con cero impresiones son inventario sin probar.

## Shopping

12. **Segmentación de campañas**: confirma que cada segmento de Shopping/PMax tenga suficiente volumen de conversiones (~30–50+ al mes) para que la puja aprenda. La sobresegmentación deja sin datos a todos los grupos; consolida antes de añadir estructura.
13. **Reparto del presupuesto entre productos**: rastrea si el gasto fluye hacia productos de retorno positivo. Si los perdedores se comen el presupuesto mientras los ganadores están topados, es un fallo de reasignación (deja el cambio en borrador; no reestructures una campaña en aprendizaje por reflejo).

## Pujas y presupuesto

14. **Estrategia de puja en marca** *(Búsqueda)*: en marca, los clics de alta intención son baratos y casi seguros; un tROAS básico o «maximizar valor de conversión» puede dejar que Google pague de más por un volumen que ganarías igual. Prefiere control manual o de cartera, o una meta ajustada en marca.
15. **Metas de puja de las campañas**: verifica la cordura de cada ROAS o CPA objetivo según el tipo de campaña (marca frente a no marca, producto estrella frente a cola larga). Una sola meta general sobre economías distintas es un fallo; y según `auditoria-y-criterio.md`, una sola razón presupuesto-CPA no sirve para todos los objetivos.
16. **Términos que no son de marca en campañas de marca**: lee los términos de búsqueda de la campaña de marca en busca de búsquedas genéricas que se colaron. Muévelos a no marca para que el ROAS de marca no se sostenga con gasto de prospección.
17. **Estrategia de puja fuera de marca** *(Búsqueda, PMax, Shopping, Demand Gen)*: ajusta la estrategia al volumen y a la meta: la puja basada en valor necesita datos de conversión; las campañas con poco volumen pueden necesitar primero manual o tCPA. Una estrategia desajustada con poco volumen nunca sale del aprendizaje.

## Búsqueda

18. **Términos de búsqueda nuevos para expandir**: explora el informe de términos de búsqueda en busca de búsquedas que convierten y aún no están segmentadas directamente; expande a palabras clave y devuelve ese lenguaje a los títulos de productos y al contenido. (El mismo informe condiciona el punto 3: sácalo una vez y úsalo para ambos.)
19. **Rendimiento del texto de los anuncios**: revisa el CTR en relación con las impresiones, la calidad del anuncio (ad strength) y si se renuevan los que rinden menos. Un texto débil sube el CPC por el Nivel de Calidad antes de costar una sola conversión.
20. **Tipos de concordancia en palabras de marca**: las palabras clave de protección de marca deben correr solo en exacta o de frase. Amplia en marca invita a Google a gastar el presupuesto de marca en búsquedas vagamente relacionadas y de menor intención.
21. **Calidad del texto de los anuncios de marca**: verifica que los anuncios de marca usen un formato consistente, abran con los diferenciales y sigan el calendario promocional. La marca es tu superficie de mayor intención; un texto genérico de marca convierte de menos a una audiencia cautiva.
22. **Nivel de Calidad (Quality Score)**: un nivel bajo significa mayor CPC y peor posición para la misma puja. Léelo como diagnóstico (componentes de CTR esperado / relevancia del anuncio / experiencia de la página de destino), no como una métrica para manipular.

## Performance Max

23. **Señales de PMax**: revisa que los grupos de recursos lleven de verdad señales de audiencia (temas de búsqueda más la lista de clientes) en vez de campos de señal vacíos. Las señales son orientativas, no deterministas, pero dejarlas vacías renuncia a una palanca real de optimización.
24. **Presupuesto de PMax en Shopping**: Shopping suele ser la ubicación que da dinero dentro de PMax. Confirma que una parte importante del gasto de PMax llegue ahí (por el informe de la cuenta o los datos por producto) y no se escurra hacia display o video de baja intención.

## Página de destino

25. **Embudo de página comparativa**: busca una página de reseñas estilo lista en un dominio independiente que posicione a la marca como n.º 1: un embudo comprobado de tráfico frío al que pueden apuntar Shopping y PMax. (Ver `paginas-comparativas`.)
26. **Páginas cara a cara con competidores**: páginas «nosotros frente a ellos» que capturan demanda en etapa de comparación. Su ausencia es una oportunidad, no un defecto.
27. **Publirreportajes (advertorials)**: revisa si el tráfico frío de Google se recibe con páginas tipo publirreportaje (guiadas por una historia, con aire editorial) y no solo con la ficha cruda del producto.
28. **Optimización de la página de destino**: confirma que la promesa del anuncio (oferta, precio, producto estrella) aparezca con claridad arriba, sin desplazarse. La falta de coherencia entre anuncio y página desperdicia el clic sin importar la puja: es el arreglo posterior al clic de mayor impacto.

## Demand Gen

29. **Rendimiento por formato**: segmenta los resultados de Demand Gen por red (Shorts, In-Stream, In-Feed + Discovery, Gmail, Display) para encontrar qué formato impulsa conversiones eficientes; un número combinado de DG esconde al ganador y la fuga.
30. **Embudo con cuestionario para tráfico frío** *(Página de destino)*: un cuestionario calienta y segmenta el tráfico frío de Google y Demand Gen con un camino personalizado. Su ausencia es un hueco de embudo de prospección para señalar.
31. **Datos demográficos de Demand Gen**: analiza el rendimiento por edad, género, situación parental y franjas de ingreso del hogar para detectar mala entrega e informar exclusiones y ajustes de puja.
32. **Campaña de parte alta del embudo** *(Búsqueda)*: confirma que algo llegue a audiencias frías que aún no conocen el producto, con una meta de conversión, no un simple objetivo de reconocimiento. Las cuentas todo-parte-baja topan con la demanda existente.

---

## Cómo resumirlo

- Puntúa solo los puntos verificados. Presenta la **salud** (proporción de pasa/falla en las revisiones verificadas) y la **cobertura de evidencia** (parte de las revisiones aplicables que pudiste verificar) como dos números separados: nunca los mezcles.
- Por debajo del 60 % de cobertura, informa hallazgos y desconocidos en lugar de un solo puntaje de salud (ver las bandas de cobertura de `auditoria-y-criterio.md`).
- Lista cada desconocido con la evidencia exacta que necesitarías para resolverlo (normalmente: informe de términos de búsqueda, acceso a Merchant Center, ajustes de las acciones de conversión o informes de PMax/DG a nivel de cuenta).
- Entrega los fallos como arreglos en borrador (estado actual → cambio propuesto → efecto esperado → reversa) y aplícalos solo con aprobación expresa.

---

*Adaptado al enfoque de esta habilidad a partir de la Lista de auditoría de Google Ads, pública, de ECHELONN (Jackson Blackledge, ECHELONN.IO). Se reconoce la estructura de los puntos; las descripciones y el puntaje están reescritos y emparejados con el modelo de cuatro estados de `auditoria-y-criterio.md`.*
