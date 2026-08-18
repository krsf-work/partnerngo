const assert = require('assert');
const { loadFns } = require('./harness');

const F = loadFns(
  ['TM_MONTHS','TM_COLS',
   'tmNormStatus','tmSerialToIso','tmIsoOf','tmParseDate','tmRepairDate',
   'tmColMap','tmMonthIndex','tmReadHeading','tmFindBlocks','tmRowCells','tmNonEmpty'],
  {}
);
assert.strictEqual(F.TM_MONTHS.length, 12, 'the month table came across, not just the functions');

/* ---- status ---- */
assert.strictEqual(F.tmNormStatus('Done'), 'Done');
assert.strictEqual(F.tmNormStatus('done '), 'Done');
assert.strictEqual(F.tmNormStatus('Completed'), 'Done');
assert.strictEqual(F.tmNormStatus('In Progress'), 'In Progress');
assert.strictEqual(F.tmNormStatus('in progress'), 'In Progress');
assert.strictEqual(F.tmNormStatus('Not Done'), 'Not Done');
assert.strictEqual(F.tmNormStatus('Not done'), 'Not Done');
// "Note done" is a real typo in a real file and must not become "" or "Done".
assert.strictEqual(F.tmNormStatus('Note done'), 'Not Done');
assert.strictEqual(F.tmNormStatus(''), '');
assert.strictEqual(F.tmNormStatus(null), '');

/* ---- excel serials ---- */
assert.strictEqual(F.tmSerialToIso(45658), '2025-01-01');
assert.strictEqual(F.tmSerialToIso(45884), '2025-08-15');

/* ---- date parsing ---- */
assert.strictEqual(F.tmParseDate(45884), '2025-08-15', 'bare serial number');
assert.strictEqual(F.tmParseDate('45884.0'), '2025-08-15', 'serial arriving as text');
assert.strictEqual(F.tmParseDate('30/11/2025'), '2025-11-30', 'day first, not month first');
assert.strictEqual(F.tmParseDate('16/11/2025'), '2025-11-16');
assert.strictEqual(F.tmParseDate('28-9-2025'), '2025-09-28', 'dashes and single-digit month');
assert.strictEqual(F.tmParseDate('28th Feb 2026'), '2026-02-28');
assert.strictEqual(F.tmParseDate('31th July 2026'), '2026-07-31', '"31th" is a real typo');
assert.strictEqual(F.tmParseDate('30 June 2026'), '2026-06-30');
assert.strictEqual(F.tmParseDate('20th November 2025'), '2025-11-20');
assert.strictEqual(F.tmParseDate(''), '', 'blank is blank, not today');
assert.strictEqual(F.tmParseDate('-'), '', 'a dash is not a date');
assert.strictEqual(F.tmParseDate('sometime next month'), '', 'unparseable is blank');
assert.strictEqual(F.tmParseDate('31/04/2026'), '', '31 April does not exist — reject, do not roll over');

/* ---- the day/month repair ----
   Excel read "10/3/2026" (10 March) as 3 October and stored that serial.
   Repair only when the day equals the block's month AND swapping lands the
   date back inside the block's month. */
assert.deepStrictEqual(Object.assign({}, F.tmRepairDate('2026-10-03', 3)),
  { iso:'2026-03-10', fixed:true }, '3 Oct in a March block is 10 March typed d/m');
assert.deepStrictEqual(Object.assign({}, F.tmRepairDate('2026-12-03', 3)),
  { iso:'2026-03-12', fixed:true });
assert.deepStrictEqual(Object.assign({}, F.tmRepairDate('2025-10-11', 11)),
  { iso:'2025-11-10', fixed:true });

// Must NOT touch these.
assert.deepStrictEqual(Object.assign({}, F.tmRepairDate('2026-03-10', 3)),
  { iso:'2026-03-10', fixed:false }, 'already inside its own month — leave alone');
assert.deepStrictEqual(Object.assign({}, F.tmRepairDate('2026-05-20', 4)),
  { iso:'2026-05-20', fixed:false }, 'day 20 cannot be a month — a genuine later deadline');
assert.deepStrictEqual(Object.assign({}, F.tmRepairDate('2026-05-13', 4)),
  { iso:'2026-05-13', fixed:false }, 'day 13 cannot be a month — leave alone');
assert.deepStrictEqual(Object.assign({}, F.tmRepairDate('', 4)),
  { iso:'', fixed:false }, 'blank stays blank');
assert.deepStrictEqual(Object.assign({}, F.tmRepairDate('2026-11-04', 11)),
  { iso:'2026-11-04', fixed:false }, 'already inside its own month — leave alone');

