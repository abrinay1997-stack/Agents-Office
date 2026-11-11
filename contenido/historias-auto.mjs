// Historias automáticas (11 nov 2026): lo que ya se publicó vuelve como HISTORIA, cada día, para que la cuenta no se quede callada entre publicaciones.
// La idea es de la aplicación de calendarios de Juancito Ads (src/lib/historiasAuto.js); aquí está hecha para la oficina:
//   · una historia automática es una PIEZA de Contenido como cualquier otra (formato «historia», origen «historia:<id de la original>»): se ve en el calendario,
//     se edita, se mueve y sale por la cola de siempre, con sus tres candados (aprobada · el modo · el conductor);
//   · por defecto nace EN REVISIÓN y espera el OK del dueño. Solo si él enciende «sin pedirme el OK» (Ajustes → Contenido) nace aprobada: es SU OK permanente,
//     queda firmado «historias-auto» y se apaga con el mismo interruptor. Un agente, Dimitri o el asistente no pueden encenderlo;
//   · no gasta: la imagen es la de la publicación original (sin IA, sin Estudio). En la historia, Instagram la encaja a 9:16.
// Arriba, lo PURO (con test, sin reloj propio); abajo, `crearHistoriasAuto`, que recibe el almacén de piezas, la cola y dónde apuntar el último día preparado.
import { emparejar, sumaResultados } from '../src/contenido-publicadas.js';

export const HORA_POR_DEFECTO = '18:00';
export const MAX_POR_DIA = 5;
export const SEPARACION_MIN = 120; // entre una y la siguiente del mismo día
export const SEPARACION_MINIMA = 30; // si no caben antes de la última hora, se juntan hasta aquí
export const ULTIMA_HORA = '22:00';
export const MARGEN_MIN = 10; // a menos de esto de su hora, ya es la de mañana
export const DIAS_SIN_REPETIR_POST = 2; // lo publicado hace menos de dos días todavía está fresco en el perfil
export const DIAS_ENTRE_USOS = 4; // la misma publicación no vuelve como historia antes de cuatro días
export const DIAS_ATRAS = 90; // más viejo ya no representa a la marca de hoy
const REDES_HISTORIA = ['instagram', 'facebook'];
const ES_IMAGEN = /\.(jpe?g|png|webp)$/i;

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const masDias = (f, n) => { const d = new Date(`${f}T12:00:00`); d.setDate(d.getDate() + n); return ymd(d); };
const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400e3);
const minutos = h => { const [a, b] = String(h).split(':').map(Number); return a * 60 + b; };
const hhmm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Los ajustes limpios (lo que no vale vuelve a su valor de siempre). `c` = la sección `contenido` de la configuración. */
export function ajustesHistorias(c = {}) {
  const n = Math.round(Number(c?.historiasPorDia));
  return {
    activo: c?.historiasAuto === true,
    hora: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(c?.historiasHora || '')) ? String(c.historiasHora) : HORA_POR_DEFECTO,
    porDia: Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_POR_DIA) : 1,
    sinOk: c?.historiasSinOk === true,
  };
}

/** Las horas de las `n` historias de un día: la primera a su hora y las demás cada dos horas; si la última pasaría de las 22:00, se juntan (nunca a menos de 30 min). */
export function horasDelDia(hora = HORA_POR_DEFECTO, n = 1) {
  const cuantas = Math.max(1, Math.min(MAX_POR_DIA, Math.round(n) || 1)), primera = minutos(hora), tope = Math.max(primera, minutos(ULTIMA_HORA));
  let paso = SEPARACION_MIN;
  if (cuantas > 1 && primera + paso * (cuantas - 1) > tope) paso = Math.max(SEPARACION_MINIMA, Math.floor((tope - primera) / (cuantas - 1)));
  return Array.from({ length: cuantas }, (_, i) => hhmm(Math.min(primera + paso * i, 23 * 60 + 59)));
}

/** El día que toca preparar: hoy si a la primera historia le quedan más de 10 minutos; si no, mañana. */
export function proximaFecha(ahora, hora = HORA_POR_DEFECTO) {
  const d = new Date(ahora), hoy = ymd(d);
  return new Date(`${hoy}T${hora}:00`).getTime() - ahora > MARGEN_MIN * 60e3 ? hoy : masDias(hoy, 1);
}

export const origenHistoria = id => `historia:${id}`;
export const esHistoriaAuto = p => String(p?.origen || '').startsWith('historia:');
/** La publicación original de una historia automática (o la propia pieza). */
export const raizHistoria = p => (esHistoriaAuto(p) ? String(p.origen).slice(9) : p?.id);
export const primeraImagen = p => (p?.medios || []).find(m => ES_IMAGEN.test(String(m))) || '';
const yaSalio = s => !!s && ['publicada', 'parcial'].includes(s.estado);

