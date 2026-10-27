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
import * as biblioteca from './biblioteca.js';
import * as restablecer from './restablecer.js';
import * as modelos from './modelos.js';
import * as conectores from './conectores.js';
import * as imagenMeta from './imagen-meta.js';
import * as chatAgente from './chat-agente.js';
import * as conexiones from './conexiones.js';
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
  restablecer, // Ajustes → Restablecer oficina (solo administradores)
  biblioteca, // la Biblioteca de habilidades (solo lee): /api/biblioteca
  conectores, // Ajustes → Conectores: añadir, probar, token cifrado, plantillas
  modelos, // Ajustes → Modelos: catálogo, asignación por función, probar y comparar
  imagenMeta, // /api/imagen-meta: las fotos de Meta por el mismo origen (CSP)
  chatAgente, // POST /api/chat: hablar con un agente (un turno, solo herramientas de lectura)
  conexiones, // /api/brain/actualizar: el botón «Actualizar conexiones» del Cerebro (solo administradores)
  equipo, // fase 10: /api/equipo · /api/yo/* · /api/live (las rutas públicas de las invitaciones las llama lib/rutas.js antes de pedir sesión)
];
