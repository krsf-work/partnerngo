# Compliance document alerts + Daily Sheet redesign

Status: approved by Munjal 2026-08-07, ready for implementation plan.

**Revision (2026-08-07, same day):** Feature 2 was originally approved as a 3-fixed-block redesign (Morning/Afternoon/Evening, one free-text field each) and partially implemented (data-shape functions, accordion editor, PM roll-up tile, Dashboard widget — all syntax-checked but never deployed). After seeing it live, Munjal reversed that call: the block UI itself "is bad," and the app should go back to hourly time-slot entry. This revision replaces the original Feature 2 section below with the hourly-grid design, and adds Feature 3 (top-bar declutter), raised in the same conversation. **None of the block-shaped code was ever deployed** — no live `dailyLogs` record has ever been saved in `blocks` shape, so this revision has no data-migration concerns; the block-related code added earlier today is simply removed.

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

**Status: implemented and syntax-checked as of this revision. No further changes needed for Feature 1.**

## Feature 2 — Daily Sheet: hourly grid stays, reachable from the Dashboard

### What stays exactly as it was

The 15-row hourly grid is the fill mechanism, full stop — no fixed blocks, no free-text-only blocks:

- `DAILY_HOURS = [7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]` — 15 slots.
- `DB.dailyLogs` record: `{id, aplId, date, hours:{ [hour]: {for, detail} }, comments:[], editedBy, editedAt}` — this is the *only* shape; there is no second/legacy shape to reconcile.
- `dailyFilled(rec)` = `Object.keys(rec.hours||{}).length` — the original one-line version.
- `dailyGrid()`, `dailySaveDay()`, `dailyPmPage()`'s hours-based stats (`totalHours`, `byFor`/`topFor`) — all unchanged from before this session's edits.

Any block-shaped code added earlier today (`DAILY_BLOCKS`, `dailyBlocksSection`, `dailySaveDayBlocks`, `dailyFormat`, `dailyApproxHours`, `dailyBadgeLabel`, the block-completion PM KPI tile, the `dailyDateRow` format-branching) is removed. Since nothing in `blocks` shape was ever saved, this is a clean removal, not a migration.

### What's new: Dashboard home-screen widget

For APL/Programme roles only, a "Today's log" card at the top of the Dashboard (same location `needsYouStrip()` already occupies, directly below it) — the primary way to log without navigating to the Daily Sheet page. This did not exist before today's session; it's the one piece of the original low-friction goal that survives the reversal.

Shape: the same two-field-per-hour grid as the full Daily Sheet page, rendered inside a fixed-height scrollable box (~5 rows visible, scroll for the rest of the day) rather than the full un-scrolled 15 rows — approved mockup option "A: scrollable mini-grid". One "Save day" button at the bottom.

The widget does **not** call the existing `dailySaveDay(aplId,date)` directly — that function's `DAILY_OPEN !== aplId+"|"+date` guard exists to protect the Daily Sheet page's accordion (where the same `dfor_h`/`ddet_h` input ids are reused across whichever day happens to be expanded), and `DAILY_OPEN` is generally `null` while looking at the Dashboard. Calling it as-is would make the widget's save silently refuse most of the time. Since the app renders one page at a time (`CUR_PAGE` routing — the Dashboard and Daily Sheet page are never in the DOM simultaneously), there's no id-collision risk to guard against here; the widget is always unambiguously "today." So a new, small `dailyHomeSaveToday()` reads the same `dfor_h`/`ddet_h` ids and writes to today's record directly, no guard — mirroring the same split (guarded page-save vs. unguarded home-save) already used successfully for `dailySaveDayBlocks`/`dailyHomeSaveToday` earlier this session, just against the hourly shape instead of blocks.

The Daily Sheet nav page itself is unchanged beyond what it already was pre-session: full hourly grid, same as always, still the place to browse/fill past days.

### "Needs your attention" nudges — binary, not a countdown

