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

/* ---------------- Fase A3 ---------------- */
import { PASOS, OBJETIVOS, llamadasDe, pasoDe, costoTexto, avisoSinFin, deQuien, iframeMeta, poner, formatoDeMedidas, ajustarLlamadas, MEJORAS_DEF, LLAMADA } from '../src/anuncios/borrador.js';
import { crearDemoBorradores, validarBorrador, borradorPorDefecto, costoMaxDe, diasDe } from '../src/anuncios/demo-borradores.js';
import { listaBorradoresHTML } from '../src/anuncios/borradores.js';
import { asistenteHTML, problemasPorPaso, problemasPorCampo, pasoRevisionHTML, pasoCreativosHTML, cuentaTexto } from '../src/anuncios/asistente.js';
import { previaHTML, cortar } from '../src/anuncios/vista-previa.js';

test('A3 · los cinco pasos en su orden; cada objetivo con sus llamadas a la acción (la primera, la de por defecto)', () => {
  assert.deepEqual(PASOS.map(p => p.k), ['objetivo', 'publico', 'presupuesto', 'creativos', 'revision']);
  assert.deepEqual(OBJETIVOS.map(o => o.k), ['mensajes', 'web', 'ventas', 'contactos', 'conocer']);
  assert.equal(llamadasDe('mensajes', 'whatsapp')[0], 'WHATSAPP_MESSAGE');
  assert.equal(llamadasDe('mensajes', 'instagram')[0], 'INSTAGRAM_MESSAGE'); assert.ok(!llamadasDe('mensajes', 'instagram').includes('WHATSAPP_MESSAGE'), 'WhatsApp solo si te escriben por WhatsApp');
  assert.equal(llamadasDe('mensajes', 'messenger')[0], 'MESSAGE_PAGE');
  assert.equal(llamadasDe('ventas')[0], 'SHOP_NOW'); assert.equal(llamadasDe('web')[0], 'LEARN_MORE'); assert.equal(llamadasDe('contactos')[0], 'SIGN_UP');
  assert.ok(llamadasDe('conocer').includes('NO_BUTTON')); assert.ok(!llamadasDe('web').includes('WHATSAPP_MESSAGE'));
  for (const o of OBJETIVOS) for (const k of llamadasDe(o.k, 'whatsapp')) assert.ok(LLAMADA[k], `${k} tiene su nombre en español`);
  const b = ajustarLlamadas({ objetivo: 'ventas', destino: null, creativos: [{ llamada: 'WHATSAPP_MESSAGE' }, { llamada: 'BUY_NOW' }] });
  assert.deepEqual(b.creativos.map(c => c.llamada), ['SHOP_NOW', 'BUY_NOW'], 'al cambiar de objetivo, la llamada que ya no vale pasa a la primera');
  assert.deepEqual(MEJORAS_DEF, { texto: false, retoques: true, recorte: true, plantilla: false }, '§12: solo las que no tocan el texto');
  assert.equal(formatoDeMedidas(1080, 1080), '1:1'); assert.equal(formatoDeMedidas(1080, 1350), '4:5'); assert.equal(formatoDeMedidas(1080, 1920), '9:16'); assert.equal(formatoDeMedidas(1920, 1080), '');
});

test('A3 · cada problema lleva a su paso y a su campo (también los nombres de Meta); lo desconocido, a la Revisión', () => {
  assert.deepEqual(pasoDe('objetivo'), { paso: 0, k: 'objetivo', campo: 'objetivo' });
  assert.equal(pasoDe('enlace').paso, 0); assert.equal(pasoDe('destino').paso, 0); assert.equal(pasoDe('nombre').campo, 'nombre');
  assert.deepEqual(pasoDe('publico.edadMin'), { paso: 1, k: 'publico', campo: 'publico.edadMin' }); assert.equal(pasoDe('categoriaEspecial').paso, 1);
  assert.deepEqual(pasoDe('presupuesto'), { paso: 2, k: 'presupuesto', campo: 'presupuesto.usd' }); assert.equal(pasoDe('fin').paso, 2); assert.equal(pasoDe('inicio').campo, 'inicio');
  assert.deepEqual(pasoDe('creativos[2].texto'), { paso: 3, k: 'creativos', campo: 'creativos.2.texto' }); assert.equal(pasoDe('creativos.0.llamada').paso, 3); assert.equal(pasoDe('mejoras.texto').paso, 3);
  assert.equal(pasoDe('daily_budget').paso, 2); assert.equal(pasoDe('targeting').paso, 1); assert.equal(pasoDe('call_to_action').paso, 3); assert.equal(pasoDe('promoted_object').paso, 0);
  assert.equal(pasoDe('daily_budget').campo, null, 'un campo de Meta lleva al paso, no a un campo de la página');
  assert.deepEqual(pasoDe('algo_raro'), { paso: 4, k: 'revision', campo: null }); assert.equal(pasoDe('').paso, 4); assert.equal(pasoDe(null).paso, 4);
});

