// Agents Office — the settings the owner changes from the office (V4.4, 25 Sep 2026; audit J5, I10). Every field says what
// it does; a change is validated here and written to office.config.local.json (this machine; it wins over the team's
// file and is never uploaded). Proven in tests/settings.test.mjs.
export const GROUPS = [
  ['general', 'General'], ['seguridad', 'Seguridad'], ['aprobaciones', 'Aprobaciones'], ['costos', 'Costos'], ['estudio', 'Estudio'], ['contenido', 'Contenido'], ['avisos', 'Avisos y Telegram'], ['conectores', 'Conectores'], ['calidad', 'Calidad'], ['equipo', 'Equipo'],
];
const DEPTS = ['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery'];
// type: text · number · bool · select · list (strings) · depts (departments) · time (HH:MM or empty) · people
export const FIELDS = [
  { path: 'name', group: 'general', type: 'text', label: 'Nombre de la empresa', max: 60 },
  { path: 'model', group: 'general', type: 'select', label: 'Modelo por defecto', options: [['sonnet', 'Sonnet (equilibrado)'], ['opus', 'Opus (más capaz)'], ['fable', 'Fable (el más capaz, el más caro)']] },
  { path: 'concurrency', group: 'general', type: 'number', label: 'Agentes trabajando a la vez', min: 1, max: 8, default: 3, help: 'Más a la vez termina antes, pero gasta el plan más rápido.' },
  { path: 'timeout', group: 'general', type: 'number', label: 'Tiempo máximo por tarea (segundos)', min: 60, max: 3600, default: 300 },
  { path: 'safety.writes', group: 'seguridad', type: 'select', label: 'Quién puede enviar, publicar o pagar', options: [['aprobar', 'Solo después de mi OK (recomendado)'], ['pedido', 'Cuando la tarea lo pide'], ['nunca', 'Nunca: los agentes solo preparan']] },
  { path: 'safety.browserSites', group: 'seguridad', type: 'list', label: 'Sitios que puede abrir el Chrome de los agentes', help: 'Vacío = cualquiera que no esté prohibido. Admite *.dominio.com.' },
  { path: 'safety.browserBlock', group: 'seguridad', type: 'list', label: 'Sitios prohibidos', help: 'Tu banco, tus redes personales…' },
  { path: 'safety.limits.perAgentDay', group: 'seguridad', type: 'number', label: 'Envíos por agente al día', min: 0, max: 1000, help: '0 = sin tope.' },
  { path: 'safety.limits.perRecipientDay', group: 'seguridad', type: 'number', label: 'Envíos a una misma dirección al día', min: 0, max: 100 },
  { path: 'approvals.undoSeconds', group: 'aprobaciones', type: 'number', label: 'Segundos para deshacer tras aprobar', min: 0, max: 300 },
  { path: 'approvals.amountLimit', group: 'aprobaciones', type: 'number', label: 'Importe que siempre pide tu OK (US$)', min: 0, max: 1e7, help: '0 = sin límite.' },
  { path: 'approvals.remindAfterHours', group: 'aprobaciones', type: 'number', label: 'Recordarme un borrador tras (horas)', min: 0, max: 720 },
  { path: 'approvals.expireAfterDays', group: 'aprobaciones', type: 'number', label: 'Un borrador caduca tras (días)', min: 0, max: 90 },
  { path: 'approvals.autonomyAfter', group: 'aprobaciones', type: 'number', label: 'Aprobaciones limpias para ofrecer autonomía a una rutina', min: 0, max: 200, help: '0 = nunca ofrecerla.' },
  { path: 'costs.monthlyBudget', group: 'costos', type: 'number', label: 'Presupuesto del mes (US$)', min: 0, max: 1e6, help: '0 = sin presupuesto.' },
  { path: 'costs.alertAt', group: 'costos', type: 'number', label: 'Avisarme al (fracción del presupuesto)', min: 0.1, max: 1, step: 0.05 },
  { path: 'costs.stopAtBudget', group: 'costos', type: 'bool', label: 'Frenar las tareas nuevas al pasar el presupuesto' },
  { path: 'costs.hourlyRate', group: 'costos', type: 'number', label: 'Lo que cuesta una hora de tu equipo (US$)', min: 0, max: 1000 },
  // V4.5 (27 Sep 2026, the owner): the Estudio's caps — they were only in office.config.json (media.*). Applied at once (media.setLimits).
  // V4.7: Contenido — which departments' agents may read the content calendar and leave DRAFTS (they never approve, schedule or publish). Applies on restart.
  { path: 'contenido.departments', group: 'contenido', type: 'depts', label: 'Departamentos cuyos agentes pueden dejar borradores', restart: true, help: 'Leen el calendario de contenido y dejan borradores que tú revisas y apruebas en Contenido (K). Ninguno aprueba, programa ni publica. Vacío = ninguno.', default: ['marketing', 'delivery'] },
  { path: 'media.dailyLimit', group: 'estudio', type: 'number', label: 'Tope de generaciones al día', min: 0, max: 10000, default: 40, help: 'Cuenta imágenes; un video cuenta como 5. Lo del motor «Prueba» no cuenta. 0 = sin tope.' },
  { path: 'media.dailyBudget', group: 'estudio', type: 'number', label: 'Gasto máximo al día en el Estudio (US$)', min: 0, max: 100000, step: 0.5, default: 0, help: 'Con el precio aproximado de cada modelo; lo que está generándose ya cuenta. Un pedido que lo pasaría no se envía. 0 = sin límite.' },
  { path: 'media.monthlyBudget', group: 'estudio', type: 'number', label: 'Gasto máximo al mes en el Estudio (US$)', min: 0, max: 1000000, step: 1, default: 0, help: 'Igual, por mes calendario. Aparte del presupuesto de la oficina (Costos), que cuenta a los agentes. 0 = sin límite.' },
  { path: 'media.maxPerRequest', group: 'estudio', type: 'number', label: 'Imágenes por pedido (máximo)', min: 1, max: 8, default: 8, help: 'Cuántas se pueden pedir de una vez. Un video va de 1 a 4.' },
  { path: 'media.concurrency', group: 'estudio', type: 'number', label: 'Trabajos del Estudio a la vez', min: 1, max: 6, default: 3, help: 'Más a la vez termina antes, pero los motores pueden pedir esperar.' },
  { path: 'telegram.quiet.from', group: 'avisos', type: 'time', label: 'No molestar desde' },
  { path: 'telegram.quiet.to', group: 'avisos', type: 'time', label: 'No molestar hasta' },
  { path: 'telegram.notify.approvals', group: 'avisos', type: 'bool', label: 'Avisar de borradores que esperan mi OK' },
  { path: 'telegram.notify.failures', group: 'avisos', type: 'bool', label: 'Avisar de tareas que fallan' },
  { path: 'telegram.notify.done', group: 'avisos', type: 'bool', label: 'Avisar de cada tarea terminada' },
  { path: 'telegram.notify.notices', group: 'avisos', type: 'bool', label: 'Avisar de los avisos de la oficina' },
  { path: 'deputy.weekly', group: 'avisos', type: 'bool', label: 'Informe semanal de Dimitri el lunes', help: 'Cómo fue la semana, qué decidir; llega a los avisos y a Telegram.' },
  { path: 'tools.web', group: 'conectores', type: 'bool', label: 'Búsqueda web para los agentes', restart: true },
  { path: 'tools.browser', group: 'conectores', type: 'bool', label: 'Tu Chrome para los agentes', restart: true },
  // Auditoría MCP (1 oct 2026, MCP-12): the names match the bar's (a plugin's «Gmail» too) and apply at once (mcp.configure on save)
  { path: 'mcp.deny', group: 'conectores', type: 'list', label: 'Conectores que los agentes no pueden usar', help: 'Nombres como salen en la barra (Gmail, Shopify…). Se aplica al instante.' },
  { path: 'mcp.allow', group: 'conectores', type: 'list', label: 'Solo estos conectores (lista blanca)', help: 'Vacío = todos los conectados. Si pones nombres, los agentes solo usan esos. Un conector que la oficina no conoce no llega a ninguna mesa hasta que lo asignas en office.config.json → mcp.departments.' },
  { path: 'quality.review.enabled', group: 'calidad', type: 'bool', label: 'Segunda opinión del jefe en lo delicado' },
  { path: 'quality.review.departments', group: 'calidad', type: 'depts', label: 'Departamentos que siempre pasan por su jefe' },
  { path: 'team.people', group: 'equipo', type: 'people', label: 'Personas del equipo', help: 'Para asignarles tareas, mencionarlas en comentarios y pasarles trabajo. El id de Telegram es opcional: si lo pones, les llegan sus avisos.' },
];
export const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
export function set(o, p, v) { const ks = p.split('.'); let x = o; for (const k of ks.slice(0, -1)) { if (typeof x[k] !== 'object' || x[k] === null || Array.isArray(x[k])) x[k] = {}; x = x[k]; } x[ks.at(-1)] = v; return o; }

