// Versión móvil (25 oct 2026) — MI PERFIL y EQUIPO (solo en la nube, donde hay cuentas): tu foto, tu nombre y tu contraseña; y, para un
// administrador, quién está en la oficina, con su rol, las invitaciones de un solo uso (el enlace se copia o se comparte con el menú del
// teléfono) y quitar a alguien. Usa las rutas de cloudflare/worker/modulos/equipo.js (/api/yo, /api/equipo); el servidor decide quién puede qué.
import { esc, svg, esqueleto, falla } from '../ui.js';
import { conEstado } from '../../accion.js';
import { ROL } from '../ajustes-core.mjs';

const foto = (id, v) => (v ? `/api/equipo/${encodeURIComponent(id)}/foto?v=${encodeURIComponent(v)}` : '');
const avatar = (m, grande = false) => `<span class="mv-av${grande ? ' grande' : ''}" style="--c:${esc(/^#[0-9a-f]{3,8}$/i.test(m.color || '') ? m.color : '#555')}" aria-hidden="true">${m.foto ? `<img src="${esc(foto(m.id, m.foto))}" alt="">` : esc((m.nombre || '?').trim()[0]?.toUpperCase() || '?')}</span>`;

/** Reduce la foto a un cuadrado de 256 px (JPEG) en el teléfono: pesa unos 20 KB y nunca pasa del tope del servidor. */
async function reducirFoto(archivo) {
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) throw new Error('Elige una imagen JPEG, PNG o WebP.');
  const bmp = await createImageBitmap(archivo).catch(() => { throw new Error('No se pudo leer esa imagen. Prueba con otra foto.'); }), lado = Math.min(bmp.width, bmp.height), c = document.createElement('canvas');
  c.width = c.height = 256; c.getContext('2d').drawImage(bmp, (bmp.width - lado) / 2, (bmp.height - lado) / 2, lado, lado, 0, 0, 256, 256);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86)); if (!blob) throw new Error('No se pudo preparar la foto.'); return blob;
}

