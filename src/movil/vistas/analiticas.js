// Versión móvil (25 oct 2026) — ANALÍTICAS: cómo rinden Instagram y Facebook, en tarjetas que se leen con el pulgar. Elegir la cuenta (con su
// foto), el rango, las cifras del periodo contra el anterior, un gráfico de línea que se TOCA y se arrastra para ver el valor de cada día,
// «Comparar cuentas» como tarjetas, las publicaciones que más movieron (con «Impulsar») y el informe del mes. Solo LEE: nada de aquí
// publica ni cambia nada en Meta (impulsar crea un borrador de campaña EN PAUSA que no gasta nada). Toda la cuenta es la de
// src/contenido-cifras.js (la misma de escritorio); una cifra que no se sabe se rotula «sin con qué comparar», nunca se inventa.
import { kpis, serieDiaria, deFiltro, cuentasDe, nombreCuenta, compararCuentas, mejoresPublicaciones, enfoque, numeroCorto, sumarDias } from '../../contenido-cifras.js';
import { datosDeEjemplo } from '../../analiticas-datos.js';
import { esc, svg, vacio, esqueleto, falla } from '../ui.js';
import { iconoRed, con, miniatura, hoyYmd, diaTexto, motivo, NOMBRE_RED } from './d-comun.js';

