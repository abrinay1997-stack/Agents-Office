// Los LOTES en la página (src/studio-lotes.js, docs/propuesta-banco-presets.md §6 y §7.4): lo puro — las cuentas y la frase
// del agente, qué botones tiene cada lote y cada foto, el anuncio al lector de pantalla (cada 10 % y cada fallo), los 3 pasos
// del alta y el pedido que manda, y el lote de mentira de la demo (que no gasta y responde a las rutas de §6.4). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/studio-lotes.js';

const fila = (n, estado, extra = {}) => ({ n, estado, src: `2026-10/f${n}.jpg`, intentos: 1, ...extra });
const lote = (estado, filas, extra = {}) => ({ id: 'L1', nombre: 'Camas', estado, filas, costo: { estimado: 1.56, gastado: 0.94 }, bitacora: [], ...extra });

test('las cuentas: por grupo, terminadas, %, dinero y minutos que faltan', () => {
  const filas = [fila(1, 'lista'), fila(2, 'revisar'), fila(3, 'fallo'), fila(4, 'editando'), fila(5, 'verificando'), fila(6, 'en_cola'), fila(7, 'aprobada'), fila(8, 'omitida'), fila(9, 'en_cola'), fila(10, 'en_cola')];
  const r = L.resumen(lote('corriendo', filas, { inicio: 1000 }), 1000 + 5 * 60000);
  assert.equal(L.resumen(lote('corriendo', filas, { inicio: 0 }), 5 * 60000).eta, null, 'inicio 0 = sin empezar (§6.2): sin estimación');
  assert.deepEqual(r.por, { cola: 3, trabajando: 2, lista: 1, revisar: 1, aprobada: 1, fallo: 1, omitida: 1 });
  assert.equal(r.total, 10); assert.equal(r.hechas, 5); assert.equal(r.pct, 50);
  assert.equal(r.eta, 5, '5 hechas en 5 min → 5 min para las otras 5');
  assert.equal(L.lineaCifras(r), '5/10 · 1 revisar · 1 falló · 1 aprobada · ~5 min');
  assert.equal(L.costoTexto(r), 'US$0,94 de 1,56');
  assert.equal(L.costoTexto(L.resumen(lote('previsto', [], { costo: { estimado: 0, gastado: 0 } }))), 'gratis');
  assert.equal(L.costoTexto(L.resumen(lote('previsto', [], { costo: { estimado: 0.12, gastado: 0 } }))), 'US$0,00 de 0,12');
  assert.equal(L.resumen(lote('pausado', filas, { inicio: 0 }), 1e6).eta, null, 'en pausa no hay estimación');
});

test('los botones del lote: probar/generar antes de gastar, pausar en marcha, seguir tras la muestra, nada al terminar', () => {
  const muchas = Array.from({ length: 12 }, (_, i) => fila(i + 1, 'en_cola'));
  assert.deepEqual(L.controles(lote('previsto', muchas)), ['probar', 'iniciar', 'cancelar']);
  assert.deepEqual(L.controles(lote('previsto', muchas.slice(0, 3))), ['iniciar', 'cancelar'], 'con 3 o menos no hay muestra');
  assert.deepEqual(L.controles(lote('espera_ok', muchas)), ['probar', 'iniciar', 'cancelar']);
  assert.deepEqual(L.controles(lote('corriendo', muchas)), ['pausar', 'cancelar']);
  assert.deepEqual(L.controles(lote('pausado', muchas, { pausa: { por: 'muestra' } })), ['continuar', 'cancelar']);
  assert.deepEqual(L.controles(lote('pausado', muchas, { pausa: { por: 'dueño' } })), ['reanudar', 'cancelar']);
  assert.deepEqual(L.controles(lote('pausado', muchas, { motivo: 'No cabe en el tope de hoy' })), ['reanudar', 'cancelar'], 'una pausa por dinero no es la muestra');
  const trasMuestra = [fila(1, 'lista'), fila(2, 'lista'), fila(3, 'revisar'), ...muchas.slice(3)];
  assert.equal(L.pausaDeMuestra(lote('pausado', trasMuestra, { muestra: 3 })), true, 'sin motivo: 3 empezadas de una muestra de 3');
  assert.deepEqual(L.controles(lote('hecho', trasMuestra)), []);
  assert.deepEqual(L.controles(lote('cancelado', trasMuestra)), []);
});

