// Agents Office (6 oct 2026, plan M5 · U10) — el INFORME DEL MES en Analíticas: el texto que arma la oficina (contenido/informe.mjs),
// pintado en la página. Un markdown mínimo y seguro: títulos, viñetas, **negrita**, _cursiva_ y enlaces https; todo lo demás, escapado.
//   informeHTML(texto, esc) → HTML (puro, con test)
//   mesesAtras(hoy, n) → ['2026-10', '2026-09', …]
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = m => { const [y, mm] = m.split('-').map(Number); return `${MESES[mm - 1]} de ${y}`; };
export function mesesAtras(hoy = new Date(), n = 6) { const out = []; for (let i = 0; i < n; i++) { const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); } return out; }

export function informeHTML(texto = '', esc = s => String(s)) {
  const linea = t => esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|\s)_([^_]+)_(?=\s|$|[.,;:])/g, '$1<i>$2</i>').replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  const out = []; let lista = false;
  for (const l of String(texto).split('\n')) {
    const h = /^(#{1,3})\s+(.*)$/.exec(l), li = /^-\s+(.*)$/.exec(l);
    if (!li && lista) { out.push('</ul>'); lista = false; }
    if (h) { const n = Math.min(4, h[1].length + 1); out.push(`<h${n}>${linea(h[2])}</h${n}>`); }
    else if (li) { if (!lista) { out.push('<ul>'); lista = true; } out.push(`<li>${linea(li[1])}</li>`); }
    else if (l.trim()) out.push(`<p>${linea(l)}</p>`);
  }
  if (lista) out.push('</ul>');
  return out.join('');
}
