// Datos de muestra para tests/calendario-ics.test.mjs (rutinas de cada clase, tareas programadas, con fecha límite y del dueño).
export const muestra = {
  nombre: 'PanaClaw',
  depts: { marketing: { name: 'Marketing' }, fin: { name: 'Contabilidad' }, ops: { name: 'Operaciones' } },
  agentes: [{ id: 'mk1', name: 'REDES' }, { id: 'inv', name: 'FACTURAS' }, { id: 'o1', name: 'OPS UNO' }],
  rutinas: [
    { id: 'lunes', dept: 'marketing', agent: 'mk1', title: 'Plan de la semana', text: 'Arma el plan, de lunes a viernes.', when: { kind: 'weekly', days: [1, 4], at: '09:00' }, needsOk: true },
    { id: 'diaria', dept: 'ops', agent: 'o1', title: 'Triage, con coma; y punto y coma', text: 'Lee el correo\ny resume', when: { kind: 'daily', at: '07:30', start: '2026-11-02' }, needsOk: false },
    { id: 'habil', dept: 'fin', agent: 'inv', title: 'Cobros', text: '', when: { kind: 'weekdays', at: '08:15', end: '2026-12-31' }, needsOk: true },
    { id: 'mes', dept: 'fin', agent: 'inv', title: 'Cierre', text: 'Cierra el mes', when: { kind: 'monthly', day: 28, at: '17:00', count: 6 }, needsOk: true },
    { id: 'nth', dept: 'ops', agent: 'o1', title: 'Segundo martes', text: 'Reunión', when: { kind: 'monthly', nth: 2, weekday: 2, at: '10:00' }, needsOk: false },
    { id: 'horas', dept: 'ops', agent: 'o1', title: 'Cada hora', text: 'Revisa', when: { kind: 'hourly', every: 2, from: '09:00', to: '17:00', weekdaysOnly: true }, needsOk: false },
    { id: 'pausada', dept: 'ops', agent: 'o1', title: 'Pausada', text: 'x', when: { kind: 'daily', at: '10:00' }, paused: true },
    { id: 'minutos', dept: 'ops', agent: 'o1', title: 'Filmación', text: 'x', when: { kind: 'minutes', every: 2 } },
  ],
  tareas: [
    { id: 't1', dept: 'marketing', agent: 'mk1', title: 'Post de lanzamiento', text: 'Escribe el post', state: 'scheduled', dueAt: Date.UTC(2026, 9, 28, 14, 0), estimacion: 45, prioridad: 'alta' },
    { id: 't2', dept: 'fin', agent: 'inv', title: 'Declaración', text: 'Prepara', state: 'next', limite: '2026-11-03', prioridad: 'media' },
    { id: 't3', title: 'Llamar al contador', text: 'Con los papeles', state: 'next', person: 'Tú', limite: '2026-10-30T10:00', estimacion: 20, prioridad: 'alta' },
    { id: 't4', dept: 'ops', agent: 'o1', title: 'Hecha', text: 'x', state: 'done', limite: '2026-10-01' },
    { id: 't5', dept: 'ops', title: 'De una persona', text: 'x', state: 'next', person: 'Ana', limite: '2026-11-10' },
  ],
};
