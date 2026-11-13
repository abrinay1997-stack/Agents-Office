// El ESTUDIO por el conector remoto (P3b). Las definiciones son las de estudio-tools.mjs (las mismas del stdio); aquí solo se adaptan al contrato del registro:
//  · LEER (alcance «lectura»): buscar_en_galeria, buscar_presets, estado_lote, estado_trabajo, estado_estudio — el ejecutor de siempre (`crearEstudio`) contra `office` en proceso.
//  · GASTAR (alcance «gasto», `soloPrepara`): generar_imagen/video/voz/musica, aplicar_preset y crear_lote. Por MCP NUNCA generan: calculan el costo con el catálogo y los topes de HOY y lo dicen.
//    El segundo paso es de una persona en el Estudio de la oficina (con su clic y sus topes: confirmación desde US$0,50, `trabajos.pedir` en el servidor). Nada de aquí llama a /api/media/jobs
//    con POST, a /presets/apply ni a /lotes: lo prueba cloudflare/tests/mcp-capa1.test.mjs.
//  · FUERA, con motivo: analizar_video y transcribir_audio (en la nube contestan 501, fase 8b) y ver_imagen (devuelve una IMAGEN, y el servidor remoto hoy solo devuelve texto).
//  · `crearEstudio` guarda estado (catálogo, banco, imágenes miradas): se crea UNO POR LLAMADA y nunca se reutiliza entre personas ni entre llamadas.
import { herramientas, crearEstudio, pilaDe, escenaDeAgente } from '../../../../../estudio-tools.mjs';
import { estimate } from '../../../../../media/catalogo.mjs';
import { weightOf } from '../../../../../estudio-pesos.mjs';

export const ESTUDIO_LEE = ['buscar_en_galeria', 'buscar_presets', 'estado_lote', 'estado_trabajo', 'estado_estudio'];
export const ESTUDIO_GASTA = ['generar_imagen', 'generar_video', 'generar_voz', 'generar_musica', 'aplicar_preset', 'crear_lote'];
export const ESTUDIO_FUERA = Object.freeze({
  analizar_video: 'En la nube, entender un video contesta 501 todavía (fase 8b del plan de la nube): ofrecerla sería una herramienta que siempre falla.',
  transcribir_audio: 'En la nube, transcribir un audio contesta 501 todavía (fase 8b del plan de la nube).',
  ver_imagen: 'Devuelve una IMAGEN, y el servidor MCP remoto hoy solo devuelve texto (+ structuredContent): se serviría vacía. Entra cuando el servidor admita contenido de imagen.',
});
const KIND = { generar_imagen: 'image', generar_video: 'video', generar_voz: 'audio', generar_musica: 'music' };
const DESC_MODELO = { type: 'string', maxLength: 80, description: 'Opcional: el id de un modelo encendido (estado_estudio los lista). Sin él, el del dueño.' };
const DESC_PREPARA = ' SOLO PREPARA por este conector: no genera nada ni gasta; devuelve el costo estimado y los topes de hoy, y el dueño lo genera en el Estudio de la oficina (E).';

/** Una instancia NUEVA por llamada (nunca compartida): su estado es de esa llamada. */
export function nuevoEstudio(office) {
  const patch = (ruta, cuerpo) => office(ruta, cuerpo, 'PATCH');
  return crearEstudio({ office, patch, quien: () => ({ by: 'mcp', agent: null, task: null }) });
}

/** Un esquema de estudio-tools → el del registro: raíz cerrada, objetos anidados sin lista de propiedades abiertos (el validador los dejaría pasar solo así), modelo sin lista fija. */
export function esquemaRemoto(inputSchema) {
  const copia = JSON.parse(JSON.stringify(inputSchema || { type: 'object', properties: {} }));
  const recorrer = (n, raiz) => {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'object') { if (raiz) n.additionalProperties = false; else if (n.additionalProperties === undefined) n.additionalProperties = !n.properties; }
    for (const v of Object.values(n.properties || {})) recorrer(v, false);
    if (n.items) recorrer(n.items, false);
  };
  copia.type = 'object'; copia.properties ||= {};
  if (copia.properties.modelo) copia.properties.modelo = { ...DESC_MODELO };
  if (copia.properties.voz) copia.properties.voz = { type: 'string', maxLength: 80, description: 'Opcional: el voiceId (una voz del sistema o una del dueño). Sin ella, Spanish_Narrator.' };
  // el detalle del escenario pesa ~3 KB por herramienta: aquí solo se nombran sus campos
  if (copia.properties.escena) copia.properties.escena = { type: 'object', additionalProperties: true, description: 'Opcional: el escenario 3D { producto, ancho_cm, alto_cm, profundidad_cm, giro, toma, encuadre, proporcion, lente, fondo, fondo_valor }. Solo cambia la receta; aquí no se genera.' };
  recorrer(copia, true);
  return copia;
}

