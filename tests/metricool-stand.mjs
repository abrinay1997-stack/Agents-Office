// Un Metricool de mentira (6 oct 2026, plan M0) — lo usan tests/metricool.test.mjs, tests/contenido-cola.test.mjs y el check.
// Contesta como la API que describen el MCP oficial de Metricool y metricool-cli (ver contenido/metricool.mjs): la key en `X-Mc-Auth`,
// `userId` y `blogId` en la dirección, las publicaciones con `providers` y `publicationDate`. Guarda cada petición en `vistas`.
// No es un test (node --test solo corre *.test.mjs). Nunca una key de verdad ni una llamada a app.metricool.com.
import http from 'node:http';

export const TOKEN = 'mc-prueba-0123456789abcdef'; // una key falsa: nunca una de verdad · secrets-ok
export const USUARIO = '4242';
export const MARCA = '777';

/** opts.fallar: { 'METODO /ruta': [estado, mensaje] } · opts.desde: { 'METODO /ruta': [n, estado] } (desde la llamada n, falla) */
export async function levantarMetricool(opts = {}) {
  const vistas = [], posts = new Map(), subidas = new Map(), bandeja = { conversaciones: [], comentarios: [], resenas: [] }, respuestas = [], cuentas = {};
  let n = 1000;
  const srv = http.createServer((req, res) => {
    const trozos = []; req.on('data', d => trozos.push(d)); req.on('end', () => {
      const crudo = Buffer.concat(trozos), u = new URL(req.url, 'http://x'), p = u.pathname, clave = `${req.method} ${p}`;
      let body = null; try { body = /json/.test(req.headers['content-type'] || '') ? JSON.parse(crudo.toString('utf8') || '{}') : null; } catch {}
      vistas.push({ metodo: req.method, ruta: p, query: Object.fromEntries(u.searchParams), auth: req.headers['x-mc-auth'], tipo: req.headers['content-type'] || '', body, bytes: crudo.length });
      const out = (code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(typeof b === 'string' ? b : JSON.stringify(b)); };
      if (p.startsWith('/s3/')) { // la subida firmada no lleva la key de Metricool (va contra el almacén)
        if (req.method !== 'PUT') return out(405, { message: 'solo PUT' });
        subidas.set(p, { bytes: crudo.length, tipo: req.headers['content-type'] }); res.writeHead(200); return res.end();
      }
      if (req.headers['x-mc-auth'] !== TOKEN || u.searchParams.get('userId') !== USUARIO) return out(401, { message: 'Unauthorized' });
      if (u.searchParams.has('userToken')) return out(400, { message: 'la key no va en la dirección' }); // la oficina no debe filtrarla
      const f = opts.fallar?.[clave]; if (f) return out(f[0], { message: f[1] || 'error' });
      cuentas[clave] = (cuentas[clave] || 0) + 1; const d = opts.desde?.[clave]; if (d && cuentas[clave] >= d[0]) return out(d[1], { message: 'error simulado' });
      const conMarca = () => u.searchParams.get('blogId') === MARCA;

      if (req.method === 'GET' && p === '/v2/settings/brands') return out(200, [{ id: Number(MARCA), label: 'PanaClaw', timezone: 'America/Panama', instagram: 'panaclaw', facebook: 'PanaClaw', linkedin: 'panaclaw' }]);
      if (!conMarca()) return out(403, { message: 'Forbidden brand' });
      if (req.method === 'POST' && p === '/v2/scheduler/posts') {
        if (!Array.isArray(body?.providers) || !body.providers.length || typeof body.providers[0] !== 'object') return out(400, { message: 'providers must be objects' });
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(body?.publicationDate?.dateTime || '')) return out(400, { message: "Date must be yyyy-MM-dd'T'HH:mm:ss" });
        const id = ++n, post = { ...body, id, uuid: `uuid-${id}`, providers: body.providers.map(pr => ({ ...pr, status: body.draft ? 'DRAFT' : 'PENDING' })) };
        posts.set(String(id), post); return out(200, { data: post });
      }
      const m = /^\/v2\/scheduler\/posts\/(\d+)$/.exec(p);
      if (m && req.method === 'PUT') { const post = posts.get(m[1]); if (!post) return out(404, { message: 'Post not found' }); const nuevo = { ...post, ...body, providers: (body.providers || post.providers).map(pr => ({ ...pr, status: 'PENDING' })) }; posts.set(m[1], nuevo); return out(200, { data: nuevo }); }
      if (m && req.method === 'DELETE') { if (!posts.delete(m[1])) return out(404, { message: 'Post not found' }); return out(200, { ok: true }); }
      if (req.method === 'GET' && p === '/v2/scheduler/posts') {
        const a = u.searchParams.get('start') || '', b = u.searchParams.get('end') || '9';
        return out(200, { data: [...posts.values()].filter(x => x.publicationDate.dateTime >= a && x.publicationDate.dateTime <= b) });
      }
      const bt = /^\/v2\/scheduler\/besttimes\/(\w+)$/.exec(p);
      if (bt && req.method === 'GET') return out(200, { data: [{ dayOfWeek: 'MONDAY', hour: 9, value: 80 }, { dayOfWeek: 'MONDAY', hour: 19, value: 95 }, { dayOfWeek: 'THURSDAY', hour: 13, value: 60 }] });
      if (req.method === 'PUT' && p === '/v2/media/s3/upload-transactions') {
        const id = ++n, ruta = `/s3/${id}/${encodeURIComponent(body?.filename || 'archivo')}`;
        return out(200, { data: { presignedUrl: `${base}${ruta}?X-Amz-Signature=abc`, fileUrl: `https://static.metricool.test${ruta}` } });
      }
      if (req.method === 'GET' && p === '/actions/normalize/image/url') return out(200, JSON.stringify(`https://static.metricool.test/normalized/${encodeURIComponent(u.searchParams.get('url') || '')}`));
      const an = /^\/v2\/analytics\/(posts|reels)\/(\w+)$/.exec(p);
      if (an && req.method === 'GET') return out(200, { data: (opts.analiticas?.[an[2]] || []) });
      if (req.method === 'GET' && p === '/v2/inbox/conversations') return out(200, { data: bandeja.conversaciones });
      if (req.method === 'GET' && p === '/v2/inbox/post-comments') return out(200, { data: bandeja.comentarios });
      if (req.method === 'GET' && p === '/v2/inbox/reviews') return out(200, { data: bandeja.resenas });
      if (req.method === 'POST' && /^\/v2\/inbox\/(conversations|post-comments|reviews)$/.test(p)) { respuestas.push({ ruta: p, ...body }); return out(200, { ok: true }); }
      return out(404, { message: `no route ${clave}` });
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  return {
    base, vistas, posts, subidas, bandeja, respuestas,
    env: { METRICOOL_USER_TOKEN: TOKEN, METRICOOL_USER_ID: USUARIO, METRICOOL_BLOG_ID: MARCA, METRICOOL_API_BASE: base },
    /** Metricool «publica» lo que ya llegó a su hora (o todo): PENDING → PUBLISHED (o ERROR para las redes de `fallan`). */
    publicar({ hasta = '9999', fallan = [] } = {}) {
      for (const post of posts.values()) if (!post.draft && post.publicationDate.dateTime <= hasta) post.providers = post.providers.map(pr => ({ ...pr, status: fallan.includes(pr.network) ? 'ERROR' : 'PUBLISHED', publicUrl: fallan.includes(pr.network) ? '' : `https://${pr.network}.test/p/${post.id}`, detailedStatus: fallan.includes(pr.network) ? 'Media not valid' : '' }));
    },
    cerrar: () => new Promise(r => srv.close(r)),
  };
}
