// GET/POST /conectar-claude: el único paso con una persona. SOLO un administrador con sesión de la oficina puede aprobar; el resto recibe un «no» explicado y NO se emite nada
// (ni en esta pantalla ni, por si acaso, en /oauth/token). El POST lleva un testigo anti-CSRF derivado de la cookie de sesión (nadie de fuera lo conoce) y exige mismo origen.
import { sha256, testigo, igualSeguro } from '../ids.js';
import { usuarioDeLaPeticion, leerCookie } from '../sesion.js';
import { urlMcp, origenMcp, ALCANCES, ALCANCE_POR_DEFECTO, TOPE_CUERPO_OAUTH, ahoraMs as reloj } from './config.js';
import { clienteDe, crearCodigo, nombreDeCliente, RETO_VALIDO } from './oauth.js';
import { cabecerasPagina, paginaMensaje, paginaPermiso } from './pagina.js';
import { auditar } from './auditoria.js';

const html = (cuerpo, nonce, estado = 200) => new Response(cuerpo, { status: estado, headers: cabecerasPagina(nonce) });
const mensaje = (titulo, texto, estado, extra) => { const nonce = testigo(12); return html(paginaMensaje(nonce, titulo, texto, extra), nonce, estado); };

/** El testigo anti-CSRF de ESTA sesión (no se guarda: se recalcula). Sin cookie de sesión no hay testigo. */
export async function csrfDe(req) {
  const c = leerCookie(req);
  return c ? sha256(c + ':mcp-permiso') : null;
}

/** Valida los parámetros OAuth (de la dirección en GET, del formulario en POST). → { ok, cliente, campos } | { ok: false, texto }. Un parámetro malo NUNCA redirige: la dirección de vuelta aún no es de fiar. */
export async function validarPeticion(db, env, p) {
  const dame = (k) => (typeof p[k] === 'string' ? p[k] : '');
  if (dame('response_type') !== 'code') return { ok: false, texto: 'La petición no pide un código (response_type debe ser «code»).' };
  const cliente = await clienteDe(db, dame('client_id'));
  if (!cliente) return { ok: false, texto: 'Esa aplicación no está registrada. Vuelve a conectarla desde Claude.' };
  const uri = dame('redirect_uri');
  if (!cliente.redirectUris.includes(uri)) return { ok: false, texto: 'La dirección de vuelta no es una de las registradas por esa aplicación.' };
  if (dame('code_challenge_method') !== 'S256' || !RETO_VALIDO.test(dame('code_challenge'))) return { ok: false, texto: 'Falta PKCE (S256): esta oficina no admite conexiones sin él.' };
  const recurso = dame('resource');
  if (recurso && ![urlMcp(env), origenMcp(env), urlMcp(env) + '/'].includes(recurso)) return { ok: false, texto: 'La petición es para otro servidor, no para esta oficina.' };
  const state = dame('state');
  if (state.length > 500) return { ok: false, texto: 'El parámetro state es demasiado largo.' };
  return { ok: true, cliente, campos: { response_type: 'code', client_id: cliente.id, redirect_uri: uri, code_challenge: dame('code_challenge'), code_challenge_method: 'S256', ...(state ? { state } : {}), ...(recurso ? { resource: recurso } : {}) } };
}

const destinoCorto = (uri) => { try { const u = new URL(uri); return u.origin + u.pathname; } catch { return uri; } };