const RANGOS = [[7, '7 días'], [30, '30 días'], [90, '90 días']];
const METRICAS = [['seguidores', 'Seguidores'], ['alcance', 'Alcance'], ['vistas', 'Visualizaciones'], ['interacciones', 'Interacciones']];
const TARJETAS = [['seguidores', 'Seguidores'], ['alcance', 'Alcance'], ['vistas', 'Visualizaciones'], ['interacciones', 'Interacciones'], ['visitas', 'Visitas al perfil'], ['publicaciones', 'Publicaciones']];
const guardar = (k, v) => { try { localStorage.setItem('ao.mv.an.' + k, JSON.stringify(v)); } catch {} };
const leer = (k, d) => { try { const v = localStorage.getItem('ao.mv.an.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const pct = n => `${Math.abs(n).toLocaleString('es', { maximumFractionDigits: 1 })} %`;
const mesTxt = m => new Date(`${m}-15T12:00:00`).toLocaleDateString('es', { month: 'long', year: 'numeric' });
const mesesAtras = (n = 4) => { const d = new Date(); d.setDate(1); return [...Array(n)].map((_, i) => { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; }); };
const avatar = a => `<span class="md-ava" aria-hidden="true"><i>${esc((a.usuario || a.nombre || '?').replace(/^@/, '').charAt(0).toUpperCase())}</i>${/^(https:\/\/|\/)/.test(a.foto || '') ? `<img src="${esc(a.foto)}" alt="" loading="lazy">` : ''}</span>`;

export function registrar(shell) {
  shell.registrarVista({
    id: 'analiticas', titulo: 'Analíticas', icono: 'analiticas', grupo: 'mas', sec: 'negocio', texto: 'Cómo rinden tus redes',
    montar(el, ctx) {
      const S = { d: null, ejemplo: false, cargado: false, error: null, dias: leer('dias', 30), cuenta: leer('cuenta', ''), metrica: leer('metrica', 'alcance'), idx: null, topImp: [] };
      if (![7, 30, 90].includes(S.dias)) S.dias = 30;
      el.innerHTML = `<div class="mv-scroll" data-sc><div class="mv-cuerpo md-an" aria-live="polite"></div></div>`;
      const cuerpo = el.querySelector('.md-an'), sc = el.querySelector('[data-sc]');

      async function cargar({ silencioso = false } = {}) {
        if (!silencioso && !S.cargado) cuerpo.innerHTML = esqueleto(4);
        if (S.ejemplo) { S.d = datosDeEjemplo(); S.cargado = true; pintar(); return; }
        try { S.d = await ctx.api(`/api/contenido/analiticas?dias=180`); S.cargado = true; S.error = null; } catch (e) { S.error = motivo(e); }
        pintar();
      }
      const unaDe = d => d?.meta?.cuentas?.find(a => a.id === S.cuenta) || null;
      const filtro = d => (unaDe(d) ? S.cuenta : 'todas');

      function calcular(d) {
        const hoy = d.hoy || hoyYmd(), desde = sumarDias(hoy, -S.dias), serie = (d.serie || []).filter(f => f.fecha >= sumarDias(desde, -S.dias));
        const primera = (d.serie || []).filter(f => !f.error).reduce((m, f) => (!m || f.fecha < m ? f.fecha : m), null);
        const f = filtro(d), o = { desde, hasta: hoy, cobertura: 0.7, publicacionesDesde: primera ? sumarDias(primera, -45) : null };
        const k = kpis({ serie, publicaciones: d.publicaciones || [] }, { ...o, red: f });
        const dd = serieDiaria(serie, f).filter(x => x.fecha >= desde && x.fecha <= hoy);
        const pubs = (d.publicaciones || []).filter(deFiltro(f));
        const comp = compararCuentas({ serie, publicaciones: d.publicaciones || [] }, d.meta?.cuentas || [], { ...o, f: 'todas' });
        return { hoy, desde, k, dd, pubs, comp, f, e: enfoque(pubs, hoy) };
      }
      const delta = (c, mejorSube = true) => {
        if (!c || c.cambio == null) return '<small class="md-d nd">sin con qué comparar</small>';
        const sube = c.cambio >= 0, bien = sube === mejorSube, igual = Math.abs(c.cambio) < 0.05;
        return `<small class="md-d ${igual ? '' : bien ? 'bien' : 'mal'}"><span aria-hidden="true">${igual ? '–' : sube ? '▲' : '▼'}</span> ${igual ? 'igual' : (sube ? 'sube ' : 'baja ') + pct(c.cambio)} <i>frente a los ${S.dias} días anteriores</i></small>`;
      };

      // ---------------------------------------------------------- el gráfico (se toca y se arrastra)
      function grafico(dd) {
        const key = S.metrica, pts = dd.map(x => ({ f: x.fecha, v: x[key] })).filter(p => p.v != null);
        if (pts.length < 2) return '<p class="mv-nada">Todavía no hay días suficientes para dibujar la evolución. Meta guarda su historia poco tiempo: la oficina apunta una foto por día.</p>';
        const W = 320, H = 150, P = 8, vs = pts.map(p => p.v), min = Math.min(...vs), max = Math.max(...vs), rango = max - min || 1;
        const X = i => P + (i * (W - 2 * P)) / (pts.length - 1), Y = v => H - P - ((v - min) / rango) * (H - 2 * P - 14);
        const linea = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(' ');
        const area = `${linea} L${X(pts.length - 1).toFixed(1)} ${H - P} L${X(0).toFixed(1)} ${H - P} Z`;
        S._pts = pts; const i = S.idx != null ? Math.min(S.idx, pts.length - 1) : pts.length - 1, p = pts[i];
        const nombre = METRICAS.find(m => m[0] === key)[1];
        return `<div class="md-graf" tabindex="0" role="img" aria-label="${esc(nombre)} en los últimos ${S.dias} días: de ${esc(numeroCorto(vs[0]))} a ${esc(numeroCorto(vs.at(-1)))}; el valor más alto ${esc(numeroCorto(max))}, el más bajo ${esc(numeroCorto(min))}. Con las flechas del teclado o el dedo ves cada día." data-graf>
          <p class="md-graf-l" aria-live="polite"><b data-gv>${esc(numeroCorto(p.v))}</b> <span data-gf>${esc(diaTexto(p.f))} · ${esc(nombre)}</span></p>
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${area}" class="md-area"/><path d="${linea}" class="md-linea"/>
            <line data-gl x1="${X(i).toFixed(1)}" x2="${X(i).toFixed(1)}" y1="${P}" y2="${H - P}" class="md-guia"/><circle data-gp cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="5" class="md-punto"/></svg>
          <p class="md-graf-e"><span>${esc(diaTexto(pts[0].f))}</span><span>máx. ${esc(numeroCorto(max))} · mín. ${esc(numeroCorto(min))}</span><span>${esc(diaTexto(pts.at(-1).f))}</span></p></div>`;
      }
      function moverIdx(host, clientX) {
        const pts = S._pts; if (!pts) return; const r = host.querySelector('svg').getBoundingClientRect(); if (!r.width) return;
        const i = Math.max(0, Math.min(pts.length - 1, Math.round(((clientX - r.left) / r.width) * (pts.length - 1)))); fijarIdx(host, i);
      }
      function fijarIdx(host, i) {
        const pts = S._pts; if (!pts) return; S.idx = i; const p = pts[i], W = 320, H = 150, P = 8, vs = pts.map(x => x.v), min = Math.min(...vs), max = Math.max(...vs), rango = max - min || 1;
        const x = P + (i * (W - 2 * P)) / (pts.length - 1), y = H - P - ((p.v - min) / rango) * (H - 2 * P - 14);
        host.querySelector('[data-gv]').textContent = numeroCorto(p.v); host.querySelector('[data-gf]').textContent = `${diaTexto(p.f)} · ${METRICAS.find(m => m[0] === S.metrica)[1]}`;
        const l = host.querySelector('[data-gl]'); l.setAttribute('x1', x); l.setAttribute('x2', x); const c = host.querySelector('[data-gp]'); c.setAttribute('cx', x); c.setAttribute('cy', y);
      }

      // ---------------------------------------------------------- pintar
      function pintar() {
        if (!S.cargado) { cuerpo.innerHTML = S.error ? falla(S.error) : esqueleto(4); return; }
        const d = S.d, m = d.meta || {};
        if (!S.ejemplo && !m.configurado) { cuerpo.innerHTML = conexion(m); return; }
        const cu = m.cuentas || [], una = unaDe(d), c = calcular(d);
        const banner = S.ejemplo ? '<p class="md-aviso info" role="status"><b>DATOS DE EJEMPLO.</b> No son de ninguna cuenta; sirven para ver cómo queda. <button type="button" class="mv-link" data-salir-ej>Salir del ejemplo</button></p>'
          : m.error ? `<p class="md-aviso rojo" role="alert"><b>Meta no responde bien.</b> ${esc(m.error)}</p>` : d.actualizando ? '<p class="md-aviso info" role="status">Leyendo Meta… puede tardar un par de minutos.</p>' : m.token?.faltan?.length ? `<p class="md-aviso rojo" role="alert">Al token de Meta le faltan permisos: ${m.token.faltan.map(esc).join(', ')}. Algunas cifras no salen.</p>` : '';
        const selector = `<button type="button" class="md-cuenta-b" data-cuentas aria-haspopup="dialog">${una ? avatar(una) : '<span class="md-ava todas" aria-hidden="true"><i>∑</i></span>'}<span><small>Viendo</small><b>${una ? esc(nombreCuenta(una)) : `Todas las cuentas (${cu.length})`}</b></span>${svg('flecha', 'md-fl')}</button>`;
        const chipsRango = `<div class="mv-chips md-chips-p" role="group" aria-label="Periodo">${RANGOS.map(([n, t]) => `<button type="button" class="mv-chip" data-dias="${n}" aria-pressed="${S.dias === n}">${t}</button>`).join('')}</div>`;
        const k = c.k, tarj = TARJETAS.map(([key, t]) => { const x = k[key]; const v = key === 'publicaciones' ? x.valor : x.valor; return `<div class="md-kpi" role="group" aria-label="${esc(t)}"><small>${esc(t)}</small><b>${esc(numeroCorto(v))}</b>${key === 'seguidores' && x.ganados != null ? `<small class="md-d ${x.ganados >= 0 ? 'bien' : 'mal'}">${x.ganados >= 0 ? '+' : ''}${esc(numeroCorto(x.ganados))} en ${S.dias} días</small>` : delta(x)}</div>`; }).join('');
        const chipsMet = `<div class="mv-chips md-chips-p" role="group" aria-label="Qué dibujar">${METRICAS.map(([key, t]) => `<button type="button" class="mv-chip" data-met="${key}" aria-pressed="${S.metrica === key}">${t}</button>`).join('')}</div>`;
        S.topImp = mejoresPublicaciones(c.e.maduras.length ? c.e.maduras : c.pubs, 6);
        const top = S.topImp.length ? `<h3 class="mv-gh">Las que más movieron <span>${S.topImp.length}</span></h3><ul class="md-lista">${S.topImp.map((p, i) => `<li class="md-pub-f"><div class="md-pub-r">${miniatura(p.miniatura, { clase: 'md-mini' })}<span class="md-pz-c"><b>${esc((p.texto || 'Sin texto').replace(/\s+/g, ' ').slice(0, 80))}</b><small>${iconoRed(p.red, { tam: 14 })} ${esc(NOMBRE_RED[p.red] || p.red)} · ${p.publicadaAt ? esc(diaTexto(p.publicadaAt.slice(0, 10))) : ''}</small><small><b>${esc(numeroCorto(p.interacciones))}</b> interacciones · <b>${esc(numeroCorto(p.alcance))}</b> alcance</small></span></div>
            <div class="md-sal-b"><button type="button" class="mv-btn primario" data-imp="${i}">Impulsar</button>${p.enlace ? `<a class="mv-btn" href="${esc(p.enlace)}" target="_blank" rel="noopener noreferrer">Ver en ${esc(NOMBRE_RED[p.red] || p.red)}</a>` : ''}</div></li>`).join('')}</ul><p class="mv-meta">Impulsar crea un borrador de campaña en pausa: no gasta nada hasta que lo actives con tus dos toques en Anuncios.</p>` : '';
        const comp = !una && c.comp.length > 1 ? `<h3 class="mv-gh">Comparar cuentas <span>${c.comp.length}</span></h3><ul class="md-lista">${c.comp.map(x => `<li><button type="button" class="md-comp" data-cta="${esc(x.cuenta.id)}" aria-label="Ver solo ${esc(nombreCuenta(x.cuenta))}">${avatar(x.cuenta)}<span class="md-comp-c"><b>${iconoRed(x.cuenta.red, { tam: 14 })} ${esc(nombreCuenta(x.cuenta))}</b><span class="md-comp-n"><span><small>Seguidores</small><b>${esc(numeroCorto(x.k.seguidores.valor))}</b></span><span><small>Alcance</small><b>${esc(numeroCorto(x.k.alcance.valor))}</b></span><span><small>Interacc.</small><b>${esc(numeroCorto(x.k.interacciones.valor))}</b></span></span></span></button></li>`).join('')}</ul>` : '';
        const ultima = d.ultimaFoto ? `<p class="mv-meta">Última foto de Meta: ${esc(String(d.ultimaFoto).slice(0, 10))}.</p>` : '';
        cuerpo.innerHTML = `${banner}${selector}${chipsRango}<div class="md-kpis">${tarj}</div>
          <h3 class="mv-gh">Evolución</h3>${chipsMet}${grafico(c.dd)}${comp}${top}
          <div class="md-acciones fin"><button type="button" class="mv-btn primario" data-informe>Informe del mes</button>${S.ejemplo ? '' : '<button type="button" class="mv-btn" data-actualizar>Actualizar con Meta</button>'}</div>${ultima}`;
      }
      function conexion(m) {
        return `<div class="md-card"><h2 class="md-q">Conecta Meta para ver cómo rinden tus redes</h2><p class="mv-texto">La oficina lee las cifras de Instagram y Facebook. Aquí solo lee. Se conecta con el token de un usuario del sistema de Business Manager, que se guarda como secreto de la oficina (nunca en un archivo). Los pasos completos están en Ajustes → Contenido → Meta.</p>
          <div class="md-acciones"><button type="button" class="mv-btn primario" data-comprobar>Comprobar conexión</button><button type="button" class="mv-btn" data-ejemplo>Ver con datos de ejemplo</button></div>${m.error ? `<p class="md-aviso rojo">${esc(m.error)}</p>` : ''}</div>`;
      }

      // ---------------------------------------------------------- la hoja de cuentas y el informe
      function hojaCuentas() {
        const cu = S.d.meta?.cuentas || [], grupo = r => cu.filter(a => a.red === r);
        const fila = a => `<li><button type="button" class="md-comp" data-cta="${esc(a.id)}" aria-pressed="${S.cuenta === a.id}">${avatar(a)}<span class="md-comp-c"><b>${esc(nombreCuenta(a))}</b><small>${esc(NOMBRE_RED[a.red] || a.red)}${a.nombre && a.usuario ? ' · ' + esc(a.nombre) : ''}</small></span>${S.cuenta === a.id ? '<span class="md-tick" aria-hidden="true">✓</span>' : ''}</button></li>`;
        const h = ctx.hoja({ titulo: 'Elegir cuenta', lleno: true, cuerpo: `<ul class="md-lista"><li><button type="button" class="md-comp" data-cta="" aria-pressed="${!S.cuenta}"><span class="md-ava todas" aria-hidden="true"><i>∑</i></span><span class="md-comp-c"><b>Todas las cuentas</b><small>Suma Instagram y Facebook</small></span>${!S.cuenta ? '<span class="md-tick" aria-hidden="true">✓</span>' : ''}</button></li></ul>
          ${['instagram', 'facebook'].map(r => grupo(r).length ? `<h3 class="mv-gh">${esc(NOMBRE_RED[r])}</h3><ul class="md-lista">${grupo(r).map(fila).join('')}</ul>` : '').join('')}` });
        h.cuerpo.addEventListener('click', e => { const b = e.target.closest('[data-cta]'); if (!b) return; S.cuenta = b.dataset.cta; guardar('cuenta', S.cuenta); S.idx = null; h.cerrar(); pintar(); });
      }
      function hojaInforme() {
        let mes = mesesAtras(4)[0];
        const h = ctx.hoja({ titulo: 'Informe del mes', lleno: true, cuerpo: `<div class="mv-chips md-chips-p" role="group" aria-label="Mes">${mesesAtras(4).map(mm => `<button type="button" class="mv-chip" data-mes="${mm}" aria-pressed="${mm === mes}">${esc(mesTxt(mm))}</button>`).join('')}</div><div data-inf>${esqueleto(3)}</div>`, acciones: S.ejemplo ? [] : [{ texto: 'Guardar en el Cerebro', alTocar: async (x, b) => { const r = await con(b, () => ctx.api('/api/contenido/informe', { method: 'POST', body: { mes, ...(S.cuenta ? { cuenta: S.cuenta } : {}) } }), { hecho: 'Guardado' }); if (r.ok) ctx.toast('Guardado en el Cerebro (Informes).'); } }] });
        const ver = async () => {
          const w = h.cuerpo.querySelector('[data-inf]'); w.innerHTML = esqueleto(3);
          try {
            if (S.ejemplo) { w.innerHTML = '<p class="mv-nada">En el ejemplo no hay informe: es para ver cómo queda la pantalla.</p>'; return; }
            const r = await ctx.api(`/api/contenido/informe?mes=${mes}${S.cuenta ? '&cuenta=' + encodeURIComponent(S.cuenta) : ''}`);
            w.innerHTML = `<h3 class="md-q">${esc(r.titulo || mesTxt(mes))}</h3><pre class="md-informe">${esc(r.texto || 'Sin datos de este mes.')}</pre>`;
          } catch (e) { w.innerHTML = falla(motivo(e), 'data-inf-re'); }
        };
        h.cuerpo.addEventListener('click', e => { const b = e.target.closest('[data-mes]'); if (b) { mes = b.dataset.mes; h.cuerpo.querySelectorAll('[data-mes]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); ver(); } else if (e.target.closest('[data-inf-re]')) ver(); });
        ver();
      }

      // ---------------------------------------------------------- eventos
      cuerpo.addEventListener('click', async e => {
        const t = e.target.closest('button'); if (!t) return; const dt = t.dataset;
        if (t.matches('[data-reintentar]')) return cargar();
        if (dt.dias) { S.dias = +dt.dias; guardar('dias', S.dias); S.idx = null; return pintar(); }
        if (dt.met) { S.metrica = dt.met; guardar('metrica', S.metrica); S.idx = null; return pintar(); }
        if (t.hasAttribute('data-cuentas')) return hojaCuentas();
        if (dt.cta != null) { S.cuenta = dt.cta; guardar('cuenta', S.cuenta); S.idx = null; sc.scrollTop = 0; return pintar(); }
        if (t.hasAttribute('data-ejemplo')) { S.ejemplo = true; return cargar(); }
        if (t.hasAttribute('data-salir-ej')) { S.ejemplo = false; S.cuenta = ''; return cargar(); }
        if (t.hasAttribute('data-informe')) return hojaInforme();
        if (t.hasAttribute('data-comprobar')) { const r = await con(t, () => ctx.api('/api/contenido/meta/sincronizar', { method: 'POST', body: {} }), { hecho: 'Revisado' }); if (r.ok) { if (r.valor?.meta?.error) ctx.toast(r.valor.meta.error); await cargar({ silencioso: true }); } return; }
        if (t.hasAttribute('data-actualizar')) { const r = await con(t, () => ctx.api('/api/contenido/analiticas/actualizar', { method: 'POST', body: {} }), { hecho: 'Leyendo Meta…' }); if (r.ok) { ctx.toast('Meta se está leyendo: tarda un par de minutos.'); setTimeout(() => cargar({ silencioso: true }), 4000); } return; }
        if (dt.imp != null) {
          const p = S.topImp[+dt.imp]; if (!p) return;
          if (S.ejemplo) { ctx.toast('En el ejemplo no se crea nada. Con tus cuentas conectadas, «Impulsar» te lleva a un borrador de campaña en pausa.'); return; }
          const r = await con(t, () => ctx.api('/api/anuncios/impulsar', { method: 'POST', body: { id: p.id, red: p.red } }), { hecho: 'Borrador listo', ocupado: 'Preparando…' });
          if (r.ok && r.valor?.borrador) ctx.navegar('anuncios', { tab: 'borradores', borrador: r.valor.borrador.id, paso: 3 });
          else if (!r.ok) ctx.toast(r.error);
        }
      });
      // el gráfico: el dedo (o el ratón) lo recorre; el teclado, con las flechas
      const alMover = e => { const g = e.target.closest?.('[data-graf]'); if (g && (e.buttons || e.pointerType === 'touch' || e.type === 'pointerdown')) moverIdx(g, e.clientX); };
      cuerpo.addEventListener('pointerdown', alMover); cuerpo.addEventListener('pointermove', alMover);
      cuerpo.addEventListener('keydown', e => { const g = e.target.closest?.('[data-graf]'); if (!g || !S._pts) return; const n = S._pts.length; let i = S.idx == null ? n - 1 : S.idx; if (e.key === 'ArrowLeft') i--; else if (e.key === 'ArrowRight') i++; else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = n - 1; else return; e.preventDefault(); fijarIdx(g, Math.max(0, Math.min(n - 1, i))); });
      ctx.tirar(sc, () => cargar({ silencioso: true }));
      el._cargar = cargar; el._S = S;
      cargar();
    },
    alMostrar(el, ctx) { ctx.cabecera({ titulo: 'Analíticas', acciones: [] }); el._cargar?.({ silencioso: true }); },
  });
}
