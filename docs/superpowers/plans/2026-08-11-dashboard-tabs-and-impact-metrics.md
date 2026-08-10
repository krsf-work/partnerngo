# Dashboard Tabs + Beneficiaries/Impact-Amount KPIs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Dashboard into Overview/NGOs/Activity tabs to fix "plain, hard to scan, wrong prioritization" feedback, and add two new KPIs — Beneficiaries reached (derived from existing milestone data) and Total impact amount (a new manual per-NGO ₹ field).

**Architecture:** Pure extension of the existing single-file `index.html`. The tab mechanism reuses the exact pattern already live on the NGO-detail page (`NGO_TAB` + `.ngo-tabs`/`.tb` CSS) rather than inventing a new one. The two new KPIs are pure functions consuming existing data (`DB.bigBets`, `DB.ngos`) — no new top-level app state beyond one `impactAmount` field per NGO record and one `DASH_TAB` tab-selector variable.

**Tech Stack:** Vanilla JS, no framework, no build step. No test runner — pure-logic functions verified with throwaway `node` scripts before pasting into `index.html`; UI verified by hand in a live browser preview.

## Global Constraints

- Canonical source file: `D:\Guru\Mirror\CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html` — edit this file, not the git-repo copy.
- Do not touch the shared `.kpi`/`.kpi-grid` CSS classes or the `dailyKpi()` function — they're also used by the Daily Sheet PM roll-up page (`dailyPmPage()`) and must not be affected by this Dashboard-only change. The new Overview summary strip gets its own CSS classes.
- **No live-data testing**: this file connects directly to the production Firebase RTDB with no staging/sandbox mode. Do not click any Save button against it — verification is `node --check`, scratch unit tests, and read-only browser inspection only.
- After all code tasks, the file must still pass `node --check` on its main script block. Use this extraction (checks whichever inline `<script>` block is largest, robust to line-number drift from earlier edits):

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('D:/Guru/Mirror/CRITICAL FILES/Claude Apps/Partnership Dashboard/index.html', 'utf8');
let idx = 0, mainFile = null;
while(true){
  const s = html.indexOf('<script', idx);
  if(s===-1) break;
  const tagEnd = html.indexOf('>', s);
  const isSrc = html.slice(s, tagEnd).includes('src=');
  const scriptStart = tagEnd+1;
  const scriptEnd = html.indexOf('</script>', scriptStart);
  const len = scriptEnd - scriptStart;
  if(!isSrc && len > 100000){
    mainFile = 'C:/Users/HP/AppData/Local/Temp/claude/scratch/main-script-check.js';
    fs.writeFileSync(mainFile, html.slice(scriptStart, scriptEnd));
  }
  idx = scriptEnd + 1;
}
"
node --check "C:\Users\HP\AppData\Local\Temp\claude\scratch\main-script-check.js"
```
- Version bump: this ships as **V63** (current live version is V62, `sahkar-v62` in `sw.js` — several small fixes shipped under the V62 label without a version bump this session; V63 catches the version label up for this larger, user-visible release).

---

### Task 1: `totalBeneficiaries()` and `totalImpactAmount()` helper functions

**Files:**
- Modify: `CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html`, near `visibleBets()` (index.html:2043-2046)
- Test: scratch file `C:\Users\HP\AppData\Local\Temp\claude\scratch\impact-kpi-test.js`

**Interfaces:**
- Consumes: `betCumulative(bet, uptoMonth)`, `lastReportedMonth(bet)` (existing, index.html:2060+/2099+), `DB.ngos` (existing).
- Produces: `totalBeneficiaries(bets)` — number. `totalImpactAmount(ngos)` — number. Both consumed by Task 3's `pageDash()` restructure.

- [ ] **Step 1: Write and run a scratch test**

Create `C:\Users\HP\AppData\Local\Temp\claude\scratch\impact-kpi-test.js`:

```js
const assert = require('assert');