/** Las definiciones del Estudio para el registro: todas las que se sirven, con su alcance y su descripción remota. */
export function definicionesEstudio() {
  // un catálogo «todo encendido» solo para obtener las definiciones completas; la lista de modelos de verdad la da estado_estudio en cada llamada
  const todo = { models: ['image', 'video', 'audio', 'music'].map((kind) => ({ id: `x-${kind}`, name: kind, kind, engine: 'minimax', on: true })), engines: [], default: {}, voices: { voices: [] } };
  const banco = { presets: [], sharp: true, fabrica: { canales: [] } };
  const defs = herramientas(todo, banco);
  const out = [];
  for (const d of defs) {
    if (ESTUDIO_FUERA[d.name]) continue;
    const gasta = ESTUDIO_GASTA.includes(d.name), lee = ESTUDIO_LEE.includes(d.name);
    if (!gasta && !lee) throw new Error(`estudio-tools tiene una herramienta nueva sin decidir (${d.name}): añádela a ESTUDIO_LEE, ESTUDIO_GASTA o ESTUDIO_FUERA.`);
    out.push({
      nombre: d.name, descripcion: gasta ? `${String(d.description).split('. ').slice(0, 2).join('. ').replace(/\.$/, '')}.${DESC_PREPARA}` : d.description,
      esquema: esquemaRemoto(d.inputSchema), alcance: gasta ? 'gasto' : 'lectura', soloLectura: lee, destructiva: false, ...(gasta ? { soloPrepara: true, idempotente: true } : {}),
    });
  }
  return out;
}

/* ---------- preparar un gasto (paso 1; el 2 es de una persona) ---------- */
const dinero = (n) => `US$${(+n || 0).toFixed(2).replace('.', ',')}`;
const topesTexto = (bu) => {
  if (!bu) return 'Topes: no pude leerlos.';
  const p = [bu.left == null ? 'sin tope diario de generaciones' : `quedan ${bu.left} de ${bu.limit} generaciones hoy (un video cuenta 5, una música 3, una imagen o una locución 1)`];
  if (bu.costLeftDay != null) p.push(`presupuesto de hoy: quedan ${dinero(bu.costLeftDay)} de ${dinero(bu.dailyBudget)}`);
  if (bu.costLeftMonth != null) p.push(`del mes: quedan ${dinero(bu.costLeftMonth)} de ${dinero(bu.monthlyBudget)}`);
  if (bu.maxPerRequest) p.push(`máximo por pedido: ${bu.maxPerRequest}`);
  return `Topes de hoy: ${p.join(' · ')}.`;
};
const cola = (usd) => `\nSegundo paso: lo da una persona. El dueño lo genera en el Estudio de la oficina (tecla E)${usd >= 0.5 ? ' con su confirmación (desde US$0,50 la oficina pide un segundo clic)' : ''}, o se lo pides a Dimitri en la oficina. Este conector no genera ni gasta.`;
const clip = (t, n = 240) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);

async function prepararModelo(office, nombre, a) {
  const kind = KIND[nombre], c = await office('/api/media/models');
  const id = typeof a.modelo === 'string' && a.modelo ? a.modelo : c.default?.[kind];
  const m = (c.models || []).find((x) => x.id === id && x.kind === kind);
  const lista = (c.models || []).filter((x) => x.on && x.kind === kind).map((x) => x.id).join(', ') || 'ninguno';
  if (!m) return { texto: `No hay un modelo «${clip(id, 60) || '—'}» de ${kind}. Los encendidos: ${lista}. No se preparó nada.`, error: true };
  if (!m.on) return { texto: `El modelo ${m.name} (${m.id}) no está encendido (le falta su llave). Los encendidos: ${lista}. No se preparó nada.`, error: true };
  const voz = nombre === 'generar_voz', musica = nombre === 'generar_musica';
  const prompt = voz ? a.texto : musica ? (String(a.letra || '').trim() || a.descripcion) : a.prompt;
  const n = voz || musica || kind === 'video' ? 1 : Math.min(8, Math.max(1, Math.round(+a.cantidad || 1)));
  const settings = { ...(a.formato ? { aspectRatio: a.formato } : {}), ...(a.segundos ? { duration: a.segundos } : {}), ...(voz && a.voz ? { voiceId: String(a.voz) } : {}) };
  const usd = estimate({ model: m.id, n, settings, prompt: String(prompt || '') });
  const peso = weightOf(kind) * n, bu = c.budget;
  const cabe = (bu?.left == null || peso <= bu.left) && (bu?.costLeftDay == null || usd <= bu.costLeftDay) && (bu?.costLeftMonth == null || usd <= bu.costLeftMonth) && (!bu?.maxPerRequest || n <= bu.maxPerRequest);
  const texto = `PREPARADO — no se generó nada.\n${n} ${kind === 'image' ? (n === 1 ? 'imagen' : 'imágenes') : kind === 'video' ? 'video' : kind === 'audio' ? 'locución' : 'pieza de música'} con ${m.name} (${m.id}): ${usd ? `unos ${dinero(usd)} (estimado)` : 'gratis'}.\n` +
    `Idea: «${clip(prompt)}»\n${topesTexto(bu)}\n${cabe ? 'Cabe dentro de los topes.' : 'NO cabe dentro de los topes de hoy: el Estudio lo rechazaría.'}${cola(usd)}`;
  const que = `${n} ${kind === 'image' ? (n === 1 ? 'imagen' : 'imágenes') : kind === 'video' ? 'video' : kind === 'audio' ? 'locución' : 'pieza de música'} con ${m.name}`;
  return { texto, usd, cabe, bu, que, idea: clip(prompt, 160) };
}

