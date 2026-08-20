const assert = require('assert');
const { loadFns } = require('./harness');

/* A third real layout, which the reader rejected outright. It differs from
   the first two in five separate ways, every one of them enough on its own
   to produce "couldn't find any month blocks". */

let n = 0;
const F = loadFns(
  ['TM_MONTHS','TM_COLS','tmSheetKind','tmReadHeading','tmHasHeaderNear','tmHeaderMonth','tmSheetYear','tmFindInlineMonthBlocks','TM_HEADING_MAX_CHARS','tmIsHeaderRow','tmFindBlocks',
   'tmColMap','tmMonthIndex','tmParseDate','tmSerialToIso','tmIsoOf','tmRepairDate',
   'tmNormStatus','tmRowCells','tmNonEmpty','tmCell','tmRawCell','tmPad',
   'tmReadSheets','tmReplaceMonths'],
  { genId: p => `${p}_${++n}` }
);

/* 1. The sheet is called "OKR", not "MBO". */
assert.strictEqual(F.tmSheetKind('OKR'), 'kr', 'a sheet named OKR holds key results');
assert.strictEqual(F.tmSheetKind('okr'), 'kr');
assert.strictEqual(F.tmSheetKind('MBO'), 'kr', 'and MBO still does');
assert.strictEqual(F.tmSheetKind('Sheet9'), null, 'a draft copy is still skipped');

/* 2. Block headings are a bare month and year — no "MBO" in them. */
assert.deepStrictEqual(Object.assign({}, F.tmReadHeading(['June 2026'], 'kr')),
  { month:6, year:2026 }, 'a bare "June 2026" heads a block');
assert.deepStrictEqual(Object.assign({}, F.tmReadHeading(['MBO - August 2026'], 'kr')),
  { month:8, year:2026 }, 'and the older style still works');
assert.strictEqual(F.tmReadHeading(['June'], 'kr'), null,
  'a key-result heading still needs a year');

/* The prose trap must STILL be rejected now that "MBO" is not required. */
assert.strictEqual(F.tmFindBlocks([
  ['June 2026'],
  ['Sr. No','Objective','Key result','Deadline','Status'],
  ['1','Obj','Deliver it','20th June','Done'],
  ['','','Finish by March 2027 at the latest','27th June','Done']
], 'kr').length, 1, 'a data row mentioning a month and year is not a heading');

/* 3. Deadlines carry no year: "20th June", "31st July". */
assert.strictEqual(F.tmParseDate('20th June', 2026), '2026-06-20');
assert.strictEqual(F.tmParseDate('27th June', 2026), '2026-06-27');
assert.strictEqual(F.tmParseDate('31st July', 2026), '2026-07-31');
assert.strictEqual(F.tmParseDate('22nd August', 2026), '2026-08-22');
assert.strictEqual(F.tmParseDate('5th August', 2026), '2026-08-05');
assert.strictEqual(F.tmParseDate('20th June'), '',
  'without a year to fall back on it stays unreadable rather than guessing');
assert.strictEqual(F.tmParseDate('31st June', 2026), '',
  '31 June does not exist — reject it');
/* An explicit year in the cell always wins over the block's. */
assert.strictEqual(F.tmParseDate('20th August 2026', 2025), '2026-08-20');
assert.strictEqual(F.tmParseDate('30/11/2025', 2026), '2025-11-30');

/* 4. The action sheet's title column is "Action", not "Action Item",
      and its owner column is "Who", not "Whom". */
const actHeader = ['SL.','Action','Who','When'];
assert.ok(F.tmIsHeaderRow(actHeader, 'action'), '"Action" heads an action-item table');
const am = F.tmColMap(actHeader, 'action');
assert.strictEqual(am.title, 1, '"Action" maps to the title');
assert.strictEqual(am.owner, 2, '"Who" maps to the owner');
assert.strictEqual(am.deadline, 3, '"When" maps to the deadline');

/* A data row must never pass as a header. "Not Done" contains "no", which is
   how a Sr. No column is written — matching that as a substring made a real
   data row look like a header and dropped the whole block beneath it. */
assert.ok(!F.tmIsHeaderRow(
  ['1','Another objective','Third key result','25th July','Not Done','','2'], 'kr'),
  'a data row containing "Not Done" is not a header row');
assert.ok(F.tmIsHeaderRow(
  ['Sr. No','Objective','Key result','Deadline','Status'], 'kr'),
  'but the real header still is');
assert.strictEqual(F.tmColMap(['Sr. No','Objective','Key result'], 'kr').objNum, 0,
  '"Sr. No" still maps, by exact match');

/* On a key-result sheet the title must still be the Key result column, even
   if some other column happens to be called Action. */
const krm = F.tmColMap(['Sr. No','Objective','Key result','Deadline','Action'], 'kr');
assert.strictEqual(krm.title, 2, 'Key result wins on a key-result sheet');

/* 5. End to end, in the real shape. */
const out = F.tmReadSheets([
  { name:'OKR', cells:[
      ['June 2026'],
      ['Sr. No','Objective','Key result','Deadline','Status','Comment','Priority','Time Estimate','Resource','Comment'],
      ['1','An objective','First key result','20th June','Done','','1'],
      ['','','Second key result','27th June','Done','','3'],
      [],
      ['','July 2026'],
      ['Sr. No.','Objective','Key result','Deadline','Status','Comment','Priority'],
      ['1','Another objective','Third key result','25th July','Not Done','','2']
  ]},
  { name:'Action Item', cells:[
      [46235],
      ['SL.','Action','Who','When'],
      ['1','Prepare the document','Someone','20th August 2026'],
      ['','A follow-on with no date','','']
  ]}
], 'u1', 'imp_1', '2026-08-19');

assert.strictEqual(out.rows.filter(r=>r.type==='kr').length, 3, 'all three key results read');
assert.strictEqual(out.rows.filter(r=>r.type==='action').length, 2, 'both action items read');
assert.deepStrictEqual(Array.from(out.months), ['2026-06','2026-07','2026-08']);

const byTitle = t => out.rows.find(r => r.title === t);
assert.strictEqual(byTitle('First key result').deadline, '2026-06-20',
  'the year comes from the block heading');
assert.strictEqual(byTitle('Second key result').objective, 'An objective',
  'a blank objective still inherits');
assert.strictEqual(byTitle('Third key result').month, '2026-07',
  'the second block is read even though its heading sits in a different column');
assert.strictEqual(byTitle('Third key result').rank, 2);
assert.strictEqual(byTitle('Prepare the document').deadline, '2026-08-20');
assert.strictEqual(byTitle('A follow-on with no date').deadline, '',
  'a row with no date keeps a blank deadline rather than inheriting one');

/* Nothing should be reported as unreadable for this file. */
const bad = out.flags.filter(f => f.kind === 'baddate');
assert.deepStrictEqual(Array.from(bad, f => f.title), [],
  'no deadline in this file should come back unreadable');

console.log('layout-okr: all assertions passed');
