// La GUÍA de la oficina (27 oct 2026) — lo que Dimitri sabe de cómo se hace cada cosa en esta oficina: dónde está, qué pasos tiene, qué reglas manda. Puro y compartido por la
// oficina local y la nube (como sub-core.mjs): el prompt de Dimitri lleva solo un índice de temas y, por cada mensaje, las 2–3 entradas que tocan lo que se habla (`guiaPara`);
// la herramienta `buscar_en_guia` busca más a fondo. Tomado de BRIAN (D'CASA): un catálogo corto de «qué logras, dónde queda, los pasos y la nota», buscado sin tildes y con
// las palabras que usa la gente.
//
// REGLA (como la de BRIAN: «toda función nueva debe poder usarla»): una vista, un botón del dock, un ajuste o una regla nueva de la oficina entra aquí en el MISMO cambio.
// `tests/guia-oficina.test.mjs` falla si una vista de COBERTURA no tiene entrada, si una entrada no dice dónde queda, o si el texto se pasa de largo.
//
// Nada de cifras del negocio aquí (precios, comisiones, metas): eso vive en las cifras de la empresa. Una entrada dice CÓMO se hace; lo que vale hoy lo dicen los datos.

/** Una entrada: { id, tema, titulo, donde, vistas, palabras, texto }. `donde` = el camino en la oficina; `vistas` = en qué vistas abiertas pesa más; `palabras` = cómo lo dice la gente. */
export const GUIA = [
  // ───────────────────────── TAREAS Y AGENTES ─────────────────────────
  { id: 'tareas-crear', tema: 'tareas', titulo: 'Crear una tarea', donde: 'La barra de abajo de la oficina · Tareas (H) · Dimitri (S)', vistas: ['tareas'],
    palabras: ['crear tarea', 'nueva tarea', 'añadir tarea', 'agregar tarea', 'como creo una tarea', 'asignar tarea', 'pedirle algo a un agente', 'encargar'],
    texto: 'Hay cuatro formas. (1) La barra de la oficina: eliges el departamento, escribes lo que quieres y nace una tarea para ese departamento; su jefe elige el escritorio. (2) Tareas (H) → «+ Añadir tarea», con «Quién la hace»: Para mí, una persona del equipo o un agente. (3) Dimitri: se lo pides y arma el plan; no se crea nada hasta que pulsas ENVIAR A LOS JEFES. (4) Si se repite, es una rutina. Al escribir rápido: «para el viernes» es la fecha límite, «el lunes a las 9» (sin «para») es cuándo arranca, #etiqueta y !alta. Si la tarea pide enviar algo, queda esperando tu OK.' },
  { id: 'tareas-ajustar', tema: 'tareas', titulo: 'Ajustar una tarea', donde: 'Tareas (H) → abrir la tarea', vistas: ['tareas'],
    palabras: ['prioridad', 'fecha limite', 'cambiar tarea', 'editar tarea', 'mover tarea', 'cancelar tarea', 'etiqueta', 'pasos de una tarea', 'depende de', 'espera a', 'repetir tarea', 'estimacion', 'cronometro', 'ajustar tarea'],
    texto: 'Abre la tarea y se guarda sola: título, instrucción, prioridad (alta, media, baja), fecha límite (para cuándo), cuándo arranca, etiquetas, proyecto, pasos, «espera a» otra tarea (no arranca hasta que esa termine), repetir (cada día, semana, 2 semanas o mes), estimación en minutos y cronómetro. Una tarea de agente que no ha empezado se puede mover de día o cancelar; una en curso, no. Lo tuyo se mueve cambiando su fecha límite. Dimitri lo puede proponer (cambiar prioridad o fecha, mover, cancelar, repetir) y tú pulsas HACER; todo se puede deshacer unos segundos.' },
  { id: 'tareas-estados', tema: 'tareas', titulo: 'Los estados de una tarea', donde: 'Tareas (H) · el panel de tareas (T)', vistas: ['tareas'],
    palabras: ['estado de la tarea', 'en curso', 'en cola', 'espera mi ok', 'bloqueada', 'fallida', 'programada', 'idea', 'que significa'],
    texto: 'Idea (anotada, sin arrancar) · programada (tiene hora de arranque) · en cola (le toca pronto) · en curso (un agente la ejecuta) · espera tu OK (el borrador está listo y nada sale sin tu visto bueno) · hecha · falló (con el motivo; se puede repetir) · bloqueada (espera a otra tarea) · en manos de una persona. La cola decide quién arranca por prioridad, fecha límite, orden manual y antigüedad; no arranca lo bloqueado, lo de una persona ni a un agente ocupado.' },
  { id: 'tareas-mias', tema: 'tareas', titulo: 'Las tareas de una persona (Mías)', donde: 'Tareas (H) → pestaña Mías', vistas: ['tareas'],
    palabras: ['mis tareas', 'mias', 'para mi', 'delegar', 'delegadas', 'lo hago yo', 'asignar a una persona', 'tareas de avalon', 'lista personal', 'tareas de hoy', 'proximos 7 dias'],
    texto: 'Cada persona del equipo con cuenta tiene su lista: Bandeja, Hoy (las vencidas aparte), Próximos 7 días, Todas, Delegadas (lo que pasaste a otro) y Hechas. Una tarea de agente se toma con «Lo hago yo»; una tuya se delega a un agente o a una persona (queda en la lista de esa persona y tú la sigues en Delegadas). Al crear, «Quién la hace» ofrece Para mí, las personas del equipo y los agentes. Los agentes nunca cierran lo tuyo: solo te sugieren cosas en tu Bandeja.' },
  { id: 'tareas-quien', tema: 'tareas', titulo: 'Quién hizo qué (agente, equipo o persona)', donde: 'Tareas (H) → detalle de la tarea → bitácora · Costos (U)', vistas: ['tareas', 'costos'],
    palabras: ['quien hizo', 'quien completo', 'quien lo hizo', 'quien realizo', 'quien la termino', 'historial', 'bitacora', 'que paso con', 'quien cambio', 'auditoria', 'responsable'],
    texto: 'Cada tarea sabe quién la hizo: el agente (o el equipo con su jefe) que la ejecutó, o la persona que la marcó hecha. Además lleva una bitácora con cada cambio —estado, campo, paso marcado, comentario— con quién y cuándo (un agente, Dimitri, una persona o el reloj). Para responder «¿quién completó esto?» o «¿qué hizo Avalon esta semana?» se usa la bitácora (ver_tarea, historial_reciente), no se adivina. Lo que aprueba, devuelve o deshace el dueño queda en el historial de aprobaciones.' },
  { id: 'proyectos', tema: 'tareas', titulo: 'Proyectos', donde: 'Tareas (H) → Proyectos', vistas: ['tareas'],
    palabras: ['proyecto', 'proyectos', 'lanzamiento', 'meta con fecha', 'quien espera a quien', 'progreso del proyecto'],
    texto: 'Un proyecto junta tareas de varios departamentos (y de personas) hacia una meta con fecha. Muestra el progreso, lo atrasado y quién espera a quién. Se crea desde Tareas → Proyectos o cuando Dimitri arma un plan con una meta; una tarea suelta no es un proyecto. Un proyecto atrasado avisa una vez al día.' },
  { id: 'rutinas', tema: 'tareas', titulo: 'Rutinas (trabajo que se repite solo)', donde: 'Calendario (P) → Rutina · Dimitri', vistas: ['cal'],
    palabras: ['rutina', 'rutinas', 'cada lunes', 'todos los dias', 'automatico', 'programar que se repita', 'saltar', 'pausar rutina', 'correr ahora'],
    texto: 'Una rutina es una tarea que la oficina crea sola en su horario: cada día, entre semana, ciertos días, cada mes (un día o «el segundo martes»), cada hora en un tramo, con fecha de fin o número de veces. Tiene un escritorio, dice si espera tu OK y se puede pausar, reanudar, editar, saltar UNA ejecución (SALTAR ESTA) o correr ahora. Cualquier departamento puede tener rutinas. Las que crea Dimitri o un asistente esperan tu OK siempre. Si la compu duerme, al despertar se hace una vez, «atrasada».' },
  { id: 'calendario', tema: 'tareas', titulo: 'El calendario', donde: 'Calendario (P)', vistas: ['cal'],
    palabras: ['calendario', 'agenda', 'semana', 'mes', 'dia', 'suscribirme', 'ics', 'capas', 'arrastrar'],
    texto: 'Muestra en mes, semana, día y agenda: tus tareas (capa TUYAS), las de los agentes, las rutinas con su historial (hecha, falló, saltada), las fechas límite («vence») y, si la activas, el contenido de redes. Se arrastra para mover una tarea o una ejecución (te pregunta «solo esta vez» o «siempre»). Clic en un día crea una tarea o rutina ahí. «Suscribirme (.ics)» lo lleva a Google o Apple Calendar.' },
  { id: 'aprobaciones', tema: 'tareas', titulo: 'Aprobaciones (nada sale sin tu OK)', donde: 'El aviso ⚠ de la barra · Telegram', vistas: ['aprobaciones'],
    palabras: ['aprobar', 'aprobacion', 'aprobaciones', 'ok', 'visto bueno', 'devolver', 'deshacer', 'espera de aprobacion', 'riesgo', 'lo que saldra'],
    texto: 'Todo lo que sale de la oficina (enviar, publicar, pagar, borrar o cambiar algo afuera) espera tu OK. Cada aprobación enseña «Lo que saldrá» (canal, destinatarios, asunto, importes, adjuntos) y el riesgo; puedes editar el borrador, devolverlo con un comentario o aprobarlo, y tienes unos 30 segundos para deshacer. Un envío solo puede ir a los destinatarios que aparecen en el borrador aprobado; un importe grande espera siempre. Se aprueba en la oficina o en Telegram (✅ / ↩). Ni Dimitri ni los agentes aprueban.' },
  { id: 'agentes', tema: 'agentes', titulo: 'Departamentos, jefes y agentes', donde: 'La vista general de la oficina · ficha del agente (✎)', vistas: [],
    palabras: ['agente', 'agentes', 'departamento', 'departamentos', 'jefe', 'jefes', 'escritorio', 'escritorios', 'quienes son', 'equipo de agentes', 'lider'],
    texto: 'Hay seis departamentos y 35 escritorios (agentes): Emails, Ventas, Marketing, Operaciones, Finanzas y Entregas. Cada uno tiene un jefe. Una tarea va a un departamento y su jefe elige el escritorio según lo que hace cada uno (su «does» y sus skills). Los puestos no se agregan ni se quitan: se renombran y se afinan con un brief o una skill. Un agente nunca tiene Bash ni archivos: solo los conectores que le tocan, y lee libre pero envía solo tras tu OK.' },
  { id: 'ficha-agente', tema: 'agentes', titulo: 'La ficha de un agente (brief, modelo, skills, biblioteca)', donde: 'Clic en un escritorio → ✎ ficha del agente', vistas: [],
    palabras: ['ficha', 'brief', 'instrucciones del agente', 'modelo del agente', 'esfuerzo', 'versiones', 'volver a esta', 'lecciones', 'cambiar el agente'],
    texto: 'La ficha reúne: qué hace (does), su brief (hasta 2.000 caracteres, las instrucciones fijas del dueño para ese agente), el modelo y el esfuerzo (vacío = el de la oficina), sus skills, su Biblioteca de habilidades, las lecciones que aprendió de tus correcciones (se pueden olvidar) y el historial de versiones del brief y las skills con «Volver a esta». El nombre es corto y en mayúsculas; el departamento y el puesto de jefe no cambian.' },
  { id: 'skills', tema: 'agentes', titulo: 'Skills: cómo se hace un trabajo aquí', donde: 'Ficha del agente → Skills · el Cerebro (Agents Office/skills)', vistas: [],
    palabras: ['skill', 'skills', 'habilidad del jefe', 'sop', 'como se hace', 'plantilla de trabajo', 'procedimiento', 'enseñar a un agente', 'ensenar'],
    texto: 'Una skill es una carpeta con un SKILL.md (cuándo aplica, pasos, forma del resultado, reglas) y archivos al lado (plantilla, ejemplo). Se ata a uno o varios agentes o a un departamento entero, y el agente la lee ENTERA antes de cada tarea. Sirve cuando hay pasos o una plantilla; si cabe en un párrafo, es un brief. Se ven en la ficha del agente; se escriben con Claude Code en la carpeta de skills del Cerebro y, en la nube, llegan con la migración. Una skill del dueño con el mismo nombre reemplaza a la de fábrica.' },
  { id: 'biblioteca', tema: 'agentes', titulo: 'La Biblioteca de habilidades', donde: 'Ficha del agente (✎) → «Biblioteca de habilidades» · /api/biblioteca', vistas: [],
    palabras: ['biblioteca', 'biblioteca de habilidades', 'habilidades', 'metodos', 'donde esta la biblioteca', 'marketing skills', 'habilidades del jefe', 'habilidades de cada jefe'],
    texto: 'Son métodos de trabajo ya escritos que viajan con la oficina: hoy 50 de marketing (estrategia, contenido y texto, SEO, conversión, pagados y medición, crecimiento y retención, ventas, canales). Se ven en la ficha de cada agente → «Biblioteca de habilidades» (las de su puesto y las de su departamento). A diferencia de una skill, no se leen enteras en cada tarea: el agente ve el índice, la que encaja se le adelanta y el resto la pide cuando la necesita. Una del dueño con el mismo nombre gana a la de fábrica. La base de todas es la nota contexto-marketing del Cerebro.' },
  { id: 'equipos', tema: 'agentes', titulo: 'Trabajo en equipo (Agent Teams)', donde: 'Botón TEAM de la barra de tareas · «en equipo» en una rutina', vistas: [],
    palabras: ['equipo', 'en equipo', 'team', 'varios escritorios', 'a la vez', 'trabajo en equipo'],
    texto: 'Con «en equipo», el jefe del departamento parte la tarea en 2 a 4 piezas independientes, los escritorios trabajan a la vez y el jefe escribe el final. Cuesta más (de dos a cuatro corridas más las dos del jefe), así que solo para trabajo grande. Una rutina de equipo la tiene el jefe.' },
  { id: 'lecciones', tema: 'agentes', titulo: 'Corregir a un agente (revise) y ejemplos', donde: 'En el chat del agente o en la entrega: «revise: …» · ⭐ Guardar como ejemplo', vistas: [],
    palabras: ['revise', 'corregir', 'corregir al agente', 'devolver con cambios', 'ejemplo', 'guardar como ejemplo', 'lecciones', 'aprende'],
    texto: 'Escribe «revise: …» sobre una entrega y el agente la rehace; la corrección se archiva como lección (reglas fijas o cosas de una vez) y el agente la lee antes de cada tarea. Las repetidas se funden; con más de 15 se propone pasarlas a la skill. ⭐ Guardar como ejemplo deja la entrega que te gustó para que el agente la imite. 👍/👎 en cada entrega alimenta la calidad.' },

  // ───────────────────────── CONTENIDO Y REDES ─────────────────────────
  { id: 'contenido-piezas', tema: 'contenido', titulo: 'Las piezas de Contenido y sus estados', donde: 'Contenido (K)', vistas: ['contenido'],
    palabras: ['contenido', 'pieza', 'piezas', 'publicacion', 'post', 'reel', 'historia', 'carrusel', 'borrador', 'a revisar', 'aprobada', 'idea', 'formato', 'redes sociales', 'calendario de contenido'],
    texto: 'Una publicación es una pieza: idea → borrador → a revisar → aprobada. Tiene día, hora, formato (post, carrusel, reel, historia), redes (Instagram, Facebook y siete más), cuenta, texto, hashtags, primer comentario, archivos del Estudio y, si hace falta, un texto propio por red. SOLO el dueño aprueba, y solo si puede salir (sin problemas de las reglas de cada red); guardar no aprueba, y cambiar lo que sale de una aprobada le quita el OK. Los agentes y Dimitri solo dejan borradores.' },
  { id: 'contenido-publicar', tema: 'contenido', titulo: 'Cómo sale lo aprobado', donde: 'Contenido (K) → Programación', vistas: ['contenido'],
    palabras: ['publicar', 'programar', 'programacion', 'cola', 'sale solo', 'metricool', 'meta directo', 'simulacro', 'publicar ya', 'entregar', 'fallo al publicar'],
    texto: 'Lo aprobado entra a la cola y sale solo a su hora según el modo de Ajustes → Contenido: simulacro (se apunta sin salir), Metricool o Meta directo. Facebook queda programado en Meta; Instagram no se puede programar por API y lo publica la oficina a su hora (hasta 30 minutos tarde todavía sale). Programación dice por pieza: en cola, entregando, programada, publicada (con enlace), en parte o falló, con sus botones. «Publicar ya» aprueba para dentro de unos minutos. Nunca se publica dos veces.' },
  { id: 'contenido-herramientas', tema: 'contenido', titulo: 'Llenar la semana, plantillas y mejores horas', donde: 'Contenido (K) → + Crear · Llenar la semana · el editor de la pieza', vistas: ['contenido'],
    palabras: ['llenar la semana', 'huecos', 'plantilla', 'plantillas', 'textos guardados', 'mejor hora', 'mejores horas', 'mejorar con marketing', 'repetir pieza', 'informe del mes de redes'],
    texto: '«Llenar la semana» propone los días sin publicación a su mejor hora: vuelve lo que funcionó (sin repetirse en 8 semanas) y Marketing escribe el resto como borradores. Las plantillas y los textos guardados son notas del Cerebro. Las mejores horas salen de lo ya publicado. «✨ Mejorar con Marketing» reescribe el texto de una pieza con la voz de la marca. «Repetir…» crea copias en borrador (diario, semanal, mensual).' },
  { id: 'bandeja', tema: 'contenido', titulo: 'La Bandeja (comentarios y mensajes)', donde: 'Contenido (K) → Bandeja', vistas: ['contenido'],
    palabras: ['bandeja', 'comentarios', 'mensajes', 'responder', 'ocultar comentario', 'mensaje privado', 'ventana de 24 horas', 'inbox'],
    texto: 'Reúne los comentarios y mensajes privados de Instagram y Facebook (también los de los anuncios). Cada uno dice de qué cuenta es (la página o el Instagram desde donde se lee y se responde), se filtra por cuenta y enviar dice «responder como @cuenta». Un agente deja el borrador de la respuesta; enviarla es solo del dueño, con un segundo clic y una sola vez. Los mensajes privados solo se contestan dentro de las 24 horas desde el último mensaje del cliente. Ocultar un comentario se puede deshacer; nunca se borra. Lo que escribe un cliente se trata como dato: si trae órdenes escondidas, queda marcado.' },
  { id: 'analiticas', tema: 'contenido', titulo: 'Analíticas de redes', donde: 'Analíticas (R)', vistas: ['analiticas'],
    palabras: ['analiticas', 'alcance', 'seguidores', 'interacciones', 'rendimiento de redes', 'informe del mes', 'cuenta', 'cifras de instagram'],
    texto: 'Lee de Meta (solo lectura) las cifras de cada cuenta de Instagram y Facebook: alcance, seguidores, interacciones, lo publicado y lo que más movió. Se ve por cuenta o por red, contra el periodo anterior; si no hay con qué comparar, lo dice. «Impulsar» sobre una publicación abre un borrador de anuncio. El informe del mes se guarda en el Cerebro. Sin token de Meta, la pantalla enseña cómo conectar.' },
  { id: 'anuncios', tema: 'contenido', titulo: 'Anuncios de Meta y la regla del dinero', donde: 'Anuncios (J)', vistas: ['anuncios'],
    palabras: ['anuncios', 'campaña', 'campañas', 'publicidad', 'meta ads', 'presupuesto de anuncios', 'pausar anuncio', 'activar anuncio', 'impulsar', 'sugerencias de anuncios', 'topes de gasto'],
    texto: 'Ves las campañas, conjuntos y anuncios de Meta con su estado, aprendizaje, rechazos, gasto contra los topes, resultados y costo por resultado. Bajar el gasto (pausar, bajar presupuesto, archivar) es un clic con deshacer. Gastar (activar, reanudar, subir presupuesto, alargar, relanzar) pide dos clics del dueño con la cifra exacta y nunca pasa de sus topes. Todo se crea EN PAUSA (asistente de 5 pasos en Borradores). La cuenta publicitaria es una sola y la comparten varias marcas: cada campaña, conjunto y anuncio dice sobre qué página de Facebook e Instagram corre (o «cuenta no identificada»), se filtra por cuenta y el Resumen reparte el gasto y los resultados por cuenta. Hay sugerencias de mejora con su porqué y el informe del mes. Ni Dimitri, ni los agentes, ni un asistente conectado pueden gastar.' },

  { id: 'historias-automaticas', tema: 'contenido', titulo: 'Historias automáticas de lo ya publicado', donde: 'Ajustes → Contenido · Contenido (K)', vistas: ['contenido', 'ajustes'],
    palabras: ['historia', 'historias', 'automatica', 'automaticas', 'stories', 'story', 'repost', 'repostear', 'callada', 'diario', 'sola', 'solas'],
    texto: 'Con «Historias automáticas» encendido en Ajustes → Contenido, cada día lo ya publicado con imagen vuelve como historia en Instagram y Facebook: de 1 a 5 al día, desde la hora que elijas. '
      + 'Cada una es una pieza normal de Contenido (formato historia) con la imagen de la publicación original; no gasta. Se elige lo publicado hace más de 2 días, lo menos usado y lo que más movió, '
      + 'y la misma publicación no vuelve antes de 4 días. Por defecto cada historia espera el OK del dueño; solo él puede encender «que salgan sin pedirme el OK», y el modo de Contenido sigue mandando '
      + '(en Simulacro no sale nada de verdad). Un día se prepara una sola vez: la que el dueño tira a la papelera no vuelve a crearse.' },

  { id: 'metodo-campanas', tema: 'contenido', titulo: 'Método de campañas: número mágico y revisión 3Q', donde: 'Anuncios (J) · consultas de Dimitri', vistas: ['anuncios'],
    palabras: ['numero magico', 'números del negocio', 'ticket', 'margen', 'equilibrio', 'roas', 'costo por conversacion', 'tasa de cierre', 'revision 3q', 'tres q', 'que hago con la campaña',
      'apagar campaña', 'escalar', 'frecuencia', 'ctr unico', 'fase de aprendizaje', 'efecto desglose', 'cuanto invertir', 'simular presupuesto', 'rentabilidad', 'analisis de anuncios', 'competencia'],
    texto: 'Los NÚMEROS DEL NEGOCIO (ticket, costos, % de la venta que se invierte, meta, tasa de cierre) dan el OBJETIVO —lo que se paga por venta y por conversación— y el EQUILIBRIO —desde dónde se pierde—: '
      + 'el número mágico. Los guarda el dueño. La REVISIÓN 3Q lee lo que corre en Meta (30, 14 y 7 días): Q1 qué pasó frente al número mágico; Q2 por qué (% de mensajes, CTR único, video, frecuencia, CPM); '
      + 'Q3 qué hacer. Reglas: se juzga el CONJUNTO y, si va bien, sus anuncios no se tocan; lo que aprende o cambió hace menos de 5 días ESPERA; se pausa lo que gastó el doble del número mágico y cuesta 1,5 veces '
      + 'lo que aguanta su etapa o pasa del equilibrio. Presentación aguanta un 30 % más; conversión y ascensión, un 20 % menos. También lee los anuncios de la COMPETENCIA (los que más días llevan activos) '
      + 'para analizarlos. Todo es lectura: pausar, subir o activar sigue con la regla del dinero.' },
  { id: 'ciclo-ventas', tema: 'contenido', titulo: 'El ciclo de ventas: qué anuncio va en cada etapa', donde: 'Consultas de Dimitri · agentes de Marketing', vistas: ['anuncios', 'contenido'],
    palabras: ['ciclo de ventas', 'presentacion', 'evaluacion', 'conversion', 'ascension', 'embudo', 'publico frio', 'retargeting', 'audiencia', 'audiencias', 'objetivo de campaña', 'tipo de arte',
      'que anuncio hago', 'estructura de campañas', 'reparto del presupuesto', 'excluir publicos'],
    texto: 'Cuatro etapas, cada una con su público, su pieza y su parte del presupuesto (60/20/10/10; una cuenta nueva arranca solo con las dos primeras, 75/25): PRESENTACIÓN, gente nueva (intereses, similares o abierto), excluyendo a quien '
      + 'ya interactuó; EVALUACIÓN, quien interactuó, vio videos o visitó la web; CONVERSIÓN, quien escribió, dio clic o dejó el carrito; ASCENSIÓN, quien ya compró. Qué pieza va en cada una, con qué tipo de arte (producto, beneficios, '
      + 'demostración, testimonio, promoción, educativo…) y a dónde lleva cambia con el tipo de negocio (productos, servicios, segunda necesidad, suscripción, nicho, producto nuevo, cursos) y el destino: WhatsApp → campaña de Interacción '
      + 'y se vigila el costo por conversación; web → Ventas y se vigila el ROAS. Los cursos no se venden por WhatsApp. El simulador dice qué da un presupuesto en tres escenarios.' },

  // ───────────────────────── ESTUDIO ─────────────────────────
  { id: 'estudio-imagen', tema: 'estudio', titulo: 'Crear una imagen en el Estudio', donde: 'Estudio (E) → Crear', vistas: ['studio'],
    palabras: ['estudio', 'imagen', 'imagenes', 'generar imagen', 'crear imagen', 'foto', 'modelo de imagen', 'prompt', 'nano banana', 'generar'],
    texto: 'Escribes la idea, eliges el modelo y el formato, la cantidad y pulsas GENERAR; el precio estimado va en el botón. Básico es el compositor sencillo (idea, formato, cantidad, referencias); Avanzado suma el banco de presets y el escenario 3D. «Mejorar el prompt» lo propone en inglés con su traducción. Todo corre en segundo plano: ves las tarjetas en vivo, con REINTENTAR si falla. Un motor se enciende con su llave (Higgsfield, Google, OpenAI, xAI, fal, MiniMax…); «Prueba» es gratis, para ensayar el flujo.' },
  { id: 'estudio-ajustes', tema: 'estudio', titulo: 'Los ajustes de cada modelo del Estudio', donde: 'Estudio (E) → «Formato y ajustes»', vistas: ['studio'],
    palabras: ['ajustes del estudio', 'parametros', 'proporcion', 'aspect ratio', 'resolucion', 'calidad', 'tamaño', 'semilla', 'variantes', 'cantidad', 'duracion', 'referencias', 'fotogramas', 'cada ajuste'],
    texto: 'Cada modelo trae SU lista de ajustes con sus valores permitidos, y la página solo muestra lo que ese modelo acepta: proporción (9:16 para reel e historia, 4:5 o 1:1 para post, 16:9), tamaño o calidad (1K, 2K, 4K en los que lo tienen), cantidad (1 a 4 variantes por pedido), semilla (solo donde el modelo la documenta) y, en video, duración y resolución. Los roles de material también dependen del modelo: referencias o foto a editar (imagen), fotograma inicial y final (video), video de origen. Un ajuste que el modelo no tiene no se manda; uno con valor inválido se corrige al permitido. Dimitri ve la lista exacta de cada modelo cuando propones algo del Estudio.' },
  { id: 'estudio-video', tema: 'estudio', titulo: 'Video, animar e imagen a video', donde: 'Estudio (E) → Video · «Animar» en una imagen', vistas: ['studio'],
    palabras: ['video', 'animar', 'reel', 'veo', 'kling', 'seedance', 'fotograma inicial', 'primer cuadro', 'mover una imagen', 'clip'],
    texto: 'Un video se pide igual que una imagen (modelo, formato, duración) y es asíncrono: queda «en curso» con una barra de avance estimado y se puede cancelar. Para animar una imagen se usa «Animar» (la imagen es el fotograma inicial) o se ponen fotograma inicial y final. Solo un modelo de video acepta fotogramas, referencias o un video de origen. El costo estimado va en GENERAR y desde US$0,50 hace falta un segundo clic. El banco de presets de video añade movimientos de cámara, bucles y antes→después.' },
  { id: 'estudio-voz-musica', tema: 'estudio', titulo: 'Voz y música', donde: 'Estudio (E) → Voz · Música · panel Voces', vistas: ['studio'],
    palabras: ['voz', 'locucion', 'musica', 'jingle', 'clonar voz', 'minimax', 'narracion', 'audio', 'voces propias'],
    texto: 'La voz (locución) convierte un texto en audio con una voz del sistema o una tuya; en «Voces» se diseña una voz (~US$3) o se clona grabando con el micrófono o subiendo un fragmento (~US$1,5), y se borra desde ahí. La música con MiniMax solo la ofrecen a cuentas que ya pagaban antes de agosto de 2026: a una cuenta nueva le contesta que no. Los audios caen a la galería con su reproductor; un audio nunca es referencia ni fotograma de otro modelo.' },
  { id: 'estudio-banco', tema: 'estudio', titulo: 'El banco de presets, el escenario 3D y los lotes', donde: 'Estudio (E) → Avanzado → tecla B · pestaña Lotes (L)', vistas: ['studio'],
    palabras: ['preset', 'presets', 'banco', 'escenario 3d', 'lote', 'lotes', 'fondo blanco', 'catalogo de fotos', 'editar muchas fotos', 'receta'],
    texto: 'En modo Avanzado hay un banco de unos 180 presets (127 de imagen, 53 de video): luz, fondo blanco, encuadres, movimientos de cámara. Lo que se puede hacer sin IA (enderezar, fondo blanco, exportar) se hace en la computadora, gratis. El escenario 3D coloca el sujeto y la cámara y manda una guía gris al modelo. Los lotes aplican una receta a muchas fotos (una carpeta, un Excel o un ZIP): nacen sin gastar, se prueban con 3 y solo entonces corren todas, con el tope de gasto vigilado. Los lotes siguen en la oficina de la computadora; la nube aún no los tiene.' },
  { id: 'estudio-galeria', tema: 'estudio', titulo: 'La galería: carpetas, papelera, variar', donde: 'Estudio (E) → galería', vistas: ['studio'],
    palabras: ['galeria', 'carpeta', 'carpetas', 'mover imagen', 'papelera', 'favorito', 'variar', 'usar de referencia', 'comparar', 'descargar', 'borrar imagen'],
    texto: 'La galería guarda todo lo generado y subido, por día, con quién lo pidió y para qué tarea. Las carpetas son etiquetas tuyas: mover una imagen no cambia su archivo ni sus enlaces; eliminar una carpeta deja las imágenes en «Sin carpeta». La papelera guarda 30 días y no se lleva lo que una pieza de Contenido usa. En cada tarjeta: Usar de referencia, Variar, Animar, Editar con una instrucción, Descargar, favorito. Comparar pone 2 a 4 lado a lado.' },
  { id: 'estudio-costos', tema: 'estudio', titulo: 'Topes y costo del Estudio', donde: 'Ajustes (,) → Estudio', vistas: ['studio', 'costos'],
    palabras: ['tope', 'topes', 'presupuesto del estudio', 'cuanto cuesta', 'costo de generar', 'limite diario', 'limite mensual'],
    texto: 'Antes de pedir, el servidor comprueba el precio estimado contra el tope por pedido, el del día y el del mes (en dólares) y el de imágenes del día; un video cuenta como 5 imágenes, una música como 3. Los topes se cambian en Ajustes → Estudio y valen al instante. Una cifra de «aproximado» es una estimación hasta la primera factura del proveedor. Ni Dimitri ni los agentes gastan sin el clic de GENERAR (o la aprobación de la tarea).' },

  // ───────────────────────── CEREBRO Y EMPRESA ─────────────────────────
  { id: 'cerebro', tema: 'cerebro', titulo: 'El Cerebro: las notas de la empresa', donde: 'Cerebro (G)', vistas: ['brain'],
    palabras: ['cerebro', 'nota', 'notas', 'escribir nota', 'crear nota', 'editar nota', 'borrar nota', 'eliminar nota', 'papelera de notas', 'subir documento', 'enlace', 'buscar en el cerebro', 'memoria', 'actualizar conexiones', 'conectar notas', 'mapa del cerebro', 'enlaces rotos', 'relacionadas'],
    texto: 'Cada nota es una neurona y cada [[enlace]] una sinapsis. Puedes escribir una nota nueva, editarla y mandarla a la papelera (se recupera) desde el propio lector; también subir un documento (PDF, Word, Excel, CSV o texto) que se vuelve nota. Dimitri puede crear una nota o añadir información a una existente cuando se lo pides (tú pulsas HACER y se puede deshacer). Los agentes leen las notas que tocan su tarea; una de más de 180 días sale «puede estar vieja». En la nube, el botón «Actualizar conexiones» (solo administradores, a mano) limpia el mapa de lo que dejaron las notas borradas, propone enlaces para tus notas nuevas (con IA o gratis, con las parejas que tus agentes usaron juntas), avisa de notas repetidas o con cifras que se contradicen, reacomoda todo el mapa (se guarda el anterior) y activa la búsqueda por significado tras medirla: tú eliges; lo que se escribe va como «Relacionadas» (con DESHACER); las notas de fábrica jamás se tocan.' },
  { id: 'cerebro-empresa', tema: 'cerebro', titulo: 'Voz de marca, cifras y contexto de la empresa', donde: 'Ajustes (,) → Cifras · Voz de marca · Preparar desde mi web', vistas: ['settings'],
    palabras: ['voz de marca', 'cifras', 'precios', 'contexto de marketing', 'preparar desde mi web', 'perfil de la empresa', 'oferta', 'faq', 'clientes'],
    texto: 'Las cifras de la empresa (precios, comisiones, metas) se editan en Ajustes y todos los agentes las usan tal cual: un precio nunca va en una skill. La voz de marca es la nota «voice». «Preparar desde mi web» lee tu sitio y deja una PROPUESTA (perfil, oferta, voz, FAQ, clientes y contexto-marketing) que revisas contra el Cerebro dato a dato antes de aplicarla. La nota contexto-marketing es la base de la Biblioteca de habilidades.' },

  // ───────────────────────── LA OFICINA ─────────────────────────
  { id: 'negocio', tema: 'oficina', titulo: 'Cómo va el negocio (indicadores)', donde: 'Negocio (N)', vistas: ['negocio'],
    palabras: ['negocio', 'indicadores', 'kpi', 'metas', 'tendencia', 'cifras del negocio'],
    texto: 'Tus indicadores con tendencia y meta. Un valor llega a mano, por webhook (POST /api/kpi/<id>) o de una entrega con una línea «KPI ventas_semana = 1.250» (una rutina lo mantiene al día). Anuncios puede crear los de gasto, costo por resultado y ROAS. Debajo, las cifras de la oficina: terminados, respuesta a eventos, esperando OK y horas ahorradas.' },
  { id: 'costos', tema: 'oficina', titulo: 'Costos y retorno', donde: 'Costos (U) · el uso del plan abajo a la izquierda', vistas: ['costos'],
    palabras: ['costos', 'gasto de ia', 'cuanto gasta', 'presupuesto mensual', 'horas ahorradas', 'por agente', 'csv', 'cuanto cuesta la oficina', 'retorno'],
    texto: 'Cada llamada a un modelo queda en el libro de costos (el tipo dice si fue una tarea, el chat de un agente, Dimitri o un informe). La ventana enseña el mes contra el presupuesto, el costo por tarea, por departamento, agente y modelo, las horas ahorradas y su valor, la calidad por agente, sugerencias que se aplican con un clic y el CSV del mes. Con «detener al llegar» activado, no arrancan tareas nuevas al pasar el presupuesto. La publicidad de Meta va aparte.' },
  { id: 'ajustes', tema: 'oficina', titulo: 'Ajustes', donde: 'Ajustes (,)', vistas: ['settings'],
    palabras: ['ajustes', 'configuracion', 'configurar', 'cambiar ajuste', 'apariencia', 'tema oscuro', 'atajos', 'estado de la oficina'],
    texto: 'Lo configurable, en formularios que se explican: la oficina, dinero y control, equipo, integraciones y apariencia (claro, oscuro, automático; versión móvil o de escritorio). Solo se guarda lo que cambias. Hay pestañas de Estado (el semáforo de la oficina), Modelos y Conectores MCP en la nube, y la lista de atajos de teclado («?»). Los marcados con ↻ se aplican al reiniciar la oficina local.' },
  { id: 'estado', tema: 'oficina', titulo: 'El estado de la oficina', donde: 'Ajustes → Estado (O)', vistas: ['settings'],
    palabras: ['estado', 'semaforo', 'salud', 'fallos', 'avisos', 'probar conexiones', 'copia diaria'],
    texto: 'El semáforo comprueba Claude o el proveedor de IA, los conectores, el disco, las rutinas, la cola, las aprobaciones, los fallos, la seguridad, la publicación y la copia diaria, con la manera de arreglar cada uno. La luz del engranaje se enciende solo en ámbar o rojo. Debajo salen los avisos (que se marcan como leídos) y llegan a Telegram.' },
  { id: 'modelos', tema: 'oficina', titulo: 'Qué IA usa cada cosa y cómo cambiarla', donde: 'Ajustes (,) → Modelos (en la nube)', vistas: ['settings'],
    palabras: ['modelo', 'modelos', 'que ia usas', 'que inteligencia artificial', 'cambiar de modelo', 'claude', 'sonnet', 'opus', 'haiku', 'meta muse', 'cambiar la ia', 'comparar modelos'],
    texto: 'Cada función tiene su modelo: agentes, Dimitri, redactar, resumen del lunes, enrutador y revisión del jefe. Se asigna por oficina, función, departamento o agente en Ajustes → Modelos, con la nota de cuáles usan herramientas, «Probar este modelo» y «Comparar» con el costo antes. Precedencia: tarea > rutina > agente > Ajustes → Modelos > el valor por defecto de la oficina. Un modelo que no usa herramientas (como Muse Spark) solo redacta: para consultar conectores o buscar a fondo, Dimitri y los agentes necesitan un modelo de Claude.' },
  { id: 'conectores', tema: 'oficina', titulo: 'Conectores (MCP)', donde: 'La barra superior · Ajustes → Conectores MCP', vistas: ['settings'],
    palabras: ['conector', 'conectores', 'mcp', 'gmail', 'zapier', 'github', 'conectar', 'integracion', 'herramientas del agente', 'token'],
    texto: 'Un conector es un servicio externo (correo, calendario, repositorios…) que los agentes usan con sus herramientas. Cada conector se asigna a los departamentos que lo necesitan; las herramientas de lectura (buscar, ver, listar) se usan libres y las que envían, publican, pagan o cambian algo esperan tu OK. En la nube se añaden desde Ajustes → Conectores MCP (plantillas, token cifrado, «Probar conexión»); en la computadora, con «claude mcp add». En la nube, Dimitri también puede LEER con los conectores del equipo; para escribir o enviar, deja el borrador y tú apruebas.' },
  { id: 'equipo-cuentas', tema: 'oficina', titulo: 'Personas, cuentas y roles', donde: 'Ajustes → Equipo · Cuentas y roles (en la nube)', vistas: ['settings'],
    palabras: ['usuarios', 'cuentas', 'roles', 'administrador', 'editor', 'lector', 'invitar', 'invitacion', 'equipo humano', 'personas', 'quien tiene acceso', 'avalon', 'permisos'],
    texto: 'En la nube cada persona entra con su cuenta y un rol: administrador (todo, incluido Dimitri, aprobar y los ajustes), editor (trabaja en tareas, Contenido y Estudio) o lector (solo mira). Las invitaciones son de un solo uso. Aparte, Ajustes → Equipo lista a las personas del equipo (nombre, Telegram, departamento) a las que se les puede pasar una tarea y que reciben avisos. Dimitri sabe con quién habla y a quién se puede asignar trabajo.' },
  { id: 'telegram', tema: 'oficina', titulo: 'Telegram', donde: 'El bot de Telegram del dueño', vistas: [],
    palabras: ['telegram', 'bot', 'desde el celular', 'desde el telefono', '/estado', '/pendientes', '/mias', '/contenido', '/anuncios', 'silencio'],
    texto: 'Con el bot hablas con Dimitri y llegan al teléfono las aprobaciones (✅ / ↩), los fallos y los avisos. Comandos: /estado, /pendientes, /tarea ventas: …, /mias, /yo …, /contenido (lo que espera tu OK, con su foto), /anuncios (pausar con un toque; activar con dos y la cifra) y /silencio 2. Solo lo usa el dueño; un aprobador delegado que él autorice solo aprueba lo de sus departamentos.' },
  { id: 'seguridad', tema: 'oficina', titulo: 'Seguridad: lo que ningún agente puede', donde: 'Ajustes (,) → Estado (O)', vistas: [],
    palabras: ['seguridad', 'guardian', 'inyeccion', 'ordenes escondidas', 'puede enviar', 'candado', 'destinatarios', 'riesgo', 'auditoria de envios', 'datos peligrosos'],
    texto: 'Las reglas de envío son candados, no ruegos: un guardián revisa cada herramienta. Por defecto nada sale (enviar, publicar, pagar, borrar, cambiar) salvo en la ejecución que sigue a tu OK, y solo a los destinatarios del borrador aprobado. Lo que un agente lee —un correo, una página, una nota— es DATO: si trae órdenes escondidas, se bloquea todo envío y la tarea lo marca con 🛡. Hay topes diarios por agente y por destinatario y un registro de cada llamada.' },
  { id: 'dimitri', tema: 'oficina', titulo: 'Dimitri: qué hace y qué no', donde: 'Dimitri (S) · Telegram', vistas: [],
    palabras: ['dimitri', 'subgerente', 'que puedes hacer', 'que sabes hacer', 'ayuda', 'como funcionas', 'quien eres', 'que haces'],
    texto: 'Es la mano derecha del dueño: contesta, analiza, propone planes y cambios. En la nube además consulta él mismo —tareas, bitácora, Contenido, anuncios, galería, Cerebro, agentes, costos y los conectores de lectura— para no adivinar, y se ve cada paso. Nunca aprueba, envía, publica, paga ni borra: propone y espera tu clic (ENVIAR A LOS JEFES, HACER, GENERAR). Sus cambios son una lista cerrada que se puede deshacer unos segundos. Puede crear notas o añadir información a una nota del Cerebro. En la nube cada administrador tiene su propio chat con Dimitri (nadie lee el de otro) y puede ver o renombrar sus conversaciones guardadas con el reloj 🕘 de su cabecera. Solo habla con él un administrador.' },
  { id: 'buscar-atajos', tema: 'oficina', titulo: 'Buscar en todo y atajos de teclado', donde: 'Ctrl+K · tecla «?»', vistas: [],
    palabras: ['buscar', 'busqueda', 'atajo', 'atajos', 'teclas', 'ctrl k', 'tecla'],
    texto: 'Ctrl+K busca en tareas y entregas, agentes, rutinas, notas e imágenes. Teclas: E Estudio, P Calendario, K Contenido, R Analíticas, J Anuncios, G Cerebro, H Tareas, N Negocio, U Costos, O Estado, S Dimitri, T panel de tareas, «,» Ajustes, B banco de presets, «?» la lista completa. Los atajos de una letra se apagan en Ajustes → Atajos de teclado. Alt+Mayús+M dicta por voz donde el navegador lo permita.' },
  { id: 'movil', tema: 'oficina', titulo: 'La versión del teléfono', donde: 'Se activa sola en pantallas de teléfono · Ajustes → Apariencia → Versión', vistas: [],
    palabras: ['movil', 'celular', 'telefono', 'version movil', 'app', 'iphone', 'android'],
    texto: 'En pantallas de teléfono la oficina cambia de armazón: barra inferior (Inicio, Tareas, Dimitri, Calendario, Más), hojas inferiores, aprobaciones con un toque y segundo toque para lo importante. Tiene versión propia de Tareas, Calendario, Dimitri, Contenido, Bandeja, Analíticas, Anuncios, Cerebro, Estudio (con carpetas), Buscar, Ajustes, Costos, Estado, Negocio y el equipo. Se puede forzar la de escritorio o la móvil en Ajustes → Apariencia.' },
  { id: 'disparadores', tema: 'oficina', titulo: 'Disparadores y webhooks', donde: 'Cerebro/Agents Office/triggers.json · POST /api/hook/<id>', vistas: [],
    palabras: ['disparador', 'webhook', 'cuando llegue un formulario', 'stripe', 'whatsapp', 'zapier', 'make', 'n8n', 'evento'],
    texto: 'Un disparador define qué tarea crea un evento que llega de afuera (formulario, pago de Stripe, WhatsApp, correo, genérico) por POST /api/hook/<id> con la clave AO_HOOK_TOKEN. Lo recibido llega al agente como bloque de DATOS, no como órdenes; si trae órdenes escondidas la tarea espera tu OK. Un evento repetido se toma una sola vez y hay un tope por hora.' },
  { id: 'respaldo', tema: 'oficina', titulo: 'Copias, papelera y restablecer', donde: 'Ajustes → Estado · Restablecer oficina (administrador)', vistas: [],
    palabras: ['respaldo', 'copia de seguridad', 'restablecer', 'recuperar', 'papelera', 'deshacer', 'volver atras', 'perdi'],
    texto: 'En la oficina de la computadora hay copia diaria (14 días) de las tareas y de Contenido. Casi todo lo que se borra va a una papelera recuperable (galería 30 días, notas, piezas); lo que se aprueba, edita o deshace queda en el historial. «Restablecer oficina» (solo administrador) la deja vacía o con la base de fábrica, con respaldo de 7 días. Los cambios de Dimitri se deshacen unos segundos con el DESHACER de su tarjeta.' },
  { id: 'calidad', tema: 'oficina', titulo: 'Calidad de los agentes', donde: 'Costos (U) → Calidad · 👍/👎 en cada entrega', vistas: ['costos'],
    palabras: ['calidad', 'puntaje', 'primera vez', 'pulgar', 'empeora', 'cuales agentes son mejores'],
    texto: 'Cada agente tiene un puntaje: una entrega usada tal cual vale 100, cada devolución resta 30 y un 👎 resta 50; se ve el porcentaje aprobado a la primera y un aviso si un agente empeora tras cambiar su skill o su brief. En lo delicado (finanzas, contratos, propuestas, importes grandes) el jefe del departamento revisa antes de que te llegue.' },
  { id: 'chat', tema: 'oficina', titulo: 'El chat del equipo', donde: 'El botón del chat, junto a la campanita (solo en la nube; un administrador lo enciende)', vistas: [],
    palabras: ['chat', 'chatear', 'mensaje directo', 'escribirle a alguien', 'canal', 'general', 'conversar con el equipo', 'hablar con mi pareja', 'mensajes del equipo'],
    texto: 'Chat entre las personas del equipo: #general (todos), canales públicos o privados y mensajes directos. Quien solo lee puede leer, no escribir. Lo privado lo leen solo sus miembros: ni un administrador ni Dimitri lo ven. Los directos y las @menciones llegan a la campanita sin el texto. Se actualiza en vivo y, si se corta la conexión, al volver se pone al día sola.' },
];

