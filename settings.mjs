// Agents Office — the settings the owner changes from the office (V4.4, 25 Sep 2026; audit J5, I10). Every field says what
// it does; a change is validated here and written to office.config.local.json (this machine; it wins over the team's
// file and is never uploaded). Proven in tests/settings.test.mjs.
export const GROUPS = [
  ['general', 'General'], ['seguridad', 'Seguridad'], ['aprobaciones', 'Aprobaciones'], ['costos', 'Costos'], ['estudio', 'Estudio'], ['contenido', 'Contenido'], ['anuncios', 'Anuncios'], ['avisos', 'Avisos y Telegram'], ['conectores', 'Conectores'], ['calidad', 'Calidad'], ['equipo', 'Equipo'],
];
const DEPTS = ['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery'];
// type: text · number · bool · select · list (strings) · depts (departments) · time (HH:MM or empty) · people
export const FIELDS = [
  { path: 'name', group: 'general', type: 'text', label: 'Nombre de la empresa', max: 60 },
  { path: 'model', group: 'general', type: 'select', label: 'Modelo por defecto', options: [['sonnet', 'Sonnet (equilibrado)'], ['opus', 'Opus (más capaz)'], ['fable', 'Fable (el más capaz, el más caro)']] },
  { path: 'concurrency', group: 'general', type: 'number', label: 'Agentes trabajando a la vez', min: 1, max: 8, default: 3, help: 'Más a la vez termina antes, pero gasta el plan más rápido.' },
  { path: 'timeout', group: 'general', type: 'number', label: 'Tiempo máximo por tarea (segundos)', min: 60, max: 3600, default: 300 },
  { path: 'safety.writes', group: 'seguridad', type: 'select', label: 'Quién puede enviar, publicar o pagar', options: [['aprobar', 'Solo después de mi OK (recomendado)'], ['pedido', 'Cuando la tarea lo pide'], ['nunca', 'Nunca: los agentes solo preparan']] },
  { path: 'hooks.tokenEnQuery', group: 'seguridad', type: 'bool', default: true, label: 'Aceptar el token en la dirección (?token=) — apágalo cuando ya nadie lo use', help: 'Los webhooks (formularios, indicadores) pueden mandar el secreto en la dirección, pero así queda en los registros de quien envía. Lo correcto es la cabecera X-Office-Token. Mira cuántos usos hubo en los últimos 30 días en Disparadores (usos30d); cuando sea 0, apágalo. Apagado, ?token= da 401.' },
  { path: 'safety.dominiosPorConector', group: 'seguridad', type: 'bool', default: false, label: 'Dominios por conector (solo la nube): dejar que un conector consulte webs de una lista', help: 'Apagado por defecto: una herramienta de un conector que acepta una dirección libre se oculta en el chat con agentes y en Dimitri, y las direcciones que no son del conector se bloquean. Encendido, cada conector puede llevar su lista «Dominios que puede consultar» (Ajustes → Conectores MCP, solo administradores): con lista, sus herramientas con dirección se ofrecen y cada dirección tiene que caer en la lista (o ser del propio conector). Riesgo: un dominio de la lista que deja subir o publicar texto (un servicio de subidas, un blog) puede servir para sacar datos por la dirección. Lista corta, solo dominios propios de confianza.' },
  { path: 'safety.browserSites', group: 'seguridad', type: 'list', label: 'Sitios que puede abrir el Chrome de los agentes', help: 'Vacío = cualquiera que no esté prohibido. Admite *.dominio.com.' },
  { path: 'safety.browserBlock', group: 'seguridad', type: 'list', label: 'Sitios prohibidos', help: 'Tu banco, tus redes personales…' },
  { path: 'safety.limits.perAgentDay', group: 'seguridad', type: 'number', label: 'Envíos por agente al día', min: 0, max: 1000, help: '0 = sin tope.' },
  { path: 'safety.limits.perRecipientDay', group: 'seguridad', type: 'number', label: 'Envíos a una misma dirección al día', min: 0, max: 100 },
  { path: 'approvals.undoSeconds', group: 'aprobaciones', type: 'number', label: 'Segundos para deshacer tras aprobar', min: 0, max: 300 },
  { path: 'approvals.amountLimit', group: 'aprobaciones', type: 'number', label: 'Importe que siempre pide tu OK (US$)', min: 0, max: 1e7, help: '0 = sin límite.' },
  { path: 'approvals.remindAfterHours', group: 'aprobaciones', type: 'number', label: 'Recordarme un borrador tras (horas)', min: 0, max: 720 },
  { path: 'approvals.expireAfterDays', group: 'aprobaciones', type: 'number', label: 'Un borrador caduca tras (días)', min: 0, max: 90 },
  { path: 'approvals.autonomyAfter', group: 'aprobaciones', type: 'number', label: 'Aprobaciones limpias para ofrecer autonomía a una rutina', min: 0, max: 200, help: '0 = nunca ofrecerla.' },
  { path: 'costs.monthlyBudget', group: 'costos', type: 'number', label: 'Presupuesto del mes (US$)', min: 0, max: 1e6, help: '0 = sin presupuesto.' },
  { path: 'costs.alertAt', group: 'costos', type: 'number', label: 'Avisarme al (fracción del presupuesto)', min: 0.1, max: 1, step: 0.05 },
  { path: 'costs.stopAtBudget', group: 'costos', type: 'bool', label: 'Frenar las tareas nuevas al pasar el presupuesto' },
  { path: 'costs.hourlyRate', group: 'costos', type: 'number', label: 'Lo que cuesta una hora de tu equipo (US$)', min: 0, max: 1000 },
  // V4.5 (27 Sep 2026, the owner): the Estudio's caps — they were only in office.config.json (media.*). Applied at once (media.setLimits).
  // V4.7: Contenido — which departments' agents may read the content calendar and leave DRAFTS (they never approve, schedule or publish). Applies on restart.
  { path: 'contenido.modo', group: 'contenido', type: 'select', label: 'Qué pasa con lo que apruebas', options: [['simulacro', 'Simulacro: todo el circuito, sin publicar de verdad (recomendado para empezar)'], ['real', 'Real: lo aprobado se programa y se publica'], ['apagado', 'Apagado: nada sale de la oficina']], default: 'simulacro', help: 'Solo lo que apruebas sale, nunca lo que deja un agente. En «Real» hace falta la key del conductor elegido.' },
  { path: 'contenido.conductor', group: 'contenido', type: 'select', label: 'Quién publica en modo real', options: [['metricool', 'Metricool (publica desde sus servidores, con la PC apagada; 9 redes)'], ['meta', 'Meta directo (Instagram y Facebook, sin Metricool; Instagram sale desde esta PC a su hora)']], default: 'metricool', help: 'Metricool necesita METRICOOL_USER_TOKEN y METRICOOL_USER_ID (variables de Windows; plan Advanced). Meta directo usa el token de Analíticas (META_ACCESS_TOKEN, con los permisos de publicar): Facebook queda programado en Meta y sale solo; Instagram no se puede programar por API y lo publica la oficina a su hora, así que esa hora la PC debe estar encendida con la oficina abierta. Compruébalo en Contenido → Programación.' },
  { path: 'contenido.redes', group: 'contenido', type: 'checks', label: 'Redes que usas', options: [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['linkedin', 'LinkedIn'], ['x', 'X'], ['threads', 'Threads'], ['bluesky', 'Bluesky'], ['tiktok', 'TikTok'], ['pinterest', 'Pinterest'], ['youtube', 'YouTube']], default: ['instagram', 'facebook'], help: 'Las que salen al crear una pieza y en los filtros de Contenido. Las demás siguen a mano en «Más redes». Para publicar en ellas, conéctalas en Metricool.' },
  { path: 'contenido.publicarYa', group: 'contenido', type: 'bool', label: 'Botón «Publicar ahora» en Contenido', help: 'Apagado por defecto. Encendido, el editor de una pieza ofrece publicarla en este minuto en Instagram y Facebook (solo con «Real» y «Meta directo»). No se puede deshacer: lo programado sí. Solo lo pulsa el dueño; ni Dimitri ni los agentes pueden.' },
  { path: 'contenido.entregarHorasAntes', group: 'contenido', type: 'number', label: 'Entregar al conductor (horas antes de que salga)', min: 0, max: 720, default: 24, help: 'Hasta entonces la cambias o la cancelas sin límites; después, depende del conductor. 0 = al aprobarla.' },
  // Fase B1 (9 oct 2026, §12 del plan): de dónde trae la Bandeja; un comentario que llega por las dos no se duplica
  { path: 'contenido.bandejaFuente', group: 'contenido', type: 'select', label: 'La Bandeja trae de', options: [['auto', 'Automático: Meta si hay token de Meta; si no, Metricool'], ['meta', 'Meta (los comentarios de Instagram y Facebook, también de los anuncios; se pueden ocultar)'], ['metricool', 'Metricool (mensajes, comentarios y reseñas de todas sus redes)'], ['ambas', 'Las dos (lo que llega por las dos sale una sola vez)']], default: 'auto', help: 'Meta usa el token de Analíticas (META_ACCESS_TOKEN) y lee cada 3 min con la Bandeja abierta y cada 10 si no. Responder y ocultar los haces tú, según el modo de arriba (en Simulacro no sale nada).' },
  { path: 'contenido.historiasAuto', group: 'contenido', type: 'bool', label: 'Historias automáticas', 
    help: 'Apagado por defecto. Encendido, cada día lo que ya publicaste (con imagen, hace más de 2 días) vuelve como historia en Instagram y Facebook. No gasta: usa la misma imagen.' },
  { path: 'contenido.historiasHora', group: 'contenido', type: 'text', label: 'Hora de la primera historia del día', default: '18:00', pattern: /^([01]\d|2[0-3]):[0-5]\d$/, patternHelp: 'es una hora como 18:00', max: 5,
    help: 'En 24 horas, como 18:00. Si hay varias al día, las demás salen cada 2 horas, sin pasar de las 22:00.' },
  { path: 'contenido.historiasPorDia', group: 'contenido', type: 'number', label: 'Historias automáticas al día', min: 1, max: 5, default: 1, help: 'De 1 a 5. Cada una es una publicación distinta; la misma no vuelve antes de 4 días.' },
  { path: 'contenido.historiasSinOk', group: 'contenido', type: 'bool', label: 'Que las historias automáticas salgan sin pedirme el OK', 
    help: 'Apagado: cada historia espera tu OK en Contenido (y en Telegram con /contenido). Encendido: nacen aprobadas con tu OK permanente, '
      + 'porque ya aprobaste esa publicación una vez. El modo de arriba sigue mandando: en Simulacro no sale nada de verdad.' },
  { path: 'contenido.departments', group: 'contenido', type: 'depts', label: 'Departamentos cuyos agentes pueden dejar borradores', restart: true, help: 'Leen el calendario de contenido y dejan borradores que tú revisas y apruebas en Contenido (K). Ninguno aprueba, programa ni publica. Vacío = ninguno.', default: ['marketing', 'delivery'] },
  // Fase 0 de Anuncios (8 oct 2026, docs/plan-meta-anuncios-y-bandeja-2026-10-09.md §5): los ids de Meta (no son secretos: el token y el
  // secreto van SOLO en variables de Windows) y los topes que la oficina comprueba antes de cualquier acción que gaste (§3.4). Los
  // valores por defecto son los del §12 del plan; el dueño los confirma la primera vez que abre el panel de Anuncios.
  { path: 'anuncios.cuenta', group: 'anuncios', type: 'text', optional: true, max: 30, placeholder: 'act_1234567890', normalize: s => (/^\d+$/.test(s) ? `act_${s}` : s), pattern: /^act_\d{5,20}$/, patternHelp: 'es «act_» y los números de tu cuenta publicitaria (Administrador de anuncios → la cuenta, arriba a la izquierda)', label: 'Cuenta publicitaria de Meta', help: 'El id de la cuenta publicitaria de PanaClaw. Vacío = Anuncios apagado. Moneda y zona horaria se leen de Meta (deben ser USD y America/Panama).' },
  { path: 'anuncios.pagina', group: 'anuncios', type: 'text', optional: true, max: 25, placeholder: 'la de Contenido', pattern: /^\d{5,25}$/, patternHelp: 'son solo números (el id de la página de Facebook)', label: 'Página de Facebook de los anuncios', help: 'Vacío = la misma página que usa Contenido.' },
  { path: 'anuncios.instagram', group: 'anuncios', type: 'text', optional: true, max: 25, placeholder: 'el de la página', pattern: /^\d{5,25}$/, patternHelp: 'son solo números (el id de la cuenta de Instagram de empresa)', label: 'Cuenta de Instagram de los anuncios', help: 'Vacío = la cuenta de Instagram unida a esa página.' },
  { path: 'anuncios.pixel', group: 'anuncios', type: 'text', optional: true, max: 25, placeholder: 'sin píxel', pattern: /^\d{5,25}$/, patternHelp: 'son solo números (el id del píxel o conjunto de datos)', label: 'Píxel o conjunto de datos', help: 'Si vendes en una web (o quieres mandar a Meta las ventas de los mensajes con la API de conversiones: el conjunto de datos ligado a tu página). Sin píxel, las campañas van a mensajes, WhatsApp o visitas al perfil.' },
  { path: 'anuncios.whatsapp', group: 'anuncios', type: 'text', optional: true, max: 25, placeholder: '50765310721', normalize: normalizarWhatsapp, check: revisarWhatsapp, pattern: /^\d{8,15}$/, patternHelp: 'el número con el código de país y sin signos, entre 8 y 15 dígitos (Panamá: 507 y los 8 dígitos, p. ej. 50765310721); puedes escribirlo con +, espacios o guiones', label: 'Número de WhatsApp Business', help: 'Para anuncios que abren WhatsApp. Solo sirve para saber que hay WhatsApp: a Meta no se le manda; el número del anuncio es el que está vinculado a la página en Meta (Administrador de WhatsApp). Cambiarlo aquí no cambia ningún anuncio.' },
  { path: 'anuncios.topeDiario', group: 'anuncios', type: 'number', label: 'Tope de gasto al día (US$)', min: 0, max: 100000, step: 1, default: 20, help: 'La suma de los presupuestos diarios activos más lo que se activa. Nada que lo pase se activa ni se sube. 0 = no se puede gastar.' },
  { path: 'anuncios.topeMensual', group: 'anuncios', type: 'number', label: 'Tope de gasto al mes (US$)', min: 0, max: 1000000, step: 1, default: 300, help: 'Lo gastado este mes más lo comprometido hasta fin de mes.' },
  { path: 'anuncios.topeCampana', group: 'anuncios', type: 'number', label: 'Tope por campaña (US$)', min: 0, max: 1000000, step: 1, default: 150, help: 'Cada campaña lo lleva también en Meta (spend_cap): aunque la oficina esté cerrada, Meta no gasta más.' },
  { path: 'anuncios.cpaObjetivo', group: 'anuncios', type: 'number', label: 'Costo por resultado que te parece bueno (US$)', min: 0, max: 100000, step: 0.1, default: 0, help: 'Con esto se decide qué cortar y qué escalar. 0 = se calcula de las cifras de la empresa (margen y valor de un cliente); si no hay, se te pregunta.' },
  { path: 'anuncios.competenciaTopeSemana', group: 'anuncios', type: 'number', label: 'Anuncios de la competencia: créditos por semana', min: 0, max: 500, step: 1, default: 10,
    help: 'Cada búsqueda nueva en la Biblioteca de anuncios (por Scrape Creators) gasta un crédito de ese servicio; la misma búsqueda no se paga otra vez en 12 horas. 0 = apagado.' },
  { path: 'anuncios.competenciaPais', group: 'anuncios', type: 'text', optional: true, max: 2, placeholder: 'PA', normalize: s => String(s).toUpperCase(), pattern: /^[A-Z]{2}$/, patternHelp: 'son las dos letras del país (PA, CO, MX…)',
    label: 'Anuncios de la competencia: país', help: 'Dónde se buscan los anuncios de tus competidores. Vacío = Panamá.' },
  { path: 'anuncios.pilotoAutomatico', group: 'anuncios', type: 'bool', label: 'Piloto automático (solo para gastar MENOS)', help: 'Pausa sin preguntarte un anuncio que gastó sin resultados, o todo si se pasa el tope del día; te avisa y se puede deshacer. Nunca activa ni sube presupuestos.' },
  // Fase A6 (10 oct 2026): la API de conversiones (anuncios/conversiones.mjs). Apagada por defecto; el token sigue siendo META_ACCESS_TOKEN.
  { path: 'anuncios.conversiones', group: 'anuncios', type: 'bool', label: 'API de conversiones (decirle a Meta lo que se vendió)', help: 'Apagada por defecto. Encendida, la oficina le manda a Meta las ventas y los contactos que llegan por tus disparadores (un pago de Stripe, un formulario) y los que marcas en una conversación de la Bandeja. El correo y el teléfono van cifrados; nada sale en claro. Necesita el píxel o conjunto de datos de arriba.' },
  { path: 'anuncios.conversionesEventos', group: 'anuncios', type: 'checks', label: 'Eventos que se mandan', default: ['compra', 'contacto'], options: [['compra', 'Compras (Purchase, con su importe)'], ['contacto', 'Contactos (Lead de la web; contacto calificado — QualifiedLead — de los mensajes)']] },
  { path: 'anuncios.conversionesPrueba', group: 'anuncios', type: 'text', optional: true, max: 40, placeholder: 'TEST12345', pattern: /^[A-Za-z0-9_-]{3,40}$/, patternHelp: 'es el código de «Probar eventos» (letras y números, p. ej. TEST12345)', label: 'Código de prueba de eventos', help: 'Del Administrador de eventos → tu conjunto de datos → «Probar eventos». Solo lo usa «Mandar un evento de prueba» en Anuncios → Resumen; los eventos de verdad nunca lo llevan.' },
  { path: 'media.dailyLimit', group: 'estudio', type: 'number', label: 'Tope de generaciones al día', min: 0, max: 10000, default: 40, help: 'Cuenta imágenes; un video cuenta como 5. Lo del motor «Prueba» no cuenta. 0 = sin tope.' },
  { path: 'media.dailyBudget', group: 'estudio', type: 'number', label: 'Gasto máximo al día en el Estudio (US$)', min: 0, max: 100000, step: 0.5, default: 0, help: 'Con el precio aproximado de cada modelo; lo que está generándose ya cuenta. Un pedido que lo pasaría no se envía. 0 = sin límite.' },
  { path: 'media.monthlyBudget', group: 'estudio', type: 'number', label: 'Gasto máximo al mes en el Estudio (US$)', min: 0, max: 1000000, step: 1, default: 0, help: 'Igual, por mes calendario. Aparte del presupuesto de la oficina (Costos), que cuenta a los agentes. 0 = sin límite.' },
  { path: 'media.maxPerRequest', group: 'estudio', type: 'number', label: 'Imágenes por pedido (máximo)', min: 1, max: 8, default: 8, help: 'Cuántas se pueden pedir de una vez. Un video va de 1 a 4.' },
  { path: 'media.concurrency', group: 'estudio', type: 'number', label: 'Trabajos del Estudio a la vez', min: 1, max: 6, default: 3, help: 'Más a la vez termina antes, pero los motores pueden pedir esperar.' },
  { path: 'telegram.quiet.from', group: 'avisos', type: 'time', label: 'No molestar desde' },
  { path: 'telegram.quiet.to', group: 'avisos', type: 'time', label: 'No molestar hasta' },
  { path: 'telegram.notify.approvals', group: 'avisos', type: 'bool', label: 'Avisar de borradores que esperan mi OK' },
  { path: 'telegram.notify.failures', group: 'avisos', type: 'bool', label: 'Avisar de tareas que fallan' },
  { path: 'telegram.notify.done', group: 'avisos', type: 'bool', label: 'Avisar de cada tarea terminada' },
  { path: 'telegram.notify.comentarios', group: 'avisos', type: 'bool', label: 'Avisar de comentarios nuevos en mis redes', default: true, help: 'Uno cada 15 minutos como mucho («y N más»), respetando el no molestar. Solo los que trae Meta.' },
  { path: 'telegram.notify.mensajes', group: 'avisos', type: 'bool', label: 'Avisar de mensajes privados nuevos (Instagram y Messenger)', default: true, help: 'Con cuánto queda para responder (Meta da 24 horas desde el último mensaje del cliente). Uno cada 15 minutos como mucho, respetando el no molestar. Necesita el acceso avanzado de Meta.' },
  { path: 'telegram.notify.notices', group: 'avisos', type: 'bool', label: 'Avisar de los avisos de la oficina' },
  { path: 'deputy.weekly', group: 'avisos', type: 'bool', label: 'Informe semanal de Dimitri el lunes', help: 'Cómo fue la semana, qué decidir; llega a los avisos y a Telegram.' },
  { path: 'tools.web', group: 'conectores', type: 'bool', label: 'Búsqueda web para los agentes', restart: true },
  { path: 'tools.browser', group: 'conectores', type: 'bool', label: 'Tu Chrome para los agentes', restart: true },
  // Auditoría MCP (1 oct 2026, MCP-12): the names match the bar's (a plugin's «Gmail» too) and apply at once (mcp.configure on save)
  { path: 'mcp.deny', group: 'conectores', type: 'list', label: 'Conectores que los agentes no pueden usar', help: 'Nombres como salen en la barra (Gmail, Shopify…). Se aplica al instante.' },
  { path: 'mcp.allow', group: 'conectores', type: 'list', label: 'Solo estos conectores (lista blanca)', help: 'Vacío = todos los conectados. Si pones nombres, los agentes solo usan esos. Un conector que la oficina no conoce no llega a ninguna mesa hasta que lo asignas en office.config.json → mcp.departments.' },
  { path: 'quality.review.enabled', group: 'calidad', type: 'bool', label: 'Segunda opinión del jefe en lo delicado' },
  { path: 'quality.review.departments', group: 'calidad', type: 'depts', label: 'Departamentos que siempre pasan por su jefe' },
  { path: 'team.people', group: 'equipo', type: 'people', label: 'Personas del equipo', help: 'Para asignarles tareas, mencionarlas en comentarios y pasarles trabajo. El id de Telegram es opcional: si lo pones, les llegan sus avisos.' },
];
/** Del número que escribe la persona («+507 6531-0721») deja solo los dígitos. */
export function normalizarWhatsapp(s) { return String(s ?? '').replace(/[\s+\-().]/g, ''); }
/** Con el código de país: un número de 8 dígitos (local de Panamá) o que empiece por 0 no lo lleva. → texto del error o null. */
export function revisarWhatsapp(d) {
  if (/^507/.test(d) && d.length !== 11) return 'los números de Panamá son 507 y 8 dígitos más (11 en total)';
  if (d.length === 8 || /^0/.test(d)) return 'falta el código de país: para Panamá es 507 delante de los 8 dígitos (p. ej. 50765310721)';
  return null;
}
export const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
export function set(o, p, v) { const ks = p.split('.'); let x = o; for (const k of ks.slice(0, -1)) { if (typeof x[k] !== 'object' || x[k] === null || Array.isArray(x[k])) x[k] = {}; x = x[k]; } x[ks.at(-1)] = v; return o; }

