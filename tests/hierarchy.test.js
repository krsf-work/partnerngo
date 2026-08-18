const assert = require('assert');
const { loadFns } = require('./harness');

/* A reporting line lets a manager SEE everything below them while editing
   stays with the owner. Every assertion below has a negative twin: the
   failure that matters here is fail-open. */

const USERS = [
  { id:'pm',  name:'The PM',   role:'PM'                                             },
  { id:'top', name:'Top Lead', role:'Programme', ngoIds:['n1','n2']                  },
  { id:'mid', name:'Mid Lead', role:'Programme', ngoIds:['n3'],      reportsTo:'top' },
  { id:'low', name:'Low Lead', role:'APL',       ngoIds:['n4','n5'], reportsTo:'mid' },
  { id:'solo',name:'Solo',     role:'Programme', ngoIds:['n6']                       },
  { id:'none',name:'No NGOs',  role:'Programme', ngoIds:[],          reportsTo:'top' }
];
const NGOS = ['n1','n2','n3','n4','n5','n6'].map(id => ({ id }));

const ctx = me => ({ DB: { users: USERS, ngos: NGOS, teamMbo: [] }, ME: me });
const load = (names, me) => loadFns(names, ctx(me));
const ids = s => Array.from(s).sort();

/* ---- teamOf ---- */
const T = load(['teamOf'], USERS[1]);
assert.deepStrictEqual(ids(T.teamOf('solo')), ['solo'], 'nobody below them is just themselves');
assert.deepStrictEqual(ids(T.teamOf('mid')), ['low','mid'], 'one level down');
assert.deepStrictEqual(ids(T.teamOf('top')), ['low','mid','none','top'],
  'the whole chain, three deep');
assert.deepStrictEqual(ids(T.teamOf('low')), ['low'], 'a leaf is just themselves');
assert.deepStrictEqual(ids(T.teamOf('nobody-at-all')), ['nobody-at-all'],
  'an unknown id returns just that id rather than everyone');
assert.deepStrictEqual(ids(T.teamOf('')), [], 'no id is nobody, not everyone');

/* A cycle must terminate. It should never arrive — Admin refuses to make one
   — but a restored backup or a concurrent edit could produce it, and the walk
   has to survive that rather than hang the app. */
const CYCLE = [
  { id:'a', role:'Programme', ngoIds:['n1'], reportsTo:'b' },
  { id:'b', role:'Programme', ngoIds:['n2'], reportsTo:'a' }
];
const C = loadFns(['teamOf'], { DB:{ users: CYCLE, ngos: NGOS }, ME: CYCLE[0] });
assert.deepStrictEqual(ids(C.teamOf('a')), ['a','b'], 'a cycle terminates and includes both');

/* ---- effectiveNgoIds ---- */
const E = load(['teamOf','effectiveNgoIds'], USERS[1]);
assert.deepStrictEqual(ids(E.effectiveNgoIds('low')), ['n4','n5'], 'own only when nobody reports in');
assert.deepStrictEqual(ids(E.effectiveNgoIds('mid')), ['n3','n4','n5'], 'own plus one level');
assert.deepStrictEqual(ids(E.effectiveNgoIds('top')), ['n1','n2','n3','n4','n5'],
  'own plus the whole chain — and NOT n6, which belongs to nobody in the tree');
assert.deepStrictEqual(ids(E.effectiveNgoIds('none')), [],
  'a manager with no NGOs of their own and nobody below sees none');

const DUP = [
  { id:'x', role:'Programme', ngoIds:['n1','n2'] },
  { id:'y', role:'Programme', ngoIds:['n2','n3'], reportsTo:'x' }
];
const D = loadFns(['teamOf','effectiveNgoIds'], { DB:{ users:DUP, ngos:NGOS }, ME:DUP[0] });
assert.deepStrictEqual(ids(D.effectiveNgoIds('x')), ['n1','n2','n3'],
  'an NGO owned by both appears once');

/* ---- visibleNgos: viewing widens ---- */
const seen = me => Array.from(
  load(['teamOf','effectiveNgoIds','visibleNgos','PORTFOLIO_WIDE_ROLES'], me).visibleNgos(), n => n.id).sort();

assert.deepStrictEqual(seen(USERS[1]), ['n1','n2','n3','n4','n5'], 'a manager sees their whole team');
assert.deepStrictEqual(seen(USERS[2]), ['n3','n4','n5'], 'a middle manager sees themselves and below');
assert.deepStrictEqual(seen(USERS[3]), ['n4','n5'],
  'someone at the bottom sees only their own — never their manager\'s');
