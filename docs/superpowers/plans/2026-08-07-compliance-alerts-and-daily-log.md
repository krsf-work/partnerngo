# Compliance Alerts + Daily Sheet Hourly Revert + Top-Bar Declutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Undo the 3-block Daily Sheet redesign built earlier today (never deployed) back to the original hourly grid, add a Dashboard home-screen quick-log widget using that same hourly grid in a scrollable box, simplify the enforcement nudges to a binary "logged today or not," and declutter the app's global top bar (drop the redundant page-name crumb, relocate the reporting-month picker into the sidebar).

**Architecture:** This is a revision plan. Tasks 1-3 of the original 2026-08-07 plan (compliance document alerts: 90→120 day threshold, `needsYouStrip` card, `docs` nav badge) are already implemented, syntax-checked, and **unchanged by this revision** — they are not touched again here. This plan's tasks operate on the same single-file `index.html`, undoing the block-shaped Daily Sheet code from earlier today and adding the new hourly-widget + top-bar work.

**Tech Stack:** Vanilla JS, no framework, no build step. No test runner — pure-logic functions verified with throwaway `node` scripts before pasting into `index.html`; UI verified by hand in a live browser preview (with the standing constraint that this file talks directly to the production Firebase database — no clicking "Save" against it during testing; verification is code-reading + `node --check` + visual-only browser inspection).

## Global Constraints

- Canonical source file: `D:\Guru\Mirror\CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html` — edit this file, not the git-repo copy.
- **No data loss**: no `blocks`-shaped `dailyLogs` record has ever been saved (nothing was deployed), so removing the block-related code is a clean deletion, not a migration. Existing legacy `hours`-shaped records are untouched throughout.
- Every new UI string uses the existing helpers already used throughout the file: `esc()`, `el()`, `hourLabel()`, `TODAY_ISO`, `genId()`, `saveDB()`, `render()`, `toast()`.
- After all code tasks, the file must still pass `node --check` on its main script block.
- Version bump: this still ships as **V62** (current live version is V61, `sahkar-v61` in `sw.js`) — the version number doesn't change again just because the design changed mid-session.
- **No live-data testing**: this file connects directly to the production Firebase RTDB with no staging/sandbox mode. Do not click any Save/Comment button against it. Verification is via `node --check`, scratch unit tests, and read-only browser inspection (page loads, renders, no console errors) only.

---

### Task 1: Revert Daily Sheet to hourly-only — remove all block-shaped code

**Files:**
- Modify: `CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html`, Daily Sheet section

**Interfaces:**
- Produces: `dailyFilled(rec)` reverts to its original one-line form (`Object.keys(rec.hours||{}).length`). `dailyFormat`, `dailyApproxHours`, `dailyBadgeLabel`, `DAILY_BLOCKS`, `dailyBlocksSection`, `dailySaveDayBlocks` are all removed — nothing later in this plan or the rest of the app references them again.

- [ ] **Step 1: Restore the DB.dailyLogs shape comment**

Find:

```
/* =================================================================
   PAGE · DAILY SHEET  (V46, redesigned V62)
   Team members (APLs) log daily work; the PM sees a roll-up and can
   comment. Data: DB.dailyLogs — one record per person-day, one of two
   shapes depending on when it was saved:
     legacy (pre-V62): { id, aplId, date, hours:{ "7":{for,detail}, … "21":{…} }, comments:[], … }
     current (V62+):   { id, aplId, date, blocks:{ morning, afternoon, evening }, comments:[], … }
   Legacy records are NEVER rewritten into the new shape — dailyFormat()
   decides which shape a given record is in, and dailyFilled() /
   dailyApproxHours() understand both.
   ================================================================= */
```

Replace with:

```
/* =================================================================
   PAGE · DAILY SHEET  (V46)
   Team members (APLs) log daily work as an hourly diary; the PM sees a
   roll-up and can comment. Data: DB.dailyLogs — one record per person-day
   { id, aplId, date, hours:{ "7":{for,detail}, … "21":{…} }, comments:[], … }
   ================================================================= */
```

- [ ] **Step 2: Remove `DAILY_BLOCKS`, restore the `DAILY_HOURS` comment**

Find:

```js
const DAILY_HOURS = [7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];   // 7 AM → 9 PM — legacy records only
const DAILY_BLOCKS = [
  { key:"morning",   label:"Morning",   range:"7–12", hours:5 },
  { key:"afternoon", label:"Afternoon", range:"12–5", hours:5 },
  { key:"evening",   label:"Evening",   range:"5–9",  hours:4 }
];
```

Replace with:

```js
const DAILY_HOURS = [7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];   // 7 AM → 9 PM
```

