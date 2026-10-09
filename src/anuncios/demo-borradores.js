// Los BORRADORES de ejemplo (Fase A3, 9 oct 2026): la demo file:// y «Ver con datos de ejemplo». En memoria, con las MISMAS respuestas
// que el servidor (GET/POST/PATCH/DELETE /api/anuncios/borradores, …/validar, …/crear, …/vista-previa, …/mejorar), su `status` dentro y
// sin lanzar. Validar mira lo que el servidor y Meta mirarían (objetivo, enlace, público, categoría especial, presupuesto contra los
// topes, fechas, creativos y sus llamadas); crear en pausa tarda un momento («creando») y la campaña aparece EN PAUSA en Campañas, con su
// línea en el Historial. Nunca llama a la red.
import { llamadasDe, objetivoDe, MAX_CREATIVOS, LARGO, MEJORAS_DEF, objetivoTexto, LLAMADA } from './borrador.js';
import { dinero } from './comun.js';

const svgImg = (a, b, t, w = 120, h = 120) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><text x="${w / 2}" y="${h / 2 + 6}" font-family="sans-serif" font-size="16" font-weight="700" fill="#fff" text-anchor="middle">${t}</text></svg>`);
/** La galería de ejemplo del Estudio: cada archivo con su imagen (data:) y sus medidas. */
export const GALERIA_DEMO = [
  { file: 'demo/anu-combo.jpg', kind: 'image', w: 1080, h: 1080, prompt: 'Combo lentes + montura, foto de producto', src: svgImg('#1F5FD0', '#6B3FB5', 'COMBO') },
  { file: 'demo/anu-vitrina.jpg', kind: 'image', w: 1080, h: 1350, prompt: 'La vitrina de la tienda, vertical', src: svgImg('#176638', '#0B6E80', 'VITRINA', 120, 150) },
  { file: 'demo/anu-cliente.jpg', kind: 'image', w: 1080, h: 1920, prompt: 'Cliente probándose monturas, para historias', src: svgImg('#A3266B', '#6B3FB5', 'CLIENTE', 108, 192) },
  { file: 'demo/anu-examen.jpg', kind: 'image', w: 1080, h: 1080, prompt: 'Examen de la vista en 20 minutos', src: svgImg('#8A5A00', '#B42318', 'EXAMEN') },
  { file: 'demo/anu-otono.jpg', kind: 'image', w: 1080, h: 1350, prompt: 'Monturas de otoño sobre madera', src: svgImg('#5A5A5A', '#151414', 'OTOÑO', 120, 150) },
];
export const srcDemo = id => GALERIA_DEMO.find(g => g.file === id)?.src || null;

const DIA = 864e5;
const ymd = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const finDia = s => Date.parse(String(s) + 'T23:59:59');
const iniDia = s => Date.parse(String(s) + 'T00:00:00');
const r2 = v => Math.round(v * 100) / 100;
/** Los días que dura, contando el primero y el último; null sin fin. */
export function diasDe(inicio, fin) { if (!fin) return null; const a = iniDia(inicio), z = iniDia(fin); if (!Number.isFinite(a) || !Number.isFinite(z) || z < a) return null; return Math.round((z - a) / DIA) + 1; }

/** Los valores de por defecto de un borrador nuevo (plan §12: «Que me escriban» por WhatsApp, Advantage+ en Panamá, 18+). */
export function borradorPorDefecto(ahora = Date.now(), extra = {}) {
  const t = new Date(ahora).toISOString();
  return { id: 'b-' + Math.random().toString(36).slice(2, 9), nombre: `Campaña nueva — ${new Date(ahora).toLocaleDateString('es', { day: 'numeric', month: 'short' })}`, de: 'dueno', creadoAt: t, actualizadoAt: t, estado: 'borrador',
    objetivo: 'mensajes', destino: 'whatsapp', publico: { modo: 'advantage', paises: ['PA'], radio: null, edadMin: 18, edadMax: null, intereses: [] }, categoriaEspecial: null,
    presupuesto: { tipo: 'diario', usd: 5 }, inicio: ymd(ahora), fin: ymd(ahora + 13 * DIA), enlace: '', creativos: [], mejoras: { ...MEJORAS_DEF }, validacion: null, meta: null, error: null, ...extra };
}

/** El costo máximo: { dia, total, campana } (campana = el spend_cap que llevará en Meta: lo que sale del tope). */
export function costoMaxDe(b, topes = {}) {
  const p = b.presupuesto || {}, usd = Number(p.usd) || 0, dias = diasDe(b.inicio, b.fin);
  if (p.tipo === 'total') return { dia: null, total: r2(usd), campana: topes.campana > 0 ? r2(Math.min(usd, topes.campana)) : r2(usd) };
  const total = dias == null ? null : r2(usd * dias);
  return { dia: r2(usd), total, campana: topes.campana > 0 ? r2(total == null ? topes.campana : Math.min(total, topes.campana)) : total };
}

/** La revisión de la demo: → { ok, problemas: [{ campo, texto }], at, costoMax }. Lo mismo que miraría el servidor antes de Meta. */
export function validarBorrador(b, { topes = {}, ahora = Date.now(), galeria = GALERIA_DEMO, moneda = 'USD' } = {}) {
  const P = [], mal = (campo, texto) => P.push({ campo, texto }), o = objetivoDe(b.objetivo), pub = b.publico || {}, pr = b.presupuesto || {};
  if (!String(b.nombre || '').trim()) mal('nombre', 'Ponle un nombre a la campaña (solo lo ves tú).');
  if (!o) mal('objetivo', 'Elige qué quieres conseguir.');
  if (o?.k === 'mensajes' && !b.destino) mal('destino', 'Elige por dónde quieres que te escriban: WhatsApp, Instagram o Messenger.');
  if (o?.enlace) { if (!b.enlace) mal('enlace', 'Escribe la dirección de tu web (empieza por https://).'); else if (!/^https:\/\/[^\s/]+\.[^\s]+$/.test(b.enlace)) mal('enlace', 'La dirección de la web tiene que empezar por https:// y ser completa.'); }
  if (o?.k === 'ventas') mal('objetivo', 'Ventas en tu web necesita el píxel de Meta instalado y una conversión elegida: Meta no encuentra ninguno en esta cuenta (ejemplo).');
  if (!pub.radio && !(pub.paises || []).length) mal('publico.paises', 'Elige al menos un país, o un radio alrededor de tu local.');
  if (pub.radio && !(Number(pub.radio.km) >= 1 && Number(pub.radio.km) <= 80)) mal('publico.radio', 'El radio va de 1 a 80 km.');
  const eMin = Number(pub.edadMin), eMax = pub.edadMax == null || pub.edadMax === '' ? null : Number(pub.edadMax);
  if (!(eMin >= 18 && eMin <= 65)) mal('publico.edadMin', 'La edad mínima va de 18 a 65 años.');
  if (eMax != null && !(eMax >= eMin && eMax <= 65)) mal('publico.edadMax', 'La edad máxima tiene que ser mayor que la mínima y como mucho 65 (vacía = 65 o más).');
  if (b.categoriaEspecial && (eMin !== 18 || eMax != null)) mal('publico.edadMin', 'Con una categoría especial, Meta no deja elegir la edad: tiene que ser de 18 a 65 o más.');
  if (b.categoriaEspecial && pub.modo === 'manual' && (pub.intereses || []).length) mal('publico.intereses', 'Con una categoría especial, Meta no deja elegir intereses: quítalos o vuelve a Advantage+.');
  const usd = Number(pr.usd);
  if (!(usd > 0)) mal('presupuesto.usd', 'Escribe un presupuesto mayor que 0.');
  else if (pr.tipo === 'diario' && usd < 1) mal('presupuesto.usd', `Meta no acepta un presupuesto diario de menos de ${dinero(1, moneda)} en esta cuenta.`);
  if (pr.tipo === 'diario' && topes.diario > 0 && usd > topes.diario) mal('presupuesto.usd', `${dinero(usd, moneda)} al día pasa tu tope diario de ${dinero(topes.diario, moneda)}.`);
  if (!b.inicio) mal('inicio', 'Elige cuándo empieza.');
  else if (finDia(b.inicio) < ahora) mal('inicio', 'La fecha de inicio ya pasó: elige hoy o un día después.');
  if (b.fin && b.inicio && iniDia(b.fin) < iniDia(b.inicio)) mal('fin', 'La fecha de fin tiene que ser después del inicio.');
  if (pr.tipo === 'total' && !b.fin) mal('fin', 'Con presupuesto total, Meta pide la fecha de fin.');
  const c = costoMaxDe(b, topes), enCamp = pr.tipo === 'total' ? usd : c.total;
  if (topes.campana > 0 && enCamp != null && enCamp > topes.campana) mal('presupuesto.usd', `La campaña podría gastar ${dinero(enCamp, moneda)} y tu tope por campaña es ${dinero(topes.campana, moneda)}: baja el presupuesto o acorta las fechas.`);
  const cr = b.creativos || [];
  if (!cr.length) mal('creativos', 'Añade al menos un creativo (mejor de 3 a 6): una imagen o un video de la galería.');
  if (cr.length > MAX_CREATIVOS) mal('creativos', `Como mucho ${MAX_CREATIVOS} creativos por campaña.`);
  const llam = llamadasDe(b.objetivo, b.destino);
  cr.forEach((x, i) => {
    const n = `creativo ${i + 1}`;
    if (!x.media) mal(`creativos.${i}.media`, `El ${n} no tiene imagen ni video.`);
    else if (galeria && !galeria.some(g => g.file === x.media) && String(x.media).startsWith('demo/')) mal(`creativos.${i}.media`, `La imagen del ${n} ya no está en la galería.`);
    if (!String(x.texto || '').trim()) mal(`creativos.${i}.texto`, `Escribe el texto principal del ${n}.`);
    if (String(x.titular || '').length > 255) mal(`creativos.${i}.titular`, `El titular del ${n} pasa de 255 letras.`);
    if (x.llamada && !llam.includes(x.llamada)) mal(`creativos.${i}.llamada`, `«${LLAMADA[x.llamada] || x.llamada}» no vale para «${objetivoTexto(b)}»: elige otra llamada a la acción.`);
  });
  if (cr.some(x => String(x.texto || '').length > LARGO.texto * 4)) { /* muy largo: Meta lo corta con «Ver más», no es un error */ }
  return { ok: !P.length, problemas: P, at: new Date(ahora).toISOString(), costoMax: c };
}

/** Lo que propone «✨ Mejorar con el agente de anuncios» en la demo: más corto, con una acción clara. */
export function mejoraDemo(b, cr, campo) {
  const base = String(cr?.[campo] || '').trim();
  if (campo === 'titular') {
    const t = base ? base.split(/[.!?·—-]/)[0].trim().slice(0, 38) : (b.objetivo === 'mensajes' ? 'Escríbenos y te lo apartamos' : 'Monturas nuevas desde US$59');
    return { texto: t, porque: 'Un titular de menos de 40 letras se lee entero en el teléfono; lo concreto (el precio, lo que ganas) funciona mejor que el nombre de la marca.', agente: 'ANUNCIOS' };
  }
  const accion = b.objetivo === 'mensajes' ? 'Escríbenos por WhatsApp y te respondemos hoy.' : b.objetivo === 'ventas' ? 'Pídelo en la web y te llega en 48 h.' : 'Míralo en la web.';
  const cuerpo = base ? base.replace(/\s+/g, ' ').replace(/[.!]*$/, '.').slice(0, 90) : 'Lentes y montura listos en 1 día, con examen de la vista incluido.';
  return { texto: `${cuerpo} ${accion}`, porque: 'Meta enseña unas 125 letras antes de «Ver más»: lo importante va primero y la acción al final, con el canal que elegiste.', agente: 'ANUNCIOS' };
}

/**
 * crearDemoBorradores({ demo, ahora, topes }) → la API de los borradores en memoria. `demo` es la de crearDemo() (demo.js): al crear en
 * pausa le añade la campaña (`demo.agregarCreada`) para que salga en Campañas. Contesta como el servidor, con `status` dentro.
 */
export function crearDemoBorradores({ demo, ahora = () => Date.now(), topes = {}, tardaMs = 1500, fallarCrear = 0 } = {}) {
  const t0 = ahora(), lista = [], papelera = [];
  let falla = fallarCrear;
  const de = (id, o) => ({ ...borradorPorDefecto(t0, o), id });
  lista.push(de('ej-b-1', { nombre: 'Examen de la vista — octubre', de: 'dimitri', creadoAt: new Date(t0 - 3 * 36e5).toISOString(), actualizadoAt: new Date(t0 - 3 * 36e5).toISOString(),
    creativos: [{ id: 'cr-d1', media: 'demo/anu-examen.jpg', formato: '1:1', texto: 'Examen de la vista en 20 minutos, sin cita. Escríbenos y te guardamos la hora.', titular: 'Tu examen en 20 minutos', descripcion: '', llamada: 'WHATSAPP_MESSAGE' }] }));
  lista.push(de('ej-b-2', { nombre: 'Monturas otoño — visitas a la web', de: 'agente:ada', objetivo: 'web', destino: null, enlace: 'https://panaclaw.example/otono', presupuesto: { tipo: 'diario', usd: 6 }, fin: null, creadoAt: new Date(t0 - 26 * 36e5).toISOString(), actualizadoAt: new Date(t0 - 20 * 36e5).toISOString(),
    creativos: [{ id: 'cr-a1', media: 'demo/anu-otono.jpg', formato: '4:5', texto: 'Las monturas de otoño ya están aquí. Mira los modelos y aparta el tuyo.', titular: 'Monturas nuevas de otoño', descripcion: 'Desde US$59', llamada: 'LEARN_MORE' }] }));
  lista.push(de('ej-b-3', { nombre: 'Reseñas — Promo octubre', de: 'dueno', estado: 'creado', creadoAt: new Date(t0 - 5 * DIA).toISOString(), actualizadoAt: new Date(t0 - 5 * DIA).toISOString(), presupuesto: { tipo: 'diario', usd: 10 }, meta: { campana: 'ej-c-4', conjunto: 'ej-as-4', creativos: [], anuncios: ['ej-ad-41'] },
    creativos: [{ id: 'cr-r1', media: 'demo/anu-cliente.jpg', formato: '9:16', texto: 'Lo que dicen nuestros clientes. Escríbenos y agenda tu examen de la vista.', titular: '«Me atendieron en 20 minutos»', descripcion: '', llamada: 'WHATSAPP_MESSAGE' }] }));
  for (const b of lista) if (b.estado !== 'creado') b.validacion = null;
  lista[2].validacion = validarBorrador({ ...lista[2], inicio: ymd(t0) }, { topes, ahora: t0 });

  const busca = id => lista.find(b => b.id === id);
  const copia = b => structuredClone(b);
  const terminar = b => { // lo que estaba «creando» y ya cumplió su tiempo
    if (b.estado !== 'creando' || ahora() < b._listoAt) return;
    delete b._listoAt;
    if (falla > 0) { falla--; b.estado = 'fallo'; b.error = 'Meta no aceptó la imagen del creativo 1: es demasiado pequeña (mínimo 600 × 600 px). No se creó nada: lo que se había subido se archivó (ejemplo).'; b.actualizadoAt = new Date(ahora()).toISOString(); return; }
    const id = demo?.agregarCreada ? demo.agregarCreada(b) : 'ej-c-x';
    b.estado = 'creado'; b.error = null; b.meta = { campana: id, conjunto: id + '-as1', creativos: b.creativos.map((_, i) => `${id}-cr${i + 1}`), anuncios: b.creativos.map((_, i) => `${id}-as1-ad${i + 1}`) }; b.actualizadoAt = new Date(ahora()).toISOString();
  };
  const todos = () => { lista.forEach(terminar); return lista; };
  const PERMITIDOS = ['nombre', 'objetivo', 'destino', 'publico', 'categoriaEspecial', 'presupuesto', 'inicio', 'fin', 'enlace', 'creativos', 'mejoras'];

  return {
    lista: () => ({ status: 200, items: todos().map(copia) }),
    crear(cuerpo = {}) {
      const b = borradorPorDefecto(ahora());
      for (const k of PERMITIDOS) if (k in cuerpo) b[k] = structuredClone(cuerpo[k]);
      lista.unshift(b); return { status: 200, borrador: copia(b) };
    },
    cambiar(id, cuerpo = {}) {
      const b = busca(id); if (!b) return { status: 404, error: 'no', motivo: 'Ese borrador ya no está.' };
      terminar(b);
      if (b.estado === 'creado' || b.estado === 'creando') return { status: 409, error: 'creado', motivo: b.estado === 'creando' ? 'Se está creando en Meta: espera a que termine.' : 'Ya se creó en Meta: los cambios se hacen desde Campañas.' };
      for (const k of PERMITIDOS) if (k in cuerpo) b[k] = structuredClone(cuerpo[k]);
      if (b.estado === 'fallo') { b.estado = 'borrador'; b.error = null; }
      b.validacion = null; b.actualizadoAt = new Date(ahora()).toISOString();
      return { status: 200, borrador: copia(b) };
    },
    borrar(id) {
      const i = lista.findIndex(b => b.id === id); if (i < 0) return { status: 404, error: 'no', motivo: 'Ese borrador ya no está.' };
      if (lista[i].estado === 'creando') return { status: 409, error: 'creando', motivo: 'Se está creando en Meta: espera a que termine.' };
      papelera.push(lista.splice(i, 1)[0]); return { status: 200, ok: true };
    },
    validar(id) {
      const b = busca(id); if (!b) return { status: 404, error: 'no', motivo: 'Ese borrador ya no está.' };
      b.validacion = validarBorrador(b, { topes, ahora: ahora() }); return { status: 200, borrador: copia(b) };
    },
    crearEnMeta(id) {
      const b = busca(id); if (!b) return { status: 404, error: 'no', motivo: 'Ese borrador ya no está.' };
      terminar(b);
      if (b.estado === 'creado') return { status: 409, error: 'creado', motivo: 'Ya se creó en Meta.' };
      if (b.estado === 'creando') return { status: 202, borrador: copia(b) };
      const v = validarBorrador(b, { topes, ahora: ahora() }); b.validacion = v;
      if (!v.ok) return { status: 422, error: 'validacion', problemas: v.problemas };
      b.estado = 'creando'; b.error = null; b._listoAt = ahora() + tardaMs; b.actualizadoAt = new Date(ahora()).toISOString();
      return { status: 202, borrador: copia(b) };
    },
    vistaPrevia() { return { status: 409, error: 'demo', motivo: 'La vista previa de Meta necesita la oficina abierta y tu cuenta conectada: en el ejemplo ves la de la oficina.' }; },
    mejorar(id, { creativo, campo = 'texto' } = {}) {
      const b = busca(id); if (!b) return { status: 404, error: 'no', motivo: 'Ese borrador ya no está.' };
      const cr = (b.creativos || []).find(c => c.id === creativo) || b.creativos?.[Number(creativo)];
      if (!cr) return { status: 404, error: 'no', motivo: 'Ese creativo ya no está.' };
      return { status: 200, ...mejoraDemo(b, cr, campo === 'titular' ? 'titular' : 'texto') };
    },
    galeria: ({ q = '' } = {}) => { const s = q.trim().toLowerCase(); const items = GALERIA_DEMO.filter(g => !s || g.prompt.toLowerCase().includes(s)).map(({ src, ...g }) => g); return { status: 200, items, total: items.length, next: null }; },
  };
}