assert.deepStrictEqual(seen(USERS[4]), ['n6'], 'someone outside the tree is unaffected');
assert.deepStrictEqual(seen(USERS[0]), ['n1','n2','n3','n4','n5','n6'], 'the PM sees everything');

/* Visibility flows DOWN only. This is the assertion that would catch the
   worst possible bug in this change. */
assert.ok(!seen(USERS[3]).includes('n3'), 'a subordinate must not see their manager\'s NGOs');
assert.ok(!seen(USERS[3]).includes('n1'), 'nor their manager\'s manager\'s');
assert.ok(!seen(USERS[1]).includes('n6'), 'nor a peer\'s, outside the tree');

/* An unrecognised role still sees nothing. */
const withRole = role => Array.from(
  loadFns(['teamOf','effectiveNgoIds','visibleNgos','PORTFOLIO_WIDE_ROLES'],
    { DB:{ users:USERS, ngos:NGOS }, ME:{ id:'zz', role, ngoIds:[] } })
    .visibleNgos(), n => n.id);

assert.deepStrictEqual(withRole('SomethingNew'), [],
  'an unrecognised role sees nothing, not everything');
assert.deepStrictEqual(
  Array.from(loadFns(['teamOf','effectiveNgoIds','visibleNgos','PORTFOLIO_WIDE_ROLES'],
    { DB:{users:USERS,ngos:NGOS}, ME:null }).visibleNgos()), [],
  'no session sees nothing');

/* ...but the roles whose work spans every partner must keep seeing them all.
   Narrowing these would break debit-note processing, which is the failure
   this change could most easily cause while looking correct. */
['Accounts','Finance','Viewer'].forEach(role =>
  assert.strictEqual(withRole(role).length, NGOS.length,
    `${role} must still see every NGO`));

/* ---- canEditNgo: editing does NOT widen ---- */
const canEdit = (me, ngoId) =>
  load(['teamOf','effectiveNgoIds','myNgoIds','canEditNgo','PORTFOLIO_WIDE_ROLES'], me).canEditNgo(ngoId);

assert.strictEqual(canEdit(USERS[1], 'n1'), true,  'a manager edits their own');
assert.strictEqual(canEdit(USERS[1], 'n3'), false, 'but NOT their subordinate\'s');
assert.strictEqual(canEdit(USERS[1], 'n4'), false, 'nor two levels down');
assert.strictEqual(canEdit(USERS[2], 'n3'), true,  'the owner still edits their own');
assert.strictEqual(canEdit(USERS[0], 'n3'), true,  'the PM edits everything');
assert.strictEqual(canEdit(USERS[4], 'n1'), false, 'a stranger edits nothing');
assert.strictEqual(
  loadFns(['teamOf','effectiveNgoIds','myNgoIds','canEditNgo','PORTFOLIO_WIDE_ROLES'],
    { DB:{users:USERS,ngos:NGOS}, ME:{ id:'zz', role:'SomethingNew', ngoIds:['n1'] } })
    .canEditNgo('n1'), false, 'an unrecognised role edits nothing even if assigned');

/* ---- visibleTeamMbo follows the same shape ---- */
const ROWS = [
  { id:'r1', ownerId:'top' }, { id:'r2', ownerId:'mid' },
  { id:'r3', ownerId:'low' }, { id:'r4', ownerId:'solo' }
];
const mbo = me => Array.from(
  loadFns(['teamOf','visibleTeamMbo'], { DB:{ users:USERS, teamMbo:ROWS }, ME:me })
    .visibleTeamMbo(), r => r.id).sort();

assert.deepStrictEqual(mbo(USERS[1]), ['r1','r2','r3'], 'a manager sees their team\'s MBO');
assert.deepStrictEqual(mbo(USERS[2]), ['r2','r3'], 'a middle manager sees themselves and below');
assert.deepStrictEqual(mbo(USERS[3]), ['r3'], 'the bottom sees only their own');
assert.ok(!mbo(USERS[3]).includes('r2'), 'and never their manager\'s');
assert.deepStrictEqual(mbo(USERS[0]).length, 4, 'the PM sees every row');
assert.deepStrictEqual(
  Array.from(loadFns(['teamOf','visibleTeamMbo'],
    { DB:{users:USERS,teamMbo:ROWS}, ME:null }).visibleTeamMbo()), [],
  'no session sees nothing');

console.log('hierarchy: all assertions passed');
