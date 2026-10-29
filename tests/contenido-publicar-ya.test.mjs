// Fase 2 (CON-04/05/14, B01-B07): «Publicar ahora» — la hora es el minuto en curso, la cola no espera gracia ni margen, y SOLO el dueño lo pide.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearAlmacen } from '../contenido/piezas.mjs';
import { planear, crearNucleoProgramador, GRACIA_MS, YA_VENTANA_MS, esYa } from '../contenido/programador-core.mjs';
import { crearControlador, motivoNoYa } from '../contenido/rutas-nucleo.mjs';
import { revisarMomento, PRONTO_MIN, PRONTO_TXT } from '../src/contenido-reglas.js';
import { ahoraAbajo } from '../contenido/piezas-core.mjs';

const raiz = path.resolve(import.meta.dirname, '..');
const ymd = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hm = ms => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const T0 = new Date(2026, 9, 29, 10, 0, 37).getTime();

function montar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-ya-')); let reloj = T0;
  const almacen = crearAlmacen({ dir, ahora: () => reloj });
  const p = almacen.crear({ titulo: 'Hola', fecha: ymd(T0 + 864e5), hora: '09:00', redes: ['facebook'], texto: 'Texto de prueba', estado: 'revision' }).pieza;
  return { almacen, id: p.id, avanzar: ms => { reloj += ms; }, ahora: () => reloj };
}

test('revisarMomento con ya: solo el minuto en curso', () => {
  const m = ahoraAbajo(T0);
  assert.equal(m.hora, '10:00');
  assert.deepEqual(revisarMomento(m.fecha, m.hora, T0, { ya: true }).errores, []);
  assert.equal(revisarMomento(m.fecha, '09:30', T0, { ya: true }).errores.length, 1, 'un minuto viejo no vale');
  assert.equal(revisarMomento(m.fecha, '10:05', T0, { ya: true }).errores.length, 1, 'el futuro tampoco');
  assert.ok(revisarMomento(m.fecha, m.hora, T0).errores.length, 'sin ya, una hora pasada sigue sin valer');
});

test('aprobar ya: hora = minuto en curso, aprobada.ya, y solo ahí; reaprobar normal lo borra', () => {
  const t = montar();
  const r = t.almacen.aprobar(t.id, { ya: true });
  assert.equal(r.error, undefined, r.error);
  assert.equal(r.pieza.hora, '10:00'); assert.equal(r.pieza.fecha, ymd(T0)); assert.equal(r.pieza.aprobada.ya, true);
  assert.equal(t.almacen.leer(t.id).aprobada.ya, true, 'sobrevive a la nota en disco');
  t.almacen.devolver(t.id);
  const p2 = t.almacen.guardar(t.id, { fecha: ymd(T0 + 864e5), hora: '09:00' }).pieza; assert.ok(p2);
  const n = t.almacen.aprobar(t.id); assert.equal(n.error, undefined); assert.equal(n.pieza.aprobada.ya, undefined);
  const pronto = (() => { t.almacen.devolver(t.id); return t.almacen.aprobar(t.id, { pronto: true }); })();
  assert.equal(pronto.pieza.aprobada.ya, undefined, 'el camino antiguo no es «ya»');
});

test('una petición no puede poner aprobada.ya (PATCH)', () => {
  const t = montar(); t.almacen.aprobar(t.id);
  const r = t.almacen.guardar(t.id, { aprobada: { ya: true, cuando: new Date(T0).toISOString(), huella: 'x' }, estado: 'aprobada' });
  assert.notEqual(r.pieza?.aprobada?.ya, true);
});

test('planear: ya se entrega sin gracia ni margen; sin ya, no; y caduca a los 30 min', () => {
  const t = montar(); const a = t.almacen.aprobar(t.id, { ya: true }).pieza;
  const e = { pieza: a.id, huella: a.aprobada.huella, momento: Date.parse('2026-10-29T10:00:00'), entregarDesde: 0, estado: 'espera', redes: {}, remoto: {}, historial: [] };
  const hacer = (p, ahora) => planear([p], { [p.id]: e }, { ahora }).map(x => x.tipo);
  assert.deepEqual(hacer(a, T0), ['entregar'], 'a los 37 s del OK, sin esperar el minuto de gracia');
  const normal = { ...a, aprobada: { ...a.aprobada, ya: undefined } };
  assert.deepEqual(hacer(normal, T0), ['vencer'], 'sin ya, una hora que ya es «ahora» está dentro del margen de 3 minutos: vence, no se entrega');
  assert.equal(esYa(a, T0 + YA_VENTANA_MS + 1), false);
  assert.deepEqual(hacer(a, T0 + YA_VENTANA_MS + 60e3), ['vencer'], 'pasada la ventana vale la regla de siempre');
  assert.ok(GRACIA_MS > 0);
});

