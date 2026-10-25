// Los casos del reloj de la oficina, en un proceso aparte con su propia zona (TZ): `local` usa el Date de la computadora; `sombra` el de worker/lib/zona.js.
import { conZona } from '../worker/lib/zona.js';
const f = () => {
  const r = [];
  const d = new Date('2026-10-26T09:30:00'); r.push(d.toISOString(), d.getHours(), d.getDay(), d.getDate());
  const e = new Date(2026, 9, 31, 23, 30); r.push(e.toISOString()); e.setDate(e.getDate() + 1); r.push(e.toISOString(), e.getMonth());
  const g = new Date(1792800000000); r.push(g.getHours(), g.getDate(), g.getMinutes(), g.getDay());
  const i = new Date('2026-10-26T12:00:00'); i.setMinutes(61, 0, 0); r.push(i.toISOString());
  const j = new Date('2026-10-26T23:59:00'); j.setHours(j.getHours() + 1); r.push(j.toISOString(), j.getDate());
  const k = new Date('2026-01-31T12:00:00'); k.setMonth(k.getMonth() + 1); r.push(k.toISOString());
  r.push(Date.parse('2026-10-26T09:30:00'), new Date('2026-10-26').toISOString(), new Date(2026, 0, 31).getMonth(), new Date('2026-02-01T00:00:00').getDay(), new Date('2026-03-08T02:30:00').getHours());
  r.push(new Date(2026, 11, 31, 23, 59, 59).getFullYear(), new Date(1767225599000).getFullYear(), new Date('2026-06-15T08:00:00').getTimezoneOffset());
  return JSON.stringify(r);
};
const modo = process.argv[2];
if (modo === 'local') console.log(f());
else console.log(await conZona(modo === 'sombra-bogota' ? 'America/Bogota' : 'America/Panama', async () => f()));
