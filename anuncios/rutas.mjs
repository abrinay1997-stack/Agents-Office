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
import { RANGOS, buscar, textoCuenta, textoCampanas, textoObjeto } from './modelo.mjs';

export const AGENTE_CADA_MIN = 10;

export function crearRutasAnuncios({ sync, meta, json, body, acciones = null, alHacer = () => {}, ahora = () => Date.now() }) {
  let agenteAt = 0;
  const rangoDe = url => (RANGOS.includes(url.searchParams.get('rango')) ? url.searchParams.get('rango') : '7d');

  /** La vista con lo de la conexión: lo que contesta GET /api/anuncios. */
  function completa(rango = '7d') {
    const c = sync.conexion(), v = sync.vista(rango);
    return { configurado: c.configurado, motivo: c.motivo, ejemplo: false, ...v, topes: sync.topes(), sincronizadaAt: c.sincronizadaAt, cifrasAt: c.cifrasAt, sondeoAt: c.sondeoAt, sincronizando: c.sincronizando, error: c.error, uso: meta.uso(), sondeo: sync.sondeo() };
  }

  async function handle(req, res, url) {
    const p = url.pathname;
    if (p !== '/api/anuncios' && !p.startsWith('/api/anuncios/')) return false;
    try {
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
          return json(res, r.status, r.cuerpo), true;
        }
        if (acciones && p === '/api/anuncios/deshacer') { const r = await acciones.deshacer({ ...b, por: b?.por ?? url.searchParams.get('por') ?? undefined }); return json(res, r.status, r.cuerpo), true; }
        return json(res, 404, { error: 'esa acción de Anuncios no existe (las que hay: accion, deshacer, sincronizar)' }), true;
      }
      return json(res, 405, { error: 'método no admitido' }), true;
    } catch (e) { return json(res, e.status || 500, { error: e.message }), true; }
  }
  handle.completa = completa;
  return handle;
}
