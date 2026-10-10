// V4.7 (F2): las cuentas de Analíticas (src/contenido-cifras.js), portadas de Juancito Ads con sus casos
// (src/lib/resultados.test.js). La hora es la del reloj de esta máquina, así que todo instante se construye con
// partes LOCALES: los casos valen en cualquier zona horaria.
import test from 'node:test';
import assert from 'node:assert/strict';
import { variacion, enLocal, serieDiaria, kpis, porFormato, mejoresMomentos, mejoresPublicaciones, numeroCorto, horaSugerida, enfoque, sumarDias, DIAS_DE_MADURACION } from '../src/contenido-cifras.js';

const iso = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const dia = (fecha, red, seguidores, alcance = 0, extra = {}) => ({ cuentaId: `${red}-1`, red, fecha, seguidores, alcance, vistas: 0, interacciones: 0, visitas: 0, ...extra });
const pub = (publicadaAt, interacciones, tipo = 'imagen', red = 'instagram') => ({ publicadaAt, interacciones, tipo, red, alcance: interacciones * 10 });

test('variación: null sin base', () => {
  assert.ok(Math.abs(variacion(110, 100) - 10) < 1e-9);
  assert.equal(variacion(5, 0), null);
  assert.equal(variacion(5, null), null);
});

test('sumarDias no se salta ni repite un día, sea cual sea la zona', () => {
  assert.equal(sumarDias('2026-10-31', 1), '2026-11-01');
  assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
});

test('enLocal: día de la semana, hora y fecha del reloj de esta máquina', () => {
  // lunes 5 de octubre de 2026, 21:00 locales
  assert.deepEqual(enLocal(iso(2026, 10, 5, 21)), { dia: 1, hora: 21, fecha: '2026-10-05' });
});

test('la serie suma las cuentas por día y salta las fotos que fallaron', () => {
  const s = serieDiaria([dia('2026-10-01', 'instagram', 100, 50), dia('2026-10-01', 'facebook', 40, 10), dia('2026-10-02', 'instagram', null, 0, { error: 'x' })]);
  assert.deepEqual(s, [{ fecha: '2026-10-01', seguidores: 140, alcance: 60, vistas: 0, interacciones: 0, visitas: 0 }]);
  assert.equal(serieDiaria([dia('2026-10-01', 'instagram', 100), dia('2026-10-01', 'facebook', 40)], 'facebook')[0].seguidores, 40);
});

test('las cifras del periodo contra el anterior', () => {
  const serie = [
    dia('2026-09-05', 'instagram', 900, 100), dia('2026-09-20', 'instagram', 950, 100),
    dia('2026-10-01', 'instagram', 1000, 300), dia('2026-10-15', 'instagram', 1100, 300),
  ];
  const publicaciones = [pub(iso(2026, 10, 3, 15), 50), pub(iso(2026, 10, 10, 15), 30), pub(iso(2026, 9, 10, 15), 40)];
  const k = kpis({ serie, publicaciones }, { desde: '2026-10-01', hasta: '2026-10-30' });
  assert.equal(k.seguidores.valor, 1100); assert.equal(k.seguidores.anterior, 1000); assert.equal(k.seguidores.ganados, 100);
  assert.equal(k.alcance.valor, 600); assert.equal(k.alcance.anterior, 200);
  assert.equal(k.interacciones.valor, 80);
  assert.ok(Math.abs(k.interacciones.cambio - 100) < 1e-9);
  assert.equal(k.publicaciones.valor, 2); assert.equal(k.publicaciones.anterior, 1);
  assert.ok(Math.abs(k.tasaInteraccion.valor - ((50 / 1100) * 100 + (30 / 1100) * 100) / 2) < 1e-9);
});