test('A3 · el costo máximo en palabras, con la moneda; sin fin y diario, el aviso de que no se podrá activar', () => {
  assert.equal(plano(costoTexto({ dia: 5, total: 70, campana: 70 }, 'USD')), 'hasta 5,00 US$ al día · 70,00 US$ en total · tope de la campaña 70,00 US$');
  assert.equal(plano(costoTexto({ dia: null, total: 120, campana: 120 })), 'hasta 120,00 US$ en total · tope de la campaña 120,00 US$');
  assert.match(plano(costoTexto({ dia: 5, total: null, campana: 150 })), /^hasta 5,00 US\$ al día · sin fecha de fin, el total no tiene límite · tope de la campaña 150,00 US\$$/);
  assert.equal(costoTexto(null), '');
  assert.match(avisoSinFin({ presupuesto: { tipo: 'diario', usd: 5 }, fin: null }), /no cabe en tu tope por campaña: podrás crearla en pausa, pero no activarla/);
  assert.equal(avisoSinFin({ presupuesto: { tipo: 'diario', usd: 5 }, fin: '2026-10-20' }), ''); assert.equal(avisoSinFin({ presupuesto: { tipo: 'total', usd: 5 }, fin: null }), '');
  assert.equal(diasDe('2026-10-09', '2026-10-22'), 14); assert.equal(diasDe('2026-10-09', null), null);
  assert.deepEqual(costoMaxDe({ presupuesto: { tipo: 'diario', usd: 5 }, inicio: '2026-10-09', fin: '2026-10-22' }, { campana: 150 }), { dia: 5, total: 70, campana: 70 });
  assert.deepEqual(costoMaxDe({ presupuesto: { tipo: 'diario', usd: 5 }, inicio: '2026-10-09', fin: null }, { campana: 150 }), { dia: 5, total: null, campana: 150 }, 'sin fin: el spend_cap sale del tope');
});

test('A3 · de quién viene; cambiar un campo por su ruta no toca el original; la vista previa de Meta: solo su iframe de facebook.com', () => {
  assert.equal(deQuien('dueno'), 'Tú'); assert.equal(deQuien('dimitri'), 'Dimitri'); assert.equal(deQuien('agente:ada', id => (id === 'ada' ? 'Anuncios' : id)), 'ANUNCIOS (agente)');
  const b = { publico: { edadMin: 18 }, creativos: [{ texto: 'a' }] }, r = poner(b, 'creativos.0.texto', 'b');
  assert.equal(r.b.creativos[0].texto, 'b'); assert.equal(b.creativos[0].texto, 'a'); assert.equal(r.raiz, 'creativos');
  assert.equal(poner(b, 'publico.edadMax', 40).b.publico.edadMax, 40);
  const ok = 'https://www.facebook.com/ads/api/preview_iframe.php?d=AQ&t=AQ';
  assert.equal(iframeMeta(`<iframe src="${ok.replace(/&/g, '&amp;')}" width="335" height="450" scrolling="yes" style="border: none;"></iframe>`), ok);
  assert.equal(iframeMeta('<iframe src="https://evil.example/ads/api/preview_iframe.php"></iframe>'), null, 'otro dominio, no');
  assert.equal(iframeMeta('<iframe src="javascript:alert(1)"></iframe>'), null); assert.equal(iframeMeta('<iframe src="http://www.facebook.com/ads/api/preview_iframe.php"></iframe>'), null, 'sin https, no');
  assert.equal(iframeMeta('<script>alert(1)</script>'), null); assert.equal(iframeMeta('<iframe src="https://www.facebook.com/otra/cosa"></iframe>'), null);
});

