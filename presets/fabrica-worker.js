// GENERADO por scripts/generar-fabrica-worker.mjs — no se edita a mano. La fábrica del banco de presets para el Worker.
// Mismo armazón que presets/fabrica.mjs (cargarFabrica): ver presets/fabrica-core.mjs. El test cloudflare/tests/presets-fabrica-worker.test.mjs compara las dos, byte a byte.
import { armarFabrica } from './fabrica-core.mjs';
import p_catalogo from './catalogo.json' with { type: 'json' };
import p_grupos from './grupos.json' with { type: 'json' };
import p_tipos from './tipos.json' with { type: 'json' };
import p_canales from './canales.json' with { type: 'json' };
import p_familias from './familias.json' with { type: 'json' };
import p_iconos from './iconos.json' with { type: 'json' };
import p_sinonimos from './sinonimos.json' with { type: 'json' };
import g_imagen_catalogo from './imagen/catalogo.json' with { type: 'json' };
import g_imagen_fondo from './imagen/fondo.json' with { type: 'json' };
import g_imagen_sombra from './imagen/sombra.json' with { type: 'json' };
import g_imagen_luz from './imagen/luz.json' with { type: 'json' };
import g_imagen_color from './imagen/color.json' with { type: 'json' };
import g_imagen_limpieza from './imagen/limpieza.json' with { type: 'json' };
import g_imagen_calidad from './imagen/calidad.json' with { type: 'json' };
import g_imagen_encuadre from './imagen/encuadre.json' with { type: 'json' };
import g_imagen_escena from './imagen/escena.json' with { type: 'json' };
import g_imagen_personas from './imagen/personas.json' with { type: 'json' };
import g_imagen_referencia from './imagen/referencia.json' with { type: 'json' };
import g_imagen_marketing from './imagen/marketing.json' with { type: 'json' };
import g_imagen_salida from './imagen/salida.json' with { type: 'json' };
import g_video_camara from './video/camara.json' with { type: 'json' };
import g_video_plano from './video/plano.json' with { type: 'json' };
import g_video_vproducto from './video/vproducto.json' with { type: 'json' };
import g_video_look from './video/look.json' with { type: 'json' };
import g_video_veditar from './video/veditar.json' with { type: 'json' };
import g_video_vformato from './video/vformato.json' with { type: 'json' };
import g_video_vsonido from './video/vsonido.json' with { type: 'json' };
import g_musica_musica from './musica/musica.json' with { type: 'json' };
import g_musica_voz from './musica/voz.json' with { type: 'json' };

const ARCHIVOS = {
  'imagen/catalogo.json': g_imagen_catalogo,
  'imagen/fondo.json': g_imagen_fondo,
  'imagen/sombra.json': g_imagen_sombra,
  'imagen/luz.json': g_imagen_luz,
  'imagen/color.json': g_imagen_color,
  'imagen/limpieza.json': g_imagen_limpieza,
  'imagen/calidad.json': g_imagen_calidad,
  'imagen/encuadre.json': g_imagen_encuadre,
  'imagen/escena.json': g_imagen_escena,
  'imagen/personas.json': g_imagen_personas,
  'imagen/referencia.json': g_imagen_referencia,
  'imagen/marketing.json': g_imagen_marketing,
  'imagen/salida.json': g_imagen_salida,
  'video/camara.json': g_video_camara,
  'video/plano.json': g_video_plano,
  'video/vproducto.json': g_video_vproducto,
  'video/look.json': g_video_look,
  'video/veditar.json': g_video_veditar,
  'video/vformato.json': g_video_vformato,
  'video/vsonido.json': g_video_vsonido,
  'musica/musica.json': g_musica_musica,
  'musica/voz.json': g_musica_voz,
};

let FAB = null;
/** La fábrica (catálogo, grupos, presets, iconos…), armada una vez por instancia del Worker. */
export function cargarFabrica() {
  return (FAB ||= armarFabrica({
    catalogo: p_catalogo,
    grupos: p_grupos,
    tipos: p_tipos,
    canales: p_canales,
    familias: p_familias,
    iconos: p_iconos,
    sinonimos: p_sinonimos,
    archivos: ARCHIVOS,
  }));
}