test('sin periodo anterior no se inventa una flecha', () => {
  const k = kpis({ serie: [dia('2026-10-01', 'instagram', 1000, 300)], publicaciones: [] }, { desde: '2026-10-01', hasta: '2026-10-30' });
  assert.equal(k.alcance.anterior, null); assert.equal(k.alcance.cambio, null);
  assert.equal(k.publicaciones.anterior, null);
});

test('formatos ordenados por interacción media', () => {
  const f = porFormato([pub(iso(2026, 10, 1), 10), pub(iso(2026, 10, 1), 90, 'reel'), pub(iso(2026, 10, 1), 30)]);
  assert.deepEqual(f.map(x => [x.tipo, x.cantidad, x.interacciones]), [['reel', 1, 90], ['imagen', 2, 20]]);
});

test('los mejores momentos, en día y bloque del reloj local', () => {
  // lunes 5 de octubre, 19:30 → bloque 18–21; martes 6, 14:00 → bloque 12–15
  const m = mejoresMomentos([pub(iso(2026, 10, 5, 19, 30), 100), pub(iso(2026, 10, 6, 14), 10)]);
  assert.deepEqual({ dia: m.mejores[0].dia, bloque: m.mejores[0].bloque, media: m.mejores[0].media }, { dia: 1, bloque: 6, media: 100 });
  assert.deepEqual(m.matriz[2][4], { media: 10, cantidad: 1 });
});

test('top de publicaciones', () => {
  assert.equal(mejoresPublicaciones([pub('x', 1), pub('y', 9)], 1)[0].interacciones, 9);
});

test('números cortos en español', () => {
  assert.equal(numeroCorto(null), '—');
  assert.equal(numeroCorto(950), '950');
  assert.equal(numeroCorto(12500), '12,5 mil');
  assert.equal(numeroCorto(1_250_000), '1,3 M');
});

test('la hora sugerida', () => {
  // martes 29 y 22 de septiembre: la tarde (18:00) rinde mucho más que la mañana (9:00)
  const tarde = [pub(iso(2026, 9, 29, 18, 30), 200), pub(iso(2026, 9, 22, 18, 45), 180)];
  const manana = [pub(iso(2026, 9, 29, 9), 40), pub(iso(2026, 9, 22, 9), 60)];
  const s = horaSugerida([...tarde, ...manana], '2026-10-06'); // martes
  assert.equal(s.hora, '19:00');
  assert.match(s.motivo, /^Los martes de 18–21 h/);
  assert.match(s.motivo, /190 interacciones de media en 2 publicaciones/);
  // un día sin datos propios → la mejor franja de la semana
  const s2 = horaSugerida([...tarde, pub(iso(2026, 9, 24, 18, 30), 100), pub(iso(2026, 9, 25, 18, 30), 100), ...manana], '2026-10-04'); // domingo
  assert.equal(s2.hora, '19:00');
  assert.match(s2.motivo, /^De 18–21 h/);
  // con pocos datos, nada: una publicación no es una tendencia
  assert.equal(horaSugerida([pub(iso(2026, 9, 29, 18, 30), 500)], '2026-10-06'), null);
  assert.equal(horaSugerida([], '2026-10-06'), null);
});

test('enfoque: lo de los últimos días todavía no maduró', () => {
  const hoy = '2026-10-10';
  const p = [pub(iso(2026, 10, 9), 5), pub(iso(2026, 10, 6), 5), pub(iso(2026, 10, 1), 40), { tipo: 'imagen', interacciones: 1 }];
  const e = enfoque(p, hoy);
  assert.equal(DIAS_DE_MADURACION, 5);
  assert.equal(e.recientes.length, 2); // el 9 y el 6 (hace menos de cinco días)
  assert.equal(e.maduras.length, 2); // el 1 y la que no trae fecha (no se puede decir que sea reciente)
  assert.deepEqual(enfoque(p, '').recientes, []); // sin «hoy» no se descarta nada
});

