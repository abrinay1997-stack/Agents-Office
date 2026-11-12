// EL PUNTO DE CHOQUE de la P5 (ocho carriles a la vez): UNA línea por carril, en este orden, y nada más.
// Un carril = UN archivo `lib/mcp/dominios/<dominio>.js` que registra su herramienta con `registrarHerramienta(...)` y declara ahí mismo `export const RUTAS = [...]` (las rutas /api/ que cubre).
// Ningún carril toca modulos/mcp.js, lib/sesion.js, wrangler.jsonc ni las migraciones: si lo necesita, PARA y lo dice.
import './capa1.js'; // P3b: las herramientas finas de la oficina y del Estudio (capa1.js)
// import './cerebro.js';
// import './tareas.js';
import './contenido.js';
import './bandeja.js';
// import './anuncios.js';
// import './estudio.js';
// import './agentes.js';
// import './skills.js';
// import './empresa.js';
export {};
