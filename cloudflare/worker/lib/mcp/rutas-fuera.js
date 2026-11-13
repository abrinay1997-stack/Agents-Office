// LAS RUTAS DE ESCRITURA QUE EL CONECTOR MCP NO SIRVE, cada una con su MOTIVO (P6, «ningún cabo suelto»). `mcp-cobertura.test.mjs` exige que toda ruta /api de escritura de la oficina o la cubra una herramienta
// (el `RUTAS` de su dominio en lib/mcp/dominios/) o esté AQUÍ: una ruta nueva que escribe se decide en el mismo cambio que la crea. Datos puros (sin imports).
// La clave es el camino con `:id` en cada trozo variable (sin método: vale para cualquier método de escritura que no cubra una herramienta); el valor es el porqué. Un motivo que empieza por «Pendiente:» NO es una
// decisión de seguridad sino un hueco conocido (se puede servir cuando el dueño lo pida); el resto son vetos a propósito.
const por = (rutas, motivo) => Object.fromEntries(rutas.map((r) => [r, motivo]));

/** Lo que decide un humano (aprobar, enviar, publicar, ejecutar, gastar): nunca por MCP. */
const HUMANO = {
  ...por(['/api/tasks/:id/approve', '/api/tasks/:id/reject', '/api/tasks/approve-batch', '/api/tasks/:id/revise', '/api/tasks/:id/undo', '/api/tasks/:id/draft'],
    'Aprobar, devolver, pedir correcciones, deshacer una aprobación o editar el borrador de lo que va a salir es el clic del dueño: lo que envía correo, publica o paga nunca lo autoriza un asistente.'),
  ...por(['/api/tasks/:id/run', '/api/routines/:id/run', '/api/agentes/:id/ejecutar'], 'Poner a un agente a trabajar YA gasta modelo y puede enviar tras el OK: lo arranca una persona (o el reloj de la oficina).'),
  ...por(['/api/tasks/:id/stop', '/api/tasks/:id/archive', '/api/tasks/:id/repeat', '/api/tasks/:id/example', '/api/tareas/:id/estado', '/api/tareas/lote'],
    'Detener, archivar, repetir o marcar ejemplo en una tarea de un agente, o cambiar estados en lote, es de la oficina: por MCP se cancela, se mueve o se marca hecha una tarea concreta con `tareas_cambiar`, con su DESHACER.'),
  '/api/tasks/:id': 'Borrar una tarea para siempre no existe por MCP: cancelar (`tareas_cambiar`) es la vía reversible.',
  '/api/agents/:id/forget': 'Olvidar lecciones cambia lo que el agente aprendió: es de la ficha del agente, con la persona delante.',
  ...por(['/api/contenido/piezas/:id/aprobar', '/api/contenido/piezas/:id/entregar', '/api/contenido/bandeja/:id/enviar'], 'Aprobar, entregar a la cola o enviar una respuesta publica o escribe a un cliente: es el clic del dueño (y su segundo clic), nunca un asistente.'),
  '/api/contenido/cola/tick': 'Hacer andar la cola de publicación a mano publica de verdad: solo el reloj de la oficina o el dueño.',
  '/api/contenido/llenar': 'Llenar la semana crea copias y una tarea para un agente de Marketing: el dueño lo decide en la ventana «Llenar la semana».',
  '/api/anuncios/borradores/:id/crear': 'Crear la campaña en Meta (aunque nazca en pausa) toca la cuenta publicitaria: es el clic del dueño.',
  ...por(['/api/anuncios/deshacer', '/api/anuncios/conversiones', '/api/anuncios/sincronizar'], 'Deshacer una acción de anuncios vuelve a gastar, registrar ventas manda datos a Meta y sincronizar gasta cuota: de la oficina o del reloj, no de un asistente.'),
  '/api/anuncios/informe': 'Guardar el informe del mes en el Cerebro es el botón del Resumen de Anuncios.',
  ...por(['/api/contenido/analiticas/actualizar', '/api/contenido/meta/sincronizar', '/api/contenido/analiticas/indicadores'], 'Leer de Meta a la fuerza gasta cuota de la API de Meta (hay freno por uso): lo hace el reloj o el administrador en Analíticas.'),
  ...por(['/api/media/jobs', '/api/media/generate', '/api/media/edit', '/api/media/enhance', '/api/media/presets/apply', '/api/media/lotes', '/api/voces/design', '/api/voces/clone'],
    'Generar, editar, mejorar, aplicar un preset, iniciar un lote o clonar una voz GASTA dinero en un motor: por MCP solo se prepara el costo (alcance «gasto»); GENERAR es el segundo paso de una persona.'),
  ...por(['/api/series/:id/presupuesto', '/api/series/:id/generar', '/api/series/:id/continuar', '/api/series/:id/resolver', '/api/series/:id/pausar', '/api/series/:id/cancelar', '/api/series/libro/resolver'],
    'GENERAR SERIE autoriza gasto con un token de un solo uso atado a la cifra; pausar, cancelar y resolver un «incierto» tocan una serie viva y dinero en duda: dos clics de una persona.'),
  '/api/sub/ops': 'Las ops de Dimitri se hacen con la herramienta `hacer` (lista cerrada, con DESHACER); esta ruta es la de la tarjeta de la página.',
  '/api/sub/studio': 'Es el clic GENERAR de la tarjeta de Dimitri en el Estudio: gasta.',
  '/api/chat': 'El chat directo con un agente puede gastar modelo y leer conectores del departamento: se abre desde la oficina.',
  '/api/costs/apply': 'Aplicar una sugerencia de costos cambia el modelo de un agente o pausa una rutina: es del botón de Costos (`agentes_cambiar` y `rutinas_cambiar` cubren lo que sí).',
};

