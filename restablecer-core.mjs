// Agents Office — «RESTABLECER OFICINA» (25 oct 2026), el núcleo que comparten la oficina local (restablecer-local.mjs, con archivos) y la nube (cloudflare/worker/lib/restablecer.js, con D1 y R2).
// Pedido del dueño: «una opción en Ajustes de restablecer oficina: a versión por defecto, vacía y por defecto: PanaClaw en versión vacía (cerebro totalmente vacío, para que el usuario la complete con la
// información de su empresa) y la de por defecto PanaClaw, con las 59 notas y todas las skills de marketing».
//
// DECISIONES (explicadas al dueño en la pantalla):
//  · Las habilidades de MARKETING de la Biblioteca (50) son del PRODUCTO, no de la empresa: viven en el despliegue, no en el Cerebro. Por eso «Vacía» NO las quita (los agentes siguen sabiendo hacer marketing;
//    lo que queda vacío es lo que sabe de TU empresa). Las que tú hayas añadido a tu Biblioteca sí son tuyas y entran en la casilla «Habilidades».
//  · «Vacía» marca TODO por defecto; «PanaClaw por defecto» marca solo «Cerebro» y «Habilidades» (el dueño decide si también el equipo y las rutinas de fábrica).
//  · NUNCA se toca: las personas del equipo y sus accesos, las sesiones, las llaves y secretos, los conectores, el registro de auditoría, los respaldos y lo que viene de Meta (Anuncios, Bandeja).
//  · Dos pasos: se pide (devuelve qué va a pasar y una clave de un solo uso de 2 minutos) y se confirma escribiendo RESTABLECER. Antes de tocar nada se guarda un RESPALDO que se puede restaurar 7 días.
export const PALABRA = 'RESTABLECER';
export const DIAS_RESPALDO = 7;
export const VIDA_PASO_MS = 2 * 60 * 1000;
export const TOPE_RESPALDOS = 10;

export const MODOS = [
  { id: 'vacia', nombre: 'Vacía', descripcion: 'El Cerebro, las tareas y lo demás quedan en blanco, para que lo llenes con la información de tu empresa (puedes empezar por «Preparar desde mi web»). Las 50 habilidades de marketing siguen disponibles: son del producto, no de tu empresa.' },
  { id: 'panaclaw', nombre: 'PanaClaw por defecto', descripcion: 'Carga el Cerebro de fábrica de PanaClaw (sus 59 notas) y las habilidades de fábrica. Si lo marcas, también el equipo, las rutinas y las skills de fábrica. Todas las habilidades de marketing están incluidas.' },
];

/** Qué se puede restablecer. `fabrica`: ¿«PanaClaw por defecto» trae algo para esto? (si no, queda en blanco en los dos modos) */
export const AMBITOS = [
  { id: 'cerebro', nombre: 'Cerebro', ayuda: 'Todas las notas de la empresa, su mapa y lo que los agentes aprendieron de ellas (las sinapsis).', ayudaFabrica: 'Reemplaza todas tus notas por las 59 de fábrica de PanaClaw y su mapa.', fabrica: true },
  { id: 'habilidades', nombre: 'Habilidades', ayuda: 'Tus skills (cómo se hace cada trabajo aquí) y las habilidades que hayas añadido a tu Biblioteca. Las 50 de marketing de fábrica se quedan.', ayudaFabrica: 'Reemplaza tus skills por las de fábrica (y quita las habilidades que hayas añadido). Las 50 de marketing de fábrica están siempre.', fabrica: true },
  { id: 'equipo', nombre: 'Equipo de agentes', ayuda: 'Los nombres, funciones e instrucciones que le pusiste a cada puesto. Vuelven a los de fábrica del producto.', ayudaFabrica: 'Vuelve a los puestos, nombres e instrucciones de fábrica de PanaClaw.', fabrica: true },
  { id: 'rutinas', nombre: 'Rutinas', ayuda: 'Las tareas programadas (cada lunes, cada mañana…) y su historial de ejecuciones.', ayudaFabrica: 'Reemplaza tus rutinas por las de fábrica de PanaClaw.', fabrica: true },
  { id: 'cifras', nombre: 'Cifras de la empresa', ayuda: 'Precios, comisiones y metas que los agentes usan tal cual, y las que esperan tu confirmación.', fabrica: false },
  { id: 'kpis', nombre: 'Cómo va el negocio', ayuda: 'Los indicadores que definiste y sus valores.', fabrica: false },
  { id: 'tareas', nombre: 'Tareas e historial', ayuda: 'Todas las tareas (las tuyas y las de los agentes), su bitácora, las corridas, y lo que los agentes aprendieron de tus correcciones.', fabrica: false },
  { id: 'dimitri', nombre: 'Conversaciones con Dimitri', ayuda: 'El chat actual, el historial de conversaciones y su resumen.', fabrica: false },
  { id: 'estudio', nombre: 'Galería del Estudio', ayuda: 'Las imágenes, videos y audios generados o subidos, sus carpetas y los trabajos en marcha.', fabrica: false },
  { id: 'contenido', nombre: 'Contenido', ayuda: 'Las piezas del calendario de redes, su cola de publicación y la papelera.', fabrica: false },
];
export const IDS_AMBITOS = AMBITOS.map((a) => a.id);
export const POR_DEFECTO = { vacia: [...IDS_AMBITOS], panaclaw: ['cerebro', 'habilidades'] };
export const CONSERVA = ['las personas del equipo y sus accesos', 'las sesiones abiertas', 'las llaves y secretos', 'los conectores', 'el registro de auditoría', 'los respaldos', 'lo que viene de Meta (Anuncios y Bandeja)', 'tus ajustes (topes, zona horaria, Telegram)'];

