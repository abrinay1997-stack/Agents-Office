// Banco de presets: el ESQUEMA de un preset y de la fábrica, comprobado en frases (§4 y §12 de docs/propuesta-banco-presets.md).
// PURO: sin red ni archivos, lo usan el test, `npm run check`, el servidor y la página. Cada problema es una frase que
// nombra el preset y el campo, para que quien edita presets/*.json sepa qué arreglar sin leer código.
//
//   validarPreset(p, ctx)            → string[]   un preset de fábrica (ctx: lo de la fábrica, ver ctxDe)
//   validarFabrica(fab, opts)        → { problemas: string[], avisos: string[], servir: Map<id, {ok, modelos, motivo}> }
//   servible(p, capacidades)         → { ok, modelos: [id], motivo }   ¿hay un modelo del catálogo que lo haga?
//   expandirIncluye(id, byId)        → { lista: [id], problemas }      la receta aplanada (recursiva, sin ciclos ni repetidos)
//   marcadoresDe(texto)              → [nombre]                        los {marcadores} de una plantilla de prompt
//
// Las listas de valores admitidos (MEDIOS, MODOS, EJES…) son la ley del esquema: un valor nuevo se añade aquí primero.

export const ID_RE = /^[a-z0-9-]{3,40}$/;
export const MEDIOS = ['image', 'video', 'audio', 'music']; // los KINDS de media.mjs
export const MODOS_DE = { image: ['cero', 'foto', 'ref', 'foto+ref'], video: ['texto', 'anima', 'ab', 'refs', 'video'], music: ['texto'], audio: ['texto'] };
export const CAPAS = ['receta', 'ajuste'];
export const EJECUTORES = ['local', 'ia', 'local+ia', 'ajustes'];
export const EJES_EXCLUSIVOS = ['fondo', 'sombra', 'escena', 'encuadre', 'angulo', 'camara', 'plano', 'look', 'formato', 'audio', 'salida'];
export const EJES_SUMABLES = ['limpieza', 'calidad', 'luz', 'color', 'estilo', 'producto']; // «producto»: lo que se hace con el producto en un video
export const EJES = [...EJES_EXCLUSIVOS, ...EJES_SUMABLES];
export const ROLES = ['sujeto', 'referencia', 'inicial', 'final', 'guia', 'origen', 'extra', 'lut'];
export const MEDIOS_ENTRADA = ['image', 'video', 'audio', 'cube'];
// lo que copia una entrada «referencia» (§5.4): los siete ejes de la interfaz y los propios de algunos presets
export const EJES_REFERENCIA = ['estilo', 'color', 'composicion', 'luz', 'fondo', 'pose', 'producto', 'color-real', 'anuncio', 'escena', 'tipografia', 'persona', 'look'];
export const TIPOS_PROPIOS = ['enum', 'texto', 'rango', 'multi', 'voz']; // además de los compartidos de presets/tipos.json
export const POST = ['fondo-blanco', 'sombra-conservar', 'encuadrar', 'extender', 'igualar-serie', 'lut3d', 'transferir-color', 'exportar', 'exportar-varios', 'quitar-exif'];
export const QA = ['fondo-255', 'ocupacion', 'sin-recorte', 'lado-min', 'proporcion', 'peso', 'alfa', 'linea-suelo', 'identidad', 'delta-e', 'sin-texto'];
export const OPS_LOCALES = ['mascara', 'fondo-blanco', 'capa-sombra', 'sombra-conservar', 'encuadrar', 'extender', 'exposicion', 'sombras', 'altas', 'contraste',
  'saturacion', 'balance', 'dominante', 'temperatura', 'blanco-y-negro', 'auto-niveles', 'lut', 'lut3d', 'transferir-color', 'exportar-lut', 'grano',
  'igualar-serie', 'nitidez', 'ruido', 'rotar-horizonte', 'exportar', 'exportar-varios', 'quitar-exif'];
