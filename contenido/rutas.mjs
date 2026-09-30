// Agents Office V4.7 (30 sep 2026) — las rutas de Contenido: /api/contenido/*. Un solo import en serve.mjs.
//   GET    /api/contenido?desde=&hasta=&sin_fecha=1&estado=&formato=&red=&q=   → { piezas, resumen, ajustes }
//   GET    /api/contenido/resumen                                               → los números del icono del dock
//   POST   /api/contenido/piezas                                                → crea (una pieza no nace aprobada)
//   GET|PATCH|DELETE /api/contenido/piezas/<id>                                 → leer · cambiar lo que venga · a la papelera
//   POST   /api/contenido/piezas/<id>/aprobar | /devolver                       → el OK del dueño · quitarlo
// Los agentes llegan por aquí con `por: 'agente'` (contenido-mcp.mjs): pueden dejar borradores y leer, NUNCA aprobar. Eso se comprueba
// aquí y no solo en la herramienta, porque cualquier proceso de esta máquina puede llamar a la API.
import { postDePieza, revisarPublicacion } from '../src/contenido-reglas.js';

const ID = '[a-z0-9-]+';
const DE_AGENTE = new Set(['idea', 'borrador']); // lo que un agente puede dejar: nunca «en revisión» ni «aprobada»

export function crearRutas({ almacen, json, body, notice = () => {}, ajustes = () => ({}) }) {
  const revisado = p => { const r = revisarPublicacion(postDePieza(p), p.redes); return { ...p, revision: { errores: r.errores, avisos: r.avisos, arreglos: r.arreglos } }; };
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
