// Telegram command router — the bot's "brain". Owner-only: messages from any
// chat other than TELEGRAM_CHAT_ID get a polite refusal.
import { sendText, sendDocument } from './telegram.js';
import { latestSigned, stats, signedPdfUrl } from './connectors/ogenSign.js';

const HELP = `אני הרכזת של עוגן 🤖 הפקודות שלי:

/חתימות — 5 החתימות האחרונות
/מסמך — המסמך החתום האחרון כקובץ
/סטטוס — כמה נחתמו וכמה ממתינים
/עזרה — ההודעה הזו`;

const heDate = (iso) =>
  new Date(iso).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    dateStyle: 'short',
    timeStyle: 'short',
  });

export async function handleTelegramUpdate(update, env) {
  const msg = update.message || update.edited_message;
  if (!msg?.text) return;
  const chatId = String(msg.chat.id);

  if (env.TELEGRAM_CHAT_ID && chatId !== String(env.TELEGRAM_CHAT_ID)) {
    await sendText(env, 'סליחה, אני בוט פרטי 🙂', chatId);
    return;
  }

  const cmd = msg.text.trim().split(/[@\s]/)[0];
  try {
    switch (cmd) {
      case '/start':
      case '/עזרה':
      case '/help':
        await sendText(env, HELP, chatId);
        break;

      case '/חתימות':
      case '/latest': {
        const list = await latestSigned(env, 5);
        if (!list.length) {
          await sendText(env, 'אין עדיין מסמכים חתומים.', chatId);
          break;
        }
        const lines = list.map(
          (r, i) => `${i + 1}. ${r.title || 'ללא שם'} — ${heDate(r.signed_at)}`,
        );
        await sendText(env, `✍️ החתימות האחרונות:\n${lines.join('\n')}`, chatId);
        break;
      }

      case '/מסמך':
      case '/doc': {
        const [last] = await latestSigned(env, 1);
        if (!last) {
          await sendText(env, 'אין עדיין מסמכים חתומים.', chatId);
          break;
        }
        await sendDocument(
          env,
          signedPdfUrl(env, last.id),
          `✅ ${last.title || 'מסמך'} — נחתם ${heDate(last.signed_at)}`,
          chatId,
        );
        break;
      }

      case '/סטטוס':
      case '/status': {
        const s = await stats(env);
        await sendText(
          env,
          `📊 מצב מערכת החתימות:\n✅ נחתמו: ${s.signed}\n⏳ ממתינים לחתימה: ${s.pending}`,
          chatId,
        );
        break;
      }

      default:
        await sendText(env, `לא הכרתי את הפקודה "${cmd}".\n\n${HELP}`, chatId);
    }
  } catch (e) {
    console.error('command failed:', cmd, e.message);
    await sendText(env, `משהו השתבש בביצוע ${cmd}: ${e.message}`, chatId);
  }
}
