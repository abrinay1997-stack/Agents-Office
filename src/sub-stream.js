// Agents Office — Dimitri's answer while it is being written (DIM-14) and «¿Cómo vamos?» at once (DIM-10). Pure: the page
// (src/sub.js), the server (serve.mjs) and the tests (tests/sub-stream.test.mjs) share it.
//
//   replyFromPartial(raw) → { reply, mode, plain } · the «reply» of a JSON answer that is still arriving, its escapes decoded,
//                           read only at the top level of the object (a "reply" inside a creative's prompt is not it). An answer
//                           that is not JSON at all is shown as it comes (plain: true).
//   cliDelta(j)           → the text of one stream-json line of `claude -p --include-partial-messages`, or null
//   isQuickStatus(text)   → true when the owner only asked how the office is going: the page answers at once, without a model

/** Reads a JSON string from s[i] (just after its opening quote). An escape cut at the end is left out, never shown half. */
function readStr(s, i) {
  let out = '';
  while (i < s.length) {
    const c = s[i];
    if (c === '"') return { str: out, end: i + 1, closed: true };
    if (c !== '\\') { out += c; i++; continue; }
    const n = s[i + 1]; if (n === undefined) break;
    if (n === 'u') { const h = s.slice(i + 2, i + 6); if (h.length < 4 || !/^[0-9a-fA-F]{4}$/.test(h)) break; out += String.fromCharCode(parseInt(h, 16)); i += 6; continue; }
    out += { n: '\n', t: '\t', r: '', b: '', f: '', '"': '"', '\\': '\\', '/': '/' }[n] ?? n; i += 2;
  }
  return { str: out.replace(/[\uD800-\uDBFF]$/, ''), end: s.length, closed: false }; // half a surrogate pair waits for its other half
}

/** The top-level string fields of an object that may still be arriving (cut anywhere). */
export const topStrings = raw => scan(raw).fields;
/** fields, and open: the key whose string value is still being written (null when none). */
function scan(raw) {
  const s = String(raw || ''); let i = s.indexOf('{'); const out = {}; let open = null; if (i < 0) return { fields: out, open };
  let depth = 0, key = null, wantValue = false;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      const r = readStr(s, i + 1);
      if (depth === 1) {
        if (wantValue && key) { out[key] = r.str; if (!r.closed) open = key; key = null; wantValue = false; }
        else { key = r.closed ? r.str : null; }
      }
      if (!r.closed) break;
      i = r.end - 1; continue;
    }
    if (c === '{' || c === '[') { depth++; if (depth === 2 && wantValue) { key = null; wantValue = false; } continue; }
    if (c === '}' || c === ']') { depth--; if (depth <= 0) break; continue; }
    if (depth === 1 && c === ':' && key) { wantValue = true; continue; }
    if (depth === 1 && c === ',') { key = null; wantValue = false; continue; }
    if (depth === 1 && wantValue && /[-0-9tfn]/.test(c)) { key = null; wantValue = false; } // a number, true, false or null: not a string we show
  }
  return { fields: out, open };
}

/** What the owner reads while Dimitri writes. */
export function replyFromPartial(raw) {
  const s = String(raw || '').replace(/^\s*```(?:json)?\s*/i, '');
  const brace = s.indexOf('{');
  if (brace > 40 && !/"reply"\s*:/.test(s) && /^\{\s*(?:"[a-z_]*(?:"\s*(?::[\s\S]*)?)?)?$/.test(s.slice(brace))) // a long preamble, then JSON whose «reply» has not come yet: the preamble only, never the JSON
    return { reply: s.slice(0, brace).trim(), mode: null, plain: false };
  if (brace < 0 || (brace > 40 && !/"reply"\s*:/.test(s))) { // no JSON in sight: the model answered in plain words
    const t = s.replace(/```\s*$/, '').trim();
    return { reply: brace < 0 && t.length < 3 ? '' : t, mode: null, plain: true };
  }
  const { fields: f, open } = scan(s.slice(brace));
  return { reply: String(f.reply || '').replace(/\s+$/, ''), mode: open !== 'mode' && typeof f.mode === 'string' && /^[a-z]+$/.test(f.mode) ? f.mode : null, plain: false }; // a mode still being written («pla…») is not shown
}

/** One line of the CLI's stream-json: the piece of text it adds, or null (`--include-partial-messages` sends stream_event deltas). */
export function cliDelta(j) {
  const e = j && j.type === 'stream_event' ? j.event : null;
  return e && e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta' && typeof e.delta.text === 'string' ? e.delta.text : null;
}

const fold = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const QUICK = /^(y |bueno |hola |oye )?(como vamos|como va todo|como va la oficina|como andamos|como estamos|que tal vamos|que tal va la oficina|como va el dia|estado de la oficina|dame el estado|dame el estado de la oficina|el estado de la oficina|resumen de hoy|resumen del dia)( hoy)?( dame el estado de la oficina)?( por favor)?$/;
/** «¿Cómo vamos?» and its plain twins — the chip's text included. A longer question («¿cómo vamos con Ventas?») goes to Dimitri. */
export const isQuickStatus = text => QUICK.test(fold(text));
