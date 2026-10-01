// Agents Office — el Estudio: lo que los módulos de media/ comparten (F0 del banco de presets, 1 oct 2026).
// Un solo objeto, para que configure() (en la fachada media.mjs) cambie la configuración y el catálogo, los motores y los
// trabajos la lean al momento: S.cfg = office.config.json → "media" con sus valores por defecto (dailyLimit, maxPerRequest,
// concurrency, dailyBudget, monthlyBudget, models, default, custom). setLimits() (Ajustes → Estudio) la cambia en caliente.
export const S = { cfg: { dailyLimit: 40, maxPerRequest: 8, models: {} } };
