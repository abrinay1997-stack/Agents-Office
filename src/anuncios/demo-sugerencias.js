// SUGERENCIAS DE EJEMPLO (Fase A5, 9 oct 2026): la demo file:// y «Ver con datos de ejemplo». En memoria, rotuladas «ejemplo» por la
// vista, coherentes con src/anuncios/demo.js: el conjunto que aprende → «no tocar» (informativa); el anuncio que gasta sin resultados →
// pausar (un clic, DESHACER); el carrusel con frecuencia 3,8 → creativos (variaciones a tu agente de anuncios); el conjunto que va bien →
// +20 % (gasta: el primer «Aplicar» devuelve { confirmar } con la cifra, y el «Sí» va por la acción de la A2 con `sugerencia`); el
// anuncio rechazado → un borrador con el texto corregido; el video con problemas → ver qué pasa. Y una ya aplicada (con lo que pasó
// después) y una descartada, para ver los filtros. Contesta como el servidor (GET /api/anuncios/sugerencias, POST …/<id>/aplicar,
// …/descartar, …/posponer), con `status` dentro, y aplica con LAS MISMAS reglas: llama a la demo de la A2 (topes, dos clics, DESHACER).
const DIA = 864e5;
const iso = t => new Date(t).toISOString();

export function sugerenciasDeEjemplo(ahora = Date.now()) {
  const s = (id, regla, objeto, x) => ({ id, regla, objeto, estado: 'viva', creadaAt: iso(ahora - 2 * 36e5), gasto: false, riesgo: { reiniciaAprendizaje: false, gastaMas: false, texto: '' }, ...x });
  return [
    s('ej-s-1', 'aprendizaje', { id: 'ej-as-1', nivel: 'conjunto', nombre: 'Panamá · 25–55 · Advantage+' }, { prioridad: 3,
      dato: 'Lleva 18 de las 50 conversiones que Meta necesita para salir del aprendizaje, en 5 días.', porque: 'Mientras aprende, cualquier cambio de presupuesto, público o creativo lo hace empezar de cero.',
      cambio: { tipo: 'revisar', id: 'ej-as-1' }, efecto: 'Nada por ahora: déjalo trabajar 3 o 4 días más. Lo que sí miro es el anuncio rechazado (otra sugerencia).', riesgo: { reiniciaAprendizaje: false, gastaMas: false, texto: '' } }),
    s('ej-s-2', 'cortar', { id: 'ej-ad-23', nivel: 'anuncio', nombre: 'Monturas otoño · solo texto' }, { prioridad: 1,
      dato: 'Gastó 9,80 US$ en 7 días sin ningún clic al enlace (tu costo bueno es 2,00 US$ por resultado: va casi 5 veces).', porque: 'Un anuncio que gasta 2 veces el costo objetivo sin ningún resultado no va a mejorar solo; el resto del conjunto sí funciona.',
      cambio: { tipo: 'pausar', id: 'ej-ad-23' }, efecto: 'Unos 1,40 US$ al día que pasan a los anuncios del conjunto que sí traen clics.', riesgo: { reiniciaAprendizaje: false, gastaMas: false, texto: 'Ninguno: el conjunto ya salió del aprendizaje y pausar un anuncio no lo reinicia.' } }),
    s('ej-s-3', 'fatiga', { id: 'ej-ad-21', nivel: 'anuncio', nombre: 'Monturas otoño · carrusel' }, { prioridad: 2,
      dato: 'Frecuencia 3,8 y el CTR bajó de 2,1 % a 1,4 % contra sus primeros días.', porque: 'La misma gente ya lo vio casi 4 veces: el creativo se cansa antes que el público. Subir el presupuesto no lo arregla.',
      cambio: { tipo: 'creativos', id: 'ej-ad-21' }, efecto: 'Dos o tres variaciones del carrusel (otras fotos, el mismo mensaje) que devuelvan el CTR a su nivel de antes.', riesgo: { reiniciaAprendizaje: false, gastaMas: false, texto: 'Las imágenes del Estudio cuestan: te llega su tarjeta de costo antes de generar nada.' } }),
    s('ej-s-4', 'escalar', { id: 'ej-as-2', nivel: 'conjunto', nombre: 'Ciudad de Panamá · 15 km · 22–60' }, { prioridad: 2, gasto: true,
      dato: 'Cuesta 0,24 US$ por clic al enlace, un 88 % por debajo de tu objetivo, desde hace 6 días; fuera del aprendizaje.', porque: 'Va mejor que tu objetivo hace días y no está aprendiendo: es el momento de darle algo más, de a poco.',
      cambio: { tipo: 'subir_presupuesto', id: 'ej-as-2', valor: 8.4 }, efecto: 'Unos 6 clics más al día con el mismo costo por clic, si se mantiene.', riesgo: { reiniciaAprendizaje: false, gastaMas: true, texto: 'Un 20 % no reinicia el aprendizaje; más de eso, sí. La próxima subida, no antes de 48 a 72 horas.' } }),
    s('ej-s-5', 'rechazado', { id: 'ej-ad-12', nivel: 'anuncio', nombre: 'Combo lentes · antes y después' }, { prioridad: 1,
      dato: 'Meta lo rechazó: «el texto se dirige a una condición personal (¿Ves borroso?)».', porque: 'Las normas de Meta no dejan hablarle a alguien de su salud. Con otro texto puede volver a salir.',
      cambio: { tipo: 'borrador', id: 'ej-ad-12' }, efecto: 'Un borrador con el texto corregido por tu agente de anuncios, listo para revisar y crear en pausa.', riesgo: { reiniciaAprendizaje: false, gastaMas: false, texto: 'Ninguno: el borrador vive en la oficina y no se crea nada en Meta hasta que lo pidas.' } }),
    s('ej-s-6', 'problemas', { id: 'ej-ad-22', nivel: 'anuncio', nombre: 'Monturas otoño · video 9:16' }, { prioridad: 2,
      dato: 'Meta lo marca «con problemas»: el video no es 9:16 en todas sus partes.', porque: 'En historias y reels Meta lo recorta: sale, pero peor de lo que podría.',
      cambio: { tipo: 'revisar', id: 'ej-ad-22' }, efecto: 'Saber qué arreglar: un video 9:16 de punta a punta en el siguiente borrador.', riesgo: { reiniciaAprendizaje: false, gastaMas: false, texto: '' } }),
    s('ej-s-7', 'cortar', { id: 'ej-ad-31', nivel: 'anuncio', nombre: 'Septiembre · marca' }, { prioridad: 1, estado: 'aplicada', creadaAt: iso(ahora - 13 * DIA), aplicadaAt: iso(ahora - 12 * DIA),
      dato: 'Frecuencia 3,4 y ningún resultado medible en 10 días.', porque: 'Gastaba sin traer nada que se pudiera contar.', cambio: { tipo: 'pausar', id: 'ej-ad-31' }, efecto: 'Dejar de gastar unos 1,70 US$ al día.',
      riesgo: { reiniciaAprendizaje: false, gastaMas: false, texto: '' }, resultado: 'En los 7 días siguientes la cuenta gastó 11,90 US$ menos y los mensajes por WhatsApp siguieron igual (27 contra 26).' }),
    s('ej-s-8', 'limitado', { id: 'ej-as-3', nivel: 'conjunto', nombre: 'Todo Panamá · 18+' }, { prioridad: 3, estado: 'descartada', creadaAt: iso(ahora - 4 * DIA), descartadaAt: iso(ahora - 3 * DIA),
      dato: 'No llegó a salir del aprendizaje en 3 semanas.', porque: 'Con 60 US$ en total no junta resultados suficientes para que Meta aprenda.', cambio: { tipo: 'relanzar', id: 'ej-c-3' }, gasto: true,
      efecto: 'Relanzarla con más presupuesto u otro objetivo.', riesgo: { reiniciaAprendizaje: true, gastaMas: true, texto: '' } }),
  ];
}

