const assert = require('assert');
const { loadFns } = require('./harness');

let n = 0;
const F = loadFns(
  ['TM_MONTHS','TM_COLS','tmReadSheets','tmReplaceMonths','tmSheetKind','tmFindBlocks',
   'tmColMap','tmMonthIndex','tmReadHeading','tmIsHeaderRow','tmParseDate','tmRepairDate','tmNormStatus',
   'tmSerialToIso','tmIsoOf','tmRowCells','tmNonEmpty','tmCell','tmRawCell','tmPad'],
  { genId: p => `${p}_${++n}` }
);

/* ---- which sheets are read at all ----
   One real file keeps four stale draft copies of months that also live on
   the MBO sheet. Reading them would silently double those months. */
assert.strictEqual(F.tmSheetKind('MBO'), 'kr');
assert.strictEqual(F.tmSheetKind('SRISTI MBO'), 'kr');
assert.strictEqual(F.tmSheetKind('Action Item '), 'action', 'trailing space');
assert.strictEqual(F.tmSheetKind('Action item'), 'action', 'lower-case i');
assert.strictEqual(F.tmSheetKind('Sheet9'), null, 'a draft copy is not read');
assert.strictEqual(F.tmSheetKind('Sheet17'), null);
assert.strictEqual(F.tmSheetKind('Print'), null);
assert.strictEqual(F.tmSheetKind('ToDo List '), null);

const sheets = [{
  name: 'MBO',
  cells: [
    ['MBO - August 2026'],
    ['Sr. No.','Objective','Key Result','Deadline','Status','Priority','Time estimate','Time spent','Comment','Resource'],
    ['1.0','Objective one','First key result','31/08/2026','Done','1','5 Days','3 Days','went fine','Sheet A'],
    ['','','Second key result','15/08/2026','Not done','2','1 Day','','',''],
    ['2..','Objective two','Third key result','','','High','','','',''],
    [],
    ['MBO - March 2026'],
    ['Sr No.','Objective','Key Result','Timeline','Status','Comment','Priority'],
    ['1','Objective three','Fourth key result',46298,'Done','fine','3']
  ]
}, {
  name: 'Action item',
  cells: [
    ['','AUGUST'],
    [],
    ['','Sr no.','Action Item','Whom','When','Status'],
    ['','1','An action item','Someone','20/08/2026','Done'],
    ['','2','Another action','Someone','','']
  ]
}, {
  name: 'Sheet9',
  cells: [
    ['MBO - August 2026'],
    ['Sr. No.','Objective','Key Result','Deadline','Status'],
    ['1','Stale objective','A STALE DRAFT ROW','31/08/2026','Done']
  ]
}];

const out = F.tmReadSheets(sheets, 'u1', 'imp_1', '2026-08-18');

/* ---- the stale draft sheet is skipped, and said so ---- */
assert.ok(!out.rows.some(r => r.title === 'A STALE DRAFT ROW'),
  'rows from an unnamed draft sheet must not be imported');
assert.ok(out.flags.some(f => f.kind === 'skippedsheet' && /Sheet9/.test(f.detail)),
  'a skipped sheet that looked like it held MBO data is reported, not hidden');

/* ---- records ---- */
const krs  = out.rows.filter(r => r.type === 'kr');
const acts = out.rows.filter(r => r.type === 'action');
assert.strictEqual(krs.length, 4, '4 key results');
assert.strictEqual(acts.length, 2, '2 action items');
assert.ok(out.rows.every(r => r.ownerId === 'u1'), 'every row is stamped with the owner');
assert.ok(out.rows.every(r => r.importBatch === 'imp_1'), 'every row carries the batch id');

/* ---- objective inheritance (merged cells in the real files) ---- */
const second = krs.find(r => r.title === 'Second key result');
assert.strictEqual(second.objective, 'Objective one',
  'a blank objective cell inherits the one above it');
assert.strictEqual(second.month, '2026-08');

/* ---- objNum normalisation ---- */
assert.strictEqual(krs.find(r=>r.title==='First key result').objNum, '1', '"1.0" becomes "1"');
assert.strictEqual(krs.find(r=>r.title==='Third key result').objNum, '2', '"2.." becomes "2"');

