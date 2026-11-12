// EL PUNTO DE CHOQUE de la P5 (ocho carriles a la vez): UNA línea por carril, en este orden, y nada más.
// Un carril = UN archivo `lib/mcp/dominios/<dominio>.js` que registra su herramienta con `registrarHerramienta(...)` y declara ahí mismo `export const RUTAS = [...]` (las rutas /api/ que cubre).
// Ningún carril toca modulos/mcp.js, lib/sesion.js, wrangler.jsonc ni las migraciones: si lo necesita, PARA y lo dice.
import './capa1.js'; // P3b: las herramientas finas de la oficina y del Estudio (capa1.js)
import './cerebro.js'; // P5: el Cerebro (notas)
import './tareas.js'; // P5 carril 2: tareas y rutinas
// import './contenido.js';
import './anuncios.js'; // P5 · carril anuncios: Anuncios de Meta (leer, borradores y lo que baja el gasto)
import './analiticas.js'; // P5 · carril anuncios: Analíticas de las redes (leer)
import './agentes.js'; // P5: agentes (roster, ficha, actividad, brief)
import './dimitri.js'; // P5: las conversaciones de Dimitri de cada cuenta
import './estudio.js'; // P5 carril 5: galería (ver y ordenar) del Estudio
import './series.js'; // P5 carril 5: series de imágenes (leer y proponer)
// import './skills.js';
// import './empresa.js';
export {};
