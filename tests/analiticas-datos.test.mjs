// V4.7 (F2): los datos de EJEMPLO de Analíticas (src/analiticas-datos.js). Se ven igual que los reales, así que lo que importa es que NO
// se puedan confundir con ellos (llevan `ejemplo: true`), que sean deterministas (la captura de la pantalla no cambia sola) y que
// alimenten las mismas cuentas que los datos de verdad sin tropezar con ninguna.
import test from 'node:test';
import assert from 'node:assert/strict';
import { datosDeEjemplo } from '../src/analiticas-datos.js';
import { kpis, serieDiaria, porFormato, mejoresMomentos, horaSugerida, enfoque, sumarDias } from '../src/contenido-cifras.js';

test('los datos de ejemplo se rotulan como tales y no traen nada que parezca una cuenta real', () => {
  const d = datosDeEjemplo('2026-09-30');
  assert.equal(d.ejemplo, true);
  assert.equal(d.meta.token.tipo, 'EJEMPLO'); assert.equal(d.meta.version, 'ejemplo');
  for (const c of d.meta.cuentas) assert.match(c.externoId, /^ejemplo-/);
  for (const p of d.publicaciones) assert.equal(p.enlace, '', 'un enlace de ejemplo llevaría a otra parte');
});

test('son deterministas: la misma fecha da los mismos números', () => {
  assert.deepEqual(datosDeEjemplo('2026-09-30'), datosDeEjemplo('2026-09-30'));
  assert.notDeepEqual(datosDeEjemplo('2026-09-30').serie[10], datosDeEjemplo('2026-10-01').serie[10]);
});

test('alimentan las cuentas de verdad: seguidores que suben, periodo anterior completo, formatos, horarios y una hora sugerida', () => {
  const d = datosDeEjemplo('2026-09-30'), hoy = d.hoy;
  assert.equal(d.ultimaFoto, '2026-09-29'); // ayer: como la foto real
  const k = kpis({ serie: d.serie, publicaciones: d.publicaciones }, { desde: sumarDias(hoy, -30), hasta: hoy, cobertura: 0.7 });
  assert.ok(k.seguidores.ganados > 0, 'los seguidores del ejemplo suben');
  assert.notEqual(k.alcance.cambio, null); assert.ok(Math.abs(k.alcance.cambio) < 100, 'el alcance del ejemplo no salta un 900 %');
  const serie = serieDiaria(d.serie); assert.equal(serie.length, 180);
  const e = enfoque(d.publicaciones, hoy); assert.ok(e.maduras.length > 20 && e.recientes.length > 0);
  assert.ok(porFormato(e.maduras).length >= 3);
  assert.ok(mejoresMomentos(e.maduras).mejores.length === 3);
  assert.match(horaSugerida(e.maduras, '').hora, /^\d\d:00$/, 'con estos datos sí hay hora que sugerir');
});
