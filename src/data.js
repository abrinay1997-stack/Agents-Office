// Agents Office v2 — roster + design tokens (ported from v1 command-centre.html)
import { applyData } from './profile.js';

// Nominal.so tokens (locked design language, 30 Jul 2026)
export const TOKENS = {
  cream: '#FDFFF8',
  ink: '#151414',
  grey: '#5A5A5A',
  hairline: 'rgba(21,20,20,0.12)',
};

// Dept mapping: Support→mint, Sales→butter, Marketing→coral, Finance→periwinkle,
// Operations→violet, Brain→sage.
// NOTE (17 Aug 2026): the old 'ops' pod split in two. The accounting half kept the pod,
// the periwinkle palette and the key 'fin' (now FINANCE); Proposals + Intel moved out into
// a new 'ops' pod (OPERATIONS) alongside Legal Review, Compliance and Internal Reporting.
// V3.1 (5 Sep 2026, AJ): SUPPORT → EMAILS (same mint slot), new DELIVERY pod (sky) on the top axis.
export const DEPT_KEYS = ['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery'];
export const DEPTS = {
  emails:    { name: 'CORREOS',          short: 'CORREOS',  chip: '#5ADEB7', ink: '#1E9070', floor: '#E9F6EF' },
  delivery:  { name: 'ENTREGAS',         short: 'ENTREGAS', chip: '#8FD3F4', ink: '#2E86AB', floor: '#E6F4FB' },
  sales:     { name: 'VENTAS',           short: 'VENTAS',   chip: '#EADC8F', ink: '#A08A1E', floor: '#F6F1DA' },
  marketing: { name: 'MARKETING',        short: 'MARKETING', chip: '#E69393', ink: '#C46060', floor: '#FAE9E7' },
  fin:       { name: 'FINANZAS',         short: 'FINANZAS', chip: '#98A5EF', ink: '#5B66CE', floor: '#EAEDFA' },
  ops:       { name: 'OPERACIONES',      short: 'OPERACIONES', chip: '#BFA2E3', ink: '#7449A9', floor: '#F2ECFA' },
  brain:     { name: 'EL CEREBRO',       short: 'EL CEREBRO', chip: '#D1DECD', ink: '#4C7A57', floor: '#E9EFE4' },
};

