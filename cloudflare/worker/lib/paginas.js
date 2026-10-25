// Las páginas: lo público (el acceso) y lo que exige sesión (la oficina real, sus paquetes y el panel de conectores).
// Con `run_worker_first: ["/*"]` TODO pasa por aquí: ningún archivo de la oficina sale sin sesión.
const PUBLICAS = new Set(['/login.html', '/login.js']);
const PAQUETES = new Set(['/estudio-extra.js', '/tareas-vista.js', '/anuncios-vista.js', '/pieza-editor.js']); // los pide la página bajo demanda
const PANEL = new Set(['/panel', '/panel.html', '/app.js']);

const texto = (m, estado) => new Response(m, { status: estado, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });

export async function servirPagina(req, env, usuario) {
  const url = new URL(req.url), p = url.pathname;
  if (req.method !== 'GET' && req.method !== 'HEAD') return texto('Método no permitido', 405);
  const archivo = (ruta) => env.ASSETS.fetch(new Request(new URL(ruta, url.origin), { method: req.method, headers: req.headers }));

  if (PUBLICAS.has(p)) return archivo(p);
  if (p === '/' || p === '/index.html') return archivo(usuario ? '/oficina/index.html' : '/login.html');
  if (PAQUETES.has(p)) return usuario ? archivo('/oficina' + p) : texto('Entra primero.', 401);
  if (PANEL.has(p)) {
    if (!usuario) return Response.redirect(url.origin + '/', 302);
    return archivo(p === '/app.js' ? '/app.js' : '/panel.html');
  }
  return texto('No encontrado', 404);
}
