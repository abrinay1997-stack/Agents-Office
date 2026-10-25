// Un SITIO WEB de mentira para probar «Preparar desde mi web» sin red: un `fetch` que contesta las direcciones que se le dan (páginas, redirecciones, robots.txt, páginas enormes, tipos raros, silencios).
// Nunca habla con internet: cualquier dirección que no esté declarada contesta 404 y queda apuntada en `pedidas`.
export function sitioFalso(rutas = {}) {
  const pedidas = [], leidos = new Map();
  const hacer = (u, def) => {
    if (typeof def === 'string') def = { cuerpo: def };
    if (def.fallo) throw Object.assign(new Error(def.fallo === 'tiempo' ? 'timeout' : 'red'), { name: def.fallo === 'tiempo' ? 'TimeoutError' : 'TypeError' });
    const cabeceras = { 'content-type': def.tipo || 'text/html; charset=utf-8', ...(def.cabeceras || {}) };
    if (def.redirigir) return new Response(null, { status: def.status || 302, headers: { location: def.redirigir } });
    if (def.bytes) { // un cuerpo enorme, en trozos: se anota cuánto llegó a leer quien llama
      let enviados = 0; const trozo = new TextEncoder().encode('<p>' + 'x'.repeat(65_000) + '</p>');
      const flujo = new ReadableStream({ pull(c) { if (enviados >= def.bytes) return c.close(); enviados += trozo.length; leidos.set(u, enviados); c.enqueue(trozo); } });
      return new Response(flujo, { status: 200, headers: { ...cabeceras, ...(def.sinLargo ? {} : { 'content-length': String(def.bytes) }) } });
    }
    return new Response(def.cuerpo ?? '', { status: def.status || 200, headers: cabeceras });
  };
  const fetchFn = async (url, init = {}) => {
    const u = new URL(url); u.hash = ''; pedidas.push(u.href);
    if (init.redirect && init.redirect !== 'manual') throw new Error('el lector debe pedir redirect: manual');
    const def = rutas[u.href] ?? rutas[u.href.replace(/\/$/, '')] ?? (u.pathname === '/robots.txt' ? { status: 404, cuerpo: '' } : { status: 404, cuerpo: 'no está' });
    return hacer(u.href, typeof def === 'function' ? def(u, init) : def);
  };
  return { fetchFn, pedidas, leidos, rutas };
}

/** Una página HTML corriente con su menú. */
export const pagina = (titulo, cuerpo, enlaces = []) => `<!doctype html><html><head><title>${titulo}</title><meta name="description" content="${titulo} — descripción"><style>.x{color:red}</style><script>var secreto='NO-DEBE-SALIR'</script></head><body><nav>${enlaces.map(([h, t]) => `<a href="${h}">${t}</a>`).join(' ')}</nav><main>${cuerpo}</main><footer>© ${titulo}</footer></body></html>`;
