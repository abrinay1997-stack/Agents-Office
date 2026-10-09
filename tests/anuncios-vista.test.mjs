// Fase A1 (9 oct 2026): la vista Anuncios — lo puro (dinero siempre con su moneda, %, «—» cuando no se sabe, tendencias, topes, estados
// en palabras), filtrar y ordenar campañas, aplanar campaña → conjunto → anuncio, el HTML (un botón nunca dentro de otro), los datos de
// ejemplo y el paquete aparte (su línea de versión; la página no lo lleva dentro).
// Fase A2 (9 oct 2026): qué acciones ofrece cada estado, el segundo botón con su cifra, la demo con las reglas del dinero (topes, la
// confirmación que vence, el aviso de aprendizaje, el mínimo de Meta, DESHACER, el historial) y la tarjeta de Dimitri para lo que gasta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dinero, pct, num, frec, tendencia, contraTope, estadoDe, aprendizajeDe, tieneProblemas, haceCuanto, fechaCorta, resultados, presupuesto, SIN } from '../src/anuncios/comun.js';
import { filtrar, ordenar, aplanar, buscar, campanasHTML } from '../src/anuncios/campanas.js';
import { resumenHTML, avisosHTML } from '../src/anuncios/resumen.js';
import { detalleHTML } from '../src/anuncios/detalle.js';
import { historialHTML, filtrarHistorial } from '../src/anuncios/historial.js';
import { datosDeEjemplo, crearDemo, TOPES_DEMO } from '../src/anuncios/demo.js';
import { accionesDe, interruptorDe, menuDe, botonSi, cifrasConfirmarHTML, controlesHTML, menuHTML, confirmarHTML, errorHTML, formularioHTML, errorImporte, reiniciaAprendizaje, presupuestoDe, GASTO } from '../src/anuncios/acciones.js';
import { opLabel, opsHTML, opsBody, gastoBoton, gastoBody, gastoHecho, GASTO_OPS } from '../src/sub-ops.js';
import { construirAnuncios, CSS_ANUNCIOS } from '../build-anuncios.mjs';

const plano = s => s.replace(/\s/g, ' '); // Intl pone espacios duros

test('el dinero lleva siempre la moneda de la cuenta; lo que no se sabe es «—», nunca 0', () => {
  assert.match(plano(dinero(12.4, 'USD')), /^12,40 US\$$/);
  assert.match(plano(dinero(0, 'USD')), /^0,00 US\$$/, 'un 0 de verdad sí se escribe');
  assert.equal(dinero(null, 'USD'), SIN); assert.equal(dinero(undefined), SIN); assert.equal(dinero(NaN), SIN); assert.equal(dinero('abc'), SIN);
  assert.match(plano(dinero(1500, 'USD')), /^1\.?500 US\$$/, 'de mil para arriba, sin centavos');
  assert.match(plano(dinero(3, 'EUR')), /€/);
  assert.match(dinero(3, 'XX1'), /XX1/, 'una moneda rara también se nombra');
  assert.equal(plano(pct(1.234)), '1,23 %'); assert.equal(pct(null), SIN);
  assert.equal(num(12345), '12.345'); assert.equal(num(null), SIN); assert.equal(frec(1.5), '1,50');
  assert.equal(resultados({ resultados: 12, resultadoTexto: 'conversaciones' }), '12 conversaciones'); assert.equal(resultados({ resultados: null, resultadoTexto: 'x' }), SIN);
  assert.match(plano(presupuesto({ tipo: 'diario', usd: 8 }, 'USD')), /8,00 US\$ al día/); assert.equal(presupuesto(null, 'USD'), SIN);
});

test('tendencias y topes: una flecha siempre con su palabra; sin con qué comparar se dice', () => {
  assert.deepEqual(tendencia(12, true), { texto: 'sube 12 %', tono: 'verde', flecha: '▲' });
  assert.equal(tendencia(12, false).tono, 'rojo', 'un gasto que sube no es «bueno»');
  assert.equal(tendencia(-5.1, false).texto, 'baja 5,1 %'); assert.equal(tendencia(null).texto, 'sin con qué comparar'); assert.equal(tendencia(0).texto, 'igual que antes');
  assert.equal(contraTope(5, 0), null, 'tope 0 o vacío = sin tope'); assert.equal(contraTope(9, 10).tono, 'ambar'); assert.equal(contraTope(10, 10).tono, 'rojo'); assert.equal(contraTope(2, 10).pct, 20);
  assert.equal(contraTope(null, 10).pct, null);
});

