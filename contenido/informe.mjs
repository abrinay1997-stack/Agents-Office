// Agents Office (6 oct 2026, plan M5 · U10) — el INFORME DEL MES de las redes, en una página: lo que salió, cómo fue, lo que mejor
// funcionó, la bandeja y qué repetir. Lo arma la oficina con sus propios datos (Contenido, Analíticas, la bandeja y la mejor hora), sin
// un modelo de por medio: cada cifra sale de un dato apuntado, y lo que no se sabe se dice («sin datos»), nunca se inventa.
// Se ve en Analíticas («Informe del mes») y se guarda como nota en <cerebro>/Agents Office/informes/AAAA-MM redes.md (no viaja por GitHub).
//   informeDelMes({ mes, piezas, salidaDe, analiticas, bandeja, hora, ahora, cuentas, cuenta }) → { titulo, cuenta, texto, cifras }   (puro, con test)
// (9 oct 2026) Con `cuenta` (el id de una de `cuentas`), las cifras son solo de esa cuenta y Contenido solo lo de su red; sin ella, el total
// por red y, si hay varias cuentas, una línea por cuenta.
import { kpis, porFormato, mejoresPublicaciones, numeroCorto, deFiltro, nombreCuenta, compararCuentas, DIAS_SEMANA } from '../src/contenido-cifras.js';
import { mejoresDelDia } from '../src/contenido-hora.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const NOMBRE = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X', threads: 'Threads', bluesky: 'Bluesky', tiktok: 'TikTok', pinterest: 'Pinterest', youtube: 'YouTube' };
const FORMATO = { post: 'post', carrusel: 'carrusel', reel: 'reel', historia: 'historia' };
const pad = n => String(n).padStart(2, '0');
const ultimoDia = mes => { const [y, m] = mes.split('-').map(Number); return `${mes}-${pad(new Date(y, m, 0).getDate())}`; };
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const cambio = c => (c?.cambio == null ? '' : ` (${c.cambio > 0 ? '+' : ''}${Math.round(c.cambio)} % frente al mes anterior)`);