test('lo que se puede hacer con cada foto, y el pedido que manda (idempotente en el servidor)', () => {
  const l = lote('corriendo', []);
  assert.deepEqual(L.accionesFila(fila(1, 'lista'), l), ['aprobar', 'otra', 'mas_fuerte', 'modelo']);
  assert.deepEqual(L.accionesFila(fila(1, 'revisar'), l), ['aprobar', 'reintentar', 'mas_fuerte', 'modelo', 'omitir']);
  assert.deepEqual(L.accionesFila(fila(1, 'fallo'), l), ['reintentar', 'modelo', 'omitir']);
  assert.deepEqual(L.accionesFila(fila(1, 'editando'), l), [], 'lo que está en marcha no se toca');
  assert.deepEqual(L.accionesFila(fila(1, 'revisar'), lote('cancelado', [])), []);
  assert.deepEqual(L.pedidoFila('aprobar', [12, '14']), { accion: 'aprobar', filas: [12, 14] });
  assert.deepEqual(L.pedidoFila('otra', [3]), { accion: 'reintentar', filas: [3] });
  assert.deepEqual(L.pedidoFila('mas_fuerte', [3]), { accion: 'reintentar', filas: [3], mas_fuerte: true });
  assert.deepEqual(L.pedidoFila('modelo', [3], { modelo: 'gpt-image' }), { accion: 'reintentar', filas: [3], modelo: 'gpt-image' });
  assert.deepEqual(L.filtrar([fila(1, 'editando'), fila(2, 'verificando'), fila(3, 'lista')], 'trabajando').map(f => f.n), [1, 2]);
  for (const [k] of L.FILTROS.slice(1)) assert.ok(Object.values(L.ESTADO_FILA).some(e => e.grupo === k), k);
});

test('el agente habla solo con datos reales', () => {
  const t = L.agenteDice(lote('corriendo', [fila(14, 'editando', { sku: 'CM-140' }), fila(15, 'verificando'), fila(16, 'en_cola')]));
  assert.equal(t, 'Trabajo en #14 (CM-140), #15 · 2 a la vez.');
  assert.match(L.agenteDice(lote('pausado', [fila(1, 'lista'), fila(2, 'lista'), fila(3, 'lista'), fila(4, 'en_cola'), fila(5, 'en_cola')], { pausa: { por: 'muestra' } })), /Probé con 3\. .*las 2 restantes/);
  assert.equal(L.agenteDice(lote('pausado', [], { pausa: { por: 'creditos', motivo: 'Higgsfield dice que no quedan créditos.' } })), 'En pausa: Higgsfield dice que no quedan créditos.');
  assert.equal(L.agenteDice(lote('hecho', [fila(1, 'lista'), fila(2, 'aprobada'), fila(3, 'revisar'), fila(4, 'fallo')])), 'Terminé: 2 listas, 1 para revisar, 1 falló.');
  assert.match(L.agenteDice(lote('espera_ok', [fila(1, 'en_cola')], { by: 'agent', agent: 'Pixel' })), /^Lo pidió Pixel: 1 foto\. Espera tu OK/);
  assert.match(L.agenteDice(lote('previsto', [fila(1, 'en_cola')])), /No he gastado nada/);
});

test('el lector de pantalla oye cada 10 %, cada fallo y el final; nada más', () => {
  const base = Array.from({ length: 20 }, (_, i) => fila(i + 1, 'en_cola'));
  const con = (k, e = 'lista') => base.map((f, i) => (i < k ? { ...f, estado: e } : f));
  assert.equal(L.anuncio(lote('corriendo', con(1)), lote('corriendo', con(1))), null);
  assert.equal(L.anuncio(lote('corriendo', con(1)), lote('corriendo', con(2))), '10 %: 2 de 20.');
  assert.equal(L.anuncio(lote('corriendo', con(2)), lote('corriendo', con(3))), null, '15 % no cruza otra decena');
  const fallo = con(2).map(f => (f.n === 2 ? { ...f, estado: 'fallo', error: 'Sin créditos.' } : f));
  assert.equal(L.anuncio(lote('corriendo', con(1)), lote('corriendo', fallo)), 'Falló la foto #2: Sin créditos.');
  assert.match(L.anuncio(lote('corriendo', con(19)), lote('hecho', con(20))), /^Terminé: 20 listas/);
  assert.equal(L.anuncio(null, lote('corriendo', con(5))), null, 'la primera lectura no se anuncia');
  assert.equal(L.anuncio(lote('corriendo', con(1)), { ...lote('corriendo', con(9)), id: 'L2' }), null, 'otro lote: nada');
  assert.deepEqual(L.lineaBitacora({ at: new Date(2026, 9, 1, 9, 5).getTime(), n: 14, t: 'El fondo quedó en 248.' }), { hora: '09:05', texto: '#14 · El fondo quedó en 248.' });
});

