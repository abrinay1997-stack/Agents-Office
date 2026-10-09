// ============================================================
// Agents Office — Anuncios de Meta, Fase A3 (9 oct 2026): el ALMACÉN de los borradores de campaña.
//   data/anuncios/borradores.json   { items: [borrador] }      (escritura atómica: a un temporal y renombrar)
//   data/anuncios/papelera.json     { items: [{ ...borrador, quitadoAt, quitadoPor }] }   (lo quitado no se pierde; los 200 últimos)
// No viaja por GitHub (data/): presupuestos, públicos y textos sin publicar son del negocio.
//
// QUIÉN (lo decide anuncios/rutas.mjs con `quien`; aquí se aplica):
//   · el dueño y Dimitri: crean y cambian cualquier borrador que no esté «creando» ni «creado»;
//   · un agente: crea (nace `de: 'agente:<id>'`) y cambia SOLO los suyos y solo mientras están en «borrador»;
//   · nadie cambia uno «creado» (409): lo que ya está en Meta se toca desde Campañas;
//   · quitar (a la papelera): solo el dueño; o deshacer la op de Dimitri/el asistente que lo creó.
// Lo que pone el servidor (estado, validacion, meta, error, progreso) entra solo por `poner()`.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { normalizarBorrador, ErrorBorrador } from './modelo.mjs';

const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };
const escribirJSON = (f, datos) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(datos, null, 1)); fs.renameSync(f + '.tmp', f); };
export const MAX_BORRADORES = 300, MAX_PAPELERA = 200;

/**
 * @param {object} o
 * @param {string} o.dir      data/anuncios
 * @param {Function} o.ajustes () → cfg.anuncios (los valores por defecto: el WhatsApp decide el destino de «que me escriban»)
 */
export function crearBorradores({ dir, ajustes = () => ({}), ahora = () => Date.now() }) {
  const F = { lista: path.join(dir, 'borradores.json'), papelera: path.join(dir, 'papelera.json') };
  const todos = () => { const j = leerJSON(F.lista, { items: [] }); return Array.isArray(j.items) ? j.items : []; };
  const guardarTodos = l => escribirJSON(F.lista, { items: l });

  /** Lo más nuevo primero. */
  const lista = () => todos().slice().sort((a, b) => String(b.creadoAt).localeCompare(String(a.creadoAt)));
  const leer = id => todos().find(b => b.id === id) || null;

  /** Uno nuevo. `de`: 'dueno' · 'dimitri' · 'asistente' · 'agente:<id>'. */
  function crear(entrada = {}, { de = 'dueno' } = {}) {
    const l = todos();
    if (l.length >= MAX_BORRADORES) throw new ErrorBorrador(`Hay ${l.length} borradores: quita alguno antes de hacer otro.`, 409);
    const b = normalizarBorrador(entrada, null, { ajustes: ajustes() || {}, ahora: ahora(), de });
    while (l.some(x => x.id === b.id)) b.id += Math.random().toString(36).slice(2, 4);
    l.push(b); guardarTodos(l); return b;
  }

  /** Cambiar lo que dice. `agente`: el id del agente que pide (solo los suyos y en «borrador»). */
  function cambiar(id, entrada = {}, { quien = 'dueno', agente = null } = {}) {
    const l = todos(), i = l.findIndex(b => b.id === id);
    if (i < 0) throw new ErrorBorrador('Ese borrador no existe (¿se quitó?).', 404);
    const prev = l[i];
    if (prev.estado === 'creado') throw new ErrorBorrador('Ese borrador ya está creado en Meta: cámbialo desde Campañas.', 409);
    if (prev.estado === 'creando') throw new ErrorBorrador('Se está creando en Meta ahora mismo: espera a que termine.', 409);
    if (quien === 'agente') {
      if (prev.de !== `agente:${agente}`) throw new ErrorBorrador('Un agente solo cambia sus propios borradores.', 403);
      if (prev.estado !== 'borrador') throw new ErrorBorrador('Ese borrador ya no está en borrador: lo decide el dueño.', 409);
    }
    const b = normalizarBorrador(entrada, prev, { ajustes: ajustes() || {}, ahora: ahora() });
    l[i] = b; guardarTodos(l); return b;
  }

  /** Lo que pone el servidor (estado, validacion, meta, error, progreso): sin normalizar lo del dueño. */
  function poner(id, campos = {}) {
    const l = todos(), i = l.findIndex(b => b.id === id); if (i < 0) return null;
    const permitidos = ['estado', 'validacion', 'meta', 'error', 'progreso'];
    for (const k of permitidos) if (k in campos) l[i][k] = campos[k];
    guardarTodos(l); return l[i];
  }

  /** A la papelera (no se pierde). Uno «creando» no: todavía puede estar a medias en Meta. */
  function quitar(id, { por = 'dueno' } = {}) {
    const l = todos(), i = l.findIndex(b => b.id === id);
    if (i < 0) throw new ErrorBorrador('Ese borrador no existe (¿ya se quitó?).', 404);
    if (l[i].estado === 'creando') throw new ErrorBorrador('Se está creando en Meta ahora mismo: espera a que termine.', 409);
    const [b] = l.splice(i, 1);
    const p = leerJSON(F.papelera, { items: [] }); const items = Array.isArray(p.items) ? p.items : [];
    items.push({ ...b, quitadoAt: new Date(ahora()).toISOString(), quitadoPor: por });
    escribirJSON(F.papelera, { items: items.slice(-MAX_PAPELERA) });
    guardarTodos(l); return b;
  }
  const papelera = () => { const p = leerJSON(F.papelera, { items: [] }); return (Array.isArray(p.items) ? p.items : []).slice().reverse(); };

  return { lista, leer, crear, cambiar, poner, quitar, papelera, archivo: F.lista };
}
