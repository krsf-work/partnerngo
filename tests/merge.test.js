/* V75.5: merge on save. mergePart(base, mine, theirs) must keep everyone's
   changes: base = what this device last saw, mine = this device now,
   theirs = the server now. Run: node tests/merge.test.js */
const assert = require('assert');
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(process.env.SAHKAR_APP || path.join(__dirname, '..', 'index.html'), 'utf8');
const ctx = vm.createContext({});
const a = src.indexOf('const MERGE_CONFLICT'), z = src.indexOf('/* V75.5: the same clean-up');
assert(a > 0 && z > a, 'merge section not found');
vm.runInContext(src.slice(a, z), ctx);
vm.runInContext('this.mergePart = mergePart; this.MC = MERGE_CONFLICT;', ctx);
const J = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const M = (b, m, t) => { const r = ctx.mergePart(J(b), J(m), J(t)); return r === ctx.MC ? r : J(r); };
let n = 0; const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); n++; };

const base = [{ id: 'd1', amt: 1, note: 'a' }, { id: 'd2', amt: 2, note: 'b' }];
// nothing changed here: take the server copy
eq(M(base, base, [{ id: 'd1', amt: 9, note: 'a' }]), [{ id: 'd1', amt: 9, note: 'a' }], 'no local change -> server');
// server unchanged: my copy
eq(M(base, [{ id: 'd1', amt: 5, note: 'a' }, base[1]], base), [{ id: 'd1', amt: 5, note: 'a' }, base[1]], 'server unchanged -> mine');
// different rows edited: both kept
eq(M(base, [{ id: 'd1', amt: 5, note: 'a' }, base[1]], [base[0], { id: 'd2', amt: 2, note: 'B!' }]),
   [{ id: 'd1', amt: 5, note: 'a' }, { id: 'd2', amt: 2, note: 'B!' }], 'different rows');
// same row, different fields: both kept
eq(M(base, [{ id: 'd1', amt: 5, note: 'a' }, base[1]], [{ id: 'd1', amt: 1, note: 'X' }, base[1]]),
   [{ id: 'd1', amt: 5, note: 'X' }, base[1]], 'same row, different fields');
// same field: mine (the later save) wins
eq(M(base, [{ id: 'd1', amt: 5, note: 'a' }, base[1]], [{ id: 'd1', amt: 7, note: 'a' }, base[1]])[0].amt, 5, 'same field -> later save');
// offline device adds a row while someone else added another: both kept
eq(M(base, base.concat([{ id: 'd3', amt: 3 }]), base.concat([{ id: 'd4', amt: 4 }])).map(r => r.id), ['d1', 'd2', 'd4', 'd3'], 'two adds');
// Apps Script appended d4 while I deleted d1
eq(M(base, [base[1]], base.concat([{ id: 'd4', amt: 4 }])).map(r => r.id), ['d2', 'd4'], 'my delete + their add');
// they deleted a row I did not touch, I edited another
eq(M(base, [base[0], { id: 'd2', amt: 22, note: 'b' }], [base[0]]).map(r => r.id), ['d1'], 'their delete stands');
// I removed a field
eq(M([{ id: 'x', a: 1, b: 2 }], [{ id: 'x', a: 1 }], [{ id: 'x', a: 1, b: 2, c: 3 }]), [{ id: 'x', a: 1, c: 3 }], 'field removed');
// keyed maps (budgets, flagged, meta)
eq(M({ n1: { cap: 1, sp: 0 }, n2: { cap: 2 } }, { n1: { cap: 1, sp: 5 }, n2: { cap: 2 } }, { n1: { cap: 10, sp: 0 }, n2: { cap: 2 }, n3: { cap: 3 } }),
   { n1: { cap: 10, sp: 5 }, n2: { cap: 2 }, n3: { cap: 3 } }, 'map merge');
eq(M({ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 2, c: 3 }), { a: 1, c: 3 }, 'map key delete');
// rows without ids can't be merged safely: refuse instead of guessing
assert.strictEqual(M([{ a: 1 }], [{ a: 2 }], [{ a: 3 }]), ctx.MC); n++;
assert.strictEqual(M([{ id: 'a' }, { id: 'a' }], [{ id: 'a', x: 1 }], [{ id: 'b' }]), ctx.MC); n++;
// first save of a part never seen: mine
eq(M(undefined, [{ id: 'q' }], null), [{ id: 'q' }], 'server empty');
console.log('merge: all ' + n + ' assertions passed');
