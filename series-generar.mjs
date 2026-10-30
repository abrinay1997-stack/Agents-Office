// Agents Office (30 oct 2026) — Fase 11.5 (carril K), oficina local, PR B: GENERAR SERIE. AQUÍ SÍ SE GASTA, así que cada paso tiene su candado.
// REGLA DEL DINERO (§3): nada gasta sin el clic del dueño ni por encima de sus topes; el costo mostrado ES el que se gasta; ni un agente, ni Dimitri, ni un MCP llegan aquí.
//   1. POST /api/series/<id>/generar sin `confirmacion` NO cambia nada que gaste: recalcula (hash de la escaleta, costo máximo de lo que falta, topes) y devuelve un TOKEN de
//      un solo uso (2 min) atado a ese hash, a esa cifra y a esos topes, con la cifra a la vista. La serie pasa a «espera_ok».
//   2. Con `confirmacion` + la cifra que el dueño vio: se vuelve a calcular TODO en el servidor. Si cambió el hash, el costo, un tope o el modo, o venció: 409 con la cifra nueva y
//      un token nuevo (otro clic, sobre lo que se ve ahora). Si coincide: el token se consume y se autoriza, todo en UNA escritura síncrona (dos clics a la vez: solo uno corre).
//   3. La bomba (`tick`) da UN paso a la vez: `siguientePaso` (serie-core, el único productor de gasto, exige hash vigente), topes del Estudio (día y mes) y de la serie (reserva en el
//      libro ANTES de enviar, con el máximo del proveedor) y cupo diario de series; apunta el paso en disco con su clave `serie:n:intento` (contador MONÓTONO) antes de llamar a
//      `media.submit`, y marca el trabajo con `serie:{id,n,intento}`. Al terminar liquida lo real; un reinicio retoma desde los trabajos sin duplicar ni cobrar dos veces.
// Un plano `skipped` jamás se genera. Pausa con motivo ante sin créditos/key, tope o cupo; un envío a un motor de pago que no se sabe cómo acabó queda «incierto» (puede haberse cobrado)
// y pide la decisión del dueño. Apagar `dimitri.serieGenerar` detiene la bomba (lo que va en el aire solo se liquida).
import { transicion, siguientePaso, emitirToken, verificarToken, consumirToken, hashEscaleta, claveIdempotencia, estimarSerie, costoPlano, CONFIG_SERIE, nuevoLibro, resumenLibro,
  reservar, liquidar, liberar, marcarIncierto, resolverIncierto, u2usd, usd2u, nuevaVersion } from './serie-core.mjs';
import { precioSeguro, costoRevisionSeguro } from './serie-propuesta-core.mjs';
import { vistaSerie } from './series.mjs';

export const MUESTRA = 3; // planos de la muestra (el mismo 3 de serie-core.siguientePaso)
const TRANSITORIAS = new Set(['espera', 'tiempo', 'red', 'servicio']); // clases de errores.mjs que merecen el reintento automático
const PARA_PAUSAR = new Set(['key', 'saldo']); // sin crédito o sin key: no es culpa del plano, se pausa la serie entera
const esCarrusel = s => /carrusel/i.test(s?.brief?.formato || ''); // el formato del brief, no el título
const GRATIS = new Set(['prueba', 'prueba-video', 'local']); // falla cerrado: todo motor que no sea uno de estos (o que no se resuelva) cuenta como de PAGO
const pagadoDe = engine => !GRATIS.has(engine);
export const AUTORIZACION_MS = 6 * 3600e3; // una autorización caduca aunque no haya reinicio
const err = (estado, error, extra = {}) => ({ estado, cuerpo: { error, ...extra } });

