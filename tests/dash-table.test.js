const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadFns } = require('./harness');

const CANONICAL = 'D:\\Guru\\Mirror\\CRITICAL FILES\\Claude Apps\\Partnership Dashboard\\index.html';
const REPO_COPY = path.join(__dirname, '..', 'index.html');
const APP = process.env.SAHKAR_APP
  || (fs.existsSync(CANONICAL) ? CANONICAL : REPO_COPY);
const src = fs.readFileSync(APP, 'utf8');

/* ---- the Partnership Lead column must actually name someone ----
   It showed "—" for all 23 NGOs because it only matched role "APL", while
   every real lead carries role "Programme". Same mismatch that hid the
   folders panel. */
const A = loadFns(['aplNamesFor'], {
  DB: { users: [
    { id:'u1', name:'Lead One', role:'Programme', ngoIds:['n1','n2'] },
    { id:'u2', name:'Lead Two', role:'APL',       ngoIds:['n1'] },
    { id:'u3', name:'Someone',  role:'PM',        ngoIds:['n1'] },
    { id:'u4', name:'Finance',  role:'Accounts',  ngoIds:['n1'] }
  ] }
});
assert.strictEqual(A.aplNamesFor('n2'), 'Lead One',
  'a Programme lead must be named — this is the whole bug');
assert.strictEqual(A.aplNamesFor('n1'), 'Lead One, Lead Two',
  'both lead roles count, listed together');
assert.strictEqual(A.aplNamesFor('n9'), '—', 'an unassigned NGO still shows a dash');

const noIds = loadFns(['aplNamesFor'], {
  DB: { users: [{ id:'u1', name:'Lead One', role:'Programme' }] }
});
assert.strictEqual(noIds.aplNamesFor('n1'), '—', 'a lead with no ngoIds must not crash');

/* A PM or finance user is not a partnership lead. */
const pmOnly = loadFns(['aplNamesFor'], {
  DB: { users: [{ id:'u3', name:'Someone', role:'PM', ngoIds:['n1'] }] }
});
assert.strictEqual(pmOnly.aplNamesFor('n1'), '—',
  'other roles are not partnership leads even when assigned NGOs');

/* ---- the Scorecard column is gone from the Dashboard table ---- */
const dash = /function pageDash\(\)\{[\s\S]*?\n\}/.exec(src)[0];
assert.ok(!/<th>Scorecard<\/th>/.test(dash), 'the Scorecard column header must be gone');
assert.ok(!/scorecardPanel\(/.test(dash), 'the scorecard table must not be rendered on the Dashboard');

/* The table must stay internally consistent: one <col> and one <th> per
   column, and the expanded row's colspan must match. Getting this wrong
   misaligns every row without throwing. */
const colgroup = /<colgroup>([\s\S]*?)<\/colgroup>/.exec(dash);
assert.ok(colgroup, 'the NGO table still has a colgroup');
const colCount = (colgroup[1].match(/<col\b/g) || []).length;
const thead = /<thead>([\s\S]*?)<\/thead>/.exec(dash);
const thCount = (thead[1].match(/<th\b/g) || []).length;
assert.strictEqual(colCount, thCount,
  `colgroup has ${colCount} cols but the header has ${thCount} columns`);
assert.strictEqual(thCount, 5, 'five columns remain after removing Scorecard');

const widths = [...colgroup[1].matchAll(/width:(\d+)%/g)].map(m => +m[1]);
assert.strictEqual(widths.length, 5, 'every column declares a width');
assert.strictEqual(widths.reduce((a,b)=>a+b,0), 100,
  `column widths total ${widths.reduce((a,b)=>a+b,0)}%, not 100%`);

const row = /function dashNgoRow\([\s\S]*?\n\}/.exec(src)[0];
const colspan = /colspan="(\d+)"/.exec(row);
assert.ok(colspan, 'the expanded milestones row still spans the table');
assert.strictEqual(+colspan[1], thCount,
  `the expanded row spans ${colspan[1]} columns but the table has ${thCount}`);
assert.ok(!/class="badge \$\{sc\.status\}"/.test(row),
  'the scorecard badge cell must be gone from the row');

/* ---- what must NOT be broken ---- */
assert.ok(/function ngoScore/.test(src),
  'ngoScore must survive — the NGO detail page still uses it');
assert.ok(/function scorecardPanel/.test(src) === false || true, 'scorecardPanel may go or stay');
assert.ok(/DB\.scorecards/.test(src),
  'the scorecard data itself is untouched — only the Dashboard views were removed');

console.log('dash-table: all assertions passed');
