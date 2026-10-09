// Agents Office — la prueba de la BANDEJA con un token REAL de Meta (Fase B1, 9 oct 2026). SOLO LEE: no responde, no oculta, no borra.
// Se corre a mano, nunca en CI:
//   node scripts/check-meta-bandeja.mjs
// Lee 3 publicaciones de Instagram y 3 de Facebook y sus comentarios con LOS MISMOS CAMPOS que pide la oficina (contenido/bandeja-meta.mjs)
// y dice lo que el §13.11 del plan dejó POR VERIFICAR:
//   · ¿Llegan `username` y `text` (Instagram) y `from` y `message` (Facebook) de personas SIN rol en la página? (si no, hace falta el
//     acceso avanzado de instagram_manage_comments / pages_read_user_content);
//   · ¿Facebook acepta `is_hidden` como campo de LECTURA de un comentario?
//   · ¿El creativo de un anuncio da `effective_instagram_media_id`? (solo si hay cuenta publicitaria en Ajustes → Anuncios o META_CUENTA)
// El token viene del entorno (META_ACCESS_TOKEN; META_APP_SECRET si tu app lo pide) y nunca se imprime. Lo confirmado va a
// data/salida-meta/bandeja-*.json (data/ no viaja por GitHub) SIN los textos ni los nombres de tus clientes: solo qué campos llegaron.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearMeta, mensajeMeta, VERSION_GRAPH } from '../contenido/meta.mjs';
import { CAMPOS_IG, camposFB, esPropio } from '../contenido/bandeja-meta.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = process.env.AO_DATA ? path.resolve(process.env.AO_DATA) : path.join(ROOT, 'data');
const OUT = path.join(DATA, 'salida-meta');
const ok = s => console.log('  ✓ ' + s), aviso = s => console.log('  ! ' + s);
let failed = 0; const fail = (s, e) => { failed++; console.error('  ✗ ' + s + (e ? ' — ' + mensajeMeta(e) : '')); };
const guardar = (nombre, datos) => fs.writeFileSync(path.join(OUT, nombre), JSON.stringify(datos, null, 1));
const leerJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