/* ---- priority is stored verbatim in the right field ---- */
const first = krs.find(r=>r.title==='First key result');
const third = krs.find(r=>r.title==='Third key result');
assert.strictEqual(first.rank, 1);
assert.strictEqual(first.band, '');
assert.strictEqual(third.band, 'High');
assert.strictEqual(third.rank, null, 'a word priority must not be turned into a number');

/* ---- time estimate and time spent stay apart ---- */
assert.strictEqual(first.timeEst, '5 Days');
assert.strictEqual(first.timeSpent, '3 Days');

/* ---- the date repair fires, and is flagged ---- */
const fourth = krs.find(r => r.title === 'Fourth key result');
assert.strictEqual(fourth.deadline, '2026-03-10',
  'serial 46298 is 3 Oct; in a March block it is 10 March typed d/m');
assert.strictEqual(fourth.deadlineFixed, true);
assert.ok(out.flags.some(f => f.kind === 'repaired' && f.title === 'Fourth key result'),
  'a repaired date is reported to the user, never silently changed');

/* ---- a missing deadline is kept blank, not invented ---- */
assert.strictEqual(third.deadline, '');
assert.strictEqual(third.deadlineRaw, '');

/* ---- action items: year inferred from the dates, not the heading ---- */
const firstAct = acts.find(r => r.title === 'An action item');
assert.strictEqual(firstAct.deadline, '2026-08-20');
assert.strictEqual(firstAct.month, '2026-08', 'year came from the parsed date');
assert.strictEqual(acts.find(r => r.title === 'Another action').deadline, '',
  'no date given stays blank');

/* ---- months present ---- */
assert.deepStrictEqual(Array.from(out.months), ['2026-03','2026-08'], 'sorted, de-duplicated');

/* ---- year inference across a December/January rollover ----
   One real action sheet heads a block "JANUARY" with no year and no readable
   dates inside it. The blocks run in order, so it follows December 2025. */
const rollover = F.tmReadSheets([{
  name: 'Action item',
  cells: [
    ['','DECEMBER 2025'],
    ['','Sr no.','Action Item','Whom','When','Status'],
    ['','1','A December thing','Someone','10/12/2025','Done'],
    [],
    ['','JANUARY'],
    ['','Sr no.','Action Item','Whom','When','Status'],
    ['','1','An undated January thing','Someone','','']
  ]
}], 'u1', 'imp_2', '2026-08-18');
const jan = rollover.rows.find(r => r.title === 'An undated January thing');
assert.strictEqual(jan.month, '2026-01',
  'January after December 2025 is January 2026, not 2025');

/* A block that can be resolved by neither its heading, its dates, nor a
   preceding block must be flagged rather than guessed. */
const noYear = F.tmReadSheets([{
  name: 'Action item',
  cells: [
    ['','JANUARY'],
    ['','Sr no.','Action Item','Whom','When','Status'],
    ['','1','Undated and unanchored','Someone','','']
  ]
}], 'u1', 'imp_3', '2026-08-18');
assert.strictEqual(noYear.rows.length, 0, 'an unresolvable block imports nothing');
assert.ok(noYear.flags.some(f => f.kind === 'noyear'), 'and says so');

/* ---- re-upload replaces only the months in the file ---- */
const existing = [
  { id:'old1', ownerId:'u1', month:'2026-08', title:'stale August row' },
  { id:'old2', ownerId:'u1', month:'2026-07', title:'July row, not in the file' },
  { id:'old3', ownerId:'u2', month:'2026-08', title:'someone else August' }
];
const merged = F.tmReplaceMonths(existing, 'u1', ['2026-08'],
  [{ id:'new1', ownerId:'u1', month:'2026-08', title:'fresh' }]);
assert.deepStrictEqual(Array.from(merged, r => r.id).sort(), ['new1','old2','old3'],
  'u1 August replaced; u1 July untouched; u2 August untouched');

/* Uploading the same file twice must not double the list. */
const once  = F.tmReplaceMonths([], 'u1', out.months, out.rows);
const twice = F.tmReplaceMonths(once, 'u1', out.months, out.rows);
assert.strictEqual(twice.length, once.length,
  're-uploading the same file leaves the count unchanged');

console.log('read: all assertions passed');
