// QUÉ de los ajustes puede tocar el conector MCP, en DATOS y sin imports (puro): la lista blanca de ajustes no sensibles, los TOPES DE GASTO (que solo se mueven en la dirección que limita, o con
// `confirmado: true`) y, para todo lo demás, el MOTIVO por el que no se toca desde aquí. `cloudflare/tests/mcp-empresa.test.mjs` recorre `FIELDS` de settings.mjs y falla si un campo no está
// decidido en una de las tres listas: un ajuste nuevo no puede quedar «medio abierto» por olvido.

/** Ajustes que un token de alcance `oficina` puede poner con `ajustes_cambiar` → `poner`. Ninguno lleva un secreto, un id de cuenta, un candado de seguridad ni abre gasto. */
export const AJUSTES_PERMITIDOS = Object.freeze([
  'name', 'costs.hourlyRate', 'contenido.redes', 'contenido.departments', 'contenido.entregarHorasAntes', 'contenido.historiasHora', 'contenido.historiasPorDia',
  'anuncios.cpaObjetivo', 'anuncios.competenciaPais', 'telegram.notify.done', 'telegram.notify.comentarios', 'telegram.notify.mensajes', 'telegram.notify.notices', 'deputy.weekly',
]);

/**
 * Los topes de gasto. `cero` dice qué significa un 0: 'sin-tope' (0 = SIN límite: ponerlo AFLOJA), 'no-gasta' (0 = no se gasta: ponerlo limita), null (el mínimo es 1).
 * `bool`: el interruptor «frenar al pasar el presupuesto»: encendido limita; apagado afloja.
 */
export const TOPES = Object.freeze({ // `defecto`: lo que rige si nunca se tocó (los de fábrica del Worker); `defecto` sale de `FIELDS[].default` (un test lo compara); sin él, el implícito (0 o apagado)
  presupuesto_ia_mes: { path: 'costs.monthlyBudget', cero: 'sin-tope', defecto: 0, unidad: 'US$', titulo: 'Presupuesto del mes de IA (agentes, Dimitri…)' },
  freno_presupuesto: { path: 'costs.stopAtBudget', bool: true, defecto: false, titulo: 'Frenar las tareas nuevas al pasar el presupuesto de IA' },
  estudio_dia_usd: { path: 'media.dailyBudget', cero: 'sin-tope', defecto: 0, unidad: 'US$', titulo: 'Gasto máximo al día en el Estudio' },
  estudio_mes_usd: { path: 'media.monthlyBudget', cero: 'sin-tope', defecto: 0, unidad: 'US$', titulo: 'Gasto máximo al mes en el Estudio' },
  estudio_generaciones_dia: { path: 'media.dailyLimit', cero: 'sin-tope', defecto: 40, unidad: 'generaciones', titulo: 'Tope de generaciones del Estudio al día' },
  estudio_por_pedido: { path: 'media.maxPerRequest', cero: null, defecto: 8, unidad: 'imágenes', titulo: 'Imágenes por pedido (máximo)' },
  anuncios_dia_usd: { path: 'anuncios.topeDiario', cero: 'no-gasta', defecto: 20, unidad: 'US$', titulo: 'Tope de gasto de anuncios al día' },
  anuncios_mes_usd: { path: 'anuncios.topeMensual', cero: 'no-gasta', defecto: 300, unidad: 'US$', titulo: 'Tope de gasto de anuncios al mes' },
  anuncios_campana_usd: { path: 'anuncios.topeCampana', cero: 'no-gasta', defecto: 150, unidad: 'US$', titulo: 'Tope de gasto por campaña' },
  competencia_semana: { path: 'anuncios.competenciaTopeSemana', cero: 'no-gasta', defecto: 10, unidad: 'créditos', titulo: 'Créditos de la competencia por semana' },
});
export const PATH_DE_TOPE = Object.freeze(Object.fromEntries(Object.entries(TOPES).map(([k, v]) => [v.path, k])));

