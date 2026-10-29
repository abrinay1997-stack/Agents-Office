// EST-08 (Fase 0b): lo que el dueño lee cuando la papelera dice que no. El servidor contesta 409 con el motivo y las piezas de Contenido que usan el archivo.
/** fallos: [{ message, piezas? }] (uno por archivo que no se pudo mover). Devuelve la frase para el aviso. */
export function textoFalloPapelera(fallos, total = fallos.length) {
  if (!fallos.length) return '';
  const usan = new Map(); for (const f of fallos) for (const p of f.piezas || []) usan.set(p.id, p);
  const motivos = [...new Set(fallos.map(f => String(f.message || '').trim()).filter(Boolean))];
  const que = total === 1 ? 'el archivo' : fallos.length === total ? `ninguno de los ${total}` : `${fallos.length} de ${total}`;
  let t = `No se pudo mover ${que} a la papelera.`;
  if (motivos.length === 1) t += ' ' + motivos[0] + (/[.!?]$/.test(motivos[0]) ? '' : '.');
  else if (motivos.length > 1) t += ` ${motivos.length} motivos distintos; el primero: ${motivos[0]}`;
  if (usan.size && !motivos.length) t += ` Lo usan ${usan.size} ${usan.size === 1 ? 'pieza' : 'piezas'} de Contenido: ${[...usan.values()].slice(0, 3).map(p => '«' + (p.titulo || p.id) + '»').join(', ')}.`;
  if (usan.size) t += ' Quítalo de esas piezas en Contenido (tecla K) y vuelve a intentarlo.';
  return t;
}
