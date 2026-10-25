// Las herramientas de la BIBLIOTECA de habilidades (ver_habilidades, leer_habilidad): las definiciones y lo que hacen, sin transporte.
// Las usan habilidades-mcp.mjs (el servidor MCP de la oficina local) y la nube (cloudflare/worker/lib/agentes/herramientas.js). Solo LEEN.
export const TOOLS = [
  { name: 'ver_habilidades', description: 'La biblioteca de habilidades: métodos probados (plan de marketing, textos que venden, anuncios, SEO, correos, precios, lanzamientos…). Devuelve id, título y cuándo usar cada una. Sin filtros, las de tu puesto y tu departamento; con `buscar`, las que tratan de eso; con `todas`, las de toda la oficina.',
    inputSchema: { type: 'object', properties: { buscar: { type: 'string', description: 'Palabras del tema (p. ej. «anuncios de Meta», «precio», «correo de bienvenida»).' }, todas: { type: 'boolean', description: 'Toda la biblioteca, no solo la tuya.' } } } },
  { name: 'leer_habilidad', description: 'Lee una habilidad entera (sus pasos, su forma de entrega, sus reglas y la lista de sus referencias) o, con `referencia`, una de sus referencias (una plantilla, una lista de revisión, ejemplos). Léela ANTES de empezar el trabajo que cubre y síguela.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'El id de la habilidad (como redaccion-publicitaria).' }, referencia: { type: 'string', description: 'Opcional: el nombre de una de sus referencias.' } }, required: ['id'] } },
];

/** `office(ruta)` → el JSON de GET /api/biblioteca…; `agente`: el id del puesto que llama (vacío en una charla sin puesto). */
export function crearLlamador({ office, agente: AGENTE = '' }) {
  return async function call(name, a = {}) {
    if (name === 'ver_habilidades') {
      const q = new URLSearchParams(); if (AGENTE && !a.todas) q.set('agente', AGENTE); if (a.buscar) q.set('buscar', String(a.buscar));
      const r = await office('/api/biblioteca?' + q);
      if (!r.habilidades.length) return a.buscar ? `No hay habilidades sobre «${a.buscar}»${AGENTE && !a.todas ? ' en tu puesto o departamento (prueba con todas: true)' : ''}.` : 'No hay habilidades para ti.';
      return `${r.habilidades.length} habilidad(es):\n${r.habilidades.map(h => `- ${h.id} — ${h.titulo} (${h.areaNombre}): ${h.description}`).join('\n')}`;
    }
    if (name === 'leer_habilidad') {
      const id = String(a.id || '').trim(); if (!/^[a-z0-9-]+$/.test(id)) throw new Error('el id es como redaccion-publicitaria (lo da ver_habilidades)');
      const r = await office(`/api/biblioteca/${id}${a.referencia ? '?referencia=' + encodeURIComponent(String(a.referencia)) : ''}`);
      return `<habilidad>\n${r.texto}\n</habilidad>`;
    }
    throw new Error('herramienta desconocida: ' + name);
  };
}
