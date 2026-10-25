// Versión móvil (25 oct 2026) — punto de entrada del paquete dist/movil.js (lo pide src/movil-carga.js solo en pantallas de teléfono).
// Crea el armazón, registra las pantallas y se enciende o apaga según la ventana y la preferencia (`ao.movil`: auto · movil · escritorio).
import { crearShell } from './shell.js';
import { registrar as inicio } from './vistas/inicio.js';
import { registrar as tareas } from './vistas/tareas.js';
import { registrar as calendario } from './vistas/calendario.js';
import { registrar as dimitri } from './vistas/dimitri.js';
import { registrar as aprobaciones } from './vistas/aprobaciones.js';
import { registrar as mas } from './vistas/mas.js';
// equipo B: Cerebro, Estudio, Buscar (Dimitri con imágenes vive dentro de vistas/dimitri.js → dimitri-extra.js)
import { registrar as cerebro } from './vistas/cerebro.js';
import { registrar as estudio } from './vistas/estudio.js';
import { registrar as buscar } from './vistas/buscar.js';

export const MAX_ANCHO = 820;
const preferencia = () => { try { const v = localStorage.getItem('ao.movil'); return v === 'movil' || v === 'escritorio' ? v : 'auto'; } catch { return 'auto'; } };
export const quiere = (ancho = innerWidth) => { const p = preferencia(); return p === 'movil' || (p === 'auto' && ancho <= MAX_ANCHO); };

const shell = crearShell();
for (const r of [inicio, tareas, calendario, dimitri, aprobaciones, mas, cerebro, estudio, buscar]) r(shell);

function sync() {
  document.documentElement.classList.remove('mv-pre');
  if (quiere()) shell.iniciar(); else shell.apagar();
}
window.AO_MOVIL = { sync, shell, quiere };
const mq = matchMedia(`(max-width: ${MAX_ANCHO}px)`);
mq.addEventListener('change', sync); addEventListener('ao:movil', sync);
sync();
