// Las funciones que se publicaron APAGADAS y el dueño enciende cuando quiere (31 oct 2026). Puro: sin imports, sin DOM, sin fs.
// Lo usan el script que las enciende desde GitHub (cloudflare/scripts/encender-funciones.mjs), el panel «Funciones nuevas» de
// Ajustes y sus tests. UNA sola lista: un interruptor nuevo se añade aquí y aparece en los tres sitios.
//
// POR QUÉ ESTE ARCHIVO. Cada función se publicó detrás de su interruptor, apagado, para que nada que gaste dinero o toque el
// acceso se encendiera solo al desplegar. Pero los interruptores viven en TRES documentos distintos de D1 y ninguno tenía
// pantalla: encenderlos pedía la consola del navegador. Esta lista dice, para cada uno, en qué documento está y qué ruta dentro de él.
//
// REGLAS:
//  · `lista: true` solo si la función está construida de punta a punta y encenderla hoy hace algo útil. Si no, `porque` dice
//    qué falta, y el script se niega a encenderla salvo que la nombren una por una.
//  · `gasta: true` si encenderla ABRE la puerta a gastar dinero. Nunca gasta por encenderse (los topes y los dos clics del
//    dueño siguen intactos): abre la puerta, nada más. El panel lo advierte y pide un segundo clic.
//  · `panel` dice dónde SE CAMBIA YA desde la pantalla: esa función no se toca desde aquí (dos interruptores para un mismo
//    flag es un fallo esperando). Se nombra para que el dueño sepa dónde está.
//  · Solo `=== true` enciende, como en el código que las lee: un "false" de texto no puede encender el gasto.

/** Dónde vive cada interruptor. 'config' se escribe en los DOS documentos de ajustes (`ajustes` y `config-local`), como hace
 *  lib/ajustes.js → guardarCambios: Anuncios y la sesión leen uno y el resto de la oficina el otro. */
export const DOC_AJUSTES = 'ajustes', DOC_LOCAL = 'config-local';

export const FUNCIONES = [
  {
    id: 'chat',
    titulo: 'Chat interno del equipo',
    que: 'El chat entre las personas de la oficina, con la campanita, «escribiendo…» y notas personales. Solo entre personas: los agentes no lo leen ni escriben en él.',
    donde: 'chat.config', ruta: 'activo',
    lista: true, gasta: false,
    nota: 'Al encenderlo, cada cuenta entra sola en #general la primera vez que abre el chat.',
  },
  {
    id: 'carpetas-arbol',
    titulo: 'Carpetas en árbol en el Estudio',
    que: 'Carpetas dentro de carpetas en la galería. Borrar una manda su contenido a la papelera 30 días, con confirmación y deshacer.',
    donde: 'estudio.config', ruta: 'carpetasArbol',
    lista: true, gasta: false,
    nota: 'Si lo apagas después, las carpetas que habías anidado se ven en una sola fila; no se pierde ninguna imagen.',
  },
  {
    id: 'sesion-deslizante',
    titulo: 'Sesión que se renueva sola',
    que: 'Una sesión dura 7 días y se renueva mientras la uses. Quien administra o edita y lleva 14 días sin entrar, tiene que volver a poner su contraseña.',
    donde: 'config', ruta: 'sesion.deslizante',
    lista: true, gasta: false,
    nota: 'Encenderlo NO desconecta a nadie: una sesión sin registro de uso cuenta como usada ahora mismo.',
  },
  {
    id: 'acceso-retroceso',
    titulo: 'Freno al adivinar contraseñas',
    que: 'Quien falla la contraseña muchas veces espera cada vez más, hasta 5 segundos. Quien la acierta entra sin esperar nada.',
    donde: 'config', ruta: 'acceso.retroceso',
    lista: true, gasta: false,
    nota: 'Nunca deja a nadie fuera: solo retrasa el aviso de contraseña incorrecta. Nadie puede dejarte fuera fallando con tu correo.',
  },
  {
    id: 'series-nube',
    titulo: 'Series de imágenes en la nube: ver y proponer',
    que: 'Dimitri propone y organiza series de imágenes desde la nube. Solo leer y proponer: no genera y no gasta.',
    donde: 'config', ruta: 'dimitri.seriesNube',
    lista: true, gasta: false,
  },
  {
    id: 'lotes-nube',
    titulo: 'Lotes del Estudio en la nube',
    que: 'Muchas fotos con la misma receta desde la nube. El lote nace «previsto» y no gasta hasta que tú pulses «Probar con 3» o «Generar todas».',
    donde: 'estudio.config', ruta: 'lotesNube',
    lista: true, gasta: true,
    nota: 'Encenderlo no gasta. Gastan los dos botones de dentro, y siguen pidiendo tu clic y respetando los topes del Estudio.',
  },
  {
    id: 'retoques-nube',
    titulo: 'Retoques de foto en la nube',
    que: 'Los arreglos de luz, color y fondo blanco que hoy solo hace tu computadora, hechos en la nube.',
    donde: 'estudio.config', ruta: 'retoquesNube',
    lista: false,
    porque: 'El servicio de imágenes de Cloudflare está declarado pero nunca se probó en producción. Si falla, los retoques de un pedido fallan con él. Enciéndelo cuando quieras probarlo, mejor con un pedido de prueba primero.',
    gasta: false,
  },
  {
    id: 'series-nube-pago',
    titulo: 'Series en la nube: pasos que gastan',
    que: 'Que la nube genere de verdad las imágenes de una serie, no solo proponerlas.',
    donde: 'config', ruta: 'dimitri.seriesNubePago',
    requiere: 'series-nube',
    lista: false,
    porque: 'Todavía no hace nada: la parte que genera en la nube (la bomba del reloj) no está construida y contesta «no disponible». Generar series sigue siendo cosa de tu computadora.',
    gasta: true,
  },
  {
    id: 'dominios-conector',
    titulo: 'Dominios permitidos por conector',
    que: 'Dejar que un conector consulte páginas de una lista corta de dominios tuyos.',
    donde: 'config', ruta: 'safety.dominiosPorConector',
    lista: false,
    panel: 'Ajustes → Seguridad',
    porque: 'Ya tiene su propio interruptor en la pantalla, así que no se toca desde aquí.',
    gasta: false,
  },
];

