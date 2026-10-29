// MCP logo tiles (160px). 29 oct 2026 (Fase 5 / ICO-04): ya NO son 24 teselas WebP de 154 KB cocidas a mano; salen del registro único de íconos
// (src/iconos-registro.mjs): vectores, con el logo real de Simple Icons o un pictograma propio, el mismo SVG que usa la nube. Misma forma que antes
// ({ name, img }) para que mcp.js, connectors.js y hero.js no cambien: `img` es un data: URI de SVG con tamaño propio (sirve de <img src> y de textura).
import { applyLogos } from './profile.js';
import { ICONOS, iconoTesela, uriDeSvg } from './iconos-registro.mjs';

const CLAVES = ['meta', 'canva', 'loops', 'beehiiv', 'gmail', 'fullenrich', 'imessage', 'apollo', 'xero', 'pandadoc', 'stripe', 'hyperframes', 'notion', 'clarity', 'claude', 'chatgpt',
  'slack', 'googlecalendar', 'googledrive', 'webflow', 'playwright', 'higgsfield', 'territool', 'chrome'];
export const MCP_LOGOS = Object.fromEntries(CLAVES.map(k => [k, { name: ICONOS[k].nombre, img: uriDeSvg(iconoTesela(k)) }]));

// dept -> connected MCPs (AJ's spec, 2 Aug 2026; rev 17 Aug for the ops/finance split;
// rev 5 Sep 2026 V3.1: ZoomInfo/PostHog/Jira/RevenueCat/Perplexity retired, Notion connects to
// EVERY dept (own loom like gmail), Microsoft Clarity joins marketing, EMAILS replaces support,
// DELIVERY is new). claude + chatgpt are the model layer — wired to the Brain, not a dept dock.
export const MCP_BY_DEPT = {
  marketing: ['meta','canva','loops','beehiiv','hyperframes','clarity','notion'],
  emails:    ['gmail','notion'],
  sales:     ['fullenrich','imessage','apollo','gmail','notion'],
  ops:       ['pandadoc','gmail','notion'],
  fin:       ['xero','gmail','stripe','notion'],
  delivery:  ['canva','pandadoc','gmail','notion'],
};
applyLogos({ MCP_LOGOS, MCP_BY_DEPT }); // INDUSTRY PROFILE (12 Sep 2026): a per-industry demo file brings its own tiles and wiring; no-op otherwise