test('la entrada de la cola no puede activar ya (B02)', () => {
  const t = montar(); const a = t.almacen.aprobar(t.id).pieza;
  const e = { pieza: a.id, huella: a.aprobada.huella, momento: T0, entregarDesde: 0, estado: 'espera', ya: true, redes: {}, remoto: {}, historial: [] };
  assert.ok(!planear([a], { [a.id]: e }, { ahora: T0 }).some(x => x.tipo === 'entregar'));
});

function nucleo(t, { fallaRetirar = false } = {}) {
  let cola = { entradas: {} }; const programadas = [], retiradas = [];
  const conductor = { id: 'meta', nombre: 'Meta', listo: () => ({ ok: true }), programar: async en => { programadas.push(en); return { id: 'r1', redes: { facebook: { estado: 'en_red' } } }; }, retirar: async r => { if (fallaRetirar) throw new Error('Meta no contesta'); retiradas.push(r); }, estado: async () => null };
  const n = crearNucleoProgramador({ almacen: t.almacen, cola: { leer: () => cola, guardar: d => { cola = JSON.parse(JSON.stringify(d)); } }, conductor: () => conductor, modo: () => 'real', ahora: t.ahora });
  return { n, programadas, retiradas, cola: () => cola };
}

test('tick({solo}) con ya: encola y entrega en la MISMA vuelta; sin ya, solo encola', async () => {
  const t = montar(); const x = nucleo(t);
  t.almacen.aprobar(t.id, { ya: true });
  await x.n.tick({ solo: t.id });
  assert.equal(x.programadas.length, 1); assert.equal(x.cola().entradas[t.id].estado, 'en_red');
  const u = montar(); const y = nucleo(u); u.almacen.aprobar(u.id, { pronto: true });
  await y.n.tick({ solo: u.id });
  assert.equal(y.programadas.length, 0, 'lo normal espera su gracia');
});

test('retirarAhora: retira lo ya entregado; si el retiro falla, no hay publicación (B05)', async () => {
  const t = montar(); const x = nucleo(t);
  t.almacen.aprobar(t.id, { ya: true }); await x.n.tick();
  assert.equal(x.cola().entradas[t.id].estado, 'en_red');
  assert.deepEqual(await x.n.retirarAhora(t.id), { ok: true }); assert.equal(x.retiradas.length, 1);
  const u = montar(); const y = nucleo(u, { fallaRetirar: true });
  u.almacen.aprobar(u.id, { ya: true }); await y.n.tick();
  const r = await y.n.retirarAhora(u.id); assert.match(r.error, /quita antes la programada/);
});

function controlador(t, { aj = {}, ret = { ok: true } } = {}) {
  const ticks = [];
  const programador = { tick: async o => { ticks.push(o); }, retirarAhora: async () => ret, salidaDe: async () => null, estado: async () => ({ entradas: {} }) };
  const ctl = crearControlador({ almacen: t.almacen, programador, ajustes: () => ({ publicarYa: true, modo: 'real', conductor: 'meta', ...aj }), ahora: t.ahora, segundoPlano: p => p });
  const crudo = cuerpo => ctl.responder({ metodo: 'POST', p: `/api/contenido/piezas/${t.id}/publicar-ya`, cuerpo: async () => cuerpo });
  const llamar = (cuerpo = {}) => crudo({ por: 'dueno', ...cuerpo }); // la pantalla (o la sesión de la nube) se declara del dueño
  return { llamar, crudo, ticks };
}