test('crear en 3 pasos: lo que falta en cada uno, «Probar con 3» desde 10 fotos y el pedido (que no gasta)', () => {
  const b = L.nuevoBorrador();
  assert.equal(b.paso, 1); assert.equal(L.nuevoBorrador({ tipo: 'seleccion', files: ['a'] }).paso, 2, '«Editar en lote…» salta al paso 2');
  assert.deepEqual(L.erroresPaso(b, 1), ['Elige de dónde salen las fotos.']);
  assert.deepEqual(L.erroresPaso({ ...b, origen: { tipo: 'carpeta' } }, 1), ['Elige la carpeta.']);
  assert.deepEqual(L.erroresPaso({ ...b, origen: { tipo: 'subidas', files: [] } }, 1), ['No hay ninguna foto todavía.']);
  assert.match(L.erroresPaso({ ...b, origen: { tipo: 'carpeta', carpeta: 'c1', n: 140 } }, 1)[0], /hasta 100 fotos y aquí hay 140/);
  assert.deepEqual(L.erroresPaso({ ...b, origen: { tipo: 'hoja', filas: [{ sku: 'x' }], columnas: [{ nombre: 'SKU', campo: 'sku' }] } }, 1), ['Di qué columna trae la foto.']);
  assert.deepEqual(L.erroresPaso({ ...b, origen: { tipo: 'carpeta', carpeta: 'c1', n: 4 } }, 1), []);
  assert.match(L.erroresPaso(b, 2)[0], /al menos un preset/);
  assert.deepEqual(L.erroresPaso({ ...b, origen: { tipo: 'hoja', filas: [{ foto: 'a', preset: 'fondo-blanco' }] } }, 2), [], 'una hoja con preset por fila no necesita receta común');
  assert.deepEqual(L.erroresPaso({ ...b, escena: { producto: {} } }, 2), [], 'el escenario 3D solo también vale');
  assert.match(L.erroresPaso({ ...b, pila: [{ id: 'x' }], topeUsd: '-2' }, 2)[0], /tope/);

  assert.equal(L.probarActivo({ ...b, origen: { tipo: 'carpeta', carpeta: 'c', n: 9 } }), false);
  assert.equal(L.probarActivo({ ...b, origen: { tipo: 'carpeta', carpeta: 'c', n: 10 } }), true);
  assert.equal(L.probarActivo({ ...b, probar: false, origen: { tipo: 'carpeta', carpeta: 'c', n: 40 } }), false, 'el dueño lo apaga');

  const p = L.pedidoLote({ ...b, origen: { tipo: 'carpeta', carpeta: 'c9', n: 40, nombre: 'Bodega' }, pila: [{ id: 'cat-web-panaclaw', params: {} }, { id: 'luz-mas-clara', params: { intensidad: 'fuerte' } }], canal: 'web', idea: '  madera cálida ', topeUsd: '5' });
  assert.deepEqual(p, { nombre: 'Bodega → web', by: 'you', origen: { tipo: 'carpeta', carpeta: 'c9' },
    receta: { pila: [{ id: 'cat-web-panaclaw' }, { id: 'luz-mas-clara', params: { intensidad: 'fuerte' } }], canal: 'web', idea: 'madera cálida' }, muestra: 3, qa: 'auto', tope: { usd: 5 } });
  const h = L.pedidoLote({ ...b, nombre: 'Mío', origen: { tipo: 'hoja', nombre: 'camas.xlsx', data: 'AAAA', filas: [{ n: 1, foto: 'a.jpg' }], columnas: [{ nombre: 'Foto', campo: 'foto' }], files: ['2026-10/a.jpg'] }, pila: [{ id: 'x' }], canal: null });
  assert.deepEqual(h.origen, { tipo: 'hoja', nombre: 'camas.xlsx', filas: [{ n: 1, foto: 'a.jpg' }], columnas: [{ nombre: 'Foto', campo: 'foto' }], fotos: ['2026-10/a.jpg'] }, 'el archivo en base64 no se vuelve a mandar');
  assert.equal(h.muestra, 0); assert.equal(h.tope, undefined); assert.equal(h.nombre, 'Mío');
});