export const REQUIERE = ['edit', 'refsMin', 'roles', 'settings', 'local'];
export const RANURAS = ['camara', 'plano', 'accion', 'look', 'sfx', 'ambiente', 'escena', 'luz'];
/** Video: qué ranura del prompt llena un ajuste de cada eje exclusivo (un movimiento de cámara por clip va en «camara»). */
export const RANURA_DE_EJE_VIDEO = { camara: 'camara', plano: 'plano' };
export const ROLES_MODELO = ['start', 'end', 'video', 'reference']; // los roles de media.mjs que puede pedir `requiere.roles`
export const FASES = { image: [1, 4], video: [5], music: [6], audio: [6] };
export const ESTADOS = ['beta', 'estable'];
export const INTENSIDADES = ['suave', 'normal', 'fuerte'];
// los marcadores de una plantilla (§5.8): los del preset, y las ranuras que rellena el compilador en video
export const MARCADORES = ['idea', 'producto', 'conservar', 'encuadre', 'n1', 'camara', 'plano', 'lente', 'sujeto', 'accion', 'refs', 'escena', 'look', 'luz', 'sfx', 'ambiente', 'sonido'];
const CAMPOS = new Set(['id', 'v', 'nombre', 'tecnico', 'icono', 'categoria', 'frase', 'medios', 'capa', 'modos', 'ejes', 'exclusivo', 'ejecutor', 'entradas',
  'parametros', 'incluye', 'excluye', 'ia', 'iaPorIntensidad', 'local', 'requiere', 'prefer', 'ajustesModelo', 'post', 'qa', 'honestidad', 'aviso', 'buscar',
  'estrella', 'fase', 'estado', 'prompt', 'ranura', 'basadoEn', 'fijas',
  'bucle', 'soloRigidos']); // video: «bucle» (la foto final es la inicial) y «soloRigidos» (avisa si el producto es blando o transparente)
const PATH_RE = /^[Mm][MmLlHhVvCcSsQqTtAaZz0-9.,\s-]*$/;
const RATIO_RE = /^\d+(\.\d+)?:\d+$/;

/** Minúsculas, sin tildes ni diéresis (la ñ también pasa a n), sin signos y con un espacio entre palabras: la forma de `buscar`. */
export const normal = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9/:+.]+/g, ' ').trim();
const esTexto = (x, max) => typeof x === 'string' && x.trim() !== '' && (!max || x.length <= max);
const lista = x => Array.isArray(x) ? x : [];

/** Un trazo de icono válido: un solo `d` de path que empieza por M y solo trae órdenes y números. */
export const trazoValido = d => typeof d === 'string' && d.length > 2 && d.length < 2000 && PATH_RE.test(d.trim());

/** Los {marcadores} de una plantilla: «idea», «p.fuerza», «cifras.precio»… */
export const marcadoresDe = t => [...String(t ?? '').matchAll(/\{([A-Za-z0-9_.-]+)\}/g)].map(m => m[1]);

/** El contexto de validación que sale de una fábrica cargada (presets/fabrica.mjs → cargarFabrica). */
export function ctxDe(fab) {
  return {
    grupos: new Map(lista(fab.grupos).map(g => [g.id, g])), tipos: fab.tipos || {}, iconos: fab.iconos || {},
    canales: new Set(lista(fab.canales).map(c => c.id)), familias: fab.familias || {},
    byId: new Map(lista(fab.presets).filter(p => p && p.id).map(p => [p.id, p])),
  };
}

/** La receta aplanada: `incluye` recursivo (una receta puede incluir otra), en orden, sin repetidos; un ciclo o un id que
 *  no existe va en `problemas`. La lista final son los ids que se apilan. */
export function expandirIncluye(id, byId) {
  const plana = [], problemas = [];
  const ir = (x, camino) => {
    const p = byId.get(x);
    if (!p) { problemas.push(`«${camino.at(-2) ?? x}» incluye «${x}», que no existe`); return; }
    for (const h of lista(p.incluye)) {
      if (camino.includes(h)) { problemas.push(`«${id}» tiene un ciclo en incluye: ${[...camino, h].join(' → ')}`); continue; }
      const q = byId.get(h);
      if (!q) { problemas.push(`«${x}» incluye «${h}», que no existe`); continue; }
      if (q.capa === 'receta' && lista(q.incluye).length) ir(h, [...camino, h]); // una receta dentro de otra se abre
      else if (!plana.includes(h)) plana.push(h);
    }
  };
  ir(id, [id]);
  return { lista: plana, problemas };
}

