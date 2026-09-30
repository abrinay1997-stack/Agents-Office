// Agents Office V4.7 (F2) — las rutas de Analíticas y de la conexión con Meta. Un solo import en serve.mjs.
//   GET  /api/contenido/analiticas?dias=90            → { meta, serie, publicaciones, ultimaFoto, pendientes, actualizando, indicadores }
//   POST /api/contenido/analiticas/actualizar         → arranca la foto de las cuentas (todas, o solo las que faltan); no espera
//   POST /api/contenido/meta/sincronizar              → «Comprobar conexión»: verifica el token y vuelve a listar las cuentas
//   POST /api/contenido/analiticas/indicadores        → crea en «Cómo va el negocio» los indicadores de seguidores y alcance
//   GET  /api/contenido/miniatura/<hash>              → la copia local de una miniatura de Meta
// Es solo LECTURA sobre Meta: nada de aquí publica, programa ni borra nada allá. Y ninguna respuesta lleva un token.

export function crearRutasAnaliticas({ meta, metricas, json, indicadores, notice = () => {}, fs }) {
  const estadoCompleto = dias => {
    const m = meta.estado();
    const { serie, publicaciones, ultimaFoto } = metricas.leer({ dias });
    return { meta: m, serie, publicaciones, ultimaFoto, hoy: metricas.fechaDeFoto(), pendientes: m.configurado ? metricas.pendientes(m.cuentas).length : 0, actualizando: metricas.enMarcha(), indicadores: indicadores.estado() };
  };

  return async function handle(req, res, url) {
    const p = url.pathname;
    try {
      if (p === '/api/contenido/analiticas' && req.method === 'GET') {
        const dias = Math.min(180, Math.max(7, parseInt(url.searchParams.get('dias') || '90', 10) || 90));
        return json(res, 200, estadoCompleto(dias)), true;
      }
      if (p === '/api/contenido/analiticas/actualizar' && req.method === 'POST') {
        if (!meta.configurado()) return json(res, 400, { error: 'Falta la variable META_ACCESS_TOKEN: sin ella no hay de dónde leer.' }), true;
        if (!meta.estado().cuentas.length) return json(res, 409, { error: 'Todavía no se sabe qué cuentas hay: pulsa «Comprobar conexión» primero.' }), true;
        const todas = url.searchParams.get('todas') === '1';
        // No se espera: leer una cuenta son decenas de llamadas a Meta. La pantalla pregunta por `actualizando` hasta que termine.
        metricas.actualizar({ todas }).catch(e => notice('analiticas', `No se pudo actualizar Analíticas: ${e.message}`, { level: 'warn', key: 'analiticas-fallo' }));
        return json(res, 202, { ok: true, actualizando: true }), true;
      }
      if (p === '/api/contenido/meta/sincronizar' && req.method === 'POST') {
        const e = await meta.sincronizar();
        return json(res, 200, { ok: !e.error, meta: e }), true;
      }
      if (p === '/api/contenido/analiticas/indicadores' && req.method === 'POST') {
        return json(res, 200, { ok: true, ...indicadores.crear() }), true;
      }
      const m = /^\/api\/contenido\/miniatura\/([a-f0-9]{20})$/.exec(p);
      if (m && req.method === 'GET') {
        const f = metricas.miniatura(m[1]);
        if (!f) return json(res, 404, { error: 'esa miniatura ya no está' }), true;
        res.writeHead(200, { 'content-type': f.tipo, 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'" });
        fs.createReadStream(f.archivo).pipe(res);
        return true;
      }
    } catch (e) { return json(res, e.status || 500, { error: e.message }), true; }
    return false;
  };
}
