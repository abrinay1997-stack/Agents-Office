// La vista Tareas — MÍAS (plan D, 7 oct 2026; docs/analisis-tareas-del-dueno-2026-10-07.md): la lista PERSONAL del dueño, al estilo de
// TaskView. A la izquierda, sus listas (Bandeja, Hoy, Próximos 7 días, Todas, Delegadas, Hechas) y sus proyectos, cada una con su número;
// en el teléfono, una fila de pastillas. A la derecha, la lista elegida: cabecera con «hechas/total» y su barra, las pendientes (agrupadas
// por fecha cuando toca), el campo punteado «+ Añadir tarea» que ya trae la fecha o el proyecto de esa lista, y al final COMPLETADAS · N.
// Cada fila tiene la casilla redonda que la marca hecha. «Tablero» la enseña en tres columnas: Por hacer · Haciendo · Hecha.
// Lo puro (qué va en cada lista, el orden, qué significa soltar una tarjeta) vive en tareas/dueno.mjs, con test.
import { LISTAS, deLista, cuentas, porFecha, porDia, gruposHoy, COLUMNAS_MIAS, columnaMia, dia } from '../../tareas/dueno.mjs';
import { esc, svg, filaHTML, vacioHTML } from './comun.js';

const ICONO_LISTA = { bandeja: 'bandeja', hoy: 'hoy', proximos: 'prox', todas: 'lista', delegadas: 'delegar', hechas: 'hecha' };
const TONO_LISTA = { bandeja: 'gris', hoy: 'azul', proximos: 'violeta', todas: 'verde', delegadas: 'ambar', hechas: 'verde' };
const SIN_TABLERO = new Set(['delegadas', 'hechas']);

// lo que trae una tarea nueva según la lista donde se añade (Hoy: hoy; Próximos: mañana; un proyecto: ese proyecto)
export function presetLista(k, ahora = Date.now()) {
  if (k === 'hoy') return { limite: dia(ahora) };
  if (k === 'proximos') return { limite: dia(ahora + 864e5) };
  if (String(k).startsWith('p:')) return { proyecto: String(k).slice(2) };
  return {};
}
export const nombreLista = (k, ctx) => (String(k).startsWith('p:') ? ctx.proyecto(String(k).slice(2))?.nombre || 'Proyecto' : LISTAS.find(l => l.k === k)?.titulo || 'Hoy');

export function railHTML(tareas, ctx, { lista, ahora = Date.now() }) {
  const n = cuentas(tareas, { ahora });
  const item = (k, titulo, icono, cuenta, extra = '') => `<button type="button" class="tv-mli${k === lista ? ' on' : ''}" data-mlista="${esc(k)}" aria-current="${k === lista ? 'true' : 'false'}">${extra || svg(icono)}<span>${esc(titulo)}</span>${cuenta ? `<b${(k === 'hoy' && n.vencidas) || (k === 'delegadas' && n.delegadasFallidas) ? ' class="rojo"' : ''}>${cuenta}</b>` : ''}</button>`;
  const proys = ctx.proyectos().filter(p => n.proyectos[p.id] || lista === 'p:' + p.id);
  return `<nav class="tv-mrail" aria-label="Tus listas">
    ${LISTAS.map(l => item(l.k, l.titulo, ICONO_LISTA[l.k], l.k === 'hechas' ? n.hechasHoy : n[l.k])).join('')}
    ${proys.length ? `<span class="tv-mrh">Proyectos</span>${proys.map(p => item('p:' + p.id, p.nombre, '', n.proyectos[p.id] || 0, `<i class="tv-mpd c-${esc(p.color || 'gris')}" aria-hidden="true"></i>`)).join('')}` : ''}
  </nav>`;
}

