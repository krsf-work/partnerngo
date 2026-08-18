const assert = require('assert');
const { loadFns } = require('./harness');

const ROWS = [
  { id:'a', ownerId:'u1', month:'2026-08', type:'kr',     title:'A', deadline:'2026-08-10', status:'Not Done',    rank:1,    band:'' },
  { id:'b', ownerId:'u1', month:'2026-08', type:'action', title:'B', deadline:'2026-08-20', status:'Done',        rank:null, band:'High' },
  { id:'c', ownerId:'u2', month:'2026-07', type:'kr',     title:'C', deadline:'',           status:'',            rank:5,    band:'' },
  { id:'d', ownerId:'u2', month:'2026-08', type:'kr',     title:'D', deadline:'2026-09-30', status:'In Progress', rank:null, band:'Low' }
];

function run(filter){
  const F = loadFns(['tmFilterRows'], {
    TM_FILTER: filter,
    visibleTeamMbo: () => ROWS
  });
  return Array.from(F.tmFilterRows(), r => r.id).sort();
}

const ALL = { person:'', month:'', priority:'', status:'', type:'' };

assert.deepStrictEqual(run(ALL), ['a','b','c','d'], 'empty filters keep everything');
assert.deepStrictEqual(run({...ALL, person:'u1'}), ['a','b']);
assert.deepStrictEqual(run({...ALL, month:'2026-08'}), ['a','b','d']);
assert.deepStrictEqual(run({...ALL, type:'kr'}), ['a','c','d']);
assert.deepStrictEqual(run({...ALL, type:'action'}), ['b']);
assert.deepStrictEqual(run({...ALL, status:'Done'}), ['b']);
assert.deepStrictEqual(run({...ALL, status:'open'}), ['a','c','d'], '"open" means anything not Done');

/* "Top priority" spans both kinds of priority: rank 1-3, or the word High.
   Rank 5 must NOT qualify, and the two are never converted into each other. */
assert.deepStrictEqual(run({...ALL, priority:'top'}), ['a','b'],
  'rank 1 and band High qualify; rank 5 and band Low do not');

assert.deepStrictEqual(run({...ALL, person:'u2', type:'kr', month:'2026-08'}), ['d'],
  'filters combine');
assert.deepStrictEqual(run({...ALL, person:'nobody'}), [], 'no matches is empty, not everything');

/* A rank of 0 would be falsy — make sure it is not mistaken for "no rank". */
const withZero = loadFns(['tmFilterRows'], {
  TM_FILTER: { person:'', month:'', priority:'top', status:'', type:'' },
  visibleTeamMbo: () => [{ id:'z', ownerId:'u1', month:'2026-08', type:'kr',
                           title:'Z', deadline:'', status:'', rank:0, band:'' }]
});
assert.deepStrictEqual(Array.from(withZero.tmFilterRows(), r=>r.id), ['z'],
  'rank 0 is still a top rank, not a missing one');

console.log('filter: all assertions passed');