/** Qué vistas de la oficina DEBE cubrir la guía (el test lo comprueba). */
export const COBERTURA = ['tareas', 'cal', 'contenido', 'analiticas', 'anuncios', 'studio', 'brain', 'negocio', 'costos', 'settings', 'aprobaciones'];

/** Las palabras que no ayudan a buscar. */
const VACIAS = new Set(['para', 'como', 'donde', 'esta', 'este', 'esto', 'estos', 'estas', 'unos', 'unas', 'pero', 'porque', 'cuando', 'cual', 'cuales', 'quien', 'quiero', 'puedo', 'puedes', 'tiene', 'tienen', 'hace', 'hacer', 'sobre', 'entre', 'desde', 'hasta', 'todo', 'todos', 'todas', 'cada', 'algo', 'otra', 'otro', 'mas', 'muy', 'que', 'una', 'los', 'las', 'del', 'con', 'por', 'sin', 'hay', 'son', 'fue', 'ser', 'sus', 'mis', 'tus']);

export const normalizar = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ/+ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const raiz = (t) => (t.length >= 5 ? t.slice(0, 4) : t); // «crear» y «crea», «tarea» y «tareas», «publicar» y «publica» comparten raíz
const tokens = (s) => normalizar(s).split(' ').filter((t) => t.length >= 3 && !VACIAS.has(t)).map(raiz);

