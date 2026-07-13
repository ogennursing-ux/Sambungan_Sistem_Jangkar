// The automation rules: which incoming event triggers which actions.
//
// Any system can POST an event to the hub:
//   POST https://<hub>/hook/<event-name>?secret=<WEBHOOK_SECRET>
//   body: any JSON — its fields fill the {placeholders} in the actions below.
//
// Action types:
//   telegram.message  — send a text message to your chat ({text})
//   telegram.document — send a file by public URL ({url}, optional {caption})
//   webhook.post      — POST the event payload onward to another system's URL,
//                       which is how one system triggers another.
import { sendText, sendDocument } from './telegram.js';

export const RULES = [
  {
    on: 'document.signed', // מסמך נחתם במערכת החתימות
    do: [
      { type: 'telegram.message', text: '✅ המסמך «{title}» נחתם!' },
      { type: 'telegram.document', url: '{fileUrl}', caption: '{title}' },
    ],
  },
  {
    on: 'document.sent', // נוצר קישור חתימה חדש
    do: [{ type: 'telegram.message', text: '✉️ נשלחה בקשת חתימה: «{title}»' }],
  },
  {
    on: 'test', // לבדיקת הרכזת: POST /hook/test עם {"message":"..."}
    do: [{ type: 'telegram.message', text: '🔔 בדיקת רכזת: {message}' }],
  },
  // דוגמה לחיבור מערכת-למערכת (הסר את ההערה ומלא כתובת):
  // {
  //   on: 'customer.created',
  //   do: [
  //     { type: 'telegram.message', text: '👤 לקוח חדש: {name}' },
  //     { type: 'webhook.post', url: 'https://hook.eu2.make.com/xxx' },
  //   ],
  // },
];

// Replace {field} with payload.field; unknown fields become an empty string.
export function fill(template, payload) {
  return String(template).replace(/\{(\w+)\}/g, (_, k) =>
    payload[k] == null ? '' : String(payload[k]),
  );
}

export async function runAutomations(event, payload, env, rules = RULES) {
  const matched = rules.filter((r) => r.on === event);
  let ran = 0;
  for (const rule of matched) {
    for (const action of rule.do) {
      try {
        if (action.type === 'telegram.message') {
          await sendText(env, fill(action.text, payload));
        } else if (action.type === 'telegram.document') {
          const url = fill(action.url, payload);
          if (url) await sendDocument(env, url, fill(action.caption || '', payload));
        } else if (action.type === 'webhook.post') {
          await fetch(fill(action.url, payload), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ event, ...payload }),
          });
        }
        ran++;
      } catch (e) {
        console.error(`automation failed (${event} -> ${action.type}):`, e.message);
      }
    }
  }
  return ran;
}
