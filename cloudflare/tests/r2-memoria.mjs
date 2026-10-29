// Un R2 de mentira en memoria (put · get con rango · head · delete · list) para probar lo que guarda archivos sin tocar Cloudflare.
export function crearR2() {
  const m = new Map();
  const vista = (k, v, buf = v.buf) => ({ key: k, size: v.buf.length, httpMetadata: v.meta || {}, body: new Blob([buf]).stream(), arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });
  return {
    _m: m,
    put: async (k, data, o = {}) => { if (o.onlyIf?.etagDoesNotMatch === '*' && m.has(k)) return null; const buf = Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : typeof data === 'string' ? Buffer.from(data) : data); m.set(k, { buf, meta: o.httpMetadata, up: o.__subida || new Date() }); return { key: k, size: buf.length }; },
    get: async (k, o = {}) => { const v = m.get(k); if (!v) return null; const r = o.range; return vista(k, v, r ? v.buf.subarray(r.offset, r.offset + r.length) : v.buf); },
    head: async (k) => { const v = m.get(k); return v ? { key: k, size: v.buf.length, httpMetadata: v.meta || {} } : null; },
    delete: async (k) => { for (const x of Array.isArray(k) ? k : [k]) m.delete(x); },
    list: async ({ prefix = '', limit = 1000, cursor } = {}) => { const todos = [...m.keys()].filter((x) => x.startsWith(prefix)).sort(), desde = cursor ? Number(cursor) : 0, pag = todos.slice(desde, desde + limit); return { objects: pag.map((key) => ({ key, size: m.get(key).buf.length, uploaded: m.get(key).up })), truncated: desde + limit < todos.length, ...(desde + limit < todos.length ? { cursor: String(desde + limit) } : {}) }; },
  };
}
