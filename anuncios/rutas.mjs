// Agents Office — Anuncios de Meta, Fase A1 (8 oct 2026): las rutas del panel; desde A2 (9 oct 2026), también los cambios. Un solo import en serve.mjs.
//   GET  /api/anuncios?rango=hoy|7d|30d|mes&abierto=1   → la vista entera (el contrato de abajo). `abierto=1`: el panel está a la vista,
//                                                         y la estructura se lee cada 15 min en vez de cada 60.
//   POST /api/anuncios/sincronizar                      → 202 { ok } (arranca, no espera) · 409 si ya hay una lectura en marcha
//   GET  /api/anuncios/historial                        → { items: [{ at, quien, que, objeto, antes, despues, propuso? }] } (lo más nuevo primero)
//   POST /api/anuncios/accion { tipo, id, valor?, fin?, inicio?, copiar?, confirmacion?, por?, sub? }   (Fase A2, 9 oct 2026: anuncios/acciones.mjs)
//        libres (pausar · bajar_presupuesto · archivar) → 200 { ok, hecho: { tipo, id, antes, despues, texto, objeto }, deshacer: { token, hasta } | null, aviso? }
//        de gasto (activar · reanudar · subir_presupuesto · alargar · relanzar), SIN confirmacion → nada cambia →
//             200 { confirmar: { token, texto, cifras: { dia, semana, mes, campana }, vence, tipo, id, valor?, fin?, objeto }, aviso? }
//             · 409 { error: 'tope', motivo, cual, tope, quedaria, cifras } · 422 { error: 'meta', motivo, minimo? }
//        de gasto CON confirmacion (solo el dueño) → 200 { ok, hecho, aviso? } · 409 { error: 'confirmacion', motivo }
//        otros: 400 { error } (falta algo) · 404 { error } (ese id no está) · 409 { error: 'estado'|'conexion', motivo } · 403 { error } (quién)
//        `sub: { msg, k }` (la tarjeta de Dimitri): al hacerse, su tarjeta queda hecha (serve.mjs, `alHacer`).
//   POST /api/anuncios/deshacer { token, por? }         → 200 { ok, hecho } · 409 { error: 'deshacer'|'tope', motivo } · 403 (no es el dueño)
//   GET  /api/anuncios/texto?rango=&que=cuenta|campanas|resultados&nivel=&estado=   → { texto } (Dimitri, los agentes, el asistente)
//   GET  /api/anuncios/objeto/<id>?rango=               → { tipo, objeto, texto } (una campaña, un conjunto o un anuncio)
//
// QUIÉN: un agente (`por: 'agente'`, en la dirección o en el cuerpo, como en contenido/rutas.mjs) LEE lo mismo que el dueño. De los POST
// solo puede `sincronizar` (leer de Meta no cambia nada allá), y como mucho una vez cada 10 minutos: la cuota de Meta es del negocio
// entero. Cualquier otro POST de /api/anuncios le da 403 — también `accion` y `deshacer` (A2). Lo demás de quién puede qué (Dimitri, el
// asistente, los dos clics del dinero) lo decide anuncios/acciones.mjs.
//
// EL CONTRATO de GET /api/anuncios (la página lo usa; solo se AÑADEN campos):
//   { configurado, motivo, ejemplo: false, cuenta: { id, nombre, estado, estadoTexto, moneda, zona, gastado, spendCap, saldo } | null,
//     topes: { diario, mensual, campana }, gasto: { hoy, semana, mes }, avisos: [{ nivel, texto }],
//     resumen: { resultados7d, costoPorResultado7d, resultadoTexto, tendencia: { gasto, resultados } },
//     campanas: [{ id, nombre, objetivo, objetivoTexto, estado, estadoTexto, creadoFuera, presupuesto: { tipo, usd }, spendCap, estrategia,
//       inicio, fin, resultado, cifras, conjuntos: [{ id, nombre, creadoFuera, optimizacion, destino, estado, estadoTexto,
//       aprendizaje: { estado, texto, conversiones }, presupuesto, publico, inicio, fin, problemas, cifras,
//       anuncios: [{ id, nombre, creadoFuera, estado, estadoTexto, revision, problemas, creativo: { id, miniatura, texto, titulo, llamada }, cifras }] }] }],
//     rango, desde, hasta, sincronizadaAt, cifrasAt, sondeoAt, sincronizando, error, uso, sondeo }
//   CIFRAS = { gasto, impresiones, alcance, frecuencia, clics, clicsEnlace, ctr, cpc, cpm, resultados, resultadoTexto, costoPorResultado,
//              costoPor: 'resultado'|'mil' } — en la moneda de la cuenta y números; null cuando no se sabe, nunca inventado.
// Ninguna respuesta lleva un token: lo de Meta pasa por mensajeMeta (que ya los quita) y `uso` es solo porcentajes y horas.
//
// Fase A3 (9 oct 2026): LOS BORRADORES DE CAMPAÑA (anuncios/borradores.mjs, anuncios/crear.mjs). El contrato con la página:
//   GET    /api/anuncios/borradores                       → { items: [borrador] } (lo más nuevo primero; la forma, en anuncios/modelo.mjs)
//   GET    /api/anuncios/borradores/<id>                  → { borrador }
//   POST   /api/anuncios/borradores { …campos, por?, agente? } → { borrador } con los valores por defecto puestos.
//          El dueño (de: 'dueno'), Dimitri (por: 'dimitri'), el asistente (por: 'asistente') y un agente (por: 'agente', agente: '<id>'
//          → de: 'agente:<id>'; sin su id, 403; como mucho MAX_AGENTE borradores abiertos por agente → 429).
//   PATCH  /api/anuncios/borradores/<id> { …campos }      → { borrador } · un agente solo los suyos y en «borrador» (403/409) · nadie uno
//          «creado» o «creando» (409) · el asistente no (403: solo crea, con la op anuncio_borrador)
//   DELETE /api/anuncios/borradores/<id>                  → { ok } (solo el dueño; va a data/anuncios/papelera.json)
//   POST   /api/anuncios/borradores/<id>/validar          → { borrador } con `validacion` (no crea nada; dueño y Dimitri)
//   POST   /api/anuncios/borradores/<id>/crear            → 202 { ok } y el borrador pasa a «creando» (la página sondea la lista).
//          SOLO el dueño (agente, asistente, Dimitri → 403) · 422 { error: 'validacion', problemas } · 409 { error: 'estado'|'conexion', motivo }
//   GET    /api/anuncios/borradores/<id>/vista-previa?formato=MOBILE_FEED_STANDARD|INSTAGRAM_STANDARD|INSTAGRAM_STORY&creativo=
//          → { html, formato, creativo } (generatepreviews de Meta) · 409 { error, motivo } si Meta no está · un agente: 403
//   POST   /api/anuncios/borradores/<id>/mejorar { creativo, campo: 'texto'|'titular', pide? } → { texto, porque, agente } (solo el dueño;
//          lo escribe `ada`, sin herramientas, sin guardar nada; su costo va a data/costs.jsonl como kind 'anuncios')
//
// Fase A5 (9 oct 2026): LAS SUGERENCIAS (anuncios/diagnostico.mjs → anuncios/sugerencias.mjs). El contrato con la página:
//   GET  /api/anuncios/sugerencias → { items: [sugerencia + { estado: 'viva'|'pospuesta'|'descartada'|'aplicada', creadaAt, aplicadaAt?,
//          resultado? }], cpaObjetivo: número|null, sinObjetivo: string|null, notas: [{ regla, objeto?, texto }], at }
//        sugerencia = { id, regla, objeto: { id, nivel, nombre }, dato, porque, cambio: { tipo, id, valor? }, efecto,
//          riesgo: { reiniciaAprendizaje, gastaMas, texto }, prioridad: 1..3, gasto, origen: 'diagnostico'|'agente' }
//        (lo aplicado lleva un id propio `<id>~<marca>`, `sugerencia` con el de origen, `aplicadaPor` y `hecho`).
//   POST /api/anuncios/sugerencias/<id>/aplicar { por? } → un cambio de la A2, por anuncios/acciones.mjs con sus reglas:
//          baja el gasto → 200 { ok, hecho, deshacer, sugerencia } · gasta → 200 { confirmar, sugerencia: <id> } y NADA cambia: el segundo clic
//          es /api/anuncios/accion con `confirmacion` (y, si se quiere, `sugerencia: <id>`), y entonces queda aplicada ·
//          borrador / creativos → 200 { ok, hecho: { tarea, borrador? }, sugerencia } (una tarea para el agente de anuncios) ·
//          revisar → 200 { ok, hecho } (marcada hecha) · impulsar → 200 { ok, hecho, borrador, sugerencia } (Fase A4: el borrador con esa
//          publicación, revisado) · 403 un agente; el asistente solo lo que baja el gasto.
//   POST /api/anuncios/sugerencias/<id>/descartar         → 200 { ok, sugerencia } (no vuelve en 7 días) · dueño y Dimitri
//   POST /api/anuncios/sugerencias/<id>/posponer { dias } → 200 { ok, sugerencia } (vuelve a los 3 días, o `dias`) · dueño y Dimitri
//   POST /api/anuncios/creativos/<id anuncio>/variaciones { pide? } → 200 { ok, hecho: { texto, tarea }, tarea } (solo el dueño: una tarea
//          para el agente de anuncios, que propone y NO genera imágenes; las genera el dueño en el Estudio con su costo a la vista)
//   Las pospuestas llevan `hasta` (ISO); `umbrales` en el GET son los valores de umbrales.json con sus mismos nombres (fracciones como fracción).
//   POST /api/anuncios/sugerencias { por: 'agente', agente, tarea?, id, regla, tipo, valor?, dato, porque, efecto } → { sugerencia }
//          (sugerir_mejora_anuncio de anuncios-mcp.mjs: la deja; nunca la aplica)
//
// Fase A4 (9 oct 2026): IMPULSAR lo que ya salió (anuncios/impulsar.mjs; el contrato entero, allí):
//   POST /api/anuncios/impulsar { pieza?, red?, id?, por?, agente? } → 200 { borrador (con `origen`), ya? } · 400 · 403 · 404 · 409 · 429.
//          Nace BORRADOR (también de un agente: de 'agente:<id>'); crearlo en Meta, en pausa, es el clic del dueño; activarlo, sus dos clics.
import { RANGOS, buscar, textoCuenta, textoCampanas, textoObjeto, ErrorBorrador } from './modelo.mjs';
import { quienDe } from './acciones.mjs';

