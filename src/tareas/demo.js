// La vista Tareas en la DEMO (file://, sin servidor): una semana de ejemplo de una tienda de lentes, con un proyecto que cruza
// departamentos, bloqueos, pasos a medias, una tarea que espera tu OK y una idea de un agente. Nada se escribe en disco.
import { crearTarea } from '../../tareas/modelo.mjs';

const dia = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function demoCatalogo() {
  return {
    proyectos: [
      { id: 'pr-lentes', nombre: 'Lanzamiento lentes polarizados', color: 'azul', estado: 'activo', limite: dia(10), objetivo: 'Vender 200 pares el primer mes.' },
      { id: 'pr-cierre', nombre: 'Cierre de octubre', color: 'verde', estado: 'activo', limite: dia(24) },
    ],
    etiquetas: [{ id: 'e-lanzamiento', nombre: 'lanzamiento', color: 'violeta' }, { id: 'e-cliente', nombre: 'cliente', color: 'ambar' }, { id: 'e-web', nombre: 'web', color: 'cian' }],
  };
}

export function demoTareas(agentes) {
  const de = d => agentes.find(a => a.dept === d && !a.lead) || agentes.find(a => a.dept === d) || agentes[0];
  const jefe = d => agentes.find(a => a.dept === d && a.lead) || de(d);
  const ahora = Date.now(); let n = 0;
  const T = (c, extra = {}) => Object.assign(crearTarea(c, { id: () => 'demo' + ++n, ahora: ahora - (40 - n) * 3600e3 }), extra);
  const fotos = T({ dept: 'marketing', agent: de('marketing').id, text: 'Fotos de producto de los lentes polarizados, fondo blanco y en la playa', prioridad: 'alta', limite: dia(2), proyecto: 'pr-lentes', etiquetas: ['e-lanzamiento'], estimacion: 90, plan: ['Subir las fotos del almacén', 'Generar las de fondo blanco', 'Generar las de playa', 'Elegir las mejores'] }, { state: 'doing', startedAt: ahora - 20 * 60e3 });
  fotos.pasos[0].hecho = true; fotos.pasos[1].hecho = true;
  const post = T({ dept: 'marketing', agent: jefe('marketing').id, text: 'Post de lanzamiento para Instagram y Facebook', limite: dia(5), proyecto: 'pr-lentes', etiquetas: ['e-lanzamiento'], bloqueadaPor: [fotos.id], plan: ['Texto con la voz de la marca', 'Elegir la foto', 'Dejarlo en Contenido'] });
  const correo = T({ dept: 'emails', agent: de('emails').id, text: 'Correo a clientes anunciando los lentes, con 10 % de descuento la primera semana', limite: dia(6), proyecto: 'pr-lentes', etiquetas: ['e-lanzamiento', 'e-cliente'], bloqueadaPor: [post.id] });
  const ficha = T({ dept: 'delivery', agent: de('delivery').id, text: 'Ficha de los lentes en la web', limite: dia(4), proyecto: 'pr-lentes', etiquetas: ['e-web'], bloqueadaPor: [fotos.id], estimacion: 45 });
  const precio = T({ dept: 'fin', deAgente: jefe('fin').id, text: 'Para ti: confirmar el precio de los lentes polarizados', prioridad: 'alta', limite: dia(0), proyecto: 'pr-lentes', person: 'Tú', by: 'agente' });
  const prop = T({ dept: 'sales', agent: de('sales').id, text: 'Propuesta para Óptica del Centro: 50 pares al por mayor', prioridad: 'alta', etiquetas: ['e-cliente'] }, { state: 'waiting', waitingAt: ahora - 3 * 3600e3, result: 'Propuesta lista: 50 pares a US$38 c/u, entrega en 10 días.' });
  const vencida = T({ dept: 'fin', agent: de('fin').id, text: 'Facturas vencidas de septiembre: lista y recordatorios', limite: dia(-1), proyecto: 'pr-cierre' });
  const inv = T({ dept: 'ops', agent: de('ops').id, text: 'Revisar el inventario de monturas', prioridad: 'baja', limite: dia(3), proyecto: 'pr-cierre' });
  const prog = T({ dept: 'ops', agent: jefe('ops').id, text: 'Reunión con el proveedor de cristales', dueAt: ahora + 2 * 864e5 + 3600e3 });
  const idea = T({ dept: 'sales', agent: jefe('sales').id, text: 'Llamar a las ópticas que compraron el año pasado para ofrecerles los polarizados', why: 'Lo propone Marketing: 12 ópticas compraron monturas en 2025.' }, { state: 'idea', by: 'agente', agenteOrigen: de('marketing').id });
  const hecha1 = T({ dept: 'marketing', agent: de('marketing').id, text: 'Calendario de contenido de la semana', proyecto: 'pr-lentes' }, { state: 'done', doneAt: ahora - 5 * 3600e3, result: '7 piezas en Contenido.' });
  const hecha2 = T({ dept: 'emails', agent: de('emails').id, text: 'Responder las consultas del fin de semana' }, { state: 'done', doneAt: ahora - 26 * 3600e3, result: '14 respuestas enviadas.' });
  const fallo = T({ dept: 'sales', agent: de('sales').id, text: 'Actualizar el CRM con los leads de la feria' }, { state: 'done', error: true, doneAt: ahora - 2 * 3600e3, result: 'No pude: el conector del CRM no responde.' });
  // plan D (7 oct 2026): lo del dueño — su lista personal, lo que delegó, lo que le sugirieron
  const yo = (c, extra = {}) => T({ person: 'Tú', by: 'you', ...c }, extra);
  const banco = yo({ title: 'Llamar al banco por la línea de crédito', limite: dia(0) + 'T10:30', prioridad: 'alta', pasos: ['Tener a mano el estado de cuenta', 'Preguntar la tasa'] }, { empezada: ahora - 25 * 60e3, cronometro: [{ quien: 'Tú', inicio: ahora - 25 * 60e3 }] });
  const firma = yo({ title: 'Firmar el contrato del local', limite: dia(-1), dept: 'ops' });
  const visita = yo({ title: 'Visitar la feria de ópticas', limite: dia(3), proyecto: 'pr-lentes', etiquetas: ['e-cliente'] });
  const libro = yo({ title: 'Leer el informe de ventas de septiembre' });
  const idea2 = yo({ title: 'Llamar a Óptica Sol: preguntaron por precio al por mayor', text: 'Llamar a Óptica Sol: preguntaron por precio al por mayor\n\nPor qué: escribieron dos veces esta semana.', why: 'escribieron dos veces esta semana', dept: 'sales', by: 'agente' }, { state: 'idea', sugeridaPor: de('sales').id, deAgente: de('sales').id });
  const hechaYo = yo({ title: 'Pagar la luz de la tienda' }, { state: 'done', doneAt: ahora - 2 * 3600e3, result: 'Hecha por ti.', hechaPor: 'Tú' });
  const delegada = T({ dept: 'marketing', agent: de('marketing').id, text: 'Encuesta a los clientes sobre los lentes', limite: dia(4) }, { delegada: { at: ahora - 3 * 3600e3, a: 'agente:' + de('marketing').id, nota: 'Cinco preguntas, cortas.' } });
  return [fotos, post, correo, ficha, precio, prop, vencida, inv, prog, idea, hecha1, hecha2, fallo, banco, firma, visita, libro, idea2, hechaYo, delegada];
}
