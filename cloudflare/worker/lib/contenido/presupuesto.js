// El presupuesto de una invocación del Worker. En el plan gratuito una invocación puede hacer ~50 consultas a D1 y ~50 llamadas externas; un Worker de pago, 1.000.
// Aquí se CUENTAN las dos (las externas, a Meta/Metricool, las cuenta el servicio; las internas —cada sentencia de D1 y cada operación de R2— las cuentan estos envoltorios)
// para que una vuelta se corte ANTES de pasarse y lo que falta siga en la próxima. Los topes se cambian con CONTENIDO_MAX_LLAMADAS, CONTENIDO_MAX_CONSULTAS y
// CONTENIDO_MAX_ACCIONES (vars de wrangler.jsonc, no secretos). Un tope no corta una acción a la mitad: se mira ENTRE acciones, y por eso el defecto deja margen.
export const TOPE_LLAMADAS = 40, TOPE_CONSULTAS = 40, TOPE_ACCIONES = 6;
const numero = (v, def) => (Number(v) > 0 ? Number(v) : def);

export function crearPresupuesto(env = {}) {
  const p = { tope: numero(env['CONTENIDO_MAX_LLAMADAS'], TOPE_LLAMADAS), topeConsultas: numero(env['CONTENIDO_MAX_CONSULTAS'], TOPE_CONSULTAS), topeAcciones: numero(env['CONTENIDO_MAX_ACCIONES'], TOPE_ACCIONES), llamadas: 0, consultas: 0 };
  p.externa = () => { p.llamadas++; };
  p.interna = (n = 1) => { p.consultas += n; };
  /** ¿cabe seguir? `reserva`: un número (llamadas externas que va a necesitar lo siguiente) o { llamadas, consultas }. */
  p.puedeSeguir = (reserva = 0) => {
    const rl = typeof reserva === 'number' ? reserva : reserva?.llamadas || 0, rc = typeof reserva === 'object' && reserva ? reserva.consultas || 0 : 0;
    return p.llamadas + Math.max(rl, 1) <= p.tope && p.consultas + Math.max(rc, 1) <= p.topeConsultas;
  };
  return p;
}

/** D1 que cuenta cada sentencia que se ejecuta (un `batch` cuenta una por sentencia). Deja pasar `_db` (las pruebas miran dentro). */
export function contarD1(db, cuenta) {
  const sentencia = raw => ({
    _raw: raw,
    bind: (...a) => sentencia(raw.bind(...a)),
    first: (...a) => { cuenta(); return raw.first(...a); },
    all: (...a) => { cuenta(); return raw.all(...a); },
    run: (...a) => { cuenta(); return raw.run(...a); },
    raw: (...a) => { cuenta(); return raw.raw(...a); },
  });
  return { prepare: q => sentencia(db.prepare(q)), batch: lista => { cuenta(lista.length); return db.batch(lista.map(s => s._raw || s)); }, ...(db._db ? { _db: db._db } : {}) };
}

/** R2 que cuenta cada operación (head, get, put, delete, list). */
export function contarR2(bucket, cuenta) {
  if (!bucket) return bucket;
  const envolver = nombre => (...a) => { cuenta(); return bucket[nombre](...a); };
  return { ...Object.fromEntries(['head', 'get', 'put', 'delete', 'list'].filter(n => typeof bucket[n] === 'function').map(n => [n, envolver(n)])), _m: bucket._m };
}
