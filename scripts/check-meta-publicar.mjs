// Agents Office — la prueba de PUBLICAR con un token REAL de Meta (F3, 8 oct 2026). NO PUBLICA NADA en Instagram: prepara contenedores
// y nunca llama a /media_publish (un contenedor sin publicar caduca solo a las 24 h). Se corre a mano, nunca en CI.
//   node scripts/check-meta-publicar.mjs                  → token, permisos, página e Instagram, cuota; y LO QUE NO SE PUDO VERIFICAR:
//                                                           ¿Instagram acepta una imagen desde la dirección de una foto temporal de Facebook?
//   node scripts/check-meta-publicar.mjs --video <mp4>    → también un reel por la subida reanudable (rupload), sin publicarlo
//   node scripts/check-meta-publicar.mjs --facebook       → también PROGRAMA una foto en tu página para dentro de 2 días y la BORRA enseguida
//                                                           (aparece unos segundos en «Publicaciones programadas»; no sale)
// El token viene del entorno (setx META_ACCESS_TOKEN "…"; META_APP_SECRET si tu app lo pide) y nunca se imprime. Lo que confirma va a
// data/salida-meta/ (data/ no viaja por GitHub): con eso se quitan los «POR VERIFICAR» de contenido/meta-publicar.mjs. Con varias páginas,
// META_PAGINA=<id de la página> elige cuál (la oficina usa office.config → contenido.metaPagina).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { crearMeta, mensajeMeta, permisosQueFaltan, PERMISOS_LECTURA, PERMISOS_PUBLICAR } from '../contenido/meta.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = process.env.AO_DATA ? path.resolve(process.env.AO_DATA) : path.join(ROOT, 'data');
const OUT = path.join(DATA, 'salida-meta');
const args = process.argv.slice(2), want = new Set(args), video = want.has('--video') ? args[args.indexOf('--video') + 1] : null;
const ok = s => console.log('  ✓ ' + s), aviso = s => console.log('  ! ' + s);
let failed = 0; const fail = (s, e) => { failed++; console.error('  ✗ ' + s + ' — ' + (e ? mensajeMeta(e) : '')); };
const guardar = (nombre, datos) => fs.writeFileSync(path.join(OUT, nombre), JSON.stringify(datos, null, 1));
const espera = ms => new Promise(r => setTimeout(r, ms));

