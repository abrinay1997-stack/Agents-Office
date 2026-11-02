// Versión móvil (25 oct 2026) — ANUNCIOS DE META, hecho para el pulgar: Resumen, Campañas (con el interruptor escrito en palabras), Sugerencias,
// Creativos, Borradores (y el asistente de 5 pasos a pantalla completa) e Historial.
// LA REGLA DEL DINERO (plan §3) ES INNEGOCIABLE y aquí no se relaja: lo que BAJA el gasto (pausar, bajar un presupuesto) es un toque con DESHACER;
// lo que GASTA (activar, reanudar, subir un presupuesto, alargar, relanzar) pide DOS toques: el primero pregunta al servidor y este contesta la
// cifra exacta («hasta 15,00 US$ al día») y los topes; el segundo, en una hoja inferior que repite esa cifra, es «Sí, activar — hasta …». Si no cabe
// en los topes, el servidor dice que no y no hay atajo. Todo se crea EN PAUSA. Quien decide es SIEMPRE el servidor (anuncios/acciones.mjs):
// aquí solo se ofrece, se enseña la cifra y se espera el «Sí». Datos y demo: los mismos de escritorio (src/anuncios/datos.js).
import { crearDatos } from '../../anuncios/datos.js';
import { accionesDe, interruptorDe, menuDe, GASTO, LIBRES, TEXTO, presupuestoDe, reiniciaAprendizaje, AVISO_APRENDIZAJE, errorImporte, importe, botonSi, pideDatos, terminada } from '../../anuncios/acciones.js';
import { filtrar, ordenar, aplanar, buscar, RANGOS, FILTROS, nombreRango } from '../../anuncios/campanas.js';
import { dinero, pct, num, frec, contraTope, tendencia, rangoTexto, fechaCorta, haceCuanto, estadoDe, aprendizajeDe, resultados, presupuesto, tieneProblemas, SIN } from '../../anuncios/comun.js';
import { deEstado, topResumen, cuentas as cuentasSug, informativa, botonAplicar, cambioTexto, reglaTexto, FILTROS_SUG } from '../../anuncios/sugerencias.js';
import { creativosConEstado, borradorDeCreativo } from '../../anuncios/creativos.js';
import { quienTexto, QUIENES, filtrarHistorial } from '../../anuncios/historial.js';
import { opcionesCuenta } from '../../anuncios/comun.js';
import { filtrarVista } from '../../../anuncios/cuentas.mjs';
import { PASOS, OBJETIVOS, DESTINOS, LLAMADA, llamadasDe, CATEGORIAS, PAISES, LARGO, MAX_CREATIVOS, MIN_RECOMENDADO, pasoDe, costoTexto, avisoSinFin, estadoB, editable, deQuien, poner, creativoNuevo, ajustarLlamadas, formatoDeMedidas, iframeMeta, UBICACIONES_META, objetivoTexto, objetivoDe, origenTexto, RED_ORIGEN } from '../../anuncios/borrador.js';
import { esc, svg, vacio, esqueleto, falla } from '../ui.js';
import { con, miniatura, subirArchivo, motivo, iconoRed } from './d-comun.js';
const rangoMv = d => { const t = rangoTexto(d); return t ? `<p class="mv-meta" data-rango-texto>${esc(t)}</p>` : ''; };

// en el ejemplo los datos contestan al instante (sin promesa): aquí todos son promesas, para tratarlos igual
const crudos = crearDatos({ servida: true });
const G = { datos: new Proxy(crudos, { get: (t, k) => (typeof t[k] === 'function' ? async (...a) => t[k](...a) : t[k]) }), ejemplo: false };
const tono = t => ({ verde: 'bien', rojo: 'mal', ambar: 'aviso', azul: 'info', gris: '' }[t] ?? '');
const chip = (txt, t = 'gris') => `<span class="md-chip ${tono(t)}">${esc(txt)}</span>`;
const opc = () => ({ ejemplo: G.ejemplo });
const TABS = [['resumen', 'Resumen'], ['campanas', 'Campañas'], ['sugerencias', 'Sugerencias'], ['creativos', 'Creativos'], ['borradores', 'Borradores'], ['historial', 'Historial']];

