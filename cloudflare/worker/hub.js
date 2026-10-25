// El Durable Object de la oficina — presencia y cambios en vivo (fase 10). Portado del diseño de CALENDARIOS-MARKETING-APP (worker/hub.js).
//
// Una sola instancia por instalación (idFromName('oficina')): quien esté donde esté, abre su socket contra el MISMO objeto.
// HIBERNACIÓN: `acceptWebSocket` (no `accept`) deja a Cloudflare descargar el objeto cuando no pasa nada SIN cortar los sockets; la
// identidad de cada uno vive en su «attachment», que sobrevive. El latido ('ping' → 'pong') lo contesta Cloudflare solo, sin despertar al objeto.
//
// Dos clases de mensaje, que no se confunden:
//  · CAMBIOS de datos: los manda el Worker por /difundir DESPUÉS de escribir en D1. Van a todos, también a la pestaña que lo originó
//    (el cambio llegó por HTTP, el objeto no sabe de qué socket salió); el cliente descarta el eco por el id de PESTAÑA (`por.tab`).
//  · PRESENCIA: quién está y qué vista tiene abierta. No toca la base: nace y muere con los sockets.
// El socket es un atajo y D1 es la verdad: lo que se pierda, la página lo recupera con su sondeo de siempre.
//
// Este objeto no sabe leer cookies ni debe: el Worker (lib/rutas.js → modulos/equipo.js) ya validó la sesión y el Origin y le pasa la identidad.

export const MAX_SOCKETS = 200; // en todo el objeto
export const MAX_POR_PERSONA = 8; // al pasarse, se cierra el más viejo de ESA persona: nadie puede agotar el cupo de todos abriendo pestañas
export const MAX_MENSAJE = 2048;
export const RAFAGA = 10, POR_SEGUNDO = 5; // token bucket por socket: más de ~5 mensajes por segundo (con una ráfaga de 10) y se cierra con 1008
export const AGRUPAR_MS = 250; // las difusiones de presencia se juntan: cien cambios de vista en un instante son un solo mensaje
const reArea = /^[a-z0-9][a-z0-9:_-]{0,39}$/;

const datosDe = (ws) => { try { return ws.deserializeAttachment() ?? null; } catch { return null; } };
const texto = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);

export class Hub {
  constructor(state) {
    this.state = state;
    // 'ping' → 'pong' sin despertar al objeto (los proxies móviles cortan lo ocioso al minuto)
    try { state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong')); } catch { /* entorno sin la API */ }
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/conectar') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Se esperaba una conexión WebSocket', { status: 426 });
      const userId = url.searchParams.get('userId') ?? '';
      if (!userId) return new Response('Falta la identidad', { status: 400 });
      if (this.state.getWebSockets().length >= MAX_SOCKETS) return new Response('Demasiadas conexiones', { status: 503 });
      this.hacerSitio(userId);
      const par = new WebSocketPair();
      const [cliente, servidor] = Object.values(par);
      this.state.acceptWebSocket(servidor);
      servidor.serializeAttachment({
        userId, rol: texto(url.searchParams.get('rol'), 10), nombre: texto(url.searchParams.get('nombre'), 60), color: texto(url.searchParams.get('color'), 9),
        foto: texto(url.searchParams.get('foto'), 40) || null, area: null, etiqueta: '', desde: Date.now(),
      });
      servidor.send(JSON.stringify({ tipo: 'hola', userId, presentes: this.presentes() }));
      this.presencia();
      return new Response(null, { status: 101, webSocket: cliente });
    }
    if (url.pathname === '/difundir' && req.method === 'POST') {
      this.difundir(await req.json());
      return new Response(null, { status: 204 });
    }
    // Una persona se quitó, cambió de contraseña o de foto: se cierran sus sockets (la página reconecta; si ya no tiene sesión, no entra).
    if (url.pathname === '/cerrar' && req.method === 'POST') {
      const { userId, motivo } = await req.json();
      for (const ws of this.state.getWebSockets()) if (datosDe(ws)?.userId === userId) { try { ws.close(4401, texto(motivo, 100) || 'sesión cerrada'); } catch { /* ya cerrado */ } }
      this.presencia();
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/estado') return Response.json({ sockets: this.state.getWebSockets().length, presentes: this.presentes() });
    return new Response('No encontrado', { status: 404 });
  }

