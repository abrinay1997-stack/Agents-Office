// Agents Office — sistema i18n central (FASE 1, 20 Sep 2026).
//
// Estado: el idioma por defecto es ESPAÑOL LATINO NEUTRO (`es`). Los textos de
// `src/shell.html` y de los módulos visibles (`tasks.js`, `calendar.js`,
// `main.js`, `brain.js`, `mcp.js`, `when.js`, `models.js`) ya están traducidos
// DIRECTAMENTE al español en su propio archivo — el wiring completo (pasar cada
// literal por `t()`) queda para la FASE 2. Este módulo es la base documentada:
//
//   · `ES`: diccionario central inglés → español latino. Las CLAVES son los
//     textos originales en inglés; los VALORES, su traducción. Cubre al menos
//     todos los textos fijos del HUD de `src/shell.html` (topbar, rail
//     CHAT/ACTIVITY, placeholders, panel Task Status, calendario, Cerebro y
//     botones ADD / RUN NOW / PAUSE / DELETE / TODAY / WEEK / MONTH).
//   · `t(key, vars)`: devuelve el texto en el idioma activo. Fallback inglés:
//     si no hay traducción (o el idioma es `en`), devuelve la propia clave.
//     Soporta interpolación `{nombre}`.
//   · Idioma: `getLang()` / `setLang('es' | 'en')`. También se cambia con la
//     variable global `window.AO_LANG = 'en'` antes o después de cargar.
//   · El módulo se importa por efecto (`import './i18n.js'`) y se expone como
//     `window.AO.i18n`, así la fase 2 puede migrar cada literal a `t()` sin
//     tocar el arranque.
//
// FASE 2 (pendiente): migrar los literales a `t()`, prompts de `serve.mjs`,
// personas de `v1data.js`, preguntas de `onboard.mjs`, parseo de horarios en
// español en `when.js`/`parseWhen`, y contenido de ejemplo del brain.
//
// NO TOCAR (licencia PolyForm + términos Sahni.ai): la marca `sahni.ai_`, la
// línea de licencia visible, el nombre "Agents Office" ni `LICENSE`.

const ES = {
  // ---------- shell.html: topbar ----------
  '◷ CALENDAR': '◷ CALENDARIO',
  '◂ OVERVIEW': '◂ VISTA GENERAL',
  // ---------- shell.html: rail CHAT / ACTIVITY ----------
  'CHAT': 'CHAT',
  'ACTIVITY': 'ACTIVIDAD',
  'SEND': 'ENVIAR',
  // ---------- shell.html: Brain ----------
  'THE BRAIN': 'EL CEREBRO',
  'Search the Brain…': 'Buscar en el Cerebro…',
  'Esc closes · scroll zooms · drag pans · click a note to read it': 'Esc cierra · scroll acerca · arrastrar mueve · clic en una nota para leerla',
  // ---------- shell.html: calendario ----------
  'CALENDAR': 'CALENDARIO',
  'WEEK': 'SEMANA',
  'MONTH': 'MES',
  'TODAY': 'HOY',
  'Search tasks and routines…': 'Buscar tareas y rutinas…',
  'ROUTINES': 'RUTINAS',
  'Click any day to schedule a task for it, or switch on REPEAT to start a routine from that date. Click a routine here to see only its days.': 'Haz clic en un día para programar una tarea, o activa REPETIR para iniciar una rutina desde esa fecha. Haz clic en una rutina para ver solo sus días.',
  // ---------- shell.html: panel Task Status ----------
  'Type a task…': 'Escribe una tarea…',
  'REPEAT': 'REPETIR',
  'TEAM': 'EQUIPO',
  'ADD': 'AGREGAR',
  'TASK STATUS': 'ESTADO DE TAREAS',
  'WHOLE OFFICE': 'TODA LA OFICINA',
  'needs my OK': 'necesita mi visto bueno',
  'TASK FOR': 'TAREA PARA',
  'Write the task, or a whole brief…': 'Escribe la tarea, o un informe completo…',
  // ---------- panel: filtros y estados ----------
  'All': 'Todas',
  'Scheduled': 'Programadas',
  'Backlog': 'Por hacer',
  'In progress': 'En curso',
  'Waiting': 'En espera',
  'Done': 'Listas',
  // ---------- panel: botones de rutina / tarea ----------
  'RUN NOW': 'EJECUTAR AHORA',
  'PAUSE': 'PAUSAR',
  'RESUME': 'REANUDAR',
  'DELETE': 'ELIMINAR',
  'CANCEL': 'CANCELAR',
  // ---------- calendario: tarjetas y popover ----------
  'DONE': 'LISTAS',
  'ONLY THIS ROUTINE ✕': 'SOLO ESTA RUTINA ✕',
  'SCHEDULE FOR': 'PROGRAMAR PARA',
  'What should happen that day?': '¿Qué debe pasar ese día?',
  'SCHEDULED TASK': 'TAREA PROGRAMADA',
  'OPEN THE AGENT': 'ABRIR EL AGENTE',
  'CANCEL IT': 'CANCELARLA',
  'ROUTINE': 'RUTINA',
  'RUN NOW ': 'EJECUTAR AHORA ',
  'ONLY THIS': 'SOLO ESTA',
  // ---------- aprobaciones / chat ----------
  'APPROVE': 'APROBAR',
  'REJECT': 'RECHAZAR',
  'needs your approval': 'necesita tu aprobación',
  // ---------- tablero (B) ----------
  'SCHEDULED': 'PROGRAMADAS',
  'BACKLOG': 'POR HACER',
  'IN PROGRESS': 'EN CURSO',
  'WAITING ON APPROVAL': 'ESPERANDO APROBACIÓN',
  // ---------- topbar: conectores y modelos ----------
  'CONNECTED TO': 'CONECTADO A',
  'RUNS HEADLESS ON': 'OPERA CON',
  // ---------- billboards ----------
  'AGENTS': 'AGENTES',
  'KNOWLEDGE': 'CONOCIMIENTO',
  'NOTES': 'NOTAS',
  'WAITING APPROVAL': 'ESPERANDO APROBACIÓN',
};

let lang = 'es';
try {
  const w = typeof window !== 'undefined' ? window : null;
  if (w && (w.AO_LANG === 'en' || w.AO_LANG === 'es')) lang = w.AO_LANG;
} catch { /* sin window (servidor): se queda en es */ }

/** Idioma activo: 'es' (defecto) o 'en'. */
export function getLang() { return lang; }

/** Cambia el idioma ('es' | 'en') y lo refleja en `window.AO_LANG`. */
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'es';
  try { if (typeof window !== 'undefined') window.AO_LANG = lang; } catch { /* noop */ }
  return lang;
}

/**
 * Texto en el idioma activo. `key` es el original en inglés; `vars` interpola
 * `{nombre}`. Fallback inglés: sin traducción (o en `en`), devuelve la clave.
 */
export function t(key, vars) {
  let s = lang === 'es' && ES[key] !== undefined ? ES[key] : String(key);
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}

/** El diccionario (solo lectura desde fuera): útil para auditar la fase 2. */
export function dict() { return { ...ES }; }

// Registro vivo para la consola y la fase 2 (efecto: el import no se poda).
try {
  if (typeof window !== 'undefined') {
    window.AO_LANG = lang;
    window.AO = window.AO || {};
    window.AO.i18n = { t, setLang, getLang, dict };
  }
} catch { /* noop */ }
