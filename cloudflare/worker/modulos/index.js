import * as estudio from './estudio.js';
import * as tareas from './tareas.js';
import * as contenido from './contenido.js';
import * as bandeja from './bandeja.js';
import * as anuncios from './anuncios.js';
import * as agentes from './agentes.js';
import * as dimitri from './dimitri.js';
import * as negocio from './negocio.js';
import * as ajustes from './ajustes.js';
import * as telegram from './telegram.js';
import * as disparadores from './disparadores.js';
import * as equipo from './equipo.js';
export const MODULOS = [
  tareas,
  bandeja, // ANTES que contenido: solo contesta /api/contenido/bandeja*, y contenido contesta el resto de /api/contenido/* (si va antes, se come la Bandeja)
  anuncios,
  contenido,
  estudio,
  agentes,
  dimitri, // Fase 6: la mano derecha del dueño (/api/sub/*)
  negocio, // indicadores, cifras, voz, documentos, «Preparar desde mi web»
  ajustes, // /api/settings y los avisos del Estado
  telegram, // el webhook público y los avisos al teléfono
  disparadores, // POST /api/hook/<id> (público) y /api/triggers
  equipo, // fase 10: /api/equipo · /api/yo/* · /api/live (las rutas públicas de las invitaciones las llama lib/rutas.js antes de pedir sesión)
];
