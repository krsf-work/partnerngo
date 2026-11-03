const assert = require('assert');
const { loadFns } = require('./harness');

/* V74: Home lists every open deadline that belongs to the signed-in person.
   A wrong bucket hides something overdue; a wrong scope shows someone else's
   work, or lets them change it. */
const DATE_FNS = ['TM_MONTHS','tmIsoOf','tmSerialToIso','tmWeekOfMonth','tmParseDate'];
const V4_FNS = ['V4_KIND','v4DaysTo','v4MonthEnd','v4PrevMonth','v4KrDue','v4Bucket','v4DueLabel','v4Count',
  'v4IsTeam','v4MyNgos','v4Deadlines','v4SetMy','v4SetKr','v4ToggleTask','v4SaveAction',
  'PORTFOLIO_WIDE_ROLES','teamOf','effectiveNgoIds','myNgoIds','visibleNgos','canEditNgo','ngoById','monthLabel','MONTH_NAMES',
  'tmReplaceMonths'];
const ids = rows => Array.from(rows, r => r.id);

function world(me){
  const DB = {
    ngos:  [{ id:'n1', short:'SeSTA' }, { id:'n2', short:'VNCS' }, { id:'n3', short:'Other' }],
    users: [{ id:'u1', role:'Programme', name:'Lead One', ngoIds:['n1'] },
            { id:'u2', role:'Programme', name:'Lead Two', ngoIds:['n2'], reportsTo:'u1' },
            { id:'pm', role:'PM', name:'PM' }],
    teamMbo: [
      { id:'my-late',  ownerId:'u1', type:'kr',     month:'2026-11', status:'',         deadline:'2026-11-01', title:'late' },
      { id:'my-today', ownerId:'u1', type:'action', month:'2026-11', status:'In Progress', deadline:'2026-11-03', title:'today' },
      { id:'my-done',  ownerId:'u1', type:'kr',     month:'2026-11', status:'Done',     deadline:'2026-11-02', title:'done' },
      { id:'my-old',   ownerId:'u1', type:'kr',     month:'2026-08', status:'Not Done', deadline:'2026-08-15', title:'old' },
      { id:'my-nodate',ownerId:'u1', type:'kr',     month:'2026-11', status:'',         deadline:'',           title:'nodate' },
      { id:'theirs',   ownerId:'u2', type:'kr',     month:'2026-11', status:'',         deadline:'2026-11-04', title:'theirs' }
    ],
    tasks: [
      { id:'t-mine',  ngoId:'n1', status:'Open', due:'2026-11-09', title:'mine' },
      { id:'t-team',  ngoId:'n2', status:'Open', due:'2026-11-05', title:'team ngo' },
      { id:'t-done',  ngoId:'n1', status:'Done', due:'2026-11-01', title:'done' }
    ],
    mbo: [
      { id:'k-timeline', ngoId:'n1', month:'2026-11', status:'Pending', timeline:'6/11/2026', kr:'with date' },
      { id:'k-monthend', ngoId:'n1', month:'2026-11', status:'',        timeline:'',          kr:'no date' },
      { id:'k-stale',    ngoId:'n1', month:'2026-06', status:'Pending', timeline:'',          kr:'old month' },
      { id:'k-other',    ngoId:'n3', month:'2026-11', status:'Pending', timeline:'',          kr:'not mine' }
    ]
  };
  let saved = 0;
  const F = loadFns(DATE_FNS.concat(V4_FNS), {
    DB, ME: me, TODAY_ISO:'2026-11-03', TODAY_MONTH:'2026-11',
    shortDate: s => s, stampEdit: r => r, toast: () => {}, render: () => {},
    v4CloseSheet: () => {}, v4Rerender: () => {}, go: () => {},
    saveDB: async () => { saved++; return true; },
    genId: p => p + '_x', el: () => ({ value:'' }), V4: {}
  });
  return { F, DB, saves: () => saved };
}

/* ---- buckets ---- */
{
  const { F } = world({ id:'u1', role:'Programme', name:'Lead One', ngoIds:['n1'] });
  assert.strictEqual(F.v4Bucket('2026-11-02'), 'late');
  assert.strictEqual(F.v4Bucket('2026-11-03'), 'today');
  assert.strictEqual(F.v4Bucket('2026-11-10'), 'week', 'exactly 7 days out is this week');
  assert.strictEqual(F.v4Bucket('2026-11-11'), 'later');
  assert.strictEqual(F.v4Bucket('2026-10-04'), 'late', '30 days late is still overdue');
  assert.strictEqual(F.v4Bucket('2026-10-03'), 'old', 'over 30 days late is "older, still open"');
  assert.strictEqual(F.v4Bucket(''), 'none');
  assert.strictEqual(F.v4DueLabel('2026-11-02'), '1 day late');
  assert.strictEqual(F.v4DueLabel('2026-11-04'), 'Due tomorrow');

  /* an NGO key result is due on its timeline, else at the end of its month */
  assert.strictEqual(F.v4KrDue({ month:'2026-11', timeline:'6/11/2026' }), '2026-11-06', 'timeline is day-first');
  assert.strictEqual(F.v4KrDue({ month:'2026-11', timeline:'' }), '2026-11-30');
  assert.strictEqual(F.v4KrDue({ month:'2026-02', timeline:'soon' }), '2026-02-28', 'unreadable timeline falls back to month end');
  assert.strictEqual(F.v4MonthEnd('2028-02'), '2028-02-29');
  assert.strictEqual(F.v4PrevMonth('2027-01'), '2026-12');
}

