// Escribir en el Cerebro de la oficina de la computadora (27 oct 2026): crear una nota, editarla, añadirle texto, mandarla a la papelera y sacarla de ahí. Las notas son archivos .md
// dentro de la carpeta del cerebro; aquí NUNCA se construye una ruta con lo que llega de la página: se busca el nombre en el índice (`indice()`), o, para una nota nueva, se arma
// <cerebro>/<carpeta>/<nombre>.md con un nombre y una carpeta ya validados (notas-core.mjs) y se comprueba que queda dentro. La nube hace lo mismo contra D1 (cloudflare/worker/lib/cerebro.js).
//
// Se crea con `crearNotasLocal({ BRAIN, TRASH, indice, dentro, renombrar })`:
//   indice() → Map(nombre → { path, group, office })   dentro(path) → ¿el archivo real está dentro del cerebro y no es un enlace?   renombrar(tmp, destino) → mueve (fs-seguro.mjs)
import fs from 'node:fs';
import path from 'node:path';
import * as N from './notas-core.mjs';

export function crearNotasLocal({ BRAIN, TRASH, indice, dentro, renombrar }) {
  const fuera = (p) => { const rel = path.relative(path.resolve(BRAIN), path.resolve(p)); return !rel || rel.startsWith('..') || path.isAbsolute(rel); };
  const escribir = (destino, texto) => { fs.mkdirSync(path.dirname(destino), { recursive: true }); const tmp = destino + '.tmp-' + process.pid + '-' + Date.now(); fs.writeFileSync(tmp, texto, 'utf8'); renombrar(tmp, destino); };
  const hallar = (nombre) => { const n = String(nombre ?? ''); const m = indice(); const exacta = m.get(n); if (exacta) return { nombre: n, ...exacta }; return null; };
  const igualSinMayusculas = (nombre) => { const q = nombre.toLowerCase(); for (const k of indice().keys()) if (k.toLowerCase() === q) return k; return null; };

  /** Una nota nueva. → { ok, nombre, modified } | { error, estado } */
  function crear({ nombre, texto = '', grupo = '' } = {}) {
    const n = N.nombreValido(nombre); if (!n.ok) return { error: n.error, estado: 400 };
    const g = N.grupoValido(grupo); if (!g.ok) return { error: g.error, estado: 400 };
    const t = N.textoValido(texto); if (!t.ok) return { error: t.error, estado: 413 };
    const ya = igualSinMayusculas(n.nombre); if (ya) return { error: `Ya hay una nota llamada «${ya}». Ábrela y edítala, o elige otro nombre.`, estado: 409 };
    const destino = path.join(BRAIN, g.grupo, n.nombre + '.md');
    if (fuera(destino) || fs.existsSync(destino)) return { error: `No pude crear «${n.nombre}» en esa carpeta.`, estado: 409 };
    escribir(destino, t.texto);
    return { ok: true, nombre: n.nombre, modified: fs.statSync(destino).mtimeMs };
  }

  /** Reemplaza el texto. `base`: el `modified` que leíste; si el archivo cambió, 409. → { ok, nombre, modified, antes } | { error, estado } */
  function guardar({ nombre, texto, base = null } = {}) {
    const t = N.textoValido(texto, { vacio: false }); if (!t.ok) return { error: t.error, estado: 413 };
    const h = hallar(nombre); if (!h || !dentro(h.path)) return { error: 'Esa nota ya no existe (¿alguien la movió o la mandó a la papelera?).', estado: 404 };
    const st = fs.statSync(h.path);
    if (base !== null && base !== undefined && Math.abs(Number(base) - st.mtimeMs) > 1) return { error: 'Esta nota cambió mientras la editabas (otra pestaña, un agente o tu editor). Ábrela de nuevo para ver lo último y repite tu cambio.', estado: 409, modified: st.mtimeMs };
    const antes = fs.readFileSync(h.path, 'utf8');
    escribir(h.path, t.texto);
    return { ok: true, nombre: h.nombre, modified: fs.statSync(h.path).mtimeMs, antes };
  }

  /** Añade al final (o a una sección) sin tocar lo que decía. */
  function agregar({ nombre, texto, seccion = '' } = {}) {
    const h = hallar(nombre); if (!h || !dentro(h.path)) return { error: `No hay una nota llamada «${String(nombre ?? '').slice(0, 60)}».`, estado: 404 };
    const ya = fs.readFileSync(h.path, 'utf8'), nuevo = N.agregarTexto(ya, texto, { seccion });
    if (nuevo.length > N.MAX_NOTA) return { error: 'La nota quedaría demasiado larga.', estado: 413 };
    return guardar({ nombre: h.nombre, texto: nuevo, base: fs.statSync(h.path).mtimeMs });
  }

  /** A la papelera (30 días): conserva de dónde vino para devolverla a su carpeta. → { ok, nombre, trashed } | { error, estado } */
  function aPapelera(nombre) {
    const h = hallar(nombre); if (!h || !dentro(h.path)) return { error: 'Esa nota no existe.', estado: 404 };
    fs.mkdirSync(TRASH, { recursive: true });
    const sello = Date.now(), base = `${path.basename(h.path, '.md')}__${sello}`, dest = path.join(TRASH, base + '.md');
    fs.writeFileSync(path.join(TRASH, base + '.json'), JSON.stringify({ de: path.relative(BRAIN, h.path), at: sello }), 'utf8');
    renombrar(h.path, dest);
    return { ok: true, nombre: h.nombre, trashed: path.basename(dest) };
  }

  /** Lo que hay en la papelera, con la forma de siempre. */
  function listarPapelera() {
    let files = []; try { files = fs.readdirSync(TRASH).filter((f) => /__\d+\.md$/.test(f)); } catch { /* sin papelera todavía */ }
    return { items: files.map((f) => ({ file: f, name: f.replace(/__\d+\.md$/, ''), at: +f.match(/__(\d+)\.md$/)[1] })).sort((a, b) => b.at - a.at).slice(0, 200), keepDays: 30 };
  }

  /** Saca una nota de la papelera: a su carpeta de antes (si la guardó) o a `Agents Office`. Si el nombre ya está, con «-2». → { ok, nombre } | { error, estado } */
  function restaurar(file, { porDefecto } = {}) {
    const f = path.basename(String(file ?? '')), src = path.join(TRASH, f);
    if (!/__\d+\.md$/.test(f) || !fs.existsSync(src) || !dentro(src)) return { error: 'No está en la papelera.', estado: 404 };
    const nombre = f.replace(/__\d+\.md$/, ''); let dir = porDefecto;
    try { const j = JSON.parse(fs.readFileSync(path.join(TRASH, f.replace(/\.md$/, '.json')), 'utf8')); const d = path.dirname(path.join(BRAIN, j.de)); if (j.de && !fuera(d)) dir = d; } catch { /* sin ficha: a la carpeta de siempre */ }
    let destino = path.join(dir, nombre + '.md');
    for (let k = 2; fs.existsSync(destino) || igualSinMayusculas(path.basename(destino, '.md')); k++) destino = path.join(dir, `${nombre}-${k}.md`);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    renombrar(src, destino);
    try { fs.rmSync(path.join(TRASH, f.replace(/\.md$/, '.json')), { force: true }); } catch { /* ya no está */ }
    return { ok: true, nombre: path.basename(destino, '.md') };
  }

  return { crear, guardar, agregar, aPapelera, listarPapelera, restaurar, hallar };
}
