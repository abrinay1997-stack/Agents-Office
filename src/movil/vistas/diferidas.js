// Versión móvil (25 oct 2026) — LAS PANTALLAS DIFERIDAS: Contenido (con su Bandeja, su Perfil y «Crear publicación»), Analíticas y Anuncios (con su
// asistente de 5 pasos). Su código vive en otro paquete (dist/movil-d.js, src/movil/d/index.js) porque pesa más que todo el armazón junto: aquí solo
// se registran con su nombre y su icono, y la primera vez que se abre una se trae el paquete (con un esqueleto de carga y, si no llega, el motivo
// y «Reintentar»). Después se comportan igual que cualquier pantalla: `montar`, `alMostrar` y `alOcultar` se pasan tal cual a la de verdad.
import { esqueleto, falla } from '../ui.js';

export const PANTALLAS = [
  { id: 'contenido', titulo: 'Contenido', icono: 'contenido', grupo: 'mas', sec: 'trabajo', texto: 'Lo que publicas en redes' },
  { id: 'crear', titulo: 'Crear publicación', icono: 'mas1', grupo: 'oculta' },
  { id: 'analiticas', titulo: 'Analíticas', icono: 'analiticas', grupo: 'mas', sec: 'negocio', texto: 'Cómo rinden tus redes' },
  { id: 'anuncios', titulo: 'Anuncios', icono: 'anuncios', grupo: 'mas', sec: 'negocio', texto: 'Tus campañas de Meta' },
  { id: 'anuncios-asistente', titulo: 'Nueva campaña', icono: 'anuncios', grupo: 'oculta' },
];
let cargando = null;
export function traerPaquete() {
  if (window.AO_MOVIL_D) return Promise.resolve(window.AO_MOVIL_D);
  return (cargando ||= new Promise((ok, mal) => {
    const s = document.createElement('script'); s.src = 'movil-d.js';
    s.onload = () => (window.AO_MOVIL_D ? ok(window.AO_MOVIL_D) : (cargando = null, mal(new Error('El paquete de esta pantalla no se registró.'))));
    s.onerror = () => { cargando = null; mal(new Error('No pude traer esta pantalla. Revisa tu conexión e inténtalo de nuevo.')); };
    document.head.appendChild(s);
  }));
}

export function registrar(shell) {
  for (const meta of PANTALLAS) {
    let real = null, ult = {}, montada = null;
    const arrancar = (el, ctx) => {
      el.innerHTML = esqueleto(4);
      traerPaquete().then(defs => {
        real = defs[meta.id]; if (!real) throw new Error('Esta pantalla no está en el paquete.');
        el.innerHTML = ''; real.montar(el, ctx);
        if (!el.hidden) real.alMostrar?.(el, ctx, ult); // ya se estaba viendo: se muestra con lo que se pidió al abrirla
      }).catch(e => { el.innerHTML = falla(e.message); el.querySelector('[data-reintentar]')?.addEventListener('click', () => arrancar(el, ctx)); });
    };
    shell.registrarVista({
      ...meta,
      montar(el, ctx) { montada = { el, ctx }; arrancar(el, ctx); },
      alMostrar(el, ctx, p) { ult = p || {}; if (real) real.alMostrar?.(el, ctx, ult); },
      alOcultar(el, ctx) { if (real) real.alOcultar?.(el, ctx); },
    });
  }
}