/** Clean one value for its field; → { value } or { error } in plain words. */
export function clean(f, v) {
  switch (f.type) {
    case 'text': { const s = String(v ?? '').trim(); if (!s) return { error: `${f.label}: no puede quedar vacío` }; return { value: s.slice(0, f.max || 200) }; }
    case 'number': { const n = Number(v); if (!Number.isFinite(n)) return { error: `${f.label}: tiene que ser un número` }; if (n < f.min || n > f.max) return { error: `${f.label}: entre ${f.min} y ${f.max}` }; return { value: n }; }
    case 'bool': return { value: v === true || v === 'true' || v === 1 };
    case 'select': return f.options.some(([k]) => k === v) ? { value: v } : { error: `${f.label}: opción desconocida` };
    case 'time': { const s = String(v ?? '').trim(); if (s && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(s)) return { error: `${f.label}: usa HH:MM (p. ej. 21:00) o déjalo vacío` }; return { value: s }; }
    case 'list': { const l = (Array.isArray(v) ? v : String(v ?? '').split(/[\n,]/)).map(s => String(s).trim()).filter(Boolean); return { value: [...new Set(l)].slice(0, 100) }; }
    case 'depts': { const l = (Array.isArray(v) ? v : []).filter(d => DEPTS.includes(d)); return { value: [...new Set(l)] }; }
    case 'people': {
      const l = (Array.isArray(v) ? v : []).map(p => ({ name: String(p?.name || '').trim().slice(0, 40), telegram: String(p?.telegram || '').trim(), depts: Array.isArray(p?.depts) ? p.depts.filter(d => DEPTS.includes(d)) : [] })).filter(p => p.name);
      const bad = l.find(p => p.telegram && !/^-?\d{4,15}$/.test(p.telegram)); if (bad) return { error: `El id de Telegram de ${bad.name} es un número (pídeselo a @userinfobot)` };
      if (new Set(l.map(p => p.name.toLowerCase())).size !== l.length) return { error: 'Dos personas con el mismo nombre' };
      return { value: l.slice(0, 50) };
    }
  }
  return { error: 'campo desconocido' };
}
/** Apply a set of changes to the local file's object. → { local, errors, restart } */
export function apply(local, changes) {
  const out = JSON.parse(JSON.stringify(local || {})), errors = []; let restart = false;
  for (const [p, v] of Object.entries(changes || {})) {
    const f = FIELDS.find(x => x.path === p); if (!f) { errors.push(`«${p}» no se puede cambiar desde aquí`); continue; }
    const r = clean(f, v); if (r.error) { errors.push(r.error); continue; }
    set(out, p, r.value); if (f.restart) restart = true;
  }
  return { local: out, errors, restart };
}
/** Values for the form: the merged configuration, per field. */
export const values = cfg => Object.fromEntries(FIELDS.map(f => [f.path, get(cfg, f.path)]));
