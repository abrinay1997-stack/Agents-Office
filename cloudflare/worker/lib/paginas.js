// Las páginas: lo público (el acceso) y lo que exige sesión (la oficina real, sus paquetes y el panel de conectores).
// Con `run_worker_first: ["/*"]` TODO pasa por aquí: ningún archivo de la oficina sale sin sesión.
const PUBLICAS = new Set(['/login.html', '/login.js', '/acceso.css', '/acceso-tema.js', '/invitacion.html', '/invitacion.js']);
const RE_INVITACION = /^\/invitacion\/[0-9a-f]{1,64}$/; // el enlace de una invitación: sin sesión, la página nativa que la acepta
const PAQUETES = new Set(['/estudio-extra.js', '/tareas-vista.js', '/anuncios-vista.js', '/pieza-editor.js', '/dictado.js']); // los pide la página bajo demanda
const NUBE = new Set(['/nube.js', '/nube.css']); // lo que solo existe en la nube (presencia, equipo, perfil): se inyecta en la oficina al servirla, solo con sesión
const INYECCION = '<link rel="stylesheet" href="/nube.css"><script src="/nube.js" defer></script>';

/** La oficina real con las dos líneas de la nube añadidas al final del <body>. La página local NO las lleva: sin Worker no hay presencia ni equipo. */
async function conNube(resp) {
  if (!resp.ok || !/html/.test(resp.headers.get('content-type') || '')) return resp;
  const h = new Headers(resp.headers); h.delete('content-length'); h.delete('etag');
  if (typeof HTMLRewriter !== 'undefined') return new HTMLRewriter().on('body', { element(e) { e.append(INYECCION, { html: true }); } }).transform(new Response(resp.body, { status: resp.status, headers: h })); // en streaming: la página pesa ~2 MB
  return new Response((await resp.text()).replace('</body>', INYECCION + '</body>'), { status: resp.status, headers: h }); // pruebas en Node
}
const PANEL = new Set(['/panel', '/panel.html', '/app.js']);

const texto = (m, estado) => new Response(m, { status: estado, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });

export async function servirPagina(req, env, usuario) {
  const url = new URL(req.url), p = url.pathname;
  if (req.method !== 'GET' && req.method !== 'HEAD') return texto('Método no permitido', 405);
  const archivo = (ruta) => env.ASSETS.fetch(new Request(new URL(ruta, url.origin), { method: req.method, headers: req.headers }));

  if (PUBLICAS.has(p)) return archivo(p);
  if (RE_INVITACION.test(p)) return archivo('/invitacion.html');
  if (p === '/' || p === '/index.html') return usuario ? conNube(await archivo('/oficina/index.html')) : archivo('/login.html');
  if (NUBE.has(p)) return usuario ? archivo(p) : texto('Entra primero.', 401);
  if (PAQUETES.has(p)) return usuario ? archivo('/oficina' + p) : texto('Entra primero.', 401);
  if (PANEL.has(p)) {
    if (!usuario) return Response.redirect(url.origin + '/', 302);
    return archivo(p === '/app.js' ? '/app.js' : '/panel.html');
  }
  return texto('No encontrado', 404);
}
