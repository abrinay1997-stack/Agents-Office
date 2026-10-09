// Agents Office — renombrar sin perder la escritura en Windows (9 oct 2026).
//
// Toda la oficina guarda «escribir a un temporal y renombrar encima» (atómico: nunca queda un archivo a medias). En Windows,
// renombrar encima de un archivo que otro proceso tiene abierto para leer (la página pidiendo datos, un antivirus, un test que
// mira el archivo) falla con EPERM, EBUSY o EACCES durante unos milisegundos. Sin reintento, ese guardado se perdía —o tiraba
// la petición—: un aviso del piloto que no llegaba, un cambio de una tarea que no quedaba. Se encontró por tests que fallaban
// solo con la máquina cargada.
//
// `renombrar` reintenta con esperas cortas y, si aun así no puede, copia el contenido encima y borra el temporal (pierde la
// atomicidad en ese caso raro, pero no el dato). Es síncrona, como `fs.renameSync`, para no cambiar a quien la llama.
import fs from 'node:fs';

const PASAJEROS = new Set(['EPERM', 'EBUSY', 'EACCES']);
export const REINTENTOS = 6;

export function renombrar(de, a) {
  for (let i = 0; ; i++) {
    try { fs.renameSync(de, a); return; }
    catch (e) {
      if (!PASAJEROS.has(e?.code)) throw e;
      if (i >= REINTENTOS) {
        fs.writeFileSync(a, fs.readFileSync(de));
        try { fs.unlinkSync(de); } catch { /* el próximo guardado lo pisa */ }
        return;
      }
      const hasta = Date.now() + 15 * (i + 1);
      while (Date.now() < hasta) { /* espera corta y síncrona */ }
    }
  }
}
