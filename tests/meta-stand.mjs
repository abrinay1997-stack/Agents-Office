// Fase 0 de Anuncios (8 oct 2026): EL Meta de mentira de la oficina, uno solo para todos los tests de Meta y para `npm run check`.
// Antes había tres (tests/contenido-meta.test.mjs, tests/meta-publicar.test.mjs y check.mjs), cada uno con su trozo de Graph.
//
// Habla como Graph (y como rupload.facebook.com) en lo que la oficina usa o usará:
//   · las cuentas: /debug_token, /me/accounts, /<página>, /<instagram>;
//   · Analíticas: /<ig>/insights, /<ig>/media, /<medio>/insights, /<página>/insights, /<página>/posts;
//   · publicar (F3): fotos, feed, videos, historias, comentarios, contenedores de Instagram, media_publish, la subida reanudable;
//   · la Marketing API (Fases A1–A4): la cuenta act_…, campañas, conjuntos, anuncios, creativos, adimages, advideos, insights,
//     copies, generatepreviews, `execution_options: ["validate_only"]` y el lote (`POST /` con `batch`);
//   · la Bandeja (Fases B1–B2): comentarios de Instagram y Facebook, responder, ocultar, conversaciones y mensajes con la ventana de 24 h.
//
// Tiene ESTADO (`st`): lo que se crea se puede leer después, y los tests miran dentro. Y modos de fallo (`fallar`), las
// cabeceras de uso (`uso`) y `torcer(llamada, st)` para contestar otra cosa en un caso concreto.
//
// Nunca habla con Meta ni conoce un token de verdad: los tokens son los que le pasa cada test.
import http from 'node:http';

export const TOKEN_STAND = 'EAAG-TOKEN-DEL-STAND-0123456789'; // secrets-ok: un token de mentira para el Graph de mentira
export const TOKEN_PAGINA_STAND = 'EAAG-TOKEN-DE-PAGINA-DEL-STAND-9876543210'; // secrets-ok: idem
export const CUENTA_STAND = 'act_1001';

export const json = (cuerpo, estado = 200, cabeceras = {}) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json', ...cabeceras } });
const errorGraph = (message, code, extra = {}, estado = 400) => json({ error: { message, type: 'OAuthException', code, fbtrace_id: 'stand', ...extra } }, estado);

/** Lo que se paga en Meta: con esto Graph decide si una creación es válida. Centavos de la moneda de la cuenta (USD). */
export const PRESUPUESTO_MINIMO_CENTAVOS = 100; // US$1 al día: el mínimo habitual para optimizar por clics o interacción

const OBJETIVOS = ['OUTCOME_AWARENESS', 'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT', 'OUTCOME_LEADS', 'OUTCOME_APP_PROMOTION', 'OUTCOME_SALES'];
const ESTADOS = ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'];

/**
 * @param {object} o
 * @param {string}   [o.token]        el token de usuario que acepta (el que no coincide da 190)
 * @param {string}   [o.tokenPagina]  el de la página P1
 * @param {string[]} [o.permisos]     lo que dice /debug_token
 * @param {Array}    [o.paginas]      lo que dice /me/accounts (por defecto P1 con su Instagram IG1)
 * @param {Array}    [o.media]        las publicaciones de IG1 ya existentes
 * @param {Array}    [o.postsFB]      las publicaciones de P1 ya existentes (Graph solo da reacciones si se piden en `fields`)
 * @param {number}   [o.procesar]     cuántas lecturas tarda un video de Instagram en quedar listo tras subirlo
 * @param {object}   [o.cuenta]       campos de la cuenta publicitaria (account_status, currency…)
 * @param {object}   [o.fallar]       { limite: n, parametro: n, pagoPendiente, rechazar: [idAnuncio], conProblemas: [idAnuncio] }
 * @param {object}   [o.uso]          { app, negocio, cuenta, recuperarMin }: porcentajes que salen en las cabeceras de uso
 * @param {Function} [o.torcer]       (llamada, st) → Response | null
 * @param {string}   [o.rupload]      el origen que hace de rupload.facebook.com
 */
