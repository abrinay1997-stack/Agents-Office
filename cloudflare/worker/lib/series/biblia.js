// Series en la nube: la biblia visual y las hojas de personaje, LEÍDAS de las notas del Cerebro en D1 (la oficina local las lee de `Marca/biblia-visual.md` y `Estudio/Personajes/*.md`; la migración
// del Cerebro las trae con grupo «Marca» y «Estudio»). Solo LEE: escribir la biblia (proponerla con IA, aprobarla) sigue siendo de la oficina local por ahora. Mismo formato de salida que biblia-local.mjs.
import * as B from '../../../../biblia-core.mjs';

const NOTA_BIBLIA = 'biblia-visual', GRUPO_BIBLIA = 'Marca', GRUPO_HOJAS = 'Estudio';
export const MAX_HOJAS = 100;

/** La biblia de ahora: `{ existe, version, estado, biblia, problemas }` (o `error` si la nota está rota). */
export async function leerBiblia(db) {
  const f = await db.prepare('select texto from notas where nombre = ? and grupo = ?').bind(NOTA_BIBLIA, GRUPO_BIBLIA).first();
  if (!f) return { existe: false, version: 0, estado: null, biblia: B.normalizarBiblia({}), problemas: [] };
  const r = B.leerBiblia(String(f.texto));
  if (r.error) return { existe: true, error: r.error, version: 0, estado: null, biblia: B.normalizarBiblia({}), problemas: [] };
  return { existe: true, version: r.version, estado: r.estado, aprobada_por: r.aprobada_por, biblia: r.biblia, problemas: B.validarBiblia(r.biblia) };
}
/** Las hojas de personaje y de producto (notas del grupo «Estudio» cuyo encabezado es `tipo: hoja-personaje`; las demás notas de «Estudio» —presets, plantillas— se saltan). */
export async function leerHojas(db) {
  const { results } = await db.prepare('select nombre, texto from notas where grupo = ? and instr(substr(texto, 1, 80), ?) > 0 order by nombre limit ?').bind(GRUPO_HOJAS, `tipo: ${B.TIPO_HOJA}`, MAX_HOJAS).all();
  const out = [];
  for (const f of results) {
    try { const r = B.leerHoja(String(f.texto)); if (r.ok) out.push({ ...r.hoja, problemas: B.validarHoja(r.hoja) }); } catch { /* una nota rota no tumba la lista */ }
  }
  return out;
}
