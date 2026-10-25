#!/usr/bin/env node
// Conecta (o desconecta) el bot de Telegram con la oficina en la nube: le dice a Telegram a qué dirección mandar los mensajes y con qué secreto firmarlos.
//   TELEGRAM_BOT_TOKEN=… TELEGRAM_WEBHOOK_SECRET=… node cloudflare/scripts/telegram-webhook.mjs https://agents-office.<tu>.workers.dev
//   … node cloudflare/scripts/telegram-webhook.mjs --quitar        (vuelve a no recibir nada)
//   … node cloudflare/scripts/telegram-webhook.mjs --estado <url>  (qué ve Telegram)
// Las llaves vienen SOLO del entorno (en GitHub Actions: secretos del repositorio). Nunca se imprime una: ni el token (va en la URL de Telegram) ni el secreto del webhook.
const API = 'https://api.telegram.org';
const limpio = (txt, ...secretos) => secretos.filter(Boolean).reduce((t, s) => t.split(s).join('«secreto»'), String(txt));

export function direccion(base) {
  const u = new URL(String(base || ''));
  if (u.protocol !== 'https:') throw new Error('Telegram solo manda a direcciones https');
  return `${u.origin}/api/telegram/webhook`;
}
export async function llamar(metodo, cuerpo, { token, fetchFn = fetch } = {}) {
  const r = await fetchFn(`${API}/bot${token}/${metodo}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo || {}) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(limpio(j.description || `Telegram contestó ${r.status}`, token));
  return j.result;
}
export async function conectar(base, { token, secreto, fetchFn = fetch } = {}) {
  if (!/^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(String(token || ''))) throw new Error('Falta TELEGRAM_BOT_TOKEN (o no parece un token de bot)');
  if (String(secreto || '').length < 16 || !/^[A-Za-z0-9_-]+$/.test(secreto)) throw new Error('TELEGRAM_WEBHOOK_SECRET debe tener 16 caracteres o más, solo letras, números, _ y -');
  const url = direccion(base);
  await llamar('setWebhook', { url, secret_token: secreto, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false }, { token, fetchFn });
  return url;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const token = process.env.TELEGRAM_BOT_TOKEN, secreto = process.env.TELEGRAM_WEBHOOK_SECRET, args = process.argv.slice(2);
  try {
    if (args.includes('--quitar')) { await llamar('deleteWebhook', {}, { token }); console.log('Webhook quitado: Telegram ya no manda nada a la oficina.'); }
    else if (args.includes('--estado')) { const i = await llamar('getWebhookInfo', {}, { token }); console.log(`Dirección: ${i.url || '(ninguna)'} · pendientes: ${i.pending_update_count ?? 0}${i.last_error_message ? ' · último error: ' + limpio(i.last_error_message, token, secreto) : ''}`); }
    else { const base = args.find((a) => !a.startsWith('--')); if (!base) { console.error('Uso: node cloudflare/scripts/telegram-webhook.mjs https://tu-oficina.workers.dev'); process.exit(1); } console.log('Webhook activo en ' + await conectar(base, { token, secreto })); }
  } catch (e) { console.error('No pude hacerlo: ' + limpio(e.message, token, secreto)); process.exit(1); }
}
