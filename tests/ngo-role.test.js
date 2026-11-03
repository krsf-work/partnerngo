const assert = require('assert');
const { loadFns } = require('./harness');

/* V72: the NGO login role. An outside organisation signs in, so the role
   must fail closed everywhere the team roles are allowed in. */
const DB = {
  ngos:  [{ id:'n1', short:'SeSTA' }, { id:'n2', short:'VNCS' }],
  users: [],
  mbo:   [{ id:'k1', ngoId:'n1', month:'2026-11', status:'Pending' },
          { id:'k2', ngoId:'n2', month:'2026-11', status:'Pending' },
          { id:'k3', ngoId:'n1', month:'2026-09', status:'Done' }],
  tasks: [{ id:'t1', ngoId:'n1', status:'Open' }, { id:'t2', ngoId:'n2', status:'Open' }]
};
const NGO_ME = { id:'u_ngo', role:'NGO', name:'SeSTA', ngoIds:['n1'] };
const FNS = ['PORTFOLIO_WIDE_ROLES','teamOf','effectiveNgoIds','myNgoIds','visibleNgos','canEdit','canEditNgo',
  'ngoUserNgoId','ngoOwns','ngoMboRows','ngoTaskRows','ngoOkrMonths','ngoSelMonth'];
const ids = rows => Array.from(rows, r => r.id);

function load(me, extra){
  return loadFns(FNS, Object.assign({ DB, ME: me, TODAY_ISO:'2026-11-03',
    NGO_OKR_MONTH:null, toast(){} }, extra));
}

const f = load(NGO_ME);
assert.strictEqual(f.canEdit(), false, 'an NGO login must not get team edit rights');
assert.strictEqual(f.canEditNgo('n1'), false, 'not even on its own NGO through the team path');
assert.deepStrictEqual(ids(f.visibleNgos()), [], 'an NGO login sees no portfolio pages');

assert.strictEqual(f.ngoOwns('n1'), true,  'owns its own NGO');
assert.strictEqual(f.ngoOwns('n2'), false, 'does not own another NGO');
assert.strictEqual(f.ngoOwns(undefined), false, 'a record with no NGO is not owned');
assert.deepStrictEqual(ids(f.ngoMboRows()), ['k1','k3'], 'sees only its own key results');
assert.deepStrictEqual(ids(f.ngoTaskRows()), ['t1'], 'sees only its own tasks');
assert.strictEqual(f.ngoSelMonth(), '2026-11', 'defaults to the current month when it has key results');

/* ngoOwns is role-locked: a team lead assigned the same NGO does not pass it */
const lead = load({ id:'u_lead', role:'Programme', ngoIds:['n1'] });
assert.strictEqual(lead.ngoOwns('n1'), false, 'ngoOwns is only for NGO logins');
assert.strictEqual(lead.ngoUserNgoId(), null, 'a team login has no NGO-login organisation');

/* an NGO login with nothing assigned sees nothing */
const bare = load({ id:'u_x', role:'NGO', ngoIds:[] });
assert.strictEqual(bare.ngoUserNgoId(), null);
assert.deepStrictEqual(ids(bare.ngoMboRows()), []);
assert.strictEqual(bare.ngoOwns('n1'), false);

console.log('ngo-role: all assertions passed');
