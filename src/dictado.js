// DICTADO POR VOZ (fase 10, 25 oct 2026; pedido del dueño: «prefiero hablar antes que escribir»).
// Un micrófono que aparece junto al campo de texto donde estás escribiendo —el chat de Dimitri, el de cada jefe, «Para mí», las tareas, las notas
// y cualquier cuadro de texto largo— y escribe lo que dices. Usa la Web Speech API del navegador (Chrome, Edge, Safari): la oficina NO recibe
// el audio ni lo manda a ningún servidor propio (Chrome lo procesa con el servicio de voz de Google; la oficina solo recibe el texto, como si lo
// hubieras tecleado). Firefox no la tiene: no aparece nada.
//   · escucha hasta que se vuelve a pulsar (o Esc / Enter / salir del campo); se reenciende si el navegador la corta, con tope de cortes seguidos sin oír nada;
//   · lo que se está diciendo (provisional) se ve aparte; cada frase final entra UNA vez, en el cursor;
//   · atajo: Alt+Mayús+M (no es de «una tecla»: sigue funcionando aunque se apaguen esos atajos);
//   · accesible: aria-pressed, aria-label «Dictar», estado «Escuchando…» en una región role=status.
// Lo puro (unirDictado, insertarEn, leerResultados, crearDictado, idiomaDictado, esCampoDictable) se prueba en tests/dictado.test.mjs con un
// SpeechRecognition de mentira. La parte con DOM (`iniciarDictado`) vive en el paquete dist/dictado.js (build.mjs): la página solo lleva
// src/dictado-carga.js, que lo pide si el navegador sabe dictar. Lo trae también la oficina en la nube.

/** Cuántos reencendidos seguidos sin oír nada se toleran antes de parar. */
export const MAX_REENCENDIDOS_VACIOS = 5;
/** Una sesión que dura menos que esto sin dar ningún resultado cuenta como «se cortó enseguida». */
export const SESION_CORTA_MS = 1500;

const ERRORES = {
  'not-allowed': 'Permiso de micrófono denegado. Actívalo en los ajustes del navegador (el candado junto a la dirección).',
  'service-not-allowed': 'El navegador no permite el dictado en esta página.',
  'audio-capture': 'No se encontró micrófono. Conecta uno e inténtalo de nuevo.',
  'network': 'Error de red al procesar la voz. Revisa tu conexión.',
  'language-not-supported': 'El navegador no tiene dictado en español.',
};

/** Junta lo dictado con lo que ya hay en la caja: un espacio entre medias, nunca dos, y nada si no hay nada que añadir. Pura. */
export function unirDictado(actual, nuevo) {
  const n = String(nuevo ?? '').replace(/\s+/g, ' ').trim();
  const a = String(actual ?? '');
  if (!n) return a;
  if (!a.trim()) return n;
  return /\s$/.test(a) ? a + n : `${a} ${n}`;
}

/** Mete `nuevo` en el cursor (o en lo seleccionado), con un espacio a cada lado solo si hace falta. → { valor, caret }. Pura. */
export function insertarEn(valor, desde, hasta, nuevo) {
  const v = String(valor ?? ''), n = String(nuevo ?? '').replace(/\s+/g, ' ').trim();
  const a = Math.max(0, Math.min(Number.isInteger(desde) ? desde : v.length, v.length));
  const b = Math.max(a, Math.min(Number.isInteger(hasta) ? hasta : a, v.length));
  if (!n) return { valor: v, caret: a };
  const antes = v.slice(0, a), despues = v.slice(b);
  const pre = antes && !/\s$/.test(antes) ? ' ' : '';
  const post = despues && !/^[\s.,;:!?)\]]/.test(despues) ? ' ' : '';
  const medio = pre + n + post;
  return { valor: antes + medio + despues, caret: antes.length + pre.length + n.length + (post ? 1 : 0) };
}

/**
 * Lo nuevo de un evento `result`: las frases que se cerraron (cada una una vez) y lo provisional, que se reemplaza entero en cada evento.
 * `vistos` es el conjunto de índices finales ya entregados en ESTA sesión. Pura (salvo que apunta en `vistos`).
 */
export function leerResultados(resultados, desde, vistos) {
  const finales = [];
  let provisional = '';
  for (let i = 0; i < resultados.length; i++) {
    const r = resultados[i];
    const texto = r?.[0]?.transcript ?? '';
    if (r?.isFinal) {
      if (i >= desde && !vistos.has(i)) { vistos.add(i); finales.push(texto); }
    } else provisional += texto;
  }
  return { final: finales.join(' ').replace(/\s+/g, ' ').trim(), provisional: provisional.replace(/\s+/g, ' ').trim() };
}