- [ ] **Step 3: Restore `dailyFilled`, remove `dailyFormat`/`dailyApproxHours`/`dailyBadgeLabel`**

Find:

```js
function dailyFilled(rec){
  if(!rec) return 0;
  if(rec.blocks) return DAILY_BLOCKS.filter(b=>(rec.blocks[b.key]||"").trim()).length;
  return Object.keys(rec.hours||{}).length;
}
/* which shape a record should be edited/rendered as. A record only stays
   in "legacy" once it has real hour data in it — an existing record whose
   hours were fully cleared moves to the simpler blocks UI going forward. */
function dailyFormat(rec){ return (rec && rec.hours && Object.keys(rec.hours).length) ? "legacy" : "blocks"; }
/* approximate hours, derived purely from which fixed-length blocks are
   filled — never entered by anyone. Legacy records don't have this. */
function dailyApproxHours(rec){
  if(!rec||!rec.blocks) return 0;
  return DAILY_BLOCKS.reduce((s,b)=>s+((rec.blocks[b.key]||"").trim()?b.hours:0),0);
}
function dailyBadgeLabel(rec){
  const filled=dailyFilled(rec);
  if(!filled) return `<span class="badge" style="background:var(--paper-2);color:var(--ink-3)">not filled</span>`;
  if(rec.blocks) return `<span class="badge blue">${filled} of ${DAILY_BLOCKS.length} blocks · ~${dailyApproxHours(rec)}h</span>`;
  return `<span class="badge blue">${filled} hour${filled>1?'s':''} filled</span>`;
}
function dailyToggle(key){ DAILY_OPEN = DAILY_OPEN===key ? null : key; render(); }
```

Replace with:

```js
function dailyFilled(rec){ return rec?Object.keys(rec.hours||{}).length:0; }
function dailyToggle(key){ DAILY_OPEN = DAILY_OPEN===key ? null : key; render(); }
```

- [ ] **Step 4: Restore `dailyDateRow` to single-shape (no format branching)**

Find:

```js
function dailyDateRow(aplId,date,editable){
  const key=aplId+"|"+date;
  const rec=dailyRec(aplId,date);
  const isOpen=DAILY_OPEN===key;
  const isToday=date===TODAY_ISO;
  const badge=dailyBadgeLabel(rec);
  const head=`<div style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--rule);cursor:pointer${isOpen?';background:var(--paper-2)':''}" onclick="dailyToggle('${key}')">
      <span style="color:var(${isOpen?'--accent':'--ink-3'})">${isOpen?'▾':'▸'}</span>
      <b style="flex:1${isOpen?';color:var(--accent)':''}">${isToday?'Today — ':''}${dailyDateLabel(date)}</b>
      ${badge}
    </div>`;
  if(!isOpen) return head;
  const body = dailyFormat(rec)==="legacy" ? dailyGrid(aplId,date,editable) : dailyBlocksSection(aplId,date,editable);
  return head + `<div style="padding:0 16px 16px;background:var(--paper-2);border-bottom:1px solid var(--rule)">
      ${body}
      ${dailyComments(aplId,date)}
    </div>`;
}
```

Replace with:

```js
function dailyDateRow(aplId,date,editable){
  const key=aplId+"|"+date;
  const rec=dailyRec(aplId,date);
  const filled=dailyFilled(rec);
  const isOpen=DAILY_OPEN===key;
  const isToday=date===TODAY_ISO;
  const badge=filled
    ? `<span class="badge blue">${filled} hour${filled>1?'s':''} filled</span>`
    : `<span class="badge" style="background:var(--paper-2);color:var(--ink-3)">not filled</span>`;
  const head=`<div style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--rule);cursor:pointer${isOpen?';background:var(--paper-2)':''}" onclick="dailyToggle('${key}')">
      <span style="color:var(${isOpen?'--accent':'--ink-3'})">${isOpen?'▾':'▸'}</span>
      <b style="flex:1${isOpen?';color:var(--accent)':''}">${isToday?'Today — ':''}${dailyDateLabel(date)}</b>
      ${badge}
    </div>`;
  if(!isOpen) return head;
  return head + `<div style="padding:0 16px 16px;background:var(--paper-2);border-bottom:1px solid var(--rule)">
      ${dailyGrid(aplId,date,editable)}
      ${dailyComments(aplId,date)}
    </div>`;
}
```

- [ ] **Step 5: Remove `dailyBlocksSection`**

Find (it sits between the end of `dailyGrid` and the `/* comments block */` comment):

