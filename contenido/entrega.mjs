// Agents Office (6 oct 2026, plan M1) — lo que se ENTREGA de una pieza aprobada: cuántas publicaciones, en qué redes, con qué texto,
// qué archivos y a qué hora. Puro (sin red ni disco): lo usan los conductores (contenido/conductores.mjs) y lo prueban los tests.
//
// Una pieza puede ser varias entregas:
//   · el post y, si se pidió «también como historia», la historia, unos minutos después (momentoDeVariante, de las reglas portadas);
//   · las redes que llevan el MISMO texto van juntas en una publicación (Metricool publica una en varias redes); una red con su propio
//     texto (Facebook con «Texto de Facebook», o cualquiera con `textos[red]`, M2) va en otra.
//   entregasDe(pieza) → [{ clave, variante, redes, texto, comentario, medios (ids del Estudio), momento (ms), formato, extras }]
//   estadoGeneral(redes) → 'en_red' | 'publicada' | 'parcial' | 'fallo'
import { postDePieza, publicacionDeVariante, momentoDeVariante, textoPara, primerComentario, mediosDe, conHistoria, colaboradoresDe } from '../src/contenido-reglas.js';

/** Las redes que tienen historias (y en las que el primer comentario existe). */
const CON_HISTORIA = ['instagram', 'facebook'];
const CON_COMENTARIO = ['instagram', 'facebook', 'linkedin', 'youtube', 'tiktok'];

export function entregasDe(pieza = {}) {
  const post = postDePieza(pieza), out = [];
  const variantes = ['post', ...(conHistoria(post) ? ['historia'] : [])];
  for (const variante of variantes) {
    const pub = publicacionDeVariante(post, variante);
    const momento = Date.parse(momentoDeVariante(pieza.fecha, pieza.hora, post, variante) || '');
    if (!Number.isFinite(momento)) continue;
    const redes = (pieza.redes || []).filter(r => variante === 'post' || CON_HISTORIA.includes(r));
    const grupos = new Map();
    for (const red of redes) {
      const propio = String(pieza.textos?.[red] ?? '').trim();
      const texto = pub.format === 'historia' ? '' : (propio || textoPara(pub, red));
      const comentario = pub.format === 'historia' || !CON_COMENTARIO.includes(red) ? '' : primerComentario(pub);
      const k = JSON.stringify([texto, comentario]);
      if (!grupos.has(k)) grupos.set(k, { texto, comentario, redes: [] });
      grupos.get(k).redes.push(red);
    }
    let i = 0;
    for (const g of grupos.values()) {
      out.push({
        clave: `${variante}:${i++}`, variante, redes: g.redes, texto: g.texto, comentario: g.comentario,
        medios: mediosDe(pub).map(m => m.src), momento, formato: pub.format,
        extras: { colaboradores: variante === 'post' ? colaboradoresDe(post) : [], youtube: pieza.youtube || null, pinterest: pieza.pinterest || null, tiktok: pieza.tiktok || null },
      });
    }
  }
  return out;
}

/** El estado de lo entregado, a partir del de cada red: todo publicado, algo falló, todo falló, o todavía no salió. */
export function estadoGeneral(redes = {}) {
  const e = Object.values(redes).map(x => x?.estado);
  if (!e.length) return 'en_red';
  if (e.every(x => x === 'publicada')) return 'publicada';
  if (e.every(x => x === 'fallo')) return 'fallo';
  if (e.some(x => x === 'fallo') && e.every(x => x === 'fallo' || x === 'publicada')) return 'parcial';
  return 'en_red';
}
