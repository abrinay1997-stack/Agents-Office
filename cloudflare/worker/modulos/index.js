import * as estudio from './estudio.js';
import * as tareas from './tareas.js';
import * as contenido from './contenido.js';
import * as bandeja from './bandeja.js';
import * as anuncios from './anuncios.js';
import * as agentes from './agentes.js';
import * as equipo from './equipo.js';
export const MODULOS = [
  tareas,
  bandeja, // ANTES que contenido: solo contesta /api/contenido/bandeja*, y contenido contesta el resto de /api/contenido/* (si va antes, se come la Bandeja)
  anuncios,
  contenido,
  estudio,
  agentes,
  equipo, // fase 10: /api/equipo · /api/yo/* · /api/live (las rutas públicas de las invitaciones las llama lib/rutas.js antes de pedir sesión)
];