/** Clean one value for its field; → { value } or { error } in plain words. */
export function clean(f, v) {
  switch (f.type) {
    case 'text': {
      let s = String(v ?? '').trim();
      if (!s) return f.optional ? { value: '' } : { error: `${f.label}: no puede quedar vacío` };
      if (f.normalize) s = f.normalize(s);
      if (f.pattern && !f.pattern.test(s)) return { error: `${f.label}: ${f.patternHelp || 'no tiene el formato esperado'}` };
      if (f.check) { const e = f.check(s); if (e) return { error: `${f.label}: ${e}` }; }
      return { value: s.slice(0, f.max || 200) };
    }
    case 'number': { const n = Number(v); if (!Number.isFinite(n)) return { error: `${f.label}: tiene que ser un número` }; if (n < f.min || n > f.max) return { error: `${f.label}: entre ${f.min} y ${f.max}` }; return { value: n }; }
    case 'bool': return { value: v === true || v === 'true' || v === 1 };
    case 'select': return f.options.some(([k]) => k === v) ? { value: v } : { error: `${f.label}: opción desconocida` };
    case 'time': { const s = String(v ?? '').trim(); if (s && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(s)) return { error: `${f.label}: usa HH:MM (p. ej. 21:00) o déjalo vacío` }; return { value: s }; }
    case 'list': { const l = (Array.isArray(v) ? v : String(v ?? '').split(/[\n,]/)).map(s => String(s).trim()).filter(Boolean); return { value: [...new Set(l)].slice(0, 100) }; }
    case 'checks': { const l = (Array.isArray(v) ? v : []).filter(k => f.options.some(([o]) => o === k)); if (!l.length) return { error: `${f.label}: elige al menos una` }; return { value: [...new Set(l)] }; }
    case 'depts': { const l = (Array.isArray(v) ? v : []).filter(d => DEPTS.includes(d)); return { value: [...new Set(l)] }; }
    case 'people': {
      const l = (Array.isArray(v) ? v : []).map(p => ({ name: String(p?.name || '').trim().slice(0, 40), telegram: String(p?.telegram || '').trim(), depts: Array.isArray(p?.depts) ? p.depts.filter(d => DEPTS.includes(d)) : [] })).filter(p => p.name);
      const bad = l.find(p => p.telegram && !/^-?\d{4,15}$/.test(p.telegram)); if (bad) return { error: `El id de Telegram de ${bad.name} es un número (pídeselo a @userinfobot)` };
      if (new Set(l.map(p => p.name.toLowerCase())).size !== l.length) return { error: 'Dos personas con el mismo nombre' };
      return { value: l.slice(0, 50) };
    }
  }
  return { error: 'campo desconocido' };
}
/** Apply a set of changes to the local file's object. → { local, errors, restart } */
export function apply(local, changes) {
  const out = JSON.parse(JSON.stringify(local || {})), errors = []; let restart = false;
  for (const [p, v] of Object.entries(changes || {})) {
    const f = FIELDS.find(x => x.path === p); if (!f) { errors.push(`«${p}» no se puede cambiar desde aquí`); continue; }
    const r = clean(f, v); if (r.error) { errors.push(r.error); continue; }
    set(out, p, r.value); if (f.restart) restart = true;
  }
  return { local: out, errors, restart };
}
/** Values for the form: the merged configuration, per field. */
export const values = cfg => Object.fromEntries(FIELDS.map(f => [f.path, get(cfg, f.path)]));