Hourly logging has no fixed daily target the way "3 blocks" did, so the enforcement nudges become binary (logged something today vs. nothing) rather than a remaining-count:

- **APL/Programme** — nav badge on "Daily Sheet" and a `needsYouStrip` card both appear only when *zero* hours are logged for today (`dailyFilled(dailyRec(ME.id, TODAY_ISO)) === 0`), and disappear the moment at least one hour is filled. Label: "Log today's hours" (card), a plain presence-indicator badge (count of `1`) on the nav item — not a number that means anything quantitative, just "there's something here."
- **PM** — unchanged from the block-era design: count of team members (`DB.users.filter(u=>u.role==="APL"||u.role==="Programme")`) with zero hours logged today, on both the nav badge and the `needsYouStrip` card. This logic never depended on which shape a day's data was in, so it needs no changes.

### Explicitly out of scope (unchanged from original spec)

- No push/email notifications or end-of-day reminders — enforcement is visibility-only.
- No hard blocking of other app actions when today's log is incomplete.
- No per-NGO or per-activity structured tagging beyond the existing "For" field.

## Feature 3 — Top bar declutter (new, raised in this revision)

The app's global chrome (`index.html:1132-1142`, class `.topbar`) is shared across every page — it is not specific to Daily Sheet. Today it holds, left to right: a mobile hamburger menu button (☰, opens the sidebar nav on phones), a plain-text page-name "crumb" (e.g. "Daily Sheet", "Dashboard"), a connection-status dot, and a "Reporting month" label + dropdown.

**What changes:**
- The page-name crumb text is removed entirely. It's redundant — every page already renders its own title in-content (`phead slim` → `<h1 class="serif">Dashboard</h1>` etc., confirmed at index.html:2725-2726 and similar `phead` blocks throughout). Low-risk change, same reasoning applies on every page.
- The hamburger menu button and connection-status dot **stay in place**, unchanged — explicitly confirmed as still needed (mobile nav trigger, online/offline signal).
- The "Reporting month" control **moves out of the top bar into the sidebar**, near the user's name/sign-out at the bottom (approved mockup option "C"). The resulting top bar is nearly empty — just the hamburger and the dot — which is what "don't need a top bar" meant in practice: not a literal empty div, but no more full-width bar competing for attention.

**Not in scope:** no change to what reporting-month selection *does* (`onMonthChange()`, `CUR_MONTH`, `FY_MONTHS` logic) — only where its control lives on screen. No change to the hamburger's behavior or the connection dot's logic — only their surrounding bar shrinks.

## Testing / verification plan

- Confirm the Daily Sheet page's hourly grid, save, and PM roll-up all work exactly as they did before this session (no lingering block-era code, no `dailyFormat`/`blocks` references left anywhere).
- Confirm the new Dashboard "Today's log" widget only appears for APL/Programme, not PM/Viewer/Accounts/Finance, and that its scrollable mini-grid actually scrolls at 375px width.
- Confirm the widget's "Save day" (`dailyHomeSaveToday()`) and the Daily Sheet page's "Save day" (`dailySaveDay()`) don't collide — both write to the same `dailyLogs` record for today; navigate Dashboard → save an hour → Daily Sheet page → open today's row and confirm the hour is there; then edit an hour on the page, save, return to Dashboard, and confirm the widget reflects it.
- Confirm nav badges and `needsYouStrip` cards: APL/Programme see a binary "log today's hours" nudge that disappears after the first hour is saved; PM sees the team headcount nudge, unaffected by this revision.
- Confirm the 120-day document-expiry threshold change is still applied consistently (already verified earlier this session; re-check nothing regressed).
- Confirm the top bar: page-name crumb gone on every page, hamburger + connection dot still present and functional, reporting-month dropdown works from its new home in the sidebar and still drives `CUR_MONTH` correctly.
- Manual pass at 375px width for the Dashboard widget, the Daily Sheet page, and the sidebar's relocated month picker.