test('A3 · la demo valida con problemas reales, crea EN PAUSA (y aparece en Campañas) y mejora con una propuesta', () => {
  let t = Date.parse('2026-10-09T10:00:00'); const ahora = () => t;
  const demo = crearDemo({ ahora }), B = crearDemoBorradores({ demo, ahora, topes: demo.topes, tardaMs: 1000 });
  const l = B.lista().items; assert.ok(l.some(b => b.de === 'dimitri') && l.some(b => b.de.startsWith('agente:')) && l.some(b => b.estado === 'creado' && b.meta?.campana === 'ej-c-4'), 'de Dimitri, de un agente y uno ya creado');
  const nb = B.crear({}).borrador;
  assert.equal(nb.objetivo, 'mensajes'); assert.equal(nb.destino, 'whatsapp'); assert.deepEqual(nb.publico.paises, ['PA']); assert.equal(nb.publico.modo, 'advantage'); assert.equal(nb.publico.edadMin, 18); assert.equal(nb.categoriaEspecial, null); assert.equal(nb.estado, 'borrador');
  let v = B.validar(nb.id).borrador.validacion;
  assert.equal(v.ok, false); assert.ok(v.problemas.some(p => p.campo === 'creativos'), 'sin creativos no se crea');
  assert.ok(v.costoMax.dia === 5 && v.costoMax.total === 70, 'el costo máximo sale de la revisión');
  assert.equal(B.crearEnMeta(nb.id).status, 422, 'con problemas: 422, no crea');
  B.cambiar(nb.id, { presupuesto: { tipo: 'diario', usd: 50 }, creativos: [{ id: 'c1', media: 'demo/anu-combo.jpg', formato: '1:1', texto: '', titular: '', descripcion: '', llamada: 'SHOP_NOW' }], publico: { ...nb.publico, edadMin: 16 } });
  v = B.validar(nb.id).borrador.validacion;
  const campos = v.problemas.map(p => p.campo);
  for (const c of ['presupuesto.usd', 'publico.edadMin', 'creativos.0.texto']) assert.ok(campos.includes(c), c);
  assert.ok(v.problemas.some(p => /pasa tu tope diario de 30,00/.test(plano(p.texto))), 'el tope diario, con su cifra');
  assert.ok(!campos.includes('creativos.0.llamada'), '«Comprar» vale para mensajes por WhatsApp');
  B.cambiar(nb.id, { presupuesto: { tipo: 'diario', usd: 5 }, publico: { ...nb.publico }, creativos: [{ id: 'c1', media: 'demo/anu-combo.jpg', formato: '1:1', texto: 'Lentes listos en 1 día.', titular: '', descripcion: '', llamada: 'WHATSAPP_MESSAGE' }] });
  const m = B.mejorar(nb.id, { creativo: 'c1', campo: 'texto' });
  assert.equal(m.status, 200); assert.match(m.texto, /WhatsApp/); assert.ok(m.porque && m.agente);
  assert.equal(B.lista().items.find(b => b.id === nb.id).creativos[0].texto, 'Lentes listos en 1 día.', 'mejorar no cambia nada solo');
  v = B.validar(nb.id).borrador.validacion; assert.equal(v.ok, true, JSON.stringify(v.problemas));
  assert.equal(B.crearEnMeta(nb.id).status, 202);
  assert.equal(B.lista().items.find(b => b.id === nb.id).estado, 'creando');
  assert.equal(B.cambiar(nb.id, { nombre: 'x' }).status, 409, 'mientras se crea no se cambia');
  t += 1500;
  const creado = B.lista().items.find(b => b.id === nb.id);
  assert.equal(creado.estado, 'creado'); assert.ok(creado.meta.campana);
  const c = demo.vista('7d').campanas.find(x => x.id === creado.meta.campana);
  assert.ok(c, 'aparece en Campañas'); assert.equal(c.estado, 'PAUSED'); assert.equal(c.conjuntos[0].anuncios.length, 1); assert.equal(c.conjuntos[0].anuncios[0].estado, 'CAMPAIGN_PAUSED');
  assert.ok(accionesDe({ nivel: 'campana', id: c.id, nodo: c, campana: c }).some(a => a.tipo === 'activar'), 'activarla es la A2 (dos clics)');
  assert.ok(demo.historial().items[0].que === 'creó en pausa la campaña' && demo.historial().items[0].objeto.id === c.id);
  assert.equal(B.cambiar(nb.id, { nombre: 'otro' }).status, 409, 'ya creado: los cambios, desde Campañas');
  assert.equal(B.crearEnMeta(nb.id).status, 409, 'nunca dos veces');
  assert.equal(B.vistaPrevia(nb.id).status, 409, 'la de Meta, solo con la oficina');
  const f = crearDemoBorradores({ demo, ahora, topes: demo.topes, tardaMs: 10, fallarCrear: 1 }), x = f.crear({ creativos: [{ id: 'k', media: 'demo/anu-combo.jpg', texto: 'Hola', llamada: 'WHATSAPP_MESSAGE' }] }).borrador;
  f.crearEnMeta(x.id); t += 50; const fx = f.lista().items.find(b => b.id === x.id);
  assert.equal(fx.estado, 'fallo'); assert.match(fx.error, /en palabras|demasiado pequeña/); assert.equal(f.crearEnMeta(x.id).status, 202, 'tras un fallo, se reintenta');
  assert.equal(B.borrar(nb.id).status, 200); assert.ok(!B.lista().items.some(b => b.id === nb.id));
});

test('A3 · la validación de la demo: enlace, categoría especial, total sin fin, una llamada que no vale', () => {
  const t = Date.parse('2026-10-09T10:00:00'), cr = [{ id: 'c', media: 'demo/anu-combo.jpg', texto: 'x', llamada: 'WHATSAPP_MESSAGE' }];
  const base = borradorPorDefecto(t, { creativos: cr }), val = o => validarBorrador({ ...base, ...o }, { topes: { diario: 30, campana: 400 }, ahora: t }).problemas.map(p => p.campo);
  assert.deepEqual(val({}), []);
  assert.ok(val({ objetivo: 'web', destino: null, creativos: [{ ...cr[0], llamada: 'LEARN_MORE' }] }).includes('enlace'));
  assert.ok(val({ objetivo: 'web', destino: null, enlace: 'panaclaw.com', creativos: [{ ...cr[0], llamada: 'LEARN_MORE' }] }).includes('enlace'));
  assert.ok(val({ objetivo: 'web', destino: null, enlace: 'https://panaclaw.com', creativos: cr }).includes('creativos.0.llamada'), 'WhatsApp no vale para visitas a la web');
  assert.ok(val({ categoriaEspecial: 'HOUSING', publico: { ...base.publico, edadMin: 25 } }).includes('publico.edadMin'));
  assert.ok(val({ presupuesto: { tipo: 'total', usd: 100 }, fin: null }).includes('fin'));
  assert.ok(val({ inicio: '2026-10-01' }).includes('inicio'));
  assert.ok(val({ objetivo: 'ventas', destino: null, enlace: 'https://x.com/a', creativos: [{ ...cr[0], llamada: 'SHOP_NOW' }] }).includes('objetivo'), 'ventas sin píxel lo dice');
});

