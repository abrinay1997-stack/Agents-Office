// Lo que el dueño lee en la ficha roja de un trabajo que falló (auditoría del Estudio de imagen, IMG-04, 6 oct 2026).
// Antes llegaba el error del proveedor tal cual («Nano Banana 2: 400 Request contains an invalid argument.»): en inglés, con
// el código HTTP y sin decir qué hacer. Ahora cada error tiene una CLASE (key · saldo · espera · contenido · tiempo · formato ·
// servicio · red · otro) y una frase en español que dice qué pasó y qué probar; el original queda aparte (`detalle`) para quien
// lo quiera ver en «Detalles técnicos». La página usa la clase para ofrecer el arreglo («Reintentar con otro modelo»).
//   explicar(msg, status) → { texto, clase, detalle }
// Puro: sin red ni disco. Los textos conservan las palabras que otros leen (lotes-puente.mjs pausa un lote con «créditos» o
// «saldo»; check.mjs y tests/minimax.test.mjs buscan «contenido»).

/** «Nano Banana 2: 400 Request…» → «Nano Banana 2»; sin prefijo, «El servicio». */
function quien(m) {
  const x = /^([^:]{2,60}):\s*\d{3}\b/.exec(m) || /^([^:]{2,40}):\s/.exec(m);
  return x && !/^(https?|error)$/i.test(x[1].trim()) ? x[1].trim() : 'El servicio';
}
/** El código HTTP, del status o del propio texto («…: 400 …»). */
function codigo(m, status) { if (status) return +status; const x = /:\s*(\d{3})\b/.exec(m); return x ? +x[1] : 0; }
/** ¿Ya está en nuestras palabras? Un error que la oficina (o minimax.mjs) escribió en español pasa tal cual: solo se reescribe
 *  lo que llega en el idioma del proveedor. Se mira el texto sin el prefijo «Modelo: 400». */
const ES = /[áéíóúñ¿¡]|\b(de|del|las|el|los|tu|con|para|que|una|por|sin)\b/i;
const nuestro = m => ES.test(m.replace(/^[^:]{2,60}:\s*(\d{3}\b)?/, ''));

export function explicar(msg, status) {
  const m = String(msg || '').trim(), s = codigo(m, status), w = quien(m);
  const r = (clase, texto) => ({ clase, texto, detalle: texto === m ? '' : m });
  if (!m) return r('otro', 'falló sin decir por qué; reintenta');
  if (s === 403 && /Higgsfield/.test(m)) return r('saldo', 'sin créditos en Higgsfield: recarga en cloud.higgsfield.ai y reintenta'); // Higgsfield contesta 403 a «Not enough credits» (su propio cliente), no a una key mala
  if (s === 401 || s === 403 || /unauthori[sz]ed|invalid (api )?key|api key not valid|forbidden|permission denied/i.test(m)) return r('key', 'la key no es válida o no tiene permiso: revísala en la web del servicio y reinicia la oficina');
  if (s === 402 || /insufficient|credits?\b|balance|quota|billing/i.test(m)) return r('saldo', 'sin saldo o créditos en el servicio: recarga en su web y reintenta');
  if (s === 429 || /rate.?limit|too many/i.test(m)) return r('espera', 'el servicio pide esperar un poco (demasiadas peticiones): reintenta en un minuto');
  if (/nsfw|safety|blocked|moderation|policy/i.test(m)) return r('contenido', 'el motor lo bloqueó por su filtro de contenido: cambia el prompt o la referencia');
  if (/timeout|timed out|aborted/i.test(m)) return r('tiempo', 'el servicio no respondió a tiempo: reintenta');
  if (/ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|fetch failed|socket hang up|network/i.test(m)) return r('red', 'no hubo conexión con el servicio: revisa internet y reintenta');
  if (nuestro(m)) return { clase: 'otro', texto: m.slice(0, 300), detalle: '' }; // ya en español (la oficina, MiniMax): tal cual
  if (s === 400 || s === 404 || s === 422 || /invalid (argument|value|parameter|request)|unsupported|not supported|aspect.?ratio|resolution/i.test(m)) return r('formato', `${w} no aceptó el pedido: suele ser el formato, el tamaño o una referencia que este modelo no admite. Prueba otro formato u otro modelo`);
  if (s >= 500 || /internal (server )?error|unavailable|overloaded|bad gateway/i.test(m)) return r('servicio', `${w} tuvo un fallo de su lado: reintenta en un momento o prueba otro modelo`);
  return r('otro', `${w} devolvió un error que la oficina no reconoce: reintenta o prueba otro modelo`);
}
