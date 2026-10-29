// UX-11 (29 oct 2026) — la «línea de IA» de la cabecera de Dimitri se quitó: lo que decía vive en un ícono ⓘ con su popover, y solo una ALERTA REAL
// (gasto pasado del tope, modelo de respaldo en uso, el último turno falló por la IA) se ve sin abrirlo: un punto sobre el ⓘ y, una vez, un mensaje en el hilo.
// Puro (sin DOM): lo comparten el chat de escritorio (src/sub.js) y el del teléfono (src/movil/vistas/dimitri.js). `info` es lo que trae GET /api/sub → `ia`.

const usd = n => 'US$' + (+n || 0).toFixed(2).replace('.', ',');

/** Lo que el popover enseña: [{ k, titulo, valor, alto? }]. `nube`: chat privado de la nube. */
export function filasIa(i, { nube = false } = {}) {
  if (!i || !i.nombre) return [];
  const g = i.gasto, f = [{ titulo: 'Modelo', valor: i.nombre }, { titulo: 'Consultas', valor: i.consultas ? 'consulta la oficina por sí mismo' : i.herramientas ? 'sin consultas (apagadas)' : 'solo conversa (este modelo no usa herramientas)' }];
  if (g) f.push({ titulo: 'Gasto de IA del mes', valor: usd(g.usd) + (g.tope ? ' de ' + usd(g.tope) : ''), alto: g.nivel === 'over' || g.nivel === 'alert' });
  if (nube) f.push({ titulo: 'Privacidad', valor: 'solo tú ves este chat' });
  return f;
}

/** Alertas reales → [{ id, texto }]: gasto pasado del tope, modelo de respaldo, último turno fallido por la IA (`fallo`: { at, motivo }, del servidor o anotado por la página). El fallo ya sale como error en el hilo: solo da el punto. */
export function alertasIa(i, fallo = null) {
  const a = [], g = i && i.gasto, r = i && i.respaldo, e = fallo || (i && i.fallo);
  if (g && g.nivel === 'over') a.push({ id: 'gasto:' + (g.tope || 0), texto: `El gasto de IA del mes (${usd(g.usd)}) ya pasó el tope${g.tope ? ' de ' + usd(g.tope) : ''}.` });
  if (r) a.push({ id: 'respaldo:' + (r.a || r.de || ''), texto: `Uso un modelo de respaldo${r.a ? ' (' + r.a + ')' : ''}${r.de ? ' en vez de ' + r.de : ''}${r.motivo ? ': ' + r.motivo : ''}.` });
  if (e) a.push({ id: 'fallo:' + (e.at || 0), texto: `El último turno falló por la IA${e.motivo ? ' (' + String(e.motivo).slice(0, 140) + ')' : ''}.`, enHilo: false });
  return a;
}

/** Las alertas que aún no se dijeron en el hilo (`dichas`: Set de ids). */
export const avisosParaHilo = (alertas, dichas) => alertas.filter(x => x.enHilo !== false && !dichas.has(x.id));

/** El HTML del popover (`esc`: el escapador de la página; `cambia`: muestra «Cambiar el modelo»). */
export function popoverHTML(i, alertas, { esc, nube = false, cambia = false }) {
  const f = filasIa(i, { nube });
  if (!f.length && !alertas.length) return '<p>La oficina no informa su IA.</p>';
  return (alertas.length ? `<ul class="sb-ia-al">${alertas.map(x => `<li>${esc(x.texto)}</li>`).join('')}</ul>` : '')
    + (f.length ? `<dl class="sb-ia-dl">${f.map(r => `<dt>${esc(r.titulo)}</dt><dd${r.alto ? ' class="sb-ia-alto"' : ''}>${esc(r.valor)}</dd>`).join('')}</dl>` : '')
    + (cambia && f.length ? '<button type="button" class="sb-ia-cambiar">Cambiar el modelo</button>' : '');
}