// 35 agents (V3.4, 7 Sep 2026: every department has a lead). grid = [col,row] desk slot on the department plinth.
export const AGENTS = [
  // EMAILS (5) — replaced Customer Support, 5 Sep 2026
  { id: 'elead', name: 'LÍDER DE CORREOS',    dept: 'emails',    lead: true,  grid: [0.5, 0], hair: '#2b2b2b', skin: '#E8B98E' },
  { id: 'cmail', name: 'CORREOS DE CLIENTES', dept: 'emails',    grid: [0, 1], hair: '#3b2b1d', skin: '#F0C9A0' },
  { id: 'imail', name: 'CORREOS INTERNOS',    dept: 'emails',    grid: [1, 1], hair: '#111111', skin: '#C68B59' },
  { id: 'vmail', name: 'CORREOS DE PROVEEDORES', dept: 'emails', grid: [0, 2], hair: '#7a3b12', skin: '#F5D5B0' },
  { id: 'kmail', name: 'CORREOS DE CONTRATISTAS', dept: 'emails', grid: [1, 2], hair: '#4a2a10', skin: '#D89F70' },
  // SALES (6) — Sales Lead at the head; Proposals moved in from Operations, Outreach retired
  { id: 'lexi',  name: 'LÍDER DE VENTAS',     dept: 'sales',     lead: true,  grid: [0.5, 0], hair: '#5a2d0c', skin: '#F0C9A0' },
  { id: 'enzo',  name: 'ENRIQUECEDOR DE PROSPECTOS', dept: 'sales', grid: [0, 1], hair: '#1c1c2e', skin: '#E0A878' },
  { id: 'ilm',   name: 'GERENTE DE PROSPECTOS ENTRANTES', dept: 'sales', grid: [1, 1], hair: '#26140a', skin: '#F5D5B0' },
  { id: 'pros',  name: 'PROSPECTADOR',        dept: 'sales',     grid: [0, 2], hair: '#2a1a0e', skin: '#E8B98E' },
  { id: 'piper', name: 'PROPUESTAS',          dept: 'sales',     grid: [1, 2], hair: '#2d1a0a', skin: '#F0C9A0' },
  { id: 'folo',  name: 'SEGUIMIENTOS',        dept: 'sales',     grid: [0.5, 3], hair: '#171717', skin: '#F5D5B0' },
  // MARKETING (7) — Marketing Lead at the head since 7 Sep 2026
  { id: 'mlead', name: 'LÍDER DE MARKETING',  dept: 'marketing', lead: true,  grid: [0.5, 0], hair: '#2a1a0e', skin: '#E0A878' },
  { id: 'riley', name: 'INVESTIGACIÓN',       dept: 'marketing', grid: [0, 1], hair: '#8a4a1f', skin: '#F5D5B0' },
  { id: 'newt',  name: 'BOLETÍN',             dept: 'marketing', grid: [1, 1], hair: '#26140a', skin: '#D89F70' },
  { id: 'gfx',   name: 'DISEÑADOR GRÁFICO',   dept: 'marketing', grid: [0, 2], hair: '#141414', skin: '#F0C9A0' },
  { id: 'ada',   name: 'ANUNCIOS DE META',    dept: 'marketing', grid: [1, 2], hair: '#3d2814', skin: '#C68B59' },
  { id: 'iggy',  name: 'INSTAGRAM ORGÁNICO',  dept: 'marketing', grid: [0, 3], hair: '#552200', skin: '#E8B98E' },
  { id: 'vid',   name: 'EDITOR DE VIDEO',     dept: 'marketing', grid: [1, 3], hair: '#1b1b24', skin: '#D9A97E' },
  // OPERATIONS (6) — Operations Lead at the head since 7 Sep 2026; Internal Dashboards joins; Proposals moved to Sales
  { id: 'olead', name: 'LÍDER DE OPERACIONES', dept: 'ops',      lead: true,  grid: [0.5, 0], hair: '#111111', skin: '#F0C9A0' },
  { id: 'scout', name: 'INTELIGENCIA',        dept: 'ops',       grid: [0, 1], hair: '#101820', skin: '#B07850' },
  { id: 'legal', name: 'REVISIÓN LEGAL',      dept: 'ops',       grid: [1, 1], hair: '#20242e', skin: '#F0C9A0' },
  { id: 'comply', name: 'REVISOR DE CUMPLIMIENTO', dept: 'ops',  grid: [0, 2], hair: '#5a3a1a', skin: '#C68B59' },
  { id: 'report', name: 'INFORMES INTERNOS',  dept: 'ops',       grid: [1, 2], hair: '#2e2118', skin: '#E8B98E' },
  { id: 'dash',  name: 'TABLEROS INTERNOS',   dept: 'ops',       grid: [0.5, 3], hair: '#0d0d0d', skin: '#9C6B43' },
  // FINANCE (4) — the accounting team; Accounting Lead at the head
  { id: 'alead', name: 'LÍDER DE CONTABILIDAD', dept: 'fin',     lead: true,  grid: [0.5, 0], hair: '#1f1f1f', skin: '#E0A878' },
  { id: 'invo',  name: 'FACTURACIÓN',         dept: 'fin',       grid: [0, 1], hair: '#4a2a10', skin: '#F5D5B0' },
  { id: 'apay',  name: 'CUENTAS POR PAGAR',   dept: 'fin',       grid: [1, 1], hair: '#0a0a0a', skin: '#8A5A32' },
  { id: 'recon', name: 'CONCILIACIÓN',        dept: 'fin',       grid: [0.5, 2], hair: '#33221a', skin: '#E8B98E' },
  // DELIVERY (7) — new pod, 5 Sep 2026; Onboarder moved in from Sales
  { id: 'dlead', name: 'LÍDER DE ENTREGAS',   dept: 'delivery',  lead: true,  grid: [0.5, 0], hair: '#1f1f1f', skin: '#F0C9A0' },
  { id: 'pco',   name: 'COORDINADOR DE PROYECTOS', dept: 'delivery', grid: [0, 1], hair: '#3d2814', skin: '#E8B98E' },
  { id: 'qa',    name: 'REVISOR DE CALIDAD',  dept: 'delivery', grid: [1, 1], hair: '#101820', skin: '#C68B59' },
  { id: 'crep',  name: 'INFORMES DE CLIENTES', dept: 'delivery', grid: [0, 2], hair: '#6b3410', skin: '#F5D5B0' },
  { id: 'cass',  name: 'RECURSOS DE CLIENTES', dept: 'delivery', grid: [1, 2], hair: '#141414', skin: '#D9A97E' },
  { id: 'dasst', name: 'ASISTENTE DE DISEÑO', dept: 'delivery',  grid: [0, 3], hair: '#552200', skin: '#F0C9A0' },
  { id: 'ona',   name: 'RESPONSABLE DE INCORPORACIÓN', dept: 'delivery', grid: [1, 3], hair: '#0d0d0d', skin: '#9C6B43' },
];

