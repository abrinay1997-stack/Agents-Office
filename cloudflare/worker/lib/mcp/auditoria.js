// El rastro del conector MCP: una fila de `auditoria` (tipo «mcp») por cosa que pasa. Nunca lleva un testigo, una huella ni el contenido de lo que se pidió: solo qué herramienta,
// quién, por cuál conexión, con qué alcance y si se permitió (y, si no, en qué capa se frenó).
export async function auditar(db, ahoraMs, quien, detalle) {
  try { await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date(ahoraMs).toISOString(), 'mcp', String(quien || 'desconocido').slice(0, 120), JSON.stringify(detalle)).run(); }
  catch (e) { console.warn('[mcp] la auditoría no se pudo escribir:', e?.message ?? e); } // la auditoría no tumba una llamada
}