/**
 * crearDemoSugerencias({ demo, demoB }) → { lista(), aplicar(id), descartar(id), posponer(id, dias), alConfirmar(id, r), alDeshacer(token) }.
 * `demo` es la de src/anuncios/demo.js (las acciones de la A2) y `demoB` la de los borradores (A3).
 */
export function crearDemoSugerencias({ demo, demoB, ahora = () => Date.now() } = {}) {
  const items = sugerenciasDeEjemplo(ahora()), porToken = new Map();
  const busca = id => items.find(s => s.id === id);
  const copia = s => structuredClone(s);
  const marcar = (s, extra = {}) => Object.assign(s, { estado: 'aplicada', aplicadaAt: new Date(ahora()).toISOString(), resultado: null }, extra);
  const viva = id => { const s = busca(id); if (!s) return [null, { status: 404, error: 'no', motivo: 'Esa sugerencia ya no está.' }]; if (s.estado !== 'viva') return [null, { status: 409, error: 'estado', motivo: s.estado === 'aplicada' ? 'Esa sugerencia ya se aplicó.' : 'Esa sugerencia ya no está viva.' }]; return [s, null]; };
  return {
    lista: () => {
      const t = ahora();
      for (const s of items) if (s.estado === 'pospuesta' && Date.parse(s.hasta) <= t) { s.estado = 'viva'; delete s.hasta; }
      return { status: 200, items: items.map(copia), cpaObjetivo: 2, sinObjetivo: null, ejemplo: true };
    },
    aplicar(id) {
      const [s, err] = viva(id); if (err) return err;
      const c = s.cambio || {};
      if (s.regla === 'aprendizaje' || s.regla === 'esperar' || c.tipo === 'revisar') return { status: 400, error: 'tipo', motivo: 'Esta sugerencia solo informa: no hay nada que aplicar.' };
      if (c.tipo === 'borrador') {
        const r = demoB.crear({ nombre: 'Combo lentes — texto corregido', objetivo: 'mensajes', destino: 'whatsapp',
          creativos: [{ id: 'cr-s5', media: 'demo/anu-combo.jpg', formato: '1:1', texto: 'Lentes con montura desde US$59, listos en 1 día. Escríbenos por WhatsApp y te apartamos el tuyo.', titular: 'Lentes + montura desde US$59', descripcion: '', llamada: 'WHATSAPP_MESSAGE' }] });
        marcar(s);
        return { status: 200, ok: true, borrador: r.borrador, hecho: { texto: 'Te dejé un borrador con el texto corregido (ejemplo): revísalo. No se crea nada en Meta hasta que pulses «Crear en Meta (en pausa)».' } };
      }
      if (c.tipo === 'creativos') { marcar(s); return { status: 200, ok: true, tarea: { id: 'ej-t-var', agent: 'ada', texto: `Variaciones del creativo de «${s.objeto.nombre}»` }, hecho: { texto: 'Le pedí a ANUNCIOS variaciones del creativo (ejemplo): te llegará la tarjeta de costo del Estudio.' } }; }
      const r = demo.accion({ tipo: c.tipo, id: c.id, ...(c.valor != null ? { valor: c.valor } : {}), ...(c.fin ? { fin: c.fin } : {}) });
      if (r.ok) { marcar(s); if (r.deshacer?.token) porToken.set(r.deshacer.token, s.id); }
      return r; // { confirmar } si gasta (el «Sí» va por la acción de la A2, con `sugerencia`), o el error con su cifra
    },
    /** El «Sí» de una que gasta pasó por demo.accion con `sugerencia`: queda aplicada. */
    alConfirmar(id, r) { const s = busca(id); if (s && r?.ok && s.estado === 'viva') { marcar(s); if (r.deshacer?.token) porToken.set(r.deshacer.token, s.id); } },
    /** DESHACER de lo aplicado: la sugerencia vuelve a estar viva. */
    alDeshacer(token) { const id = porToken.get(token); porToken.delete(token); const s = id && busca(id); if (s) Object.assign(s, { estado: 'viva', aplicadaAt: undefined, resultado: undefined }); },
    descartar(id) { const [s, err] = viva(id); if (err) return err; Object.assign(s, { estado: 'descartada', descartadaAt: new Date(ahora()).toISOString() }); return { status: 200, ok: true }; },
    posponer(id, dias = 3) { const [s, err] = viva(id); if (err) return err; Object.assign(s, { estado: 'pospuesta', hasta: new Date(ahora() + Math.max(1, Number(dias) || 3) * DIA).toISOString() }); return { status: 200, ok: true }; },
  };
}
