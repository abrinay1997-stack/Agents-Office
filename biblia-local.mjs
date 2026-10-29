// Agents Office (29 oct 2026) — Fase 11.2 (carril K), oficina local: la biblia visual y las hojas de personaje como notas del Cerebro.
// La lógica está en biblia-core.mjs; aquí solo se junta con el disco y el modelo, todo inyectado (se prueba sin red).
//   · Archivos FIJOS: <cerebro>/Marca/biblia-visual.md y <cerebro>/Estudio/Personajes/<nombre>.md. Nunca se arma una ruta con lo que llega, salvo el nombre de una hoja, ya validado.
//   · `leer()`, `hojas()` y `linea()` no gastan. `proponer()` llama a un modelo (poco, pero llama): exige el flag `dimitri.series` y el costo confirmado, y solo el dueño.
//   · `guardar()` es del dueño. La versión sube SOLO si el contenido cambió; la anterior se guarda en <data>/history/biblias/ (se puede volver a ella a mano).
//   · Nada de aquí genera imágenes ni gasta en el Estudio; un agente (por:'agente') solo lee.
import fs from 'node:fs';
import path from 'node:path';
import * as B from './biblia-core.mjs';
import * as N from './notas-core.mjs';

export const USD_PROPUESTA = 0.05; // estimado de UNA propuesta (se rotula «estimado» donde se muestre)

