// ============================================================
// Reglas de cada red para una pieza de contenido (puro)
//
// PORTADO de Juancito Ads — juanarrietabusiness-pixel/CALENDARIOS-MARKETING-APP, src/lib/publicacion.js
// (commit a100fd2, 30 sep 2026). Es la MISMA regla: si la oficina dijera «lista» y Meta la rechazara a la hora de
// salir, sería porque las dos copias se separaron. Lo que se cambió al traerlo, y solo eso:
//   · se quitó lo del cliente externo (publicacionParaCliente, diaParaCliente, rutasDeMedios, marcarActualizada)
//   · momentoPublicacion pasó a llamarse `momentoLocal`: allí la hora es Panamá fijo (UTC−5); aquí es la del reloj de esta máquina.
//     `momentoDeVariante` (la historia sale unos minutos después del post) usa la nueva
//   · se añadió `postDePieza`, que traduce una pieza de la oficina (nota con cabecera) a la forma que estas funciones esperan
//   · (1 oct 2026, auditoría CON-03/PRE-02) los medios llevan sus MEDIDAS (`medidaDeItem`, del registro .json del Estudio): sin ellas
//     ninguna regla de proporción ni de duración se disparaba. Con ellas: la duración del reel (3 s a 15 min) y de la historia (60 s),
//     la proporción de la historia (9:16, aviso) y la del feed (error con su arreglo, porque aquí todavía nada la ajusta sola: F3).
//     El aviso del JPEG dice la verdad (la conversión aún no existe). `revisarMomento` (CON-06): con hora, y en el futuro.
// Los campos siguen llamándose como allá (format, medios, descripcion, hashtagsFinales…) para poder comparar un archivo con el otro.
// Lo importan el navegador (el panel de la pieza) y el servidor (la cola de programación, en F3).
// Cubierto por tests/contenido-reglas.test.mjs, que trae los casos de src/lib/publicacion.test.js de allá.
// ============================================================

/** Límites de cada red que hacen fallar una publicación si se pasan. */
export const LIMITES = Object.freeze({
  instagram: { caracteres: 2200, hashtags: 30, menciones: 20, carruselMin: 2, carruselMax: 10, reelMinSeg: 3, reelMaxSeg: 900, historiaMaxSeg: 60 },
  facebook: { caracteres: 63206 },
  tiktok: { caracteres: 2200, videoMaxSeg: 600 },
  // M2 (6 oct 2026): las redes que también publica Metricool. Fuente: la ayuda de cada red y de Metricool (oct 2026); los topes que las
  // redes cambian a menudo (imágenes por post, duración del video) van al valor más prudente. Por verificar con la API real.
  linkedin: { caracteres: 3000, imagenesMax: 9, videoMaxSeg: 600 },
  x: { caracteres: 280, imagenesMax: 4, videoMaxSeg: 140, enlace: 23 },
  threads: { caracteres: 500, mediosMax: 10, videoMaxSeg: 300 },
  bluesky: { caracteres: 300, imagenesMax: 4, videoMaxSeg: 180 },
  pinterest: { titulo: 100, caracteres: 500 },
  youtube: { titulo: 100, caracteres: 5000, shortMaxSeg: 180 },
});

export const REDES = Object.freeze({
  instagram: { nombre: "Instagram", icono: "photo" },
  facebook: { nombre: "Facebook", icono: "globe" },
  tiktok: { nombre: "TikTok", icono: "video" },
  linkedin: { nombre: "LinkedIn", icono: "briefcase" },
  x: { nombre: "X", icono: "text" },
  threads: { nombre: "Threads", icono: "text" },
  bluesky: { nombre: "Bluesky", icono: "text" },
  pinterest: { nombre: "Pinterest", icono: "pin" },
  youtube: { nombre: "YouTube", icono: "video" },
});

/** Las redes con historias (las demás no las tienen, ni por API). */
export const CON_HISTORIAS = Object.freeze(["instagram", "facebook"]);

/*
 * C1 (8 oct 2026, de la oficina, no de Juancito Ads): el FORMATO DE CADA RED. Una pieza tiene su `formato` (el de Instagram, o el de su
 * primera red) y, si otra red sale distinta, `formatos: { red: formato }` (el mismo video como reel en Instagram y como post en Facebook).
 * Sin `formatos`, todo es como antes: un formato para todas. Lo que ofrece cada red, el de por defecto primero; las de una sola opción
 * publican cualquier formato que no sea historia como su publicación (en X, un «carrusel» es un post con varias imágenes).
 */
