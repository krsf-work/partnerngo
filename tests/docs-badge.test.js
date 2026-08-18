const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadFns } = require('./harness');

/* Guards what removing the Dashboard's "Documents due soon" widget must NOT
   break. The widget itself is gone; the count behind it still feeds the
   Documents nav badge, and deleting the wrong function would kill document
   expiry alerting silently. The Dashboard rail that replaced it is covered
   by rail.test.js. */

const CANONICAL = 'D:\\Guru\\Mirror\\CRITICAL FILES\\Claude Apps\\Partnership Dashboard\\index.html';
const REPO_COPY = path.join(__dirname, '..', 'index.html');
const APP = process.env.SAHKAR_APP
  || (fs.existsSync(CANONICAL) ? CANONICAL : REPO_COPY);
const src = fs.readFileSync(APP, 'utf8');

/* ---- what must be gone ---- */
assert.ok(!/function docsExpiringWidget/.test(src), 'docsExpiringWidget must be gone');
assert.ok(!/function docsExpiringList/.test(src), 'docsExpiringList must be gone — nothing else used it');
assert.ok(!/docsExpiringWidget\(\)/.test(src), 'no call to docsExpiringWidget may remain');
assert.ok(!/docsExpiringList\(/.test(src), 'no call to docsExpiringList may remain');

/* Its CSS went too — a rule with no markup left to match is dead weight. */
['apl-doc-widget','apl-doc-list','apl-doc-name','apl-doc-days','apl-doc-empty','tm-alert-week']
  .forEach(cls => assert.ok(!src.includes('.' + cls),
    `dead CSS left behind: .${cls}`));

/* ---- what must survive ---- */
assert.ok(/function docsExpiringCount/.test(src),
  'docsExpiringCount must survive — the Documents nav badge depends on it');
assert.ok(/function docsNavCount/.test(src), 'docsNavCount must survive');
assert.ok(/function isDocExpiringSoon/.test(src), 'the 180-day expiry rule must survive');

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
assert.strictEqual(docsNavCount.call(null), 1, 'and does so with no receiver');

console.log('docs-badge: all assertions passed');
