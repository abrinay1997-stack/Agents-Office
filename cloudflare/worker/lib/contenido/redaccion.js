// «✨ Mejorar con Marketing» en la nube: el puesto de redes de Marketing propone el texto de una pieza con la voz de la marca, sus instrucciones, el contexto de marketing y
// las cifras del Cerebro. Es el mismo prompt y la misma lectura de la respuesta que en la oficina local (contenido/mejorar.mjs); lo que cambia es de dónde salen las notas
// (la tabla `notas`) y quién habla con el modelo (worker/lib/ia.js: la API de Anthropic o de Meta, sin herramientas: solo escribe, nada se guarda ni se publica).
// Lo que aún no está en la nube: las skills y las lecciones del agente (fase 4) — hoy se usa su brief fijo.
import { agenteDeContenido, promptMejorar, leerPropuesta } from '../../../../contenido/mejorar.mjs';
import { LIMITES, formatoDe } from '../../../../src/contenido-reglas.js';
import { agentes as listaAgentes, agentePorId } from '../agentes.js';
import { texto as hablar } from '../ia.js';
import { leerDoc } from '../almacen.js';

const EMPRESA = 'PanaClaw';
const nota = async (db, nombre) => (await db.prepare('select texto from notas where nombre = ?').bind(nombre).first())?.texto || '';
const sinCabecera = t => String(t).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

/** Las cifras de la empresa (doc `cifras` de la nube: la misma lista que `cifras.json` local) en el texto que leen los agentes; '' si no hay. */
async function cifrasTexto(db) {
  const { valor } = await leerDoc(db, 'cifras', null);
  const lista = Array.isArray(valor) ? valor : Array.isArray(valor?.cifras) ? valor.cifras : [];
  if (!lista.length) return '';
  return 'CIFRAS DE LA EMPRESA (úsalas tal cual)\n' + lista.slice(0, 60).map(c => `- ${c.name}: ${c.value}${c.unit ? ' ' + c.unit : ''}${c.note ? ` (${c.note})` : ''}`).join('\n');
}

export function crearMejorar({ env, db, config, fetchFn = (...a) => fetch(...a) }) {
  const quien = () => agenteDeContenido(listaAgentes(), config().departamentos);
  return {
    quien: () => quien()?.name || '',
    async mejorar({ pieza, red, pide }) {
      const a = quien(); if (!a) throw Object.assign(new Error('no hay ningún puesto de Marketing'), { status: 409 });
      const completo = agentePorId(a.id), lim = red ? LIMITES[red]?.caracteres : 0;
      const { system, user } = promptMejorar({
        empresa: EMPRESA, agente: a, instrucciones: [].concat(completo?.brief || '').join(' '),
        voz: sinCabecera(await nota(db, 'voice')), contexto: sinCabecera(await nota(db, 'contexto-marketing')), cifras: await cifrasTexto(db),
        pieza, red, formato: red ? formatoDe(pieza, red) : '', limite: lim || 0, pide,
      });
      let raw;
      try { raw = (await hablar(env, { sistema: system, usuario: user, maxTokens: 2500, fetchFn })).texto; }
      catch (e) { throw Object.assign(new Error(e.message), { status: 502 }); }
      return { ...leerPropuesta(raw), agente: a.name, red };
    },
  };
}
