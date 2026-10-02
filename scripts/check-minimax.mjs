// Agents Office — the smoke test of a REAL MiniMax key (V4.10). It spends a little money: run it by hand, never in CI.
//   node scripts/check-minimax.mjs            → image (US$0.0035) + a short voice-over (a few cents)
//   node scripts/check-minimax.mjs --video    → also queues a 4-second H3 video at 768P (~US$0.32) and waits for it
//   node scripts/check-minimax.mjs --music    → also a short instrumental piece with music-3.0-free (any account)
//   node scripts/check-minimax.mjs --voces    → also lists the system voices (get_voice; free)
// The key comes from the environment (MINIMAX_API_KEY, set once with  setx MINIMAX_API_KEY "tu-key"); it is never printed.
// The results go to data/salida-minimax/ (data/ never travels through GitHub). Only minimax.mjs is used: no office, no jobs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as mmx from '../minimax.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(process.env.AO_DATA ? path.resolve(process.env.AO_DATA) : path.join(ROOT, 'data'), 'salida-minimax');
const want = new Set(process.argv.slice(2));
const ok = s => console.log('  ✓ ' + s);
let failed = 0; const fail = (s, e) => { failed++; console.error('  ✗ ' + s + ' — ' + (e?.message || e)); };

if (!mmx.minimaxOn()) { console.error('Falta MINIMAX_API_KEY en el entorno: setx MINIMAX_API_KEY "tu-key" y abre otra terminal.'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
console.log(`Key detectada. Probando MiniMax${process.env.MINIMAX_API_BASE ? ' en ' + process.env.MINIMAX_API_BASE : ''}… (salida: ${path.relative(ROOT, OUT)})\n`);

try {
  const [buf] = await mmx.image({ prompt: 'logo minimalista de una oficina de agentes de IA, fondo oscuro, neón suave', n: 1 });
  const ext = buf[0] === 0x89 ? 'png' : 'jpg'; fs.writeFileSync(path.join(OUT, `imagen.${ext}`), buf); ok(`Imagen (image-01) → imagen.${ext} (${buf.length} bytes)`);
} catch (e) { fail('Imagen', e); }

try {
  const r = await mmx.tts({ text: 'Hola, soy una voz de prueba para Agents Office. Todo funciona.', model: 'speech-2.8-turbo', voiceId: 'Spanish_Narrator' });
  fs.writeFileSync(path.join(OUT, `voz.${r.ext}`), r.buf); ok(`Voz (speech-2.8-turbo, Spanish_Narrator) → voz.${r.ext} (${r.chars} caracteres${r.seconds ? `, ${r.seconds} s` : ''})`);
} catch (e) { fail('Voz', e); }

if (want.has('--voces')) {
  try { const { system } = await mmx.getVoices('system'); ok(`Voces del sistema: ${system.length} (en español: ${system.filter(v => /^Spanish/.test(v.voiceId)).length})`); }
  catch (e) { fail('Voces', e); }
}

if (want.has('--music')) {
  try {
    const r = await mmx.music({ model: 'music-3.0-free', instrumental: true, prompt: 'lo-fi suave y alegre para un reel de café, 30 segundos' });
    fs.writeFileSync(path.join(OUT, `musica.${r.ext}`), r.buf); ok(`Música (music-3.0-free) → musica.${r.ext}${r.seconds ? ` (${r.seconds} s)` : ''}`);
  } catch (e) { fail('Música', e); }
}

if (want.has('--video')) {
  try {
    const id = await mmx.createVideo({ model: 'MiniMax-H3', content: mmx.videoContent({ prompt: 'un café humeante sobre un escritorio, luz de mañana, cámara lenta' }), resolution: '768P', duration: 4, ratio: '16:9' });
    ok(`Video encolado (tarea ${id}); esperando, puede tardar varios minutos…`);
    let done = false;
    for (let i = 0; i < 300 && !done; i++) {
      await new Promise(r => setTimeout(r, 6000));
      const q = await mmx.queryVideo(id);
      process.stdout.write(`\r    estado: ${q.state}          `);
      if (q.state === 'succeeded') { const { buf } = await mmx.fetchBuf(q.url); fs.writeFileSync(path.join(OUT, 'video.mp4'), buf); console.log(); ok(`Video → video.mp4 (${buf.length} bytes)`); done = true; }
      else if (q.state === 'failed' || q.state === 'cancelled') { console.log(); fail('Video', q.error || q.state); done = true; }
    }
    if (!done) { console.log(); fail('Video', 'no terminó en 30 minutos; mira la tarea en platform.minimax.io'); }
  } catch (e) { console.log(); fail('Video', e); }
}

console.log(failed ? `\n${failed} prueba(s) fallaron. Revisa los mensajes de arriba.` : `\nListo. Revisa la carpeta ${path.relative(ROOT, OUT)}.`);
process.exit(failed ? 1 : 0);
