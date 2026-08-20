const assert = require('assert');
const { loadFns } = require('./harness');

/* One lead writes deadlines in words: "First week of Jan", "2nd week of Feb".
   Seven of them, all coming through blank, so those key results sat under
   "No deadline given" rather than in the week they are actually due.

   A week is read as its LAST day — a deadline is the point by which the work
   is due, so "first week of January" means by the 7th, not on the 1st. */

const F = loadFns(
  ['TM_MONTHS','tmParseDate','tmWeekOfMonth','TM_ORDINALS','tmSerialToIso','tmIsoOf','tmWeekOfMonth','TM_ORDINALS'], {});

/* ordinal figures and words, long and short month names */
assert.strictEqual(F.tmParseDate('First week of Jan', 2026),   '2026-01-07');
assert.strictEqual(F.tmParseDate('1st week of Jan', 2026),     '2026-01-07');
assert.strictEqual(F.tmParseDate('2nd week of Jan', 2026),     '2026-01-14');
assert.strictEqual(F.tmParseDate('Second week of January', 2026), '2026-01-14');
assert.strictEqual(F.tmParseDate('3rd week of Feb', 2026),     '2026-02-21');
assert.strictEqual(F.tmParseDate('Third week of February', 2026), '2026-02-21');
assert.strictEqual(F.tmParseDate('4th week of March', 2026),   '2026-03-28');
assert.strictEqual(F.tmParseDate('Fourth week of March', 2026),'2026-03-28');

/* a fifth week runs to the end of the month, whatever its length */
assert.strictEqual(F.tmParseDate('5th week of Jan', 2026),  '2026-01-31');
assert.strictEqual(F.tmParseDate('5th week of Feb', 2026),  '2026-02-28', '2026 is not a leap year');
assert.strictEqual(F.tmParseDate('5th week of Feb', 2024),  '2024-02-29', 'but 2024 is');
assert.strictEqual(F.tmParseDate('5th week of April', 2026),'2026-04-30');

/* a year written in the phrase wins over the block's */
assert.strictEqual(F.tmParseDate('1st week of Jan 2025', 2026), '2025-01-07');

/* wording variants seen in the wild */
assert.strictEqual(F.tmParseDate('first week of  Jan', 2026), '2026-01-07', 'double space');
assert.strictEqual(F.tmParseDate('1st Week Of Jan', 2026),    '2026-01-07', 'mixed case');

/* without a year to fall back on it stays unreadable rather than guessing */
assert.strictEqual(F.tmParseDate('First week of Jan'), '');

/* and things that only look similar must NOT become dates */
assert.strictEqual(F.tmParseDate('week of Jan', 2026), '',
  'no ordinal, no date');
assert.strictEqual(F.tmParseDate('6th week of Jan', 2026), '',
  'there is no sixth week');
assert.strictEqual(F.tmParseDate('First week of the campaign', 2026), '',
  'not a month');
assert.strictEqual(F.tmParseDate('Complete the first week of training', 2026), '',
  'a sentence that happens to contain the words is not a deadline');

/* everything already supported still is */
assert.strictEqual(F.tmParseDate('20/06/2026', 2026), '2026-06-20');
assert.strictEqual(F.tmParseDate('20th June', 2026), '2026-06-20');
assert.strictEqual(F.tmParseDate('2026-06-20', 2026), '2026-06-20');

console.log('week-dates: all assertions passed');
