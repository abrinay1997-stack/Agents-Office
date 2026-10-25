/* El tema de la oficina, aplicado ANTES de pintar (script síncrono en <head>, sin parpadeo). Lee lo mismo que la oficina: ao.theme = claro (por defecto) · oscuro · automático. */
(function () {
  var pref = 'light';
  try { var v = localStorage.getItem('ao.theme'); if (v === 'dark' || v === 'auto') pref = v; } catch (e) { /* sin almacenamiento: claro */ }
  var oscuro = pref === 'dark' || (pref === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-tema', oscuro ? 'dark' : 'light');
  if (pref === 'auto' && window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) { document.documentElement.setAttribute('data-tema', e.matches ? 'dark' : 'light'); });
})();
