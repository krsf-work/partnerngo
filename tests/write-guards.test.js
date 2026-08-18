const assert = require('assert');
const fs = require('fs');
const path = require('path');

/* Every write path in this app used to rely on "if you can see it, you own
   it". A reporting line breaks that: a manager can now see records they must
   not change. These assertions are the standing guard — a future write path
   that forgets an ownership check fails here rather than in production. */

const CANONICAL = 'D:\\Guru\\Mirror\\CRITICAL FILES\\Claude Apps\\Partnership Dashboard\\index.html';
const REPO_COPY = path.join(__dirname, '..', 'index.html');
const APP = process.env.SAHKAR_APP
  || (fs.existsSync(CANONICAL) ? CANONICAL : REPO_COPY);
const src = fs.readFileSync(APP, 'utf8');

/* Slice each top-level function from its declaration to the next one, then
   trim back to the last top-level closing brace.

   NOT brace matching: this file contains regex literals and nested template
   interpolation that desync a naive scanner, and a scanner that desyncs
   DROPS the function instead of reporting it. In a permission guard a
   dropped function is a function nobody checked, which fails silently and
   looks green. Slicing cannot drop anything, and the count assertion below
   proves it. */
function functionBodies(){
  const decls = [];
  const re = /^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/gm;
  let m;
  while ((m = re.exec(src)) !== null) decls.push({ name: m[1], idx: m.index });

  return decls.map((d, i) => {
    const stop = i + 1 < decls.length ? decls[i + 1].idx : src.length;
    let body = src.slice(d.idx, stop);
    /* cut at the last brace in column 0, so the next function's leading
       comment cannot be read as part of this one */
    const lastClose = body.lastIndexOf('\n}');
    if (lastClose > 0) body = body.slice(0, lastClose + 2);
    return { name: d.name, body, line: src.slice(0, d.idx).split('\n').length };
  });
}

/* Strip comments before testing for guards. Without this, a function counts
   as protected merely because a comment mentions canEditNgo — including a
   comment explaining that it deliberately does NOT call it. A guard that can
   be satisfied by prose is not a guard. */
function stripComments(s){
  return s
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // block comments
    .replace(/^[ \t]*\/\/.*$/gm, ' ');   // whole-line // comments
}

const ALL = functionBodies().map(f => Object.assign({}, f, { body: stripComments(f.body) }));

/* Nothing may be dropped: every declaration must have a body to inspect. */
const declCount = (src.match(/^(?:async\s+)?function\s+[A-Za-z0-9_$]+\s*\(/gm) || []).length;
assert.strictEqual(ALL.length, declCount,
  `extracted ${ALL.length} function bodies but the file declares ${declCount} — ` +
  'a dropped function is one this guard never checked');
const byName = {};
ALL.forEach(f => { byName[f.name] = f; });

const NGO_GUARD = /canEditNgo\s*\(|blockIfCantEditNgo\s*\(/;
const PM_GUARD  = /canManageNgos\s*\(|blockIfNotPM\s*\(|ME\.role\s*!==\s*"PM"|ME\.role\s*===\s*"PM"/;
const SELF_ONLY = /ME\.id/;

/* Functions that write, but are not scoped to an NGO at all: they act on the
   signed-in user's own record, or on data with no NGO dimension. Each is
   listed deliberately so adding a new one is a conscious act. */
const NOT_NGO_SCOPED = new Set([
  'esc',                 // scanner artifact: its regex literal contains quote
                         // characters that confuse the brace matcher, so its
                         // extracted body runs past its real end
  'scheduleSaveRetry',   // retry plumbing, writes whatever was already queued
  'dailySaveDay',        // the signed-in user's own day
  'dailyHomeSaveToday',  // same
  'dailyAddComment',     // PM commenting on a roll-up
  'saveApl','deleteApl','savePm','importBackup',  // Admin, PM only
  'saveRefFile','deleteRefFile',                  // shared reference library
  'dismissFlagged',
  'tmConfirmImport',     // Team MBO upload, PM only
  'saveMbo','deleteMbo','deleteMboMonth','importMboFile','updateKrStatus'
]);

const writers = ALL.filter(f => /\bsaveDB\s*\(/.test(f.body) && f.name !== 'saveDB');
assert.ok(writers.length > 30, `expected to find the write paths, found ${writers.length}`);

const unguarded = [];
for (const f of writers) {
  if (NOT_NGO_SCOPED.has(f.name)) continue;
  if (NGO_GUARD.test(f.body) || PM_GUARD.test(f.body)) continue;
  // otherwise: is every caller guarded?
  const callers = ALL.filter(c => c.name !== f.name &&
    new RegExp('[^A-Za-z0-9_$]' + f.name + '\\s*\\(').test(c.body));
  const allCallersGuarded = callers.length > 0 &&
    callers.every(c => NGO_GUARD.test(c.body) || PM_GUARD.test(c.body));
  if (!allCallersGuarded) unguarded.push(`${f.name} (line ${f.line})`);
}

assert.deepStrictEqual(unguarded, [],
  'these write to the database without checking who owns the NGO:\n  ' + unguarded.join('\n  '));

/* The three the audit named explicitly must each check ownership. */
['setPartnership','saveTask','deleteTask'].forEach(name => {
  const f = byName[name];
  assert.ok(f, `${name} should still exist`);
  assert.ok(NGO_GUARD.test(f.body),
    `${name} must check NGO ownership, not just the signed-in user's role`);
});

/* canEditNgo must never be taught about the team. */
const cen = byName['canEditNgo'];
assert.ok(cen, 'canEditNgo exists');
assert.ok(/myNgoIds\s*\(/.test(cen.body),
  'canEditNgo must use myNgoIds() — own NGOs only');
assert.ok(!/effectiveNgoIds\s*\(/.test(cen.body),
  'canEditNgo must NOT use effectiveNgoIds() — that would let a manager edit their team\'s records');

/* visibleNgos must fail closed rather than defaulting to the whole portfolio. */
const vn = byName['visibleNgos'];
assert.ok(/PORTFOLIO_WIDE_ROLES/.test(vn.body),
  'visibleNgos must name the roles that legitimately see everything');
assert.ok(/return \[\];\s*\n\}/.test(vn.body) || /return \[\];[\s\S]*\}$/.test(vn.body),
  'visibleNgos must end by returning nothing for an unrecognised role');

console.log('write-guards: all assertions passed');