export const FORMATOS_RED = Object.freeze({
  instagram: ["post", "carrusel", "reel", "historia"], facebook: ["post", "reel", "historia"], youtube: ["post", "reel"],
  tiktok: ["reel"], linkedin: ["post"], x: ["post"], threads: ["post"], bluesky: ["post"], pinterest: ["post"],
});
const FORMATO_NOMBRE = { post: "Post", carrusel: "Carrusel", reel: "Reel", historia: "Historia" };
const NOMBRE_EN_RED = { youtube: { post: "Video", reel: "Short" }, tiktok: { reel: "Video" }, pinterest: { post: "Pin" }, linkedin: { post: "Publicación" } };
/** El formato con que sale en esa red una pieza (`formato`, `formatos`) o un post de estas reglas (`format`, `formatos`). */
export const formatoDe = (x, red) => x?.formatos?.[red] || x?.formato || x?.format || "post";
/** Ese formato como lo entiende esa red: en Facebook un carrusel es un post con varias fotos; en YouTube lo que no es Short es un video. */
export function formatoVisible(red, f) {
  const ops = FORMATOS_RED[red];
  if (!ops || ops.includes(f) || f === "historia") return f;
  return red === "youtube" ? "post" : ops[0];
}
/** Cómo se llama ese formato en esa red: «Short» en YouTube, «Pin» en Pinterest, «Video» en TikTok. */
export const nombreFormato = (red, f) => { const v = formatoVisible(red, f); return NOMBRE_EN_RED[red]?.[v] || FORMATO_NOMBRE[v] || v; };
/** ¿Esa red tiene ese formato? (X no tiene historias; Instagram, todos.) */
export const formatoValido = (red, f) => (FORMATOS_RED[red] || ["post"]).includes(formatoVisible(red, f));
/** El formato con que entra una red nueva en la pieza: el de la pieza si esa red lo tiene; si no, el primero de los suyos. */
export const formatoInicial = (red, formato) => (formatoValido(red, formato) ? formato : (FORMATOS_RED[red] || ["post"])[0]);

/**
 * De los formatos de cada red (`efectivos`: { red: formato }) a lo que se guarda: `formato` es el de Instagram (o el de la primera red) y
 * `formatos`, solo las redes que salen distinto. Dos formatos que esa red publica igual (un carrusel en Facebook es un post) no son distintos.
 */
export function normalizarFormatos(redes, efectivos) {
  const rs = (redes || []).filter((r) => efectivos?.[r]);
  if (!rs.length) return { formato: "post", formatos: {} };
  const formato = efectivos[rs.includes("instagram") ? "instagram" : rs[0]], formatos = {};
  for (const r of rs) if (formatoVisible(r, efectivos[r]) !== formatoVisible(r, formato)) formatos[r] = efectivos[r];
  return { formato, formatos };
}
const efectivosDe = (x, redes) => Object.fromEntries(redes.map((r) => [r, formatoDe(x, r)]));
/** Cambiar el formato de una red: las demás se quedan como estaban. → { formato, formatos } */
export function ponFormato(p, red, f, redes = p?.redes?.length ? p.redes : ["instagram"]) {
  const ef = efectivosDe(p, redes); ef[red] = f;
  return normalizarFormatos(redes, ef);
}
/** Las redes cambian (se añade o se quita una): cada una conserva su formato; la que entra toma el de la pieza si lo tiene. → { formato, formatos } */
export function formatosConRedes(p, redes) {
  const ef = {};
  for (const r of redes) ef[r] = (p?.redes || []).includes(r) ? formatoDe(p, r) : formatoInicial(r, p?.formato || p?.format || "post");
  return normalizarFormatos(redes, ef);
}
/** Las redes agrupadas por su formato, en el orden de las redes: [{ formato, redes }]. Una sola si todas salen igual. */
export function gruposDeFormato(x, redes = x?.redes ?? ["instagram"]) {
  const g = new Map();
  for (const r of redes) { const f = formatoDe(x, r); if (!g.has(f)) g.set(f, []); g.get(f).push(r); }
  return [...g].map(([formato, rs]) => ({ formato, redes: rs }));
}

/**
 * Cuánto mide un texto para una red, como lo cuenta ella: X cuenta cada enlace como 23 (t.co); Bluesky cuenta grafemas (un emoji
 * compuesto es uno); las demás, caracteres.
 */
export function longitudPara(texto, red) {
  const t = String(texto ?? "");
  if (red === "x") return t.replace(/https?:\/\/\S+/g, "x".repeat(LIMITES.x.enlace)).length;
  if (red === "bluesky" && typeof Intl !== "undefined" && Intl.Segmenter) return [...new Intl.Segmenter("es", { granularity: "grapheme" }).segment(t)].length;
  return t.length;
}

const esVideo = (src = "", tipo = "") => tipo === "video" || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(src);

/** Instagram sólo publica imágenes JPEG. */
export const esJPEG = (src = "") => /\.jpe?g(\?|$)/i.test(src);

/** El feed de Instagram acepta de 4:5 (0,8) a 1.91:1. Con un pelo de tolerancia. */
export const PROPORCION_FEED = Object.freeze({ min: 0.795, max: 1.915 });

/** Una historia es 9:16 (0,5625). Lo que se aleje se encaja para que Instagram no la amplíe y corte. */
export const PROPORCION_HISTORIA = Object.freeze({ min: 0.55, max: 0.575 });

/**
 * Cómo se adapta una imagen que no cabe: la imagen entera sobre fondo
 * difuminado, sobre el color de la marca, recortada, o AMPLIADA con IA
 * (Nano Banana dibuja el fondo que falta). «ia» es la única que no se
 * hace sola al programar: cuesta dinero y se pide con un botón; si falta
 * la copia, sale difuminada.
 */
export const AJUSTES = Object.freeze({
  difuminado: "Completa, con fondo difuminado",
  color: "Completa, con el color de la marca",
  recorte: "Recortada al centro",
  ia: "Ampliada con IA (Nano Banana)",
});

