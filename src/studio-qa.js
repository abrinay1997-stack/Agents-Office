// El resumen de la QA de un archivo que salió de un preset, para su tarjeta de la galería.
// Vive aparte (1 oct 2026, carga bajo demanda) porque la galería lo usa SIEMPRE, y el banco, que también lo usa, va en
// dist/estudio-extra.js y se carga la primera vez que hace falta. src/studio-banco-core.js lo vuelve a exportar con su nombre.
/** → { estado: 'ok'|'revisar', texto } o null. */
export function qaResumen(qa) {
  if (!qa || !Array.isArray(qa.checks)) return null;
  const mal = qa.checks.filter(c => c.ok === false), sin = qa.checks.filter(c => c.ok == null), bien = qa.checks.filter(c => c.ok === true);
  if (mal.length) return { estado: 'revisar', texto: `Revisar: ${mal[0].motivo}` };
  return { estado: 'ok', texto: `QA ✓ ${bien.length} de ${qa.checks.length}${sin.length ? ` · ${sin.length} sin medir` : ''}` };
}
