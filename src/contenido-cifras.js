// ============================================================
// Analíticas: de las fotos de Meta a lo que se enseña (puro)
//
// PORTADO de Juancito Ads — juanarrietabusiness-pixel/CALENDARIOS-MARKETING-APP, src/lib/resultados.js
// (30 sep 2026). Son las MISMAS cuentas: si la oficina dijera un número y la aplicación de la agencia otro sobre la
// misma cuenta, sería porque las dos copias se separaron. Lo que se cambió al traerlo, y solo eso:
//   · `enPanama` pasó a llamarse `enLocal`: allá la hora es Panamá fijo (UTC−5); aquí es la del reloj de esta máquina,
//     como en el resto de Contenido (la oficina corre en la computadora de quien la usa)
//   · se quitó `resumenCompetencia`: la oficina no sigue competidores todavía
//   · `sumarDias` vive aquí porque el módulo de fechas de allá (agenda.js) no viene
//   · se añadió `enfoque`, que dice qué cifras ya maduraron (una publicación de hace tres días sigue subiendo)
//   · `kpis` acepta `cobertura` y `publicacionesDesde` (por omisión, apagados: se comporta como allá). Allá la aplicación lleva años apuntando y el
//     periodo anterior casi siempre está completo; aquí la oficina empieza vacía, y comparar 30 días contra 3 fotos hace subir un 900 % lo que no subió.
// Los campos siguen llamándose como allá (publicadaAt, interacciones, alcance…) para poder comparar un archivo con el otro.
// Lo importan el navegador (la vista Analíticas) y el servidor (los indicadores y, en F4, lo que aprende el Cerebro).
// Cubierto por tests/contenido-cifras.test.mjs, que trae los casos de src/lib/resultados.test.js de allá.
// ============================================================

export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const BLOQUES_HORA = ['0–3', '3–6', '6–9', '9–12', '12–15', '15–18', '18–21', '21–24'];

/** Días que tarda una publicación en dar sus cifras casi definitivas: antes, siguen subiendo. */
export const DIAS_DE_MADURACION = 5;

const suma = xs => xs.reduce((a, b) => a + (Number(b) || 0), 0);
const media = xs => (xs.length ? suma(xs) / xs.length : 0);
const pad = n => String(n).padStart(2, '0');

/** «2026-10-05» ± n días, sin pasar por la zona horaria (el mediodía UTC no cambia de día en ningún huso). */
export function sumarDias(fecha, n) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toJSON().slice(0, 10);
}

/** El cambio en % entre dos cifras, o null si no hay con qué comparar. */
export function variacion(actual, anterior) {
  if (actual == null || anterior == null || anterior === 0) return null;
  return ((actual - anterior) / anterior) * 100;
}

