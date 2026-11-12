// ¿Este Origin puede llamar a /mcp desde un navegador? Solo los clientes de MCP conocidos: claude.ai, claude.com y localhost/127.0.0.1 (cualquier puerto, http).
// Sin cabecera Origin (un programa, no un navegador) se acepta: lo protege su Bearer. Un Origin raro («null», otro sitio) se rechaza.
const PERMITIDOS = new Set(['https://claude.ai', 'https://claude.com']);
const LOOPBACK = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;
export function origenPermitido(origen) {
  if (origen === null || origen === undefined || origen === '') return true;
  return PERMITIDOS.has(origen) || LOOPBACK.test(origen);
}