test('la vista previa y las columnas del Excel se leen con tolerancia', () => {
  const v = L.previaDe({ id: 'L', filas: Array.from({ length: 8 }, (_, i) => ({ n: i + 1 })), previa: { total: 8, costo: 0.32, cabe: { dia: false }, quedaHoy: 0.1, modelo: 'Nano Banana 2' } });
  assert.equal(v.filas.length, 5); assert.equal(v.total, 8); assert.equal(v.muestraCosto, 0.12);
  assert.equal(v.cabe, false); assert.equal(v.cabeMuestra, true); assert.match(v.motivo, /tope de hoy/); assert.equal(v.quedaHoy, 0.1);
  assert.equal(L.previaDe({ costo: { estimado: 1 }, filas: [{}, {}] }).cabe, true);
  assert.deepEqual(L.columnasDe([{ nombre: 'Imagen', campo: 'foto' }, 'Comentario']), [{ nombre: 'Imagen', campo: 'foto' }, { nombre: 'Comentario', campo: '' }]);
  assert.deepEqual(L.columnasDe({ foto: 'Imagen', sku: 'Código' }), [{ nombre: 'Imagen', campo: 'foto' }, { nombre: 'Código', campo: 'sku' }]);
  assert.deepEqual(L.columnasDe({ Imagen: 'foto', Otra: '' }), [{ nombre: 'Imagen', campo: 'foto' }, { nombre: 'Otra', campo: '' }]);
});

test('la demo: un lote de mentira que no gasta, prueba con 3, se pausa, sigue, reintenta y termina', async () => {
  let t = 1000;
  const api = L.crearDemo({ now: () => (t += 1000) });
  await assert.rejects(api('POST', '/api/media/lotes/hoja', {}), /demo no se leen hojas/);
  const { lote: l0 } = await api('POST', '/api/media/lotes', { nombre: 'Prueba', origen: { tipo: 'ejemplo', n: 12 }, receta: { pila: [{ id: 'fondo-blanco' }] }, muestra: 3 });
  assert.equal(l0.estado, 'previsto'); assert.equal(l0.filas.length, 12); assert.equal(l0.costo.estimado, 0, 'el motor «prueba» es gratis');
  assert.equal(L.previaDe(l0).filas.length, 5);
  const get = async () => (await api('GET', `/api/media/lotes/${l0.id}`)).lote;
  assert.equal((await get()).estado, 'previsto', 'leerlo no lo arranca: nada corre sin el clic');
  await api('PATCH', `/api/media/lotes/${l0.id}`, { accion: 'probar' });
  let l; for (let i = 0; i < 10; i++) { l = await get(); if (l.estado !== 'muestra') break; }
  assert.equal(l.estado, 'pausado'); assert.equal(L.pausaDeMuestra(l), true);
  assert.equal(l.filas.filter(f => f.estado !== 'en_cola').length, 3, 'la muestra son 3, ni una más');
  assert.deepEqual(L.controles(l), ['continuar', 'cancelar']);
  await api('PATCH', `/api/media/lotes/${l0.id}`, { accion: 'continuar' });
  l = await get(); assert.ok(l.filas.filter(f => f.estado === 'editando' || f.estado === 'verificando').length <= 2, 'concurrencia 2');
  await api('PATCH', `/api/media/lotes/${l0.id}`, { accion: 'pausar' });
  const quieto = await get(), quieto2 = await get();
  assert.equal(quieto.estado, 'pausado'); assert.deepEqual(quieto2.filas.filter(f => f.estado === 'en_cola').length, quieto.filas.filter(f => f.estado === 'en_cola').length, 'en pausa no entra nada nuevo');
  await api('PATCH', `/api/media/lotes/${l0.id}`, { accion: 'reanudar' });
  for (let i = 0; i < 30; i++) { l = await get(); if (l.estado === 'hecho') break; }
  assert.equal(l.estado, 'hecho');
  const r = L.resumen(l); assert.equal(r.por.fallo, 1, 'la 7 falla a propósito'); assert.equal(r.por.revisar, 2, 'la 5 y la 10 quedan para revisar');
  await api('POST', `/api/media/lotes/${l0.id}/filas`, L.pedidoFila('aprobar', [1, 1]));
  await api('POST', `/api/media/lotes/${l0.id}/filas`, L.pedidoFila('aprobar', [1]));
  l = await get(); assert.equal(l.filas[0].estado, 'aprobada'); assert.equal(l.bitacora.filter(b => b.n === 1 && /Aprobada/.test(b.t)).length, 1, 'aprobar dos veces cuenta una');
  await api('POST', `/api/media/lotes/${l0.id}/filas`, L.pedidoFila('modelo', [7], { modelo: 'otro' }));
  for (let i = 0; i < 6; i++) l = await get();
  assert.equal(l.filas[6].estado, 'lista', 'el reintento de la 7 sale bien'); assert.equal(l.filas[6].intentos, 2);
  await assert.rejects(api('GET', `/api/media/lotes/${l0.id}/zip`), /demo no se descarga/);
  assert.equal((await api('GET', '/api/media/lotes')).lotes.length, 1);
});
