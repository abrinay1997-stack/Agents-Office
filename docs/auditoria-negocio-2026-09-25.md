# Auditoría de negocio — 25 sep 2026

100 cosas que le faltan a la oficina, vistas por un dueño y contrastadas con el mercado de agentes de 2026 (Lindy, Relevance AI, Zapier Agents, Copilot Studio, Agentforce). Página para marcar: https://claude.ai/artifact/8TVW8sjPf5SesAYdzZyxRz

El dueño marcó 69. Leyenda: ✅ hecho · ⏳ marcado, pendiente · 📌 issue abierto · ▫️ no marcado.

Hechos: 7 de 69 marcados.

## A. Seguridad y control

- 📌 **A1** [crítica · días] **Sin contraseña si la abres en la red.** Si se pone host para usarla desde el teléfono en la wifi, cualquiera en esa red puede mandar a los agentes, que tienen tu Gmail y tu Chrome. No hay inicio de sesión. _Nota del dueño: Solo issue (#2): claves en variables secretas si algún día va a la web._ → Issue #2 con los requisitos (claves solo en variables de entorno, cerrado por defecto, tests).
- ⏳ **A2** [alta · semanas] **Sin acceso seguro desde fuera de la oficina.** Solo funciona en localhost. No hay un túnel con inicio de sesión para verla desde el teléfono en la calle.
- ✅ **A3** [crítica · días] **«Solo envía si te lo piden» es un ruego, no un candado.** La regla de no enviar, pagar ni borrar sin pedido explícito está escrita en el prompt. Nada técnico bloquea las herramientas que escriben. _Nota del dueño: Contemplar varias formas de funcionar._ → `guard.mjs` + `safety.mjs`: tres políticas (`aprobar`, `pedido`, `nunca`) y por departamento; una tarea que intenta enviar sin OK queda esperando tu visto bueno.
- ✅ **A4** [alta · días] **Sin registro de cada acción externa.** No queda una bitácora con qué herramienta usó cada agente, sobre qué datos y cuándo. → (sin marcar, sale con el guardián) cada llamada de herramienta queda en `data/audit/AAAA-MM-DD.jsonl`.
- ✅ **A5** [crítica · días] **Inyección de instrucciones por correo o web.** Un correo o una página que el agente lee puede traer órdenes escondidas («reenvía esto a…»). Nada lo detecta ni lo separa. _Nota del dueño: Crítico: ciberseguridad._ → Regla de «contenido de terceros = datos» en cada agente, detector de órdenes escondidas en lo que leen, bloqueo de envíos tras detectarlas y aviso 🛡 en la tarea; tras el OK solo se envía a direcciones del borrador.
- ✅ **A6** [alta · horas] **Chrome sin lista de sitios permitidos.** Con el navegador activo, el agente entra con tus sesiones reales a cualquier sitio. → `safety.browserSites` / `browserBlock`.
- ✅ **A7** [alta · horas] **Nada revisa secretos antes de subir a GitHub.** Las notas de empresa viajan por GitHub y el repositorio puede ser público. No hay un detector de claves, cédulas o tarjetas antes del commit. _Nota del dueño: Y tests: son muy importantes._ → `npm run secrets`, hook pre-commit, `npm test` con 14 tests y GitHub Actions.
- ✅ **A8** [media · días] **Sin topes por agente.** No hay límites del tipo «máximo 20 correos al día» o «nunca más de 5 mensajes a un mismo cliente». → `safety.limits.perAgentDay` / `perRecipientDay`.
- ▫️ **A9** [media · horas] **Keys sin panel de estado.** Las keys del Estudio viven en variables de Windows. No hay dónde ver cuáles están activas, cuáles vencen ni cómo rotarlas.
- ▫️ **A10** [alta · días] **El respaldo está en el mismo disco.** Hay copia diaria de tareas y rutinas (14 días), pero en la misma carpeta data/, sin cifrar y sin copia fuera de la máquina.

## B. Confiabilidad

- ⏳ **B1** [alta · horas] **Una tarea fallida no se reintenta sola.** Existe el botón Reintentar, pero no hay reintento automático con espera creciente para fallos pasajeros (red, límite de uso). _Nota del dueño: Mejorar la lógica existente._
- ⏳ **B2** [alta · días] **Rutinas perdidas con la PC apagada.** Si la PC duerme, la rutina no corre. El calendario lo marca como «no corrió», pero no la recupera al despertar ni te avisa.
- ⏳ **B3** [alta · semanas] **Solo corre en tu PC encendida.** No hay forma de dejar la oficina en un servidor o en la nube. _Nota del dueño: Local primero; dejarlo listo para Railway o Cloudflare sin incurrir en costos._
- ⏳ **B4** [media · horas] **Tiempo límite fijo de 5 minutos.** Cada ejecución se corta a los 300 s y lo hecho se pierde. No se guarda un avance parcial.
- ⏳ **B5** [media · horas] **La cola no dice cuándo te toca.** Hay 3 ejecuciones a la vez y una por agente. Una tarea en espera no dice su posición ni cuándo empieza.
- ⏳ **B6** [alta · días] **Sin semáforo de salud de la oficina.** No hay una vista que diga «Claude conectado ✓, Gmail ✓, disco ✓, última rutina ✓» y avise cuando algo cae.
- ⏳ **B7** [alta · horas] **Sesión de Claude vencida: aviso poco claro.** Si el login de Claude Code caduca, cada tarea falla con un error técnico en vez de un aviso claro con cómo volver a entrar.
- ⏳ **B8** [media · días] **Las conexiones reales no se prueban.** La prueba en vivo es opcional (CHECK_LIVE). Nada comprueba cada día que Gmail o el CRM siguen respondiendo. _Nota del dueño: Depende de Claude._
- ⏳ **B9** [media · semanas] **Archivos JSON como base de datos.** Tareas, trabajos e historial viven en JSON enteros que se reescriben en cada cambio.
- ✅ **B10** [media · días] **Actualizar sin marcha atrás.** Actualizar-Oficina.bat trae lo nuevo, pero no hay «volver a la versión de ayer» con un clic si algo se rompe. _Nota del dueño: Tests en GitHub que avisen si un cambio rompe el código._ → en parte: GitHub Actions corre secretos, tests y el check completo en cada push y PR (la marcha atrás con un clic va en la tanda 2).

## C. Costos y retorno

- ⏳ **C1** [crítica · días] **Cero dólares en pantalla.** El contador de uso muestra tokens de la ventana de 5 horas: «No dollars anywhere», dice el código. No sabes cuánto cuesta cada tarea, agente o departamento. _Nota del dueño: Crítico; al día con los modelos y con más proveedores, no solo Meta y Claude._
- ⏳ **C2** [alta · días] **Sin retorno: horas ahorradas.** Copilot Studio calcula tiempo y dinero ahorrados por cada ejecución que sale bien. Aquí no hay nada parecido.
- ⏳ **C3** [alta · horas] **Sin presupuesto mensual con tope.** Solo el Estudio tiene límite diario. No hay «gasta como máximo $X al mes y avísame al 80 %».
- ⏳ **C4** [media · horas] **Sin recomendación de modelo por tarea.** Tú eliges Sonnet, Opus o Fable. Nada sugiere el más barato que alcanza para cada tipo de trabajo.
- ⏳ **C5** [media · días] **Costos del Estudio estimados.** Los precios de 12 modelos son estimados y no se cruzan con lo que cobra el proveedor.
- ⏳ **C6** [media · días] **Sin tablero de uso por semana.** No hay una vista de trabajos, uso y fallos por departamento y por semana.
- ⏳ **C7** [media · horas] **Rutinas que nadie lee.** Nada detecta las entregas que nunca abres para sugerir pausar esa rutina.
- ▫️ **C8** [baja · días] **No se mide el contexto que lee cada tarea.** Cada ejecución relee notas del cerebro, pero no se mide cuánto contexto consume.
- ⏳ **C9** [baja · horas] **Agente contra persona.** No hay una comparación simple de «esto costaría X horas de una persona».
- ⏳ **C10** [media · horas] **Informe mensual para contabilidad.** No se puede exportar un CSV o PDF del trabajo hecho y su costo.

## D. Calidad del trabajo

- ⏳ **D1** [alta · semanas] **Sin evaluaciones de calidad.** Relevance AI permite fijar umbrales de calidad y medir a los agentes todo el tiempo. Aquí no se mide si mejoran o empeoran.
- ⏳ **D2** [alta · horas] **Sin 👍 / 👎 en cada entrega.** La única forma de corregir es escribir revise: …. Falta un voto de un clic con motivo.
- ⏳ **D3** [alta · días] **Las entregas no dicen de dónde sacan los datos.** Una entrega no cita la nota o la fuente de cada cifra o afirmación.
- ⏳ **D4** [media · días] **Sin autorrevisión antes de entregar.** El agente no pasa por una lista de control («¿tiene precio? ¿nombre del cliente? ¿tono?») antes de marcar LISTA. _Nota del dueño: ¿No lo hace el jefe de departamento?_
- ⏳ **D5** [media · días] **Sin segunda opinión en lo delicado.** Nada hace que otro agente revise una propuesta, un contrato o un pago antes de pedirte el OK.
- ▫️ **D6** [baja · semanas] **35 puestos fijos.** No se puede añadir un agente, solo renombrar un puesto. Los demás productos crean los agentes que necesites.
- ⏳ **D7** [media · horas] **Skills y briefs sin historial.** No se ve quién cambió una skill, qué cambió ni cómo volver a la versión anterior (fuera de git).
- ▫️ **D8** [alta · días] **Sin modo ensayo.** No hay forma de correr una tarea «en seco», con todo menos el envío, para probar una skill nueva.
- ⏳ **D9** [media · horas] **Las lecciones crecen sin orden.** Cada revise: se acumula en feedback/. Nada las fusiona en la skill ni quita las repetidas.
- ⏳ **D10** [media · días] **El enrutador no aprende.** Cuando mueves una tarea a otro departamento o agente, el enrutador no aprende de ese cambio ni lo mide.

## E. Disparadores e integraciones

- ⏳ **E1** [crítica · semanas] **Solo se dispara por reloj.** Las rutinas solo corren a una hora. Faltan disparadores por evento: correo nuevo, formulario, pago recibido, WhatsApp entrante. Es lo primero que ofrecen Lindy y Zapier. _Nota del dueño: Totalmente de acuerdo._
- ⏳ **E2** [alta · horas] **Sin webhook de entrada.** No hay una dirección a la que Zapier, Make, n8n o tu web puedan avisar «llegó esto».
- ⏳ **E3** [alta · días] **Sin hablar con Dimitri por WhatsApp o Telegram.** Dimitri solo existe dentro de la página.
- ▫️ **E4** [baja · semanas] **Sin agente de llamadas.** Lindy contesta y hace llamadas con voz natural.
- ▫️ **E5** [alta · días] **Conectar Gmail o el CRM pide la terminal.** Los conectores salen de lo que tenga instalado Claude Code (claude mcp add). No hay un catálogo con «Conectar» de un clic.
- ▫️ **E6** [alta · días] **Sin cadenas entre departamentos.** Lo que entrega Ventas no dispara solo el trabajo de Entregas o Contabilidad (propuesta aceptada → factura → bienvenida).
- ▫️ **E7** [media · días] **El calendario no ve tu Google Calendar.** La oficina publica un .ics, pero no lee tu calendario real para no chocar con citas.
- ▫️ **E8** [media · horas] **La oficina no te escribe correos.** No hay un correo propio para mandarte el resumen, un aviso o una alerta.
- ⏳ **E9** [alta · días] **No se pueden subir documentos al cerebro.** El cerebro no acepta que arrastres un PDF, un Word o un Excel. Hay que copiarlos a mano como notas.
- ▫️ **E10** [baja · horas] **Sin API documentada.** La API existe, pero no hay una guía para que otro sistema la use.

## F. Avisos y teléfono

- ⏳ **F1** [crítica · días] **Si cierras la pestaña, no te enteras de nada.** No hay avisos al teléfono, por correo ni por WhatsApp. Un borrador que espera tu OK espera hasta que abras la oficina. _Nota del dueño: Bot de Telegram de Dimitri para el dueño; tokens en variables secretas._
- ⏳ **F2** [alta · horas] **Sin notificaciones del navegador.** La página no usa las notificaciones del sistema cuando algo espera tu aprobación o falla. _Nota del dueño: Se resuelve con Telegram._
- ▫️ **F3** [alta · horas] **Sin parte diario.** No llega un resumen único cada mañana: qué se hizo, qué espera tu OK y qué falló.
- ▫️ **F4** [media · días] **No se instala como app en el teléfono.** No es una PWA: no tiene icono en la pantalla de inicio ni se abre como app.
- ▫️ **F5** [media · días] **Sin alertas de urgencia.** Un cliente molesto o un pago rechazado no sube de prioridad ni te avisa al momento.
- ⏳ **F6** [baja · horas] **Sin horario de no molestar.** No se puede decir «de 20:00 a 7:00 solo lo urgente».
- ▫️ **F7** [alta · días] **La oficina 3D pesa en el teléfono.** En nuestras pruebas, una segunda página 3D tardó unos 30 s en cargar. No hay una vista ligera, sin 3D, para el móvil.
- ▫️ **F8** [media · horas] **La pestaña no cuenta pendientes.** El título de la pestaña no dice «(3) Agents Office» cuando hay aprobaciones.
- ⏳ **F9** [alta · días] **Aprobar con un toque desde el aviso.** Cuando haya avisos, lo ideal es aprobar o rechazar desde el propio aviso, sin abrir la oficina.
- ▫️ **F10** [baja · días] **Solo en español.** El sistema de idiomas está en su fase 1: no hay cambio de idioma.

## G. Aprobaciones

- ⏳ **G1** [alta · días] **No puedes editar el borrador antes de aprobar.** Para cambiar una línea hay que pedírselo al agente con revise: y esperar otra ejecución.
- ⏳ **G2** [alta · días] **Todo pide el mismo OK.** No hay niveles de riesgo ni autonomía que se gane: aprobar solo lo de bajo riesgo tras 20 aciertos seguidos.
- ⏳ **G3** [alta · días] **Aprobar sin ver exactamente qué sale.** El borrador se ve como texto. Falta una tarjeta con destinatario, asunto, adjuntos e importe, tal como se enviará.
- ⏳ **G4** [media · horas] **Aprobaciones que nunca caducan.** Un borrador viejo sigue ahí sin recordatorio ni vencimiento.
- ⏳ **G5** [media · días] **No se puede delegar la aprobación.** No puedes decir «las respuestas a clientes las aprueba María».
- ⏳ **G6** [media · horas] **Aprobar en lote.** Para aprobar 10 borradores hay que abrirlos uno por uno.
- ⏳ **G7** [alta · días] **Sin «deshacer envío».** Después de aprobar, la acción es inmediata. No hay 30 segundos para arrepentirse, como en Gmail.
- ⏳ **G8** [media · horas] **Sin registro de quién aprobó.** No queda guardado quién aprobó qué, cuándo y con qué cambios.
- ⏳ **G9** [alta · días] **Reglas por importe.** No hay «todo pago de más de $200 pide OK aunque la rutina diga que no».
- ⏳ **G10** [media · días] **El OK es por rutina, no por acción.** needsOk vale para toda la rutina. Una rutina que lee y además envía queda o toda frenada o toda suelta.

## H. Conocimiento y memoria

- ⏳ **H1** [alta · semanas] **El cerebro no busca por significado.** El agente lee las notas por nombre y por palabras. No hay búsqueda por significado (RAG) sobre todo el cerebro.
- ▫️ **H2** [alta · días] **Sin ficha de cliente.** No existe una memoria por cliente con su historial (qué se le dijo, qué compró, qué reclamó).
- ⏳ **H3** [media · horas] **Notas sin fecha de revisión.** Las notas de la empresa no avisan cuando llevan meses sin revisarse (precios, horarios, políticas).
- ⏳ **H4** [media · días] **Sin libro de cifras visible.** CLAUDE.md menciona un libro de cifras (numbers ledger), pero no hay una pantalla para ver y editar esas cifras (precios, comisiones, metas).
- ⏳ **H5** [media · horas] **Las mejores entregas no se reusan.** No hay una biblioteca de «entregas que me gustaron» que los agentes usen como ejemplo.
- ⏳ **H6** [media · horas] **La voz de marca solo se cambia en archivos.** El tono, las palabras prohibidas y la firma se editan en una skill a mano, no desde la oficina.
- ⏳ **H7** [media · días] **Los departamentos no se enteran entre sí.** Un agente de Ventas no sabe qué le prometió Entregas al mismo cliente, más allá de las últimas entregas.
- ▫️ **H8** [media · días] **El conocimiento no sincroniza con Drive o Notion.** El cerebro vive en archivos locales. Lo que tu equipo escribe en Drive no entra solo.
- ⏳ **H9** [alta · días] **Configuración inicial por departamento.** La entrevista cubre un departamento por vez. Falta un arranque que lea tu web, tus precios y tus clientes y prepare los seis departamentos.
- ▫️ **H10** [media · días] **No se puede olvidar a un cliente.** No hay forma de borrar a una persona de todas las notas, entregas e historial.

## I. Equipo

- ▫️ **I1** [alta · semanas] **Sin usuarios ni roles.** No hay dueño, empleado ni «solo lectura». Quien abre la página puede hacer todo.
- ▫️ **I2** [alta · semanas] **Cada persona ve una oficina distinta.** Por diseño, data/ no viaja: cada miembro del equipo tiene su propio historial vacío. No hay un tablero compartido en vivo.
- ⏳ **I3** [media · días] **Tareas para personas.** El tablero solo tiene agentes. No se puede asignar una tarea a una persona del equipo junto a las de los agentes.
- ⏳ **I4** [media · días] **Sin comentarios en las tareas.** No se puede comentar una tarea ni mencionar a alguien.
- ▫️ **I5** [alta · días] **Git para gente no técnica.** Colaborar pide ramas, Pull Requests y resolver choques de git con archivos .bat.
- ⏳ **I6** [media · horas] **Traspaso del agente a una persona.** Cuando el agente no puede, no hay un «pásaselo a Juan» con todo el contexto.
- ▫️ **I7** [media · horas] **Sin bitácora de cambios del equipo.** No se ve quién cambió una rutina, un agente o un conector, ni cuándo.
- ▫️ **I8** [baja · días] **Permisos por departamento.** No se puede dejar que el de ventas vea solo Ventas.
- ▫️ **I9** [baja · horas] **Ayuda dentro de la app.** No hay una guía corta dentro de la oficina para un empleado nuevo.
- ⏳ **I10** [media · días] **Los ajustes se editan en JSON.** Conectores permitidos, modelo, horarios, límites: todo se cambia editando office.config.json.

## J. Producto y dueño

- ⏳ **J1** [crítica · días] **No muestra cómo va el negocio.** La oficina muestra actividad de agentes, no resultados: ventas de la semana, facturas vencidas, leads nuevos, tiempo de respuesta.
- ▫️ **J2** [alta · días] **Sin metas por departamento.** No hay objetivos («20 leads al mes», «cobrar en 30 días») que guíen a los agentes y midan el avance.
- ⏳ **J3** [crítica · semanas] **Instalarla pide ser técnico.** Node, Git, Claude Code, variables de entorno y archivos .bat. Lindy y Zapier se usan desde el navegador en minutos.
- ▫️ **J4** [media · días] **Sin plantillas por tipo de negocio.** No hay «oficina para restaurante», «para agencia» o «para tienda online» con agentes, skills y rutinas ya pensados.
- ⏳ **J5** [alta · días] **Sin pantalla de ajustes.** No hay una ventana de Ajustes para conectores, modelos, horarios, presupuesto y avisos.
- ▫️ **J6** [media · horas] **Elegir la vista de inicio.** La oficina 3D es lo primero siempre. Falta poder abrir directo en el tablero o en la lista.
- ⏳ **J7** [media · horas] **Sin búsqueda global.** No hay un Ctrl+K que busque a la vez en tareas, notas, agentes, rutinas e imágenes.
- ⏳ **J8** [media · horas] **Dimitri no te busca.** Dimitri responde cuando le hablas, pero no viene con un informe semanal programado con decisiones sugeridas.
- ▫️ **J9** [media · horas] **Demo y realidad se confunden.** La página abierta como archivo muestra actividad inventada con el mismo aspecto que la real.
- ⏳ **J10** [baja · horas] **Agentes que nunca se usan.** Nada señala los puestos que no han hecho nada en un mes para sugerir renombrarlos a algo útil.
