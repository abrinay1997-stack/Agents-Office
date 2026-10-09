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
//   POST   /api/contenido/piezas/<id>/aprobar { pronto: true }                  → «Publicar ya»: aprobada para dentro de unos 5 minutos
// C2 (8 oct 2026), lo ya publicado:
//   GET    /api/contenido/publicadas?desde=&hasta=                             → { fuente, ultimaFoto, porPieza: { id: [resultado] }, sueltas }
// C3 (8 oct 2026), llenar la semana y lo que vuelve:
//   GET    /api/contenido/llenar?desde=&dias=&redes=                           → { huecos (con lo que va en cada uno), vuelven, hora, agente }
//   POST   /api/contenido/llenar { huecos: [{ fecha, hora, que, vuelve? }], redes, pide } → copias «que vuelven» (a revisión) + una tarea a Marketing
//   GET|POST /api/contenido/plantillas · DELETE /api/contenido/plantillas/<nombre> → las plantillas (notas del Cerebro, Contenido/Plantillas)
// Cada pieza que sale de aquí lleva `salida` (lo que pasó al entregarla) cuando la cola la conoce.
// Los agentes llegan por aquí con `por: 'agente'` (contenido-mcp.mjs): pueden dejar borradores y leer, NUNCA aprobar. Eso se comprueba
// aquí y no solo en la herramienta, porque cualquier proceso de esta máquina puede llamar a la API.
import { postDePieza, revisarPublicacion } from '../src/contenido-reglas.js';
import { hashtagsUsados } from './guardados.mjs';
import { emparejar, comoEvento } from '../src/contenido-publicadas.js';
import { huecos as huecosDe, queVuelven, repartir, encargo, origenVuelve, raizDe } from '../src/contenido-llenar.js';
import { NOMBRE_RED, REDES } from './piezas.mjs';

const ID = '[a-z0-9-]+';
const DE_AGENTE = new Set(['idea', 'borrador']); // lo que un agente puede dejar: nunca «en revisión» ni «aprobada»

