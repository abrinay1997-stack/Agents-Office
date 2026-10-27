/* Cerebro → «Actualizar conexiones» (solo en la nube, solo administradores). Un flujo para escritorio (el panel del Cerebro) y celular (una hoja): quien lo abre le da un contenedor.
   Se pulsa a mano, nunca corre solo: 1) mira qué hay que limpiar y qué notas nuevas se podrían conectar; 2) la IA propone (de a tres notas); 3) tú eliges; 4) se escribe y se limpia; 5) se puede deshacer.
   Todo lo decide y valida el servidor (lib/conexiones.js): aquí solo se pinta y se manda. Los nombres de las notas son texto de cualquiera: siempre pasan por esc(), y nada se manda por un atributo. */
(() => {
  'use strict';
  const N = window.AO_NUBE; if (!N) return;
  const { api, esc } = N;
  const RUTA = '/api/brain/actualizar';
  const POR_PETICION = 3;
  const usd = (x) => (x == null ? 'un precio que no conozco' : x < 0.01 ? 'menos de US$0,01' : 'US$' + x.toFixed(2).replace('.', ','));
  const n = (k, uno, varios) => `${k} ${k === 1 ? uno : varios}`;
  const post = (cuerpo) => api(RUTA, { metodo: 'POST', cuerpo });
  const lista = (xs, max = 6) => xs.slice(0, max).map((x) => `«${esc(x)}»`).join(', ') + (xs.length > max ? ` y ${xs.length - max} más` : '');

  /** cont: dónde se pinta · alGrafo(mapa): el mapa cambió, que se redibuje · alCerrar(): «Listo» (si no se da, vuelve al inicio del flujo) */
  function abrir(cont, { alGrafo = () => {}, alCerrar = null } = {}) {
    const S = { fase: 'carga', est: null, props: [], origen: 'ia', hechas: 0, aviso: '', res: null, undo: null, cancelar: false, error: '' };
    const vivo = () => cont.isConnected;
    const poner = (html) => { if (vivo()) { cont.innerHTML = `<div class="cx" data-fase="${S.fase}">${html}</div>`; const h = cont.querySelector('[data-foco]'); if (h) h.focus({ preventScroll: true }); } };

    /* ---------- las pantallas ---------- */
    const pCarga = (t = 'Mirando el Cerebro…') => poner(`<p class="cx-lead" role="status" aria-live="polite"><span class="cx-gira" aria-hidden="true"></span> ${esc(t)}</p>`);
    const pError = (t, otra = 'recargar') => poner(`<p class="cx-mal" role="alert">⚠ ${esc(t)}</p><div class="cx-fila"><button type="button" class="cx-b pri" data-a="${otra}" data-foco>Reintentar</button></div>`);

    function pResumen() {
      const e = S.est, l = e.limpieza, c = e.candidatas, m = e.modelo, sinMapa = !e.mapa.hay;
      const lineas = [];
      if (l.totalQuitados) lineas.push(`${n(l.totalQuitados, 'neurona', 'neuronas')} de notas que ya no existen${l.nodosQuitados.length ? ' (' + lista(l.nodosQuitados, 4) + ')' : ''} y sus líneas`);
      else if (l.lineasQuitadas) lineas.push(`${n(l.lineasQuitadas, 'línea', 'líneas')} que ya no valen (un enlace que se quitó de una nota)`);
      if (l.gradosCorregidos) lineas.push(`${n(l.gradosCorregidos, 'nota', 'notas')} con el tamaño mal contado (tenían líneas a notas borradas)`);
      if (l.nuevasEnElMapa) lineas.push(`${n(l.nuevasEnElMapa, 'nota nueva', 'notas nuevas')} que el mapa guardado todavía no tiene`);
      if (l.conectadas) lineas.push(`${n(l.conectadas, 'nota', 'notas')} que ahora sí tienen enlaces y salen del anillo`);
      if (l.sueltas) lineas.push(`${n(l.sueltas, 'nota', 'notas')} que se quedaron sin enlaces`);
      if (l.memoria) lineas.push(`${n(l.memoria, 'recuerdo', 'recuerdos')} que los agentes aprendieron de notas borradas`);
      const limpio = sinMapa
        ? `<p class="cx-peq">Todavía no hay un mapa guardado (se crea al migrar desde tu computadora). Las conexiones nuevas se escriben igual en las notas; el dibujo las incluirá después.</p>`
        : lineas.length ? `<ul class="cx-ul">${lineas.map((x) => `<li>${x}</li>`).join('')}</ul>` : `<p class="cx-ok">✓ El mapa ya está al día con tus notas.</p>`;
      const rotos = l.totalRotos ? `<details class="cx-det"><summary>${n(l.totalRotos, 'enlace dentro de una nota apunta', 'enlaces dentro de tus notas apuntan')} a una nota que ya no existe</summary><ul class="cx-ul">${l.enlacesRotos.map((r) => `<li>«${esc(r.nota)}» → [[${esc(r.a)}]]</li>`).join('')}</ul><p class="cx-peq">No los toco: el texto de tus notas es tuyo. Quita el enlace o crea la nota.</p></details>` : '';
      const aviso = !m.conClave ? `<p class="cx-aviso" role="note">Falta el secreto <code>${esc(m.secreto || '')}</code> en Cloudflare para usar ${esc(m.nombre)}. Elige otro modelo en Ajustes → Modelos (función «Conectar notas del Cerebro»).</p>` : '';
      const conectar = c.length
        ? `<p>${n(e.total, 'nota nueva o cambiada', 'notas nuevas o cambiadas')} sin revisar: ${lista(c.map((x) => x.nombre), 6)}.${e.pendientes ? ` Hoy reviso las primeras ${c.length}; el resto queda para la siguiente vez.` : ''}</p>
           <p class="cx-peq">La IA (${esc(m.nombre)}) lee cada nota y propone con cuáles de las que ya existen conviene enlazarla. Cuesta ${esc(usd(e.costo.usd))} aprox. Tú eliges qué se escribe. Las ${e.protegidas} notas de fábrica y las notas clave nunca se tocan: solo se escribe en las tuyas.</p>${aviso}
           <div class="cx-fila"><button type="button" class="cx-b pri" data-a="proponer"${m.conClave ? '' : ' disabled'} data-foco>Buscar conexiones con IA</button></div>`
        : `<p class="cx-ok">✓ No hay notas nuevas ni cambiadas por conectar.</p>`;
      const uso = (e.porUso || []).reduce((t, p) => t + p.enlaces.length, 0);
      const usadas = uso
        ? `<p>${n(uso, 'pareja de notas que tus agentes usaron', 'parejas de notas que tus agentes usaron')} juntas en trabajo que aprobaste y nadie ha enlazado:</p>
           <ul class="cx-ul">${e.porUso.flatMap((p) => p.enlaces.map((x) => `<li>«${esc(p.nota)}» y «${esc(x.a)}» <small>(${n(x.usos, 'trabajo', 'trabajos')})</small></li>`)).slice(0, 6).join('')}</ul>
           <p class="cx-peq">Es lo que ya pasó, no cuesta nada. Tú eliges cuáles se escriben, como «Relacionadas» al final de la nota que sea tuya.</p>
           <div class="cx-fila"><button type="button" class="cx-b" data-a="uso">Ver y elegir (gratis)</button></div>`
        : `<p class="cx-peq">Cuando tus agentes citen dos notas juntas varias veces en trabajo que apruebes, aparecerán aquí para que las enlaces.</p>`;
      const mc = e.mapaCompleto || {}, fecha = (t) => new Date(t).toLocaleString('es-PA', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
      const copia = mc.copia ? `<p class="cx-peq">Hay un mapa anterior guardado (${esc(fecha(mc.copia.at))}${mc.copia.por ? ', ' + esc(mc.copia.por) : ''}).</p><div class="cx-fila"><button type="button" class="cx-b" data-a="mapa-deshacer">Volver al mapa anterior</button></div>` : '';
      const entero = mc.puede
        ? `<p>Vuelve a calcular dónde va cada neurona con tus ${mc.notas} notas y sus enlaces de ahora, como hacía tu computadora al migrar. <b>Todas las neuronas pueden moverse.</b> Las notas no se tocan, solo el dibujo; si no te gusta cómo queda, vuelves al anterior.</p>
           <div class="cx-fila"><button type="button" class="cx-b" data-a="mapa">Reacomodar el mapa entero</button></div>${copia}`
        : `<p class="cx-peq">${mc.notas ? `Tienes ${mc.notas} notas: pasa del tope de ${mc.tope} para calcularlo aquí. Sigue calculándose desde tu computadora al migrar.` : 'Todavía no hay notas que dibujar.'}</p>${copia}`;
      const ult = e.ultima?.at ? `<p class="cx-peq">Última actualización: ${esc(new Date(e.ultima.at).toLocaleString('es-PA', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))} · ${n(e.ultima.enlaces || 0, 'conexión', 'conexiones')}.</p>` : '';
      poner(`<p class="cx-lead">No corre solo: tú decides cuándo. Pone el mapa al día con tus notas y, si quieres, la IA propone con qué notas conectar las nuevas. Nada se escribe en una nota sin tu visto bueno.</p>
        <section class="cx-sec" aria-labelledby="cx-h1"><h4 id="cx-h1">1 · Limpiar el mapa <small>(gratis)</small></h4>${limpio}${rotos}
          ${l.hay ? `<div class="cx-fila"><button type="button" class="cx-b" data-a="limpiar">Limpiar el mapa ahora</button></div>` : ''}</section>
        <section class="cx-sec" aria-labelledby="cx-h2"><h4 id="cx-h2">2 · Conectar notas nuevas con IA</h4>${conectar}</section>
        <section class="cx-sec" aria-labelledby="cx-h3"><h4 id="cx-h3">3 · Notas que tus agentes usan juntas <small>(gratis)</small></h4>${usadas}</section>
        <section class="cx-sec" aria-labelledby="cx-h4"><h4 id="cx-h4">4 · Reacomodar todo el mapa <small>(gratis)</small></h4>${entero}</section>
        <section class="cx-sec" aria-labelledby="cx-h5"><h4 id="cx-h5">5 · Notas repetidas o que se contradicen <small>(gratis)</small></h4>
          <p>Busca notas que dicen casi lo mismo y cifras (precios, porcentajes, plazos) que una nota da distintas de otra. Solo avisa: no cambia nada. Una nota de fábrica manda sobre la tuya.</p>
          <div class="cx-fila"><button type="button" class="cx-b" data-a="calidad">Buscar ahora</button></div></section>${ult}`);
    }

    function pIA() {
      const total = S.est.candidatas.length;
      poner(`<p class="cx-lead" role="status" aria-live="polite"><span class="cx-gira" aria-hidden="true"></span> Leyendo las notas… ${S.hechas} de ${total}</p>
        <progress class="cx-prog" max="${total}" value="${S.hechas}" aria-label="Notas revisadas"></progress>
        <div class="cx-fila"><button type="button" class="cx-b" data-a="parar" data-foco>Parar aquí</button></div>`);
    }

    function pRevisar() {
      const con = S.props.filter((p) => p.enlaces.length), sin = S.props.filter((p) => !p.enlaces.length);
      const tarjetas = con.map((p, i) => `<fieldset class="cx-nota"><legend>«${esc(p.nota)}»</legend>${p.enlaces.map((e, j) => `<label class="cx-enl"><input type="checkbox" checked data-i="${i}" data-j="${j}"><span><b>[[${esc(e.a)}]]</b>${e.porque ? `<small>${esc(e.porque)}</small>` : ''}</span></label>`).join('')}</fieldset>`).join('');
      const nada = sin.length ? `<details class="cx-det"><summary>${n(sin.length, 'nota', 'notas')} sin conexiones claras</summary><ul class="cx-ul">${sin.map((p) => `<li>«${esc(p.nota)}»${p.aviso ? ` <small>${esc(p.aviso)}</small>` : ''}</li>`).join('')}</ul><p class="cx-peq">No vuelven a salir hasta que las edites.</p></details>` : '';
      const deUso = S.origen === 'uso';
      poner(`<p class="cx-lead">${deUso ? `Tus agentes usaron juntas estas notas en trabajo que aprobaste. Quita las que no quieras enlazar.` : con.length ? `La IA propone enlaces para ${n(con.length, 'nota', 'notas')}. Quita los que no te sirvan.` : 'La IA no vio conexiones claras en estas notas.'}${S.usd != null ? ` <span class="cx-peq">Costó ${esc(usd(S.usd))}.</span>` : ''}</p>${S.aviso ? `<p class="cx-aviso" role="note">${esc(S.aviso)}</p>` : ''}
        <p class="cx-peq">Se añaden al final de cada nota, en una sección «Relacionadas», sin cambiar nada de lo que ya decía.</p>${tarjetas}${nada}
        <div class="cx-fila"><button type="button" class="cx-b pri" data-a="aplicar" data-foco></button><button type="button" class="cx-b" data-a="recargar">Volver</button></div>`);
      rotular();
    }
    const elegidos = () => [...cont.querySelectorAll('input[type=checkbox][data-i]:checked')];
    function rotular() {
      const b = cont.querySelector('[data-a=aplicar]'); if (!b) return; const k = elegidos().length;
      b.textContent = k ? `Aplicar ${n(k, 'conexión', 'conexiones')} y limpiar el mapa` : 'Marcarlas como revisadas y limpiar el mapa';
    }

    const cifrasDif = (d) => d.map((x) => `${x.a.map(esc).join(' / ')} frente a ${x.b.map(esc).join(' / ')}`).join(' · ');
    const veredicto = (v) => (!v ? '' : v.aviso ? `<p class="cx-aviso" role="note">${esc(v.aviso)}</p>` : `<p class="${v.veredicto === 'contradice' ? 'cx-mal' : 'cx-peq'}" role="status"><b>${v.veredicto === 'contradice' ? 'La IA: sí se contradicen' : v.veredicto === 'distinto' ? 'La IA: hablan de cosas distintas' : 'La IA no está segura'}.</b> ${esc(v.porque || '')}</p>`);
    function pCalidad() {
      const c = S.cal, juzgadas = S.veredictos || {}, sinIA = c.ia.n - Object.keys(juzgadas).length;
      const tarjetasC = c.contradicciones.map((x) => `<fieldset class="cx-nota"><legend>«${esc(x.a.nota)}» frente a «${esc(x.b.nota)}»</legend>
          <p class="cx-peq">«${esc(x.a.nota)}»: ${esc(x.a.linea)}</p><p class="cx-peq">«${esc(x.b.nota)}»: ${esc(x.b.linea)}</p>
          <p><b>${cifrasDif(x.dif)}</b></p>
          <p class="cx-peq">${x.manda ? `La nota de fábrica «${esc(x.manda === 'a' ? x.a.nota : x.b.nota)}» manda: corrige «${esc(x.manda === 'a' ? x.b.nota : x.a.nota)}».` : x.accionable ? 'Decide tú cuál vale y corrige la otra.' : 'Son dos notas de fábrica: solo para tu información.'}</p>
          ${veredicto(juzgadas[x.clave])}<div class="cx-fila"><button type="button" class="cx-b" data-a="cal-ign" data-k="${esc(x.clave)}">Ya lo revisé</button></div></fieldset>`).join('');
      const tarjetasD = c.duplicadas.map((x) => `<fieldset class="cx-nota"><legend>«${esc(x.a.nota)}» y «${esc(x.b.nota)}»</legend>
          <p>Se parecen un ${Math.round(x.parecido * 100)} %.${x.contiene ? ` «${esc(x.contiene === 'a' ? x.a.nota : x.b.nota)}» está casi entera dentro de la otra.` : ''}</p>
          <p class="cx-peq">${n(x.a.palabras, 'palabra', 'palabras')} y ${n(x.b.palabras, 'palabra', 'palabras')}. Quizá basta con dejar una.</p>
          <div class="cx-fila"><button type="button" class="cx-b" data-a="cal-ign" data-k="${esc(x.clave)}">Ya lo revisé</button></div></fieldset>`).join('');
      const ia = c.contradicciones.length && c.ia.n
        ? (c.ia.conClave
          ? `<p class="cx-peq">La IA (${esc(c.ia.modelo)}) puede confirmar si de verdad se contradicen o si hablan de cosas distintas: ${n(c.ia.n, 'aviso', 'avisos')}, ${esc(usd(c.ia.usd))} aprox.</p>${sinIA > 0 ? `<div class="cx-fila"><button type="button" class="cx-b pri" data-a="cal-ia">Pedirle a la IA que confirme</button></div>` : ''}`
          : `<p class="cx-aviso" role="note">Falta el secreto <code>${esc(c.ia.secreto || '')}</code> en Cloudflare para que la IA confirme. Elige otro modelo en Ajustes → Modelos (función «Conectar notas del Cerebro»).</p>`)
        : '';
      const vacio = !c.contradicciones.length && !c.duplicadas.length
        ? `<p class="cx-ok">✓ No encontré notas repetidas ni cifras que se contradigan en tus ${c.revisadas} notas.</p><p class="cx-peq">Solo veo cifras escritas cerca de las mismas palabras: un dato dicho con otras palabras no lo comparo.${c.ignoradas ? ` Dejé fuera ${n(c.ignoradas, 'aviso que ya revisaste', 'avisos que ya revisaste')}.` : ''}</p>` : '';
      poner(`${c.contradicciones.length ? `<h4>${n(c.contradicciones.length, 'posible contradicción', 'posibles contradicciones')}</h4>${ia}${tarjetasC}` : ''}
        ${c.duplicadas.length ? `<h4>${n(c.duplicadas.length, 'pareja de notas repetida', 'parejas de notas repetidas')}</h4>${tarjetasD}` : ''}${vacio}
        ${S.aviso ? `<p class="cx-aviso" role="note">${esc(S.aviso)}</p>` : ''}<p class="cx-peq">Es un aviso con mis ojos de lector rápido, no una sentencia: lo decides tú y nada se corrige solo.</p>
        <div class="cx-fila"><button type="button" class="cx-b pri" data-a="recargar" data-foco>Volver al inicio</button></div>`);
    }

    function pMapa() { // el mapa entero se recalculó (o se volvió al anterior)
      const r = S.mapaRes, vuelta = r.vuelta;
      const cuerpo = vuelta
        ? `<p class="cx-ok">✓ Volví al mapa anterior.${r.acomodadas ? ` ${n(r.acomodadas, 'nota que llegó', 'notas que llegaron')} después se acomodó junto a sus vecinas, sin mover lo demás.` : ''}</p>`
        : `<p class="cx-ok">✓ Mapa recalculado: ${n(r.notas, 'neurona', 'neuronas')}, ${n(r.conectadas, 'conectada', 'conectadas')}, ${n(r.lineas, 'línea', 'líneas')}${r.menciones ? ` y ${n(r.menciones, 'mención', 'menciones')} (notas que nombran a otra sin enlazarla)` : ''}.</p>
           ${r.motor === 'interno' ? `<p class="cx-aviso" role="note">Se usó el cálculo de reserva (no está d3-force en el servidor): el dibujo puede verse distinto al de tu computadora.</p>` : ''}
           ${r.copia ? '' : `<p class="cx-peq">No había un mapa anterior que guardar, así que esta vez no hay a qué volver.</p>`}
           ${r.memoria ? `<p class="cx-peq">${n(r.memoria, 'recuerdo olvidado', 'recuerdos olvidados')} de notas que ya no existen.</p>` : ''}`;
      poner(`${cuerpo}<div class="cx-fila">${!vuelta && r.copia ? `<button type="button" class="cx-b" data-a="mapa-deshacer">Volver al mapa anterior</button>` : ''}<button type="button" class="cx-b pri" data-a="${alCerrar ? 'cerrar' : 'recargar'}" data-foco>${alCerrar ? 'Listo' : 'Volver al inicio'}</button></div>`);
    }

    function pListo() {
      const r = S.res, l = r.limpieza, con = r.aplicadas, bien = [];
      if (con.length) bien.push(`<p class="cx-ok">✓ ${n(r.enlaces, 'conexión nueva', 'conexiones nuevas')} en ${n(con.length, 'nota', 'notas')}.</p><ul class="cx-ul">${con.map((a) => `<li>«${esc(a.nota)}» → ${a.enlaces.map((x) => `[[${esc(x)}]]`).join(', ')}</li>`).join('')}</ul>`);
      const hecho = [];
      if (l.nodosQuitados) hecho.push(`${n(l.nodosQuitados, 'neurona quitada', 'neuronas quitadas')} de notas borradas`);
      if (l.lineasQuitadas) hecho.push(`${n(l.lineasQuitadas, 'línea quitada', 'líneas quitadas')}`);
      if (l.lineasNuevas) hecho.push(`${n(l.lineasNuevas, 'línea nueva', 'líneas nuevas')}`);
      if (l.gradosCorregidos) hecho.push(`${n(l.gradosCorregidos, 'tamaño ajustado', 'tamaños ajustados')}`);
      if (l.conectadas) hecho.push(`${n(l.conectadas, 'nota entró', 'notas entraron')} al mapa conectado`);
      if (l.sueltas) hecho.push(`${n(l.sueltas, 'nota pasó', 'notas pasaron')} al anillo (sin enlaces)`);
      if (l.memoria) hecho.push(`${n(l.memoria, 'recuerdo olvidado', 'recuerdos olvidados')} de notas borradas`);
      bien.push(hecho.length ? `<p><b>Mapa al día:</b> ${hecho.join(' · ')}.</p>` : `<p class="cx-ok">✓ El mapa ya estaba al día.</p>`);
      if (r.sinMapa) bien.push(`<p class="cx-peq">Todavía no hay un mapa guardado (se crea al migrar desde tu computadora).</p>`);
      if (r.omitidas.length) bien.push(`<details class="cx-det"><summary>${n(r.omitidas.length, 'nota que no se tocó', 'notas que no se tocaron')}</summary><ul class="cx-ul">${r.omitidas.map((o) => `<li>«${esc(o.nota)}» — ${esc(o.motivo)}</li>`).join('')}</ul></details>`);
      if (r.totalRotos) bien.push(`<details class="cx-det"><summary>${n(r.totalRotos, 'enlace apunta', 'enlaces apuntan')} a notas que ya no existen</summary><ul class="cx-ul">${r.enlacesRotos.map((x) => `<li>«${esc(x.nota)}» → [[${esc(x.a)}]]</li>`).join('')}</ul></details>`);
      if (S.undoMsg) bien.push(`<p class="cx-peq" role="status">${esc(S.undoMsg)}</p>`);
      if (r.pendientes) bien.push(`<p>Quedan ${n(r.pendientes, 'nota', 'notas')} por revisar.</p>`);
      poner(`${bien.join('')}<div class="cx-fila">${r.pendientes ? `<button type="button" class="cx-b pri" data-a="recargar" data-foco>Seguir con las siguientes</button>` : ''}${S.undo?.length ? `<button type="button" class="cx-b" data-a="deshacer">Deshacer las conexiones nuevas</button>` : ''}<button type="button" class="cx-b${r.pendientes ? '' : ' pri'}" data-a="${r.pendientes || !alCerrar ? 'recargar' : 'cerrar'}"${r.pendientes ? '' : ' data-foco'}>${r.pendientes ? 'Volver al inicio' : 'Listo'}</button></div>`);
    }

    /* ---------- lo que hace cada botón ---------- */
    async function cargar() {
      S.fase = 'carga'; S.undoMsg = ''; S.origen = 'ia'; pCarga();
      try { S.est = await api(RUTA); S.fase = 'resumen'; pResumen(); } catch (e) { S.fase = 'error'; pError(e.message, 'recargar'); }
    }
    function verUso() { // las parejas que los agentes usaron juntas: ya vienen en el estado, no hay nada que pedir a la IA
      S.origen = 'uso'; S.props = (S.est.porUso || []).map((p) => ({ ...p, enlaces: p.enlaces.map(({ a, porque }) => ({ a, porque })) })); S.aviso = ''; S.usd = null; S.fase = 'revisar'; pRevisar();
    }
    async function proponer() {
      S.origen = 'ia'; S.fase = 'ia'; S.props = []; S.hechas = 0; S.aviso = ''; S.usd = null; S.cancelar = false;
      const nombres = S.est.candidatas.map((c) => c.nombre); pIA();
      let gasto = 0;
      for (let i = 0; i < nombres.length && !S.cancelar && vivo(); i += POR_PETICION) {
        try {
          const r = await post({ paso: 'proponer', notas: nombres.slice(i, i + POR_PETICION) });
          S.props.push(...r.propuestas); gasto += r.usd || 0; S.hechas = Math.min(nombres.length, i + POR_PETICION); S.usd = gasto; if (vivo() && S.fase === 'ia') pIA();
        } catch (e) { S.aviso = `Me detuve en la nota ${S.hechas + 1}: ${e.message}`; break; }
      }
      if (!vivo()) return;
      if (S.cancelar) S.aviso = 'Paraste antes de terminar: solo ves lo que alcancé a revisar.';
      S.fase = 'revisar'; pRevisar();
    }
    async function aplicar(soloLimpiar = false) {
      const con = S.props.filter((p) => p.enlaces.length), conexiones = [];
      if (!soloLimpiar) {
        const marcadas = new Set(elegidos().map((c) => c.dataset.i + ':' + c.dataset.j));
        con.forEach((p, i) => { const es = p.enlaces.filter((_, j) => marcadas.has(i + ':' + j)); if (es.length) conexiones.push({ nota: p.nota, rev: p.rev, enlaces: es }); });
      }
      const revisadas = soloLimpiar || S.origen === 'uso' ? [] : S.props.filter((p) => !p.fallo && p.rev != null).map((p) => ({ nota: p.nota, rev: p.rev }));
      S.fase = 'guardando'; pCarga(soloLimpiar ? 'Limpiando el mapa…' : 'Escribiendo las conexiones y limpiando el mapa…');
      try {
        const r = await post({ paso: 'aplicar', conexiones, revisadas, ...(S.origen === 'uso' && !soloLimpiar ? { origen: 'uso' } : {}) });
        S.res = r; S.undo = r.deshacer || []; S.fase = 'listo'; S.props = [];
        if (r.graph) alGrafo(r.graph);
        pListo();
      } catch (e) { S.fase = 'error'; pError(e.message, 'recargar'); }
    }
    async function calidad() {
      S.fase = 'guardando'; S.veredictos = {}; S.aviso = ''; pCarga('Comparando tus notas…');
      try { S.cal = await post({ paso: 'calidad' }); S.fase = 'listo'; pCalidad(); } catch (e) { S.fase = 'error'; pError(e.message, 'recargar'); }
    }
    async function calidadIA() {
      const pend = S.cal.contradicciones.filter((c) => c.accionable && !S.veredictos[c.clave]).slice(0, S.cal.ia.n).map((c) => c.clave);
      S.fase = 'guardando'; S.aviso = ''; let hechas = 0;
      for (let i = 0; i < pend.length && vivo(); i += 3) {
        pCarga(`Pidiendo confirmación a la IA… ${hechas} de ${pend.length}`);
        try { const r = await post({ paso: 'calidad-ia', claves: pend.slice(i, i + 3) }); for (const v of r.veredictos) S.veredictos[v.clave] = v; hechas += r.veredictos.length; } catch (e) { S.aviso = `Me detuve en el aviso ${hechas + 1}: ${e.message}`; break; }
      }
      if (vivo()) { S.fase = 'listo'; pCalidad(); }
    }
    async function ignorar(clave) {
      try { await post({ paso: 'calidad-ignorar', claves: [clave] }); S.cal.contradicciones = S.cal.contradicciones.filter((c) => c.clave !== clave); S.cal.duplicadas = S.cal.duplicadas.filter((c) => c.clave !== clave); S.cal.ignoradas++; S.cal.ia.n = Math.min(S.cal.ia.n, S.cal.contradicciones.filter((c) => c.accionable).length); pCalidad(); }
      catch (e) { S.aviso = e.message; pCalidad(); }
    }
    async function mapa(deshacerlo = false) {
      S.fase = 'guardando'; pCarga(deshacerlo ? 'Volviendo al mapa anterior…' : 'Calculando el mapa entero… puede tardar unos segundos.');
      try {
        const r = await post({ paso: deshacerlo ? 'mapa-deshacer' : 'mapa' });
        S.mapaRes = { ...r, vuelta: deshacerlo }; if (r.graph) alGrafo(r.graph);
        S.fase = 'listo'; pMapa();
      } catch (e) { S.fase = 'error'; pError(e.message, 'recargar'); }
    }
    async function deshacer() {
      S.fase = 'guardando'; pCarga('Deshaciendo…');
      try {
        const r = await post({ paso: 'deshacer', cambios: S.undo });
        S.undoMsg = `Deshecho en ${n(r.deshechas.length, 'nota', 'notas')}.${r.noPude.length ? ' No toqué: ' + r.noPude.map((x) => `«${x.nota}» (${x.motivo})`).join('; ') : ''}`;
        S.undo = null; S.res = { ...S.res, aplicadas: [], enlaces: 0, omitidas: [], limpieza: {}, totalRotos: 0 };
        if (r.graph) alGrafo(r.graph);
        S.fase = 'listo'; pListo();
      } catch (e) { S.fase = 'error'; pError(e.message, 'recargar'); }
    }

    cont._cxAc?.abort(); const ac = new AbortController(); cont._cxAc = ac; // abrir dos veces en el mismo contenedor no duplica los botones
    cont.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-a]'); if (!b || !cont.contains(b) || b.disabled) return;
      const a = b.dataset.a;
      if (a === 'recargar') cargar();
      else if (a === 'cerrar') alCerrar();
      else if (a === 'proponer') proponer();
      else if (a === 'uso') verUso();
      else if (a === 'calidad') calidad();
      else if (a === 'cal-ia') calidadIA();
      else if (a === 'cal-ign') ignorar(b.dataset.k);
      else if (a === 'mapa') mapa(false);
      else if (a === 'mapa-deshacer') mapa(true);
      else if (a === 'parar') { S.cancelar = true; b.disabled = true; b.textContent = 'Parando…'; }
      else if (a === 'aplicar') aplicar(false);
      else if (a === 'limpiar') aplicar(true);
      else if (a === 'deshacer') deshacer();
    }, { signal: ac.signal });
    cont.addEventListener('change', (ev) => { if (ev.target.matches('input[type=checkbox][data-i]')) rotular(); }, { signal: ac.signal });
    cargar();
  }

  N.cerebroActualizar = { abrir };
  window.dispatchEvent(new Event('ao:cerebro-actualizar'));
})();