// Plinth placement in world XZ. Brain central; departments well separated (AJ: not too close at zoom-out).
export const LAYOUT = {
  brain:     { pos: [0, 0],     w: 16, d: 16 },
  emails:    { pos: [-30, -23], w: 20, d: 26 },
  delivery:  { pos: [0, -48],   w: 20, d: 30 },   // 6th pod mirrors ops on the top axis
  sales:     { pos: [30, -23],  w: 20, d: 30 },
  marketing: { pos: [-30, 23],  w: 20, d: 30 },
  fin:       { pos: [30, 23],   w: 20, d: 26 },
  ops:       { pos: [0, 48],    w: 20, d: 30 },   // the 5th pod fills the empty bottom-left gap
};

// Department billboard metrics (v1 rule #5: live metrics float above each dept,
// values tick green on change, "Waiting Approval" pulses amber when > 0).
export const BILLBOARDS = {
  emails:    [{ id: 'emails',    label: 'CORREOS ENVIADOS',   val: 128 }],
  delivery:  [{ id: 'reports',   label: 'INFORMES ENVIADOS',  val: 9 }],
  sales:     [{ id: 'leads',     label: 'PROSPECTOS ENRIQUECIDOS', val: 47 },
              { id: 'callhrs',   label: 'HORAS DE LLAMADA DERIVADAS', val: 9.5, fmt: v => v.toFixed(1) + 'h', step: 0.4 }],
  marketing: [{ id: 'adspend',   label: 'GASTO EN ANUNCIOS HOY', val: 684, fmt: v => '$' + Math.round(v).toLocaleString('en-NZ'), step: 12 }],
  ops:       [{ id: 'proposals', label: 'PROPUESTAS ENVIADAS', val: 6 }],
  fin:       [{ id: 'invoices',  label: 'FACTURAS EMITIDAS', val: 23 }],
  brain:     [{ id: 'notes',     label: 'NOTAS INDEXADAS',    val: 1204, fmt: v => Math.round(v).toLocaleString('en-NZ') }],
};