/** Acceso, seguridad, secretos y la propia administración del conector: el conector no se administra a sí mismo. */
const ACCESO = {
  ...por(['/api/conectar-claude/cortar-todas', '/api/conectar-claude/:id', '/api/conectar-claude/solicitudes/:id/aprobar', '/api/conectar-claude/solicitudes/:id/rechazar'],
    'El conector no se administra a sí mismo: cortar una conexión es de una persona en Ajustes → Conectar Claude, y aprobar o rechazar una tarjeta de gasto es SOLO humano (un token de MCP da 401).'),
  ...por(['/api/yo/sesiones/cerrar', '/api/yo/sesiones/cerrar-todas', '/api/vinculo-telegram/codigo', '/api/vinculo-telegram/confirmar', '/api/vinculo-telegram/desvincular', '/api/equipo/invitaciones'],
    'Sesiones, invitaciones y vínculos de Telegram son la identidad de cada persona: se manejan en su perfil, nunca por un asistente.'),
  ...por(['/api/funciones', '/api/settings/telegram'], 'Los interruptores de las funciones abren gasto o acceso y Telegram lleva ids personales: se encienden en su pantalla, a mano.'),
  ...por(['/api/conectores', '/api/conectores/:id/token'], 'Añadir un conector nuevo o guardar su token mete un secreto y abre una vía de envío: solo un administrador en Ajustes → Conectores (`conectores_cambiar` apaga o habilita los que ya existen).'),
  ...por(['/api/modelos/probar', '/api/modelos/comparar'], 'Probar o comparar un modelo hace llamadas de pago al proveedor: es el botón del administrador en Ajustes → Modelos.'),
  ...por(['/api/migrar/notas', '/api/migrar/filas', '/api/migrar/docs'], 'Migrar desde la computadora del dueño reemplaza datos enteros: es un script con su contraseña, nunca una herramienta.'),
  ...por(['/api/restablecer', '/api/restablecer/confirmar', '/api/restablecer/deshacer'], 'Restablecer la oficina borra o reemplaza todo: nunca por MCP.'),
  ...por(['/api/onboard/company', '/api/onboard/aplicar', '/api/onboard/descartar', '/api/onboard/deshacer'], 'Preparar la oficina desde la web de la empresa propone y escribe cifras, voz y notas: lo revisa una persona en Ajustes.'),
  ...por(['/api/chat/config', '/api/chat/canales', '/api/chat/directo', '/api/chat/canales/:id/mensajes', '/api/chat/canales/:id/escribiendo'], 'El chat del equipo es privado entre personas: los agentes y los asistentes no lo leen ni lo escriben (plan del chat interno).'),
  ...por(['/api/notas-personales', '/api/notas-personales/config', '/api/notas-personales/preferencias-conexion', '/api/notas-personales/:id/cerrar'], 'Las notas personales son de cada cuenta: ni otro administrador ni un asistente las toca.'),
  ...por(['/api/notificaciones/leer', '/api/notificaciones/config'], 'Las notificaciones y sus preferencias son de cada persona.'),
  '/api/business/kpi': 'Es el webhook público del indicador (con su secreto): lo llama un sistema externo, no un asistente (`ajustes_cambiar` anota un valor a mano).',
};

/** Hechos pendientes: no se sirven por MCP todavía pero no son un veto. */
const PENDIENTE = {
  ...por(['/api/contenido/config', '/api/voice'], 'Pendiente: la configuración de Contenido y la voz de marca se cambian en Ajustes; `ajustes_cambiar` aún no las incluye en su lista blanca.'),
  ...por(['/api/contenido/guardados', '/api/contenido/plantillas'], 'Pendiente: los textos guardados y las plantillas de Contenido son notas del Cerebro; por MCP se pueden leer, aún no escribir.'),
  ...por(['/api/media/presets', '/api/media/lotes/hoja', '/api/media/zip', '/api/media/upload', '/api/media/trash/purge'],
    'Pendiente o vetado a propósito en el Estudio: guardar presets propios, leer hojas de lote, descargar ZIP, subir archivos y purgar la papelera (los dos últimos, por irreversibles o por traer bytes de fuera).'),
  '/api/brain/upload': 'Subir un documento lo hace una persona con el archivo en la mano: por MCP entraría el texto de un tercero sin que nadie lo vea.',
};

export const RUTAS_FUERA = Object.freeze({ ...HUMANO, ...ACCESO, ...PENDIENTE });
