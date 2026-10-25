// Agents Office — las voces de MiniMax: lo PURO (25 oct 2026, fase 8a del puerto a Cloudflare; salió de minimax-voices.mjs).
// Los precios, la lista corta de voces del sistema y cómo se dice una voz a la página. Sin archivos: lo usan la oficina local
// (minimax-voices.mjs, con data/minimax-voices.json) y la nube (cloudflare/worker/lib/estudio/voces.js, con D1).
// What each one costs (MiniMax pay-as-you-go, 30 Sep 2026): a designed voice US$3 (+ its preview at US$30 a million characters),
// a cloned voice US$1.5. MiniMax charges a voice the first time a real synthesis uses it.
export const PRICE = { design: 3, clone: 1.5, previewPerChar: 30 / 1e6 };
// A short, curated list of system voices (MiniMax's documentation, 30 Sep 2026) — the selector's fallback when get_voice does not answer.
export const SYSTEM = [
  ['Spanish_Narrator', 'Narrador'], ['Spanish_SereneWoman', 'Mujer serena'], ['Spanish_CaptivatingStoryteller', 'Cuentacuentos'],
  ['Spanish_ConfidentWoman', 'Mujer segura'], ['Spanish_ThoughtfulMan', 'Hombre reflexivo'], ['Spanish_WiseScholar', 'Erudito'],
  ['Spanish_SophisticatedLady', 'Dama sofisticada'], ['Spanish_RationalMan', 'Hombre racional'], ['Spanish_Deep-tonedMan', 'Voz grave'],
  ['Spanish_ReliableMan', 'Hombre confiable'], ['Spanish_ChattyGirl', 'Chica conversadora'], ['Spanish_EnergeticBoy', 'Chico enérgico'],
  ['Spanish_Comedian', 'Comediante'], ['Spanish_SensibleManager', 'Gerente sensato'], ['Spanish_FrankLady', 'Mujer franca'],
  ['English_expressive_narrator', 'Narrador (inglés)'], ['English_radiant_girl', 'Chica radiante (inglés)'], ['English_magnetic_voiced_man', 'Voz magnética (inglés)'],
].map(([voiceId, name]) => ({ voiceId, name, lang: voiceId.split('_')[0] === 'Spanish' ? 'es' : 'en' }));

export const pub = v => ({ voiceId: v.voiceId, name: v.name, kind: v.kind, at: v.at, pinned: !!v.pinned, ...(v.demoAudio ? { demoAudio: v.demoAudio } : {}), ...(v.prompt ? { prompt: v.prompt } : {}) });
export const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