/**
 * Qué publicaciones pueden volver como historia el día `fecha`, la mejor primero.
 * `salidas` = { id: salida de la cola }, `resultados` = { id: interacciones } (opcional: sin Analíticas se ordena por lo menos usado y lo más reciente).
 * → [{ pieza, imagen, redes, usos, ultima, interacciones }]
 */
export function candidatas({ piezas = [], salidas = {}, resultados = {}, fecha } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return [];
  const usos = new Map(); // por original: cuántas historias suyas hay (hechas o por salir) y la más reciente
  for (const p of piezas) {
    if (!esHistoriaAuto(p) || !p.fecha) continue;
    const r = raizHistoria(p), u = usos.get(r) || { n: 0, ultima: '' };
    usos.set(r, { n: u.n + 1, ultima: p.fecha > u.ultima ? p.fecha : u.ultima });
  }
  const out = [];
  for (const p of piezas) {
    if (!p?.fecha || esHistoriaAuto(p) || p.formato === 'historia' || !yaSalio(salidas[p.id])) continue;
    const edad = diasEntre(p.fecha, fecha); if (edad < DIAS_SIN_REPETIR_POST || edad > DIAS_ATRAS) continue;
    const imagen = primeraImagen(p), redes = (p.redes || []).filter(r => REDES_HISTORIA.includes(r)); if (!imagen || !redes.length) continue;
    const u = usos.get(p.id) || { n: 0, ultima: '' };
    if (u.ultima && Math.abs(diasEntre(u.ultima, fecha)) < DIAS_ENTRE_USOS) continue;
    out.push({ pieza: p, imagen, redes, usos: u.n, ultima: u.ultima, interacciones: Number(resultados[p.id]) || 0 });
  }
  return out.sort((a, b) => a.usos - b.usos || b.interacciones - a.interacciones || (a.pieza.fecha < b.pieza.fecha ? 1 : -1));
}

/** Las interacciones de cada pieza ya publicada (Analíticas emparejado con las piezas, que llegan con su `salida`). → { id: n } */
export function interaccionesDe(piezas = [], publicaciones = []) {
  if (!publicaciones?.length) return {};
  return Object.fromEntries(Object.entries(emparejar(piezas, publicaciones).porPieza).map(([id, l]) => [id, sumaResultados(l).interacciones || 0]));
}

/** Los datos de la pieza nueva (lo que recibe `almacen.crear`). */
export function piezaDeHistoria(c, { fecha, hora, sinOk = false }) {
  const o = c.pieza, titulo = String(o.titulo || o.texto || 'publicación').replace(/\s+/g, ' ').trim().slice(0, 60);
  const cuentas = Object.fromEntries(Object.entries(o.cuentas || {}).filter(([r]) => c.redes.includes(r)));
  return {
    titulo: `Historia: ${titulo}`, fecha, hora, formato: 'historia', redes: c.redes, medios: [c.imagen], estado: 'revision', origen: origenHistoria(o.id),
    ...(Object.keys(cuentas).length ? { cuentas } : {}),
    notas: `Historia automática de la publicación del ${o.fecha}${o.titulo ? ` («${titulo}»)` : ''}. ${sinOk ? 'Sale sola: lo tienes fijado en Ajustes → Contenido.' : 'Sale cuando la apruebes.'}`,
  };
}

/** En palabras, para Dimitri, los agentes y la pantalla. */
export function textoHistorias({ ajustes: a, estado: e = {}, modo = '' } = {}) {
  if (!a?.activo) return 'Historias automáticas: apagadas (Ajustes → Contenido → «Historias automáticas»). Encendidas, cada día lo ya publicado vuelve como historia en Instagram y Facebook.';
  const horas = horasDelDia(a.hora, a.porDia).join(', ');
  const l = [`Historias automáticas: encendidas · ${a.porDia} al día (${horas}) · ${a.sinOk ? 'salen SOLAS (el dueño fijó su OK)' : 'cada una espera el OK del dueño'}${modo && modo !== 'real' ? ` · Contenido está en modo ${modo}: no salen de verdad` : ''}.`];
  if (e.ultimaFecha) l.push(`Último día preparado: ${e.ultimaFecha}${e.nota ? ` — ${e.nota}` : ''}.`);
  return l.join('\n');
}

/**
 * El corredor. `almacen` (el de piezas: listar, crear, aprobar), `salidaDe(id)` (la cola), `interacciones(piezas)` → { id: n } (opcional),
 * `ajustes()` → la sección `contenido`, `estado` { leer(), guardar(v) } (dónde se apunta el último día), `notice`, `ahora`.
 */