export const AGENTE_CADA_MIN = 10;
export const MAX_AGENTE = 20; // borradores abiertos (en «borrador») por agente

export function crearRutasAnuncios({ sync, meta, json, body, acciones = null, alHacer = () => {}, ahora = () => Date.now(), borradores = null, creador = null, mejorar = null, sugerencias = null, aplicador = null, impulsor = null }) {
  let agenteAt = 0;
  const rangoDe = url => (RANGOS.includes(url.searchParams.get('rango')) ? url.searchParams.get('rango') : '7d');

  /** Fase A3: /api/anuncios/borradores[/<id>[/validar|crear|vista-previa|mejorar]]. */
  async function rutaBorradores(req, res, url, id, sub) {
    const M = req.method;
    const b = M === 'GET' ? {} : await body(req).catch(() => ({}));
    const quien = quienDe(b?.por ?? url.searchParams.get('por') ?? undefined), agente = String(b?.agente ?? url.searchParams.get('agente') ?? '').trim();
    const deAgente = quien === 'agente';
    const no = (code, error, extra = {}) => json(res, code, { error, motivo: error, ...extra }); // siempre con «motivo» en palabras (la página lo enseña)
    if (quien === 'otro') return no(403, 'quién pide no se reconoce');
    if (!id) {
      if (M === 'GET') return json(res, 200, { items: borradores.lista() });
      if (M !== 'POST') return no(405, 'método no admitido');
      if (deAgente && !/^[A-Za-z0-9_-]{1,30}$/.test(agente)) return no(403, 'un agente deja borradores con su id (agente)');
      if (deAgente && borradores.lista().filter(x => x.de === `agente:${agente}` && x.estado === 'borrador').length >= MAX_AGENTE) return no(429, `ya tienes ${MAX_AGENTE} borradores sin crear: mejora uno de los tuyos en vez de hacer otro`);
      const { por: _p, agente: _a, ...campos } = b || {};
      const de = deAgente ? `agente:${agente}` : quien;
      return json(res, 200, { borrador: borradores.crear(campos, { de }) });
    }
    const actual = borradores.leer(id);
    if (!actual) return no(404, 'ese borrador no existe (¿se quitó?)');
    if (!sub) {
      if (M === 'GET') return json(res, 200, { borrador: actual });
      if (M === 'PATCH') {
        if (quien === 'asistente') return no(403, 'el asistente deja borradores nuevos; cambiarlos es del dueño (o de Dimitri con su clic)');
        const { por: _p, agente: _a, ...campos } = b || {};
        return json(res, 200, { borrador: borradores.cambiar(id, campos, { quien, agente }) });
      }
      if (M === 'DELETE') {
        if (quien !== 'dueno') return no(403, 'quitar un borrador lo hace el dueño');
        borradores.quitar(id, { por: 'dueno' }); return json(res, 200, { ok: true });
      }
      return no(405, 'método no admitido');
    }
    if (sub === 'vista-previa') {
      if (M !== 'GET') return no(405, 'método no admitido');
      if (deAgente) return no(403, 'la vista previa de Meta la pide el dueño en Anuncios');
      if (!creador) return no(409, 'la vista previa de Meta no está disponible', { motivo: 'sin creador' });
      const r = await creador.vistaPrevia(id, { formato: url.searchParams.get('formato') || 'MOBILE_FEED_STANDARD', creativo: url.searchParams.get('creativo') || null });
      return json(res, r.status, r.cuerpo);
    }
    if (M !== 'POST') return no(405, 'método no admitido');
    if (sub === 'validar') {
      if (quien !== 'dueno' && quien !== 'dimitri') return no(403, 'validar con Meta lo pide el dueño en Anuncios');
      const r = await creador.validar(id); return json(res, r.status, r.cuerpo);
    }
    if (sub === 'crear') { const r = await creador.crear(id, { quien }); return json(res, r.status, r.cuerpo); }
    if (sub === 'mejorar') {
      if (quien !== 'dueno') return no(403, '«Mejorar con el agente de anuncios» lo pide el dueño (gasta en el modelo)');
      if (!mejorar) return no(409, 'no hay quién lo mejore ahora');
      const c = (actual.creativos || []).find(x => x.id === String(b?.creativo || ''));
      if (!c) return no(404, 'ese creativo no está en el borrador');
      const campo = b?.campo === 'titular' ? 'titular' : b?.campo === 'texto' || !b?.campo ? 'texto' : null;
      if (!campo) return no(400, 'el campo es «texto» o «titular»');
      try { return json(res, 200, await mejorar({ borrador: actual, creativo: c, campo, pide: String(b?.pide || '').slice(0, 300) })); }
      catch (e) { return no(e.status || 502, 'no pude mejorarlo ahora: ' + e.message); }
    }
    return no(404, 'esa acción de un borrador no existe (validar, crear, vista-previa, mejorar)');
  }

  /** Fase A5: /api/anuncios/sugerencias[/<id>/aplicar|descartar|posponer]. */
  async function rutaSugerencias(req, res, url, id, sub) {
    if (!id) {
      if (req.method === 'GET') return json(res, 200, { items: sugerencias.lista(), ...sugerencias.estado() });
      if (req.method !== 'POST') return json(res, 405, { error: 'método no admitido' });
      const b = await body(req).catch(() => ({}));
      const r = aplicador.crear({ ...b, por: b?.por ?? url.searchParams.get('por') ?? undefined }); return json(res, r.status, r.cuerpo);
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'método no admitido' });
    const b = await body(req).catch(() => ({})), pedido = { ...b, por: b?.por ?? url.searchParams.get('por') ?? undefined };
    const r = sub === 'aplicar' ? await aplicador.aplicar(id, pedido) : sub === 'descartar' ? aplicador.descartar(id, pedido) : aplicador.posponer(id, pedido);
    return json(res, r.status, r.cuerpo);
  }

  /** La vista con lo de la conexión: lo que contesta GET /api/anuncios. */
  function completa(rango = '7d') {
    const c = sync.conexion(), v = sync.vista(rango);
    return { configurado: c.configurado, motivo: c.motivo, ejemplo: false, ...v, topes: sync.topes(), sincronizadaAt: c.sincronizadaAt, cifrasAt: c.cifrasAt, sondeoAt: c.sondeoAt, sincronizando: c.sincronizando, error: c.error, uso: meta.uso(), sondeo: sync.sondeo() };
  }

  async function handle(req, res, url) {
    const p = url.pathname;
    if (p !== '/api/anuncios' && !p.startsWith('/api/anuncios/')) return false;
    try {
      const mv = /^\/api\/anuncios\/creativos\/([A-Za-z0-9_]{1,40})\/variaciones$/.exec(p);
      if (mv && aplicador) { // A5: pedir variaciones de un creativo sin sugerencia (solo el dueño: una tarea para el agente de anuncios)
        if (req.method !== 'POST') return json(res, 405, { error: 'método no admitido' }), true;
        const b = await body(req).catch(() => ({})), r = await aplicador.variaciones(mv[1], { ...b, por: b?.por ?? url.searchParams.get('por') ?? undefined });
        return json(res, r.status, r.cuerpo), true;
      }
      const ms = /^\/api\/anuncios\/sugerencias(?:\/([A-Za-z0-9_~-]{1,90})\/(aplicar|descartar|posponer))?$/.exec(p);
      if (ms && sugerencias && aplicador) return await rutaSugerencias(req, res, url, ms[1] || null, ms[2] || null), true;
      if (p === '/api/anuncios/impulsar' && impulsor) { // A4: también un agente (nace borrador)
        if (req.method !== 'POST') return json(res, 405, { error: 'método no admitido' }), true;
        const b = await body(req).catch(() => ({})), r = await impulsor.impulsar({ ...b, por: b?.por ?? url.searchParams.get('por') ?? undefined, agente: b?.agente ?? url.searchParams.get('agente') ?? undefined });
        return json(res, r.status, r.cuerpo), true;
      }
      const mb = /^\/api\/anuncios\/borradores(?:\/([A-Za-z0-9_-]{1,60})(?:\/(validar|crear|vista-previa|mejorar))?)?$/.exec(p);
      if (mb && borradores) return await rutaBorradores(req, res, url, mb[1] || null, mb[2] || null), true;
      if (req.method === 'GET') {
        if (p === '/api/anuncios') {
          if (url.searchParams.get('abierto') === '1' && url.searchParams.get('por') !== 'agente') sync.abierto();
          return json(res, 200, completa(rangoDe(url))), true;
        }
        if (p === '/api/anuncios/historial') return json(res, 200, { items: sync.historial() }), true;
        if (p === '/api/anuncios/texto') {
          const v = completa(rangoDe(url)), que = url.searchParams.get('que') || 'cuenta';
          if (!v.configurado && !v.cuenta) return json(res, 200, { texto: `Anuncios: ${v.motivo}`, configurado: false }), true;
          const texto = que === 'campanas' || que === 'resultados' ? textoCampanas(v, { nivel: url.searchParams.get('nivel') || (que === 'resultados' ? 'anuncio' : 'conjunto'), estado: url.searchParams.get('estado') || 'todas' }) : textoCuenta(v, { topes: v.topes });
          return json(res, 200, { texto: `${texto}${v.sincronizadaAt ? `\n(Leído de Meta: estructura ${v.sincronizadaAt}${v.cifrasAt ? `, cifras ${v.cifrasAt}` : ', cifras todavía no'})` : '\n(Todavía no se ha leído de Meta.)'}${v.error ? `\nÚltimo error al leer: ${v.error}` : ''}`, configurado: v.configurado }), true;
        }
        const m = /^\/api\/anuncios\/objeto\/([A-Za-z0-9_]{1,40})$/.exec(p);
        if (m) {
          const v = completa(rangoDe(url)), r = buscar(v, m[1]);
          if (!r) return json(res, 404, { error: `no hay ninguna campaña, conjunto ni anuncio con el id ${m[1]} (¿se leyó ya de Meta?)` }), true;
          return json(res, 200, { tipo: r.tipo, objeto: r.objeto, texto: textoObjeto(v, m[1]) }), true;
        }
        return json(res, 404, { error: 'no existe' }), true;
      }
      if (req.method === 'POST') {
        const b = await body(req).catch(() => ({}));
        const deAgente = b?.por === 'agente' || url.searchParams.get('por') === 'agente';
        if (p === '/api/anuncios/sincronizar') {
          const l = sync.listo(); if (!l.ok) return json(res, 409, { error: l.motivo }), true;
          if (sync.enMarcha()) return json(res, 409, { error: 'ya se está leyendo de Meta: espera a que termine' }), true;
          if (deAgente) {
            if (ahora() - agenteAt < AGENTE_CADA_MIN * 60e3) return json(res, 429, { error: `un agente puede pedir leer de Meta una vez cada ${AGENTE_CADA_MIN} minutos (la cuota es del negocio entero): usa lo ya leído` }), true;
            agenteAt = ahora();
          }
          sync.sincronizar({ cifras: true }).catch(() => {}); // no se espera: son varias llamadas a Meta; la página pregunta por `sincronizando`
          return json(res, 202, { ok: true }), true;
        }
        if (deAgente) return json(res, 403, { error: 'los agentes leen los anuncios y dejan sugerencias; cambiar algo en Meta es del dueño' }), true;
        if (acciones && p === '/api/anuncios/accion') {
          const r = await acciones.accion({ ...b, por: b?.por ?? url.searchParams.get('por') ?? undefined });
          if (r.status === 200 && r.cuerpo.ok && (b?.sub || b?.confirmacion)) { try { alHacer({ sub: b.sub, confirmacion: b.confirmacion, hecho: r.cuerpo.hecho, aviso: r.cuerpo.aviso }); } catch { /* la tarjeta se queda como estaba */ } }
          // A5: la sugerencia de la que salió este gasto (por su token, o `sugerencia: <id>`) queda aplicada con el segundo clic
          if (sugerencias && r.status === 200 && r.cuerpo.ok) { try { const sid = (b?.confirmacion && sugerencias.porToken(b.confirmacion)) || (typeof b?.sugerencia === 'string' ? b.sugerencia : null); if (sid) { const h = sugerencias.marcarAplicada(sid, { quien: 'dueno', hecho: r.cuerpo.hecho }); if (h) r.cuerpo.sugerencia = h; } } catch { /* el cambio ya se hizo */ } }
          return json(res, r.status, r.cuerpo), true;
        }
        if (acciones && p === '/api/anuncios/deshacer') { const r = await acciones.deshacer({ ...b, por: b?.por ?? url.searchParams.get('por') ?? undefined }); return json(res, r.status, r.cuerpo), true; }
        return json(res, 404, { error: 'esa acción de Anuncios no existe (las que hay: accion, deshacer, sincronizar)' }), true;
      }
      return json(res, 405, { error: 'método no admitido' }), true;
    } catch (e) { return json(res, e instanceof ErrorBorrador ? e.status : e.status || 500, { error: e.message, motivo: e.message }), true; }
  }
  handle.completa = completa;
  return handle;
}