```js
/* the three-block view/editor — used inside a day's accordion, both for
   past days and for a brand-new day that has no legacy hours yet */
function dailyBlocksSection(aplId,date,editable){
  const rec=dailyRec(aplId,date);
  const blocks=(rec&&rec.blocks)||{};
  const rows=DAILY_BLOCKS.map(b=>{
    const v=blocks[b.key]||"";
    if(editable){
      return `<div style="margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:var(--ink-3);margin-bottom:4px">${b.label} · ${b.range}</div>
        <textarea id="dblk_${b.key}" rows="2" placeholder="What did you work on…" style="width:100%;resize:none">${esc(v)}</textarea>
      </div>`;
    }
    const blank='<span style="color:var(--ink-3)">—</span>';
    return `<div style="margin-bottom:10px">
      <div style="font-size:12px;font-weight:700;color:var(--ink-3);margin-bottom:4px">${b.label} · ${b.range}</div>
      <div style="font-size:13px">${v?esc(v):blank}</div>
    </div>`;
  }).join("");
  return `<div style="background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:14px;margin-top:2px">
      ${rows}
    </div>
    ${editable?`<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:10px;flex-wrap:wrap">
      <span style="font-size:12px;color:var(--ink-3)">Fill only the blocks you want — blanks are fine.</span>
      <button class="btn primary sm" onclick="dailySaveDayBlocks('${aplId}','${date}')">Save day</button>
    </div>`:''}`;
}

/* comments block — everyone sees them; only the PM can add (not on their own sheet) */
```

Replace with just:

```js
/* comments block — everyone sees them; only the PM can add (not on their own sheet) */
```

(i.e. delete the whole `dailyBlocksSection` function, keep the comments-block comment that follows it.)

- [ ] **Step 6: Remove `dailySaveDayBlocks`**

Find (it sits between the end of `dailySaveDay` and `async function dailyAddComment`):

```js
/* accordion save — mirrors dailySaveDay's safety guard exactly. The block
   textareas (dblk_morning etc) are NOT scoped by date, same as the legacy
   hour inputs, so the same stale-day-overwrite risk applies: refuse to
   save if a different day's accordion is open now than when the user
   started typing. */
function dailySaveDayBlocks(aplId,date){
  if(aplId!==ME.id){ toast("You can only edit your own daily sheet"); return; }
  if(DAILY_OPEN !== aplId+"|"+date){
    toast("This day isn't open anymore — reopen it and save again");
    return;
  }
  const blocks={};
  DAILY_BLOCKS.forEach(b=>{
    const v=(el("dblk_"+b.key)&&el("dblk_"+b.key).value.trim())||"";
    if(v) blocks[b.key]=v;
  });
  let rec=dailyRec(aplId,date);
  if(rec){ rec.blocks=blocks; rec.editedBy=ME.name; rec.editedAt=TODAY_ISO; }
  else if(Object.keys(blocks).length){
    DB.dailyLogs.push({ id:genId("dl"), aplId, date, blocks, comments:[], editedBy:ME.name, editedAt:TODAY_ISO });
  }
  saveDB(); render();
  const n=Object.keys(blocks).length;
  toast(n?("Saved "+dailyDateLabel(date)+" · "+n+" of "+DAILY_BLOCKS.length+" blocks"):("Cleared "+dailyDateLabel(date)));
}
async function dailyAddComment(aplId,date){
```

Replace with:

```js
async function dailyAddComment(aplId,date){
```

(i.e. delete the whole `dailySaveDayBlocks` function.)

- [ ] **Step 7: Restore `dailyPmPage`'s stats and KPI tile**

Find:

```js
  const daysLogged=inRange.filter(r=>dailyFilled(r)).length;
  let totalHours=0;
  inRange.forEach(r=>{ totalHours += r.blocks ? dailyApproxHours(r) : Object.keys(r.hours||{}).length; });
  const blockRecs=inRange.filter(r=>r.blocks);
  const blocksPossible=blockRecs.length*DAILY_BLOCKS.length;
  const blocksDone=blockRecs.reduce((s,r)=>s+dailyFilled(r),0);
  const blockPct=blocksPossible?Math.round(blocksDone/blocksPossible*100):null;
  const reportedToday=apls.filter(a=>{ const r=dailyRec(a.id,TODAY_ISO); return dailyFilled(r); }).length;
```

Replace with:

```js
  const daysLogged=inRange.filter(r=>dailyFilled(r)).length;
  let totalHours=0; const byFor={};
  inRange.forEach(r=>Object.values(r.hours||{}).forEach(c=>{ totalHours++; if(c&&c.for) byFor[c.for]=(byFor[c.for]||0)+1; }));
  const topFor=Object.entries(byFor).sort((a,b)=>b[1]-a[1])[0];
  const reportedToday=apls.filter(a=>{ const r=dailyRec(a.id,TODAY_ISO); return dailyFilled(r); }).length;
```

Then find:

