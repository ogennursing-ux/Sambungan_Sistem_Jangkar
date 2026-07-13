// Anchor Hub — automation hub connecting a Telegram bot to my systems.
// Runs as a Cloudflare Worker.
//
// Endpoints:
//   POST /telegram            — Telegram webhook (verified by secret header)
//   GET  /setup?secret=...    — one-time: registers this worker as the bot's webhook
//   POST /hook/<event>?secret=... — inbound events from any system -> automations
//   GET  /                    — health check
import { handleTelegramUpdate } from './router.js';
import { runAutomations } from './automations.js';
import { tg } from './telegram.js';

const text = (s, status = 200) =>
  new Response(s, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === 'POST' && url.pathname === '/telegram') {
      // Telegram echoes back the secret we set in setWebhook.
      if (req.headers.get('x-telegram-bot-api-secret-token') !== env.WEBHOOK_SECRET) {
        return text('forbidden', 403);
      }
      const update = await req.json().catch(() => null);
      if (update) await handleTelegramUpdate(update, env);
      // Always 200 so Telegram doesn't retry endlessly.
      return Response.json({ ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/setup') {
      if (url.searchParams.get('secret') !== env.WEBHOOK_SECRET) return text('forbidden', 403);
      await tg(env, 'setWebhook', {
        url: `${url.origin}/telegram`,
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ['message'],
      });
      return text('✅ הבוט חובר לרכזת. שלח לו /start בטלגרם.');
    }

    if (req.method === 'POST' && url.pathname.startsWith('/hook/')) {
      if (url.searchParams.get('secret') !== env.WEBHOOK_SECRET) return text('forbidden', 403);
      const event = decodeURIComponent(url.pathname.slice('/hook/'.length));
      const payload = await req.json().catch(() => ({}));
      const ran = await runAutomations(event, payload, env);
      return Response.json({ ok: true, event, actionsRan: ran });
    }

    return text('Anchor Hub פועל ✅');
  },
};
