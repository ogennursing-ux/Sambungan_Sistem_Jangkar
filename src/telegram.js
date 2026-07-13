// Telegram Bot API client (fetch-based, works in Cloudflare Workers).

async function tg(env, method, body) {
  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const j = await res.json().catch(() => ({}));
  if (!j.ok) throw new Error(`Telegram ${method} failed: ${j.description || res.status}`);
  return j.result;
}

export { tg };

export function sendText(env, text, chatId) {
  return tg(env, 'sendMessage', {
    chat_id: chatId || env.TELEGRAM_CHAT_ID,
    text,
    disable_web_page_preview: true,
  });
}

// `doc` may be a public URL (Telegram downloads it itself) or a file_id.
export function sendDocument(env, doc, caption, chatId) {
  return tg(env, 'sendDocument', {
    chat_id: chatId || env.TELEGRAM_CHAT_ID,
    document: doc,
    caption,
  });
}
