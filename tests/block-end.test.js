const assert = require('assert');
const { loadFns } = require('./harness');

/* A real file lost five of its eight August rows because one key result read
   "...as implementation agency for MNREGA by March 2027" and happened to have
   only three filled cells. That looked enough like "March 2027" to start a
   new block, so the month ended early and everything below it vanished —
   silently, with no flag and no error.

   Two things were wrong:
     1. A heading was allowed to be any length. Real ones are short.
     2. The rule for ENDING a block was weaker than the rule for STARTING
        one: starting required a header row to follow, ending did not. So a
        row that could never have begun a block could still terminate one. */

let n = 0;
const F = loadFns(
  ['TM_MONTHS','TM_COLS','tmSheetKind','tmReadHeading','tmIsHeaderRow','tmFindBlocks',
   'tmColMap','tmMonthIndex','tmParseDate','tmWeekOfMonth','TM_ORDINALS','tmSerialToIso','tmIsoOf','tmRepairDate','tmHasHeaderNear','tmHeaderMonth','tmSheetYear','tmFindInlineMonthBlocks','TM_HEADING_MAX_CHARS',
   'tmNormStatus','tmRowCells','tmNonEmpty','tmCell','tmRawCell','tmPad',
   'tmReadSheets','tmReplaceMonths'],
  { genId: p => `${p}_${++n}` });

/* ---- the exact shape that broke ---- */
const AUG = [
  ['MBO_Some Name_August_ 2026'],
  ['Sr No.','Objective','Key Result','Deadline','Status','Priority','Time estimate','Reference','Comment'],
  ['1.0','An objective','Generate total benefit of 9.6 Lakh','30/08/2026','','11.0','4.0','','a comment'],
  ['','','Submit a proposal for 10 villages','15/08/2026','Done','1.0','1.0','','another comment'],
  ['2.0','Another objective','Generate total benefit of 20 Lakh','30/08/2026','','2.0','3.0'],
  /* three filled cells, and the text mentions a month and a year */
  ['','','Recognition of 10 Gram Sabha as implementation agency for MNREGA by March 2027','','','','1.0','','a comment'],
  ['','','Enroll 150 people into different government schemes','30/08/2026','','5.0','1.0','','a comment'],
  ['3.0','A third objective','Generate total benefit of 5.5 Lakh','30/08/2026','','3.0','4.0','','a comment'],
  ['','','Enroll 165 people into different government schemes','30/08/2026','','2.0','2.0','','a comment'],
  ['4.0','A fourth objective','Due diligence of three organisations','15/08/2026','','4.0','3.0','','a comment']
];

const blocks = F.tmFindBlocks(AUG, 'kr');
assert.strictEqual(blocks.length, 1, 'one month, not two');
assert.strictEqual(blocks[0].month, 8);
assert.strictEqual(blocks[0].lastRow, AUG.length - 1,
  'the block must run to the end — a key result mentioning a future month is not a heading');

const read = F.tmReadSheets([{ name:'MBO', cells:AUG }], 'u1', 'i1', '2026-08-20');
assert.strictEqual(read.rows.length, 8, 'all eight key results are read');
assert.ok(read.rows.some(r => /Recognition of 10 Gram Sabha/.test(r.title)),
  'including the one that looked like a heading');
assert.ok(read.rows.some(r => /Due diligence/.test(r.title)),
  'and the last one, which sat below it');
assert.deepStrictEqual(Array.from(read.months), ['2026-08'],
  'and no phantom March 2027 month is invented');

/* ---- a heading is short ---- */
assert.strictEqual(
  F.tmReadHeading(['Recognition of 10 Gram Sabha as implementation agency for MNREGA by March 2027'], 'kr'),
  null, 'a sentence is not a heading, however many months it names');
assert.ok(F.tmReadHeading(['MBO_Some Name_August_ 2026'], 'kr'), 'a real heading still is');
assert.ok(F.tmReadHeading(['June 2026'], 'kr'));
assert.ok(F.tmReadHeading(['MBO - October 2025'], 'kr'));

/* ---- ending a block is now as strict as starting one ---- */
const TRAILING = [
  ['June 2026'],
  ['Sr. No','Objective','Key Result','Deadline','Status'],
  ['1','Obj','A key result','20/06/2026','Done'],
  ['','','Deliver the plan by July 2026','27/06/2026','Done'],
  [],
  ['July 2026'],
  ['Sr. No','Objective','Key Result','Deadline','Status'],
  ['1','Obj','A July key result','20/07/2026','Done']
];
const tb = F.tmFindBlocks(TRAILING, 'kr');
assert.strictEqual(tb.length, 2, 'two real blocks');
assert.strictEqual(tb[0].lastRow, 3, 'the June block keeps both its rows');
assert.strictEqual(tb[1].month, 7, 'and July still starts where it should');

console.log('block-end: all assertions passed');
