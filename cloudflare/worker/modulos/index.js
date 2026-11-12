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
import * as iconoConector from './icono-conector.js';
import * as chatAgente from './chat-agente.js';
import * as conexiones from './conexiones.js';
import * as notificaciones from './notificaciones.js';
import * as chat from './chat.js';
import * as notasPersonales from './notas-personales.js';
import * as series from './series.js';
import * as funciones from './funciones.js';
import * as skills from './skills.js';
import * as vinculoTelegram from './vinculo-telegram.js';
import * as mcp from './mcp.js';
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
  iconoConector, // /api/icono-conector: el favicon de un conector del usuario por el mismo origen (CSP)
  chatAgente, // POST /api/chat: hablar con un agente (un turno, solo herramientas de lectura)
  conexiones, // /api/brain/actualizar: el botón «Actualizar conexiones» del Cerebro (solo administradores)
  chat, // C0: el chat interno del equipo (/api/chat/*, sin pantalla todavía)
  notificaciones, // N0: las notificaciones de cada persona (/api/notificaciones/*)
  vinculoTelegram, // N2: «Conectar mi Telegram» (/api/vinculo-telegram/*)
  notasPersonales, // N1: notas para cuando entres y «mientras no estabas» (/api/notas-personales/*)
  series, // Series en la nube (N2/N3): solo lectura y propuesta, detrás de dimitri.seriesNube (apagado); no genera ni gasta
  skills, // las skills de los agentes: leer y (solo administradores) crear, editar, borrar a la papelera y volver a una versión
  funciones, // Ajustes → Funciones nuevas: encender y apagar lo ya construido (solo administradores)
  mcp, // P2: Ajustes → «Conectar Claude» (/api/conectar-claude/*, solo administradores); las rutas públicas del conector las llama lib/rutas.js antes de pedir sesión
  equipo, // fase 10: /api/equipo · /api/yo/* · /api/live (las rutas públicas de las invitaciones las llama lib/rutas.js antes de pedir sesión)
];
