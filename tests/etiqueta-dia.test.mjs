// CON-08 / UX-04 / CON-15: la etiqueta de día única, en la zona de la oficina, y que el horario de verano no la mueve.
import test from 'node:test'; import assert from 'node:assert/strict'; import { spawnSync } from 'node:child_process'; import fs from 'node:fs';
import { etiquetaDia, diaEnZona, sumarDias, relDia, diaSemana, partesEnZona, fijarZona, zonaActual, zonaValida } from '../tareas/etiqueta-dia.mjs';
import { nombreDia, porDia, conSinHora, grupoFecha, dia } from '../tareas/dueno.mjs';

test('sumarDias es de calendario (meses, años, bisiesto) y diaSemana cuadra', () => {
  assert.equal(sumarDias('2026-10-31', 1), '2026-11-01'); assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(sumarDias('2028-02-28', 1), '2028-02-29'); assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(diaSemana('2026-10-31'), 6); assert.equal(diaSemana('2026-11-01'), 0);
});
// la MISMA hora del mundo es «hoy» en una zona y «mañana» en otra
const AHORA = Date.parse('2026-10-31T02:30:00Z'); // 30 oct 21:30 en Panamá · 31 oct 11:30 en Sídney · 31 oct 02:30 UTC
const MATRIZ = [['America/Panama', '2026-10-30'], ['UTC', '2026-10-31'], ['Australia/Sydney', '2026-10-31'], ['Pacific/Kiritimati', '2026-10-31'], ['Pacific/Pago_Pago', '2026-10-30'], ['America/Los_Angeles', '2026-10-30'], ['Asia/Kolkata', '2026-10-31']];
for (const [z, esperado] of MATRIZ) test(`diaEnZona ${z}`, () => assert.equal(diaEnZona(AHORA, z), esperado));
test('el mismo instante da «Hoy» en una zona y «Mañana» en otra', () => {
  assert.equal(etiquetaDia('2026-10-31', '', AHORA, 'America/Panama').nombre, 'Mañana');
  assert.equal(etiquetaDia('2026-10-31', '', AHORA, 'Australia/Sydney').nombre, 'Hoy');
  assert.equal(etiquetaDia('2026-10-30', '', AHORA, 'Australia/Sydney').nombre, 'Ayer');
});
test('formato: nombre, corto, texto y «Sin hora»', () => {
  const a = Date.parse('2026-10-31T19:00:00Z'), z = 'America/Panama';
  assert.deepEqual(etiquetaDia('2026-10-31', '14:30', a, z), { rel: 'hoy', nombre: 'Hoy', corto: 'Hoy 31 oct', hora: '14:30', sinHora: false, texto: 'Hoy 31 oct · 14:30' });
  assert.equal(etiquetaDia('2026-11-01', '', a, z).texto, 'Mañana 1 nov · Sin hora');
  assert.equal(etiquetaDia('2026-11-04T09:15', null, a, z).hora, '09:15', 'la hora puede venir dentro de la fecha límite');
  assert.equal(etiquetaDia('2026-11-04', null, a, z).nombre, 'miércoles 4 nov');
  assert.equal(etiquetaDia('2026-11-04', null, a, z).corto, 'mié 4 nov');
  assert.equal(etiquetaDia('', null, a, z).texto, 'Sin fecha'); assert.equal(etiquetaDia(null, '10:00', a, z).sinHora, true);
});
test('zona desconocida o vacía no rompe: usa la del proceso', () => {
  assert.equal(zonaValida('No/Existe'), false); assert.equal(zonaValida('America/Panama'), true);
  assert.match(diaEnZona(AHORA, 'No/Existe'), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(fijarZona('No/Existe'), undefined); assert.equal(fijarZona('America/Panama'), 'America/Panama'); assert.equal(zonaActual(), 'America/Panama');
  assert.equal(diaEnZona(AHORA), '2026-10-30'); fijarZona(undefined);
});
// horario de verano: «mañana» no depende de cuánto mida el día
const CAMBIOS = [['America/New_York', '2026-03-08', '2026-11-01'], ['Europe/Madrid', '2026-03-29', '2026-10-25'], ['Australia/Sydney', '2026-10-04', '2026-04-05'], ['America/Santiago', '2026-09-06', '2026-04-05']];
for (const [z, primavera, otono] of CAMBIOS) test(`verano ${z}: la víspera de cada cambio, «mañana» es el día del cambio`, () => {
  let n = 0;
  for (const f of [primavera, otono]) {
    const vispera = sumarDias(f, -1);
    for (const hh of ['00:05', '12:00', '23:55']) {
      // un instante de la víspera en esa zona (se busca el que cae a esa hora local)
      const base = Date.parse(vispera + 'T12:00:00Z'); let ms = null;
      for (let k = -30; k <= 30 && ms == null; k++) { const t = base + k * 3600e3, p = partesEnZona(t, z); if (diaEnZona(t, z) === vispera && `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}` === hh.slice(0, 3) + '00' ) ms = t; }
      if (ms == null) continue;
      assert.equal(relDia(f, ms, z), 'manana', `${z} ${vispera} ${hh}`);
      assert.equal(relDia(sumarDias(f, 1), ms, z), null); n++;
    }
  }
  assert.ok(n >= 4, `se comprobaron ${n} instantes`);
});
test('nombreDia y porDia usan la etiqueta única y mantienen su salida', () => {
  const a = Date.parse('2026-10-31T19:00:00Z');
  assert.equal(nombreDia('2026-10-31', a, 'America/Panama'), 'Hoy'); assert.equal(nombreDia('2026-11-01', a, 'America/Panama'), 'Mañana'); assert.equal(nombreDia('2026-11-06', a, 'America/Panama'), 'viernes 6 nov');
  const t = (id, limite) => ({ id, limite, state: 'next' });
  const g = porDia([t('a', '2026-11-02'), t('b', '2026-11-02T09:00'), t('c', '2026-11-01'), t('d', null)], a, 'America/Panama');
  assert.deepEqual(g.map(x => x.titulo), ['Mañana', 'lunes 2 nov', 'Sin fecha']);
  assert.equal(grupoFecha(t('x', '2026-11-01'), a, 'America/Panama'), 'manana');
  assert.equal(dia(a, 'America/Panama'), '2026-10-31');
});
test('«Con hora / Sin hora»: solo si el día tiene de las dos; las de hora, por hora', () => {
  const t = (id, limite) => ({ id, limite });
  assert.equal(conSinHora([t('a', '2026-11-02'), t('b', '2026-11-02')]), null);
  assert.equal(conSinHora([t('a', '2026-11-02T09:00')]), null);
  const s = conSinHora([t('a', '2026-11-02'), t('b', '2026-11-02T15:00'), t('c', '2026-11-02T08:30')]);
  assert.deepEqual(s.map(x => x.k), ['con', 'sin']); assert.deepEqual(s[0].tareas.map(x => x.id), ['c', 'b']); assert.deepEqual(s[1].tareas.map(x => x.id), ['a']);
});
test('calendar-core: addDays y la agenda no saltan ni repiten un día en el cambio de horario (TZ real del proceso)', () => {
  const code = `import('./src/calendar-core.js').then(m=>{const out=[];let ts=new Date(2026,10,1-3).getTime();const ini=ts;for(let i=0;i<8;i++)out.push(m.ymd(new Date(m.addDays(ini,i))));console.log(JSON.stringify(out));const r=m.rangeOf('week',new Date(2026,10,1).getTime());console.log(m.ymd(new Date(r.from)),m.ymd(new Date(r.to)))})`;
  const r = spawnSync(process.execPath, ['-e', code], { cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8' });
  const [l1, l2] = r.stdout.trim().split('\n');
  assert.deepEqual(JSON.parse(l1), ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'], r.stderr);
  assert.equal(l2, '2026-10-26 2026-11-02', 'la semana que contiene el cambio de horario (1 nov) mide 7 días de calendario');
});
test('nadie vuelve a sumar 24 h para hallar «mañana»', () => {
  for (const f of ['src/contenido.js', 'src/calendar-core.js', 'tareas/dueno.mjs', 'src/contenido-cola.js']) assert.doesNotMatch(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'), /\+ DAY \+ 3600e3|ahora \+ 864e5|now \+ DAY/, f);
});