// Approval asks (agent requests → AJ decides; v1 flavour).
// Per-agent first so the ask matches who's asking; dept pool is the fallback.
export const APPROVAL_ASKS = {
  emails:    ['Enviar el aviso de aumento de precios a 120 clientes — borrador adjunto', 'Responder al hilo de la disputa con el contratista — borrador adjunto'],
  delivery:  ['Enviar el paquete de informes de septiembre a 14 clientes', 'Publicar los recursos de marca en el portal del cliente'],
  sales:     ['Enviar SMS de reactivación a 214 prospectos fríos', 'Mover 8 prospectos empresariales a la cola de SPENCER'],
  marketing: ['Lanzar 4 variantes de anuncios de Meta — presupuesto de $120/día', 'Publicar el reel “cold call maths” en Instagram'],
  ops:       ['Enviar la propuesta en PDF a Ridgeline Property Group', 'Aprobar el MSA modificado de Kea Logistics — 2 cláusulas marcadas'],
  fin:       ['La factura #218 no coincide con el contrato — ¿retener para revisión?', 'Cancelar $180 en cargos de tarjeta sin conciliar'],
};
export const APPROVAL_BY_AGENT = {
  cmail: 'Enviar el aviso de aumento de precios a 120 clientes — borrador adjunto',
  vmail: 'Aceptar el SLA revisado del proveedor — 2 cambios marcados',
  crep:  'Enviar el paquete de informes de septiembre a 14 clientes — 2 marcados para una llamada',
  qa:    'Aprobar la entrega del sitio web — 2 detalles menores detectados',
  dlead: 'Extender el proyecto de Ridgeline una semana — lo pidió el cliente',
  apay:  'La factura #218 del contratista supera la tarifa del contrato por $350 — ¿retener el pago y consultar?',
  piper: 'Enviar la propuesta a Ridgeline Property Group — 12 asientos, plan Growth',
  iggy:  'Publicar el reel “the 10am rule” en Instagram — guion adjunto',
  vid:   'Enviar el corte demo de 45 seg — subtítulos incrustados, v2 adjunta',
  ada:   'Escalar la pieza “cold call anxiety” a $180/día — CPA $29',
  mlead: 'Aprobar el plan de contenido de octubre — 12 reels, 2 boletines, 1 renovación de anuncios',
  olead: 'Aprobar la lista de operaciones del Q4 — incluye 3 renovaciones de proveedores',
  newt:  'Enviar el boletín de agosto a 3,400 suscriptores — borrador v3 adjunto',
  scout: 'Dar luz verde a la jugada comparativa de CallForge — memo adjunto',
  enzo:  'Comprar 500 créditos de FullEnrich — el lote actual se agota mañana',
};

// Fake terminal lines for the desk screens (per-dept flavour), matching v1's chat voice.
export const WORKLINES = {
  emails: [
    '▸ redactando respuesta — pregunta de alcance del cliente',
    '▸ hilo de proveedor: revisión del SLA resumida',
    '▸ 14 correos internos clasificados · 3 para AJ',
    '▸ consulta de factura del contratista respondida',
  ],
  delivery: [
    '▸ informe de cliente: paquete de septiembre 9/14',
    '▸ revisión de calidad: entrega del sitio web · 2 notas',
    '▸ librería de recursos sincronizada → portal del cliente',
    '▸ plan de proyecto: 3 hitos movidos',
  ],
  sales: [
    '▸ enriqueciendo prospecto — Summit HVAC',
    '▸ 6 prospectos derivados → ARWIN (4.2h en cola)',
    '▸ 32 prospectos verificados · 91% válidos',
    '▸ mensaje de incorporación enviado — Bay Plumbing',
  ],
  marketing: [
    '▸ redactando gancho del reel v3 — "cold call maths"',
    '▸ anuncios de Meta: 4 variantes → revisión',
    '▸ bloque 2/5 del boletín escrito',
    '▸ exportación del kit de marca: historia + cuadrado',
    '▸ renderizando reel v2 — subtítulos + b-roll',
  ],
  ops: [
    '▸ propuesta en PDF lista — Ridgeline Group',
    '▸ escaneo de competencia: página de precios de DialAxis',
    '▸ cláusula 7.2 del MSA marcada — tope de responsabilidad',
    '▸ página de WorkSafe AU cambió · comparando',
    '▸ paquete semanal para la junta: 4/6 secciones listas',
  ],
  fin: [
    '▸ conciliando 14 pagos · 2 marcados',
    '▸ factura #218 vs contrato — diferencia de tarifa marcada',
    '▸ factura emitida — Summit HVAC $840',
    '▸ recordatorio 2/3 enviado — Alpine Freight',
  ],
  brain: [
    '▸ indexando bóveda — 1,204 notas',
    '▸ respondiendo consulta de inteligencia — cohorte de abandono',
    '▸ reunión agendada: enzo × tess',
  ],
};

// INDUSTRY PROFILE (12 Sep 2026): a per-industry demo file rewrites pods, seats, rows, asks and screen lines in place. No-op without window.PROFILE.
applyData({ DEPTS, AGENTS, BILLBOARDS, APPROVAL_ASKS, APPROVAL_BY_AGENT, WORKLINES });