const PRE = GUIA.map((e) => ({ e, frases: e.palabras.map(normalizar), raices: e.palabras.map((p) => tokens(p)), tPalabras: new Set(e.palabras.flatMap(tokens)), tTitulo: new Set(tokens(e.titulo)), tTexto: new Set(tokens(e.texto)), t: normalizar(e.titulo) }));

/**
 * Las entradas que tocan `consulta`, de más a menos, con su puntaje. `vista` (la vista abierta) suma un poco a lo suyo. Solo entran las que pasan `minimo`.
 * → [{ entrada, puntaje }]
 */
export function buscarEnGuia(consulta, { vista = '', max = 3, minimo = 2.5 } = {}) {
  const q = normalizar(consulta);
  if (!q) return [];
  const qt = new Set(tokens(consulta)), enQ = ` ${q} `;
  const out = [];
  for (const p of PRE) {
    let s = 0;
    p.frases.forEach((f, k) => {
      if (!f) return;
      const literal = f.length >= 4 ? enQ.includes(` ${f} `) || enQ.includes(f) : enQ.includes(` ${f} `), r = p.raices[k];
      const porRaiz = !literal && r.length > 0 && r.every((x) => qt.has(x)); // todas las raíces de la frase están en la pregunta («se programa y se publica» ← «publicar», «programar»)
      if (literal) s += f.includes(' ') ? 4 : 3; else if (porRaiz) s += r.length > 1 ? 3.5 : 2.5;
    });
    for (const t of qt) { if (p.tPalabras.has(t)) s += 1.5; if (p.tTitulo.has(t)) s += 2; if (p.tTexto.has(t)) s += 0.4; }
    if (s >= 1 && vista && p.e.vistas.includes(vista)) s += 1;
    if (s >= minimo) out.push({ entrada: p.e, puntaje: Math.round(s * 10) / 10 });
  }
  return out.sort((a, b) => b.puntaje - a.puntaje).slice(0, max);
}

