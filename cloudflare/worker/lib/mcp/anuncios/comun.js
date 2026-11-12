// Ayudas de los dominios `anuncios` y `analiticas` del conector remoto (P5, carril anuncios). Aquí vive lo que comparten: la oficina en proceso con su lista blanca, los fallos esperados,
// la paginación de texto y —en DATOS— lo que por MCP NUNCA se hace con los anuncios y por qué (`EXCLUIDAS`; lo vigila cloudflare/tests/mcp-anuncios.test.mjs).
import { restringir } from '../capa1/restringir.js';
import { limpiarSecretos } from '../../secretos.js';
import * as safety from '../../../../../safety.mjs';

/** Lo que el conector NO hace con los anuncios (la regla del dinero, plan MCP §4 y §14): cada entrada dice por qué. Ninguna de estas palabras puede aparecer como valor de `accion`. */
export const EXCLUIDAS = Object.freeze({
  activar: 'gasta dinero: lo hace el dueño con dos pasos (la cifra y su confirmación), en Anuncios (J) o en Telegram.',
  reanudar: 'vuelve a gastar: dos pasos del dueño. Tampoco sirve como «deshacer» de una pausa por MCP.',
  subir_presupuesto: 'gasta más: dos pasos del dueño, dentro de sus topes.',
  alargar: 'alarga el gasto de una campaña: dos pasos del dueño.',
  relanzar: 'copia una campaña terminada para gastar otra vez: dos pasos del dueño.',
  archivar: 'no se puede deshacer; el dueño lo hace en Anuncios.',
  crear_en_meta: 'crear en Meta, aunque sea en pausa, es el clic del dueño: aquí solo se dejan borradores en la oficina.',
  impulsar: 'impulsar una publicación crea un anuncio en Meta: es del dueño.',
  aplicar_sugerencia: 'aplicar una sugerencia puede gastar o cambiar Meta: es del dueño (aquí solo se descartan o se posponen).',
  confirmar: 'el segundo paso de un gasto es de una persona: un token de MCP nunca da el segundo paso.',
  deshacer: 'volver atrás una pausa o una baja de presupuesto vuelve a gastar: lo hace el dueño en Anuncios (J).',
  piloto_automatico: 'el piloto automático es una decisión de gasto del dueño (Ajustes → Anuncios).',
  topes_de_gasto: 'los topes de gasto son del dueño (Ajustes → Anuncios): ningún asistente los cambia.',
  sincronizar: 'lee de Meta y gasta la cuota del negocio entero: la corre el reloj de la oficina.',
  conversiones_registrar: 'le dice a Meta lo que se vendió: es del dueño.',
  borrar_borrador: 'borrar es del dueño; un borrador olvidado no gasta nada.',
  variaciones: 'pone a un agente a trabajar: se pide en Anuncios → Creativos.',
});

/** `permitidas`: ver capa1/restringir.js. La oficina se importa PEREZOSAMENTE (modulos/index.js importa al conector: un import estático sería un círculo). */
export async function conOficina(ctx, permitidas) {
  const { crearOficinaMcp } = await import('../capa1/oficina.js');
  return restringir(await crearOficinaMcp({ env: ctx.env, db: ctx.db, usuario: ctx.usuario, ahoraMs: ctx.ahoraMs }), permitidas);
}

/** Un fallo esperado vuelve como texto claro; lo inesperado, además, se registra. Nunca lleva un secreto. */
export function fallo(nombre, e) {
  console.error(`[mcp:${nombre}]`, e?.message ?? e);
  return { texto: `No se pudo: ${limpiarSecretos(String(e?.message || e)).replace(/\s+/g, ' ').slice(0, 300)}`, esError: true };
}

const PAGINA = 15000;
/** Parte un texto largo en páginas de ≤ 15.000 letras: `cursor` es el desplazamiento (texto opaco ≤ 200). → { texto, siguiente? } */
export function paginar(texto, cursor) {
  const t = String(texto ?? ''), d = /^\d{1,7}$/.test(String(cursor ?? '0')) ? Number(cursor || 0) : 0;
  if (d >= t.length && t.length) return { texto: '(no hay más)', esError: false };
  const pedazo = t.slice(d, d + PAGINA), resto = d + PAGINA;
  return { texto: pedazo, ...(resto < t.length ? { siguiente: String(resto) } : {}) };
}

/** Lo que escribió un tercero (un nombre de campaña, un texto de anuncio, un competidor) con órdenes escondidas se SUSTITUYE por un aviso, línea por línea, ANTES del escaneo del servidor (que si no cortaría toda la respuesta). */
export function sanear(texto) {
  return String(texto ?? '').split('\n').map((l) => (safety.injectionIn(l) ? '[texto omitido: parecía traer órdenes escondidas]' : l)).join('\n');
}
