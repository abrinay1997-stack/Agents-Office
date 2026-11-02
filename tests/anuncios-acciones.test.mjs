// Fase A2 de Anuncios (9 oct 2026): CONTROLAR (anuncios/acciones.mjs) con los módulos de verdad —contenido/meta.mjs, anuncios/meta-ads.mjs y
// anuncios/sincronizar.mjs— contra el Meta de mentira (tests/meta-stand.mjs). La regla del dinero (plan §3): lo que baja el gasto es un
// clic y se deshace; lo que gasta pide dos clics del DUEÑO con la cifra, dentro de los topes; Meta valida antes de cambiar; todo al historial.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearMetaStand, TOKEN_STAND, CUENTA_STAND } from './meta-stand.mjs';
import { crearMeta, PERMISOS_LECTURA, PERMISOS_ANUNCIOS } from '../contenido/meta.mjs';
import { crearMetaAds } from '../anuncios/meta-ads.mjs';
import { crearSincronizador } from '../anuncios/sincronizar.mjs';
import { crearAcciones, planear, quienDe, firmaDe, minimoDe, TIPOS, LIBRES, DE_GASTO, AVISO_APRENDIZAJE } from '../anuncios/acciones.mjs';
import { diasSemana } from '../anuncios/topes.mjs';
import { ErrorMeta } from '../contenido/meta.mjs';