export function miasHTML(tareas, ctx, { lista = 'hoy', modo = 'lista', ahora = Date.now(), plegadas = new Set() } = {}) {
  const def = LISTAS.find(l => l.k === lista), esProy = String(lista).startsWith('p:');
  const p = esProy ? ctx.proyecto(lista.slice(2)) : null;
  const { pendientes, hechas } = deLista(tareas, lista, { ahora });
  const titulo = esProy ? p?.nombre || 'Proyecto' : def?.titulo || 'Hoy', sub = esProy ? p?.objetivo || 'Tus tareas de este proyecto' : def?.sub || '';
  const total = pendientes.length + hechas.length, tono = esProy ? 'violeta' : TONO_LISTA[lista] || 'azul';
  const barra = total && lista !== 'hechas' && lista !== 'delegadas' ? `<span class="tv-cuenta">${hechas.length}/${total}</span><span class="tv-bar" aria-hidden="true"><i style="width:${Math.round(100 * hechas.length / total)}%"></i></span>` : `<span class="tv-cuenta">${lista === 'hechas' ? hechas.length : pendientes.length}</span>`;
  const conTablero = !SIN_TABLERO.has(lista);
  const cab = `<header class="tv-mhd t-${tono}"><span class="tv-ico">${esProy ? `<i class="tv-mpd grande c-${esc(p?.color || 'gris')}" aria-hidden="true"></i>` : svg(ICONO_LISTA[lista] || 'hoy')}</span>
    <div class="tv-mtit"><h2>${esc(titulo)}</h2><small>${esc(sub)}</small></div>${barra}
    ${conTablero ? `<div class="tv-seg tv-mmodo" role="group" aria-label="Cómo verla"><button type="button" data-mmodo="lista" aria-pressed="${modo !== 'tablero'}">Lista</button><button type="button" data-mmodo="tablero" aria-pressed="${modo === 'tablero'}">Tablero</button></div>` : ''}</header>`;
  const fila = t => filaHTML(t, ctx, { mia: true, mostrarDept: !!ctx.depto(t.dept), arrastrar: lista !== 'delegadas' && t.state !== 'done' && modo === 'tablero' });
  const anadir = lista === 'delegadas' || lista === 'hechas' ? '' : `<form class="tv-madd" data-maddf autocomplete="off"><label class="tv-sr" for="tvMadd">Añadir una tarea tuya a ${esc(titulo)}</label>${svg('mas')}<input id="tvMadd" data-madd placeholder="Añadir tarea${lista === 'hoy' ? ' para hoy' : lista === 'proximos' ? ' para mañana' : esProy ? ' al proyecto' : ''}… (Enter)" maxlength="300"></form>`;
  if (modo === 'tablero' && conTablero) {
    const vivas = [...pendientes, ...hechas.filter(t => (t.doneAt || 0) >= ahora - 48 * 3600e3)];
    const por = new Map(COLUMNAS_MIAS.map(c => [c.k, []])); for (const t of vivas) por.get(columnaMia(t)).push(t);
    return `${cab}<div class="tv-mtab" style="--cols:${COLUMNAS_MIAS.length}">${COLUMNAS_MIAS.map(c => `<section class="tv-col" aria-label="${esc(c.titulo)}"><h3>${esc(c.titulo)} <span>${por.get(c.k).length}</span></h3><div class="tv-drop" data-mcol="${c.k}"${por.get(c.k).length ? ' role="list"' : ''}>${por.get(c.k).map(t => filaHTML(t, ctx, { mia: true, arrastrar: true, mostrarDept: !!ctx.depto(t.dept) })).join('') || '<p class="tv-nada">—</p>'}</div>${c.k === 'porhacer' ? anadir : ''}</section>`).join('')}</div>
      <p class="tv-ayuda tv-mayuda">Arrastra una tarjeta a «Haciendo» para empezarla (con su cronómetro), a «Hecha» para terminarla. Todo se puede deshacer.</p>`;
  }
  // los grupos: Todas y un proyecto, por fecha; Próximos, un título por día (8 oct 2026); Hoy, lo vencido aparte y arriba si lo hay (8 oct 2026)
  const grupos = lista === 'proximos' ? porDia(pendientes, ahora) : lista === 'hoy' ? gruposHoy(pendientes, ahora) : lista === 'todas' || esProy ? porFecha(pendientes, ahora) : null;
  const filas = l => `<div class="tv-filas" role="list">${l.map(fila).join('')}</div>`;
  const cuerpo = !pendientes.length ? (lista === 'hechas' ? '' : vacioHTML(VACIO[lista]?.[0] || 'Nada por aquí', VACIO[lista]?.[1] || 'Escribe abajo para añadir una.'))
    : grupos && (lista !== 'hoy' || grupos.length > 1) ? grupos.map(g => `<h3 class="tv-gh${g.k === 'vencidas' ? ' rojo' : ''}">${esc(g.titulo)} <span>${g.tareas.length}</span></h3>${g.sub ? g.sub.map(x => `<h4 class="tv-gsub">${x.k === 'sin' ? 'Sin hora <span>· todo el día</span>' : 'Con hora'}</h4>${filas(x.tareas)}`).join('') : filas(g.tareas)}`).join('') : filas(pendientes);
  const hechasK = 'mias-hechas-' + lista;
  const comp = hechas.length ? (lista === 'hechas' ? filas(hechas) : `<details class="tv-hechas"${plegadas.has(hechasK) ? '' : ' open'} data-hechask="${esc(hechasK)}"><summary>${lista === 'delegadas' ? 'VOLVIERON HECHAS' : 'COMPLETADAS'} · ${hechas.length}</summary>${filas(hechas)}</details>`) : lista === 'hechas' ? vacioHTML('Todavía nada', 'Lo que termines estos 30 días aparece aquí.') : '';
  return `${cab}<div class="tv-mlist">${cuerpo}${anadir}${comp}</div>`;
}
const VACIO = {
  bandeja: ['La bandeja está vacía', 'Lo que añadas sin fecha ni proyecto (y lo que te sugieran los agentes) entra aquí.'],
  hoy: ['Nada para hoy', 'Añade algo, o mira los próximos días.'],
  proximos: ['Nada en los próximos 7 días', 'Pon fecha a lo de tu bandeja para verlo aquí.'],
  todas: ['No tienes nada abierto', 'Escribe abajo para añadir tu primera tarea.'],
  delegadas: ['No delegaste nada todavía', 'Desde el detalle de una tarea tuya: «Delegar…» a un agente o a una persona. Aquí la sigues hasta que vuelva.'],
};
export { SIN_TABLERO };