```js
      ${dailyKpi("accent","🎯","Block completion",blockPct!=null?blockPct+"%":"—",blockPct!=null?blocksDone+" of "+blocksPossible+" blocks":"no data yet")}
```

Replace with:

```js
      ${dailyKpi("accent","🎯","Top by effort",topFor?esc(topFor[0]):"—",topFor?topFor[1]+" hours":"no data yet")}
```

- [ ] **Step 8: Syntax-check**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('D:/Guru/Mirror/CRITICAL FILES/Claude Apps/Partnership Dashboard/index.html', 'utf8');
const start = html.indexOf('<script>', 1174);
const scriptStart = html.indexOf('>', start) + 1;
const scriptEnd = html.indexOf('</script>', scriptStart);
fs.writeFileSync('C:/Users/HP/AppData/Local/Temp/claude/scratch/main-script-check.js', html.slice(scriptStart, scriptEnd));
"
node --check "C:\Users\HP\AppData\Local\Temp\claude\scratch\main-script-check.js"
```

Expected: no output. This extraction command is reused verbatim in every later task's syntax-check step.

- [ ] **Step 9: Grep-confirm no block references remain**

```bash
grep -n "DAILY_BLOCKS\|dailyBlocksSection\|dailySaveDayBlocks\|dailyFormat\|dailyApproxHours\|dailyBadgeLabel" "D:\Guru\Mirror\CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html"
```

Expected: no matches.

---

### Task 2: Dashboard hourly quick-log widget

**Files:**
- Modify: `CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html`, function `pageDash` and the `dailyHomeWidget`/`dailyHomeSaveToday` functions added earlier today (currently block-shaped, to be replaced with the hourly version)

**Interfaces:**
- Consumes: `DAILY_HOURS`, `dailyRec`, `dailyFilled`, `hourLabel`, `esc`, `el`, `genId`, `saveDB`, `render`, `toast`, `ME`, `TODAY_ISO` (all existing).
- Produces: `dailyHomeWidget()` and `dailyHomeSaveToday()` — both consumed only from `pageDash()`. Same names as the block-era versions (this task replaces their bodies, not their signatures).

- [ ] **Step 1: Replace `dailyHomeWidget` and `dailyHomeSaveToday`**

Find (the block-shaped versions added earlier today, immediately before `function pageDash(){`):

```js
/* Dashboard quick-log — the fast path for logging *today* without
   navigating to the Daily Sheet page at all. APL/Programme roles only. */
function dailyHomeWidget(){
  if(!(ME.role==="APL"||ME.role==="Programme")) return '';
  const rec=dailyRec(ME.id,TODAY_ISO);
  const blocks=(rec&&rec.blocks)||{};
  const filled=dailyFilled(rec);
  return `<div class="panel" style="margin-bottom:16px">
    <div class="panel-h">
      <h3>Today's log</h3>
      <span class="note">${filled} of ${DAILY_BLOCKS.length} blocks logged</span>
    </div>
    <div style="padding:14px 16px">
      ${DAILY_BLOCKS.map(b=>`<div style="margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--ink-3);margin-bottom:4px">
          <span>${b.label} · ${b.range}</span>
          ${blocks[b.key]?'<span style="color:var(--green)">✓</span>':''}
        </div>
        <textarea id="dblk_${b.key}" rows="2" placeholder="What did you work on…" style="width:100%;resize:none">${esc(blocks[b.key]||'')}</textarea>
      </div>`).join("")}
      <div style="display:flex;justify-content:flex-end">
        <button class="btn primary sm" onclick="dailyHomeSaveToday()">Save today</button>
      </div>
    </div>
  </div>`;
}
/* not DAILY_OPEN-guarded like dailySaveDayBlocks — this widget is the only
   place on the Dashboard page rendering dblk_* ids, always for today, so
   there's no "which day is this for" ambiguity to protect against. */
function dailyHomeSaveToday(){
  const aplId=ME.id, date=TODAY_ISO;
  const blocks={};
  DAILY_BLOCKS.forEach(b=>{
    const v=(el("dblk_"+b.key)&&el("dblk_"+b.key).value.trim())||"";
    if(v) blocks[b.key]=v;
  });
  let rec=dailyRec(aplId,date);
  if(rec){ rec.blocks=blocks; rec.editedBy=ME.name; rec.editedAt=TODAY_ISO; }
  else if(Object.keys(blocks).length){
    DB.dailyLogs.push({ id:genId("dl"), aplId, date, blocks, comments:[], editedBy:ME.name, editedAt:TODAY_ISO });
  }
  saveDB(); render();
  const n=Object.keys(blocks).length;
  toast(n?("Saved today · "+n+" of "+DAILY_BLOCKS.length+" blocks"):("Cleared today's log"));
}
```

Replace with:

```js
/* Dashboard quick-log — the fast path for logging *today* without
   navigating to the Daily Sheet page at all. APL/Programme roles only.
   Same two-field-per-hour grid as the full Daily Sheet page, in a
   scrollable box so it doesn't take over the Dashboard. */
function dailyHomeWidget(){
  if(!(ME.role==="APL"||ME.role==="Programme")) return '';
  const rec=dailyRec(ME.id,TODAY_ISO);
  const hours=(rec&&rec.hours)||{};
  const filled=dailyFilled(rec);
  return `<div class="panel" style="margin-bottom:16px">
    <div class="panel-h">
      <h3>Today's log</h3>
      <span class="note">${filled} hour${filled===1?'':'s'} filled</span>
    </div>
    <div style="padding:14px 16px">
      <div style="max-height:230px;overflow-y:auto;border:1px solid var(--rule);border-radius:8px;padding:10px">
        ${DAILY_HOURS.map(h=>{
          const c=hours[String(h)]||{};
          return `<div style="margin-bottom:10px">
            <div style="font-size:12px;font-weight:700;color:var(--ink-3);margin-bottom:4px">${hourLabel(h)}</div>
            <input id="dfor_${h}" value="${esc(c.for||'')}" placeholder="NGO / activity…" style="width:100%;margin-bottom:4px">
            <input id="ddet_${h}" value="${esc(c.detail||'')}" placeholder="what you did this hour…" style="width:100%">
          </div>`;
        }).join("")}
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:10px">
        <button class="btn primary sm" onclick="dailyHomeSaveToday()">Save today</button>
      </div>
    </div>
  </div>`;
}
/* not DAILY_OPEN-guarded like dailySaveDay — this widget is the only place
   on the Dashboard page rendering dfor_*/ddet_* ids, always for today, so
   there's no "which day is this for" ambiguity to protect against. */
function dailyHomeSaveToday(){
  const aplId=ME.id, date=TODAY_ISO;
  const hours={};
  DAILY_HOURS.forEach(h=>{
    const f=(el("dfor_"+h)&&el("dfor_"+h).value.trim())||"";
    const d=(el("ddet_"+h)&&el("ddet_"+h).value.trim())||"";
    if(f||d) hours[String(h)]={ for:f, detail:d };
  });
  let rec=dailyRec(aplId,date);
  if(rec){ rec.hours=hours; rec.editedBy=ME.name; rec.editedAt=TODAY_ISO; }
  else if(Object.keys(hours).length){
    DB.dailyLogs.push({ id:genId("dl"), aplId, date, hours, comments:[], editedBy:ME.name, editedAt:TODAY_ISO });
  }
  saveDB(); render();
  const n=Object.keys(hours).length;
  toast(n?("Saved today · "+n+" hour"+(n>1?'s':'')):("Cleared today's log"));
}
```

(The call site `${dailyHomeWidget()}` inside `pageDash()`'s returned template, added earlier today right after `${needsYouStrip(ngos)}`, needs no change — it already calls this same function name.)

- [ ] **Step 2: Syntax-check**

Run the extraction + check command from Task 1 Step 8. Expected: no output.

---

### Task 3: Binary daily-log nudges (nav badge + Dashboard card)

**Files:**
- Modify: `CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html`, functions `dailyNavCount` and `needsYouStrip`

**Interfaces:**
- Consumes: `dailyFilled`, `dailyRec`, `DB.users`, `ME`, `TODAY_ISO`.

- [ ] **Step 1: Simplify `dailyNavCount`**

Find:

```js
function dailyNavCount(){
  if(ME.role==="PM"){
    const apls=(DB.users||[]).filter(u=>u.role==="APL"||u.role==="Programme");
    const n=apls.filter(a=>!dailyFilled(dailyRec(a.id,TODAY_ISO))).length;
    return n||null;
  }
  if(ME.role==="APL"||ME.role==="Programme"){
    const rec=dailyRec(ME.id,TODAY_ISO);
    if(dailyFormat(rec)==="legacy") return null;
    const n=DAILY_BLOCKS.length-dailyFilled(rec);
    return n>0?n:null;
  }
  return null;
}
```

Replace with:

```js
function dailyNavCount(){
  if(ME.role==="PM"){
    const apls=(DB.users||[]).filter(u=>u.role==="APL"||u.role==="Programme");
    const n=apls.filter(a=>!dailyFilled(dailyRec(a.id,TODAY_ISO))).length;
    return n||null;
  }
  if(ME.role==="APL"||ME.role==="Programme"){
    return dailyFilled(dailyRec(ME.id,TODAY_ISO)) ? null : 1;
  }
  return null;
}
```

- [ ] **Step 2: Simplify the `needsYouStrip` daily-log card**

Find:

```js
  if(ME.role==="PM"){
    const apls=(DB.users||[]).filter(u=>u.role==="APL"||u.role==="Programme");
    const notLogged=apls.filter(a=>!dailyFilled(dailyRec(a.id,TODAY_ISO))).length;
    cards.push({n:notLogged, ic:"🗓", cls:"amber", go:"go('daily')",
      lab:notLogged===1?"team member hasn't logged today":"team members haven't logged today"});
  } else if(ME.role==="APL"||ME.role==="Programme"){
    const rec=dailyRec(ME.id,TODAY_ISO);
    const left=dailyFormat(rec)==="legacy" ? 0 : Math.max(0,DAILY_BLOCKS.length-dailyFilled(rec));
    cards.push({n:left, ic:"🗓", cls:"amber", go:"go('daily')",
      lab:left===1?"block left to log today":"blocks left to log today"});
  }
```

Replace with:

```js
  if(ME.role==="PM"){
    const apls=(DB.users||[]).filter(u=>u.role==="APL"||u.role==="Programme");
    const notLogged=apls.filter(a=>!dailyFilled(dailyRec(a.id,TODAY_ISO))).length;
    cards.push({n:notLogged, ic:"🗓", cls:"amber", go:"go('daily')",
      lab:notLogged===1?"team member hasn't logged today":"team members haven't logged today"});
  } else if(ME.role==="APL"||ME.role==="Programme"){
    const loggedToday = dailyFilled(dailyRec(ME.id,TODAY_ISO)) > 0;
    cards.push({n:loggedToday?0:1, ic:"🗓", cls:"amber", go:"go('daily')",
      lab:"log today's hours"});
  }
```

- [ ] **Step 3: Syntax-check**

Run the extraction + check command from Task 1 Step 8. Expected: no output.

---

### Task 4: Top-bar declutter

**Files:**
- Modify: `CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html` — HTML shell (~line 1117-1144), CSS (~line 142-196), and `render()` (~line 2495-2519)

**Interfaces:** none — this is pure structural/visual change, no new functions.

- [ ] **Step 1: Move the reporting-month picker from the top bar into the sidebar**

Find:

```html
    <aside class="side" id="side">
      <div class="brand">
        <div class="mk"><i></i>Sahkar</div>
        <div class="tg">KRSF Partnership Program <span style="opacity:.6">· V61</span></div>
      </div>
      <nav class="nav" id="nav"></nav>
      <div class="side-foot">
        <div class="av" id="meAv">G</div>
        <div>
          <div class="nm" id="meName">—</div>
          <div class="rl" id="meRole">—</div>
        </div>
        <button class="out" onclick="doLogout()" aria-label="Sign out" title="Sign out">Sign out</button>
      </div>
    </aside>
    <div class="main">
      <div class="topbar">
        <button class="hamburger" id="hamburger" onclick="toggleSide()" aria-label="Open menu" title="Menu">☰</button>
        <div class="crumb" id="crumb">—</div>
        <div class="gap"></div>
        <span class="conn"><span class="conn-dot off" id="connDot" title="Connecting…"></span></span>
        <div class="month-pick">
          <label>Reporting month</label>
          <select class="sel-inp" id="globalMonth" onchange="onMonthChange()"></select>
        </div>
      </div>
      <div class="content" id="content"></div>
    </div>
```

Replace with:

```html
    <aside class="side" id="side">
      <div class="brand">
        <div class="mk"><i></i>Sahkar</div>
        <div class="tg">KRSF Partnership Program <span style="opacity:.6">· V62</span></div>
      </div>
      <nav class="nav" id="nav"></nav>
      <div class="month-pick">
        <label>Reporting month</label>
        <select class="sel-inp" id="globalMonth" onchange="onMonthChange()"></select>
      </div>
      <div class="side-foot">
        <div class="av" id="meAv">G</div>
        <div>
          <div class="nm" id="meName">—</div>
          <div class="rl" id="meRole">—</div>
        </div>
        <button class="out" onclick="doLogout()" aria-label="Sign out" title="Sign out">Sign out</button>
      </div>
    </aside>
    <div class="main">
      <div class="topbar">
        <button class="hamburger" id="hamburger" onclick="toggleSide()" aria-label="Open menu" title="Menu">☰</button>
        <div class="gap"></div>
        <span class="conn"><span class="conn-dot off" id="connDot" title="Connecting…"></span></span>
      </div>
      <div class="content" id="content"></div>
    </div>
```

(Version string in the sidebar brand also bumped V61→V62 here since we're already touching that line — same value Task 5 sets in `<title>` and `sw.js`.)

- [ ] **Step 2: Update CSS — remove `.crumb`, restyle `.month-pick` for the sidebar**

Find:

```css
  .crumb{font-size:12px;color:var(--ink-3)}
  .crumb b{color:var(--ink);font-weight:600}
  .topbar .gap{flex:1}
  .month-pick{display:flex;align-items:center;gap:8px}
  .month-pick label{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);font-weight:600}
