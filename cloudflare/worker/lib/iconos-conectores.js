// Iconos de conectores. DECISIÓN: no se copia ningún logotipo de nadie. Cada plantilla lleva un PICTOGRAMA simple y propio (un trazo de 24×24 que sugiere lo que hace el servicio:
// un sobre para el correo, una cuadrícula para el calendario, tres nodos unidos para n8n…) en una placa de color. Si el conector no tiene plantilla, su ICONO es el MONOGRAMA
// (las iniciales) sobre un color que sale del nombre (siempre el mismo para el mismo nombre). Todo es un SVG en línea que viaja como data: URI: nada se descarga de un host
// externo (la CSP de la oficina no lo permitiría ni debe) y funciona igual en el teléfono.
// El color de la placa lleva texto/trazo blanco: todos pasan 4,5:1 contra blanco.

/** Trazos de 24×24 (fill none, stroke blanco). */
const GLIFOS = {
  rayo: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',                               // Zapier: acción automática
  nodos: '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 11l3-3M14 8l3 3M17 13l-3 3M10 16l-3-3"/>', // n8n: flujo de nodos
  circulos: '<circle cx="7" cy="12" r="3.5"/><circle cx="17" cy="7" r="3"/><circle cx="17" cy="17" r="3"/>', // Make
  sobre: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="m4 8 8 6 8-6"/>',
  calendario: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="M8 14h2M12 14h2M8 17h2"/>',
  triangulo: '<path d="m12 4 8 14H4z"/><path d="M8 18l4-7 4 7"/>',                 // Drive
  almohadilla: '<path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16"/>',                 // Slack: #
  pagina: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/>',     // Notion
  rama: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 8v8M18 11c0 4-6 3-12 5"/>', // GitHub
  tarjeta: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>', // Stripe
  anillo: '<circle cx="12" cy="13" r="4"/><path d="M12 9V4M16 11l4-3M9 16l-4 3"/>',  // HubSpot
  bloques: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="16" height="7" rx="1"/>', // Airtable
  lapiz: '<path d="M5 19l1-4L17 4l3 3L9 18z"/><path d="M15 6l3 3"/>',               // Canva: crear
  nube: '<path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 9.5a4 4 0 0 1 .5 8.5z"/>', // Cloudflare
  circulo: '<circle cx="12" cy="12" r="8"/><path d="M8 13l3 3 5-7"/>',              // Linear: tarea hecha
  puntos: '<circle cx="12" cy="7" r="2.2"/><circle cx="6.5" cy="16" r="2.2"/><circle cx="17.5" cy="16" r="2.2"/>', // Asana
  megafono: '<path d="M4 10v4l10 4V6z"/><path d="M14 9h3a2 2 0 0 1 0 6h-3M6 15l1 5h3l-1-4"/>', // Meta Ads
  enchufe: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"/>',            // «Otro»: un servidor MCP cualquiera
};

/** Plantillas de los conectores más comunes. `glifo` y `color` dan el icono; `auth` la autenticación que suele pedir; `pista` lo que hay que pegar.
 *  NOTA: una URL fija solo se escribe donde el servicio la tiene igual para todos; el resto la da tu cuenta (Zapier, n8n, Make). Muchos servicios grandes piden iniciar sesión
 *  con OAuth y la oficina todavía no sabe hacerlo: con ellos hace falta un token de acceso, o una puerta intermedia (Zapier, n8n, Make). */