/** Valida el pedido de la página. → { ok, modo, ambitos } o { ok:false, error } */
export function validarPedido(p) {
  const modo = String(p?.modo ?? '');
  if (!MODOS.some((m) => m.id === modo)) return { ok: false, error: 'Elige a qué punto volver: «Vacía» o «PanaClaw por defecto».' };
  if (!Array.isArray(p?.ambitos) || !p.ambitos.length) return { ok: false, error: 'Marca al menos una cosa para restablecer.' };
  const malos = p.ambitos.filter((a) => !IDS_AMBITOS.includes(a));
  if (malos.length) return { ok: false, error: `Eso no se puede restablecer: ${malos.slice(0, 3).map((x) => String(x).slice(0, 30)).join(', ')}.` };
  return { ok: true, modo, ambitos: IDS_AMBITOS.filter((a) => p.ambitos.includes(a)) };
}

/** ¿Este ámbito se llena con algo de fábrica en este modo? */
export const traeFabrica = (modo, ambito) => modo === 'panaclaw' && !!AMBITOS.find((a) => a.id === ambito)?.fabrica;

/** Las líneas que se le enseñan al dueño antes de confirmar. `cuentas`: { ambito: 'texto de lo que hay ahora' }, `semilla`: el manifiesto. */
export function resumenDePedido({ modo, ambitos, cuentas = {}, semilla = null }) {
  return ambitos.map((id) => {
    const a = AMBITOS.find((x) => x.id === id), ahora = cuentas[id];
    const pone = traeFabrica(modo, id) ? ({ cerebro: `se cargan ${semilla?.notas ?? '?'} notas de fábrica`, habilidades: `se cargan ${semilla?.skills ?? '?'} skills de fábrica`, equipo: 'vuelve el equipo de fábrica', rutinas: `se cargan ${semilla?.rutinas ?? '?'} rutinas de fábrica` }[id]) : 'queda en blanco';
    return { ambito: id, nombre: a.nombre, texto: `${ahora ? `se quita lo que hay (${ahora})` : 'no hay nada que quitar'}; ${pone}` };
  });
}

/* ---------- los dos pasos ---------- */
const aleatorio = () => { const b = new Uint8Array(16); crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };
/** El paso 1: una clave de un solo uso atada a ESTE pedido. → { token, modo, ambitos, vence } (el token se guarda; solo se devuelve a quien lo pidió) */
export const nuevoPaso = ({ modo, ambitos }, ahora = Date.now()) => ({ token: aleatorio(), modo, ambitos, vence: ahora + VIDA_PASO_MS });
/** El paso 2: ¿vale lo que mandó la página? → null si vale, o el motivo en palabras */
export function verificarPaso(guardado, { token, escribio }, ahora = Date.now()) {
  if (!guardado) return 'Primero revisa lo que va a pasar (paso 1).';
  if (ahora > guardado.vence) return 'La confirmación caducó (dura 2 minutos). Vuelve a revisar lo que va a pasar.';
  if (!token || token !== guardado.token) return 'La confirmación no corresponde a este pedido. Vuelve a revisar lo que va a pasar.';
  if (String(escribio ?? '').trim() !== PALABRA) return `Para confirmar escribe ${PALABRA} tal cual.`;
  return null;
}
export const idRespaldo = (ahora = Date.now()) => `r${ahora.toString(36)}${aleatorio().slice(0, 4)}`;
export const venceRespaldo = (ahora = Date.now()) => ahora + DIAS_RESPALDO * 864e5;
export const textoRespaldo = (modo, ambitos, cuentas = {}) => `${MODOS.find((m) => m.id === modo)?.nombre || modo}: ${ambitos.map((a) => AMBITOS.find((x) => x.id === a)?.nombre).join(', ')}`;
