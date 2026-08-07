# Compliance document alerts + Daily Sheet redesign

Status: approved by Munjal 2026-08-07, ready for implementation plan.

## Why

Two usability gaps surfaced from real incidents:

1. An NGO's MoU (or 12A certificate) lapsed and nobody noticed until after the fact. The app already tracks document expiry (`d.expires`, status pill in `docPill`-style logic around index.html:5384-5388) but nothing proactively surfaces it — you only see it if you happen to open that NGO's Documents tab.
2. The Daily Sheet feature (built earlier, `pageDaily()` / `DB.dailyLogs`) sees low adoption. The current fill UI is a 15-row hourly grid (`DAILY_HOURS = [7..21]`, two fields per hour) reached via a separate nav page — too much friction for field staff who'd use it from a phone.

Both fixes follow the same shape already established in `needsYouStrip()`: surface the thing that needs action on the Dashboard, don't make people go looking for it.

## Feature 1 — compliance document expiry alerts

**No data model change.** Reuses the existing `DB.documents` record (`{id, ngoId, type, name, url, uploaded, expires}`) and `DOC_TYPES` list (MoU, 12A Certificate, 80G Certificate, FCRA Certificate, Audited Financials, etc.).

**Threshold**: the "expiring soon" window moves from 90 days to 120 days. This is one constant used in two places today — the per-document status pill (index.html:5384-5388, currently `days<90`) and its doc-comment at index.html:1199. Both become `days<120`.

**Dashboard card**: `needsYouStrip(ngos)` gets a fifth card alongside the existing four (flagged emails, pending review, overdue tasks, finance):

```
{n: count, ic:"📋", cls:"amber", go:"go('docs')",
 lab: count===1 ? "document expiring or expired" : "documents expiring or expired"}
```

`count` = documents where `d.expires` is set, `days < 120` (covers both "Expires in Nd" and already-`Expired`), filtered to `ids` (the NGO-id set already computed from the `ngos` param `needsYouStrip` receives — no new scoping logic needed, it already receives `visibleNgos()`-scoped NGOs from its caller).

**Nav badge**: the `docs` entry in `navItems()` currently has no `count`. It gets one, same expression as above, computed against `visibleNgos()` (matching how `debits`/`tasks` already compute their counts inline in that function).

**Not in scope**: email/push notifications, a dedicated "compliance" page, or tracking any document types beyond what `DOC_TYPES` already lists. This is visibility-only — the existing Documents tab and edit form are unchanged.

## Feature 2 — Daily Sheet: fixed blocks instead of hourly grid

### Current state (for contrast, not being deleted)

- `DAILY_HOURS = [7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]` — 15 slots.
- `DB.dailyLogs` record: `{id, aplId, date, hours:{ [hour]: {for, detail} }, comments:[], editedBy, editedAt}`.
- `dailyFilled(rec)` = `Object.keys(rec.hours||{}).length`.
- Reached only via the "Daily Sheet" nav item; APL/Programme fill their own hours row-by-row, PM sees a roll-up.

### New block model

Three fixed, non-editable blocks, spanning the same 7 AM–9 PM window:

```js
const DAILY_BLOCKS = [
  { key:"morning",   label:"Morning",   range:"7–12", hours:5 },
  { key:"afternoon", label:"Afternoon", range:"12–5", hours:5 },
  { key:"evening",   label:"Evening",   range:"5–9",  hours:4 }
];
```

New `dailyLogs` records store one free-text field per block instead of the hour grid:

```js
{ id, aplId, date, blocks:{ morning:"", afternoon:"", evening:"" }, comments:[], editedBy, editedAt }
```

No time picker anywhere — the range in each block is a fixed label, never entered by the user. Filling today is: tap a block's text box, type one line, done. 2-3 taps for a full day.

**No data loss / no migration of old records.** Existing `dailyLogs` rows keep their `hours:{...}` shape untouched, forever — they are never rewritten. `dailyRec()` is unchanged (still finds by `aplId`+`date`). `dailyFilled(rec)` is updated to check whichever shape the record has:

```js
function dailyFilled(rec){
  if(!rec) return 0;
  if(rec.blocks) return DAILY_BLOCKS.filter(b=>(rec.blocks[b.key]||"").trim()).length;
  return Object.keys(rec.hours||{}).length;
}
```

Any history view that renders a past day must branch on `rec.blocks ? <block view> : <legacy hourly-grid view>` — old data keeps displaying exactly as it does today, new data displays as blocks. This is the only place old-format awareness is needed; everywhere else (counts, "is today done") goes through `dailyFilled()`.

**Approximate hours** (derived, never entered): `sum of DAILY_BLOCKS[i].hours where blocks[key] is non-empty`. Purely computed from the fixed block lengths — no new input from anyone. Shown next to the completion count, e.g. "2 of 3 blocks · ~10h".

### Where it lives

- **Dashboard home-screen widget** (new): for APL/Programme roles only, a compact card at the top of the Dashboard showing *today's* three blocks with inline text boxes — the mockup already approved. This is the primary way people log, no navigation required.
- **Daily Sheet nav page** (existing page, new fill UI): same three-block UI, but also lets APL/Programme browse past days. For PM, this page's roll-up view changes from hour-based stats to per-person "N of 3 blocks · ~Hh" per day, expandable to read the actual block text. Date-range filtering and the existing comment thread on each day's record are unchanged.
- **Nav badge on "daily"**: for APL/Programme, blocks left to fill *today* (hidden once 0, i.e. all 3 done). For PM, count of team members who haven't completed today's log yet — "team" here is the same set `dailyPmPage()` already uses: `DB.users.filter(u=>u.role==="APL"||u.role==="Programme")`, no NGO-scoping (PM sees the whole team).
- **Dashboard `needsYouStrip` card**: for APL/Programme, "N blocks left today" (routes to `go('daily')`). For PM, "N team members haven't logged today" (also routes to `go('daily')`), using the same team set as above. Same card-array pattern as Feature 1's new card — these are two more entries added to the existing `cards` array in `needsYouStrip()`, each conditional on `ME.role`.

### Explicitly out of scope

- No push/email notifications or end-of-day reminders — enforcement is visibility-only (home-screen placement + dashboard nudge + nav badge), consistent with Feature 1's posture.
- No hard blocking of other app actions when today's log is incomplete.
- No per-NGO or per-activity structured tagging on blocks — each block is one free-text field, full stop. If per-NGO hour tracking is wanted later, that is a separate future decision, not part of this change.
- No migration/backfill of historical `hours`-shaped records into `blocks` shape.

## Testing / verification plan

- Confirm `dailyFilled()` correctly counts both a legacy `hours`-shaped record and a new `blocks`-shaped record.
- Confirm a past day with the old hourly grid still renders correctly in history (nothing silently drops old data).
- Confirm the Dashboard widget only appears for APL/Programme, not PM/Viewer/Accounts/Finance.
- Confirm nav badges and `needsYouStrip` cards compute correctly for each role (APL scoped to self, PM scoped to team, Programme scoped to assigned NGOs for the docs card).
- Confirm the 120-day threshold change is applied consistently (status pill + any other place `90` appears in expiry logic — grep before shipping to catch stragglers).
- Manual pass at 375px width given the Dashboard widget is explicitly mobile-first.
