const assert = require('assert');
const { loadFns } = require('./harness');

/* The Dashboard rail sits beside the Partner NGOs table. It is NOT governed by
   the Team MBO page's filter — it always shows current urgency. It needs no
   month window either: "overdue" already excludes anything more than a month
   late, and "coming up" is by definition ahead of today. */

const stubs = rows => ({
  TODAY_ISO: '2026-08-19',
  esc: s => String(s==null?"":s),
  visibleTeamMbo: () => rows,
  tmBucket: (r, today) => {
    if(r.status === 'Done') return 'done';
    if(!r.deadline) return 'undated';
    const late = Math.round((new Date(today) - new Date(r.deadline))/86400000);
    if(late > 30) return 'stale';
    if(late > 0) return 'overdue';
    if(late >= -6) return 'week';
    if(late >= -27) return 'soon';
    return 'later';
  },
  tmDaysLate: (r, today) => r.deadline
    ? Math.round((new Date(today) - new Date(r.deadline))/86400000) : 0,
  tmOwnerName: id => ({u1:'Lead One', u2:'Lead Two'})[id] || '?',
  tmInitials:  id => ({u1:'LO', u2:'LT'})[id] || '?',
  tmDateLabel: r => r.deadline ? r.deadline.slice(8) + ' Aug' : '—'
});

const ROWS = [
  { id:'o1', ownerId:'u1', type:'kr',     title:'Plug nursery',        deadline:'2026-08-15', status:'Not Done' },
  { id:'o2', ownerId:'u1', type:'kr',     title:'Scale-up plan',       deadline:'2026-08-10', status:'In Progress' },
  { id:'o3', ownerId:'u2', type:'action', title:'Verification list',   deadline:'2026-08-01', status:'' },
  { id:'u1', ownerId:'u1', type:'kr',     title:'Haat operations',     deadline:'2026-08-31', status:'In Progress' },
  { id:'u2', ownerId:'u2', type:'action', title:'Baseline data',       deadline:'2026-08-25', status:'' },
  { id:'st', ownerId:'u1', type:'kr',     title:'Ancient backlog item',deadline:'2025-09-01', status:'Not Done' },
  { id:'dn', ownerId:'u1', type:'kr',     title:'Already finished',    deadline:'2026-08-02', status:'Done' },
  { id:'nd', ownerId:'u1', type:'kr',     title:'No deadline at all',  deadline:'',           status:'' }
];

const F = loadFns(['tmDashRail','tmOverdueCount'], stubs(ROWS));
const html = F.tmDashRail();

/* ---- what belongs in it ---- */
assert.ok(html.includes('Plug nursery'), 'overdue key result appears');
assert.ok(html.includes('Verification list'), 'overdue action item appears');
assert.ok(html.includes('Haat operations'), 'upcoming key result appears');
assert.ok(html.includes('Baseline data'), 'upcoming action item appears');

/* ---- what must NOT ---- */
assert.ok(!html.includes('Ancient backlog item'),
  'anything over a month late belongs on the page, not in the rail');
assert.ok(!html.includes('Already finished'), 'a finished item is never shown');
assert.ok(!html.includes('No deadline at all'), 'an undated item has no urgency to show');

/* ---- ordering ---- */
assert.ok(html.indexOf('Verification list') < html.indexOf('Scale-up plan'),
  'most overdue first (18d before 9d)');
assert.ok(html.indexOf('Scale-up plan') < html.indexOf('Plug nursery'),
  '9d before 4d');
assert.ok(html.indexOf('Plug nursery') < html.indexOf('Baseline data'),
  'the whole overdue group precedes the upcoming group');
assert.ok(html.indexOf('Baseline data') < html.indexOf('Haat operations'),
  'soonest upcoming first (25 Aug before 31 Aug)');

/* ---- both kinds are labelled so they can be told apart ---- */
assert.ok(/Key result/.test(html) && /Action/.test(html),
  'key results and action items are tagged');

/* ---- counts in the headings ---- */
assert.ok(/Overdue[^<]*3|3[^<]*overdue/i.test(html.replace(/<[^>]+>/g,' ')),
  'the overdue heading carries its count');
assert.strictEqual(F.tmOverdueCount(), 3);

/* ---- nothing pressing, but data exists: reassure rather than go blank ---- */
const calm = loadFns(['tmDashRail'], stubs([
  { id:'x', ownerId:'u1', type:'kr', title:'Way off', deadline:'2027-01-01', status:'Not Done' }
])).tmDashRail();
assert.notStrictEqual(calm, '', 'the rail still renders when there is data');
assert.ok(/nothing overdue/i.test(calm.replace(/<[^>]+>/g,' ')),
  'it says nothing is overdue rather than showing an empty box');

/* ---- no data at all: render nothing, so no empty column appears ---- */
assert.strictEqual(loadFns(['tmDashRail'], stubs([])).tmDashRail(), '',
  'with no MBO uploaded the rail does not occupy space');

/* ---- long lists are capped and say so ---- */
const many = [];
for(let i = 0; i < 12; i++){
  many.push({ id:'m'+i, ownerId:'u1', type:'kr', title:'Overdue item '+i,
              deadline:'2026-08-1'+(i%10), status:'Not Done' });
}
const capped = loadFns(['tmDashRail'], stubs(many)).tmDashRail();
const shown = (capped.match(/Overdue item /g)||[]).length;
assert.ok(shown < 12, 'the rail does not list all twelve');
assert.ok(/more/.test(capped), 'and says how many it left out');

console.log('rail: all assertions passed');