/** Entradas como las lee el modelo: «## Título (dónde)» + texto. Corta en `maxChars` sin partir una entrada. */
export function guiaTexto(entradas, { maxChars = 3600 } = {}) {
  const partes = [];
  let n = 0;
  for (const e of entradas) {
    const t = `## ${e.titulo} — ${e.donde}\n${e.texto}`;
    if (n + t.length > maxChars && partes.length) break;
    partes.push(t); n += t.length + 2;
  }
  return partes.join('\n\n');
}

/** Lo que va en el prompt por mensaje: las 2–3 entradas que tocan lo que se habla (el mensaje, un poco de historia y la vista abierta). '' si ninguna. */
export function guiaPara(texto, { historia = '', vista = '', max = 3, maxChars = 3600 } = {}) {
  const directas = buscarEnGuia(texto, { vista, max, minimo: 2.5 });
  const lista = directas.length ? directas : buscarEnGuia(`${historia} ${texto}`, { vista, max: 2, minimo: 4 }); // sin nada directo, la conversación de antes puede decir de qué se habla
  return guiaTexto(lista.map((x) => x.entrada), { maxChars });
}

/** El índice corto que lleva SIEMPRE el prompt: los temas de la guía, para que Dimitri sepa qué existe y la pida con `buscar_en_guia`. */
export function indiceGuia() {
  const por = new Map();
  for (const e of GUIA) { if (!por.has(e.tema)) por.set(e.tema, []); por.get(e.tema).push(e.titulo.replace(/\s*\(.*\)\s*$/, '')); }
  return [...por.entries()].map(([t, l]) => `${t}: ${l.join(' · ')}`).join('\n');
}