/* ---- what lands on a Partnership Lead's Home ---- */
{
  const { F } = world({ id:'u1', role:'Programme', name:'Lead One', ngoIds:['n1'] });
  const list = F.v4Deadlines();
  assert.deepStrictEqual(ids(list).sort(),
    ['k-monthend','k-timeline','my-late','my-old','my-today','t-mine'].sort(),
    'own open dated rows + own NGOs only; not done rows, not undated, not the team member\'s, not a team NGO, not a stale KR month');
  const by = {}; list.forEach(x => by[x.id] = x.bucket);
  assert.strictEqual(by['my-late'], 'late');
  assert.strictEqual(by['my-today'], 'today');
  assert.strictEqual(by['my-old'], 'old');
  assert.strictEqual(by['k-timeline'], 'week');
  assert.strictEqual(by['k-monthend'], 'later');
  const c = F.v4Count(list);
  assert.strictEqual(c.late + c.today, 2, 'the bell shows overdue + due today');
  assert.ok(list.every((x, i) => i === 0 || list[i-1].due <= x.due), 'sorted by due date');
}

/* ---- the PM sees every NGO's actions ---- */
{
  const { F } = world({ id:'pm', role:'PM', name:'PM' });
  const got = ids(F.v4Deadlines());
  assert.ok(got.includes('t-team') && got.includes('k-other'), 'PM: all NGOs');
  assert.ok(!got.includes('my-late'), 'PM does not get a team member\'s own OKRs on Home');
}

/* ---- ownership on the write paths ---- */
(async () => {
  {
    const w = world({ id:'u1', role:'Programme', name:'Lead One', ngoIds:['n1'] });
    await w.F.v4SetMy('theirs', 'Done');
    assert.strictEqual(w.DB.teamMbo.find(r=>r.id==='theirs').status, '', 'a manager cannot change a team member\'s OKR');
    await w.F.v4SetMy('my-late', 'Done');
    assert.strictEqual(w.DB.teamMbo.find(r=>r.id==='my-late').status, 'Done', 'own OKR updates');
    await w.F.v4ToggleTask('t-team');
    assert.strictEqual(w.DB.tasks.find(t=>t.id==='t-team').status, 'Open', 'cannot tick off a team NGO\'s action');
    await w.F.v4ToggleTask('t-mine');
    assert.strictEqual(w.DB.tasks.find(t=>t.id==='t-mine').status, 'Done');
    await w.F.v4SetKr('k-other', 'Done');
    assert.strictEqual(w.DB.mbo.find(r=>r.id==='k-other').status, 'Pending', 'cannot change another NGO\'s KR');
    await w.F.v4SetKr('k-timeline', 'Done');
    assert.strictEqual(w.DB.mbo.find(r=>r.id==='k-timeline').status, 'Done');
    assert.strictEqual(w.saves(), 3, 'only the allowed changes were saved');
  }
  {
    const w = world({ id:'pm', role:'PM', name:'PM' });
    await w.F.v4SetMy('theirs', 'Done');
    assert.strictEqual(w.DB.teamMbo.find(r=>r.id==='theirs').status, 'Done', 'the PM can correct anyone\'s OKR');
  }
  {
    const w = world({ id:'n', role:'NGO', name:'SeSTA', ngoIds:['n1'] });
    await w.F.v4SaveAction();
    await w.F.v4SetMy('my-late', 'Done');
    assert.strictEqual(w.saves(), 0, 'an NGO login cannot write team OKRs');
  }

  /* ---- a Team MBO re-import keeps action items added in the app ---- */
  {
    const { F } = world({ id:'u1', role:'Programme' });
    const existing = [
      { id:'a', ownerId:'u1', month:'2026-11' },
      { id:'b', ownerId:'u1', month:'2026-11', source:'app' },
      { id:'c', ownerId:'u2', month:'2026-11' }
    ];
    const out = F.tmReplaceMonths(existing, 'u1', ['2026-11'], [{ id:'new', ownerId:'u1', month:'2026-11' }]);
    assert.deepStrictEqual(ids(out), ['b','c','new']);
  }
  console.log('v74-home: all assertions passed');
})().catch(e => { console.error(e); process.exit(1); });
