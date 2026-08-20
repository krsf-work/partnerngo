const assert = require('assert');
const { loadFns } = require('./harness');

/* Two more real layouts, found by running every lead's file rather than
   waiting for each to be reported.

   A. One file has NO month heading row at all. The month lives inside the
      column header — "March (Key Results)" — and the year appears only in
      the sheet's name, "MBO 2026". There are no dates anywhere in it.
   B. Another calls its action-item column "Activity", a word previously
      accepted only on key-result sheets. Its whole action sheet read as
      empty. */

let n = 0;
const F = loadFns(
  ['TM_MONTHS','TM_COLS','tmSheetKind','tmReadHeading','tmHasHeaderNear','tmHeaderMonth','tmSheetYear','tmFindInlineMonthBlocks',
   'TM_HEADING_MAX_CHARS','tmIsHeaderRow','tmFindBlocks','tmColMap','tmMonthIndex',
   'tmParseDate','tmWeekOfMonth','TM_ORDINALS','tmSerialToIso','tmIsoOf','tmRepairDate','tmNormStatus',
   'tmRowCells','tmNonEmpty','tmCell','tmRawCell','tmPad','tmSheetYear',
   'tmReadSheets','tmReplaceMonths'],
  { genId: p => `${p}_${++n}` });

/* ---- A. the month is in the column header ---- */
const INLINE = [{
  name: 'MBO 2026',
  cells: [
    ['Sr. No.','Objectives','March (Key Results)','Status'],
    ['1','An objective','Complete due diligence on four partners','Go on one, no on another'],
    ['','','Establish a review mechanism for 12 partner NGOs','Done.'],
    ['2','Another objective','Finalise recruitment for the partnership roles','In Progress.'],
    [],
    ['Sr. No.','Objectives','April (Key Results)','Status'],
    ['1','An objective','Complete due diligence on two more partners','Done.'],
    ['','','Publish the ownership article','Done.']
  ]
}];

const inline = F.tmReadSheets(INLINE, 'u1', 'i1', '2026-08-20');
assert.strictEqual(inline.rows.length, 5, 'all five key results are read');
assert.deepStrictEqual(Array.from(inline.months), ['2026-03','2026-04'],
  'two months, their year taken from the sheet name');

const march = inline.rows.filter(r => r.month === '2026-03');
assert.strictEqual(march.length, 3);
assert.strictEqual(march[0].objective, 'An objective');
assert.strictEqual(march[1].objective, 'An objective',
  'a blank objective still inherits');
assert.strictEqual(march[0].status, '', 'free text in the status column is not a status');
assert.strictEqual(march[1].status, 'Done', '"Done." still reads as Done');
assert.ok(inline.rows.every(r => r.deadline === ''),
  'this file has no dates at all, and none are invented');

/* The year comes from the sheet name. */
assert.strictEqual(F.tmSheetYear('MBO 2026'), 2026);
assert.strictEqual(F.tmSheetYear('OKR 2025-26'), 2025, 'the first year of a range');
assert.strictEqual(F.tmSheetYear('MBO'), null, 'no year in the name is no year');

/* Without a year anywhere, the block is flagged rather than guessed. */
const noYear = F.tmReadSheets([{ name:'MBO', cells: INLINE[0].cells }],
  'u1', 'i2', '2026-08-20');
assert.strictEqual(noYear.rows.length, 0, 'nothing is imported');
assert.ok(noYear.flags.some(f => f.kind === 'noyear'), 'and it says why');

/* A header row WITHOUT a month must still behave as before — it heads the
   block announced by the heading row above it, not a block of its own. */
const normal = F.tmFindBlocks([
  ['MBO - June 2026'],
  ['Sr. No','Objective','Key Result','Deadline','Status'],
  ['1','Obj','A key result','20/06/2026','Done']
], 'kr');
assert.strictEqual(normal.length, 1, 'still one block, not two');
assert.strictEqual(normal[0].month, 6);
assert.strictEqual(normal[0].firstRow, 2, 'data still starts below the header');

/* ---- B. an action column called "Activity" ---- */
assert.ok(F.tmIsHeaderRow(['Serial No','Activity','Who','When (deadline)','Status'], 'action'),
  '"Activity" heads an action-item table too');
const am = F.tmColMap(['Serial No','Activity','Who','When (deadline)','Status'], 'action');
assert.strictEqual(am.title, 1, '"Activity" maps to the title');
assert.strictEqual(am.deadline, 3, '"When (deadline)" maps to the deadline');
assert.strictEqual(am.owner, 2);

const dib = F.tmReadSheets([{ name:'Action Item', cells:[
  ['Action item'],
  [],
  ['Serial No','Activity','Who','When (deadline)','Status'],
  [45992],
  ['1','Visit four partner NGOs','Someone','','Done'],
  ['2','Prepare a brief report','Someone','31st Dec 2025','Done']
]}], 'u1', 'i3', '2026-08-20');
assert.strictEqual(dib.rows.length, 2, 'both action items are read');
assert.strictEqual(dib.rows[0].month, '2025-12', 'the date divider supplies the month');
assert.strictEqual(dib.rows[1].deadline, '2025-12-31');

/* And "Activity" must still mean the key result on a key-result sheet. */
assert.strictEqual(F.tmColMap(['Sr No','Objective','Activity','Deadline'], 'kr').title, 2);

console.log('layout-inline-month: all assertions passed');
