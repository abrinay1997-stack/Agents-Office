// ============================================================
// Agents Office V4.7 (F2) — el cliente de la Graph API de Meta (Facebook e Instagram). SOLO LECTURA.
//
// PORTADO de Juancito Ads — juanarrietabusiness-pixel/CALENDARIOS-MARKETING-APP, worker/lib/meta.js (30 sep 2026): el cliente
// de `graph()`, `ErrorMeta` y las frases de `mensajeMeta`, que ya vivieron un año de errores reales de Meta. Lo que NO viene:
// el OAuth con inicio de sesión, la cifra de tokens en D1 y el cambio de token de corta por larga duración. Esta oficina corre en
// una computadora, no en un servidor con una web pública a la que Meta pueda volver: entra con un TOKEN DE USUARIO DEL SISTEMA
// (Business Manager → Usuarios del sistema), que no caduca y se pone una vez.
//
// EL TOKEN
//   · `META_ACCESS_TOKEN` — variable de entorno de Windows, como las llaves del Estudio. NUNCA se escribe en un archivo, ni en
//     `data/`, ni en un aviso, ni en un error: `sinToken()` lo quita de cualquier texto que salga de aquí.
//   · `META_APP_SECRET` (opcional) — si la app de Meta exige «prueba del secreto», cada llamada lleva `appsecret_proof`.
//   · `META_GRAPH_VERSION` (opcional) — para no depender de que esta versión no se retire.
//   · `META_GRAPH_HOST` (solo para pruebas) — otra dirección en lugar de graph.facebook.com; `npm run check` la apunta a un Graph de mentira.
// Los tokens de cada PÁGINA (los que piden las métricas de Facebook) se piden con el de usuario y viven solo en memoria.
//
// NADA DE ESTO SE HA PROBADO CONTRA META desde la máquina donde se escribió (no había token ni salida a graph.facebook.com):
// los tests usan un `fetch` de mentira que habla como Graph. Lo primero con un token de verdad es «Comprobar conexión».
// ============================================================
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const VERSION_GRAPH = 'v23.0';
export const HOST_GRAPH = 'https://graph.facebook.com';

/** Lo que hace falta para LEER (F2). */
export const PERMISOS_LECTURA = ['pages_show_list', 'pages_read_engagement', 'pages_read_user_content', 'read_insights', 'business_management', 'instagram_basic', 'instagram_manage_insights'];
/** Lo que hará falta para PROGRAMAR (F3): se pide ya, para no volver a generar el token después. */
export const PERMISOS_PUBLICAR = ['pages_manage_posts', 'instagram_content_publish', 'instagram_manage_comments'];

/** Los de `necesarios` que no están en lo concedido (vacío si no se sabe). */
export const permisosQueFaltan = (concedidos, necesarios = PERMISOS_LECTURA) => (Array.isArray(concedidos) ? necesarios.filter(p => !concedidos.includes(p)) : []);

export class ErrorMeta extends Error {
  constructor(error = {}, estado = 0) {
    super(error?.message || `Meta respondió ${estado}`);
    this.name = 'ErrorMeta';
    this.estado = estado;
    this.codigo = Number(error?.code ?? 0);
    this.subcodigo = Number(error?.error_subcode ?? 0);
    this.titulo = error?.error_user_title || '';
    this.detalle = error?.error_user_msg || '';
    // Saturación, límites de uso o fallos de Meta: se reintenta. Lo demás (permisos, formato) no se arregla solo.
    this.transitorio = Boolean(error?.is_transient) || [1, 2, 4, 17, 32, 341, 613, 9004].includes(this.codigo) || [2207052, 2207003, 2207042].includes(this.subcodigo) || estado >= 500;
  }
}

