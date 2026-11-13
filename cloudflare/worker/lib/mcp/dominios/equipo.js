// EQUIPO por el conector MCP (P5, carril «empresa»): SOLO LECTURA. Quién hay en la oficina (las personas a las que se puede asignar trabajo y las cuentas con su rol), sin contraseñas, sin enlaces de
// invitación, sin ids de Telegram y con los correos acortados. Invitar, quitar, cambiar un rol o una contraseña NO existe por este conector (empresa/datos.js → EXCLUIDO.personas): lo hace un
// administrador en la oficina. El chat interno del equipo es privado: tampoco se lee aquí.
import { registrarHerramienta } from '../registro.js';
import { conOficina, fallo, limpio, externo, correoCorto, lineas } from '../empresa/comun.js';

export const RUTAS = Object.freeze(['GET /api/team', 'GET /api/equipo']);
export const LEE = ['personas', 'cuentas'];

async function personas(office) {
  const t = await office('/api/team'), p = Array.isArray(t.people) ? t.people : [];
  const lin = p.map((x) => `- ${externo(x.name, 50)}${x.rol ? ' · ' + limpio(x.rol, 12) : ''}${Array.isArray(x.depts) && x.depts.length ? ' · ' + x.depts.map((d) => limpio(d, 16)).join(', ') : ''}${x.usuario ? ' · tiene cuenta' : ''}`);
  return lin.length ? `Personas a las que se puede asignar trabajo (${lin.length}):\n${lineas(lin, 60).join('\n')}` : 'No hay personas en el equipo todavía.';
}
async function cuentas(office) {
  const e = await office('/api/equipo'), m = Array.isArray(e.miembros) ? e.miembros : [];
  const lin = m.map((x) => `- ${externo(x.nombre, 50)} · ${limpio(x.rol, 12)} · ${correoCorto(x.email) || 'sin correo visible'}${x.fundador ? ' · fundador' : ''}`);
  const pend = Array.isArray(e.invitaciones) ? e.invitaciones.length : 0;
  return [`Cuentas de la oficina (${lin.length}); roles: ${Array.isArray(e.roles) ? e.roles.map((r) => limpio(r?.id ?? r, 12)).join(', ') : 'admin, editor, lectura'}.`, ...lineas(lin, 60), `Invitaciones pendientes: ${pend}.`, '(Invitar, ' +
    'quitar o cambiar un rol se hace en la oficina, no por este conector.)'].join('\n');
}

registrarHerramienta({
  nombre: 'equipo',
  titulo: 'Equipo y cuentas',
  descripcion: 'Lee quién hay: personas a las que se asigna trabajo y cuentas con su rol, con correos acortados y sin contraseñas, enlaces ni ids de Telegram. Solo lee.',
  esquema: { type: 'object', additionalProperties: false, required: ['accion'], properties: { accion: { type: 'string', enum: LEE } } },
  alcance: 'lectura', soloLectura: true,
  ejecutar: async (ctx, a) => {
    try { return { texto: await (a.accion === 'cuentas' ? cuentas : personas)(await conOficina(ctx, [a.accion === 'cuentas' ? 'GET /api/equipo' : 'GET /api/team'])) }; } catch (e) { return fallo('equipo', e); }
  },
});
