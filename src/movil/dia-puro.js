// Versión móvil (25 oct 2026) — la vista de DÍA del Calendario, lo PURO: dónde cae cada evento en la columna de 24 horas, cómo se
// reparten los que se pisan (columnas lado a lado) y dónde va la línea de «ahora». Sin DOM: se prueba en Node (tests/movil-e.test.mjs).
export const PX_HORA = 56;        // alto de una hora
export const MIN_ALTO = 44;       // un evento nunca mide menos que un dedo
export const DUR_POR_DEFECTO = 30; // minutos que se le da a lo que no dice cuánto dura

const minutosDelDia = (ms, ini) => Math.max(0, Math.min(24 * 60, (ms - ini) / 60000));

/** → { arriba: eventos «todo el día», cajas: [{ ev, top, alto, col, cols }] } para el día que empieza en `ini` (ms, 00:00 local). */
export function distribuir(evs, ini) {
  const fin = ini + 864e5, arriba = [], cajas = [];
  for (const ev of evs) {
    if (ev.at < ini || ev.at >= fin) continue;
    if (ev.conHora === false) { arriba.push(ev); continue; }
    const m = minutosDelDia(ev.at, ini), dur = ev.dur || DUR_POR_DEFECTO, top = Math.round(m / 60 * PX_HORA);
    cajas.push({ ev, top, alto: Math.max(MIN_ALTO, Math.round(dur / 60 * PX_HORA)), col: 0, cols: 1 });
  }
  cajas.sort((a, b) => a.top - b.top || b.alto - a.alto);
  // grupos que se pisan → columnas
  let grupo = [], finGrupo = -1;
  const cierra = () => { const n = Math.max(1, ...grupo.map(c => c.col + 1)); for (const c of grupo) c.cols = n; grupo = []; };
  const ultimos = []; // fin de la última caja de cada columna del grupo actual
  for (const c of cajas) {
    if (grupo.length && c.top >= finGrupo) { cierra(); ultimos.length = 0; finGrupo = -1; }
    let col = ultimos.findIndex(f => f <= c.top); if (col < 0) col = ultimos.length;
    ultimos[col] = c.top + c.alto; c.col = col; grupo.push(c); finGrupo = Math.max(finGrupo, c.top + c.alto);
  }
  if (grupo.length) cierra();
  return { arriba, cajas };
}

/** La línea de «ahora» en píxeles desde el inicio del día, o null si `ahora` no cae en ese día. */
export function lineaAhora(ini, ahora = Date.now()) { return ahora >= ini && ahora < ini + 864e5 ? Math.round(minutosDelDia(ahora, ini) / 60 * PX_HORA) : null; }

/** Dónde dejar la vista al abrir: una hora antes de ahora si es hoy, si no las 7:00. → píxeles */
export function scrollInicial(ini, ahora = Date.now(), alturaVista = 500) {
  const l = lineaAhora(ini, ahora), objetivo = l != null ? l - Math.round(alturaVista * 0.3) : 7 * PX_HORA - 8;
  return Math.max(0, Math.min(objetivo, 24 * PX_HORA - alturaVista));
}

/** Una hora tocada en la columna (píxeles desde el inicio del día) → 'HH:MM' redondeada a la media hora. */
export function horaDeToque(px) { const m = Math.max(0, Math.min(23 * 60 + 30, Math.floor(px / PX_HORA * 2) * 30)); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
