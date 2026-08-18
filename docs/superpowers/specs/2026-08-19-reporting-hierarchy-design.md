# Reporting Hierarchy — Design

**Date:** 2026-08-19
**Status:** approved in conversation, pending written review

> This document is in a public repository. It contains no staff names.
> People are referred to as "a manager" and "a subordinate".

## Goal

Let a partnership lead see everything belonging to the people who report to
them — NGOs, milestones, finance, debit notes, Team MBO and Daily Sheet —
while still only being able to **change** their own records.

Today the model is flat: a lead sees exactly the NGOs ticked against them in
Admin, and can edit those same NGOs. Seeing and editing are the same set.

## The decisions taken

| Question | Answer |
|---|---|
| Can a manager edit a subordinate's records? | No. See everything below them, edit only their own. |
| What rolls up? | NGO list, and therefore Milestones, Finance and Debit Notes; plus Team MBO and Daily Sheet. |
| Dashboard folders | Unchanged — one folder per person, showing that person's **own** NGOs only. |
| Who sets the reporting lines? | The PM, via a new "Reports to" field in Admin. |

## Data model

One new optional field on a user record:

```js
reportsTo: "<user id of their manager>"   // "" or absent = top level
```

Nothing else changes. `ngoIds` keeps meaning exactly what it means today:
**the NGOs this person owns**, never the ones they merely oversee.

### Walking the tree

```js
teamOf(userId)         // Set: the user, plus everyone below them, any depth
effectiveNgoIds(userId) // Set: the union of ngoIds across teamOf(userId)
myNgoIds()             // Array: the signed-in user's OWN ngoIds — edit rights
```

`teamOf` walks breadth-first with a visited set, so a circular line
(A reports to B reports to A) terminates instead of hanging. Admin refuses to
create one in the first place, but the walk must be safe regardless — a cycle
could arrive from a restored backup or a concurrent edit.

## What widens, and what must not

**Widens (viewing):**

- `visibleNgos()` → NGOs in `effectiveNgoIds(ME.id)`
- `visibleBets()`, `docsNavCount()`, Finance and Debit Notes — all already
  derive from `visibleNgos()`, so they follow for free
- `visibleTeamMbo()` → rows whose `ownerId` is in `teamOf(ME.id)`
- Daily Sheet roll-up → the people in `teamOf(ME.id)`

**Must NOT widen (editing):**

- `canEditNgo(ngoId)` → keeps checking the signed-in user's **own** `ngoIds`

## The part that makes this more than a one-line change

Every write path in the app currently relies on an assumption that is about
to stop being true: **if you can see it, you own it.** Widening what a lead
can see silently grants edit rights anywhere that assumption is load-bearing.

An audit of all 44 functions that write to the database found:

| | Count |
|---|---|
| Verify the specific NGO before writing | 12 |
| Reachable only through a guarded opener | 17 |
| PM-only | 6 |
| **Need a check added or confirmed** | **9** |

The ones that need work:

| Function | Problem |
|---|---|
| `setPartnership` | Checks role only. A manager could flip a subordinate's NGO between Active and Passive. |
| `saveTask` | No NGO check. Tasks carry an `ngoId`. |
| `deleteTask` | Same. |
| `openNgoForm` | Confirm it is PM-only — it is the only route to `saveNgo`/`deleteNgo`. |
| `bbApplyImport` | Budget-book import; confirm which NGOs it can write to. |
| `dailySaveDay` | Confirm it can only write the signed-in user's own day. |
| `dailyHomeSaveToday` | Same. |
| `saveApl` / `deleteApl` / `savePm` / `importBackup` | Reached only from the Admin page, which is PM-only in the nav. Add an in-function check as well, so nav changes can never expose them. |

Three cosmetic follow-ons: the "+ New Milestone" button, the per-milestone
"Edit" button and the ladder's "tap a month" hint are all shown on `canEdit()`
(role) rather than `canEditNgo()`. `openBetForm()` does block the action, so
this is not a hole — but a manager would see buttons that refuse them. They
should be hidden on a subordinate's records instead.

## Admin

The user form gains a **Reports to** dropdown listing the other lead-role
users, plus "Nobody (top level)". It excludes:

- the user themselves
- anyone already below them in the tree — which is what would create a cycle

Saving with a cycle is refused with a plain message naming the two people.

The Admin user list gains a line showing each person's manager, so the shape
of the team is visible without opening each record.

## What a manager sees

On a subordinate's NGO, everything renders as it does for the owner, except
that Save, Delete and the inline editors are absent. A short line at the top
of the NGO page names the owner, so it is obvious why: *"Led by <name> — you
can view this partnership but not change it."*

The Dashboard's Partnership Lead column already names the owner, so a manager
scanning the table can tell their own rows from their team's.

## Out of scope

- Changing who owns an NGO — that stays a PM action in Admin
- Any notification when a subordinate's item slips
- Reassigning work down the tree
- A manager filling in a subordinate's Daily Sheet or MBO

## Testing

No test runner exists; verification is Node scripts against functions
extracted from `index.html` by `tests/harness.js`, plus the size-selecting
syntax check.

Each of these must be seen to fail before it passes:

- `teamOf` — self only when nobody reports to them; two levels; three levels;
  a cycle terminates; an unknown id returns just that id
- `effectiveNgoIds` — union across the tree, de-duplicated; a manager with no
  own NGOs still sees their team's
- `visibleNgos` — a manager sees own + team; a subordinate sees only their own
  and **never** their manager's; an unrecognised role sees nothing
- `canEditNgo` — true for own, **false for a subordinate's**, true for PM,
  false for an unrecognised role
- `visibleTeamMbo` — same shape as `visibleNgos`
- `setPartnership`, `saveTask`, `deleteTask` — refuse on an NGO the user does
  not own
- A written assertion that no function calling `saveDB()` is reachable by a
  lead role without an NGO-ownership check, so a future write path cannot
  quietly reintroduce the hole

## Risks

**This is a permissions change on live data.** The failure that matters is
fail-open: someone seeing or editing what they should not. Every new function
therefore fails closed, and the tests assert the negative cases, not just the
positive ones.

**The audit is static.** It found the call sites; it cannot prove no dynamic
path exists. The written assertion above is the ongoing guard.

**Nobody's reporting lines are set yet.** Until the PM fills them in, every
`reportsTo` is empty and the app behaves exactly as it does today. The change
is therefore inert until deliberately switched on, person by person.
