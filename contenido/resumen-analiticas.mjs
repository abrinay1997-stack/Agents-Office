// Agents Office (6 oct 2026, plan M3) — Analíticas EN PALABRAS, para un agente (y para Dimitri): cómo van las redes en un periodo, qué
// formato rinde, qué publicaciones movieron más y la mejor hora. Ya resumido, como hace metricool-cli (B4): un agente no necesita 600
// publicaciones crudas, necesita cuatro conclusiones con sus cifras. Puro: recibe lo que da `metricas.leer()` y la mejor hora.
//   resumenAnaliticas({ serie, publicaciones, ultimaFoto }, { dias, hoy, hora, cuentas, cuenta }) → { texto, datos }
// (9 oct 2026) Con `cuenta` (id, @usuario o nombre, de `cuentas`), solo esa cuenta; sin ella, el total por red y una línea por cuenta.
import { kpis, porFormato, mejoresPublicaciones, enfoque, numeroCorto, sumarDias, deFiltro, buscarCuenta, nombreCuenta, compararCuentas, DIAS_SEMANA } from '../src/contenido-cifras.js';
import { mejoresDelDia } from '../src/contenido-hora.js';

const NOMBRE = { instagram: 'Instagram', facebook: 'Facebook' };
const flecha = c => (c?.cambio == null ? '' : ` (${c.cambio > 0 ? '+' : ''}${Math.round(c.cambio)} % frente a los ${'{d}'} días anteriores)`);
const quien = c => `${nombreCuenta(c)} (${NOMBRE[c.red] || c.red}${c.usuario && c.nombre ? `, «${c.nombre}»` : ''})`;

export function resumenAnaliticas({ serie = [], publicaciones = [], ultimaFoto = null } = {}, { dias = 30, hoy = new Date().toISOString().slice(0, 10), hora = null, cuentas = [], cuenta = '' } = {}) {
  const hasta = sumarDias(hoy, -1), desde = sumarDias(hasta, -(dias - 1));
  let una = null;
  if (cuenta) {
    una = buscarCuenta(cuentas, cuenta);
    if (!una) return { texto: `No hay ninguna cuenta «${String(cuenta).slice(0, 60)}» en Analíticas. ${cuentas.length ? `Las que hay: ${cuentas.map(c => `${quien(c)}, id ${c.id}`).join(' · ')}.` : 'Todavía no se conoce ninguna cuenta.'}`, datos: null };
    serie = serie.filter(deFiltro(una.id)); publicaciones = publicaciones.filter(deFiltro(una.id));
  }
  const redes = [...new Set([...serie.map(s => s.red), ...publicaciones.map(p => p.red)].filter(Boolean))];
  if (!redes.length) return { texto: una ? `Analíticas todavía no tiene datos de ${nombreCuenta(una)}: aún no se hizo su primera foto diaria. No inventes cifras.` : 'Analíticas todavía no tiene datos: Meta no está conectada o aún no se hizo la primera foto diaria. No inventes cifras: dile al dueño que conecte Meta en Analíticas (R).', datos: null };
  const lineas = [`Analíticas de los últimos ${dias} días (${desde} a ${hasta})${una ? `, solo la cuenta ${quien(una)}` : ''}${ultimaFoto ? `, foto más reciente del ${ultimaFoto}` : ''}. Las publicaciones de los últimos 5 días aún están madurando: no las compares todavía.`];
  const datos = {};
  const f = s => flecha(s).replace('{d}', dias);
  const cifras = k => `${k.seguidores.valor != null ? `${numeroCorto(k.seguidores.valor)} seguidores${k.seguidores.ganados != null ? ` (${k.seguidores.ganados >= 0 ? '+' : ''}${k.seguidores.ganados})` : ''}` : 'seguidores sin dato'} · alcance ${numeroCorto(k.alcance.valor)}${f(k.alcance)} · ${k.publicaciones.valor} publicaciones · ${numeroCorto(k.interacciones.valor)} interacciones${f(k.interacciones)}${k.tasaInteraccion.valor != null ? ` · tasa de interacción ${k.tasaInteraccion.valor.toFixed(2)} %` : ''}`;
  for (const red of redes) {
    const k = kpis({ serie, publicaciones }, { desde, hasta, red, cobertura: 0.7 }), n = NOMBRE[red] || red;
    datos[red] = k;
    const enRed = una ? 1 : cuentas.filter(c => c.red === red).length;
    lineas.push(`\n${n}${enRed > 1 ? ` (suma de ${enRed} cuentas)` : ''}: ${cifras(k)}.`);
  }
  const filas = una ? [] : compararCuentas({ serie, publicaciones }, cuentas, { desde, hasta, cobertura: 0.7 });
  if (filas.length > 1) {
    datos.cuentas = Object.fromEntries(filas.map(x => [x.cuenta.id, x.k]));
    lineas.push(`\nPor cuenta (pide una con «cuenta» para verla sola):\n${filas.map(({ cuenta: c, k }) => `- ${quien(c)}: ${cifras(k)}.`).join('\n')}`);
  }
  const { maduras } = enfoque(publicaciones.filter(p => { const d = String(p.publicadaAt || '').slice(0, 10); return d >= desde && d <= hasta; }), hoy);
  const fmt = porFormato(maduras).filter(x => x.cantidad >= 2);
  if (fmt.length) lineas.push(`\nQué formato rinde (interacciones medias): ${fmt.map(x => `${x.nombre} ${Math.round(x.interacciones)} (${x.cantidad})`).join(' · ')}.`);
  const top = mejoresPublicaciones(maduras, 3);
  const deCuenta = p => { const c = !una && cuentas.length > 1 && cuentas.find(x => x.id === p.cuentaId); return c ? `, ${nombreCuenta(c)}` : ''; };
  if (top.length) lineas.push(`Las que más movieron: ${top.map(p => `«${String(p.texto || p.caption || '').replace(/\s+/g, ' ').slice(0, 70) || p.tipo}» (${NOMBRE[p.red] || p.red}${deCuenta(p)}, ${p.tipo}, ${p.interacciones} interacciones, ${String(p.publicadaAt).slice(0, 10)})`).join(' · ')}.`);
  if (hora?.grid) {
    const porDia = [1, 2, 3, 4, 5, 6, 0].map(d => { const f = sumarDias(hoy, (d - new Date(`${hoy}T12:00:00`).getDay() + 7) % 7); const m = mejoresDelDia(hora.grid, f, 2); return m.length ? `${DIAS_SEMANA[d].toLowerCase()} ${m.map(x => x.hora).join(' y ')}` : ''; }).filter(Boolean);
    if (porDia.length) lineas.push(`\nMejores horas (${hora.fuente === 'metricool' ? 'según Metricool' : hora.fuente === 'propia' ? 'según lo ya publicado' : 'Metricool y lo ya publicado'}): ${porDia.join(' · ')}. Úsalas para la hora de tus borradores.`);
  } else if (hora?.motivo) lineas.push(`\nMejor hora: ${hora.motivo}`);
  return { texto: lineas.join('\n'), datos };
}