export const PLANTILLAS = [
  { id: 'zapier', nombre: 'Zapier MCP', glifo: 'rayo', color: '#C2410C', auth: 'bearer', pista: 'La dirección de tu servidor MCP de Zapier, tal como te la da Zapier.', oauth: false, destacada: true,
    pasos: ['En Zapier abre «MCP» (zapier.com/mcp), crea un servidor y añade las acciones que quieres (por ejemplo «Gmail: crear borrador» o «Sheets: leer filas»).', 'Copia la dirección (URL) de tu servidor y, si Zapier te da un token o clave, cópiala también. Si el token ya va dentro de la dirección, déjalo en «Sin autenticación» y trata esa dirección como un secreto.', 'Aquí: «+ Añadir conector» → Zapier → pega la dirección y el token → «Probar conexión» → marca qué herramientas se permiten.'] },
  { id: 'n8n', nombre: 'n8n (MCP Server Trigger)', glifo: 'nodos', color: '#BE185D', auth: 'bearer', pista: 'La «Production URL» del nodo MCP Server Trigger de tu workflow.', oauth: false, destacada: true,
    pasos: ['En n8n crea un workflow que empiece con el nodo «MCP Server Trigger», conéctale las herramientas que quieres ofrecer y publica (activa) el workflow.', 'En el nodo copia la «Production URL». Si pusiste autenticación (Bearer o Header), apunta el token.', 'Aquí: «+ Añadir conector» → n8n → pega la dirección y el token (elige «Bearer» o «Cabecera» como en n8n) → «Probar conexión».'] },
  { id: 'make', nombre: 'Make', glifo: 'circulos', color: '#6D28D9', auth: 'bearer', pista: 'La dirección de tu servidor MCP de Make.', oauth: false,
    pasos: ['En Make crea un escenario o activa su servidor MCP y elige qué acciones quieres ofrecer.', 'Copia su dirección y el token que te da.', 'Aquí: «+ Añadir conector» → Make → pega los dos → «Probar conexión».'] },
  { id: 'gmail', nombre: 'Gmail', glifo: 'sobre', color: '#B91C1C', auth: 'bearer', pista: 'La dirección de un servidor MCP de Gmail y su token de acceso.', oauth: true, pasos: null },
  { id: 'google-calendar', nombre: 'Google Calendar', glifo: 'calendario', color: '#1D4ED8', auth: 'bearer', pista: 'La dirección de un servidor MCP de Calendar y su token de acceso.', oauth: true, pasos: null },
  { id: 'google-drive', nombre: 'Google Drive', glifo: 'triangulo', color: '#15803D', auth: 'bearer', pista: 'La dirección de un servidor MCP de Drive y su token de acceso.', oauth: true, pasos: null },
  { id: 'slack', nombre: 'Slack', glifo: 'almohadilla', color: '#6B21A8', auth: 'bearer', pista: 'La dirección del servidor MCP de Slack y su token.', oauth: true, pasos: null },
  { id: 'notion', nombre: 'Notion', glifo: 'pagina', color: '#27272A', auth: 'bearer', pista: 'La dirección del servidor MCP de Notion y su token de integración.', oauth: true, pasos: null },
  { id: 'github', nombre: 'GitHub', glifo: 'rama', color: '#3F3F46', auth: 'bearer', pista: 'La dirección del servidor MCP de GitHub y un token de acceso personal.', oauth: false, pasos: null },
  { id: 'stripe', nombre: 'Stripe', glifo: 'tarjeta', color: '#4338CA', auth: 'bearer', pista: 'La dirección del servidor MCP de Stripe y una clave restringida de SOLO LECTURA.', oauth: false, pasos: null },
  { id: 'hubspot', nombre: 'HubSpot', glifo: 'anillo', color: '#C2410C', auth: 'bearer', pista: 'La dirección del servidor MCP de HubSpot y su token.', oauth: true, pasos: null },
  { id: 'airtable', nombre: 'Airtable', glifo: 'bloques', color: '#0F766E', auth: 'bearer', pista: 'La dirección del servidor MCP de Airtable y su token.', oauth: false, pasos: null },
  { id: 'canva', nombre: 'Canva', glifo: 'lapiz', color: '#0E7490', auth: 'bearer', pista: 'La dirección del servidor MCP de Canva y su token.', oauth: true, pasos: null },
  { id: 'cloudflare', nombre: 'Cloudflare', glifo: 'nube', color: '#B45309', auth: 'bearer', pista: 'La dirección del servidor MCP de Cloudflare y un token de API con permisos mínimos.', oauth: false, pasos: null },
  { id: 'linear', nombre: 'Linear', glifo: 'circulo', color: '#4F46E5', auth: 'bearer', pista: 'La dirección del servidor MCP de Linear y su token.', oauth: true, pasos: null },
  { id: 'asana', nombre: 'Asana', glifo: 'puntos', color: '#BE123C', auth: 'bearer', pista: 'La dirección del servidor MCP de Asana y su token.', oauth: true, pasos: null },
  { id: 'meta-ads', nombre: 'Meta Ads', glifo: 'megafono', color: '#1E40AF', auth: 'bearer', pista: 'La dirección de un servidor MCP de Meta Ads y su token. Ojo: Anuncios ya tiene su panel propio; esto es para herramientas extra.', oauth: false, pasos: null },
  { id: 'otro', nombre: 'Otro (dirección propia)', glifo: 'enchufe', color: '#475569', auth: 'bearer', pista: 'La dirección https de cualquier servidor MCP remoto.', oauth: false, pasos: null },
];
export const plantillaPorId = (id) => PLANTILLAS.find((p) => p.id === id) || null;

const hue = (n) => { let h = 0; for (const c of String(n)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };
/** Color estable del nombre; saturación y luminosidad fijas para que el blanco encima siempre lea bien (≥ 4,5:1). */
export const colorDeNombre = (nombre) => `hsl(${hue(nombre)} 55% 32%)`;
const iniciales = (nombre) => { const p = String(nombre).replace(/[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ ]/g, ' ').trim().split(/\s+/).filter(Boolean); return ((p.length > 1 ? p[0][0] + p[1][0] : String(nombre).replace(/[^A-Za-z0-9]/g, '').slice(0, 2)) || '?').toUpperCase(); };
const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

/** El SVG (texto) de un conector: su pictograma si viene de una plantilla; si no, el monograma. */
export function svgDe({ plantilla = null, nombre = '' } = {}) {
  const p = plantillaPorId(plantilla);
  if (p && p.id !== 'otro') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" role="img"><rect width="40" height="40" rx="9" fill="${p.color}"/><g transform="translate(8 8)" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${GLIFOS[p.glifo]}</g></svg>`;
  const ini = iniciales(nombre || p?.nombre || '?');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" role="img"><rect width="40" height="40" rx="9" fill="${colorDeNombre(nombre || p?.nombre || '?')}"/><text x="20" y="26.5" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="${ini.length > 1 ? 16 : 19}" font-weight="700" fill="#fff">${xml(ini)}</text></svg>`;
}
/** Como data: URI (para <img src> y para la barra de conectores). */
export const iconoUri = (o) => { let t = ''; for (const x of new TextEncoder().encode(svgDe(o))) t += String.fromCharCode(x); return 'data:image/svg+xml;base64,' + btoa(t); };