/** El idioma del dictado: el elegido (ao.dictado.lang), el del navegador si es español, o español latino. */
export function idiomaDictado(navegador, guardado) {
  const ok = (l) => typeof l === 'string' && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(l);
  if (ok(guardado)) return guardado;
  return ok(navegador) && /^es\b/i.test(navegador) ? navegador : 'es-419';
}

/**
 * El dictado. `alFinal(texto)` recibe cada frase que se cierra; `alProvisional(texto)` lo que se está diciendo (vacío al cerrarse);
 * `alEstado(escuchando)`, cuándo empieza y cuándo para de verdad; `alError(mensaje)`, por qué paró.
 * → { empezar(), parar(), cortar(), get escuchando }. `SR` (el SpeechRecognition del navegador) se inyecta para poder probarlo.
 */
export function crearDictado({ SR, lang = 'es-419', alFinal, alProvisional = () => {}, alEstado = () => {}, alError = () => {}, ahora = () => Date.now() }) {
  let activo = false, rec = null, vacios = 0;

  /** Para. Con `soltar`, lo que llegue después de esta sesión se ignora (al enviar: una frase tardía aparecería sola en la caja vacía). */
  const terminar = (mensaje = '', { soltar = true } = {}) => {
    const estaba = activo;
    activo = false;
    if (rec) { const r = rec; if (soltar) rec = null; try { r.stop(); } catch { /* ya parado */ } }
    if (soltar) alProvisional('');
    if (estaba) alEstado(false);
    if (mensaje) alError(mensaje);
  };

  const sesion = () => {
    const r = new SR();
    r.lang = lang; r.continuous = true; r.interimResults = true;
    const vistos = new Set(), inicio = ahora();
    let oyo = false;
    r.onresult = (e) => {
      if (rec !== r) return;
      const { final, provisional } = leerResultados(e.results ?? [], e.resultIndex ?? 0, vistos);
      if (final) { oyo = true; vacios = 0; alFinal(final); }
      if (provisional) oyo = true;
      alProvisional(provisional);
    };
    r.onerror = (ev) => {
      if (rec !== r) return;
      if (ev?.error === 'no-speech' || ev?.error === 'aborted') return; // sin voz o cortado por el navegador: no es un error de la persona; onend lo reenciende
      terminar(ERRORES[ev?.error] ?? `Error de dictado: ${ev?.error || 'desconocido'}.`);
    };
    r.onend = () => {
      if (rec !== r) return;
      alProvisional('');
      if (!activo) { rec = null; return; }
      vacios = !oyo && ahora() - inicio < SESION_CORTA_MS ? vacios + 1 : 0;
      if (vacios >= MAX_REENCENDIDOS_VACIOS) { terminar('El dictado se detuvo: el navegador lo cortaba una y otra vez. Pulsa el micrófono para intentarlo de nuevo.'); return; }
      sesion();
    };
    rec = r;
    try { r.start(); } catch { terminar('No se pudo iniciar el dictado.'); }
  };

  return {
    empezar() { if (activo) return; activo = true; vacios = 0; alEstado(true); sesion(); },
    /** La persona pulsó parar: la frase que estaba diciendo todavía entra. */
    parar() { terminar('', { soltar: false }); },
    /** Al enviar o cambiar de campo: para y no deja entrar nada más. */
    cortar() { terminar(); },
    get escuchando() { return activo; },
  };
}