/** Los problemas de un preset de fábrica, en frases. `ctx` = ctxDe(fabrica); sin él, solo se mira la forma. */
export function validarPreset(p, ctx = {}) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['un preset no es un objeto'];
  const id = typeof p.id === 'string' ? p.id : '?';
  const out = [], mal = (campo, frase) => out.push(`«${id}» · ${campo}: ${frase}`);
  const { grupos, tipos = {}, iconos = {}, canales, familias = {}, byId } = ctx;

  for (const k of Object.keys(p)) if (!CAMPOS.has(k)) mal(k, 'campo desconocido (¿una errata?)');
  if (!ID_RE.test(p.id || '')) mal('id', 'debe ser de 3 a 40 letras minúsculas, números o guiones');
  if (/^mio-/.test(p.id || '')) mal('id', '«mio-» es el prefijo de los presets del dueño, no de la fábrica');
  if (!Number.isInteger(p.v) || p.v < 1) mal('v', 'debe ser un entero desde 1 (sube con cada cambio)');
  if (!esTexto(p.nombre, 48)) mal('nombre', 'falta o pasa de 48 caracteres');
  if (p.tecnico !== undefined && !esTexto(p.tecnico, 48)) mal('tecnico', 'vacío o de más de 48 caracteres');
  if (!esTexto(p.frase, 140)) mal('frase', 'falta o pasa de 140 caracteres');

  // icono: { id, d } con el trazo de presets/iconos.json
  if (!p.icono || typeof p.icono !== 'object') mal('icono', 'falta { id, d }');
  else {
    if (!trazoValido(p.icono.d)) mal('icono', `el trazo de «${p.icono.id}» no es un path SVG válido`);
    if (ctx.iconos && !(p.icono.id in iconos)) mal('icono', `«${p.icono.id}» no está en presets/iconos.json`);
    else if (ctx.iconos && iconos[p.icono.id] !== p.icono.d) mal('icono', `el trazo no es el de «${p.icono.id}» en presets/iconos.json`);
  }

  const medios = lista(p.medios), medio = medios[0];
  if (medios.length !== 1 || !MEDIOS.includes(medio)) mal('medios', `debe ser uno de ${MEDIOS.join(', ')}`);
  if (grupos) {
    const g = grupos.get(p.categoria);
    if (!g) mal('categoria', `«${p.categoria}» no es un grupo de presets/grupos.json`);
    else if (g.medio !== medio) mal('categoria', `el grupo «${g.id}» es de ${g.medio} y el preset de ${medio}`);
  }
  if (!CAPAS.includes(p.capa)) mal('capa', 'debe ser «receta» o «ajuste»');
  const modos = lista(p.modos);
  if (!modos.length) mal('modos', 'falta al menos uno');
  for (const m of modos) if (!(MODOS_DE[medio] || []).includes(m)) mal('modos', `«${m}» no es un modo de ${medio || '?'} (${(MODOS_DE[medio] || []).join(', ')})`);
  if (new Set(modos).size !== modos.length) mal('modos', 'repetidos');
  const ejes = lista(p.ejes);
  if (!ejes.length) mal('ejes', 'falta al menos uno');
  for (const e of ejes) if (!EJES.includes(e)) mal('ejes', `«${e}» no es un eje (${EJES.join(', ')})`);
  const exclusivo = p.capa === 'ajuste' && ejes.some(e => EJES_EXCLUSIVOS.includes(e));
  if (p.exclusivo !== exclusivo) mal('exclusivo', `debe ser ${exclusivo}: se calcula (un ajuste en algún eje exclusivo)`);
  if (!EJECUTORES.includes(p.ejecutor)) mal('ejecutor', `debe ser ${EJECUTORES.join(', ')}`);

  // entradas
  const entradas = lista(p.entradas);
  for (const [i, e] of entradas.entries()) {
    const c = `entradas[${i}]`;
    if (!ROLES.includes(e?.rol)) { mal(c, `rol «${e?.rol}» desconocido`); continue; }
    if (!MEDIOS_ENTRADA.includes(e.medio)) mal(c, `medio «${e.medio}» desconocido`);
    if (!Number.isInteger(e.min) || !Number.isInteger(e.max) || e.min < 0 || e.max < Math.max(1, e.min)) mal(c, 'min y max deben ser enteros con 0 ≤ min ≤ max y max ≥ 1');
    if (!esTexto(e.es, 80)) mal(c, 'falta el rótulo «es»');
    if (e.rol === 'referencia' && !EJES_REFERENCIA.includes(e.eje)) mal(c, `una referencia dice qué copia (eje): «${e.eje}» no es uno de ${EJES_REFERENCIA.join(', ')}`);
    if (medio === 'image' && (e.rol === 'inicial' || e.rol === 'final')) mal(c, 'un preset de imagen nunca pide fotograma inicial ni final');
    if (e.rol === 'lut' && e.medio !== 'cube') mal(c, 'una LUT es un archivo .cube');
  }

  // parámetros
  const params = lista(p.parametros), pids = new Set();
  for (const [i, x] of params.entries()) {
    const c = `parametros[${i}]${x?.id ? ' «' + x.id + '»' : ''}`;
    if (!x || typeof x !== 'object') { mal(c, 'no es un objeto'); continue; }
    if (!/^[a-zA-Z][\w]*$/.test(x.id || '')) mal(c, 'id inválido');
    if (pids.has(x.id)) mal(c, 'id repetido'); pids.add(x.id);
    const compartido = tipos[x.tipo];
    if (!compartido && !TIPOS_PROPIOS.includes(x.tipo)) mal(c, `tipo «${x.tipo}» desconocido (los de presets/tipos.json o ${TIPOS_PROPIOS.join(', ')})`);
    if (!esTexto(x.es, 60)) mal(c, 'falta el rótulo «es»');
    const valores = Array.isArray(x.valores) ? x.valores : Array.isArray(compartido?.valores) ? compartido.valores : null;
    if (valores) {
      const vs = valores.map(v => v?.v);
      if (vs.some(v => typeof v !== 'string' || !v)) mal(c, 'cada valor lleva su «v»');
      if (new Set(vs).size !== vs.length) mal(c, 'valores repetidos');
      const defs = x.tipo === 'multi' ? String(x.def ?? '').split(',').filter(Boolean) : [String(x.def)];
      for (const d of defs) if (!vs.includes(d)) mal(c, `el valor por defecto «${d}» no está entre los permitidos`);
      if (compartido?.valores && Array.isArray(x.valores)) for (const v of x.valores) if (!compartido.valores.some(w => w.v === v.v)) mal(c, `«${v.v}» no es un valor del tipo «${x.tipo}»`);
    } else if (x.tipo === 'canal') { if (canales && !canales.has(x.def)) mal(c, `el canal por defecto «${x.def}» no está en presets/canales.json`); }
    else if (x.tipo === 'color') { if (!/^#[0-9A-Fa-f]{6}$/.test(x.def || '')) mal(c, 'el color por defecto debe ser #RRGGBB'); }
    else if (x.tipo === 'rango') { if (typeof x.def !== 'number' || (x.max !== undefined && x.def > x.max) || x.def < (x.min ?? 0)) mal(c, 'el valor por defecto debe ser un número dentro del rango'); }
    else if (x.tipo === 'texto') { if (typeof x.def !== 'string' || (x.max && x.def.length > x.max)) mal(c, 'el texto por defecto falta o se pasa de max'); }
    else if (x.def === undefined) mal(c, 'falta el valor por defecto');
  }

  // lo que hace: IA, local, prompt
  if (p.ia !== undefined && !esTexto(p.ia)) mal('ia', 'vacío');
  if (p.iaPorIntensidad !== undefined) { const k = Object.keys(p.iaPorIntensidad || {}); if (k.length !== 3 || !INTENSIDADES.every(i => esTexto(p.iaPorIntensidad[i]))) mal('iaPorIntensidad', 'lleva suave, normal y fuerte'); }
  for (const [i, o] of lista(p.local).entries()) if (!OPS_LOCALES.includes(o?.op)) mal(`local[${i}]`, `operación «${o?.op}» desconocida`);
  const usaLocal = p.ejecutor === 'local' || p.ejecutor === 'local+ia';
  if (p.ejecutor === 'local' && !lista(p.local).length && !lista(p.post).length) mal('local', 'un preset local dice qué operación hace');
  if (p.ejecutor === 'local' && lista(p.prefer).length) mal('prefer', 'un preset local no usa modelos');
  if (!usaLocal && lista(p.local).length) mal('local', `un preset «${p.ejecutor}» no hace pasos locales antes del modelo (van en post)`);
  for (const x of lista(p.post)) if (!POST.includes(x)) mal('post', `«${x}» no es un paso local conocido`);
  for (const x of lista(p.qa)) if (!QA.includes(x)) mal('qa', `«${x}» no es una comprobación conocida`);
  if (p.ranura !== undefined && !RANURAS.includes(p.ranura)) mal('ranura', `«${p.ranura}» no es una ranura (${RANURAS.join(', ')})`);
  for (const k of Object.keys(p.requiere || {})) if (!REQUIERE.includes(k)) mal('requiere', `«${k}» desconocido`);
  if (p.requiere?.local && p.ejecutor !== 'local') mal('requiere', '«local» solo en presets que corren enteros en la máquina');
  if (p.ajustesModelo !== undefined && (typeof p.ajustesModelo !== 'object' || Array.isArray(p.ajustesModelo))) mal('ajustesModelo', 'debe ser un objeto');
  if (!Array.isArray(p.prefer)) mal('prefer', 'debe ser una lista (vacía si da igual)');

  if (p.prompt === null) { if (p.ejecutor === 'ia' || p.ejecutor === 'local+ia') mal('prompt', `un preset «${p.ejecutor}» necesita su plantilla por familia`); }
  else if (!p.prompt || typeof p.prompt !== 'object') mal('prompt', 'debe ser null o { familia: plantilla }');
  else {
    if (p.ejecutor === 'local') mal('prompt', 'un preset local no tiene prompt (null)');
    for (const [fam, t] of Object.entries(p.prompt)) {
      if (fam !== 'modoCero' && ctx.familias && !(fam in familias)) mal('prompt', `«${fam}» no es una familia de presets/familias.json`);
      // música y voz: la «plantilla» son los ajustes del modelo (style, instrumental…) y el texto es el del dueño, literal
      const textos = t && typeof t === 'object' && !Array.isArray(t) && p.ejecutor === 'ajustes' ? Object.values(t).filter(x => typeof x === 'string') : [t];
      if (!textos.length || !textos.every(x => esTexto(x))) { mal('prompt', `la plantilla de «${fam}» está vacía`); continue; }
      for (const m of textos.flatMap(marcadoresDe)) {
        if (MARCADORES.includes(m) || /^cifras\.[a-z_]\w*$/i.test(m)) continue;
        if (m.startsWith('p.')) { if (!pids.has(m.slice(2))) mal('prompt', `«{${m}}» en «${fam}» no es un parámetro del preset`); continue; }
        mal('prompt', `marcador «{${m}}» desconocido en «${fam}»`);
      }
      if (textos.some(x => /\$\{|\d{2,}\s*(usd|us\$|\$)|\$\s*\d/i.test(x))) mal('prompt', `«${fam}» trae un precio escrito: los precios salen de cifras.json ({cifras.precio})`);
    }
    if (medio === 'image' && (p.ejecutor === 'ia' || p.ejecutor === 'local+ia') && p.prompt && modos.some(m => m !== 'cero') && !Object.keys(p.prompt).some(k => k !== 'modoCero' && k !== 'descriptiva'))
      mal('prompt', 'un preset que edita tu foto necesita al menos una plantilla de edición (conversacional, instrucciones o edicion-corta)');
  }
  if (p.honestidad !== undefined && !esTexto(p.honestidad, 200)) mal('honestidad', 'vacía o de más de 200 caracteres');
  if (p.aviso !== undefined && !esTexto(p.aviso, 200)) mal('aviso', 'vacío o de más de 200 caracteres');

  // receta: incluye / excluye
  if (p.incluye !== undefined) {
    if (p.capa !== 'receta') mal('incluye', 'solo una receta incluye ajustes');
    const inc = lista(p.incluye);
    if (new Set(inc).size !== inc.length) mal('incluye', 'repetidos');
    if (byId) {
      const { lista: plana, problemas } = expandirIncluye(p.id, byId);
      for (const x of problemas) mal('incluye', x);
      for (const x of plana) { const q = byId.get(x); if (q && q.capa !== 'ajuste') mal('incluye', `al abrirse deja «${x}», que no es un ajuste`); if (q && !lista(q.medios).includes(medio)) mal('incluye', `«${x}» es de otro medio`); }
    }
  }
  if (p.excluye !== undefined) for (const x of lista(p.excluye)) if (byId && !byId.has(x)) mal('excluye', `«${x}» no existe`);

  // video (§3.3, §5.2): un movimiento de cámara por clip, el bucle, los fotogramas y los ajustes del modelo
  for (const [i, x] of params.entries()) if (x?.ranura !== undefined && (medio !== 'video' || !RANURAS.includes(x.ranura))) mal(`parametros[${i}]`, `«ranura» solo en video y una de ${RANURAS.join(', ')}`);
  for (const k of ['bucle', 'soloRigidos']) if (p[k] !== undefined && (p[k] !== true || medio !== 'video')) mal(k, 'solo en un preset de video, y vale true');
  if (medio === 'video') {
    if (p.capa === 'ajuste') for (const [eje, r] of Object.entries(RANURA_DE_EJE_VIDEO)) if (ejes.includes(eje) && p.ia && p.ranura !== r) mal('ranura', `un ajuste de ${eje} va en la ranura «${r}» (tiene «${p.ranura ?? 'ninguna'}»)`);
    if (p.bucle && !modos.some(m => m === 'anima' || m === 'ab' || m === 'texto')) mal('bucle', 'un bucle anima una foto: modos «anima» o «ab»');
    if (entradas.some(e => e.rol === 'final') && !modos.includes('ab')) mal('modos', 'pide la foto de llegada (final): lleva el modo «ab»');
    if (entradas.some(e => (e.rol === 'origen' || e.rol === 'guia') && e.medio === 'video') && !modos.includes('video')) mal('modos', 'trabaja sobre un video: lleva el modo «video»');
    const am = p.ajustesModelo || {};
    if (am.aspectRatio !== undefined && !RATIO_RE.test(String(am.aspectRatio))) mal('ajustesModelo', `aspectRatio «${am.aspectRatio}» no es «ancho:alto»`);
    if (am.duration !== undefined && !(Number.isFinite(+am.duration) && +am.duration > 0)) mal('ajustesModelo', 'duration es un número de segundos');
    for (const k of ['generateAudio']) if (am[k] !== undefined && typeof am[k] !== 'boolean') mal('ajustesModelo', `${k} es true o false`);
  }
  for (const k of Object.keys(p.requiere?.roles || {})) if (!ROLES_MODELO.includes(k)) mal('requiere', `rol «${k}» desconocido (${ROLES_MODELO.join(', ')})`);
  for (const v of Object.values(p.ajustesModelo || {}).flat()) for (const m of typeof v === 'string' ? marcadoresDe(v) : []) if (!m.startsWith('p.') || !pids.has(m.slice(2))) mal('ajustesModelo', `«{${m}}» no es un parámetro del preset`);

  // buscar, estrella, fase, estado
  const buscar = lista(p.buscar);
  if (buscar.length < 3 || buscar.length > 30) mal('buscar', `lleva de 3 a 30 sinónimos (tiene ${buscar.length})`);
  for (const b of buscar) if (typeof b !== 'string' || !b.trim() || b !== b.trim().toLowerCase() || /[À-ɏ]/.test(b)) mal('buscar', `«${b}» va en minúsculas y sin tildes ni ñ (el buscador normaliza)`);
  if (new Set(buscar).size !== buscar.length) mal('buscar', 'sinónimos repetidos');
  if (typeof p.estrella !== 'boolean') mal('estrella', 'debe ser true o false');
  if (!(FASES[medio] || []).includes(p.fase)) mal('fase', `un preset de ${medio} va en la fase ${(FASES[medio] || []).join(' o ')} (tiene ${p.fase})`);
  if (!ESTADOS.includes(p.estado)) mal('estado', `debe ser ${ESTADOS.join(' o ')}`);
  if (p.basadoEn !== undefined || p.fijas !== undefined) mal('basadoEn', 'basadoEn y fijas son solo de los presets del dueño (notas del Cerebro)');
  return out;
}

/** ¿Lo hace algún modelo del catálogo? `capacidades`: [capsOf(m) + { ajustes: [claves de settings] }] de los modelos
 *  (encendidos o no: aquí se pregunta si el CATÁLOGO lo sirve). Un preset local no necesita modelo. */
export function servible(p, capacidades = []) {
  if (p.ejecutor === 'local') return { ok: true, modelos: [], motivo: 'en tu máquina (sharp)' };
  const kind = lista(p.medios)[0], rq = p.requiere || {}, roles = rq.roles || {};
  const fotoPropia = kind === 'image' && !!rq.edit;
  const motivos = [];
  const sirve = c => {
    if (c.kind !== kind || c.legacy || c.engine === 'prueba') return false;
    if (rq.edit && kind === 'image' && !c.editar) return motivos.push('edita una foto'), false;
    if (rq.refsMin && c.maxRefs < rq.refsMin + (fotoPropia ? 1 : 0)) return motivos.push(`toma ${rq.refsMin + (fotoPropia ? 1 : 0)} imágenes`), false;
    if (roles.start && !c.start) return motivos.push('toma un fotograma inicial'), false;
    if (roles.end && !c.end) return motivos.push('toma un fotograma final'), false;
    if (roles.video && (c.maxVideos || 0) < roles.video) return motivos.push('toma un video'), false;
    if (roles.reference && c.maxRefs < roles.reference) return motivos.push(`toma ${roles.reference} referencias`), false;
    for (const s of lista(rq.settings)) {
      if (s === 'background' && !c.transparencia) return motivos.push('da fondo transparente'), false;
      if (s === 'imageSize' && !lista(c.tamanos).length && !lista(c.ajustes).includes('imageSize')) return motivos.push('elige el tamaño'), false;
      if (s !== 'background' && s !== 'imageSize' && !lista(c.ajustes).includes(s)) return motivos.push(`tiene el ajuste «${s}»`), false;
    }
    return true;
  };
  const modelos = capacidades.filter(sirve).map(c => c.id);
  if (modelos.length) return { ok: true, modelos, motivo: '' };
  const falta = [...new Set(motivos)];
  return { ok: false, modelos, motivo: `ningún modelo de ${kind} del catálogo ${falta.length ? 'que ' + falta.join(' y ') : 'lo hace'}` };
}

/** El largo del prompt en el PEOR caso (sin la idea del dueño, que el compilador recorta): cada marcador por su valor más
 *  largo (la cláusula de la familia, el encuadre más largo, el parámetro más largo; una ranura de video, 80 caracteres).
 *  Con `tope` (el max de la familia o el maxPrompt de sus modelos) dice si cabe. */
export function largoPeor(p, fam, fab, ESPERA_RANURA = 80) {
  const t = p.prompt?.[fam]; if (typeof t !== 'string') return 0;
  const familia = fab.familias?.[fam] || {}, tipos = fab.tipos || {};
  const largoDe = par => { const vs = Array.isArray(par?.valores) ? par.valores : tipos[par?.tipo]?.valores; if (vs) return Math.max(0, ...vs.map(v => String(v.en ?? v.es ?? v.v).length)); return par?.tipo === 'texto' ? (par.max || 140) : String(par?.def ?? '').length; };
  const enc = Math.max(0, ...lista(tipos.encuadre?.valores).map(v => String(v.en || '').length), ...lista(p.parametros).filter(x => x.tipo === 'encuadre').flatMap(x => lista(x.valores).map(v => String(v.en || '').length)));
  return t.replace(/\{([A-Za-z0-9_.-]+)\}/g, (_, m) => {
    if (m === 'conservar') return 'x'.repeat(String(familia.conservar || '').length);
    if (m === 'encuadre') return 'x'.repeat(enc);
    if (m === 'idea') return '';
    if (m === 'n1') return '2';
    if (m === 'producto') return 'x'.repeat(40);
    if (m.startsWith('p.')) return 'x'.repeat(largoDe(lista(p.parametros).find(x => x.id === m.slice(2))));
    if (m.startsWith('cifras.')) return 'x'.repeat(12);
    return 'x'.repeat(ESPERA_RANURA);
  }).length;
}

/** Todo lo de la fábrica: cada preset, los grupos, los canales, las familias, los iconos, los sinónimos, los mínimos y
 *  (si se pasan `capacidades`) que cada preset lo sirva algún modelo. `opts.minimos`: { image: 70, video: 25 }. */
export function validarFabrica(fab, { capacidades = null, minimos = { image: 70, video: 25 } } = {}) {
  const problemas = [...lista(fab.problemas)], avisos = [], ctx = ctxDe(fab);
  const ids = new Set();
  for (const p of lista(fab.presets)) {
    if (p?.id && ids.has(p.id)) problemas.push(`el id «${p.id}» está repetido`);
    if (p?.id) ids.add(p.id);
    problemas.push(...validarPreset(p, ctx));
  }
  // grupos
  const gids = new Set(), ordenes = new Set();
  for (const g of lista(fab.grupos)) {
    if (!ID_RE.test(g.id || '') || gids.has(g.id)) problemas.push(`grupo «${g.id}»: id inválido o repetido`);
    gids.add(g.id);
    if (!esTexto(g.nombre, 40) || !esTexto(g.frase, 140)) problemas.push(`grupo «${g.id}»: falta el nombre o la frase`);
    if (!(g.icono in (fab.iconos || {}))) problemas.push(`grupo «${g.id}»: el icono «${g.icono}» no está en presets/iconos.json`);
    if (![...MEDIOS, 'todos'].includes(g.medio)) problemas.push(`grupo «${g.id}»: medio «${g.medio}» desconocido`);
    if (ordenes.has(g.orden)) problemas.push(`grupo «${g.id}»: el orden ${g.orden} está repetido`); ordenes.add(g.orden);
    if (g.medio !== 'todos' && !lista(fab.presets).some(p => p.categoria === g.id)) problemas.push(`grupo «${g.id}» (${g.nombre}): no tiene ningún preset`);
  }
  // canales
  const cids = new Set();
  for (const c of lista(fab.canales)) {
    const n = `canal «${c.id}»`;
    if (!/^[a-z0-9-]{2,40}$/.test(c.id || '') || cids.has(c.id)) problemas.push(`${n}: id inválido o repetido`); cids.add(c.id);
    if (!esTexto(c.nombre, 60)) problemas.push(`${n}: falta el nombre`);
    if (!RATIO_RE.test(c.proporcion || '')) problemas.push(`${n}: proporción «${c.proporcion}» no es «ancho:alto»`);
    if (!Number.isInteger(c.ancho) || !Number.isInteger(c.alto) || c.ancho < 64 || c.alto < 64) problemas.push(`${n}: ancho y alto en píxeles enteros`);
    if (c.ocupacion !== undefined && c.ocupacion !== null && !(c.ocupacion > 0 && c.ocupacion <= 1)) problemas.push(`${n}: la ocupación va de 0 a 1`);
    if (!['jpg', 'png', 'webp'].includes(c.formato)) problemas.push(`${n}: formato «${c.formato}» (jpg, png o webp)`);
    if (c.fondo !== null && c.fondo !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(c.fondo)) problemas.push(`${n}: el fondo es #RRGGBB o null`);
    if (!esTexto(c.fuente)) problemas.push(`${n}: falta la fuente del número`);
  }
  // familias
  for (const [k, f] of Object.entries(fab.familias || {})) {
    if (!lista(f?.modelos).length) problemas.push(`familia «${k}»: no dice qué modelos van en ella`);
    if (f?.max !== undefined && !(Number.isInteger(f.max) && f.max > 0)) problemas.push(`familia «${k}»: max debe ser un entero`);
  }
  // iconos
  for (const [k, d] of Object.entries(fab.iconos || {})) if (!trazoValido(d)) problemas.push(`icono «${k}»: el trazo no es un path SVG válido`);
  const usados = new Set([...lista(fab.presets).map(p => p?.icono?.id), ...lista(fab.grupos).map(g => g.icono)]);
  const sinUso = Object.keys(fab.iconos || {}).filter(k => !usados.has(k));
  if (sinUso.length) avisos.push(`iconos sin usar (para los presets del dueño): ${sinUso.join(', ')}`);
  // sinónimos del buscador
  const fr = fab.sinonimos?.frases;
  if (fr !== undefined) {
    if (!fr || typeof fr !== 'object') problemas.push('presets/sinonimos.json: «frases» debe ser un objeto { frase: [términos] }');
    else for (const [k, v] of Object.entries(fr)) {
      if (k !== normal(k)) problemas.push(`sinónimo «${k}»: la frase va normalizada («${normal(k)}»)`);
      if (!lista(v).length || lista(v).some(t => typeof t !== 'string' || t !== normal(t))) problemas.push(`sinónimo «${k}»: lleva una lista de términos normalizados`);
    }
    for (const x of lista(fab.sinonimos?.ids ? Object.values(fab.sinonimos.ids).flat() : [])) if (!ids.has(x)) problemas.push(`presets/sinonimos.json: «${x}» no es un preset`);
  }
  // mínimos (§12)
  const n = m => lista(fab.presets).filter(p => lista(p.medios).includes(m)).length;
  for (const [m, min] of Object.entries(minimos || {})) if (n(m) < min) problemas.push(`hay ${n(m)} presets de ${m}: el mínimo es ${min}`);
  // ¿lo sirve algún modelo?
  const servir = new Map();
  const capById = new Map(lista(capacidades).map(c => [c.id, c]));
  // el prompt cabe en su familia (max) y en el maxPrompt de los modelos de esa familia
  for (const p of lista(fab.presets)) for (const fam of Object.keys(p.prompt || {})) {
    if (fam === 'modoCero' || typeof p.prompt[fam] !== 'string') continue;
    const topes = [fab.familias?.[fam]?.max, ...lista(capacidades).filter(c => c.familia === fam && !c.legacy).map(c => c.maxPrompt)].filter(n => Number.isInteger(n) && n > 0);
    const tope = topes.length ? Math.min(...topes) : 4000, largo = largoPeor(p, fam, fab);
    if (largo > tope) problemas.push(`«${p.id}» · prompt: la plantilla de «${fam}» llega a ${largo} caracteres y la familia admite ${tope}`);
  }
  if (capacidades) for (const p of lista(fab.presets)) for (const m of lista(p.prefer)) {
    const c = capById.get(m);
    if (!c) problemas.push(`«${p.id}» · prefer: «${m}» no es un modelo del catálogo`);
    else if (c.kind !== lista(p.medios)[0]) problemas.push(`«${p.id}» · prefer: «${m}» es de ${c.kind}, el preset de ${lista(p.medios)[0]}`);
  }
  if (capacidades) for (const p of lista(fab.presets)) {
    const s = servible(p, capacidades); servir.set(p.id, s);
    if (!s.ok) (p.fase === 1 ? problemas : avisos).push(`«${p.id}» sin servir: ${s.motivo}`);
  }
  return { problemas, avisos, servir };
}