export function informeDelMes({ mes, piezas = [], salidaDe = () => null, analiticas = {}, bandeja = [], hora = null, hoy = new Date().toISOString().slice(0, 10), cuentas = [], cuenta = '' } = {}) {
  if (!/^\d{4}-\d{2}$/.test(mes || '')) throw new Error('el mes va como AAAA-MM');
  const una = cuenta ? cuentas.find(c => c.id === cuenta) : null;
  if (cuenta && !una) throw Object.assign(new Error('esa cuenta no está en Analíticas'), { status: 404 });
  const [y, m] = mes.split('-').map(Number), desde = `${mes}-01`, hasta = ultimoDia(mes);
  const titulo = `Informe de redes — ${MESES[m - 1]} de ${y}${una ? ` · ${nombreCuenta(una)} (${NOMBRE[una.red] || una.red})` : ''}`;
  const delMes = piezas.filter(p => p.fecha >= desde && p.fecha <= hasta && p.estado !== 'idea' && (!una || (p.redes || []).includes(una.red)));
  const salieron = delMes.filter(p => ['publicada', 'parcial'].includes(salidaDe(p.id)?.estado));
  const fallaron = delMes.filter(p => ['fallo', 'parcial'].includes(salidaDe(p.id)?.estado));
  // en el mes en curso, lo que aún no llega no está «sin aprobar» ni «sin salir»: está por salir
  const yaPaso = delMes.filter(p => p.fecha < hoy), porSalir = delMes.length - yaPaso.length;
  const aprobadasSinSalir = yaPaso.filter(p => p.estado === 'aprobada' && !salidaDe(p.id));
  const sinAprobar = yaPaso.filter(p => p.estado !== 'aprobada');
  const porRed = {}; for (const p of salieron) for (const r of p.redes) porRed[r] = (porRed[r] || 0) + 1;
  const porFmt = {}; for (const p of salieron) porFmt[p.formato] = (porFmt[p.formato] || 0) + 1;
  const L = [`# ${titulo}`, '', `_Hecho por la oficina con sus propios datos. Lo que no se sabe dice «sin datos»._`, ''];

  L.push('## Lo que salió');
  if (una) L.push(`_Contenido no separa por cuenta: aquí va todo lo planificado para ${NOMBRE[una.red] || una.red}._`);
  if (!delMes.length) L.push('Nada programado este mes en Contenido.');
  else {
    L.push(`- ${plural(salieron.length, 'pieza publicada', 'piezas publicadas')} de ${plural(delMes.length, 'planificada', 'planificadas')}.`);
    if (salieron.length) L.push(`- Por red: ${Object.entries(porRed).map(([r, n]) => `${NOMBRE[r] || r} ${n}`).join(' · ')}. Por formato: ${Object.entries(porFmt).map(([f, n]) => `${FORMATO[f] || f} ${n}`).join(' · ')}.`);
    if (fallaron.length) L.push(`- ${plural(fallaron.length, 'no salió bien', 'no salieron bien')}: ${fallaron.map(p => `«${p.titulo || p.id}»`).join(', ')}.`);
    if (porSalir) L.push(`- ${plural(porSalir, 'está por salir', 'están por salir')} en lo que queda del mes.`);
    if (sinAprobar.length) L.push(`- ${plural(sinAprobar.length, 'se quedó sin aprobar', 'se quedaron sin aprobar')}.`);
    if (aprobadasSinSalir.length) L.push(`- ${plural(aprobadasSinSalir.length, 'aprobada no llegó a la cola', 'aprobadas no llegaron a la cola')} (¿la publicación estaba apagada?).`);
  }
  L.push('');

  const serie = (analiticas.serie || []).filter(deFiltro(una?.id)), publicaciones = (analiticas.publicaciones || []).filter(deFiltro(una?.id));
  const redesA = [...new Set([...serie.map(s => s.red), ...publicaciones.map(p => p.red)].filter(Boolean))];
  L.push('## Cómo fue');
  const cifras = {};
  if (!redesA.length) L.push('Sin datos de Analíticas: conecta Meta (Analíticas, R) para tener seguidores, alcance e interacciones.');
  for (const red of redesA) {
    const k = kpis({ serie, publicaciones }, { desde, hasta, red, cobertura: 0.7 }); cifras[red] = k;
    const enRed = una ? 1 : cuentas.filter(c => c.red === red).length;
    L.push(`- **${NOMBRE[red] || red}${enRed > 1 ? ` (${enRed} cuentas)` : ''}:** ${k.seguidores.valor != null ? `${numeroCorto(k.seguidores.valor)} seguidores${k.seguidores.ganados != null ? ` (${k.seguidores.ganados >= 0 ? '+' : ''}${k.seguidores.ganados} en el mes)` : ''}` : 'seguidores sin datos'} · alcance ${numeroCorto(k.alcance.valor)}${cambio(k.alcance)} · ${numeroCorto(k.interacciones.valor)} interacciones${cambio(k.interacciones)} · ${plural(k.publicaciones.valor, 'publicación', 'publicaciones')}.`);
  }
  const porCuenta = una ? [] : compararCuentas({ serie, publicaciones }, cuentas, { desde, hasta, cobertura: 0.7 });
  if (porCuenta.length > 1) for (const { cuenta: c, k } of porCuenta) L.push(`- ${nombreCuenta(c)} (${NOMBRE[c.red] || c.red}): ${k.seguidores.valor != null ? `${numeroCorto(k.seguidores.valor)} seguidores${k.seguidores.ganados != null ? ` (${k.seguidores.ganados >= 0 ? '+' : ''}${k.seguidores.ganados})` : ''}` : 'seguidores sin datos'} · alcance ${numeroCorto(k.alcance.valor)} · ${numeroCorto(k.interacciones.valor)} interacciones · ${plural(k.publicaciones.valor, 'publicación', 'publicaciones')}.`);
  L.push('');

  const delMesP = publicaciones.filter(p => { const d = String(p.publicadaAt || '').slice(0, 10); return d >= desde && d <= hasta; });
  L.push('## Lo que mejor funcionó');
  const top = mejoresPublicaciones(delMesP, 3);
  if (!top.length) L.push('Sin datos de publicaciones este mes.');
  for (const p of top) L.push(`- «${String(p.texto || '').replace(/\s+/g, ' ').slice(0, 90) || p.tipo}» — ${NOMBRE[p.red] || p.red}${!una && cuentas.length > 1 && cuentas.find(c => c.id === p.cuentaId) ? ` (${nombreCuenta(cuentas.find(c => c.id === p.cuentaId))})` : ''}, ${p.tipo}, ${p.interacciones} interacciones${p.alcance ? `, alcance ${numeroCorto(p.alcance)}` : ''} (${String(p.publicadaAt).slice(0, 10)})${p.enlace ? ` · ${p.enlace}` : ''}`);
  const fmt = porFormato(delMesP).filter(x => x.cantidad >= 2);
  if (fmt.length) L.push(`- Por formato (interacciones medias): ${fmt.map(x => `${x.nombre} ${Math.round(x.interacciones)} (${x.cantidad})`).join(' · ')}.`);
  L.push('');

  const bj = bandeja.filter(x => { const d = String(x.cuando || x.llego || '').slice(0, 10); return d >= desde && d <= hasta; });
  L.push('## La bandeja');
  if (!bj.length) L.push('Sin mensajes, comentarios ni reseñas apuntados este mes.');
  else {
    const n = e => bj.filter(x => x.estado === e).length;
    L.push(`- ${plural(bj.length, 'recibido', 'recibidos')}: ${n('respondido')} respondidos, ${n('descartado')} sin necesidad de respuesta, ${n('nuevo') + n('borrador') + n('fallo')} pendientes${bj.some(x => x.sospecha) ? `; ${bj.filter(x => x.sospecha).length} con órdenes escondidas (🛡)` : ''}.`);
  }
  L.push('');

  L.push('## Qué repetir y qué cambiar');
  const ideas = [];
  if (fmt.length > 1) ideas.push(`Más ${fmt[0].nombre.toLowerCase()}: rinde ${Math.round(fmt[0].interacciones)} interacciones de media, frente a ${Math.round(fmt.at(-1).interacciones)} en ${fmt.at(-1).nombre.toLowerCase()}.`);
  if (top[0]) ideas.push(`Vuelve sobre el tema de «${String(top[0].texto || '').replace(/\s+/g, ' ').slice(0, 60)}»: fue lo que más movió.`);
  if (hora?.grid) { const d = [1, 2, 3, 4, 5].map(k => { const f = `2026-10-${pad(4 + k)}`; /* una semana cualquiera (el 5 de octubre de 2026 es lunes): solo importa el día de la semana */ const b = mejoresDelDia(hora.grid, f, 1)[0]; return b ? `${DIAS_SEMANA[k].toLowerCase()} ${b.hora}` : ''; }).filter(Boolean); if (d.length) ideas.push(`Publica en las mejores horas (${hora.fuente === 'metricool' ? 'según Metricool' : 'según lo ya publicado'}): ${d.join(', ')}.`); }
  if (fallaron.length) ideas.push('Revisa en Programación por qué fallaron las que no salieron, antes de repetirlas.');
  if (sinAprobar.length > yaPaso.length / 3 && yaPaso.length >= 3) ideas.push('Se quedaron muchas sin aprobar: planifica menos o apruébalas con más antelación.');
  if (!ideas.length) ideas.push('Todavía no hay datos suficientes para recomendar algo: con un mes publicado y Analíticas conectada, aquí saldrán.');
  for (const i of ideas) L.push(`- ${i}`);
  return { titulo, cuenta: una ? una.id : null, texto: L.join('\n') + '\n', cifras: { planificadas: delMes.length, publicadas: salieron.length, fallaron: fallaron.length, bandeja: bj.length } };
}
