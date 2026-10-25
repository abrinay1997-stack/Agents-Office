// Una D1 que no repite lo que ya preguntó en ESTA petición. Un turno de Dimitri lee la oficina entera (Contenido, Anuncios, rutinas, tareas, ajustes…) pasando por las rutas
// de cada módulo, y cada una vuelve a preguntar los mismos `docs` (en la medición del 23 oct 2026: 24 lecturas de `docs`, 9 de ellas de las MISMAS tres claves) — 55 consultas
// por turno, más que las 50 de una invocación del plan gratuito. Aquí un SELECT idéntico (misma sentencia y mismos valores) se contesta una sola vez; cualquier escritura (run, batch,
// exec) o `olvidar()` vacían lo recordado. Cada lector recibe su COPIA (un `results.reverse()` de uno no puede estropear al otro). Dura lo que dura la petición: nunca se guarda entre
// invocaciones, así que lo que otra pestaña cambió se ve en el siguiente mensaje.
const esLectura = (sql) => /^\s*select\b/i.test(sql);
const copia = (x) => (x === null || typeof x !== 'object' ? x : structuredClone(x));

/** → una D1 con la misma forma (prepare/bind/first/all/run/raw, batch, exec) más `olvidar()` y `lecturas` (cuántas consultas llegaron de verdad a D1). */
export function conLecturaUnica(db) {
  if (!db || db.__lecturaUnica) return db;
  const memo = new Map();
  const estado = { lecturas: 0, repetidas: 0 };
  const olvidar = () => memo.clear();
  const leer = (metodo, st, sql, args, resto) => {
    const clave = metodo + '\u0000' + sql + '\u0000' + JSON.stringify(args);
    if (memo.has(clave)) { estado.repetidas++; return memo.get(clave).then(copia); }
    estado.lecturas++;
    const p = Promise.resolve(st[metodo](...resto));
    memo.set(clave, p); p.catch(() => memo.delete(clave));
    return p.then(copia);
  };
  const envolver = (st, sql, args) => ({
    _st: st,
    bind: (...a) => envolver(st.bind(...a), sql, a),
    first: (...r) => (esLectura(sql) ? leer('first', st, sql, args, r) : st.first(...r)),
    all: (...r) => (esLectura(sql) ? leer('all', st, sql, args, r) : st.all(...r)),
    run: (...r) => { if (!esLectura(sql)) olvidar(); return st.run(...r); },
    raw: (...r) => st.raw(...r),
  });
  return new Proxy(db, {
    get(t, k) {
      if (k === '__lecturaUnica') return estado;
      if (k === 'olvidar') return olvidar;
      if (k === 'prepare') return (sql) => envolver(t.prepare(sql), String(sql), []);
      if (k === 'batch') return (lista) => { olvidar(); return t.batch(lista.map((x) => x?._st || x)); };
      if (k === 'exec') return (...a) => { olvidar(); return t.exec(...a); };
      const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
    },
  });
}
