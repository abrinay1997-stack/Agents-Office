// Fase A1 (9 oct 2026): la vista Anuncios — lo puro (dinero siempre con su moneda, %, «—» cuando no se sabe, tendencias, topes, estados
// en palabras), filtrar y ordenar campañas, aplanar campaña → conjunto → anuncio, el HTML (un botón nunca dentro de otro; nada que
// cambie Meta), los datos de ejemplo y el paquete aparte (su línea de versión; la página no lo lleva dentro).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dinero, pct, num, frec, tendencia, contraTope, estadoDe, aprendizajeDe, tieneProblemas, haceCuanto, fechaCorta, resultados, presupuesto, SIN } from '../src/anuncios/comun.js';
import { filtrar, ordenar, aplanar, buscar, campanasHTML } from '../src/anuncios/campanas.js';
import { resumenHTML, avisosHTML } from '../src/anuncios/resumen.js';
import { detalleHTML } from '../src/anuncios/detalle.js';
import { historialHTML } from '../src/anuncios/historial.js';
import { datosDeEjemplo } from '../src/anuncios/demo.js';
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
  assert.deepEqual(filtrar(c, 'pausa').map(x => x.id), ['ej-c-3']);
  assert.deepEqual(filtrar(c, 'problemas').map(x => x.id).sort(), ['ej-c-1', 'ej-c-2']);
  assert.equal(filtrar(c, 'todas').length, 3);
  const l = [{ id: 'a', nombre: 'B', cifras: { gasto: 5, costoPorResultado: 2 } }, { id: 'b', nombre: 'A', cifras: { gasto: null, costoPorResultado: null } }, { id: 'c', nombre: 'C', cifras: { gasto: 9, costoPorResultado: 1 } }];
  assert.deepEqual(ordenar(l, 'gasto').map(x => x.id), ['c', 'a', 'b']);
  assert.deepEqual(ordenar(l, 'costo').map(x => x.id), ['c', 'a', 'b'], 'el costo, de menor a mayor; sin dato, al final');
  assert.deepEqual(ordenar(l, 'nombre').map(x => x.id), ['b', 'a', 'c']);
  const o = ordenar(c, 'gasto'); assert.ok(o[0].conjuntos[0].anuncios.length, 'por dentro también'); assert.ok((o[0].conjuntos[0].anuncios[0].cifras.gasto ?? -1) >= (o[0].conjuntos[0].anuncios.at(-1).cifras.gasto ?? -1));
});

test('aplanar: campaña → conjunto → anuncio, solo lo desplegado; buscar da los padres', () => {
  const c = datosDeEjemplo('7d').campanas;
  assert.deepEqual(aplanar(c).map(f => f.nivel), ['campana', 'campana', 'campana']);
  const f = aplanar(c, new Set(['ej-c-1', 'ej-as-1']));
  assert.deepEqual(f.map(x => `${x.nivel}:${x.id}`), ['campana:ej-c-1', 'conjunto:ej-as-1', 'anuncio:ej-ad-11', 'anuncio:ej-ad-12', 'campana:ej-c-2', 'campana:ej-c-3']);
  assert.equal(f[0].abierto, true); assert.equal(f[0].hijos, 1); assert.equal(f[4].abierto, false);
  assert.deepEqual(aplanar(c, new Set(['ej-as-1'])).length, 3, 'un conjunto abierto dentro de una campaña cerrada no aparece');
  const b = buscar(c, 'ej-ad-12'); assert.equal(b.nivel, 'anuncio'); assert.equal(b.campana.id, 'ej-c-1'); assert.equal(b.conjunto.id, 'ej-as-1');
  assert.equal(buscar(c, 'nada'), null);
});

test('el HTML: el nombre es el botón; nunca un botón dentro de otro; nada que cambie Meta; la moneda junto a cada cifra', () => {
  const d = datosDeEjemplo('7d'), abiertos = new Set(['ej-c-1', 'ej-as-1', 'ej-c-2', 'ej-as-2']);
  const h = campanasHTML(d, { abiertos, sel: 'ej-ad-12' });
  assert.match(h, /<button type="button" class="anu-abrir" data-abrir="ej-c-1">Mensajes por WhatsApp — Combo lentes<\/button>/);
  assert.match(h, /data-tog="ej-c-1" aria-expanded="true"/); assert.match(h, /class="anu-fila n-anuncio sel" data-fila="ej-ad-12"/);
  assert.match(h, /creado fuera/); assert.match(h, /Rechazado/); assert.match(h, /Aprendiendo: 18 de 50/); assert.match(h, /Fuera del aprendizaje/);
  for (const x of [h, resumenHTML(d), detalleHTML(buscar(d.campanas, 'ej-ad-12'), { moneda: 'USD' })]) {
    assert.doesNotMatch(x, /<button[^>]*>(?:(?!<\/button>).)*<button/s, 'un botón nunca dentro de otro');
    assert.doesNotMatch(x, /data-a="(pausar|activar|reanudar|presupuesto|archivar|borrar|publicar)"/, 'A1 solo mira');
  }
  const dineros = [...plano(h).matchAll(/data-l="(?:Presupuesto|Gasto|Costo por resultado)"[^>]*>([^<]*)</g)].map(m => m[1]).filter(x => x !== SIN);
  assert.ok(dineros.length > 6 && dineros.every(x => /US\$/.test(x)), 'cada importe lleva su moneda: ' + dineros.join(' | '));
  const det = detalleHTML(buscar(d.campanas, 'ej-ad-12'), { moneda: 'USD' });
  assert.match(det, /condición personal/); assert.match(det, /<img src="data:image\/svg\+xml/); assert.match(det, /Enviar mensaje/);
  assert.match(campanasHTML({ ...d, campanas: [] }), /No hay campañas en esta cuenta/);
  assert.match(campanasHTML(d, { filtro: 'pausa' }), /ej-c-3/); assert.doesNotMatch(campanasHTML(d, { filtro: 'pausa' }), /data-abrir="ej-c-1"/);
});

test('el resumen: avisos ordenados, cuatro cifras contra los topes, la tarjeta de conexión sin Meta', () => {
  const d = datosDeEjemplo('7d'), h = plano(resumenHTML(d));
  assert.match(h, /Gasto de hoy/); assert.match(h, /del tope diario de 15,00 US\$/); assert.match(h, /Gasto del mes/); assert.match(h, /Resultados · 7 días/); assert.match(h, /Costo por resultado · 7 días/);
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