/* ---- column mapping ---- */
const octHeader = ['Sr No.','Objective','Key Result','Timeline','Status','Comment','Priority','Time estimate','Reference'];
const novHeader = ['Sr No.','Objective','Key Result','Deadline','Status','Priority','Time estimate','Reference','Comment'];
const octMap = F.tmColMap(octHeader);
const novMap = F.tmColMap(novHeader);
assert.strictEqual(octMap.priority, 6);
assert.strictEqual(novMap.priority, 5, 'column order changes between months in one file');
assert.strictEqual(octMap.comment, 5);
assert.strictEqual(novMap.comment, 8, 'comment moves too — a sheet-wide header would swap these');
assert.strictEqual(octMap.deadline, 3, '"Timeline" maps to deadline');
assert.strictEqual(novMap.deadline, 3, '"Deadline" maps to deadline');
assert.strictEqual(octMap.title, 2);
assert.strictEqual(octMap.timeEst, 7, '"Time estimate" must not be swallowed by another field');

// A file that carries both estimate and spent must keep them apart.
const bothHeader = ['Sr. No.','Objective','Key Result','Deadline','Status','Priority','Time Estimate','Time spent','Comment','Resource'];
const bothMap = F.tmColMap(bothHeader);
assert.strictEqual(bothMap.timeEst, 6, 'Time Estimate');
assert.strictEqual(bothMap.timeSpent, 7, 'Time spent must not collide with Time Estimate');
assert.strictEqual(bothMap.ref, 9, '"Resource"');

// The action-item header uses different words, and one real file misspells it.
const actMap = F.tmColMap(['Sr no.','Action Item','Whom','When','Status']);
assert.strictEqual(actMap.title, 1, '"Action Item" maps to title');
assert.strictEqual(actMap.deadline, 3, '"When" maps to deadline');
assert.strictEqual(actMap.owner, 2, '"Whom" maps to owner');
assert.strictEqual(F.tmColMap(['Sr No','July Action Item','Time line','By Whom','Status','Resourse']).ref, 5,
  '"Resourse" is a real misspelling and must map to ref');
assert.strictEqual(F.tmColMap(['Sr No','July Action Item','Time line','By Whom','Status','Resourse']).title, 1,
  '"July Action Item" still maps to title');

/* ---- month detection inside a heading ----
   \b treats "_" as a word character, so \bseptember\b never matches inside
   "MBO_Some Name_September 2026". Both real files head their blocks that way. */
assert.strictEqual(F.tmMonthIndex('MBO - August 2026'), 7);
assert.strictEqual(F.tmMonthIndex('MBO_Some Name_September 2026'), 8, 'underscore before the month');
assert.strictEqual(F.tmMonthIndex('MBO_Some Name_November_ 2025'), 10, 'underscore on both sides');
assert.strictEqual(F.tmMonthIndex('AUGUST'), 7, 'a bare upper-case month name');
assert.strictEqual(F.tmMonthIndex('marching orders'), -1, 'must not match inside a longer word');
assert.strictEqual(F.tmMonthIndex('no month here'), -1);

/* ---- block detection ---- */
const rows = [
  ['MBO - August 2026'],
  ['Sr. No.','Objective','Key Result','Deadline','Status','Priority'],
  ['1','Obj one','KR one','31/08/2026','Done','1'],
  ['','','KR two','15/08/2026','Not Done','2'],
  [],
  ['MBO_Someone Name_September 2026'],
  ['Sr No.','Objective','Key Result','Timeline','Status'],
  ['1','Obj two','KR three','30/09/2026','Done']
];
const blocks = F.tmFindBlocks(rows, 'kr');
assert.strictEqual(blocks.length, 2, 'both heading styles are recognised');
assert.strictEqual(blocks[0].month, 8);
assert.strictEqual(blocks[0].year, 2026);
assert.strictEqual(blocks[0].headerRow, 1);
assert.strictEqual(blocks[0].firstRow, 2);
assert.strictEqual(blocks[0].lastRow, 3, 'block ends before the blank row');
assert.strictEqual(blocks[1].month, 9);
assert.strictEqual(blocks[1].headerRow, 6);

// A real heading has a stray underscore before the year.
const oddTitle = F.tmFindBlocks([
  ['MBO_Someone Name_November_ 2025'],
  ['Sr No.','Objective','Key Result','Deadline','Status'],
  ['1','O','K','25/11/2025','Done']
], 'kr');
assert.strictEqual(oddTitle.length, 1, '"November_ 2025" is still November 2025');
assert.strictEqual(oddTitle[0].month, 11);