const FUERA = [
  [/^safety\./, 'candado de seguridad de los envíos: solo el dueño, en la oficina'], [/^hooks\./, 'abre o cierra el acceso de los webhooks: solo el dueño, en la oficina'],
  [/^(approvals\.|quality\.review|costs\.alertAt$|telegram\.quiet\.|telegram\.notify\.(approvals|failures)$)/, 'supervisión del dueño (plazos de aprobación, avisos de lo que espera su OK o falla, horario de no molestar, segunda opinión ' +
    'del jefe, alerta de presupuesto): aflojarla esconde cosas; solo el dueño, en la oficina'],
  [/^approvals\.(amountLimit|autonomyAfter)$/, 'decide cuánto dinero pide el OK del dueño y cuándo un agente envía solo: es un candado, solo el dueño en la oficina'],
  [/^contenido\.(modo|conductor|publicarYa|historiasAuto|historiasSinOk|bandejaFuente)$/, 'decide si algo se publica de verdad, quién publica o si sale sin OK: solo el dueño, en la oficina'],
  [/^anuncios\.(cuenta|pagina|instagram|pixel|whatsapp)$/, 'es el id de una cuenta o un número del negocio: dato sensible, solo en la oficina'],
  [/^anuncios\.(pilotoAutomatico|conversiones|conversionesEventos|conversionesPrueba)$/, 'abre una función que toca el gasto o los datos enviados a Meta: solo el dueño, en la oficina'],
  [/^(model|concurrency|timeout|media\.concurrency)$/, 'cambia cuánto y cuán rápido gastan los agentes o el Estudio: el modelo se cambia con `modelo` y los topes con `topes_cambiar`'],
  [/^(tools\.|mcp\.)/, 'decide qué poder tienen los agentes (web, Chrome, conectores): solo el dueño, en la oficina'],
  [/^team\.people$/, 'lleva los ids de Telegram de las personas: solo en la oficina'],
];
/** → el motivo por el que el conector no cambia ese campo; null si sí puede (lista blanca o tope). */
export function motivoFuera(path) {
  if (AJUSTES_PERMITIDOS.includes(path) || path in PATH_DE_TOPE) return null;
  return FUERA.find(([re]) => re.test(path))?.[1] || 'no está en la lista de ajustes que el conector puede cambiar: se cambia en la oficina';
}
/** Los campos con valor de cuenta que ni se leen por MCP (solo «puesto» o «vacío»). */
export const CAMPOS_OCULTOS = Object.freeze(['anuncios.cuenta', 'anuncios.pagina', 'anuncios.instagram', 'anuncios.pixel', 'anuncios.whatsapp', 'anuncios.conversionesPrueba', 'team.people']);

/** Lo que NUNCA existe por este conector (cada línea, con su motivo; el test falla si una herramienta o acción lo nombra). */
export const EXCLUIDO = Object.freeze({
  secretos: 'Ningún secreto (llaves, tokens, contraseñas, `AO_*`) se lee ni se escribe por MCP.',
  personas: 'Invitar, quitar o cambiar el rol de una persona, y cambiar contraseñas: solo un administrador en la oficina.',
  restablecer: 'Restablecer la oficina.',
  candados: 'Los candados de seguridad: `safety.writes`, los límites de envío y los aprobadores de Telegram.',
  conector_mcp: 'Activar o configurar este conector MCP (`mcp.*`).',
  flags_de_gasto: 'Encender interruptores que abren gasto (conversiones, series de pago, pilotos).',
  conectores_nuevos: 'Añadir conectores nuevos o cambiar su autenticación o su token.',
  chat: 'Leer o escribir el chat interno del equipo: es privado.',
});

/** El valor que rige hoy: el guardado o, si nunca se tocó, el de fábrica (`defecto`); sin él, undefined (no se sabe). */
export const actual = (def, v) => (v === undefined || v === null || v === '' ? def.defecto : v);
const tieneValor = (v) => v !== undefined && v !== null && v !== '';
const efectivo = (def, v) => (def.cero === 'sin-tope' && Number(v) === 0 ? Infinity : Number(v));
/**
 * ¿Cambiar un tope de `antes` a `despues` lo AFLOJA (deja gastar más)? Un valor que no se conoce cuenta como que sí, salvo ponerlo en su mínimo.
 * → true | false. Mismo valor = false (no cambia nada).
 */
