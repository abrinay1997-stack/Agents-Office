// Agents Office V4.2 (audit B46) — el horario de la oficina como calendario (.ics), solo lectura, para la agenda del dueño. Puro: lo usan serve.mjs
// (/api/calendar.ics) y el Worker de Cloudflare. Mismo texto que antes de sacarlo de serve.mjs (tests/calendario-ics.test.mjs lo comprueba).
import { DUENO } from './tareas/dueno.mjs';

export function icsFeed({ rutinas = [], tareas = [], agentes = [], depts = {}, nombre = 'Oficina', ahora = new Date() } = {}) {
  const p2 = n => String(n).padStart(2, '0'), stamp = d => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`;
  const txt = s => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
  const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'], now = ahora, ev = [];
  const fold = l => l.length <= 60 ? l : l.match(/.{1,60}/gu).join('\r\n ');
  for (const r of rutinas) {
    const w = r.when; if (!w || r.paused || w.kind === 'minutes') continue;
    const start = w.start ? new Date(w.start + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [h, m] = String(w.at || w.from || '09:00').split(':').map(Number); start.setHours(h, m, 0, 0);
    const rule = w.kind === 'daily' ? 'FREQ=DAILY' : w.kind === 'weekdays' ? 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' : w.kind === 'weekly' ? `FREQ=WEEKLY;BYDAY=${w.days.map(d => BY[d]).join(',')}`
      : w.kind === 'monthly' ? `FREQ=MONTHLY;${w.nth ? `BYDAY=${w.nth}${BY[w.weekday]}` : `BYMONTHDAY=${w.day}`}` // plan T5
      : w.kind === 'hourly' ? (() => { const a = +String(w.from).split(':')[0], b = +String(w.to).split(':')[0], hs = []; for (let x = a; x <= b; x += Math.max(1, w.every || 1)) hs.push(x); return `FREQ=WEEKLY;BYDAY=${w.weekdaysOnly ? 'MO,TU,WE,TH,FR' : BY.join(',')};BYHOUR=${hs.join(',')};BYMINUTE=${+String(w.from).split(':')[1] || 0}`; })() : null;
    if (!rule) continue;
    const a = agentes.find(x => x.id === r.agent);
    const fin = w.end ? `;UNTIL=${w.end.replace(/-/g, '')}T235959` : w.count ? `;COUNT=${w.count}` : ''; // plan T5
    ev.push(['BEGIN:VEVENT', `UID:rutina-${r.id}@agents-office`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(start)}`, 'DURATION:PT30M', `RRULE:${rule}${fin}`, `SUMMARY:${txt('⏱ ' + r.title)}`, `DESCRIPTION:${txt(`${r.text || r.title}\n${depts[r.dept]?.name || r.dept} · ${a ? a.name : r.agent}${r.needsOk ? ' · pide tu OK' : ''}`)}`, 'END:VEVENT']);
  }
  const dur = min => `DURATION:PT${Math.max(5, Math.min(24 * 60, Math.round(min || 30)))}M`; // plan T2: the task's estimate (30 min when it has none)
  for (const t of tareas) {
    const a = agentes.find(x => x.id === t.agent), mia = t.person === DUENO, quien = mia ? `Tuya${depts[t.dept] ? ' · ' + depts[t.dept].name : ''}${t.prioridad === 'alta' ? ' · prioridad alta' : ''}` : t.person ? `${t.person} (persona)${t.prioridad === 'alta' ? ' · prioridad alta' : ''}` : `${depts[t.dept]?.name || t.dept} · ${a ? a.name : t.agent}${t.prioridad === 'alta' ? ' · prioridad alta' : ''}`; // plan D: lo tuyo dice «Tuya»
    if (t.state === 'scheduled' && t.dueAt) ev.push(['BEGIN:VEVENT', `UID:tarea-${t.id}@agents-office`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(new Date(t.dueAt))}`, dur(t.estimacion), `SUMMARY:${txt('◷ ' + t.title)}`, `DESCRIPTION:${txt(`${t.text || t.title}\n${quien}`)}`, 'END:VEVENT']);
    if (t.limite && t.state !== 'done' && !t.archived) { // the deadline: an all-day event (or at its hour)
      const s = String(t.limite), d = s.slice(0, 10).replace(/-/g, '');
      ev.push(['BEGIN:VEVENT', `UID:limite-${t.id}@agents-office`, `DTSTAMP:${stamp(now)}`, ...(s.length > 10 ? [`DTSTART:${stamp(new Date(s))}`, mia ? dur(t.estimacion) : 'DURATION:PT15M'] : [`DTSTART;VALUE=DATE:${d}`]), `SUMMARY:${txt((mia ? '☐ ' : '⚑ Vence: ') + t.title)}`, `DESCRIPTION:${txt(mia && t.text ? `${t.text}\n${quien}` : quien)}`, 'END:VEVENT']); // plan D: una tarea tuya es un pendiente tuyo («☐»)
    }
  }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agents Office//Calendario//ES', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${txt(nombre + ' · oficina')}`, ...ev.flat(), 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}
