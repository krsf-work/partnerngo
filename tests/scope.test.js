const assert = require('assert');
const { loadFns } = require('./harness');

const ROWS = [
  { id:'r1', ownerId:'u1', title:'A' },
  { id:'r2', ownerId:'u2', title:'B' }
];

/* Arrays built inside the sandbox belong to a different realm, so their
   prototype is not the test file's Array.prototype and deepStrictEqual
   rejects even two empty arrays. Pull ids into this realm before comparing. */
const idsOf = rows => Array.from(rows, r => r.id);

function visibleWith(me){
  const { visibleTeamMbo } = loadFns(['visibleTeamMbo'], { DB:{ teamMbo: ROWS }, ME: me });
  return visibleTeamMbo();
}

assert.strictEqual(visibleWith({ id:'u9', role:'PM' }).length, 2,
  'PM sees every row');
assert.deepStrictEqual(idsOf(visibleWith({ id:'u1', role:'Programme' })), ['r1'],
  'a lead sees only their own rows');
assert.deepStrictEqual(idsOf(visibleWith({ id:'u2', role:'APL' })), ['r2'],
  'role name does not matter, ownership does');

// The bug this guards: an earlier version of visibleNgos() defaulted an
// unrecognised role to seeing EVERYTHING. These two must return nothing.
assert.deepStrictEqual(idsOf(visibleWith({ id:'u5', role:'SomeNewRole' })), [],
  'an unrecognised role must see nothing, not everything');
assert.deepStrictEqual(idsOf(visibleWith(null)), [],
  'no signed-in user must see nothing');

// And it must not crash when the collection is absent.
const { visibleTeamMbo } = loadFns(['visibleTeamMbo'], { DB:{}, ME:{ id:'u1', role:'PM' } });
assert.deepStrictEqual(idsOf(visibleTeamMbo()), [], 'missing collection returns empty, not a throw');

console.log('scope: all assertions passed');