const SEG = { geo_locations: { countries: ['PA'] }, age_min: 18, targeting_automation: { advantage_audience: 1 } };
const pedir = async (g, ruta, campos) => (await g.fetchFn(`https://graph.test/v26.0${ruta}`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN_STAND}` }, body: new URLSearchParams(Object.entries(campos).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])) })).json();

/** Una campaña con su conjunto y `n` anuncios, en el estado que se pida. */
async function campana(g, nombre, { estado = 'PAUSED', diario = 1000, cap = 10000, anuncios = 1, stop, end, start } = {}) {
  const c = await pedir(g, `/${CUENTA_STAND}/campaigns`, { name: `${nombre} · AO:b1`, objective: 'OUTCOME_ENGAGEMENT', special_ad_categories: [], status: 'PAUSED', daily_budget: diario, spend_cap: cap, ...(stop ? { stop_time: stop } : {}), ...(start ? { start_time: start } : {}) });
  const s = await pedir(g, `/${CUENTA_STAND}/adsets`, { campaign_id: c.id, name: `${nombre} PA`, optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', targeting: SEG, status: 'PAUSED', ...(end ? { end_time: end } : {}) });
  const cr = await pedir(g, `/${CUENTA_STAND}/adcreatives`, { name: 'k', object_story_spec: { page_id: 'P1' } });
  const a = []; for (let i = 0; i < anuncios; i++) a.push((await pedir(g, `/${CUENTA_STAND}/ads`, { adset_id: s.id, name: `${nombre} ${i}`, creative: { creative_id: cr.id }, status: 'PAUSED' })).id);
  await pedir(g, `/${s.id}`, { status: 'ACTIVE' }); for (const id of a) await pedir(g, `/${id}`, { status: 'ACTIVE' });
  if (estado === 'ACTIVE') await pedir(g, `/${c.id}`, { status: 'ACTIVE' });
  return { c: c.id, s: s.id, a };
}

async function montar(t, { topes = { topeDiario: 30, topeMensual: 300, topeCampana: 150 } } = {}) {
  const g = crearMetaStand({ permisos: [...PERMISOS_LECTURA, ...PERMISOS_ANUNCIOS] });
  const ids = {
    activa: await campana(g, 'Mensajes', { estado: 'ACTIVE', diario: 1000, cap: 10000 }), // US$10 al día, tope en Meta US$100
    combo: await campana(g, 'Combo', { diario: 1500, cap: 15000 }), // en pausa, US$15 al día, US$150 en Meta
    grande: await campana(g, 'Grande', { diario: 2500, cap: 20000 }), // en pausa, US$25 al día
    vieja: await campana(g, 'Vieja', { diario: 500, anuncios: 4, start: '2026-01-01T00:00:00+0000', stop: '2026-01-11T00:00:00+0000', end: '2026-01-11T00:00:00+0000' }),
    chica: await campana(g, 'Chica', { diario: 500, anuncios: 1, start: '2026-01-01T00:00:00+0000', stop: '2026-01-11T00:00:00+0000', end: '2026-01-11T00:00:00+0000' }),
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-acc-'));
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  const meta = crearMeta({ env: { META_ACCESS_TOKEN: TOKEN_STAND, META_GRAPH_HOST: 'https://graph.test' }, fetchFn: g.fetchFn, dir });
  const ads = crearMetaAds({ meta });
  const sync = crearSincronizador({ meta, ads, dir: path.join(dir, 'anuncios'), ajustes: () => ({ cuenta: CUENTA_STAND, ...topes }) });
  assert.deepEqual(await sync.sincronizar({ cifras: true }), { ok: true });
  const reloj = { t: Date.now() }, audit = [];
  const acc = crearAcciones({ sync, ads, ahora: () => reloj.t, auditar: a => audit.push(a), undoSeconds: () => 30 });
  return { g, ids, sync, acc, reloj, audit, dir };
}
const cambiosDe = (g, id) => g.st.cambios.filter(x => x.id === id);

test('las listas y quién es quién', () => {
  assert.deepEqual(TIPOS, [...LIBRES, ...DE_GASTO]);
  assert.deepEqual(LIBRES, ['pausar', 'bajar_presupuesto', 'archivar']); assert.deepEqual(DE_GASTO, ['activar', 'reanudar', 'subir_presupuesto', 'alargar', 'relanzar']);
  assert.equal(quienDe(undefined), 'dueno'); assert.equal(quienDe('telegram'), 'dueno'); assert.equal(quienDe('dimitri'), 'dimitri'); assert.equal(quienDe('agente'), 'agente'); assert.equal(quienDe('hacker'), 'otro');
  assert.equal(firmaDe({ tipo: 'subir_presupuesto', id: 'X', valor: '18' }), firmaDe({ tipo: 'subir_presupuesto', id: 'X', valor: 18 }), 'el mismo importe en texto o en número');
  assert.notEqual(firmaDe({ tipo: 'subir_presupuesto', id: 'X', valor: 18 }), firmaDe({ tipo: 'subir_presupuesto', id: 'X', valor: 19 }));
  assert.equal(minimoDe(new ErrorMeta({ error_user_msg: 'El presupuesto diario debe ser de al menos 100 centavos.' })), 1);
  assert.equal(minimoDe(new ErrorMeta({ message: 'The minimum budget for this ad set is $1.50' })), 1.5);
  const r = { tipo: 'anuncio', objeto: { id: 'A', nombre: 'A', estado: 'ACTIVE' }, conjunto: { nombre: 'S', estado: 'ACTIVE' }, campana: { nombre: 'C', estado: 'ACTIVE' } };
  assert.match(planear({ tipo: 'subir_presupuesto', r, valor: 5 }).error.cuerpo.motivo, /Un anuncio no tiene presupuesto propio/);
  assert.match(planear({ tipo: 'alargar', r, fin: '2030-01-01' }).error.cuerpo.motivo, /Un anuncio no tiene fecha de fin/);
});

test('pausar es un clic y se deshace (solo el dueño, dentro de los topes); todo queda en el historial y en la auditoría', async t => {
  const { g, ids, sync, acc, audit } = await montar(t);
  const r = await acc.accion({ tipo: 'pausar', id: ids.activa.c });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo)); assert.equal(r.cuerpo.ok, true); assert.match(r.cuerpo.hecho.texto, /En pausa: «Mensajes» \(campaña\)/);
  assert.equal(r.cuerpo.hecho.antes.estado, 'ACTIVE'); assert.equal(r.cuerpo.hecho.despues.estado, 'PAUSED');
  assert.equal(g.st.campanas[ids.activa.c].status, 'PAUSED'); assert.ok(g.st.validadas.some(x => x.id === ids.activa.c && x.campos.status === 'PAUSED'), 'Meta lo validó antes');
  assert.equal(sync.vista('7d').campanas.find(c => c.id === ids.activa.c).estado, 'PAUSED', 'cuenta.json, releído sin esperar a la próxima lectura');
  assert.ok(r.cuerpo.deshacer?.token); assert.ok(Date.parse(r.cuerpo.deshacer.hasta) > Date.now());
  assert.equal((await acc.accion({ tipo: 'pausar', id: ids.activa.c })).status, 409, 'ya estaba en pausa');
  assert.equal((await acc.deshacer({ token: r.cuerpo.deshacer.token, por: 'asistente' })).status, 403, 'deshacer vuelve a gastar: el asistente no');
  assert.equal((await acc.deshacer({ token: r.cuerpo.deshacer.token, por: 'agente' })).status, 403);
  const d = await acc.deshacer({ token: r.cuerpo.deshacer.token });
  assert.equal(d.status, 200, JSON.stringify(d.cuerpo)); assert.equal(g.st.campanas[ids.activa.c].status, 'ACTIVE');
  assert.equal((await acc.deshacer({ token: r.cuerpo.deshacer.token })).status, 409, 'una vez');
  const h = sync.historial();
  assert.deepEqual(h.map(x => x.que), ['deshacer:pausar', 'pausar'], 'lo más nuevo primero');
  assert.deepEqual(h[1].objeto, { id: ids.activa.c, nivel: 'campana', nombre: 'Mensajes', cuenta: 'Facebook página P1' }, '2 nov 2026: el historial apunta sobre qué cuenta se hizo (aquí el Meta de mentira sin nombres cargados: solo el id de la página)'); assert.equal(h[1].quien, 'dueno');
  assert.ok(audit.filter(a => a.ok).length >= 2);
  // el asistente pausa, pero no recibe con qué deshacer; un agente, nada
  const as = await acc.accion({ tipo: 'pausar', id: ids.activa.c, por: 'asistente' });
  assert.equal(as.status, 200); assert.equal(as.cuerpo.deshacer, null); assert.equal(sync.historial()[0].quien, 'asistente');
  assert.equal((await acc.accion({ tipo: 'pausar', id: ids.activa.c, por: 'agente' })).status, 403);
});

test('activar: la primera llamada NO cambia nada y dice la cifra; la segunda, del dueño, con el token de ESA acción, lo hace — una vez', async t => {
  const { g, ids, sync, acc, reloj } = await montar(t);
  const antes = g.st.cambios.length;
  const r = await acc.accion({ tipo: 'activar', id: ids.combo.c });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo)); assert.ok(r.cuerpo.confirmar); assert.equal(r.cuerpo.ok, undefined);
  const sem = Math.min(15 * diasSemana(sync.hoy()), 150);
  assert.equal(r.cuerpo.confirmar.texto, `Activar «Combo» — gasta hasta US$15 al día, US$${sem} esta semana`);
  assert.equal(r.cuerpo.confirmar.cifras.dia, 15); assert.equal(r.cuerpo.confirmar.cifras.campana, 150, 'el spend_cap de Meta es el techo');
  assert.ok(Date.parse(r.cuerpo.confirmar.vence) - Date.now() <= 2 * 60e3 + 1000);
  assert.equal(g.st.cambios.length, antes, 'nada cambió en Meta'); assert.equal(g.st.campanas[ids.combo.c].status, 'PAUSED');
  assert.ok(g.st.validadas.some(x => x.id === ids.combo.c && x.campos.status === 'ACTIVE'), 'pero Meta lo validó');
  // otra acción con ese token, o el token de otro, no
  assert.equal((await acc.accion({ tipo: 'activar', id: ids.grande.c, confirmacion: r.cuerpo.confirmar.token })).status, 409);
  const r2 = await acc.accion({ tipo: 'activar', id: ids.combo.c });
  const ok = await acc.accion({ tipo: 'activar', id: ids.combo.c, confirmacion: r2.cuerpo.confirmar.token });
  assert.equal(ok.status, 200, JSON.stringify(ok.cuerpo)); assert.equal(ok.cuerpo.ok, true); assert.match(ok.cuerpo.hecho.texto, /Activado: «Combo» \(campaña\)\. Gasta hasta US\$15 al día\./);
  assert.equal(g.st.campanas[ids.combo.c].status, 'ACTIVE'); assert.equal(ok.cuerpo.deshacer, null, 'activar no se deshace con un clic: pausar sí');
  const reuso = await acc.accion({ tipo: 'activar', id: ids.combo.c, confirmacion: r2.cuerpo.confirmar.token });
  assert.equal(reuso.status, 409); assert.equal(reuso.cuerpo.error, 'confirmacion'); assert.match(reuso.cuerpo.motivo, /ya se usó/);
  // vencida
  await acc.accion({ tipo: 'pausar', id: ids.combo.c });
  const r3 = await acc.accion({ tipo: 'reanudar', id: ids.combo.c });
  reloj.t += 3 * 60e3;
  const tarde = await acc.accion({ tipo: 'reanudar', id: ids.combo.c, confirmacion: r3.cuerpo.confirmar.token });
  assert.equal(tarde.status, 409); assert.match(tarde.cuerpo.motivo, /venció/); assert.equal(g.st.campanas[ids.combo.c].status, 'PAUSED');
  assert.equal(sync.historial().filter(x => x.que === 'activar').length, 1);
});

test('Dimitri pide la cifra (primera llamada) pero no confirma; el dueño sí, con el token que pidió Dimitri; el asistente y un agente, nada que gaste', async t => {
  const { g, ids, sync, acc } = await montar(t);
  assert.equal((await acc.accion({ tipo: 'activar', id: ids.combo.c, por: 'asistente' })).status, 403);
  assert.equal((await acc.accion({ tipo: 'relanzar', id: ids.vieja.c, por: 'asistente' })).status, 403);
  assert.equal((await acc.accion({ tipo: 'activar', id: ids.combo.c, por: 'agente' })).status, 403);
  assert.equal((await acc.accion({ tipo: 'activar', id: ids.combo.c, por: 'piloto' })).status, 403, 'el piloto automático solo baja el gasto');
  const d = await acc.accion({ tipo: 'activar', id: ids.combo.c, por: 'dimitri' });
  assert.equal(d.status, 200); assert.ok(d.cuerpo.confirmar);
  const solo = await acc.accion({ tipo: 'activar', id: ids.combo.c, por: 'dimitri', confirmacion: d.cuerpo.confirmar.token });
  assert.equal(solo.status, 403, 'el segundo clic es del dueño'); assert.equal(g.st.campanas[ids.combo.c].status, 'PAUSED');
  const dueno = await acc.accion({ tipo: 'activar', id: ids.combo.c, confirmacion: d.cuerpo.confirmar.token });
  assert.equal(dueno.status, 200, JSON.stringify(dueno.cuerpo)); assert.equal(g.st.campanas[ids.combo.c].status, 'ACTIVE');
  const h = sync.historial()[0]; assert.equal(h.quien, 'dueno'); assert.equal(h.propuso, 'dimitri');
});

test('por encima de un tope: 409 con la cifra, sin atajo, y nada cambia en Meta', async t => {
  const { g, ids, acc, audit } = await montar(t);
  const r = await acc.accion({ tipo: 'activar', id: ids.grande.c });
  assert.equal(r.status, 409); assert.equal(r.cuerpo.error, 'tope'); assert.equal(r.cuerpo.cual, 'diario');
  assert.equal(r.cuerpo.motivo, 'Activar pasaría el tope diario: US$35 al día contra US$30.'); assert.equal(r.cuerpo.tope, 30); assert.equal(r.cuerpo.quedaria, 35);
  assert.equal(cambiosDe(g, ids.grande.c).length, 0); assert.equal(g.st.validadas.filter(x => x.id === ids.grande.c).length, 0, 'ni se le pregunta a Meta');
  assert.ok(audit.some(a => a.ok === false && a.que === 'activar'), 'el intento queda en la auditoría');
  const sub = await acc.accion({ tipo: 'subir_presupuesto', id: ids.activa.c, valor: 31 });
  assert.equal(sub.status, 409); assert.match(sub.cuerpo.motivo, /US\$31 al día contra US\$30/);
});

test('validate_only: Meta rechaza un presupuesto demasiado bajo → 422 con el motivo y el mínimo, sin cambiar nada', async t => {
  const { g, ids, acc } = await montar(t);
  const r = await acc.accion({ tipo: 'bajar_presupuesto', id: ids.activa.c, valor: 0.5 });
  assert.equal(r.status, 422, JSON.stringify(r.cuerpo)); assert.equal(r.cuerpo.error, 'meta'); assert.match(r.cuerpo.motivo, /presupuesto es demasiado bajo/); assert.equal(r.cuerpo.minimo, 1);
  assert.equal(cambiosDe(g, ids.activa.c).filter(x => x.campos.daily_budget).length, 0);
  const ok = await acc.accion({ tipo: 'bajar_presupuesto', id: ids.activa.c, valor: 6 });
  assert.equal(ok.status, 200); assert.equal(g.st.campanas[ids.activa.c].daily_budget, '600'); assert.ok(ok.cuerpo.deshacer);
  assert.match(ok.cuerpo.hecho.texto, /de US\$10 a US\$6 al día/);
  assert.equal((await acc.accion({ tipo: 'bajar_presupuesto', id: ids.activa.c, valor: 8 })).status, 400, 'bajar es a menos');
  assert.equal((await acc.deshacer({ token: ok.cuerpo.deshacer.token })).status, 200); assert.equal(g.st.campanas[ids.activa.c].daily_budget, '1000');
});

test('subir más de un 20 % lo que aprende avisa (no lo prohíbe); archivar no se deshace y lo archivado no se activa', async t => {
  const { g, ids, acc } = await montar(t);
  const r = await acc.accion({ tipo: 'subir_presupuesto', id: ids.activa.c, valor: 15 });
  assert.equal(r.status, 200); assert.ok(r.cuerpo.confirmar); assert.ok(r.cuerpo.aviso.includes(AVISO_APRENDIZAJE), r.cuerpo.aviso);
  assert.match(r.cuerpo.confirmar.texto, /^Subir el presupuesto de «Mensajes» de US\$10 a US\$15 al día — gasta hasta US\$15 al día/);
  assert.equal((await acc.accion({ tipo: 'subir_presupuesto', id: ids.activa.c, valor: 11 })).cuerpo.aviso, undefined, '+10 %: sin aviso');
  const ar = await acc.accion({ tipo: 'archivar', id: ids.combo.c });
  assert.equal(ar.status, 200); assert.equal(ar.cuerpo.deshacer, null); assert.equal(g.st.campanas[ids.combo.c].status, 'ARCHIVED'); assert.match(ar.cuerpo.hecho.texto, /No se puede deshacer/);
  const act = await acc.accion({ tipo: 'activar', id: ids.combo.c });
  assert.equal(act.status, 409); assert.match(act.cuerpo.motivo, /archivada: Meta no deja volver a encenderla/);
});

test('relanzar una terminada: una COPIA EN PAUSA con la etiqueta de la oficina; con más de 3 anuncios, por partes', async t => {
  const { g, ids, sync, acc } = await montar(t);
  const n0 = Object.keys(g.st.campanas).length;
  const r = await acc.accion({ tipo: 'relanzar', id: ids.vieja.c });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo)); assert.match(r.cuerpo.confirmar.texto, /^Relanzar «Vieja» como copia EN PAUSA \(del .+ al .+\) — no gasta nada hasta que la actives; entonces, hasta US\$5 al día$/);
  assert.match(r.cuerpo.aviso, /se copia por partes/); assert.equal(Object.keys(g.st.campanas).length, n0, 'la primera llamada no copia');
  const ok = await acc.accion({ tipo: 'relanzar', id: ids.vieja.c, confirmacion: r.cuerpo.confirmar.token });
  assert.equal(ok.status, 200, JSON.stringify(ok.cuerpo));
  const nueva = ok.cuerpo.hecho.despues.copia; assert.ok(g.st.campanas[nueva]);
  assert.equal(g.st.campanas[nueva].status, 'PAUSED'); assert.match(g.st.campanas[nueva].name, /^Vieja · AO:r[a-z0-9]+$/);
  assert.equal(g.st.copias.length, 6, 'la campaña sola, su conjunto y sus 4 anuncios, uno a uno');
  const conj = Object.values(g.st.conjuntos).filter(s => s.campaign_id === nueva);
  assert.equal(conj.length, 1); assert.equal(conj[0].status, 'PAUSED'); assert.ok(Date.parse(conj[0].end_time.replace('+0000', 'Z')) > Date.now(), 'con fechas nuevas');
  assert.equal(Object.values(g.st.anuncios).filter(a => a.adset_id === conj[0].id && a.status === 'PAUSED').length, 4);
  assert.ok(sync.vista('7d').campanas.some(c => c.id === nueva), 'la copia ya se ve en el panel');
  const una = await acc.accion({ tipo: 'relanzar', id: ids.chica.c });
  const ok2 = await acc.accion({ tipo: 'relanzar', id: ids.chica.c, confirmacion: una.cuerpo.confirmar.token });
  assert.equal(ok2.status, 200); assert.equal(g.st.copias.at(-1).campos.deep_copy, 'true', 'con hasta 3 anuncios, de una vez');
  assert.equal(sync.historial().filter(x => x.que === 'relanzar').length, 2);
  assert.equal((await acc.accion({ tipo: 'relanzar', id: ids.activa.c })).status, 409, 'una activa no se relanza');
});