function betCumulative(bet, uptoMonth, FY_MONTHS){
  const months = bet.months || {};
  let sum = bet.baseline||0;
  for(const m of FY_MONTHS){ if(m>uptoMonth)break;
    const c=months[m]; if(c&&c.actual!=null) sum+=c.actual; }
  return sum;
}
function lastReportedMonth(bet, FY_MONTHS){
  const months = (bet && bet.months) || {};
  let last=null;
  for(const m of FY_MONTHS){ if(months[m] && months[m].actual!=null) last=m; }
  return last;
}
const FY_MONTHS = ["2026-04","2026-05","2026-06"];

function totalBeneficiaries(bets){
  return bets
    .filter(b=>b.unit==="beneficiaries")
    .reduce((sum,b)=>{
      const lm = lastReportedMonth(b, FY_MONTHS);
      return sum + (lm ? betCumulative(b, lm, FY_MONTHS) : 0);
    }, 0);
}
function totalImpactAmount(ngos){
  return ngos.reduce((sum,n)=>sum+(n.impactAmount||0), 0);
}

const bets = [
  { unit:"beneficiaries", baseline:0, months:{ "2026-04":{actual:100}, "2026-05":{actual:120} } },
  { unit:"beneficiaries", baseline:0, months:{ "2026-04":{actual:50} } },
  { unit:"beneficiaries", baseline:0, months:{} },                      // no reported months
  { unit:"households", baseline:0, months:{ "2026-04":{actual:9999} } }, // wrong unit, excluded
];
assert.strictEqual(totalBeneficiaries(bets), 270, "100+120 (cumulative) + 50 + 0 = 270, households excluded");
assert.strictEqual(totalBeneficiaries([]), 0, "no bets at all");

const ngos = [ {id:"n1", impactAmount:500000}, {id:"n2", impactAmount:0}, {id:"n3"} ];
assert.strictEqual(totalImpactAmount(ngos), 500000, "500000 + 0 + undefined(=0)");
assert.strictEqual(totalImpactAmount([]), 0, "no NGOs at all");

console.log("All impact-KPI assertions passed");
```

Run: `node "C:\Users\HP\AppData\Local\Temp\claude\scratch\impact-kpi-test.js"`
Expected: `All impact-KPI assertions passed`

- [ ] **Step 2: Add the real functions to index.html**

Find `visibleBets()` (index.html:2043-2046):

```js
function visibleBets(){
  const ids = new Set(visibleNgos().map(n=>n.id));
  return DB.bigBets.filter(b=>ids.has(b.ngoId));
}
```

Immediately after its closing brace, insert:

```js
/* Beneficiaries reached — sums only milestones literally denominated in
   "beneficiaries" (not households/women/students/farmers/etc — a known,
   accepted undercount, not a bug). Reuses the same cumulative-achieved
   logic the app already trusts for milestone progress. */
function totalBeneficiaries(bets){
  return bets
    .filter(b=>b.unit==="beneficiaries")
    .reduce((sum,b)=>{
      const lm = lastReportedMonth(b);
      return sum + (lm ? betCumulative(b, lm) : 0);
    }, 0);
}
/* Total impact amount — a manual per-NGO figure (Admin > Edit partner),
   NOT derived from milestones: only one existing milestone is a true
   cumulative ₹ total, the other ₹-unit milestones are average-income
   *levels* (a rate, not a sum) and can't be added together meaningfully. */