/** La proporción que se le pide a la IA para llevar una imagen a su objetivo. */
export function proporcionParaIA(ancho, alto, objetivo) {
  if (objetivo === "historia") return "9:16";
  return ancho / alto > PROPORCION_FEED.max ? "16:9" : "4:5";
}

/** Minutos entre el post y su historia, por defecto. */
export const RETRASO_HISTORIA_MIN = 15;

/** Instagram admite hasta 3 colaboradores (cuentas públicas) en post, carrusel y reel. */
export const MAX_COLABORADORES = 3;

/** Los usuarios colaboradores, limpios: sin «@», sin repetidos, válidos. */
export function colaboradoresDe(post) {
  const lista = Array.isArray(post?.colaboradores) ? post.colaboradores : String(post?.colaboradores ?? "").split(/[\s,]+/);
  return [...new Set(lista.map((u) => String(u ?? "").trim().replace(/^@/, "").toLowerCase()).filter((u) => /^[\w.]{1,30}$/.test(u)))];
}

/**
 * El momento exacto en que sale una pieza: su día y su hora, en el reloj de esta máquina. Sin hora, a las 9:00.
 * Devuelve ISO en UTC (un INSTANTE), o null si la fecha no vale.
 */
export function momentoLocal(fecha, hora) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha ?? ""))) return null;
  const h = /^\d{2}:\d{2}$/.test(String(hora ?? "")) ? hora : "09:00";
  const d = new Date(`${fecha}T${h}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toJSON();
}

/**
 * Los medios de una publicación, en orden. Las publicaciones de antes
 * tienen sólo `image`; las nuevas, `medios`. Siempre devuelve la misma
 * forma: [{ src, tipo: "imagen" | "video", nombre }].
 */
export function mediosDe(post) {
  if (Array.isArray(post?.medios) && post.medios.length) {
    return post.medios
      .filter((m) => m && typeof m.src === "string" && m.src)
      .map((m) => ({
        src: m.src, tipo: esVideo(m.src, m.tipo) ? "video" : "imagen", nombre: m.nombre ?? "",
        ...(m.ancho && m.alto ? { ancho: m.ancho, alto: m.alto } : {}),
        ...(Number(m.duracion) > 0 ? { duracion: Number(m.duracion) } : {}),
      }));
  }
  if (typeof post?.image === "string" && post.image) {
    return [{ src: post.image, tipo: esVideo(post.image) ? "video" : "imagen", nombre: "" }];
  }
  return [];
}

/**
 * Lo que se guarda al cambiar los medios: `medios` y, por compatibilidad,
 * `image` con la primera IMAGEN —la usan el HTML exportado, la IA y las
 * vistas de antes—.
 */
export function conMedios(post, medios) {
  const lista = (medios ?? []).filter((m) => m?.src);
  const primeraImagen = lista.find((m) => m.tipo !== "video")?.src ?? null;
  return { ...post, medios: lista, image: primeraImagen };
}

/** Las imágenes o videos de la historia que acompaña al post, con la forma de `mediosDe`. */
export function historiasDe(post) {
  return mediosDe({ medios: Array.isArray(post?.historias) ? post.historias : [] });
}

/** ¿Sale también como historia? Sólo un post (no una historia ni un directo) con historias preparadas. */
export const conHistoria = (post) =>
  Boolean(post?.historiaTambien) && !["historia", "live"].includes(post?.format) && historiasDe(post).length > 0;

/**
 * Lo que se publica de una publicación en cada red: la publicación y, si
 * se pidió, su historia. TikTok no tiene historias por API.
 */
export function piezasDe(post, redes = post?.redes ?? ["instagram"]) {
  const salida = [];
  for (const red of redes) {
    salida.push({ red, variante: "post" });
    if (red !== "tiktok" && conHistoria(post)) salida.push({ red, variante: "historia" });
  }
  return salida;
}

/** La publicación tal como sale en una variante: la historia es otra publicación con los medios de la historia. */
export function publicacionDeVariante(post, variante = "post") {
  if (variante !== "historia") return post;
  return { ...post, format: "historia", medios: historiasDe(post), image: null, colaboradores: [] };
}

/** A qué hora sale una variante: la historia, unos minutos después del post. */
export function momentoDeVariante(fecha, hora, post, variante = "post") {
  const base = momentoLocal(fecha, hora);
  if (!base || variante !== "historia") return base;
  const retraso = Number.isFinite(Number(post?.historiaRetraso)) ? Math.min(Math.max(Number(post.historiaRetraso), 0), 240) : RETRASO_HISTORIA_MIN;
  return new Date(Date.parse(base) + retraso * 60_000).toJSON();
}

/**
 * A qué forma hay que llevar las imágenes en una red: «feed» (4:5 a
 * 1.91:1) o «historia» (9:16). null si esa red las acepta como vengan.
 */
export function objetivoDe(post, red) {
  if (red === "instagram") {
    const d = destinoInstagram(post);
    if (d === "historia") return "historia";
    if (d === "imagen" || d === "carrusel") return "feed";
    return null;
  }
  if (red === "facebook" && post?.format === "historia") return "historia";
  return null;
}

/** ¿Esta imagen hay que encajarla para ese objetivo? Sin medidas no se sabe: se mide al programar. */
export function necesitaAjuste(medio, objetivo) {
  if (medio?.tipo !== "imagen" || !objetivo || !medio.ancho || !medio.alto) return false;
  const r = medio.ancho / medio.alto;
  const P = objetivo === "historia" ? PROPORCION_HISTORIA : PROPORCION_FEED;
  return r < P.min || r > P.max;
}

/**
 * El tamaño al que se lleva una imagen que no cabe (puro, para probarlo):
 * historia 1080×1920; feed, 1080×1350 si es demasiado alta y 1080×566 si
 * es demasiado ancha. Lo que ya cabe se queda como está.
 */
export function medidasAjuste(ancho, alto, objetivo) {
  if (objetivo === "historia") return { ancho: 1080, alto: 1920 };
  const r = ancho / alto;
  if (r < PROPORCION_FEED.min) return { ancho: 1080, alto: 1350 };
  if (r > PROPORCION_FEED.max) return { ancho: 1080, alto: 566 };
  return { ancho, alto };
}

/** La clave de una copia adaptada: por objetivo y por imagen original. */
export const claveAdaptado = (objetivo, src) => `${objetivo}|${src}`;

/**
 * Los medios que salen en una red, con las copias adaptadas en lugar de
 * los originales cuando las hay. El original no se toca: la página de
 * aprobación, el cliente y las demás redes lo ven tal cual.
 */
export function mediosParaRed(post, red, variante = "post") {
  const p = publicacionDeVariante(post, variante);
  const medios = mediosDe(p);
  const objetivo = objetivoDe(p, red);
  if (!objetivo) return medios;
  return medios.map((m) => {
    const a = post?.adaptados?.[claveAdaptado(objetivo, m.src)];
    return a?.src && m.tipo === "imagen" ? { ...m, src: a.src, ancho: a.ancho, alto: a.alto, original: m.src } : m;
  });
}

export const contarHashtags = (texto) => (String(texto ?? "").match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
export const contarMenciones = (texto) => (String(texto ?? "").match(/(^|\s)@[\w.]+/g) ?? []).length;

/**
 * El texto que sale en una red: la descripción, más los hashtags si no
 * van en el primer comentario. Facebook puede llevar su propio texto.
 */
export function textoPara(post, red = "instagram") {
  // M2: una red con su propio texto (`textos[red]`) lo lleva tal cual, sin añadirle los hashtags: se escribió a la medida de esa red
  const propio = red !== "facebook" && String(post?.textos?.[red] ?? "").trim();
  if (propio) return propio;
  const base = red === "facebook" && post?.textoFacebook?.trim()
    ? post.textoFacebook
    : String(post?.descripcion || post?.script || "");
  const hashtags = String(post?.hashtagsFinales ?? "").trim();
  if (!hashtags || post?.hashtagsEnComentario) return base.trim();
  // No se duplican si la descripción ya los trae al final.
  if (base.includes(hashtags)) return base.trim();
  return `${base.trim()}\n\n${hashtags}`.trim();
}

/** El primer comentario que se publica tras el post (Instagram). */
export function primerComentario(post) {
  const partes = [];
  if (post?.primerComentario?.trim()) partes.push(post.primerComentario.trim());
  if (post?.hashtagsEnComentario && post?.hashtagsFinales?.trim()) partes.push(post.hashtagsFinales.trim());
  return partes.join("\n\n");
}

/** Qué se publica en Instagram según el formato: feed, carrusel, reel o historia. */
export function destinoInstagram(post) {
  const medios = mediosDe(post);
  if (post?.format === "historia") return "historia";
  if (post?.format === "reel") return "reel";
  if (medios.length > 1) return "carrusel";
  return medios[0]?.tipo === "video" ? "reel" : "imagen";
}

/**
 * Lo que impide publicar (errores) y lo que conviene saber (avisos),
 * para cada red elegida. Sin errores, se puede programar.
 */
export function revisarPublicacion(post, redes = post?.redes ?? ["instagram"], { navegador = false } = {}) {
  // C1: con un formato por red, cada grupo de redes del mismo formato se revisa con el suyo, y la historia «también» una vez al final
  const grupos = gruposDeFormato(post, redes);
  if (grupos.length <= 1) return revisarGrupo({ ...post, format: grupos[0]?.formato ?? post?.format }, redes, null, navegador, true);
  const errores = [], avisos = [], arreglos = {};
  for (const g of grupos) {
    const r = revisarGrupo({ ...post, format: g.formato }, redes, g.redes, navegador, false);
    for (const t of r.errores) if (!errores.includes(t)) errores.push(t);
    for (const t of r.avisos) if (!avisos.includes(t)) avisos.push(t);
    for (const [t, a] of Object.entries(r.arreglos)) {
      if (arreglos[t]) continue; // el arreglo de un formato toca solo las redes de ese formato
      arreglos[t] = a.codigo.startsWith("formato:") ? { codigo: `${a.codigo}:${g.redes.join(",")}`, etiqueta: `${a.etiqueta} en ${g.redes.map((r) => REDES[r]?.nombre || r).join(" y ")}` } : a;
    }
  }
  const con = (lista, texto, arreglo) => { if (!lista.includes(texto)) lista.push(texto); if (arreglo) arreglos[texto] = arreglo; };
  revisarHistoriaTambien(post, redes, con, errores, avisos);
  return { errores, avisos, arreglos };
}

/** Las reglas para las redes `solo` (o todas) con el formato de `post`; `redes` son todas las de la pieza (quitar una solo se ofrece si queda otra). */
function revisarGrupo(post, redes, solo, navegador, conHistoriaTambien) {
  const mira = (r) => redes.includes(r) && (!solo || solo.includes(r));
  const errores = [];
  const avisos = [];
  // El arreglo de cada problema que lo tiene, por su texto: el panel lo
  // pinta como botón al lado (ver `aplicarArreglo`).
  const arreglos = {};
  const con = (lista, texto, arreglo) => { lista.push(texto); if (arreglo) arreglos[texto] = arreglo; };
  const medios = mediosDe(post);
  const videos = medios.filter((m) => m.tipo === "video");

  if (post?.format === "live") {
    errores.push("Un directo no se puede publicar por API: queda sólo como planificación.");
    return { errores, avisos, arreglos };
  }

  if (mira("instagram")) {
    const L = LIMITES.instagram;
    const texto = textoPara(post, "instagram");
    const deIG = mediosParaRed(post, "instagram");
    if (!medios.length) con(errores, "Instagram necesita al menos una imagen o un video.", { codigo: "medios", etiqueta: "Añadir imagen o video" });
    if (post?.format === "reel" && !videos.length) {
      con(errores, "Un reel necesita un video.", medios.length
        ? { codigo: medios.length > 1 ? "formato:carrusel" : "formato:post", etiqueta: medios.length > 1 ? "Publicarlo como carrusel" : "Publicarlo como post" }
        : null);
    }
    if (post?.format === "carrusel" && medios.length > 0 && medios.length < L.carruselMin) {
      con(errores, "Un carrusel necesita al menos 2 imágenes o videos.", { codigo: "formato:post", etiqueta: "Publicarlo como post" });
    }
    if (medios.length > L.carruselMax) {
      con(errores, `Instagram admite hasta ${L.carruselMax} elementos por ${post?.format === "historia" ? "tanda de historias" : "carrusel"}.`, { codigo: "recortar-medios", etiqueta: `Quedarse con los ${L.carruselMax} primeros` });
    }
    if (post?.format === "historia" && medios.length > 1) avisos.push(`Salen ${medios.length} historias seguidas, en este orden.`);
    if (post?.format === "historia" && texto) avisos.push("Una historia no muestra el texto: el texto va dentro de la imagen o el video.");
    if (texto.length > L.caracteres) {
      const mover = !post?.hashtagsEnComentario && String(post?.hashtagsFinales ?? "").trim() &&
        textoPara({ ...post, hashtagsEnComentario: true }, "instagram").length <= L.caracteres;
      con(errores, `El texto de Instagram tiene ${texto.length} caracteres; el máximo es ${L.caracteres}.`,
        mover ? { codigo: "hashtags-al-comentario", etiqueta: "Mover los hashtags al primer comentario" } : null);
    }
    const h = contarHashtags(texto) + (post?.hashtagsEnComentario ? contarHashtags(post?.hashtagsFinales) : 0);
    if (h > L.hashtags) {
      con(errores, `Instagram admite ${L.hashtags} hashtags y hay ${h}.`,
        contarHashtags(post?.hashtagsFinales) ? { codigo: "recortar-hashtags", etiqueta: `Dejar ${L.hashtags} hashtags` } : null);
    }
    if (contarMenciones(texto) > L.menciones) errores.push(`Instagram admite ${L.menciones} menciones.`);
    const objetivo = objetivoDe(post, "instagram");
    const fuera = deIG.find((m) => objetivo === "feed" && necesitaAjuste(m, "feed"));
    if (fuera) {
      if (navegador) avisos.push(`Una imagen mide ${fuera.ancho}×${fuera.alto}, fuera de lo que admite el feed (de 4:5 a 1.91:1): al programar se ajusta sola (${AJUSTES[post?.ajusteIG] ?? AJUSTES.difuminado}).`);
      else {
        const vertical = fuera.ancho / fuera.alto < PROPORCION_FEED.min;
        con(errores, `Una imagen mide ${fuera.ancho}×${fuera.alto}: el feed de Instagram acepta de 4:5 (vertical) a 1.91:1 (horizontal). Recórtala en el Estudio${vertical ? " o publícala como historia" : ""}.`,
          vertical && medios.length === 1 ? { codigo: "formato:historia", etiqueta: "Publicarla como historia" } : null);
      }
    }
    if (post?.format === "historia") {
      const ancha = medios.find((m) => m.tipo === "imagen" && m.ancho && m.alto && necesitaAjuste(m, "historia"));
      if (ancha) avisos.push(`Una imagen mide ${ancha.ancho}×${ancha.alto}, no 9:16: en la historia sale con bandas o recortada. Lo ideal es vertical, 1080×1920.`);
      const larga = videos.find((m) => m.duracion > L.historiaMaxSeg);
      if (larga) errores.push(`Un video de historia dura como mucho ${L.historiaMaxSeg} s y este dura ${Math.round(larga.duracion)} s.`);
    }
    if (destinoInstagram(post) === "reel") {
      const v = videos[0];
      if (v?.duracion > L.reelMaxSeg) errores.push(`Un reel dura como mucho ${L.reelMaxSeg / 60} minutos y este dura ${Math.round(v.duracion / 60)}.`);
      else if (v?.duracion && v.duracion < L.reelMinSeg) errores.push(`Un reel dura al menos ${L.reelMinSeg} segundos y este dura ${v.duracion}.`);
    }
    const noJpeg = deIG.filter((m) => m.tipo === "imagen" && !esJPEG(m.src)).length;
    if (noJpeg) {
      avisos.push(`Instagram sólo acepta JPEG y ${noJpeg === 1 ? "una imagen es" : noJpeg + " imágenes son"} PNG o WebP: al programarla, la oficina ${noJpeg === 1 ? "la convierte" : "las convierte"} a JPEG sola (el original del Estudio no se toca).`); // M1 (6 oct 2026): el conductor la convierte (contenido/conductores.mjs)
    }
    const colab = colaboradoresDe(post);
    if (colab.length > MAX_COLABORADORES) {
      con(errores, `Instagram admite hasta ${MAX_COLABORADORES} colaboradores y hay ${colab.length}.`, { codigo: "recortar-colaboradores", etiqueta: `Dejar los ${MAX_COLABORADORES} primeros` });
    }
    if (colab.length && post?.format === "historia") {
      con(avisos, "Las historias no llevan colaboradores: sólo se invitan en posts, carruseles y reels.", { codigo: "quitar-colaboradores", etiqueta: "Quitar colaboradores" });
    }
  }

  if (mira("facebook")) {
    const texto = textoPara(post, "facebook");
    if (post?.format === "historia") {
      if (!medios.length) con(errores, "Una historia de Facebook necesita una imagen o un video.", quitarRed(redes, "facebook"));
    } else {
      if (!medios.length && !texto) con(errores, "Facebook necesita texto o al menos una imagen o un video.", quitarRed(redes, "facebook"));
      if (videos.length && medios.length > 1) avisos.push("Facebook no mezcla video y fotos en una publicación: se publicará sólo el video.");
    }
    if (texto.length > LIMITES.facebook.caracteres) errores.push("El texto de Facebook es demasiado largo.");
  }

  if (mira("tiktok")) {
    if (!videos.length) con(errores, "TikTok necesita un video.", quitarRed(redes, "tiktok"));
    const texto = textoPara(post, "tiktok");
    if (texto.length > LIMITES.tiktok.caracteres) errores.push(`El texto de TikTok tiene ${texto.length} caracteres; el máximo es ${LIMITES.tiktok.caracteres}.`);
  }

  if (mira("tiktok") && post?.format === "historia") con(errores, "TikTok no tiene historias.", quitarRed(redes, "tiktok"));

  // M2 (6 oct 2026): LinkedIn, X, Threads, Bluesky, Pinterest y YouTube
  const imagenes = medios.filter((m) => m.tipo !== "video");
  const nombre = (red) => REDES[red].nombre;
  const largo = (red, max) => {
    const n = longitudPara(textoPara(post, red), red);
    if (n > max) con(errores, `El texto de ${nombre(red)} tiene ${n} caracteres; el máximo es ${max}.`, String(post?.textos?.[red] ?? "").trim() ? null : { codigo: `texto-red:${red}`, etiqueta: `Escribir uno para ${nombre(red)}` });
  };
  const sinHistorias = (red) => { if (post?.format === "historia") con(errores, `${nombre(red)} no tiene historias.`, quitarRed(redes, red)); };
  const algo = (red) => { if (!medios.length && !textoPara(post, red)) con(errores, `${nombre(red)} necesita texto o al menos una imagen o un video.`, quitarRed(redes, red)); };
  const videoLargo = (red, max) => { const v = videos.find((m) => m.duracion > max); if (v) errores.push(`Un video de ${nombre(red)} dura como mucho ${max % 60 === 0 ? `${max / 60} min` : `${max} s`} y este dura ${Math.round(v.duracion)} s.`); };
  const mezcla = (red) => { if (videos.length && medios.length > 1) con(errores, `${nombre(red)} no mezcla un video con otros archivos: deja solo el video o solo las imágenes.`, quitarRed(redes, red)); };
  for (const red of ["linkedin", "x", "threads", "bluesky"]) {
    if (!mira(red)) continue;
    const L = LIMITES[red];
    sinHistorias(red); algo(red); largo(red, L.caracteres); videoLargo(red, L.videoMaxSeg);
    if (red !== "threads") mezcla(red);
    if (L.imagenesMax && imagenes.length > L.imagenesMax) errores.push(`${nombre(red)} admite hasta ${L.imagenesMax} imágenes por publicación y hay ${imagenes.length}.`);
    if (L.mediosMax && medios.length > L.mediosMax) con(errores, `${nombre(red)} admite hasta ${L.mediosMax} archivos por publicación y hay ${medios.length}.`, { codigo: "recortar-medios", etiqueta: `Quedarse con los ${L.carruselMax ?? 10} primeros` });
  }
  if (mira("pinterest")) {
    const L = LIMITES.pinterest, pin = post?.pinterest || {};
    sinHistorias("pinterest");
    if (!medios.length) con(errores, "Pinterest necesita una imagen o un video.", quitarRed(redes, "pinterest"));
    else if (medios.length > 1) avisos.push("Pinterest publica un pin con el primer archivo: los demás no salen allí.");
    if (!String(pin.tablero ?? "").trim()) con(errores, "Pinterest necesita un tablero: escribe su id en «Pinterest», en el paso 3.", { codigo: "opciones:pinterest", etiqueta: "Elegir el tablero" });
    if (String(pin.titulo ?? "").length > L.titulo) errores.push(`El título del pin tiene ${String(pin.titulo).length} caracteres; el máximo es ${L.titulo}.`);
    if (pin.enlace && !/^https:\/\/\S+$/.test(pin.enlace)) errores.push("El enlace del pin tiene que empezar por https://.");
    largo("pinterest", L.caracteres);
  }
  if (mira("youtube")) {
    const L = LIMITES.youtube, yt = post?.youtube || {};
    sinHistorias("youtube");
    if (!videos.length) con(errores, "YouTube necesita un video.", quitarRed(redes, "youtube"));
    else if (medios.length > 1) avisos.push("YouTube publica solo el video: las imágenes no salen allí.");
    const titulo = String(yt.titulo ?? "").trim();
    if (!titulo) con(errores, "YouTube necesita un título: escríbelo en «YouTube», en el paso 3.", { codigo: "opciones:youtube", etiqueta: "Escribir el título" });
    else if (titulo.length > L.titulo) errores.push(`El título de YouTube tiene ${titulo.length} caracteres; el máximo es ${L.titulo}.`);
    largo("youtube", L.caracteres);
    const v = videos[0];
    if (post?.format === "reel" && v?.duracion > L.shortMaxSeg) con(errores, `Un Short dura como mucho ${L.shortMaxSeg / 60} minutos y este dura ${Math.round(v.duracion / 60)}.`, { codigo: "formato:post", etiqueta: "Publicarlo como video normal" });
    if (post?.format === "reel" && v?.ancho && v?.alto && v.ancho >= v.alto) avisos.push("Un Short es vertical: este video es horizontal y YouTube lo publicará como video normal.");
  }

  if (conHistoriaTambien) revisarHistoriaTambien(post, redes, con, errores, avisos);
  return { errores, avisos, arreglos };
}

/** La historia que acompaña al post («también como historia»): solo si alguna red no sale ya como historia. */
function revisarHistoriaTambien(post, redes, con, errores, avisos) {
  if (post?.historiaTambien && redes.some((r) => !["historia", "live"].includes(formatoDe(post, r)))) {
    const hs = historiasDe(post);
    if (!hs.length) {
      con(errores, "Marcaste «también como historia», pero no hay ninguna imagen de historia: créala con IA o usa la del post.", { codigo: "sin-historia", etiqueta: "No publicar historia" });
    }
    else if (hs.length > LIMITES.instagram.carruselMax) errores.push(`Como mucho ${LIMITES.instagram.carruselMax} historias por publicación.`);
    else if (!redes.some((r) => CON_HISTORIAS.includes(r))) avisos.push(`${redes.map((r) => REDES[r]?.nombre || r).join(", ")} no ${redes.length === 1 ? "tiene" : "tienen"} historias: la historia no saldrá.`);
    else if (redes.some((r) => !CON_HISTORIAS.includes(r))) avisos.push("La historia sale sólo en Instagram y Facebook: las demás redes no tienen historias.");
  }
}

/** «Quitar esta red», sólo si queda otra: quitar la única no arregla nada. */
const quitarRed = (redes, red) => (redes.length > 1 ? { codigo: `quitar-red:${red}`, etiqueta: `Quitar ${REDES[red].nombre}` } : null);

/**
 * Aplica el arreglo de un problema (el `codigo` de `revisarPublicacion`)
 * y devuelve la publicación nueva. Sólo toca lo que dice el arreglo: lo
 * escrito no se reescribe. «medios» no cambia nada: lo resuelve el panel
 * abriendo la subida.
 */
export function aplicarArreglo(post, codigo) {
  const [accion, valor] = String(codigo).split(":");
  const redes = Array.isArray(post?.redes) && post.redes.length ? post.redes : ["instagram"];
  switch (accion) {
    case "formato": { // «formato:post» cambia el de todas; «formato:post:instagram,facebook» (C1), solo el de esas redes
      const solo = String(codigo).split(":")[2];
      if (!solo) return post?.formatos && Object.keys(post.formatos).length ? { ...post, format: valor, formatos: {} } : { ...post, format: valor };
      const ef = efectivosDe(post, redes); for (const r of solo.split(",")) if (redes.includes(r)) ef[r] = valor;
      const n = normalizarFormatos(redes, ef); return { ...post, format: n.formato, formatos: n.formatos };
    }
    case "recortar-medios": return conMedios(post, mediosDe(post).slice(0, LIMITES.instagram.carruselMax));
    case "hashtags-al-comentario": return { ...post, hashtagsEnComentario: true };
    case "recortar-hashtags": {
      const enTexto = post?.hashtagsEnComentario ? 0 : contarHashtags(post?.descripcion || post?.script);
      const libres = Math.max(0, LIMITES.instagram.hashtags - enTexto);
      const tags = String(post?.hashtagsFinales ?? "").match(/#[\p{L}\p{N}_]+/gu) ?? [];
      return { ...post, hashtagsFinales: tags.slice(0, libres).join(" ") };
    }
    case "recortar-colaboradores": return { ...post, colaboradores: colaboradoresDe(post).slice(0, MAX_COLABORADORES) };
    case "quitar-colaboradores": return { ...post, colaboradores: [] };
    case "quitar-red": return { ...post, redes: redes.filter((r) => r !== valor) };
    case "sin-historia": return { ...post, historiaTambien: false };
    // «texto-red:x» y «opciones:pinterest» no cambian nada aquí: el panel abre ese campo para que lo escribas tú

    default: return post;
  }
}

/**
 * Una pieza de la oficina (la nota con cabecera, ver contenido/piezas.mjs) con la forma que esperan las reglas de arriba. Los campos de la pieza
 * están en español porque se leen y se editan en el Cerebro; aquí se les pone el nombre que tienen en Juancito Ads.
 */
export function postDePieza(p = {}) {
  // `medidas` (no se guarda en la nota: lo pone quien la lee) es { id: { ancho, alto, duracion } }, del registro de cada archivo del Estudio
  const conMedida = (m) => (typeof m === "string" ? { src: m, ...(p.medidas?.[m] ?? {}) } : m);
  return {
    id: p.id, format: p.formato || "post", redes: Array.isArray(p.redes) && p.redes.length ? p.redes : ["instagram"],
    medios: (p.medios ?? []).map(conMedida),
    descripcion: p.texto ?? "", hashtagsFinales: p.hashtags ?? "", hashtagsEnComentario: !!p.hashtagsEnComentario,
    primerComentario: p.comentario ?? "", textoFacebook: p.textoFacebook ?? "",
    historias: (p.historias ?? []).map(conMedida), historiaTambien: !!p.historiaTambien, formatos: p.formatos ?? {}, // C1: el formato de cada red que sale distinto
    colaboradores: p.colaboradores ?? [], ajusteIG: p.ajusteIG, adaptados: p.adaptados,
    textos: p.textos ?? {}, pinterest: p.pinterest ?? null, youtube: p.youtube ?? null, tiktok: p.tiktok ?? null, // M2
  };
}

/**
 * Las medidas de un archivo del Estudio, de su registro (.json al lado, o un elemento de /api/media): { ancho, alto, duracion } con lo
 * que se sepa. Un video no trae ancho y alto (no se lee su cabecera): se toman de su proporción («9:16» → 9×16), que es lo que importa.
 */
export function medidaDeItem(it) {
  if (!it || typeof it !== "object") return null;
  const out = {};
  const w = Number(it.w ?? it.ancho), h = Number(it.h ?? it.alto);
  if (w > 0 && h > 0) { out.ancho = w; out.alto = h; }
  else {
    const r = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(it.settings?.aspectRatio ?? it.aspectRatio ?? ""));
    if (r) { out.ancho = Number(r[1]); out.alto = Number(r[2]); }
  }
  const d = Number(it.duracion ?? it.duration ?? it.seconds ?? it.settings?.duration);
  if (d > 0) out.duracion = d;
  return Object.keys(out).length ? out : null;
}

/** Meta programa una publicación de Página entre 10 minutos y 75 días antes; aquí, lo mismo para todo. */
export const PROGRAMAR = Object.freeze({ minMin: 10, maxDias: 75 });

/**
 * ¿Se puede aprobar para ESE momento? Sin hora no (la hora la decide el dueño, no un «9:00» de relleno); una hora que ya pasó (o a menos de
 * 10 minutos), tampoco: nunca saldría. Más allá de 75 días, un aviso. Devuelve { errores, avisos, momento } (momento en ms, o null).
 */
export function revisarMomento(fecha, hora, ahora = Date.now(), { minMin = PROGRAMAR.minMin } = {}) { // C1: «Publicar ya» aprueba para dentro de 5 minutos (minMin: 4)
  const errores = [], avisos = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha ?? ""))) return { errores: ["Ponle un día para poder aprobarla."], avisos, momento: null };
  if (!/^\d{2}:\d{2}$/.test(String(hora ?? ""))) return { errores: ["Ponle una hora: sin hora no se sabe cuándo sale."], avisos, momento: null };
  const momento = new Date(`${fecha}T${hora}:00`).getTime();
  if (momento < ahora + minMin * 60_000) errores.push(momento < ahora ? "Esa hora ya pasó: elige un día y una hora que vengan." : `Sale en menos de ${minMin} minutos: Meta pide al menos ${minMin} de margen.`);
  else if (momento > ahora + PROGRAMAR.maxDias * 864e5) avisos.push(`Sale dentro de más de ${PROGRAMAR.maxDias} días: Meta no programa con tanta antelación; quedará esperando aquí hasta entonces.`);
  return { errores, avisos, momento };
}
