// Agents Office (6 oct 2026, plan T6 · §4) — WEBHOOKS SALIENTES de las tareas: cuando una tarea se crea, cambia de estado o se borra, la
// oficina avisa a Zapier, Make, n8n o lo que el dueño quiera. Un despachador más del bus (eventos.mjs).
//   office.config(.local).json → "tareas": { "webhooks": [ { "id": "zapier", "url": "https://hooks.zapier.com/…", "eventos": ["tarea.estado"],
//                                                       "secreto": "AO_WEBHOOK_ZAPIER" } ] }
//   · "secreto" es el NOMBRE de una variable de entorno (la clave nunca va en un archivo): con ella, cada envío lleva
//     X-AO-Firma: sha256=<HMAC del cuerpo>, para que el otro lado sepa que viene de la oficina.
//   · Solo https (http solo a esta máquina con permitirLocal, para pruebas) y nunca a una dirección privada (SSRF).
//   · 3 intentos (1 s, 5 s, 30 s); tras 10 fallos seguidos se apaga solo y avisa. Historial de los últimos 50 en data/tareas/webhooks.json.
//   · Lo que sale es lo justo (id, título, estado, departamento, agente, prioridad, fecha límite, proyecto, quién): nunca el resultado,
//     el borrador ni los comentarios (pueden traer datos de clientes).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)

export const EVENTOS = ['tarea.creada', 'tarea.estado', 'tarea.borrada', 'tarea.cambio'];
const ESPERAS = [1000, 5000, 30000], MAX_FALLOS = 10;

export function privada(ip) {
  if (net.isIPv4(ip)) { const [a, b] = ip.split('.').map(Number); return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224; }
  const x = ip.toLowerCase(); return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80') || x.startsWith('::ffff:') && privada(x.slice(7));
}
export function revisarDestino(url, { permitirLocal = false } = {}) {
  let u; try { u = new URL(url); } catch { return { error: 'no es una dirección' }; }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(permitirLocal && local && u.protocol === 'http:')) return { error: 'solo https' };
  if (u.username || u.password) return { error: 'sin usuario ni clave en la dirección' };
  return { url: u, local };
}
export const resumenTarea = t => ({ id: t.id, titulo: t.title, estado: t.state, fallo: !!t.error, departamento: t.dept, agente: t.agent, persona: t.person || null, prioridad: t.prioridad || 'media', limite: t.limite || null, proyecto: t.proyecto || null });
export const firmar = (secreto, cuerpo) => 'sha256=' + crypto.createHmac('sha256', secreto).update(cuerpo).digest('hex');

export function crearWebhooks({ config = () => [], dataDir, avisar = () => {}, env = process.env, fetchImpl = fetch, resolver = h => dns.lookup(h, { all: true }), permitirLocal = false, esperas = ESPERAS }) {
  const F = path.join(dataDir, 'tareas', 'webhooks.json');
  const leer = () => { try { return JSON.parse(fs.readFileSync(F, 'utf8')); } catch { return { fallos: {}, apagados: {}, historial: [] }; } };
  const escribir = st => { fs.mkdirSync(path.dirname(F), { recursive: true }); fs.writeFileSync(F + '.tmp', JSON.stringify(st, null, 1)); renombrar(F + '.tmp', F); };
  const lista = () => (Array.isArray(config()) ? config() : []).filter(w => w && w.id && w.url);

  async function enviarUno(w, cuerpo) {
    const d = revisarDestino(w.url, { permitirLocal }); if (d.error) throw new Error(d.error);
    if (!d.local) { const ips = await resolver(d.url.hostname); if (!ips.length || ips.some(x => privada(x.address || x))) throw new Error('la dirección apunta a una red privada'); }
    const sec = w.secreto ? env[w.secreto] : null;
    const r = await fetchImpl(d.url.href, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { 'content-type': 'application/json', 'user-agent': 'AgentsOffice-webhooks/1', 'x-ao-evento': JSON.parse(cuerpo).evento, ...(sec ? { 'x-ao-firma': firmar(sec, cuerpo) } : {}) }, body: cuerpo });
    if (!r.ok) throw new Error(`respondió ${r.status}`);
  }
  async function despachar(evento, datos) {
    const st = leer(), destinos = lista().filter(w => !st.apagados[w.id] && (!Array.isArray(w.eventos) || !w.eventos.length || w.eventos.includes(evento)));
    if (!destinos.length) return [];
    const cuerpo = JSON.stringify({ evento, at: new Date().toISOString(), por: datos.por || null, ...(datos.de ? { de: datos.de, a: datos.a } : {}), tarea: resumenTarea(datos.tarea) });
    const out = [];
    for (const w of destinos) {
      let ok = false, err = '';
      for (let i = 0; i < esperas.length && !ok; i++) { try { await enviarUno(w, cuerpo); ok = true; } catch (e) { err = e.message; if (/solo https|red privada|no es una dirección|usuario/.test(err)) break; if (i < esperas.length - 1) await new Promise(r => setTimeout(r, esperas[i])); } }
      const s = leer();
      s.historial = [...(s.historial || []), { t: Date.now(), id: w.id, evento, tarea: datos.tarea.id, ok, ...(ok ? {} : { error: err.slice(0, 200) }) }].slice(-50);
      s.fallos[w.id] = ok ? 0 : (s.fallos[w.id] || 0) + 1;
      if (!ok && s.fallos[w.id] >= MAX_FALLOS) { s.apagados[w.id] = Date.now(); avisar(`El webhook «${w.id}» falló ${MAX_FALLOS} veces seguidas y se apagó: ${err}. Revisa la dirección y vuelve a encenderlo en Ajustes.`); }
      escribir(s); out.push({ id: w.id, ok, error: ok ? undefined : err });
    }
    return out;
  }
  return {
    despachar, estado: () => ({ ...leer(), destinos: lista().map(w => ({ id: w.id, url: w.url.replace(/(https?:\/\/[^/]+).*/, '$1/…'), eventos: w.eventos || EVENTOS, firma: !!(w.secreto && env[w.secreto]) })) }),
    encender(id) { const s = leer(); delete s.apagados[id]; s.fallos[id] = 0; escribir(s); },
    escuchar(bus) { for (const ev of EVENTOS) bus.on(ev, d => { if (ev === 'tarea.cambio' && !lista().some(w => (w.eventos || []).includes('tarea.cambio'))) return; despachar(ev, d).catch(e => console.warn('webhooks:', e.message)); }); },
  };
}