function totalImpactAmount(ngos){
  return ngos.reduce((sum,n)=>sum+(n.impactAmount||0), 0);
}
```

- [ ] **Step 3: Syntax-check**

Run the extraction + check command from Global Constraints. Expected: no output.

- [ ] **Step 4: Commit**

No git commit yet — see Task 5 for the versioned snapshot + push.

---

### Task 2: `impactAmount` field on the NGO edit form

**Files:**
- Modify: `CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html`, functions `openNgoForm` (index.html:3486-3543) and `saveNgo` (index.html:3544+)

**Interfaces:**
- Consumes: `fmtAmtInput(inp)` (existing, index.html:1216), `esc()`, `el()`.
- Produces: `n.impactAmount` (number|undefined) on the NGO record — consumed by Task 1's `totalImpactAmount()`.

- [ ] **Step 1: Add the field to the form body**

Find (index.html, inside `openNgoForm`):

```js
    ${n?`<div style="font-size:11px;color:var(--ink-3)">${editStampLine(n)||''}</div>`:''}`;
  const foot = `
    ${editId?`<button class="btn danger" style="margin-right:auto" onclick="deleteNgo('${editId}')">Delete partner</button>`:''}
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn primary" onclick="saveNgo('${editId||''}')">${editId?'Save changes':'Add partner'}</button>`;
```

Replace with:

```js
    <div class="frow">
      <div class="field">
        <label>Total impact amount (₹) <span style="text-transform:none;font-weight:400">— optional</span></label>
        <input type="text" inputmode="numeric" id="nfImpact" value="${n&&n.impactAmount?(+n.impactAmount).toLocaleString('en-IN'):''}" oninput="fmtAmtInput(this)" placeholder="e.g. 5,00,000">
        <div class="hint">A one-off figure representing this NGO's overall impact so far, entered manually — not derived from milestones.</div>
      </div>
    </div>
    ${n?`<div style="font-size:11px;color:var(--ink-3)">${editStampLine(n)||''}</div>`:''}`;
  const foot = `
    ${editId?`<button class="btn danger" style="margin-right:auto" onclick="deleteNgo('${editId}')">Delete partner</button>`:''}
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn primary" onclick="saveNgo('${editId||''}')">${editId?'Save changes':'Add partner'}</button>`;
```

- [ ] **Step 2: Save the field**

Find (index.html, inside `saveNgo`):

```js
  const fields = {
    name, short,
    vertical: el("nfVertical").value,
    state: el("nfState").value.trim()||"—",
    since: el("nfSince").value,
    lead: el("nfLead").value.trim()||"—",
    partnership: el("nfStatus").value
  };
```

Replace with:

```js
  const fields = {
    name, short,
    vertical: el("nfVertical").value,
    state: el("nfState").value.trim()||"—",
    since: el("nfSince").value,
    lead: el("nfLead").value.trim()||"—",
    partnership: el("nfStatus").value,
    impactAmount: parseFloat(String(el("nfImpact").value||"").replace(/,/g,""))||0
  };
