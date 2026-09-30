// V4.7 (F2): el cliente de Meta (contenido/meta.mjs) y la foto diaria (contenido/metricas.mjs), contra un Graph DE MENTIRA
// que habla como el de Meta. NADA de esto se ha probado contra Meta de verdad (no había token ni salida a graph.facebook.com):
// estos casos prueban lo que la oficina hace con lo que Meta dice —y lo que NO hace, que es lo que importa: no guardar el
// token, no seguir una dirección ajena, no bajar lo que no es una imagen de Meta, no guardar ceros cuando Meta no contesta—.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { crearMeta, mensajeMeta, ErrorMeta, permisosQueFaltan, PERMISOS_LECTURA, VERSION_GRAPH } from '../contenido/meta.mjs';
import { crearMetricas, fechaDeFoto, tipoDeImagen, INTENTOS_POR_DIA, REINTENTO_MIN } from '../contenido/metricas.mjs';
import { serieDiaria, kpis } from '../src/contenido-cifras.js';

const TOKEN = 'EAAG-TOKEN-DE-USUARIO-0123456789'; // secrets-ok: un token de mentira para el Graph de mentira
const TOKEN_PAGINA = 'EAAG-TOKEN-DE-PAGINA-9876543210'; // secrets-ok: idem
const AHORA = new Date(2026, 8, 30, 10, 0).getTime(); // 30 sep 2026, 10:00 locales → la foto es de AYER, el 29
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]);
const respuesta = (cuerpo, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json' } });

/** Un Graph de mentira: responde por ruta, anota cada llamada y deja a cada test torcer lo que quiera. */
function graphFalso(torcer = () => null) {
  const llamadas = [];
  const fetchFn = async url => {
    const u = new URL(String(url)); llamadas.push(u);
    if (u.hostname === 'scontent.cdninstagram.com') return new Response(JPEG, { status: 200 });
    if (u.hostname === 'evil.example') return new Response(JPEG, { status: 200 });
    const ruta = u.pathname.replace(/^\/v[\d.]+/, ''), q = u.searchParams;
    const torcida = torcer(ruta, q, u); if (torcida) return torcida;
    if (q.get('access_token') === 'CADUCADO') return respuesta({ error: { message: 'Error validating access token', code: 190 } }, 400);
    if (ruta === '/debug_token') return respuesta({ data: { is_valid: true, type: 'SYSTEM_USER', expires_at: 0, scopes: PERMISOS_LECTURA.filter(p => p !== 'read_insights') } });
    if (ruta === '/me/accounts') return respuesta({ data: [{ id: 'P1', name: 'PanaClaw', access_token: TOKEN_PAGINA, picture: { data: { url: 'https://scontent.cdninstagram.com/p.jpg' } }, instagram_business_account: { id: 'IG1', username: 'panaclaw', name: 'PanaClaw IG' } }, { id: 'P2', name: 'Otra página', access_token: 'EAAG-OTRA-PAGINA-1111111111' }] });
    if (ruta === '/P1') return respuesta({ access_token: TOKEN_PAGINA, followers_count: 800, fan_count: 790 });
    if (ruta === '/IG1') return respuesta({ followers_count: 1200, media_count: 40 });
    if (ruta === '/IG1/insights' && q.get('breakdown')) return respuesta({ data: [{ name: 'follower_demographics', total_value: { breakdowns: [{ results: [{ dimension_values: ['25-34'], value: 500 }, { dimension_values: ['18-24'], value: 300 }] }] } }] });
    if (ruta === '/IG1/insights') return respuesta({ data: String(q.get('metric')).split(',').map((m, i) => ({ name: m, total_value: { value: 100 * (i + 1) } })) });
    if (ruta === '/IG1/media') return respuesta({ data: [
      { id: 'M1', caption: 'Reel de prueba', media_type: 'VIDEO', media_product_type: 'REELS', permalink: 'https://instagram.com/reel/1', timestamp: new Date(2026, 8, 25, 18, 30).toISOString(), like_count: 30, comments_count: 4, thumbnail_url: 'https://scontent.cdninstagram.com/m1.jpg' },
      { id: 'M2', caption: 'Foto', media_type: 'IMAGE', media_product_type: 'FEED', permalink: 'https://instagram.com/p/2', timestamp: new Date(2026, 8, 20, 9, 0).toISOString(), like_count: 10, comments_count: 1, media_url: 'https://evil.example/x.jpg' },
      { id: 'M3', caption: 'Muy vieja', media_type: 'IMAGE', timestamp: new Date(2026, 5, 1).toISOString(), like_count: 1, comments_count: 0 },
    ] });
    if (ruta === '/M1/insights' || ruta === '/M2/insights') return respuesta({ data: [{ name: 'reach', values: [{ value: 900 }] }, { name: 'saved', values: [{ value: 5 }] }, { name: 'shares', values: [{ value: 3 }] }, { name: 'views', values: [{ value: 1500 }] }, { name: 'total_interactions', values: [{ value: 42 }] }] });
    if (ruta === '/P1/insights') return respuesta({ data: [{ name: q.get('metric'), values: [{ value: 77 }] }] });
    if (ruta === '/P1/posts') {
      // Graph solo devuelve lo que se le pide: sin `reactions` en `fields`, no hay reacciones.
      const p = { id: 'P1_1', message: 'Post de Facebook', created_time: new Date(2026, 8, 27, 12).toISOString(), permalink_url: 'https://facebook.com/1', full_picture: 'https://scontent.cdninstagram.com/f1.jpg', shares: { count: 2 } };
      if (String(q.get('fields')).includes('reactions')) Object.assign(p, { reactions: { summary: { total_count: 20 } }, comments: { summary: { total_count: 3 } } });
      return respuesta({ data: [p] });
    }
    return respuesta({ error: { message: `ruta no simulada: ${ruta}`, code: 100 } }, 400);
  };
  return { fetchFn, llamadas };
}

const carpeta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ao-meta-'));
const montar = (opciones = {}) => {
  const dir = carpeta(), g = graphFalso(opciones.torcer), env = { META_ACCESS_TOKEN: TOKEN, ...(opciones.env || {}) };
  const meta = crearMeta({ env, fetchFn: g.fetchFn, dir, ahora: () => AHORA });
  const avisos = [], fotos = [];
  const metricas = crearMetricas({ meta, dir, fetchFn: g.fetchFn, ahora: () => opciones.ahora ?? AHORA, avisar: (t, o) => avisos.push([t, o]), alFotografiar: d => fotos.push(d) });
  return { dir, g, meta, metricas, avisos, fotos, todo: () => fs.readdirSync(dir, { recursive: true }).filter(f => fs.statSync(path.join(dir, f)).isFile()) };
};
const textoDe = dir => fs.readdirSync(dir, { recursive: true }).map(f => path.join(dir, f)).filter(f => fs.statSync(f).isFile() && !/\.(jpg|png|webp)$/.test(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');

test('sin META_ACCESS_TOKEN no hay conexión y se dice cuál falta', async () => {
  const dir = carpeta(), meta = crearMeta({ env: {}, fetchFn: () => { throw new Error('no debe llamar'); }, dir });
  assert.equal(meta.configurado(), false);
  const e = await meta.sincronizar();
  assert.equal(e.configurado, false); assert.match(e.error, /META_ACCESS_TOKEN/); assert.deepEqual(e.cuentas, []);
});

test('«Comprobar conexión»: el tipo de token, sus permisos, lo que le falta y las cuentas (página + su Instagram)', async () => {
  const { meta } = montar();
  const e = await meta.sincronizar();
  assert.equal(e.configurado, true); assert.equal(e.error, null);
  assert.equal(e.token.tipo, 'SYSTEM_USER'); assert.equal(e.token.caduca, null); // 0 = no caduca
  assert.deepEqual(e.token.faltan, ['read_insights']); // sin ese permiso las métricas no salen: se dice antes de intentarlo
  assert.deepEqual(e.cuentas.map(c => [c.id, c.red]), [['facebook:P1', 'facebook'], ['instagram:IG1', 'instagram'], ['facebook:P2', 'facebook']]);
  assert.equal(e.cuentas[1].usuario, 'panaclaw'); assert.equal(e.cuentas[1].paginaId, 'P1');
});

test('el token —el de usuario y los de página— no se escribe en NINGÚN archivo ni sale en el estado', async () => {
  const { meta, dir, metricas } = montar();
  await meta.sincronizar(); await metricas.actualizar();
  const todo = textoDe(dir) + JSON.stringify(meta.estado());
  for (const t of [TOKEN, TOKEN_PAGINA, 'EAAG-OTRA-PAGINA']) assert.equal(todo.includes(t), false, `«${t}» apareció en disco o en el estado`);
});

test('un token caducado (190) se explica en español, con qué hacer, y NO borra las cuentas que ya se conocían', async () => {
  const { meta, dir } = montar();
  await meta.sincronizar();
  const malo = crearMeta({ env: { META_ACCESS_TOKEN: 'CADUCADO' }, fetchFn: graphFalso().fetchFn, dir, ahora: () => AHORA });
  const e = await malo.sincronizar();
  assert.match(e.error, /caducó, se revocó o no es válido/); assert.match(e.error, /META_ACCESS_TOKEN/);
  assert.equal(e.cuentas.length, 3, 'las cuentas de antes siguen ahí');
});

test('un token que no ve ninguna página lo dice: falta asignarlas en Business Manager', async () => {
  const { meta } = montar({ torcer: ruta => (ruta === '/me/accounts' ? respuesta({ data: [] }) : null) });
  const e = await meta.sincronizar();
  assert.match(e.error, /no ve ninguna página/); assert.match(e.error, /Business Manager/);
});

test('con META_APP_SECRET cada llamada lleva su appsecret_proof; sin él, ninguna', async () => {
  const con = montar({ env: { META_APP_SECRET: 'secreto-de-la-app' } });
  await con.meta.sincronizar();
  const esperado = crypto.createHmac('sha256', 'secreto-de-la-app').update(TOKEN).digest('hex');
  assert.ok(con.g.llamadas.length > 1);
  assert.equal(con.g.llamadas[0].searchParams.get('appsecret_proof'), esperado);
  const sin = montar(); await sin.meta.sincronizar();
  assert.ok(sin.g.llamadas.every(u => !u.searchParams.has('appsecret_proof')));
});

test('un fallo de red no filtra el token en el mensaje', async () => {
  const dir = carpeta();
  const meta = crearMeta({ env: { META_ACCESS_TOKEN: TOKEN }, fetchFn: async () => { throw new Error(`connect ECONNREFUSED https://graph.facebook.com/?access_token=${TOKEN}`); }, dir });
  await assert.rejects(() => meta.graph(TOKEN, '/me'), e => { assert.ok(e instanceof ErrorMeta && e.transitorio); assert.equal(e.message.includes(TOKEN), false); return true; });
  const est = await meta.sincronizar();
  assert.equal(JSON.stringify(est).includes(TOKEN), false);
});

test('la paginación solo sigue direcciones de Graph: una ajena se ignora', async () => {
  let vueltas = 0;
  const { meta } = montar({ torcer: (ruta) => { if (ruta === '/me/accounts') { vueltas++; return respuesta({ data: [{ id: 'P9', name: 'Solo esta' }], paging: { next: 'https://evil.example/steal' } }); } return null; } });
  const e = await meta.sincronizar();
  assert.equal(vueltas, 1); assert.deepEqual(e.cuentas.map(c => c.id), ['facebook:P9']);
});

test('mensajeMeta: los errores que Meta suele dar, en español y con su arreglo', () => {
  assert.match(mensajeMeta(new ErrorMeta({ code: 10, error_user_msg: 'falta pages_read_engagement' }, 403)), /Meta no dio permiso.*falta pages_read_engagement/);
  assert.match(mensajeMeta(new ErrorMeta({ code: 4 }, 400)), /saturado|limitó/);
  assert.match(mensajeMeta(new ErrorMeta({ code: 100, message: 'Unsupported get request' }, 400)), /no aceptó la petición/);
  assert.equal(mensajeMeta(new Error('otra cosa')), 'otra cosa');
  assert.ok(new ErrorMeta({ code: 2 }, 500).transitorio); assert.ok(!new ErrorMeta({ code: 10 }, 403).transitorio);
});

test('permisosQueFaltan: null en «concedidos» (Meta no lo dijo) no es «le faltan todos»', () => {
  assert.deepEqual(permisosQueFaltan(null), []);
  assert.deepEqual(permisosQueFaltan(['pages_show_list']).includes('read_insights'), true);
  assert.equal(VERSION_GRAPH.startsWith('v'), true);
});

test('la foto es de AYER en el reloj de esta máquina', () => {
  assert.equal(fechaDeFoto(new Date(2026, 8, 30, 10)), '2026-09-29');
  assert.equal(fechaDeFoto(new Date(2026, 9, 1, 0, 5)), '2026-09-30');
  assert.equal(fechaDeFoto(new Date(2027, 0, 1, 7)), '2026-12-31');
});

test('fotografiar Instagram: cifras del día, audiencia y publicaciones con su miniatura local', async () => {
  const { meta, metricas, g } = montar();
  await meta.sincronizar();
  const ig = meta.estado().cuentas.find(c => c.id === 'instagram:IG1');
  const fila = await metricas.fotografiarCuenta(ig);
  assert.equal(fila.fecha, '2026-09-29'); assert.equal(fila.seguidores, 1200); assert.equal(fila.publicaciones, 40);
  assert.equal(fila.alcance, 100); assert.equal(fila.vistas, 200); assert.equal(fila.interacciones, 300); assert.equal(fila.visitas, 400);
  assert.deepEqual(fila.datos.audiencia.age.map(a => a.clave), ['25-34', '18-24']);
  // pidió el día de AYER a medianoche local
  const p = g.llamadas.find(u => u.pathname.endsWith('/IG1/insights') && u.searchParams.get('since'));
  assert.equal(Number(p.searchParams.get('since')), Math.floor(new Date(2026, 8, 29).getTime() / 1000));
  assert.equal(Number(p.searchParams.get('until')), Math.floor(new Date(2026, 8, 30).getTime() / 1000));
  const { publicaciones } = metricas.leer();
  assert.deepEqual(publicaciones.map(x => x.externoId), ['M1', 'M2'], 'la de junio queda fuera: son 45 días');
  const reel = publicaciones[0];
  assert.equal(reel.tipo, 'reel'); assert.equal(reel.alcance, 900); assert.equal(reel.interacciones, 42); assert.equal(reel.guardados, 5);
  assert.match(reel.miniatura, /^\/api\/contenido\/miniatura\/[a-f0-9]{20}$/);
  const copia = metricas.miniatura(reel.miniatura.split('/').pop());
  assert.equal(copia.tipo, 'image/jpeg'); assert.deepEqual(fs.readFileSync(copia.archivo), JPEG);
  assert.equal(publicaciones[1].miniatura, '', 'una miniatura de un dominio que no es de Meta NO se baja');
});

test('las miniaturas: solo dominios de Meta, solo imágenes de las seguras, y ninguna ruta se arma con lo que llega de la red', async () => {
  assert.equal(tipoDeImagen(JPEG), 'jpg');
  assert.equal(tipoDeImagen(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
  assert.equal(tipoDeImagen(Buffer.from('<!doctype html><html>')), null);
  const { metricas } = montar();
  for (const malo of ['../../office.config', '..%2F..%2Fetc', 'A'.repeat(20), 'abc', '', null, '0123456789abcdef0123/../x']) assert.equal(metricas.miniatura(malo), null, String(malo));
});

test('fotografiar Facebook: si pedir las reacciones falla, se lee sin ellas y la foto lo dice («parcial»)', async () => {
  let n = 0;
  const { meta, metricas } = montar({ torcer: (ruta, q) => { if (ruta === '/P1/posts' && String(q.get('fields')).includes('reactions')) { n++; return respuesta({ error: { message: '(#10) missing permission', code: 10 } }, 403); } return null; } });
  await meta.sincronizar();
  const fb = meta.estado().cuentas.find(c => c.id === 'facebook:P1');
  const fila = await metricas.fotografiarCuenta(fb);
  assert.equal(n, 1); assert.equal(fila.seguidores, 800); assert.equal(fila.alcance, 77);
  assert.equal(fila.datos.avisos.parcial, true); assert.match(fila.datos.avisos.publicaciones[0], /con reacciones.*no dio permiso/);
  const p = metricas.leer().publicaciones.find(x => x.externoId === 'P1_1');
  assert.ok(p, 'la publicación se guardó sin sus reacciones'); assert.equal(p.meGusta, 0);
});

test('si una métrica ya no existe, las demás siguen: cada grupo se pide por su lado', async () => {
  const { meta, metricas } = montar({ torcer: (ruta, q) => (ruta === '/IG1/insights' && String(q.get('metric')).includes(',') && !q.get('breakdown') ? respuesta({ error: { message: 'metric impressions no longer supported', code: 100 } }, 400) : null) });
  await meta.sincronizar();
  const fila = await metricas.fotografiarCuenta(meta.estado().cuentas.find(c => c.id === 'instagram:IG1'));
  assert.equal(fila.alcance, 100); assert.equal(fila.vistas, 100); // una a una, cada una con su valor
});

test('si Meta no entrega ni los seguidores, NO se guarda una foto de ceros', async () => {
  const { meta, metricas, dir } = montar({ torcer: ruta => (ruta === '/IG1' || ruta.startsWith('/IG1/') ? respuesta({ error: { message: 'x', code: 190 } }, 400) : null) });
  await meta.sincronizar();
  const ig = meta.estado().cuentas.find(c => c.id === 'instagram:IG1');
  await assert.rejects(() => metricas.fotografiarCuenta(ig), /no devolvió datos/);
  assert.equal(fs.existsSync(path.join(dir, 'metricas')), false, 'nada quedó apuntado como si fuera una foto');
});

test('actualizar: cada cuenta por su lado, lo que falla se apunta y avisa, y no frena a las demás', async () => {
  const { meta, metricas, avisos, fotos } = montar({ torcer: ruta => (ruta.startsWith('/P2') ? respuesta({ error: { message: 'x', code: 10 } }, 403) : null) });
  await meta.sincronizar();
  const r = await metricas.actualizar();
  assert.equal(r.total, 3); assert.equal(r.hechas, 2); assert.equal(r.fallidas.length, 1); assert.equal(r.fallidas[0].cuenta, 'Otra página');
  assert.match(r.fallidas[0].motivo, /no dio permiso/);
  assert.equal(avisos.length, 1); assert.match(avisos[0][0], /Otra página/);
  assert.equal(fotos.length, 1); assert.ok(fotos[0].serie.length >= 2, 'lo que salió bien se entrega a los indicadores');
});

test('una cuenta que falló se reintenta pasada una hora y hasta tres veces al día; una que salió bien no se repite', async () => {
  const fallar = ruta => (ruta.startsWith('/P2') ? respuesta({ error: { message: 'x', code: 10 } }, 403) : null);
  const uno = montar({ torcer: fallar }); await uno.meta.sincronizar(); await uno.metricas.actualizar();
  const cuentas = uno.meta.estado().cuentas;
  assert.equal(uno.metricas.pendientes(cuentas).length, 0, 'recién falló: hay que dejarla reposar');
  const luego = (min, n) => { const m = crearMetricas({ meta: uno.meta, dir: uno.dir, fetchFn: uno.g.fetchFn, ahora: () => AHORA + min * 60_000 }); void n; return m; };
  assert.deepEqual(luego(REINTENTO_MIN + 1).pendientes(cuentas).map(c => c.id), ['facebook:P2'], 'pasada una hora se vuelve a intentar SOLO la que falló');
  // agotar los intentos del día
  let t = 0;
  for (let i = 1; i < INTENTOS_POR_DIA; i++) { t += REINTENTO_MIN + 1; const m = luego(t); await m.actualizar(); }
  assert.deepEqual(luego(t + REINTENTO_MIN + 1).pendientes(cuentas), [], `a las ${INTENTOS_POR_DIA} veces, hasta mañana`);
});

test('dos «actualizar» a la vez son UNA: la segunda espera a la primera y no se fotografía dos veces', async () => {
  const { meta, metricas, g } = montar();
  await meta.sincronizar();
  const a = metricas.actualizar(), b = metricas.actualizar();
  assert.equal(a, b); assert.equal(metricas.enMarcha(), true);
  await a; assert.equal(metricas.enMarcha(), false);
  assert.equal(g.llamadas.filter(u => u.pathname.endsWith('/IG1')).length, 1);
});

test('lo leído alimenta las cuentas de Analíticas: serie diaria y cifras del periodo', async () => {
  const { meta, metricas } = montar();
  await meta.sincronizar(); await metricas.actualizar();
  const { serie, publicaciones, ultimaFoto } = metricas.leer({ dias: 30 });
  assert.equal(ultimaFoto, '2026-09-29');
  const dia = serieDiaria(serie).at(-1);
  assert.equal(dia.fecha, '2026-09-29'); assert.equal(dia.seguidores, 1200 + 800 + 0 * 1, 'IG + la página 1; la segunda no entregó seguidores');
  const k = kpis({ serie, publicaciones }, { desde: '2026-09-01', hasta: '2026-09-29' });
  assert.equal(k.seguidores.valor, dia.seguidores);
  assert.ok(k.interacciones.valor > 0);
});