  async webSocketMessage(ws, mensaje) {
    if (!this.cabe(ws)) { try { ws.close(1008, 'demasiados mensajes'); } catch { /* ya cerrado */ } return; } // un socket que inunda se corta (el cliente no reconecta con este código)
    if (typeof mensaje !== 'string' || mensaje.length > MAX_MENSAJE) return;
    if (mensaje === 'ping') { ws.send('pong'); return; }
    let m; try { m = JSON.parse(mensaje); } catch { return; }
    const d = datosDe(ws);
    if (!d || !m || typeof m !== 'object') return;
    // «Estoy en esta vista». La identidad sale del socket, nunca del mensaje: si saliera del cliente, cualquiera firmaría como otro.
    if (m.tipo === 'vista') {
      const area = reArea.test(String(m.area ?? '')) ? String(m.area) : null;
      ws.serializeAttachment({ ...d, area, etiqueta: area ? texto(m.etiqueta, 60) : '' });
      this.presencia();
    }
  }

  async webSocketClose(ws) { this.presencia(ws); }
  async webSocketError(ws) { this.presencia(ws); }

  /** Token bucket de este socket (en memoria: si el objeto hiberna, empieza lleno otra vez). */
  cabe(ws, ahora = Date.now()) {
    this.cubos ??= new WeakMap();
    const c = this.cubos.get(ws) ?? { fichas: RAFAGA, t: ahora };
    c.fichas = Math.min(RAFAGA, c.fichas + ((ahora - c.t) / 1000) * POR_SEGUNDO); c.t = ahora;
    const ok = c.fichas >= 1; if (ok) c.fichas -= 1;
    this.cubos.set(ws, c);
    return ok;
  }

  /** Antes de aceptar un socket de `userId`: si ya tiene MAX_POR_PERSONA, cierra los más viejos hasta dejar sitio. */
  hacerSitio(userId) {
    const suyos = this.state.getWebSockets().filter((w) => datosDe(w)?.userId === userId).sort((a, b) => (datosDe(a)?.desde ?? 0) - (datosDe(b)?.desde ?? 0));
    for (const w of suyos.slice(0, Math.max(0, suyos.length - (MAX_POR_PERSONA - 1)))) { try { w.close(4408, 'demasiadas pestañas abiertas'); } catch { /* ya cerrado */ } }
  }

  /** Difunde la presencia JUNTANDO los avisos de ~250 ms (un cambio tras otro es un solo mensaje, con la lista del final). */
  presencia(excluir) {
    if (excluir) (this.fuera ??= new Set()).add(excluir);
    if (this.pendiente) return;
    this.pendiente = setTimeout(() => {
      this.pendiente = null;
      const fuera = this.fuera; this.fuera = null;
      const presentes = this.presentes(null, fuera);
      this.difundir({ tipo: 'presencia', presentes }, null, fuera);
    }, AGRUPAR_MS);
  }

  /** Quién está conectado, una vez por persona (con dos pestañas manda la que más reciente dijo su vista). */
  presentes(excluir, fuera = null) {
    const porPersona = new Map();
    for (const ws of this.state.getWebSockets()) {
      if (ws === excluir || fuera?.has(ws)) continue;
      const d = datosDe(ws); if (!d?.userId) continue;
      const previo = porPersona.get(d.userId);
      porPersona.set(d.userId, previo && !d.area ? previo : { userId: d.userId, nombre: d.nombre, color: d.color, foto: d.foto, area: d.area, etiqueta: d.etiqueta, desde: Math.min(d.desde, previo?.desde ?? d.desde) });
    }
    return [...porPersona.values()];
  }

  difundir(evento, excluir, fuera = null) {
    const { soloAdmin, ...limpio } = evento;
    const payload = JSON.stringify(limpio);
    for (const ws of this.state.getWebSockets()) {
      if (ws === excluir || fuera?.has(ws)) continue;
      if (soloAdmin && datosDe(ws)?.rol !== 'admin') continue; // lo de los ajustes, los conectores, Dimitri… solo para administradores
      try { ws.send(payload); } catch { /* socket muerto aún sin limpiar: el cliente reconecta y se pone al día */ }
    }
  }
}
