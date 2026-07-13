# Anchor Hub 🤖⚓

רכזת אוטומציות אישית: מחברת בין **בוט הטלגרם** (@Anchor_Signatures_Bot) לבין
**המערכות שלי** — מערכת החתימות (Ogen Sign) וכל מערכת נוספת בעתיד.

```
מערכת חתימות ──┐                       ┌── הודעות/קבצים לטלגרם
מערכת אחרת   ──┼──▶  Anchor Hub  ◀──┼── פקודות מהטלגרם
כל webhook   ──┘   (Cloudflare)      └── הפעלת מערכות אחרות
```

## מה הרכזת יודעת לעשות

**פקודות בטלגרם** (רק מהצ'אט שלך):

| פקודה | פעולה |
|---|---|
| `/חתימות` | 5 החתימות האחרונות במערכת |
| `/מסמך` | שולח את המסמך החתום האחרון כקובץ PDF |
| `/סטטוס` | כמה מסמכים נחתמו וכמה ממתינים |
| `/עזרה` | רשימת הפקודות |

**אוטומציות** — כל מערכת שולחת אירוע ב-POST פשוט:

```
POST https://anchor-hub.<שם-החשבון>.workers.dev/hook/document.signed?secret=<הסוד>
{ "title": "חוזה שכירות", "fileUrl": "https://.../signed.pdf" }
```

והרכזת מבצעת את הפעולות שהוגדרו ב-`src/automations.js`: הודעת טלגרם, שליחת
קובץ, או קריאה ל-webhook של מערכת אחרת (כך מחברים מערכת למערכת).
מוסיפים אוטומציה חדשה = מוסיפים כלל אחד לקובץ.

## הקמה חד-פעמית (כ-10 דקות)

1. **חשבון Cloudflare חינמי** — https://dash.cloudflare.com/sign-up
2. **API Token** — בלוח הבקרה: My Profile → API Tokens → Create Token →
   תבנית "Edit Cloudflare Workers". שמור את הטוקן.
   את ה-Account ID רואים בדף הראשי של Workers.
3. **סודות בריפו** — Settings → Secrets and variables → Actions → New repository secret:
   - `CLOUDFLARE_API_TOKEN` — מהשלב הקודם
   - `CLOUDFLARE_ACCOUNT_ID` — מהשלב הקודם
   - `TELEGRAM_BOT_TOKEN` — הטוקן מ-@BotFather
   - `TELEGRAM_CHAT_ID` — מזהה הצ'אט שלך (מופיע במסך ההגדרות של מערכת החתימות אחרי "מצא Chat ID")
   - `WEBHOOK_SECRET` — סיסמה ארוכה שתמציא (למשל 30 תווים אקראיים)
4. **פריסה** — כל push לענף main פורס אוטומטית (Actions → Deploy hub).
5. **חיבור הבוט** — פתח פעם אחת בדפדפן:
   `https://anchor-hub.<שם-החשבון>.workers.dev/setup?secret=<WEBHOOK_SECRET>`
   ואז שלח לבוט `/start` בטלגרם.

## פיתוח מקומי

```bash
npm install
npm test          # בדיקות לוגיקה (ללא רשת)
npx wrangler dev  # הרצה מקומית
```

## אבטחה

- כל נקודות הקצה מוגנות ב-`WEBHOOK_SECRET`; טלגרם מאומת בכותרת הסודית של setWebhook.
- הבוט מציית רק לצ'אט שמוגדר ב-`TELEGRAM_CHAT_ID`.
- הרכזת קוראת ממסד הנתונים של מערכת החתימות עם המפתח הציבורי (anon) בלבד.