test('A3 · el HTML: la lista dice de quién y su costo; el asistente marca el paso, los problemas por paso y nunca anida botones', () => {
  let t = Date.parse('2026-10-09T10:00:00');
  const demo = crearDemo({ ahora: () => t }), B = crearDemoBorradores({ demo, ahora: () => t, topes: demo.topes }), items = B.lista().items;
  const h = plano(listaBorradoresHTML(items, { agentName: id => (id === 'ada' ? 'Anuncios' : id), ahora: t }));
  assert.match(h, /data-a="nueva">\+ Nueva campaña/); assert.match(h, /De: Dimitri/); assert.match(h, /De: ANUNCIOS \(agente\)/); assert.match(h, /Creado en pausa/);
  assert.match(h, /data-vercamp="ej-c-4"/); assert.match(h, /Costo máximo: hasta 10,00 US\$ al día/); assert.match(h, /Costo máximo: se calcula al revisarlo/);
  assert.match(plano(listaBorradoresHTML(items, { confirmar: 'ej-b-1' })), /¿Borrar «Examen de la vista — octubre»\?.*data-bborrar-si="ej-b-1"/);
  assert.match(listaBorradoresHTML([]), /Todavía no hay borradores/);
  const nb = B.crear({}).borrador, v = B.validar(nb.id).borrador;
  const a = asistenteHTML(v, 0, {});
  assert.match(a, /data-paso="0" aria-current="step"/); assert.match(a, /Paso 1 de 5/); assert.match(a, /Siguiente: Público/); assert.match(a, /data-bnav="-1" aria-disabled="true"/);
  assert.match(a, /value="mensajes" checked/); assert.match(a, /WhatsApp/);
  assert.deepEqual(problemasPorPaso(v), [0, 0, 0, 1, 0]); assert.match(asistenteHTML(v, 0, {}), /1 por arreglar/);
  for (const p of [0, 1, 2, 3, 4]) { const x = asistenteHTML(v, p, { moneda: 'USD' }); assert.doesNotMatch(x, /<button[^>]*>(?:(?!<\/button>).)*<button/s, `paso ${p}: un botón dentro de otro`); }
  assert.match(asistenteHTML(v, 1, {}), /Advantage\+: Meta busca a quién mostrarlo/); assert.match(asistenteHTML(v, 1, {}), /value="" checked><span><b>Ninguna/);
  assert.match(plano(asistenteHTML(v, 2, { moneda: 'USD' })), /Costo máximo: <b>hasta 5,00 US\$ al día · 70,00 US\$ en total/);
  assert.match(asistenteHTML({ ...v, fin: null }, 2, {}), /no cabe en tu tope por campaña/);
  const c4 = pasoCreativosHTML({ ...v, creativos: [{ id: 'c1', media: 'demo/anu-combo.jpg', formato: '1:1', texto: 'Hola', titular: '', llamada: 'WHATSAPP_MESSAGE' }] }, {}, { estudio: true, mejora: { cr: 'c1', campo: 'texto', estado: 'lista', texto: 'Propuesta <b>', porque: 'Porque sí', agente: 'ANUNCIOS' } });
  assert.match(c4, /data-bestudio>Crear con el Estudio/); assert.match(c4, /Propuesta de <b>ANUNCIOS<\/b>/); assert.match(c4, /Propuesta &lt;b&gt;/, 'la propuesta va escapada'); assert.match(c4, /data-busar="0" data-campo="texto">Usar/);
  assert.match(c4, /role="switch"[^>]*aria-checked="false" data-bmejora="texto"/); assert.match(c4, /Mejorar el texto<\/b> · Apagada/); assert.match(c4, /Retoques de imagen<\/b> · Encendida/);
  assert.doesNotMatch(pasoCreativosHTML(v, {}, { estudio: false }), /data-bestudio/, 'sin Estudio a mano, no se ofrece');
  const r5 = pasoRevisionHTML(v, {}); assert.match(r5, /data-bir="0"/); assert.match(r5, /Paso 4 · Creativos/); assert.match(r5, /data-bcrear aria-disabled="true"/);
  assert.match(pasoRevisionHTML({ ...v, estado: 'creado', meta: { campana: 'ej-c-9' } }, {}), /Creado en pausa\.<\/b><span>Actívalo desde Campañas cuando quieras \(te pedirá los dos clics/);
  assert.match(pasoRevisionHTML({ ...v, estado: 'creando' }, {}), /Creando en Meta…/);
  assert.match(pasoRevisionHTML(v, { servida: true, metaPrev: { estado: 'lista', url: 'https://www.facebook.com/ads/api/preview_iframe.php?d=1' } }), /<iframe[^>]*sandbox="allow-scripts allow-same-origin allow-popups"/);
  assert.match(cuentaTexto('x'.repeat(130), 125), /Meta enseña 125 y pone «… Ver más»/);
  assert.deepEqual(problemasPorCampo({ validacion: { problemas: [{ campo: 'creativos[0].texto', texto: 'a' }, { campo: 'creativos.0.texto', texto: 'b' }] } }), { 'creativos.0.texto': 'a' });
});

test('A3 · la vista previa de la oficina: feed y historia, el texto cortado donde Meta pone «Ver más», todo escapado', () => {
  const cr = { formato: '4:5', texto: 'Hola <script>x</script> ' + 'palabra '.repeat(30), titular: 'Titular & más', descripcion: 'Desde 59', llamada: 'WHATSAPP_MESSAGE' };
  const f = previaHTML(cr, { src: '/media/a.jpg', pagina: 'PanaClaw', enlace: 'https://www.panaclaw.com/x' });
  assert.match(f, /aspect-ratio:4 \/ 5/); assert.match(f, /… Ver más/); assert.match(f, /Enviar WhatsApp/); assert.match(f, /PANACLAW\.COM/); assert.match(f, /Titular &amp; más/);
  assert.doesNotMatch(f, /<script>/); assert.ok(cortar(cr.texto).corto.length <= 125);
  const h = previaHTML({ ...cr, formato: '1:1' }, { ubicacion: 'historia', src: null });
  assert.match(h, /historias y reels/); assert.match(h, /Sin imagen todavía/); assert.match(h, /Este creativo es 1:1/);
  assert.match(previaHTML({ formato: '9:16', texto: '' }, {}), /Meta lo enseña recortado a 4:5/);
  assert.doesNotMatch(previaHTML({ llamada: 'NO_BUTTON', texto: 'a' }, {}), /anu-pv-cta/);
});

test('A3 · el paquete lleva el asistente y la página no; el Estudio sabe decir «para el anuncio»', async () => {
  const p = await construirAnuncios();
  for (const f of ['src/anuncios/asistente.js', 'src/anuncios/borradores.js', 'src/anuncios/borrador.js', 'src/anuncios/vista-previa.js', 'src/anuncios/demo-borradores.js']) assert.ok(p.aparte.includes(f), f);
  const page = 'dist/command-centre-v2.html';
  if (fs.existsSync(page)) { const html = fs.readFileSync(page, 'utf8'); assert.ok(!html.includes('anu-asis-pie') && !html.includes('Crear en Meta (en pausa)'), 'la página no lleva el asistente'); }
  const st = fs.readFileSync('src/studio.js', 'utf8');
  assert.match(st, /para === 'anuncio'/); assert.match(st, /Volver \$\{w\.a\}/);
  const main = fs.readFileSync('src/main.js', 'utf8'); assert.match(main, /studio\.forTarget\(\{ \.\.\.t, para: 'anuncio' \}/);
});

/* ---------------- Fase A5 ---------------- */
import { REGLA, informativa, botonAplicar, ordenarSugerencias, deEstado, topResumen, cambioTexto, sugerenciasHTML, resumenSugerenciasHTML, tarjetaSugHTML } from '../src/anuncios/sugerencias.js';
import { estadoCreativo, creativosConEstado, agruparCreativos, sumar, caidaCtr, sugerenciaDe, creativosHTML, borradorDeCreativo, cpaDe, UMBRALES_DEF, normalizarUmbrales } from '../src/anuncios/creativos.js';
import { sugerenciasDeEjemplo, crearDemoSugerencias } from '../src/anuncios/demo-sugerencias.js';

const sg = (id, x = {}) => ({ id, regla: 'cortar', objeto: { id: 'a', nivel: 'anuncio', nombre: 'A' }, dato: 'd', porque: 'p', cambio: { tipo: 'pausar', id: 'a' }, efecto: 'e', riesgo: {}, prioridad: 2, gasto: false, estado: 'viva', creadaAt: '2026-10-09T10:00:00Z', ...x });

test('A5 · el botón de aplicar dice si gasta; lo informativo no tiene; «revisar» solo abre', () => {
  assert.deepEqual(botonAplicar(sg('1')), { texto: 'Aplicar', gasta: false, abre: false });
  assert.equal(botonAplicar(sg('2', { regla: 'escalar', gasto: true, cambio: { tipo: 'subir_presupuesto', id: 'x', valor: 9 } })).texto, 'Aplicar — pide tus dos clics');
  assert.equal(botonAplicar(sg('3', { cambio: { tipo: 'activar', id: 'x' } })).gasta, true, 'aunque el servidor no lo marque, activar gasta');
  assert.equal(botonAplicar(sg('4', { riesgo: { gastaMas: true } })).gasta, true);
  assert.equal(botonAplicar(sg('5', { regla: 'aprendizaje', cambio: { tipo: 'revisar', id: 'x' } })), null, '«aprendiendo, no tocar» no tiene «Aplicar»');
  assert.ok(informativa(sg('6', { regla: 'esperar' }))); assert.ok(informativa(sg('7', { cambio: null })));
  assert.deepEqual(botonAplicar(sg('8', { regla: 'problemas', cambio: { tipo: 'revisar', id: 'x' } })), { texto: 'Ver qué pasa', gasta: false, abre: true });
  assert.match(botonAplicar(sg('9', { cambio: { tipo: 'borrador', id: 'x' } })).texto, /deja un borrador/);
  assert.match(botonAplicar(sg('10', { cambio: { tipo: 'creativos', id: 'x' } })).texto, /variaciones/);
  assert.equal(botonAplicar(sg('11', { estado: 'aplicada' })), null, 'una ya aplicada no se vuelve a aplicar');
  for (const r of ['aprendizaje', 'limitado', 'esperar', 'cortar', 'fatiga', 'escalar', 'estructura', 'rechazado', 'problemas', 'cuenta', 'impulsar']) assert.ok(REGLA[r], r);
});

test('A5 · el orden: prioridad, lo aplicable antes que lo informativo, lo nuevo antes; las 3 del Resumen', () => {
  const l = [sg('c', { prioridad: 3 }), sg('i', { prioridad: 1, regla: 'aprendizaje', cambio: { tipo: 'revisar', id: 'x' } }), sg('a', { prioridad: 1 }), sg('b', { prioridad: 2, creadaAt: '2026-10-09T12:00:00Z' }), sg('b0', { prioridad: 2 }), sg('d', { estado: 'descartada', prioridad: 1 }), sg('p', { estado: 'pospuesta', prioridad: 1 })];
  assert.deepEqual(ordenarSugerencias(l.filter(s => s.estado === 'viva')).map(s => s.id), ['a', 'i', 'b', 'b0', 'c']);
  assert.deepEqual(deEstado(l, 'viva').map(s => s.id), ['a', 'i', 'b', 'b0', 'c'], 'las vivas no traen las pospuestas ni las descartadas');
  assert.deepEqual(topResumen(l).map(s => s.id), ['a', 'b', 'b0'], 'en el Resumen, lo informativo solo si no llegan tres');
  assert.deepEqual(topResumen([l[1], l[2]]).map(s => s.id), ['a', 'i']);
  assert.deepEqual(topResumen([]), []);
  const ej = sugerenciasDeEjemplo();
  assert.ok(topResumen(ej).every(s => s.estado === 'viva' && !informativa(s)) && topResumen(ej).length === 3);
});

test('A5 · el cambio exacto en palabras, con la moneda y el porcentaje', () => {
  const d = datosDeEjemplo('7d'), f = buscar(d.campanas, 'ej-as-2');
  const t = plano(cambioTexto(sg('e', { regla: 'escalar', objeto: { id: 'ej-as-2', nivel: 'conjunto', nombre: 'Ciudad' }, cambio: { tipo: 'subir_presupuesto', id: 'ej-as-2', valor: 8.4 } }), { moneda: 'USD', f }));
  assert.match(t, /Subir el presupuesto de «Ciudad» de 7,00 US\$ al día a 8,40 US\$ al día \(\+20 %\)/);
  assert.match(cambioTexto(sg('p')), /Pausar «A»\. Baja el gasto/);
  assert.match(cambioTexto(sg('b', { cambio: { tipo: 'borrador', id: 'a' } })), /No se crea nada en Meta/);
});

test('A5 · el HTML de las sugerencias: dato, porqué, cambio, efecto y riesgo; el objeto abre su detalle; nunca un botón dentro de otro', () => {
  const d = datosDeEjemplo('7d'), r = { items: sugerenciasDeEjemplo(), cpaObjetivo: 2, sinObjetivo: null }, bf = id => buscar(d.campanas, id);
  const h = sugerenciasHTML(r, { buscarFila: bf });
  for (const k of ['El dato', 'Por qué', 'El cambio', 'Qué se espera', 'El riesgo']) assert.ok(h.includes(k), k);
  assert.match(h, /data-sobj="ej-ad-23"/); assert.match(h, /gasta más: pide tus dos clics/); assert.match(h, />Aplicar — pide tus dos clics</);
  assert.match(h, /Recordármelo en 3 días/); assert.match(h, /Para saber/); assert.doesNotMatch(h, /data-sapl="ej-s-1"/, 'la informativa no se aplica');
  assert.doesNotMatch(h, /ej-s-7|ej-s-8/, 'en Vivas no salen la aplicada ni la descartada');
  assert.match(plano(h), /Vivas <b class="anu-cuenta">6<\/b>/);
  const ap = sugerenciasHTML(r, { filtro: 'aplicada', buscarFila: bf });
  assert.match(ap, /Qué pasó después/); assert.match(plano(ap), /11,90 US\$ menos/); assert.match(ap, /Aplicada/); assert.doesNotMatch(ap, /data-sapl/);
  assert.match(sugerenciasHTML(r, { filtro: 'descartada', buscarFila: bf }), /Descartada: no vuelve en 7 días/);
  assert.match(sugerenciasHTML({ ...r, sinObjetivo: 'No me dijiste qué costo por resultado te parece bueno.' }), /Costo por resultado que te parece bueno[\s\S]*data-a="ajustes"/);
  assert.match(sugerenciasHTML(null, { error: 'la oficina no contestó' }), /data-a="recargar-s"/);
  for (const x of [h, ap, resumenSugerenciasHTML(r, { buscarFila: bf })]) assert.doesNotMatch(x, /<button[^>]*>(?:(?!<\/button>).)*<button/s, 'un botón nunca dentro de otro');
  assert.doesNotMatch(tarjetaSugHTML(sg('x', { objeto: { id: 'nada', nombre: '<b>x</b>' } })), /<b>x<\/b>/, 'escapado');
  const rs = resumenSugerenciasHTML(r, { buscarFila: bf });
  assert.equal((rs.match(/data-sug=/g) || []).length, 3); assert.match(rs, /data-ir="sugerencias">Ver todas/);
  assert.match(resumenHTML(d, { sug: r }), /anuSugR/); assert.doesNotMatch(resumenHTML(d), /anuSugR/, 'sin respuesta del servidor, no hay bloque');
});

test('A5 · el estado de cada creativo: funciona, se está cansando, sin datos (y gasta sin resultados)', () => {
  const g = (c, serie) => ({ anuncios: [{ id: 'a', cifras: c, serie }] });
  assert.equal(estadoCreativo(g({ gasto: 1, impresiones: 5000 }), { cpa: 2 }).codigo, 'sin-datos', 'poco gasto');
  assert.equal(estadoCreativo(g({ gasto: 30, impresiones: 400 }), { cpa: 2 }).codigo, 'sin-datos', 'pocas impresiones');
  assert.equal(estadoCreativo(g({ gasto: 30, impresiones: 9000, clics: 90, resultados: 20, frecuencia: 1.5 }), { cpa: 2 }).codigo, 'funciona');
  assert.equal(estadoCreativo(g({ gasto: 30, impresiones: 9000, clics: 90, resultados: 20, frecuencia: 3.5 }), { cpa: 2 }).codigo, 'cansando', 'sin serie, solo la frecuencia');
  const serie = (a, b) => [...Array(3).fill({ impresiones: 1000, clics: a }), ...Array(3).fill({ impresiones: 1000, clics: b })];
  assert.equal(estadoCreativo(g({ gasto: 30, impresiones: 9000, clics: 90, resultados: 20, frecuencia: 3.5 }, serie(20, 19)), { cpa: 2 }).codigo, 'funciona', 'con serie y el CTR estable no se cansa');
  assert.equal(estadoCreativo(g({ gasto: 30, impresiones: 9000, clics: 90, resultados: 20, frecuencia: 3.5 }, serie(20, 12)), { cpa: 2 }).codigo, 'cansando', 'frecuencia y CTR cayendo un 40 %');
  assert.equal(caidaCtr([{ serie: serie(20, 12) }]), 40);
  assert.equal(estadoCreativo(g({ gasto: 9, impresiones: 4000, clics: 0, resultados: 0, frecuencia: 1.2 }), { cpa: 2 }).codigo, 'sin-resultados');
  assert.equal(estadoCreativo(g({ gasto: 9, impresiones: 4000, clics: 80, resultados: 1, frecuencia: 1.2 }), { cpa: null }).codigo, 'funciona', 'sin objetivo, un CTR alto');
  assert.equal(estadoCreativo(g({ gasto: 9, impresiones: 4000, clics: 80, resultados: 1, frecuencia: 3.5 }), { umbrales: { frecuencia: 4 } }).codigo, 'funciona', 'los umbrales del servidor ganan');
  const nu = normalizarUmbrales({ fatigaFrecuencia: { valor: 3.5 }, fatigaCaidaCtr: { valor: 0.3 }, fatigaMinImpresiones: 500, esperarGastoCpa: { valor: 2 } });
  assert.equal(nu.frecuencia, 3.5); assert.equal(nu.caidaCtr, 30); assert.equal(nu.impresionesMin, 500); assert.equal(nu.gastoMinVeces, 2, 'los nombres de umbrales.json de la oficina también valen');
  assert.equal(estadoCreativo(g({ gasto: 3, impresiones: 5000, clics: 90, resultados: 2 }), { cpa: 2, umbrales: { esperarGastoCpa: { valor: 2 } } }).codigo, 'sin-datos');
  assert.equal(UMBRALES_DEF.frecuencia, 3); assert.equal(cpaDe({ OUTCOME_TRAFFIC: 0.5 }, { objetivo: 'OUTCOME_TRAFFIC' }), 0.5); assert.equal(cpaDe(null), null);
  const s = sumar([{ cifras: { gasto: 10, impresiones: 1000, clics: 10, resultados: 2, frecuencia: 2 } }, { cifras: { gasto: 5, impresiones: 3000, clics: 60, resultados: 3, frecuencia: 1.2 } }]);
  assert.equal(s.ctr, 1.75, 'el CTR se recalcula, no se promedia'); assert.equal(s.costoPorResultado, 3); assert.equal(s.frecuencia, 2);
});

test('A5 · Creativos con la demo: agrupados, cada uno con su estado, sus cifras con moneda; «Pedir variaciones» si hay sugerencia', () => {
  const d = datosDeEjemplo('7d'), sug = { items: sugerenciasDeEjemplo(), cpaObjetivo: 2 };
  const l = creativosConEstado(d.campanas, { cpaObjetivo: 2 }), por = id => l.find(g => g.anuncios.some(a => a.id === id)).estado.codigo;
  assert.equal(agruparCreativos(d.campanas).length, 7);
  assert.equal(por('ej-ad-21'), 'cansando'); assert.equal(por('ej-ad-11'), 'funciona'); assert.equal(por('ej-ad-41'), 'sin-datos'); assert.equal(por('ej-ad-23'), 'sin-resultados');
  assert.equal(sugerenciaDe(l.find(g => g.anuncios[0].id === 'ej-ad-21'), sug.items).id, 'ej-s-3');
  const h = plano(creativosHTML(d, sug, { rango: '7d' }));
  assert.match(h, /se está cansando/); assert.match(h, /funciona/); assert.match(h, /sin datos/); assert.match(h, /data-crvar="ej-s-3"/); assert.match(h, /data-crnueva="ej-ad-11"/);
  assert.match(h, /Costo por resultado<\/dt><dd>1,43 US\$/); assert.doesNotMatch(h, /<button[^>]*>(?:(?!<\/button>).)*<button/s);
  assert.match(creativosHTML({ ...d, campanas: [] }, null), /Todavía no hay creativos con cifras/);
  const b = borradorDeCreativo(l.find(g => g.anuncios[0].id === 'ej-ad-11'), { ahora: 1 });
  assert.equal(b.objetivo, 'mensajes'); assert.equal(b.destino, 'whatsapp'); assert.equal(b.creativos[0].llamada, 'WHATSAPP_MESSAGE', '«Enviar mensaje» no vale para WhatsApp: la primera que vale');
  assert.match(b.creativos[0].texto, /WhatsApp/); assert.equal(b.creativos[0].media, null);
});

test('A5 · la demo aplica con las reglas del dinero: pausar con DESHACER, escalar pide el segundo clic con su cifra, borrador, variaciones, descartar y posponer', () => {
  let t = Date.parse('2026-10-09T15:00:00'); const ahora = () => t;
  const demo = crearDemo({ ahora }), demoB = crearDemoBorradores({ demo, ahora, topes: TOPES_DEMO }), S = crearDemoSugerencias({ demo, demoB, ahora });
  const viva = id => S.lista().items.find(s => s.id === id).estado;
  const p = S.aplicar('ej-s-2'); assert.ok(p.ok && p.deshacer?.token); assert.equal(viva('ej-s-2'), 'aplicada');
  assert.equal(buscar(demo.vista().campanas, 'ej-ad-23').nodo.estado, 'PAUSED');
  assert.ok(demo.deshacer({ token: p.deshacer.token }).ok); S.alDeshacer(p.deshacer.token); assert.equal(viva('ej-s-2'), 'viva', 'DESHACER la devuelve a viva');
  const e = S.aplicar('ej-s-4'); assert.ok(e.confirmar && !e.ok, 'lo que gasta NO se hace en el primer clic'); assert.equal(viva('ej-s-4'), 'viva');
  assert.match(plano(botonSi('subir_presupuesto', e.confirmar, 'USD')), /^Sí, subir — hasta 8,40 US\$ al día$/);
  assert.equal(buscar(demo.vista().campanas, 'ej-as-2').nodo.presupuesto.usd, 7);
  const si = demo.accion({ tipo: 'subir_presupuesto', id: 'ej-as-2', valor: 8.4, confirmacion: e.confirmar.token, sugerencia: 'ej-s-4' }); S.alConfirmar('ej-s-4', si);
  assert.ok(si.ok); assert.equal(buscar(demo.vista().campanas, 'ej-as-2').nodo.presupuesto.usd, 8.4); assert.equal(viva('ej-s-4'), 'aplicada');
  const b = S.aplicar('ej-s-5'); assert.ok(b.ok && b.borrador?.id); assert.ok(demoB.lista().items.some(x => x.id === b.borrador.id), 'deja el borrador');
  const v = S.aplicar('ej-s-3'); assert.ok(v.ok && v.tarea); assert.match(v.hecho.texto, /tarjeta de costo del Estudio/);
  assert.equal(S.aplicar('ej-s-1').status, 400, 'la informativa no se aplica'); assert.equal(S.aplicar('ej-s-2').status, 200, 'tras DESHACER se puede volver a aplicar');
  assert.equal(S.aplicar('ej-s-2').status, 409, 'dos veces no');
  assert.ok(S.descartar('ej-s-6').ok); assert.equal(viva('ej-s-6'), 'descartada');
  const S2 = crearDemoSugerencias({ demo, demoB, ahora }); assert.ok(S2.posponer('ej-s-6', 3).ok); assert.equal(S2.lista().items.find(s => s.id === 'ej-s-6').estado, 'pospuesta');
  t += 3 * 864e5 + 1000; assert.equal(S2.lista().items.find(s => s.id === 'ej-s-6').estado, 'viva', 'a los 3 días vuelve');
});

test('A5 · el paquete lleva Sugerencias y Creativos; la página no', async () => {
  const p = await construirAnuncios();
  for (const f of ['src/anuncios/sugerencias.js', 'src/anuncios/creativos.js', 'src/anuncios/demo-sugerencias.js']) assert.ok(p.aparte.includes(f), f);
  const page = 'dist/command-centre-v2.html';
  if (fs.existsSync(page)) { const html = fs.readFileSync(page, 'utf8'); assert.ok(!html.includes('anu-sug-dl') && !html.includes('Recordármelo en 3 días'), 'la página no lleva las sugerencias'); }
});
