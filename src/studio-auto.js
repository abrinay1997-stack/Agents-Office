// El modelo «AUTOMÁTICO» del modo Básico (auditoría del Estudio de imagen, IMG-36, 6 oct 2026). Un principiante no tiene por qué
// saber qué modelo edita fotos o escribe texto legible: la oficina elige por lo que hay en el pedido y dice cuál y por qué.
//   elegirAuto(models, { refs, prompt, def }) → { id, porque } | null
//     con imágenes de referencia → el mejor que las acepta (editar, combinar)
//     con texto que se tiene que leer («logo», «título», algo entre comillas) → un modelo de texto legible
//     si no → el modelo por defecto de la oficina, o el primero encendido que no sea la prueba
// Puro, con test (tests/studio-auto.test.mjs). Solo mira modelos de imagen encendidos; la prueba gratis, solo si no hay otro.
export const EDITAN = ['nano-banana-2', 'nano-banana-pro', 'gpt-image-1', 'flux-kontext', 'seedream-4', 'qwen-image-3', 'nano-banana', 'nano-banana-fal', 'muse-image', 'grok-imagine-2', 'soul-2'];
export const TEXTO = ['ideogram-4', 'ideogram-3-fal', 'recraft-4.1', 'recraft-4.1-pro', 'gpt-image-1', 'nano-banana-pro'];
export const PIDE_TEXTO = /\b(logo|logotipo|t[ií]tulo|titular|letras?|tipograf\w*|cartel|p[oó]ster|eslogan|frase|que diga|con el texto|men[uú])\b|"[^"]{2,}"|«[^»]{2,}»|“[^”]{2,}”/i;

export function elegirAuto(models, { refs = 0, prompt = '', def = '' } = {}) {
  const on = (models || []).filter(m => m && m.kind === 'image' && m.on);
  const real = on.filter(m => m.engine !== 'prueba');
  const de = (lista, filtro = () => true) => lista.map(id => real.find(m => m.id === id && filtro(m))).find(Boolean);
  if (refs > 0) {
    const m = de(EDITAN, x => (x.roles?.reference || 0) >= refs) || real.find(x => (x.roles?.reference || 0) >= refs);
    if (m) return { id: m.id, porque: 'edita y combina tus imágenes' };
  }
  if (PIDE_TEXTO.test(String(prompt))) {
    const m = de(TEXTO); if (m) return { id: m.id, porque: 'escribe texto legible' };
  }
  const d = real.find(m => m.id === def) || real[0];
  if (d) return { id: d.id, porque: 'el de uso general' };
  const p = on[0]; return p ? { id: p.id, porque: 'la prueba gratis: no hay otro motor encendido' } : null;
}