export function registrar(shell) {
  // ===================================================================================================================== el panel
  shell.registrarVista({
    id: 'anuncios', titulo: 'Anuncios', icono: 'anuncios', grupo: 'mas', sec: 'negocio', texto: 'Tus campañas de Meta',
    montar(el, ctx) {
      const S = { cuenta: 'todas', d: null, sug: null, hist: null, bor: null, tab: 'resumen', rango: '7d', filtro: 'todas', orden: 'gasto', abiertos: new Set(), cargado: false, error: null, fsug: 'viva', quien: 'todos', leyendo: false };
      el.innerHTML = `<div class="mv-chips md-tabs" role="group" aria-label="Secciones de Anuncios">${TABS.map(([k, n]) => `<button type="button" class="mv-chip" data-tab="${k}" aria-pressed="false">${n}<b data-n="${k}" hidden></b></button>`).join('')}</div>
        <div class="mv-scroll" data-sc><div class="mv-cuerpo md-an" aria-live="polite"></div></div>`;
      const cuerpo = el.querySelector('.md-an'), sc = el.querySelector('[data-sc]');
      const moneda = () => S.d?.cuenta?.moneda || 'USD';

      async function cargar({ silencioso = false } = {}) {
        if (!silencioso && !S.cargado) cuerpo.innerHTML = esqueleto(4);
        try { S.d = await G.datos.leer(S.rango, opc()); S.cargado = true; S.error = null; } catch (e) { S.error = motivo(e); }
        pintar();
        cargarSug(); if (S.tab === 'historial' || S.hist) cargarHist(); cargarBor();
      }
      async function cargarSug() { const r = await G.datos.sugerencias(opc()); if (r.items || r.status === 200) { S.sug = r; marcar(); if (['resumen', 'sugerencias', 'creativos'].includes(S.tab)) pintar(); } }
      async function cargarHist() { try { S.hist = await G.datos.historial(opc()); } catch { S.hist = S.hist || []; } if (S.tab === 'historial') pintar(); }
      async function cargarBor() { const r = await G.datos.borradores(opc()); if (r.status === 200) { S.bor = r.items || []; marcar(); if (S.tab === 'borradores') pintar(); } }
      function marcar() {
        const nS = (S.sug?.items || []).filter(s => (s.estado || 'viva') === 'viva' && !informativa(s)).length, nB = (S.bor || []).filter(b => b.estado !== 'creado').length;
        for (const [k, n] of [['sugerencias', nS], ['borradores', nB]]) { const b = el.querySelector(`[data-n="${k}"]`); b.textContent = n; b.hidden = !n; }
      }

      // ------------------------------------------------------------------ Resumen
      /** La cuenta elegida (página/Instagram), si todavía existe entre las que tienen anuncios; si no, todas. */
      const cuentaSelM = () => (S.cuenta !== 'todas' && S.d && opcionesCuenta(S.d).some(([k]) => k === S.cuenta) ? S.cuenta : 'todas');
      function pintarResumen() {
        const d = S.d, m = moneda();
        if (!d.configurado && !G.ejemplo) return `<div class="md-card"><h2 class="md-q">Conecta tu cuenta publicitaria</h2><p class="mv-texto">${esc(d.motivo || 'Todavía no hay una cuenta de anuncios conectada.')}</p><p class="mv-meta">Se conecta con el token de Meta y el id de la cuenta en Ajustes → Anuncios. Aquí solo se lee hasta que tú actives algo, y todo lo que crees nace en pausa.</p><button type="button" class="mv-btn" data-ejemplo>Ver con datos de ejemplo</button></div>`;
        const g = d.gasto || {}, t = d.topes || {}, tend = d.resumen?.tendencia || {};
        const medidor = (txt, gastado, tope) => { const c = contraTope(gastado, tope), p = c && c.pct != null ? Math.min(100, c.pct) : 0; return `<div class="md-med"><p><span>${txt}</span><b>${esc(dinero(gastado, m))}</b>${tope > 0 ? `<small>de ${esc(dinero(tope, m))}</small>` : '<small>sin tope</small>'}</p>${tope > 0 ? `<div class="md-barra ${tono(c?.tono)}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p)}" aria-label="${txt}: ${Math.round(p)} % del tope"><i style="width:${p}%"></i></div>` : ''}</div>`; };
        const tr = (v, mejorSube) => { const x = tendencia(v, mejorSube, d.resumen?.tendenciaMotivo); return `<small class="md-d ${x.tono === 'verde' ? 'bien' : x.tono === 'rojo' ? 'mal' : 'nd'}">${x.flecha ? `<span aria-hidden="true">${x.flecha}</span> ` : ''}${esc(x.texto)}</small>`; };
        const avisos = (d.avisos || []).map(a => `<p class="md-aviso ${a.nivel === 'error' || a.nivel === 'alta' ? 'rojo' : a.nivel === 'info' ? 'info' : ''}" role="${a.nivel === 'error' ? 'alert' : 'status'}">${esc(a.texto)}</p>`).join('');
        const top = topResumen(S.sug?.items || [], 3);
        return `${G.ejemplo ? '<p class="md-aviso info" role="status"><b>DATOS DE EJEMPLO.</b> No son de ninguna cuenta; nada que hagas sale a Meta. <button type="button" class="mv-link" data-salir-ej>Salir del ejemplo</button></p>' : ''}${avisos}
          <div class="md-card"><div class="md-card-c"><div><small>Cuenta</small><b>${esc(d.cuenta?.nombre || '—')}</b><small>${esc(d.cuenta?.estadoTexto || '')} · ${esc(m)}</small></div>${chip(d.cuenta?.estadoTexto || 'sin estado', /activ/i.test(d.cuenta?.estadoTexto || '') ? 'verde' : 'gris')}</div>
            <p class="mv-meta">${d.sincronizadaAt ? 'Leída ' + esc(haceCuanto(d.sincronizadaAt)) : 'Sin leer todavía'}${d.error ? ' · ' + esc(d.error) : ''}</p>
            <button type="button" class="mv-btn" data-actualizar>${S.leyendo || d.sincronizando ? 'Leyendo Meta…' : 'Actualizar'}</button></div>
          <h3 class="mv-gh">Lo que llevas gastado</h3><div class="md-card">${medidor('Hoy', g.hoy, t.diario)}${medidor('Esta semana', g.semana, null)}${medidor('Este mes', g.mes, t.mensual)}</div>
          ${(d.porCuenta || []).length ? `<h3 class="mv-gh">Por cuenta <span>${d.porCuenta.length}</span></h3><p class="mv-meta">La cuenta publicitaria es una sola; cada anuncio sale en una página y su Instagram. Un anuncio cuenta una vez, en su marca.</p><ul class="md-lista md-cards" data-por-cuenta>${d.porCuenta.map(x => { const id = x.clave ? (x.cuentas?.[0]?.id || 'facebook:' + x.clave) : 'sin', c = x.cifras || {}; return `<li class="md-card"><b>${esc(x.texto)}</b><p class="mv-meta">${x.anuncios} ${x.anuncios === 1 ? 'anuncio' : 'anuncios'} · ${x.campanas} ${x.campanas === 1 ? 'campaña' : 'campañas'}${x.clave ? '' : ' · no se pudo saber de qué página son'}</p><dl class="md-cif"><div><dt>Gasto</dt><dd>${esc(dinero(x.gasto, m))}</dd></div><div><dt>Resultados</dt><dd>${esc(resultados(c))}${x.otrosObjetivos ? ' *' : ''}</dd></div><div><dt>Costo/res.</dt><dd>${esc(dinero(c.costoPorResultado, m))}</dd></div></dl><button type="button" class="mv-btn" data-ver-cuenta="${esc(id)}">Ver sus campañas</button></li>`; }).join('')}</ul>` : ''}
          <h3 class="mv-gh">Últimos 7 días</h3><div class="md-kpis"><div class="md-kpi"><small>Resultados</small><b>${esc(num(d.resumen?.resultados7d))}</b><small>${esc(d.resumen?.resultadoTexto || '')}</small>${tr(tend.resultados, true)}</div><div class="md-kpi"><small>Costo por resultado</small><b>${esc(dinero(d.resumen?.costoPorResultado7d, m))}</b>${tr(tend.gasto, false)}</div></div>
          ${top.length ? `<h3 class="mv-gh">Lo que conviene mirar <span>${top.length}</span></h3><ul class="md-lista">${top.map(s => `<li><button type="button" class="md-sug-m" data-ver-sug="${esc(s.id)}"><b>${esc(reglaTexto(s.regla))}</b><small>${esc(s.objeto?.nombre || '')}</small><span>${esc(s.dato || '')}</span></button></li>`).join('')}</ul><button type="button" class="mv-link" data-tab-ir="sugerencias">Ver todas las sugerencias</button>` : ''}
          <div class="md-acciones fin"><button type="button" class="mv-btn primario" data-informe>Informe del mes</button><button type="button" class="mv-btn" data-nueva>Nueva campaña</button></div>`;
      }

      // ------------------------------------------------------------------ Campañas
      function tarjetaFila(f) {
        const n = f.nodo, c = n.cifras || {}, e = estadoDe(n), m = moneda(), acc = accionesDe(f), sw = interruptorDe(acc), ap = f.nivel === 'conjunto' ? aprendizajeDe(n.aprendizaje) : null;
        const nivel = { campana: 'Campaña', conjunto: 'Conjunto', anuncio: 'Anuncio' }[f.nivel];
        const sinGasto = !acc.length ? '' : sw ? `<button type="button" class="md-sw ${sw.tipo === 'pausar' ? 'on' : 'off'}" data-act="${sw.tipo}" data-id="${esc(f.id)}" aria-label="${esc(sw.texto)}: ${esc(n.nombre || '')}"><span class="md-sw-i" aria-hidden="true"></span><span>${sw.tipo === 'pausar' ? 'Activa · <b>Pausar</b>' : `En pausa · <b>${esc(sw.texto)}</b>${sw.gasto ? ' (gasta)' : ''}`}</span></button>` : '';
        return `<li class="md-camp n-${f.nivel}"><div class="md-camp-c">
          <button type="button" class="md-camp-n" data-det="${esc(f.id)}"><small>${nivel}</small><b>${esc(n.nombre || '(sin nombre)')}</b></button>
          <p class="md-pz-m">${chip(e.texto, e.tono)}${ap && ap.texto !== SIN ? chip(ap.texto, ap.tono) : ''}${n.creadoFuera ? chip('creado fuera') : ''}${tieneProblemas(n) && e.tono !== 'rojo' ? chip('pide atención', 'rojo') : ''}</p>
          <p class="md-cuenta" data-cuenta-fila>${esc(n.cuentaTexto || 'cuenta no identificada')}</p>
          <dl class="md-cif"><div><dt>Gasto</dt><dd>${esc(dinero(c.gasto, m))}</dd></div><div><dt>Resultados</dt><dd>${esc(resultados(c))}</dd></div><div><dt>Costo/res.</dt><dd>${esc(dinero(c.costoPorResultado, m))}</dd></div>${f.nivel !== 'anuncio' ? `<div><dt>Presupuesto</dt><dd>${esc(presupuesto(n.presupuesto, m))}</dd></div>` : ''}</dl>
          <div class="md-camp-b">${sinGasto}${acc.length > (sw ? 1 : 0) ? `<button type="button" class="mv-btn" data-mas="${esc(f.id)}" aria-haspopup="dialog" aria-label="Más acciones de ${esc(n.nombre || '')}">Más…</button>` : ''}${f.hijos ? `<button type="button" class="mv-btn" data-tog="${esc(f.id)}" aria-expanded="${f.abierto}">${f.abierto ? 'Ocultar' : f.nivel === 'campana' ? `Conjuntos (${f.hijos})` : `Anuncios (${f.hijos})`}</button>` : ''}</div></div></li>`;
      }
      function pintarCampanas() {
        const d0 = S.d, sel = cuentaSelM(), d = filtrarVista(d0, sel), lista = ordenar(filtrar(d.campanas || [], S.filtro), S.orden), filas = aplanar(lista, S.abiertos);
        const cnt = Object.fromEntries(FILTROS.map(([k]) => [k, filtrar(d.campanas || [], k).length]));
        const ops = opcionesCuenta(d0), selC = ops.length > 2 ? `<label class="mv-lab" for="mdCuenta">Cuenta</label><select id="mdCuenta" data-cuenta>${ops.map(([k, n]) => `<option value="${esc(k)}"${k === sel ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>` : '';
        return `${selC}<div class="mv-chips md-chips-p" role="group" aria-label="Periodo">${RANGOS.map(([k, n]) => `<button type="button" class="mv-chip" data-rango="${k}" aria-pressed="${S.rango === k}">${n}</button>`).join('')}</div>
          <div class="mv-chips md-chips-p" role="group" aria-label="Qué campañas">${FILTROS.map(([k, n]) => `<button type="button" class="mv-chip" data-filtro="${k}" aria-pressed="${S.filtro === k}">${n}<b>${cnt[k]}</b></button>`).join('')}</div>
          ${rangoMv(d)}
          ${filas.length ? `<ul class="md-lista">${filas.map(tarjetaFila).join('')}</ul>` : vacio('No hay campañas aquí', S.filtro === 'todas' ? 'Cuando crees una o la cuenta tenga alguna, aparecerá.' : 'Prueba con otro filtro.', { icono: 'anuncios' })}`;
      }

      // ------------------------------------------------------------------ Sugerencias
      function pintarSug() {
        const r = S.sug; if (!r) return esqueleto(3);
        const cn = cuentasSug(r.items || []), lista = deEstado(r.items || [], S.fsug), m = moneda();
        const card = s => {
          const b = botonAplicar(s), f = S.d && s.cambio?.id ? buscar(S.d.campanas || [], s.cambio.id) : null;
          return `<li class="md-card" data-sug="${esc(s.id)}"><p class="md-pz-m">${chip(reglaTexto(s.regla), s.prioridad === 1 ? 'rojo' : s.prioridad === 2 ? 'ambar' : 'gris')}${s.estado && s.estado !== 'viva' ? chip({ aplicada: 'Aplicada', descartada: 'Descartada', pospuesta: 'Pospuesta' }[s.estado] || s.estado, 'gris') : ''}</p>
            <h4 class="md-h4">${esc(s.objeto?.nombre || '')}</h4>${f?.nodo?.cuentaTexto ? `<p class="md-cuenta" data-cuenta-sug>${esc(f.nodo.cuentaTexto)}</p>` : ''}<p class="mv-texto"><b>${esc(s.dato || '')}</b></p><p class="mv-meta">${esc(s.porque || '')}</p>
            ${!informativa(s) ? `<p class="md-cambio"><b>Cambio:</b> ${esc(cambioTexto(s, { moneda: m, f }))}</p>` : ''}${s.efecto ? `<p class="mv-meta"><b>Efecto:</b> ${esc(s.efecto)}</p>` : ''}${s.riesgo?.texto ? `<p class="mv-meta"><b>Riesgo:</b> ${esc(s.riesgo.texto)}</p>` : ''}
            ${s.estado === 'viva' && !informativa(s) || s.estado === 'viva' ? `<div class="md-sal-b">${b ? `<button type="button" class="mv-btn primario" data-aplicar="${esc(s.id)}">${esc(b.texto)}</button>` : ''}<button type="button" class="mv-btn" data-descartar="${esc(s.id)}">Descartar</button>${!informativa(s) ? `<button type="button" class="mv-btn" data-posponer="${esc(s.id)}">Recordármelo en 3 días</button>` : ''}</div>` : ''}</li>`;
        };
        return `<div class="mv-chips md-chips-p" role="group" aria-label="Qué sugerencias">${FILTROS_SUG.map(([k, n]) => `<button type="button" class="mv-chip" data-fsug="${k}" aria-pressed="${S.fsug === k}">${n}<b>${cn[k] || 0}</b></button>`).join('')}</div>
          ${r.sinObjetivo ? `<p class="md-aviso">${esc(r.sinObjetivo)}</p>` : ''}
          ${lista.length ? `<ul class="md-lista md-cards">${lista.map(card).join('')}</ul>` : vacio(S.fsug === 'viva' ? 'Nada que mejorar ahora' : 'Nada aquí', S.fsug === 'viva' ? 'Cuando la oficina vea algo en tus campañas, te lo dice aquí con el porqué.' : '', { icono: 'check' })}
          <p class="mv-meta">Aplicar nunca gasta sin tus dos toques: lo que sube el gasto te enseña la cifra y espera tu «Sí».</p>`;
      }

      // ------------------------------------------------------------------ Creativos
      function pintarCreativos() {
        if (!S.sug && !G.ejemplo) { cargarSug(); }
        const l = creativosConEstado(S.d.campanas || [], { cpaObjetivo: S.sug?.cpaObjetivo ?? null, umbrales: S.sug?.umbrales || {}, moneda: moneda() }), m = moneda();
        S._creativos = l;
        return `<div class="mv-chips md-chips-p" role="group" aria-label="Periodo">${RANGOS.map(([k, n]) => `<button type="button" class="mv-chip" data-rango="${k}" aria-pressed="${S.rango === k}">${n}</button>`).join('')}</div>
          ${rangoMv(S.d)}
          ${l.length ? `<ul class="md-lista md-cards">${l.map((g, i) => { const cr = g.creativo || {}, c = g.cifras, sug = (S.sug?.items || []).find(s => (s.estado || 'viva') === 'viva' && s.cambio?.tipo === 'creativos' && g.anuncios.some(a => a.id === s.cambio.id));
            return `<li class="md-card"><div class="md-pub-r">${miniatura(cr.miniatura, { externa: true, clase: 'md-mini grande' })}<span class="md-pz-c"><b>${esc(cr.titulo || g.anuncios[0]?.nombre || '(sin titular)')}</b><span class="md-pz-m">${chip(g.estado.texto, g.estado.tono)}</span>${cr.texto ? `<small>${esc(cr.texto.slice(0, 120))}</small>` : ''}</span></div>
              <dl class="md-cif"><div><dt>CTR de enlace</dt><dd>${esc(pct(c.ctr))}</dd></div><div><dt>Costo/res.</dt><dd>${esc(dinero(c.costoPorResultado, m))}</dd></div><div><dt>Frecuencia</dt><dd>${esc(frec(c.frecuencia))}</dd></div><div><dt>Gasto ${esc(nombreRango(S.rango))}</dt><dd>${esc(dinero(c.gasto, m))}</dd></div></dl>
              <p class="mv-meta">${esc(g.estado.porque || '')}</p><p class="mv-meta">En ${g.anuncios.length} ${g.anuncios.length === 1 ? 'anuncio' : 'anuncios'}${[...new Set(g.anuncios.map(a => a.cuentaTexto).filter(Boolean))].length ? ' · ' + esc([...new Set(g.anuncios.map(a => a.cuentaTexto).filter(Boolean))].join(' / ')) : ''}.</p>
              <div class="md-sal-b">${sug ? `<button type="button" class="mv-btn primario" data-aplicar="${esc(sug.id)}">Pedir variaciones</button>` : `<button type="button" class="mv-btn" data-cr-nueva="${i}">Nueva campaña con este creativo</button>`}</div></li>`; }).join('')}</ul>` : vacio('Todavía no hay creativos con cifras', 'Cuando tus anuncios empiecen a salir, aquí verás cuál funciona y cuál se cansa.', { icono: 'contenido' })}`;
      }

      // ------------------------------------------------------------------ Borradores / Historial
      function pintarBor() {
        if (S.bor == null) return esqueleto(3);
        const orden = [...S.bor].sort((a, b) => (a.estado === 'creado') - (b.estado === 'creado') || String(b.actualizadoAt || '').localeCompare(String(a.actualizadoAt || '')));
        return `<button type="button" class="mv-btn primario md-ancho" data-nueva>+ Nueva campaña</button><p class="mv-meta">Un borrador vive en la oficina: no gasta ni sale en Meta hasta que pulses «Crear en Meta (en pausa)». Activarla después te pide los dos toques con la cifra.</p>
          ${orden.length ? `<ul class="md-lista md-cards">${orden.map(b => { const e = estadoB(b), cm = b.validacion?.costoMax, n = (b.creativos || []).length; return `<li class="md-card"><button type="button" class="md-bor" data-bor="${esc(b.id)}">${b.origen?.miniatura ? miniatura(b.origen.miniatura, { externa: true, clase: 'md-mini' }) : miniatura(b.creativos?.[0]?.media, { clase: 'md-mini' })}<span class="md-pz-c"><b>${esc(b.nombre || '(sin nombre)')}</b><span class="md-pz-m">${chip(e.texto, e.tono)}${chip('De: ' + deQuien(b.de), b.de === 'dueno' ? 'gris' : 'azul')}</span><small>${esc(objetivoTexto(b))} · ${b.origen ? esc(origenTexto(b)) : `${n} ${n === 1 ? 'creativo' : 'creativos'}`}</small><small data-cuenta-borrador>${b.cuentaTexto ? 'Saldrá en: ' + esc(b.cuentaTexto) : ''}</small><small>${cm ? 'Costo máximo: ' + esc(costoTexto(cm, moneda())) : 'Costo máximo: se calcula al revisarlo.'}</small>${b.estado === 'fallo' && b.error ? `<small class="rojo">${esc(b.error)}</small>` : ''}</span></button>
            <div class="md-sal-b">${b.estado === 'creado' && b.meta?.campana ? `<button type="button" class="mv-btn" data-ver-camp="${esc(b.meta.campana)}">Ver la campaña en pausa</button>` : ''}${b.estado !== 'creando' ? `<button type="button" class="mv-btn peligro" data-bor-borrar="${esc(b.id)}">Borrar</button>` : ''}</div></li>`; }).join('')}</ul>` : vacio('Todavía no hay borradores', 'Empieza una campaña con «+ Nueva campaña»; Dimitri y tu agente de anuncios también pueden dejarte uno.', { icono: 'anuncios' })}`;
      }
      function pintarHist() {
        if (S.hist == null) return esqueleto(3);
        const l = filtrarHistorial(S.hist, S.quien);
        return `<div class="mv-chips md-chips-p" role="group" aria-label="Quién lo hizo">${QUIENES.map(([k, n]) => `<button type="button" class="mv-chip" data-quien="${k}" aria-pressed="${S.quien === k}">${n}</button>`).join('')}</div>
          ${l.length ? `<ul class="md-lista">${l.map(i => `<li class="md-hist"><b>${esc(i.que || '')}</b><small>${esc(quienTexto(i.quien))} · ${esc(haceCuanto(i.at) || '')}${i.objeto?.cuenta ? ' · en ' + esc(i.objeto.cuenta) : ''}${i.objeto ? ' · ' + esc(typeof i.objeto === 'object' ? (i.objeto.nombre || i.objeto.id || '') : i.objeto) : ''}</small>${i.antes != null || i.despues != null ? `<small>${esc(String(i.antes ?? '—'))} → ${esc(String(i.despues ?? '—'))}</small>` : ''}</li>`).join('')}</ul>` : vacio('Sin movimientos', 'Aquí queda cada cambio que se hace en tus campañas, y quién lo hizo.', { icono: 'historial' })}`;
      }

      function pintar() {
        el.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === S.tab; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); });
        if (!S.cargado) { cuerpo.innerHTML = S.error ? falla(S.error) : esqueleto(4); return; }
        if (S.error && !S.d) { cuerpo.innerHTML = falla(S.error); return; }
        const t = S.tab, d = S.d;
        const necesitaCuenta = !d?.configurado && !G.ejemplo && t !== 'resumen' && t !== 'borradores';
        cuerpo.innerHTML = necesitaCuenta ? `<div class="md-card"><p class="mv-texto">${esc(d?.motivo || 'Conecta tu cuenta publicitaria para ver esto.')}</p><button type="button" class="mv-btn" data-tab-ir="resumen">Ir al Resumen</button></div>` : t === 'resumen' ? pintarResumen() : t === 'campanas' ? pintarCampanas() : t === 'sugerencias' ? pintarSug() : t === 'creativos' ? pintarCreativos() : t === 'borradores' ? pintarBor() : pintarHist();
      }

      // ------------------------------------------------------------------ el detalle de una fila
      function detalle(id) {
        const f = S.d && buscar(S.d.campanas || [], id); if (!f) return;
        const n = f.nodo, c = n.cifras || {}, e = estadoDe(n), m = moneda(), acc = accionesDe(f), cr = n.creativo;
        const h = ctx.hoja({ titulo: n.nombre || 'Detalle', lleno: true, cuerpo: `<p class="md-pz-m">${chip(e.texto, e.tono)}${n.creadoFuera ? chip('creado fuera de la oficina') : ''}</p><p class="md-cuenta" data-cuenta-detalle>Cuenta: <b>${esc(n.cuentaTexto || 'cuenta no identificada')}</b></p>
          ${(n.problemas || []).length ? `<ul class="md-prob">${n.problemas.map(p => `<li class="mal">${esc(typeof p === 'string' ? p : p.texto || p.mensaje || '')}</li>`).join('')}</ul>` : ''}
          ${cr ? `<div class="md-pub-r">${miniatura(cr.miniatura, { externa: true, clase: 'md-mini grande' })}<span class="md-pz-c"><b>${esc(cr.titulo || '')}</b><small>${esc(cr.texto || '')}</small>${cr.llamada ? `<small>Botón: ${esc(cr.llamada)}</small>` : ''}</span></div>` : ''}
          <dl class="md-cif g"><div><dt>Gasto</dt><dd>${esc(dinero(c.gasto, m))}</dd></div><div><dt>Resultados</dt><dd>${esc(resultados(c))}</dd></div><div><dt>Costo por resultado</dt><dd>${esc(dinero(c.costoPorResultado, m))}</dd></div><div><dt>Alcance</dt><dd>${esc(num(c.alcance))}</dd></div><div><dt>Impresiones</dt><dd>${esc(num(c.impresiones))}</dd></div><div><dt>Frecuencia</dt><dd>${esc(frec(c.frecuencia))}</dd></div><div><dt>Clics</dt><dd>${esc(num(c.clics))}</dd></div><div><dt>CTR de enlace</dt><dd>${esc(pct(c.ctr))}</dd></div><div><dt>CPC</dt><dd>${esc(dinero(c.cpc, m))}</dd></div><div><dt>CPM</dt><dd>${esc(dinero(c.cpm, m))}</dd></div></dl>
          ${f.nivel !== 'anuncio' ? `<p class="mv-meta">Presupuesto: <b>${esc(presupuesto(n.presupuesto, m))}</b>${n.fin ? ` · termina ${esc(fechaCorta(n.fin))}` : ''}</p>` : ''}
          <h3 class="mv-gh">Qué puedes hacer</h3><div class="md-acciones col">${acc.map(a => `<button type="button" class="mv-btn ${a.gasto ? '' : ''}" data-act="${a.tipo}" data-id="${esc(f.id)}">${esc(a.texto)}${a.gasto ? ' — gasta, pide tus dos toques' : ''}</button>${a.nota ? `<small class="mv-meta">${esc(a.nota)}</small>` : ''}`).join('') || '<p class="mv-nada">No hay acciones para esto ahora.</p>'}</div>` });
        h.cuerpo.addEventListener('click', e2 => { const b = e2.target.closest('[data-act]'); if (!b) return; h.cerrar(); setTimeout(() => accionar(b.dataset.act, b.dataset.id), 250); });
      }

      // ------------------------------------------------------------------ LAS ACCIONES: un toque si baja el gasto, DOS si lo gasta
      const cuerpoDe = g => ({ tipo: g.tipo, id: g.id, valor: g.valor === '' || g.valor == null ? undefined : importe(g.valor), fin: g.fin || undefined, inicio: g.inicio || undefined, sugerencia: g.sug || undefined });
      function accionar(tipo, id, sug = null) {
        const f = S.d && buscar(S.d.campanas || [], id); if (!f) { ctx.toast('Eso ya no está en la cuenta.'); return; }
        const p = presupuestoDe(f), g = { tipo, id, f, valor: '', fin: '', inicio: '', sug };
        if (tipo === 'subir_presupuesto' && p) g.valor = String(Math.round(p.usd * 1.2 * 100) / 100);
        if (tipo === 'bajar_presupuesto' && p) g.valor = String(Math.max(1, Math.round(p.usd * 0.8 * 100) / 100));
        if (pideDatos(tipo)) return dialogo(g, 'form');
        if (GASTO.has(tipo)) return dialogo(g, 'pidiendo');
        if (tipo === 'archivar') return dialogo(g, 'archivar');
        return dialogo(g, 'directo');
      }
      function dialogo(g, fase0, previo = null) {
        const m = moneda(), nombre = g.f?.nodo?.nombre || '';
        const h = ctx.hoja({ titulo: TEXTO[g.tipo] || 'Aplicar', cuerpo: '', clase: 'md-hoja-acc' });
        const pon = (titulo, html) => { h.titulo(titulo); h.cuerpo.innerHTML = html; h.cuerpo.querySelector('input,button')?.focus?.({ preventScroll: true }); };
        const obj = nombre ? `<p class="mv-meta">«${esc(nombre)}»</p>` : '';
        const botones = (...b) => `<div class="md-acciones col">${b.join('')}</div>`;
        const cancelar = '<button type="button" class="mv-btn" data-d="cancelar">Cancelar</button>';
        const error = (r, titulo) => pon(titulo || (r.error === 'tope' ? 'No cabe en tus topes' : r.error === 'meta' ? 'Meta no lo aceptó' : r.error === 'confirmacion' ? 'Venció: vuelve a pedirlo' : r.status === 403 ? 'Esto no se puede desde aquí' : 'No se pudo'), `${obj}<p class="md-aviso rojo" role="alert">${esc(r.motivo || r.mensaje || 'La oficina no contestó.')}</p>${r.error === 'tope' ? `<dl class="md-cif g">${r.tope != null ? `<div><dt>Tu tope</dt><dd>${esc(dinero(r.tope, m))}</dd></div>` : ''}${r.quedaria != null ? `<div><dt>Quedaría en</dt><dd>${esc(dinero(r.quedaria, m))}</dd></div>` : ''}</dl><p class="mv-meta">No hay atajo: si quieres gastar más, sube el tope en Ajustes → Anuncios.</p>` : ''}<p class="mv-meta">No cambió nada.</p>${botones(r.error === 'meta' && Number(r.minimo) > 0 ? `<button type="button" class="mv-btn primario" data-d="minimo" data-minimo="${esc(r.minimo)}">Poner el mínimo (${esc(dinero(r.minimo, m))})</button>` : '', r.error === 'confirmacion' ? '<button type="button" class="mv-btn primario" data-d="otra">Pedirlo otra vez</button>' : '', '<button type="button" class="mv-btn" data-d="cancelar">Cerrar</button>')}`);
        const listo = r => {
          h.cerrar(); const tok = r.deshacer?.token, hasta = r.deshacer?.hasta ? Date.parse(r.deshacer.hasta) : NaN;
          ctx.toast(r.hecho?.texto || 'Hecho.' + (r.aviso ? ' ' + r.aviso : ''), tok && (Number.isNaN(hasta) || hasta > Date.now()) ? { accion: 'Deshacer', ms: 9000, alAccion: async () => { const x = await G.datos.deshacer(tok, opc()); ctx.toast(x.ok ? (x.hecho?.texto || 'Deshecho.') : 'No se pudo deshacer: ' + (x.motivo || 'la oficina no contestó')); cargar({ silencioso: true }); } } : { ms: 6500 });
          cargar({ silencioso: true });
        };
        async function primer() {
          pon(TEXTO[g.tipo], `${obj}<p class="md-aviso info" role="status">Preguntando a la oficina cuánto puede gastar esto…</p>`);
          const r = await G.datos.accion(cuerpoDe(g), opc());
          if (r.confirmar) return confirmar(r.confirmar, r.aviso || '');
          if (r.ok) return listo(r);
          error(r);
        }
        function confirmar(c, aviso) {
          const v = c.vence ? (typeof c.vence === 'number' ? c.vence : Date.parse(c.vence)) : NaN, tiempo = () => (Number.isNaN(v) ? null : Math.max(0, Math.round((v - Date.now()) / 1000)));
          const L = [['dia', 'Al día'], ['semana', 'Esta semana'], ['mes', 'Hasta fin de mes'], ['campana', 'En toda la campaña']].filter(([k]) => c.cifras?.[k] != null);
          const rev = g.f && /PENDING_REVIEW|IN_PROCESS/.test(String(g.f.nodo.estado || '').toUpperCase()) ? '<p class="mv-meta">Está en revisión: se activa igual y empieza a salir cuando Meta lo apruebe.</p>' : '';
          const cuentaL = c.cuenta || g.f?.nodo?.cuentaTexto || '';
          pon(`¿${TEXTO[g.tipo] || 'Aplicar'}? Esto gasta`, `${obj}${cuentaL ? `<p class="mv-meta" data-cuenta-confirmar>En: <b>${esc(cuentaL)}</b></p>` : ''}<p class="mv-texto"><b>${esc(c.texto || '')}</b></p>${L.length ? `<dl class="md-cif g">${L.map(([k, t]) => `<div><dt>${t}</dt><dd>hasta ${esc(dinero(c.cifras[k], m))}</dd></div>`).join('')}</dl>` : ''}${aviso ? `<p class="md-aviso" role="note"><b>Antes de decir que sí:</b> ${esc(aviso)}</p>` : ''}${rev}
            ${botones(`<button type="button" class="mv-btn primario si" data-d="si">${esc(botonSi(g.tipo, c, m))}</button>`, cancelar)}<p class="mv-meta" data-vence>${tiempo() == null ? '' : `Esta confirmación vale ${Math.floor(tiempo() / 60)} min ${String(tiempo() % 60).padStart(2, '0')} s; luego hay que volver a pedirla.`}</p>`);
          h._conf = c;
          clearInterval(h._t); h._t = setInterval(() => { const q = tiempo(); const n = h.cuerpo.querySelector('[data-vence]'); if (!n || !h.cuerpo.isConnected) return clearInterval(h._t); if (q != null && q <= 0) { clearInterval(h._t); const si = h.cuerpo.querySelector('[data-d="si"]'); if (si) si.outerHTML = '<button type="button" class="mv-btn primario" data-d="otra">Venció: pedirlo otra vez</button>'; n.textContent = ''; } else if (q != null) n.textContent = `Esta confirmación vale ${Math.floor(q / 60)} min ${String(q % 60).padStart(2, '0')} s; luego hay que volver a pedirla.`; }, 1000);
        }
        function form(err = '') {
          const p = presupuestoDe(g.f); let campos = '';
          if (g.tipo === 'subir_presupuesto' || g.tipo === 'bajar_presupuesto') campos = `<p class="mv-meta">Ahora: <b>${esc(p ? presupuesto(p, m) : 'sin presupuesto propio')}</b></p><label class="mv-lab" for="mdVal">Nuevo presupuesto ${p?.tipo === 'total' ? 'total' : 'diario'}, en ${esc(m)}</label><input id="mdVal" type="text" inputmode="decimal" data-f="valor" value="${esc(g.valor)}" autocomplete="off"><p class="md-aviso" data-aprende ${reiniciaAprendizaje(g.f, p?.usd, importe(g.valor)) ? '' : 'hidden'}>${esc(AVISO_APRENDIZAJE)}</p>`;
          else if (g.tipo === 'alargar') campos = `<p class="mv-meta">Termina ahora: <b>${esc(fechaCorta(g.f.nodo.fin, 'sin fin'))}</b></p><label class="mv-lab" for="mdFin">Nueva fecha de fin</label><input id="mdFin" type="date" data-f="fin" value="${esc(g.fin)}" min="${new Date().toISOString().slice(0, 10)}">`;
          else if (g.tipo === 'relanzar') campos = `<p class="mv-meta">Se duplica <b>EN PAUSA</b> con fechas nuevas. No gasta hasta que tú la actives.</p><label class="mv-lab" for="mdIni">Empieza</label><input id="mdIni" type="date" data-f="inicio" value="${esc(g.inicio || new Date().toISOString().slice(0, 10))}"><label class="mv-lab" for="mdFin2">Termina (opcional)</label><input id="mdFin2" type="date" data-f="fin" value="${esc(g.fin)}">`;
          pon(TEXTO[g.tipo], `${obj}${campos}<p class="md-aviso rojo" role="alert" data-err ${err ? '' : 'hidden'}>${esc(err)}</p>${botones(`<button type="button" class="mv-btn primario" data-d="enviar">${LIBRES.has(g.tipo) ? esc(TEXTO[g.tipo]) : 'Ver lo que gasta'}</button>`, cancelar)}<p class="mv-meta">${LIBRES.has(g.tipo) ? 'Baja el gasto: se hace con este toque.' : 'Todavía no cambia nada: el siguiente paso te dice la cifra y te pide el «Sí».'}</p>`);
        }
        h.cuerpo.addEventListener('input', e => { const t = e.target; if (!t.dataset.f) return; g[t.dataset.f] = t.value; if (t.dataset.f === 'valor') { const p = presupuestoDe(g.f), a = h.cuerpo.querySelector('[data-aprende]'); if (a) a.hidden = !reiniciaAprendizaje(g.f, p?.usd, importe(t.value)); } });
        h.cuerpo.addEventListener('click', async e => {
          const b = e.target.closest('[data-d]'); if (!b) return; const k = b.dataset.d;
          if (k === 'cancelar') return h.cerrar();
          if (k === 'minimo') { g.valor = String(b.dataset.minimo); return form(); }
          if (k === 'otra') return primer();
          if (k === 'enviar') {
            if (g.tipo === 'subir_presupuesto' || g.tipo === 'bajar_presupuesto') { const er = errorImporte(g.tipo, g.valor, presupuestoDe(g.f)?.usd); if (er) { const n = h.cuerpo.querySelector('[data-err]'); n.textContent = er; n.hidden = false; return; } }
            if (g.tipo === 'alargar' && !g.fin) { const n = h.cuerpo.querySelector('[data-err]'); n.textContent = 'Elige la nueva fecha de fin.'; n.hidden = false; return; }
            return GASTO.has(g.tipo) ? primer() : directo(b);
          }
          if (k === 'archivar') return directo(b);
          if (k === 'si') {
            const c = h._conf; if (!c) return; clearInterval(h._t); let x = null;
            const r = await con(b, async () => { x = await G.datos.accion({ ...cuerpoDe(g), confirmacion: c.token }, opc()); if (!x.ok) throw new Error(x.motivo || 'No se pudo'); return x; }, { hecho: 'Hecho', ocupado: 'Aplicando…' });
            if (r.ok) listo(x); else error(x || { motivo: r.error });
          }
        });
        async function directo(b) { const r = await G.datos.accion(cuerpoDe(g), opc()); if (r.ok) return listo(r); error(r); }
        if (fase0 === 'form') form(); else if (fase0 === 'pidiendo') primer(); else if (fase0 === 'confirmar') confirmar(previo.confirmar, previo.aviso || ''); else if (fase0 === 'archivar') pon('Archivar', `${obj}<p class="mv-texto">Se archiva: no se borra y deja de gastar. No se puede deshacer desde aquí.</p>${botones('<button type="button" class="mv-btn peligro" data-d="archivar">Archivar</button>', cancelar)}`); else directo();
        return h;
      }

      // ------------------------------------------------------------------ sugerencias: aplicar / descartar / posponer
      async function aplicarSug(id, b) {
        const s = (S.sug?.items || []).find(x => x.id === id); if (!s) return; const c = s.cambio || {};
        if (c.tipo === 'revisar') { const f = S.d && buscar(S.d.campanas || [], c.id || s.objeto?.id); if (f) return detalle(f.id); ctx.toast('Eso ya no está en la cuenta.'); return; }
        const r = await con(b, () => G.datos.aplicarSugerencia(id, opc()), { hecho: 'Hecho', ocupado: 'Aplicando…' });
        if (!r.ok) return; const v = r.valor;
        if (v.confirmar) { // gasta: el mismo segundo toque, con la cifra; el «Sí» va por /api/anuncios/accion con `sugerencia`
          const f = S.d && c.id ? buscar(S.d.campanas || [], c.id) : null, g = { tipo: c.tipo, id: c.id, f, valor: c.valor ?? '', fin: c.fin || '', inicio: c.inicio || '', sug: s.id };
          return dialogo(g, 'confirmar', v);
        }
        if (v.status && v.status >= 400 || v.ok === false) { ctx.toast(v.motivo || 'No se pudo.'); return; }
        if (v.borrador) { await cargarBor(); S.tab = 'borradores'; pintar(); ctx.navegar('anuncios-asistente', { id: v.borrador.id, paso: 3 }); return; }
        ctx.toast(v.hecho?.texto || (v.tarea ? 'Le pedí a tu agente de anuncios las variaciones.' : 'Hecho.'), v.deshacer?.token ? { accion: 'Deshacer', ms: 9000, alAccion: async () => { const x = await G.datos.deshacer(v.deshacer.token, opc()); ctx.toast(x.ok ? 'Deshecho.' : 'No se pudo deshacer.'); cargar({ silencioso: true }); } } : {});
        cargar({ silencioso: true });
      }
      // ------------------------------------------------------------------ informe del mes
      function informe() {
        const mes = new Date().toISOString().slice(0, 7);
        const h = ctx.hoja({ titulo: 'Informe del mes', lleno: true, cuerpo: esqueleto(3), acciones: G.ejemplo ? [] : [{ texto: 'Guardar en el Cerebro', alTocar: async (x, b) => { const r = await con(b, () => G.datos.guardarInforme(mes, opc()).then(y => { if (y.status >= 400) throw new Error(y.motivo || 'No se pudo'); return y; }), { hecho: 'Guardado' }); if (r.ok) ctx.toast('Guardado en el Cerebro (Informes).'); } }] });
        G.datos.informe(mes, opc()).then(r => { h.cuerpo.innerHTML = r.status >= 400 ? `<p class="md-aviso rojo">${esc(r.motivo || 'No se pudo.')}</p>` : `<h3 class="md-q">${esc(r.titulo || 'Informe')}</h3><pre class="md-informe">${esc(r.texto || '')}</pre>`; });
      }

      // ------------------------------------------------------------------ eventos
      async function irTab(t) { S.tab = t; sc.scrollTop = 0; if (t === 'historial' && S.hist == null) cargarHist(); if (t === 'borradores') cargarBor(); if (t === 'sugerencias' || t === 'creativos') cargarSug(); pintar(); }
      el.querySelector('.md-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) irTab(b.dataset.tab); });
      cuerpo.addEventListener('change', e => { if (e.target.matches('[data-cuenta]')) { S.cuenta = e.target.value; pintar(); } });
      cuerpo.addEventListener('click', async e => {
        const t = e.target.closest('button'); if (!t) return; const dt = t.dataset;
        if (t.matches('[data-reintentar]')) return cargar();
        if (dt.tabIr) return irTab(dt.tabIr);
        if (dt.rango) { S.rango = dt.rango; await cargar({ silencioso: true }); return; }
        if (dt.verCuenta) { S.cuenta = dt.verCuenta; S.filtro = 'todas'; return irTab('campanas'); }
        if (dt.filtro) { S.filtro = dt.filtro; return pintar(); }
        if (dt.fsug) { S.fsug = dt.fsug; return pintar(); }
        if (dt.quien) { S.quien = dt.quien; return pintar(); }
        if (dt.tog) { S.abiertos.has(dt.tog) ? S.abiertos.delete(dt.tog) : S.abiertos.add(dt.tog); return pintar(); }
        if (dt.det) return detalle(dt.det);
        if (dt.act) return accionar(dt.act, dt.id);
        if (dt.mas) { const f = buscar(S.d.campanas || [], dt.mas); if (f) detalle(f.id); return; }
        if (t.hasAttribute('data-ejemplo')) { G.ejemplo = true; S.cargado = false; return cargar(); }
        if (t.hasAttribute('data-salir-ej')) { G.ejemplo = false; S.cargado = false; S.sug = null; S.bor = null; S.hist = null; return cargar(); }
        if (t.hasAttribute('data-actualizar')) { const r = await con(t, async () => G.datos.sincronizar(opc()), { hecho: 'Leyendo Meta…' }); if (r.ok) { S.leyendo = r.valor === 'leyendo' || r.valor === 'ya'; ctx.toast(r.valor === 'ejemplo' ? 'En el ejemplo no hay nada que leer de Meta.' : 'Leyendo Meta: tarda un par de minutos.'); setTimeout(() => cargar({ silencioso: true }), 5000); } return; }
        if (t.hasAttribute('data-informe')) return informe();
        if (t.hasAttribute('data-nueva')) { const r = await con(t, () => G.datos.nuevoBorrador({}, opc()).then(x => { if (x.status !== 200 || !x.borrador) throw new Error(x.motivo || 'No se pudo empezar'); return x; }), { hecho: 'Listo' }); if (r.ok) { cargarBor(); ctx.navegar('anuncios-asistente', { id: r.valor.borrador.id, paso: 0 }); } return; }
        if (dt.bor) return ctx.navegar('anuncios-asistente', { id: dt.bor, paso: 0 });
        if (dt.borBorrar) { if (!(await ctx.confirmar({ titulo: '¿Borrar este borrador?', texto: 'Va a la papelera de la oficina; en Meta no cambia nada.', ok: 'Borrar', peligro: true }))) return; const r = await G.datos.borrarBorrador(dt.borBorrar, opc()); ctx.toast(r.status === 200 ? 'Borrador borrado.' : (r.motivo || 'No se pudo.')); cargarBor(); return; }
        if (dt.verCamp) { S.abiertos.add(dt.verCamp); S.filtro = 'todas'; return irTab('campanas'); }
        if (dt.verSug) { S.fsug = 'viva'; return irTab('sugerencias'); }
        if (dt.aplicar) return aplicarSug(dt.aplicar, t);
        if (dt.descartar || dt.posponer) { const id = dt.descartar || dt.posponer; const r = await con(t, () => (dt.descartar ? G.datos.descartarSugerencia(id, opc()) : G.datos.posponerSugerencia(id, 3, opc())).then(x => { if (!x.ok) throw new Error(x.motivo || 'No se pudo'); return x; }), { hecho: 'Hecho' }); if (r.ok) { ctx.toast(dt.descartar ? 'Descartada: no vuelve en 7 días.' : 'Te la recuerdo en 3 días.'); cargarSug(); } return; }
        if (dt.crNueva != null) { const g = S._creativos?.[+dt.crNueva]; if (!g) return; const r = await con(t, () => G.datos.nuevoBorrador(borradorDeCreativo(g), opc()).then(x => { if (x.status !== 200 || !x.borrador) throw new Error(x.motivo || 'No se pudo'); return x; }), { hecho: 'Borrador listo' }); if (r.ok) { cargarBor(); ctx.navegar('anuncios-asistente', { id: r.valor.borrador.id, paso: 3 }); } }
      });
      ctx.tirar(sc, () => cargar({ silencioso: true }));
      el._cargar = cargar; el._irTab = irTab; el._S = S;
      cargar();
    },
    alMostrar(el, ctx, p) { ctx.cabecera({ titulo: 'Anuncios', acciones: [] }); el._cargar?.({ silencioso: true }); if (p?.tab) el._irTab?.(p.tab); if (p?.borrador) setTimeout(() => ctx.navegar('anuncios-asistente', { id: p.borrador, paso: p.paso ?? 3 }), 0); },
  });

  // ===================================================================================================================== el asistente de 5 pasos
  shell.registrarVista({
    id: 'anuncios-asistente', titulo: 'Nueva campaña', icono: 'anuncios', grupo: 'oculta',
    montar(el, ctx) {
      const A = { b: null, paso: 0, items: null, pend: new Set(), timer: 0, guardando: null, guardado: '', validando: false, mejora: null, metaPrev: null, sondeo: 0, creandoDesde: 0, subiendo: false, galeria: null };
      el.innerHTML = `<ol class="md-pasos" aria-label="Pasos de la campaña"></ol><div class="mv-scroll" data-sc><div class="mv-cuerpo md-paso" aria-live="polite"></div></div>
        <div class="md-pie"><button type="button" class="mv-btn" data-nav="-1">Atrás</button><span class="md-pie-n" aria-hidden="true"></span><button type="button" class="mv-btn primario" data-nav="1">Siguiente</button></div>`;
      const pasos = el.querySelector('.md-pasos'), cuerpo = el.querySelector('.md-paso'), sc = el.querySelector('[data-sc]'), pie = el.querySelector('.md-pie');
      const moneda = () => 'USD';
      const probs = () => A.b?.validacion?.problemas || [];
      const norm = c => String(c || '').replace(/\[(\d+)\]/g, '.$1');
      const err = campo => { const p = probs().find(x => norm(x.campo) === campo || norm(x.campo).startsWith(campo + '.')); return p ? `<p class="md-aviso rojo" role="alert">${esc(p.texto)}</p>` : ''; };
      const pasoProbs = () => PASOS.map((_, i) => probs().filter(p => pasoDe(p.campo).paso === i).length);

      async function abrir(id, paso = 0) {
        A.b = null; A.paso = paso; A.mejora = null; A.metaPrev = null; A.guardado = ''; A.pend.clear(); clearTimeout(A.sondeo); pintar();
        const r = await G.datos.borradores(opc()); A.items = r.items || [];
        const b = A.items.find(x => x.id === id); if (!b) { ctx.toast('Ese borrador ya no está.'); ctx.volver(); return; }
        A.b = structuredClone(b); if (b.estado === 'creando') { A.creandoDesde = Date.parse(b.actualizadoAt) || Date.now(); sondear(b.id); }
        if (paso === 4 || (paso === 2 && !b.validacion)) validar(true);
        pintar();
      }
      // ---- guardar solo a los 500 ms (PATCH) ----
      function programar(raiz) { A.pend.add(raiz); A.guardado = 'Sin guardar…'; marca(); clearTimeout(A.timer); A.timer = setTimeout(guardar, 500); }
      const marca = () => { const n = el.querySelector('[data-guardado]'); if (n) n.textContent = A.guardado; };
      async function guardar() {
        clearTimeout(A.timer); if (!A.b || !A.pend.size) return;
        if (A.guardando) { await A.guardando; return guardar(); }
        const id = A.b.id, claves = [...A.pend]; A.pend.clear();
        A.guardando = G.datos.guardarBorrador(id, Object.fromEntries(claves.map(k => [k, A.b[k] === undefined ? null : A.b[k]])), opc());
        A.guardado = 'Guardando…'; marca(); const r = await A.guardando; A.guardando = null;
        if (!A.b || A.b.id !== id) return;
        if (r.status === 200 && r.borrador) { const local = Object.fromEntries([...A.pend].map(k => [k, A.b[k]])); A.b = { ...r.borrador, ...local }; A.guardado = 'Guardado ✓'; marca(); }
        else { for (const k of claves) A.pend.add(k); A.guardado = 'No se guardó'; marca(); ctx.toast('No se guardó: ' + (r.motivo || 'la oficina no contestó')); if (r.status !== 409) { clearTimeout(A.timer); A.timer = setTimeout(guardar, 5000); } }
      }
      const guardarYa = async () => { clearTimeout(A.timer); if (A.guardando) await A.guardando; if (A.pend.size) await guardar(); };
      function cambiar(ruta, v, repintar = false) {
        if (!A.b || !editable(A.b)) return; const r = poner(A.b, ruta, v); A.b = r.b;
        if (ruta === 'objetivo' || ruta === 'destino') { if (ruta === 'objetivo' && v === 'mensajes' && !A.b.destino) A.b.destino = 'whatsapp'; if (ruta === 'objetivo' && v !== 'mensajes') A.b.destino = null; A.b = ajustarLlamadas(A.b); A.pend.add('destino'); A.pend.add('creativos'); }
        if (ruta === 'categoriaEspecial' && v) { A.b.publico = { ...A.b.publico, edadMin: 18, edadMax: null, intereses: [] }; A.pend.add('publico'); }
        if (A.b.validacion) A.b.validacion = { ...A.b.validacion, problemas: (A.b.validacion.problemas || []).filter(p => !norm(p.campo).startsWith(ruta)) };
        programar(r.raiz); if (repintar) pintar();
      }
      async function validar(callado = false) {
        if (!A.b) return; await guardarYa(); const id = A.b.id; A.validando = true; if (A.paso === 4) pintar();
        const r = await G.datos.validarBorrador(id, opc()); A.validando = false; if (!A.b || A.b.id !== id) return;
        if (r.status === 200 && r.borrador) A.b = { ...A.b, validacion: r.borrador.validacion, estado: r.borrador.estado, error: r.borrador.error }; else if (!callado) ctx.toast('No se pudo revisar: ' + (r.motivo || 'la oficina no contestó'));
        pintar();
      }

      // ---- los cinco pasos ----
      const campo = (ruta, label, v, { tipo = 'text', ayuda = '', attrs = '', area = false, max = 0 } = {}) => `<label class="mv-lab" for="mdb-${ruta.replace(/\W+/g, '-')}">${esc(label)}</label>${area ? `<textarea id="mdb-${ruta.replace(/\W+/g, '-')}" data-b="${esc(ruta)}" rows="4"${attrs}>${esc(v ?? '')}</textarea>` : `<input id="mdb-${ruta.replace(/\W+/g, '-')}" type="${tipo}" data-b="${esc(ruta)}" value="${esc(v ?? '')}"${attrs}>`}${max ? `<p class="mv-meta" data-cnt="${esc(ruta)}">${[...String(v || '')].length} de ${max} letras${[...String(v || '')].length > max ? ': Meta enseña solo lo primero y pone «Ver más»' : ''}</p>` : ''}${ayuda ? `<p class="mv-meta">${esc(ayuda)}</p>` : ''}${err(ruta)}`;
      const opciones = (ruta, lista, valor, leyenda) => `<fieldset class="md-opc"><legend>${esc(leyenda)}</legend>${lista.map(o => `<button type="button" class="md-op${String(valor ?? '') === o.k ? ' on' : ''}" data-op="${esc(ruta)}|${esc(o.k)}" aria-pressed="${String(valor ?? '') === o.k}"><b>${esc(o.n)}</b>${o.d ? `<small>${esc(o.d)}</small>` : ''}</button>`).join('')}</fieldset>`;
      function p1(b) { const o = objetivoDe(b.objetivo); return `${opciones('objetivo', OBJETIVOS, b.objetivo, '¿Qué quieres conseguir?')}${err('objetivo')}${o?.k === 'mensajes' ? opciones('destino', DESTINOS.map(d => ({ ...d, d: '' })), b.destino, '¿Por dónde te escriben?') : ''}${o?.enlace || b.objetivo === 'conocer' ? campo('enlace', o?.enlace ? 'La dirección de tu web' : 'Tu web (opcional)', b.enlace, { tipo: 'url', attrs: ' inputmode="url" placeholder="https://" autocomplete="url"', ayuda: 'Empieza por https://. A ella llevan los anuncios.' }) : ''}`; }
      function p2(b) {
        const p = b.publico || {}, manual = p.modo === 'manual', radio = !!p.radio;
        return `<div class="md-card"><b>${manual ? 'Público manual' : 'Advantage+: Meta busca a quién mostrarlo'}</b><p class="mv-meta">${manual ? 'Tú eliges los intereses. Suele salir más caro: úsalo si sabes muy bien a quién le hablas.' : 'Lo que Meta recomienda hoy: tú dices dónde y la edad mínima. Suele salir más barato.'}</p><button type="button" class="mv-btn" data-modo="${manual ? 'advantage' : 'manual'}">${manual ? 'Volver a Advantage+ (recomendado)' : 'Prefiero un público manual'}</button></div>
          ${opciones('publico.lugar', [{ k: 'pais', n: 'Todo un país' }, { k: 'radio', n: 'Alrededor de mi local', d: 'Un radio en km desde un punto.' }], radio ? 'radio' : 'pais', '¿Dónde?')}
          ${radio ? `${campo('publico.radio.lat', 'Latitud', p.radio.lat, { tipo: 'text', attrs: ' inputmode="decimal"' })}${campo('publico.radio.lng', 'Longitud', p.radio.lng, { tipo: 'text', attrs: ' inputmode="decimal"' })}${campo('publico.radio.km', 'Radio en km', p.radio.km, { tipo: 'text', attrs: ' inputmode="numeric"' })}` : `<label class="mv-lab" for="mdb-pais">País</label><select id="mdb-pais" data-pais>${PAISES.map(([k, n]) => `<option value="${k}"${(p.paises || [])[0] === k ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>${err('publico.paises')}`}
          ${campo('publico.edadMin', 'Edad mínima', p.edadMin, { attrs: ' inputmode="numeric"' })}${campo('publico.edadMax', 'Edad máxima (vacía = 65 o más)', p.edadMax, { attrs: ' inputmode="numeric"' })}
          ${manual ? campo('publico.intereses', 'Intereses (separados por comas)', (p.intereses || []).join(', '), { ayuda: 'Por ejemplo: moda, gafas de sol. Meta los busca en su lista.' }) : ''}
          ${opciones('categoriaEspecial', CATEGORIAS, b.categoriaEspecial || '', '¿Tu anuncio es de alguna categoría especial?')}`;
      }
      function p3(b) {
        const pr = b.presupuesto || {}, aviso = avisoSinFin(b), c = b.validacion?.costoMax;
        return `${opciones('presupuesto.tipo', [{ k: 'diario', n: 'Al día', d: 'Lo mismo cada día; Meta reparte dentro del día.' }, { k: 'total', n: 'En total', d: 'Una cifra para toda la campaña; necesita fecha de fin.' }], pr.tipo, '¿Cómo quieres el presupuesto?')}
          ${campo('presupuesto.usd', pr.tipo === 'total' ? 'Presupuesto total (USD)' : 'Presupuesto al día (USD)', pr.usd, { attrs: ' inputmode="decimal"' })}${campo('inicio', 'Empieza', b.inicio, { tipo: 'date' })}${campo('fin', 'Termina', b.fin, { tipo: 'date' })}${b.fin ? '<button type="button" class="mv-btn" data-sinfin>Sin fecha de fin</button>' : ''}
          <p class="md-cuando" aria-live="polite"><b>${c ? 'Costo máximo: ' + esc(costoTexto(c, moneda())) : 'El costo máximo sale al revisar el presupuesto.'}</b></p>${aviso ? `<p class="md-aviso" role="note"><b>Ojo:</b> ${esc(aviso)}</p>` : ''}
          <p class="mv-meta">La oficina pone además el tope de la campaña en Meta: así no gasta más aunque la oficina esté cerrada.</p>`;
      }
      function p4(b) {
        if (b.origen) { const o = b.origen, c = (b.creativos || [])[0] || {}, ll = llamadasDe(b.objetivo, b.destino), red = RED_ORIGEN[o.red] || o.red; return `<div class="md-card"><h3 class="md-q">La publicación que impulsas</h3><p class="mv-meta">El anuncio es esta publicación tal como salió en ${esc(red)}. Aquí solo eliges el botón.</p>${err('origen')}<div class="md-pub-r">${miniatura(o.miniatura, { externa: true, clase: 'md-mini grande' })}<span class="md-pz-c"><b>${esc(red)}</b><small>${esc((o.texto || 'Sin texto: sale la imagen o el video solos.').slice(0, 200))}</small>${o.enlace ? `<a class="mv-link" href="${esc(o.enlace)}" target="_blank" rel="noopener noreferrer">Ver la original</a>` : ''}</span></div></div><label class="mv-lab" for="mdb-ll0">Botón del anuncio</label><select id="mdb-ll0" data-b="creativos.0.llamada">${ll.map(k => `<option value="${k}"${(c.llamada || ll[0]) === k ? ' selected' : ''}>${esc(LLAMADA[k])}</option>`).join('')}</select>`; }
        const cr = b.creativos || [], ll = llamadasDe(b.objetivo, b.destino);
        return `${err('creativos')}<p class="mv-meta">${cr.length} de ${MAX_CREATIVOS} creativos${cr.length < MIN_RECOMENDADO ? ` (conviene tener al menos ${MIN_RECOMENDADO} para que Meta compare)` : ''}.</p>
          <ul class="md-lista md-cards">${cr.map((c, i) => { const m = A.mejora && A.mejora.cr === c.id ? A.mejora : null; return `<li class="md-card" data-cr="${i}"><div class="md-pub-r">${miniatura(c.media, { clase: 'md-mini grande' })}<span class="md-pz-c"><b>Creativo ${i + 1}</b>${c.formato ? `<small>${esc(c.formato)}</small>` : ''}</span><button type="button" class="mv-ic" data-quitar-cr="${i}" aria-label="Quitar el creativo ${i + 1}">${svg('cerrar')}</button></div>
            ${campo(`creativos.${i}.texto`, 'Texto principal', c.texto, { area: true, max: LARGO.texto })}${m?.estado === 'lista' && m.campo === 'texto' ? `<div class="md-aviso info"><b>${esc(m.agente || 'Tu agente')} propone:</b> ${esc(m.texto)}<div class="md-sal-b"><button type="button" class="mv-btn primario" data-usar-mej="${i}">Usar</button><button type="button" class="mv-btn" data-quitar-mej>Dejar el mío</button></div></div>` : `<button type="button" class="mv-btn md-ancho" data-mejorar="${i}|texto">${m?.estado === 'pidiendo' ? 'Pidiéndolo…' : '✨ Mejorar con el agente de anuncios'}</button>`}
            ${campo(`creativos.${i}.titular`, 'Titular', c.titular, { max: LARGO.titular })}
            <label class="mv-lab" for="mdb-ll${i}">Botón</label><select id="mdb-ll${i}" data-b="creativos.${i}.llamada">${ll.map(k => `<option value="${k}"${c.llamada === k ? ' selected' : ''}>${esc(LLAMADA[k])}</option>`).join('')}</select>${err(`creativos.${i}`)}</li>`; }).join('')}</ul>
          ${cr.length < MAX_CREATIVOS ? `<div class="md-acciones"><button type="button" class="mv-btn" data-gal>De la galería del Estudio</button><button type="button" class="mv-btn" data-subir-cr>Del teléfono</button></div><input type="file" data-file accept="image/*,video/*" hidden>${A.subiendo ? '<p class="md-aviso info" role="status">Subiendo…</p>' : ''}` : ''}`;
      }
      function p5(b) {
        const v = b.validacion, pr = probs(), e = b.estado, cr = b.creativos || [], o = b.origen;
        let estado;
        if (e === 'creado') estado = `<div class="md-aviso info" role="status"><b>Creado en pausa.</b> Actívalo desde Campañas cuando quieras (te pedirá los dos toques, con la cifra).${b.meta?.campana ? `<div class="md-sal-b"><button type="button" class="mv-btn primario" data-ver-camp="${esc(b.meta.campana)}">Ver en Campañas</button></div>` : ''}</div>`;
        else if (e === 'creando') estado = `<div class="md-aviso" role="status"><b>Creando en Meta…</b> Se suben las imágenes y se crean la campaña, el conjunto y los anuncios, todo EN PAUSA${A.creandoDesde ? ` (lleva ${Math.max(1, Math.round((Date.now() - A.creandoDesde) / 1000))} s)` : ''}. No gasta nada.</div>`;
        else if (A.validando && !v) estado = '<p class="md-aviso info" role="status">Revisando con Meta…</p>';
        else if (!v) estado = '<p class="md-aviso">Todavía no se ha revisado: pulsa «Revisar».</p>';
        else if (!pr.length) estado = '<div class="md-semaforo ver" role="status"><span class="md-luz" aria-hidden="true"></span><b>Todo en orden: la oficina y Meta lo aceptan.</b></div>';
        else estado = `<div class="md-semaforo rojo" role="alert"><span class="md-luz" aria-hidden="true"></span><b>${pr.length} ${pr.length === 1 ? 'cosa por arreglar' : 'cosas por arreglar'}</b></div><ul class="md-prob">${pr.map((p, i) => `<li class="mal"><span>${esc(p.texto)}</span><button type="button" class="mv-link" data-ir-paso="${pasoDe(p.campo).paso}">Arreglar</button></li>`).join('')}</ul>`;
        const previas = (o ? [{ ...cr[0], media: null, _o: o }] : cr).map((c, i) => `<article class="md-prev"><header><span class="md-ava"><i>${esc((A.pagina || 'T').slice(0, 1))}</i></span><span><b>${esc(A.pagina || 'Tu página')}</b><small>Publicidad</small></span></header>${c._o ? miniatura(c._o.miniatura, { externa: true, clase: 'md-prev-m c' }) : `<div class="md-prev-m c">${miniatura(c.media, { clase: 'md-mini fill' })}</div>`}<p class="md-prev-t">${esc((c._o ? c._o.texto : c.texto) || '')}</p>${c.titular ? `<p class="md-prev-ti">${esc(c.titular)}</p>` : ''}${c.llamada && c.llamada !== 'NO_BUTTON' ? `<p class="md-prev-cta">${esc(LLAMADA[c.llamada] || '')}</p>` : ''}</article>`).join('');
        const puede = editable(b);
        return `${e === 'fallo' && b.error ? `<p class="md-aviso rojo" role="alert">No se pudo crear: ${esc(b.error)}</p>` : ''}${estado}
          ${v?.costoMax ? `<p class="md-cuando"><b>Costo máximo: ${esc(costoTexto(v.costoMax, moneda()))}</b></p>` : ''}
          ${puede ? `<button type="button" class="mv-btn md-ancho" data-validar>${A.validando ? 'Revisando…' : 'Revisar otra vez'}</button>` : ''}
          ${puede ? `<button type="button" class="mv-btn primario md-ancho si" data-crear${!v || pr.length || A.validando ? ' aria-disabled="true"' : ''}>${e === 'fallo' ? 'Reintentar: crear en Meta (en pausa)' : 'Crear en Meta (en pausa)'}</button><p class="mv-meta">${!v ? 'Primero se revisa.' : pr.length ? 'Arregla lo de arriba y se puede crear.' : 'Se crea EN PAUSA: no gasta nada. Activarla después te pide dos toques con la cifra.'}</p>` : ''}
          <h3 class="mv-gh">Cómo se verá</h3>${previas || '<p class="mv-nada">Sin creativos todavía.</p>'}
          ${o ? '' : `<label class="mv-lab" for="mdb-ub">La vista previa de Meta</label><select id="mdb-ub" data-ub>${UBICACIONES_META.map(([k, n]) => `<option value="${k}"${A.metaPrev?.formato === k ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select><button type="button" class="mv-btn md-ancho" data-metaver>${A.metaPrev?.estado === 'pidiendo' ? 'Pidiéndola…' : 'Ver la vista previa de Meta'}</button>${A.metaPrev?.estado === 'lista' ? `<iframe class="md-metaif" title="Vista previa de Meta del anuncio" src="${esc(A.metaPrev.url)}" sandbox="allow-scripts allow-same-origin allow-popups" referrerpolicy="no-referrer" loading="lazy"></iframe>` : A.metaPrev?.estado === 'error' ? `<p class="md-aviso rojo">${esc(A.metaPrev.motivo)}</p>` : ''}`}`;
      }
      function pintar() {
        pasos.innerHTML = PASOS.map((p, i) => { const n = pasoProbs()[i]; return `<li><button type="button" data-p="${i}" aria-current="${i === A.paso ? 'step' : 'false'}" aria-label="Paso ${i + 1}: ${esc(p.n)}${n ? `, ${n} por arreglar` : ''}"><b>${n ? '!' : i < A.paso ? '✓' : i + 1}</b><span>${esc(p.n.split(' ')[0])}</span></button></li>`; }).join('');
        if (!A.b) { cuerpo.innerHTML = esqueleto(4); pie.hidden = true; return; }
        pie.hidden = false; const b = A.b, puede = editable(b);
        const e = estadoB(b);
        cuerpo.innerHTML = `<div class="md-asis-cab"><label class="mv-lab" for="mdb-nombre">Nombre de la campaña (solo lo ves tú)</label><input id="mdb-nombre" type="text" data-b="nombre" value="${esc(b.nombre || '')}"${puede ? '' : ' readonly'}><p class="mv-meta">${chip(e.texto, e.tono)} <span data-guardado>${esc(A.guardado)}</span>${b.de && b.de !== 'dueno' ? ` · lo empezó ${esc(deQuien(b.de))}` : ''}</p></div>
          <h2 class="md-q">Paso ${A.paso + 1} de 5 · ${esc(PASOS[A.paso].n)}</h2>${!puede && A.paso < 4 ? `<p class="md-aviso">${b.estado === 'creando' ? 'Se está creando en Meta: espera a que termine.' : 'Ya se creó en Meta: lo ves como quedó; los cambios se hacen desde Campañas.'}</p>` : ''}
          <fieldset class="md-fs"${puede || A.paso === 4 ? '' : ' disabled'}><legend class="mv-sr">${esc(PASOS[A.paso].n)}</legend>${[p1, p2, p3, p4, p5][A.paso](b)}</fieldset>`;
        const atras = pie.querySelector('[data-nav="-1"]'), sig = pie.querySelector('[data-nav="1"]'); atras.hidden = A.paso === 0; sig.hidden = A.paso === 4; pie.querySelector('.md-pie-n').textContent = `Paso ${A.paso + 1} de 5`; sig.textContent = A.paso < 4 ? 'Siguiente' : '';
      }
      async function ir(n, foco) { n = Math.max(0, Math.min(4, n)); await guardarYa(); A.paso = n; A.mejora = null; pintar(); sc.scrollTop = 0; if (n === 4 || (n === 2 && !A.b?.validacion)) validar(true); if (foco) setTimeout(() => cuerpo.querySelector(`[data-b="${CSS.escape(foco)}"]`)?.focus(), 30); }

      // ---- crear en Meta (en pausa) ----
      async function crear(b) {
        if (!A.b || !editable(A.b)) return;
        const v = A.b.validacion; if (!v || probs().length || A.validando) { ctx.toast(!v ? 'Primero se revisa: pulsa «Revisar otra vez».' : 'Antes hay que arreglar lo de la revisión.'); return; }
        if (!(await ctx.confirmar({ titulo: '¿Crear en Meta, en pausa?', texto: `«${A.b.nombre}»\n${costoTexto(v.costoMax, moneda()) ? 'Costo máximo: ' + costoTexto(v.costoMax, moneda()) + '\n' : ''}Se crea EN PAUSA: no gasta nada. Para activarla te pediré dos toques, con la cifra.`, ok: 'Crear en pausa' }))) return;
        await guardarYa(); const id = A.b.id;
        const r = await G.datos.crearEnMeta(id, opc());
        if (r.status === 202 || (r.status === 200 && r.borrador?.estado === 'creando')) { A.b = { ...A.b, ...(r.borrador || {}), estado: 'creando', error: null }; A.creandoDesde = Date.now(); pintar(); sondear(id); return; }
        if (r.status === 422) { A.b = { ...A.b, validacion: { ...(A.b.validacion || {}), ok: false, problemas: r.problemas || [] } }; pintar(); ctx.toast(`Meta encontró ${(r.problemas || []).length} cosas por arreglar.`); return; }
        if (r.status === 409) { ctx.toast(r.motivo || 'Ya se creó.'); abrir(id, 4); return; }
        A.b = { ...A.b, estado: 'fallo', error: r.motivo || 'la oficina no contestó' }; pintar();
      }
      function sondear(id) {
        clearTimeout(A.sondeo); const fin = Date.now() + 180000;
        const paso = async () => {
          const r = await G.datos.borradores(opc());
          if (r.status === 200) { const x = (r.items || []).find(i => i.id === id); if (x && A.b?.id === id) A.b = { ...x }; if (x && x.estado !== 'creando') { A.creandoDesde = 0; pintar(); ctx.toast(x.estado === 'creado' ? `«${x.nombre}» se creó EN PAUSA en Meta. Actívala desde Campañas cuando quieras.` : 'No se pudo crear: ' + (x.error || 'Meta no contestó.')); return; } }
          if (Date.now() > fin) { ctx.toast('Meta tarda: la campaña aparecerá en Campañas cuando termine.'); return; }
          if (A.paso === 4) pintar(); A.sondeo = setTimeout(paso, 2000);
        };
        A.sondeo = setTimeout(paso, 900);
      }
      // ---- galería del Estudio y teléfono ----
      function anadir(medios) {
        if (!A.b || !editable(A.b)) return 0; const ya = new Set((A.b.creativos || []).map(c => c.media)), hueco = MAX_CREATIVOS - (A.b.creativos || []).length;
        const nuevos = medios.filter(m => m && !ya.has(m.file || m)).slice(0, Math.max(0, hueco)).map(m => creativoNuevo(m.file || m, { formato: m.w ? formatoDeMedidas(m.w, m.h) : '', objetivo: A.b.objetivo, destino: A.b.destino }));
        if (nuevos.length) cambiar('creativos', [...(A.b.creativos || []), ...nuevos], true); return nuevos.length;
      }
      async function galeria() {
        const sel = new Set(), h = ctx.hoja({ titulo: 'Galería del Estudio', lleno: true, cuerpo: '<div class="md-gal grande" data-g>Cargando…</div>', acciones: [{ texto: 'Cancelar', alTocar: x => x.cerrar() }, { texto: 'Usar', tipo: 'primario', alTocar: x => { const n = anadir([...sel].map(f => items.find(i => i.file === f) || f)); x.cerrar(); ctx.toast(n ? `${n} ${n === 1 ? 'creativo añadido' : 'creativos añadidos'}.` : 'No se añadió nada.'); } }] });
        let items = []; const r = await G.datos.galeria({}, opc()); items = (r.items || []).filter(i => i.kind !== 'audio');
        const g = h.cuerpo.querySelector('[data-g]'), ya = new Set((A.b.creativos || []).map(c => c.media)), hueco = MAX_CREATIVOS - (A.b.creativos || []).length;
        g.innerHTML = items.length ? items.map(i => `<button type="button" class="md-gal-b" data-gf="${esc(i.file)}" aria-pressed="false"${ya.has(i.file) ? ' aria-disabled="true"' : ''} aria-label="${esc(i.prompt || i.file)}">${miniatura(i.file, { clase: 'md-mini fill' })}</button>`).join('') : '<p class="mv-nada">La galería está vacía.</p>';
        g.addEventListener('click', e => { const b = e.target.closest('[data-gf]'); if (!b || b.getAttribute('aria-disabled') === 'true') return; const f = b.dataset.gf; if (sel.has(f)) sel.delete(f); else if (sel.size < hueco) sel.add(f); else { ctx.toast(`Caben ${hueco} más.`); return; } b.setAttribute('aria-pressed', String(sel.has(f))); b.querySelector('.md-gal-ok')?.remove(); if (sel.has(f)) b.insertAdjacentHTML('beforeend', '<i class="md-gal-ok">✓</i>'); });
      }
      async function mejorar(i, campoN) {
        const c = A.b?.creativos?.[i]; if (!c) return; await guardarYa(); A.mejora = { cr: c.id, campo: campoN, estado: 'pidiendo' }; pintar();
        const r = await G.datos.mejorarBorrador(A.b.id, { creativo: c.id, campo: campoN }, opc());
        A.mejora = r.status === 200 && r.texto ? { cr: c.id, campo: campoN, estado: 'lista', texto: r.texto, agente: r.agente } : null; if (!A.mejora) ctx.toast('No llegó la propuesta: ' + (r.motivo || 'la oficina no contestó')); pintar();
      }

      // ---- eventos ----
      cuerpo.addEventListener('input', e => {
        const t = e.target, ruta = t.dataset.b; if (!ruta) return;
        let v = t.value;
        if (ruta === 'publico.intereses') v = v.split(',').map(s => s.trim()).filter(Boolean); else if (/^(presupuesto\.usd|publico\.(edad|radio))/.test(ruta)) v = v.trim() === '' ? (ruta === 'publico.edadMax' ? null : '') : Number(v.replace(',', '.')); else if (ruta === 'categoriaEspecial') v = v || null;
        cambiar(ruta, v);
        const c = cuerpo.querySelector(`[data-cnt="${CSS.escape(ruta)}"]`), max = /titular/.test(ruta) ? LARGO.titular : LARGO.texto; if (c) { const n = [...t.value].length; c.textContent = `${n} de ${max} letras${n > max ? ': Meta enseña solo lo primero y pone «Ver más»' : ''}`; }
      });
      cuerpo.addEventListener('change', e => {
        const t = e.target;
        if (t.matches('[data-pais]')) return cambiar('publico.paises', [t.value]);
        if (t.matches('[data-b][type="date"], select[data-b]')) { cambiar(t.dataset.b, t.value); if (A.paso === 2) { setTimeout(() => validar(true), 600); } return; }
        if (t.matches('[data-ub]')) { A.metaPrev = { ...(A.metaPrev || {}), formato: t.value, estado: null }; return; }
        if (t.matches('[data-file]')) subir(t);
      });
      async function subir(input) {
        const files = [...input.files]; input.value = ''; if (!files.length) return; A.subiendo = true; pintar(); const its = [];
        for (const f of files.slice(0, MAX_CREATIVOS)) { try { its.push(await subirArchivo(ctx.api, f)); } catch (err) { ctx.toast(`${f.name}: ${motivo(err)}`); } }
        A.subiendo = false; const n = anadir(its.map(i => ({ file: i.file, w: i.w, h: i.h }))); pintar(); if (n) ctx.toast(`${n} ${n === 1 ? 'creativo añadido' : 'creativos añadidos'}.`);
      }
      el.addEventListener('click', async e => {
        const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
        if (d.nav) return ir(A.paso + +d.nav);
        if (d.p != null && d.p !== '') return ir(+d.p);
        if (d.irPaso != null) return ir(+d.irPaso);
        if (d.op) { const [ruta, v] = d.op.split('|'); if (ruta === 'publico.lugar') { const p = { ...(A.b.publico || {}) }; if (v === 'radio') { p.radio = p.radio || { lat: '', lng: '', km: 10 }; p.paises = []; } else { delete p.radio; p.paises = p.paises?.length ? p.paises : ['PA']; } cambiar('publico', p, true); return; } cambiar(ruta, ruta === 'categoriaEspecial' ? (v || null) : v, true); return; }
        if (d.modo) { cambiar('publico', { ...(A.b.publico || {}), modo: d.modo }, true); return; }
        if (t.hasAttribute('data-sinfin')) { cambiar('fin', null, true); return; }
        if (d.quitarCr != null) { cambiar('creativos', A.b.creativos.filter((_, i) => i !== +d.quitarCr), true); return; }
        if (d.mejorar) { const [i, c] = d.mejorar.split('|'); return mejorar(+i, c); }
        if (d.usarMej != null) { cambiar(`creativos.${d.usarMej}.texto`, A.mejora.texto, true); A.mejora = null; pintar(); return; }
        if (t.hasAttribute('data-quitar-mej')) { A.mejora = null; return pintar(); }
        if (t.hasAttribute('data-gal')) return galeria();
        if (t.hasAttribute('data-subir-cr')) return el.querySelector('[data-file]')?.click();
        if (t.hasAttribute('data-validar')) return validar(false);
        if (t.hasAttribute('data-crear')) { if (t.getAttribute('aria-disabled') === 'true') { ctx.toast(!A.b.validacion ? 'Primero se revisa.' : 'Antes hay que arreglar lo de la revisión.'); return; } return crear(t); }
        if (d.verCamp) { ctx.navegar('anuncios', { tab: 'campanas' }); return; }
        if (t.hasAttribute('data-metaver')) { const f = el.querySelector('[data-ub]')?.value || UBICACIONES_META[0][0]; A.metaPrev = { formato: f, estado: 'pidiendo' }; pintar(); await guardarYa(); const r = await G.datos.vistaPreviaMeta(A.b.id, f, opc()); const url = r.status === 200 ? iframeMeta(r.html) : null; A.metaPrev = url ? { formato: f, estado: 'lista', url } : { formato: f, estado: 'error', motivo: r.motivo || 'Meta no devolvió una vista previa que se pueda enseñar.' }; pintar(); }
      });
      el._abrir = abrir; el._guardarYa = guardarYa; el._A = A; pintar();
    },
    alMostrar(el, ctx, p) { document.body.classList.add('mv-inmersivo'); ctx.cabecera({ titulo: 'Nueva campaña', acciones: [] }); if (p?.id) el._abrir?.(p.id, p.paso ?? 0); },
    alOcultar(el) { document.body.classList.remove('mv-inmersivo'); el._guardarYa?.(); clearTimeout(el._A?.sondeo); },
  });
}
