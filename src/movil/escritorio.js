// Versión móvil (25 oct 2026) — LAS VISTAS DE ESCRITORIO que aún no tienen versión móvil propia. «Más» las abre dentro de un contenedor a
// pantalla completa con su botón «Volver», para que la navegación nunca se rompa mientras se portan (docs: CLAUDE.md → «La versión móvil»).
// Se abren como siempre: haciendo clic en el botón del dock de escritorio (que sigue en la página, escondido) o con su atajo. Cuando
// una vista móvil nueva se registra con el MISMO id (`registrarVista({ id: 'cerebro', … })`), esta entrada desaparece de «Más» sola.
const $ = s => document.querySelector(s);
const clic = id => () => $('#' + id)?.click();
const tecla = (key, extra = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extra }));
const esc = el => () => { const n = $(el); if (!n) return; const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); n.dispatchEvent(ev); };
const vistaCierra = () => $('#topbar .brand')?.click(); // el nombre de la empresa: cierra la vista abierta y vuelve a la oficina
const body = (...c) => () => c.some(x => document.body.classList.contains(x));

/** id, título, icono, grupo de «Más», cómo se abre, si está abierta, cómo se cierra */
export const ESCRITORIO = [
  { id: 'cerebro', titulo: 'Cerebro', texto: 'Tus notas y documentos', icono: 'cerebro', grupo: 'trabajo', abrir: clic('topBrain'), abierta: () => $('#brainOv')?.classList.contains('on'), cerrar: vistaCierra },
  { id: 'estudio', titulo: 'Estudio', texto: 'Imágenes, video y voz', icono: 'estudio', grupo: 'trabajo', abrir: clic('topStudio'), abierta: body('studioOpen'), cerrar: vistaCierra },
  { id: 'contenido', titulo: 'Contenido', texto: 'Lo que publicas en redes', icono: 'contenido', grupo: 'trabajo', abrir: clic('topContenido'), abierta: body('ctOpen'), cerrar: vistaCierra },
  { id: 'analiticas', titulo: 'Analíticas', texto: 'Cómo rinden tus redes', icono: 'analiticas', grupo: 'negocio', abrir: clic('topAnaliticas'), abierta: body('anOpen'), cerrar: vistaCierra },
  { id: 'anuncios', titulo: 'Anuncios', texto: 'Tus campañas de Meta', icono: 'anuncios', grupo: 'negocio', abrir: clic('topAnuncios'), abierta: body('anuOpen'), cerrar: vistaCierra },
  { id: 'negocio', titulo: 'Negocio', texto: 'Cómo va tu negocio', icono: 'negocio', grupo: 'negocio', ventana: true, abrir: clic('topBiz'), abierta: () => !!$('#bizOv') && !$('#bizOv').hidden, cerrar: esc('#bizOv') },
  { id: 'costos', titulo: 'Costos', texto: 'Gasto y retorno', icono: 'costos', grupo: 'negocio', ventana: true, abrir: () => tecla('u'), abierta: () => !!$('#costsOv') && !$('#costsOv').hidden, cerrar: esc('#costsOv') },
  { id: 'conectores', titulo: 'Conectores', texto: 'Las herramientas conectadas', icono: 'conectores', grupo: 'oficina', ventana: true, abrir: () => $('#topconn .tc-lab')?.click(), abierta: () => !!$('#connPanel'), cerrar: () => $('#connPanel .cp-x')?.click() },
  { id: 'estado', titulo: 'Estado', texto: 'Que todo funcione', icono: 'estado', grupo: 'oficina', ventana: true, abrir: () => { tecla('o'); if (!$('#setOv') || $('#setOv').hidden) $('#topSettings')?.click(); }, abierta: () => !!$('#setOv') && !$('#setOv').hidden, cerrar: esc('#setOv') },
  { id: 'ajustes', titulo: 'Ajustes', texto: 'Apariencia, equipo, cifras…', icono: 'ajustes', grupo: 'oficina', ventana: true, abrir: clic('topSettings'), abierta: () => !!$('#setOv') && !$('#setOv').hidden, cerrar: esc('#setOv') },
  { id: 'buscar', titulo: 'Buscar', texto: 'Tareas, notas, agentes…', icono: 'buscar', grupo: 'oficina', ventana: true, abrir: () => tecla('k', { ctrlKey: true }), abierta: () => !!$('#findOv') && !$('#findOv').hidden, cerrar: esc('#findOv') },
  // solo en la nube (cloudflare/public/nube.js pone window.AO_NUBE): las dos pestañas que añade a Ajustes
  { id: 'perfil', titulo: 'Mi perfil', texto: 'Tu nombre, foto y contraseña', icono: 'persona', grupo: 'cuenta', nube: true, ventana: true, abrir: () => { clic('topSettings')(); const ir = () => $('#setOv [data-tab="nube-perfil"]')?.click(); ir(); setTimeout(ir, 80); }, abierta: () => !!$('#setOv') && !$('#setOv').hidden, cerrar: esc('#setOv') },
  { id: 'equipo', titulo: 'Equipo', texto: 'Quién entra a la oficina', icono: 'persona', grupo: 'cuenta', nube: true, ventana: true, abrir: () => { clic('topSettings')(); const ir = () => $('#setOv [data-tab="nube-equipo"]')?.click(); ir(); setTimeout(ir, 80); }, abierta: () => !!$('#setOv') && !$('#setOv').hidden, cerrar: esc('#setOv') },
  { id: 'dimitri-completo', titulo: 'Dimitri (escritorio)', texto: 'Con GENERAR y los topes', icono: 'dimitri', grupo: 'oculta', abrir: clic('topDimitri'), abierta: body('subOpen'), cerrar: clic('topDimitri') },
];
export const GRUPOS = { trabajo: 'Trabajo', negocio: 'Negocio', oficina: 'La oficina', cuenta: 'Mi cuenta' };