/** ¿Es un campo donde tiene sentido dictar? Texto de una línea o de varias; no contraseñas, búsquedas, números, fechas ni lo de solo lectura. */
export function esCampoDictable(el) {
  if (!el || !el.tagName) return false;
  if (el.tagName === 'INPUT') { const ty = (el.getAttribute('type') || 'text').toLowerCase(); if (ty !== 'text') return false; } else if (el.tagName !== 'TEXTAREA') return false;
  if (el.readOnly || el.disabled) return false;
  if (el.closest?.('[data-no-dictar]')) return false;
  if (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-autocomplete')) return false;
  const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
  if (/^(username|email|tel|one-time-code|cc-|current-password|new-password)/.test(ac)) return false;
  return true;
}

const ICONO = '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const CSS = `.ao-dic{position:fixed;z-index:140;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--hairline,rgba(21,20,20,.25));background:var(--cream,#FDFFF8);color:var(--ink,#151414);cursor:pointer;padding:0;font:inherit;box-shadow:0 1px 4px rgba(0,0,0,.12)}
.ao-dic[hidden],.ao-dic-est[hidden]{display:none}
.ao-dic:hover{border-color:var(--ink,#151414)}
.ao-dic:focus-visible{outline:2px solid var(--focus,#2B6BEB);outline-offset:2px}
.ao-dic[aria-pressed="true"]{background:#B3261E;border-color:#B3261E;color:#fff}
.ao-dic[aria-pressed="true"]::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid #B3261E;opacity:.5;animation:aodic 1.4s ease-out infinite}
@keyframes aodic{from{transform:scale(.85);opacity:.6}to{transform:scale(1.25);opacity:0}}
@media (prefers-reduced-motion:reduce){.ao-dic[aria-pressed="true"]::after{animation:none}}
.ao-dic-est{position:fixed;z-index:140;max-width:min(92vw,420px);padding:6px 12px;border-radius:12px;background:var(--ink,#151414);color:var(--cream,#FDFFF8);font:13px/1.35 var(--ui,system-ui,sans-serif);box-shadow:0 4px 16px rgba(0,0,0,.25);pointer-events:none}
.ao-dic-est i{font-style:normal;opacity:.75}
.ao-dic-est.mal{background:#B3261E;color:#fff}`;

/**
 * Pone el micrófono en la página. `SR`, `doc` y `win` se inyectan en las pruebas. → { destruir() } o null (si el navegador no sabe dictar).
 * El botón y su estado llevan `data-modal-keep`: si el campo está en una ventana modal, no quedan inertes.
 */
export function iniciarDictado({ SR, doc = document, win = window } = {}) {
  SR = SR || win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!SR || doc.getElementById('aoDictado')) return null;
  const estilo = doc.createElement('style'); estilo.setAttribute('data-ao-dictado', ''); estilo.textContent = CSS; doc.head.appendChild(estilo);
  const btn = doc.createElement('button');
  btn.id = 'aoDictado'; btn.type = 'button'; btn.className = 'ao-dic'; btn.hidden = true; btn.setAttribute('data-modal-keep', '');
  btn.setAttribute('aria-label', 'Dictar'); btn.setAttribute('aria-pressed', 'false'); btn.innerHTML = ICONO;
  const AYUDA = 'Dictar con el micrófono (Alt+Mayús+M). El navegador procesa la voz; la oficina solo recibe el texto.';
  btn.title = AYUDA;
  const est = doc.createElement('div');
  est.id = 'aoDictadoEstado'; est.className = 'ao-dic-est'; est.hidden = true; est.setAttribute('role', 'status'); est.setAttribute('aria-live', 'polite'); est.setAttribute('data-modal-keep', '');
  doc.body.append(btn, est);

  let campo = null, padOriginal = null, dic = null, idioma = 'es-419';
  try { idioma = idiomaDictado(win.navigator?.language, win.localStorage?.getItem('ao.dictado.lang')); } catch { idioma = idiomaDictado(win.navigator?.language); }

  const soltarPad = () => { if (campo && padOriginal !== null) { campo.style.paddingRight = padOriginal; padOriginal = null; } };
  function colocar() {
    if (!campo || !campo.isConnected) return ocultar();
    const r = campo.getBoundingClientRect();
    if (r.width < 90 || r.height < 24 || r.bottom < 0 || r.top > win.innerHeight) return ocultar();
    const alto = r.height, multilinea = campo.tagName === 'TEXTAREA' && alto > 56;
    const x = Math.min(r.right - 34, win.innerWidth - 36), y = multilinea ? r.bottom - 34 : r.top + (alto - 30) / 2;
    btn.style.left = Math.max(2, x) + 'px'; btn.style.top = Math.max(2, y) + 'px';
    // si hay un contenedor con transform/backdrop-filter, `fixed` se mide contra él: se corrige con lo que quedó
    const b = btn.getBoundingClientRect(); if (Math.abs(b.left - x) > 1 || Math.abs(b.top - y) > 1) { btn.style.left = Math.max(2, x - (b.left - x)) + 'px'; btn.style.top = Math.max(2, y - (b.top - y)) + 'px'; }
    colocarEstado();
  }
  function colocarEstado() {
    if (est.hidden || !campo) return;
    const r = campo.getBoundingClientRect(), e = est.getBoundingClientRect();
    est.style.left = Math.max(8, Math.min(r.left, win.innerWidth - e.width - 8)) + 'px';
    est.style.top = Math.max(8, r.top - e.height - 6) + 'px';
  }
  function mostrar(el) {
    if (campo !== el) { if (dic?.escuchando) dic.cortar(); soltarPad(); campo = el; }
    if (padOriginal === null) { padOriginal = el.style.paddingRight; const p = parseFloat(win.getComputedStyle(el).paddingRight) || 0; el.style.paddingRight = (p + 34) + 'px'; }
    btn.hidden = false; colocar();
  }
  function ocultar() { if (dic?.escuchando) dic.cortar(); btn.hidden = true; est.hidden = true; soltarPad(); campo = null; }
  function decir(texto, mal) {
    est.textContent = ''; est.classList.toggle('mal', !!mal);
    if (!texto) { est.hidden = true; return; }
    est.append(doc.createTextNode(texto)); est.hidden = false; colocarEstado();
  }

  function aplicarFinal(texto) {
    if (!campo) return;
    const a = campo.selectionStart, b = campo.selectionEnd;
    const r = insertarEn(campo.value, a, b, texto);
    campo.value = r.valor;
    try { campo.setSelectionRange(r.caret, r.caret); } catch { /* algunos tipos no admiten selección */ }
    campo.dispatchEvent(new win.Event('input', { bubbles: true }));
  }
  function provisional(t) {
    if (dic?.escuchando) decir(t ? `Escuchando… ${t}` : 'Escuchando… habla ahora. Pulsa el micrófono para parar.');
  }
  dic = crearDictado({
    SR, lang: idioma,
    alFinal: aplicarFinal, alProvisional: provisional,
    alEstado: (on) => {
      btn.setAttribute('aria-pressed', String(on)); btn.setAttribute('aria-label', on ? 'Parar el dictado' : 'Dictar');
      btn.title = on ? 'Parar el dictado (Alt+Mayús+M)' : AYUDA;
      if (on) decir('Escuchando… habla ahora. Pulsa el micrófono para parar.'); else if (!est.classList.contains('mal')) decir('');
    },
    alError: (m) => { decir(m, true); win.setTimeout(() => { if (est.classList.contains('mal')) decir(''); }, 7000); },
  });

  function alternar() {
    if (!campo) return;
    if (dic.escuchando) { dic.parar(); campo.focus?.(); return; }
    est.classList.remove('mal'); dic.empezar(); campo.focus?.();
  }
  // El botón no le quita el foco al campo (si no, el cursor se pierde y el campo se oculta al salir).
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', alternar);

  const alEnfocar = (e) => { const el = e.target; if (el === btn) return; if (esCampoDictable(el)) mostrar(el); else if (!btn.contains(el)) { if (campo) ocultar(); } };
  const alSalir = (e) => { if (e.target === campo && e.relatedTarget !== btn) win.setTimeout(() => { if (doc.activeElement !== campo) ocultar(); }, 120); };
  doc.addEventListener('focusin', alEnfocar, true);
  doc.addEventListener('focusout', alSalir, true);
  doc.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyM' || e.key === 'M' || e.key === 'm')) {
      const el = doc.activeElement;
      if (esCampoDictable(el)) { e.preventDefault(); e.stopPropagation(); if (campo !== el) mostrar(el); alternar(); }
      return;
    }
    if (!dic.escuchando) return;
    if (e.key === 'Escape') { dic.cortar(); return; } // Esc para el dictado (la ventana, si hay una, sigue su camino)
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) dic.cortar(); // se va a enviar: lo que quedaba por decir no entra
  }, true);
  doc.addEventListener('submit', () => { if (dic.escuchando) dic.cortar(); }, true);
  const reponer = () => { if (campo && !btn.hidden) colocar(); };
  win.addEventListener('resize', reponer); win.addEventListener('scroll', reponer, true);
  const reloj = win.setInterval(reponer, 600); // el campo se mueve con animaciones (paneles que se deslizan)
  win.addEventListener('pagehide', () => dic.cortar());

  return { destruir() { win.clearInterval(reloj); dic.cortar(); doc.removeEventListener('focusin', alEnfocar, true); doc.removeEventListener('focusout', alSalir, true); btn.remove(); est.remove(); estilo.remove(); soltarPad(); }, dictado: dic };
}
