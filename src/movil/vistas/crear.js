// Versión móvil (25 oct 2026) — CREAR PUBLICACIÓN, a pantalla completa y por pasos: ① Dónde (redes con sus iconos reales, la cuenta y el formato
// de cada una) ② Qué (el texto, con lo que cabe en cada red) ③ Medios (de la galería del teléfono, de la cámara o de la galería del Estudio)
// ④ Cuándo (día y hora con las mejores horas, la vista previa por red y el semáforo de problemas). Se puede crear una publicación completa
// en 7 toques (8 si se aprueba). NO duplica reglas ni el guardado: las reglas son contenido-reglas.js (`revisarPublicacion`, `textoPara`,
// `FORMATOS_RED`…), la hora buena es contenido-hora.js y lo que se guarda y se aprueba lo decide el servidor (/api/contenido/piezas): GUARDAR NO
// APRUEBA, aprobar es solo del dueño y siempre pasa por la hoja «¿Aprobar y programar?». Es el mismo recorrido de la ventana de escritorio
// (docs/diseno-crear-publicacion.md) con un paso a la vez.
import { FORMATOS_RED, formatoDe, nombreFormato, ponFormato, formatosConRedes, postDePieza, revisarPublicacion, textoPara, longitudPara, LIMITES } from '../../contenido-reglas.js';
import { mejoresDelDia, siguienteBuena } from '../../contenido-hora.js';
import { diasRapidos } from '../../contenido-cola.js';
import { HORAS_RAPIDAS } from '../../pieza-base.js';
import { esc, svg, esqueleto } from '../ui.js';
import { iconoRed, miniatura, con, mediaUrl, subirArchivo, aprobarPieza, hoyYmd, sumaDias, diaTexto, diaLargo, resumenSalida, motivo, NOMBRE_RED } from './d-comun.js';

const PASOS = [['dónde', 'Dónde'], ['qué', 'Qué'], ['medios', 'Medios'], ['cuándo', 'Cuándo']];
const PRINCIPALES = ['instagram', 'facebook'];
const TODAS = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x', 'threads', 'bluesky', 'pinterest'];
const vacia = (fecha = '') => ({ id: null, titulo: '', texto: '', hashtags: '', hashtagsEnComentario: false, redes: [], formato: 'post', formatos: {}, medios: [], fecha, hora: '', cuentas: {}, estado: 'borrador', aprobada: null });
const VISTO_EN = { instagram: 125, facebook: 480, linkedin: 210, threads: 500, x: 280, bluesky: 300, tiktok: 150, youtube: 100, pinterest: 100 };

