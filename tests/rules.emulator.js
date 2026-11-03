/* Proves database.rules.json against the Firebase emulator.
   Run from the repo root:
     firebase emulators:exec --project demo-sahkar --only database,auth "node tests/rules.emulator.js"
   (needs Java; uses the ports in firebase.json). Not part of the plain
   `node tests/*.test.js` run because it needs the emulator. */
const assert = require('assert');
const NS = 'demo-sahkar-default-rtdb';
const DBH = 'http://127.0.0.1:' + (process.env.RTDB_PORT || 9411);
const AUTH = 'http://127.0.0.1:' + (process.env.AUTH_PORT || 9412);
const url = (p, tok) => `${DBH}/${p}.json?ns=${NS}` + (tok ? `&auth=${tok}` : '');

async function admin(method, p, body){
  const r = await fetch(url(p), { method, headers:{ Authorization:'Bearer owner' },
    body: body===undefined ? undefined : JSON.stringify(body) });
  if(!r.ok) throw new Error('admin '+method+' '+p+' '+r.status+' '+await r.text());
  return r.json();
}
async function as(tok, method, p, body){
  const r = await fetch(url(p, tok), { method, body: body===undefined ? undefined : (typeof body==='string' ? body : JSON.stringify(body)) });
  return r.status;
}
async function signUp(email){
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ email, password:'secret123', returnSecureToken:true }) });
  const j = await r.json();
  return { uid:j.localId, tok:j.idToken };
}

