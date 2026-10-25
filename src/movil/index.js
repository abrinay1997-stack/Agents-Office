// Versión móvil (25 oct 2026) — punto de entrada del paquete dist/movil.js (lo pide src/movil-carga.js solo en pantallas de teléfono).
// Crea el armazón, registra las pantallas y se enciende o apaga según la ventana y la preferencia (`ao.movil`: auto · movil · escritorio).
import { crearShell } from './shell.js';
import { registrar as inicio } from './vistas/inicio.js';
import { registrar as tareas } from './vistas/tareas.js';
import { registrar as calendario } from './vistas/calendario.js';
import { registrar as dimitri } from './vistas/dimitri.js';
import { registrar as aprobaciones } from './vistas/aprobaciones.js';
import { registrar as mas } from './vistas/mas.js';
// equipo C (25 oct 2026): Ajustes (lista → sección con Guardar fijo), Conectores, Costos, Estado, Negocio, Mi perfil/Equipo (nube) y la ficha del agente
import { registrar as ajustes } from './vistas/ajustes.js';
import { registrar as conectores } from './vistas/conectores.js';
import { registrar as costos } from './vistas/costos.js';
import { registrar as estado } from './vistas/estado.js';
import { registrar as negocio } from './vistas/negocio.js';
import { registrar as equipo } from './vistas/equipo.js';
import { registrar as agente } from './vistas/agente.js';

export const MAX_ANCHO = 820;
const preferencia = () => { try { const v = localStorage.getItem('ao.movil'); return v === 'movil' || v === 'escritorio' ? v : 'auto'; } catch { return 'auto'; } };
export const quiere = (ancho = innerWidth) => { const p = preferencia(); return p === 'movil' || (p === 'auto' && ancho <= MAX_ANCHO); };

const shell = crearShell();
for (const r of [inicio, tareas, calendario, dimitri, aprobaciones, mas, ajustes, conectores, costos, estado, negocio, equipo, agente]) r(shell);

function sync() {
  document.documentElement.classList.remove('mv-pre');
  if (quiere()) shell.iniciar(); else shell.apagar();
}
window.AO_MOVIL = { sync, shell, quiere };
const mq = matchMedia(`(max-width: ${MAX_ANCHO}px)`);
mq.addEventListener('change', sync); addEventListener('ao:movil', sync);
sync();
