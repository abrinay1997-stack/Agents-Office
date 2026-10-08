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
// Cada pieza que sale de aquí lleva `salida` (lo que pasó al entregarla) cuando la cola la conoce.
// Los agentes llegan por aquí con `por: 'agente'` (contenido-mcp.mjs): pueden dejar borradores y leer, NUNCA aprobar. Eso se comprueba
// aquí y no solo en la herramienta, porque cualquier proceso de esta máquina puede llamar a la API.
import { postDePieza, revisarPublicacion } from '../src/contenido-reglas.js';

const ID = '[a-z0-9-]+';
const DE_AGENTE = new Set(['idea', 'borrador']); // lo que un agente puede dejar: nunca «en revisión» ni «aprobada»

export function crearRutas({ almacen, json, body, notice = () => {}, ajustes = () => ({}), programador = null, metricool = null, conductorMeta = () => null, mejorHora = null, analiticasTexto = null, bandeja = null, informe = null }) {
  const revisado = p => { const r = revisarPublicacion(postDePieza(p), p.redes); return { ...p, revision: { errores: r.errores, avisos: r.avisos, arreglos: r.arreglos }, salida: programador ? programador.salidaDe(p.id) : null }; };
  const resumen = () => {
    const todas = almacen.listar({ sinFecha: true });
    const hoy = new Date(); const y = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const en7 = new Date(hoy); en7.setDate(en7.getDate() + 7);
    return {
      total: todas.length,
      revisar: todas.filter(p => p.estado === 'revision').length, // esperan el OK del dueño
      borradores: todas.filter(p => p.estado === 'borrador' || p.estado === 'idea').length,
      aprobadas: todas.filter(p => p.estado === 'aprobada').length,
      cambiadas: todas.filter(p => p.cambiadaTrasAprobar).length,
      sinFecha: todas.filter(p => !p.fecha).length,
      proximas7: todas.filter(p => p.fecha && p.fecha >= y(hoy) && p.fecha <= y(en7)).length,
      fallos: programador ? Object.values(programador.estado().entradas).filter(e => e.estado === 'fallo' || e.estado === 'parcial').length : 0, // M1: lo que no pudo salir
    };
  };

  return async function handle(req, res, url) {
    const p = url.pathname;
    if (p !== '/api/contenido' && !p.startsWith('/api/contenido/')) return false;
    try {
      if (p === '/api/contenido' && req.method === 'GET') {
        const q = url.searchParams, f = { desde: q.get('desde') || '', hasta: q.get('hasta') || '', sinFecha: q.get('sin_fecha') === '1', estado: q.get('estado') || undefined, formato: q.get('formato') || undefined, red: q.get('red') || undefined, q: q.get('q') || '' };
        return json(res, 200, { piezas: almacen.listar(f).map(revisado), resumen: resumen(), ajustes: ajustes() }), true;
      }
      if (p === '/api/contenido/resumen' && req.method === 'GET') return json(res, 200, resumen()), true;
      if (p === '/api/contenido/piezas' && req.method === 'POST') {
        const b = await body(req); const deAgente = b.por === 'agente';
        const datos = { ...b }; delete datos.por; delete datos.agente;
        if (deAgente) { datos.origen = `agente:${b.agente || '?'}`; if (!DE_AGENTE.has(datos.estado)) datos.estado = 'borrador'; }
        const r = almacen.crear(datos, { por: deAgente ? 'agente' : 'dueno' });
        if (r.error) return json(res, 400, { error: r.error }), true;
        if (deAgente && r.pieza.tarea) notice('contenido', `Un agente dejó un borrador en Contenido: «${r.pieza.titulo || 'sin título'}»${r.pieza.fecha ? ' para el ' + r.pieza.fecha : ''}. Revísalo y apruébalo cuando esté bien.`, { key: 'contenido-' + r.pieza.tarea });
        return json(res, 200, { ok: true, pieza: revisado(r.pieza) }), true;
      }
      // plan M4 (6 oct 2026): la bandeja — leer, sincronizar, el borrador (agente o dueño) y enviar/descartar (solo el dueño)
      if (p === '/api/contenido/informe' && (req.method === 'GET' || req.method === 'POST')) { // plan M5 · U10: el informe del mes; POST lo guarda en el Cerebro
        if (!informe) return json(res, 404, { error: 'sin informe' }), true;
        const b = req.method === 'POST' ? await body(req) : {}, mes = String(b.mes || url.searchParams.get('mes') || new Date().toISOString().slice(0, 7));
        if (!/^\d{4}-\d{2}$/.test(mes)) return json(res, 400, { error: 'el mes va como AAAA-MM' }), true;
        const r = await informe(mes, { guardar: req.method === 'POST' }); return json(res, 200, r), true;
      }
      if (p === '/api/contenido/bandeja' && req.method === 'GET') {
        if (!bandeja) return json(res, 200, { items: [], cuenta: {}, pendientes: 0, fuente: { ok: false, motivo: 'sin bandeja' } }), true;
        const q = url.searchParams; return json(res, 200, bandeja.listar({ estado: q.get('estado') || '', red: q.get('red') || '', tipo: q.get('tipo') || '' })), true;
      }
      if (p === '/api/contenido/bandeja/sincronizar' && req.method === 'POST') { if (!bandeja) return json(res, 404, { error: 'sin bandeja' }), true; return json(res, 200, await bandeja.sincronizar()), true; }
      const bj = /^\/api\/contenido\/bandeja\/([^/]+)(?:\/(enviar|descartar|reabrir))?$/.exec(p);
      if (bj && bandeja) {
        const id = decodeURIComponent(bj[1]), b = req.method === 'GET' ? {} : await body(req);
        if (!bj[2] && req.method === 'GET') { const m = bandeja.leer(id); return m ? json(res, 200, { item: m }) : json(res, 404, { error: 'ese mensaje ya no está en la bandeja' }), true; }
        if (!bj[2] && req.method === 'PATCH') { const r = bandeja.borrador(id, b.borrador, { por: b.por === 'agente' ? 'agente' : 'dueno', agente: b.agente }); return json(res, r.error ? (r.nada ? 404 : 409) : 200, r), true; }
        if (bj[2] && req.method === 'POST') {
          if (b.por === 'agente') return json(res, 403, { error: 'los agentes no envían ni descartan respuestas: dejan el borrador y el dueño decide' }), true;
          const r = bj[2] === 'enviar' ? await bandeja.enviar(id, b.texto) : bj[2] === 'descartar' ? bandeja.descartar(id) : bandeja.reabrir(id);
          return json(res, r.error ? (r.nada ? 404 : 409) : 200, r), true;
        }
      }
      if (p === '/api/contenido/mejor-hora' && req.method === 'GET') { // plan M3: la tabla 7 × 24 de las redes pedidas y de dónde sale
        if (!mejorHora) return json(res, 200, { fuente: 'ninguna', grid: null, motivo: 'sin fuente' }), true;
        const redes = (url.searchParams.get('redes') || 'instagram').split(',').map(x => x.trim()).filter(Boolean).slice(0, 9);
        return json(res, 200, await mejorHora.horas(redes)), true;
      }
      if (p === '/api/contenido/analiticas/resumen' && req.method === 'GET') { // plan M3: Analíticas en palabras, para los agentes
        if (!analiticasTexto) return json(res, 200, { texto: 'Analíticas no está disponible aquí.' }), true;
        const dias = Math.min(90, Math.max(7, parseInt(url.searchParams.get('dias') || '30', 10) || 30));
        const redes = (url.searchParams.get('redes') || (ajustes().redes || ['instagram', 'facebook']).join(',')).split(',').filter(Boolean).slice(0, 9);
        return json(res, 200, await analiticasTexto(dias, redes)), true;
      }
      if (p === '/api/contenido/cola' && req.method === 'GET') return json(res, 200, programador ? programador.estado() : { modo: 'apagado', entradas: {} }), true;
      if (p === '/api/contenido/cola/tick' && req.method === 'POST') { if (!programador) return json(res, 404, { error: 'sin cola' }), true; const u = await programador.tick(); return json(res, 200, { ok: true, ultimo: u, ...programador.estado() }), true; }
      if (p === '/api/contenido/conductor/comprobar' && req.method === 'POST') {
        const cm = conductorMeta(); // F3: con Meta directo elegido, se comprueba Meta (sin publicar nada)
        if (cm) { try { const r = await cm.comprobar(); programador?.tick().catch(() => {}); return json(res, 200, r), true; } catch (e) { return json(res, 200, { ok: false, error: e.message }), true; } }
        if (!metricool || !metricool.configurado()) return json(res, 200, { ok: false, error: 'Faltan METRICOOL_USER_TOKEN y METRICOOL_USER_ID: ponlas como variables de Windows (Metricool → Ajustes de la cuenta → API; es del plan Advanced) y reinicia la oficina.' }), true;
        try { const marcas = await metricool.marcas({ fresco: true }), marca = await metricool.marca(); return json(res, 200, { ok: true, marca, marcas }), true; }
        catch (e) { return json(res, 200, { ok: false, error: e.message }), true; }
      }
      const rp = new RegExp(`^/api/contenido/piezas/(${ID})/repetir$`).exec(p); // plan M5 · U7: copias como borradores, en los días que tocan
      if (rp && req.method === 'POST') {
        const b = await body(req); if (b.por === 'agente') return json(res, 403, { error: 'repetir piezas es del dueño' }), true;
        const pz = almacen.leer(rp[1]); if (!pz) return json(res, 404, { error: 'esa pieza ya no existe' }), true;
        if (!pz.fecha) return json(res, 409, { error: 'ponle un día antes de repetirla: las copias se cuentan desde ese día' }), true;
        const fechas = fechasRepetidas(pz.fecha, b.cada, b.veces); if (!fechas.length) return json(res, 400, { error: `di cada cuánto (${Object.keys(CADA).join(', ')}) y cuántas veces (1 a ${MAX_VECES})` }), true;
        const creadas = [];
        for (const f of fechas) { const r = almacen.crear({ ...copiaDe(pz), fecha: f, estado: 'borrador', origen: 'repetida' }, { por: 'dueno' }); if (r.pieza) creadas.push(revisado(r.pieza)); }
        return json(res, 200, { ok: true, creadas }), true;
      }
      const mc = new RegExp(`^/api/contenido/piezas/(${ID})/(reintentar|entregar|quitar)$`).exec(p);
      if (mc && req.method === 'POST') {
        const b = await body(req); if (b.por === 'agente') return json(res, 403, { error: 'los agentes no programan ni quitan piezas de la cola: es del dueño' }), true;
        if (!programador) return json(res, 404, { error: 'sin cola' }), true;
        const r = mc[2] === 'reintentar' ? programador.reintentar(mc[1]) : mc[2] === 'entregar' ? programador.entregarYa(mc[1]) : programador.cancelar(mc[1]);
        if (r.error) return json(res, 409, { error: r.error }), true;
        programador.tick().catch(() => {});
        const pz = almacen.leer(mc[1]); return json(res, 200, { ok: true, pieza: pz ? revisado(pz) : null }), true;
      }
      const m = new RegExp(`^/api/contenido/piezas/(${ID})(?:/(aprobar|devolver))?$`).exec(p);
      if (m) {
        const id = m[1], accion = m[2];
        if (!accion && req.method === 'GET') { const pz = almacen.leer(id); return pz ? json(res, 200, { pieza: revisado(pz) }) : json(res, 404, { error: 'esa pieza ya no existe' }), true; }
        if (!accion && req.method === 'PATCH') {
          const b = await body(req);
          if (b.por === 'agente') { // un agente mejora sus borradores; lo que el dueño ya aprobó solo lo cambia el dueño
            const antes = almacen.leer(id); if (antes && antes.estado === 'aprobada') return json(res, 409, { error: 'esa pieza ya está aprobada: solo el dueño la cambia' }), true;
            delete b.estado; delete b.aprobada;
          }
          delete b.por; delete b.agente; delete b.id; delete b.creada;
          const r = almacen.guardar(id, b);
          return r.error ? (json(res, r.nada ? 404 : 400, { error: r.error }), true) : (json(res, 200, { ok: true, pieza: revisado(r.pieza), soltada: !!r.soltada }), true);
        }
        if (!accion && req.method === 'DELETE') { const r = almacen.borrar(id); return r.error ? (json(res, 404, { error: r.error }), true) : (json(res, 200, { ok: true }), true); }
        if (accion && req.method === 'POST') {
          const b = await body(req);
          if (b.por === 'agente') return json(res, 403, { error: 'los agentes no aprueban ni devuelven piezas: es del dueño' }), true;
          const r = accion === 'aprobar' ? almacen.aprobar(id, { por: String(b.quien || 'dueno').slice(0, 40) }) : almacen.devolver(id, b.estado);
          return r.error ? (json(res, r.nada ? 404 : 409, { error: r.error, errores: r.errores }), true) : (json(res, 200, { ok: true, pieza: revisado(r.pieza), avisos: r.avisos || [] }), true);
        }
      }
      if (p === '/api/contenido/usos' && req.method === 'GET') return json(res, 200, { usos: almacen.usos(url.searchParams.get('medio') || '') }), true;
      return json(res, 404, { error: 'esa dirección de Contenido no existe' }), true;
    } catch (e) { return json(res, e.status || 500, { error: e.message }), true; }
  };
}
