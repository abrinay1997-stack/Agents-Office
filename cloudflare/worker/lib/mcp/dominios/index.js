// EL PUNTO DE CHOQUE de la P5 (ocho carriles a la vez): UNA línea por carril, en este orden, y nada más.
// Un carril = UN archivo `lib/mcp/dominios/<dominio>.js` que registra su herramienta con `registrarHerramienta(...)` y declara ahí mismo `export const RUTAS = [...]` (las rutas /api/ que cubre).
// Ningún carril toca modulos/mcp.js, lib/sesion.js, wrangler.jsonc ni las migraciones: si lo necesita, PARA y lo dice.
import './capa1.js'; // P3b: las herramientas finas de la oficina y del Estudio (capa1.js)
// import './cerebro.js';
import './tareas.js'; // P5 carril 2: tareas y rutinas
// import './contenido.js';
// import './anuncios.js';
// import './estudio.js';
// import './agentes.js';
// import './skills.js';
import './empresa.js'; // P5 empresa: la radiografía
import './ajustes.js'; // P5 empresa: ajustes, cifras, modelos, avisos, disparadores
import './costos.js'; // P5 empresa: costos y topes de gasto
import './conectores.js'; // P5 empresa: conectores MCP de los agentes
import './equipo.js'; // P5 empresa: equipo y cuentas (solo lectura)
export {};
