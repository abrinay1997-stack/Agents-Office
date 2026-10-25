// Agents Office — el CONTROLADOR de las rutas de Contenido (/api/contenido/*), sin servidor ni disco: recibe una petición ya leída y devuelve
// { status, datos }. Salió de contenido/rutas.mjs (que lo envuelve para el servidor de la oficina local) para que el Worker de Cloudflare conteste
// LAS MISMAS rutas con LAS MISMAS reglas y las mismas formas de respuesta: lo que cambia es de dónde salen las piezas, la cola y Meta (`deps`).
// Todas las dependencias pueden ser síncronas (la oficina local) o promesas (D1 en el Worker): aquí se esperan las dos.
//
// NO incluye la Bandeja (/api/contenido/bandeja*) ni las rutas de Analíticas y de la conexión con Meta (rutas-analiticas.mjs): son de otras fases.
// Contrato de rutas y reglas: ver la cabecera de contenido/rutas.mjs. Los agentes llegan con `por: 'agente'`: pueden dejar borradores y leer, NUNCA
// aprobar, programar, quitar ni borrar. Eso se comprueba aquí y no solo en la herramienta, porque cualquier proceso puede llamar a la API.
import { fechasRepetidas, copiaDe, CADA, MAX_VECES } from '../src/contenido-repetir.js';
import { postDePieza, revisarPublicacion } from '../src/contenido-reglas.js';
import { hashtagsUsados } from './guardados-core.mjs';
import { emparejar, comoEvento } from '../src/contenido-publicadas.js';
import { huecos as huecosDe, queVuelven, repartir, encargo, origenVuelve, raizDe } from '../src/contenido-llenar.js';
import { NOMBRE_RED, REDES } from './piezas-core.mjs';

const ID = '[a-z0-9-]+';
const DE_AGENTE = new Set(['idea', 'borrador']); // lo que un agente puede dejar: nunca «en revisión» ni «aprobada»
const ymdLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const R = (status, datos) => ({ status, datos });

