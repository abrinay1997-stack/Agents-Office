// Agents Office V4.7 (F2, 30 sep 2026) — ANALÍTICAS (R): cómo rinden Instagram y Facebook. Solo LECTURA sobre Meta: nada de aquí publica ni cambia nada allá.
//   · Arriba, el estado de la conexión (o cómo hacerla) y las cuentas que se leen.
//   · Las cifras del periodo contra el anterior, la evolución, qué formato y qué horario funcionan, las publicaciones que más movieron.
//   · Avisos honestos: lo que aún no maduró, lo que Meta no dio, lo que le falta al token. Una cifra que no se sabe se rotula, no se inventa.
// Las cuentas son las de src/contenido-cifras.js (portadas de Juancito Ads); la foto diaria la hace contenido/metricas.mjs.
// Sin conexión o en la demo, «datos de ejemplo»: se ven IGUAL, con el rótulo en grande, y nunca se mezclan con lo real.
// (9 oct 2026) Cada cuenta por separado: el selector de cuenta (con su foto o inicial; en el teléfono, un desplegable), «Viendo …» y la
// tabla «Comparar cuentas» (ordenable; un clic elige la cuenta). Con una cuenta, todo lo de abajo es solo de ella (`ao.an.cuenta`).
//   initAnaliticas({ served, esc, business }) → { open, close, toggle, isOpen }
import { modal } from './modal.js';
import { iconoRed } from './redes-iconos.js';
import { views } from './views.js';
import { fmtDay } from './calendar-core.js';
import { crearDatosAnaliticas, datosDeEjemplo } from './analiticas-datos.js';
import { informeHTML, mesesAtras, nombreMes } from './analiticas-informe.js';
import { kpis, serieDiaria, deFiltro, cuentasDe, nombreCuenta, compararCuentas, porFormato, mejoresMomentos, horaSugerida, mejoresPublicaciones, enfoque, enLocal, numeroCorto, sumarDias, DIAS_SEMANA, BLOQUES_HORA, DIAS_DE_MADURACION } from './contenido-cifras.js';

