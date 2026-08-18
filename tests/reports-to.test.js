const assert = require('assert');
const { loadFns } = require('./harness');

/* The Admin "Reports to" dropdown, and the check that refuses a circular
   line. teamOf() survives a cycle, but one should never be creatable. */

const USERS = [
  { id:'pm',   name:'The PM',   role:'PM'                                     },
  { id:'top',  name:'Top Lead', role:'Programme'                              },
  { id:'mid',  name:'Mid Lead', role:'Programme', reportsTo:'top'             },
  { id:'low',  name:'Low Lead', role:'APL',       reportsTo:'mid'             },
  { id:'solo', name:'Solo',     role:'Programme'                              },
  { id:'acct', name:'Accounts', role:'Accounts'                               },
  { id:'view', name:'Auditor',  role:'Viewer'                                 }
];

const F = loadFns(['teamOf','reportsToOptions','wouldCreateCycle'],
  { DB: { users: USERS }, ME: USERS[0] });

const opts = u => Array.from(F.reportsToOptions(u), o => o.id).sort();

/* ---- who may be picked as a manager ---- */
assert.deepStrictEqual(opts(null), ['low','mid','solo','top'],
  'a new person may report to any lead; PM, Accounts and Viewer are not managers here');

assert.ok(!opts(USERS[1]).includes('top'), 'nobody can report to themselves');
assert.deepStrictEqual(opts(USERS[1]), ['solo'],
  'Top Lead cannot report to anyone already below them — only Solo is left');
assert.deepStrictEqual(opts(USERS[2]), ['solo','top'],
  'Mid Lead may report upward or sideways, but not to Low Lead who is below them');
assert.deepStrictEqual(opts(USERS[3]), ['mid','solo','top'],
  'Low Lead has nobody below, so every other lead is available');

/* ---- the cycle check itself ---- */
assert.strictEqual(F.wouldCreateCycle('top', 'low'), true,
  'pointing Top at someone below it closes a loop');
assert.strictEqual(F.wouldCreateCycle('top', 'mid'), true, 'one level down is still a loop');
assert.strictEqual(F.wouldCreateCycle('top', 'top'), true, 'reporting to yourself is a loop');
assert.strictEqual(F.wouldCreateCycle('mid', 'low'), true);

assert.strictEqual(F.wouldCreateCycle('mid', 'solo'), false, 'sideways is fine');
assert.strictEqual(F.wouldCreateCycle('low', 'top'), false,
  'reporting further up an existing chain is fine');
assert.strictEqual(F.wouldCreateCycle('solo', 'top'), false, 'joining a tree is fine');
assert.strictEqual(F.wouldCreateCycle('top', ''), false, 'clearing the field is always allowed');
assert.strictEqual(F.wouldCreateCycle('top', null), false);

console.log('reports-to: all assertions passed');