const meta = crearMeta({ dir: path.join(DATA, 'contenido') });
if (!meta.configurado()) { console.error('Falta META_ACCESS_TOKEN en el entorno (Business Manager → Usuarios del sistema → Generar token). Ponlo con setx y abre otra terminal.'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
console.log(`Token detectado. Probando publicar con Meta, sin publicar nada… (salida: ${path.relative(ROOT, OUT)})\n`);

// 1) el token, sus permisos y las cuentas (lo mismo que «Comprobar conexión» en Analíticas)
const est = await meta.sincronizar();
if (est.error && !est.cuentas.length) { fail('Cuentas', { message: est.error }); process.exit(1); }
const permisos = est.token?.permisos;
guardar('token.json', { tipo: est.token?.tipo, caduca: est.token?.caduca, permisos });
const faltanL = permisosQueFaltan(permisos, PERMISOS_LECTURA), faltanP = permisosQueFaltan(permisos, PERMISOS_PUBLICAR);
ok(`Token: ${est.token?.tipo || 'tipo desconocido'}${est.token?.caduca ? `, caduca ${est.token.caduca}` : ', no caduca'}`);
if (permisos === null) aviso('Meta no dijo qué permisos tiene el token: se sigue y se verá en cada paso.');
else if (faltanP.length || faltanL.length) fail(`Faltan permisos: ${[...faltanP, ...faltanL].join(', ')}`); else ok('Tiene todos los permisos de leer y publicar.');
const fb = est.cuentas.find(c => c.red === 'facebook' && (!process.env.META_PAGINA || c.paginaId === process.env.META_PAGINA)) || est.cuentas.find(c => c.red === 'facebook');
const ig = fb ? est.cuentas.find(c => c.red === 'instagram' && c.paginaId === fb.paginaId) : null;
if (!fb) { fail('El token no ve ninguna página'); process.exit(1); }
ok(`Página: «${fb.nombre}» (${fb.paginaId})${ig ? ` · Instagram: @${ig.usuario || ig.nombre} (${ig.externoId})` : ''}`);
if (!ig) fail('Esa página no tiene un Instagram de empresa vinculado (o el token no lo ve)');
const tk = await meta.tokenDe({ paginaId: fb.paginaId });

// 2) la cuota de Instagram
if (ig) {
  try { const q = (await meta.graph(tk, `/${ig.externoId}/content_publishing_limit`, { params: { fields: 'config,quota_usage' } }))?.data?.[0]; guardar('cuota.json', q); ok(`Cuota de Instagram: ${q?.quota_usage ?? '?'} de ${q?.config?.quota_total ?? '?'} publicaciones por API en ${Math.round((q?.config?.quota_duration || 86400) / 3600)} h`); }
  catch (e) { fail('Cuota de Instagram (content_publishing_limit)', e); }
}

const jpeg = await sharp({ create: { width: 1080, height: 1080, channels: 3, background: { r: 230, g: 106, b: 47 } } }).jpeg({ quality: 85 }).toBuffer();
const temporales = [];
async function estadoContenedor(id, maxS = 90) {
  for (let i = 0; i < maxS / 3; i++) { const r = await meta.graph(tk, `/${id}`, { params: { fields: 'status_code,status' } }); if (r?.status_code && r.status_code !== 'IN_PROGRESS') return r; await espera(3000); }
  return { status_code: 'IN_PROGRESS' };
}

// 3) LO QUE NO SE PUDO VERIFICAR: la imagen para Instagram desde una foto temporal sin publicar de la página
if (ig) {
  try {
    const f = await meta.enviar(tk, `/${fb.paginaId}/photos`, { campos: { published: false, temporary: true }, archivo: { datos: jpeg, nombre: 'prueba-oficina.jpg', tipo: 'image/jpeg' } });
    temporales.push(f.id); ok(`Foto temporal sin publicar en la página: ${f.id}`);
    const r = await meta.graph(tk, `/${f.id}`, { params: { fields: 'images' } });
    const mejor = [...(r?.images || [])].sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    guardar('foto-temporal.json', { id: f.id, images: (r?.images || []).map(x => ({ width: x.width, height: x.height, host: new URL(x.source).host })) });
    if (!mejor?.source) throw new Error('Facebook no devolvió `images` para la foto temporal');
    ok(`Su dirección de Meta: https://${new URL(mejor.source).host}/… (${mejor.width}×${mejor.height})`);
    const c = await meta.enviar(tk, `/${ig.externoId}/media`, { campos: { image_url: mejor.source } });
    const st = await estadoContenedor(c.id);
    guardar('contenedor-imagen.json', { id: c.id, ...st });
    if (st.status_code === 'FINISHED') ok(`VERIFICADO: Instagram aceptó la imagen desde esa dirección (contenedor ${c.id} FINISHED, sin publicar: caduca solo a las 24 h).`);
    else fail(`Instagram no aceptó la imagen desde la dirección de Facebook (contenedor ${st.status_code}: ${st.status || ''}). Cuéntaselo a Claude Code con data/salida-meta/.`);
  } catch (e) { fail('Imagen para Instagram desde una foto temporal de Facebook', e); }
}

// 4) --video: un reel por la subida reanudable (rupload), sin publicarlo
if (ig && video) {
  try {
    const datos = fs.readFileSync(video);
    const c = await meta.enviar(tk, `/${ig.externoId}/media`, { campos: { media_type: 'REELS', upload_type: 'resumable', share_to_feed: true } });
    await meta.subirReanudable(tk, c.id, datos, c.uri); ok(`Video subido por rupload (${(datos.length / 1e6).toFixed(1)} MB) al contenedor ${c.id}`);
    const st = await estadoContenedor(c.id, 300); guardar('contenedor-video.json', { id: c.id, ...st });
    if (st.status_code === 'FINISHED') ok('VERIFICADO: Instagram procesó el reel (sin publicar).'); else fail(`El reel quedó ${st.status_code}: ${st.status || ''}`);
  } catch (e) { fail('Reel por subida reanudable', e); }
} else if (want.has('--video')) aviso('Para probar un video: node scripts/check-meta-publicar.mjs --video C:\\ruta\\al\\video.mp4');

// 5) --facebook: programar una foto para dentro de 2 días, comprobarla y BORRARLA
if (want.has('--facebook')) {
  try {
    const cuando = Math.floor((Date.now() + 2 * 864e5) / 1000);
    const r = await meta.enviar(tk, `/${fb.paginaId}/photos`, { campos: { published: false, scheduled_publish_time: cuando, caption: 'Prueba de la oficina (se borra sola)' }, archivo: { datos: jpeg, nombre: 'prueba.jpg', tipo: 'image/jpeg' } });
    const id = r.post_id || r.id; ok(`Programada en Facebook para ${new Date(cuando * 1000).toLocaleString('es')}: ${id}`);
    const v = await meta.graph(tk, `/${id}`, { params: { fields: 'is_published,permalink_url' } }); guardar('facebook-programada.json', { id, ...v });
    ok(`Meta la ve como ${v?.is_published === false ? 'NO publicada (programada): bien' : 'publicada?: revisa tu página'}`);
    await meta.borrar(tk, id); ok('Y se borró: ya no está en tus publicaciones programadas.');
  } catch (e) { fail('Programar y borrar una foto en Facebook', e); }
}

for (const id of temporales) { try { await meta.borrar(tk, id); } catch { aviso(`No pude borrar la foto temporal ${id}: Meta la borra sola.`); } }
console.log(failed ? `\n✗ ${failed} cosa(s) fallaron: el detalle está arriba y en ${path.relative(ROOT, OUT)}` : '\n✓ Todo bien. Nada se publicó.');
process.exit(failed ? 1 : 0);