/** Día de la semana, hora y fecha de un instante ISO, en el reloj de esta máquina. */
export function enLocal(iso) {
  const d = new Date(iso);
  return { dia: d.getDay(), hora: d.getHours(), fecha: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` };
}

const deRed = red => x => !red || red === 'todas' || x.red === red;

/**
 * Una fila por día con las cuentas sumadas: seguidores (el último valor de cada cuenta ese día), alcance, vistas,
 * interacciones y visitas. Una foto que falló (`error`) no cuenta.
 */
export function serieDiaria(serie = [], red = 'todas') {
  const porDia = new Map();
  for (const f of serie.filter(deRed(red))) {
    if (f.error) continue;
    const d = porDia.get(f.fecha) ?? { fecha: f.fecha, seguidores: null, alcance: 0, vistas: 0, interacciones: 0, visitas: 0 };
    if (f.seguidores != null) d.seguidores = (d.seguidores ?? 0) + f.seguidores;
    d.alcance += f.alcance ?? 0;
    d.vistas += f.vistas ?? 0;
    d.interacciones += f.interacciones ?? 0;
    d.visitas += f.visitas ?? 0;
    porDia.set(f.fecha, d);
  }
  return [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Seguidores de la última foto con dato en o antes de `fecha`. */
function seguidoresEn(dias, fecha) {
  let v = null;
  for (const d of dias) {
    if (d.fecha > fecha) break;
    if (d.seguidores != null) v = d.seguidores;
  }
  return v;
}

/**
 * Las cifras del periodo [desde, hasta] y las del periodo anterior de la misma duración, para enseñar la flecha de
 * subida o bajada.
 */
export function kpis({ serie = [], publicaciones = [] }, { desde, hasta, red = 'todas', cobertura = 0, publicacionesDesde = null }) {
  const dias = serieDiaria(serie, red);
  const largo = Math.max(1, Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400_000));
  const desdeAntes = sumarDias(desde, -largo);
  const enRango = (a, b) => d => d.fecha >= a && d.fecha <= b;
  const ahora = dias.filter(enRango(desde, hasta));
  const antes = dias.filter(enRango(desdeAntes, sumarDias(desde, -1)));

  const pubs = publicaciones.filter(deRed(red)).filter(p => p.publicadaAt);
  const pubsEn = (a, b) => pubs.filter(p => { const f = enLocal(p.publicadaAt).fecha; return f >= a && f <= b; });
  const pAhora = pubsEn(desde, hasta);
  const pAntes = pubsEn(desdeAntes, sumarDias(desde, -1));

  const seguidores = seguidoresEn(dias, hasta);
  const seguidoresInicio = seguidoresEn(dias, desde) ?? ahora.find(d => d.seguidores != null)?.seguidores ?? null;
  const tasa = lista => (seguidores ? media(lista.map(p => (p.interacciones / seguidores) * 100)) : null);

  // El periodo anterior solo sirve para comparar si lo apuntado lo cubre (cobertura: la fracción de días con foto que se exige) y, para las
  // publicaciones, si se leyeron desde antes de que empiece. Si no, «sin con qué comparar»: mejor callar que enseñar una flecha inventada.
  const completa = !cobertura || antes.length >= Math.ceil(largo * cobertura);
  const pubsCubren = !publicacionesDesde || desdeAntes >= publicacionesDesde;
  const cifra = (valor, anterior) => ({ valor, anterior, cambio: variacion(valor, anterior) });
  return {
    seguidores: { valor: seguidores, anterior: seguidoresInicio, cambio: variacion(seguidores, seguidoresInicio), ganados: seguidores != null && seguidoresInicio != null ? seguidores - seguidoresInicio : null },
    alcance: cifra(suma(ahora.map(d => d.alcance)), antes.length && completa ? suma(antes.map(d => d.alcance)) : null),
    vistas: cifra(suma(ahora.map(d => d.vistas)), antes.length && completa ? suma(antes.map(d => d.vistas)) : null),
    interacciones: cifra(suma(pAhora.map(p => p.interacciones)), pAntes.length && pubsCubren ? suma(pAntes.map(p => p.interacciones)) : null),
    visitas: cifra(suma(ahora.map(d => d.visitas)), antes.length && completa ? suma(antes.map(d => d.visitas)) : null),
    publicaciones: cifra(pAhora.length, pAntes.length && pubsCubren ? pAntes.length : null),
    tasaInteraccion: cifra(tasa(pAhora), pAntes.length && pubsCubren ? tasa(pAntes) : null),
  };
}

export const NOMBRE_FORMATO = { imagen: 'Imagen', carrusel: 'Carrusel', reel: 'Reel', video: 'Video', texto: 'Texto', historia: 'Historia' };

/** Qué formato rinde más: publicaciones, interacciones y alcance medios. */
export function porFormato(publicaciones = []) {
  const grupos = new Map();
  for (const p of publicaciones) {
    const g = grupos.get(p.tipo) ?? [];
    g.push(p);
    grupos.set(p.tipo, g);
  }
  return [...grupos.entries()]
    .map(([tipo, lista]) => ({
      tipo, nombre: NOMBRE_FORMATO[tipo] ?? tipo, cantidad: lista.length,
      interacciones: media(lista.map(p => p.interacciones)),
      alcance: media(lista.map(p => p.alcance)),
    }))
    .sort((a, b) => b.interacciones - a.interacciones);
}

/**
 * Cuándo funcionan mejor sus publicaciones: interacciones medias por día de la semana y bloque de tres horas.
 * `mejores` son los tres huecos con más interacción de los que tienen al menos una publicación.
 */
export function mejoresMomentos(publicaciones = []) {
  const celdas = Array.from({ length: 7 }, () => Array.from({ length: 8 }, () => []));
  for (const p of publicaciones) {
    if (!p.publicadaAt) continue;
    const { dia, hora } = enLocal(p.publicadaAt);
    celdas[dia][Math.floor(hora / 3)].push(p.interacciones ?? 0);
  }
  const matriz = celdas.map(fila => fila.map(v => (v.length ? { media: media(v), cantidad: v.length } : null)));
  const mejores = [];
  matriz.forEach((fila, dia) => fila.forEach((c, bloque) => { if (c) mejores.push({ dia, bloque, ...c }); }));
  mejores.sort((a, b) => b.media - a.media);
  const maximo = Math.max(0, ...mejores.map(m => m.media));
  return { matriz, mejores: mejores.slice(0, 3), maximo };
}

/**
 * La hora a proponer para una publicación de ese día: la franja en la que mejor le responde la cuenta ese día de la
 * semana; si ese día no hay bastantes publicaciones para decirlo, la mejor franja de la semana. Con pocos datos,
 * null: una sugerencia sacada de una sola publicación es ruido con aspecto de consejo.
 */
export function horaSugerida(publicaciones = [], fecha = '', minimo = 2) {
  const { matriz } = mejoresMomentos(publicaciones);
  const candidatos = [];
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? new Date(`${fecha}T12:00:00Z`).getUTCDay() : null;
  if (dia !== null) {
    matriz[dia].forEach((c, bloque) => { if (c && c.cantidad >= minimo) candidatos.push({ bloque, media: c.media, cantidad: c.cantidad, dia }); });
  }
  if (!candidatos.length) {
    for (let bloque = 0; bloque < BLOQUES_HORA.length; bloque++) {
      const celdas = matriz.map(f => f[bloque]).filter(Boolean);
      const cantidad = suma(celdas.map(c => c.cantidad));
      if (cantidad < minimo * 2) continue;
      candidatos.push({ bloque, media: suma(celdas.map(c => c.media * c.cantidad)) / cantidad, cantidad, dia: null });
    }
  }
  if (!candidatos.length) return null;
  const mejor = candidatos.sort((a, b) => b.media - a.media)[0];
  const hora = `${pad(mejor.bloque * 3 + 1)}:00`;
  const franja = `de ${BLOQUES_HORA[mejor.bloque]} h`;
  const cifra = `${Math.round(mejor.media)} interacciones de media en ${mejor.cantidad} publicaciones`;
  const plural = d => (d.endsWith('s') ? d : `${d}s`).toLowerCase();
  return {
    hora,
    motivo: mejor.dia !== null
      ? `Los ${plural(DIAS_SEMANA[mejor.dia])} ${franja} es cuando mejor responde su audiencia: ${cifra}.`
      : `${franja.charAt(0).toUpperCase()}${franja.slice(1)} es cuando mejor responde su audiencia: ${cifra}.`,
  };
}

/** Las que más movieron, de más a menos. */
export const mejoresPublicaciones = (publicaciones = [], n = 6) =>
  [...publicaciones].sort((a, b) => (b.interacciones ?? 0) - (a.interacciones ?? 0)).slice(0, n);

/**
 * Qué publicaciones ya dieron sus cifras casi definitivas. Una de hace tres días sigue subiendo: compararla con una
 * de hace un mes sería medir el reloj, no el contenido. `hoy` es una fecha AAAA-MM-DD.
 */
export function enfoque(publicaciones = [], hoy = '') {
  const limite = hoy ? sumarDias(hoy, -DIAS_DE_MADURACION) : '';
  const maduras = [], recientes = [];
  for (const p of publicaciones) (p.publicadaAt && limite && enLocal(p.publicadaAt).fecha > limite ? recientes : maduras).push(p);
  return { maduras, recientes };
}

/** Números cortos: 1.234 → «1234», 12.500 → «12,5 mil», 1.250.000 → «1,3 M». */
export function numeroCorto(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  const f = (x, d) => x.toLocaleString('es', { maximumFractionDigits: d });
  if (abs >= 1e6) return `${f(n / 1e6, 1)} M`;
  if (abs >= 1e4) return `${f(n / 1e3, 1)} mil`;
  return f(n, n % 1 ? 1 : 0);
}