```

- [ ] **Step 3: Syntax-check**

Run the extraction + check command from Global Constraints. Expected: no output.

- [ ] **Step 4: Manual verify in browser**

Log in as PM, open an NGO's edit form (Partner NGOs → a row → "Edit partner"), confirm the new "Total impact amount (₹)" field appears, typing digits auto-formats with commas (via `fmtAmtInput`, already proven elsewhere in this file). Do not click Save (live database — see Global Constraints); confirm rendering only.

- [ ] **Step 5: Commit**

No git commit yet — see Task 5.

---

### Task 3: Dashboard tabs + Overview summary strip

**Files:**
- Modify: `CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html`, function `pageDash` (index.html:2600-2721+) and its CSS

**Interfaces:**
- Consumes: `totalBeneficiaries(bets)`, `totalImpactAmount(ngos)` (Task 1), `dailyHomeWidget()`, `dashNgoRow(n)`, `scorecardPanel(ngos)`, `portfolioActivityStream(ngos,12)` (all existing, unchanged).
- Produces: `DASH_TAB` (module-level state, default `"overview"`) — consumed only within `pageDash()`.

- [ ] **Step 1: Add the `DASH_TAB` state variable**

Find (index.html, immediately before `function pageDash(){`):

```js
function pageDash(){
```

Immediately before it, insert:

```js
let DASH_TAB = "overview";   // overview | ngos | activity
```

- [ ] **Step 2: Add the Overview summary strip CSS**

Find (index.html, the `.kpi-grid` rule, near line 216):

```css
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
```

Immediately after the full `.kpi-grid`/`.kpi`/etc. block (i.e., find the blank line that follows `.kpi.accent,.kpi.green,.kpi.amber,.kpi.blue{border-left:1px solid var(--rule)}` near line 237), insert a new block. Find:

```css
  .kpi.accent,.kpi.green,.kpi.amber,.kpi.blue{border-left:1px solid var(--rule)}
```

Replace with:

```css
  .kpi.accent,.kpi.green,.kpi.amber,.kpi.blue{border-left:1px solid var(--rule)}

  /* V63: Dashboard Overview summary strip — lighter-weight than .kpi-grid,
     used only on the Dashboard's Overview tab. Deliberately separate from
     .kpi/.kpi-grid, which dailyPmPage() also uses — must not affect that page. */
  .ov-summary{display:flex;flex-wrap:wrap;background:var(--card);border:1px solid var(--rule);
              border-radius:13px;overflow:hidden;margin-bottom:14px}
  .ov-stat{flex:1;min-width:150px;padding:12px 14px;border-right:1px solid var(--rule);
           border-bottom:1px solid var(--rule)}
  .ov-stat:last-child{border-right:none}
  .ov-stat .otop{display:flex;align-items:center;gap:7px;margin-bottom:4px}
  .ov-stat .oico{font-size:14px}
  .ov-stat .olab{font-size:10.5px;color:var(--ink-3);font-weight:600}
  .ov-stat .oval{font-family:var(--mono);font-weight:800;font-size:18px;line-height:1.1}
  .ov-stat .osub{font-size:10.5px;color:var(--ink-2);margin-top:2px}
```

- [ ] **Step 3: Replace `pageDash()`'s body**

Find the full current function (index.html:2601-2721+, from `const ngos = visibleNgos();` through the closing of the `scorecardPanel(ngos)` line and the activity panel and final `}`):

```js
  const ngos = visibleNgos();
  const bets = visibleBets();

  /* ---- box 1: partnerships active / passive ---- */
  const active  = ngos.filter(n=>n.partnership==="Active").length;
  const passive = ngos.length - active;

  /* ---- box 2: approved vs utilised budget ---- */
  const totalBudget = ngos.reduce((s,n)=>s+(DB.budgets[n.id]?.totalAnnual||0),0);
  const totalSpent  = ngos.reduce((s,n)=>s+ngoSpendUpto(n.id,CUR_MONTH),0);
  const utilPct = pct(totalSpent,totalBudget);

  /* ---- box 3: goals by % of annual target achieved ----
     Bands are defined purely on progress toward the annual target:
       70%+        → "70% achieved"
       40% to <70% → "40% to <70% achieved"
       below 40%   → "Less than 40% achieved"  */
  const betProgs = bets.map(b=>betProgress(b));
  const betGreen = betProgs.filter(p=>p>=70).length;
  const betAmber = betProgs.filter(p=>p>=40 && p<70).length;
  const betRed   = betProgs.filter(p=>p<40).length;

  /* ---- box 3b: milestone delivery as a single stacked bar ---- */
  const betTot = bets.length;
  const seg = c => betTot ? Math.round(c/betTot*100) : 0;

  /* ---- box 4: partner scorecard by status (Green / Yellow / Red counts) ---- */
  const scores = ngos.map(n=>ngoScore(n.id));
  const scRed   = scores.filter(s=>s.status==="red").length;
  const scAmber = scores.filter(s=>s.status==="amber").length;
  const scGreen = scores.filter(s=>s.status==="green").length;

  return `
  <div class="phead slim">
    <div class="eyebrow">${DB.meta.fyLabel} · ${monthLong(CUR_MONTH)}</div>
    <h1 class="serif">Dashboard</h1>
  </div>

  ${dailyHomeWidget()}

  <div class="kpi-grid">
    <div class="kpi">
      <div class="ktop">
        <div class="ktile blue">🏛️</div>
        <div class="lab">NGO Partnerships</div>
      </div>
      <div class="val">${ngos.length}</div>
      <div class="sub"><b style="color:var(--green)">${active} Active</b> &nbsp;·&nbsp; ${passive} Passive</div>
    </div>

    <div class="kpi">
      <div class="ktop">
        <div class="ktile amber">💰</div>
        <div class="lab">Approved Budget</div>
      </div>
      <div class="val">${fmtRs(totalBudget)}</div>
      <div class="sub">${fmtRs(totalSpent)} utilised &nbsp;·&nbsp; <b>${utilPct}%</b></div>
      <div class="pbar" style="margin-top:7px">
        <i class="${utilPct>=100?'red':utilPct>=85?'amber':'green'}" style="width:${Math.min(utilPct,100)}%"></i>
      </div>
    </div>

    <div class="kpi split">
      <div class="ktop">
        <div class="ktile accent">🎯</div>
        <div class="lab">Milestones — Delivery</div>
      </div>
      ${betTot?`
      <div class="sbar" title="${betGreen} on track · ${betAmber} mid · ${betRed} behind">
        <i class="green" style="width:${seg(betGreen)}%"></i>
        <i class="amber" style="width:${seg(betAmber)}%"></i>
        <i class="red"   style="width:${seg(betRed)}%"></i>
      </div>
      <div class="sbar-leg">
        <span><i class="green"></i><b>${betGreen}</b> on track</span>
        <span><i class="amber"></i><b>${betAmber}</b> 40–70%</span>
        <span><i class="red"></i><b>${betRed}</b> behind</span>
      </div>`:`<div class="sub" style="margin-top:6px">No milestones set yet.</div>`}
    </div>

    <div class="kpi split">
      <div class="ktop">
        <div class="ktile violet">📊</div>
        <div class="lab">Partner Scorecard</div>
      </div>
      <div class="band-row">
        <div class="band green"><div class="bn">${scGreen}</div><div class="bl">Green</div></div>
        <div class="band amber"><div class="bn">${scAmber}</div><div class="bl">Yellow</div></div>
        <div class="band red"><div class="bn">${scRed}</div><div class="bl">Red</div></div>
      </div>
    </div>
  </div>

  <div class="panel" style="margin-bottom:14px">
    <div class="panel-h">
      <h3>Partner NGOs</h3>
      <span class="note">click a row to see its milestones</span>
      <div class="ha"><button class="btn sm" onclick="go('ngos')">All NGOs →</button></div>
    </div>
    <div class="tbl-wrap">
      <table class="ngo-tbl">
        <colgroup>
          <col style="width:22%"><col style="width:18%"><col style="width:21%">
          <col style="width:11%"><col style="width:11%"><col style="width:17%">
        </colgroup>
        <thead><tr>
          <th>NGO</th>
          <th>Partnership Lead</th>
          <th class="num">Approved · Utilised</th>
          <th>Partnership</th>
          <th>Scorecard</th>
          <th>Delivery</th>
        </tr></thead>
        <tbody>
        ${ngos.map(n=>dashNgoRow(n)).join("")}
        </tbody>
      </table>
    </div>
  </div>

  ${scorecardPanel(ngos)}

  <div class="panel" style="margin-top:14px">
    <div class="panel-h">
      <h3>Recent activity across partners</h3>
      <span class="note">latest debit notes, milestone updates &amp; documents</span>
    </div>
    <div class="panel-b">
      ${(()=>{
        const acts = portfolioActivityStream(ngos, 12);
        return acts.length ? acts.map(a=>`
          <div class="act-item" ${a.ngoId?`style="cursor:pointer" onclick="go('ngo','${a.ngoId}')"`:''}>
            <div class="act-ico">${a.icon}</div>
            <div class="act-body">
              <div class="act-top"><span class="act-t">${esc(a.title)}</span><span class="act-d">${esc(a.date)}</span></div>
              <div class="act-s">${esc(a.detail)}</div>
            </div>
          </div>`).join("")
          : `<div class="empty"><div class="mk">◷</div><p>No activity recorded yet.</p></div>`;
      })()}
    </div>
  </div>
  `;
}
```

Replace with:

```js
  const ngos = visibleNgos();
  const bets = visibleBets();

  /* ---- box 1: partnerships active / passive ---- */
  const active  = ngos.filter(n=>n.partnership==="Active").length;
  const passive = ngos.length - active;

  /* ---- box 2: approved vs utilised budget ---- */
  const totalBudget = ngos.reduce((s,n)=>s+(DB.budgets[n.id]?.totalAnnual||0),0);
  const totalSpent  = ngos.reduce((s,n)=>s+ngoSpendUpto(n.id,CUR_MONTH),0);
  const utilPct = pct(totalSpent,totalBudget);

  /* ---- box 3: goals by % of annual target achieved ----
     Bands are defined purely on progress toward the annual target:
       70%+        → "70% achieved"
       40% to <70% → "40% to <70% achieved"
       below 40%   → "Less than 40% achieved"  */
  const betProgs = bets.map(b=>betProgress(b));
  const betGreen = betProgs.filter(p=>p>=70).length;
  const betAmber = betProgs.filter(p=>p>=40 && p<70).length;
  const betRed   = betProgs.filter(p=>p<40).length;

  /* ---- box 3b: milestone delivery as a single stacked bar ---- */
  const betTot = bets.length;
  const seg = c => betTot ? Math.round(c/betTot*100) : 0;

  /* ---- box 4: partner scorecard by status (Green / Yellow / Red counts) ---- */
  const scores = ngos.map(n=>ngoScore(n.id));
  const scRed   = scores.filter(s=>s.status==="red").length;
  const scAmber = scores.filter(s=>s.status==="amber").length;
  const scGreen = scores.filter(s=>s.status==="green").length;

  /* ---- box 5/6 (V63): beneficiaries reached + total impact amount ---- */
  const beneficiaries = totalBeneficiaries(bets);
  const impactAmount = totalImpactAmount(ngos);

  const tabs = [
    {id:"overview", label:"Overview"},
    {id:"ngos",     label:"NGOs"},
    {id:"activity", label:"Activity"}
  ];
  const tabBar = `<div class="ngo-tabs">
    ${tabs.map(t=>`<div class="tb ${DASH_TAB===t.id?'active':''}" onclick="DASH_TAB='${t.id}';render()">${t.label}</div>`).join("")}
  </div>`;

  const overviewBody = `
  ${dailyHomeWidget()}
  <div class="ov-summary">
    <div class="ov-stat">
      <div class="otop"><span class="oico">🏛️</span><span class="olab">NGO Partnerships</span></div>
      <div class="oval">${ngos.length}</div>
      <div class="osub">${active} Active · ${passive} Passive</div>
    </div>
    <div class="ov-stat">
      <div class="otop"><span class="oico">💰</span><span class="olab">Approved Budget</span></div>
      <div class="oval">${fmtRs(totalBudget)}</div>
      <div class="osub">${fmtRs(totalSpent)} utilised · ${utilPct}%</div>
    </div>
    <div class="ov-stat">
      <div class="otop"><span class="oico">🎯</span><span class="olab">Milestones — Delivery</span></div>
      <div class="oval">${betTot?betGreen+"/"+betTot:"—"}</div>
      <div class="osub">${betTot?"on track":"no milestones set yet"}</div>
    </div>
    <div class="ov-stat">
      <div class="otop"><span class="oico">📊</span><span class="olab">Partner Scorecard</span></div>
      <div class="oval">${scGreen}/${ngos.length||1}</div>
      <div class="osub">green · ${scAmber} yellow · ${scRed} red</div>
    </div>
    <div class="ov-stat">
      <div class="otop"><span class="oico">🙌</span><span class="olab">Beneficiaries reached</span></div>
      <div class="oval">${beneficiaries.toLocaleString('en-IN')}</div>
      <div class="osub">cumulative, this FY</div>
    </div>
    <div class="ov-stat">
      <div class="otop"><span class="oico">✨</span><span class="olab">Total impact amount</span></div>
      <div class="oval">${fmtRs(impactAmount)}</div>
      <div class="osub">manually recorded per NGO</div>
    </div>
  </div>`;

  const ngosBody = `
  <div class="panel" style="margin-bottom:14px">
    <div class="panel-h">
      <h3>Partner NGOs</h3>
      <span class="note">click a row to see its milestones</span>
      <div class="ha"><button class="btn sm" onclick="go('ngos')">All NGOs →</button></div>
    </div>
    <div class="tbl-wrap">
      <table class="ngo-tbl">
        <colgroup>
          <col style="width:22%"><col style="width:18%"><col style="width:21%">
          <col style="width:11%"><col style="width:11%"><col style="width:17%">
        </colgroup>
        <thead><tr>
          <th>NGO</th>
          <th>Partnership Lead</th>
          <th class="num">Approved · Utilised</th>
          <th>Partnership</th>
          <th>Scorecard</th>
          <th>Delivery</th>
        </tr></thead>
        <tbody>
        ${ngos.map(n=>dashNgoRow(n)).join("")}
        </tbody>
      </table>
    </div>
  </div>
  ${scorecardPanel(ngos)}`;

  const activityBody = `
  <div class="panel">
    <div class="panel-h">
      <h3>Recent activity across partners</h3>
      <span class="note">latest debit notes, milestone updates &amp; documents</span>
    </div>
    <div class="panel-b">
      ${(()=>{
        const acts = portfolioActivityStream(ngos, 12);
        return acts.length ? acts.map(a=>`
          <div class="act-item" ${a.ngoId?`style="cursor:pointer" onclick="go('ngo','${a.ngoId}')"`:''}>
            <div class="act-ico">${a.icon}</div>
            <div class="act-body">
              <div class="act-top"><span class="act-t">${esc(a.title)}</span><span class="act-d">${esc(a.date)}</span></div>
              <div class="act-s">${esc(a.detail)}</div>
            </div>
          </div>`).join("")
          : `<div class="empty"><div class="mk">◷</div><p>No activity recorded yet.</p></div>`;
      })()}
    </div>
  </div>`;

  const body = DASH_TAB==="ngos" ? ngosBody : DASH_TAB==="activity" ? activityBody : overviewBody;

  return `
  <div class="phead slim">
    <div class="eyebrow">${DB.meta.fyLabel} · ${monthLong(CUR_MONTH)}</div>
    <h1 class="serif">Dashboard</h1>
  </div>

  ${tabBar}
  ${body}
  `;
}
```

- [ ] **Step 4: Syntax-check**

Run the extraction + check command from Global Constraints. Expected: no output.

- [ ] **Step 5: Manual verify in browser**

Confirm the login page still loads (no runtime crash on script parse). Since interactive testing behind login isn't possible against the live database (see Global Constraints), this step is a read-only smoke check — full behind-login verification (tab switching, all three tabs' content, the two new KPI numbers, responsive behavior at 375px) should be done by Munjal after deploy, same as prior releases this session.

- [ ] **Step 6: Commit**

No git commit yet — see Task 5.

---

### Task 4: (intentionally removed — folded into Task 3)

---

### Task 5: Version bump, snapshot, and deploy

**Files:**
- Modify: `CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html` (`<title>` line 6, sidebar brand version line, login subtitle version line — three spots, per the pattern discovered earlier this session)
- Modify: `CRITICAL FILES\Claude Apps\Partnership Dashboard\sw.js` (`CACHE` constant, line 3)
- Create: `CRITICAL FILES\Claude Apps\Partnership Dashboard\Partnership Dashboard V63.html` (versioned snapshot)
- Copy: `index.html` and `sw.js` into `D:\Guru\Mirror\01_KRSF\github\partnerngo\`

- [ ] **Step 1: Bump all three V62→V63 text spots**

Find and replace each (there are three literal `V62` text occurrences in user-visible strings — confirm count with `grep -n "V62" "D:\Guru\Mirror\CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html"` before editing, since this session already fixed a similarly-missed spot once before):

```html
<title>Sahkar · KRSF Partnership Program · V62</title>
```
→
```html
<title>Sahkar · KRSF Partnership Program · V63</title>
```

```html
<div class="tg">KRSF Partnership Program <span style="opacity:.6">· V62</span></div>
```
→
```html
<div class="tg">KRSF Partnership Program <span style="opacity:.6">· V63</span></div>
```

```html
<div class="sub">Milestones, Budget and Monthly Delivery <span style="opacity:.5">· V62</span></div>
```
→
```html
<div class="sub">Milestones, Budget and Monthly Delivery <span style="opacity:.5">· V63</span></div>
```

- [ ] **Step 2: Bump the service worker cache**

Find (line 3 of `sw.js`):
```js
const CACHE = 'sahkar-v62';
```
Replace with:
```js
const CACHE = 'sahkar-v63';
```

- [ ] **Step 3: Full syntax-check**

Run the extraction + check command from Global Constraints for `index.html`.
Run: `node --check "D:\Guru\Mirror\CRITICAL FILES\Claude Apps\Partnership Dashboard\sw.js"`
Expected: no output from either.

- [ ] **Step 4: Regression grep**

```bash
grep -n "V62" "D:\Guru\Mirror\CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html"
```
Expected: no matches (confirms all three spots caught).

- [ ] **Step 5: Create the versioned snapshot**

Copy the final `index.html` to `CRITICAL FILES\Claude Apps\Partnership Dashboard\Partnership Dashboard V63.html` (exact copy, no edits).

- [ ] **Step 6: Sync into the git repo folder**

Copy `CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html` and `sw.js` over the corresponding files in `D:\Guru\Mirror\01_KRSF\github\partnerngo\`, overwriting them.

- [ ] **Step 7: Commit**

```bash
cd "D:\Guru\Mirror\01_KRSF\github\partnerngo"
git status
git add index.html sw.js
git commit -m "V63 — Dashboard tabs (Overview/NGOs/Activity) + Beneficiaries/Impact-amount KPIs