/** Las que tienen su interruptor en esta herramienta (las que ya se cambian desde una pantalla, no). */
export const MANEJABLES = FUNCIONES.filter((f) => !f.panel);
/** Las que se encienden con «listas»: construidas de punta a punta y útiles hoy. */
export const LISTAS = MANEJABLES.filter((f) => f.lista);

export const porId = (id) => FUNCIONES.find((f) => f.id === String(id || '').trim()) || null;

/** Qué documentos hay que tocar para un grupo de funciones. 'config' son dos documentos; los demás, uno. */
export function documentosDe(funciones) {
  const d = new Set();
  for (const f of funciones) { if (f.donde === 'config') { d.add(DOC_AJUSTES); d.add(DOC_LOCAL); } else d.add(f.donde); }
  return [...d];
}

/** Pone `valor` en la ruta `a.b.c` de un objeto, creando lo que falte. Devuelve una copia: nunca toca el original. */
export function poner(obj, ruta, valor) {
  const partes = String(ruta).split('.');
  const copia = obj && typeof obj === 'object' && !Array.isArray(obj) ? { ...obj } : {};
  let aqui = copia;
  for (let i = 0; i < partes.length - 1; i++) {
    const k = partes[i], hijo = aqui[k];
    aqui[k] = hijo && typeof hijo === 'object' && !Array.isArray(hijo) ? { ...hijo } : {};
    aqui = aqui[k];
  }
  aqui[partes[partes.length - 1]] = valor;
  return copia;
}

/** Lee la ruta `a.b.c`. */
export const leer = (obj, ruta) => String(ruta).split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);

/** ¿Está encendida? Como el código que la lee: solo `=== true`. */
export const activa = (f, docs) => leer(f.donde === 'config' ? { ...(docs[DOC_LOCAL] || {}), ...(docs[DOC_AJUSTES] || {}) } : (docs[f.donde] || {}), f.ruta) === true;

/**
 * Qué hay que escribir para dejar encendidas (o apagadas) las funciones pedidas.
 * docs: { clave: valorJSON } tal como están hoy · pedido: [{ id, activo }]
 * Devuelve { cambios: { clave: valorNuevo }, hechos: [{ id, de, a }], avisos: [texto] }. No escribe nada: solo calcula.
 */
export function plan(docs, pedido) {
  const cambios = {}, hechos = [], avisos = [];
  const estado = (id) => { const f = porId(id); return f ? activa(f, { ...docs, ...cambios }) : false; };
  for (const { id, activo } of pedido) {
    const f = porId(id);
    if (!f) { avisos.push(`«${id}» no es una función de la lista.`); continue; }
    if (f.panel) { avisos.push(`${f.titulo}: se cambia en ${f.panel}, no desde aquí.`); continue; }
    const quiero = activo === true;
    if (quiero && f.requiere && !estado(f.requiere) && !pedido.some((p) => p.id === f.requiere && p.activo === true)) {
      avisos.push(`${f.titulo}: antes hay que encender «${porId(f.requiere).titulo}». No se encendió.`);
      continue;
    }
    const antes = activa(f, { ...docs, ...cambios });
    if (antes === quiero) { hechos.push({ id: f.id, de: antes, a: quiero, yaEstaba: true }); continue; }
    for (const clave of f.donde === 'config' ? [DOC_AJUSTES, DOC_LOCAL] : [f.donde]) {
      cambios[clave] = poner(cambios[clave] !== undefined ? cambios[clave] : (docs[clave] || {}), f.ruta, quiero);
    }
    hechos.push({ id: f.id, de: antes, a: quiero, yaEstaba: false });
  }
  return { cambios, hechos, avisos };
}

/** Los ids que pide una lista escrita a mano: «listas», «todas» o «chat,lotes-nube». */
export function idsDe(texto) {
  const t = String(texto || '').trim().toLowerCase();
  if (!t || t === 'listas') return LISTAS.map((f) => f.id);
  if (t === 'todas') return MANEJABLES.map((f) => f.id);
  return t.split(/[,\s]+/).filter(Boolean);
}
