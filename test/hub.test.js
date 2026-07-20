// Logic tests with a stubbed network: capture every outgoing request and
// assert the hub turns events/commands into the right Telegram calls.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fill, runAutomations } from '../src/automations.js';
import { handleTelegramUpdate } from '../src/router.js';

const ENV = {
  TELEGRAM_BOT_TOKEN: 'TOKEN',
  TELEGRAM_CHAT_ID: '111',
  WEBHOOK_SECRET: 's3cret',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
};

let calls;
beforeEach(() => {
  calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), body: opts.body ? JSON.parse(opts.body) : null });
    if (String(url).includes('/rest/v1/sign_requests')) {
      return new Response(
        JSON.stringify([{ id: 'abc', title: 'חוזה שכירות', signed_at: '2026-07-13T05:00:00Z' }]),
        { headers: { 'content-range': '0-0/7' } },
      );
    }
    return new Response(JSON.stringify({ ok: true, result: {} }));
  };
});

test('fill replaces placeholders and drops unknown ones', () => {
  assert.equal(fill('שלום {name}{missing}!', { name: 'עוגן' }), 'שלום עוגן!');
});

test('document.signed event sends message + document', async () => {
  const ran = await runAutomations(
    'document.signed',
    { title: 'חוזה', fileUrl: 'https://x/doc.pdf' },
    ENV,
  );
  assert.equal(ran, 2);
  assert.ok(calls[0].url.includes('/sendMessage'));
  assert.ok(calls[0].body.text.includes('חוזה'));
  assert.ok(calls[1].url.includes('/sendDocument'));
  assert.equal(calls[1].body.document, 'https://x/doc.pdf');
});

test('unknown event runs nothing', async () => {
  assert.equal(await runAutomations('no.such.event', {}, ENV), 0);
});

test('skipped document (missing fileUrl) is not counted as run', async () => {
  const ran = await runAutomations('document.signed', { title: 'חוזה' }, ENV);
  assert.equal(ran, 1); // only the message; the document has no url so it is skipped
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes('/sendMessage'));
});

test('foreign chat is refused', async () => {
  await handleTelegramUpdate({ message: { chat: { id: 999 }, text: '/סטטוס' } }, ENV);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].body.text.includes('פרטי'));
  assert.equal(calls[0].body.chat_id, '999');
});

test('/חתימות lists signed documents', async () => {
  await handleTelegramUpdate({ message: { chat: { id: 111 }, text: '/חתימות' } }, ENV);
  const send = calls.find((c) => c.url.includes('/sendMessage'));
  assert.ok(send.body.text.includes('חוזה שכירות'));
});

test('/מסמך sends the latest signed PDF by public URL', async () => {
  await handleTelegramUpdate({ message: { chat: { id: 111 }, text: '/מסמך' } }, ENV);
  const send = calls.find((c) => c.url.includes('/sendDocument'));
  assert.equal(
    send.body.document,
    'https://example.supabase.co/storage/v1/object/public/documents/signed/abc.pdf',
  );
});

test('/סטטוס reports counts', async () => {
  await handleTelegramUpdate({ message: { chat: { id: 111 }, text: '/סטטוס' } }, ENV);
  const send = calls.find((c) => c.url.includes('/sendMessage'));
  assert.ok(send.body.text.includes('7'));
});
