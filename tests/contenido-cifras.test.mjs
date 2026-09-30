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
