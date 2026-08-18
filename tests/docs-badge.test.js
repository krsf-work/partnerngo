const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadFns } = require('./harness');

const CANONICAL = 'D:\\Guru\\Mirror\\CRITICAL FILES\\Claude Apps\\Partnership Dashboard\\index.html';
const REPO_COPY = path.join(__dirname, '..', 'index.html');
const APP = process.env.SAHKAR_APP
  || (fs.existsSync(CANONICAL) ? CANONICAL : REPO_COPY);
const src = fs.readFileSync(APP, 'utf8');

/* ---- what the change must REMOVE ---- */
assert.ok(!/function docsExpiringWidget/.test(src), 'docsExpiringWidget must be gone');
assert.ok(!/function docsExpiringList/.test(src), 'docsExpiringList must be gone — nothing else used it');
assert.ok(!/docsExpiringWidget\(\)/.test(src), 'no call to docsExpiringWidget may remain');
assert.ok(!/docsExpiringList\(/.test(src), 'no call to docsExpiringList may remain');

/* ---- what the change must NOT break ---- */
assert.ok(/function docsExpiringCount/.test(src),
  'docsExpiringCount must survive — the Documents nav badge depends on it');
assert.ok(/function docsNavCount/.test(src), 'docsNavCount must survive');

const { docsNavCount, docsExpiringCount } = loadFns(['docsNavCount','docsExpiringCount'], {
  DB: { documents: [
    { ngoId:'n1', expires:'2026-09-01' },
    { ngoId:'n1', expires:'2028-09-01' },
    { ngoId:'n2', expires:'2026-09-01' }
  ] },
  isDocExpiringSoon: d => !!d.expires && d.expires < '2027-02-14',
  visibleNgos: () => [{ id:'n1' }]
});
assert.strictEqual(docsExpiringCount(new Set(['n1'])), 1, 'document expiry counting still works');
assert.strictEqual(docsNavCount(), 1,
  'the Documents nav badge still returns a count after the widget is gone');

/* ---- the new card ---- */
const stubs = rows => ({
  TODAY_ISO: '2026-08-18',
  esc: s => String(s==null?"":s),
  visibleTeamMbo: () => rows,
  tmBucket: (r, today) => {
    if(r.status === 'Done') return 'done';
    if(!r.deadline) return 'undated';
    const late = Math.round((new Date(today) - new Date(r.deadline))/86400000);
    if(late > 0) return 'overdue';
    if(late >= -6) return 'week';
    return 'later';
  },
  tmDaysLate: (r, today) => r.deadline
    ? Math.round((new Date(today) - new Date(r.deadline))/86400000) : 0,
  tmOwnerName: id => id === 'u1' ? 'Lead One' : 'Lead Two',
  tmInitials:  id => id === 'u1' ? 'LO' : 'LT'
});

const G = loadFns(['tmOverdueCount','tmOverdueWidget'], stubs([
  { id:'a', ownerId:'u1', title:'Late one',  deadline:'2026-08-10', status:'Not Done' },
  { id:'b', ownerId:'u1', title:'Late two',  deadline:'2026-08-01', status:'In Progress' },
  { id:'c', ownerId:'u2', title:'This week', deadline:'2026-08-20', status:'Not Done' },
  { id:'d', ownerId:'u2', title:'Finished',  deadline:'2026-08-01', status:'Done' },
  { id:'e', ownerId:'u2', title:'Far off',   deadline:'2026-12-01', status:'Not Done' }
]));

assert.strictEqual(G.tmOverdueCount(), 2,
  'only genuinely overdue items count — not this week, not done, not far off');

const html = G.tmOverdueWidget();
assert.ok(html.includes('Late one') && html.includes('Late two'), 'lists the overdue items');
assert.ok(!html.includes('Finished'), 'a completed item is never shown as overdue');
assert.ok(!html.includes('Far off'), 'a future item is not overdue');
assert.ok(/17d/.test(html), 'shows how late the worst one is (2026-08-01 is 17 days)');
assert.ok(html.indexOf('Late two') < html.indexOf('Late one'),
  'most overdue first');
assert.ok(/week/i.test(html), 'mentions what is due this week');

/* Quiet week: nothing overdue and nothing due within 7 days → no card at all. */
const Q = loadFns(['tmOverdueWidget','tmOverdueCount'], stubs([
  { id:'x', ownerId:'u1', title:'Far', deadline:'2026-12-01', status:'Not Done' }
]));
assert.strictEqual(Q.tmOverdueWidget(), '', 'on a quiet week the card renders nothing at all');
assert.strictEqual(Q.tmOverdueCount(), 0);

/* And with no data at all it must not throw. */
const E = loadFns(['tmOverdueWidget','tmOverdueCount'], stubs([]));
assert.strictEqual(E.tmOverdueWidget(), '');
assert.strictEqual(E.tmOverdueCount(), 0);

console.log('docs-badge: all assertions passed');