export function registrar(shell) {
  shell.registrarVista({
    id: 'crear', titulo: 'Crear publicación', icono: 'mas1', grupo: 'oculta',
    montar(el, ctx) {
      const S = { p: vacia(), paso: 0, ajustes: {}, cuentas: [], porDefecto: {}, grid: null, galeria: [], itemsGal: new Map(), cargando: true, rev: null, guardado: null, sucio: false, previa: '', otras: [], masRedes: false, subiendo: false, idEnv: 0 };
      el.innerHTML = `<ol class="md-pasos" aria-label="Pasos de la publicación"></ol>
        <div class="mv-scroll" data-sc><div class="mv-cuerpo md-paso" aria-live="polite"></div></div>
        <div class="md-pie"></div>`;
      const pasos = el.querySelector('.md-pasos'), cuerpo = el.querySelector('.md-paso'), sc = el.querySelector('[data-sc]'), pie = el.querySelector('.md-pie');

      // ------------------------------------------------------------ carga
      async function iniciar(params = {}) {
        Object.assign(S, { editando: !!params.id, p: vacia(params.fecha || ''), paso: 0, rev: null, guardado: null, sucio: false, previa: '', cargando: true, masRedes: false });
        pintar();
        const [lista, cu, gal] = await Promise.allSettled([ctx.api(`/api/contenido?desde=${sumaDias(hoyYmd(), -1)}&hasta=${sumaDias(hoyYmd(), 60)}`), ctx.api('/api/contenido/cuentas'), ctx.api('/api/media?n=48')]);
        if (lista.status === 'fulfilled') { S.ajustes = lista.value.ajustes || {}; S.otras = lista.value.piezas || []; }
        if (cu.status === 'fulfilled') { S.cuentas = cu.value.cuentas || []; S.porDefecto = cu.value.porDefecto || {}; }
        if (gal.status === 'fulfilled') { S.galeria = (gal.value.items || []).filter(i => i.kind === 'image' || i.kind === 'video').slice(0, 24); for (const i of S.galeria) S.itemsGal.set(i.file, i); }
        const redesDef = (S.ajustes.redes && S.ajustes.redes.length ? S.ajustes.redes : PRINCIPALES).slice(0, 4);
        if (params.id) {
          try { const r = await ctx.api(`/api/contenido/piezas/${encodeURIComponent(params.id)}`); S.p = { ...vacia(), ...r.pieza }; S.guardado = r.pieza; S.rev = r.pieza.revision || null; await horaBuena(''); }
          catch (e) { ctx.toast(motivo(e)); ctx.volver(); return; }
        } else {
          S.p.redes = redesDef; Object.assign(S.p, formatosConRedes(S.p, S.p.redes));
          const g = await horaBuena(S.p.fecha); S.p.fecha = g.fecha; S.p.hora = g.hora;
        }
        S.cargando = false; pintar();
      }
      async function horaBuena(fecha) {
        const rs = S.p.redes.length ? S.p.redes : ['instagram'];
        try { const r = await ctx.api(`/api/contenido/mejor-hora?redes=${rs.join(',')}`); S.grid = r.grid || null; } catch { S.grid = null; }
        const ocupadas = S.otras.filter(o => o.fecha && o.hora && o.id !== S.p.id).map(o => new Date(`${o.fecha}T${o.hora}:00`).getTime());
        const ahora = Date.now();
        if (fecha) { const m = mejoresDelDia(S.grid, fecha, 1)[0]; let h = m?.hora || '18:00'; if (fecha === hoyYmd() && new Date(`${fecha}T${h}:00`).getTime() < ahora + 15 * 60e3) return { fecha: sumaDias(fecha, 1), hora: h }; return { fecha, hora: h }; }
        const s = S.grid ? siguienteBuena(S.grid, { ahora, ocupadas }) : null;
        return s ? { fecha: s.fecha, hora: s.hora } : { fecha: sumaDias(hoyYmd(), 1), hora: '18:00' };
      }

      // ------------------------------------------------------------ revisión (las reglas son las de contenido-reglas.js)
      const medidas = () => Object.fromEntries((S.p.medios || []).map(m => [m, (() => { const i = S.itemsGal.get(m); return i && i.w ? { ancho: i.w, alto: i.h } : S.guardado?.medidas?.[m] || {}; })()]));
      function revisar() {
        try { const r = revisarPublicacion(postDePieza({ ...S.p, medidas: { ...(S.guardado?.medidas || {}), ...medidas() } }), S.p.redes.length ? S.p.redes : ['instagram']); const problemas = [...r.errores]; if (!S.p.fecha) problemas.push('Elige el día en que sale.'); if (S.p.fecha && !S.p.hora) problemas.push('Ponle una hora para poder aprobarla.'); return { errores: problemas, avisos: r.avisos }; }
        catch { return { errores: [], avisos: [] }; }
      }
      const rev = () => (S.rev && !S.sucio ? S.rev : revisar());

      // ------------------------------------------------------------ guardar (nunca aprueba)
      function cuerpoGuardar() {
        const p = S.p; return { titulo: p.titulo, texto: p.texto, hashtags: p.hashtags, hashtagsEnComentario: !!p.hashtagsEnComentario, redes: p.redes, formato: p.formato, formatos: p.formatos, medios: p.medios, fecha: p.fecha, hora: p.hora, cuentas: p.cuentas };
      }
      async function guardar() {
        const b = cuerpoGuardar();
        const r = S.p.id ? await ctx.api(`/api/contenido/piezas/${encodeURIComponent(S.p.id)}`, { method: 'PATCH', body: b }) : await ctx.api('/api/contenido/piezas', { method: 'POST', body: { ...b, estado: 'borrador' } });
        S.p = { ...S.p, id: r.pieza.id, estado: r.pieza.estado, aprobada: r.pieza.aprobada }; S.guardado = r.pieza; S.rev = r.pieza.revision || null; S.sucio = false;
        return r.pieza;
      }
      const vacioTotal = () => !S.p.texto.trim() && !S.p.titulo.trim() && !S.p.medios.length;

      // ------------------------------------------------------------ pasos
      const cuentaDe = red => { const id = S.p.cuentas?.[red] || S.porDefecto?.[red] || ''; return S.cuentas.find(c => c.id === id) || null; };
      const nombreCuenta = c => (c ? (c.usuario ? '@' + c.usuario : c.nombre) : '');
      function pasoDonde() {
        const visibles = S.masRedes ? TODAS : [...new Set([...PRINCIPALES, ...S.p.redes])];
        const aviso = S.p.estado === 'aprobada' ? '<p class="md-aviso">Está aprobada: si cambias lo que sale, pierde el OK y la vuelves a aprobar.</p>' : '';
        return `${aviso}<h2 class="md-q">¿Dónde la publicas?</h2><div class="md-redes-l">${visibles.map(r => {
          const on = S.p.redes.includes(r), c = cuentaDe(r), ops = FORMATOS_RED[r] || ['post'], cs = S.cuentas.filter(x => x.red === r);
          return `<div class="md-red${on ? ' on' : ''}"><button type="button" class="md-red-b" data-red="${r}" aria-pressed="${on}"><span class="md-red-i">${iconoRed(r, { tam: 26 })}</span><span class="md-red-t"><b>${esc(NOMBRE_RED[r])}</b><small>${on ? (c ? esc(nombreCuenta(c)) : esc(nombreFormato(r, formatoDe(S.p, r)))) : 'Toca para añadirla'}</small></span><span class="md-tick" aria-hidden="true">${on ? '✓' : ''}</span></button>
            ${on ? `<div class="md-red-d">${ops.length > 1 ? `<div class="mv-pastillas" role="group" aria-label="Formato en ${esc(NOMBRE_RED[r])}">${ops.map(f => `<button type="button" class="mv-chip" data-fmt="${r}|${f}" aria-pressed="${formatoDe(S.p, r) === f}">${esc(nombreFormato(r, f))}</button>`).join('')}</div>` : `<p class="mv-meta">Sale como ${esc(nombreFormato(r, ops[0]))}.</p>`}
              ${cs.length > 1 ? `<label class="mv-lab" for="mdC-${r}">¿En qué cuenta de ${esc(NOMBRE_RED[r])}?</label><select id="mdC-${r}" data-cuenta="${r}">${cs.map(x => `<option value="${esc(x.id)}"${x.id === (c && c.id) ? ' selected' : ''}${x.puedePublicar === false ? ' disabled' : ''}>${esc(nombreCuenta(x))}${x.puedePublicar === false ? ' — no puede publicar' : ''}</option>`).join('')}</select>` : ''}</div>` : ''}</div>`;
        }).join('')}</div>${S.masRedes ? '' : '<button type="button" class="mv-link" data-mas-redes>Más redes (LinkedIn, TikTok, X…)</button>'}`;
      }
      function pasoQue() {
        const rs = S.p.redes, cont = r => { const n = longitudPara(textoPara({ descripcion: S.p.texto, hashtagsFinales: S.p.hashtags, hashtagsEnComentario: S.p.hashtagsEnComentario }, r), r), max = LIMITES[r]?.caracteres; return { r, n, max }; };
        return `<h2 class="md-q">¿Qué dice?</h2>
          <label class="mv-lab" for="mdTexto">Texto de la publicación</label>
          <textarea id="mdTexto" class="mv-campo" rows="7" data-campo="texto" placeholder="Escribe lo que va debajo de la imagen…" autocomplete="off">${esc(S.p.texto)}</textarea>
          <div class="md-conts" data-conts aria-live="polite">${rs.map(r => { const c = cont(r); return `<span class="md-cont${c.max && c.n > c.max ? ' mal' : ''}" data-cont="${r}">${iconoRed(r, { tam: 14 })} ${c.n}${c.max ? ' / ' + c.max : ''}</span>`; }).join('')}</div>
          <button type="button" class="mv-btn md-ancho" data-mejorar>✨ Mejorar con Marketing</button>
          <label class="mv-lab" for="mdHash">Hashtags</label><input id="mdHash" type="text" class="mv-campo" data-campo="hashtags" value="${esc(S.p.hashtags)}" placeholder="#negocio #panamá" autocapitalize="none" autocomplete="off">
          ${rs.includes('instagram') ? `<label class="md-sw-l"><input type="checkbox" aria-label="Poner los hashtags en el primer comentario" data-campo="hashtagsEnComentario"${S.p.hashtagsEnComentario ? ' checked' : ''}><span>Poner los hashtags en el primer comentario (Instagram)</span></label>` : ''}
          <label class="mv-lab" for="mdTit">Título interno (solo para ti, no se publica)</label><input id="mdTit" type="text" class="mv-campo" data-campo="titulo" value="${esc(S.p.titulo)}" placeholder="Para encontrarla después" autocomplete="off">`;
      }
      function pasoMedios() {
        const sel = S.p.medios, libres = S.galeria.filter(i => !sel.includes(i.file)).slice(0, 12);
        return `<h2 class="md-q">¿Con qué imagen o video?</h2>
          <div class="md-acciones"><button type="button" class="mv-btn" data-subir="archivo">${svg('mas1')}<span>Del teléfono</span></button><button type="button" class="mv-btn" data-subir="camara">${svg('estudio')}<span>Tomar foto</span></button></div>
          <input type="file" data-file="archivo" accept="image/*,video/*" multiple hidden><input type="file" data-file="camara" accept="image/*" capture="environment" hidden>
          ${S.subiendo ? '<p class="md-aviso info" role="status">Subiendo a tu galería…</p>' : ''}
          ${sel.length ? `<h3 class="mv-gh">En esta publicación <span>${sel.length}</span></h3><ul class="md-sel">${sel.map((m, i) => `<li>${miniatura(m, { clase: 'md-mini grande' })}<span class="md-sel-b"><button type="button" class="mv-ic" data-mov="${i}|-1" aria-label="Mover antes"${i === 0 ? ' disabled' : ''}>${svg('izq')}</button><button type="button" class="mv-ic" data-mov="${i}|1" aria-label="Mover después"${i === sel.length - 1 ? ' disabled' : ''}>${svg('der')}</button><button type="button" class="mv-ic" data-quitar="${i}" aria-label="Quitar">${svg('cerrar')}</button></span></li>`).join('')}</ul>` : ''}
          <h3 class="mv-gh">De la galería del Estudio</h3>
          ${libres.length ? `<div class="md-gal" role="group" aria-label="Galería del Estudio">${libres.map(i => `<button type="button" class="md-gal-b" data-gal="${esc(i.file)}" aria-label="Usar ${esc(i.prompt || i.file)}">${miniatura(i.file, { clase: 'md-mini fill' })}</button>`).join('')}</div><button type="button" class="mv-link" data-gal-todas>Ver toda la galería</button>` : '<p class="mv-nada">Todavía no hay nada en la galería del Estudio. Sube una foto con los botones de arriba.</p>'}`;
      }
      function pasoCuando() {
        const p = S.p, r = rev(), dias = diasRapidos(p.redes, S.otras, { excluir: p.id || '', dias: 7 });
        const mejores = mejoresDelDia(S.grid, p.fecha, 3).map(x => x.hora), horas = [...new Set([...mejores, ...HORAS_RAPIDAS])].sort();
        const reds = p.redes.length ? p.redes : ['instagram'];
        const verde = !r.errores.length;
        return `<h2 class="md-q">¿Cuándo sale?</h2>
          <p class="md-cuando"><b>${p.fecha ? esc(diaLargo(p.fecha)) : 'Sin día'}${p.hora ? ' · ' + esc(p.hora) : ''}</b><small>Hora de esta oficina${S.ajustes.zona ? ' (' + esc([S.ajustes.zona.nombre, S.ajustes.zona.utc].filter(Boolean).join(' · ')) + ')' : ''}</small></p>
          <div class="mv-chips md-chips-p" role="group" aria-label="Día">${dias.map(d => `<button type="button" class="mv-chip" data-dia="${d.fecha}" aria-pressed="${p.fecha === d.fecha}">${esc(d.corto)}${d.n ? `<b>${d.n}</b>` : ''}</button>`).join('')}</div>
          <label class="mv-lab" for="mdFecha">Otro día</label><input id="mdFecha" type="date" class="mv-campo" data-campo="fecha" value="${esc(p.fecha)}" min="${hoyYmd()}">
          <div class="mv-chips md-chips-p" role="group" aria-label="Hora">${horas.map(h => `<button type="button" class="mv-chip" data-hora="${h}" aria-pressed="${p.hora === h}">${h}${mejores.includes(h) ? ' ★' : ''}</button>`).join('')}</div>
          ${mejores.length ? `<p class="mv-meta">★ Las horas con mejores resultados ese día${S.grid ? '' : ''}.</p>` : ''}
          <label class="mv-lab" for="mdHora">Otra hora</label><input id="mdHora" type="time" class="mv-campo" data-campo="hora" value="${esc(p.hora)}">
          <h3 class="mv-gh">Cómo se verá</h3>
          <div class="mv-chips md-chips-p" role="group" aria-label="Red de la vista previa">${reds.map(x => `<button type="button" class="mv-chip" data-prev="${x}" aria-pressed="${(S.previa || reds[0]) === x}">${iconoRed(x, { tam: 16 })} ${esc(NOMBRE_RED[x])}</button>`).join('')}</div>
          ${previaHTML(S.previa && reds.includes(S.previa) ? S.previa : reds[0])}
          <h3 class="mv-gh">Revisión</h3>
          <div class="md-semaforo ${verde ? (r.avisos.length ? 'amb' : 'ver') : 'rojo'}" role="status"><span class="md-luz" aria-hidden="true"></span><b>${verde ? (r.avisos.length ? `Puede salir (${r.avisos.length} ${r.avisos.length === 1 ? 'aviso' : 'avisos'})` : 'Lista para aprobar') : `${r.errores.length} ${r.errores.length === 1 ? 'problema' : 'problemas'} por arreglar`}</b></div>
          ${r.errores.length ? `<ul class="md-prob">${r.errores.map(t => `<li class="mal"><span>${esc(t)}</span><button type="button" class="mv-link" data-ir-paso="${pasoDe(t)}">Arreglar</button></li>`).join('')}</ul>` : ''}
          ${r.avisos.length ? `<ul class="md-prob">${r.avisos.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
          <p class="mv-meta">Guardar no la aprueba. Al aprobar te pido confirmación; nada sale antes de su hora.</p>`;
      }
      const pasoDe = t => /hora|día|fecha|cuándo|pasó/i.test(t) ? 3 : /imagen|video|archivo|medio|proporci|carrusel|reel|historia|jpeg|portada|resoluci|duraci|foto/i.test(t) ? 2 : /texto|caracter|hashtag|letras|menci|descripci|título|enlace/i.test(t) ? 1 : 0;

      function previaHTML(red) {
        const p = S.p, post = postDePieza({ ...p, medidas: medidas() }), texto = textoPara(post, red), f = formatoDe(p, red), vertical = f === 'reel' || f === 'historia', corte = VISTO_EN[red] || 140;
        const m0 = p.medios[0], c = cuentaDe(red), max = LIMITES[red]?.caracteres, n = longitudPara(texto, red);
        const corto = texto.length > corte ? texto.slice(0, corte).trimEnd() + '… <i>más</i>' : esc(texto);
        return `<article class="md-prev" aria-label="Vista previa en ${esc(NOMBRE_RED[red])}"><header>${iconoRed(red, { tam: 22 })}<span><b>${esc(nombreCuenta(c) || NOMBRE_RED[red])}</b><small>${esc(nombreFormato(red, f))} · Ahora</small></span></header>
          ${m0 ? `<div class="md-prev-m ${vertical ? 'v' : 'c'}">${miniatura(m0, { clase: 'md-mini fill' })}${p.medios.length > 1 ? `<i class="md-prev-n">1/${p.medios.length}</i>` : ''}</div>` : '<div class="md-prev-m sin">Sin imagen ni video todavía</div>'}
          <p class="md-prev-t">${f === 'historia' ? '<i>Una historia no muestra el texto: va dentro de la imagen.</i>' : (texto ? corto : '<i>Sin texto todavía</i>')}</p>
          ${max ? `<footer class="${n > max ? 'mal' : ''}">${n} / ${max} caracteres</footer>` : ''}</article>`;
      }

      // ------------------------------------------------------------ pintar
      function pintar() {
        pasos.innerHTML = PASOS.map(([k, n], i) => `<li><button type="button" data-paso="${i}" aria-current="${i === S.paso ? 'step' : 'false'}" aria-label="Paso ${i + 1}: ${n}"><b>${i < S.paso ? '✓' : i + 1}</b><span>${n}</span></button></li>`).join('');
        if (S.cargando) { cuerpo.innerHTML = esqueleto(4); pie.hidden = true; return; }
        pie.hidden = false;
        cuerpo.innerHTML = [pasoDonde, pasoQue, pasoMedios, pasoCuando][S.paso]();
        pintarPie();
        sc.scrollTop = 0;
        ctx.cabecera({ titulo: S.editando ? 'Editar publicación' : 'Crear publicación' });
      }
      // el pie: Atrás · Siguiente, y en el último paso lo que decide: Guardar borrador · Aprobar y programar (siempre a la vista, sin bajar la pantalla)
      function pintarPie() {
        if (S.paso < 3) { pie.className = 'md-pie'; pie.innerHTML = `${S.paso ? '<button type="button" class="mv-btn" data-ir="-1">Atrás</button>' : ''}<span class="md-pie-n" aria-hidden="true">Paso ${S.paso + 1} de 4</span><button type="button" class="mv-btn primario" data-ir="1">Siguiente</button>`; return; }
        const ok = !rev().errores.length;
        pie.className = 'md-pie fin'; pie.innerHTML = `<button type="button" class="mv-btn md-pie-atras" data-ir="-1" aria-label="Paso anterior">${svg('izq')}</button><button type="button" class="mv-btn" data-guardar>Guardar borrador</button><button type="button" class="mv-btn primario" data-aprobar${ok ? '' : ' aria-disabled="true"'}>Aprobar y programar</button>`;
      }
      async function ir(n) {
        n = Math.max(0, Math.min(3, n));
        if (n === 3 && S.paso !== 3 && !vacioTotal()) { try { await guardar(); } catch (e) { ctx.toast('No pude guardar todavía: ' + motivo(e)); } }
        if (n === 1 && S.p.redes.length === 0) { ctx.toast('Elige al menos una red.'); return; }
        S.paso = n; pintar();
      }

      // ------------------------------------------------------------ eventos
      el.addEventListener('input', e => {
        const t = e.target; const c = t.dataset?.campo; if (!c) return;
        S.p[c] = t.type === 'checkbox' ? t.checked : t.value; S.sucio = true;
        if (c === 'texto' || c === 'hashtags' || c === 'hashtagsEnComentario') { const w = cuerpo.querySelector('[data-conts]'); if (w) w.innerHTML = S.p.redes.map(r => { const n = longitudPara(textoPara({ descripcion: S.p.texto, hashtagsFinales: S.p.hashtags, hashtagsEnComentario: S.p.hashtagsEnComentario }, r), r), max = LIMITES[r]?.caracteres; return `<span class="md-cont${max && n > max ? ' mal' : ''}">${iconoRed(r, { tam: 14 })} ${n}${max ? ' / ' + max : ''}</span>`; }).join(''); }
        if (c === 'fecha' || c === 'hora') { /* se repinta al salir del campo */ }
      });
      el.addEventListener('change', e => {
        const t = e.target;
        if (t.dataset?.campo === 'fecha' || t.dataset?.campo === 'hora') { S.sucio = true; pintar(); return; }
        if (t.dataset?.cuenta) { S.p.cuentas = { ...S.p.cuentas, [t.dataset.cuenta]: t.value }; S.sucio = true; pintar(); return; }
        if (t.dataset?.file) { subir(t); }
      });
      async function subir(input) {
        const files = [...input.files]; input.value = ''; if (!files.length) return;
        S.subiendo = true; pintar();
        let n = 0;
        for (const f of files.slice(0, 10)) {
          try { const it = await subirArchivo(ctx.api, f); S.itemsGal.set(it.file, it); S.p.medios = [...S.p.medios, it.file]; n++; S.sucio = true; }
          catch (err) { ctx.toast(`${f.name || 'El archivo'}: ${motivo(err)}`); }
        }
        S.subiendo = false; if (n) S.p = { ...S.p, ...autoFormato() }; pintar(); if (n) ctx.toast(n === 1 ? 'Subida y añadida.' : `${n} archivos añadidos.`);
      }
      // varias imágenes en Instagram → carrusel; un video → reel (solo si el dueño no eligió otro formato a mano)
      function autoFormato() {
        if (S.p.redes.length === 0 || S.p.formato === 'historia') return {};
        const vids = S.p.medios.filter(m => S.itemsGal.get(m)?.kind === 'video' || /\.(mp4|webm|mov)$/i.test(m));
        if (S.p.medios.length > 1 && !vids.length && S.p.formato === 'post' && (FORMATOS_RED.instagram || []).includes('carrusel') && S.p.redes.includes('instagram')) return ponFormato(S.p, 'instagram', 'carrusel', S.p.redes);
        if (S.p.medios.length === 1 && vids.length && S.p.formato === 'post' && S.p.redes.includes('instagram')) return ponFormato(S.p, 'instagram', 'reel', S.p.redes);
        return {};
      }
      function galeriaCompleta() {
        const h = ctx.hoja({ titulo: 'Galería del Estudio', lleno: true, alCerrar: () => { Object.assign(S.p, autoFormato()); pintar(); }, cuerpo: '<div class="md-gal grande" data-g role="group" aria-label="Galería del Estudio">Cargando…</div>' });
        ctx.api('/api/media?n=120').then(r => {
          const its = (r.items || []).filter(i => i.kind === 'image' || i.kind === 'video'); for (const i of its) S.itemsGal.set(i.file, i);
          const g = h.cuerpo.querySelector('[data-g]'); g.innerHTML = its.length ? its.map(i => `<button type="button" class="md-gal-b" data-gal="${esc(i.file)}" aria-pressed="${S.p.medios.includes(i.file)}" aria-label="${esc(i.prompt || i.file)}">${miniatura(i.file, { clase: 'md-mini fill' })}${S.p.medios.includes(i.file) ? '<i class="md-gal-ok">✓</i>' : ''}</button>`).join('') : '<p class="mv-nada">La galería está vacía.</p>';
        }).catch(e => { h.cuerpo.querySelector('[data-g]').textContent = motivo(e); });
        h.cuerpo.addEventListener('click', ev => { const b = ev.target.closest('[data-gal]'); if (!b) return; const f = b.dataset.gal, i = S.p.medios.indexOf(f); if (i >= 0) S.p.medios.splice(i, 1); else S.p.medios.push(f); S.sucio = true; b.setAttribute('aria-pressed', String(i < 0)); b.querySelector('.md-gal-ok')?.remove(); if (i < 0) b.insertAdjacentHTML('beforeend', '<i class="md-gal-ok">✓</i>'); });
        return h;
      }
      async function mejorar(b) {
        if (!S.p.texto.trim() && !S.p.titulo.trim()) { ctx.toast('Escribe primero una idea o unas notas: Marketing parte de ahí.'); cuerpo.querySelector('#mdTexto')?.focus(); return; }
        const r = await con(b, () => ctx.api('/api/contenido/mejorar', { method: 'POST', body: { pieza: { titulo: S.p.titulo, texto: S.p.texto, notas: '' }, red: S.p.redes[0] || 'instagram' } }), { hecho: 'Propuesta lista', ocupado: 'Marketing está escribiendo…' });
        if (!r.ok) return; const v = r.valor;
        ctx.hoja({ titulo: 'Propuesta de Marketing', cuerpo: `<p class="mv-texto">${esc(v.texto || '')}</p>${v.porque ? `<p class="mv-meta">${esc(v.porque)}</p>` : ''}`, acciones: [{ texto: 'Dejar el mío', alTocar: x => x.cerrar() }, { texto: 'Usar este texto', tipo: 'primario', alTocar: x => { S.p.texto = v.texto || S.p.texto; S.sucio = true; x.cerrar(); pintar(); } }] });
      }

      el.addEventListener('click', async e => {
        const t = e.target.closest('button'); if (!t) return;
        const d = t.dataset;
        if (d.ir) return ir(S.paso + +d.ir);
        if (d.paso != null && d.paso !== '') return ir(+d.paso);
        if (d.irPaso != null) return ir(+d.irPaso);
        if (d.red) { const rs = S.p.redes.includes(d.red) ? S.p.redes.filter(x => x !== d.red) : [...S.p.redes, d.red]; if (!rs.length) { ctx.toast('Tiene que salir en al menos una red.'); return; } Object.assign(S.p, { redes: rs }, formatosConRedes(S.p, rs)); S.sucio = true; return pintar(); }
        if (d.fmt) { const [r, f] = d.fmt.split('|'); Object.assign(S.p, ponFormato(S.p, r, f, S.p.redes)); S.sucio = true; return pintar(); }
        if (t.hasAttribute('data-mas-redes')) { S.masRedes = true; return pintar(); }
        if (t.hasAttribute('data-mejorar')) return mejorar(t);
        if (d.subir) return el.querySelector(`[data-file="${d.subir}"]`).click();
        if (d.gal) { if (!S.p.medios.includes(d.gal)) S.p.medios.push(d.gal); Object.assign(S.p, autoFormato()); S.sucio = true; return pintar(); }
        if (t.hasAttribute('data-gal-todas')) { galeriaCompleta(); return; }
        if (d.mov) { const [i, s] = d.mov.split('|').map(Number), j = i + s; if (j >= 0 && j < S.p.medios.length) { [S.p.medios[i], S.p.medios[j]] = [S.p.medios[j], S.p.medios[i]]; S.sucio = true; pintar(); } return; }
        if (d.quitar != null) { S.p.medios.splice(+d.quitar, 1); S.sucio = true; return pintar(); }
        if (d.dia) { S.p.fecha = d.dia; S.sucio = true; const m = mejoresDelDia(S.grid, d.dia, 1)[0]; if (m && !S.p.hora) S.p.hora = m.hora; return pintar(); }
        if (d.hora) { S.p.hora = d.hora; S.sucio = true; return pintar(); }
        if (d.prev) { S.previa = d.prev; return pintar(); }
        if (t.hasAttribute('data-guardar')) { const r = await con(t, async () => { if (vacioTotal()) throw new Error('Escribe algo o añade una imagen antes de guardar.'); return guardar(); }, { hecho: 'Guardado' }); if (r.ok) { ctx.toast('Guardada como borrador. No sale hasta que la apruebes.'); setTimeout(() => ctx.volver(), 350); } return; }
        if (t.hasAttribute('data-aprobar')) {
          if (t.getAttribute('aria-disabled') === 'true') { const r = revisar(); ctx.toast(r.errores[0] || 'Todavía no se puede aprobar.'); ir(pasoDe(r.errores[0] || '')); return; }
          let pz; try { pz = await guardar(); } catch (err) { ctx.toast('No pude guardar: ' + motivo(err)); return; }
          const r = await aprobarPieza(ctx, pz);
          if (r.ok) { ctx.toast('Aprobada. ' + resumenSalida(r.pieza || pz)); S.sucio = false; setTimeout(() => ctx.volver(), 350); }
          else if (r.error) { S.rev = pz.revision; ctx.toast(r.error); pintar(); }
        }
      });
      ctx.tirar(sc, async () => {});
      el._iniciar = iniciar; el._salir = async () => { if (S.sucio && !vacioTotal() && S.p.estado !== 'aprobada') { try { await guardar(); ctx.toast('Guardada como borrador.'); } catch { /* sin conexión: se pierde lo último */ } } };
      el._S = S;
    },
    alMostrar(el, ctx, params) { document.body.classList.add('mv-inmersivo'); ctx.cabecera({ titulo: params?.id ? 'Editar publicación' : 'Crear publicación', acciones: [] }); el._iniciar?.(params || {}); },
    alOcultar(el) { document.body.classList.remove('mv-inmersivo'); el._salir?.(); },
  });
}
