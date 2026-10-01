// Auditoría 1 oct 2026 (INF-04): JSON answers that do not weigh megabytes every few seconds.
// The page asks for /api/tasks every 6 s; with 500 tasks that was 3.6 MB of uncompressed JSON, the delivered work of
// the archived ones included, every time. Now: a large answer goes gzipped when the client takes it, an answer can
// carry an ETag (a 304 with no body when nothing changed), and the poll asks for the light list — an archived task
// without its delivered text (the page only reads its id and its date; the full one is in the first load).
import zlib from 'node:zlib';
import crypto from 'node:crypto';

export const GZIP_FROM = 8 * 1024;

/** The headers and the bytes to send for a JSON body (a string), given the request's own headers. */
export function encodeJson(text, reqHeaders = {}, { etag = false } = {}) {
  const headers = { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' };
  let tag = null;
  if (etag) { tag = '"' + crypto.createHash('sha1').update(text).digest('base64url').slice(0, 20) + '"'; headers.etag = tag; headers['cache-control'] = 'no-cache'; }
  const inm = String(reqHeaders['if-none-match'] || '');
  if (tag && inm.split(/\s*,\s*/).includes(tag)) return { status: 304, headers, body: null };
  if (Buffer.byteLength(text) >= GZIP_FROM && /\bgzip\b/.test(String(reqHeaders['accept-encoding'] || ''))) {
    headers['content-encoding'] = 'gzip'; headers.vary = 'accept-encoding';
    return { status: null, headers, body: zlib.gzipSync(text, { level: 6 }) };
  }
  return { status: null, headers, body: text };
}

/** Send it: res.req is the request (Node sets it), so every json(res, …) call gets compression for free. */
export function sendJson(res, code, body, opts = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const out = encodeJson(text, res.req?.headers || {}, opts);
  res.writeHead(out.status || code, out.headers);
  res.end(out.body ?? undefined);
}

const LIGHT_KEEP = ['id', 'archived', 'archivedAt', 'agent', 'dept', 'state', 'title', 'addedAt', 'doneAt'];
/** The poll's list: an archived task keeps only what the page reads from it (its id and when it was archived). */
export function lightTasks(list) {
  return (Array.isArray(list) ? list : []).map(t => t && t.archived ? Object.fromEntries(LIGHT_KEEP.filter(k => k in t).map(k => [k, t[k]])) : t);
}
