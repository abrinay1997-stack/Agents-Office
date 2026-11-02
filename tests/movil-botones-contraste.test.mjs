// Botones primarios de la versión móvil (2 nov 2026): el dueño los vio EN BLANCO en el iPhone. Causa: `.md-sal-b > .mv-btn { color: inherit }` (y
// `#mvRoot a.mv-btn { color: var(--mv-ink) }`) ganaban a `.mv-btn.primario { color: var(--mv-bg) }` y dejaban el texto del color del fondo (--mv-ink sobre --mv-ink).
// Esta prueba mira las hojas de estilo: ninguna regla puede fijar el color del texto de un `.mv-btn` sin apartar a los primarios, a menos que lo fije al
// color correcto (--mv-bg). La prueba de navegador (scripts/movil-d-recorrido.mjs → contrasteBotones, en tests/movil-d-navegador.test.mjs) mide el contraste
// real (≥ 4,5:1, claro y oscuro) en Anuncios (Sugerencias, Creativos, Campañas), Analíticas, Contenido (Cola, Bandeja) y las hojas del segundo toque.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const archivos = fs.readdirSync(ROOT + 'src/css').filter(f => /^movil.*\.css$/.test(f));

function reglas(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = []; const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) out.push({ sel: m[1].trim(), cuerpo: m[2] });
  return out;
}

test('ninguna regla de la versión móvil deja a un botón primario con el texto del color de su fondo', () => {
  const malos = [];
  for (const f of archivos) for (const { sel, cuerpo } of reglas(fs.readFileSync(ROOT + 'src/css/' + f, 'utf8'))) {
    const color = cuerpo.match(/(?:^|;)\s*color\s*:\s*([^;]+)/);
    if (!color) continue;
    for (const s of sel.split(',').map(x => x.trim())) {
      if (!/\.mv-btn\b/.test(s)) continue;                                  // solo reglas que alcanzan a un .mv-btn
      if (/\.mv-btn[^ >+~]*\.(primario|si)\b/.test(s) || /:not\(\.primario\)/.test(s)) continue; // la regla ya habla de los primarios o los aparta
      if (/\.peligro\b|\.ac-(ok|bad|busy)\b|\[disabled\]|:disabled|\.mv-guardar/.test(s)) continue;
      if (/--mv-bg\b/.test(color[1])) continue;                              // el color correcto de un primario
      if (/(^|\s)a\.mv-btn$/.test(s)) continue;                              // las anclas: el segundo test exige su regla de primario
      malos.push(`${f}: ${s} { color: ${color[1].trim()} }`);
    }
  }
  assert.deepEqual(malos, [], 'estas reglas pueden pisar el color de .mv-btn.primario (texto = fondo):\n' + malos.join('\n'));
});

test('el primario es --mv-ink con texto --mv-bg, y las anclas primarias también', () => {
  const m = fs.readFileSync(ROOT + 'src/css/movil.css', 'utf8'), d = fs.readFileSync(ROOT + 'src/css/movil-d.css', 'utf8');
  assert.match(m, /\.mv-btn\.primario\s*\{[^}]*background:\s*var\(--mv-ink\)[^}]*color:\s*var\(--mv-bg\)/);
  assert.match(d, /#mvRoot a\.mv-btn\.primario[^{]*\{\s*color:\s*var\(--mv-bg\)/);
});
