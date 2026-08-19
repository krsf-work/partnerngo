const assert = require('assert');
const { loadFns } = require('./harness');

/* The Daily Sheet used to show every lead's logs to every other lead. It is
   now scoped to the reporting line: you see yourself and anyone below you. */

const USERS = [
  { id:'pm',   name:'The PM',    role:'PM' },
  { id:'top',  name:'Top Lead',  role:'Programme', ngoIds:['n1'] },
  { id:'mid',  name:'Mid Lead',  role:'Programme', ngoIds:['n2'], reportsTo:'top' },
  { id:'low',  name:'Low Lead',  role:'APL',       ngoIds:['n3'], reportsTo:'mid' },
  { id:'solo', name:'Solo Lead', role:'Programme', ngoIds:['n4'] },
  { id:'acct', name:'Accounts',  role:'Accounts' },
  { id:'view', name:'Auditor',   role:'Viewer' }
];

const who = me => Array.from(
  loadFns(['teamOf','dailyPeople'], { DB:{ users:USERS }, ME:me }).dailyPeople(),
  u => u.id).sort();

assert.deepStrictEqual(who(USERS[0]), ['low','mid','solo','top'],
  'the PM still sees every lead, and only leads');
assert.deepStrictEqual(who(USERS[1]), ['low','mid','top'],
  'a manager sees themselves and their whole chain');
assert.deepStrictEqual(who(USERS[2]), ['low','mid'], 'a middle manager sees themselves and below');
assert.deepStrictEqual(who(USERS[3]), ['low'], 'someone at the bottom sees only themselves');
assert.deepStrictEqual(who(USERS[4]), ['solo'], 'someone with nobody below sees only themselves');

/* The narrowing that was the point of this change. */
assert.ok(!who(USERS[3]).includes('mid'), 'a subordinate can no longer see their manager\'s day');
assert.ok(!who(USERS[3]).includes('top'), 'nor two levels up');
assert.ok(!who(USERS[4]).includes('top'), 'nor a peer\'s, outside their tree');
assert.ok(!who(USERS[1]).includes('solo'), 'a manager does not see leads outside their tree');

/* Roles with no daily sheet of their own get nobody, rather than everybody. */
assert.deepStrictEqual(who(USERS[5]), [], 'Accounts has no daily-sheet audience');
assert.deepStrictEqual(who(USERS[6]), [], 'nor does a read-only Viewer');
assert.deepStrictEqual(
  Array.from(loadFns(['teamOf','dailyPeople'], { DB:{ users:USERS }, ME:null }).dailyPeople()), [],
  'no session sees nobody');

/* Writing was already own-only and must stay that way. */
const fs = require('fs');
const path = require('path');
const CANONICAL = 'D:\\Guru\\Mirror\\CRITICAL FILES\\Claude Apps\\Partnership Dashboard\\index.html';
const APP = process.env.SAHKAR_APP
  || (fs.existsSync(CANONICAL) ? CANONICAL : path.join(__dirname, '..', 'index.html'));
const src = fs.readFileSync(APP, 'utf8');
const save = /function dailySaveDay\([\s\S]*?\n\}/.exec(src)[0];
assert.ok(/aplId\s*!==\s*ME\.id/.test(save),
  'dailySaveDay must still refuse to write anyone else\'s day');

console.log('daily-scope: all assertions passed');
