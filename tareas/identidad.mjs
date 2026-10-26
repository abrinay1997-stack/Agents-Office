// Agents Office (26 oct 2026) — QUIÉN ES «YO» en las tareas. Antes la oficina pensaba en un solo dueño: «Tú». En la nube hay cuentas de verdad
// (administradores, editores…), y el dueño pidió poder ASIGNAR una tarea a cualquiera de ellas y que le salga en SU «Mías».
//   · Oficina local (sin cuentas): yo = null → mis tareas son las de `person: 'Tú'`, como siempre.
//   · Nube: yo = { nombre, admin } → mis tareas son las que tienen `person: <mi nombre>`; y si soy administrador, también las del dueño (`'Tú'`: lo que
//     llega de Telegram, de Dimitri o de lo que sucede cuando un agente se bloquea y pide algo). Un editor no ve la lista del dueño.
// El NOMBRE de una cuenta es único entre las activas (lib/equipo.js → nombreOcupado), así que sirve de llave; «Tú» está reservado (nadie puede llamarse así).
// Puro, sin imports. El servidor SIEMPRE pasa `yo` explícito (una petición no puede heredar la identidad de otra); la página lo lee de window.AO_NUBE
// (cloudflare/public/nube.js), que en Node y en el Worker no existe.

export const DUENO = 'Tú';

/** La identidad de quien mira la página: { nombre, admin } en la nube con sesión; null en la oficina local (y siempre fuera del navegador). */
export function yoPagina() {
  const u = globalThis.AO_NUBE?.yo?.();
  return u && typeof u.nombre === 'string' && u.nombre ? { nombre: u.nombre, admin: u.rol === 'admin' } : null;
}
/** Los nombres con los que una tarea cuenta como mía. */
export const nombresMios = yo => (yo && yo.nombre ? [yo.nombre, ...(yo.admin ? [DUENO] : [])] : [DUENO]);
/** ¿Esta tarea la tiene una persona y esa persona soy yo? `yo` omitido: el de la página; `null`: sin cuentas (solo «Tú»). */
export const esMia = (t, yo = yoPagina()) => !!t && !!t.person && nombresMios(yo).includes(t.person);
/** Cómo me llamo en lo que escribo (comentarios, cronómetro, «la pasó…»): mi nombre, o «Tú» sin cuentas. */
export const miNombre = (yo = yoPagina()) => (yo && yo.nombre) || DUENO;
/** ¿La delegó alguien que soy yo? (`delegada.por` lo apunta; las de antes no lo traen: se cuentan mías.) */
export const delegoYo = (t, yo = yoPagina()) => !t?.delegada?.por || nombresMios(yo).includes(t.delegada.por);
/** ¿Este nombre soy yo? («Tú» siempre; y mi nombre de cuenta.) Sirve para no ofrecerme a mí mismo como a quien asignar. */
export const esNombreMio = (n, yo = yoPagina()) => n === DUENO || (!!yo && !!yo.nombre && n === yo.nombre);
