// Agents Office — la prueba de ANUNCIOS con el token REAL de Meta (Fase A1, 8 oct 2026). SOLO LEE: no crea, no activa, no pausa,
// no cambia presupuestos. Se corre a mano, nunca en CI (los tests usan tests/meta-stand.mjs).
//   node scripts/check-meta-anuncios.mjs
// Lee: la cuenta publicitaria (office.config.local.json → anuncios.cuenta, la que pone Ajustes → Anuncios; o META_CUENTA=act_…), los
// permisos del token (ads_read / ads_management), la moneda y la zona (deben ser USD y America/Panama: no se cambian después), el
// estado de la cuenta, 3 campañas con su estado y aprendizaje, las cifras de 7 días y el lote de alcances. Y prueba, también solo
// leyendo, dos campos que el plan tiene POR VERIFICAR (§13): `advantage_state_info` de una campaña y `effective_instagram_media_id`
// de un creativo.
// El token viene del entorno (setx META_ACCESS_TOKEN "…"; META_APP_SECRET si tu app lo pide) y nunca se imprime. Lo confirmado va a
// data/salida-meta/anuncios-*.json (data/ no viaja por GitHub): con eso se quitan los «POR VERIFICAR» de anuncios/.
//
// Fase A3 (9 oct 2026): `--crear-pausada` además prueba CREAR, siempre EN PAUSA: valida con validate_only cada combinación de la tabla
// (anuncios/modelo.mjs → COMBINACIONES) y escribe cuáles pasa Meta; luego crea una campaña de prueba en pausa («Prueba de la oficina ·
// AO:check…»), con un conjunto y —con una imagen de prueba hecha con sharp— un creativo y un anuncio, todo PAUSED, y lo ARCHIVA enseguida
// (nunca borra). No gasta nada: nada se activa. Lo que Meta aceptó va a data/salida-meta/anuncios-crear-pausada.json.
//   node scripts/check-meta-anuncios.mjs --crear-pausada
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearMeta, mensajeMeta, VERSION_GRAPH, caducidad, PERMISOS_ANUNCIOS } from '../contenido/meta.mjs';
import { crearMetaAds, idCuenta } from '../anuncios/meta-ads.mjs';
import { cuentaEstado, estadoTexto, aprendizaje, fechaEn, rangos, RANGOS, cifras as cifrasDe, resultadoDe, deMeta } from '../anuncios/modelo.mjs';
import { loadConfig } from '../config.mjs';
import { normalizarBorrador, TODAS_LAS_COMBINACIONES } from '../anuncios/modelo.mjs';
import { cuerpoCampana, cuerpoConjunto, cuerpoCreativo, cuerpoAnuncio } from '../anuncios/construir.mjs';
import { resolverCuentas } from '../anuncios/crear.mjs';
const CREAR = process.argv.includes('--crear-pausada');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = process.env.AO_DATA ? path.resolve(process.env.AO_DATA) : path.join(ROOT, 'data');
const OUT = path.join(DATA, 'salida-meta');
const ok = s => console.log('  ✓ ' + s), aviso = s => console.log('  ! ' + s);
let failed = 0; const fail = (s, e) => { failed++; console.error('  ✗ ' + s + (e ? ' — ' + mensajeMeta(e) : '')); };
const guardar = (nombre, datos) => fs.writeFileSync(path.join(OUT, nombre), JSON.stringify(datos, null, 1));

