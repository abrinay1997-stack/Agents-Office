// Series en la nube, N4 (carril K): AUTORIZAR y la BOMBA DEL RELOJ. AQUÍ SE DECIDE GASTAR, así que cada paso tiene su candado. Es el puerto a D1 del generador de la oficina local:
// las DECISIONES son las mismas funciones puras (series-bomba-core.mjs: planificarPaso, cerrarSerie, decidirResolucion; serie-core.mjs: token, hash, siguientePaso) y lo que cambia es dónde
// vive el estado: la serie en una fila con versión (almacen.js, compare-and-set), el dinero en series_libro (libro.js, una sentencia atómica) y el token en series_tokens.
// REGLA DEL DINERO (§3): nada gasta sin el clic del dueño ni por encima de sus topes; el costo mostrado ES el que se gasta; ni un agente, ni Dimitri, ni un MCP llegan aquí.
//   1. presupuesto: NO cambia nada que gaste. Recalcula (hash de la escaleta, costo máximo de lo que falta, topes) y emite un TOKEN de un solo uso (2 min) atado a ese hash, a esa cifra,
//      a los topes, al modo y al número de pasos inciertos. La serie pasa a «espera_ok».
//   2. generar (con Idempotency-Key): vuelve a calcular TODO en el servidor. Si algo cambió (o venció): 409 con la cifra nueva y un token nuevo. Si coincide, el token se CONSUME (un DELETE
//      que solo una petición gana) y se autoriza en UNA escritura con versión. La autorización dura 6 h y queda atada a quién la dio: si esa cuenta deja de ser administradora, la bomba pausa.
//   3. la bomba (`tick`, en el reloj de cada minuto, con el candado global «series:bomba»): primero RECONCILIA lo que quedó en el aire (por el id determinista del trabajo; sin trabajo y con
//      «pedido enviado» = incierto, NUNCA se libera), luego da UN paso. Orden de cada paso de gasto: marcar (CAS) → reservar (sentencia atómica con los tres topes) → pedir → confirmar → liquidar.
//      Antes de CADA paso se vuelven a leer el interruptor, la autorización, el hash y el rol de quien autorizó.
// Motores de PAGO: en este PR la bomba solo acepta los gratis (`prueba`, `local`): todo lo demás se rechaza ANTES de enviar. Abrir los de pago es N5 (otro PR, con su revisión) y se hace con `permitirPago`.
import { transicion, emitirToken, verificarToken, hashEscaleta, claveIdempotencia, estimarSerie, costoPlano, nuevaVersion, siguientePaso, sha256, CONFIG_SERIE, u2usd, usd2u, cupoSerieDia } from '../../../../serie-core.mjs';
import { MUESTRA, pagadoDe, AUTORIZACION_MS, esCarrusel, autorizacionDe, planificarPaso, cerrarSerie, decidirResolucion, cablearMedia, configDeAjustes, TRANSITORIAS } from '../../../../series-bomba-core.mjs';
import { precioSeguro, costoRevisionSeguro } from '../../../../serie-propuesta-core.mjs';
import { weightOf } from '../../../../estudio-pesos.mjs';
import * as catalogo from '../../../../media/catalogo.mjs';
import { leerCfg } from '../ajustes.js';
import { candados } from '../tokens.js';
import { tokensSerie } from './tokens.js';
import { prepararEstudio } from '../estudio/entorno.js';
import * as trabajos from '../estudio/trabajos.js';
import * as galeria from '../estudio/galeria.js';
import { crearAlmacenD1 } from './almacen.js';
import { seriesNubeActiva } from './flags.js';
import { leerBiblia } from './biblia.js';
import * as L from './libro.js';

export { MUESTRA, AUTORIZACION_MS };
export const MAX_REPETICIONES = 3; // un plano cuyo trabajo termina «cancelado» o «interrumpido» se repite sin contar como fallo… hasta este tope; luego queda para revisar y la serie se pausa
export const GRACIA_MS = 5 * 60e3; // un plano marcado que nunca llegó a pedir su trabajo se da por caído solo pasado este tiempo (así una bomba lenta no choca con la siguiente)
export const CANDADO = 'series:bomba';
const TTL_TOKEN_MS = 120000, TTL_IDEM_MS = 600000, TTL_CANDADO_MS = 90000;
const err = (estado, error, extra = {}) => ({ estado, cuerpo: { error, ...extra } });
const IDEM_OK = /^[A-Za-z0-9_-]{8,64}$/;
const azarHex = (n = 32) => { const b = new Uint8Array(n / 2); crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };
/** El id del trabajo del Estudio de un paso: sale de su clave de idempotencia (el mismo paso es siempre el mismo trabajo). Cumple /^j[a-z0-9]{4,30}$/. */
export const idDeTrabajo = (clave) => `j${sha256(`serie:${clave}`).slice(0, 24)}`;
const claveIdem = (serieId, key) => `i${sha256(`${serieId}:${key}`).slice(0, 40)}`;

