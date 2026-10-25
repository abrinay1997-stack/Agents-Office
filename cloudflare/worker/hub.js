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

const MAX_SOCKETS = 200;
const MAX_MENSAJE = 2048;
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
      const par = new WebSocketPair();
      const [cliente, servidor] = Object.values(par);
      this.state.acceptWebSocket(servidor);
      servidor.serializeAttachment({
        userId, nombre: texto(url.searchParams.get('nombre'), 60), color: texto(url.searchParams.get('color'), 9),
        foto: texto(url.searchParams.get('foto'), 40) || null, area: null, etiqueta: '', desde: Date.now(),
      });
      servidor.send(JSON.stringify({ tipo: 'hola', userId, presentes: this.presentes() }));
      this.difundir({ tipo: 'presencia', presentes: this.presentes() }, servidor);
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
      this.difundir({ tipo: 'presencia', presentes: this.presentes() });
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/estado') return Response.json({ sockets: this.state.getWebSockets().length, presentes: this.presentes() });
    return new Response('No encontrado', { status: 404 });
  }

  async webSocketMessage(ws, mensaje) {
    if (typeof mensaje !== 'string' || mensaje.length > MAX_MENSAJE) return;
    if (mensaje === 'ping') { ws.send('pong'); return; }
    let m; try { m = JSON.parse(mensaje); } catch { return; }
    const d = datosDe(ws);
    if (!d || !m || typeof m !== 'object') return;
    // «Estoy en esta vista». La identidad sale del socket, nunca del mensaje: si saliera del cliente, cualquiera firmaría como otro.
    if (m.tipo === 'vista') {
      const area = reArea.test(String(m.area ?? '')) ? String(m.area) : null;
      ws.serializeAttachment({ ...d, area, etiqueta: area ? texto(m.etiqueta, 60) : '' });
      this.difundir({ tipo: 'presencia', presentes: this.presentes() });
    }
  }

  async webSocketClose(ws) { this.difundir({ tipo: 'presencia', presentes: this.presentes(ws) }, ws); }
  async webSocketError(ws) { this.difundir({ tipo: 'presencia', presentes: this.presentes(ws) }, ws); }

  /** Quién está conectado, una vez por persona (con dos pestañas manda la que más reciente dijo su vista). */
  presentes(excluir) {
    const porPersona = new Map();
    for (const ws of this.state.getWebSockets()) {
      if (ws === excluir) continue;
      const d = datosDe(ws); if (!d?.userId) continue;
      const previo = porPersona.get(d.userId);
      porPersona.set(d.userId, previo && !d.area ? previo : { userId: d.userId, nombre: d.nombre, color: d.color, foto: d.foto, area: d.area, etiqueta: d.etiqueta, desde: Math.min(d.desde, previo?.desde ?? d.desde) });
    }
    return [...porPersona.values()];
  }

  difundir(evento, excluir) {
    const payload = JSON.stringify(evento);
    for (const ws of this.state.getWebSockets()) {
      if (ws === excluir) continue;
      try { ws.send(payload); } catch { /* socket muerto aún sin limpiar: el cliente reconecta y se pone al día */ }
    }
  }
}
