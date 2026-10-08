// Agents Office (8 oct 2026, C1: el editor nuevo de Contenido) — «✨ Mejorar con Marketing»: el agente de contenido de la oficina reescribe
// el texto de una pieza con la voz de la marca, sus instrucciones, sus skills y sus lecciones, las cifras y el contexto de marketing del
// Cerebro. No es una IA genérica: es TU agente. Devuelve una PROPUESTA; el dueño la usa, la cambia o la descarta (nada se guarda solo).
//   agenteDeContenido(agentes, departamentos) → el puesto que escribe (redes, Instagram, contenido) o el jefe de Marketing
//   promptMejorar({ empresa, agente, instrucciones, voz, contexto, cifras, pieza, red, limite, pide }) → { system, user }
//   leerPropuesta(texto) → { texto, porque }   (lanza un error en palabras si la respuesta no sirve)
// Puro (sin red ni disco): serve.mjs le pone el modelo; tests/contenido-editor.test.mjs lo prueba.

const NOMBRE_RED = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X', threads: 'Threads', bluesky: 'Bluesky', tiktok: 'TikTok', pinterest: 'Pinterest', youtube: 'YouTube' };
const corta = (t, n) => { const s = String(t ?? '').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };

/** Quién escribe: el puesto de Marketing (o de los departamentos de Contenido) que hace redes; si no hay, el jefe de Marketing. */
export function agenteDeContenido(agentes = [], departamentos = ['marketing']) {
  const de = agentes.filter(a => departamentos.includes(a.department));
  const hace = a => `${a.name} ${a.role} ${a.does}`;
  return de.find(a => !a.lead && /instagram|redes|social|contenido|content|organic/i.test(hace(a)))
    || de.find(a => /instagram|redes|social|contenido|content/i.test(hace(a)))
    || de.find(a => a.department === 'marketing' && a.lead) || de[0] || agentes.find(a => a.department === 'marketing') || null;
}

export function promptMejorar({ empresa = 'la empresa', agente = {}, instrucciones = '', voz = '', contexto = '', cifras = '', pieza = {}, red = '', formato = '', limite = 0, pide = '' } = {}) {
  const donde = red ? NOMBRE_RED[red] || red : 'todas sus redes';
  const system = [
    `Eres ${agente.name || 'el agente de contenido'} (${agente.role || 'contenido para redes'}) de ${empresa}. ${agente.does || ''}`.trim(),
    'El dueño está escribiendo una publicación en el calendario de Contenido y te pide que mejores el TEXTO. Tú propones; el dueño decide. Nada se publica por esto.',
    instrucciones ? `\n${corta(instrucciones, 7000)}` : '',
    voz ? `\nVOZ DE LA MARCA (nota voice del Cerebro: síguela)\n${corta(voz, 2500)}` : '',
    contexto ? `\nCONTEXTO DE MARKETING (nota contexto-marketing)\n${corta(contexto, 3000)}` : '',
    cifras ? corta(cifras, 2500) : '',
    '\nREGLAS',
    `- Escribe el texto para ${donde}${formato ? ` (${formato})` : ''}${limite ? `: como mucho ${limite} caracteres, con margen` : ''}. La primera línea es el gancho: es lo que se lee antes de «más».`,
    '- No inventes precios, fechas, promociones, direcciones, datos ni testimonios: usa solo los que están en el texto, las notas o las cifras. Si falta un dato que haría falta, no lo pongas y dilo en «porque».',
    '- Conserva los enlaces, las @menciones y los datos que ya trae el texto. Escribe en el idioma del texto (español si está vacío).',
    '- Sin hashtags dentro del texto: van en su propio campo (si el texto los trae al final, quítalos).',
    '- Si el texto está vacío, escríbelo a partir del título y las notas.',
    '\nDevuelve SOLO un objeto JSON, sin bloque de código: {"texto":"<el texto propuesto, listo para publicar>","porque":"<una línea: qué cambiaste y por qué>"}',
  ].filter(Boolean).join('\n');
  const user = [
    pieza.titulo ? `Título (no se publica): ${corta(pieza.titulo, 140)}` : '',
    `Formato: ${formato || pieza.formato || 'post'} · Redes: ${(pieza.redes || []).map(r => NOMBRE_RED[r] || r).join(', ') || 'Instagram'}${(pieza.medios || []).length ? ` · ${pieza.medios.length} archivo(s)` : ' · sin imagen todavía'}`,
    pieza.notas ? `Notas del equipo (no se publican): ${corta(pieza.notas, 1500)}` : '',
    pieza.hashtags ? `Hashtags (van aparte): ${corta(pieza.hashtags, 400)}` : '',
    pide ? `Lo que pide el dueño: ${corta(pide, 300)}` : 'Lo que pide el dueño: mejóralo (más claro, con gancho y con la voz de la marca).',
    `\nTexto actual${red ? ` para ${donde}` : ''}:\n${String(pieza.texto ?? '').trim() || '(vacío)'}`,
  ].filter(Boolean).join('\n');
  return { system, user };
}

/** La respuesta del modelo → { texto, porque }. Acepta el JSON con o sin bloque de código; sin un texto, un error que se entiende. */
export function leerPropuesta(raw) {
  const s = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let j = null; try { j = JSON.parse(s); } catch { const m = /\{[\s\S]*\}/.exec(s); if (m) { try { j = JSON.parse(m[0]); } catch {} } }
  const texto = String(j?.texto ?? '').replace(/\r\n/g, '\n').trim();
  if (!texto) throw Object.assign(new Error('la propuesta llegó cortada: pídela otra vez'), { status: 502 });
  return { texto: texto.slice(0, 70000), porque: String(j?.porque ?? '').replace(/\s+/g, ' ').trim().slice(0, 300) };
}