/** Las dependencias de verdad (producción). Las pruebas pasan las suyas: un reloj, un Estudio de mentira, un catálogo con un motor «de pago» simulado. */
export function depsReales(env, db) {
  return {
    ahora: () => Date.now(),
    nonce: () => azarHex(32),
    dia: () => galeria.diaLocal(Date.now(), galeria.ZONA(env)),
    cfg: () => leerCfg(db),
    cable: async () => { await prepararEstudio(env, db); return cablearMedia(catalogo); }, // enciende en el catálogo los motores según los secretos (solo datos)
    engineDe: (id) => catalogo.model(id)?.engine ?? null,
    permitirPago: () => false, // N4: los motores de pago NO se abren (N5, otro PR)
    estudio: {
      budget: () => trabajos.budget(env, db),
      checkBudget: (usd) => trabajos.checkBudget(env, db, usd),
      pedir: (req, op) => trabajos.pedir(env, db, req, op),
      trabajo: (id) => trabajos.job(db, id),
      cancelar: (id) => trabajos.cancel(env, db, id),
    },
    biblia: () => leerBiblia(db),
    costoRevision: () => null, // sin revisión por visión en la nube todavía
    rolDe: async (uid) => (await db.prepare('select rol from users where id = ?').bind(String(uid)).first())?.rol ?? null,
    auditar: (accion, detalle) => db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'serie', String(detalle?.por || 'bomba').slice(0, 80), JSON.stringify({ accion, ...detalle })).run(),
  };
}

