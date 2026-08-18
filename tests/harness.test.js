const assert = require('assert');
const { loadFns } = require('./harness');

// The harness must find a function that really exists in the app.
const { docsExpiringCount } = loadFns(['docsExpiringCount'], {
  DB: { documents: [ {ngoId:'n1', expires:'2026-09-01'}, {ngoId:'n2', expires:null} ] },
  isDocExpiringSoon: d => !!d.expires
});
assert.strictEqual(typeof docsExpiringCount, 'function', 'should return a callable');
assert.strictEqual(docsExpiringCount(new Set(['n1'])), 1, 'should count the n1 document');

// And it must THROW for a name that does not exist, rather than quietly
// returning nothing — a harness that silently finds no functions would let
// every later test pass against an empty sandbox.
assert.throws(
  () => loadFns(['thisFunctionDoesNotExist_xyz'], {}),
  /thisFunctionDoesNotExist_xyz/,
  'must throw, naming the function it could not find'
);

console.log('harness: all assertions passed');
