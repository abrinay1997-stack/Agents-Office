// Agents Office (6 oct 2026, plan T2 · §6) — AÑADIR RÁPIDO: una frase con lo que el dueño escribe de corrido → los campos de la tarea.
//   «urgente: propuesta para Acme para el viernes #ventas-q4»  → prioridad alta · límite el viernes · etiqueta «ventas-q4»
//   «!baja revisar el inventario antes del 20»                 → prioridad baja · límite el 20 (de este mes, o del siguiente si ya pasó)
//   «el lunes a las 9 manda el resumen»                        → ARRANCA el lunes a las 9 (eso lo dice src/when.js → parseOnce)
// La fecha límite es «para …» / «antes de …» / «hasta el …»; un día sin esas palabras es cuándo arranca. Puro, con test.
import { parseOnce } from '../src/when.js';

const DIAS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6 };
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const limpio = s => s.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').replace(/^[\s,.;:–—-]+|[\s,;:–—-]+$/g, '').trim();

export function leerRapida(texto, ahora = new Date()) {
  let s = ` ${String(texto || '')} `; const out = { etiquetas: [] };
  // etiquetas: #palabra (letras, números, guiones)
  s = s.replace(/(^|\s)#([\p{L}\p{N}][\p{L}\p{N}_-]{0,29})/gu, (m, a, e) => { out.etiquetas.push(e.toLowerCase()); return a; });
  // prioridad: !alta !media !baja, «urgente», «prioridad alta»
  s = s.replace(/(^|\s)!(alta|media|baja)\b/i, (m, a, p) => { out.prioridad = p.toLowerCase(); return a; });
  if (!out.prioridad) s = s.replace(/(^|\s)(?:prioridad\s+(alta|media|baja)|(urgente)\s*:?)(?=\s|$)/i, (m, a, p, u) => { out.prioridad = u ? 'alta' : p.toLowerCase(); return a; });
  // fecha límite
  const base = new Date(ahora); base.setHours(0, 0, 0, 0);
  const re = /(^|\s)(?:para|antes\s+del?|hasta\s+el|vence\s+el|l[ií]mite:?)\s+(hoy|ma[ñn]ana|pasado\s+ma[ñn]ana|(?:el\s+)?(?:pr[oó]ximo\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)|(?:el\s+)?(\d{1,2})(?:\s*(?:\/|de)\s*(\d{1,2}|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre))?)(?=[\s,.;]|$)/i;
  const MES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  const m = re.exec(s);
  if (m) {
    const w = m[2].toLowerCase(); let d = null;
    if (w === 'hoy') d = new Date(base);
    else if (/^pasado/.test(w)) { d = new Date(base); d.setDate(d.getDate() + 2); }
    else if (/^ma[ñn]ana$/.test(w)) { d = new Date(base); d.setDate(d.getDate() + 1); }
    else if (m[3]) { const want = DIAS[m[3].toLowerCase()]; d = new Date(base); let add = (want - d.getDay() + 7) % 7; if (add === 0 || /pr[oó]ximo/i.test(w)) add = add || 7; d.setDate(d.getDate() + add); }
    else if (m[4]) {
      const dia = +m[4], mes = m[5] ? (MES[m[5].toLowerCase()] || +m[5]) : null;
      d = new Date(base); if (mes) d.setMonth(mes - 1, dia); else d.setDate(dia);
      if (d.getDate() !== dia) d = null; // 31 de febrero
      else if (d < base) mes ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1, dia);
    }
    if (d) { out.limite = ymd(d); s = s.slice(0, m.index) + m[1] + s.slice(m.index + m[0].length); }
  }
  // un día SIN «para»: cuándo arranca (lo de siempre)
  const once = parseOnce(s, ahora);
  if (once && !once.past && once.at) { out.at = once.at; out.horaSupuesta = !!once.guessed; s = once.text; }
  out.texto = limpio(s); if (out.texto) out.texto = out.texto[0].toLocaleUpperCase('es') + out.texto.slice(1); // «inventario…» → «Inventario…»: es el título mientras el enrutador no da otro
  if (!out.etiquetas.length) delete out.etiquetas;
  return out;
}
