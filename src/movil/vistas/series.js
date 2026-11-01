// Versión móvil (N6, 31 oct 2026) — SERIES DE IMÁGENES (solo en la nube): ver las series, su presupuesto, generar con la cifra a la vista (segundo toque), pausar, cancelar, el libro de lo gastado y las líneas «huérfanas».
// La pantalla es la MISMA que la de escritorio (cloudflare/public/nube-series.js, que la nube inyecta en la página): aquí solo se le da un contenedor y el conEstado de la versión móvil. Todo lo decide el servidor
// (modulos/series.js); los motores de pago siguen cerrados. Si la pantalla compartida todavía no llegó, se dice y se ofrece reintentar: nunca una pantalla en blanco.
import { conEstado } from '../../accion.js';
import { esc } from '../ui.js';

export function registrar(shell) {
  if (!window.AO_NUBE) return; // en la oficina de tu computadora no hay series en la nube
  shell.registrarVista({
    id: 'series', titulo: 'Series de imágenes', icono: 'estudio', grupo: 'mas', sec: 'trabajo', texto: 'Generar con la cifra a la vista, pausar, lo gastado',
    montar(el) {
      el.innerHTML = '<div class="mv-scroll"><div class="mv-cuerpo mv-series" aria-live="polite"></div></div>';
      const cuerpo = el.querySelector('.mv-series');
      let vista = null;
      function cargar() {
        const N = window.AO_NUBE;
        if (!N?.series) { cuerpo.innerHTML = `<p class="ac-vacio" role="alert"><b>No pude cargar.</b> ${esc('La pantalla de series todavía no llegó. Revisa tu conexión.')} <button type="button" class="mv-btn" data-reintentar>Reintentar</button></p>`; cuerpo.querySelector('[data-reintentar]').addEventListener('click', cargar); return; }
        vista?.cerrar?.(); cuerpo.innerHTML = ''; vista = N.series.abrir(cuerpo, { conEstado, movil: true });
      }
      el._cargar = cargar;
    },
    alMostrar(el) { el._cargar(); },
    alOcultar() { /* el temporizador de la pantalla se detiene solo cuando su contenedor sale de la página */ },
  });
}