export function crearControlador({ almacen, notice = () => {}, ajustes = () => ({}), programador = null, metricool = null, conductorMeta = () => null, mejorHora = null, analiticasTexto = null, informe = null, guardados = null, mejorar = null, publicadas = null, encargar = null, quienLlena = () => '', plantillas = null, alBorrador = () => {}, cuentas = null, ahora = Date.now, segundoPlano = p => Promise.resolve(p).catch(() => {}) }) {
  // `segundoPlano(promesa)` — lo que no se espera para contestar (en el Worker: ctx.waitUntil, para que la vuelta de la cola no se corte al responder)
  const revisado = async p => { const r = revisarPublicacion(postDePieza(p), p.redes); return { ...p, revision: { errores: r.errores, avisos: r.avisos, arreglos: r.arreglos }, salida: programador ? await programador.salidaDe(p.id) : null }; };
  const todasRevisadas = async piezas => { const out = []; for (const p of piezas) out.push(await revisado(p)); return out; };
  const resumen = async () => {
    const todas = await almacen.listar({ sinFecha: true });
    const hoy = new Date(); const y = ymdLocal;
    const en7 = new Date(hoy); en7.setDate(en7.getDate() + 7);
    return {
      total: todas.length,
      revisar: todas.filter(p => p.estado === 'revision').length, // esperan el OK del dueño
      borradores: todas.filter(p => p.estado === 'borrador' || p.estado === 'idea').length,
      aprobadas: todas.filter(p => p.estado === 'aprobada').length,
      cambiadas: todas.filter(p => p.cambiadaTrasAprobar).length,
      sinFecha: todas.filter(p => !p.fecha).length,
      proximas7: todas.filter(p => p.fecha && p.fecha >= y(hoy) && p.fecha <= y(en7)).length,
      fallos: programador ? Object.values((await programador.estado()).entradas).filter(e => e.estado === 'fallo' || e.estado === 'parcial').length : 0, // M1: lo que no pudo salir
    };
  };

  /** C2/C3: los resultados de lo ya publicado, por pieza (Analíticas emparejado con las piezas). */
  const resultadosDe = async piezas => {
    const d = publicadas ? await publicadas() : null; if (!d?.publicaciones?.length) return {};
    const conSalida = []; for (const x of piezas) conSalida.push({ ...x, salida: programador ? await programador.salidaDe(x.id) : null });
    return emparejar(conSalida, d.publicaciones).porPieza;
  };
  const hoyYmd = () => ymdLocal(new Date());
  const redesDe = v => { const l = (Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x).trim()).filter(x => REDES.includes(x)); return l.length ? [...new Set(l)].slice(0, 9) : (ajustes().redes || ['instagram', 'facebook']); };
  /** C3: los huecos de esos días con su mejor hora, lo que puede volver y qué va en cada hueco. */
  async function planLlenar({ desde, dias, redes }) {
    const h = mejorHora ? await mejorHora.horas(redes).catch(() => null) : null;
    const todas = await almacen.listar({});
    const hs = huecosDe({ desde, dias, piezas: todas, redes, grid: h?.grid || null, ahora: ahora() });
    const vs = queVuelven({ piezas: todas, resultados: await resultadosDe(todas) });
    const corta = p => ({ id: p.id, titulo: p.titulo, texto: String(p.texto || '').slice(0, 160), fecha: p.fecha, hora: p.hora, formato: p.formato, formatos: p.formatos || {}, redes: p.redes, medios: (p.medios || []).slice(0, 1), nMedios: (p.medios || []).length });
    return { desde, dias, redes, hora: { fuente: h?.fuente || 'ninguna', motivo: h?.motivo || '' }, huecos: repartir(hs, vs), vuelven: vs.map(x => ({ ...corta(x.pieza), resultado: x.resultado, ultima: x.ultima })), agente: await quienLlena() || '' };
  }
  /** C3: crea lo elegido de «Llenar la semana» — las copias que vuelven (a revisión) y UNA tarea a Marketing con los demás huecos.
   *  9 oct 2026: también la usan las ops de Dimitri y del asistente (serve.mjs → runOp), con el mismo plan que propone GET. */
  async function llenar(b = {}) {
    const redes = redesDe(b.redes), t = ahora();
    const hs = (Array.isArray(b.huecos) ? b.huecos : []).slice(0, 14).filter(h => h && /^\d{4}-\d{2}-\d{2}$/.test(h.fecha || '') && /^\d{2}:\d{2}$/.test(h.hora || '') && ['marketing', 'vuelve'].includes(h.que));
    if (!hs.length) return { status: 400, error: 'elige al menos un hueco: un borrador nuevo de Marketing o algo que vuelve' };
    const creadas = [], errores = [], paraMk = [];
    for (const h of hs) {
      if (new Date(`${h.fecha}T${h.hora}:00`).getTime() < t + 10 * 60e3) { errores.push(`${h.fecha} ${h.hora}: esa hora ya pasó o está demasiado cerca`); continue; }
      if (h.que === 'marketing') { paraMk.push(h); continue; }
      const o = await almacen.leer(String(h.vuelve || '')); if (!o) { errores.push(`${h.fecha}: la pieza que iba a volver ya no está`); continue; }
      const r = await almacen.crear({ ...copiaDe(o), fecha: h.fecha, hora: h.hora, estado: 'revision', origen: origenVuelve(raizDe(o)) }, { por: 'dueno' }); // vuelve tal cual salió: lista para tu OK
      if (r.error) errores.push(`${h.fecha}: ${r.error}`); else creadas.push(await revisado(r.pieza));
    }
    let tarea = null;
    if (paraMk.length) {
      if (!encargar) errores.push('aquí no hay agentes: los huecos de Marketing quedan sin pedir');
      else try { tarea = await encargar({ texto: encargo({ huecos: paraMk, redes, pide: b.pide, nombreRed: r => NOMBRE_RED[r] || r }), titulo: `Llenar la semana: ${paraMk.length} ${paraMk.length === 1 ? 'borrador' : 'borradores'} de Contenido` }); }
      catch (e) { errores.push('no pude pedírselo a Marketing: ' + e.message); }
    }
    return { creadas, tarea, pedidos: paraMk.length, errores };
  }

  /**
   * `p` la ruta, `metodo`, `query` (URLSearchParams), `cuerpo()` → el JSON de la petición (lo lee quien lo necesita, una vez).
   * Devuelve { status, datos }; null si la ruta no es de Contenido. `fuera` = las rutas que contesta otro (la Bandeja): no se contestan 404.
   */
  async function responder({ metodo, p, query = new URLSearchParams(), cuerpo = async () => ({}) }) {
    if (p !== '/api/contenido' && !p.startsWith('/api/contenido/')) return null;
    const body = async () => (await cuerpo()) || {};
    try {
      if (p === '/api/contenido' && metodo === 'GET') {
        const q = query, f = { desde: q.get('desde') || '', hasta: q.get('hasta') || '', sinFecha: q.get('sin_fecha') === '1', estado: q.get('estado') || undefined, formato: q.get('formato') || undefined, red: q.get('red') || undefined, q: q.get('q') || '' };
        return R(200, { piezas: await todasRevisadas(await almacen.listar(f)), resumen: await resumen(), ajustes: await ajustes() });
      }
      if (p === '/api/contenido/resumen' && metodo === 'GET') return R(200, await resumen());
      // 9 oct 2026: las cuentas en que puede salir una pieza (lo que ya se sabe de Meta, sin llamarla) y las de por defecto
      if (p === '/api/contenido/cuentas' && metodo === 'GET') return R(200, cuentas ? await cuentas() : { cuentas: [], porDefecto: { facebook: '', instagram: '' }, conectada: false });
      if (p === '/api/contenido/piezas' && metodo === 'POST') {
        const b = await body(); const deAgente = b.por === 'agente';
        const datos = { ...b }; delete datos.por; delete datos.agente;
        if (deAgente) { datos.origen = `agente:${b.agente || '?'}`; if (!DE_AGENTE.has(datos.estado)) datos.estado = 'borrador'; }
        const r = await almacen.crear(datos, { por: deAgente ? 'agente' : 'dueno' });
        if (r.error) return R(400, { error: r.error });
        if (deAgente && r.pieza.tarea) { try { alBorrador(await revisado(r.pieza)); } catch { /* el aviso al teléfono no frena el borrador */ } } // C3: al teléfono, con su foto y sus botones (Telegram)
        if (deAgente && r.pieza.tarea) notice('contenido-borrador', `Un agente dejó un borrador en Contenido: «${r.pieza.titulo || 'sin título'}»${r.pieza.fecha ? ' para el ' + r.pieza.fecha : ''}. Revísalo y apruébalo cuando esté bien.`, { key: 'contenido-' + r.pieza.tarea });
        return R(200, { ok: true, pieza: await revisado(r.pieza) });
      }
      if (p === '/api/contenido/informe' && (metodo === 'GET' || metodo === 'POST')) { // plan M5 · U10: el informe del mes; POST lo guarda en el Cerebro
        if (!informe) return R(404, { error: 'sin informe' });
        const b = metodo === 'POST' ? await body() : {}, mes = String(b.mes || query.get('mes') || new Date().toISOString().slice(0, 7));
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return R(400, { error: 'el mes va como AAAA-MM' }); // (un mes 13 era un 500: ahora se dice)
        const cuenta = String(b.cuenta || query.get('cuenta') || ''); // 9 oct 2026: el informe de una cuenta sola (su id de Analíticas)
        if (cuenta && !/^(instagram|facebook):[\w.-]{1,80}$/.test(cuenta)) return R(400, { error: 'la cuenta va como instagram:<id> o facebook:<id>' });
        return R(200, await informe(mes, { guardar: metodo === 'POST', cuenta }));
      }
      if (p === '/api/contenido/mejor-hora' && metodo === 'GET') { // plan M3: la tabla 7 × 24 de las redes pedidas y de dónde sale
        if (!mejorHora) return R(200, { fuente: 'ninguna', grid: null, motivo: 'sin fuente' });
        const redes = (query.get('redes') || 'instagram').split(',').map(x => x.trim()).filter(Boolean).slice(0, 9);
        return R(200, await mejorHora.horas(redes));
      }
      if (p === '/api/contenido/analiticas/resumen' && metodo === 'GET') { // plan M3: Analíticas en palabras, para los agentes
        if (!analiticasTexto) return R(200, { texto: 'Analíticas no está disponible aquí.' });
        const dias = Math.min(90, Math.max(7, parseInt(query.get('dias') || '30', 10) || 30));
        const redes = (query.get('redes') || ((await ajustes()).redes || ['instagram', 'facebook']).join(',')).split(',').filter(Boolean).slice(0, 9);
        return R(200, await analiticasTexto(dias, redes, String(query.get('cuenta') || '').slice(0, 120))); // 9 oct 2026: `cuenta` (id, @usuario o nombre) → solo esa
      }
      if (p === '/api/contenido/guardados' && metodo === 'GET') { // C1: los textos guardados y los hashtags que más usas
        return R(200, { textos: guardados ? await guardados.listar() : [], usados: hashtagsUsados(await almacen.listar({ sinFecha: true })), nota: guardados ? 'Contenido/Textos guardados.md' : '' });
      }
      if (p === '/api/contenido/guardados' && metodo === 'POST') {
        const b = await body(); if (b.por === 'agente') return R(403, { error: 'los textos guardados los decide el dueño' });
        if (!guardados) return R(404, { error: 'sin textos guardados' });
        const r = await guardados.guardar(b); return R(r.error ? 400 : 200, r.error ? { error: r.error } : { ok: true, textos: r.lista });
      }
      const gd = /^\/api\/contenido\/guardados\/(.+)$/.exec(p);
      if (gd && metodo === 'DELETE') {
        const b = await cuerpo().catch(() => ({})); if (b?.por === 'agente') return R(403, { error: 'los textos guardados los decide el dueño' });
        if (!guardados) return R(404, { error: 'sin textos guardados' });
        const r = await guardados.borrar(decodeURIComponent(gd[1])); return R(r.error ? 404 : 200, r.error ? { error: r.error } : { ok: true, textos: r.lista });
      }
      if (p === '/api/contenido/mejorar' && metodo === 'POST') { // C1: «✨ Mejorar con Marketing» — una propuesta, nada se guarda
        const b = await body(); if (b.por === 'agente') return R(403, { error: 'esto es para el dueño: un agente mejora sus borradores con mejorar_borrador' });
        if (!mejorar) return R(404, { error: 'aquí no hay agentes que propongan' });
        const pz = b.pieza && typeof b.pieza === 'object' ? b.pieza : {};
        if (!String(pz.texto || '').trim() && !String(pz.titulo || '').trim() && !String(pz.notas || '').trim()) return R(400, { error: 'escribe algo primero (un título, unas notas o el texto): el agente parte de ahí' });
        try { return R(200, await mejorar({ pieza: pz, red: String(b.red || ''), pide: String(b.pide || '').slice(0, 300) })); }
        catch (e) { return R(e.status || 502, { error: 'no pude traer la propuesta: ' + e.message }); }
      }
      if (p === '/api/contenido/publicadas' && metodo === 'GET') { // C2: lo publicado (Analíticas) junto a la pieza de la que salió
        const desde = query.get('desde') || '', hasta = query.get('hasta') || '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return R(400, { error: 'desde y hasta van como AAAA-MM-DD' });
        const d = publicadas ? await publicadas() : null;
        if (!d || !d.publicaciones?.length) return R(200, { fuente: d?.conectado ? 'meta' : 'ninguna', ultimaFoto: d?.ultimaFoto || null, porPieza: {}, sueltas: [] });
        const dia = (f, n) => { const x = new Date(`${f}T12:00:00`); x.setDate(x.getDate() + n); return ymdLocal(x); };
        const pubs = d.publicaciones.map(comoEvento).filter(x => x && x.fecha >= desde && x.fecha <= hasta);
        const piezas = []; for (const x of await almacen.listar({ desde: dia(desde, -1), hasta: dia(hasta, 1) })) piezas.push({ ...x, salida: programador ? await programador.salidaDe(x.id) : null });
        const r = emparejar(piezas, pubs);
        return R(200, { fuente: 'meta', ultimaFoto: d.ultimaFoto || null, porPieza: r.porPieza, sueltas: r.sueltas.map(x => ({ id: x.id, red: x.red, tipo: x.tipo, enlace: x.enlace, texto: x.texto, miniatura: x.miniatura, publicadaAt: x.publicadaAt, fecha: x.fecha, hora: x.hora, alcance: x.alcance, interacciones: x.interacciones, meGusta: x.meGusta, comentarios: x.comentarios, vistas: x.vistas })) });
      }
      if (p === '/api/contenido/plantillas' && metodo === 'GET') return R(200, { plantillas: plantillas ? await plantillas.listar() : [], carpeta: plantillas ? 'Contenido/Plantillas' : '' }); // C3
      if (p === '/api/contenido/plantillas' && metodo === 'POST') {
        const b = await body(); if (b.por === 'agente') return R(403, { error: 'las plantillas las decide el dueño' });
        if (!plantillas) return R(404, { error: 'sin plantillas' });
        const r = await plantillas.guardar({ nombre: b.nombre, pieza: b.pieza && typeof b.pieza === 'object' ? b.pieza : {} });
        return R(r.error ? 400 : 200, r.error ? { error: r.error } : { ok: true, plantilla: r.plantilla, reemplazada: r.reemplazada, plantillas: await plantillas.listar() });
      }
      const tp = /^\/api\/contenido\/plantillas\/(.+)$/.exec(p);
      if (tp && metodo === 'DELETE') {
        const b = await cuerpo().catch(() => ({})); if (b?.por === 'agente') return R(403, { error: 'las plantillas las decide el dueño' });
        if (!plantillas) return R(404, { error: 'sin plantillas' });
        const r = await plantillas.borrar(decodeURIComponent(tp[1])); return R(r.error ? 404 : 200, r.error ? { error: r.error } : { ok: true, plantillas: await plantillas.listar() });
      }
      if (p === '/api/contenido/llenar' && metodo === 'GET') { // C3: «Llenar la semana» — lo que propone (no crea nada)
        const q = query, desde = /^\d{4}-\d{2}-\d{2}$/.test(q.get('desde') || '') ? q.get('desde') : hoyYmd();
        return R(200, await planLlenar({ desde, dias: Math.min(14, Math.max(1, parseInt(q.get('dias') || '7', 10) || 7)), redes: redesDe(q.get('redes')) }));
      }
      if (p === '/api/contenido/llenar' && metodo === 'POST') {
        const b = await body(); if (b.por === 'agente') return R(403, { error: 'llenar la semana es del dueño: un agente deja borradores con crear_borrador' });
        const r = await llenar(b); return R(r.status || 200, r.error ? { error: r.error } : { ok: true, ...r });
      }
      if (p === '/api/contenido/cola' && metodo === 'GET') return R(200, programador ? await programador.estado() : { modo: 'apagado', entradas: {} });
      if (p === '/api/contenido/cola/tick' && metodo === 'POST') { if (!programador) return R(404, { error: 'sin cola' }); const u = await programador.tick(); return R(200, { ok: true, ultimo: u, ...(await programador.estado()) }); }
      if (p === '/api/contenido/conductor/comprobar' && metodo === 'POST') {
        const cm = await conductorMeta(); // F3: con Meta directo elegido, se comprueba Meta (sin publicar nada)
        if (cm) { try { const r = await cm.comprobar(); if (programador) segundoPlano(programador.tick()); return R(200, r); } catch (e) { return R(200, { ok: false, error: e.message }); } }
        if (!metricool || !metricool.configurado()) return R(200, { ok: false, error: 'Faltan METRICOOL_USER_TOKEN y METRICOOL_USER_ID: ponlas como variables de Windows (Metricool → Ajustes de la cuenta → API; es del plan Advanced) y reinicia la oficina.' });
        try { const marcas = await metricool.marcas({ fresco: true }), marca = await metricool.marca(); return R(200, { ok: true, marca, marcas }); }
        catch (e) { return R(200, { ok: false, error: e.message }); }
      }
      const rp = new RegExp(`^/api/contenido/piezas/(${ID})/repetir$`).exec(p); // plan M5 · U7: copias como borradores, en los días que tocan
      if (rp && metodo === 'POST') {
        const b = await body(); if (b.por === 'agente') return R(403, { error: 'repetir piezas es del dueño' });
        const pz = await almacen.leer(rp[1]); if (!pz) return R(404, { error: 'esa pieza ya no existe' });
        if (!pz.fecha) return R(409, { error: 'ponle un día antes de repetirla: las copias se cuentan desde ese día' });
        const fechas = fechasRepetidas(pz.fecha, b.cada, b.veces); if (!fechas.length) return R(400, { error: `di cada cuánto (${Object.keys(CADA).join(', ')}) y cuántas veces (1 a ${MAX_VECES})` });
        const creadas = [];
        for (const f of fechas) { const r = await almacen.crear({ ...copiaDe(pz), fecha: f, estado: 'borrador', origen: 'repetida' }, { por: 'dueno' }); if (r.pieza) creadas.push(await revisado(r.pieza)); }
        return R(200, { ok: true, creadas });
      }
      const mc = new RegExp(`^/api/contenido/piezas/(${ID})/(reintentar|entregar|quitar)$`).exec(p);
      if (mc && metodo === 'POST') {
        const b = await body(); if (b.por === 'agente') return R(403, { error: 'los agentes no programan ni quitan piezas de la cola: es del dueño' });
        if (!programador) return R(404, { error: 'sin cola' });
        const r = mc[2] === 'reintentar' ? await programador.reintentar(mc[1]) : mc[2] === 'entregar' ? await programador.entregarYa(mc[1]) : await programador.cancelar(mc[1]);
        if (r.error) return R(409, { error: r.error });
        segundoPlano(programador.tick());
        const pz = await almacen.leer(mc[1]); return R(200, { ok: true, pieza: pz ? await revisado(pz) : null });
      }
      const m = new RegExp(`^/api/contenido/piezas/(${ID})(?:/(aprobar|devolver))?$`).exec(p);
      if (m) {
        const id = m[1], accion = m[2];
        if (!accion && metodo === 'GET') { const pz = await almacen.leer(id); return pz ? R(200, { pieza: await revisado(pz) }) : R(404, { error: 'esa pieza ya no existe' }); }
        if (!accion && metodo === 'PATCH') {
          const b = await body();
          if (b.por === 'agente') { // un agente mejora sus borradores; lo que el dueño ya aprobó solo lo cambia el dueño
            const antes = await almacen.leer(id); if (antes && antes.estado === 'aprobada') return R(409, { error: 'esa pieza ya está aprobada: solo el dueño la cambia' });
            if (antes && !DE_AGENTE.has(antes.estado)) return R(409, { error: 'esa pieza espera el OK del dueño: no se cambia mientras la revisa. Si hay que mejorarla, díselo en tu entrega (o que te la devuelva a borrador)' }); // 9 oct 2026: solo ideas y borradores
            delete b.estado; delete b.aprobada;
          }
          delete b.por; delete b.agente; delete b.id; delete b.creada;
          const r = await almacen.guardar(id, b);
          return r.error ? R(r.nada ? 404 : 400, { error: r.error }) : R(200, { ok: true, pieza: await revisado(r.pieza), soltada: !!r.soltada });
        }
        if (!accion && metodo === 'DELETE') { const b = await cuerpo().catch(() => ({})); if (b?.por === 'agente') return R(403, { error: 'los agentes no borran piezas: es del dueño' }); const r = await almacen.borrar(id); return r.error ? R(404, { error: r.error }) : R(200, { ok: true }); }
        if (accion && metodo === 'POST') {
          const b = await body();
          if (b.por === 'agente') return R(403, { error: 'los agentes no aprueban ni devuelven piezas: es del dueño' });
          const r = accion === 'aprobar' ? await almacen.aprobar(id, { por: String(b.quien || 'dueno').slice(0, 40), pronto: b.pronto === true }) : await almacen.devolver(id, b.estado);
          return r.error ? R(r.nada ? 404 : 409, { error: r.error, errores: r.errores }) : R(200, { ok: true, pieza: await revisado(r.pieza), avisos: r.avisos || [] });
        }
      }
      if (p === '/api/contenido/usos' && metodo === 'GET') return R(200, { usos: await almacen.usos(query.get('medio') || '') });
      return R(404, { error: 'esa dirección de Contenido no existe' });
    } catch (e) { return R(e.status || 500, { error: e.message }); }
  }

  return { responder, planLlenar, llenar, redesDe, revisado, resumen };
}