export function registrar(shell) {
  if (!window.AO_NUBE) return; // en la oficina de tu computadora no hay cuentas
  // ───────────────────────────── mi perfil
  shell.registrarVista({
    id: 'perfil', titulo: 'Mi perfil', icono: 'persona', grupo: 'mas', sec: 'cuenta', texto: 'Tu nombre, foto y contraseña',
    montar(el, ctx) {
      el.innerHTML = '<div class="mv-scroll"><div class="mv-cuerpo mv-form" aria-live="polite"></div></div><footer class="mv-guardar" hidden><span class="mv-gst" role="status" aria-live="polite"></span><button type="button" class="mv-btn primario ac" data-nombre>Guardar nombre</button></footer>';
      const cuerpo = el.querySelector('.mv-cuerpo'), pie = el.querySelector('.mv-guardar'), gst = el.querySelector('.mv-gst'), bN = el.querySelector('[data-nombre]');
      let yo = null, err = '';
      async function cargar() { try { yo = (await ctx.api('/api/yo')).usuario; err = ''; } catch (e) { if (!yo) err = e.message; } pintar(); }
      function marcar() { const n = cuerpo.querySelector('#mvNom'); const c = n && n.value.trim() !== yo.nombre; pie.classList.toggle('sucio', !!c); if (c) { gst.textContent = 'Sin guardar'; gst.className = 'mv-gst sin'; } else if (!gst.classList.contains('ok')) gst.textContent = ''; }
      function pintar() {
        if (!yo) { cuerpo.innerHTML = err ? falla(err) : esqueleto(4); pie.hidden = true; return; }
        cuerpo.innerHTML = `<section class="mv-perfil">${avatar({ ...yo }, true)}<div class="mv-botones"><label class="mv-btn mv-subir">Cambiar foto<input type="file" id="mvFoto" aria-label="Cambiar foto" accept="image/jpeg,image/png,image/webp"></label>${yo.foto ? '<button type="button" class="mv-btn ac" data-quitar-foto>Quitar foto</button>' : ''}</div><p class="mv-meta">JPEG, PNG o WebP. Se reduce a un cuadrado pequeño.</p></section>
          <div class="mv-cm"><label class="mv-lab" for="mvNom">Tu nombre</label><input id="mvNom" maxlength="60" autocomplete="name" value="${esc(yo.nombre)}"></div>
          <p class="mv-meta">${esc(yo.email || '')} · ${esc(ROL[yo.rol] || yo.rol)}</p>
          <fieldset class="mv-cm mv-clave"><legend class="mv-lab">Cambiar contraseña</legend>
            <label class="mv-lab" for="mvA">La de ahora</label><input id="mvA" type="password" autocomplete="current-password">
            <label class="mv-lab" for="mvN">La nueva (12 caracteres o más)</label><input id="mvN" type="password" autocomplete="new-password">
            <label class="mv-lab" for="mvN2">Repite la nueva</label><input id="mvN2" type="password" autocomplete="new-password">
            <p class="mv-meta">Al cambiarla se cierran tus sesiones en los demás aparatos.</p><p class="mv-aviso malo" id="mvClaveMsg" role="alert" hidden></p><button type="button" class="mv-btn ac" data-clave>Cambiar contraseña</button></fieldset>
          <button type="button" class="mv-btn peligro mv-ancho" data-salir>Salir de la oficina</button>`;
        pie.hidden = false; marcar();
      }
      cuerpo.addEventListener('input', marcar);
      cuerpo.addEventListener('change', async e => {
        if (e.target.id !== 'mvFoto') return; const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        ctx.toast('Subiendo la foto…');
        try { const b = await reducirFoto(f); const r = await fetch('/api/yo/foto', { method: 'PUT', body: b, credentials: 'same-origin' }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'No se pudo subir.'); yo.foto = j.foto; pintar(); ctx.toast('Foto actualizada.'); } catch (x) { ctx.toast(x.message); }
      });
      cuerpo.addEventListener('click', async e => {
        if (e.target.closest('[data-reintentar]')) { err = ''; return cargar(); }
        const q = e.target.closest('[data-quitar-foto]'); if (q) { const r = await conEstado(q, () => ctx.api('/api/yo/foto', { method: 'DELETE' }), { ocupado: 'Quitando…', hecho: 'Quitada ✓', ms: 700 }); if (r.ok) { yo.foto = null; setTimeout(pintar, 800); } return; }
        const c = e.target.closest('[data-clave]'); if (c) {
          const m = cuerpo.querySelector('#mvClaveMsg'), n = cuerpo.querySelector('#mvN').value; m.hidden = true;
          if (n !== cuerpo.querySelector('#mvN2').value) { m.hidden = false; m.textContent = 'Las contraseñas nuevas no coinciden.'; return; }
          const r = await conEstado(c, () => ctx.api('/api/yo/contrasena', { method: 'POST', body: { actual: cuerpo.querySelector('#mvA').value, nueva: n } }), { ocupado: 'Cambiando…', hecho: 'Cambiada ✓', ms: 1800 });
          if (r.ok) { for (const i of cuerpo.querySelectorAll('.mv-clave input')) i.value = ''; ctx.toast('Contraseña cambiada. Las demás sesiones se cerraron.'); } else { m.hidden = false; m.textContent = r.error; } return;
        }
        if (e.target.closest('[data-salir]')) { if (await ctx.confirmar({ titulo: '¿Salir de la oficina?', texto: 'Tendrás que volver a entrar con tu correo y contraseña.', ok: 'Salir' })) { try { await fetch('/api/salir', { method: 'POST', credentials: 'same-origin' }); } catch {} location.replace('/'); } }
      });
      bN.addEventListener('click', async () => {
        const v = cuerpo.querySelector('#mvNom').value.trim(); if (!v || v === yo.nombre) { ctx.toast(v ? 'No hay cambios que guardar.' : 'El nombre no puede quedar vacío.'); return; }
        gst.textContent = 'Guardando…'; gst.className = 'mv-gst';
        const r = await conEstado(bN, async () => { const j = await ctx.api('/api/yo', { method: 'PATCH', body: { nombre: v } }); yo.nombre = j.usuario.nombre; }, { ocupado: 'Guardando…', hecho: 'Guardado ✓' });
        gst.textContent = r.ok ? 'Nombre guardado' : 'Sin guardar'; gst.className = 'mv-gst ' + (r.ok ? 'ok' : 'sin'); if (r.ok) pie.classList.remove('sucio');
      });
      el._cargar = cargar; cuerpo.innerHTML = esqueleto(4);
    },
    alMostrar(el) { el._cargar(); },
  });

  // ───────────────────────────── el equipo
  shell.registrarVista({
    id: 'equipo', titulo: 'Cuentas y roles', icono: 'persona', grupo: 'mas', sec: 'cuenta', texto: 'Quién entra a la oficina',
    montar(el, ctx) {
      el.innerHTML = '<div class="mv-scroll"><div class="mv-cuerpo" aria-live="polite"></div></div>';
      const cuerpo = el.querySelector('.mv-cuerpo'), sc = el.querySelector('.mv-scroll');
      let d = null, err = '', admin = false;
      async function cargar() { try { d = await ctx.api('/api/equipo'); err = ''; admin = !!d.miembros.find(m => m.id === d.yo && m.rol === 'admin'); } catch (e) { if (!d) err = e.message; } pintar(); ctx.cabecera({ acciones: admin ? [{ icono: 'mas1', etiqueta: 'Invitar a alguien', alTocar: () => invitar() }] : [] }); }
      function pintar() {
        if (!d) { cuerpo.innerHTML = err ? falla(err) : esqueleto(4); return; }
        cuerpo.innerHTML = `<p class="mv-intro">${admin ? 'Invita a tu equipo y cambia sus roles. <b>Administrador</b>: aprueba, gasta y gestiona el equipo · <b>Editor</b>: trabaja con los agentes · <b>Solo lectura</b>: mira.' : 'Las personas de esta oficina.'}</p>
          <ul class="mv-lista mv-personas">${d.miembros.map(m => `<li><${admin && !m.yo && !m.fundador ? 'button type="button" data-m="' + esc(m.id) + '"' : 'div'} class="mv-lista-b">${avatar(m)}<span><b>${esc(m.nombre)}${m.yo ? ' (tú)' : ''}</b><small>${esc(m.email ? m.email + ' · ' : '')}${esc(ROL[m.rol] || m.rol)}${m.fundador ? ' · fundó la oficina' : ''}</small></span>${admin && !m.yo && !m.fundador ? svg('der', 'mv-der') : ''}</${admin && !m.yo && !m.fundador ? 'button' : 'div'}></li>`).join('')}</ul>
          ${admin ? `<button type="button" class="mv-btn primario mv-ancho" data-invitar>+ Invitar a alguien</button>` : ''}
          ${admin && d.invitaciones && d.invitaciones.length ? `<h3 class="mv-gh">Invitaciones pendientes <span>${d.invitaciones.length}</span></h3><ul class="mv-lista">${d.invitaciones.map(i => `<li><div class="mv-lista-b"><span><b>${esc(i.email)}</b><small>${esc(ROL[i.rol] || i.rol)} · caduca ${esc(new Date(i.expira).toLocaleDateString('es-PA', { day: 'numeric', month: 'short' }))}</small></span><button type="button" class="mv-link" data-revocar="${esc(i.id)}">Revocar</button></div></li>`).join('')}</ul>` : ''}`;
      }
      const enlaceHoja = (titulo, texto, enlace) => { const h = ctx.hoja({ titulo, cuerpo: `<p class="mv-texto">${esc(texto)}</p><input class="mv-campo" id="mvEnl" readonly value="${esc(enlace)}" aria-label="Enlace">`, acciones: [
        ...(navigator.share ? [{ texto: 'Compartir…', tipo: 'primario', alTocar: async () => { try { await navigator.share({ title: 'Agents Office', url: enlace }); } catch {} } }] : []),
        { texto: 'Copiar el enlace', tipo: navigator.share ? '' : 'primario', alTocar: async (hh, b) => { const i = hh.cuerpo.querySelector('#mvEnl'); i.select(); let ok = false; try { await navigator.clipboard.writeText(enlace); ok = true; } catch {} b.textContent = ok ? 'Copiado ✓' : 'Selecciónalo y cópialo'; } }] }); return h; };
      function invitar() {
        const h = ctx.hoja({ titulo: 'Invitar a alguien', lleno: true, cuerpo: `<div class="mv-cm"><label class="mv-lab" for="ivC">Correo</label><input id="ivC" type="email" inputmode="email" autocomplete="off" autocapitalize="none" spellcheck="false"></div><div class="mv-cm"><label class="mv-lab" for="ivN">Nombre (opcional)</label><input id="ivN" maxlength="60" autocomplete="off"></div><div class="mv-cm"><label class="mv-lab" for="ivR">Rol</label><select id="ivR"><option value="editor">Editor</option><option value="lectura">Solo lectura</option><option value="admin">Administrador</option></select></div><p class="mv-aviso malo" id="ivMsg" role="alert" hidden></p><p class="mv-meta">Se crea un enlace de un solo uso que caduca en 7 días. Tú se lo mandas (WhatsApp, correo…).</p>`,
          acciones: [{ texto: 'Crear el enlace de invitación', tipo: 'primario', alTocar: async (hh, b) => { const q = s => hh.cuerpo.querySelector(s);
            const r = await conEstado(b, () => ctx.api('/api/equipo/invitaciones', { method: 'POST', body: { email: q('#ivC').value, nombre: q('#ivN').value, rol: q('#ivR').value } }), { ocupado: 'Creando…', hecho: 'Creado ✓', ms: 600 });
            if (!r.ok) { const m = q('#ivMsg'); m.hidden = false; m.textContent = r.error; return; }
            hh.cerrar(); await cargar(); setTimeout(() => enlaceHoja('Invitación creada', 'Copia este enlace y mándaselo. Solo se muestra ahora, sirve una vez y caduca en 7 días.', r.valor.enlace), 300); } }] });
      }
      function miembro(m) {
        const h = ctx.hoja({ titulo: m.nombre, cuerpo: `<p class="mv-meta">${esc(m.email || '')}</p><div class="mv-cm"><label class="mv-lab" for="mRol">Rol</label><select id="mRol">${['admin', 'editor', 'lectura'].map(r => `<option value="${r}"${m.rol === r ? ' selected' : ''}>${ROL[r]}</option>`).join('')}</select></div><p class="mv-aviso" id="mMsg" role="status" aria-live="polite" hidden></p>`,
          acciones: [{ texto: 'Enlace para una contraseña nueva', alTocar: async (hh, b) => { const r = await conEstado(b, () => ctx.api(`/api/equipo/${m.id}/reinicio`, { method: 'POST' }), { ocupado: 'Creando…', hecho: 'Creado ✓', ms: 500 }); if (r.ok) { hh.cerrar(); setTimeout(() => enlaceHoja('Contraseña nueva', `Enlace para que ${r.valor.para} ponga una contraseña nueva (sirve una vez, caduca en ${r.valor.expira}; sus sesiones se cierran al usarlo).`, r.valor.enlace), 300); } else { const x = hh.cuerpo.querySelector('#mMsg'); x.hidden = false; x.className = 'mv-aviso malo'; x.textContent = r.error; } } },
            { texto: 'Quitar del equipo', tipo: 'peligro', alTocar: async (hh, b) => { if (!(await ctx.confirmar({ titulo: `¿Quitar a ${m.nombre}?`, texto: 'Ya no podrá entrar a la oficina.', ok: 'Quitar', peligro: true }))) return; const r = await conEstado(b, () => ctx.api(`/api/equipo/${m.id}`, { method: 'DELETE' }), { ocupado: 'Quitando…', hecho: 'Quitado ✓', ms: 500 }); if (r.ok) { hh.cerrar(); ctx.toast('Quitado del equipo.'); cargar(); } } }] });
        h.cuerpo.querySelector('#mRol').addEventListener('change', async e => { const x = h.cuerpo.querySelector('#mMsg'); x.hidden = false; x.className = 'mv-aviso'; x.textContent = 'Guardando…'; try { await ctx.api(`/api/equipo/${m.id}`, { method: 'PATCH', body: { rol: e.target.value } }); m.rol = e.target.value; x.textContent = 'Rol cambiado ✓'; cargar(); } catch (er) { x.className = 'mv-aviso malo'; x.textContent = er.message; e.target.value = m.rol; } });
      }
      cuerpo.addEventListener('click', async e => {
        if (e.target.closest('[data-reintentar]')) { err = ''; return cargar(); }
        if (e.target.closest('[data-invitar]')) return invitar();
        const m = e.target.closest('[data-m]'); if (m) { const x = d.miembros.find(q => q.id === m.dataset.m); if (x) miembro(x); return; }
        const r = e.target.closest('[data-revocar]'); if (r) { const ok = await conEstado(r, () => ctx.api(`/api/equipo/invitaciones/${r.dataset.revocar}`, { method: 'DELETE' }), { ocupado: '…', hecho: 'Revocada', ms: 600 }); if (ok.ok) setTimeout(cargar, 700); }
      });
      ctx.tirar(sc, cargar); el._cargar = cargar; cuerpo.innerHTML = esqueleto(4);
    },
    alMostrar(el) { el._cargar(); },
  });
}
