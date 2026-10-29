// Iconos de conectores. 29 oct 2026 (Fase 5 / ICO-01, ICO-02): ya NO se usan pictogramas propios por plantilla; la decisión de «no se copia ningún
// logotipo de nadie» se REVOCÓ a pedido del dueño («íconos originales en todo»). Cada plantilla apunta a una entrada del REGISTRO ÚNICO de íconos
// (src/iconos-registro.mjs, la misma que usa la oficina de escritorio y el móvil): logo real de Simple Icons o, si la marca no lo tiene, un
// pictograma propio con placa. Si el conector no tiene plantilla (o es «Otro»), su ícono es el MONOGRAMA (iniciales sobre un color estable que sale
// del nombre). Todo es un SVG en línea que viaja como data: URI: nada se descarga de un host externo (la CSP de la oficina no lo permitiría ni debe).
import { iconoTesela, monograma, uriDeSvg, colorDeNombre as colorNombre } from '../../../src/iconos-registro.mjs';

/** Plantillas de los conectores más comunes. `icono` es la entrada del registro de íconos; `auth` la autenticación que suele pedir; `pista` lo que hay que pegar.
 *  NOTA: una URL fija solo se escribe donde el servicio la tiene igual para todos; el resto la da tu cuenta (Zapier, n8n, Make). Muchos servicios grandes piden iniciar sesión
 *  con OAuth y la oficina todavía no sabe hacerlo: con ellos hace falta un token de acceso, o una puerta intermedia (Zapier, n8n, Make). */
export const PLANTILLAS = [
  { id: 'zapier', nombre: 'Zapier MCP', icono: 'zapier', auth: 'bearer', pista: 'La dirección de tu servidor MCP de Zapier, tal como te la da Zapier.', oauth: false, destacada: true,
    pasos: ['En Zapier abre «MCP» (zapier.com/mcp), crea un servidor y añade las acciones que quieres (por ejemplo «Gmail: crear borrador» o «Sheets: leer filas»).', 'Copia la dirección (URL) de tu servidor y, si Zapier te da un token o clave, cópiala también. Si el token ya va dentro de la dirección, déjalo en «Sin autenticación» y trata esa dirección como un secreto.', 'Aquí: «+ Añadir conector» → Zapier → pega la dirección y el token → «Probar conexión» → marca qué herramientas se permiten.'] },
  { id: 'n8n', nombre: 'n8n (MCP Server Trigger)', icono: 'n8n', auth: 'bearer', pista: 'La «Production URL» del nodo MCP Server Trigger de tu workflow.', oauth: false, destacada: true,
    pasos: ['En n8n crea un workflow que empiece con el nodo «MCP Server Trigger», conéctale las herramientas que quieres ofrecer y publica (activa) el workflow.', 'En el nodo copia la «Production URL». Si pusiste autenticación (Bearer o Header), apunta el token.', 'Aquí: «+ Añadir conector» → n8n → pega la dirección y el token (elige «Bearer» o «Cabecera» como en n8n) → «Probar conexión».'] },
  { id: 'make', nombre: 'Make', icono: 'make', auth: 'bearer', pista: 'La dirección de tu servidor MCP de Make.', oauth: false,
    pasos: ['En Make crea un escenario o activa su servidor MCP y elige qué acciones quieres ofrecer.', 'Copia su dirección y el token que te da.', 'Aquí: «+ Añadir conector» → Make → pega los dos → «Probar conexión».'] },
  { id: 'gmail', nombre: 'Gmail', icono: 'gmail', auth: 'bearer', pista: 'La dirección de un servidor MCP de Gmail y su token de acceso.', oauth: true, pasos: null },
  { id: 'google-calendar', nombre: 'Google Calendar', icono: 'googlecalendar', auth: 'bearer', pista: 'La dirección de un servidor MCP de Calendar y su token de acceso.', oauth: true, pasos: null },
  { id: 'google-drive', nombre: 'Google Drive', icono: 'googledrive', auth: 'bearer', pista: 'La dirección de un servidor MCP de Drive y su token de acceso.', oauth: true, pasos: null },
  { id: 'slack', nombre: 'Slack', icono: 'slack', auth: 'bearer', pista: 'La dirección del servidor MCP de Slack y su token.', oauth: true, pasos: null },
  { id: 'notion', nombre: 'Notion', icono: 'notion', auth: 'bearer', pista: 'La dirección del servidor MCP de Notion y su token de integración.', oauth: true, pasos: null },
  { id: 'github', nombre: 'GitHub', icono: 'github', auth: 'bearer', pista: 'La dirección del servidor MCP de GitHub y un token de acceso personal.', oauth: false, pasos: null },
  { id: 'stripe', nombre: 'Stripe', icono: 'stripe', auth: 'bearer', pista: 'La dirección del servidor MCP de Stripe y una clave restringida de SOLO LECTURA.', oauth: false, pasos: null },
  { id: 'hubspot', nombre: 'HubSpot', icono: 'hubspot', auth: 'bearer', pista: 'La dirección del servidor MCP de HubSpot y su token.', oauth: true, pasos: null },
  { id: 'airtable', nombre: 'Airtable', icono: 'airtable', auth: 'bearer', pista: 'La dirección del servidor MCP de Airtable y su token.', oauth: false, pasos: null },
  { id: 'canva', nombre: 'Canva', icono: 'canva', auth: 'bearer', pista: 'La dirección del servidor MCP de Canva y su token.', oauth: true, pasos: null },
  { id: 'cloudflare', nombre: 'Cloudflare', icono: 'cloudflare', auth: 'bearer', pista: 'La dirección del servidor MCP de Cloudflare y un token de API con permisos mínimos.', oauth: false, pasos: null },
  { id: 'linear', nombre: 'Linear', icono: 'linear', auth: 'bearer', pista: 'La dirección del servidor MCP de Linear y su token.', oauth: true, pasos: null },
  { id: 'asana', nombre: 'Asana', icono: 'asana', auth: 'bearer', pista: 'La dirección del servidor MCP de Asana y su token.', oauth: true, pasos: null },
  { id: 'meta-ads', nombre: 'Meta Ads', icono: 'meta', auth: 'bearer', pista: 'La dirección de un servidor MCP de Meta Ads y su token. Ojo: Anuncios ya tiene su panel propio; esto es para herramientas extra.', oauth: false, pasos: null },
  { id: 'otro', nombre: 'Otro (dirección propia)', icono: 'enchufe', auth: 'bearer', pista: 'La dirección https de cualquier servidor MCP remoto.', oauth: false, pasos: null },
];
export const plantillaPorId = (id) => PLANTILLAS.find((p) => p.id === id) || null;

export const colorDeNombre = colorNombre;

/** El SVG (texto) de un conector: el de su plantilla si la tiene (el MISMO que dibuja el escritorio); si no, el monograma. */
export function svgDe({ plantilla = null, nombre = '' } = {}) {
  const p = plantillaPorId(plantilla);
  const svg = p && p.id !== 'otro' ? iconoTesela(p.icono) : null;
  return svg || monograma(nombre || p?.nombre || '?');
}
/** Como data: URI (para <img src> y para la barra de conectores). */
export const iconoUri = (o) => uriDeSvg(svgDe(o));