export function crearRutas({ almacen, json, body, notice = () => {}, ajustes = () => ({}), programador = null, metricool = null, conductorMeta = () => null, mejorHora = null, analiticasTexto = null, bandeja = null, informe = null, guardados = null, mejorar = null, publicadas = null, encargar = null, quienLlena = () => '', plantillas = null, alBorrador = () => {} }) {
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

  /** C2/C3: los resultados de lo ya publicado, por pieza (Analíticas emparejado con las piezas). */
  const resultadosDe = piezas => { const d = publicadas ? publicadas() : null; if (!d?.publicaciones?.length) return {}; return emparejar(piezas.map(x => ({ ...x, salida: programador ? programador.salidaDe(x.id) : null })), d.publicaciones).porPieza; };
  const hoyYmd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const redesDe = v => { const l = (Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x).trim()).filter(x => REDES.includes(x)); return l.length ? [...new Set(l)].slice(0, 9) : (ajustes().redes || ['instagram', 'facebook']); };
  /** C3: los huecos de esos días con su mejor hora, lo que puede volver y qué va en cada hueco. */
  async function planLlenar({ desde, dias, redes }) {
    const h = mejorHora ? await mejorHora.horas(redes).catch(() => null) : null;
    const todas = almacen.listar({});
    const hs = huecosDe({ desde, dias, piezas: todas, redes, grid: h?.grid || null });
    const vs = queVuelven({ piezas: todas, resultados: resultadosDe(todas) });
    const corta = p => ({ id: p.id, titulo: p.titulo, texto: String(p.texto || '').slice(0, 160), fecha: p.fecha, hora: p.hora, formato: p.formato, formatos: p.formatos || {}, redes: p.redes, medios: (p.medios || []).slice(0, 1), nMedios: (p.medios || []).length });
    return { desde, dias, redes, hora: { fuente: h?.fuente || 'ninguna', motivo: h?.motivo || '' }, huecos: repartir(hs, vs), vuelven: vs.map(x => ({ ...corta(x.pieza), resultado: x.resultado, ultima: x.ultima })), agente: quienLlena() || '' };
  }

  handle.planLlenar = planLlenar; handle.llenar = llenar; handle.redesDe = redesDe;
  return handle;
  /** C3: crea lo elegido de «Llenar la semana» — las copias que vuelven (a revisión) y UNA tarea a Marketing con los demás huecos.
   *  9 oct 2026: también la usan las ops de Dimitri y del asistente (serve.mjs → runOp), con el mismo plan que propone GET. */
  async function llenar(b = {}) {
    const redes = redesDe(b.redes), ahora = Date.now();
    const hs = (Array.isArray(b.huecos) ? b.huecos : []).slice(0, 14).filter(h => h && /^\d{4}-\d{2}-\d{2}$/.test(h.fecha || '') && /^\d{2}:\d{2}$/.test(h.hora || '') && ['marketing', 'vuelve'].includes(h.que));
    if (!hs.length) return { status: 400, error: 'elige al menos un hueco: un borrador nuevo de Marketing o algo que vuelve' };
    const creadas = [], errores = [], paraMk = [];
    for (const h of hs) {
      if (new Date(`${h.fecha}T${h.hora}:00`).getTime() < ahora + 10 * 60e3) { errores.push(`${h.fecha} ${h.hora}: esa hora ya pasó o está demasiado cerca`); continue; }
      if (h.que === 'marketing') { paraMk.push(h); continue; }
      const o = almacen.leer(String(h.vuelve || '')); if (!o) { errores.push(`${h.fecha}: la pieza que iba a volver ya no está`); continue; }
      const r = almacen.crear({ ...copiaDe(o), fecha: h.fecha, hora: h.hora, estado: 'revision', origen: origenVuelve(raizDe(o)) }, { por: 'dueno' }); // vuelve tal cual salió: lista para tu OK
      if (r.error) errores.push(`${h.fecha}: ${r.error}`); else creadas.push(revisado(r.pieza));
    }
    let tarea = null;
    if (paraMk.length) {
      if (!encargar) errores.push('aquí no hay agentes: los huecos de Marketing quedan sin pedir');
      else try { tarea = await encargar({ texto: encargo({ huecos: paraMk, redes, pide: b.pide, nombreRed: r => NOMBRE_RED[r] || r }), titulo: `Llenar la semana: ${paraMk.length} ${paraMk.length === 1 ? 'borrador' : 'borradores'} de Contenido` }); }
      catch (e) { errores.push('no pude pedírselo a Marketing: ' + e.message); }
    }
    return { creadas, tarea, pedidos: paraMk.length, errores };
  }

  async function handle(req, res, url) {
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
        if (deAgente && r.pieza.tarea) { try { alBorrador(revisado(r.pieza)); } catch {} } // C3: al teléfono, con su foto y sus botones (Telegram)
        if (deAgente && r.pieza.tarea) notice('contenido-borrador', `Un agente dejó un borrador en Contenido: «${r.pieza.titulo || 'sin título'}»${r.pieza.fecha ? ' para el ' + r.pieza.fecha : ''}. Revísalo y apruébalo cuando esté bien.`, { key: 'contenido-' + r.pieza.tarea });
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
        const q = url.searchParams; if (q.get('abierta') === '1') bandeja.abierta?.(); // Fase B1: con la Bandeja a la vista, Meta se lee cada 3 min
        const f = ['meta', 'metricool'].includes(q.get('fuente')) ? q.get('fuente') : '';
        return json(res, 200, bandeja.listar({ estado: q.get('estado') || '', red: q.get('red') || '', tipo: q.get('tipo') || '', fuente: f })), true;
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
      if (p === '/api/contenido/guardados' && req.method === 'GET') { // C1: los textos guardados y los hashtags que más usas
        return json(res, 200, { textos: guardados ? guardados.listar() : [], usados: hashtagsUsados(almacen.listar({ sinFecha: true })), nota: guardados ? 'Contenido/Textos guardados.md' : '' }), true;
      }
      if (p === '/api/contenido/guardados' && req.method === 'POST') {
        const b = await body(req); if (b.por === 'agente') return json(res, 403, { error: 'los textos guardados los decide el dueño' }), true;
        if (!guardados) return json(res, 404, { error: 'sin textos guardados' }), true;
        const r = guardados.guardar(b); return json(res, r.error ? 400 : 200, r.error ? { error: r.error } : { ok: true, textos: r.lista }), true;
      }
      const gd = /^\/api\/contenido\/guardados\/(.+)$/.exec(p);
      if (gd && req.method === 'DELETE') {
        const b = await body(req).catch(() => ({})); if (b?.por === 'agente') return json(res, 403, { error: 'los textos guardados los decide el dueño' }), true;
        if (!guardados) return json(res, 404, { error: 'sin textos guardados' }), true;
        const r = guardados.borrar(decodeURIComponent(gd[1])); return json(res, r.error ? 404 : 200, r.error ? { error: r.error } : { ok: true, textos: r.lista }), true;
      }
      if (p === '/api/contenido/mejorar' && req.method === 'POST') { // C1: «✨ Mejorar con Marketing» — una propuesta, nada se guarda
        const b = await body(req); if (b.por === 'agente') return json(res, 403, { error: 'esto es para el dueño: un agente mejora sus borradores con mejorar_borrador' }), true;
        if (!mejorar) return json(res, 404, { error: 'aquí no hay agentes que propongan' }), true;
        const pz = b.pieza && typeof b.pieza === 'object' ? b.pieza : {};
        if (!String(pz.texto || '').trim() && !String(pz.titulo || '').trim() && !String(pz.notas || '').trim()) return json(res, 400, { error: 'escribe algo primero (un título, unas notas o el texto): el agente parte de ahí' }), true;
        try { return json(res, 200, await mejorar({ pieza: pz, red: String(b.red || ''), pide: String(b.pide || '').slice(0, 300) })), true; }
        catch (e) { return json(res, e.status || 502, { error: 'no pude traer la propuesta: ' + e.message }), true; }
      }
      if (p === '/api/contenido/publicadas' && req.method === 'GET') { // C2: lo publicado (Analíticas) junto a la pieza de la que salió
        const q = url.searchParams, desde = q.get('desde') || '', hasta = q.get('hasta') || '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return json(res, 400, { error: 'desde y hasta van como AAAA-MM-DD' }), true;
        const d = publicadas ? publicadas() : null;
        if (!d || !d.publicaciones?.length) return json(res, 200, { fuente: d?.conectado ? 'meta' : 'ninguna', ultimaFoto: d?.ultimaFoto || null, porPieza: {}, sueltas: [] }), true;
        const dia = (f, n) => { const x = new Date(`${f}T12:00:00`); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
        const pubs = d.publicaciones.map(comoEvento).filter(x => x && x.fecha >= desde && x.fecha <= hasta);
        const piezas = almacen.listar({ desde: dia(desde, -1), hasta: dia(hasta, 1) }).map(x => ({ ...x, salida: programador ? programador.salidaDe(x.id) : null }));
        const r = emparejar(piezas, pubs);
        return json(res, 200, { fuente: 'meta', ultimaFoto: d.ultimaFoto || null, porPieza: r.porPieza, sueltas: r.sueltas.map(x => ({ id: x.id, red: x.red, tipo: x.tipo, enlace: x.enlace, texto: x.texto, miniatura: x.miniatura, publicadaAt: x.publicadaAt, fecha: x.fecha, hora: x.hora, alcance: x.alcance, interacciones: x.interacciones, meGusta: x.meGusta, comentarios: x.comentarios, vistas: x.vistas })) }), true;
      }
      if (p === '/api/contenido/plantillas' && req.method === 'GET') return json(res, 200, { plantillas: plantillas ? plantillas.listar() : [], carpeta: plantillas ? 'Contenido/Plantillas' : '' }), true; // C3
      if (p === '/api/contenido/plantillas' && req.method === 'POST') {
        const b = await body(req); if (b.por === 'agente') return json(res, 403, { error: 'las plantillas las decide el dueño' }), true;
        if (!plantillas) return json(res, 404, { error: 'sin plantillas' }), true;
        const r = plantillas.guardar({ nombre: b.nombre, pieza: b.pieza && typeof b.pieza === 'object' ? b.pieza : {} });
        return json(res, r.error ? 400 : 200, r.error ? { error: r.error } : { ok: true, plantilla: r.plantilla, reemplazada: r.reemplazada, plantillas: plantillas.listar() }), true;
      }
      const tp = /^\/api\/contenido\/plantillas\/(.+)$/.exec(p);
      if (tp && req.method === 'DELETE') {
        const b = await body(req).catch(() => ({})); if (b?.por === 'agente') return json(res, 403, { error: 'las plantillas las decide el dueño' }), true;
        if (!plantillas) return json(res, 404, { error: 'sin plantillas' }), true;
        const r = plantillas.borrar(decodeURIComponent(tp[1])); return json(res, r.error ? 404 : 200, r.error ? { error: r.error } : { ok: true, plantillas: plantillas.listar() }), true;
      }
      if (p === '/api/contenido/llenar' && req.method === 'GET') { // C3: «Llenar la semana» — lo que propone (no crea nada)
        const q = url.searchParams, desde = /^\d{4}-\d{2}-\d{2}$/.test(q.get('desde') || '') ? q.get('desde') : hoyYmd();
        return json(res, 200, await planLlenar({ desde, dias: Math.min(14, Math.max(1, parseInt(q.get('dias') || '7', 10) || 7)), redes: redesDe(q.get('redes')) })), true;
      }
      if (p === '/api/contenido/llenar' && req.method === 'POST') {
        const b = await body(req); if (b.por === 'agente') return json(res, 403, { error: 'llenar la semana es del dueño: un agente deja borradores con crear_borrador' }), true;
        const r = await llenar(b); return json(res, r.status || 200, r.error ? { error: r.error } : { ok: true, ...r }), true;
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
            if (antes && !DE_AGENTE.has(antes.estado)) return json(res, 409, { error: 'esa pieza espera el OK del dueño: no se cambia mientras la revisa. Si hay que mejorarla, díselo en tu entrega (o que te la devuelva a borrador)' }), true; // 9 oct 2026: solo ideas y borradores
            delete b.estado; delete b.aprobada;
          }
          delete b.por; delete b.agente; delete b.id; delete b.creada;
          const r = almacen.guardar(id, b);
          return r.error ? (json(res, r.nada ? 404 : 400, { error: r.error }), true) : (json(res, 200, { ok: true, pieza: revisado(r.pieza), soltada: !!r.soltada }), true);
        }
        if (!accion && req.method === 'DELETE') { const b = await body(req).catch(() => ({})); if (b?.por === 'agente') return json(res, 403, { error: 'los agentes no borran piezas: es del dueño' }), true; const r = almacen.borrar(id); return r.error ? (json(res, 404, { error: r.error }), true) : (json(res, 200, { ok: true }), true); }
        if (accion && req.method === 'POST') {
          const b = await body(req);
          if (b.por === 'agente') return json(res, 403, { error: 'los agentes no aprueban ni devuelven piezas: es del dueño' }), true;
          const r = accion === 'aprobar' ? almacen.aprobar(id, { por: String(b.quien || 'dueno').slice(0, 40), pronto: b.pronto === true }) : almacen.devolver(id, b.estado);
          return r.error ? (json(res, r.nada ? 404 : 409, { error: r.error, errores: r.errores }), true) : (json(res, 200, { ok: true, pieza: revisado(r.pieza), avisos: r.avisos || [] }), true);
        }
      }
      if (p === '/api/contenido/usos' && req.method === 'GET') return json(res, 200, { usos: almacen.usos(url.searchParams.get('medio') || '') }), true;
      return json(res, 404, { error: 'esa dirección de Contenido no existe' }), true;
    } catch (e) { return json(res, e.status || 500, { error: e.message }), true; }
  };
}
