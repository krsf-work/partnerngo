# Team MBO — Design

**Date:** 2026-08-18
**Status:** approved in conversation, pending written review

> Note: this document is in a public repository. It deliberately contains no
> staff names and no MBO content. Where a real example is needed, the leads are
> called "Lead A" and "Lead B".

## Goal

Give the Programme Manager one place to see what every partnership lead has
committed to this month and what is about to slip, without chasing spreadsheets.
Leads keep working in Excel; they upload their existing file and the dashboard
reads it.

## Background — why not the existing MBO store

The app already has `DB.mbo` and an "OKR / MBO" tab on every NGO page. That store
holds **the partner NGO's own** objectives, keyed by `ngoId`. It is not the same
thing as a KRSF lead's personal MBO, which spans several partners at once and
includes work that belongs to no partner at all.

`DB.mbo` is therefore left completely untouched. This feature adds a new store.

The existing "Team OKR" nav item is a thin shortcut into the per-NGO store
(pick a lead → pick one of their NGOs → see that NGO's MBO). Two nav items both
called some flavour of "OKR" would confuse everyone, so **"Team OKR" is replaced**
by this page. Nothing is lost: the per-NGO MBO remains reachable from each NGO.

## Data model

New top-level collection `DB.teamMbo`, an array of records:

```js
{
  id:            "tmbo_a1b2c3",
  ownerId:       "<user id of the lead the file belongs to>",
  month:         "2026-08",      // the month block the row was read from
  type:          "kr",           // "kr" = key result, "action" = action item
  objNum:        "1",            // as written, normalised ("1.0" and "4.." → "1")
  objective:     "...",          // inherited down the block when the cell is blank
  title:         "...",          // the Key Result / Action Item text
  deadline:      "2026-08-15",   // ISO date, or "" when unreadable
  deadlineRaw:   "15th August 2026",   // exactly what the cell said
  deadlineFixed: false,          // true when a day/month swap was applied
  rank:          3,              // numeric priority cell, or null
  band:          "High",         // word priority cell, or ""
  status:        "In Progress",  // "Done" | "In Progress" | "Not Done" | ""
  timeEst:       "5 Days",
  timeSpent:     "3 Days",
  comment:       "...",
  ref:           "...",
  importedAt:    "2026-08-18",
  importBatch:   "imp_x9y8"      // one upload = one batch, so it can be undone whole
}
```

`deadlineRaw` is kept so a row whose date could not be parsed still shows the
person something rather than a blank. `importBatch` lets a bad import be reversed
as a unit instead of row by row.

### Registration points

`DB.teamMbo` must be declared in **all six** places a collection is registered,
or Firebase will hand it back as a keyed object and every `.filter()` on it will
throw:

1. `skeletonData()` — add `teamMbo: []`
2. `seedData()` return object — add `teamMbo: []`
3. `DB_PARTS` — add `"teamMbo"`
4. the live-listener array coercion list
5. the `loadDB()` fallback coercion list
6. the `migrateDB()` coercion list

## Permissions

```js
function visibleTeamMbo(){
  const rows = DB.teamMbo || [];
  if(ME && ME.role === "PM") return rows;
  if(ME) return rows.filter(r => r.ownerId === ME.id);
  return [];
}
```

The default is **empty, not everything**. An earlier scoping bug in this app
defaulted an unrecognised role to seeing all records; this function must fail
closed. When a non-PM opens the page, the person filter is fixed to themselves
and cannot be changed.

## The page

Replaces the "Team OKR" nav item. The nav **id stays `okrupload`** so no routing
or stored-page plumbing changes; only the label ("Team MBO") and the render
function change.

**Filter bar:** person · month · priority · status · type.

**One stream, grouped by urgency:**

Buckets are evaluated **in this order**, first match wins:

| # | Bucket | Rule |
|---|---|---|
| 1 | Done | `status === "Done"`, whatever its date, including no date; collapsed by default |
| 2 | ⚠ Overdue | `deadline !== "" && deadline < today` |
| 3 | This week | `today ≤ deadline ≤ today + 6 days` |
| 4 | Next 3 weeks | `deadline ≤ today + 27 days` |
| 5 | Later | any later deadline |
| 6 | No deadline given | `deadline === ""` |

Order matters: a completed item never appears in Overdue, and an undated
completed item lands in Done rather than in "No deadline given".

"No deadline given" is a visible bucket rather than a hidden one because roughly
a third of imported action items carry no date, and silently dropping them is
how commitments get forgotten.

**Each row** shows owner, title, its objective beneath, a Key Result / Action
tag, its priority as written, and either the date or "8d late". Clicking a row
opens the detail: comment, time estimate vs time spent, and the reference.

**Priority filter.** Two kinds of priority exist in the source data and both are
kept verbatim: some months use the words High / Medium / Low, later months use a
numeric rank where 1 is the lead's top item that month. The filter therefore
offers *Any priority* and *Top priority*, where "top priority" means
`band === "High" || rank <= 3`. The raw value is always shown on the row, so
nothing is hidden behind the filter's interpretation.

Ranks in the source are not strictly unique — a month may contain several rows
ranked 1 — so "top priority" can return more than three rows per person. This is
the data being loose, not a defect.

## The importer

An **Upload MBO** button on the page: choose whose file it is → pick the file →
**preview** → confirm. Nothing is written until confirm.

The uploader picks the person from a dropdown. The file itself is not a reliable
source for this — one observed layout embeds the lead's name in the block title,
the other does not.

### Block detection

Two real layouts were examined and they differ in block heading, indentation,
column order and header wording. The reader therefore determines the shape of
**each month block independently** rather than assuming one shape per sheet.

A row starts a new month block when **all** of:

- it has exactly one non-empty cell, and
- that cell contains `MBO`, a month name, and a four-digit year, and
- a row within the next 3 rows contains a cell matching `/key\s*result/i`

The third condition is what rejects false positives. Both files contain comment
text such as "…will send MBO by 5 January 2026" sitting in a Comment column; a
looser rule would treat that as a block heading and shred the rows beneath it.

### Header and column mapping

The header row is the first row after the title containing a cell matching
`/key\s*result/i` (or `/action\s*item/i` on the action sheet). Column positions
are read from **that** header, per block.

This is not optional. In one observed file, Priority is the 7th column in
October and the 6th in November, with Comment moving from 6th to 9th. A single
sheet-wide header would import that month's priority as its comment.

Names are matched after lowercasing and stripping non-letters:

| Field | Accepted headers |
|---|---|
| objective | `objective`, `goal` |
| title | `keyresult`, `actionitem` |
| deadline | `deadline`, `timeline`, `when`, `targetdate`, `duedate` |
| status | `status` |
| priority | `priority` |
| timeEst | `timeestimate` |
| timeSpent | `timespent` |
| comment | `comment`, `notes`, `remark` |
| ref | `reference`, `resource`, `resourse` |

`resourse` is a misspelling present in a real file and must be accepted.

Leading empty columns are ignored — one file's action sheet is indented by one
column.

### Objective inheritance

When a row's objective cell is blank but it has a title, it inherits the last
non-blank objective in that block. Both observed files rely on this, via merged
cells.

### Status normalisation

Lowercase and strip spaces, then:

- starts with `done` or `complete` → `Done`
- contains `progress` → `In Progress`
- starts with `not` or `note` → `Not Done`
- blank → `""` (shown as "Not started", greyed)

`note done` is a real typo in one file and must land on `Not Done`.

### Date parsing

Tried in order:

1. Excel serial number
2. `d/m/yyyy` or `d-m-yyyy` — **day first**
3. named month: `15th August 2026`, `31th July 2026`, `30 June 2026`
   (`31th` is a real typo and must parse)
4. otherwise `deadline = ""`, `deadlineRaw` keeps the text

### Date repair

Some dates are already wrong inside the source files. Where someone typed
`10/3/2026` meaning 10 March, Excel read it as 3 October and stored that serial.

Repair rule — apply only when **all** hold:

- the parsed month differs from the block's month, and
- the parsed day equals the block's month number, and
- swapping day and month yields a valid date inside the block's month

Then swap, and set `deadlineFixed = true`.

This was validated against both files: 6 such dates in one, 11 in the other, and
**all 17 are corrected by the swap** — no counter-examples. Every repaired date
is listed in the preview so the correction is visible, never silent.

A year more than five years from the block's year is **flagged, not fixed** (one
file contains `22/03/3036`).

