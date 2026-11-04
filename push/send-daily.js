/* Sahkar · 9 am deadline reminder.
   Runs every morning from .github/workflows/daily-reminders.yml.

   For every phone that turned reminders on (push/{auth uid}/{key} = {token}),
   it works out that person's deadlines with the app's own functions, pulled
   straight out of index.html, so the reminder always matches what Home shows,
   and sends one notification through Firebase Cloud Messaging.

   Env:
     FIREBASE_SA   service-account JSON (GitHub secret)
     DRY_RUN=1     count only, send nothing
   The logs are public (public repo), so they show counts only — no names,
   no item titles. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const admin = require('firebase-admin');
const { extract } = require('../tests/harness.js');

const APP_URL = 'https://krsf-work.github.io/partnerngo/';
const DRY = process.env.DRY_RUN === '1';
const sa = JSON.parse(process.env.FIREBASE_SA || '{}');
if (!sa.client_email) { console.error('FIREBASE_SA secret is missing'); process.exit(1); }

admin.initializeApp({
  credential: admin.credential.cert(sa),
  databaseURL: 'https://ngo-partnership-program-default-rtdb.firebaseio.com'
});
const db = admin.database();

/* today in India, whatever time zone the runner is in */
const TODAY_ISO = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

/* load the app's functions; pull in whatever they reference until it runs */
const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ctx = vm.createContext({ console, TODAY_ISO, TODAY_MONTH: TODAY_ISO.slice(0, 7), DB: null, ME: null });
const loaded = new Set();
function need(name) {
  if (loaded.has(name)) return true;
  const body = extract(SRC, name);
  if (!body) return false;
  vm.runInContext(body, ctx);
  loaded.add(name);
  return true;
}
function call(fn, ...args) {
  for (let i = 0; i < 60; i++) {
    try { return ctx[fn](...args); }
    catch (e) {
      const m = e instanceof Error && /^(\w+) is not defined$/.exec(e.message || '');
      if (!m || !need(m[1])) throw e;
    }
  }
  throw new Error('too many missing names for ' + fn);
}
['v4Deadlines', 'v4Count', 'v4DueLabel', 'toArr', 'ngoDataFlatten', 'userById', 'DB_PARTS', 'NGO_SPLIT_PARTS', 'V4_KIND']
  .forEach(n => { if (!need(n)) throw new Error('index.html has no ' + n); });

const COLLECTIONS = ['users', 'ngos', 'bigBets', 'debits', 'documents', 'tasks', 'mbo', 'refFiles', 'dailyLogs', 'teamMbo'];

(async () => {
  const [tracker, ngoData, roles, push] = await Promise.all(
    ['tracker', 'ngoData', 'roles', 'push'].map(p => db.ref(p).once('value').then(s => s.val() || {})));

  const DB = {};
  ctx.DB_PARTS.filter(p => ctx.NGO_SPLIT_PARTS.indexOf(p) < 0).forEach(p => { DB[p] = tracker[p]; });
  COLLECTIONS.forEach(p => { if (ctx.NGO_SPLIT_PARTS.indexOf(p) < 0) DB[p] = call('toArr', DB[p]); });
  (DB.users || []).forEach(u => { if (u) u.ngoIds = call('toArr', u.ngoIds); });
  const flat = call('ngoDataFlatten', ngoData);
  ctx.NGO_SPLIT_PARTS.forEach(p => { DB[p] = flat[p]; });
  ctx.DB = DB;

  let people = 0, sent = 0, skipped = 0, removed = 0, failed = 0;
  for (const uid of Object.keys(push)) {
    const role = roles[uid];
    const tokens = Object.entries(push[uid] || {}).filter(([, v]) => v && v.token);
    if (!role || role.team !== true || !role.userId || !tokens.length) { skipped++; continue; }
    const me = (DB.users || []).find(u => u && u.id === role.userId);
    if (!me) { skipped++; continue; }
    people++;
    ctx.ME = me;
    const list = call('v4Deadlines'), c = call('v4Count', list);
    const n = c.late + c.today + c.week;
    if (!n) continue;                                   // nothing due this week: stay quiet
    const parts = [];
    if (c.late) parts.push(c.late + ' overdue');
    if (c.today) parts.push(c.today + ' due today');
    if (c.week) parts.push(c.week + ' this week');
    const top = list.filter(x => ['late', 'today', 'week'].includes(x.bucket));
    const first = top[0];
    const body = (first.title + ' · ' + call('v4DueLabel', first.due)).slice(0, 120)
      + (top.length > 1 ? `  +${top.length - 1} more` : '');
    const data = { title: parts.join(' · '), body, url: APP_URL, tag: 'sahkar-daily', count: String(c.late + c.today) };

    for (const [key, v] of tokens) {
      if (DRY) { sent++; continue; }
      try {
        await admin.messaging().send({
          token: v.token, data,
          webpush: { headers: { Urgency: 'high', TTL: String(12 * 3600) }, fcmOptions: { link: APP_URL } }
        });
        sent++;
      } catch (e) {
        const code = (e && e.code) || '';
        if (/registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code)) {
          await db.ref(`push/${uid}/${key}`).remove(); removed++;
        } else { failed++; console.warn('send failed:', code || e.message); }
      }
    }
  }
  console.log(`${TODAY_ISO}: ${people} people with reminders on, ${sent} ${DRY ? 'would be sent' : 'sent'}, ` +
              `${removed} old tokens removed, ${failed} failed, ${skipped} skipped`);
  process.exit(failed && !sent ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