test('kpis: con `cobertura`, un periodo anterior a medio apuntar no da una flecha inventada', () => {
  // 3 fotos antes del periodo de 30 días: sin cobertura, «alcance» compararía 3 días contra 30 (sube un 900 %)
  const serie = [dia('2026-09-28', 'instagram', 900, 100), dia('2026-09-29', 'instagram', 905, 100), dia('2026-09-30', 'instagram', 910, 100),
    ...Array.from({ length: 30 }, (_, i) => dia(`2026-10-${String(i + 1).padStart(2, '0')}`, 'instagram', 1000 + i, 100))];
  const con = { desde: '2026-10-01', hasta: '2026-10-30' };
  assert.equal(kpis({ serie, publicaciones: [] }, con).alcance.anterior, 300, 'como en Juancito Ads: sin exigir nada, compara lo que haya');
  const k = kpis({ serie, publicaciones: [] }, { ...con, cobertura: 0.7 });
  assert.equal(k.alcance.anterior, null); assert.equal(k.alcance.cambio, null);
  assert.equal(k.seguidores.valor, 1029, 'lo que no depende del periodo anterior no cambia');
});

test('kpis: las publicaciones leídas solo desde una fecha no se comparan con un periodo anterior que empieza antes', () => {
  const serie = [dia('2026-10-01', 'instagram', 1000, 300)];
  const publicaciones = [pub(iso(2026, 10, 3, 15), 50), pub(iso(2026, 9, 10, 15), 40)];
  const con = { desde: '2026-10-01', hasta: '2026-10-30' }; // el anterior es del 2 al 30 de septiembre
  assert.equal(kpis({ serie, publicaciones }, con).interacciones.anterior, 40);
  const k = kpis({ serie, publicaciones }, { ...con, publicacionesDesde: '2026-09-20' });
  assert.equal(k.interacciones.anterior, null); assert.equal(k.publicaciones.anterior, null); assert.equal(k.tasaInteraccion.anterior, null);
  assert.equal(k.interacciones.valor, 50);
  assert.equal(kpis({ serie, publicaciones }, { ...con, publicacionesDesde: '2026-09-01' }).interacciones.anterior, 40, 'si se leyó desde antes, sí se compara');
});

// 9 oct 2026: «filtrar dentro de todas las cuentas y verlas individualmente». El filtro acepta 'todas', una red o una cuenta (su id).
import { deFiltro, cuentasDe, buscarCuenta, nombreCuenta, compararCuentas } from '../src/contenido-cifras.js';
const fila = (cuentaId, fecha, seguidores, alcance) => ({ cuentaId, red: cuentaId.split(':')[0], fecha, seguidores, alcance, vistas: 0, interacciones: 0, visitas: 0 });
const pubDe = (cuentaId, publicadaAt, interacciones, tipo = 'imagen') => ({ id: `${cuentaId}|${interacciones}`, cuentaId, red: cuentaId.split(':')[0], publicadaAt, interacciones, tipo, alcance: interacciones * 10 });
const CUENTAS = [{ id: 'instagram:1', red: 'instagram', nombre: 'PanaClaw', usuario: 'pana.claw' }, { id: 'instagram:2', red: 'instagram', nombre: 'BukoFlow', usuario: 'bukoflow' }, { id: 'facebook:9', red: 'facebook', nombre: 'PanaClaw' }];
const SERIE = [fila('instagram:1', '2026-10-01', 1000, 300), fila('instagram:2', '2026-10-01', 200, 50), fila('facebook:9', '2026-10-01', 400, 70),
  fila('instagram:1', '2026-10-05', 1010, 310), fila('instagram:2', '2026-10-05', 230, 60), fila('facebook:9', '2026-10-05', 401, 80)];