test('ruta publicar-ya: candados y camino feliz (202, tick solo de esa pieza)', async () => {
  const t = montar(); const c = controlador(t);
  assert.equal((await c.crudo({ confirmado: true })).status, 403, 'quien no se declara del dueño (un agente que omite `por`) recibe 403');
  assert.equal((await c.crudo({})).status, 403);
  assert.equal((await c.llamar({ por: 'agente', confirmado: true })).status, 403);
  assert.equal((await c.llamar({ por: 'dimitri', confirmado: true })).status, 403);
  const sin = await c.llamar({}); assert.equal(sin.status, 409); assert.equal(sin.datos.confirmar, true);
  assert.equal((await controlador(t, { aj: { publicarYa: false } }).llamar({ confirmado: true })).status, 409, 'flag apagado');
  assert.match((await controlador(t, { aj: { modo: 'simulacro' } }).llamar({ confirmado: true })).datos.error, /simulacro/);
  assert.match((await controlador(t, { aj: { conductor: 'metricool' } }).llamar({ confirmado: true })).datos.error, /Meta directo/);
  assert.match(motivoNoYa({ modo: 'apagado' }), /apagado/);
  assert.equal((await controlador(t, { ret: { error: 'quita antes la programada en Facebook' } }).llamar({ confirmado: true })).status, 409);
  assert.equal(t.almacen.leer(t.id).estado, 'revision', 'ningún rechazo aprobó la pieza');
  const ok = await c.llamar({ confirmado: true });
  assert.equal(ok.status, 202, JSON.stringify(ok.datos)); assert.equal(ok.datos.publicando, true);
  assert.deepEqual(c.ticks, [{ solo: t.id }]);
  assert.equal(t.almacen.leer(t.id).aprobada.ya, true);
});

test('publicar-ya no está al alcance de Dimitri, el asistente, los agentes ni Telegram (B01)', () => {
  const lee = f => fs.readFileSync(path.join(raiz, f), 'utf8');
  const hallados = [];
  const ruta = d => { for (const f of fs.readdirSync(path.join(raiz, d), { withFileTypes: true })) { const r = d + '/' + f.name; if (f.isDirectory()) ruta(r); else if (/\.m?js$/.test(f.name) && /publicar-ya|publicarYa/.test(lee(r))) hallados.push(r); } };
  for (const d of ['contenido', 'oficina', 'src', 'cloudflare/worker', 'cloudflare/public', 'tareas', 'anuncios', 'media']) if (fs.existsSync(path.join(raiz, d))) ruta(d);
  for (const f of fs.readdirSync(raiz).filter(x => /\.m?js$/.test(x))) if (/publicar-ya|publicarYa/.test(lee(f))) hallados.push(f);
  const raros = hallados.filter(f => !/^(src\/|contenido\/|settings\.mjs$|serve\.mjs$|cloudflare\/(worker\/lib\/contenido\/|worker\/modulos\/contenido\.js$|public\/))/.test(f));
  assert.deepEqual(raros, [], 'publicar-ya solo vive en el controlador, la sesión, la página y los ajustes');
  for (const f of ['sub.mjs', 'oficina/rutas.mjs', 'oficina-mcp.mjs', 'contenido-mcp.mjs', 'telegram.mjs']) assert.ok(!/publicar-ya|publicarYa/.test(lee(f)), f);
  assert.match(lee('cloudflare/worker/modulos/contenido.js'), /repetir\|publicar-ya/, 'solo administrador en la nube');
});

test('CON-14: «unos 5 minutos» sale de UNA constante', () => {
  assert.equal(PRONTO_MIN, 5); assert.equal(PRONTO_TXT, 'unos 5 minutos');
  const malos = [];
  const ruta = d => { for (const f of fs.readdirSync(path.join(raiz, d), { withFileTypes: true })) { const r = (d === '.' ? '' : d + '/') + f.name; if (f.isDirectory()) { if (!['node_modules', 'dist', '.git', 'tests', 'docs', 'data'].includes(f.name)) ruta(r); } else if (/\.(m?js)$/.test(f.name) && r !== 'src/contenido-reglas.js' && r !== 'src/v1data.js') { if (/(unos|dentro de) 5 minutos/.test(fs.readFileSync(path.join(raiz, r), 'utf8'))) malos.push(r); } } };
  ruta('.'); assert.deepEqual(malos, []);
});