const meta = crearMeta({ dir: path.join(DATA, 'contenido') });
if (!meta.configurado()) { console.error('Falta META_ACCESS_TOKEN en el entorno (Business Manager → Usuarios del sistema → Generar token). Ponlo con setx y abre otra terminal.'); process.exit(1); }
const cuenta = idCuenta(process.env.META_CUENTA || loadConfig().anuncios?.cuenta);
if (!cuenta) { console.error('Falta la cuenta publicitaria: ponla en Ajustes → Anuncios (act_…) o en META_CUENTA=act_… para esta prueba.'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
console.log(`Token detectado. Leyendo la cuenta ${cuenta}, sin cambiar nada… (salida: ${path.relative(ROOT, OUT)})\n`);
{ const c = caducidad(); console.log(`  · Graph API ${VERSION_GRAPH}${c.marketing === null ? '' : `, a la Marketing API le quedan ${c.marketing} días`}\n`); }
const ads = crearMetaAds({ meta });

// 1) los permisos
const est = await meta.sincronizar();
const permisos = est.token?.permisos;
if (permisos === null || permisos === undefined) aviso('Meta no dijo qué permisos tiene el token: se sigue y se verá al leer.');
else {
  const faltan = PERMISOS_ANUNCIOS.filter(p => !permisos.includes(p));
  if (!permisos.includes('ads_read') && !permisos.includes('ads_management')) fail('Al token le faltan ads_read y ads_management: sin ellos no se lee la cuenta');
  else if (faltan.length) aviso(`Al token le falta ${faltan.join(', ')}: para leer basta, pero para pausar y crear (Fases A2 y A3) hará falta. Genéralo una vez con todos (docs/conectar-meta.md).`);
  else ok('El token tiene ads_read y ads_management.');
}

// 2) la cuenta y su estructura (un lote)
let e = null;
try {
  e = await ads.estructura(cuenta);
  const c = e.cuenta, ce = cuentaEstado(c.account_status);
  guardar('anuncios-cuenta.json', { id: c.id, name: c.name, account_status: c.account_status, disable_reason: c.disable_reason, currency: c.currency, timezone_name: c.timezone_name, campanas: e.campanas.length, conjuntos: e.conjuntos.length, anuncios: e.anuncios.length, creativos: e.creativos.length, avisos: e.avisos });
  ok(`Cuenta «${c.name}» (${c.id}): ${ce.texto}${c.disable_reason ? ` (motivo ${c.disable_reason})` : ''} · gastado en total ${deMeta(c.amount_spent, c.currency)} ${c.currency}${deMeta(c.spend_cap, c.currency, { ceroEsNada: true }) !== null ? ` · límite de gasto ${deMeta(c.spend_cap, c.currency)}` : ' · sin límite de gasto en Meta (ponle uno: plan §2.2)'}`);
  if (ce.nivel !== 'ok') fail(`La cuenta no está activa: ${ce.texto}`);
  if (c.currency !== 'USD') fail(`La moneda es ${c.currency}, no USD: no se puede cambiar; decide antes de seguir (plan §2.2)`); else ok('Moneda: USD');
  if (c.timezone_name !== 'America/Panama') aviso(`La zona horaria es ${c.timezone_name}, no America/Panama: los días de las cifras se cuentan en ella.`); else ok('Zona horaria: America/Panama');
  ok(`Lote de estructura: ${e.campanas.length} campaña(s), ${e.conjuntos.length} conjunto(s), ${e.anuncios.length} anuncio(s), ${e.creativos.length} creativo(s)`);
  for (const a of e.avisos) aviso(a);
  for (const camp of e.campanas.slice(0, 3)) {
    const suyos = e.conjuntos.filter(s => s.campaign_id === camp.id);
    ok(`  «${camp.name}» (${camp.id}): ${estadoTexto(camp.effective_status)} · ${camp.objective} · ${suyos.length} conjunto(s)${suyos.length ? ': ' + suyos.slice(0, 3).map(s => `${estadoTexto(s.effective_status)}, ${aprendizaje(s.learning_stage_info).texto}${s.learning_stage_info ? '' : ' (sin learning_stage_info)'}`).join(' · ') : ''}`);
  }
  if (!e.campanas.length) aviso('La cuenta no tiene campañas: lo que sigue se prueba igual, pero vacío.');
} catch (err) { fail('Leer la cuenta y su estructura (lote)', err); }

// 3) las cifras de 7 días y el lote de alcances
if (e) {
  const zona = e.cuenta.timezone_name, hoy = fechaEn(zona), R = rangos(hoy);
  try {
    const filas = await ads.cifrasDiarias(cuenta, R['7d'][0], hoy);
    const tipos = [...new Set(filas.flatMap(f => (f.actions || []).map(a => a.action_type)))];
    guardar('anuncios-cifras.json', { desde: R['7d'][0], hasta: hoy, filas: filas.length, tiposDeAccion: tipos, muestra: filas.slice(0, 3) });
    const camp = e.campanas[0], c = camp ? cifrasDe(filas.filter(f => f.campaign_id === camp.id), resultadoDe(camp.objective, { optimizacion: e.conjuntos.find(s => s.campaign_id === camp.id)?.optimization_goal, destino: e.conjuntos.find(s => s.campaign_id === camp.id)?.destination_type })) : null;
    ok(`Cifras de 7 días: ${filas.length} fila(s) por anuncio y día; tipos de acción que da Meta: ${tipos.slice(0, 12).join(', ') || 'ninguno'}`);
    if (c) ok(`  «${camp.name}»: gastó ${c.gasto} · ${c.resultados ?? 'sin dato'} ${c.resultadoTexto}${c.costoPorResultado !== null ? ` a ${c.costoPorResultado}` : ''}`);
    if (tipos.length && !tipos.some(t => /messaging_conversation_started|link_click|purchase|lead|post_engagement/.test(t))) aviso('Ningún tipo de acción coincide con los que la oficina cuenta como resultado: pásale data/salida-meta/anuncios-cifras.json a Claude Code.');
  } catch (err) { fail('Cifras diarias (insights level=ad, time_increment=1)', err); }
  try {
    const a = await ads.alcances(cuenta, Object.fromEntries(RANGOS.map(k => [k, R[k]])));
    guardar('anuncios-alcance.json', a);
    ok(`Lote de alcances (personas únicas por rango): hoy ${a.hoy?.account ?? 'sin dato'}, 7 días ${a['7d']?.account ?? 'sin dato'}, 30 días ${a['30d']?.account ?? 'sin dato'}`);
  } catch (err) { fail('Lote de alcances (insights sin time_increment)', err); }
  // 4) lo POR VERIFICAR, solo leyendo
  const tk = await meta.tokenDe({});
  const probar = async (que, ruta, fields, archivo) => {
    try { const r = await meta.graph(tk, ruta, { params: { fields } }); guardar(archivo, r); ok(`VERIFICADO: ${que} existe en ${VERSION_GRAPH} (${JSON.stringify(r).slice(0, 120)}…)`); }
    catch (err) { aviso(`${que}: Meta no lo aceptó (${mensajeMeta(err)}). Se queda fuera de los campos que pide la oficina.`); }
  };
  if (e.campanas[0]) await probar('advantage_state_info de una campaña', `/${e.campanas[0].id}`, 'id,advantage_state_info', 'anuncios-advantage.json');
  if (e.creativos[0]) await probar('effective_instagram_media_id de un creativo', `/${e.creativos[0].id}`, 'id,effective_instagram_media_id,effective_object_story_id', 'anuncios-creativo.json');
}
// 5) --crear-pausada: crear EN PAUSA y archivar (nunca activa, nunca borra)
if (CREAR && e) {
  console.log('\n--crear-pausada: se valida cada combinación y se crea una campaña de prueba EN PAUSA, que se archiva enseguida.');
  const aj = loadConfig().anuncios || {}, cu = resolverCuentas({ ajustes: aj, cuentas: est.cuentas || [], paginaContenido: loadConfig().contenido?.metaPagina || '' });
  const salida = { at: new Date().toISOString(), version: VERSION_GRAPH, pagina: cu.pagina, instagram: cu.instagram, combinaciones: [], creado: [], archivado: [], errores: [] };
  if (!cu.pagina) fail('Sin página de Facebook (Ajustes → Anuncios o la de Contenido): no se puede probar crear');
  else {
    const ctx = { ajustes: { ...aj, topeCampana: 0 }, moneda: e.cuenta.currency || 'USD', pagina: cu.pagina, instagram: cu.instagram, pixel: aj.pixel, ahora: Date.now() };
    const inicio = new Date(Date.now() + 2 * 864e5).toISOString(), fin = new Date(Date.now() + 3 * 864e5).toISOString(), id = 'check' + Date.now().toString(36);
    for (const c of TODAS_LAS_COMBINACIONES()) {
      const dicho = c.objetivo + (c.destino ? '/' + c.destino : '');
      const falta = c.pide.filter(p => (p === 'whatsapp' && !aj.whatsapp) || (p === 'pixel' && !aj.pixel) || (p === 'instagram' && !cu.instagram));
      if (falta.length) { aviso(`Combinación ${dicho}: no se prueba (falta ${falta.join(', ')} en Ajustes → Anuncios)`); salida.combinaciones.push({ combinacion: dicho, probada: false, falta }); continue; }
      const b = normalizarBorrador({ nombre: 'Prueba de la oficina', objetivo: c.objetivo, ...(c.destino ? { destino: c.destino } : {}), presupuesto: { usd: 1 }, inicio, fin, enlace: 'https://www.facebook.com/' + cu.pagina }, null, { ajustes: aj, id });
      try { await ads.crearEn(cuenta, 'campana', cuerpoCampana(b, ctx), { validar: true }); ok(`validate_only acepta la campaña de ${dicho} (${c.objective})`); salida.combinaciones.push({ combinacion: dicho, campana: true }); }
      catch (err) { aviso(`validate_only NO acepta la campaña de ${dicho}: ${mensajeMeta(err)}`); salida.combinaciones.push({ combinacion: dicho, campana: false, error: mensajeMeta(err) }); }
    }
    // la de prueba: «que me escriban» por Messenger (no pide WhatsApp ni píxel), US$1 al día, empieza en 2 días, EN PAUSA
    const b = normalizarBorrador({ nombre: 'Prueba de la oficina', objetivo: 'mensajes', destino: 'messenger', presupuesto: { usd: 1 }, inicio, fin, creativos: [{ id: 'k1', media: 'prueba', texto: 'Prueba de la oficina: no se publica' }] }, null, { ajustes: aj, id });
    const creados = [];
    try {
      await ads.crearEn(cuenta, 'campana', cuerpoCampana(b, ctx), { validar: true }); ok('validate_only acepta la campaña de prueba');
      const camp = await ads.crearEn(cuenta, 'campana', cuerpoCampana(b, ctx)); creados.push(camp.id); ok(`Campaña de prueba creada EN PAUSA: ${camp.id}`);
      const conj = await ads.crearEn(cuenta, 'conjunto', cuerpoConjunto(b, ctx, camp.id)); creados.push(conj.id); ok(`Conjunto creado EN PAUSA: ${conj.id} (CONVERSATIONS → MESSENGER, Advantage+)`);
      salida.creado.push({ campana: camp.id, conjunto: conj.id });
      try {
        const img = await (await import('sharp')).default({ create: { width: 1080, height: 1080, channels: 3, background: { r: 230, g: 80, b: 40 } } }).jpeg().toBuffer();
        const { hash } = await ads.subirImagen(cuenta, { datos: img, nombre: 'prueba-oficina.jpg' }); ok(`Imagen subida a adimages (hash ${hash.slice(0, 8)}…)`);
        const cre = await ads.crearEn(cuenta, 'creativo', cuerpoCreativo(b, b.creativos[0], ctx, { hash })); ok(`Creativo creado: ${cre.id}`);
        const ad = await ads.crearEn(cuenta, 'anuncio', cuerpoAnuncio(b, b.creativos[0], conj.id, cre.id)); creados.push(ad.id); ok(`Anuncio creado EN PAUSA: ${ad.id}`);
        salida.creado.push({ creativo: cre.id, anuncio: ad.id });
        const hall = await ads.buscarPorNombre(cuenta, 'campana', cuerpoCampana(b, ctx).name, 'AO:' + id);
        if (hall.some(x => x.id === camp.id)) ok('La búsqueda por la etiqueta AO: encuentra la campaña (la reconciliación tras un corte funciona)'); else aviso('La búsqueda por nombre (filtering) no encontró la campaña: pásale la salida a Claude Code');
      } catch (err) { aviso(`Creativo o anuncio de prueba: ${mensajeMeta(err)}`); salida.errores.push({ paso: 'creativo/anuncio', error: mensajeMeta(err) }); }
    } catch (err) { fail('Crear la campaña de prueba en pausa', err); salida.errores.push({ paso: 'campana/conjunto', error: mensajeMeta(err) }); }
    for (const x of creados.reverse()) { try { await ads.cambiar(x, { status: 'ARCHIVED' }); salida.archivado.push(x); } catch (err) { fail(`No pude ARCHIVAR ${x}: archívalo a mano en el Administrador de anuncios`, err); } }
    if (salida.archivado.length) ok(`Archivado lo de prueba (${salida.archivado.length}): no gasta ni se entrega.`);
  }
  guardar('anuncios-crear-pausada.json', salida);
}
const u = meta.uso();
console.log(`\n  · Uso de la cuota de Meta tras la prueba: ${u.vistoAt ? `${Math.round(u.pct)} %` : 'Meta no mandó cabeceras de uso'}${u.frenadoHasta ? ` (pidió esperar hasta ${u.frenadoHasta})` : ''}`);
console.log(failed ? `\n${failed} cosa(s) fallaron: pásale a Claude Code lo de arriba y la carpeta ${path.relative(ROOT, OUT)}.` : '\nTodo bien: la oficina puede leer tu cuenta publicitaria.');
process.exit(failed ? 1 : 0);