export function crearHistoriasAuto({ almacen, salidaDe = async () => null, interacciones = null, ajustes = () => ({}), estado, notice = () => {}, ahora = Date.now, modo = () => '' }) {
  let enMarcha = false;
  const leerEstado = async () => (await estado.leer()) || {};

  /** Una vuelta: si toca preparar un día y aún no se hizo, crea sus historias. `forzar` (el botón del dueño) lo repite para ese día. → { hecho, fecha, creadas, nota } */
  async function tick({ forzar = false } = {}) {
    const a = ajustesHistorias(await ajustes());
    if (!a.activo && !forzar) return { hecho: false, motivo: 'apagadas' };
    if (enMarcha) return { hecho: false, motivo: 'ya hay una vuelta en marcha' };
    enMarcha = true;
    try {
      const t = ahora(), fecha = proximaFecha(t, a.hora), e = await leerEstado();
      if (!forzar && e.ultimaFecha && e.ultimaFecha >= fecha) return { hecho: false, motivo: 'ese día ya está preparado', fecha };
      const piezas = await almacen.listar({}), salidas = {};
      for (const p of piezas) if (p.fecha && !esHistoriaAuto(p) && p.formato !== 'historia') salidas[p.id] = await salidaDe(p.id);
      const yaHay = piezas.filter(p => esHistoriaAuto(p) && p.fecha === fecha).length, faltan = Math.max(0, a.porDia - yaHay);
      let res = {}; if (interacciones && faltan) { try { res = (await interacciones(piezas.map(p => ({ ...p, salida: salidas[p.id] || null })))) || {}; } catch { res = {}; } }
      const cs = candidatas({ piezas, salidas, resultados: res, fecha }), horas = horasDelDia(a.hora, a.porDia).slice(yaHay);
      const creadas = [], errores = [];
      for (let i = 0; i < faltan && i < cs.length; i++) {
        const hora = horas[i] || horas.at(-1) || a.hora;
        if (new Date(`${fecha}T${hora}:00`).getTime() <= t) continue; // esa hora ya pasó (día forzado a media tarde)
        const r = await almacen.crear(piezaDeHistoria(cs[i], { fecha, hora, sinOk: a.sinOk }), { por: 'dueno' });
        if (r.error) { errores.push(r.error); continue; }
        let pieza = r.pieza, sola = false;
        if (a.sinOk) { const ok = await almacen.aprobar(pieza.id, { por: 'historias-auto' }); if (ok.pieza) { pieza = ok.pieza; sola = true; } else errores.push(`«${pieza.titulo}» quedó en revisión: ${ok.error}`); }
        creadas.push({ id: pieza.id, titulo: pieza.titulo, hora, de: cs[i].pieza.id, sola });
      }
      const nota = creadas.length
        ? `${creadas.length} de ${a.porDia} ${creadas.length === 1 ? 'preparada' : 'preparadas'}${creadas.length < faltan ? ' (no había más publicaciones que pudieran volver)' : ''}`
        : (faltan ? 'ninguna publicación podía volver: hace falta algo publicado con imagen hace más de 2 días y que no haya salido como historia en los últimos 4' : 'ya estaban');
      await estado.guardar({ ultimaFecha: fecha, nota, creadas: creadas.map(c => c.id), at: new Date(t).toISOString(), ...(errores.length ? { errores: errores.slice(0, 5) } : {}) });
      if (creadas.length) {
        const solas = creadas.filter(c => c.sola).length, esperan = creadas.length - solas;
        notice('contenido-historias', `Historias automáticas para el ${fecha}: ${creadas.length} ${creadas.length === 1 ? 'lista' : 'listas'}${esperan ? ` · ${esperan} ${esperan === 1 ? 'espera' : 'esperan'} tu OK en Contenido` : ''}${solas ? ` · ${solas} ${solas === 1 ? 'sale sola' : 'salen solas'} (lo fijaste en Ajustes)` : ''}.`, { key: 'historias-' + fecha });
      }
      return { hecho: true, fecha, creadas, nota, errores };
    } finally { enMarcha = false; }
  }

  /** Lo que se enseña: ajustes, último día y qué saldría la próxima vez (sin crear nada). */
  async function ver() {
    const a = ajustesHistorias(await ajustes()), e = await leerEstado(), fecha = proximaFecha(ahora(), a.hora);
    const piezas = await almacen.listar({}), salidas = {};
    for (const p of piezas) if (p.fecha && !esHistoriaAuto(p) && p.formato !== 'historia') salidas[p.id] = await salidaDe(p.id);
    const corta = c => ({ id: c.pieza.id, titulo: c.pieza.titulo || '', fecha: c.pieza.fecha, imagen: c.imagen, redes: c.redes, usos: c.usos, ultima: c.ultima });
    const hechas = piezas.filter(esHistoriaAuto).sort((x, y) => (x.fecha < y.fecha ? 1 : -1)).slice(0, 12).map(p => ({ id: p.id, titulo: p.titulo, fecha: p.fecha, hora: p.hora, estado: p.estado, de: raizHistoria(p) }));
    return { ajustes: a, horas: horasDelDia(a.hora, a.porDia), estado: e, proxima: fecha, candidatas: candidatas({ piezas, salidas, fecha }).slice(0, 10).map(corta), hechas, texto: textoHistorias({ ajustes: a, estado: e, modo: await modo() }) };
  }

  return { tick, ver };
}
