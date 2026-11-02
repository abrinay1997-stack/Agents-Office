// Las rutas /api/contenido/bandeja* con la MISMA forma que las de la oficina local (contenido/rutas.mjs, líneas de «plan M4» y Fase B1/B2).
// Devuelven { status, cuerpo } sin tocar la Response: así se prueban contra la local con la misma entrada (cloudflare/tests/bandeja.test.mjs).
//   GET  /api/contenido/bandeja[?abierta=1&estado=&red=&tipo=&fuente=]      → { items, cuenta, pendientes, ultimo, error, fuente, modo, bandejaFuente, fuentes }
//   POST /api/contenido/bandeja/sincronizar                                → { ok, error, nuevos }
//   POST /api/contenido/bandeja/deshacer { token }                          → 200 { ok, item, simulada } · 404 · 409 · 403 (un agente)
//   GET|PATCH /api/contenido/bandeja/<id>                                   → { item } · PATCH { borrador } | { sugerirOcultar } (un agente solo sugiere)
//   POST /api/contenido/bandeja/<id>/(enviar|descartar|reabrir|ocultar|sugerir-ocultar)
// QUIÉN: un agente (`por: 'agente'`) deja borradores y SUGIERE ocultar; enviar, ocultar, mostrar, descartar y reabrir son del dueño (403 a un agente).
// El rol lo decide el módulo (lib/../modulos/bandeja.js): lectura solo lee; editor puede escribir un borrador; solo un administrador envía.

const no = (status, error, extra = {}) => ({ status, cuerpo: { error, ...extra } });
const ok = (cuerpo) => ({ status: 200, cuerpo });
const deRespuesta = (r) => ({ status: r.error ? (r.nada ? 404 : 409) : 200, cuerpo: r });

export const ACCIONES = ['enviar', 'descartar', 'reabrir', 'ocultar', 'sugerir-ocultar'];
/** ¿Esta ruta es de la Bandeja? → null, o { id, accion } (id/accion pueden ser null). */
export function analizarRuta(ruta) {
  if (ruta === '/api/contenido/bandeja') return { raiz: true };
  if (ruta === '/api/contenido/bandeja/sincronizar') return { sincronizar: true };
  if (ruta === '/api/contenido/bandeja/deshacer') return { deshacer: true };
  const m = /^\/api\/contenido\/bandeja\/([^/]+)(?:\/(enviar|descartar|reabrir|ocultar|sugerir-ocultar))?$/.exec(ruta);
  if (!m) return null;
  let id; try { id = decodeURIComponent(m[1]); } catch { return null; }
  return { id, accion: m[2] || null };
}

/** `bandeja` = crearBandeja(...); `pre` ya lo hizo la ruta del módulo si hacía falta (candados, cuentas). */
export async function resolverBandeja({ bandeja, metodo, ruta, url, b = {}, asegurar = async () => {} }) {
  const r = analizarRuta(ruta);
  if (!r) return null;
  if (r.raiz && metodo === 'GET') {
    const q = url.searchParams; if (q.get('abierta') === '1') bandeja.abierta?.();
    const f = ['meta', 'metricool'].includes(q.get('fuente')) ? q.get('fuente') : '';
    return ok(bandeja.listar({ estado: q.get('estado') || '', red: q.get('red') || '', tipo: q.get('tipo') || '', fuente: f, cuenta: q.get('cuenta') || '' }));
  }
  if (r.sincronizar && metodo === 'POST') { await asegurar(); return ok(await bandeja.sincronizar()); }
  if (r.deshacer && metodo === 'POST') {
    if (b.por === 'agente') return no(403, 'los agentes no ocultan ni muestran comentarios: lo decide el dueño');
    return deRespuesta(await bandeja.deshacer(b.token));
  }
  if (r.id === undefined) return null;
  const id = r.id;
  if (!r.accion && metodo === 'GET') { const m = bandeja.leer(id); return m ? ok({ item: m }) : no(404, 'ese mensaje ya no está en la bandeja'); }
  if (!r.accion && metodo === 'PATCH') {
    const por = b.por === 'agente' ? 'agente' : 'dueno';
    let x = null;
    if (b.borrador !== undefined) x = bandeja.borrador(id, b.borrador, { por, agente: b.agente });
    if (!x?.error && b.sugerirOcultar && por === 'agente') x = bandeja.sugerirOcultar(id, b.sugerirOcultar.motivo ?? b.sugerirOcultar, { agente: b.agente }); // B1: el agente solo SUGIERE
    x ||= { error: 'no hay nada que cambiar' };
    return deRespuesta(x);
  }
  if (r.accion === 'sugerir-ocultar' && metodo === 'POST') { // B1: un agente (o Dimitri) sugiere ocultar; nunca oculta
    return deRespuesta(bandeja.sugerirOcultar(id, b.motivo, { agente: b.agente || (b.por === 'agente' ? '' : 'dueno') }));
  }
  if (r.accion && metodo === 'POST') {
    if (b.por === 'agente') return no(403, r.accion === 'ocultar' ? 'los agentes no ocultan ni muestran comentarios: pueden sugerirlo (sugerir_ocultar_comentario) y lo decide el dueño' : 'los agentes no envían ni descartan respuestas: dejan el borrador y el dueño decide');
    const x = r.accion === 'enviar' ? await bandeja.enviar(id, b.texto, { forzar: b.forzar === true }) : r.accion === 'ocultar' ? await bandeja.ocultar(id, b.ocultar !== false) : r.accion === 'descartar' ? bandeja.descartar(id) : bandeja.reabrir(id);
    const { status, ...rr } = x; // B2: 409 «ventana» (fuera de las 24 h) y 422 (texto vacío o de 1.000 caracteres o más) traen su código
    return { status: rr.error ? (status || (rr.nada ? 404 : 409)) : 200, cuerpo: rr };
  }
  return null;
}
