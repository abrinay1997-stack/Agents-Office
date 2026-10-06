// LO QUE SE PUEDE HACER CON UN ARCHIVO DEL ESTUDIO, una sola lista (auditoría del Estudio de imagen, IMG-09 e IMG-48, 6 oct 2026).
// Antes había cuatro juegos distintos para la misma imagen: la fila de 6 iconos de la tarjeta, su menú «⋯», los 20 controles del
// visor y las 2 acciones de la ficha de un pedido; «Repetir» estaba en unos y no en otros, «Favorita» se llamaba de dos maneras y
// las integraciones de la oficina (calendario, Dimitri, departamento) iban al mismo nivel que editar la imagen. Ahora la página
// pinta esta lista en tres densidades:
//   tarjeta  → las primarias en la fila; el resto en «⋯», por grupos
//   visor    → las primarias como botones; los grupos como filas con su nombre
// acciones(it, cap) → { primarias, grupos: [{ id, titulo, items }], borrar }   cada acción: { id, label, corto, icon, title }
//   cap: { calendario, dimitri, tarea, preset, voz, precioVariar }  (lo que esta oficina y este archivo permiten)
// Puro, con test (tests/studio-acciones.test.mjs). Los `id` son los data-a / data-l que ya entiende src/studio.js.

const A = (id, label, icon, title, corto) => ({ id, label, icon, title: title || label, corto: corto || label });

export function tipoDe(it) {
  if (!it) return 'img';
  if (it.kind === 'audio' || /\.(mp3|wav|m4a|ogg|flac)$/i.test(String(it.file || ''))) return 'aud';
  if (it.kind === 'video' || /\.(mp4|webm)$/i.test(String(it.file || ''))) return 'vid';
  return 'img';
}

export function acciones(it, cap = {}) {
  const t = tipoDe(it), subida = !!it?.upload;
  const variar = A('vary', 'Variar', 'spark', `Otra parecida: su prompt, su modelo y esta imagen como referencia${cap.precioVariar ? ` (${cap.precioVariar})` : ''}. Tu compositor no cambia`);
  const repetir = A('again', 'Repetir', 'again', 'Al compositor con el mismo prompt, modelo y ajustes (lo que tenías se guarda)');
  const descargar = A('dl', 'Descargar', 'down', 'Descargar el archivo');
  const primarias = t === 'img' ? [A('edit', 'Editar', 'pen', 'Pide un cambio: sale una versión nueva y la original no se toca'), variar, descargar]
    : t === 'vid' ? [...(subida ? [] : [repetir]), descargar]
    : [...(cap.voz ? [A('othervoice', 'Repetir con otra voz', 'mic', 'El mismo texto con otra voz', 'Otra voz')] : subida ? [] : [repetir]), descargar];
  const crear = t === 'img' ? [A('ref', 'Usar de referencia', 'ref', 'Tu producto, logo, personaje o estilo en lo próximo que crees'), A('anim', 'Animar', 'vid', 'Convertirla en video: será su primer fotograma'), ...(subida ? [] : [repetir])]
    : t === 'aud' && cap.voz && !subida ? [repetir] : [];
  const organizar = [
    A('fav', it?.fav ? 'Quitar de favoritas' : 'Marcar favorita', 'star'),
    A('move', 'Mover a una carpeta…', 'folder'),
    ...(cap.preset ? [A('preset', 'Guardar como preset…', 'star', 'La receta de este resultado, como un preset tuyo')] : []),
    ...(cap.tarea ? [A('task', 'Abrir su tarea', 'send', 'La tarea del agente que la pidió')] : []),
  ];
  const enviar = [
    ...(cap.calendario && t !== 'aud' ? [A('cal', 'Al calendario de contenido', 'cal', 'Crea una idea en Contenido con este archivo', 'Calendario')] : []),
    ...(cap.dimitri ? [A('dimitri', 'A Dimitri', 'chat', 'Abre el chat de Dimitri con este archivo adjunto', 'Dimitri')] : []),
    A('dept', 'A un departamento…', 'send', 'Crea una tarea para un departamento con este archivo de referencia', 'Departamento…'),
  ];
  const grupos = [
    { id: 'crear', titulo: 'Crear a partir de esta', items: crear },
    { id: 'organizar', titulo: 'Organizar', items: organizar },
    { id: 'enviar', titulo: 'Enviar a…', items: enviar },
  ].filter(g => g.items.length);
  return { tipo: t, primarias, grupos, borrar: A('del', 'Mover a la papelera', 'trash', 'Mover a la papelera (30 días para recuperarla)') };
}