export function crearMetaStand(o = {}) {
  const token = o.token ?? TOKEN_STAND, tokenPagina = o.tokenPagina ?? TOKEN_PAGINA_STAND;
  const RUP = o.rupload ?? 'https://rupload.test';
  const llamadas = [];
  const st = {
    n: 0, reloj: Date.now(), procesar: o.procesar ?? 0,
    // publicar
    fotos: {}, posts: {}, cont: {}, media: [...(o.media ?? [])], borrados: [],
    // Marketing API
    cuenta: { id: CUENTA_STAND, account_id: CUENTA_STAND.slice(4), name: 'PanaClaw Ads', account_status: o.fallar?.pagoPendiente ? 3 : 1, disable_reason: 0, currency: 'USD', timezone_name: 'America/Panama', amount_spent: '0', spend_cap: '0', balance: '0', ...(o.cuenta ?? {}) },
    campanas: {}, conjuntos: {}, anuncios: {}, creativos: {}, imagenes: {}, videos: {}, cifras: [], validaciones: 0,
    // la Bandeja
    comentarios: {}, ocultos: [], conversaciones: [], enviados: [],
    // fallos y uso
    fallar: { ...(o.fallar ?? {}) }, uso: o.uso ?? null,
  };
  const nuevo = p => `${p}${++st.n}`;
  const paginas = o.paginas ?? [{ id: 'P1', name: 'PanaClaw', access_token: tokenPagina, instagram_business_account: { id: 'IG1', username: 'panaclaw', name: 'PanaClaw IG' } }];
  const postsFB = o.postsFB ?? [];

  const cabecerasUso = () => {
    if (!st.uso) return {};
    const { app = 0, negocio = 0, cuenta = 0, recuperarMin = 0 } = st.uso;
    return {
      'x-app-usage': JSON.stringify({ call_count: app, total_time: app, total_cputime: app }),
      'x-business-use-case-usage': JSON.stringify({ 9001: [{ type: 'ads_management', call_count: negocio, total_cputime: negocio, total_time: negocio, estimated_time_to_regain_access: recuperarMin, ads_api_access_tier: 'standard_access' }] }),
      'x-ad-account-usage': JSON.stringify({ acc_id_util_pct: cuenta, reset_time_duration: recuperarMin * 60, ads_api_access_tier: 'standard_access' }),
    };
  };
  const conUso = res => { const c = cabecerasUso(); if (!Object.keys(c).length) return res; const h = new Headers(res.headers); for (const [k, v] of Object.entries(c)) h.set(k, v); return new Response(res.body, { status: res.status, headers: h }); };

  // ---------------------------------------------------------------- la Marketing API

  const esValidar = campos => String(campos.execution_options || '').includes('validate_only');
  const lista = (v, def = []) => { if (Array.isArray(v)) return v; try { const x = JSON.parse(v); return Array.isArray(x) ? x : def; } catch { return def; } };
  const objeto = v => { if (v && typeof v === 'object') return v; try { return JSON.parse(v); } catch { return null; } };
  const efectivo = x => {
    if (x.status === 'ARCHIVED') return 'ARCHIVED';
    if (x.status === 'PAUSED') return 'PAUSED';
    if (x.revision === 'DISAPPROVED') return 'DISAPPROVED';
    if (x.revision === 'WITH_ISSUES') return 'WITH_ISSUES';
    if (x.revision === 'PENDING_REVIEW') return 'PENDING_REVIEW';
    const padre = x.adset_id ? st.conjuntos[x.adset_id] : x.campaign_id ? st.campanas[x.campaign_id] : null;
    if (padre) { const p = efectivo(padre); if (p === 'CAMPAIGN_PAUSED') return p; if (p !== 'ACTIVE') return x.adset_id ? 'ADSET_PAUSED' : 'CAMPAIGN_PAUSED'; }
    return 'ACTIVE';
  };
  const vista = x => {
    const salida = { ...x, configured_status: x.status, effective_status: efectivo(x) };
    delete salida.revision;
    if (x.revision === 'DISAPPROVED') salida.ad_review_feedback = { global: { 'Texto engañoso': 'El anuncio promete un resultado que no se puede garantizar.' } };
    if (x.revision === 'WITH_ISSUES') salida.issues_info = [{ error_code: 1487, error_summary: 'Problema con la página', error_message: 'La página del anuncio no está publicada.', level: 'AD' }];
    return salida;
  };

  function crearCampana(campos) {
    if (!campos.name) return errorGraph('(#100) The parameter name is required', 100);
    if (!OBJETIVOS.includes(campos.objective)) return errorGraph('(#100) Param objective must be one of {OUTCOME_…}', 100, { error_user_title: 'Objetivo no válido' });
    if (campos.special_ad_categories === undefined) return errorGraph('(#100) The parameter special_ad_categories is required', 100);
    if (!ESTADOS.includes(campos.status)) return errorGraph('(#100) Param status must be one of {ACTIVE, PAUSED, ARCHIVED, DELETED}', 100);
    const diario = Number(campos.daily_budget || 0);
    if (diario && diario < PRESUPUESTO_MINIMO_CENTAVOS) return errorGraph('(#100) Invalid parameter', 100, { error_subcode: 1885272, error_user_title: 'El presupuesto es demasiado bajo', error_user_msg: `El presupuesto diario debe ser de al menos ${PRESUPUESTO_MINIMO_CENTAVOS} centavos.` });
    if (esValidar(campos)) { st.validaciones++; return json({ success: true }); }
    const id = nuevo('CMP');
    st.campanas[id] = { id, account_id: st.cuenta.account_id, name: campos.name, objective: campos.objective, status: campos.status, special_ad_categories: lista(campos.special_ad_categories), daily_budget: campos.daily_budget, lifetime_budget: campos.lifetime_budget, spend_cap: campos.spend_cap, bid_strategy: campos.bid_strategy, start_time: campos.start_time, stop_time: campos.stop_time, adlabels: lista(campos.adlabels), created_time: new Date(st.reloj).toISOString() };
    return json({ id });
  }
  function crearConjunto(campos) {
    const camp = st.campanas[campos.campaign_id];
    if (!camp) return errorGraph('(#100) Param campaign_id must be a valid campaign', 100);
    for (const k of ['name', 'optimization_goal', 'billing_event', 'targeting', 'status']) if (!campos[k]) return errorGraph(`(#100) The parameter ${k} is required`, 100);
    const segmentacion = objeto(campos.targeting);
    if (!segmentacion) return errorGraph('(#100) Param targeting must be a JSON object', 100);
    if ((segmentacion.instagram_positions ?? []).includes('explore')) return errorGraph('(#100) Instagram Explore placement is no longer supported', 100, { error_user_title: 'Ubicación no disponible' }); // v26
    const especiales = camp.special_ad_categories.filter(c => c && c !== 'NONE');
    if (especiales.length && segmentacion.targeting_automation?.advantage_audience === undefined) return errorGraph('(#100) advantage_audience must be set for special ad categories', 100); // v26
    const diario = Number(campos.daily_budget || 0);
    if (diario && diario < PRESUPUESTO_MINIMO_CENTAVOS) return errorGraph('(#100) Invalid parameter', 100, { error_subcode: 1885272, error_user_title: 'El presupuesto es demasiado bajo' });
    if (esValidar(campos)) { st.validaciones++; return json({ success: true }); }
    const id = nuevo('ADS');
    st.conjuntos[id] = { id, campaign_id: camp.id, name: campos.name, optimization_goal: campos.optimization_goal, billing_event: campos.billing_event, destination_type: campos.destination_type, targeting: segmentacion, status: campos.status, daily_budget: campos.daily_budget, lifetime_budget: campos.lifetime_budget, end_time: campos.end_time, promoted_object: objeto(campos.promoted_object), adlabels: lista(campos.adlabels), learning_stage_info: { status: 'LEARNING', attribution_windows: ['7d_click'], conversions: 0 } };
    return json({ id });
  }
  function crearCreativo(campos) {
    const historia = objeto(campos.object_story_spec);
    if (!historia && !campos.object_story_id && !campos.source_instagram_media_id) return errorGraph('(#100) Creative spec must include object_story_spec, object_story_id or source_instagram_media_id', 100);
    if (historia && !historia.page_id) return errorGraph('(#100) object_story_spec requires page_id', 100);
    if (esValidar(campos)) { st.validaciones++; return json({ success: true }); }
    const id = nuevo('CRE');
    st.creativos[id] = { id, name: campos.name, object_story_spec: historia, object_story_id: campos.object_story_id, source_instagram_media_id: campos.source_instagram_media_id, degrees_of_freedom_spec: objeto(campos.degrees_of_freedom_spec), effective_object_story_id: campos.object_story_id || `P1_${nuevo('post')}`, thumbnail_url: 'https://scontent.fbcdn.test/creativo.jpg' };
    return json({ id });
  }
  function crearAnuncio(campos) {
    const conj = st.conjuntos[campos.adset_id];
    if (!conj) return errorGraph('(#100) Param adset_id must be a valid ad set', 100);
    const cre = objeto(campos.creative);
    if (!cre?.creative_id || !st.creativos[cre.creative_id]) return errorGraph('(#100) Param creative must reference an existing creative', 100);
    if (!campos.name || !ESTADOS.includes(campos.status)) return errorGraph('(#100) The parameters name and status are required', 100);
    if (esValidar(campos)) { st.validaciones++; return json({ success: true }); }
    const id = nuevo('AD');
    st.anuncios[id] = { id, adset_id: conj.id, campaign_id: conj.campaign_id, name: campos.name, status: campos.status, creative: { id: cre.creative_id }, adlabels: lista(campos.adlabels), revision: 'PENDING_REVIEW' };
    return json({ id });
  }
  /** Un cambio de estado o de presupuesto en un objeto. Graph lo permite con POST /<id>. */
  function editar(id, campos) {
    const x = st.campanas[id] ?? st.conjuntos[id] ?? st.anuncios[id];
    if (!x) return null;
    if (campos.status && !ESTADOS.includes(campos.status)) return errorGraph('(#100) Param status must be one of {ACTIVE, PAUSED, ARCHIVED, DELETED}', 100);
    for (const k of ['daily_budget', 'lifetime_budget']) if (campos[k] !== undefined && Number(campos[k]) < PRESUPUESTO_MINIMO_CENTAVOS) return errorGraph('(#100) Invalid parameter', 100, { error_subcode: 1885272, error_user_title: 'El presupuesto es demasiado bajo' });
    if (esValidar(campos)) { st.validaciones++; return json({ success: true }); }
    for (const k of ['status', 'name', 'daily_budget', 'lifetime_budget', 'spend_cap', 'end_time', 'stop_time', 'bid_strategy']) if (campos[k] !== undefined) x[k] = campos[k];
    if (x.status === 'ACTIVE' && x.revision === 'PENDING_REVIEW') x.revision = (st.fallar.rechazar ?? []).includes(x.id) ? 'DISAPPROVED' : (st.fallar.conProblemas ?? []).includes(x.id) ? 'WITH_ISSUES' : null;
    return json({ success: true });
  }
  /** POST /<campaña>/copies: una copia entera (deep_copy) con todo en el estado que se pida. */
  function copiar(id, campos) {
    const camp = st.campanas[id];
    if (!camp) return errorGraph('(#100) Unsupported copy', 100);
    const estado = campos.status_option === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
    const nuevaId = nuevo('CMP'), ids = [];
    st.campanas[nuevaId] = { ...structuredClone(camp), id: nuevaId, name: `${camp.name} - Copia`, status: estado, copia_de: camp.id };
    if (String(campos.deep_copy) === 'true') {
      for (const conj of Object.values(st.conjuntos).filter(c => c.campaign_id === camp.id)) {
        const cid = nuevo('ADS'); st.conjuntos[cid] = { ...structuredClone(conj), id: cid, campaign_id: nuevaId, status: estado, learning_stage_info: { status: 'LEARNING', conversions: 0 } }; ids.push(cid);
        for (const ad of Object.values(st.anuncios).filter(a => a.adset_id === conj.id)) { const aid = nuevo('AD'); st.anuncios[aid] = { ...structuredClone(ad), id: aid, adset_id: cid, campaign_id: nuevaId, status: estado, revision: 'PENDING_REVIEW' }; ids.push(aid); }
      }
    }
    return json({ copied_campaign_id: nuevaId, ad_object_ids: [{ ad_object_type: 'campaign', source_id: camp.id, copied_id: nuevaId }, ...ids.map(c => ({ copied_id: c }))] });
  }
  /** GET /act_…/insights: una fila por objeto y día de `st.cifras` (cada test pone las suyas), filtrada por nivel y fechas. */
  function cifras(q) {
    const nivel = q.get('level') || 'account', rango = objeto(q.get('time_range'));
    const filas = st.cifras.filter(f => (!rango || (f.date_start >= rango.since && f.date_start <= rango.until)) && (nivel === 'account' || f[`${nivel}_id`]));
    if (q.get('time_increment')) return json({ data: filas, paging: { cursors: { before: 'a', after: 'b' } } });
    // Fase A1: sin `time_increment`, Meta da UNA fila por objeto del nivel para todo el rango. El alcance son personas únicas: no es la
    // suma de los días. Aquí, el mayor de los días (o `reach_rango` si el test lo puso en alguna fila), para que se note si alguien suma.
    const grupos = new Map();
    for (const f of filas) {
      const k = nivel === 'account' ? 'cuenta' : f[`${nivel}_id`];
      const g = grupos.get(k) ?? { ...(nivel === 'account' ? {} : { campaign_id: f.campaign_id, ...(nivel !== 'campaign' ? { adset_id: f.adset_id } : {}), ...(nivel === 'ad' ? { ad_id: f.ad_id } : {}) }), date_start: rango?.since ?? f.date_start, date_stop: rango?.until ?? f.date_start, spend: 0, impressions: 0, clicks: 0, inline_link_clicks: 0, reach: 0 };
      for (const c of ['spend', 'impressions', 'clicks', 'inline_link_clicks']) g[c] = Math.round((g[c] + Number(f[c] || 0)) * 100) / 100;
      g.reach = Math.max(g.reach, Number(f.reach_rango ?? f.reach ?? 0));
      grupos.set(k, g);
    }
    const data = [...grupos.values()].map(g => ({ ...g, spend: String(g.spend), impressions: String(g.impressions), reach: String(g.reach), frequency: g.reach ? String(g.impressions / g.reach) : '0' }));
    return json({ data, paging: { cursors: { before: 'a', after: 'b' } } });
  }

  // ---------------------------------------------------------------- el lote

  async function lote(campos) {
    const peticiones = lista(campos.batch, null);
    if (!peticiones) return errorGraph('(#100) The parameter batch is required', 100);
    if (peticiones.length > 50) return errorGraph('(#100) Too many requests in batch message. Maximum batch size is 50', 100);
    const salida = [];
    for (const p of peticiones) {
      const u = new URL(`https://graph.test/v26.0/${String(p.relative_url || '').replace(/^\//, '')}`);
      const init = { method: p.method || 'GET', headers: {} };
      if (p.body) init.body = new URLSearchParams(p.body);
      const r = await responder(u, init, { enLote: true });
      salida.push({ code: r.status, headers: [], body: await r.text() });
    }
    return json(salida);
  }

  // ---------------------------------------------------------------- el reparto

  async function leerCuerpo(init) {
    const campos = {}; let archivo = false, cuerpo = 0;
    const b = init.body;
    if (b instanceof URLSearchParams) Object.assign(campos, Object.fromEntries(b));
    else if (b instanceof FormData) for (const [k, v] of b.entries()) { if (k === 'source' || k === 'filename' || typeof v !== 'string') archivo = v.size ?? true; else campos[k] = v; }
    else if (Buffer.isBuffer(b) || b instanceof Uint8Array) cuerpo = b.length;
    else if (typeof b === 'string') { try { Object.assign(campos, JSON.parse(b)); } catch { Object.assign(campos, Object.fromEntries(new URLSearchParams(b))); } }
    return { campos, archivo, cuerpo };
  }

  async function responder(u, init = {}, { enLote = false } = {}) {
    const metodo = (init.method || 'GET').toUpperCase();
    const ruta = u.pathname.replace(/^\/(ig-api-upload\/)?v[\d.]+/, '/$1').replace('//', '/');
    const h = Object.fromEntries((init.headers instanceof Headers ? [...init.headers.entries()] : Object.entries(init.headers || {})).map(([k, v]) => [k.toLowerCase(), v]));
    const { campos, archivo, cuerpo } = await leerCuerpo(init);
    const q = u.searchParams;
    const ll = { metodo, host: u.origin, ruta, campos, archivo, h, q: Object.fromEntries(q), cuerpo, url: u, searchParams: q, pathname: u.pathname, enLote };
    llamadas.push(ll);
    const t = await o.torcer?.(ll, st); if (t) return t;

    // los fallos que se piden
    if (st.fallar.limite > 0) { st.fallar.limite--; return errorGraph('(#17) User request limit reached', 17, { is_transient: true, error_subcode: 2446079 }); }
    if (st.fallar.parametro > 0) { st.fallar.parametro--; return errorGraph('(#100) Invalid parameter', 100); }

    // rupload: los bytes de un video de Instagram
    if (u.origin === RUP) {
      const id = ruta.split('/').pop();
      if (h.authorization !== `OAuth ${tokenPagina}` || h.offset !== '0' || Number(h.file_size) !== cuerpo) return json({ debug_info: { message: 'cabeceras mal' } }, 400);
      st.cont[id].subido = true; st.cont[id].listoEn = st.procesar; return json({ success: true });
    }
    // Las miniaturas de Meta, y un sitio ajeno que TAMBIÉN da una imagen: así un test prueba que la oficina no lo pide, no que falla.
    if (u.hostname.endsWith('cdninstagram.com') || u.hostname.endsWith('fbcdn.net') || u.hostname === 'evil.example') return new Response(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]), { status: 200 });

    // el token: en la dirección (GET) o en la cabecera (POST, DELETE)
    const dado = q.get('access_token') || String(h.authorization || '').replace(/^(Bearer|OAuth)\s+/i, '');
    if (dado === 'CADUCADO' || (dado && ![token, tokenPagina, ...paginas.map(p => p.access_token)].includes(dado))) return errorGraph('Error validating access token: Session has expired', 190, {}, 400);

    if (metodo === 'POST' && ruta === '/') return lote(campos);

    // ---- las cuentas
    if (ruta === '/debug_token') return json({ data: { is_valid: true, type: 'SYSTEM_USER', expires_at: 0, scopes: o.permisos ?? [] } });
    if (ruta === '/me/permissions') return json({ data: (o.permisos ?? []).map(p => ({ permission: p, status: 'granted' })) });
    if (ruta === '/me/accounts') return json({ data: paginas });
    if (ruta === '/me/adaccounts') return json({ data: [{ id: st.cuenta.id, name: st.cuenta.name, account_status: st.cuenta.account_status, currency: st.cuenta.currency }] });

    // ---- Analíticas (lectura orgánica)
    if (metodo === 'GET' && ruta === '/P1') return json({ access_token: tokenPagina, followers_count: 800, fan_count: 790, name: 'PanaClaw' });
    if (metodo === 'GET' && ruta === '/IG1') return json({ followers_count: 1200, media_count: 40, username: 'panaclaw' });
    if (metodo === 'GET' && /^\/IG\d+\/insights$/.test(ruta)) {
      if (q.get('breakdown')) return json({ data: [{ name: 'follower_demographics', total_value: { breakdowns: [{ results: [{ dimension_values: ['25-34'], value: 500 }, { dimension_values: ['18-24'], value: 300 }] }] } }] });
      return json({ data: String(q.get('metric')).split(',').map((m, i) => ({ name: m, total_value: { value: 100 * (i + 1) } })) });
    }
    if (metodo === 'GET' && ruta === '/IG1/media') return json({ data: st.media });
    if (metodo === 'GET' && /^\/M\d+\/insights$/.test(ruta)) return json({ data: [{ name: 'reach', values: [{ value: 900 }] }, { name: 'saved', values: [{ value: 5 }] }, { name: 'shares', values: [{ value: 3 }] }, { name: 'views', values: [{ value: 1500 }] }, { name: 'total_interactions', values: [{ value: 42 }] }] });
    if (metodo === 'GET' && ruta === '/P1/insights') {
      if (q.get('metric') === 'page_impressions_unique') return errorGraph('(#100) The value must be a valid insights metric', 100); // retirada desde v25
      return json({ data: [{ name: q.get('metric'), values: [{ value: 77 }] }] });
    }
    if (metodo === 'GET' && (ruta === '/P1/posts' || ruta === '/P1/published_posts')) {
      const conReacciones = String(q.get('fields')).includes('reactions');
      return json({ data: postsFB.map(p => { const x = { ...p }; if (!conReacciones) { delete x.reactions; delete x.comments; } return x; }) });
    }

    // ---- publicar (F3)
    if (metodo === 'DELETE') { st.borrados.push(ruta.slice(1)); return json({ success: true }); }
    if (metodo === 'POST' && ruta === '/P1/photos') {
      const id = nuevo('F'), post = `P1_${id}`; st.fotos[id] = { ...campos, archivo };
      if (campos.published !== 'false' || campos.scheduled_publish_time) st.posts[post] = { programada: Number(campos.scheduled_publish_time || 0), texto: campos.caption };
      return json({ id, ...(campos.published === 'false' && !campos.scheduled_publish_time ? {} : { post_id: post }) });
    }
    if (metodo === 'POST' && ruta === '/P1/feed') { const id = `P1_${nuevo('feed')}`; st.posts[id] = { programada: Number(campos.scheduled_publish_time || 0), texto: campos.message }; return json({ id }); }
    if (metodo === 'POST' && ruta === '/P1/videos') { const id = nuevo('V'); st.posts[id] = { programada: Number(campos.scheduled_publish_time || 0), video: true }; return json({ id }); }
    if (metodo === 'POST' && ruta === '/P1/photo_stories') return json({ success: true, post_id: 'P1_historia' });
    if (metodo === 'POST' && ruta === '/IG1/media') {
      const id = nuevo('C'); st.cont[id] = { ...campos, estado: campos.upload_type === 'resumable' ? 'IN_PROGRESS' : 'FINISHED' };
      return json(campos.upload_type === 'resumable' ? { id, uri: `${RUP}/ig-api-upload/v26.0/${id}` } : { id });
    }
    if (metodo === 'POST' && ruta === '/IG1/media_publish') {
      const c = st.cont[campos.creation_id]; if (!c || c.estado !== 'FINISHED') return errorGraph('no está listo', 9007, { error_subcode: 2207027 });
      c.estado = 'PUBLISHED'; const id = nuevo('M'); st.media.unshift({ id, caption: c.caption || '', permalink: `https://www.instagram.com/p/${id}/`, timestamp: new Date(st.reloj).toISOString() }); c.media = id; return json({ id });
    }
    if (ruta === '/IG1/content_publishing_limit') return json({ data: [{ quota_usage: 3, config: { quota_total: 100, quota_duration: 86400 } }] });

    // ---- la Marketing API
    const act = ruta.match(/^\/(act_\d+)(\/[a-z_]+)?$/);
    if (act) {
      if (act[1] !== st.cuenta.id) return errorGraph(`(#100) Ad account ${act[1]} does not exist or you lack permission`, 100);
      const sub = act[2] || '';
      if (!sub && metodo === 'GET') return json(st.cuenta);
      if (metodo === 'POST' && st.cuenta.account_status === 3 && ['/campaigns', '/adsets', '/ads'].includes(sub) && !esValidar(campos)) return errorGraph('(#2635) The ad account has an unsettled payment', 2635, { error_user_title: 'Pago pendiente' });
      if (sub === '/campaigns') return metodo === 'POST' ? crearCampana(campos) : json({ data: Object.values(st.campanas).map(vista) });
      if (sub === '/adsets') return metodo === 'POST' ? crearConjunto(campos) : json({ data: Object.values(st.conjuntos).map(vista) });
      if (sub === '/ads') return metodo === 'POST' ? crearAnuncio(campos) : json({ data: Object.values(st.anuncios).map(vista) });
      if (sub === '/adcreatives') return metodo === 'POST' ? crearCreativo(campos) : json({ data: Object.values(st.creativos) });
      if (sub === '/adimages' && metodo === 'POST') { const hash = `hash${++st.n}`, nombre = campos.filename || 'imagen.jpg'; st.imagenes[hash] = { nombre, bytes: archivo || cuerpo || String(campos.bytes || '').length }; return json({ images: { [nombre]: { hash, url: `https://scontent.fbcdn.test/${hash}.jpg` } } }); }
      if (sub === '/advideos' && metodo === 'POST') { const id = nuevo('VID'); st.videos[id] = { estado: st.procesar > 0 ? 'processing' : 'ready', listoEn: st.procesar }; return json({ id }); }
      if (sub === '/insights') return cifras(q);
      if (sub === '/generatepreviews') return json({ data: [{ body: `<iframe src="https://www.facebook.com/ads/api/preview_iframe.php?format=${q.get('ad_format') || 'MOBILE_FEED_STANDARD'}"></iframe>` }] });
      if (sub === '/delivery_estimate') return json({ data: [{ estimate_mau_lower_bound: 120000, estimate_mau_upper_bound: 340000, estimate_ready: true }] });
      return errorGraph(`ruta no simulada: ${metodo} ${ruta}`, 100);
    }
    const copia = ruta.match(/^\/([A-Z]+\d+)\/copies$/);
    if (copia && metodo === 'POST') return copiar(copia[1], campos);

    // ---- la Bandeja: comentarios y mensajes
    const com = ruta.match(/^\/([\w]+)\/(comments|replies)$/);
    if (com && metodo === 'GET') return json({ data: st.comentarios[com[1]] ?? [] });
    if (com && metodo === 'POST') {
      const id = nuevo('com');
      (st.comentarios[com[1]] ??= []).push({ id, text: campos.message, message: campos.message, mio: true, timestamp: new Date(st.reloj).toISOString() });
      return json({ id });
    }
    if (metodo === 'GET' && ruta === '/P1/conversations') {
      const plataforma = q.get('platform') || 'messenger';
      return json({ data: st.conversaciones.filter(c => (c.platform ?? 'messenger') === plataforma) });
    }
    if (metodo === 'POST' && ruta === '/P1/messages') {
      const para = objeto(campos.recipient)?.id, conv = st.conversaciones.find(c => c.participants?.data?.some(p => p.id === para));
      if (!conv) return errorGraph('(#100) No matching user found', 100, { error_subcode: 2018001 });
      const delCliente = (conv.messages?.data ?? []).filter(m => m.from?.id === para).map(m => Date.parse(m.created_time)).sort((a, b) => b - a)[0] ?? 0;
      if (st.reloj - delCliente > 24 * 3600e3 && objeto(campos.message) && campos.tag !== 'HUMAN_AGENT') return errorGraph('(#10) This message is sent outside of allowed window.', 10, { error_subcode: 2018278 });
      const mid = nuevo('mid'); st.enviados.push({ mid, para, texto: objeto(campos.message)?.text, tipo: campos.messaging_type, tag: campos.tag });
      return json({ recipient_id: para, message_id: mid });
    }

    // ---- un objeto por su id
    const id = ruta.slice(1);
    if (metodo === 'POST') {
      const e = editar(id, campos); if (e) return e;
      const coment = Object.values(st.comentarios).flat().find(c => c.id === id);
      if (coment && (campos.hide !== undefined || campos.is_hidden !== undefined)) { const ocultar = String(campos.hide ?? campos.is_hidden) === 'true'; coment.hidden = ocultar; if (ocultar) st.ocultos.push(id); return json({ success: true }); }
    }
    if (metodo === 'GET') {
      if (st.campanas[id]) return json(vista(st.campanas[id]));
      if (st.conjuntos[id]) return json(vista(st.conjuntos[id]));
      if (st.anuncios[id]) return json(vista(st.anuncios[id]));
      if (st.creativos[id]) return json(st.creativos[id]);
      if (st.videos[id]) { const v = st.videos[id]; if (v.estado === 'processing' && !(v.listoEn-- > 0)) v.estado = 'ready'; return json({ id, status: { video_status: v.estado } }); }
      if (st.fotos[id] && q.get('fields') === 'images') return json({ images: [{ width: 320, source: `https://scontent.fbcdn.test/${id}-p.jpg` }, { width: 1080, source: `https://scontent.fbcdn.test/${id}.jpg` }] });
      if (st.cont[id]) { const c = st.cont[id]; if (c.estado === 'IN_PROGRESS' && c.subido && !(c.listoEn-- > 0)) c.estado = 'FINISHED'; return json({ status_code: c.estado, status: c.estado }); }
      if (st.posts[id]) { const p = st.posts[id], pub = !p.programada || p.programada * 1000 <= st.reloj; return json(p.video ? { published: pub, permalink_url: `/PanaClaw/videos/${id}` } : { is_published: pub, permalink_url: `https://www.facebook.com/${id}` }); }
      if (st.media.some(m => m.id === id)) return json({ permalink: `https://www.instagram.com/p/${id}/` });
    }
    return errorGraph(`ruta no simulada: ${metodo} ${ruta}`, 100);
  }

  /** Como `fetch`: lo que se le pasa a crearMeta({ fetchFn }). */
  const fetchFn = async (url, init = {}) => conUso(await responder(new URL(String(url)), init));

  /**
   * El mismo Meta como servidor HTTP en esta máquina (para `npm run check` y los tests que levantan serve.mjs): la oficina lo
   * recibe en META_GRAPH_HOST. `cerrar()` lo apaga.
   */
  async function escuchar() {
    const servidor = http.createServer(async (rq, rs) => {
      try {
        const trozos = []; for await (const t of rq) trozos.push(t);
        const datos = Buffer.concat(trozos), tipo = String(rq.headers['content-type'] || '');
        const init = { method: rq.method, headers: rq.headers };
        if (datos.length) {
          if (tipo.includes('application/x-www-form-urlencoded')) init.body = new URLSearchParams(datos.toString('utf8'));
          else if (tipo.includes('multipart/form-data')) init.body = await new Request('http://x/', { method: 'POST', headers: { 'content-type': tipo }, body: datos }).formData();
          else if (tipo.includes('json')) init.body = datos.toString('utf8');
          else init.body = datos;
        }
        const r = await fetchFn(new URL(rq.url, `http://${rq.headers.host}`), init);
        rs.writeHead(r.status, Object.fromEntries(r.headers)); rs.end(Buffer.from(await r.arrayBuffer()));
      } catch (e) { rs.writeHead(500, { 'content-type': 'application/json' }); rs.end(JSON.stringify({ error: { message: String(e?.message || e), code: 1 } })); }
    });
    await new Promise(r => servidor.listen(0, '127.0.0.1', r));
    return { servidor, url: `http://127.0.0.1:${servidor.address().port}`, cerrar: () => new Promise(r => servidor.close(r)) };
  }

  return { fetchFn, llamadas, st, escuchar, de: (metodo, ruta) => llamadas.filter(l => l.metodo === metodo && l.ruta === ruta) };
}