/** Lo que se le enseña al dueño, en español y con qué hacer. */
export function mensajeMeta(e) {
  if (!(e instanceof ErrorMeta)) return e?.message || 'No se pudo completar la operación con Meta.';
  if (e.codigo === 190) return 'El token de Meta caducó, se revocó o no es válido. Genera uno nuevo en Business Manager → Usuarios del sistema y ponlo en la variable META_ACCESS_TOKEN.';
  if (e.subcodigo === 2207042 || e.codigo === 9) return 'Llegaste al límite de publicaciones por API de Instagram (50 cada 24 horas). Se reintentará más tarde.';
  if (e.codigo === 10 || (e.codigo >= 200 && e.codigo < 300)) {
    return `Meta no dio permiso: ${e.detalle || e.message}. Revisa que el usuario del sistema tenga asignada esta página y su Instagram, con los permisos que pide la oficina.`;
  }
  if (e.codigo === 100) return `Meta no aceptó la petición: ${e.detalle || e.message}`;
  if (e.transitorio) return 'Meta está saturado o limitó las peticiones. Se reintentará en unos minutos.';
  return `Meta respondió: ${e.detalle || e.message}`;
}

const CAMPOS_PAGINA = 'id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}';
const escribirJSON = (f, datos) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(datos, null, 1)); fs.renameSync(f + '.tmp', f); };
const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };

/**
 * El cliente. Todo lo que depende del mundo (variables de entorno, red, reloj, dónde guardar) se inyecta, para que los tests
 * le den un Graph de mentira y una carpeta temporal.
 */
