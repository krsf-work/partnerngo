const assert = require('assert');
const fs = require('fs');
const path = require('path');

const CANONICAL = 'D:\\Guru\\Mirror\\CRITICAL FILES\\Claude Apps\\Partnership Dashboard\\index.html';
const REPO_COPY = path.join(__dirname, '..', 'index.html');
const APP = process.env.SAHKAR_APP
  || (fs.existsSync(CANONICAL) ? CANONICAL : REPO_COPY);

const src = fs.readFileSync(APP, 'utf8');

/* Six places register an array collection. Missing one means Firebase hands
   the collection back as a keyed object and .filter() throws at runtime. */
const COERCION_LIST = /\["users","ngos","bigBets","debits","documents","tasks","mbo","refFiles","dailyLogs"(,"teamMbo")?\]/g;

const sites = [
  { name: 'skeletonData default', re: /teamMbo:\s*\[\]/ },
  { name: 'seedData return',      re: /refFiles:\[\][\s\S]{0,80}?teamMbo:\s*\[\]/ },
  { name: 'DB_PARTS',             re: /const DB_PARTS = \[[\s\S]*?"teamMbo"[\s\S]*?\]/ }
];
for(const s of sites){
  assert.ok(s.re.test(src), `teamMbo missing from: ${s.name}`);
}

const lists = src.match(COERCION_LIST) || [];
assert.strictEqual(lists.length, 3,
  `expected 3 array-coercion lists, found ${lists.length} — the shape changed, re-check by hand`);
lists.forEach((l, i) => {
  assert.ok(l.includes('"teamMbo"'), `coercion list #${i+1} does not include teamMbo: ${l}`);
});

console.log('store: teamMbo registered at all six sites');
