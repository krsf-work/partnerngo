const assert = require('assert');
const { loadFns } = require('./harness');

/* V73 stores OKRs and tasks per NGO (ngoData/{ngoId}/{part}/{id}) and the
   team app writes them row by row. A diff bug here loses or duplicates
   data, so the diff is tested against what Firebase hands back. */
const F = loadFns(['NGO_SPLIT_PARTS','stableJson','fbKey','byOrd','ngoDataFlatten','splitRowUpdates'], {});
const plain = v => JSON.parse(JSON.stringify(v));

/* stableJson: key order, null and empty containers do not matter */
assert.strictEqual(F.stableJson({ b:1, a:'x' }), F.stableJson({ a:'x', b:1 }), 'key order ignored');
assert.strictEqual(F.stableJson({ a:1, c:null, d:{}, e:[] }), F.stableJson({ a:1 }), 'empty values = absent, like Firebase');
assert.notStrictEqual(F.stableJson({ a:'' }), F.stableJson({}), 'an empty string is a real value');
assert.notStrictEqual(F.stableJson({ a:[1,2] }), F.stableJson({ a:[2,1] }), 'array order matters');

/* fbKey: never produces a key Firebase rejects */
assert.strictEqual(F.fbKey('a.b#c$d[e]f/g'), 'a_b_c_d_e_f_g');
assert.strictEqual(F.fbKey(''), '_none');
assert.strictEqual(F.fbKey(undefined), '_none');

/* first save of existing rows writes every row under its NGO */
const rows = [
  { id:'k1', ngoId:'n1', kr:'one', status:'Pending' },
  { id:'k2', ngoId:'n2', kr:'two', status:'Done' }
];
let up = {};
let now = F.splitRowUpdates('mbo', up, rows, {});
assert.deepStrictEqual(Object.keys(up).sort(), ['ngoData/n1/mbo/k1', 'ngoData/n2/mbo/k2']);
assert.strictEqual(up['ngoData/n1/mbo/k1'].ord, 0, 'display order recorded');
assert.strictEqual(up['ngoData/n2/mbo/k2'].ord, 1);

/* round trip: what Firebase returns (keys re-sorted) flattens back to equal rows,
   and saving again with nothing changed writes nothing */
const server = { n1:{ mbo:{ k1: plain(up['ngoData/n1/mbo/k1']) }, profile:{ short:'One' } },
                 n2:{ mbo:{ k2: plain(up['ngoData/n2/mbo/k2']) } } };
const flat = F.ngoDataFlatten(server);
assert.deepStrictEqual(Array.from(flat.mbo, r=>r.id), ['k1','k2'], 'order restored from ord');
assert.strictEqual(F.stableJson(flat.mbo), F.stableJson(rows), 'flattened rows equal the local ones');
up = {};
F.splitRowUpdates('mbo', up, rows, flat.rows.mbo);
assert.deepStrictEqual(Object.keys(up), [], 'unchanged rows are not rewritten');

/* edit one, delete one, add one */
const prev = flat.rows.mbo;
const rows2 = [ Object.assign({}, rows[0], { status:'Done' }), { id:'k3', ngoId:'n1', kr:'three', status:'Pending' } ];
up = {};
now = F.splitRowUpdates('mbo', up, rows2, prev);
assert.strictEqual(up['ngoData/n1/mbo/k1'].status, 'Done', 'edited row written');
assert.strictEqual(up['ngoData/n2/mbo/k2'], null, 'deleted row removed');
assert.ok(up['ngoData/n1/mbo/k3'], 'new row written');
assert.deepStrictEqual(Object.keys(now).sort(), ['k1','k3']);

/* moving a task to another NGO removes it from the old one */
const t = [{ id:'t1', ngoId:'n1', title:'x', status:'Open', ord:0 }];
const tPrev = F.ngoDataFlatten({ n1:{ tasks:{ t1: plain(t[0]) } } }).rows.tasks;
t[0].ngoId = 'n2';
up = {};
F.splitRowUpdates('tasks', up, t, tPrev);
assert.strictEqual(up['ngoData/n1/tasks/t1'], null, 'old location cleared');
assert.strictEqual(up['ngoData/n2/tasks/t1'].ngoId, 'n2', 'new location written');

/* rows without an NGO still save, under _none, and odd ids are made safe */
up = {};
F.splitRowUpdates('tasks', up, [{ id:'a.b', title:'orphan', status:'Open' }], {});
assert.ok(up['ngoData/_none/tasks/a_b'], 'unassigned row kept, key made safe');

/* the flattener ignores junk and empty nodes */
const junk = F.ngoDataFlatten({ n1:null, n2:{ mbo:{ x:'not a row', y:{ id:'y', ngoId:'n2' } } }, n3:{} });
assert.deepStrictEqual(Array.from(junk.mbo, r=>r.id), ['y']);
assert.deepStrictEqual(Array.from(F.ngoDataFlatten(null).tasks), []);

console.log('split-storage: all assertions passed');
