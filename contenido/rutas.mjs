// Agents Office V4.7 (30 sep 2026) — las rutas de Contenido: /api/contenido/*. Un solo import en serve.mjs.
import { fechasRepetidas, copiaDe, CADA, MAX_VECES } from '../src/contenido-repetir.js';
//   GET    /api/contenido?desde=&hasta=&sin_fecha=1&estado=&formato=&red=&q=   → { piezas, resumen, ajustes }
//   GET    /api/contenido/resumen                                               → los números del icono del dock
//   POST   /api/contenido/piezas                                                → crea (una pieza no nace aprobada)
//   GET|PATCH|DELETE /api/contenido/piezas/<id>                                 → leer · cambiar lo que venga · a la papelera
//   POST   /api/contenido/piezas/<id>/aprobar | /devolver                       → el OK del dueño · quitarlo
// Plan M1 (6 oct 2026), la cola que lleva lo aprobado al conductor (contenido/programador.mjs):
//   GET    /api/contenido/cola                                                  → { modo, conductor, horasAntes, cuenta, ultimo, entradas }
//   POST   /api/contenido/cola/tick                                             → una vuelta ya (no espera al minuto)
//   POST   /api/contenido/piezas/<id>/reintentar | /entregar | /quitar         → reintentar lo que falló · entregar ya · quitar de la cola
//   POST   /api/contenido/conductor/comprobar                                   → ¿la key de Metricool sirve? (marcas, sin publicar nada) · con Meta directo
//                                                                                  (8 oct 2026): la página, su Instagram, los permisos y la cuota
// C1 (8 oct 2026), el editor nuevo:
//   GET|POST /api/contenido/guardados · DELETE /api/contenido/guardados/<nombre>  → los textos guardados (nota del Cerebro) y tus hashtags más usados
//   POST   /api/contenido/mejorar { pieza, red, pide }                          → la propuesta de tu agente de contenido (no guarda nada)
//   POST   /api/contenido/piezas/<id>/aprobar { pronto: true }                  → aprobada para dentro de PRONTO_MIN minutos (src/contenido-reglas.js)
//   POST   /api/contenido/piezas/<id>/publicar-ya { confirmado: true }          → «Publicar ahora» (CON-04): solo el dueño, flag contenido.publicarYa, modo real + Meta directo; 202, sin deshacer
// C2 (8 oct 2026), lo ya publicado:
//   GET    /api/contenido/publicadas?desde=&hasta=                             → { fuente, ultimaFoto, porPieza: { id: [resultado] }, sueltas }
//   GET    /api/contenido/cuentas                                              → (9 oct 2026) { cuentas: [{ id, red, nombre, usuario, foto, paginaId, puedePublicar, motivo? }], porDefecto }
// C3 (8 oct 2026), llenar la semana y lo que vuelve:
//   GET    /api/contenido/llenar?desde=&dias=&redes=                           → { huecos (con lo que va en cada uno), vuelven, hora, agente }
//   POST   /api/contenido/llenar { huecos: [{ fecha, hora, que, vuelve? }], redes, pide } → copias «que vuelven» (a revisión) + una tarea a Marketing
//   GET|POST /api/contenido/plantillas · DELETE /api/contenido/plantillas/<nombre> → las plantillas (notas del Cerebro, Contenido/Plantillas)
// Cada pieza que sale de aquí lleva `salida` (lo que pasó al entregarla) cuando la cola la conoce.
// Los agentes llegan por aquí con `por: 'agente'` (contenido-mcp.mjs): pueden dejar borradores y leer, NUNCA aprobar. Eso se comprueba
// (9 oct 2026 y 25 oct 2026) Las rutas de Contenido salieron a contenido/rutas-nucleo.mjs (un controlador sin servidor ni disco, que el Worker de Cloudflare
// usa igual); aquí queda el envoltorio del servidor de la oficina local y la Bandeja, que es de otra fase.
import { crearControlador } from './rutas-nucleo.mjs';
export function crearRutas({ almacen, json, body, notice = () => {}, ajustes = () => ({}), programador = null, metricool = null, conductorMeta = () => null, mejorHora = null, analiticasTexto = null, bandeja = null, informe = null, guardados = null, mejorar = null, publicadas = null, encargar = null, quienLlena = () => '', plantillas = null, alBorrador = () => {}, cuentas = null, ahora = Date.now }) {
  const ctl = crearControlador({ almacen, notice, ajustes, programador, metricool, conductorMeta, mejorHora, analiticasTexto, informe, guardados, mejorar, publicadas, encargar, quienLlena, plantillas, alBorrador, cuentas, ahora });
  handle.planLlenar = ctl.planLlenar; handle.llenar = ctl.llenar; handle.redesDe = ctl.redesDe;
  return handle;

  async function handle(req, res, url) {
    const p = url.pathname;
    if (p !== '/api/contenido' && !p.startsWith('/api/contenido/')) return false;
    try {
      if (p === '/api/contenido/bandeja' && req.method === 'GET') {
        if (!bandeja) return json(res, 200, { items: [], cuenta: {}, pendientes: 0, fuente: { ok: false, motivo: 'sin bandeja' } }), true;
        const q = url.searchParams; if (q.get('abierta') === '1') bandeja.abierta?.(); // Fase B1: con la Bandeja a la vista, Meta se lee cada 3 min
        const f = ['meta', 'metricool'].includes(q.get('fuente')) ? q.get('fuente') : '';
        // 2 nov 2026: ?cuenta= (el id 'instagram:<id>', el @usuario o el nombre de una cuenta que tenga mensajes)
        return json(res, 200, bandeja.listar({ estado: q.get('estado') || '', red: q.get('red') || '', tipo: q.get('tipo') || '', fuente: f, cuenta: q.get('cuenta') || '' })), true;
      }
      if (p === '/api/contenido/bandeja/sincronizar' && req.method === 'POST') { if (!bandeja) return json(res, 404, { error: 'sin bandeja' }), true; return json(res, 200, await bandeja.sincronizar()), true; }
      // Fase B1 (9 oct 2026): DESHACER lo último de ocultar/mostrar (solo el dueño, dentro de approvals.undoSeconds)
      if (p === '/api/contenido/bandeja/deshacer' && req.method === 'POST' && bandeja) {
        const b = await body(req);
        if (b.por === 'agente') return json(res, 403, { error: 'los agentes no ocultan ni muestran comentarios: lo decide el dueño' }), true;
        const r = await bandeja.deshacer(b.token); return json(res, r.error ? (r.nada ? 404 : 409) : 200, r), true;
      }
      const bj = /^\/api\/contenido\/bandeja\/([^/]+)(?:\/(enviar|descartar|reabrir|ocultar|sugerir-ocultar))?$/.exec(p);
      if (bj && bandeja) {
        const id = decodeURIComponent(bj[1]), b = req.method === 'GET' ? {} : await body(req);
        if (!bj[2] && req.method === 'GET') { const m = bandeja.leer(id); return m ? json(res, 200, { item: m }) : json(res, 404, { error: 'ese mensaje ya no está en la bandeja' }), true; }
        if (!bj[2] && req.method === 'PATCH') {
          const por = b.por === 'agente' ? 'agente' : 'dueno';
          let r = null;
          if (b.borrador !== undefined) r = bandeja.borrador(id, b.borrador, { por, agente: b.agente });
          if (!r?.error && b.sugerirOcultar && por === 'agente') r = bandeja.sugerirOcultar(id, b.sugerirOcultar.motivo ?? b.sugerirOcultar, { agente: b.agente }); // B1: el agente solo SUGIERE
          r ||= { error: 'no hay nada que cambiar' };
          return json(res, r.error ? (r.nada ? 404 : 409) : 200, r), true;
        }
        if (bj[2] === 'sugerir-ocultar' && req.method === 'POST') { // B1: un agente (o Dimitri) sugiere ocultar; nunca oculta
          const r = bandeja.sugerirOcultar(id, b.motivo, { agente: b.agente || (b.por === 'agente' ? '' : 'dueno') });
          return json(res, r.error ? (r.nada ? 404 : 409) : 200, r), true;
        }
        if (bj[2] && req.method === 'POST') {
          if (b.por === 'agente') return json(res, 403, { error: bj[2] === 'ocultar' ? 'los agentes no ocultan ni muestran comentarios: pueden sugerirlo (sugerir_ocultar_comentario) y lo decide el dueño' : 'los agentes no envían ni descartan respuestas: dejan el borrador y el dueño decide' }), true;
          const r = bj[2] === 'enviar' ? await bandeja.enviar(id, b.texto, { forzar: b.forzar === true }) : bj[2] === 'ocultar' ? await bandeja.ocultar(id, b.ocultar !== false) : bj[2] === 'descartar' ? bandeja.descartar(id) : bandeja.reabrir(id);
          const { status, ...rr } = r; // B2: 409 «ventana» (fuera de las 24 h) y 422 (texto vacío o de 1.000 caracteres o más) traen su código
          return json(res, rr.error ? (status || (rr.nada ? 404 : 409)) : 200, rr), true;
        }
      }
    } catch (e) { return json(res, e.status || 500, { error: e.message }), true; }
    const r = await ctl.responder({ metodo: req.method, p, query: url.searchParams, cuerpo: limite => body(req, limite) });
    return json(res, r.status, r.datos), true;
  };
}