Splits the Dashboard into three tabs to address plain/hard-to-scan/wrong-
prioritization feedback: Overview (today's log widget + a compact 6-tile
summary), NGOs (table + scorecard), Activity (recent activity feed).
Adds two new Overview metrics: Beneficiaries reached (derived from
existing beneficiaries-unit milestones) and Total impact amount (a new
manual per-NGO rupee field, entered via Edit partner, since milestone
data can't support a real cross-portfolio total today)."
```

(Push is a separate, explicitly-confirmed step per this session's established practice — do not push automatically as part of this task.)

- [ ] **Step 8: Confirm live (after push is separately authorized)**

Poll the live GitHub Pages URL until the served page's `<title>` shows "V63" and `sw.js` shows `sahkar-v63`.

---

## Self-Review Notes

- **Spec coverage**: Part 1 (Dashboard tabs) → Task 3. Part 2 (Beneficiaries KPI) → Task 1 + Task 3's Overview strip. Part 3 (Impact amount + NGO field) → Task 1 + Task 2 + Task 3's Overview strip. Version bump/deploy → Task 5.
- **No placeholders**: every step shows complete before/after code.
- **Type/name consistency**: `totalBeneficiaries(bets)` and `totalImpactAmount(ngos)` (Task 1) are called with exactly those argument shapes in Task 3's `pageDash()` (`bets` and `ngos`, both already in scope at that point in the function). `n.impactAmount` (Task 2's save field) matches `totalImpactAmount`'s `n.impactAmount||0` read exactly.
- **Shared-CSS risk called out explicitly**: Task 3 Step 2 adds `.ov-summary`/`.ov-stat` as new, separate classes rather than touching `.kpi`/`.kpi-grid`, because `dailyPmPage()` (Daily Sheet PM roll-up) also renders `.kpi` elements via `dailyKpi()` and must not be affected.
- **Live-data safety**: called out in Global Constraints and Task 3 Step 5 — no Save-button testing against production; full behind-login check deferred to Munjal after deploy, matching this session's established pattern.