test('estados y aprendizaje en palabras; los problemas se ven desde la campaña', () => {
  assert.equal(estadoDe({ estado: 'PAUSED' }).texto, 'En pausa'); assert.equal(estadoDe({ estado: 'DISAPPROVED' }).tono, 'rojo');
  assert.equal(estadoDe({ estado: 'ACTIVE', estadoTexto: 'Activa (lo dice el servidor)' }).texto, 'Activa (lo dice el servidor)');
  assert.equal(aprendizajeDe({ estado: 'LEARNING', conversiones: 18 }).texto, 'Aprendiendo (18 de 50)'); assert.equal(aprendizajeDe({ estado: 'FAIL' }).tono, 'rojo'); assert.equal(aprendizajeDe(null).texto, SIN);
  const d = datosDeEjemplo('7d');
  assert.ok(tieneProblemas(d.campanas[0]), 'un anuncio rechazado se ve desde su campaña');
  assert.ok(!tieneProblemas(d.campanas[2]));
  assert.equal(haceCuanto(Date.now() - 5 * 6e4), 'hace 5 min'); assert.equal(haceCuanto(Date.now() - 864e5), 'hace 1 día'); assert.equal(haceCuanto(null), null);
  assert.equal(fechaCorta('2026-10-20', SIN, new Date('2026-10-09').getTime()), '20 oct'); assert.equal(fechaCorta(null, 'sin fin'), 'sin fin');
});

test('filtrar y ordenar: activas, en pausa, con problemas; lo que no se sabe va al final', () => {
  const d = datosDeEjemplo('7d'), c = d.campanas;
  assert.deepEqual(filtrar(c, 'activas').map(x => x.id), ['ej-c-1', 'ej-c-2']);
  assert.deepEqual(filtrar(c, 'pausa').map(x => x.id), ['ej-c-3', 'ej-c-4']);
  assert.deepEqual(filtrar(c, 'problemas').map(x => x.id).sort(), ['ej-c-1', 'ej-c-2']);
  assert.equal(filtrar(c, 'todas').length, 4);
  const l = [{ id: 'a', nombre: 'B', cifras: { gasto: 5, costoPorResultado: 2 } }, { id: 'b', nombre: 'A', cifras: { gasto: null, costoPorResultado: null } }, { id: 'c', nombre: 'C', cifras: { gasto: 9, costoPorResultado: 1 } }];
  assert.deepEqual(ordenar(l, 'gasto').map(x => x.id), ['c', 'a', 'b']);
  assert.deepEqual(ordenar(l, 'costo').map(x => x.id), ['c', 'a', 'b'], 'el costo, de menor a mayor; sin dato, al final');
  assert.deepEqual(ordenar(l, 'nombre').map(x => x.id), ['b', 'a', 'c']);
  const o = ordenar(c, 'gasto'); assert.ok(o[0].conjuntos[0].anuncios.length, 'por dentro también'); assert.ok((o[0].conjuntos[0].anuncios[0].cifras.gasto ?? -1) >= (o[0].conjuntos[0].anuncios.at(-1).cifras.gasto ?? -1));
});

test('aplanar: campaña → conjunto → anuncio, solo lo desplegado; buscar da los padres', () => {
  const c = datosDeEjemplo('7d').campanas;
  assert.deepEqual(aplanar(c).map(f => f.nivel), ['campana', 'campana', 'campana', 'campana']);
  const f = aplanar(c, new Set(['ej-c-1', 'ej-as-1']));
  assert.deepEqual(f.map(x => `${x.nivel}:${x.id}`), ['campana:ej-c-1', 'conjunto:ej-as-1', 'anuncio:ej-ad-11', 'anuncio:ej-ad-12', 'campana:ej-c-2', 'campana:ej-c-3', 'campana:ej-c-4']);
  assert.equal(f[0].abierto, true); assert.equal(f[0].hijos, 1); assert.equal(f[4].abierto, false);
  assert.deepEqual(aplanar(c, new Set(['ej-as-1'])).length, 4, 'un conjunto abierto dentro de una campaña cerrada no aparece');
  const b = buscar(c, 'ej-ad-12'); assert.equal(b.nivel, 'anuncio'); assert.equal(b.campana.id, 'ej-c-1'); assert.equal(b.conjunto.id, 'ej-as-1');
  assert.equal(buscar(c, 'nada'), null);
});

