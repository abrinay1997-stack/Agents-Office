// Series en la nube: los interruptores. Los dos APAGADOS por defecto y solo `=== true` los enciende (nada de «truthy»: un "false" de texto no puede encender el gasto).
//   dimitri.seriesNube      .. ver, proponer y organizar series en la nube (sin gasto)
//   dimitri.seriesNubePago  .. además, que la bomba del reloj dé pasos de PAGO (N4+). Sin `seriesNube` no vale.
// Solo un administrador los cambia, y nunca desde un agente, Dimitri o un MCP (como el interruptor de la oficina local).
export const seriesNubeActiva = (cfg) => cfg?.dimitri?.seriesNube === true;
export const seriesNubePagoActiva = (cfg) => seriesNubeActiva(cfg) && cfg?.dimitri?.seriesNubePago === true;