export function crearGenerador(env, db, deps = depsReales(env, db), { autorizacionMs = AUTORIZACION_MS } = {}) {
  const d = deps, almacen = crearAlmacenD1(db, { ahora: d.ahora }), tokens = tokensSerie(db, { ahora: d.ahora }), cands = candados(db, { ahora: d.ahora });
  const auditar = async (a, x) => { try { await d.auditar(a, x); } catch { /* auditar no tumba el paso */ } };
  const confDe = (cfg) => ({ ...CONFIG_SERIE, ...configDeAjustes(cfg?.dimitri) });
  const topeDe = (s, conf) => Math.min(s.tope_usd ?? conf.topeSerieUsd, conf.topeSerieUsd); // bajar el tope en Ajustes aplica; subirlo no abre lo ya propuesto
  const reservaRev = () => costoRevisionSeguro(d.costoRevision());
  const conRev = (b, rev) => (b && rev ? { ...b, qa: (b.qa ?? 0) + rev.qa, vision: (b.vision ?? 0) + rev.vision } : b);
  const engineDePlano = (p) => d.engineDe(p.modelo);
  const hayPago = (planos) => planos.find((p) => pagadoDe(engineDePlano(p)) && !d.permitirPago());

  /** Lo que se mostraría y se gastaría AHORA para esta etapa (la muestra o todo lo que falta). */
  async function calcular(s, modo, cfg) {
    const conf = confDe(cfg), cable = await d.cable();
    const hechos = s.escaleta.filter((p) => p.estado === 'listo' || p.estado === 'revisar').length, previstos = s.escaleta.filter((p) => p.estado === 'previsto');
    const etapa = modo === 'muestra' ? previstos.slice(0, Math.max(0, MUESTRA - hechos)) : previstos;
    if (!etapa.length) return { error: 'nada', motivo: previstos.length ? `la muestra de ${MUESTRA} planos ya está lista: revísala y sigue con «generar todas»` : 'no quedan planos por generar' };
    const pago = hayPago(etapa); if (pago) return { error: 'motor_pago', motivo: `el plano ${pago.n} usa un motor de pago (${engineDePlano(pago) || 'desconocido'}) y generar con motores de pago todavía no está abierto en la nube: usa uno gratis o hazlo en la oficina de tu computadora` };
    const rev = reservaRev(), precios = etapa.map((p) => conRev(precioSeguro(cable.precioPlano(p.modelo, p.ajustes)), rev));
    if (!precios.every(Boolean)) return { error: 'precio', motivo: 'no se pudo calcular el precio de algún plano con un motor fiable: no se muestra un costo falso y no se genera' };
    const est = estimarSerie(precios, conf), tope = topeDe(s, conf), q = await L.resumenDeSerie(db, s.id), b = await d.estudio.budget();
    const disponible = usd2u(tope) - q.reservado - q.gastado - q.incierto, carrusel = esCarrusel(s), mes = String(d.dia()).slice(0, 7);
    const cabeMes = !carrusel || est.maximo <= usd2u(conf.topeMesCarruselesUsd) - (await L.gastoDelMes(db, mes));
    return { hash: hashEscaleta(s), etapa, costoUsd: est.maximoUsd, maximo: est.maximo, topeUsd: tope, topeMesUsd: carrusel ? conf.topeMesCarruselesUsd : null, estudio: { dailyBudget: b.dailyBudget, monthlyBudget: b.monthlyBudget, limit: b.limit },
      cabe: est.maximo <= disponible && cabeMes, disponibleUsd: u2usd(Math.max(0, disponible)), reintentos: conf.reintentosMax, inciertos: (await L.inciertos(db)).length, conf, cable };
  }
  const textoConfirmar = (s, c) => {
    const n = c.etapa.length, r = c.reintentos, k = c.inciertos;
    const base = `Generar ${n} plano${n === 1 ? '' : 's'} de «${s.titulo}»: gasta hasta US$${c.costoUsd} (tope de la serie US$${c.topeUsd}; incluye hasta ${r} reintento${r === 1 ? '' : 's'} por plano en los motores gratis: en uno de pago un fallo dudoso no se repite solo, se pausa).`;
    return base + (k ? ` OJO: hay ${k} paso${k === 1 ? '' : 's'} incierto${k === 1 ? '' : 's'} que pudo${k === 1 ? '' : 'ieron'} cobrarse y el tope diario y mensual del Estudio no lo ve: decídelo${k === 1 ? '' : 's'} antes.` : '');
  };
  async function emitir(s, c, modo, por) {
    const reg = { ...emitirToken({ serieId: s.id, hash: c.hash, topeMax: c.topeUsd, costoMostrado: c.costoUsd, ahora: d.ahora(), nonce: d.nonce(), ttlMs: TTL_TOKEN_MS }), modo, topeMesUsd: c.topeMesUsd, estudio: c.estudio, inciertos: c.inciertos, por };
    let aviso = null;
    const x = await almacen.actualizar(s.id, (y) => { y.token_actual = reg.token; if (y.estado === 'previsto') { const t = transicion(y, 'espera_ok'); if (!t.ok) { aviso = t.motivo; return undefined; } return t.serie; } return y; });
    if (aviso || !x) return null;
    await tokens.poner(reg.token, reg, reg.vence);
    return { token: reg.token, serieId: s.id, hash: c.hash, costoMostradoUsd: c.costoUsd, topeUsd: c.topeUsd, modo, planos: c.etapa.length, inciertos: c.inciertos, vence: reg.vence, texto: textoConfirmar(s, c) };
  }
  const motivosGenerales = async (s, id, cfg, modo) => {
    if (!seriesNubeActiva(cfg)) return err(409, 'Generar series en la nube está apagado (dimitri.seriesNube).');
    if (modo !== 'muestra' && modo !== 'todo') return err(422, 'El modo es «muestra» (probar con 3) o «todo».');
    if (!s) return err(404, 'No encuentro esa serie.');
    if (!['previsto', 'espera_ok', 'pausado', 'muestra'].includes(s.estado)) return err(409, `Una serie ${s.estado} no se genera.`, { codigo: 'estado' });
    if (s.escaleta.some((p) => p.estado === 'corriendo')) return err(409, 'Hay un plano en marcha: espera a que termine y vuelve a pedirlo.', { codigo: 'en_marcha' });
    const bl = await d.biblia(); if (!bl?.existe || bl.estado !== 'aprobada' || bl.version !== s.biblia_version) return err(409, `La biblia visual vigente ya no es la v${s.biblia_version} de esta serie: cambiarla exige reanclar la serie antes de gastar.`, { codigo: 'biblia' });
    return null;
  };

  /** Paso 1: la cifra a la vista y el token. NO gasta ni reserva nada. */
  async function presupuesto({ id, modo = 'muestra', usuario } = {}) {
    if (!usuario || usuario.rol !== 'admin' || usuario.agente) return err(403, 'Generar una serie gasta: solo el clic del dueño o de un administrador (no un agente, ni Dimitri, ni un MCP).');
    const cfg = await d.cfg(), s = await almacen.uno(typeof id === 'string' ? id : '');
    const no = await motivosGenerales(s, id, cfg, modo); if (no) return no;
    const c = await calcular(s, modo, cfg); if (c.error) return err(409, c.motivo, { codigo: c.error });
    if (!(c.topeUsd > 0)) return err(409, 'El tope de la serie es 0: súbelo en Ajustes antes de generar.', { codigo: 'tope', topeUsd: c.topeUsd });
    if (!c.cabe) return err(409, `El costo máximo (US$${c.costoUsd}) no cabe en lo que queda del tope de la serie (US$${c.disponibleUsd} de US$${c.topeUsd}) o del mes: baja planos, usa un modelo más barato o sube el tope.`, { codigo: 'tope', costoActualUsd: c.costoUsd, topeUsd: c.topeUsd, disponibleUsd: c.disponibleUsd });
    const e = await emitir(s, c, modo, usuario.id); if (!e) return err(409, 'No se pudo preparar la confirmación.', { codigo: 'transicion' });
    return { estado: 200, cuerpo: { confirmar: e, gasta: false, nota: 'Todavía no se gastó nada: confirma ESTA cifra para empezar.' } };
  }

  /** Paso 2: el clic con la cifra. Todo se recalcula aquí; el token se consume UNA vez. `continuar` es lo mismo con modo «todo». */
  async function generar({ id, confirmacion, costoMostradoUsd, modo = 'muestra', usuario, idem, soloDesde = null } = {}) {
    if (!usuario || usuario.rol !== 'admin' || usuario.agente) return err(403, 'Generar una serie gasta: solo el clic del dueño o de un administrador (no un agente, ni Dimitri, ni un MCP).');
    if (typeof idem !== 'string' || !IDEM_OK.test(idem)) return err(422, 'Falta la cabecera Idempotency-Key (8 a 64 letras, números, guiones): un doble clic o un reintento no puede gastar dos veces.', { codigo: 'idempotencia' });
    if (typeof confirmacion !== 'string' || !confirmacion) return err(422, 'Falta la confirmación: pide primero el presupuesto (la cifra y su token).', { codigo: 'token' });
    const cfg = await d.cfg(), sid = typeof id === 'string' ? id : '', kIdem = claveIdem(sid, idem);
    const previo = await tokens.leer(kIdem); // el mismo clic repetido: se devuelve lo mismo y no se vuelve a hacer nada
    if (previo) { if (previo.token !== confirmacion || previo.serieId !== sid) return err(409, 'Esa Idempotency-Key ya se usó con otra confirmación.', { codigo: 'idempotencia' }); return { estado: 200, cuerpo: { replay: true, gasta: true, nota: 'Ese clic ya estaba hecho: no se gastó nada más.' } }; }
    const s = await almacen.uno(sid);
    if (soloDesde && s && !soloDesde.includes(s.estado)) return err(409, `Una serie ${s.estado} no se continúa así.`, { codigo: 'estado' });
    const no = await motivosGenerales(s, sid, cfg, modo); if (no) return no;
    const c = await calcular(s, modo, cfg); if (c.error) return err(409, c.motivo, { codigo: c.error });
    if (!(c.topeUsd > 0)) return err(409, 'El tope de la serie es 0: súbelo en Ajustes antes de generar.', { codigo: 'tope', topeUsd: c.topeUsd });
    if (!c.cabe) return err(409, `El costo máximo (US$${c.costoUsd}) no cabe en lo que queda del tope de la serie (US$${c.disponibleUsd} de US$${c.topeUsd}) o del mes.`, { codigo: 'tope', costoActualUsd: c.costoUsd, topeUsd: c.topeUsd, disponibleUsd: c.disponibleUsd });
    const nuevo = async (codigo, motivo) => { const e = await emitir(s, c, modo, usuario.id); return err(409, motivo, { codigo, costoActualUsd: c.costoUsd, topeUsd: c.topeUsd, ...(e ? { confirmar: e } : {}), gasta: false }); };
    const reg = await tokens.leer(confirmacion);
    if (!reg || s.token_actual !== confirmacion) return err(409, 'Esa confirmación no es la vigente: pide el presupuesto otra vez (el token es de un solo uso y vale 2 minutos).', { codigo: 'token', gasta: false });
    let v = verificarToken(reg, { token: confirmacion, serieId: s.id, hash: c.hash, topeMax: c.topeUsd, costoActual: c.costoUsd }, d.ahora());
    if (v.ok && reg.modo !== modo) v = { ok: false, codigo: 'modo', motivo: 'el modo no es el que se mostró' };
    if (v.ok && (reg.topeMesUsd !== c.topeMesUsd || JSON.stringify(reg.estudio) !== JSON.stringify(c.estudio))) v = { ok: false, codigo: 'tope', motivo: 'los topes del Estudio o del mes no son los que se mostraron' };
    if (v.ok && reg.inciertos !== c.inciertos) v = { ok: false, codigo: 'incierto', motivo: 'cambió el número de pasos inciertos que se mostró' };
    if (v.ok && Number(costoMostradoUsd) !== reg.costoMostrado) v = { ok: false, codigo: 'costo', motivo: 'la cifra que confirmas no es la que se mostró' };
    if (v.ok && reg.por !== usuario.id) v = { ok: false, codigo: 'persona', motivo: 'esa confirmación la pidió otra cuenta' };
    if (!v.ok) return ['hash', 'tope', 'costo', 'vencido', 'modo', 'incierto'].includes(v.codigo) ? nuevo(v.codigo, `${v.motivo}. Ahora costaría hasta US$${c.costoUsd} (tope US$${c.topeUsd}); hace falta otro clic sobre esa cifra.`) : err(409, v.motivo, { codigo: v.codigo, gasta: false });
    // el token se consume ANTES de autorizar: de dos clics con el mismo token solo uno lo consigue (un DELETE que cambia una fila para una sola petición)
    if (!(await tokens.tomar(confirmacion))) return err(409, 'ese token ya se usó', { codigo: 'usado', gasta: false });
    let falla = null;
    const g = await almacen.actualizar(s.id, (y) => {
      if (y.escaleta.some((p) => p.estado === 'corriendo')) { falla = { message: 'Hay un plano en marcha.', codigo: 'en_marcha' }; return undefined; }
      if (hashEscaleta(y) !== c.hash) { falla = { message: 'La escaleta cambió mientras se confirmaba: vuelve a pedir el presupuesto.', codigo: 'hash' }; return undefined; } // también si ya estaba en «muestra» (ahí no pasa por `transicion`)
      if (!['previsto', 'espera_ok', 'pausado', 'muestra'].includes(y.estado)) { falla = { message: `Una serie ${y.estado} no se genera.`, codigo: 'estado' }; return undefined; }
      const auth = { ok: true, serieId: y.id, hash: c.hash, topeMax: c.topeUsd }; let cur = { ...y, token_reg: null, token_actual: null, pausa_motivo: null, muestra_lista: false };
      const ir = (a) => { const r = transicion(cur, a, { autorizacion: auth }); if (!r.ok) throw Object.assign(new Error(r.motivo), { codigo: r.codigo }); cur = r.serie; };
      try { if (cur.estado !== 'muestra') ir('muestra'); if (modo === 'todo') ir('corriendo'); } catch (e) { falla = e; return undefined; }
      return { ...cur, autorizado: { hash: c.hash, topeMax: c.topeUsd, serieId: y.id, en: d.ahora(), modo, topeMesUsd: c.topeMesUsd, por: usuario.id } };
    });
    if (falla) return err(409, falla.message, { codigo: falla.codigo || 'transicion' });
    await tokens.poner(kIdem, { serieId: s.id, token: confirmacion }, d.ahora() + TTL_IDEM_MS);
    await auditar('generar', { por: usuario.email || usuario.id, serie: s.id, modo, hash: c.hash, costoMostradoUsd: c.costoUsd, topeUsd: c.topeUsd, planos: c.etapa.length });
    return { estado: 200, cuerpo: { gasta: true, autorizado: { costoMaximoUsd: c.costoUsd, topeUsd: c.topeUsd, planos: c.etapa.length, modo, caduca: d.ahora() + autorizacionMs }, hash: g.hash, nota: 'Autorizado: la serie empieza en el próximo minuto. Se pausa sola al llegar a un tope o si algo falla.' } };
  }

  // ---- pausar / cancelar / resolver: bajan el gasto o son contabilidad; no necesitan token ----
  async function pausar(id, motivo) { // pausar quita la autorización: seguir exige otro clic
    let pausada = false;
    await almacen.actualizar(id, (y) => { if (!['muestra', 'corriendo'].includes(y.estado)) return undefined; pausada = true; return { ...y, estado: 'pausado', pausa_motivo: String(motivo).slice(0, 300), autorizado: null, token_reg: null, token_actual: null }; });
    if (pausada) await auditar('pausa', { serie: id, motivo: String(motivo).slice(0, 200) });
    return pausada;
  }
  async function pausarPorDueno({ id, usuario }) {
    if (!usuario || usuario.rol !== 'admin' || usuario.agente) return err(403, 'Pausar una serie es de un administrador.');
    const s = await almacen.uno(typeof id === 'string' ? id : ''); if (!s) return err(404, 'No encuentro esa serie.');
    if (!(await pausar(s.id, `la pausó ${usuario.email || 'un administrador'}`))) return err(409, `Una serie ${s.estado} no está generando.`, { codigo: 'estado' });
    return { estado: 200, cuerpo: { pausada: true, nota: 'Pausada. Lo que ya iba en el aire se termina y se liquida solo; seguir pide otro clic con la cifra.' } };
  }
  async function cancelar({ id, usuario }) {
    if (!usuario || usuario.rol !== 'admin' || usuario.agente) return err(403, 'Cancelar una serie es de un administrador.');
    const s0 = await almacen.uno(typeof id === 'string' ? id : ''); if (!s0) return err(404, 'No encuentro esa serie.');
    let falla = null;
    const x = await almacen.actualizar(s0.id, (y) => { const t = transicion(y, 'cancelado'); if (!t.ok) { falla = t; return undefined; } return { ...t.serie, cancelada: true, autorizado: null, token_reg: null, token_actual: null, fin: d.ahora() }; });
    if (falla) return err(409, falla.motivo, { codigo: falla.codigo });
    const enAire = [];
    for (const p of x.escaleta) if (p.estado === 'corriendo' && p.intento_actual) { const clave = claveIdempotencia(x.id, p.n, p.intento_actual); try { await d.estudio.cancelar(idDeTrabajo(clave)); enAire.push(p.n); } catch { /* ya terminó */ } }
    await auditar('cancelar', { por: usuario.email || usuario.id, serie: x.id, enAire });
    return { estado: 200, cuerpo: { cancelada: true, enAire, nota: 'Cancelada. Lo que ya iba en el aire se pidió cancelar; lo que termine igual se liquida.' } };
  }
  async function resolver({ id, clave, cobro, realUsd = 0, usuario } = {}) {
    if (!usuario || usuario.rol !== 'admin' || usuario.agente) return err(403, 'Decidir si hubo un cobro es de un administrador.');
    if (typeof cobro !== 'boolean') return err(422, 'Di si hubo cobro (true o false).');
    const s0 = await almacen.uno(typeof id === 'string' ? id : ''); if (!s0) return err(404, 'No encuentro esa serie.');
    const linea = typeof clave === 'string' ? await L.lineaDe(db, clave) : null;
    if (!linea || linea.serie_id !== s0.id) return err(404, 'Esa línea del libro no es de esta serie.');
    if (cobro && realUsd !== undefined && realUsd !== 0) {
      if (typeof realUsd !== 'number' || !Number.isFinite(realUsd) || realUsd < 0) return err(422, 'El cobro real debe ser un número finito, 0 o más.');
      if (usd2u(realUsd) > linea.max_micro) return err(422, `El cobro real (US$${realUsd}) pasa de lo reservado para ese paso (US$${u2usd(linea.max_micro)}).`);
    }
    const r = await L.resolverIncierto(db, clave, cobro, cobro ? usd2u(realUsd || 0) : 0);
    if (!r.ok) return err(409, r.motivo, { codigo: r.codigo });
    const x = await almacen.actualizar(s0.id, (y) => { const pa = y.pasos[clave]; if (pa) pa.estado = cobro ? 'liquidado' : 'liberado'; const n = pa?.n; if (!n) return y; const i = y.escaleta.findIndex((p) => p.n === n); if (i >= 0 && y.escaleta[i].estado === 'revisar' && !cobro) y.escaleta[i] = { ...y.escaleta[i], estado: 'previsto', motivo: null }; return y; });
    await auditar('resolver', { por: usuario.email || usuario.id, serie: s0.id, clave, cobro });
    return { estado: 200, cuerpo: { resuelto: true, hash: x?.hash, nota: 'Anotado. Es solo contabilidad: no gasta ni reanuda nada.' } };
  }

  // ---- la bomba ----
  const planoA = (y, n, f) => { const i = y.escaleta.findIndex((p) => p.n === n); if (i >= 0) y.escaleta[i] = f(y.escaleta[i]); return y; };
  const fallaPlano = async (id, n, motivo) => { await almacen.actualizar(id, (y) => planoA(y, n, (p) => ({ ...p, estado: 'revisar', motivo: String(motivo).slice(0, 300) }))); await pausar(id, `el plano ${n} no se pudo generar: ${motivo}`); };

  /** Lo que estaba en el aire se resuelve a partir de los TRABAJOS del Estudio (por su id determinista), sin enviar nada nuevo. Idempotente: se puede repetir cuantas veces haga falta. */
  async function reconciliar(cfg) {
    const conf = confDe(cfg); let cambios = 0;
    for (const s0 of await almacen.enVuelo()) for (const p0 of s0.escaleta) {
      if (p0.estado !== 'corriendo') continue;
      const clave = p0.intento_actual ? claveIdempotencia(s0.id, p0.n, p0.intento_actual) : null, paso = clave ? s0.pasos[clave] : null;
      const j = clave ? await d.estudio.trabajo(idDeTrabajo(clave)) : null;
      if (paso && !paso.pedido_ok && !j && d.ahora() - (paso.envio || 0) < GRACIA_MS) continue; // marcado hace nada: quizá la bomba sigue con él
      if (j && (j.state === 'queued' || j.state === 'running')) { // en marcha: solo se asegura que quede apuntado
        if (paso && !paso.pedido_ok) await almacen.actualizar(s0.id, (y) => { const pa = y.pasos[clave]; if (pa) { pa.pedido_ok = 1; pa.job = j.id; pa.estado = 'enviado'; } return y; });
        continue;
      }
      const pagado = pagadoDe(paso?.engine); // sin motor conocido = de pago (falla cerrado)
      const dec0 = decidirResolucion({ n: p0.n, hayPaso: !!paso, apuntoJob: !!paso?.pedido_ok, job: j, pagado, genUsd: paso?.genUsd, fallos: s0.fallos[p0.n] || 0, reintentosMax: conf.reintentosMax, cancelada: !!s0.cancelada });
      // un plano que se repite una y otra vez sin llegar a terminar (cancelado, interrumpido) no gira para siempre: al pasar el tope queda para revisar (en un motor de pago, además, en duda: cuenta contra los topes) y la serie se pausa
      const repite = !!paso?.pedido_ok && dec0.libro === 'liberar' && dec0.plano.estado === 'previsto' && !dec0.contarFallo, tope = repite && (s0.repeticiones?.[p0.n] || 0) + 1 > MAX_REPETICIONES;
      const motivoTope = `el plano ${p0.n} se repitió ${MAX_REPETICIONES} veces sin llegar a terminar (se canceló o se interrumpió cada vez): revísalo antes de seguir`;
      const dec = tope ? { ...dec0, ...(pagado ? { libro: 'incierto', pasoEstado: 'incierto', devolverUso: 0 } : {}), plano: { estado: 'revisar', motivo: motivoTope }, pausa: motivoTope } : dec0;
      // 1) el libro (idempotente: repetirlo no cambia nada); si la línea ya está en el estado que se quería, es lo mismo que haberlo hecho
      let exc = false;
      if (clave && dec.libro) {
        const r = dec.libro === 'liquidar' ? await L.liquidar(db, clave, usd2u(dec.real)) : dec.libro === 'liberar' ? await L.liberar(db, clave, { nuncaSalio: dec.devolverUso === 1, sinTrabajoId: j ? null : idDeTrabajo(clave) }) : await L.marcarIncierto(db, clave);
        const meta = { liquidar: 'liquidado', liberar: 'liberado', incierto: 'incierto' }[dec.libro];
        if (!r.ok && r.estado !== meta && r.codigo !== 'sin_reserva') { console.error(`[series] libro ${clave}: ${r.motivo}`); continue; } // en un estado inesperado no se toca nada más: lo decide una persona
        if (dec.libro === 'liquidar') exc = !!(await L.lineaDe(db, clave))?.excedio;
      }
      // 2) la serie (con versión)
      await almacen.actualizar(s0.id, (y) => {
        const pa = clave ? y.pasos[clave] : null;
        if (!y.escaleta.find((p) => p.n === p0.n && p.estado === 'corriendo')) return undefined; // otro ya lo resolvió
        if (dec.pasoEstado && pa) pa.estado = dec.pasoEstado;
        if (dec.libro === 'liquidar') { pa.realUsd = dec.real; planoA(y, p0.n, (q) => ({ ...nuevaVersion({ ...q, estado: 'corriendo' }, { archivo: dec.plano.archivo, intento: pa.intento, costo_usd: dec.real, prompt: q.prompt_exacto }), motivo: null })); }
        else planoA(y, p0.n, (q) => ({ ...q, estado: dec.plano.estado, motivo: dec.plano.motivo }));
        if (dec.contarFallo) y.fallos[p0.n] = (y.fallos[p0.n] || 0) + 1;
        if (repite && !tope) { y.repeticiones = { ...(y.repeticiones || {}) }; y.repeticiones[p0.n] = (y.repeticiones[p0.n] || 0) + 1; } // contador PERSISTENTE por plano
        return y;
      });
      const pausa = dec.pausa || (exc ? dec.pausaSiExcede : null);
      if (pausa) await pausar(s0.id, pausa);
      cambios++;
    }
    return cambios;
  }

  async function iniciar(s, paso, cfg) {
    const n = paso.n, p = s.escaleta.find((x) => x.n === n), id = s.id;
    cfg = await d.cfg(); if (!seriesNubeActiva(cfg)) return pausar(id, 'generar series en la nube se apagó (dimitri.seriesNube): vuelve a pedir el clic para seguir'); // el interruptor se relee antes de CADA paso, no solo al empezar el tick
    const conf = confDe(cfg), cable = await d.cable();
    // antes de CADA paso: quién autorizó sigue siendo administrador
    const rol = s.autorizado?.por ? await d.rolDe(s.autorizado.por) : null;
    if (rol !== 'admin') return pausar(id, 'quien autorizó ya no es administrador: otro administrador tiene que dar el clic otra vez');
    const pago = hayPago([p]); if (pago) return fallaPlano(id, n, `usa un motor de pago (${engineDePlano(p) || 'desconocido'}) y generar con motores de pago todavía no está abierto en la nube`); // se rechaza ANTES de reservar ni enviar nada
    const caps = cable.capsDe(p.modelo); if (!caps) return fallaPlano(id, n, `el modelo ${p.modelo || 'ninguno'} está apagado o ya no existe`);
    if (p.refs.length > (caps.maxRefs ?? 0)) return fallaPlano(id, n, `lleva ${p.refs.length} referencias y ${p.modelo} admite ${caps.maxRefs || 0}; no se recorta en silencio`);
    const faltan = p.refs.length ? await galeria.cuales(db, p.refs) : new Set(); const falta = p.refs.find((r) => !faltan.has(galeria.validoId(r)));
    if (falta) return fallaPlano(id, n, `la referencia ${falta} ya no está en la galería`);
    const b = precioSeguro(cable.precioPlano(p.modelo, p.ajustes)); if (!b) return pausar(id, `no hay un precio fiable para el plano ${n}`);
    const precio = conRev(b, reservaRev()), maxMicro = costoPlano(precio), maxUsd = u2usd(maxMicro);
    try { await d.estudio.checkBudget(maxUsd); } catch (e) { return pausar(id, String(e?.message || e)); } // día o mes del Estudio: nada se reserva ni se envía
    const dia = String(d.dia()), mes = dia.slice(0, 7), carrusel = esCarrusel(s), bud = await d.estudio.budget();
    const engine = engineDePlano(p);
    // 1) MARCAR (con versión): el paso queda apuntado ANTES de reservar y de pedir. Todo lo que autoriza se vuelve a comprobar dentro del cambio.
    let sin = null, clave = null, intento = 0;
    const r = await almacen.actualizar(id, (y) => {
      if (!autorizacionDe(y) || !['muestra', 'corriendo'].includes(y.estado)) { sin = 'la serie ya no está autorizada'; return undefined; }
      const sp = siguientePaso(y, { autorizacion: autorizacionDe(y) }); if (sp.tipo !== 'gasto' || sp.n !== n) { sin = 'la escaleta o la autorización cambió'; return undefined; }
      if (y.escaleta.some((q) => q.estado === 'corriendo')) { sin = 'otro plano está en el aire'; return undefined; }
      if (y.autorizado?.por !== s.autorizado?.por || d.ahora() - y.autorizado.en > autorizacionMs) { sin = 'la autorización cambió o caducó'; return undefined; }
      intento = (y.intentos[n] || 0) + 1; clave = claveIdempotencia(id, n, intento); // contador MONÓTONO: una clave liberada nunca se reutiliza
      y.intentos[n] = intento; y.pasos[clave] = { n, intento, estado: 'marcado', maxUsd, genUsd: u2usd(costoPlano({ generacion: b.generacion })), mes, dia, envio: d.ahora(), job: idDeTrabajo(clave), pedido_ok: 0, engine, modelo: p.modelo };
      return planoA(y, n, (q) => ({ ...q, estado: 'corriendo', intento_actual: intento }));
    });
    if (!r || sin) return sin ? pausar(id, sin) : undefined;
    const soltar = async (motivo, nunca = true) => { // el paso no llegó a salir (se sabe seguro): devuelve la reserva y el plano vuelve a la fila
      if (nunca) await L.liberar(db, clave, { nuncaSalio: true, sinTrabajoId: idDeTrabajo(clave) });
      await almacen.actualizar(id, (y) => { if (y.pasos[clave]) y.pasos[clave].estado = 'liberado'; return planoA(y, n, (q) => (q.estado === 'corriendo' ? { ...q, estado: 'previsto' } : q)); });
      return pausar(id, motivo);
    };
    // 2) RESERVAR (una sentencia atómica con el tope de la serie, el del mes de carruseles y el cupo del día)
    const rs = await L.reservar(db, { clave, serieId: id, n, intento, maxMicro, topeSerieMicro: usd2u(topeDe(s, conf)), mes, dia, carrusel, topeMesMicro: carrusel ? usd2u(conf.topeMesCarruselesUsd) : 0, peso: weightOf('image', 1), cupoDiaPeso: cupoSerieDia(bud.limit, conf), ahora: d.ahora() });
    if (!rs.ok) return soltar(rs.motivo);
    // 3) CONFIRMAR que nadie (otra bomba, una pausa, una cancelación) deshizo el paso mientras se reservaba
    let vivo = false;
    await almacen.actualizar(id, (y) => { const pa = y.pasos[clave]; if (pa?.estado === 'marcado' && y.escaleta.find((q) => q.n === n)?.estado === 'corriendo' && autorizacionDe(y) && ['muestra', 'corriendo'].includes(y.estado)) { pa.estado = 'reservado'; vivo = true; } return y; });
    if (!vivo) return soltar('el paso cambió mientras se reservaba: no se envió nada');
    // 4) PEDIR (un trabajo de la cola del Estudio con id determinista: pedir dos veces es el mismo trabajo). Otra vez el interruptor; y el trabajo solo ENTRA si la línea sigue «reservado» (misma sentencia: si otro tick la liberó mientras este esperaba, no se pide nada)
    if (!seriesNubeActiva(await d.cfg())) return soltar('generar series en la nube se apagó (dimitri.seriesNube): no se envió nada');
    let job = null, rechazo = null;
    try {
      const aj = p.ajustes && typeof p.ajustes === 'object' ? { ...p.ajustes } : {}; if (p.semilla != null) aj.seed = p.semilla;
      job = await d.estudio.pedir({ prompt: p.prompt_exacto, model: p.modelo, kind: 'image', n: 1, settings: aj, media: p.refs.length ? { reference: p.refs } : {}, purpose: `Serie «${s.titulo}» · plano ${n}` },
        { usuario: { rol: 'admin', email: 'series@bomba', id: s.autorizado.por }, forzar: { id: idDeTrabajo(clave), serie: { id, n, intento }, condicion: { clave } } });
    } catch (e) { rechazo = e; }
    if (rechazo) { // ¿entró el trabajo antes del error? entonces SÍ se adopta (nunca se libera con un trabajo vivo)
      if (await d.estudio.trabajo(idDeTrabajo(clave))) job = { id: idDeTrabajo(clave) };
      else return soltar(`el Estudio no aceptó el plano ${n}: ${String(rechazo.message || rechazo).slice(0, 200)}`);
    }
    // 5) APUNTAR que el trabajo existe: desde aquí, un trabajo que ya no aparezca es «incierto», nunca «liberado»
    await almacen.actualizar(id, (y) => { const pa = y.pasos[clave]; if (pa) { pa.pedido_ok = 1; pa.job = job.id; pa.estado = 'enviado'; } return y; });
    await auditar('envio', { serie: id, n, intento, job: job.id, maxUsd });
  }

  async function avanzar(cfg) {
    const activo = seriesNubeActiva(cfg);
    const a = planificarPaso(await almacen.todas(), { activo, ahora: d.ahora(), autorizacionMs, concurrencia: 1 }); // la decisión es pura y compartida con la oficina local
    switch (a.tipo) {
      case 'pausar_todas': for (const id of a.ids) await pausar(id, a.motivo); return a;
      case 'caducada': case 'pausar': await pausar(a.id, a.motivo); return a;
      case 'terminar': { let ok = false; await almacen.actualizar(a.id, (y) => { const h = cerrarSerie(y, d.ahora()); ok = !!h; return h; }); if (ok) await auditar('hecha', { serie: a.id }); return a; }
      case 'muestra_lista': await almacen.actualizar(a.id, (y) => ({ ...y, muestra_lista: true })); await auditar('muestra_lista', { serie: a.id }); return a;
      case 'gasto': { const s = await almacen.uno(a.id); if (s) await iniciar(s, a.paso, cfg); return a; }
      default: return a;
    }
  }

  /** Un tick del reloj: reconciliar y dar UN paso, con el candado global (dos Workers a la vez: solo uno). */
  async function tick() {
    const yo = azarHex(16);
    if (!(await cands.tomar(CANDADO, TTL_CANDADO_MS, yo))) return { omitido: 'candado' };
    try { const cfg = await d.cfg(); const rec = await reconciliar(cfg); const a = await avanzar(cfg); return { reconciliados: rec, accion: a?.tipo }; }
    finally { await cands.soltar(CANDADO, yo); }
  }
  return { presupuesto, generar, pausar: pausarPorDueno, cancelar, resolver, tick, reconciliar: async () => reconciliar(await d.cfg()), calcular };
}
void TRANSITORIAS;
