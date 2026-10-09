// Agents Office — Anuncios de Meta, Fase A3 (9 oct 2026): «✨ Mejorar con el agente de anuncios». Como «Mejorar con Marketing» en Contenido
// (contenido/mejorar.mjs): TU agente de anuncios (`ada`) propone el texto principal o el titular de un creativo con su brief, sus skills y
// lecciones, la voz de la marca, el contexto de marketing, las cifras y los métodos de la Biblioteca (campanas-pagadas, creatividad-anuncios).
// Devuelve una PROPUESTA; nada se guarda solo y nada va a Meta. Puro (sin red ni disco): serve.mjs le pone el modelo.
//   agenteDeAnuncios(agentes) → `ada`, o el puesto de Marketing que hace anuncios, o el jefe de Marketing
//   promptMejorarAnuncio({ … }) → { system, user }
//   leerPropuesta(texto) → { texto, porque }   (la misma de Contenido)
import { leerPropuesta } from '../contenido/mejorar.mjs';
import { OBJETIVO_BORRADOR_TEXTO, DESTINO_TEXTO, LLAMADA_TEXTO } from './modelo.mjs';

export { leerPropuesta };
export const LIMITES = { texto: 125, titular: 40 }; // lo que se ve sin «Ver más» (texto) y sin cortarse (titular), buena práctica de Meta
const corta = (t, n) => { const s = String(t ?? '').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };

/** Quién escribe: `ada` (el puesto de anuncios de fábrica); si no está, el de Marketing que hace anuncios; si no, el jefe de Marketing. */
export function agenteDeAnuncios(agentes = []) {
  const mk = agentes.filter(a => a.department === 'marketing');
  return mk.find(a => a.id === 'ada') || mk.find(a => !a.lead && /anuncio|pagad|ads|meta ads|publicidad/i.test(`${a.name} ${a.role} ${a.does}`)) || mk.find(a => a.lead) || mk[0] || null;
}

export function promptMejorarAnuncio({ empresa = 'la empresa', agente = {}, instrucciones = '', voz = '', contexto = '', cifras = '', metodos = '', borrador = {}, creativo = {}, campo = 'texto', pide = '' } = {}) {
  const que = campo === 'titular' ? 'el TITULAR' : 'el TEXTO PRINCIPAL', lim = LIMITES[campo] || LIMITES.texto;
  const objetivo = `${OBJETIVO_BORRADOR_TEXTO[borrador.objetivo] || borrador.objetivo || 'sin objetivo'}${borrador.destino ? ` (por ${DESTINO_TEXTO[borrador.destino]})` : ''}`;
  const system = [
    `Eres ${agente.name || 'el agente de anuncios'} (${agente.role || 'anuncios pagados en Meta'}) de ${empresa}. ${agente.does || ''}`.trim(),
    `El dueño está preparando un anuncio de Meta (Facebook e Instagram) en la oficina y te pide que mejores ${que} de un creativo. Tú propones; el dueño decide. Nada se publica ni se gasta por esto.`,
    instrucciones ? `\n${corta(instrucciones, 7000)}` : '',
    voz ? `\nVOZ DE LA MARCA (nota voice del Cerebro: síguela)\n${corta(voz, 2500)}` : '',
    contexto ? `\nCONTEXTO DE MARKETING (nota contexto-marketing)\n${corta(contexto, 3000)}` : '',
    metodos ? `\nMÉTODOS DE LA BIBLIOTECA (cómo se escriben anuncios que funcionan)\n${corta(metodos, 6000)}` : '',
    cifras ? corta(cifras, 2500) : '',
    '\nREGLAS',
    campo === 'titular'
      ? `- Un titular de como mucho ${lim} caracteres: el beneficio o la oferta, concreto. Sin emojis ni signos de exclamación seguidos.`
      : `- El texto principal: las primeras ${lim} caracteres son las que se leen sin «Ver más»: ahí va el gancho y el beneficio. Puede ser más largo si hace falta, nunca más de 500.`,
    `- El objetivo de la campaña es «${objetivo}»: el texto lleva a ESO${borrador.objetivo === 'mensajes' ? ' (que escriban: invita a mandar un mensaje)' : borrador.objetivo === 'web' || borrador.objetivo === 'ventas' ? ' (que entren a la web)' : ''}.`,
    '- No inventes precios, fechas, promociones, direcciones, garantías, datos ni testimonios: usa solo los del texto, las notas o las cifras. Si falta un dato, no lo pongas y dilo en «porque».',
    '- Nada que Meta rechace: promesas de resultados garantizados, atributos personales («¿tienes deudas?», «¿estás gordo?»), antes/después engañosos, mayúsculas sostenidas.',
    '- Escribe en el idioma del texto (español si está vacío). Sin hashtags.',
    '\nDevuelve SOLO un objeto JSON, sin bloque de código: {"texto":"<la propuesta, lista para usar>","porque":"<una línea: qué cambiaste y por qué>"}',
  ].filter(Boolean).join('\n');
  const user = [
    `Campaña: «${corta(borrador.nombre, 80)}» · objetivo ${objetivo}${borrador.presupuesto?.usd ? ` · US$${borrador.presupuesto.usd} ${borrador.presupuesto.tipo === 'diario' ? 'al día' : 'en total'}` : ''}${borrador.enlace ? ` · lleva a ${corta(borrador.enlace, 120)}` : ''}`,
    `Creativo ${creativo.id || ''}: ${creativo.formato || 'formato sin elegir'}${creativo.llamada ? ` · botón «${LLAMADA_TEXTO[creativo.llamada] || creativo.llamada}»` : ''}`,
    campo === 'titular' && creativo.texto ? `Texto principal (no lo cambies): ${corta(creativo.texto, 500)}` : '',
    campo === 'texto' && creativo.titular ? `Titular (no lo cambies): ${corta(creativo.titular, 120)}` : '',
    pide ? `Lo que pide el dueño: ${corta(pide, 300)}` : `Lo que pide el dueño: mejóralo (más claro, con gancho y con la voz de la marca).`,
    `\n${campo === 'titular' ? 'Titular' : 'Texto principal'} actual:\n${String((campo === 'titular' ? creativo.titular : creativo.texto) ?? '').trim() || '(vacío)'}`,
  ].filter(Boolean).join('\n');
  return { system, user };
}
