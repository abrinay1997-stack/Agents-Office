// CONECTORES MCP de los agentes (Zapier, n8n, Gmail…) por el conector MCP (P5, carril «empresa»): ver la lista, su estado y qué herramientas LEEN y cuáles ENVÍAN, y apagar o volver a habilitar uno que
// YA existe. NUNCA tokens (ni leídos ni escritos), ni añadir conectores nuevos, ni cambiar su autenticación o sus dominios: eso es del dueño en Ajustes → Conectores. El candado de envío no cambia:
// habilitar un conector solo lo pone al alcance de los agentes, y una herramienta de envío sigue corriendo solo en una ejecución aprobada.
import { registrarHerramienta } from '../registro.js';
import { conOficina, fallo, rechazo, idem, limpio, externo, lineas } from '../empresa/comun.js';

export const RUTAS = Object.freeze(['GET /api/conectores', 'PATCH /api/conectores/:nombre', 'GET /api/mcp']);
export const LEE = ['lista', 'estado', 'herramientas'];
export const CAMBIA = ['apagar', 'habilitar'];
const NOMBRE = /^[a-z][a-z0-9-]{1,39}$/;
const ESTADO = { connected: 'conectado', 'needs-auth': 'falta su token', disabled: 'apagado', failed: 'no conecta' };

const hostDe = (u) => { try { return new URL(u).host; } catch { return ''; } };
async function servidores(office) { return (await office('/api/mcp')).servers?.filter((s) => !s.office) || []; }

async function lista(office) {
  const [mcp, cx] = await Promise.all([servidores(office), office('/api/conectores').catch(() => ({ conectores: [] }))]);
  const por = new Map((cx.conectores || []).map((c) => [c.nombre, c]));
  const lin = mcp.map((s) => {
    const c = por.get(s.raw) || {}, lee = Object.values(s.kinds || {}).filter((k) => k === 'read').length, envia = Object.values(s.kinds || {}).filter((k) => k !== 'read').length;
    const token = c.tokenGuardado ? ' · token guardado' : c.secreto ? ' · token en un secreto del Worker' : '';
    const donde = externo(s.target || hostDe(c.url), 60) || 'sin dirección';
    return `- ${externo(s.raw, 40)} (${externo(s.name, 40)}) · ${ESTADO[s.status] || externo(s.status, 16)} · ${donde} · ${(s.depts || []).join(', ') || 'ningún departamento'}` +
      ` · ${lee} leen / ${envia} envían${s.allowed === false ? ' · vetado a los agentes' : ''}${token}`;
  });
  return lin.length ? `Conectores MCP de la oficina (${lin.length}):\n${lineas(lin, 40).join('\n')}` : 'No hay conectores MCP conectados todavía.';
}
async function estado(office) {
  const s = await servidores(office), cuenta = {};
  for (const x of s) cuenta[x.status] = (cuenta[x.status] || 0) + 1;
  const mal = s.filter((x) => x.status !== 'connected').map((x) => `- ${externo(x.raw, 40)}: ${ESTADO[x.status] || externo(x.status, 16)}${x.detail ? ' — ' + externo(x.detail, 160) : ''}`);
  return [`${s.length} conectores: ${Object.entries(cuenta).map(([k, n]) => `${n} ${ESTADO[k] || limpio(k, 16)}`).join(', ') || 'ninguno'}.`, ...(mal.length ? ['Los que necesitan atención:', ...lineas(mal, 15)] : ['Todos al día.'])].join('\n');
}
async function herramientas(office, nombre) {
  const s = (await servidores(office)).find((x) => x.raw === nombre);
  if (!s) return `No hay un conector «${limpio(nombre, 40)}». Mira la lista con accion «lista».`;
  const k = Object.entries(s.kinds || {}), lee = k.filter(([, v]) => v === 'read').map(([t]) => externo(t, 60)), envia = k.filter(([, v]) => v !== 'read').map(([t]) => externo(t, 60));
  const aprobada = 'solo corren en una ejecución aprobada por un administrador';
  return [`${externo(s.name, 40)} — ${ESTADO[s.status] || externo(s.status, 16)}.`, `LEEN (${lee.length}): ${lineas(lee, 40).join(', ') || 'ninguna'}`,
    `ENVÍAN o cambian datos (${envia.length}; ${aprobada}): ${lineas(envia, 40).join(', ') || 'ninguna'}`].join('\n');
}

registrarHerramienta({
  nombre: 'conectores',
  titulo: 'Conectores de los agentes',
  descripcion: 'Lee los conectores MCP que usan los agentes (Zapier, n8n, Gmail…), sin tokens. accion: lista (estado, dirección, departamentos, cuántas herramientas ' +
    'leen o envían) · estado (cuáles necesitan atención) · herramientas (`nombre`: qué lee y qué envía ese conector). Solo lee.',
  esquema: { type: 'object', additionalProperties: false, required: ['accion'], properties: { accion: { type: 'string', enum: LEE }, nombre: { type: 'string', maxLength: 40, description: 'El conector (solo con «herramientas»).' } } },
  alcance: 'lectura', soloLectura: true,
  ejecutar: async (ctx, a) => {
    try {
      const office = await conOficina(ctx, a.accion === 'lista' ? ['GET /api/mcp', 'GET /api/conectores'] : ['GET /api/mcp']);
      if (a.accion === 'herramientas') return { texto: await herramientas(office, String(a.nombre || '')) };
      return { texto: await (a.accion === 'estado' ? estado : lista)(office) };
    } catch (e) { return fallo('conectores', e); }
  },
});

registrarHerramienta({
  nombre: 'conectores_cambiar',
  titulo: 'Apagar o volver a habilitar un conector',
  descripcion: 'accion: apagar o habilitar un conector que YA existe (`nombre`). Apagado, los agentes dejan de verlo; la configuración y el token se quedan. No añade conectores, no cambia su autenticación ni toca tokens: eso lo hace ' +
    'el dueño en Ajustes → Conectores. Habilitar un conector no abre los envíos: una herramienta de envío solo corre en una ejecución aprobada por un administrador.',
  esquema: { type: 'object', additionalProperties: false, required: ['accion', 'nombre'], properties: { accion: { type: 'string', enum: CAMBIA }, nombre: { type: 'string', maxLength: 40 } } },
  alcance: 'oficina', soloLectura: false, idempotente: true,
  ejecutar: async (ctx, a) => {
    try {
      const nombre = String(a.nombre || '');
      if (!NOMBRE.test(nombre)) return rechazo('«nombre» es el del conector: minúsculas, números y «-».');
      return await idem(ctx, 'conectores_cambiar', async () => {
        const lee = await conOficina(ctx, ['GET /api/conectores']), activo = a.accion === 'habilitar';
        const c = ((await lee('/api/conectores')).conectores || []).find((x) => x.nombre === nombre);
        if (!c) return rechazo(`No hay un conector «${limpio(nombre, 40)}»: este conector MCP no los crea (eso lo hace el dueño en la oficina).`);
        if (!!c.activo === activo) return { texto: `El conector «${nombre}» ya estaba ${activo ? 'habilitado' : 'apagado'}: no cambié nada.` };
        await (await conOficina(ctx, [`PATCH /api/conectores/${nombre}`]))(`/api/conectores/${nombre}`, { activo }, 'PATCH');
        return { texto: `Conector «${nombre}»: ${activo ? 'habilitado otra vez (los agentes lo vuelven a ver)' : 'apagado (los agentes dejan de verlo; su configuración y su token se quedan)'}.` };
      });
    } catch (e) { return fallo('conectores_cambiar', e); }
  },
});
