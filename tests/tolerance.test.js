const assert = require('assert');
const { loadFns } = require('./harness');

/* The contract for how much layout variation the importer tolerates. Three
   real files already differed in five dimensions each; more leads' files are
   still unseen. This file is the living record of what is supported, and —
   just as importantly — what is deliberately not. */

let n = 0;
const F = loadFns(
  ['TM_MONTHS','TM_COLS','tmSheetKind','tmReadHeading','tmHasHeaderNear','tmHeaderMonth','tmSheetYear','tmFindInlineMonthBlocks','TM_HEADING_MAX_CHARS','tmIsHeaderRow','tmFindBlocks',
   'tmColMap','tmMonthIndex','tmParseDate','tmWeekOfMonth','TM_ORDINALS','tmSerialToIso','tmIsoOf','tmRepairDate',
   'tmNormStatus','tmRowCells','tmNonEmpty','tmCell','tmRawCell','tmPad',
   'tmReadSheets','tmReplaceMonths'],
  { genId: p => `${p}_${++n}` });

const HDR  = ['Sr. No','Objective','Key Result','Deadline','Status','Priority'];
const ROW1 = ['1','Obj one','First result','20/06/2026','Done','1'];
const ROW2 = ['','','Second result','27/06/2026','Not Done','2'];

const readCount = sheets =>
  F.tmReadSheets(sheets, 'u1', 'i1', '2026-08-19').rows.length;
const oneSheet = (name, head, hdr) =>
  [{ name, cells: [head, hdr || HDR, ROW1, ROW2] }];

/* ---- sheet names ---- */
['MBO','OKR','okr','Monthly MBO','OKR 2026','MBO Sheet','My OKRs','KRA','OKRs']
  .forEach(nm => assert.strictEqual(readCount(oneSheet(nm, ['June 2026'])), 2,
    `a sheet named "${nm}" should be read`));

/* Deliberately NOT read: a to-do list is a different artefact from an MBO,
   and one real file keeps both. Reading it would import scratch notes. */
assert.strictEqual(F.tmSheetKind('ToDo List '), null);
assert.strictEqual(F.tmSheetKind('TO DO List'), null);
/* Nor are unnamed draft copies, which duplicate months from the real sheet. */
assert.strictEqual(F.tmSheetKind('Sheet9'), null);
assert.strictEqual(F.tmSheetKind('Print'), null);

/* ---- block headings ---- */
['June 2026','MBO - June 2026','MBO_Some Name_June 2026','JUNE 2026','June-2026',
 'MBO June 2026','June 2026 MBO','Month: June 2026','06/2026','6/2026']
  .forEach(h => assert.strictEqual(readCount(oneSheet('MBO', [h])), 2,
    `heading "${h}" should start a block`));

/* Deliberately NOT supported: a two-digit year. "June 26" is indistinguishable
   from a date meaning 26 June, and guessing wrong would file a whole month
   under the wrong year. It fails loudly instead. */
assert.strictEqual(F.tmReadHeading(['June 26'], 'kr'), null,
  '"June 26" is ambiguous with a date and must not be guessed');

/* ---- the key-result column ---- */
['Key Result','Key result','KEY RESULTS','Key Results','KR','Activity','Deliverable']
  .forEach(l => assert.strictEqual(
    readCount(oneSheet('MBO', ['June 2026'], ['Sr. No','Objective',l,'Deadline','Status'])), 2,
    `a key-result column called "${l}" should be found`));

/* ---- the deadline column ---- */
['Deadline','Timeline','Time line','When','Due Date','Target Date','Date','By When']
  .forEach(l => assert.strictEqual(
    readCount(oneSheet('MBO', ['June 2026'], ['Sr. No','Objective','Key Result',l,'Status'])), 2,
    `a deadline column called "${l}" should be found`));

/* ---- date formats, with the block's year available as a fallback ---- */
[['20/06/2026','2026-06-20'], ['20-06-2026','2026-06-20'], ['20.06.2026','2026-06-20'],
 ['2026-06-20','2026-06-20'], ['20 June 2026','2026-06-20'], ['20th June 2026','2026-06-20'],
 ['June 20 2026','2026-06-20'], ['20th June','2026-06-20'], ['June 20','2026-06-20'],
 [45823,'2025-06-15']]
  .forEach(([raw, want]) => assert.strictEqual(F.tmParseDate(raw, 2026), want,
    `"${raw}" should read as ${want}`));

/* Deliberately unreadable rather than guessed. */
[['20/6/26','a two-digit year'], ['next Tuesday','prose'], ['','blank'], ['-','a dash'],
 ['31/06/2026','a day that does not exist']]
  .forEach(([raw, why]) => assert.strictEqual(F.tmParseDate(raw, 2026), '',
    `${why} must stay blank rather than being guessed`));

/* ---- action sheets ---- */
[['Action Item',  ['SL.','Action','Who','When']],
 ['Action Items', ['Sr No','Action Item','By Whom','Time line','Status']],
 ['Action item',  ['Sr no.','Action Item','Whom','When','Status']],
 ['Actions',      ['No','Action Point','Owner','Due Date','Status']]]
  .forEach(([nm, hdr]) => assert.strictEqual(readCount([{ name:nm, cells:[
      ['June 2026'], hdr,
      ['1','Do a thing','Someone','20/06/2026','Done'],
      ['2','Do another','Someone','27/06/2026','Done']] }]), 2,
    `action sheet "${nm}" with a "${hdr[1]}" column should be read`));

/* ---- when it cannot read a file, it must say what it saw ---- */
const blind = F.tmReadSheets([
  { name:'Summary', cells:[['Some notes'],['nothing table-like here']] },
  { name:'Data',    cells:[['a','b'],['c','d']] }
], 'u1', 'i1', '2026-08-19');
assert.strictEqual(blind.rows.length, 0);
assert.ok(Array.isArray(blind.seen), 'the reader reports the sheets it looked at');
assert.deepStrictEqual(Array.from(blind.seen, s => s.name), ['Summary','Data'],
  'every sheet in the file is listed, so the user can see what was skipped');
assert.ok(blind.seen.every(s => 'kind' in s && 'blocks' in s),
  'and for each, whether it was recognised and how many blocks it held');

console.log('tolerance: all assertions passed');
