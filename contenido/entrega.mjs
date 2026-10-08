// Agents Office (6 oct 2026, plan M1) — lo que se ENTREGA de una pieza aprobada: cuántas publicaciones, en qué redes, con qué texto,
// qué archivos y a qué hora. Puro (sin red ni disco): lo usan los conductores (contenido/conductores.mjs) y lo prueban los tests.
//
// Una pieza puede ser varias entregas:
//   · el post y, si se pidió «también como historia», la historia, unos minutos después (momentoDeVariante, de las reglas portadas);
//   · las redes que llevan el MISMO texto van juntas en una publicación (Metricool publica una en varias redes); una red con su propio
//     texto (Facebook con «Texto de Facebook», o cualquiera con `textos[red]`, M2) va en otra;
//   · (C1, 8 oct 2026) y una red con OTRO FORMATO también va en otra (el mismo video: reel en Instagram, post en Facebook). La historia
//     «también» no sale en una red que ya publica la pieza como historia.
//   entregasDe(pieza) → [{ clave, variante, redes, texto, comentario, medios (ids del Estudio), momento (ms), formato, extras }]
//   estadoGeneral(redes) → 'en_red' | 'publicada' | 'parcial' | 'fallo'
import { postDePieza, publicacionDeVariante, momentoDeVariante, textoPara, primerComentario, mediosDe, historiasDe, colaboradoresDe, formatoDe } from '../src/contenido-reglas.js';

/** Las redes que tienen historias (y en las que el primer comentario existe). */
const CON_HISTORIA = ['instagram', 'facebook'];
const CON_COMENTARIO = ['instagram', 'facebook', 'linkedin', 'youtube', 'tiktok'];

export function entregasDe(pieza = {}) {
  const post = postDePieza(pieza), out = [];
  const deRedes = (pieza.redes || []), conPost = deRedes.filter(r => !['historia', 'live'].includes(formatoDe(post, r)));
  const variantes = ['post', ...(post.historiaTambien && conPost.length && historiasDe(post).length ? ['historia'] : [])];
  for (const variante of variantes) {
    const base = publicacionDeVariante(post, variante);
    const momento = Date.parse(momentoDeVariante(pieza.fecha, pieza.hora, post, variante) || '');
    if (!Number.isFinite(momento)) continue;
    const redes = variante === 'post' ? deRedes : conPost.filter(r => CON_HISTORIA.includes(r));
    const grupos = new Map();
    for (const red of redes) {
      const pub = variante === 'post' ? { ...base, format: formatoDe(post, red) } : base;
      const propio = String(pieza.textos?.[red] ?? '').trim();
      const texto = pub.format === 'historia' ? '' : (propio || textoPara(pub, red));
      const comentario = pub.format === 'historia' || !CON_COMENTARIO.includes(red) ? '' : primerComentario(pub);
      const k = JSON.stringify([texto, comentario, pub.format]);
      if (!grupos.has(k)) grupos.set(k, { texto, comentario, formato: pub.format, redes: [] });
      grupos.get(k).redes.push(red);
    }
    let i = 0;
    for (const g of grupos.values()) {
      out.push({
        clave: `${variante}:${i++}`, variante, redes: g.redes, texto: g.texto, comentario: g.comentario,
        medios: mediosDe(base).map(m => m.src), momento, formato: g.formato,
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