const store = { get(k, d) { try { const v = localStorage.getItem('ao.an.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('ao.an.' + k, JSON.stringify(v)); } catch {} } };
const RED = { instagram: { nombre: 'Instagram' }, facebook: { nombre: 'Facebook' } };
const logo = (red, solo) => `<b class="an-net">${iconoRed(red, solo ? { titulo: RED[red]?.nombre || red } : {})}</b>`; // el LOGO de la red, no sus siglas; con `solo` (sin su nombre al lado) lleva el nombre para el lector de pantalla
const FORMATO = { imagen: 'Imagen', carrusel: 'Carrusel', reel: 'Reel', video: 'Video', texto: 'Texto', historia: 'Historia' };
const METRICAS = [['seguidores', 'Seguidores'], ['alcance', 'Alcance'], ['vistas', 'Visualizaciones'], ['interacciones', 'Interacciones']];
const TARJETAS = [['seguidores', 'Seguidores'], ['alcance', 'Alcance'], ['vistas', 'Visualizaciones'], ['interacciones', 'Interacciones'], ['visitas', 'Visitas al perfil'], ['tasaInteraccion', 'Interacción por seguidor']];
const LUN_A_DOM = [1, 2, 3, 4, 5, 6, 0]; // la semana empieza el lunes, como el resto de los calendarios de la oficina
const fecha = f => { const [y, m, d] = f.split('-').map(Number); return fmtDay(new Date(y, m - 1, d).getTime()); };
const pct = n => `${Math.abs(n).toLocaleString('es', { maximumFractionDigits: 1 })} %`;

export function initAnaliticas({ served, esc, business = () => '' }) {
  const datos = crearDatosAnaliticas({ served });
  const ov = document.createElement('div');
  ov.id = 'anOv'; ov.setAttribute('role', 'region'); ov.setAttribute('data-view', ''); ov.setAttribute('aria-label', 'Analíticas'); ov.inert = true; // A11-20: una vista es la página bajo la barra (region), no un diálogo
  ov.innerHTML = `
    <div class="cv-band">
      <div class="cv-brand">ANALÍTICAS <small id="anCo"></small></div>
      <div class="cv-seg an-dias" role="group" aria-label="Periodo"></div>
      <div class="cv-seg an-redes" role="group" aria-label="Red"></div>
      <div class="cv-sp"></div>
      <button id="anInforme" type="button" class="an-band-btn" aria-pressed="false" title="Lo publicado, lo que funcionó y qué repetir, en una página">INFORME DEL MES</button>
      <button id="anRefresh" type="button" class="an-band-btn" title="Leer de Meta las cifras de hoy">ACTUALIZAR</button>
      <button id="anClose" type="button" aria-label="Cerrar Analíticas" title="cerrar (Esc · R)">✕</button>
    </div>
    <div class="an-body" tabindex="-1"><div class="an-wrap" id="anWrap"></div></div>
    <div class="an-live" role="status" aria-live="polite"></div>`;
  document.body.appendChild(ov);
  const $ = s => ov.querySelector(s);
  const E = { inf: $('#anInforme'), dias: $('.an-dias'), redes: $('.an-redes'), wrap: $('#anWrap'), body: $('.an-body'), live: $('.an-live'), refresh: $('#anRefresh') };

  let openNow = false, opener = null, payload = null, error = '', cargando = false, pollT = null, ejemplo = false;
  let dias = store.get('dias', 30), red = store.get('red', 'todas'), metrica = store.get('metrica', 'seguidores');
  if (![7, 30, 90].includes(dias)) dias = 30;
  if (!['todas', 'instagram', 'facebook'].includes(red)) red = 'todas';
  if (!METRICAS.some(m => m[0] === metrica)) metrica = 'seguidores';
  let cuenta = String(store.get('cuenta', '') || ''), orden = 'alcance', asc = false; // la cuenta elegida ('' = todas) y el orden de «Comparar»
  const unaDe = d => d?.meta?.cuentas?.find(a => a.id === cuenta) || null; // una cuenta que ya no está vuelve a «todas»
  const filtro = d => (unaDe(d) ? cuenta : red);
  const elegir = id => { cuenta = id; store.set('cuenta', id); const a = unaDe(dia()); if (a && red !== 'todas' && a.red !== red) { red = a.red; store.set('red', red); } render(); say(a ? `Viendo ${nombreCuenta(a)} · ${RED[a.red]?.nombre || a.red}` : 'Viendo todas las cuentas'); };

  let topImp = []; // A4: «las que más movieron» a la vista (para «Impulsar»)
  let muestra = null; // los datos de ejemplo se calculan una vez por apertura, no en cada dibujo
  const dia = () => (ejemplo || !served ? (muestra ||= datosDeEjemplo()) : payload);
  const say = t => { E.live.textContent = ''; setTimeout(() => { E.live.textContent = t; }, 30); };

  /* ---------- las cuentas del periodo ---------- */
  function calcular(d) {
    const hoy = d.hoy, desde = sumarDias(hoy, -dias), hasta = hoy;
    const serie = d.serie.filter(f => f.fecha >= sumarDias(desde, -dias)); // el periodo y el anterior, para la flecha
    // Lo apuntado empieza el día de la primera foto (las publicaciones, 45 días antes): comparar contra un periodo que ya no se leyó sería inventar la flecha.
    const primera = d.serie.filter(f => !f.error).reduce((m, f) => (!m || f.fecha < m ? f.fecha : m), null);
    const f = filtro(d), o = { desde, hasta, cobertura: 0.7, publicacionesDesde: primera ? sumarDias(primera, -45) : null };
    const k = kpis({ serie, publicaciones: d.publicaciones }, { ...o, red: f });
    const dd = serieDiaria(serie, f).filter(x => x.fecha >= desde && x.fecha <= hasta);
    const pubs = d.publicaciones.filter(deFiltro(f));
    const e = enfoque(pubs, hoy);
    const comp = compararCuentas({ serie, publicaciones: d.publicaciones }, d.meta.cuentas, { ...o, f: red });
    return { hoy, desde, hasta, k, dd, pubs, e, primera, f, comp };
  }

  /* ---------- pedazos de HTML ---------- */
  const banner = (tono, etiqueta, texto, acciones = '') => `<div class="an-banner an-${tono}" role="${tono === 'warn' ? 'alert' : 'status'}"><b>${esc(etiqueta)}</b><span>${texto}</span>${acciones ? `<span class="an-acts">${acciones}</span>` : ''}</div>`;
  const btn = (a, t, extra = '') => `<button type="button" class="an-btn" data-a="${a}" ${extra}>${esc(t)}</button>`;

  function conexionHTML(m) {
    const lect = (m.permisos?.lectura || []).map(p => `<code>${esc(p)}</code>`).join(' ');
    const pub = (m.permisos?.publicar || []).map(p => `<code>${esc(p)}</code>`).join(' ');
    return `<section class="an-card an-connect" aria-labelledby="anConTitle">
      <h2 id="anConTitle">Conecta Meta para ver cómo rinden tus redes</h2>
      <p class="an-cap">La oficina lee las cifras de Instagram y Facebook. <b>Aquí solo lee.</b> Con el mismo token también puede publicar directo, pero solo si lo eliges en Ajustes → Contenido → «Meta directo». Se conecta con el token de un <i>usuario del sistema</i> de Meta, que no caduca. El token no se guarda en ningún archivo de la oficina. Paso a paso: <code>docs/conectar-meta.md</code>.</p>
      <ol class="an-steps">
        <li>En <b>Meta Business Suite → Configuración del negocio → Usuarios → Usuarios del sistema</b>, crea uno.</li>
        <li>Asígnale las <b>páginas de PanaClaw</b> y su cuenta de Instagram.</li>
        <li>Genera un token para tu app con estos permisos: ${lect}. Pide también estos, para publicar directo desde Contenido (Ajustes → Contenido → Meta directo): ${pub}.</li>
        <li>${globalThis.AO_NUBE ? 'Guárdalo como el secreto <code>META_ACCESS_TOKEN</code> del repositorio en GitHub (Settings → Secrets → Actions) y <b>vuelve a desplegar</b>.' : 'Ponlo en la variable de entorno <code>META_ACCESS_TOKEN</code> (en Windows: Configuración → Sistema → Acerca de → Configuración avanzada → Variables de entorno) y <b>reinicia la oficina</b>.'}</li>
        <li>Vuelve aquí y pulsa <b>Comprobar conexión</b>.</li>
      </ol>
      <p class="an-cap">Los nombres de los menús de Meta cambian: si no los encuentras, la idea es esta —un usuario del sistema con las páginas asignadas y un token con esos permisos—.</p>
      <div class="an-acts">${btn('comprobar', 'COMPROBAR CONEXIÓN')}${btn('ejemplo', 'VER CON DATOS DE EJEMPLO', 'data-quiet')}</div>
    </section>`;
  }

  function estadoHTML(d) {
    if (!served) return banner('ejemplo', 'DEMO', 'Estás viendo datos de ejemplo: la demo no está conectada a ninguna cuenta.');
    if (ejemplo) return banner('ejemplo', 'DATOS DE EJEMPLO', 'No son de ninguna cuenta; sirven para ver cómo queda esta pantalla.', btn('salir', 'SALIR DEL EJEMPLO', 'data-quiet'));
    const m = d.meta, partes = [];
    if (!m.configurado) return ''; // sin token no hay estado que contar: la tarjeta de conexión lo dice todo
    if (d.actualizando) partes.push(banner('info', 'LEYENDO META', 'Puede tardar un par de minutos: son varias decenas de llamadas por cuenta.'));
    if (m.error) partes.push(banner('warn', 'META NO RESPONDE BIEN', esc(m.error), btn('comprobar', 'COMPROBAR CONEXIÓN')));
    else if (m.token?.faltan?.length) partes.push(banner('warn', 'FALTAN PERMISOS', `Al token le faltan: ${m.token.faltan.map(p => `<code>${esc(p)}</code>`).join(' ')}. Sin ellos, algunas cifras no salen. Genera el token de nuevo con esos permisos.`, btn('comprobar', 'COMPROBAR CONEXIÓN')));
    else {
      const t = m.token || {}, caduca = t.caduca ? `caduca el ${fecha(t.caduca.slice(0, 10))}` : 'no caduca';
      partes.push(`<p class="an-line">Conectada · ${m.cuentas.length} ${m.cuentas.length === 1 ? 'cuenta' : 'cuentas'} · token ${t.tipo ? esc(t.tipo.toLowerCase().replace('_', ' ')) + ', ' : ''}${caduca} · ${d.ultimaFoto ? `última foto: ${fecha(d.ultimaFoto)}` : 'todavía sin foto: la primera se hace desde las 6:00'} ${btn('comprobar', 'Comprobar conexión', 'data-quiet')}</p>`);
    }
    // Fase 0 de Anuncios (8 oct 2026): lo que falta para las OTRAS funciones, separado por función y sin alarma (Analíticas funciona igual).
    const otras = Object.entries(m.token?.faltanPor || {}).filter(([k, l]) => k !== 'lectura' && l.length);
    if (otras.length && !m.error) partes.push(`<p class="an-line">Para otras funciones de la oficina le faltan permisos al token: ${otras.map(([k, l]) => `<b>${esc({ publicar: 'Publicar', anuncios: 'Anuncios', mensajes: 'Mensajes de la Bandeja' }[k] || k)}</b>: ${l.map(p => `<code>${esc(p)}</code>`).join(' ')}`).join(' · ')}. La lista completa está en <code>docs/conectar-meta.md</code>.</p>`);
    if (d.pendientes && !d.actualizando && !m.error) partes.push(`<p class="an-line">Faltan ${d.pendientes} ${d.pendientes === 1 ? 'cuenta' : 'cuentas'} por fotografiar hoy: se hace sola desde las 6:00, o pulsa Actualizar.</p>`);
    return partes.join('');
  }

  /* ---------- las cuentas: elegir una, y compararlas ---------- */
  const inicial = a => esc((a.usuario || a.nombre || '?').replace(/^@/, '').charAt(0).toUpperCase());
  const avatar = a => `<span class="an-ava" aria-hidden="true"><i>${inicial(a)}</i>${/^https:\/\//.test(a.foto || '') ? `<img src="${esc(a.foto)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>`;
  const selectCuentas = (d, cls) => `<select class="${cls}">${[`<option value="">Todas las cuentas${red !== 'todas' ? ' de ' + RED[red].nombre : ''}</option>`, ...Object.keys(RED).filter(r => red === 'todas' || r === red).map(r => { const l = d.meta.cuentas.filter(a => a.red === r); return l.length ? `<optgroup label="${RED[r].nombre}">${l.map(a => `<option value="${esc(a.id)}"${a.id === cuenta ? ' selected' : ''}>${esc(nombreCuenta(a))}${a.usuario && a.nombre ? ' — ' + esc(a.nombre) : ''}</option>`).join('')}</optgroup>` : ''; })].join('')}</select>`;
  function cuentasHTML(d, c) {
    const ult = new Map(); for (const f of d.serie) ult.set(f.cuentaId, f);
    const una = unaDe(d), suma = cuentasDe(d.meta.cuentas, c.f).length;
    const viendo = una ? `Viendo <b>${esc(nombreCuenta(una))}</b> · ${RED[una.red]?.nombre || una.red}${una.usuario && una.nombre ? ` · ${esc(una.nombre)}` : ''}` : `Viendo <b>${red === 'todas' ? 'todas las cuentas' : RED[red].nombre}</b>${suma > 1 ? ` · suma ${suma} cuentas` : ''}`;
    const chip = a => { const f = ult.get(a.id), est = !f ? 'sin foto todavía' : f.error ? `falló el ${fecha(f.fecha)}` : `${f.seguidores != null ? numeroCorto(f.seguidores) + ' seguidores · ' : ''}foto del ${fecha(f.fecha)}`;
      return `<button type="button" class="an-cta${f?.error ? ' an-cta-err' : ''}" data-cta="${esc(a.id)}" aria-pressed="${a.id === cuenta}"${f?.error ? ` title="${esc(f.error)}"` : ''}>${avatar(a)}<span class="an-ctn"><b>${esc(a.nombre || nombreCuenta(a))}</b><small>${a.usuario ? esc('@' + a.usuario) + ' · ' : ''}${esc(est)}</small></span></button>`; };
    const grupos = Object.keys(RED).filter(r => red === 'todas' || r === red).map(r => { const l = d.meta.cuentas.filter(a => a.red === r); return l.length ? `<span class="an-gl">${logo(r)} ${RED[r].nombre}</span>${l.map(chip).join('')}` : ''; }).join('');
    return `<section class="an-cuentas" aria-label="Cuentas">
      <p class="an-viendo">${viendo}</p>
      <div class="an-ctas" role="group" aria-label="Cuenta"><button type="button" class="an-cta an-cta-all" data-cta="" aria-pressed="${!una}"><span class="an-ctn"><b>Todas las cuentas</b><small>${red === 'todas' ? 'Instagram y Facebook' : 'de ' + RED[red].nombre}</small></span></button>${grupos}</div>
      <label class="an-csel-l"><span>Cuenta</span>${selectCuentas(d, 'an-csel')}</label>
    </section>`;
  }

  const ORDEN = [['seguidores', 'Seguidores'], ['ganados', 'Ganados'], ['alcance', 'Alcance'], ['interacciones', 'Interacciones'], ['publicaciones', 'Publicaciones']];
  const valorDe = (k, o) => (o === 'ganados' ? k.seguidores.ganados : k[o].valor);
  function compararHTML(c) {
    if (c.comp.length < 2) return '';
    const filas = c.comp.slice().sort((x, y) => { const a = valorDe(x.k, orden) ?? -Infinity, b = valorDe(y.k, orden) ?? -Infinity; return asc ? a - b : b - a; });
    const n = v => (v == null ? '—' : numeroCorto(v));
    const celdas = k => ORDEN.map(([o, t]) => { const v = valorDe(k, o); return `<td data-l="${t}">${o === 'ganados' && v != null ? `<span class="${v > 0 ? 'an-up' : v < 0 ? 'an-down' : 'an-flat'}">${v > 0 ? '+' : v < 0 ? '−' : ''}${numeroCorto(Math.abs(v))}</span>` : n(v)}</td>`; }).join('');
    return `<section class="an-card" aria-labelledby="anComp"><div class="an-hd"><h2 id="anComp">Comparar cuentas</h2><span class="an-cap">${c.comp.length} cuentas · los últimos ${dias} días · un clic en una la elige</span></div>
      <div class="an-tablewrap"><table class="an-comp"><thead><tr><th scope="col">Cuenta</th>${ORDEN.map(([o, t]) => `<th scope="col" aria-sort="${o === orden ? (asc ? 'ascending' : 'descending') : 'none'}"><button type="button" class="an-ord" data-ord="${o}">${t}<span aria-hidden="true">${o === orden ? (asc ? ' ▲' : ' ▼') : ''}</span></button></th>`).join('')}</tr></thead>
      <tbody>${filas.map(({ cuenta: a, k }) => `<tr${a.id === cuenta ? ' class="on"' : ''}><th scope="row"><button type="button" class="an-crow" data-cta="${esc(a.id)}" aria-pressed="${a.id === cuenta}">${avatar(a)}<span><b>${esc(nombreCuenta(a))}</b><small>${logo(a.red, !!a.usuario)} ${esc(a.usuario ? a.nombre || '' : RED[a.red]?.nombre || '')}</small></span></button></th>${celdas(k)}</tr>`).join('')}</tbody></table></div>
      <p class="an-cap">Seguidores al final del periodo y los ganados en él; alcance de cada día sumado; interacciones y publicaciones de lo que salió en el periodo.</p></section>`;
  }

  function cambioHTML(x, mejorSube = true) {
    if (x.cambio == null) return `<span class="an-d an-flat">sin con qué comparar</span>`;
    if (Math.abs(x.cambio) < 0.05) return `<span class="an-d an-flat">= igual que antes</span>`;
    const sube = x.cambio > 0, bien = sube === mejorSube;
    return `<span class="an-d ${bien ? 'an-up' : 'an-down'}"><span aria-hidden="true">${sube ? '▲' : '▼'}</span> ${sube ? 'sube' : 'baja'} ${pct(x.cambio)}</span>`;
  }

  function spark(vals) {
    if (vals.length < 2) return '';
    const min = Math.min(...vals), max = Math.max(...vals), w = 100, h = 26, rango = max - min || 1;
    const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / rango) * (h - 4)).toFixed(1)}`).join(' ');
    return `<svg class="an-spark" viewBox="0 0 ${w} ${h}" aria-hidden="true" preserveAspectRatio="none"><polyline points="${pts}"/></svg>`;
  }

  function tarjetasHTML(c) {
    const serieDe = k => (['alcance', 'vistas', 'interacciones', 'visitas', 'seguidores'].includes(k) ? c.dd.map(x => x[k]).filter(v => v != null) : []);
    return `<div class="an-kpis">${TARJETAS.map(([k, t]) => {
      const x = c.k[k]; let valor = '—', pie = cambioHTML(x);
      if (x.valor != null) valor = k === 'tasaInteraccion' ? `${x.valor.toLocaleString('es', { maximumFractionDigits: 2 })} %` : numeroCorto(x.valor);
      if (k === 'seguidores' && x.ganados != null) pie = `<span class="an-d ${x.ganados > 0 ? 'an-up' : x.ganados < 0 ? 'an-down' : 'an-flat'}"><span aria-hidden="true">${x.ganados > 0 ? '▲' : x.ganados < 0 ? '▼' : ''}</span> ${x.ganados > 0 ? '+' : x.ganados < 0 ? '−' : ''}${numeroCorto(Math.abs(x.ganados))} ${c.dd.length && c.dd[0].fecha > c.desde ? `desde el ${fecha(c.dd[0].fecha)}` : 'en el periodo'}</span>`;
      if (k === 'interacciones') pie += `<span class="an-sub">${c.k.publicaciones.valor} ${c.k.publicaciones.valor === 1 ? 'publicación' : 'publicaciones'}${c.k.publicaciones.cambio != null ? ` (${c.k.publicaciones.cambio > 0 ? '+' : c.k.publicaciones.cambio < 0 ? '−' : ''}${Math.abs(Math.round(c.k.publicaciones.cambio))} %)` : ''}</span>`;
      return `<div class="an-kpi"><div class="an-kl">${t}</div><div class="an-kv">${valor}</div>${pie}${spark(serieDe(k))}</div>`;
    }).join('')}</div><p class="an-cap">Alcance, visualizaciones y visitas son lo que Meta midió cada día. Interacciones y la interacción por seguidor cuentan las publicaciones que salieron en el periodo. La flecha compara con el periodo anterior de la misma duración, y solo aparece cuando lo apuntado lo cubre.</p>`;
  }

  /** La línea de una cifra a lo largo del periodo, en SVG propio (sin librería). */
  function tendenciaHTML(c) {
    const pts = c.dd.filter(x => x[metrica] != null);
    const nombre = METRICAS.find(m => m[0] === metrica)[1];
    const chips = METRICAS.map(([k, t]) => `<button type="button" class="an-chip" data-a="metrica" data-k="${k}" aria-pressed="${k === metrica}">${t}</button>`).join('');
    let cuerpo;
    if (pts.length < 2) cuerpo = `<p class="an-empty">Todavía no hay fotos suficientes para dibujar una línea: cada día se apunta una. ${served && !ejemplo ? 'La primera se hace mañana desde las 6:00, o pulsa Actualizar.' : ''}</p>`;
    else {
      const W = Math.max(300, Math.floor((E.wrap.clientWidth || 640) - 40)), H = W < 500 ? 200 : 240, ml = 46, mr = 14, mt = 12, mb = 26, vals = pts.map(p => p[metrica]);
      let min = Math.min(...vals), max = Math.max(...vals);
      if (metrica !== 'seguidores') min = 0; // lo que se suma día a día se mide desde cero; los seguidores, desde donde estaban
      const pad = (max - min) * 0.08 || 1; if (metrica === 'seguidores') { min -= pad; } max += pad;
      const x = i => ml + (i / (pts.length - 1)) * (W - ml - mr), y = v => mt + (1 - (v - min) / (max - min)) * (H - mt - mb);
      const linea = pts.map((p, i) => `${x(i).toFixed(1)},${y(p[metrica]).toFixed(1)}`).join(' ');
      const area = `${x(0).toFixed(1)},${H - mb} ${linea} ${x(pts.length - 1).toFixed(1)},${H - mb}`;
      const ticks = [0, 1, 2].map(i => min + ((max - min) * i) / 2);
      const idx = [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
      const ultimo = pts.at(-1);
      cuerpo = `<figure class="an-fig"><svg class="an-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`${nombre}: de ${numeroCorto(vals[0])} el ${fecha(pts[0].fecha)} a ${numeroCorto(vals.at(-1))} el ${fecha(ultimo.fecha)}`)}">
        ${ticks.map(t => `<line class="an-grid" x1="${ml}" x2="${W - mr}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text class="an-tx" x="${ml - 6}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${numeroCorto(Math.round(t))}</text>`).join('')}
        ${idx.map((i, n) => `<text class="an-tx" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${n === 0 ? 'start' : n === 2 ? 'end' : 'middle'}">${fecha(pts[i].fecha)}</text>`).join('')}
        <polygon class="an-area" points="${area}"/><polyline class="an-line-c" points="${linea}"/>
        <circle class="an-dot" cx="${x(pts.length - 1).toFixed(1)}" cy="${y(ultimo[metrica]).toFixed(1)}" r="4"/>
      </svg><figcaption class="an-cap">${nombre}${metrica === 'seguidores' ? ' (la escala empieza donde estaban, no en cero)' : ' por día'} · último dato: <b>${numeroCorto(ultimo[metrica])}</b> el ${fecha(ultimo.fecha)}</figcaption></figure>
      <details class="an-data"><summary>Ver los datos como tabla</summary><div class="an-tablewrap"><table><thead><tr><th scope="col">Día</th><th scope="col">${nombre}</th></tr></thead><tbody>${pts.slice().reverse().slice(0, 45).map(p => `<tr><th scope="row">${fecha(p.fecha)}</th><td>${p[metrica].toLocaleString('es')}</td></tr>`).join('')}</tbody></table></div></details>`;
    }
    return `<section class="an-card" aria-labelledby="anTend"><div class="an-hd"><h2 id="anTend">Evolución</h2><div class="an-chips" role="group" aria-label="Qué cifra dibujar">${chips}</div></div>${cuerpo}</section>`;
  }

  function funcionaHTML(c) {
    const maduras = c.e.maduras;
    const formatos = porFormato(maduras);
    const maxF = Math.max(1, ...formatos.map(f => f.interacciones));
    const bars = formatos.length
      ? `<ul class="an-bars">${formatos.map(f => `<li><span class="an-bn">${esc(f.nombre)} <small>${f.cantidad} ${f.cantidad === 1 ? 'publicación' : 'publicaciones'}</small></span><span class="an-track" aria-hidden="true"><i style="width:${Math.max(3, (f.interacciones / maxF) * 100).toFixed(1)}%"></i></span><b>${numeroCorto(Math.round(f.interacciones))}</b></li>`).join('')}</ul><p class="an-cap">Interacciones medias por publicación.</p>`
      : `<p class="an-empty">Aún no hay publicaciones con cifras maduras para comparar formatos.</p>`;
    const { matriz, maximo } = mejoresMomentos(maduras);
    const filas = LUN_A_DOM.map(di => `<tr><th scope="row">${DIAS_SEMANA[di].slice(0, 3)}</th>${matriz[di].map((cel, b) => cel
      ? `<td style="--v:${(cel.media / (maximo || 1)).toFixed(2)}" title="${esc(`${DIAS_SEMANA[di]} ${BLOQUES_HORA[b]} h: ${Math.round(cel.media)} interacciones de media en ${cel.cantidad} ${cel.cantidad === 1 ? 'publicación' : 'publicaciones'}`)}">${numeroCorto(Math.round(cel.media))}</td>`
      : `<td class="an-nil"><span class="an-sr">sin publicaciones</span><span aria-hidden="true">·</span></td>`).join('')}</tr>`).join('');
    const hora = horaSugerida(maduras, '');
    const sugerida = hora
      ? `<div class="an-hint"><b>Hora sugerida: ${esc(hora.hora)}</b><span>${esc(hora.motivo)}</span></div>`
      : `<div class="an-hint an-none"><b>Todavía no hay una hora que sugerir</b><span>Hacen falta al menos dos publicaciones el mismo día de la semana y franja, o cuatro en la misma franja. Con menos, sería ruido con aspecto de consejo.</span></div>`;
    return `<section class="an-card" aria-labelledby="anFunc"><h2 id="anFunc">Qué funciona</h2>
      <div class="an-two"><div><h3>Formatos</h3>${bars}</div>
      <div><h3>Días y horas</h3><div class="an-tablewrap"><table class="an-heat"><thead><tr><td></td>${BLOQUES_HORA.map(b => `<th scope="col">${b}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table></div><p class="an-cap">Interacciones medias, por día de la semana y bloque de tres horas (reloj de esta computadora).</p>${sugerida}</div></div>
    </section>`;
  }

  function miniaturaHTML(p) {
    const ok = typeof p.miniatura === 'string' && p.miniatura.startsWith('/api/contenido/miniatura/');
    return ok ? `<span class="an-th"><img src="${esc(p.miniatura)}" alt="" loading="lazy" decoding="async"></span>` : `<span class="an-th ph" aria-hidden="true"><i>${esc((FORMATO[p.tipo] || 'Pub')[0])}</i></span>`;
  }

  function mejoresHTML(c) {
    const top = mejoresPublicaciones(c.pubs, 6);
    if (!top.length) return `<section class="an-card" aria-labelledby="anTop"><h2 id="anTop">Las que más movieron</h2><p class="an-empty">Todavía no hay publicaciones leídas de esta red.</p></section>`;
    const reciente = new Set(c.e.recientes); topImp = top;
    return `<section class="an-card" aria-labelledby="anTop"><h2 id="anTop">Las que más movieron</h2><ol class="an-top">${top.map((p, i) => {
      const f = p.publicadaAt ? enLocal(p.publicadaAt).fecha : '', enlace = typeof p.enlace === 'string' && p.enlace.startsWith('https://') ? `<a href="${esc(p.enlace)}" target="_blank" rel="noopener noreferrer">Abrir<span class="an-sr"> en ${esc(RED[p.red]?.nombre || 'la red')} (se abre en otra pestaña)</span></a>` : '';
      return `<li>${miniaturaHTML(p)}<div class="an-tm"><div class="an-tt">${esc(p.texto || '(sin texto)')}</div>
        <div class="an-ts">${logo(p.red, true)} ${esc(FORMATO[p.tipo] || p.tipo)}${f ? ` · ${fecha(f)}` : ''}${reciente.has(p) ? ' · <i>aún subiendo</i>' : ''}</div>
        <div class="an-ts"><b>${numeroCorto(p.interacciones ?? 0)}</b> interacciones · ${numeroCorto(p.alcance ?? 0)} de alcance${enlace ? ' · ' + enlace : ''}</div>${p.red === 'instagram' || p.red === 'facebook' ? `<button type="button" class="an-btn an-imp" data-quiet data-imp="${i}" title="Crea una campaña en pausa con esta publicación (Anuncios, J); activarla te pedirá los dos clics">Impulsar</button>` : ''}</div></li>`;
    }).join('')}</ol></section>`;
  }

  function avisosHTML(d, c) { // solo de las cuentas que se ven
    const av = [];
    const m = d.meta;
    if (c.e.recientes.length) av.push(`${c.e.recientes.length} ${c.e.recientes.length === 1 ? 'publicación' : 'publicaciones'} de los últimos ${DIAS_DE_MADURACION} días siguen subiendo: no cuentan en «Qué funciona» hasta que maduren (aparecen marcadas «aún subiendo»).`);
    const porCuenta = new Map(cuentasDe(m.cuentas, c.f).map(a => [a.id, a]));
    const ultimas = new Map(); for (const f of d.serie) ultimas.set(f.cuentaId, f);
    for (const [id, f] of ultimas) {
      const a = porCuenta.get(id); if (!a) continue;
      if (f.error && f.fecha >= sumarDias(d.hoy, -3)) av.push(`La foto del ${fecha(f.fecha)} de «${esc(a.nombre)}» falló: ${esc(f.error)}`);
      const pa = f.datos?.avisos?.publicaciones;
      if (pa?.length) av.push(`Facebook no entregó todo de «${esc(a.nombre)}»${f.datos.avisos.parcial ? ' (las reacciones salen en 0: falta el permiso <code>pages_read_user_content</code>)' : ''}: ${esc(pa[0])}`);
    }
    for (const a of porCuenta.values()) if (!ultimas.has(a.id)) av.push(`«${esc(a.nombre)}» todavía no tiene ninguna foto.`);
    if (d.ultimaFoto && d.ultimaFoto < sumarDias(d.hoy, -2) && !d.ejemplo) av.push(`La última foto de métricas es del ${fecha(d.ultimaFoto)}: Meta solo guarda unos días de historia, y lo que no se apunta se pierde.`);
    if (!av.length) return '';
    return `<section class="an-card" aria-labelledby="anAv"><h2 id="anAv">Lo que conviene saber</h2><ul class="an-notes">${av.map(t => `<li>${t}</li>`).join('')}</ul></section>`;
  }

  function llevarHTML(d) {
    if (!served || ejemplo) return '';
    const ya = d.indicadores || {};
    if (ya.seguidores && ya.alcance) return `<p class="an-line">Los seguidores y el alcance ya se llevan a <b>Cómo va el negocio</b> (N): cada foto buena los pone al día.</p>`;
    return `<section class="an-card an-lleva"><div><h2>Llevar a «Cómo va el negocio»</h2><p class="an-cap">Añade dos indicadores —seguidores y alcance de 30 días— con su tendencia y meta, y cada foto diaria los actualiza. Son los mismos números de esta pantalla, no una segunda contabilidad.</p></div>${btn('indicadores', 'LLEVARLOS')}</section>`;
  }

  /* ---------- la pantalla ---------- */
  // plan M5 · U10: el informe del mes, en lugar de las cifras mientras se mira
  let verInforme = false, informe = null, mesInf = mesesAtras()[0];
  async function cargarInforme(guardar = false) {
    if (!served) { informe = { error: 'En la demo no hay informe: se arma con los datos de la oficina. Abre la oficina con el iniciador.' }; render(); return; }
    try {
      const cta = unaDe(dia()) ? cuenta : '';
      const r = guardar ? await fetch('/api/contenido/informe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mes: mesInf, cuenta: cta }) }) : await fetch(`/api/contenido/informe?mes=${encodeURIComponent(mesInf)}&cuenta=${encodeURIComponent(cta)}`);
      const j = await r.json(); if (!r.ok) throw new Error(j.error || `la oficina respondió ${r.status}`);
      informe = j; if (guardar && j.nota) say(`Guardado en el Cerebro: ${j.nota}`);
    }
    catch (e) { informe = { error: e.message }; }
    render();
  }
  const informeVista = () => `<section class="an-card an-inf" aria-labelledby="anInfT"><div class="an-inf-h"><h2 id="anInfT" class="an-vh">Informe del mes</h2>
      <label>Mes <select class="an-inf-mes">${mesesAtras().map(m => `<option value="${m}"${m === mesInf ? ' selected' : ''}>${nombreMes(m)}</option>`).join('')}</select></label>
      ${dia()?.meta?.cuentas?.length > 1 ? `<label>Cuenta ${selectCuentas(dia(), 'an-inf-cta')}</label>` : ''}
      <span class="an-sp"></span>${btn('inf-guardar', 'GUARDAR EN EL CEREBRO')}${btn('inf-copiar', 'COPIAR')}${btn('inf-volver', 'VOLVER A LAS CIFRAS')}</div>
      ${!informe ? '<p class="an-empty">Armando el informe…</p>' : informe.error ? banner('warn', 'NO SE PUDO', esc(informe.error)) : `<article class="an-inf-t">${informeHTML(informe.texto, esc)}</article>${informe.nota ? `<p class="an-cap">Guardado en el Cerebro: <b>${esc(informe.nota)}</b></p>` : ''}`}</section>`;
  function render() {
    E.inf.setAttribute('aria-pressed', String(verInforme));
    if (verInforme) { E.wrap.innerHTML = informeVista(); return; }
    E.dias.innerHTML = [7, 30, 90].map(n => `<button type="button" data-d="${n}" aria-pressed="${n === dias}" class="${n === dias ? 'on' : ''}">${n} DÍAS</button>`).join('');
    E.redes.innerHTML = [['todas', 'TODAS'], ['instagram', 'INSTAGRAM'], ['facebook', 'FACEBOOK']].map(([k, t]) => `<button type="button" data-r="${k}" aria-pressed="${k === red}" class="${k === red ? 'on' : ''}">${t}</button>`).join('');
    const sc = E.body.scrollTop;
    const d = dia();
    if (!d) { E.wrap.innerHTML = error ? banner('warn', 'NO SE PUDO LEER', esc(error), btn('recargar', 'REINTENTAR')) : `<p class="an-empty">Cargando…</p>`; E.refresh.disabled = true; return; }
    E.refresh.disabled = !served || ejemplo || !d.meta?.configurado || d.actualizando;
    E.refresh.textContent = d.actualizando ? 'LEYENDO…' : 'ACTUALIZAR';
    if (served && !ejemplo && !d.meta.configurado) { E.wrap.innerHTML = estadoHTML(d) + conexionHTML(d.meta); E.body.scrollTop = sc; return; }
    const c = calcular(d);
    E.wrap.innerHTML = [estadoHTML(d), cuentasHTML(d, c), compararHTML(c), tarjetasHTML(c), tendenciaHTML(c), funcionaHTML(c), mejoresHTML(c), avisosHTML(d, c), llevarHTML(d)].join('');
    E.body.scrollTop = sc;
  }

  async function load({ quiet = false } = {}) {
    if (cargando) return; cargando = true; if (!quiet && !payload) render();
    try { payload = await datos.cargar(Math.max(dias * 2, 90)); error = ''; }
    catch (e) { error = e.message; }
    finally { cargando = false; }
    if (openNow) render();
    clearTimeout(pollT);
    if (openNow && payload?.actualizando) pollT = setTimeout(() => load({ quiet: true }), 3000); // mientras Meta responde, se mira cada 3 s
  }

  ov.addEventListener('change', async e => {
    if (e.target.matches('.an-csel')) { elegir(e.target.value); ov.querySelector('.an-csel')?.focus(); return; }
    if (e.target.matches('.an-inf-cta')) { cuenta = e.target.value; store.set('cuenta', cuenta); informe = null; render(); await cargarInforme(); ov.querySelector('.an-inf-cta')?.focus(); return; }
    if (e.target.matches('.an-inf-mes')) { mesInf = e.target.value; informe = null; render(); await cargarInforme(); ov.querySelector('.an-inf-mes')?.focus(); } });
  ov.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.d) { dias = Number(b.dataset.d); store.set('dias', dias); render(); return; }
    if (b.dataset.r) { red = b.dataset.r; store.set('red', red); const a = unaDe(dia()); if (a && red !== 'todas' && a.red !== red) { cuenta = ''; store.set('cuenta', ''); } render(); return; }
    if (b.dataset.cta != null) { const id = b.dataset.cta, fila = b.classList.contains('an-crow'); elegir(id); ov.querySelector(`${fila ? '.an-crow' : '.an-ctas .an-cta'}[data-cta="${CSS.escape(id)}"]`)?.focus(); return; }
    if (b.dataset.ord) { if (orden === b.dataset.ord) asc = !asc; else { orden = b.dataset.ord; asc = false; } render(); ov.querySelector(`[data-ord="${orden}"]`)?.focus(); return; }
    if (b === $('#anClose')) { close(); return; }
    if (b === E.refresh) { await act('actualizar'); return; }
    if (b === E.inf) { verInforme = !verInforme; if (verInforme) { informe = null; render(); await cargarInforme(); } else render(); E.inf.focus(); return; }
    if (b.dataset.imp != null) { const p = topImp[+b.dataset.imp]; if (p) dispatchEvent(new CustomEvent('ao:abrir-anuncios', { cancelable: true, detail: { impulsar: { id: p.id, red: p.red, texto: p.texto || '', miniatura: p.miniatura || '', enlace: p.enlace || '', publicadaAt: p.publicadaAt || null, ejemplo: ejemplo || !served } } })); return; } // A4: a Anuncios → Borradores
    const a = b.dataset.a; if (!a) return;
    if (a === 'inf-volver') { verInforme = false; render(); E.inf.focus(); return; }
    if (a === 'inf-guardar') { await cargarInforme(true); return; }
    if (a === 'inf-copiar') { try { await navigator.clipboard.writeText(informe?.texto || ''); say('Copiado.'); } catch { say('No se pudo copiar: selecciona el texto.'); } return; }
    if (a === 'metrica') { metrica = b.dataset.k; store.set('metrica', metrica); render(); }
    else if (a === 'ejemplo') { ejemplo = true; render(); say('Estás viendo datos de ejemplo.'); }
    else if (a === 'salir') { ejemplo = false; render(); }
    else if (a === 'recargar') { payload = null; load(); }
    else act(a);
  });

  async function act(a) {
    try {
      if (a === 'comprobar') {
        say('Comprobando la conexión con Meta…'); const r = await datos.comprobar();
        if (payload) payload.meta = r.meta; await load({ quiet: true });
        say(r.ok ? `Conectada: ${r.meta.cuentas.length} cuentas.` : r.meta.error);
      } else if (a === 'actualizar') {
        await datos.actualizar(true); if (payload) payload.actualizando = true; render(); say('Leyendo Meta…'); clearTimeout(pollT); pollT = setTimeout(() => load({ quiet: true }), 2000);
      } else if (a === 'indicadores') {
        const r = await datos.indicadores(); if (payload) payload.indicadores = { seguidores: true, alcance: true }; render();
        say(r.creados?.length ? 'Listo: seguidores y alcance ya están en Cómo va el negocio.' : 'Ya estaban en Cómo va el negocio.');
      }
    } catch (e) { say(`No se pudo: ${e.message}`); error = ''; if (payload) render(); }
  }

  /* ---------- abrir y cerrar ---------- */
  const isOn = () => openNow;
  function open() {
    if (openNow) return; views.opening('analiticas'); openNow = true; opener = document.activeElement;
    muestra = null; ov.inert = false; modal.open(ov); $('#anCo').textContent = business(); ov.classList.add('on'); document.body.classList.add('anOpen');
    render(); load(); E.body.focus({ preventScroll: true });
  }
  function close(o = {}) {
    if (!openNow) return; openNow = false; clearTimeout(pollT); modal.close(ov); ov.inert = true; ov.classList.remove('on'); document.body.classList.remove('anOpen');
    if (!o.quiet && opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true });
  }
  let resizeT = 0; addEventListener('resize', () => { if (!openNow) return; clearTimeout(resizeT); resizeT = setTimeout(() => { if (openNow && dia()) render(); }, 150); });
  views.add('analiticas', { isOpen: isOn, close });
  const selection = () => { if (!openNow) return null; const a = unaDe(dia()); return { view: 'analiticas', label: `Analíticas · ${(METRICAS.find(m => m[0] === metrica) || [, metrica])[1]} · ${a ? `${nombreCuenta(a)} (${RED[a.red]?.nombre || a.red})` : red === 'todas' ? 'Instagram y Facebook' : RED[red].nombre} · ${dias} días`, kind: 'metric', id: `${metrica}:${a ? a.id : red}:${dias}` }; }; // V4.8: what Dimitri sees beside it
  return { open, close, toggle: () => (openNow ? close() : open()), isOpen: isOn, selection };
}