export function crearGenerador({ almacen, media, biblia, capsDe, precioPlano, existeRef = () => true, costoRevision = () => null, config = () => ({}), activo = () => false, ahora = () => Date.now(),
  nonce, hoy, auditar = () => {}, concurrencia = 1, intervalo = 1500, ttlMs = 120000, autorizacionMs = AUTORIZACION_MS, candado = null } = {}) {
  if (!almacen || !media || !biblia || !capsDe || !precioPlano || typeof nonce !== 'function' || typeof hoy !== 'function') throw new Error('el generador de series necesita almacén, Estudio, biblia, capsDe, precioPlano, nonce y hoy');
  const conf = () => ({ ...CONFIG_SERIE, ...(config() || {}) });
  const topeDe = s => Math.min(s.tope_usd ?? conf().topeSerieUsd, conf().topeSerieUsd); // bajar el tope en Ajustes aplica; subirlo no abre lo ya propuesto
  const mesClave = () => String(hoy()).slice(0, 7);
  const enVuelo = () => almacen.todas().reduce((n, s) => n + s.escaleta.filter(p => p.estado === 'corriendo').length, 0);
  const claveDe = (s, p) => claveIdempotencia(s.id, p.n, p.intento_actual);
  const reservaRev = () => costoRevisionSeguro(costoRevision());
  const preciosDe = planos => { const rev = reservaRev(); const l = planos.map(p => { const b = precioSeguro(precioPlano(p.modelo, p.ajustes)); return b && rev ? { ...b, qa: (b.qa ?? 0) + rev.qa, vision: (b.vision ?? 0) + rev.vision } : b; }); return l.every(Boolean) ? l : null; };
  const gastoMes = mes => { // lo liquidado, reservado o en duda de los carruseles de este mes, en todas las series
    let micro = 0;
    for (const s of almacen.todas()) {
      if (!esCarrusel(s) || !s.libro) continue;
      for (const [clave, x] of Object.entries(s.pasos || {})) {
        const l = x.mes === mes ? s.libro.lineas[clave] : null;
        if (l) micro += l.estado === 'liquidado' ? l.real : (l.estado === 'reservado' || l.estado === 'incierto') ? l.max : 0;
      }
    }
    return u2usd(micro);
  };
  const autorizacionDe = s => (s.autorizado ? { ok: true, serieId: s.id, hash: s.autorizado.hash, topeMax: s.autorizado.topeMax } : null);

  /** Lo que se mostraría y se gastaría AHORA para esta etapa (la muestra o todo lo que falta). Puro sobre el estado leído. */
  function calcular(s, modo) {
    const hechos = s.escaleta.filter(p => p.estado === 'listo' || p.estado === 'revisar').length, previstos = s.escaleta.filter(p => p.estado === 'previsto');
    const etapa = modo === 'muestra' ? previstos.slice(0, Math.max(0, MUESTRA - hechos)) : previstos;
    if (!etapa.length) return { error: 'nada', motivo: previstos.length ? `la muestra de ${MUESTRA} planos ya está lista: revísala y sigue con «generar todas»` : 'no quedan planos por generar' };
    const precios = preciosDe(etapa); if (!precios) return { error: 'precio', motivo: 'no se pudo calcular el precio de algún plano con un motor de pago fiable: no se muestra un costo falso y no se genera' };
    const est = estimarSerie(precios, conf()), tope = topeDe(s), libro = s.libro || nuevoLibro(tope), r = resumenLibro(libro);
    const disponible = Math.min(libro.tope, usd2u(tope)) - r.reservado - r.gastado - r.incierto, b = media.budget();
    return { hash: hashEscaleta(s), etapa, costoUsd: est.maximoUsd, maximo: est.maximo, topeUsd: tope, topeMesUsd: esCarrusel(s) ? conf().topeMesCarruselesUsd : null, estudio: { dailyBudget: b.dailyBudget, monthlyBudget: b.monthlyBudget, limit: b.limit },
      cabe: est.maximo <= disponible && (!esCarrusel(s) || est.maximo <= usd2u(conf().topeMesCarruselesUsd) - usd2u(gastoMes(mesClave()))), disponibleUsd: u2usd(Math.max(0, disponible)),
      reintentos: conf().reintentosMax, inciertos: almacen.todas().reduce((n, x) => n + Object.values(x.libro?.lineas || {}).filter(l => l.estado === 'incierto').length, 0) };
  }
  const textoConfirmar = (s, c) => {
    const n = c.etapa.length, r = c.reintentos, s2 = r === 1 ? '' : 's';
    const base = `Generar ${n} plano${n === 1 ? '' : 's'} de «${s.titulo}»: gasta hasta US$${c.costoUsd} (tope de la serie US$${c.topeUsd}; incluye hasta ${r} reintento${s2} por plano en los motores gratis: en uno de pago un fallo dudoso no se repite solo, se pausa).`;
    const k = c.inciertos, pl = k === 1 ? '' : 's';
    return base + (k ? ` OJO: hay ${k} paso${pl} incierto${pl} que pudo${k === 1 ? '' : 'ieron'} cobrarse y el tope diario y mensual del Estudio no lo ve: decídelo${pl === '' ? '' : 's'} antes.` : '');
  };
  function emitir(s, c, modo) {
    const reg = { ...emitirToken({ serieId: s.id, hash: c.hash, topeMax: c.topeUsd, costoMostrado: c.costoUsd, ahora: ahora(), nonce: nonce(), ttlMs }), modo, topeMesUsd: c.topeMesUsd, estudio: c.estudio, inciertos: c.inciertos };
    let aviso = null;
    const x = almacen.actualizar(s.id, y => { y.token_reg = reg; if (y.estado === 'previsto') { const t = transicion(y, 'espera_ok'); if (!t.ok) { aviso = t.motivo; return undefined; } return t.serie; } return y; });
    if (aviso || !x) return null;
    return { token: reg.token, serieId: s.id, hash: c.hash, costoMostradoUsd: c.costoUsd, topeUsd: c.topeUsd, modo, planos: c.etapa.length, inciertos: c.inciertos, vence: reg.vence, texto: textoConfirmar(s, c) };
  }

  /** El clic del dueño. SÍNCRONA de principio a fin: dos a la vez no pueden pasar los dos con el mismo token. */
  function generar({ id, confirmacion, costoMostradoUsd, modo = 'muestra', por = 'dueno' } = {}) {
    if (por !== 'dueno') return err(403, 'Generar una serie gasta: solo el clic del dueño (no un agente, ni Dimitri, ni un MCP).');
    if (!activo()) return err(409, 'Generar series está apagado (office.config.json → dimitri.serieGenerar).');
    if (modo !== 'muestra' && modo !== 'todo') return err(422, 'El modo es «muestra» (probar con 3) o «todo».');
    const s = almacen.uno(typeof id === 'string' ? id : ''); if (!s) return err(404, 'No encuentro esa serie.');
    if (!['previsto', 'espera_ok', 'pausado', 'muestra'].includes(s.estado)) return err(409, `Una serie ${s.estado} no se genera.`, { codigo: 'estado' });
    if (s.escaleta.some(p => p.estado === 'corriendo')) return err(409, 'Hay un plano en marcha: espera a que termine y vuelve a pedirlo.', { codigo: 'en_marcha' });
    const bl = biblia.leer(); if (!bl?.existe || bl.estado !== 'aprobada' || bl.version !== s.biblia_version) return err(409, `La biblia visual vigente ya no es la v${s.biblia_version} de esta serie: cambiarla exige reanclar la serie antes de gastar.`, { codigo: 'biblia' });
    const c = calcular(s, modo); if (c.error) return err(409, c.motivo, { codigo: c.error });
    if (!(c.topeUsd > 0)) return err(409, 'El tope de la serie es 0: súbelo en Ajustes antes de generar.', { codigo: 'tope', topeUsd: c.topeUsd });
    if (!c.cabe) {
      const m = `El costo máximo (US$${c.costoUsd}) no cabe en lo que queda del tope de la serie (US$${c.disponibleUsd} de US$${c.topeUsd}): baja planos, usa un modelo más barato o sube el tope.`;
      return err(409, m, { codigo: 'tope', costoActualUsd: c.costoUsd, topeUsd: c.topeUsd, disponibleUsd: c.disponibleUsd });
    }
    if (!confirmacion) { const e = emitir(s, c, modo); return e ? { estado: 200, cuerpo: { confirmar: e, gasta: false, nota: 'Todavía no se gastó nada: confirma ESTA cifra para empezar.' } } : err(409, 'No se pudo preparar la confirmación.', { codigo: 'transicion' }); }
    const reg = s.token_reg, nuevo = (codigo, motivo) => { const e = emitir(s, c, modo); return err(409, motivo, { codigo, costoActualUsd: c.costoUsd, topeUsd: c.topeUsd, ...(e ? { confirmar: e } : {}), gasta: false }); };
    if (!reg) return err(409, 'Primero pide el clic: el token sale con la cifra a la vista.', { codigo: 'token' });
    let v = verificarToken(reg, { token: String(confirmacion), serieId: s.id, hash: c.hash, topeMax: c.topeUsd, costoActual: c.costoUsd }, ahora());
    if (v.ok && reg.modo !== modo) v = { ok: false, codigo: 'modo', motivo: 'el modo no es el que se mostró' };
    if (v.ok && (reg.topeMesUsd !== c.topeMesUsd || JSON.stringify(reg.estudio) !== JSON.stringify(c.estudio))) v = { ok: false, codigo: 'tope', motivo: 'los topes del Estudio o del mes no son los que se mostraron' };
    if (v.ok && reg.inciertos !== c.inciertos) v = { ok: false, codigo: 'incierto', motivo: 'cambió el número de pasos inciertos que se mostró' };
    if (v.ok && Number(costoMostradoUsd) !== reg.costoMostrado) v = { ok: false, codigo: 'costo', motivo: 'la cifra que confirmas no es la que se mostró' };
    if (!v.ok) return ['hash', 'tope', 'costo', 'vencido', 'modo', 'incierto'].includes(v.codigo) ? nuevo(v.codigo, `${v.motivo}. Ahora costaría hasta US$${c.costoUsd} (tope US$${c.topeUsd}); hace falta otro clic sobre esa cifra.`) : err(409, v.motivo, { codigo: v.codigo, gasta: false });
    // todo o nada, en UNA escritura: consumir el token, autorizar y pasar de estado
    let falla = null;
    const g = almacen.actualizar(s.id, y => {
      const auth = { ok: true, serieId: y.id, hash: c.hash, topeMax: c.topeUsd }, t = []; let cur = { ...y, token_reg: consumirToken(reg), libro: y.libro || nuevoLibro(c.topeUsd), pausa_motivo: null, muestra_lista: false };
      const ir = a => { const r = transicion(cur, a, { autorizacion: auth }); if (!r.ok) throw Object.assign(new Error(r.motivo), { codigo: r.codigo }); cur = r.serie; t.push(a); };
      try { if (cur.estado !== 'muestra') ir('muestra'); if (modo === 'todo') ir('corriendo'); } catch (e) { falla = e; return undefined; }
      return { ...cur, autorizado: { hash: c.hash, topeMax: c.topeUsd, serieId: y.id, en: ahora(), modo, topeMesUsd: c.topeMesUsd } };
    });
    if (falla) return err(409, falla.message, { codigo: falla.codigo || 'transicion' });
    auditar({ kind: 'serie', accion: 'generar', serie: s.id, modo, hash: c.hash, costoMostradoUsd: c.costoUsd, topeUsd: c.topeUsd, planos: c.etapa.length });
    setImmediate(() => tick().catch(() => {}));
    return { estado: 200, cuerpo: { serie: vistaSerie(g), gasta: true, autorizado: { costoMaximoUsd: c.costoUsd, topeUsd: c.topeUsd, planos: c.etapa.length, modo }, nota: 'Autorizado: la serie empieza. Se pausa sola al llegar a un tope o si algo falla.' } };
  }

  // ---- la bomba ----
  const pausar = (id, motivo) => { // pausar quita la autorización: seguir exige otro clic del dueño
    let pausada = false;
    almacen.actualizar(id, y => { if (!['muestra', 'corriendo'].includes(y.estado)) return undefined; pausada = true; return { ...y, estado: 'pausado', pausa_motivo: String(motivo).slice(0, 300), autorizado: null, token_reg: null }; });
    if (pausada) auditar({ kind: 'serie', accion: 'pausa', serie: id, motivo: String(motivo).slice(0, 200) });
  };
  const planoA = (y, n, f) => { const i = y.escaleta.findIndex(p => p.n === n); if (i >= 0) y.escaleta[i] = f(y.escaleta[i]); return y; };
  function fallaPlano(id, n, motivo) { almacen.actualizar(id, y => planoA(y, n, p => ({ ...p, estado: 'revisar', motivo: String(motivo).slice(0, 300) }))); pausar(id, `el plano ${n} no se pudo generar: ${motivo}`); }

  async function iniciar(s, paso) {
    const n = paso.n, p = s.escaleta.find(x => x.n === n), id = s.id;
    const caps = capsDe(p.modelo); if (!caps) return fallaPlano(id, n, `el modelo ${p.modelo || 'ninguno'} está apagado o ya no existe`);
    if (p.refs.length > (caps.maxRefs ?? 0)) return fallaPlano(id, n, `lleva ${p.refs.length} referencias y ${p.modelo} admite ${caps.maxRefs || 0}; no se recorta en silencio`);
    const falta = p.refs.find(r => !existeRef(r)); if (falta) return fallaPlano(id, n, `la referencia ${falta} ya no está en la galería`);
    const b = precioSeguro(precioPlano(p.modelo, p.ajustes)); if (!b) return pausar(id, `no hay un precio fiable para el plano ${n}`);
    const rev = reservaRev(), precio = rev ? { ...b, qa: (b.qa ?? 0) + rev.qa, vision: (b.vision ?? 0) + rev.vision } : b;
    const maxUsd = u2usd(costoPlano(precio)), genUsd = u2usd(costoPlano({ generacion: b.generacion }));
    try { media.checkBudget(maxUsd); } catch (e) { return pausar(id, String(e?.message || e)); } // día o mes del Estudio (Ajustes → Estudio): nada se reserva ni se envía
    const dia0 = hoy(), dia = { limit: media.budget().limit, usadoSeries: almacen.usoDe(dia0), config: conf() }, mes = esCarrusel(s) ? { topeUsd: conf().topeMesCarruselesUsd, gastadoUsd: gastoMes(mesClave()) } : undefined;
    let sin = null, clave = null;
    const r = almacen.actualizar(id, y => {
      if (!autorizacionDe(y) || !['muestra', 'corriendo'].includes(y.estado)) { sin = { motivo: 'la serie ya no está autorizada' }; return undefined; }
      const intento = (y.intentos[n] || 0) + 1; clave = claveIdempotencia(id, n, intento); // contador MONÓTONO: una clave liberada nunca se reutiliza
      const libro = { ...(y.libro || nuevoLibro(topeDe(y))) }; libro.tope = Math.min(libro.tope, usd2u(topeDe(y)));
      const rs = reservar(libro, clave, maxUsd, { mes, dia, kind: 'image', n: 1 }); if (!rs.ok) { sin = { motivo: rs.motivo }; return undefined; }
      y.libro = rs.libro; y.intentos[n] = intento; y.pasos[clave] = { n, intento, estado: 'reservado', maxUsd, genUsd, mes: mesClave(), dia: dia0, envio: ahora(), job: null, engine: media.models?.().find(m => m.id === p.modelo)?.engine || null, modelo: p.modelo };
      return planoA(y, n, q => ({ ...q, estado: 'corriendo', intento_actual: intento }));
    });
    if (!r || sin) return pausar(id, sin?.motivo || 'no se pudo reservar');
    almacen.sumarUso(dia0, 1);
    // el paso YA está apuntado en disco (reserva + clave): ahora sí se llama al motor
    let j = null, rechazo = null;
    try {
      const aj = p.ajustes && typeof p.ajustes === 'object' ? { ...p.ajustes } : {}; if (p.semilla != null) aj.seed = p.semilla;
      j = media.submit({ prompt: p.prompt_exacto, model: p.modelo, kind: 'image', n: 1, settings: aj, media: p.refs.length ? { reference: p.refs } : {}, by: 'dimitri', serie: { id, n, intento: (r.intentos[n] || 1) }, purpose: `Serie «${s.titulo}» · plano ${n}` });
    } catch (e) { rechazo = e; }
    if (rechazo) { // el Estudio lo rechazó ANTES de enviar nada: se sabe seguro, se devuelve la reserva y el plano vuelve a la fila
      almacen.actualizar(id, y => { const l = liberar(y.libro, clave); if (l.ok) y.libro = l.libro; if (y.pasos[clave]) y.pasos[clave].estado = 'liberado'; return planoA(y, n, q => ({ ...q, estado: 'previsto' })); });
      almacen.sumarUso(dia0, -1); return pausar(id, `el Estudio no aceptó el plano ${n}: ${String(rechazo.message || rechazo)}`);
    }
    almacen.actualizar(id, y => { if (y.pasos[clave]) { y.pasos[clave].job = j.id; y.pasos[clave].estado = 'enviado'; } return y; });
    auditar({ kind: 'serie', accion: 'envio', serie: id, n, intento: clave.split(':').pop(), job: j.id, maxUsd });
  }

  /** Lo que estaba en el aire: se resuelve a partir de los TRABAJOS del Estudio, sin enviar nada nuevo. Idempotente: se puede llamar cuantas veces haga falta. */
  function reconciliar() {
    if (candado && !candado.tener()) return 0; // otro proceso lleva la bomba (y las cuentas) de este data/
    let cambios = 0;
    for (const s0 of almacen.todas()) for (const p0 of s0.escaleta) {
      if (p0.estado !== 'corriendo') continue;
      const clave = p0.intento_actual ? claveDe(s0, p0) : null, paso = clave ? s0.pasos[clave] : null;
      let j = null;
      if (paso) j = paso.job ? media.job(paso.job) : (media.jobs?.() || []).find(x => x.serie?.id === s0.id && x.serie?.n === p0.n && x.serie?.intento === paso.intento) || null;
      if (paso && j && !paso.job) almacen.actualizar(s0.id, y => { y.pasos[clave].job = j.id; y.pasos[clave].estado = 'enviado'; return y; }); // se cayó entre enviar y apuntar el trabajo: se adopta por su marca
      if (j && (j.state === 'queued' || j.state === 'running')) continue;
      let pausa = null, devolverUso = 0, devolverDia = null;
      almacen.actualizar(s0.id, y => {
        const n = p0.n, pa = clave ? y.pasos[clave] : null; let libro = y.libro;
        const liq = real => { const r = liquidar(libro, clave, real); if (r.ok) libro = r.libro; return r.ok && libro.lineas[clave].excedio; };
        const lib = () => { const r = liberar(libro, clave); if (r.ok) libro = r.libro; };
        const dudoso = () => { const r = marcarIncierto(libro, clave); if (r.ok) libro = r.libro; };
        const pagado = pagadoDe(pa?.engine); // sin motor conocido = de pago
        const volver = (est, mot) => planoA(y, n, q => ({ ...q, estado: est, motivo: mot || null }));
        const reintento = () => { y.fallos[n] = (y.fallos[n] || 0) + 1; return y.fallos[n] <= conf().reintentosMax; };
        if (!paso || !pa) { volver('previsto'); } // sin paso apuntado no se reservó nada
        else if (!j && !pa.job) { lib(); pa.estado = 'liberado'; volver('previsto'); devolverUso = 1; devolverDia = pa.dia; } // se cayó ANTES de llamar al motor: nunca salió
        else if (!j) {
          if (pagado) { dudoso(); pa.estado = 'incierto'; volver('revisar', 'puede haberse cobrado: el trabajo ya no aparece en el Estudio'); pausa = `el plano ${n} puede haberse cobrado y no se sabe cómo acabó: decide si hubo cobro`; }
          else { lib(); pa.estado = 'liberado'; volver('previsto'); }
        }
        else if (j.state === 'done' && j.items?.length) {
          // en pago, un «hecho» sin costo no borra el gasto: como mínimo se liquida lo estimado para generar
          const real = pagado ? (j.cost > 0 ? j.cost : (pa.genUsd ?? 0)) : Math.max(0, +j.cost || 0), exc = liq(real);
          pa.estado = 'liquidado'; pa.realUsd = real;
          planoA(y, n, q => ({ ...nuevaVersion({ ...q, estado: 'corriendo' }, { archivo: j.items[0], intento: pa.intento, costo_usd: real, prompt: q.prompt_exacto }), motivo: null }));
          if (exc) pausa = `el plano ${n} costó más de lo reservado: revisa antes de seguir`;
        } else { // fallido: la CAUSA estructurada que pone el Estudio (nunca el texto del error). En un motor de PAGO, todo lo que no sea claramente previo al cobro queda «incierto»
          const causa = j.causa || '', clase = j.errorClass || '', aceptado = !!j.remote || j.aceptado === true; // `remote` o `aceptado` = el proveedor ya tomó el pedido: nunca es previo al cobro
          const previo = (causa === 'previo' || causa === 'cancelado_en_cola') && !aceptado;
          if (pagado && !previo) { dudoso(); pa.estado = 'incierto'; volver('revisar', `puede haberse cobrado (${causa || 'causa desconocida'}): decide si hubo cobro`); pausa = `el plano ${n} puede haberse cobrado y no se sabe cómo acabó: decide si hubo cobro`; }
          else {
            lib(); pa.estado = 'liberado';
            if (causa === 'cancelado' || causa === 'cancelado_en_cola' || causa === 'interrumpido' || y.cancelada) volver('previsto'); // gratis (o cancelado antes de salir): se repite sin contar como fallo
            else if (PARA_PAUSAR.has(clase)) { volver('previsto'); pausa = j.error || 'sin saldo o sin key en el motor'; }
            else if (TRANSITORIAS.has(clase) && reintento()) volver('previsto');
            else { volver('revisar', j.error || 'falló'); pausa = `el plano ${n} falló: ${j.error || 'sin motivo'}`; }
          }
        }
        cambios++; return { ...y, libro };
      });
      if (devolverUso) almacen.sumarUso(devolverDia || hoy(), -devolverUso);
      if (pausa) pausar(s0.id, pausa);
    }
    return cambios;
  }

  let enCurso = null, timer = null;
  async function avanzar() {
    if (candado && !candado.tener()) return; // otro proceso lleva la bomba de este data/
    if (!activo()) { // apagar el flag PAUSA lo que corría (sin plano en el aire): al volver a encenderlo no se reanuda con una autorización vieja, hace falta otro clic
      for (const x of almacen.todas()) if ((x.estado === 'muestra' || x.estado === 'corriendo') && !x.escaleta.some(p => p.estado === 'corriendo')) pausar(x.id, 'generar series se apagó (dimitri.serieGenerar): vuelve a pedir el clic para seguir');
      return;
    }
    if (enVuelo() >= concurrencia) return;
    // una serie con la muestra lista espera TU decisión: no debe quitarle el turno a las demás
    const s = almacen.todas().filter(x => x.estado === 'corriendo' || (x.estado === 'muestra' && !x.muestra_lista)).sort((a, b) => a.creada - b.creada)[0]; if (!s) return;
    if (s.autorizado && ahora() - s.autorizado.en > autorizacionMs) { if (!s.escaleta.some(p => p.estado === 'corriendo')) pausar(s.id, 'la autorización caducó (pasaron más de 6 horas): vuelve a pedir el clic para seguir'); return; }
    const sinPrevistos = !s.escaleta.some(p => p.estado === 'previsto');
    if (sinPrevistos) { // no queda nada por generar: la serie termina (la muestra pasa por «corriendo» con la misma autorización)
      if (s.escaleta.some(p => p.estado === 'corriendo')) return;
      almacen.actualizar(s.id, y => {
        let cur = y;
        if (cur.estado === 'muestra') { const r = transicion(cur, 'corriendo', { autorizacion: autorizacionDe(y) }); if (!r.ok) return undefined; cur = r.serie; }
        const h = transicion(cur, 'hecho');
        return h.ok ? { ...h.serie, autorizado: null, token_reg: null, fin: ahora() } : undefined;
      });
      return void auditar({ kind: 'serie', accion: 'hecha', serie: s.id });
    }
    const paso = siguientePaso(s, { autorizacion: autorizacionDe(s) });
    if (paso.tipo === 'gasto') return iniciar(s, paso);
    if (paso.codigo === 'sin_autorizacion') return pausar(s.id, 'la escaleta cambió desde que autorizaste: revísala y vuelve a pedir el clic');
    if (paso.codigo === 'muestra_lista' && !s.muestra_lista) { almacen.actualizar(s.id, y => ({ ...y, muestra_lista: true })); auditar({ kind: 'serie', accion: 'muestra_lista', serie: s.id }); }
  }
  async function tick() {
    if (enCurso) return enCurso;
    enCurso = (async () => { try { reconciliar(); await avanzar(); } finally { enCurso = null; } })();
    return enCurso;
  }
  /** Al arrancar la oficina: RECONCILIA (adopta y liquida lo que estaba en el aire) pero NO lanza planos nuevos: toda serie que estaba generando pasa a «pausada» y el dueño da un clic nuevo (token nuevo). */
  function alArrancar() {
    if (candado && !candado.tener()) return;
    reconciliar();
    for (const x of almacen.todas()) if (x.estado === 'muestra' || x.estado === 'corriendo') pausar(x.id, 'la oficina se reinició: vuelve a pedir el clic para seguir (lo que estaba en el aire se revisó sin enviar nada nuevo)');
  }
  const iniciarBomba = () => { alArrancar(); if (!timer) { timer = setInterval(() => tick().catch(e => console.warn('serie tick:', e.message)), intervalo); timer.unref?.(); } setImmediate(() => tick().catch(() => {})); };
  const pararBomba = () => { if (timer) clearInterval(timer); timer = null; };

  /** Cancelar: lo que va en el aire se pide cancelar al Estudio y se liquida solo (lo no enviado nunca se reservó). */
  function alCancelar(s) { for (const p of s.escaleta) if (p.estado === 'corriendo') { const x = s.pasos[p.intento_actual ? claveDe(s, p) : '']; if (x?.job) try { media.cancel(x.job); } catch { /* ya terminó */ } } }

  /** Decisión del dueño sobre un paso «incierto»: ¿hubo cobro? Solo contabilidad: no gasta ni reanuda nada. */
  function resolver({ id, clave, cobro, realUsd = 0, por = 'dueno' } = {}) {
    if (por !== 'dueno') return err(403, 'Decidir si hubo un cobro es del dueño.');
    if (typeof cobro !== 'boolean') return err(422, 'Di si hubo cobro (true o false).');
    const serie0 = almacen.uno(typeof id === 'string' ? id : ''), linea = serie0?.libro?.lineas && Object.hasOwn(serie0.libro.lineas, String(clave || '')) ? serie0.libro.lineas[String(clave)] : null;
    if (cobro && realUsd !== undefined && realUsd !== 0) { // lo que el dueño dice que se cobró: número finito, no negativo y no más de lo reservado para ese paso
      if (typeof realUsd !== 'number' || !Number.isFinite(realUsd) || realUsd < 0) return err(422, 'El cobro real debe ser un número finito, 0 o más.');
      if (linea && usd2u(realUsd) > linea.max) return err(422, `El cobro real (US$${realUsd}) pasa de lo reservado para ese paso (US$${u2usd(linea.max)}).`);
    }
    let fallo = null;
    const x = almacen.actualizar(typeof id === 'string' ? id : '', y => { const r = resolverIncierto(y.libro || nuevoLibro(1), String(clave || ''), cobro, realUsd); if (!r.ok) { fallo = r; return undefined; }
      y.libro = r.libro; const pa = y.pasos[clave]; if (pa) { pa.estado = cobro ? 'liquidado' : 'liberado'; } const n = pa?.n; return n ? planoA(y, n, q => (q.estado === 'revisar' && !cobro ? { ...q, estado: 'previsto', motivo: null } : q)) : y; });
    if (!x) return err(404, 'No encuentro esa serie.'); if (fallo) return err(409, fallo.motivo, { codigo: fallo.codigo });
    auditar({ kind: 'serie', accion: 'resolver', serie: id, clave, cobro });
    return { estado: 200, cuerpo: { serie: vistaSerie(x) } };
  }
  return { generar, resolver, tick, reconciliar, alArrancar, iniciar: iniciarBomba, parar: pararBomba, alCancelar, calcular };
}
