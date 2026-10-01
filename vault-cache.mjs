// Auditoría 1 oct 2026 (INF-05): the Brain is read once, not on every request.
// vaultIndex() read every note of the Brain (and a stat of each) — synchronously, on the server's one thread — for the
// health light every minute, every time Dimitri opened, and every task and chat turn. With 300 notes on a busy machine
// /api/status took 15 s. Now the index is kept and built again only when a note changes: fs.watch on the Brain (recursive:
// Windows and macOS have it, Linux since Node 20) marks it dirty; where the watch cannot start, it is rebuilt every 15 s.
// A long safety interval rebuilds it anyway, in case a change slipped past the watch.
import fs from 'node:fs';
import path from 'node:path';

/** A note, or a folder (no extension: a folder of notes moved or renamed), changed. Media, JSON and the rest do not count. */
export const touchesNotes = f => !f || /\.md$/i.test(String(f)) || !path.extname(String(f));

export function createCache({ build, watchDir = null, ttlWatching = 10 * 60e3, ttlPolling = 15e3, now = () => Date.now(), watch = fs.watch } = {}) {
  const st = { value: null, at: 0, dirty: true, watching: false, builds: 0 };
  if (watchDir) {
    try {
      const w = watch(watchDir, { recursive: true }, (_ev, f) => { if (touchesNotes(f)) st.dirty = true; });
      w.on?.('error', () => { st.watching = false; st.dirty = true; });
      w.unref?.(); st.watching = true;
    } catch { st.watching = false; }
  }
  return {
    get() {
      const ttl = st.watching ? ttlWatching : ttlPolling;
      if (st.value && !st.dirty && now() - st.at < ttl) return st.value;
      st.dirty = false; st.at = now(); st.builds++;
      st.value = build(); return st.value;
    },
    invalidate() { st.dirty = true; },
    get watching() { return st.watching; },
    get builds() { return st.builds; },
  };
}
