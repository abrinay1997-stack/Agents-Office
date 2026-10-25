// Los textos guardados y las plantillas de Contenido: en la oficina local son notas del Cerebro (`Contenido/Textos guardados.md` y `Contenido/Plantillas/<nombre>.md`).
// En la nube el Cerebro vive en la tabla `notas`, así que son notas de ahí (grupo «Contenido»): se ven y se corrigen en el Cerebro como cualquier otra, y la regla
// de qué se puede guardar es la de siempre (contenido/guardados-core.mjs y plantillas-core.mjs). Lo borrado de las plantillas va a `contenido_papelera`.
import { NOTA_GUARDADOS, parsearGuardados, serializarGuardados, guardarEnLista, borrarDeLista } from '../../../../contenido/guardados-core.mjs';
import { MAX_PLANTILLAS, nombreLimpio, plantillaDe, aNota, deNota } from '../../../../contenido/plantillas-core.mjs';

const GRUPO = 'Contenido';
const NOMBRE_GUARDADOS = NOTA_GUARDADOS.split('/').pop().replace(/\.md$/, ''); // «Textos guardados»
const hoy = ahora => new Date(ahora()).toISOString().slice(0, 10);
const bytes = t => new TextEncoder().encode(t).length;
const poner = (db, nombre, texto, ahora) => db.prepare(`insert into notas (nombre, grupo, oficina, texto, bytes, actualizado, tarea) values (?,?,0,?,?,?,null)
  on conflict (nombre) do update set grupo = excluded.grupo, texto = excluded.texto, bytes = excluded.bytes, actualizado = excluded.actualizado`).bind(nombre, GRUPO, texto, bytes(texto), ahora()).run();

export function crearGuardadosD1({ db, ahora = Date.now }) {
  const leer = async () => { const n = await db.prepare('select texto from notas where nombre = ?').bind(NOMBRE_GUARDADOS).first(); return n ? parsearGuardados(n.texto) : []; };
  const escribir = lista => poner(db, NOMBRE_GUARDADOS, serializarGuardados(lista, { hoy: hoy(ahora) }), ahora);
  return {
    listar: leer,
    async guardar(d = {}) { const r = guardarEnLista(await leer(), d); if (r.ok) await escribir(r.lista); return r; },
    async borrar(nombre) { const r = borrarDeLista(await leer(), nombre); if (r.ok) await escribir(r.lista); return r; },
  };
}

export function crearPlantillasD1({ db, ahora = Date.now }) {
  const esPlantilla = md => /(^|\n)tipo: plantilla de contenido\s*(\n|$)/.test(String(md).slice(0, 400));
  const todas = async () => (await db.prepare("select nombre, texto from notas where grupo = ? and texto like '%tipo: plantilla de contenido%'").bind(GRUPO).all()).results.filter(n => esPlantilla(n.texto));
  const buscar = async nombre => {
    const n = nombreLimpio(nombre).toLowerCase();
    for (const f of await todas()) { const t = deNota(f.texto, f.nombre + '.md'); if (f.nombre.toLowerCase() === n || t.nombre.toLowerCase() === n) return { fila: f, plantilla: t }; }
    return null;
  };
  return {
    async listar() { const out = []; for (const f of await todas()) { try { out.push(deNota(f.texto, f.nombre + '.md')); } catch { /* una nota rota no tumba la lista */ } } return out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')); },
    /** Guarda (o reemplaza, por su nombre) una plantilla hecha de una pieza. → { ok, plantilla } o { error } */
    async guardar({ nombre, pieza } = {}) {
      const r = plantillaDe(pieza, nombre); if (r.error) return { error: r.error };
      const previa = await buscar(r.plantilla.nombre);
      if (previa) r.plantilla.nombre = previa.plantilla.nombre; // reemplazarla conserva su nombre (y su nota)
      else {
        if ((await todas()).length >= MAX_PLANTILLAS) return { error: `ya hay ${MAX_PLANTILLAS} plantillas: borra alguna antes` };
        const otra = await db.prepare('select grupo from notas where nombre = ?').bind(r.plantilla.nombre).first();
        if (otra) return { error: `ya hay una nota del Cerebro que se llama «${r.plantilla.nombre}»: ponle otro nombre a la plantilla` }; // no se pisa una nota que no es una plantilla
      }
      const nombreNota = previa ? previa.fila.nombre : r.plantilla.nombre;
      await poner(db, nombreNota, aNota(r.plantilla, { hoy: hoy(ahora) }), ahora);
      return { ok: true, plantilla: { ...r.plantilla, archivo: nombreNota + '.md' }, reemplazada: !!previa };
    },
    /** A la papelera de las plantillas (nada se pierde sin querer). */
    async borrar(nombre) {
      const f = await buscar(nombre); if (!f) return { error: 'esa plantilla ya no está' };
      await db.batch([
        db.prepare('insert into contenido_papelera (tipo, nombre, texto, borrada) values (?,?,?,?)').bind('plantilla', f.fila.nombre, f.fila.texto, ahora()),
        db.prepare('delete from notas where nombre = ?').bind(f.fila.nombre),
      ]);
      return { ok: true };
    },
  };
}