async function prepararBanco(office, nombre, a) {
  const b = await office('/api/media/presets').catch(() => null);
  const { pila, fuera, noImagen } = pilaDe(a.presets, b?.presets);
  if (!pila.length) return { error: true, texto: `Ningún preset de esa pila existe${fuera?.length ? ` (${fuera.map((x) => clip(x, 40)).join(', ')})` : ''}${noImagen ? '; y los de video, música o voz no se aplican a una imagen' : ''}. Búscalos con buscar_presets. No se preparó nada.` };
  const escena = escenaDeAgente(a.escena), canal = typeof a.canal === 'string' && /^[a-z0-9-]{2,30}$/.test(a.canal) ? a.canal : undefined;
  const referencias = a.referencia ? [{ id: String(a.referencia), ...(a.ejes && typeof a.ejes === 'object' ? { ejes: a.ejes } : {}) }] : [];
  const cuerpo = { pila, params: canal ? { canal } : {}, entradas: { foto: a.foto ? [String(a.foto)] : [], referencias }, idea: clip(a.idea, 1000), ...(escena ? { escena } : {}), ...(typeof a.modelo === 'string' && a.modelo ? { model: a.modelo } : {}) };
  const r = await office('/api/media/presets/compile', cuerpo); // compilar NO gasta: es la vista previa del propio Estudio
  const plan = r.plan || {}, errores = plan.errores || [], usd = Number(plan.costo?.usd) || 0, lote = nombre === 'crear_lote';
  const fotos = lote ? (Array.isArray(a.fotos) ? a.fotos.length : 0) : 1;
  const total = lote && fotos ? ` · ${fotos} fotos ≈ ${dinero(usd * fotos)}` : lote ? ' · por foto (el total depende de cuántas tenga la carpeta)' : '';
  const aviso = [...(plan.avisos || []), ...errores].map((x) => clip(typeof x === 'string' ? x : x?.es || x?.texto || JSON.stringify(x), 160)).filter(Boolean).slice(0, 4);
  const texto = `PREPARADO — no se ${lote ? 'creó ningún lote' : 'generó nada'}.\n${plan.resumen_es ? `Receta: ${clip(plan.resumen_es, 300)}.\n` : ''}Costo: ${plan.costo?.texto || (usd ? dinero(usd) : 'gratis')}${total}.\n` +
    `${aviso.length ? `Avisos: ${aviso.join(' · ')}\n` : ''}${errores.length ? 'NO se puede hacer así: corrige lo de arriba.\n' : ''}${topesTexto(r.budget)}${cola(usd * Math.max(1, fotos))}`;
  const total$ = usd * Math.max(1, fotos), bu = r.budget;
  const cabe = !errores.length && (bu?.costLeftDay == null || total$ <= bu.costLeftDay) && (bu?.costLeftMonth == null || total$ <= bu.costLeftMonth);
  const que = lote ? `lote «${clip(a.nombre, 60)}» (${fotos ? fotos + ' fotos' : 'fotos de la carpeta'})` : `preset ${pila.map((x) => x.id).join(' + ').slice(0, 80)}`;
  return { texto, usd: total$, cabe, bu, que, idea: clip(a.idea, 160), nota: lote && !fotos ? 'es el costo POR FOTO: el total depende de cuántas tenga la carpeta' : '', errores: errores.length };
}

/** `evaluarGasto(office, nombre, args)` → { texto, usd, cabe, bu, que, idea, nota?, error? }: lo que el SERVIDOR calcula (costo por el catálogo, topes de hoy). Lanza si la herramienta no existe. */
export async function evaluarGasto(office, nombre, args = {}) {
  if (KIND[nombre]) return prepararModelo(office, nombre, args);
  if (nombre === 'aplicar_preset' || nombre === 'crear_lote') return prepararBanco(office, nombre, args);
  throw new Error('herramienta desconocida: ' + nombre);
}
/** `preparar(office, nombre, args)` → texto. Lanza si algo no existe. */
export async function prepararGasto(office, nombre, args = {}) { return (await evaluarGasto(office, nombre, args)).texto; }
