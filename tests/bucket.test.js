const assert = require('assert');
const { loadFns } = require('./harness');

const F = loadFns(['TM_BUCKETS','TM_STALE_AFTER_DAYS','tmBucket','tmDaysLate'], {});
const TODAY = '2026-08-18';
const b = (deadline, status) => F.tmBucket({ deadline, status }, TODAY);

/* Done wins over every date rule — a completed item is never "overdue". */
assert.strictEqual(b('2026-08-10','Done'), 'done', 'a late but completed item is done, not overdue');
assert.strictEqual(b('', 'Done'), 'done', 'an undated completed item is done, not undated');
assert.strictEqual(b('2026-12-01','Done'), 'done');

assert.strictEqual(b('2026-08-17','Not Done'), 'overdue', 'yesterday');
assert.strictEqual(b('2026-08-10','In Progress'), 'overdue');
assert.strictEqual(b('2026-08-10',''), 'overdue', 'no status still counts as outstanding');

/* Recent slippage is separated from the historical backlog. In the real data
   only 5 of 87 outstanding items were late by 30 days or less; the oldest was
   398 days. Lumping them together buries the ones that still need action. */
assert.strictEqual(b('2026-07-19','Not Done'), 'overdue', '30 days late is still "overdue"');
assert.strictEqual(b('2026-07-18','Not Done'), 'stale', '31 days late moves to the backlog');
assert.strictEqual(b('2025-07-16','Not Done'), 'stale', 'over a year late');
assert.strictEqual(b('2025-07-16','Done'), 'done', 'a finished item is never stale');

assert.strictEqual(b('2026-08-18','Not Done'), 'week', 'today is this week, not overdue');
assert.strictEqual(b('2026-08-24','Not Done'), 'week', 'today + 6 is the last day of this week');
assert.strictEqual(b('2026-08-25','Not Done'), 'soon', 'today + 7 falls into the next bucket');
assert.strictEqual(b('2026-09-14','Not Done'), 'soon', 'today + 27 is the last "soon" day');
assert.strictEqual(b('2026-09-15','Not Done'), 'later', 'today + 28 is later');
assert.strictEqual(b('2027-01-01','Not Done'), 'later');

assert.strictEqual(b('','Not Done'), 'undated');
assert.strictEqual(b('',''), 'undated');

/* days late */
assert.strictEqual(F.tmDaysLate({ deadline:'2026-08-10' }, TODAY), 8);
assert.strictEqual(F.tmDaysLate({ deadline:'2026-08-18' }, TODAY), 0);
assert.strictEqual(F.tmDaysLate({ deadline:'2026-08-20' }, TODAY), -2, 'future is negative');
assert.strictEqual(F.tmDaysLate({ deadline:'' }, TODAY), 0, 'no deadline is not late');

/* every bucket a record can land in must have a heading to render under */
const keys = Array.from(F.TM_BUCKETS, x => x.key);
['done','overdue','week','soon','later','undated','stale'].forEach(k =>
  assert.ok(keys.indexOf(k) >= 0, `TM_BUCKETS is missing a heading for "${k}"`));

/* the live buckets come first; the backlog and finished work sit at the tail */
assert.ok(keys.indexOf('overdue') < keys.indexOf('week'), 'overdue leads');
assert.ok(keys.indexOf('later') < keys.indexOf('stale'), 'the backlog sits below live work');
assert.ok(keys.indexOf('stale') < keys.indexOf('done'), 'and above Done');

console.log('bucket: all assertions passed');
