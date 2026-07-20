// Additional coverage: command routing edge cases, empty results, error
// handling, and automation fan-out — all with a stubbed network.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fill, runAutomations } from '../src/automations.js';
import { handleTelegramUpdate } from '../src/router.js';
import { signedPdfUrl } from '../src/connectors/ogenSign.js';

const ENV = {
  TELEGRAM_BOT_TOKEN: 'TOKEN',
  TELEGRAM_CHAT_ID: '111',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
};

let calls;
// signRows / signCount / failStatus are mutated per-test before the call.
let signRows;
let signCount;
let failRequests;

beforeEach(() => {
  calls = [];
  signRows = [{ id: 'abc', title: 'חוזה שכירות', signed_at: '2026-07-13T05:00:00Z' }];
  signCount = 7;
  failRequests = false;
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), body: opts.body ? JSON.parse(opts.body) : null });
    if (String(url).includes('/rest/v1/sign_requests')) {
      if (failRequests) return new Response('nope', { status: 500 });
      return new Response(JSON.stringify(signRows), {
        headers: { 'content-range': `0-0/${signCount}` },
      });
    }
    return new Response(JSON.stringify({ ok: true, result: {} }));
  };
});

const owner = (text) => handleTelegramUpdate({ message: { chat: { id: 111 }, text } }, ENV);
const lastText = () => calls.filter((c) => c.url.includes('/sendMessage')).pop().body.text;

// ---- routing edge cases ----

test('/עזרה returns the help message', async () => {
  await owner('/עזרה');
  assert.match(lastText(), /הפקודות שלי/);
});

test('/start and /help are aliases for help', async () => {
  await owner('/start');
  assert.match(lastText(), /הפקודות שלי/);
  await owner('/help');
  assert.match(lastText(), /הפקודות שלי/);
});

test('an unknown command falls back to help with an "unknown" note', async () => {
  await owner('/banana');
  assert.match(lastText(), /לא הכרתי את הפקודה/);
  assert.match(lastText(), /banana/);
});

test('a command carrying a @botname suffix still routes', async () => {
  await owner('/סטטוס@Anchor_Signatures_Bot');
  assert.match(lastText(), /נחתמו: 7/);
});

test('a message with no text is ignored (no outgoing calls)', async () => {
  await handleTelegramUpdate({ message: { chat: { id: 111 } } }, ENV);
  assert.equal(calls.length, 0);
});

test('edited messages are handled like new ones', async () => {
  await handleTelegramUpdate({ edited_message: { chat: { id: 111 }, text: '/עזרה' } }, ENV);
  assert.match(lastText(), /הפקודות שלי/);
});

test('with no TELEGRAM_CHAT_ID configured, any chat is allowed', async () => {
  await handleTelegramUpdate(
    { message: { chat: { id: 42 }, text: '/עזרה' } },
    { ...ENV, TELEGRAM_CHAT_ID: undefined },
  );
  assert.match(lastText(), /הפקודות שלי/);
});

// ---- empty results ----

test('/חתימות with no signed docs reports the empty state', async () => {
  signRows = [];
  await owner('/חתימות');
  assert.match(lastText(), /אין עדיין מסמכים חתומים/);
});

test('/מסמך with no signed docs reports the empty state', async () => {
  signRows = [];
  await owner('/מסמך');
  assert.match(lastText(), /אין עדיין מסמכים חתומים/);
  assert.equal(calls.some((c) => c.url.includes('/sendDocument')), false);
});

// ---- error handling ----

test('a connector failure is caught and reported to the chat', async () => {
  failRequests = true;
  await owner('/סטטוס');
  assert.match(lastText(), /משהו השתבש/);
});

// ---- pure helpers ----

test('signedPdfUrl builds the public bucket path', () => {
  assert.equal(
    signedPdfUrl(ENV, 'xyz'),
    'https://example.supabase.co/storage/v1/object/public/documents/signed/xyz.pdf',
  );
});

test('fill substitutes multiple placeholders and stringifies values', () => {
  assert.equal(fill('{a}-{b}-{a}', { a: 1, b: 'x' }), '1-x-1');
});

test('fill turns missing/null placeholders into empty strings', () => {
  assert.equal(fill('[{missing}]', {}), '[]');
  assert.equal(fill('[{n}]', { n: null }), '[]');
});

// ---- automation fan-out ----

test('document.sent sends a single invite message', async () => {
  const ran = await runAutomations('document.sent', { title: 'חוזה' }, ENV);
  assert.equal(ran, 1);
  assert.match(calls[0].body.text, /נשלחה בקשת חתימה/);
  assert.match(calls[0].body.text, /חוזה/);
});

test('test event echoes the message field', async () => {
  await runAutomations('test', { message: 'שלום' }, ENV);
  assert.match(calls[0].body.text, /בדיקת רכזת: שלום/);
});

test('document.signed with no fileUrl still counts both actions but sends only the message', async () => {
  const ran = await runAutomations('document.signed', { title: 'חוזה' }, ENV);
  assert.equal(ran, 2); // both actions counted
  assert.equal(calls.length, 1); // but the empty-URL document is skipped
  assert.ok(calls[0].url.includes('/sendMessage'));
});
