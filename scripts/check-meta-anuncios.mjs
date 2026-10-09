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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearMeta, mensajeMeta, VERSION_GRAPH, caducidad, PERMISOS_ANUNCIOS } from '../contenido/meta.mjs';
import { crearMetaAds, idCuenta } from '../anuncios/meta-ads.mjs';
import { cuentaEstado, estadoTexto, aprendizaje, fechaEn, rangos, RANGOS, cifras as cifrasDe, resultadoDe, deMeta } from '../anuncios/modelo.mjs';
import { loadConfig } from '../config.mjs';

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
const u = meta.uso();
console.log(`\n  · Uso de la cuota de Meta tras la prueba: ${u.vistoAt ? `${Math.round(u.pct)} %` : 'Meta no mandó cabeceras de uso'}${u.frenadoHasta ? ` (pidió esperar hasta ${u.frenadoHasta})` : ''}`);
console.log(failed ? `\n${failed} cosa(s) fallaron: pásale a Claude Code lo de arriba y la carpeta ${path.relative(ROOT, OUT)}.` : '\nTodo bien: la oficina puede leer tu cuenta publicitaria.');
process.exit(failed ? 1 : 0);