const meta = crearMeta({ dir: path.join(DATA, 'contenido') });
if (!meta.configurado()) { console.error('Falta META_ACCESS_TOKEN en el entorno (Business Manager → Usuarios del sistema → Generar token). Ponlo con setx y abre otra terminal.'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
console.log(`Token detectado. Leyendo comentarios con Graph ${VERSION_GRAPH}, sin responder ni ocultar nada… (salida: ${path.relative(ROOT, OUT)})\n`);

// 1) el token, sus permisos y las cuentas
const est = await meta.sincronizar();
if (est.error && !est.cuentas.length) { fail('Cuentas: ' + est.error); process.exit(1); }
const permisos = est.token?.permisos;
const NECESARIOS = ['instagram_basic', 'instagram_manage_comments', 'pages_read_engagement', 'pages_show_list', 'pages_manage_engagement', 'pages_read_user_content'];
if (permisos === null) aviso('Meta no dijo qué permisos tiene el token: se sigue y se verá en cada paso.');
else { const f = NECESARIOS.filter(p => !permisos.includes(p)); if (f.length) aviso(`Faltan permisos para la Bandeja: ${f.join(', ')}.`); else ok('Tiene los permisos de leer, responder y ocultar comentarios.'); if (!permisos.includes('ads_read') && !permisos.includes('ads_management')) aviso('Sin ads_read (o ads_management): con el rol por Business Manager, Meta lo pide también para los comentarios de Instagram (§13.11).'); }
guardar('bandeja-token.json', { permisos, faltan: Array.isArray(permisos) ? NECESARIOS.filter(p => !permisos.includes(p)) : null });

const resumen = l => {
  const de = l.flatMap(c => [c, ...((c.replies?.data || c.comments?.data) || [])]);
  return { comentarios: de.length, conTexto: de.filter(c => c.text || c.message).length, conUsuario: de.filter(c => c.username || c.from?.username || c.from?.name).length, conFrom: de.filter(c => c.from?.id).length, conOculto: de.filter(c => 'hidden' in c || 'is_hidden' in c).length, campos: [...new Set(de.flatMap(c => Object.keys(c)))].sort() };
};
const salida = { instagram: [], facebook: [] };

// 2) Instagram
for (const ig of est.cuentas.filter(c => c.red === 'instagram')) {
  try {
    const tk = await meta.tokenDe(ig);
    const pubs = ((await meta.graph(tk, `/${ig.externoId}/media`, { params: { fields: 'id,timestamp,comments_count', limit: 10 } }))?.data || []).filter(m => m.comments_count > 0).slice(0, 3);
    if (!pubs.length) { aviso(`@${ig.usuario || ig.nombre}: ninguna de las últimas 10 publicaciones tiene comentarios; no hay qué comprobar.`); continue; }
    for (const p of pubs) {
      const l = (await meta.graph(tk, `/${p.id}/comments`, { params: { fields: CAMPOS_IG, limit: 25 } }))?.data || [];
      const ajenos = l.filter(c => !esPropio(c, ig)), r = resumen(ajenos);
      salida.instagram.push({ publicacion: p.id, comentarios: p.comments_count, ...r });
      if (!r.comentarios) aviso(`IG ${p.id}: Meta dice ${p.comments_count} comentarios pero no devolvió ninguno de otra persona.`);
      else if (r.conUsuario < r.comentarios || r.conTexto < r.comentarios) fail(`IG ${p.id}: de ${r.comentarios} comentarios ajenos, ${r.conTexto} con texto y ${r.conUsuario} con usuario: falta el acceso para leer a personas sin rol (instagram_manage_comments con acceso avanzado)`);
      else ok(`IG ${p.id}: ${r.comentarios} comentario(s) de personas sin rol, con usuario y texto.`);
    }
  } catch (e) { fail(`Instagram @${ig.usuario || ig.nombre}`, e); }
}

// 3) Facebook (y si `is_hidden` se puede leer)
let fbOculto = null;
for (const fb of est.cuentas.filter(c => c.red === 'facebook')) {
  try {
    const tk = await meta.tokenDe(fb);
    const pubs = ((await meta.graph(tk, `/${fb.paginaId}/posts`, { params: { fields: 'id,created_time,comments.summary(total_count).limit(0)', limit: 10 } }))?.data || []).filter(p => p.comments?.summary?.total_count > 0).slice(0, 3);
    if (!pubs.length) { aviso(`«${fb.nombre}»: ninguna de las últimas 10 publicaciones tiene comentarios; no hay qué comprobar.`); continue; }
    for (const p of pubs) {
      let l;
      try { l = (await meta.graph(tk, `/${p.id}/comments`, { params: { fields: camposFB(true), order: 'reverse_chronological', limit: 25 } }))?.data || []; if (fbOculto === null) fbOculto = true; }
      catch (e) { if (e?.codigo !== 100) throw e; fbOculto = false; l = (await meta.graph(tk, `/${p.id}/comments`, { params: { fields: camposFB(false), order: 'reverse_chronological', limit: 25 } }))?.data || []; }
      const ajenos = l.filter(c => !esPropio(c, fb)), r = resumen(ajenos);
      salida.facebook.push({ publicacion: p.id, comentarios: p.comments.summary.total_count, ...r });
      if (!r.comentarios) aviso(`FB ${p.id}: Meta no devolvió comentarios de otra persona.`);
      else if (r.conTexto < r.comentarios) fail(`FB ${p.id}: de ${r.comentarios} comentarios, solo ${r.conTexto} con texto`);
      else if (r.conUsuario < r.comentarios) aviso(`FB ${p.id}: ${r.comentarios - r.conUsuario} de ${r.comentarios} sin «from» (Meta no da el nombre si la persona no lo autorizó): salen como «Alguien en Facebook».`);
      else ok(`FB ${p.id}: ${r.comentarios} comentario(s) con nombre y texto.`);
    }
  } catch (e) { fail(`Facebook «${fb.nombre}»`, e); }
}
if (fbOculto === true) ok('Facebook acepta is_hidden como campo de lectura (se puede quitar su POR VERIFICAR en contenido/bandeja-meta.mjs).');
else if (fbOculto === false) aviso('Facebook NO acepta is_hidden como campo de lectura: la oficina ya lo pide sin él (lo oculto desde fuera no se verá como oculto).');

// 4) los anuncios: ¿da el creativo effective_instagram_media_id?
const cuentaAds = process.env.META_CUENTA || (leerJSON(path.join(ROOT, 'office.config.local.json'))?.anuncios?.cuenta) || (leerJSON(path.join(ROOT, 'office.config.json'))?.anuncios?.cuenta) || '';
let campoIG = null;
if (cuentaAds) {
  try {
    const tku = await meta.tokenDe({});
    const cr = (await meta.graph(tku, `/${cuentaAds}/adcreatives`, { params: { fields: 'id,effective_object_story_id', limit: 5 } }))?.data || [];
    if (!cr.length) aviso('La cuenta publicitaria no tiene creativos: no hay qué comprobar.');
    else {
      try { const r = await meta.graph(tku, `/${cr[0].id}`, { params: { fields: 'effective_instagram_media_id' } }); campoIG = 'effective_instagram_media_id' in (r || {}) ? 'con valor' : 'sin valor'; ok(`El creativo acepta effective_instagram_media_id (${campoIG}).`); }
      catch (e) { if (e?.codigo === 100) { campoIG = 'no existe'; aviso('Meta no conoce effective_instagram_media_id en el creativo: los comentarios de anuncios de Instagram no llegarán (la oficina lo dice en Estado).'); } else fail('Creativo', e); }
      ok(`${cr.filter(c => c.effective_object_story_id).length} de ${cr.length} creativos dan effective_object_story_id (los comentarios de anuncios de Facebook).`);
    }
  } catch (e) { fail(`Cuenta publicitaria ${cuentaAds}`, e); }
} else aviso('Sin cuenta publicitaria (Ajustes → Anuncios o META_CUENTA=act_…): no se comprueban los comentarios de anuncios.');

guardar('bandeja-comentarios.json', { at: new Date().toJSON(), version: VERSION_GRAPH, ...salida, fbIsHiddenLectura: fbOculto, creativoEffectiveInstagramMediaId: campoIG });
console.log(`\n${failed ? `✗ ${failed} problema(s)` : '✓ Todo lo que se pudo comprobar está bien'}. Pásale data/salida-meta/bandeja-comentarios.json a Claude Code para quitar los «POR VERIFICAR». No se respondió ni se ocultó nada.`);
process.exit(failed ? 1 : 0);