export function crearBiblia({ BRAIN, DATA, renombrar, ask, notas = () => [], imagenes = () => [], medidos = () => [], ahora = () => Date.now(), activo = () => false, presupuesto = null }) {
  const archivo = path.join(BRAIN, 'Marca', 'biblia-visual.md');
  const dirHojas = path.join(BRAIN, 'Estudio', 'Personajes');
  const dirHistoria = path.join(DATA, 'history', 'biblias');
  const escribir = (destino, texto) => { fs.mkdirSync(path.dirname(destino), { recursive: true }); const tmp = destino + '.tmp-' + process.pid + '-' + Date.now(); fs.writeFileSync(tmp, texto, 'utf8'); renombrar(tmp, destino); };
  const err = (estado, error, extra = {}) => ({ estado, cuerpo: { error, ...extra } });
  let proponiendo = false; // dinero: un solo pedido a la vez (dos clics seguidos no cobran dos veces)

  /** La biblia de ahora (o que aún no hay). */
  function leer() {
    if (!fs.existsSync(archivo)) return { existe: false, version: 0, estado: null, biblia: B.normalizarBiblia({}), problemas: [] };
    const r = B.leerBiblia(fs.readFileSync(archivo, 'utf8'));
    if (r.error) return { existe: true, error: r.error, version: 0, estado: null, biblia: B.normalizarBiblia({}), problemas: [] };
    return { existe: true, version: r.version, estado: r.estado, aprobada_por: r.aprobada_por, biblia: r.biblia, problemas: B.validarBiblia(r.biblia) };
  }
  /** Lo que lleva cada pedido de serie: solo si la biblia está APROBADA. → { version, linea, anclas } | null */
  function linea() { const b = leer(); return b.existe && !b.error && b.estado === 'aprobada' ? { version: b.version, linea: B.lineaDeBiblia(b.biblia, b.version), anclas: B.anclasDeBiblia(b.biblia) } : null; }

  async function proponer({ por = 'dueno', confirmarUsd = 0 } = {}) {
    if (por !== 'dueno') return err(403, 'Proponer la biblia visual es del dueño.');
    if (!activo()) return err(409, 'Las series están apagadas (office.config.json → dimitri.series).');
    if (!(Number(confirmarUsd) >= USD_PROPUESTA)) return err(409, `Proponer la biblia cuesta unos US$${USD_PROPUESTA.toFixed(2)} (estimado) y no confirmaste ese costo.`, { costoEstimadoUsd: USD_PROPUESTA });
    if (proponiendo) return err(409, 'Ya hay una propuesta en marcha; espera a que termine.');
    proponiendo = true;
    try { return await proponerLibre(); } finally { proponiendo = false; }
  }
  async function proponerLibre() {
    try { presupuesto?.revisar(USD_PROPUESTA); } catch (e) { return err(409, e.message); }
    const imgs = imagenes(), nts = notas(), med = medidos();
    if (!nts.length && !imgs.length) return err(409, 'No hay con qué proponerla: ni notas de marca en el Cerebro ni imágenes aprobadas y descritas.');
    const { system, user } = B.promptProponerBiblia({ notas: nts, imagenes: imgs, medidos: med });
    let r; try { r = await ask(system, user, { kind: 'biblia', maxTokens: 2500, timeout: 120000, tools: false }); } catch (e) { return err(502, `El modelo no contestó: ${e.message}`); }
    presupuesto?.cobrar(Number(r.usd) || 0);
    const p = B.leerPropuestaBiblia(r.text, { idsConocidos: imgs.map(f => f.file || f.id) });
    if (p.error) return err(422, p.error);
    const ida = med.length ? B.idaYVuelta(p.biblia.paleta, med) : { ok: false, medido: false, motivo: 'No medido' };
    return { estado: 200, cuerpo: { ...p, idaYVuelta: ida, gastoUsd: Number(r.usd) || 0, nota: 'Es una PROPUESTA: no se guarda hasta que la revises y la apruebes.' } };
  }

  /** Guarda lo que el dueño corrigió. `aprobar: true` la deja vigente (la que citan las series). */
  function guardar({ biblia, aprobar = false, por = 'dueno', nombre = '' } = {}) {
    if (por !== 'dueno') return err(403, 'Guardar la biblia visual es del dueño.');
    const nueva = B.normalizarBiblia(biblia), problemas = B.validarBiblia(nueva), errores = problemas.filter(p => p.nivel === 'error');
    if (aprobar && errores.length) return err(422, 'No se puede aprobar: ' + errores.map(e => e.motivo).join(' '), { problemas });
    const antes = leer(), sana = antes.existe && !antes.error;
    const guardarCopia = nombre => { try { fs.mkdirSync(dirHistoria, { recursive: true }); fs.copyFileSync(archivo, path.join(dirHistoria, nombre)); } catch { /* sin historial no se frena el guardado */ } };
    if (antes.existe && antes.error) guardarCopia(`roto-${ahora()}.md`); // una nota dañada a mano se conserva antes de escribir encima
    const version = sana ? B.versionSiguiente({ version: antes.version, biblia: antes.biblia }, nueva) : 1;
    if (sana && version !== antes.version) guardarCopia(`biblia-visual-v${antes.version}-${B.huellaBiblia(antes.biblia).slice(0, 8)}.md`); // el hash evita pisar un historial viejo
    const estado = aprobar ? 'aprobada' : (antes.estado === 'aprobada' && version === antes.version ? 'aprobada' : 'propuesta');
    const desaprobada = !aprobar && antes.estado === 'aprobada' && estado === 'propuesta'; // editar sin aprobar quita la vigencia: se dice
    escribir(archivo, B.serializarBiblia(nueva, { version, estado, aprobada_por: estado === 'aprobada' ? (nombre || 'dueño') : '', at: ahora() }));
    return { estado: 200, cuerpo: { ok: true, version, estado, cambio: !antes.existe || version !== antes.version, desaprobada, problemas } };
  }

  function hojas() {
    if (!fs.existsSync(dirHojas)) return [];
    return fs.readdirSync(dirHojas).filter(f => f.endsWith('.md')).sort().map(f => { try { const r = B.leerHoja(fs.readFileSync(path.join(dirHojas, f), 'utf8')); return r.ok ? { ...r.hoja, problemas: B.validarHoja(r.hoja) } : null; } catch { return null; } }).filter(Boolean);
  }
  function guardarHoja({ hoja, por = 'dueno' } = {}) {
    if (por !== 'dueno') return err(403, 'Guardar una hoja es del dueño.');
    const h = B.normalizarHoja(hoja), n = N.nombreValido(h.nombre); if (!n.ok) return err(400, n.error);
    const problemas = B.validarHoja(h), errores = problemas.filter(p => p.nivel === 'error'); if (errores.length) return err(422, errores.map(e => e.motivo).join(' '), { problemas });
    const destino = path.join(dirHojas, n.nombre + '.md'); if (path.relative(dirHojas, destino).startsWith('..')) return err(400, 'Nombre no válido.');
    escribir(destino, B.serializarHoja({ ...h, nombre: n.nombre })); return { estado: 200, cuerpo: { ok: true, nombre: n.nombre, problemas } };
  }

  /** Las rutas, sin tocar http: → { estado, cuerpo } | null (no es mía). `agente` = quien llama es un agente. */
  async function ruta(metodo, pathname, { query = {}, cuerpo = {}, agente = false } = {}) {
    const por = agente ? 'agente' : 'dueno';
    if (pathname === '/api/biblia' && metodo === 'GET') return { estado: 200, cuerpo: { ...leer(), linea: linea(), activo: activo() } };
    if (pathname === '/api/biblia' && metodo === 'PUT') return guardar({ biblia: cuerpo.biblia, aprobar: cuerpo.aprobar === true, por });
    if (pathname === '/api/biblia/proponer' && metodo === 'POST') return proponer({ por, confirmarUsd: cuerpo.confirmarUsd });
    if (pathname === '/api/biblia/personajes' && metodo === 'GET') return { estado: 200, cuerpo: { hojas: hojas() } };
    if (pathname === '/api/biblia/personajes' && metodo === 'PUT') return guardarHoja({ hoja: cuerpo.hoja, por });
    void query; return null;
  }
  return { leer, linea, proponer, guardar, hojas, guardarHoja, ruta };
}
