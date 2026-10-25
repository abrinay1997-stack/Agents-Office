// Exportador de Contenido para la nube (fase 5): lee de ESTA computadora las piezas (notas .md con su cabecera), la cola de publicación, la agenda de Meta,
// el simulacro, las mejores horas y la foto diaria de Analíticas, y lo devuelve en la forma que sube scripts/migrar-a-nube.mjs:
//   { filas: { coleccion: [{ id, valor, orden? }] }, docs: { clave: valor } }
// La nube lo adopta en sus tablas la primera vez que se usa Contenido (cloudflare/worker/lib/contenido/migracion.js). Solo LEE; nunca lleva una key, un token ni una contraseña:
// los tokens de Meta y de Metricool son variables de entorno de esta computadora y se ponen aparte como secretos de Cloudflare.
//
// CUIDADOS (léelos antes de migrar de verdad):
//  · El modo se exporta SIEMPRE como «simulacro». Que la nube publique de verdad lo decide el dueño (PUT /api/contenido/config), y solo DESPUÉS de apagar la publicación
//    en esta computadora (Ajustes → Contenido → modo «apagado»): si las dos publican lo mismo, sale dos veces.
//  · La cola y la agenda de Meta van para que lo que ya salió (o está programado en Meta) no se vuelva a mandar.
//  · Las miniaturas de Analíticas no viajan (son archivos): la primera foto en la nube las vuelve a bajar.
//  · Las piezas llevan las medidas de sus archivos (ancho, alto, duración) leídas del registro del Estudio, para que las reglas de proporción sigan funcionando. Los archivos del
//    Estudio en sí (imágenes y videos) los sube la fase del Estudio a R2 con la misma clave (`2026-10/<archivo>`).
import fs from 'node:fs';
import path from 'node:path';
import { parsear, REDES } from '../../contenido/piezas-core.mjs';
import { medidaDelEstudio } from '../../contenido/piezas.mjs';

const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };
const lista = d => { try { return fs.readdirSync(d); } catch { return []; } };

export async function exportar({ raiz, vault }) {
  const data = process.env.AO_DATA || path.join(raiz, 'data');
  const brain = path.join(vault, 'Agents Office');
  const dirPiezas = path.join(brain, 'contenido'), medidas = medidaDelEstudio(path.join(brain, 'media')), cont = path.join(data, 'contenido');
  const filas = {}, docs = {}, dc = []; // los «documentos» van como filas de `contenido-docs`: la nube los adopta SIN pisar lo que ya tenga (repetir la migración no deshace lo hecho allá)

  // las piezas (no la papelera)
  const piezas = [];
  for (const mes of lista(dirPiezas).filter(m => /^\d{4}-\d{2}$/.test(m) || m === 'sin-fecha')) {
    for (const f of lista(path.join(dirPiezas, mes)).filter(x => x.endsWith('.md'))) {
      try {
        const p = parsear(fs.readFileSync(path.join(dirPiezas, mes, f), 'utf8'), { file: f });
        if (!/^p-\d{8}-[a-f0-9]{4,8}$/.test(p.id)) continue;
        const m = {}; for (const id of [...p.medios, ...p.historias]) { const x = medidas(id); if (x) m[id] = x; }
        piezas.push({ id: p.id, valor: { ...p, medidas: m }, orden: Date.parse(p.creada) || 0 });
      } catch { /* una nota rota no frena la migración */ }
    }
  }
  if (piezas.length) filas['contenido-piezas'] = piezas;

  // la cola y lo que Meta/el simulacro ya tienen apuntado (para no mandar dos veces lo que ya salió)
  const cola = leerJSON(path.join(cont, 'cola.json'), { entradas: {} }).entradas || {};
  if (Object.keys(cola).length) filas['contenido-cola'] = Object.entries(cola).map(([id, valor]) => ({ id, valor }));
  const agenda = leerJSON(path.join(cont, 'meta-agenda.json'), null); if (agenda?.trabajos) dc.push({ id: 'contenido.meta.agenda', valor: agenda });
  const sim = leerJSON(path.join(cont, 'simulacro.json'), null); if (sim?.posts) dc.push({ id: 'contenido.simulacro', valor: sim });
  const horas = leerJSON(path.join(cont, 'mejores-horas.json'), null); if (horas && Object.keys(horas).length) dc.push({ id: 'contenido.mejores-horas', valor: horas });

  // la foto diaria de Analíticas (cuentas, días y publicaciones; sin las miniaturas, que son archivos)
  const dias = [];
  for (const f of lista(path.join(cont, 'metricas')).filter(x => /^dias-\d{4}-\d{2}\.json$/.test(x))) for (const [id, valor] of Object.entries(leerJSON(path.join(cont, 'metricas', f), {}))) dias.push({ id, valor });
  if (dias.length) filas['contenido-dias'] = dias;
  const pubs = leerJSON(path.join(cont, 'metricas', 'publicaciones.json'), {});
  if (Object.keys(pubs).length) filas['contenido-pubs'] = Object.entries(pubs).map(([id, v]) => ({ id, valor: { ...v, miniatura: '' }, orden: -(Date.parse(v.publicadaAt) || 0) }));
  const cuentas = leerJSON(path.join(cont, 'cuentas.json'), null);
  if (cuentas?.cuentas?.length) dc.push({ id: 'contenido.meta.cuentas', valor: { cuentas: cuentas.cuentas, token: cuentas.token ? { ...cuentas.token } : null, sincronizadaAt: cuentas.sincronizadaAt || null, error: null } });

  // los ajustes de Contenido (de office.config; el modo SIEMPRE «simulacro»)
  let cfg = {}; try { cfg = (await import('../../config.mjs')).loadConfig().contenido || {}; } catch { /* sin config */ }
  const zona = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Panama'; } catch { return 'America/Panama'; } })();
  dc.push({ id: 'config.contenido', valor: {
    modo: 'simulacro', conductor: ['metricool', 'meta'].includes(cfg.conductor) ? cfg.conductor : 'metricool',
    entregarHorasAntes: Number.isFinite(Number(cfg.entregarHorasAntes)) ? Number(cfg.entregarHorasAntes) : 24, metaPagina: /^[A-Za-z0-9_]{1,40}$/.test(String(cfg.metaPagina || '')) ? String(cfg.metaPagina) : '',
    redes: Array.isArray(cfg.redes) ? cfg.redes.filter(r => REDES.includes(r)) : ['instagram', 'facebook'], departamentos: Array.isArray(cfg.departments) ? cfg.departments : ['marketing', 'delivery'], zona,
    bandejaFuente: ['auto', 'meta', 'metricool', 'ambas'].includes(cfg.bandejaFuente) ? cfg.bandejaFuente : 'auto',
  } });
  filas['contenido-docs'] = dc;
  return { filas, docs };
}
