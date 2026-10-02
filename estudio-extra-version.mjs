// ¿Van juntas la página y su paquete aparte? (1 oct 2026, carga bajo demanda del Estudio).
// dist/command-centre-v2.html viaja por GitHub para que `npm start` funcione sin construir; dist/estudio-extra.js no (dist/* está
// ignorado). Quien clonaba o traía lo último sin construir se quedaba sin banco de presets, escenario 3D ni Lotes, y «Reintentar» no
// lo arreglaba. serve.mjs usa esto para reconstruir la oficina (node build.mjs) cuando le piden el paquete y falta o es de otra
// construcción; check.mjs, para comprobar lo mismo. Sin dependencias: serve.mjs no puede cargar esbuild (es de desarrollo).

/** La versión que lleva el paquete (build-extra.mjs la escribe como `version:"<12 hex>"`), o '' si no lleva. */
export function versionDelExtra(extra) {
  return /version:"([0-9a-f]{12})"/.exec(String(extra || ''))?.[1] || '';
}

/** ¿La página pide justo este paquete? (build.mjs le graba la versión como texto: `"<12 hex>"`). Sin paquete, no. */
export function extraAlDia(pagina, extra) {
  const v = versionDelExtra(extra);
  return !!v && String(pagina || '').includes(`"${v}"`);
}
