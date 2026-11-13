// La pantalla de permiso del conector (GET /conectar-claude): una página NATIVA del Worker, sin JavaScript y con una CSP estricta (la página de la oficina está a pocos KB de su tope: aquí no se toca).
// La CSP no deja cargar nada de fuera ni ejecutar nada; los estilos llevan un nonce por petición; `frame-ancestors 'none'` y X-Frame-Options impiden meterla en un marco (clickjacking de «Aprobar»);
// `form-action` admite solo esta oficina y a dónde vuelve cada cliente permitido (Chrome también lo aplica a la redirección que sigue al POST).
import { ALCANCES } from './constantes.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const csp = (nonce) => `default-src 'none'; style-src 'nonce-${nonce}'; form-action 'self' https://claude.ai https://claude.com http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'; base-uri 'none'`;
export const cabecerasPagina = (nonce) => ({
  'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': csp(nonce), 'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin',
});

const ESTILO = `:root{color-scheme:light dark;--fondo:#f6f7f9;--tarjeta:#fff;--texto:#14181f;--suave:#4a5362;--borde:#c9d0da;--azul:#1e4fbf;--rojo:#a61b1b}
@media (prefers-color-scheme:dark){:root{--fondo:#10131a;--tarjeta:#181c25;--texto:#eef1f6;--suave:#a9b2c1;--borde:#3a4252;--azul:#8db4ff;--rojo:#ff9a9a}}
*{box-sizing:border-box}body{margin:0;background:var(--fondo);color:var(--texto);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px}
main{max-width:560px;margin:24px auto}.t{background:var(--tarjeta);border:1px solid var(--borde);border-radius:12px;padding:20px}
h1{font-size:1.3rem;margin:0 0 8px}p{margin:8px 0}.s{color:var(--suave)}.c{font-family:ui-monospace,Menlo,monospace;font-size:.9rem;word-break:break-all}
fieldset{border:0;padding:0;margin:16px 0}legend{font-weight:600;margin-bottom:6px}
label.o{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--borde);border-radius:10px;padding:12px;margin:8px 0;min-height:44px}
label.o input{margin-top:4px;width:20px;height:20px}label.o b{display:block}label.o small{display:block;color:var(--suave)}
.n{display:block;width:100%;font:inherit;padding:10px;border:1px solid var(--borde);border-radius:8px;background:transparent;color:inherit;min-height:44px}
.b{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}button{font:inherit;min-height:44px;padding:10px 18px;border-radius:10px;border:1px solid var(--borde);background:transparent;color:inherit;cursor:pointer}
button.p{background:var(--azul);border-color:var(--azul);color:#fff}@media (prefers-color-scheme:dark){button.p{color:#0b1220}}
.e{color:var(--rojo);font-weight:600}.av{border:2px solid var(--rojo);border-radius:10px;padding:12px;margin:8px 0;color:var(--texto)}.av b{color:var(--rojo)}a{color:var(--azul)}`;

const CABEZA = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="same-origin">';
const marco = (nonce, titulo, cuerpo) => `<!doctype html><html lang="es"><head>${CABEZA}<title>${esc(titulo)}</title><style nonce="${esc(nonce)}">${ESTILO}</style></head><body><main><div class="t">${cuerpo}</div></main></body></html>`;

/** Un mensaje sin formulario (error de parámetros, «entra primero», «no eres administrador»). */
export const paginaMensaje = (nonce, titulo, texto, { enlace = null } = {}) =>
  marco(nonce, titulo, `<h1>${esc(titulo)}</h1><p>${esc(texto)}</p>${enlace ? `<p><a href="${esc(enlace.href)}" target="_blank" rel="noopener">${esc(enlace.texto)}</a></p>` : ''}`);

const DESCRIPCION = {
  lectura: ['Solo leer', 'Mira tareas, notas, contenido, cifras… pero no cambia nada. Lo más prudente: es lo que viene elegido.'],
  oficina: ['Leer y escribir, sin gastar', 'Además crea y edita tareas, notas y borradores. Nunca aprueba, envía, publica ni gasta.'],
  gasto: ['Todo lo anterior y preparar un gasto', 'Puede dejar listo un gasto (con su cifra y sus topes). La confirmación es SIEMPRE tuya, en la oficina o en Telegram: este conector nunca la da.'],
};

/** El formulario de permiso. `campos` son los parámetros OAuth ya validados (se reenvían tal cual en campos ocultos). */
export function paginaPermiso({ nonce, cliente, destino, persona, campos, csrf, nombreSugerido }) {
  const aviso = '<p class="av" role="alert"><b>Aprueba solo si acabas de pulsar «Conectar» en Claude.</b> Si alguien te mandó este enlace, cancela: así se roba el acceso a una oficina.</p>';
  const ocultos = Object.entries(campos).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
  const opciones = ALCANCES.map((a) => `<label class="o"><input type="radio" name="alcance" value="${a}"${a === 'lectura' ? ' checked' : ''} required><span><b>${esc(DESCRIPCION[a][0])}</b><small>${esc(DESCRIPCION[a][1])}</small></span></label>`).join('');
  return marco(nonce, 'Conectar Claude con la oficina', `<h1>Conectar Claude con la oficina</h1>
${aviso}
<p>Una aplicación pide entrar a la oficina como <b>${esc(persona.nombre)}</b> (${esc(persona.email)}).</p>
<p class="s">Nombre que dice la aplicación (lo declara ella, no está verificado): <b>${esc(cliente.nombre)}</b><br>Origen verificado al que volverá: <span class="c">${esc(destino)}</span></p>
<p class="s">Solo un administrador puede conectar. Esta conexión se ve y se corta en Ajustes → Conectar Claude.</p>
<form method="post" action="/conectar-claude" autocomplete="off">${ocultos}<input type="hidden" name="csrf" value="${esc(csrf)}">
<fieldset><legend>¿Qué puede hacer esta conexión?</legend>${opciones}</fieldset>
<p><label for="nombre"><b>Nombre de la conexión</b></label><input class="n" id="nombre" name="nombre" maxlength="60" value="${esc(nombreSugerido)}"></p>
<p class="r"><label class="o"><input type="checkbox" name="confirmo" value="si"><span><b>Confirmo que acabo de pedir esta conexión</b><small>Obligatorio para «Leer y escribir» y para «preparar un gasto»: con ellos, esa aplicación cambia cosas en la oficina.</small></span></label></p>
<div class="b"><button class="p" type="submit" name="decision" value="aprobar">Aprobar</button><button type="submit" name="decision" value="cancelar">Cancelar</button></div></form>`);
}