```

Replace with:

```css
  .topbar .gap{flex:1}
  .month-pick{padding:12px 16px;border-top:1px solid var(--rule)}
  .month-pick label{display:block;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);font-weight:600;margin-bottom:6px}
  .month-pick .sel-inp{width:100%}
```

- [ ] **Step 3: Remove the now-unneeded mobile label-hiding rule**

Find:

```css
    .topbar{padding:0 14px;gap:10px}
    .month-pick label{display:none}
  }
```

Replace with:

```css
    .topbar{padding:0 14px;gap:10px}
  }
```

- [ ] **Step 4: Remove crumb logic from `render()`**

Find:

```js
function render(){
  if(!ME) return;
  { const _al=navItems().map(i=>i.id); if(_al.length && !_al.includes(CUR_PAGE) && CUR_PAGE!=="ngo") CUR_PAGE=_al.includes("fdnms")?"fdnms":_al[0]; }
  buildNav();
  const c = el("content");
  let crumb = "<b>"+ (navItems().find(i=>i.id===CUR_PAGE)?.label||"") +"</b>";
  switch(CUR_PAGE){
    case "dash":   c.innerHTML = pageDash(); break;
    case "bets":   c.innerHTML = pageBets(); break;
    case "ngos":   c.innerHTML = pageNgos(); break;
    case "ngo":    c.innerHTML = pageNgoDetail(PAGE_ARG);
                   crumb = `<span style="cursor:pointer" onclick="go('ngos')">Partner NGOs</span> &nbsp;›&nbsp; <b>${esc(ngoById(PAGE_ARG)?.short||'')}</b>`;
                   break;
    case "budget": c.innerHTML = pageBudget(); break;
    case "debits": c.innerHTML = pageDebits(); break;
    case "fdnms":  c.innerHTML = SHOW_FDNMS ? pageFDNMS() : pageDash(); break;
    case "tasks":  c.innerHTML = pageTasks(); break;
    case "daily":  c.innerHTML = pageDaily(); break;
    case "okrupload": c.innerHTML = pageOkrUpload(); break;
    case "docs":   c.innerHTML = pageDocs(); break;
    case "admin":  c.innerHTML = (ME.role==="PM") ? pageAdmin() : pageDash(); break;
    default: c.innerHTML = pageDash();
  }
  el("crumb").innerHTML = crumb;
}
```

Replace with:

```js
function render(){
  if(!ME) return;
  { const _al=navItems().map(i=>i.id); if(_al.length && !_al.includes(CUR_PAGE) && CUR_PAGE!=="ngo") CUR_PAGE=_al.includes("fdnms")?"fdnms":_al[0]; }
  buildNav();
  const c = el("content");
  switch(CUR_PAGE){
    case "dash":   c.innerHTML = pageDash(); break;
    case "bets":   c.innerHTML = pageBets(); break;
    case "ngos":   c.innerHTML = pageNgos(); break;
    case "ngo":    c.innerHTML = pageNgoDetail(PAGE_ARG); break;
    case "budget": c.innerHTML = pageBudget(); break;
    case "debits": c.innerHTML = pageDebits(); break;
    case "fdnms":  c.innerHTML = SHOW_FDNMS ? pageFDNMS() : pageDash(); break;
    case "tasks":  c.innerHTML = pageTasks(); break;
    case "daily":  c.innerHTML = pageDaily(); break;
    case "okrupload": c.innerHTML = pageOkrUpload(); break;
    case "docs":   c.innerHTML = pageDocs(); break;
    case "admin":  c.innerHTML = (ME.role==="PM") ? pageAdmin() : pageDash(); break;
    default: c.innerHTML = pageDash();
  }
}
```

Note: `pageNgoDetail` already renders its own `<button class="btn ghost sm" onclick="go('ngos')">← All NGOs</button>` back-link in-content (confirmed at index.html:3767-3769), so removing the crumb's "Partner NGOs › Name" trail loses no unique navigation.

- [ ] **Step 5: Syntax-check**

Run the extraction + check command from Task 1 Step 8. Expected: no output.

- [ ] **Step 6: Grep-confirm no leftover `crumb` references**

```bash
grep -n "crumb" "D:\Guru\Mirror\CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html"
```

Expected: no matches.

---

### Task 5: Version bump

**Files:**
- Modify: `CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html` (`<title>`, line 6 — already at V61, not yet bumped this session)
- Modify: `CRITICAL FILES\Claude Apps\Partnership Dashboard\sw.js` (`CACHE` constant, line 3)

**Interfaces:** none — cosmetic/cache-busting only.

- [ ] **Step 1: Bump the title**

Find:

```html
<title>Sahkar · KRSF Partnership Program · V61</title>
```

Replace with:

```html
<title>Sahkar · KRSF Partnership Program · V62</title>
```

- [ ] **Step 2: Bump the service worker cache**

Find (line 3 of `sw.js`):

```js
const CACHE = 'sahkar-v61';
```

Replace with:

```js
const CACHE = 'sahkar-v62';
```

- [ ] **Step 3: Syntax-check both files**

Run the extraction + check command from Task 1 Step 8 for `index.html`.
Run: `node --check "D:\Guru\Mirror\CRITICAL FILES\Claude Apps\Partnership Dashboard\sw.js"`
Expected: no output from either.

---

### Task 6: Full verification pass, snapshot, and deploy

**Files:**
- Create: `CRITICAL FILES\Claude Apps\Partnership Dashboard\Partnership Dashboard V62.html` (versioned snapshot)
- Copy: `index.html` and `sw.js` into `D:\Guru\Mirror\01_KRSF\github\partnerngo\`
- Modify (git repo): `01_KRSF\github\partnerngo\index.html`, `01_KRSF\github\partnerngo\sw.js`

- [ ] **Step 1: Full read-only regression pass in the browser**

Open the local file in the preview (no login/save actions — see Global Constraints). Confirm:
1. Page loads with no console errors.
2. `node --check` passes (already confirmed per-task; re-run once more against the final file as a final gate).
3. Grep for stray `90` near expiry logic (from the original Feature 1 work) — already verified earlier this session, re-check nothing regressed: `grep -n "days<90" "D:\Guru\Mirror\CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html"` should return no matches.
4. Grep for any remaining block/crumb references (Task 1 Step 9, Task 4 Step 6) — re-run both as a final gate.

Because live interactive testing isn't safe against this database, ask Munjal to do one hands-on pass after this task (log in, check the Dashboard widget scrolls at 375px, check Daily Sheet page still works, check the sidebar month-picker, check a document expiring within 120 days shows the compliance card) before this is called fully verified — note this explicitly when reporting completion.

- [ ] **Step 2: Create the versioned snapshot**

Copy the final `index.html` to `CRITICAL FILES\Claude Apps\Partnership Dashboard\Partnership Dashboard V62.html` (exact copy, no edits).

- [ ] **Step 3: Sync into the git repo folder**

Copy `CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html` and `CRITICAL FILES\Claude Apps\Partnership Dashboard\sw.js` over the corresponding files in `D:\Guru\Mirror\01_KRSF\github\partnerngo\`, overwriting them.

- [ ] **Step 4: Commit and push**

```bash
cd "D:\Guru\Mirror\01_KRSF\github\partnerngo"
git status
git add index.html sw.js
git commit -m "V62 — compliance document alerts + Daily Sheet hourly widget + top-bar declutter