### Action items sheet

Detected by a sheet name matching `/action\s*item/i`. A month heading is a row
with a single non-empty cell holding either a month name or a date. Where the
heading gives no year, the year is taken from the first parsed deadline in that
block; failing that the row is flagged in the preview rather than guessed.

Note that action-item dates and their month heading do not always agree in the
source. The **deadline drives the buckets**; the month heading is only a grouping
label.

### Re-uploading

Their file contains every month, so the same file will be uploaded repeatedly.
On confirm:

1. collect the set of months present in the file
2. delete existing `teamMbo` rows where `ownerId` matches **and** `month` is in
   that set
3. append the newly read rows

Without this, one list doubles every month.

### The preview

Shows what was read before anything is saved:

- a summary — months, key results, action items
- the parsed rows
- a **needs a look** section: unreadable dates, repaired dates, out-of-range
  years, rows with no title

## Dashboard rail

`.content` was capped at 1320px, which left roughly 360px of dead margin on a
1920px screen. The cap is now 1800px — high enough never to bind on a normal
monitor (a 1920px window leaves 1684px after the sidebar), while still stopping
table rows becoming unreadable on an ultrawide.

The Dashboard gains a **288px rail beside the Partner NGOs table**. The KPI
tiles and the people folders keep the full width; the rail starts level with
the table. It holds two cards:

- **⚠ Overdue** — most overdue first, tinted as an alert
- **Coming up** — soonest first

Both list key results and action items together, each tagged so they can be
told apart, capped at six with a "+ N more" link.

The rail deliberately ignores the Team MBO page's filter — it is a standing
view of current urgency. It needs no month window either: "overdue" already
excludes anything more than `TM_STALE_AFTER_DAYS` late, and "coming up" is by
definition ahead of today.

With nothing uploaded it renders nothing, so no empty column appears. With data
but nothing pressing it says "Nothing overdue" rather than showing a blank box.
Below 920px it drops beneath the table.

**It replaces the "Documents due soon" widget**, which is removed. Document
expiry is not lost: `docsExpiringCount()` still feeds the count badge on the
Documents nav item, and the Documents page still lists everything expiring.

Removal covers the widget call inside `aplFoldersPanel()`, `docsExpiringWidget()`,
`docsExpiringList()` (nothing else used it), and the now-dead `.apl-doc-*` CSS.
`docsExpiringCount()` **must stay** — removing it breaks the nav badge.
`tests/docs-badge.test.js` asserts all of this in both directions.

## Out of scope

- Editing key results inside the app
- Changing status inside the app — the next upload would overwrite it
- Any approval or sign-off workflow
- Linking action items to a parent key result — the source records no such link,
  so the app would be inventing a relationship nobody maintains
- Notifications or email

## Risks

**Two of six layouts seen.** The reader is built against two real files that
already differ substantially, which is a much better base than one — but four
leads' files remain unseen. The preview is the mitigation: a mismatch is visible
and cancellable, never silently stored. A fifth layout means adjusting the
reader, not corrupted data.

**Ranks are not unique.** "Top priority" may return more than three rows per
person per month.

**The spreadsheet reader is a CDN dependency.** `xlsx.full.min.js` is already
loaded from a CDN by the existing import, and the existing code already handles
its absence with a clear message. This feature inherits that; it does not make it
worse.

## Testing

No test runner exists in this project. Verification is:

- `node --check` on the extracted main script after every change, selecting the
  script block **by size** (`len > 100000`) — an offset-based selection silently
  checks the wrong block
- scratch Node tests for the pure logic, each seen to **fail first**: block
  detection against the false-positive comment rows, per-block column mapping
  against the October/November order change, the date-swap rule against all 17
  known cases plus counter-examples that must *not* be swapped, status
  normalisation including the `note done` typo, and re-upload replacement
- rendering every bucket state, including empty and "no deadline given", at
  375px as well as desktop