test('filtro de cuenta: una cuenta sola no suma los seguidores de otra; la red suma las suyas; todas, todas', () => {
  assert.equal(serieDiaria(SERIE, 'instagram:2').at(-1).seguidores, 230);
  assert.equal(serieDiaria(SERIE, 'instagram').at(-1).seguidores, 1240);
  assert.equal(serieDiaria(SERIE, 'todas').at(-1).seguidores, 1641);
  assert.equal(serieDiaria(SERIE, 'facebook:9').at(-1).alcance, 80);
  const k = kpis({ serie: SERIE, publicaciones: [] }, { desde: '2026-10-01', hasta: '2026-10-05', red: 'instagram:2' });
  assert.equal(k.seguidores.valor, 230); assert.equal(k.seguidores.ganados, 30); assert.equal(k.alcance.valor, 110);
  assert.equal(kpis({ serie: SERIE, publicaciones: [] }, { desde: '2026-10-01', hasta: '2026-10-05', filtro: 'instagram:1' }).seguidores.valor, 1010, '`filtro` es otro nombre de `red`');
  assert.equal(deFiltro('instagram:1')({ cuentaId: 'instagram:1', red: 'instagram' }), true);
  assert.equal(deFiltro('instagram:1')({ cuentaId: 'instagram:2', red: 'instagram' }), false);
  assert.equal(deFiltro('')({ cuentaId: 'x', red: 'facebook' }), true);
});

test('filtro de cuenta: las mejores publicaciones y los formatos de una cuenta son solo suyos', () => {
  const pubs = [pubDe('instagram:1', iso(2026, 10, 2), 90, 'reel'), pubDe('instagram:2', iso(2026, 10, 3), 50), pubDe('instagram:2', iso(2026, 10, 4), 20, 'carrusel'), pubDe('facebook:9', iso(2026, 10, 3), 70)];
  const dos = pubs.filter(deFiltro('instagram:2'));
  assert.deepEqual(mejoresPublicaciones(dos).map(p => p.interacciones), [50, 20]);
  assert.deepEqual(porFormato(dos).map(f => f.tipo), ['imagen', 'carrusel']);
  assert.equal(kpis({ serie: SERIE, publicaciones: pubs }, { desde: '2026-10-01', hasta: '2026-10-05', red: 'instagram:2' }).interacciones.valor, 70);
  assert.equal(kpis({ serie: SERIE, publicaciones: pubs }, { desde: '2026-10-01', hasta: '2026-10-05', red: 'instagram' }).interacciones.valor, 160);
});

test('las cuentas de un filtro, buscar una y compararlas', () => {
  assert.deepEqual(cuentasDe(CUENTAS, 'instagram').map(c => c.id), ['instagram:1', 'instagram:2']);
  assert.deepEqual(cuentasDe(CUENTAS, 'facebook:9').map(c => c.id), ['facebook:9']);
  assert.equal(cuentasDe(CUENTAS).length, 3);
  assert.equal(buscarCuenta(CUENTAS, '@BukoFlow').id, 'instagram:2');
  assert.equal(buscarCuenta(CUENTAS, 'instagram:1').id, 'instagram:1');
  assert.equal(buscarCuenta(CUENTAS, 'PanaClaw').id, 'instagram:1', 'por el nombre, la primera que lo lleva');
  assert.equal(buscarCuenta(CUENTAS, ''), null);
  assert.equal(nombreCuenta(CUENTAS[0]), '@pana.claw'); assert.equal(nombreCuenta(CUENTAS[2]), 'PanaClaw');
  const comp = compararCuentas({ serie: SERIE, publicaciones: [] }, CUENTAS, { desde: '2026-10-01', hasta: '2026-10-05' });
  assert.deepEqual(comp.map(x => [x.cuenta.id, x.k.seguidores.valor, x.k.seguidores.ganados]), [['instagram:1', 1010, 10], ['instagram:2', 230, 30], ['facebook:9', 401, 1]]);
  assert.equal(compararCuentas({ serie: SERIE, publicaciones: [] }, CUENTAS, { f: 'facebook', desde: '2026-10-01', hasta: '2026-10-05' }).length, 1);
});