test('el HTML: el nombre es el botón; nunca un botón dentro de otro; el interruptor aparte; la moneda junto a cada cifra', () => {
  const d = datosDeEjemplo('7d'), abiertos = new Set(['ej-c-1', 'ej-as-1', 'ej-c-2', 'ej-as-2']);
  const h = campanasHTML(d, { abiertos, sel: 'ej-ad-12' });
  assert.match(h, /<button type="button" class="anu-abrir" data-abrir="ej-c-1">Mensajes por WhatsApp — Combo lentes<\/button>/);
  assert.match(h, /data-tog="ej-c-1" aria-expanded="true"/); assert.match(h, /class="anu-fila n-anuncio sel" data-fila="ej-ad-12"/);
  assert.match(h, /creado fuera/); assert.match(h, /Rechazado/); assert.match(h, /Aprendiendo: 18 de 50/); assert.match(h, /Fuera del aprendizaje/);
  for (const x of [h, resumenHTML(d), detalleHTML(buscar(d.campanas, 'ej-ad-12'), { moneda: 'USD' })]) {
    assert.doesNotMatch(x, /<button[^>]*>(?:(?!<\/button>).)*<button/s, 'un botón nunca dentro de otro');
    assert.doesNotMatch(x, /data-acc="(borrar|publicar|pagar|eliminar)"/, 'nada borra ni publica');
  }
  assert.match(h, /class="anu-int" data-acc="pausar" data-id="ej-c-1"[^>]*>.*Pausar<\/button>/, 'el interruptor de una activa dice «Pausar», con texto');
  assert.match(h, /data-menu="ej-c-1" aria-haspopup="menu" aria-expanded="false"/);
  assert.match(campanasHTML(d), /class="anu-int gasta" data-acc="activar" data-id="ej-c-4"/, 'la que está en pausa sin estrenar ofrece «Activar», marcado como gasto');
  const dineros = [...plano(h).matchAll(/data-l="(?:Presupuesto|Gasto|Costo por resultado)"[^>]*>([^<]*)</g)].map(m => m[1]).filter(x => x !== SIN);
  assert.ok(dineros.length > 6 && dineros.every(x => /US\$/.test(x)), 'cada importe lleva su moneda: ' + dineros.join(' | '));
  const det = detalleHTML(buscar(d.campanas, 'ej-ad-12'), { moneda: 'USD' });
  assert.match(det, /condición personal/); assert.match(det, /<img src="data:image\/svg\+xml/); assert.match(det, /Enviar mensaje/);
  assert.match(campanasHTML({ ...d, campanas: [] }), /No hay campañas en esta cuenta/);
  assert.match(campanasHTML(d, { filtro: 'pausa' }), /ej-c-3/); assert.doesNotMatch(campanasHTML(d, { filtro: 'pausa' }), /data-abrir="ej-c-1"/);
});

test('el resumen: avisos ordenados, cuatro cifras contra los topes, la tarjeta de conexión sin Meta', () => {
  const d = datosDeEjemplo('7d'), h = plano(resumenHTML(d));
  assert.match(h, /Gasto de hoy/); assert.match(h, new RegExp(`del tope diario de ${TOPES_DEMO.diario},00 US\\$`));
  assert.match(h, /data-acc="pausar" data-id="ej-c-1"/, 'las tarjetas del Resumen llevan su interruptor'); assert.match(h, /Gasto del mes/); assert.match(h, /Resultados · 7 días/); assert.match(h, /Costo por resultado · 7 días/);
  assert.match(h, /sube 14,2 %/); assert.match(h, /Campañas activas <span class="anu-cuenta">2</);
  const av = avisosHTML({ avisos: [{ nivel: 'info', texto: 'i' }, { nivel: 'bad', texto: 'b' }], error: null });
  assert.ok(av.indexOf('>b<') < av.indexOf('>i<'), 'lo grave primero');
  assert.match(avisosHTML({ avisos: [], error: 'token caducado' }), /La última lectura de Meta falló: token caducado/);
  const sin = resumenHTML({ configurado: false, motivo: 'Sin cuenta publicitaria elegida.', campanas: [] });
  assert.match(sin, /Sin cuenta publicitaria elegida\./); assert.match(sin, /data-a="ejemplo">Ver con datos de ejemplo/); assert.match(sin, /docs\/conectar-meta\.md/); assert.match(sin, /Ajustes → Anuncios/);
  assert.match(plano(resumenHTML({ ...d, topes: { diario: 0, mensual: null } })), /sin tope diario/);
});

test('el historial vacío dice qué aparecerá; con cambios, quién, qué, antes y después', () => {
  assert.match(historialHTML([]), /Todavía no hay cambios/); assert.match(historialHTML([]), /pausa, activación o cambio de presupuesto, con quién lo hizo/);
  const h = historialHTML([{ at: '2026-10-09T10:00:00Z', quien: 'dimitri', que: 'pausó la campaña', objeto: { nombre: 'Combo' }, antes: 'Activa', despues: 'En pausa' }, { at: 'no es fecha', quien: 'dueno', que: 'x' }]);
  assert.match(h, /<b>Dimitri<\/b> pausó la campaña · <span>Combo/); assert.match(h, /Antes: Activa → Después: En pausa/); assert.match(h, /<b>Tú<\/b>/);
});

test('los datos de ejemplo: rotulados, siguen el rango y traen lo que hay que ver', () => {
  const s = datosDeEjemplo('7d'), m = datosDeEjemplo('30d'), h = datosDeEjemplo('hoy');
  assert.equal(s.ejemplo, true); assert.equal(s.configurado, true); assert.equal(s.cuenta.moneda, 'USD');
  assert.ok(m.campanas[0].cifras.gasto > s.campanas[0].cifras.gasto && h.campanas[0].cifras.gasto < s.campanas[0].cifras.gasto);
  const todo = JSON.stringify(s);
  for (const x of ['LEARNING', 'SUCCESS', 'DISAPPROVED', 'WITH_ISSUES', '"creadoFuera":true']) assert.ok(todo.includes(x), x);
});

test('el paquete aparte: su línea de versión y su estilo; la página no lleva la vista', async () => {
  const p = await construirAnuncios();
  assert.match(p.js, /^\/\*ao-anuncios:[0-9a-f]{12}\*\/\n/); assert.ok(p.js.includes(p.version)); assert.ok(!p.js.includes('@@AO_ANUNCIOS_VERSION@@'));
  assert.ok(p.aparte.includes('src/anuncios/vista.js') && p.aparte.includes('src/anuncios/demo.js'));
  assert.deepEqual(CSS_ANUNCIOS, ['anuncios.css']); assert.ok(p.js.includes('/* ---- src/css/anuncios.css ---- */'));
  assert.ok(p.js.includes('window.AO_ANUNCIOS') || /AO_ANUNCIOS/.test(p.js));
  const page = 'dist/command-centre-v2.html';
  if (fs.existsSync(page)) {
    const html = fs.readFileSync(page, 'utf8');
    assert.ok(!html.includes('/* ---- src/css/anuncios.css ---- */'), 'el estilo de Anuncios viaja con su paquete, no con la página');
    assert.ok(!html.includes('anu-tabla-caja'), 'la página no lleva la vista Anuncios');
    assert.ok(html.includes('id="topAnuncios"'), 'el botón del dock sí');
  }
  const carga = fs.readFileSync('src/anuncios-carga.js', 'utf8');
  assert.doesNotMatch(carga, /from '\.\/anuncios\//, 'el cargador no importa la vista');
});

/* ---------------- Fase A2 ---------------- */
const fila = (nivel, nodo, extra = {}) => ({ nivel, id: nodo.id, nodo, campana: nivel === 'campana' ? nodo : extra.campana, conjunto: extra.conjunto });
const tipos = f => accionesDe(f).map(a => a.tipo);
const camp = (estado, x = {}) => ({ id: 'c', nombre: 'C', estado, presupuesto: { tipo: 'diario', usd: 10 }, fin: '2099-01-01', cifras: { gasto: 5 }, conjuntos: [], ...x });

test('A2 · qué ofrece cada estado: ACTIVE pausa (nunca activa), PAUSED activa o reanuda, ARCHIVED solo relanza, DISAPPROVED nunca activa', () => {
  const act = fila('campana', camp('ACTIVE'));
  assert.equal(interruptorDe(accionesDe(act)).tipo, 'pausar'); assert.ok(!tipos(act).includes('activar') && !tipos(act).includes('reanudar'));
  assert.deepEqual(tipos(act), ['pausar', 'subir_presupuesto', 'bajar_presupuesto', 'alargar', 'archivar']);
  assert.equal(interruptorDe(accionesDe(fila('campana', camp('PAUSED', { cifras: { gasto: 0 } })))).tipo, 'activar', 'en pausa sin estrenar: Activar');
  assert.equal(interruptorDe(accionesDe(fila('campana', camp('PAUSED')))).tipo, 'reanudar', 'en pausa con gasto: Reanudar');
  assert.ok(!tipos(fila('campana', camp('PAUSED'))).includes('pausar'));
  assert.deepEqual(tipos(fila('campana', camp('ARCHIVED'))), ['relanzar'], 'archivada: solo relanzar');
  assert.deepEqual(tipos(fila('anuncio', { id: 'a', estado: 'ARCHIVED' }, { campana: camp('ACTIVE') })), [], 'un anuncio archivado: nada');
  const rech = tipos(fila('anuncio', { id: 'a', estado: 'DISAPPROVED' }, { campana: camp('ACTIVE') }));
  assert.deepEqual(rech, ['pausar', 'archivar'], 'rechazado: activarlo no sirve');
  const prob = tipos(fila('conjunto', { id: 's', estado: 'WITH_ISSUES', presupuesto: { tipo: 'diario', usd: 5 } }, { campana: camp('ACTIVE', { presupuesto: null }) }));
  assert.ok(prob.includes('bajar_presupuesto') && !prob.includes('subir_presupuesto'), 'con problemas: se puede bajar, no subir');
  const term = accionesDe(fila('campana', camp('PAUSED', { fin: '2020-01-01' })));
  assert.deepEqual(term.map(a => a.tipo), ['relanzar', 'alargar', 'archivar']); assert.equal(interruptorDe(term), null, 'terminada: sin interruptor');
  assert.match(term[0].nota, /EN PAUSA con fechas nuevas/); assert.match(term.at(-1).nota, /no se borra: se archiva/);
  const dep = accionesDe(fila('conjunto', { id: 's', estado: 'CAMPAIGN_PAUSED' }, { campana: camp('PAUSED') }));
  assert.equal(interruptorDe(dep), null); assert.equal(dep[0].depende, 'campana');
  assert.match(controlesHTML(fila('conjunto', { id: 's', estado: 'CAMPAIGN_PAUSED' }, { campana: camp('PAUSED') })), /En pausa por su campaña/);
  assert.deepEqual(tipos(fila('anuncio', { id: 'a', estado: 'ACTIVE' }, { campana: camp('ACTIVE', { fin: '2020-01-01' }) })), ['archivar'], 'en una campaña terminada, lo de dentro solo se archiva');
  for (const t of ['activar', 'reanudar', 'subir_presupuesto', 'alargar', 'relanzar']) assert.ok(GASTO.has(t)); for (const t of ['pausar', 'bajar_presupuesto', 'archivar']) assert.ok(!GASTO.has(t));
  const m = menuHTML(act); assert.match(m, /role="menu"/); assert.equal((m.match(/role="menuitem"/g) || []).length, menuDe(accionesDe(act)).length); assert.match(m, /Subir presupuesto <em class="anu-gasta">gasta<\/em>/); assert.doesNotMatch(m, /data-acc="pausar"/, 'el interruptor no se repite en el menú');
});

test('A2 · el segundo botón dice la cifra con su moneda; la confirmación vence; los errores con su cifra', () => {
  const conf = { token: 't', texto: 'Activar «X» — gasta hasta 15,00 US$ al día, 105,00 US$ esta semana', cifras: { dia: 15, semana: 105, mes: 300, campana: 450 }, vence: new Date(Date.now() + 60000).toISOString() };
  assert.equal(plano(botonSi('activar', conf, 'USD')), 'Sí, activar — hasta 15,00 US$ al día');
  assert.equal(plano(botonSi('subir_presupuesto', { cifras: { dia: 12 } })), 'Sí, subir — hasta 12,00 US$ al día');
  assert.equal(plano(botonSi('activar', { cifras: { campana: 60 } })), 'Sí, activar — hasta 60,00 US$ en la campaña', 'un presupuesto total');
  assert.equal(botonSi('relanzar', { cifras: {} }), 'Sí, relanzar — nace en pausa');
  assert.match(plano(cifrasConfirmarHTML(conf.cifras, 'USD')), /Al día<\/dt><dd>hasta 15,00 US\$.*Esta semana.*105,00 US\$.*Hasta fin de mes.*En toda la campaña/);
  const f = fila('campana', camp('PAUSED', { nombre: 'X' }));
  const c = plano(confirmarHTML(f, 'activar', conf, { aviso: 'reinicia el aprendizaje' }));
  assert.match(c, /data-dlg="si">Sí, activar — hasta 15,00 US\$ al día</); assert.match(c, /Antes de decir que sí.*reinicia el aprendizaje/); assert.ok(c.indexOf('reinicia') < c.indexOf('data-dlg="si"'), 'el aviso va ANTES del «Sí»');
  const v = confirmarHTML(f, 'activar', { ...conf, vence: new Date(Date.now() - 1).toISOString() });
  assert.match(v, /Venció: vuelve a pedirlo\./); assert.doesNotMatch(v, /data-dlg="si"/, 'vencida: no hay «Sí»');
  const t = plano(errorHTML(f, 'activar', { error: 'tope', motivo: 'Sumaría 37,00 US$ al día', tope: 30, quedaria: 37 }));
  assert.match(t, /No cabe en tus topes/); assert.match(t, /Tu tope<\/dt><dd>30,00 US\$/); assert.match(t, /Quedaría en<\/dt><dd>37,00 US\$/); assert.match(t, /No hay atajo/); assert.doesNotMatch(t, /data-dlg="si"/);
  assert.match(plano(errorHTML(f, 'bajar_presupuesto', { error: 'meta', motivo: 'mínimo', minimo: 1 })), /data-dlg="minimo" data-minimo="1">Poner el mínimo \(1,00 US\$\)/);
  assert.match(errorHTML(f, 'activar', { error: 'confirmacion', motivo: 'venció' }), /data-dlg="otra"/);
  const fo = formularioHTML(f, 'subir_presupuesto', { moneda: 'USD' });
  assert.match(plano(fo), /Ahora: <b>10,00 US\$ al día/); assert.match(fo, /en USD/); assert.match(fo, /Ver lo que gasta/);
  assert.match(formularioHTML(f, 'relanzar'), /EN PAUSA/);
  assert.equal(errorImporte('subir_presupuesto', '8', 10), 'Para subirlo, el importe nuevo tiene que ser mayor que el de ahora.');
  assert.equal(errorImporte('bajar_presupuesto', '8', 10), ''); assert.match(errorImporte('bajar_presupuesto', '', 10), /importe/); assert.match(errorImporte('bajar_presupuesto', '0', 10), /mayor que 0/);
  const apr = fila('conjunto', { id: 's', aprendizaje: { estado: 'LEARNING' } }, { campana: camp('ACTIVE') });
  assert.ok(reiniciaAprendizaje(apr, 10, 12.5)); assert.ok(!reiniciaAprendizaje(apr, 10, 12)); assert.ok(!reiniciaAprendizaje(fila('conjunto', { id: 's', aprendizaje: { estado: 'SUCCESS' } }, { campana: camp('ACTIVE') }), 10, 20));
});

test('A2 · la demo respeta las reglas del dinero: dos clics con la cifra, topes sin atajo, vence a los 2 min, DESHACER, mínimo de Meta, historial', () => {
  let t = Date.now(); const reloj = () => t, d = crearDemo({ ahora: reloj });
  const estado = id => buscar(d.vista().campanas, id).nodo.estado;
  // pausar: un clic, con DESHACER
  const p = d.accion({ tipo: 'pausar', id: 'ej-c-2' });
  assert.equal(p.status, 200); assert.ok(p.ok); assert.match(p.hecho.texto, /Pausaste/); assert.ok(p.deshacer?.token); assert.equal(estado('ej-c-2'), 'PAUSED');
  assert.equal(buscar(d.vista().campanas, 'ej-as-2').nodo.estado, 'CAMPAIGN_PAUSED', 'su conjunto queda en pausa por la campaña');
  assert.ok(d.deshacer({ token: p.deshacer.token }).ok); assert.equal(estado('ej-c-2'), 'ACTIVE', 'DESHACER la devuelve');
  // activar: el primer clic NO activa; trae la cifra
  const c1 = d.accion({ tipo: 'activar', id: 'ej-c-4' });
  assert.equal(c1.status, 200); assert.ok(!c1.ok && c1.confirmar?.token); assert.equal(estado('ej-c-4'), 'PAUSED', 'el primer clic no gasta');
  assert.match(plano(c1.confirmar.texto), /gasta hasta 10,00 US\$ al día, 70,00 US\$ esta semana/); assert.equal(c1.confirmar.cifras.dia, 10);
  assert.equal(d.accion({ tipo: 'activar', id: 'ej-c-4', confirmacion: 'inventado' }).error, 'confirmacion', 'un token que no existe no vale');
  assert.equal(estado('ej-c-4'), 'PAUSED');
  const c2 = d.accion({ tipo: 'activar', id: 'ej-c-4' }); t += 121000;
  const venc = d.accion({ tipo: 'activar', id: 'ej-c-4', confirmacion: c2.confirmar.token });
  assert.equal(venc.status, 409); assert.equal(venc.error, 'confirmacion'); assert.equal(estado('ej-c-4'), 'PAUSED', 'vencida: no gasta');
  const c3 = d.accion({ tipo: 'activar', id: 'ej-c-4' }), ok = d.accion({ tipo: 'activar', id: 'ej-c-4', confirmacion: c3.confirmar.token });
  assert.ok(ok.ok); assert.equal(estado('ej-c-4'), 'ACTIVE'); assert.equal(ok.deshacer, null, 'lo que gasta no trae DESHACER: se pausa');
  assert.equal(d.accion({ tipo: 'activar', id: 'ej-c-4', confirmacion: c3.confirmar.token }).status, 409, 'el mismo token no vale dos veces');
  // subir: el aviso de aprendizaje antes del «Sí»; pasar el tope → el motivo con la cifra y nada cambia
  const s1 = d.accion({ tipo: 'subir_presupuesto', id: 'ej-c-1', valor: 9 });
  assert.ok(s1.confirmar && !s1.aviso, 'subir menos de un 20 %: sin aviso');
  const s2 = d.accion({ tipo: 'subir_presupuesto', id: 'ej-c-1', valor: 12 });
  assert.ok(s2.confirmar); assert.match(s2.aviso, /reinicia el aprendizaje/);
  const tope = d.accion({ tipo: 'subir_presupuesto', id: 'ej-c-1', valor: 20 });
  assert.equal(tope.status, 409); assert.equal(tope.error, 'tope'); assert.equal(tope.tope, TOPES_DEMO.diario); assert.ok(tope.quedaria > TOPES_DEMO.diario); assert.match(plano(tope.motivo), /tope diario es 30,00 US\$/);
  assert.equal(d.accion({ tipo: 'subir_presupuesto', id: 'ej-c-1', valor: 9, confirmacion: s2.confirmar.token }).error, 'confirmacion', 'un token de otra cifra no sirve para esta');
  assert.equal(buscar(d.vista().campanas, 'ej-c-1').nodo.presupuesto.usd, 8, 'el presupuesto no cambió');
  // bajar: libre; por debajo del mínimo, Meta lo rechaza con el mínimo
  const m = d.accion({ tipo: 'bajar_presupuesto', id: 'ej-as-2', valor: 0.5 });
  assert.equal(m.status, 422); assert.equal(m.error, 'meta'); assert.equal(m.minimo, 1);
  const b = d.accion({ tipo: 'bajar_presupuesto', id: 'ej-as-2', valor: 5 });
  assert.ok(b.ok && b.deshacer); assert.equal(buscar(d.vista().campanas, 'ej-as-2').nodo.presupuesto.usd, 5);
  // relanzar: dos clics; la copia nace en pausa
  const r1 = d.accion({ tipo: 'relanzar', id: 'ej-c-3' }); assert.match(r1.confirmar.texto, /EN PAUSA/);
  assert.ok(d.accion({ tipo: 'relanzar', id: 'ej-c-3', confirmacion: r1.confirmar.token }).ok);
  const copia = d.vista().campanas.find(c => c.id.startsWith('ej-c-3-r')); assert.equal(copia.estado, 'PAUSED'); assert.equal(copia.cifras.gasto, 0);
  // lo que no tiene sentido se rechaza
  assert.equal(d.accion({ tipo: 'activar', id: 'ej-c-1' }).status, 409, 'una activa no se «activa»');
  assert.equal(d.accion({ tipo: 'borrar', id: 'ej-c-1' }).status, 400);
  // el historial: lo más nuevo primero, quién, antes → después
  const h = d.historial().items;
  assert.equal(h[0].que, 'relanzó la campaña'); assert.ok(h.some(i => /activó/.test(i.que) && i.quien === 'dueno')); assert.ok(h.some(i => /^deshizo/.test(i.que)));
  assert.ok(filtrarHistorial(h, 'dimitri').length >= 1 && filtrarHistorial(h, 'dimitri').every(i => i.quien === 'dimitri'));
  assert.match(historialHTML(h, { quien: 'dimitri' }), /data-quien="dimitri" aria-pressed="true"/);
});

test('A2 · la tarjeta de Dimitri: lo que baja el gasto con HACER; lo que gasta pide el segundo clic con la cifra y va a /api/anuncios/accion', () => {
  for (const t of ['anuncio_activar', 'anuncio_reanudar', 'anuncio_subir_presupuesto', 'anuncio_relanzar']) assert.ok(GASTO_OPS.has(t));
  assert.ok(!GASTO_OPS.has('anuncio_pausar') && !GASTO_OPS.has('anuncio_bajar_presupuesto'));
  for (const t of ['anuncio_pausar', 'anuncio_bajar_presupuesto', 'anuncio_activar', 'anuncio_reanudar', 'anuncio_subir_presupuesto', 'anuncio_relanzar']) assert.ok(opLabel({ type: t, id: 'x', nombre: 'Combo', valor: 9 }), t);
  assert.match(opLabel({ type: 'anuncio_activar', id: 'x', nombre: 'Combo' }), /Activar en Meta «Combo» \(gasta\)/);
  assert.match(plano(opLabel({ type: 'anuncio_bajar_presupuesto', id: 'x', nombre: 'Combo', valor: 5 })), /a 5,00 US\$/);
  const esc = s => String(s).replace(/</g, '&lt;');
  const vence = Date.now() + 90000;
  const m = { id: 'm1', ops: [{ k: 0, type: 'anuncio_pausar', id: 'c1', nombre: 'Combo', state: 'proposed' },
    { k: 1, type: 'anuncio_activar', id: 'c4', nombre: 'Reseñas', state: 'proposed', confirmar: { token: 'tk', texto: 'Activar «Reseñas» — gasta hasta 10,00 US$ al día', cifras: { dia: 10, semana: 70 }, vence } }] };
  const h = plano(opsHTML(m, { esc, now: Date.now() }));
  assert.match(h, /class="so-gasto" data-msg="m1" data-k="1">Sí, activar — hasta 10,00 US\$ al día</); assert.match(h, /gasta hasta 10,00 US\$ al día/);
  assert.match(h, /HACER \(1\)/, 'HACER solo cuenta lo que baja el gasto');
  assert.deepEqual(opsBody('m1', m.ops).items.map(i => i.k), [0], 'el op de gasto nunca va por HACER');
  assert.doesNotMatch(plano(opsHTML({ ...m, ops: [{ ...m.ops[1], confirmar: { ...m.ops[1].confirmar, vence: Date.now() - 1 } }] }, { esc, now: Date.now() })), /class="so-gasto"/, 'vencida: sin botón');
  assert.equal(plano(gastoBoton(m.ops[1])), 'Sí, activar — hasta 10,00 US$ al día');
  assert.deepEqual(gastoBody(m.ops[1]), { tipo: 'activar', id: 'c4', confirmacion: 'tk' });
  assert.deepEqual(gastoBody({ type: 'anuncio_subir_presupuesto', id: 's', valor: 8, confirmar: { token: 't2' } }, { valor: '9,5' }), { tipo: 'subir_presupuesto', id: 's', valor: 9.5, confirmacion: 't2' });
  assert.deepEqual(gastoHecho(m.ops[1], true, { ok: true, hecho: { texto: 'Activaste «Reseñas».' } }), { state: 'done', confirmar: null, desc: 'Activaste «Reseñas».', error: '' });
  assert.equal(gastoHecho(m.ops[1], false, { error: 'tope', motivo: 'no cabe' }).state, 'failed');
  assert.equal(gastoHecho(m.ops[1], false, { error: 'confirmacion', motivo: 'venció' }).confirmar.vence, 0, 'vencida: la tarjeta lo dice');
});
