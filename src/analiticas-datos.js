// Agents Office V4.7 (F2) — de dónde saca Analíticas sus datos.
//   · Con la oficina en marcha: /api/contenido/analiticas (lo que la foto diaria de Meta dejó en data/contenido/).
//   · En la demo (file://, sin servidor) o cuando el dueño pide «ver con datos de ejemplo»: datosDeEjemplo(), que se ve IGUAL que lo real
//     pero lleva `ejemplo: true` y la pantalla lo rotula en grande. Los ejemplos NUNCA se mezclan con lo real: son un juego aparte que se
//     enciende y se apaga, para poder ver cómo queda la pantalla antes de conectar Meta.
// Los datos de ejemplo son deterministas (misma fecha → mismos números): un test los mira, y la captura de la pantalla no cambia sola.
import { sumarDias } from './contenido-cifras.js';

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Un generador pseudoaleatorio pequeño (mulberry32): mismo origen, misma serie. */
function azar(semilla) {
  let a = semilla >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const CUENTAS = [
  { id: 'instagram:ejemplo-ig', red: 'instagram', externoId: 'ejemplo-ig', paginaId: 'ejemplo-p', nombre: 'Tu marca en Instagram', usuario: 'tu_marca', foto: '' },
  { id: 'facebook:ejemplo-fb', red: 'facebook', externoId: 'ejemplo-fb', paginaId: 'ejemplo-fb', nombre: 'Tu marca en Facebook', foto: '' },
];
const TEXTOS = [
  'Llegó la colección de temporada: mírala completa', 'Tres formas de usar tu producto favorito', 'Detrás de cámaras: cómo lo hacemos',
  'Lo que dicen nuestros clientes esta semana', 'Promo de fin de mes: solo hasta el domingo', 'Pregúntanos lo que quieras: respondemos hoy',
  'Antes y después: el resultado de esta semana', 'El equipo te desea un buen lunes', 'Novedad: ya puedes reservar por mensaje directo',
];

/** Lo mismo que devuelve /api/contenido/analiticas, con números inventados y `ejemplo: true`. */
export function datosDeEjemplo(hoy = ymd(new Date())) {
  const rnd = azar(Number(hoy.replaceAll('-', '')) % 100000 + 7);
  const serie = [];
  const base = { instagram: { seg: 4200, alc: 1400, ganan: 5.2 }, facebook: { seg: 2900, alc: 520, ganan: 1.1 } };
  for (const c of CUENTAS) {
    let seg = base[c.red].seg;
    for (let i = 180; i >= 1; i--) {
      const fecha = sumarDias(hoy, -i), dow = new Date(`${fecha}T12:00:00Z`).getUTCDay();
      seg += base[c.red].ganan * (0.4 + rnd() * 1.2);
      const finde = dow === 0 || dow === 6 ? 0.8 : 1, k = c.red === 'instagram' ? 1 : 0.35;
      const alcance = Math.round(base[c.red].alc * (0.6 + rnd() * 1.1) * finde);
      serie.push({
        cuentaId: c.id, red: c.red, fecha, seguidores: Math.round(seg), alcance, vistas: Math.round(alcance * (1.4 + rnd() * 0.5)),
        interacciones: Math.round(alcance * (0.03 + rnd() * 0.04) * k), visitas: Math.round(alcance * (0.02 + rnd() * 0.03)), datos: {},
      });
    }
  }
  const tipos = ['reel', 'carrusel', 'imagen', 'imagen', 'reel', 'carrusel'];
  const publicaciones = [];
  for (let i = 0; i < 40; i++) {
    const red = i % 4 === 3 ? 'facebook' : 'instagram', cuenta = CUENTAS.find(c => c.red === red);
    const dias = 1 + Math.floor(rnd() * 88), fecha = sumarDias(hoy, -dias), dow = new Date(`${fecha}T12:00:00Z`).getUTCDay();
    const tarde = rnd() < 0.55, hora = tarde ? 18 + Math.floor(rnd() * 3) : 8 + Math.floor(rnd() * 8), tipo = red === 'facebook' ? (rnd() < 0.5 ? 'imagen' : 'texto') : tipos[Math.floor(rnd() * tipos.length)];
    const impulso = (tipo === 'reel' ? 2.1 : tipo === 'carrusel' ? 1.5 : 1) * (tarde ? 1.6 : 1) * (dow === 2 || dow === 4 ? 1.3 : 1);
    const interacciones = Math.round((18 + rnd() * 30) * impulso), alcance = Math.round(interacciones * (14 + rnd() * 10));
    const [y, m, d] = fecha.split('-').map(Number);
    const meGusta = Math.round(interacciones * 0.75), comentarios = Math.round(interacciones * 0.08);
    publicaciones.push({
      id: `${cuenta.id}|ej${i}`, cuentaId: cuenta.id, externoId: `ej${i}`, red, tipo, enlace: '', texto: TEXTOS[i % TEXTOS.length], miniatura: '',
      publicadaAt: new Date(y, m - 1, d, hora, Math.floor(rnd() * 50)).toISOString(), meGusta, comentarios, guardados: Math.round(interacciones * 0.1),
      compartidos: Math.round(interacciones * 0.07), alcance, vistas: Math.round(alcance * 1.5), interacciones,
    });
  }
  publicaciones.sort((a, b) => b.publicadaAt.localeCompare(a.publicadaAt));
  return {
    ejemplo: true, hoy, ultimaFoto: sumarDias(hoy, -1), pendientes: 0, actualizando: false, indicadores: { seguidores: false, alcance: false },
    meta: { configurado: true, secreto: false, version: 'ejemplo', cuentas: CUENTAS, token: { valido: true, tipo: 'EJEMPLO', caduca: null, permisos: [], faltan: [], verificadoAt: null }, sincronizadaAt: null, error: null },
    serie, publicaciones,
  };
}

/** El cliente de la API. Sin servidor (la demo), solo hay ejemplo. */
export function crearDatosAnaliticas({ served }) {
  const j = async (url, opciones) => {
    const r = await fetch(url, opciones);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
    return d;
  };
  return {
    cargar: dias => (served ? j(`/api/contenido/analiticas?dias=${dias}`) : Promise.resolve(datosDeEjemplo())),
    comprobar: () => j('/api/contenido/meta/sincronizar', { method: 'POST' }),
    actualizar: todas => j(`/api/contenido/analiticas/actualizar${todas ? '?todas=1' : ''}`, { method: 'POST' }),
    indicadores: () => j('/api/contenido/analiticas/indicadores', { method: 'POST' }),
  };
}