export async function permiso(req, env, db) {
  const ms = reloj(env);
  if (req.method !== 'GET' && req.method !== 'POST') return mensaje('Método no permitido', 'Usa GET o POST.', 405, {});
  let params;
  if (req.method === 'GET') params = Object.fromEntries(new URL(req.url).searchParams);
  else {
    if ((req.headers.get('content-type') || '').indexOf('application/x-www-form-urlencoded') < 0) return mensaje('Petición no válida', 'El permiso se manda desde el formulario de esta página.', 400, {});
    if (Number(req.headers.get('content-length') || 0) > TOPE_CUERPO_OAUTH) return mensaje('Petición no válida', 'Demasiado grande.', 413, {});
    const texto = await req.text();
    if (texto.length > TOPE_CUERPO_OAUTH) return mensaje('Petición no válida', 'Demasiado grande.', 413, {});
    params = Object.fromEntries(new URLSearchParams(texto));
  }
  const v = await validarPeticion(db, env, params);
  if (!v.ok) return mensaje('No se puede conectar', v.texto, 400, {});
  const usuario = await usuarioDeLaPeticion(db, req);
  if (!usuario) return mensaje('Entra primero a la oficina', 'Abre la oficina en otra pestaña, entra con tu cuenta de administrador y vuelve a pulsar «Conectar» en Claude.', 401, { enlace: { href: '/', texto: 'Abrir la oficina' } });
  if (usuario.rol !== 'admin') {
    await auditar(db, ms, usuario.email, { evento: 'conectar-negado', motivo: 'no-admin', rol: usuario.rol, cliente: v.cliente.nombre });
    return mensaje('Solo un administrador puede conectar Claude', `Tu cuenta es de ${usuario.rol === 'editor' ? 'editor' : 'solo lectura'}. Pídele a un administrador que haga esta conexión; no se ha conectado nada.`, 403, {});
  }
  const csrf = await csrfDe(req);
  if (req.method === 'GET') {
    const nonce = testigo(12);
    return html(paginaPermiso({ nonce, cliente: v.cliente, destino: destinoCorto(v.campos.redirect_uri), persona: { nombre: usuario.nombre, email: usuario.email }, campos: v.campos, csrf, nombreSugerido: nombreDeCliente(v.cliente.nombre) }), nonce);
  }
  // POST: mismo origen (si el navegador manda Origin, tiene que ser este) y el testigo de la sesión
  const origen = req.headers.get('Origin');
  if (origen && origen !== new URL(req.url).origin) return mensaje('Petición no válida', 'Esta petición no viene de esta oficina.', 403, {});
  if (!csrf || !igualSeguro(String(params.csrf ?? ''), csrf)) return mensaje('Petición no válida', 'La página caducó. Vuelve a pulsar «Conectar» en Claude.', 403, {});
  const volver = (extra) => { const u = new URL(v.campos.redirect_uri); for (const [k, x] of Object.entries(extra)) if (x !== undefined) u.searchParams.set(k, x); return new Response(null, { status: 303, headers: { location: u.toString(), 'cache-control': 'no-store' } }); };
  if (params.decision === 'cancelar') { await auditar(db, ms, usuario.email, { evento: 'conectar-cancelado', cliente: v.cliente.nombre }); return volver({ error: 'access_denied', state: v.campos.state }); }
  if (params.decision !== 'aprobar') return mensaje('Petición no válida', 'Falta la decisión.', 400, {});
  const alcance = params.alcance === undefined ? ALCANCE_POR_DEFECTO : params.alcance;
  if (!ALCANCES.includes(alcance)) return mensaje('Petición no válida', 'Ese alcance no existe.', 400, {});
  if (alcance !== ALCANCE_POR_DEFECTO && params.confirmo !== 'si') return mensaje('Falta tu confirmación', 'Para dar «Leer y escribir» o «preparar un gasto» hay que marcar «Confirmo que acabo de pedir esta conexión». Vuelve atrás y márcalo, o elige «Solo leer».', 400, {});
  const nombre = nombreDeCliente(params.nombre || v.cliente.nombre);
  const codigo = await crearCodigo(db, { cliente: v.cliente, userId: usuario.id, redirectUri: v.campos.redirect_uri, reto: v.campos.code_challenge, alcance, nombre, ms });
  await auditar(db, ms, usuario.email, { evento: 'conectar-aprobado', cliente: v.cliente.nombre, alcance, nombre });
  return volver({ code: codigo, state: v.campos.state });
}