export function afloja(def, antes, despues) {
  if (def.bool) return antes === true && despues === false;
  if (!tieneValor(antes)) return !(def.cero === 'no-gasta' && Number(despues) === 0);
  const a = efectivo(def, antes), d = efectivo(def, despues);
  return d > a;
}

/**
 * Las rutas /api/ de la empresa que ninguna herramienta toca, cada una con su MOTIVO (por prefijo). El test «ningún cabo suelto» (mcp-empresa.test.mjs) recorre los módulos de la empresa y falla
 * si una ruta no está cubierta por las `RUTAS` de un dominio ni aparece aquí: una ruta nueva se decide en el mismo cambio que la crea.
 */
export const RUTAS_EXCLUIDAS = Object.freeze([
  ['/api/live', 'canal de tiempo real de la página (socket): no es una herramienta'], ['/api/yo', 'el perfil, la foto, la contraseña y las sesiones de cada persona: personal, nunca por este conector'],
  ['/api/equipo/invitaciones', 'invitar o retirar una invitación: solo un administrador en la oficina'], ['/api/equipo/', 'quitar a alguien, cambiar su rol, su contraseña o su foto: solo un administrador en la oficina'],
  ['/api/conectores/plantillas', 'el catálogo de plantillas es de la pantalla de añadir conectores, que es del dueño'], ['/api/conectores/probar', 'llama a un servidor externo con el token del conector: solo en la oficina'],
  ['/api/modelos/activos', 'lo cubre `ajustes` → modelos'], ['/api/modelos/probar', 'cada prueba gasta unos centavos: se hace en la oficina'], ['/api/modelos/comparar', 'cada comparación gasta: se hace en la oficina'],
  ['/api/settings/telegram', 'registrar o quitar ids de Telegram y aprobadores es un candado: solo en la oficina (leerlo, sin ids, sí está en `ajustes`)'],
  ['/api/telegram', 'el webhook público de Telegram: lo llama Telegram, no una persona'], ['/api/hook', 'el webhook público de los disparadores: lo llaman otros sistemas con su secreto'], ['/api/kpi', 'el webhook público de indicadores: lo llaman otros sistemas con su secreto'],
  ['/api/business/kpi', 'crear, cambiar o quitar la definición de un indicador: en la oficina (anotar un valor sí está en `ajustes_cambiar`)'],
  ['/api/cifras/confirmar', 'confirmar las cifras que propone la oficina es aprobar: lo hace el dueño'], ['/api/voice', 'la voz de marca es una nota del Cerebro: la cubre el carril del Cerebro'],
  ['/api/brain', 'las notas del Cerebro las cubre el carril del Cerebro'], ['/api/onboard', 'preparar la oficina desde una web o restablecerla: solo el dueño, en la oficina'], ['/api/restablecer', 'restablecer la oficina: nunca por MCP'],
  ['/api/costs.csv', 'es un archivo para contabilidad, no texto'], ['/api/costs/apply', 'aplica una sugerencia que cambia el modelo de un agente o pausa una rutina: lo cubren los carriles de agentes y tareas'],
  ['/api/usage', 'el medidor de la esquina: lo cubre `costos` → resumen'], ['/api/funciones', 'los interruptores de funciones nuevas abren gasto o acceso: solo el dueño, en la oficina'],
  ['/api/notas-personales', 'las notas que una persona le deja a otra son privadas de cada cuenta: no se leen ni se escriben por MCP'],
  ['/api/notificaciones/config', 'encender o apagar las notificaciones es un interruptor de funciones: solo el dueño (leerlo sí está en `ajustes` → avisos)'],
  ['/api/notificaciones', 'la bandeja de avisos de cada persona es personal'], ['/api/chat', 'el chat interno del equipo es privado: ni se lee ni se escribe por MCP (solo se dice si está encendido)'],
]);