Surfaces MoU/12A/etc expiry on the Dashboard and Documents nav badge
(90->120 day window). Adds a Dashboard home-screen quick-log widget
using the existing hourly grid in a scrollable box, so logging today's
hours no longer requires navigating to the Daily Sheet page. Daily-log
enforcement nudges are binary (logged today vs not) rather than a
countdown. Declutters the global top bar: drops the redundant page-name
crumb, keeps the hamburger menu and connection dot, relocates the
reporting-month picker into the sidebar."
git push
```

- [ ] **Step 5: Confirm live**

Poll the live GitHub Pages URL until the served page's `<title>` shows "V62" and `sw.js` shows `sahkar-v62`. Do not consider this done on `git push` succeeding alone.

---

## Self-Review Notes

- **Spec coverage**: Feature 2's revised sections (hourly revert, home widget, binary nudges) → Tasks 1-3. Feature 3 (top-bar declutter) → Task 4. Version bump + deploy → Tasks 5-6. Feature 1 (compliance alerts) is unchanged and already implemented — correctly excluded from new tasks.
- **No placeholders**: every step shows complete before/after code.
- **Type/name consistency**: `dailyHomeWidget`/`dailyHomeSaveToday` keep the same names as their (now-replaced) block-era bodies, so the existing call site in `pageDash()` needs no edit. `dailyNavCount`/`needsYouStrip` reference only `dailyFilled`/`dailyRec`, both restored to their pre-session single-shape form in Task 1 before Task 3 uses them.
- **Live-data safety**: explicitly called out in Global Constraints and Task 6 — no Save-button testing against the production database; final hands-on check deferred to Munjal.
