# APL Folders on the Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PM-only "folders" panel to the Dashboard, one folder per APL, showing their assigned NGOs — hover fans out a preview, click opens a full grid via the app's existing modal system, clicking an NGO card navigates to its detail page.

**Architecture:** Pure extension of `index.html`. Reuses existing components wherever they already do the job: `.ngo-avatar` (vertical-colored initials, already live), `showModal`/`modalShell` (already live, used by every other in-app popup), `go()` (existing navigation). No new dependencies, no new data fields — NGO↔APL assignment is the existing `apl.ngoIds` array, read-only here.

**Tech Stack:** Vanilla JS, no framework, no build step. No test runner — the one pure-logic function (grouping NGOs by APL) gets a throwaway `node` scratch test; the rest is CSS/markup verified by hand in a live browser preview.

## Global Constraints

- Canonical source file: `D:\Guru\Mirror\CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html` — edit this file, not the git-repo copy.
- **No new visual language beyond what this app already has**: reuse `.ngo-avatar`'s five existing vertical colors, `.panel`-style card chrome, and the existing modal system. Do not add clip-path/3D-transform "paper stack" rendering — that was explicitly descoped in the spec.
- **No live-data testing**: this file connects directly to the production Firebase RTDB with no staging/sandbox mode. Do not click any Save button against it — verification is `node --check`, the scratch test, and read-only browser inspection only. (This feature has no Save action at all — it's read-only navigation — but the standing rule still applies to the rest of the app while testing.)
- After all code tasks, the file must still pass `node --check` on its main script block. Use this extraction (checks whichever inline `<script>` block is largest, robust to line-number drift):

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
- Version bump: this ships as **V64** (current live version is V63).

---

### Task 1: `aplFoldersPanel()` + `openAplFolder()` — grouping logic and scratch test

**Files:**
- Test: scratch file `C:\Users\HP\AppData\Local\Temp\claude\scratch\apl-folders-test.js`

**Interfaces:**
- Produces: the grouping logic (APL → assigned NGOs) later pasted into `aplFoldersPanel()`/`openAplFolder()` in Task 2 — same shape, verified here first in isolation.

- [ ] **Step 1: Write and run a scratch test for the grouping logic**

Create `C:\Users\HP\AppData\Local\Temp\claude\scratch\apl-folders-test.js`:

```js
const assert = require('assert');

function ngosForApl(apl, allNgos){
  return allNgos.filter(n => (apl.ngoIds||[]).includes(n.id));
}

const ngos = [
  {id:"n1", short:"GU", vertical:"Livelihood"},
  {id:"n2", short:"NE", vertical:"Education"},
  {id:"n3", short:"SR", vertical:"Livelihood"},
];

assert.deepStrictEqual(
  ngosForApl({id:"a1", ngoIds:["n1","n3"]}, ngos).map(n=>n.id),
  ["n1","n3"],
  "APL assigned two NGOs, in DB.ngos order"
);
assert.deepStrictEqual(ngosForApl({id:"a2", ngoIds:[]}, ngos), [], "APL with explicitly empty ngoIds -> no NGOs");
assert.deepStrictEqual(ngosForApl({id:"a3"}, ngos), [], "APL with no ngoIds field at all -> no NGOs");
assert.deepStrictEqual(ngosForApl({id:"a4", ngoIds:["n1","n2","n3"]}, ngos).slice(0,5).length, 3, "slice(0,5) on a 3-item set returns all 3, not padded");

console.log("All APL-folders assertions passed");
```

Run: `node "C:\Users\HP\AppData\Local\Temp\claude\scratch\apl-folders-test.js"`
Expected: `All APL-folders assertions passed`

- [ ] **Step 2: Commit**

No git commit yet — see Task 3 for the versioned snapshot + push.

---

### Task 2: Add the CSS, `aplFoldersPanel()`, `openAplFolder()`, and wire into `pageDash()`

**Files:**
- Modify: `CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html` — CSS (near the existing `.ngo-avatar` block, index.html:626-635), a new JS section (near `aplNamesFor`, index.html:2050-2055), and `pageDash()`'s return template (near the `.kpi-grid` closing tag)

**Interfaces:**
- Consumes: `.ngo-avatar` CSS classes (existing, index.html:626-635), `showModal`/`modalShell`/`closeModal` (existing, index.html:3141-3182), `go()` (existing, index.html:2477-2484), `esc()`, `DB.users`, `DB.ngos`, `ME`.
- Produces: `aplFoldersPanel()` — called once from `pageDash()`. `openAplFolder(aplId)` — called from folder-card `onclick`.

- [ ] **Step 1: Add the CSS**

Find (index.html, immediately after the `.ngo-avatar.climate` rule):

```css
  .ngo-avatar.climate{background:var(--violet-soft);color:var(--violet)}
  .risk-dot{position:absolute;top:-3px;right:-3px;width:12px;height:12px;border-radius:50%;border:2px solid var(--card)}
```

Replace with:

```css
  .ngo-avatar.climate{background:var(--violet-soft);color:var(--violet)}
  .risk-dot{position:absolute;top:-3px;right:-3px;width:12px;height:12px;border-radius:50%;border:2px solid var(--card)}

  /* V64: APL folders — Dashboard, PM only. Hover fans out up to 5 NGO
     avatar chips behind the folder card; click opens the full set via
     the existing modal system (see openAplFolder). */
  .apl-folders{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin-bottom:14px}
  .apl-folder{position:relative;cursor:pointer;padding-top:26px}
  .apl-folder-fan{position:absolute;top:0;left:50%;height:34px;pointer-events:none}
  .apl-fan-chip{position:absolute;top:0;left:0;margin-left:-17px;opacity:0;transition:transform .18s ease,opacity .18s ease}
  .apl-fan-chip .ngo-avatar{width:34px;height:34px;font-size:11px;border:2px solid var(--card);box-shadow:var(--shadow)}
  .apl-folder:hover .apl-fan-chip{opacity:1}
  .apl-folder:hover .apl-fan-chip:nth-child(1){transform:translate(-52px,-6px) rotate(-12deg)}
  .apl-folder:hover .apl-fan-chip:nth-child(2){transform:translate(-26px,-10px) rotate(-6deg)}
  .apl-folder:hover .apl-fan-chip:nth-child(3){transform:translate(0,-12px) rotate(0deg)}
  .apl-folder:hover .apl-fan-chip:nth-child(4){transform:translate(26px,-10px) rotate(6deg)}
  .apl-folder:hover .apl-fan-chip:nth-child(5){transform:translate(52px,-6px) rotate(12deg)}
  .apl-folder-body{background:var(--card);border:1px solid var(--rule);border-radius:13px;padding:14px;
                    box-shadow:var(--shadow);transition:border-color .15s,box-shadow .15s}
  .apl-folder:hover .apl-folder-body{border-color:var(--accent);box-shadow:0 4px 14px rgba(0,0,0,.06)}
  .apl-folder-ico{font-size:20px;margin-bottom:6px}
  .apl-folder-name{font-weight:700;font-size:13.5px;color:var(--ink)}
  .apl-folder-count{font-size:11.5px;color:var(--ink-3);margin-top:2px}
  .apl-modal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:14px}
  .apl-modal-card{display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;text-align:center}
  .apl-modal-card .ngo-avatar{margin:0 auto}
  .apl-modal-card .nm{font-size:12px;font-weight:600;color:var(--ink)}
```

- [ ] **Step 2: Add `aplFoldersPanel()` and `openAplFolder()`**

Find (index.html, `aplNamesFor`):

```js
function aplNamesFor(ngoId){
  const names = (DB.users||[])
    .filter(u=>u.role==="APL" && Array.isArray(u.ngoIds) && u.ngoIds.includes(ngoId))
    .map(u=>u.name);
  return names.length ? names.join(", ") : "—";
}
```

Immediately after its closing brace, insert:

```js
/* V64: APL folders panel — Dashboard, PM only. One folder per APL user,
   grouping their assigned NGOs (DB.ngos filtered by apl.ngoIds — the
   same assignment field visibleNgos()/canEditNgo() already use). */
function aplFoldersPanel(){
  if(ME.role!=="PM") return '';
  const apls = (DB.users||[]).filter(u=>u.role==="APL");
  if(!apls.length) return '';
  return `<div class="apl-folders">
    ${apls.map(apl=>{
      const ngos = DB.ngos.filter(n=>(apl.ngoIds||[]).includes(n.id));
      const preview = ngos.slice(0,5);
      return `<div class="apl-folder" onclick="openAplFolder('${apl.id}')">
        <div class="apl-folder-fan">
          ${preview.map(n=>`<div class="apl-fan-chip"><div class="ngo-avatar ${(n.vertical||'').toLowerCase()}">${esc(n.short.slice(0,2).toUpperCase())}</div></div>`).join("")}
        </div>
        <div class="apl-folder-body">
          <div class="apl-folder-ico">📁</div>
          <div class="apl-folder-name">${esc(apl.name)}</div>
          <div class="apl-folder-count">${ngos.length} NGO${ngos.length===1?'':'s'}</div>
        </div>
      </div>`;
    }).join("")}
  </div>`;
}
function openAplFolder(aplId){
  const apl = (DB.users||[]).find(u=>u.id===aplId);
  if(!apl) return;
  const ngos = DB.ngos.filter(n=>(apl.ngoIds||[]).includes(n.id));
  const body = ngos.length
    ? `<div class="apl-modal-grid">
        ${ngos.map(n=>`<div class="apl-modal-card" onclick="closeModal();go('ngo','${n.id}')">
          <div class="ngo-avatar ${(n.vertical||'').toLowerCase()}">${esc(n.short.slice(0,2).toUpperCase())}</div>
          <div class="nm">${esc(n.short)}</div>
        </div>`).join("")}
      </div>`
    : `<div class="empty"><div class="mk">📁</div><p>No NGOs assigned to ${esc(apl.name)} yet.</p></div>`;
  showModal(modalShell("APL Folder", apl.name, body, ""));
}
```

- [ ] **Step 3: Wire the panel into `pageDash()`**

Find (index.html, `pageDash()`'s return template — the closing of `.kpi-grid` and the start of the "Partner NGOs" panel):

```js
  </div>

  <div class="panel" style="margin-bottom:14px">
    <div class="panel-h">
      <h3>Partner NGOs</h3>
```

Replace with:

```js
  </div>

  ${aplFoldersPanel()}

  <div class="panel" style="margin-bottom:14px">
    <div class="panel-h">
      <h3>Partner NGOs</h3>
```

- [ ] **Step 4: Syntax-check**

Run the extraction + check command from Global Constraints. Expected: no output.

- [ ] **Step 5: Manual verify in browser**

Read-only inspection only (see Global Constraints — no login/Save against production). Confirm:
- The page loads with no console errors, `node --check` clean.
- Since full behind-login verification isn't possible in this environment, ask Munjal to confirm after deploy: folders appear only for PM, hover fans out up to 5 chips, clicking a folder opens the modal with all assigned NGOs, clicking an NGO card navigates to its page and closes the modal, an APL with 0 NGOs shows an empty-state folder.

- [ ] **Step 6: Commit**

No git commit yet — see Task 3.

---

### Task 3: Version bump, snapshot, and deploy

**Files:**
- Modify: `CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html` (`<title>`, sidebar brand version, login subtitle version — three spots, per this session's established pattern)
- Modify: `CRITICAL FILES\Claude Apps\Partnership Dashboard\sw.js` (`CACHE` constant)
- Create: `CRITICAL FILES\Claude Apps\Partnership Dashboard\Partnership Dashboard V64.html` (versioned snapshot)
- Copy: `index.html` and `sw.js` into `D:\Guru\Mirror\01_KRSF\github\partnerngo\`

- [ ] **Step 1: Bump all three V63→V64 text spots**

Confirm exact count first: `grep -o ".\{15\}V63.\{15\}" "D:\Guru\Mirror\CRITICAL FILES\Claude Apps\Partnership Dashboard\index.html" | grep -v "^[A-Za-z0-9+/]*$"` (excludes the two coincidental base64-blob matches discovered earlier this session) — expect exactly 3 real hits, then replace each `V63` with `V64` in: `<title>`, the sidebar `.tg` line, and the login `.sub` line.

- [ ] **Step 2: Bump the service worker cache**

```js
const CACHE = 'sahkar-v63';
```
→
```js
const CACHE = 'sahkar-v64';
```

- [ ] **Step 3: Full syntax-check**

Run the extraction + check command from Global Constraints for `index.html`.
Run: `node --check "D:\Guru\Mirror\CRITICAL FILES\Claude Apps\Partnership Dashboard\sw.js"`
Expected: no output from either.

- [ ] **Step 4: Create the versioned snapshot**

Copy the final `index.html` to `CRITICAL FILES\Claude Apps\Partnership Dashboard\Partnership Dashboard V64.html`.

- [ ] **Step 5: Sync into the git repo folder**

Copy `index.html` and `sw.js` over the corresponding files in `D:\Guru\Mirror\01_KRSF\github\partnerngo\`.

- [ ] **Step 6: Commit**

```bash
cd "D:\Guru\Mirror\01_KRSF\github\partnerngo"
git status
git add index.html sw.js
git commit -m "V64 — APL folders on the Dashboard

PM-only panel right after the KPI grid: one folder per APL, showing
their assigned NGOs. Hover fans out a preview of up to 5 (CSS-only,
skipped on touch); click opens the full set via the existing modal
system; clicking an NGO card navigates to its detail page, same as the
existing table. Reuses .ngo-avatar's existing vertical colors — no new
visual language, no new dependencies."
```

Push is a separate, explicitly-confirmed step per this session's established practice.

- [ ] **Step 7: Confirm live (after push is separately authorized)**

Poll the live GitHub Pages URL until `<title>` shows "V64" and `sw.js` shows `sahkar-v64`.

---

## Self-Review Notes

- **Spec coverage**: PM-only gate, folder-per-APL, hover fan capped at 5, click-expand uncapped via existing modal system, minimal card content (avatar+name only), navigate-on-click, 0-NGO empty state — all present in Task 2. Placement (right after KPI grid) — Task 2 Step 3.
- **No placeholders**: every step shows complete before/after code.
- **Type/name consistency**: `aplFoldersPanel()` and `openAplFolder(aplId)` are the only two new function names, used consistently between their definition (Task 2 Step 2) and the one call site (Task 2 Step 3, `onclick="openAplFolder('${apl.id}')"`).
- **Reuse verified, not assumed**: `.ngo-avatar` vertical classes and `showModal`/`modalShell`/`closeModal`/`go()` signatures were all read directly from the live file before this plan was written, not guessed.
