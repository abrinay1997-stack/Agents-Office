// Versión móvil (25 oct 2026) — MÁS: la hoja con todo lo que no cabe en la barra de abajo. Lo que ya tiene versión móvil propia se abre
// como pantalla; lo demás (el Cerebro, el Estudio, Contenido, Analíticas, Anuncios, Negocio, Costos, Conectores, Ajustes, Estado, Buscar)
// se abre en su vista de escritorio dentro de un contenedor con «Volver» (escritorio.js). Cuando alguien porta una de esas vistas y la
// registra con `registrarVista({ id, grupo: 'mas', … })`, aquí cambia sola. También: el tema y «usar la versión de escritorio».
import { GRUPOS } from '../escritorio.js';
import { esc, svg } from '../ui.js';
import { abrirAvisos, contar } from '../avisos.js';

const TEMAS = [['light', 'Claro'], ['dark', 'Oscuro'], ['auto', 'Automático']];
const tema = () => { try { const v = localStorage.getItem('ao.theme'); return v === 'dark' || v === 'auto' ? v : 'light'; } catch { return 'light'; } };

export function ponerTema(pref) {
  try { localStorage.setItem('ao.theme', pref); } catch {}
  const oscuro = pref === 'dark' || (pref === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (window.CC && window.CC.setDark) window.CC.setDark(oscuro); else document.body.classList.toggle('dark', oscuro);
}

export function registrar(shell) {
  shell.registrarVista({
    id: 'mas', titulo: 'Más', icono: 'mas', grupo: 'tab',
    abrir(ctx) {
      const propias = shell.vistas().filter(v => v.grupo === 'mas'), nube = !!window.AO_NUBE, esc2 = shell.entradasEscritorio().filter(x => x.grupo !== 'oculta' && (!x.nube || nube));
      const entrada = (id, icono, titulo, texto, tipo) => `<li><button type="button" class="mv-lista-b" data-${tipo}="${esc(id)}">${svg(icono, 'mv-lista-i')}<span><b>${esc(titulo)}</b><small>${esc(texto || '')}</small></span>${svg('der', 'mv-der')}</button></li>`;
      const bloques = Object.entries(GRUPOS).map(([g, nombre]) => {
        const l = [...propias.filter(v => (v.sec || 'trabajo') === g).map(v => entrada(v.id, v.icono, typeof v.titulo === 'function' ? v.titulo() : v.titulo, v.texto, 'vista')), ...esc2.filter(x => x.grupo === g).map(x => entrada(x.id, x.icono, x.titulo, x.texto, 'esc'))];
        if (g === 'cuenta' && nube) l.push(entrada('salir', 'salir', 'Salir', 'Cerrar la sesión en este teléfono', 'salir'));
        return l.length ? `<h3 class="mv-gh">${esc(nombre)}</h3><ul class="mv-lista">${l.join('')}</ul>` : '';
      }).join('');
      const nAv = contar(ctx.store.st), t = tema();
      const h = ctx.hoja({ titulo: 'Más', lleno: true, clase: 'mv-mas', cuerpo: `${`<ul class="mv-lista"><li><button type="button" class="mv-lista-b" data-avisos>${svg('nube', 'mv-lista-i')}<span><b>Avisos</b><small>${nAv ? nAv + ' sin atender' : 'Todo en orden'}</small></span>${svg('der', 'mv-der')}</button></li></ul>`}${bloques}
        <h3 class="mv-gh">Tema</h3><div class="mv-seg" role="group" aria-label="Tema">${TEMAS.map(([k, n]) => `<button type="button" data-tema="${k}" aria-pressed="${t === k}">${n}</button>`).join('')}</div>
        <h3 class="mv-gh">Versión</h3><ul class="mv-lista"><li><button type="button" class="mv-lista-b" data-escritorio>${svg('escritorio', 'mv-lista-i')}<span><b>Oficina 3D (versión de escritorio)</b><small>Pasa a la oficina completa. Vuelve desde Ajustes → Apariencia.</small></span></button></li></ul>` });
      h.cuerpo.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-avisos')) { h.cerrar(); setTimeout(() => abrirAvisos(ctx), 260); return; }
        if (b.dataset.tema) { ponerTema(b.dataset.tema); h.cuerpo.querySelectorAll('[data-tema]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); return; }
        if (b.dataset.vista) { h.cerrar(); setTimeout(() => ctx.navegar(b.dataset.vista), 120); return; }
        if (b.dataset.salir) { h.cerrar(); setTimeout(async () => { if (!(await ctx.confirmar({ titulo: '¿Salir de la oficina?', texto: 'Tendrás que volver a entrar con tu correo y contraseña.', ok: 'Salir' }))) return; try { await fetch('/api/salir', { method: 'POST', headers: { 'X-Pestana': window.AO_NUBE?.pestana || '' } }); } catch {} location.replace('/'); }, 240); return; }
        if (b.dataset.esc) { h.cerrar(); setTimeout(() => ctx.escritorio(b.dataset.esc), 220); return; }
        if (b.hasAttribute('data-escritorio')) { try { localStorage.setItem('ao.movil', 'escritorio'); } catch {} h.cerrar(); dispatchEvent(new Event('ao:movil')); }
      });
    },
  });
}
