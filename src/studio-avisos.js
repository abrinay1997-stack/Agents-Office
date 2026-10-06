// Lo que el Estudio dice cuando terminan trabajos (auditoría del Estudio de imagen, IMG-03, 6 oct 2026).
// Antes, una sola línea al pie se pisaba: con una ficha «No se pudo» en pantalla, el pie decía «Listo: 1 archivo(s) nuevos».
// Ahora el aviso cuenta lo nuevo con su plural, dice lo que falló en ese mismo momento, y recuerda las fichas fallidas que
// siguen a la vista (sin pisarlas). Puro, con test.
//   terminados({ archivos, fallidos, error, fallidasVisibles }) → { texto, malo }
//   plural(n, uno, varios)

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/**
 * @param archivos         archivos nuevos de los trabajos que acaban de terminar bien
 * @param fallidos         trabajos que acaban de fallar
 * @param error            el motivo del primero que falló (ya en palabras)
 * @param fallidasVisibles fichas fallidas que siguen en la galería (de antes o de ahora)
 */
export function terminados({ archivos = 0, fallidos = 0, error = '', fallidasVisibles = 0 } = {}) {
  const otras = Math.max(0, fallidasVisibles - fallidos);
  const listo = archivos ? `Listo: ${plural(archivos, 'archivo nuevo', 'archivos nuevos')} en la galería` : '';
  if (fallidos) {
    const mal = `${fallidos === 1 ? 'Un pedido no se pudo' : `${fallidos} pedidos no se pudieron`}${error ? `: ${error}` : ''}`;
    return { texto: `${listo ? listo + '. ' : ''}${mal}.`.replace(/\.\.$/, '.'), malo: true };
  }
  if (!listo) return { texto: '', malo: false };
  return { texto: `${listo}.${otras ? ` ${otras === 1 ? 'Sigue a la vista un pedido que falló' : `Siguen a la vista ${otras} pedidos que fallaron`}: su ficha dice por qué.` : ''}`, malo: false };
}