export function crearMeta({ env = process.env, fetchFn = (...a) => fetch(...a), dir, ahora = () => Date.now() } = {}) {
  const tokenUsuario = () => String(env.META_ACCESS_TOKEN || '').trim();
  const secreto = () => String(env.META_APP_SECRET || '').trim();
  const host = () => String(env.META_GRAPH_HOST || '').trim().replace(/\/+$/, '') || HOST_GRAPH;
  const base = () => `${host()}/${String(env.META_GRAPH_VERSION || '').trim() || VERSION_GRAPH}`;
  const archivo = path.join(dir || '.', 'cuentas.json');
  const tokensPagina = new Map(); // paginaId → token de la página: solo en memoria

  /** El token nunca sale en un texto: ni el de usuario ni los de página. */
  const sinToken = texto => {
    let t = String(texto ?? '');
    for (const k of [tokenUsuario(), ...tokensPagina.values()]) if (k && k.length > 8) t = t.split(k).join('…');
    return t;
  };

  /** Una llamada a la Graph API. Los parámetros van en la dirección (GET); el token, como parámetro, nunca en un registro. */
  async function graph(token, ruta, { params = {}, host = null } = {}) {
    const u = new URL(`${host ?? base()}${ruta}`);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
    if (token) {
      u.searchParams.set('access_token', token);
      if (secreto()) u.searchParams.set('appsecret_proof', crypto.createHmac('sha256', secreto()).update(token).digest('hex'));
    }
    let res;
    try { res = await fetchFn(u, { method: 'GET' }); }
    catch (e) { throw new ErrorMeta({ message: sinToken(`No se pudo contactar con Meta (${e?.message || e})`), is_transient: true }, 0); }
    const datos = await res.json().catch(() => ({}));
    if (!res.ok || datos?.error) throw new ErrorMeta({ ...(datos?.error ?? {}), message: sinToken(datos?.error?.message) }, res.status);
    return datos;
  }

  /** Todas las páginas que el token ve, de resultado en resultado. Una dirección «siguiente» solo se sigue si es de Graph. */
  async function paginas() {
    const salida = [];
    let datos = await graph(tokenUsuario(), '/me/accounts', { params: { fields: CAMPOS_PAGINA, limit: 100 } });
    for (let vuelta = 0; vuelta < 10; vuelta++) {
      salida.push(...(datos?.data ?? []));
      const siguiente = datos?.paging?.next;
      if (!siguiente || !String(siguiente).startsWith(`${host()}/`)) break;
      const res = await fetchFn(siguiente);
      datos = await res.json().catch(() => ({}));
      if (datos?.error) throw new ErrorMeta({ ...datos.error, message: sinToken(datos.error.message) }, res.status);
    }
    return salida;
  }

  /**
   * Qué es este token y qué puede: su tipo, cuándo caduca y los permisos que lleva DE VERDAD. `/debug_token` lo dice todo; si no
   * contesta, `/me/permissions`. null en `permisos` = «Meta no lo dijo», que no es lo mismo que «no tiene ninguno».
   */
  async function inspeccionar() {
    const t = tokenUsuario();
    try {
      const r = (await graph(t, '/debug_token', { params: { input_token: t } }))?.data;
      if (r) return { valido: r.is_valid !== false, tipo: r.type || null, caduca: r.expires_at ? new Date(r.expires_at * 1000).toJSON() : null, permisos: Array.isArray(r.scopes) ? r.scopes : null };
    } catch (e) { if (e.codigo === 190) throw e; }
    try {
      const r = await graph(t, '/me/permissions');
      return { valido: true, tipo: null, caduca: null, permisos: (r?.data ?? []).filter(p => p.status === 'granted').map(p => p.permission) };
    } catch (e) { if (e.codigo === 190) throw e; return { valido: true, tipo: null, caduca: null, permisos: null }; }
  }

  const aCuentas = lista => {
    const salida = [];
    for (const p of lista) {
      if (!p?.id) continue;
      if (p.access_token) tokensPagina.set(String(p.id), String(p.access_token));
      salida.push({ id: `facebook:${p.id}`, red: 'facebook', externoId: String(p.id), paginaId: String(p.id), nombre: p.name || `Página ${p.id}`, foto: p.picture?.data?.url || '' });
      const ig = p.instagram_business_account;
      if (ig?.id) salida.push({ id: `instagram:${ig.id}`, red: 'instagram', externoId: String(ig.id), paginaId: String(p.id), nombre: ig.name || ig.username || `Instagram ${ig.id}`, usuario: ig.username || '', foto: ig.profile_picture_url || '' });
    }
    return salida;
  }

  const guardado = () => leerJSON(archivo, { cuentas: [], token: null, sincronizadaAt: null, error: null });

  /** El estado que se enseña: nunca lleva un token. */
  function estado() {
    const g = guardado();
    return { configurado: Boolean(tokenUsuario()), secreto: Boolean(secreto()), permisos: { lectura: PERMISOS_LECTURA, publicar: PERMISOS_PUBLICAR }, version: String(env.META_GRAPH_VERSION || '').trim() || VERSION_GRAPH, cuentas: g.cuentas || [], token: g.token || null, sincronizadaAt: g.sincronizadaAt || null, error: g.error || null };
  }

  /** Verifica el token y lista las cuentas: lo que hace «Comprobar conexión». Guarda el resultado (sin tokens) o el motivo del fallo. */
  async function sincronizar() {
    if (!tokenUsuario()) return { ...estado(), error: 'Falta la variable META_ACCESS_TOKEN.' };
    const previo = guardado();
    try {
      const token = await inspeccionar();
      const cuentas = aCuentas(await paginas());
      const faltan = permisosQueFaltan(token.permisos);
      const sinCuentas = cuentas.length ? null : 'El token no ve ninguna página. En Business Manager, asígnale al usuario del sistema las páginas de PanaClaw (con acceso a su Instagram).';
      escribirJSON(archivo, { cuentas, token: { ...token, faltan, verificadoAt: new Date(ahora()).toJSON() }, sincronizadaAt: new Date(ahora()).toJSON(), error: sinCuentas });
    } catch (e) {
      // Un fallo no borra lo que ya se sabía: se apunta el motivo y las cuentas de antes siguen ahí.
      escribirJSON(archivo, { ...previo, error: mensajeMeta(e), sincronizadaAt: new Date(ahora()).toJSON() });
    }
    return estado();
  }

  /** El token con el que se lee una cuenta: el de su página si se sabe (Facebook lo pide), y si no, el de usuario. */
  async function tokenDe(cuenta) {
    const pid = cuenta?.paginaId;
    if (pid && tokensPagina.has(pid)) return tokensPagina.get(pid);
    if (pid) {
      try { const r = await graph(tokenUsuario(), `/${pid}`, { params: { fields: 'access_token' } }); if (r?.access_token) { tokensPagina.set(pid, String(r.access_token)); return String(r.access_token); } } catch { /* se lee con el de usuario */ }
    }
    return tokenUsuario();
  }

  return { configurado: () => Boolean(tokenUsuario()), graph, tokenDe, estado, sincronizar, sinToken };
}