(async ()=>{
  const pm = await signUp('pm@x.test'), lead = await signUp('lead@x.test'),
        ngo1 = await signUp('ngo1@x.test'), ngo2 = await signUp('ngo2@x.test'),
        nobody = await signUp('nobody@x.test');
  await admin('PUT', '', {
    tracker: { users:[{ id:'pm', role:'PM' }], ngos:[{ id:'n1' }, { id:'n2' }], debits:[{ id:'d1', amount:5 }] },
    ngoData: {
      n1: { profile:{ id:'n1', short:'One' },
            mbo:{ k1:{ id:'k1', ngoId:'n1', kr:'x', status:'Pending' } },
            tasks:{ t1:{ id:'t1', ngoId:'n1', title:'t', status:'Open' } } },
      n2: { profile:{ id:'n2', short:'Two' }, mbo:{ k2:{ id:'k2', ngoId:'n2', kr:'y', status:'Pending' } } }
    },
    roles: {
      [pm.uid]:   { team:true,  role:'PM',        userId:'pm' },
      [lead.uid]: { team:true,  role:'Programme', userId:'l' },
      [ngo1.uid]: { team:false, role:'NGO', ngoId:'n1', userId:'u1' },
      [ngo2.uid]: { team:false, role:'NGO', ngoId:'n2', userId:'u2' }
    },
    logins: { sesta:'ngo1@x.test', admin:'pm@x.test' }
  });
  let n = 0;
  const R = (name, got, want) => { assert.strictEqual(got, want, `${name}: got ${got}, want ${want}`); n++; };

  // strangers
  R('anonymous cannot read root',                  await as(null,'GET',''), 401);
  R('anonymous cannot read tracker',               await as(null,'GET','tracker'), 401);
  R('anonymous cannot read ngoData',               await as(null,'GET','ngoData/n1'), 401);
  R('anonymous cannot list logins',                await as(null,'GET','logins'), 401);
  R('anonymous CAN look up one username',          await as(null,'GET','logins/sesta'), 200);
  R('anonymous cannot write a login',              await as(null,'PUT','logins/evil','"a@b.c"'), 401);
  R('signed in, no role: no tracker',              await as(nobody.tok,'GET','tracker'), 401);
  R('signed in, no role: cannot grant itself',     await as(nobody.tok,'PUT','roles/'+nobody.uid,{ team:true, role:'PM' }), 401);

  // team
  R('lead reads tracker',                          await as(lead.tok,'GET','tracker'), 200);
  R('lead writes tracker',                         await as(lead.tok,'PUT','tracker/debits/0/amount','7'), 200);
  R('lead reads all ngoData',                      await as(lead.tok,'GET','ngoData'), 200);
  R('lead writes a new OKR row',                   await as(lead.tok,'PUT','ngoData/n2/mbo/k9',{ id:'k9', ngoId:'n2', status:'Pending' }), 200);
  R('lead cannot read roles',                      await as(lead.tok,'GET','roles'), 401);
  R('lead cannot make itself PM',                  await as(lead.tok,'PUT','roles/'+lead.uid+'/role','"PM"'), 401);
  R('lead cannot change logins',                   await as(lead.tok,'PUT','logins/sesta','"lead@x.test"'), 401);
  R('lead reads its own role',                     await as(lead.tok,'GET','roles/'+lead.uid), 200);

  // PM
  R('PM reads roles',                              await as(pm.tok,'GET','roles'), 200);
  R('PM grants a role',                            await as(pm.tok,'PUT','roles/'+nobody.uid,{ team:false, role:'NGO', ngoId:'n2', userId:'u3' }), 200);
  R('PM writes a login',                           await as(pm.tok,'PUT','logins/new','"nobody@x.test"'), 200);
  R('PM multi-path provisioning update',           await as(pm.tok,'PATCH','',{ ['roles/'+nobody.uid]:null, 'logins/new':null }), 200);

  // NGO login
  R('NGO reads its own slice',                     await as(ngo1.tok,'GET','ngoData/n1'), 200);
  R('NGO cannot read another NGO',                 await as(ngo1.tok,'GET','ngoData/n2'), 401);
  R('NGO cannot read all ngoData',                 await as(ngo1.tok,'GET','ngoData'), 401);
  R('NGO cannot read tracker',                     await as(ngo1.tok,'GET','tracker'), 401);
  R('NGO cannot read tracker/users',               await as(ngo1.tok,'GET','tracker/users'), 401);
  R('NGO cannot read roles',                       await as(ngo1.tok,'GET','roles'), 401);
  R('NGO reads its own role',                      await as(ngo1.tok,'GET','roles/'+ngo1.uid), 200);
  R('NGO sets status on own KR',                   await as(ngo1.tok,'PUT','ngoData/n1/mbo/k1/status','"Done"'), 200);
  R('NGO sets comment on own KR',                  await as(ngo1.tok,'PUT','ngoData/n1/mbo/k1/comment','"42 onboarded"'), 200);
  R('NGO multi-path field update (app save)',      await as(ngo1.tok,'PATCH','',{ 'ngoData/n1/mbo/k1/editedBy':'One', 'ngoData/n1/mbo/k1/editedAt':'2026-11-03',
                                                         'ngoData/n1/tasks/t1/status':'Done', 'ngoData/n1/tasks/t1/doneBy':'One' }), 200);
  R('NGO clears doneBy',                           await as(ngo1.tok,'DELETE','ngoData/n1/tasks/t1/doneBy'), 200);
  R('NGO cannot set a bogus status',               await as(ngo1.tok,'PUT','ngoData/n1/mbo/k1/status','"Approved"'), 401);
  R('NGO cannot rewrite the KR text',              await as(ngo1.tok,'PUT','ngoData/n1/mbo/k1/kr','"changed"'), 401);
  R('NGO cannot replace a whole row',              await as(ngo1.tok,'PUT','ngoData/n1/mbo/k1',{ id:'k1', status:'Done' }), 401);
  R('NGO cannot delete a row',                     await as(ngo1.tok,'DELETE','ngoData/n1/mbo/k1'), 401);
  R('NGO cannot create a row',                     await as(ngo1.tok,'PUT','ngoData/n1/mbo/kNEW/status','"Done"'), 401);
  R('NGO cannot touch another NGO',                await as(ngo1.tok,'PUT','ngoData/n2/mbo/k2/status','"Done"'), 401);
  R('NGO cannot edit its profile',                 await as(ngo1.tok,'PUT','ngoData/n1/profile/short','"X"'), 401);
  R('NGO cannot make itself team',                 await as(ngo1.tok,'PUT','roles/'+ngo1.uid+'/team','true'), 401);
  R('NGO comment length capped',                   await as(ngo1.tok,'PUT','ngoData/n1/mbo/k1/comment', JSON.stringify('x'.repeat(2001))), 401);

  const k1 = await admin('GET','ngoData/n1/mbo/k1');
  assert.strictEqual(k1.status, 'Done');
  assert.strictEqual(k1.kr, 'x');
  assert.strictEqual(k1.comment, '42 onboarded');
  console.log(`rules: all ${n} assertions passed`);
})().catch(e=>{ console.error('FAIL', e.message || e); process.exit(1); });
