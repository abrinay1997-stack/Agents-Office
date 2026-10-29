// «Publicar ahora» (CON-04): los textos y la regla de cuándo no hay ningún «ahora» posible. Puro. Lo usan el servidor (contenido/rutas-nucleo.mjs), el editor (dist/pieza-editor.js)
// y el móvil (dist/movil-d.js); NO va en la página principal.
/** CON-04/B03: lo único que se promete con «Publicar ahora» y cuándo no hay ningún «ahora» posible. */
export const AVISO_YA = 'Sale ahora en Instagram y Facebook. No se puede deshacer: después solo se puede borrar o archivar (en Instagram no se puede borrar desde aquí). Lo programado sí se puede deshacer.';
export function motivoNoYa(aj = {}) {
  if (aj.modo === 'apagado') return 'Contenido está apagado: no sale nada. Enciéndelo en Ajustes → Contenido.';
  if (aj.modo !== 'real') return 'Estás en simulacro: nada sale de verdad. Pasa a «Real» en Ajustes → Contenido para publicar ahora.';
  if (aj.conductor !== 'meta') return '«Publicar ahora» solo existe con «Meta directo»: con Metricool la publicación se programa con su mínimo de espera. Usa «Aprobar».';
  return '';
}