// The false positive that would shred a block: MBO-looking text sitting in a
// Comment column of a real data row. Both real files contain this.
const trap = [
  ['MBO - August 2026'],
  ['Sr. No.','Objective','Key Result','Deadline','Status','Comment'],
  ['1','Obj','KR one','31/08/2026','Done','they will send MBO by 5 January 2026'],
  ['','','KR two','15/08/2026','Done','MBO framework and reporting approach for March 2026']
];
const trapBlocks = F.tmFindBlocks(trap, 'kr');
assert.strictEqual(trapBlocks.length, 1,
  'text mentioning MBO + a month + a year inside a populated row is NOT a heading');
assert.strictEqual(trapBlocks[0].lastRow, 3, 'both data rows stay in the block');

// A lone heading with no Key Result header beneath it is not a block.
assert.strictEqual(F.tmFindBlocks([['MBO - August 2026'], [], ['just prose']], 'kr').length, 0,
  'a heading with no header row within 3 rows is not a block');

// A heading with a header but no data rows is not a block either.
assert.strictEqual(F.tmFindBlocks([
  ['MBO - August 2026'],
  ['Sr. No.','Objective','Key Result','Deadline'],
  []
], 'kr').length, 0, 'an empty block is not a block');

// A REAL heading carries a stray jotting in a far-right cell. Requiring
// exactly one populated cell swallowed that whole month into the previous
// block — and it was the current month.
const strayNote = [
  ['MBO - July 2026'],
  ['Sr. No.','Objective','Key Result','Deadline','Status'],
  ['1','Obj','July KR','31/07/2026','Done'],
  ['MBO - August 2026','','','','','','','','','','','83 - 8000'],
  ['Sr. No.','Objective','Key Result','Deadline','Status'],
  ['1','Obj','August KR','31/08/2026','Done']
];
const strayBlocks = F.tmFindBlocks(strayNote, 'kr');
assert.strictEqual(strayBlocks.length, 2,
  'a heading with a stray note in a far-right cell still starts a block');
assert.strictEqual(strayBlocks[1].month, 8);
assert.strictEqual(strayBlocks[0].lastRow, 2,
  'July must end at its own row, not swallow August');

// But a data row that merely MENTIONS a month must still be rejected, even
// when it has few populated cells — the month text is not its first cell.
assert.strictEqual(F.tmFindBlocks([
  ['MBO - July 2026'],
  ['Sr. No.','Objective','Key Result'],
  ['1','Obj','deliver the MBO by August 2026']
], 'kr').length, 1, 'a mention in a later cell is not a heading');

// Action blocks: heading may be a bare month name, and rows may be indented.
const actRows = [
  [],
  ['','AUGUST'],
  [],
  ['','Sr no.','Action Item','Whom','When','Status'],
  ['','1','Do the thing','Someone',45925,'Done']
];
const actBlocks = F.tmFindBlocks(actRows, 'action');
assert.strictEqual(actBlocks.length, 1, 'a bare month name heads an action block');
assert.strictEqual(actBlocks[0].month, 8);
assert.strictEqual(actBlocks[0].year, null, 'no year in the heading — resolved later from the dates');
assert.strictEqual(actBlocks[0].headerRow, 3);

/* The other real action sheet works completely differently: ONE header row at
   the very top, and each month divided by a bare Excel date rather than a
   month name. Both shapes have to work. */
const dateDivided = [
  ['Sr No','July Action Item','Time line','By Whom','Status','Resourse'],
  ['',45839],
  ['1','Prepare the thing','10th July 2025','Someone','Done','Ref A'],
  ['2','Prepare another','11th July 2025','Someone','Done','Ref B'],
  ['',45870],
  ['1','An August thing','25th August 2025','Someone','Done','Ref C']
];
const dd = F.tmFindBlocks(dateDivided, 'action');
assert.strictEqual(dd.length, 2, 'an Excel date divides months when no month name is given');
assert.strictEqual(dd[0].month, 7, '45839 is 1 July 2025');
assert.strictEqual(dd[0].year, 2025, 'the divider date supplies the year too');
assert.strictEqual(dd[0].headerRow, 0, 'falls back to the single header above');
assert.strictEqual(dd[0].firstRow, 2);
assert.strictEqual(dd[0].lastRow, 3);
assert.strictEqual(dd[1].month, 8, '45870 is 1 August 2025');
assert.strictEqual(dd[1].headerRow, 0, 'the same top header serves every block');

console.log('parse: all assertions passed');
